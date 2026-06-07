-- ==========================================================================================
-- SPRINT 7: RADAR DE EVOLUCIÓN COMPETITIVA (WATCHLIST Y TIMESERIES)
-- Ejecutar en el SQL Editor de Supabase
-- ==========================================================================================

-- Habilitar extensión UUID si no existe
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla Madre: Directorio de Competidores (Watchlist)
CREATE TABLE public.seller_watchlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id BIGINT NOT NULL, -- Cuenta de nuestro ERP que hace el tracking
    seller_id BIGINT NOT NULL,  -- ID del competidor en MLV
    seller_nickname TEXT NOT NULL,
    permalink TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(account_id, seller_id) -- No seguir dos veces al mismo competidor por cuenta
);

-- Habilitar RLS en Watchlist
ALTER TABLE public.seller_watchlist ENABLE ROW LEVEL SECURITY;
-- Política: Solo servicio admin u operations (Permitir todo temporalmente si se usa supabaseAdmin)
CREATE POLICY "Enable ALL for service-role" ON public.seller_watchlist USING (true);


-- 2. Tabla Hija: Histórico (Snapshots) para Gráficas de Evolución
CREATE TABLE public.seller_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    watchlist_id UUID NOT NULL REFERENCES public.seller_watchlist(id) ON DELETE CASCADE,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Métricas Financieras/Operativas del Snapshot
    total_items INT DEFAULT 0,
    total_revenue_usd NUMERIC(12,2) DEFAULT 0,
    avg_price NUMERIC(10,2) DEFAULT 0,
    pct_free_shipping NUMERIC(5,2) DEFAULT 0,
    power_seller_status TEXT,
    
    -- Insights JSON
    top_products JSONB DEFAULT '[]'::jsonb,
    category_distribution JSONB DEFAULT '{}'::jsonb
);

-- Habilitar RLS en Snapshots
ALTER TABLE public.seller_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable ALL for service-role" ON public.seller_snapshots USING (true);

-- 3. Índices de Rendimiento para Consultas Timeseries
CREATE INDEX idx_snapshots_watchlist ON public.seller_snapshots(watchlist_id);
CREATE INDEX idx_snapshots_date ON public.seller_snapshots(scanned_at DESC);

-- Opcional: Función para auto-actualizar el `updated_at` de watchlist
CREATE OR REPLACE FUNCTION update_watchlist_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_watchlist
BEFORE UPDATE ON public.seller_watchlist
FOR EACH ROW
EXECUTE PROCEDURE update_watchlist_timestamp();
