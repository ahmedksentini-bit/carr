// ohcoupe.js — coupe longitudinale d'un ouvrage hydraulique (cadre, PIPO, buse), comme la planche de BVTrace
// (renderOhLongSectionA4) : feuille paysage A4 / A3 / A2, vue en plan en haut, coupe le long de l'axe de l'ouvrage en
// bas, même échelle en plan et en coupe (H = V). L'ouvrage est dans le même sens sur les deux vues (même côté à gauche),
// la route va du bas vers le haut (PK croissants) sur le plan.
//
// Coupe : terrain naturel le long de l'axe de l'ouvrage (MNT), ligne projet de la route reportée le long de l'ouvrage
// (profil en travers de l'axe porteur au droit de l'ouvrage, abscisses divisées par le sinus du biais), corps de
// l'ouvrage (radier, ouverture, traverse) calé sur les fils d'eau, fil d'eau coté aux deux faces et au droit de l'axe,
// pente, longueurs de part et d'autre de l'axe, remblai sur traverse, PHE amont si l'hydraulique est calculée.
import * as G from './geom.js';
import { PAPERS, fmtPk, primSvg, txt, STY, LAYERS } from './combine.js';

const f2 = (v, d = 2) => (v == null || !Number.isFinite(+v) ? '—' : (+v).toFixed(d).replace('.', ',').replace('-', '−'));
const P = (x, y) => `${x.toFixed(2)},${y.toFixed(2)}`;

/**
 * @param o { name, K, g: { p, d, t, s }, zLeft, zRight (fils d'eau des faces −d / +d), upLeft (amont à gauche),
 *   zR (chaussée à l'axe), cs (profil en travers : proj [{ y, z }], n) ou null, tnAt(x) → z | null le long de l'ouvrage,
 *   prims, format, scale (0 = ajusté), pk, axisName, phe, project }
 * @returns {{ svg, scale, paper }}
 */
export function ohSheet(o) {
  const [PW, PH] = PAPERS[o.format] || PAPERS.A3, M = 12, inner = { x: M, y: M, w: PW - 2 * M, h: PH - 2 * M };
  const { K, g } = o, Lm = K.Lm, Lp = K.Lp, ext = Math.max(4, 0.25 * (Lm + Lp));
  const x0 = -Lm - ext, x1 = Lp + ext;
  // ouverture : B (buse : diamètre), parois
  const er = K.type === 'pipo' ? 0 : K.er, et = K.et, H = K.H;
  const zfe = (x) => o.zLeft + ((o.zRight - o.zLeft) * (x + Lm)) / Math.max(1e-6, Lm + Lp);
  // ligne projet de la route le long de l'ouvrage : y (décalage à gauche de l'axe porteur) = x · (d · n)
  const dn = o.cs ? G.dot(g.d, o.cs.n) : G.cross(g.t, g.d);
  const road = o.cs && Math.abs(dn) > 0.05 ? o.cs.proj.map((q) => ({ x: q.y / dn, z: q.z })).sort((a, b) => a.x - b.x).filter((q) => q.x >= x0 - 1 && q.x <= x1 + 1) : [];
  const tn = []; for (let x = x0; x <= x1 + 1e-9; x += Math.max(0.25, (x1 - x0) / 300)) { const z = o.tnAt(x); if (z != null) tn.push({ x, z }); }
  const zs = [zfe(-Lm) - er, zfe(Lp) - er, zfe(0) + H + et, ...road.map((q) => q.z), ...tn.map((q) => q.z), o.zR, o.phe].filter((v) => v != null && Number.isFinite(v));
  const zLo = Math.min(...zs) - 1, zHi = Math.max(...zs) + 1;
  // zones : titre, plan (haut), coupe (bas, moitié de la zone utile)
  const titleH = 10, gap = 4, avail = inner.h - titleH - gap, planR = { x: inner.x, y: inner.y + titleH, w: inner.w, h: avail * 0.45 }, secR = { x: inner.x, y: planR.y + planR.h + gap, w: inner.w, h: avail - planR.h };
  const labelW = 38, plotX = inner.x + labelW, plotW = inner.w - labelW - 6;
  const kFit = Math.min(plotW / (x1 - x0), (secR.h - 26) / (zHi - zLo));
  const scales = [50, 100, 200, 250, 400, 500, 1000];
  const scale = o.scale > 0 ? o.scale : (scales.find((sc) => 1000 / sc <= kFit) || 1000);
  const k = 1000 / scale;
  const cx = plotX + plotW / 2, X = (x) => cx + (x - (x0 + x1) / 2) * k;
  let svg = `<svg class="sheet" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} ${PH}" width="${PW}mm" height="${PH}mm" font-family="Arial, Helvetica, sans-serif">`;
  svg += `<rect x="${inner.x}" y="${inner.y}" width="${inner.w}" height="${inner.h}" fill="none" stroke="#000" stroke-width="0.5"/>`;
  const dims = K.type === 'buse' ? `${K.n > 1 ? `${K.n} × ` : ''}buse Ø ${f2(K.B)}` : `${K.n > 1 ? `${K.n} × ` : ''}${f2(K.B)} × ${f2(K.H)}`;
  svg += txt(inner.x + 3, inner.y + 6.5, `COUPE LONGITUDINALE — ${o.name} · ${dims}`, 3.6, { w: 'bold' });
  svg += txt(inner.x + inner.w - 3, inner.y + 4.5, `${o.project || ''} · ${o.axisName} PK ${fmtPk(o.pk).replace(/,00$/, '')} · biais ${f2(K.ang, 1)} gr · L ${f2(K.L)} m`, 2.4, { a: 'end' });
  svg += txt(inner.x + inner.w - 3, inner.y + 8.3, `Plan et coupe au 1/${scale} (H = V)`, 2.4, { a: 'end', w: 'bold' });
  svg += `<line x1="${inner.x}" y1="${inner.y + titleH}" x2="${inner.x + inner.w}" y2="${inner.y + titleH}" stroke="#000" stroke-width="0.3"/>`;

  // ------------------------------------------------------------------ plan
  // repère : x le long de l'ouvrage (+d vers la droite), e perpendiculaire orienté pour que la route monte (PK+)
  let e = G.rot90(g.d); if (G.dot(e, g.t) < 0) e = G.neg(e);
  const yMid = planR.y + planR.h / 2, T = (q) => { const v = G.sub(q, g.p); return { x: X(G.dot(v, g.d)), y: yMid - G.dot(v, e) * k }; };
  svg += `<clipPath id="ohcp"><rect x="${plotX}" y="${planR.y}" width="${plotW}" height="${planR.h}"/></clipPath>`;
  svg += `<line x1="${inner.x}" y1="${secR.y - gap / 2}" x2="${inner.x + inner.w}" y2="${secR.y - gap / 2}" stroke="#000" stroke-width="0.3"/>`;
  svg += txt(inner.x + 3, planR.y + 5, 'VUE EN PLAN', 2.6, { w: 'bold' });
  svg += `<g clip-path="url(#ohcp)">`;
  const R = Math.hypot(plotW, planR.h) / k / 2 + 5;
  // primitive retenue si sa boîte englobante touche le carré de demi-côté R autour de l'ouvrage
  const near = (pr) => {
    if (pr.k === 'hatch') return pr.lines.some(([a, b]) => Math.max(a.x, b.x) >= g.p.x - R && Math.min(a.x, b.x) <= g.p.x + R && Math.max(a.y, b.y) >= g.p.y - R && Math.min(a.y, b.y) <= g.p.y + R);
    const pts = pr.k === 'path' ? pr.segs.flatMap((sg) => [sg.a, sg.b, sg.c].filter(Boolean)) : pr.k === 'fill' ? pr.rings.flatMap((r) => r.flatMap((sg) => [sg.a, sg.b, sg.c].filter(Boolean))) : pr.p ? [pr.p] : pr.c ? [pr.c] : [];
    if (!pts.length) return false;
    let xa = Infinity, ya = Infinity, xb = -Infinity, yb = -Infinity;
    for (const q of pts) { if (q.x < xa) xa = q.x; if (q.x > xb) xb = q.x; if (q.y < ya) ya = q.y; if (q.y > yb) yb = q.y; }
    return !(xb < g.p.x - R || xa > g.p.x + R || yb < g.p.y - R || ya > g.p.y + R);
  };
  const inBox = ([a, b]) => Math.max(a.x, b.x) >= g.p.x - R && Math.min(a.x, b.x) <= g.p.x + R && Math.max(a.y, b.y) >= g.p.y - R && Math.min(a.y, b.y) <= g.p.y + R;
  for (const L of LAYERS) for (const pr of o.prims || []) if (pr.L === L && near(pr)) svg += primSvg(pr.k === 'hatch' ? { ...pr, lines: pr.lines.filter(inBox) } : pr, STY[L], T, k);
  // axe de l'ouvrage, faces, sens d'écoulement
  const A = T(G.add(g.p, G.mul(g.d, x0))), B = T(G.add(g.p, G.mul(g.d, x1)));
  svg += `<line x1="${A.x.toFixed(2)}" y1="${A.y.toFixed(2)}" x2="${B.x.toFixed(2)}" y2="${B.y.toFixed(2)}" stroke="#1d4ed8" stroke-width="0.2" stroke-dasharray="4 1 1 1"/>`;
  const fl = o.upLeft ? 1 : -1, ar = T(G.add(g.p, G.mul(g.d, (fl > 0 ? Lp : -Lm) + fl * 1.5))), ar0 = T(G.add(g.p, G.mul(g.d, (fl > 0 ? Lp : -Lm) + fl * 0.3)));
  svg += `<line x1="${ar0.x.toFixed(2)}" y1="${ar0.y.toFixed(2)}" x2="${ar.x.toFixed(2)}" y2="${ar.y.toFixed(2)}" stroke="#1d4ed8" stroke-width="0.35"/><path d="M${P(ar.x, ar.y)}l${(-fl * 1.6).toFixed(2)},-0.8v1.6Z" fill="#1d4ed8"/>`;
  svg += '</g>';
  const aL = T(G.add(g.p, G.mul(g.d, -Lm))), aR = T(G.add(g.p, G.mul(g.d, Lp)));
  svg += txt(Math.max(plotX + 2, aL.x - 2), planR.y + planR.h - 3, o.upLeft ? 'AMONT' : 'AVAL', 2.4, { a: 'end', w: 'bold', c: '#1d4ed8', halo: true });
  svg += txt(Math.min(plotX + plotW - 2, aR.x + 2), planR.y + planR.h - 3, o.upLeft ? 'AVAL' : 'AMONT', 2.4, { w: 'bold', c: '#1d4ed8', halo: true });
  const ra = T(G.add(g.p, G.mul(g.t, Math.min(R, planR.h / 2 / k) * 0.8)));
  svg += txt(ra.x + 1.5, Math.max(planR.y + 4, ra.y), `${o.axisName} ↑ PK+`, 2.2, { c: '#b91c1c', halo: true });

  // ------------------------------------------------------------------ coupe
  svg += txt(inner.x + 3, secR.y + 5, 'COUPE LONGITUDINALE', 2.6, { w: 'bold' });
  const zMid = (zLo + zHi) / 2, yS = secR.y + 8 + (secR.h - 26) / 2, Y = (z) => yS - (z - zMid) * k;
  // échelle des cotes à gauche
  const stepZ = k >= 8 ? 0.5 : k >= 3 ? 1 : 2;
  for (let z = Math.ceil(zLo / stepZ) * stepZ; z <= zHi + 1e-9; z += stepZ) {
    const y = Y(z); if (y < secR.y + 7 || y > secR.y + secR.h - 16) continue;
    svg += `<line x1="${plotX}" y1="${y.toFixed(2)}" x2="${(plotX + plotW).toFixed(2)}" y2="${y.toFixed(2)}" stroke="#eef0f3" stroke-width="0.12"/>`;
    svg += `<line x1="${plotX - 1.5}" y1="${y.toFixed(2)}" x2="${plotX}" y2="${y.toFixed(2)}" stroke="#000" stroke-width="0.15"/>` + txt(plotX - 2.2, y + 0.7, f2(z, stepZ < 1 ? 1 : 0), 1.9, { a: 'end' });
  }
  svg += `<line x1="${plotX}" y1="${secR.y + 7}" x2="${plotX}" y2="${(secR.y + secR.h - 16).toFixed(2)}" stroke="#000" stroke-width="0.2"/>`;
  // terrain naturel, remblai sous la route
  const line = (pts) => pts.map((q, i) => `${i ? 'L' : 'M'}${P(X(q.x), Y(q.z))}`).join('');
  if (road.length > 1 && tn.length > 1) {
    const poly = [...road, ...tn.slice().reverse()];
    svg += `<path d="${line(poly)}Z" fill="#f5ead7" stroke="none"/>`;
  }
  if (tn.length > 1) svg += `<path d="${line(tn)}" fill="none" stroke="#7c5e2a" stroke-width="0.35"/>`;
  if (road.length > 1) svg += `<path d="${line(road)}" fill="none" stroke="#cd1c24" stroke-width="0.45"/>`;
  // corps de l'ouvrage : radier, ouverture, traverse (buse : paroi d'épaisseur ep autour du diamètre)
  const wall = K.type === 'buse' ? K.ep : 0, bot = (x) => zfe(x) - (K.type === 'buse' ? wall : er), top = (x) => zfe(x) + H + (K.type === 'buse' ? wall : et);
  svg += `<path d="M${P(X(-Lm), Y(bot(-Lm)))}L${P(X(Lp), Y(bot(Lp)))}L${P(X(Lp), Y(top(Lp)))}L${P(X(-Lm), Y(top(-Lm)))}Z" fill="#d1d5db" stroke="#111" stroke-width="0.3"/>`;
  svg += `<path d="M${P(X(-Lm), Y(zfe(-Lm)))}L${P(X(Lp), Y(zfe(Lp)))}L${P(X(Lp), Y(zfe(Lp) + H))}L${P(X(-Lm), Y(zfe(-Lm) + H))}Z" fill="#fff" stroke="#111" stroke-width="0.2"/>`;
  // têtes : mur de tête au-dessus de la traverse (murette) aux deux faces
  if (K.type !== 'buse') for (const [x, sg] of [[-Lm, -1], [Lp, 1]]) {
    const hm = Math.min(0.6, Math.max(0.3, K.Hr * 0.4)), tw = 0.25;
    svg += `<path d="M${P(X(x), Y(top(x)))}L${P(X(x), Y(top(x) + hm))}L${P(X(x - sg * tw), Y(top(x) + hm))}L${P(X(x - sg * tw), Y(top(x)))}Z" fill="#d1d5db" stroke="#111" stroke-width="0.2"/>`;
  }
  // fil d'eau : ligne et cotes
  svg += `<path d="M${P(X(-Lm), Y(zfe(-Lm)))}L${P(X(Lp), Y(zfe(Lp)))}" stroke="#1d4ed8" stroke-width="0.35" stroke-dasharray="1.6 0.8"/>`;
  const callout = (x, z, label, side) => {
    const xa = X(x), ya = Y(z), xb = xa + side * 9, yb = ya + 7;
    return `<path d="M${P(xa, ya)}L${P(xb, yb)}h${side * 3}" fill="none" stroke="#1d4ed8" stroke-width="0.15"/><path d="M${P(xa, ya)}l-0.7,-1.2h1.4Z" fill="#1d4ed8"/>` + txt(xb + side * 3.5, yb + 0.7, label, 2.1, { a: side > 0 ? 'start' : 'end', c: '#1d4ed8', w: 'bold', halo: true });
  };
  svg += callout(-Lm, zfe(-Lm), `ZFE ${o.upLeft ? 'amont' : 'aval'} ${f2(zfe(-Lm))}`, -1);
  svg += callout(Lp, zfe(Lp), `ZFE ${o.upLeft ? 'aval' : 'amont'} ${f2(zfe(Lp))}`, 1);
  const J = (o.zLeft - o.zRight) / Math.max(1e-6, Lm + Lp) * (o.upLeft ? 1 : -1);
  const xm = (Lp - Lm) / 2 + (Lm + Lp) * 0.22;
  svg += txt(X(xm), Y(zfe(xm) + H / 2) + 0.8, `pente ${f2(J * 100)} %`, 2, { a: 'middle', c: '#1d4ed8' });
  // axe de la route
  const zAxR = o.zR;
  svg += `<line x1="${X(0).toFixed(2)}" y1="${(secR.y + 7).toFixed(2)}" x2="${X(0).toFixed(2)}" y2="${(secR.y + secR.h - 16).toFixed(2)}" stroke="#b91c1c" stroke-width="0.15" stroke-dasharray="4 1 1 1"/>`;
  svg += txt(X(0) + 1, secR.y + 9.5, `axe ${o.axisName} · PK ${fmtPk(o.pk).replace(/,00$/, '')}`, 2, { c: '#b91c1c', halo: true });
  if (zAxR != null) svg += txt(X(0) + 1, Y(zAxR) - 1.2, `chaussée ${f2(zAxR)}`, 2, { c: '#b91c1c', w: 'bold', halo: true });
  svg += txt(X(0) + 1, Y(zfe(0)) + 3, `FE axe ${f2(zfe(0))}`, 2, { c: '#1d4ed8', w: 'bold', halo: true });
  if (zAxR != null) { const hr = zAxR - top(0); svg += txt(X(0) - 1, (Y(zAxR) + Y(top(0))) / 2 + 0.7, `remblai sur traverse ${f2(hr)} m`, 1.9, { a: 'end', c: hr < 0 ? '#dc2626' : '#374151', halo: true }); }
  // ligne d'eau du calcul hydraulique : plan d'eau amont (PHE), hauteur à l'entrée, hauteur normale dans l'ouvrage,
  // hauteur à la sortie, plan d'eau aval
  const hy = o.hyd;
  if (hy && o.phe != null && Number.isFinite(o.phe)) {
    const xUp = o.upLeft ? -Lm : Lp, xDn = o.upLeft ? Lp : -Lm, sgn = o.upLeft ? 1 : -1, zUp = zfe(xUp), zDn = zfe(xDn), Hin = H;
    const ok = (v) => Number.isFinite(v) && v > 0;
    const yIn = Math.min(Hin, ok(hy.yIn) ? hy.yIn : ok(hy.yc) ? hy.yc : Hin), yOut = Math.min(Hin, ok(hy.yOut) ? hy.yOut : ok(hy.yn) ? hy.yn : yIn);
    const pts = [{ x: xUp - sgn * ext * 0.9, z: o.phe }, { x: xUp, z: o.phe }, { x: xUp, z: zUp + yIn }];
    if (ok(hy.yn) && hy.yn < Hin) pts.push({ x: xUp + sgn * (Lm + Lp) * 0.35, z: zfe(xUp + sgn * (Lm + Lp) * 0.35) + Math.min(Hin, hy.yn) });
    pts.push({ x: xDn, z: zDn + yOut });
    const zTw = Number.isFinite(hy.twElev) && hy.twElev > zDn - 5 ? Math.max(zDn, hy.twElev) : zDn + (ok(hy.twDepth) ? hy.twDepth : 0);
    pts.push({ x: xDn, z: zTw }, { x: xDn + sgn * ext * 0.9, z: zTw });
    const bed = (x) => (sgn * (x - xUp) < 0 ? Math.min(zUp, o.tnAt(x) ?? zUp) : sgn * (x - xDn) > 0 ? Math.min(zDn, o.tnAt(x) ?? zDn) : zfe(x));
    const top = pts.map((q, i) => `${i ? 'L' : 'M'}${P(X(q.x), Y(q.z))}`).join('');
    const xs = pts.map((q) => q.x), bot = []; for (let i = 0; i <= 40; i++) { const x = xs[xs.length - 1] + ((xs[0] - xs[xs.length - 1]) * i) / 40; bot.push(`L${P(X(x), Y(bed(x)))}`); }
    svg += `<path d="${top}${bot.join('')}Z" fill="rgba(56,189,248,0.25)" stroke="none"/><path d="${top}" fill="none" stroke="#0284c7" stroke-width="0.35"/>`;
    const lab = [];
    if (hy.Q > 0) lab.push(`Q = ${f2(hy.Q)} m³/s`);
    if (ok(hy.yIn)) lab.push(`y entrée ${f2(hy.yIn)} m`);
    if (ok(hy.yn)) lab.push(`yn ${f2(hy.yn)} m`);
    if (ok(hy.yc)) lab.push(`yc ${f2(hy.yc)} m`);
    if (ok(hy.yOut)) lab.push(`y sortie ${f2(hy.yOut)} m`);
    if (hy.v > 0) lab.push(`V sortie ${f2(hy.v)} m/s`);
    if (hy.control) lab.push(`contrôle ${hy.control === 'inlet' ? 'à l\'entrée' : 'à la sortie'}`);
    svg += txt(X((Lp - Lm) / 2), Y(zfe((Lp - Lm) / 2)) + 5.5, lab.join(' · '), 1.9, { a: 'middle', c: '#0369a1', halo: true });
    svg += txt(X(xDn + sgn * ext * 0.45), Y(zTw) - 1, `aval ${f2(zTw)}`, 1.9, { a: 'middle', c: '#0284c7', halo: true });
  }
  if (o.phe != null && Number.isFinite(o.phe)) {
    const xu = o.upLeft ? -Lm - ext * 0.9 : Lp + ext * 0.1, xv = o.upLeft ? -Lm : Lp + ext * 0.9, yP = Y(o.phe);
    svg += `<line x1="${X(xu).toFixed(2)}" y1="${yP.toFixed(2)}" x2="${X(xv).toFixed(2)}" y2="${yP.toFixed(2)}" stroke="#0284c7" stroke-width="0.35"/>`;
    svg += txt(X((xu + xv) / 2), yP - 1, `PHE ${f2(o.phe)}`, 2, { a: 'middle', c: '#0284c7', w: 'bold', halo: true });
  }
  // cotation des longueurs sous la coupe
  const yD = secR.y + secR.h - 9, dim = (xa, xb, label) => `<line x1="${X(xa).toFixed(2)}" y1="${yD}" x2="${X(xb).toFixed(2)}" y2="${yD}" stroke="#000" stroke-width="0.15"/><line x1="${X(xa).toFixed(2)}" y1="${yD - 1.2}" x2="${X(xa).toFixed(2)}" y2="${yD + 1.2}" stroke="#000" stroke-width="0.15"/><line x1="${X(xb).toFixed(2)}" y1="${yD - 1.2}" x2="${X(xb).toFixed(2)}" y2="${yD + 1.2}" stroke="#000" stroke-width="0.15"/>` + txt(X((xa + xb) / 2), yD - 0.8, label, 2, { a: 'middle' });
  svg += dim(-Lm, 0, `${f2(Lm)} m`) + dim(0, Lp, `${f2(Lp)} m`);
  svg += txt(X(0), yD + 4.5, `L = ${f2(Lm + Lp)} m (biais ${f2(K.ang, 1)} gr)`, 2.2, { a: 'middle', w: 'bold' });
  svg += '</svg>';
  return { svg, scale, paper: [PW, PH] };
}
