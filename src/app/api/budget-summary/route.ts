// 予算、残額、使用率のみ返す
// うめ

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { adminDb as db } from '@/lib/firebaseAdmin';
import foodData from '@/data/foodData.json';

function getPriceById(id: string): number {
    const f = (foodData as any[]).find((x) => x.id === id);
    return f ? Number(f.priceTax) || 0 : 0;
}

export const GET = withAuth(async (_req: NextRequest, uid: string) => {
    // ユーザー 予算:monthlyBudgetを参照
    const userDoc = await db.doc(`users/${uid}/userInformation/profile`).get();
    const udata: any = userDoc.data() || {};
    const budget = Number(udata.monthlyBudget) || 0;

    // 履歴は users/{uid}/history 配下の全ドキュメントを単純合算
	// あとで時間でフィルタを追加する
    const histSnap = await db.collection(`users/${uid}/history`).get();
    let spent = 0;

    for (const doc of histSnap.docs) {
        const data: any = doc.data() || {};

        const pid = String(data.id ?? doc.id);
        const price = Number(data.price);
        const qty = Number(data.quantity ?? 1);
        const unit = Number.isFinite(price) && price > 0 ? price : getPriceById(pid);
        const q = Number.isFinite(qty) && qty > 0 ? qty : 1;
        spent += unit * q;
    }

    const remainingAmount = budget - spent;
    const usageRate = budget > 0 ? Math.min(100, Math.round((spent * 100) / budget)) : 0;

    return NextResponse.json({ budget, remainingAmount, usageRate });
});
