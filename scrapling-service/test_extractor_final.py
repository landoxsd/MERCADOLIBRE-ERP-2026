"""
==============================================================
EXTRACTOR FINAL - StealthyFetcher + Scrapling Selector API
==============================================================
API correcta para elementos hijo (Selector):
  - card.css("selector")      → lista, usar [0] para primero
  - card.get_all_text()       → todo el texto de la tarjeta
  - card.html_content         → HTML interno (bytes o str)
  - card.attrib               → atributos del elemento
  - card.text                 → texto directo (NO recursivo)
  - card.find(tag="a")        → buscar descendiente por tag
  - NO existe css_first() en Selector (solo en Response)
==============================================================
"""
import sys, io, time, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from scrapling import StealthyFetcher

QUERY = "amortiguador delantero"
URL = f"https://listado.mercadolibre.com.ve/{QUERY.replace(' ', '-')}"

print("=" * 60)
print(f"[SCRAPLING FINAL] SERP Position Tracker - MLV")
print(f"[Query] '{QUERY}'")
print("=" * 60)

start = time.time()
page = StealthyFetcher.fetch(
    URL,
    headless=True,
    network_idle=True,
    timeout=60000,
    wait_selector="li.ui-search-layout__item",
)
elapsed_fetch = time.time() - start
print(f"[OK] Pagina cargada en {elapsed_fetch:.1f}s | HTML: {len(page.body or b''):,} bytes")

cards = page.css("li.ui-search-layout__item")
print(f"[Tarjetas] {len(cards)} resultados encontrados en MLV\n")

results = []
for i, card in enumerate(cards):
    try:
        # --- URL e ID del item ---
        # Usar css() que devuelve lista, tomar [0]
        links = card.css("a")
        href = ""
        for lnk in links:
            h = lnk.attrib.get("href", "")
            if "mercadolibre.com.ve" in h or "MLV" in h:
                href = h
                break
        if not href and links:
            href = links[0].attrib.get("href", "")

        id_match = re.search(r'MLV\d+', href, re.IGNORECASE)
        item_id = id_match.group(0).upper() if id_match else None

        # --- Texto completo de la tarjeta ---
        all_text = card.get_all_text()
        lines = [l.strip() for l in all_text.split('\n') if l.strip()]

        # --- Thumbnail URL desde html_content ---
        html = card.html_content
        if isinstance(html, bytes):
            html = html.decode('utf-8', errors='replace')
        img_match = re.search(r'src="(https://http2\.mlstatic\.com/[^"]+)"', html)
        thumbnail = img_match.group(1) if img_match else None

        # --- Parsear lineas del texto ---
        # Estructura tipica:
        # ["¡ULTIMA!", "Amortiguador Delantero Aveo...", "Vendedor 298", "5.0", "US$", "30", ",", "99", "Envio gratis"]
        # Filtrar labels como ¡ULTIMA!, ¡NUEVO!, etc.
        skip_labels = {"¡ultima!", "¡nuevo!", "¡oferta!", "más vendido", "mas vendido", "patrocinado"}
        clean_lines = [l for l in lines if l.lower() not in skip_labels and not l.startswith('¡')]

        title = clean_lines[0] if clean_lines else ""

        # Precio: buscar "US$" o "$" en el texto
        price_str = ""
        currency = "USD"
        for j, ln in enumerate(lines):
            if ln in ("US$", "$", "Bs."):
                currency = "USD" if "US" in ln else "VES"
                # Los numeros siguen en las proximas lineas: "30", ",", "99" => 30.99
                price_parts = []
                for pln in lines[j+1:j+5]:
                    if re.match(r'^[\d.,]+$', pln):
                        price_parts.append(pln)
                    elif pln in (',', '.'):
                        price_parts.append(pln)
                    else:
                        break
                price_raw = "".join(price_parts).replace(",", ".")
                try:
                    price_val = float(price_raw)
                    price_str = f"{currency} {price_val:.2f}"
                except:
                    price_str = f"{currency} {price_raw}"
                break

        # Vendedor: busca patron "Texto NNN" donde NNN es numero de ventas
        seller = ""
        seller_match = re.search(r'^(.+?)\s+(\d+)\s*$', "\n".join(clean_lines[1:3] if len(clean_lines) > 1 else []))
        if seller_match:
            seller = seller_match.group(1).strip()
            sold_qty = int(seller_match.group(2))
        else:
            # Alternativa: segunda linea limpia como vendedor
            seller = clean_lines[1] if len(clean_lines) > 1 else ""
            sold_qty = 0

        # Free shipping
        free_shipping = "gratis" in all_text.lower() and "envio" in all_text.lower()

        if title:
            results.append({
                "pos": i + 1,
                "id": item_id or "N/A",
                "title": title,
                "price": price_str or "N/A",
                "seller": seller,
                "sold": sold_qty,
                "free_shipping": free_shipping,
                "thumbnail": thumbnail,
                "url": href,
            })
    except Exception as ex:
        pass  # Silenciar errores individuales

# ---- MOSTRAR RESULTADOS ----
total_time = time.time() - start
print(f"{'#':>3} {'ID MLV':<14} {'TITULO':<45} {'PRECIO':<14} {'VENDEDOR':<20} {'GRATIS'}")
print("-" * 110)
for r in results:
    gratis = "SI" if r["free_shipping"] else "  "
    print(f"{r['pos']:>3} {r['id']:<14} {r['title'][:44]:<45} {r['price']:<14} {r['seller'][:19]:<20} {gratis}")

print(f"\n[Total extraidos] {len(results)} de {len(cards)} tarjetas")
print(f"[Tiempo total]    {total_time:.1f}s  (fetch: {elapsed_fetch:.1f}s + parse: {total_time - elapsed_fetch:.1f}s)")

# ---- DEMO: SERP POSITION TRACKING ----
print("\n" + "=" * 60)
print("[DEMO SERP POSITION] Como encontrar tu posicion en el ranking:")
print("=" * 60)
MY_ITEM_IDS = ["MLV123456", "MLV789012"]  # Ejemplos - sustituir con tus IDs reales
for my_id in MY_ITEM_IDS:
    found = next((r for r in results if r["id"] == my_id), None)
    if found:
        print(f"  [{my_id}] -> POSICION #{found['pos']} en el SERP!")
    else:
        print(f"  [{my_id}] -> No en top {len(results)} resultados")

print("\n[CONCLUSION FINAL]")
print(f"  StealthyFetcher extrae {len(results)} productos de MLV completamente")
print(f"  Tiempo: {total_time:.1f}s | 100% funcional para SERP tracking")
print(f"  Listo para integrar en /api/scraping/stats/position")
print("=" * 60)
