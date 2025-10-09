/* eslint-disable @typescript-eslint/no-explicit-any */
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
  frequency?: number; // ★ アイテム単位の日数
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
  uid: string;
  cred: string;
  days: number;
  dry: boolean;
  debug: boolean;
  explain: boolean;
  subsPath: string;    // users/{uid}/subscriptions
  histPath: string;    // users/{uid}/history  (または users/{uid}/history/{doc})
  histDoc?: string;    // --history-doc 指定時
  purchasePath: string;// users/{uid}/purchase
  purchaseDoc?: string;// --purchase-doc 指定時（1ドキュメントに追記）
};

// ===== CLI =====
function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string, d = "") => {
    const i = argv.indexOf(k);
    return i >= 0 ? String(argv[i + 1]) : d;
  };
  const has = (k: string) => argv.includes(k);

  const uid = get("--uid");
  if (!uid) {
    console.error(
      "Required: --uid <userId>\n例:\n  npx ts-node roots.ts --uid uid --cred ./sa.json --days 30 --debug --explain"
    );
    process.exit(1);
  }

  const subsPath = get("--subs-path", `users/${uid}/subscriptions`);
  const histDoc  = get("--history-doc", "") || undefined;
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
function initAdmin(credPath?: string) {
  const resolved = credPath ? path.resolve(credPath) : "";
  if (resolved && fs.existsSync(resolved)) {
    const sa = JSON.parse(fs.readFileSync(resolved, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id,
    });
    process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT = sa.project_id;
  } else {
    // application default / environment fallback
    admin.initializeApp();
  }
  return admin.firestore();
}

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
  const m = String(url).match(/\/(\d{8,})\.html(?:[?#].*)?$/);
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

// ===== history 読み（collection でも specific doc でもOK） =====
async function buildLastBoughtMap(db: admin.firestore.Firestore, histPath: string, debug = false, explain=false) {
  const map = new Map<string, Date>(); // key -> lastDate

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
    if (debug) console.log("[DEBUG] history docs:", docs.length);
  } else {
    // single document
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
    // ドキュメントの時刻候補
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
        console.log(`[EXPLAIN] hist item "${nm}" -> ${usedTs.toISOString().slice(0,10)} via=${via}`);
      }

      const key = stableKeyFrom(it);
      const prev = map.get(key);
      if (!prev || prev < usedTs) map.set(key, usedTs);
    }
  }
  if (debug) console.log("[DEBUG] lastBought keys:", map.size);
  return map;
}

// ===== subscriptions 読み & 期日判定（アイテム個別 frequency 対応） =====
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
        continue; // 「最後に買ってから◯日」仕様なので、未購入はスキップ
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

// ===== purchaseDoc の既存 items をキー化（重複防止） =====
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function loadExistingCartKeys(
  db: admin.firestore.Firestore,
  purchaseDocPath: string,
  debug = false
) {
  const ref = db.doc(purchaseDocPath);
  const snap = await ref.get();
  if (!snap.exists) return new Set<string>();
  const data = snap.data() || {};
  const items: any[] = Array.isArray((data as any).items) ? (data as any).items : [];
  const set = new Set<string>();
  for (const it of items) set.add(stableKeyFrom(it));
  if (debug) console.log("[DEBUG] existing cart keys:", set.size);
  return set;
}

// ===== 書き込み =====
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

  if (purchaseDoc) {
    // 1つの doc に追記
    const docPath = purchasePath; // users/{uid}/purchase/{purchaseDoc}
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
          if (debug) console.log("[DEBUG] SKIP already-in-cart:", it.name || it.url || it.id);
          continue;
        }
        const outItem: any = {
          id: normalizeId(it.id, it.url),
          url: it.url || "",
          name: it.name || "",
          image: it.image || "",
          price: typeof (it as any).price === "number" ? (it as any).price : null,
          priceTax: typeof (it as any).priceTax === "number" ? (it as any).priceTax : null,
          quantity: intQty((it as any).quantity ?? (it as any).qty ?? 1, 1),
          genre: (it as any).genre ?? null,
          // frequency は参考として残す（次回以降のUIで利用できる）
          frequency: typeof (it as any).frequency === "number" ? (it as any).frequency : null,
        };
        toAppend.push(outItem);
        existing.add(key);
      }
    }

    if (!toAppend.length) {
      if (debug) console.log("no new items (already in cart). nothing to add.");
      return 0;
    }

    const updateBody: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "auto-subscription",
    };
    // items 配列に追記（配列結合）
    updateBody.items = [...currentItems, ...toAppend];

    if (dry) {
      if (debug) console.log("[DRY RUN] would update:", docPath, JSON.stringify(updateBody, null, 2));
      return toAppend.length;
    }
    await ref.set(updateBody, { merge: true });
    if (debug) console.log(`added ${toAppend.length} item(s) to ${docPath}`);
    return toAppend.length;

  } else {
    // コレクションへ doc 追加（1バンドル1ドキュメント）
    const col = db.collection(purchasePath);
    let wrote = 0;

    for (const b of bundles) {
      const outItems = b.items.map((it) => {
        const obj: any = {
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
        return obj;
      });

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
        if (debug) console.log("[DRY RUN] would add:", JSON.stringify(body, null, 2));
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

// ===== main =====
(async () => {
  const args = parseArgs();
  const db = initAdmin(args.cred);

  if (args.debug) {
    const pj = (admin.app().options as any)?.projectId || process.env.GOOGLE_CLOUD_PROJECT;
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
