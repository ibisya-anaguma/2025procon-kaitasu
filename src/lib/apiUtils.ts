// API で共通的に利用する Firestore 周りのユーティリティ
// うめ + 整理

import foodData from "@/data/foodData.json";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export type FirestoreCollection = "cart" | "subscriptions" | "favorites" | string;

export type PatchableData = {
  quantity?: number;
  frequency?: number;
};

// users/{uid}/{collection} 配下の全ドキュメントを取得
export async function getCollection(uid: string, collection: FirestoreCollection) {
  const snapshot = await adminDb
    .collection("users")
    .doc(uid)
    .collection(collection)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}

// foodData.json の name / price / imgUrl を付与
export function addFoodDetails<T extends { id: string }>(items: T[]) {
  return items.map((item) => {
    const food = foodData.find((f) => f.id === item.id);
    if (!food) {
      console.warn(`[addFoodDetails] Food not found for id: ${item.id}`);
      return { ...item, name: "no Name", price: 0, imgUrl: "" };
    }

    return {
      ...item,
      name: food.name,
      price: food.priceTax,
      imgUrl: food.imgUrl
    };
  });
}

export type PostCollectionItem = {
  id: string;
  quantity?: number;
  frequency?: number;
};

export async function postCollection(
  uid: string,
  collection: FirestoreCollection,
  items: PostCollectionItem | PostCollectionItem[]
) {
  const data = Array.isArray(items) ? items : [items];
  if (data.length === 0) return;

  const collectionRef = adminDb.collection("users").doc(uid).collection(collection);
  const batch = adminDb.batch();
  let hasWrites = false;

  data.forEach(({ id, quantity, frequency }) => {
    if (!id) return;
    const docRef = collectionRef.doc(id);
    const update: Record<string, unknown> = {};

    if (typeof quantity === "number") {
      update.quantity = FieldValue.increment(quantity);
    }

    if (typeof frequency === "number") {
      update.frequency = frequency;
    }

    if (Object.keys(update).length === 0) {
      // 何も更新内容がなければ空 set を送らない
      return;
    }

    batch.set(docRef, update, { merge: true });
    hasWrites = true;
  });

  if (!hasWrites) {
    return;
  }

  await batch.commit();
}

export async function patchCollection(
  uid: string,
  collection: FirestoreCollection,
  itemId: string,
  data: PatchableData
) {
  const docRef = adminDb
    .collection("users")
    .doc(uid)
    .collection(collection)
    .doc(itemId);

  await docRef.set(data, { merge: true });
}

export async function deleteCollection(
  uid: string,
  collection: FirestoreCollection,
  itemId: string
) {
  const docRef = adminDb
    .collection("users")
    .doc(uid)
    .collection(collection)
    .doc(itemId);

  await docRef.delete();
}
