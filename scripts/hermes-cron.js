import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║ 📡 NEWNEWS: ORQUESTADOR GENERAL CRON DE HERMES 📡    ║');
console.log('║  (Búsqueda, Análisis, Redacción y Reconstrucción)     ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log(`[Hermes Cron] Iniciando ciclo de automatización de desmentidos en ${new Date().toISOString()}`);

function runStep(command, name) {
  try {
    console.log(`\n======================================================`);
    console.log(`🚀 [PASO] Ejecutando: ${name}...`);
    console.log(`$ ${command}`);
    console.log(`======================================================`);
    
    execSync(command, { stdio: 'inherit', env: process.env });
    
    console.log(`\n✅ [PASO] Completado: ${name}`);
  } catch (err) {
    console.error(`\n❌ [ERROR] Falló el paso: ${name}`);
    console.error(err.message);
  }
}

// 1. Ejecutar el radar de scrapers para capturar claims virales
runStep('node scripts/radar-cron.js', 'Radar Scrapers (Búsqueda)');

// 2. Procesar el pipeline de Inteligencia Artificial para analizar y redactar
runStep('node scripts/ai-pipeline.js', 'Pipeline IA (Análisis y Redacción)');

// 3. Sincronizar e indexar la base de datos
runStep('node scripts/sync.js', 'Sincronizador de Datos');

// 4. Reconstruir estáticamente el portal para publicar cambios
runStep('npm run build', 'Compilación Astro (Deploy/Build)');

console.log('\n======================================================');
console.log(`🎉 [Hermes Cron] Ciclo completo de automatización finalizado con éxito.`);
console.log('======================================================');
