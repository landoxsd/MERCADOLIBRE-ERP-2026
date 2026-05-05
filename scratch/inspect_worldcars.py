import pandas as pd

try:
    df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\MLWORLDCARS24102025.xlsx', nrows=20)
    for i, row in df.iterrows():
        row_str = " | ".join([str(val) for val in row.values[:15]])
        print(f"ROW {i}: {row_str}")
except Exception as e:
    print(f"Error: {e}")
