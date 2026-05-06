-1# 🛠️ PROYECTO: LIBRERÍA DE HABILIDADES (SKILLS) - MERCADOLIBRE ERP

Este documento recopila las "Habilidades Especiales" desarrolladas en este proyecto. Son patrones de código probados en batalla (battle-tested) que pueden ser reutilizados en otros proyectos de Mercado Libre o Gestión de Inventarios.

---

## 1. Habilidad: Sincronización Masiva (Multi-Status Scan)
**Descripción:** Supera el límite de 1000 items de Mercado Libre y el bug de ocultación de items cerrados.
*   **Lógica:** Realiza 3 barridos secuenciales por estado (`active`, `paused`, `closed`) usando la API de Scroll (`search_type=scan` + `scroll_id`).
*   **Ubicación:** `src/lib/meli.js` -> `getAllItemIds()`
*   **Valor:** Garantiza que el inventario sea 100% fiel a la realidad, sin "publicaciones fantasma".
*   **Doc oficial ML:** Scroll API para catálogos masivos > 1000 ítems.

## 2. Habilidad: Auditoría de Inventario de Ultra-Velocidad
**Descripción:** Cruce de mallas de datos masivas (Excel 41k vs DB 20k) en < 3 segundos.
*   **Lógica:** Carga el inventario de Meli en un `Set` y el de Excel en un array de objetos, usando comparadores normalizados (Mayúsculas/Sin espacios).
*   **Ubicación:** `src/app/api/inventory/upload/route.js`
*   **Valor:** Permite auditar almacenes gigantescos sin depender de la lentitud de APIs externas durante el cruce.

## 3. Habilidad: Persistencia por Snapshots (Caché Local)
**Descripción:** Mantiene vivo el trabajo del usuario incluso si refresca o navega fuera del panel.
*   **Lógica:** Guarda el resultado pesado de una computación en un archivo JSON local en el servidor (`.audit_cache_${accountId}.json`) atado a la cuenta.
*   **Ubicación:** `src/app/api/inventory/last/route.js`
*   **Valor:** Mejora drásticamente la Experiencia de Usuario y reduce costos de base de datos.

## 4. Habilidad: Inyector de Formatos Externos (Integraly XLS)
**Descripción:** Transforma datos internos en formatos propietarios de terceros.
*   **Lógica:** Uso de la librería `XLSX` (SheetJS) en el cliente para recrear encabezados y anchos de columna específicos.
*   **Ubicación:** `src/app/dashboard/inventory/page.js` -> `handleDownloadIntegraly()`
*   **Valor:** Interoperabilidad total. Permite usar el ERP para corregir datos en otras plataformas masivas.

## 5. Habilidad: OAuth2 Robusto & Auto-Refresh
**Descripción:** Mantiene la sesión de múltiples cuentas viva por meses sin intervención humana.
*   **Lógica:** Middleware que intercepta cada llamada a la API de Meli, verifica la caducidad del token en DB, pide un nuevo `access_token` si es necesario y lo actualiza en caliente.
*   **Ubicación:** `src/lib/meli-auth-helper.js`
*   **Valor:** Estabilidad total del sistema en producción.
*   **Doc oficial ML:** El refresh_token es de uso único y expira en 6 meses. Solo se permite el último refresh_token generado.

## 6. Habilidad: Almacenamiento "Data Lake" (Raw JSON)
**Descripción:** Respaldo total de la información para minería de datos futura.
*   **Lógica:** Captura el objeto íntegro de la API y lo deposita en una columna `JSONB` de Supabase (`raw_data`).
*   **Ubicación:** `src/app/api/account/publications/sync/batch/route.js`
*   **Valor:** Blindaje contra cambios en la API de Mercado Libre y base para futuras analíticas de IA.

## 7. Habilidad: Detector de Faltantes (Gap Analysis)
**Descripción:** Identifica huecos de venta comparando lo que tienes físicamente contra lo que el mundo ve en ML.
*   **Valor:** Genera listas de tareas para el equipo de ventas y evita perder oportunidades de mercado.

## 8. Habilidad: Ciclo de Vida Proactivo (Inbound Sync)
**Descripción:** Procesa "Notas de Recepción" de mercancía directamente para alertar sobre productos nuevos que necesitan ser publicados masivamente.
*   **Lógica:** Adaptabilidad de cabeceras (`CODIGO A`, `ML`) para leer extractos parciales del almacén e identificar ID sugeridos.
*   **Valor:** Reduce el "Time-to-Market". Tan pronto registra la entrada el camión, el sistema dispara la sugerencia de publicación.

---

## 9. Habilidad: Notificaciones Push en Tiempo Real (Webhooks)
**Descripción:** Recibe eventos de MercadoLibre instantáneamente sin hacer polling constante.
*   **Lógica:** Vercel recibe POST de ML en `/api/webhooks/ml`, valida origen (IP whitelist), responde HTTP 200 en < 200ms y guarda la notificación en Supabase (`ml_notifications`). El ERP local procesa las notificaciones pendientes desde Supabase.
*   **Ubicación:** `src/app/api/webhooks/ml/route.js`
*   **Valor:** Reduce drásticamente las llamadas a la API, mejora reactividad (ventas, preguntas, cambios de stock) y evita perder eventos.
*   **Topics ML recomendados:** `items`, `orders_v2`, `questions`, `shipments`, `payments`.
*   **Doc oficial ML:** Las notificaciones requieren respuesta HTTP 200 en 500ms. Si fallan, ML reintenta por 1 hora y luego desactiva el topic.

## 10. Habilidad: Vercel Cron Job para Auto-Refresh de Tokens
**Descripción:** Mantiene tokens vigentes usando la infraestructura serverless de Vercel en lugar de Task Scheduler local.
*   **Lógica:** Un Cron Job de Vercel ejecuta cada 24 horas (`0 0 * * *`) un endpoint que revisa todas las cuentas en `meli_accounts`, identifica tokens próximos a expirar (< 30 min) y los refresca vía OAuth2. En plan Pro puede configurarse cada 2 horas (`0 */2 * * *`).
*   **Ubicación:** `src/app/api/cron/refresh-token/route.js` + `vercel.json`
*   **Valor:** Descentraliza la infraestructura crítica. Si el PC local se apaga, los tokens siguen vivos.
*   **Doc oficial ML:** El access_token dura 6 horas. El refresh_token es de un solo uso y se invalida si no se usa la app en 4 meses.
*   **Nota:** Plan Hobby limita cron jobs a 1 por día. Plan Pro permite múltiples por día.

## 11. Habilidad: Mapeo de Categorías Internas → MercadoLibre
**Descripción:** Estandariza las SubLíneas del ERP (ej: `11-001 AMORTIGUADOR NORMAL`) con las categorías oficiales de MLV para evitar errores de categorización al publicar.
*   **Lógica:** Tabla `category_mappings` en Supabase que vincula `internal_subline_code` → `ml_category_id`. Si no existe mapeo, usa `/sites/MLV/domain_discovery/search` para sugerir la categoría ML correcta. Antes de publicar, valida `/categories/{id}/attributes` para obtener los campos obligatorios.
*   **Ubicación:** `src/lib/meli-categories.js` + `src/app/api/categories/suggest/route.js`
*   **Valor:** Elimina publicaciones fallidas por categoría inválida. Permite publicación masiva confiable desde el inventario interno.
*   **Doc oficial ML:** MercadoLibre recomienda validar categorías antes de publicar masivamente. Las categorías solo pueden ser hojas (leaf) del árbol.

## 12. Habilidad: Resiliencia ante Rate Limits (Retry + Backoff)
**Descripción:** Sobrevive a los límites de la API de MercadoLibre (HTTP 429) sin romper sincronizaciones masivas.
*   **Lógica:** Wrapper alrededor de `meliGet` que detecta `local_rate_limited (429)`, espera con backoff exponencial (1s → 2s → 4s → 8s, max 30s) y reintenta hasta 3 veces.
*   **Ubicación:** `src/lib/meli.js` (mejora de `meliGet`)
*   **Valor:** Sincronizaciones de 18k+ items no se interrumpen por picos de tráfico en la API de ML.
*   **Doc oficial ML:** `local_rate_limited (429)` indica llamadas excesivas. Se debe reintentar después de unos segundos.

---

## 13. Habilidad: Recuperación ante Token Inválido (Invalid Grant Handler)
**Descripción:** Maneja el escenario donde el refresh_token muere (cambio de clave, revocación, inactividad de 4 meses) sin dejar la cuenta huérfana.
*   **Lógica:** Cuando `refreshAccessToken` devuelve `invalid_grant`, la cuenta se marca en DB con `needs_reauth = true` y el dashboard alerta al usuario para volver a vincular la cuenta.
*   **Ubicación:** `src/lib/meli-auth-helper.js`
*   **Valor:** Evita errores silenciosos. El usuario siempre sabe qué cuenta necesita atención.
*   **Doc oficial ML:** `invalid_grant` puede ocurrir por expiración (6 meses), revocación de autorización, cambio de contraseña o actualización de Client Secret.

---

## 14. Habilidad: MCP Server Connector para Cline/Antigravity
**Descripción:** Mantiene el servidor MCP de MercadoLibre conectado a Cline/Antigravity mediante token auto-refrescable y scripts de utilidad.
*   **Lógica:**
    1. **Token Refresher Node (`mcp-token-refresh/refresh-token.js`)**: Lee el `refresh_token` de Supabase, solicita un nuevo `access_token` a la API de MercadoLibre, actualiza la base de datos y reemplaza el token en el archivo `cline_mcp_settings.json` de Cline.
    2. **Script manual `.bat` (`actualizar-token-mcp.bat`)**: Wrapper de doble clic para ejecutar el refresher sin abrir terminal manualmente.
    3. **Vercel Cron Job (`src/app/api/cron/refresh-token/route.js`)**: Refresca tokens automáticamente en la nube cada 24h (o cada 2h en plan Pro).
    4. **Task Scheduler de Windows (`setup-task-scheduler.bat`)**: Instala una tarea programada que corre el refresher cada 5 horas localmente.
*   **Ubicación:** `mcp-token-refresh/` + `cline_mcp_settings.json`
*   **Valor:** Garantiza que el asistente de IA (Cline/Antigravity) siempre tenga acceso vivo a la documentación y herramientas oficiales de MercadoLibre sin intervención manual.
*   **Doc oficial ML:** El `access_token` expira cada 6 horas. El `refresh_token` es de un solo uso. El MCP server de MercadoLibre expone herramientas como `search_documentation` y `get_documentation_page`.
*   **Nota de resiliencia:** Si el puerto local del proxy SSE (`mcp-remote`) queda ocupado por una instancia zombie, reiniciar Cline/Antigravity libera el puerto y recarga la configuración.

## 15. Habilidad: Webhooks Processor con Auto-Sync (Ingesta en Tiempo Real)
**Descripción:** Recibe notificaciones push de MercadoLibre y actualiza automáticamente la base de datos sin intervención manual, eliminando la necesidad de sincronizaciones masivas completas.
*   **Lógica:**
    1. **Receptor (`src/app/api/webhooks/ml/route.js`)**: Recibe POST de MercadoLibre, responde HTTP 200 en < 200ms (obligatorio), guarda la notificación en `ml_notifications` y la procesa asíncronamente según el topic:
       - `items` → Upsert en tabla `products` (precio, stock, estado, atributos)
       - `orders_v2` → Upsert en tabla `orders` + `order_items` (nueva venta, cambio de estado)
       - `questions` → Upsert en tabla `questions` (pregunta nueva o respondida)
       - `shipments` → Actualiza estado de envío en `orders`
       - `payments` → Actualiza estado de pago en `orders`
    2. **Configuración Manual**: MercadoLibre NO permite suscribir webhooks por API. Se configura desde `applications.mercadolibre.com` especificando la Callback URL y los topics.
    3. **Procesamiento asíncrono**: El procesamiento ocurre después de responder HTTP 200, evitando que ML desactive el topic por timeout.
*   **Ubicación:** `src/app/api/webhooks/ml/route.js`
*   **Valor:** Automatización real de inventario, ventas y atención al cliente sin polling masivo. Solo se actualizan los registros que cambiaron.
*   **Doc oficial ML:** La URL de callback debe responder HTTP 200 en 500ms. Si falla, ML reintenta 1 hora y desactiva el topic. Las IPs oficiales de ML son: 54.88.218.97, 18.215.140.160, 18.213.114.129, 18.206.34.84.
*   **Nota:** Para reactivar un topic desactivado, hay que re-configurarlo en applications.mercadolibre.com. No se pierden notificaciones antiguas (hasta 2 días) vía endpoint `GET /missed_feeds`.

---

## 16. Habilidad: Frontend Auto-Refresh de Token (Sin Errores de Expiración)
**Descripción:** Los endpoints del frontend nunca muestran "Token expirado" porque refrescan automáticamente el token antes de llamar a la API de MercadoLibre.
*   **Lógica:** Todas las API routes (`/api/orders`, `/api/account/overview`, etc.) usan `getValidAccessToken()` de `meli-auth-helper.js` que verifica la caducidad con margen de 5 minutos y refresca vía OAuth2 si es necesario.
*   **Ubicación:** `src/lib/meli-auth-helper.js` + todos los endpoints que llaman a ML
*   **Valor:** Elimina por completo la necesidad de reconectar cuentas manualmente. El usuario nunca ve errores de token vencido.

## 17. Habilidad: Batch Token Refresher para Múltiples Cuentas
**Descripción:** Script de Node.js que refresca los tokens de **todas** las cuentas vinculadas simultáneamente, no solo una.
*   **Lógica:** El script `mcp-token-refresh/refresh-token.js` itera sobre la tabla `meli_accounts`, refresca cada cuenta con su propio `refresh_token`, actualiza la DB y genera un resumen de éxito/fallo por cuenta.
*   **Ubicación:** `mcp-token-refresh/refresh-token.js`
*   **Valor:** Gestión centralizada de múltiples sellers. Una sola ejecución mantiene vivas todas las cuentas.
*   **Nota:** Configurable para una sola cuenta vía variable `ACCOUNT_NICKNAME`.

## 18. Habilidad: Task Scheduler Silencioso (No-Interaction .bat)
**Descripción:** Script `.bat` diseñado específicamente para ejecutarse desatendido desde Windows Task Scheduler sin ventanas ni prompts.
*   **Lógica:** `run-refresh-token.bat` usa `@echo off`, redirige stdout/stderr a un archivo de log (`refresh-token.log`) y termina con `exit /b` sin ninguna interacción.
*   **Ubicación:** `mcp-token-refresh/run-refresh-token.bat`
*   **Valor:** Automatización completa. El PC puede estar bloqueado o el usuario ausente y los tokens siguen refrescándose en segundo plano.

---

## 19. Habilidad: Generador de Excel para Publicación Masiva ML (Multi-Sheet)
**Descripción:** Crea archivos Excel compatibles con la plataforma de carga masiva de MercadoLibre, con una pestaña por categoría y atributos técnicos dinámicos.
*   **Lógica:** Consulta atributos obligatorios vía `/categories/{id}/attributes`, construye pestañas por categoría y optimiza títulos SEO.
*   **Valor:** Permite publicaciones masivas en cuentas con restricciones de API (Tiendas Oficiales).

## 20. Habilidad: Dashboard "Banco de Imágenes" (Next.js)
**Descripción:** Panel de monitoreo visual en tiempo real para estadísticas de inventario, imágenes sincronizadas y auditoría de URLs del CDN de Mercado Libre.
*   **Valor:** Centraliza la gestión visual del inventario sin depender de archivos locales.

## 21. Habilidad: Sincronización Inteligente (Smart Skip)
**Descripción:** Lógica de optimización que detecta IDs de imagen preexistentes para evitar subidas redundantes.
*   **Valor:** Ahorro crítico de ancho de banda y tiempo en procesamientos de 10k+ ítems.

## 22. Habilidad: Mapeo Híbrido GOLDEN (IA + Experiencia Histórica)
**Descripción:** Motor de categorización de ultra-precisión que prioriza el historial de publicaciones exitosas sobre las predicciones genéricas de la API.
*   **Lógica:** 
    1. Extrae conocimiento de +18,000 publicaciones reales (`rwc_knowledge_final.json`).
    2. Cruza con el catálogo maestro para definir la categoría "ganadora" por sublínea.
    3. Aplica IA con penalizaciones por rama no-automotriz como respaldo.
*   **Valor:** Elimina errores de categorización (ej: Amortiguadores en Deportes) y garantiza que cada producto use la categoría que ya ha demostrado generar ventas.


## 23. Habilidad: Inyección Inteligente de Atributos Técnicos
**Descripción:** Capacidad para identificar atributos obligatorios de Mercado Libre que requieren unidades específicas (Volumen, Peso) y autocompletarlos con valores válidos ("1 L", "1 kg") para evitar rechazos en categorías de fluidos y autopartes pesadas.

## 24. Habilidad: Exportación Masiva con Integración de Banco de Imágenes
**Descripción:** Dominio en la generación de archivos Excel (XLSX) compatibles con la herramienta de Publicación Masiva de ML, inyectando dinámicamente URLs externas del Image Bank y columnas de organización interna (Sublíneas) para auditoría humana pre-carga.

## 25. Habilidad: Subida de Inventario por Lotes (Chunked Upload)
**Descripción:** Procesa archivos Excel gigantes (>7MB / 27k+ filas) superando los límites de payload de Vercel (4.5MB).
*   **Lógica:** El frontend (Navegador) lee el Excel localmente usando `FileReader` y envía la data en paquetes controlados de 2,000 registros a un endpoint ligero.
*   **Valor:** Escalabilidad infinita. Permite cargar inventarios de cualquier tamaño sin errores de red o timeouts.

## 26. Habilidad: Motor de Auditoría de Alto Rendimiento
**Descripción:** Cruza mallas de datos masivas (27k locales vs 18k ML) sin saturar la memoria del servidor.
*   **Lógica:** Uso de `Set` para búsquedas O(1) y fetching paginado de Supabase para evitar "heap out of memory". Implementa caché local por cuenta para persistencia de resultados.
*   **Valor:** Entrega resultados de auditoría global en segundos, permitiendo al usuario tomar decisiones rápidas sobre miles de publicaciones.

## 27. Habilidad: Interoperabilidad de Mapeos vía Excel
**Descripción:** Permite la gestión masiva de la lógica de categorización fuera del ERP para sincronización con SQL externo (Profit Plus).
*   **Lógica:** Exportación/Importación dinámica con resolución de conflictos de nombres de pestañas y mapeo inteligente de columnas (`Sublínea Profit` ↔ `ML Category ID`).
*   **Valor:** Puente de datos crítico. Permite que el conocimiento generado en el ERP (mapeos) se inyecte de vuelta en el core del negocio (Profit Plus).

## 28. Habilidad: Exportación Masiva con Vista Plana y Auditoría
**Descripción:** Genera una hoja maestra consolidada en el Excel masivo que incluye IDs de categoría y Breadcrumbs completos.
*   **Lógica:** Inyección de una pestaña "Resumen_General" previa a las pestañas por categoría. Mapeo de `ml_category_id` y `ml_category_name` desde la tabla de `category_mappings`.
*   **Valor:** Permite auditoría humana ultrarrápida de miles de productos y sus destinos de categoría en un solo vistazo.

## 29. Habilidad: Ingeniería Inversa de Competencia (Listing Sniper V3)
**Descripción:** Motor de inteligencia competitiva con análisis contextual (Fitment vs Price) para MercadoLibre Venezuela. Identifica brechas entre publicaciones propias y líderes de ventas con precisión quirúrgica.
*   **Lógica:** 
    - Búsqueda pública `/sites/MLV/search` + ordenamiento por `sold_quantity` en memoria (no existe `sort=sold_quantity_desc`).
    - Multiget `/items?ids=` para enriquecer fotos y atributos completos.
    - API de Performance `/item/{id}/performance` (post-feb 2025) con fallback a `/items/{id}/health`.
    - Scraping de descripción para detectar zonas de pickup (Chacao, Sabana Grande, Valencia) y métodos de envío tradicionales (Zoom, Tealca, MRW).
    - Algoritmo de scoring con dos modos automáticos: **Fitment** (BRAND/MODEL/PART_NUMBER al 35%) y **Price** (Precio al 30%).
    - Penalizaciones MLV: MAYÚSCULAS (-40 pts), palabras spam (-20 pts).
*   **Valor:** Transforma datos de competidores en un Plan de Acción enriquecido con `current_value`, `target_value` e `impact_estimate` para capturar el ranking de búsqueda.
*   **Ubicación:** `src/lib/sniper-scoring.js`, `src/lib/sniper-helpers.js`, `src/app/api/tools/sniper/`.

## 30. Habilidad: Dashboard de Inteligencia de Mercado (Dark Mode Premium)
**Descripción:** Panel visual de alta gama para analizar competidores en tiempo real con gráficos circulares, comparativas cara a cara y alertas contextuales.
*   **Lógica:** 
    - Componentes modulares en `src/components/intelligence/` (ScoreChart SVG, WinnerCard, ActionPlan, CompetitorGrid, SpamAlert, LogisticsCard, AnalysisModeBadge).
    - Página principal en `/dashboard/intelligence` integrada con el Sidebar del ERP.
    - Dark Mode premium con paleta `slate-950` + acentos `cyan-500` / `emerald-500` / `rose-500`.
    - Gráficos radiales SVG sin librerías externas.
*   **Valor:** Experiencia de usuario premium que permite tomar decisiones de optimización en segundos, visualizando scores por dimensión y un plan de acción priorizado.
*   **Ubicación:** `src/app/dashboard/intelligence/page.js`, `src/components/intelligence/`.

## 31. Habilidad: Snapshots de Mercado con Batch Tracking
**Descripción:** Persistencia temporal de análisis competitivos agrupados por `snapshot_batch_id` para análisis histórico y tracking de posiciones.
*   **Lógica:** 
    - Tablas `mlv_market_snapshots`, `mlv_competitive_analysis`, `mlv_position_history`, `competitor_image_refs`.
    - Cada análisis genera un `batch_id` único que agrupa los 10 competidores analizados.
    - El historial de posiciones permite registrar `position_previous` vs `position_current` para medir el impacto de optimizaciones aplicadas.
*   **Valor:** Capacidad de medir el ROI de las optimizaciones realizadas al comparar posiciones antes y después de aplicar cambios.
*   **Ubicación:** `supabase/migration_sniper_2026-05-06.sql`, `src/app/api/tools/sniper/history/route.js`.

---

*Este inventario de habilidades permite que este ERP sea el cimiento para cualquier otra herramienta de automatización comercial. Las skills 9-31 fueron diseñadas a partir de la documentación oficial del MCP de MercadoLibre Developers y la experiencia real con 40k+ SKUs.*
