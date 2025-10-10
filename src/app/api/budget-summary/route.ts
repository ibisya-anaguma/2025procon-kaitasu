// うめ
// 予算のまとめ、予算、残り金額、使用率の3つを返す
// 後でリファクタリング予定

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { adminDb as db } from '@/lib/firebaseAdmin';

function getNowJstYmd() {
    const t = new Date(Date.now() + 9 * 60 * 60 * 1000); // 擬似的に+9h
    return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
}

function lastDayOfMonth(year: number, month0: number) {
    return new Date(year, month0 + 1, 0).getDate();
}

function clampDay(year: number, month0: number, day: number) {
    const last = lastDayOfMonth(year, month0);
    if (day < 1) return 1;
    if (day > last) return last;
    return day;
}

function jstMidnight(y: number, m0: number, d: number) {
    return new Date(Date.UTC(y, m0, d, -9, 0, 0, 0));
}

function getCurrentPeriod(resetDayRaw: number) {
    const resetDay = Number.isInteger(resetDayRaw) ? (resetDayRaw as number) : 1;
    const { y, m, d } = getNowJstYmd();

    const thisMonthReset = clampDay(y, m, resetDay);

    let startY = y, startM = m, startD = thisMonthReset;
    let endY = y, endM = m, endD = thisMonthReset;

    if (d >= thisMonthReset) {
        startY = y; startM = m; startD = thisMonthReset;
        // 来月
        const nm = m + 1;
        endY = y + Math.floor(nm / 12);
        endM = nm % 12;
        endD = clampDay(endY, endM, resetDay);
    } else {
        // 先月のresetDayから今月のresetDay
        const pm = m - 1;
        startY = y + (pm < 0 ? -1 : 0);
        startM = (pm + 12) % 12;
        startD = clampDay(startY, startM, resetDay);

        endY = y; endM = m; endD = thisMonthReset;
    }

    const start = jstMidnight(startY, startM, startD);
    const end = jstMidnight(endY, endM, endD);
    return { start, end };
}

function toDateMaybe(v: any): Date | null {
    if (!v) return null;
    if (typeof v === 'object' && typeof v.toDate === 'function') {
        try { return v.toDate(); } catch { /* noop */ }
    }
    if (typeof v === 'object' && typeof v._seconds === 'number') {
        return new Date(v._seconds * 1000);
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

export const GET = withAuth(async (_req: NextRequest, uid: string) => {
    const userDoc = await db.doc(`users/${uid}`).get();
    const ui = (userDoc.data() as any)?.userInformation || {};
    const monthlyBudgetRaw = ui?.monthlyBudget;
    const resetDayRaw = ui?.resetDay ?? 1;

    const budget = Number(monthlyBudgetRaw);
    const validBudget = Number.isFinite(budget) && budget >= 0 ? Math.floor(budget) : 0;

    const { start, end } = getCurrentPeriod(Number(resetDayRaw) || 1);

    const histSnap = await db.collection(`users/${uid}/history`).get();

    let spent = 0;
    for (const doc of histSnap.docs) {
        const data: any = doc.data() || {};
        const items: any[] = Array.isArray(data.items) ? data.items : [];
        for (const it of items) {
            const ts = toDateMaybe(it?.timeStamp ?? it?.timestamp);
            if (!ts) continue;
            if (ts < start || ts >= end) continue;

            const price = Number(it?.price);
            const qty = Number(it?.quantity ?? 1);
            if (!Number.isFinite(price) || price < 0) continue;
            const q = Number.isFinite(qty) && qty > 0 ? qty : 1;
            spent += price * q;
        }
    }

    const remainingAmount = validBudget > 0 ? Math.max(0, validBudget - spent) : 0;
    const usageRate = validBudget > 0
        ? Math.min(100, Math.round((spent / validBudget) * 1000) / 10)
        : 0;

    return NextResponse.json({
        budget: validBudget,
        remainingAmount,
        usageRate,
    });
});
