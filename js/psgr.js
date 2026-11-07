// psgr.js — carrefour avec passage souterrain à gabarit réduit (PSGR) : la route principale passe en trémie sous le
// carrefour (giratoire : sous l'îlot central ; carrefour plan T / X : sous la route secondaire), les autres mouvements
// restent en surface sur les voies latérales (contre-allées) qui alimentent le carrefour.
//
// Sources (Drive d'Ahmed, dossier PSGR) :
//  [LC71]   Lettre-circulaire du 28 juin 1971, programme de passages souterrains à gabarit réduit (classes de véhicules
//           < 1,90 m, 1,90 à 2,60 m, > 2,60 m). Le « Dossier-guide PSGR » du SETRA (annexe II) n'est pas disponible :
//           les valeurs propres aux types A et B non citées ailleurs sont alignées sur les classes RECTUR voisines.
//  [RECTUR] CETU, Recommandations pour la conception des tunnels urbains à gabarit réduit, sept. 1995 :
//           gabarits 2,00 / 2,70 / 3,50 m (ch. 4) ; revanche de signalisation 15 cm (2,00 et 2,70) et 20 cm (3,50),
//           10 cm PSGR type A, 15 cm PSGR type B à 2,60 m (ch. 5 C 2.3) ; revanche de protection 10 cm, de construction
//           et d'entretien 5 cm ; largeur à 1 m de hauteur = 2 × 1,20 (effet de paroi) + n × largeur des véhicules
//           (1,80 / 2,00 / 2,50) + (n − 1) × interdistance (1,00 à 60 km/h, 1,10 à 80) ; voies 2,80 / 3,00 / 3,50 m
//           (2,80 / 3,00 hors voie de droite) ; bandes dérasées ≥ 0,15 m ; trottoirs ≥ 0,60 m (0,75 m à piédroits
//           verticaux) ; déclivité 6 % (9 % sur < 30 m ; aux extrémités, 9 % jusqu'à une centaine de mètres pour les
//           gabarits 2,00 et 2,70, ch. 8 B 2) ; rayons saillants et rentrants minimaux (ch. 5 B 3.2 et 3.3).
//           RECTUR ne traite que les ouvrages unidirectionnels : un tube à double sens est vérifié avec les mêmes règles.
import * as G from './geom.js';

const { add, mul, rot90, neg, L } = G;
const num = (v, d) => (v === '' || v == null || !Number.isFinite(+v) ? d : +v);
const fmt = (v, k = 2) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(k).replace('.', ','));

// cls : classe RECTUR de référence pour les rayons rentrants et la largeur des véhicules.
export const PSGR_GAB = {
  A: { label: 'PSGR type A — 1,90 m (VL)', G: 1.9, rs: 0.10, wv: 1.8, wl: 2.8, wlo: 2.8, cls: 200, src: 'classe < 1,90 m [LC71] ; revanche 10 cm [RECTUR 5 C 2.3]' },
  B: { label: 'PSGR type B — 2,60 m (VL, fourgons)', G: 2.6, rs: 0.15, wv: 2.0, wl: 3.0, wlo: 2.8, cls: 270, src: 'type B 2,60 m et revanche 15 cm [RECTUR 4 B, 5 C 2.3]' },
  G200: { label: 'RECTUR 2,00 m', G: 2.0, rs: 0.15, wv: 1.8, wl: 2.8, wlo: 2.8, cls: 200, src: '[RECTUR 4 A, 5 C]' },
  G270: { label: 'RECTUR 2,70 m', G: 2.7, rs: 0.15, wv: 2.0, wl: 3.0, wlo: 2.8, cls: 270, src: '[RECTUR 4 B, 5 C]' },
  G350: { label: 'RECTUR 3,50 m (bus, secours)', G: 3.5, rs: 0.20, wv: 2.5, wl: 3.5, wlo: 3.0, cls: 350, src: '[RECTUR 4 C, 5 C]' },
  libre: { label: 'Gabarit libre', G: null, rs: null, wv: null, wl: null, wlo: null, cls: null, src: 'valeurs saisies' },
};

// Rayons minimaux en angle saillant (m) [RECTUR 5 B 3.2] : visibilité sur obstacle de 0,15 m et confort.
const RS_MIN = { 60: { lave: 900, autre: 1100, confort: 1100 }, 80: { lave: 2200, autre: 2900, confort: 2000 } };
// Rayons minimaux en angle rentrant (m) [RECTUR 5 B 3.3] : visibilité sous ouvrage selon le gabarit, et confort.
const RR_MIN = {
  60: { 200: { lave: 300, autre: 350 }, 270: { lave: 250, autre: 300 }, 350: { lave: 200, autre: 250 }, confort: 600 },
  80: { 200: { lave: 650, autre: 850 }, 270: { lave: 600, autre: 800 }, 350: { lave: 500, autre: 600 }, confort: 1000 },
};

export const PSGR_DEF = {
  gab: 'B', Vr: 60, n: 1, tubes: 1, entretien: 'autre', bd: 0.25, trot: 0.75, mur: 0.6, mc: 0.4, eT: 0.7, rec: 0.4,
  rp: 0.1, rc: 0.05, p: 6, Lnose: 25, dDet: 60, dPre: 150,
};

// Paramètres résolus (valeurs saisies, sinon défauts du gabarit et de la vitesse de référence).
export function psgrParams(q = {}) {
  const gk = PSGR_GAB[q.gab] ? q.gab : PSGR_DEF.gab, g = PSGR_GAB[gk];
  const Vr = +q.Vr === 80 ? 80 : 60;
  const Gh = num(q.G, g.G ?? 2.6), cls = g.cls ?? (Gh <= 2.0 ? 200 : Gh <= 2.7 ? 270 : 350);
  const ref = PSGR_GAB[cls === 200 ? 'G200' : cls === 270 ? 'G270' : 'G350'];
  const P = {
    key: gk, label: g.label, src: g.src, G: Gh, cls, Vr,
    rs: num(q.rs, g.rs ?? ref.rs), wv: num(q.wv, g.wv ?? ref.wv), wl: num(q.wl, g.wl ?? ref.wl), wlo: num(q.wlo, g.wlo ?? ref.wlo),
    n: Math.max(1, Math.min(3, Math.round(num(q.n, PSGR_DEF.n)))), tubes: +q.tubes === 2 ? 2 : 1,
    entretien: q.entretien === 'lave' ? 'lave' : 'autre',
    bd: num(q.bd, PSGR_DEF.bd), trot: num(q.trot, PSGR_DEF.trot), mur: num(q.mur, PSGR_DEF.mur), mc: num(q.mc, PSGR_DEF.mc),
    eT: num(q.eT, PSGR_DEF.eT), rec: num(q.rec, PSGR_DEF.rec), rp: num(q.rp, PSGR_DEF.rp), rc: num(q.rc, PSGR_DEF.rc),
    p: num(q.p, PSGR_DEF.p) / 100,
    Rs: num(q.Rs, Math.max(RS_MIN[Vr][q.entretien === 'lave' ? 'lave' : 'autre'], RS_MIN[Vr].confort)),
    Rr: num(q.Rr, RR_MIN[Vr].confort),
    Lc: q.Lc === '' || q.Lc == null ? null : +q.Lc, zs: q.zs === '' || q.zs == null ? null : +q.zs,
    Lnose: num(q.Lnose, PSGR_DEF.Lnose), dDet: num(q.dDet, PSGR_DEF.dDet), dPre: num(q.dPre, PSGR_DEF.dPre),
  };
  P.inter = Vr === 80 ? 1.1 : 1.0;
  P.Hm = P.G + P.rs; // hauteur libre minimale [RECTUR 5 C 2.4]
  P.Hint = P.Hm + P.rp + P.rc; // hauteur sous traverse à construire (protection au droit des équipements, construction)
  return P;
}

// Coupe transversale (un ou deux tubes, piédroits verticaux).
export function psgrSection(P) {
  const nT = P.tubes === 2 ? P.n : 2 * P.n; // voies par tube (tube unique : les deux sens)
  const lanes = []; // largeurs des voies d'un tube, de gauche à droite
  if (P.tubes === 2) for (let i = 0; i < nT; i++) lanes.push(i === nT - 1 ? P.wl : P.wlo);
  else for (let i = 0; i < nT; i++) lanes.push(i === 0 || i === nT - 1 ? P.wl : P.wlo); // voie de droite de chaque sens
  const Lr = lanes.reduce((a, b) => a + b, 0) + 2 * P.bd; // largeur roulable
  const Wp = Lr + 2 * P.trot; // plate-forme entre piédroits
  const W1m = 2 * 1.2 + nT * P.wv + (nT - 1) * P.inter; // largeur minimale entre piédroits à 1 m de hauteur
  const Wint = P.tubes * Wp + (P.tubes - 1) * P.mc; // entre piédroits extérieurs (faces intérieures)
  const Wo = Wint + 2 * P.mur; // hors tout
  const depth = P.Hint + P.eT + P.rec; // fond de trémie sous la surface, au droit de la couverture
  return { nT, lanes, Lr, Wp, W1m, Wint, Wo, depth };
}

// Profil en long (symétrique par rapport au centre) : fond plat sous la couverture (|s| ≤ Lc/2), puis de chaque côté
// raccordement rentrant Rr, rampe p, raccordement saillant Rs jusqu'au niveau de la surface zs (supposée horizontale).
export function psgrProfile(P, sec, Lc, zs) {
  const D = sec.depth, Rr = P.Rr, Rs = P.Rs;
  let p = P.p, Ls = (D - (p * p * (Rr + Rs)) / 2) / p;
  if (Ls < 0) { p = Math.sqrt((2 * D) / (Rr + Rs)); Ls = 0; }
  const s0 = Lc / 2, s1 = s0 + Rr * p, s2 = s1 + Ls, s3 = s2 + Rs * p; // portail, fin du rentrant, début du saillant, tête
  const zb = zs - D;
  const z = (sAbs) => {
    const s = Math.abs(sAbs);
    if (s <= s0) return zb;
    if (s <= s1) return zb + (s - s0) ** 2 / (2 * Rr);
    if (s <= s2) return zb + (Rr * p * p) / 2 + p * (s - s1);
    if (s <= s3) return zs - (s3 - s) ** 2 / (2 * Rs);
    return zs;
  };
  return { p, Ls, s0, s1, s2, s3, zb, zs, z, Lramp: s3 - s0, Ltot: 2 * s3 };
}

// Contrôles RECTUR.
export function psgrChecks(P, sec, pr, name) {
  const out = [], say = (lvl, msg) => out.push({ lvl, msg: `${name} : ${msg}` });
  const ent = P.entretien, rsMin = Math.max(RS_MIN[P.Vr][ent], RS_MIN[P.Vr].confort);
  const rrVis = RR_MIN[P.Vr][P.cls][ent], rrMin = Math.max(rrVis, RR_MIN[P.Vr].confort);
  const pc = pr.p * 100;
  if (pr.p < P.p - 1e-6) say('info', `déclivité ramenée à ${fmt(pc)} % (profondeur ${fmt(sec.depth)} m insuffisante pour atteindre ${fmt(P.p * 100)} % avec Rr ${fmt(P.Rr, 0)} m et Rs ${fmt(P.Rs, 0)} m).`);
  if (pc <= 6 + 1e-6) say('ok', `déclivité ${fmt(pc)} % ≤ 6 % [RECTUR 5 B 3.1].`);
  else if (pc <= 9 + 1e-6 && P.G <= 2.7 && pr.Ls <= 100) say('warn', `déclivité ${fmt(pc)} % : > 6 %, admise jusqu'à 9 % sur une centaine de mètres aux extrémités, gabarits 2,00 et 2,70 m, en site difficile [RECTUR 8 B 2] — à justifier.`);
  else if (pc <= 9 + 1e-6 && pr.Ls <= 30) say('warn', `déclivité ${fmt(pc)} % : > 6 %, admise sur moins de 30 m [RECTUR 5 B 3.1] — à justifier.`);
  else say('err', `déclivité ${fmt(pc)} % trop forte (6 % ; 9 % au plus en dérogation) [RECTUR 5 B 3.1, 8 B 2].`);
  say(P.Rs >= rsMin - 1e-6 ? 'ok' : 'err', `rayon saillant ${fmt(P.Rs, 0)} m ${P.Rs >= rsMin - 1e-6 ? '≥' : '<'} ${fmt(rsMin, 0)} m (visibilité sur 0,15 m et confort, Vr ${P.Vr}) [RECTUR 5 B 3.2].`);
  say(P.Rr >= rrMin - 1e-6 ? 'ok' : P.Rr >= rrVis - 1e-6 ? 'warn' : 'err', `rayon rentrant ${fmt(P.Rr, 0)} m ${P.Rr >= rrMin - 1e-6 ? '≥' : '<'} ${fmt(rrMin, 0)} m (visibilité sous ouvrage ${fmt(rrVis, 0)} m, confort ${fmt(RR_MIN[P.Vr].confort, 0)} m) [RECTUR 5 B 3.3].`);
  say(sec.Wp >= sec.W1m - 1e-6 ? 'ok' : 'err', `largeur entre piédroits ${fmt(sec.Wp)} m ${sec.Wp >= sec.W1m - 1e-6 ? '≥' : '<'} minimum à 1 m de hauteur ${fmt(sec.W1m)} m (2 × 1,20 + ${sec.nT} × ${fmt(P.wv)} + ${sec.nT - 1} × ${fmt(P.inter)}) [RECTUR 5 C 1.1].`);
  const ref = PSGR_GAB[P.cls === 200 ? 'G200' : P.cls === 270 ? 'G270' : 'G350'];
  if (P.wl < ref.wl - 1e-6) say('err', `voie de droite ${fmt(P.wl)} m < ${fmt(ref.wl)} m [RECTUR 5 C 1.2].`);
  if (sec.nT > (P.tubes === 2 ? 1 : 2) && P.wlo < ref.wlo - 1e-6) say('err', `autres voies ${fmt(P.wlo)} m < ${fmt(ref.wlo)} m [RECTUR 5 C 1.2].`);
  if (P.bd < 0.15 - 1e-6) say('err', `bandes dérasées ${fmt(P.bd)} m < 0,15 m [RECTUR 5 C 1.2].`);
  if (P.trot < 0.6 - 1e-6) say('err', `trottoirs ${fmt(P.trot)} m < 0,60 m [RECTUR 5 C 1.2].`);
  else if (P.trot < 0.75 - 1e-6) say('warn', `trottoirs ${fmt(P.trot)} m : 0,75 m avec des piédroits verticaux [RECTUR 5 C 1.2].`);
  say('info', `hauteur libre minimale Hm = ${fmt(P.G)} + ${fmt(P.rs)} = ${fmt(P.Hm)} m ; sous traverse à construire ${fmt(P.Hint)} m (protection ${fmt(P.rp)}, construction ${fmt(P.rc)}) ; fond à ${fmt(sec.depth)} m sous la surface [RECTUR 5 C 2].`);
  if (P.tubes === 1) say('info', 'tube unique à double sens : RECTUR ne traite que les ouvrages unidirectionnels ; largeurs vérifiées avec les mêmes règles (interdistance entre véhicules opposés).');
  if (P.G < 3.3) say('info', `gabarit ${fmt(P.G)} m < 3,30 m : les véhicules de secours usuels n'entrent pas — moyens d'intervention à définir [RECTUR 4, 5 C 1.3] ; itinéraire de surface obligatoire pour les véhicules hors gabarit.`);
  return out;
}

// Plan : prims (repère local s le long de u depuis C, y à gauche) et points d'implantation de la signalisation.
// edge(e) : distance de l'axe au bord droit de chaussée de la route pour le sens qui arrive du côté e (+1 / −1).
// Repère du PSGR : opt.frame(s) → { p, t } (point de l'axe en plan de la route à l'abscisse s comptée depuis le centre,
// tangente unitaire) ; à défaut, droite (C, u). Les lignes parallèles à l'axe sont échantillonnées (axe en courbe).
export function psgrPlan(P, sec, pr, C, u, opt = {}) {
  const frame = opt.frame || ((s) => ({ p: add(C, mul(u, s)), t: u }));
  const W = (s, y) => { const f = frame(s); return add(f.p, mul(rot90(f.t), y)); };
  const tg = (s) => frame(s).t;
  const prims = [], signs = [];
  const Lyr = 'PSGR', h0 = sec.Wint / 2, h1 = h0 + P.mur, s0 = pr.s0, s3 = pr.s3, TH = opt.textH || 0.8;
  const along = (sa, sb, y) => { const n = Math.max(1, Math.ceil(Math.abs(sb - sa) / 2)), pts = []; for (let k = 0; k <= n; k++) pts.push(W(sa + ((sb - sa) * k) / n, y)); return pts; };
  const toSegs = (pts) => pts.slice(1).map((q, k) => L(pts[k], q));
  const seg = (a, b, extra = {}) => prims.push({ k: 'path', L: Lyr, segs: [L(a, b)], ...extra });
  const par = (sa, sb, y, extra = {}) => prims.push({ k: 'path', L: Lyr, segs: toSegs(along(sa, sb, y)), ...extra }); // parallèle à l'axe
  const ring = (sa, sb, ya, yb) => { const pts = [...along(sa, sb, ya), ...along(sb, sa, yb)]; return pts.map((p, i) => L(p, pts[(i + 1) % pts.length])); };
  const hidden = { role: 'cache', dash: [1.5, 1], lt: 'TIRETS' };
  // couverture (dalle sous le carrefour)
  const cv = ring(-s0, s0, -h1, h1);
  prims.push({ k: 'fill', L: Lyr, role: 'couv', rings: [cv] });
  prims.push({ k: 'path', L: Lyr, segs: cv, closed: true, role: 'couv' });
  // trémies ouvertes (remplissage) et piédroits : vus en trémie, cachés sous la couverture
  for (const e of [-1, 1]) {
    prims.push({ k: 'fill', L: Lyr, role: 'tremie', rings: [ring(e * s0, e * s3, -h0, h0)] });
    for (const y of [-h1, -h0, h0, h1]) par(e * s0, e * s3, y);
    seg(W(e * s3, -h1), W(e * s3, h1), { role: 'tete' }); // tête de trémie (niveau de la surface)
    if (P.tubes === 2) for (const y of [-P.mc / 2, P.mc / 2]) par(e * s0, e * s3, y);
    // sens de circulation dans la trémie
    // sens qui entre du côté e : il roule vers le centre (−e·t), sur sa droite (e·n)
    const yl = e * (P.tubes === 2 ? sec.Wp / 2 + P.mc / 2 : sec.Wp / 4), sa = e * (s0 + 4 + Math.min(8, (s3 - s0) / 3));
    prims.push({ k: 'arrow', L: Lyr, p: W(sa, yl), dir: mul(tg(sa), -e), len: Math.min(8, (s3 - s0) / 3), h: TH * 0.7, rot: G.ang(tg(sa)), text: '' });
  }
  for (const y of [-h1, -h0, h0, h1]) par(-s0, s0, y, hidden);
  if (P.tubes === 2) for (const y of [-P.mc / 2, P.mc / 2]) par(-s0, s0, y, hidden);
  par(-s3 - 10, s3 + 10, 0, { role: 'axe', dash: [6, 1.5, 1, 1.5], lt: 'AXE' });
  const u0 = tg(0), rot = Math.abs(G.ang(u0)) > Math.PI / 2 ? G.ang(u0) + Math.PI : G.ang(u0);
  prims.push({ k: 'text', L: Lyr, p: W(0, h1 + TH * 1.2), s: `${opt.name || 'PSGR'} — ${P.label.replace(/ —.*$/, '')} G ${fmt(P.G)} m — couverture ${fmt(2 * s0, 1)} m, trémies ${fmt(pr.Lramp, 1)} m à ${fmt(pr.p * 100, 1)} %`, h: TH, rot, align: 'center' });
  // Signalisation de chaque sens entrant (côté e) : présignalisation B12 + panonceau de distance, portique de détection
  // des véhicules hors gabarit, B12 sur le musoir de séparation (dernier choix possible), gabarit à l'entrée de la trémie.
  for (const e of [-1, 1]) {
    const ed = opt.edge?.(e) ?? h1 + 7;
    // sens de marche vers le centre (−e·t), sa droite (e·n), face vers l'usager ; point à la distance s du centre
    const at = (s, y) => W(e * s, e * y), dirAt = (s) => mul(tg(e * s), -e), rightAt = (s) => neg(rot90(dirAt(s))), faceAt = (s) => neg(dirAt(s));
    const sN = s3 + P.Lnose;
    // musoir entre la voie de la trémie (à gauche) et la contre-allée (à droite)
    seg(at(s3, h1), at(sN, h1 + 0.6), { role: 'nez' });
    signs.push({ code: 'B12', p: at(sN, h1 + 0.6), face: faceAt(sN), out: rightAt(sN), note: `B12 « ${fmt(P.G)} m » sur le musoir : dernier choix avant la trémie`, s: e * sN });
    signs.push({ code: 'GAB', p: at(s3, h1 + 0.2), face: faceAt(s3), out: rightAt(s3), note: `gabarit physique ${fmt(P.G)} m à l'entrée de la trémie`, s: e * s3 });
    seg(at(s3, h0), at(s3, 0), { role: 'portique' });
    const sD = sN + P.dDet, sP = sN + P.dPre;
    signs.push({ code: 'PDH', p: at(sD, ed + 1.5), face: faceAt(sD), out: rightAt(sD), note: `portique de détection des véhicules hors gabarit, ${fmt(P.dDet, 0)} m avant le musoir (échappatoire par la contre-allée)`, s: e * sD });
    seg(at(sD, 0), at(sD, ed), { role: 'portique' });
    signs.push({ code: 'B12M', p: at(sP, ed + 1.5), face: faceAt(sP), out: rightAt(sP), note: `présignalisation B12 « ${fmt(P.G)} m » + panonceau « à ${fmt(P.dPre, 0)} m »`, s: e * sP });
  }
  for (const sg of signs) {
    prims.push({ k: 'circle', L: 'SIGNALISATION', c: sg.p, r: 0.12 });
    prims.push({ k: 'sign', L: 'SIGNALISATION', p: sg.p, out: sg.out, face: sg.face, code: sg.code, w: 1.0, h: TH * 0.7 });
  }
  const bbox = (() => { const pts = [...along(-s3 - 10, s3 + 10, -h1), ...along(-s3 - 10, s3 + 10, h1)]; return { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)) }; })();
  return { prims, signs, bbox };
}

// ------------------------------------------------------------------ Dessins (SVG) et exports DXF
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Profil en long : données (polylignes en m, z réel) partagées par le SVG et le DXF.
function profileLines(P, sec, pr) {
  const pts = [], step = 0.5, sMax = pr.s3 + 20;
  for (let s = -sMax; s <= sMax + 1e-9; s += step) pts.push([s, pr.z(s)]);
  const zi = pr.zs - P.rec - P.eT; // intrados de la traverse
  return {
    fond: pts, surfL: [[-sMax, pr.zs], [-pr.s0, pr.zs]], surfR: [[pr.s0, pr.zs], [sMax, pr.zs]],
    couvTop: [[-pr.s0, pr.zs], [pr.s0, pr.zs]], intrados: [[-pr.s0, zi], [pr.s0, zi]],
    hm: [[-pr.s0, pr.zb + P.Hm], [pr.s0, pr.zb + P.Hm]], sMax, zi,
  };
}

export function psgrProfileSVG(P, sec, pr, opt = {}) {
  const Wpx = opt.width || 760, pad = 34;
  const ln = profileLines(P, sec, pr), sMax = ln.sMax;
  const zMin = pr.zb - 1, zMax = pr.zs + 1.5;
  const sx = (Wpx - 2 * pad) / (2 * sMax), ve = opt.ve || Math.max(1, Math.round(200 / ((zMax - zMin) * sx))), Hpx = (zMax - zMin) * sx * ve + 2 * pad + 64;
  const X = (s) => pad + (s + sMax) * sx, Y = (z) => pad + (zMax - z) * sx * ve;
  const pl = (pts, cls) => `<polyline class="${cls}" points="${pts.map(([s, z]) => `${X(s).toFixed(1)},${Y(z).toFixed(1)}`).join(' ')}"/>`;
  const txt = (x, y, s, a = 'middle', cls = '') => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${a}" class="${cls}">${esc(s)}</text>`;
  let g = '';
  // couverture (dalle) en coupe
  g += `<rect class="couv" x="${X(-pr.s0)}" y="${Y(pr.zs)}" width="${X(pr.s0) - X(-pr.s0)}" height="${Y(ln.zi) - Y(pr.zs)}"/>`;
  g += pl(ln.surfL, 'surf') + pl(ln.surfR, 'surf') + pl(ln.couvTop, 'surf');
  g += pl(ln.hm, 'hm') + pl(ln.fond, 'fond');
  for (const s of [-pr.s3, -pr.s2, -pr.s1, -pr.s0, pr.s0, pr.s1, pr.s2, pr.s3]) g += `<line class="tick" x1="${X(s)}" x2="${X(s)}" y1="${Y(pr.z(s))}" y2="${Hpx - pad - 48}"/>`;
  const yb = Hpx - pad + 10;
  g += txt(X(0), Y(pr.zb) + 18, `fond ${fmt(pr.zb)} — couverture ${fmt(2 * pr.s0, 1)} m`);
  g += txt(X(pr.s0) + 6, Y(pr.zb + P.Hm) + 5, `Hm ${fmt(P.Hm)} m`, 'start', 'hmt');
  for (const e of [-1, 1]) {
    g += txt(X(e * (pr.s0 + pr.s1) / 2), yb - 36, `Rr ${fmt(P.Rr, 0)}`);
    g += txt(X(e * (pr.s1 + pr.s2) / 2), yb - 18, `${fmt(pr.p * 100, 2)} % sur ${fmt(pr.Ls, 1)} m`);
    g += txt(X(e * (pr.s2 + pr.s3) / 2), yb, `Rs ${fmt(P.Rs, 0)}`);
    g += txt(X(e * pr.s3), Y(pr.zs) - 8, `tête ${fmt(e * pr.s3, 1)}`, e < 0 ? 'start' : 'end');
  }
  g += txt(pad, 18, `${opt.name || 'PSGR'} — profil en long (abscisses depuis le centre, hauteurs × ${ve})`, 'start', 'ttl');
  const css = '.surf{stroke:#94a3b8;stroke-width:1.5;fill:none}.fond{stroke:#ef4444;stroke-width:2;fill:none}.hm{stroke:#facc15;stroke-dasharray:4 3;fill:none}.couv{fill:rgba(148,163,184,.35);stroke:#94a3b8}.tick{stroke:rgba(148,163,184,.35)}text{font:15px system-ui,sans-serif;fill:currentColor}.ttl{font-weight:600}.hmt{fill:#ca8a04}';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wpx} ${Hpx.toFixed(0)}" width="100%" style="max-width:${Wpx}px"><style>${css}</style>${g}</svg>`;
}

// Coupe type : géométrie (m) depuis l'axe, y vers le haut depuis le fond.
function sectionShapes(P, sec) {
  const out = { rects: [], dims: [], veh: [], lanes: [] };
  const H = P.Hint, top = H + P.eT, h0 = sec.Wint / 2;
  out.rects.push({ x0: -h0 - P.mur, x1: -h0, y0: -0.3, y1: top, cls: 'beton' }, { x0: h0, x1: h0 + P.mur, y0: -0.3, y1: top, cls: 'beton' });
  out.rects.push({ x0: -h0 - P.mur, x1: h0 + P.mur, y0: H, y1: top, cls: 'beton' }); // traverse
  out.rects.push({ x0: -h0 - P.mur - 2, x1: h0 + P.mur + 2, y0: top, y1: top + P.rec, cls: 'chaussee' }); // chaussée de surface
  out.rects.push({ x0: -h0 - P.mur, x1: h0 + P.mur, y0: -0.3, y1: 0, cls: 'radier' });
  const tubes = P.tubes === 2 ? [-(sec.Wp + P.mc) / 2, (sec.Wp + P.mc) / 2] : [0];
  if (P.tubes === 2) out.rects.push({ x0: -P.mc / 2, x1: P.mc / 2, y0: 0, y1: H, cls: 'beton' });
  for (const xc of tubes) {
    let x = xc - sec.Wp / 2;
    out.rects.push({ x0: x, x1: x + P.trot, y0: 0, y1: 0.15, cls: 'trot' }, { x0: xc + sec.Wp / 2 - P.trot, x1: xc + sec.Wp / 2, y0: 0, y1: 0.15, cls: 'trot' });
    x += P.trot + P.bd;
    for (const w of sec.lanes) {
      out.lanes.push({ x0: x, x1: x + w });
      out.veh.push({ x0: x + (w - P.wv) / 2, x1: x + (w + P.wv) / 2, y1: P.G });
      x += w;
    }
  }
  return { ...out, H, top, h0 };
}

export function psgrSectionSVG(P, sec, opt = {}) {
  const S = sectionShapes(P, sec), Wtot = sec.Wo + 4, k = (opt.width || 520) / (Wtot + 2);
  const Wpx = opt.width || 520, Hpx = (S.top + P.rec + 2.2) * k + 30;
  const X = (x) => Wpx / 2 + x * k, Y = (y) => Hpx - 34 - (y + 0.3) * k;
  const r = (q, cls) => `<rect class="${cls}" x="${X(q.x0).toFixed(1)}" y="${Y(q.y1).toFixed(1)}" width="${((q.x1 - q.x0) * k).toFixed(1)}" height="${((q.y1 - q.y0) * k).toFixed(1)}"/>`;
  let g = S.rects.map((q) => r(q, q.cls)).join('');
  for (const v of S.veh) g += r({ x0: v.x0, x1: v.x1, y0: 0, y1: v.y1 }, 'veh');
  g += `<line class="hm" x1="${X(-S.h0)}" x2="${X(S.h0)}" y1="${Y(P.Hm)}" y2="${Y(P.Hm)}"/>`;
  const t = (x, y, s, cls = '') => `<text x="${X(x).toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" class="${cls}">${esc(s)}</text>`;
  for (const l of S.lanes) g += t((l.x0 + l.x1) / 2, Hpx - 18, fmt(l.x1 - l.x0));
  g += t(0, Hpx - 4, `plate-forme ${fmt(sec.Wp)} m${P.tubes === 2 ? ' × 2 tubes' : ''} · hors tout ${fmt(sec.Wo)} m · mini à 1 m ${fmt(sec.W1m)} m`);
  g += `<text x="${(X(S.h0) + 4).toFixed(1)}" y="${(Y(P.Hm) + 4).toFixed(1)}" class="hmt">Hm ${fmt(P.Hm)}</text>`;
  g += `<text x="${(X(-S.h0) - 4).toFixed(1)}" y="${(Y(S.H) + 12).toFixed(1)}" text-anchor="end">${fmt(P.Hint)}</text>`;
  g += `<text x="6" y="14" class="ttl">${esc(opt.name || 'PSGR')} — coupe type (G ${fmt(P.G)} m)</text>`;
  const css = '.beton{fill:rgba(148,163,184,.55);stroke:#64748b}.radier{fill:rgba(148,163,184,.4);stroke:#64748b}.chaussee{fill:rgba(71,85,105,.6)}.trot{fill:rgba(200,170,135,.7)}.veh{fill:rgba(56,189,248,.18);stroke:#38bdf8;stroke-dasharray:3 2}.hm{stroke:#facc15;stroke-dasharray:4 3}text{font:11px system-ui,sans-serif;fill:currentColor}.ttl{font-weight:600}.hmt{fill:#ca8a04}';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wpx} ${Hpx.toFixed(0)}" width="100%" style="max-width:${Wpx}px"><style>${css}</style>${g}</svg>`;
}

// DXF du profil en long (abscisses en m, cotes exagérées ve) et de la coupe type (1:1) : w = DxfWriter.
export function psgrProfileDXF(w, P, sec, pr, ve = 5, name = 'PSGR') {
  const ln = profileLines(P, sec, pr), z0 = pr.zb - 1, Z = (z) => (z - z0) * ve;
  w.layer('PSGR_PL_FOND', 1).layer('PSGR_PL_SURFACE', 8).layer('PSGR_PL_COUVERTURE', 5).layer('PSGR_PL_HM', 2).layer('PSGR_PL_TEXTE', 7);
  const poly = (lay, pts) => w.poly(lay, pts.map(([s, z]) => ({ x: s, y: Z(z) })));
  poly('PSGR_PL_FOND', ln.fond); poly('PSGR_PL_SURFACE', ln.surfL); poly('PSGR_PL_SURFACE', ln.surfR);
  w.poly('PSGR_PL_COUVERTURE', [{ x: -pr.s0, y: Z(pr.zs) }, { x: pr.s0, y: Z(pr.zs) }, { x: pr.s0, y: Z(ln.zi) }, { x: -pr.s0, y: Z(ln.zi) }], true);
  poly('PSGR_PL_HM', ln.hm);
  const T = (x, y, s) => w.text('PSGR_PL_TEXTE', { x, y }, 1.2, 0, s, 'center');
  T(0, Z(pr.zs) + 6, `${name} - profil en long (exageration x${ve})`);
  T(0, Z(pr.zb) - 2, `fond ${fmt(pr.zb)}  Hm ${fmt(P.Hm)}`);
  for (const e of [-1, 1]) { T(e * (pr.s1 + pr.s2) / 2, Z(pr.zb) - 4, `${fmt(pr.p * 100, 2)} %`); T(e * (pr.s0 + pr.s1) / 2, Z(pr.zb) - 6, `Rr ${fmt(P.Rr, 0)}`); T(e * (pr.s2 + pr.s3) / 2, Z(pr.zs) + 2, `Rs ${fmt(P.Rs, 0)}`); }
  return w;
}

export function psgrSectionDXF(w, P, sec, name = 'PSGR') {
  const S = sectionShapes(P, sec);
  w.layer('PSGR_CT_BETON', 8).layer('PSGR_CT_CHAUSSEE', 9).layer('PSGR_CT_GABARIT', 4).layer('PSGR_CT_TEXTE', 7);
  const rect = (lay, q, y1 = q.y1, y0 = q.y0) => w.poly(lay, [{ x: q.x0, y: y0 }, { x: q.x1, y: y0 }, { x: q.x1, y: y1 }, { x: q.x0, y: y1 }], true);
  for (const q of S.rects) rect(q.cls === 'chaussee' || q.cls === 'trot' ? 'PSGR_CT_CHAUSSEE' : 'PSGR_CT_BETON', q);
  for (const v of S.veh) rect('PSGR_CT_GABARIT', { x0: v.x0, x1: v.x1 }, v.y1, 0);
  w.line('PSGR_CT_GABARIT', { x: -S.h0, y: P.Hm }, { x: S.h0, y: P.Hm });
  const T = (x, y, s, h = 0.2) => w.text('PSGR_CT_TEXTE', { x, y }, h, 0, s, 'center');
  T(0, S.top + P.rec + 0.8, `${name} - coupe type (G ${fmt(P.G)} m)`, 0.3);
  for (const l of S.lanes) T((l.x0 + l.x1) / 2, -0.7, fmt(l.x1 - l.x0));
  T(0, -1.1, `plate-forme ${fmt(sec.Wp)} m - hors tout ${fmt(sec.Wo)} m - Hm ${fmt(P.Hm)} m`);
  return w;
}
