//あらとも

// autocart-runner.ts
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

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
  // raw/rawobj may exist
  raw?: any;
  rawobj?: any;
};
type HistItem = {
  id?: any;
  url?: string;
  name?: string;
  quantity?: number;
  timeStamp?: any;
  timestamp?: any;
  rawobj?: any;
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
  histPath?: string; // override history path if needed
  target?: "cart" | "purchase"; // where to write (default cart)
};

// ---- utils ----
const DAY_MS = 86400000;

function toDateAny(v: any): Date | null {
  if (!v) return null;
  if (typeof v === "object") {
    // firebase Timestamp object with toDate()
    if (typeof v.toDate === "function") return v.toDate();
    // serialized timestamp from parsed JSON { _seconds, _nanoseconds }
    if (typeof v._seconds === "number") {
      return new Date(v._seconds * 1000 + Math.floor((v._nanoseconds || 0) / 1e6));
    }
  }
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

// Parse rawobj if it's JSON string or object, and merge into item copy
function normalizeHistoryItem(raw: any): any {
  if (!raw || typeof raw !== "object") return raw;
  let item = { ...raw };

  if (item.rawobj) {
    if (typeof item.rawobj === "string") {
      try {
        const parsed = JSON.parse(item.rawobj);
        item = { ...parsed, ...item };
      } catch (e) {
        // ignore parse error
      }
    } else if (typeof item.rawobj === "object") {
      item = { ...item.rawobj, ...item };
    }
    // ensure rawobj kept if needed
  }

  // Sometimes a field "raw" contains JSON string: try parse
  if (item.raw && typeof item.raw === "string" && item.raw.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(item.raw);
      item = { ...parsed, ...item };
    } catch (e) {}
  }

  return item;
}

// ---- Firestore init ----
function initAdmin(credPath?: string) {
  const resolved = credPath ? path.resolve(credPath) : "";
  if (resolved && fs.existsSync(resolved)) {
    const sa = JSON.parse(fs.readFileSync(resolved, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id,
    });
    process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT = sa.project_id;
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // let SDK pick it up
    admin.initializeApp();
  } else {
    throw new Error("No credentials provided. Set --cred <sa.json> or export GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON.");
  }
  return admin.firestore();
}

// ---- Build last-bought map ----
// histPath can be collection (users/{uid}/history) or specific doc (users/{uid}/history/{historyId})
async function buildLastBoughtMap(db: admin.firestore.Firestore, histPath: string, debug = false, explain=false) {
  const map = new Map<string, Date>();
  if (!histPath) return map;
  const pathSegs = histPath.split("/").filter(Boolean);
  let docs: admin.firestore.QueryDocumentSnapshot[];

  if (pathSegs.length % 2 === 1) {
    // collection
    const col = db.collection(histPath);
    let snap: admin.firestore.QuerySnapshot;
    try {
      snap = await col.orderBy("createdAt", "asc").get();
    } catch {
      snap = await col.get();
    }
    docs = snap.docs;
    if (debug) console.log("[DEBUG] history collection docs:", docs.length, "path=", histPath);
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
      (d.createTime ? toDateAny(d.createTime.toDate?.() ?? d.createTime) : null) ||
      null;

    const items: HistItem[] = Array.isArray((data as any).items) ? (data as any).items : [];
    if (debug && items.length === 0) {
      // sometimes history saved under e.g. data.items inside other keys; log keys for debugging
      if (explain) console.log(`[EXPLAIN] history doc ${d.ref.path} has keys:`, Object.keys(data || {}));
    }

    for (let itRaw of items) {
      const it = normalizeHistoryItem(itRaw);
      const itemTs =
        toDateAny((it as any).timeStamp) ||
        toDateAny((it as any).timestamp) ||
        toDateAny((it as any).createdAt) ||
        null;

      const usedTs = itemTs || docTs;
      if (!usedTs) {
        if (explain) {
          const nm = it.name || it.url || it.id || "(no-name)";
          console.log(`[EXPLAIN] hist item "${nm}" has no usable timestamp -> skip`);
        }
        continue;
      }

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

  if (debug) {
    console.log("[DEBUG] lastBought keys:", map.size);
    if (map.size > 0) {
      const sample = Array.from(map.entries()).slice(0, 10).map(([k, v]) => `${k} -> ${v.toISOString().slice(0,10)}`);
      console.log("[DEBUG] lastBought sample:", sample);
    }
  }

  return map;
}

// ---- collect due items from subscriptions ----
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
  if (debug) console.log("[DEBUG] subscriptions docs:", subsSnap.size, "path=", subsPath);

  for (const doc of subsSnap.docs) {
    const data = doc.data() || {};
    const subLevelFreq = Number((data as any).frequency) || 0;
    const items: SubItem[] = Array.isArray((data as any).items) ? (data as any).items : [];
    const dueItems: SubItem[] = [];
    const info: Array<{ key: string; last: Date; daysSince: number; threshold: number }> = [];

    for (let itRaw of items) {
      const it = normalizeHistoryItem(itRaw);
      const key = stableKeyFrom(it);
      const last = lastMap.get(key);
      if (!last) {
        if (explain) {
          const nm = it.name || it.url || it.id || "(no-name)";
          console.log(`[EXPLAIN] ${doc.id} :: ${nm} -> last=N/A => skip (まだ買っていない)`);
        }
        continue; // skip if never bought before (per your spec)
      }

      const itemFreq = Number((it as any).frequency) || 0;
      const threshold = itemFreq > 0 ? itemFreq : (subLevelFreq > 0 ? subLevelFreq : defaultDays);

      const daysSince = daysBetween(new Date(), last);
      const nm = it.name || it.url || it.id || "(no-name)";

      if (daysSince >= threshold) {
        if (explain) {
          console.log(`[EXPLAIN] ${doc.id} :: ${nm} -> last=${last.toISOString().slice(0,10)} daysSince=${daysSince} threshold=${threshold} => DUE`);
        }
        const add: SubItem = {
          ...it,
          quantity: intQty((it as any).quantity ?? (it as any).qty ?? 1, 1),
        };
        dueItems.push(add);
        info.push({ key, last, daysSince, threshold });
      } else if (explain) {
        console.log(`[EXPLAIN] ${doc.id} :: ${nm} -> last=${last.toISOString().slice(0,10)} daysSince=${daysSince} threshold=${threshold} => not yet`);
      }
    }

    if (dueItems.length) {
      if (debug) console.log(`[DEBUG] due @${doc.id}: ${dueItems.length} items`);
      dueByDoc.push({ subId: doc.id, items: dueItems, dueInfo: info });
    }
  }

  return dueByDoc;
}

// ---- write into users/{uid}/cart/{itemId} (preferred) or to purchase collection ----
async function writeToCartOrPurchase(
  db: admin.firestore.Firestore,
  uid: string,
  bundles: Array<{ subId: string; items: SubItem[]; dueInfo: Array<{ key: string; last: Date; daysSince: number; threshold: number }> }>,
  dry: boolean,
  debug = false
) {
  if (!bundles.length) return 0;
  let wrote = 0;

  for (const b of bundles) {
    for (const it of b.items) {
      const itemId = normalizeId(it.id, it.url);
      if (itemId) {
        // write to cart document with doc id = itemId
        const docPath = `users/${uid}/cart/${itemId}`;
        const ref = db.doc(docPath);
        const snap = await ref.get();
        const base = snap.exists ? (snap.data() || {}) : {};
        // detect existing using same normalized id
        if (snap.exists) {
          if (debug) console.log(`[DEBUG] cart doc exists for ${docPath} - skipping or merging`);
          // skip to avoid duplicates (you can merge quantities here if desired)
          continue;
        }
        const body: any = {
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          quantity: intQty((it as any).quantity ?? (it as any).qty ?? 1, 1),
          quantify: intQty((it as any).quantity ?? (it as any).qty ?? 1, 1),
          url: it.url || "",
          name: it.name || "",
          image: it.image || "",
          price: typeof (it as any).price === "number" ? (it as any).price : null,
          priceTax: typeof (it as any).priceTax === "number" ? (it as any).priceTax : null,
          source: "auto-subscription",
        };

        if (dry) {
          if (debug) console.log("[DRY] would create", docPath, body);
          wrote++;
          continue;
        }
        await ref.set(body, { merge: true });
        wrote++;
        if (debug) console.log(`[DEBUG] wrote cart doc ${docPath}`);
      } else {
        // fallback: add to user's purchase collection
        const col = db.collection(`users/${uid}/purchase`);
        const outItem = {
          id: normalizeId(it.id, it.url),
          url: it.url || "",
          name: it.name || "",
          image: it.image || "",
          price: typeof (it as any).price === "number" ? (it as any).price : null,
          priceTax: typeof (it as any).priceTax === "number" ? (it as any).priceTax : null,
          quantity: intQty((it as any).quantity ?? (it as any).qty ?? 1, 1),
          genre: (it as any).genre ?? null,
          frequency: typeof (it as any).frequency === "number" ? (it as any).frequency : null,
        };
        const body: any = {
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          source: "auto-subscription",
          uid,
          subscriptionId: b.subId,
          items: [outItem],
          meta: b.dueInfo.map((x) => ({
            key: x.key,
            lastPurchasedAt: admin.firestore.Timestamp.fromDate(x.last),
            daysSince: x.daysSince,
            threshold: x.threshold,
          })),
        };
        if (dry) {
          if (debug) console.log("[DRY] would add purchase doc:", JSON.stringify(body, null, 2));
          wrote++;
          continue;
        }
        await col.add(body);
        wrote++;
        if (debug) console.log(`[DEBUG] wrote fallback purchase doc for uid=${uid} sub=${b.subId}`);
      }
    }
  }
  return wrote;
}

// ---- user list with subscriptions ----
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

// ---- CLI parse ----
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
    histPath: get("--hist-path", "") || undefined,
    target: (get("--target", "cart") as "cart" | "purchase"),
  };
}

// ---- main runner ----
async function main() {
  const args = parseArgs();
  const db = initAdmin(args.cred);

  console.log("[INFO] starting autocart-runner", {
    dry: args.dry,
    days: args.days,
    limit: args.limit,
    delayMs: args.delayMs,
    uid: args.uid,
    target: args.target,
  });

  let uids: string[] = [];
  if (args.uid) {
    uids = [args.uid];
  } else {
    uids = await getUserIdsWithSubscriptions(db, args.limit, args.debug);
  }
  console.log(`[INFO] users to process: ${uids.length}`);

  let totalAdded = 0;
  let totalProcessed = 0;
  for (const uid of uids) {
    totalProcessed++;
    console.log(`\n--- Processing uid=${uid} (${totalProcessed}/${uids.length}) ---`);
    try {
      const histPath = args.histPath || `users/${uid}/history`;
      const lastMap = await buildLastBoughtMap(db, histPath, args.debug, args.explain);
      if (args.debug && lastMap.size === 0) {
        console.log("[DEBUG] lastBought map size = 0 - check histPath and rawobj timestamp formats.");
      }
      const bundles = await collectDueItems(db, `users/${uid}/subscriptions`, lastMap, args.days, args.debug, args.explain);
      if (bundles.length === 0) {
        console.log("[INFO] no due items for user:", uid);
      } else {
        const wrote = await writeToCartOrPurchase(db, uid, bundles, args.dry, args.debug);
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