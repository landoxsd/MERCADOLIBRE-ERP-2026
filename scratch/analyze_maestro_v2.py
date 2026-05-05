import pandas as pd

try:
    df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\MAESTRO 20042026.xlsx', skiprows=5, nrows=5)
    print("--- HEADERS MAESTRO (Row 6) ---")
    print(df.columns.tolist())
    print("--- DATA SAMPLE ---")
    print(df.head(2).to_string())
except Exception as e:
    print(f"Error: {e}")
