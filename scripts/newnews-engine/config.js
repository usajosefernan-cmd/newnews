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
  const tStartCall = Date.now();
  const config = getPipelineConfig();
  
  let provider = 'freellmapi';
  let model = 'auto';
  let temperature = 0.2;
  
  if (config) {
    if (phaseId && config.phases && config.phases[phaseId]) {
      const phaseConf = config.phases[phaseId];
      provider = phaseConf.provider || config.global.default_provider || 'freellmapi';
      model = phaseConf.model || 'auto';
      temperature = phaseConf.temperature !== undefined ? phaseConf.temperature : temperature;
    } else {
      provider = config.global.default_provider || 'freellmapi';
      model = 'auto';
    }
  }

  // Traducción de alias a modelos físicos para los proveedores de fallback
  const FALLBACK_MODELS = {
    gemini: {
      'auto:fast': 'gemini-1.5-flash',
      'auto:balanced': 'gemini-2.5-flash',
      'auto:smart': 'gemini-2.5-flash',
      'auto:reliable': 'gemini-2.5-flash',
      'auto': 'gemini-2.5-flash'
    },
    openrouter: {
      'auto:fast': 'google/gemini-1.5-flash',
      'auto:balanced': 'google/gemini-2.5-flash',
      'auto:smart': 'google/gemini-2.5-flash',
      'auto:reliable': 'google/gemini-2.5-flash',
      'auto': 'google/gemini-2.5-flash'
    },
    groq: {
      'auto:fast': 'llama-3.1-8b-instant',
      'auto:balanced': 'llama-3.3-70b-specdec',
      'auto:smart': 'llama-3.3-70b-specdec',
      'auto:reliable': 'llama-3.3-70b-specdec',
      'auto': 'llama-3.3-70b-specdec'
    }
  };

  const getFallbackModel = (prov, alias) => {
    if (alias.startsWith('auto') && FALLBACK_MODELS[prov] && FALLBACK_MODELS[prov][alias]) {
      return FALLBACK_MODELS[prov][alias];
    }
    // Si ya era un modelo específico (ej. gemini-2.5-flash), limpiarlo de prefijos de proveedor
    return alias.includes('/') ? alias.split('/').pop() : alias;
  };

  // 0. Intentar usar FreeLLMAPI local si el proveedor es freellmapi
  const freeLlmApiKey = process.env.FREELLMAPI_API_KEY;
  const freeLlmBaseUrl = process.env.FREELLMAPI_BASE_URL || 'http://localhost:3001/v1';
  if (provider === 'freellmapi' && freeLlmApiKey) {
    console.log(`[FreeLLMAPI] ⚡ [Fase ${phaseId || 'Global'}] Despachando inferencia (Modelo: ${model} | Temp: ${temperature})`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout
    try {
      let response = await fetch(`${freeLlmBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${freeLlmApiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: promptText }],
          temperature: temperature,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      if (!response.ok && (response.status === 429 || response.status === 404)) {
        const errText = await response.text();
        console.warn(`[FreeLLMAPI] ⚠️ Error ${response.status} llamando a ${model}. Reintentando con enrutamiento 'auto'...`);
        response = await fetch(`${freeLlmBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${freeLlmApiKey}`
          },
          body: JSON.stringify({
            model: 'auto',
            messages: [{ role: 'user', content: promptText }],
            temperature: temperature,
            response_format: { type: 'json_object' }
          }),
          signal: controller.signal
        });
      }
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const resolvedModelName = data?._routed_via ? `${data._routed_via.platform}/${data._routed_via.model}` : model;
        console.log(`[FreeLLMAPI] ✨ [Fase ${phaseId || 'Global'}] Completado con éxito ➔ Enrutado vía: ${resolvedModelName}`);
        
        global.lastInferenceTelemetry = {
          provider: 'freellmapi',
          model: resolvedModelName,
          durationMs: Date.now() - tStartCall
        };

        const rawText = data?.choices?.[0]?.message?.content || '';
        const cleanText = rawText.trim();
        const extracted = extractJson(cleanText);
        if (extracted) return JSON.parse(extracted);
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
      } else {
        const errBody = await response.text();
        console.warn(`[FreeLLMAPI] ⚠️ HTTP ${response.status} - ${errBody.substring(0, 150)}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(`[FreeLLMAPI] ❌ Error o Timeout en FreeLLMAPI: ${err.message}`);
    }
  }

  // 1. Intentar usar la API de Gemini directa de Google (Fallback 1)
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    const physicalModel = getFallbackModel('gemini', model);
    console.log(`[Gemini API] ⚠️ [Fase ${phaseId || 'Global'}] Fallback a Gemini Directo (Modelo: ${physicalModel})`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${physicalModel}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: temperature, responseMimeType: 'application/json' }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        global.lastInferenceTelemetry = {
          provider: 'gemini',
          model: physicalModel,
          durationMs: Date.now() - tStartCall
        };

        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanText = rawText.trim();
        const extracted = extractJson(cleanText);
        if (extracted) return JSON.parse(extracted);
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
      } else {
        const errBody = await response.text();
        console.warn(`[Gemini API] ⚠️ HTTP ${response.status} - ${errBody.substring(0, 150)}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(`[Gemini API] ❌ Error en Gemini Directo: ${err.message}`);
    }
  }

  // 2. Fallback de OpenRouter
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    const physicalOpenRouterModel = getFallbackModel('openrouter', model);
    const modelsToTry = [physicalOpenRouterModel];
    if (!physicalOpenRouterModel.endsWith(':free')) {
      modelsToTry.push('meta-llama/llama-3-8b-instruct:free');
    }
    
    for (const mToTry of modelsToTry) {
      console.log(`[OpenRouter API] ⚠️ [Fase ${phaseId || 'Global'}] Fallback a OpenRouter (Modelo: ${mToTry})`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
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
          }),
          signal: controller.signal
        });
        await new Promise(r => setTimeout(r, 100)); // gap para evitar rate-limits de ráfaga
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          
          global.lastInferenceTelemetry = {
            provider: 'openrouter',
            model: mToTry,
            durationMs: Date.now() - tStartCall
          };

          const rawText = data?.choices?.[0]?.message?.content || '';
          const cleanText = rawText.trim();
          const extracted = extractJson(cleanText);
          if (extracted) return JSON.parse(extracted);
          const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
          if (jsonMatch) return JSON.parse(jsonMatch[0]);
        } else {
          const errText = await response.text();
          console.warn(`[OpenRouter API Fallback] ⚠️ HTTP ${response.status} al llamar a ${mToTry}. Error: ${errText.substring(0, 150)}`);
          if (response.status === 402 && mToTry !== modelsToTry[modelsToTry.length - 1]) {
            console.log(`[OpenRouter API Fallback] Intentando con el modelo gratuito de OpenRouter de respaldo...`);
            continue;
          }
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn(`[OpenRouter API Fallback] ⚠️ Error al conectar: ${err.message}`);
      }
    }
  }

  // 3. Fallback de Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const groqModel = getFallbackModel('groq', model);
    console.log(`[Groq API] ⚠️ [Fase ${phaseId || 'Global'}] Fallback a Groq (Modelo: ${groqModel})`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
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
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        global.lastInferenceTelemetry = {
          provider: 'groq',
          model: groqModel,
          durationMs: Date.now() - tStartCall
        };

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
      clearTimeout(timeoutId);
      console.warn(`[Groq API Fallback] ⚠️ Error en Groq: ${err.message}`);
    }
  }

  global.lastInferenceTelemetry = null;
  throw new Error('Todos los proveedores de inferencia (Gemini, OpenRouter, Groq) han fallado o no tienen API Key.');
}
