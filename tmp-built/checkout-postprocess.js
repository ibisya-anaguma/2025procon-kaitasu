"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/scripts/checkout-postprocess.ts
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
function normalizeId(val, url) {
    if (url) {
        const m = String(url).match(/\/(\d{6,})\.html(?:[?#].*)?$/);
        if (m)
            return m[1];
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
        admin.initializeApp();
    }
    return admin.firestore();
}
function parseArgs() {
    const argv = process.argv.slice(2);
    const get = (k, d = "") => {
        const i = argv.indexOf(k);
        return i >= 0 ? String(argv[i + 1]) : d;
    };
    const has = (k) => argv.includes(k);
    const uid = get("--uid");
    if (!uid) {
        console.error("Required: --uid <userId>");
        process.exit(1);
    }
    return {
        cred: get("--cred", process.env.GOOGLE_APPLICATION_CREDENTIALS || ""),
        uid,
        dry: has("--dry"),
        debug: has("--debug"),
        historyDoc: get("--history-doc", "") || undefined,
        purchaseSource: get("--source", "auto-checkout"),
    };
}
async function cartToHistory(db, uid, historyDoc, dry, debug = false, source = "auto-checkout") {
    const cartPath = `users/${uid}/cart`;
    const cartSnap = await db.collection(cartPath).get();
    if (cartSnap.empty) {
        if (debug)
            console.log(`[INFO] cart empty for user=${uid}`);
        return { moved: 0 };
    }
    const items = [];
    let totalPrice = 0;
    for (const d of cartSnap.docs) {
        const data = d.data() || {};
        const qty = Number(data.quantity ?? data.quantify ?? data.qty ?? 1) || 1;
        const price = typeof data.price === "number" ? data.price : Number(data.price || 0) || null;
        const idNormalized = normalizeId(data.id ?? d.id, data.url);
        const out = {
            id: idNormalized || data.id || d.id,
            url: data.url || "",
            name: data.name || "",
            image: data.image || "",
            price,
            priceTax: typeof data.priceTax === "number" ? data.priceTax : null,
            quantity: qty,
            source: data.source || source,
        };
        items.push(out);
        if (price && Number.isFinite(price))
            totalPrice += price * qty;
    }
    const historyBody = {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        movedAt: admin.firestore.FieldValue.serverTimestamp(),
        source,
        uid,
        totalPrice: Math.round((totalPrice + Number.EPSILON) * 100) / 100,
        items,
    };
    if (dry) {
        console.log(`[DRY] would write history for user=${uid}:`);
        console.log(JSON.stringify(historyBody, null, 2));
        console.log(`[DRY] would delete ${cartSnap.size} cart doc(s) under ${cartPath}`);
        return { moved: cartSnap.size };
    }
    if (historyDoc) {
        const docRef = db.doc(`users/${uid}/history/${historyDoc}`);
        const snap = await docRef.get();
        if (!snap.exists) {
            await docRef.set({
                ...historyBody,
                items: items.map((it) => ({ ...it, movedAt: admin.firestore.Timestamp.now() })),
            });
        }
        else {
            const base = snap.data() || {};
            const existingItems = Array.isArray(base.items) ? base.items : [];
            const newItems = existingItems.concat(items.map((it) => ({ ...it, movedAt: admin.firestore.Timestamp.now() })));
            await docRef.set({
                items: newItems,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                totalPrice: Math.round(((Number(base.totalPrice || 0) + totalPrice) + Number.EPSILON) * 100) / 100,
            }, { merge: true });
        }
    }
    else {
        await db.collection(`users/${uid}/history`).add({
            ...historyBody,
            items: items.map((it) => ({ ...it, movedAt: admin.firestore.Timestamp.now() })),
        });
    }
    const batch = db.batch();
    let deleted = 0;
    for (const d of cartSnap.docs) {
        batch.delete(d.ref);
        deleted++;
    }
    await batch.commit();
    if (debug) {
        console.log(`[INFO] moved ${deleted} item(s) from ${cartPath} -> history (user=${uid})`);
    }
    return { moved: deleted };
}
(async () => {
    const args = parseArgs();
    const db = initAdmin(args.cred);
    if (args.debug) {
        console.log("[INFO] args:", { cred: !!args.cred, uid: args.uid, dry: args.dry, historyDoc: args.historyDoc });
        console.log("[INFO] project:", admin.app().options?.projectId || process.env.GOOGLE_CLOUD_PROJECT);
    }
    try {
        const res = await cartToHistory(db, args.uid, args.historyDoc, args.dry, args.debug, args.purchaseSource);
        if (args.debug)
            console.log("[RESULT]", res);
        if (args.dry)
            console.log("Dry run complete. No data was modified.");
        else
            console.log("Done.");
        process.exit(0);
    }
    catch (e) {
        console.error("Error:", e && e.stack ? e.stack : e);
        process.exit(1);
    }
})();
