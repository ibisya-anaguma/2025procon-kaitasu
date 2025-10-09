import json
from pathlib import Path
import numpy as np

def as_float(v):
    if v is None:
        return None
    if isinstance(v, str):
        if v == "":
            return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None

def compute_p10_p90(data, key):
    """与えられた栄養素について P10, P90 を返す"""
    values = [as_float(x.get(key)) for x in data]
    values = [v for v in values if v is not None]
    if not values:
        return None, None
    p10 = float(np.percentile(values, 10))
    p90 = float(np.percentile(values, 90))
    return p10, p90

def normalize_health(data, prefs: dict):
    """
    data: 製品配列（foodData.json）
    prefs: { nutrient_key: "up"|"down" }  ※"none"は来ない想定、来たら無視
    """

    # up/down のみ採用
    raw_keys = [k for k, v in prefs.items() if v in ("up", "down")]

    # データ側にそのキーが1つでも存在するものだけに絞る（安全対策）
    active_keys = []
    for k in raw_keys:
        if any(k in item for item in data):
            active_keys.append(k)

    # 何も有効キーが無ければ health_score を付けられないので素通し
    if not active_keys:
        normalized = []
        for item in data:
            new_item = item.copy()
            new_item["health_score"] = None
            normalized.append(new_item)
        return normalized

    # 各キーの P10/P90
    stats = {k: compute_p10_p90(data, k) for k in active_keys}

    normalized = []
    for item in data:
        scores = []
        for k in active_keys:
            direction = prefs[k]
            p10, p90 = stats.get(k, (None, None))
            val = as_float(item.get(k))
            if val is None or p10 is None or p90 is None or p10 == p90:
                continue

            if direction == "up":
                s = 0.0 if val <= p10 else (1.0 if val >= p90 else (val - p10) / (p90 - p10))
            elif direction == "down":
                s = 1.0 if val <= p10 else (0.0 if val >= p90 else (p90 - val) / (p90 - p10))
            else:
                continue  # 念のため
            scores.append(s)

        new_item = item.copy()
        new_item["health_score"] = float(np.mean(scores)) if scores else None
        normalized.append(new_item)

    return normalized

# ===== ここから PuLP で最適化（H最大化 → 残額最小化のレキシコ最適） =====
from math import ceil
from pulp import LpProblem, LpVariable, LpMaximize, lpSum, LpBinary, PULP_CBC_CMD

def solve_one(Items, budget_yen, selected_categories=None, H_floor_ratio=None, forbid_overlap_with=None):
    """
    1回の最適化を解く。
    - Items: dictのリスト（id, price_yen, category, health_score を含む）
    - budget_yen: 予算（整数円）
    - selected_categories: None ならカテゴリ制約なし / listなら各カテゴリ>=1
    - H_floor_ratio: NoneならH最大化、値があれば H >= その値 を下限にして price 最大化
    - forbid_overlap_with: idのset（今回 None 固定で未使用でもOK）
    """
    n = len(Items)
    id2idx = {it["id"]: i for i, it in enumerate(Items)}

    # 変数
    x = [LpVariable(f"x_{i}", lowBound=0, upBound=1, cat=LpBinary) for i in range(n)]

    # モデル
    m = LpProblem("kaitasu_health", LpMaximize)

    price = [int(round(it.get("price_yen", int(round(it.get("priceTax", 0)))))) for it in Items]
    health = [float(it["health_score"]) for it in Items]

    # 予算（超過NG）
    m += lpSum(price[i] * x[i] for i in range(n)) <= int(budget_yen)

    # カテゴリ制約（各カテゴリ >= 1）
    if selected_categories:
        for cat in selected_categories:
            m += lpSum(x[i] for i in range(n) if Items[i].get("category") == cat) >= 1, f"cat_{cat}_ge1"

    # 差分制約（今回は未使用だが、将来のために残しておく）
    if forbid_overlap_with is not None and len(forbid_overlap_with) > 0:
        overlap_indices = [id2idx[_id] for _id in forbid_overlap_with if _id in id2idx]
        m += lpSum(x[i] for i in overlap_indices) <= n - ceil(0.3 * n), "overlap_le_cap"

    # 目的
    if H_floor_ratio is None:
        # 第1段：H を最大化
        m += lpSum(health[i] * x[i] for i in range(n))
    else:
        # 第2段：H の下限を満たしつつ price を最大化（残額最小化）
        m += lpSum(health[i] * x[i] for i in range(n)) >= H_floor_ratio, "H_floor"
        m += lpSum(price[i] * x[i] for i in range(n))

    # 解く
    status = m.solve(PULP_CBC_CMD(msg=False))
    if status != 1:  # LpStatusOptimal == 1
        return None

    pick_ids = [Items[i]["id"] for i in range(n) if x[i].value() == 1]
    H_val = sum(health[i] for i in range(n) if x[i].value() == 1)
    price_sum = sum(price[i] for i in range(n) if x[i].value() == 1)

    return {
        "ids": pick_ids,
        "H": H_val,
        "price_sum": price_sum,
    }

def _solve_price_only(Items, budget_yen):
    n = len(Items)
    x = [LpVariable(f"x_{i}", 0, 1, LpBinary) for i in range(n)]
    m = LpProblem("kaitasu_price", LpMaximize)
    price = [int(round(it.get("price_yen", 0))) for it in Items]
    m += lpSum(price[i] * x[i] for i in range(n)) <= int(budget_yen)
    m += lpSum(price[i] * x[i] for i in range(n))
    status = m.solve(PULP_CBC_CMD(msg=False))
    if status != 1:
        return None
    pick_ids = [Items[i]["id"] for i in range(n) if x[i].value() == 1]
    price_sum = sum(price[i] for i in range(n) if x[i].value() == 1)
    return {"ids": pick_ids, "price_sum": price_sum}

def build_items_for_solver(products, require_health=True):
    """
    solver用に必要なフィールドを補完。
    - price_yen が無い場合は priceTax を整数化して埋める
    - health_score が None のものは除外（健康モード仕様）
    """
    Items = []
    for p in products:
        price_yen = int(round(p.get("price_yen", p.get("priceTax", 0) or 0)))
        hs = p.get("health_score")
        if require_health and hs is None:
            continue
        Items.append({
            "id": p["id"], "name": p.get("name"), "category": p.get("category"),
            "price_yen": price_yen, "health_score": hs,
        })
    return Items

def to_api_shape(products, ids):
    """最適化で選ばれた id のリストを APIレスポンス形式に変換"""
    idset = set(ids)
    out = []
    for p in products:
        if p["id"] in idset:
            out.append({
                "id": p["id"],
                "genre": p.get("genre") or p.get("category"),  # JSONのキーに応じて拾う
                "name": p.get("name"),
                "price": int(round(p.get("price_yen", p.get("priceTax", 0) or 0))),
                "imgUrl": p.get("imgUrl"),
            })
    return out

# ====== main ======
if __name__ == "__main__":
    import argparse
    import json
    from pathlib import Path

    # --- 引数の定義 ---
    parser = argparse.ArgumentParser(description="かいたす: 組み合わせ最適化スクリプト")
    parser.add_argument("--prefs-json", type=str, default="", help="Firebaseから渡す up/down の辞書(JSON文字列)")
    parser.add_argument("--input", type=str, default="", help="入力JSONファイルパス")
    parser.add_argument("--budget", type=int, default=2500, help="予算（円）")
    parser.add_argument("--health", type=str, default="true", help="健康重視モード true/false")
    args = parser.parse_args()

    # --- 基本設定 ---
    BUDGET_YEN = args.budget
    HEALTH_MODE = args.health.lower() in ["true", "1", "yes", "on"]

    # --- json読み込み ---
    with open(Path(__file__).resolve().parent.parent / "data" / "foodData.json", "r", encoding="utf-8") as f:
        products = json.load(f)

    # --- Firebaseからの prefs を読み取り ---
    user_prefs = {}
    if args.prefs_json:
        try:
            user_prefs = json.loads(args.prefs_json)
        except Exception:
            user_prefs = {}

    normalized = normalize_health(products, user_prefs)
            
    # ==== モード分岐 ====
    if HEALTH_MODE:
        Items = build_items_for_solver(normalized, require_health=True)

        if not Items:
            raise SystemExit(1)

        # 第1段：H最大化
        sol_opt = solve_one(Items, BUDGET_YEN, selected_categories=None)
        if sol_opt is None or not sol_opt["ids"]:
            raise SystemExit(1)
        H_star = sol_opt["H"]

        # 第2段：残額最小化（同H）
        sol_opt2 = solve_one(
            Items, BUDGET_YEN, selected_categories=None,
            H_floor_ratio=H_star - 1e-9, forbid_overlap_with=None
        )
        best = sol_opt2 or sol_opt

        result = {
            "mode": "health",
            "H": best["H"],
            "price_sum": best["price_sum"],
            "ids": best["ids"],
        }

    else:
        Items = build_items_for_solver(products, require_health=False)

        if not Items:
            raise SystemExit(1)

        sol_price = _solve_price_only(Items, BUDGET_YEN)
        if sol_price is None or not sol_price["ids"]:
            raise SystemExit(1)

        result = {
            "mode": "price",
            "price_sum": sol_price["price_sum"],
            "ids": sol_price["ids"],
        }

    # ==== 出力 ====
    result_items = to_api_shape(products, result["ids"])
    print(json.dumps(result_items, ensure_ascii=False))