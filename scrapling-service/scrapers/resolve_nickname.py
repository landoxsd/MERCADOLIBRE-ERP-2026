"""
================================================================
scrapling-service/scrapers/resolve_nickname.py

Estrategia: Dado un nickname de vendedor, obtiene su seller_id
abriendo la página de su tienda en listado.mercadolibre.com.ve.

Flujo:
  1. Abrir listado.mercadolibre.com.ve/_Store_{NICKNAME}
  2. Buscar _CustId_{seller_id} en el HTML (en links de productos)
  3. Si no hay tienda, buscar el nickname en el SERP y extraer de ahí

Ventaja: listado.mercadolibre.com.ve es el dominio que Camoufox
puede acceder sin problemas (ya validado en SERP).
================================================================
"""
import re
import time
import logging
from scrapling import StealthyFetcher

log = logging.getLogger("scrapling-service")


def resolve_nickname_to_seller_id(nickname: str) -> dict:
    """
    Dado un nickname de vendedor, obtiene su seller_id numérico.
    
    Estrategia 1: Abrir _Store_NICKNAME en listado.mercadolibre.com.ve
    Estrategia 2: Buscar items del vendedor en SERP y extraer _CustId_
    
    Returns:
        { "seller_id": 189282699, "nickname": "AUTOPARTESKRP", "status": "found" }
    """
    t0 = time.time()
    
    # ──────────────────────────────────────────────────────────────
    # Estrategia 1: Página de tienda _Store_{NICKNAME}
    # ──────────────────────────────────────────────────────────────
    store_url = f"https://www.mercadolibre.com.ve/perfil/{nickname}"
    log.info(f"[ResolveNick] Intentando perfil: {store_url}")
    
    try:
        page = StealthyFetcher.fetch(
            store_url,
            headless=True,
            network_idle=True,
            timeout=45000,
        )
        
        html_raw = page.html_content
        html = ""
        if html_raw:
            if hasattr(html_raw, "decode"):
                html = html_raw.decode("utf-8", errors="replace")
            else:
                html = str(html_raw)
        
        log.info(f"[ResolveNick] Perfil HTML size: {len(html)} chars")
        
        # Buscar _CustId_ en cualquier parte del HTML
        cust_match = re.search(r'_CustId_(\d+)', html)
        if cust_match:
            seller_id = int(cust_match.group(1))
            elapsed = round(time.time() - t0, 2)
            log.info(f"[ResolveNick] ✅ seller_id={seller_id} via perfil ({elapsed}s)")
            return {"seller_id": seller_id, "nickname": nickname, "status": "found", "elapsed": elapsed}
        
        # Buscar en links de la tienda del vendedor listado
        seller_id_patterns = [
            r'"seller_id"\s*:\s*(\d{5,12})',
            r'"sellerId"\s*:\s*(\d{5,12})',
            r'seller_id=(\d{5,12})',
        ]
        for pat in seller_id_patterns:
            m = re.search(pat, html, re.IGNORECASE)
            if m:
                seller_id = int(m.group(1))
                elapsed = round(time.time() - t0, 2)
                log.info(f"[ResolveNick] ✅ seller_id={seller_id} via regex perfil ({elapsed}s)")
                return {"seller_id": seller_id, "nickname": nickname, "status": "found", "elapsed": elapsed}
    
    except Exception as e:
        log.warning(f"[ResolveNick] Error en perfil: {e}")
    
    # ──────────────────────────────────────────────────────────────
    # Estrategia 2: Página de listado _Store_{NICKNAME}
    # ──────────────────────────────────────────────────────────────
    store_url2 = f"https://listado.mercadolibre.com.ve/_Store_{nickname}"
    log.info(f"[ResolveNick] Intentando _Store_: {store_url2}")
    
    try:
        page2 = StealthyFetcher.fetch(
            store_url2,
            headless=True,
            network_idle=True,
            timeout=45000,
        )
        
        html_raw2 = page2.html_content
        html2 = ""
        if html_raw2:
            if hasattr(html_raw2, "decode"):
                html2 = html_raw2.decode("utf-8", errors="replace")
            else:
                html2 = str(html_raw2)
        
        log.info(f"[ResolveNick] _Store_ HTML size: {len(html2)} chars")
        
        # Buscar _CustId_ en el HTML de la tienda
        cust_match2 = re.search(r'_CustId_(\d+)', html2)
        if cust_match2:
            seller_id = int(cust_match2.group(1))
            elapsed = round(time.time() - t0, 2)
            log.info(f"[ResolveNick] ✅ seller_id={seller_id} via _Store_ ({elapsed}s)")
            return {"seller_id": seller_id, "nickname": nickname, "status": "found", "elapsed": elapsed}
    
    except Exception as e:
        log.warning(f"[ResolveNick] Error en _Store_: {e}")
    
    elapsed = round(time.time() - t0, 2)
    log.warning(f"[ResolveNick] No encontrado para '{nickname}' ({elapsed}s)")
    return {"seller_id": None, "nickname": nickname, "status": "not_found", "elapsed": elapsed}
