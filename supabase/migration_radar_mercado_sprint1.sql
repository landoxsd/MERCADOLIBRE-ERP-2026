-- ================================================================
-- MIGRACIÓN: Radar de Mercado — Sprint 1 (Seller Spy)
-- Fecha: 2026-05-23
-- ================================================================

-- 1. Sesiones de espionaje de cuentas completas de competidores
CREATE TABLE IF NOT EXISTS seller_spy_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id         TEXT NOT NULL,
  seller_nickname   TEXT,
  seller_level      TEXT,           -- 'platinum', 'gold', 'silver', etc.
  account_id        UUID,           -- cuenta ML que hizo el escaneo
  scanned_at        TIMESTAMPTZ DEFAULT NOW(),
  total_items       INT DEFAULT 0,
  total_sold_qty    BIGINT DEFAULT 0,
  total_revenue_usd NUMERIC(12,2) DEFAULT 0,
  avg_price         NUMERIC(10,2) DEFAULT 0,
  avg_health        NUMERIC(5,2) DEFAULT 0,
  avg_conversion    NUMERIC(5,4) DEFAULT 0,
  pct_free_shipping NUMERIC(5,2) DEFAULT 0,
  pct_local_pickup  NUMERIC(5,2) DEFAULT 0,
  pct_gold_listing  NUMERIC(5,2) DEFAULT 0,
  pct_catalog       NUMERIC(5,2) DEFAULT 0,
  top_category_id   TEXT,
  top_category_name TEXT,
  categories_json   JSONB,          -- resumen de ingresos por categoría
  raw_summary       JSONB
);

CREATE INDEX IF NOT EXISTS idx_seller_spy_sessions_seller_id ON seller_spy_sessions(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_spy_sessions_scanned_at ON seller_spy_sessions(scanned_at DESC);

-- 2. Items individuales de cada sesión espía
CREATE TABLE IF NOT EXISTS seller_spy_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES seller_spy_sessions(id) ON DELETE CASCADE,
  ml_item_id        TEXT NOT NULL,
  title             TEXT,
  brand             TEXT,
  sku               TEXT,
  category_id       TEXT,
  category_name     TEXT,
  price_usd         NUMERIC(10,2) DEFAULT 0,
  sold_quantity     INT DEFAULT 0,
  visits            INT DEFAULT 0,
  conversion_rate   NUMERIC(5,4) DEFAULT 0,
  available_quantity INT DEFAULT 0,
  pictures_count    INT DEFAULT 0,
  health_score      NUMERIC(5,2),
  has_free_shipping BOOLEAN DEFAULT FALSE,
  has_local_pickup  BOOLEAN DEFAULT FALSE,
  listing_type_id   TEXT,
  permalink         TEXT,
  thumbnail         TEXT,
  revenue_usd       NUMERIC(12,2) DEFAULT 0,
  market_share_pct  NUMERIC(5,2) DEFAULT 0,
  is_paused         BOOLEAN DEFAULT FALSE,
  date_created      DATE,
  attributes_raw    JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_spy_items_session_id ON seller_spy_items(session_id);
CREATE INDEX IF NOT EXISTS idx_seller_spy_items_ml_item_id ON seller_spy_items(ml_item_id);
CREATE INDEX IF NOT EXISTS idx_seller_spy_items_revenue ON seller_spy_items(revenue_usd DESC);

-- 3. Snapshots del Radar de Categorías (semáforos de nichos)
CREATE TABLE IF NOT EXISTS category_radar_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id       TEXT NOT NULL,
  category_name     TEXT,
  site_id           TEXT DEFAULT 'MLV',
  scanned_at        TIMESTAMPTZ DEFAULT NOW(),
  total_items       INT DEFAULT 0,
  total_sellers     INT DEFAULT 0,
  total_sold_qty    BIGINT DEFAULT 0,
  total_revenue_usd NUMERIC(14,2) DEFAULT 0,
  avg_price         NUMERIC(10,2) DEFAULT 0,
  avg_health        NUMERIC(5,2) DEFAULT 0,
  trend_pct         NUMERIC(6,2),   -- variación % vs snapshot anterior
  trend_label       TEXT            -- 'hot','growing','stable','declining'
);

CREATE INDEX IF NOT EXISTS idx_category_radar_category_id ON category_radar_snapshots(category_id);
CREATE INDEX IF NOT EXISTS idx_category_radar_scanned_at ON category_radar_snapshots(scanned_at DESC);

-- 4. Keywords por categoría
CREATE TABLE IF NOT EXISTS category_keywords (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      TEXT NOT NULL,
  keyword          TEXT NOT NULL,
  search_volume    INT DEFAULT 0,
  conversion_items INT DEFAULT 0,
  top_item_id      TEXT,
  top_item_title   TEXT,
  scanned_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_category_keywords_category_id ON category_keywords(category_id);
