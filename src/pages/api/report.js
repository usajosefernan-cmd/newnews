export const prerender = false;
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { analyzeUrl } from '../../../scripts/check-url.js';
import { execSync } from 'node:child_process';

export async function POST({ request }) {
  let url = '';
  let text = '';

  try {
    const data = await request.json();
    url = data.url || '';
    text = data.text || '';
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Cuerpo de petición inválido.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!url || url.trim().length < 5) {
    return new Response(JSON.stringify({ success: false, error: 'Por favor, introduce una URL de post o vídeo válida.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Crear canal de stream
  const stream = new ReadableStream({
    async start(controller) {
      const send = (dataObj) => {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(dataObj) + '\n'));
      };

      try {
        send({ status: 'info', message: '📡 [ANALIZANDO LINK] Conectando con la plataforma en origen...' });

        // 1. Analizar URL utilizando el módulo real de scraping de NEWNEWS
        let platform = 'Web Report';
        let title = '';
        let description = '';
        let views = 0;
        let originalImageUrl = null;
        
        try {
          const analysis = await analyzeUrl(url);
          platform = analysis.platform || platform;
          title = analysis.title || '';
          description = analysis.description || '';
          originalImageUrl = analysis.imageUrl || null;
          if (typeof analysis.views === 'number') {
            views = analysis.views;
          } else if (typeof analysis.views === 'string') {
            const matched = analysis.views.match(/\d+/);
            if (matched) views = parseInt(matched[0]);
          }

          send({ 
            status: 'info', 
            message: `📦 [METADATOS] Enlace interceptado de ${platform}. Título: "${title.substring(0, 55)}..." (${views} reproducciones en origen)` 
          });
        } catch (e) {
          send({ status: 'warn', message: `⚠️ [ADVERTENCIA] No se pudieron extraer metadatos automáticamente. Se requiere revisión manual de estructura.` });
        }

        // 2. Evaluar viralidad del tema
        send({ status: 'info', message: '🤖 [FILTRO DE AUDITORÍA] Consultando el cortafuegos de viralidad e impacto social...' });
        
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
                if (parsed.detected_claim) cleanClaim = parsed.detected_claim;
                if (parsed.reason) reason = parsed.reason;
              }
            }
          } catch (e) {
            send({ status: 'warn', message: '⚠️ [ADVERTENCIA] Error de conexión con IA de control. Aplicando cortafuegos estático.' });
          }
        }

        // Fallback de keywords
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
            reason = "Contiene keywords críticas o volumen de reproducciones elevado.";
          }
        }

        if (views >= 10000) {
          isViral = true;
          viralityScore = Math.max(viralityScore, 7.5);
        }

        send({ 
          status: 'info', 
          message: `📊 [EVALUACIÓN] Puntuación de Viralidad: ${viralityScore.toFixed(1)}/10. Detalle: ${reason}` 
        });

        // 3. Registrar en base de datos SQLite de la VPS (nuestro Supabase interno)
        const dbPath = path.resolve('data/newnews.db');
        const db = new DatabaseSync(dbPath);
        db.exec('PRAGMA foreign_keys = ON;');
        db.exec('PRAGMA journal_mode = WAL;');

        const id = `report-web-${Date.now()}`;
        db.prepare(`
          INSERT INTO scraped_items (id, platform, url, text, author_public_name, metrics_json, detected_claim, suggested_topic, virality_score, risk_score, status, created_at)
          VALUES (?, ?, ?, ?, 'Público', ?, ?, 'General', ?, 6.0, 'pendiente', datetime('now'))
        `).run(id, platform, url, cleanClaim, JSON.stringify({ declared_views: views, auto_reason: reason, imageUrl: originalImageUrl }), cleanClaim, viralityScore);

        db.close();
        send({ status: 'info', message: '💾 [BASE DE DATOS] Registro catalogado en la VPS con éxito.' });

        // 4. Decidir si califica para auditoría inmediata
        if (viralityScore >= 7.0) {
          send({ status: 'success', message: '🚀 [CORTAFUEGOS SUPERADO] ¡Impacto viral crítico validado! Disparando motor de auditoría en caliente...' });
          
          try {
            send({ status: 'info', message: '🤖 [PROCESO] Redactando verificación con bases de datos jurídicas del BOE e INE...' });
            execSync('node scripts/ai-pipeline.js', { env: process.env });
            send({ status: 'info', message: '✅ [PROCESO] Desmentido redactado y guardado.' });

            send({ status: 'info', message: '🔄 [PROCESO] Sincronizando datos de expedientes...' });
            execSync('node scripts/sync.js', { env: process.env });
            send({ status: 'info', message: '✅ [PROCESO] Base de datos sincronizada.' });

            send({ status: 'info', message: '⚡ [PROCESO] Compilando portal web estático (Astro Build)...' });
            execSync('npm run build', { env: process.env });
            send({ status: 'info', message: '✅ [PROCESO] Reconstrucción de la web completada.' });

            if (process.platform !== 'win32') {
              send({ status: 'info', message: '🔄 [PROCESO] Recargando servidor web PM2...' });
              execSync('pm2 reload newnews --update-env', { env: process.env });
            }
            
            send({ 
              status: 'success', 
              message: '🎉 [ÉXITO] ¡Publicación completada en caliente! La información y el desmentido ya están listos en la portada y expedientes.' 
            });
          } catch (execErr) {
            send({ status: 'error', message: `❌ [ERROR EJECUCIÓN] Falló el motor de compilación: ${execErr.message}` });
          }
        } else {
          send({ 
            status: 'success', 
            message: 'ℹ️ [COLA AUTOMÁTICA] Relevancia local detectada. No requiere procesamiento inmediato de prioridad crítica. Se procesará en el siguiente ciclo automático de 20 minutos.' 
          });
        }

        controller.close();
      } catch (err) {
        send({ status: 'error', message: `❌ [ERROR FATAL] ${err.message}` });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
