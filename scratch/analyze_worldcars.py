import pandas as pd

try:
    df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\MLWORLDCARS24102025.xlsx', nrows=5)
    print("--- COLUMNS WORLDCARS ---")
    print(df.columns.tolist())
    print("--- DATA SAMPLE ---")
    print(df.head(2).to_string())
except Exception as e:
    print(f"Error: {e}")
