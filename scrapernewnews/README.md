# 🛰️ Ingeniería del Motor de Scraping, Auditoría y Editor Editorial

Este documento detalla el funcionamiento interno del scraper de red dinámico, la extracción de metadatos multimedia, el cálculo de los tres índices de relevancia (Viral, Social, Riesgo) y la consola de administración en vivo.

---

## 1. 📡 El Motor de Búsqueda Dinámico (`radar-cron.js`)
El script de escaneo de tendencias realiza búsquedas dinámicas a lo largo de redes sociales para capturar claims potencialmente falsos o manipulados:
* **X/Twitter (Nitter RSS Engine):** Monitoriza debates mediante instancias públicas descentralizadas de Nitter. Realiza consultas por palabras clave neutrales sobre la actualidad socioeconómica en lugar de perfiles de políticos.
* **Reddit (JSON Search API):** Consulta la API JSON de Reddit (`r/all/search.json`) buscando disputas e hilos virales de usuarios activos.
* **Filtros por Word Boundaries (`\b`):** Para evitar falsos positivos y errores de catalogación (como asociar partidos de fútbol a la memoria histórica o noticias sobre "paro cardíaco" a las cifras de desempleo), el motor exige límites de palabras exactas. Por ejemplo:
  `/\bfranco\b/i` para Memoria Histórica, y `/\bparo\b/i` para Desempleo.
* **Fallback por defecto:** Cualquier noticia reportada o capturada que no encaje en una categoría temática específica se cataloga por seguridad en la sección **"Economía española y sociedad"** en lugar de ir a secciones ideológicas sensibles.

---

## 2. 🔍 Verificador de Recursos y Metadatos (`check-url.js`)
Es el componente encargado de validar cada enlace sospechoso en caliente:
* **Extracción de Portada (OG Image):** Analiza el HTML crudo en busca de metadatos `og:image` o `twitter:image` para capturar la miniatura original del bulo (estilo AIDAILY). Si se detecta, se almacena en la base de datos y se renderiza en la cabecera del desmentido.
* **Localización de Reproducciones (YouTube Views):** YouTube formatea las visualizaciones según la región del cliente (ej: `241,004 views` vs `241.004 visualizaciones`). El scraper implementa un regex multinivel:
  1. `viewCount` plano en JSON.
  2. `simpleText` localizado (ej: `visualizaciones` o `views`).
  3. `videoViewCountRenderer` anidado.
  Esto garantiza que el motor nunca asigne "0 reproducciones" por fallos de traducción de YouTube en la VPS.

---

## 3. 📊 Cortafuegos e Índices de Relevancia (`report.js` API)
Cuando un enlace se reporta, el endpoint ejecuta un análisis de triple índice:
1. **Índice de Viralidad (IV) [0-10]:** Escala logarítmica calculada en base a las reproducciones en origen.
   $$\text{IV} = \min(10.0, \log_{10}(\text{visitas} + 1) \times 1.5)$$
   * 100k visualizaciones = `7.5/10` (Urgencia Crítica).
   * 240k visualizaciones = `8.1/10` (Supera cortafuegos de inmediato).
2. **Índice de Impacto Social (IIS) [0-10]:** Ponderación automática según la temática. La política, leyes del BOE y cotizaciones de la Seguridad Social se evalúan en `9.0/10`.
3. **Índice de Riesgo de Desinformación (IRD) [0-10]:** Evalúa la presencia de lenguaje sensacionalista ("zasca", "humilla") o la existencia de enlaces de afiliados/referidos directos u ocultos.
* **Resolución de Duplicados en Vivo:** Escanea la base de datos de desmentidos publicados de la VPS en busca de palabras clave coincidentes. Si el bulo ya fue verificado, detiene el procesamiento y devuelve de inmediato al usuario el enlace para su lectura.

---

## 4. 🤖 Pipeline de Redacción Deontológica (`ai-pipeline.js`)
* **Código Deontológico:** El prompt prohíbe taxativamente usar agencias de fact-checking secundarias (Newtral, Maldita). Los argumentos deben contrastarse directamente con fuentes del BOE y el INE.
* **Detección de Sesgo Comercial:** Si el claim trata sobre una herramienta de IA o software, la IA audita si el post original contiene enlaces de referidos y explica en un apartado detallado al lector la existencia de intereses económicos privados detrás de la review.
* **Base de Datos Local:** Si no hay conexión con Gemini, el script procesa la reclamación localmente utilizando una base de datos predefinida de 9 temas de actualidad (Seguridad Social, delincuencia juvenil, Begoña Gómez, caso Koldo, Ley de Vivienda, etc.).

---

## 🖥️ 5. Consola Editorial y Logs en Caliente (`admin.astro` & `run-job.js`)
* **Subproceso en Vivo:** Los botones del panel de control realizan peticiones HTTP POST a `/api/run-job`. El backend lanza el script solicitado en la VPS usando `spawn` de Node.js.
* **Stream en Tiempo Real:** El `stdout` y `stderr` del subproceso se capturan y se transmiten línea a línea a la terminal del navegador usando un stream NDJSON (`ReadableStream`), permitiendo depurar en vivo sin recargas.
