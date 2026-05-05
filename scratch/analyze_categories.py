import pandas as pd

try:
    df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\lineas sublineas.xlsx')
    print("--- COLUMNS ---")
    print(df.columns.tolist())
    print("--- FIRST 5 ROWS ---")
    print(df.head(5).to_string())
except Exception as e:
    print(f"Error: {e}")
