# profit_mercatech_sync

Conocimiento técnico extraído por Ingeniería Inversa REA de **Mercatech Sync (`rwcagente 2.0-SNAPSHOT`)** para **CORPORACION R.W.C. C.A.** (`RWC20_A`, `appid=rwc837`).

## 1. Directiva Crítica
- **Profit Plus (`192.168.1.10:1433` / `RWC20_A`) es 100% SOLO LECTURA (`WITH (NOLOCK)`).**

## 2. Fórmula Oficial de Stock RWC (Almacenes `01.01`, `01.02`, `01.03`)
```sql
SELECT LTRIM(RTRIM(AA.co_art)) AS sku, SUM(AA.stock_act - AA.stock_com) AS stock_disponible
FROM [RWC20_A].dbo.st_almac AA WITH (NOLOCK)
WHERE AA.co_alma IN ('01.01', '01.02', '01.03')
GROUP BY LTRIM(RTRIM(AA.co_art));
```

## 3. Auditoría de Pedidos Mercado Libre en Profit Plus (`ML-999`)
- `co_cli = 'ML-999'`, `co_ven = '00001'`, `co_sucu = '01'`, `co_alma = '01.01'`, `moneda = 'US$'`.
- `rif` = ID de orden en Mercado Libre (`idml`).
- `campo3` = Order Code Mercatech · `campo4` = Buyer ID · `campo5` = Nombre · `campo6` = Nickname · `campo7` = Teléfono · `campo8` = Tasa de cambio aplicada.

## 4. Combos / Kits Virtuales
- Stock del Combo = `MIN(FLOOR(stock_disponible_hijo / qty_requerida))`.
