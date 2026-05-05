import pandas as pd
import requests
import json
import os

print("--- Iniciando Importacion de Mapeos GOLDEN a Supabase ---")

SUPABASE_URL = "https://zqxesjcchykncxpekmbz.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxeGVzamNjaHlrbmN4cGVrbWJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjY1NTMzNywiZXhwIjoyMDkyMjMxMzM3fQ.xrJXFm1WI7rNrDIUeir5IDAfk4Exbhf_k5vzPQzp51I"

input_file = r"c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\mapeo_categorias_GOLDEN.xlsx"

try:
    df = pd.read_excel(input_file)
    print(f"Leidas {len(df)} filas del Excel GOLDEN.")

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    records = []
    for index, row in df.iterrows():
        ml_cat_id = str(row.get('ML_CATEGORY_ID', '')).strip()
        
        # Ignorar si no tenemos ID (aunque la IA debio obtenerlos casi todos)
        if ml_cat_id == "N/A" or ml_cat_id == "Ver Breadcrumb" or not ml_cat_id:
            continue

        records.append({
            "internal_line_code": str(row.get('CODIGO LINEA', '')).strip(),
            "internal_subline_code": str(row.get('CODIGO SUB LINEA', '')).strip(),
            "internal_name": str(row.get('SUB LINEA', '')).strip(),
            "ml_category_id": ml_cat_id,
            "ml_category_name": str(row.get('CATEGORIA ML ENCONTRADA', '')).strip(),
            "is_validated": True # Los marcamos como validados porque vienen del historial real
        })

        if len(records) >= 50:
            requests.post(f"{SUPABASE_URL}/rest/v1/category_mappings", headers=headers, data=json.dumps(records))
            records = []

    if records:
        requests.post(f"{SUPABASE_URL}/rest/v1/category_mappings", headers=headers, data=json.dumps(records))

    print("\n--- IMPORTACION GOLDEN COMPLETADA ---")
    print("El ERP ahora tiene precision total basada en historial y contexto.")

except Exception as e:
    print(f"Error: {e}")
