//あらとも

import * as admin from "firebase-admin";
import * as fs from "fs";

type SubItem = { id?: any; itemId?: any; productId?: any; url?: string; name?: string; image?: string; price?: number; priceTax?: number; quantity?: number; qty?: number; genre?: number | string; frequency?: number; };
const DAY_MS = 24 * 3600 * 1000;

function toDateAny(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object" && v !== null && typeof v.toDate === "function") return v.toDate();
  if (typeof v === "number") return v < 1e12 ? new Date(v * 1000) : new Date(v);
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}
function intQty(v: any, def = 1) { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : def; }
function extractLongestDigitRun(s: string) { const m = String(s || "").match(/\d+/g); if (!m) return ""; return m.sort((a,b)=>b.length-b.length)[0]; }
function idFromUrl(url?: string): string {
  if (!url) return "";
  const s = String(url);
  const m = s.match(/\/([A-Za-z0-9\-_]{4,})\.html(?:[?#].*)?$|[?&]id=([A-Za-z0-9\-_]{4,})/);
  if (m && (m[1]||m[2])) return (m[1]||m[2]).trim();
  const any = s.match(/[A-Za-z0-9]{4,}/g);
  if (any && any.length) return any.sort((a,b)=>b.length - a.length)[0];
  return extractLongestDigitRun(s);
}
function normalizeId(val: any, url?: string): string {
  if (url) { const u = idFromUrl(url); if (u) return u; }
  if (val == null) return "";
  if (typeof val === "number") { const s = String(val); const d = extractLongestDigitRun(s); return d || s; }
  if (typeof val === "object") { try { val = JSON.stringify(val); } catch {} }
  const s = String(val||"").trim();
  if (!s) return "";
  const any = s.match(/[A-Za-z0-9]{4,}/g);
  if (any && any.length) return any.sort((a,b)=>b.length - a.length)[0];
  const num = s.match(/\d{4,}/g);
  if (num && num.length) return num.sort((a,b)=>b.length - a.length)[0];
  return "";
}
function stableKeyFromObj(item: any): string {
  const id = normalizeId(item?.id ?? item?.itemId ?? item?.productId, item?.url);
  if (id) return `id:${id}`;
  if (item?.name) return `name:${String(item.name).trim().toLowerCase()}`;
  const urlId = idFromUrl(item?.url || "");
  if (urlId) return `id:${urlId}`;
  try { return `rawobj:${JSON.stringify(item)}`; } catch { return `row:${Math.random()}`; }
}
function candidateKeysForItem(item: any): string[] {
  const keys = new Set<string>();
  if (!item) return [];
  const add = (v:any) => { if (v==null) return; const s=String(v).trim(); if(!s) return; keys.add(`raw:${s}`); const d = extractLongestDigitRun(s); if (d) keys.add(`num:${d}`); const nid = normalizeId(s, item?.url); if (nid) keys.add(`id:${nid}`); };
  const fields = ['itemId','item_id','productId','product_id','id','sku','url','name'];
  for (const f of fields) if (Object.prototype.hasOwnProperty.call(item,f)) add(item[f]);
  if (item.url) add(item.url);
  if (item.name) keys.add(`name:${String(item.name).trim().toLowerCase()}`);
  try { keys.add(`rawobj:${JSON.stringify(item)}`); } catch {}
  return Array.from(keys);
}
function daysBetween(a: Date,b: Date){ return Math.floor((a.getTime()-b.getTime())/DAY_MS); }

/* Firebase init (FIREBASE_SERVICE_ACCOUNT env or GOOGLE_APPLICATION_CREDENTIALS file) */
function initAdmin() {
  if ((admin as any).apps && (admin as any).apps.length) return admin.firestore();
  const env = (process.env.FIREBASE_SERVICE_ACCOUNT||"").trim();
  const gpath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gpath && fs.existsSync(gpath)) {
    const sa = JSON.parse(fs.readFileSync(gpath,"utf8"));
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
    process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT = sa.project_id;
    return admin.firestore();
  }
  if (env) {
    try { const sa = JSON.parse(env); admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id }); process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT = sa.project_id; return admin.firestore(); }
    catch (e) { throw new Error("FIREBASE_SERVICE_ACCOUNT is set but invalid JSON"); }
  }
  admin.initializeApp();
  return admin.firestore();
}

/* detect item-like object and arrays */
function looksLikeItemObject(obj: any) {
  if (!obj || typeof obj !== "object") return false;
  const keys = Object.keys(obj).map(k => k.toLowerCase());
  if (keys.includes("timestamp") || keys.includes("time") || keys.includes("createdat")) return true;
  if (keys.includes("id") || keys.includes("itemid") || keys.includes("productid")) return true;
  if (keys.includes("url") || keys.includes("name")) return true;
  return false;
}
function looksLikeHistoryItemArray(arr: any[]): boolean {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  let hits = 0, checked = 0;
  for (let i=0;i< Math.min(arr.length,20); i++) {
    const el = arr[i];
    if (el && typeof el === "object") {
      checked++;
      if (looksLikeItemObject(el)) hits++;
    }
  }
  return checked>0 && hits / Math.max(1,checked) >= 0.25;
}
function findItemArrays(obj: any, depth = 0, maxDepth = 8, path = ""): Array<{path:string,arr:any[]}> {
  const out: Array<{path:string,arr:any[]}> = [];
  if (depth > maxDepth || obj == null) return out;
  if (Array.isArray(obj)) {
    if (looksLikeHistoryItemArray(obj)) out.push({ path, arr: obj });
    for (let i=0; i < Math.min(obj.length, 50); i++) out.push(...findItemArrays(obj[i], depth+1, maxDepth, `${path}[${i}]`));
    return out;
  }
  if (typeof obj === "object") {
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (Array.isArray(v)) {
        if (looksLikeHistoryItemArray(v)) out.push({ path: path ? path + "." + k : k, arr: v });
        else out.push(...findItemArrays(v, depth+1, maxDepth, path ? path + "." + k : k));
      } else if (v && typeof v === "object") {
        if (looksLikeItemObject(v)) out.push({ path: path ? path + "." + k : k, arr: [v] });
        else out.push(...findItemArrays(v, depth+1, maxDepth, path ? path + "." + k : k));
      }
    }
  }
  return out;
}

/* collect from doc (robust) */
async function collectFromDoc(docSnap: admin.firestore.DocumentSnapshot, map: Map<string,Date>, debug=false, explain=false) {
  if (!docSnap || !docSnap.exists) return;
  const docPath = docSnap.ref.path;
  if (debug) console.log("DEBUG: inspecting doc:", docPath);
  const data = (docSnap.data && docSnap.data()) || {};
  if (debug) {
    const top = Object.keys(data).slice(0,20).reduce((acc:any,k)=>{ try { const v=data[k]; acc[k] = Array.isArray(v)?`Array(len=${v.length})`:(typeof v==='object'?'[obj]':v); } catch { acc[k]='[err]'; } return acc; }, {});
    console.log("  keys/sample:", JSON.stringify(top));
  }

  const docTs = toDateAny((data as any).createdAt) || toDateAny((data as any).timeStamp) || toDateAny((data as any).timestamp) || (docSnap.createTime ? docSnap.createTime.toDate() : null);

  // common candidate arrays
  let arr: any[] = [];
  const maybe = (data as any);
  if (Array.isArray(maybe.items)) arr = maybe.items;
  else if (Array.isArray(maybe.history)) arr = maybe.history;
  else if (Array.isArray(maybe.purchases)) arr = maybe.purchases;

  // if doc itself looks like a single item, take it
  if (arr.length === 0 && looksLikeItemObject(maybe)) { arr = [maybe]; if (debug) console.log("  treat doc itself as one item"); }

  // fallback: find nested arrays
  if (arr.length === 0) {
    const found = findItemArrays(maybe, 0, 6);
    if (found.length) { arr = found[0].arr; if (debug) console.log("  found nested array at", found[0].path, "len=", arr.length); }
  }

  if (debug) console.log("  items to inspect:", arr.length);
  for (const it of arr) {
    const itemTs = toDateAny((it as any).timeStamp) || toDateAny((it as any).timestamp) || toDateAny((it as any).createdAt) || docTs;
    if (!itemTs) { if (explain) console.log("  SKIP item (no timestamp):", JSON.stringify(it).slice(0,200)); continue; }
    const keys = candidateKeysForItem(it);
    if (explain) console.log("  item keys:", keys);
    for (const k of keys) {
      const prev = map.get(k);
      if (!prev || prev < itemTs) map.set(k, itemTs);
    }
  }

  // try subcollections (docs under this doc)
  try {
    const subcols = await docSnap.ref.listCollections();
    for (const sc of subcols) {
      if (debug) console.log("  scanning subcollection:", sc.path);
      const snap = await sc.get();
      for (const d of snap.docs) await collectFromDoc(d, map, debug, explain);
    }
  } catch (e) {
    if (debug) console.log("  listCollections failed:", e && e.message);
  }
}

/* buildLastBoughtMap: if given histPath empty, fallback to scanning user subcollections */
async function buildLastBoughtMap(db: admin.firestore.Firestore, histPath: string, debug=false, explain=false) {
  const map = new Map<string,Date>();
  const segs = histPath.split("/").filter(Boolean);

  if (segs.length % 2 === 1) {
    // collection
    const col = db.collection(histPath);
    let snap: admin.firestore.QuerySnapshot;
    try { snap = await col.orderBy("createdAt","asc").get(); } catch { snap = await col.get(); }
    if (debug) console.log("DEBUG: history collection", histPath, "docs=", snap.size);
    if (snap.size > 0) {
      for (const d of snap.docs) await collectFromDoc(d, map, debug, explain);
      if (debug) console.log("DEBUG: lastBought map size:", map.size);
      return map;
    }
    // empty -> fallback to scanning user subcollections (if path starts with users/{uid})
  } else {
    // single doc
    const doc = await db.doc(histPath).get();
    if (doc.exists) { if (debug) console.log("DEBUG: history doc exists:", histPath); await collectFromDoc(doc, map, debug, explain); if (debug) console.log("DEBUG: lastBought map size:", map.size); return map; }
    if (debug) console.log("DEBUG: history doc NOT FOUND:", histPath);
    // fallback below
  }

  // FALLBACK: if histPath was users/{uid}/history and it's empty, scan subcollections under users/{uid}
  // find user id from histPath if possible
  const match = histPath.match(/^users\/([^\/]+)\/?/);
  if (match) {
    const uid = match[1];
    const userDocRef = db.collection("users").doc(uid);
    try {
      const subcols = await userDocRef.listCollections();
      if (debug) console.log("DEBUG: discovered user subcollections:", subcols.map(s=>s.id));
      for (const sc of subcols) {
        // scan each subcollection doc
        const snap = await sc.get();
        if (debug) console.log(`DEBUG: scanning ${sc.path} docs=${snap.size}`);
        for (const d of snap.docs) await collectFromDoc(d, map, debug, explain);
      }
      // also check docs directly under users/{uid} (user doc itself)
      const userDoc = await userDocRef.get();
      if (userDoc.exists) await collectFromDoc(userDoc, map, debug, explain);
    } catch (e) {
      if (debug) console.log("DEBUG: fallback scan failed:", e && e.message);
    }
  } else {
    if (debug) console.log("DEBUG: histPath not in users/*; no fallback.");
  }

  if (debug) console.log("DEBUG: lastBought map size (final):", map.size);
  return map;
}

/* collectDueItems - similar to previous logic */
async function collectDueItems(db: admin.firestore.Firestore, subsPath: string, lastMap: Map<string,Date>, defaultDays=30, debug=false, explain=false) {
  const dueByDoc: Array<{ subId: string; items: SubItem[]; dueInfo: Array<{ key:string; last:Date|null; daysSince:number; threshold:number }> }> = [];
  const subsSnap = await db.collection(subsPath).get();
  if (debug) console.log("DEBUG: subscriptions docs:", subsSnap.size);

  for (const doc of subsSnap.docs) {
    const data = doc.data() || {};
    const subLevelFreq = Number((data as any).frequency) || 0;
    const items: SubItem[] = Array.isArray((data as any).items) ? (data as any).items : [];
    const dueItems: SubItem[] = [];
    const info: Array<{ key:string; last:Date|null; daysSince:number; threshold:number }> = [];

    for (const it of items) {
      const keys = candidateKeysForItem(it);
      if (explain) console.log(`[EXPLAIN] ${doc.id} item keys:`, keys);
      let last: Date|null = null;
      let matchedKey: string|null = null;
      for (const k of keys) { const f = lastMap.get(k); if (f) { last = f; matchedKey = k; break; } }

      if (!last) {
        if (explain) console.log(`[EXPLAIN] ${doc.id} :: ${(it as any).name||it.url||it.id} -> last=N/A => skip`);
        continue;
      }

      const itemFreq = Number((it as any).frequency) || 0;
      const threshold = itemFreq > 0 ? itemFreq : (subLevelFreq > 0 ? subLevelFreq : defaultDays);
      const daysSince = daysBetween(new Date(), last);
      if (daysSince >= threshold) {
        const add: SubItem = { ...(it as any), quantity: intQty((it as any).quantity ?? (it as any).qty ?? 1, 1) };
        dueItems.push(add);
        info.push({ key: matchedKey || "(no-key)", last, daysSince, threshold });
        if (explain) console.log(`[EXPLAIN] ${doc.id} DUE: ${(it as any).name||it.url||it.id} last=${last.toISOString().slice(0,10)} daysSince=${daysSince} thr=${threshold}`);
      } else if (explain) {
        console.log(`[EXPLAIN] ${doc.id} not yet: daysSince=${daysSince} thr=${threshold}`);
      }
    }
    if (dueItems.length) dueByDoc.push({ subId: doc.id, items: dueItems, dueInfo: info });
  }
  return dueByDoc;
}

/* writePurchase -> users/{uid}/cart/{itemId} (create or update) */
async function writePurchase(db: admin.firestore.Firestore, uid: string, bundles: Array<{ subId:string; items:SubItem[]; dueInfo:any[] }>, dry=true, debug=false) {
  if (!bundles.length) return 0;
  const col = db.collection(`users/${uid}/cart`);
  let wrote = 0;
  for (const b of bundles) {
    for (const it of b.items) {
      const docIdCandidate = normalizeId((it as any).itemId ?? (it as any).item_id ?? (it as any).productId ?? (it as any).product_id ?? (it as any).id, it.url);
      const docId = docIdCandidate || extractLongestDigitRun(String(it.url||"")) || "";
      const qty = intQty((it as any).quantity ?? (it as any).qty ?? 1, 1);

      if (docId) {
        const ref = col.doc(docId);
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
          if (dry) { if (debug) console.log("[DRY] would update", ref.path, updateBody); }
          else { await ref.set(updateBody, { merge:true }); if (debug) console.log("[WROTE] updated", ref.path); }
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
          if (dry) { if (debug) console.log("[DRY] would create", col.doc(docId).path, body); }
          else { await col.doc(docId).set(body, { merge:true }); if (debug) console.log("[WROTE] created", col.doc(docId).path); }
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
        if (dry) { if (debug) console.log("[DRY] would add auto-id", body); }
        else { await col.add(body); if (debug) console.log("[WROTE] added auto-id"); }
        wrote++;
      }
    }
  }
  return wrote;
}

/* arg parse & run */
function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (k:string,d="")=>{const i=argv.indexOf(k); return i>=0? argv[i+1]: d;};
  const has = (k:string)=> argv.includes(k);
  return {
    cred: get("--cred",""),
    days: Number(get("--days","30"))||30,
    dry: has("--dry"),
    debug: has("--debug"),
    explain: has("--explain"),
    limit: Number(get("--limit","0")) || undefined,
    delayMs: Number(get("--delay-ms","200")) || 200,
    uid: get("--uid","") || undefined,
  };
}

(async ()=> {
  const args = parseArgs();
  const db = initAdmin();
  if (args.debug) console.log("[INFO] start", { dry: args.dry, uid: args.uid, limit: args.limit });
  const uids = args.uid ? [args.uid] : (await db.collection("users").get()).docs.map(d=>d.id);
  if (args.limit) uids.splice(args.limit);
  console.log("[INFO] users to process:", uids.length);

  let totalAdded = 0, totalProcessed = 0;
  for (const uid of uids) {
    totalProcessed++;
    console.log(`\n--- Processing uid=${uid} (${totalProcessed}/${uids.length}) ---`);
    try {
      const lastMap = await buildLastBoughtMap(db, `users/${uid}/history`, args.debug, args.explain);
      if (args.debug) console.log("[DEBUG] lastBought keys sample:", Array.from(lastMap.keys()).slice(0,50));
      const bundles = await collectDueItems(db, `users/${uid}/subscriptions`, lastMap, args.days, args.debug, args.explain);
      if (bundles.length === 0) {
        console.log("[INFO] no due items for user:", uid);
      } else {
        const wrote = await writePurchase(db, uid, bundles, args.dry, args.debug);
        console.log(`[INFO] user=${uid} wrote=${wrote}`);
        totalAdded += wrote;
      }
    } catch (e:any) {
      console.error("[ERROR] processing uid", uid, e && e.stack ? e.stack : e);
    }
    if (args.delayMs) await new Promise(r=>setTimeout(r, args.delayMs));
  }
  console.log(`\nDone. users_processed=${totalProcessed} total_added=${totalAdded} (dry=${args.dry})`);
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });