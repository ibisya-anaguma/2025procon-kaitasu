// src/jobs/checkout/autocart-runner.ts
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// ===== Types =====
type SubItem = {
  id?: any;
  url?: string;
  name?: string;
  image?: string;
  price?: number;
  priceTax?: number;
  quantity?: number;
  genre?: number | string;
  frequency?: number;
};
type HistItem = {
  id?: any;
  url?: string;
  name?: string;
  quantity?: number;
  timeStamp?: any;
  timestamp?: any;
};

type Args = {
  cred?: string;
  days: number;
  dry: boolean;
  debug: boolean;
  explain: boolean;
  limit?: number;
  delayMs?: number;
};

// ===== utils =====
const DAY_MS = 86400000;

function toDateAny(v: any): Date | null {
  if (!v) return null;
  if (typeof v === "object" && v.toDate) return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function intQty(v: any, def = 1) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

function idFromUrl(url?: string): string {
  if (!url) return "";
  const m = String(url).match(/\/(\d{6,})\.html(?:[?#].*)?$/);
  return m ? m[1] : "";
}

function normalizeId(val: any, url?: string): string {
  if (url) {
    const u = idFromUrl(url);
    if (u) return u;
  }
  if (typeof val === "string" && /^\d{6,}$/.test(val.trim())) return val.trim();
  if (typeof val === "number" && Number.isFinite(val)) {
    const s = String(Math.trunc(val));
    if (/^\d{6,}$/.test(s)) return s;
  }
  return "";
}

function stableKeyFrom(item: { id?: any; url?: string; name?: string }): string {
  const id = normalizeId(item.id, item.url);
  if (id) return `id:${id}`;
  const urlId = idFromUrl(item.url || "");
  if (urlId) return `id:${urlId}`;
  if (item.name) return `name:${String(item.name).trim().toLowerCase()}`;
  return `row:${Math.random()}`;
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}

// ===== Firestore init (robust) =====
function initAdmin(credPath?: string) {
  // 1) If env JSON present, write it to .firebase/firebase-key.json
  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const workspaceSaPath = path.join(process.cwd(), ".firebase", "firebase-key.json");

  try {
    if (envJson) {
      fs.mkdirSync(path.dirname(workspaceSaPath), { recursive: true });
      fs.writeFileSync(workspaceSaPath, envJson, { encoding: "utf8" });
      // do NOT log JSON contents
      console.log("WROTE service account to", workspaceSaPath);
      process.env.GOOGLE_APPLICATION_CREDENTIALS = workspaceSaPath;
    } else if (credPath) {
      // respect explicit --cred
      const resolved = path.resolve(credPath);
      if (fs.existsSync(resolved)) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = resolved;
      }
    } else if (fs.existsSync(workspaceSaPath)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = workspaceSaPath;
    }
  } catch (e) {
    console.warn("Warning writing service account JSON:", e);
  }

  // Initialize admin app:
  const credFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  if (credFile && fs.existsSync(credFile)) {
    const sa = JSON.parse(fs.readFileSync(credFile, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id,
    });
    process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT = sa.project_id;
  } else {
    // If no file, try default initialization (useful for environments with ADC)
    admin.initializeApp();
  }

  return admin.firestore();
}

// ===== history 読み =====
async function buildLastBoughtMap(db: admin.firestore.Firestore, histPath: string, debug = false, explain = false) {
  const map = new Map<string, Date>();
  const pathSegs = histPath.split("/").filter(Boolean);
  let docs: admin.firestore.QueryDocumentSnapshot[];

  if (pathSegs.length % 2 === 1) {
    const col = db.collection(histPath);
    let snap: admin.firestore.QuerySnapshot;
    try {
      snap = await col.orderBy("createdAt", "asc").get();
    } catch {
      snap = await col.get();
    }
    docs = snap.docs;
    if (debug) console.log("[DEBUG] history docs:", docs.length);
  } else {
    const doc = await db.doc(histPath).get();
    if (!doc.exists) {
      if (debug) console.log("[DEBUG] history doc NOT FOUND:", histPath);
      return map;
    }
    docs = [doc as admin.firestore.QueryDocumentSnapshot];
    if (debug) console.log("[DEBUG] history doc:", histPath);
  }

  for (const d of docs) {
    const data = d.data() || {};
    const docTs =
      toDateAny((data as any).createdAt) ||
      toDateAny((data as any).created_at) ||
      toDateAny((data as any).timeStamp) ||
      (d.createTime?.toDate() || null);

    const items: HistItem[] = Array.isArray((data as any).items) ? (data as any).items : [];
    for (const it of items) {
      const itemTs =
        toDateAny((it as any).timeStamp) ||
        toDateAny((it as any).timestamp) ||
        toDateAny((it as any).createdAt) ||
        null;

      const usedTs = itemTs || docTs;
      if (!usedTs) continue;

      if (explain) {
        const nm = it.name || it.url || it.id || "(no-name)";
        const via = itemTs ? "item.timeStamp" : docTs ? "doc.createdAt" : "doc.createTime";
        console.log(`[EXPLAIN] hist item "${nm}" -> ${usedTs.toISOString().slice(0, 10)} via=${via}`);
      }

      const key = stableKeyFrom(it);
      const prev = map.get(key);
      if (!prev || prev < usedTs) map.set(key, usedTs);
    }
  }
  if (debug) console.log("[DEBUG] lastBought keys:", map.size);
  return map;
}

// ===== subscriptions 読み & 期日判定 =====
async function collectDueItems(
  db: admin.firestore.Firestore,
  subsPath: string,
  lastMap: Map<string, Date>,
  defaultDays: number,
  debug = false,
  explain = false
) {
  const dueByDoc: Array<{
    subId: string;
    items: SubItem[];
    dueInfo: Array<{ key: string; last: Date; daysSince: number; threshold: number }>;
  }> = [];

  const subsSnap = await db.collection(subsPath).get();
  if (debug) console.log("[DEBUG] subscriptions docs:", subsSnap.size);

  for (const doc of subsSnap.docs) {
    const data = doc.data() || {};
    const subLevelFreq = Number((data as any).frequency) || 0;
    const items: SubItem[] = Array.isArray((data as any).items) ? (data as any).items : [];
    const dueItems: SubItem[] = [];
    const info: Array<{ key: string; last: Date; daysSince: number; threshold: number }> = [];

    for (const it of items) {
      const key = stableKeyFrom(it);
      const last = lastMap.get(key);
      if (!last) {
        if (explain) {
          const nm = it.name || it.url || it.id || "(no-name)";
          console.log(`[EXPLAIN] ${doc.id} :: ${nm} -> last=N/A => skip (まだ買っていない)`);
        }
        continue;
      }

      const itemFreq = Number((it as any).frequency) || 0;
      const threshold = itemFreq > 0 ? itemFreq : (subLevelFreq > 0 ? subLevelFreq : defaultDays);

      const daysSince = daysBetween(new Date(), last);
      const nm = it.name || it.url || it.id || "(no-name)";

      if (daysSince >= threshold) {
        if (explain) {
          console.log(`[EXPLAIN] ${doc.id} :: ${nm} -> last=${last.toISOString().slice(0, 10)} daysSince=${daysSince} threshold=${threshold} => DUE`);
        }
        const add: SubItem = {
          ...it,
          quantity: intQty((it as any).quantity ?? (it as any).qty ?? 1, 1),
        };
        dueItems.push(add);
        info.push({ key, last, daysSince, threshold });
      } else if (explain) {
        console.log(`[EXPLAIN] ${doc.id} :: ${nm} -> last=${last.toISOString().slice(0, 10)} daysSince=${daysSince} threshold=${threshold} => not yet`);
      }
    }

    if (dueItems.length) {
      if (debug) console.log(`[DEBUG] due @${doc.id}: ${dueItems.length} items`);
      dueByDoc.push({ subId: doc.id, items: dueItems, dueInfo: info });
    }
  }

  return dueByDoc;
}

// ===== writePurchase （cart collection 対応 + 既存互換） =====
async function writePurchase(
  db: admin.firestore.Firestore,
  uid: string,
  purchasePath: string,
  purchaseDoc: string | undefined,
  bundles: Array<{ subId: string; items: SubItem[]; dueInfo: Array<{ key: string; last: Date; daysSince: number; threshold: number }> }>,
  dry: boolean,
  debug = false
) {
  if (!bundles.length) return 0;

  const isCartCollection = purchasePath.split("/").filter(Boolean).slice(-1)[0] === "cart";

  if (isCartCollection) {
    const col = db.collection(purchasePath);
    let wrote = 0;

    for (const b of bundles) {
      for (const it of b.items) {
        const docId = normalizeId((it as any).id, it.url) || null;
        const qty = intQty((it as any).quantity ?? (it as any).qty ?? (it as any).quantify ?? 1, 1);

        if (docId) {
          const ref = col.doc(docId);
          const snap = await ref.get();
          if (snap.exists) {
            const data = snap.data() || {};
            const existingQty = Number((data as any).quantify ?? (data as any).quantity ?? 0) || 0;
            const newQty = existingQty + qty;
            const updateBody: any = {
              quantify: newQty,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              url: it.url || data.url || "",
              name: it.name || data.name || "",
              image: it.image || data.image || "",
              price: typeof (it as any).price === "number" ? (it as any).price : (data.price ?? null),
              priceTax: typeof (it as any).priceTax === "number" ? (it as any).priceTax : (data.priceTax ?? null),
              genre: (it as any).genre ?? (data.genre ?? null),
              frequency: typeof (it as any).frequency === "number" ? (it as any).frequency : (data.frequency ?? null),
            };

            if (dry) {
              if (debug) console.log("[DRY RUN] would update cart doc:", ref.path, JSON.stringify(updateBody));
            } else {
              await ref.set(updateBody, { merge: true });
              if (debug) console.log(`[DEBUG] updated cart doc=${ref.path} quantify=${newQty}`);
            }
            wrote++;
          } else {
            const body: any = {
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              quantify: qty,
              url: it.url || "",
              name: it.name || "",
              image: it.image || "",
              price: typeof (it as any).price === "number" ? (it as any).price : null,
              priceTax: typeof (it as any).priceTax === "number" ? (it as any).priceTax : null,
              genre: (it as any).genre ?? null,
              frequency: typeof (it as any).frequency === "number" ? (it as any).frequency : null,
              source: "auto-subscription",
            };

            if (dry) {
              if (debug) console.log("[DRY RUN] would create cart doc:", col.doc(docId).path, JSON.stringify(body));
            } else {
              await col.doc(docId).set(body, { merge: true });
              if (debug) console.log(`[DEBUG] created cart doc=${col.doc(docId).path}`);
            }
            wrote++;
          }
        } else {
          const body: any = {
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            quantify: qty,
            url: it.url || "",
            name: it.name || "",
            image: it.image || "",
            price: typeof (it as any).price === "number" ? (it as any).price : null,
            priceTax: typeof (it as any).priceTax === "number" ? (it as any).priceTax : null,
            genre: (it as any).genre ?? null,
            frequency: typeof (it as any).frequency === "number" ? (it as any).frequency : null,
            source: "auto-subscription",
          };

          if (dry) {
            if (debug) console.log("[DRY RUN] would add cart doc (auto-id):", JSON.stringify(body));
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

  // purchaseDoc: single doc update (existing behavior)
  if (purchaseDoc) {
    const docPath = purchasePath;
    const ref = db.doc(docPath);
    const snap = await ref.get();
    const base = snap.exists ? (snap.data() || {}) : {};
    const currentItems: any[] = Array.isArray((base as any).items) ? (base as any).items : [];
    const existing = new Set<string>(currentItems.map((it) => stableKeyFrom(it)));

    const toAppend: any[] = [];
    for (const b of bundles) {
      for (const it of b.items) {
        const key = stableKeyFrom(it);
        if (existing.has(key)) {
          if (debug) console.log("[DEBUG] SKIP already-in-purchase-doc:", it.name || it.url || it.id);
          continue;
        }
        const outItem: any = {
          id: normalizeId(it.id, it.url),
          url: it.url || "",
          name: it.name || "",
          image: it.image || "",
          quantity: intQty((it as any).quantity ?? (it as any).qty ?? 1, 1),
          genre: (it as any).genre ?? null,
          frequency: typeof (it as any).frequency === "number" ? (it as any).frequency : null,
        };
        toAppend.push(outItem);
        existing.add(key);
      }
    }

    if (!toAppend.length) {
      if (debug) console.log("no new items (already in purchase doc). nothing to add.");
      return 0;
    }

    const updateBody: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "auto-subscription",
      items: [...currentItems, ...toAppend],
    };

    if (dry) {
      if (debug) console.log("[DRY RUN] would update purchase doc:", docPath, JSON.stringify(updateBody, null, 2));
      return toAppend.length;
    }
    await ref.set(updateBody, { merge: true });
    if (debug) console.log(`added ${toAppend.length} item(s) to ${docPath}`);
    return toAppend.length;
  } else {
    // collection -> add per-bundle doc (existing behavior)
    const col = db.collection(purchasePath);
    let wrote = 0;

    for (const b of bundles) {
      const outItems = b.items.map((it) => ({
        id: normalizeId(it.id, it.url),
        url: it.url || "",
        name: it.name || "",
        image: it.image || "",
        quantity: intQty((it as any).quantity ?? (it as any).qty ?? 1, 1),
        genre: (it as any).genre ?? null,
        frequency: typeof (it as any).frequency === "number" ? (it as any).frequency : null,
      }));

      const body: any = {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: "auto-subscription",
        uid,
        subscriptionId: b.subId,
        items: outItems,
        meta: b.dueInfo.map((x) => ({
          key: x.key,
          lastPurchasedAt: admin.firestore.Timestamp.fromDate(x.last),
          daysSince: x.daysSince,
          threshold: x.threshold,
        })),
      };

      if (dry) {
        if (debug) console.log("[DRY RUN] would add purchase doc:", JSON.stringify(body, null, 2));
        wrote++;
        continue;
      }
      await col.add(body);
      wrote++;
      if (debug) console.log(`[DEBUG] wrote purchase doc for sub=${b.subId}, items=${outItems.length}`);
    }
    return wrote;
  }
}

// ===== runner (main) =====
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
  };
}

async function getUserIdsWithSubscriptions(db: admin.firestore.Firestore, limit?: number, debug = false) {
  const ids: string[] = [];
  const coll = db.collection("users");
  const snap = await coll.get();
  for (const doc of snap.docs) {
    const uid = doc.id;
    const subsSnap = await db.collection(`users/${uid}/subscriptions`).limit(1).get();
    if (!subsSnap.empty) {
      ids.push(uid);
      if (debug) console.log(`[DEBUG] will process user=${uid}`);
      if (limit && ids.length >= limit) break;
    }
  }
  return ids;
}

async function main() {
  const args = parseArgs();
  const db = initAdmin(args.cred);

  console.log("[INFO] starting autocart-runner", { dry: args.dry, days: args.days, limit: args.limit, delayMs: args.delayMs });

  const uids = await getUserIdsWithSubscriptions(db, args.limit, args.debug);
  console.log(`[INFO] users to process: ${uids.length}`);

  let totalAdded = 0;
  let totalProcessed = 0;
  for (const uid of uids) {
    totalProcessed++;
    console.log(`\n--- Processing uid=${uid} (${totalProcessed}/${uids.length}) ---`);
    try {
      const lastMap = await buildLastBoughtMap(db, `users/${uid}/history`, args.debug, args.explain);
      const bundles = await collectDueItems(db, `users/${uid}/subscriptions`, lastMap, args.days, args.debug, args.explain);
      if (bundles.length === 0) {
        console.log("[INFO] no due items for user:", uid);
      } else {
        // purchase path: users/{uid}/cart  (collection) に書き込む想定
        const wrote = await writePurchase(db, uid, `users/${uid}/cart`, undefined, bundles, args.dry, args.debug);
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});