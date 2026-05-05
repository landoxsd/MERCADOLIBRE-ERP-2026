import pandas as pd

try:
    # Leer sin encabezados para ver la estructura real
    df = pd.read_excel(r'c:\Users\ORLANDO\Documents\ANTIGRAVITY\MERCADOLIBRE 18042026 - copia\rwccompletosinimagenes17042026.xlsx', header=None, nrows=50)
    for i, row in df.iterrows():
        # Buscar el patron MLV en la primera columna
        val0 = str(row.iloc[0])
        if val0.startswith("MLV"):
            print(f"DATA STARTS AT ROW {i}: {val0} | {row.iloc[3]}")
except Exception as e:
    print(f"Error: {e}")
