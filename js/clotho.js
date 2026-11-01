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

// Construit l'alignement. pis : [{x, y, R?, A?, loop?, link?}] ; le premier et le dernier sommet sont des extrémités.
// loop : le raccordement tourne « par le grand côté » (déviation 2π − δ du côté opposé) — boucle de trompette d'environ
// 270° dont l'axe se recoupe au sommet (franchissement dénivelé).
// link : pas de clothoïde entre l'arc de ce sommet et celui du sommet précédent (arc continu, même rayon) — permet de
// décrire une boucle de 180° ou de 270° en un seul arc sur deux ou trois sommets, sans recoupement.
// Les clothoïdes d'entrée et de sortie d'un sommet peuvent donc différer (L1 = A²/R ou 0, L2 = A²/R ou 0).
// Retourne { elems, path, length, pointAt, headAt, curvAt, elemAt, points, issues, tangents }.
export function buildAlignment(pis, { name = '' } = {}) {
  const issues = [], elems = [], points = [];
  const P = pis.map((p) => ({ x: +p.x, y: +p.y, R: +p.R || 0, A: +p.A || 0, loop: !!p.loop, link: !!p.link, semi: !!p.semi }));
  const n = P.length;
  const out = { elems, path: [], length: 0, points, issues, pointAt: null, headAt: null, curvAt: null, tangents: [] };
  if (n < 2) return out;
  // Tangentes d'entrée (Ti) et de sortie (To) à chaque sommet intérieur.
  const Ti = new Array(n).fill(0), To = new Array(n).fill(0), geo = new Array(n).fill(null);
  for (let i = 1; i < n - 1; i++) {
    const d1 = norm(sub(P[i], P[i - 1])), d2 = norm(sub(P[i + 1], P[i]));
    const cr = cross(d1, d2);
    let defl = Math.atan2(Math.abs(cr), dot(d1, d2)), sg = cr >= 0 ? 1 : -1;
    if (P[i].loop) { defl = 2 * Math.PI - defl; sg = -sg; }
    if (!(P[i].R > 0) || defl < 1e-5) { geo[i] = null; continue; }
    const R = P[i].R;
    let A1 = P[i].link ? 0 : P[i].A, A2 = P[i + 1]?.link && i + 1 < n - 1 ? 0 : P[i].A;
    let L1 = A1 > 0 ? (A1 * A1) / R : 0, L2 = A2 > 0 ? (A2 * A2) / R : 0;
    if ((L1 + L2) / (2 * R) > defl) { // les clothoïdes consomment plus que la déflexion : on les raccourcit (ove sans arc)
      const k = (defl * 2 * R) / (L1 + L2); L1 *= k; L2 *= k; A1 = L1 > 0 ? Math.sqrt(L1 * R) : 0; A2 = L2 > 0 ? Math.sqrt(L2 * R) : 0;
      issues.push({ lvl: 'warn', msg: `${name} PI ${i} : déflexion trop faible pour les clothoïdes A = ${P[i].A} ; A ramené à ${Math.max(A1, A2).toFixed(0)}.` });
    }
    const tau1 = L1 / (2 * R), tau2 = L2 / (2 * R), th0 = ang(d1), th1 = th0 + sg * defl;
    // Forme du raccordement depuis TS = origine : clothoïde L1, arc, clothoïde L2 ; Ti, To tels que TS = PI − Ti·d1 et
    // ST = PI + To·d2 (valeurs négatives possibles pour une boucle).
    const SC = L1 > 0 ? cloPoint({ x: 0, y: 0 }, th0, sg, A1, L1) : { x: 0, y: 0 }, thSC = th0 + sg * tau1;
    const C = add(SC, mul(rot90(unit(thSC)), sg * R)), sweep = defl - tau1 - tau2;
    const CS = G.polar(C, R, ang(sub(SC, C)) + sg * sweep);
    const q = L2 > 0 ? cloPoint({ x: 0, y: 0 }, th1 + Math.PI, -sg, A2, L2) : { x: 0, y: 0 }; // CS − ST
    const E = sub(CS, q), det = cross(d1, d2);
    let t, m;
    if (Math.abs(det) > 1e-9) { t = cross(E, d2) / det; m = cross(d1, E) / det; }
    else { t = -dot(E, d1) / 2; m = t; } // demi-tour exact : symétrique
    Ti[i] = t; To[i] = m;
    geo[i] = { d1, d2, defl, sg, R, A: P[i].A, A1, A2, L1, L2, tau1, tau2, th0, th1, sweep, loop: P[i].loop, link: P[i].link, semi: P[i].semi };
  }
  for (let i = 1; i < n - 1; i++) {
    const seg = dist(P[i - 1], P[i]);
    if (To[i - 1] + Ti[i] > seg + (P[i].link ? 0.05 : 1e-3)) issues.push({ lvl: 'err', msg: `${name} : les raccordements des PI ${i - 1} et ${i} se chevauchent (${(To[i - 1] + Ti[i]).toFixed(1)} m > ${seg.toFixed(1)} m).` });
  }
  if (To[n - 2] > dist(P[n - 2], P[n - 1]) + 1e-3) issues.push({ lvl: 'err', msg: `${name} : le dernier raccordement dépasse l'extrémité de l'axe.` });
  // Éléments successifs.
  let cur = P[0], s = 0;
  const pushLine = (a, b) => { const l = dist(a, b); if (l < 1e-6) return; const th = ang(sub(b, a)); elems.push({ kind: 'L', s0: s, len: l, p0: a, th0: th, R: 0, pointAt: (t) => add(a, mul(unit(th), t)), headAt: () => th, curvAt: () => 0 }); s += l; };
  for (let i = 1; i < n - 1; i++) {
    const g = geo[i];
    if (!g) { pushLine(cur, P[i]); cur = P[i]; continue; }
    let TS = sub(P[i], mul(g.d1, Ti[i]));
    if (g.link && i > 1 && geo[i - 1] && dist(cur, TS) < 0.05) TS = cur; // arc continu : raccord exact (arrondis des sommets)
    const ST = add(P[i], mul(g.d2, To[i]));
    pushLine(cur, TS);
    const { sg, R, A1, A2, L1, L2, tau1, sweep } = g;
    let SC = TS, thSC = g.th0;
    if (L1 > 0) { // clothoïde d'entrée
      const k2 = 1 / (2 * A1 * A1), p0 = TS, th0 = g.th0, s0 = s;
      elems.push({ kind: 'C', s0, len: L1, p0, th0, R, A: A1, sg, pointAt: (t) => cloPoint(p0, th0, sg, A1, t), headAt: (t) => th0 + sg * t * t * k2, curvAt: (t) => (sg * t) / (A1 * A1) });
      SC = cloPoint(TS, g.th0, sg, A1, L1); thSC = g.th0 + sg * tau1; s += L1;
      points.push({ name: `TS${i}`, p: TS }); points.push({ name: `SC${i}`, p: SC });
    } else if (!g.link) points.push({ name: `TC${i}`, p: TS });
    const C = add(SC, mul(rot90(unit(thSC)), sg * R));
    const sa = ang(sub(SC, C)), p0 = SC, s0 = s;
    elems.push({ kind: 'A', s0, len: R * sweep, p0, th0: thSC, R, sg, C, pi: i, pointAt: (t) => G.polar(C, R, sa + (sg * t) / R), headAt: (t) => thSC + (sg * t) / R, curvAt: () => sg / R, seg: G.A(C, R, sa, sa + sg * sweep, sg > 0) });
    s += R * sweep;
    const CS = elems[elems.length - 1].pointAt(R * sweep);
    if (L2 > 0) { // clothoïde de sortie, paramétrée depuis ST à rebours
      const k2 = 1 / (2 * A2 * A2), th1 = g.th1, s1 = s;
      elems.push({ kind: 'C', s0: s1, len: L2, p0: CS, th0: thSC + sg * sweep, R, A: A2, sg, out: true, pointAt: (t) => cloPoint(ST, th1 + Math.PI, -sg, A2, L2 - t), headAt: (t) => th1 - sg * (L2 - t) * (L2 - t) * k2, curvAt: (t) => (sg * (L2 - t)) / (A2 * A2) });
      s += L2;
      points.push({ name: `CS${i}`, p: CS }); points.push({ name: `ST${i}`, p: ST });
    } else if (!(P[i + 1]?.link && i + 1 < n - 1)) points.push({ name: `CT${i}`, p: ST });
    cur = ST;
    out.tangents.push({ i, T: Ti[i], To: To[i], L: L1, ...g });
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

// Longueurs de tangente (entrée, sortie) d'un raccordement clothoïde (A1) – arc R – clothoïde (A2) de déviation defl
// (rad, éventuellement > π) ; mêmes conventions que buildAlignment.
export function tangentLengths(R, A1, A2, defl) {
  const L1 = A1 > 0 ? (A1 * A1) / R : 0, L2 = A2 > 0 ? (A2 * A2) / R : 0, sg = 1, th0 = 0, th1 = defl;
  const d1 = { x: 1, y: 0 }, d2 = unit(th1);
  const SC = L1 > 0 ? cloPoint({ x: 0, y: 0 }, th0, sg, A1, L1) : { x: 0, y: 0 }, thSC = L1 / (2 * R);
  const C = add(SC, mul(rot90(unit(thSC)), R)), sweep = defl - L1 / (2 * R) - L2 / (2 * R);
  const CS = G.polar(C, R, ang(sub(SC, C)) + sweep);
  const q = L2 > 0 ? cloPoint({ x: 0, y: 0 }, th1 + Math.PI, -sg, A2, L2) : { x: 0, y: 0 };
  const E = sub(CS, q), det = cross(d1, d2);
  if (Math.abs(det) < 1e-9) { const t = -dot(E, d1) / 2; return [t, t]; }
  return [cross(E, d2) / det, cross(d1, E) / det];
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
