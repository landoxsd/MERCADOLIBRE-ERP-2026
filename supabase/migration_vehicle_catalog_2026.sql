-- ================================================================
-- MIGRACIÓN: Catálogo de Vehículos + Fitment por SKU
-- Publicador de Calidad v2 — Sprint 2
-- Fecha: 2026-08-29
-- ================================================================

CREATE TABLE IF NOT EXISTS public.vehicle_catalog (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    make            TEXT NOT NULL,
    model           TEXT NOT NULL,
    year_from       INTEGER NOT NULL,
    year_to         INTEGER NOT NULL,
    variant         TEXT,
    photo_local_path TEXT,
    ml_picture_id   TEXT,
    search_key      TEXT NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sku_vehicle_fitment (
    sku         TEXT NOT NULL,
    vehicle_id  UUID NOT NULL REFERENCES public.vehicle_catalog(id) ON DELETE CASCADE,
    source      TEXT DEFAULT 'manual',
    created_at  TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (sku, vehicle_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_catalog_make_model ON public.vehicle_catalog(make, model);
CREATE INDEX IF NOT EXISTS idx_sku_fitment_sku ON public.sku_vehicle_fitment(sku);

-- -----------------------------------------------------------------
-- Seed: modelos populares en Venezuela (10-15)
-- Coloca fotos en: {photosPath}/CARROS/{photo_local_path}
-- Ejemplo: C:\Users\ORLANDO\Pictures\FOTOS\CARROS\toyota-corolla.jpg
-- También acepta photosPath apuntando directamente a la carpeta CARROS.
-- -----------------------------------------------------------------
INSERT INTO public.vehicle_catalog (make, model, year_from, year_to, variant, photo_local_path, search_key)
VALUES
    ('TOYOTA',   'COROLLA',   2010, 2018, 'Sedán',     'toyota-corolla.jpg',     'TOYOTA|COROLLA|2010'),
    ('TOYOTA',   'HILUX',     2012, 2020, '4x4',       'toyota-hilux.jpg',       'TOYOTA|HILUX|2012'),
    ('MITSUBISHI','LANCER',   2008, 2017, NULL,        'mitsubishi-lancer.jpg',  'MITSUBISHI|LANCER|2008'),
    ('FORD',     'EXPLORER',  2011, 2019, NULL,        'ford-explorer.jpg',      'FORD|EXPLORER|2011'),
    ('CHEVROLET','AVEO',      2008, 2018, NULL,        'chevrolet-aveo.jpg',     'CHEVROLET|AVEO|2008'),
    ('CHEVROLET','SPARK',     2010, 2018, NULL,        'chevrolet-spark.jpg',    'CHEVROLET|SPARK|2010'),
    ('HYUNDAI',  'ACCENT',    2012, 2019, NULL,        'hyundai-accent.jpg',     'HYUNDAI|ACCENT|2012'),
    ('NISSAN',   'SENTRA',    2013, 2019, NULL,        'nissan-sentra.jpg',      'NISSAN|SENTRA|2013'),
    ('MAZDA',    '3',         2010, 2018, 'Sedán',     'mazda-3.jpg',            'MAZDA|3|2010'),
    ('HONDA',    'CIVIC',     2012, 2020, NULL,        'honda-civic.jpg',        'HONDA|CIVIC|2012'),
    ('JEEP',     'CHEROKEE',  2014, 2020, 'KL',        'jeep-cherokee.jpg',      'JEEP|CHEROKEE|2014'),
    ('KIA',      'RIO',       2012, 2019, NULL,        'kia-rio.jpg',            'KIA|RIO|2012'),
    ('RENAULT',  'LOGAN',     2010, 2018, NULL,        'renault-logan.jpg',      'RENAULT|LOGAN|2010'),
    ('FIAT',     'UNO',       2010, 2016, NULL,        'fiat-uno.jpg',           'FIAT|UNO|2010'),
    ('VOLKSWAGEN','GOL',      2010, 2018, NULL,        'volkswagen-gol.jpg',     'VOLKSWAGEN|GOL|2010')
ON CONFLICT (search_key) DO NOTHING;
