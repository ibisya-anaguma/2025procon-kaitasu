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
    // ユーザー予算: users/{uid} 直下の monthlyBudget を参照（他APIと整合）
    const userDoc = await db.collection('users').doc(uid).get();
    const udata: any = userDoc.data() || {};
    const budget = Number(udata.monthlyBudget) || 0;

    // 履歴は users/{uid}/history 配下の全ドキュメントを単純合算
	// あとで時間でフィルタを追加する
    const histSnap = await db.collection(`users/${uid}/history`).get();
    let spent = 0;

    for (const doc of histSnap.docs) {
        const data: any = doc.data() || {};
        const items: any[] = Array.isArray(data.items) ? data.items : [];

        for (const it of items) {
            const pid = String(it?.id ?? '');
            const price = Number(it?.price);
            const qty = Number(it?.quantity ?? 1);
            const unit = Number.isFinite(price) && price > 0 ? price : getPriceById(pid);
            const q = Number.isFinite(qty) && qty > 0 ? qty : 1;
            spent += unit * q;
        }
    }

    const remainingAmount = budget - spent;
    const usageRate = budget > 0 ? Math.min(100, Math.round((spent * 100) / budget)) : 0;

    return NextResponse.json({ budget, remainingAmount, usageRate });
});
