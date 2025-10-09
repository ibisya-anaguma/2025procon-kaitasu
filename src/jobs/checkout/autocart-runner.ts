//あらとも

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

type SubItem = {
  id?: any;
  itemId?: any;
  productId?: any;
  url?: string;
  name?: string;
  image?: string;
  price?: number;
  priceTax?: number;
  quantity?: number;
  qty?: number;
  genre?: number | string;
  frequency?: number; // アイテム単位の頻度（優先）
};

type HistItem = {
  id?: any;
  itemId?: any;
  productId?: any;
  url?: string;
  name?: string;
  quantity?: number;
  timeStamp?: any;
  timestamp?: any;
  createdAt?: any;
};

type Args = {
  cred?: string;
  days: number;
  dry: boolean;
  debug: boolean;
  explain: boolean;
  limit?: number;
  delayMs?: number;
  uid?: string;
  includeNever?: boolean;
  forceAdd?: boolean;
};

const DAY_MS = 24 * 3600 * 1000;

function toDateAny(v: any): Date | null {
  if (!v) return null;
  if (typeof v === "object" && typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function intQty(v: any, def = 1) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

// ----- ID 正規化 / 候補キー作成 -----
function idFromUrl(url?: string): string {
  if (!url) return "";
  const s = String(url);
  const m = s.match(/\/([A-Za-z0-9\-_.]{4,})\.html(?:[?#].*)?$|[?&]id=([A-Za-z0-9\-_.]{4,})/);
  if (m && (m[1] || m[2])) return (m[1] || m[2]).trim();
  const any = s.match(/[A-Za-z0-9]{4,}/g);
  if (any && any.length) return any.sort((a, b) => b.length - a.length)[0];
  return "";
}

function normalizeId(val: any, url?: string): string {
  if (url) {
    const u = idFromUrl(url);
    if (u) return u;
  }
  if (val == null) return "";
  if (typeof val === "object") {
    try { val = JSON.stringify(val); } catch { val = String(val); }
  }
  const s = String(val).trim();
  if (!s) return "";
  if (/^[A-Za-z0-9\-_.]{4,}$/.test(s)) return s;
  const any = s.match(/[A-Za-z0-9]{4,}/g);
  if (any && any.length) return any.sort((a, b) => b.length - a.length)[0];
  const num = s.match(/\d{4,}/g);
  if (num && num.length) return num.sort((a, b) => b.length - a.length)[0];
  return "";
}

function candidateKeysForItem(item: any): string[] {
  const keys = new Set<string>();
  function addCandidate(v: any) {
    if (v == null) return;
    const s = String(v).trim();
    if (!s) return;
    const n = normalizeId(s, item?.url);
    if (n) keys.add(`id:${n}`);
    const name = String(item?.name || item?.title || "").trim().toLowerCase();
    if (name) keys.add(`name:${name.replace(/\s+/g, " ")}`);
    keys.add(`raw:${s}`);
  }

  const fields = ["itemId", "item_id", "productId", "product_id", "id", "sku", "skuId", "shop_item_id", "product_id_jp"];
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(item || {}, f)) addCandidate((item as any)[f]);
    // case-insensitive variants
    for (const k of Object.keys(item || {})) {
      if (k.toLowerCase() === f.toLowerCase() && k !== f) addCandidate((item as any)[k]);
    }
  }

  if (item && item.url) {
    const u = idFromUrl(item.url);
    if (u) keys.add(`id:${u}`);
  }

  if (item && item.name) {
    const nm = String(item.name).trim().toLowerCase().replace(/\s+/g, " ");
    if (nm) keys.add(`name:${nm}`);
  }

  if (item && item.id) addCandidate(item.id);

  try { keys.add(`rawobj:${JSON.stringify(item)}`); } catch {}

  return Array.from(keys);
}

function daysBetween(a: Date, b: Date) { return Math.floor((a.getTime() - b.getTime()) / DAY_MS); }

// ----- Firebase init (env / .firebase / secret 対応) -----
function initAdmin(credPath?: string) {
  try {
    const wsa = path.resolve(".firebase/firebase-key.json");
    if (credPath) {
      const resolved = path.resolve(credPath);
      if (fs.existsSync(resolved)) process.env.GOOGLE_APPLICATION_CREDENTIALS = resolved;
    } else if (fs.existsSync(wsa)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = wsa;
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const tmp = "/tmp/firebase-action-key.json";
      fs.writeFileSync(tmp, process.env.FIREBASE_SERVICE_ACCOUNT, { encoding: "utf8", mode: 0o600 });
      process.env.GOOGLE_APPLICATION_CREDENTIALS = tmp;
    }
  } catch (e) {
    // ignore
  }

  const credFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  if (credFile && fs.existsSync(credFile)) {
    const sa = JSON.parse(fs.readFileSync(credFile, "utf8"));
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
    process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT = sa.project_id;
    return admin.firestore();
  } else {
    admin.initializeApp();
    return admin.firestore();
  }
}

// ----- buildLastBoughtMap: history から candidateKeys -> lastDate map をつくる -----
async function buildLastBoughtMap(db: admin.firestore.Firestore, histPath: string, debug = false, explain = false) {
  const map = new Map<string, Date>();
  const pathSegs = histPath.split("/").filter(Boolean);

  async function collectFromDoc(docSnap: admin.firestore.DocumentSnapshot) {
    const data = (docSnap.data && docSnap.data()) || {};
    const docTs = toDateAny((data as any).createdAt) || toDateAny((data as any).created_at) || (docSnap.createTime ? docSnap.createTime.toDate() : null);
    const arr: HistItem[] = Array.isArray((data as any).items) ? (data as any).items : (Array.isArray((data as any).history) ? (data as any).history : []);

    for (const it of arr) {
      const itemTs = toDateAny((it as any).timeStamp) || toDateAny((it as any).timestamp) || toDateAny((it as any).createdAt) || null;
      const usedTs = itemTs || docTs;
      if (!usedTs) continue;
      const keys = candidateKeysForItem(it);
      if (explain) console.log(`[EXPLAIN] history doc ${docSnap.id} item keys:`, keys);
      for (const k of keys) {
        const prev = map.get(k);
        if (!prev || prev < usedTs) map.set(k, usedTs);
      }
    }

    // subcollections (もしあれば安全に掘る)
    try {
      if ((docSnap as any).ref && typeof (docSnap as any).ref.listCollections === "function") {
        const subcols = await (docSnap as any).ref.listCollections();
        for (const sc of subcols) {
          try {
            const sSnap = await sc.get();
            for (const sd of sSnap.docs) {
              const sdata = sd.data() || {};
              const ts = toDateAny((sdata as any).timeStamp) || toDateAny((sdata as any).createdAt) || docTs;
              if (!ts) continue;
              const keys = candidateKeysForItem(sdata);
              if (explain) console.log(`[EXPLAIN] history subdoc ${sd.ref.path} keys:`, keys);
              for (const k of keys) {
                const prev = map.get(k);
                if (!prev || prev < ts) map.set(k, ts);
              }
            }
          } catch (e) {
            if (debug) console.warn("subcol read failed:", sc.path, e && (e as any).message);
          }
        }
      }
    } catch (e) {
      if (debug) console.warn("listCollections failed:", (e as any).message || e);
    }
  }

  if (pathSegs.length % 2 === 1) {
    let snap: admin.firestore.QuerySnapshot;
    try { snap = await db.collection(histPath).orderBy("createdAt", "asc").get(); } catch { snap = await db.collection(histPath).get(); }
    for (const d of snap.docs) await collectFromDoc(d);
  } else {
    const doc = await db.doc(histPath).get();
    if (doc.exists) await collectFromDoc(doc);
  }

  if (debug) {
    console.log("[DEBUG] lastBought map size:", map.size);
    if (map.size <= 200) console.log("[DEBUG] lastBought keys (sample):", Array.from(map.entries()).map(([k, v]) => `${k} -> ${v.toISOString().slice(0, 10)}`));
    else console.log("[DEBUG] lastBought keys sample:", Array.from(map.keys()).slice(0, 50));
  }
  return map;
}

// ----- collectDueItems: subscriptions を読み、lastMap を使って due を判定 -----
async function collectDueItems(
  db: admin.firestore.Firestore,
  subsPath: string,
  lastMap: Map<string, Date>,
  defaultDays: number,
  debug = false,
  explain = false,
  includeNever = false
) {
  const dueByDoc: Array<{ subId: string; items: SubItem[]; dueInfo: Array<{ key: string; last: Date | null; daysSince: number; threshold: number }> }> = [];
  const subsSnap = await db.collection(subsPath).get();
  if (debug) console.log("[DEBUG] subscriptions docs:", subsSnap.size);

  for (const doc of subsSnap.docs) {
    const data = doc.data() || {};
    const subLevelFreq = Number((data as any).frequency) || 0;
    const items: SubItem[] = Array.isArray((data as any).items) ? (data as any).items : [];
    const dueItems: SubItem[] = [];
    const info: Array<{ key: string; last: Date | null; daysSince: number; threshold: number }> = [];

    for (const it of items) {
      const keys = candidateKeysForItem(it);
      // exact match check
      let last: Date | null = null;
      let matchedKey: string | null = null;
      for (const k of keys) {
        const f = lastMap.get(k);
        if (f) { last = f; matchedKey = k; break; }
      }

      // if not found and includeNever true, treat as due
      const itemFreq = Number((it as any).frequency) || 0;
      const threshold = itemFreq > 0 ? itemFreq : (subLevelFreq > 0 ? subLevelFreq : defaultDays);

      if (!last) {
        if (includeNever) {
          const addItem: SubItem = { ...(it as any), quantity: intQty((it as any).quantity ?? (it as any).qty ?? 1, 1) };
          dueItems.push(addItem);
          info.push({ key: keys[0] || "(no-key)", last: null, daysSince: Number.MAX_SAFE_INTEGER, threshold });
          if (explain) console.log(`[EXPLAIN] ${doc.id} :: ${(it as any).name || it.url || it.id} -> last=N/A but includeNever => DUE thr=${threshold} keys=${keys}`);
        } else {
          if (explain) console.log(`[EXPLAIN] ${doc.id} :: ${(it as any).name || it.url || it.id} -> last=N/A keys=${keys} => skip`);
          continue;
        }
      } else {
        const daysSince = daysBetween(new Date(), last);
        if (daysSince >= threshold) {
          dueItems.push({ ...(it as any), quantity: intQty((it as any).quantity ?? (it as any).qty ?? 1, 1) });
          info.push({ key: matchedKey || keys[0] || "(no-key)", last, daysSince, threshold });
          if (explain) console.log(`[EXPLAIN] ${doc.id} :: ${(it as any).name || it.url || it.id} -> last=${last.toISOString().slice(0,10)} daysSince=${daysSince} threshold=${threshold} matchedKey=${matchedKey}`);
        } else {
          if (explain) console.log(`[EXPLAIN] ${doc.id} :: ${(it as any).name || it.url || it.id} -> last=${last.toISOString().slice(0,10)} daysSince=${daysSince} threshold=${threshold} => not yet`);
        }
      }
    }

    if (dueItems.length) {
      dueByDoc.push({ subId: doc.id, items: dueItems, dueInfo: info });
      if (debug) console.log(`[DEBUG] due @${doc.id}: ${dueItems.length} items`);
    }
  }

  return dueByDoc;
}

// ----- writePurchase: cart に ItemId を docId として作成/更新（存在すれば quantity を加算） -----
async function writePurchase(
  db: admin.firestore.Firestore,
  uid: string,
  bundles: Array<{ subId: string; items: SubItem[]; dueInfo: Array<{ key: string; last: Date | null; daysSince: number; threshold: number }> }>,
  dry: boolean,
  debug = false,
  forceAdd = false
) {
  if (!bundles.length) return 0;
  const colPath = `users/${uid}/cart`;
  const col = db.collection(colPath);
  let wrote = 0;

  for (const b of bundles) {
    for (const it of b.items) {
      // docId 優先: itemId -> productId -> id -> URL正規化
      const docIdCandidate = normalizeId((it as any).itemId ?? (it as any).item_id ?? (it as any).productId ?? (it as any).product_id ?? (it as any).id, it.url);
      const qty = intQty((it as any).quantity ?? (it as any).qty ?? 1, 1);

      if (docIdCandidate) {
        const ref = col.doc(docIdCandidate);
        const snap = await ref.get();
        if (snap.exists) {
          const data = snap.data() || {};
          const existingQty = Number((data as any).quantity ?? (data as any).quantify ?? 0) || 0;
          const newQty = existingQty + qty;
          const updateBody: any = {
            quantity: newQty,
            quantify: newQty,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            url: it.url || data.url || "",
            name: it.name || data.name || "",
            image: it.image || data.image || "",
            price: typeof it.price === "number" ? it.price : (data.price ?? null),
            priceTax: typeof it.priceTax === "number" ? it.priceTax : (data.priceTax ?? null),
            source: "auto-subscription",
          };
          if (dry) {
            console.log("[DRY RUN] would update cart doc:", ref.path, JSON.stringify(updateBody));
          } else {
            await ref.set(updateBody, { merge: true });
            if (debug) console.log(`[DEBUG] updated cart doc=${ref.path} quantity=${newQty}`);
          }
          wrote++;
        } else {
          const body: any = {
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            quantity: qty,
            quantify: qty,
            url: it.url || "",
            name: it.name || "",
            image: it.image || "",
            price: typeof it.price === "number" ? it.price : null,
            priceTax: typeof it.priceTax === "number" ? it.priceTax : null,
            source: "auto-subscription",
          };
          if (dry) {
            console.log("[DRY RUN] would create cart doc:", col.doc(docIdCandidate).path, JSON.stringify(body));
          } else {
            await col.doc(docIdCandidate).set(body, { merge: true });
            if (debug) console.log(`[DEBUG] created cart doc=${col.doc(docIdCandidate).path}`);
          }
          wrote++;
        }
      } else {
        const body: any = {
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          quantity: qty,
          quantify: qty,
          url: it.url || "",
          name: it.name || "",
          image: it.image || "",
          price: typeof it.price === "number" ? it.price : null,
          priceTax: typeof it.priceTax === "number" ? it.priceTax : null,
          source: "auto-subscription",
        };
        if (dry) {
          console.log("[DRY RUN] would add cart doc (auto-id):", JSON.stringify(body));
        } else {
          await col.add(body);
          if (debug) console.log("[DEBUG] added cart doc (auto-id)");
        }
        wrote++;
      }
    }
  }

  return wrote;
}

// ----- CLI args -----
function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string, d = "") => {
    const i = argv.indexOf(k);
    return i >= 0 ? String(argv[i + 1]) : d;
  };
  const has = (k: string) => argv.includes(k);
  return {
    cred: get("--cred", process.env.GOOGLE_APPLICATION_CREDENTIALS || ""),
    days: Number(get("--days", "30")) || 30,
    dry: has("--dry"),
    debug: has("--debug"),
    explain: has("--explain"),
    limit: Number(get("--limit", "0")) || undefined,
    delayMs: Number(get("--delay-ms", "200")) || 200,
    uid: get("--uid", "") || undefined,
    includeNever: has("--include-never"),
    forceAdd: has("--force-add"),
  };
}

async function getUserIdsWithSubscriptions(db: admin.firestore.Firestore, limit?: number, debug = false, uid?: string) {
  if (uid) {
    const doc = await db.collection("users").doc(uid).get();
    if (!doc.exists) {
      if (debug) console.log(`[DEBUG] user ${uid} does not exist`);
      return [];
    }
    const subsSnap = await db.collection(`users/${uid}/subscriptions`).limit(1).get();
    if (subsSnap.empty) {
      if (debug) console.log(`[DEBUG] user ${uid} has no subscriptions`);
      return [];
    }
    return [uid];
  }

  const ids: string[] = [];
  const coll = db.collection("users");
  const snap = await coll.get();
  for (const doc of snap.docs) {
    const uidDoc = doc.id;
    const subsSnap = await db.collection(`users/${uidDoc}/subscriptions`).limit(1).get();
    if (!subsSnap.empty) {
      ids.push(uidDoc);
      if (debug) console.log(`[DEBUG] will process user=${uidDoc}`);
      if (limit && ids.length >= limit) break;
    }
  }
  return ids;
}

// ----- main -----
(async () => {
  const args = parseArgs();
  const db = initAdmin(args.cred);

  console.log("[INFO] starting autocart-runner", {
    dry: args.dry,
    days: args.days,
    limit: args.limit,
    delayMs: args.delayMs,
    uid: args.uid,
    includeNever: args.includeNever,
    forceAdd: args.forceAdd,
  });

  const uids = await getUserIdsWithSubscriptions(db, args.limit, args.debug, args.uid);
  console.log(`[INFO] users to process: ${uids.length}`);

  let totalAdded = 0;
  let totalProcessed = 0;
  for (const uid of uids) {
    totalProcessed++;
    console.log(`\n--- Processing uid=${uid} (${totalProcessed}/${uids.length}) ---`);
    try {
      const lastMap = await buildLastBoughtMap(db, `users/${uid}/history`, args.debug, args.explain);
      if (args.debug) console.log("[DEBUG] lastMap sample keys:", Array.from(lastMap.keys()).slice(0,50));
      const bundles = await collectDueItems(db, `users/${uid}/subscriptions`, lastMap, args.days, args.debug, args.explain, !!args.includeNever);

      if (bundles.length === 0) {
        console.log("[INFO] no due items for user:", uid);
      } else {
        if (args.debug) console.log("[DEBUG] bundles to write:", JSON.stringify(bundles, null, 2));
        const wrote = await writePurchase(db, uid, bundles, args.dry, args.debug, !!args.forceAdd);
        console.log(`[INFO] user=${uid} wrote=${wrote}`);
        totalAdded += wrote;
      }
    } catch (e: any) {
      console.error(`[ERROR] user=${uid} ->`, e && e.stack ? e.stack : e);
    }
    if (args.delayMs) await new Promise((r) => setTimeout(r, args.delayMs));
  }

  console.log(`\nDone. users_processed=${totalProcessed} total_added=${totalAdded} (dry=${args.dry})`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});