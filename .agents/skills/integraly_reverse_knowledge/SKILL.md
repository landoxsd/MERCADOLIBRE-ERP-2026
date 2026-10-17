---
name: integraly_reverse_knowledge
description: >-
  Compendio técnico extraído por Ingeniería Inversa REA de Integraly MELI.EXCEL.ADDIN (v2.2.0.5 y v2.2.0.6).
  Incluye sincronización de stock para User Products con cabecera x-version, motor de compatibilidades vehiculares
  con compatibilidades.json.gz y Similitud de Coseno, 8 asistentes IA, recorte de bordes blancos (CropWhiteSpace),
  Promociones Boost co-financiadas, Precios Mayoristas B2B (PxQ B2B %) y Auditoría Financiera de Ventas.
---

# integraly_reverse_knowledge

💡 Esta habilidad documenta los algoritmos, endpoints y estructuras de datos descubiertos mediante ingeniería inversa con **REA (`morluto/rea`)** sobre **Integraly (`v2.2.0.5` y `v2.2.0.6`)** en `c:\DEVELOPER\INGENIERIA INVERSA\INTEGRALY`, listos para ser utilizados o portados al ERP Next.js.

---

## 1. Sincronización de Stock en User Products (UP) y Multi-Warehouse (`MeliApiClient`)

Mercado Libre está migrando las cuentas al esquema **User Products (`user_product_id`)** con gestión de inventario distribuido (`seller_warehouse` vs `selling_address`).

### Flujo Exacto Descubierto en `Integraly.Core.dll`:
1. **Lectura de Stock y Versión (`ObtenerStockUserProductAsync`):**
   ```http
   GET https://api.mercadolibre.com/user-products/{USER_PRODUCT_ID}/stock
   Authorization: Bearer {ACCESS_TOKEN}
   ```
   - Leer el header de respuesta `x-version` (requerido para control de concurrencia optimista).
   - Inspeccionar `locations[]` buscando `type: "seller_warehouse"` o `type: "selling_address"`.
2. **Actualización con Control Optimista (`GrabarStockUserProductAsync`):**
   ```http
   PUT https://api.mercadolibre.com/user-products/{USER_PRODUCT_ID}/stock/type/seller_warehouse
   Authorization: Bearer {ACCESS_TOKEN}
   x-version: {X_VERSION_HEADER}
   Content-Type: application/json

   {
     "locations": [
       { "id": "{WAREHOUSE_ID}", "quantity": 10 }
     ]
   }
   ```
3. **Fallback Automático (`GrabarStockNivelItemAsync`):**
   - Si la API retorna `400 Bad Request` / `403 Forbidden` (ej. cuando `selling_address` está bloqueado para edición directa o el ítem no usa multi-warehouse) o `409 Conflict` (reintentar refrescando `x-version`), ejecutar fallback directo a:
   ```http
   PUT https://api.mercadolibre.com/items/{ITEM_ID}
   Authorization: Bearer {ACCESS_TOKEN}

   { "available_quantity": 10 }
   ```

---

## 2. Motor de Compatibilidades Vehiculares (`MlCompatibilidadesManager`)

Ubicación del recurso extraído: `c:\DEVELOPER\INGENIERIA INVERSA\INTEGRALY\2.2.0.6\compatibilidades.json.gz` (2.59 MB comprimido).

### Algoritmo de Deducción (`FormOpenAIDeducirCompatibilidades`):
1. Descomprimir `compatibilidades.json.gz` en memoria (contiene el catálogo estructurado de vehículos de ML con `brand`, `model`, `year`, `trim`, `catalog_product_id`).
2. Extraer del título/descripción de Profit Plus las menciones de marca, modelo, año y cilindrada.
3. Si no hay match exacto por tokens normalizados, calcular **Embeddings vectoriales** y evaluar **Similitud de Coseno** (`DotProduct(v1, v2) / (Norm(v1) * Norm(v2))`) para encontrar los `catalog_product_id` vehiculares más cercanos.
4. Inyectar las compatibilidades en la publicación mediante:
   - `POST https://api.mercadolibre.com/items/{ITEM_ID}/compatibilities`
   - `POST https://api.mercadolibre.com/items/{ITEM_ID}/compatibilities/cards`

---

## 3. Los 8 Asistentes de IA Descubiertos en Integraly (`FormOpenAI*`)

1. **`FormOpenAIOptimizarTitulos`**: Reescribe títulos respetando el límite estricto de 60 caracteres con estructura `[Tipo de Repuesto] [Marca/Posición] [Vehículo/Modelo] [Años]`.
2. **`FormOpenAIDeducirAtributos`**: Recibe la lista de atributos obligatorios/opcionales de `GET /categories/{id}/attributes` y deduce `BRAND`, `PART_NUMBER`, `OEM`, `VEHICLE_TYPE`, `POSITION` a partir de la descripción cruda del ERP.
3. **`FormOpenAIDeducirCompatibilidades`**: Cruza la descripción de la autoparte con `compatibilidades.json.gz` usando Similitud de Coseno.
4. **`FormOpenAISugerirKitsVirtuales`**: Analiza el catálogo y sugiere **Kits Virtuales** de alta rotación (ej. Par de Amortiguadores, Kit 4 Bujías, Kit Correa + Tensor) sin duplicar SKUs físicos en el ERP.
5. **`FormOpenAISugerirMedidas`**: Estima `PACKAGE_HEIGHT`, `PACKAGE_WIDTH`, `PACKAGE_LENGTH` (en cm) y `PACKAGE_WEIGHT` (en gramos/kg) para Mercado Envíos según el tipo de repuesto.
6. **`FormOpenAIGenerarDescripciones`**: Genera descripciones en texto plano limpio (sin HTML ni datos de contacto prohibidos) con especificaciones técnicas, políticas de envío y garantía.
7. **`FormOpenAIategorizar`**: Predice la categoría hoja (`leaf category`) combinando `/sites/MLV/domain_discovery/search` con validación semántica LLM.
8. **`FormOpenAIResponderPreguntas`**: Asistente de post-venta / preventa cruzando el stock real y ficha técnica del ítem.

---

## 4. Procesamiento Automático de Imágenes (`CropWhiteSpace` & `EnlargeImage`)

Integraly mejora el CTR de las fotos de portada en el listado de Mercado Libre aplicando dos transformaciones antes de subir a `POST /pictures/items/upload`:

1. **`CropWhiteSpace` (Recorte de Márgenes Blancos):**
   - Escanea los bordes superior, inferior, izquierdo y derecho de la imagen buscando el primer píxel cuya luminancia RGB sea `< 245` (no blanco).
   - Recorta la caja delimitadora (`bounding box`) eliminando todo el espacio vacío alrededor del repuesto.
2. **`EnlargeImage` (Maximización de Ocupación en Lienzo):**
   - Redimensiona la pieza recortada para que ocupe el **92%–95%** de un lienzo cuadrado blanco puro (`#FFFFFF`) de `1200x1200` px (o `1500x1500` px).
   - **Implementación equivalente en Node.js (`sharp`):**
     ```javascript
     const processedBuffer = await sharp(inputBuffer)
       .trim({ background: '#FFFFFF', threshold: 12 })
       .resize(1400, 1400, { fit: 'inside', withoutEnlargement: false })
       .extend({
         top: 50, bottom: 50, left: 50, right: 50,
         background: { r: 255, g: 255, b: 255, alpha: 1 }
       })
       .jpeg({ quality: 95 })
       .toBuffer();
     ```

---

## 5. Novedades Críticas de `v2.2.0.6` (Octubre 2026)

### 5.1. Auditoría Financiera de Ventas (`FormListadoVentas`)
Cruza las órdenes (`GET /orders/search`) con facturación, envíos y publicidad para mostrar la utilidad neta real:
- **Campos desglosados por orden:**
  - `Precio Unitario` × `Cantidad` = `Total Bruto Venta`
  - `Cargo por Venta ML` (`order_items[].sale_fee`)
  - `Costo de Envío a cargo del Vendedor` (`shipping.cost`)
  - `Impuestos y Retenciones` (`taxes.amount`)
  - `Venta por Publicidad` (flag si la orden provino de Product Ads / PADS)
  - **`Neto a Recibir`** = `Bruto - Comisión ML - Envío Vendedor - Impuestos`

### 5.2. Promociones Co-Financiadas Boost (`discount_meli_boost_amount`)
- Nuevo campo soportado al leer y aplicar promociones en `/seller-promotions/items/{id}?app_version=v2`.
- Permite distinguir cuánto del descuento lo paga el vendedor y cuánto lo subsidia Mercado Libre (`discount_meli_boost_amount`), protegiendo el margen mínimo sobre el costo de Profit Plus.

### 5.3. Precios por Cantidad Mayoristas B2B (`PxQ B2B %` — Deadline 27/10/2026)
- Mercado Libre dará de baja el esquema anterior de precios mayoristas el **27 de octubre de 2026**.
- El nuevo esquema `PxQ B2B %` soporta hasta **5 tramos (`Tiers 1..5`)**:
  - Cada tramo define `min_quantity` (entero) y `discount_percentage` (`%`).
  - **Regla de validación (`ValidarTramosPxQ`):**
    - `min_quantity[i] > min_quantity[i-1]` (estrictamente creciente).
    - `discount_percentage[i] > discount_percentage[i-1]` (estrictamente creciente).

---

## 6. Rate-Limiting Adaptativo (`AdaptarMultigetBulk` / `CalcularEspera`)

- Agrupa lecturas de ítems en lotes de **20 IDs** (`GET /items?ids=...&include_attributes=all`).
- Monitorea la latencia de respuesta y códigos `429 Too Many Requests` / `423 Locked`.
- Ajusta dinámicamente el grado de paralelismo (`MaxDegreeOfParallelism`) y aplica backoff exponencial con jitter aleatorio para sostener sincronizaciones de 40,000+ publicaciones sin bloqueos.
