import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const dbPath = path.resolve('matizame/data/matiza.db');
const db = new DatabaseSync(dbPath);

console.log('--- NUEVOS CLAIMS VIRALES DETECTADOS ---');
try {
  const items = db.prepare(`
    SELECT id, platform, author_public_name, detected_claim, suggested_topic, virality_score, text 
    FROM scraped_items 
    WHERE status = 'pendiente' 
    ORDER BY virality_score DESC 
    LIMIT 15
  `).all();
  
  items.forEach((item, idx) => {
    console.log(`[${idx + 1}] Plataforma: ${item.platform} | Virality: ${item.virality_score}%`);
    console.log(`    Autor: ${item.author_public_name}`);
    console.log(`    Tema sugerido: ${item.suggested_topic}`);
    console.log(`    Claim Detectado: "${item.detected_claim || 'N/A'}"`);
    console.log(`    Texto original: "${item.text.substring(0, 150)}..."`);
    console.log('----------------------------------------------------');
  });
} catch (err) {
  console.error('Error al consultar scraped_items:', err.message);
} finally {
  db.close();
}
