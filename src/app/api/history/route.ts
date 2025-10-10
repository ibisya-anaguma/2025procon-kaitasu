import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// GET /api/history - 購入履歴を取得
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

    console.log("[DBG] firestore read start for uid:", uid);
    
    // Firestoreから購入履歴を取得
    const snap = await adminDb.collection("users").doc(uid).collection("history").get();

    if (snap.empty) {
      // 購入履歴が存在しない場合は空配列を返す
      return NextResponse.json({ uid, userInformation: [] });
    }
    
    const userInformation = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ uid, userInformation });
  } catch (err: any) {
    console.error("[ERR] handler:", err?.name, err?.message);
    return NextResponse.json({ error: "Internal server error", message: String(err?.message || err) }, { status: 500 });
  }
}