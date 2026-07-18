import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const dbPath = path.resolve('data/matiza.db');
const db = new DatabaseSync(dbPath);

console.log('--- CATEGORÍAS ÚNICAS EN ARTICLES ---');
const categories = db.prepare("SELECT DISTINCT category FROM articles").all();
console.log(categories);

console.log('--- TEMAS ÚNICOS (TOPICS) ---');
const topics = db.prepare("SELECT id, theme_id, slug, title, category FROM topics").all();
console.log(topics);

console.log('--- TEMAS (THEMES) ---');
const themes = db.prepare("SELECT * FROM themes").all();
console.log(themes);

db.close();
