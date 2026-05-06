-- ================================================================
-- MIGRACIÓN: Listing Sniper V3 — Inteligencia Competitiva MLV
-- Fecha: 2026-05-06
-- ================================================================

-- ================================================================
-- 1. SNAPSHOTS TEMPORALES (Con batching para análisis histórico)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.mlv_market_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_batch_id UUID NOT NULL,
    search_query TEXT NOT NULL,
    our_product_sku TEXT REFERENCES public.internal_inventory(sku),
    our_ml_item_id TEXT,
    
    -- Datos del competidor (públicos)
    ml_item_id TEXT NOT NULL,
    title TEXT NOT NULL,
    price_usd DECIMAL(12,2),
    available_quantity INTEGER,
    sold_quantity INTEGER DEFAULT 0,
    sold_since DATE,
    condition TEXT CHECK (condition IN ('new', 'used', 'refurbished')),
    listing_type_id TEXT,
    permalink TEXT,
    
    -- Vendedor
    seller_id TEXT,
    seller_nickname TEXT,
    seller_reputation_level TEXT,
    seller_power_seller TEXT,
    
    -- Métricas de calidad
    health_score INTEGER,
    health_level TEXT,
    pictures_count INTEGER DEFAULT 0,
    attributes_count INTEGER DEFAULT 0,
    has_description BOOLEAN DEFAULT false,
    description_text TEXT,
    
    -- Logística MLV específica (scraping lógico)
    logistics_data JSONB DEFAULT '{
        "pickup_zones": [],
        "delivery_methods": [],
        "seller_city": null,
        "seller_state": null,
        "local_pickup": false,
        "spam_words_detected": []
    }',
    
    -- Datos crudos (para debug y análisis profundo)
    raw_api_response JSONB,
    
    -- Posicionamiento
    search_position INTEGER,
    search_sort_used TEXT DEFAULT 'relevance_then_sales',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT unique_snapshot_per_batch UNIQUE(snapshot_batch_id, ml_item_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_batch ON mlv_market_snapshots(snapshot_batch_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_query ON mlv_market_snapshots(search_query);
CREATE INDEX IF NOT EXISTS idx_snapshots_sku ON mlv_market_snapshots(our_product_sku);
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON mlv_market_snapshots(created_at DESC);

-- ================================================================
-- 2. ANÁLISIS COMPARATIVO Y PLAN DE ACCIÓN
-- ================================================================
CREATE TABLE IF NOT EXISTS public.mlv_competitive_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_batch_id UUID NOT NULL,
    our_product_sku TEXT NOT NULL,
    our_ml_item_id TEXT,
    competitor_item_id TEXT NOT NULL,
    
    -- Scoring dimensional (0-100)
    score_total INTEGER,
    score_breakdown JSONB DEFAULT '{
        "price": 0,
        "seo_title": 0,
        "photos": 0,
        "attributes": 0,
        "logistics": 0,
        "health": 0,
        "reputation": 0
    }',
    
    -- Gaps específicos
    price_gap_percent DECIMAL(5,2),
    missing_attributes TEXT[],
    missing_photos_count INTEGER,
    title_issues TEXT[],
    
    -- Plan de acción enriquecido
    action_plan JSONB DEFAULT '[]',
    
    -- Referencias al líder
    leader_item_id TEXT,
    leader_price DECIMAL(12,2),
    leader_sold_quantity INTEGER,
    analysis_mode TEXT DEFAULT 'auto',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_batch ON mlv_competitive_analysis(snapshot_batch_id);
CREATE INDEX IF NOT EXISTS idx_analysis_sku ON mlv_competitive_analysis(our_product_sku);

-- ================================================================
-- 3. HISTORIAL DE POSICIONES (Tracking temporal)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.mlv_position_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    our_ml_item_id TEXT NOT NULL,
    our_product_sku TEXT NOT NULL,
    search_query TEXT NOT NULL,
    
    position_previous INTEGER,
    position_current INTEGER,
    snapshot_batch_id UUID,
    
    actions_applied JSONB,
    market_context JSONB,
    
    recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poshist_item ON mlv_position_history(our_ml_item_id);
CREATE INDEX IF NOT EXISTS idx_poshist_query ON mlv_position_history(search_query);
CREATE INDEX IF NOT EXISTS idx_poshist_batch ON mlv_position_history(snapshot_batch_id);

-- ================================================================
-- 4. IMÁGENES DE REFERENCIA (Para el feature de "buscar fotos")
-- ================================================================
CREATE TABLE IF NOT EXISTS public.competitor_image_refs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ml_item_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    image_order INTEGER,
    is_primary BOOLEAN DEFAULT false,
    analysis_metadata JSONB DEFAULT '{}',
    captured_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_img_refs_item ON competitor_image_refs(ml_item_id);

-- ================================================================
-- 5. TRIGGER PARA updated_at en mlv_competitive_analysis
-- ================================================================
CREATE OR REPLACE TRIGGER update_mlv_competitive_analysis_updated_at
  BEFORE UPDATE ON mlv_competitive_analysis FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ================================================================
-- ✅ Migración completada.
-- ================================================================
