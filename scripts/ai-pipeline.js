import { getDb } from './newnews-engine/config.js';
import { detectHotTopics } from './newnews-engine/00-hot-topics-cron.js';
import { evaluateRelevance } from './newnews-engine/01-relevance-gate.js';
import { routeSemanticContent } from './newnews-engine/02-semantic-router.js';
import { planSourceStrategy } from './newnews-engine/03-source-strategy-planner.js';
import { filterNoise } from './newnews-engine/04-noise-filter.js';
import { extractClaim } from './newnews-engine/05-claim-extractor.js';
import { findEvidence } from './newnews-engine/06-evidence-finder.js';
import { verifyClaim } from './newnews-engine/07-verifier.js';
import { writeArticle } from './newnews-engine/08-article-writer.js';
import { checkQuality } from './newnews-engine/09-quality-gate.js';
import { queueForReview } from './newnews-engine/10-review-queue.js';
import { writeSocialPosts } from './newnews-engine/11-social-writer.js';
import { getClaimCache, setClaimCache } from './newnews-engine/cache.js';

import fs from 'node:fs';
import path from 'node:path';

// Parsear argumentos de fase y de item específico
const args = process.argv.slice(2);
const phaseArg = args.find(arg => arg.startsWith('--phase='));
const phase = phaseArg ? phaseArg.split('=')[1] : null;

const itemIdArg = args.find(arg => arg.startsWith('--item-id='));
const itemId = itemIdArg ? itemIdArg.split('=')[1] : null;

// Cargar estado de piloto automático (autopilot) desde pipeline_config.json
let autopilot = false;
try {
  const configPath = path.resolve('pipeline_config.json');
  if (fs.existsSync(configPath)) {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    autopilot = !!cfg.global?.autopilot;
  }
} catch (e) {
  console.error('[Pipeline config] No se pudo leer autopilot:', e.message);
}

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║ 🤖 NEWNEWS: PIPELINE DE INTELIGENCIA ARTIFICIAL MODULAR 🤖 ║');
if (phase) {
  console.log(`║      FASE SELECCIONADA: ${phase.toUpperCase().padEnd(28)} ║`);
} else {
  console.log('║      FASE SELECCIONADA: CICLO COMPLETO               ║');
}
console.log('╚══════════════════════════════════════════════════════╝');

// Función de similitud Jaccard para deduplicación léxica
function getJaccardSimilarity(str1, str2) {
  const clean = (s) => new Set((s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3));
  const s1 = clean(str1);
  const s2 = clean(str2);
  if (s1.size === 0 || s2.size === 0) return 0;
  const intersection = new Set([...s1].filter(x => s2.has(x)));
  const union = new Set([...s1, ...s2]);
  return intersection.size / union.size;
}

async function runPipeline() {
  const db = getDb();

  // FASE 00: Hot Topics (Sólo en ciclo completo o fase de triage/00)
  if (!phase || phase === 'triage' || phase === '00') {
    try {
      console.log('\n--- PASO 00: Hot Topics Cron ---');
      await detectHotTopics();
    } catch (err) {
      console.error('[Pipeline IA] Fallo en la fase 00 (Hot Topics):', err.message);
    }
  }

  // ==========================================
  // FLUJO: TRIAGE (Noise Filter, Relevance Gate)
  // ==========================================
  if (!phase || ['triage', '01', '04', '05'].includes(phase)) {
    console.log('\n--- PIPELINE: TRIAGE Y FILTRADO DE SPAM ---');
    const pendingSubmissions = db.prepare("SELECT * FROM user_submissions WHERE status = 'recibido'").all();
    const pendingScraped = itemId 
      ? db.prepare("SELECT * FROM scraped_items WHERE id = ?").all(itemId)
      : db.prepare("SELECT * FROM scraped_items WHERE status IN ('pendiente', 'procesando', 'triage_completado')").all();

    console.log(`[Triage] Envios de usuarios: ${pendingSubmissions.length} en cola.`);
    console.log(`[Triage] Claims del radar: ${pendingScraped.length} en cola.`);

    const updateSubmissionStatus = db.prepare("UPDATE user_submissions SET status = ?, reason = ?, relevance_score = ? WHERE id = ?");
    const updateScrapedStatus = db.prepare("UPDATE scraped_items SET status = ?, risk_score = ?, virality_score = ? WHERE id = ?");

    // Triage de envíos de usuarios
    for (const sub of pendingSubmissions) {
      const textToAnalyze = sub.submitted_text || sub.submitted_url || '';
      try {
        const noise = await filterNoise(textToAnalyze, 'Usuario');
        if (noise.is_noise) {
          updateSubmissionStatus.run('descartado_por_baja_relevancia', noise.noise_reason, 1.0, sub.id);
          continue;
        }
        const relevance = await evaluateRelevance(textToAnalyze, 'Usuario');
        if (!relevance.should_process) {
          updateSubmissionStatus.run('monitorizando', relevance.reason, relevance.public_interest_score, sub.id);
          continue;
        }
        const claimData = await extractClaim(textToAnalyze);
        const radarId = `radar-user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        db.prepare(`
          INSERT INTO scraped_items (id, platform, url, text, author_public_name, metrics_json, detected_claim, suggested_topic, virality_score, risk_score, status, created_at)
          VALUES (?, 'Usuario', ?, ?, 'Usuario Anónimo', '{}', ?, 'General', ?, ?, 'triage_completado', datetime('now'))
        `).run(radarId, sub.submitted_url || null, textToAnalyze, claimData.detected_claim, relevance.virality_score || 5.0, relevance.harm_score || 5.0);

        updateSubmissionStatus.run('en_cola', 'Aprobado en triage automático e insertado en la cola del radar.', relevance.public_interest_score, sub.id);
        console.log(`  ✅ Triage de usuario aprobado: "${claimData.detected_claim}"`);
      } catch (e) {
        console.error(`  ❌ Error triando envío de usuario:`, e.message);
      }
    }

    // Triage de claims del radar
    for (const item of pendingScraped) {
      const textToProcess = item.text || item.detected_claim || '';
      try {
        const isRequestedManual = (itemId !== null && item.id === itemId) || item.platform === 'Manual' || item.platform === 'Usuario';
        
        let isNoise = false;
        let shouldProcess = true;
        let harmScore = 5.0;
        let viralityScore = item.virality_score || 5.0;
        
        if (!isRequestedManual) {
          const noise = await filterNoise(textToProcess, item.platform);
          if (noise.is_noise) {
            updateScrapedStatus.run('ruido', 0.0, item.virality_score, item.id);
            console.log(`  -> [Noise Filter] Descartado: ${noise.noise_reason}`);
            continue;
          }
          const metrics = JSON.parse(item.metrics_json || '{}');
          metrics.score = item.virality_score * 10;
          const relevance = await evaluateRelevance(textToProcess, item.platform, metrics);
          shouldProcess = relevance.should_process;
          harmScore = relevance.harm_score;
          viralityScore = relevance.virality_score;
          if (!shouldProcess) {
            updateScrapedStatus.run('descartado_por_baja_relevancia', harmScore, viralityScore, item.id);
            console.log(`  -> [Relevance] Omitido: ${relevance.reason}`);
            continue;
          }
        } else {
          console.log(`  ⚡ [Triage Override] Saltando filtros de relevancia/ruido para item manual/solicitado: "${item.id}"`);
        }
        
        // Comprobar duplicación de claim con artículos existentes
        const claimData = await extractClaim(textToProcess);
        const claimToVerify = claimData.detected_claim || item.detected_claim;

        const existingArticles = db.prepare("SELECT id, claim, title FROM articles").all();
        let isDuplicate = false;
        for (const art of existingArticles) {
          if (getJaccardSimilarity(claimToVerify, art.claim) > 0.45 || getJaccardSimilarity(claimToVerify, art.title) > 0.45) {
            isDuplicate = true;
            break;
          }
        }
        if (isDuplicate) {
          updateScrapedStatus.run('procesado', harmScore, viralityScore, item.id);
          console.log(`  -> [Deduplicador] Evitando procesado duplicado del claim: "${claimToVerify}"`);
          continue;
        }

        // Si supera triage, marcar como triage_completado
        updateScrapedStatus.run('triage_completado', harmScore, viralityScore, item.id);
        console.log(`  ✅ Triage superado para: "${claimToVerify}"`);
      } catch (e) {
        console.error(`  ❌ Error triando item del radar:`, e.message);
      }
    }
  }

  // ==========================================
  // FLUJO: BUSCAR EVIDENCIAS (Semantic Router, Strategy Planner, Evidence Finder)
  // ==========================================
  if (!phase || ['evidence', '02', '03', '06'].includes(phase)) {
    console.log('\n--- PIPELINE: BÚSQUEDA DE EVIDENCIAS Y FACT-CHECKING ---');
    const pendingTriage = itemId
      ? db.prepare("SELECT * FROM scraped_items WHERE id = ?").all(itemId)
      : db.prepare("SELECT * FROM scraped_items WHERE status IN ('triage_completado', 'evidencias_encontradas')").all();
    console.log(`[Evidence Finder] Claims listos para buscar evidencias: ${pendingTriage.length}`);

    const updateScrapedStatus = db.prepare("UPDATE scraped_items SET status = ?, metrics_json = ? WHERE id = ?");

    for (const item of pendingTriage) {
      console.log(`🚀 Buscando evidencias para: "${item.detected_claim}"`);
      try {
        const route = await routeSemanticContent(item.detected_claim, item.suggested_topic);
        const topicId = route.topic_matches && route.topic_matches.length > 0 
          ? route.topic_matches[0].existing_topic_id 
          : (route.topic_match?.existing_topic_id || 't-economia');
        
        const allTopics = route.topic_matches && Array.isArray(route.topic_matches)
          ? route.topic_matches.map(tm => tm.existing_topic_id).filter(Boolean)
          : [topicId];

        const sourcePlan = await planSourceStrategy(item.detected_claim, item.suggested_topic, route.claim_type);
        const evidence = await findEvidence(item.detected_claim, topicId, sourcePlan.source_strategy);

        // Guardar las evidencias recolectadas serializadas dentro de metrics_json para que la fase de redacción las use
        const currentMetrics = JSON.parse(item.metrics_json || '{}');
        currentMetrics.collectedEvidence = evidence.sources;
        currentMetrics.topicId = topicId;
        currentMetrics.allTopics = allTopics;

        updateScrapedStatus.run('evidencias_encontradas', JSON.stringify(currentMetrics), item.id);
        console.log(`  ✅ Evidencias guardadas (${evidence.sources.length} fuentes encontradas)`);
      } catch (e) {
        console.error(`  ❌ Error buscando evidencias:`, e.message);
        updateScrapedStatus.run('error', item.metrics_json, item.id);
      }
    }
  }

  // ==========================================
  // FLUJO: VERIFICAR Y REDACTAR (Verifier, Writer, Quality Gate)
  // ==========================================
  if (!phase || ['write', '07', '08', '09', '10'].includes(phase)) {
    console.log('\n--- PIPELINE: REDACCIÓN DE DESMENTIDOS Y DEONTOLOGÍA ---');
    
    // Si corre en fase aislada, toma las que tienen 'evidencias_encontradas'. 
    // En ciclo completo, también puede tomar 'triage_completado' como fallback si falló el paso anterior.
    const queryStr = (phase && ['07', '08', '09', '10'].includes(phase))
      ? "SELECT * FROM scraped_items WHERE status IN ('evidencias_encontradas', 'procesado')"
      : "SELECT * FROM scraped_items WHERE status IN ('triage_completado', 'evidencias_encontradas')";
    
    const pendingWrite = itemId
      ? db.prepare("SELECT * FROM scraped_items WHERE id = ?").all(itemId)
      : db.prepare(queryStr).all();
    console.log(`[Writer] Claims listos para verificar y redactar: ${pendingWrite.length}`);

    const updateScrapedStatus = db.prepare("UPDATE scraped_items SET status = ? WHERE id = ?");

    for (const item of pendingWrite) {
      console.log(`🚀 Redactando desmentido para: "${item.detected_claim}"`);
      try {
        const metrics = JSON.parse(item.metrics_json || '{}');
        let sources = metrics.collectedEvidence || [];

        // Si no hay evidencias guardadas previamente, hacer búsqueda rápida de fallback
        if (sources.length === 0) {
          const route = await routeSemanticContent(item.detected_claim, item.suggested_topic);
          const topicId = route.topic_matches && route.topic_matches.length > 0 
            ? route.topic_matches[0].existing_topic_id 
            : (route.topic_match?.existing_topic_id || 't-economia');
          
          const allTopics = route.topic_matches && Array.isArray(route.topic_matches)
            ? route.topic_matches.map(tm => tm.existing_topic_id).filter(Boolean)
            : [topicId];

          const sourcePlan = await planSourceStrategy(item.detected_claim, item.suggested_topic, route.claim_type);
          const evidence = await findEvidence(item.detected_claim, topicId, sourcePlan.source_strategy);
          sources = evidence.sources;
          metrics.topicId = topicId;
          metrics.allTopics = allTopics;
        }

        const topicId = metrics.topicId || 't-economia';
        const verification = await verifyClaim(item.detected_claim, sources);
        let article = await writeArticle(item.detected_claim, verification, sources);
        
        let quality = await checkQuality(article, verification.verdict);
        if (!quality.passed) {
          console.log(`  ⚠️ Def Defensor del Lector: Re-redactando por fallar control de calidad deontológico...`);
          article = await writeArticle(item.detected_claim, {
            ...verification,
            verdict_reasoning: verification.verdict_reasoning + `\nCORRECCIONES DE CALIDAD REQUERIDAS: ${quality.corrections_required.join('. ')}`
          }, sources);
        }

        // Escribir artículo en base de datos
        const articleId = `art-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const slug = article.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 60);
        const category = db.prepare("SELECT category FROM topics WHERE id = ?").get(topicId)?.category || 'General';

        const isTestItem = !!itemId;
        const statusVal = (autopilot || isTestItem) ? 'publicado' : 'borrador';
        const reviewVal = (autopilot || isTestItem) ? 0 : 1;
        const pubAtVal = (autopilot || isTestItem) ? new Date().toISOString() : null;

        db.prepare(`
          INSERT INTO articles (
            id, topic_id, slug, title, subtitle, claim, origin_platform, origin_url, origin_summary, 
            category, verdict, confidence, summary, explanation, what_is_true, what_is_false, 
            what_lacks_context, what_is_not_proven, status, human_review_required, published_at, origin_date,
            multimedia_url, multimedia_type, trick_used, newnews_score, emoji_tag, infographic_svg, infographic_parts, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(
          articleId, topicId, slug, article.title, article.subtitle, item.detected_claim,
          item.platform, item.url, item.text, category, verification.verdict, verification.confidence,
          article.summary, article.explanation, verification.what_is_true, verification.what_is_false,
          verification.what_lacks_context, verification.what_is_not_proven,
          statusVal, reviewVal, pubAtVal,
          item.origin_date || new Date().toISOString(), metrics.imageUrl || null, metrics.imageUrl ? 'image' : null,
          article.trick_used || 'dato sin base', article.newnews_score || 50, article.emoji_tag || '🧊 Falta contexto',
          article.infographic_svg || null,
          JSON.stringify(article.infographic_parts || [])
        );

        // Insertar relaciones con múltiples temas/expedientes
        const insertArticleTopic = db.prepare(`
          INSERT OR IGNORE INTO article_topics (article_id, topic_id)
          VALUES (?, ?)
        `);
        // Registrar el principal
        insertArticleTopic.run(articleId, topicId);
        // Registrar los secundarios si existen
        if (metrics.allTopics && Array.isArray(metrics.allTopics)) {
          for (const tId of metrics.allTopics) {
            if (tId !== topicId) {
              insertArticleTopic.run(articleId, tId);
            }
          }
        }

        // Insertar fuentes
        const insertSource = db.prepare(`
          INSERT OR REPLACE INTO sources (id, article_id, title, url, source_type, authority_level, quote_or_summary, date_accessed)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);
        sources.forEach((src, idx) => {
          insertSource.run(`src-ai-${Date.now()}-${idx}`, articleId, src.title, src.url, src.source_type || 'oficial', src.authority_level || 'Alta', src.quote_or_summary);
        });

        // Encolar revisión
        queueForReview(articleId, `Revisión deontológica completada: ${quality.quality_score}/10.`);

        // Guardar caché
        setClaimCache(item.detected_claim, {
          similar_claims: [item.detected_claim],
          previous_verdict: verification.verdict,
          previous_sources: sources,
          previous_article_id: articleId,
          reuse_allowed: true
        });

        updateScrapedStatus.run('procesado', item.id);
        console.log(`  ✅ Borrador de artículo creado con éxito: "${article.title}"`);
      } catch (e) {
        console.error(`  ❌ Error redactando artículo:`, e.message);
        updateScrapedStatus.run('error', item.id);
      }
    }
  }

  // ==========================================
  // FLUJO: GENERACIÓN SOCIAL (Twitter, Telegram)
  // ==========================================
  if (!phase || ['social', '11'].includes(phase)) {
    console.log('\n--- PIPELINE: GENERACIÓN DE COPIES REDES SOCIALES ---');
    let pendingSocialArticles;
    if (itemId) {
      pendingSocialArticles = db.prepare(`
        SELECT * FROM articles 
        WHERE claim = (SELECT detected_claim FROM scraped_items WHERE id = ?)
        AND id NOT IN (SELECT DISTINCT article_id FROM social_posts)
      `).all(itemId);
    } else {
      const queryStr = (phase === '11')
        ? "SELECT * FROM articles"
        : "SELECT * FROM articles WHERE id NOT IN (SELECT DISTINCT article_id FROM social_posts)";
      pendingSocialArticles = db.prepare(queryStr).all();
    }
    console.log(`[Social Writer] Artículos para generación de copys de redes: ${pendingSocialArticles.length}`);

    const insertSocialPost = db.prepare(`
      INSERT OR REPLACE INTO social_posts (id, article_id, platform, format, content, status, scheduled_at, published_at)
      VALUES (?, ?, ?, ?, ?, 'borrador', null, null)
    `);

    for (const art of pendingSocialArticles) {
      console.log(`🚀 Generando copies de redes para: "${art.title}"`);
      try {
        const posts = await writeSocialPosts(art.title, art.subtitle, art.verdict, art.claim);
        let postsArray = [];
        if (Array.isArray(posts)) {
          postsArray = posts;
        } else if (posts && typeof posts === 'object') {
          const keyWithArray = Object.keys(posts).find(k => Array.isArray(posts[k]));
          if (keyWithArray) {
            postsArray = posts[keyWithArray];
          }
        }
        postsArray.forEach((post, idx) => {
          insertSocialPost.run(`soc-ai-${Date.now()}-${idx}`, art.id, post.platform, post.format, post.content);
        });
        console.log(`  ✅ Copies sociales de Twitter/Telegram creados con éxito.`);
      } catch (e) {
        console.error(`  ❌ Error generando copies sociales:`, e.message);
      }
    }
  }

  db.close();
  console.log('\n[Pipeline IA] Finalización limpia de la ejecución.');
}

runPipeline().catch(err => {
  console.error('[Pipeline IA] Error crítico en ejecución:', err);
});
