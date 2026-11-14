// /lic — garde de connexion d'INFRA-KSR (Cloudflare Pages Function).
//
// La version publiée (tools/build.mjs) interroge cette adresse au démarrage puis périodiquement : sans réponse
// valide (hors ligne, copie du site servie ailleurs, sur un poste local ou un autre hébergement), l'application
// s'arrête. Réponse : { a, t, h } avec h = empreinte(t, hôte demandé, sel) ; le sel est aussi dans le code brouillé.
// Pas d'en-tête CORS : une page servie depuis un autre domaine ne peut pas lire cette réponse.
const SALT = '48f7ad28338a16d062592807';
const fnv = (s, seed) => { let h = seed >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); };
const tag = (t, host) => fnv(`${t}|${host}|${SALT}`, 2166136261) + fnv(`${SALT}|${host}|${t}`, 33554467);

export async function onRequestGet({ request }) {
  const host = new URL(request.url).hostname, t = Date.now();
  return new Response(JSON.stringify({ a: 'INFRA-KSR', t, h: tag(t, host) }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}
