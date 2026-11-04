// ptaxes.js — profils types, dévers et coupes en travers des axes de l'échangeur (autoroute, voies secondaires,
// bretelles) aux profils implantés (onglet Implantation), avec cubatures par la méthode des aires moyennes.
// Profil type (largeurs des paramètres de chaque axe) :
//   • autoroute, voie secondaire de type autoroute : TPC, BDG, voies, BAU, berme, de chaque côté de l'axe (milieu du
//     TPC) ; en alignement et en courbe de rayon ≥ Rdn : chaque chaussée penche vers l'extérieur (dévers d'alignement) ;
//     en courbe de rayon < Rdn : toute la plate-forme penche vers l'intérieur, dévers d(R) du guide (linéaire en 1/R
//     entre 2,5 % à Rdn et 7 % à Rm).
//   • route ordinaire : voies et BDD de part et d'autre de l'axe, profil en toit en alignement, déversé en courbe
//     (Rdn ≈ 900 m, Rm ≈ 240 m : ordre de grandeur ARP R80, à ajuster) ;
//   • bretelle : voie centrée sur l'axe, BDG à gauche et BDD à droite ; dévers unique (vers la droite en alignement,
//     vers l'intérieur en courbe), d(R) de la catégorie de la bretelle.
//   Bermes à 8 % vers l'extérieur ; talus de remblai et de déblai, fossé en déblai (réglages de l'onglet Profils en
//   travers) ; épaisseur de chaussée : les cubatures sont comptées au fond de forme, sous la chaussée et les accotements
//   revêtus.
import * as G from './geom.js';
import { fmt } from './common.js';
import { hwyParams, crossParams, crossList, RAMP_CAT, deversOfRadius } from './echangeur.js';
import { DCAT, designCatOf, deversAt } from './roadcat.js';
import { ptParams, areas, terrainLine, tnAt } from './pt.js';
import { tinZ } from './tin.js';
import { autoProfile, findProfile, assignedId, sectionFromTypes, evaluate } from './ptype.js';

const num = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);

export function typeParams(prj) {
  const p = prj.pt || {};
  return { dev: Math.max(0, num(p.dev, 2.5)) / 100, bermeP: Math.max(0, num(p.bermeP, 8)) / 100, ech: Math.max(0, num(p.ech, 0)) };
}

// Profil type d'un axe : { kind, bands: [{ w, label, paved }] (de l'axe vers l'extérieur, par côté), C (Rm, Rdn), single }.
export function axisType(prj, D, key) {
  if (key === 'hwy' || key.startsWith('x:')) {
    let H, C, name;
    if (key === 'hwy') { H = hwyParams(prj); name = H.kind === 'autoroute' ? 'autoroute' : 'route'; }
    else { const k = crossList(prj).findIndex((c) => `x:${c.id}` === key); H = crossParams(prj, Math.max(0, k)); name = H.kind === 'autoroute' ? 'autoroute' : 'route'; }
    const cat = designCatOf(H), Dc = DCAT[cat];
    C = { Rm: Dc.Rm, Rdn: Dc.noSuper ? Infinity : Dc.Rdn, cat };
    const side = [];
    if (H.median > 0) side.push({ w: H.median / 2, label: 'îlot TPC', paved: false, flat: true });
    if (H.bdg > 0) side.push({ w: H.bdg, label: `BDG ${fmt(H.bdg, 2)}`, paved: true });
    side.push({ w: H.lanes * H.wLane, label: `voies ${H.lanes} × ${fmt(H.wLane, 2)}`, paved: true });
    if (H.bau > 0) side.push({ w: H.bau, label: `BDD ${fmt(H.bau, 2)}${name === 'autoroute' ? ' (BAU)' : ''}`, paved: true });
    if (H.berme > 0) side.push({ w: H.berme, label: `berme ${fmt(H.berme, 2)}`, paved: false, berme: true });
    return { kind: name, left: side, right: side, C, cat, single: false };
  }
  const r = (prj.ramps || []).find((q) => `r:${q.id}` === key), C = RAMP_CAT[r?.cat] || RAMP_CAT.b70;
  const w = (num(r?.lanes, C.lanes) || 1) * 3.5 + (C.two ? 0 : 0), bdd = num(r?.bdd, C.bdd), bdg = num(r?.bdg, C.bdg), berme = num(r?.berme, 0.75);
  const half = w / 2;
  const L = [{ w: half, label: `voie ${fmt(w, 2)}`, paved: true }, ...(bdg > 0 ? [{ w: bdg, label: `BDD ${fmt(bdg, 2)} (BDG)`, paved: true }] : []), ...(berme > 0 ? [{ w: berme, label: `berme ${fmt(berme, 2)}`, paved: false, berme: true }] : [])];
  const R = [{ w: half, label: `voie ${fmt(w, 2)}`, paved: true }, ...(bdd > 0 ? [{ w: bdd, label: `BDD ${fmt(bdd, 2)}`, paved: true }] : []), ...(berme > 0 ? [{ w: berme, label: `berme ${fmt(berme, 2)}`, paved: false, berme: true }] : [])];
  return { kind: 'bretelle', left: L, right: R, C, single: true };
}

// Courbure signée (gauche > 0) de l'axe à l'abscisse s, par différence des tangentes sur ± 2 m.
function curvature(ax, s) {
  const a = Math.max(0, s - 2), b = Math.min(ax.len, s + 2);
  if (b - a < 0.5) return 0;
  const ta = ax.at(a).t, tb = ax.at(b).t;
  return Math.atan2(G.cross(ta, tb), G.dot(ta, tb)) / (b - a);
}

// Plate-forme { line: [{ y, z, label }], p, t, n, dev } à l'abscisse s ; zAxe = cote du profil en long.
export function axisPlatform(prj, D, ax, T, s, zAxe, TP = typeParams(prj)) {
  const { p, t } = ax.at(s), n = G.rot90(t);
  let slope, dev;
  if (T.cat && ax.al) {
    // autoroute / voie secondaire : dévers de la catégorie, variation linéaire sur la clothoïde (roadcat.js)
    const dv = deversAt(T.cat, ax.al, s, TP.dev * 100);
    slope = (sd) => (sd === 1 ? dv.left : dv.right) / 100;
    dev = { d: (dv.inner ? dv.d : TP.dev * 100) / 100, inner: dv.inner && dv.f > 0 ? dv.inner : 0, R: dv.R, f: dv.f, left: dv.left / 100, right: dv.right / 100 };
  } else {
    const k = curvature(ax, s), R = Math.abs(k) > 1e-9 ? 1 / Math.abs(k) : Infinity;
    const dC = deversOfRadius(R, T.C) / 100, curve = R < T.C.Rdn;
    const inner = k > 0 ? 1 : -1; // côté intérieur de la courbe (1 = gauche)
    // pente transversale (dz/dy, y vers l'extérieur du côté sd) d'une bande revêtue
    slope = (sd) => (curve ? (sd === inner ? -dC : dC) : T.single ? (sd === 1 ? TP.dev : -TP.dev) : -TP.dev);
    dev = curve ? { d: dC, inner, R, left: slope(1), right: slope(-1) } : { d: TP.dev, R, left: slope(1), right: slope(-1) };
  }
  const half = [];
  for (const sd of [1, -1]) {
    const bands = sd === 1 ? T.left : T.right, pts = [{ y: 0, z: zAxe, label: 'axe' }];
    let y = 0, z = zAxe;
    for (const b of bands) {
      const g = b.flat ? 0 : b.berme ? -TP.bermeP : slope(sd);
      y += sd * b.w; z += g * b.w;
      pts.push({ y, z, label: b.label, paved: b.paved });
    }
    half.push(pts);
  }
  return { line: [...half[1].slice().reverse(), ...half[0].slice(1)], p, t, n, dev };
}

// Demi-largeur construite d'un demi-profil (points calculables sans TN, dévers de 2,5 %).
const widthCache = new WeakMap();
function profWidth(prof) {
  if (!widthCache.has(prof)) widthCache.set(prof, Math.max(0, ...[...evaluate(prof.cons, 'R', null, { devers: -0.025 }).values()].filter((r) => r.ok).map((r) => Math.abs(r.x))));
  return widthCache.get(prof);
}

// Coupe d'un axe à partir de sa plate-forme (repère, dévers) et des deux demi-profils types (ptype.js) : talus jusqu'au
// TN par la condition D/R, cubatures entre le TN et la ligne de terrassement (arase sous la chaussée, projet ailleurs).
function typedSection(pf, tin, halfW, zA, L, R, clip = null) {
  const tl = terrainLine(tin, pf.p, pf.n, halfW), hasTN = tl.some((q) => q.z != null);
  const S = sectionFromTypes({ p: pf.p, n: pf.n, zA, dev: pf.dev, tl, tnAt, halfW, left: L, right: R });
  const cutBy = clip && hasTN ? clip(S, pf, tl) : [];
  const ar = hasTN ? areas(S.terr, tl) : { cut: 0, fill: 0 }, arS = hasTN && S.arase.length ? areas(S.proj, tl) : null;
  return {
    s: 0, p: pf.p, n: pf.n, platform: S.platform, proj: S.proj, arase: S.arase, terr: S.terr, tn: tl, cut: ar.cut, fill: ar.fill,
    ...(arS ? { cutS: arS.cut, fillS: arS.fill } : {}), endL: S.endL, endR: S.endR, branch: S.branch, ok: hasTN,
    zAxe: zA, zTN: tin ? tinZ(tin, pf.p.x, pf.p.y) : null, halfW, types: { left: L.name, right: R.name }, cutBy,
  };
}

// Talus qui chevauche celui d'un autre axe : la coupe s'arrête à la limite où l'autre axe l'emporte (sa plate-forme,
// son remblai plus haut, son déblai plus profond, son remblai sur notre déblai), par un talus vertical jusqu'au TN —
// le terrassement au-delà appartient à l'autre axe et n'est pas compté deux fois. Modifie S (proj, terr, arase, ends) ;
// rend [{ side, y, by }].
function clipOverlaps(S, pf, tl, key, idx) {
  const out = [], W = (y) => ({ x: pf.p.x + pf.n.x * y, y: pf.p.y + pf.n.y * y });
  const zOn = (L, y) => { for (let i = 1; i < L.length; i++) { const a = L[i - 1], b = L[i]; if ((y - a.y) * (y - b.y) <= 0 && Math.abs(b.y - a.y) > 1e-9) return a.z + ((b.z - a.z) * (y - a.y)) / (b.y - a.y); } return null; };
  const tn = (y) => tnAt(tl, y);
  for (const sd of [1, -1]) {
    const plat = S.platform.filter((q) => Math.sign(q.y) === sd || Math.abs(q.y) < 1e-9), y0 = plat.length ? Math.max(...plat.map((q) => Math.abs(q.y))) : 0;
    const side = S.proj.filter((q) => Math.sign(q.y) === sd), y1 = side.length ? Math.max(...side.map((q) => Math.abs(q.y))) : 0;
    if (!(y1 > y0 + 0.05)) continue;
    const owner = (a) => { const y = sd * a, z = zOn(S.proj, y), t = tn(y); if (z == null || t == null) return null; const w = W(y); return idx.owner(w.x, w.y, z, z >= t ? 'R' : 'D', key); };
    let prev = y0 + 0.01, by = null, a = prev;
    for (; a <= y1 + 1e-9; a += 0.25) { by = owner(Math.min(a, y1)); if (by) break; prev = Math.min(a, y1); }
    if (!by) continue;
    let lo = prev, hi = Math.min(a, y1);
    for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (owner(m)) hi = m; else lo = m; }
    const yc = sd * lo, zt = tn(yc);
    if (zt == null) continue;
    const cut = (L) => {
      if (!L.length) return L;
      const z = zOn(L, yc); if (z == null) return L;
      const keep = L.filter((q) => Math.sign(q.y) !== sd || Math.abs(q.y) < lo - 1e-6);
      const ext = [{ y: yc, z, label: '', m: 'vert' }, { y: yc, z: zt, label: 'talus vertical', m: 'vert', br: z >= zt ? 'R' : 'D' }];
      return sd > 0 ? [...keep, ...ext] : [...ext.reverse(), ...keep];
    };
    S.proj = cut(S.proj); S.terr = cut(S.terr);
    const e = { y: yc, z: zt, br: zOn(S.proj, yc) >= zt ? 'R' : 'D', vert: true, by };
    if (sd > 0) S.endR = e; else S.endL = e;
    out.push({ side: sd > 0 ? 'gauche' : 'droite', y: lo, by });
  }
  return out;
}

// Coupes aux profils implantés d'un axe : [{ name, s, cs, cut, fill, vCut, vFill }] et totaux. Profil type de chaque
// côté : celui de la bibliothèque affecté à l'axe (ou à la plage d'abscisses), sinon le profil automatique.
// opts.neighbors : earthworkIndex (talus.js) des autres axes — talus vertical à la limite des talus qui se chevauchent.
export function axisSections(prj, D, ax, A, profs, tin, opts = {}) {
  const P = ptParams(prj), TP = typeParams(prj), T = axisType(prj, D, ax.key), out = [];
  if (!A?.defined) return { list: out, T, err: 'profil en long non défini' };
  const auto = { 1: autoProfile(T, 1, TP, P, 'Automatique'), [-1]: autoProfile(T, -1, TP, P, 'Automatique') };
  const used = new Set();
  for (const q of profs) {
    const zA = A.PL.zAt(q.s), pf = axisPlatform(prj, D, ax, T, q.s, zA, TP);
    const L = findProfile(prj, assignedId(prj, ax.key, q.s, 1)) || auto[1], R = findProfile(prj, assignedId(prj, ax.key, q.s, -1)) || auto[-1];
    if (!L.auto) used.add(L.name); if (!R.auto) used.add(R.name);
    const edge = Math.max(profWidth(L), profWidth(R));
    const cs = typedSection(pf, tin, Math.max(P.halfW, edge + 35), zA, L, R, opts.neighbors ? (S, pf2, tl) => clipOverlaps(S, pf2, tl, ax.key, opts.neighbors) : null);
    cs.s = q.s; cs.name = q.name; cs.dev = pf.dev;
    out.push(cs);
  }
  let vc = 0, vf = 0;
  out.forEach((cs, i) => { if (i) { const d = cs.s - out[i - 1].s; vc += ((cs.cut + out[i - 1].cut) / 2) * d; vf += ((cs.fill + out[i - 1].fill) / 2) * d; } cs.vCut = vc; cs.vFill = vf; });
  return { list: out, T, vCut: vc, vFill: vf, used: [...used] };
}

// Texte du profil type d'un axe.
export function typeText(T, TP) {
  const side = (b) => b.map((q) => q.label).join(' + ');
  return `${T.single ? `gauche : ${side(T.left)} | droite : ${side(T.right)}` : `par côté : ${side(T.left)}`} ; dévers ${fmt(TP.dev * 100, 1)} % en alignement (${T.single ? 'dévers unique' : 'en toit'}), en courbe de rayon < ${fmt(T.C.Rdn, 0)} m de 2,5 à 7 % (7 % à ${fmt(T.C.R7 || T.C.Rm, 0)} m) vers l'intérieur ; bermes ${fmt(TP.bermeP * 100, 0)} %${TP.ech > 0 ? ` ; cubatures au fond de forme (chaussée ${fmt(TP.ech, 2)} m)` : ''}`;
}
