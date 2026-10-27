// roundabout.js — construction géométrique du giratoire (plan d'implantation).
// Repère local d'une branche : origine au centre O de l'anneau, x le long de l'axe vers l'extérieur,
// y vers la gauche (vu depuis le centre). L'entrée est du côté +y, la sortie du côté −y
// (circulation à droite, anneau parcouru dans le sens trigonométrique).
// Rg, Ri, le, ls et le triangle de l'îlot sont mesurés aux rives peintes ; les bords de chaussée sont à la BDD
// (extérieur) ou à la BDG (côté îlot central et îlots séparateurs) de ces rives.
import * as G from './geom.js';
import { islandDims, sectionParams, TAD } from './norms.js';
import { addDevers } from './devers.js';
import { fmt, fmtGis, upright, autoCenter, branchDirection, frame, nearFar, polylineAfter } from './common.js';
import { buildApproach, crossLine } from './approach.js';
import { buildPlan } from './plan.js';
import { buildBypass } from './bypass.js';
import { makeDims } from './dims.js';

const { add, sub, mul, dot, norm, rot90, neg, ang, polar, L, A } = G;
const num = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);

export { fmt, fmtGis, autoCenter };

// Point d'entrée : giratoire ou carrefour plan (T, X) selon le type du projet.
export function buildDesign(prj) {
  return prj.kind === 'T' || prj.kind === 'X' ? buildPlan(prj) : buildRoundabout(prj);
}

// Largeurs des abords au-delà du bord de chaussée : [libellé, largeur] (urbain : caniveau, bordure, trottoir,
// contre-bordure ; interurbain : berme).
export function sideBands(prj, sec = sectionParams(prj)) {
  const list = prj.context === 'urbain'
    ? [['caniveau', sec.caniveau], ['bordure', sec.bordure], ['trottoir', sec.trottoir], ['contre-bordure', sec.cBordure]]
    : [['berme', sec.berme]];
  return list.filter(([, w]) => w > 0);
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
  const target = { kind: 'circle', R: Rg };

  prj.branches.forEach((b, idx) => {
    const name = b.name || `B${idx + 1}`;
    if (!b.axis || b.axis.length < 2) return;
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

    // --- Axe de la branche : alignement droit dirigé vers le centre sur la longueur utile (îlot, évasement,
    // marge, voie directe éventuelle), puis raccordement de rayon sec.axeR à l'axe saisi, qu'il suit ensuite.
    const shiftEst = hasIsland && !th && isl.type !== 'aucun' ? isl.shift : 0;
    const flare = Math.max(0, hb + Math.max(le, ls) + shiftEst - th - Math.min(wIn, wOut));
    const Lmin = Math.max(Rg + h + Math.max(10, 15 * flare) + 20, ext[idx] || 0);
    let u, a = 0, cont = null;
    const axeR = +b.axeR > 0 ? +b.axeR : sec.axeR;
    if (b.radial !== false) {
      let pa = polylineAfter(pl, O, Lmin + 15);
      if (pa) {
        const defl = Math.acos(G.clamp(dot(norm(sub(pa.J, O)), pa.dir), -1, 1));
        pa = polylineAfter(pl, O, Lmin + axeR * Math.tan(defl / 2) + 2) || pa;
        u = norm(sub(pa.J, O));
        const pts = [add(O, mul(u, Lmin)), pa.J, ...pa.rest.filter((p) => G.dist(p, pa.J) > 0.5)];
        cont = G.roundPolyline(pts, pts.map((_, i) => (i > 0 && i < pts.length - 1 ? axeR : 0)));
      } else u = norm(sub(far, O));
    } else {
      const { Q, segDir } = branchDirection(b, O, Rg + h + 10);
      u = dot(segDir, sub(Q, O)) < 0 ? neg(segDir) : segDir;
      a = dot(sub(Q, O), rot90(u));
      if (Math.abs(a) > Rg * 0.6) { issues.push({ lvl: 'err', bi: idx, msg: `${name} : axe trop excentré (${fmt(a)} m) — axe radial utilisé.` }); u = norm(sub(Q, O)); a = 0; }
    }
    const { theta, n, W, Ws, Wp } = frame(O, u);
    const x0 = Math.sqrt(Rg * Rg - a * a), xT = x0 + h;
    // Axe du triangle de construction (décalé vers la gauche de l'usager entrant, ACI).
    const ai = hasIsland && !th && isl.type !== 'aucun' ? a - isl.shift : a;
    let xEnd;
    if (cont) {
      xEnd = Lmin;
      if (b.length) cont = G.pathHead(cont, Math.max(0, +b.length - (Lmin - x0)));
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
    en.edge = G.offsetPath(en.curb, -sec.bdd);
    ex.edge = G.offsetPath(ex.curb, sec.bdd);
    const full = (contPath, local) => [...G.revPath(contPath), ...Wp(local)];
    const side = (sd, s, wa) => {
      const paintW = full(off(s * (th + wa)), sd.curb), edgeW = full(off(s * (th + wa + sec.bdd)), sd.edge);
      return {
        ...sd, paintW, edgeW, edgeCont: off(s * (th + wa + sec.bdd)), curbW: paintW,
        F: G.segStart(edgeW[0]), Fpaint: G.segStart(paintW[0]),
        Tc: W(sd.fil.Tc), Tl: W(sd.fil.Tl), C: W(sd.fil.C),
      };
    };
    let island = null;
    if (ap.island) {
      const I = ap.island;
      island = {
        outline: I.outline && Wp(I.outline), curb: I.curb && Wp(I.curb), closed: I.closed, paint: I.paint.map(Wp),
        hatch: I.hatch && I.hatch.map((poly) => poly.map(W)), tip: I.tip && W(I.tip), headIn: W(I.headIn), headOut: W(I.headOut),
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
      idx, id: b.id, name, role: 'branche', theta, u, n, a, ai, x0, xT, xEnd, h, b: isl.b, hb, th, isl, W, Ws, Wp, cont,
      entry: side(en, 1, wIn), exit: side(ex, -1, wOut),
      island, yieldStart: yl?.a, yieldEnd: yl?.b, exitStart: xl?.a, exitEnd: xl?.b, gis: fmtGis(theta, unit),
      farAxis: cont ? G.segEnd(cont[cont.length - 1]) : W({ x: xEnd, y: a }),
      farDir: cont ? norm(sub(G.segEnd(cont[cont.length - 1]), G.segAt(cont[cont.length - 1], 0.98))) : u,
    };
    bd.entry.phiTc = ang(sub(bd.entry.Tc, O));
    bd.exit.phiTc = ang(sub(bd.exit.Tc, O));
    bds.push(bd);
  });

  bds.sort((p, q) => G.normAng(p.theta) - G.normAng(q.theta));
  D.ok = true;
  D.zoomR = Rpo + Math.max(Rg, ...bds.map((bd) => bd.h)) + 15;
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
    const phi1 = ang(sub(P1, O)), phi3 = ang(sub(P3, O));
    const sw = G.ccwSweep(phi1, phi3);
    if (sw > 1.25 * Math.PI || sw < 0.2) continue;
    const P2 = polar(O, Ri + 1.5, phi1 + sw / 2);
    const cc = G.circumcircle(P1, P2, P3);
    if (!cc) continue;
    const ccw = G.cross(sub(P2, P1), sub(P3, P2)) > 0;
    bd.defl = { R: cc.r, to: to.name, arc: A(cc.c, cc.r, ang(sub(P1, cc.c)), ang(sub(P3, cc.c)), ccw), pts: [P1, P2, P3] };
  }

  // ================= Primitives de dessin =================
  const P = (o) => prims.push(o);
  const text = (lay, p, s, rot = 0, align = 'center', h = TH) => P({ k: 'text', L: lay, p, s, rot: upright(rot), align, h });
  const dims = makeDims(P, TH);
  const rive = (segs, opt = {}) => { if (sec.rive && segs.length) P({ k: 'path', L: 'MARQUAGE', segs, wm: 0.15, ...opt }); };

  // Anneau : rives peintes (Rg entre les branches, Ri) et bords de chaussée (Rg + BDD, Ri − BDG).
  const ringEdge = [];
  if (!bds.length) {
    P({ k: 'circle', L: 'BORDURE', c: O, r: Rpo });
    if (sec.rive) P({ k: 'circle', L: 'MARQUAGE', c: O, r: Rg, wm: 0.15 });
  }
  bds.forEach((bd, i) => {
    const nx = bds[(i + 1) % bds.length];
    const span = bds.length === 1 ? G.TAU : G.ccwSweep(bd.theta, nx.theta);
    const gap = G.ccwSweep(bd.entry.phiTc, nx.exit.phiTc);
    if (gap < span && gap > 1e-4) {
      ringEdge[i] = A(O, Rpo, bd.entry.phiTc, nx.exit.phiTc, true);
      rive([A(O, Rg, bd.entry.phiTc, nx.exit.phiTc, true)]);
    } else {
      issues.push({ lvl: 'err', msg: `${bd.name} / ${nx.name} : branches trop proches, les raccordements Re/Rs se chevauchent sur l'anneau.` });
    }
  });
  if (sec.rive) P({ k: 'circle', L: 'MARQUAGE', c: O, r: Ri, wm: 0.15 });
  P({ k: 'circle', L: 'BORDURE', c: O, r: Rpi });
  if (bf > 0 && Rb > 0) P({ k: 'circle', L: 'ILOT_CENTRAL', c: O, r: Rb });

  // Voies directes de tourne-à-droite (case « TAD ») : de la branche i à la suivante.
  const bpFrom = new Map(), bpTo = new Set();
  let need = null;
  bds.forEach((bd, i) => {
    if (!prj.traffic?.tad?.[bd.id] || bds.length < 2) return;
    const nx = bds[(i + 1) % bds.length], br = prj.branches[bd.idx], T0 = TAD[prj.context];
    const r = buildBypass(D, bd, nx, ringEdge[i], {
      R: num(br.tadR, T0.R), w: num(br.tadW, T0.w), bdg: sec.bdgBr, bdd: sec.bdd, bddBr: sec.bdd, urbain: prj.context === 'urbain',
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
    return [...bd.entry.edgeW, ...(ringEdge[i] ? [ringEdge[i]] : []), ...G.revPath(nx.exit.edgeW)];
  });

  // Remplissage chaussée (règle pair-impair : trous = îlots).
  const outer = [];
  bds.forEach((bd, i) => outer.push(L(bd.exit.F, bd.entry.F), ...sectors[i]));
  const rings = bds.length ? [outer] : [[{ t: 'C', c: O, r: Rpo }]];
  rings.push([{ t: 'C', c: O, r: Rpi }]);
  bds.forEach((bd) => { if (bd.island?.outline) rings.push(bd.island.outline); });
  for (const r of bpFrom.values()) rings.push(r.island);
  P({ k: 'fill', L: 'CHAUSSEE', rings, role: 'chaussee' });
  if (bf > 0 && Rb > 0) P({ k: 'fill', L: 'ILOT_CENTRAL', rings: [[{ t: 'C', c: O, r: Rpi }], [{ t: 'C', c: O, r: Rb }]], role: 'franchissable' });
  P({ k: 'fill', L: 'ILOT_CENTRAL', rings: [[{ t: 'C', c: O, r: Math.max(0, Rb) }]], role: 'ilot' });

  // Bords de chaussée et abords (caniveau, bordure, trottoir, contre-bordure / berme).
  const bands = sideBands(prj, sec), bandLayer = prj.context === 'urbain' ? 'TROTTOIR' : 'ACCOTEMENT';
  sectors.forEach((S) => {
    if (!S.length) return;
    P({ k: 'path', L: 'BORDURE', segs: S });
    let d = 0;
    for (const [, w] of bands) {
      d += w;
      const o = G.offsetPath(S, -d);
      if (o.length) P({ k: 'path', L: bandLayer, segs: o });
    }
    if (d > 0) {
      const o = G.offsetPath(S, -d);
      if (o.length) P({ k: 'path', L: 'LIMITE', segs: [L(G.segStart(S[0]), G.segStart(o[0])), L(G.segEnd(S[S.length - 1]), G.segEnd(o[o.length - 1]))] });
    }
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
    const { W, a, ai, x0, xT, xEnd, isl } = bd;
    // Rives d'entrée / de sortie (raccourcies au nez de l'îlot d'une voie directe)
    rive(bd.entry.paintW);
    rive(bd.exit.paintW);
    // Îlot séparateur : enveloppe peinte (triangle de construction), zébra, îlot en saillie en retrait de la BDG.
    const I = bd.island;
    if (I) {
      if (I.outline) {
        P({ k: 'fill', L: 'ILOT_SEP', rings: [I.outline], role: 'ilot' });
        P({ k: 'path', L: 'ILOT_SEP', segs: I.curb, closed: I.closed });
        if (prj.context === 'urbain' && sec.bordure > 0 && I.closed) {
          const inward = G.polyArea(G.samplePath(I.outline, 1)) > 0 ? sec.bordure : -sec.bordure;
          const o = G.offsetPath(I.outline, inward);
          if (o.length) P({ k: 'path', L: 'TROTTOIR', segs: o, closed: true });
        }
      }
      if (sec.rive || isl.type === 'peint') {
        for (const p of I.paint) if (p.length) P({ k: 'path', L: 'MARQUAGE', segs: p, wm: 0.15 });
        if (I.hatch) P({ k: 'hatch', L: 'MARQUAGE', lines: G.hatchPolygon(I.hatch, bd.theta + Math.PI / 4, 1.0), wm: 0.12 });
      }
    }
    // Triangle de construction
    if (isl.type !== 'aucun' && !bd.th) {
      const t1 = W({ x: x0, y: ai + isl.b / 2 }), t2 = W({ x: xT, y: ai }), t3 = W({ x: x0, y: ai - isl.b / 2 });
      P({ k: 'path', L: 'CONSTRUCTION', segs: [L(t1, t2), L(t2, t3), L(t3, t1)] });
    }
    if (bd.defl) {
      P({ k: 'path', L: 'CONSTRUCTION', segs: [bd.defl.arc], dash: [1.5, 1] });
      const m = G.segAt(bd.defl.arc, 0.5);
      text('CONSTRUCTION', add(m, mul(norm(sub(m, bd.defl.arc.c)), TH)), `déflexion R ≈ ${fmt(bd.defl.R, 0)} m`, ang(sub(m, bd.defl.arc.c)) + Math.PI / 2, 'center', TH * 0.7);
    }
    for (const sd of [bd.entry, bd.exit]) {
      P({ k: 'cross', L: 'CONSTRUCTION', p: sd.C, size: 0.8 });
      P({ k: 'path', L: 'CONSTRUCTION', segs: [L(sd.C, sd.Tc), L(sd.C, sd.Tl)] });
    }
    // Axe projet : alignement droit puis raccordement à l'axe saisi.
    P({ k: 'path', L: 'AXE', segs: [L(W({ x: 0, y: a }), W({ x: xEnd, y: a })), ...(bd.cont || [])] });
    P({ k: 'path', L: 'LIMITE', segs: [L(bd.exit.F, bd.entry.F)] });
    // Marquage : cédez-le-passage, ligne axiale d'approche, voies multiples
    if (bd.yieldStart && bd.yieldEnd) {
      const a0 = ang(bd.yieldStart) + bd.theta, a1 = ang(bd.yieldEnd) + bd.theta;
      P({ k: 'path', L: 'MARQUAGE', segs: [A(O, Rg + 0.25, a0, a1, true)], wm: 0.5, dash: [0.5, 0.5], lt: 'CLP' });
    }
    if (!bd.th) {
      const xs = bd.island ? xT : x0;
      const xc = Math.min(xEnd, xs + 30);
      P({ k: 'path', L: 'MARQUAGE', segs: [L(W({ x: xs, y: bd.island ? ai : a }), W({ x: Math.min(xc, xs + 8), y: a })), L(W({ x: Math.min(xc, xs + 8), y: a }), W({ x: xc, y: a }))], wm: 0.15 });
      const dashed = [...(xEnd > xc + 1 ? [L(W({ x: xc, y: a }), W({ x: xEnd, y: a }))] : []), ...(bd.cont || [])];
      if (dashed.length) P({ k: 'path', L: 'MARQUAGE', segs: dashed, wm: 0.15, dash: [3, 10], lt: 'T1' });
    }
    for (const [sd, nl] of [[bd.entry, Math.max(1, +prj.branches[bd.idx].nIn || 1)], [bd.exit, Math.max(1, +prj.branches[bd.idx].nOut || 1)]]) {
      for (let k = 1; k < nl; k++) {
        const s = sd.s, fr = k / nl, wl = sd.wa / nl;
        const pA = W({ x: xEnd, y: a + s * (bd.th + k * wl) }), pB = W({ x: xT, y: a + s * (bd.th + k * wl) });
        const pC = W(add(sd.H, mul(s > 0 ? rot90(sd.dI) : neg(rot90(sd.dI)), sd.w * fr)));
        const contLane = bd.cont ? G.revPath(G.offsetPath(bd.cont, s * (bd.th + k * wl))) : [];
        P({ k: 'path', L: 'MARQUAGE', segs: [...contLane, L(pA, pB), L(pB, add(pC, mul(bd.u, 1.5)))], wm: 0.15, dash: [3, 1.33], lt: 'T3' });
      }
    }
    // Cotations de branche : largeurs le / ls entre rives, rayons Re / Rs, nom et gisement.
    for (const sd of [bd.entry, bd.exit]) {
      const xs = G.clamp(sd.fil.Tl.x + 2, x0 + 2, Math.max(x0 + 2, xT - 2));
      const pIsl = add(sd.H, mul(sd.dI, (xs - sd.H.x) / sd.dI.x));
      const mOut = sd.s > 0 ? rot90(sd.dI) : neg(rot90(sd.dI));
      const [p1, p2] = sd.s > 0 ? [pIsl, add(pIsl, mul(mOut, sd.w))] : [add(pIsl, mul(mOut, sd.w)), pIsl];
      dims.aligned(W(p1), W(p2), 0, `${sd.s > 0 ? 'le' : 'ls'} = ${fmt(sd.w, 2)}`, { side: -1 });
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
  dims.radial(O, Rg, phi + 0.18, `Rg = ${fmt(Rg, 2)}`);
  dims.radial(O, Ri, phi - 0.18, `Ri = ${fmt(Ri, 2)}`);
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
  dims.chain(radii.map((r) => add(O, mul(e, r))), -2.2 * TH, labels);
  P({ k: 'cross', L: 'AXE', p: O, size: 1.5 });

  // ================= Points d'implantation =================
  const pt = (name, p, bi = null, kind = '') => points.push({ n: points.length + 1, name, p, bi, kind });
  pt('Centre du giratoire', O, null, 'centre');
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
