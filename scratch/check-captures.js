import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/matiza.db');
const db = new DatabaseSync(dbPath);

const articles = db.prepare("SELECT id, title, slug, multimedia_url FROM articles ORDER BY created_at DESC LIMIT 3").all();

console.log(`\n=== VERIFICACIÓN DE CAPTURAS DE PANTALLA EN DB ===\n`);
articles.forEach(a => {
  console.log(`Artículo: ${a.title}`);
  console.log(`ID: ${a.id}`);
  console.log(`Slug: ${a.slug}`);
  console.log(`multimedia_url en DB: ${a.multimedia_url}`);
  if (a.multimedia_url) {
    const fullPath = path.join(process.cwd(), 'public', a.multimedia_url.replace(/^\//, ''));
    console.log(`Ruta Física: ${fullPath}`);
    console.log(`¿Existe el archivo físico?: ${fs.existsSync(fullPath) ? '🟢 SÍ' : '🔴 NO'}`);
  } else {
    console.log(`¿Tiene captura?: 🔴 No tiene multimedia_url`);
  }
  console.log('--------------------------------------------------');
});

db.close();
