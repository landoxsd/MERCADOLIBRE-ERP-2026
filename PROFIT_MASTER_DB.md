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
