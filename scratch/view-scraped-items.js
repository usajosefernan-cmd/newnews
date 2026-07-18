import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/matiza.db');
const db = new DatabaseSync(dbPath);

const platformCounts = db.prepare("SELECT platform, COUNT(*) as count FROM scraped_items GROUP BY platform").all();
console.log("\n=== DESGLOSE DE PLATAFORMAS EN SCRAPED_ITEMS ===");
platformCounts.forEach(pc => {
  console.log(`Plataforma: ${pc.platform} | Total: ${pc.count}`);
});

const socialItems = db.prepare("SELECT id, platform, url, detected_claim, suggested_topic, status, virality_score FROM scraped_items WHERE platform != 'Prensa' LIMIT 15").all();

console.log(`\n=== ITEMS DE REDES SOCIALES EN LA DB ===\n`);
socialItems.forEach(i => {
  console.log(`ID: ${i.id}`);
  console.log(`Plataforma: ${i.platform}`);
  console.log(`Tema Sugerido: ${i.suggested_topic}`);
  console.log(`Claim Detectado: ${i.detected_claim || '(Sin claim)'}`);
  console.log(`Estado: ${i.status} | Viralidad: ${i.virality_score}`);
  console.log('--------------------------------------------------');
});

db.close();
