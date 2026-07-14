# 📡 NEWNEWS: Portal de Verificación y Cortafuegos de Desinformación

NEWNEWS es una plataforma autónoma e inteligente de auditoría de hechos, desmentidos y contrastación con bases de datos públicas de España (BOE e INE). Diseñado en base al Código Deontológico de la FAPE, el sistema monitoriza redes sociales, detecta debates de alto impacto, extrae evidencias multimedia de origen, computa índices de riesgo y compila en caliente desmentidos neutrales.

---

## 🏗️ Arquitectura y Tecnologías
El proyecto está construido sobre un stack moderno, descentralizado y de alto rendimiento:
* **Framework Frontend/Backend:** Astro v4 (Configurado en modo híbrido: SSR para APIs dinámicas y SSG para páginas estáticas de carga instantánea).
* **Base de Datos:** SQLite 3 (Configurado en modo WAL para concurrencia ininterrumpida y transacciones seguras).
* **Motor de IA:** Gemini 2.5 Flash API (Fallback local a base de datos de actualidad si no hay conexión o API Key).
* **Orquestación en Servidor (VPS):** PM2 (Daemon persistente) + Nginx (Reverse proxy en `/pro/newnews/`) + Cron de Unix.

---

## 📁 Estructura del Repositorio
* **`src/pages/`**: Páginas de la web en Astro.
  * `index.astro`: Portada con feed, "Confusómetro" y Código Deontológico.
  * `interceptor.astro`: Buzón de reporte público con radar y barrido láser en CSS.
  * `admin.astro`: Panel de control editorial, aprobación de borradores y terminal de logs en vivo.
  * `noticia/[slug].astro`: Ficha detallada del hilo de verificación, embeds interactivos y evidencias multimedia de origen.
* **`src/pages/api/`**: Endpoints de procesamiento del servidor.
  * `report.js`: Recibe reportes, detecta duplicados, computa índices (Viral, Social, Riesgo) y devuelve un NDJSON stream.
  * `run-job.js`: Ejecuta tareas de administración en caliente mediante `spawn` y transmite `stdout` en tiempo real.
* **`scripts/`**: Scripts de automatización del motor.
  * `radar-cron.js`: Escanea dinámicamente X/Twitter (Nitter RSS) y Reddit en busca de tendencias virales.
  * `check-url.js`: Valida accesibilidad y extrae metadatos y visualizaciones localizadas de YouTube/TikTok/Prensa.
  * `ai-pipeline.js`: Pipeline de procesamiento por IA que redacta desmentidos basados en leyes del BOE y datos del INE.
  * `sync.js`: Sincroniza e indexa los expedientes temáticos ("temas").
  * `hermes-cron.js`: Orquestador global que ejecuta Radar -> IA -> Sincronización -> Compilación Astro.
* **`scrapernewnews/`**: Manuales de ingeniería detallados del scraper, filtros y consola editorial.

---

## ⚡ Configuración y Puesta en Marcha

### 1. Variables de Entorno (`.env`)
Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:
```env
# Claves de APIs
GEMINI_API_KEY=tu_clave_de_gemini_aqui

# Rutas del Proyecto
SQLITE_DB_PATH=data/newnews.db
PUBLIC_BASE_PATH=/pro/newnews
```

### 2. Instalación de Dependencias
```bash
npm install
```

### 3. Migración y Semillas de Datos
Inicializa la base de datos SQLite y siembra los temas base y noticias históricas de España:
```bash
node scripts/migrate.js
```

### 4. Servidor de Desarrollo Local
Para levantar el portal en local en el puerto `4321`:
```bash
npm run dev
```

### 5. Compilación y Despliegue en Producción (VPS)
Para compilar los activos estáticos y recargar el daemon de PM2:
```bash
npm run build
pm2 reload newnews
```

---

## ⚖️ Código Deontológico NEWNEWS
Toda la automatización y redacción del portal se basa en los estándares de deontología periodística:
1. **Neutralidad Editorial:** Separación estricta entre opinión e información. Se detecta el hype comercial, clickbait y se desvelan los enlaces de referidos.
2. **Fuentes Primarias:** Queda estrictamente prohibido delegar la verificación en agencias secundarias (Newtral, Maldita). Los contrastes se hacen directamente con el BOE, el INE y resoluciones judiciales.
3. **Independencia Financiera:** NEWNEWS no recibe financiación y sus desmentidos son objetivos y puramente factuales.
