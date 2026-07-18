import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/matiza.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

console.log('[Motor en Vivo] Puliendo redacción del artículo de herencias a formato ultra-visual...');

const slugPrefix = 'fiscalidad-herencias-impuesto-sucesiones-exenciones-espana';

// Buscar el slug real que tenga este prefijo en la DB
const row = db.prepare("SELECT slug FROM articles WHERE slug LIKE ?").get(`${slugPrefix}%`);

if (row && row.slug) {
  const realSlug = row.slug;
  const explanationVisual = `> **Explicado en sencillo:** No, el Estado no se queda con tu herencia familiar al fallecer tus padres. En la mayor parte de España, los hijos y cónyuges no pagan casi nada de impuestos por heredar (tienen bonificaciones del 99% al 100%), y la casa familiar está muy protegida por exenciones de hacienda.

El debate sobre el coste de las herencias es recurrente en redes, donde se difunde la idea de que el Impuesto de Sucesiones obliga a perder el patrimonio. Esto es **falso** para la inmensa mayoría de las familias trabajadoras.

Lo que debes saber de forma clara y directa:
* **Exención casi total en la cuota:** Comunidades como **Madrid, Andalucía, C. Valenciana, Baleares, Murcia, Cantabria o Canarias** aplican bonificaciones de entre el **99% y el 100%**. Un hijo o cónyuge solo paga una cantidad simbólica de impuestos por heredar.
* **La casa familiar está muy protegida:** Tanto a nivel estatal como de CCAA, existe una reducción de entre el **95% y el 99%** de la base imponible del impuesto sobre el valor de la vivienda habitual. No hay que vender la casa para pagar.
* **Mitos sobre las renuncias:** Es cierto que hay personas que renuncian a herencias (un 10-15% al año), pero la causa principal **no es el impuesto**, sino la existencia de **deudas previas del fallecido** que superan al valor de los bienes.
* **¿Cuándo hereda el Estado?:** Únicamente cuando una persona fallece sin testamento y **no tiene ningún familiar vivo** hasta el cuarto grado (hijos, padres, hermanos, tíos, primos, sobrinos). Solo en ese caso excepcional, por ley, hereda el Estado o la CCAA, destinando 2/3 a beneficencia.`;

  db.prepare(`
    UPDATE articles
    SET explanation = ?, updated_at = datetime('now')
    WHERE slug = ?
  `).run(explanationVisual, realSlug);

  console.log(`[Motor en Vivo] ✓ Redacción optimizada y guardada para slug: ${realSlug}`);
} else {
  console.log('[Motor en Vivo] ❌ No se encontró ningún artículo de herencias.');
}

db.close();
