import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);
const SCRIPT_PATH = path.resolve(process.cwd(), "src/app/api/combos/combination.py");

export async function POST() {
  try {
    const command = `python3 ${SCRIPT_PATH}`;
    const { stdout, stderr } = await execAsync(command);

    if (stderr?.trim()) {
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
      } catch {
        data = trimmed;
      }
    }

    return NextResponse.json({ msg: "success", data });
  } catch (error) {
    const err = error as { message?: string; code?: number | string; cmd?: string } | undefined;
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
}
