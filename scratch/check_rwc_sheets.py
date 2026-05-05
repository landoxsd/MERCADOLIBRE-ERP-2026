import pandas as pd

try:
    xl = pd.ExcelFile(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\rwccompletosinimagenes17042026.xlsx')
    print(f"Sheets: {xl.sheet_names}")
except Exception as e:
    print(f"Error: {e}")
