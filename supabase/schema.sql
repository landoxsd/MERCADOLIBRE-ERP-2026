-- ================================================================
-- ML ERP - Script de creación de tablas en Supabase
-- Pega este SQL en: supabase.com/dashboard/project/zqxesjcchykncxpekmbz/sql/new
-- ================================================================

-- Habilitar extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------
-- Tabla: Cuentas de Mercado Libre vinculadas (Multicuenta)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meli_accounts (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  meli_user_id    TEXT UNIQUE NOT NULL,
  nickname        TEXT NOT NULL,
  email           TEXT,
  site_id         TEXT DEFAULT 'MLV',

  -- Tokens OAuth (sensibles - manejar con cuidado)
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  token_expiry    TIMESTAMPTZ NOT NULL,

  -- Cookie de sesión para scraping del teléfono (método V4)
  session_cookie  TEXT,
  cookie_expiry   TIMESTAMPTZ
);

-- -----------------------------------------------------------------
-- Tabla: Clientes CRM
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  meli_user_id    TEXT UNIQUE,
  meli_account_id TEXT,
  nickname        TEXT,
  first_name      TEXT,
  last_name       TEXT,
  phone           TEXT,   -- Teléfono obtenido via scraping o manual (V4)
  email           TEXT,
  address         TEXT,
  notes           TEXT,

  total_orders    INTEGER DEFAULT 0,
  total_spent     FLOAT DEFAULT 0,
  last_order_at   TIMESTAMPTZ
);

-- -----------------------------------------------------------------
-- Tabla: Órdenes / Ventas
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  meli_order_id     TEXT UNIQUE NOT NULL,
  meli_account_id   TEXT NOT NULL REFERENCES meli_accounts(id) ON DELETE CASCADE,
  customer_id       TEXT REFERENCES customers(id),

  status            TEXT NOT NULL,   -- 'paid', 'cancelled', 'pending'
  total_amount      FLOAT,
  currency          TEXT DEFAULT 'USD',

  -- Datos del comprador (API oficial)
  buyer_meli_id     TEXT,
  buyer_nickname    TEXT,
  buyer_first_name  TEXT,
  buyer_last_name   TEXT,

  -- Datos del comprador (scraping - módulo V4)
  scraped_phone     TEXT,
  whatsapp_sent     BOOLEAN DEFAULT FALSE,
  internal_notes    TEXT
);

-- -----------------------------------------------------------------
-- Tabla: Items de una Orden
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  meli_item_id    TEXT NOT NULL,
  title           TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      FLOAT NOT NULL,
  cost_price      FLOAT     -- Costo real del vendedor (para EPC neto)
);

-- -----------------------------------------------------------------
-- Tabla: Publicaciones / Productos
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  meli_item_id    TEXT UNIQUE NOT NULL,
  meli_account_id TEXT NOT NULL REFERENCES meli_accounts(id) ON DELETE CASCADE,

  title           TEXT NOT NULL,
  status          TEXT NOT NULL,    -- 'active', 'paused', 'closed'
  price           FLOAT NOT NULL,
  cost_price      FLOAT,            -- Para calcular margen y EPC real
  available_qty   INTEGER DEFAULT 0,
  permalink       TEXT,
  thumbnail       TEXT,

  -- Inteligencia de posicionamiento y especialización
  health_score       FLOAT,             -- Puntaje oficial de salud ML (0 a 1)
  attributes         JSONB,             -- Ficha técnica completa
  category_id        TEXT,
  domain_id          TEXT,
  sku                TEXT,              -- SKU (seller_custom_field en ML)
  last_updated_meli  TIMESTAMPTZ        -- Fecha de última modificación en ML
);

-- -----------------------------------------------------------------
-- Tabla: Aplicaciones de vehículos (Compatibilidad Autopartes)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_compatibilities (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  
  product_id      TEXT REFERENCES products(id) ON DELETE CASCADE,
  meli_item_id    TEXT NOT NULL,

  make            TEXT,   -- Marca (ej. Toyota)
  model           TEXT,   -- Modelo (ej. Corolla)
  year            TEXT,   -- Año (ej. 2015)
  engine          TEXT,   -- Motor
  notes           TEXT    -- Observaciones técnicas
);

-- -----------------------------------------------------------------
-- Tabla: Monitoreo de Competencia
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competitors_tracking (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  product_id          TEXT REFERENCES products(id) ON DELETE CASCADE,
  
  competitor_item_id  TEXT NOT NULL,
  competitor_nickname TEXT,
  price               FLOAT,
  currency            TEXT DEFAULT 'USD',
  last_checked        TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------
-- Tabla: Inventario Interno (Importado desde Excel)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internal_inventory (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  sku             TEXT UNIQUE NOT NULL,
  title           TEXT,
  price           FLOAT,
  stock           FLOAT,
  category        TEXT,           -- Línea de producto
  subcategory     TEXT            -- Sublínea
);

-- -----------------------------------------------------------------
-- Tabla: Preguntas de compradores
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),

  meli_question_id  TEXT UNIQUE NOT NULL,
  meli_account_id   TEXT NOT NULL REFERENCES meli_accounts(id) ON DELETE CASCADE,

  item_id           TEXT NOT NULL,
  text              TEXT NOT NULL,
  status            TEXT NOT NULL,   -- 'UNANSWERED', 'ANSWERED', 'CLOSED'
  buyer_nickname    TEXT,
  answer_text       TEXT,
  answered_at       TIMESTAMPTZ
);

-- -----------------------------------------------------------------
-- Función para actualizar updated_at automáticamente
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a las tablas que tienen updated_at
CREATE OR REPLACE TRIGGER update_meli_accounts_updated_at
  BEFORE UPDATE ON meli_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------------
-- Índices para mejorar el rendimiento de las consultas principales
-- -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_account ON orders(meli_account_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_products_account ON products(meli_account_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_questions_account ON questions(meli_account_id);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);

-- Índices avanzados para Autopartes
CREATE INDEX IF NOT EXISTS idx_compat_product ON product_compatibilities(product_id);
CREATE INDEX IF NOT EXISTS idx_compat_item ON product_compatibilities(meli_item_id);
CREATE INDEX IF NOT EXISTS idx_competitor_prod ON competitors_tracking(product_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_internal_sku ON internal_inventory(sku);

-- ================================================================
-- ✅ Script completado. Las 6 tablas han sido creadas exitosamente.
-- ================================================================
