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

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
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
