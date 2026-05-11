# PMV-Core | Especificaciones Técnicas

Este microservicio ha sido diseñado para la automatización de la verificación de pagos móviles en Venezuela (Banesco) utilizando Inteligencia Artificial.

## Componentes
1. **Motor de Visión (Gemini 1.5 Flash)**: Se encarga de procesar las imágenes recibidas y convertirlas en datos estructurados (JSON).
2. **Puente WhatsApp (whatsapp-web.js)**: Utiliza una instancia real de Chrome para garantizar la compatibilidad con WhatsApp Business y evitar bloqueos.
3. **Scraper Bancario (Playwright)**: Automatiza la navegación en Banesco Online para extraer los movimientos reales en formato TXT.
4. **Dashboard (Socket.io + Express)**: Interfaz gráfica en tiempo real para el monitoreo de la actividad.

## Estructura de Archivos
- `index.js`: El orquestador principal del servidor y WhatsApp.
- `banesco-sync.js`: El robot que se conecta al banco.
- `parser.js`: La lógica que entiende los archivos de Banesco.
- `gemini-vision.js`: La conexión con la IA de Google.
- `reconciler.js`: El cerebro que compara WhatsApp vs Banco.
- `.env`: Archivo de configuración confidencial (Llaves API, Usuarios).

## Seguridad
El sistema utiliza un algoritmo de `row_hash` (MD5) para cada movimiento bancario, lo que garantiza que ningún pago sea procesado dos veces, incluso si se reinicia el sistema.

---
*Versión 1.0.0 | Mayo 2026*
