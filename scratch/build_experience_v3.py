import pandas as pd
import json

print("--- Construyendo Mapa de Experiencia V3 ---")

# 1. Cargar conocimiento masivo
with open(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\scratch\rwc_knowledge_final.json', 'r') as f:
    rwc_data = json.load(f)

# 2. Cargar Maestro para vincular SKU -> Sublinea
try:
    # Segun inspeccion: CODIGO esta en Col 0, CO SUBLINEA en Col 4
    maestro_df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\MAESTRO 20042026.xlsx', skiprows=9)
    
    sku_to_subline = {}
    for _, row in maestro_df.iterrows():
        # Usar indices para mayor seguridad
        sku = str(row.iloc[0]).strip()
        subline = str(row.iloc[4]).strip()
        if sku and subline and sku != 'nan' and subline != 'nan':
            sku_to_subline[sku] = subline

    # 3. Consolidar: Sublinea -> Frecuencia de Categorias
    subline_counts = {}
    
    for item in rwc_data:
        sku = item['sku']
        breadcrumb = item['breadcrumb']
        
        sub = sku_to_subline.get(sku)
        if sub:
            sub = sub.upper()
            if sub not in subline_counts:
                subline_counts[sub] = {}
            
            subline_counts[sub][breadcrumb] = subline_counts[sub].get(breadcrumb, 0) + 1

    # 4. Elegir la mejor categoria por sublinea
    final_experience = {}
    for sub, cats in subline_counts.items():
        # Ordenar por frecuencia
        sorted_cats = sorted(cats.items(), key=lambda x: x[1], reverse=True)
        final_experience[sub] = sorted_cats[0][0] # La mas frecuente

    print(f"Se generaron {len(final_experience)} reglas de oro basadas en 18,858 publicaciones.")
    
    with open(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\scratch\experience_map_v3.json', 'w') as f:
        json.dump(final_experience, f)

except Exception as e:
    print(f"Error construyendo Mapa V3: {e}")
