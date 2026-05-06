---

## 0. Visión del Proyecto y Objetivos de Éxito (La Misión)

### ¿Qué es este proyecto?
El **Listing Sniper** no es un simple buscador de productos. Es una herramienta de **Inteligencia Competitiva** diseñada para el mercado de autopartes en Venezuela. Su misión es transformar el inventario pasivo de Profit Plus en publicaciones agresivas y ganadoras en Mercado Libre.

### ¿Qué debe lograr el programa? (Success Criteria)
1.  **Ingeniería Inversa de Ventas**: El programa debe ser capaz de "desmontar" la publicación del líder actual (el que más vende) y decirnos exactamente por qué nos está ganando.
2.  **Cierre de Brechas (Gap Analysis)**: Debe identificar qué tenemos nosotros que el líder no, y viceversa (Mejor precio, más fotos, mejores palabras clave).
3.  **Sugerencias Accionables**: El resultado final para el usuario debe ser una lista de tareas: *"Baja el precio 1$", "Añade el Número de Parte", "Quita las mayúsculas del título"*.
4.  **Dominación del Algoritmo**: El objetivo final es que cualquier producto procesado por el Sniper suba al **Top 5 de búsquedas** en menos de una semana gracias a la optimización técnica.

---

## 1. Contexto para la IA Ejecutora (Kimi)

## 1. Contexto para la IA Ejecutora (Kimi)

### Stack Tecnológico Actual:
- **Frontend**: Next.js (App Router), Tailwind CSS, Lucide React.
- **Backend**: Node.js (API Routes).
- **Base de Datos**: Supabase (PostgreSQL).
- **Integración**: Mercado Libre API (MLV).
- **Helpers Críticos**: 
    - `src/lib/meli-auth-helper.js`: Para obtener tokens válidos.
    - `src/lib/supabase-admin.js`: Para interactuar con la DB.

### Objetivo del Proyecto:
Crear una nueva pestaña en el Dashboard llamada **"Inteligencia de Mercado"** que permita buscar competidores, analizar sus debilidades y optimizar nuestras publicaciones.

---

## 2. Fase 1: Infraestructura de Datos (SQL)

**Instrucción para Kimi**: Ejecutar el siguiente SQL en el Editor de Supabase para crear las tablas del motor de inteligencia.

```sql
-- 1. Tabla de Análisis de Competencia
CREATE TABLE IF NOT EXISTS public.mlv_market_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_query TEXT NOT NULL,
    our_product_sku TEXT, 
    ml_item_id TEXT NOT NULL,
    title TEXT NOT NULL,
    price_usd DECIMAL(12,2),
    sold_quantity INTEGER DEFAULT 0,
    listing_type_id TEXT,
    permalink TEXT,
    seller_nickname TEXT,
    logistics_data JSONB, -- { "pickup": bool, "delivery": bool, "zones": [] }
    raw_data JSONB,
    search_position INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Tabla de Scores Comparativos
CREATE TABLE IF NOT EXISTS public.mlv_listing_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    our_ml_item_id TEXT NOT NULL,
    our_product_sku TEXT NOT NULL,
    competitor_item_id TEXT NOT NULL,
    score_total INTEGER,
    score_details JSONB, -- { price: 80, seo: 90, photos: 70 }
    action_plan JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

## 3. Fase 2: Backend (API Routes)

**Instrucción para Kimi**: Crear el archivo `src/app/api/tools/sniper/analyze/route.js`. Debe implementar la siguiente lógica:
1.  Recibir `query`, `sku` y `ourPrice`.
2.  Llamar a `getValidAccessToken()` de `@/lib/meli-auth-helper`.
3.  Consultar `https://api.mercadolibre.com/sites/MLV/search?q={query}&sort=sold_quantity_desc&limit=10`.
4.  Realizar "Scraping" lógico en el título y descripción (si está disponible) para detectar **Zonas de Pickup** y **Servicios de Encomienda**.
5.  Normalizar precios (Confiar en precio API ya que es USD legal en VZ).
6.  Guardar los resultados en la tabla `mlv_market_snapshots`.

---

## 4. Fase 3: Frontend (UI/UX)

**Instrucción para Kimi**: 
1.  **Nueva Pestaña**: Añadir "Inteligencia de Mercado" al sidebar o navegación principal.
2.  **Pantalla de Búsqueda**: Crear `src/app/dashboard/intelligence/page.js`.
3.  **Componentes Necesarios**:
    - `SearchBar`: Input para SKU o término de búsqueda.
    - `CompetitorGrid`: Lista de los 10 mejores competidores con sus métricas.
    - `WinnerCard`: Comparativa "Cara a Cara" entre nuestra publicación y la del líder.
    - `SEO-Advice`: Sugerencias generadas por el análisis de títulos.

### Diseño Visual:
- Usar estética "Dark Mode" premium.
- Gráficos circulares para los Scores (0-100).
- Badges de colores para niveles de reputación (Verde = Líder, Rojo = Riesgo).

---

## 5. Fase 4: Lógica de Posicionamiento (SEO & Atributos)

**Instrucción para Kimi**: Implementar algoritmos de comparación:
- **Título**: Si el líder usa más de 55 caracteres y nosotros menos de 40, generar alerta.
- **Atributos**: Comparar el array de `attributes` del líder contra el nuestro. Listar los IDs de atributos que nos faltan (ej: BRAND, PART_NUMBER).
- **Fotos**: Si el líder tiene 8 fotos y nosotros 3, marcar como "Prioridad Alta" añadir más imágenes.

---

## 6. Prompt Maestro de Delegación (Copiar esto a Kimi)

> "Hola Kimi. Actúa como un experto en Next.js y Mercado Libre API. Tu tarea es ejecutar el proyecto 'Listing Sniper' documentado en `docs/LISTING_SNIPER_PLAN.md`. 
> 
> **La Visión**: Estamos construyendo una herramienta de inteligencia competitiva para dominar el mercado de autopartes en Venezuela. El programa no solo debe mostrar datos, sino sugerir acciones para superar al líder de ventas actual.
> 
> Pasos a seguir:
> 1. Lee la estructura de base de datos y genera los servicios necesarios en Node.js.
> 2. Crea la interfaz en React (Next.js App Router) para la nueva pestaña 'Inteligencia de Mercado'.
> 3. Asegúrate de usar los helpers existentes en `src/lib/` para la autenticación y base de datos.
> 4. El enfoque debe ser el mercado venezolano (MLV), priorizando SEO y confianza logística sobre Full/Flex.
> 
> Comienza por la Fase 1 (SQL) y confirma cuando estés listo para proceder con el Backend."

---

> **Nota para el Usuario**: Este documento ha sido diseñado para que la IA no tenga que preguntar nada. Contiene rutas de archivos, nombres de tablas y lógica de negocio específica para Venezuela.
