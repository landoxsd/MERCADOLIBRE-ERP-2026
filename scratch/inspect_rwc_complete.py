import pandas as pd

try:
    df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\rwccompletosinimagenes17042026.xlsx', nrows=10)
    print("--- COLUMNS RWC COMPLET ---")
    print(df.columns.tolist())
    for i, row in df.iterrows():
        print(f"ROW {i}: {' | '.join([str(val) for val in row.values[:10]])}")
except Exception as e:
    print(f"Error: {e}")
