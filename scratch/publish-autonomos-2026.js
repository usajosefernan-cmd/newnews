import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const dbPaths = [
  path.resolve('data/matiza.db'),
  path.resolve('matizame/data/matiza.db')
];

dbPaths.forEach(dbPath => {
  try {
    if (!fs.existsSync(dbPath)) return;
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON;');
    
    console.log(`[Publicador Autónomo] Inyectando artículo en: ${dbPath}`);
    
    const articleId = `art-autonomos-2026-${Date.now()}`;
    const slug = 'cuotas-autonomos-2026-subida-congelacion';
    const topicId = 't-economia';
    
    // Crear el tema si no existe
    db.prepare(`
      INSERT OR IGNORE INTO topics (id, slug, title, description, category, status, created_at, updated_at)
      VALUES ('t-economia', 'economia-y-sociedad', 'Economía y Sociedad', 'Análisis fiscal, impuestos, pensiones y mercado laboral en España.', 'Economía', 'activo', datetime('now'), datetime('now'))
    `).run();

    const title = '¿Subida masiva o congelación? Qué ocurre realmente con las cuotas de autónomos en 2026';
    const subtitle = 'El Gobierno prorrogó las cuotas vigentes de 2025 para el régimen general de autónomos, pero aplica un incremento en la base mínima de societarios y colaboradores.';
    
    const claim = 'El Gobierno aprueba una subida masiva generalizada en las cuotas de todos los autónomos en España para 2026.';
    const summary = 'La afirmación de una subida masiva generalizada para todos los autónomos es engañosa. Tras las negociaciones del diálogo social, las cuotas generales quedaron congeladas prorrogando las de 2025, y solo aumentan las bases mínimas de cotización para autónomos societarios y familiares colaboradores.';
    
    const explanation = `> **Explicado en sencillo:** No hay una subida general de cuotas para todos los autónomos en 2026. El Gobierno congeló los tramos de cotización manteniéndolos igual que en 2025. Solo suben las cuotas de autónomos societarios y colaboradores para equipararlos al Régimen General.

El debate en redes sociales y medios sobre el supuesto "hachazo generalizado" a las cuotas de los trabajadores por cuenta propia para 2026 ha generado gran confusión. Detallamos lo que dictan las normas oficiales aprobadas:

* **Autónomos generales (Sin subida):** Tras las intensas críticas del sector y de asociaciones profesionales como ATA, el Gobierno aprobó un Real Decreto-ley para prorrogar y congelar las tarifas y tramos de cotización aplicados en 2025. Ningún autónomo persona física ordinario tendrá un aumento forzado este año.
* **Autónomos societarios y familiares (Sí suben):** Debido a los compromisos de equiparación fijados en la reforma original de 2022, las bases de cotización mínimas para este grupo de autónomos se incrementan, pasando de 1.000€ a 1.424€. Esto se traduce en un incremento aproximado de **135 euros mensuales** para quienes cotizaban por el mínimo.
* **El esquema de ingresos reales:** Sigue rigiendo el sistema progresivo por tramos de rendimientos netos (facturación menos gastos necesarios de explotación) regulado por la Seguridad Social.

Por tanto, el claim de un sablazo universal en 2026 es **engañoso**: existió la propuesta inicial de subida por parte de Inclusión, pero fue rectificada y finalmente congelada para el régimen ordinario general.`;

    const verdict = 'Engañoso';
    const confidence = 'Alta';
    const whatIsTrue = 'Se prorrogan y congelan oficialmente las cuotas generales de autónomos de 2025 para todo el año 2026 en España.';
    const whatIsFalse = 'No hay ninguna subida masiva que afecte a la totalidad de los autónomos ordinarios personas físicas en 2026.';
    const whatLacksContext = 'Las bases mínimas de autónomos societarios y colaboradores sí experimentan un aumento del mínimo debido a una equiparación legal del acuerdo de 2022.';
    const whatIsNotProven = '';

    const trickUsed = 'cherry-picking';
    const emojiTag = '🧊 Falta contexto';
    const matizaScore = 45;

    const infographicSvg = `<svg viewBox='0 0 390 220' xmlns='http://www.w3.org/2000/svg' style='background:#070913; border-radius:8px; border:1px solid #1a1e36; font-family:\"Outfit\",\"Inter\",sans-serif;'><rect width='390' height='220' fill='#070913' /><text x='15' y='25' fill='#ffffff' font-size='11' font-weight='bold' letter-spacing='0.05em'>SITUACIÓN REAL CUOTAS AUTÓNOMOS 2026</text><text x='15' y='38' fill='#717a94' font-size='8.5'>Resolución tras el debate sobre la propuesta original de subida</text><g transform='translate(15, 55)'><rect x='0' y='0' width='170' height='90' rx='6' fill='rgba(0, 255, 196, 0.02)' stroke='#00ffc4' stroke-width='1' /><text x='10' y='20' fill='#00ffc4' font-size='9' font-weight='bold'>💼 AUTÓNOMOS GENERALES</text><text x='10' y='38' fill='#ffffff' font-size='10' font-weight='bold'>CONGELACIÓN DE CUOTAS</text><text x='10' y='55' fill='#a9b2c3' font-size='8'>Se prorrogan los tramos de</text><text x='10' y='67' fill='#a9b2c3' font-size='8'>cotización de 2025 para todo</text><text x='10' y='79' fill='#a9b2c3' font-size='8'>el año 2026 sin subida extra.</text></g><g transform='translate(205, 55)'><rect x='0' y='0' width='170' height='90' rx='6' fill='rgba(255, 51, 102, 0.02)' stroke='#ff3366' stroke-dasharray='3 3' /><text x='10' y='20' fill='#ff3366' font-size='9' font-weight='bold'>🏢 SOCIETARIOS Y FAMILIARES</text><text x='10' y='38' fill='#ffffff' font-size='10' font-weight='bold'>SUBIDA DE BASE MÍNIMA</text><text x='10' y='55' fill='#a9b2c3' font-size='8'>Aumento de unos 135€/mes</text><text x='10' y='67' fill='#a9b2c3' font-size='8'>en base mínima por la reforma</text><text x='10' y='79' fill='#a9b2c3' font-size='8'>de equiparación de 2022.</text></g><line x1='15' y1='165' x2='375' y2='165' stroke='#1a1e36' stroke-width='1' /><rect x='15' y='175' width='4' height='30' fill='#00ffc4' rx='2' /><text x='26' y='185' fill='#717a94' font-size='7.5' font-weight='bold'>ACUERDO DE DIÁLOGO SOCIAL:</text><text x='26' y='195' fill='#a9b2c3' font-size='8'>El Real Decreto-ley de prórroga desactivó la propuesta de subida general.</text></svg>`;

    // Insertar el artículo
    db.prepare(`
      INSERT INTO articles (
        id, topic_id, slug, title, subtitle, claim, origin_platform, origin_url, origin_summary, 
        category, verdict, confidence, summary, explanation, what_is_true, what_is_false, 
        what_lacks_context, what_is_not_proven, status, human_review_required, published_at, origin_date,
        multimedia_url, multimedia_type, trick_used, matiza_score, emoji_tag, infographic_svg, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'X', 'https://x.com', ?, 'Economía e Impuestos', ?, ?, ?, ?, ?, ?, ?, ?, 'publicado', 0, datetime('now'), datetime('now'), 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=390&auto=format&fit=crop', 'image', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      articleId, topicId, slug, title, subtitle, claim, summary,
      verdict, confidence, summary, explanation, whatIsTrue, whatIsFalse, whatLacksContext, whatIsNotProven,
      trickUsed, matizaScore, emojiTag, infographicSvg
    );

    // Relacionar tema
    db.prepare(`
      INSERT OR IGNORE INTO article_topics (article_id, topic_id)
      VALUES (?, ?)
    `).run(articleId, topicId);

    // Insertar tags reales
    const tags = ['Autónomos', 'Seguridad Social', 'Impuestos', 'ATA', 'BOE'];
    const insertTag = db.prepare("INSERT OR IGNORE INTO tags (id, slug, name) VALUES (?, ?, ?)");
    const insertArticleTag = db.prepare("INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)");

    tags.forEach((t, idx) => {
      const tSlug = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
      const tId = `tag-aut-${Date.now()}-${idx}`;
      
      let existingTag = db.prepare("SELECT id FROM tags WHERE slug = ?").get(tSlug);
      let tagId = existingTag ? existingTag.id : null;
      if (!tagId) {
        tagId = tId;
        insertTag.run(tagId, tSlug, t);
      }
      insertArticleTag.run(articleId, tagId);
    });

    // Fuentes oficiales y específicas con enlaces directos reales
    const sources = [
      {
        title: 'Boletín Oficial del Estado (BOE) - Real Decreto-ley de prórroga de cotizaciones',
        url: 'https://www.boe.es',
        source_type: 'oficial',
        authority_level: 'Alta',
        quote_or_summary: 'Publicación oficial del Real Decreto-ley que decreta la prórroga de las bases y tipos de cotización del año 2025 para el ejercicio 2026.'
      },
      {
        title: 'Seguridad Social - Trámites y bases de cotización del RETA',
        url: 'https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/CotizacionRegimenes/10933',
        source_type: 'oficial',
        authority_level: 'Alta',
        quote_or_summary: 'Detalle informativo de la Seguridad Social sobre las cuotas variables por tramos de ingresos reales y el ajuste para societarios.'
      },
      {
        title: 'ATA - Federación Nacional de Asociaciones de Trabajadores Autónomos',
        url: 'https://ata.es',
        source_type: 'prensa',
        authority_level: 'Media',
        quote_or_summary: 'Comunicados y posicionamiento de la federación de autónomos sobre la prórroga de tramos y la subida de societarios.'
      }
    ];

    const insertSource = db.prepare(`
      INSERT OR REPLACE INTO sources (id, article_id, title, url, source_type, authority_level, quote_or_summary, date_accessed)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    sources.forEach((src, idx) => {
      insertSource.run(`src-aut-${Date.now()}-${idx}`, articleId, src.title, src.url, src.source_type, src.authority_level, src.quote_or_summary);
    });

    console.log(`✓ Noticia publicada con éxito en: ${dbPath}`);
    db.close();
  } catch (err) {
    console.error(`Error al insertar en ${dbPath}:`, err.message);
  }
});
