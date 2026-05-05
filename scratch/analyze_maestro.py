import pandas as pd

try:
    df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\MAESTRO 20042026.xlsx', nrows=5)
    print("--- COLUMNS MAESTRO ---")
    print(df.columns.tolist())
except Exception as e:
    print(f"Error: {e}")
