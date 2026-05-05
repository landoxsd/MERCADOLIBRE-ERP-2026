import pandas as pd

try:
    df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\rwccompletosinimagenes17042026.xlsx', header=None, nrows=500)
    count = 0
    for i, row in df.iterrows():
        val0 = str(row.iloc[0])
        if val0.startswith("MLV"):
            count += 1
    print(f"Found {count} MLV rows in the first 500 rows.")
except Exception as e:
    print(f"Error: {e}")
