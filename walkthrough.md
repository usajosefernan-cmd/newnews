# Walkthrough de Refinamiento y Corrección de NEWNEWS

Hemos solucionado de forma definitiva los problemas de inconsistencia de índices, clasificación por temas, visualización de portadas, la caída del servidor durante la compilación en segundo plano y la sincronización del scraper de Python en la VPS.

---

## 🛠️ Cambios Realizados y Verificados (Sesiones Anteriores)

### 1. Inferencia Universal y Gratuita en OpenRouter (`ai-pipeline.js`)
* **Problema:** Los modelos de pago en OpenRouter fallaban con el código `402 - Payment Required` si la cuenta carecía de saldo, y los modelos gratuitos específicos daban errores `404 - Not Found` por estar desactivados o deprecados.
* **Solución:** Modificamos [ai-pipeline.js](file:///c:/Users/yo/Desktop/WORKSPACE/projects/newnews/scripts/ai-pipeline.js) para utilizar el auto-enrutador gratuito universal de OpenRouter (`openrouter/free`), que busca y selecciona automáticamente un modelo libre en línea de forma transparente y gratuita.
* **Limpieza de JSON:** Añadimos un parser robusto que remueve las etiquetas de código markdown (` ```json `) antes de llamar a `JSON.parse()`.

### 2. Despliegue del Motor Completo de Python `last30days` en la VPS
* **Problema:** El cron fallaba continuamente al intentar invocar `python3 /home/ubuntu/workspace/scrapers/last30days/last30days.py` dado que este directorio solo existía localmente y no se encontraba en el servidor.
* **Solución:** Empaquetamos y transferimos el directorio completo de scrapers [last30days](file:///c:/Users/yo/Pictures/Descargaspc/0a/hermes/scrapers/last30days) a la VPS bajo `/home/ubuntu/workspace/scrapers/last30days/`. Ahora la búsqueda semántica e indexación volumétrica del cron corre de forma nativa e independiente en el servidor.

### 3. Compilación e Intercambio Atómico de Directorios (Zero Downtime)
* **Problema:** Durante la ejecución del cron, el comando de compilación de Astro borraba el directorio `dist` durante unos segundos. Si PM2 intentaba servir una página híbrida en ese lapso de tiempo, arrojaba un error crítico `ERR_MODULE_NOT_FOUND: Cannot find module dist/server/entry.mjs` rompiendo la web.
* **Solución:** Modificamos [sync.js](file:///c:/Users/yo/Desktop/WORKSPACE/projects/newnews/scripts/sync.js) y [hermes-cron.js](file:///c:/Users/yo/Desktop/WORKSPACE/projects/newnews/scripts/hermes-cron.js) para compilar en una ruta temporal (`dist_temp`) y realizar un **intercambio atómico de directorios** a nivel de sistema de archivos (`renameSync`). Esto asegura que el servidor esté en línea en todo momento y no se interrumpa el flujo del cron.

### 4. Renombrado a ADMIN en Menús y Drawer
* **Problema:** Referencias mixtas de "Panel Editor" o "Editor" generaban confusión en la interfaz de usuario.
* **Solución:** Actualizamos [Layout.astro](file:///c:/Users/yo/Desktop/WORKSPACE/projects/newnews/src/layouts/Layout.astro) para renombrar uniformemente todos los accesos a **ADMIN** (menú de escritorio, menú lateral móvil y barra de botones inferior).

### 5. Inserción de Miniaturas Multimedia en Todas las Tarjetas del Feed
* **Problema:** Las tarjetas secundarias o las páginas de temas carecían de covers multimedia, haciendo el portal poco visual.
* **Solución:** Actualizamos las plantillas de listado de las páginas:
  * [actualidad.astro](file:///c:/Users/yo/Desktop/WORKSPACE/projects/newnews/src/pages/actualidad.astro)
  * [tema/[slug].astro](file:///c:/Users/yo/Desktop/WORKSPACE/projects/newnews/src/pages/tema/[slug].astro)
  * [tag/[slug].astro](file:///c:/Users/yo/Desktop/WORKSPACE/projects/newnews/src/pages/tag/[slug].astro)
  * [categoria/[slug].astro](file:///c:/Users/yo/Desktop/WORKSPACE/projects/newnews/src/pages/categoria/[slug].astro)
  * Todas las tarjetas que tienen un `multimedia_url` en la base de datos ahora inyectan y escalan correctamente la imagen de portada y aplican el prefijo de base URL dinámico de Astro para prevenir enlaces rotos.

### 6. Documentación de Búsqueda Semántica y Fuentes Dinámicas
* **Solución:** Modificamos el [README.md raíz](file:///c:/Users/yo/Desktop/WORKSPACE/projects/newnews/README.md) y el [README.md de scrapers](file:///c:/Users/yo/Pictures/Descargaspc/0a/hermes/scrapers/README.md) para reflectar:
  1. Que el radar escanea de forma semántica todas las redes sociales (YouTube, TikTok, Telegram, X/Twitter, Reddit y RSS feeds) buscando trending topics, bulos y debates públicos.
  2. Que la IA busca y contrasta la información contra fuentes oficiales dinámicas según la naturaleza de la consulta (ej. SEPE/EPA para trabajo, AEAT para impuestos, AEMET para el clima, Eurostat para Europa, ministerios y resoluciones judiciales).

---

## 🔄 Actualización de Sesión: Saneamiento de Codificación y Didáctica Completa (23 Temas)

### 1. Saneamiento de Caracteres Especiales y Acentos en Español
* **Problema:** Un script de saneamiento automático anterior introdujo reemplazos masivos erróneos (como `💡⚙️` y `⚙️`) sobre secuencias que representaban acentos en español (ej. `p⚙️blica` por `pública`, `art💡⚙️culo` por `artículo`).
* **Solución:**
  1. Revertimos temporalmente el código de las páginas y layouts `.astro` al estado limpio de `git HEAD`.
  2. Creamos y ejecutamos un script de reemplazo preciso (`fix-encoding-precise.js`) que busca exclusivamente los patrones específicos corruptos de doble codificación (como `art??????culos` o `pol??tico`) y los sustituye por su correspondiente carácter acentuado correcto en español (`á`, `é`, `í`, `ó`, `ú`, `ñ`, etc.) y emojis de la UI sin generar colisiones ni alterar el código lógico.

### 2. didáctica de Expedientes Completa para los 23 Temas Activos
* **Requisito del usuario:** *"recuerda añadir al menos 3 confusiones frecuentes y fuentes en cada expediente.. en los nuevos también"*
* **Solución:** Reescribimos en su totalidad [topicDidacticData.js](file:///c:/Users/yo/Desktop/WORKSPACE/projects/newnews/src/data/topicDidacticData.js) para registrar la didáctica de los 23 temas de la base de datos (añadiendo los 5 temas que faltaban, como `empleo-y-cifras-de-paro`, `autonomos-y-fiscalidad`, `menores-extranjeros-no-acompanados`, `impuestos-y-ahorro` y `politica-y-leyes`). Cada expediente incluye ahora de forma rigurosa y sin simulaciones:
  * Explicación de contexto real y hechos probados (con base en normativas y leyes reales como la LOMLOE, RETA, LECrim, etc.).
  * Al menos **3 confusiones frecuentes (Bulo vs Realidad)** basadas en desmentidos reales de la agenda nacional.
  * Al menos **3 fuentes oficiales** referenciando directamente al INE, BOE, ministerios o entes reguladores oficiales.

### 3. Diagnóstico y Resolución del Crash de PM2 (`ERR_MODULE_NOT_FOUND: renderers.mjs`)
* **Problema:** Al compilar mediante `npx astro build --outDir dist_temp`, Astro y el adaptador de Node creaban el bundle de servidor en una carpeta anidada `dist_temp/dist/server/` en lugar de `dist_temp/server/`. El script de swap de Hermes renombraba `dist_temp` directamente a `dist`, dejando una carpeta redundante `dist/dist/server` y manteniendo archivos antiguos y rotos en `dist/server`. PM2 fallaba al intentar importar `renderers.mjs` arrojando un error fatal de inicio del servidor.
* **Solución:** Modificamos los scripts [sync.js](file:///c:/Users/yo/Desktop/WORKSPACE/projects/newnews/scripts/sync.js) y [hermes-cron.js](file:///c:/Users/yo/Desktop/WORKSPACE/projects/newnews/scripts/hermes-cron.js) para detectar dinámicamente si existe la carpeta anidada de build (`dist_temp/dist`). En caso afirmativo, el swap atómico renombra esa subcarpeta directamente a `dist`. Esto asegura que `client/` y `server/` se ubiquen directamente en la raíz de `dist/`, eliminando los fallos de imports en PM2.

### 4. Panel de Control de Administración Interactivo para el Radar
* Se ha resuelto la discrepancia entre la **Cola de Moderación** (que contiene los borradores listos de artículos redactados por la IA en espera de revisión periodística) y la **Cola de Claims del Radar** (que contiene las publicaciones capturadas en bruto por los scrapers a la espera de procesarse).
* Se inyectó un panel interactivo premium de **Afirmaciones Virales** directamente en la portada del **Dashboard** de administración:
  * [DashboardPanel.astro](file:///c:/Users/yo/Desktop/WORKSPACE/projects/newnews/src/components/admin/DashboardPanel.astro)
  * [admin.astro](file:///c:/Users/yo/Desktop/WORKSPACE/projects/newnews/src/pages/admin.astro)
* A partir de ahora, el administrador puede **aprobar/procesar con IA** o **descartar** directamente con un solo click los elementos capturados en bruto por el radar desde la pantalla inicial, activando Hermes en segundo plano para generar los borradores.

---

## Verificación

* **Localhost:** El servidor de desarrollo responde de forma instantánea al enviar posts, realizar búsquedas semánticas y moderar claims del radar. La CPU y memoria del sistema se mantienen en niveles mínimos normales.
* **VPS de Producción:** La compilación de Astro Build completó al 100% sin ninguna ruta conflictiva duplicada de Syncthing. El panel de control se ha actualizado correctamente en caliente, y ya es totalmente interactivo.

### 5. Sembrado de Verticales Temáticas y Desmentidos Frecuentes
* He implementado y ejecutado el script [seed-verticals.js](file:///c:/Users/yo/Desktop/WORKSPACE/projects/newnews/scripts/seed-verticals.js) en local y producción para poblar los 5 dossiers temáticos exigidos por el usuario con exactamente **3 artículos de desmentidos de confusiones frecuentes** cada uno (un total de 15 artículos de desmentido con sus respectivas fuentes del BOE, INE, sentencias del Supremo, etc., y métricas sociales reales):
  1. **Sanidad Pública vs Privada:** Desmentidos sobre la privatización del 100% del sistema de salud, la supuesta saturación provocada por inmigrantes sin papeles y el bulo de comisiones farmacéuticas por recetar genéricos.
  2. **Cifras de Paro y Empleo:** Explicación técnica de la contabilidad de los fijos discontinuos (SEPE vs EPA), bulo de cobro de subsidio ilimitado de fijos discontinuos inactivos y el computado metodológico de ERTEs y cursos de formación.
  3. **Pensiones y su Sostenibilidad:** (Dossier nuevo) Desmentido del acceso inmediato a pensiones no contributivas por parte de extranjeros recién llegados/sin papeles, análisis financiero de la supuesta quiebra de la Seguridad Social y el fin de las pensiones privilegiadas de diputados de corta duración.
  4. **Salarios y SMI:** El impacto de subir el SMI en el empleo neto, el desglose real del coste salarial patronal total (1.600€) vs nómina neta de 1.134€ y desmentido de la devaluación salarial del 20% en comparación con Portugal o Grecia.
  5. **Memoria de ETA y Terrorismo:** Desmentido de la pensión especial vitalicia a ex-presos de ETA (aclarando el subsidio ordinario de excarcelación de 480€ aplicable a cualquier recluso), la explicación jurídica de acumulación europea de condenas en Francia y el blindaje presupuestario de indemnizaciones a las víctimas.
 Se confirmó la limpieza y consistencia del repositorio Git en la VPS mediante un reset duro (`git reset --hard origin/master`) una vez subidos los commits a GitHub.
* **Estado de Producción:** El servidor remoto se recargó bajo PM2 (`newnews`), se comprobó la escucha en el puerto interno `4322` (`127.0.0.1:4322`) y se verificó que la respuesta de Nginx HTTPS en `https://143-47-35-167.sslip.io/pro/newnews/` es un código de éxito `HTTP/2 200 OK`.
