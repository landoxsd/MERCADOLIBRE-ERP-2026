import pandas as pd

try:
    df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\MAESTRO 20042026.xlsx', skiprows=9, nrows=5)
    print("--- DETECTED COLUMNS ---")
    print(df.columns.tolist())
    print("--- FIRST ROW ---")
    print(df.iloc[0].to_dict())
except Exception as e:
    print(f"Error: {e}")
