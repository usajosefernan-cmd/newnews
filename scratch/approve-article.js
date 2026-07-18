import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/matiza.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

const articleId = 'art-antigravity-1784313493606';

console.log(`[Aprobación Antigravity] Publicando artículo en vivo: ${articleId}...`);

// Actualizar artículo a publicado
db.prepare(`
  UPDATE articles
  SET status = 'publicado', published_at = datetime('now'), human_review_required = 0
  WHERE id = ?
`).run(articleId);

// Actualizar posts sociales asociados a programado
db.prepare(`
  UPDATE social_posts
  SET status = 'programado', scheduled_at = datetime('now')
  WHERE article_id = ?
`).run(articleId);

console.log(`[Aprobación Antigravity] ✓ Artículo publicado exitosamente.`);
db.close();
