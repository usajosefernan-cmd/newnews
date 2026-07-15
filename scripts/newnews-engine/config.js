import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/newnews.db');

export function loadEnv() {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    lines.forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value.trim();
      }
    });
  }
}

loadEnv();

export function getDb() {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA journal_mode = WAL;');
  return db;
}

export async function callGemini(promptText) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const orKey = process.env.OPENROUTER_API_KEY;

  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (response.ok) {
        const json = await response.json();
        let rawText = json.candidates[0].content.parts[0].text.trim();
        if (rawText.startsWith('```')) {
          rawText = rawText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        }
        return JSON.parse(rawText);
      } else {
        const errorText = await response.text();
        console.warn(`[Gemini API] Error ${response.status}: ${errorText.substring(0, 150)}... Intentando fallback.`);
      }
    } catch (e) {
      console.warn(`[Gemini API] Excepción al conectar: ${e.message}. Intentando fallback.`);
    }
  }

  if (orKey) {
    try {
      const orUrl = 'https://openrouter.ai/api/v1/chat/completions';
      const response = await fetch(orUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${orKey}`
        },
        body: JSON.stringify({
          model: 'openrouter/free',
          messages: [{ role: 'user', content: promptText }]
        })
      });

      if (response.ok) {
        const json = await response.json();
        let rawText = json.choices[0].message.content.trim();
        if (rawText.startsWith('```')) {
          rawText = rawText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        }
        return JSON.parse(rawText);
      } else {
        const errorText = await response.text();
        console.warn(`[OpenRouter API] Error ${response.status}: ${errorText.substring(0, 150)}...`);
      }
    } catch (err) {
      console.warn(`[OpenRouter API] Fallo: ${err.message}`);
    }
  }

  throw new Error('No hay claves API válidas o disponibles (Gemini o OpenRouter).');
}
