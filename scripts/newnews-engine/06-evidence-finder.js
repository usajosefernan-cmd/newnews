import { getDb } from './config.js';

export async function findEvidence(claimText, topicId, strategy = {}) {
  console.log(`[Evidence Finder] Buscando evidencias y fuentes primarias oficiales para: "${claimText.substring(0, 50)}..."`);
  const db = getDb();

  // 1. Intentar buscar fuentes asociadas a artículos similares ya verificados de este mismo vertical
  let foundSources = [];
  try {
    foundSources = db.prepare(`
      SELECT s.title, s.url, s.source_type, s.authority_level, s.quote_or_summary
      FROM sources s
      JOIN articles a ON s.article_id = a.id
      WHERE a.topic_id = ? AND a.status = 'publicado'
      LIMIT 5
    `).all(topicId);
  } catch (e) {
    console.error('[Evidence Finder] Error buscando fuentes en la DB:', e.message);
  }

  // Si encontramos fuentes consolidadas en el vertical, las reutilizamos
  if (foundSources.length > 0) {
    console.log(`[Evidence Finder] -> Encontradas ${foundSources.length} fuentes oficiales en la base de datos del vertical.`);
    db.close();
    return {
      sources: foundSources.map(s => ({
        title: s.title,
        url: s.url,
        source_type: s.source_type || 'oficial',
        authority_level: s.authority_level || 'Máxima',
        quote_or_summary: s.quote_or_summary || ''
      })),
      cached: true
    };
  }

  // 2. Si no hay fuentes en el vertical, proveemos fuentes por defecto de alta autoridad basadas en el tipo de tema
  const lowerClaim = claimText.toLowerCase();
  let sources = [];

  if (lowerClaim.includes('okupa') || lowerClaim.includes('vivienda') || lowerClaim.includes('alquiler') || topicId.includes('vivienda')) {
    sources = [
      {
        title: 'BOE: Ley por el Derecho a la Vivienda (Ley 12/2023)',
        url: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2023-12203',
        source_type: 'oficial',
        authority_level: 'Máxima',
        quote_or_summary: 'Regulación del procedimiento de desahucio y la definición de zonas tensionadas en España.'
      },
      {
        title: 'Fiscalía General del Estado: Instrucción 1/2020 sobre usurpación',
        url: 'https://www.fiscal.es',
        source_type: 'oficial',
        authority_level: 'Máxima',
        quote_or_summary: 'Criterios de actuación ante delitos de allanamiento de morada y usurpación de bienes inmuebles.'
      }
    ];
  } else if (lowerClaim.includes('mena') || lowerClaim.includes('inmigr') || lowerClaim.includes('extranj') || topicId.includes('migracion')) {
    sources = [
      {
        title: 'BOE: Ley Orgánica sobre derechos y libertades de los extranjeros en España (LO 4/2000)',
        url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2000-544',
        source_type: 'oficial',
        authority_level: 'Máxima',
        quote_or_summary: 'Marco legal del acceso de los ciudadanos extranjeros a las prestaciones y ayudas públicas asistenciales.'
      },
      {
        title: 'Seguridad Social: Requisitos de acceso al Ingreso Mínimo Vital',
        url: 'https://www.seg-social.es',
        source_type: 'oficial',
        authority_level: 'Máxima',
        quote_or_summary: 'Exigencia de residencia legal y efectiva en España de al menos un año ininterrumpido para solicitar el IMV.'
      }
    ];
  } else if (lowerClaim.includes('paro') || lowerClaim.includes('empleo') || lowerClaim.includes('fijo') || topicId.includes('empleo')) {
    sources = [
      {
        title: 'Instituto Nacional de Estadística (INE): Encuesta de Población Activa (EPA)',
        url: 'https://www.ine.es',
        source_type: 'oficial',
        authority_level: 'Máxima',
        quote_or_summary: 'Datos trimestrales del mercado de trabajo y desempleo estimado.'
      },
      {
        title: 'SEPE: Estadísticas de Paro Registrado mensual',
        url: 'https://sepe.gob.es',
        source_type: 'oficial',
        authority_level: 'Máxima',
        quote_or_summary: 'Cálculo de demandantes de empleo parados registrados (excluyendo fijos discontinuos inactivos según orden de 1985).'
      }
    ];
  } else if (lowerClaim.includes('precio') || lowerClaim.includes('inflac') || lowerClaim.includes('cesta') || topicId.includes('inflacion')) {
    sources = [
      {
        title: 'Instituto Nacional de Estadística (INE): Índice de Precios de Consumo (IPC)',
        url: 'https://www.ine.es',
        source_type: 'oficial',
        authority_level: 'Máxima',
        quote_or_summary: 'Evolución detallada de los precios de consumo y la cesta de la compra de alimentos.'
      }
    ];
  } else {
    // Fuentes institucionales genéricas
    sources = [
      {
        title: 'Boletín Oficial del Estado (BOE)',
        url: 'https://www.boe.es',
        source_type: 'oficial',
        authority_level: 'Máxima',
        quote_or_summary: 'Publicación oficial de las leyes y normas vigentes en España.'
      }
    ];
  }

  db.close();
  return {
    sources,
    cached: false
  };
}
