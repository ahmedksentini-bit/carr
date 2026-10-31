// pt.js — profils en travers des branches : à chaque station s de l'axe projet, coupe perpendiculaire à l'axe,
// plateforme projet (îlot séparateur ou TPC en saillie, voies avec leur dévers, BDD et berme en interurbain, caniveau,
// bordure, trottoir et contre-bordure en urbain), talus de déblai (1/1 par défaut) et de remblai (3/2 par défaut)
// jusqu'au terrain naturel du MNT, surfaces de déblai / remblai et volumes entre stations (méthode des aires moyennes).
// Repère local de la coupe : y transversal (positif à gauche en regardant vers l'extérieur = côté entrée), z altitude.
import * as G from './geom.js';
import { fmt } from './common.js';
import { sectionParams, sideBands } from './norms.js';
import { tinZ } from './tin.js';
import { DxfWriter } from './dxf-write.js';
import { axisPointAt, axisLength } from './pl.js';

const num = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);

// Paramètres des profils en travers du projet : { step, halfW, remblai (H/V), deblai (H/V), fosse (profondeur), stations }.
export function ptParams(prj) {
  const p = prj.pt || {};
  return { step: Math.max(2, num(p.step, 20)), halfW: Math.max(5, num(p.halfW, 25)), remblai: Math.max(0.1, num(p.remblai, 1.5)), deblai: Math.max(0.1, num(p.deblai, 1)), fosse: Math.max(0, num(p.fosse, 0)), fosseW: Math.max(0.3, num(p.fosseW, 1.5)) };
}

// Plateforme projet à la station s de la branche bd : [{ y, z, label }] du côté sortie (y < 0) au côté entrée (y > 0).
function platform(prj, bd, s, sec) {
  const { p, t } = axisPointAt(bd, s), n = G.rot90(t);
  const at = (y) => G.add(p, G.mul(n, y));
  const zOf = (y) => bd.zAt(at(y));
  const half = [];
  // Largeur de l'îlot séparateur (triangle de construction) ou du TPC à cette abscisse.
  const isl = s < (bd.h || 0) && (bd.b || 0) > 0 ? Math.max(bd.th || 0, ((bd.b || 0) * (1 - s / bd.h)) / 2) : bd.th || 0;
  const raised = isl > 0.05 && (bd.island?.outline ? true : (bd.th || 0) > 0);
  const bands = sideBands(prj, sec);
  for (const sd of [1, -1]) {
    const w = sd > 0 ? (s < (bd.h || 0) ? bd.entry?.w : bd.entry?.wa ?? bd.entry?.w) : (s < (bd.h || 0) ? bd.exit?.w : bd.exit?.wa ?? bd.exit?.w);
    const wl = w ?? 3.5, pts = [];
    const a = bd.a || 0;
    let y = a + sd * isl, z = zOf(y);
    if (raised) pts.push({ y, z: z + (sec.ilotVue || 0.06), label: 'îlot' });
    pts.push({ y, z, label: isl > 0 ? 'rive' : 'axe' });
    y += sd * wl; z = zOf(y); pts.push({ y, z, label: `voie${wl > 4 ? 's' : ''} ${fmt(wl, 2)}` });
    const slopeLane = (zOf(y) - zOf(y - sd * 1)) * 1; // pente transversale au bord (m/m, vers l'extérieur)
    if (sec.bdd > 0) { y += sd * sec.bdd; z += slopeLane * sec.bdd; pts.push({ y, z, label: `BDD ${fmt(sec.bdd, 2)}` }); }
    for (const [nm, bw] of bands) {
      if (nm === 'caniveau') { y += sd * bw; z += slopeLane * bw; pts.push({ y, z, label: 'caniveau' }); }
      else if (nm === 'bordure') { pts.push({ y, z: z + sec.bordureVue, label: 'bordure' }); z += sec.bordureVue; y += sd * bw; pts.push({ y, z, label: '' }); }
      else if (nm === 'trottoir') { z += (sec.trottoirPente / 100) * bw; y += sd * bw; pts.push({ y, z, label: `trottoir ${fmt(bw, 2)}` }); }
      else if (nm === 'contre-bordure') { y += sd * bw; pts.push({ y, z, label: '' }); }
      else if (nm === 'berme') { z -= (sec.bermePente / 100) * bw; y += sd * bw; pts.push({ y, z, label: `berme ${fmt(bw, 2)}` }); }
    }
    half.push(pts);
  }
  // Côté sortie inversé puis côté entrée : polyligne continue de gauche (y < 0) à droite.
  const left = half[1].slice().reverse(), right = half[0];
  if (!raised && isl <= 0.05) return { line: [...left, ...right.slice(1)], p, t, n };
  return { line: [...left, ...right], p, t, n };
}

// TN le long de la coupe : [{ y, z }] de −halfW à +halfW (pas 0,5 m) ; null si hors MNT.
function terrainLine(tin, p, n, halfW, step = 0.5) {
  const out = [];
  for (let y = -halfW; y <= halfW + 1e-9; y += step) { const q = G.add(p, G.mul(n, y)); const z = tin ? tinZ(tin, q.x, q.y) : null; out.push({ y, z }); }
  return out;
}
const tnAt = (tl, y) => {
  for (let i = 0; i + 1 < tl.length; i++) {
    const a = tl[i], b = tl[i + 1];
    if (y >= a.y - 1e-9 && y <= b.y + 1e-9) { if (a.z == null || b.z == null) return null; return a.z + ((y - a.y) / (b.y - a.y)) * (b.z - a.z); }
  }
  return null;
};

// Talus depuis le point de plateforme (y0, z0) vers l'extérieur (sd = ±1) : point d'entrée en terre ou null.
function talus(tl, y0, z0, sd, P, halfW) {
  const zt0 = tnAt(tl, y0);
  if (zt0 == null) return null;
  const fill = z0 > zt0, pente = fill ? 1 / P.remblai : 1 / P.deblai; // V/H
  const pts = [];
  let y = y0, z = z0;
  if (!fill && P.fosse > 0) { // fossé triangulaire en déblai : fond au milieu, le talus repart du fond
    y += (sd * P.fosseW) / 2; z -= P.fosse; pts.push({ y, z, label: 'fossé' });
  }
  const dz = fill ? -pente : pente;
  for (let dy = 0.1; Math.abs(y + sd * dy) <= halfW; dy += 0.1) {
    const yy = y + sd * dy, zz = z + dz * dy, zt = tnAt(tl, yy);
    if (zt == null) return { pts, end: null };
    if (fill ? zz <= zt : zz >= zt) { pts.push({ y: yy, z: zt, label: fill ? 'remblai' : 'déblai' }); return { pts, end: { y: yy, z: zt }, fill }; }
  }
  return { pts, end: null, fill };
}

// Surfaces de déblai et de remblai entre la ligne projet (plateforme + talus) et le TN, par intégration à 0,1 m.
function areas(proj, tl) {
  const zP = (y) => { for (let i = 0; i + 1 < proj.length; i++) { const a = proj[i], b = proj[i + 1]; if (y >= a.y - 1e-9 && y <= b.y + 1e-9) return b.y - a.y < 1e-9 ? Math.max(a.z, b.z) : a.z + ((y - a.y) / (b.y - a.y)) * (b.z - a.z); } return null; };
  let cut = 0, fill = 0;
  const y0 = proj[0].y, y1 = proj[proj.length - 1].y, dy = 0.1;
  for (let y = y0; y < y1; y += dy) {
    const zp = zP(y + dy / 2), zt = tnAt(tl, y + dy / 2);
    if (zp == null || zt == null) continue;
    if (zp > zt) fill += (zp - zt) * dy; else cut += (zt - zp) * dy;
  }
  return { cut, fill };
}

// Profil en travers complet à la station s : { s, p, platform, proj, tn, cut, fill, endL, endR, ok }.
export function crossSection(prj, bd, s, tin, P = ptParams(prj)) {
  const sec = sectionParams(prj);
  const pf = platform(prj, bd, s, sec);
  const tl = terrainLine(tin, pf.p, pf.n, P.halfW);
  const L0 = pf.line[0], R0 = pf.line[pf.line.length - 1];
  const tL = talus(tl, L0.y, L0.z, -1, P, P.halfW), tR = talus(tl, R0.y, R0.z, 1, P, P.halfW);
  const proj = [...(tL ? tL.pts.slice().reverse() : []), ...pf.line, ...(tR ? tR.pts : [])];
  const hasTN = tl.some((q) => q.z != null);
  const ar = hasTN ? areas(proj, tl) : { cut: 0, fill: 0 };
  return { s, p: pf.p, n: pf.n, platform: pf.line, proj, tn: tl, cut: ar.cut, fill: ar.fill, endL: tL?.end, endR: tR?.end, ok: hasTN, zAxe: bd.zAt(pf.p), zTN: tin ? tinZ(tin, pf.p.x, pf.p.y) : null, halfW: P.halfW };
}

// Stations régulières (pas P.step) de 0 à la fin de l'axe, avec les volumes cumulés (aires moyennes).
export function crossSections(prj, bd, tin, P = ptParams(prj)) {
  const sEnd = axisLength(bd), ss = [];
  for (let s = 0; s < sEnd - 1e-6; s += P.step) ss.push(Math.round(s * 100) / 100);
  ss.push(Math.round(sEnd * 100) / 100);
  const out = ss.map((s) => crossSection(prj, bd, s, tin, P));
  let vc = 0, vf = 0;
  out.forEach((cs, i) => {
    if (i) { const d = cs.s - out[i - 1].s; vc += ((cs.cut + out[i - 1].cut) / 2) * d; vf += ((cs.fill + out[i - 1].fill) / 2) * d; }
    cs.vCut = vc; cs.vFill = vf;
  });
  return out;
}

// --------------------------------------------------------------------------- Graphique SVG d'une coupe
export function ptChartSVG(cs, opts = {}) {
  const w = opts.w || 600, h = opts.h || 300, m = { l: 44, r: 14, t: 22, b: 36 };
  const zs = [...cs.proj.map((q) => q.z), ...cs.tn.filter((q) => q.z != null).map((q) => q.z)];
  let zmin = Math.min(...zs), zmax = Math.max(...zs);
  if (!(zmax - zmin > 0.5)) { zmin -= 0.5; zmax += 0.5; }
  const sx = (w - m.l - m.r) / (2 * cs.halfW);
  const veAuto = Math.max(1, Math.min(10, Math.floor((h - m.t - m.b) / ((zmax - zmin) * sx) / 1.2)));
  const ve = opts.ve > 0 ? opts.ve : veAuto, sz = sx * ve, zc = (zmin + zmax) / 2;
  const X = (y) => m.l + (y + cs.halfW) * sx, Y = (z) => Math.max(m.t, Math.min(h - m.b, m.t + (h - m.t - m.b) / 2 - (z - zc) * sz));
  let out = `<svg viewBox="0 0 ${w} ${h}" class="plsvg">`;
  const gy = niceStep(cs.halfW / 4), gz = niceStep((zmax - zmin) / 4);
  for (let y = -Math.floor(cs.halfW / gy) * gy; y <= cs.halfW; y += gy) out += `<line class="gl" x1="${X(y)}" y1="${m.t}" x2="${X(y)}" y2="${h - m.b}"/><text class="tk" x="${X(y)}" y="${h - m.b + 14}" text-anchor="middle">${fmt(y, 0)}</text>`;
  for (let z = Math.ceil(zmin / gz) * gz; z <= zmax + 1e-9; z += gz) { const yy = Y(z); if (yy <= m.t || yy >= h - m.b) continue; out += `<line class="gl" x1="${m.l}" y1="${yy}" x2="${w - m.r}" y2="${yy}"/><text class="tk" x="${m.l - 5}" y="${yy + 4}" text-anchor="end">${fmt(z, gz < 1 ? 1 : 0)}</text>`; }
  out += `<rect x="${m.l}" y="${m.t}" width="${w - m.l - m.r}" height="${h - m.t - m.b}" class="ax" fill="none"/>`;
  // Déblai / remblai entre projet et TN
  const tnOk = cs.tn.filter((q) => q.z != null);
  if (tnOk.length > 1) {
    let fill = '', cut = '';
    const zP = (y) => { for (let i = 0; i + 1 < cs.proj.length; i++) { const a = cs.proj[i], b = cs.proj[i + 1]; if (y >= a.y - 1e-9 && y <= b.y + 1e-9) return b.y - a.y < 1e-9 ? Math.max(a.z, b.z) : a.z + ((y - a.y) / (b.y - a.y)) * (b.z - a.z); } return null; };
    const y0 = cs.proj[0].y, y1 = cs.proj[cs.proj.length - 1].y;
    for (let y = y0; y < y1 - 1e-9; y += 0.25) {
      const ya = y, yb = Math.min(y1, y + 0.25), pa = zP(ya), pb = zP(yb), ta = tnAt(cs.tn, ya), tb = tnAt(cs.tn, yb);
      if (pa == null || pb == null || ta == null || tb == null) continue;
      const poly = `M${X(ya).toFixed(1)},${Y(ta).toFixed(1)} L${X(yb).toFixed(1)},${Y(tb).toFixed(1)} L${X(yb).toFixed(1)},${Y(pb).toFixed(1)} L${X(ya).toFixed(1)},${Y(pa).toFixed(1)}Z`;
      if ((pa + pb) / 2 >= (ta + tb) / 2) fill += poly; else cut += poly;
    }
    out += `<path class="pl-fill" d="${fill}"/><path class="pl-cut" d="${cut}"/>`;
    out += `<path class="pl-tn" d="${tnOk.map((q, i) => `${i ? 'L' : 'M'}${X(q.y).toFixed(1)},${Y(q.z).toFixed(1)}`).join('')}"/>`;
  }
  out += `<path class="pl-red" d="${cs.proj.map((q, i) => `${i ? 'L' : 'M'}${X(q.y).toFixed(1)},${Y(q.z).toFixed(1)}`).join('')}"/>`;
  for (const q of cs.platform) if (q.label && /^(voie|berme|trottoir|îlot)/.test(q.label)) out += `<text class="pl-lb" x="${X(q.y)}" y="${Y(q.z) - 6}" text-anchor="middle" font-size="9">${q.label}</text>`;
  out += `<line class="pl-tg" x1="${X(0)}" y1="${m.t}" x2="${X(0)}" y2="${h - m.b}"/>`;
  out += `<text class="pf-note" x="${w - m.r}" y="12" text-anchor="end">s = ${fmt(cs.s, 1)} m · exagération × ${ve}</text>`;
  out += `<text class="al" x="${m.l}" y="12">axe z ${fmt(cs.zAxe)}${cs.zTN != null ? ` · TN ${fmt(cs.zTN)}` : ''} · déblai ${fmt(cs.cut, 2)} m² · remblai ${fmt(cs.fill, 2)} m²</text></svg>`;
  return out;
}
function niceStep(v) { const p = 10 ** Math.floor(Math.log10(Math.max(1e-9, v))), r = v / p; return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * p; }

// --------------------------------------------------------------------------- DXF : toutes les coupes en planches
export function ptDXF(list, title, ve = 2, cols = 3) {
  const w = new DxfWriter().layer('GIRA_PT_TN', 8).layer('GIRA_PT_PROJET', 1).layer('GIRA_PT_COTES', 4);
  const H = 0.4, W = list[0] ? 2 * list[0].halfW + 10 : 60;
  let maxH = 0;
  for (const cs of list) { const zs = [...cs.proj.map((q) => q.z), ...cs.tn.filter((q) => q.z != null).map((q) => q.z)]; maxH = Math.max(maxH, (Math.max(...zs) - Math.min(...zs)) * ve + 6); }
  list.forEach((cs, i) => {
    const ox = (i % cols) * W, oy = -Math.floor(i / cols) * maxH;
    const zs = cs.proj.map((q) => q.z), zref = Math.floor(Math.min(...zs, ...cs.tn.filter((q) => q.z != null).map((q) => q.z)) - 1);
    const X = (y) => ox + y + cs.halfW, Y = (z) => oy + (z - zref) * ve;
    const tn = cs.tn.filter((q) => q.z != null);
    for (let k = 0; k + 1 < tn.length; k++) w.line('GIRA_PT_TN', { x: X(tn[k].y), y: Y(tn[k].z) }, { x: X(tn[k + 1].y), y: Y(tn[k + 1].z) });
    w.poly('GIRA_PT_PROJET', cs.proj.map((q) => ({ x: X(q.y), y: Y(q.z), b: 0 })));
    w.line('GIRA_PT_COTES', { x: X(-cs.halfW), y: oy }, { x: X(cs.halfW), y: oy });
    w.line('GIRA_PT_COTES', { x: X(0), y: oy }, { x: X(0), y: Y(cs.zAxe) + 1 });
    w.text('GIRA_PT_COTES', { x: X(-cs.halfW), y: oy - 1.2 }, H, 0, `PT s = ${fmt(cs.s, 1)} m — axe z ${fmt(cs.zAxe)} · TN ${cs.zTN == null ? '—' : fmt(cs.zTN)} · D ${fmt(cs.cut, 2)} m² · R ${fmt(cs.fill, 2)} m² · plan de comparaison ${fmt(zref, 0)}`);
    for (const q of cs.platform) if (q.label) w.text('GIRA_PT_COTES', { x: X(q.y), y: Y(q.z) + 0.3 }, H * 0.7, 0, `${q.label} ${fmt(q.z, 2)}`, 'center');
  });
  w.text('GIRA_PT_COTES', { x: 0, y: 3 }, H * 2, 0, `${title} — exagération verticale × ${ve}`);
  return w.toString();
}
