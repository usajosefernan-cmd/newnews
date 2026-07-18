import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/matiza.db');
const db = new DatabaseSync(dbPath);

const articles = db.prepare("SELECT id, slug, title, verdict, status, category, published_at FROM articles ORDER BY created_at DESC LIMIT 5").all();

console.log(`\n=== ÚLTIMOS ARTÍCULOS EN LA BASE DE DATOS ===\n`);
articles.forEach(a => {
  console.log(`ID: ${a.id}`);
  console.log(`Título: ${a.title}`);
  console.log(`Slug: ${a.slug}`);
  console.log(`Veredicto: ${a.verdict}`);
  console.log(`Estado: ${a.status}`);
  console.log(`Categoría: ${a.category}`);
  console.log(`Fecha de Publicación: ${a.published_at || 'No publicado (borrador)'}`);
  console.log('--------------------------------------------------');
});

db.close();
