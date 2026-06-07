# MEMORIA DEL PROYECTO: MERCADOLIBRE ERP 2026

## 🚀 Módulos Operativos al 100%

### 1. SERP Position Tracker (Intelligence)
- **Función:** Búsqueda en el algoritmo de MLV para ver el ranking real de las publicaciones (top 48).
- **IA Integrada:** Integrado con Llama 3.3 70B (vía Groq) para evaluar el dictamen competitivo, entender la posición del mercado y sugerir títulos de alta conversión (Generador de Títulos).
- **Interconectividad:** Botones inteligentes en los resultados que enrutan a **Seller Spy** (si es competidor) o **SEO Optimizer** (si es publicación propia).

### 2. SEO Optimizer (El Quirófano)
- **Función:** Compara tus publicaciones vs las del líder de ventas para encontrar brechas.
- **Accionables:** 
  - **Ficha Técnica (Atributos):** Conectado con la API oficial de MercadoLibre (PUT) para rellenar atributos faltantes en vivo mediante prompt, sin salir del ERP.
  - **Títulos:** Analiza keywords faltantes y actualiza el título en MLV.
  - **Fotos:** Muestra grid comparativo y cuenta faltantes.

### 3. Seller Spy (Rayos X)
- **Función:** Analiza el catálogo completo de un competidor, calculando ventas estimadas USD, ticket promedio, % de envío gratis y productos estrella.
- **Autocarga:** Recibe el ID de competidor por URL (`?query=MLV...`) desde el SERP Tracker y resuelve sus métricas automáticamente.

## 🛠️ En Planificación: Radar de Evolución Competitiva (Watchlist)
**Próximo a ejecutar:** Arquitectura de base de datos en Supabase (Timeseries) para guardar "Snapshots Estratégicos" de competidores favoritos. Esto permitirá graficar la evolución de ventas de rivales en el tiempo, hacer análisis cruzado de categorías y ver sus Top 3 productos históricos.
