# 📘 Profit Plus: Estructura de Datos y Guía de Consultas (Master)

Este documento sirve como referencia técnica para entender la estructura de la base de datos de **Profit Plus Administrativo (SQL Server)**. Cubre todos los módulos principales del sistema.

---

## 🏗️ 1. Módulo de Inventario (Core)

### 📦 Artículos (`art`)
PK: `co_art`. Tabla maestra de productos. Campos clave: `art_des`, `modelo`, `referencia`, `prec_vta1..5`.
### 🏢 Stock (`st_almac`)
PK: `co_art` + `co_alma`. Existencia real (`stock_act`) y comprometida (`stock_com`).
### 🏷️ Clasificación (`lin_art`, `cat_art`, `subl_art`)
Maestros de Líneas, Categorías y Sub-líneas.

---

## 💰 2. Módulo de Ventas (Ingresos)

### 👥 Clientes (`clientes`)
PK: `co_cli`. Datos maestros de clientes.
- `cli_des`: Nombre/Razón Social.
- `rif`: RIF/Cédula.
- `direc1`: Dirección.
- `telefonos`: Contacto.

### 📄 Facturas de Venta (`factura` y `reng_fac`)
- **Cabecera (`factura`):** `fact_num` (PK), `fec_emis`, `co_cli`, `tot_neto`, `iva`, `total_fac`.
- **Renglones (`reng_fac`):** `fact_num`, `reng_num`, `co_art`, `total_art` (cantidad), `prec_vta`, `reng_neto`.

### 📝 Pedidos y Cotizaciones (`pedidos`, `cotiz_c`)
Siguen la misma lógica de cabecera y renglones (`reng_ped`, `reng_cac`).

---

## 🛒 3. Módulo de Compras (Egresos)

### 🤝 Proveedores (`prov`)
PK: `co_prov`. Datos maestros de proveedores.
- `prov_des`: Nombre.
- `rif`: RIF.

### 🧾 Documentos de Compra (`compras` y `reng_com`)
- **Cabecera (`compras`):** `fact_num` (Nro de factura del proveedor), `fec_emis`, `co_prov`, `monto_neto`.
- **Renglones (`reng_com`):** Detalle de artículos recibidos y costos.

---

## 🏦 4. Módulo de Tesorería y Bancos

### 💳 Bancos y Cuentas (`bancos`, `cuentas`)
- `co_ban`: Código del banco.
- `num_cta`: Número de cuenta bancaria.

### 💸 Movimientos de Banco (`mov_ban`)
PK: `mov_num`. Registra depósitos, retiros y transferencias.
- `tipo_op`: Tipo de operación (DEP, RET, TRF).
- `monto`: Valor del movimiento.

---

## 📑 5. Cuentas por Cobrar y Pagar (Cartera)

### 📉 Documentos CC (`docum_cc`) y CP (`docum_cp`)
Registra las deudas de clientes y deudas con proveedores.
- `nro_doc`: Número del documento (Factura, Giro, etc).
- `tipo_doc`: (FAC, Giros, Adelantos).
- `fec_emis` / `fec_venc`: Emisión y Vencimiento.
- `monto_net`: Monto original.
- `monto_pago`: Monto ya cancelado.
- `saldo`: Lo que queda por pagar/cobrar.

---

## 🔍 6. Estrategia de Búsqueda y Rendimiento

### Búsqueda Híbrida (Hybrid Search)
Convertimos espacios en `%` para ignorar separadores técnicos (`.`, `-`).
```sql
-- Ejemplo: Buscar "BATERIA TITAN"
WHERE art_des LIKE '%BATERIA%TITAN%'
```

### Directivas Críticas de SQL Server
1. **NOLOCK:** Usar siempre `(NOLOCK)` para evitar bloqueos en el servidor.
2. **TOP:** Limitar resultados (`TOP 100`) para no saturar la red.
3. **TCP/IP:** Forzar conexión vía `Network=DBMSSOCN` en la cadena de conexión.

---

## 📊 7. Consultas Útiles (Snippets)

### Reporte de Ventas por Artículo
```sql
SELECT r.co_art, SUM(r.total_art) as cantidad_vendida, SUM(r.reng_neto) as total_monto
FROM reng_fac r (NOLOCK)
JOIN factura f (NOLOCK) ON r.fact_num = f.fact_num
WHERE f.fec_emis BETWEEN '2024-01-01' AND '2024-12-31'
GROUP BY r.co_art
ORDER BY total_monto DESC
```

### Saldo Pendiente de un Cliente
```sql
SELECT co_cli, SUM(saldo) as deuda_total
FROM docum_cc (NOLOCK)
WHERE co_cli = 'CLIENTE01' AND saldo > 0
GROUP BY co_cli
```

---

## 🔬 8. Hallazgos de Ingeniería Inversa (Mercatech Sync `rwcagente 2.0-SNAPSHOT` — `RWC20_A`)

> **⚠️ REGLA INQUEBRANTABLE:** Toda conexión desde el ERP Next.js hacia `192.168.1.10:1433` (`RWC20_A`) es **100% SOLO LECTURA (`READ-ONLY`)** con `WITH (NOLOCK)`. Jamás ejecutar `INSERT`, `UPDATE`, `DELETE` ni `EXEC` de escritura.

### 8.1. Fórmula Oficial de Stock Disponible para Mercado Libre (`SQLStockProductDAOImplProfit2k8`)
En Corporación R.W.C., el stock disponible para comercio electrónico se calcula exclusivamente sobre los **3 almacenes operativos** (`'01.01'`, `'01.02'`, `'01.03'`):
```sql
SELECT 
    LTRIM(RTRIM(AA.co_art)) AS co_art,
    ISNULL(SUM(AA.stock_act) - SUM(AA.stock_com), 0) AS stock_disponible
FROM [RWC20_A].dbo.st_almac AA WITH (NOLOCK)
WHERE AA.co_alma IN ('01.01', '01.02', '01.03')
GROUP BY LTRIM(RTRIM(AA.co_art));
```

### 8.2. Catálogo de Artículos Vendibles y Precios (`SQLProductDAOImplProfit2k8`)
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

### 8.3. Tasa de Cambio Vigente (`tasas`)
```sql
SELECT TOP 1 tasa_v, fecha
FROM [RWC20_A].dbo.tasas WITH (NOLOCK)
WHERE co_mone = 'US$'
ORDER BY fecha DESC;
```

### 8.4. Mapeo y Auditoría de Pedidos Mercado Libre (`pedidos` — `co_cli = 'ML-999'`)
El agente `sync-mercatech-pedido.jar` (`TestGetOrders`) registraba las órdenes de Mercado Libre bajo el cliente `ML-999` (`co_ven = '00001'`, `co_sucu = '01'`, `co_alma = '01.01'`, `moneda = 'US$'`), guardando la trazabilidad en los campos adicionales:
- `rif`: ID de la orden en Mercado Libre (`idml`)
- `campo3`: Código de orden interno Mercatech (`ordercode`)
- `campo4`: ID del comprador (`customer_code`)
- `campo5`: Nombre del comprador (`customer_name`)
- `campo6`: Nickname del comprador en ML (`customer_nickname`)
- `campo7`: Teléfono del comprador (`customer_phone`)
- `campo8`: Tasa de cambio BCV/interna aplicada al momento de la venta (`tasa_cambio`)

```sql
SELECT TOP 100
    p.fact_num, p.fec_emis, LTRIM(RTRIM(p.rif)) AS ml_order_id,
    LTRIM(RTRIM(p.campo3)) AS mercatech_code, LTRIM(RTRIM(p.campo6)) AS ml_nickname,
    LTRIM(RTRIM(p.campo8)) AS tasa_cambio, p.tot_bruto, p.iva, p.tot_neto, p.saldo
FROM [RWC20_A].dbo.pedidos p WITH (NOLOCK)
WHERE p.co_cli = 'ML-999'
ORDER BY p.fec_emis DESC, p.fact_num DESC;
```

