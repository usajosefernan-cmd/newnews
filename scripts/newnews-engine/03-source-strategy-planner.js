import { callGemini } from './config.js';
import { getSourceStrategyCache, setSourceStrategyCache } from './cache.js';

export async function planSourceStrategy(claimText, topicTitle, claimType = 'Social') {
  console.log(`[Source Strategy Planner] Planificando fuentes para el claim: "${claimText.substring(0, 50)}..." bajo el tema "${topicTitle}"`);

  // Intentar recuperar estrategia previa del cache usando el topicTitle como área semántica
  const cachedStrategy = getSourceStrategyCache(topicTitle);
  if (cachedStrategy) {
    console.log(`[Source Strategy Planner] -> Reutilizando estrategia desde caché para el área semántica: "${topicTitle}"`);
    return {
      source_strategy: {
        required_source_types: cachedStrategy.source_types,
        preferred_authority_level: 'Máxima',
        minimum_sources: 1,
        needs_original_source: true,
        needs_context_source: true,
        needs_counter_source: false,
        manual_check_required: false
      },
      search_queries: cachedStrategy.preferred_sources,
      reuse_from_cache: true,
      reason: 'Estrategia semántica cargada desde caché de base de datos.'
    };
  }

  const prompt = `
Eres un Planificador de Estrategia de Fuentes para un medio de verificación periodística en España.
Tu tarea es decidir qué tipo de fuentes de máxima autoridad oficial/primaria son necesarias para desmentir o verificar el siguiente claim de forma irrebatible, y qué consultas de búsqueda realizar.

CLAIM: "${claimText}"
TEMA GENERAL: "${topicTitle}"
TIPO DE CLAIM: "${claimType}"

--- FUENTES DISPONIBLES EN ESPAÑA ---
- BOE (Boletín Oficial del Estado - boe.es) para leyes, reales decretos, nombramientos oficiales.
- INE (Instituto Nacional de Estadística - ine.es) para estadísticas de empleo, IPC, inflación, demografía.
- SEPE (sepe.gob.es) o Seguridad Social (seg-social.es) para desempleo, cuotas de autónomos, pensiones.
- Ministerios oficiales (mivau.gob.es para vivienda, igualdad.gob.es para igualdad, fiscal.es para delincuencia).
- Webs de partidos políticos o Congreso (congreso.es) para propuestas políticas o iniciativas parlamentarias.
- Portales de software/desarrollo oficiales (github.com, nodejs.org, mcp.dev) si es de carácter tecnológico.

--- DIRECTRIZ DE PERIODISMO DE NEWNEWS ---
PROHIBIDO TOTALMENTE recurrir o sugerir agencias de fact-checking como Maldita o Newtral. Debes buscar única y exclusivamente FUENTES PRIMARIAS DE AUTORIDAD.

Devuelve un JSON con el siguiente formato exacto:
{
  "source_strategy": {
    "required_source_types": ["[Tipo de fuente oficial, ej: Legislativa / BOE]", "[Tipo de fuente estadística, ej: Datos INE]"],
    "preferred_authority_level": "Máxima" | "Alta" | "Media",
    "minimum_sources": [Número mínimo de fuentes independientes, típicamente 1 o 2],
    "needs_original_source": true|false,
    "needs_context_source": true|false,
    "needs_counter_source": true|false,
    "manual_check_required": true|false
  },
  "search_queries": ["[Consulta de búsqueda 1 para Google/Buscadores]", "[Consulta de búsqueda 2]"],
  "reuse_from_cache": false,
  "reason": "[Explicación de por qué se requiere este tipo de fuentes]"
}
`;

  try {
    const result = await callGemini(prompt);
    console.log(`[Source Strategy Planner] Estrategia planificada con éxito por la IA.`);

    // Guardar estrategia en caché para futuros claims del mismo tema
    setSourceStrategyCache(topicTitle, {
      source_types: result.source_strategy.required_source_types,
      preferred_sources: result.search_queries,
      validation_rules: { authority: result.source_strategy.preferred_authority_level }
    });

    return result;
  } catch (err) {
    console.warn('[Source Strategy Planner] Fallo al planificar con IA. Usando planificación heurística local.');
    // Planificación heurística local
    const queries = [`${topicTitle} España boe`, `${topicTitle} datos oficiales`];
    const sourceTypes = ['Oficial Gubernamental'];

    return {
      source_strategy: {
        required_source_types: sourceTypes,
        preferred_authority_level: 'Alta',
        minimum_sources: 1,
        needs_original_source: true,
        needs_context_source: true,
        needs_counter_source: false,
        manual_check_required: false
      },
      search_queries: queries,
      reuse_from_cache: false,
      reason: 'Estrategia heurística de fallback por fallos de la IA.'
    };
  }
}
