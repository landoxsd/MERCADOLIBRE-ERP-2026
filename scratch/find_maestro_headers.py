import pandas as pd

try:
    df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\MAESTRO 20042026.xlsx', nrows=30)
    for i, row in df.iterrows():
        row_str = " | ".join([str(val) for val in row.values])
        if "ARTICULO" in row_str.upper() or "SKU" in row_str.upper():
            print(f"FOUND HEADERS AT ROW {i}: {row_str}")
except Exception as e:
    print(f"Error: {e}")
