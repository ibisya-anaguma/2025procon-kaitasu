import { NextRequest, NextResponse } from "next/server";

import { deleteCollection, patchCollection } from "@/lib/apiUtils";
import { withAuth } from "@/lib/middleware";

const COLLECTION_NAME = "subscriptions" as const;

type RouteContext = {
  params: {
    id: string;
  };
};

export const PATCH = withAuth<RouteContext>(async (req: NextRequest, uid: string, context) => {
  const itemId = context?.params?.id;
  if (!itemId) {
    return NextResponse.json({ error: "Missing item id" }, { status: 400 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown> | null;
    const payload = body ?? {};
    const data = {
      ...(typeof payload.quantity === "number" ? { quantity: payload.quantity } : {}),
      ...(typeof payload.frequency === "number" ? { frequency: payload.frequency } : {})
    };

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
    }

    await patchCollection(uid, COLLECTION_NAME, itemId, data);
    return NextResponse.json({ msg: "success" });
  } catch (error) {
    console.error("[subscriptions][PATCH] failed", error);
    return NextResponse.json(
      { error: `Failed to patch ${COLLECTION_NAME}` },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth<RouteContext>(async (_req: NextRequest, uid: string, context) => {
  const itemId = context?.params?.id;
  if (!itemId) {
    return NextResponse.json({ error: "Missing item id" }, { status: 400 });
  }

  try {
    await deleteCollection(uid, COLLECTION_NAME, itemId);
    return NextResponse.json({ msg: "success" });
  } catch (error) {
    console.error("[subscriptions][DELETE] failed", error);
    return NextResponse.json(
      { error: `Failed to delete ${COLLECTION_NAME}` },
      { status: 500 }
    );
  }
});
