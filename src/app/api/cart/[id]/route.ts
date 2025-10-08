// src/app/api/cart/[id]/route.ts
// うめ

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from "@/lib/middleware";
import { getFirestore } from 'firebase-admin/firestore'
import { patchCollection, deleteCollection };

const collection = cart;

export const PATCH = withAuth(async (
	req: NextRequest,
	uid: string,
	context : { params: { id: string } } // 本来は第二引数、withAuthで第二にしているため第三になっている
) => {
	try {
		patchCollection(uid, collection, req.json);

		return NextResponse.json({ msg: "success"})
	} catch (error) {
		return NextResponse.json({ error: `fail to patch ${collection}`}, { status: 500 });
	}
});

export const DELETE = withAuth(async (
	_req: NextRequest,
	uid: string,
	{ params }: { params: { id: string } }
) => {
	try {
		const itemId = context.params.id;
		deleteCollection(uid, itemId);

		return NextResponse.json({ msg: "success"})
	} catch (error) {
		return NextResponse.json({ error: `fail to delete ${collection}`}, { status: 500 });
	}
});
