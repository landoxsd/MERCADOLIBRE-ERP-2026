---
name: meli_seo_optimizer
description: >-
  Estrategias y APIs para optimizar el posicionamiento SEO de publicaciones en Mercado Libre Venezuela (MLV).
  Cubre: API /performance para score de calidad, atributos técnicos, fotos, análisis de competencia,
  keywords en títulos y extracción de campos faltantes comparando contra el líder de ventas.
---

# meli_seo_optimizer

🎯 Esta habilidad permite mejorar el posicionamiento orgánico de publicaciones propias en MLV extrayendo inteligencia de la competencia y usando la API de calidad oficial de Mercado Libre.

---

## ⚡ El Algoritmo de Posicionamiento de MLV (Lo que sabemos)

El ranking interno de Mercado Libre (llamado "Best Match") prioriza en este orden aproximado:

| Factor | Peso aproximado | Cómo mejorar |
|--------|----------------|--------------|
| **Ventas pasadas** | ~30% | Impulsar primeras ventas, descuentos iniciales |
| **Score de Calidad** (`/performance`) | ~25% | API mide fotos, atributos, título, envío |
| **Precio competitivo** | ~20% | < 3% vs líder de categoría |
| **Conversión (clics→ventas)** | ~15% | Foto portada impactante, precio claro |
| **Reputación del vendedor** | ~10% | Mantener verde, responder rápido |

---

## 📊 API de Calidad: `/item/{ITEM_ID}/performance`

**Esta es la herramienta más importante.** Reemplazó a `/health` en 2025.

```bash
GET https://api.mercadolibre.com/item/{ITEM_ID}/performance
Authorization: Bearer {ACCESS_TOKEN}
```

### ¿Qué mide?

La API retorna un `score` de 0-100 y agrupa los objetivos en **buckets**:

#### BUCKET: `CHARACTERISTICS` (Datos del Producto)
| Variable | Cómo se puntúa |
|---------|----------------|
| `PICTURES` | Mínimo 3 fotos requeridas. Sin fotos: 33% |
| `TITLE` | Mínimo 3 palabras, idealmente 60 chars con keywords |
| `TECHNICAL_SPECIFICATIONS_MAIN` | % de atributos obligatorios completados |
| `GTIN` | Código universal (EAN/UPC) del producto |

#### BUCKET: `OFFER` (Condiciones de Venta)
| Variable | Cómo se puntúa |
|---------|----------------|
| `FREE_SHIPPING` | Envío gratis = 100pts |
| `STOCK_DEPOSITO` | Stock ≥ 2 unidades = 100pts |
| `STOCK_AVAILABILITY_TIME` | Tiempo de preparación del pedido |
| `FINANCING` | Acepta cuotas = 100pts (irrelevante en MLV sin MercadoPago) |

### Niveles de Calidad
| Nivel | Score |
|-------|-------|
| Básica | 0–49 |
| Estándar | 50–65 |
| **Profesional** | **66–100** ← Objetivo |

### Ejemplo de llamada
```javascript
const res = await fetch(`https://api.mercadolibre.com/item/${itemId}/performance`, {
  headers: { Authorization: `Bearer ${accessToken}` }
});
const perf = await res.json();
const score = perf.score;           // 0-100
const level = perf.level_wording;  // "Básica" | "Estándar" | "Profesional"
const pending = perf.buckets
  .flatMap(b => b.variables)
  .filter(v => v.status === 'PENDING')
  .map(v => ({ key: v.key, score: v.score, title: v.title }));
```

### Notas importantes para MLV (Venezuela)
- La API funciona exactamente igual para MLV que para MLA/MLB.
- El campo `FINANCING` siempre estará `PENDING` en MLV porque no hay MercadoPago activo. **Ignorarlo** al calcular el score ajustado.
- El `STOCK_AVAILABILITY_TIME` corresponde a cuándo tienes disponible el producto, no el envío.

---

## 🔍 API de Atributos por Categoría

Para saber qué campos llenar en una publicación de una categoría específica:

```bash
GET https://api.mercadolibre.com/categories/{CATEGORY_ID}/attributes
Authorization: Bearer {ACCESS_TOKEN}
```

Filtra los que tienen `"tags": { "required": true }` para saber cuáles son obligatorios.

```javascript
const res = await fetch(`https://api.mercadolibre.com/categories/${categoryId}/attributes`, {
  headers: { Authorization: `Bearer ${accessToken}` }
});
const attrs = await res.json();
const required = attrs.filter(a => a.tags?.required);
const optional = attrs.filter(a => !a.tags?.required && !a.tags?.hidden);
```

---

## 🛠️ Ejecución Activa: Guardado de Atributos (Quirófano)

Cuando hemos detectado que a nuestra publicación le falta un atributo que el líder sí tiene, podemos actualizarlo en vivo en MLV sin afectar otros campos, usando el método `PUT`:

```javascript
// Payload para actualizar atributos faltantes (Ej: Marca)
const updates = {
    attributes: [
        { id: "BRAND", value_name: "Toyota" }
    ]
};

const res = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    method: 'PUT',
    headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    body: JSON.stringify(updates)
});
```

*Nota: Esta estrategia de "micro-updates" es la base del **SEO Optimizer** del ERP, ya que eleva instantáneamente el Score de Calidad sin requerir republicación masiva.*

---

## 🏆 Flujo de Optimización SEO: Comparar vs Competencia

### Paso 1: Identificar el Líder de la Categoría
Usando el Seller Spy (habilidad `sniper_logic`), obtener el ítem con mayor `sold_quantity` en la misma categoría.

### Paso 2: Comparar Atributos Faltantes
```javascript
// Atributos nuestros
const ourAttrs = ourItem.attributes.map(a => a.id);

// Atributos del competidor líder
const competitorAttrs = competitorItem.attributes;

// GAP = atributos que el líder tiene y nosotros no
const gap = competitorAttrs.filter(a => a.value_name && !ourAttrs.includes(a.id));
```

### Paso 3: Comparar Fotos
```javascript
const ourPhotoCount = ourItem.pictures.length;
const competitorPhotoCount = competitorItem.pictures.length;
const photoGap = competitorPhotoCount - ourPhotoCount;

// Dimensiones de fotos (calidad)
// MLV requiere mínimo 500x500px, recomendado 1200x1200px
// El campo 'size' en cada foto indica "500x467" etc.
const ourPhotos = ourItem.pictures.map(p => ({
  url: p.secure_url,
  size: p.size,
  maxSize: p.max_size
}));
```

### Paso 4: Comparar Título (SEO de Keywords)
```
Reglas del Título en MLV:
- Mínimo 3 palabras
- Máximo 60 caracteres (recomendado)
- Incluir: Marca + Tipo de Producto + Modelo del Vehículo + Año
- NO incluir: precio, envío, "oferta", signos de puntuación innecesarios
- CORRECTO: "Kit Cadena Tiempo Suzuki Grand Vitara J20 2005-2010"
- INCORRECTO: "Kit cadena!! Envío gratis!! 20% OFF"
```

### Paso 5: Score Comparativo Sniper
Ver habilidad `sniper_logic` → Scoring Sniper (pesos):
- 30% Precio, 25% SEO, 20% Fotos, 15% Atributos, 10% Logística

---

## 📸 Reglas de Fotos en MLV (Verificadas 2026)

| Requisito | Valor |
|-----------|-------|
| Mínimo para "Profesional" | 3 fotos |
| Recomendado | 6-8 fotos |
| Tamaño mínimo aceptado | 500×500px |
| Tamaño recomendado | 1200×1200px o mayor |
| Fondo | Blanco preferido (ayuda al ranking) |
| Formato | JPG, PNG, WebP |
| Primera foto (portada) | La más importante → clics desde búsqueda |

### Para extraer datos de fotos de un ítem vía API:
```javascript
const photos = item.pictures.map(p => ({
  id: p.id,
  url: p.secure_url,
  size: p.size,         // "500x467"
  maxSize: p.max_size,  // "936x875" (tamaño original)
  quality: p.quality    // "" si sin datos
}));
```

La API **NO** evalúa calidad visual (composición, fondo, iluminación) — eso es manual.
Lo que sí mide: **cantidad**.

---

## 🔗 Endpoint de Compatibilidades (Autopartes)

Para publicaciones de autopartes, las "compatibilidades" (qué modelos de vehículo aplican) es un factor SEO crucial:

```bash
GET https://api.mercadolibre.com/items/{ITEM_ID}/compatibilities
Authorization: Bearer {ACCESS_TOKEN}
```

Un ítem con 50 modelos compatibles aparece en búsquedas de 50 modelos diferentes. Un ítem sin compatibilidades, solo en su título exacto.

---

## 🧩 Plan de Acción SEO — Orden de Impacto

Cuando vayas a optimizar una publicación, hazlo en este orden:

1. **Fotos** → Lleva a 6 fotos mínimo con fondo blanco y 1200px+
2. **Título** → Revisa keywords del competidor líder. Copia la estructura, no el texto
3. **Atributos técnicos** → Completa todos los `required`. Luego los opcionales
4. **Compatibilidades** → Si es autoparte, agrega todos los modelos aplicables
5. **Stock** → Mantén ≥ 2 unidades siempre
6. **Precio** → 3% por debajo del líder, o igual si eres ya el líder

---

## 🔌 Integración con el ERP

En el ERP actual, la función que calcula el score de performance está en:
- API: `GET /api/account/publications?accountId=...` → devuelve productos de Supabase
- El score de `/performance` se debe consultar por ítem individual (no hay endpoint batch)
- Para no golpear la API con 1000+ items, **priorizar** items con `health: null` o los que tienen pocas fotos

---

## ⚠️ Limitaciones Conocidas

| Problema | Workaround |
|---------|-----------|
| No hay endpoint de búsqueda pública `/search` en MLV (403 permanente) | Usar Playwright scraper (ver `sniper_logic`) |
| `/performance` no tiene endpoint batch | Consultar por grupos de 10 con delay de 100ms |
| Calidad visual de fotos no evaluada por API | Revisión manual o IA de visión |
| Compatibilidades de autopartes requieren `catalog_product_id` para vincular | Ver docs de "Compatibilidades de Autopartes" |
