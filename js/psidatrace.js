// psidatrace.js — axe en plan d'un passage supérieur courbe, au format attendu par PSIDA (champ caché « trace » de son
// formulaire, écrit d'ordinaire par l'import DXF « Tracé en plan (ouvrage courbe) ») :
//   { segments, s0, source, stations, psiLignes? }
//   segments : {type:'ligne', a, b} | {type:'arc', c, r, a0, a1, sens, a, b} | {type:'clothoide', a, theta0, k0, k1, long, b}
//   stations : abscisses des lignes d'appui le long de l'axe (s0 = celle de la première, C0) ;
//   psiLignes : angle [gr] de la tangente à l'axe vers chaque ligne d'appui orientée vers la gauche (100 = radiale),
//               même convention que PSIDA src/geom/axe.js stationsAppuis.
// Géométrie de l'axe : exacte pour une voie secondaire (droites et arcs du chemin) et pour l'anneau d'un giratoire
// dénivelé (arc de cercle) ; reconstituée par le diagramme des courbures (droites, arcs, clothoïdes) pour la tige d'une
// trompette, dont l'axe est le milieu de deux bretelles. Les lignes d'appui de GIRA sont parallèles à l'autoroute :
// leur biais varie d'un appui à l'autre sur un axe courbe, d'où ψ propre à chaque ligne.
import * as G from './geom.js';
import { pathProject, pathTangentAt } from './clotho.js';
import { ajusterElements, clothoPoint, clothoTheta, clothoKappa, libelleElement } from './clofit.js';

const { sub, dist, norm, dot, cross } = G;
const TAU = 2 * Math.PI;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const xy = (p) => [p.x, p.y];

// ---------------------------------------------------------------- évaluation d'une suite de segments PSIDA
const segLen = (g) => (g.type === 'ligne' ? Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]) : g.type === 'clothoide' ? g.long : g.r * Math.abs(g.a1 - g.a0));
export function axeP(segments) {
  const seg = segments.map((g) => ({ g, L: segLen(g) }));
  let s = 0; for (const q of seg) { q.s0 = s; s += q.L; }
  const L = s;
  const find = (t) => { let q = seg[seg.length - 1]; for (const h of seg) if (t <= h.s0 + h.L + 1e-12) { q = h; break; } return [q, Math.max(0, Math.min(q.L, t - q.s0))]; };
  const tangente = (t) => {
    const [q, u] = find(Math.max(0, Math.min(L, t))), g = q.g;
    if (g.type === 'ligne') return [(g.b[0] - g.a[0]) / q.L, (g.b[1] - g.a[1]) / q.L];
    if (g.type === 'clothoide') { const th = clothoTheta(g, u); return [Math.cos(th), Math.sin(th)]; }
    const dir = Math.sign(g.a1 - g.a0), th = g.a0 + (dir * u) / g.r;
    return [-Math.sin(th) * dir, Math.cos(th) * dir];
  };
  const point = (t) => {
    const tt = Math.max(0, Math.min(L, t)), [q, u] = find(tt), g = q.g, ext = t - tt;
    let p;
    if (g.type === 'ligne') { const k = u / q.L; p = [g.a[0] + k * (g.b[0] - g.a[0]), g.a[1] + k * (g.b[1] - g.a[1])]; }
    else if (g.type === 'clothoide') p = clothoPoint(g, u);
    else { const th = g.a0 + (Math.sign(g.a1 - g.a0) * u) / g.r; p = [g.c[0] + g.r * Math.cos(th), g.c[1] + g.r * Math.sin(th)]; }
    if (ext) { const tg = tangente(t); p = [p[0] + ext * tg[0], p[1] + ext * tg[1]]; }
    return p;
  };
  const courbure = (t) => { const [q, u] = find(Math.max(0, Math.min(L, t))), g = q.g; return g.type === 'ligne' ? 0 : g.type === 'clothoide' ? clothoKappa(g, u) : Math.sign(g.a1 - g.a0) / g.r; };
  const projeter = (P) => {
    const N = Math.max(200, Math.ceil(L / 0.5));
    let best = 0, dmin = Infinity;
    for (let k = 0; k <= N; k++) { const t = (L * k) / N, p = point(t), d = Math.hypot(p[0] - P[0], p[1] - P[1]); if (d < dmin) { dmin = d; best = t; } }
    let h = L / N;
    for (let it = 0; it < 40; it++) { for (const t of [best - h, best + h]) { const p = point(t), d = Math.hypot(p[0] - P[0], p[1] - P[1]); if (d < dmin) { dmin = d; best = t; } } h /= 2; }
    return { s: best, d: dmin };
  };
  return { L, point, tangente, courbure, projeter };
}

// ---------------------------------------------------------------- segments exacts
// Portion [sa, sb] d'un chemin geom.js (droites L, arcs A) en segments PSIDA ; au-delà des extrémités, prolongement droit.
function clipPath(path, sa, sb) {
  const Lp = G.pathLen(path), out = [];
  const a0 = Math.max(0, sa), b0 = Math.min(Lp, sb);
  let acc = 0;
  for (const s of path) {
    const l = G.segLen(s), lo = Math.max(a0, acc), hi = Math.min(b0, acc + l);
    if (hi - lo > 1e-6 && l > 0) {
      const t0 = (lo - acc) / l, t1 = (hi - acc) / l;
      if (s.t === 'L') out.push({ type: 'ligne', a: xy(G.lerp(s.a, s.b, t0)), b: xy(G.lerp(s.a, s.b, t1)) });
      else {
        const dir = s.ccw ? 1 : -1, sw = G.sweep(s), A0 = s.sa + dir * sw * t0, A1 = s.sa + dir * sw * t1;
        out.push({ type: 'arc', c: xy(s.c), r: s.r, a0: A0, a1: A1, sens: dir, a: xy(G.polar(s.c, s.r, A0)), b: xy(G.polar(s.c, s.r, A1)) });
      }
    }
    acc += l;
  }
  if (sa < -1e-6) { const p = G.segStart(path[0]), t = pathTangentAt(path, 0); out.unshift({ type: 'ligne', a: [p.x + sa * t.x, p.y + sa * t.y], b: xy(p) }); }
  if (sb > Lp + 1e-6) { const p = G.segEnd(path[path.length - 1]), t = pathTangentAt(path, Lp); out.push({ type: 'ligne', a: xy(p), b: [p.x + (sb - Lp) * t.x, p.y + (sb - Lp) * t.y] }); }
  return out;
}
// Abscisse d'un point sur un chemin, prolongements droits compris (pathProject borne l'abscisse à [0, L]).
function stationOn(path, P) {
  const pr = pathProject(path, P), Lp = G.pathLen(path);
  if (pr.s < 1e-6) { const t = pathTangentAt(path, 0); return dot(sub(P, G.segStart(path[0])), t); }
  if (pr.s > Lp - 1e-6) { const t = pathTangentAt(path, Lp); return Lp + dot(sub(P, G.segEnd(path[path.length - 1])), t); }
  return pr.s;
}

// ---------------------------------------------------------------- tracé exporté
const arcLens = (pts) => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + dist(pts[i - 1], pts[i])); return L; };
const atArc = (pts, aL, a) => { let k = 1; while (k < aL.length - 1 && aL[k] < a) k++; return G.lerp(pts[k - 1], pts[k], (a - aL[k - 1]) / (aL[k] - aL[k - 1] || 1)); };

// Déviation angulaire de l'axe (rad) entre les lignes d'appui extrêmes : indicateur rapide d'ouvrage courbe.
export function deckTurn(B) {
  const ax = B.axis, aL = arcLens(ax), a0 = B.sup[0].a, a1 = B.sup[B.sup.length - 1].a;
  let tot = 0, prev = null;
  for (let i = 1; i < ax.length; i++) {
    if (aL[i] < a0 || aL[i - 1] > a1 || dist(ax[i - 1], ax[i]) < 1e-6) continue;
    const h = Math.atan2(ax[i].y - ax[i - 1].y, ax[i].x - ax[i - 1].x);
    if (prev != null) tot += Math.abs(Math.atan2(Math.sin(h - prev), Math.cos(h - prev)));
    prev = h;
  }
  return tot;
}

/**
 * Tracé en plan PSIDA d'un ouvrage conçu par designDeck (B : axis, sup, hwPath, deck.geo, name) ; null si l'axe est
 * droit entre les lignes d'appui extrêmes (PSIDA garde alors son calcul d'ouvrage droit biais).
 */
export function deckTrace(B) {
  const ax = B.axis, aL = arcLens(ax), m = 3; // marge de 3 m au-delà des lignes d'appui extrêmes (abouts)
  const P = B.sup.map((q) => atArc(ax, aL, q.a));
  const geo = B.deck.geo || {}, warnings = [];
  let segments, ecart = 0;
  if (geo.path?.length) {
    const ss = P.map((p) => stationOn(geo.path, p));
    segments = clipPath(geo.path, Math.min(...ss) - m, Math.max(...ss) + m);
  } else if (geo.c && geo.r > 0) {
    const c = geo.c, r = geo.r, dir = Math.sign(cross(sub(ax[0], c), sub(ax[1], c))) || 1, th0 = Math.atan2(ax[0].y - c.y, ax[0].x - c.x);
    const us = P.map((p) => { const d = dir * (Math.atan2(p.y - c.y, p.x - c.x) - th0); return r * (((d % TAU) + TAU) % TAU); });
    const A0 = th0 + (dir * (Math.min(...us) - m)) / r, A1 = th0 + (dir * (Math.max(...us) + m)) / r;
    segments = [{ type: 'arc', c: xy(c), r, a0: A0, a1: A1, sens: dir, a: xy(G.polar(c, r, A0)), b: xy(G.polar(c, r, A1)) }];
  } else {
    const aa = Math.min(...B.sup.map((q) => q.a)) - m, ab = Math.max(...B.sup.map((q) => q.a)) + m;
    const pts = [xy(atArc(ax, aL, aa)), ...ax.filter((_, i) => aL[i] > aa + 0.2 && aL[i] < ab - 0.2).map(xy), xy(atArc(ax, aL, ab))];
    const f = ajusterElements(pts);
    segments = f.segments; ecart = f.ecartMax;
    if (ecart > 0.02) warnings.push(`axe reconstitué (milieu des bretelles de la tige) avec un écart de ${(100 * ecart).toFixed(1).replace('.', ',')} cm`);
  }
  const A = axeP(segments);
  const st = P.map((p, i) => {
    const s = A.projeter(xy(p)).s, tg = A.tangente(s), nm = [-tg[1], tg[0]];
    const u = pathTangentAt(B.hwPath, pathProject(B.hwPath, p).s); // ligne d'appui parallèle à l'autoroute
    let dT = u.x * tg[0] + u.y * tg[1], dN = u.x * nm[0] + u.y * nm[1];
    if (dN < 0) { dT = -dT; dN = -dN; }
    const psi = (Math.atan2(dN, dT) * 200) / Math.PI;
    return { s, psi: Math.abs(psi - 100) < 0.5 ? 100 : Math.round(psi * 10) / 10, kind: B.sup[i].kind };
  }).sort((a, b) => a.s - b.s);
  // ouvrage droit entre les lignes d'appui extrêmes (R > 100 km partout) : pas de tracé
  let kMax = 0;
  for (let k = 0; k <= 200; k++) kMax = Math.max(kMax, Math.abs(A.courbure(st[0].s + ((st[st.length - 1].s - st[0].s) * k) / 200)));
  if (kMax < 1e-5) return null;
  const psiLignes = st.map((q) => q.psi), psiMin = Math.min(...psiLignes.map((p) => Math.min(p, 200 - p)));
  if (psiMin < 50) warnings.push(`biais trop prononcé pour la plaque de PSIDA (ψ = ${psiLignes.map((p) => String(p).replace('.', ',')).join(' / ')} gr ; ψ ≥ 50 gr requis)`);
  const clean = (g) => {
    const o = { ...g, a: g.a.map(r4), ...(g.b ? { b: g.b.map(r4) } : {}), ...(g.c ? { c: g.c.map(r4) } : {}) };
    delete o.s0; delete o.L;
    return o;
  };
  const stations = st.map((q) => +q.s.toFixed(4));
  return {
    segments: segments.map(clean), s0: stations[0], source: `GIRA – ${B.name || 'ouvrage'}`, stations,
    ...(psiLignes.some((p) => p !== 100) ? { psiLignes } : {}),
    psiMin, rMin: 1 / kMax, spans: stations.slice(1).map((s, k) => s - stations[k]),
    elements: segments.map(libelleElement), ecart, warnings,
  };
}
