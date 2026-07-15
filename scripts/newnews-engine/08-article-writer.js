import { callGemini } from './config.js';

export async function writeArticle(claimText, verificationData, sources = []) {
  console.log(`[Article Writer] Redactando artículo periodístico de verificación...`);

  const prompt = `
Eres el Redactor Jefe de NEWNEWS. Tu tarea es escribir un artículo de verificación formal, claro y de alto rigor periodístico.
Sigue estrictamente el Código Deontológico de la FAPE: neutralidad absoluta, lenguaje formal y de datos, no uses adjetivos sensacionalistas ni clickbait.

DATOS DE VERIFICACIÓN:
- Claim: "${claimText}"
- Veredicto: "${verificationData.verdict}"
- Razonamiento: "${verificationData.verdict_reasoning}"
- Verdadero: "${verificationData.what_is_true}"
- Falso: "${verificationData.what_is_false}"
- Falta Contexto: "${verificationData.what_lacks_context}"
- No Probado: "${verificationData.what_is_not_proven}"
- Fuentes: ${JSON.stringify(sources)}

--- REGLAS CRÍTICAS ---
1. TÍTULO: Debe ser informativo, neutral y directo. NO uses el prefijo "Auditoría de hechos sobre:" ni clickbaits de redes.
2. SUBTÍTULO: Corto, indicando el marco legal o datos de veredicto.
3. EXPLICACIÓN: Redacta un cuerpo de artículo detallado, estructurado con claridad y precisión formal. Cita leyes, artículos exactos del BOE y datos del INE si aplica.
4. TRUCO DETECTADO (trick_used): Clasifica cuál de estas técnicas de manipulación se está usando para confundir: "cherry-picking", "falso dilema", "culpa colectiva", "dato sin base", "vídeo recortado", "autoridad falsa", "miedo/urgencia", "promoción encubierta".
5. NEWNEWS TERMÓMETRO SCORE (newnews_score): Calcula el termómetro de bulo/riesgo en España de 0 a 100: 
   - 0-20 ruido bajo
   - 21-40 dudoso
   - 41-60 confuso
   - 61-80 viral y preocupante
   - 81-100 prioridad alta/alarma
6. EMOJI TAG (emoji_tag): Selecciona la etiqueta exacta correspondiente con su emoji de esta lista:
   - "🔥 Caliente"
   - "🧊 Falta contexto"
   - "🧪 Necesita pruebas"
   - "🎭 Manipulación emocional"
   - "📉 Dato tramposo"
   - "🎬 Vídeo fuera de contexto"
   - "💸 Promo encubierta"
   - "⚖️ Revisión legal"
   - "🧠 Aprende el truco"

Devuelve un JSON con el formato exacto:
{
  "title": "[Título formal y neutral sin prefijos]",
  "subtitle": "[Subtítulo corto explicativo del veredicto]",
  "summary": "[Resumen ejecutivo del desmentido, explicando la distorsión del claim]",
  "explanation": "[Cuerpo completo del artículo de verificación, estructurado formalmente en varios párrafos. Detalla la base jurídica y estadística]",
  "trick_used": "cherry-picking" | "falso dilema" | "culpa colectiva" | "dato sin base" | "vídeo recortado" | "autoridad falsa" | "miedo/urgencia" | "promoción encubierta",
  "newnews_score": [Número entre 0 y 100],
  "emoji_tag": "[Etiqueta de la lista]"
}
`;

  try {
    const result = await callGemini(prompt);
    console.log(`[Article Writer] Redacción completada: "${result.title}" (Score: ${result.newnews_score})`);
    return result;
  } catch (err) {
    console.warn('[Article Writer] Fallo en la redacción con IA. Generando borrador periodístico de fallback.');
    return {
      title: `Contraste de datos sobre: ${claimText.substring(0, 50)}...`,
      subtitle: `Evaluamos la realidad legislativa y los datos oficiales en España ante el debate en redes sociales.`,
      summary: `El análisis del claim revela la necesidad de contextualizar la normativa para evitar malas interpretaciones de la opinión pública.`,
      explanation: `En España, las afirmaciones relativas a este tema suelen simplificarse omitiendo detalles esenciales de la ley. Para más información, se recomienda consultar los boletines oficiales correspondientes (BOE) o las estadísticas del Instituto Nacional de Estadística (INE), que aportan la base real desapasionada sobre los hechos.`,
      trick_used: 'dato sin base',
      newnews_score: 55,
      emoji_tag: '🧊 Falta contexto'
    };
  }
}
