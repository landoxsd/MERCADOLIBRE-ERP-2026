import pandas as pd
import json

print("--- Extrayendo Conocimiento Masivo de Hoja3 ---")

file_path = r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\rwccompletosinimagenes17042026.xlsx'

try:
    # Leer Hoja3
    df = pd.read_excel(file_path, sheet_name='Hoja3')
    
    knowledge = []
    
    for index, row in df.iterrows():
        # Usar nombres de columnas si estan disponibles, sino indices
        breadcrumb = str(row.get('Categoría', row.iloc[3])).strip()
        sku = str(row.get('SKU', row.iloc[10])).strip()
        
        if breadcrumb and sku and ">" in breadcrumb:
            knowledge.append({
                "sku": sku,
                "breadcrumb": breadcrumb
            })

    print(f"Se extrajeron {len(knowledge)} mapeos SKU -> Categoria de Hoja3.")
    
    with open(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\scratch\rwc_knowledge_final.json', 'w') as f:
        json.dump(knowledge, f)

except Exception as e:
    print(f"Error parseando Hoja3: {e}")
