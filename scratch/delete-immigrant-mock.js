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
    
    console.log(`[Limpieza Profunda] Escaneando DB: ${dbPath}`);
    
    // Obtener IDs de artículos con el bulo de inmigrantes
    const articles = db.prepare("SELECT id, title FROM articles WHERE title LIKE '%Paga de 4.000€%' OR claim LIKE '%Paga de 4.000€%'").all();
    
    articles.forEach(art => {
      console.log(`Eliminando artículo de inmigrantes mockeado: ${art.title} (ID: ${art.id})`);
      db.prepare("DELETE FROM article_topics WHERE article_id = ?").run(art.id);
      db.prepare("DELETE FROM article_tags WHERE article_id = ?").run(art.id);
      db.prepare("DELETE FROM sources WHERE article_id = ?").run(art.id);
      db.prepare("DELETE FROM social_posts WHERE article_id = ?").run(art.id);
      db.prepare("DELETE FROM reviews WHERE article_id = ?").run(art.id);
      db.prepare("DELETE FROM articles WHERE id = ?").run(art.id);
    });

    // Eliminar de scraped_items
    const deletedScraped = db.prepare("DELETE FROM scraped_items WHERE detected_claim LIKE '%Paga de 4.000€%' OR text LIKE '%Paga de 4.000€%'").run();
    console.log(`✓ Eliminados ${deletedScraped.changes} scraped_items relacionados.`);
    
    db.close();
  } catch (err) {
    console.error(`Error en ${dbPath}:`, err.message);
  }
});

// Limpieza de archivos JSON de prueba en matizame/data/verificaciones/
const verifDir = path.resolve('matizame/data/verificaciones');
if (fs.existsSync(verifDir)) {
  try {
    const files = fs.readdirSync(verifDir);
    let deletedFilesCount = 0;
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const filePath = path.join(verifDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes('4.000€') || content.includes('inmigrantes')) {
          fs.unlinkSync(filePath);
          deletedFilesCount++;
        }
      }
    });
    console.log(`✓ Eliminados ${deletedFilesCount} archivos JSON residuales de verificación en matizame/data/verificaciones/`);
  } catch (err) {
    console.error('Error al limpiar JSONs residuales:', err.message);
  }
}
