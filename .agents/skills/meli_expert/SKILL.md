---
name: meli_expert
description: Experto en la API de Mercado Libre Venezuela (MLV) con conocimientos actualizados de 2025.
---

# meli_expert

💡 Esta habilidad proporciona el conocimiento técnico necesario para interactuar con la API de Mercado Libre en el contexto de Venezuela (MLV).

## Usage

Use esta habilidad cuando necesite:
- Realizar búsquedas de productos en MLV.
- Consultar detalles de ítems (multiget).
- Analizar el rendimiento de una publicación (Performance API).
- Manejar la lógica de precios legal en USD (BCV).

## Steps

1. **Autenticación**: Use siempre `getValidAccessToken()` de `@/lib/meli-auth-helper`.
2. **Consulta**: Realice las peticiones a `https://api.mercadolibre.com/`.
3. **Validación**: Verifique que el `currency_id` sea `USD` (legal en MLV).
4. **Logística**: Analice el campo `shipping` y la descripción para detectar zonas de pickup.

## SEO & Publicación Masiva (V3.0)

- **Límite de Título**: Estricto de 60 caracteres.
- **Normalización**: Eliminar conectores (DE, LA, EL, CON) y puntuación (puntos, comas).
- **Abreviaturas**: Expandir abreviaturas críticas (DEL. -> DELANTERO, AMORT. -> AMORTIGUADOR) para mejorar el buscador interno de ML.
- **Split por Modelos**: Si un producto aplica a varios vehículos, generar una publicación independiente por modelo para capturar tráfico específico.
- **Imágenes**: Usar el ID de imagen de ML (`12345-MLV...`) o links de `http2.mlstatic.com` para evitar errores de carga en plantillas masivas.

## Integridad de Datos y Errores Críticos

- **Regla del SKU Inmutable**: El SKU es la clave primaria de sincronización con Profit Plus ERP. No se debe normalizar, recortar ni añadir sufijos (como -N) durante la generación de planillas. Debe mantenerse 1:1 con el ERP.
- **Paginación de Inventario**: Al buscar productos publicados en la base de datos (Supabase), siempre usar un bucle de paginación (`.range(offset, limit)`) para superar el límite de 1000 registros, ya que el inventario real supera los 18,000 ítems.
- **Parche de ExcelJS**: Las plantillas oficiales de ML contienen miles de "Shared Formulas" que causan el error `Shared Formula master must exist...` al guardar. Para solucionarlo, se debe aplicar un monkey-patch al método `CellXform.prototype.render` para interceptar y desvincular silenciosamente los clones de fórmulas huérfanos.
- **Splicing de Filas**: No intentar usar `spliceRows` para limpiar la plantilla, ya que no elimina los metadatos de las fórmulas compartidas. El monkey-patch es la única solución estable conocida.
