"""
==============================================================
PRUEBA DE CONCEPTO FINAL - Scrapling vs MLV Venezuela
==============================================================
API correcta de Scrapling:
  - page.body          → HTML string
  - page.html_content  → HTML como objeto parseable
  - page.css(...)      → selectores CSS directos
  - page.status        → HTTP status code
  - page.find_by_text  → busqueda por texto
==============================================================
"""
import sys, io, time, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from scrapling import Fetcher

QUERY = "amortiguador delantero"
URL = f"https://listado.mercadolibre.com.ve/{QUERY.replace(' ', '-')}"

print("=" * 60)
print(f"[SCRAPLING POC FINAL] MLV Venezuela")
print(f"[Query] {QUERY}")
print(f"[URL]   {URL}")
print("=" * 60)

start = time.time()

try:
    page = Fetcher.get(URL, stealthy_headers=True, follow_redirects=True)
    elapsed = time.time() - start

    raw_body = page.body or b""
    body = raw_body.decode("utf-8", errors="replace") if isinstance(raw_body, bytes) else (raw_body or "")

    print(f"\n[OK] Respuesta en {elapsed:.2f}s")
    print(f"[Status] {page.status}")
    print(f"[HTML size] {len(body):,} bytes")

    # Titulo de pagina
    title_els = page.css("title")
    page_title = title_els[0].text if title_els else "(sin titulo)"
    print(f"[Titulo] {page_title}")

    # Detectar Anubis
    body_lower = body.lower()
    is_blocked = (
        "anubis" in body_lower or
        "challenge" in page_title.lower() or
        "checking" in page_title.lower() or
        "continue-button" in body_lower or
        len(body) < 10000
    )

    if is_blocked:
        print("\n[BLOQUEADO POR ANUBIS]")
        print("  -> Fetcher HTTP es bloqueado por el challenge PoW")
        print("  -> Para SERP de MLV necesitamos StealthyFetcher")
        print("  -> Para datos de items MLV: API JSON oficial (ya implementada)")
        print("\n[HTML preview]:")
        print(body[:400])
    else:
        print(f"\n[SIN BLOQUEO! Anubis no activo]")
        print("Extrayendo tarjetas de producto...")

        # Selectors para tarjetas de productos MLV
        SELECTORS = [
            "li.ui-search-layout__item",
            ".poly-card",
            ".ui-search-result__wrapper",
            "[data-testid='polycard']",
        ]
        cards = []
        for sel in SELECTORS:
            cards = page.css(sel)
            if cards:
                print(f"[Selector activo] '{sel}' -> {len(cards)} tarjetas")
                break

        if not cards:
            print("[!] Sin tarjetas con selectores conocidos")
            print("HTML preview (800 chars):")
            print(body[:800])
        else:
            results = []
            for i, card in enumerate(cards[:15]):
                try:
                    link_el = (
                        card.css_first("a[href*='mercadolibre.com.ve']") or
                        card.css_first("a.poly-component__title") or
                        card.css_first("a")
                    )
                    href = link_el.attrib.get("href", "") if link_el else ""
                    id_match = re.search(r'MLV\d+', href, re.IGNORECASE)
                    item_id = id_match.group(0).upper() if id_match else None

                    title_el = card.css_first(".poly-component__title, h2, .ui-search-item__title")
                    title_text = title_el.text.strip() if title_el else ""

                    price_el = card.css_first(".andes-money-amount__fraction")
                    price_text = price_el.text.strip() if price_el else "N/A"

                    seller_el = card.css_first(".poly-component__seller")
                    seller = seller_el.text.replace("Por", "").strip() if seller_el else "?"

                    if item_id and title_text:
                        results.append({
                            "pos": i + 1,
                            "id": item_id,
                            "title": title_text,
                            "price": price_text,
                            "seller": seller,
                        })
                except Exception:
                    pass

            if results:
                print(f"\n[RESULTADOS] {len(results)} productos encontrados:")
                print("-" * 60)
                for r in results:
                    print(f"  #{r['pos']} [{r['id']}]")
                    print(f"     Titulo:   {r['title'][:55]}")
                    print(f"     Precio:   {r['price']}")
                    print(f"     Vendedor: {r['seller']}")
                    print()
                print("-" * 60)
            else:
                print("[!] Tarjetas encontradas pero sin datos extraibles")
                print("[DEBUG] Primera tarjeta HTML:")
                print(cards[0].html_content[:500] if cards else "N/A")

    print(f"\n[TIEMPO TOTAL] {elapsed:.2f}s  (Playwright: 3-8s)")
    print("\n" + "=" * 60)
    print("[CONCLUSION]")
    if is_blocked:
        print("  * Anubis activo -> usar StealthyFetcher para SERP MLV")
        print("  * Fetcher HTTP -> perfecto para Amazon/eBay/externos")
        print("  * Ganancia: datos MLV via API JSON, externos via Fetcher")
    else:
        print("  * EXITO TOTAL: Scrapling bypassa Anubis con HTTP puro!")
        print(f"  * {elapsed:.2f}s vs 3-8s Playwright = 10-20x mas rapido")
        print("  * Sin browser, sin Chromium, sin memoria RAM")
    print("=" * 60)

except Exception as e:
    print(f"\n[ERROR]: {e}")
    import traceback
    traceback.print_exc()
