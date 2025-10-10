import { NextRequest, NextResponse } from "next/server";

import {
  addFoodDetails,
  getCollection,
  postCollection,
  type PostCollectionItem
} from "@/lib/apiUtils";
import { adminAuth } from '@/lib/firebaseAdmin';

const COLLECTION_NAME = "subscriptions" as const;

export async function GET(request: NextRequest) {
  try {
    // Authorizationヘッダーからトークンを取得
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証トークンが必要です' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // トークンを検証してuidを取得
    let uid: string;
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      uid = decodedToken.uid;
    } catch (error) {
      console.error('トークン検証エラー:', error);
      return NextResponse.json({ error: '無効な認証トークンです' }, { status: 401 });
    }

    const items = await getCollection(uid, COLLECTION_NAME);
    const mergedItems = addFoodDetails(items);
    return NextResponse.json(mergedItems);
  } catch (error) {
    console.error("[subscriptions][GET] failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authorizationヘッダーからトークンを取得
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証トークンが必要です' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // トークンを検証してuidを取得
    let uid: string;
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      uid = decodedToken.uid;
    } catch (error) {
      console.error('トークン検証エラー:', error);
      return NextResponse.json({ error: '無効な認証トークンです' }, { status: 401 });
    }

    const body = await request.json();
    const payload = Array.isArray(body) ? body : [body];

    const items: PostCollectionItem[] = payload
      .map((item: Record<string, unknown>) => {
        const idValue = item?.id;
        const id = typeof idValue === "string" ? idValue : idValue != null ? String(idValue) : "";
        if (!id) {
          return null;
        }

        const quantity = typeof item.quantity === "number" ? item.quantity : undefined;
        const frequency = typeof item.frequency === "number" ? item.frequency : undefined;

        return { id, quantity, frequency } satisfies PostCollectionItem;
      })
      .filter((value): value is PostCollectionItem => value !== null);

    await postCollection(uid, COLLECTION_NAME, items);
    return NextResponse.json({ msg: "success" });
  } catch (error) {
    console.error("[subscriptions][POST] failed", error);
    return NextResponse.json(
      { error: `Failed to add ${COLLECTION_NAME}` },
      { status: 500 }
    );
  }
}
