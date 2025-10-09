//あらとも

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
};
type HistItem = {
  id?: any;
  url?: string;
  name?: string;
  quantity?: number;
  timeStamp?: any;
  timestamp?: any;
  createdAt?: any;
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
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateAny(v: any): Date | null {
  if (!v) return null;
  // Firestore Timestamp w/ toDate
  if (typeof v === "object" && typeof (v as any).toDate === "function") {
    try { return (v as any).toDate(); } catch { /* fallthrough */ }
  }
  // object-like { _seconds, _nanoseconds }
  if (typeof v === "object" && v._seconds) {
    return new Date(Number(v._seconds) * 1000 + Math.floor(Number(v._nanoseconds || 0) / 1e6));
  }
  // string / number
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d;
  return null;
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

// --- Firestore init (credPath optional) ---
function initAdmin(credPath?: string) {
  if (credPath) {
    const resolved = path.resolve(credPath);
    if (fs.existsSync(resolved)) {
      const sa = JSON.parse(fs.readFileSync(resolved, "utf8"));
      admin.initializeApp({
        credential: admin.credential.cert(sa),
        projectId: sa.project_id,
      });
      process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT = sa.project_id;
      return admin.firestore();
    }
  }
  // fallback: ADC
  admin.initializeApp();
  return admin.firestore();
}

// --- attempt to extract timestamp from a history item robustly ---
function extractTimestampFromItem(it: any) : Date | null {
  if (!it) return null;
  // direct fields
  const candidates = [
    it.timeStamp,
    it.timestamp,
    it.createdAt,
    (it as any).time || null
  ];
  for (const c of candidates) {
    const d = toDateAny(c);
    if (d) return d;
  }
  // rawobj might be object or JSON string
  if (it.rawobj) {
    try {
      const obj = typeof it.rawobj === "string" ? JSON.parse(it.rawobj) : it.rawobj;
      const cands2 = [obj.timeStamp, obj.timestamp, obj.createdAt, obj.updatedAt, obj.time];
      for (const c of cands2) {
        const d = toDateAny(c);
        if (d) return d;
      }
      // sometimes nested: rawobj.{item}.timeStamp
      // try JSON-string inside rawobj fields as fallback
    } catch {
      // ignore JSON parse error
    }
  }
  // sometimes the whole item is a JSON-string in 'raw' or 'rawobj' fields
  if (typeof it === "string") {
    try {
      const parsed = JSON.parse(it);
      return extractTimestampFromItem(parsed);
    } catch { /* ignore */ }
  }
  return null;
}

// ===== build last-bought map =====
async function buildLastBoughtMap(db: admin.firestore.Firestore, histPath: string, debug = false, explain=false) {
  const map = new Map<string, Date>();
  const segs = histPath.split("/").filter(Boolean);

  let docs: admin.firestore.QueryDocumentSnapshot[] = [];

  if (segs.length % 2 === 1) {
    // collection
    const col = db.collection(histPath);
    let snap: admin.firestore.QuerySnapshot;
    try {
      snap = await col.orderBy("createdAt", "asc").get();
    } catch {
      snap = await col.get();
    }
    docs = snap.docs;
    if (debug) console.log("[DEBUG] history docs =", docs.length);
  } else {
    const doc = await db.doc(histPath).get();
    if (!doc.exists) {
      if (debug) console.log("[DEBUG] history doc NOT FOUND:", histPath);
      return map;
    }
    docs = [doc as admin.firestore.QueryDocumentSnapshot];
    if (debug) console.log("[DEBUG] history doc found:", histPath);
  }

  for (const d of docs) {
    const data = d.data() || {};
    // doc-level time
    const docTs = toDateAny((data as any).createdAt) || toDateAny((data as any).created_at) || toDateAny((data as any).timeStamp) || (d.createTime ? d.createTime.toDate() : null);

    // items may be in data.items, or this doc may represent an item itself
    const itemsArr = Array.isArray((data as any).items) ? (data as any).items : [];
    // if doc itself looks like a single item (no items array), try to treat doc.data() itself as item
    if (!itemsArr.length) {
      // maybe doc.data() is a single item or contains keys that look like an item
      // push a synthetic item that is the doc data (so we still check for timeStamp inside)
      itemsArr.push(data);
    }

    for (const itRaw of itemsArr) {
      const it: any = itRaw || {};
      // try to extract timestamp
      const itemTs = extractTimestampFromItem(it);
      const usedTs = itemTs || docTs;
      if (!usedTs) continue;

      const key = stableKeyFrom(it);
      if (explain) {
        const nm = it.name || it.url || it.id || "(no-name)";
        const via = itemTs ? "item.ts" : docTs ? "doc.ts" : "unknown";
        console.log(`[EXPLAIN] hist item "${nm}" -> ${usedTs.toISOString().slice(0,10)} via=${via}`);
      }
      const prev = map.get(key);
      if (!prev || prev < usedTs) map.set(key, usedTs);
    }
  }

  if (debug) console.log("[DEBUG] lastBought map size =", map.size);
  return map;
}

// ===== collect due items from subscriptions =====
async function collectDueItems(db: admin.firestore.Firestore, subsPath: string, lastMap: Map<string, Date>, defaultDays: number, debug=false, explain=false) {
  const dueByDoc: Array<{ subId: string; items: SubItem[]; dueInfo: Array<{ key: string; last: Date; daysSince: number; threshold: number }> }> = [];

  const snap = await db.collection(subsPath).get();
  if (debug) console.log("[DEBUG] subscriptions docs:", snap.size);

  for (const doc of snap.docs) {
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
        if (explain) console.log(`[EXPLAIN] ${doc.id} :: ${nm} -> last=${last.toISOString().slice(0,10)} days=${daysSince} thr=${threshold} => DUE`);
        const add: SubItem = {
          ...it,
          quantity: intQty((it as any).quantity ?? (it as any).qty ?? 1, 1),
        };
        dueItems.push(add);
        info.push({ key, last, daysSince, threshold });
      } else if (explain) {
        console.log(`[EXPLAIN] ${doc.id} :: ${nm} -> last=${last.toISOString().slice(0,10)} days=${daysSince} thr=${threshold} => not yet`);
      }
    }

    if (dueItems.length) dueByDoc.push({ subId: doc.id, items: dueItems, dueInfo: info });
  }

  return dueByDoc;
}

// ===== write into users/{uid}/cart/{itemId} (no extra file) =====
async function writeCartEntries(
  db: admin.firestore.Firestore,
  uid: string,
  bundles: Array<{ subId: string; items: SubItem[]; dueInfo: any[] }>,
  dry: boolean,
  debug=false
) {
  if (!bundles.length) return 0;
  let wrote = 0;

  for (const b of bundles) {
    for (const it of b.items) {
      // target doc id prefer normalized id; fallback to generated stable key (remove prefix)
      const itemId = normalizeId(it.id, it.url) || (() => {
        // generate safe id from stableKey
        return stableKeyFrom(it).replace(/[:]/g, "-").slice(0, 36);
      })();

      const docPath = `users/${uid}/cart/${itemId}`;
      const body: any = {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        quantity: intQty(it.quantity ?? 1, 1),
        quantify: intQty(it.quantity ?? 1, 1),
        url: it.url || "",
        name: it.name || "",
        image: it.image || "",
        price: typeof it.price === "number" ? it.price : null,
        priceTax: typeof (it as any).priceTax === "number" ? (it as any).priceTax : null,
        source: "auto-subscription",
      };

      if (dry) {
        if (debug) console.log("[DRY] would create", docPath, JSON.stringify(body, null, 2));
        wrote++;
        continue;
      }

      await db.doc(docPath).set(body, { merge: true });
      wrote++;
      if (debug) console.log(`[DEBUG] wrote cart doc ${docPath}`);
    }
  }
  return wrote;
}

// ===== helper to list user ids with subscriptions =====
async function getUserIdsWithSubscriptions(db: admin.firestore.Firestore, limit?: number, debug=false) {
  const ids: string[] = [];
  const usersSnap = await db.collection("users").get();
  for (const u of usersSnap.docs) {
    const uid = u.id;
    const subsSnap = await db.collection(`users/${uid}/subscriptions`).limit(1).get();
    if (!subsSnap.empty) {
      ids.push(uid);
      if (debug) console.log(`[DEBUG] will process user=${uid}`);
      if (limit && ids.length >= limit) break;
    }
  }
  return ids;
}

// ===== CLI parse =====
function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string, d = "") => {
    const i = argv.indexOf(k);
    return i >= 0 ? String(argv[i+1]) : d;
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
  };
}

async function main() {
  const args = parseArgs();
  const db = initAdmin(args.cred);

  console.log("[INFO] starting autocart-runner ***");
  console.log({ dry: args.dry, days: args.days, limit: args.limit, delayMs: args.delayMs, uid: args.uid });

  const uids = args.uid ? [args.uid] : await getUserIdsWithSubscriptions(db, args.limit, args.debug);
  console.log("[INFO] users to process:", uids.length);

  let totalAdded = 0, totalProcessed = 0;
  for (const uid of uids) {
    totalProcessed++;
    console.log(`\n--- Processing uid=${uid} (${totalProcessed}/${uids.length}) ---`);
    try {
      // try typical places: users/{uid}/history (collection) by default
      const histPath = `users/${uid}/history`;
      const lastMap = await buildLastBoughtMap(db, histPath, args.debug, args.explain);
      if (args.debug) {
        console.log("[DEBUG] lastBought map size (final):", lastMap.size);
      }
      const bundles = await collectDueItems(db, `users/${uid}/subscriptions`, lastMap, args.days, args.debug, args.explain);

      if (!bundles.length) {
        console.log("[INFO] no due items for user:", uid);
      } else {
        const wrote = await writeCartEntries(db, uid, bundles, args.dry, args.debug);
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