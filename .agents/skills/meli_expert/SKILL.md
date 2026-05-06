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
