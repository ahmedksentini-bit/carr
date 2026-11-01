// pl.js — profil en long (ligne rouge) d'une branche : points d'inflexion (PI) saisis par l'utilisateur,
// raccordements paraboliques, comparaison au terrain naturel (MNT), graphique SVG, export DXF et contrôles.
// Abscisse s : le long de l'axe projet de la branche, 0 à la ligne de cédez-le-passage (giratoire) ou au bord de la
// chaussée principale (carrefour plan), positive vers l'extérieur. Le profil part du point imposé (0, z0), z0 étant la
// cote du bord de l'anneau (ou de la principale) sur l'axe, donnée par le modèle altimétrique (devers.js).
// Raccordement parabolique au PI k de rayon R : tangentes T = R·|g2 − g1| / 2 de part et d'autre,
// z(s) = zk + g1·(s − sk) + (g2 − g1)·(s − sk + T)² / (4T) pour s ∈ [sk − T, sk + T].
import * as G from './geom.js';
import { fmt } from './common.js';
import { DxfWriter } from './dxf-write.js';
import { tinZ } from './tin.js';

const num = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);

// Paramètres normalisés du profil d'une branche : { pis: [{ s, z, R }] triés, ve, step }.
export function plParams(br) {
  const p = br?.pl || {};
  const pis = (Array.isArray(p.pis) ? p.pis : []).map((q) => ({ s: num(q.s, NaN), z: num(q.z, NaN), R: Math.max(0, num(q.R, 0)) }))
    .filter((q) => Number.isFinite(q.s) && Number.isFinite(q.z) && q.s > 0.01).sort((a, b) => a.s - b.s);
  return { pis, ve: num(p.ve, 0), step: Math.max(1, num(p.step, 10)) };
}

// Construit le profil : nœuds, pentes, raccordements, et évaluateurs zAt(s), gradeAt(s). issues : [{ lvl, msg }].
export function plBuild(pl, z0) {
  const nodes = [{ s: 0, z: z0, R: 0 }, ...pl.pis], issues = [];
  const segs = [];
  for (let i = 0; i + 1 < nodes.length; i++) {
    const a = nodes[i], b = nodes[i + 1];
    segs.push({ s0: a.s, s1: b.s, g: (b.z - a.z) / Math.max(1e-9, b.s - a.s) });
  }
  const curves = [];
  for (let i = 1; i + 1 < nodes.length; i++) {
    const k = nodes[i], g1 = segs[i - 1].g, g2 = segs[i].g, R = k.R;
    if (!(R > 0) || Math.abs(g2 - g1) < 1e-9) continue;
    const T = (R * Math.abs(g2 - g1)) / 2;
    curves.push({ i, s: k.s, z: k.z, R, g1, g2, T, sA: k.s - T, sB: k.s + T, type: g2 < g1 ? 'convexe' : 'concave' });
  }
  // Chevauchements : un raccordement ne doit pas déborder sur le précédent ni avant l'origine.
  for (let j = 0; j < curves.length; j++) {
    const c = curves[j], prevEnd = j ? curves[j - 1].sB : 0;
    if (c.sA < prevEnd - 1e-6) issues.push({ lvl: 'err', msg: `PI ${c.i} (s = ${fmt(c.s, 0)} m) : le raccordement R = ${fmt(c.R, 0)} m (T = ${fmt(c.T, 1)} m) chevauche ${j ? 'le précédent' : 'l\'origine du profil'}.` });
    const next = curves[j + 1] ? curves[j + 1].sA : Infinity;
    if (c.sB > next + 1e-6) continue; // signalé au suivant
  }
  const last = segs[segs.length - 1];
  const zAt = (s) => {
    if (!segs.length) return z0;
    for (const c of curves) if (s >= c.sA && s <= c.sB) return c.z + c.g1 * (s - c.s) + ((c.g2 - c.g1) * (s - c.s + c.T) ** 2) / (4 * c.T);
    if (s >= last.s1) return nodes[nodes.length - 1].z + last.g * (s - last.s1);
    for (let i = 0; i < segs.length; i++) if (s <= segs[i].s1 + 1e-9) return nodes[i].z + segs[i].g * (s - segs[i].s0);
    return z0;
  };
  const gradeAt = (s) => {
    if (!segs.length) return 0;
    for (const c of curves) if (s >= c.sA && s <= c.sB) return c.g1 + ((c.g2 - c.g1) * (s - c.s + c.T)) / (2 * c.T);
    if (s >= last.s1) return last.g;
    for (const sg of segs) if (s <= sg.s1 + 1e-9) return sg.g;
    return 0;
  };
  return { nodes, segs, curves, issues, zAt, gradeAt, sEnd: nodes[nodes.length - 1].s, defined: pl.pis.length > 0 };
}

// Point (monde) et tangente de l'axe projet de la branche à l'abscisse s depuis x0 (alignement, axe suivi, prolongement).
export function axisPointAt(bd, s) {
  const x = bd.x0 + s, a = bd.a || 0;
  if (x <= bd.xEnd + 1e-9 || !bd.cont) return { p: bd.W({ x, y: a }), t: bd.u, beyond: x > bd.xEnd + 1e-9 };
  const d = x - bd.xEnd, len = G.pathLen(bd.cont);
  if (d <= len) { const p = G.pathPointAt(bd.cont, d), q = G.pathPointAt(bd.cont, Math.min(len, d + 0.5)); return { p, t: d + 0.5 <= len ? G.norm(G.sub(q, p)) : bd.farDir, beyond: false }; }
  return { p: G.add(bd.farAxis, G.mul(bd.farDir, d - len)), t: bd.farDir, beyond: true };
}
// Longueur de l'axe projet dessiné (de x0 à l'extrémité de l'axe suivi).
export const axisLength = (bd) => bd.xEnd - bd.x0 + (bd.cont ? G.pathLen(bd.cont) : 0);

// Stations : TN (MNT) et projet le long de l'axe, pas `step`, jusqu'à sEnd (+ PI et extrémités de raccordements).
export function plStations(bd, PL, tin, sEnd, step = 10) {
  const ss = new Set();
  for (let s = 0; s <= sEnd + 1e-9; s += step) ss.add(Math.round(s * 100) / 100);
  ss.add(Math.round(sEnd * 100) / 100);
  for (const n of PL.nodes) if (n.s <= sEnd) ss.add(n.s);
  for (const c of PL.curves) { if (c.sA > 0 && c.sA <= sEnd) ss.add(Math.round(c.sA * 100) / 100); if (c.sB <= sEnd) ss.add(Math.round(c.sB * 100) / 100); }
  return [...ss].sort((a, b) => a - b).map((s) => {
    const { p } = axisPointAt(bd, s);
    const zTN = tin ? tinZ(tin, p.x, p.y) : null, zP = PL.zAt(s);
    return { s, p, zTN, zP, dz: zTN == null ? null : zP - zTN, g: PL.gradeAt(s) };
  });
}
// Échantillonnage fin du TN pour le dessin (pas 1 m).
export function plTerrainLine(bd, tin, sEnd, step = 1) {
  const out = [];
  for (let s = 0; s <= sEnd + 1e-9; s += step) { const { p } = axisPointAt(bd, s); const z = tinZ(tin, p.x, p.y); if (z != null) out.push([s, z]); }
  return out;
}

// Proposition de ligne rouge à partir du TN : PI à sEnd (et tous les `every` m), cotes du TN, rayon R par défaut.
export function plFromTerrain(bd, tin, sEnd, { every = 60, R = 1500, z0 = null } = {}) {
  const pis = [];
  for (let s = every; s < sEnd - every / 2; s += every) { const { p } = axisPointAt(bd, s); const z = tinZ(tin, p.x, p.y); if (z != null) pis.push({ s: Math.round(s), z: Math.round(z * 100) / 100, R }); }
  const { p } = axisPointAt(bd, sEnd); const z = tinZ(tin, p.x, p.y);
  if (z != null) pis.push({ s: Math.round(sEnd * 10) / 10, z: Math.round(z * 100) / 100, R: 0 });
  // Rayons plafonnés pour que les tangentes T = R·|Δg|/2 tiennent dans 40 % des intervalles voisins.
  const nodes = [{ s: 0, z: z0 ?? pis[0]?.z ?? 0 }, ...pis];
  for (let i = 1; i < nodes.length - 1; i++) {
    const g1 = (nodes[i].z - nodes[i - 1].z) / (nodes[i].s - nodes[i - 1].s), g2 = (nodes[i + 1].z - nodes[i].z) / (nodes[i + 1].s - nodes[i].s);
    const dg = Math.abs(g2 - g1), dmin = Math.min(nodes[i].s - nodes[i - 1].s, nodes[i + 1].s - nodes[i].s);
    pis[i - 1].R = dg < 1e-6 ? 0 : Math.max(100, Math.floor(Math.min(R, (0.8 * dmin) / dg) / 100) * 100);
  }
  return pis;
}

// Contrôles géométriques du profil (ARP 1994 pour l'interurbain, valeurs usuelles en urbain — à confirmer selon la
// catégorie de la route) : pente maximale, rayons minimaux, pente ≤ 2 % sur les 20 derniers mètres avant le carrefour.
export const PL_LIMITS = {
  interurbain: { gMax: 0.06, Rconv: 3000, Rconc: 2200, label: 'ARP catégorie R80 : pente ≤ 6 %, R convexe ≥ 3 000 m, R concave ≥ 2 200 m (R60 : 7 %, 1 500 m, 1 500 m)' },
  urbain: { gMax: 0.08, Rconv: 800, Rconc: 500, label: 'voirie urbaine (valeurs usuelles, ≈) : pente ≤ 8 %, R convexe ≥ 800 m, R concave ≥ 500 m' },
};
export function plChecks(PL, context, sEnd) {
  const out = [], lim = PL_LIMITS[context] || PL_LIMITS.interurbain, add = (lvl, msg) => out.push({ lvl, msg });
  for (const it of PL.issues) add(it.lvl, it.msg);
  for (const sg of PL.segs) if (Math.abs(sg.g) > lim.gMax + 1e-9) add('warn', `pente de ${fmt(Math.abs(sg.g) * 100, 2)} % entre s = ${fmt(sg.s0, 0)} et ${fmt(sg.s1, 0)} m — ${lim.label}.`);
  for (const c of PL.curves) {
    const Rmin = c.type === 'convexe' ? lim.Rconv : lim.Rconc;
    if (c.R < Rmin - 1e-9) add('warn', `PI à s = ${fmt(c.s, 0)} m : rayon ${c.type} ${fmt(c.R, 0)} m < ${fmt(Rmin, 0)} m (${lim.label}).`);
  }
  for (let i = 1; i + 1 < PL.nodes.length; i++) if (!(PL.nodes[i].R > 0) && Math.abs(PL.segs[i].g - PL.segs[i - 1].g) > 0.005) add('warn', `PI à s = ${fmt(PL.nodes[i].s, 0)} m : changement de pente de ${fmt(Math.abs(PL.segs[i].g - PL.segs[i - 1].g) * 100, 2)} % sans raccordement (R = 0).`);
  // ACI : ≤ 2 % sur les 10 à 20 derniers mètres avant le carrefour.
  let gNear = 0;
  for (let s = 0; s <= Math.min(20, sEnd); s += 1) gNear = Math.max(gNear, Math.abs(PL.gradeAt(s)));
  if (gNear > 0.02 + 1e-9) add(gNear > 0.03 ? 'warn' : 'info', `pente de ${fmt(gNear * 100, 2)} % sur les 20 m avant le carrefour (ACI : ≤ 2 % sur les 10 à 20 derniers mètres).`);
  if (PL.sEnd > sEnd + 0.5) add('info', `dernier PI à s = ${fmt(PL.sEnd, 0)} m, au-delà de l'axe dessiné (${fmt(sEnd, 0)} m) : prolongez l'axe ou rapprochez le PI.`);
  return out;
}

// --------------------------------------------------------------------------- Graphique SVG
// tnLine : [[s, z]] ; stations : plStations ; PL : plBuild ; opts : { w, h, ve (0 = auto), sel (PI sélectionné) }.
// ------------------------------------------------------------------ cartouche (repris de BVTrace)
// Lignes du cartouche du profil en long de BVTrace (map.html, renderFullRoadProfile / #trace-cart) : N° profil,
// distance partielle (cotée entre deux profils), distance cumulée, cote TN, cote projet, puis deux lignes à cellules
// fusionnées sur l'emprise de chaque élément : alignements droits (i, L) et raccordements paraboliques (R, L, i → i).
export const CART_ROWS = [
  { key: 'num', label: 'N° profil', h: 20 },
  { key: 'dp', label: 'Dist. partielle (m)', h: 34 },
  { key: 'dc', label: 'Dist. cumulée (m)', h: 40 },
  { key: 'z', label: 'Cote TN (m)', h: 40 },
  { key: 'zp', label: 'Cote projet (m)', h: 40 },
  { key: 'seg', label: 'Alignements droits', lines: ['Alignements', 'droits'], h: 24 },
  { key: 'para', label: 'Raccordements paraboliques', lines: ['Raccordements', 'paraboliques'], h: 24 },
];
// Éléments du profil : alignements droits (parties rectilignes entre raccordements) et raccordements paraboliques.
export function plElements(PL, sEnd = PL.sEnd) {
  const lines = [], paras = [], cs = PL.curves || [];
  PL.segs.forEach((sg, i) => {
    const cA = cs.find((c) => c.i === i), cB = cs.find((c) => c.i === i + 1);
    const a = cA ? cA.sB : sg.s0, b = cB ? cB.sA : i === PL.segs.length - 1 ? Math.max(sg.s1, sEnd) : sg.s1;
    if (b - a > 1e-6) lines.push({ s0: a, s1: b, g: sg.g });
  });
  for (const c of cs) paras.push({ s0: c.sA, s1: c.sB, R: c.R, g1: c.g1, g2: c.g2, type: c.type });
  return { lines, paras };
}
const cartH = () => CART_ROWS.reduce((t, r) => t + r.h, 0);
// Cartouche SVG (fond clair, comme BVTrace) entre y0 et y0 + cartH() ; colonne des intitulés dans la marge gauche.
// stations : [{ num, s, z (TN ou null) }] ; valeurs écrites à la verticale, stations trop serrées éclaircies.
function plCartSVG(PL, stations, { X, m, w, y0, sMax }) {
  const x0 = 2, x1 = w - 2, H = cartH(), tops = [];
  let y = y0; for (const r of CART_ROWS) { tops.push(y); y += r.h; }
  let o = `<rect class="pc-bg" x="${x0}" y="${y0}" width="${x1 - x0}" height="${H}"/>`;
  CART_ROWS.forEach((r, i) => {
    const t = tops[i], cy = t + r.h / 2;
    if (i) o += `<line class="pc-rl" x1="${x0}" y1="${t}" x2="${x1}" y2="${t}"/>`;
    o += r.lines ? `<text class="pc-lb" x="6" y="${cy - 2}"><tspan x="6">${r.lines[0]}</tspan><tspan x="6" dy="10">${r.lines[1]}</tspan></text>` : `<text class="pc-lb" x="6" y="${cy + 3.5}">${r.label}</text>`;
  });
  o += `<line class="pc-rl" x1="${m.l}" y1="${y0}" x2="${m.l}" y2="${y0 + H}"/>`;
  // stations retenues : au moins 12 px entre deux filets (valeurs verticales)
  const vis = stations.filter((q) => q.s >= -1e-6 && q.s <= sMax + 1e-6), keep = [];
  for (const q of vis) if (!keep.length || X(q.s) - X(keep[keep.length - 1].s) >= 12) keep.push(q);
  if (vis.length && keep[keep.length - 1] !== vis[vis.length - 1]) { const L = vis[vis.length - 1]; if (keep.length > 1 && X(L.s) - X(keep[keep.length - 1].s) < 12) keep.pop(); keep.push(L); }
  const yStn = tops[5], vtxt = (x, t, r, v) => `<text class="pc-v" x="${x.toFixed(1)}" y="${(t + r.h - 3).toFixed(1)}" transform="rotate(-90 ${x.toFixed(1)} ${(t + r.h - 3).toFixed(1)})">${v}</text>`;
  keep.forEach((q, k) => {
    const x = X(q.s), zp = PL.zAt(q.s);
    o += `<line class="pc-st" x1="${x.toFixed(1)}" y1="${y0}" x2="${x.toFixed(1)}" y2="${yStn}"/>`;
    o += `<text class="pc-n" x="${(x + 3).toFixed(1)}" y="${tops[0] + 14}">${q.num}</text>`;
    if (k) { const xp = X(keep[k - 1].s); o += vtxt((xp + x) / 2 + 3, tops[1], CART_ROWS[1], fmt(q.s - keep[k - 1].s, 2)); }
    o += vtxt(x + 3.5, tops[2], CART_ROWS[2], fmt(q.s, 2));
    o += vtxt(x + 3.5, tops[3], CART_ROWS[3], q.z == null || !Number.isFinite(q.z) ? '—' : fmt(q.z, 2));
    o += vtxt(x + 3.5, tops[4], CART_ROWS[4], fmt(zp, 2));
  });
  // cellules fusionnées sur l'emprise des éléments
  const { lines, paras } = plElements(PL, sMax);
  const cell = (t, r, a, b, label, cls) => {
    const A = Math.max(0, a), B = Math.min(sMax, b); if (!(B > A + 1e-6)) return '';
    const xa = X(A), xb = X(B), wd = xb - xa, fs = Math.max(6.5, Math.min(9, wd / Math.max(8, label.length * 0.58)));
    return `<g><rect class="pc-${cls}" x="${xa.toFixed(1)}" y="${t + 1}" width="${wd.toFixed(1)}" height="${r.h - 2}"/><text class="pc-${cls}-t" x="${((xa + xb) / 2).toFixed(1)}" y="${(t + r.h * 0.66).toFixed(1)}" text-anchor="middle" font-size="${fs.toFixed(1)}">${wd >= 28 ? label : ''}</text><title>${label}</title></g>`;
  };
  const pc = (v) => `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v) * 100, 2)}`;
  for (const l of lines) o += cell(tops[5], CART_ROWS[5], l.s0, l.s1, `i = ${pc(l.g)} % · L = ${fmt(l.s1 - l.s0, 2)} m`, 'seg');
  for (const c of paras) o += cell(tops[6], CART_ROWS[6], c.s0, c.s1, `R = ${fmt(c.R, 0)} m · L = ${fmt(c.s1 - c.s0, 2)} m · i ${pc(c.g1)} → ${pc(c.g2)} %`, 'para');
  o += `<rect class="pc-fr" x="${x0}" y="${y0}" width="${x1 - x0}" height="${H}"/>`;
  return { svg: o, keep };
}

// opts : ve (exagération verticale z / s ; 0 = auto), h (hauteur imposée), zExtra (cotes à inclure dans le cadre),
// overlay(ctx) → SVG dessiné sous la ligne rouge (ouvrages, gabarits ; ctx = { X, Y, vis, m, w, h }), plan
// ([{ s0, s1, k0, k1, R }] : diagramme des courbures), devers ([{ s, l, r }] en % : pentes transversales gauche / droite).
export function plChartSVG(PL, tnLine, sEnd, opts = {}) {
  const cart = opts.cart && !opts.noRed ? opts.cart : null;
  const stripH = (cart ? cartH() + 6 : 0) + (opts.plan ? 34 : 0) + (opts.devers ? 84 : 0);
  const m = { l: cart ? 124 : 46, r: 14, t: 22, b: (cart ? 16 : 40) + stripH };
  const sMax = Math.max(sEnd, PL.sEnd, 20);
  // largeur : ajustée au panneau, ou allongée (défilement horizontal) pour garder au moins pxm px par mètre d'abscisse
  // quand l'exagération verticale est imposée (sinon un axe de plusieurs kilomètres serait écrasé)
  const w = opts.w || Math.max(600, opts.ve > 0 && opts.pxm > 0 ? Math.ceil(m.l + m.r + sMax * opts.pxm) : 600);
  const zs = [...tnLine.map((p) => p[1]), ...PL.nodes.map((n) => n.z), ...(opts.zExtra || []).filter(Number.isFinite)];
  for (let s = 0; s <= sMax; s += sMax / 40) zs.push(PL.zAt(s));
  let zmin = Math.min(...zs), zmax = Math.max(...zs);
  if (!(zmax - zmin > 0.5)) { zmin -= 1; zmax += 1; }
  const sx = (w - m.l - m.r) / sMax;
  // échelle imposée : hauteur du graphique ajustée pour loger le profil (z exagéré ve fois par rapport à s)
  const h = opts.h || (opts.ve > 0 ? m.t + m.b + Math.max(160, Math.min(1500, (zmax - zmin) * sx * opts.ve * 1.15 + 40)) : 330 + stripH);
  const veAuto = Math.max(1, Math.min(20, Math.round((h - m.t - m.b) / ((zmax - zmin) * sx) / 1.3)));
  const ve = opts.ve > 0 ? opts.ve : veAuto;
  const sz = sx * ve, zc = (zmin + zmax) / 2;
  const X = (s) => m.l + s * sx, Y = (z) => m.t + (h - m.t - m.b) / 2 - (z - zc) * sz;
  const vis = (z) => Math.max(m.t, Math.min(h - m.b, Y(z)));
  let out = `<svg viewBox="0 0 ${w} ${h}" style="--w:${w}px;${w > 600 ? `width:${((w / 600) * 100).toFixed(1)}%;max-width:none` : ''}" class="plsvg" data-l="${m.l}" data-t="${m.t}" data-sx="${sx}" data-sz="${sz}" data-zc="${zc}" data-hh="${h}" data-mt="${m.t}" data-mb="${m.b}">`;
  // Grille et axes
  const gs = niceStep(sMax / 8), gz = niceStep((zmax - zmin) / 5);
  for (let s = 0; s <= sMax + 1e-9; s += gs) out += `<line class="gl" x1="${X(s)}" y1="${m.t}" x2="${X(s)}" y2="${h - m.b}"/>${cart ? '' : `<text class="tk" x="${X(s)}" y="${h - m.b + 14}" text-anchor="middle">${fmt(s, 0)}</text>`}`;
  for (let z = Math.ceil(zmin / gz) * gz; z <= zmax + 1e-9; z += gz) { const y = Y(z); if (y < m.t || y > h - m.b) continue; out += `<line class="gl" x1="${m.l}" y1="${y}" x2="${w - m.r}" y2="${y}"/><text class="tk" x="${m.l - 6}" y="${y + 4}" text-anchor="end">${fmt(z, gz < 1 ? 1 : 0)}</text>`; }
  out += `<rect x="${m.l}" y="${m.t}" width="${w - m.l - m.r}" height="${h - m.t - m.b}" class="ax" fill="none"/>`;
  // Déblai / remblai entre TN et projet
  if (tnLine.length > 1) {
    let fill = '', cut = '';
    for (let i = 0; i + 1 < tnLine.length; i++) {
      const [s0, t0] = tnLine[i], [s1, t1] = tnLine[i + 1], p0 = PL.zAt(s0), p1 = PL.zAt(s1);
      const poly = `M${X(s0)},${vis(t0)} L${X(s1)},${vis(t1)} L${X(s1)},${vis(p1)} L${X(s0)},${vis(p0)}Z`;
      if ((p0 + p1) / 2 >= (t0 + t1) / 2) fill += poly; else cut += poly;
    }
    out += `<path class="pl-fill" d="${fill}"/><path class="pl-cut" d="${cut}"/>`;
    out += `<path class="pl-tn" d="${tnLine.map(([s, z], i) => `${i ? 'L' : 'M'}${X(s).toFixed(1)},${vis(z).toFixed(1)}`).join('')}"/>`;
  }
  if (opts.overlay) out += opts.overlay({ X, Y, vis, m, w, h, sMax });
  if (cart) { // cartouche sous le profil, lignes de rappel depuis le TN (ou le projet) jusqu'à son bord supérieur
    const yC = h - stripH + 2, C = plCartSVG(PL, cart.stations, { X, m, w, y0: yC, sMax });
    for (const q of C.keep) { const z = q.z != null && Number.isFinite(q.z) ? q.z : PL.zAt(q.s); out += `<line class="pc-rap" x1="${X(q.s).toFixed(1)}" y1="${vis(z).toFixed(1)}" x2="${X(q.s).toFixed(1)}" y2="${h - m.b}"/>`; }
    out += C.svg;
  }
  out += plStrips(opts, { X, m, w, h, sMax, stripH: stripH - (cart ? cartH() + 6 : 0) });
  if (opts.noRed) { // axe sans profil : terrain seul, les points s'ajoutent par clic
    out += `<text class="pf-note" x="${(w + m.l) / 2}" y="${m.t + 18}" text-anchor="middle">Aucun profil : cliquez pour placer des points, ou « Proposer depuis le TN »</text>`;
    PL.nodes.forEach((nd, i) => { const inf = opts.nodeInfo ? opts.nodeInfo(i, nd) : null; if (inf?.fixed) out += `<circle class="pl-pi fixed" cx="${X(nd.s)}" cy="${vis(nd.z)}" r="4"/><text class="pl-lb" x="${X(nd.s)}" y="${vis(nd.z) + 18}" text-anchor="middle">${inf.label}</text>`; });
    out += `<text class="al" x="${m.l}" y="12">${opts.axisLabel || 's (m) · z (m)'}</text></svg>`;
    return out;
  }
  // Ligne rouge
  const n = 160, pts = [];
  for (let i = 0; i <= n; i++) { const s = (sMax * i) / n; pts.push(`${i ? 'L' : 'M'}${X(s).toFixed(1)},${vis(PL.zAt(s)).toFixed(1)}`); }
  out += `<path class="pl-red" d="${pts.join('')}"/>`;
  // Raccordements : limites et libellés de rayon
  for (const c of PL.curves) {
    for (const s of [c.sA, c.sB]) out += `<line class="pl-tg" x1="${X(s)}" y1="${vis(PL.zAt(s)) - 10}" x2="${X(s)}" y2="${vis(PL.zAt(s)) + 10}"/>`;
    out += `<text class="pl-lb" x="${X(c.s)}" y="${vis(c.z) + 16}" text-anchor="middle">R ${fmt(c.R, 0)}${c.type === 'convexe' ? ' ⌒' : ' ⌣'} · T ${fmt(c.T, 1)}</text>`;
  }
  // Pentes par segment
  for (const sg of PL.segs) { const sm = (sg.s0 + sg.s1) / 2; out += `<text class="pl-sl" x="${X(sm)}" y="${vis(PL.zAt(sm)) - 8}" text-anchor="middle">${sg.g >= 0 ? '+' : '−'}${fmt(Math.abs(sg.g) * 100, 2)} %</text>`; }
  // PI (poignées)
  // nodeInfo(i, nœud) → { fixed, pi (indice du point saisi), label } ; par défaut : nœud 0 imposé (anneau), puis PI 1, 2…
  PL.nodes.forEach((nd, i) => {
    const inf = opts.nodeInfo ? opts.nodeInfo(i, nd) : { fixed: !i, pi: i - 1, label: i ? `PI ${i}` : 'anneau' };
    const sel = !inf.fixed && opts.sel === inf.pi;
    out += `<circle class="pl-pi${inf.fixed ? ' fixed' : ''}${sel ? ' sel' : ''}" data-pi="${inf.pi}" cx="${X(nd.s)}" cy="${vis(nd.z)}" r="${inf.fixed ? 4 : 5}"/>`;
    out += `<text class="pl-lb" x="${X(nd.s)}" y="${vis(nd.z) - (inf.fixed ? -18 : 14)}" text-anchor="middle">${inf.label} · ${fmt(nd.z, 2)}</text>`;
  });
  out += `<text class="pf-note" x="${w - m.r}" y="12" text-anchor="end">exagération verticale × ${ve}${opts.ve > 0 ? '' : ' (auto)'}</text>`;
  out += `<text class="al" x="${m.l}" y="12">${opts.axisLabel || 's (m) depuis le carrefour · z (m)'}</text></svg>`;
  return out;
}
// Bandeaux sous le profil : diagramme des courbures du tracé en plan, puis pentes transversales gauche / droite.
function plStrips(opts, { X, m, w, h, sMax, stripH }) {
  if (!stripH) return '';
  let out = '', y0 = h - stripH + 6;
  const x0 = m.l, x1 = w - m.r;
  if (opts.plan) {
    const mid = y0 + 13, kMax = Math.max(1e-6, ...opts.plan.map((e) => Math.max(Math.abs(e.k0), Math.abs(e.k1)))), Yk = (k) => mid - (10 * k) / kMax;
    out += `<text class="pl-bl" x="${x0 - 4}" y="${mid + 3}" text-anchor="end">plan</text><line class="pl-b0" x1="${x0}" y1="${mid}" x2="${x1}" y2="${mid}"/>`;
    out += `<path class="pl-crv" d="${opts.plan.map((e, i) => `${i ? 'L' : 'M'}${X(Math.max(0, e.s0)).toFixed(1)},${Yk(e.k0).toFixed(1)}L${X(Math.min(sMax, e.s1)).toFixed(1)},${Yk(e.k1).toFixed(1)}`).join('')}"/>`;
    for (const e of opts.plan) if (e.R && Math.abs(e.k0 - e.k1) < 1e-9 && X(e.s1) - X(e.s0) > 26) out += `<text class="pl-bt" x="${X((e.s0 + e.s1) / 2)}" y="${e.k0 > 0 ? mid + 12 : mid - 4}" text-anchor="middle">R ${fmt(e.R, 0)}</text>`;
    y0 += 34;
  }
  if (opts.devers?.length) {
    const top = y0 + 4, bot = y0 + 70, mid = (top + bot) / 2, D = 8, Yd = (v) => mid - ((bot - top) / 2) * (Math.max(-D, Math.min(D, v)) / D);
    out += `<rect class="pl-band" x="${x0}" y="${top}" width="${x1 - x0}" height="${bot - top}"/>`;
    for (const v of [-7, -2.5, 0, 2.5, 7]) out += `<line class="${v ? 'pl-bg' : 'pl-b0'}" x1="${x0}" y1="${Yd(v)}" x2="${x1}" y2="${Yd(v)}"/><text class="pl-bt" x="${x0 - 4}" y="${Yd(v) + 3}" text-anchor="end">${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), v % 1 ? 1 : 0)}</text>`;
    const path = (f) => opts.devers.map((q, i) => `${i ? 'L' : 'M'}${X(q.s).toFixed(1)},${Yd(f(q)).toFixed(1)}`).join('');
    out += `<path class="pl-dvl" d="${path((q) => q.l)}"/><path class="pl-dvr" d="${path((q) => q.r)}"/>`;
    out += `<text class="pl-bt" x="${x1 - 2}" y="${top + 10}" text-anchor="end"><tspan class="pl-dvl-t">— gauche</tspan>  <tspan class="pl-dvr-t">— droite</tspan>  (% vers l'extérieur ; −2,5 = toit)</text>`;
    out += `<text class="pl-bl" x="${x0 + 3}" y="${top + 10}">dévers</text>`;
  }
  return out;
}
function niceStep(v) { const p = 10 ** Math.floor(Math.log10(Math.max(1e-9, v))), r = v / p; return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * p; }

// Conversion d'un clic (coordonnées SVG) en (s, z) à partir des attributs data-* du graphique.
export function plChartPick(svg, px, py) {
  const l = +svg.dataset.l, t = +svg.dataset.t, sx = +svg.dataset.sx, sz = +svg.dataset.sz, zc = +svg.dataset.zc, h = +svg.dataset.hh, mb = +svg.dataset.mb;
  const s = (px - l) / sx, z = zc - (py - (t + (h - t - mb) / 2)) / sz;
  return { s, z };
}

// --------------------------------------------------------------------------- DXF
// Profil en long à l'échelle (s en x, z en y, exagération verticale ve) : TN, ligne rouge, PI, stations.
export function plDXF(PL, tnLine, stations, title, ve = 5) {
  // Dessin au 1/1000 en abscisse (1 unité = 1 m = 1 mm sur le papier), cotes × ve ; cartouche de BVTrace sous le plan
  // de comparaison (N° profil, distances partielle et cumulée, cotes TN et projet, alignements droits, raccordements).
  const w = new DxfWriter().layer('GIRA_PL_TN', 8).layer('GIRA_PL_PROJET', 1).layer('GIRA_PL_COTES', 4).layer('GIRA_PL_CARTOUCHE', 7).layer('GIRA_PL_RAPPEL', 9);
  const Y = (z) => z * ve, Ht = 2.5;
  for (let i = 0; i + 1 < tnLine.length; i++) w.line('GIRA_PL_TN', { x: tnLine[i][0], y: Y(tnLine[i][1]) }, { x: tnLine[i + 1][0], y: Y(tnLine[i + 1][1]) });
  const s0 = Math.min(0, PL.nodes[0]?.s ?? 0), sMax = Math.max(PL.sEnd, stations.length ? stations[stations.length - 1].s : 0), n = Math.max(20, Math.ceil(sMax - s0));
  const verts = [];
  for (let i = 0; i <= n; i++) { const s = s0 + ((sMax - s0) * i) / n; verts.push({ x: s, y: Y(PL.zAt(s)), b: 0 }); }
  w.poly('GIRA_PL_PROJET', verts);
  for (const nd of PL.nodes.slice(1)) w.text('GIRA_PL_COTES', { x: nd.s, y: Y(nd.z) + 2 * Ht }, Ht, 0, `PI s ${fmt(nd.s, 1)} z ${fmt(nd.z, 2)}${nd.R ? ` R ${fmt(nd.R, 0)}` : ''}`, 'center');
  // plan de comparaison : cote ronde sous le point le plus bas
  const zLow = Math.min(...stations.map((q) => Math.min(q.zP ?? PL.zAt(q.s), q.zTN ?? Infinity)), ...PL.nodes.map((q) => q.z), ...tnLine.map((q) => q[1]));
  const zPC = Math.floor(zLow - 2), yPC = Y(zPC), xL = s0 - 62;
  w.line('GIRA_PL_CARTOUCHE', { x: s0, y: yPC }, { x: sMax, y: yPC });
  w.text('GIRA_PL_CARTOUCHE', { x: xL + 2, y: yPC + 1 }, Ht, 0, `PC ${fmt(zPC, 2)}`);
  // lignes du cartouche (hauteurs en unités papier)
  const RH = [8, 14, 16, 16, 16, 10, 10], tops = [];
  let y = yPC; for (const h of RH) { tops.push(y); y -= h; }
  const yB = y;
  for (const t of [...tops, yB]) w.line('GIRA_PL_CARTOUCHE', { x: xL, y: t }, { x: sMax, y: t });
  for (const x of [xL, s0, sMax]) w.line('GIRA_PL_CARTOUCHE', { x, y: yPC }, { x, y: yB });
  CART_ROWS.forEach((r, i) => w.text('GIRA_PL_CARTOUCHE', { x: xL + 2, y: tops[i] - RH[i] / 2 - Ht / 2 }, Ht * 0.9, 0, r.label));
  // stations (au moins 4 unités entre deux filets)
  const keep = [];
  for (const q of stations) if (!keep.length || q.s - keep[keep.length - 1].s >= 4) keep.push(q);
  keep.forEach((q, k) => {
    const zP = q.zP ?? PL.zAt(q.s), zR = q.zTN ?? zP;
    w.line('GIRA_PL_RAPPEL', { x: q.s, y: Y(zR) }, { x: q.s, y: yPC });
    w.line('GIRA_PL_CARTOUCHE', { x: q.s, y: yPC }, { x: q.s, y: tops[5] });
    w.text('GIRA_PL_COTES', { x: q.s + 0.6, y: tops[0] - RH[0] + 2 }, Ht * 0.9, 0, String(q.num ?? k + 1));
    if (k) w.text('GIRA_PL_COTES', { x: (q.s + keep[k - 1].s) / 2 + Ht / 2, y: tops[1] - RH[1] + 1 }, Ht * 0.9, 90, fmt(q.s - keep[k - 1].s, 2));
    w.text('GIRA_PL_COTES', { x: q.s + Ht / 2 + 0.3, y: tops[2] - RH[2] + 1 }, Ht * 0.9, 90, fmt(q.s, 2));
    w.text('GIRA_PL_COTES', { x: q.s + Ht / 2 + 0.3, y: tops[3] - RH[3] + 1 }, Ht * 0.9, 90, q.zTN == null ? '—' : fmt(q.zTN, 2));
    w.text('GIRA_PL_COTES', { x: q.s + Ht / 2 + 0.3, y: tops[4] - RH[4] + 1 }, Ht * 0.9, 90, fmt(zP, 2));
  });
  const { lines, paras } = plElements(PL, sMax), pc = (v) => `${v >= 0 ? '+' : '-'}${fmt(Math.abs(v) * 100, 2)}`;
  for (const l of lines) { w.line('GIRA_PL_CARTOUCHE', { x: l.s0, y: tops[5] }, { x: l.s0, y: tops[6] }); w.line('GIRA_PL_CARTOUCHE', { x: l.s1, y: tops[5] }, { x: l.s1, y: tops[6] }); w.text('GIRA_PL_COTES', { x: (l.s0 + l.s1) / 2, y: tops[5] - RH[5] / 2 - Ht / 2 }, Ht * 0.9, 0, `i = ${pc(l.g)} % L = ${fmt(l.s1 - l.s0, 2)} m`, 'center'); }
  for (const c of paras) { w.line('GIRA_PL_CARTOUCHE', { x: c.s0, y: tops[6] }, { x: c.s0, y: yB }); w.line('GIRA_PL_CARTOUCHE', { x: c.s1, y: tops[6] }, { x: c.s1, y: yB }); w.text('GIRA_PL_COTES', { x: (c.s0 + c.s1) / 2, y: tops[6] - RH[6] / 2 - Ht / 2 }, Ht * 0.9, 0, `R = ${fmt(c.R, 0)} m L = ${fmt(c.s1 - c.s0, 2)} m`, 'center'); }
  w.text('GIRA_PL_COTES', { x: xL, y: Y(Math.max(...PL.nodes.map((q) => q.z), ...tnLine.map((q) => q[1]))) + 12 }, Ht * 1.6, 0, `${title} — H 1/1000 · V 1/${Math.round(1000 / ve)} (exagération × ${ve})`);
  return w.toString();
}
