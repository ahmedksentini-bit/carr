// basinedit.js — édition des bassins versants délimités : couper, fusionner, supprimer (reprise de BVTrace,
// MainWindow.SplitTotal / MergeTotals / DeleteTotal). Les opérations portent sur les masques raster de la session de
// calcul (grille MNT + hydrologie D8 de delineate) ; morphométrie et contours sont recalculés par watershed.js.
//
// Coupe (SplitTotal) : la ligne est prolongée de 3 cellules à chaque bout puis dilatée d'une cellule (une ligne qui
// s'arrête juste au bord laissait un pont 4-connexe) ; composantes 4-connexes du masque privé de la barrière ; les deux
// plus grandes forment les moitiés A et B, les cellules restantes (barrière, petites composantes) rejoignent la moitié
// la plus proche par parcours en largeur multi-source — aucune perte de surface, deux moitiés jointives. La moitié qui
// contient les semences d'origine garde le franchissement (et l'identifiant) ; l'autre reçoit son propre exutoire
// hydrologique (sortie D8 la plus chargée).
import { cellAt, polygonize, basinMetrics } from './watershed.js';

const DR = [-1, -1, 0, 1, 1, 1, 0, -1], DC = [0, 1, 1, 1, 0, -1, -1, -1];
export const cellXY = (grid, i) => ({ x: grid.x0 + ((i % grid.nx) + 0.5) * grid.cell, y: grid.y0 - (Math.floor(i / grid.nx) + 0.5) * grid.cell });

// Barrière raster d'une polyligne (pas de cell / 4), prolongée de `beyond` cellules et dilatée de `rounds` cellules.
export function rasterLine(grid, pts, { beyond = 3, rounds = 1 } = {}) {
  const n = grid.nx * grid.ny, bar = new Uint8Array(n);
  if (pts.length < 2) return bar;
  const ext = pts.map((p) => ({ ...p }));
  const push = (a, b, k) => { const dx = a.x - b.x, dy = a.y - b.y, l = Math.hypot(dx, dy) || 1; return { x: a.x + (dx / l) * k, y: a.y + (dy / l) * k }; };
  ext[0] = push(pts[0], pts[1], beyond * grid.cell); ext[ext.length - 1] = push(pts[pts.length - 1], pts[pts.length - 2], beyond * grid.cell);
  for (let k = 1; k < ext.length; k++) {
    const a = ext[k - 1], b = ext[k], L = Math.hypot(b.x - a.x, b.y - a.y), m = Math.max(1, Math.ceil(L / (grid.cell / 4)));
    for (let j = 0; j <= m; j++) { const c = cellAt(grid, a.x + ((b.x - a.x) * j) / m, a.y + ((b.y - a.y) * j) / m); if (c >= 0) bar[c] = 1; }
  }
  for (let r = 0; r < rounds; r++) {
    const add = [];
    for (let i = 0; i < n; i++) if (bar[i]) { const row = Math.floor(i / grid.nx), col = i % grid.nx; for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const rr = row + dr, cc = col + dc; if (rr >= 0 && cc >= 0 && rr < grid.ny && cc < grid.nx) add.push(rr * grid.nx + cc); } }
    for (const j of add) bar[j] = 1;
  }
  return bar;
}

// Coupe d'un ensemble de cellules (Int32Array) par une polyligne : { A, B } (A contient les semences si possible).
export function splitCells(grid, cells, pts, seeds = []) {
  const n = grid.nx * grid.ny, w = grid.nx, mask = new Uint8Array(n);
  for (const i of cells) mask[i] = 1;
  const bar = rasterLine(grid, pts);
  const label = new Int32Array(n).fill(-1), comps = [], stack = [];
  for (const s of cells) {
    if (bar[s] || label[s] !== -1) continue;
    const cid = comps.length, list = [];
    label[s] = cid; stack.push(s);
    while (stack.length) {
      const cur = stack.pop(); list.push(cur);
      const r = Math.floor(cur / w), c = cur % w;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= grid.ny || cc >= w) continue;
        const j = rr * w + cc; if (!mask[j] || bar[j] || label[j] !== -1) continue;
        label[j] = cid; stack.push(j);
      }
    }
    comps.push(list);
  }
  if (comps.length < 2) return { error: 'la ligne ne coupe pas le bassin en deux : tracez-la en travers, en débordant de part et d\'autre du contour.' };
  comps.sort((a, b) => b.length - a.length);
  const lab = new Int8Array(n).fill(-1), q = [];
  for (const i of comps[0]) { lab[i] = 0; q.push(i); }
  for (const i of comps[1]) { lab[i] = 1; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], r = Math.floor(cur / w), c = cur % w;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= grid.ny || cc >= w) continue;
      const j = rr * w + cc; if (!mask[j] || lab[j] !== -1) continue;
      lab[j] = lab[cur]; q.push(j);
    }
  }
  const out = [[], []];
  for (const i of cells) if (lab[i] >= 0) out[lab[i]].push(i);
  let [A, B] = out.map((l) => Int32Array.from(l).sort());
  const inA = new Set(A);
  if (seeds.length && !seeds.some((s) => inA.has(s))) [A, B] = [B, A];
  return { A, B };
}

export function mergeCells(a, b) {
  const s = new Set(a); for (const i of b) s.add(i);
  return Int32Array.from(s).sort();
}

// Morphométrie et contours d'un ensemble de cellules ; seeds absents → exutoire principal (sortie D8 la plus chargée).
export function basinOf(grid, H, cells, seeds = null, tol = grid.cell * 0.8) {
  const polygons = polygonize(cells, grid, { simplifyTol: tol });
  const m = basinMetrics(grid, cells, seeds && seeds.length ? seeds : null, { hydro: H, polygons });
  const outlet = m.seeds?.[0] ?? cells[0], d = H.dir?.[outlet];
  const flowDir = d >= 0 ? { x: DC[d] / Math.hypot(DC[d], DR[d]), y: -DR[d] / Math.hypot(DC[d], DR[d]) } : null;
  return { m, polygons, outlet, outletXY: cellXY(grid, outlet), flowDir };
}
