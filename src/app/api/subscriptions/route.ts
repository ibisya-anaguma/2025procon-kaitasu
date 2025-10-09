import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { withAuth } from '@/lib/middleware';
import { getCollection, addFoodDetails, postCollection } from '@/lib/apiUtils'

const db = getFirestore();
const collection = "subscriptions";

export const GET = withAuth(async (_req: NextRequest, uid: string) => {
	items = getCollection(uid, collection);
	mergedItems = addFoodDetails(items);
	return NextResponse.json(mergedItems);
});

export const POST = withAuth(async (req: NextRequest, uid: string) => {
	try {
		const items = await req.json();
		postCollection(uid, collection, items);
		return NextResponse.json({ msg: "success" })
	} catch (error) {
		return NextResponse.json({ error: `Failed to add ${collection}` }, {status: 500});
	}
});
