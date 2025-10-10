import os
import re
import sys
import json
import time
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
from selenium.common.exceptions import WebDriverException, NoSuchWindowException, StaleElementReferenceException
from webdriver_manager.chrome import ChromeDriverManager

# Firebase Admin
import firebase_admin
from firebase_admin import credentials as fb_credentials
from firebase_admin import firestore as fb_firestore

# --- constants / logging ---
STORE_ID = "01050000036000"
BASE = f"https://shop.aeon.com/netsuper/{STORE_ID}"
HOME_URL = f"{BASE}/"
LOGIN_URL = "https://shop.aeon.com/netsuper/customer/account/login/"

DEFAULT_USER_DATA_DIR = os.path.expanduser("~/ChromeSeleniumCart")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("aeon-autocart")

DAY_MS = 86400000

# ---------------- Firestore init ----------------
def init_fb(cred_path: str = "") -> fb_firestore.Client:
    if cred_path:
        cred_path = os.path.expanduser(cred_path)
    # If GOOGLE_APPLICATION_CREDENTIALS env set, firebase_admin will pick it up automatically
    if cred_path and os.path.exists(cred_path):
        sa = fb_credentials.Certificate(cred_path)
        firebase_admin.initialize_app(sa, {"projectId": sa.project_id})
        return fb_firestore.client()
    # else try default
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        firebase_admin.initialize_app()
        return fb_firestore.client()
    raise RuntimeError("No Firebase credentials. Provide --fb-cred or set GOOGLE_APPLICATION_CREDENTIALS.")

# ---------------- ID/key helpers ----------------
def id_from_url(url: str) -> str:
    if not url: return ""
    m = re.search(r"/(\d{6,})\.html(?:[?#].*)?$", url)
    return m.group(1) if m else ""

def normalize_id(v: Any, url: str = "") -> str:
    if url:
        u = id_from_url(url)
        if u:
            return u
    if isinstance(v, str) and re.fullmatch(r"\d{6,}", v.strip()):
        return v.strip()
    if isinstance(v, (int, float)):
        s = str(int(v))
        return s if re.fullmatch(r"\d{6,}", s) else ""
    return ""

def stable_key(item: Dict[str, Any]) -> str:
    pid = normalize_id(item.get("id"), item.get("url") or "")
    if pid: return f"id:{pid}"
    uid = id_from_url(item.get("url") or "")
    if uid: return f"id:{uid}"
    name = (item.get("name") or "").strip().lower()
    if name:
        return f"name:{name}"
    return f"row:{time.time_ns()}"

# ---------------- Selenium helpers ----------------
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

def _make_options(user_data_dir: Optional[str], profile_dir: Optional[str], headless: bool, debugger_address: Optional[str] = None) -> ChromeOptions:
    opts = ChromeOptions()
    if headless:
        # new headless
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
        # rarely used
        opts.debugger_address = debugger_address
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)
    return opts

def build_driver(user_data_dir: Optional[str], profile_dir: Optional[str], headless: bool, debugger_address: Optional[str], auto_attach: bool = False) -> webdriver.Chrome:
    opts = _make_options(user_data_dir, profile_dir, headless, debugger_address if auto_attach else None)
    try:
        return _spawn_with_options(opts)
    except WebDriverException as e:
        msg = str(e)
        if "user data directory is already in use" in msg or "session not created" in msg:
            tmp = tempfile.mkdtemp(prefix="selenium-profile-")
            logger.warning("プロファイル競合。一時プロファイルで再試行: %s", tmp)
            opts2 = _make_options(tmp, None, headless, debugger_address if auto_attach else None)
            return _spawn_with_options(opts2)
        raise

# ---------------- login / DOM helpers ----------------
def is_login_page(driver):
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

def dom_has_logout_marker(driver):
    try:
        if driver.find_elements(By.CSS_SELECTOR, 'a[href*="/customer/account/logout"]'):
            return True
        if driver.find_elements(By.XPATH, "//a[contains(@href,'/customer/account/logout')]"):
            return True
    except Exception:
        pass
    return False

def wait_dom_stable(driver, duration=0.8, timeout=15):
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

def ensure_logged_in(driver, wait: WebDriverWait, force: bool, max_wait_sec: int = 300):
    if not force and dom_has_logout_marker(driver) and not is_login_page(driver):
        logger.info("既にログイン済み判定。続行。")
        return
    if not is_login_page(driver):
        driver.get(LOGIN_URL)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        wait_dom_stable(driver, duration=0.8, timeout=15)
    logger.info("ログインページを開きました。ブラウザでログインしてください（最大 %d 秒）", max_wait_sec)
    end = time.time() + max_wait_sec
    while time.time() < end:
        time.sleep(0.6)
        wait_dom_stable(driver, duration=0.6, timeout=3)
        if (not is_login_page(driver)) and dom_has_logout_marker(driver):
            logger.info("ログイン完了を確認しました。")
            return
    raise RuntimeError("ログイン待機タイムアウト")

def assert_authenticated_or_relogin(driver, wait: WebDriverWait):
    if dom_has_logout_marker(driver) and not is_login_page(driver):
        return
    logger.info("セッション切れの可能性。ログインを要求します。")
    ensure_logged_in(driver, wait, force=True, max_wait_sec=300)

# ---------------- page helpers: find add button, set qty ----------------
def try_close_common_popups(driver):
    xpaths = [
        "//button[contains(.,'同意') or contains(.,'OK') or contains(.,'閉じる')]",
        "//div[contains(@class,'cookie')]//button",
        "//button[contains(@aria-label,'閉じる')]",
    ]
    for xp in xpaths:
        with contextlib.suppress(Exception):
            el = driver.find_element(By.XPATH, xp)
            if el and el.is_displayed():
                driver.execute_script("arguments[0].click();", el)
                time.sleep(0.2)

def get_cart_count(driver) -> Optional[int]:
    sels = ['span.header-cart-count','span.cart-count-badge','a[href*="cart"] .count','[aria-label*="カート"] .count','.header-cart .count']
    for sel in sels:
        with contextlib.suppress(Exception):
            el = driver.find_element(By.CSS_SELECTOR, sel)
            txt = (el.text or "").strip()
            if txt.isdigit(): return int(txt)
    return None

def wait_cart_added(driver, before_count=None, expected_delta=1, timeout=14):
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
                if el.is_displayed(): return True
        after = get_cart_count(driver)
        if before_count is not None and after is not None and after - before_count >= expected_delta:
            return True
        time.sleep(0.3)
    return False

def set_qty_if_field_exists(driver, wait, qty: int):
    for sel in ["input#qty","input[name='qty']","input.qty"]:
        with contextlib.suppress(Exception):
            el = driver.find_element(By.CSS_SELECTOR, sel)
            if el and el.is_displayed():
                driver.execute_script("arguments[0].focus();", el)
                el.clear()
                el.send_keys(str(qty))
                return True
    return False

def pick_simple_options_if_needed(driver, wait):
    # select
    for sel in driver.find_elements(By.CSS_SELECTOR, "select"):
        with contextlib.suppress(Exception):
            if not sel.is_displayed(): continue
            s = Select(sel)
            if any(o.is_selected() and o.get_attribute("value") for o in s.options):
                continue
            for o in s.options:
                val = (o.get_attribute("value") or "").strip()
                txt = (o.text or "").strip()
                if not val: continue
                if txt in ("選択してください","選択","--"): continue
                s.select_by_value(val)
                time.sleep(0.2)
                break
    # radio
    radios = driver.find_elements(By.CSS_SELECTOR, "input[type='radio']")
    by_name: Dict[str, List[Any]] = {}
    for r in radios:
        with contextlib.suppress(Exception):
            name = r.get_attribute("name") or ""
            if not name: continue
            by_name.setdefault(name, []).append(r)
    for name, group in by_name.items():
        if any((r.is_selected() for r in group)): continue
        for r in group:
            with contextlib.suppress(Exception):
                if r.is_displayed() and r.is_enabled():
                    driver.execute_script("arguments[0].click();", r)
                    time.sleep(0.2)
                    break

def find_add_to_cart_button(driver):
    csses = [
        "button.tocart","button#tocart","form[action*='checkout/cart'] button[type='submit']",
        "button[title*='カゴ']","button[title*='カート']",
        "button[aria-label*='カゴ']","button[aria-label*='カート']",
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

# ---------------- add to cart logic ----------------
def add_to_cart_via_url(driver: webdriver.Chrome, wait: WebDriverWait, *,
                        url: str, pid: str, name: str, qty: int = 1, max_retries: int = 3, sleep_after_click=0.5):
    assert_authenticated_or_relogin(driver, wait)

    driver.get(url)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    wait_dom_stable(driver, duration=0.6, timeout=10)
    try_close_common_popups(driver)

    # fallback search if page not found
    body_text = ""
    with contextlib.suppress(Exception):
        body_text = driver.find_element(By.TAG_NAME, "body").text or ""
    not_found_phrases = ["指定のページが見つかりませんでした","お探しのページは見つかりません","この商品は現在取り扱っておりません","在庫がありません","404"]
    if any(p in body_text for p in not_found_phrases):
        # fallback: go to home and search
        q = pid or (name[:20] if name else "")
        logger.info("指定URLが無効っぽい。検索で再特定: %s", q)
        driver.get(HOME_URL)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        wait_dom_stable(driver, duration=0.6, timeout=10)
        try_close_common_popups(driver)
        # try basic search inputs
        found = False
        for sel in ["input[type='search']", "input[name='q']","input[placeholder*='検索']","input[placeholder*='さがす']"]:
            with contextlib.suppress(Exception):
                el = driver.find_element(By.CSS_SELECTOR, sel)
                if el.is_displayed():
                    el.clear()
                    el.send_keys(q)
                    el.send_keys(Keys.ENTER)
                    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                    wait_dom_stable(driver, duration=0.6, timeout=10)
                    found = True
                    break
        if not found:
            raise RuntimeError("検索ボックスが見つからない（404 fallback失敗）")
        # click first result heuristically
        clicked = False
        for sel in ["a.product-item-link","a[href*='.html']","a[href*='/netsuper/']"]:
            with contextlib.suppress(Exception):
                for a in driver.find_elements(By.CSS_SELECTOR, sel):
                    href = (a.get_attribute("href") or "")
                    if not href.endswith(".html"): continue
                    try:
                        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", a)
                        a.click()
                    except Exception:
                        driver.get(href)
                    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                    wait_dom_stable(driver, duration=0.6, timeout=10)
                    try_close_common_popups(driver)
                    clicked = True
                    break
            if clicked: break
        if not clicked:
            raise RuntimeError("検索しても商品ページを特定できない（404 fallback失敗）")

    pick_simple_options_if_needed(driver, wait)

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

            # click after might go to login
            if is_login_page(driver):
                logger.info("クリック後にログインへ遷移。再ログインして再試行。")
                ensure_logged_in(driver, wait, force=True, max_wait_sec=300)
                continue

            ok = wait_cart_added(driver, before_count=before, expected_delta=1, timeout=14)
            if ok:
                success_any = True
                now = get_cart_count(driver)
                if now is not None: before = now
                time.sleep(sleep_after_click)
                break
            else:
                time.sleep(0.8)

    if not success_any:
        raise RuntimeError("カート投入が検出できず失敗した可能性があります")

# ---------------- Firestore cart read (robust) ----------------
def _normalize_item_raw(it: Dict[str, Any]) -> Dict[str, Any]:
    url = (it.get("url") or it.get("link") or "").strip()
    pid = normalize_id(it.get("id"), url)
    if not pid:
        pid = id_from_url(url) or None
    name = (it.get("name") or it.get("title") or "").strip()
    q = it.get("quantity") or it.get("qty") or it.get("quantify") or it.get("count") or 1
    try:
        q = max(1, int(q))
    except Exception:
        q = 1
    price = None
    if "price" in it:
        try:
            price = float(it.get("price")) if it.get("price") not in (None, "") else None
        except Exception:
            price = None
    return {
        "id": pid,
        "url": url,
        "name": name,
        "image": it.get("image") or it.get("img") or "",
        "price": price,
        "quantity": q,
        "raw": it,
    }

def fetch_cart_items(db: fb_firestore.Client, cart_path: str, from_all: bool = False) -> Tuple[int, List[Dict[str, Any]]]:
    segs = [s for s in cart_path.split("/") if s]
    docs = []
    if len(segs) % 2 == 1:
        col = db.collection(cart_path)
        try:
            snap_docs = list(col.stream())
        except Exception:
            snap_docs = []
        docs = snap_docs
    else:
        doc_ref = db.document(cart_path)
        snap = doc_ref.get()
        docs = [snap] if snap.exists else []

    items: List[Dict[str, Any]] = []
    for d in docs:
        data = d.to_dict() if hasattr(d, "to_dict") else (d if isinstance(d, dict) else None)
        if not data:
            continue

        # 1) items array
        arr = data.get("items")
        if isinstance(arr, list) and arr:
            for it in arr:
                if isinstance(it, dict):
                    items.append(_normalize_item_raw(it))
                elif isinstance(it, str):
                    try:
                        parsed = json.loads(it)
                        if isinstance(parsed, dict):
                            items.append(_normalize_item_raw(parsed))
                    except Exception:
                        continue
            continue

        # 2) rawobj
        if "rawobj" in data and data["rawobj"]:
            rawobj = data["rawobj"]
            if isinstance(rawobj, str):
                try:
                    parsed = json.loads(rawobj)
                    if isinstance(parsed, dict):
                        items.append(_normalize_item_raw(parsed))
                        continue
                except Exception:
                    pass
            elif isinstance(rawobj, dict):
                items.append(_normalize_item_raw(rawobj))
                continue

        # 3) doc itself contains item-like fields
        candidate_keys = ["id", "url", "name", "title", "image", "img", "price", "quantity", "qty", "quantify", "count"]
        candidate = {}
        for k in candidate_keys:
            if k in data:
                candidate[k] = data[k]
        if candidate:
            items.append(_normalize_item_raw(candidate))
            continue

        # 4) try parse any JSON-string field
        found = False
        for v in data.values():
            if isinstance(v, str) and v.strip().startswith("{") and v.strip().endswith("}"):
                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, dict):
                        items.append(_normalize_item_raw(parsed))
                        found = True
                        break
                except Exception:
                    pass
        if found:
            continue

        # else ignore

    return (len(docs), items)

def dedupe_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: Set[str] = set()
    out: List[Dict[str, Any]] = []
    for it in items:
        k = stable_key(it)
        if k in seen: continue
        seen.add(k)
        out.append(it)
    return out

# ---------------- postprocess: move cart -> history ----------------
def move_cart_to_history(db: fb_firestore.Client, uid: str, cart_path: str, history_doc: str, dry: bool = True, debug: bool = False):
    # read cart docs
    segs = [s for s in cart_path.split("/") if s]
    if len(segs) % 2 == 1:
        # collection
        col = db.collection(cart_path)
        docs = list(col.stream())
    else:
        docref = db.document(cart_path)
        snap = docref.get()
        docs = [snap] if snap.exists else []

    all_items = []
    doc_ids_to_delete = []
    for d in docs:
        data = d.to_dict() if hasattr(d, "to_dict") else (d if isinstance(d, dict) else None)
        if not data: continue
        # try same normalization as fetch_cart_items
        arr = data.get("items")
        if isinstance(arr, list) and arr:
            for it in arr:
                if isinstance(it, dict):
                    norm = _normalize_item_raw(it)
                    all_items.append(norm)
        elif "rawobj" in data and data["rawobj"]:
            rawobj = data["rawobj"]
            if isinstance(rawobj, str):
                try:
                    parsed = json.loads(rawobj)
                    if isinstance(parsed, dict):
                        all_items.append(_normalize_item_raw(parsed))
                except Exception:
                    pass
            elif isinstance(rawobj, dict):
                all_items.append(_normalize_item_raw(rawobj))
        else:
            candidate_keys = ["id","url","name","image","price","quantity","qty","quantify","count","title"]
            candidate = {}
            for k in candidate_keys:
                if k in data:
                    candidate[k] = data[k]
            if candidate:
                all_items.append(_normalize_item_raw(candidate))

        # mark doc for deletion if collection-style
        if hasattr(d, "id"):
            doc_ids_to_delete.append((d.reference if hasattr(d, "reference") else None, getattr(d, "id", None)))
        else:
            # if snap (single doc), store its ref
            if hasattr(d, "reference"):
                doc_ids_to_delete.append((d.reference, getattr(d, "id", None)))

    if not all_items:
        logger.info("move_postprocess: cart has no items to move.")
        return {"wrote": 0, "deleted": 0, "historyDocPath": f"users/{uid}/history/{history_doc}"}

    # prepare items with timestamp (ISO string) to avoid serverTimestamp inside arrays
    now_iso = datetime.utcnow().replace(tzinfo=timezone.utc).isoformat()
    items_for_history = []
    for it in all_items:
        item_copy = {
            "id": it.get("id"),
            "url": it.get("url"),
            "name": it.get("name"),
            "image": it.get("image"),
            "price": it.get("price"),
            "quantity": it.get("quantity"),
            "timeStamp": now_iso,
        }
        items_for_history.append(item_copy)

    hist_doc_path = f"users/{uid}/history/{history_doc}"
    hist_ref = db.document(hist_doc_path)

    def txn_fn(tx):
        # read existing
        try:
            hist_snap = tx.get(hist_ref)
            base = hist_snap.to_dict() if hist_snap.exists else {}
            existing_items = base.get("items") if base and isinstance(base.get("items"), list) else []
            new_items = existing_items + items_for_history
            # set updatedAt server timestamp and items
            tx.set(hist_ref, {"items": new_items, "updatedAt": fb_firestore.SERVER_TIMESTAMP}, merge=True)
        except Exception as e:
            # fallback: set whole
            tx.set(hist_ref, {"items": items_for_history, "updatedAt": fb_firestore.SERVER_TIMESTAMP}, merge=True)

    if dry:
        logger.info("[DRY] would append to history doc: %s", hist_doc_path)
        logger.debug("[DRY] items sample: %s", json.dumps(items_for_history[:4], ensure_ascii=False, indent=2))
        logger.info("[DRY] would delete %d cart doc(s)", len(doc_ids_to_delete))
        return {"wrote": 1, "deleted": 0, "historyDocPath": hist_doc_path}

    # commit transaction
    db.transaction()(txn_fn)  # run transaction
    # delete cart docs
    deleted = 0
    for ref, docid in doc_ids_to_delete:
        if ref is None:
            continue
        try:
            ref.delete()
            deleted += 1
        except Exception as e:
            logger.warning("Failed to delete cart doc %s: %s", docid, e)

    logger.info("Moved %d items from cart -> history=%s (deleted %d docs)", len(items_for_history), hist_doc_path, deleted)
    return {"wrote": 1, "deleted": deleted, "historyDocPath": hist_doc_path}

# ---------------- CLI / main flow ----------------
def parse_args():
    p = argparse.ArgumentParser(description="AEON Netsuper AutoCart: Firestore cart -> AEON cart -> move to history")
    p.add_argument("--user-data-dir", default=DEFAULT_USER_DATA_DIR)
    p.add_argument("--profile-dir", default=None)
    p.add_argument("--debugger-address", default=None)
    p.add_argument("--headless", action="store_true")
    p.add_argument("--auto-attach", action="store_true")
    # firebase
    p.add_argument("--use-firebase", action="store_true")
    p.add_argument("--fb-cred", default=os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", ""))
    p.add_argument("--fb-project", default="")
    p.add_argument("--cart-path", default="users/uid/cart")
    p.add_argument("--from-all", action="store_true")
    # behavior
    p.add_argument("--uid", required=True, help="target user id")
    p.add_argument("--dedupe", action="store_true")
    p.add_argument("--sleep-after-add", type=float, default=0.6)
    p.add_argument("--max-retries-per-item", type=int, default=3)
    p.add_argument("--keep-open", action="store_true")
    p.add_argument("--no-home-return", action="store_true")
    p.add_argument("--call-postprocess", action="store_true", help="after adding, move cart->history")
    p.add_argument("--history-doc", default="last-checkout")
    p.add_argument("--dry", action="store_true")
    return p.parse_args()

def main():
    args = parse_args()
    if args.dedupe:
        logger.info("重複除去 ON")

    db = None
    if args.use_firebase:
        try:
            db = init_fb(args.fb_cred)
        except Exception as e:
            logger.error("Firebase init failed: %s", e)
            return

    # fetch cart items
    if not db:
        logger.error("Firestore client is required (--use-firebase).")
        return
    cart_path = args.cart_path.replace("uid", args.uid)
    docs_count, items = fetch_cart_items(db, cart_path, from_all=args.from_all)
    logger.info("cart 読み取り: %s docs=%d items=%d", cart_path, docs_count, len(items))
    if args.dedupe:
        items = dedupe_items(items)
        logger.info("重複除去後 items: %d", len(items))
    if not items:
        logger.info("投入対象がありません。終了。")
        return

    # build driver
    try:
        driver = build_driver(user_data_dir=args.user_data_dir,
                              profile_dir=args.profile_dir,
                              headless=args.headless,
                              debugger_address=args.debugger_address,
                              auto_attach=args.auto_attach)
    except Exception as e:
        logger.error("ブラウザ起動失敗: %s", e)
        return

    wait = WebDriverWait(driver, 20)
    try:
        ensure_logged_in(driver, wait, force=False, max_wait_sec=300)
        success_count = 0
        for it in items:
            url = it.get("url") or (f"{BASE}/{it.get('id')}.html" if it.get("id") else "")
            pid = it.get("id") or normalize_id(it.get("id") or "", url)
            name = it.get("name") or ""
            qty = it.get("quantity") or 1
            try:
                add_to_cart_via_url(driver, wait, url=url, pid=pid or "", name=name, qty=qty,
                                    max_retries=args.max_retries_per_item, sleep_after_click=args.sleep_after_add)
                success_count += 1
            except Exception as e:
                logger.error("Failed to add %s: %s", (name or pid or "N/A"), e)

        if not args.no_home_return:
            with contextlib.suppress(Exception):
                driver.get(HOME_URL)
                wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
                wait_dom_stable(driver, duration=0.5, timeout=6)

        logger.info("追加処理完了: success_count=%d / total=%d", success_count, len(items))

        # postprocess: move cart->history
        if args.call_postprocess:
            if success_count > 0:
                logger.info("postprocess を実行します（cart -> history）")
                res = move_cart_to_history(db, args.uid, cart_path, args.history_doc, dry=args.dry, debug=True)
                logger.info("postprocess result: %s", res)
            else:
                logger.info("追加成功数0。postprocess はスキップします。")
        else:
            logger.info("postprocess (--call-postprocess) が指定されていません。スキップ。")

        # keep open?
        if args.keep_open:
            logger.info("keep-open が有効。ブラウザを開いたまま待機します...")
            while True:
                time.sleep(1)
    finally:
        if not args.keep_open:
            with contextlib.suppress(Exception):
                driver.quit()

if __name__ == "__main__":
    main()