# 🖼️ Plan: Banco de Imágenes ML — Sincronización Local ↔ MercadoLibre

> **Objetivo:** Tener 30.000 imágenes locales (`sku-N.jpg`) catalogadas en Supabase, subidas al CDN de MercadoLibre, y disponibles para publicaciones masivas desde el ERP sin repetir cargas.

---

## 🎯 Decisión de Arquitectura: Proyecto Separado

> [!IMPORTANT]
> Esta herramienta se desarrolla como un **proyecto Node.js local independiente**, completamente separado del ERP (`MERCADOLIBRE 18042026`). Corre en Windows desde la línea de comandos, **sin Next.js, sin Vercel, sin servidor web**.

### ¿Por qué separado?
- El ERP es una aplicación web Next.js en Vercel — no puede acceder al sistema de archivos local
- Los 30.000 archivos están en el disco local, por eso la herramienta debe correr en Windows
- Mantenerlo separado permite usarlo sin afectar al ERP durante el desarrollo
- La integración futura es simple: **ambos proyectos comparten la misma tabla `image_bank` en Supabase**

### Contrato de integración (cómo se conecta al ERP en el futuro)
Cuando el ERP necesite imágenes, simplemente consulta Supabase:
```js
// Dentro del ERP (Next.js) — NO necesita saber nada de la herramienta local
const { data } = await supabase
  .from('image_bank')
  .select('ml_picture_id, image_index')
  .eq('sku', 'KIT-CADENA-430')
  .eq('sync_status', 'synced')
  .order('image_index');
// → devuelve los picture_id listos para usar en ML
```

---

## 🏗️ Arquitectura General

```
┌──────────────────────┐      ┌─────────────────────┐      ┌──────────────────┐
│  HERRAMIENTA LOCAL    │      │   SUPABASE            │      │  MERCADOLIBRE     │
│  Node.js CLI          │─────▶│   image_bank          │◄────▶│  CDN Pictures    │
│  (proyecto propio)    │      │   (tabla compartida) │      │  picture_id      │
└──────────────────────┘      └─────────────────────┘      └──────────────────┘
         ↑                                  ↑
┌──────────────────────┐      ┌─────────────────────┐
│  D:/Imagenes/         │      │  ERP (Next.js/Vercel) │
│  KIT430-0.jpg         │      │  Consulta image_bank │
│  KIT430-1.jpg         │      │  por SKU al publicar  │
│  ...                  │      └─────────────────────┘
└──────────────────────┘
```

**Flujo completo:**
1. Script local escanea carpeta → registra archivos en `image_bank` (estado: `pending`)
2. Worker sube imágenes a ML API → guarda `picture_id` + URL en Supabase (estado: `synced`)
3. Al publicar en el ERP → consulta `image_bank` por SKU y usa los `picture_id` directamente

---

## 📂 Estructura del Proyecto Local

**Carpeta sugerida:**
```
C:\Users\ORLANDO\Documents\ANTIGRAVITY\ml-image-bank\
│
├── .env                    ← Credenciales (NO versionado)
├── .env.example             ← Plantilla pública
├── .gitignore
├── README.md                ← Instrucciones completas
├── package.json
├── image-config.json        ← Carpeta fuente de imágenes
├── scan-images.js           ← Script 1: inventario local
├── sync-images-to-ml.js     ← Script 2: subida a ML
├── stats.js                 ← Script 3: ver estado actual
└── logs\                    ← Logs de ejecución
```

**`.env` del proyecto local:**
```env
# Supabase (mismas credenciales que el ERP)
SUPABASE_URL=https://zqxesjcchykncxpekmbz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# MercadoLibre (account_id del ERP en Supabase)
MELI_ACCOUNT_ID=uuid-de-la-cuenta-en-meli_accounts

# Carpeta de imágenes (override de image-config.json)
# IMAGE_BANK_FOLDER=D:\Imagenes\MercadoLibre
```

**`package.json` (dependencias mínimas):**
```json
{
  "name": "ml-image-bank",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "scan":  "node scan-images.js",
    "sync":  "node sync-images-to-ml.js",
    "stats": "node stats.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2",
    "dotenv": "^16"
  }
}
```

> [!TIP]
> **Para empezar:** `npm install` → configurar `.env` → `npm run scan` → revisar con `npm run stats` → `npm run sync`

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
- Calcula el **hash MD5** de cada archivo local
- Compara el MD5 con el valor guardado en Supabase (`file_hash`)
- **Solo marca como `pending` las imágenes que cambiaron o son nuevas** — las sin cambios quedan intactas
- No sube nada, solo cataloga
- Al terminar muestra un resumen: nuevas / actualizadas / sin cambios / errores

### 🔁 Lógica de detección de cambios (por imagen)

```
┌─ ¿Existe en image_bank? ─────────────────────────────────────┐
│  NO  → Insertar con sync_status = 'pending'                  │
│  SÍ  → Calcular MD5 del archivo local                        │
│           ¿MD5 igual al guardado?                            │
│           SÍ → No hacer nada (skip)                          │
│           NO → Actualizar file_hash, sync_status = 'changed' │
└──────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Solo se actualizan las imágenes que realmente cambiaron.** Si un archivo `KIT430-0.jpg` tiene el mismo contenido que la última vez que se escaneó, el script lo ignora completamente. Esto hace que re-escanear 30.000 archivos sea rápido y seguro en cualquier momento.

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
- Lee **solo** registros con `sync_status IN ('pending', 'changed')` — nunca toca los `synced`
- Lee la ruta local de cada imagen desde la columna `local_path` guardada en `image_bank`
- Por cada imagen: `POST https://api.mercadolibre.com/pictures` con multipart
- Guarda el `picture_id` + URL retornados en Supabase
- Maneja errores, límite de rate, y reintentos
- Actualiza estado: `synced` | `error`

### 🔁 Lógica de qué se sube

| Estado en DB | ¿Se sube? | Motivo |
|---|---|---|
| `pending` | ✅ Sí | Imagen nueva, nunca subida |
| `changed` | ✅ Sí | Imagen modificada localmente (MD5 cambió) |
| `synced` | ❌ No | Ya está en ML, sin cambios |
| `error` | ❌ No (usar `--retry`) | Falló antes, requiere revisión |
| `local_deleted` | ❌ No | Archivo ya no existe localmente |

> [!IMPORTANT]
> El sync worker **no necesita que le indiques la carpeta** — lee la `local_path` que guardó el scanner en Supabase. Por eso el flujo siempre es: **scan → sync**.

**Control de velocidad:**
```
ML permite ~50 req/min en uploads → 1 imagen cada 1.2 segundos
30.000 imágenes → ~10 horas de carga continua (correr en overnight)
```

**Modos de operación:**
- `--batch 100` — subir solo N imágenes (para pruebas)
- `--sku KIT430` — subir solo imágenes de un SKU específico
- `--retry` — re-intentar imágenes en estado `error`
- `--force` — forzar re-subida de imágenes ya `synced` (solo si cambiaste la imagen y quieres forzar sin re-escanear)
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
