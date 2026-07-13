import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/newnews.db');

console.log('[Radar Cron] Iniciando radar de detección (filtrado de desinformación)...');

// Mocks realistas de desinformación y debate social caliente en España (excluyendo partidos de fútbol y entretenimiento)
const itemsMocks = [
  {
    platform: 'X (Twitter)',
    url: 'https://twitter.com/alertamock/status/12345',
    text: 'ATENCIÓN: A partir de la semana que viene, el gobierno cobrará un impuesto especial del 5% a todos los depósitos bancarios de más de 10.000 euros para financiar las nuevas ayudas de vivienda.',
    author_public_name: 'AlertaEsp_99',
    metrics_json: JSON.stringify({ retweets: 1540, likes: 3200 }),
    detected_claim: 'El gobierno impondrá un impuesto del 5% a los depósitos bancarios de más de 10.000€.',
    suggested_topic: 'Impuestos, ahorro y pensiones',
    virality_score: 8.5,
    risk_score: 9.0
  },
  {
    platform: 'Instagram',
    url: 'https://instagram.com/p/mockimg99',
    text: 'Vídeo donde se ve a un grupo de jóvenes peleándose con la policía. El texto dice: Los MENAS campan a sus anchas en Madrid y tienen prohibido ser detenidos por orden del ministerio.',
    author_public_name: 'patriota_espanol',
    metrics_json: JSON.stringify({ views: 45000, likes: 9800 }),
    detected_claim: 'Existe una orden ministerial que prohíbe detener a menores extranjeros no acompañados.',
    suggested_topic: 'Menores Extranjeros No Acompañados (MENAS)',
    virality_score: 9.2,
    risk_score: 9.5
  },
  {
    platform: 'TikTok',
    url: 'https://tiktok.com/@infoverdad/video/7777',
    text: '¿Sabías que Franco creó la paga extra de Navidad en España? Sin él, los trabajadores no tendrían su aguinaldo de diciembre. Comparte para que no se olvide.',
    author_public_name: 'historia_real_es',
    metrics_json: JSON.stringify({ shares: 12000, plays: 250000 }),
    detected_claim: 'Francisco Franco inventó la paga extraordinaria de Navidad en España.',
    suggested_topic: 'Franco, franquismo y bulos virales',
    virality_score: 7.9,
    risk_score: 6.0
  },
  {
    platform: 'X (Twitter)',
    url: 'https://twitter.com/inmo_alerta/status/9876',
    text: 'Con la nueva Ley de Vivienda, si sales a comprar el pan y te okupan el piso, la policía tarda 2 años en poder desahuciar al okupa porque la ley les protege.',
    author_public_name: 'InmoRealidad',
    metrics_json: JSON.stringify({ retweets: 4800, likes: 7200 }),
    detected_claim: 'La Ley de Vivienda impide desalojar okupaciones en primera residencia antes de dos años.',
    suggested_topic: 'Vivienda, alquileres y okupación',
    virality_score: 9.0,
    risk_score: 8.5
  },
  {
    platform: 'Telegram',
    url: 'https://t.me/noticias_patriotas/990',
    text: 'URGENTE: La nueva reforma de pensiones reducirá un 15% las jubilaciones de los nacidos a partir de 1970 para compensar el gasto público.',
    author_public_name: 'NoticiasPatria',
    metrics_json: JSON.stringify({ views: 24000 }),
    detected_claim: 'La reforma de pensiones reducirá un 15% las jubilaciones de los nacidos después de 1970.',
    suggested_topic: 'Impuestos, ahorro y pensiones',
    virality_score: 8.0,
    risk_score: 8.8
  }
];

// Lista de palabras no deseadas (deportes, entretenimiento, partidos comunes)
const forbiddenKeywords = [
  'fútbol', 'futbol', 'eurocopa', 'copa américa', 'copa america', 'real madrid', 'barcelona',
  'fc barcelona', 'mbappé', 'mbappe', 'messi', 'ronaldo', 'partido', 'vs', 'contra', 'juego',
  'canción', 'película', 'cine', 'concierto', 'música', 'tenis', 'alcaraz', 'nadal', 'fórmula 1', 'f1'
];

// Lista de palabras de interés para auditoría (política, fiscal, social, legal)
const interestingKeywords = [
  'ley', 'impuesto', 'gobierno', 'bulo', 'okupa', 'okupación', 'migrante', 'frontera', 'subsidio',
  'ayuda', 'pensión', 'pensiones', 'boe', 'hacienda', 'fiscal', 'detención', 'delito', 'policía',
  'sánchez', 'feijóo', 'abascal', 'congreso', 'ine', 'empleo', 'paro', 'reforma'
];

async function runRadar() {
  let detectedTrends = [];

  try {
    console.log('[Radar Cron] Fetching Google Trends RSS de España...');
    const response = await fetch('https://trends.google.es/trends/trendingsearches/daily/rss?geo=ES');
    if (response.ok) {
      const content = await response.text();
      const matches = content.matchAll(/<title>([^<]+)<\/title>/g);
      for (const match of matches) {
        const trendText = match[1].trim();
        const trendTextLower = trendText.toLowerCase();

        // 1. Descartar si coincide con términos deportivos o de entretenimiento
        const hasForbidden = forbiddenKeywords.some(kw => trendTextLower.includes(kw));
        if (hasForbidden) continue;

        // 2. Comprobar si tiene algún término de debate o actualidad institucional relevante
        const hasInteresting = interestingKeywords.some(kw => trendTextLower.includes(kw));

        if (hasInteresting && trendText !== 'Daily Trends' && trendText !== 'Google Trends') {
          detectedTrends.push(trendText);
        }
      }
      console.log(`[Radar Cron] Tendencias relevantes de actualidad detectadas: ${detectedTrends.length > 0 ? detectedTrends.join(', ') : 'Ninguna que requiera verificación'}`);
    } else {
      console.log(`[Radar Cron] Advertencia: RSS respondió con estado ${response.status}`);
    }
  } catch (err) {
    console.log('[Radar Cron] Error descargando RSS (modo offline activo):', err.message);
  }

  // Conectar a SQLite
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

  let count = 0;

  // Insertar los bulos mockeados (que son 100% de desinformación real en España)
  itemsMocks.forEach((item, index) => {
    const id = `scraped-${Date.now()}-${index}`;
    try {
      insertScrapedItem.run(
        id,
        item.platform,
        item.url,
        item.text,
        item.author_public_name,
        item.metrics_json,
        item.detected_claim,
        item.suggested_topic,
        item.virality_score,
        item.risk_score
      );
      count++;
    } catch (dbErr) {
      // Ignorar duplicados
    }
  });

  // Insertar tendencias filtradas de Google Trends
  detectedTrends.forEach((trend, index) => {
    const id = `scraped-trends-${Date.now()}-${index}`;
    const cleanTrend = trend.replace(/<!\[CDATA\[|\]\]>/g, '');
    try {
      insertScrapedItem.run(
        id,
        'Google Trends',
        `https://trends.google.es/trends/explore?q=${encodeURIComponent(cleanTrend)}&geo=ES`,
        `Tendencia de debate público en España: ${cleanTrend}`,
        'Google Trends ES',
        JSON.stringify({ dailySearches: '10K+' }),
        `Afirmaciones sobre: ${cleanTrend}`,
        'Economía española',
        6.0,
        5.0
      );
      count++;
    } catch (dbErr) {
      // Ignorar duplicados
    }
  });

  console.log(`[Radar Cron] Radar finalizado. Se han insertado ${count} items en la cola de scraped_items.`);
  db.close();
}

runRadar().catch(err => {
  console.error('[Radar Cron] Error ejecutando radar:', err);
});
