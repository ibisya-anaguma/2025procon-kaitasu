// src/app/api/cart/[id]/route.ts
// うめ

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from "@/lib/middleware";
import { getFirestore } from 'firebase-admin/firestore'
const db = getFirestore();

export const PATCH = withAuth(async (
	req: NextRequest,
	uid: string,
	context : { params: { id: string } } // 本来は第二引数、withAuthで第二にしているため第三になっている
) => {
	try {
		const itemId = context.params.id;
		// jsonにしているが、quantityのみ
		const { quantity } = await req.json();

		const ref = db.collection('users').doc(uid).collection('cart').doc(itemid);

		// patch
		await updateDoc(docRef, {
			quantity : quantity,
		});

		return NextResponse.json({ msg: "success"})
	} catch (error) {
		return NextResponse.json({ error: ""}, { status: 500 });
	}
});

export const DELETE = withAuth(async (
	_req: NextRequest,
	uid: string,
	{ params }: { params: { id: string } }
) => {
	try {
		const itemId = context.params.id;

		const ref = db.collection('users').doc(uid).collection('cart').doc(itemid);

		await ref.update({ quantity });

		return NextResponse.json({ msg: "success"})
	} catch (error) {
		return NextResponse.json({ error: ""}, { status: 500 });
	}
});
