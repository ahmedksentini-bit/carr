// ptype.js — profils en travers types construits point par point, repris de BVTrace (TypicalCrossSections.cs et
// l'éditeur de construction TypicalSectionEditorWindow).
//
// Un profil type se compose de deux demi-profils (gauche, droite), chacun construit depuis l'axe (point de rotation
// du dévers) vers l'extérieur par une suite de points :
//   • origine, point libre : coordonnées absolues (x vers l'extérieur, z relatif à la cote de l'axe) ;
//   • ΔX / ΔZ : décalage depuis un point de référence ;
//   • ΔX / pente : décalage horizontal et pente, fixe (en %) ou prise sur le dévers de la chaussée de ce côté à la
//     station (variation sur les clothoïdes, courbes déversées) ;
//   • pente → TN : talus de pente donnée jusqu'au terrain naturel (point d'entrée en terre, EET) ;
//   • condition D/R : le point de test (bord de plate-forme) est comparé au TN ; selon qu'il est au-dessus ou en
//     dessous, seuls les points de la branche remblai (R) ou déblai (D) sont construits, avec les points communs (C).
// Deux lignes relient les points : la ligne Projet (surface finie, talus compris) et la ligne Arase (fond de forme,
// sous la chaussée). Les couches de chaussée (nom, matériau, épaisseur) donnent la profondeur de l'arase des profils
// construits automatiquement. Les cubatures se comptent entre le TN et la ligne de terrassement : la ligne Arase
// là où elle existe, la ligne Projet ailleurs (marches verticales aux extrémités de l'arase).
//
// Bibliothèque du projet (prj.ptt) : { profiles: [{ id, name, layers, cons }], axes: { [clé d'axe]: { left, right,
// ranges: [{ s0, s1, left, right }] } } } ; identifiant vide = profil automatique (paramètres de l'axe et réglages
// de l'onglet Profils en travers : talus, fossé, bermes, épaisseur de chaussée).

export const METHODES = [
  ['origine', 'Origine'], ['libre', 'Point libre'], ['dxdz', 'ΔX / ΔZ'], ['dxpente', 'ΔX / pente'], ['tn', 'Pente → TN'], ['cond', 'Condition D/R'],
];
export const BRANCHES = [['C', 'commun'], ['R', 'remblai'], ['D', 'déblai']];
export const methodeLib = (m) => (METHODES.find((q) => q[0] === m) || [m, m])[1];

const uid = () => Math.random().toString(36).slice(2, 10);
const num = (v, d = 0) => (v === '' || v == null || !isFinite(+v) ? d : +v);

export function defaultLayers() {
  return [
    { nom: 'Roulement', mat: 'BB', e: 0.05, color: '#424B57' },
    { nom: 'Base', mat: 'GB', e: 0.15, color: '#7B8794' },
    { nom: 'Fondation', mat: 'GNT', e: 0.25, color: '#B49A72' },
    { nom: 'Couche de forme', mat: 'Sol sélectionné', e: 0.3, color: '#D8C59B' },
  ];
}
export const layersDepth = (layers) => (layers || []).reduce((a, l) => a + Math.max(0, num(l.e)), 0);

export function newPoint(q = {}) {
  return { id: uid(), parent: null, m: 'dxpente', br: 'C', code: 'Point', zone: '', x: 0, z: 0, dx: 0, dz: 0, p: 0, src: 'fixe', ...q };
}

// Graphe de construction depuis une suite de bandes [{ w, code, mode: 'devers' | 'fixe', p (%), zone, arase }] :
// bandes depuis l'axe, condition D/R au bord extérieur, EET de remblai (pente −1/remblai), fossé éventuel puis EET de
// déblai (pente 1/déblai) ; arase à la profondeur depth sous les bandes marquées arase (marches à leurs extrémités).
export function consFromBands(bands, o = {}) {
  const points = [], project = [], arase = [];
  const add = (q) => { const r = newPoint(q); points.push(r); return r; };
  const o0 = add({ m: 'origine', code: 'Axe', zone: 'AXE', z: num(o.z0) });
  project.push(o0.id);
  let par = o0;
  const ends = [o0];
  for (const b of bands) {
    // bande à pente (dévers de la chaussée ou pente fixe) ou décrochement ΔX / ΔZ (face de bordure : dz ≠ 0)
    par = b.dz != null ? add({ parent: par.id, m: 'dxdz', dx: num(b.w), dz: num(b.dz), code: b.code, zone: b.zone || '' })
      : add({ parent: par.id, m: 'dxpente', dx: b.w, p: b.mode === 'devers' ? 0 : num(b.p), src: b.mode === 'devers' ? 'devers' : 'fixe', code: b.code, zone: b.zone || '' });
    project.push(par.id); ends.push(par);
  }
  const depth = num(o.depth);
  if (depth > 0) {
    const under = new Set();
    bands.forEach((b, i) => { if (b.arase) { under.add(i); under.add(i + 1); } });
    for (const i of [...under].sort((a, b) => a - b)) arase.push(add({ parent: ends[i].id, m: 'dxdz', dx: 0, dz: -depth, code: `Arase ${ends[i].code}`, zone: 'ARASE' }).id);
  }
  const cond = add({ parent: par.id, m: 'cond', code: 'Condition D/R' });
  const eR = add({ parent: cond.id, m: 'tn', br: 'R', p: -100 / Math.max(0.1, num(o.remblai, 1.5)), code: 'EET remblai', zone: 'TALUS' });
  const fos = num(o.fosse) > 0 ? add({ parent: cond.id, m: 'dxdz', br: 'D', dx: Math.max(0.3, num(o.fosseW, 1.5)) / 2, dz: -num(o.fosse), code: 'Fond de fossé', zone: 'FOSSE' }) : null;
  const eD = add({ parent: (fos || cond).id, m: 'tn', br: 'D', p: 100 / Math.max(0.1, num(o.deblai, 1)), code: 'EET déblai', zone: 'TALUS' });
  project.push(eR.id); if (fos) project.push(fos.id); project.push(eD.id);
  return { points, project, arase, test: par.id };
}

// Nouveau demi-profil de la bibliothèque : BDG 0,50, une voie de 3,50 au dévers, accotement 2,00 à 4 %, berme 1,00
// à 8 %, talus 3/2 en remblai et 1/1 en déblai, arase sous la chaussée et l'accotement (couches par défaut).
export function newProfile(name = 'Demi-profil') {
  const layers = defaultLayers();
  const bands = [
    { w: 0.5, code: 'BDG', mode: 'devers', zone: 'CHAUSSEE', arase: true },
    { w: 3.5, code: 'Voie', mode: 'devers', zone: 'CHAUSSEE', arase: true },
    { w: 2, code: 'Accotement', mode: 'fixe', p: -4, zone: 'ACCOTEMENT', arase: true },
    { w: 1, code: 'Berme', mode: 'fixe', p: -8, zone: 'BERME' },
  ];
  return { id: uid(), name, layers, cons: consFromBands(bands, { remblai: 1.5, deblai: 1, depth: layersDepth(layers) }) };
}

// Profil automatique d'un côté d'un axe (sd = 1 gauche, −1 droite) depuis son profil type paramétrique (ptaxes.axisType)
// et les réglages de l'onglet : voies et accotements revêtus au dévers, îlot du TPC à plat, bermes à TP.bermeP ;
// arase à TP.ech sous les bandes revêtues ; talus et fossé de ptParams.
export function autoProfile(T, sd, TP, P, name = 'Automatique') {
  const src = sd === 1 ? T.left : T.right;
  const bands = src.map((b) => ({
    w: b.w, code: b.label, mode: b.flat || b.berme ? 'fixe' : 'devers', p: b.flat ? 0 : b.berme ? -TP.bermeP * 100 : 0,
    zone: b.flat ? 'TPC' : b.berme ? 'BERME' : 'CHAUSSEE', arase: !!b.paved,
  }));
  const layers = TP.ech > 0 ? [{ nom: 'Chaussée', mat: '', e: TP.ech, color: '#7B8794' }] : [];
  return { id: '', auto: true, name, layers, cons: consFromBands(bands, { remblai: P.remblai, deblai: P.deblai, fosse: P.fosse, fosseW: P.fosseW, depth: TP.ech }) };
}

// ------------------------------------------------------------------------------------------------ Évaluation
// Pente (%) d'un point ΔX / pente : fixe, ou dévers de la chaussée de ce côté (ctx.devers, m/m, > 0 montant vers
// l'extérieur) augmenté de la pente saisie (0 par défaut).
const slopeOf = (q, ctx) => (q.src === 'devers' ? num(ctx.devers, -0.025) * 100 + num(q.p) : num(q.p));

// Intersection de la droite issue de (x0, z0), de pente p (%), avec le TN relatif tnRel(x), vers l'extérieur.
function hitTN(x0, z0, p, tnRel, xmax) {
  const F = (x) => { const t = tnRel(x); return t == null ? NaN : z0 + ((x - x0) * p) / 100 - t; };
  let xa = x0, fa = F(xa);
  if (!isFinite(fa)) return null;
  if (Math.abs(fa) < 1e-9) return { x: x0, z: z0 };
  const step = 0.25;
  for (let xb = x0 + step; xb <= xmax + 1e-9; xb += step) {
    const fb = F(xb);
    if (!isFinite(fb)) return null; // le TN s'arrête : pas d'entrée en terre connue
    if (fa * fb <= 0) {
      let lo = xa, hi = xb, flo = fa;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2, fm = F(mid); if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; } }
      const x = (lo + hi) / 2;
      return { x, z: z0 + ((x - x0) * p) / 100 };
    }
    xa = xb; fa = fb;
  }
  return null;
}

// Évalue tous les points pour la branche br ('R' ou 'D') : Map id → { ok, x, z, q, hors (autre branche) }.
// tnRel(x) : cote du TN relative à l'axe à la distance x vers l'extérieur (null hors MNT) ; ctx : { devers, xmax }.
export function evaluate(cons, br, tnRel, ctx = {}) {
  const byId = new Map(cons.points.map((q) => [q.id, q])), out = new Map(), busy = new Set();
  const xmax = num(ctx.xmax, 60);
  const ev = (q) => {
    if (out.has(q.id)) return out.get(q.id);
    let r = { ok: false, x: NaN, z: NaN, q };
    if (q.br !== 'C' && q.br !== br) r.hors = true;
    else if (q.m === 'origine' || q.m === 'libre') r = { ok: true, x: num(q.x), z: num(q.z), q };
    else {
      const pq = byId.get(q.parent);
      if (pq && !busy.has(q.id)) {
        busy.add(q.id);
        const pr = ev(pq);
        busy.delete(q.id);
        if (pr.ok) {
          if (q.m === 'dxdz') r = { ok: true, x: pr.x + num(q.dx), z: pr.z + num(q.dz), q };
          else if (q.m === 'dxpente') r = { ok: true, x: pr.x + num(q.dx), z: pr.z + (num(q.dx) * slopeOf(q, ctx)) / 100, q };
          else if (q.m === 'cond') r = { ok: true, x: pr.x, z: pr.z, q };
          else if (q.m === 'tn' && tnRel) { const h = hitTN(pr.x, pr.z, num(q.p), tnRel, xmax); if (h) r = { ok: true, ...h, q }; }
        }
      }
    }
    out.set(q.id, r);
    return r;
  };
  cons.points.forEach(ev);
  return out;
}

// Point de test D/R : celui désigné, sinon le dernier point commun de la ligne Projet (hors condition et talus).
export function testPoint(cons, ev) {
  const t = cons.test && ev.get(cons.test);
  if (t?.ok) return t;
  return cons.project.map((id) => ev.get(id)).filter((r) => r?.ok && r.q.br === 'C' && r.q.m !== 'tn' && r.q.m !== 'cond').sort((a, b) => b.x - a.x)[0] || null;
}

// Demi-profil construit : { br ('R', 'D' ou null si le TN manque au point de test), proj, arase, eet, ev, test }.
// Lignes : [{ x, z, code, zone, m, br, id }] dans l'ordre de la ligne, points calculables seulement.
export function halfSection(prof, tnRel, ctx = {}) {
  const c = prof.cons, evR = evaluate(c, 'R', tnRel, ctx);
  const test = testPoint(c, evR);
  let br = 'R';
  if (c.points.some((q) => q.m === 'cond')) {
    const t = test && tnRel ? tnRel(test.x) : null;
    br = t == null ? null : test.z >= t - 1e-9 ? 'R' : 'D';
  }
  const ev = br === 'D' ? evaluate(c, 'D', tnRel, ctx) : evR;
  const line = (ids) => ids.map((id) => ev.get(id)).filter((r) => r?.ok).map((r) => ({ x: r.x, z: r.z, code: r.q.code, zone: r.q.zone, m: r.q.m, br: r.q.br, id: r.q.id }));
  const proj = line(c.project), arase = line(c.arase || []);
  const e = [...ev.values()].filter((r) => r.ok && r.q.m === 'tn').sort((a, b) => b.x - a.x)[0];
  return { br, proj, arase, eet: e ? { x: e.x, z: e.z, br: e.q.br } : null, ev, test };
}

// Interpolation linéaire d'une ligne [{ x, z }] croissante en x (marche verticale : plus haute des deux cotes).
function zOnLine(L, x) {
  for (let i = 0; i + 1 < L.length; i++) {
    const a = L[i], b = L[i + 1];
    if (x >= a.x - 1e-9 && x <= b.x + 1e-9) return b.x - a.x < 1e-9 ? Math.max(a.z, b.z) : a.z + ((x - a.x) / (b.x - a.x)) * (b.z - a.z);
  }
  return null;
}
// Ligne de terrassement d'un demi-profil : Projet avant l'arase, Arase, Projet après (marches verticales).
export function terrHalf(proj, arase) {
  if (!arase.length) return proj;
  const a0 = arase[0].x, a1 = arase[arase.length - 1].x, out = proj.filter((q) => q.x < a0 - 1e-6);
  const z0 = zOnLine(proj, a0);
  if (a0 > 1e-6 && z0 != null) out.push({ ...arase[0], z: z0 });
  out.push(...arase);
  const z1 = zOnLine(proj, a1);
  if (z1 != null) out.push({ ...arase[arase.length - 1], z: z1 });
  out.push(...proj.filter((q) => q.x > a1 + 1e-6));
  return out;
}

// Libellé d'un point dans la coupe complète (pt.js : graphique, DXF, nature des surfaces).
const labelOf = (q) => (q.m === 'tn' ? (q.br === 'D' ? 'déblai' : 'remblai') : q.zone === 'FOSSE' ? 'fossé' : q.code || '');

// Coupe complète à partir des deux demi-profils : o = { p, n, zA, dev: { left, right }, tl (TN de pt.terrainLine),
// tnAt, halfW, left, right (profils) }. Repère : y > 0 à gauche (sd = 1), y < 0 à droite.
export function sectionFromTypes(o) {
  const H = {};
  for (const sd of [1, -1]) {
    const tnRel = o.tl ? (x) => { const z = o.tnAt(o.tl, sd * x); return z == null ? null : z - o.zA; } : null;
    H[sd] = halfSection(sd === 1 ? o.left : o.right, tnRel, { devers: sd === 1 ? o.dev.left : o.dev.right, xmax: o.halfW });
  }
  const map = (sd, L) => L.map((q) => ({ y: sd * q.x, z: o.zA + q.z, label: labelOf(q), code: q.code, zone: q.zone, m: q.m, br: q.br }));
  const join = (Lr, Ll) => {
    const r = map(-1, Lr).reverse(), l = map(1, Ll);
    if (r.length && l.length && Math.abs(r[r.length - 1].y) < 1e-6 && Math.abs(l[0].y) < 1e-6 && Math.abs(r[r.length - 1].z - l[0].z) < 1e-6) l.shift();
    return [...r, ...l];
  };
  const proj = join(H[-1].proj, H[1].proj);
  const arase = H[-1].arase.length || H[1].arase.length ? join(H[-1].arase, H[1].arase) : [];
  const terr = join(terrHalf(H[-1].proj, H[-1].arase), terrHalf(H[1].proj, H[1].arase));
  const platform = proj.filter((q) => q.br === 'C' && q.m !== 'tn' && q.m !== 'cond');
  const eet = (sd) => (H[sd].eet ? { y: sd * H[sd].eet.x, z: o.zA + H[sd].eet.z, br: H[sd].eet.br } : null);
  return { proj, arase, terr, platform, endL: eet(-1), endR: eet(1), branch: { left: H[1].br, right: H[-1].br }, halves: H };
}

// ------------------------------------------------------------------------------------------------ Bibliothèque
export const pttProfiles = (prj) => prj.ptt?.profiles || [];
export const findProfile = (prj, id) => (id ? pttProfiles(prj).find((p) => p.id === id) || null : null);
// Identifiant du profil affecté au côté sd (1 gauche, −1 droite) de l'axe key à l'abscisse s ('' = automatique) :
// dernière plage qui contient s, sinon le profil courant de l'axe.
export function assignedId(prj, key, s, sd) {
  const A = prj.ptt?.axes?.[key];
  if (!A) return '';
  const r = (A.ranges || []).filter((q) => s >= Math.min(num(q.s0), num(q.s1)) - 1e-6 && s <= Math.max(num(q.s0), num(q.s1)) + 1e-6).pop();
  const id = r ? (sd === 1 ? r.left : r.right) : sd === 1 ? A.left : A.right;
  return findProfile(prj, id) ? id : '';
}
// Copie profonde d'un profil (nouveaux identifiants de points, références et lignes conservées).
export function cloneProfile(p, name) {
  const map = new Map(p.cons.points.map((q) => [q.id, uid()])), id = (x) => (x ? map.get(x) || null : null);
  return {
    id: uid(), name: name ?? p.name, layers: (p.layers || []).map((l) => ({ ...l })),
    cons: { points: p.cons.points.map((q) => ({ ...q, id: map.get(q.id), parent: id(q.parent) })), project: p.cons.project.map(id).filter(Boolean), arase: (p.cons.arase || []).map(id).filter(Boolean), test: id(p.cons.test) },
  };
}
// Contrôles d'un profil avant validation : [] si correct, sinon messages.
export function profileIssues(p) {
  const c = p.cons, out = [];
  if (!c.points.some((q) => q.m === 'origine' || q.m === 'libre')) out.push('aucun point d\'origine');
  if (c.project.length < 2) out.push('la ligne Projet doit contenir au moins deux points');
  if (c.points.some((q) => q.m === 'cond')) {
    if (!c.points.some((q) => q.br === 'R' && q.m === 'tn')) out.push('la condition n\'a pas de branche remblai vers le TN');
    if (!c.points.some((q) => q.br === 'D' && q.m === 'tn')) out.push('la condition n\'a pas de branche déblai vers le TN');
  }
  const ids = new Set(c.points.map((q) => q.id));
  for (const q of c.points) if (!['origine', 'libre'].includes(q.m) && !ids.has(q.parent)) out.push(`« ${q.code} » : point de référence manquant`);
  return out;
}
