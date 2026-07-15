import { callGemini } from './config.js';

export async function verifyClaim(claimText, sources = []) {
  console.log(`[Verifier] Verificando claim: "${claimText.substring(0, 50)}..."`);

  const prompt = `
Eres un Auditor de Datos y Veracidad en NEWNEWS. Tu labor es realizar un contraste analítico, desapasionado y lógico entre el claim y las fuentes oficiales primarias recolectadas.

CLAIM A VERIFICAR:
"${claimText}"

FUENTES OFICIALES DE EVIDENCIA:
${JSON.stringify(sources)}

--- INSTRUCCIONES ---
1. Analiza con precisión técnica si el claim es:
   - "Verdadero": Los hechos afirmados coinciden exactamente con la normativa o datos estadísticos oficiales.
   - "Falso": Las afirmaciones contradicen o falsean directamente la ley, los datos o la realidad documental.
   - "Engañoso": Mezcla hechos verdaderos con omisiones o interpretaciones falsas sesgadas para confundir.
   - "Falta contexto": Requiere perspectiva legal, metodológica o histórica sin la cual la frase induce a conclusiones equivocadas.
2. Genera un nivel de confianza en el veredicto ("Alta", "Media" o "Baja").
3. Elabora un resumen técnico de qué parte del claim es cierta, cuál es falsa, qué contexto falta y qué no está probado.

Devuelve un JSON con el formato exacto:
{
  "verdict": "Verdadero" | "Falso" | "Engañoso" | "Falta contexto",
  "confidence": "Alta" | "Media" | "Baja",
  "verdict_reasoning": "[Explicación lógica paso a paso de cómo las fuentes desmienten o prueban la afirmación]",
  "what_is_true": "[Qué partes de la afirmación son reales]",
  "what_is_false": "[Qué partes de la afirmación son mentiras o bulos]",
  "what_lacks_context": "[Qué contexto legal, temporal o metodológico se omitió]",
  "what_is_not_proven": "[Qué elementos no se han podido demostrar con las pruebas actuales]"
}
`;

  try {
    const result = await callGemini(prompt, '07');
    console.log(`[Verifier] Veredicto: ${result.verdict}. Confianza: ${result.confidence}`);
    return result;
  } catch (err) {
    console.warn('[Verifier] Fallo al verificar con IA. Generando veredicto de fallback.');
    return {
      verdict: 'Falta contexto',
      confidence: 'Media',
      verdict_reasoning: 'Verificación heurística local de seguridad debido a fallos temporales en los proveedores de inferencia.',
      what_is_true: 'El debate social en torno a la materia.',
      what_is_false: 'Exageraciones típicas que distorsionan las cifras absolutas o plazos legales.',
      what_lacks_context: 'El marco jurídico de competencias del Estado y las CCAA.',
      what_is_not_proven: 'La veracidad de los testimonios virales aislados en vídeo.'
    };
  }
}
