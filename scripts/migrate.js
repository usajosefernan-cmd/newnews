import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/newnews.db');
console.log(`[Migration] Conectando y creando base de datos SQLite en: ${dbPath}`);

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// Habilitar claves foráneas
db.exec('PRAGMA foreign_keys = ON;');

// Tabla topics (Cabeceras de Temas)
db.exec(`
  CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    header_summary TEXT,
    verdict_summary TEXT,
    confidence TEXT,
    status TEXT DEFAULT 'activo',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Tabla articles (Noticias / Desmentidos de Claims)
db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    topic_id TEXT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    claim TEXT,
    origin_platform TEXT,
    origin_url TEXT,
    origin_summary TEXT,
    category TEXT NOT NULL,
    verdict TEXT NOT NULL,
    confidence TEXT,
    summary TEXT,
    explanation TEXT,
    what_is_true TEXT,
    what_is_false TEXT,
    what_lacks_context TEXT,
    what_is_not_proven TEXT,
    status TEXT DEFAULT 'borrador',
    human_review_required INTEGER DEFAULT 1,
    published_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE SET NULL
  );
`);

// Tabla sources (Fuentes originales de los desmentidos)
db.exec(`
  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    source_type TEXT,
    authority_level TEXT,
    quote_or_summary TEXT,
    date_accessed TEXT,
    FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
  );
`);

// Tabla scraped_items (Radar de items sospechosos)
db.exec(`
  CREATE TABLE IF NOT EXISTS scraped_items (
    id TEXT PRIMARY KEY,
    platform TEXT,
    url TEXT,
    text TEXT,
    author_public_name TEXT,
    metrics_json TEXT,
    detected_claim TEXT,
    suggested_topic TEXT,
    virality_score REAL DEFAULT 0.0,
    risk_score REAL DEFAULT 0.0,
    status TEXT DEFAULT 'pendiente',
    created_at TEXT NOT NULL
  );
`);

// Tabla social_posts (Formateado para RRSS)
db.exec(`
  CREATE TABLE IF NOT EXISTS social_posts (
    id TEXT PRIMARY KEY,
    article_id TEXT,
    platform TEXT NOT NULL,
    format TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'borrador',
    scheduled_at TEXT,
    published_at TEXT,
    external_id TEXT,
    FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE SET NULL
  );
`);

// Tabla reviews (Historial de aprobaciones de editores)
db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    reviewer TEXT NOT NULL,
    checklist_json TEXT,
    status TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
  );
`);

// Tabla parties (Partidos Políticos)
db.exec(`
  CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    ideology_summary TEXT,
    official_website TEXT,
    logo_url TEXT,
    current_leader TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Tabla electoral_programs (Programas electorales de partidos)
db.exec(`
  CREATE TABLE IF NOT EXISTS electoral_programs (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL,
    election_name TEXT NOT NULL,
    election_date TEXT NOT NULL,
    program_url TEXT,
    source_file_path TEXT,
    status TEXT DEFAULT 'activo',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
  );
`);

// Tabla policy_measures (Medidas desglosadas por áreas de programas)
db.exec(`
  CREATE TABLE IF NOT EXISTS policy_measures (
    id TEXT PRIMARY KEY,
    program_id TEXT NOT NULL,
    party_id TEXT NOT NULL,
    area TEXT NOT NULL,
    title TEXT NOT NULL,
    original_text TEXT,
    plain_language_summary TEXT NOT NULL,
    possible_impact TEXT,
    target_groups TEXT,
    source_page INTEGER,
    confidence TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(program_id) REFERENCES electoral_programs(id) ON DELETE CASCADE,
    FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
  );
`);

// Tabla promise_tracking (Seguimiento de promesas)
db.exec(`
  CREATE TABLE IF NOT EXISTS promise_tracking (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL,
    measure_id TEXT,
    promise_text TEXT NOT NULL,
    government_level TEXT,
    was_in_government INTEGER DEFAULT 0,
    action_taken TEXT,
    evidence_url TEXT,
    evidence_summary TEXT,
    status TEXT DEFAULT 'prometido',
    notes TEXT,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE,
    FOREIGN KEY(measure_id) REFERENCES policy_measures(id) ON DELETE SET NULL
  );
`);

// Tabla asset_declarations (Bienes declarados)
db.exec(`
  CREATE TABLE IF NOT EXISTS asset_declarations (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL,
    person_name TEXT NOT NULL,
    role TEXT NOT NULL,
    source_url TEXT,
    declared_assets_summary TEXT,
    declared_debts_summary TEXT,
    date_declared TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
  );
`);

// Tabla ai_logs (Historial de tokens y costes de LLMs)
db.exec(`
  CREATE TABLE IF NOT EXISTS ai_logs (
    id TEXT PRIMARY KEY,
    task TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens INTEGER DEFAULT 0,
    cost_estimate REAL DEFAULT 0.0,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Tabla radar_sources (Fuentes dinámicas de monitorización para el radar)
db.exec(`
  CREATE TABLE IF NOT EXISTS radar_sources (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    name TEXT NOT NULL,
    url_or_id TEXT NOT NULL,
    status TEXT DEFAULT 'activo',
    created_at TEXT NOT NULL
  );
`);

// Sembrar fuentes del radar iniciales si no hay ninguna
const countSources = db.prepare("SELECT COUNT(*) as count FROM radar_sources").get();
if (countSources.count === 0) {
  console.log('[Migration] Sembrando fuentes iniciales del radar (RSS, Reddit, Telegram)...');
  const insertSource = db.prepare(`
    INSERT INTO radar_sources (id, platform, name, url_or_id, status, created_at)
    VALUES (?, ?, ?, ?, 'activo', datetime('now'))
  `);
  
  const initialSources = [
    { id: 'source-rss-gt-es', platform: 'RSS', name: 'Google Trends ES', url_or_id: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=ES' },
    { id: 'source-rss-mn-pt', platform: 'RSS', name: 'Menéame Portada', url_or_id: 'https://www.meneame.net/rss' },
    { id: 'source-rss-mn-ac', platform: 'RSS', name: 'Menéame Activas', url_or_id: 'https://www.meneame.net/rss?status=active' },
    { id: 'source-rss-em-es', platform: 'RSS', name: 'El Mundo España', url_or_id: 'https://www.elmundo.es/rss/portada.xml' },
    { id: 'source-rss-ep-na', platform: 'RSS', name: 'El País Nacional', url_or_id: 'https://ep00.epimg.net/rss/elpais/portada.xml' },
    { id: 'source-rss-abc-es', platform: 'RSS', name: 'ABC España', url_or_id: 'https://www.abc.es/rss/2.0/espana/' },
    { id: 'source-reddit-sp', platform: 'Reddit', name: 'Reddit SpainPolitics', url_or_id: 'https://www.reddit.com/r/spainpolitics/hot.json?limit=25' },
    { id: 'source-reddit-es', platform: 'Reddit', name: 'Reddit España', url_or_id: 'https://www.reddit.com/r/es/hot.json?limit=25' },
    { id: 'source-tg-alvise', platform: 'Telegram', name: 'Alvise Pérez', url_or_id: 'Alviseperez' },
    { id: 'source-tg-noticias-es', platform: 'Telegram', name: 'Noticias España Oficial', url_or_id: 'noticias_espana_oficial' }
  ];
  
  for (const src of initialSources) {
    insertSource.run(src.id, src.platform, src.name, src.url_or_id);
  }
}

console.log('[Migration] Base de datos e índices creados exitosamente.');
db.close();
