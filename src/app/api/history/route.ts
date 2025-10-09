export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getApps, initializeApp, cert, getApp } from "firebase-admin/app";
import { withAuth } from "@/lib/middleware"
import { adminDb as db } from "@/lib/firebaseAdmin";

export const GET = withAuth(async (_req: NextRequest, uid: string) => {
  try {
    console.log("[DBG] firestore read start for uid:", uid);
    const snap = await db.collection("users").doc(uid).collection("history").get();

    if (snap && snap.empty) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    const userInformation = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return Response.json({ uid, userInformation });
  } catch (err: any) {
    console.error("[ERR] handler:", err?.name, err?.message);
    return Response.json({ error: "Internal server error", message: String(err?.message || err) }, { status: 500 });
  }
});