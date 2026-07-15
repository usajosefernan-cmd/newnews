import { callGemini } from './config.js';

export async function extractClaim(itemText) {
  console.log(`[Claim Extractor] Extrayendo afirmación del texto...`);

  const prompt = `
Eres un Fact-Checker Profesional. Tu tarea es extraer la afirmación factual principal (claim) que deba ser verificada, a partir del siguiente fragmento de texto o transcripción capturado por el radar.

El claim extraído debe ser:
1. Una única frase concisa y clara.
2. Escrito en tono totalmente neutral y aséptico (sin ironías, sin adjetivos sensacionalistas).
3. Enfocado en los hechos contrastables de la afirmación (ej: "Se ha aprobado una ayuda de 4.000€ mensuales para menores extranjeros", "El allanamiento de morada requiere orden judicial para el desalojo en segundas viviendas").

TEXTO DETECTADO:
"${itemText}"

Devuelve un JSON con el formato exacto:
{
  "detected_claim": "[Afirmación neutral a verificar]",
  "context": "[Breve contexto de la afirmación]",
  "confidence": [0.0 a 1.0]
}
`;

  try {
    const result = await callGemini(prompt);
    console.log(`[Claim Extractor] Claim extraído: "${result.detected_claim}"`);
    return result;
  } catch (err) {
    console.warn('[Claim Extractor] Fallo al extraer con IA. Usando texto recortado como fallback.');
    return {
      detected_claim: itemText.substring(0, 100).trim() + '...',
      context: 'Recorte automático del radar.',
      confidence: 0.5
    };
  }
}
