// test-basinedit.mjs — couper / fusionner un bassin versant (js/hydro/basinedit.js, reprise de BVTrace).
import { delineate } from '../js/hydro/watershed.js';
import { splitCells, mergeCells, basinOf, cellXY } from '../js/hydro/basinedit.js';
let fail = 0;
const check = (l, ok, got = '') => { if (!ok) fail++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${l.padEnd(60)} ${got}`); };
// vallée en V orientée vers le sud, tracé est-ouest au sud
const nx = 120, ny = 120, cell = 10, x0 = 500000, y0 = 3800000, z = new Float32Array(nx * ny);
for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) z[j * nx + i] = 100 + (ny - j) * 0.5 + Math.abs(i - 60) * 0.3;
const grid = { nx, ny, x0, y0, cell, z, nodata: NaN };
const Yr = (j) => y0 - (j + 0.5) * cell;
const R = delineate(grid, [{ key: 'A', name: 'A', pts: [{ x: x0 + 0.1, y: Yr(110) }, { x: x0 + nx * cell - 0.1, y: Yr(110) }] }], { minAreaKm2: 0.01, clipTotalsToTrace: true, nestTotals: false, totalsFromPartition: true });
const k = R.crossings.findIndex((c) => c.totalKm2 === Math.max(...R.crossings.map((q) => q.totalKm2)));
const cells = R.rasters.totalCells[k], seeds = R.crossings[k].memberCells;
check('bassin principal délimité', cells.length > 1000, `${cells.length} cellules`);
// coupe horizontale à mi-hauteur (ligne j = 50), débordante
const cut = [{ x: x0 - 50, y: Yr(50) }, { x: x0 + nx * cell + 50, y: Yr(50) }];
const sp = splitCells(grid, cells, cut, seeds);
check('coupe en deux moitiés', !sp.error && sp.A.length > 0 && sp.B.length > 0, sp.error || `${sp.A.length} + ${sp.B.length}`);
check('aucune cellule perdue', sp.A.length + sp.B.length === cells.length);
const sA = new Set(sp.A);
check('moitié A = celle des semences (aval)', seeds.some((s) => sA.has(s)));
check('moitié B en amont (nord)', [...sp.B].every((i) => Math.floor(i / nx) <= 51));
const bB = basinOf(grid, R.hydro, sp.B);
check('exutoire de B sur la coupe', Math.abs(Math.floor(bB.outlet / nx) - 50) <= 2, `ligne ${Math.floor(bB.outlet / nx)}`);
check('écoulement de B vers le sud', bB.flowDir && bB.flowDir.y < -0.5, JSON.stringify(bB.flowDir));
check('morphométrie de B', bB.m.areaKm2 > 0 && bB.m.hypsometry?.length > 5 && bB.m.profile?.length >= 2, `${bB.m.areaKm2?.toFixed(3)} km²`);
const bA = basinOf(grid, R.hydro, sp.A, seeds);
check('contours de A', bA.polygons.length >= 1);
const m = mergeCells(sp.A, sp.B);
check('fusion = bassin d\'origine', m.length === cells.length);
check('coupe ratée signalée', !!splitCells(grid, cells, [{ x: x0 + 5, y: Yr(5) }, { x: x0 + 15, y: Yr(5) }], seeds).error);
const p = cellXY(grid, 0); check('cellXY centre de cellule', Math.abs(p.x - (x0 + 5)) < 1e-9 && Math.abs(p.y - (y0 - 5)) < 1e-9);
console.log(fail ? `\n${fail} échec(s)` : '\nTous les contrôles passent.');
process.exit(fail ? 1 : 0);
