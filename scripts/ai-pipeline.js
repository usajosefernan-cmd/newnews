import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Helper para cargar .env manualmente
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

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/newnews.db');

console.log('[AI Pipeline] Iniciando procesado de items virales...');

// Heurísticas de fallback por si la API de Gemini falla o no tiene saldo
const fallbackAnswers = {
  'El gobierno impondrá un impuesto del 5% a los depósitos bancarios de más de 10.000€.': {
    title: '¿Impondrá el gobierno un impuesto del 5% a los depósitos de más de 10.000€?',
    subtitle: 'Desmentido del supuesto impuesto especial a los ahorros de los españoles para financiar ayudas de vivienda.',
    verdict: 'Falso',
    confidence: 'Alta',
    summary: 'No existe ningún proyecto de ley, decreto o propuesta del Ministerio de Hacienda que contemple un impuesto del 5% sobre los depósitos de más de 10.000 euros. Las afirmaciones virales surgen de interpretaciones sesgadas de discursos sobre fiscalidad bancaria general y propuestas de ayudas de alquiler sin ninguna relación.',
    explanation: 'El rumor que circula en redes afirma falsamente que el gobierno prepara una retención del 5% sobre el saldo de los depósitos de los particulares a partir de la próxima semana. Fuentes oficiales del Ministerio de Hacienda han desmentido la existencia de cualquier medida fiscal de estas características. \n\nEn España, el marco normativo de los impuestos sobre los depósitos y el ahorro está regulado por la Ley del IRPF, tributando únicamente los intereses generados por los depósitos bancarios (rendimientos del capital mobiliario), no el principal depositado. Imponer un gravamen directo sobre el saldo de los depósitos particulares vulneraría las directivas financieras de la Unión Europea y el principio de seguridad jurídica.',
    what_is_true: 'No hay ninguna parte de la afirmación que sea cierta.',
    what_is_false: 'Es totalmente falso que se vaya a aplicar un impuesto del 5% a los depósitos de más de 10.000 euros.',
    what_lacks_context: 'Se mezclan discursos sobre el gravamen temporal a las grandes entidades financieras con las cuentas personales de los ciudadanos para alarmar.',
    what_is_not_proven: 'No hay ningún documento, borrador o declaración que demuestre que esta medida haya sido siquiera sugerida por ningún partido del arco parlamentario.',
    sources: [
      { title: 'Ministerio de Hacienda y Función Pública', url: 'https://www.hacienda.gob.es', quote_or_summary: 'Desmentido oficial de cualquier tasa o impuesto extraordinario sobre depósitos particulares.' },
      { title: 'Banco de España - Regulación sobre depósitos', url: 'https://www.bde.es', quote_or_summary: 'Información y normativa sobre la retención fiscal de intereses de cuentas de ahorro en España.' }
    ]
  },
  'Existe una orden ministerial que prohíbe detener a menores extranjeros no acompañados.': {
    title: '¿Tienen la policía prohibido detener a menores extranjeros (MENAS)?',
    subtitle: 'Datos sobre el marco legal de la detención de menores de edad en España y las instrucciones policiales vigentes.',
    verdict: 'Falso',
    confidence: 'Alta',
    summary: 'La Ley de Seguridad Ciudadana y el Código Penal en España rigen para todas las personas sin importar su origen. Los menores de edad de entre 14 y 18 años están sujetos a la Ley Orgánica de Responsabilidad Penal de los Menores y pueden ser detenidos por la policía por la comisión de delitos flagrantes o por orden judicial.',
    explanation: 'Un bulo recurrente en redes sostiene que las fuerzas de seguridad tienen prohibido detener a los menores extranjeros tutelados por instrucciones de los ministerios correspondientes. Sin embargo, no existe ninguna directiva, protocolo ni ley que exima a los menores extranjeros de la acción policial. \n\nEl Protocolo Marco sobre Menores Extranjeros No Acompañados de 2014, dictado de conformidad con la Ley de Extranjería y el Código Civil, detalla los pasos para la identificación y protección del menor, pero no limita en absoluto su detención penal si cometen un hecho delictivo. Las directivas de la Fiscalía de Menores reafirman que los jóvenes extranjeros mayores de 14 años ingresan en centros de internamiento cerrados o en calabozos de menores si existe riesgo de fuga o gravedad delictiva, en igualdad de condiciones legales que un menor de nacionalidad española.',
    what_is_true: 'El protocolo policial establece la obligatoriedad de dar prioridad absoluta a la protección de los menores, poniéndolos de inmediato a disposición de la Fiscalía de Menores tras su identificación.',
    what_is_false: 'Es falso que la policía tenga prohibido detenerlos o que disfruten de impunidad penal. El Código Penal se les aplica íntegramente a partir de los 14 años bajo la jurisdicción de menores.',
    what_lacks_context: 'Se confunde habitualmente el proceso de acogida y tutela administrativa del menor (que busca proteger su integridad) con el proceso judicial penal derivado de la comisión de delitos.',
    what_is_not_proven: 'No hay un solo caso documentado o directriz policial interna que demuestre impunidad o instrucciones de no detención por parte del Ministerio del Interior.',
    sources: [
      { title: 'BOE - Ley Orgánica de Responsabilidad Penal del Menor', url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2000-641', quote_or_summary: 'Regulación del procedimiento penal aplicable a menores infractores en España.' },
      { title: 'Ministerio del Interior - Instrucción de la Secretaría de Estado de Seguridad', url: 'https://www.interior.gob.es', quote_or_summary: 'Protocolo de actuación policial con menores de edad extranjeros.' }
    ]
  },
  'Francisco Franco inventó la paga extraordinaria de Navidad en España.': {
    title: '¿Creó Franco la paga extra de Navidad en España?',
    subtitle: 'El origen real del aguinaldo decembrino y las gratificaciones obligatorias para la clase trabajadora.',
    verdict: 'Falta contexto',
    confidence: 'Alta',
    summary: 'Si bien el régimen de Franco reguló y generalizó por primera vez por ley en 1944 una gratificación extraordinaria de Navidad para industrias específicas, el aguinaldo navideño voluntario y pactado en convenios colectivos ya existía previamente en España. Medidas de gratificación similares ya se habían propuesto y aplicado en corporaciones públicas y sectores industriales durante el primer tercio del siglo XX.',
    explanation: 'La creencia de que Francisco Franco inventó el aguinaldo de Navidad está muy extendida en redes sociales. Históricamente, la dictadura franquista la decretó como obligatoria mediante una Orden de 1944 del Ministerio de Trabajo que estableció una gratificación equivalente a una semana de salario para el personal de las industrias no reglamentadas. Posteriormente, en 1947, se añadió la paga extraordinaria de julio (gratificación de la fiesta del Trabajo). \n\nNo obstante, la idea de compensar económicamente a los trabajadores en Navidad no fue inventada por el franquismo. En la España de la Restauración y la Segunda República, muchos sectores de la administración pública, la banca y el comercio ya contaban con gratificaciones decembrinas reguladas en sus estatutos corporativos o pactadas voluntariamente entre empresarios y sindicatos como herencia de la tradición decimonónica del aguinaldo. El franquismo tomó esta práctica preexistente y la convirtió en un derecho general para controlar el malestar social derivado de la carestía de la posguerra.',
    what_is_true: 'El franquismo reguló formalmente a nivel nacional y estatal la obligatoriedad de la paga extra de Navidad a través de una Orden del Ministerio de Trabajo en diciembre de 1944.',
    what_is_false: 'Es falso que el concepto de paga navideña u aguinaldo naciera con la dictadura; ya era una costumbre laboral consolidada en muchas industrias y convenios previos.',
    what_lacks_context: 'Se omite que la medida se aprobó en un contexto de inflación desbocada y salarios reales hundidos por debajo del nivel de 1936, sirviendo como amortiguador de la extrema escasez material del periodo de autarquía.',
    what_is_not_proven: 'No se puede catalogar como un logro social puro sin vincularlo a las huelgas y descontento obrero sumergido que amenazaban la paz de la dictadura en los años 40.',
    sources: [
      { title: 'BOE - Orden del 9 de diciembre de 1944 sobre gratificación de Navidad', url: 'https://www.boe.es/datos/pdfs/BOE//1944/346/A09230-09231.pdf', quote_or_summary: 'Disposición oficial que obliga al pago extraordinario equivalente a una semana de salario.' },
      { title: 'Hemeroteca Digital de la Biblioteca Nacional de España', url: 'http://hemerotecadigital.bne.es/', quote_or_summary: 'Registros de prensa histórica sobre gratificaciones y aguinaldos obreros anteriores a 1936.' }
    ]
  },
  'La Ley de Vivienda impide desalojar okupaciones en primera residencia antes de dos años.': {
    title: '¿Impide la Ley de Vivienda desalojar okupas en primera residencia?',
    subtitle: 'Análisis de los plazos judiciales, el delito de allanamiento y la actuación policial inmediata.',
    verdict: 'Falso',
    confidence: 'Alta',
    summary: 'La ocupación de una vivienda habitada (primera o segunda residencia) constituye un delito de allanamiento de morada. En estos casos, la Ley de Vivienda de 2023 no introduce ningún cambio que paralice el desalojo: la policía puede desalojar a los ocupantes inmediatamente, sin necesidad de orden judicial, al tratarse de un delito flagrante.',
    explanation: 'Existe una enorme confusión entre dos delitos distintos en España: el allanamiento de morada (ocupar una casa habitada) y la usurpación de inmuebles (ocupar una vivienda vacía, propiedad de un banco o promotora). \n\nLa Ley de Vivienda de 2023 introdujo modificaciones procesales en la Ley de Enjuiciamiento Civil para regular los desahucios de personas vulnerables, exigiendo trámites adicionales de mediación a los grandes tenedores de inmuebles (propietarios de más de 10 viviendas). Sin embargo, estas medidas solo aplican a los juicios civiles de desahucio por impago de alquiler o usurpación en inmuebles de grandes tenedores. Si una vivienda habitual o segunda residencia es ocupada ilegalmente por allanamiento de morada, la actuación penal se tramita por la vía rápida del artículo 202 del Código Penal, donde la Fiscalía General del Estado autoriza a la policía a restituir la posesión de forma inmediata tras constatar el allanamiento, sin demoras de años.',
    what_is_true: 'La Ley de Vivienda ralentiza los procesos de desahucio civil de viviendas vacías propiedad de grandes tenedores (bancos, fondos) cuando hay familias vulnerables sin alternativa habitacional.',
    what_is_false: 'Es falso que un particular no pueda recuperar su vivienda habitual de inmediato en caso de allanamiento o que la policía esté atada de manos por dos años.',
    what_lacks_context: 'Se mezclan de forma interesada las disputas civiles por impagos de alquiler (donde el desahucio judicial sí tarda meses) con las okupaciones delictivas de hogares.',
    what_is_not_proven: 'No hay estadísticas judiciales que muestren un solo caso de propietario particular perdiendo su hogar permanente debido a las protecciones de la Ley de Vivienda.',
    sources: [
      { title: 'Fiscalía General del Estado - Instrucción 1/2020 sobre desalojo de moradas', url: 'https://www.fiscal.es', quote_or_summary: 'Instrucción que unifica criterios policiales para desalojar inmediatamente viviendas habitadas.' },
      { title: 'BOE - Ley 12/2023 por el Derecho a la Vivienda', url: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2023-12203', quote_or_summary: 'Texto oficial de la ley y modificaciones de la Ley de Enjuiciamiento Civil.' }
    ]
  }
};

// Función para llamar a Gemini con fetch
async function callGemini(promptText) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Sin clave API de Gemini');
  }

  // Usamos gemini-2.5-flash como modelo rápido y potente
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: promptText }]
      }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error en API de Gemini: ${response.status} - ${errorText}`);
  }

  const json = await response.json();
  const rawText = json.candidates[0].content.parts[0].text;
  return JSON.parse(rawText);
}

async function processItems() {
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ La base de datos no existe en ${dbPath}.`);
    process.exit(1);
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');

  // Obtener items pendientes
  const pendingItems = db.prepare("SELECT * FROM scraped_items WHERE status = 'pendiente'").all();
  console.log(`[AI Pipeline] Encontrados ${pendingItems.length} ítems pendientes para procesar.`);

  if (pendingItems.length === 0) {
    db.close();
    return;
  }

  const updateScrapedItemStatus = db.prepare("UPDATE scraped_items SET status = ? WHERE id = ?");

  const insertArticle = db.prepare(`
    INSERT OR REPLACE INTO articles (id, topic_id, slug, title, subtitle, claim, origin_platform, origin_url, origin_summary, category, verdict, confidence, summary, explanation, what_is_true, what_is_false, what_lacks_context, what_is_not_proven, status, human_review_required, published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador', 1, null, datetime('now'), datetime('now'))
  `);

  const insertSource = db.prepare(`
    INSERT OR REPLACE INTO sources (id, article_id, title, url, source_type, authority_level, quote_or_summary, date_accessed)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const insertSocialPost = db.prepare(`
    INSERT OR REPLACE INTO social_posts (id, article_id, platform, format, content, status, scheduled_at, published_at)
    VALUES (?, ?, ?, ?, ?, 'borrador', null, null)
  `);

  const logAiCall = db.prepare(`
    INSERT INTO ai_logs (id, task, provider, model, tokens, cost_estimate, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  // Intentar encontrar el topic_id por categoría o nombre
  const getTopicId = (suggestedTopic, category) => {
    let slug = 'economia-espanola';
    if (suggestedTopic.toLowerCase().includes('franco')) slug = 'franco';
    else if (suggestedTopic.toLowerCase().includes('mena')) slug = 'menores-extranjeros-no-acompanados';
    else if (suggestedTopic.toLowerCase().includes('vivienda')) slug = 'vivienda-y-okupacion';

    const row = db.prepare("SELECT id FROM topics WHERE slug = ?").get(slug);
    return row ? row.id : 't-economia';
  };

  for (const item of pendingItems) {
    console.log(`\n[AI Pipeline] Procesando ítem: "${item.detected_claim || item.text.substring(0, 40)}..."`);
    let articleData = null;
    let usedAi = false;
    let tokensUsed = 0;
    let modelName = 'gemini-2.5-flash';

    // 1. Intentar llamar a Gemini API
    try {
      const prompt = `
Eres el redactor jefe de NEWNEWS, una web especializada en verificar bulos virales de España. Tu trabajo es desmentir o contextualizar afirmaciones de manera neutral, directa, educativa y rigurosa, aportando fuentes oficiales (como el INE, BOE, ministerios, sentencias, etc.).

Analiza el siguiente ítem detectado en redes:
Plataforma de origen: ${item.platform}
Texto original: ${item.text}
Afirmación (claim) detectada: ${item.detected_claim}
Tema sugerido: ${item.suggested_topic}

Devuelve un JSON estrictamente con la siguiente estructura (ningún otro texto fuera del JSON):
{
  "title": "Título directo y periodístico del desmentido (preferentemente formato de pregunta o aclaración directa)",
  "subtitle": "Un subtítulo descriptivo que sitúe al lector",
  "verdict": "Uno de los siguientes veredictos literales: 'Verdadero', 'Falso', 'Engañoso', 'Falta contexto', 'Sin pruebas suficientes', 'No verificable todavía', 'Hay indicios, pero no prueba concluyente'",
  "confidence": "Alta", "Media" o "Baja" (según la disponibilidad de fuentes oficiales)",
  "summary": "Resumen en 4-5 líneas explicando claramente el veredicto",
  "explanation": "Explicación detallada de los hechos, contrastando el claim contra las fuentes oficiales españolas y el marco legislativo",
  "what_is_true": "Qué parte de la afirmación es real o tiene base",
  "what_is_false": "Qué parte es falsa, errónea o engañosa",
  "what_lacks_context": "Qué omisiones de contexto cambian el sentido de la afirmación",
  "what_is_not_proven": "Qué hechos siguen sin poder probarse científicamente o estadísticamente",
  "sources": [
    {
      "title": "Nombre de la institución o informe oficial (ej: INE - Censo de población 2024)",
      "url": "URL real de la fuente o del sitio oficial (ej: https://www.ine.es)",
      "source_type": "oficial",
      "authority_level": "Máxima",
      "quote_or_summary": "Resumen breve de qué datos de la fuente desmienten el bulo"
    }
  ],
  "social_posts": [
    { "platform": "X", "format": "hilo", "content": "1/ ¿Es cierto que...? Abrimos hilo con datos originales. [Enlace al artículo]\\n2/ En primer lugar..." },
    { "platform": "Instagram", "format": "carrusel", "content": "Diapositiva 1: Portada impactante con veredicto.\\nDiapositiva 2: El bulo en redes.\\nDiapositiva 3: Lo que dice el BOE/INE.\\nDiapositiva 4: Conclusión neutral." },
    { "platform": "TikTok", "format": "guion", "content": "[VOZ EN OFF]: ¿Te ha llegado el bulo de que...? ¡No te dejes engañar! Mira lo que dice realmente el INE..." }
  ]
}
`;
      articleData = await callGemini(prompt);
      usedAi = true;
      tokensUsed = 1200; // Estimación simple de tokens
      console.log('  [AI Pipeline] -> Gemini respondió correctamente.');
    } catch (aiErr) {
      console.log(`  [AI Pipeline] -> La llamada a Gemini falló (${aiErr.message}). Usando heurística/fallback local.`);
      // Buscar si el claim está en nuestra lista de desmentidos predefinidos
      const matchedClaim = Object.keys(fallbackAnswers).find(key => 
        item.detected_claim && item.detected_claim.toLowerCase().includes(key.substring(0, 30).toLowerCase())
      );

      if (matchedClaim) {
        articleData = fallbackAnswers[matchedClaim];
      } else {
        // Fallback genérico para tendencias de Google Trends
        const cleanClaim = item.detected_claim || item.text || 'Tendencia general';
        articleData = {
          title: `¿Qué sabemos sobre la tendencia viral de "${cleanClaim}"?`,
          subtitle: `Análisis y recopilación de datos oficiales tras popularizarse la búsqueda en España.`,
          verdict: 'Falta contexto',
          confidence: 'Media',
          summary: `La tendencia sobre "${cleanClaim}" ha registrado un fuerte repunte de búsquedas en España. A falta de afirmaciones delictivas o bulos explícitos, explicamos el origen de la noticia y los datos reales y fuentes de referencia.`,
          explanation: `El aumento de búsquedas en Google e interacciones en redes en torno a "${cleanClaim}" se debe a la actualidad social o deportiva en España. Es importante recordar que las tendencias virales suelen estar rodeadas de informaciones apresuradas o sin contrastar. \n\nRecomendamos acudir a comunicados oficiales y fuentes contrastadas para evitar la desinformación en tiempo real.`,
          what_is_true: 'La popularidad de la búsqueda es real y responde a un acontecimiento reciente en la agenda informativa española.',
          what_is_false: 'Muchas de las capturas o rumores rápidos compartidos en caliente en redes carecen de verificación periodística.',
          what_lacks_context: 'Falta perspectiva temporal para evaluar el impacto a largo plazo de este evento.',
          what_is_not_proven: 'La veracidad de testimonios individuales publicados en redes sin respaldo gráfico o policial.',
          sources: [
            { title: 'Google Trends España', url: 'https://trends.google.es', source_type: 'secundaria', authority_level: 'Media', quote_or_summary: 'Datos de volumen y distribución de búsquedas en territorio español.' }
          ],
          social_posts: [
            { platform: 'X', format: 'respuesta', content: `¿Buscando sobre ${cleanClaim}? Te explicamos de dónde viene la polémica y las fuentes oficiales aquí: [enlace]` }
          ]
        };
      }
    }

    // 2. Insertar el artículo en SQLite
    const articleId = `art-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const topicId = getTopicId(item.suggested_topic || '', item.category || 'Economía');
    const slug = (articleData.title || 'articulo')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 60);

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
        articleData.what_is_not_proven
      );

      // Insertar fuentes
      if (articleData.sources && articleData.sources.length > 0) {
        articleData.sources.forEach((src, idx) => {
          insertSource.run(
            `src-ai-${Date.now()}-${idx}`,
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
      if (articleData.social_posts && articleData.social_posts.length > 0) {
        articleData.social_posts.forEach((post, idx) => {
          insertSocialPost.run(
            `soc-ai-${Date.now()}-${idx}`,
            articleId,
            post.platform,
            post.format,
            post.content
          );
        });
      }

      // Loguear el uso de IA
      logAiCall.run(
        `log-${Date.now()}`,
        'Procesado de item radar',
        usedAi ? 'Gemini API' : 'Fallback Local',
        modelName,
        tokensUsed,
        usedAi ? 0.00015 : 0.0, // Estimación del coste
        'SUCCESS'
      );

      // Actualizar el estado del item a 'procesado'
      updateScrapedItemStatus.run('procesado', item.id);
      console.log(`  [AI Pipeline] ✅ Artículo "${articleData.title}" insertado en borradores.`);
    } catch (dbErr) {
      console.error('  [AI Pipeline] ❌ Error insertando artículo en DB:', dbErr.message);
    }
  }

  db.close();
  console.log('\n[AI Pipeline] Todos los ítems de radar procesados correctamente.');
}

processItems().catch(err => {
  console.error('[AI Pipeline] Error general en el pipeline:', err);
});
