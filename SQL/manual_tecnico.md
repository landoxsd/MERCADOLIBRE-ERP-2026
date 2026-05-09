# Documentación Técnica - Mapeo de Campos Profit Plus para CRM Lite

Este documento registra el mapeo de campos entre la base de datos `RWC20_A` (Profit Plus) y la nueva interfaz de CRM Lite.

## 1. Mapeo de la Tabla `art` (Maestro de Artículos)

Para igualar la funcionalidad del sistema anterior, se han identificado los siguientes campos:

| Campo Interfaz (Nuevo) | Columna SQL | Descripción / Uso en Profit |
| :--- | :--- | :--- |
| **Buscador (Index)** | `abuscar` | Campo consolidado para búsquedas rápidas (incluye todo) |
| **Código** | `co_art` | Código principal del artículo |
| **2do Código** | `ref` | Código alternativo o de fabricante |
| **Código de Barras** | `modelo` | Código EAN/UPC o Referencia |
| **Descripción** | `art_des` | Nombre comercial del artículo |
| **Descripción Extendida**| `comentario`| Notas detalladas del producto |
| **Ubicación** | `ubicacion` | Pasillo/Estante en almacén |
| **Línea** | `co_lin` | Familia de productos (Join con `lin_art`) |
| **Marca (Sub-Línea)** | `co_subl` | Marca del producto (Join con `sub_lin`) |
| **Mayor (Campo1)** | `campo1` | Precio o categoría de mayorista |
| **Especial (Campo2)** | `campo2` | Precio o categoría especial |
| **Estatus (Campo3)** | `campo3` | Estado del inventario |
| **Base (Campo4)** | `campo4` | Costo base o referencia |
| **Alterno 2 (Campo6)** | `campo6` | Segunda lista de equivalencias |
| **Alternos (Campo7)** | `campo7` | Lista de códigos equivalentes |
| **Peso** | `peso` | Peso físico del artículo |
| **Volumen (Pie)** | `pie` | Volumen o pies cúbicos |

## 2. Historial de Puntos de Control (Checkpoints)

- **v1.0 (2026-05-01)**: Versión inicial con buscador básico, galería de fotos y fondo gris.
- **v1_backup (2026-05-01)**: Respaldo realizado en `backups/crm_lite_v1` antes de iniciar la profesionalización de la interfaz.

## 3. Arquitectura del Sistema

- **Backend**: FastAPI (Python) manejando la conexión ODBC a SQL Server.
- **Frontend**: Vanilla HTML/JS/CSS diseñado para máxima velocidad y mínima carga de red.
- **Imágenes**: Servidas localmente desde `C:\Users\ORLANDO\Pictures\FOTOS`.
