import { NextRequest, NextResponse } from 'next/server';
import fs from "fs";
import path from "path";

// ====== 設定 ======
const PRODUCTS_PATH = path.resolve(process.cwd(), "src/jobs/scraper/all_products.json");

// ====== 型 ======
type RawProduct = {
  id?: string | number;
  name: string;
  price?: number | string;
  image?: string;
  imgUrl?: string;
  genre?: number | string;
  genres?: (number | string)[];
  url?: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  image?: string;
  imgUrl: string;
  genre?: number | string;
  genres?: (number | string)[];
  url?: string;
};

type SearchBody = {
  q?: string | null;
  genre?: number | null;
  genres?: number[]; // 複数ジャンル対応
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
let products: Product[] = [];

try {
  if (fs.existsSync(PRODUCTS_PATH)) {
    const rawProducts: RawProduct[] = JSON.parse(
      fs.readFileSync(PRODUCTS_PATH, "utf8")
    );

    products = rawProducts.map((item) => ({
      id: String(item.id ?? ""),
      name: item.name,
      price: typeof item.price === "number" ? item.price : Number(item.price ?? 0),
      image: item.image,
      imgUrl: item.imgUrl ?? item.image ?? "",
      genre: item.genre,
      genres: item.genres,
      url: item.url
    }));

    console.log(`search API will use products: ${PRODUCTS_PATH}`);
    console.log(`products loaded: ${products.length}`);
  } else {
    console.warn(`products file not found: ${PRODUCTS_PATH}`);
    // テスト用のサンプルデータ
    products = [
      {
        id: "sample-1",
        name: "サンプル商品1",
        price: 100,
        imgUrl: "/placeholder.jpg"
      },
      {
        id: "sample-2", 
        name: "サンプル商品2",
        price: 200,
        imgUrl: "/placeholder.jpg"
      }
    ];
  }
} catch (error) {
  console.error('Error loading products:', error);
  products = [];
}

// ====== お気に入り（任意） ======
// favorite=true かつ uid 指定 & Firebase Admin が入っていれば
// users/{uid}/favorites の id を取得し、ヒットした商品をブーストする。
async function fetchFavoriteIds(uid: string): Promise<Set<string>> {
  // テスト用の実装（実際のFirebase実装は後で追加）
  try {
    // テスト用のお気に入りIDを返す
    return new Set<string>(['sample-1']);
  } catch {
    // 未設定なら空
    return new Set<string>();
  }
}

// ====== Next.js API Route ======
export async function POST(request: NextRequest) {
  try {
    const body: SearchBody = await request.json();
    const q = normalize(body.q);
    const g = body.genre != null ? toNum(body.genre) : null;
    const genres = body.genres || [];
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
      // 複数ジャンル対応：genresが指定されている場合はそちらを優先
      if (genres.length > 0) {
        // いずれかのジャンルに一致すればOK
        const matchesAnyGenre = genres.some(genre => hasGenre(p, genre));
        if (!matchesAnyGenre) return false;
      } else if (g != null) {
        // 単一ジャンルの場合
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
      id: p.id,
      name: p.name,
      price: p.price,
      imgUrl: p.imgUrl
    }));

    // リクエスト/レスポンスをログ（見やすさ重視）
    console.log(
      `[SEARCH] q="${q}" genre=${g ?? "none"} genres=${genres.length > 0 ? `[${genres.join(',')}]` : "none"} favorite=${favorite} uid=${
        uid || "-"
      } -> ${payload.length} hits`
    );

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: '検索エラーが発生しました' }, { status: 500 });
  }
}
