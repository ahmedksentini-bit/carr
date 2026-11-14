// notefig.js — cartes et abaques dessinés de la note de calcul hydrologique et hydraulique (SVG, thème clair pour
// l'impression), à la manière de BVTrace (AbaqueChart, AbaqueFigures, cartes du rapport ; invariants :
// BVTrace docs/context/rapports-et-notes.md).
//  - Abaques : la planche ENTIÈRE — toutes les courbes de la famille, la retenue en trait plein coloré, les autres en
//    pointillé gris étiqueté ; point lu marqué avec ses graduations chiffrées ; cadrage sur les courbes ET la valeur
//    lue ; contenu borné par un clipPath.
//  - HDS-5 : les six (ou quatre) configurations d'entrée de la forme, retracées par les équations du moteur
//    (culvertHydraulics) avec la section réelle : la courbe passe par le point calculé.
//  - BCEOM : toutes les courbes de la figure de niveau amont (log-log), point Q*, H1*.
//  - Cartes : bassin (contour, écoulement principal, tracé, exutoire), carte d'ensemble, isohyètes FAO 54 (Pan, P10)
//    sur le fond des pays du bulletin.
import PAN from './data/fao54-pan.js';
import P10 from './data/fao54-p10.js';
import PAYS from './data/fao54-pays.js';

const E = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const nf = (v, d = 2) => (Number.isFinite(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const nfa = (v) => { const a = Math.abs(v); if (a < 1e-12) return '0'; return nf(v, a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : a >= 0.1 ? 3 : 4); };
let UID = 0;

// ─── Abaque générique ─────────────────────────────────────────────────────────────────────────────
function niceStep(span, n = 6) { const r = span / n, p = 10 ** Math.floor(Math.log10(r || 1)); return [1, 2, 2.5, 5, 10].map((k) => k * p).find((k) => k >= r) || p * 10; }
function logTicks(a, b) { const out = []; for (let e = Math.floor(Math.log10(a)); e <= Math.ceil(Math.log10(b)); e++) for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= a * 0.999 && v <= b * 1.001) out.push(v); } return out; }

/**
 * @param {object} o { title, xl, yl, xlog, ylog, curves: [{ pts: [[x,y]], on, label }], mark: { x, y, label }, w, h }
 */
export function abaqueSvg(o) {
  const w = o.w || 760, h = o.h || 400, m = { l: 62, r: 200, t: 30, b: 46 }, id = `ab${++UID}`;
  const all = [...o.curves.flatMap((c) => c.pts), ...(o.mark ? [[o.mark.x, o.mark.y]] : [])].filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && (!o.xlog || x > 0) && (!o.ylog || y > 0));
  if (!all.length) return '';
  let x0 = Math.min(...all.map((p) => p[0])), x1 = Math.max(...all.map((p) => p[0])), y0 = Math.min(...all.map((p) => p[1])), y1 = Math.max(...all.map((p) => p[1]));
  if (o.xlog) { x0 /= 1.15; x1 *= 1.15; } else { const sx = niceStep(x1 - x0 || 1); x0 = Math.floor(x0 / sx) * sx; x1 = Math.ceil(x1 / sx) * sx || x0 + sx; if (o.x0 != null) x0 = Math.min(x0, o.x0); }
  if (o.ylog) { y0 /= 1.15; y1 *= 1.15; } else { const sy = niceStep(y1 - y0 || 1); y0 = Math.floor(y0 / sy) * sy; y1 = Math.ceil(y1 / sy) * sy || y0 + sy; if (o.y0 != null) y0 = Math.min(y0, o.y0); }
  const L = (v, lg) => (lg ? Math.log10(v) : v);
  const X = (x) => m.l + ((L(x, o.xlog) - L(x0, o.xlog)) / (L(x1, o.xlog) - L(x0, o.xlog) || 1)) * (w - m.l - m.r);
  const Y = (y) => h - m.b - ((L(y, o.ylog) - L(y0, o.ylog)) / (L(y1, o.ylog) - L(y0, o.ylog) || 1)) * (h - m.t - m.b);
  let s = `<svg class="abaque" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" font-family="Arial,sans-serif">`;
  s += `<defs><clipPath id="${id}"><rect x="${m.l}" y="${m.t}" width="${w - m.l - m.r}" height="${h - m.t - m.b}"/></clipPath></defs>`;
  s += `<rect x="${m.l}" y="${m.t}" width="${w - m.l - m.r}" height="${h - m.t - m.b}" fill="#fff" stroke="#334155" stroke-width="0.8"/>`;
  const xt = o.xlog ? logTicks(x0, x1) : (() => { const st = niceStep(x1 - x0); const a = []; for (let v = x0; v <= x1 + 1e-9; v += st) a.push(v); return a; })();
  const yt = o.ylog ? logTicks(y0, y1) : (() => { const st = niceStep(y1 - y0); const a = []; for (let v = y0; v <= y1 + 1e-9; v += st) a.push(v); return a; })();
  for (const v of xt) s += `<line x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${h - m.b}" stroke="#e5e7eb" stroke-width="0.6"/><text x="${X(v)}" y="${h - m.b + 13}" font-size="10" text-anchor="middle" fill="#475569">${nfa(v)}</text>`;
  for (const v of yt) s += `<line x1="${m.l}" x2="${w - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e5e7eb" stroke-width="0.6"/><text x="${m.l - 5}" y="${Y(v) + 3.5}" font-size="10" text-anchor="end" fill="#475569">${nfa(v)}</text>`;
  s += `<g clip-path="url(#${id})">`;
  const path = (pts) => pts.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && (!o.xlog || x > 0) && (!o.ylog || y > 0)).map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join('');
  const off = o.curves.filter((c) => !c.on), on = o.curves.filter((c) => c.on);
  for (const c of off) s += `<path d="${path(c.pts)}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="5 3"/>`;
  for (const c of on) s += `<path d="${path(c.pts)}" fill="none" stroke="#0369a1" stroke-width="2.2"/>`;
  if (o.mark) {
    const mx = X(o.mark.x), my = Y(o.mark.y);
    s += `<path d="M${mx},${h - m.b}V${my}H${m.l}" fill="none" stroke="#dc2626" stroke-width="1" stroke-dasharray="4 3"/><circle cx="${mx}" cy="${my}" r="4" fill="#dc2626"/>`;
  }
  s += '</g>';
  // étiquettes des courbes à droite du cadre (en bout de courbe), sans chevauchement
  const lab = o.curves.map((c) => { const p = c.pts.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)).at(-1); return p ? { c, y: Math.max(m.t + 6, Math.min(h - m.b, Y(p[1]))) } : null; }).filter(Boolean).sort((a, b) => a.y - b.y);
  for (let i = 1; i < lab.length; i++) if (lab[i].y - lab[i - 1].y < 11) lab[i].y = lab[i - 1].y + 11;
  for (const q of lab) s += `<text x="${w - m.r + 5}" y="${q.y + 3}" font-size="9.5" fill="${q.c.on ? '#0369a1' : '#64748b'}" font-weight="${q.c.on ? 'bold' : 'normal'}">${E(q.c.label)}</text>`;
  if (o.mark) { // graduations chiffrées du point lu
    s += `<text x="${X(o.mark.x)}" y="${h - m.b + 26}" font-size="10" text-anchor="middle" fill="#dc2626" font-weight="bold">${nfa(o.mark.x)}</text>`;
    s += `<text x="${m.l + 4}" y="${Y(o.mark.y) - 4}" font-size="10" fill="#dc2626" font-weight="bold">${nfa(o.mark.y)}${o.mark.label ? ' — ' + E(o.mark.label) : ''}</text>`;
  }
  s += `<text x="${(m.l + w - m.r) / 2}" y="${h - 6}" font-size="11" text-anchor="middle" fill="#1e293b">${E(o.xl)}</text>`;
  s += `<text transform="translate(14 ${(m.t + h - m.b) / 2}) rotate(-90)" font-size="11" text-anchor="middle" fill="#1e293b">${E(o.yl)}</text>`;
  s += `<text x="${m.l}" y="18" font-size="12" font-weight="bold" fill="#0f172a">${E(o.title)}</text>`;
  return s + '</svg>';
}

// ─── HDS-5 : contrôle à l'entrée, toutes les configurations de la forme ────────────────────────────
// ─── Cartes ─────────────────────────────────────────────────────────────────────────────────────────
function frame(bb, w, h, pad = 24) {
  const sx = (w - 2 * pad) / (bb.x1 - bb.x0 || 1), sy = (h - 2 * pad) / (bb.y1 - bb.y0 || 1), k = Math.min(sx, sy);
  const ox = pad + (w - 2 * pad - (bb.x1 - bb.x0) * k) / 2, oy = pad + (h - 2 * pad - (bb.y1 - bb.y0) * k) / 2;
  return { k, X: (x) => ox + (x - bb.x0) * k, Y: (y) => h - (oy + (y - bb.y0) * k) };
}
// Fond satellite : tuiles fournies par l'appelant (Web Mercator reprojetées, coins dans le repère du projet) ; chaque tuile
// posée par une transformation affine sur trois coins, comme le fond de plan de l'application.
function tileImages(tiles, bb, F, w, h) {
  if (typeof tiles !== 'function') return '';
  let list = []; try { list = tiles(bb, F.k) || []; } catch { return ''; }
  if (!list.length) return '';
  let s = '<g class="sat">';
  for (const t of list) {
    const a = (F.X(t.ne.x) - F.X(t.nw.x)) / 256, b = (F.Y(t.ne.y) - F.Y(t.nw.y)) / 256, c = (F.X(t.sw.x) - F.X(t.nw.x)) / 256, d = (F.Y(t.sw.y) - F.Y(t.nw.y)) / 256;
    if (![a, b, c, d].every(Number.isFinite)) continue;
    s += `<image href="${E(t.href)}" x="-0.3" y="-0.3" width="256.6" height="256.6" preserveAspectRatio="none" transform="matrix(${a.toFixed(5)} ${b.toFixed(5)} ${c.toFixed(5)} ${d.toFixed(5)} ${F.X(t.nw.x).toFixed(2)} ${F.Y(t.nw.y).toFixed(2)})"/>`;
  }
  return s + '</g>';
}
function scaleBar(k, w, h, onImg = false) {
  const target = (w * 0.22) / k, step = [1, 2, 5].flatMap((m) => [m, m * 10, m * 100, m * 1000, m * 10000]).sort((a, b) => a - b).filter((v) => v <= target).pop() || 1, px = step * k;
  return `<g font-size="10" fill="#1e293b">${onImg ? `<rect x="8" y="${h - 28}" width="${px + 60}" height="18" rx="3" fill="#fff" fill-opacity="0.85"/><rect x="${w - 38}" y="10" width="28" height="44" rx="3" fill="#fff" fill-opacity="0.85"/>` : ''}<rect x="14" y="${h - 22}" width="${px}" height="5" fill="#1e293b"/><rect x="${14 + px / 2}" y="${h - 22}" width="${px / 2}" height="5" fill="#fff" stroke="#1e293b" stroke-width="0.6"/><text x="${14 + px + 5}" y="${h - 16}">${step >= 1000 ? `${nf(step / 1000, 0)} km` : `${nf(step, 0)} m`}</text></g>`
    + `<g transform="translate(${w - 24} 30)"><path d="M0,-14L6,6L0,1L-6,6Z" fill="#1e293b"/><text y="18" font-size="10" text-anchor="middle" fill="#1e293b">N</text></g>`;
}
const pl = (pts, F) => pts.map((p, i) => `${i ? 'L' : 'M'}${F.X(p.x).toFixed(1)},${F.Y(p.y).toFixed(1)}`).join('');

/** Carte d'un bassin : contour, écoulement principal, axe porteur, exutoire. axes : [{ name, pts:[{x,y}] }]. */
export function basinMapSvg(c, axes = [], { w = 680, h = 420, others = [], tiles = null } = {}) {
  const rings = c.ring || [], pts = rings.flat();
  if (!pts.length) return '';
  const bb = { x0: Math.min(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), x1: Math.max(...pts.map((p) => p.x)), y1: Math.max(...pts.map((p) => p.y)) };
  const padW = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) * 0.08; bb.x0 -= padW; bb.x1 += padW; bb.y0 -= padW; bb.y1 += padW;
  const F = frame(bb, w, h), id = `bm${++UID}`;
  let s = `<svg class="carte" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" font-family="Arial,sans-serif"><defs><clipPath id="${id}"><rect width="${w}" height="${h}"/></clipPath></defs><rect width="${w}" height="${h}" fill="#ffffff" stroke="#cbd5e1"/><g clip-path="url(#${id})">`;
  const sat = tileImages(tiles, bb, F, w, h); s += sat;
  for (const o of others) for (const r of o.ring || []) s += `<path d="${pl(r, F)}Z" fill="none" stroke="${sat ? '#e2e8f0' : '#94a3b8'}" stroke-width="0.8" stroke-dasharray="4 3"/>`; // bassins voisins
  s += `<path d="${rings.map((r) => pl(r, F) + 'Z').join('')}" fill="${sat ? 'rgba(56,189,248,0.22)' : 'rgba(56,189,248,0.18)'}" stroke="${sat ? '#facc15' : '#0369a1'}" stroke-width="${sat ? 2.2 : 1.6}" fill-rule="evenodd"/>`;
  if (c.m?.stream?.length > 1) s += `<path d="${pl(c.m.stream, F)}" fill="none" stroke="${sat ? '#38bdf8' : '#2563eb'}" stroke-width="2"/>`;
  for (const a of axes) if (a.pts?.length > 1) s += `<path d="${pl(a.pts, F)}" fill="none" stroke="#dc2626" stroke-width="2"/>`;
  s += `<circle cx="${F.X(c.x)}" cy="${F.Y(c.y)}" r="4.5" fill="#dc2626" stroke="#fff" stroke-width="1.2"/><text x="${F.X(c.x) + 7}" y="${F.Y(c.y) - 6}" font-size="11" font-weight="bold" fill="#0f172a" stroke="#fff" stroke-width="3" paint-order="stroke">${E(c.id)} — PK ${nf(c.pk, 0)}</text>`;
  s += '</g>' + scaleBar(F.k, w, h, !!sat);
  s += `<g font-size="10" fill="#1e293b" transform="translate(10 10)"><rect width="390" height="16" rx="3" fill="#fff" fill-opacity="0.85"/><g transform="translate(4 4)"><rect width="12" height="8" fill="rgba(56,189,248,0.22)" stroke="${sat ? '#facc15' : '#0369a1'}"/><text x="16" y="8">bassin versant (${nf(c.totalKm2, 3)} km²)</text><path d="M150,4h16" stroke="${sat ? '#38bdf8' : '#2563eb'}" stroke-width="2"/><text x="170" y="8">écoulement principal</text><path d="M290,4h16" stroke="#dc2626" stroke-width="2"/><text x="310" y="8">tracé</text></g></g>`;
  if (sat) s += `<text x="${w - 6}" y="${h - 5}" font-size="8" text-anchor="end" fill="#fff" stroke="#000" stroke-width="2" paint-order="stroke">Imagerie © Esri, Maxar, Earthstar Geographics</text>`;
  return s + '</svg>';
}

/** Carte d'ensemble : tous les bassins numérotés et les axes. */
export function overviewMapSvg(crossings, axes = [], { w = 900, h = 560, tiles = null } = {}) {
  const pts = [...crossings.flatMap((c) => (c.ring || []).flat()), ...axes.flatMap((a) => a.pts || [])];
  if (!pts.length) return '';
  const bb = { x0: Math.min(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), x1: Math.max(...pts.map((p) => p.x)), y1: Math.max(...pts.map((p) => p.y)) };
  const F = frame(bb, w, h, 30), pal = ['#38bdf8', '#a3e635', '#fbbf24', '#f472b6', '#a78bfa', '#34d399', '#fb923c', '#60a5fa'];
  const id = `om${++UID}`;
  let s = `<svg class="carte" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" font-family="Arial,sans-serif"><defs><clipPath id="${id}"><rect width="${w}" height="${h}"/></clipPath></defs><rect width="${w}" height="${h}" fill="#f8fafc" stroke="#cbd5e1"/><g clip-path="url(#${id})">`;
  const sat = tileImages(tiles, { x0: bb.x0 - (bb.x1 - bb.x0) * 0.1, y0: bb.y0 - (bb.y1 - bb.y0) * 0.1, x1: bb.x1 + (bb.x1 - bb.x0) * 0.1, y1: bb.y1 + (bb.y1 - bb.y0) * 0.1 }, F, w, h); s += sat;
  crossings.forEach((c, i) => { if ((c.ring || []).length) s += `<path d="${c.ring.map((r) => pl(r, F) + 'Z').join('')}" fill="${pal[i % pal.length]}" fill-opacity="0.35" stroke="#1e293b" stroke-width="0.7" fill-rule="evenodd"/>`; });
  for (const a of axes) if (a.pts?.length > 1) s += `<path d="${pl(a.pts, F)}" fill="none" stroke="#dc2626" stroke-width="2"/>`;
  for (const c of crossings) s += `<circle cx="${F.X(c.x)}" cy="${F.Y(c.y)}" r="3.2" fill="#dc2626"/><text x="${F.X(c.x) + 5}" y="${F.Y(c.y) - 5}" font-size="10" font-weight="bold" fill="#0f172a" stroke="#fff" stroke-width="2.5" paint-order="stroke">${E(c.id)}</text>`;
  s += '</g>' + (sat ? `<text x="${w - 6}" y="${h - 5}" font-size="8" text-anchor="end" fill="#fff" stroke="#000" stroke-width="2" paint-order="stroke">Imagerie © Esri, Maxar, Earthstar Geographics</text>` : '');
  return s + scaleBar(F.k, w, h, !!sat) + '</svg>';
}

/** Carte d'isohyètes FAO 54 (kind : 'pan' | 'p10') avec la position du projet et la valeur lue. */
export function isohyetMapSvg(kind, lon, lat, read, { w = 680, h = 440 } = {}) {
  const gj = kind === 'pan' ? PAN : P10, feats = gj.features || [];
  const lines = feats.map((f) => ({ v: f.properties?.valeur_mm, parts: f.geometry?.type === 'LineString' ? [f.geometry.coordinates] : f.geometry?.coordinates || [] })).filter((q) => Number.isFinite(q.v));
  const all = [...lines.flatMap((q) => q.parts.flat()), ...(PAYS.features || []).flatMap((f) => (f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat()).flat())];
  let bb = { x0: Math.min(...all.map((p) => p[0])), x1: Math.max(...all.map((p) => p[0])), y0: Math.min(...all.map((p) => p[1])), y1: Math.max(...all.map((p) => p[1])) };
  if (Number.isFinite(lon)) bb = { x0: Math.min(bb.x0, lon - 1), x1: Math.max(bb.x1, lon + 1), y0: Math.min(bb.y0, lat - 1), y1: Math.max(bb.y1, lat + 1) };
  const cl = Math.cos((((bb.y0 + bb.y1) / 2) * Math.PI) / 180), F = frame({ x0: bb.x0 * cl, x1: bb.x1 * cl, y0: bb.y0, y1: bb.y1 }, w, h, 20);
  const P = (q) => `${F.X(q[0] * cl).toFixed(1)},${F.Y(q[1]).toFixed(1)}`;
  let s = `<svg class="carte" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" font-family="Arial,sans-serif"><rect width="${w}" height="${h}" fill="#f8fafc" stroke="#cbd5e1"/>`;
  for (let g = Math.ceil(bb.x0 / 5) * 5; g <= bb.x1; g += 5) s += `<line x1="${F.X(g * cl)}" x2="${F.X(g * cl)}" y1="0" y2="${h}" stroke="#e2e8f0"/><text x="${F.X(g * cl) + 2}" y="${h - 4}" font-size="9" fill="#94a3b8">${g < 0 ? `${-g}° W` : `${g}° E`}</text>`;
  for (let g = Math.ceil(bb.y0 / 5) * 5; g <= bb.y1; g += 5) s += `<line y1="${F.Y(g)}" y2="${F.Y(g)}" x1="0" x2="${w}" stroke="#e2e8f0"/><text y="${F.Y(g) - 2}" x="3" font-size="9" fill="#94a3b8">${g}° N</text>`;
  for (const f of PAYS.features || []) { const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates; for (const poly of polys) s += `<path d="${poly.map((r) => 'M' + r.map(P).join('L') + 'Z').join('')}" fill="#fff" stroke="#94a3b8" stroke-width="0.7"/>`; }
  for (const q of lines) for (const part of q.parts) if (part.length > 1) {
    s += `<path d="M${part.map(P).join('L')}" fill="none" stroke="#2563eb" stroke-width="0.9"/>`;
    const mid = part[Math.floor(part.length / 2)];
    s += `<text x="${F.X(mid[0] * cl)}" y="${F.Y(mid[1])}" font-size="8.5" fill="#1d4ed8" text-anchor="middle" stroke="#f8fafc" stroke-width="2.4" paint-order="stroke">${q.v}</text>`;
  }
  if (Number.isFinite(lon)) s += `<circle cx="${F.X(lon * cl)}" cy="${F.Y(lat)}" r="5" fill="#dc2626" stroke="#fff" stroke-width="1.5"/><text x="${F.X(lon * cl) + 8}" y="${F.Y(lat) + 4}" font-size="11" font-weight="bold" fill="#dc2626" stroke="#fff" stroke-width="3" paint-order="stroke">${read?.ok ? `${nf(read.value, 0)} mm` : 'hors faisceau'}</text>`;
  s += `<text x="10" y="16" font-size="12" font-weight="bold" fill="#0f172a">${kind === 'pan' ? 'Pluie annuelle moyenne Pan (mm) — bulletin FAO 54, figure 3' : 'Pluie journalière décennale P10 (mm) — bulletin FAO 54, figure 4'}</text>`;
  return s + '</svg>';
}
