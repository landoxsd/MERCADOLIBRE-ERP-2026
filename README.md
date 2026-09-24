# 🏎️ MercadoLibre ERP Venezuela 2026

ERP integral y suite de inteligencia competitiva para **Mercado Libre Venezuela (MLV)**, diseñado para la gestión y publicación masiva de más de **43,000 SKUs de autopartes** integrados con Profit Plus Administrativo.

---

## 🚀 Inicio Rápido

### 1. Requisitos Previos
- Node.js 18+ instalado.
- Cuenta de Supabase configurada.
- Credenciales de aplicación en Mercado Libre Developers.

### 2. Instalación de Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
Copia el archivo de plantilla y completa tus credenciales locales:
```bash
cp .env.example .env.local
```

### 4. Ejecutar Servidor Local
```bash
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 📖 Documentación y Fuente de Verdad para IAs (Cursor / Antigravity)

Este proyecto está 100% optimizado para desarrollo colaborativo entre agentes de IA y desarrolladores humanos:

- **🧠 Memoria y Estado Vivo del Proyecto:** Consulta [`memoria.md`](file:///memoria.md) para conocer el estado exacto de cada módulo, qué está hecho, qué falta y el contrato de handoff entre sesiones.
- **📜 Reglas de Cursor:** Archivo [`.cursorrules`](file:///c:/Users/ORLANDO/Documents/ANTIGRAVITY/MERCADOLIBRE%2018042026%20-%20copia/.cursorrules) y [`.cursor/rules/main.mdc`](file:///c:/Users/ORLANDO/Documents/ANTIGRAVITY/MERCADOLIBRE%2018042026%20-%20copia/.cursor/rules/main.mdc) con convenciones de código, archivos calientes y módulos core a reutilizar.
- **📘 Documento Maestro de Arquitectura:** Consulta [`MASTER_BRAIN.md`](file:///MASTER_BRAIN.md) para el historial técnico consolidado de los Sprints 1 al 8.
- **📂 Estructura de Profit Plus:** Consulta [`PROFIT_MASTER_DB.md`](file:///PROFIT_MASTER_DB.md) para consultas SQL y estructura de tablas del ERP contable.

---

## 📦 Herramientas Destacadas

1. **Publicador Masivo Directo por API (Sprint 8):**
   - Web: `/dashboard/inventory` (Modal interactivo con streaming SSE).
   - Desktop: Ejecutar [`ML_Desktop_Publisher/PUBLICAR_DIRECTO_API.bat`](file:///ML_Desktop_Publisher/PUBLICAR_DIRECTO_API.bat) para procesar lotes con fotos locales en disco.
2. **Pool de IA Gemini 3.6 Flash:**
   - 4 API Keys rotando automáticamente para generar fichas técnicas con compatibilidad vehicular a 60 RPM.
3. **Catálogo de Pesos para Mercado Envíos (±300g):**
   - [`catalogo_pesos_mercadoenvios_300g.xlsx`](file:///catalogo_pesos_mercadoenvios_300g.xlsx) con cálculo de tara de empaque para evitar penalizaciones por sobrepeso en MRW/Zoom.
