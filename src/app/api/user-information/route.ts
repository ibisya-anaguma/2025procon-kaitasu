import { NextRequest, NextResponse } from "next/server";

import { adminDb } from "@/lib/firebaseAdmin";
import { withAuth } from "@/lib/middleware";

type UserInformation = Record<string, unknown> & { id: string };

export const GET = withAuth(async (_req: NextRequest, uid: string) => {
  try {
    const snapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("userInformation")
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const userInformation: UserInformation[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ uid, userInformation });
  } catch (error) {
    console.error("[user-information][GET] failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
