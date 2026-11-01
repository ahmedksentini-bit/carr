// ouvrage.js — passages supérieurs de l'échangeur : implantation des appuis, travure et dessin en plan.
//
// Ouvrages reconnus : chaque voie secondaire qui croise l'autoroute, la tige d'une trompette paramétrique et les deux
// franchissements de l'anneau d'un giratoire dénivelé. Les lignes d'appui sont parallèles à l'autoroute (biais
// géométrique ψ entre l'axe de l'ouvrage et les lignes d'appui, 100 gr = droit), les portées sont mesurées le long de
// l'axe de l'ouvrage.
//
// Implantation (distances perpendiculaires à l'axe de l'autoroute) :
//  - pile de rive : au-delà de la BAU, du dispositif de retenue (face avant à dRet du bord de la BAU) et de sa largeur
//    de fonctionnement W (NF EN 1317-2, classes W1 à W8) ; nu de la pile à la face avant + W ;
//  - pile centrale : dans le TPC si la bande médiane atteint 3 m (guide SETRA 1989 § 1.2.2 / 1.2.4 : appui central
//    seulement si TPC ≥ 3 m) et si la pile tient entre les largeurs de fonctionnement des deux dispositifs ; sinon
//    3 travées (§ 1.2.3) ;
//  - culée en tête du talus de remblai 3/2 (pente courante des passages supérieurs, PSIDA plans/ensemble.js) dont le
//    pied passe derrière la pile de rive ; hauteur du talus = tirant d'air + 0,20 m (appareils d'appui, bossages) ;
//    quart de cône de même pente à chaque angle ; ligne d'appui en retrait de 0,50 m de la crête ;
//  - travée de rive au moins égale à 0,5 (0,6 si ψ < 70 gr) fois la travée voisine (§ 2.1.1, soulèvement des abouts) :
//    la culée est reculée si nécessaire.
// La travure obtenue est vérifiée par les règles du dépôt PSIDA (psida.js : domaine d'emploi, épaisseur d'abaque,
// rapports de travées, biais mécanique, coupe transversale, ouvertures, longueur d'about).
import * as G from './geom.js';
import { pathProject, pathTangentAt, polySegs } from './clotho.js';
import { hwyParams, crossParams, crossList } from './echangeur.js';
import { fmt, upright } from './common.js';
import { deckTrace, deckTurn } from './psidatrace.js';
import { domaineEmploi, epaisseurGuide, verifierTravure, verifierBiais, verifierCoupe, verifierOuvertures, longueurAbout, GUIDE89 } from './psida.js';

const { add, sub, mul, dot, cross, norm, rot90, neg, dist } = G;
export const W_CLASSES = { W1: 0.6, W2: 0.8, W3: 1.0, W4: 1.3, W5: 1.7, W6: 2.1, W7: 2.5, W8: 3.5 };
const num = (v, d) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : d; };

export function ouvrParams(prj) {
  const o = prj.ouvr || {};
  return {
    on: o.on !== false && o.on !== 'non',
    gab: num(o.gab, 4.75), // tirant d'air sous l'ouvrage (m)
    dRet: num(o.dRet, 0), // bord extérieur de la BAU → face avant du dispositif de retenue de rive (m)
    Wr: W_CLASSES[o.Wr] ? o.Wr : 'W4', Wt: W_CLASSES[o.Wt] ? o.Wt : 'W2', // classes de largeur de fonctionnement (rive, TPC)
    ep: num(o.ep, 0.8), // épaisseur des piles voiles, perpendiculairement aux lignes d'appui (m)
    nTrav: ['3', '4'].includes(String(o.nTrav)) ? String(o.nTrav) : 'auto',
    corn: num(o.corn, 0.5), // largeur hors chaussée de chaque côté (corniche, longrine du dispositif de retenue) (m)
    fck: num(o.fck, 30),
    pente: 1.5, // talus 3/2
    decks: o.decks && typeof o.decks === 'object' ? o.decks : {}, // réglages par ouvrage (onglet Ouvrages) : spans, shift, h
  };
}

// ---------------------------------------------------------------- géométrie de polylignes
function offsetPoly(pts, d) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    return add(p, mul(rot90(norm(sub(b, a))), d));
  });
}
function offsetPolyVar(pts, ds, sg) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    return add(p, mul(rot90(norm(sub(b, a))), sg * ds[i]));
  });
}
const arcLens = (pts) => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + dist(pts[i - 1], pts[i])); return L; };
// Point de la polyligne où le décalage signé par rapport à l'autoroute vaut c (premier franchissement).
function atOff(poly, offs, c) {
  for (let i = 1; i < poly.length; i++) {
    const a = offs[i - 1] - c, b = offs[i] - c;
    if (a === 0) return { p: poly[i - 1], i: i - 1, t: 0 };
    if (Math.sign(a) !== Math.sign(b)) { const t = a / (a - b); return { p: G.lerp(poly[i - 1], poly[i], t), i: i - 1, t }; }
  }
  return null;
}
// Sous-polyligne entre deux franchissements (ordre de la polyligne conservé).
function slice(poly, A, B) {
  const [u, v] = A.i + A.t <= B.i + B.t ? [A, B] : [B, A];
  const out = [u.p];
  for (let k = u.i + 1; k <= v.i; k++) out.push(poly[k]);
  out.push(v.p);
  return out;
}
// Axe prolongé de 150 m en ligne droite à ses deux extrémités, échantillonné tous les mètres.
function extendAxis(pts) {
  const a = norm(sub(pts[0], pts[1])), b = norm(sub(pts[pts.length - 1], pts[pts.length - 2]));
  const head = [], tail = [];
  for (let t = 150; t > 0; t -= 1) head.push(add(pts[0], mul(a, t)));
  for (let t = 1; t <= 150; t += 1) tail.push(add(pts[pts.length - 1], mul(b, t)));
  return [...head, ...pts, ...tail];
}

// ---------------------------------------------------------------- recensement des ouvrages
function collectDecks(prj, D, extra) {
  const hw = D?.hwy, decks = [];
  if (!hw?.ok) return decks;
  const offOf = (p) => pathProject(hw.path, p);
  // Voies secondaires : chaque franchissement de l'autoroute.
  (D.crosses || []).forEach((c, k) => {
    if (!c?.ok) return;
    const X = crossParams(prj, k), cid = crossList(prj)[k]?.id || `k${k}`;
    let nX = 0;
    const pts = G.samplePath(c.path, 1);
    const offs = pts.map((p) => offOf(p).off);
    for (let i = 1; i < pts.length; i++) {
      if (Math.sign(offs[i - 1]) === Math.sign(offs[i]) || offs[i - 1] === 0) continue;
      const j0 = Math.max(0, i - 400), j1 = Math.min(pts.length, i + 400); // l'axe réel sur ± 400 m, puis prolongement droit
      decks.push({ key: `x:${cid}:${nX++}`, src: X.name, axis: extendAxis(pts.slice(j0, j1)), halfW: c.E2 + 0, road: true, kind: X.kind, geo: { path: c.path, al: c.al }, X0: G.lerp(pts[i - 1], pts[i], offs[i - 1] / (offs[i - 1] - offs[i])) });
    }
  });
  // Tiges de trompettes paramétriques : l'ouvrage porte les deux voies de la tige (S-semi et boucle) ; son axe est le
  // milieu de leurs axes et sa largeur suit leur écartement, de sorte qu'un tablier allongé suit les bretelles là où
  // elles s'écartent (bifurcation boucle / S-semi) au lieu de partir tout droit.
  (prj.ramps || []).forEach((r, iS) => {
    if (r.role !== 'semi' || !r.tp?.P0 || !r.tp?.u) return;
    const P0 = r.tp.P0, u = norm(r.tp.u), n = rot90(u), half0 = Math.max(1, +r.tp.tpc || 1) / 2 + 3.5 + 1.0;
    const iB = (prj.ramps || []).findIndex((q) => q.role === 'boucle' && q.grp === r.id);
    const polyOf = (i) => (i >= 0 && D.ramps?.[i]?.al?.path ? G.samplePath(D.ramps[i].al.path, 1) : null);
    const pS = polyOf(iS), pB = polyOf(iB);
    // point d'une polyligne sur la perpendiculaire à u à l'abscisse t (le plus proche de l'axe de la tige)
    const cut = (poly, t) => {
      if (!poly) return null;
      let best = null;
      for (let i = 1; i < poly.length; i++) {
        const a = dot(sub(poly[i - 1], P0), u) - t, b = dot(sub(poly[i], P0), u) - t;
        if (Math.sign(a) === Math.sign(b) && a !== 0) continue;
        const q = G.lerp(poly[i - 1], poly[i], a / (a - b || 1)), y = dot(sub(q, P0), n);
        if (Math.abs(y) < 40 && (!best || Math.abs(y) < Math.abs(best.y))) best = { q, y };
      }
      return best;
    };
    const pts = [], hw = [];
    for (let t = -200; t <= 200; t += 1) {
      const a = cut(pS, t), b = cut(pB, t);
      if (a && b && Math.abs(a.y - b.y) < 45) { pts.push(G.lerp(a.q, b.q, 0.5)); hw.push(Math.abs(a.y - b.y) / 2 + 1.75 + 1.0); }
      else { pts.push(add(P0, mul(u, t))); hw.push(half0); }
    }
    // lissage de l'axe et des largeurs (raccord entre la tige et la partie droite de repli)
    const sm = (arr, f) => arr.map((_, i) => { const w = arr.slice(Math.max(0, i - 3), i + 4); return f(w); });
    const axis = sm(pts, (w) => ({ x: w.reduce((s, p) => s + p.x, 0) / w.length, y: w.reduce((s, p) => s + p.y, 0) / w.length }));
    const halfWArr = sm(hw, (w) => w.reduce((s, v) => s + v, 0) / w.length);
    decks.push({ key: `t:${r.id}`, src: `tige de la trompette (${r.name})`, axis, halfW: half0, halfWArr, tige: true, X0: P0 });
  });
  // Giratoires dénivelés : anneau franchissant l'autoroute.
  for (const g of extra?.girden || []) {
    const Rm = g.Rg - g.la / 2, ring = [];
    for (let k = 0; k < 720; k++) ring.push(G.polar(g.O, Rm, (k / 720) * G.TAU));
    const offs = ring.map((p) => offOf(p).off);
    let nX = 0;
    for (let k = 0; k < 720; k++) {
      const a = offs[k], b = offs[(k + 1) % 720];
      if (!((a <= 0 && b > 0) || (a >= 0 && b < 0))) continue; // un seul franchissement si un point tombe sur l'axe
      const pts = [];
      for (let j = -110; j <= 110; j++) pts.push(ring[(k + j + 720) % 720]);
      decks.push({ key: `g:${g.id}:${nX++}`, src: `${g.name} (anneau)`, axis: pts, halfW: g.la / 2 + 1.0, ring: true, geo: { c: g.O, r: Rm } });
    }
  }
  // La voie secondaire d'une trompette suit la tige : un seul ouvrage, celui de la tige (deux voies et leur TPC).
  const tiges = decks.filter((d) => d.tige);
  return decks.filter((d) => !d.road || !tiges.some((t) => dist(t.X0, d.X0) < 30));
}

// ---------------------------------------------------------------- conception d'un ouvrage
function designDeck(prj, D, deck, O) {
  const hw = D.hwy, Hm = hwyParams(prj), issues = [];
  const axis = deck.axis, aOff = axis.map((p) => pathProject(hw.path, p).off), aL = arcLens(axis);
  const hwArr = deck.halfWArr ? deck.halfWArr.map((v) => v + O.corn) : null;
  const eL = hwArr ? offsetPolyVar(axis, hwArr, 1) : offsetPoly(axis, deck.halfW + O.corn), eR = hwArr ? offsetPolyVar(axis, hwArr, -1) : offsetPoly(axis, -(deck.halfW + O.corn));
  const oL = eL.map((p) => pathProject(hw.path, p).off), oR = eR.map((p) => pathProject(hw.path, p).off);
  const X0 = atOff(axis, aOff, 0);
  if (!X0) return null;
  const sX = pathProject(hw.path, X0.p).s, tH = pathTangentAt(hw.path, sX), nH = rot90(tH);
  const halfW = hwArr ? hwArr[Math.min(hwArr.length - 1, X0.i)] : deck.halfW + O.corn;
  const tA = norm(sub(axis[X0.i + 1], axis[X0.i]));
  const psi = (Math.atan2(Math.abs(cross(tA, tH)), Math.abs(dot(tA, tH))) * 200) / Math.PI;
  const sinPsi = Math.sin((psi * Math.PI) / 200);
  const arcAt = (c) => { const q = atOff(axis, aOff, c); return q ? aL[q.i] + q.t * (aL[q.i + 1] - aL[q.i]) : null; };
  const Wr = W_CLASSES[O.Wr], Wt = W_CLASSES[O.Wt];
  const yFace = hw.E2 + O.dRet, yP = yFace + Wr + O.ep / 2;
  const centralFits = Hm.median >= 3 - 1e-6 && Hm.median / 2 - Wt >= O.ep / 2 - 1e-6;
  const central = O.nTrav === '4' ? true : O.nTrav === '3' ? false : centralFits;
  if (central && !centralFits) issues.push({ lvl: 'warn', msg: `${deck.src} : pile centrale imposée alors que ${Hm.median < 3 ? `la bande médiane (${fmt(Hm.median)} m) est inférieure à 3 m (guide SETRA 1989 § 1.2.2)` : `la pile (${fmt(O.ep)} m) dépasse l'espace laissé par les largeurs de fonctionnement ${O.Wt} (${fmt(Hm.median - 2 * Wt)} m)`}.` });
  const Ht = O.gab + 0.2, R = O.pente * Ht;
  const yToe = yP + O.ep / 2 + 0.5, yCrest = yToe + R, yC0 = yCrest + 0.5;
  const rMin = psi < 70 ? GUIDE89.travure.rMinBiais : GUIDE89.travure.rMin;
  // Abscisses (le long de l'axe) des appuis intermédiaires, puis culées : rive ≥ rMin × travée voisine.
  const aP = { '-1': arcAt(-yP), 1: arcAt(yP) }, a0 = arcAt(0);
  if (aP[-1] == null || aP[1] == null || a0 == null) return null;
  const side = {};
  for (const s of [-1, 1]) {
    const adj = central ? Math.abs(aP[s] - a0) : Math.abs(aP[1] - aP[-1]);
    let yC = yC0, aC = arcAt(s * yC);
    while (aC != null && Math.abs(aC - aP[s]) < rMin * adj - 1e-6 && yC < yC0 + 60) { yC += 0.05; aC = arcAt(s * yC); }
    if (aC == null) return null;
    side[s] = { yC, aC, pushed: yC > yC0 + 1e-6 };
  }
  // Travure de la culée « gauche » (s = −1, côté sens 1) vers la culée « droite ».
  const order = [-1, 1].sort((s1, s2) => side[s1].aC - side[s2].aC);
  const sup = [{ kind: 'culee', s: order[0], y: side[order[0]].yC, a: side[order[0]].aC }, { kind: 'pile', s: order[0], y: yP, a: aP[order[0]] }];
  if (central) sup.push({ kind: 'pile', s: 0, y: 0, a: a0, central: true });
  sup.push({ kind: 'pile', s: order[1], y: yP, a: aP[order[1]] }, { kind: 'culee', s: order[1], y: side[order[1]].yC, a: side[order[1]].aC });
  for (const q of sup) if (q.kind === 'culee') q.yCrest = q.y - 0.5;
  const spansAuto = sup.slice(1).map((q, i) => +Math.abs(q.a - sup[i].a).toFixed(2));
  // Travure saisie dans l'onglet Ouvrages (travées le long de l'axe, centrées sur le croisement, décalage éventuel) :
  // appuis replacés sur l'axe, lignes d'appui toujours parallèles à l'autoroute ; implantation contrôlée.
  const ov = (O.decks || {})[deck.key] || {};
  const user = Array.isArray(ov.spans) && ov.spans.length >= 1 && ov.spans.every((v) => +v > 1) ? ov.spans.map(Number) : null;
  let sup2 = sup;
  if (user) {
    const S = user.reduce((x, y) => x + y, 0), a1 = a0 + (+ov.shift || 0) - S / 2;
    const pos = [a1]; for (const L of user) pos.push(pos[pos.length - 1] + L);
    if (pos[0] < 1 || pos[pos.length - 1] > aL[aL.length - 1] - 1) return null;
    sup2 = pos.map((a, i) => {
      let k = 1; while (k < aL.length - 1 && aL[k] < a) k++;
      const p = G.lerp(axis[k - 1], axis[k], (a - aL[k - 1]) / (aL[k] - aL[k - 1] || 1)), c = pathProject(hw.path, p).off;
      const kind = i === 0 || i === pos.length - 1 ? 'culee' : 'pile';
      return { kind, s: Math.sign(c) || 1, y: Math.abs(c), a, central: kind === 'pile' && Math.abs(c) < Hm.median / 2, ...(kind === 'culee' ? { yCrest: Math.abs(c) - 0.5 } : {}) };
    });
    const zLo = Hm.median / 2 - Wt - O.ep / 2, zHi = yFace + Wr + O.ep / 2;
    sup2.forEach((q, i) => {
      if (q.kind === 'pile' && q.y > zLo + 1e-6 && q.y < zHi - 1e-6) issues.push({ lvl: 'err', msg: `${deck.src} : pile P${i} à ${fmt(q.y)} m de l'axe de l'autoroute, dans la chaussée ou la largeur de fonctionnement des dispositifs de retenue (axe de pile ≤ ${fmt(Math.max(0, zLo))} m dans le TPC ou ≥ ${fmt(zHi)} m).` });
      if (q.kind === 'culee' && q.yCrest - R < yFace + Wr - 1e-6) issues.push({ lvl: 'warn', msg: `${deck.src} : culée C${i} trop proche, le pied du talus 3/2 (${fmt(q.yCrest - R)} m de l'axe) empiète sur la largeur de fonctionnement du dispositif de retenue (${fmt(yFace + Wr)} m) : reculez la culée.` });
    });
    if (sup2.some((q) => q.central) && Hm.median < 3) issues.push({ lvl: 'warn', msg: `${deck.src} : pile dans un TPC de moins de 3 m (guide SETRA 1989 § 1.2.2).` });
  }
  const spans = user ? user.map((v) => +(+v).toFixed(2)) : spansAuto;
  const dom = domaineEmploi(spans);
  const type = dom.recommande === 'autre' ? 'DP' : dom.recommande;
  const ep = epaisseurGuide({ spans, type, fck: O.fck, encorbellements: dom.types.includes('DP à encorbellements') });
  const hGuide = Math.ceil(ep.h * 20) / 20, h = +ov.h > 0.1 ? +ov.h : hGuide, width = 2 * halfW;
  const psiR = Math.round(psi * 10) / 10;
  const items = [
    { level: dom.level, text: dom.text },
    ...verifierTravure({ spans, psi: psiR }),
    ...verifierBiais({ spans, width, h, psi: psiR, type }).items,
    ...verifierCoupe({ width, spans, h, type }),
    ...verifierOuvertures({ spans, tirantAir: O.gab }),
  ];
  if (user) items.unshift({ level: 'info', text: `Travure saisie (automatique : ${spansAuto.map((v) => fmt(v, 2)).join(' + ')} m).` });
  if (+ov.h > 0.1 && Math.abs(h - hGuide) > 1e-6) items.push({ level: h < 0.95 * hGuide ? 'warn' : 'info', text: `Épaisseur imposée ${fmt(h)} m (guide : ${fmt(hGuide)} m).` });
  if (!user && !central && Hm.median >= 3 && O.nTrav === 'auto') items.push({ level: 'info', text: `Pas de pile centrale : la pile (${fmt(O.ep)} m) ne tient pas entre les largeurs de fonctionnement ${O.Wt} des dispositifs du TPC ; dispositif plus rigide (classe W plus faible) ou pile plus mince pour revenir à 4 travées.` });
  if (!user) for (const s of [-1, 1]) if (side[s].pushed) items.push({ level: 'info', text: `Culée côté sens ${s < 0 ? 1 : 2} reculée de ${fmt(side[s].yC - yC0)} m au-delà de la tête du talus pour que la travée de rive atteigne ${rMin} fois la travée voisine (§ 2.1.1).` });
  if (hwArr) for (const q of sup2.filter((x) => x.kind === 'culee')) {
    let k = 0; while (k < aL.length - 1 && aL[k] < q.a) k++;
    const wC = 2 * hwArr[k];
    if (wC > 2 * halfW + 1) items.push({ level: 'warn', text: `Tablier élargi à ${fmt(wC, 1)} m à la culée côté sens ${q.s < 0 ? 1 : 2} (${fmt(2 * halfW, 1)} m au croisement) : la tige s'y sépare en boucle et S-semi ; rapprocher la culée de l'autoroute ou prévoir un ouvrage à largeur variable.` });
  }
  const about = longueurAbout({ type, psi: psiR });
  for (const it of items) if (it.level === 'warn') issues.push({ lvl: 'warn', msg: `${deck.src} : ${it.text}` });
  const supRel = sup2.map((q) => ({ kind: q.kind, d: q.a - a0 })); // abscisses des appuis depuis le croisement, le long de l'axe
  return { supRel, P0: X0.p, deck, axis, aOff, eL, eR, oL, oR, halfW, psi: psiR, sinPsi, central: sup2.some((q) => q.central), sup: sup2, spans, spansAuto, user: !!user, shift: +ov.shift || 0, hGuide, dom, type, ep, h, about, items, issues, sX, nH, yFace, yP, Wr, Wt, Ht, R, yToe, yCrest, side };
}

// ---------------------------------------------------------------- dessin
function drawDeck(B, P, name, TH) {
  const { axis, aOff, eL, eR, oL, oR, sup, about, sinPsi, Ht, R } = B;
  const ring = (pts) => polySegs([...pts, pts[0]]);
  const path = (L, pts, extra = {}) => P({ k: 'path', L, segs: polySegs(pts), ...extra });
  const text = (L, p, s, rot = 0, align = 'center', h = TH) => P({ k: 'text', L, p, s, rot: upright(rot), align, h });
  const at = (poly, offs, c) => atOff(poly, offs, c);
  const cul = sup.filter((q) => q.kind === 'culee');
  // Tablier : des abouts (ligne d'appui + about, mesuré le long de l'axe) d'une culée à l'autre.
  const yEnd = cul.map((q) => q.s * (q.y + B.about * sinPsi));
  const L0 = at(eL, oL, yEnd[0]), L1 = at(eL, oL, yEnd[1]), R0 = at(eR, oR, yEnd[0]), R1 = at(eR, oR, yEnd[1]);
  if (!L0 || !L1 || !R0 || !R1) return;
  const left = slice(eL, L0, L1), right = slice(eR, R0, R1).reverse();
  const deckPoly = [...left, ...right];
  B.deckPoly = deckPoly;
  P({ k: 'fill', L: 'OUVRAGE', rings: [ring(deckPoly)], role: 'tablier' });
  path('OUVRAGE', [...deckPoly, deckPoly[0]], { wm: 0.25 });
  // Appuis : axes des lignes d'appui, piles voiles (cachées sous le tablier), sommiers des culées.
  const band = (c0, c1, shrink) => {
    const a = at(eL, oL, c0), b = at(eL, oL, c1), c = at(eR, oR, c1), d = at(eR, oR, c0);
    if (!a || !b || !c || !d) return null;
    if (!shrink) return [a.p, b.p, c.p, d.p];
    const u0 = norm(sub(d.p, a.p)), u1 = norm(sub(c.p, b.p));
    return [add(a.p, mul(u0, shrink)), add(b.p, mul(u1, shrink)), sub(c.p, mul(u1, shrink)), sub(d.p, mul(u0, shrink))];
  };
  for (const q of sup) {
    const c = q.s * q.y || 0;
    const l = at(eL, oL, c), r = at(eR, oR, c);
    if (l && r) path('OUVRAGE', [l.p, r.p], { role: 'axe', dash: [2, 0.6, 0.3, 0.6] });
    if (q.kind === 'pile') {
      const poly = band(c - B.deck.ep / 2, c + B.deck.ep / 2, 0.5);
      if (poly) { P({ k: 'fill', L: 'OUVRAGE', rings: [ring(poly)], role: 'pile' }); path('OUVRAGE', [...poly, poly[0]], { role: 'cache', dash: [0.8, 0.4] }); }
    } else {
      const poly = band(q.s * (q.y - 0.6), q.s * (q.y + 0.9), 0);
      if (poly) { P({ k: 'fill', L: 'OUVRAGE', rings: [ring(poly)], role: 'culee' }); path('OUVRAGE', [...poly, poly[0]], { role: 'cache', dash: [0.8, 0.4] }); }
    }
  }
  // Talus 3/2 devant la culée et quarts de cône aux angles du tablier.
  for (const q of cul) {
    const s = q.s, cr = s * q.yCrest;
    const cl = at(eL, oL, cr), crr = at(eR, oR, cr);
    if (!cl || !crr) continue;
    const toHwy = (p) => { const pr = pathProject(B.hwPath, p); return mul(rot90(pathTangentAt(B.hwPath, pr.s)), -s); };
    const dL = toHwy(cl.p), dR = toHwy(crr.p);
    const tL = add(cl.p, mul(dL, R)), tR = add(crr.p, mul(dR, R));
    path('TALUS', [cl.p, crr.p], { role: 'crete' });
    path('TALUS', [tL, tR]);
    // hachures du talus frontal : traits alternés de la crête vers le pied
    const n = Math.max(2, Math.floor(dist(cl.p, crr.p) / 1.2));
    const ticks = [];
    for (let k = 1; k < n; k++) { const a = G.lerp(cl.p, crr.p, k / n), dd = G.lerp(dL, dR, k / n); ticks.push([a, add(a, mul(dd, k % 2 ? R : R * 0.5))]); }
    P({ k: 'hatch', L: 'TALUS', lines: ticks, wm: 0.05 });
    // quarts de cône : centre à l'angle (crête), du pied frontal à la direction extérieure perpendiculaire à l'axe
    for (const [E, d0, sideSign] of [[cl, dL, 1], [crr, dR, -1]]) {
      const ia = Math.min(axis.length - 2, E.i), tAx = norm(sub(axis[ia + 1], axis[ia]));
      const out = mul(rot90(tAx), sideSign);
      let a0 = Math.atan2(d0.y, d0.x), a1 = Math.atan2(out.y, out.x), sw = a1 - a0;
      while (sw > Math.PI) sw -= G.TAU; while (sw < -Math.PI) sw += G.TAU;
      const arc = [], rays = [];
      for (let k = 0; k <= 24; k++) arc.push(G.polar(E.p, R, a0 + (sw * k) / 24));
      path('TALUS', arc);
      for (let k = 1; k < 8; k++) { const t = a0 + (sw * k) / 8; rays.push([E.p, G.polar(E.p, k % 2 ? R : R * 0.5, t)]); }
      P({ k: 'hatch', L: 'TALUS', lines: rays, wm: 0.05 });
      // pied du talus latéral du remblai d'accès (indicatif, 15 m)
      const away = mul(tAx, dot(tAx, neg(d0)) >= 0 ? 1 : -1), A1 = arc[arc.length - 1];
      path('TALUS', [A1, add(A1, mul(away, 15))], { dash: [1.5, 0.8] });
    }
  }
  // Dispositifs de retenue au droit des piles : face avant (trait continu) et limite de la largeur de fonctionnement W.
  const piles = sup.filter((q) => q.kind === 'pile');
  const sStations = [];
  for (const q of piles) for (const e of [[eL, oL], [eR, oR]]) { const z = at(e[0], e[1], q.s * q.y || 0); if (z) sStations.push(pathProject(B.hwPath, z.p).s); }
  if (sStations.length) {
    const s1 = Math.max(0, Math.min(...sStations) - 40), s2 = Math.max(...sStations) + 40;
    const line = (off) => { const pts = []; for (let st = s1; st <= s2 + 1e-6; st += 2) { const p = G.pathPointAt(B.hwPath, st), t = pathTangentAt(B.hwPath, st); pts.push(add(p, mul(rot90(t), off))); } return pts; };
    const lab = (off, s, txt) => { const st = (s1 + s2) / 2 + 30, p = G.pathPointAt(B.hwPath, st), t = pathTangentAt(B.hwPath, st); text('RETENUE', add(p, mul(rot90(t), off)), txt, Math.atan2(t.y, t.x), 'center', TH * 0.8); };
    for (const s of [-1, 1]) {
      path('RETENUE', line(s * B.yFace), { wm: 0.25 });
      path('RETENUE', line(s * (B.yFace + B.Wr)), { role: 'W', dash: [1, 0.6] });
      lab(s * (B.yFace + B.Wr / 2), s, `${B.deck.Wr} = ${fmt(B.Wr)} m`);
    }
    if (B.central) {
      const m = B.median / 2;
      for (const s of [-1, 1]) { path('RETENUE', line(s * m), { wm: 0.25 }); path('RETENUE', line(s * (m - B.Wt)), { role: 'W', dash: [1, 0.6] }); }
    }
  }
  // Cotes des travées (le long du bord gauche) et étiquette de l'ouvrage.
  for (let k = 1; k < sup.length; k++) {
    const c0 = sup[k - 1].s * sup[k - 1].y || 0, c1 = sup[k].s * sup[k].y || 0, cm = (c0 + c1) / 2;
    const m = at(axis, aOff, cm), mm = at(eL, oL, cm);
    if (!m || !mm) continue;
    const dir = norm(sub(axis[Math.min(axis.length - 1, m.i + 1)], axis[m.i]));
    text('COTATION', add(mm.p, mul(norm(sub(mm.p, m.p)), 1.6)), `${fmt(B.spans[k - 1])} m`, Math.atan2(dir.y, dir.x), 'center', TH * 0.9);
  }
  // Numéro de l'ouvrage cerclé, sur l'axe au-delà de la culée d'origine.
  const c0 = cul[0], tg = at(axis, aOff, c0.s * (c0.y + B.R + 4 + TH * 2.2));
  if (tg) { const r = TH * Math.max(2.2, 0.55 * name.length); P({ k: "circle", L: "OUVRAGE", c: tg.p, r }); text("OUVRAGE", G.add(tg.p, { x: 0, y: -TH * 0.55 }), name, 0, "center", TH * 1.4); }
  const cE = cul[1], lbl = at(axis, aOff, cE.s * (cE.y + B.R + 6));
  if (lbl) {
    const dir = norm(sub(axis[Math.min(axis.length - 1, lbl.i + 1)], axis[lbl.i]));
    const desc = `${name} : ${B.spans.length} travées ${B.spans.map((v) => fmt(v, 1)).join(' + ')} m, PSI-${B.type} h ≈ ${fmt(B.h)} m, biais ${fmt(B.psi, 1)} gr`;
    text('OUVRAGE', add(lbl.p, mul(rot90(dir), B.halfW + 2)), desc, Math.atan2(dir.y, dir.x), 'left', TH);
  }
}

// Point d'entrée : ajoute au dessin (D.prims) les ouvrages de l'échangeur et renvoie leurs fiches et contrôles.
export function buildOuvrages(prj, D, extra = {}) {
  const O = ouvrParams(prj), out = { list: [], issues: [] };
  // Numérotation commune OA1, OA2… le long de l'autoroute (passages supérieurs, tiges, anneaux et cadres PICF / PIPO) ;
  // un nom saisi par l'utilisateur remplace le numéro automatique.
  const cad = (extra.cadres || []).filter((g) => !g.err);
  const nameAll = (designs) => {
    const seq = [...designs.map((B) => ({ B, sX: B.sX })), ...cad.map((g) => ({ g, sX: g.sX }))].sort((a, b) => a.sX - b.sX), auto = new Map();
    seq.forEach((q, i) => auto.set(q.B || q.g, `OA${i + 1}`));
    out.cadreNames = new Map(cad.map((g) => [g.c.id, String(g.c.name || '').trim() || auto.get(g)]));
    out.cadreAuto = new Map(cad.map((g) => [g.c.id, auto.get(g)]));
    return auto;
  };
  if (!O.on || !prj.hwy?.on || !D?.hwy?.ok) { nameAll([]); return out; }
  const Hm = hwyParams(prj), TH = (prj.opts?.textH || 0.8) * 1.2;
  const decks = collectDecks(prj, D, extra).map((d) => ({ ...d, ep: O.ep, Wr: O.Wr, Wt: O.Wt }));
  const designs = [];
  for (const dk of decks) {
    let B = null;
    try { B = designDeck(prj, D, dk, O); } catch (e) { console.error(e); }
    if (!B) { out.issues.push({ lvl: 'warn', msg: `${dk.src} : ouvrage non implanté (axe trop court au droit du franchissement).` }); continue; }
    designs.push(B);
  }
  designs.sort((a, b) => a.sX - b.sX);
  const auto = nameAll(designs);
  designs.forEach((B) => {
    const nameAuto = auto.get(B), name = String(prj.ouvr?.decks?.[B.deck.key]?.name || '').trim() || nameAuto;
    B.name = name; B.hwPath = D.hwy.path; B.median = Hm.median;
    drawDeck(B, (o) => D.prims.push(o), name, TH);
    out.issues.push(...B.issues.map((q) => ({ ...q, msg: `${name} – ${q.msg}` })));
    // axe courbe : tracé en plan exporté vers PSIDA (calculé à la demande, la reconstitution d'une tige coûte ~0,5 s)
    const turn = deckTurn(B);
    let tr;
    const trace = () => { if (tr === undefined) { try { tr = deckTrace(B); } catch (e) { console.error(e); tr = null; } } return tr; };
    if (turn > 1e-3) B.items.push({ level: 'info', text: `Axe courbe (déviation ${fmt((turn * 200) / Math.PI, 1)} gr entre les culées) : le lien PSIDA transmet le tracé en plan (${B.deck.geo ? 'droites et arcs exacts' : 'droites, arcs et clothoïdes reconstitués'}) et le biais propre à chaque ligne d'appui ; tablier calculé en plaque (alertes éventuelles du tracé affichées à l'export).` });
    out.list.push({ supRel: B.supRel, trace, curved: turn > 1e-3, poly: B.deckPoly || [], P: B.P0, sX: B.sX, nameAuto, key: B.deck.key, spansAuto: B.spansAuto, user: B.user, shift: B.shift, hGuide: B.hGuide, name, src: B.deck.src, psi: B.psi, spans: B.spans, central: B.central, type: B.type, h: B.h, hText: B.ep.text, width: 2 * B.halfW, about: B.about, items: B.items, yP: B.yP, yC: B.side, Ht: B.Ht, roadHalf: B.deck.halfW, gab: O.gab, fck: O.fck, ep: O.ep, nPiles: B.sup.filter((q) => q.kind === 'pile').length });
  });
  return out;
}

// ---------------------------------------------------------------- export vers PSIDA (psida.ksr-infra.org)
// Données du formulaire PSIDA (noms des champs de son index.html) : ouvrage dalle, travure, largeur, épaisseur du guide,
// type de dalle, biais, tirant d'air, béton, abouts, chaussée, superstructures, piles voiles et culées noyées. Les champs
// absents gardent les valeurs par défaut de PSIDA. Superstructures : charges linéaires par défaut de PSIDA (corniche,
// dispositif de retenue) reportées aux mêmes distances des bords du tablier.
export const PSIDA_URL = 'https://psida.ksr-infra.org/';
const f2 = (v) => String(Math.round(v * 100) / 100);
export function psidaData(o, prj) {
  const b = o.width / 2, rh = o.roadHalf, about = Math.ceil(Math.max(0.5, o.about) * 20) / 20;
  const lines = [[5, b - 0.1], [6.5, b - 0.7], [5, b - 0.5]].flatMap(([g, e]) => [`${g} @ ${f2(-e)}`, `${g} @ ${f2(e)}`]).join(' ; ');
  return {
    ouvrage: 'dalle',
    spans: o.spans.map(f2).join(', '),
    width: f2(o.width),
    h: f2(o.h),
    typeDalle: o.type === 'DP' ? 'DP' : 'DA',
    psi: f2(Math.max(30, Math.min(100, o.psi))),
    tirantAir: f2(o.gab),
    fck: f2(o.fck),
    overhangs: `${f2(about)}, ${f2(about)}`,
    roadway: `${f2(-rh)}, ${f2(rh)}`,
    footways: '',
    lines,
    ap_pileType: 'voile',
    ap_pileB: f2(o.ep),
    ap_pileH: Array(Math.max(1, o.nPiles)).fill(f2(o.gab)).join(', '),
    ap_culType: 'enterree',
    plan_ouvrage: `${o.name} – ${o.src}`,
    plan_projet: prj?.name || '',
    ...psidaTraceFields(o),
  };
}
// Ouvrage courbe : champ caché « trace » de PSIDA (tracé en plan, abscisses et biais des lignes d'appui), travure le
// long de l'axe courbe, biais le plus prononcé (choix des appareils d'appui) et méthode en plaque, comme l'import DXF.
function psidaTraceFields(o) {
  const t = o.curved && typeof o.trace === 'function' ? o.trace() : null;
  if (!t?.curved) return {};
  return {
    trace: JSON.stringify({ segments: t.segments, s0: t.s0, source: t.source, stations: t.stations, ...(t.psiLignes ? { psiLignes: t.psiLignes } : {}) }),
    spans: t.spans.map((L) => String(Math.round(L * 1000) / 1000)).join(', '),
    psi: String(Math.round(t.psiMin)),
    methodeTablier: 'plaque',
  };
}
const b64 = (txt) => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(txt))) : Buffer.from(txt, 'utf8').toString('base64'));
// Alertes du tracé exporté (biais < 50 gr à une ligne d'appui, angle vif, reconstitution imprécise) à montrer avant l'export.
export function psidaWarnings(o) { const t = o.curved && typeof o.trace === 'function' ? o.trace() : null; return t?.warnings || []; }
export function psidaLink(o, prj) { return `${PSIDA_URL}#conception/d=${encodeURIComponent(b64(JSON.stringify(psidaData(o, prj))))}`; }
export function psidaProject(o, prj) { return JSON.stringify({ format: 'psida-projet', version: '0.99', date: new Date().toISOString(), source: 'GIRA (carr.ksr-infra.org)', data: psidaData(o, prj) }, null, 1); }
