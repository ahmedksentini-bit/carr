// roundabout.js — construction géométrique du giratoire (plan d'implantation).
// Repère local d'une branche : origine au centre O de l'anneau, x le long de l'axe vers l'extérieur,
// y vers la gauche (vu depuis le centre). L'entrée est du côté +y, la sortie du côté −y
// (circulation à droite, anneau parcouru dans le sens trigonométrique).
import * as G from './geom.js';
import { islandDims } from './norms.js';
import { addDevers } from './devers.js';
import { fmt, fmtGis, upright, autoCenter, branchDirection, frame } from './common.js';
import { buildApproach, crossLine } from './approach.js';
import { buildPlan } from './plan.js';

const { add, sub, mul, dot, norm, rot90, neg, ang, polar, L, A } = G;

export { fmt, fmtGis, autoCenter };

// Point d'entrée : giratoire ou carrefour plan (T, X) selon le type du projet.
export function buildDesign(prj) {
  return prj.kind === 'T' || prj.kind === 'X' ? buildPlan(prj) : buildRoundabout(prj);
}

function buildRoundabout(prj) {
  const ring = prj.ring;
  const Rg = +ring.Rg, la = +ring.la, bf = +ring.bf || 0;
  const Ri = Rg - la, Rb = Ri - bf;
  const unit = prj.opts?.angleUnit || 'gon';
  const TH = +prj.opts?.textH || 0.8;
  const issues = [], prims = [], points = [], bds = [];
  const D = { kind: 'giratoire', ok: false, O: null, Rg, la, bf, Ri, Rb, branches: bds, prims, points, issues };

  let O = prj.center.auto ? autoCenter(prj.branches) : null;
  if (!O && prj.center.x != null) O = { x: +prj.center.x, y: +prj.center.y };
  if (!O) return D;
  D.O = O;
  if (!(Rg > 0) || !(Ri > 0)) { issues.push({ lvl: 'err', msg: 'Rayons incohérents : il faut Rg > la (Ri = Rg − la > 0).' }); return D; }
  if (Rb <= 0) issues.push({ lvl: 'err', msg: 'Bande franchissable plus large que l\'îlot central.' });
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

    // --- Axe de calcul de la branche
    const { far, Q, segDir } = branchDirection(b, O, Rg + h + 10);
    if (G.dist(far, O) < Rg + 5) { issues.push({ lvl: 'err', bi: idx, msg: `${name} : l'axe saisi doit sortir de l'anneau (> Rg + 5 m).` }); return; }
    let u, a;
    if (b.radial !== false) { u = norm(sub(Q, O)); a = 0; }
    else {
      u = dot(segDir, sub(Q, O)) < 0 ? neg(segDir) : segDir;
      a = dot(sub(Q, O), rot90(u));
      if (Math.abs(a) > Rg * 0.6) { issues.push({ lvl: 'err', bi: idx, msg: `${name} : axe trop excentré (${fmt(a)} m) — axe radial utilisé.` }); u = norm(sub(Q, O)); a = 0; }
    }
    const { theta, n, W, Ws, Wp } = frame(O, u);

    const x0 = Math.sqrt(Rg * Rg - a * a), xT = x0 + h;
    // Axe du triangle de construction (décalé vers la gauche de l'usager entrant, ACI).
    const ai = hasIsland && !th && isl.type !== 'aucun' ? a - isl.shift : a;
    const flare = Math.max(0, hb + Math.max(le, ls) + Math.abs(ai - a) - th - Math.min(wIn, wOut));
    // Longueur dessinée par défaut : jusqu'à l'extrémité de l'axe saisi, bornée à 40–80 m au-delà de l'îlot.
    let xEnd = b.length ? x0 + +b.length : Math.min(Math.max(dot(sub(far, O), u), xT + 40), xT + 80);
    xEnd = Math.max(xEnd, xT + Math.max(10, 15 * flare) + 20);

    const ap = buildApproach({ name, idx, target, a, ai, x0, xT, xEnd, hb, th, hasIsland, isl, le, ls, wIn, wOut, Re, Rs }, issues);
    if (!ap) return;
    const { en, ex } = ap;
    const island = ap.island && {
      outline: Wp(ap.island.outline), curb: Wp(ap.island.curb), closed: ap.island.closed, rive: ap.island.rive.map(Wp),
      tip: ap.island.tip && W(ap.island.tip), headIn: W(ap.island.headIn), headOut: W(ap.island.headOut),
    };

    // --- Ligne de cédez-le-passage (bande de 0,50 m le long de l'anneau)
    const yl = crossLine(en, target, 0.25), xl = crossLine(ex, target, 0.25);

    const bd = {
      idx, id: b.id, name, role: 'branche', theta, u, n, a, ai, x0, xT, xEnd, h, b: isl.b, hb, th, isl, W, Ws, Wp,
      entry: { ...en, curbW: Wp(en.curb), Tc: W(en.fil.Tc), Tl: W(en.fil.Tl), C: W(en.fil.C), F: W(en.F) },
      exit: { ...ex, curbW: Wp(ex.curb), Tc: W(ex.fil.Tc), Tl: W(ex.fil.Tl), C: W(ex.fil.C), F: W(ex.F) },
      island, yieldStart: yl?.a, yieldEnd: yl?.b, exitStart: xl?.a, exitEnd: xl?.b, gis: fmtGis(theta, unit),
    };
    bd.entry.phiTc = ang(sub(bd.entry.Tc, O));
    bd.exit.phiTc = ang(sub(bd.exit.Tc, O));
    bds.push(bd);
  });

  bds.sort((p, q) => G.normAng(p.theta) - G.normAng(q.theta));
  D.ok = true;
  D.zoomR = Rg + Math.max(Rg, ...bds.map((bd) => bd.h)) + 15;
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
  const text = (L_, p, s, rot = 0, align = 'center', h = TH) => P({ k: 'text', L: L_, p, s, rot: upright(rot), align, h });

  // Anneau : bord extérieur (arcs entre branches), bord intérieur, îlot central.
  const ringArcs = [];
  if (!bds.length) P({ k: 'circle', L: 'BORDURE', c: O, r: Rg });
  bds.forEach((bd, i) => {
    const nx = bds[(i + 1) % bds.length];
    const span = bds.length === 1 ? G.TAU : G.ccwSweep(bd.theta, nx.theta);
    const gap = G.ccwSweep(bd.entry.phiTc, nx.exit.phiTc);
    if (gap < span && gap > 1e-4) {
      const arc = A(O, Rg, bd.entry.phiTc, nx.exit.phiTc, true);
      ringArcs[i] = arc;
      P({ k: 'path', L: 'BORDURE', segs: [arc] });
    } else {
      issues.push({ lvl: 'err', msg: `${bd.name} / ${nx.name} : branches trop proches, les raccordements Re/Rs se chevauchent sur l'anneau.` });
    }
  });
  P({ k: 'circle', L: 'ILOT_CENTRAL', c: O, r: Ri });
  if (bf > 0 && Rb > 0) P({ k: 'circle', L: 'ILOT_CENTRAL', c: O, r: Rb });

  // Remplissage chaussée (règle pair-impair : trous = îlots).
  const outer = [];
  bds.forEach((bd, i) => {
    outer.push(...G.revPath(bd.exit.curbW), L(bd.exit.F, bd.entry.F), ...bd.entry.curbW);
    if (ringArcs[i]) outer.push(ringArcs[i]);
  });
  const rings = bds.length ? [outer] : [[{ t: 'C', c: O, r: Rg }]];
  rings.push([{ t: 'C', c: O, r: Ri }]);
  bds.forEach((bd) => { if (bd.island && bd.isl.type !== 'peint') rings.push(bd.island.outline); });
  P({ k: 'fill', L: 'CHAUSSEE', rings, role: 'chaussee' });
  if (bf > 0 && Rb > 0) P({ k: 'fill', L: 'ILOT_CENTRAL', rings: [[{ t: 'C', c: O, r: Ri }], [{ t: 'C', c: O, r: Rb }]], role: 'franchissable' });
  P({ k: 'fill', L: 'ILOT_CENTRAL', rings: [[{ t: 'C', c: O, r: Math.max(0, Rb) }]], role: 'ilot' });

  for (const bd of bds) {
    const { W, a, ai, x0, xT, xEnd, isl } = bd;
    // Bordures d'entrée / sortie
    P({ k: 'path', L: 'BORDURE', segs: bd.entry.curbW });
    P({ k: 'path', L: 'BORDURE', segs: bd.exit.curbW });
    P({ k: 'path', L: 'LIMITE', segs: [L(bd.exit.F, bd.entry.F)] });
    // Îlot
    if (bd.island) {
      if (isl.type === 'peint' && !bd.th) {
        P({ k: 'path', L: 'MARQUAGE', segs: bd.island.curb, closed: true, wm: 0.15 });
        const poly = G.samplePath(bd.island.outline, 0.3);
        P({ k: 'hatch', L: 'MARQUAGE', lines: G.hatchPolygon(poly, bd.theta + Math.PI / 4, 1.0), wm: 0.12 });
      } else {
        P({ k: 'fill', L: 'ILOT_SEP', rings: [bd.island.outline], role: 'ilot' });
        P({ k: 'path', L: 'ILOT_SEP', segs: bd.island.curb, closed: bd.island.closed });
        for (const rv of bd.island.rive || []) if (rv.length) P({ k: 'path', L: 'MARQUAGE', segs: rv, wm: 0.15 });
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
      text('CONSTRUCTION', G.add(m, mul(norm(sub(m, bd.defl.arc.c)), TH)), `déflexion R ≈ ${fmt(bd.defl.R, 0)} m`, ang(sub(m, bd.defl.arc.c)) + Math.PI / 2, 'center', TH * 0.7);
    }
    // Centres et rayons de raccordement
    for (const sd of [bd.entry, bd.exit]) {
      P({ k: 'cross', L: 'CONSTRUCTION', p: sd.C, size: 0.8 });
      P({ k: 'path', L: 'CONSTRUCTION', segs: [L(sd.C, sd.Tc), L(sd.C, sd.Tl)] });
    }
    // Axe projet
    P({ k: 'path', L: 'AXE', segs: [L(W({ x: 0, y: a }), W({ x: xEnd + 3, y: a }))] });
    // Marquage : cédez-le-passage, ligne axiale d'approche, voies multiples
    if (bd.yieldStart && bd.yieldEnd) {
      const a0 = ang(bd.yieldStart) + bd.theta, a1 = ang(bd.yieldEnd) + bd.theta;
      P({ k: 'path', L: 'MARQUAGE', segs: [A(O, Rg + 0.25, a0, a1, true)], wm: 0.5, dash: [0.5, 0.5], lt: 'CLP' });
    }
    if (!bd.th) {
      const xs = bd.island ? xT : x0;
      const xc = Math.min(xEnd, xs + 30);
      P({ k: 'path', L: 'MARQUAGE', segs: [L(W({ x: xs, y: bd.island ? ai : a }), W({ x: Math.min(xc, xs + 8), y: a })), L(W({ x: Math.min(xc, xs + 8), y: a }), W({ x: xc, y: a }))], wm: 0.15 });
      if (xEnd > xc + 1) P({ k: 'path', L: 'MARQUAGE', segs: [L(W({ x: xc, y: a }), W({ x: xEnd, y: a }))], wm: 0.15, dash: [3, 10], lt: 'T1' });
    }
    for (const [sd, nl] of [[bd.entry, Math.max(1, +prj.branches[bd.idx].nIn || 1)], [bd.exit, Math.max(1, +prj.branches[bd.idx].nOut || 1)]]) {
      for (let k = 1; k < nl; k++) {
        const s = sd.s, fr = k / nl, wl = sd.wa / nl;
        const pA = W({ x: xEnd, y: a + s * (bd.th + k * wl) }), pB = W({ x: xT, y: a + s * (bd.th + k * wl) });
        const pC = W(add(sd.H, mul(s > 0 ? rot90(sd.dI) : neg(rot90(sd.dI)), sd.w * fr)));
        P({ k: 'path', L: 'MARQUAGE', segs: [L(pA, pB), L(pB, add(pC, mul(bd.u, 1.5)))], wm: 0.15, dash: [3, 1.33], lt: 'T3' });
      }
    }
    // Cotations de branche
    const lbl = (sd, nm, val) => {
      const mid = G.segAt(sd.fil.arc, 0.5), C = sd.fil.C;
      const toC = norm(sub(C, mid));
      const p = W(add(mid, mul(toC, 1.6 * TH)));
      text('COTATION', p, `${nm} = ${fmt(val, 2)}`, ang(rot90(toC)) + bd.theta);
    };
    lbl(bd.entry, 'Re', bd.entry.R);
    lbl(bd.exit, 'Rs', bd.exit.R);
    const wLbl = (start, end, nm, val) => {
      if (!start || !end) return;
      const m = G.lerp(start, end, 0.5), p = W(mul(norm(m), Rg + 1.2 + TH));
      text('COTATION', p, `${nm} = ${fmt(val, 2)}`, bd.theta + Math.PI / 2);
    };
    wLbl(bd.yieldStart, bd.yieldEnd, 'le', bd.entry.w);
    wLbl(bd.exitStart, bd.exitEnd, 'ls', bd.exit.w);
    const tip = W({ x: xEnd + 4 + 2 * TH, y: a });
    text('COTATION', tip, bd.name, bd.theta + Math.PI / 2, 'center', TH * 1.6);
    text('COTATION', W({ x: xEnd + 4, y: a }), bd.gis, bd.theta + Math.PI / 2, 'center', TH * 0.9);
    if (isl.type !== 'aucun' && !bd.th) {
      text('COTATION', W({ x: x0 + bd.h * 0.55, y: a }), `îlot ${fmt(isl.b, 2)} × ${fmt(bd.h, 2)}`, bd.theta, 'center', TH * 0.75);
    } else if (bd.th) {
      text('COTATION', W({ x: xT + 8, y: a }), `TPC ${fmt(bd.th * 2, 2)}`, bd.theta, 'center', TH * 0.75);
    }
  }

  // Cotation des rayons de l'anneau dans le plus grand secteur libre.
  let phi = Math.PI / 4;
  if (bds.length) {
    let best = -1;
    bds.forEach((bd, i) => {
      const nx = bds[(i + 1) % bds.length];
      const span = bds.length === 1 ? G.TAU : G.ccwSweep(bd.theta, nx.theta);
      if (span > best) { best = span; phi = bd.theta + span / 2; }
    });
  }
  const dimR = (r, ph, label) => {
    const e = polar(O, r, ph);
    P({ k: 'path', L: 'COTATION', segs: [L(O, e)], arrow: true });
    text('COTATION', polar(O, r * 0.55, ph + (0.9 * TH) / (r * 0.55)), `${label} = ${fmt(r, 2)}`, ph);
  };
  dimR(Rg, phi, 'Rg');
  dimR(Ri, phi - 0.35, 'Ri');
  if (bf > 0 && Rb > 0) text('COTATION', polar(O, (Ri + Rb) / 2, phi + 0.5), `bf = ${fmt(bf, 2)}`, phi + 0.5 + Math.PI / 2, 'center', TH * 0.75);
  text('COTATION', polar(O, (Rg + Ri) / 2, phi + 0.35), `la = ${fmt(la, 2)}`, phi + 0.35 + Math.PI / 2);
  P({ k: 'cross', L: 'AXE', p: O, size: 1.5 });

  // ================= Points d'implantation =================
  const pt = (name, p, bi = null, kind = '') => points.push({ n: points.length + 1, name, p, bi, kind });
  pt('Centre du giratoire', O, null, 'centre');
  for (const bd of bds) {
    const nm = bd.name;
    pt(`${nm} · axe au bord de l'anneau`, bd.W({ x: bd.x0, y: bd.a }), bd.idx, 'axe');
    pt(`${nm} · axe fin de projet`, bd.W({ x: bd.xEnd, y: bd.a }), bd.idx, 'axe');
    for (const [sd, lab, R] of [[bd.entry, 'entrée', 'Re'], [bd.exit, 'sortie', 'Rs']]) {
      pt(`${nm} · ${lab} : tangence anneau (${R})`, sd.Tc, bd.idx, 'bordure');
      pt(`${nm} · ${lab} : tangence bordure (${R})`, sd.Tl, bd.idx, 'bordure');
      pt(`${nm} · ${lab} : centre ${R} = ${fmt(sd.R, 2)}`, sd.C, bd.idx, 'centre');
      sd.ctrl.slice(1).forEach((q, k) => pt(`${nm} · ${lab} : sommet évasement ${k + 1}`, bd.W(q), bd.idx, 'bordure'));
      pt(`${nm} · ${lab} : bordure fin de projet`, sd.F, bd.idx, 'bordure');
    }
    if (bd.island) {
      pt(`${nm} · îlot : tête côté entrée`, bd.island.headIn, bd.idx, 'ilot');
      pt(`${nm} · îlot : tête côté sortie`, bd.island.headOut, bd.idx, 'ilot');
      if (bd.island.tip) pt(`${nm} · îlot : pointe`, bd.island.tip, bd.idx, 'ilot');
    }
  }

  addDevers(prj, D);
  return D;
}
