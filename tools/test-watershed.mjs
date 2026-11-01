// test-watershed.mjs — tests du moteur de bassins versants (js/hydro/watershed.js) sur MNT synthétiques.
// Usage : node tools/test-watershed.mjs [--big]   (--big : mesure aussi une grille 2000 × 2000)
// Code de retour ≠ 0 si un contrôle échoue.
//
// Cas repris de BVTrace (docs/context/backlog.md, point 2) : plan incliné (1 bassin), vallée en V (franchissement
// unique, surface attendue), méandre coupé deux fois (emboîtement + surface supplémentaire), conservation
// Σ partition = surface contributive ; plus : deux tracés distincts, invariants de CLAUDE.md (4-connexité, graphe D8
// acyclique sans zone plate, partition au premier impact), polygonisation exacte, morphométrie et temps de
// concentration, mesures de performance.
import { delineate, prepareHydro, polygonize, basinMetrics, concentrationTimes, formatPk, cellAt } from '../js/hydro/watershed.js';

let failures = 0, total = 0;
function check(label, ok, got = '') {
  total++;
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(66)} ${got}`);
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const section = (t) => console.log(`\n=== ${t} ===`);

// Grille GIRA : coin nord-ouest (x0, y0), ligne 0 = nord ; coordonnées de type UTM pour éprouver la précision.
function makeGrid(nx, ny, cell, f, { x0 = 512300, y0 = 3845600 } = {}) {
  const z = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) z[j * nx + i] = f(i, j, x0 + (i + 0.5) * cell, y0 - (j + 0.5) * cell);
  return { nx, ny, x0, y0, cell, z, nodata: NaN };
}
const X = (g, i) => g.x0 + (i + 0.5) * g.cell; // centre de colonne
const Y = (g, j) => g.y0 - (j + 0.5) * g.cell; // centre de ligne
const rowTrace = (g, j, key = 'A', name = key) => ({ key, name, pts: [{ x: g.x0 + 0.1, y: Y(g, j) }, { x: g.x0 + g.nx * g.cell - 0.1, y: Y(g, j) }] });
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const cellsOf = (g, j0, j1, i0, i1) => (j1 - j0 + 1) * (i1 - i0 + 1);
const DRr = [-1, -1, 0, 1, 1, 1, 0, -1], DCc = [0, 1, 1, 1, 0, -1, -1, -1];

// Aire d'un jeu de polygones (extérieurs − trous), et contrôle d'orientation.
function polyArea(polys) {
  let a = 0, orientOk = true;
  for (const poly of polys) poly.forEach((ring, k) => {
    let s = 0;
    for (let q = 0; q < ring.length - 1; q++) s += (ring[q].x - ring[0].x) * (ring[q + 1].y - ring[0].y) - (ring[q + 1].x - ring[0].x) * (ring[q].y - ring[0].y);
    s /= 2;
    if ((k === 0 && s <= 0) || (k > 0 && s >= 0)) orientOk = false;
    a += s;
  });
  return { a, orientOk };
}

// Premier impact recalculé naïvement (marche D8 sans mémoïsation), indépendant du moteur.
function naiveFirstHit(g, dir, isRoad) {
  const n = g.nx * g.ny, out = new Int32Array(n).fill(-1);
  for (let s = 0; s < n; s++) {
    if (!Number.isFinite(g.z[s])) continue;
    let c = s;
    for (let guard = 0; guard <= n; guard++) {
      if (isRoad[c]) { out[s] = c; break; }
      const d = dir[c];
      if (d < 0) break;
      const r = Math.floor(c / g.nx) + DRr[d], cc = (c % g.nx) + DCc[d];
      if (r < 0 || cc < 0 || r >= g.ny || cc >= g.nx) break;
      c = r * g.nx + cc;
      if (guard === n) throw new Error('cycle D8');
    }
  }
  return out;
}

// --------------------------------------------------------------------------- 1. Plan incliné
section('1. Plan incliné : un seul bassin');
{
  const g = makeGrid(60, 50, 10, (i, j) => 0.05 * (49 - j) * 10); // pente 5 % vers le sud
  const res = delineate(g, [rowTrace(g, 25)], { minAreaKm2: 0.05 });
  const expected = cellsOf(g, 0, 25, 0, 59) * 1e-4;
  check('un seul franchissement (aucun écoulement ≥ seuil → repli)', res.crossings.length === 1 && res.crossings[0].fallback, `${res.crossings.length}`);
  check('partition = versant amont + ligne du tracé', near(res.crossings[0].partitionKm2, expected, 1e-12), `${res.crossings[0].partitionKm2.toFixed(4)} / ${expected.toFixed(4)} km²`);
  check('surface contributive = partition', near(res.contributingKm2, res.crossings[0].partitionKm2, 1e-12));
  check('écoulement vers le sud au franchissement', res.crossings[0].flowDir && near(res.crossings[0].flowDir.y, -1, 1e-12));
}

// --------------------------------------------------------------------------- 2. Vallée en V
section('2. Vallée en V : franchissement unique, surface attendue');
const vGrid = (nx = 201, ny = 200) => makeGrid(nx, ny, 10, (i, j) => 0.1 * Math.abs(i - 100) * 10 + 0.02 * (ny - 1 - j) * 10);
{
  const g = vGrid();
  const res = delineate(g, [rowTrace(g, 100, 'RN', 'Route nationale')], { minAreaKm2: 0.05 });
  const c = res.crossings[0];
  check('un seul franchissement, non issu du repli', res.crossings.length === 1 && !c.fallback, `${res.crossings.length}`);
  check('franchissement sur le thalweg (colonne 100, ligne 100)', c.outlet.i === 100 && c.outlet.j === 100, `(${c.outlet.i}, ${c.outlet.j})`);
  check('PK ≈ 1 000 m (abscisse curviligne)', c.pk > 999 && c.pk < 1010, `${c.pk.toFixed(2)} m — ${c.pkLabel}`);
  check('x, y = centre de la cellule exutoire', near(c.x, X(g, 100), 1e-9) && near(c.y, Y(g, 100), 1e-9));
  check('direction d\'écoulement (0, −1)', c.flowDir && near(c.flowDir.x, 0, 1e-12) && near(c.flowDir.y, -1, 1e-12));
  const totExp = (100 * 201 + 1) * 1e-4, partExp = 101 * 201 * 1e-4;
  check('bassin total = tout l\'amont + cellule exutoire', near(c.totalKm2, totExp, 1e-12), `${c.totalKm2.toFixed(4)} / ${totExp.toFixed(4)} km²`);
  check('partition = amont + ligne du tracé', near(c.partitionKm2, partExp, 1e-12), `${c.partitionKm2.toFixed(4)} / ${partExp.toFixed(4)} km²`);
  check('pas de surface supplémentaire (aucun emboîtement)', c.incrementalKm2 === null && c.contains.length === 0);
  // Les cellules de la ligne du tracé ruissellent le long de la route vers le thalweg : acc = 101 × 201 cellules.
  check('accumulation au franchissement (amont + ligne du tracé)', near(c.accKm2, partExp, 1e-12), `${c.accKm2.toFixed(4)} km²`);
  // Morphométrie : chemin le plus long = coin NO → thalweg (100 pas E) puis thalweg → route (100 pas S).
  const m = c.metrics;
  check('plus long chemin hydraulique L = 2 000 m', near(m.lengthM, 2000, 1e-6), `${m.lengthM.toFixed(3)} m`);
  check('dénivelée du chemin = 100 + 20 = 120 m', near(m.dropM, 120, 2e-3), `${m.dropM.toFixed(4)} m`);
  check('pente brute D/L = 6 %', near(m.slopePct, 6, 1e-3), `${m.slopePct.toFixed(4)} %`);
  const ieq = (2000 / (1000 / Math.sqrt(0.1) + 1000 / Math.sqrt(0.02))) ** 2 * 100;
  check('pente équivalente Ieq (deux biefs 10 % et 2 %)', near(m.slopeEqPct, ieq, 1e-3), `${m.slopeEqPct.toFixed(4)} / ${ieq.toFixed(4)} %`);
  // Hypsométrie recalculée indépendamment sur les cellules du bassin total.
  const cells = res.rasters.totalCells[0];
  let zs = 0, zmin = Infinity, zmax = -Infinity;
  for (const i of cells) { zs += g.z[i]; zmin = Math.min(zmin, g.z[i]); zmax = Math.max(zmax, g.z[i]); }
  check('Hmax, Hmin, Hmoy (altitude moyenne − minimale)', near(m.hMax, zmax, 1e-9) && near(m.hMin, zmin, 1e-9) && near(m.meanReliefM, zs / cells.length - zmin, 1e-6), `Hmoy = ${m.meanReliefM.toFixed(3)} m`);
  check('surface des métriques = somme raster', near(m.areaKm2, c.totalKm2, 1e-12));
  const tc = concentrationTimes(m);
  const kirpich = 0.0195 * (2000 ** 3 / m.dropM) ** 0.385;
  const giand = (4 * Math.sqrt(m.areaKm2) + 1.5 * 2) / (0.8 * Math.sqrt(m.meanReliefM));
  check('Kirpich (min) et Giandotti (h) cohérents', near(tc.kirpichMin, kirpich, 1e-9) && near(tc.giandottiH, giand, 1e-9), `Kirpich ${tc.kirpichMin.toFixed(2)} min, Giandotti ${tc.giandottiH.toFixed(3)} h, Ventura ${tc.venturaMin.toFixed(2)} min, Passini ${tc.passiniH.toFixed(3)} h`);
  // Polygone exact (tolérance nulle) : aire = somme raster ; polygones simplifiés présents.
  const exact = polyArea(polygonize(res.rasters.totalCells[0], g, { simplifyTol: 0 }));
  check('polygone exact du bassin total : aire = somme raster', near(exact.a / 1e6, c.totalKm2, 1e-9) && exact.orientOk, `${(exact.a / 1e6).toFixed(4)} km²`);
  check('polygones simplifiés (total et partition) produits', c.polygonTotal.length >= 1 && c.polygonPartition.length >= 1);
  check('avertissement de bord émis (le bassin touche le nord du MNT)', c.touchesEdge && res.warnings.some((w) => w.includes('bord')));
  // basinMetrics exporté : mêmes résultats à partir du masque et de l'exutoire.
  const mask = new Uint8Array(g.nx * g.ny);
  for (const i of cells) mask[i] = 1;
  const m2 = basinMetrics(g, mask, c.outlet.cell, { hydro: res.hydro });
  check('basinMetrics(masque, exutoire) = métriques du pipeline', near(m2.lengthM, m.lengthM, 1e-9) && near(m2.areaKm2, m.areaKm2, 1e-12) && near(m2.perimeterM, m.perimeterM, 1e-6));
  const m3 = basinMetrics(g, mask, null, { hydro: res.hydro });
  check('basinMetrics sans exutoire : exutoire principal retrouvé', m3.seeds[0] === c.outlet.cell, `${m3.seeds[0]}`);
}

// --------------------------------------------------------------------------- 3. Méandre coupé deux fois
section('3. Écoulement coupé deux fois (lacet) : emboîtement + surface supplémentaire');
{
  const g = vGrid();
  const r1 = 60, r2 = 140, cl = 160; // lacet : ligne r1 vers l'est, branche verticale en colonne cl, retour en ligne r2
  const trace = { key: 'AX', name: 'Axe en lacet', pts: [{ x: g.x0 + 0.1, y: Y(g, r1) }, { x: X(g, cl), y: Y(g, r1) }, { x: X(g, cl), y: Y(g, r2) }, { x: g.x0 + 0.1, y: Y(g, r2) }] };
  for (const clip of [true, false]) {
    const res = delineate(g, [trace], { minAreaKm2: 0.05, clipTotalsToTrace: clip });
    const main = res.crossings.filter((c) => !c.fallback && c.accKm2 >= 0.05);
    const up = res.crossings.find((c) => c.outlet.j === r1 && c.outlet.i === 100);
    const dn = res.crossings.find((c) => c.outlet.j === r2 && c.outlet.i === 100);
    const tag = clip ? '[découpe au tracé]' : '[sans barrière]';
    check(`${tag} deux franchissements du thalweg, amont puis aval en PK`, main.length === 2 && up && dn && up.pk < dn.pk, `${main.length} (${up?.pkLabel}, ${dn?.pkLabel})`);
    if (!up || !dn) continue;
    check(`${tag} le bassin aval englobe le bassin amont`, dn.contains.includes(up.id) && up.contains.length === 0, `${dn.id} ⊃ ${dn.contains.join(', ')}`);
    const setDn = new Set(res.rasters.totalCells[dn.index]);
    check(`${tag} inclusion raster (amont ⊂ aval)`, [...res.rasters.totalCells[up.index]].every((i) => setDn.has(i)));
    const totUp = clip ? 60 * 201 + 1 : 61 * 201, totDn = clip ? totUp + (r2 - r1 - 1) * cl + 1 : (r2 + 1) * 201;
    check(`${tag} surface amont attendue`, near(up.totalKm2, totUp * 1e-4, 1e-12), `${up.totalKm2.toFixed(4)} / ${(totUp * 1e-4).toFixed(4)} km²`);
    check(`${tag} surface aval attendue`, near(dn.totalKm2, totDn * 1e-4, 1e-12), `${dn.totalKm2.toFixed(4)} / ${(totDn * 1e-4).toFixed(4)} km²`);
    check(`${tag} surface supplémentaire = aval − amont`, near(dn.incrementalKm2, dn.totalKm2 - up.totalKm2, 1e-12) && dn.incrementalKm2 > 0, `${dn.incrementalKm2.toFixed(4)} km²`);
    const sumPart = res.crossings.reduce((s, c) => s + c.partitionKm2, 0);
    check(`${tag} Σ partition = surface contributive`, near(sumPart, res.contributingKm2, 1e-9), `${sumPart.toFixed(4)} km²`);
  }
}

// --------------------------------------------------------------------------- 4. Conservation et invariants (MNT bruité)
section('4. MNT bruité avec cuvettes et trou sans donnée : conservation et invariants');
function noisyGrid(nx, ny, cell, seed, holes = true) {
  const rnd = mulberry32(seed);
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6];
  const g = makeGrid(nx, ny, cell, (i, j) => {
    const u = i / nx, v = j / ny;
    return 200 + 60 * v + 25 * Math.sin(7 * u + ph[0]) * Math.cos(5 * v + ph[1]) + 8 * Math.sin(23 * u + ph[2]) * Math.sin(19 * v + ph[3]) + 3 * rnd();
  });
  if (holes) { // trou sans donnée (lac, défaut de levé)
    const ci = Math.floor(nx * 0.7), cj = Math.floor(ny * 0.3), rad = Math.floor(Math.min(nx, ny) * 0.06);
    for (let j = cj - rad; j <= cj + rad; j++) for (let i = ci - rad; i <= ci + rad; i++) if ((i - ci) ** 2 + (j - cj) ** 2 <= rad * rad) g.z[j * nx + i] = NaN;
  }
  return g;
}
{
  const g = noisyGrid(300, 250, 10, 7);
  const n = g.nx * g.ny;
  const wiggle = { key: 'A1', name: 'Autoroute', pts: [] };
  for (let k = 0; k <= 40; k++) { const u = k / 40; wiggle.pts.push({ x: g.x0 + 5 + u * (g.nx * g.cell - 10), y: g.y0 - g.ny * g.cell * (0.55 + 0.15 * Math.sin(u * 9)) }); }
  const bret = { key: 'B1', name: 'Bretelle', pts: [{ x: X(g, 40), y: Y(g, 20) }, { x: X(g, 90), y: Y(g, 160) }, { x: X(g, 200), y: Y(g, 230) }] };
  const res = delineate(g, [wiggle, bret], { minAreaKm2: 0.02 });
  const H = res.hydro;
  // Priority-Flood + ε : toute cellule valide hors graines a une direction (pas de cuvette ni de zone plate).
  let noDir = 0, filledBelow = 0;
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const c = j * g.nx + i;
    if (!Number.isFinite(g.z[c])) continue;
    if (H.zf[c] < g.z[c]) filledBelow++;
    let seed = i === 0 || j === 0 || i === g.nx - 1 || j === g.ny - 1;
    for (let k = 0; k < 8 && !seed; k++) if (!Number.isFinite(g.z[(j + DRr[k]) * g.nx + i + DCc[k]])) seed = true;
    if (!seed && H.dir[c] < 0) noDir++;
  }
  check('Priority-Flood + ε : aucune cellule intérieure sans exutoire', noDir === 0, `${noDir}`);
  check('MNT rempli ≥ MNT brut partout', filledBelow === 0);
  // Acyclicité : coloration itérative.
  const state = new Uint8Array(n);
  let cycles = 0;
  for (let s = 0; s < n; s++) {
    if (state[s]) continue;
    const path = [];
    let c = s;
    while (c >= 0 && state[c] === 0) {
      state[c] = 1; path.push(c);
      const d = H.dir[c];
      if (d < 0) { c = -1; break; }
      const r = Math.floor(c / g.nx) + DRr[d], cc = (c % g.nx) + DCc[d];
      c = r * g.nx + cc;
    }
    if (c >= 0 && state[c] === 1) cycles++;
    for (const p of path) state[p] = 2;
  }
  check('graphe D8 acyclique', cycles === 0, `${cycles} cycle(s)`);
  // Premier impact : recalcul naïf et comparaison cellule par cellule.
  const fh = naiveFirstHit(g, H.dir, res.rasters.isRoad);
  let diff = 0, voids = 0, contrib = 0;
  for (let i = 0; i < n; i++) {
    if (fh[i] !== res.rasters.firstHit[i] && !(fh[i] < 0 && res.rasters.firstHit[i] < 0)) diff++;
    if (fh[i] >= 0) { contrib++; if (res.rasters.basinId[i] < 0) voids++; }
  }
  check('premier impact identique au recalcul naïf', diff === 0, `${diff} écart(s)`);
  check('zéro vide : toute cellule interceptée est affectée', voids === 0, `${voids}`);
  const sumPart = res.crossings.reduce((s, c) => s + c.partitionKm2, 0);
  check('Σ partition = surface contributive (somme raster)', near(sumPart, contrib * 1e-4, 1e-9) && near(res.contributingKm2, contrib * 1e-4, 1e-9), `${sumPart.toFixed(4)} km² (${res.crossings.length} bassins)`);
  // Partition bornée aux PK médians : segment de chaque cellule tracé recalculé depuis les PK publiés.
  let segErr = 0, roadN = 0;
  const segOf = new Map();
  for (const t of res.traces) {
    const xs = res.crossings.filter((c) => c.key === t.key);
    t.roadCells.forEach((cell, q) => {
      const pk = t.roadPk[q];
      let k = 0;
      while (k < xs.length - 1 && pk >= 0.5 * (xs[k].pk + xs[k + 1].pk)) k++;
      segOf.set(cell, xs[k].index); roadN++;
    });
  }
  for (let i = 0; i < n; i++) {
    const h = res.rasters.firstHit[i];
    if (h >= 0 && segOf.get(h) !== res.rasters.basinId[i]) segErr++;
  }
  check('partition = segment du premier impact borné aux PK médians', segErr === 0 && roadN > 0, `${segErr} écart(s), ${roadN} cellules tracé`);
  // Polygones exacts : aire = somme raster pour chaque bassin (partition et total), orientations correctes.
  let polyErr = 0, holesSeen = 0;
  for (const c of res.crossings) {
    const tc = res.rasters.totalCells[c.index];
    const pt = polyArea(polygonize(tc, g, { simplifyTol: 0 }));
    const pc = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (res.rasters.basinId[i] === c.index) pc[i] = 1;
    const pp = polygonize(pc, g, { simplifyTol: 0 });
    holesSeen += pp.reduce((s, p) => s + p.length - 1, 0);
    const pa = polyArea(pp);
    if (!near(pt.a / 1e6, c.totalKm2, 1e-9) || !near(pa.a / 1e6, c.partitionKm2, 1e-9) || !pt.orientOk || !pa.orientOk) polyErr++;
  }
  check('polygones exacts : aire = somme raster, orientations correctes', polyErr === 0, `${polyErr} écart(s), ${holesSeen} trou(s)`);
  // Bassins totaux emboîtés : si k contient m, le masque de m est inclus dans celui de k.
  let nestErr = 0, nests = 0;
  for (const c of res.crossings) for (const id of c.contains) {
    nests++;
    const m = res.crossings.find((x) => x.id === id);
    const s = new Set(res.rasters.totalCells[c.index]);
    if (![...res.rasters.totalCells[m.index]].every((i) => s.has(i))) nestErr++;
    if (!near(c.incrementalKm2, c.totalKm2 - Math.max(...c.contains.map((d) => res.crossings.find((x) => x.id === d).totalKm2)), 1e-12)) nestErr++;
  }
  check('emboîtements cohérents (inclusion, surface supplémentaire)', nestErr === 0, `${nests} emboîtement(s)`);
  check('réseau d\'écoulement orienté produit', Array.isArray(res.streams) && res.streams.length > 0, `${res.streams.length} tronçon(s)`);
}

// --------------------------------------------------------------------------- 5. 4-connexité, pas de fuite diagonale
section('5. Rasterisation 4-connexe : le tracé sépare le plan en 8-connexité');
{
  const g = noisyGrid(220, 180, 10, 11, false);
  const n = g.nx * g.ny;
  const diag = { key: 'D', name: 'Diagonale', pts: [{ x: g.x0 + 0.3, y: g.y0 - 0.7 }, { x: g.x0 + 1100.2, y: g.y0 - 1799.6 }] };
  const diag2 = { key: 'D2', name: 'Diagonale 2', pts: [{ x: g.x0 + 2199.7, y: g.y0 - 3 }, { x: g.x0 + 600.3, y: g.y0 - 1799.2 }] };
  for (const tr of [diag, diag2]) {
    const res = delineate(g, [tr], { minAreaKm2: 0.02, metrics: false, polygons: false, streams: false });
    const road = res.rasters.isRoad;
    // 4-connexité de la chaîne.
    const cells = [];
    for (let i = 0; i < n; i++) if (road[i]) cells.push(i);
    const seen = new Set([cells[0]]), st = [cells[0]];
    while (st.length) {
      const c = st.pop(), r = Math.floor(c / g.nx), cc = c % g.nx;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const rr = r + dr, c2 = cc + dc;
        if (rr < 0 || c2 < 0 || rr >= g.ny || c2 >= g.nx) continue;
        const j = rr * g.nx + c2;
        if (road[j] && !seen.has(j)) { seen.add(j); st.push(j); }
      }
    }
    check(`${tr.name} : chaîne de cellules 4-connexe`, seen.size === cells.length, `${seen.size}/${cells.length}`);
    // Séparation : parcours 8-connexe des cellules hors tracé depuis un côté, sans jamais atteindre l'autre côté.
    const a = tr.pts[0], b = tr.pts[1];
    const side = (i) => { const x = X(g, i % g.nx) - a.x, y = Y(g, Math.floor(i / g.nx)) - a.y; return Math.sign((b.x - a.x) * y - (b.y - a.y) * x); };
    let start = -1;
    for (let i = 0; i < n && start < 0; i++) if (!road[i] && side(i) > 0) start = i;
    const vis = new Uint8Array(n), stk = [start];
    vis[start] = 1;
    let leak = 0;
    while (stk.length) {
      const c = stk.pop(), r = Math.floor(c / g.nx), cc = c % g.nx;
      if (side(c) < 0) leak++;
      for (let k = 0; k < 8; k++) {
        const rr = r + DRr[k], c2 = cc + DCc[k];
        if (rr < 0 || c2 < 0 || rr >= g.ny || c2 >= g.nx) continue;
        const j = rr * g.nx + c2;
        if (!vis[j] && !road[j]) { vis[j] = 1; stk.push(j); }
      }
    }
    check(`${tr.name} : aucune fuite 8-connexe d'un côté à l'autre`, leak === 0, `${leak} cellule(s)`);
    // Aucun pas D8 entre deux cellules hors tracé de part et d'autre de la ligne.
    let jumps = 0;
    for (let i = 0; i < n; i++) {
      const d = res.hydro.dir[i];
      if (d < 0 || road[i]) continue;
      const j = (Math.floor(i / g.nx) + DRr[d]) * g.nx + (i % g.nx) + DCc[d];
      if (!road[j] && side(i) * side(j) < 0) jumps++;
    }
    check(`${tr.name} : aucun chemin D8 ne traverse sans toucher le tracé`, jumps === 0, `${jumps}`);
  }
}

// --------------------------------------------------------------------------- 6. Deux tracés distincts
section('6. Deux tracés distincts (autoroute + bretelle)');
{
  const g = vGrid();
  // a) Deux tracés parallèles : la bretelle (amont) est englobée par l'autoroute (aval).
  const res = delineate(g, [rowTrace(g, 140, 'A1', 'Autoroute'), rowTrace(g, 60, 'B1', 'Bretelle')], { minAreaKm2: 0.05 });
  const a = res.crossings.find((c) => c.key === 'A1' && !c.fallback), b = res.crossings.find((c) => c.key === 'B1' && !c.fallback);
  check('un franchissement par tracé, axe correctement attribué', res.crossings.length === 2 && a && b && a.traceName === 'Autoroute', res.crossings.map((c) => `${c.id}:${c.key}`).join(' '));
  check('PK propre à chaque tracé (≈ 1 000 m sur les deux)', a && b && near(a.pk, b.pk, 1e-9) && a.pk > 999 && a.pk < 1010);
  check('bassin de l\'autoroute englobe celui de la bretelle', a && b && a.contains.includes(b.id));
  check('surfaces : bretelle 60 lignes + 1, autoroute + (79 lignes + 1)', a && b && near(b.totalKm2, (60 * 201 + 1) * 1e-4, 1e-12) && near(a.totalKm2, (60 * 201 + 1 + 79 * 201 + 1) * 1e-4, 1e-12), `${b?.totalKm2.toFixed(4)} / ${a?.totalKm2.toFixed(4)} km²`);
  check('surface supplémentaire autoroute = 79 × 201 + 1 cellules', a && near(a.incrementalKm2, (79 * 201 + 1) * 1e-4, 1e-12), `${a?.incrementalKm2?.toFixed(4)} km²`);
  const sum = res.crossings.reduce((s, c) => s + c.partitionKm2, 0);
  check('Σ partition = surface contributive', near(sum, res.contributingKm2, 1e-9) && near(sum, 141 * 201 * 1e-4, 1e-9), `${sum.toFixed(4)} km²`);
  // b) Tracés sécants : cellule commune attribuée au premier tracé, pas de doublon.
  const vert = { key: 'B2', name: 'Voie secondaire', pts: [{ x: X(g, 150), y: Y(g, 10) }, { x: X(g, 150), y: Y(g, 190) }] };
  const r2 = delineate(g, [rowTrace(g, 100, 'A1', 'Autoroute'), vert], { minAreaKm2: 0.05 });
  const common = 100 * g.nx + 150;
  check('cellule commune attribuée au premier tracé', r2.traces[r2.rasters.owner[common]].key === 'A1');
  const allMembers = r2.crossings.flatMap((c) => c.memberCells);
  check('aucune cellule semence en double entre tracés', new Set(allMembers).size === allMembers.length);
  const s2 = r2.crossings.reduce((s, c) => s + c.partitionKm2, 0);
  check('Σ partition = surface contributive (tracés sécants)', near(s2, r2.contributingKm2, 1e-9), `${s2.toFixed(4)} km², ${r2.crossings.length} bassins`);
  check('franchissement principal sur l\'autoroute au thalweg', r2.crossings.some((c) => c.key === 'A1' && c.outlet.i === 100 && !c.fallback));
}

// --------------------------------------------------------------------------- 7. Polygonisation : trou et pincement
section('7. Polygonisation exacte : trou et pincement diagonal');
{
  const g = makeGrid(8, 8, 2, () => 0);
  const mask = new Uint8Array(64);
  for (let j = 1; j <= 5; j++) for (let i = 1; i <= 5; i++) mask[j * 8 + i] = 1;
  mask[3 * 8 + 3] = 0; // trou
  mask[0] = 1; // cellule (0,0) en contact diagonal avec (1,1) → pincement
  mask[7 * 8 + 7] = 1; // îlot isolé
  const polys = polygonize(mask, g, { simplifyTol: 0 });
  const pa = polyArea(polys);
  check('trois polygones (anneau troué, cellule pincée, îlot)', polys.length === 3, `${polys.length}`);
  check('un trou, rattaché au bon extérieur', polys.filter((p) => p.length === 2).length === 1 && polys.find((p) => p.length === 2)[0].length > 5);
  check('aire = 26 cellules × 4 m², orientations correctes', near(pa.a, 26 * 4, 1e-9) && pa.orientOk, `${pa.a} m²`);
  check('anneaux fermés, sommets aux coins de cellule', polys.every((p) => p.every((r) => r[0].x === r[r.length - 1].x && r[0].y === r[r.length - 1].y && r.every((q) => Number.isInteger((q.x - g.x0) / 2) && Number.isInteger((g.y0 - q.y) / 2)))));
  check('formatPk (arrondi au pair de .NET)', formatPk(12350.4) === 'PK 12+350' && formatPk(999.5) === 'PK 1+000' && formatPk(-1500) === '-PK 1+500' && formatPk(2.5) === 'PK 0+002');
  check('cellAt hors grille = −1', cellAt(g, g.x0 - 1, g.y0 - 1) === -1 && cellAt(g, g.x0 + 0.5, g.y0 - 0.5) === 0);
}

// --------------------------------------------------------------------------- 8. Performances
section('8. Performances');
function bench(N, cell) {
  const g = noisyGrid(N, N, cell, 2026, false);
  const W = N * cell;
  const main = { key: 'A1', name: 'Autoroute', pts: [] };
  for (let k = 0; k <= 200; k++) { const u = k / 200; main.pts.push({ x: g.x0 + 3 + u * (W - 6), y: g.y0 - W * (0.5 + 0.2 * Math.sin(u * 7)) }); }
  const b1 = { key: 'B1', name: 'Bretelle 1', pts: [{ x: g.x0 + W * 0.3, y: g.y0 - W * 0.1 }, { x: g.x0 + W * 0.35, y: g.y0 - W * 0.45 }] };
  const b2 = { key: 'B2', name: 'Bretelle 2', pts: [{ x: g.x0 + W * 0.7, y: g.y0 - W * 0.9 }, { x: g.x0 + W * 0.72, y: g.y0 - W * 0.6 }] };
  const t0 = performance.now();
  const H = prepareHydro(g);
  const t1 = performance.now();
  const res = delineate(g, [main, b1, b2], { hydro: H, minAreaKm2: 0.05 });
  const t2 = performance.now();
  const res2 = delineate(g, [main, b1, b2], { minAreaKm2: 0.05 });
  const t3 = performance.now();
  const f = (v) => `${v.toFixed(0)} ms`;
  console.log(`Grille ${N} × ${N} (${(N * N / 1e6).toFixed(1)} M cellules, ${cell} m) — ${res.crossings.length} franchissements, ${res.streams.length} tronçons de réseau`);
  console.log(`  prepareHydro : ${f(t1 - t0)}  (Priority-Flood ${f(H.timings.fillMs)}, D8 ${f(H.timings.d8Ms)}, accumulation ${f(H.timings.accMs)})`);
  const T = res.timings;
  console.log(`  delineate (hydro réutilisé) : ${f(t2 - t1)}  (raster ${f(T.rasterMs)}, 1er impact ${f(T.firstHitMs)}, franchissements ${f(T.crossingsMs)}, partition ${f(T.partitionMs)}, totaux ${f(T.totalsMs)}, polygones + métriques ${f(T.assemblyMs)}, réseau ${f(T.streamsMs)})`);
  console.log(`  delineate complet (sans cache) : ${f(t3 - t2)}`);
  check(`grille ${N} × ${N} : Σ partition = surface contributive`, near(res.crossings.reduce((s, c) => s + c.partitionKm2, 0), res.contributingKm2, 1e-6));
  check(`grille ${N} × ${N} : résultat identique avec ou sans cache hydro`, res2.crossings.length === res.crossings.length && res2.crossings.every((c, k) => c.totalKm2 === res.crossings[k].totalKm2));
}
bench(1000, 5);
if (process.argv.includes('--big')) bench(2000, 5);

console.log(`\n${total - failures}/${total} contrôles réussis${failures ? ` — ${failures} ÉCHEC(S)` : ''}.`);
process.exit(failures ? 1 : 0);
