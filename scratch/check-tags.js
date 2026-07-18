import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const dbPath = path.resolve('matizame/data/matiza.db');
const db = new DatabaseSync(dbPath);

console.log(`[Check Tags] Consultando tags para el artículo de herencias en: ${dbPath}`);

const row = db.prepare("SELECT id, title FROM articles WHERE slug LIKE 'fiscalidad-herencias%'").get();

if (row && row.id) {
  console.log(`Artículo encontrado: ${row.title} (ID: ${row.id})`);
  
  const tags = db.prepare(`
    SELECT t.name, t.slug
    FROM tags t
    JOIN article_tags at ON t.id = at.tag_id
    WHERE at.article_id = ?
  `).all(row.id);
  
  console.log(`Tags asociados (${tags.length}):`);
  tags.forEach(t => {
    console.log(`- ${t.name} (Slug: ${t.slug})`);
  });
} else {
  console.log('No se encontró ningún artículo de herencias.');
}

db.close();
