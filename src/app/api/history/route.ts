import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { withAuth } from '@/lib/middleware';

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
    
    // 各ドキュメントのitemsを展開して個々の商品として返す
    const allItems: any[] = [];
    snap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.items && Array.isArray(data.items)) {
        data.items.forEach((item: any) => {
          allItems.push({
            ...item,
            productId: item.id,
            id: `${doc.id}-${item.id}-${item.purchasedAt || Date.now()}`,
          });
        });
      }
    });
    
    // 購入日時の降順でソート
    allItems.sort((a, b) => {
      const dateA = new Date(a.purchasedAt || 0).getTime();
      const dateB = new Date(b.purchasedAt || 0).getTime();
      return dateB - dateA;
    });
    
    console.log("[DBG] history items count:", allItems.length);
    return NextResponse.json({ uid, userInformation: allItems });
  } catch (err: any) {
    console.error("[ERR] handler:", err?.name, err?.message);
    return NextResponse.json({ error: "Internal server error", message: String(err?.message || err) }, { status: 500 });
  }
}

// POST /api/history - カートから履歴への移動
export const POST = withAuth(async (req: NextRequest, uid: string) => {
  try {
    console.log('[history][POST] Saving checkout to history for uid:', uid);
    
    const body = await req.json();
    const { items, historyDocId = 'last-checkout' } = body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items to save' }, { status: 400 });
    }
    
    const timestamp = new Date().toISOString();
    
    // 各商品にタイムスタンプを追加
    const itemsWithTimestamp = items.map((item: any) => ({
      id: String(item.id || ''),
      name: item.name || '',
      price: item.price || 0,
      image: item.image || item.imgUrl || '',
      quantity: item.quantity || 1,
      purchasedAt: timestamp
    }));
    
    // 履歴に追加
    const historyRef = adminDb
      .collection('users')
      .doc(uid)
      .collection('history')
      .doc(historyDocId);
    
    await historyRef.set({
      items: FieldValue.arrayUnion(...itemsWithTimestamp),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log('[history][POST] Saved', itemsWithTimestamp.length, 'items to history');
    
    // カートをクリア
    const cartSnapshot = await adminDb
      .collection('users')
      .doc(uid)
      .collection('cart')
      .get();
    
    if (!cartSnapshot.empty) {
      const batch = adminDb.batch();
      cartSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log('[history][POST] Cleared', cartSnapshot.size, 'items from cart');
    }
    
    return NextResponse.json({ 
      success: true, 
      itemsSaved: itemsWithTimestamp.length,
      cartCleared: cartSnapshot.size,
      historyDocId 
    });
  } catch (error) {
    console.error('[history][POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save history', message: String(error) },
      { status: 500 }
    );
  }
});
