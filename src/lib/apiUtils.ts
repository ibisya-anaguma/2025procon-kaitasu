// apiで使う、共通処理をまとめとくよ
// うめ

import foodData from '@/data/foodData.json'
import { FieldValue } from "firebase-admin/firestore";
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
	const mergedItems = items.map(item => {
		const food = foodData.find(f => f.id === item.id);
		return food
			? { ...item, name: food.name, price: food.priceTax, imgUrl: food.url }
			: { ...item, name: "no Name", price: 0, imgUrl: "" };
	});
	return mergedItems;
}

// postKey
export async function postCollection (
	uid:string,
	collection: string,
	// 配列でもOKにする
	items: { id: string; quantity?: number; frequency?: number } | Array<{ id: string; quantity?: number; frequency?: number }>
) {
	const arr = Array.isArray(items) ? items : [items];
	const cartRef = db.collection("users").doc(uid).collection(collection);

    const batch = db.batch();

	// idとquantity, frequencyのみ追加
	for (const item of arr) {
	        const docRef = cartRef.doc(item.id);
			const data: Record<string, any> = {
				quantity: FieldValue.increment(item.quantity ?? 1),
			};

			if (item.frequency !== undefined) {
				data.frequency = item.frequency;
			}

			batch.set(docRef, data, { merge: true });

	}
	await batch.commit();
}

// patch処理、quantity以外にも対応
export async function patchCollection(
  uid: string,
  collection: string,
  itemId: string,
  data: {
    quantity?: number;
    frequency?: number;
  }
) {
  const ref = db.collection("users").doc(uid).collection(collection).doc(itemId);
  await ref.set(data, { merge: true });
}

export async function deleteCollection(
  uid: string,
  collection: string,
  itemId: string
) {
  const ref = db.collection("users").doc(uid).collection(collection).doc(itemId);
  await ref.delete();
}
