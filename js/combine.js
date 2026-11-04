// combine.js — tracé combiné (comme BVTrace) : feuilles paysage A4 à A0 à l'échelle, chacune avec le plan de l'axe
// (bande supérieure, axe à l'horizontale, fond topo DXF, projet dessiné, PK, profils implantés, ouvrages, nord, échelle
// graphique) et, dessous, son profil en long (TN, ligne rouge, plans de comparaison, raccordements, ouvrages) et le
// cartouche (n° de profil, distances partielles, PK, cotes TN et projet, déclivités et rayons, longueurs, dévers gauche
// et droit). Les feuilles se recouvrent d'un intervalle de profils. Tout est vectoriel (SVG en millimètres papier) :
// la page HTML produite s'imprime en PDF à l'échelle exacte.
import * as G from './geom.js';
import { plElements } from './pl.js';

export const PAPERS = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841] };
const f2 = (v, d = 2) => (v == null || !Number.isFinite(+v) ? '—' : (+v).toFixed(d).replace('.', ',').replace('-', '−'));
const r2 = (v) => Math.round(v * 100) / 100;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtPk = (v) => { const a = Math.abs(v), km = Math.floor(a / 1000), m = a - km * 1000; return `${v < 0 ? '−' : ''}${km}+${m.toFixed(2).padStart(6, '0').replace('.', ',')}`; };
const sgn = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${f2(Math.abs(v))}`;

// Habillage du projet sur la bande plan (couleurs d'impression, largeurs en mm papier).
const STY = {
  CHAUSSEE: { fill: '#dedfe2' }, TROTTOIR: { fill: '#ece7dc', stroke: '#666', w: 0.15 },
  ILOT_CENTRAL: { fill: '#d5e8cc', stroke: '#222', w: 0.25 }, ILOT_SEP: { fill: '#d5e8cc', stroke: '#222', w: 0.25 },
  TALUS: { stroke: '#8b6f47', w: 0.12 }, LIMITE: { stroke: '#666', w: 0.13 }, ACCOTEMENT: { stroke: '#666', w: 0.13, dash: [1.5, 1] },
  BORDURE: { stroke: '#111', w: 0.32 }, MARQUAGE: { stroke: '#333', w: 0.15 }, RETENUE: { stroke: '#444', w: 0.25 },
  OUVRAGE: { stroke: '#1d4ed8', w: 0.3, fill: '#dbe6fb' }, AXE: { stroke: '#b91c1c', w: 0.15, dash: [6, 1, 1, 1] },
};
const LAYERS = Object.keys(STY);

/**
 * Feuilles du tracé combiné.
 * @param o {
 *   ax: axe (profils.js listAxes : key, name, len, at(s) → { p, t }, half),
 *   PL: profil en long (axpl : zAt, gradeAt, nodes, segs, curves) ou null, pk0 : PK origine,
 *   tnAt(s) → Z TN ou null, stations : [{ num, s }] (profils implantés, sinon pas régulier), devAt(s) → { l, r } (%),
 *   prims : [primitives du projet], dxf : géométrie DXF (polys, points, texts) ou null,
 *   ohs : [{ name, s, label }], format, scale, zScale, title, project }
 * @returns {{ svgs: string[], info: { sheets, coverage, overlap, step, paper } }}
 */
export function combinedSheets(o) {
  const [PW, PH] = PAPERS[o.format] || PAPERS.A3, k = 1000 / o.scale, zScale = o.zScale || Math.max(1, Math.round(o.scale / 10)), kz = 1000 / zScale;
  const M = { l: 17, r: 17, t: 12, b: 12 }, inner = { x: M.l, y: M.t, w: PW - M.l - M.r, h: PH - M.t - M.b };
  const titleH = 9, gap = 3, labelW = Math.min(40, inner.w * 0.14);
  const avail = inner.h - titleH - gap, planR = { x: inner.x, y: inner.y + titleH, w: inner.w, h: avail * 0.4 };
  const profR = { x: inner.x, y: planR.y + planR.h + gap, w: inner.w, h: avail - planR.h };
  const plotX0 = inner.x + labelW, plotW = inner.w - labelW, C = plotW / k;
  const ax = o.ax, len = ax.len, st = (o.stations || []).filter((q) => q.s >= -1e-6 && q.s <= len + 1e-6).sort((a, b) => a.s - b.s);
  const gaps = st.slice(1).map((q, i) => q.s - st[i].s).filter((v) => v > 0.1).sort((a, b) => a - b);
  const overlap = Math.min(C * 0.5, gaps.length ? gaps[gaps.length >> 1] : 20), step = Math.max(C * 0.2, C - overlap);
  const n = len > C ? Math.min(300, Math.ceil((len - C) / step) + 1) : 1;
  const dxf = prepDxf(o.dxf), svgs = [];
  for (let i = 0; i < n; i++) {
    const s0 = Math.min(i * step, Math.max(0, len - C)), s1 = Math.min(len, s0 + C);
    svgs.push(sheet({ ...o, PW, PH, k, kz, zScale, inner, titleH, labelW, planR, profR, plotX0, plotW, C, overlap, st, dxf, i, n, s0, s1 }));
  }
  return { svgs, info: { sheets: n, coverage: C, overlap, step, paper: [PW, PH], zScale } };
}

/** Page HTML imprimable (une feuille par page, taille exacte du papier). */
export function combinedHtml(svgs, info, title) {
  const [W, H] = info.paper;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page { size: ${W}mm ${H}mm; margin: 0 }
html, body { margin: 0; background: #6b7280; font-family: Arial, Helvetica, sans-serif }
.bar { position: sticky; top: 0; z-index: 2; background: #111827; color: #e5e7eb; padding: 8px 14px; font-size: 13px; display: flex; gap: 12px; align-items: center }
.bar button { font: inherit; padding: 5px 12px; cursor: pointer }
svg.sheet { display: block; width: ${W}mm; height: ${H}mm; background: #fff; margin: 10mm auto; box-shadow: 0 2px 10px rgba(0,0,0,.4); page-break-after: always; break-after: page }
@media print { html, body { background: #fff } .bar { display: none } svg.sheet { margin: 0; box-shadow: none } }
</style></head><body><div class="bar"><button onclick="print()">Imprimer / PDF</button><span>${esc(title)} — ${svgs.length} feuille${svgs.length > 1 ? 's' : ''} ${W} × ${H} mm paysage · imprimer à 100 % (taille réelle), marges nulles.</span></div>
${svgs.join('\n')}
</body></html>`;
}

// Fond DXF : boîtes englobantes précalculées (filtrage rapide par feuille).
function prepDxf(geo) {
  if (!geo) return null;
  const polys = (geo.polys || []).map((p) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < p.pts.length; i += 2) { const x = p.pts[i], y = p.pts[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { p, x0, y0, x1, y1 };
  });
  const vis = (layer) => geo.layers?.get?.(layer)?.visible !== false;
  return { polys: polys.filter((q) => vis(q.p.layer)), points: (geo.points || []).filter((q) => vis(q.layer)), texts: (geo.texts || []).filter((q) => vis(q.layer)) };
}

function sheet(o) {
  const { PW, PH, k, kz, inner, titleH, labelW, planR, profR, plotX0, plotW, s0, s1, ax } = o;
  let out = `<svg class="sheet" xmlns="http://www.w3.org/2000/svg" width="${PW}mm" height="${PH}mm" viewBox="0 0 ${PW} ${PH}" font-family="Arial, Helvetica, sans-serif">`;
  out += `<defs><clipPath id="cp${o.i}"><rect x="${plotX0}" y="${planR.y}" width="${plotW}" height="${planR.h}"/></clipPath><clipPath id="cq${o.i}"><rect x="${plotX0}" y="${profR.y}" width="${plotW}" height="${profR.h}"/></clipPath></defs>`;
  // Cadre et titre
  out += `<rect x="${inner.x}" y="${inner.y}" width="${inner.w}" height="${inner.h}" fill="none" stroke="#000" stroke-width="0.5"/>`;
  out += `<line x1="${inner.x}" y1="${inner.y + titleH}" x2="${inner.x + inner.w}" y2="${inner.y + titleH}" stroke="#000" stroke-width="0.35"/>`;
  out += txt(inner.x + 2, inner.y + 4, `TRACÉ COMBINÉ — ${o.title}`, 3, { w: 'bold' });
  out += txt(inner.x + 2, inner.y + 7.6, `${o.project ? `${o.project} · ` : ''}PK ${fmtPk(o.pk0 + s0)} → ${fmtPk(o.pk0 + s1)} · recouvrement ${f2(o.overlap)} m (un intervalle de profils)`, 2.2, { c: '#333' });
  out += txt(inner.x + inner.w - 2, inner.y + 4, `${o.format} paysage · plan et longueurs 1/${o.scale} · hauteurs 1/${o.zScale}`, 2.4, { a: 'end' });
  out += txt(inner.x + inner.w - 2, inner.y + 7.6, `Feuille ${o.i + 1} / ${o.n}`, 2.6, { a: 'end', w: 'bold' });
  out += planBand(o);
  out += profileBand(o);
  return out + '</svg>';
}

// ------------------------------------------------------------------------------------------------ Plan
function planBand(o) {
  const { k, planR, plotX0, plotW, labelW, s0, s1, ax, C } = o;
  const Pa = ax.at(s0).p, Pb = ax.at(Math.min(ax.len, s0 + C)).p;
  let u = G.norm(G.sub(Pb, Pa)); if (!(G.dist(Pa, Pb) > 1)) u = G.norm(ax.at(s0).t);
  const nv = G.rot90(u);
  // décalage transversal : l'axe de la feuille au milieu de la bande
  let cmin = Infinity, cmax = -Infinity;
  for (let s = s0; s <= s1 + 1e-9; s += Math.max(1, (s1 - s0) / 100)) { const c = G.dot(G.sub(ax.at(s).p, Pa), nv); cmin = Math.min(cmin, c); cmax = Math.max(cmax, c); }
  const c0 = Number.isFinite(cmin) ? (cmin + cmax) / 2 : 0, yMid = planR.y + planR.h / 2;
  const T = (P) => { const d = G.sub(P, Pa); return { x: plotX0 + G.dot(d, u) * k, y: yMid - (G.dot(d, nv) - c0) * k }; };
  const phi = Math.atan2(u.y, u.x);
  // emprise monde de la bande (filtrage)
  const corners = [[plotX0, planR.y], [plotX0 + plotW, planR.y], [plotX0, planR.y + planR.h], [plotX0 + plotW, planR.y + planR.h]].map(([x, y]) => G.add(G.add(Pa, G.mul(u, (x - plotX0) / k)), G.mul(nv, (yMid - y) / k + c0)));
  const bb = { x0: Math.min(...corners.map((q) => q.x)), y0: Math.min(...corners.map((q) => q.y)), x1: Math.max(...corners.map((q) => q.x)), y1: Math.max(...corners.map((q) => q.y)) };
  const inBB = (q) => !(q.x1 < bb.x0 || q.x0 > bb.x1 || q.y1 < bb.y0 || q.y0 > bb.y1);
  const P = (x, y) => `${x.toFixed(2)},${y.toFixed(2)}`;
  let out = `<rect x="${planR.x}" y="${planR.y}" width="${planR.w}" height="${planR.h}" fill="none" stroke="#000" stroke-width="0.35"/>`;
  out += `<line x1="${plotX0}" y1="${planR.y}" x2="${plotX0}" y2="${planR.y + planR.h}" stroke="#000" stroke-width="0.25"/>`;
  out += `<g clip-path="url(#cp${o.i})">`;
  // fond topographique
  if (o.dxf) {
    let d = '';
    for (const q of o.dxf.polys) {
      if (!inBB(q)) continue;
      const a = q.p.pts;
      for (let j = 0; j < a.length; j += 2) { const t = T({ x: a[j], y: a[j + 1] }); d += `${j ? 'L' : 'M'}${P(t.x, t.y)}`; }
      if (q.p.closed) d += 'Z';
    }
    if (d) out += `<path d="${d}" fill="none" stroke="#9ca3af" stroke-width="0.12" stroke-linejoin="round"/>`;
    let dots = '';
    for (const q of o.dxf.points) if (q.x >= bb.x0 && q.x <= bb.x1 && q.y >= bb.y0 && q.y <= bb.y1) { const t = T(q); dots += `M${P(t.x - 0.2, t.y)}h0.4`; }
    if (dots) out += `<path d="${dots}" stroke="#9ca3af" stroke-width="0.4" stroke-linecap="round"/>`;
    for (const t of o.dxf.texts) {
      if (t.x < bb.x0 || t.x > bb.x1 || t.y < bb.y0 || t.y > bb.y1 || t.h * k < 1) continue;
      const q = T(t);
      out += txt(q.x, q.y, t.s, Math.min(3, t.h * k), { c: '#9ca3af', rot: upright(-((t.rot || 0) - phi) * 180 / Math.PI), a: t.align === 'right' ? 'end' : t.align === 'center' ? 'middle' : 'start' });
    }
  }
  // projet dessiné
  for (const L of LAYERS) for (const pr of o.prims || []) if (pr.L === L) out += primSvg(pr, STY[L], T, k);
  // axe de la feuille, PK, profils implantés
  const half = (ax.half || 5) + 6, bar = Math.max(2, Math.min(ax.half || 5, 8)), pts = [];
  for (let s = Math.max(0, s0 - 30); s <= Math.min(ax.len, s1 + 30) + 1e-9; s += 1) pts.push(T(ax.at(s).p));
  out += `<path d="${pts.map((q, j) => `${j ? 'L' : 'M'}${P(q.x, q.y)}`).join('')}" fill="none" stroke="#fff" stroke-width="0.9"/>`;
  out += `<path d="${pts.map((q, j) => `${j ? 'L' : 'M'}${P(q.x, q.y)}`).join('')}" fill="none" stroke="#c00" stroke-width="0.35" stroke-dasharray="6 1 1 1"/>`;
  for (const q of o.st) {
    if (q.s < s0 - 1e-6 || q.s > s1 + 1e-6) continue;
    const { p, t } = ax.at(q.s), m = G.rot90(t), a = T(G.add(p, G.mul(m, bar))), b = T(G.sub(p, G.mul(m, bar)));
    out += `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="#2563eb" stroke-width="0.15"/>`;
    // numéro et PK au bout du trait, dans son prolongement, sur deux lignes (texte remis à l'endroit)
    const raw = -(Math.atan2(m.y, m.x) - phi) * 180 / Math.PI, rot = upright(raw), flip = Math.abs(((raw - rot) % 360 + 360) % 360 - 180) < 1;
    const e = T(G.add(p, G.mul(m, (flip ? -1 : 1) * (bar + 0.8 / k)))), rr = (rot * Math.PI) / 180, nx = -Math.sin(rr), ny = Math.cos(rr);
    const n0 = { x: e.x - nx * 0.3, y: e.y - ny * 0.3 }, n1 = { x: e.x + nx * 2, y: e.y + ny * 2 };
    out += txt(n0.x, n0.y, String(q.num), 1.8, { a: 'start', c: '#1d4ed8', w: 'bold', rot, halo: true });
    out += txt(n1.x, n1.y, fmtPk(o.pk0 + q.s).replace(/,00$/, ''), 1.5, { a: 'start', c: '#1d4ed8', rot, halo: true });
  }
  const tick = [10, 20, 25, 50, 100, 200, 500, 1000, 2000].find((v) => v * k >= 18) || 5000;
  for (let s = Math.ceil((o.pk0 + s0) / tick) * tick - o.pk0; s <= s1 + 1e-6; s += tick) {
    if (s < -1e-6) continue;
    const { p, t } = ax.at(s), m = G.rot90(t), a = T(G.add(p, G.mul(m, 2 / k))), b = T(G.sub(p, G.mul(m, 2 / k))), c = T(G.sub(p, G.mul(m, 3.2 / k)));
    out += `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="#c00" stroke-width="0.3"/>`;
    out += txt(c.x, c.y, `PK ${fmtPk(o.pk0 + s).replace(/,00$/, '')}`, 1.9, { a: 'middle', c: '#b91c1c', rot: upright(-(Math.atan2(t.y, t.x) - phi) * 180 / Math.PI), halo: true });
  }
  // ouvrages
  for (const q of o.ohs || []) {
    if (q.s < s0 || q.s > s1) continue;
    const { p, t } = ax.at(q.s), m = G.rot90(t), c = T(G.add(p, G.mul(m, half + 2 / k)));
    out += txt(c.x, c.y, q.name, 2, { a: 'middle', c: '#1d4ed8', w: 'bold', halo: true });
  }
  out += '</g>';
  // colonne de gauche : nord, échelle graphique, légende
  const cx = planR.x + labelW / 2, cy = planR.y + Math.min(14, planR.h * 0.3), N = { x: G.dot({ x: 0, y: 1 }, u), y: -G.dot({ x: 0, y: 1 }, nv) }, R = Math.min(7, labelW * 0.2);
  out += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#000" stroke-width="0.2"/>`;
  out += `<path d="M${P(cx + N.x * R, cy + N.y * R)}L${P(cx - N.y * R * 0.35, cy + N.x * R * 0.35)}L${P(cx, cy)}Z" fill="#000"/><path d="M${P(cx - N.x * R, cy - N.y * R)}L${P(cx - N.y * R * 0.35, cy + N.x * R * 0.35)}L${P(cx, cy)}Z" fill="none" stroke="#000" stroke-width="0.2"/>`;
  out += txt(cx + N.x * (R + 2.5), cy + N.y * (R + 2.5) + 0.8, 'N', 2.6, { a: 'middle', w: 'bold' });
  const Ls = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000].filter((v) => v * k <= labelW - 8).pop() || 5, bx = planR.x + (labelW - Ls * k) / 2, by = Math.min(planR.y + planR.h - 6, cy + R + 9);
  for (let j = 0; j < 4; j++) out += `<rect x="${(bx + (j * Ls * k) / 4).toFixed(2)}" y="${by}" width="${((Ls * k) / 4).toFixed(2)}" height="1.2" fill="${j % 2 ? '#fff' : '#000'}" stroke="#000" stroke-width="0.15"/>`;
  out += txt(bx, by + 4, '0', 1.8, { a: 'middle' }) + txt(bx + Ls * k, by + 4, `${Ls} m`, 1.8, { a: 'middle' }) + txt(cx, by + 7.5, `Plan 1/${o.scale}`, 2, { a: 'middle', w: 'bold' });
  return out;
}

// Primitive du projet (repère monde) → SVG papier.
function primSvg(pr, sty, T, k) {
  const d = (segs) => segsD(segs, T, k);
  const dash = (a) => (a && a[0] * k >= 0.3 ? ` stroke-dasharray="${a.map((v) => (v * k).toFixed(2)).join(' ')}"` : '');
  if (pr.k === 'fill') {
    const col = pr.color || sty.fill; if (!col) return '';
    return `<path d="${pr.rings.map((r) => d(r) + 'Z').join('')}" fill="${col}" fill-rule="${pr.rule || 'evenodd'}" stroke="none"/>`;
  }
  if (pr.k === 'path' && sty.stroke) {
    const w = Math.max(sty.w, (pr.wm || 0) * k);
    return `<path d="${d(pr.segs)}${pr.closed ? 'Z' : ''}" fill="none" stroke="${sty.stroke}" stroke-width="${w.toFixed(2)}" stroke-linejoin="round"${pr.dash ? dash(pr.dash) : sty.dash ? ` stroke-dasharray="${sty.dash.join(' ')}"` : ''}/>`;
  }
  if (pr.k === 'hatch' && sty.stroke) {
    let s = '';
    for (const [a, b] of pr.lines) { const p = T(a), q = T(b); s += `M${p.x.toFixed(2)},${p.y.toFixed(2)}L${q.x.toFixed(2)},${q.y.toFixed(2)}`; }
    return s ? `<path d="${s}" stroke="${sty.stroke}" stroke-width="${Math.max(0.1, (pr.wm || 0) * k).toFixed(2)}"/>` : '';
  }
  if (pr.k === 'circle' && sty.stroke) { const c = T(pr.c); return `<circle cx="${c.x.toFixed(2)}" cy="${c.y.toFixed(2)}" r="${(pr.r * k).toFixed(2)}" fill="none" stroke="${sty.stroke}" stroke-width="${sty.w}"/>`; }
  return '';
}
function segsD(segs, T, k) {
  let s = '', last = null;
  const at = (p) => { const q = T(p); return `${q.x.toFixed(2)},${q.y.toFixed(2)}`; };
  for (const g of segs) {
    const a = G.segStart(g);
    if (!last || G.dist(last, a) > 1e-6) s += `M${at(a)}`;
    if (g.t === 'L') { s += `L${at(g.b)}`; last = g.b; }
    else if (g.t === 'A') {
      const sw = G.sweep(g), e = G.segEnd(g), r = (g.r * k).toFixed(3), fl = g.ccw ? 0 : 1;
      if (sw > Math.PI * 1.98) { const m = G.segAt(g, 0.5); s += `A${r},${r} 0 0 ${fl} ${at(m)}A${r},${r} 0 0 ${fl} ${at(e)}`; }
      else if (sw > 1e-9) s += `A${r},${r} 0 ${sw > Math.PI ? 1 : 0} ${fl} ${at(e)}`;
      last = e;
    } else if (g.t === 'C') {
      const p = { x: g.c.x + g.r, y: g.c.y }, q = { x: g.c.x - g.r, y: g.c.y }, r = (g.r * k).toFixed(3);
      s += `M${at(p)}A${r},${r} 0 0 0 ${at(q)}A${r},${r} 0 0 0 ${at(p)}`; last = null;
    }
  }
  return s;
}

// ------------------------------------------------------------------------------------------------ Profil en long
const CART = [
  { key: 'num', label: 'N° PROFIL', h: 5 }, { key: 'dp', label: 'DISTANCES PARTIELLES', h: 9 }, { key: 'pk', label: 'PK (ABSCISSES)', h: 9 },
  { key: 'tn', label: 'COTES TN', h: 9 }, { key: 'zp', label: 'COTES PROJET', h: 9 }, { key: 'el', label: 'DÉCLIVITÉS / RAYONS', h: 6 },
  { key: 'len', label: 'LONGUEURS', h: 5 }, { key: 'dl', label: 'DÉVERS GAUCHE (%)', h: 8 }, { key: 'dr', label: 'DÉVERS DROIT (%)', h: 8 },
];

function profileBand(o) {
  const { k, kz, profR, plotX0, plotW, labelW, s0, s1, PL, st } = o;
  const X = (s) => plotX0 + (s - s0) * k, P = (x, y) => `${x.toFixed(2)},${y.toFixed(2)}`;
  // cartouche : rangées réduites si la feuille est basse (A4)
  const shrink = profR.h < 110 ? 0.8 : 1, rows = CART.map((r) => ({ ...r, h: r.h * shrink }));
  const cartH = rows.reduce((t, r) => t + r.h, 0), cartY = profR.y + profR.h - cartH;
  const plot = { x: plotX0, y: profR.y + 7, w: plotW, h: cartY - profR.y - 9 };
  let out = `<rect x="${profR.x}" y="${profR.y}" width="${profR.w}" height="${profR.h}" fill="none" stroke="#000" stroke-width="0.35"/>`;
  out += txt(profR.x + 2, profR.y + 4.2, `PROFIL EN LONG — longueurs 1/${o.scale} · hauteurs 1/${o.zScale}`, 2.4, { w: 'bold' });
  // stations de la feuille, TN et projet
  const vis = st.filter((q) => q.s >= s0 - 1e-6 && q.s <= s1 + 1e-6);
  const zp = (s) => (PL ? PL.zAt(s) : null), tn = (s) => { const z = o.tnAt(s); return z != null && Number.isFinite(z) ? z : null; };
  const smp = [], dS = Math.max(0.5, (s1 - s0) / 400);
  for (let s = s0; s <= s1 + 1e-9; s += dS) smp.push(s);
  if (smp[smp.length - 1] < s1 - 1e-6) smp.push(s1);
  for (const q of vis) smp.push(q.s);
  smp.sort((a, b) => a - b);
  // plans de comparaison : zones où TN et projet tiennent dans la hauteur du cadre
  const cap = plot.h / kz, zones = [];
  let zn = null;
  for (const s of smp) {
    // la ligne rouge prime : un TN trop éloigné d'elle pour tenir dans le cadre est simplement rogné
    let zs = [tn(s), zp(s)].filter((v) => v != null);
    if (zs.length === 2 && Math.abs(zs[0] - zs[1]) > cap * 0.8) zs = [zs[1]];
    if (!zs.length) continue;
    const lo = Math.min(...zs), hi = Math.max(...zs);
    if (!zn) { zn = { s, lo, hi }; continue; }
    const nlo = Math.min(zn.lo, lo), nhi = Math.max(zn.hi, hi);
    if (nhi - nlo > cap * 0.86 && s > zn.s + 1e-6) { zones.push(zn); zn = { s, lo, hi }; } else { zn.lo = nlo; zn.hi = nhi; }
  }
  if (zn) zones.push(zn);
  const stepZ = kz >= 6 ? 1 : kz >= 1.5 ? 5 : 10;
  for (const z of zones) { const room = cap - (z.hi - z.lo); z.pc = Math.floor((z.lo - Math.min(room * 0.35, 3 * stepZ)) / stepZ) * stepZ; }
  const zoneAt = (s) => { let j = 0; while (j + 1 < zones.length && zones[j + 1].s <= s + 1e-9) j++; return zones[j]; };
  const Y = (s, z) => plot.y + plot.h - (z - (zoneAt(s)?.pc ?? z)) * kz;
  out += `<rect x="${plot.x}" y="${plot.y}" width="${plot.w}" height="${plot.h}" fill="none" stroke="#000" stroke-width="0.25"/>`;
  out += `<clipPath id="cz${o.i}"><rect x="${plot.x}" y="${plot.y}" width="${plot.w}" height="${plot.h}"/></clipPath><g clip-path="url(#cz${o.i})">`;
  // grille altimétrique par zone, plans de comparaison
  zones.forEach((z, j) => {
    const xa = X(Math.max(s0, z.s)), xb = j + 1 < zones.length ? X(zones[j + 1].s) : plot.x + plot.w;
    for (let zz = z.pc; (zz - z.pc) * kz <= plot.h + 1e-6; zz += stepZ) { const y = plot.y + plot.h - (zz - z.pc) * kz; out += `<line x1="${xa.toFixed(2)}" y1="${y.toFixed(2)}" x2="${xb.toFixed(2)}" y2="${y.toFixed(2)}" stroke="#e5e7eb" stroke-width="0.1"/>`; }
    if (j) out += `<line x1="${xa.toFixed(2)}" y1="${plot.y}" x2="${xa.toFixed(2)}" y2="${plot.y + plot.h}" stroke="#000" stroke-width="0.35"/>`;
    out += txt(xa + 1.2, plot.y + plot.h - 1.2, `PC ${f2(z.pc)}`, 2, { w: 'bold' });
  });
  // rappels des profils : du TN au bas du cadre
  for (const q of vis) { const z = tn(q.s) ?? zp(q.s); if (z == null) continue; out += `<line x1="${X(q.s).toFixed(2)}" y1="${Y(q.s, z).toFixed(2)}" x2="${X(q.s).toFixed(2)}" y2="${plot.y + plot.h}" stroke="#9ca3af" stroke-width="0.12"/>`; }
  const line = (fz) => { let d = '', prev = null; for (const s of smp) { const z = fz(s); if (z == null) { prev = null; continue; } const zo = zoneAt(s); d += `${prev && prev === zo ? 'L' : 'M'}${P(X(s), Y(s, z))}`; prev = zo; } return d; };
  out += `<path d="${line(tn)}" fill="none" stroke="#5c4f44" stroke-width="0.3"/>`;
  if (PL) {
    out += `<path d="${line(zp)}" fill="none" stroke="#cd1c24" stroke-width="0.5"/>`;
    for (const c of PL.curves || []) { // raccordements : rappels aux tangences, rayon
      for (const s of [c.sA, c.sB]) if (s >= s0 && s <= s1) out += `<line x1="${X(s).toFixed(2)}" y1="${plot.y + 2}" x2="${X(s).toFixed(2)}" y2="${Y(s, zp(s)).toFixed(2)}" stroke="#cd1c24" stroke-width="0.12" stroke-dasharray="0.8 0.6"/>`;
      const sm = (c.sA + c.sB) / 2;
      if (sm >= s0 && sm <= s1) out += txt(X(sm), plot.y + 4, `R ${f2(c.R, 0)} ${c.type === 'convexe' ? 'saillant' : 'rentrant'}`, 1.9, { a: 'middle', c: '#b91c1c' });
    }
  }
  for (const q of o.ohs || []) { // ouvrages : repère sous la ligne rouge, désignation au-dessus
    if (q.s < s0 || q.s > s1) continue;
    const z = zp(q.s) ?? tn(q.s); if (z == null) continue;
    const y = Y(q.s, z), x = X(q.s);
    out += `<line x1="${x.toFixed(2)}" y1="${(y + 1).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(plot.y + plot.h).toFixed(2)}" stroke="#1d4ed8" stroke-width="0.3"/>`;
    out += txt(x, Math.max(plot.y + 7, y - 6), q.name, 2, { a: 'middle', c: '#1d4ed8', w: 'bold', halo: true });
    if (q.label) out += txt(x, Math.max(plot.y + 9.6, y - 3.4), q.label, 1.7, { a: 'middle', c: '#1d4ed8', halo: true });
  }
  out += '</g>';
  // échelle des hauteurs dans la colonne de gauche (première zone)
  if (zones.length) {
    const z = zones[0], xr = plot.x - 1;
    for (let zz = z.pc; (zz - z.pc) * kz <= plot.h + 1e-6; zz += stepZ * (kz * stepZ < 4 ? 2 : 1)) { const y = plot.y + plot.h - (zz - z.pc) * kz; out += `<line x1="${xr - 1.5}" y1="${y.toFixed(2)}" x2="${xr}" y2="${y.toFixed(2)}" stroke="#000" stroke-width="0.15"/>` + txt(xr - 2.2, y + 0.7, f2(zz, 0), 1.8, { a: 'end' }); }
  }
  // cartouche
  out += cartouche(o, rows, cartY, X, vis, zp, tn);
  return out;
}

function cartouche(o, rows, y0, X, vis, zp, tn) {
  const { profR, plotX0, s0, s1, PL } = o, x0 = profR.x, x1 = profR.x + profR.w, tops = [];
  let y = y0, out = '';
  for (const r of rows) { tops.push(y); y += r.h; }
  out += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke="#000" stroke-width="0.35"/><line x1="${plotX0}" y1="${y0}" x2="${plotX0}" y2="${y}" stroke="#000" stroke-width="0.25"/>`;
  rows.forEach((r, j) => {
    if (j) out += `<line x1="${x0}" y1="${tops[j]}" x2="${x1}" y2="${tops[j]}" stroke="#000" stroke-width="0.15"/>`;
    out += txt(x0 + 1.5, tops[j] + r.h / 2 + 0.7, r.label, Math.min(2, r.h * 0.42), { w: 'bold' });
  });
  const row = (key) => rows.findIndex((r) => r.key === key);
  // stations retenues : au moins 2,6 mm entre deux rappels (valeurs écrites à la verticale)
  const keep = [];
  for (const q of vis) if (!keep.length || X(q.s) - X(keep[keep.length - 1].s) >= 2.6) keep.push(q);
  if (vis.length && keep[keep.length - 1] !== vis[vis.length - 1]) { if (keep.length > 1) keep.pop(); keep.push(vis[vis.length - 1]); }
  const vt = (x, j, v) => { const r = rows[j], yb = tops[j] + r.h - 0.8, fs = Math.min(1.7, (r.h - 1.2) / Math.max(4, String(v).length * 0.56)); return `<text x="${(x + 0.7).toFixed(2)}" y="${yb.toFixed(2)}" font-size="${fs.toFixed(2)}" transform="rotate(-90 ${(x + 0.7).toFixed(2)} ${yb.toFixed(2)})">${esc(v)}</text>`; };
  const skipRows = new Set([row('el'), row('len')]);
  keep.forEach((q, i) => {
    const x = X(q.s);
    rows.forEach((r, j) => { if (!skipRows.has(j) && j !== row('dp')) out += `<line x1="${x.toFixed(2)}" y1="${tops[j]}" x2="${x.toFixed(2)}" y2="${tops[j] + r.h}" stroke="#9ca3af" stroke-width="0.12"/>`; });
    out += txt(x, tops[row('num')] + rows[row('num')].h / 2 + 0.7, String(q.num), 1.8, { a: 'middle', w: 'bold' });
    if (i) out += vt((X(keep[i - 1].s) + x) / 2 - 0.7, row('dp'), f2(q.s - keep[i - 1].s));
    out += vt(x, row('pk'), fmtPk(o.pk0 + q.s).replace(/,00$/, ''));
    out += vt(x, row('tn'), f2(tn(q.s)));
    out += vt(x, row('zp'), f2(zp(q.s)));
    const dv = o.devAt ? o.devAt(q.s) : null;
    out += vt(x, row('dl'), dv && Number.isFinite(dv.l) ? sgn(dv.l) : '—');
    out += vt(x, row('dr'), dv && Number.isFinite(dv.r) ? sgn(dv.r) : '—');
  });
  // éléments du profil : déclivités (segments) et raccordements (paraboles), cellules fusionnées
  if (PL) {
    const { lines, paras } = plElements(PL, o.ax.len), je = row('el'), jl = row('len');
    const cell = (a, b, label, lab2, kind) => {
      const A = Math.max(s0, a), B = Math.min(s1, b); if (!(B > A + 1e-6)) return '';
      const xa = X(A), xb = X(B), w = xb - xa, ye = tops[je], yl = tops[jl];
      let s = `<line x1="${xa.toFixed(2)}" y1="${ye}" x2="${xa.toFixed(2)}" y2="${yl + rows[jl].h}" stroke="#000" stroke-width="0.15"/><line x1="${xb.toFixed(2)}" y1="${ye}" x2="${xb.toFixed(2)}" y2="${yl + rows[jl].h}" stroke="#000" stroke-width="0.15"/>`;
      if (kind === 'para') s += `<path d="M${xa.toFixed(2)},${ye + rows[je].h - 1}Q${((xa + xb) / 2).toFixed(2)},${(ye + (label.includes('rentrant') ? rows[je].h + 1 : -1)).toFixed(2)} ${xb.toFixed(2)},${ye + rows[je].h - 1}" fill="none" stroke="#b91c1c" stroke-width="0.15"/>`;
      if (w >= label.length * 0.95) s += txt((xa + xb) / 2, ye + rows[je].h * 0.55, label, 1.8, { a: 'middle' });
      if (w >= lab2.length * 0.95) s += txt((xa + xb) / 2, yl + rows[jl].h * 0.68, lab2, 1.8, { a: 'middle' });
      return s;
    };
    for (const l of lines) out += cell(l.s0, l.s1, `${l.g >= 0 ? 'rampe' : 'pente'} ${f2(Math.abs(l.g) * 100, 2)} %`, `L = ${f2(l.s1 - l.s0)}`, 'seg');
    for (const c of paras) out += cell(c.s0, c.s1, `R = ${f2(c.R, 0)} ${c.type === 'convexe' ? 'saillant' : 'rentrant'}`, `L = ${f2(c.s1 - c.s0)}`, 'para');
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ utilitaires
function upright(deg) { let a = ((deg % 360) + 540) % 360 - 180; if (a > 90) a -= 180; if (a <= -90) a += 180; return a; }
function txt(x, y, s, h, { a = 'start', w = 'normal', c = '#000', rot = 0, halo = false } = {}) {
  const t = `x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${h.toFixed(2)}" text-anchor="${a}"${w !== 'normal' ? ` font-weight="${w}"` : ''}${rot ? ` transform="rotate(${rot.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})"` : ''}`;
  return `${halo ? `<text ${t} fill="none" stroke="#fff" stroke-width="${(h * 0.35).toFixed(2)}" stroke-linejoin="round">${esc(s)}</text>` : ''}<text ${t} fill="${c}">${esc(s)}</text>`;
}
export { fmtPk, r2 };
