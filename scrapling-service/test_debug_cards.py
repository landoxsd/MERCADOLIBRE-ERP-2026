"""
==============================================================
TEST 3 - Debug extraccion de datos desde tarjetas
Sabemos: 48 tarjetas encontradas, pero datos vacios
Objetivo: descubrir la API correcta de elementos hijo
==============================================================
"""
import sys, io, time, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from scrapling import StealthyFetcher

QUERY = "amortiguador delantero"
URL = f"https://listado.mercadolibre.com.ve/{QUERY.replace(' ', '-')}"

print("=" * 60)
print("[DEBUG] Inspeccionando API de elementos hijo en Scrapling")
print("=" * 60)

start = time.time()
page = StealthyFetcher.fetch(
    URL,
    headless=True,
    network_idle=True,
    timeout=60000,
    wait_selector="li.ui-search-layout__item",
)
elapsed = time.time() - start
print(f"[OK] Pagina cargada en {elapsed:.1f}s")

cards = page.css("li.ui-search-layout__item")
print(f"[Tarjetas] {len(cards)}")

if cards:
    card = cards[0]
    print(f"\n[DEBUG] Tipo de elemento: {type(card)}")
    print(f"[DEBUG] Attrs disponibles (no privados):")
    attrs = [a for a in dir(card) if not a.startswith('_')]
    print(f"  {attrs}")

    print(f"\n[DEBUG] card.get_all_text(): {repr(card.get_all_text()[:200])}")
    print(f"\n[DEBUG] card.attrib: {dict(card.attrib)}")

    # Probar html_content
    try:
        hc = card.html_content
        if isinstance(hc, bytes): hc = hc.decode('utf-8', errors='replace')
        print(f"\n[DEBUG] card.html_content (primeros 500 chars):")
        print(hc[:500])
    except Exception as e:
        print(f"\n[DEBUG] html_content error: {e}")

    # Probar children
    try:
        children = list(card.children)
        print(f"\n[DEBUG] card.children count: {len(children)}")
        if children:
            print(f"  Primer child tipo: {type(children[0])}")
    except Exception as e:
        print(f"\n[DEBUG] children error: {e}")

    # Probar find con texto
    try:
        link = card.css_first("a")
        if link:
            print(f"\n[DEBUG] Primer <a> en card:")
            print(f"  attrib: {dict(link.attrib)}")
            print(f"  text: {repr(link.text)}")
            print(f"  get_all_text: {repr(link.get_all_text()[:100])}")
        else:
            print("\n[DEBUG] No se encontro <a> con css_first")
    except Exception as e:
        print(f"\n[DEBUG] css_first link error: {e}")

    # Probar find_by_text para titulo
    try:
        titulo = card.find(tag="h2")
        print(f"\n[DEBUG] find(tag='h2'): {repr(titulo)}")
    except Exception as e:
        print(f"\n[DEBUG] find h2 error: {e}")

    # --- Extraccion masiva con get_all_text ---
    print("\n" + "=" * 60)
    print("[EXTRACCION ALTERNATIVA] Usar get_all_text por tarjeta")
    print("=" * 60)
    results = []
    for i, c in enumerate(cards[:10]):
        try:
            all_text = c.get_all_text()
            link_el = c.css_first("a")
            href = link_el.attrib.get("href", "") if link_el else ""
            id_match = re.search(r'MLV\d+', href, re.IGNORECASE)
            item_id = id_match.group(0).upper() if id_match else None

            # Precio: buscar patron numerico (ej: "1.234,56" o "1234")
            price_match = re.search(r'[\d.,]{3,}', all_text)
            price = price_match.group(0) if price_match else "N/A"

            results.append({
                "pos": i + 1,
                "id": item_id or "?",
                "text_preview": all_text[:80].strip(),
                "price": price,
                "href": href[:60],
            })
        except Exception as ex:
            results.append({"pos": i+1, "error": str(ex)})

    print(f"\n[RESULTADOS via get_all_text] {len(results)}:")
    print("-" * 60)
    for r in results:
        if "error" in r:
            print(f"  #{r['pos']} ERROR: {r['error']}")
        else:
            print(f"  #{r['pos']} [{r['id']}] {r['text_preview']}")
            print(f"       URL: {r['href']}")
    print("-" * 60)

print(f"\n[TIEMPO TOTAL] {time.time() - start:.1f}s")
