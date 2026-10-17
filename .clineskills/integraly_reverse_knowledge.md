# integraly_reverse_knowledge

Conocimiento técnico extraído por Ingeniería Inversa REA de **Integraly MELI.EXCEL.ADDIN (`v2.2.0.5` y `v2.2.0.6`)**.

## 1. Stock en User Products (UP) y Multi-Warehouse
- Consultar `GET /user-products/{user_product_id}/stock` y extraer el header `x-version`.
- Actualizar con `PUT /user-products/{user_product_id}/stock/type/seller_warehouse` enviando header `x-version`.
- **Fallback:** Si `selling_address` está bloqueado (`400`/`403`), usar `PUT /items/{item_id}` con `{ "available_quantity": qty }`.

## 2. Compatibilidades Vehiculares (`compatibilidades.json.gz` + Similitud de Coseno)
- Base maestra en `c:\DEVELOPER\INGENIERIA INVERSA\INTEGRALY\2.2.0.6\compatibilidades.json.gz` (2.59 MB).
- Matching por tokens normalizados + Embeddings OpenAI/Gemini con Similitud de Coseno e inyección en `POST /items/{id}/compatibilities`.

## 3. Procesamiento de Imágenes (`CropWhiteSpace` + `EnlargeImage`)
- Recortar bordes blancos sobrantes (`sharp.trim()`) y escalar el repuesto al 92%–95% del lienzo cuadrado blanco de `1500x1500` px antes de subir a `/pictures/items/upload`.

## 4. Novedades v2.2.0.6
- **`FormListadoVentas`:** Desglose financiero real (`Bruto - sale_fee - shipping_cost - taxes = Neto a Recibir`) + atribución de publicidad.
- **`discount_meli_boost_amount`:** Descuento co-financiado por Mercado Libre en `/seller-promotions`.
- **`PxQ B2B %` (Deadline 27/10/2026):** Precios mayoristas por cantidad con hasta 5 tramos estrictamente crecientes en cantidad mínima y porcentaje de descuento.
