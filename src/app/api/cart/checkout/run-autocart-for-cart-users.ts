import * as fs from "fs";
import * as path from "path";
import * as admin from "firebase-admin";
import { spawnSync } from "child_process";

type Args = {
  fbCred: string;            // path to service account JSON (required)
  python: string;            // python binary (default: python3)
  pythonScript: string;      // path to aeon_netsuper_cart.py
  headless: boolean;
  dry: boolean;
  debug: boolean;
  limit?: number;            // max users to process
  cartPathTemplate: string;  // e.g. 'users/{uid}/cart'
  sleepMsBetween?: number;   // optional delay between user runs
  timeoutMs?: number;        // per-user python timeout
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string, d = "") => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] ?? d : d;
  };
  const has = (k: string) => argv.includes(k);

  const fbCred = get("--fb-cred", process.env.GOOGLE_APPLICATION_CREDENTIALS || "");
  const python = get("--python", "python3");
  const pythonScript = get("--python-script", "src/app/api/cart/checkout/aeon_netsuper_cart.py");

  const args: Args = {
    fbCred,
    python,
    pythonScript,
    headless: has("--headless"),
    dry: has("--dry"),
    debug: has("--debug"),
    limit: Number(get("--limit", "")) || undefined,
    cartPathTemplate: get("--cart-path-template", "users/{uid}/cart"),
    sleepMsBetween: Number(get("--sleep-ms-between", "0")) || 0,
    timeoutMs: Number(get("--timeout-ms", String(15 * 60 * 1000))) || 15 * 60 * 1000,
  };

  if (!args.fbCred) {
    console.error("ERROR: --fb-cred <path-to-service-account.json> is required (or set GOOGLE_APPLICATION_CREDENTIALS).");
    process.exit(1);
  }

  return args;
}

function initAdmin(fbCredPath: string) {
  const p = path.resolve(fbCredPath);
  if (!fs.existsSync(p)) {
    console.error(`Fatal: Service account JSON not found at: ${p}`);
    process.exit(2);
  }
  const sa = JSON.parse(fs.readFileSync(p, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: sa.project_id || undefined,
  });
  return admin.firestore();
}

async function listUsersWithCart(db: admin.firestore.Firestore, cartPathTemplate: string, limit?: number, debug = false) {
  // Simple approach: list users collection, check if cart has at least one doc
  // (This assumes top-level 'users' collection.)
  const usersCol = db.collection("users");
  const snaps = await usersCol.get();
  if (debug) console.log(`[DEBUG] users found: ${snaps.size}`);
  const out: Array<{ uid: string; cartCount: number; cartPath: string }> = [];
  for (const doc of snaps.docs) {
    const uid = doc.id;
    const cartPath = cartPathTemplate.replace("{uid}", uid);
    const cartColRef = db.collection(cartPath);
    const cartSnap = await cartColRef.limit(1).get();
    if (!cartSnap.empty) {
      out.push({ uid, cartCount: 1, cartPath });
      if (limit && out.length >= limit) break;
    }
  }
  return out;
}

function buildPythonArgsForUser(args: Args, uid: string) {
  // Build CLI args to call aeon_netsuper_cart.py for this user
  const pyArgs = [
    args.pythonScript,
    "--use-firebase",
    "--fb-cred", args.fbCred,
    "--uid", uid,
    "--cart-path", args.cartPathTemplate.replace("{uid}", uid),
    "--dedupe",
    "--call-postprocess",
    "--postprocess-history-doc", "last-checkout",
  ];
  if (args.headless) pyArgs.push("--headless");
  if (args.dry) pyArgs.push("--dry");
  if (args.debug) pyArgs.push("--debug");
  return pyArgs;
}

function runPythonSync(pythonBin: string, pyArgs: string[], timeoutMs: number, debug = false) {
  if (debug) console.log(`[DEBUG] spawn: ${pythonBin} ${pyArgs.map(a => `"${a}"`).join(" ")}`);
  const res = spawnSync(pythonBin, pyArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
  });
  return res;
}

async function main() {
  const args = parseArgs();
  if (args.debug) console.log("[INFO] parsed args:", { ...args, fbCred: args.fbCred ? "<provided>" : "<none>" });

  const db = initAdmin(args.fbCred);

  console.log("[INFO] scanning users for cart items...");
  const users = await listUsersWithCart(db, args.cartPathTemplate, args.limit, args.debug);
  console.log(`[INFO] users with non-empty cart: ${users.length}${args.limit ? ` (limit ${args.limit})` : ""}`);

  if (!users.length) {
    console.log("[INFO] nothing to do.");
    process.exit(0);
  }

  let processed = 0;
  for (const u of users) {
    processed++;
    const uid = u.uid;
    console.log(`\n[INFO] (${processed}/${users.length}) processing uid=${uid}`);
    const pyArgs = buildPythonArgsForUser(args, uid);

    // Note: we call python binary with script as first argument
    // e.g. python3 src/.../aeon_netsuper_cart.py --use-firebase ...
    const spawnArgs = pyArgs; // first element is script path

    try {
      const result = runPythonSync(args.python, spawnArgs, args.timeoutMs!, args.debug);
      // print stdout/stderr
      if (result.stdout && result.stdout.length) {
        console.log(`[PY stdout] ${result.stdout.trim()}`);
      }
      if (result.stderr && result.stderr.length) {
        console.error(`[PY stderr] ${result.stderr.trim()}`);
      }
      if (result.error) {
        console.error("[ERROR] spawn failed:", result.error);
      }
      const ok = result.status === 0 && !result.error;
      if (ok) {
        console.log(`[INFO] python succeeded for uid=${uid} (exit ${result.status})`);
      } else {
        console.error(`[WARN] python failed for uid=${uid} (exit ${result.status}). See stderr above.`);
      }
    } catch (e: any) {
      console.error("[EXCEPTION] while running python:", e && e.stack ? e.stack : e);
    }

    if (args.sleepMsBetween && processed < users.length) {
      await new Promise((r) => setTimeout(r, args.sleepMsBetween));
    }
  }

  console.log("\n[INFO] finished processing all users. total:", users.length);
}

if (require.main === module) {
  main().catch((e) => {
    console.error("[FATAL] uncaught error:", e && e.stack ? e.stack : e);
    process.exit(1);
  });
}