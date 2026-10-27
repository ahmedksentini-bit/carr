// swept.js — épure de giration d'un véhicule articulé (tracteur + semi-remorque). Le milieu de l'essieu avant suit une
// trajectoire guide ; l'essieu arrière du tracteur suit sa tractrice, le pivot (sellette) est porté par le tracteur et
// l'essieu de la remorque suit la tractrice du pivot (modèle cinématique à basse vitesse, sans glissement).
// La surface balayée est bornée par la trace du coin avant extérieur du tracteur et par celle du flanc intérieur de la
// remorque au droit de son essieu.
import * as G from './geom.js';

const { add, sub, mul, norm, rot90, L } = G;

// Semi-remorque européen de 16,50 m (directive 96/53/CE : pivot – arrière ≤ 12,00 m, largeur 2,55 m).
// fo : porte-à-faux avant ; wb1 : empattement du tracteur ; kp : sellette en avant de l'essieu moteur ;
// wb2 : pivot – essieu (milieu du tridem) ; tf : pivot – avant de la remorque ; tr : essieu – arrière de la remorque.
export const SEMI = { label: 'semi-remorque 16,50 m', w: 2.55, fo: 1.2, wb1: 3.8, kp: 0.5, rr: 0.8, wb2: 7.8, tf: 1.6, tr: 4.2 };

// guide : chemin (segments) suivi par le milieu de l'essieu avant, commençant et finissant en alignement droit.
// turn : +1 tourne-à-gauche, −1 tourne-à-droite. Retourne { outer, inner, poly, poses }.
export function sweep(guide, turn, V = SEMI) {
  const P = G.samplePath(guide, 0.2);
  if (P.length < 3) return null;
  const d0 = norm(sub(P[1], P[0]));
  let R = sub(P[0], mul(d0, V.wb1));
  let T = sub(add(R, mul(d0, V.kp)), mul(d0, V.wb2));
  const outer = [], inner = [], states = [];
  const sOut = -turn, sIn = turn; // côté extérieur / intérieur du virage (gauche = +1)
  for (const F of P) {
    const dt = sub(F, R), lt = Math.hypot(dt.x, dt.y);
    if (lt > 1e-9) R = sub(F, mul(dt, V.wb1 / lt));
    const ut = norm(sub(F, R)), K = add(R, mul(ut, V.kp));
    const dr = sub(K, T), lr = Math.hypot(dr.x, dr.y);
    if (lr > 1e-9) T = sub(K, mul(dr, V.wb2 / lr));
    const ur = norm(sub(K, T)), nt = rot90(ut), nr = rot90(ur);
    outer.push(add(add(F, mul(ut, V.fo)), mul(nt, (sOut * V.w) / 2)));
    inner.push(add(T, mul(nr, (sIn * V.w) / 2)));
    states.push({ F, R, K, T, ut, ur });
  }
  // Contour du véhicule (tracteur et remorque) dans une position donnée.
  const body = ({ F, R, K, T, ut, ur }) => {
    const rect = (front, back, u) => {
      const n = mul(rot90(u), V.w / 2);
      return [add(front, n), sub(front, n), sub(back, n), add(back, n)];
    };
    return [rect(add(F, mul(ut, V.fo)), sub(R, mul(ut, V.rr)), ut), rect(add(K, mul(ur, V.tf)), sub(T, mul(ur, V.tr)), ur)];
  };
  const poses = [0.42, 0.6, 0.78].map((f) => body(states[Math.min(states.length - 1, Math.round(f * (states.length - 1)))]));
  const dec = (a) => a.filter((_, i) => i % 2 === 0 || i === a.length - 1); // contour allégé pour les tests
  return { outer, inner, poly: [...dec(outer), ...dec(inner).reverse()], poses };
}

const inPoly = (p, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};

// Points des chemins (bordures, îlots) situés dans la surface balayée, avec leur profondeur (distance au bord de la
// surface) : c'est l'empiètement du véhicule au-delà de la bordure. On ne garde que ceux qui dépassent `tol`.
export function conflicts(poly, paths, tol = 0) {
  const bb = poly.reduce((m, p) => ({ x0: Math.min(m.x0, p.x), x1: Math.max(m.x1, p.x), y0: Math.min(m.y0, p.y), y1: Math.max(m.y1, p.y) }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });
  const hits = [];
  for (const path of paths) {
    for (const p of G.samplePath(path, 0.4)) {
      if (p.x < bb.x0 || p.x > bb.x1 || p.y < bb.y0 || p.y > bb.y1 || !inPoly(p, poly)) continue;
      let depth = Infinity;
      for (let i = 0; i < poly.length; i++) depth = Math.min(depth, G.distToSeg(p, poly[i], poly[(i + 1) % poly.length]));
      if (depth > tol) hits.push({ p, depth });
    }
  }
  return hits;
}

// Chemin (segments) d'une polyligne de points.
export const polyPath = (pts) => pts.slice(1).map((p, i) => L(pts[i], p));
