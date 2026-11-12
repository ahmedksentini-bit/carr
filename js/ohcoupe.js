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
  // coupe : cotation de la plate-forme en haut, dessin, cotes de longueur, cartouche (TN, fil d'eau, projet) en bas
  const CROW = 7, CROWS = 4, cartH = CROW * CROWS, pTop = secR.y + 15, pBot = secR.y + secR.h - cartH - 11;
  const kFit = Math.min(plotW / (x1 - x0), (pBot - pTop) / (zHi - zLo));
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
  const zMid = (zLo + zHi) / 2, yS = (pTop + pBot) / 2, Y = (z) => yS - (z - zMid) * k;
  // échelle des cotes à gauche
  const stepZ = k >= 8 ? 0.5 : k >= 3 ? 1 : 2;
  for (let z = Math.ceil(zLo / stepZ) * stepZ; z <= zHi + 1e-9; z += stepZ) {
    const y = Y(z); if (y < pTop || y > pBot) continue;
    svg += `<line x1="${plotX}" y1="${y.toFixed(2)}" x2="${(plotX + plotW).toFixed(2)}" y2="${y.toFixed(2)}" stroke="#eef0f3" stroke-width="0.12"/>`;
    svg += `<line x1="${plotX - 1.5}" y1="${y.toFixed(2)}" x2="${plotX}" y2="${y.toFixed(2)}" stroke="#000" stroke-width="0.15"/>` + txt(plotX - 2.2, y + 0.7, f2(z, stepZ < 1 ? 1 : 0), 1.9, { a: 'end' });
  }
  svg += `<line x1="${plotX}" y1="${pTop}" x2="${plotX}" y2="${pBot.toFixed(2)}" stroke="#000" stroke-width="0.2"/>`;
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
  svg += `<line x1="${X(0).toFixed(2)}" y1="${(pTop - 6).toFixed(2)}" x2="${X(0).toFixed(2)}" y2="${pBot.toFixed(2)}" stroke="#b91c1c" stroke-width="0.15" stroke-dasharray="4 1 1 1"/>`;
  svg += txt(X(0) + 1, secR.y + 5, `axe ${o.axisName} · PK ${fmtPk(o.pk).replace(/,00$/, '')}`, 2, { c: '#b91c1c', halo: true });
  // cotation des éléments de la plate-forme (largeurs mesurées perpendiculairement à la route) au-dessus de la coupe
  if (o.cs && Math.abs(dn) > 0.05) {
    const plat = o.cs.platform.map((q) => ({ x: q.y / dn, w: q.y, z: q.z, label: q.label || '' })).sort((a, b) => a.x - b.x).filter((q) => q.x >= x0 && q.x <= x1);
    const yc = pTop - 4;
    for (let i = 0; i + 1 < plat.length; i++) {
      const a = plat[i], b = plat[i + 1], wdt = Math.abs(b.w - a.w); if (wdt < 0.05) continue;
      const xa = X(a.x), xb = X(b.x);
      svg += `<line x1="${xa.toFixed(2)}" y1="${yc}" x2="${xb.toFixed(2)}" y2="${yc}" stroke="#374151" stroke-width="0.12"/>`;
      const lb = (Math.abs(a.x) > Math.abs(b.x) ? a : b).label.replace(/\s*\(.*\)/, '');
      const t = `${f2(wdt)}`, room = Math.abs(xb - xa);
      if (room > t.length * 1.0) svg += txt((xa + xb) / 2, yc - 0.7, t, 1.6, { a: 'middle', c: '#374151' });
      if (lb && room > lb.length * 0.95) svg += txt((xa + xb) / 2, yc + 2.2, lb, 1.4, { a: 'middle', c: '#6b7280' });
    }
    for (const q of plat) svg += `<line x1="${X(q.x).toFixed(2)}" y1="${(yc - 1.4).toFixed(2)}" x2="${X(q.x).toFixed(2)}" y2="${Y(q.z).toFixed(2)}" stroke="#9ca3af" stroke-width="0.08" stroke-dasharray="0.6 0.6"/>`;
  }
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
    // points clés le long de l'écoulement (u depuis la face amont), puis interpolation cubique monotone (Fritsch –
    // Carlson) : ligne d'eau continue et lissée, sans dépassement entre deux points ; jamais au-dessus de l'intrados
    const L = Lm + Lp, Hs = Math.max(1, H), zTw = Number.isFinite(hy.twElev) && hy.twElev > zDn - 5 ? Math.max(zDn, hy.twElev) : zDn + (ok(hy.twDepth) ? hy.twDepth : 0);
    const ku = [[-ext * 0.95, o.phe], [-Math.min(ext * 0.6, 3 * Hs), o.phe], [0, zUp + yIn]];
    if (ok(hy.yn) && hy.yn < Hin) ku.push([L * 0.4, zfe(xUp + sgn * L * 0.4) + Math.min(Hin, hy.yn)]);
    ku.push([L, zDn + yOut], [L + Math.min(ext * 0.6, 3 * Hs), zTw], [L + ext * 0.95, zTw]);
    const n = ku.length, dx = [], dl = [], m = new Array(n).fill(0);
    for (let i = 0; i + 1 < n; i++) { dx.push(ku[i + 1][0] - ku[i][0]); dl.push((ku[i + 1][1] - ku[i][1]) / Math.max(1e-6, dx[i])); }
    for (let i = 1; i + 1 < n; i++) m[i] = dl[i - 1] * dl[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / dl[i - 1] + (dx[i] + 2 * dx[i - 1]) / dl[i]);
    m[0] = 0; m[n - 1] = 0;
    const zw = (u) => {
      let i = 0; while (i + 2 < n && u > ku[i + 1][0]) i++;
      const h = dx[i], t = Math.max(0, Math.min(1, (u - ku[i][0]) / h)), t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ku[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ku[i + 1][1] + (t3 - t2) * h * m[i + 1];
    };
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const u = ku[0][0] + ((ku[n - 1][0] - ku[0][0]) * i) / 160, x = xUp + sgn * u;
      let z = zw(u); if (u >= 0 && u <= L) z = Math.min(z, zfe(x) + Hin);
      pts.push({ x, z });
    }
    const bed = (x) => { const u = sgn * (x - xUp); return u < 0 ? Math.min(zUp, o.tnAt(x) ?? zUp) : u > L ? Math.min(zDn, o.tnAt(x) ?? zDn) : zfe(x); };
    const top = pts.map((q, i) => `${i ? 'L' : 'M'}${P(X(q.x), Y(q.z))}`).join('');
    const bot = pts.slice().reverse().map((q) => `L${P(X(q.x), Y(Math.min(q.z, bed(q.x))))}`).join('');
    svg += `<path d="${top}${bot}Z" fill="rgba(56,189,248,0.25)" stroke="none"/><path d="${top}" fill="none" stroke="#0284c7" stroke-width="0.35"/>`;
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
  const yD = pBot + 5, dim = (xa, xb, label) => `<line x1="${X(xa).toFixed(2)}" y1="${yD}" x2="${X(xb).toFixed(2)}" y2="${yD}" stroke="#000" stroke-width="0.15"/><line x1="${X(xa).toFixed(2)}" y1="${yD - 1.2}" x2="${X(xa).toFixed(2)}" y2="${yD + 1.2}" stroke="#000" stroke-width="0.15"/><line x1="${X(xb).toFixed(2)}" y1="${yD - 1.2}" x2="${X(xb).toFixed(2)}" y2="${yD + 1.2}" stroke="#000" stroke-width="0.15"/>` + txt(X((xa + xb) / 2), yD - 0.8, label, 2, { a: 'middle' });
  svg += dim(-Lm, 0, `${f2(Lm)} m`) + dim(0, Lp, `${f2(Lp)} m`);
  svg += txt(X(Lp) + 3, yD + 0.7, `L = ${f2(Lm + Lp)} m (biais ${f2(K.ang, 1)} gr)`, 2, { w: 'bold' });
  // cartouche : distances depuis l'axe de la route le long de l'ouvrage, TN, fil d'eau, cote projet (chaussée, talus)
  const c0 = secR.y + secR.h - cartH, xL = secR.x, xR = secR.x + secR.w;
  const rowsC = [['DISTANCES (m)', 'd'], ['TERRAIN NATUREL', 'tn'], ['FIL D\'EAU OUVRAGE', 'fe'], ['COTE PROJET', 'zp']];
  rowsC.forEach(([lb], i) => { const y = c0 + i * CROW; svg += `<line x1="${xL}" y1="${y}" x2="${xR}" y2="${y}" stroke="#000" stroke-width="${i ? 0.12 : 0.3}"/>` + txt(xL + 1.5, y + CROW / 2 + 0.7, lb, 1.8, { w: 'bold' }); });
  svg += `<line x1="${plotX}" y1="${c0}" x2="${plotX}" y2="${c0 + cartH}" stroke="#000" stroke-width="0.2"/>`;
  const zRoad = (x) => { for (let i = 0; i + 1 < road.length; i++) { const a = road[i], b = road[i + 1]; if (x >= a.x - 1e-9 && x <= b.x + 1e-9) return b.x - a.x < 1e-9 ? Math.max(a.z, b.z) : a.z + ((b.z - a.z) * (x - a.x)) / (b.x - a.x); } return null; };
  const cand = [-Lm, 0, Lp, ...road.map((q) => q.x)].filter((x) => x >= x0 && x <= x1).sort((a, b) => a - b), keepC = [];
  for (const x of cand) { if (!keepC.length || X(x) - X(keepC[keepC.length - 1]) >= 3.2) keepC.push(x); else if (Math.abs(x) < 1e-6 || Math.abs(x + Lm) < 1e-6 || Math.abs(x - Lp) < 1e-6) keepC[keepC.length - 1] = x; }
  const vtc = (x, i, v) => { const yb = c0 + (i + 1) * CROW - 0.6; return `<text x="${(x + 0.6).toFixed(2)}" y="${yb.toFixed(2)}" font-size="1.45" transform="rotate(-90 ${(x + 0.6).toFixed(2)} ${yb.toFixed(2)})">${v}</text>`; };
  for (const x of keepC) {
    const xx = X(x), t = o.tnAt(x), zp2 = zRoad(x), fe = x >= -Lm - 1e-6 && x <= Lp + 1e-6 ? zfe(x) : null;
    svg += `<line x1="${xx.toFixed(2)}" y1="${c0}" x2="${xx.toFixed(2)}" y2="${c0 + cartH}" stroke="#9ca3af" stroke-width="0.1"/>`;
    svg += vtc(xx, 0, f2(x)) + vtc(xx, 1, t == null ? '—' : f2(t)) + vtc(xx, 2, fe == null ? '—' : f2(fe)) + vtc(xx, 3, zp2 == null ? '—' : f2(zp2));
  }
  // Conditions hydrauliques (comme la fenêtre Hydraulique de BVTrace) : débit, pente du radier (celle des fils d'eau
  // de cette coupe, transmise au calcul) et pente critique → régime dans l'ouvrage ; amont : contrôle, régime d'entrée,
  // HW, plan d'eau, revanche ; aval : état de la sortie, hauteur et plan d'eau aval, vitesse.
  {
    const r = o.hyd?.rr, bw = 104, lines = [];
    if (r) {
      const tor = r.criticalSlopePct > 0 ? r.slope * 100 > r.criticalSlopePct + 1e-6 : null;
      const reg = { unsubmerged: 'entrée non submergée', transition: 'entrée en transition', submerged: 'entrée submergée' }[r.inletRegime] || '';
      const out = { free: 'sortie libre', partial: 'sortie partiellement noyée', submerged: 'sortie noyée' }[r.outletCondition] || '';
      const D = r.cellHeight || K.H;
      lines.push([`Q${o.hyd.T ? o.hyd.T : ''} = ${f2(o.hyd.Q)} m³/s${r.cells > 1 ? ` (${f2(r.dischargePerCell)} m³/s par alvéole)` : ''}`, true]);
      lines.push([`Pente du radier ${f2(r.slope * 100)} % — pente critique ${f2(r.criticalSlopePct)} % → régime ${tor == null ? '—' : tor ? 'TORRENTIEL' : 'FLUVIAL'} dans l'ouvrage (Fr ${f2(r.froude)})`, true, tor === false ? '#b45309' : '#166534']);
      lines.push([`yn ${f2(r.normalDepth)} m · yc ${f2(r.criticalDepth)} m · remplissage ${f2(r.fillRatioPct, 0)} %`]);
      lines.push([`AMONT : contrôle ${r.control === 'inlet' ? 'à l\'entrée' : 'par l\'aval (sortie)'} · ${reg} · HW ${f2(r.headwater)} m (HW/D ${f2(r.headwater / D)})`, true]);
      lines.push([`plan d'eau amont ${f2(r.upstreamWaterElev)} m${Number.isFinite(r.freeboard) ? ` · revanche ${f2(r.freeboard)} m${r.freeboard < (o.hyd.minFb ?? 0.5) - 1e-6 ? ` < ${f2(o.hyd.minFb ?? 0.5)} m` : ''}` : ''}`, false, Number.isFinite(r.freeboard) && r.freeboard < (o.hyd.minFb ?? 0.5) - 1e-6 ? '#dc2626' : null]);
      lines.push([`AVAL : ${out} · hauteur aval ${f2(r.tailwaterDepth)} m · plan d'eau ${f2(r.downstreamWaterElev)} m`, true]);
      const v = r.velocities?.outlet ?? r.velocities?.full ?? r.fullVelocity;
      if (Number.isFinite(v)) lines.push([`vitesse de sortie ${f2(v)} m/s${v > 3 ? ' — > 3 m/s : protection aval (enrochements)' : ''}`, false, v > 3 ? '#dc2626' : null]);
    } else lines.push([o.hydNote || 'conditions hydrauliques non calculées', false, '#6b7280']);
    const lh = 3, bh = 6 + lines.length * lh, bx = inner.x + inner.w - bw - 3, by = planR.y + planR.h - bh - 2;
    svg += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#fff" fill-opacity="0.93" stroke="#0369a1" stroke-width="0.3"/>`;
    svg += txt(bx + 2, by + 3.6, 'CONDITIONS HYDRAULIQUES', 2.4, { w: 'bold', c: '#0369a1' });
    lines.forEach(([t, b, c], i) => { svg += txt(bx + 2, by + 6.6 + i * lh, t, 1.95, { w: b ? 'bold' : 'normal', c: c || '#111827' }); });
  }
  svg += '</svg>';
  return { svg, scale, paper: [PW, PH] };
}
