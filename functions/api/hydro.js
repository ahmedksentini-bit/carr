// /api/hydro — moteur hydrologique et hydraulique exécuté sur le serveur (js/hydro/engine.js, non publié dans le site).
// Requête POST { op, args } ; réponse { ok, data } ou { ok: false, error }. Pas d'en-tête CORS (une page d'un autre
// domaine ne peut pas lire la réponse) ; requêtes d'un autre site refusées (Origin / Referer).
import { handle } from '../../js/hydro/engine.js';

const json = (status, o) => new Response(JSON.stringify(o, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? (Number.isNaN(v) ? null : v > 0 ? '+Inf' : '-Inf') : v)), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
const allowed = (u) => { try { const h = new URL(u).hostname; return h === 'ksr-infra.org' || h.endsWith('.ksr-infra.org') || h.endsWith('.pages.dev') || h === 'localhost' || h === '127.0.0.1'; } catch { return false; } };

export async function onRequestPost({ request }) {
  const src = request.headers.get('Origin') || request.headers.get('Referer') || '';
  if (!allowed(src)) return json(403, { ok: false, error: 'origine non autorisée' });
  let body; try { body = await request.json(); } catch { return json(400, { ok: false, error: 'requête illisible' }); }
  try { return json(200, { ok: true, data: handle(body.op, body.args || {}) }); }
  catch (e) { return json(400, { ok: false, error: e.message }); }
}
