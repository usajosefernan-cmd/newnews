import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/newnews.db');

console.log('[Radar Motor] Iniciando escaneo real de fuentes de desinformación y tendencias...');

// Palabras clave de interés institucional, legal, fiscal o social de España
const interestingKeywords = [
  'ley', 'impuesto', 'gobierno', 'bulo', 'okupa', 'okupación', 'migrante', 'frontera', 'subsidio',
  'ayuda', 'pensión', 'pensiones', 'boe', 'hacienda', 'fiscal', 'detención', 'delito', 'policía',
  'sánchez', 'feijóo', 'abascal', 'congreso', 'ine', 'empleo', 'paro', 'reforma', 'franco',
  'koldo', 'ábalos', 'mascarillas', 'begoña', 'peinado', 'audiencia', 'corrupción', 'fraude'
];

// Palabras clave para descartar contenido deportivo o de entretenimiento ordinario
const forbiddenKeywords = [
  'fútbol', 'futbol', 'eurocopa', 'copa américa', 'copa america', 'real madrid', 'barcelona',
  'fc barcelona', 'mbappé', 'mbappe', 'messi', 'ronaldo', 'partido', 'vs', 'contra', 'juego',
  'canción', 'película', 'cine', 'concierto', 'música', 'tenis', 'alcaraz', 'nadal', 'fórmula 1', 'f1',
  'liga', 'champions', 'fichaje', 'entrenamiento'
];

// Feeds RSS reales de verificación y tendencias en España
const rssFeeds = [
  { name: 'Maldita Factcheck', url: 'https://maldita.es/feed/factcheck/', platform: 'Maldita.es' },
  { name: 'Newtral Factcheck', url: 'https://www.newtral.es/feed/', platform: 'Newtral.es' },
  { name: 'Google Trends ES', url: 'https://trends.google.es/trends/trendingsearches/daily/rss?geo=ES', platform: 'Google Trends' }
];

async function fetchRssFeed(feed) {
  const items = [];
  try {
    console.log(`[Radar Motor] Descargando feed real: ${feed.name}...`);
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.log(`[Radar Motor] Advertencia: ${feed.name} respondió con estado ${response.status}`);
      return items;
    }

    const xml = await response.text();
    
    // Parsea de forma robusta los bloques <item> o <entry> usando expresiones regulares
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const matches = xml.matchAll(itemRegex);

    for (const match of matches) {
      const itemContent = match[1];
      
      const titleMatch = itemContent.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || itemContent.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
      const descMatch = itemContent.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemContent.match(/<description>([\s\S]*?)<\/description>/);
      
      if (titleMatch && linkMatch) {
        const title = titleMatch[1].trim().replace(/&lt;!\[CDATA\[|\]\]&gt;/g, '');
        const link = linkMatch[1].trim();
        const description = descMatch ? descMatch[1].trim().replace(/<\/?[^>]+(>|$)/g, "").substring(0, 300) : '';
        
        items.push({
          title,
          link,
          description,
          platform: feed.platform
        });
      }
    }
    console.log(`[Radar Motor] -> ${feed.name}: Detectados ${items.length} elementos en bruto.`);
  } catch (err) {
    console.log(`[Radar Motor] ❌ Error descargando ${feed.name}:`, err.message);
  }
  return items;
}

async function runRadar() {
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ La base de datos no existe en ${dbPath}.`);
    process.exit(1);
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');

  const insertScrapedItem = db.prepare(`
    INSERT OR IGNORE INTO scraped_items (id, platform, url, text, author_public_name, metrics_json, detected_claim, suggested_topic, virality_score, risk_score, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', datetime('now'))
  `);

  let insertedCount = 0;

  for (const feed of rssFeeds) {
    const feedItems = await fetchRssFeed(feed);
    
    for (const item of feedItems) {
      const titleLower = item.title.toLowerCase();
      const descLower = item.description.toLowerCase();
      
      // 1. Filtrar palabras prohibidas (fútbol, entretenimiento, etc.)
      const hasForbidden = forbiddenKeywords.some(kw => titleLower.includes(kw) || descLower.includes(kw));
      if (hasForbidden) continue;

      // 2. Comprobar relevancia sociopolítica o de verificación
      const hasInteresting = interestingKeywords.some(kw => titleLower.includes(kw) || descLower.includes(kw)) || feed.platform !== 'Google Trends';
      
      if (hasInteresting) {
        // Generar un ID único y limpio para la base de datos
        const id = `radar-${feed.platform.toLowerCase().replace('.', '-')}-${Buffer.from(item.link).toString('base64').substring(0, 32)}`;
        
        // Clasificación preliminar
        let suggestedTopic = 'Economía española';
        if (titleLower.includes('franco')) suggestedTopic = 'Mitos y Leyendas del Franquismo';
        else if (titleLower.includes('mena') || titleLower.includes('inmigr') || titleLower.includes('extranj')) suggestedTopic = 'Inmigración, Delincuencia y Ayudas';
        else if (titleLower.includes('begoña') || titleLower.includes('peinado') || titleLower.includes('sánchez')) suggestedTopic = 'Investigación Judicial a Begoña Gómez';
        else if (titleLower.includes('koldo') || titleLower.includes('ábalos') || titleLower.includes('mascarilla')) suggestedTopic = 'Caso Koldo y Sentencia del Tribunal Supremo';

        try {
          insertScrapedItem.run(
            id,
            item.platform,
            item.link,
            `${item.title}\n\n${item.description}`,
            item.platform + ' RSS',
            JSON.stringify({ feedSource: feed.name }),
            item.title,
            suggestedTopic,
            7.5, // Puntuación de viralidad por defecto para feeds de verificación
            8.0  // Puntuación de riesgo por defecto
          );
          insertedCount++;
        } catch (dbErr) {
          // Duplicado ignorado
        }
      }
    }
  }

  console.log(`\n[Radar Motor] Escaneo completado. Se han añadido ${insertedCount} nuevos elementos relevantes a scraped_items.`);
  db.close();
}

runRadar().catch(err => {
  console.error('[Radar Motor] Error ejecutando el escaneo:', err);
});
