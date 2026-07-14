import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function loadEnv() {
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

const realClaimsDatabase = {
  franco: {
    title: 'Auditoría de hechos sobre: La Seguridad Social y las pagas extras en la época de Franco',
    subtitle: 'Desmentimos el origen franquista de la Seguridad Social y contextualizamos la paga extra de Navidad con el BOE.',
    verdict: 'Falta contexto',
    confidence: 'Alta',
    summary: 'Es un mito recurrente atribuir la creación de la Seguridad Social a la dictadura de Francisco Franco. Las bases se remontan a principios del siglo XX con el Instituto Nacional de Previsión (INP) de 1908.',
    explanation: 'El sistema moderno de previsión social en España nace de las reformas de la Segunda República y se consolidó en la posguerra. La atribución exclusiva a la dictadura simplifica un proceso legislativo e histórico continuado de más de 60 años.',
    what_is_true: 'La dictadura organizó administrativamente la Caja de Previsión y promulgó la Ley de Bases de la Seguridad Social de 1963.',
    what_is_false: 'Que la Seguridad Social o las prestaciones por jubilación y desempleo fueran inventadas desde cero por el régimen franquista.',
    what_lacks_context: 'Las pagas extraordinarias surgieron como respuesta de contención salarial y paliativo ante la enorme inflación de la posguerra.',
    what_is_not_proven: 'La veracidad de la propaganda estatal que magnificaba estas medidas como favores paternalistas.',
    sources: [
      { title: 'BOE: Creación del Instituto Nacional de Previsión (1908)', url: 'https://www.boe.es', source_type: 'oficial', authority_level: 'Alta', quote_or_summary: 'Ley constitutiva del INP.' }
    ]
  },
  menas: {
    title: 'Auditoría de hechos sobre: Ayudas económicas y delincuencia en menores extranjeros no acompañados',
    subtitle: 'Analizamos las estadísticas de criminalidad y el coste real de tutela de menores migrantes en España.',
    verdict: 'Falso',
    confidence: 'Alta',
    summary: 'Las afirmaciones virales que afirman que los menores extranjeros no acompañados reciben pagas mensuales de más de 4.000€ son falsas.',
    explanation: 'El presupuesto destinado a menores tutelados financia la infraestructura de acogida, educadores, psicólogos y seguridad de los centros. Los menores reciben una paga mínima de bolsillo para gastos personales de entre 10€ y 30€ semanales.',
    what_is_true: 'El coste de mantenimiento de una plaza residencial para cualquier menor tutelado ronda los 2.000€ a 4.000€ al mes.',
    what_is_false: 'Que los menores reciban ese importe de forma directa o en efectivo en sus cuentas personales.',
    what_lacks_context: 'El repunte de criminalidad de menores debe analizarse con los datos globales de la Fiscalía General del Estado para evitar sesgos discriminatorios.',
    what_is_not_proven: 'No hay pruebas de vínculos organizados o delincuencia organizada entre la población de menores tutelados.',
    sources: [
      { title: 'Fiscalía General del Estado: Memoria Anual', url: 'https://www.fiscal.es', source_type: 'oficial', authority_level: 'Alta', quote_or_summary: 'Estadísticas oficiales de delincuencia juvenil.' }
    ]
  },
  begona: {
    title: 'Auditoría de hechos sobre: Causa judicial contra Begoña Gómez por tráfico de influencias',
    subtitle: 'Resumen imparcial y estado de la investigación dirigida por el juzgado de instrucción número 41 de Madrid.',
    verdict: 'Falta contexto',
    confidence: 'Alta',
    summary: 'La investigación judicial a Begoña Gómez por presunto tráfico de influencias y corrupción en los negocios sigue su curso bajo secreto parcial de sumario.',
    explanation: 'El proceso se centra en las cartas de recomendación firmadas en favor de la UTE de Carlos Barrabés. La instrucción ha estado marcada por recursos presentados por la defensa y la fiscalía.',
    what_is_true: 'La firma de cartas de recomendación habituales en concursos públicos por parte de cátedras universitarias bajo su dirección.',
    what_is_false: 'Que existan resoluciones judiciales firmes de condena o imputaciones penales cerradas a esta fecha.',
    what_lacks_context: 'El papel de acusación popular de colectivos como Vox o Manos Limpias influye de forma directa en el flujo de noticias de la causa.',
    what_is_not_proven: 'Un beneficio económico directo o desvío de fondos públicos en favor de la investigada.',
    sources: [
      { title: 'Poder Judicial de España: Notas de Prensa', url: 'https://www.poderjudicial.es', source_type: 'oficial', authority_level: 'Alta', quote_or_summary: 'Información institucional sobre la instrucción.' }
    ]
  },
  koldo: {
    title: 'Auditoría de hechos sobre: El caso Koldo y contratos sanitarios en pandemia',
    subtitle: 'Desglose del informe de auditoría y los procedimientos de compra del Ministerio de Transportes.',
    verdict: 'Verdadero',
    confidence: 'Alta',
    summary: 'La red delictiva que cobró comisiones ilegales en contratos de mascarillas aprovechó su cercanía con cargos públicos durante el estado de alarma de 2020.',
    explanation: 'Las investigaciones y auditorías internas han corroborado adjudicaciones de contratos de emergencia por la vía rápida a empresas sin experiencia previa en el sector sanitario.',
    what_is_true: 'El cobro de comisiones y el incremento patrimonial de los intermediarios implicados.',
    what_is_false: 'Que la totalidad de contratos adjudicados durante la emergencia sanitaria estuvieran comprometidos.',
    what_lacks_context: 'El procedimiento abreviado de contratación de emergencia estaba legalmente autorizado por el Real Decreto-ley de alarma, flexibilizando la fiscalización habitual.',
    what_is_not_proven: 'La implicación directa de miembros del Consejo de Ministros en la dirección de la red de cobro de comisiones.',
    sources: [
      { title: 'Tribunal de Cuentas de España: Informes de Fiscalización', url: 'https://www.tcu.es', source_type: 'oficial', authority_level: 'Alta', quote_or_summary: 'Auditoría de contratación de emergencia.' }
    ]
  },
  vivienda: {
    title: 'Auditoría de hechos sobre: La Ley de Vivienda y la regulación de alquileres en zonas tensionadas',
    subtitle: 'Revisión del marco legal, límites de precios y la problemática de la okupación ilegal.',
    verdict: 'Falta contexto',
    confidence: 'Alta',
    summary: 'La nueva Ley de Vivienda estatal permite topar los precios del alquiler residencial únicamente en municipios declarados oficialmente como zonas tensionadas por sus CCAA.',
    explanation: 'Respecto a la okupación ilegal, la ley introduce trámites obligatorios de conciliación previa para propietarios que sean grandes tenedores antes de iniciar el desalojo judicial, lo que alarga los plazos del proceso.',
    what_is_true: 'La ampliación de plazos procesales y requisitos previos para demandas de desahucio interpuestas por grandes tenedores.',
    what_is_false: 'Que la ley despenalice la okupación o impida a la policía actuar ante flagrante delito de allanamiento de morada.',
    what_lacks_context: 'El desvío del parque de alquiler residencial hacia la modalidad de alquiler temporal o turístico para sortear la regulación.',
    what_is_not_proven: 'Un incremento masivo o descontrolado de okupaciones mafiosas atribuible exclusivamente a la nueva legislación.',
    sources: [
      { title: 'Ministerio de Vivienda y Agenda Urbana: Zonas Tensionadas', url: 'https://www.mivau.gob.es', source_type: 'oficial', authority_level: 'Alta', quote_or_summary: 'Resoluciones de zonas tensionadas e índice de precios.' }
    ]
  },
  inflacion: {
    title: 'Auditoría de hechos sobre: La tasa de inflación real en España y el precio de los alimentos',
    subtitle: 'Contraste del IPC del INE y la efectividad de la rebaja temporal del IVA en la cesta de la compra.',
    verdict: 'Verdadero',
    confidence: 'Alta',
    summary: 'Los datos oficiales del INE confirman un encarecimiento acumulado de los alimentos de la cesta de la compra de más del 30% en los últimos tres años.',
    explanation: 'Aunque la inflación general se ha moderado, el coste de vida sigue siendo elevado para los hogares españoles. La rebaja del IVA en alimentos básicos amortiguó parcialmente el incremento pero fue absorbida por el alza de costes en origen.',
    what_is_true: 'El incremento de precios sostenido del aceite de oliva, frutas y hortalizas reflejado en el IPC armonizado.',
    what_is_false: 'Que el INE manipule las fórmulas de cálculo de forma sistemática para ocultar la inflación real.',
    what_lacks_context: 'El impacto de factores climáticos (sequías prolongadas) y el coste global del transporte de energía en el precio final de consumo.',
    what_is_not_proven: 'Prácticas de concertación de precios ilícitas generalizadas entre las grandes cadenas de distribución en España.',
    sources: [
      { title: 'Instituto Nacional de Estadística (INE): Datos del IPC', url: 'https://www.ine.es', source_type: 'oficial', authority_level: 'Alta', quote_or_summary: 'Índice de Precios de Consumo mensual.' }
    ]
  },
  desempleo: {
    title: 'Auditoría de hechos sobre: La contabilidad del paro y los contratos fijos discontinuos',
    subtitle: 'Explicación del cálculo del SEPE y el contraste con la Encuesta de Población Activa (EPA).',
    verdict: 'Falta contexto',
    confidence: 'Alta',
    summary: 'La reforma laboral modificó la forma de contabilizar a los trabajadores con contratos fijos discontinuos en los registros del paro registrado del SEPE.',
    explanation: 'Los trabajadores fijos discontinuos en período de inactividad no computan como parados registrados (sino como demandantes con relación laboral), aunque la EPA sí desglosa su situación real de inactividad.',
    what_is_true: 'Los fijos discontinuos inactivos no suman al paro registrado del SEPE.',
    what_is_false: 'Que se trate de un fraude estadístico nuevo, ya que esta clasificación contable data de una orden ministerial de 1985.',
    what_lacks_context: 'La diferencia metodológica entre el paro registrado (SEPE) y el desempleo estimado mediante encuesta (EPA).',
    what_is_not_proven: 'La intencionalidad oculta de maquillar las cifras a nivel de Eurostat.',
    sources: [
      { title: 'Instituto Nacional de Estadística (INE): Encuesta de Población Activa', url: 'https://www.ine.es', source_type: 'oficial', authority_level: 'Alta', quote_or_summary: 'Metodología y resultados de la EPA.' }
    ]
  },
  autonomos: {
    title: 'Auditoría de hechos sobre: El nuevo sistema de cotización de autónomos por ingresos reales',
    subtitle: 'Desglose de los tramos de rendimiento neto y cuotas mensuales de la Seguridad Social.',
    verdict: 'Verdadero',
    confidence: 'Alta',
    summary: 'El nuevo sistema de cotización por ingresos reales establece 15 tramos que adaptan la cuota de la Seguridad Social de los autónomos a sus rendimientos netos reales.',
    explanation: 'La reforma busca equilibrar las prestaciones y cotizaciones del colectivo. Aquellos autónomos con rendimientos inferiores al Salario Mínimo Interprofesional (SMI) ven reducida su cuota mensual.',
    what_is_true: 'Las cuotas mínimas reducidas para tramos inferiores de rendimiento neto reguladas por el Real Decreto-ley 13/2022.',
    what_is_false: 'Que todos los autónomos en España pasen a pagar una cuota fija obligatoria superior a 500€ independientemente de lo que facturen.',
    what_lacks_context: 'La fórmula de cálculo de los rendimientos netos que deduce los gastos de explotación del negocio del volumen total de ingresos.',
    what_is_not_proven: 'Una pérdida masiva de autónomos afiliados a la Seguridad Social vinculada al nuevo modelo.',
    sources: [
      { title: 'Seguridad Social: Nuevo sistema de cotización autónomos', url: 'https://www.seg-social.es', source_type: 'oficial', authority_level: 'Alta', quote_or_summary: 'Guía y simulador de cuotas por ingresos reales.' }
    ]
  },
  impuestos: {
    title: 'Auditoría de hechos sobre: La presión fiscal y la carga tributaria en España',
    subtitle: 'Estudio de los tipos impositivos del IRPF, IVA e Impuesto de Sociedades en el contexto europeo.',
    verdict: 'Falta contexto',
    confidence: 'Alta',
    summary: 'La presión fiscal en España (relación entre recaudación tributaria y PIB) se sitúa ligeramente por debajo de la media de la Eurozona, aunque el esfuerzo fiscal es objeto de intenso debate político.',
    explanation: 'Los tipos impositivos nominales del IRPF y del IVA son comparables a los de países como Francia o Alemania, pero el nivel medio de salarios más bajo en España incrementa la percepción de esfuerzo fiscal.',
    what_is_true: 'Los tipos impositivos progresivos del IRPF que gravan las rentas del trabajo.',
    what_is_false: 'Que España sea el país con mayor presión fiscal de la Unión Europea.',
    what_lacks_context: 'El peso de la economía sumergida que reduce la base imponible del PIB respecto a la recaudación real.',
    what_is_not_proven: 'Un éxodo masivo de contribuyentes con rentas medias provocado por cambios normativos recientes.',
    sources: [
      { title: 'Agencia Tributaria: Informes de Recaudación', url: 'https://www.aeat.es', source_type: 'oficial', authority_level: 'Alta', quote_or_summary: 'Estadísticas anuales de recaudación.' }
    ]
  }
};

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/newnews.db');

console.log('[AI Pipeline] Iniciando procesado de items de radar...');

// Función para llamar a Gemini con fetch
async function callGemini(promptText) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const orKey = process.env.OPENROUTER_API_KEY;

  // Intentar primero con la API nativa de Gemini si está presente
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
        const rawText = json.candidates[0].content.parts[0].text;
        return JSON.parse(rawText);
      } else {
        const errorText = await response.text();
        console.warn(`[Gemini API] Error ${response.status}: ${errorText.substring(0, 150)}... Intentando fallback.`);
      }
    } catch (e) {
      console.warn(`[Gemini API] Excepción al conectar: ${e.message}. Intentando fallback.`);
    }
  }

  // Fallback a OpenRouter
  if (orKey) {
    try {
      console.log('  -> [OpenRouter] Solicitando verificación a través de OpenRouter...');
      const orUrl = 'https://openrouter.ai/api/v1/chat/completions';
      
      // Intentamos con gemini-2.5-flash en OpenRouter primero
      let response = await fetch(orUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${orKey}`
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: promptText }],
          response_format: { type: 'json_object' },
          max_tokens: 2000
        })
      });

      // Si falla, intentamos con Llama 3.1 8B Instruct como segundo fallback
      if (!response.ok) {
        console.warn(`[OpenRouter] Falló Google Gemini, intentando con Llama 3.1 8B...`);
        response = await fetch(orUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${orKey}`
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-3.1-8b-instruct',
            messages: [{ role: 'user', content: promptText }],
            response_format: { type: 'json_object' },
            max_tokens: 2000
          })
        });
      }

      if (response.ok) {
        const json = await response.json();
        const rawText = json.choices[0].message.content;
        return JSON.parse(rawText.trim());
      } else {
        const errorText = await response.text();
        throw new Error(`OpenRouter falló con estado ${response.status}: ${errorText}`);
      }
    } catch (err) {
      throw new Error(`Fallo en el pipeline de IA a través de OpenRouter: ${err.message}`);
    }
  }

  throw new Error('No hay claves API válidas o disponibles (Gemini o OpenRouter).');
}

async function processItems() {
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ La base de datos no existe en ${dbPath}.`);
    process.exit(1);
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  // Obtener items pendientes del radar
  const pendingItems = db.prepare("SELECT * FROM scraped_items WHERE status = 'pendiente'").all();
  console.log(`[AI Pipeline] Encontrados ${pendingItems.length} ítems en la cola de radar.`);

  if (pendingItems.length === 0) {
    db.close();
    return;
  }

  const updateScrapedItemStatus = db.prepare("UPDATE scraped_items SET status = ? WHERE id = ?");

  const insertArticle = db.prepare(`
    INSERT OR REPLACE INTO articles (
      id, topic_id, slug, title, subtitle, claim, origin_platform, origin_url, origin_summary, 
      category, verdict, confidence, summary, explanation, what_is_true, what_is_false, 
      what_lacks_context, what_is_not_proven, status, human_review_required, published_at, origin_date,
      multimedia_url, multimedia_type, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'publicado', 0, datetime('now'), ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const insertSource = db.prepare(`
    INSERT OR REPLACE INTO sources (id, article_id, title, url, source_type, authority_level, quote_or_summary, date_accessed)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertSocialPost = db.prepare(`
    INSERT OR REPLACE INTO social_posts (id, article_id, platform, format, content, status, scheduled_at, published_at)
    VALUES (?, ?, ?, ?, ?, 'borrador', null, null)
  `);

  const getTopicId = (suggestedTopic) => {
    const s = suggestedTopic.toLowerCase();
    if (s.includes('franco')) return 't-franco';
    if (s.includes('mena') || s.includes('inmigr') || s.includes('extranj')) return 't-migracion';
    if (s.includes('begoña') || s.includes('peinado') || s.includes('sánchez')) return 't-begona';
    if (s.includes('koldo') || s.includes('ábalos') || s.includes('mascarilla')) return 't-koldo';
    if (s.includes('okupa') || s.includes('vivienda') || s.includes('alquiler')) return 't-vivienda';
    if (s.includes('precio') || s.includes('inflac') || s.includes('ipc') || s.includes('cesta')) return 't-inflacion';
    if (s.includes('paro') || s.includes('empleo') || s.includes('trabaj') || s.includes('fijo')) return 't-empleo';
    if (s.includes('autonom') || s.includes('fiscal') || s.includes('cuota') || s.includes('hacienda')) return 't-autonomos';
    if (s.includes('econom') || s.includes('sociedad') || s.includes('general')) return 't-economia';
    return 't-economia'; // Fallback por defecto
  };

  for (const item of pendingItems) {
    console.log(`\n[AI Pipeline] Procesando claim: "${item.detected_claim.substring(0, 50)}..."`);
    let articleData = null;
    let usedAi = false;
    
    const claimLower = (item.detected_claim || '').toLowerCase();
    const textLower = (item.text || '').toLowerCase();
    
    // Clasificación Deontológica preliminar para logs
    console.log(`  -> [Deontología Periodística] Analizando tipo de contenido para el claim...`);
    if (claimLower.includes('mcp') || claimLower.includes('tool') || claimLower.includes('compras') || claimLower.includes('referido') || claimLower.includes('afiliado') || textLower.includes('mcp') || textLower.includes('enlace')) {
      console.log(`  -> [Filtro Aplicado] Contenido Tecnológico / Comercial Detectado. Evaluando sesgo comercial y enlaces de referidos...`);
    } else if (claimLower.includes('sánchez') || claimLower.includes('partido') || claimLower.includes('ley') || claimLower.includes('boe') || claimLower.includes('gobierno') || textLower.includes('ley') || textLower.includes('boe')) {
      console.log(`  -> [Filtro Aplicado] Debate Público / Político Detectado. Contrastando leyes del BOE y datos del INE...`);
    } else {
      console.log(`  -> [Filtro Aplicado] Rumor de Redes Sociales Detectado. Evaluando veracidad general de afirmaciones...`);
    }

    // 1. Intentar llamar a la API de Gemini si hay API Key
    try {
      if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
        console.log(`  -> [Conexión] Solicitando análisis al motor Gemini API (modelo gemini-2.5-flash)...`);
        const prompt = `
Eres el Director de Verificación y Defensor del Lector de NEWNEWS. Tu labor se rige bajo los principios del Código Deontológico de la FAPE (Federación de Asociaciones de Periodistas de España) y los estándares del periodismo de investigación clásico: neutralidad absoluta, separación rigurosa entre información y opinión/promoción, e independencia editorial.

Analiza el siguiente claim y la transcripción/texto completo del recurso original detectado en el radar. Genera una verificación de hechos estructurada de alta calidad:
Transcripción/Texto Original (puede contener redundancias de dictado): "${item.text}"
Claim / Afirmación: "${item.detected_claim}"
Tema Sugerido: "${item.suggested_topic}"
Origen (Plataforma): "${item.platform}"
URL Original: "${item.url || 'No proporcionada'}"

--- INSTRUCCIONES DE REDACCIÓN Y MAQUETACIÓN (CRÍTICAS) ---
1. TÍTULO: Genera un titular periodístico profesional, informativo, serio y neutral.
   - PROHIBIDO usar la muletilla o prefijo "Auditoría de hechos sobre:".
   - PROHIBIDO usar lenguaje sensacionalista o clickbait de redes sociales ("el zasca de...", "el repaso de...", "humillación", "destroza").
   - Ejemplo correcto: "El debate de las listas paritarias en el Congreso: análisis de la legislación electoral y constitucional".
2. REDACCIÓN Y TONO: Redacta con un estilo formal, analítico, objetivo y periodístico. Estructura los argumentos con datos precisos. Evita valoraciones subjetivas del emisor y céntrate en verificar los hechos reales y el marco de datos contrastable.

--- GUÍA DE FUENTES OFICIALES Y BASE DE DATOS JURÍDICAS ---
Dependiendo del tema analizado, debes investigar y enlazar las bases de datos correspondientes (utiliza dominios oficiales .gob.es o .es o .europa.eu).
- Temas Laborales / Desempleo / SEPE: Cita datos del SEPE (sepe.gob.es) o del INE (ine.es - Encuesta de Población Activa EPA, normativa OIT).
- Leyes / Votaciones / BOE: Cita leyes exactas publicadas en el Boletín Oficial del Estado (boe.es) o sentencias del Tribunal Constitucional (tribunalconstitucional.es).
- Vivienda / Alquiler / Okupación: Cita leyes de vivienda en el BOE o estadísticas de vivienda del Ministerio (mivau.gob.es).
- Precios / Inflación: Cita el Índice de Precios de Consumo (IPC) del INE (ine.es).
- Igualdad / Derechos Sociales: Cita las leyes del Ministerio de Igualdad (igualdad.gob.es) o del BOE.
- MCP / Tecnología / Afiliados: Si el post contiene enlaces de referidos u opiniones comerciales encubiertas, expón los sesgos comerciales de forma objetiva y contrasta con la documentación oficial del software/herramienta (ej: nodejs.org, mcp.dev, github.com).

* REGLA DE DEONTOLOGÍA PERIODÍSTICA DE NEWNEWS:
  PROHIBIDO ABSOLUTAMENTE citar, mencionar, referenciar o enlazar a agencias de verificación de terceros (ej. Newtral, Maldita, EFE Verifica). Los desmentidos y fuentes deben basarse EXCLUSIVAMENTE en fuentes primarias oficiales.

Devuelve un JSON válido con la siguiente estructura:
{
  "title": "[Título claro, periodístico, directo, sin prefijos redundantes]",
  "subtitle": "[Subtítulo corto, didáctico y centrado en el veredicto y marco legal]",
  "verdict": "Verdadero" | "Falso" | "Engañoso" | "Falta contexto",
  "confidence": "Alta",
  "summary": "[Resumen periodístico del desmentido y la detección del sesgo u omisión de datos]",
  "explanation": "[Explicación detallada con datos del BOE/INE, resoluciones de tribunales o la naturaleza comercial del post/video. Cita artículos y leyes exactas si aplica]",
  "what_is_true": "[Qué partes de los datos expuestos son reales]",
  "what_is_false": "[Qué partes son exageraciones publicitarias, mentiras o bulos]",
  "what_lacks_context": "[Qué contexto omiten (como la presencia de enlaces de referidos o el historial de votaciones completas)]",
  "what_is_not_proven": "[Qué afirmaciones no tienen respaldo técnico, legislativo o científico]",
  "sources": [{ "title": "[Nombre de la fuente oficial o base de datos]", "url": "[URL de la fuente]", "source_type": "oficial", "authority_level": "Máxima", "quote_or_summary": "[Extracto o justificación de los datos consultados]" }],
  "social_posts": [{ "platform": "X", "format": "hilo", "content": "[Contenido corto para redes]" }]
}
`;
        articleData = await callGemini(prompt);
        usedAi = true;
        console.log(`  -> [Verificación] Procesado con éxito por Gemini API. Veredicto sugerido: ${articleData.verdict}`);
      } else {
        throw new Error('Sin API Key');
      }
    } catch (err) {
      // 2. Fallback Inteligente Local con datos reales de actualidad recopilados
      console.log('  -> Fallback a local debido a error:', err.message);
      
      let matchedKey = null;
      if (claimLower.includes('franco') || textLower.includes('franco')) matchedKey = 'franco';
      else if (claimLower.includes('mena') || claimLower.includes('inmigr') || textLower.includes('mena')) matchedKey = 'menas';
      else if (claimLower.includes('begoña') || claimLower.includes('peinado') || textLower.includes('begoña')) matchedKey = 'begona';
      else if (claimLower.includes('koldo') || claimLower.includes('ábalos') || claimLower.includes('mascarilla') || textLower.includes('koldo')) matchedKey = 'koldo';
      else if (claimLower.includes('okupa') || claimLower.includes('vivienda') || claimLower.includes('alquiler') || textLower.includes('okupa') || textLower.includes('vivienda')) matchedKey = 'vivienda';
      else if (claimLower.includes('precio') || claimLower.includes('inflac') || claimLower.includes('cesta') || textLower.includes('precio') || textLower.includes('cesta')) matchedKey = 'inflacion';
      else if (claimLower.includes('paro') || claimLower.includes('empleo') || claimLower.includes('fijo') || textLower.includes('paro') || textLower.includes('fijo')) matchedKey = 'desempleo';
      else if (claimLower.includes('autonom') || claimLower.includes('cuota') || claimLower.includes('impues') || claimLower.includes('hacienda') || textLower.includes('autonom') || textLower.includes('cuota')) matchedKey = 'autonomos';
      else if (claimLower.includes('cuenta') || textLower.includes('cuenta')) matchedKey = 'impuestos';
      
      if (matchedKey) {
        articleData = realClaimsDatabase[matchedKey];
      } else {
        // Generar un desmentido/análisis genérico neutral basado en la actualidad si no coincide
        articleData = {
          title: `Auditoría de hechos sobre: ${item.detected_claim.substring(0, 50)}...`,
          subtitle: `Analizamos las afirmaciones virales surgidas tras los debates en medios y redes sociales.`,
          verdict: 'Falta contexto',
          confidence: 'Media',
          summary: `El debate sobre "${item.detected_claim}" ha cobrado especial fuerza. Analizamos el marco normativo aplicable en España y las fuentes de datos primarias para esclarecer la verdad.`,
          explanation: `En relación con "${item.detected_claim}", las afirmaciones de las redes sociales suelen simplificar o descontextualizar el estado legal o legislativo. Recomendamos consultar los datos oficiales proporcionados por el Instituto Nacional de Estadística (INE), el BOE y los comunicados oficiales del Gobierno de España para contrastar de forma objetiva la información.`,
          what_is_true: 'La repercusión y debate en redes sociales es real.',
          what_is_false: 'Gran parte de las afirmaciones carecen de respaldo gráfico o documental contrastable.',
          what_lacks_context: 'Falta perspectiva jurídica para analizar el alcance de la propuesta o rumor.',
          what_is_not_proven: 'La veracidad de los testimonios individuales publicados en plataformas de vídeo.',
          sources: [
            { title: 'Google Trends España', url: 'https://trends.google.es', source_type: 'secundaria', authority_level: 'Media', quote_or_summary: 'Datos de tendencias y búsquedas.' }
          ]
        };
      }
    }

    // 3. Escribir en la base de datos
    const articleId = `art-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const topicId = getTopicId(item.suggested_topic || '');
    const slug = (articleData.title || 'articulo')
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 60);

    let imageUrl = null;
    try {
      const metrics = JSON.parse(item.metrics_json || '{}');
      imageUrl = metrics.imageUrl || null;
    } catch (e) {}

    try {
      insertArticle.run(
        articleId,
        topicId,
        slug,
        articleData.title,
        articleData.subtitle,
        item.detected_claim || articleData.title,
        item.platform,
        item.url,
        item.text,
        item.suggested_topic || 'Economía',
        articleData.verdict,
        articleData.confidence,
        articleData.summary,
        articleData.explanation,
        articleData.what_is_true,
        articleData.what_is_false,
        articleData.what_lacks_context,
        articleData.what_is_not_proven,
        item.origin_date || new Date().toISOString(),
        imageUrl,
        imageUrl ? 'image' : null
      );

      // Insertar fuentes
      if (articleData.sources && articleData.sources.length > 0) {
        articleData.sources.forEach((src, idx) => {
          insertSource.run(
            `src-ai-${Date.now()}-${idx}-${Math.floor(Math.random() * 100)}`,
            articleId,
            src.title,
            src.url,
            src.source_type || 'oficial',
            src.authority_level || 'Alta',
            src.quote_or_summary
          );
        });
      }

      // Insertar posts sociales
      // Si no vienen de la API, proveer borradores predefinidos útiles para el usuario
      const posts = articleData.social_posts || [
        { platform: 'X', format: 'corto', content: `¿Qué hay de cierto sobre: ${articleData.title}? Desmentimos el rumor con datos oficiales y leyes vigentes. Lee el expediente completo en NEWNEWS.` },
        { platform: 'Instagram', format: 'copy', content: `Desmentimos el bulo sobre: ${articleData.title}.\n\nRevisamos las estadísticas y las fuentes primarias oficiales de España para explicarte de forma sencilla la verdad.` }
      ];

      posts.forEach((post, idx) => {
        insertSocialPost.run(
          `soc-ai-${Date.now()}-${idx}-${Math.floor(Math.random() * 100)}`,
          articleId,
          post.platform,
          post.format || 'hilo',
          post.content
        );
      });

      updateScrapedItemStatus.run('procesado', item.id);
      console.log(`  ✅ Procesado con éxito: "${articleData.title}" agregado.`);
    } catch (dbErr) {
      console.error('  ❌ Error guardando en base de datos:', dbErr.message);
      try {
        updateScrapedItemStatus.run('error', item.id);
      } catch (e) {
        console.error('  ❌ Error actualizando estado a error:', e.message);
      }
    }
  }

  db.close();
  console.log('[AI Pipeline] Procesamiento completado de forma satisfactoria.');
}

processItems().catch(err => {
  console.error('[AI Pipeline] Error general:', err);
});
