// devers.js — modèle altimétrique simplifié (niveau avant-projet) et plan de variation des dévers.
// Terrain : plan de déclivité p (%) dont la ligne de plus grande pente descend suivant le gisement G ;
//           il passe par la cote zC au centre du giratoire.
// Anneau, mode « aci » (par défaut) : le bord extérieur (Rg) suit le plan, le dévers d (%) vers l'extérieur
//           est constant tout autour (« aucune pente n'est ajoutée au dévers normal » sur assiette inclinée).
// Anneau, mode « cone » : cône de dévers d posé sur le plan incliné ; le dévers radial varie de d − p à d + p.
// Branche : profil en long rectiligne de pente i (%) à partir du bord de l'anneau ; dévers de chaque voie
//           variant linéairement, sur la longueur de transition, de la valeur imposée par l'anneau au bord
//           extérieur jusqu'au dévers courant de la section (toit).
import * as G from './geom.js';
import { plParams, plBuild, axisLength } from './pl.js';
import { signedOffset, pointNormalAt, projectOnPath } from './ringshape.js';

const { sub, dot, mul, add, polar } = G;

export const gisVec = (gon) => { const t = (gon * Math.PI) / 200; return { x: Math.sin(t), y: Math.cos(t) }; };
const pct = (v) => (v * 100).toFixed(1).replace('.', ',') + ' %';
const upright = (r) => { r = G.normAng(r); return r > Math.PI / 2 && r <= 1.5 * Math.PI ? r - Math.PI : r; };

// Profil en long périodique (anneau fermé de longueur L) : points saisis { s, z, R } ramenés dans [0, L), raccordements
// paraboliques y compris au bouclage (s = 0 ≡ L). Rend { zAt, gradeAt, pts, segs, curves, issues } ou null (aucun point).
export function ringPlBuild(pisIn, L) {
  const md = (v) => ((v % L) + L) % L;
  const pts = [];
  for (const q of Array.isArray(pisIn) ? pisIn : []) {
    const sv = +q.s, z = +q.z;
    if (q.s === '' || q.z === '' || q.s == null || q.z == null || !Number.isFinite(sv) || !Number.isFinite(z)) continue;
    const s0 = md(sv);
    if (pts.some((t) => Math.min(Math.abs(t.s - s0), L - Math.abs(t.s - s0)) < 0.05)) continue;
    pts.push({ s: s0, z, R: Math.max(0, +q.R || 0) });
  }
  if (!pts.length || !(L > 1)) return null;
  pts.sort((a, b) => a.s - b.s);
  if (pts.length === 1) { const z = pts[0].z; return { pts, segs: [{ s0: 0, s1: L, g: 0 }], curves: [], issues: [], zAt: () => z, gradeAt: () => 0 }; }
  const ext = [{ ...pts[pts.length - 1], s: pts[pts.length - 1].s - L }, ...pts, { ...pts[0], s: pts[0].s + L }], e0 = ext[0];
  const P = plBuild({ pis: ext.slice(1).map((q) => ({ s: q.s - e0.s, z: q.z, R: q.R })) }, e0.z);
  const sh = (v) => v + e0.s;
  const segs = P.segs.map((q) => ({ ...q, s0: sh(q.s0), s1: sh(q.s1) }));
  const curves = P.curves.map((c) => ({ ...c, s: sh(c.s), sA: sh(c.sA), sB: sh(c.sB) }));
  return { pts, segs, curves, issues: P.issues, zAt: (sv) => P.zAt(md(sv) - e0.s), gradeAt: (sv) => P.gradeAt(md(sv) - e0.s) };
}
// Axe de l'anneau, sur la rive intérieure peinte (Ri, ou contour Rg − la d'une cacahuète) : origine au nord du centre
// (gisement 0), abscisse croissante dans le sens de circulation (trigonométrique). { L, path, sOf(P), at(s) }.
export function ringAxis(D) {
  const O = D.O;
  if (!O || !(D.Ri > 0.5)) return null;
  if (D.shape) {
    let path = D.shape.path(-D.la);
    if (G.polyArea(G.samplePath(path, 1)) < 0) path = G.revPath(path);
    const L = G.pathLen(path), s0 = projectOnPath(path, G.add(O, { x: 0, y: 1e4 })).s;
    return { L, path, sOf: (P) => (((projectOnPath(path, P).s - s0) % L) + L) % L, at: (sv) => G.pathPointAt(path, ((((sv + s0) % L) + L) % L)) };
  }
  const Ri = D.Ri, L = 2 * Math.PI * Ri, a0 = Math.PI / 2;
  const path = [G.A(O, Ri, a0, a0 + Math.PI, true), G.A(O, Ri, a0 + Math.PI, a0 + 2 * Math.PI, true)];
  return { L, path, sOf: (P) => Ri * G.normAng(Math.atan2(P.y - O.y, P.x - O.x) - a0), at: (sv) => polar(O, Ri, a0 + sv / Ri) };
}

export function addDevers(prj, D) {
  const r = prj.ring, O = D.O;
  const p = (+r.pente || 0) / 100, d = (+r.devers || 0) / 100;
  const g = gisVec(+r.gisPente || 0);
  const zC = +r.zC || 0;
  const mode = r.mode === 'cone' ? 'cone' : 'aci';
  const zPlane = (P) => zC - p * dot(sub(P, O), g);
  // Cacahuète (D.shape) : même modèle, la distance radiale étant remplacée par le décalage signé off à la rive Rg
  // (rr − Rg pour un cercle) et le point de la rive Rg par la projection de P sur le contour.
  const zShape = (P) => {
    const so = signedOffset(D.shape, P), off = so.off;
    if (mode === 'cone') return zPlane(P) - d * Math.max(0, off + D.la);
    if (off >= 0) return zPlane(P);
    return zPlane(so.p) + d * Math.min(-off, D.la);
  };
  // Profil en long saisi pour l'anneau (axe sur la rive intérieure, onglet Profil long) : la rive intérieure suit la
  // ligne rouge, le dévers d vers l'extérieur est constant ; l'îlot central se raccorde à la rive intérieure. La cote
  // zC et la déclivité du site ne s'appliquent alors plus à l'anneau.
  const RA = ringAxis(D), RPL = RA ? ringPlBuild(r.pl?.pis, RA.L) : null;
  D.ringAxis = RA; D.ringPL = RPL;
  let zMean = 0;
  if (RPL) { for (let k = 0; k < 64; k++) zMean += RPL.zAt((k * RA.L) / 64) / 64; }
  const zAxisRing = RPL ? (P) => {
    const zA = RPL.zAt(RA.sOf(P));
    if (D.shape) {
      const off = signedOffset(D.shape, P).off;
      if (off >= 0) return zA - d * D.la;
      if (off >= -D.la) return zA - d * (D.la + off);
      return zA;
    }
    const rr = G.dist(P, O);
    if (rr >= D.Rg) return zA - d * (D.Rg - D.Ri);
    if (rr >= D.Ri) return zA - d * (rr - D.Ri);
    const t = rr / D.Ri;
    return zA * t + zMean * (1 - t);
  } : null;
  const zRing = zAxisRing || (D.shape ? zShape : (P) => {
    const rr = G.dist(P, O);
    if (mode === 'cone') return zPlane(P) - d * Math.max(0, rr - D.Ri);
    if (rr >= D.Rg) return zPlane(P);
    // Îlot central : surface interpolée, raccordée à la rive intérieure (zC + d·la au centre).
    if (rr <= D.Ri) return zC - p * dot(sub(P, O), g) * (D.Rg / D.Ri) + d * (D.Rg - D.Ri);
    return zC - p * D.Rg * dot(mul(sub(P, O), 1 / rr), g) + d * (D.Rg - rr);
  });
  // Dévers radial descendant vers l'extérieur, à l'azimut trigonométrique phi.
  const radial = (phi) => (mode === 'cone' && !RPL ? d + p * dot(G.unit(phi), g) : d);
  const TH = +prj.opts?.textH || 0.8;

  // Dévers radial le long de l'anneau
  let mn = Infinity, mx = -Infinity, phiMin = 0;
  for (let k = 0; k < 360; k++) {
    const v = radial((k * Math.PI) / 180);
    if (v < mn) { mn = v; phiMin = (k * Math.PI) / 180; }
    if (v > mx) mx = v;
  }
  D.devers = { p, d, g, zC, mode, minRadial: mn, maxRadial: mx, maxTransverse: Math.max(Math.abs(mn), Math.abs(mx)), phiMin, branches: [], ringPL: !!RPL };
  D.zRing = zRing;

  // Profil en long de l'anneau (bords extérieur et intérieur) par gisement.
  D.ringProfile = [];
  if (D.shape) {
    // Profil le long du contour, repéré par le gisement depuis le centre du carrefour (contour étoilé depuis O).
    const ext = G.samplePath(D.shape.path(0), 0.5), int = G.samplePath(D.shape.path(-D.la), 0.5);
    const gonOf = (q) => G.normAng(Math.atan2(q.x - O.x, q.y - O.y)) * 200 / Math.PI;
    const at = (pts, gon) => pts.reduce((b, q) => { const dg = Math.abs(((gonOf(q) - gon + 600) % 400) - 200); return dg < b.dg ? { q, dg } : b; }, { q: pts[0], dg: Infinity }).q;
    for (let k = 0; k <= 72; k++) {
      const gon = (k * 400) / 72, t = Math.PI / 2 - (gon * Math.PI) / 200;
      D.ringProfile.push({ gon, zExt: zRing(at(ext, gon)), zInt: zRing(at(int, gon)), rad: radial(t) });
    }
  } else for (let k = 0; k <= 72; k++) {
    const gon = (k * 400) / 72, t = Math.PI / 2 - (gon * Math.PI) / 200;
    D.ringProfile.push({ gon, zExt: zRing(polar(O, D.Rg, t)), zInt: zRing(polar(O, D.Ri, t)), rad: radial(t) });
  }

  const P = (o) => D.prims.push(o);
  const arrow = (pt, dir, len, label, h = TH * 0.8) => P({ k: 'arrow', L: 'DEVERS', p: pt, dir, len, text: label, h, rot: upright(G.ang(dir)) });

  // Flèches de dévers sur l'anneau (évite les embouchures des branches).
  const rm = (D.Rg + D.Ri) / 2;
  if (D.shape) {
    // Cacahuète : 16 flèches réparties le long du milieu de l'anneau, normales au contour.
    const path = D.shape.path(-D.la / 2), Lt = G.pathLen(path);
    for (let k = 0; k < 16; k++) {
      const q = pointNormalAt(path, ((k + 0.5) * Lt) / 16), phi = G.ang(q.n), v = radial(phi), dir = v >= 0 ? q.n : G.neg(q.n);
      arrow(G.add(q.p, mul(dir, -1.2)), dir, 2.4, pct(Math.abs(v)));
    }
  } else for (let k = 0; k < 12; k++) {
    const phi = (k * Math.PI) / 6 + Math.PI / 12;
    const v = radial(phi);
    const e = G.unit(phi);
    const dir = v >= 0 ? e : G.neg(e);
    arrow(G.add(polar(O, rm, phi), mul(dir, -1.2)), dir, 2.4, pct(Math.abs(v)));
  }
  // Axe de l'anneau (rive intérieure) : ligne d'axe, origine (s = 0) et sens de l'abscisse.
  if (RA) {
    P({ k: 'path', L: 'AXE', segs: RA.path, role: 'anneau' });
    const q0 = RA.at(0), q1 = RA.at(0.5), tg = G.norm(sub(q1, q0)), nn = G.norm(sub(q0, O));
    P({ k: 'path', L: 'AXE', segs: [G.L(G.add(q0, mul(nn, -1)), G.add(q0, mul(nn, 1)))] });
    P({ k: 'arrow', L: 'AXE', p: G.add(q0, mul(nn, -1.6)), dir: tg, len: 3, text: RPL ? 'axe anneau s = 0' : 'axe anneau s = 0 (profil à saisir)', h: TH * 0.7, rot: upright(G.ang(tg)) });
  }
  if (p > 0 && !RPL) {
    const rA = D.shape ? Math.min(D.Rb, 6) : D.Rb;
    arrow(G.add(O, mul(g, -rA * 0.35)), g, rA * 0.7, `plan p = ${pct(p)}`, TH);
  }

  // Branches
  for (const bd of D.branches) {
    // pente de l'anneau suivant la normale n de la branche au raccordement (plan du site, ou ligne rouge de l'anneau)
    let dn = -p * dot(bd.n, g);
    if (RPL) { const Q = bd.W({ x: bd.x0 + 0.5, y: bd.a }); dn = zRing(G.add(Q, mul(bd.n, 0.5))) - zRing(G.add(Q, mul(bd.n, -0.5))); }
    branchDevers(prj, D, bd, {
      z0: zRing(bd.W({ x: bd.x0, y: bd.a })),
      d0In: dn, d0Out: -dn,
      defGrade: -p * dot(bd.u, g),
      base: (Pw, x) => (x <= bd.x0 + 1e-6 && (D.shape ? signedOffset(D.shape, Pw).off <= 0.05 : G.dist(Pw, O) <= D.Rg + 0.05) ? zRing(Pw) : null),
      arrow, TH,
    });
  }
  pointHeights(D, zRing);
}

// Profil et dévers d'une branche : profil en long rectiligne depuis x0, dévers de chaque voie variant
// linéairement de la valeur imposée au raccordement (d0) au dévers courant sur la longueur de transition.
function branchDevers(prj, D, bd, { z0, d0In, d0Out, defGrade, base, arrow, TH }) {
  const b = prj.branches[bd.idx], O = bd.Oc || D.O;
  // Profil en long saisi (onglet Profil long) : ligne rouge depuis (0, z0) ; sinon pente constante.
  const PLp = plParams(b), PL = PLp.pis.length ? plBuild(PLp, z0) : null;
  const grade = PL ? PL.gradeAt(0) : b.pente !== '' && b.pente != null && isFinite(+b.pente) ? +b.pente / 100 : defGrade;
  const camber = -(+b.camber || 2.5) / 100;
  const Ltr = b.transition !== '' && b.transition != null && +b.transition > 0 ? +b.transition : Math.max(bd.h, 10);
  const d0 = { 1: d0In, [-1]: d0Out };
  const dev = (s, x) => {
    const t = G.clamp((x - bd.x0) / Ltr, 0, 1);
    return d0[s] + (camber - d0[s]) * t;
  };
  const zAxis = (x) => (PL ? PL.zAt(x - bd.x0) : z0 + grade * (x - bd.x0));
  const zAt = (Pw) => {
    const q = sub(Pw, O), x = dot(q, bd.u), y = dot(q, bd.n);
    const zb = base(Pw, x);
    if (zb != null) return zb;
    const s = y - bd.a >= 0 ? 1 : -1;
    return zAxis(x) + dev(s, x) * Math.abs(y - bd.a);
  };
  const stations = [];
  for (const dx of [0, Ltr / 4, Ltr / 2, (3 * Ltr) / 4, Ltr, Ltr + 10]) {
    const x = bd.x0 + dx;
    if (x > bd.xEnd) break;
    stations.push({ dx, zAxe: zAxis(x), dIn: dev(1, x), dOut: dev(-1, x) });
  }
  D.devers.branches.push({ idx: bd.idx, name: bd.name, grade, Ltr, camber, d0In, d0Out, stations, zAt, z0, pl: PL, sEnd: axisLength(bd) });
  bd.zAt = zAt; bd.z0 = z0; bd.pl = PL;

  // Flèches sur la branche : début, milieu et fin de transition, section courante.
  for (const dx of [2, Ltr / 2, Ltr, Ltr + 12]) {
    const x = bd.x0 + dx;
    if (x > bd.xEnd - 2) continue;
    for (const sd of [bd.entry, bd.exit]) {
      const s = sd.s, v = dev(s, x);
      const isl = dx < bd.h ? bd.hb + (bd.th - bd.hb) * (dx / bd.h) : bd.th;
      const wl = dx < bd.h ? sd.w : sd.wa;
      const yc = bd.a + s * (isl + wl / 2);
      const away = mul(bd.n, s);
      const dir = v <= 0 ? away : G.neg(away);
      arrow(add(bd.W({ x, y: yc }), mul(dir, -1)), dir, 2, pct(Math.abs(v)), TH * 0.7);
    }
  }
}

// Altitudes des points d'implantation (centres de raccordement : pas de cote).
function pointHeights(D, zBase) {
  for (const q of D.points) {
    const bd = q.bi != null ? D.branches.find((x) => x.idx === q.bi) : null;
    q.z = bd && bd.zAt && q.kind !== 'centre' ? bd.zAt(q.p) : zBase(q.p);
    if (q.kind === 'centre' && q.bi != null) q.z = null;
  }
}

// Carrefour plan : la route principale garde son profil (toit de dévers c, pente en long i) ; chaque branche
// secondaire se raccorde au bord de la chaussée principale, dont elle reprend la pente, puis retrouve son profil.
export function addDeversPlan(prj, D) {
  const r = prj.ring, P = D.plan, O = D.O, uM = D.main.u, Ym = D.main.Y;
  const p = (+r.pente || 0) / 100, g = gisVec(+r.gisPente || 0), zC = +r.zC || 0;
  const gradeM = P.pente !== '' && P.pente != null && isFinite(+P.pente) ? +P.pente / 100 : -p * dot(uM, g);
  const c = (+P.camber || 2.5) / 100;
  const TH = +prj.opts?.textH || 0.8;
  const zMain = (Pw) => { const q = sub(Pw, O); return zC + gradeM * dot(q, uM) - c * Math.abs(dot(q, Ym)); };
  D.zMain = zMain;
  D.devers = { mode: 'plan', p, d: c, g, zC, gradeM, minRadial: c, maxRadial: c, maxTransverse: c, branches: [] };
  D.mainProfile = [];
  for (let k = 0; k <= 60; k++) {
    const X = -P.LA + ((P.LA + P.LB) * k) / 60;
    D.mainProfile.push({ x: X, zAxe: zC + gradeM * X, zBord: zC + gradeM * X - c * P.half });
  }
  const Pp = (o) => D.prims.push(o);
  const arrow = (pt, dir, len, label, h = TH * 0.8) => Pp({ k: 'arrow', L: 'DEVERS', p: pt, dir, len, text: label, h, rot: upright(G.ang(dir)) });

  // Flèches de dévers sur la route principale (toit), hors débouché.
  for (const X of [-(P.LA - 8), -(P.Lm + 8), P.Lm + 8, P.LB - 8]) {
    for (const sg of [1, -1]) {
      const dir = mul(Ym, sg);
      arrow(add(D.main.toW(X, sg * P.half / 2), mul(dir, -1)), dir, 2, pct(c), TH * 0.7);
    }
  }
  if (gradeM) arrow(D.main.toW(-(P.Lm + 20), -(P.hw + 1.5 * TH)), mul(uM, gradeM < 0 ? 1 : -1), 6, `pente ${pct(Math.abs(gradeM))}`, TH * 0.8);

  for (const bd of D.branches) {
    if (bd.role !== 'secondaire') continue;
    // Pente de la chaussée principale au droit du débouché, suivant la direction transversale de la branche.
    const grad = sub(mul(uM, gradeM), mul(Ym, c * bd.sY));
    branchDevers(prj, D, bd, {
      z0: zMain(bd.W({ x: bd.x0, y: 0 })),
      d0In: dot(grad, bd.n), d0Out: -dot(grad, bd.n),
      defGrade: -p * dot(bd.u, g),
      base: (Pw, x) => (x <= bd.x0 + 1e-6 ? zMain(Pw) : null),
      arrow, TH,
    });
  }
  pointHeights(D, zMain);
}
