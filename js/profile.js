// profile.js — profil en travers type de l'anneau (coupe radiale, du centre vers l'extérieur), construit à partir
// des paramètres du projet : îlot central, bande franchissable, BDG, anneau (dévers vers l'extérieur), BDD et abords.
// Cotes en altitude relative : 0 à la rive extérieure (Rg).
import { fmt } from './common.js';
import { sectionParams, sideBands } from './norms.js';
import { DxfWriter } from './dxf-write.js';

const pc = (v) => fmt(v * 100, 1).replace(/,0$/, '') + ' %';
const cm = (v) => fmt(v * 100, 0) + ' cm';

// Cote du profil à l'abscisse x (interpolée ; sur une marche verticale, cote haute).
function zAt(line, x) {
  let z = -Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const [x0, z0] = line[i], [x1, z1] = line[i + 1];
    if (x < Math.min(x0, x1) - 1e-9 || x > Math.max(x0, x1) + 1e-9) continue;
    z = Math.max(z, Math.abs(x1 - x0) < 1e-9 ? Math.max(z0, z1) : z0 + ((x - x0) / (x1 - x0)) * (z1 - z0));
  }
  return z;
}

// Retourne { line: [[x, z]...], parts: [{ x0, x1, label, slope? }], steps: [{ x, z0, z1, label }] }.
export function ringProfile(prj, D) {
  const sec = sectionParams(prj), d = (+prj.ring.devers || 1.5) / 100;
  const { Rg, Rpi, Rb, Rpo, bf } = D;
  const zRing = (r) => d * (Rg - r);
  const line = [], parts = [], steps = [];
  const zi = zRing(Rpi);
  // Îlot central (2 m dessinés) et bordure de l'îlot central
  const rIsl = bf > 0 ? Rb : Rpi;
  const zBfIn = bf > 0 ? zi + sec.bfVue + (sec.bfPente / 100) * bf : zi;
  const zIsl = zBfIn + sec.ilotVue;
  line.push([rIsl - 2, zIsl], [rIsl, zIsl], [rIsl, zBfIn]);
  parts.push({ x0: rIsl - 2, x1: rIsl, label: 'îlot central' });
  steps.push({ x: rIsl, z0: zBfIn, z1: zIsl, label: `vue ${cm(sec.ilotVue)}` });
  if (bf > 0) {
    line.push([Rpi, zi + sec.bfVue], [Rpi, zi]);
    parts.push({ x0: Rb, x1: Rpi, label: `bande franchissable ${fmt(bf, 2)}`, slope: -sec.bfPente / 100 });
    steps.push({ x: Rpi, z0: zi, z1: zi + sec.bfVue, label: `vue ${cm(sec.bfVue)}` });
  }
  // Chaussée annulaire : BDG, voies, BDD au même dévers
  line.push([Rpo, zRing(Rpo)]);
  if (sec.bdgRing > 0) parts.push({ x0: Rpi, x1: Rpi + sec.bdgRing, label: `BDG ${fmt(sec.bdgRing, 2)}` });
  parts.push({ x0: Rg - D.la, x1: Rg, label: `anneau ${fmt(D.la, 2)}`, slope: -d });
  if (sec.bdd > 0) parts.push({ x0: Rg, x1: Rpo, label: `BDD ${fmt(sec.bdd, 2)}` });
  // Abords
  let x = Rpo, z = zRing(Rpo);
  for (const [nm, w] of sideBands(prj, sec)) {
    if (nm === 'caniveau') { z -= d * w; x += w; line.push([x, z]); parts.push({ x0: x - w, x1: x, label: `caniveau ${fmt(w, 2)}` }); }
    else if (nm === 'bordure') {
      line.push([x, z + sec.bordureVue]); steps.push({ x, z0: z, z1: z + sec.bordureVue, label: `vue ${cm(sec.bordureVue)}` });
      z += sec.bordureVue; x += w; line.push([x, z]); parts.push({ x0: x - w, x1: x, label: `bordure ${fmt(w, 2)}` });
    } else if (nm === 'trottoir') {
      const s = sec.trottoirPente / 100; z += s * w; x += w; line.push([x, z]);
      parts.push({ x0: x - w, x1: x, label: `trottoir ${fmt(w, 2)}`, slope: s });
    } else if (nm === 'contre-bordure') { x += w; line.push([x, z]); parts.push({ x0: x - w, x1: x, label: `c.-bordure ${fmt(w, 2)}` }); }
    else if (nm === 'berme') {
      const s = sec.bermePente / 100; z -= s * w; x += w; line.push([x, z]);
      parts.push({ x0: x - w, x1: x, label: `berme ${fmt(w, 2)}`, slope: -s });
    }
  }
  return { line, parts, steps, xmin: line[0][0], xmax: x, d };
}

// Dessin SVG (exagération verticale ve) pour le panneau.
export function profileSVG(prof, { w = 430, h = 230, ve = 6 } = {}) {
  const m = { l: 14, r: 14, t: 34, b: 74 };
  const zs = prof.line.map((p) => p[1]), zmin = Math.min(...zs), zmax = Math.max(...zs);
  const sx = (w - m.l - m.r) / (prof.xmax - prof.xmin), sz = sx * ve;
  const X = (x) => m.l + (x - prof.xmin) * sx;
  const zc = (zmin + zmax) / 2, Y = (z) => m.t + (h - m.t - m.b) / 2 - (z - zc) * sz;
  let s = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Profil en travers type de l'anneau">`;
  const d = prof.line.map(([x, z], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(z).toFixed(1)}`).join('');
  s += `<path d="${d} L${X(prof.xmax)},${Y(zmin) + 26} L${X(prof.xmin)},${Y(zmin) + 26}Z" class="pf-fill"/>`;
  s += `<path d="${d}" class="pf-line"/>`;
  // Pentes et vues de bordures
  for (const p of prof.parts) {
    if (p.slope == null) continue;
    const xm = X((p.x0 + p.x1) / 2), y = Y(zAt(prof.line, (p.x0 + p.x1) / 2)) - 12;
    const dir = p.slope < 0 ? 1 : -1; // flèche dans le sens de la descente
    s += `<text class="pf-sl" x="${xm}" y="${y - 4}" text-anchor="middle">${pc(Math.abs(p.slope))}</text>`;
    s += `<path class="pf-ar" d="M${xm - 14 * dir},${y} L${xm + 14 * dir},${y} M${xm + 14 * dir},${y} l${-5 * dir},-3 M${xm + 14 * dir},${y} l${-5 * dir},3"/>`;
  }
  for (const st of prof.steps) s += `<text class="pf-st" x="${X(st.x) + 3}" y="${Y(Math.max(st.z0, st.z1)) - 4}">${st.label}</text>`;
  // Chaîne de cotes horizontales, sur deux rangs pour les petites largeurs
  // Ligne de cote unique ; les libellés trop longs pour leur cote descendent sur des rangs successifs.
  const yb = h - m.b + 14;
  let row = 0;
  prof.parts.forEach((p) => {
    const x0 = X(p.x0), x1 = X(p.x1), small = x1 - x0 < 5.6 * p.label.length;
    row = small ? (row % 3) + 1 : 0;
    const yt = yb + 14 + row * 13;
    s += `<path class="pf-dim" d="M${x0},${yb} L${x1},${yb} M${x0},${yb - 6} L${x0},${yb + 6} M${x1},${yb - 6} L${x1},${yb + 6}${row ? ` M${(x0 + x1) / 2},${yb} L${(x0 + x1) / 2},${yt - 9}` : ''}"/>`;
    s += `<text class="pf-dt" x="${(x0 + x1) / 2}" y="${yt}" text-anchor="${row && x1 > w * 0.75 ? 'end' : 'middle'}">${p.label}</text>`;
  });
  s += `<text class="pf-note" x="${w - m.r}" y="12" text-anchor="end">exagération verticale × ${ve}</text></svg>`;
  return s;
}

// Profil type en DXF, à l'échelle 1 (mètres), avec textes de pentes, vues et largeurs.
export function profileDXF(prof, title) {
  const w = new DxfWriter().layer('GIRA_PROFIL', 7).layer('GIRA_PROFIL_COTES', 4);
  for (let i = 0; i + 1 < prof.line.length; i++) {
    const [x0, z0] = prof.line[i], [x1, z1] = prof.line[i + 1];
    w.line('GIRA_PROFIL', { x: x0, y: z0 }, { x: x1, y: z1 });
  }
  const zmin = Math.min(...prof.line.map((p) => p[1])) - 0.6, H = 0.12;
  for (const p of prof.parts) {
    w.line('GIRA_PROFIL_COTES', { x: p.x0, y: zmin }, { x: p.x1, y: zmin });
    for (const x of [p.x0, p.x1]) w.line('GIRA_PROFIL_COTES', { x, y: zmin - 0.08 }, { x, y: zmin + 0.08 });
    w.text('GIRA_PROFIL_COTES', { x: (p.x0 + p.x1) / 2, y: zmin - 0.2 }, H, 0, p.label, 'center');
    if (p.slope != null) {
      const xm = (p.x0 + p.x1) / 2;
      w.text('GIRA_PROFIL_COTES', { x: xm, y: zAt(prof.line, xm) + 0.25 }, H, 0, `${p.slope < 0 ? '→' : '←'} ${pc(Math.abs(p.slope))}`, 'center');
    }
  }
  for (const st of prof.steps) w.text('GIRA_PROFIL_COTES', { x: st.x + 0.05, y: Math.max(st.z0, st.z1) + 0.1 }, H * 0.8, 0, st.label);
  w.text('GIRA_PROFIL_COTES', { x: prof.xmin, y: zmin - 0.7 }, H * 1.6, 0, title);
  return w.toString();
}
