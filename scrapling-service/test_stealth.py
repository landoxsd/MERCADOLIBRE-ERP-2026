"""
==============================================================
TEST 2 - StealthyFetcher vs MLV Venezuela (listado.mercadolibre.com.ve)
==============================================================
StealthyFetcher:
  - Lanza un browser Camoufox (Firefox modificado anti-fingerprint)
  - Ejecuta JavaScript completo en la pagina
  - Evade Cloudflare Turnstile, Anubis PoW, y similares
  - Bloquea WebRTC leaks y canvas tracking

Objetivo: confirmar que puede obtener los PRODUCTOS REALES
del listado con JS renderizado, para usar en SERP position tracking.
==============================================================
"""
import sys, io, time, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from scrapling import StealthyFetcher

QUERY = "amortiguador delantero"
URL = f"https://listado.mercadolibre.com.ve/{QUERY.replace(' ', '-')}"

print("=" * 60)
print(f"[STEALTHY FETCHER TEST] MLV Venezuela")
print(f"[Query] {QUERY}")
print(f"[URL]   {URL}")
print(f"[Modo] Browser headless con JS completo")
print("=" * 60)
print("\n[!] Iniciando browser stealth... (puede tardar 10-20s la primera vez)")

start = time.time()

try:
    # StealthyFetcher - lanza Camoufox, resuelve challenges JS
    page = StealthyFetcher.fetch(
        URL,
        headless=True,
        network_idle=True,          # Esperar que la red este inactiva (JS cargado)
        timeout=60000,              # 60 segundos timeout
        wait_selector="li.ui-search-layout__item, .poly-card",  # Esperar hasta que aparezcan tarjetas
    )
    elapsed = time.time() - start

    body = page.body or b""
    body_str = body.decode("utf-8", errors="replace") if isinstance(body, bytes) else (body or "")

    print(f"\n[OK] Browser completo en {elapsed:.1f}s")
    print(f"[Status] {page.status}")
    print(f"[HTML size] {len(body_str):,} bytes  (esperamos >>10KB si hay productos)")

    title_els = page.css("title")
    page_title = title_els[0].text if title_els else "(sin titulo)"
    print(f"[Titulo] {page_title}")

    # Detectar challenge activo
    body_lower = body_str.lower()
    is_blocked = (
        "anubis" in body_lower or
        "challenge" in page_title.lower() or
        "checking" in page_title.lower() or
        len(body_str) < 15000
    )

    if is_blocked:
        print(f"\n[BLOQUEADO] Anubis resiste incluso StealthyFetcher")
        print(f"  -> Tamano HTML: {len(body_str):,} bytes (muy pequeno para una pagina con productos)")
        print(f"\n[HTML preview]:")
        print(body_str[:600])
    else:
        print(f"\n[EXITO! HTML completo con JS renderizado]")

        # Intentar extraer tarjetas
        SELECTORS = [
            "li.ui-search-layout__item",
            ".poly-card",
            ".ui-search-result__wrapper",
            "[data-testid='polycard']",
        ]

        cards = []
        active_sel = None
        for sel in SELECTORS:
            found = page.css(sel)
            if found:
                cards = found
                active_sel = sel
                break

        print(f"[Selector] '{active_sel}' -> {len(cards)} tarjetas")

        results = []
        for i, card in enumerate(cards[:20]):
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
                        "url": href,
                    })
            except Exception:
                pass

        if results:
            print(f"\n[PRODUCTOS EXTRAIDOS] {len(results)} resultados:")
            print("-" * 60)
            for r in results:
                print(f"  #{r['pos']:>2} [{r['id']}]")
                print(f"        {r['title'][:55]}")
                print(f"        Precio: {r['price']} | Vendedor: {r['seller']}")
            print("-" * 60)
            print(f"\n[SERP POSITION] Para buscar 'tu' publicacion:")
            print(f"  Buscar tu MLV-ID entre los {len(results)} resultados = tu posicion!")
        else:
            print("[!] Tarjetas encontradas pero sin datos extraibles")
            if cards:
                print("[DEBUG] Primera tarjeta raw:")
                raw = cards[0].body
                if isinstance(raw, bytes):
                    raw = raw.decode('utf-8', errors='replace')
                print(str(raw)[:500])

    print(f"\n[TIEMPO] {elapsed:.1f}s total")
    print("\n" + "=" * 60)
    print("[RESUMEN FINAL DEL POC COMPLETO]")
    print(f"  Fetcher HTTP:     0.33s | Sin productos (Anubis sirve shell)")
    print(f"  StealthyFetcher:  {elapsed:.1f}s | {'PRODUCTOS OBTENIDOS' if not is_blocked else 'BLOQUEADO'}")
    print(f"\n  ESTRATEGIA FINAL:")
    if not is_blocked:
        print(f"  -> StealthyFetcher para SERP position tracking MLV")
        print(f"  -> Fetcher para sitios externos (Amazon/eBay) = 0.33s")
        print(f"  -> API JSON oficial para datos de items MLV = ya OK")
    else:
        print(f"  -> StealthyFetcher tampoco puede con Anubis en listados web")
        print(f"  -> SERP position: usar API /search?q=... (misma que usamos)")
        print(f"  -> Fetcher = ideal para sitios externos sin challenge JS")
    print("=" * 60)

except Exception as e:
    elapsed = time.time() - start
    print(f"\n[ERROR en {elapsed:.1f}s]: {e}")
    import traceback
    traceback.print_exc()
