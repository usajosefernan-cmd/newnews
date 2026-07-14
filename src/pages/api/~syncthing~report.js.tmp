export const prerender = false;
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { analyzeUrl } from '../../../scripts/check-url.js';

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

    // 1. Analizar URL utilizando el módulo real de scraping de NEWNEWS
    let platform = 'Web Report';
    let title = '';
    let description = '';
    let views = 0;
    
    try {
      const analysis = await analyzeUrl(url);
      platform = analysis.platform || platform;
      title = analysis.title || '';
      description = analysis.description || '';
      if (typeof analysis.views === 'number') {
        views = analysis.views;
      } else if (typeof analysis.views === 'string') {
        // Extraer número de vistas
        const matched = analysis.views.match(/\d+/);
        if (matched) views = parseInt(matched[0]);
      }
    } catch (e) {
      console.warn('[API Report] Error analizando URL, usando fallbacks:', e.message);
    }

    // 2. Evaluar viralidad de forma inteligente (AI o keywords)
    let isViral = false;
    let viralityScore = 2.0;
    let cleanClaim = text.trim() || title || `Enlace de ${platform} reportado por el público.`;
    let reason = "Evaluado por el motor del radar.";

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      try {
        const prompt = `Analiza la siguiente URL o afirmación para determinar si describe un bulo o debate potencialmente viral, de alta difusión o de gran impacto social en España (ej. subsidios, okupas, inmigración, impuestos, leyes, cotizaciones, pensiones, corrupción, etc.).
URL: ${url}
Título/Metadatos: ${title} ${description}
Comentario del usuario: ${text}

Debes responder estrictamente en formato JSON con la siguiente estructura:
{
  "is_viral": true/false,
  "virality_score": número del 0.0 al 10.0,
  "detected_claim": "afirmación limpia resumida",
  "reason": "justificación corta"
}`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const resp = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (resp.ok) {
          const geminiData = await resp.json();
          const jsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (jsonText) {
            const parsed = JSON.parse(jsonText.trim());
            isViral = !!parsed.is_viral;
            viralityScore = parseFloat(parsed.virality_score) || 2.0;
            if (parsed.detected_claim) {
              cleanClaim = parsed.detected_claim;
            }
            if (parsed.reason) {
              reason = parsed.reason;
            }
          }
        }
      } catch (e) {
        console.error('[API Report] Error consultando Gemini para valoración:', e.message);
      }
    }

    // Fallback de keywords si no hay API key o falló la consulta a la IA
    if (!apiKey || viralityScore === 2.0) {
      const lowercaseContent = `${url} ${title} ${description} ${text}`.toLowerCase();
      const viralKeywords = [
        'okupa', 'allanamiento', 'inmigrante', 'ayudas', 'tutelado', 'menores', 'marruecos',
        'pensiones', 'jubilación', 'autónomos', 'cuota', 'impuesto', 'hacienda', 'irpf',
        'sanchez', 'koldo', 'corrupción', 'begoña', 'fraude', 'amnistía', 'bulo', 'delito'
      ];
      
      const hasViralKeyword = viralKeywords.some(kw => lowercaseContent.includes(kw));
      if (hasViralKeyword || views >= 10000) {
        isViral = true;
        viralityScore = 7.5;
        reason = "Contiene palabras clave virales de alta sensibilidad social en España.";
      }
    }

    // Si tiene muchas vistas reales, forzar a verdadero
    if (views >= 10000) {
      isViral = true;
      viralityScore = Math.max(viralityScore, 7.5);
    }

    const dbPath = path.resolve('data/newnews.db');
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');

    const id = `report-web-${Date.now()}`;

    // Insertar en la cola del radar (scraped_items) como pendiente
    db.prepare(`
      INSERT INTO scraped_items (id, platform, url, text, author_public_name, metrics_json, detected_claim, suggested_topic, virality_score, risk_score, status, created_at)
      VALUES (?, ?, ?, ?, 'Público', ?, ?, 'General', ?, 6.0, 'pendiente', datetime('now'))
    `).run(id, platform, url, cleanClaim, JSON.stringify({ declared_views: views, auto_reason: reason }), cleanClaim, viralityScore);

    db.close();

    // Si supera los cortafuegos de algo realmente viral (viralityScore >= 7.0), procesar inmediatamente en caliente
    let triggerExecuted = false;
    if (viralityScore >= 7.0) {
      triggerExecuted = true;
      import('node:child_process').then(({ execSync }) => {
        try {
          console.log(`[Radar Hot-Trigger] Reporte viral de intercepción validado (${viralityScore}/10). Iniciando procesamiento en caliente...`);
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

    return new Response(JSON.stringify({ 
      success: true, 
      is_viral: isViral,
      virality_score: viralityScore,
      message: triggerExecuted
        ? '¡Intercepción de bulo activada! El enlace y tema han sido catalogados como de alto impacto social. El motor de Hermes ha iniciado la auditoría y compilación en caliente automática.'
        : '¡Gracias! El enlace ha sido catalogado. Al tener un impacto local/moderado, se procesará en el siguiente ciclo automático de 20 minutos.'
    }), {
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
