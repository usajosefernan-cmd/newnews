import { callGemini } from './config.js';
import { buildInfographic } from '../infographic-system.js';

export async function writeArticle(claimText, verificationData, sources = []) {
  console.log(`[Article Writer] Redactando artículo periodístico de verificación...`);

  const prompt = `
Eres el Redactor Jefe de NEWNEWS. Tu tarea es escribir un artículo de verificación formal, de alto impacto y rigor periodístico.
Sigue el Código Deontológico de la FAPE, pero con un enfoque moderno de fact-checking: la información debe ser sumamente atractiva y de gancho inmediato para captar el interés social.

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
1. TÍTULO: Debe ser persuasivo pero riguroso y formal, contrastando la afirmación viral de forma equilibrada y matizada (ej: "España no ha 'traicionado deliberadamente' a su juventud: la presión fiscal, la burocracia y la vivienda requieren matices" o "Los datos sobre burocracia e impuestos para jóvenes en España desmienten el colapso del sistema"). Evita términos sensacionalistas vacíos.
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
 7. ETIQUETAS (tags): Proporciona entre 2 y 4 palabras clave transversales cortas (ej. "vivienda", "paro", "impuestos", "ley", "seguridad-social", "catalunya", "justicia") que describan el tema y los hechos. Deben estar normalizadas (en minúsculas, sin acentos y separadas por guiones en lugar de espacios si tienen varias palabras).

Devuelve un JSON con el formato exacto:
{
  "title": "[Título formal y neutral sin prefijos]",
  "subtitle": "[Subtítulo corto explicativo del veredicto]",
  "summary": "[Resumen ejecutivo del desmentido, explaining the distorsion of the claim]",
  "explanation": "[Cuerpo completo del artículo de verificación, estructurado formalmente en varios párrafos. Detalla la base jurídica y estadística]",
  "trick_used": "cherry-picking" | "falso dilema" | "culpa colectiva" | "dato sin base" | "vídeo recortado" | "autoridad falsa" | "miedo/urgencia" | "promoción encubierta",
  "newnews_score": [Número entre 0 y 100],
  "emoji_tag": "[Etiqueta de la lista]",
  "tags": ["[etiqueta-1]", "[etiqueta-2]"]
}
`;

  try {
    const result = await callGemini(prompt, '08');
    console.log(`[Article Writer] Redacción completada: "${result.title}" (Score: ${result.newnews_score})`);

    // Generar infografía determinista mobile-first de Hermes
    try {
      const infoData = {
        claim: claimText,
        trick_used: result.trick_used,
        why: result.summary,
        sources: sources.slice(0, 3).map(s => `${s.title.split(':')[0].trim()}: ${s.authority_level || 'Oficial'}`),
        what_is_true: verificationData.what_is_true,
        newnews_score: result.newnews_score,
        emoji_tag: result.emoji_tag
      };
      const { svg } = buildInfographic(infoData);
      result.infographic_svg = svg;
    } catch (infErr) {
      console.warn('[Article Writer] Error al generar la infografía local:', infErr);
      result.infographic_svg = `<svg viewBox='0 0 390 205' xmlns='http://www.w3.org/2000/svg'><rect width='390' height='205' fill='rgba(7,9,19,0.45)' rx='8'/><text x='195' y='100' fill='#737373' font-family='sans-serif' font-size='12' text-anchor='middle'>Infografía no disponible</text></svg>`;
    }

    return result;
  } catch (err) {
    console.warn('[Article Writer] Fallo en la redacción con IA. Generando borrador periodístico de fallback.');
    
    const fallbackResult = {
      title: `Contraste de datos sobre: ${claimText.substring(0, 50)}...`,
      subtitle: `Evaluamos la realidad legislativa y los datos oficiales en España ante el debate en redes sociales.`,
      summary: `El análisis del claim revela la necesidad de contextualizar la normativa para evitar malas interpretaciones de la opinión pública.`,
      explanation: `Las afirmaciones publicadas en torno a este tema suelen omitir matices y datos contextuales críticos. La verificación requiere del contraste minucioso de los datos oficiales emitidos por los reguladores correspondientes de la materia.`,
      trick_used: 'dato sin base',
      newnews_score: 55,
      emoji_tag: '🧊 Falta contexto',
      tags: ['contraste', 'datos-oficiales', 'general']
    };

    try {
      const { svg } = buildInfographic({
        claim: claimText,
        trick_used: fallbackResult.trick_used,
        why: fallbackResult.summary,
        sources: sources.slice(0, 3).map(s => `${s.title.split(':')[0].trim()}: ${s.authority_level || 'Oficial'}`),
        what_is_true: verificationData.what_is_true || fallbackResult.summary,
        newnews_score: fallbackResult.newnews_score,
        emoji_tag: fallbackResult.emoji_tag
      });
      fallbackResult.infographic_svg = svg;
    } catch (infErr) {
      fallbackResult.infographic_svg = `<svg viewBox='0 0 390 205' xmlns='http://www.w3.org/2000/svg'><rect width='390' height='205' fill='rgba(7,9,19,0.45)' rx='8'/><text x='195' y='100' fill='#737373' font-family='sans-serif' font-size='12' text-anchor='middle'>Infografía no disponible</text></svg>`;
    }

    return fallbackResult;
  }
}
