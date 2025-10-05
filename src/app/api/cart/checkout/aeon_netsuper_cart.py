#!/usr/bin/env python3
# -*- coding: utf-8 -*-

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
DEFAULT_DEBUG_ADDR    = "127.0.0.1:9222"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ========= DevTools 検出/起動（既存ブラウザへアタッチ） =========
def _devtools_info(addr: str, timeout: float = 1.0) -> Optional[dict]:
    try:
        with urllib.request.urlopen(f"http://{addr}/json/version", timeout=timeout) as r:
            if r.status != 200:
                return None
            return json.load(r)
    except Exception:
        return None

def devtools_is_valid_chrome(addr: str) -> bool:
    info = _devtools_info(addr)
    if not info:
        return False
    if not info.get("webSocketDebuggerUrl"):
        return False
    browser = (info.get("Browser") or "").lower()
    # Brave/Edge も chromium ベースなので OK
    return ("chrome" in browser) or ("chromium" in browser) or ("brave" in browser) or ("edge" in browser)

def ensure_debugger_up(addr: str,
                       browser: str = "chrome",
                       user_data_dir: Optional[str] = None,
                       profile_dir: Optional[str] = None,
                       timeout: int = 10) -> bool:
    """macOS向け：指定ブラウザを DevTools ポートで起動 or 既存へ接続"""
    if devtools_is_valid_chrome(addr):
        return True

    # macOS のアプリ名
    app_map = {
        "chrome": "Google Chrome",
        "brave":  "Brave Browser",
        "edge":   "Microsoft Edge",
    }
    app = app_map.get(browser.lower(), "Google Chrome")

    # macOS 以外は自動起動を諦めて、既に起動している前提（Windows/Linuxは手動で起動しておく）
    if sys.platform != "darwin":
        return devtools_is_valid_chrome(addr)

    args = ["open", "-na", app, "--args", f"--remote-debugging-port={addr.split(':')[-1]}"]
    if user_data_dir:
        u = os.path.expanduser(user_data_dir)
        os.makedirs(u, exist_ok=True)
        args.append(f"--user-data-dir={u}")
    if profile_dir:
        args.append(f"--profile-directory={profile_dir}")

    with contextlib.suppress(Exception):
        subprocess.Popen(args)

    for _ in range(timeout * 2):
        if devtools_is_valid_chrome(addr):
            return True
        time.sleep(0.5)
    return devtools_is_valid_chrome(addr)

def build_driver_attach(addr: str) -> webdriver.Chrome:
    opts = Options()
    opts.add_experimental_option("debuggerAddress", addr)
    logger.info("既存ブラウザにアタッチ: %s", addr)
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=opts)

# ========= Chrome/Chromium 新規起動（非推奨・ログイン飛びやすい） =========
def build_driver_new(user_data_dir: Optional[str], headless: bool) -> webdriver.Chrome:
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
    # 3rd-party cookie をブロックしているとログイン維持に影響する場合がある
    prefs = {"profile.block_third_party_cookies": False}
    opts.add_experimental_option("prefs", prefs)

    service = Service(ChromeDriverManager().install())
    try:
        return webdriver.Chrome(service=service, options=opts)
    except WebDriverException as e:
        if "user data directory is already in use" in str(e):
            tmp = tempfile.mkdtemp(prefix="selenium-profile-")
            logger.warning("指定プロファイル使用中 → 一時プロファイルで再試行: %s", tmp)
            if hasattr(opts, "arguments"):
                opts.arguments = [a for a in opts.arguments if not a.startswith("--user-data-dir=")]
            opts.add_argument(f"--user-data-dir={tmp}")
            return webdriver.Chrome(service=service, options=opts)
        raise

# ========= ログイン検知＆再主張 =========
def is_logged_in(driver: webdriver.Chrome) -> bool:
    try:
        if driver.find_elements(By.CSS_SELECTOR, 'a[href*="/customer/account/logout"]'):
            return True
        if driver.find_elements(By.CSS_SELECTOR, 'a[href*="/customer/account/"]'):
            return True
    except Exception:
        pass
    return False

def is_login_page(driver: webdriver.Chrome) -> bool:
    try:
        url = driver.current_url or ""
    except Exception:
        url = ""
    if "/customer/account/login" in url:
        return True
    try:
        if driver.find_elements(By.CSS_SELECTOR, 'form[action*="login"] input[type="password"]'):
            return True
    except Exception:
        pass
    return False

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

def ensure_logged_in(driver: webdriver.Chrome, wait: WebDriverWait, max_wait_sec: int = 180):
    # ストアTOPを踏んで「店舗選択cookie」を確実に付ける（←これが無いとカート追加でログイン誘導されがち）
    driver.get(HOME_URL)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    try_close_common_popups(driver)
    if is_logged_in(driver):
        logger.info("ログイン済みを検知。続行します。")
        return

    driver.get(LOGIN_URL)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    try_close_common_popups(driver)
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

def reassert_login_and_return(driver: webdriver.Chrome, wait: WebDriverWait, back_url: str):
    """追加クリック後にログインへ飛ばれた時の再主張。"""
    logger.info("ログイン再主張: ホーム→状態確認→元ページ復帰")
    driver.get(HOME_URL)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    try_close_common_popups(driver)

    if not is_logged_in(driver):
        # ログインページへ
        driver.get(LOGIN_URL)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        try_close_common_popups(driver)
        # 手動完了待機（最大120秒）
        end = time.time() + 120
        while time.time() < end:
            time.sleep(0.6)
            if is_logged_in(driver):
                break
    # 元のページへ戻る
    driver.get(back_url)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    try_close_common_popups(driver)

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
    if not name:
        return []
    s = name.strip()
    for ch in "（）()【】[]『』「」,:：、・　 ":
        s = s.replace(ch, " ")
    toks = [t for t in s.split() if len(t) >= 3]
    if not toks:
        return [name[:8]]
    keys = [toks[0], toks[len(toks)//2], toks[-1]]
    keys = [k for i, k in enumerate(keys) if k and k not in keys[:i]]
    if name[:8] not in keys:
        keys.append(name[:8])
    return keys

def find_add_to_cart_by_id(driver: webdriver.Chrome, product_id: str):
    pid = (product_id or "").strip()
    if not pid:
        return None
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
    if not product_name:
        return None
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
    # qty 正規化
    try:
        qty = max(1, int(qty))
    except Exception:
        qty = 1

    # 商品ページを開く（shop.aeon.com 以外だったら正規化）
    if url and "shop.aeon.com" not in url:
        m = re.search(r"/(\d{6,})\.html", url)
        if m:
            url = f"{HOME_URL}{m.group(1)}.html"
    if url:
        driver.get(url)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        try_close_common_popups(driver)
        time.sleep(0.3)

    logger.info("Adding: %s x%d (ID=%s)", (name or "(no-name)"), qty, (product_id or "N/A"))

    found = None
    if product_id and driver.page_source.find(str(product_id)) == -1:
        logger.info("[INFO] page_source に product_id=%s は未検出（ID非掲載ページ想定）", product_id)
    if not found and product_id:
        found = find_add_to_cart_by_id(driver, str(product_id))
    if not found and name:
        found = find_add_to_cart_by_name(driver, name)
    if not found:
        found = find_add_to_cart_generic(driver)
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

        # クリック後にログインへ飛ばれたら、確実に再主張して戻る
        if is_login_page(driver):
            logger.info("クリック後にログインページへ遷移 → 再主張します。")
            back_url = driver.current_url  # 念のため
            reassert_login_and_return(driver, wait, url or HOME_URL)
            # 復帰後にもう一度ボタンを探してクリック
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

# ========= Firestore =========
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
            try:
                return max(1, int(d[k]))
            except Exception:
                pass
    return 1

def id_from_any(v: Any, url: str = "") -> str:
    if url:
        m = re.search(r"/(\d{6,})\.html(?:[?#].*)?$", url)
        if m:
            return m.group(1)
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, int):
        return str(v)
    return ""

def items_from_purchase_doc(snap: fb_firestore.DocumentSnapshot) -> List[Dict]:
    data = snap.to_dict() or {}
    raw = data.get("items")
    if not isinstance(raw, list):
        return []
    out: List[Dict] = []
    for it in raw:
        if not isinstance(it, dict):
            continue
        url = (it.get("url") or "").strip()
        pid = id_from_any(it.get("id"), url)
        name = (it.get("name") or it.get("title") or "").strip()
        qty = safe_qty(it)
        if not any([url, pid, name]):
            continue
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

# ========= CLI =========
def parse_args():
    p = argparse.ArgumentParser(description="AEON 徳島 | Firestore users/{uid}/purchase から items をカートに投入（既存ブラウザにアタッチ推奨）")
    # ブラウザ接続
    p.add_argument("--browser", choices=["chrome","brave","edge"], default="brave", help="既存ブラウザ（macは自動起動可）")
    p.add_argument("--attach-debugger", default="", help="既存ブラウザの DevTools アドレス（例: 127.0.0.1:9222）")
    p.add_argument("--auto-attach", action="store_true", help="DevTools未指定でも自動で起動＆接続を試みる")
    p.add_argument("--debugger-address", default=DEFAULT_DEBUG_ADDR, help="--auto-attach 用のアドレス")
    p.add_argument("--user-data-dir", default=DEFAULT_USER_DATA_DIR, help="（起動/自動起動時）user-data-dir")
    p.add_argument("--profile-dir", default="Default", help="（起動/自動起動時）profile-directory")
    p.add_argument("--headless", action="store_true", help="新規起動の時だけ有効（アタッチ時は無視）")
    # Firebase
    p.add_argument("--use-firebase", action="store_true", help="Firestore を利用する場合に指定")
    p.add_argument("--fb-cred", default=os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", ""), help="サービスアカウント JSON のパス")
    p.add_argument("--fb-project", default="", help="（任意）プロジェクトID。通常は JSON から自動")
    p.add_argument("--purchase-path", default="users/uid/purchase", help="例: users/<uid>/purchase")
    p.add_argument("--purchase-doc", default="", help="特定の purchase ドキュメントID（省略で最新1件）")
    # 挙動
    p.add_argument("--sleep-after-add", type=float, default=0.5, help="1商品投入後の待機秒")
    p.add_argument("--go-checkout", action="store_true", help="全投入後にカート画面へ移動")
    p.add_argument("--keep-open", action="store_true", help="終了後もブラウザを開いたままにする")
    return p.parse_args()

# ========= メイン =========
def main():
    args = parse_args()

    # 既存ブラウザにアタッチ or 新規起動
    driver = None
    try:
        attach_addr = (args.attach-debugger if False else None)  # guard for linter
    except Exception:
        pass  # just ignore; argparse stores as 'attach_debugger'

    attach_addr = (args.attach_debugger or "").strip()
    if not attach_addr and args.auto_attach:
        if ensure_debugger_up(args.debugger_address, browser=args.browser,
                              user_data_dir=args.user_data_dir, profile_dir=args.profile_dir):
            attach_addr = args.debugger_address
            logger.info("DevTools 起動/検出 → アタッチ: %s (%s, profile=%s)",
                        attach_addr, args.browser, args.profile_dir)

    try:
        if attach_addr:
            driver = build_driver_attach(attach_addr)
        else:
            # 実プロファイルでの継続ログインを使いたい場合は、基本アタッチ推奨
            driver = build_driver_new(args.user_data_dir, args.headless)
            logger.warning("新規起動モードです。ログイン再要求が出る場合は --auto-attach を使ってください。")
    except WebDriverException as e:
        logger.error("WebDriver 起動失敗: %s", e)
        sys.exit(1)

    logger.info("ブラウザ準備OK")
    wait = WebDriverWait(driver, 15)

    try:
        # ログイン/店舗cookieの再確認
        ensure_logged_in(driver, wait, max_wait_sec=180)

        if not args.use_firebase:
            logger.error("--use-firebase を付けてください。")
            return

        credp = os.path.expanduser(args.fb_cred)
        if not credp or not os.path.exists(credp):
            logger.error("サービスアカウントJSONが見つかりません: %s", args.fb_cred)
            return

        db = fb_client(credp, args.fb_project or None)

        # items 取得
        doc_id, items = fetch_items(db, args.purchase_path, args.purchase_doc)
        logger.info("purchase doc=%s から %d 件の items を取得", (doc_id or "(none)"), len(items))
        if not items:
            logger.info("投入する商品がありません。")
        else:
            for it in items:
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
                    logger.error("Failed to add %s: %s", (it.get('name') or it.get('id') or 'N/A'), e)

        if args.go_checkout:
            with contextlib.suppress(Exception):
                driver.get(CHECKOUT_URL)
                wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            logger.info("カート画面へ移動しました: %s", CHECKOUT_URL)

        logger.info("完了。ブラウザは%sです。", "開いたまま" if args.keep_open else "閉じます")
        if args.keep_open:
            while True:
                time.sleep(1)

    finally:
        if not args.keep_open:
            with contextlib.suppress(Exception):
                driver.quit()

if __name__ == "__main__":
    main()
