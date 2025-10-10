import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

// ====== 設定 ======
const PRODUCTS_PATH = process.env.PRODUCTS
    ? String(process.env.PRODUCTS)
    : path.resolve(process.cwd(), "all_products.json");

// ====== 型 ======
type Product = {
    id: string | number;
    name: string;
    price?: number;
    image?: string; // all_products.jsonでは image / imgUrl いずれか
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

// ====== データ読み込み（モジュール初期化時に一度） ======
let products: Product[] = [];
try {
    if (!fs.existsSync(PRODUCTS_PATH)) {
        console.error(`[search] products が見つかりません: ${PRODUCTS_PATH}`);
    } else {
        products = JSON.parse(fs.readFileSync(PRODUCTS_PATH, "utf8"));
        for (const p of products) {
            (p as any).id = String(p.id ?? "");
            if (!p.imgUrl && (p as any).image) (p as any).imgUrl = (p as any).image;
        }
        console.log(`[search] products loaded: ${products.length} from ${PRODUCTS_PATH}`);
    }
} catch (e) {
    console.error("[search] failed to load products:", e);
    products = [];
}

// ====== お気に入り（任意） ======
// favorite=true かつ uid 指定 & Firebase Admin が入っていれば
// users/{uid}/favorites の id を取得し、ヒットした商品をブーストする。
async function fetchFavoriteIds(uid: string): Promise<Set<string>> {
    try {
        const admin = await import("firebase-admin");
        if (!admin.apps.length) {
            admin.initializeApp(); // GOOGLE_APPLICATION_CREDENTIALS or ADC
        }
        const db = admin.firestore();
        const col = db.collection(`users/${uid}/favorites`);
        const snap = await col.get();
        const ids = new Set<string>();
        snap.forEach((d) => {
            const data = d.data() || {};
            const id = String((data as any).id ?? "").trim();
            if (id) ids.add(id);
        });
        return ids;
    } catch {
        // 未設定なら空
        return new Set<string>();
    }
}

// ====== ルートハンドラ ======
export async function POST(req: NextRequest) {
    const body = (await req.json().catch(() => ({}))) as SearchBody;
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

    console.log(
        `[SEARCH] q="${q}" genre=${g ?? "none"} favorite=${favorite} uid=${uid || "-"} -> ${payload.length} hits`
    );

    return NextResponse.json(payload);
}
