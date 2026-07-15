const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const dbPath = path.resolve('data/newnews.db');
const db = new DatabaseSync(dbPath);
db.exec('DELETE FROM articles; DELETE FROM scraped_items; DELETE FROM sources; DELETE FROM social_posts;');
db.close();
console.log('Database cleaned successfully.');
