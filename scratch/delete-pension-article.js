import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const dbPaths = [
  path.resolve('data/matiza.db'),
  path.resolve('matizame/data/matiza.db')
];

dbPaths.forEach(dbPath => {
  try {
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON;');
    
    console.log(`[Limpieza] Limpiando artículo de pensiones inventado de: ${dbPath}`);
    
    // Obtener IDs de artículos con el slug de pensiones
    const art = db.prepare("SELECT id FROM articles WHERE slug = 'sistema-público-pensiones-espana-desmentido-privatizacion-obligatoria'").get();
    
    if (art && art.id) {
      db.prepare("DELETE FROM article_topics WHERE article_id = ?").run(art.id);
      db.prepare("DELETE FROM article_tags WHERE article_id = ?").run(art.id);
      db.prepare("DELETE FROM sources WHERE article_id = ?").run(art.id);
      db.prepare("DELETE FROM social_posts WHERE article_id = ?").run(art.id);
      db.prepare("DELETE FROM reviews WHERE article_id = ?").run(art.id);
      db.prepare("DELETE FROM articles WHERE id = ?").run(art.id);
      console.log(`✓ Artículo ${art.id} y sus relaciones eliminados con éxito.`);
    }

    // Borrar el scraped_item de tiktok
    db.prepare("DELETE FROM scraped_items WHERE id LIKE 'radar-tiktok-%'").run();
    
    db.close();
  } catch (err) {
    console.error(`Error en ${dbPath}:`, err.message);
  }
});
