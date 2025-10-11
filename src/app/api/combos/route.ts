import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import { promisify } from "util";

import { withAuth } from "@/lib/middleware";
import { adminDb } from "@/lib/firebaseAdmin";

const execAsync = promisify(exec);
const SCRIPT_PATH = path.resolve(process.cwd(), "src/app/api/combos/combination.py");

// -1/0/1 でも "up"/"down" でも受け取り、"up"/"down" だけに整形
function toPrefs(obj: any): Record<string, "up" | "down"> {
  const out: Record<string, "up" | "down"> = {};
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    if (v === 1 || v === "up") out[k] = "up";
    else if (v === -1 || v === "down") out[k] = "down";
    // 0 / null / undefined / その他は無視
  }
  return out;
}

export const POST = withAuth(async (req: NextRequest, uid: string) => {
  try {
    console.log('[combos] Starting combos API request for uid:', uid);
    
    // リクエストボディを取得
    const body = await req.json().catch(err => {
      console.error('[combos] Failed to parse JSON body:', err);
      return {};
    });
    const budget = body?.budget || 50000;
    const isHealthImportance = body?.isHealthImportance ? 'true' : 'false';
    const genres = body?.genres || [];
    
    console.log('[combos] Request params:', { budget, isHealthImportance, genres, uid });

    // Firestoreからユーザーの栄養設定を取得
    console.log('[combos] Fetching user data from Firestore...');
    const doc = await adminDb.collection('users').doc(uid).get();
    const userData = doc.data();
    console.log('[combos] User data exists:', doc.exists, 'data:', userData);
    
    const nutritionRaw = userData?.nutrition || {};
    console.log('[combos] nutrition from DB:', nutritionRaw);

    // -1/0/1 → "up"/"down" へ正規化
    const prefs = toPrefs(nutritionRaw);
    const prefsJson = JSON.stringify(prefs);
    
    console.log('[combos] prefs:', prefsJson);

    // JSONをコマンドライン引数として安全に渡すためにエスケープ
    const escapedPrefsJson = prefsJson.replace(/'/g, "'\\''");
    
    // genresもJSON文字列に変換してエスケープ
    const genresJson = JSON.stringify(genres);
    const escapedGenresJson = genresJson.replace(/'/g, "'\\''");

    // Pythonスクリプトに引数を渡す
    const command = `python3 ${SCRIPT_PATH} --budget ${budget} --health ${isHealthImportance} --prefs-json '${escapedPrefsJson}' --genres '${escapedGenresJson}'`;
    
    console.log('[combos] Executing command:', command);

    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10 // 10MB
    });

    if (stderr?.trim()) {
      console.error('[combos] Python stderr:', stderr.trim());
      return NextResponse.json(
        { error: "Combination script failed.", details: stderr.trim() },
        { status: 500 }
      );
    }

    let data: unknown = null;
    const trimmed = stdout.trim();

    if (trimmed) {
      try {
        data = JSON.parse(trimmed);
        console.log('[combos] Success, returned', Array.isArray(data) ? data.length : 'N/A', 'items');
      } catch (parseError) {
        console.error('[combos] Failed to parse JSON:', parseError);
        data = trimmed;
      }
    }

    // dataが配列の場合はそのまま返す、それ以外は{ msg, data }形式
    if (Array.isArray(data)) {
      return NextResponse.json(data);
    }

    return NextResponse.json({ msg: "success", data });
  } catch (error) {
    const err = error as { message?: string; code?: number | string; cmd?: string } | undefined;
    console.error('[combos] Error:', err);
    return NextResponse.json(
      {
        error: "exec-failed",
        message: err?.message ?? String(error),
        code: err?.code,
        cmd: err?.cmd
      },
      { status: 500 }
    );
  }
});
