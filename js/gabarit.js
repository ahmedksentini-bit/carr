// gabarit.js — tirant d'air sous les ouvrages de franchissement, dévers compris, sur tous les axes ayant un profil en
// long : autoroute, voies secondaires, bretelles et boucles.
//
// Définition retenue : hauteur libre = minimum, sur toute la largeur roulable de la voie franchie (chaussée, BAU / BDD
// et BDG revêtues) située sous l'emprise du tablier, de l'écart entre l'intrados et la surface de la chaussée franchie :
//   intrados(P)  = surface de la voie portée au droit de P (profil en long + dévers) − épaisseur du tablier ;
//   chaussée(P)  = surface de la voie franchie en P (profil en long + dévers).
// Avec un intrados horizontal, c'est l'intrados moins le point le plus haut de la voie franchie ; la forme générale
// reste juste quand le tablier suit le dévers ou la pente de la voie portée.
//
// Ouvrages traités : passages supérieurs des voies secondaires (x:…), tiges de trompette (t:… : la S-semi et la boucle
// portées), et croisements dénivelés entre axes sans tablier implanté (bretelle sur bretelle, bretelle sur voie
// secondaire…), pour lesquels l'emprise est la plate-forme revêtue de la voie haute + 0,50 m et l'épaisseur est supposée.
import * as G from './geom.js';
import { axisPlatform, axisType, typeParams } from './ptaxes.js';

const fmt = (v, k = 2) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(k).replace('.', ','));
export const H_GEN = 1.0; // épaisseur supposée d'un tablier non implanté (m)
const STEP = 0.5; // pas d'échantillonnage de la chaussée franchie (m)

// Point dans un polygone (anneau non fermé).
export function inPoly(w, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > w.y) !== (b.y > w.y) && w.x < ((b.x - a.x) * (w.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

// Coupe de la plate-forme : cote et caractère revêtu à l'abscisse transversale y (y > 0 à gauche) ; null hors plate-forme.
export function lineAt(line, y) {
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    if (y < Math.min(a.y, b.y) - 1e-9 || y > Math.max(a.y, b.y) + 1e-9) continue;
    const t = Math.abs(b.y - a.y) < 1e-9 ? 0 : (y - a.y) / (b.y - a.y);
    // la bande entre deux points est décrite par son point extérieur (le plus loin de l'axe)
    const outer = Math.abs(b.y) >= Math.abs(a.y) ? b : a;
    return { z: a.z + (b.z - a.z) * t, paved: !!outer.paved };
  }
  return null;
}
const pavedSpan = (line) => {
  const ys = line.filter((q, i) => q.label === 'axe' || q.paved).map((q) => q.y);
  // bande revêtue contiguë à l'axe de chaque côté (l'îlot du TPC n'est pas roulable mais la chaussée reprend au-delà)
  return { y0: Math.min(...ys), y1: Math.max(...ys) };
};

// Contexte d'un axe : géométrie, profil type, profil en long.
function axCtx(prj, D, ax, A, TP) {
  return { ax, A, T: axisType(prj, D, ax.key), TP, key: ax.key, name: ax.name };
}
function platformAt(prj, D, C, s) { return axisPlatform(prj, D, C.ax, C.T, s, C.A.PL.zAt(s), C.TP); }

// Cote de la surface de la voie C au point P (projeté sur son axe), bornée à sa plate-forme revêtue.
function surfaceUnder(prj, D, C, P) {
  const pr = C.ax.project(P);
  if (!pr) return null;
  const s = Math.max(0, Math.min(C.ax.len, pr.s)), pf = platformAt(prj, D, C, s), sp = pavedSpan(pf.line);
  const y = Math.max(sp.y0, Math.min(sp.y1, pr.off)), q = lineAt(pf.line, y);
  return q ? { z: q.z, s, off: pr.off, d: Math.abs(pr.off - y) } : null;
}

// Emprise d'un tablier non implanté : plate-forme revêtue de la voie haute + 0,50 m, sur ± Lh autour de sC.
function genericFootprint(prj, D, C, sC, Lh) {
  const L = [], R = [];
  for (let s = Math.max(0, sC - Lh); s <= Math.min(C.ax.len, sC + Lh) + 1e-9; s += 1) {
    const pf = axisPlatform(prj, D, C.ax, C.T, s, 0, C.TP), sp = pavedSpan(pf.line);
    L.push(G.add(pf.p, G.mul(pf.n, sp.y1 + 0.5))); R.push(G.add(pf.p, G.mul(pf.n, sp.y0 - 0.5)));
  }
  return [...L, ...R.reverse()];
}

// Balayage de la chaussée revêtue de la voie basse sous l'emprise F : point critique et plages d'abscisses.
function sweep(prj, D, low, ups, F, h) {
  let lo = Infinity, hi = -Infinity;
  for (const q of F) { const pr = low.ax.project(q); if (pr && pr.d < 200) { lo = Math.min(lo, pr.s); hi = Math.max(hi, pr.s); } }
  if (!(hi > lo)) return null;
  lo = Math.max(0, lo - 1); hi = Math.min(low.ax.len, hi + 1);
  let best = null, n = 0, zLowMax = -Infinity;
  const rLow = [Infinity, -Infinity], rUp = Object.fromEntries(ups.map((u) => [u.key, [Infinity, -Infinity]]));
  for (let s = lo; s <= hi + 1e-9; s += STEP) {
    const pf = platformAt(prj, D, low, s), sp = pavedSpan(pf.line);
    for (let y = sp.y0; y <= sp.y1 + 1e-9; y += STEP) {
      const q = lineAt(pf.line, y);
      if (!q?.paved) continue;
      const P = G.add(pf.p, G.mul(pf.n, y));
      if (!inPoly(P, F)) continue;
      // voie portée au droit de P : la plus proche (tige : S-semi ou boucle)
      let U = null;
      for (const u of ups) { const r = surfaceUnder(prj, D, u, P); if (r && (!U || r.d < U.r.d)) U = { u, r }; }
      if (!U) continue;
      n++;
      const zInt = U.r.z - h, ta = zInt - q.z;
      rLow[0] = Math.min(rLow[0], s); rLow[1] = Math.max(rLow[1], s);
      const ru = rUp[U.u.key]; ru[0] = Math.min(ru[0], U.r.s); ru[1] = Math.max(ru[1], U.r.s);
      zLowMax = Math.max(zLowMax, q.z);
      if (!best || ta < best.ta) best = { ta, P, sLow: s, yLow: y, zLow: q.z, zInt, up: U.u, sUp: U.r.s };
    }
  }
  return best ? { ...best, n, rLow, rUp, zLowMax } : null;
}

// Intersections de deux axes (polylignes échantillonnées tous les 2 m) : [{ P, sA, sB }].
function crossings(A, B) {
  const pa = [], pb = [];
  for (let s = 0; s <= A.len + 1e-9; s += 2) pa.push({ s, p: A.at(s).p });
  for (let s = 0; s <= B.len + 1e-9; s += 2) pb.push({ s, p: B.at(s).p });
  const out = [];
  const bb = (pts) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of pts) { x0 = Math.min(x0, q.p.x); y0 = Math.min(y0, q.p.y); x1 = Math.max(x1, q.p.x); y1 = Math.max(y1, q.p.y); } return { x0, y0, x1, y1 }; };
  const ba = bb(pa), bB = bb(pb);
  if (ba.x1 < bB.x0 || bB.x1 < ba.x0 || ba.y1 < bB.y0 || bB.y1 < ba.y0) return out;
  for (let i = 1; i < pa.length; i++) {
    const a0 = pa[i - 1].p, a1 = pa[i].p;
    for (let j = 1; j < pb.length; j++) {
      const b0 = pb[j - 1].p, b1 = pb[j].p, r = G.sub(a1, a0), q = G.sub(b1, b0), den = G.cross(r, q);
      if (Math.abs(den) < 1e-12) continue;
      const t = G.cross(G.sub(b0, a0), q) / den, u = G.cross(G.sub(b0, a0), r) / den;
      if (t < 0 || t > 1 || u < 0 || u > 1) continue;
      const P = G.add(a0, G.mul(r, t));
      if (out.some((o) => G.dist(o.P, P) < 5)) continue;
      out.push({ P, sA: pa[i - 1].s + 2 * t, sB: pb[j - 1].s + 2 * u });
    }
  }
  return out;
}

// Contrôles : un enregistrement par (ouvrage, voie franchie).
//   { lvl, ouvr, ta, gab, h, key (voie portée à relever), sX, zNeed, lower, uppers, crit, rLow, rUp, zLowMax, generic, msg }
export function clearanceChecks(prj, D, profiles, axes, ouvrList, { gab = 4.75 } = {}) {
  const out = [], TP = typeParams(prj), ctx = new Map();
  for (const ax of axes) { const A = profiles.get(ax.key); if (A?.defined && /^(hwy|x:|r:)/.test(ax.key)) try { ctx.set(ax.key, axCtx(prj, D, ax, A, TP)); } catch { /* axe sans profil type */ } }
  const ramps = prj.ramps || [];
  const push = (o, name, ups, low, F, h, generic, gabO) => {
    let r;
    try { r = sweep(prj, D, low, ups, F, h); } catch (e) { console.error(e); return; }
    if (!r) return;
    const lvl = r.ta < gabO - 0.005 ? 'err' : 'ok';
    const U = r.up, zU = U.A.PL.zAt(r.sUp), zNeed = zU + (gabO + 0.10 - r.ta);
    const side = Math.abs(r.yLow) < 0.3 ? 'sur l\'axe' : `à ${fmt(Math.abs(r.yLow), 2)} m ${r.yLow > 0 ? 'à gauche' : 'à droite'} de l'axe`;
    const msg = `${name} : tirant d'air ${fmt(r.ta)} m au point le plus haut de ${low.name} sous l'ouvrage (${side}, s = ${fmt(r.sLow, 1)} m, dévers compris : intrados ${fmt(r.zInt)} − chaussée ${fmt(r.zLow)})`
      + (generic ? `, tablier non implanté d'épaisseur supposée ${fmt(h)} m` : '')
      + (lvl === 'err' ? ` < gabarit ${fmt(gabO)} m : relevez ${U.name} (z ≥ ${fmt(zNeed)} m à s = ${fmt(r.sUp, 1)} m) ou abaissez ${low.name}.` : ` ≥ ${fmt(gabO)} m.`);
    out.push({ lvl, ouvr: name, ta: r.ta, gab: gabO, h, key: U.key, sX: r.sUp, zNeed, lower: low.key, uppers: ups.map((u) => u.key), crit: { P: r.P, sLow: r.sLow, yLow: r.yLow, zLow: r.zLow, zInt: r.zInt }, rLow: r.rLow, rUp: r.rUp, zLowMax: r.zLowMax, generic, okey: o?.key ?? null, msg });
  };
  // 1. tabliers implantés
  for (const o of ouvrList || []) {
    if (!(o.poly?.length > 2)) continue;
    let ups = [];
    const mx = /^x:([^:]+):/.exec(o.key || ''), mt = /^t:(.+)$/.exec(o.key || '');
    if (mx) ups = [ctx.get(`x:${mx[1]}`)];
    else if (mt) { const semi = ramps.find((r) => r.id === mt[1]); const bou = semi && ramps.find((r) => r.role === 'boucle' && r.grp === semi.id); ups = [ctx.get(`r:${mt[1]}`), bou ? ctx.get(`r:${bou.id}`) : null]; }
    ups = ups.filter(Boolean);
    if (!ups.length) continue;
    for (const low of ctx.values()) {
      if (ups.some((u) => u.key === low.key)) continue;
      push(o, o.name, ups, low, o.poly, o.h || 0, false, o.gab ?? gab);
    }
  }
  // 2. croisements dénivelés sans tablier implanté (voies secondaires et bretelles entre elles)
  const decks = (ouvrList || []).map((o) => o.poly).filter((p) => p?.length > 2);
  const list = [...ctx.values()];
  let k = 0;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const A = list[i], B = list[j];
    if (A.key === 'hwy' && B.key === 'hwy') continue;
    for (const c of crossings(A.ax, B.ax)) {
      if (decks.some((F) => inPoly(c.P, F))) continue; // déjà traité par son tablier
      // raccordement à niveau (extrémité d'une bretelle sur sa chaussée hôte) : pas d'ouvrage
      if (Math.min(c.sA, A.ax.len - c.sA) < 25 || Math.min(c.sB, B.ax.len - c.sB) < 25) continue;
      const zA = A.A.PL.zAt(c.sA), zB = B.A.PL.zAt(c.sB);
      if (Math.abs(zA - zB) < 2) continue; // croisement à niveau : contrôlé avec les chaussées superposées
      const [up, low] = zA > zB ? [A, B] : [B, A], sU = zA > zB ? c.sA : c.sB;
      const sL = zA > zB ? c.sB : c.sA, spL = pavedSpan(axisPlatform(prj, D, low.ax, low.T, sL, 0, TP).line), lowHalf = Math.max(6, -spL.y0, spL.y1);
      const tU = up.ax.at(sU).t, tL = low.ax.at(sL).t, sin = Math.max(0.3, Math.abs(G.cross(tU, tL)));
      const F = genericFootprint(prj, D, up, sU, lowHalf / sin + 3);
      push(null, `Croisement ${up.name} / ${low.name} (OH${++k})`, [up], low, F, H_GEN, true, gab);
    }
  }
  return out;
}
// Enregistrement le plus défavorable d'un ouvrage (fiche, bouton « Relever »).
export function worstClearance(list, name) {
  let w = null;
  for (const q of list || []) if (q.ouvr === name && (!w || q.ta < w.ta)) w = q;
  return w;
}
