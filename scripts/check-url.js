import path from 'node:path';

/**
 * NEWNEWS — Verificador de URLs en Tiempo Real
 * 
 * Analiza cualquier URL de redes sociales o prensa para:
 * 1. Verificar que el recurso existe (HTTP 200/30x)
 * 2. Extraer metadatos reales (título, descripción, autor, plataforma)
 * 3. Devolver un objeto estructurado listo para insertar en scraped_items
 * 
 * Plataformas soportadas: YouTube, Telegram, X/Twitter, Instagram, TikTok, Prensa
 * 
 * Uso CLI:  node scripts/check-url.js https://youtube.com/shorts/RIdWFv0Mv44
 * Uso ESM: import { analyzeUrl } from './check-url.js';
 */

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Accept-Encoding': 'identity'
};

// ===== DETECCIÓN DE PLATAFORMA =====

function detectPlatform(url) {
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'YouTube';
  if (u.includes('t.me/') || u.includes('telegram.me/')) return 'Telegram';
  if (u.includes('x.com/') || u.includes('twitter.com/')) return 'X (Twitter)';
  if (u.includes('instagram.com/')) return 'Instagram';
  if (u.includes('tiktok.com/')) return 'TikTok';
  if (u.includes('reddit.com/')) return 'Reddit';
  if (u.includes('facebook.com/') || u.includes('fb.com/')) return 'Facebook';
  if (u.includes('whatsapp.com/')) return 'WhatsApp';
  return 'Prensa';
}

// ===== EXTRACTORES DE METADATOS =====

function extractOpenGraph(html) {
  const meta = {};
  
  // og:title
  const titleMatch = html.match(/<meta\s+(?:property|name)\s*=\s*"og:title"\s+content\s*=\s*"([^"]*)"/) ||
                      html.match(/<meta\s+content\s*=\s*"([^"]*)"\s+(?:property|name)\s*=\s*"og:title"/);
  if (titleMatch) meta.ogTitle = decodeHtmlEntities(titleMatch[1]);

  // og:description
  const descMatch = html.match(/<meta\s+(?:property|name)\s*=\s*"og:description"\s+content\s*=\s*"([^"]*)"/) ||
                     html.match(/<meta\s+content\s*=\s*"([^"]*)"\s+(?:property|name)\s*=\s*"og:description"/);
  if (descMatch) meta.ogDescription = decodeHtmlEntities(descMatch[1]);

  // og:image
  const imgMatch = html.match(/<meta\s+(?:property|name)\s*=\s*"og:image"\s+content\s*=\s*"([^"]*)"/) ||
                    html.match(/<meta\s+content\s*=\s*"([^"]*)"\s+(?:property|name)\s*=\s*"og:image"/);
  if (imgMatch) meta.ogImage = imgMatch[1];

  // og:site_name
  const siteMatch = html.match(/<meta\s+(?:property|name)\s*=\s*"og:site_name"\s+content\s*=\s*"([^"]*)"/) ||
                     html.match(/<meta\s+content\s*=\s*"([^"]*)"\s+(?:property|name)\s*=\s*"og:site_name"/);
  if (siteMatch) meta.ogSiteName = decodeHtmlEntities(siteMatch[1]);

  // <title> como fallback
  const htmlTitleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (htmlTitleMatch) meta.htmlTitle = decodeHtmlEntities(htmlTitleMatch[1].trim());

  // meta description como fallback
  const metaDescMatch = html.match(/<meta\s+name\s*=\s*"description"\s+content\s*=\s*"([^"]*)"/) ||
                         html.match(/<meta\s+content\s*=\s*"([^"]*)"\s+name\s*=\s*"description"/);
  if (metaDescMatch) meta.metaDescription = decodeHtmlEntities(metaDescMatch[1]);

  return meta;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&apos;/g, "'");
}

// ===== ANALIZADORES POR PLATAFORMA =====

async function analyzeYouTube(url) {
  const result = { platform: 'YouTube', isAccessible: false, rawUrl: url };

  // Extraer video ID
  let videoId = null;
  const shortMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  const shortUrlMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  videoId = shortMatch?.[1] || watchMatch?.[1] || shortUrlMatch?.[1];

  if (!videoId) {
    result.error = 'No se pudo extraer el ID del vídeo de la URL';
    return result;
  }

  result.postId = videoId;

  // Usar oEmbed público (no requiere API key)
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const resp = await fetch(oembedUrl, { headers: BROWSER_HEADERS });
    
    if (resp.ok) {
      const data = await resp.json();
      result.isAccessible = true;
      result.title = data.title || '';
      result.author = data.author_name || '';
      result.authorUrl = data.author_url || '';
      result.imageUrl = data.thumbnail_url || '';
      result.description = `Vídeo de YouTube por ${data.author_name || 'desconocido'}`;
      result.views = 0;

      // Intentar obtener visitas reales del HTML del video
      try {
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const watchResp = await fetch(watchUrl, { headers: BROWSER_HEADERS });
        if (watchResp.ok) {
          const html = await watchResp.text();
          const viewMatch = html.match(/<meta[^>]*itemprop="interactionCount"[^>]*content="(\d+)"/i);
          if (viewMatch) {
            result.views = parseInt(viewMatch[1]);
          } else {
            const viewsRegex = /"viewCount":\s*"(\d+)"/i;
            const viewsMatch = html.match(viewsRegex);
            if (viewsMatch) result.views = parseInt(viewsMatch[1]);
          }
        }
      } catch (e) {
        // Ignorar fallo de scraping de vistas y usar oembed
      }
    } else {
      result.error = `YouTube oEmbed respondió con ${resp.status}`;
    }
  } catch (err) {
    result.error = `Error conectando con YouTube: ${err.message}`;
  }

  return result;
}

async function analyzeTikTok(url) {
  const result = { platform: 'TikTok', isAccessible: false, rawUrl: url };
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const resp = await fetch(oembedUrl, { headers: BROWSER_HEADERS });
    if (resp.ok) {
      const data = await resp.json();
      result.isAccessible = true;
      result.title = data.title || '';
      result.author = data.author_name || '';
      result.authorUrl = data.author_url || '';
      result.imageUrl = data.thumbnail_url || '';
      result.description = `Publicación de TikTok de ${data.author_name || 'usuario'}`;
    } else {
      result.error = `TikTok oEmbed respondió con ${resp.status}`;
    }
  } catch (err) {
    result.error = `Error conectando con TikTok: ${err.message}`;
  }
  return result;
}

async function analyzeReddit(url) {
  const result = { platform: 'Reddit', isAccessible: false, rawUrl: url };
  try {
    const headers = {
      ...BROWSER_HEADERS,
      'User-Agent': 'Mozilla/5.0 NEWNEWS-RadarBot/1.0.0 (contact: admin@newnews.es)'
    };
    let cleanUrl = url.split('?')[0];
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    const jsonUrl = `${cleanUrl}.json`;

    const resp = await fetch(jsonUrl, { headers });
    if (resp.ok) {
      const data = await resp.json();
      const post = data?.[0]?.data?.children?.[0]?.data;
      if (post) {
        result.isAccessible = true;
        result.title = post.title || '';
        result.description = post.selftext || '';
        result.author = `u/${post.author || 'desconocido'}`;
        result.postId = post.id;
        result.views = `${post.ups || 0} upvotes | ${post.num_comments || 0} comentarios`;
        if (post.thumbnail && post.thumbnail.startsWith('http')) {
          result.imageUrl = post.thumbnail;
        }
      } else {
        result.error = 'No se encontraron datos del post en el JSON de Reddit';
      }
    } else {
      result.error = `Reddit respondió con ${resp.status}`;
    }
  } catch (err) {
    result.error = `Error conectando con Reddit: ${err.message}`;
  }
  return result;
}

async function analyzeInstagram(url) {
  const result = { platform: 'Instagram', isAccessible: false, rawUrl: url };
  try {
    const oembedUrl = `https://open.instagram.com/oembed/?url=${encodeURIComponent(url)}`;
    const resp = await fetch(oembedUrl, { headers: BROWSER_HEADERS });
    if (resp.ok) {
      const data = await resp.json();
      result.isAccessible = true;
      result.title = data.title || '';
      result.author = data.author_name || '';
      result.authorUrl = data.author_url || '';
      result.imageUrl = data.thumbnail_url || '';
      result.description = `Publicación de Instagram de ${data.author_name || 'usuario'}`;
    } else {
      const generic = await analyzeGenericUrl(url, 'Instagram');
      if (generic.isAccessible) {
        return generic;
      }
      result.error = `Instagram oEmbed respondió con ${resp.status}`;
    }
  } catch (err) {
    result.error = `Error conectando con Instagram: ${err.message}`;
  }
  return result;
}

async function analyzeTelegram(url) {
  const result = { platform: 'Telegram', isAccessible: false, rawUrl: url };

  // Extraer canal y post ID
  const match = url.match(/(?:telegram\.me|t\.me)\/(?:s\/)?([^\/]+)(?:\/(\d+))?/i);
  if (!match) {
    result.error = 'No se pudo parsear la URL de Telegram';
    return result;
  }

  const channel = match[1];
  const postId = match[2] || '';
  result.author = channel;
  result.postId = postId;

  // Fetch del mirror web público
  const mirrorUrl = `https://telegram.me/s/${channel}${postId ? '/' + postId : ''}`;
  try {
    const resp = await fetch(mirrorUrl, { headers: BROWSER_HEADERS });
    
    if (resp.ok) {
      const html = await resp.text();
      result.isAccessible = true;

      // Extraer el texto del mensaje específico
      const messageBlocks = html.split('<div class="tgme_widget_message ');
      
      if (postId && messageBlocks.length > 1) {
        // Buscar el bloque del mensaje específico
        for (let i = 1; i < messageBlocks.length; i++) {
          const block = messageBlocks[i];
          if (block.includes(`/${channel}/${postId}`)) {
            const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
            if (textMatch) {
              result.title = textMatch[1]
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/?[^>]+(>|$)/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .trim()
                .split('\n')[0]
                .substring(0, 200);

              result.description = textMatch[1]
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/?[^>]+(>|$)/g, '')
                .trim()
                .substring(0, 500);
            }

            // Vistas
            const viewsMatch = block.match(/<span class="tgme_widget_message_views">([^<]+)<\/span>/);
            if (viewsMatch) result.views = viewsMatch[1].trim();

            // Fecha
            const dateMatch = block.match(/<time datetime="([^"]+)"/);
            if (dateMatch) result.date = dateMatch[1];

            break;
          }
        }

        if (!result.title) {
          // Fallback: último mensaje
          const lastBlock = messageBlocks[messageBlocks.length - 1];
          const textMatch = lastBlock.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
          if (textMatch) {
            result.title = textMatch[1]
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/?[^>]+(>|$)/g, '')
              .trim()
              .split('\n')[0]
              .substring(0, 200);
          }
        }
      }

      // OpenGraph fallback
      const og = extractOpenGraph(html);
      if (!result.title && og.ogTitle) result.title = og.ogTitle;
      if (!result.description && og.ogDescription) result.description = og.ogDescription;
      if (og.ogImage) result.imageUrl = og.ogImage;
    } else {
      result.error = `Telegram respondió con estado ${resp.status}`;
    }
  } catch (err) {
    result.error = `Error conectando con Telegram: ${err.message}`;
  }

  return result;
}

async function analyzeTwitter(url) {
  const result = { platform: 'X (Twitter)', isAccessible: false, rawUrl: url };

  // Extraer usuario y tweet ID
  const match = url.match(/(?:x|twitter)\.com\/([^\/]+)\/status\/(\d+)/i);
  if (match) {
    result.author = match[1];
    result.postId = match[2];
  }

  // Intentar vxtwitter/fxtwitter (mirrors públicos que devuelven OG tags)
  const mirrors = [
    url.replace('x.com', 'vxtwitter.com').replace('twitter.com', 'vxtwitter.com'),
    url.replace('x.com', 'fxtwitter.com').replace('twitter.com', 'fxtwitter.com')
  ];

  for (const mirrorUrl of mirrors) {
    try {
      const resp = await fetch(mirrorUrl, { 
        headers: BROWSER_HEADERS,
        redirect: 'follow'
      });
      
      if (resp.ok) {
        const html = await resp.text();
        const og = extractOpenGraph(html);
        
        if (og.ogTitle || og.ogDescription) {
          result.isAccessible = true;
          result.title = og.ogTitle || og.htmlTitle || '';
          result.description = og.ogDescription || og.metaDescription || '';
          if (og.ogImage) result.imageUrl = og.ogImage;
          break;
        }
      }
    } catch (err) {
      // Intentar siguiente mirror
    }
  }

  // Fallback directo a la URL original (X suele bloquear pero a veces funciona)
  if (!result.isAccessible) {
    try {
      const resp = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
      if (resp.ok) {
        const html = await resp.text();
        const og = extractOpenGraph(html);
        result.isAccessible = true;
        result.title = og.ogTitle || og.htmlTitle || `Tweet de @${result.author || 'desconocido'}`;
        result.description = og.ogDescription || og.metaDescription || '';
        if (og.ogImage) result.imageUrl = og.ogImage;
      }
    } catch (err) {
      result.error = `No se pudo acceder al tweet: ${err.message}`;
    }
  }

  return result;
}

async function analyzeGenericUrl(url, platform) {
  const result = { platform, isAccessible: false, rawUrl: url };

  try {
    const resp = await fetch(url, { 
      headers: BROWSER_HEADERS,
      redirect: 'follow'
    });

    if (resp.ok) {
      const html = await resp.text();
      const og = extractOpenGraph(html);
      
      result.isAccessible = true;
      result.title = og.ogTitle || og.htmlTitle || '';
      result.description = og.ogDescription || og.metaDescription || '';
      if (og.ogImage) result.imageUrl = og.ogImage;
      if (og.ogSiteName) result.siteName = og.ogSiteName;

      // Intentar extraer autor de meta tags
      const authorMatch = html.match(/<meta\s+(?:name|property)\s*=\s*"(?:author|article:author)"\s+content\s*=\s*"([^"]*)"/) ||
                           html.match(/<meta\s+content\s*=\s*"([^"]*)"\s+(?:name|property)\s*=\s*"(?:author|article:author)"/);
      if (authorMatch) result.author = decodeHtmlEntities(authorMatch[1]);
    } else {
      result.error = `La URL respondió con estado HTTP ${resp.status}`;
      // Aunque no sea 200, si es 403/429 probablemente existe
      if (resp.status === 403 || resp.status === 429) {
        result.isAccessible = true;
        result.title = `Contenido restringido (${platform})`;
        result.description = `La URL existe pero la plataforma bloquea la extracción automática de contenido. Se requiere verificación manual.`;
        result.requiresManualReview = true;
      }
    }
  } catch (err) {
    result.error = `Error de conexión: ${err.message}`;
  }

  return result;
}

// ===== FUNCIÓN PRINCIPAL =====

export async function analyzeUrl(url) {
  if (!url || typeof url !== 'string') {
    return { platform: 'Desconocida', isAccessible: false, error: 'URL vacía o inválida', rawUrl: url };
  }

  // Limpiar URL
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  const platform = detectPlatform(url);
  
  console.log(`[Check URL] Analizando: ${url}`);
  console.log(`[Check URL] Plataforma detectada: ${platform}`);

  let result;

  switch (platform) {
    case 'YouTube':
      result = await analyzeYouTube(url);
      break;
    case 'Telegram':
      result = await analyzeTelegram(url);
      break;
    case 'X (Twitter)':
      result = await analyzeTwitter(url);
      break;
    case 'TikTok':
      result = await analyzeTikTok(url);
      break;
    case 'Reddit':
      result = await analyzeReddit(url);
      break;
    case 'Instagram':
      result = await analyzeInstagram(url);
      break;
    default:
      result = await analyzeGenericUrl(url, platform);
  }

  // Asegurar campos mínimos
  result.platform = result.platform || platform;
  result.title = result.title || '';
  result.description = result.description || '';
  result.author = result.author || '';
  result.rawUrl = url;

  return result;
}

// ===== MODO CLI =====
// Solo ejecutar en modo CLI si el script es invocado directamente (no importado como módulo)

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('check-url.js') || 
  process.argv[1].includes('check-url')
);
const args = process.argv.slice(2);
if (isDirectRun && args.length > 0) {
  const targetUrl = args[0];
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  NEWNEWS — Comprobador de URLs en Tiempo Real   ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  
  analyzeUrl(targetUrl).then(result => {
    console.log('');
    console.log('═══ RESULTADO ═══');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    if (result.isAccessible) {
      console.log('✅ URL ACCESIBLE — Metadatos extraídos correctamente');
    } else {
      console.log('❌ URL NO ACCESIBLE — ' + (result.error || 'Sin datos'));
    }

    if (result.requiresManualReview) {
      console.log('⚠️  REQUIERE REVISIÓN MANUAL — La plataforma bloquea scraping automático');
    }
  }).catch(err => {
    console.error('❌ Error fatal:', err.message);
    process.exit(1);
  });
}
