// tabexport.js — tableaux d'un axe pour les pièces écrites : éléments du tracé en plan, éléments du profil en long et
// tabulation (abscisse, coordonnées, gisement, cote projet, pente, TN, dévers gauche / droit).
// Format CSV « français » : séparateur ;, virgule décimale, BOM UTF-8 (ouverture directe dans Excel).
import * as G from './geom.js';
import { axisType, axisPlatform, typeParams } from './ptaxes.js';
import { tinZ } from './tin.js';
import { hwyParams, crossParams, crossList } from './echangeur.js';

const n = (v, d = 3) => (v == null || !Number.isFinite(+v) ? '' : (+v).toFixed(d).replace('.', ','));
const q = (s) => (/[;"\n]/.test(String(s ?? '')) ? `"${String(s).replace(/"/g, '""')}"` : String(s ?? ''));
const row = (a) => a.map(q).join(';');
/** Gisement (gr, depuis le nord, sens horaire) d'une direction t. */
const gis = (t) => ((((Math.atan2(t.x, t.y) * 200) / Math.PI) % 400) + 400) % 400;
const gisOfHead = (th) => gis({ x: Math.cos(th), y: Math.sin(th) });

/** PK origine de l'axe (autoroute, voie secondaire) ; 0 ailleurs. */
export function pkOrigin(prj, key) {
  const v = (x) => (x === '' || x == null || !Number.isFinite(+x) ? 0 : +x);
  if (key === 'hwy') return v(hwyParams(prj).pk0);
  if (key.startsWith('x:')) { const k = crossList(prj).findIndex((c) => `x:${c.id}` === key); return k >= 0 ? v(crossParams(prj, k).pk0) : 0; }
  return 0;
}

/**
 * Éléments du tracé en plan : alignement exact (droites, clothoïdes, arcs) quand l'axe en porte un ; sinon découpage
 * par la courbure (axes de branches : droites et arcs de raccordement).
 * @returns {{ head: string[], rows: any[][] }}
 */
export function planElements(prj, ax) {
  const pk0 = pkOrigin(prj, ax.key), out = [];
  const KN = { L: 'Droite', C: 'Clothoïde', A: 'Arc' };
  if (ax.al?.elems?.length) {
    ax.al.elems.forEach((e, i) => {
      const p0 = e.pointAt(0), p1 = e.pointAt(e.len), h0 = e.headAt(0), h1 = e.headAt(e.len);
      const sens = e.kind === 'L' ? '' : e.sg > 0 ? 'gauche' : 'droite';
      const Rtxt = e.kind === 'A' ? e.R : e.kind === 'C' ? (e.out ? `${n(e.R, 1)} → ∞` : `∞ → ${n(e.R, 1)}`) : '';
      out.push([i + 1, KN[e.kind] || e.kind, n(e.s0), n(e.s0 + e.len), n(pk0 + e.s0), n(pk0 + e.s0 + e.len), n(e.len), n(p0.x), n(p0.y), n(p1.x), n(p1.y), n(gisOfHead(h0), 4), n(gisOfHead(h1), 4), typeof Rtxt === 'number' ? n(Rtxt, 3) : Rtxt, e.kind === 'C' ? n(e.A, 3) : '', sens]);
    });
  } else {
    // découpage par courbure (pas 0,5 m) : |κ| < 1e-5 → droite, sinon arc de rayon moyen
    const step = Math.max(0.25, Math.min(1, ax.len / 4000)), runs = [];
    const kAt = (s) => { const a = Math.max(0, s - step), b = Math.min(ax.len, s + step); const ta = ax.at(a).t, tb = ax.at(b).t; return b - a > 1e-6 ? Math.atan2(G.cross(ta, tb), G.dot(ta, tb)) / (b - a) : 0; };
    for (let s = 0; s < ax.len - 1e-9; s += step) {
      const k = kAt(s + step / 2), kind = Math.abs(k) < 1e-5 ? 'L' : 'A', last = runs[runs.length - 1];
      if (last && last.kind === kind && (kind === 'L' || Math.abs(1 / last.k - 1 / k) < Math.max(2, 0.03 / Math.abs(k)))) { last.s1 = Math.min(ax.len, s + step); last.kSum += k; last.nk++; last.k = last.kSum / last.nk; }
      else runs.push({ kind, s0: s, s1: Math.min(ax.len, s + step), k, kSum: k, nk: 1 });
    }
    runs.forEach((r, i) => {
      const a = ax.at(r.s0), b = ax.at(r.s1);
      out.push([i + 1, KN[r.kind], n(r.s0), n(r.s1), n(pk0 + r.s0), n(pk0 + r.s1), n(r.s1 - r.s0), n(a.p.x), n(a.p.y), n(b.p.x), n(b.p.y), n(gis(a.t), 4), n(gis(b.t), 4), r.kind === 'A' ? n(1 / Math.abs(r.k), 1) : '', '', r.kind === 'A' ? (r.k > 0 ? 'gauche' : 'droite') : '']);
    });
  }
  return { head: ['N°', 'Élément', 'Abscisse début', 'Abscisse fin', 'PK début', 'PK fin', 'Longueur (m)', 'X début', 'Y début', 'X fin', 'Y fin', 'Gisement début (gr)', 'Gisement fin (gr)', 'Rayon (m)', 'Paramètre A (m)', 'Sens'], rows: out };
}

/**
 * Éléments du profil en long : déclivités et raccordements paraboliques, puis sommets (PIV).
 * @param A profil de l'axe (axpl.js : { PL, defined })
 */
export function profileElements(prj, ax, A) {
  const pk0 = pkOrigin(prj, ax.key);
  if (!A?.defined || !A.PL) return { head: ['Profil en long non défini pour cet axe'], rows: [], piv: null };
  const PL = A.PL, nodes = PL.nodes, curves = new Map(PL.curves.map((c) => [c.i, c])), rows = [];
  let k = 0;
  const z = (s) => PL.zAt(s), g = (s) => PL.gradeAt(s);
  for (let i = 0; i + 1 < nodes.length; i++) {
    const cA = curves.get(i), cB = curves.get(i + 1);
    const s0 = cA ? cA.sB : nodes[i].s, s1 = cB ? cB.sA : nodes[i + 1].s, gr = (nodes[i + 1].z - nodes[i].z) / Math.max(1e-9, nodes[i + 1].s - nodes[i].s);
    if (s1 - s0 > 1e-6) rows.push([++k, 'Déclivité', n(s0), n(s1), n(pk0 + s0), n(pk0 + s1), n(s1 - s0), n(z(s0)), n(z(s1)), n(gr * 100, 3), '', '', '']);
    if (cB) {
      const sv = Math.abs(cB.g2 - cB.g1) > 1e-12 ? cB.sA - (cB.g1 * (cB.sB - cB.sA)) / (cB.g2 - cB.g1) : null; // point de pente nulle (sommet ou point bas)
      const inside = sv != null && sv > cB.sA && sv < cB.sB;
      rows.push([++k, `Parabole ${cB.type === 'convexe' ? 'saillante' : 'rentrante'}`, n(cB.sA), n(cB.sB), n(pk0 + cB.sA), n(pk0 + cB.sB), n(cB.sB - cB.sA), n(z(cB.sA)), n(z(cB.sB)), `${n(cB.g1 * 100, 3)} → ${n(cB.g2 * 100, 3)}`, n(cB.R, 1), n(cB.T, 3), inside ? `${cB.type === 'convexe' ? 'sommet' : 'point bas'} PK ${n(pk0 + sv)} Z ${n(z(sv))}` : '']);
    }
  }
  const piv = {
    head: ['PIV', 'Abscisse', 'PK', 'Z', 'Pente avant (%)', 'Pente après (%)', 'Rayon (m)', 'Tangente T (m)', 'Flèche (m)', 'Type'],
    rows: nodes.map((q, i) => {
      const c = curves.get(i), gb = i > 0 ? (q.z - nodes[i - 1].z) / Math.max(1e-9, q.s - nodes[i - 1].s) : null, ga = i + 1 < nodes.length ? (nodes[i + 1].z - q.z) / Math.max(1e-9, nodes[i + 1].s - q.s) : null;
      return [i === 0 ? 'origine' : i === nodes.length - 1 ? 'fin' : `S${i}`, n(q.s), n(pk0 + q.s), n(q.z), gb == null ? '' : n(gb * 100, 3), ga == null ? '' : n(ga * 100, 3), c ? n(c.R, 1) : '', c ? n(c.T, 3) : '', c ? n((c.T * c.T) / (2 * c.R), 3) : '', c ? (c.type === 'convexe' ? 'saillant' : 'rentrant') : ''];
    }),
  };
  return { head: ['N°', 'Élément', 'Abscisse début', 'Abscisse fin', 'PK début', 'PK fin', 'Longueur (m)', 'Z début', 'Z fin', 'Pente (%)', 'Rayon (m)', 'Tangente T (m)', 'Sommet / point bas'], rows, piv };
}

/**
 * Tabulation : points au pas choisi + points singuliers (tangences du plan, débuts / fins des paraboles, PIV, profils
 * implantés), avec coordonnées, gisement, cote projet, pente, TN, dévers gauche / droit (convention : pente du
 * demi-profil vers l'extérieur de l'axe, négative quand il descend vers l'extérieur).
 */
export function tabulation(prj, D, ax, A, { step = 25, tin = null, profs = [] } = {}) {
  const pk0 = pkOrigin(prj, ax.key), T = axisType(prj, D, ax.key), TP = typeParams(prj);
  const pts = new Map(), put = (s, what) => { const k = Math.round(Math.max(0, Math.min(ax.len, s)) * 1000) / 1000; const o = pts.get(k); pts.set(k, o ? (what && !o.includes(what) ? `${o}${o ? ' · ' : ''}${what}` : o) : what || ''); };
  for (let s = 0; s <= ax.len + 1e-9; s += step) put(s, '');
  put(0, 'origine'); put(ax.len, 'fin');
  for (const t of ax.tan || []) put(t.s, t.type);
  if (A?.defined) { for (const c of A.PL.curves) { put(c.sA, 'début parabole'); put(c.sB, 'fin parabole'); } A.PL.nodes.forEach((q, i) => { if (i && i < A.PL.nodes.length - 1) put(q.s, `PIV S${i}`); }); }
  for (const p of profs) put(p.s, p.name);
  const rows = [...pts.entries()].sort((a, b) => a[0] - b[0]).map(([s, what]) => {
    const { p, t } = ax.at(s), zp = A?.defined ? A.PL.zAt(s) : null, gr = A?.defined ? A.PL.gradeAt(s) : null, ztn = tin ? tinZ(tin, p.x, p.y) : null;
    let dl = '', dr = '', R = '';
    try {
      const pf = axisPlatform(prj, D, ax, T, s, zp ?? 0, TP);
      dl = n(pf.dev.left * 100, 2); dr = n(pf.dev.right * 100, 2); R = Number.isFinite(pf.dev.R) ? n(pf.dev.R, 1) : '';
    } catch { /* plate-forme non calculable */ }
    return [what, n(s), n(pk0 + s), n(p.x), n(p.y), n(gis(t), 4), R, zp == null ? '' : n(zp), gr == null ? '' : n(gr * 100, 3), ztn == null ? '' : n(ztn), zp != null && ztn != null ? n(zp - ztn) : '', dl, dr];
  });
  return { head: ['Point', 'Abscisse', 'PK', 'X', 'Y', 'Gisement (gr)', 'Rayon en plan (m)', 'Z projet', 'Pente long. (%)', 'Z TN', 'Projet − TN', 'Dévers gauche (%)', 'Dévers droit (%)'], rows };
}

/** CSV d'un ou plusieurs tableaux titrés : [{ title, head, rows }]. */
export function tablesCsv(tables) {
  const out = [];
  for (const t of tables) { if (out.length) out.push(''); out.push(row([t.title])); out.push(row(t.head)); for (const r of t.rows) out.push(row(r)); }
  return '﻿' + out.join('\r\n');
}
