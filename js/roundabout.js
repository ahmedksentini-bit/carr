// roundabout.js — construction géométrique du giratoire (plan d'implantation).
// Repère local d'une branche : origine au centre O de l'anneau, x le long de l'axe vers l'extérieur,
// y vers la gauche (vu depuis le centre). L'entrée est du côté +y, la sortie du côté −y
// (circulation à droite, anneau parcouru dans le sens trigonométrique).
import * as G from './geom.js';
import { islandDims } from './norms.js';
import { addDevers } from './devers.js';

const { add, sub, mul, dot, norm, rot90, neg, dist, ang, polar, L, A } = G;
const O0 = { x: 0, y: 0 };

export const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '—');
export const toGon = (rad) => G.normAng(Math.PI / 2 - rad) * 200 / Math.PI; // gisement depuis le Nord, sens horaire
export const toDegGis = (rad) => G.normAng(Math.PI / 2 - rad) * 180 / Math.PI;
export const fmtGis = (rad, unit) => (unit === 'deg' ? fmt(toDegGis(rad), 2) + '°' : fmt(toGon(rad), 3) + ' gr');
const upright = (r) => { r = G.normAng(r); return r > Math.PI / 2 && r <= 1.5 * Math.PI ? r - Math.PI : r; };

// Oriente une polyligne de l'extrémité la plus proche de O vers la plus éloignée.
function nearFar(axis, O) {
  return G.dist(axis[0], O) <= G.dist(axis[axis.length - 1], O) ? axis : axis.slice().reverse();
}

// Centre automatique : point le plus proche, au sens des moindres carrés, des axes saisis
// (droite portée par le segment de chaque axe le plus proche du centre).
export function autoCenter(branches) {
  const ax = branches.filter((b) => b.axis && b.axis.length >= 2);
  if (!ax.length) return null;
  if (ax.length === 1) return { ...ax[0].axis[ax[0].axis.length - 1] };
  let O = { x: 0, y: 0 }, k = 0;
  for (const b of ax) for (const p of [b.axis[0], b.axis[b.axis.length - 1]]) { O.x += p.x; O.y += p.y; k++; }
  O = { x: O.x / k, y: O.y / k };
  for (let it = 0; it < 6; it++) {
    let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
    const ends = [];
    for (const b of ax) {
      const pl = nearFar(b.axis, O), p = pl[0], d = norm(sub(pl[1], pl[0]));
      ends.push(p);
      const m11 = 1 - d.x * d.x, m12 = -d.x * d.y, m22 = 1 - d.y * d.y;
      a11 += m11; a12 += m12; a22 += m22; b1 += m11 * p.x + m12 * p.y; b2 += m12 * p.x + m22 * p.y;
    }
    const det = a11 * a22 - a12 * a12;
    if (Math.abs(det) < 1e-6 * ax.length) { // axes parallèles : milieu des extrémités proches
      O = ends.reduce((s, p) => ({ x: s.x + p.x / ends.length, y: s.y + p.y / ends.length }), { x: 0, y: 0 });
      break;
    }
    O = { x: (a22 * b1 - a12 * b2) / det, y: (a11 * b2 - a12 * b1) / det };
  }
  return O;
}

function circleCircle(c1, r1, c2, r2) {
  const d = G.dist(c1, c2);
  if (d < 1e-9 || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const e = norm(sub(c2, c1)), m = add(c1, mul(e, a)), p = rot90(e);
  return [add(m, mul(p, h)), sub(m, mul(p, h))];
}

export function buildDesign(prj) {
  const ring = prj.ring;
  const Rg = +ring.Rg, la = +ring.la, bf = +ring.bf || 0;
  const Ri = Rg - la, Rb = Ri - bf;
  const unit = prj.opts?.angleUnit || 'gon';
  const TH = +prj.opts?.textH || 0.8;
  const issues = [], prims = [], points = [], bds = [];
  const D = { ok: false, O: null, Rg, la, bf, Ri, Rb, branches: bds, prims, points, issues };

  let O = prj.center.auto ? autoCenter(prj.branches) : null;
  if (!O && prj.center.x != null) O = { x: +prj.center.x, y: +prj.center.y };
  if (!O) return D;
  D.O = O;
  if (!(Rg > 0) || !(Ri > 0)) { issues.push({ lvl: 'err', msg: 'Rayons incohérents : il faut Rg > la (Ri = Rg − la > 0).' }); return D; }
  if (Rb <= 0) issues.push({ lvl: 'err', msg: 'Bande franchissable plus large que l\'îlot central.' });

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
    const pl = nearFar(b.axis, O);
    const far = pl[pl.length - 1];
    if (G.dist(far, O) < Rg + 5) { issues.push({ lvl: 'err', bi: idx, msg: `${name} : l'axe saisi doit sortir de l'anneau (> Rg + 5 m).` }); return; }
    const Rd = Rg + h + 10;
    let Q = far, segDir = norm(sub(pl[pl.length - 1], pl[pl.length - 2]));
    if (G.dist(pl[0], O) >= Rd) { Q = pl[0]; segDir = norm(sub(pl[1], pl[0])); }
    else {
      for (let i = 0; i < pl.length - 1; i++) {
        const p = pl[i], q = pl[i + 1];
        if (G.dist(q, O) < Rd) continue;
        const d = norm(sub(q, p)), ts = G.lineCircle(p, d, O, Rd);
        if (ts.length) { Q = add(p, mul(d, ts[1])); segDir = d; }
        break;
      }
    }
    let u, a;
    if (b.radial !== false) { u = norm(sub(Q, O)); a = 0; }
    else {
      u = dot(segDir, sub(Q, O)) < 0 ? neg(segDir) : segDir;
      a = dot(sub(Q, O), rot90(u));
      if (Math.abs(a) > Rg * 0.6) { issues.push({ lvl: 'err', bi: idx, msg: `${name} : axe trop excentré (${fmt(a)} m) — axe radial utilisé.` }); u = norm(sub(Q, O)); a = 0; }
    }
    const theta = ang(u), n = rot90(u);
    const W = (p) => ({ x: O.x + u.x * p.x + n.x * p.y, y: O.y + u.y * p.x + n.y * p.y });
    const Ws = (s) => (s.t === 'L' ? L(W(s.a), W(s.b)) : A(W(s.c), s.r, s.sa + theta, s.ea + theta, s.ccw));
    const Wp = (p) => p.map(Ws);

    const x0 = Math.sqrt(Rg * Rg - a * a), xT = x0 + h;
    // Axe du triangle de construction (décalé vers la gauche de l'usager entrant, ACI).
    const ai = hasIsland && !th && isl.type !== 'aucun' ? a - isl.shift : a;
    const flare = Math.max(0, hb + Math.max(le, ls) + Math.abs(ai - a) - th - Math.min(wIn, wOut));
    // Longueur dessinée par défaut : jusqu'à l'extrémité de l'axe saisi, bornée à 40–80 m au-delà de l'îlot.
    let xEnd = b.length ? x0 + +b.length : Math.min(Math.max(dot(sub(far, O), u), xT + 40), xT + 80);
    xEnd = Math.max(xEnd, xT + Math.max(10, 15 * flare) + 20);

    // --- Bord extérieur d'une voie (entrée s=+1 / sortie s=−1) et raccordement à l'anneau
    const side = (s, w, wa, R, label) => {
      const H = { x: x0, y: ai + s * hb }, T = { x: xT, y: ai + s * th };
      const dI = norm(sub(T, H));
      const mOut = s > 0 ? rot90(dI) : neg(rot90(dI));
      const E1p = add(H, mul(mOut, w));
      const yE2 = a + s * (th + wa);
      const E1T = add(E1p, mul(dI, (xT - E1p.x) / dI.x));
      const delta = s * (E1T.y - yE2);
      const F = { x: xEnd, y: yE2 };
      const ctrl = [F];
      let lp, ld, lm;
      if (delta > 0.05) {
        ctrl.push({ x: xT + Math.max(10, 15 * delta), y: yE2 }, E1T);
        lp = E1T; ld = neg(dI); lm = mOut;
      } else {
        const hit = G.lineLine(E1p, dI, { x: 0, y: yE2 }, { x: 1, y: 0 });
        if (hit && hit.p.x > x0 + 0.5 && hit.p.x <= xT + 1e-6) { ctrl.push(hit.p); lp = hit.p; ld = neg(dI); lm = mOut; }
        else { lp = F; ld = { x: -1, y: 0 }; lm = { x: 0, y: s }; }
      }
      let fil = G.filletLineCircle(lp, ld, lm, O0, Rg, R);
      let reduced = false;
      while (fil && fil.t < 0 && ctrl.length >= 2) {
        const last = ctrl.pop(), prev = ctrl[ctrl.length - 1];
        lp = prev; ld = norm(sub(last, prev)); lm = rot90(ld); if (lm.y * s < 0) lm = neg(lm);
        fil = G.filletLineCircle(lp, ld, lm, O0, Rg, R);
        reduced = true;
      }
      if (!fil) { issues.push({ lvl: 'err', bi: idx, msg: `${name} : raccordement ${label} impossible (rayon ou largeur incompatibles).` }); return null; }
      if (reduced) issues.push({ lvl: 'warn', bi: idx, msg: `${name} : le rayon ${label} (${fmt(R, 1)} m) absorbe l'évasement ; la largeur ${label === 'd\'entrée' ? 'le' : 'ls'} réelle est supérieure à la valeur saisie.` });
      const pts = [...ctrl, fil.Tl];
      const curb = [...G.roundPolyline(pts, pts.map((_, i) => (i > 0 && i < pts.length - 1 ? isl.Rr : 0))), fil.arc];
      // Largeur réelle au droit de la rive de l'anneau (x = x0), perpendiculairement à l'axe :
      // supérieure à w, car le raccordement R commence en amont de l'anneau.
      let wRing = null;
      const sp = G.samplePath(curb, 0.2);
      for (let i = 0; i + 1 < sp.length; i++) {
        const p = sp[i], q = sp[i + 1];
        if ((p.x - x0) * (q.x - x0) <= 0 && p.x !== q.x) { const y = p.y + ((x0 - p.x) / (q.x - p.x)) * (q.y - p.y); wRing = s * (y - H.y); break; }
      }
      return { s, w, wa, R, H, T, dI, F, ctrl, fil, curb, wRing };
    };

    const en = side(+1, le, wIn, Re, 'd\'entrée');
    const ex = side(-1, ls, wOut, Rs, 'de sortie');
    if (!en || !ex) return;

    // --- Îlot séparateur (ou tête de TPC)
    let island = null;
    if (hasIsland) {
      const Rh = Rg + isl.gap;
      const Hi = { x: x0, y: ai + hb }, Ti = { x: xT, y: ai + th }, Ho = { x: x0, y: ai - hb }, To = { x: xT, y: ai - th };
      const di = norm(sub(Hi, Ti)), dO = norm(sub(Ho, To));
      let mi = rot90(di); if (mi.y > 0) mi = neg(mi);
      let mo = rot90(dO); if (mo.y < 0) mo = neg(mo);
      const fi = G.filletLineCircle(Ti, di, mi, O0, Rh, isl.rHead);
      const fo = G.filletLineCircle(To, dO, mo, O0, Rh, isl.rHead);
      if (fi && fo && fi.t > 0 && fo.t > 0) {
        let outline, curb;
        if (th <= 0) {
          const tip = G.filletCorner(fo.Tl, Ti, fi.Tl, isl.rTip, 0.45, 0.45);
          const headArc = A(O0, Rh, ang(fi.Tc), ang(fo.Tc), false);
          outline = tip
            ? [L(fo.Tl, tip.T1), tip.arc, L(tip.T2, fi.Tl), fi.arc, headArc, G.revSeg(fo.arc)]
            : [L(fo.Tl, Ti), L(Ti, fi.Tl), fi.arc, headArc, G.revSeg(fo.arc)];
          curb = outline;
          // Marquage de rive à 0,50 m des bordures (côtés et pointe ; parcours trigonométrique → vers la droite).
          const rive = [G.offsetPath(outline.slice(0, tip ? 3 : 2), -0.5)];
          island = { outline: Wp(outline), curb: Wp(curb), closed: true, tip: W(tip ? G.segAt(tip.arc, 0.5) : Ti), rive: rive.map(Wp) };
        } else {
          const Fo = { x: xEnd, y: a - th }, Fi = { x: xEnd, y: a + th };
          const headArc = A(O0, Rh, ang(fo.Tc), ang(fi.Tc), true);
          const eOut = G.roundPolyline([Fo, To, fo.Tl], [0, 20, 0]), eIn = G.roundPolyline([fi.Tl, Ti, Fi], [0, 20, 0]);
          curb = [...eOut, fo.arc, headArc, G.revSeg(fi.arc), ...eIn];
          outline = [...curb, L(Fi, Fo)];
          island = { outline: Wp(outline), curb: Wp(curb), closed: false, rive: [G.offsetPath(eOut, 0.5), G.offsetPath(eIn, 0.5)].map(Wp) };
        }
        island.headIn = W(fi.Tc); island.headOut = W(fo.Tc);
      } else issues.push({ lvl: 'warn', bi: idx, msg: `${name} : îlot séparateur trop petit pour être dessiné (vérifier base / longueur).` });
    }

    // --- Ligne de cédez-le-passage (bande de 0,50 m le long de l'anneau)
    const ry = Rg + 0.25;
    const startOnEdge = (sd) => {
      const ts = G.lineCircle(sd.H, neg(sd.dI), O0, ry);
      if (!ts.length) return null;
      const t = Math.abs(ts[0]) < Math.abs(ts[1]) ? ts[0] : ts[1];
      return add(sd.H, mul(neg(sd.dI), t));
    };
    // Fin de la bande : intersection du cercle Rg + 0,25 avec l'arc de raccordement lui-même
    // (celle qui est du côté de l'axe ; l'autre est sur le prolongement du cercle, au-delà de Tc).
    const onArc = (sd, R) => circleCircle(O0, ry, sd.fil.C, R).reduce((b, p) => (!b || Math.abs(ang(p)) < Math.abs(ang(b)) ? p : b), null);
    const yieldStart = startOnEdge(en);
    const yieldEnd = onArc(en, Re);
    const exitStart = startOnEdge(ex);
    const exitEnd = onArc(ex, Rs);

    const bd = {
      idx, id: b.id, name, theta, u, n, a, ai, x0, xT, xEnd, h, b: isl.b, hb, th, isl, W, Ws, Wp,
      entry: { ...en, curbW: Wp(en.curb), Tc: W(en.fil.Tc), Tl: W(en.fil.Tl), C: W(en.fil.C), F: W(en.F) },
      exit: { ...ex, curbW: Wp(ex.curb), Tc: W(ex.fil.Tc), Tl: W(ex.fil.Tl), C: W(ex.fil.C), F: W(ex.F) },
      island, yieldStart, yieldEnd, exitStart, exitEnd, gis: fmtGis(theta, unit),
    };
    bd.entry.phiTc = ang(sub(bd.entry.Tc, O));
    bd.exit.phiTc = ang(sub(bd.exit.Tc, O));
    bds.push(bd);
  });

  bds.sort((p, q) => G.normAng(p.theta) - G.normAng(q.theta));
  D.ok = true;
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
