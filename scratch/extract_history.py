import pandas as pd
import requests
import json
import os

print("--- Extrayendo Historial de Categorias de Supabase ---")

SUPABASE_URL = "https://zqxesjcchykncxpekmbz.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxeGVzamNjaHlrbmN4cGVrbWJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjY1NTMzNywiZXhwIjoyMDkyMjMxMzM3fQ.xrJXFm1WI7rNrDIUeir5IDAfk4Exbhf_k5vzPQzp51I"

# Query para cruzar productos publicados con sus sublineas internas
# Necesitamos: internal_inventory.subcategory y products.category_id
query_sql = """
select 
  inv.subcategory, 
  p.category_id, 
  count(*) as total
from products p
join internal_inventory inv on p.sku = inv.sku
where p.category_id is not null
group by inv.subcategory, p.category_id
order by inv.subcategory, total desc
"""

# Nota: Como no tengo una herramienta directa para SQL puro via REST facil sin RPC,
# voy a intentar traer los datos por separado y cruzarlos en memoria.

def get_history():
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    print("Descargando productos publicados...")
    res_p = requests.get(f"{SUPABASE_URL}/rest/v1/products?select=sku,category_id", headers=headers)
    products = res_p.json()
    
    print("Descargando inventario interno...")
    res_i = requests.get(f"{SUPABASE_URL}/rest/v1/internal_inventory?select=sku,subcategory", headers=headers)
    inventory = res_i.json()
    
    df_p = pd.DataFrame(products)
    df_i = pd.DataFrame(inventory)
    
    if df_p.empty or df_i.empty:
        return {}
        
    # Unir
    merged = pd.merge(df_p, df_i, on='sku')
    
    # Contar categorias por sublinea
    history = {}
    groups = merged.groupby(['subcategory', 'category_id']).size().reset_index(name='count')
    groups = groups.sort_values(['subcategory', 'count'], ascending=[True, False])
    
    for sub in groups['subcategory'].unique():
        best_cat = groups[groups['subcategory'] == sub].iloc[0]['category_id']
        history[sub.strip().upper()] = best_cat
        
    return history

history = get_history()
with open(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\scratch\category_history.json', 'w') as f:
    json.dump(history, f)

print(f"Historial guardado: {len(history)} sublineas mapeadas por experiencia previa.")
