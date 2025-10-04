import json
from pathlib import Path
import numpy as np

# 正規化対象の栄養素
HEALTH_POS = ["vitamin_c_mg", "fiber_g", "calcium_mg"]        # 多いほど良い
HEALTH_NEG = ["salt_g", "cholesterol_mg", "potassium_mg"]     # 少ないほど良い

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
    p10 = float(np.percentile(values, 1))
    p90 = float(np.percentile(values, 99))
    return p10, p90

def normalize_health(data):
    """健康モード用に 0〜1 正規化して health_score を付与"""
    stats = {col: compute_p10_p90(data, col) for col in (HEALTH_POS + HEALTH_NEG)}

    normalized = []
    for item in data:
        scores = []

        # 多いほど良い
        for col in HEALTH_POS:
            p10, p90 = stats[col]
            val = as_float(item.get(col))
            if val is None or p10 is None or p90 is None or p10 == p90:
                continue
            if val <= p10:
                s = 0.0
            elif val >= p90:
                s = 1.0
            else:
                s = (val - p10) / (p90 - p10)
            scores.append(s)

        # 少ないほど良い（逆向き）
        for col in HEALTH_NEG:
            p10, p90 = stats[col]
            val = as_float(item.get(col))
            if val is None or p10 is None or p90 is None or p10 == p90:
                continue
            if val <= p10:
                s = 1.0
            elif val >= p90:
                s = 0.0
            else:
                s = (p90 - val) / (p90 - p10)
            scores.append(s)

        # 健康スコア（単純平均）
        item = item.copy()
        item["health_score"] = float(np.mean(scores)) if scores else None
        normalized.append(item)

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

def build_items_for_solver(products_normalized):
    """
    solver用に必要なフィールドを補完。
    - price_yen が無い場合は priceTax を整数化して埋める
    - health_score が None のものは除外（健康モード仕様）
    """
    Items = []
    for p in products_normalized:
        hs = p.get("health_score")
        if hs is None:
            continue
        price_yen = int(round(p.get("price_yen", p.get("priceTax", 0))))
        Items.append({
            "id": p["id"],
            "name": p.get("name"),
            "category": p.get("category"),
            "price_yen": price_yen,
            "health_score": float(hs),
        })
    return Items

if __name__ == "__main__":
    # 入力: スクレイパーの出力
    input_path = Path(__file__).resolve().parent.parent / "foodDataUpdate" / "foodData.json"
    with open(input_path, "r", encoding="utf-8") as f:
        products = json.load(f)

    # 0〜1正規化（健康スコア付与）
    normalized = normalize_health(products)


    Items = build_items_for_solver(normalized)
    if not Items:
        print("[ERROR] 健康スコア計算済みのアイテムがありません")
        raise SystemExit(1)

    # 第1段：H最大化（最適解）
    sol_opt = solve_one(Items, BUDGET_YEN, SELECTED_CATEGORIES, H_floor_ratio=None, forbid_overlap_with=None)
    if sol_opt is None or not sol_opt["ids"]:
        print("[ERROR] 解が見つかりませんでした（最適解）")
        raise SystemExit(1)
    H_star = sol_opt["H"]

    # 第2段：残額最小化（H を最適値まで固定）
    sol_opt2 = solve_one(
        Items, BUDGET_YEN, SELECTED_CATEGORIES,
        H_floor_ratio=H_star - 1e-9,
        forbid_overlap_with=None 
    )
    best = sol_opt2 or sol_opt

    # 出力作成（最適解のみ）
    def pick_items(ids):
        s = []
        idset = set(ids)
        for it in Items:
            if it["id"] in idset:
                s.append(it)
        return s

    results = {
        "optimal": {
            "H": best["H"],
            "price_sum": best["price_sum"],
            "items": pick_items(best["ids"]),
        },
        "meta": {
            "budget_yen": BUDGET_YEN,
            "selected_categories": SELECTED_CATEGORIES,
            "H_star": H_star,
            "quality_drop_max": QUALITY_DROP,
        }
    }

    # 保存
    out_path = Path(__file__).resolve().parent / "optimized_results.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"[WRITE] {out_path}")