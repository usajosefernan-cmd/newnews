import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

// Cargar variables de entorno del archivo .env de forma manual y robusta si existe
try {
  const currentDir = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
  const envPath = path.join(currentDir, '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    for (const line of envConfig.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        // Quitar comillas si las tiene
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) {
          process.env[key] = val.trim();
        }
      }
    }
  }
} catch (e) {
  console.error('[Config] Error cargando .env local:', e.message);
}

// Redirigir consola a un archivo de log unificado para el panel de administración
const logFile = path.resolve('data/logs/pipeline.log');
try {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
} catch (e) {}

const originalLog = console.log;
const originalError = console.error;

function appendToLogFile(type, args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  const logLine = `[${timestamp}] [${type}] ${message}\n`;
  try {
    fs.appendFileSync(logFile, logLine, 'utf8');
  } catch (e) {}
}

console.log = function(...args) {
  originalLog.apply(console, args);
  appendToLogFile('INFO', args);
};

console.error = function(...args) {
  originalError.apply(console, args);
  appendToLogFile('ERROR', args);
};

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

// Cargar la configuración dinámica del pipeline editable por el usuario en el admin
export function getPipelineConfig() {
  const configPath = path.resolve('pipeline_config.json');
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      console.error('[Config] Error parseando pipeline_config.json, usando valores por defecto:', e.message);
    }
  }
  return null;
}

export function extractJson(text) {
  if (!text) return null;
  const startIdx = text.indexOf('{');
  if (startIdx === -1) return null;
  
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          return text.substring(startIdx, i + 1);
        }
      }
    }
  }
  return null;
}

export async function callGemini(promptText, phaseId = null) {
  const config = getPipelineConfig();
  
  let model = 'google/gemini-2.5-flash';
  let temperature = 0.2;
  
  if (config) {
    if (phaseId && config.phases && config.phases[phaseId]) {
      const phaseConf = config.phases[phaseId];
      const m = phaseConf.model || 'gemini-2.5-flash';
      model = m.includes('/') ? m : `google/${m}`;
      temperature = phaseConf.temperature !== undefined ? phaseConf.temperature : temperature;
    }
  }

  // 1. Intentar usar OpenRouter (Proveedor preferido para evitar límites)
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    const modelsToTry = [model];
    if (!model.endsWith(':free')) {
      modelsToTry.push('openrouter/free');
    }
    
    for (const mToTry of modelsToTry) {
      console.log(`[OpenRouter API] Inferencia Fase [${phaseId || 'Global'}] -> Modelo: ${mToTry}, Temp: ${temperature}`);
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openRouterKey}`,
            'HTTP-Referer': 'https://newnews.es',
            'X-Title': 'NewNews Engine'
          },
          body: JSON.stringify({
            model: mToTry,
            messages: [{ role: 'user', content: promptText }],
            temperature: temperature,
            response_format: { type: 'json_object' }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const rawText = data?.choices?.[0]?.message?.content || '';
          const cleanText = rawText.trim();
          const extracted = extractJson(cleanText);
          if (extracted) return JSON.parse(extracted);
          const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
          if (jsonMatch) return JSON.parse(jsonMatch[0]);
        } else {
          const errText = await response.text();
          console.warn(`[OpenRouter API] ⚠️ HTTP ${response.status} al llamar a ${mToTry}. Error: ${errText.substring(0, 150)}`);
          if (response.status === 402 && mToTry !== modelsToTry[modelsToTry.length - 1]) {
            console.log(`[OpenRouter API] Intentando con el modelo gratuito de OpenRouter de respaldo...`);
            continue;
          }
        }
      } catch (err) {
        console.warn(`[OpenRouter API] ⚠️ Error al conectar: ${err.message}`);
      }
    }
  }

  // 2. Fallback de Groq (Ultra-rápido y con grandes límites)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const groqModel = 'llama-3.3-70b-specdec';
    console.log(`[Groq API Fallback] Inferencia Fase [${phaseId || 'Global'}] -> Modelo: ${groqModel}, Temp: ${temperature}`);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [{ role: 'user', content: promptText }],
          temperature: temperature,
          response_format: { type: 'json_object' }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.choices?.[0]?.message?.content || '';
        const cleanText = rawText.trim();
        const extracted = extractJson(cleanText);
        if (extracted) return JSON.parse(extracted);
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
      } else {
        const errText = await response.text();
        console.warn(`[Groq API Fallback] ⚠️ HTTP ${response.status}. Error: ${errText.substring(0, 150)}`);
      }
    } catch (err) {
      console.warn(`[Groq API Fallback] ⚠️ Error en Groq: ${err.message}`);
    }
  }

  // 3. Fallback de API de Gemini directa de Google
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    const cleanModel = model.includes('/') ? model.split('/').pop() : model;
    console.log(`[Gemini API Fallback] Inferencia Fase [${phaseId || 'Global'}] -> Modelo: ${cleanModel}, Temp: ${temperature}`);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: temperature, responseMimeType: 'application/json' }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanText = rawText.trim();
        const extracted = extractJson(cleanText);
        if (extracted) return JSON.parse(extracted);
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
      } else {
        const errBody = await response.text();
        throw new Error(`Gemini Fallback HTTP ${response.status} - ${errBody}`);
      }
    } catch (err) {
      console.error(`[Gemini API Fallback] ❌ Error en Gemini Directo: ${err.message}`);
      throw err;
    }
  }

  throw new Error('Todos los proveedores de inferencia (OpenRouter, Groq, Gemini) han fallado o no tienen API Key.');
}
