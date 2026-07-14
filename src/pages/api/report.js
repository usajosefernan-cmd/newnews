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
            message: `📦 [METADATOS] Enlace interceptado de ${platform}. Título: "${title.substring(0, 55)}..." (${views.toLocaleString('es-ES')} reproducciones en origen)` 
          });
        } catch (e) {
          send({ status: 'warn', message: `⚠️ [ADVERTENCIA] No se pudieron extraer metadatos automáticamente. Se requiere revisión manual de estructura.` });
        }

        // 1.5 Buscar si ya existe una verificación duplicada en la base de datos de la VPS
        const dbPath = path.resolve('data/newnews.db');
        const dbForDup = new DatabaseSync(dbPath);
        dbForDup.exec('PRAGMA foreign_keys = ON;');
        
        let existingVerification = null;
        const searchText = (text.trim() || title || '').toLowerCase();
        if (searchText.length > 5) {
          const keywords = searchText
            .replace(/[^\w\sáéíóúñ]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 4); // Filtrar stop-words de menos de 5 letras

          if (keywords.length > 0) {
            const articles = dbForDup.prepare("SELECT title, slug FROM articles WHERE status = 'publicado'").all();
            for (const art of articles) {
              const artTitleLower = art.title.toLowerCase();
              const matchCount = keywords.filter(kw => artTitleLower.includes(kw)).length;
              // Si coinciden 2 o más palabras clave significativas, es duplicado
              if (matchCount >= 2 || (keywords.length === 1 && matchCount === 1)) {
                existingVerification = art;
                break;
              }
            }
          }
        }
        dbForDup.close();

        if (existingVerification) {
          send({ 
            status: 'success', 
            message: `🔍 [VERIFICACIÓN EXISTENTE] ¡Ya tenemos una verificación completa para este tema! Puedes consultarla directamente en la web aquí: https://143-47-35-167.sslip.io/pro/newnews/noticia/${existingVerification.slug}` 
          });
          controller.close();
          return;
        }

        // 2. Evaluar viralidad y otros índices del tema
        send({ status: 'info', message: '🤖 [FILTRO DE AUDITORÍA] Calculando los índices de relevancia de la noticia...' });
        
        let isViral = false;
        let viralityScore = 2.0;
        let cleanClaim = text.trim() || title || `Enlace de ${platform} reportado por el público.`;
        let reason = "Evaluado por el motor del radar.";

        // Calcular Índice de Viralidad (IV)
        // Escala logarítmica basada en reproducciones reales (views). 
        // 100k views = ~7.5. 240k views = ~8.1.
        let iv = 2.0;
        if (views > 0) {
          iv = Math.max(2.0, Math.min(10.0, Math.log10(views + 1) * 1.5));
        }

        // Calcular Índice de Impacto Social (IIS)
        let iis = 5.0;
        const lowercaseContent = `${url} ${title} ${description} ${text}`.toLowerCase();
        let thematicTag = 'General';
        
        if (lowercaseContent.includes('sánchez') || lowercaseContent.includes('pp') || lowercaseContent.includes('psoe') || lowercaseContent.includes('vox') || lowercaseContent.includes('sumar') || lowercaseContent.includes('diputad') || lowercaseContent.includes('congreso') || lowercaseContent.includes('ley') || lowercaseContent.includes('boe') || lowercaseContent.includes('gobierno') || lowercaseContent.includes('tash') || lowercaseContent.includes('tesh')) {
          iis = 9.0; 
          thematicTag = 'Política y Legislación';
        } else if (lowercaseContent.includes('okupa') || lowercaseContent.includes('alquiler') || lowercaseContent.includes('vivienda') || lowercaseContent.includes('paro') || lowercaseContent.includes('empleo') || lowercaseContent.includes('autónom') || lowercaseContent.includes('impuest')) {
          iis = 8.5; 
          thematicTag = 'Socio-Economía';
        } else if (lowercaseContent.includes('mcp') || lowercaseContent.includes('tool') || lowercaseContent.includes('afiliado') || lowercaseContent.includes('referido') || lowercaseContent.includes('compra')) {
          iis = 7.0; 
          thematicTag = 'Consumo y Tecnología';
        }

        // Calcular Índice de Riesgo de Desinformación (IRD)
        let ird = 4.0;
        if (lowercaseContent.includes('mcp') || lowercaseContent.includes('referido') || lowercaseContent.includes('afiliado') || lowercaseContent.includes('compra') || lowercaseContent.includes('compras')) {
          ird = 8.5; 
        } else if (lowercaseContent.includes('repaso') || lowercaseContent.includes('zasca') || lowercaseContent.includes('brutal') || lowercaseContent.includes('destroza') || lowercaseContent.includes('humilla') || lowercaseContent.includes('!')) {
          ird = 8.0; 
        } else if (lowercaseContent.includes('bulo') || lowercaseContent.includes('mentira') || lowercaseContent.includes('roba') || lowercaseContent.includes('fraude')) {
          ird = 7.5;
        }

        // Si tenemos API Key de Gemini, refinamos con IA
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (apiKey) {
          try {
            const prompt = `Analiza la siguiente URL o afirmación para determinar su viralidad, impacto social y riesgo de desinformación en España:
URL: ${url}
Título/Metadatos: ${title} ${description}
Comentario del usuario: ${text}
Vistas detectadas en origen: ${views}

Debes responder estrictamente en formato JSON con la siguiente estructura:
{
  "is_viral": true/false,
  "virality_score": número del 0.0 al 10.0,
  "social_impact_score": número del 0.0 al 10.0,
  "disinfo_risk_score": número del 0.0 al 10.0,
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
                iv = parseFloat(parsed.virality_score) || iv;
                iis = parseFloat(parsed.social_impact_score) || iis;
                ird = parseFloat(parsed.disinfo_risk_score) || ird;
                if (parsed.detected_claim) cleanClaim = parsed.detected_claim;
                if (parsed.reason) reason = parsed.reason;
              }
            }
          } catch (e) {
            // Ignorar y mantener estimaciones
          }
        }

        // Ponderar viralidad final y urgencia
        viralityScore = Math.max(iv, views >= 10000 ? 7.5 : 2.0);
        if (viralityScore >= 7.0 || iis >= 8.5) {
          isViral = true;
          reason = reason === "Evaluado por el motor del radar." ? "Supera los límites críticos de viralidad o relevancia por temática pública." : reason;
        }

        // Mostrar desglose detallado de índices en la consola
        send({ status: 'info', message: '📊 [ÍNDICES DE RELEVANCIA COMPUTADOS]' });
        send({ status: 'info', message: `  ├─ 📈 Viralidad: ${viralityScore.toFixed(1)}/10 (Basado en ${views.toLocaleString('es-ES')} reproducciones en origen. Escala logarítmica. Umbral de urgencia: 7.0)` });
        send({ status: 'info', message: `  ├─ ⚖️ Impacto Social: ${iis.toFixed(1)}/10 (Temática: ${thematicTag}. Valora la repercusión directa en las leyes, derechos y bienestar de la ciudadanía)` });
        send({ status: 'info', message: `  ├─ ⚠️ Riesgo de Desinformación: ${ird.toFixed(1)}/10 (Evaluando sesgo comercial/referidos, lenguaje emocional o clickbait y falta de datos primarios)` });
        send({ status: 'info', message: `  └─ 🔬 Conclusión: ${reason}` });

        // 3. Registrar en base de datos SQLite de la VPS (nuestro Supabase interno)
        const db = new DatabaseSync(dbPath);
        db.exec('PRAGMA foreign_keys = ON;');
        db.exec('PRAGMA journal_mode = WAL;');

        const id = `report-web-${Date.now()}`;
        db.prepare(`
          INSERT INTO scraped_items (id, platform, url, text, author_public_name, metrics_json, detected_claim, suggested_topic, virality_score, risk_score, status, created_at)
          VALUES (?, ?, ?, ?, 'Público', ?, ?, 'General', ?, ?, 'pendiente', datetime('now'))
        `).run(id, platform, url, cleanClaim, JSON.stringify({ declared_views: views, auto_reason: reason, imageUrl: originalImageUrl }), cleanClaim, viralityScore, ird);

        db.close();
        send({ status: 'info', message: '💾 [BASE DE DATOS] Registro catalogado en la VPS con éxito.' });

        // 4. Decidir si califica para auditoría inmediata
        if (isViral) {
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
