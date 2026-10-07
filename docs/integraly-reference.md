# Referencia Técnica: Integraly (MELI.EXCEL.ADDIN) v2.2.0.5

> **Fuente Oficial:** [https://integraly.com/Productos/MeliExcelAddinVersiones?l=3](https://integraly.com/Productos/MeliExcelAddinVersiones?l=3)  
> **Fecha de Publicación:** 04/10/2026  
> **Instalador Oficial:** [Integraly MELI.EXCEL.ADDIN.exe](https://integraly.com/Integraly-MELI.EXCEL.ADDIN-Versiones/v2.2.0.5/Integraly%20MELI.EXCEL.ADDIN.exe)

---

## 📌 Resumen de Capacidades Relevantes para el ERP

### 1. Precios por Cantidad % B2B (Nuevo estándar MercadoLibre)
- MercadoLibre discontinúa el esquema de precios B2B por monto fijo a partir del **27/10/2026**.
- Nueva columna `PxQ % B2B`: configuración de descuentos por volumen en **porcentaje** para compradores empresariales.
- Endpoint/algoritmo de recomendación de MercadoLibre para sugerir porcentajes óptimos por categoría/competencia.

### 2. Procesamiento Masivo de Imágenes
- Descarga masiva a carpetas locales a partir de URLs públicas de MercadoLibre preservando el nombre original del archivo.
- Estimación previa de peso total, cálculo de tiempo de descarga y barra de progreso.
- Conversión automática de formatos `webp` a `jpg` para compatibilidad con las especificaciones de MercadoLibre.

### 3. Clasificados y Autopartes
- Caché y precarga en segundo plano de árboles de ubicaciones y categorías vehiculares.
- Validación y envío de datos de contacto obligatorios (código de país + teléfono de WhatsApp) en altas/modificaciones.
- Soporte para restricciones de posición, notas y compatibilidades directas con User Products (UP).

### 4. Cuentas con Alto Volumen (+200.000 Publicaciones)
- Paginación optimizada para no romper límites de memoria al listar ítems por estado (`active`, `paused`, `closed`, `under_review`).
- Reintento automático con backoff ante errores intermitentes de validación en la API de MercadoLibre.

### 5. Multi-Origen y Gestión de Depósitos (Full y Propios)
- Mapeo de columnas individuales de stock por depósito físico.
- Prevención de alertas de error en publicaciones con inventario en depósitos FULL de MercadoLibre.

### 6. Central de Promociones
- Doble vista:
  - **Matriz:** una columna por campaña promocional.
  - **Lista:** una fila por publicación y campaña con opción de actualización individual/filtrada.
- Descuento adicional para suscriptores **Meli+** (antiguo Mercado Puntos niveles 3 a 6).
- Regla de negocio: ante múltiples campañas simultáneas, tomar el descuento más favorable (no sumar).

### 7. Procesos Programados (Segundo Plano)
- Actualización desatendida de precios y stock desde archivos CSV o XLSX sin necesidad de interfaz gráfica abierta.
- Identificación flexible de productos por `meli_item_id`, `sku` o `seller_custom_field`.
