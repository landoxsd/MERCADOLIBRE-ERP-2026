---
name: meli_expert
description: Experto en la API de Mercado Libre Venezuela (MLV) con conocimientos actualizados de 2025.
---

# meli_expert

💡 Esta habilidad proporciona el conocimiento técnico necesario para interactuar con la API de Mercado Libre en el contexto de Venezuela (MLV).

## Usage

Use esta habilidad cuando necesite:
- Realizar búsquedas de productos en MLV.
- Consultar detalles de ítems (multiget).
- Analizar el rendimiento de una publicación (Performance API).
- Manejar la lógica de precios legal en USD (BCV).

## Steps

1. **Autenticación**: Use siempre `getValidAccessToken()` de `@/lib/meli-auth-helper`.
2. **Consulta**: Realice las peticiones a `https://api.mercadolibre.com/`.
3. **Validación**: Verifique que el `currency_id` sea `USD` (legal en MLV).
4. **Logística**: Analice el campo `shipping` y la descripción para detectar zonas de pickup.

## SEO & Publicación Masiva (V2.1 - 2026)

- **Límite de Título**: Estricto de 60 caracteres.
- **Normalización**: Eliminar conectores (DE, LA, EL, CON) y puntuación.
- **Abreviaturas**: Expandir abreviaturas críticas (AMORT., DEL., TRAS., etc.) para mejorar el posicionamiento.
- **Title Case**: Aplicar formato "Título Capitalizado" (Solo la primera letra de cada palabra en mayúscula) para una estética premium.
- **Logística Limpia**: Para publicaciones con MercadoEnvíos, se deben dejar en NULL las columnas de "Precio por zona/región" en la plantilla de ML para evitar errores de cálculo y delegar la tarifa a la plataforma.
- **Espejo Local-Vercel**: Mantener paridad total de lógica entre la herramienta de escritorio (config.json) y el backend de Vercel (API Routes).
- **Imagen Fallback**: Siempre incluir una URL de imagen de respaldo (Corporación RWC) para evitar publicaciones con error de foto.

## Integridad de Datos y Errores Críticos

- **Regla del SKU Inmutable**: El SKU es la clave primaria. No se debe normalizar ni recortar.
- **Paginación de Inventario**: Siempre usar bucles de paginación para Supabase para manejar catálogos de más de 18,000 ítems.
- **Parche de ExcelJS (B643)**: En entornos donde el monkey-patch falle, aplicar una limpieza radical de fórmulas (`cell.value = null; cell.value = val;`) al cargar el archivo para eliminar "Shared Formulas" huérfanas.
- **Detección Dinámica**: Para reportes de Profit Plus que cambian de versión, se debe implementar una búsqueda de encabezados (`CODIGO`, `EXISTENCIA`) en las primeras 30 filas en lugar de usar índices fijos.
- **Fallback de Imágenes**: En publicaciones masivas, siempre proveer un `FALLBACK_IMAGE_URL` oficial de la marca para evitar publicaciones vacías cuando el Banco de Imágenes no tenga el SKU procesado.
## Mercado Envíos Venezuela (SPA External Portal - 2026)

- **Acceso Directo**: La información de contacto (teléfono) está protegida. Se debe usar el portal externo `mercadoenvios.com.ve` mediante scraping si la API de ML no la provee.
- **Sesión Dual**: El sistema requiere inyectar tanto las cookies de ML como el `access_token` específico de Mercado Envíos en el dominio `.mercadoenvios.com.ve`.
- **Estrategia Anti-Bot (Bypass)**:
  - **User-Agent Real**: Forzar un UA de Chrome/Windows moderno.
  - **WebDriver Hidden**: Inyectar script para ocultar `navigator.webdriver`.
  - **Angular Rendering**: La app es una SPA. Esperar siempre a `<melienvios-root>` y aplicar un delay de 3-5s para asegurar el renderizado de datos dinámicos.
- **Selectores de Oro**:
  - **Teléfono**: Buscar párrafos que contengan el texto "Teléfono:".
  - **Receptor**: Buscar párrafos con el texto "Quien recibe:".
- **Sincronización de Pesos**: Los pesos logísticos se gestionan en `/vendedor/productos`. Extraer estos datos es crítico para la precisión del cálculo de fletes en el ERP.
