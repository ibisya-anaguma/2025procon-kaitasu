import fs from "fs";
import path from "path";
import express, { type Request, type Response } from "express";
import cors from "cors";
import morgan from "morgan";

// ====== 設定 ======
const PORT = Number(process.env.PORT || 3000);
const PRODUCTS_PATH =
  process.env.PRODUCTS ||
  path.resolve(process.cwd(), "all_products.json"); // カレント直下 all_products.json を読む

// ====== 型 ======
type Product = {
  id: string | number;
  name: string;
  price?: number;
  image?: string;   // all_products.jsonでは image / imgUrl いずれか
  imgUrl?: string;
  genre?: number | string;
  genres?: (number | string)[];
  url?: string;
};

type SearchBody = {
  q?: string | null;
  genre?: number | null;
  favorite?: boolean;
  uid?: string; // 任意: favorite=true を使うなら指定推奨
  limit?: number;
};

// ====== ユーティリティ ======
function normalize(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
function toNum(x: unknown): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
function hasGenre(p: Product, g: number): boolean {
  const list: (number | string)[] = Array.isArray(p.genres)
    ? p.genres
    : p.genre != null
    ? [p.genre]
    : [];
  return list.some((v) => Number(v) === g);
}

// ====== データ読み込み ======
if (!fs.existsSync(PRODUCTS_PATH)) {
  console.error(`products が見つかりません: ${PRODUCTS_PATH}`);
  process.exit(1);
}
const products: Product[] = JSON.parse(
  fs.readFileSync(PRODUCTS_PATH, "utf8")
);

// フィールドゆらぎを吸収（imgUrl / image、数値ID→文字列など）
for (const p of products) {
  (p as any).id = String(p.id ?? "");
  if (!p.imgUrl && (p as any).image) (p as any).imgUrl = (p as any).image;
}

console.log(`search API will use products: ${PRODUCTS_PATH}`);
console.log(`products loaded: ${products.length}`);

// ====== お気に入り（任意） ======
// favorite=true かつ uid 指定 & Firebase Admin が入っていれば
// users/{uid}/favorites の id を取得し、ヒットした商品をブーストする。
async function fetchFavoriteIds(uid: string): Promise<Set<string>> {
  // 環境に firebase-admin が無ければスキップ
  try {
    // 動的 import（未インストールでもここまではエラーにしない）
    const admin = await import("firebase-admin");
    if (!admin.apps.length) {
      // 認証は GOOGLE_APPLICATION_CREDENTIALS or ADC を想定
      admin.initializeApp();
    }
    const db = admin.firestore();
    const col = db.collection(`users/${uid}/favorites`);
    const snap = await col.get();
    const ids = new Set<string>();
    snap.forEach((d) => {
      const data = d.data() || {};
      const id = String(data.id ?? "").trim();
      if (id) ids.add(id);
    });
    return ids;
  } catch {
    // 未設定なら空
    return new Set<string>();
  }
}

// ====== アプリ ======
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

// ヘルスチェック
app.get("/health", (_req, res) => res.send("ok"));

// 検索
app.post("/api/search", async (req: Request, res: Response) => {
  const body: SearchBody = req.body || {};
  const q = normalize(body.q);
  const g = body.genre != null ? toNum(body.genre) : null;
  const favorite = !!body.favorite;
  const uid = body.uid || ""; // 任意
  const limit = Math.min(Math.max(1, Number(body.limit || 50)), 200);

  // 1) キーワードフィルタ
  const tokens = q ? q.split(" ").filter(Boolean) : [];
  let result = products.filter((p) => {
    if (tokens.length) {
      const name = normalize(p.name);
      // すべてのトークンを含む
      const ok = tokens.every((t) => name.includes(t));
      if (!ok) return false;
    }
    if (g != null) {
      if (!hasGenre(p, g)) return false;
    }
    return true;
  });

  // 2) favorite ブースト（任意）
  if (favorite) {
    let favIds = new Set<string>();
    if (uid) {
      favIds = await fetchFavoriteIds(uid);
    }
    if (favIds.size > 0) {
      // お気に入りを先頭に寄せる
      result = result.sort((a, b) => {
        const aFav = favIds.has(String(a.id)) ? 1 : 0;
        const bFav = favIds.has(String(b.id)) ? 1 : 0;
        return bFav - aFav;
      });
    }
  }

  // 3) 整形 + 上限
  const payload = result.slice(0, limit).map((p) => ({
    id: String(p.id),
    name: p.name,
    price: Number((p as any).price ?? 0),
    imgUrl: (p as any).imgUrl || "",
  }));

  // リクエスト/レスポンスをログ（見やすさ重視）
  console.log(
    `[SEARCH] q="${q}" genre=${g ?? "none"} favorite=${favorite} uid=${
      uid || "-"
    } -> ${payload.length} hits`
  );

  res.json(payload);
});

// 起動
app.listen(PORT, () => {
  console.log(`search API listening on http://localhost:${PORT}`);
});