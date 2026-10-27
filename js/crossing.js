// crossing.js — passages piétons des carrefours urbains et aménagements PMR.
// Marquage (IISR, 7e partie, art. 113) : bandes de 0,50 m parallèles à l'axe de la chaussée, espacées de 0,50 à
// 0,80 m, largeur du passage 2,50 m au minimum. Traversée de l'îlot séparateur à niveau (refuge), îlot coupé.
// PMR (arrêté du 15 janvier 2007, NF P98-351) : abaissé de trottoir (ressaut ≤ 2 cm, pente ≤ 5 %, tolérée à 8 %
// sur 2 m), bande d'éveil de vigilance de 0,42 m posée à 0,50 m du nez de la bordure, sur la largeur du passage.
// Tout est construit dans un repère local (x le long de la voie, y en travers), puis reporté par W.
import * as G from './geom.js';

const { add, mul, L } = G;
export const PP = { band: 0.5, gap: 0.6, bev: 0.42, bevOff: 0.5 };

// Point où un chemin local coupe la droite x = xc (le plus proche de l'axe), avec la tangente du chemin.
export function cutAtX(segs, xc) {
  const sp = G.samplePath(segs, 0.2);
  let best = null;
  for (let i = 0; i + 1 < sp.length; i++) {
    const p = sp[i], q = sp[i + 1];
    if ((p.x - xc) * (q.x - xc) > 0 || p.x === q.x) continue;
    const y = p.y + ((xc - p.x) / (q.x - p.x)) * (q.y - p.y);
    if (!best || Math.abs(y) < Math.abs(best.y)) best = { y, t: G.norm(G.sub(q, p)) };
  }
  return best;
}

// Polygone (points) découpé par le demi-plan x ≤ c (keep < 0) ou x ≥ c (keep > 0) — Sutherland-Hodgman.
function clipX(poly, c, keep) {
  const inside = (p) => (keep < 0 ? p.x <= c : p.x >= c);
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    if (inside(p)) out.push(p);
    if (inside(p) !== inside(q)) out.push(G.lerp(p, q, (c - p.x) / (q.x - p.x)));
  }
  return out.length >= 3 && Math.abs(G.polyArea(out)) > 0.05 ? out : null;
}

// Étendue en y d'un polygone sur la bande x ∈ [x1, x2] ; null s'il n'y touche pas.
function yRange(poly, x1, x2) {
  const pts = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    if (p.x >= x1 && p.x <= x2) pts.push(p);
    for (const c of [x1, x2]) if ((p.x - c) * (q.x - c) < 0) pts.push(G.lerp(p, q, (c - p.x) / (q.x - p.x)));
  }
  return pts.length ? [Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.y))] : null;
}

// Passage piéton local de largeur w centré en x = xc, entre les bords de chaussée y = lo.y < hi.y
// (lo, hi : { y, t } de cutAtX). islands : polygones locaux en saillie (coupés au droit du passage) ;
// painted : polygones peints (le marquage s'interrompt dessus). Retourne { stripes, pieces (par îlot : parties
// restantes, ou null s'il n'est pas touché), painted (étendue en y de chaque zone peinte sur le passage), ends, x1, x2 }.
export function crossing(xc, w, lo, hi, { islands = [], painted = [] } = {}) {
  const x1 = xc - w / 2, x2 = xc + w / 2;
  const pieces = islands.map((poly) => (yRange(poly, x1, x2) ? [clipX(poly, x1, -1), clipX(poly, x2, 1)].filter(Boolean) : null));
  const holes = [...islands, ...painted].map((poly) => yRange(poly, x1, x2)).filter(Boolean);
  const span = hi.y - lo.y, n = Math.max(1, Math.floor((span + PP.gap) / (PP.band + PP.gap)));
  const y0 = lo.y + (span - (n * PP.band + (n - 1) * PP.gap)) / 2 + PP.band / 2;
  const stripes = [];
  for (let k = 0; k < n; k++) {
    const y = y0 + k * (PP.band + PP.gap);
    if (holes.some(([a, b]) => y > a - PP.band && y < b + PP.band)) continue;
    stripes.push([{ x: x1, y }, { x: x2, y }]);
  }
  // Extrémités sur les bords de chaussée : tangente au bord, normale vers le trottoir.
  const end = (e, s) => {
    let m = G.rot90(e.t);
    if (m.y * s < 0) m = G.neg(m);
    return { E: { x: xc, y: e.y }, t: e.t, m };
  };
  return { stripes, pieces, painted: painted.map((poly) => yRange(poly, x1, x2)), ends: [end(lo, -1), end(hi, 1)], x1, x2, w };
}

// Primitives monde d'un passage : bandes (MARQUAGE), abaissés de trottoir et BEV (PMR) aux extrémités.
// sec : paramètres du profil (caniveau, bordureVue, trottoir) ; pmr : dessiner les aménagements PMR.
export function crossingPrims(cr, W, sec, pmr) {
  const out = [];
  for (const [p, q] of cr.stripes) out.push({ k: 'path', L: 'MARQUAGE', segs: [L(W(p), W(q))], wm: PP.band });
  if (!pmr) return out;
  const nose = sec.caniveau || 0;
  // Profondeur du plan incliné à travers le trottoir : 8 % pour rattraper la vue de bordure (ressaut 2 cm),
  // en laissant 0,80 m de cheminement à plat derrière.
  const p = Math.max(0.5, Math.min((Math.max(0.02, sec.bordureVue) - 0.02) / 0.08, (sec.trottoir || 2) + (sec.bordure || 0) - 0.8));
  for (const { E, t, m } of cr.ends) {
    const at = (s, d) => W(add(add(E, mul(t, s)), mul(m, d)));
    const h = cr.w / 2, lr = p; // évasements latéraux à 45°
    out.push({ k: 'path', L: 'PMR', segs: [L(at(-h - lr, nose), at(-h, nose + p)), L(at(-h, nose + p), at(h, nose + p)), L(at(h, nose + p), at(h + lr, nose))] });
    const bev = [at(-h, nose + PP.bevOff), at(h, nose + PP.bevOff), at(h, nose + PP.bevOff + PP.bev), at(-h, nose + PP.bevOff + PP.bev)];
    out.push({ k: 'path', L: 'PMR', segs: bev.map((a, i) => L(a, bev[(i + 1) % 4])) });
    out.push({ k: 'hatch', L: 'PMR', lines: G.hatchPolygon(bev, G.ang(t) + Math.PI / 2, 0.1), wm: 0.03 });
  }
  return out;
}

// Polygone local d'un contour (chemin) : points échantillonnés.
export const polyOf = (segs) => G.samplePath(segs, 0.25);
// Contour fermé (segments) d'un polygone de points.
export const closedSegs = (pts) => pts.map((p, i) => L(p, pts[(i + 1) % pts.length]));
