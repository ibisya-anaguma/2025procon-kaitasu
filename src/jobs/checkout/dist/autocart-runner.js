"use strict";
//あらとも
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
const fs = __importStar(require("fs"));
const DAY_MS = 24 * 3600 * 1000;
function toDateAny(v) {
    if (!v)
        return null;
    if (typeof v === "object" && v !== null && typeof v.toDate === "function")
        return v.toDate();
    if (v instanceof Date)
        return v;
    if (typeof v === "number") {
        if (v < 1e12)
            return new Date(v * 1000);
        return new Date(v);
    }
    const s = String(v || "").trim();
    const d = new Date(s);
    if (!isNaN(d.getTime()))
        return d;
    try {
        const m = s.match(/^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s*UTC\+?([0-9:+-]+))?/);
        if (m) {
            const [, Y, M, D, hh, mm, ss, tz] = m;
            let tzpart = "+09:00";
            if (tz) {
                if (/^[0-9]{1,2}$/.test(tz))
                    tzpart = (tz.length === 1 ? `+0${tz}:00` : `+${tz}:00`);
                else if (/^[+-]?[0-9]{1,2}$/.test(tz))
                    tzpart = `${tz}:00`;
                else
                    tzpart = (tz.includes(":") ? `+${tz}` : `+${tz}:00`);
            }
            const iso = `${Y}-${String(Number(M)).padStart(2, "0")}-${String(Number(D)).padStart(2, "0")}T${String(Number(hh)).padStart(2, "0")}:${mm}:${ss}${tzpart}`;
            const dd = new Date(iso);
            if (!isNaN(dd.getTime()))
                return dd;
        }
    }
    catch { }
    return null;
}
function intQty(v, def = 1) { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : def; }
function extractLongestDigitRun(s) { const m = s.match(/\d+/g); if (!m)
    return ""; return m.sort((a, b) => b.length - a.length)[0]; }
function idFromUrl(url) { if (!url)
    return ""; const s = String(url); const m = s.match(/\/([A-Za-z0-9\-_]{4,})\.html(?:[?#].*)?$|[?&]id=([A-Za-z0-9\-_]{4,})/); if (m && (m[1] || m[2]))
    return (m[1] || m[2]).trim(); const any = s.match(/[A-Za-z0-9]{4,}/g); if (any && any.length)
    return any.sort((a, b) => b.length - a.length)[0]; return extractLongestDigitRun(s); }
function normalizeId(val, url) {
    if (url) {
        const u = idFromUrl(url);
        if (u)
            return u;
    }
    if (val == null)
        return "";
    if (typeof val === "number") {
        const s = String(val);
        const d = extractLongestDigitRun(s);
        return d || s;
    }
    if (typeof val === "object") {
        try {
            val = JSON.stringify(val);
        }
        catch {
            val = String(val);
        }
    }
    const s = String(val).trim();
    if (!s)
        return "";
    if (/^[A-Za-z0-9\-_]{4,}$/.test(s))
        return s;
    const any = s.match(/[A-Za-z0-9]{4,}/g);
    if (any && any.length)
        return any.sort((a, b) => b.length - a.length)[0];
    const num = s.match(/\d{4,}/g);
    if (num && num.length)
        return num.sort((a, b) => b.length - a.length)[0];
    return "";
}
function candidateKeysForItem(item) {
    const keys = new Set();
    const add = (v) => { if (v == null)
        return; const s = String(v).trim(); if (!s)
        return; const n = normalizeId(s, item?.url); if (n)
        keys.add(`id:${n}`); const digits = extractLongestDigitRun(s); if (digits)
        keys.add(`num:${digits}`); keys.add(`raw:${s}`); };
    const fields = ["itemId", "item_id", "productId", "product_id", "id", "sku", "skuId", "shop_item_id", "product_id_jp"];
    for (const f of fields) {
        if (item && Object.prototype.hasOwnProperty.call(item, f))
            add(item[f]);
        for (const k of Object.keys(item || {})) {
            if (k.toLowerCase() === f.toLowerCase() && k !== f)
                add(item[k]);
        }
    }
    if (item && item.url) {
        const u = idFromUrl(item.url);
        if (u)
            keys.add(`id:${u}`);
        const digits = extractLongestDigitRun(String(item.url || ""));
        if (digits)
            keys.add(`num:${digits}`);
        keys.add(`raw:${item.url}`);
    }
    if (item && item.name) {
        const nm = String(item.name).trim().toLowerCase().replace(/\s+/g, " ");
        if (nm)
            keys.add(`name:${nm}`);
    }
    if (item && item.id)
        add(item.id);
    try {
        keys.add(`rawobj:${JSON.stringify(item)}`);
    }
    catch { }
    return Array.from(keys);
}
function daysBetween(a, b) { return Math.floor((a.getTime() - b.getTime()) / DAY_MS); }
function initAdmin(credPath) {
    if (admin.apps && admin.apps.length)
        return admin.firestore();
    const envCredJson = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
    const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || credPath;
    if (envPath && fs.existsSync(envPath)) {
        const sa = JSON.parse(fs.readFileSync(envPath, "utf8"));
        admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
        process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT = sa.project_id;
        return admin.firestore();
    }
    if (envCredJson) {
        try {
            const sa = JSON.parse(envCredJson);
            admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
            process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT = sa.project_id;
            return admin.firestore();
        }
        catch (e) {
            throw new Error("FIREBASE_SERVICE_ACCOUNT is set but invalid JSON");
        }
    }
    admin.initializeApp();
    return admin.firestore();
}
// --- NEW: recursive finder for arrays of candidate history items ---
function looksLikeHistoryItemArray(arr) {
    if (!Array.isArray(arr) || arr.length === 0)
        return false;
    // consider it history-like if many elements are objects with at least one of these keys
    const wantKeys = ["id", "itemId", "productId", "url", "name", "timeStamp", "timestamp", "createdAt"];
    let score = 0, checked = 0;
    for (let i = 0; i < Math.min(arr.length, 10); i++) {
        const el = arr[i];
        if (el && typeof el === "object") {
            checked++;
            for (const k of Object.keys(el)) {
                if (wantKeys.includes(k) || wantKeys.includes(k.replace(/[-_]/g, ""))) {
                    score++;
                    break;
                }
            }
        }
    }
    return checked > 0 && score / Math.max(1, checked) >= 0.3; // 30% of sampled elems look like items
}
function findItemArrays(obj, depth = 0, maxDepth = 6, path = "") {
    const out = [];
    if (depth > maxDepth || obj == null)
        return out;
    if (Array.isArray(obj)) {
        if (looksLikeHistoryItemArray(obj))
            out.push({ path, arr: obj });
        // also search array elements
        for (let i = 0; i < Math.min(obj.length, 50); i++)
            out.push(...findItemArrays(obj[i], depth + 1, maxDepth, path + `[${i}]`));
        return out;
    }
    if (typeof obj === "object") {
        for (const k of Object.keys(obj)) {
            const v = obj[k];
            if (Array.isArray(v)) {
                if (looksLikeHistoryItemArray(v))
                    out.push({ path: path ? path + "." + k : k, arr: v });
                else
                    out.push(...findItemArrays(v, depth + 1, maxDepth, path ? path + "." + k : k));
            }
            else if (v && typeof v === "object") {
                out.push(...findItemArrays(v, depth + 1, maxDepth, path ? path + "." + k : k));
            }
            else {
                // skip primitives
            }
        }
    }
    return out;
}
async function buildLastBoughtMap(db, histPath, debug = false, explain = false) {
    const map = new Map();
    const pathSegs = histPath.split("/").filter(Boolean);
    async function collectFromDoc(docSnap) {
        const data = (docSnap.data && docSnap.data()) || {};
        const docTs = toDateAny(data.createdAt) || toDateAny(data.created_at) || toDateAny(data.timeStamp) || (docSnap.createTime ? docSnap.createTime.toDate() : null);
        // Try common top-level fields first
        let rawItems = data.items ?? data.history ?? data.purchases ?? null;
        let arr = [];
        if (Array.isArray(rawItems))
            arr = rawItems;
        else if (rawItems && typeof rawItems === 'object')
            arr = Object.values(rawItems);
        // If none found, try recursive finder
        if (!arr.length) {
            const found = findItemArrays(data);
            if (found && found.length) {
                // pick first reasonable array
                arr = found[0].arr;
                if (debug)
                    console.log("[DEBUG] found nested item array at", found[0].path, "len=", arr.length);
            }
        }
        if (debug)
            console.log("[DEBUG] history doc", docSnap.id, "items count:", arr.length);
        for (const it of arr) {
            const itemTs = toDateAny(it.timeStamp) || toDateAny(it.timestamp) || toDateAny(it.createdAt) || null;
            let usedTs = itemTs || docTs;
            if (!usedTs) {
                usedTs = toDateAny(it.timeStamp) || toDateAny(it.timestamp) || null;
            }
            if (!usedTs)
                continue;
            const keys = candidateKeysForItem(it);
            if (explain)
                console.log(`[EXPLAIN] history doc ${docSnap.id} item keys:`, keys);
            for (const k of keys) {
                const prev = map.get(k);
                if (!prev || prev < usedTs)
                    map.set(k, usedTs);
                if (k.startsWith("id:")) {
                    const digits = extractLongestDigitRun(k.slice(3));
                    if (digits) {
                        const nk = `num:${digits}`;
                        const p2 = map.get(nk);
                        if (!p2 || p2 < usedTs)
                            map.set(nk, usedTs);
                    }
                }
                if (k.startsWith("raw:") || k.startsWith("rawobj:")) {
                    const digits = extractLongestDigitRun(k);
                    if (digits) {
                        const nk = `num:${digits}`;
                        const p2 = map.get(nk);
                        if (!p2 || p2 < usedTs)
                            map.set(nk, usedTs);
                    }
                }
            }
        }
    }
    if (pathSegs.length % 2 === 1) {
        let snap;
        try {
            snap = await db.collection(histPath).orderBy("createdAt", "asc").get();
        }
        catch {
            snap = await db.collection(histPath).get();
        }
        for (const d of snap.docs)
            await collectFromDoc(d);
    }
    else {
        const doc = await db.doc(histPath).get();
        if (doc.exists)
            await collectFromDoc(doc);
    }
    if (debug) {
        console.log("[DEBUG] lastBought map size:", map.size);
        if (map.size <= 200)
            console.log("[DEBUG] lastBought keys (sample):", Array.from(map.entries()).map(([k, v]) => `${k} -> ${v.toISOString().slice(0, 10)}`));
        else
            console.log("[DEBUG] lastBought keys sample:", Array.from(map.keys()).slice(0, 50));
    }
    return map;
}
// (collectDueItems and writePurchase implementation unchanged from prior final — keep existing robust logic)
async function collectDueItems(db, subsPath, lastMap, defaultDays, debug = false, explain = false, includeNever = false) {
    const dueByDoc = [];
    const subsSnap = await db.collection(subsPath).get();
    if (debug)
        console.log("[DEBUG] subscriptions docs:", subsSnap.size);
    for (const doc of subsSnap.docs) {
        const data = doc.data() || {};
        const subLevelFreq = Number(data.frequency) || 0;
        let rawItems = data.items ?? [];
        const items = Array.isArray(rawItems) ? rawItems : (rawItems && typeof rawItems === "object" ? Object.values(rawItems) : []);
        const dueItems = [];
        const info = [];
        for (const it of items) {
            const keys = candidateKeysForItem(it);
            if (explain)
                console.log(`[EXPLAIN] subs doc ${doc.id} item keys:`, keys);
            const itemFreq = Number(it.frequency) || 0;
            const threshold = itemFreq > 0 ? itemFreq : (subLevelFreq > 0 ? subLevelFreq : defaultDays);
            let last = null;
            let matchedKey = null;
            for (const k of keys) {
                const f = lastMap.get(k);
                if (f) {
                    last = f;
                    matchedKey = k;
                    break;
                }
            }
            if (!last) {
                const numericCandidates = new Set();
                for (const k of keys) {
                    if (k.startsWith("num:"))
                        numericCandidates.add(k.slice(4));
                    else {
                        const m = k.match(/\d{4,}/g);
                        if (m && m.length)
                            numericCandidates.add(m.sort((a, b) => b.length - a.length)[0]);
                    }
                }
                if (numericCandidates.size) {
                    outer: for (const [lk, ld] of lastMap.entries()) {
                        if (!lk.startsWith("num:") && !lk.startsWith("id:") && !lk.startsWith("raw:") && !lk.startsWith("rawobj:"))
                            continue;
                        const lkDigits = extractLongestDigitRun(lk);
                        for (const nc of numericCandidates) {
                            if (!nc || !lkDigits)
                                continue;
                            if (lkDigits === nc || lkDigits.endsWith(nc) || nc.endsWith(lkDigits) || lkDigits.includes(nc) || nc.includes(lkDigits)) {
                                last = ld;
                                matchedKey = lk;
                                break outer;
                            }
                        }
                    }
                }
            }
            if (!last) {
                const keyNameTokens = [];
                for (const k of keys)
                    if (k.startsWith("name:"))
                        keyNameTokens.push(...String(k.slice(5)).toLowerCase().split(/\s+/).filter(Boolean));
                if (keyNameTokens.length) {
                    for (const [lk, ld] of lastMap.entries()) {
                        if (!lk.startsWith("name:"))
                            continue;
                        const lkTokens = String(lk.slice(5)).toLowerCase().split(/\s+/).filter(Boolean);
                        if (!lkTokens.length)
                            continue;
                        const matched = lkTokens.filter(t => keyNameTokens.includes(t));
                        const ratio = matched.length / Math.max(1, Math.min(lkTokens.length, keyNameTokens.length));
                        if (ratio >= 0.5) {
                            last = ld;
                            matchedKey = lk;
                            break;
                        }
                    }
                }
            }
            if (!last) {
                if (includeNever) {
                    dueItems.push({ ...it, quantity: intQty(it.quantity ?? it.qty ?? 1, 1) });
                    info.push({ key: keys[0] || "(no-key)", last: null, daysSince: Number.MAX_SAFE_INTEGER, threshold });
                    if (explain)
                        console.log(`[EXPLAIN] ${doc.id} :: ${it.name || it.url || it.id} -> last=N/A includeNever => DUE thr=${threshold}`);
                }
                else {
                    if (explain)
                        console.log(`[EXPLAIN] ${doc.id} :: ${it.name || it.url || it.id} -> last=N/A keys=${keys} => skip`);
                    continue;
                }
            }
            else {
                const daysSince = daysBetween(new Date(), last);
                if (daysSince >= threshold) {
                    dueItems.push({ ...it, quantity: intQty(it.quantity ?? it.qty ?? 1, 1) });
                    info.push({ key: matchedKey || keys[0] || "(no-key)", last, daysSince, threshold });
                    if (explain)
                        console.log(`[EXPLAIN] ${doc.id} :: ${it.name || it.url || it.id} -> last=${last.toISOString().slice(0, 10)} daysSince=${daysSince} threshold=${threshold} matchedKey=${matchedKey}`);
                }
                else {
                    if (explain)
                        console.log(`[EXPLAIN] ${doc.id} :: ${it.name || it.url || it.id} -> last=${last.toISOString().slice(0, 10)} daysSince=${daysSince} threshold=${threshold} => not yet`);
                }
            }
        }
        if (dueItems.length) {
            dueByDoc.push({ subId: doc.id, items: dueItems, dueInfo: info });
            if (debug)
                console.log(`[DEBUG] due @${doc.id}: ${dueItems.length} items`);
        }
    }
    return dueByDoc;
}
async function writePurchase(db, uid, bundles, dry, debug = false, forceAdd = false) {
    if (!bundles.length)
        return 0;
    const colPath = `users/${uid}/cart`;
    const col = db.collection(colPath);
    let wrote = 0;
    for (const b of bundles) {
        for (const it of b.items) {
            const docIdCandidate = normalizeId(it.itemId ?? it.item_id ?? it.productId ?? it.product_id ?? it.id, it.url);
            let docId = docIdCandidate;
            if (!docId) {
                const byUrlDigits = extractLongestDigitRun(String(it.url || ""));
                if (byUrlDigits)
                    docId = byUrlDigits;
            }
            const qty = intQty(it.quantity ?? it.qty ?? 1, 1);
            if (docId) {
                const ref = col.doc(docId);
                const snap = await ref.get();
                if (snap.exists) {
                    const data = snap.data() || {};
                    const existingQty = Number(data.quantity ?? data.quantify ?? 0) || 0;
                    const newQty = existingQty + qty;
                    const updateBody = { quantity: newQty, quantify: newQty, updatedAt: admin.firestore.FieldValue.serverTimestamp(), url: it.url || data.url || "", name: it.name || data.name || "", image: it.image || data.image || "", price: typeof it.price === "number" ? it.price : (data.price ?? null), priceTax: typeof it.priceTax === "number" ? it.priceTax : (data.priceTax ?? null), source: "auto-subscription" };
                    if (dry)
                        console.log("[DRY RUN] would update cart doc:", ref.path, JSON.stringify(updateBody));
                    else {
                        await ref.set(updateBody, { merge: true });
                        if (debug)
                            console.log(`[DEBUG] updated cart doc=${ref.path} quantity=${newQty}`);
                    }
                    wrote++;
                }
                else {
                    const body = { createdAt: admin.firestore.FieldValue.serverTimestamp(), quantity: qty, quantify: qty, url: it.url || "", name: it.name || "", image: it.image || "", price: typeof it.price === "number" ? it.price : null, priceTax: typeof it.priceTax === "number" ? it.priceTax : null, source: "auto-subscription" };
                    if (dry)
                        console.log("[DRY RUN] would create cart doc:", col.doc(docId).path, JSON.stringify(body));
                    else {
                        await col.doc(docId).set(body, { merge: true });
                        if (debug)
                            console.log(`[DEBUG] created cart doc=${col.doc(docId).path}`);
                    }
                    wrote++;
                }
            }
            else {
                const body = { createdAt: admin.firestore.FieldValue.serverTimestamp(), quantity: qty, quantify: qty, url: it.url || "", name: it.name || "", image: it.image || "", price: typeof it.price === "number" ? it.price : null, priceTax: typeof it.priceTax === "number" ? it.priceTax : null, source: "auto-subscription" };
                if (dry)
                    console.log("[DRY RUN] would add cart doc (auto-id):", JSON.stringify(body));
                else {
                    await col.add(body);
                    if (debug)
                        console.log("[DEBUG] added cart doc (auto-id)");
                }
                wrote++;
            }
        }
    }
    return wrote;
}
function parseArgs() {
    const argv = process.argv.slice(2);
    const get = (k, d = "") => { const i = argv.indexOf(k); return i >= 0 ? String(argv[i + 1]) : d; };
    const has = (k) => argv.includes(k);
    return { cred: get("--cred", process.env.GOOGLE_APPLICATION_CREDENTIALS || ""), days: Number(get("--days", "30")) || 30, dry: has("--dry"), debug: has("--debug"), explain: has("--explain"), limit: Number(get("--limit", "0")) || undefined, delayMs: Number(get("--delay-ms", "200")) || 200, uid: get("--uid", "") || undefined, includeNever: has("--include-never"), forceAdd: has("--force-add") };
}
async function getUserIdsWithSubscriptions(db, limit, debug = false, uid) {
    if (uid) {
        const doc = await db.collection("users").doc(uid).get();
        if (!doc.exists) {
            if (debug)
                console.log(`[DEBUG] user ${uid} does not exist`);
            return [];
        }
        const subsSnap = await db.collection(`users/${uid}/subscriptions`).limit(1).get();
        if (subsSnap.empty) {
            if (debug)
                console.log(`[DEBUG] user ${uid} has no subscriptions`);
            return [];
        }
        return [uid];
    }
    const ids = [];
    const coll = db.collection("users");
    const snap = await coll.get();
    for (const doc of snap.docs) {
        const uidDoc = doc.id;
        const subsSnap = await db.collection(`users/${uidDoc}/subscriptions`).limit(1).get();
        if (!subsSnap.empty) {
            ids.push(uidDoc);
            if (debug)
                console.log(`[DEBUG] will process user=${uidDoc}`);
            if (limit && ids.length >= limit)
                break;
        }
    }
    return ids;
}
(async () => {
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
            const lastMap = await buildLastBoughtMap(db, `users/${uid}/history`, args.debug, args.explain);
            if (args.debug)
                console.log("[DEBUG] lastMap sample keys:", Array.from(lastMap.keys()).slice(0, 50));
            const bundles = await collectDueItems(db, `users/${uid}/subscriptions`, lastMap, args.days, args.debug, args.explain, !!args.includeNever);
            if (bundles.length === 0)
                console.log("[INFO] no due items for user:", uid);
            else {
                if (args.debug)
                    console.log("[DEBUG] bundles to write:", JSON.stringify(bundles, null, 2));
                const wrote = await writePurchase(db, uid, bundles, args.dry, args.debug, !!args.forceAdd);
                console.log(`[INFO] user=${uid} wrote=${wrote}`);
                totalAdded += wrote;
            }
        }
        catch (e) {
            console.error(`[ERROR] user=${uid} ->`, e && e.stack ? e.stack : e);
        }
        if (args.delayMs)
            await new Promise((r) => setTimeout(r, args.delayMs));
    }
    console.log(`\nDone. users_processed=${totalProcessed} total_added=${totalAdded} (dry=${args.dry})`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
