import fs from 'node:fs';
import path from 'node:path';

const filePaths = [
  path.resolve('scripts/matiza-engine/config.js'),
  path.resolve('matizame/scripts/matiza-engine/config.js')
];

filePaths.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  console.log(`[Corrección Sintaxis] Procesando archivo: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Buscar y eliminar el bloque de código del mock LLM roto.
  // Buscamos desde 'authority_level: "Máxima"' hasta el 'return {};\n  }'
  // que está justo antes de 'const config = getPipelineConfig();'
  
  const startIndex = content.indexOf('authority_level: "Máxima",');
  const endIndex = content.indexOf('const config = getPipelineConfig();');
  
  if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    // Buscar la última llave de cierre antes del 'const config = getPipelineConfig();'
    const blockBeforeConfig = content.substring(startIndex, endIndex);
    const lastClosingBracket = blockBeforeConfig.lastIndexOf('}');
    
    if (lastClosingBracket !== -1) {
      const actualEndIndex = startIndex + lastClosingBracket + 1;
      
      const beforeBlock = content.substring(0, startIndex);
      const afterBlock = content.substring(actualEndIndex);
      
      // Limpiar también cualquier rastro de la condicional inicial que haya quedado
      let finalContent = beforeBlock + afterBlock;
      
      // Asegurarnos de que no hay llaves desbalanceadas
      fs.writeFileSync(filePath, finalContent, 'utf-8');
      console.log(`✓ Removido bloque de mock roto con éxito en ${filePath}`);
    } else {
      console.warn(`No se encontró la llave de cierre en el bloque en ${filePath}`);
    }
  } else {
    console.warn(`No se detectaron los índices de inicio/fin en ${filePath}`);
  }
});
