import { NextRequest, NextResponse } from 'next/server';
import { deleteCollection } from "@/lib/apiUtils";
import { adminAuth } from '@/lib/firebaseAdmin';

const COLLECTION_NAME = "favorites" as const;

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
    console.error("[favorites][DELETE] failed", error);
    return NextResponse.json(
      { error: `Failed to delete ${COLLECTION_NAME}` },
      { status: 500 }
    );
  }
};
