import { NextRequest, NextResponse } from "next/server";

import { addFoodDetails, getCollection } from "@/lib/apiUtils";
import { adminAuth } from '@/lib/firebaseAdmin';

const COLLECTION_NAME = "favorites" as const;

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
    console.error("[favorites][GET] failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
