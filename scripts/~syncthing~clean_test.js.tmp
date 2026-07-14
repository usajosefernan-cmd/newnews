import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/newnews.db');
db.exec("DELETE FROM articles WHERE slug LIKE '%tesh-sidi%' OR title LIKE '%tesh%' OR title LIKE '%Tesh%'");
db.exec("DELETE FROM scraped_items WHERE url LIKE '%RIdWFv0Mv44%'");
db.close();
console.log('Database cleaned successfully.');
