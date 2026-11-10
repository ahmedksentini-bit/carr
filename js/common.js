// common.js — outils partagés par les constructions de carrefours (giratoire, T, X).
import * as G from './geom.js';

const { add, sub, mul, dot, norm, rot90 } = G;

export const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '—');
export const toGon = (rad) => G.normAng(Math.PI / 2 - rad) * 200 / Math.PI; // gisement depuis le Nord, sens horaire
export const toDegGis = (rad) => G.normAng(Math.PI / 2 - rad) * 180 / Math.PI;
export const fmtGis = (rad, unit) => (unit === 'deg' ? fmt(toDegGis(rad), 2) + '°' : fmt(toGon(rad), 3) + ' gr');
export const upright = (r) => { r = G.normAng(r); return r > Math.PI / 2 && r <= 1.5 * Math.PI ? r - Math.PI : r; };

// Abords d'un bord de chaussée S parcouru terre à droite : surface du trottoir, limites des bandes
// (caniveau, bordure, trottoir, contre-bordure / berme) et fermetures aux extrémités.
export function sideBandPrims(S, bands, layer, wAt = null) {
  // wAt(p, nom, largeur) : largeur de la bande au point p du bord (branche d'un profil différent de celui du carrefour) ;
  // les bandes sont alors décalées d'une distance variable (cumul des largeurs au point du bord).
  const off = (k) => (wAt ? G.offsetPathVar(S, (p) => -bands.slice(0, k).reduce((a, [nm, w]) => a + wAt(p, nm, w), 0), wAt.step || 1) : G.offsetPath(S, -bands.slice(0, k).reduce((a, [, w]) => a + w, 0)));
  const out = [];
  let d = 0;
  bands.forEach(([nm, w], k) => {
    if (nm === 'trottoir') {
      const a = off(k), b = off(k + 1);
      if (a.length && b.length) {
        out.push({ k: 'fill', L: 'TROTTOIR', role: 'trottoir', rings: [[...a, G.L(G.segEnd(a[a.length - 1]), G.segEnd(b[b.length - 1])), ...G.revPath(b), G.L(G.segStart(b[0]), G.segStart(a[0]))]] });
      }
    }
    d += w;
    const o = off(k + 1);
    if (o.length) out.push({ k: 'path', L: layer, segs: o });
  });
  if (d > 0) {
    const o = off(bands.length);
    if (o.length) out.push({ k: 'path', L: 'LIMITE', segs: [G.L(G.segStart(S[0]), G.segStart(o[0])), G.L(G.segEnd(S[S.length - 1]), G.segEnd(o[o.length - 1]))] });
  }
  return out;
}

// Abscisses des appuis d'une travure (culée, piles, culée) par rapport au point fixe de l'ouvrage : nombre pair de
// travées → l'appui du milieu (pile centrale) reste sur le point fixe ; impair → la travée du milieu y est centrée.
// Les autres appuis s'en déduisent de proche en proche : changer une travée ne déplace que les appuis situés au-delà
// d'elle, vers l'extérieur, au lieu d'élargir l'ouvrage des deux côtés.
export function spanSupports(spans) {
  const n = spans.length, pos = new Array(n + 1).fill(0);
  if (!n) return [0];
  let c;
  if (n % 2 === 0) { c = n / 2; pos[c] = 0; }
  else { const m = (n - 1) / 2; pos[m] = -spans[m] / 2; pos[m + 1] = spans[m] / 2; c = m; }
  for (let i = c - 1; i >= 0; i--) pos[i] = pos[i + 1] - spans[i];
  for (let i = (n % 2 === 0 ? c : c + 1) + 1; i <= n; i++) pos[i] = pos[i - 1] + spans[i - 1];
  return pos;
}

// Oriente une polyligne de l'extrémité la plus proche de O vers la plus éloignée.
export function nearFar(axis, O) {
  return G.dist(axis[0], O) <= G.dist(axis[axis.length - 1], O) ? axis : axis.slice().reverse();
}

// Centre automatique : point le plus proche, au sens des moindres carrés, des axes saisis
// (droite portée par le segment de chaque axe le plus proche du centre).
export function autoCenter(branches) {
  const ax = branches.filter((b) => b.axis && b.axis.length >= 2);
  if (!ax.length) return null;
  if (ax.length === 1) return { ...ax[0].axis[ax[0].axis.length - 1] };
  let O = { x: 0, y: 0 }, k = 0;
  for (const b of ax) for (const p of [b.axis[0], b.axis[b.axis.length - 1]]) { O.x += p.x; O.y += p.y; k++; }
  O = { x: O.x / k, y: O.y / k };
  for (let it = 0; it < 6; it++) {
    let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
    const ends = [];
    for (const b of ax) {
      const pl = nearFar(b.axis, O), p = pl[0], d = norm(sub(pl[1], pl[0]));
      ends.push(p);
      const m11 = 1 - d.x * d.x, m12 = -d.x * d.y, m22 = 1 - d.y * d.y;
      a11 += m11; a12 += m12; a22 += m22; b1 += m11 * p.x + m12 * p.y; b2 += m12 * p.x + m22 * p.y;
    }
    const det = a11 * a22 - a12 * a12;
    if (Math.abs(det) < 1e-6 * ax.length) { // axes parallèles : milieu des extrémités proches
      O = ends.reduce((s, p) => ({ x: s.x + p.x / ends.length, y: s.y + p.y / ends.length }), { x: 0, y: 0 });
      break;
    }
    O = { x: (a22 * b1 - a12 * b2) / det, y: (a11 * b2 - a12 * b1) / det };
  }
  return O;
}

// Direction d'une branche : point Q où l'axe saisi franchit le cercle de rayon Rd autour de O,
// et direction du segment qui le porte.
export function branchDirection(b, O, Rd) {
  const pl = nearFar(b.axis, O);
  const far = pl[pl.length - 1];
  let Q = far, segDir = norm(sub(pl[pl.length - 1], pl[pl.length - 2]));
  if (G.dist(pl[0], O) >= Rd) { Q = pl[0]; segDir = norm(sub(pl[1], pl[0])); }
  else {
    for (let i = 0; i < pl.length - 1; i++) {
      const p = pl[i], q = pl[i + 1];
      if (G.dist(q, O) < Rd) continue;
      const d = norm(sub(q, p)), ts = G.lineCircle(p, d, O, Rd);
      if (ts.length) { Q = add(p, mul(d, ts[1])); segDir = d; }
      break;
    }
  }
  return { pl, far, Q, segDir };
}

// Premier franchissement, en partant du centre, du cercle (O, R) par la polyligne pl (orientée de O vers
// l'extérieur) : point J, direction du segment porteur et sommets suivants. null si la polyligne reste à l'intérieur.
export function polylineAfter(pl, O, R) {
  if (G.dist(pl[0], O) >= R) return { J: pl[0], dir: norm(sub(pl[1], pl[0])), rest: pl.slice(1) };
  for (let i = 0; i < pl.length - 1; i++) {
    const p = pl[i], q = pl[i + 1];
    if (G.dist(q, O) < R) continue;
    const d = norm(sub(q, p)), ts = G.lineCircle(p, d, O, R);
    if (!ts.length) return null;
    return { J: add(p, mul(d, ts[1])), dir: d, rest: pl.slice(i + 1) };
  }
  return null;
}

export function circleCircle(c1, r1, c2, r2) {
  const d = G.dist(c1, c2);
  if (d < 1e-9 || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const e = norm(sub(c2, c1)), m = add(c1, mul(e, a)), p = rot90(e);
  return [add(m, mul(p, h)), sub(m, mul(p, h))];
}

// Repère local d'une branche : origine O, x suivant u, y suivant rot90(u).
// at(x, y) : point (monde) et tangente de la ligne d'ordonnée y à l'abscisse x.
export function frame(O, u) {
  const n = rot90(u), theta = G.ang(u);
  const W = (p) => ({ x: O.x + u.x * p.x + n.x * p.y, y: O.y + u.y * p.x + n.y * p.y });
  const Ws = (s) => (s.t === 'L' ? G.L(W(s.a), W(s.b)) : G.A(W(s.c), s.r, s.sa + theta, s.ea + theta, s.ccw));
  const toL = (P) => { const q = sub(P, O); return { x: dot(q, u), y: dot(q, n) }; };
  return { u, n, theta, W, Ws, Wp: (p) => p.map(Ws), toL, at: (x, y = 0) => ({ p: W({ x, y }), t: u }) };
}

/**
 * Repère local courbé (approche en courbe) : identique à frame(O, u) jusqu'à l'abscisse xs, puis l'axe local y = 0 suit
 * le chemin C (monde, issu de O + xs·u tangentiellement à u) : le point local (x, y) est porté à la distance y,
 * à gauche, du point de C d'abscisse curviligne x − xs (prolongement droit au-delà de la fin de C). Les éléments
 * construits dans le repère droit (îlot, bordures, évasement) sont ainsi enroulés sur l'axe courbe. Wp échantillonne
 * les segments qui dépassent xs (pas de 1 m) ; toL est l'inverse (projection sur C).
 */
export function warpFrame(O, u, C, xs) {
  const F0 = frame(O, u), { n, theta } = F0;
  const pts = [add(O, mul(u, xs)), ...G.samplePath(C, 0.5).slice(1)], cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + G.dist(pts[i - 1], pts[i]));
  const Ltot = cum[cum.length - 1];
  const tanAt = (i) => norm(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(0, Math.min(i, pts.length - 2))]));
  const axe = (s) => {   // point et tangente de C à l'abscisse curviligne s ≥ 0
    if (s >= Ltot) { const t = tanAt(pts.length - 2); return { p: add(pts[pts.length - 1], mul(t, s - Ltot)), t }; }
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const f = (s - cum[lo]) / (cum[hi] - cum[lo] || 1), p = add(pts[lo], mul(sub(pts[hi], pts[lo]), f));
    // tangente lissée (moyenne des segments voisins) pour que les décalages restent continus
    const t0 = tanAt(Math.max(0, lo - 1)), t1 = tanAt(lo), t2 = tanAt(hi);
    return { p, t: norm(add(mul(add(t0, t1), 1 - f), mul(add(t1, t2), f))) };
  };
  const at = (x, y = 0) => {
    if (x <= xs) return { p: F0.W({ x, y }), t: u };
    const q = axe(x - xs);
    return { p: add(q.p, mul(rot90(q.t), y)), t: q.t };
  };
  const W = (p) => at(p.x, p.y).p;
  const xMax = (s) => (s.t === 'L' ? Math.max(s.a.x, s.b.x) : Math.max(...G.samplePath([s], 0.5).map((q) => q.x)));
  const Ws = (s) => (xMax(s) <= xs + 1e-9 ? F0.Ws(s) : G.L(W(G.segAt(s, 0)), W(G.segAt(s, 1))));   // corde : préférer Wp
  const Wp = (path) => path.flatMap((s) => {
    if (xMax(s) <= xs + 1e-9) return [F0.Ws(s)];
    const N = Math.max(2, Math.ceil(G.segLen(s) / 1)), out = [];
    let prev = W(G.segAt(s, 0));
    for (let i = 1; i <= N; i++) { const q = W(G.segAt(s, i / N)); out.push(G.L(prev, q)); prev = q; }
    return out;
  });
  const toL = (P) => {
    const q = F0.toL(P);
    if (q.x <= xs) return q;
    let best = null, d = Infinity;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], ab = sub(b, a), l2 = dot(ab, ab) || 1, t = G.clamp(dot(sub(P, a), ab) / l2, 0, 1);
      const h = add(a, mul(ab, t)), dd = G.dist(P, h);
      if (dd < d) { d = dd; best = { s: cum[i] + t * Math.sqrt(l2), y: dot(sub(P, h), rot90(norm(ab))) }; }
    }
    // au-delà de la fin de C : prolongement droit
    const tE = tanAt(pts.length - 2), e = sub(P, pts[pts.length - 1]);
    if (dot(e, tE) > 0 && Math.abs(dot(e, rot90(tE))) <= d + 1e-9) return { x: xs + Ltot + dot(e, tE), y: dot(e, rot90(tE)) };
    return { x: xs + best.s, y: best.y };
  };
  return { u, n, theta, W, Ws, Wp, toL, at, xs, warped: true };
}
