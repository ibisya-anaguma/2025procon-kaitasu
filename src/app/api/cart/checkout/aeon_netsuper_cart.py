#あらとも

import os
import re
import sys
import json
import time
import math
import argparse
import logging
import contextlib
import tempfile
import subprocess
from typing import List, Dict, Any, Optional, Tuple, Set
from datetime import datetime, timezone

# Selenium
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    WebDriverException, NoSuchWindowException, StaleElementReferenceException
)
from webdriver_manager.chrome import ChromeDriverManager

# Firebase Admin (lazy import later)
try:
    import firebase_admin
    from firebase_admin import credentials as fb_credentials
    from firebase_admin import firestore as fb_firestore
except Exception:
    firebase_admin = None
    fb_credentials = None
    fb_firestore = None

# ====== Config / constants ======
STORE_ID = "01050000036000"
BASE = f"https://shop.aeon.com/netsuper/{STORE_ID}"
HOME_URL = f"{BASE}/"
LOGIN_URL = "https://shop.aeon.com/netsuper/customer/account/login/"

DEFAULT_USER_DATA_DIR = os.path.expanduser("~/ChromeSeleniumCart")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("aeon-cart")


# ====== Firestore helpers ======
def init_firebase_admin(cred_path: str = "", project_id: Optional[str] = None):
    """
    Initialize firebase_admin and return a firestore client.
    If cred_path is provided, uses that certificate. Otherwise relies on ADC env var.
    """
    if firebase_admin is None:
        raise RuntimeError("firebase-admin not installed. Install via: pip install firebase-admin")

    if not firebase_admin._apps:
        if cred_path:
            cp = os.path.expanduser(cred_path)
            if not os.path.exists(cp):
                raise FileNotFoundError(f"Service account JSON not found at: {cp}")
            sa = fb_credentials.Certificate(cp)
            firebase_admin.initialize_app(sa, {"projectId": project_id} if project_id else None)
        else:
            # use ADC
            firebase_admin.initialize_app()
    return fb_firestore.client()


def is_collection_path(p: str) -> bool:
    segs = [s for s in p.split("/") if s]
    return len(segs) % 2 == 1


# ====== ID and key helpers ======
def id_from_url(url: str) -> str:
    if not url:
        return ""
    m = re.search(r"/(\d{6,})\.html(?:[?#].*)?$", url)
    return m.group(1) if m else ""


def normalize_id(v: Any, url: str = "") -> str:
    if url:
        u = id_from_url(url)
        if u:
            return u
    if isinstance(v, str) and re.fullmatch(r"\d{6,}", v.strip()):
        return v.strip()
    if isinstance(v, int):
        s = str(v)
        return s if re.fullmatch(r"\d{6,}", s) else ""
    return ""


def stable_key(item: Dict[str, Any]) -> str:
    pid = normalize_id(item.get("id"), item.get("url") or "")
    if pid:
        return f"id:{pid}"
    uid = id_from_url(item.get("url") or "")
    if uid:
        return f"id:{uid}"
    nm = (item.get("name") or "").strip().lower()
    return f"name:{nm}" if nm else f"row:{time.time_ns()}"


# ====== Browser helpers ======
def _try_clear_quarantine(binary_path: str):
    try:
        subprocess.run(["xattr", "-d", "com.apple.quarantine", binary_path],
                       check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass


def _spawn_with_options(options: ChromeOptions) -> webdriver.Chrome:
    path = ChromeDriverManager().install()
    _try_clear_quarantine(path)
    service = Service(path)
    return webdriver.Chrome(service=service, options=options)


def _make_options(browser: str, user_data_dir: Optional[str], profile_dir: Optional[str],
                  headless: bool, debugger_address: Optional[str] = None) -> ChromeOptions:
    opts = ChromeOptions()
    if headless:
        # use new headless flag
        opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1400,1000")
    opts.add_argument("--disable-notifications")
    opts.add_argument("--disable-infobars")
    if user_data_dir:
        u = os.path.expanduser(user_data_dir)
        os.makedirs(u, exist_ok=True)
        opts.add_argument(f"--user-data-dir={u}")
        if profile_dir:
            opts.add_argument(f"--profile-directory={profile_dir}")
    if debugger_address:
        opts.debugger_address = debugger_address
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)
    return opts


def build_driver(browser: str, user_data_dir: Optional[str], profile_dir: Optional[str],
                 headless: bool, auto_attach: bool, debugger_address: Optional[str]) -> webdriver.Chrome:
    if browser == "auto":
        logger.info("browser=auto → chrome を使用")
        browser = "chrome"
    opts = _make_options(browser, user_data_dir, profile_dir, headless,
                         (debugger_address if auto_attach else None))
    try:
        return _spawn_with_options(opts)
    except WebDriverException as e:
        msg = str(e)
        if "user data directory is already in use" in msg or "session not created" in msg:
            tmp = tempfile.mkdtemp(prefix="selenium-profile-")
            logger.warning("指定プロファイルが使用中 → 一時プロファイルで再試行: %s", tmp)
            opts2 = _make_options(browser, tmp, None, headless,
                                  (debugger_address if auto_attach else None))
            return _spawn_with_options(opts2)
        if "unexpectedly exited" in msg:
            logger.warning("WebDriver service が即終了: %s", msg)
        raise


# ====== Login helpers ======
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


def dom_has_logout_marker(driver: webdriver.Chrome) -> bool:
    try:
        if driver.find_elements(By.CSS_SELECTOR, 'a[href*="/customer/account/logout"]'):
            return True
        if driver.find_elements(By.XPATH, "//a[contains(@href,'/customer/account/logout')]"):
            return True
    except Exception:
        pass
    return False


def wait_dom_stable(driver: webdriver.Chrome, duration=0.8, timeout=15) -> bool:
    end = time.time() + timeout
    last_url = None
    while time.time() < end:
        try:
            state = driver.execute_script("return document.readyState")
            url = driver.current_url
            if state == "complete":
                if last_url == url:
                    time.sleep(duration)
                    if driver.execute_script("return document.readyState") == "complete" and driver.current_url == url:
                        return True
                last_url = url
        except Exception:
            pass
        time.sleep(0.2)
    return False


def ensure_logged_in(driver: webdriver.Chrome, wait: WebDriverWait, force: bool, max_wait_sec: int = 300):
    """
    - If already logged in: do nothing
    - Else: open login page once and wait for the user to login (keeps current page)
    """
    if not force and dom_has_logout_marker(driver) and not is_login_page(driver):
        logger.info("ログイン済みを検知（現在ページ）。続行します。")
        return

    if not is_login_page(driver):
        driver.get(LOGIN_URL)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        wait_dom_stable(driver, duration=0.8, timeout=15)
    logger.info("ログインページを開きました。ブラウザでログインしてください（最長 %d 秒）。", max_wait_sec)

    end = time.time() + max_wait_sec
    while time.time() < end:
        time.sleep(0.6)
        wait_dom_stable(driver, duration=0.6, timeout=3)
        if (not is_login_page(driver)) and dom_has_logout_marker(driver):
            logger.info("ログイン完了を厳密に確認しました。続行します。")
            return
    raise RuntimeError("ログイン待機がタイムアウトしました。")


def assert_authenticated_or_relogin(driver: webdriver.Chrome, wait: WebDriverWait):
    if dom_has_logout_marker(driver) and not is_login_page(driver):
        return
    logger.info("セッションが切れている可能性 → ログインページへ移動して待機します。")
    ensure_logged_in(driver, wait, force=True, max_wait_sec=300)


# ====== Page / UI helpers ======
def is_not_found_page(driver: webdriver.Chrome) -> bool:
    try:
        body_text = driver.find_element(By.TAG_NAME, "body").text
    except Exception:
        body_text = ""
    phrases = [
        "指定のページが見つかりませんでした",
        "お探しのページは見つかりません",
        "この商品は現在取り扱っておりません",
        "在庫がありません",
        "ページが見つかりません",
        "404"
    ]
    if any(p in body_text for p in phrases):
        return True
    title = (driver.title or "")
    if "404" in title or "見つかりません" in title:
        return True
    return False


def open_home_and_search(driver: webdriver.Chrome, wait: WebDriverWait, query: str) -> bool:
    driver.get(HOME_URL)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    wait_dom_stable(driver, duration=0.6, timeout=10)
    try_close_common_popups(driver)

    inputs = [
        "input[type='search']", "input[name='q']",
        "input[placeholder*='検索']", "input[placeholder*='さがす']"
    ]
    for sel in inputs:
        with contextlib.suppress(Exception):
            el = driver.find_element(By.CSS_SELECTOR, sel)
            if el.is_displayed():
                el.clear()
                el.send_keys(query)
                el.send_keys(Keys.ENTER)
                wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                wait_dom_stable(driver, duration=0.6, timeout=10)
                return True
    return False


def click_first_search_result(driver: webdriver.Chrome, wait: WebDriverWait, pid: str, name: str) -> bool:
    candidates = []
    sels = [
        "a.product-item-link",
        ".product-item a",
        "a[href*='.html']",
        "a[href*='/netsuper/']",
    ]
    for sel in sels:
        with contextlib.suppress(Exception):
            for a in driver.find_elements(By.CSS_SELECTOR, sel):
                href = (a.get_attribute("href") or "")
                if not href:
                    continue
                candidates.append(a)

    name_l = (name or "").lower()

    def score(el):
        href = (el.get_attribute("href") or "")
        t = (el.text or "").lower()
        s = 0
        if pid and (pid in href):
            s += 100
        if name_l and name_l in t:
            s += 10
        if href.endswith(".html"):
            s += 1
        return -s

    candidates.sort(key=score)

    for a in candidates[:20]:
        href = a.get_attribute("href") or ""
        if not href.endswith(".html"):
            continue
        try:
            driver.execute_script("arguments[0].scrollIntoView({block:'center'});", a)
            a.click()
        except Exception:
            driver.get(href)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        wait_dom_stable(driver, duration=0.6, timeout=10)
        try_close_common_popups(driver)
        if not is_not_found_page(driver):
            return True
        with contextlib.suppress(Exception):
            driver.back()
            wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            wait_dom_stable(driver, duration=0.4, timeout=6)
    return False


def try_close_common_popups(driver: webdriver.Chrome) -> None:
    for xp in [
        "//button[contains(.,'同意') or contains(.,'OK') or contains(.,'閉じる')]",
        "//div[contains(@class,'cookie')]//button",
        "//button[contains(@aria-label,'閉じる')]",
    ]:
        with contextlib.suppress(Exception):
            el = driver.find_element(By.XPATH, xp)
            if el and el.is_displayed():
                driver.execute_script("arguments[0].click();", el)
                time.sleep(0.2)


def get_cart_count(driver: webdriver.Chrome) -> Optional[int]:
    sels = [
        'span.header-cart-count', 'span.cart-count-badge', 'a[href*="cart"] .count',
        '[aria-label*="カート"] .count', '.header-cart .count',
    ]
    for sel in sels:
        with contextlib.suppress(Exception):
            el = driver.find_element(By.CSS_SELECTOR, sel)
            txt = (el.text or "").strip()
            if txt.isdigit():
                return int(txt)
    return None


def wait_cart_added(driver: webdriver.Chrome, before_count=None, expected_delta=1, timeout=14):
    end = time.time() + timeout
    xps = [
        "//*[contains(.,'カートに入れました')]",
        "//*[contains(.,'カートに追加')]",
        "//*[contains(.,'追加しました')]",
        "//*[contains(.,'カゴに入れました')]",
        "//*[contains(@class,'message-success') and contains(.,'カート')]",
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


def set_qty_if_field_exists(driver: webdriver.Chrome, wait: WebDriverWait, qty: int):
    for sel in ["input#qty", "input[name='qty']", "input.qty"]:
        with contextlib.suppress(Exception):
            el = driver.find_element(By.CSS_SELECTOR, sel)
            if el and el.is_displayed():
                driver.execute_script("arguments[0].focus();", el)
                el.clear()
                el.send_keys(str(qty))
                return True
    return False


def pick_simple_options_if_needed(driver: webdriver.Chrome, wait: WebDriverWait) -> None:
    # selects
    for sel in driver.find_elements(By.CSS_SELECTOR, "select"):
        with contextlib.suppress(Exception):
            if not sel.is_displayed():
                continue
            s = Select(sel)
            if any(o.is_selected() and o.get_attribute("value") for o in s.options):
                continue
            for o in s.options:
                val = (o.get_attribute("value") or "").strip()
                txt = (o.text or "").strip()
                if not val:
                    continue
                if txt in ("選択してください", "選択", "--"):
                    continue
                s.select_by_value(val)
                time.sleep(0.2)
                break
    # radios
    radios = driver.find_elements(By.CSS_SELECTOR, "input[type='radio']")
    by_name: Dict[str, List[Any]] = {}
    for r in radios:
        with contextlib.suppress(Exception):
            name = r.get_attribute("name") or ""
            if not name:
                continue
            by_name.setdefault(name, []).append(r)
    for name, group in by_name.items():
        if any((r.is_selected() for r in group)):
            continue
        for r in group:
            with contextlib.suppress(Exception):
                if r.is_displayed() and r.is_enabled():
                    driver.execute_script("arguments[0].click();", r)
                    time.sleep(0.2)
                    break


def find_add_to_cart_button(driver: webdriver.Chrome):
    csses = [
        "button.tocart", "button#tocart", "form[action*='checkout/cart'] button[type='submit']",
        "button[title*='カゴ']", "button[title*='カート']",
        "button[aria-label*='カゴ']", "button[aria-label*='カート']",
        "button.add-to-cart",
    ]
    for sel in csses:
        with contextlib.suppress(Exception):
            for e in driver.find_elements(By.CSS_SELECTOR, sel):
                if e.is_displayed() and e.is_enabled():
                    return e
    xps = [
        "//button[contains(.,'カゴ') or contains(.,'カート') or contains(.,'追加') or contains(.,'購入')]",
        "//a[contains(.,'カゴ') or contains(.,'カート') or contains(.,'追加') or contains(.,'購入')]",
    ]
    for xp in xps:
        with contextlib.suppress(Exception):
            for e in driver.find_elements(By.XPATH, xp):
                if e.is_displayed() and e.is_enabled():
                    return e
    return None


# ====== Adding logic ======
def add_to_cart_via_url(driver: webdriver.Chrome, wait: WebDriverWait, *,
                        url: str, pid: str, name: str, qty: int = 1,
                        max_retries: int = 3):
    assert_authenticated_or_relogin(driver, wait)

    # 1) go to url
    driver.get(url)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    wait_dom_stable(driver, duration=0.6, timeout=10)
    try_close_common_popups(driver)

    # 2) 404 -> search fallback
    if is_not_found_page(driver):
        q = pid or (name[:20] if name else "")
        logger.info("指定URLが無効っぽい → 検索で再特定: %s", q)
        if not open_home_and_search(driver, wait, q):
            raise RuntimeError("検索ボックスが見つからない（404 fallback 失敗）")
        if not click_first_search_result(driver, wait, pid, name):
            raise RuntimeError("検索しても商品ページを特定できない（404 fallback 失敗）")

    # 3) pick options
    pick_simple_options_if_needed(driver, wait)

    # 4) set qty -> click add
    logger.info("Adding: %s x%d (ID=%s)", (name or "(no-name)"), qty, (pid or "N/A"))
    before = get_cart_count(driver)
    clicks_needed = 1 if set_qty_if_field_exists(driver, wait, qty) else max(1, int(qty))

    success_any = False
    for _ in range(clicks_needed):
        attempt = 0
        while attempt < max_retries:
            attempt += 1
            assert_authenticated_or_relogin(driver, wait)
            pick_simple_options_if_needed(driver, wait)

            btn = find_add_to_cart_button(driver)
            if not btn:
                time.sleep(0.8)
                btn = find_add_to_cart_button(driver)
            if not btn:
                if attempt >= max_retries:
                    raise RuntimeError("カゴ追加ボタンが見つかりません")
                continue

            try:
                driver.execute_script("arguments[0].scrollIntoView({block:'center'});", btn)
                wait.until(EC.element_to_be_clickable(btn))
                try:
                    btn.click()
                except Exception:
                    driver.execute_script("arguments[0].click();", btn)
            except StaleElementReferenceException:
                time.sleep(0.6)
                continue
            except NoSuchWindowException:
                handles = driver.window_handles
                if handles:
                    driver.switch_to.window(handles[-1])
                    time.sleep(0.2)
                continue

            # If clicking sent to login page -> relogin and retry
            if is_login_page(driver):
                logger.info("クリック後にログインへ遷移。復帰して再実行します。")
                ensure_logged_in(driver, wait, force=True, max_wait_sec=300)
                continue

            ok = wait_cart_added(driver, before_count=before, expected_delta=1, timeout=14)
            if ok:
                success_any = True
                now = get_cart_count(driver)
                if now is not None:
                    before = now
                break
            else:
                time.sleep(0.8)

    if not success_any:
        raise RuntimeError("トースト/バッジ変化が検知できず、投入に失敗した可能性")


# ====== Firestore read helpers (cart) ======
def fetch_cart_items(db: fb_firestore.Client, cart_path: str, from_all: bool) -> Tuple[int, List[Dict[str, Any]]]:
    """
    Read cart docs from cart_path (collection or document)
    Returns (docs_count_read, items_list) where each item is normalized: {id,url,name,quantity}
    """
    if is_collection_path(cart_path):
        col = db.collection(cart_path)
        if from_all:
            docs = list(col.stream())
        else:
            # try to get latest by createdAt if present
            try:
                docs = list(col.order_by("createdAt", direction=fb_firestore.Query.DESCENDING).limit(1000).stream())
            except Exception:
                docs = list(col.stream())
    else:
        doc = db.document(cart_path).get()
        docs = [doc] if doc.exists else []

    items: List[Dict[str, Any]] = []
    for d in docs:
        # d may be a DocumentSnapshot
        data = d.to_dict() if hasattr(d, "to_dict") else (d or {})
        if not data:
            continue
        # If doc directly contains item fields, support both shape {items:[...]} and direct item doc
        if isinstance(data.get("items"), list):
            arr = data.get("items")
            for it in arr:
                if not isinstance(it, dict):
                    continue
                url = (it.get("url") or "").strip()
                pid = normalize_id(it.get("id"), url)
                nm = (it.get("name") or it.get("title") or "").strip()
                q = it.get("quantity") or it.get("qty") or 1
                try:
                    q = max(1, int(q))
                except Exception:
                    q = 1
                page = url or (f"{BASE}/{pid}.html" if pid else "")
                if not page:
                    continue
                items.append({"id": pid, "url": page, "name": nm, "quantity": q})
        else:
            # document is single item-like object
            url = (data.get("url") or "").strip()
            pid = normalize_id(data.get("id"), url)
            nm = (data.get("name") or data.get("title") or "").strip()
            q = data.get("quantity") or data.get("qty") or 1
            try:
                q = max(1, int(q))
            except Exception:
                q = 1
            page = url or (f"{BASE}/{pid}.html" if pid else "")
            if page:
                items.append({"id": pid, "url": page, "name": nm, "quantity": q})
    return (len(docs), items)


def dedupe_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: Set[str] = set()
    out: List[Dict[str, Any]] = []
    for it in items:
        k = stable_key(it)
        if k in seen:
            continue
        seen.add(k)
        out.append(it)
    return out


# ====== Postprocess: move cart -> history ======
def move_cart_to_history(db: fb_firestore.Client, uid: str, history_doc: str,
                         dry: bool = False, logger_obj: Optional[logging.Logger] = None) -> dict:
    """
    - Reads users/{uid}/cart (all docs)
    - Appends items to users/{uid}/history/{history_doc}.items (ArrayUnion)
    - Sets updatedAt = SERVER_TIMESTAMP on history doc
    - Deletes cart docs (batched; 500/document limit)
    """
    log = (logger_obj.info if logger_obj else print)
    errlog = (logger_obj.error if logger_obj else print)

    cart_col = f"users/{uid}/cart"
    history_doc_path = f"users/{uid}/history/{history_doc}"

    col = db.collection(cart_col)
    docs = list(col.stream())
    if not docs:
        log(f"[INFO] cart is empty: {cart_col}")
        return {"appended": 0, "deleted": 0, "historyDocPath": history_doc_path}

    items = []
    doc_ids = []
    for d in docs:
        data = d.to_dict() or {}
        doc_ids.append(d.id)
        it = {
            "id": str(data.get("id") or data.get("pid") or "") ,
            "url": data.get("url") or "",
            "name": data.get("name") or data.get("title") or "",
            "image": data.get("image") or data.get("imgUrl") or "",
            "price": (data.get("price") if isinstance(data.get("price"), (int,float)) else None),
            "quantity": int(data.get("quantity") or data.get("qty") or 1),
            # store ISO timestamp string (serverTimestamp cannot be inside array element)
            "timeStamp": datetime.now(timezone.utc).isoformat()
        }
        items.append(it)

    log(f"[INFO] collected {len(items)} cart item(s) from {cart_col}")
    if dry:
        log("[DRY] would append to history doc:", history_doc_path)
        log("[DRY] items sample:", items[:3])
        log("[DRY] would delete cart docs:", len(doc_ids))
        return {"appended": len(items), "deleted": 0, "historyDocPath": history_doc_path}

    history_ref = db.document(history_doc_path)
    try:
        history_ref.set({
            "items": fb_firestore.ArrayUnion(items),
            "updatedAt": fb_firestore.SERVER_TIMESTAMP
        }, merge=True)
        log(f"[INFO] appended {len(items)} item(s) to {history_doc_path}")
    except Exception as e:
        errlog(f"[ERROR] failed to write history doc: {e}")
        raise

    # delete docs in batches
    deleted = 0
    batch_size = 400
    try:
        for i in range(0, len(doc_ids), batch_size):
            batch = db.batch()
            chunk = doc_ids[i:i+batch_size]
            for doc_id in chunk:
                doc_ref = db.document(f"{cart_col}/{doc_id}")
                batch.delete(doc_ref)
            batch.commit()
            deleted += len(chunk)
            log(f"[INFO] deleted {len(chunk)} cart docs (progress {deleted}/{len(doc_ids)})")
    except Exception as e:
        errlog(f"[ERROR] failed while deleting cart docs: {e}")
        return {"appended": len(items), "deleted": deleted, "historyDocPath": history_doc_path}

    return {"appended": len(items), "deleted": deleted, "historyDocPath": history_doc_path}


# ====== CLI ======
def parse_args():
    p = argparse.ArgumentParser(description="AEON / Firestore cart -> add to AEON cart and optionally move to history")
    p.add_argument("--browser", default="auto", choices=["auto","chrome","brave"])
    p.add_argument("--user-data-dir", default=DEFAULT_USER_DATA_DIR)
    p.add_argument("--profile-dir", default=None)
    p.add_argument("--auto-attach", action="store_true")
    p.add_argument("--debugger-address", default="127.0.0.1:9222")
    p.add_argument("--headless", action="store_true")
    # Firebase
    p.add_argument("--use-firebase", action="store_true")
    p.add_argument("--fb-cred", default=os.environ.get("GOOGLE_APPLICATION_CREDENTIALS",""))
    p.add_argument("--fb-project", default="")
    # cart path
    p.add_argument("--cart-path", default=None, help="Firestore path to cart (collection) e.g. users/uid/cart")
    p.add_argument("--from-all", action="store_true")
    # control
    p.add_argument("--dedupe", action="store_true")
    p.add_argument("--sleep-after-add", type=float, default=0.6)
    p.add_argument("--force-login", action="store_true")
    p.add_argument("--max-retries-per-item", type=int, default=3)
    p.add_argument("--keep-open", action="store_true")
    p.add_argument("--no-home-return", action="store_true")
    # postprocess
    p.add_argument("--call-postprocess", action="store_true",
                   help="If set, after adding to AEON cart, move Firestore cart -> history")
    p.add_argument("--postprocess-history-doc", default="last-checkout")
    # runtime
    p.add_argument("--uid", required=True, help="user id to process")
    p.add_argument("--python-debug", action="store_true")
    p.add_argument("--dry", action="store_true", help="dry-run: no writes to Firestore")
    return p.parse_args()


def main():
    args = parse_args()

    # build webdriver
    try:
        driver = build_driver(
            browser=args.browser,
            user_data_dir=args.user_data_dir,
            profile_dir=args.profile_dir,
            headless=args.headless,
            auto_attach=args.auto_attach,
            debugger_address=(args.debugger_address if args.auto_attach else None),
        )
        logger.info("ブラウザ準備OK")
    except WebDriverException as e:
        logger.error("Chrome 起動失敗: %s", e)
        sys.exit(1)

    wait = WebDriverWait(driver, 20)

    try:
        # ensure logged-in (keeps current page)
        ensure_logged_in(driver, wait, force=args.force_login, max_wait_sec=300)

        # Firestore setup (required to fetch cart items)
        if not args.use_firebase:
            logger.error("--use-firebase を指定してください。"); return

        credp = os.path.expanduser(args.fb_cred) if args.fb_cred else os.environ.get("GOOGLE_APPLICATION_CREDENTIALS","")
        if not credp or not os.path.exists(credp):
            logger.error("サービスアカウントJSONが見つかりません: %s", credp)
            # proceed without firebase only if not required
            return

        db = init_firebase_admin(credp, args.fb_project or None)

        cart_path = args.cart_path or f"users/{args.uid}/cart"
        docs_count, items = fetch_cart_items(db, cart_path, args.from_all)
        logger.info("cart 読み取り: %s docs=%d items=%d", cart_path, docs_count, len(items))

        if args.dedupe:
            items = dedupe_items(items)
            logger.info("重複除去後 items: %d", len(items))

        if not items:
            logger.info("投入する商品がありません。"); return

        # Add each item to AEON net cart
        for it in items:
            url = (it.get("url") or "").strip()
            pid = normalize_id(it.get("id"), url)
            name = (it.get("name") or "").strip()
            qty  = it.get("quantity") or 1
            try:
                add_to_cart_via_url(driver, wait, url=url, pid=pid, name=name,
                                    qty=qty, max_retries=args.max_retries_per_item)
                time.sleep(args.sleep_after_add)
            except Exception as e:
                logger.error("Failed to add %s: %s", (name or pid or "N/A"), e)

        # Optionally call postprocess (move cart -> history)
        if args.call_postprocess:
            try:
                res = move_cart_to_history(db, args.uid, args.postprocess_history_doc, dry=args.dry, logger_obj=logger)
                logger.info("postprocess result: %s", res)
            except Exception as e:
                logger.error("postprocess failed: %s", e)

        # final navigation
        if not args.no_home_return:
            with contextlib.suppress(Exception):
                driver.get(HOME_URL)
                wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                wait_dom_stable(driver, duration=0.5, timeout=6)

        logger.info("完了。ブラウザは開いたままです。" if args.keep_open else "完了。ブラウザを閉じます。")
        if args.keep_open:
            while True:
                time.sleep(1)

    finally:
        if not args.keep_open:
            with contextlib.suppress(Exception):
                driver.quit()


if __name__ == "__main__":
    main()