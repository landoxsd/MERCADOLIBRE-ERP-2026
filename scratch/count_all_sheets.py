import pandas as pd

try:
    for sheet in ['Hoja1', 'Hoja2', 'Hoja3']:
        df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\rwccompletosinimagenes17042026.xlsx', sheet_name=sheet)
        print(f"Sheet {sheet}: {len(df)} rows")
except Exception as e:
    print(f"Error: {e}")
