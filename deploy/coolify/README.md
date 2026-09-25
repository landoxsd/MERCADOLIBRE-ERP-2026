# Supabase self-hosted en Coolify / R630

Stack oficial de Supabase para el ERP MercadoLibre en LAN (`192.168.1.88`).

## Por qué no hay un compose completo aquí

El stack oficial incluye Postgres, Kong, GoTrue, PostgREST, Realtime, Storage, Studio, imgproxy, etc. (~15 servicios). Mantener una copia duplicada se desincroniza rápido. Usa el repo oficial y esta carpeta solo para plantillas y overrides.

## Despliegue rápido (SSH en CT 101)

```bash
sudo mkdir -p /opt/supabase && cd /opt/supabase
git clone --depth 1 https://github.com/supabase/supabase.git .
cd docker

# Plantilla de este proyecto (copiar y completar)
cp /ruta/al/repo/deploy/coolify/.env.example .env
# O: cp .env.example .env  && editar con valores seguros

docker compose pull
docker compose up -d
```

Verifica:

- API: `http://192.168.1.88:54321`
- Studio: `http://192.168.1.88:54323`
- Postgres: `192.168.1.88:54322`

## Despliegue vía Coolify (Docker Compose resource)

1. Coolify → **+ New** → **Docker Compose**
2. Source: repositorio `supabase/supabase`, path `docker/`
3. Pega el contenido de `deploy/coolify/.env.example` en **Environment Variables** (ajusta secrets)
4. Deploy

Opcional: monta `docker-compose.supabase.yml` de esta carpeta como **override** si Coolify lo permite, o fusiona los `ports` en el compose del servicio.

## Generar JWT keys

1. Edita `JWT_SECRET` en `.env` (string largo aleatorio).
2. Genera anon y service_role: [Self-hosting Docker — Generate API keys](https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys)
3. Copia `ANON_KEY` y `SERVICE_ROLE_KEY` al `.env` del stack y al `.env.local` / Coolify del Next.js.

## Post-instalación

1. Aplicar SQL en orden — ver `scripts/setup-coolify-r630.md` §3
2. Configurar Windows — `.env.local.example` Opción C
3. (Opcional) Next.js en Coolify — `env.nextjs.example`

## Actualizar Supabase

```bash
cd /opt/supabase/docker
git pull
docker compose pull
docker compose up -d
```

Haz backup de Postgres antes de actualizaciones mayores.

## Archivos en esta carpeta

| Archivo | Uso |
|---------|-----|
| `.env.example` | Variables del stack oficial (`supabase/docker/.env`) |
| `docker-compose.supabase.yml` | Override de puertos LAN (usar con compose oficial) |
| `env.nextjs.example` | Variables para app Next.js en Coolify |

Guía completa: `scripts/setup-coolify-r630.md`
