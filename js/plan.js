// plan.js — carrefours plans en T (3 branches) et en X / croix (4 branches), d'après l'ACI.
// Repère de la route principale : origine au centre O, X de la branche A vers la branche B, Y à gauche.
// La route principale garde son profil ; ses bords sont déportés symétriquement (1/15) pour loger la voie de
// tourne-à-gauche (TAG) et l'îlot central. Les branches secondaires sont construites comme les branches d'un
// giratoire (approach.js), la cible étant le bord de la chaussée principale.
import * as G from './geom.js';
import { islandDims, planParams, secondaryAuto } from './norms.js';
import { addDeversPlan } from './devers.js';
import { fmt, fmtGis, upright, autoCenter, branchDirection, frame } from './common.js';
import { buildApproach, crossLine, targetX0 } from './approach.js';

const { add, sub, mul, dot, norm, rot90, ang, L } = G;
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
  const kind = prj.kind, P = planParams(prj);
  const unit = prj.opts?.angleUnit || 'gon';
  const TH = +prj.opts?.textH || 0.8;
  const issues = [], prims = [], points = [], bds = [];
  const D = { kind, ok: false, O: null, branches: bds, prims, points, issues, plan: P };

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
    const island = ap.island && {
      outline: Wp(ap.island.outline), curb: Wp(ap.island.curb), closed: ap.island.closed, rive: ap.island.rive.map(Wp),
      tip: ap.island.tip && W(ap.island.tip), headIn: W(ap.island.headIn), headOut: W(ap.island.headOut),
    };
    const stop = crossLine(en, target, 0.25), stopX = crossLine(ex, target, 0.25);
    const bd = {
      idx, id: b.id, name, role: 'secondaire', sY: s.sY, l: s.auto.l, theta: fr.theta, u: s.u, n: fr.n, a: 0, ai: 0, x0, xT, xEnd, h, b: isl.b, hb, th: 0, isl,
      W, Ws: fr.Ws, Wp, target,
      entry: { ...en, curbW: Wp(en.curb), Tc: W(en.fil.Tc), Tl: W(en.fil.Tl), C: W(en.fil.C), F: W(en.F) },
      exit: { ...ex, curbW: Wp(ex.curb), Tc: W(ex.fil.Tc), Tl: W(ex.fil.Tl), C: W(ex.fil.C), F: W(ex.F) },
      island, stop: stop && { a: W(stop.a), b: W(stop.b) }, stopX: stopX && { a: W(stopX.a), b: W(stopX.b) },
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
  const centralIsland = (env, raisedPart) => {
    const w = env.map((p) => toW(p.x, p.y));
    MK([...env, env[0]]);
    Pp({ k: 'hatch', L: 'MARQUAGE', lines: G.hatchPolygon(w, ang(uM) + Math.PI / 4, 1.0), wm: 0.12 });
    if (!P.tag.raised || !raisedPart) return;
    const inner = insetPolygon(raisedPart.map((p) => toW(p.x, p.y)), 0.3);
    if (!inner) { issues.push({ lvl: 'warn', msg: 'Îlot central trop étroit pour être en saillie : seule l\'enveloppe peinte est dessinée.' }); return; }
    const segs = closedPath(inner);
    Pp({ k: 'fill', L: 'ILOT_SEP', rings: [segs], role: 'ilot' });
    Pp({ k: 'path', L: 'ILOT_SEP', segs, closed: true });
    holes.push(segs);
  };
  const sideMarks = (hasTag, len, f) => {
    const Xal = -len, Xpre = Xal - Ldep - Lpre;
    if (hasTag) {
      const Xd = -Lm, Xc = Xd - Ls, Xs = Xc - Lsif;
      const env = [f(Xpre, 0), f(Xal, c / 2), f(Xd, c / 2), f(Xd, c / 2 - a), f(Xc, c / 2 - a), f(Xs, -c / 2), f(Xal, -c / 2)];
      centralIsland(env, a >= 1.2 ? env.slice(1) : null);
      MK([f(Xs, -c / 2), f(Xd, -c / 2)], T3); // séparation voie directe / TAG
    } else {
      const env = [f(-Lm, c / 2), f(Xal, c / 2), f(Xpre, 0), f(Xal, -c / 2), f(-Lm, -c / 2)];
      centralIsland(env, [f(-Lm, c / 2), f(Xal, c / 2), f(Xal, -c / 2), f(-Lm, -c / 2)]);
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

  // Remplissage chaussée (union à règle non nulle ; îlots en trous)
  const rnd = (pts) => { const w = pts.map((p) => toW(p.x, p.y)); return G.roundPolyline(w, w.map((_, i) => (i > 0 && i < w.length - 1 ? RT : 0))); };
  const low = rnd(edges[-1]), up = G.revPath(rnd(edges[1]));
  const mainRing = [...low, L(G.segEnd(low[low.length - 1]), G.segStart(up[0])), ...up, L(G.segEnd(up[up.length - 1]), G.segStart(low[0]))];
  const rings = [orient(mainRing, false), ...holes.map((h) => orient(h, true))];
  for (const bd of bds) {
    if (bd.role !== 'secondaire') continue;
    rings.push(orient([...G.revPath(bd.exit.curbW), L(bd.exit.F, bd.entry.F), ...bd.entry.curbW, L(bd.entry.Tc, bd.exit.Tc)], false));
    if (bd.island && bd.isl.type !== 'peint') rings.push(orient(bd.island.outline, true));
  }
  Pp({ k: 'fill', L: 'CHAUSSEE', rings, role: 'chaussee', rule: 'nonzero' });

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
      if (isl.type === 'peint') {
        Pp({ k: 'path', L: 'MARQUAGE', segs: bd.island.curb, closed: true, wm: 0.15 });
        Pp({ k: 'hatch', L: 'MARQUAGE', lines: G.hatchPolygon(G.samplePath(bd.island.outline, 0.3), bd.theta + Math.PI / 4, 1.0), wm: 0.12 });
      } else {
        Pp({ k: 'fill', L: 'ILOT_SEP', rings: [bd.island.outline], role: 'ilot' });
        Pp({ k: 'path', L: 'ILOT_SEP', segs: bd.island.curb, closed: true });
        for (const rv of bd.island.rive || []) if (rv.length) Pp({ k: 'path', L: 'MARQUAGE', segs: rv, wm: 0.15 });
      }
      const t1 = W({ x: x0, y: isl.b / 2 }), t2 = W({ x: xT, y: 0 }), t3 = W({ x: x0, y: -isl.b / 2 });
      Pp({ k: 'path', L: 'CONSTRUCTION', segs: [L(t1, t2), L(t2, t3), L(t3, t1)] });
    }
    for (const sd of [bd.entry, bd.exit]) {
      Pp({ k: 'cross', L: 'CONSTRUCTION', p: sd.C, size: 0.8 });
      Pp({ k: 'path', L: 'CONSTRUCTION', segs: [L(sd.C, sd.Tc), L(sd.C, sd.Tl)] });
      const mid = G.segAt(sd.fil.arc, 0.5), toC = norm(sub(sd.fil.C, mid));
      text('COTATION', W(add(mid, mul(toC, 1.6 * TH))), `${sd.s > 0 ? 'Re' : 'Rs'} = ${fmt(sd.R, 2)}`, ang(rot90(toC)) + bd.theta);
    }
    Pp({ k: 'path', L: 'AXE', segs: [L(W({ x: x0 - 1, y: 0 }), W({ x: xEnd + 3, y: 0 }))] });
    if (bd.stop) {
      // STOP : ligne continue de 0,50 m ; cédez-le-passage : T'2 de 0,50 m (0,50 / 0,50), en limite de chaussée prioritaire.
      const st = P.regime === 'stop' ? { wm: 0.5 } : { wm: 0.5, dash: [0.5, 0.5], lt: 'CLP' };
      Pp({ k: 'path', L: 'MARQUAGE', segs: [L(bd.stop.a, bd.stop.b)], ...st });
      text('MARQUAGE', W({ x: x0 + 4, y: bd.hb + bd.entry.w / 2 }), P.regime === 'stop' ? 'STOP' : 'CÉDEZ', bd.theta - Math.PI / 2, 'center', TH * 1.2);
      text('COTATION', add(G.lerp(bd.stop.a, bd.stop.b, 0.5), mul(bd.u, 2.2 + TH)), `le = ${fmt(bd.entry.w, 2)}`, bd.theta + Math.PI / 2);
    }
    if (bd.stopX) text('COTATION', add(G.lerp(bd.stopX.a, bd.stopX.b, 0.5), mul(bd.u, 2.2 + TH)), `ls = ${fmt(bd.exit.w, 2)}`, bd.theta + Math.PI / 2);
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
    for (const t of [tNear, tFar]) {
      Pp({ k: 'path', L: 'CONSTRUCTION', segs: [L(obs, t)], dash: [2, 2] });
      Pp({ k: 'cross', L: 'CONSTRUCTION', p: t, size: 1.2 });
    }
    text('CONSTRUCTION', add(G.lerp(obs, tNear, 0.55), mul(bd.u, TH)), `visibilité ${fmt(Dv, 0)} m (${fmt(P.tVis, 0)} s à ${fmt(P.v85, 0)} km/h)`, ang(sub(tNear, obs)), 'center', TH * 0.75);
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
  if (widened) {
    text('COTATION', toW(0, -(hw + 2 * TH)), `chaussée ${fmt(2 * half, 2)} m portée à ${fmt(2 * hw, 2)} m (déport 1/${fmt(Ldep / (c / 2), 0)})`, ang(uM), 'center', TH * 0.8);
    const lab = `TAG ${fmt(P.tag.width, 2)} + îlot ${fmt(a, 2)} · stockage ${fmt(Ls, 0)} m · sifflet ${fmt(Lsif, 0)} m`;
    if (tagA) text('COTATION', toW(-(Lm + Ls / 2), -(c / 2 + 1.2 * TH)), lab, ang(uM), 'center', TH * 0.7);
    if (tagB) text('COTATION', toW(Lm + Ls / 2, c / 2 + 1.2 * TH), lab, ang(uM), 'center', TH * 0.7);
  }

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
