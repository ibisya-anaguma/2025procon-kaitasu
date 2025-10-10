<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { getCollection, addFoodDetails, postCollection } from '@/lib/apiUtils';

const collection = "favorites";

export const GET = withAuth(async (_req: NextRequest, uid: string) => {
  const items = await getCollection(uid, collection);
  const mergedItems = addFoodDetails(items);
  return NextResponse.json(mergedItems);
});

export const POST = withAuth(async (req: NextRequest, uid: string) => {
  try {
	const items = await req.json();
	await postCollection(uid, collection, items);
	return NextResponse.json({ msg: "success" });
  } catch (error) {
	return NextResponse.json({ error: `Failed to add ${collection}` }, { status: 500 });
  }
});

=======
﻿import { NextRequest, NextResponse } from "next/server";

import { addFoodDetails, getCollection } from "@/lib/apiUtils";
import { withAuth } from "@/lib/middleware";

const COLLECTION_NAME = "favorites" as const;

export const GET = withAuth(async (_req: NextRequest, uid: string) => {
  const items = await getCollection(uid, COLLECTION_NAME);
  const mergedItems = addFoodDetails(items);
  return NextResponse.json(mergedItems);
});
>>>>>>> kizu/develop
