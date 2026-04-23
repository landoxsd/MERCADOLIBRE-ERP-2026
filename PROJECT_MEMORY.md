# 🧠 MEMORIA DEL PROYECTO: MERCADOLIBRE ERP 2026

Este documento es el **Punto de Control (Breakpoint)** maestro. Su objetivo es proporcionar contexto inmediato a cualquier IA o desarrollador que inicie una nueva sesión, asegurando la continuidad de los roles y la arquitectura.

---

## 🎭 ROLES ESTABLECIDOS
*   **DIRECTOR (USER):** Arquitecto de Negocio, Especialista en Mercado Libre y Operaciones de Autopartes (Profit Plus / Integraly). Dicta la visión estratégica y valida la funcionalidad en producción.
*   **ANTIGRAVITY (AI):** Desarrollador Full-Stack Lead. Responsable de la lógica compleja, integración de APIs de Meli, diseño de DB (Supabase) y elegancia de la UI (Next.js).

---

## 🏗️ ARQUITECTURA Y MÓDULOS
El sistema está construido para ser escalable mediante micro-servicios internos (API Routes) en Next.js.

### 1. Núcleo de Autenticación (`src/lib/meli-auth-helper.js`)
*   **Función:** Gestiona el OAuth2 de Mercado Libre, el refresco automático de tokens y la persistencia en Supabase.
*   **Estado:** Estable. Soporta múltiples cuentas de forma aislada.

### 2. Motor de Sincronización (`src/api/account/publications/sync/`)
*   **Función:** Realiza barridos (scroll) en la API de Meli para bajar el catálogo.
*   **Estado:** Optimizado. Se corrigió el bug de "items cerrados" mediante un barrido de 3 pasadas (Active, Paused, Closed). Ahora guarda el `raw_data` (JSON completo) para futuras extracciones.

### 3. Auditoría de Inventario (`src/app/api/inventory/upload/`)
*   **Función:** Cruza un Excel local (Profit Plus) contra la DB de Meli.
*   **Estado:** Funcional. Maneja volúmenes masivos (>41k registros) con paginación de Supabase. Posee sistema de **Caché Snapshot** (archivo local `.audit_cache_${accId}.json`) para persistencia por cuenta.

### 4. Exportador Integraly (`src/app/dashboard/inventory/page.js`)
*   **Función:** Genera un archivo `.xlsx` con la estructura exacta que requiere la plataforma Integraly para mapear SKUs masivamente.

---

## 🚩 ESTADO ACTUAL Y SIGUIENTES PASOS (TODO)

### ✅ COMPLETADO
- [x] Multi-cuenta funcional con cookies.
- [x] Sincronización de ítems "Cerrados/Finalizados".
- [x] Descarga de Excel formato Integraly.
- [x] Persistencia de la última auditoría en caché.
- [x] Columna `raw_data` en Supabase para historial total.
- [x] Cronómetros de rendimiento en botones.
- [x] **Detector de Faltantes Globales** (Skill #7).
- [x] **Procesador de Notas de Recepción Proactivo** (Skill #8).
- [x] **Mecanismo de Batching (2000 ítems):** Eliminados los "Statement Timeouts".
- [x] **Aislamiento de UI (Tabs):** Previene pausar huérfanos por accidente.

### 🎯 PRÓXIMOS OBJETIVOS (Prioridad en orden)
1.  **Módulo de Ventas y Visitas:** Implementar el tablero de analíticas usando los datos ya sincronizados para medir el rendimiento real por publicación.
2.  **Extractor Universal:** Crear scripts que aprovechen la columna `raw_data` para extraer descripciones o variaciones sin llamar a la API.

---

## 📈 ESTRATEGIA DE ESCALABILIDAD Y RESPALDOS
Para asegurar que el proyecto se pueda mudar de máquina o sesión sin pérdidas:

1.  **🚀 RESPALDOS GITHUB:** 
    - **Frecuencia:** Obligatorio después de cada "Tarea Grande" completada o al final de la jornada. 
    - **Regla:** Nunca cerrar sesión sin un `git push`.
2.  **🔒 SEGURIDAD:** 
    - Las API Keys y DB URLs se mantienen en el `.env` local.
    - El repositorio GitHub debe ser **PRIVADO** siempre.
3.  **🔄 CONTINUIDAD IA:** 
    - Si cambias de IA o de conversación, pega este documento (`PROJECT_MEMORY.md`) como primer mensaje para "saltar" la curva de aprendizaje de la nueva entidad.

---

## 🛠️ PROTOCOLO DE MANTENIMIENTO DE MEMORIA
Para asegurar la continuidad eterna del proyecto, se seguirán estas reglas:
1.  **Actualización de Memoria:** Al finalizar cada hito funcional o cambio estructural. Se actualiza el TODO y el timestamp.
2.  **Actualización de Skills:** Cada vez que se domine una nueva capacidad técnica o se optimice radicalmente un proceso existente.
3.  **Respaldo Exitoso:** Nunca cerrar sesión sin un `git push` previo.
4.  **Caché:** Los archivos `.audit_cache_*.json` son temporales y no se versionan, pero son vitales para la persistencia en caliente de la sesión.

---
*Última actualización: 2026-04-23 00:55 (Auditoría Finalizada y Blindada)*.
