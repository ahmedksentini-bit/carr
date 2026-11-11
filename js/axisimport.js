// axisimport.js — axe en plan (sommets + rayon R + longueur de clothoïde lc) reconstitué depuis une polyligne serrée,
// par exemple une ligne KMZ / KML relevée au GPS ou dessinée dans Google Earth.
// (1) ajusterElements (clofit.js, diagramme des courbures) reconstitue droites, arcs et clothoïdes ;
// (2) chaque « virage » — suite d'éléments courbes de même sens entre deux points de courbure nulle (droite ou point
//     d'inflexion) — devient un sommet : intersection des tangentes d'entrée et de sortie, R = rayon minimal du virage,
//     lc = moyenne des longueurs de clothoïde d'entrée et de sortie (l'axe GIRA a des clothoïdes symétriques) ;
// (3) écart maximal entre l'axe reconstitué (droites, arcs et clothoïdes aux sommets) et les points d'origine.
import { ajusterElements, clothoPoint } from './clofit.js';
import { buildAlignment } from './clotho.js';

const segLen = (g) => (g.type === 'ligne' ? Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]) : g.type === 'arc' ? g.r * Math.abs(g.a1 - g.a0) : g.long);
const kOf = (g) => (g.type === 'ligne' ? [0, 0] : g.type === 'arc' ? [g.sens / g.r, g.sens / g.r] : [g.k0, g.k1]);
function ptOf(g, u) {
  if (g.type === 'ligne') { const L = segLen(g) || 1, t = u / L; return [g.a[0] + (g.b[0] - g.a[0]) * t, g.a[1] + (g.b[1] - g.a[1]) * t]; }
  if (g.type === 'arc') { const a = g.a0 + (g.sens * u) / g.r; return [g.c[0] + g.r * Math.cos(a), g.c[1] + g.r * Math.sin(a)]; }
  return clothoPoint(g, u);
}
const headOf = (g) => (g.type === 'ligne' ? Math.atan2(g.b[1] - g.a[1], g.b[0] - g.a[0]) : g.type === 'arc' ? g.a0 + (g.sens * Math.PI) / 2 : g.theta0);

// Simplification préalable des points trop serrés (pas ≥ 1 m) : ajusterElements reste rapide sur des relevés GPS.
function thin(pts, step = 1) {
  const out = [pts[0]];
  for (const q of pts.slice(1)) { const r = out[out.length - 1]; if (Math.hypot(q[0] - r[0], q[1] - r[1]) >= step) out.push(q); }
  const last = pts[pts.length - 1]; if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/**
 * @param {number[][]} pts points [x, y] dans l'ordre du tracé (coordonnées projetées, m)
 * @returns {{ axis: {x, y, r, lc}[], ecart: number, elements: string[], virages: number }}
 */
export function axisFromPolyline(pts, { minDefl = 0.5 } = {}) {
  const P = thin(pts);
  if (P.length < 3) return { axis: [P[0], P[P.length - 1]].map(([x, y]) => ({ x, y, r: '', lc: '' })), ecart: 0, elements: ['droite'], virages: 0 };
  const fit = ajusterElements(P);
  const segs = fit.segments;
  // nœuds du diagramme des courbures (abscisse, courbure, point, cap) ; inflexion dans une clothoïde : nœud à k = 0
  const nodes = [];
  let s = 0, th = headOf(segs[0]);
  nodes.push({ s, k: kOf(segs[0])[0], p: segs[0].a, th });
  for (const g of segs) {
    const L = segLen(g), [k0, k1] = kOf(g);
    if (k0 * k1 < 0) { const u = (L * Math.abs(k0)) / (Math.abs(k0) + Math.abs(k1)); nodes.push({ s: s + u, k: 0, p: ptOf(g, u), th: th + (k0 / 2) * u }); }
    th += ((k0 + k1) / 2) * L; s += L;
    nodes.push({ s, k: k1, p: g.b, th });
  }
  // virages : suites de nœuds entre deux courbures nulles
  const vir = [];
  let cur = null;
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i], b = nodes[i + 1], curved = Math.abs(a.k) > 1e-9 || Math.abs(b.k) > 1e-9;
    if (curved) { if (!cur) cur = { i0: i, i1: i + 1 }; else cur.i1 = i + 1; if (Math.abs(b.k) < 1e-9) { vir.push(cur); cur = null; } }
    else if (cur) { vir.push(cur); cur = null; }
  }
  if (cur) vir.push(cur);
  const axis = [{ x: P[0][0], y: P[0][1], r: '', lc: '' }];
  let nv = 0;
  for (const v of vir) {
    const A = nodes[v.i0], B = nodes[v.i1], defl = Math.atan2(Math.sin(B.th - A.th), Math.cos(B.th - A.th));
    if (Math.abs(defl) * 180 / Math.PI < minDefl) continue;
    // intersection des tangentes d'entrée (A, θA) et de sortie (B, θB)
    const dA = [Math.cos(A.th), Math.sin(A.th)], dB = [Math.cos(B.th), Math.sin(B.th)], den = dA[0] * dB[1] - dA[1] * dB[0];
    if (Math.abs(den) < 1e-9) continue;
    const t = ((B.p[0] - A.p[0]) * dB[1] - (B.p[1] - A.p[1]) * dB[0]) / den;
    const I = [A.p[0] + dA[0] * t, A.p[1] + dA[1] * t];
    // R et lc : la courbure lissée du diagramme les sous-estime (R) ou les étale (lc) ; on les recale sur les points.
    // Pour une longueur de clothoïde L donnée, R est fixé par la flèche E (distance du sommet au point le plus proche
    // de la courbe) ; L est choisie (section dorée) pour minimiser l'écart quadratique des points au raccordement.
    const ptsV = [];
    for (let k = 0, acc = 0; k < P.length; k++) { if (k) acc += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]); if (acc >= A.s - 30 && acc <= B.s + 30) ptsV.push(P[k]); }
    const segD2 = (q, a, b) => { const ab = [b[0] - a[0], b[1] - a[1]], L2 = ab[0] * ab[0] + ab[1] * ab[1] || 1, u = Math.max(0, Math.min(1, ((q[0] - a[0]) * ab[0] + (q[1] - a[1]) * ab[1]) / L2)); return (q[0] - a[0] - ab[0] * u) ** 2 + (q[1] - a[1] - ab[1] * u) ** 2; };
    let E = Infinity; for (let k = 1; k < ptsV.length; k++) E = Math.min(E, Math.sqrt(segD2(I, ptsV[k - 1], ptsV[k])));
    const d = Math.abs(defl), apex = (R, L) => { const dR = (L * L) / (24 * R); return (R + dR) / Math.cos(d / 2) - R; };
    const Rof = (L) => { let lo = 1, hi = 1e5; for (let it = 0; it < 80; it++) { const m = Math.sqrt(lo * hi); if (apex(m, L) > E) hi = m; else lo = m; } return Math.sqrt(lo * hi); };
    const Dext = Math.hypot(A.p[0] - I[0], A.p[1] - I[1]) + Math.hypot(B.p[0] - I[0], B.p[1] - I[1]) + 50;
    const err = (L) => {
      const R = Rof(L);
      if (L > R * d * 0.98) return Infinity;
      const al = buildAlignment([{ x: I[0] - dA[0] * Dext, y: I[1] - dA[1] * Dext, R: 0, A: 0 }, { x: I[0], y: I[1], R, A: L > 0.5 ? Math.sqrt(L * R) : 0 }, { x: I[0] + dB[0] * Dext, y: I[1] + dB[1] * Dext, R: 0, A: 0 }], {});
      const smp = []; for (const e of al.elems) { const n = Math.max(1, Math.ceil(e.len / 2)); for (let j = 0; j <= n; j++) { const c = e.pointAt((e.len * j) / n); smp.push([c.x, c.y]); } }
      let sum = 0, j0 = 1;
      for (const q of ptsV) { let m = Infinity, jb = j0; for (let j = Math.max(1, j0 - 40); j < smp.length; j++) { const dd = segD2(q, smp[j - 1], smp[j]); if (dd < m) { m = dd; jb = j; } else if (j > jb + 60) break; } j0 = jb; sum += m; }
      return sum / ptsV.length;
    };
    let lo = 0, hi = Math.max(1, Rof(0) * d * 0.95), g = 0.618, x1 = hi - g * (hi - lo), x2 = lo + g * (hi - lo), f1 = err(x1), f2 = err(x2);
    for (let it = 0; it < 22; it++) { if (f1 < f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - g * (hi - lo); f1 = err(x1); } else { lo = x1; x1 = x2; f1 = f2; x2 = lo + g * (hi - lo); f2 = err(x2); } }
    let lc = (lo + hi) / 2; if (err(0) <= Math.min(f1, f2) + 0.0025) lc = 0; // arc seul s'il explique les points à quelques cm près
    const R = Rof(lc);
    axis.push({ x: I[0], y: I[1], r: Math.round(R), lc: lc < 1 ? 0 : Math.round(lc) });
    nv++;
  }
  axis.push({ x: P[P.length - 1][0], y: P[P.length - 1][1], r: '', lc: '' });
  return { axis: axis.map((q) => ({ ...q, x: Math.round(q.x * 1000) / 1000, y: Math.round(q.y * 1000) / 1000 })), ecart: fit.ecartMax, elements: fit.elements, virages: nv };
}

// Lignes (LineString, gx:Track) d'un calque KMZ / KML analysé par parseKML : [{ name, ll: [[lon, lat]…], lenDeg }].
export function kmlLines(parsed) {
  const out = [];
  for (const f of parsed.feats || []) for (const q of f.parts) if (q.t === 'L' && q.c.length >= 4) {
    const ll = []; for (let i = 0; i < q.c.length; i += 2) ll.push([q.c[i], q.c[i + 1]]);
    out.push({ name: f.name || `Ligne ${out.length + 1}`, ll });
  }
  return out;
}
