// あらとも
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
};

type HistItem = {
  id?: any;
  url?: string;
  name?: string;
  quantity?: number;
};

type Args = {
  uid: string;
  cred: string;
  days: number;
  dry: boolean;
  debug: boolean;
  subsPath?: string;
  histPath?: string;
  purchasePath?: string;
};

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
	  "Required: --uid <userId>\nExample:\n  npx ts-node roots.ts --uid uid --cred ./sa.json --days 30 --dry --debug"
	);
	process.exit(1);
  }
  const args: Args = {
	uid,
	cred: get("--cred", process.env.GOOGLE_APPLICATION_CREDENTIALS || ""),
	days: Number(get("--days", "30")) || 30,
	dry: has("--dry"),
	debug: has("--debug"),
	subsPath: get("--subs-path", `users/${uid}/subscriptions`),
	histPath: get("--history-path", `users/${uid}/history`),
	purchasePath: get("--purchase-path", `users/${uid}/purchase`),
  };
  return args;
}

// --- Firestore init (projectId を明示) ---
function initAdmin(credPath?: string) {
  const resolved = credPath ? path.resolve(credPath) : "";
  if (resolved && fs.existsSync(resolved)) {
	const sa = JSON.parse(fs.readFileSync(resolved, "utf8"));
	admin.initializeApp({
	  credential: admin.credential.cert(sa),
	  projectId: sa.project_id, // ★重要
	});
	process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT = sa.project_id;
  } else {
	admin.initializeApp();
  }
  return admin.firestore();
}

// --- utils ---
const DAY_MS = 86400000;

function toDateAny(v: any): Date | null {
  if (!v) return null;
  if (v.toDate) return v.toDate();
  const d = new Date(v);
  return isNaN(d as any) ? null : d;
}

function intQty(v: any, def = 1) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

// Aeon商品URL末尾の …/<digits>.html からIDを抽出
function idFromUrl(url?: string): string {
  if (!url) return "";
  const m = String(url).match(/\/(\d{8,})\.html(?:[?#].*)?$/);
  return m ? m[1] : "";
}

// 1.050000036e+25 みたいな指数表記は破棄し、URL由来IDや name でのマッチへ
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
  const uid = idFromUrl(item.url || "");
  if (uid) return `id:${uid}`;
  if (item.name) return `name:${String(item.name).trim().toLowerCase()}`;
  return `row:${Math.random()}`;
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}

// --- history を読み、商品ごとの最終購入日を集計 ---
async function buildLastBoughtMap(db: admin.firestore.Firestore, histPath: string, debug = false) {
  const map = new Map<string, Date>(); // key -> lastDate
  const col = db.collection(histPath);

  let snap: admin.firestore.QuerySnapshot;
  try {
	snap = await col.orderBy("createdAt", "asc").get();
  } catch {
	snap = await col.get();
  }
  if (debug) console.log("[DEBUG] history docs:", snap.size);

  for (const doc of snap.docs) {
	const d = doc.data() || {};
	const ts =
	  toDateAny(d.createdAt) ||
	  toDateAny(d.created_at) ||
	  toDateAny(d.timeStamp) || // ← 画像で見えていたフィールド名にも対応
	  (doc.createTime?.toDate() || null);
	if (!ts) continue;

	const items: HistItem[] = Array.isArray(d.items) ? d.items : [];
	for (const it of items) {
	  const key = stableKeyFrom(it);
	  const prev = map.get(key);
	  if (!prev || prev < ts) map.set(key, ts);
	}
  }
  if (debug) console.log("[DEBUG] lastBought keys:", map.size);
  return map;
}

// --- subscriptions を読み、due 判定 ---
async function collectDueItems(
  db: admin.firestore.Firestore,
  subsPath: string,
  lastMap: Map<string, Date>,
  thresholdDays: number,
  debug = false
) {
  const dueByDoc: Array<{
	subId: string;
	items: SubItem[];
	dueInfo: Array<{ key: string; last: Date; daysSince: number }>;
  }> = [];

  const subsSnap = await db.collection(subsPath).get();
  if (debug) console.log("[DEBUG] subscriptions docs:", subsSnap.size);

  for (const doc of subsSnap.docs) {
	const data = doc.data() || {};
	const items: SubItem[] = Array.isArray(data.items) ? data.items : [];
	const dueItems: SubItem[] = [];
	const info: Array<{ key: string; last: Date; daysSince: number }> = [];

	for (const it of items) {
	  const key = stableKeyFrom(it);
	  const last = lastMap.get(key);
	  if (!last) continue; // 一度も買ってなければスキップ（仕様：最後に買ってから◯日）
	  const daysSince = daysBetween(new Date(), last);
	  if (daysSince >= thresholdDays) {
		dueItems.push({
		  ...it,
		  quantity: intQty(it.quantity ?? (it as any).qty ?? 1, 1),
		});
		info.push({ key, last, daysSince });
	  }
	}

	if (dueItems.length) {
	  if (debug) {
		console.log(
		  `[DEBUG] due @${doc.id}: ${dueItems.length} items (>= ${thresholdDays}d)`
		);
	  }
	  dueByDoc.push({ subId: doc.id, items: dueItems, dueInfo: info });
	}
  }

  return dueByDoc;
}

// --- purchase に書き込み（idempotent） ---
async function writePurchaseDocs(
  db: admin.firestore.Firestore,
  uid: string,
  purchasePath: string,
  bundles: Array<{ subId: string; items: SubItem[]; dueInfo: Array<{ key: string; last: Date; daysSince: number }> }>,
  dry: boolean,
  debug = false
) {
  if (!bundles.length) return 0;

  const col = db.collection(purchasePath);
  let wrote = 0;

  // 1サブスクリプションにつき1ドキュメントで投入
  for (const b of bundles) {
	const today = new Date();
	const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
	  today.getDate()
	).padStart(2, "0")}`;
	const idemKey = `auto-subscription:${b.subId}:${ymd}`;

	// 既に同じ idemKey の書き込みがあるか？
	const existing = await col.where("idemKey", "==", idemKey).limit(1).get();
	if (!existing.empty) {
	  if (debug) console.log(`[DEBUG] skip (idempotent): ${idemKey}`);
	  continue;
	}

	// Firestoreへ書く形（カート投入スクリプトが読めるスキーマ）
	const docBody: any = {
	  createdAt: admin.firestore.FieldValue.serverTimestamp(),
	  source: "auto-subscription",
	  uid,
	  subscriptionId: b.subId,
	  idemKey,
	  items: b.items.map((it) => ({
		id: normalizeId(it.id, it.url),
		url: it.url || "",
		name: it.name || "",
		image: it.image || "",
		price: it.price ?? null,
		priceTax: it.priceTax ?? null,
		quantity: intQty(it.quantity ?? (it as any).qty ?? 1, 1),
		genre: it.genre ?? null,
	  })),
	  meta: b.dueInfo.map((x) => ({
		key: x.key,
		lastPurchasedAt: admin.firestore.Timestamp.fromDate(x.last),
		daysSince: x.daysSince,
	  })),
	};

	if (dry) {
	  wrote++;
	  if (debug) console.log("[DRY RUN] would write:", JSON.stringify(docBody, null, 2));
	  continue;
	}

	await col.add(docBody);
	wrote++;
	if (debug) console.log(`[DEBUG] wrote purchase doc for sub=${b.subId}, items=${b.items.length}`);
  }

  return wrote;
}

// --- main ---
(async () => {
  const args = parseArgs();
  const db = initAdmin(args.cred);

  if (args.debug) {
	const pj = (admin.app().options as any)?.projectId || process.env.GOOGLE_CLOUD_PROJECT;
	console.log("[INFO] project=%s uid=%s days=%d dry=%s", pj, args.uid, args.days, args.dry);
	console.log("[INFO] paths: subs=%s history=%s purchase=%s", args.subsPath, args.histPath, args.purchasePath);
  }

  const lastMap = await buildLastBoughtMap(db, args.histPath!, args.debug);
  const bundles = await collectDueItems(db, args.subsPath!, lastMap, args.days, args.debug);
  const wrote = await writePurchaseDocs(db, args.uid, args.purchasePath!, bundles, args.dry, args.debug);

  console.log(
	wrote
	  ? `added ${wrote} purchase document(s) to ${args.purchasePath}`
	  : "no due items. nothing to add."
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
