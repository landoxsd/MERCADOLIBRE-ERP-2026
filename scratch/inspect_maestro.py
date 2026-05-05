import pandas as pd

try:
    df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\MAESTRO 20042026.xlsx', nrows=30)
    for i, row in df.iterrows():
        print(f"ROW {i}: {' | '.join([str(val) for val in row.values[:10]])}") # Solo los primeros 10 cols
except Exception as e:
    print(f"Error: {e}")
