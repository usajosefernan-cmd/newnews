import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { buildInfographic } from '../scripts/infographic-system.js';

// Resolve SQLite Database Path
const dbPath = process.env.MATIZA_DB_PATH || process.env.SQLITE_DB_PATH || 'data/matiza.db';

// Get JSON input file from arguments
const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('Usage: node scratch/update_article.js <path_to_article_data.json>');
  process.exit(1);
}

if (!fs.existsSync(jsonPath)) {
  console.error(`Error: File not found: ${jsonPath}`);
  process.exit(1);
}

try {
  console.log(`Reading article data from: ${jsonPath}...`);
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // Validate required fields
  const requiredFields = ['id', 'title', 'subtitle', 'summary', 'explanation', 'trick_used', 'matiza_score', 'emoji_tag', 'infoData', 'extended'];
  for (const field of requiredFields) {
    if (data[field] === undefined) {
      throw new Error(`Missing required field: "${field}" in JSON data`);
    }
  }

  console.log(`Generating infographic for claim: "${data.infoData.claim}"`);
  const { svg: infoSvg, parts: infoParts } = buildInfographic(data.infoData);

  // Determine base file prefix for output files based on input file name
  const inputFileName = path.basename(jsonPath, '.json');
  const slug = inputFileName.replace(/^articulo_/, '').replace(/_data$/, '');

  // 1. Build and save output Article JSON
  const outputArticle = {
    title: data.title,
    subtitle: data.subtitle,
    summary: data.summary,
    explanation: data.explanation,
    trick_used: data.trick_used,
    matiza_score: data.matiza_score,
    emoji_tag: data.emoji_tag,
    infographic_svg: infoSvg,
    infographic_parts: infoParts
  };
  const articleOutputPath = `articulo_${slug}.json`;
  fs.writeFileSync(articleOutputPath, JSON.stringify(outputArticle, null, 2));
  console.log(`Saved article output to: ${articleOutputPath}`);

  // 2. Build and save Extended Verification JSON
  const outputExtended = {
    meta: {
      claim: data.infoData.claim,
      generated_at: new Date().toISOString(),
      sources_used: data.infoData.sources.map(s => s.split(':')[0].trim())
    },
    fact_check: {
      verdict: data.extended.verdict,
      confidence: data.extended.confidence || "Media",
      verdict_reasoning: data.extended.verdict_reasoning || "",
      what_is_true: data.extended.what_is_true,
      what_is_false: data.extended.what_is_false,
      what_lacks_context: data.extended.what_lacks_context,
      what_is_not_proven: data.extended.what_is_not_proven
    }
  };
  const extendedOutputPath = `verificacion_${slug}_extended.json`;
  fs.writeFileSync(extendedOutputPath, JSON.stringify(outputExtended, null, 2));
  console.log(`Saved extended verification output to: ${extendedOutputPath}`);

  // 3. Update SQLite Database
  console.log(`Updating database at: ${dbPath} for article ID: "${data.id}"...`);
  if (!fs.existsSync(dbPath)) {
    const parentDir = path.dirname(dbPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);
  const stmt = db.prepare(`
    UPDATE articles
    SET title = ?,
        subtitle = ?,
        summary = ?,
        explanation = ?,
        verdict = ?,
        trick_used = ?,
        matiza_score = ?,
        emoji_tag = ?,
        infographic_svg = ?,
        infographic_parts = ?,
        status = ?,
        human_review_required = ?,
        published_at = ?
    WHERE id = ?
  `);

  const result = stmt.run(
    data.title,
    data.subtitle,
    data.summary,
    data.explanation,
    data.extended.verdict.toLowerCase(),
    data.trick_used,
    data.matiza_score,
    data.emoji_tag,
    infoSvg,
    JSON.stringify(infoParts),
    data.status || 'borrador',
    data.human_review_required !== undefined ? data.human_review_required : 1,
    data.published_at || null,
    data.id
  );

  console.log(`Successfully updated database row. Changes: ${result.changes}`);
  db.close();

} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
