import pandas as pd

try:
    df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\rwccompletosinimagenes17042026.xlsx', sheet_name='Hoja3', nrows=5)
    print("--- HEADERS HOJA3 ---")
    print(df.columns.tolist()[:15])
    print("--- DATA ROW 0 ---")
    row = df.iloc[0]
    for i in range(15):
        print(f"COL {i}: {row.iloc[i]}")
except Exception as e:
    print(f"Error: {e}")
