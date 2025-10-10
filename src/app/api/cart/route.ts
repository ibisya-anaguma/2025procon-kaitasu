<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { getCollection, addFoodDetails, postCollection } from '@/lib/apiUtils';

const collection = "cart";

export const GET = withAuth(async (_req: NextRequest, uid: string) => {
  const items = await getCollection(uid, collection);
=======
import { NextRequest, NextResponse } from "next/server";

import {
  addFoodDetails,
  getCollection,
  postCollection,
  type PostCollectionItem
} from "@/lib/apiUtils";
import { withAuth } from "@/lib/middleware";

const COLLECTION_NAME = "cart" as const;

export const GET = withAuth(async (_req, uid) => {
  const items = await getCollection(uid, COLLECTION_NAME);
>>>>>>> kizu/develop
  const mergedItems = addFoodDetails(items);
  return NextResponse.json(mergedItems);
});

export const POST = withAuth(async (req: NextRequest, uid: string) => {
  try {
<<<<<<< HEAD
    const items = await req.json();
    await postCollection(uid, collection, items);
    return NextResponse.json({ msg: "success" });
  } catch (error) {
    return NextResponse.json({ error: `Failed to add ${collection}` }, { status: 500 });
=======
    const body = await req.json();
    const payload = Array.isArray(body) ? body : [body];

    const items: PostCollectionItem[] = payload
      .map((item: Record<string, unknown>) => {
        const idValue = item?.id;
        const id = typeof idValue === "string" ? idValue : idValue != null ? String(idValue) : "";
        if (!id) {
          return null;
        }

        const quantity = typeof item.quantity === "number" ? item.quantity : undefined;
        const frequency = typeof item.frequency === "number" ? item.frequency : undefined;

        return { id, quantity, frequency } satisfies PostCollectionItem;
      })
      .filter((value): value is PostCollectionItem => value !== null);

    await postCollection(uid, COLLECTION_NAME, items);
    return NextResponse.json({ msg: "success" });
  } catch (error) {
    console.error("[cart][POST] failed", error);
    return NextResponse.json(
      { error: `Failed to add ${COLLECTION_NAME}` },
      { status: 500 }
    );
>>>>>>> kizu/develop
  }
});
