# 🖼️ Plan: Banco de Imágenes ML — Sincronización Local ↔ MercadoLibre

> **Objetivo:** Tener 30.000 imágenes locales (`sku-N.jpg`) catalogadas en Supabase, subidas al CDN de MercadoLibre, y disponibles para publicaciones masivas desde el CRM sin repetir cargas.

---

## 🏗️ Arquitectura General

```
┌──────────────────────┐      ┌─────────────────────┐      ┌──────────────────┐
│  LOCAL (Windows)     │      │   SUPABASE           │      │  MERCADOLIBRE    │
│  D:/images/          │─────▶│   image_bank         │◀────▶│  CDN Pictures    │
│  sku-0.jpg           │      │   (tabla maestra)    │      │  picture_id      │
│  sku-1.jpg           │      │                      │      │  URL pública     │
│  ...                 │      └─────────────────────-┘      └──────────────────┘
└──────────────────────┘
```

**Flujo completo:**
1. Script local escanea carpeta → registra archivos en `image_bank` (estado: `pending`)
2. Worker sube imágenes a ML API → guarda `picture_id` + URL en Supabase (estado: `synced`)
3. Al publicar → el CRM busca en `image_bank` por SKU y usa los `picture_id` directamente
4. ML envía webhook si imagen se rechaza/modifica → se actualiza estado en DB

---

## 📊 Fase 1: Base de Datos en Supabase

### Tabla `image_bank`

```sql
CREATE TABLE image_bank (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku             TEXT NOT NULL,          -- "KIT-CADENA-430" 
    image_index     INTEGER NOT NULL,       -- 0, 1, 2, 3... (orden de la imagen)
    local_filename  TEXT NOT NULL,          -- "sku-0.jpg"
    local_path      TEXT,                   -- ruta completa en la PC (opcional)
    file_hash       TEXT,                   -- MD5 del archivo para detectar cambios
    file_size_bytes INTEGER,

    -- Estado de sincronización con ML
    sync_status     TEXT NOT NULL DEFAULT 'pending',
    -- pending | uploading | synced | error | rejected | changed

    -- Datos de MercadoLibre (se llenan al subir)
    ml_picture_id   TEXT,                   -- "123456789-MLA"
    ml_url          TEXT,                   -- URL pública del CDN de ML
    ml_secure_url   TEXT,                   -- HTTPS URL
    meli_account_id UUID REFERENCES meli_accounts(id),

    -- Metadatos
    error_message   TEXT,
    upload_attempts INTEGER DEFAULT 0,
    last_synced_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(sku, image_index)               -- Un SKU puede tener varias imágenes
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_image_bank_sku ON image_bank(sku);
CREATE INDEX idx_image_bank_status ON image_bank(sync_status);
CREATE INDEX idx_image_bank_ml_picture_id ON image_bank(ml_picture_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_image_bank_updated_at
    BEFORE UPDATE ON image_bank
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 🔧 Fase 2: Script de Inventario Local (Node.js)

**Archivo:** `scripts/scan-images.js`

### 📁 Especificación de la Carpeta de Imágenes

El script acepta la carpeta fuente de tres formas (en orden de prioridad):

**1. Argumento por línea de comandos (recomendado):**
```bash
node scripts/scan-images.js --folder "D:\Imagenes\MercadoLibre"
node scripts/scan-images.js --folder "C:\Users\ORLANDO\Desktop\fotos-sku"
```

**2. Variable de entorno en `.env`:**
```env
IMAGE_BANK_FOLDER=D:\Imagenes\MercadoLibre
```

**3. Archivo de configuración `scripts/image-config.json` (fallback):**
```json
{
  "sourceFolder": "D:\\Imagenes\\MercadoLibre",
  "recursive": true,
  "extensions": [".jpg", ".jpeg", ".png", ".webp"]
}
```

Si no se especifica ninguna, el script **falla con un mensaje claro** indicando cómo configurarlo — nunca adivina una ruta.

**¿Qué hace?**
- Lee la carpeta especificada (con soporte para subcarpetas si `recursive: true`)
- Parsea el nombre `sku-index.jpg` → extrae SKU e índice
- Calcula MD5 para detectar si la imagen cambió
- Inserta/actualiza registros en `image_bank` (upsert por `sku + image_index`)
- No sube nada, solo cataloga
- Al terminar muestra un resumen: nuevas / actualizadas / sin cambios / errores

**Patrón de nombre soportado:**
```
sku-0.jpg            → sku = "sku",           index = 0
KIT430-0.jpg         → sku = "KIT430",         index = 0
FILTRO-HMB-01-2.jpg  → sku = "FILTRO-HMB-01",  index = 2
```

> [!NOTE]
> El script también detecta imágenes que **ya no existen localmente** y las marca como `local_deleted` para revisión.

---

## 🚀 Fase 3: Worker de Subida a MercadoLibre

**Archivo:** `scripts/sync-images-to-ml.js`

**¿Qué hace?**
- Lee registros con `sync_status = 'pending'` en lotes (ej. 50 a la vez)
- Lee la ruta local de cada imagen desde la columna `local_path` guardada en `image_bank`
- Por cada imagen: `POST https://api.mercadolibre.com/pictures` con multipart
- Guarda el `picture_id` retornado en Supabase
- Maneja errores, límite de rate, y reintentos
- Actualiza estado: `synced` | `error`

> [!IMPORTANT]
> El sync worker **no necesita que le indiques la carpeta** — lee la `local_path` que guardó el scanner en Supabase. Por eso el paso de scan siempre va primero.

**Control de velocidad:**
```
ML permite ~50 req/min en uploads → 1 imagen cada 1.2 segundos
30.000 imágenes → ~10 horas de carga continua (correr en overnight)
```

**Modos de operación:**
- `--batch 100` — subir solo N imágenes (para pruebas)
- `--sku KIT430` — subir solo imágenes de un SKU específico  
- `--force` — re-subir imágenes ya sincronizadas (si cambiaron)
- `--dry-run` — solo muestra qué subiría sin hacer nada

---

## 🖥️ Fase 4: UI en el CRM (Dashboard)

**Página:** `src/app/dashboard/images/page.js`

### Panel principal incluye:
| Sección | Descripción |
|---------|-------------|
| **Stats globales** | Total imágenes / Sincronizadas / Pendientes / Con error |
| **Buscador por SKU** | Ver todas las imágenes de un producto, con preview |
| **Tabla de estado** | Listado filtrable por estado, SKU, fecha |
| **Uploader manual** | Subir imágenes sueltas directamente desde el browser |
| **Trigger de sync** | Botón para ejecutar sincronización (N pendientes) |
| **Re-intentar errores** | Botón para re-procesar los fallidos |

### Vista de SKU (modal/drawer):
```
SKU: KIT-CADENA-430
┌─────────┬─────────┬─────────┐
│  IMG 0  │  IMG 1  │  IMG 2  │
│ ✅ synced│✅ synced│⏳pending│
│ [ID ML] │ [ID ML] │         │
└─────────┴─────────┴─────────┘
[+ Agregar imagen]  [Usar en publicación]
```

---

## 📡 Fase 5: API Routes en Next.js

| Endpoint | Método | Función |
|----------|--------|---------|
| `/api/images` | GET | Listar imágenes (con filtros) |
| `/api/images/stats` | GET | Totales por estado |
| `/api/images/upload` | POST | Subir imagen desde browser → ML |
| `/api/images/sync` | POST | Disparar worker de sync (N items) |
| `/api/images/[sku]` | GET | Ver todas las imágenes de un SKU |
| `/api/images/[id]` | DELETE | Eliminar imagen del banco |

---

## 🔗 Fase 6: Integración con Publicaciones

Al crear/editar una publicación, el CRM:
1. Busca `image_bank WHERE sku = ? AND sync_status = 'synced'`
2. Devuelve la lista de `ml_picture_id` ordenados por `image_index`
3. Los incluye directamente en el payload de ML:

```json
{
  "pictures": [
    { "id": "111111111-MLA" },
    { "id": "222222222-MLA" },
    { "id": "333333333-MLA" }
  ]
}
```

> [!IMPORTANT]
> Los `picture_id` de ML **no expiran** mientras la publicación los use. Una imagen subida una vez puede reutilizarse en miles de publicaciones sin costo adicional de API.

---

## 📋 Plan de Implementación (Prioridad)

```
Semana 1
├── [ ] SQL: Crear tabla image_bank en Supabase
├── [ ] Script: scan-images.js (inventario local)
└── [ ] Validar parseo de nombres de archivo con tus 30k imágenes

Semana 2  
├── [ ] Script: sync-images-to-ml.js (worker de subida)
├── [ ] API Route: /api/images/stats y /api/images/[sku]
└── [ ] Prueba con 100 imágenes en batch

Semana 3
├── [ ] UI: Dashboard de imágenes
├── [ ] UI: Uploader manual desde browser
└── [ ] Sync nocturna automática (Task Scheduler o Vercel Cron)

Semana 4
├── [ ] Integración: Autocomplete de imágenes en publicador masivo
└── [ ] Monitor: Alertas si imágenes quedan en estado error
```

---

## ⚠️ Consideraciones Importantes

> [!WARNING]
> **Límites de la API de ML:**
> - Máximo **12 imágenes por publicación**
> - Máximo **10 MB por imagen** (recomendado < 2 MB)
> - Formato permitido: JPG, PNG, GIF, WebP
> - Las imágenes deben ser mínimo 500x500 px para máxima calidad en ML

> [!TIP]
> **Estrategia para 30k imágenes:**
> - Procesar en lotes nocturnos de 2.000/día (no bloquea la PC)
> - Priorizar los SKUs activos en publicaciones primero
> - Usar `file_hash` para evitar re-subir imágenes que no cambiaron

> [!NOTE]
> **Sobre los Picture IDs:**
> ML no tiene endpoint para "listar todas mis imágenes". Los IDs solo se obtienen al subir. Por eso la tabla `image_bank` es la fuente de verdad — sin ella, no sabrías qué imágenes tienes en ML.

---

## 🚦 ¿Por dónde empezamos?

**Opción A — Rápido:** Crear el SQL + script de escaneo hoy. Validamos el inventario local antes de subir nada.

**Opción B — Completo:** Construir todo el módulo de una sola vez (3-4 días de trabajo).

**Recomendación:** Opción A primero. Con el inventario catalogado en Supabase, ya tienes visibilidad total y puedes sincronizar gradualmente.
