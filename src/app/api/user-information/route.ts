// src/app/api/user-information/route.ts
import { headers } from "next/headers";
import { initializeApp, applicationDefault, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Firebase Admin 初期化
function getAdmin() {
  const app = getApps().length
    ? getApp()
    : initializeApp({ credential: applicationDefault() });
  return { auth: getAuth(app), db: getFirestore(app) };
}

export const get GET = withAuth(async (_req: NextRequest, uid: string) => {
  try {
    const { db } = getAdmin();

    // 🔹 userInformation 以下の全ドキュメントを取得
    const snap = await db
      .collection("users")
      .doc(uid)
      .collection("userInformation")
      .get();

    if (snap.empty) {
      console.warn("[user-information] no documents found for", uid);
      return Response.json({ error: "not found" }, { status: 404 });
    }

    // 複数ドキュメントを配列で返す
    const userInfos = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return Response.json({ uid, userInformation: userInfos });
  } catch (err: any) {
    console.error("[user-information] internal error:", err?.stack || err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});