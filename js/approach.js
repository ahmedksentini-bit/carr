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
  if (cfg.hasIsland && target.kind === 'line' && th <= 0) island = dropIsland(cfg, issues);
  else if (cfg.hasIsland) {
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

// Îlot de branche secondaire d'un carrefour plan (ACI) : goutte d'eau définie par ses bordures — triangle de base b
// au bord de la principale et de hauteur h, tête arrondie (rHead) en retrait de `gap`, pointe arrondie (rTip).
// La peinture suit la même forme : rive à la BDG autour de l'îlot en saillie, ou contour de l'îlot peint et zébra.
function dropIsland(cfg, issues) {
  const { name, idx, target, ai, x0, xT, hb, isl } = cfg;
  const head = offsetTarget(target, isl.gap);
  const Hi = { x: x0, y: ai + hb }, Ho = { x: x0, y: ai - hb }, Tp = { x: xT, y: ai };
  const di = norm(sub(Hi, Tp)), dO = norm(sub(Ho, Tp));
  let mi = rot90(di); if (mi.y > 0) mi = neg(mi);
  let mo = rot90(dO); if (mo.y < 0) mo = neg(mo);
  const vi = G.lineLine(Tp, di, head.p, head.d), vo = G.lineLine(Tp, dO, head.p, head.d);
  const maxT = vi && vo ? Math.max(0.05, G.dist(vi.p, vo.p) / 2) : 1e4;
  const fi = filletToTarget(Tp, di, mi, head, isl.rHead, maxT), fo = filletToTarget(Tp, dO, mo, head, isl.rHead, maxT);
  if (!(fi && fo && fi.t > 0 && fo.t > 0)) {
    issues.push({ lvl: 'warn', bi: idx, msg: `${name} : îlot séparateur trop petit pour être dessiné (vérifier base et longueur).` });
    return null;
  }
  // Pointe très effilée (b ≪ h) : rayon réduit pour que l'arrondi n'occupe pas plus de 1,5 m de chaque côté.
  const half = Math.acos(G.clamp(dot(di, dO), -1, 1)) / 2;
  const tip = G.filletCorner(fo.Tl, Tp, fi.Tl, Math.min(isl.rTip, 1.5 * Math.tan(half)), 0.45, 0.45);
  const hs = G.dist(fi.Tc, fo.Tc) > 1e-6 ? [L(fi.Tc, fo.Tc)] : [];
  const outline = [...(tip ? [L(fo.Tl, tip.T1), tip.arc, L(tip.T2, fi.Tl)] : [L(fo.Tl, Tp), L(Tp, fi.Tl)]), fi.arc, ...hs, G.revSeg(fo.arc)];
  const tipP = tip ? G.segAt(tip.arc, 0.5) : Tp;
  const ccw = G.polyArea(G.samplePath(outline, 0.5)) > 0; // à gauche du contour = intérieur si sens trigonométrique
  const base = { closed: true, tip: tipP, headIn: fi.Tc, headOut: fo.Tc };
  if (isl.type === 'peint') return { ...base, outline: null, curb: null, paint: [outline], hatch: [G.samplePath(outline, 0.3)] };
  const g = Math.max(0, isl.bdg || 0);
  const paint = g > 0 ? [G.offsetPath(outline, ccw ? -g : g)].filter((p) => p.length) : [];
  return { ...base, outline, curb: outline, paint, hatch: null };
}
