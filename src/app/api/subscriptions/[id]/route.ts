import { NextRequest, NextResponse } from "next/server";

import { deleteCollection, patchCollection } from "@/lib/apiUtils";
import { adminAuth } from '@/lib/firebaseAdmin';

const COLLECTION_NAME = "subscriptions" as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const itemId = params.id;
    if (!itemId) {
      return NextResponse.json({ error: "Missing item id" }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown> | null;
    const payload = body ?? {};
    const data = {
      ...(typeof payload.quantity === "number" ? { quantity: payload.quantity } : {}),
      ...(typeof payload.frequency === "number" ? { frequency: payload.frequency } : {})
    };

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
    }

    await patchCollection(uid, COLLECTION_NAME, itemId, data);
    return NextResponse.json({ msg: "success" });
  } catch (error) {
    console.error("[subscriptions][PATCH] failed", error);
    return NextResponse.json(
      { error: `Failed to patch ${COLLECTION_NAME}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const itemId = params.id;
    if (!itemId) {
      return NextResponse.json({ error: "Missing item id" }, { status: 400 });
    }

    await deleteCollection(uid, COLLECTION_NAME, itemId);
    return NextResponse.json({ msg: "success" });
  } catch (error) {
    console.error("[subscriptions][DELETE] failed", error);
    return NextResponse.json(
      { error: `Failed to delete ${COLLECTION_NAME}` },
      { status: 500 }
    );
  }
};
