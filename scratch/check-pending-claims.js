import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/matiza.db');
const db = new DatabaseSync(dbPath);

console.log('[Claims Pending Check] Buscando claims en espera de procesamiento en la DB...');

const pending = db.prepare("SELECT id, platform, detected_claim, status FROM scraped_items WHERE status IN ('triage_completado', 'radar_detectado', 'nuevo')").all();

console.log(`Encontrados ${pending.length} claims pendientes:`);
pending.forEach(p => {
  console.log(`ID: ${p.id} | Plataforma: ${p.platform} | Claim: "${p.detected_claim}" | Status: ${p.status}`);
});

db.close();
