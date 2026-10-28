// approach.js — construction locale d'une branche, commune au giratoire et aux carrefours en T / X.
// Repère de la branche : origine au centre du carrefour, x vers l'extérieur le long de l'axe, y à gauche.
// Les bords extérieurs des voies d'entrée (y > 0) et de sortie (y < 0) longent l'îlot séparateur puis se
// raccordent à une « cible » : le cercle extérieur de l'anneau, ou le bord de la chaussée principale.
import * as G from './geom.js';
import { fmt, circleCircle } from './common.js';

const { add, sub, mul, dot, norm, rot90, neg, ang, L, A } = G;
const O0 = { x: 0, y: 0 };

// Cible : { kind: 'circle', R } centrée à l'origine, ou { kind: 'line', p, d } (d unitaire).
// Cible décalée de `gap` vers la branche (tête d'îlot, ligne transversale).
export function offsetTarget(tg, gap) {
  if (tg.kind === 'circle') return { kind: 'circle', R: tg.R + gap };
  let nb = rot90(tg.d);
  if (nb.x < 0) nb = neg(nb);
  return { kind: 'line', p: add(tg.p, mul(nb, gap)), d: tg.d };
}

// Raccordement de rayon R entre la droite (lp, ld), parcourue vers la cible, et la cible ;
// lm : côté où se trouve le centre. maxT borne la longueur de tangence le long d'une cible droite.
export function filletToTarget(lp, ld, lm, tg, R, maxT = 1e4) {
  if (tg.kind === 'circle') return G.filletLineCircle(lp, ld, lm, O0, tg.R, R);
  const hit = G.lineLine(lp, ld, tg.p, tg.d);
  if (!hit) return null;
  const V = hit.p, dm = dot(tg.d, lm) >= 0 ? tg.d : neg(tg.d);
  const f = G.filletCorner(sub(V, mul(ld, 1e4)), V, add(V, mul(dm, 2 * maxT)), R, 1, 0.5);
  return f && { C: f.C, Tl: f.T1, Tc: f.T2, t: dot(sub(f.T1, lp), ld), r: f.r, arc: f.arc };
}

// Largeur réelle d'une voie : distance du point p (bord de l'îlot) à la bordure, le long de la direction unitaire m.
export function widthAlong(p, m, curb) {
  const pts = G.samplePath(curb, 0.2);
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const e = sub(pts[i + 1], pts[i]), h = G.lineLine(p, m, pts[i], e);
    if (!h || h.t <= 0) continue;
    const u = dot(sub(h.p, pts[i]), e) / dot(e, e);
    if (u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, h.t);
  }
  return Number.isFinite(best) ? best : null;
}

// Point le plus étroit de la voie entre le flanc de l'îlot et la bordure : { p (îlot), q (bordure), d }.
// Si la largeur minimale règne sur une longueur (bordure parallèle), on prend le milieu de ce tronçon.
export function narrowest(flank, curb) {
  const cs = G.samplePath(curb, 0.2);
  const ms = G.samplePath(flank, 0.25).map((p) => {
    let best = { p, q: null, d: Infinity };
    for (let i = 0; i + 1 < cs.length; i++) {
      const a = cs[i], ab = sub(cs[i + 1], a), q = add(a, mul(ab, G.clamp(dot(sub(p, a), ab) / (dot(ab, ab) || 1), 0, 1))), d = G.dist(p, q);
      if (d < best.d) best = { p, q, d };
    }
    return best;
  });
  const dmin = Math.min(...ms.map((m) => m.d)), ok = ms.filter((m) => m.d <= dmin + 0.01);
  return ok.length && ok[0].q ? ok[Math.floor(ok.length / 2)] : null;
}

// Abscisse x0 où l'axe (y = a) rencontre la cible.
export function targetX0(tg, a) {
  if (tg.kind === 'circle') return Math.sqrt(Math.max(0, tg.R * tg.R - a * a));
  const hit = G.lineLine({ x: 0, y: a }, { x: 1, y: 0 }, tg.p, tg.d);
  return hit ? hit.t : NaN;
}

// Ligne transversale (cédez-le-passage, STOP) : bande centrée à `off` de la cible, du bord de l'îlot
// (ou de l'axe) jusqu'au bord extérieur de la voie.
export function crossLine(sd, tg, off) {
  const t2 = offsetTarget(tg, off);
  let a = null, b = null;
  if (t2.kind === 'circle') {
    const ts = G.lineCircle(sd.H, neg(sd.dI), O0, t2.R);
    if (ts.length) a = add(sd.H, mul(neg(sd.dI), Math.abs(ts[0]) < Math.abs(ts[1]) ? ts[0] : ts[1]));
    b = circleCircle(O0, t2.R, sd.fil.C, sd.R).reduce((m, p) => (!m || Math.abs(p.y) < Math.abs(m.y) ? p : m), null);
  } else {
    const h = G.lineLine(sd.H, sd.dI, t2.p, t2.d);
    if (h) a = h.p;
    const ts = G.lineCircle(t2.p, t2.d, sd.fil.C, sd.R).map((t) => add(t2.p, mul(t2.d, t)));
    b = ts.reduce((m, p) => (!m || Math.abs(p.y) < Math.abs(m.y) ? p : m), null);
  }
  return a && b ? { a, b } : null;
}

// cfg : { name, idx, target, a, ai, x0, xT, xEnd, hb, th, hasIsland, isl, le, ls, wIn, wOut, Re, Rs, labels }
// Retourne { en, ex, island } en coordonnées locales, ou null (les anomalies sont ajoutées à `issues`).
export function buildApproach(cfg, issues) {
  const { name, idx, target, a, ai, x0, xT, xEnd, hb, th, isl } = cfg;
  const lab = cfg.labels || { en: 'd\'entrée', ex: 'de sortie' };

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
    let fil = filletToTarget(lp, ld, lm, target, R);
    let reduced = false;
    while (fil && fil.t < 0 && ctrl.length >= 2) {
      const last = ctrl.pop(), prev = ctrl[ctrl.length - 1];
      lp = prev; ld = norm(sub(last, prev)); lm = rot90(ld); if (lm.y * s < 0) lm = neg(lm);
      fil = filletToTarget(lp, ld, lm, target, R);
      reduced = true;
    }
    if (!fil) { issues.push({ lvl: 'err', bi: idx, msg: `${name} : raccordement ${label} impossible (rayon ou largeur incompatibles).` }); return null; }
    if (reduced) issues.push({ lvl: cfg.flareLvl || 'warn', bi: idx, msg: `${name} : le rayon ${label} (${fmt(R, 1)} m) absorbe l'évasement ; la largeur ${s > 0 ? 'le' : 'ls'} réelle est supérieure à la valeur saisie.` });
    const pts = [...ctrl, fil.Tl];
    const curb = [...G.roundPolyline(pts, pts.map((_, i) => (i > 0 && i < pts.length - 1 ? isl.Rr : 0))), fil.arc];
    // Largeur réelle au droit de la cible (x = x0), perpendiculairement à l'axe :
    // supérieure à w, car le raccordement R commence en amont.
    let wRing = null;
    const sp = G.samplePath(curb, 0.2);
    for (let i = 0; i + 1 < sp.length; i++) {
      const p = sp[i], q = sp[i + 1];
      if ((p.x - x0) * (q.x - x0) <= 0 && p.x !== q.x) { const y = p.y + ((x0 - p.x) / (q.x - p.x)) * (q.y - p.y); wRing = s * (y - H.y); break; }
    }
    return { s, w, wa, R, H, T, dI, F, ctrl, fil, curb, wRing };
  };

  const en = side(+1, cfg.le, cfg.wIn, cfg.Re, lab.en);
  const ex = side(-1, cfg.ls, cfg.wOut, cfg.Rs, lab.ex);
  if (!en || !ex) return null;

  // --- Îlot séparateur (ou tête de TPC). Enveloppe peinte = triangle de construction (rives gauches des voies
  // d'entrée et de sortie) ; îlot en saillie en retrait de la BDG de cette enveloppe ; zébra entre les deux.
  let island = null;
  if (cfg.hasIsland) {
    const head = offsetTarget(target, isl.gap);
    const g = Math.max(0, isl.bdg || 0);
    const Hi0 = { x: x0, y: ai + hb }, Ti0 = { x: xT, y: ai + th }, Ho0 = { x: x0, y: ai - hb }, To0 = { x: xT, y: ai - th };
    const di = norm(sub(Hi0, Ti0)), dO = norm(sub(Ho0, To0));
    let mi = rot90(di); if (mi.y > 0) mi = neg(mi);
    let mo = rot90(dO); if (mo.y < 0) mo = neg(mo);
    // Rives de l'enveloppe peinte, de la rive de la cible (anneau ou chaussée principale) jusqu'à la pointe.
    const onTarget = (p, d) => {
      if (target.kind === 'circle') { const ts = G.lineCircle(p, d, O0, target.R); return ts.length ? add(p, mul(d, ts[0])) : null; }
      const h = G.lineLine(p, d, target.p, target.d);
      return h ? h.p : null;
    };
    const pIn = onTarget(Ti0, di), pOut = onTarget(To0, dO);
    const paint = th <= 0
      ? (pIn && pOut ? [[L(pIn, Ti0), L(Ti0, pOut)]] : [])
      : [pIn ? [L(pIn, Ti0), L(Ti0, { x: xEnd, y: a + th })] : [], pOut ? [L(pOut, To0), L(To0, { x: xEnd, y: a - th })] : []];
    // Zone de l'enveloppe (fermée le long de la rive de la cible), pour le zébra.
    let envelope = null;
    if (th <= 0 && pIn && pOut) {
      const back = target.kind === 'circle'
        ? G.samplePath([A(O0, target.R, ang(pOut), ang(pIn), true)], 0.5)
        : [pOut, pIn];
      envelope = [pIn, Ti0, ...back];
    }
    if (isl.type === 'peint' && th <= 0) {
      island = envelope ? { outline: null, curb: null, closed: true, paint, hatch: [envelope], tip: Ti0, headIn: pIn, headOut: pOut } : null;
    } else {
      // Bords de l'îlot en saillie : rives décalées de la BDG vers l'intérieur ; pointe à leur intersection.
      let Ti = add(Ti0, mul(mi, g)), To = add(To0, mul(mo, g));
      if (th <= 0) {
        const hx = G.lineLine(Ti, di, To, dO);
        if (hx) { Ti = hx.p; To = hx.p; }
      }
      // Sur une cible droite, la tête peut être entièrement arrondie (goutte d'eau) : tangences bornées à mi-largeur.
      let maxT = 1e4;
      if (head.kind === 'line') {
        const vi = G.lineLine(Ti, di, head.p, head.d), vo = G.lineLine(To, dO, head.p, head.d);
        if (vi && vo) maxT = Math.max(0.05, G.dist(vi.p, vo.p) / 2);
      }
      const fi = filletToTarget(Ti, di, mi, head, isl.rHead, maxT);
      const fo = filletToTarget(To, dO, mo, head, isl.rHead, maxT);
      const headSeg = (p, q, ccw) => (head.kind === 'circle' ? A(O0, head.R, ang(p), ang(q), ccw) : G.dist(p, q) > 1e-6 ? L(p, q) : null);
      if (fi && fo && fi.t > 0 && fo.t > 0 && Ti.x > x0) {
        let outline, curb, tipP = null;
        if (th <= 0) {
          const tip = G.filletCorner(fo.Tl, Ti, fi.Tl, isl.rTip, 0.45, 0.45);
          const hs = headSeg(fi.Tc, fo.Tc, false);
          outline = [...(tip ? [L(fo.Tl, tip.T1), tip.arc, L(tip.T2, fi.Tl)] : [L(fo.Tl, Ti), L(Ti, fi.Tl)]), fi.arc, ...(hs ? [hs] : []), G.revSeg(fo.arc)];
          curb = outline;
          tipP = tip ? G.segAt(tip.arc, 0.5) : Ti;
        } else {
          const Fo = { x: xEnd, y: To.y }, Fi = { x: xEnd, y: Ti.y };
          const hs = headSeg(fo.Tc, fi.Tc, true);
          const eOut = G.roundPolyline([Fo, To, fo.Tl], [0, 20, 0]), eIn = G.roundPolyline([fi.Tl, Ti, Fi], [0, 20, 0]);
          curb = [...eOut, fo.arc, ...(hs ? [hs] : []), G.revSeg(fi.arc), ...eIn];
          outline = [...curb, L(Fi, Fo)];
        }
        // Zébra : pointe peinte en avant du nez de l'îlot en saillie (les bandes latérales de BDG restent nues).
        let hatch = null;
        if (th <= 0 && envelope) {
          const tx = (tipP || Ti).x;
          const at = (H0, T0) => G.lerp(H0, T0, (tx - H0.x) / (T0.x - H0.x));
          if (tx < Ti0.x - 0.05) hatch = [[at(Hi0, Ti0), Ti0, at(Ho0, To0)]];
        }
        island = { outline, curb, closed: th <= 0, paint, hatch, tip: tipP, headIn: fi.Tc, headOut: fo.Tc };
      } else issues.push({ lvl: 'warn', bi: idx, msg: `${name} : îlot séparateur trop petit pour être dessiné en saillie (vérifier base, longueur et BDG).` });
    }
  }
  return { en, ex, island };
}

// ---------------------------------------------------------------------------------------------------------------
// Branche secondaire d'un carrefour plan selon l'ACI (§3.2 et 3.3, Fig. 24 et 25, Tableau 8). Repère local de la
// branche : x le long de l'axe vers l'extérieur, y à gauche (voie d'entrée, y > 0).
// - Triangle de construction : hauteur H = 4l sur un axe décalé de 0,50 m vers la sortie, base sur le bord de la
//   principale, demi-bases b1 = 0,55l côté sortie et b2 = 1,45l côté entrée.
// - Enveloppe peinte de l'îlot : bord côté sortie = cercle de giration Ris (tourne-à-gauche principale → secondaire),
//   bord côté entrée = cercle Rie (tourne-à-gauche secondaire → principale). Chaque cercle est inscrit dans le
//   triangle (tangent au côté correspondant) et tangent au bord de voie de la principale qu'il longe : bord gauche
//   de la voie de TAG pour Ris (Ris = 2l + a), bord gauche des voies directes opposées pour Rie (Rie = 2l + b).
//   Queue raccordée à l'axe de la secondaire par Rre ≈ 8l (entrée) et Rrs ≈ 16l (sortie).
// - Îlot en saillie : enveloppe en retrait de la BDG, nez côté principale à 1,50 m de la rive, nez amont de 1 m.
// - Bordures : parallèles aux bords de l'îlot à le / ls, raccordées au bord de la principale par Re = 2l / Rs = 4l
//   et à la chaussée courante de la secondaire par un rayon Rr.
// aci : { H, b1, b2, off, Ris, Rie, lineIs, lineIe ({ p, d, n }, n vers la branche), Rre, Rrs, rn, nose, g }.

const arcPQ = (c, r, p, q) => A(c, r, ang(sub(p, c)), ang(sub(q, c)), G.cross(sub(p, c), sub(q, c)) > 0);
const onCircle = (c, r, toward) => add(c, mul(norm(sub(toward, c)), r));

// Cercles de giration Ris / Rie de l'îlot et triangle de construction, en repère local.
export function aciCircles(target, aci) {
  const yt = -aci.off, x0t = targetX0(target, yt);
  const apex = { x: x0t + aci.H, y: yt }, Pe = { x: x0t, y: yt + aci.b2 }, Ps = { x: x0t, y: yt - aci.b1 };
  const sideLine = (P, Q, inside) => { const d = norm(sub(Q, P)); let n = rot90(d); if (dot(n, sub(inside, P)) < 0) n = neg(n); return { p: P, d, n }; };
  const off = (ln, r) => ({ p: add(ln.p, mul(ln.n, r)), d: ln.d });
  const cut = (l1, l2) => G.lineLine(l1.p, l1.d, l2.p, l2.d)?.p || null;
  const Cs = cut(off(aci.lineIs, aci.Ris), off(sideLine(Ps, apex, Pe), aci.Ris));
  const Ce = cut(off(aci.lineIe, aci.Rie), off(sideLine(Pe, apex, Ps), aci.Rie));
  return Cs && Ce ? { Cs, Ce, Ris: aci.Ris, Rie: aci.Rie, tri: [Pe, apex, Ps] } : null;
}

export function aciBranch(cfg, issues) {
  const { name, idx, target, xEnd, isl, le, ls, wIn, wOut, Re, Rs, aci } = cfg;
  const fail = (msg) => { issues.push({ lvl: 'err', bi: idx, msg: `${name} : ${msg}` }); return null; };
  const K = aciCircles(target, aci);
  if (!K) return fail('îlot ACI impossible (cercles de giration Ris / Rie parallèles au triangle).');
  const { Cs, Ce, Ris, Rie } = K;
  let nT = rot90(target.d);
  if (nT.x < 0) nT = neg(nT);
  const sd = (p) => dot(sub(p, target.p), nT); // distance au bord de la principale, positive vers la branche
  const pair = circleCircle(Cs, Ris, Ce, Rie);
  if (pair.length < 2) return fail(`les cercles Ris = ${fmt(Ris, 1)} m et Rie = ${fmt(Rie, 1)} m ne se recoupent pas : îlot impossible.`);
  const [tipLow, tipHigh] = sd(pair[0]) < sd(pair[1]) ? pair : [pair[1], pair[0]];

  // Enveloppe peinte : lentille Ris ∩ Rie et queue Rre / Rrs tangente à l'axe (y = 0).
  const tail = (C, R, Rr, s) => {
    const dy = s * Rr - C.y, h2 = (Rr + R) ** 2 - dy * dy;
    if (h2 <= 0) return null;
    const Q = { x: C.x + Math.sqrt(h2), y: s * Rr };
    return { Q, Rr, T: onCircle(C, R, Q), A0: { x: Q.x, y: 0 } };
  };
  const te = tail(Ce, Rie, aci.Rre, 1), ts = tail(Cs, Ris, aci.Rrs, -1);
  const tailOk = te && ts && sd(te.T) < sd(tipHigh) && sd(ts.T) < sd(tipHigh);
  const envelope = tailOk
    ? [arcPQ(Ce, Rie, tipLow, te.T), arcPQ(te.Q, te.Rr, te.T, te.A0), ...(G.dist(te.A0, ts.A0) > 1e-6 ? [L(te.A0, ts.A0)] : []),
      arcPQ(ts.Q, ts.Rr, ts.A0, ts.T), arcPQ(Cs, Ris, ts.T, tipLow)]
    : [arcPQ(Ce, Rie, tipLow, tipHigh), arcPQ(Cs, Ris, tipHigh, tipLow)];

  // Îlot en saillie : lentille en retrait de g, nez côté principale (rayon ajusté) à `nose` de la rive, nez amont rn.
  const g = Math.max(0, aci.g || 0), rs = Ris - g, re = Rie - g;
  const fillet = (r, low) => {
    const p = circleCircle(Cs, rs - r, Ce, re - r);
    if (p.length < 2) return null;
    return (sd(p[0]) < sd(p[1])) === low ? p[0] : p[1];
  };
  let rb = 1, Fb = fillet(rb, true);
  for (let lo = 0.5, hi = Math.min(rs, re) * 0.8, k = 0; k < 50 && lo < hi; k++) {
    const m = (lo + hi) / 2, F = fillet(m, true);
    if (!F) { hi = m; continue; }
    rb = m; Fb = F;
    if (sd(F) - m < aci.nose) lo = m; else hi = m;
  }
  const Ft = fillet(aci.rn, false);
  let raised = null, headIn = tipLow, headOut = tipLow, noseP = null;
  if (Fb && Ft && sd(Ft) > sd(Fb)) {
    const Teb = onCircle(Ce, re, Fb), Tsb = onCircle(Cs, rs, Fb), Tst = onCircle(Cs, rs, Ft), Tet = onCircle(Ce, re, Ft);
    raised = [arcPQ(Fb, rb, Teb, Tsb), arcPQ(Cs, rs, Tsb, Tst), arcPQ(Ft, aci.rn, Tst, Tet), arcPQ(Ce, re, Tet, Teb)];
    headIn = Teb; headOut = Tsb; noseP = sub(Fb, mul(nT, rb));
  } else if (isl.type !== 'peint') issues.push({ lvl: 'warn', bi: idx, msg: `${name} : îlot trop étroit pour être en saillie (nez de 1 m) : seule l'enveloppe peinte est dessinée.` });

  // Zébra : queue de l'enveloppe en amont du nez de l'îlot en saillie (ou toute l'enveloppe d'un îlot peint).
  const envPoly = G.samplePath(envelope, 0.3);
  let hatch = null;
  if (isl.type === 'peint' || !raised) hatch = [envPoly];
  else if (g > 0) {
    // Partie x ≥ xc d'un polygone (l'enveloppe et le trou de l'îlot sont coupés au même endroit).
    const xc = Ft.x, clip = (poly) => {
      const kept = [];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        if (p.x >= xc) kept.push(p);
        if ((p.x - xc) * (q.x - xc) < 0) kept.push(G.lerp(p, q, (xc - p.x) / (q.x - p.x)));
      }
      return kept.length >= 3 ? kept : null;
    };
    const env = clip(envPoly), hole = clip(G.samplePath(raised, 0.3));
    if (env) hatch = hole ? [env, hole] : [env];
  }
  const painted = isl.type === 'peint' || g > 0;
  const island = {
    closed: true, outline: isl.type === 'peint' ? null : raised, curb: isl.type === 'peint' ? null : raised,
    paint: painted ? [envelope] : [], hatch: painted ? hatch : null,
    tip: tailOk ? te.A0 : tipHigh, headIn, headOut,
    aci: { ...K, tipLow, tipHigh, te, ts, raised: !!raised, noseP, noseFoot: noseP && sub(noseP, mul(nT, sd(noseP))), H: aci.H },
  };

  // Bordures : parallèle au bord de l'îlot à la largeur de voie, raccordée à la chaussée courante (Rr) et au bord
  // de la principale (Re / Rs), arcs tangents.
  const Rr = isl.Rr || 8 * (wIn + wOut);
  const side = (s, w, wa, R, C, Rc, label, flank) => {
    const RK = Rc + w, yF = s * wa;
    let F = { x: xEnd, y: yF };
    // Raccordement à la principale : cercle de rayon R tangent au bord de la principale et extérieur au cercle K.
    const pl = add(target.p, mul(nT, R)), hits = G.lineCircle(pl, target.d, C, RK + R).map((t) => add(pl, mul(target.d, t)));
    if (!hits.length) return fail(`raccordement ${label} impossible (rayon ${fmt(R, 1)} m).`);
    const Fc = hits.reduce((m, p) => (!m || s * p.y > s * m.y ? p : m), null);
    const Tc = sub(Fc, mul(nT, R)), Tk = onCircle(C, RK, Fc);
    // Raccordement à la chaussée courante (y = s·wa) : arc de rayon Rr extérieur au cercle K.
    const dy = yF + s * Rr - C.y, h2 = (Rr + RK) ** 2 - dy * dy;
    let curb, ctrl, fil, kArc = false; // kArc : bordure parallèle à l'îlot (arc K) entre la transition et Re / Rs
    const Q = h2 > 0 ? { x: C.x + Math.sqrt(h2), y: yF + s * Rr } : null, T2 = Q && onCircle(C, RK, Q);
    const P1 = { x: C.x, y: C.y + s * RK }, P0 = { x: C.x + Math.max(10, 15 * s * (P1.y - yF)), y: yF };
    const flP1 = Q && T2.x <= Tk.x + 0.05 ? filletToTarget(P1, { x: -1, y: 0 }, { x: 0, y: s }, target, R) : null;
    if (flP1 && flP1.Tl.x < P0.x - 1) {
      // Le rayon Re / Rs englobe tout l'arc parallèle à l'îlot : bordure parallèle à l'axe au droit du point le plus
      // large de l'îlot (à w de son bord), évasement au 1/15 vers la chaussée courante, puis Re / Rs.
      const fl = flP1;
      F = { x: Math.max(xEnd, P0.x + 5), y: yF };
      const pts = fl.t > 0.05 ? [F, P0, P1, fl.Tl] : [F, P0, fl.Tl];
      curb = [...G.roundPolyline(pts, pts.map((_, i) => (i > 0 && i < pts.length - 1 ? Rr : 0))), fl.arc];
      ctrl = pts.slice(0, -1);
      fil = { C: fl.C, Tl: fl.Tl, Tc: fl.Tc, arc: fl.arc, r: R, t: fl.t };
    } else if (Q && s * (C.y + s * RK) > wa + 0.05 && T2.x > Tk.x + 0.05) {
      const T1 = { x: Q.x, y: yF };
      F = { x: Math.max(xEnd, T1.x + 5), y: yF };
      curb = [L(F, T1), arcPQ(Q, Rr, T1, T2), arcPQ(C, RK, T2, Tk), arcPQ(Fc, R, Tk, Tc)];
      ctrl = [F, T1, T2]; kArc = true;
      fil = { C: Fc, Tl: Tk, Tc, arc: curb[curb.length - 1], r: R, t: 1 };
    } else {
      // Îlot et voie tiennent dans la chaussée courante, ou rayon très grand : bordure droite, raccordée directement à
      // la principale (l'extrémité de la branche recule au-delà du point de tangence si nécessaire).
      const fl = filletToTarget(F, { x: -1, y: 0 }, { x: 0, y: s }, target, R);
      if (!fl) return fail(`raccordement ${label} impossible (rayon ${fmt(R, 1)} m).`);
      if (fl.Tl.x > F.x - 5) F = { x: fl.Tl.x + 5, y: yF };
      curb = [L(F, fl.Tl), fl.arc];
      ctrl = [F];
      fil = { C: fl.C, Tl: fl.Tl, Tc: fl.Tc, arc: fl.arc, r: R, t: fl.t };
    }
    const tipDir = norm(rot90(sub(tipLow, C))), dI = tipDir.x > 0 ? tipDir : neg(tipDir);
    // Cote le / ls : largeur réelle au plus étroit, entre le flanc de l'îlot (enveloppe peinte) et la bordure construite.
    const ext = { x: C.x, y: C.y + s * Rc }, nw = narrowest([flank], curb);
    const dim = nw ? (s > 0 ? [nw.p, nw.q] : [nw.q, nw.p]) : s > 0 ? [ext, add(ext, { x: 0, y: w })] : [add(ext, { x: 0, y: -w }), ext];
    return { s, w, wa, R, H: tipLow, T: ext, dI, F, ctrl, fil, curb, wRing: null, dim, dimW: nw ? nw.d : w, kArc };
  };
  const en = side(1, le, wIn, Re, Ce, Rie, 'côté entrée (Re)', envelope[0]);
  const ex = side(-1, ls, wOut, Rs, Cs, Ris, 'côté sortie (Rs)', envelope[envelope.length - 1]);
  return en && ex ? { en, ex, island } : null;
}
