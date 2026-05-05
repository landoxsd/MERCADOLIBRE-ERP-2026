import pandas as pd
import requests
import time
import urllib.parse
from difflib import SequenceMatcher

print("DEBUG: Iniciando script...")

def predict_category_smart(query):
    try:
        safe_query = urllib.parse.quote(query)
        url = f"https://api.mercadolibre.com/sites/MLV/domain_discovery/search?q={safe_query}"
        response = requests.get(url, timeout=10)
        data = response.json()
        if not isinstance(data, list) or len(data) == 0:
            return "No encontrada", "N/A", 0
        best_candidate = (data[0].get('category_name'), data[0].get('category_id'), 80)
        return best_candidate
    except Exception as e:
        return f"Error: {str(e)}", "N/A", 0

input_file = r"c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\lineas sublineas.xlsx"
output_path = r"c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\mapeo_test.xlsx"

try:
    print(f"DEBUG: Cargando Excel {input_file}...")
    df = pd.read_excel(input_file, skiprows=5)
    print(f"DEBUG: Excel cargado. Columnas: {df.columns.tolist()}")
    
    df.columns = [c.strip() if isinstance(c, str) else c for c in df.columns]
    df = df.dropna(subset=['SUB LINEA'])
    
    # Probar solo con los primeros 5
    test_df = df.head(5)
    print(f"DEBUG: Procesando TEST de 5 sublíneas...")

    results = []
    for index, row in test_df.iterrows():
        name = str(row['SUB LINEA']).strip()
        print(f"DEBUG: Mapeando {name}...")
        cat_name, cat_id, conf = predict_category_smart(name)
        results.append({
            'SUB LINEA': name,
            'ML_CAT': cat_name,
            'CONF': conf
        })
    
    pd.DataFrame(results).to_excel(output_path, index=False)
    print(f"DEBUG: Test completado. Archivo: {output_path}")

except Exception as e:
    print(f"DEBUG ERROR: {e}")
