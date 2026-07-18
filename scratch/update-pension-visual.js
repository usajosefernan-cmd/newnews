import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const dbPath = process.env.SQLITE_DB_PATH || path.resolve('data/matiza.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

console.log('[Motor en Vivo] Puliendo redacción del artículo de pensiones a formato ultra-visual...');

const slug = 'sistema-público-pensiones-espana-desmentido-privatizacion-obligatoria';

const explanationVisual = `> **Explicado en sencillo:** No, el Gobierno no va a eliminar las pensiones públicas de la Seguridad Social para sustituirlas por planes privados obligatorios. El sistema público sigue totalmente garantizado por ley, y el nuevo fondo estatal es solo una hucha de ahorro voluntaria para quien quiera tener un extra.

En los últimos días se ha difundido en redes el rumor alarmista de que el sistema de pensiones públicas va a desaparecer en España y que será obligatorio contratar planes privados. Esto es **completamente falso** y tergiversa las últimas reformas legislativas.

Lo que debes saber de forma muy clara y sencilla:
* **El sistema público está blindado:** La Constitución Española en su **Artículo 50** establece la obligación del Estado de pagar pensiones públicas y revalorizarlas por ley.
* **Subidas automáticas por el IPC:** Por ley, las pensiones contributivas suben cada año según el **IPC medio** (inflación) para que no pierdas poder de compra.
* **El nuevo plan es voluntario:** La Ley 12/2022 ha creado fondos públicos de empleo simplificados. Son solo una **hucha de ahorro complementaria y opcional** de bajo coste para autónomos y pymes. Nunca sustituirán a tu pensión pública de la Seguridad Social.
* **El Estado respalda los pagos:** Aunque la Seguridad Social tiene tensiones de liquidez por el envejecimiento, el dinero para pagar las nóminas de los pensionistas está garantizado mediante transferencias directas desde los Presupuestos Generales del Estado.`;

db.prepare(`
  UPDATE articles
  SET explanation = ?, updated_at = datetime('now')
  WHERE slug = ?
`).run(explanationVisual, slug);

console.log('[Motor en Vivo] ✓ Redacción optimizada y guardada.');
db.close();
