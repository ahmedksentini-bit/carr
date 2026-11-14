// remote.js — accès au moteur hydrologique et hydraulique (js/hydro/engine.js), exécuté sur le serveur
// (POST /api/hydro). Le navigateur ne reçoit que les résultats : le code des méthodes et les tables ne sont pas publiés.
// En développement (racine du dépôt servie sans fonctions Cloudflare), le moteur est chargé localement ; dans la
// version publiée il n'existe que sur le serveur, une copie du site n'a donc pas de moteur.
//
// Les listes (stations, régressions, options, têtes d'ouvrage) sont lues une fois au démarrage (ready()). Les petites
// lectures appelées pendant l'affichage (régressions CIEH proposées, stations Montana) sont mises en cache : premier
// appel → valeur vide et requête lancée, puis onUpdate() redessine quand la réponse arrive.
let local = null; // moteur chargé localement (développement)
const revive = (k, v) => (v === '+Inf' ? Infinity : v === '-Inf' ? -Infinity : v);
async function call(op, args = {}) {
  if (!local) {
    let r = null;
    try { r = await fetch('/api/hydro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, args }), cache: 'no-store' }); } catch { r = null; }
    if (r && ![404, 405, 501].includes(r.status)) {
      let j; try { j = JSON.parse(await r.text(), revive); } catch { throw new Error(`serveur de calcul indisponible (${r.status})`); }
      if (!j.ok) throw new Error(j.error || 'erreur du serveur de calcul');
      return j.data;
    }
    // pas de serveur de calcul (développement, racine du dépôt servie telle quelle) : moteur local
    try { local = await import('./engine.js'); } catch { throw new Error('serveur de calcul INFRA-KSR injoignable : vérifiez la connexion'); }
  }
  return local.handle(op, args);
}

let META = null;
// listes vides tant que le serveur n'a pas répondu (l'affichage ne doit pas casser)
export let TC_FORMULAS = [], OPTION_LISTS = new Proxy({}, { get: () => [] }), FRANCOU_RODIER_REGIONS = [], KR10_GEOLOGY_CATEGORIES = [];
let onUpdate = () => {};
export function setOnUpdate(fn) { onUpdate = fn || (() => {}); }
export async function ready() {
  META = await call('meta');
  ({ TC_FORMULAS, OPTION_LISTS, FRANCOU_RODIER_REGIONS, KR10_GEOLOGY_CATEGORIES } = META);
  return META;
}
const clone = (o) => JSON.parse(JSON.stringify(o));
export const listMontanaStations = () => META?.stations || { tunisie: [], afrique: [] };
export const listCiehRegressions = () => META?.ciehList || [];
export const defaultHypotheses = (set = 'tunisie') => clone(META?.defaults?.[set === 'fao54' ? 'fao54' : 'tunisie'] || {});
const shapeOf = (s) => (/circ|buse|pipe/i.test(String(s)) ? 'circular' : 'box');
export const inletsForShape = (s) => META?.inlets?.[shapeOf(s)] || [];
export const defaultInletFor = (s) => META?.defaultInlet?.[shapeOf(s)];
export const chartLabel = (c) => `abaque ${c.chart}, échelle ${c.scaleLabel && c.scaleLabel.length > 0 ? c.scaleLabel : String(c.scale)}`;
export const controlLabel = (c) => (c === 'inlet' ? "Contrôle à l'entrée" : 'Contrôle par l\'aval (sortie)');
// pente de radier « au-dessus de la pente critique » : critique arrondie au 0,1 % supérieur
export const slopeAboveCritical = (p) => (p > 0 ? Math.round(Math.ceil(p / 0.1 - 1e-9) * 0.1 * 1000) / 1000 : 0);

// Lectures mises en cache (affichage synchrone).
const cache = new Map(), pending = new Set();
function cached(op, args, empty) {
  const k = op + JSON.stringify(args);
  if (cache.has(k)) return cache.get(k);
  if (!pending.has(k)) { pending.add(k); call(op, args).then((v) => { cache.set(k, v); pending.delete(k); onUpdate(); }, () => { cache.set(k, empty); pending.delete(k); }); }
  return empty;
}
export const suggestCiehRegressions = (a) => cached('suggestCieh', a, []);
export const resolveMontanaStation = (code, T) => cached('montana', { code, T }, null);
export const montanaAfricaIdf = (a) => cached('montanaAfrica', a, null);
// Calculs (asynchrones).
export const suggestCiehAsync = (a) => call('suggestCieh', a);
export const computeAll = (basins, hyp) => call('computeAll', { basins, hyp });
export const culverts = (jobs) => call('culverts', { jobs });
