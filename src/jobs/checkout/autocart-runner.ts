//あらとも

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

type SubItem = {
  id?: any; url?: string; name?: string; image?: string;
  price?: number; priceTax?: number; quantity?: number;
  genre?: number | string; frequency?: number;
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
  histPath?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateAny(v: any): Date | null {
  if (!v) return null;
  // Firestore Timestamp (has toDate)
  if (typeof v === "object" && typeof v.toDate === "function") {
    try { return (v as any).toDate(); } catch {}
  }
  // Raw proto form
  if (typeof v === "object" && (v._seconds !== undefined || v.seconds !== undefined)) {
    const seconds = Number(v._seconds ?? v.seconds ?? 0);
    const nanos = Number(v._nanoseconds ?? v.nanoseconds ?? 0);
    return new Date(seconds * 1000 + Math.floor(nanos / 1e6));
  }
  // number/string
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

function daysBetween(a: Date, b: Date) { return Math.floor((a.getTime() - b.getTime()) / DAY_MS); }

// --- robust timestamp extractor
function extractTimestampFromItem(it: any): Date | null {
  if (!it) return null;
  // common direct fields
  const direct = [it.timeStamp, it.timestamp, it.createdAt, it.updatedAt];
  for (const c of direct) {
    const d = toDateAny(c);
    if (d) return d;
  }

  // rawobj may be object or JSON string
  if (it.rawobj) {
    try {
      const ro = typeof it.rawobj === "string" ? JSON.parse(it.rawobj) : it.rawobj;
      const cand = [ro.timeStamp, ro.timestamp, ro.createdAt, ro.updatedAt];
      for (const c of cand) {
        const d = toDateAny(c);
        if (d) return d;
      }
    } catch {}
  }

  // some items are themselves JSON in a "raw" or similar field
  const rawCandidates = [it.raw, it.rawObj, it.rawObjString];
  for (const r of rawCandidates) {
    if (!r) continue;
    if (typeof r === "string") {
      try {
        const p = JSON.parse(r);
        return extractTimestampFromItem(p);
      } catch {}
    } else if (typeof r === "object") {
      const d = extractTimestampFromItem(r);
      if (d) return d;
    }
  }

  return null;
}

// --- Firestore init with clear message if no creds ---
function initAdmin(credPath?: string) {
  const resolved = credPath ? path.resolve(credPath) : (process.env.GOOGLE_APPLICATION_CREDENTIALS || "");
  if (resolved && fs.existsSync(resolved)) {
    const sa = JSON.parse(fs.readFileSync(resolved, "utf8"));
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
    process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT = sa.project_id;
    return admin.firestore();
  }
  // If env var set but file missing, error
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    throw new Error(`GOOGLE_APPLICATION_CREDENTIALS is set but file not found: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
  }
  // If nothing, fail early with helpful message
  throw new Error("No credentials provided. Set --cred <sa.json> or export GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON.");
}

// --- build last-bought map (collection or single doc) ---
async function buildLastBoughtMap(db: admin.firestore.Firestore, histPath: string, debug = false, explain=false) {
  const map = new Map<string, Date>();
  const segs = histPath.split("/").filter(Boolean);

  let docs: admin.firestore.QueryDocumentSnapshot[] = [];

  if (segs.length % 2 === 1) {
    // collection path
    const col = db.collection(histPath);
    let snap: admin.firestore.QuerySnapshot;
    try {
      snap = await col.orderBy("createdAt", "asc").get();
    } catch {
      snap = await col.get();
    }
    docs = snap.docs;
    if (debug) console.log("[DEBUG] history docs =", docs.length, "at", histPath);
  } else {
    // single document path
    const doc = await db.doc(histPath).get();
    if (!doc.exists) {
      if (debug) console.log("[DEBUG] history doc NOT FOUND:", histPath);
      return map;
    }
    docs = [doc as admin.firestore.QueryDocumentSnapshot];
    if (debug) console.log("[DEBUG] history doc loaded:", histPath);
  }

  for (const d of docs) {
    const data = d.data() || {};
    const docTs = toDateAny((data as any).createdAt) || toDateAny((data as any).created_at) || toDateAny((data as any).timeStamp) || (d.createTime ? d.createTime.toDate() : null);

    const items: any[] = Array.isArray((data as any).items) ? (data as any).items : [];
    // if no items array, treat doc.data() itself as item to try to find timestamp
    if (!items.length) items.push(data);

    for (const it of items) {
      const itemTs = extractTimestampFromItem(it);
      const usedTs = itemTs || docTs;
      if (!usedTs) continue;
      if (explain) {
        const nm = it.name || it.url || it.id || "(no-name)";
        const via = itemTs ? "item.ts" : docTs ? "doc.ts" : "unknown";
        console.log(`[EXPLAIN] hist item "${nm}" -> ${usedTs.toISOString().slice(0,10)} via=${via}`);
      }
      const key = stableKeyFrom(it);
      const prev = map.get(key);
      if (!prev || prev < usedTs) map.set(key, usedTs);
    }
  }

  if (debug) console.log("[DEBUG] lastBought map size =", map.size);
  return map;
}

// --- collect due items from subscriptions ---
async function collectDueItems(db: admin.firestore.Firestore, subsPath: string, lastMap: Map<string, Date>, defaultDays: number, debug=false, explain=false) {
  const dueByDoc: Array<{ subId: string; items: SubItem[]; dueInfo: Array<{ key: string; last: Date; daysSince: number; threshold: number }> }> = [];

  const snap = await db.collection(subsPath).get();
  if (debug) console.log("[DEBUG] subscriptions docs:", snap.size, "at", subsPath);

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
        if (explain) console.log(`[EXPLAIN] ${doc.id} :: ${(it.name||it.url||it.id||"(no-name)")} -> last=N/A => skip`);
        continue;
      }
      const itemFreq = Number((it as any).frequency) || 0;
      const threshold = itemFreq > 0 ? itemFreq : (subLevelFreq > 0 ? subLevelFreq : defaultDays);
      const daysSince = daysBetween(new Date(), last);
      if (daysSince >= threshold) {
        if (explain) console.log(`[EXPLAIN] ${doc.id} DUE: ${(it.name||it.url||it.id)} last=${last.toISOString().slice(0,10)} daysSince=${daysSince} thr=${threshold}`);
        dueItems.push({ ...it, quantity: intQty((it as any).quantity ?? (it as any).qty ?? 1, 1) });
        info.push({ key, last, daysSince, threshold });
      } else if (explain) {
        console.log(`[EXPLAIN] ${doc.id} not yet: ${(it.name||it.url||it.id)} daysSince=${daysSince} thr=${threshold}`);
      }
    }

    if (dueItems.length) dueByDoc.push({ subId: doc.id, items: dueItems, dueInfo: info });
  }

  return dueByDoc;
}

// --- write cart entries to users/{uid}/cart/{itemId} ---
async function writeCartEntries(db: admin.firestore.Firestore, uid: string, bundles: Array<{ subId: string; items: SubItem[]; dueInfo: any[] }>, dry: boolean, debug=false) {
  if (!bundles.length) return 0;
  let wrote = 0;
  for (const b of bundles) {
    for (const it of b.items) {
      const itemId = normalizeId(it.id, it.url) || stableKeyFrom(it).replace(/[:]/g, "-").slice(0, 36);
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
        if (debug) console.log("[DRY] would create", docPath, body);
        wrote++;
        continue;
      }
      await db.doc(docPath).set(body, { merge: true });
      wrote++;
      if (debug) console.log(`[DEBUG] wrote ${docPath}`);
    }
  }
  return wrote;
}

// --- list user ids with subscriptions ---
async function getUserIdsWithSubscriptions(db: admin.firestore.Firestore, limit?: number, debug=false) {
  const ids: string[] = [];
  const snap = await db.collection("users").get();
  for (const doc of snap.docs) {
    const uid = doc.id;
    const subsSnap = await db.collection(`users/${uid}/subscriptions`).limit(1).get();
    if (!subsSnap.empty) {
      ids.push(uid);
      if (debug) console.log("[DEBUG] will process user=", uid);
      if (limit && ids.length >= limit) break;
    }
  }
  return ids;
}

// --- CLI parse ---
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
    histPath: get("--hist-path", ""),
  };
}

async function main() {
  const args = parseArgs();
  if (!args.cred && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error("ERROR: No credentials provided. Use --cred <sa.json> or set GOOGLE_APPLICATION_CREDENTIALS.");
    process.exit(1);
  }

  const db = initAdmin(args.cred || process.env.GOOGLE_APPLICATION_CREDENTIALS);

  console.log("[INFO] starting autocart-runner ***");
  console.log({ dry: args.dry, days: args.days, limit: args.limit, delayMs: args.delayMs, uid: args.uid, histPath: args.histPath });

  const uids = args.uid ? [args.uid] : await getUserIdsWithSubscriptions(db, args.limit, args.debug);
  console.log("[INFO] users to process:", uids.length);

  let totalAdded = 0, totalProcessed = 0;
  for (const uid of uids) {
    totalProcessed++;
    console.log(`\n--- Processing uid=${uid} (${totalProcessed}/${uids.length}) ---`);
    try {
      const histPath = args.histPath ? args.histPath : `users/${uid}/history`;
      if (args.debug) console.log("[DEBUG] using histPath:", histPath);

      const lastMap = await buildLastBoughtMap(db, histPath, args.debug, args.explain);
      if (args.debug) console.log("[DEBUG] lastBought map size (final):", lastMap.size);

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