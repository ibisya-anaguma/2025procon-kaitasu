//あらともカートに入れた後にヒストリーに移動させるよ

// src/app/api/cart/checkout/checkout-postprocess.ts
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

export type MoveOpts = {
  cred?: string;           // サービスアカウントパス（省略時は ADC を利用）
  db?: admin.firestore.Firestore; // 既に初期化済みの db を渡すことも可能
  uid: string;
  historyDoc?: string;    // users/{uid}/history/{historyDoc}
  dry?: boolean;
  debug?: boolean;
};

function initAdminIfNeeded(credPath?: string) {
  // すでに初期化済みなら何もしない
  if (admin.apps.length > 0) return admin.firestore();

  const resolved = credPath ? path.resolve(credPath) : "";
  if (resolved && fs.existsSync(resolved)) {
    const sa = JSON.parse(fs.readFileSync(resolved, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id,
    });
    process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT = sa.project_id;
  } else {
    admin.initializeApp(); // ADC / env に依存
  }
  return admin.firestore();
}

function toTimestampMaybe(v: any): admin.firestore.Timestamp | null {
  if (!v) return null;
  // Firestore Timestamp object
  if (typeof v === "object" && typeof (v as any).toDate === "function") return v as admin.firestore.Timestamp;
  // raw seconds/nanoseconds object
  if (typeof v === "object" && typeof (v as any)._seconds === "number") {
    return new admin.firestore.Timestamp((v as any)._seconds, (v as any)._nanoseconds || 0);
  }
  // Date / ISO string
  const d = new Date(v);
  if (!isNaN(d.getTime())) return admin.firestore.Timestamp.fromDate(d);
  return null;
}

/**
 * カート内のアイテムを users/{uid}/history/{historyDoc} に移し、
 * 対応する cart ドキュメントを削除する。
 *
 * returns: { wrote, deleted, historyDocPath }
 */
export async function moveCartToHistory(opts: MoveOpts) {
  const uid = opts.uid;
  const historyDoc = opts.historyDoc || "auto-checkout";
  const dry = !!opts.dry;
  const debug = !!opts.debug;

  const db = opts.db ?? initAdminIfNeeded(opts.cred);

  if (debug) {
    console.log("[INFO] moveCartToHistory start", { uid, historyDoc, dry });
  }

  const userPath = `users/${uid}`;
  const cartColPath = `${userPath}/cart`;
  const historyDocPath = `${userPath}/history/${historyDoc}`;
  const historyRef = db.doc(historyDocPath);

  const cartSnap = await db.collection(cartColPath).get();
  if (debug) console.log("[DEBUG] scanning", cartColPath, "docs=", cartSnap.size);

  const collectedItems: Array<any> = [];
  const cartDocRefs: Array<admin.firestore.DocumentReference> = [];

  for (const doc of cartSnap.docs) {
    const data = doc.data() || {};
    cartDocRefs.push(doc.ref);

    if (Array.isArray((data as any).items) && (data as any).items.length > 0) {
      for (const it of (data as any).items) {
        collectedItems.push({
          id: it.id ?? null,
          url: it.url ?? "",
          name: it.name ?? "",
          image: it.image ?? "",
          price: typeof it.price === "number" ? it.price : (it.price ? Number(it.price) : null),
          quantity: typeof it.quantity === "number" ? it.quantity : (it.qty ? Number(it.qty) : 1),
          timeStamp: it.timeStamp ?? it.timestamp ?? null,
          _raw: it,
        });
      }
    } else {
      collectedItems.push({
        id: data.id ?? null,
        url: data.url ?? "",
        name: data.name ?? "",
        image: data.image ?? "",
        price: typeof data.price === "number" ? data.price : (data.price ? Number(data.price) : null),
        quantity: typeof data.quantity === "number" ? data.quantity : (data.qty ? Number(data.qty) : (data.quantify ? Number(data.quantify) : 1)),
        timeStamp: data.timeStamp ?? data.timestamp ?? null,
        _raw: data,
      });
    }
  }

  if (debug) {
    console.log("[INFO] collected", collectedItems.length, "cart item(s)");
    if (collectedItems.length > 0 && debug) {
      const sample = collectedItems.slice(0, 5).map((it) => ({
        id: it.id, url: it.url, name: it.name, quantity: it.quantity, timeStamp: it.timeStamp ? "[obj]" : null,
      }));
      console.log("[DEBUG] items sample:", sample);
    }
  }

  if (!collectedItems.length) {
    return { wrote: 0, deleted: 0, historyDocPath };
  }

  // items 内に FieldValue.serverTimestamp() を使うと失敗するので、ここでは明示的な Timestamp を埋める
  const nowTs = admin.firestore.Timestamp.fromDate(new Date());
  const preparedItems = collectedItems.map((it) => {
    const preserved = toTimestampMaybe(it.timeStamp);
    return {
      id: it.id ?? null,
      url: it.url ?? "",
      name: it.name ?? "",
      image: it.image ?? "",
      price: typeof it.price === "number" ? it.price : null,
      quantity: typeof it.quantity === "number" ? it.quantity : 1,
      timeStamp: preserved ?? nowTs,
      _raw: it._raw ?? null,
    };
  });

  if (dry) {
    if (debug) {
      console.log("[DRY] would append to history doc:", historyDocPath);
      console.log("[DRY] items sample:", preparedItems.slice(0, 5).map((it) => ({
        id: it.id, url: it.url, name: it.name, quantity: it.quantity, timeStamp: it.timeStamp.toDate().toISOString()
      })));
      console.log("[DRY] would delete", cartDocRefs.length, "cart doc(s)");
      console.log("[DRY] would set history.updatedAt = serverTimestamp()");
    }
    return { wrote: preparedItems.length, deleted: cartDocRefs.length, historyDocPath, dry: true };
  }

  // トランザクションで append & delete を行う
  const result = await db.runTransaction(async (tx) => {
    const hSnap = await tx.get(historyRef);
    const base = hSnap.exists ? (hSnap.data() || {}) : {};
    const currentItems: any[] = Array.isArray(base.items) ? base.items : [];

    const newItems = [...currentItems, ...preparedItems];

    tx.set(historyRef, {
      items: newItems,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(), // top-level ならOK
      source: "auto-checkout-postprocess",
    }, { merge: true });

    for (const r of cartDocRefs) {
      tx.delete(r);
    }

    return { wrote: preparedItems.length, deleted: cartDocRefs.length, historyDocPath };
  });

  if (debug) console.log("[INFO] moveCartToHistory result:", result);
  return result;
}

// --------------------- CLI support ---------------------
if (require.main === module) {
  (async () => {
    const argv = process.argv.slice(2);
    const get = (k: string, d = "") => {
      const i = argv.indexOf(k);
      return i >= 0 ? String(argv[i + 1]) : d;
    };
    const has = (k: string) => argv.includes(k);

    const uid = get("--uid");
    if (!uid) {
      console.error("Usage: --uid <uid> [--cred <sa.json>] [--history-doc <name>] [--dry] [--debug]");
      process.exit(1);
    }

    const cred = get("--cred", process.env.GOOGLE_APPLICATION_CREDENTIALS || "");
    const historyDoc = get("--history-doc", "auto-checkout");
    const dry = has("--dry");
    const debug = has("--debug");

    try {
      const res = await moveCartToHistory({ cred, uid, historyDoc, dry, debug });
      console.log("[INFO] done:", res);
      process.exit(0);
    } catch (e: any) {
      console.error("ERROR:", e && e.stack ? e.stack : e);
      process.exit(1);
    }
  })();
}