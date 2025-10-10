import { NextRequest, NextResponse } from "next/server";

import { addFoodDetails, getCollection } from "@/lib/apiUtils";
import { withAuth } from "@/lib/middleware";

const COLLECTION_NAME = "favorites" as const;

export const GET = withAuth(async (_req: NextRequest, uid: string) => {
  const items = await getCollection(uid, COLLECTION_NAME);
  const mergedItems = addFoodDetails(items);
  return NextResponse.json(mergedItems);
});
