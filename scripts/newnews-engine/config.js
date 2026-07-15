import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

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
  
  // Determinar modelo, proveedor y temperatura según la fase o los parámetros globales
  let provider = 'gemini';
  let model = 'gemini-2.5-flash';
  let temperature = 0.2;
  let timeoutMs = 180000;
  
  if (config) {
    if (config.global) {
      provider = config.global.default_provider || provider;
      timeoutMs = config.global.timeout_ms || timeoutMs;
    }
    if (phaseId && config.phases && config.phases[phaseId]) {
      const phaseConf = config.phases[phaseId];
      provider = phaseConf.provider || provider;
      model = phaseConf.model || model;
      temperature = phaseConf.temperature !== undefined ? phaseConf.temperature : temperature;
    }
  }

  try {
    console.log(`[Hermes Delegation] Inferencia Fase [${phaseId || 'Global'}] -> Proveedor: ${provider.toUpperCase()}, Modelo: ${model}, Temp: ${temperature}`);
    
    // Serializar el prompt de forma ultra-segura para pasarlo como argumento de línea de comandos en bash/powershell
    const promptEscaped = JSON.stringify(promptText);
    
    // Construir el comando nativo de Hermes Agent con su modelo y proveedor dinámicos
    let commandStr = `hermes -z ${promptEscaped} -m "${model}" --provider ${provider}`;
    
    const stdout = execSync(commandStr, { 
      encoding: 'utf8', 
      timeout: timeoutMs
    });
    
    const rawText = stdout.trim();
    const extracted = extractJson(rawText);
    if (extracted) {
      return JSON.parse(extracted);
    }
    
    // Fallback de parseo clásico si el extractor balanceado falla
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No se pudo encontrar un JSON estructurado válido en la salida.');
  } catch (err) {
    console.error('[Hermes Delegation] Error crítico en inferencia nativa de Hermes:', err.message);
    
    // Intento de fallback de seguridad llamando al modelo de respaldo configurado en el JSON
    let fallbackProvider = config?.global?.fallback_provider || 'nous';
    let fallbackModel = config?.global?.fallback_model || 'stepfun/step-3.7-flash:free';
    
    try {
      console.log(`[Hermes Delegation] Fallback de seguridad -> Proveedor: ${fallbackProvider.toUpperCase()}, Modelo: ${fallbackModel}`);
      const promptEscaped = JSON.stringify(promptText);
      const stdout = execSync(`hermes -z ${promptEscaped} -m "${fallbackModel}" --provider ${fallbackProvider}`, { 
        encoding: 'utf8', 
        timeout: 120000 
      });
      const rawText = stdout.trim();
      const extracted = extractJson(rawText);
      if (extracted) {
        return JSON.parse(extracted);
      }
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No se pudo encontrar un JSON estructurado válido en el fallback.');
    } catch (retryErr) {
      console.error('[Hermes Delegation] Falló también el reintento de fallback:', retryErr.message);
    }
    
    throw err;
  }
}
