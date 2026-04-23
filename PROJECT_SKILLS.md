# 🛠️ PROYECTO: LIBRERÍA DE HABILIDADES (SKILLS) - MERCADOLIBRE ERP

Este documento recopila las "Habilidades Especiales" desarrolladas en este proyecto. Son patrones de código probados en batalla (battle-tested) que pueden ser reutilizados en otros proyectos de Mercado Libre o Gestión de Inventarios.

---

## 1. Habilidad: Sincronización Masiva (Multi-Status Scan)
**Descripción:** Supera el límite de 1000 items de Mercado Libre y el bug de ocultación de items cerrados.
*   **Lógica:** Realiza 3 barridos secuenciales por estado (`active`, `paused`, `closed`) usando la API de Scroll.
*   **Ubicación:** `src/lib/meli.js` -> `getAllItemIds()`
*   **Valor:** Garantiza que el inventario sea 100% fiel a la realidad, sin "publicaciones fantasma".

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
*Este inventario de habilidades permite que este ERP sea el cimiento para cualquier otra herramienta de automatización comercial.*
