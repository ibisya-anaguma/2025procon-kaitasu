import { NextResponse } from "next/server";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { withAuth } from "@/lib/middleware";
import { adminDb } from "@/lib/firebaseAdmin";

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = path.resolve(process.cwd(), "src/app/api/combos/combination.py");

type Body = {
  budget?: number;
  isHealthImportance?: boolean;
};

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

export const POST = withAuth(async (req, uid) => {
  // 1) body
  const body = (await req.json().catch(() => ({}))) as Body;
  const budget = Number(body?.budget);
  if (!Number.isFinite(budget) || budget <= 0) {
    return NextResponse.json({ error: "invalid-budget" }, { status: 400 });
  }
  const health = body?.isHealthImportance ? "true" : "false";

  // 2) Firestore から nutrition を取得
  const doc = await adminDb.doc(`users/${uid}`).get();
  const nutritionRaw = doc.data()?.userInformation?.nutrition || {};

  // 3) -1/0/1 → "up"/"down" へ正規化
  const prefs = toPrefs(nutritionRaw);
  const prefsJson = JSON.stringify(prefs);

  // 4) Python 実行
  const args = [
    SCRIPT_PATH,
    "--budget", String(budget),
    "--health", health,
    "--prefs-json", prefsJson,
  ];
  const { stdout } = await execFileAsync("python3", args, { maxBuffer: 1024 * 1024 * 16 });

  // 5) Python が返す配列をそのまま返却
  const items = JSON.parse(stdout);
  return NextResponse.json(items, { status: 200 });
});