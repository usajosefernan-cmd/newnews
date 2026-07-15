import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║ ⚡ NEWNEWS: INICIANDO PIPELINE DE SINCRONIZACIÓN ⚡  ║');
console.log('╚══════════════════════════════════════════════════════╝');

function runCommand(command, description) {
  console.log(`\n🔹 [PROCESO] ${description}...`);
  console.log(`$ ${command}`);
  try {
    execSync(command, { stdio: 'inherit', env: process.env });
    console.log(`✅ [EXITO] ${description} completado.`);
    return true;
  } catch (error) {
    console.error(`❌ [ERROR] ${description} falló.`);
    console.error(error.message);
    return false;
  }
}

// 1. Ejecutar Radar Cron para capturar tendencias y debates
const radarSuccess = runCommand('node scripts/radar-last30days.js', 'Ejecutando Radar Cron (Escaneo de redes con last30days)');

if (!radarSuccess) {
  console.error('⚠️ Deteniendo pipeline debido a un fallo en el Radar.');
  process.exit(1);
}

// 2. Ejecutar Pipeline de IA para procesar claims y generar borradores o artículos
const aiSuccess = runCommand('node scripts/ai-pipeline.js', 'Ejecutando Pipeline de IA (Procesado de claims con Gemini)');

if (!aiSuccess) {
  console.error('⚠️ Deteniendo pipeline debido a un fallo en el Pipeline de IA.');
  process.exit(1);
}

// 3. Ejecutar Build de Astro usando swap atómico para evitar caídas de servidor
console.log(`\n🔹 [PROCESO] Reconstruyendo Portal Estático (Astro Build Atómico)...`);
let buildSuccess = false;
try {
  execSync('npx astro build --outDir dist_temp', { stdio: 'inherit', env: process.env });
  
  const distPath = path.resolve('dist');
  const tempPath = path.resolve('dist_temp');
  const backupPath = path.resolve('dist_backup');
  
  if (fs.existsSync(backupPath)) {
    fs.rmSync(backupPath, { recursive: true, force: true });
  }
  
  if (fs.existsSync(distPath)) {
    fs.renameSync(distPath, backupPath);
  }
  
  // Si Astro compiló a un subdirectorio dist_temp/dist, usamos ese subdirectorio para el swap
  const finalTempPath = fs.existsSync(path.join(tempPath, 'dist')) ? path.join(tempPath, 'dist') : tempPath;
  fs.renameSync(finalTempPath, distPath);
  
  // Limpiar cualquier residuo de dist_temp
  if (fs.existsSync(tempPath)) {
    fs.rmSync(tempPath, { recursive: true, force: true });
  }
  
  if (fs.existsSync(backupPath)) {
    fs.rmSync(backupPath, { recursive: true, force: true });
  }
  
  console.log(`\n✅ [EXITO] Reconstruyendo Portal Estático (Astro Build Atómico) completado.`);
  buildSuccess = true;
} catch (error) {
  console.error(`❌ [ERROR] Reconstruyendo Portal Estático (Astro Build Atómico) falló.`);
  console.error(error.message);
}

if (!buildSuccess) {
  console.error('⚠️ El build de Astro ha fallado. Revisa los errores del compilador.');
  process.exit(1);
}

console.log('\n========================================================');
console.log('🎉 ¡Sincronización y Reconstrucción Completada con Éxito!');
console.log('========================================================');
process.exit(0);
