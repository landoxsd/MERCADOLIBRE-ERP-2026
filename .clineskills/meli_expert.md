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
