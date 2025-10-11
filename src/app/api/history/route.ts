import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/middleware';
import { getCollection, addFoodDetails } from '@/lib/apiUtils';

// GET /api/history - 購入履歴を取得
export const GET = withAuth(async (_req: NextRequest, uid: string) => {
	const items = await getCollection(uid, "history");
	const mergedItems = addFoodDetails(items);
	return NextResponse.json(mergedItems);
});

