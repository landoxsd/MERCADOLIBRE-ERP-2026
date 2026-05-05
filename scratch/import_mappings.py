import pandas as pd
import requests
import json
import os

print("--- Iniciando Importacion de Mapeos a Supabase ---")

# Configuración desde el .env (leído manualmente para evitar dependencias extra)
SUPABASE_URL = "https://zqxesjcchykncxpekmbz.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxeGVzamNjaHlrbmN4cGVrbWJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjY1NTMzNywiZXhwIjoyMDkyMjMxMzM3fQ.xrJXFm1WI7rNrDIUeir5IDAfk4Exbhf_k5vzPQzp51I"

input_file = r"c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\mapeo_categorias_inteligente.xlsx"

try:
    df = pd.read_excel(input_file)
    print(f"Leidas {len(df)} filas del Excel.")

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates" # Para manejar el UNIQUE constraint
    }

    batch_size = 50
    records = []

    for index, row in df.iterrows():
        # Limpiar datos
        line_code = str(row.get('CODIGO LINEA', '')).strip()
        subline_code = str(row.get('CODIGO SUB LINEA', '')).strip()
        subline_name = str(row.get('SUB LINEA', '')).strip()
        ml_cat_id = str(row.get('ML_CATEGORY_ID', '')).strip()
        ml_cat_name = str(row.get('CATEGORIA ML ENCONTRADA', '')).strip()
        
        if ml_cat_id == "N/A" or not ml_cat_id:
            continue

        records.append({
            "internal_line_code": line_code,
            "internal_subline_code": subline_code,
            "internal_name": subline_name,
            "ml_category_id": ml_cat_id,
            "ml_category_name": ml_cat_name,
            "is_validated": False # Se marcan como pendientes de revision manual
        })

        if len(records) >= batch_size:
            print(f"Subiendo lote de {len(records)} registros...")
            res = requests.post(f"{SUPABASE_URL}/rest/v1/category_mappings", headers=headers, data=json.dumps(records))
            if res.status_code not in [200, 201]:
                print(f"Error en lote: {res.text}")
            records = []

    # Ultimo lote
    if records:
        print(f"Subiendo ultimo lote de {len(records)} registros...")
        res = requests.post(f"{SUPABASE_URL}/rest/v1/category_mappings", headers=headers, data=json.dumps(records))
        if res.status_code not in [200, 201]:
            print(f"Error en ultimo lote: {res.text}")

    print("\n--- IMPORTACION COMPLETADA ---")

except Exception as e:
    print(f"Error general: {e}")
