import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/matiza.db');
const db = new DatabaseSync(dbPath);

console.log('[Limpieza] Eliminando artículos y relaciones mockeados creados por el fallback anterior...');

// Obtener IDs de artículos mockeados de herencia
const mockArticles = db.prepare("SELECT id FROM articles WHERE title LIKE 'Contraste de datos sobre: HERENCIA y SUCESIÓN%'").all();

mockArticles.forEach(a => {
  console.log(`Eliminando artículo mockeado: ${a.id}`);
  db.prepare("DELETE FROM article_topics WHERE article_id = ?").run(a.id);
  db.prepare("DELETE FROM article_tags WHERE article_id = ?").run(a.id);
  db.prepare("DELETE FROM sources WHERE article_id = ?").run(a.id);
  db.prepare("DELETE FROM social_posts WHERE article_id = ?").run(a.id);
  db.prepare("DELETE FROM reviews WHERE article_id = ?").run(a.id);
  db.prepare("DELETE FROM articles WHERE id = ?").run(a.id);
});

// Limpiar también el claim de scraped_items para que vuelva a estar limpio de triage
db.prepare("UPDATE scraped_items SET status = 'triage_completado' WHERE id = 'radar-youtube-aHR0cHM6Ly93d3cueW91dHViZS5jb20v'").run();

console.log('[Limpieza] ✓ Base de datos saneada con éxito.');
db.close();
