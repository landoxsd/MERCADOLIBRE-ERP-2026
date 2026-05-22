# Roadmap de Mejoras - MERCADOLIBRE ERP 2026

Este documento registra las ideas y mejoras detectadas durante las sesiones de desarrollo para ser implementadas en futuras fases.

## 1. Inteligencia de Mercado & Categorización 📊
- [ ] **Módulo de Auditoría de Volumen**: Crear un script que compare el número de resultados entre dos categorías sugeridas para elegir siempre la que tenga más tráfico (ej: "Juegos de Anillos" vs "Anillos de Pistón").
- [ ] **Sugerencia de Precios basada en Competencia**: Analizar los precios promedio de la categoría "ganadora" para sugerir un precio ultra-competitivo.
- [ ] **Mapa de Calor de Ventas**: Integrar estadísticas de la API de Mercado Libre para ver qué sublíneas están teniendo más movimiento real.

## 2. Automatización de Publicación 🚀
- [ ] **Publicación Programada**: Permitir que el sistema publique grupos de productos en horarios pico de tráfico.
- [ ] **Auto-corrector de Títulos con IA**: Usar GPT para optimizar títulos no solo por longitud, sino por "keywords" de alto impacto detectadas en el mercado.
- [ ] **Gestión de Kits Dinámicos**: Crear combos automáticamente (ej: Anillos + Pistones + Empacaduras) si el sistema detecta que pertenecen al mismo motor.

## 3. Experiencia de Usuario (UI/UX) 🖥️
- [ ] **Panel de Control de Errores**: Un dashboard que muestre específicamente por qué falló una publicación (falta de foto, atributo técnico inválido, etc.) con botón de "Reparar Todo".
- [ ] **Vista Previa de Publicación**: Ver cómo quedará el producto en ML antes de darle al botón de publicar.
- [ ] **Integración de Chat de Ventas**: Centralizar las preguntas de los clientes de todas las cuentas vinculadas.

## 4. Infraestructura & Datos 🏗️
- [ ] **Migración Total a TypeScript**: Para mayor robustez y menos errores en tiempo de ejecución.
- [ ] **Sincronización en Tiempo Real con Profit Plus**: Usar un webhook o tarea programada para que el stock se actualice sin necesidad de subir el Excel manualmente.

## 5. Ecosistema de Webhooks — Automatización Reactiva ⚡

> **Contexto Técnico:** El Webhook de Mercado Libre ya está activo en `https://mercadolibre-erp.vercel.app/api/webhooks/meli`. Captura eventos de: `items`, `orders_v2`, `questions`, `shipments`, `payments`. La base de datos ya tiene las columnas `sold_quantity` y `visits_count` en la tabla `products`.

### 🟢 Prioridad Alta (Bajo Esfuerzo, Alto Impacto)

- [ ] **Panel de Ventas en Vivo** *(Dificultad: Baja)*
  - Cada evento `orders_v2` actualiza un contador en el dashboard en tiempo real.
  - Sin necesidad de recargar la página (usar SSE o polling cada 30s).
  - Mostrar: Última venta, Revenue del día, Unidades vendidas hoy.

- [ ] **Alerta de Stock Crítico** *(Dificultad: Baja)*
  - Cuando `available_qty` baje de un umbral configurable (ej: < 3 unidades), el webhook dispara una alerta.
  - Canal de notificación: Correo, WhatsApp o notificación push en el dashboard.
  - Evita quedarse sin stock sin darse cuenta.

- [ ] **Detector de Publicación Pausada por ML** *(Dificultad: Baja)*
  - Si ML pausa automáticamente una publicación (por denuncia, política o error de ficha técnica), el webhook `items` lo detecta al instante.
  - El dashboard marca el ítem en rojo con el motivo.
  - Permite reaccionar en minutos en vez de descubrirlo días después.

### 🟡 Prioridad Media (Esfuerzo Moderado, Gran Valor Analítico)

- [ ] **Tracker de Precio Histórico** *(Dificultad: Media)*
  - Crear tabla `price_history` en Supabase: `(meli_item_id, price, timestamp)`.
  - Cada vez que el webhook `items` detecte un cambio de precio, guarda una fila.
  - Visualización: Gráfica de líneas del precio de cada producto en el tiempo.
  - Valor: Auditoría de competencia, detección de guerras de precios.

- [ ] **Alertas de Preguntas Sin Responder** *(Dificultad: Media)*
  - El webhook `questions` ya captura preguntas nuevas en la tabla `questions`.
  - Implementar un cron job cada 2 horas que busque preguntas con `status = 'unanswered'` y `created_at > 4h`.
  - Notificación push: "Tienes 5 preguntas sin responder de más de 4 horas".
  - ML penaliza la reputación del vendedor por tiempos de respuesta lentos.

- [ ] **Rastreador de Conversión Visitas → Ventas** *(Dificultad: Media)*
  - Cruzar `visits_count` (actualizado por Sync) con `sold_quantity` (actualizado por Webhook).
  - Calcular la tasa de conversión de cada publicación: `ventas / visitas * 100`.
  - Identificar productos con muchas visitas pero pocas ventas (precio o fotos malas).

### 🔴 Prioridad Futura (Alto Impacto Estratégico)

- [ ] **Auto-responder de Preguntas con IA** *(Dificultad: Alta)*
  - Cuando llegue una pregunta nueva vía webhook, enviarla a GPT-4 con el contexto del producto.
  - GPT genera una respuesta de calidad y la postea automáticamente vía `POST /questions/{id}/answer`.
  - Requiere: Base de conocimiento de productos, prompt engineering, revisión de calidad.

- [ ] **Sincronización Bidireccional con Profit Plus** *(Dificultad: Alta)*
  - Cuando se vende un producto en ML (evento `orders_v2`), descontar automáticamente el stock en Profit Plus.
  - Requiere: Acceso a la API o base de datos de Profit Plus (posiblemente SQL directo).
  - Elimina el cuello de botella de actualización manual de stock.

- [ ] **Motor de Reglas de Negocio (Trigger Engine)** *(Dificultad: Alta)*
  - Configurar reglas tipo: "SI stock < 5 ENTONCES pausar publicación" o "SI precio de competencia baja un 10% ENTONCES bajar precio un 5%".
  - UI visual para crear y gestionar reglas sin código.
  - Convierte el ERP en un sistema semi-autónomo de gestión de catálogo.

## 6. Clonador de Publicaciones Entre Cuentas 🔁

> **Caso de Uso Real:** Tienes publicaciones exitosas en `CORPORACIONRWC` (con ventas, visitas y calidad alta) y quieres replicarlas en otra cuenta conectada al ERP, o duplicarlas dentro de la misma cuenta para otra región o estrategia de precio.

### Requisitos Funcionales

#### Panel de Selección (Origen)
- [ ] **Selector de Cuenta Origen**: Dropdown con todas las cuentas conectadas al ERP.
- [ ] **Tabla de Publicaciones con Filtros Avanzados:**
  - 🔥 **Por Ventas**: Filtrar las que tienen `sold_quantity > N` (las que ya probaron ser rentables).
  - 👁️ **Por Visitas**: Filtrar las que tienen `visits_count > N` (las que tienen demanda pero quizás no convierten).
  - ⭐ **Por Calidad de Publicación**: Filtrar por `health_score > 0.7` (publicaciones bien optimizadas).
  - 📦 **Por Stock**: Solo mostrar las que aún tienen `available_qty > 0`.
  - 🏷️ **Por Estado**: Activas / Pausadas / Cerradas.
  - 🗂️ **Por Categoría o Sublínea**: Agrupar por `category_id` o `domain_id` para clonar familias completas de productos.
- [ ] **Ordenamiento**: Por ventas DESC, visitas DESC, precio, fecha de publicación.
- [ ] **Selección Masiva**: Checkbox "Seleccionar Todo el Filtro" o selección individual.
- [ ] **Vista Previa**: Mostrar thumbnail + título + ventas + visitas + precio antes de clonar.

#### Panel de Destino (Cuenta Destino)
- [ ] **Selector de Cuenta Destino**: Cualquier cuenta conectada al ERP (puede ser la misma).
- [ ] **Opciones de Clonación:**
  - `Clonar Exacto`: Mismo precio, mismo título, mismas fotos.
  - `Clonar con Ajuste de Precio`: Aplicar un % de incremento/descuento al precio original.
  - `Clonar como Borrador`: Crear en estado `paused` para revisar antes de activar.
- [ ] **Mapeo de Categoría**: Si la cuenta destino es de otro país, sugerir la categoría equivalente vía `domain_discovery`.

#### Motor de Clonación (Backend)
- [ ] **Endpoint:** `POST /api/tools/clone-listings`
- [ ] **Flujo:**
  1. Leer el ítem completo desde ML origen (`GET /items/{id}` con token de cuenta A).
  2. Limpiar campos no transferibles (`id`, `permalink`, `date_created`, `sold_quantity`, `visits`).
  3. Transferir fotos: `GET /items/{id}/pictures` → subir a ML destino → asociar al nuevo ítem.
  4. Publicar en cuenta destino (`POST /items` con token de cuenta B).
  5. Guardar en tabla `clone_history`: `(source_item_id, dest_item_id, source_account, dest_account, timestamp)`.
- [ ] **Rate Limiting Inteligente**: Procesar en lotes de 5 con delay de 1s para evitar bloqueos de la API.
- [ ] **Reporte Final**: Mostrar cuántos se clonaron exitosamente, cuántos fallaron y el motivo de cada fallo.

#### Tabla Nueva en Supabase
```sql
CREATE TABLE clone_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_item_id TEXT NOT NULL,
  dest_item_id TEXT,
  source_account_id TEXT NOT NULL,
  dest_account_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending | success | error
  error_message TEXT,
  cloned_at TIMESTAMPTZ DEFAULT now()
);
```

### Consideraciones Técnicas Importantes

> [!NOTE]
> **Transferencia de Fotos:** ML no permite reusar IDs de imagen entre cuentas, PERO sí podemos obtener las URLs públicas de las fotos del ítem origen (`GET /items/{id}/pictures`) y re-subirlas a la cuenta destino descargándolas en memoria. El flujo es: **URL pública ML → `fetch(url)` → buffer → `uploadPicture(buffer, filename, tokenDestino)`**. La función `uploadPicture()` ya está implementada en `src/lib/meli.js`.

> [!WARNING]
> El `sold_quantity` NO se transfiere — empieza desde 0 en la cuenta destino. Esto es una limitación de la API de ML, no del sistema.

## 7. Módulo de Valor & Productividad (ROI Tracker) 📈

> **Objetivo:** Cuantificar el impacto económico de la herramienta y el tiempo de desarrollo invertido para medir el valor del activo.

### Seguimiento de Inversión (Desarrollo)
- [ ] **Contador de Tiempo de Vuelo**: Sistema que registre las horas de sesión del agente y commits para calcular el total de horas/hombre invertidas en el software.
- [ ] **Bitácora de Sesiones**: Registro automático de hitos por fecha para ver la evolución del proyecto (días transcurridos desde el inicio).

### Calculadora de Ahorro (Productividad)
- [ ] **Estimador de Tiempo Ahorrado**: Panel que calcule cuántas horas de trabajo manual se han evitado.
  - *Ejemplo:* (Publicaciones Masivas x 5 min) + (Sincronizaciones Manuales x 30 min) = **X horas ahorradas/mes**.
- [ ] **Ahorro en Errores**: Contador de publicaciones corregidas por el sistema que habrían sido penalizadas por ML (evitando pérdida de reputación).
- [ ] **Valor de Clonación**: Cuantificar cuánto costaría contratar a un operador para clonar 100 publicaciones vs. los 5 minutos que tarda el sistema.

### Métricas de Valor del Activo
- [ ] **Dashboard de Volumen de Datos**:
  - Total de ítems gestionados (ej: 18,000+).
  - Total de mapeos de categorías generados (el "Golden Database").
  - Total de imágenes procesadas y almacenadas.
- [ ] **Valor de Mercado del ERP**: Un estimador que sume el costo de las licencias de herramientas que este ERP reemplaza (ej: lo que pagarías en RealTrends, Integraly, o similar mensualmente).

---
*Sección añadida: 2026-05-11 — Sesión de Webhook Intelligence & MCP Setup.*

## Roadmap: Inspiración de Real Trends, Administrado y UpSeller (Añadido 2026-05-22)
El objetivo es transformar esta plataforma en el "Real Trends" de Venezuela, integrando las siguientes mecánicas analíticas:

### 1. Inteligencia de Categorías (Radar de Nichos)
- **Semáforos de Tendencia**: Indicadores visuales (flechas verdes/rojas) para mostrar si una categoría crece o decrece (+/- 20%).
- **Métricas Globales**: Consolidar volumen total facturado, unidades vendidas y ticket promedio de una categoría entera.

### 2. Extracción de Productos Ganadores (Top 20)
- **Filtros Históricos**: Retroceder meses/años para ver estacionalidad.
- **Orden Múltiple**: Ordenar por facturación o unidades vendidas para encontrar ganadores absolutos.
- **Market Share**: Calcular el % de dependencia de un vendedor sobre un solo producto.

### 3. Seguimiento a Nivel Cuenta (Espionaje Directo)
- **Clonación del Dashboard**: Replicar las métricas de un competidor (facturación, conversión).
- **Cruce Visitas vs. Conversión**: Comparar el embudo propio contra el líder para identificar problemas de tráfico vs. problemas de ficha técnica.
- **Matriz Logística**: Analizar uso de envíos gratis, Flex, Full del rival.
- **Control de Stock**: Trackear pausas por quiebre de stock para subir precios.

### 4. Búsqueda Inversa y Keywords
- **Intención de Búsqueda**: Top 50 de palabras más buscadas vs. títulos reales.
- **Fricciones Algorítmicas**: Cruzar "términos buscados" con "más vendidos".

### 5. Exportación Masiva (Big Data)
- **Descarga en Crudo**: Exportar 10 competidores a Excel y unificarlos.
- **Armado de Catálogos**: Filtrar los 20 mejores productos de ese ecosistema para decidir qué importar/fabricar.
