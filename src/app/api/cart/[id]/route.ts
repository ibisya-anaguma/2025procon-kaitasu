// src/app/api/cart/[id]/route.ts
// うめ

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from "@/lib/middleware";
import { patchCollection, deleteCollection } from "@/lib/apiUtils";

const collection = "cart";

export const PATCH = withAuth(async (
	req: NextRequest,
	uid: string,
	{ params }: { params: { id: string } }
) => {
	try {
		const body = await req.json();
		await patchCollection(uid, collection, params.id, body);
		return NextResponse.json({ msg: "success" });
	} catch (error) {
		return NextResponse.json({ error: `fail to patch ${collection}` }, { status: 500 });
	}
});

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
