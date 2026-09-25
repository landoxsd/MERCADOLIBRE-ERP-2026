# Coolify + Supabase self-hosted + Next.js ERP — Dell R630 (192.168.1.88)

Guía para desplegar el ERP MercadoLibre con **Supabase en LAN** (sin egress a la nube) y **Next.js** en Coolify o en Windows para publicación con fotos locales.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Windows PC (desarrollo / publicación con fotos)                        │
│  C:\Users\ORLANDO\Pictures\FOTOS  ← SKU.jpg, CARROS/ (fitment)          │
│  npm run dev  →  Next.js :3000  ──HTTP──►  Supabase LAN :54321          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ LAN 192.168.1.x
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Proxmox — Dell R630 (192.168.1.88)                                     │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  LXC CT 101 — Coolify (recomendado: 16 GB RAM, 100 GB, 8 vCPU)   │  │
│  │  • Coolify UI          :8000                                      │  │
│  │  • Stack Supabase       :54321 API, :54323 Studio, :54322 Postgres│  │
│  │  • App Next.js (opt.)   :3000                                     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

| Componente | Dónde vive | Notas |
|------------|------------|-------|
| Postgres + Auth + Storage + Studio | R630 (Docker vía Coolify o CLI) | Datos del ERP, tokens ML, inventario |
| Next.js ERP | Coolify **o** Windows `npm run dev` | Publicación masiva requiere acceso a `FOTOS` |
| Fotos de producto | **Siempre en Windows** | No subir 50 GB+ al servidor; ver sección Fotos |
| Scrapling / Playwright | Windows (opcional) | Scraping antibot desde la PC |

**Estado actual del CT:** 8 GB RAM — funcional para pruebas; **subir a 16 GB** antes de producción (Supabase + Next.js + Coolify compiten por memoria).

---

## 1. Aumentar recursos del CT en Proxmox

1. Apaga el CT 101 desde Proxmox (o `shutdown` dentro del CT).
2. **Datacenter → nodo → CT 101 → Hardware:**
   - **Memory:** 16384 MiB (16 GB)
   - **Cores:** 8
   - **Root disk:** ≥ 100 GB (Supabase + imágenes Docker + logs)
3. Arranca el CT y verifica Coolify: `http://192.168.1.88:8000`

> Si el host R630 tiene poca RAM libre, prioriza 16 GB para el CT antes de levantar el stack completo de Supabase.

---

## 2. Desplegar Supabase (self-hosted)

El stack oficial incluye ~15 contenedores. **No dupliques el compose aquí** — usa el repositorio oficial.

### Opción recomendada: stack Docker en Coolify

1. En el R630 (SSH al CT o consola Proxmox):

```bash
sudo mkdir -p /opt/supabase && cd /opt/supabase
git clone --depth 1 https://github.com/supabase/supabase.git .
cd docker
cp .env.example .env
```

2. Edita `.env` (ver plantilla en `deploy/coolify/.env.example` del proyecto):

   - Cambia **todas** las contraseñas y JWT secrets (no uses valores por defecto en LAN).
   - Genera JWT: [supabase.com/docs/guides/self-hosting/docker#generate-api-keys](https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys)
   - Asegura que los puertos expuestos sean accesibles en LAN (por defecto Docker enlaza `0.0.0.0`).

3. Levanta el stack:

```bash
docker compose pull
docker compose up -d
docker compose ps
```

4. Verifica desde Windows:

   - API: `http://192.168.1.88:54321/rest/v1/` (401 sin key = OK)
   - Studio: `http://192.168.1.88:54323`

### Opción alternativa: Supabase CLI en el servidor

```bash
# En /opt/mercadolibre-erp (clone del repo)
supabase start
supabase status -o env   # copia keys al .env.local de Windows
```

Útil para pruebas; en producción preferir el stack Docker persistente bajo `/opt/supabase/docker`.

### Puertos a exponer (LAN)

| Puerto | Servicio | Uso |
|--------|----------|-----|
| 54321 | Kong / API REST + Auth | `NEXT_PUBLIC_SUPABASE_URL` |
| 54322 | Postgres directo | `DIRECT_URL`, migraciones, `pg_dump` |
| 54323 | Supabase Studio | Admin SQL |
| 8000 | Coolify | Panel de despliegue |

Referencia de override LAN: `deploy/coolify/docker-compose.supabase.yml` y `deploy/coolify/README.md`.

---

## 3. Aplicar migraciones SQL (orden obligatorio)

Igual que en `scripts/setup-supabase-local.md`. Ejecuta en **Studio** (`http://192.168.1.88:54323` → SQL Editor) o con `psql` desde Windows:

```powershell
# Desde la raíz del proyecto (requiere psql en PATH o usar Studio)
$DB = "postgresql://postgres:TU_PASSWORD@192.168.1.88:54322/postgres"
psql $DB -f supabase/schema.sql
psql $DB -f supabase/migration_2026-05-03.sql
psql $DB -f supabase/migration_sniper_2026-05-06.sql
psql $DB -f supabase/migration_radar_mercado_sprint1.sql
psql $DB -f supabase/migration_watchlist_2026-06-07.sql
psql $DB -f supabase/migration_vehicle_catalog_2026.sql
psql $DB -f supabase/category_mappings_569_sublines.sql
```

| Orden | Archivo | Descripción |
|------:|---------|-------------|
| 1 | `supabase/schema.sql` | Tablas base del ERP |
| 2 | `supabase/migration_2026-05-03.sql` | Webhooks, category_mappings |
| 3 | `supabase/migration_sniper_2026-05-06.sql` | Listing Sniper |
| 4 | `supabase/migration_radar_mercado_sprint1.sql` | Seller Spy / Radar |
| 5 | `supabase/migration_watchlist_2026-06-07.sql` | Watchlist competidores |
| 6 | `supabase/migration_vehicle_catalog_2026.sql` | Catálogo vehicular + fitment |
| 7 | `supabase/category_mappings_569_sublines.sql` | Seed de mapeos MLV |

---

## 4. Importar catálogo vehicular (fitment)

Desde **Windows**, con `.env.local` apuntando al R630 (Opción C):

```powershell
cd "C:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia"
npm run import:fitment -- scan
npm run import:fitment -- apply
```

Variables usadas: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DIRECT_URL`.  
Fotos de vehículos: `C:\Users\ORLANDO\Pictures\FOTOS\CARROS` (o `VEHICLE_PHOTOS_DIR`).

---

## 5. Configurar `.env.local` en Windows

```powershell
cp .env.local.example .env.local
```

Activa la **Opción C** (LAN @ 192.168.1.88). Obtén las keys del `.env` del stack Supabase en el servidor o con `supabase status -o env`.

Ejemplo mínimo:

```env
NEXT_PUBLIC_SUPABASE_URL=http://192.168.1.88:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...anon
SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role
SUPABASE_URL=http://192.168.1.88:54321
DIRECT_URL=postgresql://postgres:TU_PASSWORD@192.168.1.88:54322/postgres
MELI_REDIRECT_URI=http://localhost:3000/api/auth/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Arrancar ERP en Windows:

```powershell
npm run dev
```

OAuth ML: registra `http://localhost:3000/api/auth/callback` en [developers.mercadolibre.com](https://developers.mercadolibre.com).

---

## 6. Fotos en Windows (no migrar al servidor)

Las publicaciones leen fotos desde disco local:

- Raíz: `C:\Users\ORLANDO\Pictures\FOTOS`
- Patrones: `SKU.jpg`, `SKU-1.jpg`, …
- Fitment: subcarpeta `CARROS\`

### Flujo recomendado

| Tarea | Dónde ejecutar |
|-------|----------------|
| Dashboard, inventario, SEO, radar | Next.js en Coolify **o** Windows |
| **Publicación masiva con fotos locales** | **Windows** `npm run dev` |
| ML_Desktop_Publisher | Windows (`PHOTOS_PATH` en `publicar_api_directo.js`) |

### Opción Samba (avanzada)

Si insistes en correr Next.js en Coolify pero leer fotos del PC:

1. Comparte `FOTOS` en Windows (SMB).
2. Monta en el CT: `/mnt/fotos` → `//PC-ORLANDO/FOTOS`
3. Variable en Coolify: `PHOTOS_PATH=/mnt/fotos`

Latencia y permisos SMB suelen ser peores que `npm run dev` local; úsalo solo si necesitas el dashboard 24/7 en el servidor.

---

## 7. Desplegar Next.js en Coolify (opcional)

1. Coolify → **New Resource** → **Application** → GitHub/Git (repo del ERP).
2. Build pack: **Nixpacks** o Dockerfile (Node 20+).
3. Build: `npm run build` — Start: `npm run start` — Port: `3000`.
4. Variables: copia desde `deploy/coolify/env.nextjs.example`.
5. Dominio interno: `http://192.168.1.88:3000` o FQDN con proxy Coolify.

**Importante:** sin montaje Samba, la publicación con fotos locales **no funcionará** en el servidor; mantén publicación en Windows.

---

## 8. Firewall

### Windows (cliente)

Permitir salida a `192.168.1.88:54321`, `:54322`, `:54323`, `:8000`.

### Proxmox / CT / ufw en el R630

```bash
# Si usas ufw dentro del CT
sudo ufw allow from 192.168.1.0/24 to any port 54321
sudo ufw allow from 192.168.1.0/24 to any port 54322
sudo ufw allow from 192.168.1.0/24 to any port 54323
sudo ufw allow from 192.168.1.0/24 to any port 8000
sudo ufw allow from 192.168.1.0/24 to any port 3000
```

En el **firewall de Proxmox** (si aplica), abre los mismos puertos hacia la LAN.

> No expongas 54322/54323 a Internet; solo red local.

---

## 9. Migrar datos desde Supabase Cloud

### Exportar (cloud)

```bash
pg_dump "postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:5432/postgres" \
  --no-owner --no-acl -F c -f erp_backup.dump
```

O desde el Dashboard → Database → Backups.

### Restaurar (R630)

```bash
# Copia erp_backup.dump al R630, luego:
pg_restore -d "postgresql://postgres:TU_PASSWORD@127.0.0.1:54322/postgres" \
  --no-owner --no-acl --clean --if-exists erp_backup.dump
```

Desde Windows (con `pg_restore` instalado):

```powershell
pg_restore -d "postgresql://postgres:TU_PASSWORD@192.168.1.88:54322/postgres" `
  --no-owner --no-acl --clean --if-exists erp_backup.dump
```

**Storage (imágenes en bucket):** exporta objetos desde el dashboard cloud y súbelos al bucket `storage` del self-hosted, o re-procesa desde `FOTOS` locales.

**Auth users:** si usas Supabase Auth, migra también el esquema `auth` (incluido en dump completo).

Tras migrar, actualiza `.env.local` / Coolify a las nuevas URLs y JWT keys del self-hosted.

---

## 10. Troubleshooting

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `ECONNREFUSED 192.168.1.88:54321` | Stack caído o firewall | `docker compose ps` en `/opt/supabase/docker`; revisar ufw |
| Studio carga, API no | Kong no healthy | `docker compose logs kong`; reinicia stack |
| `Invalid API key` | JWT del `.env` del servidor ≠ `.env.local` | Regenera keys y sincroniza anon + service_role |
| Migración falla mid-way | Orden SQL incorrecto | Restaura DB y repite tabla de orden §3 |
| `import:fitment apply` timeout | Postgres no accesible en :54322 | Verifica `DIRECT_URL` y password en `.env` del stack |
| OOM / CT lento | 8 GB RAM insuficiente | Subir a 16 GB; limitar contenedores no usados (Inbucket en prod) |
| Publicación sin fotos | Next.js en Coolify sin SMB | Usar `npm run dev` en Windows o montar Samba |
| OAuth ML falla | Redirect URI incorrecta | Debe ser la URL donde corre Next.js (localhost vs IP Coolify) |
| Webhooks ML no llegan | App solo en LAN | Usa túnel (ngrok/cloudflare) o webhooks solo en dev local |

### Comandos útiles en el R630

```bash
cd /opt/supabase/docker
docker compose ps
docker compose logs -f db kong studio
docker compose restart
df -h                    # espacio en disco
free -h                  # RAM
```

### Comandos útiles en Windows

```powershell
curl http://192.168.1.88:54321/rest/v1/
npm run dev
supabase status          # si usas CLI local apuntando al remoto (opcional)
```

---

## Referencias del proyecto

- Supabase local (mismo orden SQL): `scripts/setup-supabase-local.md`
- Fitment: `scripts/README-fitment.md`
- Plantilla env Windows: `.env.local.example` (Opción C)
- Deploy Coolify: `deploy/coolify/README.md`
- Env Next.js Coolify: `deploy/coolify/env.nextjs.example`
