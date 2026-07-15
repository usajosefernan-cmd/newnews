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

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║ 🤖 NEWNEWS: PIPELINE DE INTELIGENCIA ARTIFICIAL MODULAR 🤖 ║');
console.log('╚══════════════════════════════════════════════════════╝');

async function runPipeline() {
  // 1. Detectar temas calientes y actualizar verticales antes de procesar claims
  try {
    console.log('\n--- PASO 00: Hot Topics Cron ---');
    await detectHotTopics();
  } catch (err) {
    console.error('[Pipeline IA] Fallo en la fase 00 (Hot Topics):', err.message);
  }

  const db = getDb();
  
  // Obtener items pendientes de scraped_items y de user_submissions (enviados por usuarios)
  const pendingScraped = db.prepare("SELECT * FROM scraped_items WHERE status = 'pendiente'").all();
  const pendingSubmissions = db.prepare("SELECT * FROM user_submissions WHERE status = 'recibido'").all();

  console.log(`\n[Pipeline IA] Items en cola de radar: ${pendingScraped.length} pendientes.`);
  console.log(`[Pipeline IA] Envios de usuarios en cola: ${pendingSubmissions.length} pendientes.`);

  const updateScrapedStatus = db.prepare("UPDATE scraped_items SET status = ?, risk_score = ?, virality_score = ? WHERE id = ?");
  const updateSubmissionStatus = db.prepare("UPDATE user_submissions SET status = ?, reason = ?, relevance_score = ? WHERE id = ?");

  // Procesar envíos de usuarios primero (Triage)
  for (const sub of pendingSubmissions) {
    const textToAnalyze = sub.submitted_text || sub.submitted_url || '';
    console.log(`\n[Pipeline IA] Triando envío de usuario: "${textToAnalyze.substring(0, 50)}..."`);
    
    try {
      // 1. Filtrar ruido
      const noise = await filterNoise(textToAnalyze, 'Usuario');
      if (noise.is_noise) {
        console.log(`  -> [Triage] Descartado por ruido comercial o irrelevancia.`);
        updateSubmissionStatus.run('descartado_por_baja_relevancia', noise.noise_reason, 1.0, sub.id);
        continue;
      }

      // 2. Evaluar relevancia
      const relevance = await evaluateRelevance(textToAnalyze, 'Usuario');
      if (!relevance.should_process) {
        console.log(`  -> [Triage] Marcado como monitorizando / en cola por baja relevancia inicial.`);
        updateSubmissionStatus.run('monitorizando', relevance.reason, relevance.public_interest_score, sub.id);
        continue;
      }

      // 3. Extraer claim
      const claimData = await extractClaim(textToAnalyze);

      // 4. Copiar al radar de scraped_items para su posterior análisis completo
      const radarId = `radar-user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      db.prepare(`
        INSERT INTO scraped_items (
          id, platform, url, text, author_public_name, metrics_json, detected_claim, suggested_topic, virality_score, risk_score, status, created_at
        ) VALUES (?, 'Usuario', ?, ?, 'Usuario Anónimo', '{}', ?, 'General', ?, ?, 'pendiente', datetime('now'))
      `).run(
        radarId,
        sub.submitted_url || null,
        textToAnalyze,
        claimData.detected_claim,
        relevance.virality_score || 5.0,
        relevance.harm_score || 5.0
      );

      // Actualizar el estado de la sugerencia del usuario a "en_cola"
      updateSubmissionStatus.run('en_cola', 'Aprobado en triage automático e insertado en la cola del radar.', relevance.public_interest_score, sub.id);
      console.log(`  ✅ Triage de usuario aprobado. Claim insertado en scraped_items.`);
    } catch (e) {
      console.error(`  ❌ Error triando envío de usuario ${sub.id}:`, e.message);
      updateSubmissionStatus.run('recibido', `Error en triage: ${e.message}`, 0.0, sub.id);
    }
  }

  // Procesar items de scraped_items
  for (const item of pendingScraped) {
    console.log(`\n======================================================`);
    console.log(`🚀 [Pipeline IA] Procesando claim de radar: "${item.detected_claim.substring(0, 50)}..."`);
    console.log(`======================================================`);

    const textToProcess = item.text || item.detected_claim || '';

    try {
      // FASE 04: Noise Filter
      const noise = await filterNoise(textToProcess, item.platform);
      if (noise.is_noise) {
        console.log(`  -> [Noise Filter] Descartando item por ruido: ${noise.noise_reason}`);
        updateScrapedStatus.run('ruido', 0.0, item.virality_score, item.id);
        continue;
      }

      // FASE 01: Relevance Gate
      const metrics = JSON.parse(item.metrics_json || '{}');
      metrics.score = item.virality_score * 10; // Mapeo a escala 100
      const relevance = await evaluateRelevance(textToProcess, item.platform, metrics);
      
      if (!relevance.should_process) {
        console.log(`  -> [Relevance Gate] Omitiendo item por baja relevancia: ${relevance.reason}`);
        updateScrapedStatus.run('descartado_por_baja_relevancia', relevance.harm_score, relevance.virality_score, item.id);
        continue;
      }

      // FASE 05: Claim Extractor
      const claimData = await extractClaim(textToProcess);
      const claimToVerify = claimData.detected_claim || item.detected_claim;

      // FASE 02: Semantic Router
      const route = await routeSemanticContent(claimToVerify, item.suggested_topic);
      const topicId = route.topic_match.existing_topic_id || 't-economia';

      // FASE 06: Capa de Caché Semántica
      const cachedClaim = getClaimCache(claimToVerify);
      if (cachedClaim && cachedClaim.reuse_allowed && cachedClaim.previous_article_id) {
        console.log(`  ✅ [Caché Semántica] Encontrada verificación anterior idéntica: Reutilizando artículo ${cachedClaim.previous_article_id}`);
        
        // Simplemente asociar este scraped_item al artículo existente actualizando viralidad o duplicando
        updateScrapedStatus.run('procesado', relevance.harm_score, relevance.virality_score, item.id);
        continue;
      }

      // FASE 03: Source Strategy Planner
      const sourcePlan = await planSourceStrategy(claimToVerify, item.suggested_topic, route.claim_type);

      // FASE 06: Evidence Finder
      const evidence = await findEvidence(claimToVerify, topicId, sourcePlan.source_strategy);

      // FASE 07: Verifier
      const verification = await verifyClaim(claimToVerify, evidence.sources);

      // FASE 08: Article Writer
      let article = await writeArticle(claimToVerify, verification, evidence.sources);

      // FASE 09: Quality Gate (Validación e iteración deontológica rápida)
      let quality = await checkQuality(article, verification.verdict);
      if (!quality.passed) {
        console.log(`  ⚠️ [Quality Gate] No pasó control deontológico: ${quality.reason}. Re-redactando...`);
        // Volver a escribir con feedback de correcciones
        article = await writeArticle(claimToVerify, {
          ...verification,
          verdict_reasoning: verification.verdict_reasoning + `\nCORRECCIONES DE DEFENSOR DEL LECTOR REQUERIDAS: ${quality.corrections_required.join('. ')}`
        }, evidence.sources);
      }

      // Escribir en base de datos el nuevo artículo en estado borrador (requiere aprobación rápida humana)
      const articleId = `art-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const slug = article.title
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 60);

      const category = db.prepare("SELECT category FROM topics WHERE id = ?").get(topicId)?.category || 'General';

      db.prepare(`
        INSERT INTO articles (
          id, topic_id, slug, title, subtitle, claim, origin_platform, origin_url, origin_summary, 
          category, verdict, confidence, summary, explanation, what_is_true, what_is_false, 
          what_lacks_context, what_is_not_proven, status, human_review_required, published_at, origin_date,
          multimedia_url, multimedia_type, trick_used, newnews_score, emoji_tag, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador', 1, null, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        articleId,
        topicId,
        slug,
        article.title,
        article.subtitle,
        claimToVerify,
        item.platform,
        item.url,
        item.text,
        category,
        verification.verdict,
        verification.confidence,
        article.summary,
        article.explanation,
        verification.what_is_true,
        verification.what_is_false,
        verification.what_lacks_context,
        verification.what_is_not_proven,
        item.origin_date || new Date().toISOString(),
        metrics.imageUrl || null,
        metrics.imageUrl ? 'image' : null,
        article.trick_used || 'dato sin base',
        article.newnews_score || 50,
        article.emoji_tag || '🧊 Falta contexto'
      );

      // Insertar fuentes asociadas
      const insertSource = db.prepare(`
        INSERT OR REPLACE INTO sources (id, article_id, title, url, source_type, authority_level, quote_or_summary, date_accessed)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);
      evidence.sources.forEach((src, idx) => {
        insertSource.run(
          `src-ai-${Date.now()}-${idx}-${Math.floor(Math.random() * 100)}`,
          articleId,
          src.title,
          src.url,
          src.source_type || 'oficial',
          src.authority_level || 'Alta',
          src.quote_or_summary
        );
      });

      // FASE 10: Review Queue (Encolar artículo y checklist de revisión rápida)
      queueForReview(articleId, `Calidad deontológica evaluada con score de: ${quality.quality_score}/10.`);

      // FASE 11: Social Writer
      const socialPosts = await writeSocialPosts(article.title, article.subtitle, verification.verdict, claimToVerify);
      const insertSocialPost = db.prepare(`
        INSERT OR REPLACE INTO social_posts (id, article_id, platform, format, content, status, scheduled_at, published_at)
        VALUES (?, ?, ?, ?, ?, 'borrador', null, null)
      `);
      socialPosts.forEach((post, idx) => {
        insertSocialPost.run(
          `soc-ai-${Date.now()}-${idx}-${Math.floor(Math.random() * 100)}`,
          articleId,
          post.platform,
          post.format,
          post.content
        );
      });

      // Guardar en la caché de claims para futuros desmentidos
      setClaimCache(claimToVerify, {
        similar_claims: [claimToVerify],
        previous_verdict: verification.verdict,
        previous_sources: evidence.sources,
        previous_article_id: articleId,
        reuse_allowed: true
      });

      // Actualizar el estado del item de radar a procesado
      updateScrapedStatus.run('procesado', relevance.harm_score, relevance.virality_score, item.id);
      console.log(`  ✅ Procesado con éxito: "${article.title}" agregado a revisión.`);

    } catch (err) {
      console.error(`  ❌ Error procesando claim "${item.detected_claim}":`, err.message);
      updateScrapedStatus.run('error', 0.0, item.virality_score, item.id);
    }
  }

  db.close();
  console.log('\n[Pipeline IA] Procesamiento finalizado de forma modular.');
}

runPipeline().catch(err => {
  console.error('[Pipeline IA] Error crítico en ejecución:', err);
});
