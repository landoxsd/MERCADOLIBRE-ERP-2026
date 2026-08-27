from scrapling import StealthyFetcher
import re

url = "https://articulo.mercadolibre.com.ve/MLV-751567972"
print(f"Fetching {url}...")
page = StealthyFetcher.fetch(url, headless=True, timeout=60000)

html_raw = page.html_content
html = str(html_raw) if html_raw else ""
if hasattr(html_raw, "decode"):
    try:
        html = html_raw.decode("utf-8", errors="replace")
    except Exception:
        pass

print(f"HTML Length: {len(html)}")

match = re.search(r'"seller_id"\s*:\s*(\d+)', html, re.IGNORECASE) or \
        re.search(r'"sellerId"\s*:\s*(\d+)', html, re.IGNORECASE)
        
print(f"SELLER_ID FOUND: {match.group(1) if match else None}")

print(html[:1500])
