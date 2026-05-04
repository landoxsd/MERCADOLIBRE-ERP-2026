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

## 19. Habilidad: Generador de Excel para Publicación Masiva ML (Multi-Sheet por Categoría)
**Descripción:** Crea archivos Excel compatibles 100% con la plataforma de publicación masiva de MercadoLibre Venezuela (https://www.mercadolibre.com.ve/publicar-masivamente/), con una pestaña por categoría ML y headers dinámicos de atributos técnicos.
*   **Lógica:**
    1. Lee el caché de auditoría maestra (`.audit_cache_master_{accountId}.json`).
    2. Consulta `internal_inventory` en Supabase para obtener sublíneas de cada producto faltante.
    3. Busca el mapeo en `category_mappings` (por `internal_name` o `internal_subline_code`).
    4. Para cada categoría ML, consulta `/categories/{id}/attributes` para obtener los atributos obligatorios.
    5. Construye una pestaña (`WorkSheet`) por categoría con columnas base + atributos dinámicos.
    6. Las fotos se insertan como URLs separadas por coma, tomadas de la tabla `image_bank`.
    7. Los títulos se optimizan SEO (máx. 60 caracteres, abreviaciones automáticas: DEL → Delantero, TRAS → Trasero, etc.).
    8. Columnas ML obligatorias manejadas: Tipo de publicación, Cargo por venta, Forma de envío, Costo de envío, Zonas/regiones, Retiro en persona, Tipo de garantía, Tiempo, Unidad, Origen.
*   **Ubicación:** `src/app/api/inventory/export-massive-excel/route.js` + `src/app/dashboard/inventory/page.js`
*   **Valor:** Permite publicar masivamente productos de la cuenta CORPORACIONRWC (que tiene limitaciones de API por tienda oficial) subiendo el Excel directamente a la plataforma oficial de ML.
*   **Doc oficial ML:** https://vendedores.mercadolibre.com.ve/nota/publica-muchos-productos-a-la-vez

---

*Este inventario de habilidades permite que este ERP sea el cimiento para cualquier otra herramienta de automatización comercial. Las skills 9-19 fueron diseñadas a partir de la documentación oficial del MCP de MercadoLibre Developers.*
