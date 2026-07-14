import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/newnews.db');

console.log('[Radar Motor] Iniciando escaneo real de fuentes de debates y tendencias (Reddit, Menéame y Google Trends)...');

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

// Feeds RSS de Tendencias y Prensa
const rssFeeds = [
  { name: 'Google Trends ES', url: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=ES', platform: 'Google Trends' },
  { name: 'Menéame Portada', url: 'https://www.meneame.net/rss', platform: 'Menéame' },
  { name: 'Menéame Activas', url: 'https://www.meneame.net/rss?status=active', platform: 'Menéame' },
  { name: 'El Mundo España', url: 'https://www.elmundo.es/rss/portada.xml', platform: 'Prensa' },
  { name: 'El País Nacional', url: 'https://ep00.epimg.net/rss/elpais/portada.xml', platform: 'Prensa' },
  { name: 'ABC España', url: 'https://www.abc.es/rss/2.0/espana/', platform: 'Prensa' }
];

// Feeds JSON públicos de Reddit
const redditFeeds = [
  { name: 'Reddit SpainPolitics', url: 'https://www.reddit.com/r/spainpolitics/hot.json?limit=25', platform: 'Reddit' },
  { name: 'Reddit España', url: 'https://www.reddit.com/r/es/hot.json?limit=25', platform: 'Reddit' }
];

// Headers de navegador reales y refinados para evitar bloqueos
const userAgentHeader = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/xml, application/xml, */*',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
};

async function fetchRssFeed(feed) {
  const items = [];
  try {
    console.log(`[Radar Motor] Descargando RSS: ${feed.name}...`);
    const response = await fetch(feed.url, { headers: userAgentHeader });

    if (!response.ok) {
      console.log(`[Radar Motor] Advertencia: ${feed.name} respondió con estado ${response.status}`);
      return items;
    }

    const xml = await response.text();
    
    // Parsea los bloques <item> de forma tolerante a fallos
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
          platform: feed.platform,
          author: feed.platform + ' RSS',
          score: feed.platform === 'Menéame' ? 150 : 50, // Ponderación de partida
          comments: feed.platform === 'Menéame' ? 40 : 10
        });
      }
    }
    console.log(`[Radar Motor] -> ${feed.name}: Detectados ${items.length} elementos en bruto.`);
  } catch (err) {
    console.log(`[Radar Motor] ❌ Error descargando RSS ${feed.name}:`, err.message);
  }
  return items;
}

async function fetchRedditFeed(feed) {
  const items = [];
  try {
    console.log(`[Radar Motor] Descargando Reddit JSON: ${feed.name}...`);
    const response = await fetch(feed.url, { headers: userAgentHeader });

    if (!response.ok) {
      console.log(`[Radar Motor] Advertencia: ${feed.name} respondió con estado ${response.status}`);
      return items;
    }

    const data = await response.json();
    const children = data?.data?.children || [];
    
    for (const child of children) {
      const post = child.data;
      if (post && !post.pinned && !post.stickied) {
        items.push({
          title: post.title || '',
          link: `https://www.reddit.com${post.permalink}`,
          description: post.selftext || '',
          platform: 'Reddit',
          author: `u/${post.author || 'desconocido'}`,
          score: post.score || 0,
          comments: post.num_comments || 0
        });
      }
    }
    console.log(`[Radar Motor] -> ${feed.name}: Detectados ${items.length} posts.`);
  } catch (err) {
    console.log(`[Radar Motor] ❌ Error descargando Reddit ${feed.name}:`, err.message);
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
  const allItems = [];

  // 1. Cargar RSS feeds
  for (const feed of rssFeeds) {
    const feedItems = await fetchRssFeed(feed);
    allItems.push(...feedItems);
  }

  // 2. Cargar Reddit feeds
  for (const feed of redditFeeds) {
    const feedItems = await fetchRedditFeed(feed);
    allItems.push(...feedItems);
  }

  // 3. Procesar y filtrar items
  for (const item of allItems) {
    const titleLower = item.title.toLowerCase();
    const descLower = item.description.toLowerCase();
    
    // Filtrar deportes y entretenimiento ordinario
    const hasForbidden = forbiddenKeywords.some(kw => titleLower.includes(kw) || descLower.includes(kw));
    if (hasForbidden) continue;

    // Buscar relevancia sociopolítica
    const hasInteresting = interestingKeywords.some(kw => titleLower.includes(kw) || descLower.includes(kw));
    
    if (hasInteresting) {
      // Generar ID único basado en URL para evitar duplicados
      const id = `radar-${item.platform.toLowerCase()}-${Buffer.from(item.link).toString('base64').substring(0, 32)}`;
      
      // Clasificación preliminar del tema del debate
      let suggestedTopic = 'Economía y Sociedad';
      if (titleLower.includes('franco')) suggestedTopic = 'Mitos y Leyendas del Franquismo';
      else if (titleLower.includes('mena') || titleLower.includes('inmigr') || titleLower.includes('extranj')) suggestedTopic = 'Inmigración, Delincuencia y Ayudas';
      else if (titleLower.includes('begoña') || titleLower.includes('peinado') || titleLower.includes('sánchez')) suggestedTopic = 'Investigación Judicial a Begoña Gómez';
      else if (titleLower.includes('koldo') || titleLower.includes('ábalos') || titleLower.includes('mascarilla')) suggestedTopic = 'Caso Koldo y Sentencia del Tribunal Supremo';
      else if (titleLower.includes('okupa') || titleLower.includes('vivienda') || titleLower.includes('alquiler')) suggestedTopic = 'Vivienda y Okupación';

      // Calcular virality_score real basado en los datos
      let viralityScore = 5.0;
      if (item.platform === 'Reddit') {
        // En Reddit, valoramos votos y comentarios
        viralityScore = Math.min(10.0, 3.0 + (item.score / 50) + (item.comments / 20));
      } else if (item.platform === 'Menéame') {
        // En Menéame, el engagement en portada es alto
        viralityScore = Math.min(10.0, 4.0 + (item.comments / 30));
      } else if (item.platform === 'Google Trends') {
        viralityScore = 8.5; // Alta viralidad por búsquedas masivas estimadas
      }

      // Calcular risk_score por el tipo de tema sensible
      let riskScore = 6.0;
      if (suggestedTopic.includes('Inmigración') || suggestedTopic.includes('Judicial') || suggestedTopic.includes('Caso Koldo')) {
        riskScore = 8.5; // Temas de alta crispación social o riesgo legal
      }

      try {
        insertScrapedItem.run(
          id,
          item.platform,
          item.link,
          `${item.title}\n\n${item.description}`,
          item.author,
          JSON.stringify({ score: item.score, comments: item.comments }),
          item.title,
          suggestedTopic,
          viralityScore,
          riskScore
        );
        insertedCount++;
      } catch (dbErr) {
        // Duplicado ignorado
      }
    }
  }

  console.log(`\n[Radar Motor] Escaneo completado. Se han añadido ${insertedCount} nuevos debates y tendencias relevantes a scraped_items.`);
  db.close();
}

runRadar().catch(err => {
  console.error('[Radar Motor] Error ejecutando el escaneo:', err);
});
