# Supabase local — guía rápida

Desarrollo con Postgres en tu máquina (sin egress a la nube de Supabase).

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) en ejecución
- [Supabase CLI](https://supabase.com/docs/guides/cli): `npm install -g supabase` o `scoop install supabase`
- Node.js 18+ (para `npm run import:fitment`)

## 1. Inicializar y arrancar

Desde la raíz del proyecto:

```bash
supabase init          # solo la primera vez (crea supabase/config.toml)
supabase start
supabase status        # copia API URL, anon key, service_role key y DB URL
```

## 2. Aplicar esquema y migraciones SQL

Ejecuta en orden en el **SQL Editor** de Studio (`http://127.0.0.1:54323`) o con `psql` usando la `DB URL` de `supabase status`:

| Orden | Archivo | Descripción |
|------:|---------|-------------|
| 1 | `supabase/schema.sql` | Tablas base del ERP |
| 2 | `supabase/migration_2026-05-03.sql` | Webhooks, category_mappings |
| 3 | `supabase/migration_sniper_2026-05-06.sql` | Listing Sniper |
| 4 | `supabase/migration_radar_mercado_sprint1.sql` | Seller Spy / Radar |
| 5 | `supabase/migration_watchlist_2026-06-07.sql` | Watchlist competidores |
| 6 | `supabase/migration_vehicle_catalog_2026.sql` | Catálogo vehicular + fitment |
| 7 | `supabase/category_mappings_569_sublines.sql` | Seed de mapeos MLV |

Con `psql` (ejemplo):

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/schema.sql
# repetir -f para cada archivo en la tabla
```

## 3. Catálogo vehicular (opcional)

Si tienes fotos en la carpeta CARROS:

```bash
npm run import:fitment -- scan
npm run import:fitment -- apply
```

`apply` usa `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` y `DIRECT_URL` para el SQL de fitment por SKU.

## 4. Configurar `.env.local`

```bash
cp .env.local.example .env.local
```

Pega las claves de `supabase status` en la sección **Opción B** (comenta la Opción A si usas solo local):

- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → anon key
- `SUPABASE_SERVICE_ROLE_KEY` → service_role key
- `DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`

## 5. Arrancar la app

```bash
npm run dev
```

OAuth ML: `MELI_REDIRECT_URI=http://localhost:3000/api/auth/callback` (debe coincidir con la app en [developers.mercadolibre.com](https://developers.mercadolibre.com)).

## Comandos útiles

```bash
supabase stop          # detener contenedores
supabase db reset      # borrar y recrear DB (si usas migraciones CLI)
supabase status -o env # exportar variables en formato .env
```
