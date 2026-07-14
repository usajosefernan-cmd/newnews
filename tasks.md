# 📋 Cerebro Externo: Swarm Tasks - NEWNEWS Advanced Optimization

## 🚀 Hitos del Proyecto
- [ ] **Hito 1: Saneamiento y Enlace Real de Orígenes**: Eliminar los mocks y URLs ficticias en las semillas y asegurar que los links a bulos y publicaciones originales apunten a URLs reales de X, Reddit o Telegram.
- [ ] **Hito 2: Panel de Administración Editorial Total**: Ampliar `/admin` para gestionar todos los recursos (Partidos, Propuestas, Promesas y Bienes) y permitir la ejecución real de scripts de sincronización (`radar`, `ai-pipeline`, `build`) desde la propia web capturando sus logs.
- [ ] **Hito 3: Verticales Temáticos Profundos**: Completar `educationalCards` e `infographicData` en `src/pages/tema/[slug].astro` para todos los temas activos y optimizar su legibilidad.
- [ ] **Hito 4: Sistema de Actualidad (Feed), Categorías, Tags y Fuentes Ocultables**: Crear `/actualidad` (Feed ordenado por fecha), rutas dinámicas para `/categoria/[slug]` y `/tag/[slug]`, y hacer las fuentes técnicas de noticia/[slug].astro ocultables bajo un acordeón plegable.
- [ ] **Hito 5: Pruebas de Regresión y Carga Local**: Compilar el proyecto con Astro, verificar la navegación completa en el localhost (puerto 4321) y comprobar que todos los links nuevos creados funcionen correctamente.

## 🛠️ Grafo de Tareas (DAG)

### Backlog
- [x] real-links: Saneamiento de URLs de origen y fuentes institucionales en base de datos y semillas | Depende de: Ninguna | Asignado a: Antigravity | Estado: completed
- [x] admin-total-management: Ampliar el panel de control editorial para que gestione partidos, propuestas, promesas y bienes, y dotar de control de procesos real | Depende de: Ninguna | Asignado a: Antigravity | Estado: completed
- [x] topic-verticals-expansion: Completar el material educativo y visual de todas las verticales de temas en tema/[slug].astro | Depende de: real-links | Asignado a: Antigravity | Estado: completed
- [x] social-actualidad-feed: Añadir feed de actualidad /actualidad, páginas por categorías/tags, y fuentes ocultables en desmentidos | Depende de: topic-verticals-expansion | Asignado a: Antigravity | Estado: completed
- [x] regression-audit-check: Validar en localhost, verificar enlaces y asegurar la compilación estática completa | Depende de: social-actualidad-feed | Asignado a: Antigravity | Estado: completed

### En Progreso

### Completadas
- [x] init-setup: Configuración inicial del nuevo sprint con /goal | Depende de: Ninguna | Asignado a: Antigravity | Estado: completed
