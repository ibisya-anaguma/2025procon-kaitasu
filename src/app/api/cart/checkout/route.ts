import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { promisify } from "util";

import { withAuth } from "@/lib/middleware";

const execAsync = promisify(exec);
const SCRIPT_PATH = path.resolve(process.cwd(), "src/app/api/cart/checkout/aeon_netsuper_cart.py");

export const POST = withAuth(async (_req: NextRequest, uid: string) => {
  let tempCredPath: string | null = null;

  try {
    console.log(`[checkout] Starting checkout for uid: ${uid}`);
    
    const fbProject = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
    
    // Service Account情報を取得
    let fbCred = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
    
    // JSONファイルが存在しない場合、環境変数から一時ファイルを作成
    if (!fbCred || !fs.existsSync(fbCred)) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      
      if (projectId && clientEmail && privateKey) {
        console.log('[checkout] Creating temporary service account file from env vars');
        
        const serviceAccountData = {
          type: "service_account",
          project_id: projectId,
          private_key_id: "",
          private_key: privateKey,
          client_email: clientEmail,
          client_id: "",
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`
        };
        
        // 一時ファイルを作成
        tempCredPath = path.join(os.tmpdir(), `firebase-cred-${Date.now()}.json`);
        fs.writeFileSync(tempCredPath, JSON.stringify(serviceAccountData, null, 2));
        fbCred = tempCredPath;
        console.log(`[checkout] Temporary credentials created at: ${tempCredPath}`);
      }
    }
    
    if (!fbCred) {
      throw new Error('Firebase credentials not configured');
    }
    
    // Pythonスクリプトのコマンドを構築
    const command = [
      'python3',
      SCRIPT_PATH,
      '--uid', uid,
      '--use-firebase',
      '--call-postprocess',
      '--postprocess-history-doc', 'last-checkout',
      '--headless',
      '--fb-cred', fbCred,
    ];
    
    if (fbProject) {
      command.push('--fb-project', fbProject);
    }
    
    const fullCommand = command.join(' ');
    console.log(`[checkout] Executing command (credentials hidden)`);
    
    const { stdout, stderr } = await execAsync(fullCommand, {
      timeout: 300000, // 5分のタイムアウト
    });

    console.log(`[checkout] stdout: ${stdout}`);
    if (stderr?.trim()) {
      console.warn(`[checkout] stderr: ${stderr.trim()}`);
    }

    // stderrがあっても成功の可能性があるので、エラーキーワードをチェック
    const stderrLower = (stderr || "").toLowerCase();
    const hasError = stderrLower.includes('error') || 
                     stderrLower.includes('failed') || 
                     stderrLower.includes('exception');
    
    if (hasError && !stdout.includes('完了')) {
      return NextResponse.json(
        { error: "Checkout script failed.", details: stderr.trim(), stdout: stdout.trim() },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      msg: "success", 
      output: stdout.trim(),
      uid: uid 
    });
  } catch (error) {
    const err = error as { message?: string; code?: number | string; stdout?: string; stderr?: string } | undefined;
    console.error(`[checkout] Error:`, err);
    
    return NextResponse.json(
      {
        error: "Checkout failed",
        message: err?.message,
        code: err?.code,
        stdout: err?.stdout || "",
        stderr: err?.stderr || ""
      },
      { status: 500 }
    );
  } finally {
    // 一時ファイルを削除
    if (tempCredPath && fs.existsSync(tempCredPath)) {
      try {
        fs.unlinkSync(tempCredPath);
        console.log('[checkout] Temporary credentials file deleted');
      } catch (err) {
        console.warn('[checkout] Failed to delete temporary credentials:', err);
      }
    }
  }
});
