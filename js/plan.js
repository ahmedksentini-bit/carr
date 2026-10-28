// plan.js — carrefours plans en T (3 branches) et en X / croix (4 branches), d'après l'ACI.
// Repère de la route principale : origine au centre O, X de la branche A vers la branche B, Y à gauche.
// La route principale garde son profil ; ses bords sont déportés symétriquement (1/15) pour loger la voie de
// tourne-à-gauche (TAG) et l'îlot central. Les branches secondaires sont construites comme les branches d'un
// giratoire (approach.js), la cible étant le bord de la chaussée principale.
import * as G from './geom.js';
import { islandDims, planParams, secondaryAuto, sectionParams, sideBands } from './norms.js';
import { addDeversPlan } from './devers.js';
import { fmt, fmtGis, upright, autoCenter, branchDirection, frame, sideBandPrims } from './common.js';
import { buildApproach, aciBranch, aciCircles, crossLine, targetX0, widthAlong } from './approach.js';
import { makeDims } from './dims.js';
import { crossing, crossingPrims, cutAtX, polyOf, closedSegs } from './crossing.js';
import { sweep, conflicts, polyPath, SEMI } from './swept.js';

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

export function buildPlan(prj, opt = {}) {
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
  const tagA = P.tag.on && secs.some((s) => s.sY > 0); // sens A→B : tourne à gauche vers +Y, voie côté A
  const tagB = P.tag.on && secs.some((s) => s.sY < 0); // sens B→A : tourne à gauche vers −Y, voie côté B
  const widened = tagA || tagB;
  const hw = widened ? half + c / 2 : half;
  const { storage: Ls, sifflet: Lsif, align: Lal, deport: Ldep, presig: Lpre, mark, R: Rz } = P.tag;
  const nz = Lpre > 0.5 ? Math.min(P.tag.nose, c) : 0; // largeur du nez de l'îlot central en fin de présignalisation

  // Géométrie ACI de chaque branche secondaire (Tableau 8, Fig. 25) : repère, bord de la principale (cible) et
  // cercles de giration de l'îlot. Ris = 2l + a est tangent au bord gauche de la voie de TAG d'où viennent les
  // tourne-à-gauche ; Rie = 2l + b au bord gauche des voies directes opposées (b = largeur totale de l'îlot central) ;
  // sans îlot central, a = b = 0 et les deux cercles sont tangents à l'axe de la principale.
  const localLine = (fr, Y, sY) => ({
    p: fr.toL(toW(0, Y)), d: { x: dot(uM, fr.u), y: dot(uM, fr.n) }, n: { x: sY * dot(Ym, fr.u), y: sY * dot(Ym, fr.n) },
  });
  const geo = new Map();
  for (const s of secs) {
    const fr = frame(O, s.u), isl = islandDims(prj, s.b), l = s.auto.l, I = s.b.island || {};
    const target = { kind: 'line', p: fr.toL(toW(0, s.sY * hw)), d: { x: dot(uM, s.u), y: dot(uM, fr.n) } };
    const aci = {
      H: pick(I.length, 4 * l), b1: 0.55 * l, b2: 1.45 * l, off: 0.5,
      Ris: pick(I.Ris, 2 * l + (widened ? a : 0)), Rie: pick(I.Rie, 2 * l + (widened ? c : 0)),
      lineIs: localLine(fr, widened ? s.sY * (c / 2 - a) : 0, s.sY), lineIe: localLine(fr, widened ? (-s.sY * c) / 2 : 0, s.sY),
      Rre: 8 * l, Rrs: 16 * l, rn: 1, nose: pick(I.gap, 1.5), g: isl.bdg,
    };
    geo.set(s, { fr, isl, target, aci, hasIsland: isl.type !== 'aucun', K: aciCircles(target, aci) });
  }
  // Demi-longueur du débouché (estimation majorante : demi-base du triangle, voie, rayon de bordure).
  let Lm = 6;
  for (const s of secs) {
    const sinp = Math.max(0.3, Math.abs(dot(s.u, Ym))), cotp = Math.sqrt(1 - sinp * sinp) / sinp;
    Lm = Math.max(Lm, (1.45 * s.auto.l + Math.max(s.le, s.ls) + 1) / sinp + Math.max(s.Re, s.Rs) * (1 + cotp) + 2);
  }
  // Têtes des îlots centraux (ACI §2.5.5) : aux points de tangence des cercles de giration avec les bords de voie de la
  // principale. Branche côté +Y : Ris fixe la tête côté A (TAG A→B), Rie celle côté B ; symétrique côté −Y. Pour un X,
  // chaque tête est concernée par deux cercles : on retient le point le plus éloigné du centre.
  let XdA = Infinity, XdB = -Infinity;
  for (const [s, gm] of geo) {
    if (!gm.K) continue;
    const xs = toM(gm.fr.W(gm.K.Cs)).x, xe = toM(gm.fr.W(gm.K.Ce)).x;
    if (s.sY > 0) { XdA = Math.min(XdA, xs); XdB = Math.max(XdB, xe); } else { XdB = Math.max(XdB, xs); XdA = Math.min(XdA, xe); }
  }
  // Recul éventuel des têtes (épure PL : décalage au-delà du bord intérieur de la trajectoire).
  const LdA = Math.max(1, Number.isFinite(XdA) ? -XdA : Lm) + P.tag.headBack, LdB = Math.max(1, Number.isFinite(XdB) ? XdB : Lm) + P.tag.headBack;
  // La zone élargie couvre au moins le débouché (Lm) ; sans TAG de ce côté, l'îlot va de sa tête à l'alignement.
  const fullLen = (hasTag, Ld) => (!widened ? 0 : hasTag ? Ld + Ls + Lsif + Lal : Math.max(Ld + Lal, Lm));
  const lenA = fullLen(tagA, LdA), lenB = fullLen(tagB, LdB);
  const lenEnd = (q, len) => {
    const reach = widened ? len + Ldep + Lpre + 15 : Lm + 30;
    if (q.b.length) return Math.max(reach, Lm + +q.b.length);
    return G.clamp(dot(sub(q.far, O), q.u), reach, reach + 120);
  };
  const LA = lenEnd(A0, lenA), LB = lenEnd(B0, lenB);
  // Bords : déportés de nz/2 sur la présignalisation puis de (c − nz)/2 sur le déport, parallèlement à l'enveloppe de
  // l'îlot central (les voies gardent leur largeur) ; sommets raccordés aux rayons de zones (r).
  const edgePts = (sg) => (widened
    ? [{ x: -LA, y: sg * half }, { x: -(lenA + Ldep + Lpre), y: sg * half, r: Rz.pre }, { x: -(lenA + Ldep), y: sg * (half + nz / 2), r: Rz.dep },
      { x: -lenA, y: sg * hw, r: Rz.al }, { x: lenB, y: sg * hw, r: Rz.al }, { x: lenB + Ldep, y: sg * (half + nz / 2), r: Rz.dep },
      { x: lenB + Ldep + Lpre, y: sg * half, r: Rz.pre }, { x: LB, y: sg * half }].filter((p, i, t) => !i || p.x - t[i - 1].x > 1e-6)
    : [{ x: -LA, y: sg * half }, { x: LB, y: sg * half }]);
  D.plan = { ...P, half, hw, c, Lm, LdA, LdB, lenA, lenB, LA, LB, tagA, tagB, widened };

  // --- Branches secondaires
  const gaps = { 1: [], [-1]: [] };
  for (const s of secs) {
    const b = s.b, idx = s.idx, name = b.name;
    const { fr, isl, target, aci, hasIsland, K } = geo.get(s);
    const nIn = Math.max(1, +b.nIn || 1), nOut = Math.max(1, +b.nOut || 1), wl = +b.wLane;
    const wIn = nIn * wl, wOut = nOut * wl, { le, ls, Re, Rs } = s;
    const x0 = targetX0(target, 0);
    if (!(x0 > 0)) { issues.push({ lvl: 'err', bi: idx, msg: `${name} : branche parallèle à la route principale.` }); continue; }
    const h = hasIsland ? aci.H : 0, xT = x0 + h;
    let xEnd = b.length ? x0 + +b.length : Math.min(Math.max(dot(sub(s.far, O), s.u), xT + 40), xT + 80);
    xEnd = Math.max(xEnd, xT + 30);
    const ap = hasIsland
      ? aciBranch({ name, idx, target, xEnd, isl, le, ls, wIn, wOut, Re, Rs, aci }, issues)
      : buildApproach({
        name, idx, target, a: 0, ai: 0, x0, xT: x0 + 10, xEnd, hb: 0, th: 0, hasIsland: false, isl, le, ls, wIn, wOut, Re, Rs,
        labels: { en: 'de bordure côté entrée', ex: 'de bordure côté sortie' }, flareLvl: 'info',
      }, issues);
    if (!ap) continue;
    const { W, Wp } = fr;
    const { en, ex } = ap;
    xEnd = Math.max(xEnd, en.F.x, ex.F.x);
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
      pieces: cross?.pieces[0] ? cross.pieces[0].map((poly) => Wp(closedSegs(poly))) : null, aci: ap.island.aci,
    };
    const stop = crossLine(en, target, 0.25), stopX = crossLine(ex, target, 0.25);
    const bd = {
      idx, id: b.id, name, role: 'secondaire', sY: s.sY, l: s.auto.l, theta: fr.theta, u: s.u, n: fr.n, a: 0, ai: 0, x0, xT, xEnd, h, b: isl.b, hb: 0, th: 0, isl,
      W, Ws: fr.Ws, Wp, target,
      entry: { ...en, curbW: Wp(en.curb), Tc: W(en.fil.Tc), Tl: W(en.fil.Tl), C: W(en.fil.C), F: W(en.F) },
      exit: { ...ex, curbW: Wp(ex.curb), Tc: W(ex.fil.Tc), Tl: W(ex.fil.Tl), C: W(ex.fil.C), F: W(ex.F) },
      island, cross, K, stop: stop && { a: W(stop.a), b: W(stop.b) }, stopX: stopX && { a: W(stopX.a), b: W(stopX.b) },
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
  const toWp = (p) => toW(p.x, p.y);
  // Polyligne du repère principal → chemin raccordé aux sommets intérieurs de rayon p.r (rayons de zones).
  const rnd = (pts) => G.roundPolyline(pts.map(toWp), pts.map((p, i) => (i > 0 && i < pts.length - 1 ? p.r || 0 : 0)));

  // Bords de la chaussée principale (interrompus au débouché des branches secondaires)
  const edges = {};
  for (const sg of [1, -1]) {
    edges[sg] = edgePts(sg);
    for (const piece of cutPolyline(edges[sg], gaps[sg])) Pp({ k: 'path', L: 'BORDURE', segs: rnd(piece) });
  }
  Pp({ k: 'path', L: 'LIMITE', segs: [L(toW(-LA, -half), toW(-LA, half))] });
  Pp({ k: 'path', L: 'LIMITE', segs: [L(toW(LB, -half), toW(LB, half))] });

  // Îlots centraux de la route principale (côté A puis côté B par symétrie centrale), d'après la voie principale de
  // Mensura : présignalisation (l'enveloppe s'ouvre jusqu'au nez nz), déport (jusqu'à la largeur totale c), alignement
  // droit, sifflet et stockage (tête a). Sommets de zones raccordés aux rayons Rz ; îlot en saillie du nez à la tête,
  // en retrait de la distance de marquage.
  const holes = [];
  const MK = (pts, opt = {}) => Pp({ k: 'path', L: 'MARQUAGE', segs: pathM(pts), wm: 0.15, ...opt });
  const T3 = { dash: [3, 1.33], lt: 'T3' }, T1 = { dash: [3, 10], lt: 'T1' };
  // Contour fermé à angles arrondis, rayon par sommet (borné par la longueur des côtés).
  const roundedClosed = (pts, r) => {
    const M = G.lerp(pts[pts.length - 1], pts[0], 0.5), q = [M, ...pts, M];
    return G.roundPolyline(q, [0, ...(Array.isArray(r) ? r : pts.map(() => r)), 0]);
  };
  // Enveloppe peinte fermée : env[0] est la pointe sur l'axe, raccordée à l'axe (point V en amont) de part et d'autre
  // par le premier rayon, d'où une queue effilée tangente à l'axe.
  const envPath = (env, radii, V) => G.roundPolyline([V, ...env, env[0], V].map(toWp), [0, ...radii, radii[0], 0]).slice(1, -1);
  // Îlots centraux : enveloppe peinte tracée tout de suite ; partie en saillie et zébra après les passages piétons.
  const centrals = [];
  const centralIsland = (env, radii, V, raisedPart, raisedRadii, side) => {
    const segs = envPath(env, radii, V);
    Pp({ k: 'path', L: 'MARQUAGE', segs, wm: 0.15 });
    let raised = null;
    if (P.tag.raised && raisedPart) {
      const inner = insetPolygon(raisedPart.map(toWp), mark);
      if (!inner) issues.push({ lvl: 'warn', msg: 'Îlot central trop étroit pour être en saillie : seule l\'enveloppe peinte est dessinée.' });
      else raised = roundedClosed(inner, raisedRadii);
    }
    centrals.push({ env, envW: G.samplePath(segs, 0.5), raised, side });
    return toM(G.segStart(segs[0])).x; // début de la queue sur l'axe
  };
  const sideMarks = (hasTag, len, f, Ld) => {
    const side = f(-1, 0).x < 0 ? -1 : 1, h = c / 2, hn = nz / 2;
    const Xal = -len, Xn = Xal - Ldep, Xpre = Xn - Lpre, V = f(Xpre - 50, 0);
    // L'îlot en saillie part du nez ; s'il y resterait moins de 0,50 m une fois les retraits déduits, il recule dans le
    // déport jusqu'à cette largeur. Nez arrondi en demi-cercle.
    const hc = Math.min(h, Math.max(hn, mark + 0.25)), Xcut = hc <= hn + 1e-9 ? Xn : Xn + ((hc - hn) / (h - hn)) * Ldep, rN = hc - mark;
    const R = Rz, RH = 0.75; // RH : angles de la tête
    if (hasTag) {
      const Xd = -Ld, Xc = Xd - Ls, Xs = Xc - Lsif;
      const env = [f(Xpre, 0), f(Xn, hn), f(Xal, h), f(Xd, h), f(Xd, h - a), f(Xc, h - a), f(Xs, -h), f(Xal, -h), f(Xn, -hn)];
      const part = Xcut > Xn ? [f(Xcut, hc), ...env.slice(2, 8), f(Xcut, -hc)] : env.slice(1);
      MK([f(Xs, -h), f(Xd, -h)], T3); // séparation voie directe / TAG
      return centralIsland(env, [R.pre, R.dep, R.al, 0, 0, R.sto, R.sif, R.al, R.dep], V,
        a - 2 * mark >= 0.6 ? part : null, [rN, R.al, RH, RH, R.sto, R.sif, R.al, rN], side);
    }
    const env = [f(Xpre, 0), f(Xn, hn), f(Xal, h), f(-Ld, h), f(-Ld, -h), f(Xal, -h), f(Xn, -hn)];
    const part = Xcut > Xn ? [f(Xcut, hc), ...env.slice(2, 6), f(Xcut, -hc)] : env.slice(1);
    return centralIsland(env, [R.pre, R.dep, R.al, 0, 0, R.al, R.dep], V, part, [rN, R.al, RH, RH, R.al, rN], side);
  };
  if (widened) {
    const xa = sideMarks(tagA, lenA, (X, Y) => ({ x: X, y: Y }), LdA);
    const xb = sideMarks(tagB, lenB, (X, Y) => ({ x: -X, y: -Y }), LdB);
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
  for (const ci of centrals) {
    const parts = ci.pieces ? ci.pieces.map((poly) => closedSegs(poly.map(toWp))) : ci.raised ? [ci.raised] : [];
    const rings = [ci.envW, ...parts.map((s) => G.samplePath(s, 0.3)), ...(ci.strip ? [ci.strip.map(toWp)] : [])];
    Pp({ k: 'hatch', L: 'MARQUAGE', lines: G.hatchPolygon(rings, ang(uM) + Math.PI / 4, 1.0), wm: 0.12 });
    for (const s of parts) {
      Pp({ k: 'fill', L: 'ILOT_SEP', rings: [s], role: 'ilot' });
      Pp({ k: 'path', L: 'ILOT_SEP', segs: s, closed: true });
      holes.push(s);
    }
  }
  for (const cr of mainCross) crossingPrims(cr, toWp, sec, sec.pmr).forEach(Pp);

  // Remplissage chaussée (union à règle non nulle ; îlots en trous)
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

  // Épures de giration (semi-remorque) : tourne-à-droite et tourne-à-gauche, entrant et sortant, de chaque branche
  // secondaire. Trajectoire guide du milieu de l'essieu avant : le conducteur s'écarte vers l'extérieur de sa voie
  // (0,30 m de marge) ; parallèle aux bordures pour les tourne-à-droite, concentrique aux cercles Ris / Rie (bord
  // intérieur de la trajectoire, ACI) pour les tourne-à-gauche. La surface balayée est comparée aux bordures (tolérance :
  // BDD en interurbain, caniveau en urbain) et aux îlots en saillie (aucune tolérance).
  D.epures = [];
  if (P.epure) {
    const curbs = [], islandsMain = [...holes], islandsSec = [];
    for (const sg of [1, -1]) for (const piece of cutPolyline(edges[sg], gaps[sg])) curbs.push(rnd(piece));
    for (const bd of bds) {
      if (bd.role !== 'secondaire') continue;
      curbs.push(bd.entry.curbW, bd.exit.curbW);
      if (bd.island?.outline) islandsSec.push(...(bd.island.pieces || [bd.island.outline]));
    }
    // Bord de la principale (côté sg) entre les abscisses X0 et X1, dans le sens X0 → X1 : il suit la zone de déport.
    const edgeRun = (sg, X0, X1) => {
      const pts = edges[sg], yAt = (X) => {
        for (let i = 0; i + 1 < pts.length; i++) if (X >= pts[i].x - 1e-9 && X <= pts[i + 1].x + 1e-9) return pts[i].y + ((X - pts[i].x) / (pts[i + 1].x - pts[i].x || 1)) * (pts[i + 1].y - pts[i].y);
        return pts[X < pts[0].x ? 0 : pts.length - 1].y;
      };
      const lo = Math.min(X0, X1), hi = Math.max(X0, X1);
      const run = [{ x: lo, y: yAt(lo) }, ...pts.filter((p) => p.x > lo + 1e-6 && p.x < hi - 1e-6), { x: hi, y: yAt(hi) }].map((p) => toW(p.x, p.y));
      return polyPath(X0 <= X1 ? run : run.reverse());
    };
    const tolC = prj.context === 'urbain' ? sec.caniveau : sec.bdd, tolI = 0.05;
    const hv = SEMI.w / 2, m = 0.3, lead = 40, cw = (u) => ({ x: u.y, y: -u.x }); // cw : rotation de −90°
    const wApp = widened ? P.tag.width : P.wLane; // voie d'où part le tourne-à-gauche entrant
    for (const bd of bds) {
      if (bd.role !== 'secondaire' || !bd.K) continue;
      const { W, sY, u } = bd, dNear = mul(uM, -sY), dFar = mul(uM, sY), le = bd.entry.w, ls = bd.exit.w;
      const moves = [];
      // Tourne-à-droite : décalé de la bordure de (voie − demi-largeur − marge).
      const dR = (w) => Math.max(hv + 0.2, w - hv - m);
      const xX = toM(bd.exit.Tc).x, xE = toM(bd.entry.Tc).x, sn = dot(dNear, uM); // sens de la voie de rive en X
      moves.push(['tourne-à-droite entrant', -1, G.offsetPath([...edgeRun(sY, xX - sn * lead, xX), ...G.revPath(bd.exit.curbW)], dR(Math.min(P.wLane, ls)))]);
      moves.push(['tourne-à-droite sortant', -1, G.offsetPath([...bd.entry.curbW, ...edgeRun(sY, xE, xE + sn * lead)], dR(Math.min(P.wLane, le)))]);
      {
        // Tourne-à-gauche entrant : depuis la voie de TAG, autour du centre de Ris, puis dans la voie de sortie.
        const Ris = bd.K.Ris, C = W(bd.K.Cs);
        const Rg = Math.max(Ris + hv + 0.1, Math.min(Ris + wApp - hv - 0.1, Ris + ls - hv - m)), T1 = add(C, mul(Ym, -sY * Rg));
        let end, tail;
        if (bd.exit.kArc) {
          end = add(C, mul(norm(sub(W(bd.exit.ctrl[2]), C)), Rg));
          tail = G.offsetPath(G.revPath(bd.exit.curbW).slice(-2), Ris + ls - Rg);
        } else { end = add(C, mul(cw(u), Rg)); tail = [L(end, add(end, mul(u, lead)))]; }
        moves.push(['tourne-à-gauche entrant', 1, [L(sub(T1, mul(dFar, lead)), T1), G.A(C, Rg, ang(sub(T1, C)), ang(sub(end, C)), true), ...tail]]);
      }
      {
        // Tourne-à-gauche sortant : voie d'entrée, autour du centre de Rie, puis voies directes opposées.
        const Rie = bd.K.Rie, C = W(bd.K.Ce);
        const Rg = Math.max(Rie + hv + 0.1, Math.min(Rie + le - hv - m, Rie + half - hv - 0.1)), T3 = add(C, mul(cw(dFar), Rg));
        let start, head;
        if (bd.entry.kArc) {
          start = add(C, mul(norm(sub(W(bd.entry.ctrl[2]), C)), Rg));
          head = G.offsetPath(bd.entry.curbW.slice(0, 2), Rie + le - Rg);
        } else { start = add(C, mul(cw(neg(u)), Rg)); head = [L(add(start, mul(u, lead)), start)]; }
        moves.push(['tourne-à-gauche sortant', 1, [...head, G.A(C, Rg, ang(sub(start, C)), ang(sub(T3, C)), true), L(T3, add(T3, mul(dFar, lead)))]]);
      }
      for (const [label, turn, guide] of moves) {
        if (opt.only && (opt.only.bi !== bd.idx || opt.only.label !== label)) continue;
        const sw = sweep(guide, turn);
        if (!sw) continue;
        Pp({ k: 'fill', L: 'EPURE', role: 'epure', rings: [closedSegs(sw.poly)] });
        Pp({ k: 'path', L: 'EPURE', segs: polyPath(sw.outer) });
        Pp({ k: 'path', L: 'EPURE', segs: polyPath(sw.inner) });
        for (const pose of sw.poses) for (const r of pose) Pp({ k: 'path', L: 'EPURE', segs: closedSegs(r), closed: true });
        const hitC = conflicts(sw.poly, curbs, tolC), hitM = conflicts(sw.poly, islandsMain, tolI), hitS = conflicts(sw.poly, islandsSec, tolI);
        const marks = [];
        for (const h of [...hitC, ...hitM, ...hitS].sort((x, y) => y.depth - x.depth)) if (marks.every((q) => G.dist(h.p, q) > 3)) marks.push(h.p);
        for (const p of marks.slice(0, 6)) Pp({ k: 'cross', L: 'EPURE', p, size: 1.5 });
        const maxD = (hs) => (hs.length ? Math.max(...hs.map((h) => h.depth)) : 0);
        const what = [
          hitC.length ? `la bordure de ${fmt(maxD(hitC), 2)} m (tolérance ${fmt(tolC, 2)} m)` : '',
          hitM.length ? `la tête de l'îlot central de ${fmt(maxD(hitM), 2)} m` : '',
          hitS.length ? `l'îlot séparateur de ${fmt(maxD(hitS), 2)} m` : '',
        ].filter(Boolean).join(' et ');
        if (what) issues.push({ lvl: 'warn', bi: bd.idx, msg: `${bd.name} : épure ${SEMI.label}, ${label} : le véhicule dépasse ${what} (croix sur le plan) ; corrections proposées en bas de l'onglet Contrôles.` });
        D.epures.push({ name: bd.name, bi: bd.idx, label, ok: !what, dC: maxD(hitC), dM: maxD(hitM), dS: maxD(hitS), tolC, pts: marks.slice(0, 6) });
      }
    }
    if (D.epures.length && D.epures.every((e) => e.ok)) issues.push({ lvl: 'info', msg: `Épures ${SEMI.label} : aucun empiètement sur les bordures ni sur les îlots en saillie.` });
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
      // Construction ACI : triangle (H, b1, b2), cercles de giration Ris / Rie, retrait du nez de l'îlot en saillie.
      const K = bd.island.aci;
      if (K) {
        const [t1, t2, t3] = K.tri.map(W);
        Pp({ k: 'path', L: 'CONSTRUCTION', segs: [L(t1, t2), L(t2, t3), L(t3, t1)] });
        for (const [C, R, other, nm] of [[K.Cs, K.Ris, K.Ce, 'Ris'], [K.Ce, K.Rie, K.Cs, 'Rie']]) {
          const Cw = W(C), p = W(add(C, mul(norm(sub(C, other)), R)));
          Pp({ k: 'circle', L: 'CONSTRUCTION', c: Cw, r: R });
          Pp({ k: 'cross', L: 'CONSTRUCTION', p: Cw, size: 0.8 });
          dims.radius(p, norm(sub(Cw, p)), `${nm} = ${fmt(R, 2)}`, { len: 3 * TH });
        }
        if (K.noseP) dims.aligned(W(K.noseFoot), W(K.noseP), 0, fmt(G.dist(K.noseFoot, K.noseP), 2), { side: -1 });
      }
    }
    if (bd.cross) crossingPrims(bd.cross, W, sec, sec.pmr).forEach(Pp);
    // Cotations de la branche, comme au giratoire : largeurs le / ls perpendiculaires aux voies, en amont du
    // raccordement, et rayons Re / Rs par flèche sur l'arc.
    for (const sd of [bd.entry, bd.exit]) {
      Pp({ k: 'cross', L: 'CONSTRUCTION', p: sd.C, size: 0.8 });
      Pp({ k: 'path', L: 'CONSTRUCTION', segs: [L(sd.C, sd.Tc), L(sd.C, sd.Tl)] });
      // Au-delà du passage piéton s'il y en a un.
      // La cote donne la largeur réellement construite, et la valeur demandée si elle diffère.
      let p1, p2, wr = sd.dimW ?? sd.w;
      if (sd.dim) [p1, p2] = sd.dim; // îlot ACI : au plus étroit de la voie, entre le flanc de l'îlot et la bordure
      else {
        const xs = Math.max(G.clamp(sd.fil.Tl.x + 2, x0 + 2, Math.max(x0 + 2, xT - 2)), bd.cross ? bd.cross.x2 + 1.5 : -Infinity);
        const pIsl = add(sd.H, mul(sd.dI, (xs - sd.H.x) / sd.dI.x));
        const mOut = sd.s > 0 ? rot90(sd.dI) : neg(rot90(sd.dI));
        wr = widthAlong(pIsl, mOut, sd.curb) ?? sd.w;
        [p1, p2] = sd.s > 0 ? [pIsl, add(pIsl, mul(mOut, wr))] : [add(pIsl, mul(mOut, wr)), pIsl];
      }
      const asked = Math.abs(wr - sd.w) > 0.05 ? ` (${fmt(sd.w, 2)} demandé)` : '';
      dims.aligned(W(p1), W(p2), 0, `${sd.s > 0 ? 'le' : 'ls'} = ${fmt(wr, 2)}${asked}`, { side: -1 });
      if (Math.abs(wr - sd.w) > 0.5) {
        const k = sd.s > 0 ? ['le', 'Re'] : ['ls', 'Rs'];
        issues.push({ lvl: 'warn', bi: bd.idx, msg: `${bd.name} : voie ${sd.s > 0 ? 'd\'entrée' : 'de sortie'} large de ${fmt(wr, 2)} m au plus étroit pour ${k[0]} = ${fmt(sd.w, 2)} m demandé — ${wr > sd.w ? `la bordure ne longe pas l'îlot (${k[1]} = ${fmt(sd.R, 1)} m trop grand pour la place disponible : réduire ${k[1]}, ou allonger l'îlot avec H, Ris / Rie)` : 'la bordure se rapproche de l\'îlot'}.` });
      }
      const mid = G.segAt(sd.fil.arc, 0.5);
      dims.radius(W(mid), norm(sub(sd.C, W(mid))), `${sd.s > 0 ? 'Re' : 'Rs'} = ${fmt(sd.R, 2)}`);
    }
    Pp({ k: 'path', L: 'AXE', segs: [L(W({ x: x0 - 1, y: 0 }), W({ x: xEnd + 3, y: 0 }))] });
    if (bd.stop) {
      // STOP : ligne continue de 0,50 m ; cédez-le-passage : T'2 de 0,50 m (0,50 / 0,50), en limite de chaussée prioritaire.
      const st = P.regime === 'stop' ? { wm: 0.5 } : { wm: 0.5, dash: [0.5, 0.5], lt: 'CLP' };
      Pp({ k: 'path', L: 'MARQUAGE', segs: [L(bd.stop.a, bd.stop.b)], ...st });
      const yLane = bd.entry.dim ? (bd.entry.dim[0].y + bd.entry.dim[1].y) / 2 : bd.hb + bd.entry.w / 2;
      text('MARQUAGE', W({ x: x0 + 4, y: yLane }), P.regime === 'stop' ? 'STOP' : 'CÉDEZ', bd.theta - Math.PI / 2, 'center', TH * 1.2);
    }
    // Axe de la secondaire : continu en amont de la queue de l'îlot (ou du triangle) puis discontinu
    const tailX = bd.island?.aci?.te && bd.island.aci.ts ? Math.max(bd.island.aci.te.A0.x, bd.island.aci.ts.A0.x) : xT;
    const xs = bd.island ? tailX : x0, xc = Math.min(xEnd, xs + 30);
    Pp({ k: 'path', L: 'MARQUAGE', segs: [L(W({ x: xs, y: 0 }), W({ x: xc, y: 0 }))], wm: 0.15 });
    if (xEnd > xc + 1) Pp({ k: 'path', L: 'MARQUAGE', segs: [L(W({ x: xc, y: 0 }), W({ x: xEnd, y: 0 }))], wm: 0.15, dash: [3, 10], lt: 'T1' });
    // Triangles de visibilité : œil à 2 m du bord droit de la branche, en arrière de la ligne ;
    // cible sur l'axe de la voie prioritaire, à D = V85 × t de part et d'autre.
    const Dv = (P.v85 / 3.6) * P.tVis;
    const yOut = cutAtX(bd.entry.curb, x0 + P.dObs)?.y;
    const obs = W({ x: x0 + P.dObs, y: yOut != null ? yOut - 2 : Math.max(bd.hb + 0.5, bd.hb + bd.entry.w - 2) });
    const om = toM(obs), sY = bd.sY;
    const tNear = toW(om.x + sY * Dv, sY * P.wLane / 2), tFar = toW(om.x - sY * Dv, -sY * P.wLane / 2);
    bd.vis = { obs, tNear, tFar, D: Dv };
    if (sec.visOn) {
      // Triangle œil – point de conflit sur la voie (même abscisse) – cible à D, de chaque côté (branche choisie seulement).
      const pN = toW(om.x, (sY * P.wLane) / 2), pF = toW(om.x, (-sY * P.wLane) / 2), pick = prj.section?.visBranch;
      for (const [t, p] of !pick || String(bd.id) === String(pick) ? [[tNear, pN], [tFar, pF]] : []) {
        Pp({ k: 'fill', L: 'VISIBILITE', role: 'vis', rings: [closedSegs([obs, p, t])] });
        Pp({ k: 'path', L: 'VISIBILITE', segs: [L(obs, t), L(t, p)] });
        Pp({ k: 'cross', L: 'VISIBILITE', p: t, size: 1.2 });
        dims.aligned(p, t, 0, `D = ${fmt(Dv, 0)} m`);
      }
      if (!pick || String(bd.id) === String(pick)) {
        Pp({ k: 'cross', L: 'VISIBILITE', p: obs, size: 0.8 });
        text('VISIBILITE', add(G.lerp(obs, tNear, 0.55), mul(bd.u, TH)), `visibilité ${bd.name} : ${fmt(P.tVis, 0)} s à ${fmt(P.v85, 0)} km/h`, ang(sub(tNear, obs)), 'center', TH * 0.75);
      }
      D.vis.push({ name: bd.name, obs: P.dObs, v85: P.v85, t: P.tVis, D: Dv });
    }
    // Étiquettes
    text('COTATION', W({ x: xEnd + 4 + 2 * TH, y: 0 }), bd.name, bd.theta + Math.PI / 2, 'center', TH * 1.6);
    text('COTATION', W({ x: xEnd + 4, y: 0 }), `${bd.gis} · ${fmt((bd.angle * 200) / Math.PI, 1)} gr / principale`, bd.theta + Math.PI / 2, 'center', TH * 0.9);
    if (bd.island?.aci) text('COTATION', W({ x: x0 + bd.h + 2 * TH, y: -1.5 * TH }), `îlot ACI : H = ${fmt(bd.h, 2)} · b1 = ${fmt(0.55 * bd.l, 2)} · b2 = ${fmt(1.45 * bd.l, 2)}`, bd.theta, 'left', TH * 0.7);
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
  const mainDims = (has, len, sg, Ld) => {
    const f = (X, Y) => toW(sg * X, sg * Y);
    if (!widened) {
      if (sg < 0) return;
      const Xc = -(Lm + 20);
      dims.chain([f(Xc, -half), f(Xc, 0), f(Xc, half)], 0, [voie(half), voie(half)]);
      return;
    }
    const Xal = -len, Xdep = Xal - Ldep, Xpre = Xdep - Lpre;
    const off = -2.2 * TH, lab = (s, v) => `${s} ${fmt(v, 1)}`;
    if (nz > 0) dims.aligned(f(Xdep, -nz / 2), f(Xdep, nz / 2), 0, `nez ${fmt(nz, 2)}`, { side: -1 });
    if (has) {
      const Xd = -Ld, Xc = Xd - Ls, Xs = Xc - Lsif, Xm = (Xd + Xc) / 2;
      dims.chain([f(Xm, -hw), f(Xm, -c / 2), f(Xm, c / 2 - a), f(Xm, c / 2), f(Xm, hw)], 0, [voie(half), `TAG ${fmt(P.tag.width, 2)}`, `îlot ${fmt(a, 2)}`, voie(half)]);
      dims.chain([f(Xpre, -hw), f(Xdep, -hw), f(Xal, -hw), f(Xs, -hw), f(Xc, -hw), f(Xd, -hw)], off,
        [lab('présignalisation', Lpre), lab('déport', Ldep), lab('alignement', Lal), lab('sifflet', Lsif), lab('stockage', Ls)]);
    } else {
      const Xm = (Xal - Ld) / 2;
      dims.chain([f(Xm, -hw), f(Xm, -c / 2), f(Xm, c / 2), f(Xm, hw)], 0, [voie(half), `îlot ${fmt(c, 2)}`, voie(half)]);
      dims.chain([f(Xpre, -hw), f(Xdep, -hw), f(Xal, -hw)], off, [lab('présignalisation', Lpre), lab('déport', Ldep)]);
    }
  };
  mainDims(tagA, lenA, 1, LdA);
  mainDims(tagB, lenB, -1, LdB);

  // ================= Points d'implantation =================
  const pt = (name, p, bi = null, k = '') => points.push({ n: points.length + 1, name, p, bi, kind: k });
  pt('Centre du carrefour', O, null, 'centre');
  for (const sg of [-1, 1]) {
    const side = sg > 0 ? 'gauche' : 'droit';
    edges[sg].forEach((q, k) => pt(`Principale · bord ${side} · sommet ${k + 1}`, toW(q.x, q.y), null, 'principale'));
  }
  const zonePts = (has, len, sg, nm, Ld) => {
    if (!widened) return;
    const X = (v) => sg * v;
    const list_ = has
      ? [['début présignalisation', len + Ldep + Lpre], ['début déport', len + Ldep], ['fin déport', len], ['début sifflet', Ld + Ls + Lsif], ['début stockage', Ld + Ls], ['fin de stockage', Ld]]
      : [['début présignalisation', len + Ldep + Lpre], ['début déport', len + Ldep], ['fin déport', len]];
    list_.forEach(([lab, v]) => pt(`Principale · axe · ${lab} (côté ${nm})`, toW(X(v), 0), null, 'principale'));
  };
  zonePts(tagA, lenA, -1, A0.b.name, LdA);
  zonePts(tagB, lenB, 1, B0.b.name, LdB);
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
