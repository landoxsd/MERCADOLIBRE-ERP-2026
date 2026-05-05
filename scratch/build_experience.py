import pandas as pd
import json

print("--- Cruzando WorldCars con Maestro para obtener Sublineas ---")

# 1. Cargar conocimiento de WorldCars (SKU -> Breadcrumb)
with open(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\scratch\worldcars_knowledge.json', 'r') as f:
    worldcars_data = json.load(f)

# 2. Cargar Maestro para vincular SKU -> Sublinea
try:
    # Segun inspeccion previa, los datos empiezan en la fila 10 (skiprows=9)
    # Columnas: CODIGO (SKU), CO SUBLINEA (Nombre de sublinea)
    maestro_df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\MAESTRO 20042026.xlsx', skiprows=9)
    maestro_df.columns = [c.strip() if isinstance(c, str) else c for c in maestro_df.columns]
    
    # Crear dict de SKU -> Sublinea
    sku_to_subline = {}
    for _, row in maestro_df.iterrows():
        sku = str(row.get('CODIGO', '')).strip()
        subline = str(row.get('CO SUBLINEA', '')).strip()
        if sku and subline:
            sku_to_subline[sku] = subline

    # 3. Consolidar: Sublinea -> Lista de Breadcrumbs
    subline_to_categories = {}
    
    for item in worldcars_data:
        sku = item['sku']
        breadcrumb = item['breadcrumb']
        
        subline = sku_to_subline.get(sku)
        if subline:
            if subline not in subline_to_categories:
                subline_to_categories[subline] = []
            subline_to_categories[subline].append(breadcrumb)

    # 4. Elegir la categoria mas frecuente por sublinea
    experience_map = {}
    for sub, cats in subline_to_categories.items():
        most_common = max(set(cats), key=cats.count)
        experience_map[sub.upper()] = most_common

    print(f"Se generaron {len(experience_map)} reglas de experiencia basadas en WorldCars.")
    
    with open(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\scratch\experience_map.json', 'w') as f:
        json.dump(experience_map, f)

except Exception as e:
    print(f"Error en el cruce: {e}")
