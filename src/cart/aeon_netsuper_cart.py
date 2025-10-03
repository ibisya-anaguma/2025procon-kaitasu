#!/usr/bin/env python3
import os
import sys
import re
import json
import time
import argparse
import logging
import tempfile
import urllib.request
import subprocess
import contextlib
from typing import List, Dict, Optional, Tuple, Any

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import WebDriverException, NoSuchWindowException
from webdriver_manager.chrome import ChromeDriverManager

# ==== Firebase / Firestore ====
import firebase_admin
from firebase_admin import credentials as fb_credentials
from firebase_admin import firestore as fb_firestore
from google.cloud import firestore  # SERVER_TIMESTAMP / Query

# ========= 固定（イオン徳島） =========
STORE_ID = "01050000036000"
HOME_URL     = f"https://shop.aeon.com/netsuper/{STORE_ID}/"
LOGIN_URL    = "https://shop.aeon.com/netsuper/customer/account/login/"
CHECKOUT_URL = f"https://shop.aeon.com/netsuper/{STORE_ID}/checkout/cart/"

DEFAULT_USER_DATA_DIR = os.path.expanduser("~/ChromeSeleniumCart")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ========= Chrome起動 =========
def build_driver(user_data_dir: Optional[str], headless: bool) -> webdriver.Chrome:
    opts = Options()
    if headless:
        opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1400,1000")
    if user_data_dir:
        u = os.path.expanduser(user_data_dir)
        os.makedirs(u, exist_ok=True)
        opts.add_argument(f"--user-data-dir={u}")
    service = Service(ChromeDriverManager().install())
    try:
        return webdriver.Chrome(service=service, options=opts)
    except WebDriverException as e:
        if "user data directory is already in use" in str(e):
            tmp = tempfile.mkdtemp(prefix="selenium-profile-")
            logger.warning("指定プロファイルが使用中 → 一時プロファイルで再試行: %s", tmp)
            if hasattr(opts, "arguments"):
                opts.arguments = [a for a in opts.arguments if not a.startswith("--user-data-dir=")]
            opts.add_argument(f"--user-data-dir={tmp}")
            return webdriver.Chrome(service=service, options=opts)
        raise

# ========= ログイン検知 =========
def is_logged_in(driver: webdriver.Chrome) -> bool:
    try:
        if driver.find_elements(By.CSS_SELECTOR, 'a[href*="/customer/account/logout"]'): return True
        if driver.find_elements(By.CSS_SELECTOR, 'a[href*="/customer/account/"]'): return True
    except Exception:
        pass
    return False

def is_login_page(driver: webdriver.Chrome) -> bool:
    try:
        url = driver.current_url or ""
    except Exception:
        url = ""
    if "/customer/account/login" in url: return True
    try:
        if driver.find_elements(By.CSS_SELECTOR, 'form[action*="login"] input[type="password"]'):
            return True
    except Exception:
        pass
    return False

def ensure_logged_in(driver: webdriver.Chrome, wait: WebDriverWait, max_wait_sec: int = 300):
    driver.get(HOME_URL)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    if is_logged_in(driver):
        logger.info("ログイン済みを検知。続行します。")
        return
    driver.get(LOGIN_URL)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    logger.info("ログインが必要です。開いたブラウザでログインを完了してください（最長 %s 秒待機）。", max_wait_sec)
    end = time.time() + max_wait_sec
    while time.time() < end:
        time.sleep(0.6)
        if is_logged_in(driver):
            logger.info("ログイン完了を検知しました。続行します。")
            return
        if not is_login_page(driver):
            logger.info("ログインページ以外に遷移を検知。続行します。")
            return
    raise RuntimeError("ログイン待機がタイムアウトしました。")

# ========= ポップアップ軽減 =========
def try_close_common_popups(driver: webdriver.Chrome) -> None:
    for xp in [
        "//button[contains(.,'同意') or contains(.,'OK') or contains(.,'閉じる')]",
        "//div[contains(@class,'cookie')]//button",
    ]:
        with contextlib.suppress(Exception):
            el = driver.find_element(By.XPATH, xp)
            if el and el.is_displayed():
                driver.execute_script("arguments[0].click();", el)
                time.sleep(0.2)

# ========= ボタン探索/クリック =========
def _first_displayed(driver: webdriver.Chrome, selectors_css: List[str], xpaths: List[str]):
    for sel in selectors_css:
        with contextlib.suppress(Exception):
            el = driver.find_element(By.CSS_SELECTOR, sel)
            if el and el.is_displayed():
                return el, "css", sel
    for xp in xpaths:
        with contextlib.suppress(Exception):
            el = driver.find_element(By.XPATH, xp)
            if el and el.is_displayed():
                return el, "xpath", xp
    return None

def _keywords_from_name(name: str) -> List[str]:
    if not name: return []
    s = name.strip()
    for ch in "（）()【】[]『』「」,:：、・　 ":
        s = s.replace(ch, " ")
    toks = [t for t in s.split() if len(t) >= 3]
    if not toks: return [name[:8]]
    keys = [toks[0], toks[len(toks)//2], toks[-1]]
    keys = [k for i, k in enumerate(keys) if k and k not in keys[:i]]
    if name[:8] not in keys: keys.append(name[:8])
    return keys

def find_add_to_cart_by_id(driver: webdriver.Chrome, product_id: str):
    pid = (product_id or "").strip()
    if not pid: return None
    css = [
        f'button[data-product-id="{pid}"]',
        f'button[data-id="{pid}"]',
        f'button[data-pid="{pid}"]',
        f'button[data-sku="{pid}"]',
        f'a[data-product-id="{pid}"]',
        f'button[value="{pid}"]',
    ]
    return _first_displayed(driver, css, [])

def find_add_to_cart_by_name(driver: webdriver.Chrome, product_name: str):
    if not product_name: return None
    keys = _keywords_from_name(product_name)
    btn_xpath = ".//button[contains(.,'カゴ') or contains(.,'カート') or contains(.,'追加') or contains(.,'購入')]"
    for kw in keys:
        with contextlib.suppress(Exception):
            el = driver.find_element(
                By.XPATH,
                f"(//*[contains(normalize-space(.), '{kw}') and not(self::script or self::style) and string-length(normalize-space(.)) < 300])[1]"
            )
            card = el.find_element(By.XPATH, f"ancestor-or-self::*[{btn_xpath[2:]}][1]")
            btn = card.find_element(By.XPATH, btn_xpath)
            if btn and btn.is_displayed():
                return btn, "xpath", btn_xpath
    return None

def find_add_to_cart_generic(driver: webdriver.Chrome):
    xps = [
        "//button[contains(.,'カゴ') or contains(.,'カート') or contains(.,'追加') or contains(.,'購入')]",
        "//a[contains(.,'カゴ') or contains(.,'カート') or contains(.,'追加') or contains(.,'購入')]",
        "//button[contains(@aria-label,'カゴ') or contains(@aria-label,'カート')]",
        "//button[contains(@title,'カゴ') or contains(@title,'カート')]",
    ]
    return _first_displayed(driver, [], xps)

def get_cart_count(driver):
    sels = [
        'span.header-cart-count',
        'span.cart-count-badge',
        'a[href*="cart"] .count',
        '[aria-label*="カート"] .count',
        '.header-cart .count',
    ]
    for sel in sels:
        with contextlib.suppress(Exception):
            el = driver.find_element(By.CSS_SELECTOR, sel)
            txt = (el.text or "").strip()
            if txt.isdigit():
                return int(txt)
    return None

def wait_cart_added(driver, before_count=None, expected_delta=1, timeout=12):
    end = time.time() + timeout
    xps = [
        "//*[contains(.,'カートに入れました')]",
        "//*[contains(.,'カートに追加')]",
        "//*[contains(.,'追加しました')]",
        "//*[contains(.,'カゴに入れました')]",
    ]
    while time.time() < end:
        for xp in xps:
            with contextlib.suppress(Exception):
                el = driver.find_element(By.XPATH, xp)
                if el.is_displayed():
                    return True
        after = get_cart_count(driver)
        if before_count is not None and after is not None and after - before_count >= expected_delta:
            return True
        time.sleep(0.3)
    return False

def add_to_cart(driver: webdriver.Chrome, wait: WebDriverWait,
                product_id: str, qty: int = 1, name: str = "", url: str = ""):
    try:
        qty = max(1, int(qty))
    except Exception:
        qty = 1

    if url:
        driver.get(url)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        try_close_common_popups(driver)
        time.sleep(0.3)

    logger.info("Adding: %s x%d (ID=%s)", (name or "(no-name)"), qty, (product_id or "N/A"))

    found = None
    if product_id and driver.page_source.find(str(product_id)) == -1:
        logger.info("[INFO] page_source に product_id=%s は未検出（ID非掲載ページ想定）", product_id)
    if not found and product_id: found = find_add_to_cart_by_id(driver, str(product_id))
    if not found and name:       found = find_add_to_cart_by_name(driver, name)
    if not found:                found = find_add_to_cart_generic(driver)
    if not found:
        raise RuntimeError("カゴ追加ボタンが見つかりません")

    el, kind, sel = found
    before = get_cart_count(driver)

    for _ in range(qty):
        try:
            if kind == "css":
                wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, sel)))
            else:
                wait.until(EC.element_to_be_clickable((By.XPATH, sel)))
            try:
                el.click()
            except Exception:
                driver.execute_script("arguments[0].click();", el)
        except NoSuchWindowException:
            handles = driver.window_handles
            if handles:
                driver.switch_to.window(handles[-1])
            found2 = (find_add_to_cart_by_id(driver, str(product_id))
                      or find_add_to_cart_by_name(driver, name)
                      or find_add_to_cart_generic(driver))
            if not found2:
                raise
            el, kind, sel = found2
            driver.execute_script("arguments[0].click();", el)
        time.sleep(0.6)

        if is_login_page(driver):
            logger.info("クリック後にログイン画面へ遷移。ログイン完了を待ちます。")
            ensure_logged_in(driver, wait, 300)
            if url:
                driver.get(url)
                wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            found2 = (find_add_to_cart_by_id(driver, str(product_id))
                      or find_add_to_cart_by_name(driver, name)
                      or find_add_to_cart_generic(driver))
            if not found2:
                raise RuntimeError("ログイン後にカゴボタンが見つかりません")
            el, kind, sel = found2
            driver.execute_script("arguments[0].click();", el)
            time.sleep(0.6)

        ok = wait_cart_added(driver, before_count=before, expected_delta=1, timeout=12)
        if ok:
            now = get_cart_count(driver)
            if now is not None:
                before = now
        else:
            logger.warning("カート投入の確認がとれませんでした（トースト/バッジ未検知）")

# ========= Firestore (users/{uid}/purchase/{purchaseId}) =========
def fb_client(cred_path: str, project_id: Optional[str]) -> fb_firestore.Client:
    if not firebase_admin._apps:
        cred = fb_credentials.Certificate(os.path.expanduser(cred_path))
        firebase_admin.initialize_app(cred, {"projectId": project_id} if project_id else None)
    return fb_firestore.client()

def collection_from_path(db: fb_firestore.Client, col_path: str) -> fb_firestore.CollectionReference:
    parts = [p for p in col_path.split("/") if p]
    if len(parts) % 2 == 0:
        raise ValueError(f"コレクションパスが不正（偶数セグメント）: {col_path}")
    ref = db
    for i, seg in enumerate(parts):
        ref = ref.collection(seg) if i % 2 == 0 else ref.document(seg)
    return ref  # type: ignore

def safe_qty(d: Dict[str, Any]) -> int:
    for k in ("quantity", "qty", "count", "num"):
        if k in d:
            try: return max(1, int(d[k]))
            except Exception: pass
    return 1

def id_from_any(v: Any, url: str = "") -> str:
    if url:
        m = re.search(r"/(\d{8,})\.html(?:[?#].*)?$", url)
        if m: return m.group(1)
    if isinstance(v, str): return v.strip()
    if isinstance(v, int): return str(v)
    return ""

def items_from_purchase_doc(snap: fb_firestore.DocumentSnapshot) -> List[Dict]:
    data = snap.to_dict() or {}
    raw = data.get("items")
    if not isinstance(raw, list): return []
    out: List[Dict] = []
    for it in raw:
        if not isinstance(it, dict): continue
        url = (it.get("url") or "").strip()
        pid = id_from_any(it.get("id"), url)
        name = (it.get("name") or it.get("title") or "").strip()
        qty = safe_qty(it)
        if not any([url, pid, name]): continue
        out.append({"id": pid, "url": url, "name": name, "qty": qty})
    return out

def fetch_items(db: fb_firestore.Client,
                purchase_col_path: str,
                purchase_doc: Optional[str]) -> Tuple[str, List[Dict]]:
    col = collection_from_path(db, purchase_col_path)
    if purchase_doc:
        snap = col.document(purchase_doc).get()
        if not snap.exists:
            raise RuntimeError(f"purchase ドキュメントが存在しません: {purchase_doc}")
        return snap.id, items_from_purchase_doc(snap)
    snaps: List[fb_firestore.DocumentSnapshot] = []
    try:
        snaps = list(col.order_by("createdAt", direction=firestore.Query.DESCENDING).limit(1).stream())
    except Exception:
        snaps = list(col.stream())[:1]
    if not snaps:
        return "", []
    snap = snaps[0]
    return snap.id, items_from_purchase_doc(snap)

# ========= カート読み取り & 差分計算 =========
def open_cart(driver: webdriver.Chrome, wait: WebDriverWait):
    driver.get(CHECKOUT_URL)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    try_close_common_popups(driver)
    time.sleep(0.3)

def norm_name(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[（）()【】\[\]『』「」,:：、・\s]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def product_id_from_url(url: str) -> str:
    if not url: return ""
    m = re.search(r"/(\d{8,})\.html", url)
    return m.group(1) if m else ""

def scrape_cart(driver: webdriver.Chrome) -> List[Dict]:
    """カートページから {id/url/name/qty} を取得"""
    items: List[Dict] = []
    # 代表リンクを拾う
    links = driver.find_elements(By.CSS_SELECTOR, 'a.product-item-link, .cart a[href*="/netsuper/"][href$=".html"]')
    seen = set()
    for a in links:
        with contextlib.suppress(Exception):
            href = a.get_attribute("href") or ""
            name = (a.text or "").strip()
            # 行コンテナ（tr or div.card など）
            row = a.find_element(By.XPATH, "ancestor::tr[1] | ancestor::li[1] | ancestor::div[contains(@class,'item') or contains(@class,'cart')][1]")
            qty = None
            # inputで数量取得
            with contextlib.suppress(Exception):
                inp = row.find_element(By.CSS_SELECTOR, "input[name*='qty'], input[type='number']")
                val = (inp.get_attribute("value") or "").strip()
                if val.isdigit(): qty = int(val)
            # テキストで数量取得
            if qty is None:
                with contextlib.suppress(Exception):
                    span = row.find_element(By.XPATH, ".//*[contains(@class,'qty') or contains(.,'数量')][1]")
                    txt = (span.text or "").strip()
                    m = re.search(r"(\d+)", txt)
                    if m: qty = int(m.group(1))
            qty = qty or 1
            pid = product_id_from_url(href)
            key = (pid or norm_name(name) or href)
            if key in seen:  # 同一商品重複は合算
                for it in items:
                    if it.get("_key")==key:
                        it["qty"] += qty
                        break
            else:
                items.append({"id": pid, "url": href, "name": name, "qty": qty, "_key": key})
                seen.add(key)
    return items

def plan_topup(desired: List[Dict], current: List[Dict]) -> List[Dict]:
    """desired（Firestore）を current（カート）に対して不足分だけ追加する計画を返す"""
    # 現在の数量をキー別に
    cur_map: Dict[str, int] = {}
    def key_of(it: Dict) -> str:
        return (it.get("id") or product_id_from_url(it.get("url","")) or norm_name(it.get("name","")))

    for it in current:
        k = it.get("_key") or key_of(it)
        cur_map[k] = cur_map.get(k, 0) + int(it.get("qty",1) or 1)

    plan: List[Dict] = []
    for it in desired:
        tgt = int(it.get("qty",1) or 1)
        k = key_of(it)
        have = cur_map.get(k, 0)
        need = max(0, tgt - have)
        if need > 0:
            plan.append({"id": it.get("id",""), "url": it.get("url",""), "name": it.get("name",""), "qty": need})
    return plan

# ========= CLI =========
def parse_args():
    p = argparse.ArgumentParser(description="AEON 徳島 | Firestore users/{uid}/purchase を読み、現カートを見て不足分だけトップアップ")
    # Chrome
    p.add_argument("--user-data-dir", default=DEFAULT_USER_DATA_DIR, help="Chrome のユーザープロファイル（ログイン保持）")
    p.add_argument("--headless", action="store_true", help="ヘッドレスで起動（ログイン時は非推奨）")
    # Firebase
    p.add_argument("--use-firebase", action="store_true", help="Firestore を利用する場合に指定")
    p.add_argument("--fb-cred", default=os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", ""), help="サービスアカウント JSON のパス")
    p.add_argument("--fb-project", default="", help="（任意）プロジェクトID。通常は JSON から自動")
    p.add_argument("--purchase-path", default="users/uid/purchase", help="例: users/<あなたのuid>/purchase")
    p.add_argument("--purchase-doc", default="", help="特定の purchase ドキュメントID（省略で最新1件）")
    # 挙動
    p.add_argument("--topup-only", action="store_true", help="（既定）現在カートの不足分だけ入れる")
    p.add_argument("--dry-run", action="store_true", help="追加せず計画だけログに出す")
    p.add_argument("--sleep-after-add", type=float, default=0.5, help="1商品投入後の待機秒")
    p.add_argument("--go-checkout", action="store_true", help="全投入後にカート画面へ移動")
    p.add_argument("--keep-open", action="store_true", help="終了後もブラウザを開いたままにする")
    return p.parse_args()

# ========= メイン =========
def main():
    args = parse_args()

    # Driver
    try:
        driver = build_driver(args.user_data_dir, args.headless)
        logger.info("Chrome 起動完了")
    except WebDriverException as e:
        logger.error(f"Chrome 起動失敗: {e}")
        sys.exit(1)
    wait = WebDriverWait(driver, 15)

    try:
        # ログイン（プロファイルで基本維持、未ログインなら待機）
        ensure_logged_in(driver, wait, max_wait_sec=300)

        if not args.use_firebase:
            logger.error("--use-firebase を付けてください。")
            return

        credp = os.path.expanduser(args.fb_cred)
        if not credp or not os.path.exists(credp):
            logger.error("サービスアカウントJSONが見つかりません: %s", args.fb_cred)
            return

        db = fb_client(credp, args.fb_project or None)

        # Firestore items 取得
        doc_id, desired = fetch_items(db, args.purchase_path, args.purchase_doc)
        logger.info("purchase doc=%s から %d 件の items を取得", (doc_id or "(none)"), len(desired))

        # 現在のカートを読む
        open_cart(driver, wait)
        current = scrape_cart(driver)
        logger.info("現在のカート: %d アイテム", len(current))

        # トップアップ計画を作成
        plan = plan_topup(desired, current) if (args.topup_only or True) else desired
        if not plan:
            logger.info("不足分はありません。追加処理はスキップします。")
        else:
            logger.info("不足分 %d 件 → 追加します。", len(plan))
            for it in plan:
                logger.info("Top-up: %s x%d", it.get("name") or it.get("id") or it.get("url"), int(it.get("qty",1) or 1))
            if not args.dry_run:
                for it in plan:
                    try:
                        add_to_cart(
                            driver, wait,
                            product_id=str(it.get("id") or ""),
                            qty=int(it.get("qty", 1) or 1),
                            name=it.get("name", ""),
                            url=(it.get("url") or "")
                        )
                        time.sleep(args.sleep_after_add)
                    except Exception as e:
                        logger.error(f"Failed to add {it.get('name') or it.get('id') or 'N/A'}: {e}")

        # 最終カートへ移動
        if args.go_checkout:
            with contextlib.suppress(Exception):
                driver.get(CHECKOUT_URL)
                wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            logger.info("カート画面へ移動しました: %s", CHECKOUT_URL)

        logger.info("完了しました。ブラウザは%sです。カートをご確認ください。",
                    "開いたまま" if args.keep_open else "閉じます")

        if args.keep_open:
            while True:
                time.sleep(1)

    finally:
        if not args.keep_open:
            with contextlib.suppress(Exception):
                driver.quit()

if __name__ == "__main__":
    main()
