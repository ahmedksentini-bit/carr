// roundabout.js — construction géométrique du giratoire (plan d'implantation).
// Repère local d'une branche : origine au centre O de l'anneau, x le long de l'axe vers l'extérieur,
// y vers la gauche (vu depuis le centre). L'entrée est du côté +y, la sortie du côté −y
// (circulation à droite, anneau parcouru dans le sens trigonométrique).
// Rg, Ri, le, ls et le triangle de l'îlot sont mesurés aux rives peintes ; les bords de chaussée sont à la BDD
// (extérieur) ou à la BDG (côté îlot central et îlots séparateurs) de ces rives.
import * as G from './geom.js';
import { islandDims, sectionParams, sideBands, TAD } from './norms.js';
import { addDevers } from './devers.js';
import { fmt, fmtGis, upright, autoCenter, branchDirection, frame, warpFrame, nearFar, polylineAfter, sideBandPrims } from './common.js';
import { buildApproach, crossLine, widthAlong, flareEnd } from './approach.js';
// polygone densifié (pas ≤ step, m ; 0 : inchangé), avant enroulement sur un axe courbe
const densify = (poly, step) => (!(step > 0) ? poly : poly.flatMap((p, i) => { const q = poly[(i + 1) % poly.length], k = Math.max(1, Math.ceil(G.dist(p, q) / step)); return Array.from({ length: k }, (_, j) => ({ x: p.x + ((q.x - p.x) * j) / k, y: p.y + ((q.y - p.y) * j) / k })); }));
import { buildPlan } from './plan.js';
import { buildBypass } from './bypass.js';
import { makeDims } from './dims.js';
import { crossing, crossingPrims, cutAtX, polyOf, closedSegs } from './crossing.js';
import { addSigns } from './signs.js';
import { buildEchangeur } from './echangeur.js';
import { isPeanut, peanutParams, peanutShape, autoPeanutDir, gisToVec, vecToGis, projectOnPath, subPath, pointNormalAt, waistWidth, signedOffset } from './ringshape.js';

const { add, sub, mul, dot, norm, rot90, neg, ang, polar, L, A } = G;
const num = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);
// Rayon unique minimal (rive) quand Re et Rs fusionnent : rayon extérieur de giration d'un autobus, 12,50 m
// (directive 2001/85/CE, annexe I § 7.12 — couronne 12,50 m / 5,30 m) ; à valider par l'épure du véhicule de projet.
export const RFUS = 12.5;

export { fmt, fmtGis, autoCenter };

// Point d'entrée : giratoire ou carrefour plan (T, X) selon le type du projet.
// opt.only : { bi, label } — ne calcule que cette épure de giration (recherche des corrections).
export function buildDesign(prj, opt = {}) {
  const D = prj.kind === 'T' || prj.kind === 'X' ? buildPlan(prj, opt) : buildRoundabout(prj);
  // Signalisation verticale (panneaux, balises J5) : ajoutée au projet dérivé, sauf pour les calculs intermédiaires.
  if (!opt.only) { try { addSigns(prj, D, opt); } catch (e) { console.error(e); D.signs = []; D.signIssues = [{ lvl: 'err', msg: 'Signalisation : ' + e.message }]; } }
  // Échangeur autoroutier (section courante et bretelles), s'il est activé.
  if (!opt.only) { try { buildEchangeur(prj, D); } catch (e) { console.error(e); D.ramps = []; D.echIssues = [{ lvl: 'err', msg: 'Calcul impossible : ' + e.message }]; } }
  return D;
}

// Raccordements Re (branche bd) et Rs (branche suivante nx) qui se chevauchent sur l'anneau : un seul arc, tangent
// aux deux rives (prolongées en ligne droite vers l'anneau) et de préférence à la rive de l'anneau (cercle Oc, Rr) ;
// si ce rayon est inférieur à Rmin (giration d'un bus), on garde Rmin et l'arc reste en retrait de l'anneau.
// Rayon donné à la rive (peinture), comme Re / Rs ; bord de chaussée concentrique à bdd. Sens du secteur : rive
// d'entrée de bd vers l'anneau, puis rive de sortie de nx vers l'extérieur, terrain à droite (arc horaire).
// Abscisse curviligne de la projection de X sur un chemin (segments droits et arcs).
function projS(path, X) {
  let best = Infinity, sBest = 0, acc = 0;
  for (const sg of path) {
    const Ls = G.segLen(sg);
    let t;
    if (sg.t === 'L') { const d = G.sub(sg.b, sg.a), l2 = G.dot(d, d); t = l2 > 0 ? G.clamp(G.dot(G.sub(X, sg.a), d) / l2, 0, 1) : 0; }
    else { const sw = G.sweep(sg), a = G.ang(G.sub(X, sg.c)), da = sg.ccw ? G.ccwSweep(sg.sa, a) : G.ccwSweep(a, sg.sa); t = da <= sw ? da / sw : (da - sw < G.TAU - da ? 1 : 0); }
    const d = G.dist(G.segAt(sg, t), X);
    if (d < best) { best = d; sBest = acc + t * Ls; }
    acc += Ls;
  }
  return sBest;
}

export function fuseFillets(bd, nx, Oc, Rr, bdd, Rmin) {
  const { add, sub, mul, norm, dist } = G;
  // Rive jusqu'au point de tangence Tl du raccordement (exclu), prolongée en ligne droite vers l'anneau (60 m).
  const cut = (sd) => {
    const P = sd.paintW, k = P.findIndex((sg) => dist(G.segEnd(sg), sd.Tl) < 1e-4);
    if (k < 0) return null;
    const last = P[k], Ls = G.segLen(last), e = Math.min(0.05, Ls / 2);
    const d = norm(sub(G.segEnd(last), G.segAt(last, 1 - e / Ls)));
    const keep = P.slice(0, k + 1), Lk = G.pathLen(keep);
    const near = G.pathTail(keep, Math.max(0, Lk - 90)); // partie utile : les 90 derniers mètres
    return { path: [...near, G.L(sd.Tl, add(sd.Tl, mul(d, 60)))], full: [...keep, G.L(sd.Tl, add(sd.Tl, mul(d, 60)))], Lk, Q: sd.Tl, d };
  };
  const A1 = cut(bd.entry), A2 = cut(nx.exit);
  if (!A1 || !A2) return { error: 'géométrie des rives non reconnue' };
  const poly = (segs) => G.samplePath(segs.flatMap((sg) => (sg.t === 'L' ? [sg] : [sg])), 0.25);
  const isect = (P, Q) => {
    const out = [];
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      for (let j = 1; j < Q.length; j++) {
        const c = Q[j - 1], d = Q[j];
        if (Math.max(c.x, d.x) < x0 || Math.min(c.x, d.x) > x1 || Math.max(c.y, d.y) < y0 || Math.min(c.y, d.y) > y1) continue;
        const r = sub(b, a), q = sub(d, c), den = G.cross(r, q);
        if (Math.abs(den) < 1e-12) continue;
        const t = G.cross(sub(c, a), q) / den, u = G.cross(sub(c, a), r) / den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) out.push(add(a, mul(r, t)));
      }
    }
    return out;
  };
  // Centre du cercle de rayon R tangent aux deux rives, côté terrain (à droite de l'entrée de bd, à gauche de la
  // sortie de nx parcourue vers l'anneau) : intersection des rives décalées de R, la plus proche de l'anneau.
  const centre = (R) => {
    const I = isect(poly(G.offsetPath(A1.path, -R)), poly(G.offsetPath(A2.path, R)));
    return I.length ? I.reduce((m, p) => (!m || dist(p, Oc) < dist(m, Oc) ? p : m), null) : null;
  };
  const f = (R) => { const C = centre(R); return C ? dist(C, Oc) - R - Rr : null; };
  // Rayon tangent à la rive de l'anneau (f = 0), par dichotomie sur [lo, hi].
  let Rt = null;
  const lo0 = bdd + 0.5, fl = f(lo0);
  if (fl != null && fl < 0) {
    let lo = lo0, hi = null;
    for (let R = Math.max(lo0 * 2, 4); R <= 120; R *= 1.4) { const v = f(R); if (v == null) break; if (v >= 0) { hi = R; break; } lo = R; }
    if (hi != null) {
      for (let k = 0; k < 40 && hi - lo > 1e-3; k++) { const m = (lo + hi) / 2, v = f(m); if (v != null && v < 0) lo = m; else hi = m; }
      Rt = hi;
    }
  }
  // Le rayon unique ne doit pas entamer les branches : points de tangence au-delà de Tl (vers l'anneau), ou en
  // amont seulement sur la partie rectiligne de la rive (écart ≤ 5 cm à la droite en Tl).
  const fits = (R) => {
    const C = centre(R);
    if (!C) return false;
    for (const A of [A1, A2]) {
      const sT = projS(A.full, C);
      if (sT >= A.Lk - 1e-6) continue;
      const gone = G.samplePath(G.pathTail(G.pathHead(A.full, A.Lk), sT), 0.5);
      if (gone.some((p) => Math.abs(G.cross(A.d, sub(p, A.Q))) > 0.05)) return false;
    }
    return true;
  };
  let R = Rt != null && Rt >= Rmin - 1e-6 ? Rt : Rmin, limited = false;
  if (R === Rt && !fits(Rt)) return { error: `le rayon tangent à l'anneau (${fmt(Rt, 1)} m) déborde des alignements des branches` };
  if (R === Rmin && !fits(Rmin)) {
    // Rayon bus trop grand pour le coin : plus grand rayon qui tient (au moins le rayon tangent à l'anneau).
    let lo = Rt ?? lo0, hi = Rmin;
    if (!fits(lo)) return { error: `aucun rayon ne tient entre les rives (rayon tangent à l'anneau ${Rt != null ? fmt(Rt, 1) + ' m' : 'introuvable'})` };
    for (let k = 0; k < 40 && hi - lo > 1e-3; k++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
    R = lo; limited = true;
  }
  const C = centre(R);
  if (!C) return { error: `pas de cercle de rayon ${fmt(R, 1)} m tangent aux deux rives` };
  if (dist(C, Oc) < R + Rr - 0.01) return { error: `le rayon ${fmt(R, 1)} m empiète sur l'anneau` };
  const s1 = projS(A1.full, C), s2 = projS(A2.full, C);
  const T1 = G.pathPointAt(A1.full, s1), T2 = G.pathPointAt(A2.full, s2);
  if (Math.abs(dist(C, T1) - R) > 0.05 || Math.abs(dist(C, T2) - R) > 0.05) return { error: `rayon ${fmt(R, 1)} m non tangent aux rives` };
  const arcP = G.arcThrough(C, R, T1, T2, false);
  if (G.sweep(arcP) > Math.PI) return { error: 'arc fusionné supérieur à un demi-tour' };
  const paint1 = [...G.pathHead(A1.full, s1), arcP], paint2 = G.pathHead(A2.full, s2);
  // Bord de chaussée concentrique (bdd vers le terrain) ; bord d'origine conservé jusqu'au droit du point de
  // tangence (BDD propre à la branche à son extrémité), prolongé en ligne droite s'il le faut.
  const Re_ = R - bdd;
  if (Re_ < 0.5) return { error: 'rayon de bordure nul' };
  const E1 = add(T1, mul(norm(sub(C, T1)), bdd)), E2 = add(T2, mul(norm(sub(C, T2)), bdd));
  const bridge = (segs, X) => { const E = G.segEnd(segs[segs.length - 1]); return dist(E, X) > 1e-4 ? [...segs, G.L(E, X)] : segs; };
  const edgeTo = (path, X) => {
    const d = G.segEnd(path[path.length - 1]), t = G.segAt(path[path.length - 1], 0.999);
    const ext = [...path, G.L(d, add(d, mul(norm(sub(d, t)), 60)))];
    const h = G.pathHead(ext, projS(ext, X));
    return h.length ? bridge(h, X) : [G.L(G.segStart(path[0]), X)];
  };
  // bords sans leur raccordement : coupés au droit de Tl (rive) décalé de bdd vers le terrain
  const noFil = (sd, sgn) => {
    const P = sd.paintW, k = P.findIndex((sg) => dist(G.segEnd(sg), sd.Tl) < 1e-4), last = P[k], Ls = G.segLen(last);
    const d = norm(sub(G.segEnd(last), G.segAt(last, 1 - Math.min(0.05, Ls / 2) / Ls)));
    const X = add(sd.Tl, mul({ x: d.y, y: -d.x }, sgn * bdd));
    return G.pathHead(sd.edgeW, projS(sd.edgeW, X));
  };
  const edge1 = [...edgeTo(noFil(bd.entry, 1), E1), G.arcThrough(C, Re_, E1, E2, false)];
  const edge2 = edgeTo(noFil(nx.exit, -1), E2);
  const touch = add(Oc, mul(norm(sub(C, Oc)), Rr));
  return { R, Rt, C, T1, T2, arcP, paint1, paint2, edge1, edge2, touch, onRing: R === Rt, limited, Rmin };
}

// ext : longueurs minimales des alignements droits (abscisse locale), imposées par les voies directes de tourne-à-droite.
function buildRoundabout(prj, ext = {}) {
  const ring = prj.ring, sec = sectionParams(prj);
  const Rg = +ring.Rg, la = +ring.la, bf = +ring.bf || 0;
  const Ri = Rg - la;            // rive intérieure (peinture)
  const Rpi = Ri - sec.bdgRing;  // bord intérieur de la chaussée annulaire
  const Rb = Rpi - bf;           // îlot central infranchissable
  const Rpo = Rg + sec.bdd;      // bord extérieur de la chaussée annulaire
  const unit = prj.opts?.angleUnit || 'gon';
  const TH = +prj.opts?.textH || 0.8;
  const issues = [], prims = [], points = [], bds = [];
  const D = { kind: 'giratoire', ok: false, O: null, Rg, la, bf, Ri, Rpi, Rb, Rpo, sec, branches: bds, prims, points, issues };

  let O = prj.center.auto ? autoCenter(prj.branches) : null;
  if (!O && prj.center.x != null) O = { x: +prj.center.x, y: +prj.center.y };
  if (!O) return D;
  D.O = O;
  if (!(Rg > 0) || !(Ri > 0)) { issues.push({ lvl: 'err', msg: 'Rayons incohérents : il faut Rg > la (Ri = Rg − la > 0).' }); return D; }
  if (Rb <= 0) issues.push({ lvl: 'err', msg: 'BDG et bande franchissable plus larges que l\'îlot central.' });
  // Carrefour « cacahuète » (Sétra, fiche RACA 2010) : deux lobes reliés par des cols ; chaque branche se raccorde
  // au lobe de son côté, comme sur un giratoire circulaire de centre et de rayon ceux du lobe (ringshape.js).
  let shape = null;
  const tRi = -la, tRpi = -(la + sec.bdgRing), tRb = tRpi - bf, tRpo = sec.bdd;
  if (isPeanut(ring)) {
    const pp = peanutParams(ring, Rg);
    const dir = pp.gis != null ? gisToVec(pp.gis) : autoPeanutDir(O, prj.branches);
    shape = peanutShape(O, dir, pp);
    if (!shape.ok) { issues.push({ lvl: 'err', msg: `Carrefour cacahuète : ${shape.err}` }); return D; }
    D.shape = shape; D.Rg2 = pp.R2; D.peanut = { ...pp, gisAuto: pp.gis == null, gis: vecToGis(dir) };
    if (pp.R2 - (la + sec.bdgRing + bf) <= 0) issues.push({ lvl: 'err', msg: 'Lobe 2 : BDG et bande franchissable plus larges que l\'îlot central.' });
    const tMax = sec.bdd + sideBands(prj, sec).reduce((acc, [, w]) => acc + w, 0);
    for (const W of shape.waists) if (W.kind === 'A' && W.Rw <= tMax + 0.5) issues.push({ lvl: 'err', msg: `Col ${W.s > 0 ? 'gauche' : 'droit'} : rayon ${fmt(W.Rw, 2)} m ≤ largeur BDD + abords (${fmt(tMax, 2)} m) — les bords extérieurs se retournent.` });
    const wI = waistWidth(shape, tRb);
    D.peanut.waistIsl = wI;
    if (wI <= 0) issues.push({ lvl: 'err', msg: 'Carrefour cacahuète : les cols se croisent, l\'îlot central est coupé en deux — augmentez l\'entraxe ou les rayons des cols, ou réduisez la largeur d\'anneau.' });
    else if (wI < 2 * 3.5) issues.push({ lvl: 'warn', msg: `Carrefour cacahuète : îlot central large de ${fmt(wI, 2)} m seulement au droit des cols (partie infranchissable) — perception de l'îlot et dégagement des obstacles à vérifier.` });
  }

  prj.branches.forEach((b, idx) => {
    const name = b.name || `B${idx + 1}`;
    if (!b.axis || b.axis.length < 2) return;
    // Cacahuète : centre et rayon du lobe de rattachement (le plus proche de l'extrémité de l'axe saisi).
    const lob = shape ? shape.lobeOf(norm(sub(nearFar(b.axis, D.O).slice(-1)[0], D.O))) : null;
    const O = lob ? lob.c : D.O, Rg = lob ? lob.R : D.Rg, target = { kind: 'circle', R: Rg };
    const isl = islandDims(prj, b);
    const tpcHalf = b.tpc?.on ? Math.max(0, +b.tpc.width) / 2 : 0;
    const hasIsland = isl.type !== 'aucun' || tpcHalf > 0;
    const hb = isl.type === 'aucun' ? tpcHalf : Math.max(isl.b / 2, tpcHalf);
    const th = tpcHalf;
    const h = isl.h;
    const nIn = Math.max(1, +b.nIn || 1), nOut = Math.max(1, +b.nOut || 1), wl = +b.wLane;
    const wIn = nIn * wl, wOut = nOut * wl;
    const le = +b.le, ls = +b.ls, Re = +b.Re, Rs = +b.Rs;
    const pl = nearFar(b.axis, O), far = pl[pl.length - 1];
    if (G.dist(far, O) < Rg + 5) { issues.push({ lvl: 'err', bi: idx, msg: `${name} : l'axe saisi doit sortir de l'anneau (> Rg + 5 m).` }); return; }

    // --- Axe de la branche : alignement droit dirigé vers le centre, puis raccordement de rayon sec.axeR à l'axe saisi,
    // qu'il suit ensuite. Alignement compté depuis l'anneau : au moins l'îlot et l'évasement réel (plancher, voie
    // directe éventuelle comprise), 20 m de marge en plus par défaut ; longueur saisie (b.axeL) bornée au plancher.
    // Axe saisi trop court pour la longueur par défaut : marge abandonnée pour suivre la courbe dessinée ; encore trop
    // court : courbe ignorée, signalée.
    const aiR = hasIsland && !th && isl.type !== 'aucun' ? -isl.shift : 0;   // axe radial : a = 0, x0 = Rg, triangle décalé
    const Lfloor = Math.max(flareEnd({ x0: Rg, xT: Rg + h, a: 0, ai: aiR, hb, th, le, ls, wIn, wOut }), ext[idx] || 0);
    const Lauto = Math.max(Lfloor + 20, ext[idx] || 0);
    // Approche en courbe : alignement droit saisi plus court que le plancher (10 m au moins depuis l'anneau), ou axe
    // dessiné trop court pour le plancher ; îlot, bordures et évasement sont alors enroulés sur l'axe courbe (warpFrame).
    // Exclue avec une voie directe de tourne-à-droite (construite dans le repère droit de la branche).
    const tad = (ext[idx] || 0) > 0, xsMin = Rg + 10;
    const Lwant = +b.axeL > 0 ? Math.max(xsMin, Rg + +b.axeL) : null;
    let Lmin = Lwant != null ? (tad ? Math.max(Lfloor, Lwant) : Lwant) : Lauto;
    if (Lwant != null && +b.axeL < 10) issues.push({ lvl: 'warn', bi: idx, msg: `${name} : alignement droit porté à 10 m depuis l'anneau (minimum de l'approche en courbe).` });
    if (tad && Lwant != null && Lwant < Lfloor - 0.05) issues.push({ lvl: 'warn', bi: idx, msg: `${name} : voie directe de tourne-à-droite — alignement droit porté à ${fmt(Lfloor - Rg, 1)} m depuis l'anneau (îlot et évasement), sans approche en courbe.` });
    let u, a = 0, cont = null, axisFillets = [], warp = false;
    const axeR = +b.axeR > 0 ? +b.axeR : sec.axeR;
    if (b.radial !== false) {
      let pa = polylineAfter(pl, O, Lmin + 15);
      if (!pa && Lwant == null) {   // axe trop court pour la marge : plancher, puis approche en courbe de plus en plus tôt
        const essais = [Lfloor]; if (!tad) for (let L = Lfloor - 5; L > xsMin; L -= 5) essais.push(L); if (!tad) essais.push(xsMin);
        for (const L of essais) { const pf = polylineAfter(pl, O, L + 15); if (pf) { pa = pf; Lmin = L; break; } }
      }
      if (!pa && pl.length > 2) issues.push({ lvl: 'warn', bi: idx, msg: `${name} : axe dessiné trop court (${fmt(G.dist(far, O) - Rg, 0)} m depuis l'anneau) : sa courbe n'est pas suivie et la branche reste droite. Prolongez l'axe (« + » à son extrémité).` });
      if (pa) {
        const defl = Math.acos(G.clamp(dot(norm(sub(pa.J, O)), pa.dir), -1, 1));
        pa = polylineAfter(pl, O, Lmin + axeR * Math.tan(defl / 2) + 2) || pa;
        u = norm(sub(pa.J, O));
        // Rayons : axeR au raccordement avec l'alignement radial (J), rayon propre de chaque sommet saisi (p.r) sinon.
        const pts = [add(O, mul(u, Lmin)), pa.J, ...pa.rest.filter((p) => G.dist(p, pa.J) > 0.5)];
        const want = pts.map((p, i) => (i === 0 || i === pts.length - 1 ? 0 : i === 1 ? axeR : +p.r > 0 ? +p.r : axeR));
        cont = G.roundPolyline(pts, want);
        // Raccordements obtenus (le rayon est réduit s'il ne tient pas entre les segments) : sommet saisi, rayons.
        for (const s of cont) {
          if (s.t !== 'A') continue;
          const mid = G.segAt(s, 0.5);
          let k = 1;
          for (let i = 2; i < pts.length - 1; i++) if (G.dist(pts[i], mid) < G.dist(pts[k], mid)) k = i;
          axisFillets.push({ arc: s, vi: k === 1 ? -1 : b.axis.indexOf(pts[k]), want: want[k], r: s.r });
        }
        warp = Lmin < Lfloor - 1e-6 && cont.some((sg) => sg.t === 'A');
        if (warp) issues.push({ lvl: 'info', bi: idx, msg: `${name} : approche en courbe dès ${fmt(Lmin - Rg, 1)} m de l'anneau (îlot et évasement suivent l'axe courbe).` });
      } else u = norm(sub(far, O));
    } else {
      const { Q, segDir } = branchDirection(b, O, Rg + h + 10);
      u = dot(segDir, sub(Q, O)) < 0 ? neg(segDir) : segDir;
      a = dot(sub(Q, O), rot90(u));
      if (Math.abs(a) > Rg * 0.6) { issues.push({ lvl: 'err', bi: idx, msg: `${name} : axe trop excentré (${fmt(a)} m) — axe radial utilisé.` }); u = norm(sub(Q, O)); a = 0; }
    }
    const Fr = warp ? warpFrame(O, u, cont, Lmin) : frame(O, u), { theta, n, W, Ws, Wp } = Fr;
    const x0 = Math.sqrt(Rg * Rg - a * a), xT = x0 + h;
    // Axe du triangle de construction (décalé vers la gauche de l'usager entrant, ACI).
    const ai = hasIsland && !th && isl.type !== 'aucun' ? a - isl.shift : a;
    let xEnd, Cfull = null;
    if (cont) {
      // approche en courbe : construction locale jusqu'au plancher, axe suivi au-delà (abscisse curviligne)
      xEnd = warp ? Lfloor : Lmin;
      if (warp) { Cfull = cont; cont = G.pathTail(cont, Lfloor - Lmin); }
      if (b.length) cont = G.pathHead(cont, Math.max(0, +b.length - (xEnd - x0)));
      const C0 = warp ? null : cont;
      if (C0) axisFillets = axisFillets.filter((f) => C0.some((sg) => sg.t === 'A' && G.dist(G.segStart(sg), G.segStart(f.arc)) < 1e-6));
    } else {
      xEnd = b.length ? x0 + +b.length : Math.min(Math.max(dot(sub(far, O), u), xT + 40), xT + 80);
      xEnd = Math.max(xEnd, Lmin);
    }
    if (cont && !cont.length) cont = null;

    const ap = buildApproach({ name, idx, target, a, ai, x0, xT, xEnd, hb, th, hasIsland, isl, le, ls, wIn, wOut, Re, Rs }, issues);
    if (!ap) return;
    const { en, ex } = ap;
    const off = (d) => (cont ? G.offsetPath(cont, d) : []);
    // Rives (peinture) et bords de chaussée, de l'extrémité de la branche jusqu'à la tangence sur l'anneau.
    // BDD et berme propres à la branche (profil de la route raccordée) : celles du carrefour au droit de l'anneau
    // (évasement), puis transition linéaire dès la fin de l'évasement (xT) ; la largeur saisie pour la branche est tenue
    // sur tout le reste de l'alignement jusqu'à son extrémité (xEnd), au droit de la route raccordée.
    const bddB = num(b.bdd, sec.bdd), bermeB = num(b.berme, sec.berme);
    const dTr = Math.max(Math.abs(bddB - sec.bdd), Math.abs(bermeB - sec.berme));
    const xA = Math.min(xT, xEnd), xB = Math.min(xEnd, xA + Math.max(10, 15 * dTr));
    const ramp = (v0, v1) => (x) => (x <= xA ? v0 : x >= xB ? v1 : v0 + ((v1 - v0) * (x - xA)) / (xB - xA || 1));
    const bddAt = ramp(sec.bdd, bddB), bermeAt = ramp(sec.berme, bermeB);
    const xOf = (p) => Fr.toL(p).x;
    en.edge = Math.abs(bddB - sec.bdd) < 1e-6 ? G.offsetPath(en.curb, -sec.bdd) : G.offsetPathVar(en.curb, (q) => -bddAt(q.x));
    ex.edge = Math.abs(bddB - sec.bdd) < 1e-6 ? G.offsetPath(ex.curb, sec.bdd) : G.offsetPathVar(ex.curb, (q) => bddAt(q.x));
    // Passage piéton à ppRecul de la ligne de cédez-le-passage, îlot séparateur coupé en refuge.
    let cross = null;
    if (sec.pp) {
      const xc = x0 + sec.ppRecul + sec.ppW / 2, hi = cutAtX(en.edge, xc), lo = cutAtX(ex.edge, xc), I = ap.island;
      if (hi && lo && xc + sec.ppW / 2 < xEnd) {
        cross = crossing(xc, sec.ppW, lo, hi, { islands: I?.outline && I.closed ? [polyOf(I.outline)] : [], painted: I?.hatch || [] });
      } else issues.push({ lvl: 'info', bi: idx, msg: `${name} : passage piéton non dessiné (branche trop courte).` });
    }
    const full = (contPath, local) => [...G.revPath(contPath), ...Wp(local)];
    const side = (sd, s, wa) => {
      const paintW = full(off(s * (th + wa)), sd.curb), edgeW = full(off(s * (th + wa + bddB)), sd.edge);
      return {
        ...sd, paintW, edgeW, edgeCont: off(s * (th + wa + bddB)), curbW: paintW,
        F: G.segStart(edgeW[0]), Fpaint: G.segStart(paintW[0]),
        Tc: W(sd.fil.Tc), Tl: W(sd.fil.Tl), C: W(sd.fil.C),
      };
    };
    let island = null;
    if (ap.island) {
      const I = ap.island;
      island = {
        outline: I.outline && Wp(I.outline), curb: I.curb && Wp(I.curb), closed: I.closed, paint: I.paint.map(Wp),
        hatch: I.hatch && I.hatch.map((poly) => densify(poly, warp ? 1 : 0).map(W)), tip: I.tip && W(I.tip), headIn: W(I.headIn), headOut: W(I.headOut),
        pieces: cross?.pieces[0] ? cross.pieces[0].map((poly) => Wp(closedSegs(poly))) : null,
      };
      // TPC : îlot en saillie et rives prolongés le long de l'axe courbe.
      if (th > 0 && cont && island.curb) {
        const g = Math.max(0, isl.bdg || 0);
        const cOut = off(-(th - g)), cIn = off(th - g);
        island.curb = [...G.revPath(cOut), ...island.curb, ...cIn];
        island.outline = [...island.curb, L(G.segEnd(island.curb[island.curb.length - 1]), G.segStart(island.curb[0]))];
        island.paint = island.paint.map((p, k) => [...p, ...off(k === 0 ? th : -th)]);
      }
    }
    const yl = crossLine(en, target, 0.25), xl = crossLine(ex, target, 0.25);
    const bd = {
      idx, id: b.id, name, role: 'branche', Oc: O, Rgc: Rg, lobe: lob?.k || 0, theta, u, n, a, ai, x0, xT, xEnd, h, b: isl.b, hb, th, isl, W, Ws, Wp, cont, axisFillets, axeL: { auto: Lauto - Rg, min: Lfloor - Rg, used: Lmin - Rg },
      entry: side(en, 1, wIn), exit: side(ex, -1, wOut), wIn, wOut,
      island, cross, yieldStart: yl?.a, yieldEnd: yl?.b, exitStart: xl?.a, exitEnd: xl?.b, gis: fmtGis(theta, unit),
      farAxis: cont ? G.segEnd(cont[cont.length - 1]) : W({ x: xEnd, y: a }),
      farDir: cont ? norm(sub(G.segEnd(cont[cont.length - 1]), G.segAt(cont[cont.length - 1], 0.98))) : u,
      bdd: bddB, berme: bermeB, bddAtW: (p) => bddAt(xOf(p)), bermeAtW: (p) => bermeAt(xOf(p)),
      // point du monde relevant de cette branche (au-delà du début de la transition, près de son axe) : pour les abords
      near: (p) => { const q = Fr.toL(p); return q.x > xA - 1 && Math.abs(q.y - a) < th + Math.max(wIn, wOut) + Math.max(bddB, sec.bdd) + 6; },
      toL: Fr.toL, at: Fr.at, xs: warp ? Lmin : null, axeC: Cfull,
    };
    bd.entry.phiTc = ang(sub(bd.entry.Tc, O));
    bd.exit.phiTc = ang(sub(bd.exit.Tc, O));
    if (lob) {
      // Raccordement sur l'arc libre du lobe (hors des cols).
      const sw = G.ccwSweep(lob.a[0], lob.a[1]), inArc = (phi) => G.ccwSweep(lob.a[0], phi) <= sw + 1e-6;
      if (!inArc(bd.exit.phiTc) || !inArc(bd.entry.phiTc)) issues.push({ lvl: 'err', bi: idx, msg: `${name} : raccordée au lobe ${lob.k} en partie dans un col (Re / Rs hors de l'arc circulaire du lobe) — orientez la branche vers l'extrémité du lobe ou modifiez l'entraxe / l'orientation.` });
      bd.sRing = projectOnPath(shape.path(0), W({ x: x0, y: a })).s;
    }
    bds.push(bd);
  });

  if (shape) bds.sort((p, q) => p.sRing - q.sRing);
  else bds.sort((p, q) => G.normAng(p.theta) - G.normAng(q.theta));
  D.ok = true;
  D.zoomR = Rpo + (shape ? shape.e / 2 + Math.max(0, D.Rg2 - Rg) : 0) + Math.max(Rg, ...bds.map((bd) => bd.h)) + 15;
  D.mini = prj.context === 'urbain' && Rg < 12;

  // Déflexion (méthode des trois points) : trajectoire passant, au droit de la rive de l'anneau, à 2 m de la
  // bordure d'entrée, à 1,50 m de l'îlot central (Ri) et à 2 m de la bordure de la sortie la plus opposée.
  for (const bd of bds) {
    if (bds.length < 2) continue;
    let to = null, bestDiff = Infinity;
    for (const q of bds) {
      if (q === bd) continue;
      const diff = Math.abs(G.ccwSweep(bd.theta, q.theta) - Math.PI);
      if (diff < bestDiff) { bestDiff = diff; to = q; }
    }
    if (!to) continue;
    const P1 = bd.W({ x: bd.x0, y: bd.entry.H.y + (bd.entry.wRing ?? bd.entry.w) - 2 });
    const P3 = to.W({ x: to.x0, y: to.exit.H.y - (to.exit.wRing ?? to.exit.w) + 2 });
    let P2;
    if (shape) {
      // Point à 1,50 m de la rive intérieure le plus saillant vers l'extérieur par rapport à la corde P1P3 (pour un
      // cercle : le point à mi-angle) — l'arc des trois points contourne ainsi tout l'îlot.
      const path = shape.path(tRi + 1.5), Lt = G.pathLen(path), s1 = projectOnPath(path, P1).s, s3 = projectOnPath(path, P3).s;
      const span = (((s3 - s1) % Lt) + Lt) % Lt, sw = (span / Lt) * G.TAU;
      if (sw > 1.25 * Math.PI || sw < 0.2) continue;
      const right = G.neg(rot90(norm(sub(P3, P1))));
      let best = -Infinity;
      for (let k = 1; k < 200; k++) { const q = pointNormalAt(path, s1 + (span * k) / 200).p, h = dot(sub(q, P1), right); if (h > best) { best = h; P2 = q; } }
    } else {
      const phi1 = ang(sub(P1, O)), phi3 = ang(sub(P3, O));
      const sw = G.ccwSweep(phi1, phi3);
      if (sw > 1.25 * Math.PI || sw < 0.2) continue;
      P2 = polar(O, Ri + 1.5, phi1 + sw / 2);
    }
    const cc = G.circumcircle(P1, P2, P3);
    if (!cc) continue;
    const ccw = G.cross(sub(P2, P1), sub(P3, P2)) > 0;
    bd.defl = { R: cc.r, to: to.name, arc: A(cc.c, cc.r, ang(sub(P1, cc.c)), ang(sub(P3, cc.c)), ccw), pts: [P1, P2, P3] };
    if (shape) {
      // Cacahuète : si l'arc des trois points sort de l'anneau au droit d'un col (à moins de 1 m de la rive
      // extérieure, hors des abords des points P1 / P3), la trajectoire est contrainte en S par le col : la méthode
      // des trois points ne s'applique pas.
      const q = G.samplePath([bd.defl.arc], 0.5), n = q.length;
      bd.defl.sCurve = q.slice(Math.floor(n * 0.2), Math.ceil(n * 0.8)).some((p) => signedOffset(shape, p).off > -1);
    }
  }

  // ================= Primitives de dessin =================
  const P = (o) => prims.push(o);
  const text = (lay, p, s, rot = 0, align = 'center', h = TH) => P({ k: 'text', L: lay, p, s, rot: upright(rot), align, h });
  const dims = makeDims(P, TH);
  const rive = (segs, opt = {}) => { if (sec.rive && segs.length) P({ k: 'path', L: 'MARQUAGE', segs, wm: 0.15, ...opt }); };

  // Anneau : rives peintes (Rg entre les branches, Ri) et bords de chaussée (Rg + BDD, Ri − BDG).
  const ringEdge = [];
  // Ligne fermée de l'anneau au décalage t de la rive extérieure (cercle de rayon Rg + t, ou contour de la cacahuète).
  const loop = (t) => (shape ? shape.path(t) : [{ t: 'C', c: O, r: Rg + t }]);
  const loopPrim = (L_, t, extra = {}) => P(shape ? { k: 'path', L: L_, segs: shape.path(t), closed: true, ...extra } : { k: 'circle', L: L_, c: O, r: Rg + t, ...extra });
  if (!bds.length) {
    loopPrim('BORDURE', tRpo);
    if (sec.rive) loopPrim('MARQUAGE', 0, { wm: 0.15 });
  }
  const pathPo = shape?.path(tRpo), path0 = shape?.path(0), Lpo = pathPo ? G.pathLen(pathPo) : 0;
  const mod = (v) => (((v % Lpo) + Lpo) % Lpo);
  // Re / Rs qui se chevauchent : rayon unique (fuseFillets), au moins Rfus (giration d'un bus).
  const Rfus = Math.max(1, num(ring.Rfus, RFUS));
  // forced : rayon unique demandé (case « Rayon unique avec la branche suivante » de bd) sans chevauchement.
  const overlap = (i, bd, nx, forced = false) => {
    const msg = forced ? `${bd.name} / ${nx.name} : rayon unique demandé` : `${bd.name} / ${nx.name} : branches trop proches, les raccordements Re/Rs se chevauchent sur l'anneau`;
    if (bds.length < 2 || prj.traffic?.tad?.[bd.id] || (shape && bd.lobe !== nx.lobe)) { if (!forced) issues.push({ lvl: 'err', msg: msg + '.' }); else issues.push({ lvl: 'warn', bi: bd.idx, msg: `${msg} : impossible (voie directe, lobes différents ou branche unique).` }); return !forced; }
    const f = fuseFillets(bd, nx, bd.Oc, bd.Rgc, sec.bdd, Rfus);
    if (f.error) { issues.push({ lvl: 'err', bi: bd.idx, msg: `${msg} ; rayon unique impossible (${f.error})${forced ? ' — Re et Rs conservés' : ''}.` }); return !forced; }
    Object.assign(bd.entry, { paintW: f.paint1, curbW: f.paint1, edgeW: f.edge1, fused: f, Tc: f.touch });
    Object.assign(nx.exit, { paintW: f.paint2, curbW: f.paint2, edgeW: f.edge2, fused: f, Tc: f.touch });
    bd.entry.phiTc = nx.exit.phiTc = ang(sub(f.touch, bd.Oc));
    ringEdge[i] = [];
    const why = forced ? 'Re et Rs remplacés (demandé)' : 'Re et Rs se chevauchaient';
    issues.push(f.onRing
      ? { lvl: 'info', bi: bd.idx, msg: `${bd.name} / ${nx.name} : ${why} — fusionnés en un rayon unique R = ${fmt(f.R, 2)} m, tangent à la rive de l'anneau.` }
      : f.limited
        ? { lvl: 'warn', bi: bd.idx, msg: `${bd.name} / ${nx.name} : Re et Rs fusionnés en un rayon unique R = ${fmt(f.R, 2)} m, limité par l'angle entre les branches (${fmt(f.Rmin, 2)} m pour la giration d'un bus ne tient pas) — le mouvement de tourne-à-droite des autobus passe par l'anneau ; vérifier l'épure de giration.` }
        : { lvl: 'warn', bi: bd.idx, msg: `${bd.name} / ${nx.name} : Re et Rs fusionnés en un rayon unique R = ${fmt(f.R, 2)} m (minimum retenu pour la giration d'un bus${f.Rt != null ? ` ; le rayon tangent à l'anneau ne serait que de ${fmt(f.Rt, 2)} m` : ''}), en retrait de l'anneau — vérifier l'épure de giration.` });
    return true;
  };
  const wantFuse = (bd) => !!prj.branches[bd.idx]?.fuseNext;
  bds.forEach((bd, i) => {
    const nx = bds[(i + 1) % bds.length];
    if (shape) {
      const sA = (q) => projectOnPath(pathPo, q).s;
      const span = bds.length === 1 ? Lpo : mod(sA(nx.W({ x: nx.x0, y: nx.a })) - sA(bd.W({ x: bd.x0, y: bd.a })));
      const s0 = sA(bd.entry.Tc), s1 = sA(nx.exit.Tc), gap = mod(s1 - s0), free = gap < span && gap > 1e-3;
      if (free && wantFuse(bd) && overlap(i, bd, nx, true)) return;
      if (free) {
        ringEdge[i] = subPath(pathPo, s0, s1);
        const r0 = projectOnPath(path0, bd.entry.Tc).s, r1 = projectOnPath(path0, nx.exit.Tc).s;
        rive(subPath(path0, r0, r1));
      } else overlap(i, bd, nx);
      return;
    }
    const span = bds.length === 1 ? G.TAU : G.ccwSweep(bd.theta, nx.theta);
    const gap = G.ccwSweep(bd.entry.phiTc, nx.exit.phiTc), free = gap < span && gap > 1e-4;
    if (free && wantFuse(bd) && overlap(i, bd, nx, true)) return;
    if (free) {
      ringEdge[i] = [A(O, Rpo, bd.entry.phiTc, nx.exit.phiTc, true)];
      rive([A(O, Rg, bd.entry.phiTc, nx.exit.phiTc, true)]);
    } else overlap(i, bd, nx);
  });
  if (sec.rive) loopPrim('MARQUAGE', tRi, { wm: 0.15 });
  loopPrim('BORDURE', tRpi);
  if (bf > 0 && Rb > 0) loopPrim('ILOT_CENTRAL', tRb);

  // Voies directes de tourne-à-droite (case « TAD ») : de la branche i à la suivante.
  const bpFrom = new Map(), bpTo = new Set();
  let need = null;
  bds.forEach((bd, i) => {
    if (!prj.traffic?.tad?.[bd.id] || bds.length < 2) return;
    const nx = bds[(i + 1) % bds.length], br = prj.branches[bd.idx], T0 = TAD[prj.context];
    const r = buildBypass(D, bd, nx, ringEdge[i], {
      R: num(br.tadR, T0.R), w: num(br.tadW, T0.w), bdg: sec.bdgBr, bdd: sec.bdd, bddBr: bd.bdd, bddBrJ: nx.bdd, urbain: prj.context === 'urbain',
    });
    if (r.error) { issues.push({ lvl: 'err', bi: bd.idx, msg: `${bd.name} → ${nx.name} : voie directe de tourne-à-droite non dessinée (${r.error}).` }); return; }
    if (r.needK > bd.xEnd || r.needJ > nx.xEnd) {
      need = need || { ...ext };
      need[bd.idx] = Math.max(need[bd.idx] || 0, r.needK + 1);
      need[nx.idx] = Math.max(need[nx.idx] || 0, r.needJ + 1);
      return;
    }
    if (prj.context === 'interurbain' && r.rin < 40) issues.push({ lvl: 'warn', bi: bd.idx, msg: `${bd.name} → ${nx.name} : rive intérieure de la voie directe de rayon ${fmt(r.rin, 1)} m < 40 m (ACI).` });
    if (prj.context === 'interurbain' && r.rin > 75) issues.push({ lvl: 'info', bi: bd.idx, msg: `${bd.name} → ${nx.name} : rive intérieure de rayon ${fmt(r.rin, 1)} m (ACI : de préférence < 75 m).` });
    r.to = nx;
    bpFrom.set(i, r);
    bpTo.add((i + 1) % bds.length);
  });
  // Alignements droits trop courts pour la décélération ou l'insertion : on les allonge et on reconstruit (une fois).
  if (need && !ext.again) return buildRoundabout(prj, { ...need, again: true });
  D.bypasses = [...bpFrom.entries()].map(([i, r]) => ({ ...r, from: bds[i].name, to: r.to.name }));

  // Bords extérieurs de chaussée par secteur (de l'extrémité d'une branche à celle de la suivante, terrain à droite).
  const sectors = bds.map((bd, i) => {
    const nx = bds[(i + 1) % bds.length];
    if (bpFrom.has(i)) return [...G.revPath(bd.entry.edgeCont), ...bpFrom.get(i).right, ...nx.exit.edgeCont];
    return [...bd.entry.edgeW, ...(ringEdge[i] || []), ...G.revPath(nx.exit.edgeW)];
  });

  // Remplissage chaussée (règle pair-impair : trous = îlots).
  const outer = [];
  bds.forEach((bd, i) => outer.push(L(bd.exit.F, bd.entry.F), ...sectors[i]));
  const rings = bds.length ? [outer] : [loop(tRpo)];
  rings.push(loop(tRpi));
  bds.forEach((bd) => { if (bd.island?.outline) rings.push(...(bd.island.pieces || [bd.island.outline])); });
  for (const r of bpFrom.values()) rings.push(r.island);
  P({ k: 'fill', L: 'CHAUSSEE', rings, role: 'chaussee' });
  if (bf > 0 && Rb > 0) P({ k: 'fill', L: 'ILOT_CENTRAL', rings: [loop(tRpi), loop(tRb)], role: 'franchissable' });
  if (Rb > 0) P({ k: 'fill', L: 'ILOT_CENTRAL', rings: [loop(tRb)], role: 'ilot' });

  // Bords de chaussée et abords (caniveau, bordure, trottoir, contre-bordure / berme).
  const bands = sideBands(prj, sec), bandLayer = prj.context === 'urbain' ? 'TROTTOIR' : 'ACCOTEMENT';
  // Berme (abords) d'une branche au profil différent : largeur variable le long de sa transition.
  const varB = bds.some((bd) => Math.abs(bd.berme - sec.berme) > 1e-6);
  sectors.forEach((S, i) => {
    if (!S.length) return;
    P({ k: 'path', L: 'BORDURE', segs: S });
    const nx = bds[(i + 1) % bds.length], own = [bds[i], nx];
    const wAt = varB ? (p, nm, w) => { if (nm !== 'berme') return w; const q = own.find((bd) => bd.near(p)); return q ? q.bermeAtW(p) : w; } : null;
    sideBandPrims(S, bands, bandLayer, wAt).forEach(P);
  });

  // Voies directes : îlot de séparation, bords côté îlot, rives, axe.
  for (const r of bpFrom.values()) {
    P({ k: 'fill', L: 'ILOT_SEP', rings: [r.island], role: 'ilot' });
    P({ k: 'path', L: 'ILOT_SEP', segs: [L(r.noseJ, G.segEnd(r.left[r.left.length - 1])), ...G.revPath(r.left), L(G.segStart(r.left[0]), r.noseK)] });
    for (const rv of r.rive) rive(rv);
    for (const ds of r.dashes) P({ k: 'path', L: 'MARQUAGE', segs: ds, wm: 0.15, dash: [3, 1.33], lt: 'T3' });
    P({ k: 'path', L: 'AXE', segs: r.axis });
    P({ k: 'cross', L: 'CONSTRUCTION', p: r.C, size: 1 });
    P({ k: 'path', L: 'CONSTRUCTION', segs: [L(r.C, r.T1), L(r.C, r.T2)] });
    const mid = G.segAt(r.arc, 0.5);
    dims.radius(mid, norm(sub(r.C, mid)), `R axe ${fmt(r.Rc, 2)} · chaussée ${fmt(r.w, 2)}`, { len: 3 * TH });
  }

  bds.forEach((bd, i) => {
    const { W, Wp, a, ai, x0, xT, xEnd, isl } = bd;
    // Rives d'entrée / de sortie (raccourcies au nez de l'îlot d'une voie directe)
    rive(bd.entry.paintW);
    rive(bd.exit.paintW);
    // Îlot séparateur : enveloppe peinte (triangle de construction), zébra, îlot en saillie en retrait de la BDG.
    const I = bd.island;
    if (I) {
      if (I.outline) {
        // Îlot entier, ou ses deux parties de part et d'autre du refuge du passage piéton.
        for (const part of I.pieces || [I.outline]) {
          P({ k: 'fill', L: 'ILOT_SEP', rings: [part], role: 'ilot' });
          P({ k: 'path', L: 'ILOT_SEP', segs: I.pieces ? part : I.curb, closed: I.closed });
          if (prj.context === 'urbain' && sec.bordure > 0 && I.closed) {
            const inward = G.polyArea(G.samplePath(part, 1)) > 0 ? sec.bordure : -sec.bordure;
            const o = G.offsetPath(part, inward);
            if (o.length) P({ k: 'path', L: 'TROTTOIR', segs: o, closed: true });
          }
        }
      }
      if (sec.rive || isl.type === 'peint') {
        for (const p of I.paint) if (p.length) P({ k: 'path', L: 'MARQUAGE', segs: p, wm: 0.15 });
        if (I.hatch) P({ k: 'hatch', L: 'MARQUAGE', lines: G.hatchPolygon(I.hatch, bd.theta + Math.PI / 4, 1.0), wm: 0.12 });
      }
    }
    if (bd.cross) crossingPrims(bd.cross, W, sec, sec.pmr).forEach(P);
    // Triangle de construction
    if (isl.type !== 'aucun' && !bd.th) {
      const t1 = { x: x0, y: ai + isl.b / 2 }, t2 = { x: xT, y: ai }, t3 = { x: x0, y: ai - isl.b / 2 };
      P({ k: 'path', L: 'CONSTRUCTION', segs: Wp([L(t1, t2), L(t2, t3), L(t3, t1)]) });
    }
    if (bd.defl && !bd.defl.sCurve) {
      P({ k: 'path', L: 'CONSTRUCTION', segs: [bd.defl.arc], dash: [1.5, 1] });
      const m = G.segAt(bd.defl.arc, 0.5);
      text('CONSTRUCTION', add(m, mul(norm(sub(m, bd.defl.arc.c)), TH)), `déflexion R ≈ ${fmt(bd.defl.R, 0)} m`, ang(sub(m, bd.defl.arc.c)) + Math.PI / 2, 'center', TH * 0.7);
    }
    for (const sd of [bd.entry, bd.exit]) {
      P({ k: 'cross', L: 'CONSTRUCTION', p: sd.C, size: 0.8 });
      P({ k: 'path', L: 'CONSTRUCTION', segs: [L(sd.C, sd.Tc), L(sd.C, sd.Tl)] });
    }
    // Axe projet : alignement droit puis raccordement à l'axe saisi.
    P({ k: 'path', L: 'AXE', segs: [...Wp([L({ x: 0, y: a }, { x: xEnd, y: a })]), ...(bd.cont || [])] });
    // Raccordements de l'axe : centre et rayon cotés (rayon demandé rappelé s'il a dû être réduit).
    for (const f of bd.axisFillets) {
      const mid = G.segAt(f.arc, 0.5), toC = norm(sub(f.arc.c, mid));
      P({ k: 'cross', L: 'CONSTRUCTION', p: f.arc.c, size: 1 });
      P({ k: 'path', L: 'CONSTRUCTION', segs: [L(f.arc.c, G.segStart(f.arc)), L(f.arc.c, G.segEnd(f.arc))] });
      const lab = Math.abs(f.r - f.want) > 0.05 ? `R axe ${fmt(f.r, 1)} (${fmt(f.want, 1)} demandé)` : `R axe ${fmt(f.r, 1)}`;
      dims.radius(mid, toC, lab, { len: 3 * TH });
    }
    P({ k: 'path', L: 'LIMITE', segs: [L(bd.exit.F, bd.entry.F)] });
    // Marquage : cédez-le-passage, ligne axiale d'approche, voies multiples
    if (bd.yieldStart && bd.yieldEnd) {
      const a0 = ang(bd.yieldStart) + bd.theta, a1 = ang(bd.yieldEnd) + bd.theta;
      P({ k: 'path', L: 'MARQUAGE', segs: [A(bd.Oc, bd.Rgc + 0.25, a0, a1, true)], wm: 0.5, dash: [0.5, 0.5], lt: 'CLP' });
    }
    if (!bd.th) {
      const xs = bd.island ? xT : x0;
      const xc = Math.min(xEnd, xs + 30);
      P({ k: 'path', L: 'MARQUAGE', segs: Wp([L({ x: xs, y: bd.island ? ai : a }, { x: Math.min(xc, xs + 8), y: a }), L({ x: Math.min(xc, xs + 8), y: a }, { x: xc, y: a })]), wm: 0.15 });
      const dashed = [...(xEnd > xc + 1 ? Wp([L({ x: xc, y: a }, { x: xEnd, y: a })]) : []), ...(bd.cont || [])];
      if (dashed.length) P({ k: 'path', L: 'MARQUAGE', segs: dashed, wm: 0.15, dash: [3, 10], lt: 'T1' });
    }
    for (const [sd, nl] of [[bd.entry, Math.max(1, +prj.branches[bd.idx].nIn || 1)], [bd.exit, Math.max(1, +prj.branches[bd.idx].nOut || 1)]]) {
      for (let k = 1; k < nl; k++) {
        const s = sd.s, fr = k / nl, wl = sd.wa / nl;
        const pA = { x: xEnd, y: a + s * (bd.th + k * wl) }, pB = { x: xT, y: a + s * (bd.th + k * wl) };
        const pC = add(sd.H, mul(s > 0 ? rot90(sd.dI) : neg(rot90(sd.dI)), sd.w * fr));
        const contLane = bd.cont ? G.revPath(G.offsetPath(bd.cont, s * (bd.th + k * wl))) : [];
        P({ k: 'path', L: 'MARQUAGE', segs: [...contLane, ...Wp([L(pA, pB), L(pB, add(pC, { x: 1.5, y: 0 }))])], wm: 0.15, dash: [3, 1.33], lt: 'T3' });
      }
    }
    // Cotations de branche : largeurs le / ls entre rives, rayons Re / Rs, nom et gisement.
    for (const sd of [bd.entry, bd.exit]) {
      // Au-delà du passage piéton s'il y en a un.
      const xs = Math.max(G.clamp(sd.fil.Tl.x + 2, x0 + 2, Math.max(x0 + 2, xT - 2)), bd.cross ? bd.cross.x2 + 1.5 : -Infinity);
      const pIsl = add(sd.H, mul(sd.dI, (xs - sd.H.x) / sd.dI.x));
      const mOut = sd.s > 0 ? rot90(sd.dI) : neg(rot90(sd.dI));
      // Largeur réellement construite à cet endroit (et valeur demandée si elle diffère).
      const wr = widthAlong(pIsl, mOut, sd.curb) ?? sd.w, asked = Math.abs(wr - sd.w) > 0.05 ? ` (${fmt(sd.w, 2)} demandé)` : '';
      const [p1, p2] = sd.s > 0 ? [pIsl, add(pIsl, mul(mOut, wr))] : [add(pIsl, mul(mOut, wr)), pIsl];
      dims.aligned(W(p1), W(p2), 0, `${sd.s > 0 ? 'le' : 'ls'} = ${fmt(wr, 2)}${asked}`, { side: -1 });
      if (sd.fused) { // rayon unique : coté une fois, sur l'arc (porté par l'entrée)
        if (sd.s > 0) { const m = G.segAt(sd.fused.arcP, 0.5); dims.radius(m, norm(sub(sd.fused.C, m)), `R = ${fmt(sd.fused.R, 2)} (Re/Rs fusionnés)`); }
        continue;
      }
      const mid = G.segAt(sd.fil.arc, 0.5);
      dims.radius(W(mid), norm(sub(sd.C, W(mid))), `${sd.s > 0 ? 'Re' : 'Rs'} = ${fmt(sd.R, 2)}`);
    }
    const lab = add(bd.farAxis, mul(bd.farDir, 4 + 2 * TH));
    text('COTATION', lab, bd.name, ang(bd.farDir) + Math.PI / 2, 'center', TH * 1.6);
    text('COTATION', add(bd.farAxis, mul(bd.farDir, 4)), bd.gis, ang(bd.farDir) + Math.PI / 2, 'center', TH * 0.9);
    if (isl.type !== 'aucun' && !bd.th) {
      text('COTATION', W({ x: x0 + bd.h * 0.6, y: ai }), `îlot ${fmt(isl.b, 2)} × ${fmt(bd.h, 2)}`, bd.theta, 'center', TH * 0.6);
    } else if (bd.th) {
      text('COTATION', W({ x: xT + 8, y: a }), `TPC ${fmt(bd.th * 2, 2)}`, bd.theta, 'center', TH * 0.75);
    }
  });

  // Visibilité à gauche (SETRA, giratoires) : depuis un observateur à visObs en amont du cédez-le-passage, au milieu
  // de la voie d'entrée, le conducteur doit voir en entier le « quart gauche de l'anneau » : le secteur de la chaussée
  // annulaire (de la rive intérieure au bord extérieur) compris entre l'axe de la branche et le quart de tour en amont
  // dans le sens de giration. Le cône de visibilité réunit toutes les visées de l'observateur vers ce secteur ; il mord
  // sur la périphérie de l'îlot central, qui doit rester sans obstacle haut (SETRA : 2 m depuis la bordure).
  D.vis = [];
  if (sec.visOn) {
    const visPick = prj.section?.visBranch; // branche dont la zone est dessinée (toutes si vide)
    for (const bd of bds) {
      // Cacahuète : quart gauche évalué sur le cercle du lobe de la branche (approximation au voisinage de l'entrée).
      const O = bd.Oc, Rg = bd.Rgc, Ri = Rg - la, Rpi = Ri - sec.bdgRing;
      const inSector = (p, a0, span) => {
        const r = G.dist(p, O), s = G.ccwSweep(a0, ang(sub(p, O)));
        return r >= Ri - 1e-6 && r <= Rg + 1e-6 && (s <= span + 1e-6 || s >= G.TAU - 1e-6);
      };
      const { W, x0, xT, a, ai, hb, th } = bd, xo = x0 + sec.visObs;
      const out = cutAtX(bd.entry.curb, xo);
      if (!out || xo > bd.xEnd) continue;
      const yIn = xo >= xT ? ai + th : ai + hb + ((th - hb) * (xo - x0)) / (xT - x0);
      const yMid = (yIn + out.y) / 2, E = W({ x: xo, y: yMid }), Y0 = W({ x: x0, y: yMid });
      // Secteur visé : de l'axe de la branche (phiA) à un quart de tour en amont (phi1).
      const phiA = ang(sub(W({ x: x0, y: a }), O)), phi1 = phiA - Math.PI / 2;
      const sector = [...G.samplePath([A(O, Rg, phi1, phiA, true)], 0.5), ...G.samplePath([A(O, Ri, phiA, phi1, false)], 0.5)];
      // Cône : dans chaque direction issue de l'observateur, jusqu'au point du secteur le plus éloigné.
      const ref = ang(sub(O, E)), rel = (t) => Math.atan2(Math.sin(t - ref), Math.cos(t - ref));
      const rels = sector.map((p) => rel(ang(sub(p, E)))), lo = Math.min(...rels), hi = Math.max(...rels);
      const far = [];
      for (let k = 0, n = 180; k <= n; k++) {
        const d = G.unit(ref + lo + ((hi - lo) * k) / n);
        const ts = [...G.lineCircle(E, d, O, Rg), ...G.lineCircle(E, d, O, Ri)];
        for (const ph of [phi1, phiA]) { const h = G.lineLine(E, d, O, G.unit(ph)); if (h) ts.push(h.t); }
        const t = Math.max(-1, ...ts.filter((t) => t > 0 && inSector(add(E, mul(d, t)), phi1, Math.PI / 2)));
        if (t > 0) far.push(add(E, mul(d, t)));
      }
      if (far.length < 2) continue;
      // Profondeur du cône dans l'îlot central, mesurée depuis sa bordure (Rpi).
      const depth = Math.max(0, Rpi - Math.min(...far.map((p) => G.distToSeg(O, E, p))));
      if (!visPick || String(bd.id) === String(visPick)) {
        P({ k: 'fill', L: 'VISIBILITE', role: 'vis', rings: [closedSegs([E, ...far])] });
        P({ k: 'fill', L: 'VISIBILITE', role: 'quart', rings: [closedSegs(sector)] });
        P({ k: 'path', L: 'VISIBILITE', segs: [L(E, far[0]), L(E, far[far.length - 1])] });
        P({ k: 'path', L: 'VISIBILITE', segs: closedSegs(sector), closed: true });
        P({ k: 'cross', L: 'VISIBILITE', p: E, size: 0.8 });
        dims.aligned(Y0, E, 0, `${fmt(sec.visObs, 1)} m`, { side: -1 });
        const phiM = phiA - Math.PI / 4;
        text('VISIBILITE', G.polar(O, (Rg + Ri) / 2, phiM), `quart gauche ${bd.name}`, phiM + Math.PI / 2, 'center', TH * 0.7);
      }
      D.vis.push({ name: bd.name, obs: sec.visObs, Ri, Rg, arc: (Rg * Math.PI) / 2, sight: Math.max(...far.map((p) => G.dist(E, p))), depth });
      if (depth > 2 + 1e-6) issues.push({ lvl: 'info', bi: bd.idx, msg: `${bd.name} : le cône de visibilité à gauche entre de ${fmt(depth, 1)} m dans l'îlot central ; aucun obstacle haut sur cette bande (SETRA : 2 m minimum).` });
    }
  }

  // Cotations de l'anneau dans le plus grand secteur libre : rayons Rg, Ri (rives) et chaîne radiale
  // îlot central → bande franchissable → BDG → anneau → BDD → abords.
  let phi = Math.PI / 4;
  if (bds.length) {
    let best = -1;
    bds.forEach((bd, i) => {
      const nx = bds[(i + 1) % bds.length];
      const span = bds.length === 1 ? G.TAU : G.ccwSweep(bd.theta, nx.theta);
      if (span > best) { best = span; phi = bd.theta + span / 2; }
    });
  }
  // Cacahuète : cotes de chaque lobe dans la partie la plus dégagée de son arc libre ; chaîne radiale sur le lobe 1.
  let Oc = O;
  if (shape) {
    for (const lb of shape.lobes) {
      const sw = G.ccwSweep(lb.a[0], lb.a[1]), th = bds.filter((bd) => bd.lobe === lb.k).map((bd) => bd.theta);
      let bestPhi = lb.a[0] + sw / 2, bestD = -1;
      for (let k = 1; k < 24; k++) {
        const ph = lb.a[0] + (sw * k) / 24, dmin = Math.min(Math.PI, ...th.map((t) => Math.min(G.ccwSweep(t, ph), G.ccwSweep(ph, t))));
        if (dmin > bestD) { bestD = dmin; bestPhi = ph; }
      }
      dims.radial(lb.c, lb.R, bestPhi + 0.18, `Rg${lb.k} = ${fmt(lb.R, 2)}`);
      dims.radial(lb.c, lb.R - la, bestPhi - 0.18, `Ri${lb.k} = ${fmt(lb.R - la, 2)}`);
      P({ k: 'cross', L: 'AXE', p: lb.c, size: 1.2 });
      if (lb.k === 1) { phi = bestPhi; Oc = lb.c; }
    }
    dims.aligned(shape.C1, shape.C2, 0, `entraxe e = ${fmt(shape.e, 2)}`, { side: 1 });
    for (const W of shape.waists) {
      if (W.kind !== 'A') continue;
      const mid = G.segAt(shape.path(0)[W.s > 0 ? 1 : 3], 0.5);
      dims.radius(mid, norm(sub(W.P, mid)), `col R = ${fmt(W.Rw, 2)}`, { len: 3 * TH });
    }
  } else {
    dims.radial(O, Rg, phi + 0.18, `Rg = ${fmt(Rg, 2)}`);
    dims.radial(O, Ri, phi - 0.18, `Ri = ${fmt(Ri, 2)}`);
  }
  const radii = [], labels = [];
  const push = (r, lab) => { radii.push(r); if (lab) labels.push(lab); };
  push(bf > 0 ? Rb : Rpi);
  if (bf > 0) push(Rpi, `bf ${fmt(bf, 2)}`);
  if (sec.bdgRing > 0) push(Ri, `BDG ${fmt(sec.bdgRing, 2)}`);
  push(Rg, `la ${fmt(la, 2)}`);
  if (sec.bdd > 0) push(Rpo, `BDD ${fmt(sec.bdd, 2)}`);
  let rr = Rpo;
  for (const [nm, w] of bands) { rr += w; push(rr, `${nm} ${fmt(w, 2)}`); }
  const e = G.unit(phi);
  dims.chain(radii.map((r) => add(Oc, mul(e, r))), -2.2 * TH, labels);
  P({ k: 'cross', L: 'AXE', p: O, size: 1.5 });

  // ================= Points d'implantation =================
  const pt = (name, p, bi = null, kind = '') => points.push({ n: points.length + 1, name, p, bi, kind });
  pt(shape ? 'Centre du carrefour (milieu des lobes)' : 'Centre du giratoire', O, null, 'centre');
  if (shape) {
    for (const lb of shape.lobes) {
      pt(`Lobe ${lb.k} : centre (Rg ${fmt(lb.R, 2)})`, lb.c, null, 'centre');
      pt(`Lobe ${lb.k} : début de l'arc libre (rive Rg)`, polar(lb.c, lb.R, lb.a[0]), null, 'rive');
      pt(`Lobe ${lb.k} : fin de l'arc libre (rive Rg)`, polar(lb.c, lb.R, lb.a[1]), null, 'rive');
    }
    for (const W of shape.waists) if (W.kind === 'A') pt(`Col ${W.s > 0 ? 'gauche' : 'droit'} : centre (R ${fmt(W.Rw, 2)} à la rive Rg)`, W.P, null, 'centre');
  }
  for (const bd of bds) {
    const nm = bd.name;
    pt(`${nm} · axe à la rive de l'anneau`, bd.W({ x: bd.x0, y: bd.a }), bd.idx, 'axe');
    pt(`${nm} · axe fin d'alignement droit`, bd.W({ x: bd.xEnd, y: bd.a }), bd.idx, 'axe');
    if (bd.cont) pt(`${nm} · axe fin de projet`, bd.farAxis, bd.idx, 'axe');
    for (const [sd, lab, R] of [[bd.entry, 'entrée', 'Re'], [bd.exit, 'sortie', 'Rs']]) {
      pt(`${nm} · ${lab} : tangence rive de l'anneau (${R})`, sd.Tc, bd.idx, 'rive');
      pt(`${nm} · ${lab} : tangence rive (${R})`, sd.Tl, bd.idx, 'rive');
      pt(`${nm} · ${lab} : centre ${R} = ${fmt(sd.R, 2)}`, sd.C, bd.idx, 'centre');
      sd.ctrl.slice(1).forEach((q, k) => pt(`${nm} · ${lab} : sommet évasement ${k + 1} (rive)`, bd.W(q), bd.idx, 'rive'));
      pt(`${nm} · ${lab} : bord de chaussée fin de projet`, sd.F, bd.idx, 'bordure');
    }
    if (bd.island?.outline) {
      pt(`${nm} · îlot : tête côté entrée`, bd.island.headIn, bd.idx, 'ilot');
      pt(`${nm} · îlot : tête côté sortie`, bd.island.headOut, bd.idx, 'ilot');
      if (bd.island.tip) pt(`${nm} · îlot : pointe`, bd.island.tip, bd.idx, 'ilot');
    }
  }
  for (const r of D.bypasses) {
    const nm = `TAD ${r.from} → ${r.to}`;
    pt(`${nm} : début de courbe (axe)`, r.T1, null, 'bypass');
    pt(`${nm} : fin de courbe (axe)`, r.T2, null, 'bypass');
    pt(`${nm} : centre R = ${fmt(r.Rc, 2)} (axe)`, r.C, null, 'centre');
    pt(`${nm} : nez de l'îlot côté ${r.from}`, r.noseK, null, 'ilot');
    pt(`${nm} : nez de l'îlot côté ${r.to}`, r.noseJ, null, 'ilot');
  }

  addDevers(prj, D);
  return D;
}
