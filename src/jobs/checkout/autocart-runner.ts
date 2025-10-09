/* eslint-disable @typescript-eslint/no-explicit-any */
// src/jobs/checkout/autocart-runner.ts
// 最終完成版 — 全ユーザー向け auto-cart runner
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

type SubItem = {
  id?: any; url?: string; name?: string; image?: string;
  price?: number; priceTax?: number; quantity?: number;
  genre?: number | string; frequency?: number;
};
type HistItem = { id?: any; url?: string; name?: string; quantity?: number; timeStamp?: any; timestamp?: any; createdAt?: any; };

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

// init admin: accept FIREBASE_SERVICE_ACCOUNT secret, .firebase/firebase-key.json, or default ADC
function initAdmin(credPath?: string) {
  try {
    const workspaceSaPath = path.resolve(".firebase/firebase-key.json");
    if (credPath) {
      const resolved = path.resolve(credPath);
      if (fs.existsSync(resolved)) process.env.GOOGLE_APPLICATION_CREDENTIALS = resolved;
    } else if (fs.existsSync(workspaceSaPath)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = workspaceSaPath;
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // write secret to temp file to use it
      const tmp = "/tmp/firebase-action-key.json";
      fs.writeFileSync(tmp, process.env.FIREBASE_SERVICE_ACCOUNT, { encoding: "utf8", mode: 0o600 });
      process.env.GOOGLE_APPLICATION_CREDENTIALS = tmp;
    }
  } catch {
    // ignore, we'll try default init
  }

  const credFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  if (credFile && fs.existsSync(credFile)) {
    const sa = JSON.parse(fs.readFileSync(credFile, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id,
    });
    process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT = sa.project_id;
    return admin.firestore();
  } else {
    try {
      admin.initializeApp();
      return admin.firestore();
    } catch (e) {
      throw new Error("Firebase admin initialization failed: " + (e && e.message ? e.message : String(e)));
    }
  }
}

// buildLastBoughtMap: robust against different history shapes
async function buildLastBoughtMap(db: admin.firestore.Firestore, histPath: string, debug = false, explain = false) {
  const map = new Map<string, Date>();
  const pathSegs = histPath.split("/").filter(Boolean);

  async function itemsFromDoc(doc: admin.firestore.QueryDocumentSnapshot | admin.firestore.DocumentSnapshot) {
    const out: HistItem[] = [];
    const data = (doc.data && doc.data()) || {};
    if (Array.isArray((data as any).items)) return (data as any).items as HistItem[];
    if (Array.isArray((data as any).history)) return (data as any).history as HistItem[];

    // If doc itself looks like an item
    const maybeKeys = ["id","url","name","timeStamp","timestamp","createdAt"];
    if (maybeKeys.some(k => Object.prototype.hasOwnProperty.call(data, k))) return [data as HistItem];

    // fallback: list subcollections and collect docs
    try {
      if ((doc as any).ref && typeof (doc as any).ref.listCollections === "function") {
        const subcols = await (doc as any).ref.listCollections();
        for (const sc of subcols) {
          try {
            const snap = await sc.get();
            for (const sd of snap.docs) {
              const sdata = sd.data() || {};
              if (!sdata.id) sdata.id = sd.id;
              out.push(sdata as HistItem);
            }
          } catch (e) { if (debug) console.warn("subcol read failed", sc.path, e); }
        }
      }
    } catch (e) { if (debug) console.warn("listCollections failed", e); }
    return out;
  }

  if (pathSegs.length % 2 === 1) {
    // histPath is a collection
    let snap: admin.firestore.QuerySnapshot;
    try { snap = await db.collection(histPath).orderBy("createdAt","asc").get(); } catch { snap = await db.collection(histPath).get(); }
    for (const d of snap.docs) {
      const data = d.data() || {};
      const docTs = toDateAny((data as any).createdAt) || toDateAny((data as any).created_at) || toDateAny((data as any).timeStamp) || (d.createTime ? d.createTime.toDate() : null);
      const items = await itemsFromDoc(d);
      for (const it of items) {
        const itemTs = toDateAny((it as any).timeStamp) || toDateAny((it as any).timestamp) || toDateAny((it as any).createdAt) || null;
        const usedTs = itemTs || docTs;
        if (!usedTs) continue;
        if (explain) {
          const nm = it.name || it.url || it.id || "(no-name)";
          const via = itemTs ? "item.timeStamp" : docTs ? "doc.createdAt" : "doc.createTime";
          console.log(`[EXPLAIN] hist item "${nm}" -> ${usedTs.toISOString().slice(0,10)} via=${via}`);
        }
        const key = stableKeyFrom(it);
        const prev = map.get(key);
        if (!prev || prev < usedTs) map.set(key, usedTs);
      }
    }
    if (debug) console.log("[DEBUG] lastBought keys:", map.size);
    return map;
  } else {
    // histPath is a doc
    const doc = await db.doc(histPath).get();
    if (!doc.exists) {
      if (debug) console.log("[DEBUG] history doc NOT FOUND:", histPath);
      return map;
    }
    const data = doc.data() || {};
    const docTs = toDateAny((data as any).createdAt) || toDateAny((data as any).created_at) || toDateAny((data as any).timeStamp) || (doc.createTime ? doc.createTime.toDate() : null);
    const items = await (async () => {
      if (Array.isArray((data as any).items)) return (data as any).items as HistItem[];
      if (Array.isArray((data as any).history)) return (data as any).history as HistItem[];
      // try subcollections
      const out: HistItem[] = [];
      try {
        const subcols = await doc.ref.listCollections();
        for (const sc of subcols) {
          const snap = await sc.get();
          for (const sd of snap.docs) {
            const sdata = sd.data() || {};
            if (!sdata.id) sdata.id = sd.id;
            out.push(sdata as HistItem);
          }
        }
      } catch (e) { if (debug) console.warn("failed to read subcols for history doc", e); }
      return out;
    })();

    for (const it of items) {
      const itemTs = toDateAny((it as any).timeStamp) || toDateAny((it as any).timestamp) || toDateAny((it as any).createdAt) || null;
      const usedTs = itemTs || docTs;
      if (!usedTs) continue;
      if (explain) {
        const nm = it.name || it.url || it.id || "(no-name)";
        const via = itemTs ? "item.timeStamp" : docTs ? "doc.createdAt" : "doc.createTime";
        console.log(`[EXPLAIN] hist item "${nm}" -> ${usedTs.toISOString().slice(0,10)} via=${via}`);
      }
      const key = stableKeyFrom(it);
      const prev = map.get(key);
      if (!prev || prev < usedTs) map.set(key, usedTs);
    }
    if (debug) console.log("[DEBUG] lastBought keys:", map.size);
    return map;
  }
}

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
      const key = stableKeyFrom(it);
      const last = lastMap.get(key) || null;
      if (!last) {
        if (includeNever) {
          const threshold = Number((it as any).frequency) || (subLevelFreq > 0 ? subLevelFreq : defaultDays);
          if (explain) {
            const nm = it.name || it.url || it.id || "(no-name)";
            console.log(`[EXPLAIN] ${doc.id} :: ${nm} -> last=N/A but includeNever => DUE (threshold=${threshold})`);
          }
          dueItems.push({...it, quantity: intQty((it as any).quantity ?? (it as any).qty ?? 1,1)});
          info.push({ key, last: null, daysSince: Number.MAX_SAFE_INTEGER, threshold });
        } else {
          if (explain) {
            const nm = it.name || it.url || it.id || "(no-name)";
            console.log(`[EXPLAIN] ${doc.id} :: ${nm} -> last=N/A => skip (まだ買っていない)`);
          }
          continue;
        }
      } else {
        const itemFreq = Number((it as any).frequency) || 0;
        const threshold = itemFreq > 0 ? itemFreq : (subLevelFreq > 0 ? subLevelFreq : defaultDays);
        const daysSince = daysBetween(new Date(), last);
        const nm = it.name || it.url || it.id || "(no-name)";
        if (daysSince >= threshold) {
          if (explain) console.log(`[EXPLAIN] ${doc.id} :: ${nm} -> last=${last.toISOString().slice(0,10)} daysSince=${daysSince} threshold=${threshold} => DUE`);
          dueItems.push({...it, quantity: intQty((it as any).quantity ?? (it as any).qty ?? 1,1)});
          info.push({ key, last, daysSince, threshold });
        } else if (explain) {
          console.log(`[EXPLAIN] ${doc.id} :: ${nm} -> last=${last.toISOString().slice(0,10)} daysSince=${daysSince} threshold=${threshold} => not yet`);
        }
      }
    }

    if (dueItems.length) {
      if (debug) console.log(`[DEBUG] due @${doc.id}: ${dueItems.length} items`);
      dueByDoc.push({ subId: doc.id, items: dueItems, dueInfo: info });
    }
  }

  return dueByDoc;
}

// writePurchase: if purchasePath ends with '/cart' treat as collection of cart docs
async function writePurchase(
  db: admin.firestore.Firestore,
  uid: string,
  purchasePath: string,
  purchaseDoc: string | undefined,
  bundles: Array<{ subId: string; items: SubItem[]; dueInfo: Array<{ key: string; last: Date | null; daysSince: number; threshold: number }> }>,
  dry: boolean,
  debug = false,
  forceAdd = false
) {
  if (!bundles.length) return 0;
  const pathSegs = purchasePath.split("/").filter(Boolean);
  const lastSeg = pathSegs[pathSegs.length - 1] || "";
  const isCartCollection = lastSeg === "cart";

  if (isCartCollection) {
    const col = db.collection(purchasePath);
    let wrote = 0;

    for (const b of bundles) {
      for (const it of b.items) {
        const docId = normalizeId((it as any).id, it.url) || null;
        const qty = intQty((it as any).quantity ?? (it as any).qty ?? 1, 1);

        if (docId) {
          const ref = col.doc(docId);
          const snap = await ref.get();
          if (snap.exists) {
            const data = snap.data() || {};
            const existingQty = Number((data as any).quantity ?? (data as any).quantify ?? 0) || 0;
            const newQty = existingQty + qty;
            const updateBody: any = {
              quantify: newQty,
              quantity: newQty, // write both for compatibility
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              url: it.url || data.url || "",
              name: it.name || data.name || "",
              image: it.image || data.image || "",
              price: typeof (it as any).price === "number" ? (it as any).price : (data.price ?? null),
              priceTax: typeof (it as any).priceTax === "number" ? (it as any).priceTax : (data.priceTax ?? null),
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
              quantify: qty,
              quantity: qty,
              url: it.url || "",
              name: it.name || "",
              image: it.image || "",
              price: typeof (it as any).price === "number" ? (it as any).price : null,
              priceTax: typeof (it as any).priceTax === "number" ? (it as any).priceTax : null,
              source: "auto-subscription",
            };
            if (dry) {
              console.log("[DRY RUN] would create cart doc:", col.doc(docId).path, JSON.stringify(body));
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
            quantity: qty,
            url: it.url || "",
            name: it.name || "",
            image: it.image || "",
            price: typeof (it as any).price === "number" ? (it as any).price : null,
            priceTax: typeof (it as any).priceTax === "number" ? (it as any).priceTax : null,
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

  // fallback: previous behaviour for purchase doc/collection
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
        if (!forceAdd && existing.has(key)) {
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
          lastPurchasedAt: x.last ? admin.firestore.Timestamp.fromDate(x.last) : null,
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

async function main() {
  const args = parseArgs();
  const db = initAdmin(args.cred);

  console.log("[INFO] starting autocart-runner", { dry: args.dry, days: args.days, limit: args.limit, delayMs: args.delayMs, uid: args.uid, includeNever: args.includeNever, forceAdd: args.forceAdd });

  const uids = await getUserIdsWithSubscriptions(db, args.limit, args.debug, args.uid);
  console.log(`[INFO] users to process: ${uids.length}`);

  let totalAdded = 0;
  let totalProcessed = 0;
  for (const uid of uids) {
    totalProcessed++;
    console.log(`\n--- Processing uid=${uid} (${totalProcessed}/${uids.length}) ---`);
    try {
      if (args.debug) {
        const ss = await db.collection(`users/${uid}/subscriptions`).get();
        console.log(`[DEBUG] subs for ${uid}: ${ss.size}`);
        for (const s of ss.docs) console.log("  - sub:", s.id, JSON.stringify(s.data()).slice(0,400));
      }

      const lastMap = await buildLastBoughtMap(db, `users/${uid}/history`, args.debug, args.explain);
      if (args.debug) console.log("[DEBUG] lastMap sample keys:", Array.from(lastMap.keys()).slice(0,50));
      const bundles = await collectDueItems(db, `users/${uid}/subscriptions`, lastMap, args.days, args.debug, args.explain, !!args.includeNever);

      if (bundles.length === 0) {
        console.log("[INFO] no due items for user:", uid);
      } else {
        if (args.debug) console.log("[DEBUG] bundles to write:", JSON.stringify(bundles, null, 2));
        const wrote = await writePurchase(db, uid, `users/${uid}/cart`, undefined, bundles, args.dry, args.debug, !!args.forceAdd);
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
