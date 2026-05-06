# 🎯 SKILL: Listing Sniper Logic (V3)

Esta habilidad dota a la IA de la capacidad de realizar "Ingeniería Inversa" competitiva.

## 🧠 ALGORITMO DE SCORING (Pesos)
- **Precio**: 30% (Comparación directa USD).
- **SEO Título**: 25% (Longitud 55-60, keywords al inicio).
- **Contenido Visual**: 20% (Cantidad de fotos vs líder).
- **Atributos Técnicos**: 15% (Presencia de BRAND y PART_NUMBER).
- **Logística/Confianza**: 10% (Pickup zones detectadas).

## 🕵️‍♂️ MODO SNIPER (Workflow de Análisis)
1. **Identificación**: Localizar al competidor con más ventas (`sold_quantity`).
2. **Extracción de Atributos**: Listar todos los atributos del líder que nosotros NO tenemos.
3. **Detección de Spam**: Penalizar títulos con "REMATE", "OFERTA" o exceso de exclamaciones.
4. **Plan de Acción**: Generar pasos concretos (ej: "Baja $1.5", "Añade 3 fotos", "Mueve Marca al inicio").

## 🇻🇪 ZONAS DE PICKUP (Caracas Gold)
- Chacao
- Las Mercedes
- Sabana Grande
- Los Cortijos
- Altamira
- Bello Monte
