---
name: sniper_logic
description: Inteligencia de mercado y algoritmos de comparación competitiva para el sector autopartes.
---

# sniper_logic

💡 Esta habilidad permite realizar ingeniería inversa de la competencia para identificar brechas de mercado y oportunidades de venta.

## Usage

Use esta habilidad cuando necesite:
- Comparar una publicación propia contra el líder de ventas.
- Calcular puntajes de competitividad (Sniper Score).
- Detectar zonas de pickup estratégicas en la competencia.
- Generar un plan de acción basado en SEO, precio y fotos.

## Steps

1. **Búsqueda**: Identificar al competidor con mayor `sold_quantity`.
2. **Gap Analysis**: Comparar Título, Precio, Fotos y Atributos.
3. **Scoring**: Aplicar pesos (30% Precio, 25% SEO, 20% Fotos, 15% Atributos, 10% Logística).
4. **Recomendación**: Generar una lista de acciones prioritarias y accionables.

## Segmentación por Modelos (Vehicle Split)

Para dominar el mercado de autopartes, la inteligencia debe:
- **Identificar Modelos**: Usar una lista maestra de modelos (Aveo, Spark, Corolla, etc.) para detectar aplicaciones múltiples.
- **Evitar Colisiones**: Asegurar que modelos contenidos en otros (ej. "Cherokee" vs "Grand Cherokee") se manejen como una sola entidad para evitar spam o títulos incorrectos.
- **Generación de Variants**: Crear publicaciones individuales por cada modelo detectado. Esto permite aparecer en búsquedas específicas (ej: "Amortiguador Aveo" y "Amortiguador Spark") en lugar de una búsqueda genérica truncada.
