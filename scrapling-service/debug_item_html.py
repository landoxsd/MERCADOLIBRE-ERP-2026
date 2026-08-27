"""
Script de debug: ver qué HTML exactamente devuelve Camoufox para una pagina de producto.
Ejecutar: python debug_item_html.py
"""
import re
from scrapling import StealthyFetcher

item_id = "MLV824681578"
url = f"https://articulo.mercadolibre.com.ve/{item_id}"

print(f"[DEBUG] Abriendo: {url}")
page = StealthyFetcher.fetch(
    url,
    headless=True,
    network_idle=True,
    timeout=60000,
)

html_raw = page.html_content
html = ""
if html_raw:
    if hasattr(html_raw, "decode"):
        html = html_raw.decode("utf-8", errors="replace")
    else:
        html = str(html_raw)

print(f"[DEBUG] URL final: {getattr(page, 'url', 'desconocida')}")
print(f"[DEBUG] HTML size: {len(html)} chars")
print(f"[DEBUG] Primeros 2000 chars:")
print(html[:2000])
print("\n[DEBUG] Ultimos 500 chars:")
print(html[-500:])

# Buscar seller_id
seller_id_matches = re.findall(r'"seller_id"\s*:\s*(\d+)', html, re.IGNORECASE)
cust_id_matches = re.findall(r'_CustId_(\d+)', html)
print(f"\n[DEBUG] seller_id encontrados: {seller_id_matches}")
print(f"[DEBUG] _CustId_ encontrados: {cust_id_matches}")

# Guardar HTML para inspeccion
with open("debug_item_output.html", "w", encoding="utf-8") as f:
    f.write(html)
print(f"\n[DEBUG] HTML guardado en debug_item_output.html")
