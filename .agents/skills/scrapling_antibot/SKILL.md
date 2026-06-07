---
name: scrapling_antibot_bypass
description: >-
  Documentación técnica y estrategia de Web Scraping indetectable para MercadoLibre Venezuela (MLV).
  Utiliza el microservicio en Python (scrapling-service) basado en Scrapling + Camoufox para sortear el Proof of Work (PoW) de Anubis y extraer SERPs y perfiles.
---

# 🕵️ Scrapling Anti-Bot Bypass (MLV)

MercadoLibre emplea un sistema anti-bot de alta seguridad llamado **Anubis** que evalúa huellas de navegador y exige resolución de desafíos (Proof of Work) antes de entregar HTML orgánico. Esta *skill* documenta la estrategia adoptada para bypassearlo de forma escalable en el ERP.

## 🧱 Arquitectura de Extracción (scrapling-service)

Dado que Playwright estándar y Puppeteer son bloqueados por Anubis (Status 403 / Captchas), se construyó un **microservicio local en Python** ejecutándose en el puerto `8765`.

### Stack Tecnológico:
1. **[Scrapling](https://github.com/D4Vinci/Scrapling):** Un wrapper avanzado que simplifica la extracción de DOM.
2. **[Camoufox](https://github.com/D4Vinci/Camoufox):** Un navegador Firefox modeado anti-detect con huellas aleatorias y evasión de TLS-fingerprinting.
3. **FastAPI:** Framework backend para interconectar con nuestro frontend en Next.js.

---

## 🛠️ Reglas de Implementación (Lecciones Aprendidas)

### 1. El Conflicto del Event Loop (FastAPI vs Scrapling)
**Error Común:** `It looks like you are using Playwright Sync API inside the asyncio loop.`
FastAPI se ejecuta sobre `asyncio`. Scrapling (a través de su `StealthyFetcher`) utiliza la API síncrona de Playwright de forma subyacente. Si defines un endpoint de FastAPI como `async def`, chocarán los hilos bloqueantes.

**✅ La Solución:** 
Los endpoints en FastAPI que llamen a `StealthyFetcher` **DEBEN** definirse como métodos síncronos (`def` normal, sin `async`). Esto obliga a FastAPI a aislar la ejecución en un thread-pool externo, permitiendo que el scraping bloqueante opere sin romper el loop de NodeJS/Python.

```python
# INCORRECTO ❌
@app.post("/serp")
async def get_serp(req: Request):
    fetcher = StealthyFetcher() # Crash!

# CORRECTO ✅
@app.post("/serp")
def get_serp(req: Request):
    fetcher = StealthyFetcher() # Funciona perfecto en thread aislado
    page = fetcher.get(req.url)
```

### 2. Bypass de Anubis PoW (Proof of Work)
El bloqueador de Anubis suele cargar un script ofuscado que resuelve un hash criptográfico.
Al utilizar Camoufox, el entorno JS (navigator, webgl, canvas) parece tan real que el challenge de Anubis se resuelve y redirecciona silenciosamente.
**Es vital permitir la ejecución de JavaScript en el fetcher y no usar peticiones puras `HTTP` (requests/httpx) para URLs protegidas como las búsquedas `/jm/search`.**

### 3. Extracción de Data vía JSON Embebido
La forma más estable de raspar MercadoLibre no es buscar clases de CSS (que cambian constantemente o usan hashes como `.ui-search-result__title--poly`), sino extraer el estado inicial de React o Next.js embebido en el código fuente:

```python
script_tag = page.css('script:contains("__PRELOADED_STATE__")')
# Extraer el JSON y parsear el array de "results"
```
Esto garantiza resistencia ante cambios de diseño (UI) en MLV.

---

## 🚀 Uso en Producción (Workflow)

El ERP se comunica con el scraper enviando un `POST` a `http://localhost:8765/serp`.
El microservicio levanta un navegador "fantasma", evade Anubis, descarga el HTML, parsea el JSON del SERP y lo devuelve limpio a nuestra aplicación Next.js, donde se empareja con Groq (Llama 3.3) para extraer insights e inteligencia competitiva.
