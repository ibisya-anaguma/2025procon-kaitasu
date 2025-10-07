// post api cart
import { NextResponse } from 'next/server';
import { withAuth } from "@/lib/middleware";
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
const db = getFirestore();

export const GET = withAuth(async (_req: NextResponse, uid: setting) => {
	const snapshot = await db
		.collection("users")
		.doc(uid)
		.collection("cart")
		.get();

	// snapshotの格納
	// オブジェクトだから()で囲む
	const items = snapshot.docs.map((doc) => ({
		id: doc.id,
		...doc.data(),
	});

	return NextResponse.json(items);
})

export const POST = withAuth(async (req: NextResponse, uid: setting) => {
	const items = await req.json();

	const batch = db.batch();

	for (let i = 0; i < array.length; i++) {
		const element = array[i];
	}

	await batch.commit();

	// idとquantifyのみ追加
	return NextResponse.json({ ok: true, uid })
}
