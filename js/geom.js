// geom.js — géométrie 2D en mètres : vecteurs, segments (droites / arcs), raccordements, hachures.
// Convention : repère direct (x vers l'Est, y vers le Nord), angles en radians mesurés depuis +x, sens trigonométrique.

export const TAU = Math.PI * 2;
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const len = (a) => Math.hypot(a.x, a.y);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a) => { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l }; };
export const rot90 = (a) => ({ x: -a.y, y: a.x });
export const neg = (a) => ({ x: -a.x, y: -a.y });
export const ang = (a) => Math.atan2(a.y, a.x);
export const unit = (t) => ({ x: Math.cos(t), y: Math.sin(t) });
export const polar = (c, r, t) => ({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) });
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function normAng(a) { a %= TAU; return a < 0 ? a + TAU : a; }
export const ccwSweep = (a0, a1) => normAng(a1 - a0);

// --- Segments de chemin -------------------------------------------------------
// Droite : { t:'L', a, b }   Arc : { t:'A', c, r, sa, ea, ccw } parcouru de l'angle sa vers ea.
export const L = (a, b) => ({ t: 'L', a, b });
export const A = (c, r, sa, ea, ccw) => ({ t: 'A', c, r, sa, ea, ccw });
export const arcThrough = (c, r, p0, p1, ccw) => A(c, r, ang(sub(p0, c)), ang(sub(p1, c)), ccw);
export const sweep = (s) => (s.ccw ? ccwSweep(s.sa, s.ea) : ccwSweep(s.ea, s.sa));
export const segStart = (s) => (s.t === 'L' ? s.a : polar(s.c, s.r, s.sa));
export const segEnd = (s) => (s.t === 'L' ? s.b : polar(s.c, s.r, s.ea));
export const segLen = (s) => (s.t === 'L' ? dist(s.a, s.b) : s.r * sweep(s));
export function segAt(s, t) {
  if (s.t === 'L') return lerp(s.a, s.b, t);
  return polar(s.c, s.r, s.sa + (s.ccw ? 1 : -1) * sweep(s) * t);
}
export const revSeg = (s) => (s.t === 'L' ? L(s.b, s.a) : A(s.c, s.r, s.ea, s.sa, !s.ccw));
export const revPath = (p) => p.slice().reverse().map(revSeg);
export const pathLen = (p) => p.reduce((acc, s) => acc + segLen(s), 0);

// Discrétise un chemin (pas en mètres sur les arcs).
export function samplePath(path, step = 0.5) {
  const pts = [];
  for (const s of path) {
    const n = s.t === 'L' ? 1 : Math.max(2, Math.ceil(segLen(s) / step));
    for (let i = pts.length ? 1 : 0; i <= n; i++) pts.push(segAt(s, i / n));
  }
  return pts;
}

// Point à l'abscisse curviligne d le long du chemin.
export function pathPointAt(path, d) {
  for (const s of path) {
    const l = segLen(s);
    if (d <= l) return segAt(s, l > 0 ? d / l : 0);
    d -= l;
  }
  return path.length ? segEnd(path[path.length - 1]) : null;
}

// Début d'un chemin, jusqu'à l'abscisse curviligne d.
export function pathHead(path, d) {
  const out = [];
  for (const s of path) {
    const l = segLen(s);
    if (d >= l) { out.push(s); d -= l; continue; }
    if (d > 1e-9) {
      const p = segAt(s, d / l);
      out.push(s.t === 'L' ? L(s.a, p) : A(s.c, s.r, s.sa, ang(sub(p, s.c)), s.ccw));
    }
    break;
  }
  return out;
}

// --- Intersections ---------------------------------------------------------------
// Droites (p + t·d) et (q + u·e). Retourne t et le point, ou null si parallèles.
export function lineLine(p, d, q, e) {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-12) return null;
  const t = cross(sub(q, p), e) / den;
  return { t, p: add(p, mul(d, t)) };
}

// Droite (p + t·d, d unitaire) et cercle (c, R) : paramètres t croissants.
export function lineCircle(p, d, c, R) {
  const f = sub(p, c);
  const b = dot(f, d);
  const disc = b * b - (dot(f, f) - R * R);
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  return [-b - s, -b + s];
}

// Raccordement d'une droite et d'un cercle par un arc de rayon r tangent extérieurement au cercle.
// p,d : droite parcourue dans le sens d (d unitaire) ; m : normale unitaire du côté où se trouve le centre du raccord.
// Retourne { C, Tl (tangence droite), Tc (tangence cercle), t (abscisse de Tl sur la droite), arc } ou null.
export function filletLineCircle(p, d, m, c, Rc, r) {
  const p2 = add(p, mul(m, r));
  const ts = lineCircle(p2, d, c, Rc + r);
  if (!ts.length) return null;
  const t = ts[0];
  const C = add(p2, mul(d, t));
  const Tl = sub(C, mul(m, r));
  const Tc = add(c, mul(norm(sub(C, c)), Rc));
  const ccw = dot(rot90(sub(Tl, C)), d) > 0;
  return { C, Tl, Tc, t, r, arc: arcThrough(C, r, Tl, Tc, ccw) };
}

// Raccordement circulaire au sommet V de la polyligne P→V→Q. lim0/lim1 : part maximale des côtés consommée.
export function filletCorner(P, V, Q, r, lim0 = 0.5, lim1 = 0.5) {
  const d1 = norm(sub(V, P)), d2 = norm(sub(Q, V));
  const cr = cross(d1, d2);
  const defl = Math.atan2(Math.abs(cr), dot(d1, d2));
  if (defl < 1e-4 || defl > Math.PI - 1e-4) return null;
  let tl = r * Math.tan(defl / 2);
  const maxT = Math.min(dist(P, V) * lim0, dist(V, Q) * lim1);
  if (tl > maxT) { tl = maxT; r = tl / Math.tan(defl / 2); }
  const T1 = sub(V, mul(d1, tl)), T2 = add(V, mul(d2, tl));
  const ccw = cr > 0;
  const C = add(T1, mul(ccw ? rot90(d1) : neg(rot90(d1)), r));
  return { T1, T2, C, r, ccw, arc: arcThrough(C, r, T1, T2, ccw) };
}

// Polyligne → chemin avec raccordements de rayon radii[i] aux sommets intérieurs.
export function roundPolyline(pts, radii = []) {
  const n = pts.length, segs = [];
  if (n < 2) return segs;
  let cur = pts[0];
  for (let i = 1; i < n - 1; i++) {
    const r = radii[i] || 0;
    const f = r > 0 ? filletCorner(pts[i - 1], pts[i], pts[i + 1], r, i === 1 ? 0.95 : 0.5, i === n - 2 ? 0.95 : 0.5) : null;
    if (f) { segs.push(L(cur, f.T1)); segs.push(f.arc); cur = f.T2; }
    else { segs.push(L(cur, pts[i])); cur = pts[i]; }
  }
  segs.push(L(cur, pts[n - 1]));
  return segs.filter((s) => segLen(s) > 1e-6);
}

// Décalage d'un chemin continu en tangence, de δ vers la gauche du sens de parcours (δ < 0 : vers la droite).
export function offsetPath(segs, delta) {
  const out = [];
  for (const s of segs) {
    if (s.t === 'L') {
      const n = mul(rot90(norm(sub(s.b, s.a))), delta);
      out.push(L(add(s.a, n), add(s.b, n)));
    } else if (s.t === 'A') {
      const r = s.ccw ? s.r - delta : s.r + delta;
      if (r > 1e-3) out.push(A(s.c, r, s.sa, s.ea, s.ccw));
    }
  }
  return out;
}

// Cercle passant par trois points.
export function circumcircle(p, q, r) {
  const a = sub(q, p), b = sub(r, p); // calcul relatif à p (coordonnées projetées de grande valeur)
  const d = 2 * cross(a, b);
  if (Math.abs(d) < 1e-9) return null;
  const a2 = dot(a, a), b2 = dot(b, b);
  const c = { x: p.x + (b.y * a2 - a.y * b2) / d, y: p.y + (a.x * b2 - b.x * a2) / d };
  return { c, r: dist(c, p) };
}

// --- Polygones -----------------------------------------------------------------
export function polyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p.x * q.y - q.x * p.y; }
  return a / 2;
}

// Hachures parallèles (angle, espacement) limitées à un polygone fermé, ou à plusieurs (trous compris),
// selon la règle pair-impair.
export function hatchPolygon(poly, angle, spacing) {
  const polys = Array.isArray(poly[0]) ? poly : [poly];
  const d = unit(angle), nr = rot90(d);
  let mn = Infinity, mx = -Infinity;
  for (const pl of polys) for (const p of pl) { const v = dot(p, nr); if (v < mn) mn = v; if (v > mx) mx = v; }
  const out = [];
  for (let c = Math.ceil(mn / spacing) * spacing; c <= mx; c += spacing) {
    const ts = [];
    for (const pl of polys) for (let i = 0; i < pl.length; i++) {
      const p = pl[i], q = pl[(i + 1) % pl.length];
      const vp = dot(p, nr) - c, vq = dot(q, nr) - c;
      if ((vp > 0) !== (vq > 0)) ts.push(dot(lerp(p, q, vp / (vp - vq)), d));
    }
    ts.sort((a, b) => a - b);
    for (let k = 0; k + 1 < ts.length; k += 2) out.push([add(mul(nr, c), mul(d, ts[k])), add(mul(nr, c), mul(d, ts[k + 1]))]);
  }
  return out;
}

// Distance d'un point à un segment [a,b].
export function distToSeg(p, a, b) {
  const ab = sub(b, a), l2 = dot(ab, ab);
  const t = l2 > 0 ? clamp(dot(sub(p, a), ab) / l2, 0, 1) : 0;
  return dist(p, add(a, mul(ab, t)));
}

export function bboxOf(pts, bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }) {
  for (const p of pts) {
    if (p.x < bb.x0) bb.x0 = p.x; if (p.x > bb.x1) bb.x1 = p.x;
    if (p.y < bb.y0) bb.y0 = p.y; if (p.y > bb.y1) bb.y1 = p.y;
  }
  return bb;
}
