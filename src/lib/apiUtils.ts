// apiで使う、共通処理をまとめとくよ
// うめ

import foodData from '@/data/foodData.json'
import { adminDb as db } from "@/lib/firebaseAdmin";

// users/{uid}/collectionの中の全てのドキュメント取得
export async function getCollection (uid:string, collection: string) {
	const snapshot = await db
		.collection("users")
		.doc(uid)
		.collection(collection)
		.get();

	return snapshot.docs.map((doc) => ({
		id: doc.id,
		...doc.data()
	}));
}

// name, price, imgUrlをfoodData.jsonから加える関数
export function addFoodDetails<T extends { id: string }>(items: T[]) {
	// name, price, imgUrlをfoodData.jsonから加える
	return mergedItems = items.map(item => {
		const food = foodData.find(f => f.id === item.id);
		return food
			? { ...item, name: food.name, price: food.priceTax, imgUrl: food.url }
			: { ...item, name: "no Name", price: 0, imgUrl: "" };
	});
}

// postKey
export async function postCollection (
	uid:string,
	collection: string,
	items: Array<{ id:string; quantity: number }>
) {
	postKey(uid, cart);
	const batch = db.batch();
	const cartRef = db.collection("users").doc(uid).collection("cart");

	// idとquantityのみ追加
	for (const item of items) {
		const docRef = cartRef.doc(item.id);
		batch.set(
			docRef,
			{ quantity: FieldValue.increment(item.quantity) }
		)
	}
	await batch.commit();
}

// patch処理、quantity以外にも対応
export async function patchCollection(
	uid:string,
	collection: string,
	data: {
		quantity?: number;
		frequency?: number;
	}
) {
	const ref = db.collection("users").doc(uid).collection(collection).doc(itemId);
	await ref.set(data, { merge: true });
}

export async function deleteCollection(uid: string, collection: string, itemId: string) {
  const ref = db.collection("users").doc(uid).collection("cart").doc(itemId);
  await ref.delete();
}
