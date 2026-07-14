export const prerender = false;
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

export async function POST({ request }) {
  try {
    const data = await request.json();
    const url = data.url || '';
    const text = data.text || '';

    if (!url || url.trim().length < 5) {
      return new Response(JSON.stringify({ success: false, error: 'Por favor, introduce una URL de post o vídeo válida.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const views = parseInt(data.views) || 0;
    
    // Detectar plataforma de forma basica basada en la URL
    let platform = 'Web Report';
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('tiktok.com')) platform = 'TikTok';
    else if (lowerUrl.includes('instagram.com')) platform = 'Instagram';
    else if (lowerUrl.includes('facebook.com')) platform = 'Facebook';
    else if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) platform = 'YouTube';
    else if (lowerUrl.includes('x.com') || lowerUrl.includes('twitter.com')) platform = 'X';
    else if (lowerUrl.includes('t.me') || lowerUrl.includes('telegram.me')) platform = 'Telegram';

    // Determinar virality_score en base a vistas
    let viralityScore = 2.0; // Bajo impacto (<10k)
    if (views >= 50000) {
      viralityScore = 10.0; // Muy viral
    } else if (views >= 10000) {
      viralityScore = 7.5; // Viral
    }

    const dbPath = path.resolve('data/newnews.db');
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');

    const id = `report-web-${Date.now()}`;
    const claim = text.trim() || `Enlace de ${platform} reportado por el público.`;

    // Insertar en la cola del radar (scraped_items) como pendiente
    db.prepare(`
      INSERT INTO scraped_items (id, platform, url, text, author_public_name, metrics_json, detected_claim, suggested_topic, virality_score, risk_score, status, created_at)
      VALUES (?, ?, ?, ?, 'Público', ?, ?, 'General', ?, 6.0, 'pendiente', datetime('now'))
    `).run(id, platform, url, claim, JSON.stringify({ declared_views: views }), claim, viralityScore);

    db.close();

    // Si supera los cortafuegos de algo realmente viral (viralityScore >= 7.5), procesar inmediatamente en caliente
    if (viralityScore >= 7.5) {
      import('node:child_process').then(({ execSync }) => {
        try {
          console.log(`[Radar Hot-Trigger] Reporte viral detectado (${views} visualizaciones). Iniciando procesamiento en caliente...`);
          execSync('node scripts/ai-pipeline.js', { env: process.env });
          execSync('node scripts/sync.js', { env: process.env });
          execSync('npm run build', { env: process.env });
          if (process.platform !== 'win32') {
            execSync('pm2 reload newnews --update-env', { env: process.env });
          }
          console.log('[Radar Hot-Trigger] Procesamiento en caliente completado y servidor recargado.');
        } catch (e) {
          console.error('[Radar Hot-Trigger] Error en pipeline en caliente:', e.message);
        }
      });
    }

    return new Response(JSON.stringify({ success: true, message: '¡Gracias! El bulo ha sido reportado en la cola del radar. Al superar el umbral de viralidad, el motor de Hermes ha iniciado su auditoría en caliente.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Error procesando reporte en API:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
