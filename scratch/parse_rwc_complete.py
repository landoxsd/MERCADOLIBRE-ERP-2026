import pandas as pd
import json

print("--- Procesando Archivo RWC Completo (V2 - Fix Encoding) ---")

file_path = r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\rwccompletosinimagenes17042026.xlsx'

try:
    # Leer el archivo completo
    df = pd.read_excel(file_path)
    
    knowledge = []
    
    for index, row in df.iterrows():
        # Extraer valores y asegurar que no sean NaN
        breadcrumb = str(row.iloc[3]) if pd.notnull(row.iloc[3]) else ""
        sku = str(row.iloc[9]) if pd.notnull(row.iloc[9]) else ""
        
        # Filtro flexible: que tenga estructura de categoria y algo de vehiculos
        if ">" in breadcrumb and ("Accesorios" in breadcrumb or "Repuestos" in breadcrumb):
            knowledge.append({
                "sku": sku.strip(),
                "breadcrumb": breadcrumb.strip()
            })

    print(f"Se extrajeron {len(knowledge)} mapeos SKU -> Categoria con el filtro flexible.")
    
    # Guardar conocimiento consolidado
    with open(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\scratch\rwc_knowledge.json', 'w') as f:
        json.dump(knowledge, f)

except Exception as e:
    print(f"Error parseando RWC Completo: {e}")
