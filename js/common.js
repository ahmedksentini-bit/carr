// common.js — outils partagés par les constructions de carrefours (giratoire, T, X).
import * as G from './geom.js';

const { add, sub, mul, dot, norm, rot90 } = G;

export const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '—');
export const toGon = (rad) => G.normAng(Math.PI / 2 - rad) * 200 / Math.PI; // gisement depuis le Nord, sens horaire
export const toDegGis = (rad) => G.normAng(Math.PI / 2 - rad) * 180 / Math.PI;
export const fmtGis = (rad, unit) => (unit === 'deg' ? fmt(toDegGis(rad), 2) + '°' : fmt(toGon(rad), 3) + ' gr');
export const upright = (r) => { r = G.normAng(r); return r > Math.PI / 2 && r <= 1.5 * Math.PI ? r - Math.PI : r; };

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
export function frame(O, u) {
  const n = rot90(u), theta = G.ang(u);
  const W = (p) => ({ x: O.x + u.x * p.x + n.x * p.y, y: O.y + u.y * p.x + n.y * p.y });
  const Ws = (s) => (s.t === 'L' ? G.L(W(s.a), W(s.b)) : G.A(W(s.c), s.r, s.sa + theta, s.ea + theta, s.ccw));
  const toL = (P) => { const q = sub(P, O); return { x: dot(q, u), y: dot(q, n) }; };
  return { u, n, theta, W, Ws, Wp: (p) => p.map(Ws), toL };
}
