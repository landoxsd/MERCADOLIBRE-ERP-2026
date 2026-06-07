"""
================================================================
scrapling-service/scrapers/serp.py
Extractor SERP para MercadoLibre Venezuela.
Usa StealthyFetcher (Camoufox) para bypassear Anubis PoW.
================================================================
"""
import re
from scrapling import StealthyFetcher

# Labels que NO son título de producto
SKIP_LABELS = {
    "¡nueva!","¡nuevo!","¡ultima!","¡últimas!","¡oferta!",
    "más vendido","mas vendido","patrocinado","publicidad",
}

def _decode(raw) -> str:
    if isinstance(raw, bytes):
        return raw.decode("utf-8", errors="replace")
    return raw or ""


def _parse_card(card, position: int) -> dict | None:
    """
    Extrae datos de una tarjeta <li.ui-search-layout__item>.
    Retorna dict o None si no se puede parsear.
    """
    try:
        # --- URL e ID ---
        href = ""
        for lnk in card.css("a"):
            h = lnk.attrib.get("href", "")
            if "mercadolibre.com.ve" in h or "MLV" in h.upper():
                href = h
                break
        if not href:
            links = card.css("a")
            href = links[0].attrib.get("href", "") if links else ""

        id_match = re.search(r'MLV\d+', href, re.IGNORECASE)
        item_id = id_match.group(0).upper() if id_match else None

        # --- Texto completo ---
        all_text = card.get_all_text()
        lines = [l.strip() for l in all_text.split("\n") if l.strip()]

        # --- Thumbnail ---
        html = _decode(card.html_content)
        img_match = re.search(r'src="(https://http2\.mlstatic\.com/[^"]+)"', html)
        thumbnail = img_match.group(1) if img_match else None

        # --- Título: primera línea que no sea label ni "ÚLTIMAS N" ---
        title = ""
        for line in lines:
            clean = line.lower().strip("¡! ")
            # Saltar "ÚLTIMAS 4", "ÚLTIMA!", etc.
            if re.match(r'^últim[ao]s?\s*\d*$', clean):
                continue
            if clean in SKIP_LABELS:
                continue
            title = line
            break

        if not title:
            return None

        # --- Precio: buscar "US$" o "Bs." seguido de números ---
        price_usd = None
        price_ves = None
        for j, ln in enumerate(lines):
            if ln in ("US$", "$"):
                # Siguientes tokens: "30", ",", "99"
                parts = []
                for pln in lines[j + 1: j + 6]:
                    if re.match(r'^[\d.,]+$', pln):
                        parts.append(pln)
                    elif pln in (',', '.'):
                        parts.append('.')
                    else:
                        break
                raw = "".join(parts).replace(",", ".")
                try:
                    price_usd = round(float(raw), 2)
                except Exception:
                    pass
                break
            elif ln in ("Bs.", "Bs"):
                parts = []
                for pln in lines[j + 1: j + 6]:
                    if re.match(r'^[\d.,]+$', pln):
                        parts.append(pln)
                    elif pln in (',', '.'):
                        parts.append('.')
                    else:
                        break
                raw = "".join(parts).replace(",", ".")
                try:
                    price_ves = round(float(raw), 2)
                except Exception:
                    pass

        # --- Vendedor: buscar "Texto NNN ventas" o primer texto post-título ---
        seller = ""
        sold_qty = 0
        remaining = [l for l in lines if l != title and l not in ("US$", "Bs.", "$")]
        for ln in remaining[:4]:
            # Patrón: "Vendedor 298" (nombre + número ventas)
            m = re.match(r'^(.+?)\s+(\d{1,5})\s*$', ln)
            if m and not re.match(r'^\d+(\.\d+)?$', m.group(1)):
                seller = m.group(1).strip()
                sold_qty = int(m.group(2))
                break
            # O simplemente texto sin número = nombre del vendedor
            if not re.match(r'^[\d.,]+$', ln) and ln not in SKIP_LABELS:
                if not seller:
                    seller = ln

        # --- Envío gratis ---
        free_shipping = "gratis" in all_text.lower()

        # --- Rating ---
        rating = None
        for ln in lines:
            if re.match(r'^[45]\.\d$', ln):
                try:
                    rating = float(ln)
                except Exception:
                    pass
                break

        return {
            "position": position,
            "id": item_id,
            "title": title,
            "price_usd": price_usd,
            "price_ves": price_ves,
            "seller": seller,
            "sold_quantity": sold_qty,
            "free_shipping": free_shipping,
            "rating": rating,
            "thumbnail": thumbnail,
            "url": href,
        }

    except Exception:
        return None


def get_serp(
    query: str,
    max_results: int = 48,
    my_item_ids: list[str] | None = None,
) -> dict:
    """
    Ejecuta StealthyFetcher y extrae el SERP completo de MLV.

    Args:
        query: Término de búsqueda (ej. "amortiguador delantero aveo")
        max_results: Máximo de resultados a retornar
        my_item_ids: Lista de IDs propios para calcular posición

    Returns:
        {
          "query": str,
          "total_found": int,
          "results": [...],
          "my_positions": { "MLV123": 5, ... },
          "elapsed_seconds": float,
        }
    """
    import time
    slug = query.strip().replace(" ", "-")
    url = f"https://listado.mercadolibre.com.ve/{slug}"

    t0 = time.time()
    page = StealthyFetcher.fetch(
        url,
        headless=True,
        network_idle=True,
        timeout=60000,
        wait_selector="li.ui-search-layout__item",
    )
    elapsed = round(time.time() - t0, 2)

    cards = page.css("li.ui-search-layout__item")
    results = []
    for i, card in enumerate(cards[:max_results]):
        parsed = _parse_card(card, i + 1)
        if parsed:
            results.append(parsed)

    # Calcular posiciones propias
    my_positions = {}
    if my_item_ids:
        id_set = {mid.upper() for mid in my_item_ids}
        for r in results:
            if r["id"] and r["id"].upper() in id_set:
                my_positions[r["id"].upper()] = r["position"]

    return {
        "query": query,
        "url": url,
        "total_found": len(results),
        "results": results,
        "my_positions": my_positions,
        "elapsed_seconds": elapsed,
    }
