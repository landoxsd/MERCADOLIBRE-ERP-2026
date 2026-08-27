"""
================================================================
scrapling-service/scrapers/item.py
Extractor de Seller ID desde URL directa de Producto MLV.
Usa StealthyFetcher (Camoufox) para bypassear Anubis PoW.

Estrategias (en orden):
  1. Regex sobre window.__PRELOADED_STATE__ (seller_id numérico)
  2. Regex sobre cualquier "seller_id": XXXXX en el HTML
  3. Buscar link "_CustId_XXXXXX" en el DOM (botón "Ver más productos")
  4. CSS input[name='seller_id']
================================================================
"""
import re
import json
import logging
from scrapling import StealthyFetcher

log = logging.getLogger("scrapling-service")


def get_item_seller(item_id: str) -> dict:
    url = f"https://articulo.mercadolibre.com.ve/{item_id}"
    log.info(f"[Item Scraper] Abriendo: {url}")

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
            try:
                html = html_raw.decode("utf-8", errors="replace")
            except Exception:
                html = str(html_raw)
        else:
            html = str(html_raw)

    log.info(f"[Item Scraper] HTML size: {len(html)} chars")
    log.info(f"[Item Scraper] Page URL final: {page.url if hasattr(page, 'url') else 'unknown'}")

    seller_id = None
    nickname = None

    # ──────────────────────────────────────────────────────────────
    # Estrategia 1: __PRELOADED_STATE__ JSON embebido
    # ──────────────────────────────────────────────────────────────
    try:
        preloaded_match = re.search(
            r'window\.__PRELOADED_STATE__\s*=\s*(\{.{100,}\});?\s*</script',
            html, re.DOTALL
        )
        if preloaded_match:
            raw_json = preloaded_match.group(1)
            state = json.loads(raw_json)
            # Buscar seller_id en el árbol de componentes
            def find_seller_id(obj):
                if isinstance(obj, dict):
                    if 'seller_id' in obj and isinstance(obj['seller_id'], (int, str)):
                        val = str(obj['seller_id'])
                        if val.isdigit() and len(val) > 3:
                            return int(val)
                    for v in obj.values():
                        result = find_seller_id(v)
                        if result:
                            return result
                elif isinstance(obj, list):
                    for item in obj:
                        result = find_seller_id(item)
                        if result:
                            return result
                return None
            seller_id = find_seller_id(state)
            if seller_id:
                log.info(f"[Item Scraper] ✅ seller_id via __PRELOADED_STATE__: {seller_id}")
    except Exception as e:
        log.warning(f"[Item Scraper] __PRELOADED_STATE__ parse error: {e}")

    # ──────────────────────────────────────────────────────────────
    # Estrategia 2: Regex directo sobre el HTML (cualquier JSON)
    # ──────────────────────────────────────────────────────────────
    if not seller_id:
        patterns = [
            r'"seller_id"\s*:\s*(\d{5,12})',
            r'"sellerId"\s*:\s*(\d{5,12})',
            r'"seller_id"=&gt;(\d{5,12})',
            r'seller_id=(\d{5,12})',
        ]
        for pat in patterns:
            match = re.search(pat, html, re.IGNORECASE)
            if match:
                seller_id = int(match.group(1))
                log.info(f"[Item Scraper] ✅ seller_id via regex '{pat}': {seller_id}")
                break

    # ──────────────────────────────────────────────────────────────
    # Estrategia 3: Buscar _CustId_ en links del DOM
    # (botón "Ver más productos del vendedor")
    # ──────────────────────────────────────────────────────────────
    if not seller_id:
        cust_match = re.search(r'_CustId_(\d+)', html)
        if cust_match:
            seller_id = int(cust_match.group(1))
            log.info(f"[Item Scraper] ✅ seller_id via _CustId_ link: {seller_id}")

    # ──────────────────────────────────────────────────────────────
    # Estrategia 4: CSS input[name='seller_id']
    # ──────────────────────────────────────────────────────────────
    if not seller_id:
        try:
            hidden_input = page.css("input[name='seller_id']")
            if hidden_input:
                val = hidden_input[0].attrib.get('value', '')
                if val.isdigit():
                    seller_id = int(val)
                    log.info(f"[Item Scraper] ✅ seller_id via hidden input: {seller_id}")
        except Exception as e:
            log.warning(f"[Item Scraper] CSS input estrategia falló: {e}")

    # ──────────────────────────────────────────────────────────────
    # Extraer Nickname (para enriquecer el resultado)
    # ──────────────────────────────────────────────────────────────
    try:
        nick_match = re.search(r'"nickname"\s*:\s*"([A-Z0-9_\-]+)"', html)
        if nick_match:
            nickname = nick_match.group(1)
    except Exception:
        pass

    log.info(f"[Item Scraper] Resultado final → seller_id={seller_id}, nickname={nickname}")

    return {
        "item_id": item_id,
        "seller_id": seller_id,
        "nickname": nickname,
        "url": url,
        "status": "success" if seller_id else "not_found"
    }
