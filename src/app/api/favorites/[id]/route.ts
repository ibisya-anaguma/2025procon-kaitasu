// src/app/api/favorites/[id]/route.ts
// うめ

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from "@/lib/middleware";
import { deleteCollection } from "@/lib/apiUtils";

const collection = "favorites";

export const DELETE = withAuth(async (
  _req: NextRequest,
  uid: string,
  { params }: { params: { id: string } }
) => {
  try {
	await deleteCollection(uid, collection, params.id);
	return NextResponse.json({ msg: "success" });
  } catch (error) {
	return NextResponse.json({ error: `fail to delete ${collection}` }, { status: 500 });
  }
});
