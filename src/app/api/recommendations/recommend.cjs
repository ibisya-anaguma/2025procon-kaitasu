const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// ========= CLI =========
function parseArgs() {
  const argv = process.argv.slice(2);
  if (!argv.length) {
    console.error("Usage: node recommend.cjs <UID> [--cred ./sa.json] [--catalog ./all_products.json] [options]");
    process.exit(1);
  }
  const cfg = {
    uid: argv[0],
    cred: process.env.GOOGLE_APPLICATION_CREDENTIALS || "",
    catalog: "",
    limit: 12,
    addRandom: 4,
    minOcc: 3,
    periodMin: 3,
    periodMax: 120,
    jitter: 0.35,
    dueWin: 5,
    debug: false,
  };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--cred") cfg.cred = argv[++i];
    else if (k === "--catalog") cfg.catalog = argv[++i];
    else if (k === "--limit") cfg.limit = parseInt(argv[++i], 10);
    else if (k === "--add-random") cfg.addRandom = parseInt(argv[++i], 10);
    else if (k === "--min-occurrences") cfg.minOcc = parseInt(argv[++i], 10);
    else if (k === "--period-min") cfg.periodMin = parseInt(argv[++i], 10);
    else if (k === "--period-max") cfg.periodMax = parseInt(argv[++i], 10);
    else if (k === "--jitter") cfg.jitter = parseFloat(argv[++i]);
    else if (k === "--due-window") cfg.dueWin = parseInt(argv[++i], 10);
    else if (k === "--debug") cfg.debug = true;
  }
  if (!cfg.uid || cfg.uid === "uid" || cfg.uid === "<UID>") {
    console.error("エラー: 実UIDを指定してください。例: node recommend.cjs abcd123 --cred ./sa.json");
    process.exit(1);
  }
  return cfg;
}

// ========= Firebase 初期化 =========
function initAdmin(credPath) {
  if (credPath && fs.existsSync(credPath)) {
    admin.initializeApp({ credential: admin.credential.cert(credPath) });
  } else {
    admin.initializeApp(); // Application Default Credentials でもOK
  }
  return admin.firestore();
}

const { Timestamp, FieldValue } = admin.firestore;

// ========= ユーティリティ =========
const days = (ms) => ms / 86400000;
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mad = (vals, med) => median(vals.map((v) => Math.abs(v - med)));

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v.toDate) return v.toDate();
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function genreFromUrl(url) {
  if (!url) return "";
  const m = url.match(/\/netsuper\/\d+\/(\d+)\.html/);
  return m ? m[1] : "";
}

function tokenizeName(name) {
  if (!name) return [];
  const s = String(name)
    .toLowerCase()
    .replace(/[（）()【】\[\]『』「」,:：、・\s]+/g, " ")
    .trim();
  const stop = new Set(["国内産","税込","本体","価格","限定","お受取り","受取り","パック","入り","など","各種","新商品","おすすめ","徳島"]);
  return s.split(/\s+/).filter(t => t.length >= 2 && !stop.has(t));
}

function stableKeyFromItem(it) {
  if (it?.url) return `url:${String(it.url)}`;
  if (it?.id) return `id:${String(it.id)}`;
  if (it?.name) return `name:${String(it.name).trim().toLowerCase()}`;
  return `row:${Math.random()}`;
}

function safeQty(it) {
  const v = it.quantity ?? it.qty ?? it.count ?? it.num ?? 1;
  const n = parseInt(v, 10);
  return isNaN(n) ? 1 : Math.max(1, n);
}

// ========= 履歴読み込み =========
async function loadHistory(db, uid, debug=false) {
  const col = db.collection(`users/${uid}/history`);
  const snaps = await col.orderBy("createdAt", "asc").get();

  const byItem = {}; // key -> { samples:[{date, quantity, name, url, id, genre, tokens}], anySample }
  const catCount = {};
  const tokenFreq = {}; // 全履歴トークン頻度

  for (const snap of snaps.docs) {
    const d = snap.data() || {};
    const purchasedAt =
      toDate(d.createdAt) || toDate(d.created_at) || snap.createTime.toDate();
    const items = Array.isArray(d.items) ? d.items : [];
    for (const it of items) {
      const url = it.url || "";
      const genre = it.genre || it.category || genreFromUrl(url) || "";
      const tokens = tokenizeName(it.name || "");
      const key = stableKeyFromItem(it);
      byItem[key] ||= { samples: [], anySample: it };
      byItem[key].samples.push({
        date: purchasedAt,
        quantity: safeQty(it),
        name: it.name || "",
        url,
        id: it.id ? String(it.id) : "",
        genre,
        tokens,
      });
      if (genre) catCount[genre] = (catCount[genre] || 0) + 1;
      for (const t of tokens) tokenFreq[t] = (tokenFreq[t] || 0) + 1;
    }
  }

  for (const k of Object.keys(byItem)) {
    byItem[k].samples.sort((a,b)=>a.date-b.date);
  }

  if (debug) {
    const totalDocs = snaps.size;
    const totalLines = Object.values(byItem).reduce((s,g)=>s+g.samples.length,0);
    console.log(`[debug] history docs=${totalDocs}, lines=${totalLines}, distinct items=${Object.keys(byItem).length}`);
  }

  return { byItem, catCount, tokenFreq };
}

// ========= 周期推定（前と同じ流儀） =========
function detectPeriod(samples, cfg) {
  if (samples.length < cfg.minOcc) return null;
  const dates = samples.map(s=>s.date);
  const gaps = [];
  for (let i=1;i<dates.length;i++) gaps.push(Math.round(days(dates[i] - dates[i-1])));
  const med = median(gaps);
  const variability = gaps.length ? mad(gaps, med)/(med || 1) : 1;
  if (med < cfg.periodMin || med > cfg.periodMax || variability > cfg.jitter) return null;
  const last = dates[dates.length-1];
  return {
    periodDays: med,
    variability,
    lastDate: last,
    nextDue: addDays(last, med),
    count: dates.length,
    avgQty: Math.round(samples.reduce((s,x)=>s+(x.quantity||1),0)/samples.length) || 1,
  };
}

function buildPeriodicRecs(byItem, cfg) {
  const now = new Date();
  const winStart = addDays(now, -cfg.dueWin);
  const winEnd   = addDays(now,  cfg.dueWin);

  const recs = [];
  for (const [key, group] of Object.entries(byItem)) {
    const stats = detectPeriod(group.samples, cfg);
    if (!stats) continue;
    const info = group.anySample || {};
    recs.push({
      kind: "periodic",
      key,
      name: info.name || "",
      url: info.url || "",
      id: info.id ? String(info.id) : "",
      suggestedQty: Math.max(1, stats.avgQty),
      periodDays: stats.periodDays,
      variability: stats.variability,
      lastPurchasedAt: stats.lastDate,
      nextDueAt: stats.nextDue,
      dueSoon: stats.nextDue >= winStart && stats.nextDue <= winEnd,
      score: Math.max(0, 1 - stats.variability),
      genre: info.genre || "",
    });
  }

  recs.sort((a,b)=>{
    const da = Math.abs((a.nextDueAt?.getTime?.()||a.nextDueAt) - Date.now());
    const db = Math.abs((b.nextDueAt?.getTime?.()||b.nextDueAt) - Date.now());
    return da !== db ? da - db : b.score - a.score;
  });
  return recs;
}

// ========= カタログ読み込み & インデックス =========
function loadCatalog(catalogPath, debug=false) {
  let p = catalogPath;
  if (!p) {
    if (fs.existsSync("./all_products.json")) p = "./all_products.json";
    else if (fs.existsSync("./fast_all_products.json")) p = "./fast_all_products.json";
  }
  if (!p || !fs.existsSync(p)) {
    throw new Error(`カタログJSONが見つかりません: ${catalogPath || "(auto)"}`);
  }
  const arr = JSON.parse(fs.readFileSync(p, "utf8"));
  // 正規化
  const items = arr
    .map(x => ({
      id: x.id ? String(x.id) : "",
      url: x.url || "",
      name: x.name || "",
      price: Number.isFinite(x.price) ? x.price : 0,
      price_tax: Number.isFinite(x.price_tax) ? x.price_tax : (Number.isFinite(x.price) ? x.price : 0),
      genre: (x.genre != null ? String(x.genre) : genreFromUrl(x.url || "")) || "",
      tokens: tokenizeName(x.name || "")
    }))
    .filter(it => it.url || it.id || it.name);
  const byGenre = {};
  for (const it of items) {
    byGenre[it.genre] ||= [];
    byGenre[it.genre].push(it);
  }
  if (debug) {
    console.log(`[debug] catalog: ${items.length} items, ${Object.keys(byGenre).length} genres, file=${path.resolve(p)}`);
  }
  return { items, byGenre };
}

// ========= 類似おすすめ（履歴 → カタログ） =========
function jaccard(a, b) {
  if (!a?.length || !b?.length) return 0;
  const A = new Set(a);
  let inter = 0;
  for (const t of b) if (A.has(t)) inter++;
  const uni = new Set([...a, ...b]).size;
  return inter / (uni || 1);
}

function buildSimilarRecs(historyByItem, tokenFreq, byGenreCat, catAll, limit=8) {
  // 履歴の上位ジャンルを優先
  const topGenres = Object.entries(catAll).sort((a,b)=>b[1]-a[1]).map(([g])=>g).slice(0,6);
  // 履歴トークン上位
  const topTokens = Object.entries(tokenFreq).sort((a,b)=>b[1]-a[1]).map(([t])=>t).slice(0,30);

  // 購入済み（重複回避）
  const boughtName = new Set();
  const boughtId = new Set();
  for (const group of Object.values(historyByItem)) {
    for (const s of group.samples) {
      if (s.name) boughtName.add(s.name.trim().toLowerCase());
      if (s.id) boughtId.add(String(s.id));
    }
  }

  const candidates = [];
  for (const g of topGenres.length ? topGenres : Object.keys(byGenreCat)) {
    const list = byGenreCat[g] || [];
    for (const it of list) {
      if (it.id && boughtId.has(String(it.id))) continue;
      if (it.name && boughtName.has(it.name.trim().toLowerCase())) continue;
      // 類似度: ジャンル一致ボーナス + トークンJaccard
      const tokenSim = jaccard(topTokens, it.tokens);
      const score = (topGenres.includes(g) ? 0.6 : 0.3) + tokenSim * 0.6;
      if (score > 0.35) {
        candidates.push({
          kind: "similar",
          key: it.url ? `url:${it.url}` : (it.id ? `id:${it.id}` : `name:${it.name.toLowerCase()}`),
          name: it.name,
          url: it.url,
          id: it.id,
          suggestedQty: 1,
          score,
          genre: it.genre,
        });
      }
    }
  }

  candidates.sort((a,b)=>b.score - a.score);
  // 重複除去
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    if (seen.has(c.key)) continue;
    seen.add(c.key);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

// ========= コールドスタート（カタログランダム） =========
function pickRandom(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

function buildCatalogRandom(byGenreCat, howMany=6) {
  const genres = Object.keys(byGenreCat);
  if (!genres.length || !howMany) return [];
  // ジャンルをラウンドロビンで回しながらランダム抽出
  const out = [];
  let gi = 0;
  const seen = new Set();
  while (out.length < howMany && gi < genres.length * 5) {
    const g = genres[gi % genres.length]; gi++;
    const list = byGenreCat[g] || [];
    if (!list.length) continue;
    const choice = pickRandom(list);
    const key = choice.url ? `url:${choice.url}` : (choice.id ? `id:${choice.id}` : `name:${choice.name.toLowerCase()}`);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      kind: "catalog-random",
      key,
      name: choice.name,
      url: choice.url,
      id: choice.id,
      suggestedQty: 1,
      score: 0.3,
      genre: choice.genre,
    });
  }
  return out;
}

// ========= Firestore 書き込み =========
async function writeRecommendations(db, uid, recs) {
  const col = db.collection(`users/${uid}/recommendations`);
  const batch = db.batch();
  for (const r of recs) {
    const docId = (r.key || String(Math.random())).replace(/[^\w.-]/g, "_").slice(0, 120);
    const ref = col.doc(docId);
    const data = {
      kind: r.kind,
      name: r.name || "",
      url: r.url || "",
      id: r.id || "",
      suggestedQty: r.suggestedQty || 1,
      score: r.score ?? 0,
      genre: r.genre || "",
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (r.periodDays) data.periodDays = r.periodDays;
    if (r.variability != null) data.variability = r.variability;
    if (r.lastPurchasedAt instanceof Date) data.lastPurchasedAt = Timestamp.fromDate(r.lastPurchasedAt);
    if (r.nextDueAt instanceof Date) data.nextDueAt = Timestamp.fromDate(r.nextDueAt);
    if (r.dueSoon != null) data.dueSoon = !!r.dueSoon;
    batch.set(ref, data, { merge: true });
  }
  await batch.commit();
}

// ========= Main =========
(async () => {
  const cfg = parseArgs();
  const db = initAdmin(cfg.cred);

  // 履歴
  const { byItem, catCount, tokenFreq } = await loadHistory(db, cfg.uid, cfg.debug);

  // カタログ
  const { items: catalogItems, byGenre: byGenreCat } = loadCatalog(cfg.catalog, cfg.debug);

  // 1) 周期
  const periodic = buildPeriodicRecs(byItem, cfg);

  // 2) 類似（履歴が1件でもあれば出す）
  let similar = [];
  if (Object.keys(byItem).length) {
    similar = buildSimilarRecs(byItem, tokenFreq, byGenreCat, catCount, Math.max(4, Math.floor(cfg.limit/2)));
  }

  // 3) ランダム（履歴が空の時は多め）
  const needRandom = Math.max(0, (cfg.addRandom || 0) + (Object.keys(byItem).length ? 0 : 4));
  const randoms = buildCatalogRandom(byGenreCat, needRandom);

  // 結合して上限に丸める（重複key除去）
  const merged = [...periodic, ...similar, ...randoms];
  const seen = new Set();
  const final = [];
  for (const r of merged) {
    if (seen.has(r.key)) continue;
    seen.add(r.key);
    final.push(r);
    if (final.length >= cfg.limit) break;
  }

  if (cfg.debug) {
    const k = (t)=>final.filter(x=>x.kind===t).length;
    console.log(`[debug] periodic=${k("periodic")} similar=${k("similar")} random=${k("catalog-random")} total=${final.length}`);
  }

  await writeRecommendations(db, cfg.uid, final);
  console.log(`wrote ${final.length} recommendations to users/${cfg.uid}/recommendations`);
})();
