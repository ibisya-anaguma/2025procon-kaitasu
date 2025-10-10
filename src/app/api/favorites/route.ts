import { NextRequest, NextResponse } from "next/server";

import { addFoodDetails, getCollection } from "@/lib/apiUtils";
import { adminDb } from "@/lib/firebaseAdmin";
import { withAuth } from "@/lib/middleware";

const COLLECTION_NAME = "favorites" as const;

export const GET = withAuth(async (_req: NextRequest, uid: string) => {
  const items = await getCollection(uid, COLLECTION_NAME);
  
  // Firestoreに商品情報が保存されている場合はそれを使用、なければfoodDataから取得
  const mergedItems = items.map((item: Record<string, unknown>) => {
    // Firestoreに商品情報が保存されている場合
    if (item.name && item.price !== undefined && item.imgUrl) {
      return {
        id: item.id as string,
        name: item.name as string,
        price: item.price as number,
        imgUrl: item.imgUrl as string,
        quantity: (item.quantity as number) || 1
      };
    }
    
    // 保存されていない場合はfoodDataから取得
    const withDetails = addFoodDetails([item as { id: string }])[0];
    
    // 商品情報が見つからない場合はログに出力
    if (withDetails.name === "no Name") {
      console.warn(`[favorites][GET] Product info not found for id: ${item.id}`);
    }
    
    return withDetails;
  });
  
  return NextResponse.json(mergedItems);
});

export const POST = withAuth(async (req: NextRequest, uid: string) => {
  try {
    const body = await req.json();
    const payload = Array.isArray(body) ? body : [body];

    // 商品情報を直接保存する場合
    const db = adminDb;
    const batch = db.batch();
    
    payload.forEach((item: Record<string, unknown>) => {
      const idValue = item?.id;
      const id = typeof idValue === "string" ? idValue : idValue != null ? String(idValue) : "";
      if (!id) return;
      
      const docRef = db.collection("users").doc(uid).collection(COLLECTION_NAME).doc(id);
      
      // 商品情報を保存
      const data: Record<string, unknown> = {
        quantity: typeof item.quantity === "number" ? item.quantity : 1
      };
      
      // 商品情報が提供されている場合は保存
      if (item.name) data.name = item.name;
      if (item.price !== undefined) data.price = item.price;
      if (item.imgUrl) data.imgUrl = item.imgUrl;
      
      batch.set(docRef, data, { merge: true });
    });
    
    await batch.commit();
    return NextResponse.json({ msg: "success" });
  } catch (error) {
    console.error("[favorites][POST] failed", error);
    return NextResponse.json(
      { error: `Failed to add ${COLLECTION_NAME}` },
      { status: 500 }
    );
  }
});
