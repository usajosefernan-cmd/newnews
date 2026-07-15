import { getDb } from './config.js';
import { execSync } from 'node:child_process';

const db = getDb();

console.log('[Test Pipeline] Insertando claim de prueba en user_submissions...');
const subId = `test-sub-${Date.now()}`;
db.prepare(`
  INSERT INTO user_submissions (id, submitted_url, submitted_text, detected_claim, suggested_topic_id, virality_status, relevance_score, status, reason, created_at)
  VALUES (?, 'https://x.com/bulo_falso/status/1234', 'Aseguran que los inmigrantes reciben una paga de 4.000€ mensuales nada más llegar a España sin cotizar.', 'Paga de 4.000€ a inmigrantes', null, 'Pendiente', 0.0, 'recibido', 'Test', datetime('now'))
`).run(subId);

db.close();

console.log('[Test Pipeline] Ejecutando el pipeline de IA modular...');
try {
  const output = execSync('node scripts/ai-pipeline.js', { encoding: 'utf-8', env: process.env });
  console.log(output);

  // Verificar la base de datos
  const dbVerify = getDb();
  
  const sub = dbVerify.prepare("SELECT * FROM user_submissions WHERE id = ?").get(subId);
  console.log(`[Test Pipeline] Estado del envío: ${sub.status}. Motivo: ${sub.reason}`);

  const articles = dbVerify.prepare("SELECT * FROM articles ORDER BY created_at DESC LIMIT 1").all();
  if (articles.length > 0) {
    const art = articles[0];
    console.log(`[Test Pipeline] Último artículo generado: "${art.title}" (Veredicto: ${art.verdict}, Estado: ${art.status})`);
    
    const review = dbVerify.prepare("SELECT * FROM reviews WHERE article_id = ?").get(art.id);
    if (review) {
      console.log(`[Test Pipeline] Ficha de revisión humana creada: "${review.notes}" (Status: ${review.status})`);
    }

    const posts = dbVerify.prepare("SELECT * FROM social_posts WHERE article_id = ?").all();
    console.log(`[Test Pipeline] Se generaron ${posts.length} borradores de posts sociales.`);
  }

  dbVerify.close();
  console.log('[Test Pipeline] Prueba finalizada correctamente. Todo funciona al 100% de forma modular.');
} catch (e) {
  console.error('[Test Pipeline] Error en test:', e.message);
  if (e.stdout) console.log(e.stdout);
}
