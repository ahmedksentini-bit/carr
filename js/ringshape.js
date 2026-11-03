// ringshape.js — forme de l'anneau d'un giratoire non circulaire : carrefour « cacahuète » (deux lobes circulaires
// reliés par des cols concaves) ou giratoire oblong (cols rectilignes).
//
// Référence : Sétra, « Le carrefour “cacahuète”, un nouveau type de giratoire », fiche d'expérience « La Route
// Autrement pour une Conduite Apaisée » (RACA), mai 2010 — RD31 / RD231 (Seine-Maritime) : deux giratoires de rayon
// extérieur Rg = 20 m reliés par un rayon R = 30 m, chaussée annulaire de 7 m, îlot central en « cacahuète »
// introduisant une contrainte de trajectoire. Aménagement expérimental : les règles fondamentales de conception d'un
// giratoire restent à respecter (lisibilité, visibilité, modération des vitesses, déflexion, absence d'obstacles).
//
// Toutes les lignes de l'anneau (bord extérieur de chaussée, rives, bordure et îlot central) sont des courbes
// parallèles à la rive extérieure (ligne Rg) : décalage t (> 0 vers l'extérieur). Lobe k : cercle de centre Ck, de
// rayon Rk + t ; col concave : arc de centre P (extérieur à l'anneau), de rayon Rw − t ; col rectiligne : tangente
// commune décalée de t. Le contour est parcouru dans le sens trigonométrique (sens de circulation sur l'anneau).
import * as G from './geom.js';

const { add, sub, mul, dot, norm, rot90, ang, polar, L, A } = G;
const num = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);

// Paramètres saisis (prj.ring) : shape 'cacahuete', e (entraxe des lobes, m), gis (gisement de l'axe C1 → C2, gon ;
// vide = automatique), Rg2 (rayon du 2e lobe ; vide = Rg), Rwg / Rwd (rayons des cols à gauche / à droite de C1 → C2,
// rive extérieure ; 0 = col rectiligne).
export const isPeanut = (ring) => ring?.shape === 'cacahuete';

export function peanutParams(ring, Rg) {
  return {
    e: num(ring.e, 2.2 * Rg), gis: ring.gis === '' || ring.gis == null || !isFinite(+ring.gis) ? null : +ring.gis,
    R1: Rg, R2: num(ring.Rg2, Rg), Rwg: Math.max(0, num(ring.Rwg, 30)), Rwd: Math.max(0, num(ring.Rwd, 30)),
  };
}

// Direction C1 → C2 par défaut : celle de la paire de branches la plus alignée (route principale), sinon axe x.
export function autoPeanutDir(O, branches) {
  const dirs = branches.filter((b) => b.axis?.length >= 2).map((b) => {
    const far = b.axis.reduce((p, q) => (G.dist(q, O) > G.dist(p, O) ? q : p), b.axis[0]);
    return norm(sub(far, O));
  });
  let best = null, bd = Infinity;
  for (let i = 0; i < dirs.length; i++) for (let j = i + 1; j < dirs.length; j++) {
    const c = dot(dirs[i], dirs[j]);
    if (c < bd) { bd = c; best = [dirs[i], dirs[j]]; }
  }
  if (!best) return { x: 1, y: 0 };
  const d = norm(sub(best[1], best[0]));
  return d.x < -1e-9 || (Math.abs(d.x) < 1e-9 && d.y < 0) ? G.neg(d) : d;
}
// Gisement (gon, depuis le nord, sens horaire) ↔ vecteur.
export const gisToVec = (g) => { const t = (g * Math.PI) / 200; return { x: Math.sin(t), y: Math.cos(t) }; };
export const vecToGis = (v) => G.normAng(Math.atan2(v.x, v.y)) * 200 / Math.PI;

// Construit la forme. O : milieu des centres ; d : direction C1 → C2. Rend { ok, err, C1, C2, lobes, waists, path(t),
// lobeOf(dir), free(k, t) } ou { ok: false, err }.
export function peanutShape(O, d, p) {
  const { e, R1, R2 } = p;
  const C1 = add(O, mul(d, -e / 2)), C2 = add(O, mul(d, e / 2)), nL = rot90(d);
  if (!(R1 > 0 && R2 > 0)) return { ok: false, err: 'rayons des lobes nuls.' };
  if (!(e > Math.abs(R1 - R2) + 0.5)) return { ok: false, err: `entraxe e = ${e} m trop faible : un lobe contient l'autre.` };
  // Col du côté s (+1 : à gauche de C1 → C2, −1 : à droite), de rayon Rw sur la rive extérieure.
  const waist = (s, Rw) => {
    if (!(Rw > 0)) {
      if (!(e > Math.abs(R1 - R2))) return null;
      const ca = (R1 - R2) / e, sa = Math.sqrt(Math.max(0, 1 - ca * ca));
      const n = add(mul(d, ca), mul(nL, s * sa));
      return { kind: 'L', s, n, u1: n, u2: n };
    }
    const r1 = R1 + Rw, r2 = R2 + Rw;
    if (r1 + r2 <= e + 1e-6) return { err: `col de rayon ${Rw} m trop petit pour relier les lobes (R1 + R2 + 2 Rw ≤ e).` };
    // Intersection des cercles (C1, r1) et (C2, r2) du côté s.
    const x = (e * e + r1 * r1 - r2 * r2) / (2 * e), h2 = r1 * r1 - x * x;
    if (h2 <= 0) return { err: 'col impossible.' };
    const P = add(add(C1, mul(d, x)), mul(nL, s * Math.sqrt(h2)));
    return { kind: 'A', s, P, Rw, u1: norm(sub(P, C1)), u2: norm(sub(P, C2)) };
  };
  const Wg = waist(1, p.Rwg), Wd = waist(-1, p.Rwd);
  for (const W of [Wg, Wd]) if (!W || W.err) return { ok: false, err: W?.err || 'col impossible.' };
  // Arcs libres des lobes (sens trigonométrique) : lobe 2 de la tangence du col droit à celle du col gauche,
  // lobe 1 de la tangence du col gauche à celle du col droit.
  const a2 = [ang(Wd.u2), ang(Wg.u2)], a1 = [ang(Wg.u1), ang(Wd.u1)];
  const lobes = [{ k: 1, c: C1, R: R1, a: a1 }, { k: 2, c: C2, R: R2, a: a2 }];
  const sideSeg = (W, t, from, to) => {
    // from / to : { c, R, u } — lobe de départ et d'arrivée (sens de parcours).
    const p0 = add(from.c, mul(from.u, from.R + t)), p1 = add(to.c, mul(to.u, to.R + t));
    if (W.kind === 'L') return L(p0, p1);
    return A(W.P, W.Rw - t, ang(sub(p0, W.P)), ang(sub(p1, W.P)), false);
  };
  const path = (t) => [
    A(C2, R2 + t, a2[0], a2[1], true),
    sideSeg(Wg, t, { c: C2, R: R2, u: Wg.u2 }, { c: C1, R: R1, u: Wg.u1 }),
    A(C1, R1 + t, a1[0], a1[1], true),
    sideSeg(Wd, t, { c: C1, R: R1, u: Wd.u1 }, { c: C2, R: R2, u: Wd.u2 }),
  ];
  // Lobe de rattachement d'une branche (direction depuis O).
  const lobeOf = (dir) => (dot(dir, d) >= 0 ? lobes[1] : lobes[0]);
  const shape = { ok: true, kind: 'cacahuete', O, d, C1, C2, R1, R2, e, lobes, waists: [Wg, Wd], path, lobeOf };
  return shape;
}

// Abscisse curviligne (sur le contour fermé path) du point le plus proche de q ; rend { s, p, i, dist }.
export function projectOnPath(path, q) {
  let best = { s: 0, p: G.segStart(path[0]), dist: Infinity, i: 0 }, acc = 0;
  path.forEach((sg, i) => {
    const l = G.segLen(sg);
    let tl;
    if (sg.t === 'L') { const v = sub(sg.b, sg.a); tl = G.clamp(dot(sub(q, sg.a), v) / (dot(v, v) || 1), 0, 1); }
    else {
      const sw = G.sweep(sg), a = ang(sub(q, sg.c)), rel = sg.ccw ? G.ccwSweep(sg.sa, a) : G.ccwSweep(a, sg.sa);
      tl = rel <= sw ? rel / sw : (rel - sw < G.TAU - rel ? 1 : 0);
    }
    const p = G.segAt(sg, tl), dd = G.dist(p, q);
    if (dd < best.dist) best = { s: acc + tl * l, p, dist: dd, i };
    acc += l;
  });
  return best;
}

// Portion du contour fermé de l'abscisse s0 à s1 (sens de parcours ; s1 < s0 : passage par l'origine).
export function subPath(path, s0, s1) {
  const Lt = G.pathLen(path);
  const span = ((s1 - s0) % Lt + Lt) % Lt;
  const out = [];
  let acc = 0;
  const rot = [...path, ...path];
  for (const sg of rot) {
    const l = G.segLen(sg), a = acc, b = acc + l;
    acc = b;
    const lo = Math.max(a, s0), hi = Math.min(b, s0 + span);
    if (hi - lo > 1e-6) out.push(trimSeg(sg, (lo - a) / l, (hi - a) / l));
    if (acc >= s0 + span) break;
  }
  return out;
}
function trimSeg(sg, t0, t1) {
  if (sg.t === 'L') return L(G.segAt(sg, t0), G.segAt(sg, t1));
  const sw = G.sweep(sg), k = sg.ccw ? 1 : -1;
  return A(sg.c, sg.r, sg.sa + k * sw * t0, sg.sa + k * sw * t1, sg.ccw);
}

// Point de l'abscisse s et normale extérieure (à gauche du parcours trigonométrique : vers l'extérieur de l'anneau).
export function pointNormalAt(path, s) {
  const Lt = G.pathLen(path), x = ((s % Lt) + Lt) % Lt;
  let acc = 0;
  for (const sg of path) {
    const l = G.segLen(sg);
    if (x <= acc + l + 1e-9) {
      const t = l > 0 ? (x - acc) / l : 0, p = G.segAt(sg, t);
      let tg;
      if (sg.t === 'L') tg = norm(sub(sg.b, sg.a));
      else { const r = norm(sub(p, sg.c)); tg = sg.ccw ? rot90(r) : G.neg(rot90(r)); }
      return { p, n: G.neg(rot90(tg)), tg };
    }
    acc += l;
  }
  const sg = path[path.length - 1];
  return { p: G.segEnd(sg), n: { x: 1, y: 0 }, tg: { x: 0, y: 1 } };
}

// Distance signée d'un point à la ligne Rg (positive à l'extérieur de l'anneau).
export function signedOffset(shape, q) {
  const path = shape.path(0), pr = projectOnPath(path, q), pn = pointNormalAt(path, pr.s);
  return { off: dot(sub(q, pr.p), pn.n), s: pr.s, p: pr.p, n: pn.n };
}

// Largeur minimale de l'îlot au droit des cols, à la ligne de décalage t (< 0) : distance entre les deux cols ;
// ≤ 0 : l'îlot est coupé en deux.
export function waistWidth(shape, t) {
  const P = shape.path(t), a = G.samplePath([P[1]], 0.25), b = G.samplePath([P[3]], 0.25);
  let m = Infinity;
  for (const p of a) for (const q of b) m = Math.min(m, G.dist(p, q));
  // Cols qui se croisent : les points du col gauche passent à droite de la droite C1C2 (et inversement).
  const nL = rot90(shape.d), cross = a.some((p) => dot(sub(p, shape.O), nL) < 0) || b.some((p) => dot(sub(p, shape.O), nL) > 0);
  return cross ? -m : m;
}

// Contour fermé échantillonné, pour les remplissages (règle pair-impair) et les profils.
export const closedRing = (shape, t) => shape.path(t);

// Repères le long de la rive Rg (N points équidistants) : { p0, n } — pour les maillages et les talus de l'anneau.
export function ringFrames(shape, N) {
  const path = shape.path(0), Lt = G.pathLen(path), out = [];
  for (let j = 0; j < N; j++) { const q = pointNormalAt(path, (j * Lt) / N); out.push({ p0: q.p, n: q.n }); }
  return out;
}
// Point du profil radial « r » (abscisse du profil type de l'anneau, rayon équivalent d'un anneau circulaire de rayon
// Rg) au repère fr : décalage r − Rg le long de la normale ; à l'intérieur de l'îlot (r < rb), interpolation vers
// l'axe C1C2 pour fermer l'îlot sans croiser les décalages.
export function ringPointAt(shape, fr, r, Rg, rb) {
  if (r >= rb) return add(fr.p0, mul(fr.n, r - Rg));
  const v = sub(shape.C2, shape.C1), tt = G.clamp(dot(sub(fr.p0, shape.C1), v) / dot(v, v), 0, 1), K = add(shape.C1, mul(v, tt));
  const qb = add(fr.p0, mul(fr.n, rb - Rg));
  return G.lerp(K, qb, Math.max(0, r) / Math.max(rb, 1e-6));
}
