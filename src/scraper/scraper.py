# あらとも
# scraper用

import os
import json
import sys
import time
from typing import Dict, List, Set

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# 既定値（CLIで上書き可）------------------------------------------------------------
STORE_ID   = "01050000036000"   # 店舗/受取識別子
GENRE_MIN  = 10                 # ジャンル下限（含む）
GENRE_MAX  = 79                 # ジャンル上限（含む）
PAGE_MIN   = 1                  # ページ下限（含む）
PAGE_MAX   = 5                  # ページ上限（含む）
SORT_PARAM = "recommend"        # ページ（p>=2 のとき付与）

OUTPUT_JSON = "all_products.json"  # フラット配列JSON
HEADLESS = True                    # Trueにすると無画面実行

# 除外/包含のデフォルト（空なら無効）
EXCLUDE_GENRES_DEFAULT: Set[int] = {55}  # デフォルト除外欄
INCLUDE_GENRES_DEFAULT: Set[int] = set()
# -----------------------------------------------------------------------------

# ユーティリティ-------------------------------------------------------------------
def parse_genre_spec(spec: str) -> Set[int]:
    """'10-15,18,20-22' → {10,11,12,13,14,15,18,20,21,22}"""
    out: Set[int] = set()
    if not spec:
        return out
    for part in spec.split(','):
        part = part.strip()
        if not part:
            continue
        if '-' in part:
            lo, hi = part.split('-', 1)
            try:
                lo_i = int(lo); hi_i = int(hi)
                if lo_i > hi_i:
                    lo_i, hi_i = hi_i, lo_i
                out.update(range(lo_i, hi_i + 1))
            except ValueError:
                continue
        else:
            try:
                out.add(int(part))
            except ValueError:
                continue
    return out

def build_category_url(store_id: str, genre: int, page: int, sort_param: str) -> str:
    base = f"https://shop.aeon.com/netsuper/{store_id}/{genre}.html"
    if page <= 1:
        return base
    return f"{base}?p={page}&sort={sort_param}"

def collect_detail_urls(driver, wait, category_url: str) -> List[str]:
    print(f"Collecting detail URLs from {category_url}")
    driver.get(category_url)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body')))
    time.sleep(0.3)

    # 遅延読み込み対策：下までスクロールして増分が止まるまで繰り返す
    prev_count = -1
    rounds = 0
    while True:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(0.6)
        links = driver.find_elements(By.CSS_SELECTOR, 'a.product-item-link')
        if len(links) == prev_count:
            break
        prev_count = len(links)
        rounds += 1
        if rounds > 30:
            break

    hrefs = {a.get_attribute('href') for a in links if a.get_attribute('href')}
    print(f"  Found {len(hrefs)} detail URLs")
    return sorted(hrefs)

def scrape_detail(driver, wait, detail_url: str, genre: int) -> Dict:
    # print(f"Scraping: {detail_url}")
    driver.get(detail_url)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body')))
    time.sleep(0.4)

    # ID（URL末尾）
    pid = detail_url.rstrip('/').split('/')[-1].replace('.html','')

    # 商品名
    try:
        name_el = driver.find_element(By.CSS_SELECTOR, 'h2.section-title-text')
    except Exception:
        name_el = driver.find_element(By.TAG_NAME, 'h1')
    name = name_el.text.strip()

    # 画像URL
    img_url = ''
    try:
        img_url = driver.find_element(By.CSS_SELECTOR, 'meta[property="og:image"]').get_attribute('content')
    except Exception:
        try:
            img_url = driver.find_element(By.CSS_SELECTOR, 'div.product-media img').get_attribute('src')
        except Exception:
            img_url = ''

    # 価格（税抜）
    try:
        price_text = driver.find_element(By.CSS_SELECTOR, 'span.floor-price').text
        price = int(price_text.replace(',', '').strip())
    except Exception:
        price = 0

    # 価格（税込）
    try:
        tax_int = driver.find_element(By.CSS_SELECTOR, 'p.price.product-tax span.floor-tax').text.strip()
        tax_dec = driver.find_element(By.CSS_SELECTOR, 'p.price.product-tax span.decimal-tax').text.strip().lstrip('.')
        price_tax = float(f"{tax_int}.{tax_dec}")
    except Exception:
        price_tax = price

    return {
        'id': pid,
        'url': detail_url,
        'name': name,
        'image': img_url,
        'price': price,
        'price_tax': price_tax,
        'genre': genre,   # 代表ジャンル
    }

def main():
    import argparse

    parser = argparse.ArgumentParser(description="AEON NetSuper scraper (flat + exclude genres)")
    parser.add_argument('--store', default=STORE_ID)
    parser.add_argument('--genre-min', type=int, default=GENRE_MIN)
    parser.add_argument('--genre-max', type=int, default=GENRE_MAX)
    parser.add_argument('--page-min', type=int, default=PAGE_MIN)
    parser.add_argument('--page-max', type=int, default=PAGE_MAX)
    parser.add_argument('--sort', default=SORT_PARAM)
    parser.add_argument('--headless', action='store_true', help='ヘッドレスで起動（未指定なら既定のHEADLESSに従う）')
    parser.add_argument('--output', default=OUTPUT_JSON)
    parser.add_argument('--exclude-genres', default='', help='例: "12,30-35"（55はデフォルトで除外）')
    parser.add_argument('--include-genres', default='', help='例: "14,15,22,40-45"（指定があると min/max は無視）')
    args = parser.parse_args()

    store = args.store
    sort_param = args.sort
    genre_min = args.genre_min
    genre_max = args.genre_max
    page_min = args.page_min
    page_max = args.page_max

    # ジャンル集合を決定（デフォ除外{55} + CLI指定）
    include_cli = parse_genre_spec(args.include_genres)
    exclude_cli = parse_genre_spec(args.exclude_genres)
    include_all = (INCLUDE_GENRES_DEFAULT or set()) | include_cli
    exclude_all = (EXCLUDE_GENRES_DEFAULT or set()) | exclude_cli

    if include_all:
        genre_set = set(sorted(include_all))
    else:
        genre_set = set(range(genre_min, genre_max + 1))
    genre_set -= exclude_all
    genres = sorted(g for g in genre_set if g > 0)

    if not genres:
        print("Error: 対象ジャンルが空です（包含/除外の指定を見直してください）")
        sys.exit(1)

    print(f"対象ジャンル: {len(genres)}件 → {genres[:15]}{' ...' if len(genres)>15 else ''}")
    print(f"対象ページ: p={page_min}..{page_max} （p>=2 は sort={sort_param} 付与）")

    # ブラウザ起動
    opts = webdriver.ChromeOptions()
    if args.headless or HEADLESS:
        opts.add_argument('--headless=new')
    opts.add_argument('--no-sandbox')
    opts.add_argument('--disable-dev-shm-usage')
    opts.add_argument('--disable-gpu')
    opts.add_argument('--window-size=1400,1000')

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=opts)
    wait = WebDriverWait(driver, 10)

    all_products: Dict[str, Dict] = {}

    try:
        for genre in genres:
            # 一覧→詳細URL収集（重複排除）
            detail_urls_seen: Set[str] = set()
            for page in range(page_min, page_max + 1):
                list_url = build_category_url(store, genre, page, sort_param)
                try:
                    urls = collect_detail_urls(driver, wait, list_url)
                except Exception as e:
                    print(f"  Skip (list error): {list_url} / {e}")
                    continue
                before = len(detail_urls_seen)
                detail_urls_seen.update(urls)
                added = len(detail_urls_seen) - before
                print(f"  Genre {genre}: page {page} +{added} (total {len(detail_urls_seen)})")

            # 各詳細を巡回
            for du in sorted(detail_urls_seen):
                try:
                    info = scrape_detail(driver, wait, du, genre)
                    pid = info['id']
                    if pid in all_products:
                        genres_set = set(all_products[pid].get('genres', []))
                        genres_set.add(genre)
                        all_products[pid]['genres'] = sorted(genres_set)
                    else:
                        info['genres'] = [genre]
                        all_products[pid] = info
                except Exception as e:
                    print(f"  Error scraping {du}: {e}")

        # 出力（フラット配列）
        products: List[Dict] = list(all_products.values())
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(products, f, ensure_ascii=False, indent=2)
        print(f"Wrote {len(products)} products to {args.output}")

    finally:
        driver.quit()
        print("Browser closed")

if __name__ == '__main__':
    main()

# -----------------------------------------------------------------------------
