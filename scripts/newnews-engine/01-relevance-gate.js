import { callGemini } from './config.js';

export async function evaluateRelevance(itemText, platform, metrics = {}) {
  console.log(`[Relevance Gate] Evaluando relevancia para item de ${platform}...`);

  const prompt = `
Eres un Analista Senior de Desinformación e Interés Público. Evalúa el siguiente claim/texto detectado en el radar de NEWNEWS para determinar si amerita gastar tokens de IA y tiempo editorial en su verificación de hechos.

TEXTO/CLAIM DETECTADO:
"${itemText}"
PLATAFORMA: ${platform}
MÉTRICAS DETECTADAS: ${JSON.stringify(metrics)}

--- CRITERIOS DE RELEVANCIA ---
1. INTERÉS PÚBLICO (public_interest_score): ¿Afecta a derechos fundamentales, salud, dinero público, elecciones, justicia o políticas en España?
2. VIRALIDAD (virality_score): Estimado del alcance o difusión (1.0 a 10.0).
3. DAÑO POTENCIAL (harm_score): ¿Puede la confusión sobre esto provocar perjuicios financieros directos, desconfianza institucional, discriminación o daños a la salud?
4. VALOR DE VERIFICACIÓN (verification_value_score): ¿Es algo contrastable objetivamente (leyes, datos oficiales) o es opinión subjetiva?
5. RUIDO COMERCIAL/PROMOCIONAL (commercial_noise_score): ¿Es un post para vender un producto, software o cursos? (Un score alto es negativo).

--- ACCIÓN RECOMENDADA ---
- "process": Alta viralidad o alto riesgo social; afecta a mucha gente y es verificable.
- "queue": Interés medio, requiere recopilación de más datos o viralidad creciente.
- "monitor_only": Todavía no es muy viral pero representa un tema de riesgo potencial.
- "ignore": Contenido promocional menor, opinión pura no verificable, deportes o irrelevante.

Devuelve un objeto JSON con el siguiente formato exacto:
{
  "should_process": true|false,
  "reason": "[Explicación de la decisión en base a los criterios]",
  "priority": "alta" | "media" | "baja" | "descartar",
  "public_interest_score": [0.0 a 10.0],
  "virality_score": [0.0 a 10.0],
  "harm_score": [0.0 a 10.0],
  "verification_value_score": [0.0 a 10.0],
  "commercial_noise_score": [0.0 a 10.0],
  "recommended_action": "process" | "queue" | "ignore" | "monitor_only"
}
`;

  try {
    const result = await callGemini(prompt);
    console.log(`[Relevance Gate] Decisión: ${result.recommended_action}. should_process: ${result.should_process}`);
    return result;
  } catch (err) {
    console.warn('[Relevance Gate] Fallo al evaluar relevancia con IA. Usando heurística local.');
    // Heurística local de fallback
    const textLower = itemText.toLowerCase();
    let interest = 3.0;
    let harm = 2.0;
    let commNoise = 1.0;
    let valVerify = 5.0;

    if (textLower.includes('ley') || textLower.includes('boe') || textLower.includes('gobierno') || textLower.includes('sánchez')) {
      interest = 8.5;
      harm = 6.0;
      valVerify = 9.0;
    }
    if (textLower.includes('okupa') || textLower.includes('vivienda') || textLower.includes('alquiler')) {
      interest = 9.0;
      harm = 8.0;
      valVerify = 8.0;
    }
    if (textLower.includes('ayuda') || textLower.includes('subsidio') || textLower.includes('inmigra') || textLower.includes('extranj')) {
      interest = 8.8;
      harm = 8.5;
      valVerify = 7.5;
    }
    if (textLower.includes('descuento') || textLower.includes('enlace en mi bio') || textLower.includes('compra') || textLower.includes('referido')) {
      commNoise = 9.0;
    }

    const shouldProcess = (interest >= 7.0 || harm >= 7.0) && commNoise < 7.0 && valVerify >= 6.0;

    return {
      should_process: shouldProcess,
      reason: 'Evaluación local heurística de fallback por keywords.',
      priority: shouldProcess ? 'alta' : (commNoise >= 7.0 ? 'descartar' : 'baja'),
      public_interest_score: interest,
      virality_score: metrics.score ? Math.min(10.0, 3.0 + metrics.score / 100) : 5.0,
      harm_score: harm,
      verification_value_score: valVerify,
      commercial_noise_score: commNoise,
      recommended_action: shouldProcess ? 'process' : (commNoise >= 7.0 ? 'ignore' : 'monitor_only')
    };
  }
}
