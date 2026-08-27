"""
================================================================
scrapling-service/scrapers/seller_from_serp.py

Estrategia: Para obtener el seller_id de un item ID sin URL completa,
buscamos en el SERP de MercadoLibre usando el item_id como query,
y si no aparece, usamos la URL del listado del vendedor directamente.

Flujo:
  1. Abrir listado.mercadolibre.com.ve/{item_id} → redirige al item, no funciona
  2. Abrir con el seller_id directamente desde _CustId_ en SERP — no aplica aquí
  3. En cambio: pedir al SERP la URL directa del artículo como URL especial:
     listado.mercadolibre.com.ve/MLV824681578 → redirige a 404
  
  Mejor estrategia: 
  Abrir la URL de "Ver items de este vendedor" que puede obtenerse del SERP general
  O buscar directamente en la API pública de seller_id via seller search page.

NUEVA TÁCTICA: Abrir https://listado.mercadolibre.com.ve/_CustId_{seller_id}
requiere conocer seller_id de antemano.

TÁCTICA ALTERNATIVA FUNCIONAL:
  Si el usuario nos da un link de artículo completo (con slug),
  extraemos el slug y hacemos SERP.
  El primer resultado que tenga ese item_id, usamos su seller.
================================================================
"""
import re
import time
from scrapling import StealthyFetcher


def get_seller_from_item_url(item_url: str) -> dict:
    """
    Abre la URL del artículo (articulo.mercadolibre.com.ve/MLV-...) usando
    el dominio del listado de MLV para buscar el item en el SERP.
    
    Extrae el slug del título de la URL y lo usa como query del SERP.
    Si el item aparece en los primeros resultados, extrae el seller.
    """
    import logging
    log = logging.getLogger("scrapling-service")
    
    # Extraer item_id y slug del título desde la URL
    item_id = None
    title_slug = None
    
    id_match = re.search(r'MLV-?(\d+)', item_url, re.IGNORECASE)
    if id_match:
        item_id = f"MLV{id_match.group(1)}"
    
    # Extraer slug del título: MLV-824681578-amortiguador-trasero-kia... → "amortiguador trasero kia"
    slug_match = re.search(r'MLV-?\d+-(.+?)(?:-_JM|_JM|$)', item_url, re.IGNORECASE)
    if slug_match:
        title_slug = slug_match.group(1).replace('-', ' ').strip()
    
    if not item_id:
        return {"seller_id": None, "nickname": None, "item_id": None, "status": "no_item_id"}
    
    log.info(f"[SellerFromSERP] item_id={item_id}, slug='{title_slug}'")
    
    # Si tenemos slug, buscar en SERP y encontrar el item
    if title_slug and len(title_slug) > 5:
        try:
            from scrapers.serp import get_serp
            serp = get_serp(query=title_slug, max_results=30, my_item_ids=[item_id])
            
            # Buscar el item exacto en los resultados
            matched = None
            for r in serp.get("results", []):
                if r.get("id", "").upper() == item_id.upper():
                    matched = r
                    break
            
            # Si no encontramos el item exacto, usar el primer resultado
            if not matched and serp.get("results"):
                matched = serp["results"][0]
            
            if matched and matched.get("seller"):
                log.info(f"[SellerFromSERP] ✅ Seller encontrado: {matched['seller']} (item {matched.get('id')})")
                return {
                    "seller_id": None,  # Solo tenemos nickname, no ID numérico
                    "nickname": matched["seller"],
                    "item_id": item_id,
                    "matched_item_id": matched.get("id"),
                    "status": "found_via_serp",
                }
        except Exception as e:
            log.warning(f"[SellerFromSERP] SERP error: {e}")
    
    return {"seller_id": None, "nickname": None, "item_id": item_id, "status": "not_found"}
