"use strict";
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
const path = __importStar(require("path"));
// ===== CLI =====
function parseArgs() {
    const argv = process.argv.slice(2);
    const get = (k, d = "") => {
        const i = argv.indexOf(k);
        return i >= 0 ? String(argv[i + 1]) : d;
    };
    const has = (k) => argv.includes(k);
    const uid = get("--uid");
    if (!uid) {
        console.error("Required: --uid <userId>\n例:\n  npx ts-node roots.ts --uid uid --cred ./sa.json --days 30 --debug --explain");
        process.exit(1);
    }
    const subsPath = get("--subs-path", `users/${uid}/subscriptions`);
    const histDoc = get("--history-doc", "") || undefined;
    const histPath = get("--history-path", histDoc ? `users/${uid}/history/${histDoc}` : `users/${uid}/history`);
    const purchaseDoc = get("--purchase-doc", "") || undefined;
    const purchasePath = get("--purchase-path", purchaseDoc ? `users/${uid}/purchase/${purchaseDoc}` : `users/${uid}/purchase`);
    return {
        uid,
        cred: get("--cred", process.env.GOOGLE_APPLICATION_CREDENTIALS || ""),
        days: Number(get("--days", "30")) || 30,
        dry: has("--dry"),
        debug: has("--debug"),
        explain: has("--explain"),
        subsPath,
        histPath,
        histDoc,
        purchasePath,
        purchaseDoc,
    };
}
// ===== Firestore init =====
function initAdmin(credPath) {
    const resolved = credPath ? path.resolve(credPath) : "";
    if (resolved && fs.existsSync(resolved)) {
        const sa = JSON.parse(fs.readFileSync(resolved, "utf8"));
        admin.initializeApp({
            credential: admin.credential.cert(sa),
            projectId: sa.project_id,
        });
        process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT = sa.project_id;
    }
    else {
        // application default / environment fallback
        admin.initializeApp();
    }
    return admin.firestore();
}
// ===== utils =====
const DAY_MS = 86400000;
function toDateAny(v) {
    if (!v)
        return null;
    if (typeof v === "object" && v.toDate)
        return v.toDate();
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}
function intQty(v, def = 1) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}
function idFromUrl(url) {
    if (!url)
        return "";
    const m = String(url).match(/\/(\d{8,})\.html(?:[?#].*)?$/);
    return m ? m[1] : "";
}
function normalizeId(val, url) {
    if (url) {
        const u = idFromUrl(url);
        if (u)
            return u;
    }
    if (typeof val === "string" && /^\d{6,}$/.test(val.trim()))
        return val.trim();
    if (typeof val === "number" && Number.isFinite(val)) {
        const s = String(Math.trunc(val));
        if (/^\d{6,}$/.test(s))
            return s;
    }
    return "";
}
function stableKeyFrom(item) {
    const id = normalizeId(item.id, item.url);
    if (id)
        return `id:${id}`;
    const urlId = idFromUrl(item.url || "");
    if (urlId)
        return `id:${urlId}`;
    if (item.name)
        return `name:${String(item.name).trim().toLowerCase()}`;
    return `row:${Math.random()}`;
}
function daysBetween(a, b) {
    return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}
// ===== history 読み（collection でも specific doc でもOK） =====
async function buildLastBoughtMap(db, histPath, debug = false, explain = false) {
    const map = new Map(); // key -> lastDate
    const pathSegs = histPath.split("/").filter(Boolean);
    let docs;
    if (pathSegs.length % 2 === 1) {
        // collection
        const col = db.collection(histPath);
        let snap;
        try {
            snap = await col.orderBy("createdAt", "asc").get();
        }
        catch {
            snap = await col.get();
        }
        docs = snap.docs;
        if (debug)
            console.log("[DEBUG] history docs:", docs.length);
    }
    else {
        // single document
        const doc = await db.doc(histPath).get();
        if (!doc.exists) {
            if (debug)
                console.log("[DEBUG] history doc NOT FOUND:", histPath);
            return map;
        }
        docs = [doc];
        if (debug)
            console.log("[DEBUG] history doc:", histPath);
    }
    for (const d of docs) {
        const data = d.data() || {};
        // ドキュメントの時刻候補
        const docTs = toDateAny(data.createdAt) ||
            toDateAny(data.created_at) ||
            toDateAny(data.timeStamp) ||
            (d.createTime?.toDate() || null);
        const items = Array.isArray(data.items) ? data.items : [];
        for (const it of items) {
            const itemTs = toDateAny(it.timeStamp) ||
                toDateAny(it.timestamp) ||
                toDateAny(it.createdAt) ||
                null;
            const usedTs = itemTs || docTs;
            if (!usedTs)
                continue;
            if (explain) {
                const nm = it.name || it.url || it.id || "(no-name)";
                const via = itemTs ? "item.timeStamp" : docTs ? "doc.createdAt" : "doc.createTime";
                console.log(`[EXPLAIN] hist item "${nm}" -> ${usedTs.toISOString().slice(0, 10)} via=${via}`);
            }
            const key = stableKeyFrom(it);
            const prev = map.get(key);
            if (!prev || prev < usedTs)
                map.set(key, usedTs);
        }
    }
    if (debug)
        console.log("[DEBUG] lastBought keys:", map.size);
    return map;
}
// ===== subscriptions 読み & 期日判定（アイテム個別 frequency 対応） =====
async function collectDueItems(db, subsPath, lastMap, defaultDays, debug = false, explain = false) {
    const dueByDoc = [];
    const subsSnap = await db.collection(subsPath).get();
    if (debug)
        console.log("[DEBUG] subscriptions docs:", subsSnap.size);
    for (const doc of subsSnap.docs) {
        const data = doc.data() || {};
        const subLevelFreq = Number(data.frequency) || 0;
        const items = Array.isArray(data.items) ? data.items : [];
        const dueItems = [];
        const info = [];
        for (const it of items) {
            const key = stableKeyFrom(it);
            const last = lastMap.get(key);
            if (!last) {
                if (explain) {
                    const nm = it.name || it.url || it.id || "(no-name)";
                    console.log(`[EXPLAIN] ${doc.id} :: ${nm} -> last=N/A => skip (まだ買っていない)`);
                }
                continue; // 「最後に買ってから◯日」仕様なので、未購入はスキップ
            }
            const itemFreq = Number(it.frequency) || 0;
            const threshold = itemFreq > 0 ? itemFreq : (subLevelFreq > 0 ? subLevelFreq : defaultDays);
            const daysSince = daysBetween(new Date(), last);
            const nm = it.name || it.url || it.id || "(no-name)";
            if (daysSince >= threshold) {
                if (explain) {
                    console.log(`[EXPLAIN] ${doc.id} :: ${nm} -> last=${last.toISOString().slice(0, 10)} daysSince=${daysSince} threshold=${threshold} => DUE`);
                }
                const add = {
                    ...it,
                    quantity: intQty(it.quantity ?? it.qty ?? 1, 1),
                };
                dueItems.push(add);
                info.push({ key, last, daysSince, threshold });
            }
            else if (explain) {
                console.log(`[EXPLAIN] ${doc.id} :: ${nm} -> last=${last.toISOString().slice(0, 10)} daysSince=${daysSince} threshold=${threshold} => not yet`);
            }
        }
        if (dueItems.length) {
            if (debug)
                console.log(`[DEBUG] due @${doc.id}: ${dueItems.length} items`);
            dueByDoc.push({ subId: doc.id, items: dueItems, dueInfo: info });
        }
    }
    return dueByDoc;
}
// ===== purchaseDoc の既存 items をキー化（重複防止） =====
async function loadExistingCartKeys(db, purchaseDocPath, debug = false) {
    const ref = db.doc(purchaseDocPath);
    const snap = await ref.get();
    if (!snap.exists)
        return new Set();
    const data = snap.data() || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const set = new Set();
    for (const it of items)
        set.add(stableKeyFrom(it));
    if (debug)
        console.log("[DEBUG] existing cart keys:", set.size);
    return set;
}
// ===== 書き込み =====
async function writePurchase(db, uid, purchasePath, purchaseDoc, bundles, dry, debug = false) {
    if (!bundles.length)
        return 0;
    if (purchaseDoc) {
        // 1つの doc に追記
        const docPath = purchasePath; // users/{uid}/purchase/{purchaseDoc}
        const ref = db.doc(docPath);
        const snap = await ref.get();
        const base = snap.exists ? (snap.data() || {}) : {};
        const currentItems = Array.isArray(base.items) ? base.items : [];
        const existing = new Set(currentItems.map((it) => stableKeyFrom(it)));
        const toAppend = [];
        for (const b of bundles) {
            for (const it of b.items) {
                const key = stableKeyFrom(it);
                if (existing.has(key)) {
                    if (debug)
                        console.log("[DEBUG] SKIP already-in-cart:", it.name || it.url || it.id);
                    continue;
                }
                const outItem = {
                    id: normalizeId(it.id, it.url),
                    url: it.url || "",
                    name: it.name || "",
                    image: it.image || "",
                    price: typeof it.price === "number" ? it.price : null,
                    priceTax: typeof it.priceTax === "number" ? it.priceTax : null,
                    quantity: intQty(it.quantity ?? it.qty ?? 1, 1),
                    genre: it.genre ?? null,
                    // frequency は参考として残す（次回以降のUIで利用できる）
                    frequency: typeof it.frequency === "number" ? it.frequency : null,
                };
                toAppend.push(outItem);
                existing.add(key);
            }
        }
        if (!toAppend.length) {
            if (debug)
                console.log("no new items (already in cart). nothing to add.");
            return 0;
        }
        const updateBody = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            source: "auto-subscription",
        };
        // items 配列に追記（配列結合）
        updateBody.items = [...currentItems, ...toAppend];
        if (dry) {
            if (debug)
                console.log("[DRY RUN] would update:", docPath, JSON.stringify(updateBody, null, 2));
            return toAppend.length;
        }
        await ref.set(updateBody, { merge: true });
        if (debug)
            console.log(`added ${toAppend.length} item(s) to ${docPath}`);
        return toAppend.length;
    }
    else {
        // コレクションへ doc 追加（1バンドル1ドキュメント）
        const col = db.collection(purchasePath);
        let wrote = 0;
        for (const b of bundles) {
            const outItems = b.items.map((it) => {
                const obj = {
                    id: normalizeId(it.id, it.url),
                    url: it.url || "",
                    name: it.name || "",
                    image: it.image || "",
                    price: typeof it.price === "number" ? it.price : null,
                    priceTax: typeof it.priceTax === "number" ? it.priceTax : null,
                    quantity: intQty(it.quantity ?? it.qty ?? 1, 1),
                    genre: it.genre ?? null,
                    frequency: typeof it.frequency === "number" ? it.frequency : null,
                };
                return obj;
            });
            const body = {
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
                if (debug)
                    console.log("[DRY RUN] would add:", JSON.stringify(body, null, 2));
                wrote++;
                continue;
            }
            await col.add(body);
            wrote++;
            if (debug)
                console.log(`[DEBUG] wrote purchase doc for sub=${b.subId}, items=${outItems.length}`);
        }
        return wrote;
    }
}
// ===== main =====
(async () => {
    const args = parseArgs();
    const db = initAdmin(args.cred);
    if (args.debug) {
        const pj = admin.app().options?.projectId || process.env.GOOGLE_CLOUD_PROJECT;
        const pdoc = args.purchaseDoc ? ` ${args.purchasePath}` : ` ${args.purchasePath} (collection)`;
        console.log("[INFO] project=%s uid=%s days=%d dry=%s", pj, args.uid, args.days, args.dry);
        console.log("[INFO] paths: subs=%s history=%s purchase=%s", args.subsPath, args.histPath, pdoc);
    }
    const lastMap = await buildLastBoughtMap(db, args.histPath, args.debug, args.explain);
    const bundles = await collectDueItems(db, args.subsPath, lastMap, args.days, args.debug, args.explain);
    const wrote = await writePurchase(db, args.uid, args.purchasePath, args.purchaseDoc, bundles, args.dry, args.debug);
    if (!wrote) {
        console.log("no due items. nothing to add.");
    }
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
