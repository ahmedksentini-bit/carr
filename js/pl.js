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
export function plChartSVG(PL, tnLine, sEnd, opts = {}) {
  const w = opts.w || 600, h = opts.h || 330, m = { l: 46, r: 14, t: 22, b: 40 };
  const sMax = Math.max(sEnd, PL.sEnd, 20);
  const zs = [...tnLine.map((p) => p[1]), ...PL.nodes.map((n) => n.z)];
  for (let s = 0; s <= sMax; s += sMax / 40) zs.push(PL.zAt(s));
  let zmin = Math.min(...zs), zmax = Math.max(...zs);
  if (!(zmax - zmin > 0.5)) { zmin -= 1; zmax += 1; }
  const sx = (w - m.l - m.r) / sMax;
  const veAuto = Math.max(1, Math.min(20, Math.round((h - m.t - m.b) / ((zmax - zmin) * sx) / 1.3)));
  const ve = opts.ve > 0 ? opts.ve : veAuto;
  const sz = sx * ve, zc = (zmin + zmax) / 2;
  const X = (s) => m.l + s * sx, Y = (z) => m.t + (h - m.t - m.b) / 2 - (z - zc) * sz;
  const vis = (z) => Math.max(m.t, Math.min(h - m.b, Y(z)));
  let out = `<svg viewBox="0 0 ${w} ${h}" class="plsvg" data-l="${m.l}" data-t="${m.t}" data-sx="${sx}" data-sz="${sz}" data-zc="${zc}" data-hh="${h}" data-mt="${m.t}" data-mb="${m.b}">`;
  // Grille et axes
  const gs = niceStep(sMax / 8), gz = niceStep((zmax - zmin) / 5);
  for (let s = 0; s <= sMax + 1e-9; s += gs) out += `<line class="gl" x1="${X(s)}" y1="${m.t}" x2="${X(s)}" y2="${h - m.b}"/><text class="tk" x="${X(s)}" y="${h - m.b + 14}" text-anchor="middle">${fmt(s, 0)}</text>`;
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
  PL.nodes.forEach((nd, i) => {
    const sel = opts.sel === i - 1;
    out += `<circle class="pl-pi${i ? '' : ' fixed'}${sel ? ' sel' : ''}" data-pi="${i - 1}" cx="${X(nd.s)}" cy="${vis(nd.z)}" r="${i ? 5 : 4}"/>`;
    out += `<text class="pl-lb" x="${X(nd.s)}" y="${vis(nd.z) - (i ? 14 : -18)}" text-anchor="middle">${i ? `PI ${i}` : 'anneau'} · ${fmt(nd.z, 2)}</text>`;
  });
  out += `<text class="pf-note" x="${w - m.r}" y="12" text-anchor="end">exagération verticale × ${ve}${opts.ve > 0 ? '' : ' (auto)'}</text>`;
  out += `<text class="al" x="${m.l}" y="12">s (m) depuis le carrefour · z (m)</text></svg>`;
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
  const w = new DxfWriter().layer('GIRA_PL_TN', 8).layer('GIRA_PL_PROJET', 1).layer('GIRA_PL_COTES', 4);
  const Y = (z) => z * ve, H = 0.6 * ve / 5;
  for (let i = 0; i + 1 < tnLine.length; i++) w.line('GIRA_PL_TN', { x: tnLine[i][0], y: Y(tnLine[i][1]) }, { x: tnLine[i + 1][0], y: Y(tnLine[i + 1][1]) });
  const sMax = Math.max(PL.sEnd, stations.length ? stations[stations.length - 1].s : 0), n = Math.max(20, Math.ceil(sMax));
  const verts = [];
  for (let i = 0; i <= n; i++) { const s = (sMax * i) / n; verts.push({ x: s, y: Y(PL.zAt(s)), b: 0 }); }
  w.poly('GIRA_PL_PROJET', verts);
  const zmin = Math.min(...stations.map((q) => Math.min(q.zP, q.zTN ?? q.zP)), ...PL.nodes.map((q) => q.z));
  const base = Y(zmin) - 4 * H;
  for (const q of stations) {
    w.line('GIRA_PL_COTES', { x: q.s, y: base }, { x: q.s, y: Y(q.zP) });
    w.text('GIRA_PL_COTES', { x: q.s + 0.1, y: base - 1.2 * H }, H * 0.8, 90, fmt(q.s, 2));
    w.text('GIRA_PL_COTES', { x: q.s + 0.1, y: base - 7 * H }, H * 0.8, 90, fmt(q.zP, 2));
    if (q.zTN != null) w.text('GIRA_PL_COTES', { x: q.s + 0.1, y: base - 12.5 * H }, H * 0.8, 90, fmt(q.zTN, 2));
  }
  w.text('GIRA_PL_COTES', { x: -8 * H, y: base - 1.2 * H }, H * 0.8, 0, 'PK');
  w.text('GIRA_PL_COTES', { x: -8 * H, y: base - 7 * H }, H * 0.8, 0, 'Z projet');
  w.text('GIRA_PL_COTES', { x: -8 * H, y: base - 12.5 * H }, H * 0.8, 0, 'Z TN');
  for (const nd of PL.nodes.slice(1)) w.text('GIRA_PL_COTES', { x: nd.s, y: Y(nd.z) + 1.5 * H }, H, 0, `PI s ${fmt(nd.s, 1)} z ${fmt(nd.z, 2)}${nd.R ? ` R ${fmt(nd.R, 0)}` : ''}`, 'center');
  for (const sg of PL.segs) w.text('GIRA_PL_COTES', { x: (sg.s0 + sg.s1) / 2, y: Y(PL.zAt((sg.s0 + sg.s1) / 2)) + 3 * H }, H, 0, `${fmt(sg.g * 100, 2)} %`, 'center');
  w.text('GIRA_PL_COTES', { x: 0, y: base - 16 * H }, H * 1.5, 0, `${title} — exagération verticale × ${ve}`);
  return w.toString();
}
