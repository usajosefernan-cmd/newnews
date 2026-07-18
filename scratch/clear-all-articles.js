import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const dbPaths = [
  path.resolve('data/matiza.db'),
  path.resolve('matizame/data/matiza.db')
];

dbPaths.forEach(dbPath => {
  try {
    if (!fs.existsSync(dbPath)) return;
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON;');
    
    console.log(`[Limpieza Total] Vaciando artículos y relaciones de: ${dbPath}`);
    
    db.prepare("DELETE FROM article_topics").run();
    db.prepare("DELETE FROM article_tags").run();
    db.prepare("DELETE FROM sources").run();
    db.prepare("DELETE FROM social_posts").run();
    db.prepare("DELETE FROM reviews").run();
    db.prepare("DELETE FROM articles").run();
    db.prepare("DELETE FROM scraped_items").run();
    db.prepare("DELETE FROM tags").run();
    
    console.log("✓ Base de datos completamente vaciada.");
    db.close();
  } catch (err) {
    console.error(`Error en ${dbPath}:`, err.message);
  }
});

// Eliminar también los JSONs locales de artículos en matizame
const localJsons = [
  'matizame/articulo_jose_elias.json',
  'matizame/articulo_autonomos_70_impuestos.json'
];
localJsons.forEach(file => {
  try {
    const filePath = path.resolve(file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Limpieza Disco] Eliminado: ${file}`);
    }
  } catch (err) {
    console.error(`Error al eliminar ${file}:`, err.message);
  }
});
