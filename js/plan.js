// plan.js — carrefours plans en T (3 branches) et en X / croix (4 branches), d'après l'ACI.
// Repère de la route principale : origine au centre O, X de la branche A vers la branche B, Y à gauche.
// La route principale garde son profil ; ses bords sont déportés symétriquement (1/15) pour loger la voie de
// tourne-à-gauche (TAG) et l'îlot central. Les branches secondaires sont construites comme les branches d'un
// giratoire (approach.js), la cible étant le bord de la chaussée principale.
import * as G from './geom.js';
import { islandDims, planParams, secondaryAuto, sectionParams, sideBands } from './norms.js';
import { addDeversPlan } from './devers.js';
import { fmt, fmtGis, upright, autoCenter, branchDirection, frame, sideBandPrims } from './common.js';
import { buildApproach, crossLine, targetX0 } from './approach.js';
import { makeDims } from './dims.js';
import { crossing, crossingPrims, cutAtX, polyOf, closedSegs } from './crossing.js';

const { add, sub, mul, dot, norm, rot90, neg, ang, L } = G;
const pick = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);

// Découpe une polyligne fonction de X (points triés) en retirant les intervalles `gaps`.
function cutPolyline(pts, gaps) {
  const yAt = (X) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const p = pts[i], q = pts[i + 1];
      if (X >= p.x - 1e-9 && X <= q.x + 1e-9) return q.x - p.x > 1e-12 ? p.y + ((X - p.x) / (q.x - p.x)) * (q.y - p.y) : p.y;
    }
    return pts[X < pts[0].x ? 0 : pts.length - 1].y;
  };
  let ivs = [[pts[0].x, pts[pts.length - 1].x]];
  for (const [g0, g1] of gaps) {
    ivs = ivs.flatMap(([p, q]) => (g1 <= p || g0 >= q ? [[p, q]] : [[p, g0], [g1, q]].filter(([u, v]) => v - u > 1e-6)));
  }
  return ivs.map(([p, q]) => [{ x: p, y: yAt(p) }, ...pts.filter((t) => t.x > p + 1e-9 && t.x < q - 1e-9), { x: q, y: yAt(q) }]);
}

// Polygone décalé vers l'intérieur de d (angles vifs), ou null s'il dégénère.
function insetPolygon(poly, d) {
  const n = poly.length, s = G.polyArea(poly) > 0 ? 1 : -1;
  const lines = poly.map((p, i) => { const dir = norm(sub(poly[(i + 1) % n], p)); return { p: add(p, mul(rot90(dir), s * d)), dir }; });
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i - 1 + n) % n], b = lines[i], h = G.lineLine(a.p, a.dir, b.p, b.dir);
    if (!h) return null;
    out.push(h.p);
  }
  for (let i = 0; i < n; i++) if (dot(sub(out[(i + 1) % n], out[i]), lines[i].dir) <= 0) return null;
  return out;
}

// Oriente un anneau de remplissage : extérieur dans le sens trigonométrique, trou dans le sens horaire.
function orient(ring, hole) {
  const a = G.polyArea(G.samplePath(ring, 1));
  return (hole ? a > 0 : a < 0) ? G.revPath(ring) : ring;
}

const closedPath = (pts) => pts.map((p, i) => L(p, pts[(i + 1) % pts.length]));

export function buildPlan(prj) {
  const kind = prj.kind, P = planParams(prj), sec = sectionParams(prj);
  const unit = prj.opts?.angleUnit || 'gon';
  const TH = +prj.opts?.textH || 0.8;
  const issues = [], prims = [], points = [], bds = [];
  const D = { kind, ok: false, O: null, branches: bds, prims, points, issues, plan: P, vis: [] };

  let O = prj.center.auto ? autoCenter(prj.branches) : null;
  if (!O && prj.center.x != null) O = { x: +prj.center.x, y: +prj.center.y };
  if (!O) return D;
  D.O = O;

  // --- Directions des branches et route principale
  const list = [];
  prj.branches.forEach((b, idx) => {
    if (!b.axis || b.axis.length < 2) return;
    const { far, Q } = branchDirection(b, O, 40);
    if (G.dist(far, O) < 10) { issues.push({ lvl: 'err', bi: idx, msg: `${b.name} : axe trop court (il doit s'éloigner d'au moins 10 m du centre).` }); return; }
    list.push({ b, idx, u: norm(sub(Q, O)), far });
  });
  const need = kind === 'T' ? 3 : 4;
  if (list.length !== need) issues.push({ lvl: list.length < need ? 'warn' : 'err', msg: `Carrefour en ${kind} : ${need} branches attendues, ${list.length} dessinée(s).` });
  if (list.length < 2) return D;

  let A0 = list.find((q) => q.b.id === P.main[0]), B0 = list.find((q) => q.b.id === P.main[1]);
  if (!A0 || !B0 || A0 === B0) {
    let best = Infinity;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const c = dot(list[i].u, list[j].u);
      if (c < best) { best = c; A0 = list[i]; B0 = list[j]; }
    }
  }
  const uM = norm(sub(B0.u, A0.u)), Ym = rot90(uM);
  const toW = (X, Y) => ({ x: O.x + uM.x * X + Ym.x * Y, y: O.y + uM.y * X + Ym.y * Y });
  const toM = (Pw) => { const q = sub(Pw, O); return { x: dot(q, uM), y: dot(q, Ym) }; };
  const dev = Math.acos(G.clamp(-dot(A0.u, B0.u), -1, 1));
  if (dev > (15 * Math.PI) / 180) issues.push({ lvl: 'warn', msg: `Route principale ${A0.b.name}–${B0.b.name} non rectiligne (brisure de ${fmt((dev * 200) / Math.PI, 1)} gr) : elle est dessinée en ligne droite.` });
  D.main = { a: A0.idx, b: B0.idx, u: uM, Y: Ym, toW, toM };

  const secs = list.filter((q) => q !== A0 && q !== B0).map((q) => {
    const a = secondaryAuto(prj, q.b);
    return { ...q, sY: Math.sign(dot(q.u, Ym)) || 1, auto: a, le: pick(q.b.le, a.le), ls: pick(q.b.ls, a.ls), Re: pick(q.b.Re, a.Re), Rs: pick(q.b.Rs, a.Rs) };
  });
  if (kind === 'X' && secs.length === 2 && secs[0].sY === secs[1].sY) issues.push({ lvl: 'warn', msg: 'Les deux branches secondaires sont du même côté de la route principale : ce n\'est pas un carrefour en croix.' });

  // --- Profil en travers de la route principale et zones de tourne-à-gauche
  const half = P.nLanes * P.wLane, c = P.c, a = P.tag.island;
  let Lm = 6;
  for (const s of secs) {
    const sinp = Math.max(0.3, Math.abs(dot(s.u, Ym))), cotp = Math.sqrt(1 - sinp * sinp) / sinp;
    Lm = Math.max(Lm, (islandDims(prj, s.b).b / 2 + Math.max(s.le, s.ls) + 1) / sinp + Math.max(s.Re, s.Rs) * (1 + cotp) + 2);
  }
  const tagA = P.tag.on && secs.some((s) => s.sY > 0); // sens A→B : tourne à gauche vers +Y, voie côté A
  const tagB = P.tag.on && secs.some((s) => s.sY < 0); // sens B→A : tourne à gauche vers −Y, voie côté B
  const widened = tagA || tagB;
  const { storage: Ls, sifflet: Lsif, align: Lal, deport: Ldep, presig: Lpre } = P.tag;
  const fullLen = (hasTag) => (!widened ? 0 : hasTag ? Lm + Ls + Lsif + Lal : Lm + Lal);
  const lenA = fullLen(tagA), lenB = fullLen(tagB);
  const hw = widened ? half + c / 2 : half;
  const lenEnd = (q, len) => {
    const reach = widened ? len + Ldep + Lpre + 15 : Lm + 30;
    if (q.b.length) return Math.max(reach, Lm + +q.b.length);
    return G.clamp(dot(sub(q.far, O), q.u), reach, reach + 120);
  };
  const LA = lenEnd(A0, lenA), LB = lenEnd(B0, lenB);
  const edgePts = (sg) => (widened
    ? [{ x: -LA, y: sg * half }, { x: -(lenA + Ldep), y: sg * half }, { x: -lenA, y: sg * hw }, { x: lenB, y: sg * hw }, { x: lenB + Ldep, y: sg * half }, { x: LB, y: sg * half }]
    : [{ x: -LA, y: sg * half }, { x: LB, y: sg * half }]);
  D.plan = { ...P, half, hw, c, Lm, lenA, lenB, LA, LB, tagA, tagB, widened };

  // --- Branches secondaires
  const gaps = { 1: [], [-1]: [] };
  for (const s of secs) {
    const b = s.b, idx = s.idx, name = b.name;
    const isl = islandDims(prj, b);
    const hasIsland = isl.type !== 'aucun';
    const hb = hasIsland ? isl.b / 2 : 0, h = isl.h;
    const nIn = Math.max(1, +b.nIn || 1), nOut = Math.max(1, +b.nOut || 1), wl = +b.wLane;
    const wIn = nIn * wl, wOut = nOut * wl, { le, ls, Re, Rs } = s;
    const fr = frame(O, s.u);
    const target = { kind: 'line', p: fr.toL(toW(0, s.sY * hw)), d: { x: dot(uM, s.u), y: dot(uM, fr.n) } };
    const x0 = targetX0(target, 0);
    if (!(x0 > 0)) { issues.push({ lvl: 'err', bi: idx, msg: `${name} : branche parallèle à la route principale.` }); continue; }
    const xT = x0 + h;
    const flare = Math.max(0, hb + Math.max(le, ls) - Math.min(wIn, wOut));
    let xEnd = b.length ? x0 + +b.length : Math.min(Math.max(dot(sub(s.far, O), s.u), xT + 40), xT + 80);
    xEnd = Math.max(xEnd, xT + Math.max(10, 15 * flare) + 20);
    const ap = buildApproach({
      name, idx, target, a: 0, ai: 0, x0, xT, xEnd, hb, th: 0, hasIsland, isl, le, ls, wIn, wOut, Re, Rs,
      labels: { en: 'de bordure côté entrée', ex: 'de bordure côté sortie' },
      flareLvl: 'info', // avec Rs = 4l, l'arc commence normalement en amont de l'îlot
    }, issues);
    if (!ap) continue;
    const { W, Wp } = fr;
    const { en, ex } = ap;
    // Passage piéton à ppRecul du bord de la principale, îlot coupé en refuge.
    let cross = null;
    if (sec.pp) {
      const xc = x0 + sec.ppRecul + sec.ppW / 2, hi = cutAtX(en.curb, xc), lo = cutAtX(ex.curb, xc), I = ap.island;
      if (hi && lo && xc + sec.ppW / 2 < xEnd) cross = crossing(xc, sec.ppW, lo, hi, { islands: I?.outline ? [polyOf(I.outline)] : [], painted: I?.hatch || [] });
      else issues.push({ lvl: 'info', bi: idx, msg: `${name} : passage piéton non dessiné (branche trop courte).` });
    }
    const island = ap.island && {
      outline: ap.island.outline && Wp(ap.island.outline), curb: ap.island.curb && Wp(ap.island.curb), closed: ap.island.closed,
      paint: ap.island.paint.map(Wp), hatch: ap.island.hatch && ap.island.hatch.map((poly) => poly.map(W)),
      tip: ap.island.tip && W(ap.island.tip), headIn: W(ap.island.headIn), headOut: W(ap.island.headOut),
      pieces: cross?.pieces[0] ? cross.pieces[0].map((poly) => Wp(closedSegs(poly))) : null,
    };
    const stop = crossLine(en, target, 0.25), stopX = crossLine(ex, target, 0.25);
    const bd = {
      idx, id: b.id, name, role: 'secondaire', sY: s.sY, l: s.auto.l, theta: fr.theta, u: s.u, n: fr.n, a: 0, ai: 0, x0, xT, xEnd, h, b: isl.b, hb, th: 0, isl,
      W, Ws: fr.Ws, Wp, target,
      entry: { ...en, curbW: Wp(en.curb), Tc: W(en.fil.Tc), Tl: W(en.fil.Tl), C: W(en.fil.C), F: W(en.F) },
      exit: { ...ex, curbW: Wp(ex.curb), Tc: W(ex.fil.Tc), Tl: W(ex.fil.Tl), C: W(ex.fil.C), F: W(ex.F) },
      island, cross, stop: stop && { a: W(stop.a), b: W(stop.b) }, stopX: stopX && { a: W(stopX.a), b: W(stopX.b) },
      gis: fmtGis(fr.theta, unit), angle: Math.acos(G.clamp(Math.abs(dot(s.u, uM)), 0, 1)),
    };
    const xs = [toM(bd.entry.Tc).x, toM(bd.exit.Tc).x];
    const g0 = Math.min(...xs), g1 = Math.max(...xs);
    gaps[s.sY].push([g0, g1]);
    if (widened && (g0 < -lenA || g1 > lenB)) issues.push({ lvl: 'warn', bi: idx, msg: `${name} : le débouché dépasse la zone élargie de la route principale ; allonger le stockage ou l'alignement droit.` });
    bds.push(bd);
  }
  for (const q of [A0, B0]) {
    const fr = frame(O, q.u), sgn = q === A0 ? -1 : 1, Lx = q === A0 ? LA : LB;
    bds.push({
      idx: q.idx, id: q.b.id, name: q.b.name, role: 'principale', theta: fr.theta, u: q.u, n: fr.n, a: 0, x0: 0, xT: 0, xEnd: Lx, h: 0,
      W: fr.W, Ws: fr.Ws, Wp: fr.Wp, gis: fmtGis(fr.theta, unit),
      entry: { F: toW(sgn * Lx, -sgn * half) }, exit: { F: toW(sgn * Lx, sgn * half) },
    });
  }
  bds.sort((p, q) => G.normAng(p.theta) - G.normAng(q.theta));
  D.ok = true;
  D.zoomR = Math.max(Lm + 30, ...bds.filter((q) => q.role === 'secondaire').map((q) => q.xT + 15));

  // ================= Primitives de dessin =================
  const Pp = (o) => prims.push(o);
  const text = (lay, p, s, rot = 0, align = 'center', hh = TH) => Pp({ k: 'text', L: lay, p, s, rot: upright(rot), align, h: hh });
  const dims = makeDims(Pp, TH);
  const pathM = (pts) => pts.slice(1).map((p, i) => L(toW(pts[i].x, pts[i].y), toW(p.x, p.y)));
  const RT = 150; // raccordement des changements de largeur de la chaussée principale

  // Bords de la chaussée principale (interrompus au débouché des branches secondaires)
  const edges = {};
  for (const sg of [1, -1]) {
    edges[sg] = edgePts(sg);
    for (const piece of cutPolyline(edges[sg], gaps[sg])) {
      const w = piece.map((p) => toW(p.x, p.y));
      Pp({ k: 'path', L: 'BORDURE', segs: G.roundPolyline(w, w.map((_, i) => (i > 0 && i < w.length - 1 ? RT : 0))) });
    }
  }
  Pp({ k: 'path', L: 'LIMITE', segs: [L(toW(-LA, -half), toW(-LA, half))] });
  Pp({ k: 'path', L: 'LIMITE', segs: [L(toW(LB, -half), toW(LB, half))] });

  // Îlots centraux de la route principale (côté A puis côté B par symétrie centrale) : enveloppe peinte
  // et, si demandé, îlot en saillie en retrait de 0,30 m (5u) de l'enveloppe.
  const holes = [];
  const MK = (pts, opt = {}) => Pp({ k: 'path', L: 'MARQUAGE', segs: pathM(pts), wm: 0.15, ...opt });
  const T3 = { dash: [3, 1.33], lt: 'T3' }, T1 = { dash: [3, 10], lt: 'T1' };
  // Contour fermé à angles arrondis (rayon borné par la longueur des côtés).
  const roundedClosed = (pts, r) => {
    const M = G.lerp(pts[pts.length - 1], pts[0], 0.5), q = [M, ...pts, M];
    return G.roundPolyline(q, q.map((_, i) => (i > 0 && i < q.length - 1 ? r : 0)));
  };
  // Îlots centraux : enveloppe peinte tracée tout de suite ; partie en saillie et zébra après les passages piétons.
  const centrals = [];
  const centralIsland = (env, raisedPart, side) => {
    MK([...env, env[0]]);
    let raised = null;
    if (P.tag.raised && raisedPart) {
      const inner = insetPolygon(raisedPart.map((p) => toW(p.x, p.y)), 0.3);
      if (!inner) issues.push({ lvl: 'warn', msg: 'Îlot central trop étroit pour être en saillie : seule l\'enveloppe peinte est dessinée.' });
      else raised = roundedClosed(inner, 0.75);
    }
    centrals.push({ env, raised, side });
  };
  const sideMarks = (hasTag, len, f) => {
    const side = f(-1, 0).x < 0 ? -1 : 1;
    const Xal = -len, Xpre = Xal - Ldep - Lpre;
    // L'îlot en saillie suit l'enveloppe peinte dans le biseau jusqu'à ce qu'il ne reste qu'1 m de large.
    const Xcut = Math.min(Xal, Xpre + ((1 + 0.6) / c) * (Xal - Xpre)), hc = ((c / 2) * (Xcut - Xpre)) / (Xal - Xpre);
    if (hasTag) {
      const Xd = -Lm, Xc = Xd - Ls, Xs = Xc - Lsif;
      const env = [f(Xpre, 0), f(Xal, c / 2), f(Xd, c / 2), f(Xd, c / 2 - a), f(Xc, c / 2 - a), f(Xs, -c / 2), f(Xal, -c / 2)];
      centralIsland(env, a >= 1.2 ? [f(Xcut, hc), ...env.slice(1), f(Xcut, -hc)] : null, side);
      MK([f(Xs, -c / 2), f(Xd, -c / 2)], T3); // séparation voie directe / TAG
    } else {
      const env = [f(-Lm, c / 2), f(Xal, c / 2), f(Xpre, 0), f(Xal, -c / 2), f(-Lm, -c / 2)];
      centralIsland(env, [f(-Lm, c / 2), f(Xal, c / 2), f(Xcut, hc), f(Xcut, -hc), f(Xal, -c / 2), f(-Lm, -c / 2)], side);
    }
    return Xpre;
  };
  if (widened) {
    const xa = sideMarks(tagA, lenA, (X, Y) => ({ x: X, y: Y }));
    const xb = -sideMarks(tagB, lenB, (X, Y) => ({ x: -X, y: -Y }));
    MK([{ x: -LA, y: 0 }, { x: xa, y: 0 }], T1);
    MK([{ x: xb, y: 0 }, { x: LB, y: 0 }], T1);
  } else {
    MK([{ x: -LA, y: 0 }, { x: -(Lm + 30), y: 0 }], T1);
    MK([{ x: -(Lm + 30), y: 0 }, { x: Lm + 30, y: 0 }], T3);
    MK([{ x: Lm + 30, y: 0 }, { x: LB, y: 0 }], T1);
  }

  // Passages piétons de la route principale, de part et d'autre du débouché (repère principal) ; l'îlot central
  // en saillie est coupé en refuge et le zébra s'interrompt au droit du passage.
  const mainCross = [];
  const asPath = (pts) => pts.slice(1).map((p, i) => L(pts[i], p));
  if (sec.pp) {
    for (const side of [-1, 1]) {
      const Xc = side * (Lm + sec.ppRecul + sec.ppW / 2);
      if (Math.abs(Xc) + sec.ppW / 2 > (side < 0 ? LA : LB) - 2) continue;
      const hi = cutAtX(asPath(edges[1]), Xc), lo = cutAtX(asPath(edges[-1]), Xc);
      if (!hi || !lo) continue;
      const mine = centrals.filter((ci) => ci.side === side), withRaised = mine.filter((ci) => ci.raised);
      const cr = crossing(Xc, sec.ppW, lo, hi, { islands: withRaised.map((ci) => polyOf(ci.raised).map(toM)), painted: mine.map((ci) => ci.env) });
      withRaised.forEach((ci, k) => { if (cr.pieces[k]) ci.pieces = cr.pieces[k]; });
      mine.forEach((ci, k) => {
        const r = cr.painted[k];
        if (r) ci.strip = [{ x: cr.x1, y: r[0] }, { x: cr.x2, y: r[0] }, { x: cr.x2, y: r[1] }, { x: cr.x1, y: r[1] }];
      });
      mainCross.push(cr);
    }
  }
  // Îlots centraux : zébra sur la partie peinte seulement, îlot en saillie (entier ou de part et d'autre du refuge).
  const toWp = (p) => toW(p.x, p.y);
  for (const ci of centrals) {
    const parts = ci.pieces ? ci.pieces.map((poly) => closedSegs(poly.map(toWp))) : ci.raised ? [ci.raised] : [];
    const rings = [ci.env.map(toWp), ...parts.map((s) => G.samplePath(s, 0.3)), ...(ci.strip ? [ci.strip.map(toWp)] : [])];
    Pp({ k: 'hatch', L: 'MARQUAGE', lines: G.hatchPolygon(rings, ang(uM) + Math.PI / 4, 1.0), wm: 0.12 });
    for (const s of parts) {
      Pp({ k: 'fill', L: 'ILOT_SEP', rings: [s], role: 'ilot' });
      Pp({ k: 'path', L: 'ILOT_SEP', segs: s, closed: true });
      holes.push(s);
    }
  }
  for (const cr of mainCross) crossingPrims(cr, toWp, sec, sec.pmr).forEach(Pp);

  // Remplissage chaussée (union à règle non nulle ; îlots en trous)
  const rnd = (pts) => { const w = pts.map((p) => toW(p.x, p.y)); return G.roundPolyline(w, w.map((_, i) => (i > 0 && i < w.length - 1 ? RT : 0))); };
  const low = rnd(edges[-1]), up = G.revPath(rnd(edges[1]));
  const mainRing = [...low, L(G.segEnd(low[low.length - 1]), G.segStart(up[0])), ...up, L(G.segEnd(up[up.length - 1]), G.segStart(low[0]))];
  const rings = [orient(mainRing, false), ...holes.map((h) => orient(h, true))];
  for (const bd of bds) {
    if (bd.role !== 'secondaire') continue;
    rings.push(orient([...G.revPath(bd.exit.curbW), L(bd.exit.F, bd.entry.F), ...bd.entry.curbW, L(bd.entry.Tc, bd.exit.Tc)], false));
    if (bd.island?.outline) for (const part of bd.island.pieces || [bd.island.outline]) rings.push(orient(part, true));
  }
  Pp({ k: 'fill', L: 'CHAUSSEE', rings, role: 'chaussee', rule: 'nonzero' });

  // Abords (caniveau, bordure, trottoir, contre-bordure / berme) le long des bords de chaussée : morceaux de bord
  // de la principale et bordures des secondaires orientés terre à droite, puis mis bout à bout par quadrant.
  const bands = sideBands(prj);
  if (bands.length) {
    const rest = [];
    for (const sg of [1, -1]) for (const piece of cutPolyline(edges[sg], gaps[sg])) rest.push(sg > 0 ? G.revPath(rnd(piece)) : rnd(piece));
    for (const bd of bds) if (bd.role === 'secondaire') rest.push(bd.entry.curbW, G.revPath(bd.exit.curbW));
    const head = (p) => G.segStart(p[0]), tail = (p) => G.segEnd(p[p.length - 1]);
    while (rest.length) {
      let ch = rest.shift();
      for (let grown = true; grown;) {
        grown = false;
        const i = rest.findIndex((q) => G.dist(tail(ch), head(q)) < 0.05 || G.dist(tail(q), head(ch)) < 0.05);
        if (i >= 0) { const q = rest.splice(i, 1)[0]; ch = G.dist(tail(ch), head(q)) < 0.05 ? [...ch, ...q] : [...q, ...ch]; grown = true; }
      }
      if (ch.length) sideBandPrims(ch, bands, prj.context === 'urbain' ? 'TROTTOIR' : 'ACCOTEMENT').forEach(Pp);
    }
  }

  // Axe de la route principale
  Pp({ k: 'path', L: 'AXE', segs: [L(toW(-LA - 3, 0), toW(LB + 3, 0))] });
  Pp({ k: 'cross', L: 'AXE', p: O, size: 1.5 });

  // Branches secondaires : bordures, îlots, cédez-le-passage / STOP, visibilité
  for (const bd of bds) {
    if (bd.role !== 'secondaire') continue;
    const { W, isl, x0, xT, xEnd } = bd;
    Pp({ k: 'path', L: 'BORDURE', segs: bd.entry.curbW });
    Pp({ k: 'path', L: 'BORDURE', segs: bd.exit.curbW });
    Pp({ k: 'path', L: 'LIMITE', segs: [L(bd.exit.F, bd.entry.F)] });
    if (bd.island) {
      // Enveloppe peinte (triangle de construction), zébra, îlot en saillie en retrait de la BDG.
      if (bd.island.outline) {
        for (const part of bd.island.pieces || [bd.island.outline]) {
          Pp({ k: 'fill', L: 'ILOT_SEP', rings: [part], role: 'ilot' });
          Pp({ k: 'path', L: 'ILOT_SEP', segs: bd.island.pieces ? part : bd.island.curb, closed: true });
        }
      }
      for (const p of bd.island.paint) if (p.length) Pp({ k: 'path', L: 'MARQUAGE', segs: p, wm: 0.15 });
      if (bd.island.hatch) Pp({ k: 'hatch', L: 'MARQUAGE', lines: G.hatchPolygon(bd.island.hatch, bd.theta + Math.PI / 4, 1.0), wm: 0.12 });
      const t1 = W({ x: x0, y: isl.b / 2 }), t2 = W({ x: xT, y: 0 }), t3 = W({ x: x0, y: -isl.b / 2 });
      Pp({ k: 'path', L: 'CONSTRUCTION', segs: [L(t1, t2), L(t2, t3), L(t3, t1)] });
    }
    if (bd.cross) crossingPrims(bd.cross, W, sec, sec.pmr).forEach(Pp);
    // Cotations de la branche, comme au giratoire : largeurs le / ls perpendiculaires aux voies, en amont du
    // raccordement, et rayons Re / Rs par flèche sur l'arc.
    for (const sd of [bd.entry, bd.exit]) {
      Pp({ k: 'cross', L: 'CONSTRUCTION', p: sd.C, size: 0.8 });
      Pp({ k: 'path', L: 'CONSTRUCTION', segs: [L(sd.C, sd.Tc), L(sd.C, sd.Tl)] });
      // Au-delà du passage piéton s'il y en a un.
      const xs = Math.max(G.clamp(sd.fil.Tl.x + 2, x0 + 2, Math.max(x0 + 2, xT - 2)), bd.cross ? bd.cross.x2 + 1.5 : -Infinity);
      const pIsl = add(sd.H, mul(sd.dI, (xs - sd.H.x) / sd.dI.x));
      const mOut = sd.s > 0 ? rot90(sd.dI) : neg(rot90(sd.dI));
      const [p1, p2] = sd.s > 0 ? [pIsl, add(pIsl, mul(mOut, sd.w))] : [add(pIsl, mul(mOut, sd.w)), pIsl];
      dims.aligned(W(p1), W(p2), 0, `${sd.s > 0 ? 'le' : 'ls'} = ${fmt(sd.w, 2)}`, { side: -1 });
      const mid = G.segAt(sd.fil.arc, 0.5);
      dims.radius(W(mid), norm(sub(sd.C, W(mid))), `${sd.s > 0 ? 'Re' : 'Rs'} = ${fmt(sd.R, 2)}`);
    }
    Pp({ k: 'path', L: 'AXE', segs: [L(W({ x: x0 - 1, y: 0 }), W({ x: xEnd + 3, y: 0 }))] });
    if (bd.stop) {
      // STOP : ligne continue de 0,50 m ; cédez-le-passage : T'2 de 0,50 m (0,50 / 0,50), en limite de chaussée prioritaire.
      const st = P.regime === 'stop' ? { wm: 0.5 } : { wm: 0.5, dash: [0.5, 0.5], lt: 'CLP' };
      Pp({ k: 'path', L: 'MARQUAGE', segs: [L(bd.stop.a, bd.stop.b)], ...st });
      text('MARQUAGE', W({ x: x0 + 4, y: bd.hb + bd.entry.w / 2 }), P.regime === 'stop' ? 'STOP' : 'CÉDEZ', bd.theta - Math.PI / 2, 'center', TH * 1.2);
    }
    // Axe de la secondaire : continu le long de l'îlot puis discontinu
    const xs = bd.island ? xT : x0, xc = Math.min(xEnd, xs + 30);
    Pp({ k: 'path', L: 'MARQUAGE', segs: [L(W({ x: xs, y: 0 }), W({ x: xc, y: 0 }))], wm: 0.15 });
    if (xEnd > xc + 1) Pp({ k: 'path', L: 'MARQUAGE', segs: [L(W({ x: xc, y: 0 }), W({ x: xEnd, y: 0 }))], wm: 0.15, dash: [3, 10], lt: 'T1' });
    // Triangles de visibilité : œil à 2 m du bord droit de la branche, en arrière de la ligne ;
    // cible sur l'axe de la voie prioritaire, à D = V85 × t de part et d'autre.
    const Dv = (P.v85 / 3.6) * P.tVis;
    const obs = W({ x: x0 + P.dObs, y: Math.max(bd.hb + 0.5, bd.hb + bd.entry.w - 2) });
    const om = toM(obs), sY = bd.sY;
    const tNear = toW(om.x + sY * Dv, sY * P.wLane / 2), tFar = toW(om.x - sY * Dv, -sY * P.wLane / 2);
    bd.vis = { obs, tNear, tFar, D: Dv };
    if (sec.visOn) {
      // Triangle œil – point de conflit sur la voie (même abscisse) – cible à D, de chaque côté.
      const pN = toW(om.x, (sY * P.wLane) / 2), pF = toW(om.x, (-sY * P.wLane) / 2);
      for (const [t, p] of [[tNear, pN], [tFar, pF]]) {
        Pp({ k: 'fill', L: 'VISIBILITE', role: 'vis', rings: [closedSegs([obs, p, t])] });
        Pp({ k: 'path', L: 'VISIBILITE', segs: [L(obs, t), L(t, p)] });
        Pp({ k: 'cross', L: 'VISIBILITE', p: t, size: 1.2 });
        dims.aligned(p, t, 0, `D = ${fmt(Dv, 0)} m`);
      }
      Pp({ k: 'cross', L: 'VISIBILITE', p: obs, size: 0.8 });
      text('VISIBILITE', add(G.lerp(obs, tNear, 0.55), mul(bd.u, TH)), `visibilité ${bd.name} : ${fmt(P.tVis, 0)} s à ${fmt(P.v85, 0)} km/h`, ang(sub(tNear, obs)), 'center', TH * 0.75);
      D.vis.push({ name: bd.name, obs: P.dObs, v85: P.v85, t: P.tVis, D: Dv });
    }
    // Étiquettes
    text('COTATION', W({ x: xEnd + 4 + 2 * TH, y: 0 }), bd.name, bd.theta + Math.PI / 2, 'center', TH * 1.6);
    text('COTATION', W({ x: xEnd + 4, y: 0 }), `${bd.gis} · ${fmt((bd.angle * 200) / Math.PI, 1)} gr / principale`, bd.theta + Math.PI / 2, 'center', TH * 0.9);
    if (bd.island) text('COTATION', W({ x: x0 + bd.h * 0.55, y: 0 }), `îlot ${fmt(isl.b, 2)} × ${fmt(bd.h, 2)}`, bd.theta, 'center', TH * 0.75);
  }
  for (const bd of bds) {
    if (bd.role !== 'principale') continue;
    const sg = bd.idx === A0.idx ? -1 : 1, Lx = sg < 0 ? LA : LB;
    text('COTATION', toW(sg * (Lx + 4 + 2 * TH), 0), bd.name, ang(uM) + Math.PI / 2, 'center', TH * 1.6);
    text('COTATION', toW(sg * (Lx + 4), 0), `route principale · ${bd.gis}`, ang(uM) + Math.PI / 2, 'center', TH * 0.9);
  }
  // Route principale : profil en travers coté (voies, TAG, îlot) et, le long du bord, longueurs de la zone de TAG.
  // Côté A en repère principal ; côté B par symétrie centrale.
  const voie = (w) => `${P.nLanes > 1 ? 'voies' : 'voie'} ${fmt(w, 2)}`;
  const mainDims = (has, len, sg) => {
    const f = (X, Y) => toW(sg * X, sg * Y);
    if (!widened) {
      if (sg < 0) return;
      const Xc = -(Lm + 20);
      dims.chain([f(Xc, -half), f(Xc, 0), f(Xc, half)], 0, [voie(half), voie(half)]);
      return;
    }
    const Xal = -len, Xdep = Xal - Ldep, Xpre = Xdep - Lpre;
    const off = -2.2 * TH, lab = (s, v) => `${s} ${fmt(v, 1)}`;
    if (has) {
      const Xd = -Lm, Xc = Xd - Ls, Xs = Xc - Lsif, Xm = (Xd + Xc) / 2;
      dims.chain([f(Xm, -hw), f(Xm, -c / 2), f(Xm, c / 2 - a), f(Xm, c / 2), f(Xm, hw)], 0, [voie(half), `TAG ${fmt(P.tag.width, 2)}`, `îlot ${fmt(a, 2)}`, voie(half)]);
      dims.chain([f(Xpre, -hw), f(Xdep, -hw), f(Xal, -hw), f(Xs, -hw), f(Xc, -hw), f(Xd, -hw)], off,
        [lab('présignalisation', Lpre), lab('déport', Ldep), lab('alignement', Lal), lab('sifflet', Lsif), lab('stockage', Ls)]);
    } else {
      const Xm = (Xal - Lm) / 2;
      dims.chain([f(Xm, -hw), f(Xm, -c / 2), f(Xm, c / 2), f(Xm, hw)], 0, [voie(half), `îlot ${fmt(c, 2)}`, voie(half)]);
      dims.chain([f(Xpre, -hw), f(Xdep, -hw), f(Xal, -hw)], off, [lab('présignalisation', Lpre), lab('déport', Ldep)]);
    }
  };
  mainDims(tagA, lenA, 1);
  mainDims(tagB, lenB, -1);

  // ================= Points d'implantation =================
  const pt = (name, p, bi = null, k = '') => points.push({ n: points.length + 1, name, p, bi, kind: k });
  pt('Centre du carrefour', O, null, 'centre');
  for (const sg of [-1, 1]) {
    const side = sg > 0 ? 'gauche' : 'droit';
    edges[sg].forEach((q, k) => pt(`Principale · bord ${side} · sommet ${k + 1}`, toW(q.x, q.y), null, 'principale'));
  }
  const zonePts = (has, len, sg, nm) => {
    if (!widened) return;
    const X = (v) => sg * v;
    const list_ = has
      ? [['début présignalisation', len + Ldep + Lpre], ['début déport', len + Ldep], ['fin déport', len], ['début sifflet', Lm + Ls + Lsif], ['début stockage', Lm + Ls], ['fin de stockage', Lm]]
      : [['début présignalisation', len + Ldep + Lpre], ['début déport', len + Ldep], ['fin déport', len]];
    list_.forEach(([lab, v]) => pt(`Principale · axe · ${lab} (côté ${nm})`, toW(X(v), 0), null, 'principale'));
  };
  zonePts(tagA, lenA, -1, A0.b.name);
  zonePts(tagB, lenB, 1, B0.b.name);
  for (const bd of bds) {
    if (bd.role !== 'secondaire') continue;
    const nm = bd.name;
    pt(`${nm} · axe au bord de la principale`, bd.W({ x: bd.x0, y: 0 }), bd.idx, 'axe');
    pt(`${nm} · axe fin de projet`, bd.W({ x: bd.xEnd, y: 0 }), bd.idx, 'axe');
    for (const [sd, lab, R] of [[bd.entry, 'côté entrée', 'Re'], [bd.exit, 'côté sortie', 'Rs']]) {
      pt(`${nm} · ${lab} : tangence chaussée principale (${R})`, sd.Tc, bd.idx, 'bordure');
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

  addDeversPlan(prj, D);
  return D;
}
