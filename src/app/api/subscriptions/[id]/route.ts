// src/app/api/subscriptions/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from "@/lib/middleware";
import { deleteCollection, patchCollection } from "@/lib/apiUtils";

const COLLECTION_NAME = "subscriptions";

// 定期購入を削除
export const DELETE = withAuth(async (
  _req: NextRequest,
  uid: string,
  { params }: { params: { id: string } }
) => {
  try {
    await deleteCollection(uid, COLLECTION_NAME, params.id);
    return NextResponse.json({ msg: "success" });
  } catch (error) {
    console.error('[subscriptions][DELETE] failed', error);
    return NextResponse.json({ error: `fail to delete ${COLLECTION_NAME}` }, { status: 500 });
  }
});

// 定期購入を更新（数量や頻度の変更）
export const PATCH = withAuth(async (
  req: NextRequest,
  uid: string,
  { params }: { params: { id: string } }
) => {
  try {
    const body = await req.json();
    const { quantity, frequency } = body;

    const updateData: { quantity?: number; frequency?: number } = {};
    
    if (typeof quantity === 'number') {
      updateData.quantity = quantity;
    }
    
    if (typeof frequency === 'number') {
      updateData.frequency = frequency;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '更新するデータがありません' }, { status: 400 });
    }

    await patchCollection(uid, COLLECTION_NAME, params.id, updateData);
    return NextResponse.json({ msg: "success" });
  } catch (error) {
    console.error('[subscriptions][PATCH] failed', error);
    return NextResponse.json({ error: `fail to update ${COLLECTION_NAME}` }, { status: 500 });
  }
});
