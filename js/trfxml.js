// trfxml.js — import d'un axe (plan + profil en long) depuis un fichier TRF (transfert Piste 5 du SETRA) ou LandXML
// (Alignment / CoordGeom / Profile), portage de BVTrace (TrfImport.cs, AxisImport.cs).
//
// TRF (Manuel de référence Piste 5, § 8.1) : suite de blocs, chacun annoncé par une ligne « TYPE(I3) 3X VER(I3)
// NUM(I4) » avec VER = 400. TYPE 1 tabulation (une ligne par profil : S X Y ZP G DG DD, colonnes de 13 et 9 caractères),
// TYPE 3 axe en plan (2 lignes par élément : ITY … V1 V2 V3 puis SD XD YD SF XF YF ; 1 droite, 2 cercle de centre
// (V1, V2) et rayon signé V3, 3 clothoïde de paramètre V1, IX = 2 : entrée), TYPE 4 profil en long (1 droite de pente
// V1 %, 2 parabole de rayon V1 et de sommet (V2, V3)). Les autres blocs sont ignorés.
// LandXML : coordonnées « nord est » ; Line, Curve (centre), Spiral (rayons de début et de fin, INF = droite) ;
// profil en long par PVI, ParaCurve (longueur) et CircCurve (rayon).
//
// L'axe d'INFRA-KSR est décrit par sommets (PI) + rayon + longueur de clothoïde symétrique : chaque virage (suite
// d'éléments courbes de même sens entre deux droites ou points d'inflexion) devient un sommet à l'intersection des
// tangentes d'entrée et de sortie, avec le plus petit rayon du virage et la moyenne des clothoïdes d'entrée et de
// sortie. L'écart à la géométrie du fichier est mesuré et rendu.

import { buildAlignment } from './clotho.js';

const P = (s) => { const v = parseFloat(String(s).trim().replace(/D/i, 'E')); return Number.isFinite(v) ? v : NaN; };
const fld = (l, a, n) => (a < l.length ? P(l.substr(a, n)) : NaN);
const head = (line) => {
  if (!line || line.length < 13) return null;
  const ver = parseInt(line.substr(6, 3), 10), type = parseInt(line.substr(0, 3), 10), num = parseInt(line.substr(9, 4), 10);
  return ver === 400 && type >= 1 ? { type, num: Number.isFinite(num) ? num : 0 } : null;
};

// ------------------------------------------------------------------ TRF
export function parseTRF(text) {
  const L = String(text).replace(/\r/g, '').split('\n'), out = { elements: [], rasante: [], tab: [], note: '' };
  let i = 0;
  while (i < L.length) {
    const h = head(L[i]); if (!h) { i++; continue; }
    i++;
    if (h.type === 1) { // tabulation
      for (let k = 0; k < h.num && i < L.length && !head(L[i]); i++) {
        const l = L[i]; if (!l.trim()) continue;
        let q = l.length >= 83 ? [fld(l, 0, 13), fld(l, 13, 13), fld(l, 26, 13), fld(l, 39, 13), fld(l, 52, 13)] : null;
        if (!q || q.some((v) => !Number.isFinite(v))) q = l.trim().split(/\s+/).slice(0, 5).map(P);
        if (q.length >= 5 && q.every(Number.isFinite)) { out.tab.push({ s: q[0], x: q[1], y: q[2], z: q[3], g: q[4] }); k++; }
      }
    } else if (h.type === 3) { // axe en plan
      for (let k = 0; k < h.num && i + 1 < L.length && !head(L[i]); k++, i += 2) {
        const l1 = L[i], t2 = L[i + 1].trim().split(/\s+/).map(P);
        if (t2.length < 6 || t2.slice(0, 6).some((v) => !Number.isFinite(v))) continue;
        const ity = parseInt(l1.substr(0, 1), 10), ix = parseInt(l1.substr(7, 1), 10), v1 = fld(l1, 9, 23), v2 = fld(l1, 32, 23), v3 = fld(l1, 55, 23);
        const e = { a: { x: t2[1], y: t2[2] }, b: { x: t2[4], y: t2[5] }, s0: t2[0], len: Math.abs(t2[3] - t2[0]) };
        if (ity === 1) out.elements.push({ ...e, type: 'line' });
        else if (ity === 2 && Number.isFinite(v1) && Number.isFinite(v2)) out.elements.push({ ...e, type: 'arc', c: { x: v1, y: v2 }, r: Math.abs(v3) || Math.hypot(t2[1] - v1, t2[2] - v2) });
        else if (ity === 3) { const A = Math.abs(v1); out.elements.push({ ...e, type: 'clo', r: e.len > 1e-6 ? (A * A) / e.len : 0, entry: ix === 2 }); }
      }
    } else if (h.type === 4) { // profil en long
      for (let k = 0; k < h.num && i < L.length && !head(L[i]); k++) {
        const l = L[i], ity = parseInt(l.substr(0, 1), 10); i++;
        if (ity === 0 && i < L.length) i++; // cubique : seconde ligne ignorée
        const n = l.slice(1).trim().split(/\s+/).map(P).filter(Number.isFinite);
        if (n.length < 5) continue;
        const r = { s0: n[0], z0: n[1], s1: n[2], z1: n[3] };
        if (ity === 2 && n.length >= 7) out.rasante.push({ ...r, para: true, R: n[4], sA: n[5], zA: n[6] });
        else out.rasante.push({ ...r, para: false, g: n[4] / 100 });
      }
    } else while (i < L.length && !head(L[i])) i++;
  }
  out.note = `${out.elements.length} élément(s) d'axe, ${out.rasante.length} élément(s) de profil en long, ${out.tab.length} ligne(s) de tabulation`;
  return out;
}

// ------------------------------------------------------------------ LandXML
export function parseLandXML(text, DP = globalThis.DOMParser) {
  const doc = new DP().parseFromString(String(text), 'application/xml'), out = [];
  const kids = (el, tag) => [...el.children].filter((c) => c.localName === tag);
  const pt = (el) => { if (!el) return null; const v = el.textContent.trim().split(/\s+/).map(P); return v.length >= 2 && v.slice(0, 2).every(Number.isFinite) ? { x: v[1], y: v[0] } : null; }; // « nord est »
  const num = (el, a) => { const v = el.getAttribute(a); return v == null ? NaN : /INF/i.test(v) ? Infinity : P(v); };
  for (const al of [...doc.getElementsByTagName('*')].filter((e) => e.localName === 'Alignment')) {
    const els = [], cg = kids(al, 'CoordGeom')[0];
    if (cg) for (const g of cg.children) {
      const a = pt(kids(g, 'Start')[0]), b = pt(kids(g, 'End')[0]); if (!a || !b) continue;
      const len = num(g, 'length');
      if (g.localName === 'Line') els.push({ type: 'line', a, b, len: Number.isFinite(len) ? len : Math.hypot(b.x - a.x, b.y - a.y) });
      else if (g.localName === 'Curve') { const c = pt(kids(g, 'Center')[0]); if (c) els.push({ type: 'arc', a, b, c, r: num(g, 'radius') || Math.hypot(a.x - c.x, a.y - c.y), len }); }
      else if (g.localName === 'Spiral') { const r0 = num(g, 'radiusStart'), r1 = num(g, 'radiusEnd'), entry = !(Number.isFinite(r0) && r0 > 0); els.push({ type: 'clo', a, b, len, r: entry ? r1 : r0, entry }); }
    }
    const sta0 = P(al.getAttribute('staStart') ?? 0) || 0;
    // profil en long : PVI (sta, cote) ; ParaCurve longueur L → R = L / |Δp| ; CircCurve rayon
    const pa = [...al.getElementsByTagName('*')].find((e) => e.localName === 'ProfAlign'), pv = [];
    if (pa) for (const g of pa.children) {
      const v = g.textContent.trim().split(/\s+/).map(P); if (v.length < 2 || !v.slice(0, 2).every(Number.isFinite)) continue;
      pv.push({ s: v[0] - sta0, z: v[1], L: g.localName === 'ParaCurve' ? num(g, 'length') : NaN, R: g.localName === 'CircCurve' ? num(g, 'radius') : NaN });
    }
    const pis = pv.map((q, k) => {
      let R = 0;
      if (k && k < pv.length - 1) {
        const g1 = (q.z - pv[k - 1].z) / Math.max(1e-9, q.s - pv[k - 1].s), g2 = (pv[k + 1].z - q.z) / Math.max(1e-9, pv[k + 1].s - q.s), dg = Math.abs(g2 - g1);
        R = Number.isFinite(q.R) ? q.R : Number.isFinite(q.L) && dg > 1e-9 ? q.L / dg : 0;
      }
      return { s: Math.round(q.s * 1000) / 1000, z: Math.round(q.z * 1000) / 1000, R: Math.round(R) };
    });
    out.push({ name: al.getAttribute('name') || 'Axe', sta0, elements: els, pis });
  }
  return out;
}

// ------------------------------------------------------------------ éléments exacts → sommets
const hd = (v) => Math.atan2(v.y, v.x), wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// Cap de début / fin d'une droite ou d'un arc ; sens (+1 gauche, −1 droite) d'un arc.
function arcHand(e) { const cr = (e.b.x - e.a.x) * (e.c.y - e.a.y) - (e.b.y - e.a.y) * (e.c.x - e.a.x); return cr >= 0 ? 1 : -1; }
function caps(e) {
  if (e.type === 'line') { const h = hd({ x: e.b.x - e.a.x, y: e.b.y - e.a.y }); return [h, h]; }
  if (e.type === 'arc') { const s = arcHand(e); return [hd({ x: e.a.x - e.c.x, y: e.a.y - e.c.y }) + (s * Math.PI) / 2, hd({ x: e.b.x - e.c.x, y: e.b.y - e.c.y }) + (s * Math.PI) / 2]; }
  return null;
}
// Clothoïde intégrée (pas 0,5 m) depuis a et le cap h0 : courbure linéaire 0 → s/R (entrée) ou s/R → 0 (sortie).
function cloPts(e, h0) {
  const L = e.len, k1 = 1 / e.r, n = Math.max(2, Math.ceil(L / 0.5)), pts = [{ ...e.a }];
  // sens : côté de la fin par rapport au cap de départ
  const sd = Math.cos(h0) * (e.b.y - e.a.y) - Math.sin(h0) * (e.b.x - e.a.x) >= 0 ? 1 : -1;
  let x = e.a.x, y = e.a.y, h = h0;
  const kAt = (u) => sd * (e.entry ? (k1 * u) / L : k1 * (1 - u / L));
  for (let i = 1; i <= n; i++) { const u0 = (L * (i - 1)) / n, u1 = (L * i) / n, km = kAt((u0 + u1) / 2), hm = h + (km * (u1 - u0)) / 2; x += Math.cos(hm) * (u1 - u0); y += Math.sin(hm) * (u1 - u0); h += km * (u1 - u0); pts.push({ x, y }); }
  return { pts, h1: h, hand: sd };
}
export function elementsToAxis(els, { round = 3 } = {}) {
  if (!els.length) return { axis: [], ecart: 0, virages: 0, note: 'aucun élément' };
  // caps de chaque élément (clothoïdes : cap du voisin, puis intégration)
  const H = els.map((e) => caps(e));
  for (let i = 0; i < els.length; i++) if (!H[i]) {
    const h0 = i && H[i - 1] ? H[i - 1][1] : els[i + 1] && caps(els[i + 1]) ? null : 0;
    let start = h0;
    if (start == null) { // clothoïde en tête : cap de fin = cap de début du suivant, cap de début approché par la corde
      const n = caps(els[i + 1])[0], ch = hd({ x: els[i].b.x - els[i].a.x, y: els[i].b.y - els[i].a.y }); start = n - 3 * wrap(n - ch);
    }
    const c = cloPts(els[i], start); els[i].dense = c.pts; els[i].hand = c.hand; H[i] = [start, i + 1 < els.length && caps(els[i + 1]) ? caps(els[i + 1])[0] : c.h1];
  }
  els.forEach((e) => { if (e.type === 'arc') e.hand = arcHand(e); });
  // virages : éléments courbes consécutifs de même sens
  const vir = []; let cur = null;
  els.forEach((e, i) => {
    if (e.type === 'line') { cur = null; return; }
    if (!cur || cur.hand !== e.hand) { cur = { i0: i, i1: i, hand: e.hand }; vir.push(cur); } else cur.i1 = i;
  });
  const axis = [{ x: els[0].a.x, y: els[0].a.y, r: '', lc: '' }];
  for (const v of vir) {
    const A = els[v.i0].a, B = els[v.i1].b, h0 = H[v.i0][0], h1 = H[v.i1][1];
    const dA = { x: Math.cos(h0), y: Math.sin(h0) }, dB = { x: Math.cos(h1), y: Math.sin(h1) }, den = dA.x * dB.y - dA.y * dB.x;
    if (Math.abs(den) < 1e-9 || Math.abs(wrap(h1 - h0)) < 1e-4) continue;
    const t = ((B.x - A.x) * dB.y - (B.y - A.y) * dB.x) / den, I = { x: A.x + dA.x * t, y: A.y + dA.y * t };
    const grp = els.slice(v.i0, v.i1 + 1), arcs = grp.filter((e) => e.type === 'arc'), clo = grp.filter((e) => e.type === 'clo');
    const R = arcs.length ? Math.min(...arcs.map((e) => e.r)) : Math.min(...clo.map((e) => e.r));
    const lIn = grp[0].type === 'clo' ? grp[0].len : 0, lOut = grp[grp.length - 1].type === 'clo' && grp.length > 1 ? grp[grp.length - 1].len : 0;
    const lc = lIn && lOut ? (lIn + lOut) / 2 : lIn || lOut;
    axis.push({ x: I.x, y: I.y, r: +R.toFixed(2), lc: +lc.toFixed(2), ...(arcs.length > 1 ? { _compound: true } : {}) });
  }
  const last = els[els.length - 1].b; axis.push({ x: last.x, y: last.y, r: '', lc: '' });
  const k = 10 ** round;
  return { axis: axis.map((q) => ({ ...q, x: Math.round(q.x * k) / k, y: Math.round(q.y * k) / k })), virages: vir.length, compound: axis.filter((q) => q._compound).length, length: els.reduce((s, e) => s + (e.len || 0), 0) };
}
// Points denses de la géométrie du fichier (pour mesurer l'écart à l'axe reconstitué).
export function densePoints(els, step = 2) {
  const out = [];
  for (const e of els) {
    if (e.type === 'line') { const n = Math.max(1, Math.ceil(e.len / step)); for (let i = 0; i <= n; i++) out.push({ x: e.a.x + ((e.b.x - e.a.x) * i) / n, y: e.a.y + ((e.b.y - e.a.y) * i) / n }); }
    else if (e.type === 'arc') { const a0 = Math.atan2(e.a.y - e.c.y, e.a.x - e.c.x); let da = Math.atan2(e.b.y - e.c.y, e.b.x - e.c.x) - a0; const s = e.hand ?? arcHand(e); if (s > 0 && da < 0) da += 2 * Math.PI; if (s < 0 && da > 0) da -= 2 * Math.PI; const n = Math.max(2, Math.ceil((e.r * Math.abs(da)) / step)); for (let i = 0; i <= n; i++) { const a = a0 + (da * i) / n; out.push({ x: e.c.x + e.r * Math.cos(a), y: e.c.y + e.r * Math.sin(a) }); } }
    else if (e.dense) out.push(...e.dense.filter((_, i) => i % Math.max(1, Math.round(step / 0.5)) === 0));
  }
  return out;
}

// Profil en long TRF → sommets { s, z, R } (s depuis l'origine pk0) : intersections des droites successives, rayon de
// la parabole qui les raccorde.
export function rasanteToPis(ras, pk0 = 0) {
  if (!ras.length) return [];
  const lines = ras.filter((e) => !e.para), pis = [];
  const first = ras[0], lastE = ras[ras.length - 1];
  pis.push({ s: first.s0 - pk0, z: first.z0, R: 0 });
  for (let k = 1; k < lines.length; k++) {
    const a = lines[k - 1], b = lines[k];
    if (Math.abs(a.g - b.g) < 1e-9) continue;
    const s = (b.z0 - a.z0 + a.g * a.s0 - b.g * b.s0) / (a.g - b.g), z = a.z0 + a.g * (s - a.s0);
    const para = ras.find((e) => e.para && e.s0 >= a.s1 - 1e-3 && e.s1 <= b.s0 + 1e-3);
    pis.push({ s: s - pk0, z, R: para ? Math.abs(para.R) : 0 });
  }
  pis.push({ s: lastE.s1 - pk0, z: lastE.z1, R: 0 });
  return pis.map((q) => ({ s: Math.round(q.s * 1000) / 1000, z: Math.round(q.z * 1000) / 1000, R: Math.round(q.R) }));
}

// Écart maximal (m) entre la géométrie du fichier et l'axe reconstitué par sommets.
export function axisEcart(axis, els) {
  const al = buildAlignment(axis.map((q) => ({ x: q.x, y: q.y, R: +q.r || 0, A: +q.lc > 0 && +q.r > 0 ? Math.sqrt(q.lc * q.r) : 0 })));
  const smp = []; for (const e of al.elems) { const n = Math.max(1, Math.ceil(e.len)); for (let i = 0; i <= n; i++) smp.push(e.pointAt((e.len * i) / n)); }
  if (!smp.length) return NaN;
  let dmax = 0, j0 = 0;
  for (const p of densePoints(els, 5)) {
    let m = Infinity, jb = j0;
    for (let j = Math.max(1, j0 - 50); j < smp.length; j++) { // distance au segment (pas à l'échantillon : 0,5 m d'erreur au pas de 1 m)
      const A = smp[j - 1], B = smp[j], dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((p.x - A.x) * dx + (p.y - A.y) * dy) / L2)), d = Math.hypot(p.x - A.x - dx * u, p.y - A.y - dy * u);
      if (d < m) { m = d; jb = j; } else if (j > jb + 200) break;
    }
    j0 = jb; dmax = Math.max(dmax, m);
  }
  return dmax;
}
