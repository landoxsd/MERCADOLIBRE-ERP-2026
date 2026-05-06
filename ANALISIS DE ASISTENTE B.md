¡Excelente iniciativa! El mercado de autopartes en Venezuela es altamente competitivo y técnico. Un error en un número de parte o una foto borrosa puede significar una devolución costosa. Tu enfoque de "Ingeniería Inversa" es exactamente lo que se necesita para pasar de ser un vendedor más a ser un líder de categoría.

He analizado tu plan y he preparado la **Hoja de Ruta Técnica Definitiva** para el **Listing Sniper**. He refinado el código SQL para que sea más robusto, diseñado la lógica de comparación específica para MLV y estructurado el backend para que sea escalable.

Aquí tienes el plan de ejecución detallado:

---

### 1. Refinamiento de Infraestructura de Datos (SQL Avanzado)

El esquema que propusiste es bueno, pero para hacer una "Ingeniería Inversa" real, necesitamos guardar no solo el snapshot, sino el desglose de atributos y fotos para poder compararlos visualmente.

**Ejecuta este SQL en tu Supabase:**

```sql
-- Tabla principal de análisis de mercado
CREATE TABLE IF NOT EXISTS public.mlv_market_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_query TEXT NOT NULL,
    our_product_sku TEXT, 
    competitor_ml_item_id TEXT NOT NULL UNIQUE, -- ID del competidor
    title TEXT NOT NULL,
    price DECIMAL(12,2),
    currency TEXT DEFAULT 'USD',
    sold_quantity INTEGER DEFAULT 0,
    listing_type_id TEXT, -- classic, premium, gold
    permalink TEXT,
    seller_nickname TEXT,
    seller_reputation_level TEXT, -- platinum, gold, green, orange, red
    -- Datos enriquecidos
    attributes_json JSONB, -- { "BRAND": "Bosch", "PART_NUMBER": "12345" }
    photos_urls TEXT[], -- Array de URLs de fotos
    shipping_info JSONB, -- { "mode": "me2", "local_pickup": true, "free_shipping": false }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de resultados del análisis (El "Plan de Acción")
CREATE TABLE IF NOT EXISTS public.mlv_listing_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    our_ml_item_id TEXT NOT NULL,
    our_product_sku TEXT NOT NULL,
    competitor_item_id TEXT NOT NULL,
    -- Puntajes 0-100
    score_seo_title INTEGER DEFAULT 0,
    score_photos INTEGER DEFAULT 0,
    score_attributes INTEGER DEFAULT 0,
    score_price_competitiveness INTEGER DEFAULT 0,
    score_total INTEGER DEFAULT 0,
    -- El output clave: Qué hacer
    action_plan JSONB, -- [ { "type": "warning", "msg": "Falta atributo PART_NUMBER" } ]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

### 2. Backend: El Motor de Análisis (`analyze/route.js`)

Este es el cerebro. No solo busca, sino que **enriquece** los datos. La API de búsqueda de ML a veces no devuelve todos los atributos, así que el script debe hacer una segunda llamada (`getItemDetails`) para obtener la "carne" del producto.

**Archivo:** `src/app/api/tools/sniper/analyze/route.js`

```javascript
import { NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/meli-auth-helper';
import { createClient } from '@/lib/supabase-admin';
import axios from 'axios';

export async function POST(req) {
  const { query, ourSku, ourItemId } = await req.json();
  const supabase = createClient();

  try {
    // 1. Obtener Token MLV
    const token = await getValidAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    // 2. Buscar a los líderes (Ordenado por ventas y relevancia)
    const searchRes = await axios.get(`https://api.mercadolibre.com/sites/MLV/search`, {
      params: { q: query, sort: 'sold_quantity_desc', limit: 5 },
      headers
    });

    const competitors = searchRes.data.results;
    const analysisResults = [];

    // 3. Iterar y Enriquecer Datos (Ingeniería Inversa)
    for (const comp of competitors) {
      // Llamada extra para obtener atributos completos y fotos (La API de search es limitada)
      const detailsRes = await axios.get(`https://api.mercadolibre.com/items/${comp.id}`, { headers });
      const details = detailsRes.data;

      // Extraer atributos clave para autopartes
      const attributesMap = {};
      details.attributes?.forEach(attr => {
        attributesMap[attr.id] = attr.value_name || (attr.value_struct ? attr.value_struct.number : null);
      });

      // Guardar en DB
      await supabase.from('mlv_market_snapshots').insert({
        search_query: query,
        our_product_sku: ourSku,
        competitor_ml_item_id: comp.id,
        title: comp.title,
        price: comp.price,
        sold_quantity: comp.sold_quantity,
        listing_type_id: comp.listing_type_id,
        permalink: comp.permalink,
        seller_nickname: details.seller.nickname,
        seller_reputation_level: details.seller.seller_reputation?.level_color,
        attributes_json: attributesMap,
        photos_urls: details.pictures.map(p => p.secure_url),
        shipping_info: details.shipping
      });

      analysisResults.push({ id: comp.id, title: comp.title, price: comp.price, sold: comp.sold_quantity });
    }

    // 4. Generar Plan de Acción (Lógica de Comparación)
    // Aquí llamamos a una función interna que compara "Nuestro Item" vs "El Ganador"
    const actionPlan = await generateActionPlan(ourItemId, analysisResults[0].id, token);

    return NextResponse.json({ 
      success: true, 
      competitors: analysisResults,
      actionPlan 
    });

  } catch (error) {
    console.error('Sniper Error:', error);
    return NextResponse.json({ error: 'Fallo en análisis de mercado' }, { status: 500 });
  }
}

// Función auxiliar de lógica de negocio
async function generateActionPlan(ourId, winnerId, token) {
  // TODO: Implementar lógica de comparación de atributos (ver Fase 4)
  // Retorna un JSON con las tareas: ["Añadir 2 fotos", "Bajar precio 5%"]
  return { tasks: ["Analizando brechas...", "Comparando atributos..."] }; 
}
```

---

### 3. Lógica de Posicionamiento (El Algoritmo de Comparación)

Para que el sistema sea útil, debe ser estricto. En autopartes, los detalles matan la venta. Aquí está la lógica que debes implementar en la función `generateActionPlan` o en un servicio separado:

**Reglas de Oro para MLV Autopartes:**

1.  **El Título Perfecto:**
    *   *Fórmula:* `Producto + Marca + Modelo + Año + Motor + Número de Parte (OEM)`
    *   *Algoritmo:* Si el competidor tiene > 55 caracteres y usa el número de parte, y tú no -> **ALERTA CRÍTICA**.
2.  **Atributos Obligatorios:**
    *   En autopartes, `BRAND` (Marca) y `PART_NUMBER` (Número de Parte) son vitales.
    *   Si el líder tiene `PART_NUMBER` y tú no -> **Sugerencia:** "Añade el número de parte original para filtrar búsquedas específicas".
3.  **Fotos de Confianza:**
    *   El líder usa fotos con fondo blanco puro?
    *   El líder muestra la etiqueta con el número de parte? (Esto reduce devoluciones drásticamente en Venezuela).
    *   *Regla:* Si el líder tiene foto de etiqueta y tú no -> **Prioridad Alta**.
4.  **Precio Psicológico:**
    *   En Venezuela, los precios terminados en `.99` o `.95` funcionan, pero en autopartes de alto valor, el precio entero denota seriedad.
    *   Comparar precio vs. condición (Nuevo vs. Usado).

---

### 4. Frontend: La Interfaz "War Room"

Diseñaremos la pantalla `src/app/dashboard/intelligence/page.js` con un enfoque de **Dashboard de Mando**.

**Componentes Clave:**

1.  **Header de Búsqueda:**
    *   Input grande: "¿Qué producto quieres dominar hoy?" (Ej: "Bomba de agua Toyota Corolla 2010").
    *   Input secundario (Opcional): "Nuestro SKU" (Para vincularlo automáticamente).

2.  **Tarjeta "El Enemigo a Batir" (Winner Card):**
    *   Muestra la foto del producto #1 en ventas.
    *   **Badge de Ventas:** "🔥 150 vendidos el último mes".
    *   **Badge de Reputación:** "🟢 Vendedor Platinum".

3.  **Panel de Brechas (Gap Analysis):**
    *   Una lista de checkmarks rojos y verdes.
    *   *Ejemplo Visual:*
        *   ✅ Precio: Estamos $2 más baratos.
        *   ❌ Título: Nos faltan 15 caracteres clave.
        *   ❌ Atributos: Falta "Año del Vehículo".
        *   ⚠️ Fotos: Ellos tienen 6, nosotros 3.

4.  **Botón Mágico: "Aplicar Mejoras":**
    *   Este botón (futuro) podría usar la API de ML para actualizar tu publicación automáticamente con los atributos faltantes detectados.

---

### 5. Consideraciones Específicas para Venezuela (MLV)

Dado que operas en Venezuela, debes añadir estas capas de inteligencia al código:

1.  **Detección de "Full" vs "Clásico":**
    *   En Venezuela no existe "Full" (bodegas de ML) como en otros países, pero sí existe la logística "Mercado Envíos".
    *   *Check:* Verificar si el competidor ofrece `shipping.mode === 'me2'`. Si ellos tienen envío gratis y tú no, es una desventaja masiva.
2.  **Palabras Clave Locales:**
    *   El algoritmo debe detectar si el competidor usa términos locales como "Repuesto Original", "Genérico", "Nacional", "Importado".
    *   Si vendes repuestos japoneses y el líder usa "Original Japonés" en el título y tú no, debes añadirlo.
3.  **Manejo de Moneda:**
    *   Asegúrate de que la comparación de precios sea estrictamente en USD. La API de MLV a veces retorna precios en VES si la cuenta no está configurada correctamente, pero para análisis competitivo, normaliza todo a USD.

### Siguiente Paso Inmediato

Para comenzar, te sugiero que **ejecutes el script SQL** proporcionado en el paso 1 y luego me avises para que generemos el código completo del componente de React (`CompetitorGrid`) que renderizará estos datos de forma visualmente impactante.

¿Quieres que profundice primero en la lógica de comparación de atributos (Backend) o prefieres ver el diseño de la interfaz (Frontend)?