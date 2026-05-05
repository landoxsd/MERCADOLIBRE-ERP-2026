import pandas as pd
import json

# 1. Cargar conocimiento de WorldCars
with open(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\scratch\worldcars_knowledge.json', 'r') as f:
    worldcars_data = json.load(f)

print("--- WORLDCARS SKUS (Sample) ---")
print([item['sku'] for item in worldcars_data[:10]])

# 2. Cargar Maestro SKUs
try:
    maestro_df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\MAESTRO 20042026.xlsx', skiprows=9, nrows=20)
    print("--- MAESTRO SKUS (Sample) ---")
    print(maestro_df['CODIGO'].tolist())
except Exception as e:
    print(f"Error: {e}")
