"""
================================================================
scrapling-service/main.py
Microservicio FastAPI — Scrapling Intelligence Layer
Puerto: 8765 (desarrollo local)

Endpoints:
  POST /serp        → Posición en SERP de MLV por keyword
  GET  /health      → Healthcheck para el conector Node.js
================================================================
"""
import sys
import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Configurar logging (Consola y Archivo)
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.FileHandler("scrapling.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger("scrapling-service")


# ── Modelos de datos ──────────────────────────────────────────

class SerpRequest(BaseModel):
    query: str = Field(..., description="Término de búsqueda", min_length=2, max_length=200)
    max_results: int = Field(default=48, ge=1, le=100)
    my_item_ids: list[str] = Field(default=[], description="IDs propios para calcular posición")


class SerpResponse(BaseModel):
    query: str
    url: str
    total_found: int
    results: list[dict]
    my_positions: dict[str, int]
    elapsed_seconds: float

class ItemRequest(BaseModel):
    item_id: str = Field(..., description="ID de la publicación, ej: MLV751567972")

class ItemResponse(BaseModel):
    item_id: str
    seller_id: int | None
    url: str
    status: str

class SellerItemRequest(BaseModel):
    item_url: str = Field(..., description="URL completa del artículo con slug, ej: https://articulo.mercadolibre.com.ve/MLV-824681578-amortiguador-trasero...")


# ── App FastAPI ───────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("🕷️  Scrapling Service iniciando en puerto 8765")
    log.info("📋 Endpoints disponibles:")
    log.info("   POST /serp    → SERP Position Tracker MLV")
    log.info("   GET  /health  → Healthcheck")
    yield
    log.info("Scrapling Service detenido.")


app = FastAPI(
    title="Scrapling Intelligence Service",
    description="Microservicio de scraping inteligente para MercadoLibre ERP Venezuela",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — permitir peticiones desde Next.js (localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://mercadolibre-erp.vercel.app"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ── Endpoints ─────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Healthcheck — el conector Node.js lo usa para verificar si el servicio está activo."""
    return {
        "status": "ok",
        "service": "scrapling-intelligence",
        "version": "1.0.0",
        "timestamp": time.time(),
    }


@app.post("/serp", response_model=SerpResponse)
def serp_position(req: SerpRequest):
    """
    Extrae el SERP de MercadoLibre Venezuela para un query dado.
    Usa StealthyFetcher (Camoufox) para bypassear Anubis PoW.

    Body:
      {
        "query": "amortiguador delantero aveo",
        "max_results": 48,
        "my_item_ids": ["MLV824681578"]
      }

    Returns:
      Lista de productos en SERP + posición de tus items propios.
    """
    log.info(f"📊 SERP request: query='{req.query}' max={req.max_results} own_ids={req.my_item_ids}")

    try:
        from scrapers.serp import get_serp
        result = get_serp(
            query=req.query,
            max_results=req.max_results,
            my_item_ids=req.my_item_ids or [],
        )
        log.info(f"✅ SERP '{req.query}': {result['total_found']} resultados en {result['elapsed_seconds']}s")
        return result

    except Exception as e:
        log.error(f"❌ Error en SERP '{req.query}': {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/item", response_model=ItemResponse)
def item_seller(req: ItemRequest):
    """
    Extrae el Seller ID de la página de un producto directo.
    Usa StealthyFetcher (Camoufox) para bypassear Anubis PoW.
    """
    log.info(f"📦 Item request: id='{req.item_id}'")
    try:
        from scrapers.item import get_item_seller
        result = get_item_seller(item_id=req.item_id)
        log.info(f"✅ Item '{req.item_id}': status={result['status']} seller={result.get('seller_id')}")
        return result
    except Exception as e:
        log.error(f"❌ Error en Item '{req.item_id}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/seller-item")
def seller_by_item_url(req: SellerItemRequest):
    """
    Encuentra el Seller (nickname + seller_id) de un artículo dando su URL completa.
    Usa el slug del título de la URL para buscar en el SERP.
    
    Body: { "item_url": "https://articulo.mercadolibre.com.ve/MLV-824681578-amortiguador-..." }
    Returns: { "seller_id": null, "nickname": "AUTOPARTESKRP", "item_id": "MLV824681578", "status": "found_via_serp" }
    """
    log.info(f"🔍 seller-item request: '{req.item_url[:80]}...'")
    try:
        from scrapers.seller_from_serp import get_seller_from_item_url
        result = get_seller_from_item_url(item_url=req.item_url)
        log.info(f"✅ seller-item: {result}")
        return result
    except Exception as e:
        log.error(f"❌ Error en seller-item: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ResolveNicknameRequest(BaseModel):
    nickname: str = Field(..., description="Nickname del vendedor en ML, ej: AUTOPARTESKRP")


@app.post("/resolve-nickname")
def resolve_nickname(req: ResolveNicknameRequest):
    """
    Dado un nickname de vendedor, obtiene su seller_id numérico.
    Abre la página de perfil/tienda del vendedor en listado.mercadolibre.com.ve
    y extrae el _CustId_ del HTML.
    
    Body: { "nickname": "AUTOPARTESKRP" }
    Returns: { "seller_id": 189282699, "nickname": "AUTOPARTESKRP", "status": "found" }
    """
    log.info(f"🔍 resolve-nickname request: '{req.nickname}'")
    try:
        from scrapers.resolve_nickname import resolve_nickname_to_seller_id
        result = resolve_nickname_to_seller_id(nickname=req.nickname)
        log.info(f"{'✅' if result['status'] == 'found' else '⚠️'} resolve-nickname: {result}")
        return result
    except Exception as e:
        log.error(f"❌ Error en resolve-nickname: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Entry point ───────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8765,
        reload=False,
        log_level="info",
    )
