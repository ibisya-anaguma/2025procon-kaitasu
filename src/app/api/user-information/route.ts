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

export const PATCH = withAuth(async (req: Request, uid: string) => {
  try {
    const body = await req.json();
    const updates: Record<string, any> = {};

    // name → userInformation.userName
    if (typeof body.name === "string" && body.name.trim() !== "") {updates["userInformation.userName"] = body.name.trim();}

    // monthlyBudget（0以上の数値に限定。整数化するなら Math.floor）
    if (typeof body.monthlyBudget === "number" && Number.isFinite(body.monthlyBudget) && body.monthlyBudget >= 0) {updates["userInformation.monthlyBudget"] = Math.floor(body.monthlyBudget);}
    if (typeof body.resetDay === "number" && Number.isInteger(body.resetDay) && body.resetDay >= 1 && body.resetDay <= 31) {updates["userInformation.resetDay"] = body.resetDay;}
    if (Object.keys(updates).length === 0) {return NextResponse.json({ error: "no valid fields" }, { status: 400 });}

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

export const POST = withAuth(async (_req: NextRequest, uid: string) => {
  try {
    const body = await _req.json();

    // 許容値（入力バリデーション用）
    const DISEASES = ["Hypertension","HeartDisease","Sarcopenia","Diabetes","Osteoporosis"] as const;
    const INCREASE = ["Protein","VitaminD","Ca","Fiber"] as const;
    const REDUCE   = ["Salt","Fat","Sugar","Vitamin","Mineral"] as const;

    // ===== マスタ定義（略号版） =====
    const diseaseUp: Record<string, string[]> = {
      Hypertension: ["K","MG","CA","FIB","VITC","TOCPHA"],
      HeartDisease: ["K","MG","FIB","TOCPHA","VITC","NIA"],
      Sarcopenia: ["PROT","VITD","CA","MG","VITB6A","VITB12","ENERC_KCAL"],
      Diabetes: ["FIB","MG","THIA","VITB6A","NIA","VITC","TOCPHA"],
      Osteoporosis: ["CA","VITD","VITK","MG","PROT","ZN","CU"],
    };
    const diseaseDown: Record<string, string[]> = {
      Hypertension: ["NA","NACL_EQ","FATNLEA","CHOLE"],
      HeartDisease: ["NA","NACL_EQ","FATNLEA","CHOLE","P"],
      Sarcopenia: ["NA","FATNLEA"],
      Diabetes: ["CHOAVLM","CHOCDF","FATNLEA","NA","NACL_EQ","CHOLE"],
      Osteoporosis: ["NA","NACL_EQ","P","VITA_RAE"],
    };
    const increaseByBucket: Record<string, string[]> = {
      Protein: ["PROT"],
      VitaminD: ["VITD"],
      Ca: ["CA"],
      Fiber: ["FIB"],
    };
    const reduceByBucket: Record<string, string[]> = {
      Salt: ["NA","NACL_EQ"],
      Fat: ["FAT","FATNLEA","CHOLE"],
      Sugar: ["CHOCDF","CHOAVLM"],
      Vitamin: ["VITA_RAE","VITD","TOCPHA","VITK"],
      Mineral: ["NA","P"],
    };

    // ===== 正規化 =====
    function normList(v: unknown, allowed: readonly string[]) {
      if (!Array.isArray(v)) return [] as string[];
      const set = new Set(allowed);
      return [...new Set(v.filter(Boolean).map(String))].filter(x => set.has(x));
    }
    const diseases = normList(body.disease, DISEASES);
    const incPrefs  = normList(body.increaseNutrients, INCREASE);
    const redPrefs  = normList(body.reduceNutrients, REDUCE);

    // ===== 栄養フラグ合成（0は保存しない） =====
    type UpDown = -1 | 1;
    function mergeNutritionFlags(
      _diseases: string[], _inc: string[], _red: string[],
    ): Record<string, UpDown> {
      const score: Record<string, number> = {};

      // 病気ルール
      for (const d of _diseases) {
        for (const k of (diseaseUp[d] || []))   score[k] = (score[k] || 0) + 1;
        for (const k of (diseaseDown[d] || [])) score[k] = (score[k] || 0) - 1;
      }
      // ユーザー指定
      for (const b of _inc) for (const k of (increaseByBucket[b] || [])) score[k] = (score[k] || 0) + 1;
      for (const b of _red) for (const k of (reduceByBucket[b]   || [])) score[k] = (score[k] || 0) - 1;

      // 出力（0除外）
      const out: Record<string, UpDown> = {};
      for (const [k, v] of Object.entries(score)) {
        if (v === 0) continue;
        out[k] = v > 0 ? 1 : -1;
      }
      return out;
    }

    const nutritionFlags = mergeNutritionFlags(diseases, incPrefs, redPrefs);

    // ===== Firestore保存（nutritionだけ） =====
    const payload = {
      userInformation: {
        nutrition: nutritionFlags,
      },
    };

    await db.collection("users").doc(uid).set(payload, { merge: true });
    return NextResponse.json({ msg: "success" });

  } catch (err: any) {
    console.error("[ERR] POST /user-information:", err);
    return NextResponse.json(
      { error: "Internal server error", message: String(err?.message || err) },
      { status: 500 }
    );
  }
});