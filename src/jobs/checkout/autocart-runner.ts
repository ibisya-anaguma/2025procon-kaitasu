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

// ---------- utils ----------
const DAY_MS = 86400000;

function toDateAny(v: any): Date | null {
  if (!v && v !== 0) return null;
  // Firestore Timestamp-like (has toDate)
  if (typeof v === "object" && v !== null && typeof v.toDate === "function") return v.toDate();
  // { _seconds, _nanoseconds }
  if (typeof v === "object" && v !== null && typeof v._seconds === "number") {
    return new Date(v._seconds * 1000 + Math.floor((v._nanoseconds || 0) / 1e6));
  }
  // numeric seconds / milliseconds
  if (typeof v === "number" && Number.isFinite(v)) {
    // heuristics: if > 1e12 -> ms, if > 1e9 -> seconds
    if (v > 1e12) return new Date(v);
    if (v > 1e9) return new Date(v * 1000);
  }
  // ISO string
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function intQty(v: any, def = 1) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

function idFromUrl(url?: string): string {
  if (!url) return "";
  // match long numeric id like .../01050000036000/010500000360004582187110278.html
  const m = String(url).match(/\/([0-9]{6,})\.html(?:[?#].*)?$/);
  if (m) return m[1];
  // fallback: last numeric run of length >=6
  const mm = String(url).match(/([0-9]{6,})/g);
  if (mm && mm.length) return mm[mm.length - 1];
  return "";
}

function normalizeId(val: any, url?: string): string {
  // prefer url extraction
  if (url) {
    const u = idFromUrl(url);
    if (u) return u;
  }
  if (typeof val === "string") {
    const s = val.trim();
    if (/^[0-9]{6,}$/.test(s)) return s;
    // if stringified float like "1.0500000360004581e+25", attempt to parse raw numbers from it - but prefer URL
    const digits = s.match(/[0-9]{6,}/g);
    if (digits && digits.length) return digits[digits.length - 1];
  }
  if (typeof val === "number" && Number.isFinite(val)) {
    // try to produce an integer string without exponential
    const s = (Math.trunc(val)).toString();
    if (/^[0-9]{6,}$/.test(s)) return s;
    // as last resort, use toFixed(0) (may be imprecise for large doubles)
    try {
      const s2 = (val).toFixed(0);
      if (/^[0-9]{6,}$/.test(s2)) return s2;
    } catch {}
  }
  return "";
}

function stableKeyFrom(item: { id?: any; url?: string; name?: string } | any): string {
  const id = normalizeId(item?.id, item?.url);
  if (id) return `id:${id}`;
  const urlId = idFromUrl(item?.url || item?.raw || item?.link);
  if (urlId) return `id:${urlId}`;
  if (item?.name) return `name:${String(item.name).trim().toLowerCase()}`;
  if (typeof item === "string") return `raw:${item}`;
  return `row:${Math.random()}`;
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}

// ---------- Firestore init ----------
function initAdmin(credPath?: string) {
  const resolved = credPath ? path.resolve(credPath) : (process.env.GOOGLE_APPLICATION_CREDENTIALS || "");
  if (!resolved || !fs.existsSync(resolved)) {
    if (!admin.apps.length) {
      // If no credentials, try default app (may fail)
      admin.initializeApp();
    }
    return admin.firestore();
  }
  const sa = JSON.parse(fs.readFileSync(resolved, "utf8"));
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id,
    });
  }
  process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT = sa.project_id;
  return admin.firestore();
}

// ---------- robust parsing helpers ----------
function parsePossibleJsonString(v: any): any {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return v;
  if ((s[0] === "{" || s[0] === "[") && (s[s.length - 1] === "}" || s[s.length - 1] === "]")) {
    try {
      return JSON.parse(s);
    } catch {
      // fall through
      return v;
    }
  }
  return v;
}

function normalizeHistoryItem(raw: any): any {
  // raw may be object OR string of JSON OR object with rawobj string/obj
  let item: any = raw;
  if (typeof item === "string") {
    item = parsePossibleJsonString(item);
  }
  if (item && typeof item === "object") {
    // if rawobj field exists and is JSON string, merge it
    if (typeof item.rawobj === "string") {
      try {
        const parsed = JSON.parse(item.rawobj);
        item = { ...item, ...parsed };
      } catch {
        // keep original
      }
    } else if (typeof item.rawobj === "object" && item.rawobj !== null) {
      item = { ...item, ...item.rawobj };
    }
    // sometimes item keys are like 'raw:...' (we can't parse keys automatically).
    // prefer canonical keys id, url, name, timeStamp/timestamp/createdAt
  }
  return item;
}

// ---------- build last bought map ----------
async function buildLastBoughtMap(db: admin.firestore.Firestore, histPath: string, debug = false, explain = false) {
  const map = new Map<string, Date>(); // key -> lastDate

  const pathSegs = histPath.split("/").filter(Boolean);
  let docs: admin.firestore.QueryDocumentSnapshot[] = [];

  if (pathSegs.length % 2 === 1) {
    // treat as collection
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
    // treat as document
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

    // document-level timestamp candidates
    const docTs =
      toDateAny((data as any).createdAt) ||
      toDateAny((data as any).created_at) ||
      toDateAny((data as any).timeStamp) ||
      (d.createTime?.toDate() || null);

    // Try to obtain items array robustly
    let items: any[] = [];
    if (Array.isArray((data as any).items)) {
      items = (data as any).items;
    } else {
      // scan for first array value that looks like items
      for (const v of Object.values(data)) {
        if (Array.isArray(v)) {
          items = v;
          break;
        }
      }
    }

    if (debug) console.log("[DEBUG] history doc items count:", items.length);

    for (const rawIt of items) {
      const parsed = normalizeHistoryItem(rawIt);

      const itemTs =
        toDateAny(parsed?.timeStamp) ||
        toDateAny(parsed?.timestamp) ||
        toDateAny(parsed?.createdAt) ||
        null;

      const usedTs = itemTs || docTs;
      if (!usedTs) {
        if (explain) {
          const nm = parsed?.name || parsed?.url || parsed?.id || "(no-name)";
          console.log(`[EXPLAIN] hist item "${nm}" -> no usable timestamp (skip)`);
        }
        continue;
      }

      // log explain
      if (explain) {
        const nm = parsed?.name || parsed?.url || parsed?.id || "(no-name)";
        const via = itemTs ? "item.timeStamp" : docTs ? "doc.createdAt" : "doc.createTime";
        console.log(`[EXPLAIN] hist item "${nm}" -> ${usedTs.toISOString().slice(0,10)} via=${via}`);
      }

      const key = stableKeyFrom(parsed);
      const prev = map.get(key);
      if (!prev || prev < usedTs) map.set(key, usedTs);
    }

    // Additional: some history items may be stored as top-level object fields rather than in array -
    // skip for now (we tried to find arrays above).
  }

  if (debug) {
    console.log("[DEBUG] lastBought keys:", map.size);
    if (debug && map.size > 0) {
      const sample = Array.from(map.entries()).slice(0, 10).map(([k, d]) => `${k} -> ${d.toISOString().slice(0,10)}`);
      console.log("[DEBUG] lastBought sample:", sample);
    }
  }
  return map;
}

// ---------- collect due items ----------
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

    for (const rawIt of items) {
      const it = normalizeHistoryItem(rawIt) as SubItem;
      const key = stableKeyFrom(it);
      const last = lastMap.get(key);
      if (!last) {
        if (explain) {
          const nm = it?.name || it?.url || it?.id || "(no-name)";
          console.log(`[EXPLAIN] ${doc.id} :: ${nm} -> last=N/A => skip (まだ買っていない)`);
        }
        continue;
      }

      const itemFreq = Number((it as any).frequency) || 0;
      const threshold = itemFreq > 0 ? itemFreq : (subLevelFreq > 0 ? subLevelFreq : defaultDays);
      const daysSince = daysBetween(new Date(), last);
      const nm = it?.name || it?.url || it?.id || "(no-name)";

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

// ---------- write to cart ----------
async function writeToCart(
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
      const id = normalizeId(it.id, it.url);
      if (id) {
        const docPath = `users/${uid}/cart/${id}`;
        const ref = db.doc(docPath);
        const snap = await ref.get();
        const existing = snap.exists ? (snap.data() || {}) : null;

        const newBody: any = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          source: "auto-subscription",
          url: it.url || "",
          name: it.name || "",
          image: it.image || "",
          price: typeof it.price === "number" ? it.price : null,
          priceTax: typeof (it as any).priceTax === "number" ? (it as any).priceTax : null,
        };

        const qty = intQty((it as any).quantity ?? (it as any).qty ?? 1, 1);

        if (existing) {
          // increment quantity
          const existingQty = Number((existing as any).quantity || (existing as any).quantify || 0);
          newBody.quantity = existingQty + qty;
          newBody.quantify = existingQty + qty;
        } else {
          newBody.createdAt = admin.firestore.FieldValue.serverTimestamp();
          newBody.quantity = qty;
          newBody.quantify = qty;
        }

        if (dry) {
          if (debug) console.log(`[DRY] would create/update ${docPath}`, JSON.stringify(newBody, null, 2));
          wrote++;
          continue;
        }

        await ref.set(newBody, { merge: true });
        if (debug) console.log(`[DEBUG] wrote cart doc ${docPath}`);
        wrote++;
      } else {
        // fallback: add to cart collection (auto-id)
        const col = db.collection(`users/${uid}/cart`);
        const body: any = {
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          source: "auto-subscription",
          url: it.url || "",
          name: it.name || "",
          image: it.image || "",
          price: typeof it.price === "number" ? it.price : null,
          priceTax: typeof (it as any).priceTax === "number" ? (it as any).priceTax : null,
          quantity: intQty((it as any).quantity ?? (it as any).qty ?? 1, 1),
          quantify: intQty((it as any).quantity ?? (it as any).qty ?? 1, 1),
        };

        if (dry) {
          if (debug) console.log("[DRY] would add cart doc to collection users/%s/cart ->", uid, JSON.stringify(body, null, 2));
          wrote++;
          continue;
        }
        await col.add(body);
        if (debug) console.log(`[DEBUG] added auto-id cart doc for user=${uid}`);
        wrote++;
      }
    }
  }
  return wrote;
}

// ---------- get users ----------
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

// ---------- arg parsing ----------
function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string, d = "") => {
    const i = argv.indexOf(k);
    return i >= 0 ? String(argv[i + 1]) : d;
  };
  const has = (k: string) => argv.includes(k);
  return {
    cred: get("--cred", ""),
    days: Number(get("--days", "30")) || 30,
    dry: has("--dry"),
    debug: has("--debug"),
    explain: has("--explain"),
    limit: Number(get("--limit", "0")) || undefined,
    delayMs: Number(get("--delay-ms", "200")) || 200,
    uid: get("--uid", "") || undefined,
  };
}

// ---------- main ----------
(async function main() {
  const args = parseArgs();
  if (args.debug) console.log("[INFO] starting autocart-runner ***", { dry: args.dry, days: args.days, limit: args.limit, delayMs: args.delayMs, uid: args.uid });

  // init
  let db: admin.firestore.Firestore;
  try {
    db = initAdmin(args.cred);
  } catch (e: any) {
    console.error("[FATAL] initAdmin failed:", e && e.stack ? e.stack : e);
    process.exit(1);
    return;
  }

  let uids: string[] = [];
  if (args.uid) {
    uids = [args.uid];
  } else {
    uids = await getUserIdsWithSubscriptions(db, args.limit, args.debug);
  }
  console.log("[INFO] users to process:", uids.length);

  let totalAdded = 0;
  let totalProcessed = 0;
  for (const uid of uids) {
    totalProcessed++;
    console.log(`\n--- Processing uid=${uid} (${totalProcessed}/${uids.length}) ---`);
    try {
      const histPathDefault = `users/${uid}/history`;
      const lastMap = await buildLastBoughtMap(db, histPathDefault, args.debug, args.explain);
      if (args.debug) {
        console.log("[DEBUG] lastBought map size:", lastMap.size);
        if (lastMap.size > 0 && args.debug) {
          const sample = Array.from(lastMap.keys()).slice(0, 10);
          console.log("[DEBUG] lastBought keys (sample):", sample);
        }
      }
      const bundles = await collectDueItems(db, `users/${uid}/subscriptions`, lastMap, args.days, args.debug, args.explain);
      if (!bundles.length) {
        console.log("[INFO] no due items for user:", uid);
      } else {
        const wrote = await writeToCart(db, uid, bundles, args.dry, args.debug);
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