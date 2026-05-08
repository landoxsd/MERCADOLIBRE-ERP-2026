---
name: ui_premium
description: Estándares de diseño visual de alta gama para dashboards modernos y reactivos.
---

# ui_premium

💡 Esta habilidad asegura que todos los componentes de la interfaz de usuario mantengan una estética "Dark Mode" premium y funcional.

## Usage

Use esta habilidad cuando necesite:
- Crear nuevas páginas o componentes en el dashboard.
- Diseñar visualizaciones de datos (gráficos circulares, tablas, badges).
- Asegurar la consistencia visual y la responsividad con Tailwind CSS.

## Steps

1. **Base**: Usar `bg-slate-950` para fondos y `bg-slate-900` para tarjetas.
2. **Acentos**: Aplicar degradados de `cyan-500` a `blue-600` para elementos primarios.
3. **Iconografía**: Utilizar `lucide-react` para mantener coherencia visual.
4. **Interacción**: Añadir transiciones suaves y efectos hover sutiles.

## Herramientas de Auditoría & Publicación

- **Mode Selectors**: Usar botones tipo "Pill" con bordes redondeados (`rounded-xl`) y estados activos con colores semánticos (Azul para Maestro, Ambar para Inbound, Esmeralda para Listados).
- **Drop Zones**: Mantener bordes punteados (`border-dashed`) con fondos semi-transparentes (`bg-white/5`) para zonas de carga de archivos.
- **Stat Cards**: Tarjetas de resumen con bordes de color dinámico según el estado (Éxito -> Verde, Error -> Rojo, Pendiente -> Naranja).
- **Tooltips & Labels**: Usar tipografía pequeña (`text-xs`) con baja opacidad (`opacity-50`) para instrucciones secundarias dentro de los componentes de carga.
