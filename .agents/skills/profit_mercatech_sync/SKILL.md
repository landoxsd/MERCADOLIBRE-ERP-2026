---
name: profit_mercatech_sync
description: >-
  Conocimiento técnico completo extraído por Ingeniería Inversa REA de Mercatech Sync (rwcagente 2.0-SNAPSHOT)
  y su integración con Profit Plus Administrativo (SQL Server RWC20_A). Incluye la fórmula oficial de stock por
  almacenes (01.01, 01.02, 01.03), estructura de Combos/Cajas, mapeo de órdenes ML-999 y consultas READ-ONLY.
---

# profit_mercatech_sync

💡 Esta habilidad encapsula toda la lógica de negocio extraída mediante ingeniería inversa (`morluto/rea`) de los agentes Java de **Mercatech Sync** (`sync-mercatech-pedido.jar` y `sync-mercatech-precios.jar`) configurados para **CORPORACION R.W.C. C.A.** (`RWC20_A`, `appid=rwc837`).

---

## ⚠️ Regla de Oro Inquebrantable (SOLO LECTURA)

- El ERP Next.js se conecta a **Profit Plus SQL Server (`192.168.1.10:1433`, DB `RWC20_A`)** en modo **100% READ-ONLY**.
- **PROHIBIDO** ejecutar `INSERT`, `UPDATE`, `DELETE` o invocar los procedimientos almacenados de escritura (`pp_ins_pedidos`, `pActualizarPrecioCostoManual`, `pStockActualizar`) desde el código de la aplicación.
- **SIEMPRE** incluir `WITH (NOLOCK)` en cada tabla consultada para no bloquear la facturación de caja o almacén.

---

## 1. Parámetros Oficiales de Corporación R.W.C. (`app.properties` & JWT)

| Parámetro | Valor en Producción | Descripción |
| :--- | :--- | :--- |
| `app.id` | `rwc837` | ID del cliente en Mercatech Cloud (`id=950`, `idparent=837`) |
| `app.schema` | `RWC20_A` | Base de datos productiva en SQL Server (`192.168.1.10:1433`) |
| `app.warehouses` | `'01.01', '01.02', '01.03'` | Almacenes físicos computables para stock de Mercado Libre |
| `app.orders.customer.id` | `ML-999` | Código de cliente en tabla `clientes` para ventas de Mercado Libre |
| `app.orders.salesman` | `00001` | Código de vendedor asignado en `pedidos` |
| `app.orders.branch` | `01` | Sucursal (`co_sucu`) |
| `app.orders.info.money` | `US$` | Código de moneda en tabla `tasas` / `moneda` |
| `iva` | `0.16` | Alícuota de IVA (16%) |

---

## 2. Consultas SQL Exactas Extraídas del Bytecode (`Profit2k8`)

### 2.1. Fórmula Oficial de Stock Disponible (`SQLStockProductDAOImplProfit2k8`)
A diferencia de leer `art.stock_act` global, Mercatech suma exclusivamente los almacenes `'01.01'`, `'01.02'` y `'01.03'` en `st_almac`:

```sql
SELECT ISNULL(SUM(AA.stock_act) - SUM(AA.stock_com), 0) AS stock_disponible
FROM [RWC20_A].dbo.st_almac AA WITH (NOLOCK)
WHERE AA.co_alma IN ('01.01', '01.02', '01.03')
  AND AA.co_art = @co_art;
```

**Versión Masiva Optimizada para el ERP Next.js (1 sola consulta para los 43k SKUs):**
```sql
SELECT 
    LTRIM(RTRIM(AA.co_art)) AS sku,
    SUM(AA.stock_act - AA.stock_com) AS stock_disponible
FROM [RWC20_A].dbo.st_almac AA WITH (NOLOCK)
WHERE AA.co_alma IN ('01.01', '01.02', '01.03')
GROUP BY LTRIM(RTRIM(AA.co_art));
```

### 2.2. Catálogo y Precios (`SQLProductDAOImplProfit2k8`)
```sql
SELECT 
    CONVERT(varchar(50), LTRIM(RTRIM(tt.co_art))) AS co_art,
    tt.art_des,
    tt.prec_vta1,
    tt.prec_vta2,
    tt.prec_vta3,
    tt.prec_vta4,
    tt.prec_vta5,
    tt.anulado,
    tt.tipo
FROM [RWC20_A].dbo.art tt WITH (NOLOCK)
WHERE tt.tipo = 'V' AND tt.anulado = 0;
```

### 2.3. Tasa de Cambio Vigente (`OrderDAOImplProfit2k8.getTasaActual`)
```sql
SELECT TOP 1 tasa_v, fecha
FROM [RWC20_A].dbo.tasas WITH (NOLOCK)
WHERE co_mone = 'US$'
ORDER BY fecha DESC;
```

---

## 3. Conciliación y Auditoría de Pedidos Mercado Libre en Profit Plus (`READ-ONLY`)

El agente `sync-mercatech-pedido.jar` (`TestGetOrders`) insertaba las órdenes de Mercado Libre en `[RWC20_A].[dbo].[pedidos]` mapeando los metadatos en los campos adicionales (`campo3..campo8` y `rif`).

Para auditar desde Next.js qué órdenes de Mercado Libre ya fueron registradas o facturadas en Profit Plus:

```sql
SELECT TOP 200
    p.fact_num AS nro_pedido_profit,
    p.fec_emis,
    LTRIM(RTRIM(p.co_cli)) AS co_cli,
    LTRIM(RTRIM(p.rif)) AS ml_order_id_rif,
    LTRIM(RTRIM(p.campo3)) AS mercatech_order_code,
    LTRIM(RTRIM(p.campo4)) AS ml_buyer_id,
    LTRIM(RTRIM(p.campo5)) AS ml_buyer_name,
    LTRIM(RTRIM(p.campo6)) AS ml_buyer_nickname,
    LTRIM(RTRIM(p.campo7)) AS ml_buyer_phone,
    LTRIM(RTRIM(p.campo8)) AS tasa_aplicada,
    p.tot_bruto,
    p.iva,
    p.tot_neto,
    p.saldo,
    p.status,
    p.anulada
FROM [RWC20_A].dbo.pedidos p WITH (NOLOCK)
WHERE p.co_cli = 'ML-999'
ORDER BY p.fec_emis DESC, p.fact_num DESC;
```

---

## 4. Arquitectura de Combos y Kits Virtuales (`syncBoxProduct` + JWT `Combo`)

Tanto Mercatech (`syncproductbox` / clase base `Combo` en el JWT de `mercatech-sync.com`) como Integraly (`FormOpenAISugerirKitsVirtuales`) permiten publicar **Kits o Combos** (ej. "Kit 4 Bujías", "Par de Amortiguadores Delanteros", "Kit de Tiempo Completo") sin crear un código compuesto físico en Profit Plus:

1. **Definición del Combo (en PostgreSQL local `192.168.1.58:5432`):**
   - `combo_sku`: SKU virtual del combo en Mercado Libre (ej. `KIT-4X-BKR5EGP`).
   - `items`: Array de `{ co_art, qty_required }`.
2. **Cálculo de Stock del Combo:**
   $$\text{Stock Combo} = \min_{i} \left\lfloor \frac{\text{Stock Disponible}(\text{co\_art}_i)}{\text{qty\_required}_i} \right\rfloor$$
3. **Cálculo de Precio del Combo:**
   $$\text{Precio Combo} = \sum_{i} \left(\text{Precio Unitario}(\text{co\_art}_i) \times \text{qty\_required}_i\right) \times (1 - \text{descuento\_kit})$$
