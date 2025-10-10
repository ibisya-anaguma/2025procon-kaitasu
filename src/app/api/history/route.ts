export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware"
import { adminDb as db } from "@/lib/firebaseAdmin";

export const GET = withAuth(async (_req: NextRequest, uid: string) => {
  try {
    console.log("[DBG] firestore read start for uid:", uid);
    const snap = await db.collection("users").doc(uid).collection("history").get();

    // ドキュメントが0件でも200で空配列を返す
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return Response.json(items);
  } catch (err: any) {
    console.error("[ERR] handler:", err?.name, err?.message);
    return Response.json({ error: "Internal server error", message: String(err?.message || err) }, { status: 500 });
  }
});
