import pandas as pd

try:
    df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\rwccompletosinimagenes17042026.xlsx', sheet_name='Hoja3', nrows=5)
    row = df.iloc[0]
    for i, val in enumerate(row):
        print(f"COL {i}: {val}")
except Exception as e:
    print(f"Error: {e}")
