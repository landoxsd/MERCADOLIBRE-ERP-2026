# Diseño de Aplicación para Monitoreo de Ventas en MercadoLibre

## Resumen
Esta aplicación monitoreará cada 5 minutos las nuevas ventas en MercadoLibre utilizando la API oficial, y extraerá información de contacto de los compradores mediante web scraping. Los datos se almacenarán en un formato compatible con FileMaker.

## Componentes Principales

### 1. Módulo de Autenticación
- Utilizará un token de acceso proporcionado por el usuario
- Implementará funcionalidad para refrescar el token cuando sea necesario
- Almacenará de forma segura las credenciales

### 2. Módulo de Monitoreo de Ventas
- Verificará cada 5 minutos si hay nuevas ventas
- Utilizará el endpoint: `https://api.mercadolibre.com/orders/search/recent`
- Parámetros principales:
  - `seller`: ID del vendedor
  - `access_token`: Token de autenticación
  - `order.status=confirmed`: Filtro para ventas confirmadas
  - `sort=date_desc`: Ordenamiento por fecha descendente
  - `api_version=4`: Versión de la API
  - `offset`: Para paginación

### 3. Módulo de Web Scraping
- Accederá a la página de detalle de ventas para extraer:
  - Nombre y apellido del comprador
  - Número telefónico
- Utilizará BeautifulSoup para el análisis del HTML
- Implementará manejo de errores para casos donde la información no esté disponible

### 4. Módulo de Almacenamiento de Datos
- Utilizará SQLite como base de datos local
- Implementará dos tablas principales:
  1. `ORDENES_ABIERTAS`: Almacenará información de las órdenes
  2. `CLIENTES`: Almacenará información de contacto de los compradores
- Exportará datos en formato compatible con FileMaker (CSV o JSON)

### 5. Módulo de Programación de Tareas
- Utilizará la biblioteca `schedule` para ejecutar verificaciones cada 5 minutos
- Implementará manejo de errores y reintentos
- Registrará actividad en archivos de log

## Flujo de Ejecución

1. **Inicialización**:
   - Cargar configuración y credenciales
   - Inicializar base de datos
   - Cargar órdenes ya procesadas

2. **Ciclo Principal**:
   - Cada 5 minutos:
     - Verificar token de acceso y refrescar si es necesario
     - Consultar nuevas ventas mediante la API
     - Para cada nueva venta:
       - Obtener detalles básicos de la API
       - Realizar web scraping para obtener datos de contacto
       - Almacenar información en la base de datos

3. **Manejo de Errores**:
   - Implementar reintentos para fallos de conexión
   - Registrar errores en archivo de log
   - Continuar con la siguiente orden en caso de error en una específica

## Requisitos Técnicos

- Python 3.8+
- Bibliotecas:
  - `requests`: Para llamadas a la API
  - `beautifulsoup4`: Para web scraping
  - `schedule`: Para programación de tareas
  - `sqlite3`: Para almacenamiento de datos
  - `json`: Para manejo de respuestas de la API
  - `datetime`: Para manejo de fechas y tiempos

## Consideraciones Adicionales

- La aplicación debe ser robusta ante fallos de conexión
- Debe manejar adecuadamente los límites de tasa de la API de MercadoLibre
- Debe implementar mecanismos para evitar el procesamiento duplicado de órdenes
- Debe proporcionar logs claros para facilitar la depuración
