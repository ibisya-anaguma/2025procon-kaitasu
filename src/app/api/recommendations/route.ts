// うめ
// logの出力はAIに任せた

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware";
import { getCollection, addFoodDetails } from "@/lib/apiUtils";
import foodData from "@/data/foodData.json";

const MAX_RECOMMEND = 5;

type FirestoreTimestamp = {
	_seconds: number;
	_nanoseconds: number;
};

type HistoryItem = {
    id: string;
	timeStamp: FirestoreTimestamp;
    [key: string]: any; // 不明なプロパティを許容
};

// firestoreのタイムスタンプをミリ秒に変換する
function flattenAndonvertHistory(
	nestedHistory: any[]
): FlatHistoryItem[] {
	const flatHistory: FlatHistoryItem[] = [];

	for (const order of nestedHistory) {
		if (!Array.isArray(order.items)) continue;

		for (const item of order.items) {
			const ts: FirestoreTimestamp = item.timeStamp;

			if (typeof ts?._seconds !== 'number' || typeof ts?._nanoseconds !== 'number') {
				continue;
			}
			const milliseconds = (ts._seconds * 1000) + (ts._nanoseconds / 1_000_000);
			
			flatHistory.push({
				id: item.id,
				purchaseTime: milliseconds,
			});
		}
	}

	return flatHistory.sort((a, b) => a.purchaseTime - b.purchaseTime);
}

function predictFromFrequency(
	history: any[],
    limit = MAX_RECOMMEND
): number[] {
	const flatHistory = flattenAndConvertHistory(history);

	// id, timestamp
	const pos = new Map<number, number[]>();
	for (const h of flatHistory) {
		const id = h.id;
		if (!pos.has(id)) {
			pos.set(id, []);
		}
		pos.get(id)!.push(h.purchaseTime); 
	}

	const predictions = new Map<number, number>();
	const now = Date.now();

	for (const [id, timestamps] of pos.entries()) {
		if (timestamps.length < 2) {
			// 購入回数が1回以下の商品は間隔予測から除外
			continue;
		}

		let totalInterval = 0;
		// 連続するタイムスタンプ間の差（ミリ秒）を計算
		for (let i = 1; i < timestamps.length; i++) {
			totalInterval += timestamps[i] - timestamps[i - 1];
		}

		const avgInterval = totalInterval / (timestamps.length - 1);
		const lastPurchaseTime = timestamps[timestamps.length - 1];
		// 次回購入予測日
		const predictedTime = lastPurchaseTime + avgInterval;
		predictions.set(id, predictedTime);
	}

	if (predictions.size === 0) {
		return [];
	}

	// ソート
	return [...predictions.entries()]
		.sort((a, b) => {
			const diffA = Math.abs(a[1] - now); 
			const diffB = Math.abs(b[1] - now); 
			return diffA - diffB; // 差の絶対値が小さい順にソート
		})
		.slice(0, limit) 
		.map(([id]) => id);
}

function getRanking(history: HistoryItem[], topN: number): number[] {
    // genre, 出現回数
    const freq = new Map<number, number>();

    for (const h of history) {
        const food = foodData.find((f) => f.id === h.id);
        if (!food || !Array.isArray(food.genres)) continue;
        for (const g of food.genres as number[]) {
            freq.set(g, (freq.get(g) ?? 0) + 1);
        }
    }

    if (freq.size === 0) return [];

    return [...freq.entries()]
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, topN)
        .map(([g]) => g);
}

function randomChoose(selectedIds?: string[], genres?: number[], limit = MAX_RECOMMEND): string[] {
    // foodDataからgenresでフィルタリング
    let candidates = foodData;
    if (genres && genres.length > 0) {
        candidates = foodData.filter((f) => Array.isArray(f.genres) && f.genres.some((g) => genres.includes(g)));
    }

    if (selectedIds && selectedIds.length > 0) {
        candidates = candidates.filter((f) => !selectedIds.includes(f.id));
    }

    // 簡易的なシャッフル
    const shuffled = candidates.slice().sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, limit);

    return chosen.map((f) => f.id);
}

export const GET = withAuth(async (_req: NextRequest, uid: string) =>  {
    let recommendIds: string[] = [];
    const explanations: Array<{ id: string; reason: string; meta?: any }> = [];
	
	// historyを取得
    const history = (await getCollection(uid, "history", 50)) as HistoryItem[];

    console.log("[RECO] uid=", uid, "history_count=", Array.isArray(history) ? history.length : 0);

    if (history.length !== 0) {
        // 1. 購入頻度からの予測
        const freqIds = predictFromFrequency(history.map((h) => h.id));
        console.log("[RECO] frequency_predicted=", freqIds);
        recommendIds.push(...freqIds);
        for (const id of freqIds) explanations.push({ id, reason: "frequency" });

		// 2. 50件の中で、genresランキング1位, 2位からランダム
        const genres: number[] = getRanking(history, 2);
        const genrePickCount = Math.max(0, MAX_RECOMMEND - recommendIds.length);
        const genreIds = randomChoose(undefined, genres, genrePickCount);
        console.log("[RECO] top_genres=", genres, "genre_based_picks=", genreIds);
        recommendIds.push(...genreIds);
        for (const id of genreIds) explanations.push({ id, reason: "genre", meta: { genres } });
		
	} else {
		// 3. もしhistoryがなかったら完全ランダム
        const randIds = randomChoose([], undefined, MAX_RECOMMEND);
        console.log("[RECO] no_history_random_picks=", randIds);
        recommendIds.push(...randIds);
        for (const id of randIds) explanations.push({ id, reason: "random" });
    }

    console.log("[RECO] final_ids=", recommendIds);
    console.log("[RECO] reasons=", explanations);
    const mergedItems = addFoodDetails(recommendIds.map((id) => ({ id })));
    return NextResponse.json(mergedItems);
});
