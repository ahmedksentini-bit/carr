// clotho.js — alignements en plan avec raccordements progressifs (clothoïdes).
// Un alignement est défini par une polyligne de sommets (PI) ; à chaque sommet intérieur on donne
// le rayon R de l'arc et le paramètre A des deux clothoïdes symétriques (L = A²/R, τ = L/2R).
// Références : Cerema, « Les échangeurs sur routes de type Autoroute » (2013, maj 2021) § 3.2.3 ;
// ICTAAL 2015 § 3.1. Conventions de geom.js (repère direct, angles en radians).
import * as G from './geom.js';

const { add, sub, mul, norm, rot90, unit, dist, cross, dot, ang } = G;

// Point de la clothoïde unitaire de paramètre A à l'abscisse l : x = ∫cos(s²/2A²), y = ∫sin(s²/2A²) (Simpson).
export function cloXY(A, l, n = 24) {
  if (l <= 0) return { x: 0, y: 0 };
  const k = 1 / (2 * A * A), h = l / n;
  let sx = 0, sy = 0;
  for (let i = 0; i <= n; i++) {
    const s = i * h, w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2, t = s * s * k;
    sx += w * Math.cos(t); sy += w * Math.sin(t);
  }
  return { x: (sx * h) / 3, y: (sy * h) / 3 };
}

// Point d'une clothoïde partant de P0 avec le cap th0, tournant du côté sg (+1 gauche, −1 droite).
function cloPoint(P0, th0, sg, A, l) {
  const q = cloXY(A, l), u = unit(th0), n = rot90(u);
  return add(P0, add(mul(u, q.x), mul(n, sg * q.y)));
}

// Longueur minimale d'une clothoïde (guide échangeurs § 3.2.3) : R en m, dDev en % (|Δ pente transversale|).
export function cloMinLength(R, dDev, lanes = 1) {
  return lanes >= 2 ? Math.max(R / 9, 14 * dDev) : Math.max(6 * Math.pow(R, 0.4), 7 * dDev);
}

// Construit l'alignement. pis : [{x, y, R?, A?, loop?}] ; le premier et le dernier sommet sont des extrémités.
// loop : le raccordement tourne « par le grand côté » (déviation 2π − δ du côté opposé) — boucle d'échangeur
// d'environ 270° : l'axe se recoupe au sommet (franchissement dénivelé).
// Retourne { elems, path, length, pointAt, headAt, curvAt, points, issues, tangents }.
export function buildAlignment(pis, { name = '' } = {}) {
  const issues = [], elems = [], points = [];
  const P = pis.map((p) => ({ x: +p.x, y: +p.y, R: +p.R || 0, A: +p.A || 0, loop: !!p.loop }));
  const n = P.length;
  const out = { elems, path: [], length: 0, points, issues, pointAt: null, headAt: null, curvAt: null, tangents: [] };
  if (n < 2) return out;
  // Tangentes consommées à chaque sommet intérieur.
  const T = new Array(n).fill(0), geo = new Array(n).fill(null);
  for (let i = 1; i < n - 1; i++) {
    const d1 = norm(sub(P[i], P[i - 1])), d2 = norm(sub(P[i + 1], P[i]));
    const cr = cross(d1, d2);
    let defl = Math.atan2(Math.abs(cr), dot(d1, d2)), sg = cr >= 0 ? 1 : -1;
    if (P[i].loop) { defl = 2 * Math.PI - defl; sg = -sg; }
    if (!(P[i].R > 0) || defl < 1e-5) { geo[i] = null; continue; }
    const R = P[i].R;
    let A = P[i].A, L = A > 0 ? (A * A) / R : 0, tau = L / (2 * R);
    if (2 * tau > defl) { // les deux clothoïdes consomment plus que la déflexion : on les raccourcit (ove sans arc)
      tau = defl / 2; L = 2 * R * tau; A = Math.sqrt(L * R);
      issues.push({ lvl: 'warn', msg: `${name} PI ${i} : déflexion trop faible pour les clothoïdes A = ${P[i].A} ; A ramené à ${A.toFixed(0)}.` });
    }
    const e = L > 0 ? cloXY(A, L) : { x: 0, y: 0 };
    const dR = e.y - R * (1 - Math.cos(tau)), Xm = e.x - R * Math.sin(tau);
    T[i] = Xm + (R + dR) * Math.tan(defl / 2);
    geo[i] = { d1, d2, defl, sg, R, A, L, tau, th0: ang(d1), th1: ang(d2), loop: P[i].loop };
  }
  for (let i = 1; i < n - 1; i++) {
    const seg = dist(P[i - 1], P[i]);
    if (T[i - 1] + T[i] > seg + 1e-6 || (P[i].loop && -T[i] > dist(P[i], P[i + 1]) + 1e-6)) issues.push({ lvl: 'err', msg: `${name} : les raccordements des PI ${i - 1} et ${i} se chevauchent (${(T[i - 1] + T[i]).toFixed(1)} m > ${seg.toFixed(1)} m).` });
  }
  if (T[n - 2] > dist(P[n - 2], P[n - 1]) + 1e-6) issues.push({ lvl: 'err', msg: `${name} : le dernier raccordement dépasse l'extrémité de l'axe.` });
  // Éléments successifs.
  let cur = P[0], s = 0;
  const pushLine = (a, b) => { const l = dist(a, b); if (l < 1e-6) return; const th = ang(sub(b, a)); elems.push({ kind: 'L', s0: s, len: l, p0: a, th0: th, R: 0, pointAt: (t) => add(a, mul(unit(th), t)), headAt: () => th, curvAt: () => 0 }); s += l; };
  for (let i = 1; i < n - 1; i++) {
    const g = geo[i];
    if (!g) { pushLine(cur, P[i]); cur = P[i]; continue; }
    const TS = sub(P[i], mul(g.d1, T[i])), ST = add(P[i], mul(g.d2, T[i]));
    pushLine(cur, TS);
    const { sg, R, A, L, tau } = g;
    let SC = TS, thSC = g.th0;
    if (L > 0) { // clothoïde d'entrée
      const k2 = 1 / (2 * A * A), p0 = TS, th0 = g.th0, s0 = s;
      elems.push({ kind: 'C', s0, len: L, p0, th0, R, A, sg, pointAt: (t) => cloPoint(p0, th0, sg, A, t), headAt: (t) => th0 + sg * t * t * k2, curvAt: (t) => (sg * t) / (A * A) });
      SC = cloPoint(TS, g.th0, sg, A, L); thSC = g.th0 + sg * tau; s += L;
      points.push({ name: `TS${i}`, p: TS }); points.push({ name: `SC${i}`, p: SC });
    } else points.push({ name: `TC${i}`, p: TS });
    const sweep = g.defl - 2 * tau; // arc circulaire
    const C = add(SC, mul(rot90(unit(thSC)), sg * R));
    const sa = ang(sub(SC, C)), p0 = SC, s0 = s;
    elems.push({ kind: 'A', s0, len: R * sweep, p0, th0: thSC, R, sg, C, pointAt: (t) => G.polar(C, R, sa + (sg * t) / R), headAt: (t) => thSC + (sg * t) / R, curvAt: () => sg / R, seg: G.A(C, R, sa, sa + sg * sweep, sg > 0) });
    s += R * sweep;
    const CS = elems[elems.length - 1].pointAt(R * sweep);
    if (L > 0) { // clothoïde de sortie, paramétrée depuis ST à rebours
      const k2 = 1 / (2 * A * A), th1 = g.th1, s0 = s;
      elems.push({ kind: 'C', s0, len: L, p0: CS, th0: thSC + sg * sweep, R, A, sg, out: true, pointAt: (t) => cloPoint(ST, th1 + Math.PI, -sg, A, L - t), headAt: (t) => th1 - sg * (L - t) * (L - t) * k2, curvAt: (t) => (sg * (L - t)) / (A * A) });
      s += L;
      points.push({ name: `CS${i}`, p: CS }); points.push({ name: `ST${i}`, p: ST });
    } else points.push({ name: `CT${i}`, p: ST });
    cur = ST;
    out.tangents.push({ i, T: T[i], ...g });
  }
  pushLine(cur, P[n - 1]);
  out.length = s;
  const find = (d) => { d = Math.max(0, Math.min(s, d)); let e = elems[0]; for (const q of elems) { if (d <= q.s0 + q.len + 1e-9) { e = q; break; } e = q; } return [e, Math.max(0, Math.min(e.len, d - e.s0))]; };
  out.pointAt = (d) => { const [e, t] = find(d); return e.pointAt(t); };
  out.headAt = (d) => { const [e, t] = find(d); return e.headAt(t); };
  out.curvAt = (d) => { const [e, t] = find(d); return e.curvAt(t); };
  out.elemAt = (d) => find(d)[0];
  out.path = alignPath(out);
  return out;
}

// Chemin geom.js : droites et arcs vrais, clothoïdes échantillonnées.
export function alignPath(al, step = 1) {
  const path = [];
  for (const e of al.elems) {
    if (e.kind === 'L') path.push(G.L(e.p0, e.pointAt(e.len)));
    else if (e.kind === 'A') path.push(e.seg);
    else {
      const m = Math.max(4, Math.ceil(e.len / step));
      let prev = e.pointAt(0);
      for (let i = 1; i <= m; i++) { const q = e.pointAt((e.len * i) / m); path.push(G.L(prev, q)); prev = q; }
    }
  }
  return path;
}

// Polyligne décalée de off(s) (m, > 0 à gauche) le long de l'alignement, pas en m.
export function offsetPolyline(al, off, step = 1, s0 = 0, s1 = al.length) {
  const pts = [];
  const f = typeof off === 'function' ? off : () => off;
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n, p = al.pointAt(s), nn = rot90(unit(al.headAt(s)));
    pts.push(add(p, mul(nn, f(s))));
  }
  return pts;
}

export const polySegs = (pts) => { const out = []; for (let i = 0; i + 1 < pts.length; i++) if (dist(pts[i], pts[i + 1]) > 1e-6) out.push(G.L(pts[i], pts[i + 1])); return out; };

// Tangente (vecteur unitaire) d'un chemin geom.js à l'abscisse d.
export function pathTangentAt(path, d) {
  let acc = 0;
  for (const s of path) {
    const l = G.segLen(s);
    if (d <= acc + l || s === path[path.length - 1]) {
      const t = l > 0 ? Math.max(0, Math.min(1, (d - acc) / l)) : 0;
      if (s.t === 'L') return norm(sub(s.b, s.a));
      const a = s.sa + (s.ccw ? 1 : -1) * G.sweep(s) * t;
      const r = unit(a);
      return s.ccw ? rot90(r) : G.neg(rot90(r));
    }
    acc += l;
  }
  return { x: 1, y: 0 };
}

// Abscisse curviligne et décalage signé (gauche > 0) du point q par rapport au chemin.
export function pathProject(path, q) {
  let best = null, acc = 0;
  for (const s of path) {
    const l = G.segLen(s);
    if (s.t === 'L') {
      const d = sub(s.b, s.a), ll = dot(d, d) || 1;
      const t = Math.max(0, Math.min(1, dot(sub(q, s.a), d) / ll)), p = G.lerp(s.a, s.b, t);
      const dd = dist(q, p);
      if (!best || dd < best.d) best = { d: dd, s: acc + t * l, off: cross(norm(d), sub(q, p)), p };
    } else {
      const a = ang(sub(q, s.c)), sw = G.sweep(s);
      const rel = s.ccw ? G.ccwSweep(s.sa, a) : G.ccwSweep(a, s.sa);
      const t = rel <= sw ? rel / sw : (G.ccwSweep(s.ea, a) < G.ccwSweep(a, s.sa) ? 1 : 0);
      const p = G.segAt(s, t), dd = dist(q, p), tg = pathTangentAt([s], t * l);
      if (!best || dd < best.d) best = { d: dd, s: acc + t * l, off: cross(tg, sub(q, p)), p };
    }
    acc += l;
  }
  return best;
}

// Longueur de tangente d'un raccordement symétrique clothoïde – arc – clothoïde de déviation defl (rad).
export function tangentLength(R, A, defl) {
  const L = A > 0 ? (A * A) / R : 0, tau = L / (2 * R), e = L > 0 ? cloXY(A, L) : { x: 0, y: 0 };
  const dR = e.y - R * (1 - Math.cos(tau)), Xm = e.x - R * Math.sin(tau);
  return Xm + (R + dR) * Math.tan(defl / 2);
}
