// post api cart

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from "@/lib/middleware";
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import foodData from '@/data/foodData.json'

const db = getFirestore();

export const GET = withAuth(async (_req: NextRequest, uid: string) => {
	const snapshot = await db
		.collection("users")
		.doc(uid)
		.collection("cart")
		.get();

	// snapshotの格納
	// オブジェクトだから()で囲む
	const items = snapshot.docs.map((doc) => ({
		id: doc.id,
		...doc.data()
	}));

	// name, price, imgeUrlをfoodData.jsonから加える
	const mergedItems = items.map(item => {
		const food = foodData.find(f => f.id === item.id);
		return food
			? { ...item, name: food.name, price: food.priceTax, imgUrl: food.url }
			: { ...item, name: "no Name", price: 0, imgUrl: "" };
	});

	return NextResponse.json(items);
});

export const POST = withAuth(async (req: NextRequest, uid: string) => {
	try {
		const items = await req.json();

		const batch = db.batch();
		const cartRef = db.collection("users").doc(uid).collection("cart");

		for (const item of items) {
			const docRef = cartRef.doc(item.id);
			batch.set(
				docRef,
				{ quantity: FieldValue.increment(item.quantity) }
			)
		}
		await batch.commit();

		// idとquantityのみ追加
		return NextResponse.json({ msg: "success" })
	} catch (error) {
		return NextResponse.json({ error: "Failed to add cart" }, {status: 500});

	}
});
