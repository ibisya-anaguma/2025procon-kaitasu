import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import * as util from "util";
import * as admin from "firebase-admin";

const spawn = child_process.spawn;
const execFile = util.promisify(child_process.execFile);

type Opts = {
  fbCred?: string;
  python?: string;
  pythonScript?: string;
  headless?: boolean;
  debug?: boolean;
  dry?: boolean;
  limit?: number;
  cartPathTemplate?: string;
  sleepMsBetween?: number;
  timeoutMs?: number;
  debuggerAddress?: string;
};

function parseArgs(): Opts {
  const argv = process.argv.slice(2);
  const get = (k: string, d?: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : d;
  };
  const has = (k: string) => argv.includes(k);

  return {
    fbCred: get("--fb-cred", process.env.GOOGLE_APPLICATION_CREDENTIALS || undefined),
    python: get("--python", "python3"),
    pythonScript: get("--python-script", "src/app/api/cart/checkout/aeon_netsuper_cart.py"),
    headless: has("--headless"),
    debug: has("--debug"),
    dry: has("--dry"),
    limit: Number(get("--limit", "50")) || 50,
    cartPathTemplate: get("--cart-path-template", "users/{uid}/cart"),
    sleepMsBetween: Number(get("--sleep-ms-between", "0")) || 0,
    timeoutMs: Number(get("--timeout-ms", String(15 * 60 * 1000))) || 15 * 60 * 1000,
    debuggerAddress: get("--debugger-address", ""),
  };
}

function log(...args: any[]) {
  console.log(new Date().toISOString(), ...args);
}

async function initAdmin(fbCred?: string) {
  // prefer explicit fbCred path, else env var GOOGLE_APPLICATION_CREDENTIALS
  const credPath = fbCred || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) throw new Error("Service account JSON path not provided (fbCred or GOOGLE_APPLICATION_CREDENTIALS).");
  const resolved = path.resolve(credPath);
  if (!fs.existsSync(resolved)) throw new Error(`Service account JSON not found at: ${resolved}`);
  const sa = JSON.parse(fs.readFileSync(resolved, "utf8"));
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id,
    });
  }
  return admin.firestore();
}

function isCollectionPath(p: string) {
  const segs = p.split("/").filter(Boolean);
  return segs.length % 2 === 1;
}

async function usersWithCart(db: admin.firestore.Firestore, cartPathTemplate: string, limit: number, debug = false) {
  // Simple approach: list users collection and check subcollection 'cart'.
  // If your users structure differs, adjust this function.
  const usersCol = db.collection("users");
  const snap = await usersCol.get();
  const out: string[] = [];
  for (const udoc of snap.docs) {
    const uid = udoc.id;
    const cartPath = cartPathTemplate.replace("{uid}", uid);
    const cartRef = db.collection(cartPath);
    // only check existence / non-empty
    const cartSnap = await cartRef.limit(1).get();
    if (!cartSnap.empty) {
      out.push(uid);
      if (debug) log(`[DEBUG] found cart for uid=${uid}`);
      if (out.length >= limit) break;
    } else if (debug) {
      log(`[DEBUG] empty cart uid=${uid}`);
    }
  }
  return out;
}

function buildPythonArgs(opts: Opts, uid: string): string[] {
  // Build args array safely. **Only include flags that have values**.
  const args: string[] = [];

  // script-specific options
  args.push(opts.pythonScript || "src/app/api/cart/checkout/aeon_netsuper_cart.py");

  // must provide uid
  args.push("--uid", uid);

  // use firebase
  args.push("--use-firebase");

  // fb cred path (if provided)
  if (opts.fbCred && opts.fbCred.trim()) {
    args.push("--fb-cred", opts.fbCred);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    args.push("--fb-cred", process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }

  // cart-path template => expand for this uid
  if (opts.cartPathTemplate) {
    const cartPath = (opts.cartPathTemplate || "users/{uid}/cart").replace("{uid}", uid);
    args.push("--cart-path", cartPath);
  }

  // boolean flags
  if (opts.headless) args.push("--headless");
  if (opts.dry) args.push("--dry");
  if (opts.debug) args.push("--debug");
  if (opts.debuggerAddress && opts.debuggerAddress.trim()) {
    // IMPORTANT: only pass the debugger flag with a value
    args.push("--debugger-address", opts.debuggerAddress.trim());
  }

  // optional: postprocess integration (we'll always call postprocess in this script by default)
  args.push("--call-postprocess", "--postprocess-history-doc", "last-checkout");

  // dedupe for safety
  args.push("--dedupe");

  return args;
}

function spawnPython(pythonBin: string, args: string[], cwd?: string) {
  log(`[SPAWN] ${pythonBin} ${args.map(a => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`);
  const child = spawn(pythonBin, args, {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: cwd || process.cwd(),
    env: process.env,
  });

  return new Promise<{ code: number | null; stdout: string; stderr: string }>((res) => {
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => {
      const s = b.toString();
      stdout += s;
      process.stdout.write(s);
    });
    child.stderr.on("data", (b) => {
      const s = b.toString();
      stderr += s;
      process.stderr.write(s);
    });
    child.on("close", (code) => {
      res({ code, stdout, stderr });
    });
    child.on("error", (err) => {
      stderr += String(err);
      res({ code: 1, stdout, stderr });
    });
  });
}

async function main() {
  const opts = parseArgs();
  log("parsed args:", JSON.stringify(opts));

  const fbCred = opts.fbCred || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!fbCred) {
    throw new Error("Provide service account via --fb-cred or set GOOGLE_APPLICATION_CREDENTIALS");
  }

  const db = await initAdmin(fbCred);

  const users = await usersWithCart(db, opts.cartPathTemplate || "users/{uid}/cart", opts.limit || 50, opts.debug || false);
  log(`users with non-empty cart: ${users.length} (limit=${opts.limit})`);
  let processed = 0;

  for (const uid of users) {
    if (processed >= (opts.limit || 50)) break;
    log(`--- processing uid=${uid} (${processed + 1}/${users.length}) ---`);
    const pyArgs = buildPythonArgs(opts, uid);

    if (opts.dry) {
      log("[DRY RUN] would spawn Python with args:", pyArgs.join(" "));
      processed++;
      continue;
    }

    const pythonBin = opts.python || "python3";
    const result = await spawnPython(pythonBin, pyArgs);
    log(`[PYTHON EXIT] uid=${uid} code=${result.code}`);
    if (result.code !== 0) {
      log(`[ERROR] Python failed for uid=${uid}. stderr:\n${result.stderr}`);
    } else {
      log(`[OK] Python finished for uid=${uid}`);
    }

    // throttle between users if requested
    if (opts.sleepMsBetween && opts.sleepMsBetween > 0) {
      await new Promise((r) => setTimeout(r, opts.sleepMsBetween));
    }
    processed++;
  }

  log("done. processed:", processed);
}

main().catch((err) => {
  console.error("Fatal:", err && (err.stack || err.message || err));
  process.exit(1);
});