import pandas as pd
import re
import json

print("--- Extrayendo Conocimiento de WorldCars ---")

file_path = r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\MLWORLDCARS24102025.xlsx'

try:
    # Leer el archivo (parece que los datos reales empiezan pronto)
    df = pd.read_excel(file_path)
    
    knowledge = []
    
    for index, row in df.iterrows():
        row_str = " | ".join([str(val) for val in row.values])
        
        # 1. Buscar Breadcrumb (Accesorios para Vehiculos > ...)
        breadcrumb = None
        for val in row.values:
            if isinstance(val, str) and "Accesorios para Vehículos" in val and ">" in val:
                breadcrumb = val
                break
        
        # 2. Buscar SKU (CODIGO: XXX)
        sku = None
        # Intentar buscar en toda la fila con regex
        match = re.search(r"CODIGO:\s*([A-Za-z0-9\-\.]+)", row_str, re.IGNORECASE)
        if match:
            sku = match.group(1).strip()
            
        if sku and breadcrumb:
            knowledge.append({
                "sku": sku,
                "breadcrumb": breadcrumb
            })

    print(f"Se extrajeron {len(knowledge)} mapeos SKU -> Categoria.")
    
    # Guardar temporalmente
    with open(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\scratch\worldcars_knowledge.json', 'w') as f:
        json.dump(knowledge, f)

except Exception as e:
    print(f"Error parseando WorldCars: {e}")
