import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import { promisify } from "util";

import { withAuth } from "@/lib/middleware";

const execAsync = promisify(exec);
const SCRIPT_PATH = path.resolve(process.cwd(), "src/app/api/cart/checkout/aeon_netsuper_cart.py");

export const POST = withAuth(async (_req: NextRequest) => {
  try {
    const command = `python3 ${SCRIPT_PATH}`;
    const { stdout, stderr } = await execAsync(command);

    if (stderr?.trim()) {
      return NextResponse.json(
        { error: "Checkout script failed.", details: stderr.trim() },
        { status: 500 }
      );
    }

    return NextResponse.json({ msg: "success", output: stdout.trim() });
  } catch (error) {
    const err = error as { message?: string; code?: number | string } | undefined;
    return NextResponse.json(
      {
        error: "Python script not found",
        message: err?.message,
        code: err?.code
      },
      { status: 500 }
    );
  }
});
