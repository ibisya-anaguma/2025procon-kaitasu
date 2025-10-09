export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getApps, initializeApp, cert, getApp } from "firebase-admin/app";
import { withAuth } from "@/lib/middleware"
import { adminDb as db } from "@/lib/firebaseAdmin";

export const GET = withAuth(async (_req: NextRequest, uid: string) => {
  try {
    console.log("[DBG] firestore read start for uid:", uid);
    const snap = await db.collection("users").doc(uid).collection("userInformation").get();

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

/* ---------- POST /api/user-information ---------- */
export const POST = withAuth(async (_req: NextRequest, uid: string) => {
  try {
    const body = await _req.json();

    // 許容リスト
    const DISEASES = ["Hypertension","HeartDisease","Sarcopenia","Diabetes","Osteoporosis"];
    const INCREASE = ["Protein","VitaminD","Ca","Fiber"];
    const REDUCE   = ["Salt","Fat","Sugar","Vitamin","Mineral"];

    // 正規化関数
    function normList(v: unknown, allowed: string[]) {
      if (!Array.isArray(v)) return [];
      const set = new Set(allowed);
      return [...new Set(v.filter(Boolean).map(String))].filter(x => set.has(x));
    }

    type UpDown = -1 | 1;

    function mergeNutritionFlags(
      diseases: string[],                // 例: ["Hypertension"]
      increaseNutrients: string[],       // 例: ["Protein"]
      reduceNutrients: string[],         // 例: ["Salt"]
    ): Record<string, UpDown> {
      const score: Record<string, number> = {};
    
      // --- 病気による影響 ---
      for (const d of diseases || []) {
        for (const k of (diseaseUp[d] || []))   score[k] = (score[k] || 0) + 1;
        for (const k of (diseaseDown[d] || [])) score[k] = (score[k] || 0) - 1;
      }
    
      // --- ユーザー指定「増やす」 ---
      for (const b of increaseNutrients || []) {
        for (const k of (increaseByBucket[b] || [])) score[k] = (score[k] || 0) + 1;
      }
    
      // --- ユーザー指定「減らす」 ---
      for (const b of reduceNutrients || []) {
        for (const k of (reduceByBucket[b] || [])) score[k] = (score[k] || 0) - 1;
      }
    
      // --- Firestore保存用に整形 ---
      const out: Record<string, UpDown> = {};
      for (const [k, v] of Object.entries(score)) {
        const key = fieldMap[k] || k;
        out[key] = v > 0 ? 1 : -1;
      }
    
      return out;
    }

    const disease = normList(body.disease, DISEASES);
    const inc = normList(body.increaseNutrients, INCREASE);
    const red = normList(body.reduceNutrients, REDUCE);

    // 保存用payload
    const payload: Record<string, any> = {
      disease,
      increase_nutrients: inc,
      reduce_nutrients: red,
    };

    // Firestore保存（merge: trueで上書き or 追加）
    await db.collection("users").doc(uid).set(payload, { merge: true });

    return Response.json({ msg: "success" });
  } catch (err: any) {
    console.error("[ERR] POST /user-information:", err);
    return Response.json({ error: "Internal server error", message: String(err?.message || err) },{ status: 500 });
  }
});

/*
export const PATCH = withAuth(async (req: Request, uid: string) => {
  try {
    const body = await req.json();
    const updates: Record<string, any> = {};

    if (typeof body.name === "string") updates.name = body.name;
    if (typeof body.monthlyBudget === "number") updates.monthlyBudget = body.monthlyBudget;
    if (typeof body.resetDay === "number") updates.reset_day = body.resetDay;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "no valid fields" }, { status: 400 });
    }

    await db.collection("users").doc(uid).set(updates, { merge: true });
    return NextResponse.json({ msg: "success" });
  } catch (err: any) {
    console.error("[ERR] PATCH /user-information:", err);
    return NextResponse.json(
      { error: "Internal server error", message: String(err?.message || err) },
      { status: 500 }
    );
  }
});
*/