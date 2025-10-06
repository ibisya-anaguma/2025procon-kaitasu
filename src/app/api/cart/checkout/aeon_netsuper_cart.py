#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
AEON ネットスーパー | Firestore の purchase を読んでカート投入
- ログイン判定を強化（認証必須ページを新規タブでプローブ）
- 未ログインならログイン画面で待機。完了検知後に処理続行
- クリック後にログインへ飛ばされても復帰して再試行
- productId がページに無くても URL / 名前 / 汎用ボタンで追加
- Firestore: 単一 doc / 最新1件 / 全件 (--from-all) に対応
- 重複除去 (--dedupe) 対応

使い方例:
python3 aeon_netsuper_cart.py \
  --browser auto \
  --use-firebase \
  --fb-cred "/Users/you/sa.json" \
  --purchase-path "users/uid/purchase" \
  --from-all --dedupe \
  --force-login \
  --go-checkout --keep-open
"""

import os
import re
import sys
import time
import json
import tempfile
import logging
import argparse
import contextlib
from typing import List, Dict, Optional, Tuple, Any

# ===== Selenium / Driver =====
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    WebDriverException, NoSuchWindowException, TimeoutException
)
from webdriver_manager.chrome import ChromeDriverManager

# ===== Firebase Admin =====
import firebase_admin
from firebase_admin import credentials as fb_credentials
from firebase_admin import firestore as fb_firestore

# ===== AEON 固定 =====
STORE_ID = "01050000036000"
HOME_URL     = f"https://shop.aeon.com/netsuper/{STORE_ID}/"
LOGIN_URL    = "https://shop.aeon.com/netsuper/customer/account/login/"
CHECKOUT_URL = f"https://shop.aeon.com/netsuper/{STORE_ID}/checkout/cart/"
ACCOUNT_URL  = "https://shop.aeon.com/netsuper/customer/account/"  # 認証必須

# ===== ログ =====
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s"
)
logger = logging.getLogger(__name__)

# ===== Utils =====
def to_int(v, default=1):
    try:
        n = int(v)
        return max(1, n)
    except Exception:
        return default

def norm_id(val: Any, url: str = "") -> str:
    # URL末尾 .../<digits>.html を優先
    if url:
        m = re.search(r"/(\d{8,})\.html(?:[?#].*)?$", url)
        if m: return m.group(1)
    if isinstance(val, str) and re.fullmatch(r"\d{6,}", val.strip()):
        return val.strip()
    if isinstance(val, int) and val > 0:
        s = str(val)
        if re.fullmatch(r"\d{6,}", s): return s
    return ""

def stable_key(it: Dict[str, Any]) -> str:
    pid = norm_id(it.get("id"), it.get("url",""))
    if pid: return f"id:{pid}"
    if it.get("url"): return f"url:{it['url']}"
    name = (it.get("name") or "").strip().lower()
    if name: return f"name:{name}"
    return f"row:{time.time()}:{os.getpid()}"

def ensure_dir(p: str):
    if p and not os.path.exists(p):
        os.makedirs(p, exist_ok=True)

# ====== Driver 起動 ======
def _guess_brave_binary() -> Optional[str]:
    # macOS
    mac = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
    if os.path.exists(mac): return mac
    # Linux
    for name in ("brave", "brave-browser", "/usr/bin/brave-browser", "/snap/bin/brave"):
        if os.path.exists(name): return name
    # Windows（雑に）
    win = os.path.expandvars(r"%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe")
    if os.path.exists(win): return win
    return None

def _make_chrome_options(
    browser: str,
    user_data_dir: Optional[str],
    profile_dir: Optional[str],
    headless: bool
) -> ChromeOptions:
    opts = ChromeOptions()
    if headless:
        opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1400,1000")
    opts.add_argument("--lang=ja-JP")
    if user_data_dir:
        opts.add_argument(f"--user-data-dir={os.path.expanduser(user_data_dir)}")
    if profile_dir:
        opts.add_argument(f"--profile-directory={profile_dir}")

    # Brave 指定なら binary_location を Brave に
    if browser.lower() == "brave":
        brave = _guess_brave_binary()
        if brave:
            opts.binary_location = brave
        else:
            logger.warning("Brave の実行ファイルが見つかりません。Chrome で起動します。")

    return opts

def build_driver(
    browser: str = "auto",
    user_data_dir: Optional[str] = None,
    profile_dir: Optional[str] = None,
    headless: bool = False
) -> webdriver.Chrome:
    # auto -> brave が見つかれば brave、なければ chrome
    chosen = browser.lower()
    if chosen == "auto":
        chosen = "brave" if _guess_brave_binary() else "chrome"
        logger.info("browser=auto → %s を使用", chosen)

    options = _make_chrome_options(chosen, user_data_dir, profile_dir, headless)
    service = Service(ChromeDriverManager().install())

    try:
        driver = webdriver.Chrome(service=service, options=options)
        return driver
    except WebDriverException as e:
        # user-data-dir 競合（既に開いている）の場合は一時プロファイルで再試行
        msg = str(e)
        if "user data directory is already in use" in msg or "cannot connect to chrome" in msg:
            tmp = tempfile.mkdtemp(prefix="selenium-profile-")
            logger.warning("指定プロファイルが使用中 → 一時プロファイルで再試行: %s", tmp)
            # 新しい options を組み直す（.arguments は read-only なので再生成が安全）
            options2 = _make_chrome_options(chosen, tmp, None, headless)
            driver = webdriver.Chrome(service=service, options=options2)
            return driver
        raise

# ====== ログイン検知（強化版） ======
def is_login_page(driver) -> bool:
    try:
        url = (driver.current_url or "").lower()
        if "/customer/account/login" in url:
            return True
    except Exception:
        pass
    try:
        if driver.find_elements(By.CSS_SELECTOR, 'form[action*="login"] input[type="password"]'):
            return True
    except Exception:
        pass
    return False

def _probe_auth_in_new_tab(driver, wait, url: str, timeout: float = 15.0) -> bool:
    """認証が必要なURLを別タブで開き、ログインページに飛ばされない＝ログイン済み"""
    original = driver.current_window_handle
    driver.execute_script("window.open(arguments[0], '_blank');", url)
    time.sleep(0.2)
    new_handle = [h for h in driver.window_handles if h != original][-1]
    driver.switch_to.window(new_handle)
    try:
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(0.3)
        if is_login_page(driver):
            return False
        cur = (driver.current_url or "").lower()
        if "/customer/account/login" in cur:
            return False
        return True
    finally:
        with contextlib.suppress(Exception):
            driver.close()
        with contextlib.suppress(Exception):
            driver.switch_to.window(original)

def robust_is_logged_in(driver, wait) -> bool:
    for probe in (CHECKOUT_URL, ACCOUNT_URL):
        with contextlib.suppress(Exception):
            if _probe_auth_in_new_tab(driver, wait, probe):
                return True
    return False

def ensure_logged_in(driver, wait, force: bool = False, max_wait_sec: int = 300):
    # HOME へ
    with contextlib.suppress(Exception):
        driver.get(HOME_URL)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(0.2)

    if not force and robust_is_logged_in(driver, wait):
        logger.info("ログイン済みを検知（PROBE）。続行します。")
        return

    # ログイン画面で待機
    driver.get(LOGIN_URL)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    logger.info("ログインページを開きました。ブラウザでログインしてください（最長 %s 秒）。", max_wait_sec)

    deadline = time.time() + max_wait_sec
    while time.time() < deadline:
        time.sleep(0.8)
        if robust_is_logged_in(driver, wait) and not is_login_page(driver):
            logger.info("ログイン完了を検知しました。続行します。")
            break
        if robust_is_logged_in(driver, wait):
            logger.info("ログイン完了を検知しました（PROBE）。続行します。")
            break
    else:
        raise RuntimeError("ログイン待機がタイムアウトしました。")

    # メイン画面に戻す（ログインページに戻らない）
    with contextlib.suppress(Exception):
        driver.get(HOME_URL)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(0.2)

# ====== ページ雑処理 ======
def try_close_popups(driver):
    xpaths = [
        "//button[contains(.,'同意') or contains(.,'OK') or contains(.,'閉じる')]",
        "//div[contains(@class,'cookie')]//button",
    ]
    for xp in xpaths:
        with contextlib.suppress(Exception):
            el = driver.find_element(By.XPATH, xp)
            if el and el.is_displayed():
                driver.execute_script("arguments[0].click();", el)
                time.sleep(0.2)

def _first_displayed(driver, css_list: List[str], xp_list: List[str]):
    for sel in css_list:
        with contextlib.suppress(Exception):
            el = driver.find_element(By.CSS_SELECTOR, sel)
            if el and el.is_displayed():
                return el, "css", sel
    for xp in xp_list:
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
    toks = [t for t in s.split() if len(t) >= 2]
    if not toks: return [name[:8]]
    keys = [toks[0], toks[len(toks)//2], toks[-1]]
    keys = [k for i, k in enumerate(keys) if k and k not in keys[:i]]
    if name[:8] not in keys: keys.append(name[:8])
    return keys

def find_add_to_cart_by_id(driver, product_id: str):
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

def find_add_to_cart_by_name(driver, product_name: str):
    if not product_name: return None
    keys = _keywords_from_name(product_name)
    # 「カゴ/カート/追加/購入」ボタンを含むカードを見つける
    btn_xpath = ".//button[contains(.,'カゴ') or contains(.,'カート') or contains(.,'追加') or contains(.,'購入')]"
    for kw in keys:
        with contextlib.suppress(Exception):
            el = driver.find_element(
                By.XPATH,
                f"(//*[contains(normalize-space(.), '{kw}') and not(self::script or self::style) and string-length(normalize-space(.)) < 400])[1]"
            )
            card = el.find_element(By.XPATH, f"ancestor-or-self::*[{btn_xpath[2:]}][1]")
            btn = card.find_element(By.XPATH, btn_xpath)
            if btn and btn.is_displayed():
                return btn, "xpath", btn_xpath
    return None

def find_add_to_cart_generic(driver):
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

# ====== 1商品の投入 ======
def add_to_cart(
    driver: webdriver.Chrome,
    wait: WebDriverWait,
    product_id: str,
    qty: int = 1,
    name: str = "",
    url: str = ""
):
    qty = to_int(qty, 1)

    # 商品ページをできるだけURLで開く（ID非掲載対策）
    if url:
        driver.get(url)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        try_close_popups(driver)
        time.sleep(0.3)

    logger.info("Adding: %s x%d (ID=%s)", (name or "(no-name)"), qty, (product_id or "N/A"))

    found = None
    # ページソースにID無いのは普通にある（ID非掲載）。warn止まりにして続行
    if product_id and str(product_id) not in (driver.page_source or ""):
        logger.info("[INFO] page_source に product_id=%s は未検出（ID非掲載でもOK）", product_id)

    # 優先：ID → 名前 → 汎用
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
            # たまの別タブ遷移・ウィンドウ喪失に対処
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
        except TimeoutException:
            # 一旦再探索
            found2 = (find_add_to_cart_by_id(driver, str(product_id))
                      or find_add_to_cart_by_name(driver, name)
                      or find_add_to_cart_generic(driver))
            if not found2:
                raise RuntimeError("カゴボタンのクリック待機に失敗（見つからず）")
            el, kind, sel = found2
            driver.execute_script("arguments[0].click();", el)

        time.sleep(0.6)

        # クリック後にログインへ飛ばれたら復帰して再クリック
        if is_login_page(driver):
            logger.info("クリック後にログイン画面へ遷移。ログイン完了を待ちます。")
            ensure_logged_in(driver, wait, force=False, max_wait_sec=300)
            if url:
                driver.get(url)
                wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                time.sleep(0.3)
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
            # トースト/バッジ未検知でも、ページ側が反映していることがあるので warn のみ
            logger.warning("カート投入の確認がとれませんでした（トースト/バッジ未検知）")

# ====== Firestore ======
def fb_client(cred_path: str) -> fb_firestore.Client:
    if not firebase_admin._apps:
        cred = fb_credentials.Certificate(os.path.expanduser(cred_path))
        firebase_admin.initialize_app(cred)
    return fb_firestore.client()

def collection_from_path(db: fb_firestore.Client, col_path: str) -> fb_firestore.CollectionReference:
    parts = [p for p in col_path.split("/") if p]
    if len(parts) % 2 == 0:
        raise ValueError(f"コレクションパスが不正（偶数セグメント）: {col_path}")
    ref: Any = db
    for i, seg in enumerate(parts):
        ref = ref.collection(seg) if i % 2 == 0 else ref.document(seg)
    return ref  # type: ignore

def fetch_items_from_doc(doc_snap) -> List[Dict[str, Any]]:
    data = doc_snap.to_dict() or {}
    raw = data.get("items")
    if not isinstance(raw, list): return []
    out: List[Dict[str, Any]] = []
    for it in raw:
        if not isinstance(it, dict): continue
        url = (it.get("url") or "").strip()
        pid = norm_id(it.get("id"), url)
        name = (it.get("name") or it.get("title") or "").strip()
        qty  = to_int(it.get("quantity") or it.get("qty") or 1, 1)
        out.append({"id": pid, "url": url, "name": name, "qty": qty})
    return out

def fetch_targets(
    db: fb_firestore.Client,
    purchase_path: str,
    purchase_doc: Optional[str],
    from_all: bool
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    返り値: (説明文字列, アイテム配列)
    - purchase_doc 指定: その1件
    - from_all: コレクションの全件を createdAt 昇順で読み、items を合算
    - それ以外: 最新1件 (createdAt 降順)
    """
    col = collection_from_path(db, purchase_path)
    items: List[Dict[str, Any]] = []

    if purchase_doc:
        snap = col.document(purchase_doc).get()
        if not snap.exists:
            raise RuntimeError(f"purchase ドキュメントが存在しません: {purchase_doc}")
        items = fetch_items_from_doc(snap)
        return f"{purchase_doc}:{len(items)}", items

    if from_all:
        try:
            snaps = list(col.order_by("createdAt", direction=fb_firestore.Query.ASCENDING).stream())
        except Exception:
            snaps = list(col.stream())
        for s in snaps:
            items.extend(fetch_items_from_doc(s))
        return f"all:{len(snaps)}:{len(items)}", items

    # 最新1件
    snaps: List[Any] = []
    try:
        snaps = list(col.order_by("createdAt", direction=fb_firestore.Query.DESCENDING).limit(1).stream())
    except Exception:
        snaps = list(col.stream())[:1]
    if not snaps:
        return "none:0", []
    s = snaps[0]
    items = fetch_items_from_doc(s)
    return f"latest:{s.id}:{len(items)}", items

# ====== CLI ======
def parse_args():
    p = argparse.ArgumentParser(description="AEON 徳島 | Firestore purchase からカート投入")
    p.add_argument("--browser", default="auto", help="auto|chrome|brave")
    p.add_argument("--user-data-dir", default="", help="Chrome/Brave のユーザープロファイルパス")
    p.add_argument("--profile-dir", default="", help="Profile ディレクトリ名 (例: Default)")
    p.add_argument("--headless", action="store_true", help="ヘッドレスで起動")
    p.add_argument("--force-login", action="store_true", help="必ずログインページを開いてから開始")

    # Firestore
    p.add_argument("--use-firebase", action="store_true", help="Firestore を利用")
    p.add_argument("--fb-cred", default=os.environ.get("GOOGLE_APPLICATION_CREDENTIALS",""), help="サービスアカウント JSON")
    p.add_argument("--purchase-path", default="users/uid/purchase", help="例: users/<uid>/purchase")
    p.add_argument("--purchase-doc", default="", help="特定の purchase ドキュメントID")
    p.add_argument("--from-all", action="store_true", help="コレクション全件から items を集約")
    p.add_argument("--dedupe", action="store_true", help="同一キーの重複アイテムを除去（id/url/name）")

    # 動作
    p.add_argument("--sleep-after-add", type=float, default=0.6, help="1商品投入後の待機秒")
    p.add_argument("--go-checkout", action="store_true", help="完了後カート画面へ移動")
    p.add_argument("--keep-open", action="store_true", help="終了後ブラウザを開いたままにする")

    return p.parse_args()

# ====== Main ======
def main():
    args = parse_args()

    # Driver
    try:
        driver = build_driver(
            browser=args.browser,
            user_data_dir=args.user_data_dir or None,
            profile_dir=args.profile_dir or None,
            headless=args.headless
        )
        logger.info("ブラウザ準備OK")
    except WebDriverException as e:
        logger.error(f"Chrome 起動失敗: {e}")
        sys.exit(1)
    wait = WebDriverWait(driver, 20)

    try:
        # ログインを確実化
        ensure_logged_in(driver, wait, force=args.force_login, max_wait_sec=300)

        if not args.use_firebase:
            logger.error("--use-firebase を付けてください。")
            return

        credp = os.path.expanduser(args.fb_cred)
        if not credp or not os.path.exists(credp):
            logger.error("サービスアカウントJSONが見つかりません: %s", args.fb_cred)
            return

        db = fb_client(credp)
        desc, items = fetch_targets(db, args.purchase_path, args.purchase_doc or None, args.from_all)
        logger.info("purchase 読み取り: %s", desc)

        if not items:
            logger.info("投入対象 items がありません。")
        else:
            # 重複除去
            if args.dedupe:
                uniq: Dict[str, Dict[str, Any]] = {}
                for it in items:
                    uniq[stable_key(it)] = it
                items = list(uniq.values())
                logger.info("重複除去後 items: %d", len(items))

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
                    logger.error(f"Failed to add {it.get('name') or it.get('id') or 'N/A'}: {e}")

        if args.go_checkout:
            with contextlib.suppress(Exception):
                driver.get(CHECKOUT_URL)
                wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            logger.info("カート画面へ移動しました: %s", CHECKOUT_URL)

        # 最後に HOME に戻す（ログインページに戻さない）
        with contextlib.suppress(Exception):
            driver.get(HOME_URL)
            wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))

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