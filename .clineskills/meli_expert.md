# 🎓 SKILL: Mercado Libre MLV Expert

Esta habilidad dota a la IA de conocimiento profundo sobre la API de Mercado Libre en Venezuela.

## 🚀 ENDPOINTS CRÍTICOS
- **Búsqueda**: `/sites/MLV/search?q={query}`.
- **Detalle**: `/items/{id}` (Use multiget para eficiencia).
- **Performance**: `/item/{id}/performance` (Reemplaza a /health).
- **Descripción**: `/items/{id}/description`.

## 🇻🇪 REGLAS DE NEGOCIO (Venezuela)
1. **Moneda**: La API devuelve precios. Si `currency_id` es `USD`, es el precio legal. Si es `VES`, es la conversión BCV.
2. **Logística**: No hay Full. El éxito depende de los `tags` y el texto de la descripción sobre pickup y envíos nacionales.
3. **Reputación**: 
   - `5_green` + `platinum` = Líder absoluto.
   - `3_yellow` o inferior = Oportunidad de superarlos fácilmente con servicio.

## 🛠️ PATRONES DE CÓDIGO
```javascript
// Llamada Segura a Meli
const token = await getValidAccessToken();
const res = await fetch(`https://api.mercadolibre.com/items/${id}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## 📦 USER PRODUCTS, B2B Y FINANZAS (OCTUBRE 2026 — REA INTEGRALY v2.2.0.6)
1. **Stock en User Products (UP):** Consultar `GET /user-products/{up_id}/stock`, leer cabecera `x-version` y enviar `PUT /user-products/{up_id}/stock/type/seller_warehouse` con header `x-version`. Si `selling_address` da `400`/`403`, hacer fallback a `PUT /items/{id}` (`available_quantity`).
2. **Precios Mayoristas B2B (`PxQ B2B %` — Obligatorio 27/10/2026):** Hasta 5 tramos con cantidades mínimas y porcentajes de descuento estrictamente crecientes.
3. **Promos Co-Financiadas (`discount_meli_boost_amount`):** En `/seller-promotions/items/{id}?app_version=v2`, descontar del margen solo `seller_percentage` (el monto `discount_meli_boost_amount` lo absorbe ML).
4. **Rentabilidad Neta de Ventas:** `Neto a Recibir = Bruto - sale_fee - shipping_cost (seller) - taxes`.

