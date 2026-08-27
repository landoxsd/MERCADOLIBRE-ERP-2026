# 🕷️ Base de Conocimiento: Web Scraping & Bypass Anti-Bot (MercadoLibre)

Este documento centraliza todas las estrategias, arquitecturas y librerías utilizadas para eludir los sistemas de seguridad de Mercado Libre (Anubis PoW, TLS Fingerprinting, Captchas) y extraer inteligencia de mercado. Está diseñado como una guía de exportación para replicar el éxito de este proyecto en otros sistemas.

---

## 🏗️ Arquitectura Híbrida de Extracción

El proyecto no depende de una sola herramienta, sino de una arquitectura híbrida de dos niveles que separa responsabilidades según el grado de bloqueo de la página objetivo:

### 1. Nivel Básico / Escalable: Playwright (Node.js)
Integrado nativamente en el backend de Next.js, ideal para extracción masiva en páginas con bajo nivel de seguridad (como los listados genéricos).

*   **Tecnologías:** `playwright-core`, `@sparticuz/chromium-min`
*   **Caso de Uso:** Extracción rápida de *polycards* en `listado.mercadolibre.com.ve/_CustId_...`
*   **Ventaja:** Corre dentro de Serverless Functions (Vercel) usando una versión ultra-ligera de Chromium (< 45MB).
*   **Implementación clave:** En lugar de tomar capturas o ejecutar JS pesado, se espera a `networkidle`, se descarga el HTML plano (`page.content()`) y se parsea offline.

### 2. Nivel Avanzado: Microservicio Python (Scrapling + Camoufox)
Un servicio aislado localmente (o en un VPS) diseñado exclusivamente para evadir la seguridad **Anubis "Aggressive Mode"** mediante suplantación avanzada de huellas digitales.

*   **Tecnologías:** `FastAPI` (Backend), `Scrapling` (DOM Wrapper), `Camoufox` (Navegador Anti-Detect)
*   **Caso de Uso:** Navegar a perfiles (`/perfil/NickName`) y realizar búsquedas de SERP en vivo simulando comportamiento humano.
*   **Ventaja:** Camoufox utiliza perfiles de navegador Firefox modeados, alterando firmas TLS, WebGL, Canvas y resolviendo los retos criptográficos (Proof of Work) silenciosamente.

---

## 🛠️ Reglas de Oro y Estrategias Técnicas

Para portar este conocimiento a otros proyectos, es obligatorio seguir estas directrices:

### A. Aislamiento del Event Loop (Regla Python)
> [!WARNING]
> Si vas a integrar Scrapling (Playwright síncrono) dentro de un framework asíncrono como FastAPI, **NUNCA** declares el endpoint como `async def`.
*   **El Error:** `It looks like you are using Playwright Sync API inside the asyncio loop.`
*   **La Solución:** Define las funciones como `def get_serp()`, forzando a FastAPI a enviar el proceso bloqueante a un thread-pool secundario.

### B. Extracción de Datos: JSON embebido > Clases CSS
Los maquetadores de MLV rotan constantemente las clases CSS usando hashes aleatorios (ej: `.ui-search-result__title--poly-4gh2`).
> [!TIP]
> **No busques en el CSS.** Busca el estado inicial de React embebido en el código fuente:
> ```python
> script_tag = page.css('script:contains("__PRELOADED_STATE__")')
> # Parsea esto a JSON puro. Obtendrás toda la metadata estructurada perfecta.
> ```

### C. Regex HD para Extracción de Imágenes (Evasión de Lazy Loading)
Plataformas que usan carga perezosa bloquean peticiones o devuelven Captchas cuando detectan llamadas como `page.eval()` intentando simular scroll masivo.
> [!IMPORTANT]
> **Estrategia Regex HD:** Descarga el HTML y usa expresiones regulares `\/https?:\/\/[^\s"'<>]+?(?:\.jpg|\.webp)/gi` para raspar los URLs crudos y en alta definición directamente desde los atributos o JSONs embebidos en el DOM.

---

## 🛑 Cómo evadir el "Anubis Aggressive Mode"

Durante el desarrollo de la inteligencia de este proyecto, nos topamos con 3 restricciones masivas y las resolvimos así:

### 1. El Muro 403 de la API para Competidores
*   **Problema:** Una App de MercadoLibre tipo "Vendedor" recibe `403 Forbidden` al usar `GET /items/{id}` en ítems que no le pertenecen.
*   **Workaround:** No usar la API para terceros. Para cada ítem ajeno, raspar obligatoriamente a través de las URLs públicas web.

### 2. Páginas de Producto Intocables
*   **Problema:** La página directa `articulo.mercadolibre.com.ve/MLV-123-item` tiene el filtro anti-bot más agresivo. Incluso Camoufox fracasa y solo recibe el HTML del Captcha.
*   **Workaround del Slug:**
    1. Del link del producto, extrae el "Slug" (ej: `amortiguador-aveo-123`).
    2. Realiza una búsqueda (SERP) en `listado.mercadolibre.com.ve/{slug}` (El SERP tiene baja protección y Camoufox sí pasa).
    3. Ubica el ID del producto dentro de la página de resultados del SERP y extrae su data de ahí.

### 3. Resolución de Seller Nickname a CustId numérico
*   **Problema:** Las APIs necesitan `189282699` (ID Numérico), pero el front-end y los usuarios suelen tener `AUTOPARTESKRP` (Nickname).
*   **Workaround de Perfil:**
    1. Levantar el microservicio de Camoufox.
    2. Navegar a `https://www.mercadolibre.com.ve/perfil/AUTOPARTESKRP`.
    3. (El perfil tiene baja seguridad Anubis). Leer los href del HTML y extraer el `_CustId_{ID}` oculto.
    4. Guardar en caché el mapeo Nickname <-> ID.

---

## 📦 Lista de Instalación (Dependencias Clave)

Para recrear el entorno en un nuevo proyecto, instala:

**Entorno Node.js (Vercel / Next.js):**
```bash
npm install playwright-core @sparticuz/chromium-min
# En tu vercel.json asegurar que la function maxDuration esté al menos en 60s.
```

**Entorno Python (Microservicio Anti-Bot):**
```bash
pip install fastapi uvicorn
pip install scrapling
camoufox fetch  # Instala los binarios del navegador modificado
```
