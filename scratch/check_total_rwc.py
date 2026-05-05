import pandas as pd

try:
    df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\rwccompletosinimagenes17042026.xlsx')
    print(f"Total rows: {len(df)}")
    print(f"Total columns: {len(df.columns)}")
    print("Non-null counts:")
    print(df.count())
except Exception as e:
    print(f"Error: {e}")
