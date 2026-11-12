// Relais Cloudflare Pages /wc → service WMTS d'ESA WorldCover (https://wmts.terrascope.be/).
//
// Pourquoi un relais : le navigateur doit LIRE les pixels des tuiles (classes d'occupation du sol) pour
// mesurer la couverture végétale des bassins versants, ce qui exige des en-têtes CORS que le service
// n'envoie pas forcément. Servies depuis la même origine que l'application, les tuiles se lisent sans
// restriction. Le relais est volontairement étroit : WMTS seulement, GetCapabilities ou GetTile d'une
// couche WorldCover, paramètres connus seulement — ce n'est pas un proxy ouvert.
//
// Données : ESA WorldCover 2021 v200, © ESA WorldCover project / Contains modified Copernicus Sentinel
// data (2021) processed by ESA WorldCover consortium — licence CC BY 4.0.

const UPSTREAM = 'https://wmts.terrascope.be/';
const ALLOWED = new Set(['service', 'request', 'version', 'layer', 'style', 'tilematrixset', 'tilematrix', 'tilerow', 'tilecol', 'format', 'time']);

export async function onRequestGet({ request }) {
  const inUrl = new URL(request.url);
  const q = new URLSearchParams();
  for (const [k, v] of inUrl.searchParams) {
    const key = k.toLowerCase();
    if (!ALLOWED.has(key)) return text(400, `paramètre non autorisé : ${k}`);
    q.set(key, v);
  }
  if ((q.get('service') || '').toUpperCase() !== 'WMTS') return text(400, 'service=WMTS attendu');
  const req = (q.get('request') || '').toLowerCase();
  if (req !== 'getcapabilities' && req !== 'gettile') return text(400, 'request=GetCapabilities ou GetTile attendu');
  if (req === 'gettile' && !/worldcover/i.test(q.get('layer') || '')) return text(400, 'seules les couches WorldCover sont relayées');

  const url = UPSTREAM + '?' + q.toString();
  // En-têtes strictement ASCII (un caractère accentué empêche la requête de partir).
  const upstream = await fetch(url, {
    headers: { 'User-Agent': 'INFRA-KSR/1.0 (hydrologie routiere; carr.ksr-infra.org)' },
    cf: { cacheEverything: true, cacheTtl: req === 'gettile' ? 30 * 86400 : 86400 },
  });
  const h = new Headers();
  h.set('Content-Type', upstream.headers.get('Content-Type') || (req === 'gettile' ? 'image/png' : 'application/xml'));
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Cache-Control', upstream.ok ? `public, max-age=${req === 'gettile' ? 30 * 86400 : 86400}` : 'no-store');
  return new Response(upstream.body, { status: upstream.status, headers: h });
}

function text(status, msg) {
  return new Response(msg, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
}
