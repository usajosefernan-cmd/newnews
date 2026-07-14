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

// Headers de navegador reales y refinados para evitar bloqueos
const userAgentHeader = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html, application/xhtml+xml, application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
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
      const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      
      if (titleMatch && linkMatch) {
        if (pubDateMatch) {
          const pubDate = new Date(pubDateMatch[1].trim());
          const diffHours = (new Date().getTime() - pubDate.getTime()) / (1000 * 60 * 60);
          if (diffHours > 24) continue; // Solo 24 horas
        }

        const title = titleMatch[1].trim().replace(/&lt;!\[CDATA\[|\]\]&gt;/g, '');
        const link = linkMatch[1].trim();
        const description = descMatch ? descMatch[1].trim().replace(/<\/?[^>]+(>|$)/g, "").substring(0, 300) : '';
        
        let imageUrl = null;
        const enclosureMatch = itemContent.match(/<enclosure[^>]*url="([^"]+)"/i);
        if (enclosureMatch) {
          imageUrl = enclosureMatch[1];
        } else {
          const mediaMatch = itemContent.match(/<media:content[^>]*url="([^"]+)"/i) || itemContent.match(/<media:thumbnail[^>]*url="([^"]+)"/i);
          if (mediaMatch) {
            imageUrl = mediaMatch[1];
          } else if (descMatch) {
            const imgHtmlMatch = descMatch[1].match(/<img[^>]*src="([^"]+)"/i);
            if (imgHtmlMatch) imageUrl = imgHtmlMatch[1];
          }
        }

        items.push({
          title,
          link,
          description,
          platform: feed.platform,
          author: feed.platform + ' RSS',
          score: feed.platform === 'Menéame' ? 150 : 50, // Ponderación de partida
          comments: feed.platform === 'Menéame' ? 40 : 10,
          origin_date: pubDateMatch ? new Date(pubDateMatch[1].trim()).toISOString() : new Date().toISOString(),
          imageUrl: imageUrl || null
        });
      }
    }
    console.log(`[Radar Motor] -> ${feed.name}: Detectados ${items.length} elementos de las últimas 24h.`);
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
        if (post.created_utc) {
          const createdMs = post.created_utc * 1000;
          const diffHours = (new Date().getTime() - createdMs) / (1000 * 60 * 60);
          if (diffHours > 24) continue; // Solo 24 horas
        }

        let imageUrl = null;
        if (post.thumbnail && post.thumbnail.startsWith('http')) {
          imageUrl = post.thumbnail;
        } else if (post.url && (post.url.endsWith('.jpg') || post.url.endsWith('.png') || post.url.endsWith('.jpeg') || post.url.endsWith('.gif'))) {
          imageUrl = post.url;
        }

        items.push({
          title: post.title || '',
          link: `https://www.reddit.com${post.permalink}`,
          description: post.selftext || '',
          platform: 'Reddit',
          author: `u/${post.author || 'desconocido'}`,
          score: post.score || 0,
          comments: post.num_comments || 0,
          origin_date: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : new Date().toISOString(),
          imageUrl: imageUrl || null
        });
      }
    }
    console.log(`[Radar Motor] -> ${feed.name}: Detectados ${items.length} posts de las últimas 24h.`);
  } catch (err) {
    console.log(`[Radar Motor] ❌ Error descargando Reddit ${feed.name}:`, err.message);
  }
  return items;
}

async function fetchTelegramChannel(channel) {
  const items = [];
  try {
    console.log(`[Radar Motor] Descargando canal de Telegram: ${channel.name}...`);
    const url = `https://telegram.me/s/${channel.id}`;
    const response = await fetch(url, { headers: userAgentHeader });

    if (!response.ok) {
      console.log(`[Radar Motor] Advertencia: Telegram ${channel.name} respondió con estado ${response.status}`);
      return items;
    }

    const html = await response.text();
    
    // Dividir el HTML por bloques de mensaje
    const messageBlocks = html.split('<div class="tgme_widget_message ');
    
    for (let i = 1; i < messageBlocks.length; i++) {
      const block = messageBlocks[i];
      
      const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      const linkMatch = block.match(/<a class="tgme_widget_message_date" href="([^"]+)"/);
      const dateMatch = block.match(/<time datetime="([^"]+)"/);
      const viewsMatch = block.match(/<span class="tgme_widget_message_views">([^<]+)<\/span>/);
      
      if (textMatch && linkMatch) {
        if (dateMatch) {
          const messageDate = new Date(dateMatch[1]);
          const diffHours = (new Date().getTime() - messageDate.getTime()) / (1000 * 60 * 60);
          if (diffHours > 24) continue; // Solo 24 horas
        }

        let textContent = textMatch[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/?[^>]+(>|$)/g, "")
          .trim();
        
        textContent = textContent
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");

        const link = linkMatch[1].trim();
        
        let views = 0;
        if (viewsMatch) {
          const viewsRaw = viewsMatch[1].trim().toUpperCase().replace(',', '.');
          if (viewsRaw.includes('K')) {
            views = parseFloat(viewsRaw.replace('K', '')) * 1000;
          } else if (viewsRaw.includes('M')) {
            views = parseFloat(viewsRaw.replace('M', '')) * 1000000;
          } else {
            views = parseFloat(viewsRaw) || 0;
          }
        }

        const firstLine = textContent.split('\n')[0] || '';
        const title = firstLine.substring(0, 100) || 'Post de Telegram';

        const photoMatch = block.match(/tgme_widget_message_photo_wrap[^>]*style="[^"]*background-image:url\('([^']+)'\)/i) || block.match(/background-image:url\('([^']+)'\)/i);
        const imageUrl = photoMatch ? photoMatch[1] : null;

        items.push({
          title,
          link,
          description: textContent,
          platform: 'Telegram',
          author: channel.name,
          score: views,
          comments: 0,
          views: views,
          origin_date: dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString(),
          imageUrl: imageUrl || null
        });
      }
    }
    console.log(`[Radar Motor] -> ${channel.name}: Detectados ${items.length} posts.`);
  } catch (err) {
    console.log(`[Radar Motor] ❌ Error descargando Telegram ${channel.name}:`, err.message);
  }
  return items;
}

// ═══ NITTER / X RSS FEEDS ═══
async function fetchNitterFeed(feed) {
  const items = [];
  // Lista de instancias Nitter públicas para intentar (failover)
  const nitterInstances = [
    'https://nitter.privacydev.net',
    'https://nitter.poast.org',
    'https://nitter.woodland.cafe'
  ];
  
  for (const instance of nitterInstances) {
    try {
      const rssUrl = `${instance}/${feed.username}/rss`;
      console.log(`[Radar Motor] Probando Nitter RSS: ${rssUrl}...`);
      const response = await fetch(rssUrl, { 
        headers: userAgentHeader,
        signal: AbortSignal.timeout(3000)
      });
      
      if (!response.ok) continue;
      
      const xml = await response.text();
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      const matches = xml.matchAll(itemRegex);
      
      for (const match of matches) {
        const itemContent = match[1];
        const titleMatch = itemContent.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || itemContent.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
        const descMatch = itemContent.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemContent.match(/<description>([\s\S]*?)<\/description>/);
        const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
        
        if (titleMatch && linkMatch) {
          if (pubDateMatch) {
            const pubDate = new Date(pubDateMatch[1].trim());
            const diffHours = (new Date().getTime() - pubDate.getTime()) / (1000 * 60 * 60);
            if (diffHours > 24) continue; // Solo 24 horas
          }

          let link = linkMatch[1].trim();
          // Convertir link de Nitter a link real de X
          link = link.replace(new RegExp(instance.replace('https://', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'x.com');
          if (!link.startsWith('http')) link = `https://x.com/${feed.username}`;
          
          const title = titleMatch[1].trim().replace(/<\/?[^>]+(>|$)/g, '');
          const description = descMatch ? descMatch[1].trim().replace(/<\/?[^>]+(>|$)/g, '').substring(0, 300) : '';
          
          let imageUrl = null;
          if (descMatch) {
            const imgHtmlMatch = descMatch[1].match(/<img[^>]*src="([^"]+)"/i);
            if (imgHtmlMatch) {
              imageUrl = imgHtmlMatch[1];
              if (imageUrl.startsWith('/')) {
                imageUrl = instance + imageUrl;
              }
            }
          }

          items.push({
            title: title.substring(0, 200),
            link,
            description,
            platform: 'X',
            author: `@${feed.username}`,
            score: 100,
            comments: 0,
            origin_date: pubDateMatch ? new Date(pubDateMatch[1].trim()).toISOString() : new Date().toISOString(),
            imageUrl: imageUrl || null
          });
        }
      }
      
      if (items.length > 0) {
        console.log(`[Radar Motor] -> ${feed.name}: Detectados ${items.length} posts de X vía ${instance}.`);
        break; // Éxito, no probar más instancias
      }
    } catch (err) {
      console.log(`[Radar Motor] Nitter instance failed: ${err.message}`);
      continue;
    }
  }
  
  if (items.length === 0) {
    console.log(`[Radar Motor] ⚠️ No se pudo acceder a X/@${feed.username} vía Nitter.`);
  }
  return items;
}

async function fetchNitterSearch(query) {
  const items = [];
  const nitterInstances = [
    'https://nitter.privacydev.net',
    'https://nitter.poast.org',
    'https://nitter.woodland.cafe'
  ];
  
  for (const instance of nitterInstances) {
    try {
      const rssUrl = `${instance}/search/rss?q=${encodeURIComponent(query)}`;
      console.log(`[Radar Motor] Buscando en X (Nitter): "${query}" vía ${instance}...`);
      const response = await fetch(rssUrl, { 
        headers: userAgentHeader,
        signal: AbortSignal.timeout(4000)
      });
      
      if (!response.ok) continue;
      
      const xml = await response.text();
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      const matches = xml.matchAll(itemRegex);
      
      for (const match of matches) {
        const itemContent = match[1];
        const titleMatch = itemContent.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || itemContent.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
        const descMatch = itemContent.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemContent.match(/<description>([\s\S]*?)<\/description>/);
        const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
        
        if (titleMatch && linkMatch) {
          if (pubDateMatch) {
            const pubDate = new Date(pubDateMatch[1].trim());
            const diffHours = (new Date().getTime() - pubDate.getTime()) / (1000 * 60 * 60);
            if (diffHours > 24) continue;
          }

          let link = linkMatch[1].trim();
          link = link.replace(new RegExp(instance.replace('https://', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'x.com');
          
          const title = titleMatch[1].trim().replace(/<\/?[^>]+(>|$)/g, '');
          const description = descMatch ? descMatch[1].trim().replace(/<\/?[^>]+(>|$)/g, '').substring(0, 300) : '';
          
          let imageUrl = null;
          if (descMatch) {
            const imgHtmlMatch = descMatch[1].match(/<img[^>]*src="([^"]+)"/i);
            if (imgHtmlMatch) {
              imageUrl = imgHtmlMatch[1];
              if (imageUrl.startsWith('/')) {
                imageUrl = instance + imageUrl;
              }
            }
          }

          items.push({
            title: title.substring(0, 200),
            link,
            description,
            platform: 'X',
            author: 'X User',
            score: 100,
            comments: 5,
            origin_date: pubDateMatch ? new Date(pubDateMatch[1].trim()).toISOString() : new Date().toISOString(),
            imageUrl: imageUrl || null
          });
        }
      }
      
      if (items.length > 0) {
        break;
      }
    } catch (err) {
      continue;
    }
  }
  return items;
}

async function fetchRedditSearch(query) {
  const items = [];
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query + ' (site:reddit.com/r/es OR site:reddit.com/r/spainpolitics OR site:reddit.com/r/spain)')}&sort=new&limit=8`;
    console.log(`[Radar Motor] Buscando en Reddit: "${query}"...`);
    const response = await fetch(url, { headers: userAgentHeader });
    if (response.ok) {
      const data = await response.json();
      const children = data?.data?.children || [];
      for (const child of children) {
        const post = child.data;
        if (post && !post.pinned && !post.stickied) {
          if (post.created_utc) {
            const createdMs = post.created_utc * 1000;
            const diffHours = (new Date().getTime() - createdMs) / (1000 * 60 * 60);
            if (diffHours > 24) continue;
          }
          let imageUrl = null;
          if (post.thumbnail && post.thumbnail.startsWith('http')) {
            imageUrl = post.thumbnail;
          } else if (post.url && (post.url.endsWith('.jpg') || post.url.endsWith('.png') || post.url.endsWith('.jpeg'))) {
            imageUrl = post.url;
          }
          items.push({
            title: post.title || '',
            link: `https://www.reddit.com${post.permalink}`,
            description: post.selftext || '',
            platform: 'Reddit',
            author: `u/${post.author || 'desconocido'}`,
            score: post.score || 0,
            comments: post.num_comments || 0,
            origin_date: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : new Date().toISOString(),
            imageUrl: imageUrl || null
          });
        }
      }
    }
  } catch (err) {
    console.log(`[Radar Motor] Error buscando en Reddit para "${query}":`, err.message);
  }
  return items;
}

function parseYouTubeRelativeTime(timeText) {
  const now = new Date();
  if (!timeText) return now.toISOString();
  
  const cleanText = timeText.toLowerCase();
  const match = cleanText.match(/(\d+)/);
  if (!match) return now.toISOString();
  
  const value = parseInt(match[1]);
  if (cleanText.includes('segundo')) {
    now.setSeconds(now.getSeconds() - value);
  } else if (cleanText.includes('minuto')) {
    now.setMinutes(now.getMinutes() - value);
  } else if (cleanText.includes('hora')) {
    now.setHours(now.getHours() - value);
  } else if (cleanText.includes('día') || cleanText.includes('dia')) {
    now.setDate(now.getDate() - value);
  }
  return now.toISOString();
}

async function fetchYouTubeSearch(query) {
  const items = [];
  try {
    console.log(`[Radar Motor] Buscando en YouTube: "${query}"...`);
    // sp=CAI%253D es el parametro de ordenamiento por fecha de subida en YouTube
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=CAI%253D`;
    const response = await fetch(url, { headers: userAgentHeader });

    if (!response.ok) {
      console.log(`[Radar Motor] Advertencia: YouTube respondió con estado ${response.status}`);
      return items;
    }

    const html = await response.text();
    const jsonMatch = html.match(/var ytInitialData = (\{[\s\S]*?\});/);
    if (!jsonMatch) {
      console.log(`[Radar Motor] No se encontró ytInitialData en la respuesta de YouTube.`);
      return items;
    }

    const data = JSON.parse(jsonMatch[1]);
    
    // Navegar de forma segura el arbol de componentes de YouTube para extraer videos
    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    
    let videoResults = [];
    for (const section of contents) {
      const itemSection = section?.itemSectionRenderer?.contents || [];
      for (const item of itemSection) {
        if (item.videoRenderer) {
          videoResults.push(item.videoRenderer);
        }
      }
    }

    for (const video of videoResults.slice(0, 8)) { // 8 primeros videos mas recientes
      const title = video?.title?.runs?.[0]?.text || '';
      const videoId = video?.videoId || '';
      const description = video?.detailedMetadataSnippets?.[0]?.snippetText?.runs?.[0]?.text 
        || video?.descriptionSnippet?.runs?.[0]?.text || '';
      const author = video?.ownerText?.runs?.[0]?.text || 'YouTube Creator';
      const viewCountText = video?.viewCountText?.simpleText || video?.viewCountText?.runs?.[0]?.text || '0';
      
      let views = 0;
      const cleanViews = viewCountText.replace(/\D/g, '');
      if (cleanViews) views = parseInt(cleanViews);

      // Descartar videos antiguos
      const timeText = video?.publishedTimeText?.simpleText || '';
      if (timeText && !timeText.includes('segundo') && !timeText.includes('minuto') && !timeText.includes('hora') && !timeText.includes('día') && !timeText.includes('dia')) {
        continue; // Descartar si es de hace semanas, meses o años
      }

      const thumbnails = video?.thumbnail?.thumbnails || [];
      const imageUrl = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1]?.url : `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

      items.push({
        title,
        link: `https://www.youtube.com/watch?v=${videoId}`,
        description,
        platform: 'YouTube',
        author,
        score: views,
        comments: 0,
        views: views,
        origin_date: parseYouTubeRelativeTime(timeText),
        imageUrl: imageUrl || null
      });
    }
    console.log(`[Radar Motor] -> YouTube "${query}": Detectados ${items.length} videos de las últimas 24h.`);
  } catch (err) {
    console.log(`[Radar Motor] ❌ Error buscando en YouTube para "${query}":`, err.message);
  }
  return items;
}

async function getGoogleTrendsQueries() {
  const queries = [];
  try {
    const url = 'https://trends.google.es/trends/trendingsearches/daily/rss?geo=ES';
    const response = await fetch(url, { headers: userAgentHeader });
    if (response.ok) {
      const xml = await response.text();
      const matches = xml.matchAll(/<title>([\s\S]*?)<\/title>/g);
      for (const match of matches) {
        const term = match[1].trim()
          .replace(/&lt;!\[CDATA\[|\]\]&gt;/g, '')
          .replace(/<!\[CDATA\[|\]\]>/g, '');
        if (term && !term.toLowerCase().includes('trends') && term.length < 60) {
          queries.push(term);
        }
      }
    }
  } catch (err) {
    console.log('[Radar Motor] ❌ No se pudieron cargar tendencias dinámicas:', err.message);
  }
  return queries;
}

async function runRadar() {
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ La base de datos no existe en ${dbPath}.`);
    process.exit(1);
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');

  console.log('[Radar Motor] Cargando fuentes de monitorización desde la base de datos...');
  const activeSources = db.prepare("SELECT * FROM radar_sources WHERE status = 'activo'").all();

  const rssFeeds = activeSources
    .filter(s => s.platform === 'RSS')
    .map(s => ({ name: s.name, url: s.url_or_id, platform: 'Prensa' }));

  const redditFeeds = activeSources
    .filter(s => s.platform === 'Reddit')
    .map(s => ({ name: s.name, url: s.url_or_id, platform: 'Reddit' }));

  const telegramChannels = activeSources
    .filter(s => s.platform === 'Telegram')
    .map(s => ({ id: s.url_or_id, name: s.name, platform: 'Telegram' }));

  const xAccounts = activeSources
    .filter(s => s.platform === 'X')
    .map(s => ({ username: s.url_or_id, name: s.name, platform: 'X' }));

  console.log(`[Radar Motor] Fuentes cargadas: ${rssFeeds.length} RSS, ${redditFeeds.length} Reddit, ${telegramChannels.length} Telegram, ${xAccounts.length} X.`);

  const insertScrapedItem = db.prepare(`
    INSERT OR IGNORE INTO scraped_items (id, platform, url, text, author_public_name, metrics_json, detected_claim, suggested_topic, virality_score, risk_score, status, origin_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, datetime('now'))
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

  // 2.5 Cargar Telegram channels
  for (const channel of telegramChannels) {
    const channelItems = await fetchTelegramChannel(channel);
    allItems.push(...channelItems);
  }

  // 3. Cargar X/Twitter vía Nitter RSS
  for (const account of xAccounts) {
    const xItems = await fetchNitterFeed(account);
    allItems.push(...xItems);
  }

  // 3.5 Búsquedas dinámicas y virales en YouTube, X (Twitter vía Nitter) y Reddit usando keywords y tendencias de Google Trends
  const baseQueries = ['bulo España', 'okupa España', 'inmigración España ayudas', 'Begoña Gómez juicio', 'Koldo mascarillas'];
  const dynamicTrends = await getGoogleTrendsQueries();
  console.log(`[Radar Motor] Tendencias dinámicas de Google Trends cargadas: [${dynamicTrends.join(', ')}]`);
  
  const trendQueries = dynamicTrends.map(t => `${t} bulo`);
  const combinedQueries = [...baseQueries, ...dynamicTrends.slice(0, 4), ...trendQueries.slice(0, 4)];
  const uniqueQueries = [...new Set(combinedQueries)];

  for (const query of uniqueQueries) {
    // Buscar en YouTube
    const ytItems = await fetchYouTubeSearch(query);
    allItems.push(...ytItems);

    // Buscar en X/Twitter (Nitter Search)
    const xSearchItems = await fetchNitterSearch(query);
    allItems.push(...xSearchItems);

    // Buscar en Reddit (Reddit Search API)
    const redditSearchItems = await fetchRedditSearch(query);
    allItems.push(...redditSearchItems);
  }

  // 4. Procesar y filtrar items
  for (const item of allItems) {
    const titleLower = item.title.toLowerCase();
    const descLower = item.description.toLowerCase();
    
    // Filtrar deportes y entretenimiento ordinario
    const hasForbidden = forbiddenKeywords.some(kw => titleLower.includes(kw) || descLower.includes(kw));
    if (hasForbidden) continue;

    // Filtro estricto de viralidad (mínimo alcance de 10.000 personas o equivalente)
    let isViral = false;
    const plat = (item.platform || '').toLowerCase();
    
    if (plat === 'youtube') {
      if ((item.views || 0) >= 10000) isViral = true;
    } else if (plat === 'telegram') {
      if ((item.views || 0) >= 10000) isViral = true;
    } else if (plat === 'x' || plat === 'twitter') {
      // En X, estimamos 1 like = 200 impresiones, de forma que >= 50 likes equivale a 10k vistas
      if ((item.score || 0) >= 50) isViral = true;
    } else if (plat === 'reddit') {
      // En Reddit, score >= 40 o comentarios >= 15 representa gran difusion en subreddits de Espana
      if ((item.score || 0) >= 40 || (item.comments || 0) >= 15) isViral = true;
    } else if (plat === 'tiktok') {
      // En TikTok, >= 10k vistas o >= 1k likes
      if ((item.views || 0) >= 10000 || (item.score || 0) >= 1000) isViral = true;
    } else if (plat === 'instagram') {
      // En Instagram, >= 10k vistas o >= 1k likes
      if ((item.views || 0) >= 10000 || (item.score || 0) >= 1000) isViral = true;
    } else if (plat === 'facebook') {
      // En Facebook, >= 10k vistas o >= 200 compartidos/reacciones
      if ((item.views || 0) >= 10000 || (item.score || 0) >= 200) isViral = true;
    } else if (plat === 'prensa' || plat === 'menéame' || plat === 'google trends') {
      // La prensa nacional y Meneame Portada superan las 10k vistas de base
      isViral = true;
    } else {
      // Para reportes generales o de la web
      if ((item.views || 0) >= 10000 || (item.score || 0) >= 500) isViral = true;
    }

    if (!isViral) {
      // Omitir posts no virales
      continue;
    }

    // Buscar relevancia sociopolítica
    const hasInteresting = interestingKeywords.some(kw => titleLower.includes(kw) || descLower.includes(kw));
    
    if (hasInteresting) {
      // Generar ID único basado en URL para evitar duplicados
      const id = `radar-${item.platform.toLowerCase()}-${Buffer.from(item.link).toString('base64').substring(0, 32)}`;
      
      // Clasificación mejorada del tema
      let suggestedTopic = 'Economía y Sociedad';
      const combined = titleLower + ' ' + descLower;
      if (combined.includes('franco') || combined.includes('memoria histórica') || combined.includes('exhumación')) suggestedTopic = 'Mitos y Leyendas del Franquismo';
      else if (combined.includes('mena') || combined.includes('inmigr') || combined.includes('extranj') || combined.includes('frontera')) suggestedTopic = 'Inmigración, Delincuencia y Ayudas';
      else if (combined.includes('begoña') || combined.includes('peinado')) suggestedTopic = 'Investigación Judicial a Begoña Gómez';
      else if (combined.includes('koldo') || combined.includes('ábalos') || combined.includes('mascarilla')) suggestedTopic = 'Caso Koldo y Sentencia del Tribunal Supremo';
      else if (combined.includes('okupa') || combined.includes('vivienda') || combined.includes('alquiler') || combined.includes('hipoteca')) suggestedTopic = 'Vivienda y Okupación';
      else if (combined.includes('amnistía') || combined.includes('procés') || combined.includes('puigdemont')) suggestedTopic = 'Ley de Amnistía y Procés';
      else if (combined.includes('paro') || combined.includes('empleo') || combined.includes('sepe') || combined.includes('fijo discontinuo')) suggestedTopic = 'Empleo y Cifras de Paro';
      else if (combined.includes('autónomo') || combined.includes('irpf') || combined.includes('hacienda') || combined.includes('cuota')) suggestedTopic = 'Autónomos y Fiscalidad';
      else if (combined.includes('inflación') || combined.includes('iva') || combined.includes('precio') || combined.includes('cesta')) suggestedTopic = 'Inflación y Coste de Vida';

      // Calcular virality_score real basado en los datos
      let viralityScore = 5.0;
      if (item.platform === 'Reddit') {
        viralityScore = Math.min(10.0, 3.0 + (item.score / 50) + (item.comments / 20));
      } else if (item.platform === 'Menéame' || item.platform === 'Prensa') {
        viralityScore = Math.min(10.0, 4.0 + (item.comments / 30));
      } else if (item.platform === 'Google Trends') {
        viralityScore = 8.5;
      } else if (item.platform === 'Telegram') {
        const views = item.views || 0;
        viralityScore = Math.min(10.0, 3.0 + (views / 25000));
      } else if (item.platform === 'X') {
        viralityScore = Math.min(10.0, 5.0 + (item.score / 100));
      } else if (item.platform === 'YouTube') {
        const views = item.views || 0;
        viralityScore = Math.min(10.0, 4.0 + (views / 15000));
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
          JSON.stringify({ score: item.score, comments: item.comments, imageUrl: item.imageUrl || null }),
          item.title,
          suggestedTopic,
          viralityScore,
          riskScore,
          item.origin_date || new Date().toISOString()
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
