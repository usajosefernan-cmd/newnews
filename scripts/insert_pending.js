import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/newnews.db');
db.exec("DELETE FROM scraped_items; DELETE FROM articles;");
db.prepare(`
  INSERT INTO scraped_items (id, platform, url, text, author_public_name, metrics_json, detected_claim, suggested_topic, virality_score, risk_score, status, created_at)
  VALUES ('test-pending', 'YouTube', 'https://www.youtube.com/shorts/RIdWFv0Mv44', 'Pero ella comentaba que el ADN del Partido Popular es la libertad... y el Partido Popular votó en contra del matrimonio igualitario, la ley trans, el aborto...', 'Público', '{}', 'El repaso de Tesh Sidi, diputada de Sumar, al PP por su falta de apoyo al colectivo LGTBIQ+', 'Política y Legislación', 8.1, 8.0, 'pendiente', datetime('now'))
`).run();
db.close();
console.log('Inserted pending item.');
