import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const dbPaths = [
  path.resolve('data/matiza.db'),
  path.resolve('matizame/data/matiza.db')
];

// 1. Limpieza de base de datos
dbPaths.forEach(dbPath => {
  try {
    if (!fs.existsSync(dbPath)) return;
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON;');
    
    console.log(`[Limpieza de DB] Saneando: ${dbPath}`);
    
    // Obtener artículos sospechosos de ser mocks
    const articles = db.prepare(`
      SELECT id, title, slug FROM articles 
      WHERE id LIKE '%test%' OR id LIKE '%mock%' 
         OR slug LIKE '%test%' OR slug LIKE '%mock%'
         OR title LIKE '%test%' OR title LIKE '%prueba%'
         OR origin_url LIKE '%bulo_falso%'
    `).all();
    
    articles.forEach(art => {
      console.log(`-> Eliminando artículo mock: "${art.title}" (ID: ${art.id})`);
      db.prepare("DELETE FROM article_topics WHERE article_id = ?").run(art.id);
      db.prepare("DELETE FROM article_tags WHERE article_id = ?").run(art.id);
      db.prepare("DELETE FROM sources WHERE article_id = ?").run(art.id);
      db.prepare("DELETE FROM social_posts WHERE article_id = ?").run(art.id);
      db.prepare("DELETE FROM reviews WHERE article_id = ?").run(art.id);
      db.prepare("DELETE FROM articles WHERE id = ?").run(art.id);
    });

    // Eliminar scraped_items de test
    const deletedScraped = db.prepare(`
      DELETE FROM scraped_items 
      WHERE id LIKE '%test%' OR id LIKE '%mock%'
         OR url LIKE '%bulo_falso%' OR url LIKE '%example.com%'
         OR detected_claim LIKE '%prueba%' OR text LIKE '%prueba%'
    `).run();
    
    console.log(`-> ✓ Eliminados ${deletedScraped.changes} scraped_items de prueba/mock.`);
    
    // Limpiar tags huérfanos
    const deletedTags = db.prepare(`
      DELETE FROM tags 
      WHERE id NOT IN (SELECT DISTINCT tag_id FROM article_tags)
    `).run();
    console.log(`-> ✓ Eliminados ${deletedTags.changes} tags huérfanos.`);
    
    db.close();
  } catch (err) {
    console.error(`Error al sanear DB ${dbPath}:`, err.message);
  }
});

// 2. Limpieza de archivos del subproyecto matizame
const filesToClean = [
  'matizame/draft-social-verificacion.json',
  'matizame/social_copies_verificacion.json',
  'matizame/verificacion_autonomos_70_impuestos.json',
  'matizame/verificacion_autonomos_impuesto_70.json',
  'matizame/verificacion_jose_elias.json',
  'matizame/verificacion_jose_elias_extended.json',
  'matizame/output.json',
  'matizame/radar-analysis.json',
  'matizame/check_url_output.txt',
  'matizame/test_mcp.log'
];

filesToClean.forEach(file => {
  try {
    const filePath = path.resolve(file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Limpieza de Disco] ✓ Eliminado archivo de prueba residual: ${file}`);
    }
  } catch (err) {
    console.error(`Error al eliminar archivo ${file}:`, err.message);
  }
});

// Purgar también cualquier JSON residual en la raíz de matizame/data/verificaciones/ si existe
const verifDir = path.resolve('matizame/data/verificaciones');
if (fs.existsSync(verifDir)) {
  try {
    const files = fs.readdirSync(verifDir);
    let count = 0;
    files.forEach(file => {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(verifDir, file));
        count++;
      }
    });
    console.log(`[Limpieza de Disco] ✓ Eliminados ${count} archivos de verificación en matizame/data/verificaciones/`);
  } catch (err) {
    console.error('Error al limpiar directorio de verificaciones:', err.message);
  }
}
