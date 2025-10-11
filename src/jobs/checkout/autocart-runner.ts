/* eslint-disable @typescript-eslint/no-explicit-any */
// src/jobs/checkout/autocart-runner.ts
// 最終完成版 — 全ユーザー向け auto-cart runner
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

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
  rawobj?: any;
  [k: string]: any;
};

type HistItem = {
  id?: any;
  url?: string;
  name?: string;
  quantity?: number;
  timeStamp?: any;
  timestamp?: any;
  rawobj?: any;
  [k: string]: any;
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
  target?: "cart" | "purchase";
};

const DAY_MS = 86400000;

function toDateAny(v: any): Date | null {
  if (!v) return null;
  if (typeof v === "object" && typeof v.toDate === "function") return v.toDate();
  if (typeof v === "object" && (typeof v._seconds === "number" || typeof v.seconds === "number")) {
    const secs = (v._seconds ?? v.seconds) as number;
    const nanos = (v._nanoseconds ?? v.nanoseconds ?? 0) as number;
    return new Date(secs * 1000 + Math.floor(nanos / 1e6));
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

function initAdmin(credPath?: string) {
  let resolved = "";
  try {
	if (credPath.startsWith("~")) {
		resolved = path.join(os.homedir(), credPath.slice(1));
	} else {
		resolved = path.resolve(credPath);
	}
  } catch {
    // ignore, we'll try default init
  }
  if (resolved && fs.existsSync(resolved)) {
    const sa = JSON.parse(fs.readFileSync(resolved, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id,
    });
    process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT = sa.project_id;
    return admin.firestore();
  }
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath && fs.existsSync(envPath)) {
    admin.initializeApp();
    return admin.firestore();
  }
  throw new Error(
    "No credentials provided. Set --cred <sa.json> (absolute or with ~) or export GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON."
  );
}

/**
 * Try to find a history collection/doc in flexible ways:
 * - If histPath points to a collection and it's non-empty -> use it
 * - If histPath points to a doc and it exists -> use it as single doc
 * - If collection empty, list parent doc's subcollections and try to find a collection that holds items or docs.
 * - Returns array of document snapshots (docs to iterate)
 */
async function resolveHistoryDocs(db: admin.firestore.Firestore, histPath: string, debug = false) {
  const segs = histPath.split("/").filter(Boolean);
  if (segs.length === 0) return [];

  // If path length odd => collection
  if (segs.length % 2 === 1) {
    const colRef = db.collection(histPath);
    try {
      const snap = await colRef.get();
      if (snap.size > 0) {
        if (debug) console.log("[DEBUG] found history collection:", histPath, "docs=", snap.size);
        return snap.docs;
      }
    } catch (e) {
      if (debug) console.log("[DEBUG] collection read failed, trying direct get:", e && e.message);
      try {
        const snap = await colRef.get();
        if (snap.size > 0) return snap.docs;
      } catch {}
    }

    // fallback: collection empty — look at parent doc's subcollections to find history-like collections
    const parentPath = segs.slice(0, -1).join("/");
    const parentDocRef = db.doc(parentPath);
    try {
      const subcols = await parentDocRef.listCollections();
      if (debug) console.log("[DEBUG] parent has subcollections:", subcols.map((c) => c.id));
      // prioritize a subcollection literally named 'history'
      const histCol = subcols.find((c) => c.id === segs[segs.length - 1]) || subcols.find((c) => c.id.toLowerCase().includes("history"));
      if (histCol) {
        const snap = await histCol.get();
        if (snap.size > 0) {
          if (debug) console.log("[DEBUG] found history in parent subcollection:", histCol.id, "docs=", snap.size);
          return snap.docs;
        }
      }
      // if none directly, scan subcollections to find any doc that has items[]
      for (const c of subcols) {
        const snap = await c.limit(5).get();
        for (const d of snap.docs) {
          const dd = d.data() || {};
          if (Array.isArray((dd as any).items) && (dd as any).items.length > 0) {
            if (debug) console.log("[DEBUG] found history-like doc at", `${parentPath}/${c.id}/${d.id}`);
            return [d];
          }
        }
      }
    } catch (e) {
      if (debug) console.log("[DEBUG] parent.listCollections failed:", e && (e.message || e));
    }

    // ultimately empty
    if (debug) console.log("[DEBUG] history collection empty at", histPath);
    return [];
  } else {
    // path points to a specific doc (even length)
    const docRef = db.doc(histPath);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      if (debug) console.log("[DEBUG] found history doc:", histPath);
      return [docSnap as admin.firestore.QueryDocumentSnapshot];
    }
    // fallback: maybe 'history' exists as subcollection under that doc; attempt to find subcollections
    try {
      const subcols = await docRef.listCollections();
      for (const c of subcols) {
        const snap = await c.get();
        if (snap.size > 0) {
          if (debug) console.log("[DEBUG] found history as subcollection under doc:", histPath, "->", c.id);
          return snap.docs;
        }
      }
    } catch (e) {
      if (debug) console.log("[DEBUG] doc.listCollections failed:", e && e.message);
    }
    if (debug) console.log("[DEBUG] history doc not found at", histPath);
    return [];
  }
}

async function buildLastBoughtMap(db: admin.firestore.Firestore, histPath: string, debug = false, explain = false) {
  const map = new Map<string, Date>();
  const docs = await resolveHistoryDocs(db, histPath, debug);
  if (!docs || docs.length === 0) {
    if (debug) console.log("[DEBUG] resolveHistoryDocs returned no docs for", histPath);
    return map;
  }

  for (const d of docs) {
    const data = d.data() || {};

    const docTs =
      toDateAny((data as any).createdAt) ||
      toDateAny((data as any).created_at) ||
      toDateAny((data as any).timeStamp) ||
      (d.createTime ? d.createTime.toDate() : null);

    // normalize items array similarly to before
    let items: HistItem[] = [];
    if (Array.isArray((data as any).items)) {
      items = (data as any).items;
    } else if ((data as any).items && typeof (data as any).items === "object") {
      try {
        items = Object.values((data as any).items) as HistItem[];
      } catch {
        items = [];
      }
    } else {
      // maybe doc itself is an item
      if ((data as any).id || (data as any).url || (data as any).name || (data as any).rawobj || (data as any).timeStamp) {
        items = [data as HistItem];
      }
    }

    if (debug) console.log("[DEBUG] history doc items:", items.length, "docId=", d.id);

    for (let it of items) {
      if (it && typeof (it as any).rawobj === "string") {
        try {
          const parsed = JSON.parse((it as any).rawobj);
          it = { ...it, ...parsed };
        } catch (e) {
          if (debug) console.log("[DEBUG] rawobj parse failed:", e && e.message);
        }
      } else if (it && typeof (it as any).rawobj === "object") {
        it = { ...it, ...((it as any).rawobj || {}) };
      }

      const itemTs =
        toDateAny((it as any).timeStamp) ||
        toDateAny((it as any).timestamp) ||
        toDateAny((it as any).createdAt) ||
        null;

      const usedTs = itemTs || docTs;
      if (!usedTs) {
        if (explain) {
          const nm = (it && (it.name || it.url || it.id)) || "(no-name)";
          console.log(`[EXPLAIN] hist item "${nm}" -> no timestamp found`);
        }
        continue;
      }

      if (explain) {
        const nm = it && (it.name || it.url || it.id) ? (it.name || it.url || String(it.id)) : "(no-name)";
        const via = itemTs ? "item.timeStamp" : docTs ? "doc.createdAt" : "doc.createTime";
        console.log(`[EXPLAIN] hist item "${nm}" -> ${usedTs.toISOString().slice(0, 10)} via=${via}`);
      }

      const key = stableKeyFrom(it);
      const prev = map.get(key);
      if (!prev || prev < usedTs) map.set(key, usedTs);
    }
  }

  if (debug) {
    console.log("[DEBUG] lastBought keys:", map.size);
    if (map.size > 0) {
      const sample = Array.from(map.keys()).slice(0, 12);
      console.log("[DEBUG] lastBought keys (sample):", sample);
    }
  }
  return map;
}

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

    for (const itRaw of items) {
      let it: any = itRaw;
      if (it && typeof it.rawobj === "string") {
        try {
          const parsed = JSON.parse(it.rawobj);
          it = { ...it, ...parsed };
        } catch {}
      } else if (it && typeof it.rawobj === "object") {
        it = { ...it, ...it.rawobj };
      }

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
      const itemId = normalizeId(it.id, it.url) || String(Math.random()).slice(2, 8);
      const docPath = `users/${uid}/cart/${itemId}`;
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

async function writePurchaseCollection(
  db: admin.firestore.Firestore,
  uid: string,
  purchasePath: string,
  bundles: Array<{ subId: string; items: SubItem[]; dueInfo: Array<{ key: string; last: Date; daysSince: number; threshold: number }> }>,
  dry: boolean,
  debug = false
) {
  if (!bundles.length) return 0;
  const col = db.collection(purchasePath);
  let wrote = 0;
  for (const b of bundles) {
    const outItems = b.items.map((it) => ({
      id: normalizeId(it.id, it.url),
      url: it.url || "",
      name: it.name || "",
      image: it.image || "",
      price: typeof (it as any).price === "number" ? (it as any).price : null,
      priceTax: typeof (it as any).priceTax === "number" ? (it as any).priceTax : null,
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
        lastPurchasedAt: admin.firestore.Timestamp.fromDate(x.last),
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
    target: (get("--target", "cart") as "cart" | "purchase") || "cart",
  };
}

async function main() {
  const args = parseArgs();
  const db = initAdmin(args.cred);

  console.log(
    "[INFO] starting autocart-runner ***",
    { dry: args.dry, days: args.days, limit: args.limit, delayMs: args.delayMs, uid: args.uid, target: args.target },
    "***"
  );

  const uids: string[] = [];
  if (args.uid) {
    uids.push(args.uid);
  } else {
    const coll = db.collection("users");
    const snap = await coll.get();
    for (const doc of snap.docs) {
      const uid = doc.id;
      const subsSnap = await db.collection(`users/${uid}/subscriptions`).limit(1).get();
      if (!subsSnap.empty) {
        uids.push(uid);
        if (args.limit && uids.length >= args.limit) break;
      }
    }
  }

  console.log(`[INFO] users to process: ${uids.length}`);

  let totalAdded = 0;
  let totalProcessed = 0;

  for (const uid of uids) {
    totalProcessed++;
    console.log(`\n--- Processing uid=${uid} (${totalProcessed}/${uids.length}) ---`);
    try {
      const histPath = args.histPath && args.histPath.trim() ? args.histPath : `users/${uid}/history`;
      if (args.debug) console.log("[DEBUG] using histPath:", histPath);
      const lastMap = await buildLastBoughtMap(db, histPath, args.debug, args.explain);
      if (args.debug && lastMap.size === 0) {
        console.log("[DEBUG] lastBought map size = 0 - check histPath and rawobj timestamp formats.");
      }
      const bundles = await collectDueItems(db, `users/${uid}/subscriptions`, lastMap, args.days, args.debug, args.explain);
      if (!bundles.length) {
        console.log("[INFO] no due items for user:", uid);
      } else {
        let wrote = 0;
        if (args.target === "cart") {
          wrote = await writeToCart(db, uid, bundles, args.dry, args.debug);
        } else {
          wrote = await writePurchaseCollection(db, uid, `users/${uid}/purchase`, bundles, args.dry, args.debug);
        }
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
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
