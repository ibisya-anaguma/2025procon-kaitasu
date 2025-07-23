# あらとも
# scraper用

import os
import json
import sys
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# -----------------------------------------------------------------------------
# 設定
# -----------------------------------------------------------------------------
CATEGORY_FILE = "../db/categories.txt"  # 1行に1URLずつ記述 (カテゴリページURL)
OUTPUT_FILE   = "../db/all_products.json"

# -----------------------------------------------------------------------------
# カテゴリ URL 読み込み
# -----------------------------------------------------------------------------
def load_category_urls():
    if not os.path.exists(CATEGORY_FILE):
        print(f"Error: '{CATEGORY_FILE}' が見つかりません")
        sys.exit(1)
    with open(CATEGORY_FILE, encoding='utf-8') as f:
        urls = [u.strip() for u in f if u.strip()]
    print(f"読み込んだ {len(urls)} URLs from {CATEGORY_FILE}")
    return urls

# -----------------------------------------------------------------------------
# カテゴリページから詳細ページのURLを収集
# -----------------------------------------------------------------------------
def collect_detail_urls(driver, wait, category_url):
    print(f"Collecting detail URLs from {category_url}")
    driver.get(category_url)
    time.sleep(1)
    prev_count = 0
    while True:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(1)
        links = driver.find_elements(By.CSS_SELECTOR, 'a.product-item-link')
        if len(links) == prev_count:
            break
        prev_count = len(links)
    hrefs = {a.get_attribute('href') for a in links if a.get_attribute('href')}
    print(f"  Found {len(hrefs)} detail URLs")
    return sorted(hrefs)

# -----------------------------------------------------------------------------
# 詳細ページから商品情報を取得
# -----------------------------------------------------------------------------
def scrape_detail(driver, wait, detail_url):
    print(f"Scraping: {detail_url}")
    driver.get(detail_url)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body')))
    time.sleep(0.5)
    # ID
    pid = detail_url.rstrip('/').split('/')[-1].replace('.html','')
    # 商品名
    try:
        name_el = driver.find_element(By.CSS_SELECTOR, 'h2.section-title-text')
    except:
        name_el = driver.find_element(By.TAG_NAME, 'h1')
    name = name_el.text.strip()
    # 画像URL
    try:
        img_url = driver.find_element(By.CSS_SELECTOR, 'meta[property="og:image"]').get_attribute('content')
    except:
        try:
            img_url = driver.find_element(By.CSS_SELECTOR, 'div.product-media img').get_attribute('src')
        except:
            img_url = ''
    # 価格
    try:
        price_text = driver.find_element(By.CSS_SELECTOR, 'span.floor-price').text
        price = int(price_text.replace(',', '').strip())
    except:
        price = 0
    # 税込価格
    try:
        tax_int = driver.find_element(By.CSS_SELECTOR, 'p.price.product-tax span.floor-tax').text.strip()
        tax_dec = driver.find_element(By.CSS_SELECTOR, 'p.price.product-tax span.decimal-tax').text.strip().lstrip('.')
        price_tax = float(f"{tax_int}.{tax_dec}")
    except:
        price_tax = price
    return {
        'id': pid,
        'url': detail_url,
        'name': name,
        'image': img_url,
        'price': price,
        'price_tax': price_tax,
    }

# -----------------------------------------------------------------------------
# メイン
# -----------------------------------------------------------------------------
def main():
    category_urls = load_category_urls()
    # ブラウザ起動
    opts = webdriver.ChromeOptions()
    opts.add_argument('--headless')
    opts.add_argument('--no-sandbox')
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=opts)
    wait = WebDriverWait(driver, 10)

    all_products = {}
    for cat_url in category_urls:
        detail_urls = collect_detail_urls(driver, wait, cat_url)
        for du in detail_urls:
            try:
                info = scrape_detail(driver, wait, du)
                all_products[info['id']] = info
            except Exception as e:
                print(f"Error scraping {du}: {e}")

    driver.quit()
    products = list(all_products.values())
    print(f"Total unique products: {len(products)}")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(products)} products to {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
