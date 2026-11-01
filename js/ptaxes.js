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
import { crossSectionFrom, ptParams, areas } from './pt.js';

const num = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);

export function typeParams(prj) {
  const p = prj.pt || {};
  return { dev: Math.max(0, num(p.dev, 2.5)) / 100, bermeP: Math.max(0, num(p.bermeP, 8)) / 100, ech: Math.max(0, num(p.ech, 0)) };
}

// Profil type d'un axe : { kind, bands: [{ w, label, paved }] (de l'axe vers l'extérieur, par côté), C (Rm, Rdn), single }.
export function axisType(prj, D, key) {
  if (key === 'hwy' || key.startsWith('x:')) {
    let H, C, name;
    if (key === 'hwy') { H = { ...hwyParams(prj), kind: 'autoroute' }; name = 'autoroute'; }
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

// Ligne de fond de forme : la ligne projet abaissée de e sous les bandes revêtues (marches verticales aux bords).
function formeLine(proj, e) {
  if (!(e > 0)) return proj;
  // un segment est revêtu si son extrémité extérieure (|y| le plus grand) termine une bande revêtue
  const paved = (i) => { if (i < 0 || i + 1 >= proj.length) return false; const a = proj[i], b = proj[i + 1]; return Math.abs(b.y) >= Math.abs(a.y) ? !!b.paved : !!a.paved; };
  const out = [];
  proj.forEach((q, i) => {
    const l = paved(i - 1), r = paved(i);
    if (l && r) out.push({ ...q, z: q.z - e });
    else if (!l && !r) out.push(q);
    else out.push({ ...q, z: l ? q.z - e : q.z }, { ...q, z: r ? q.z - e : q.z });
  });
  return out;
}

// Coupes aux profils implantés d'un axe : [{ name, s, cs, cut, fill, vCut, vFill }] et totaux.
export function axisSections(prj, D, ax, A, profs, tin) {
  const P = ptParams(prj), TP = typeParams(prj), T = axisType(prj, D, ax.key), out = [];
  if (!A?.defined) return { list: out, T, err: 'profil en long non défini' };
  for (const q of profs) {
    const zA = A.PL.zAt(q.s), pf = axisPlatform(prj, D, ax, T, q.s, zA, TP);
    const edge = Math.max(...pf.line.map((r) => Math.abs(r.y)));
    const cs = crossSectionFrom(pf, tin, { ...P, halfW: Math.max(P.halfW, edge + 35) });
    cs.s = q.s; cs.name = q.name; cs.zAxe = zA; cs.dev = pf.dev;
    if (TP.ech > 0 && cs.ok) { const ar = areas(formeLine(cs.proj, TP.ech), cs.tn); cs.cutS = cs.cut; cs.fillS = cs.fill; cs.cut = ar.cut; cs.fill = ar.fill; }
    out.push(cs);
  }
  let vc = 0, vf = 0;
  out.forEach((cs, i) => { if (i) { const d = cs.s - out[i - 1].s; vc += ((cs.cut + out[i - 1].cut) / 2) * d; vf += ((cs.fill + out[i - 1].fill) / 2) * d; } cs.vCut = vc; cs.vFill = vf; });
  return { list: out, T, vCut: vc, vFill: vf };
}

// Texte du profil type d'un axe.
export function typeText(T, TP) {
  const side = (b) => b.map((q) => q.label).join(' + ');
  return `${T.single ? `gauche : ${side(T.left)} | droite : ${side(T.right)}` : `par côté : ${side(T.left)}`} ; dévers ${fmt(TP.dev * 100, 1)} % en alignement (${T.single ? 'dévers unique' : 'en toit'}), en courbe de rayon < ${fmt(T.C.Rdn, 0)} m de 2,5 à 7 % (7 % à ${fmt(T.C.R7 || T.C.Rm, 0)} m) vers l'intérieur ; bermes ${fmt(TP.bermeP * 100, 0)} %${TP.ech > 0 ? ` ; cubatures au fond de forme (chaussée ${fmt(TP.ech, 2)} m)` : ''}`;
}
