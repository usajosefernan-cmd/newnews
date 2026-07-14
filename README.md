# NEWNEWS — Radar de Desinformación y Contraste de Hechos (España)

Iniciativa tecnológica neutral diseñada para detectar bulos virales, auditar promesas políticas y educar a los ciudadanos en debates nacionales complejos utilizando únicamente **fuentes oficiales primarias y directas del Estado** (sin intermediarios ni portales de fact-checking tradicionales).

---

## 📖 Idea y Filosofía del Proyecto (Para el Usuario)

### ¿Por qué existe NEWNEWS?
La mayoría de los servicios de verificación de datos (*fact-checkers*) son criticados por falta de transparencia, sesgos editoriales o por utilizar sus propias narrativas como única fuente de verdad. 

**NEWNEWS rompe este paradigma:**
1. **Fuentes 100% Primarias**: No confiamos en interpretaciones de terceros. Si una afirmación habla de una ley, enlazamos al **Boletín Oficial del Estado (BOE)**. Si habla de desempleo, enlazamos a la **Encuesta de Población Activa (EPA) del INE**.
2. **Radar Automático**: Escaneamos de forma continua redes sociales (Reddit, Telegram, X/Twitter) y tendencias nacionales (Google Trends) para capturar bulos e identificar qué temas están generando más ruido y crispación social.
3. **Didáctica e Inmersión**: Las páginas verticales de temas desglosan las regulaciones de forma muy visual y objetiva, traduciendo la jerga legal a explicaciones llanas y aportando datos fríos de magnitud.
4. **Comparación Política Directa**: Un comparador interactivo permite evaluar objetivamente los programas electorales y el patrimonio declarado por los líderes frente a los datos reales y leyes vigentes.

---

## 🛠️ Guía del Desarrollador (Para el Programador)

### Arquitectura de la Web
- **Frontend**: Desarrollado bajo la arquitectura estática ultrarrápida de **Astro** y **Vanilla CSS**.
- **Base de Datos**: SQLite local integrada en `data/newnews.db` para una portabilidad total y cero dependencias de bases de datos externas pesadas durante el desarrollo.
- **Motor de Scraping (Radar)**: Scripts modulares en Node.js que consultan feeds RSS, APIs JSON y proxies públicos Nitter para monitorizar redes.

### Estructura de Base de Datos (Esquema Clave)
- `topics`: Cabeceras de temas (ej. Vivienda, Autónomos, Inmigración).
- `articles`: Desmentidos validados (con campos de `what_is_true`, `what_is_false`, `explanation`).
- `sources`: Tabla con enlaces a documentos del BOE, INE, etc. vinculados a cada artículo.
- `official_sources`: Catálogo verificado de fuentes primarias gubernamentales.
- `scraped_items`: Elementos en bruto capturados por el radar en espera de auditoría.
- `radar_sources`: Fuentes activas de monitoreo (RSS, Reddit subreddits, canales de Telegram, handles de X).

---

## 🚀 Puesta en Marcha (Localhost)

### Requisitos previos
- Node.js (versión 18 o superior).

### Instalación y Ejecución
1. Instala las dependencias del proyecto:
   ```bash
   npm install
   ```
2. Ejecuta las migraciones e inicializa el esquema de base de datos SQLite:
   ```bash
   npm run db:migrate
   ```
3. Semilla la base de datos con los datos políticos y los expedientes base:
   ```bash
   npm run db:seed
   ```
4. Inicia el servidor de desarrollo local (Astro dev):
   ```bash
   npm run dev:hot
   ```
   El portal estará accesible inmediatamente en **http://localhost:4321/** con recarga en caliente (*Hot Module Replacement*).

---

## 📡 Procesos de Automatización y Scripts

El backend funciona mediante scripts programados (`cron jobs`) ejecutables desde la terminal o desde el Panel Editor integrado (`/admin`):

- **Ejecutar Radar Scraper**: Escanea y descarga los debates de las redes registradas.
  ```bash
  npm run radar
  ```
- **Limpieza de Datos**: Limpia artículos y fuentes simuladas restableciendo la base de datos a un estado limpio de producción.
  ```bash
  node scripts/clean-and-rebuild.js
  ```
- **Compilar para Producción (SSG)**: Compila todo el portal a páginas HTML estáticas en la carpeta `/dist`.
  ```bash
  npm run build
  ```
