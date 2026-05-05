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

---
*Documento creado el 2026-05-05 basado en la optimización del Motor GOLDEN.*
