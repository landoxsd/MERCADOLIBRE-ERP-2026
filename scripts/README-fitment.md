# Importador de fitment vehicular (CARROS → Supabase)

Script CLI para poblar `vehicle_catalog` desde la biblioteca de fotos de aplicación vehicular y vincular SKUs del ERP en `sku_vehicle_fitment`.

## Requisitos

- Node.js 18+
- Fotos en `C:\Users\ORLANDO\Pictures\FOTOS\CARROS` (o ruta personalizada)
- Migración aplicada: `supabase/migration_vehicle_catalog_2026.sql`
- Para modo `apply`: variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`

## Comandos

### 1. Escanear fotos (`scan`)

Lee todos los `.jpg`, `.jpeg`, `.png` y genera SQL con upsert:

```bash
npm run import:fitment -- scan
```

Opciones:

```bash
npm run import:fitment -- scan --dir "D:\MisFotos\CARROS"
npm run import:fitment -- scan --out supabase/mi_catalogo.sql
```

**Salida:**

- `supabase/import_vehicle_catalog_from_carros.sql` — INSERT … ON CONFLICT (search_key) DO UPDATE
- `supabase/import_vehicle_catalog_report.json` — resumen (total, omitidos, sin marca)

**Convención de nombres soportada:**

| Archivo | Resultado |
|---------|-----------|
| `4RUNNER 96-01.jpg` | TOYOTA, 4RUNNER, 1996–2001 |
| `ACCENT 2007-2009.jpg` | HYUNDAI, ACCENT, 2007–2009 |
| `AVEO 1.6 LT SEDÁN 2011-2015.jpg` | CHEVROLET, AVEO, variant=1.6 LT SEDÁN |
| `1968-ford-mustang.jpg` | FORD, MUSTANG, 1968 |
| `ASTRA 2.0 2001-2005.jpg` | CHEVROLET, ASTRA, variant=2.0 |

Se omiten archivos sin patrón vehicular (códigos sueltos, letras sueltas, plantillas).

`photo_local_path` guarda el **nombre exacto del archivo** (con espacios), tal como lo usa el ERP.

### 2. Vincular SKUs (`link`)

Extrae pistas vehiculares del título/descripción de Profit y genera fitment:

```bash
npm run import:fitment -- link --excel listado_marcas_profit.xlsx
npm run import:fitment -- link --csv articulos.csv
```

**Salida:** `supabase/import_sku_vehicle_fitment.sql`

Ejecuta `scan` antes para tener el catálogo disponible.

### 3. Aplicar a Supabase (`apply`)

```bash
npm run import:fitment -- apply
```

- Con credenciales en `.env.local`: upsert directo vía `@supabase/supabase-js`
- Sin credenciales: muestra instrucciones para pegar el SQL en Supabase → SQL Editor

## Flujo recomendado

```bash
# 1. Generar catálogo desde fotos
npm run import:fitment -- scan

# 2. (Opcional) Vincular SKUs desde Excel Profit
npm run import:fitment -- link --excel listado_marcas_profit.xlsx

# 3. Subir a Supabase
npm run import:fitment -- apply
```

## Variable de entorno

| Variable | Descripción |
|----------|-------------|
| `VEHICLE_PHOTOS_DIR` | Ruta a carpeta CARROS (default: `Pictures\FOTOS\CARROS`) |

## Tablas afectadas

- `vehicle_catalog` — make, model, year_from, year_to, variant, photo_local_path, search_key
- `sku_vehicle_fitment` — sku ↔ vehicle_id
