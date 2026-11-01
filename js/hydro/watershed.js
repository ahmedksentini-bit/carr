// watershed.js — bassins versants interceptés par un ou plusieurs tracés routiers, sur une grille MNT régulière en
// coordonnées planes projetées (m, x vers l'est, y vers le nord). Portage du moteur C# BVTrace (HydroEngine,
// Polygonizer, WatershedPipeline, BasinMetrics) ; aucune dépendance, sans DOM : navigateur, Web Worker ou Node ≥ 18.
//
// Grille attendue (construite par GIRA) : { nx, ny, x0, y0, cell, z, nodata }
//   • z : Float32Array (ou tout tableau) de nx·ny cotes, ligne 0 = NORD (comme DemGrid de BVTrace) ;
//   • (x0, y0) : coin NORD-OUEST ; la cellule (i colonne, j ligne) a pour centre (x0 + (i+½)·cell, y0 − (j+½)·cell) ;
//   • nodata : NaN (défaut) ou valeur sentinelle ; toute cote non finie est aussi « sans donnée ».
// Indice de cellule : idx = j·nx + i.
//
// Chaîne de calcul (identique à BVTrace, cf. CLAUDE.md « Invariants de calcul ») :
//   1. Priority-Flood + ε (Barnes 2014) → MNT rempli, graphe D8 acyclique, aucune zone plate ;
//   2. directions D8 (pente la plus forte, distance cell ou cell·√2) ;
//   3. accumulation (tri topologique de Kahn) ;
//   4. rasterisation 4-CONNEXE de chaque tracé (une chaîne 4-connexe sépare le plan en 8-connexité : aucun chemin
//      D8 ne fuit en diagonale entre deux cellules du tracé), avec PK de première atteinte ;
//   5. premier point d'impact du chemin D8 sur l'ensemble des tracés ;
//   6. franchissements = cellules du tracé drainant ≥ seuil, regroupées par proximité de PK ;
//   7. partition SANS VIDE : chaque tracé est découpé aux PK médians entre ses franchissements consécutifs ;
//   8. bassins totaux par remontée D8 inversée ; emboîtement détecté SANS barrière (le tracé n'arrête pas la
//      remontée) → un double franchissement donne deux bassins emboîtés et une surface supplémentaire ;
//   9. surfaces = somme raster (nombre de cellules × cell²), jamais les polygones simplifiés.
//
// Plusieurs tracés (autoroute, voies secondaires, bretelles) : le premier impact se calcule sur leur union ; une
// cellule commune à deux tracés appartient au PREMIER tracé de la liste qui l'atteint (pas de franchissement en
// double à un raccordement). Chaque tracé garde ses propres PK et sa propre partition.

const DR = Int8Array.of(-1, -1, 0, 1, 1, 1, 0, -1); // ordre des voisins : N, NE, E, SE, S, SW, W, NW
const DC = Int8Array.of(0, 1, 1, 1, 0, -1, -1, -1);
const EPS = 0.0005; // gradient minimal imposé par le remplissage (m), comme BVTrace
const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

export const DEFAULTS = Object.freeze({
  minAreaKm2: 0.05, // PipelineOptions.ThresholdKm2
  streamKm2: 0.1, // PipelineOptions.NetworkThresholdKm2 (≤ 0 → minAreaKm2)
  simplifyCellFactor: 0.4, // tolérance RDP des contours, en fraction de cellule
  clipTotalsToTrace: true, // PipelineOptions.ClipTotalsToTrace
  totalsFromPartition: false, // true (GIRA) : le bassin d'un franchissement est sa partition (premier impact, bornée aux
  //                              PK médians) → bassins arrêtés au tracé, jointifs, sans aucun vide entre eux ni le long du tracé
  nestTotals: true, // emboîtement : le bassin aval englobe les bassins amont (double franchissement) ; false (GIRA) :
  //                   chaque bassin s'arrête au tracé, les bassins amont sont désignés par l'utilisateur (cumul des débits)
  stopAtSea: true, // réseau d'écoulement : arrêt aux cellules ≤ seaLevelM
  seaLevelM: 0,
});

// Arrondi « au pair » (Math.Round de .NET) : PK formatés et décimation de chemin identiques à BVTrace.
function roundEven(v) {
  const r = Math.round(v);
  return Math.abs(v % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

// --------------------------------------------------------------------------- Grille
const gridCache = new WeakMap();

// Grille interne : { nx, ny, n, x0, y0, cell, z, valid, edge, cellKm2, src }.
function normGrid(grid) {
  if (grid && grid.__wsGrid) return grid;
  const hit = gridCache.get(grid);
  if (hit) return hit;
  const { nx, ny, x0, y0, cell, z } = grid || {};
  if (!(nx >= 1 && ny >= 1 && Number.isInteger(nx) && Number.isInteger(ny))) throw new Error('Grille MNT : nx, ny entiers ≥ 1 attendus.');
  if (!(cell > 0) || !Number.isFinite(x0) || !Number.isFinite(y0)) throw new Error('Grille MNT : x0, y0, cell invalides.');
  const n = nx * ny;
  if (!z || z.length !== n) throw new Error(`Grille MNT : z doit contenir nx·ny = ${n} valeurs.`);
  const nd = grid.nodata;
  const valid = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const v = z[i]; valid[i] = Number.isFinite(v) && v !== nd ? 1 : 0; }
  // Cellule « de bord » : au bord de la grille ou adjacente (8-voisinage) à une cellule sans donnée (DemGrid.IsEdgeCell).
  const edge = new Uint8Array(n);
  for (let r = 0; r < ny; r++) {
    for (let c = 0; c < nx; c++) {
      const i = r * nx + c;
      if (r === 0 || c === 0 || r === ny - 1 || c === nx - 1) { edge[i] = 1; continue; }
      for (let k = 0; k < 8; k++) if (!valid[i + DR[k] * nx + DC[k]]) { edge[i] = 1; break; }
    }
  }
  const g = { __wsGrid: true, nx, ny, n, x0, y0, cell, z, valid, edge, cellKm2: (cell * cell) / 1e6, src: grid };
  if (grid && typeof grid === 'object') gridCache.set(grid, g);
  return g;
}

const cx = (g, c) => g.x0 + (c + 0.5) * g.cell;
const cy = (g, r) => g.y0 - (r + 0.5) * g.cell;

/** Cellule contenant le point (x, y), ou −1 hors grille. */
export function cellAt(grid, x, y) {
  const g = normGrid(grid);
  const r = Math.floor((g.y0 - y) / g.cell), c = Math.floor((x - g.x0) / g.cell);
  return r >= 0 && c >= 0 && r < g.ny && c < g.nx ? r * g.nx + c : -1;
}

function downstream(g, i, d) {
  const r = ((i / g.nx) | 0) + DR[d], c = (i % g.nx) + DC[d];
  return r >= 0 && c >= 0 && r < g.ny && c < g.nx ? r * g.nx + c : -1;
}
// Longueur (m) d'un pas D8 de direction d.
const stepM = (g, d) => (d & 1 ? g.cell * Math.SQRT2 : g.cell);

// --------------------------------------------------------------------------- 1. Priority-Flood + ε
// Tas binaire min sur tableaux typés (clé = cote remplie au moment de l'insertion ; chaque cellule n'entre qu'une fois).
function fillDepressions(g) {
  const { nx: w, ny: h, n, valid } = g;
  const zf = new Float32Array(n);
  for (let i = 0; i < n; i++) zf[i] = valid[i] ? g.z[i] : NaN;
  const seen = new Uint8Array(n);
  const HK = new Float32Array(n), HV = new Int32Array(n);
  let size = 0;
  const push = (v, key) => {
    let i = size++;
    while (i > 0) { const p = (i - 1) >> 1; if (HK[p] <= key) break; HK[i] = HK[p]; HV[i] = HV[p]; i = p; }
    HK[i] = key; HV[i] = v;
  };
  const pop = () => {
    const top = HV[0], m = --size;
    if (m > 0) {
      const key = HK[m], v = HV[m];
      let i = 0;
      for (;;) {
        let l = 2 * i + 1;
        if (l >= m) break;
        if (l + 1 < m && HK[l + 1] < HK[l]) l++;
        if (HK[l] >= key) break;
        HK[i] = HK[l]; HV[i] = HV[l]; i = l;
      }
      HK[i] = key; HV[i] = v;
    }
    return top;
  };
  // Graines : cellules valides au bord de la grille ou adjacentes à une cellule sans donnée.
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      if (!valid[i]) { seen[i] = 1; continue; }
      let border = r === 0 || c === 0 || r === h - 1 || c === w - 1;
      for (let k = 0; k < 8 && !border; k++) if (!valid[i + DR[k] * w + DC[k]]) border = true;
      if (border) { seen[i] = 1; push(i, zf[i]); }
    }
  }
  while (size > 0) {
    const cur = pop();
    const r0 = (cur / w) | 0, c0 = cur - r0 * w, zc = zf[cur];
    for (let k = 0; k < 8; k++) {
      const rr = r0 + DR[k], cc = c0 + DC[k];
      if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
      const j = rr * w + cc;
      if (seen[j]) continue;
      seen[j] = 1;
      if (zf[j] <= zc) zf[j] = zc + EPS; // arrondi Float32 comme le float[] de BVTrace
      push(j, zf[j]);
    }
  }
  return zf;
}

// --------------------------------------------------------------------------- 2. Directions D8
function flowDirections(g, zf) {
  const { nx: w, ny: h, n, valid } = g;
  const dir = new Int8Array(n).fill(-1);
  const dist = [g.cell, g.cell * Math.SQRT2, g.cell, g.cell * Math.SQRT2, g.cell, g.cell * Math.SQRT2, g.cell, g.cell * Math.SQRT2];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      if (!valid[i]) continue;
      let best = -1, bestSlope = 0; // pente strictement positive requise
      const zi = zf[i];
      for (let k = 0; k < 8; k++) {
        const rr = r + DR[k], cc = c + DC[k];
        if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
        const j = rr * w + cc;
        if (!valid[j]) continue;
        const drop = zi - zf[j];
        if (drop <= 0) continue;
        const s = drop / dist[k];
        if (s > bestSlope) { bestSlope = s; best = k; }
      }
      dir[i] = best; // −1 : exutoire hors domaine (bord / sans donnée)
    }
  }
  return dir;
}

// --------------------------------------------------------------------------- 3. Accumulation (cellules) — Kahn
function accumulation(g, dir) {
  const { n, valid } = g;
  const acc = new Int32Array(n), indeg = new Uint8Array(n), queue = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    if (!valid[i] || dir[i] < 0) continue;
    const j = downstream(g, i, dir[i]);
    if (j >= 0) indeg[j]++;
  }
  let qh = 0, qt = 0;
  for (let i = 0; i < n; i++) if (valid[i] && indeg[i] === 0) queue[qt++] = i;
  while (qh < qt) {
    const i = queue[qh++];
    acc[i] += 1;
    if (dir[i] < 0) continue;
    const j = downstream(g, i, dir[i]);
    if (j < 0) continue;
    acc[j] += acc[i];
    if (--indeg[j] === 0) queue[qt++] = j;
  }
  return acc;
}

/**
 * Prétraitement hydrologique indépendant du tracé (le plus coûteux) : à calculer une fois par MNT et à repasser
 * dans delineate(…, { hydro }) quand seul le tracé change.
 * @returns {{ grid, zf: Float32Array, dir: Int8Array, acc: Int32Array, cellKm2: number, timings: object }}
 *   acc = nombre de cellules drainées (cellule comprise) ; surface drainée = acc · cellKm2.
 */
export function prepareHydro(grid, { onProgress } = {}) {
  const g = normGrid(grid);
  const t0 = now();
  onProgress?.('Remplissage des dépressions (Priority-Flood)…');
  const zf = fillDepressions(g);
  const t1 = now();
  onProgress?.("Directions d'écoulement D8…");
  const dir = flowDirections(g, zf);
  const t2 = now();
  onProgress?.('Accumulation de flux…');
  const acc = accumulation(g, dir);
  const t3 = now();
  return { grid: g, zf, dir, acc, cellKm2: g.cellKm2, timings: { fillMs: t1 - t0, d8Ms: t2 - t1, accMs: t3 - t2 } };
}

function ensureHydro(grid, hydro) {
  const g = normGrid(grid);
  if (hydro && hydro.grid && (hydro.grid === g || hydro.grid.src === grid) && hydro.dir?.length === g.n) return hydro;
  return prepareHydro(g);
}

// --------------------------------------------------------------------------- 4. Rasterisation 4-connexe des tracés
// Densification au pas 0,35 · cell (jamais plus d'une cellule franchie par pas) ; un pas diagonal reçoit la cellule
// intermédiaire (ligne précédente, colonne courante) → chaîne 4-connexe. PK retenu = premier PK atteint.
function rasterizeTraces(g, traces, warnings) {
  const isRoad = new Uint8Array(g.n), owner = new Int32Array(g.n).fill(-1);
  const out = [];
  traces.forEach((tr, t) => {
    const key = tr.key ?? String(t), name = tr.name ?? String(key);
    const pts = (tr.pts || []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
    const rec = { key, name, pk0: Number.isFinite(tr.pk0) ? tr.pk0 : 0, lengthM: 0, cells: [], ch: [], marked: 0 };
    out.push(rec);
    if (pts.length < 2) { warnings.push(`Tracé « ${name} » : moins de deux points valides, ignoré.`); return; }
    const step = g.cell * 0.35;
    let lastR = 0, lastC = 0, has = false;
    const mark = (r, c, ch) => {
      if (r < 0 || c < 0 || r >= g.ny || c >= g.nx) return;
      const i = r * g.nx + c;
      if (!g.valid[i]) return;
      isRoad[i] = 1;
      rec.marked++;
      if (owner[i] !== -1) return; // déjà atteinte (premier PK conservé) ou propriété d'un tracé antérieur
      owner[i] = t; rec.cells.push(i); rec.ch.push(ch);
    };
    const visit = (x, y, ch) => {
      const r = Math.floor((g.y0 - y) / g.cell), c = Math.floor((x - g.x0) / g.cell);
      if (has && r === lastR && c === lastC) return;
      if (has && Math.abs(r - lastR) === 1 && Math.abs(c - lastC) === 1) mark(lastR, c, ch);
      mark(r, c, ch);
      lastR = r; lastC = c; has = true;
    };
    visit(pts[0].x, pts[0].y, 0);
    let chain = 0;
    for (let s = 1; s < pts.length; s++) {
      const a = pts[s - 1], b = pts[s];
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      const k = Math.max(1, Math.ceil(L / step));
      for (let q = 1; q <= k; q++) { const u = q / k; visit(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, chain + L * u); }
      chain += L;
    }
    rec.lengthM = chain;
    if (rec.marked === 0) warnings.push(`Tracé « ${name} » hors de la zone MNT valide.`);
  });
  return { isRoad, owner, traces: out };
}

// --------------------------------------------------------------------------- 5. Premier point d'impact
// Pour chaque cellule : première cellule de tracé rencontrée en suivant D8 (mémoïsé, itératif) ; −1 = ne coupe pas.
function computeFirstHit(g, dir, isRoad) {
  const { n, valid } = g;
  const out = new Int32Array(n).fill(-2); // −2 inconnu ; −3 en cours ; −1 sort sans couper ; ≥ 0 cellule tracé
  const path = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (!valid[start] || out[start] !== -2) continue;
    let c = start, res, sp = 0;
    for (;;) {
      if (isRoad[c]) { if (out[c] === -2) out[c] = c; res = out[c] >= 0 ? out[c] : c; break; }
      const o = out[c];
      if (o === -1 || o >= 0) { res = o; break; }
      if (o === -3) { res = -1; break; } // boucle imprévue (impossible après Priority-Flood + ε)
      out[c] = -3; path[sp++] = c;
      const d = dir[c];
      const nx = d >= 0 ? downstream(g, c, d) : -1;
      if (nx < 0 || !valid[nx]) { res = -1; break; }
      c = nx;
    }
    while (sp > 0) out[path[--sp]] = res;
  }
  return out;
}

// --------------------------------------------------------------------------- 6. Franchissements d'un tracé
function findCrossings(g, acc, tr, thrKm2) {
  const gap = g.cell * 2.5, ck = g.cellKm2;
  const idx = [];
  for (let q = 0; q < tr.cells.length; q++) if (acc[tr.cells[q]] * ck >= thrKm2) idx.push(q);
  idx.sort((a, b) => tr.ch[a] - tr.ch[b]); // tri stable, comme OrderBy
  const list = [];
  let cur = null, lastCh = -Infinity;
  for (const q of idx) {
    const cell = tr.cells[q], ch = tr.ch[q];
    if (!cur || ch - lastCh > gap) { cur = { rep: cell, ch, acc: acc[cell], members: [], fallback: false }; list.push(cur); }
    cur.members.push(cell);
    if (acc[cell] > cur.acc) { cur.acc = acc[cell]; cur.rep = cell; cur.ch = ch; }
    lastCh = ch;
  }
  // Aucun écoulement ≥ seuil : bassin unique à la cellule du tracé la plus drainée (garantit la partition sans vide).
  if (list.length === 0 && tr.cells.length > 0) {
    let b = 0;
    for (let q = 1; q < tr.cells.length; q++) if (acc[tr.cells[q]] > acc[tr.cells[b]]) b = q;
    list.push({ rep: tr.cells[b], ch: tr.ch[b], acc: acc[tr.cells[b]], members: [tr.cells[b]], fallback: true });
  }
  return list.sort((a, b) => a.ch - b.ch);
}

// --------------------------------------------------------------------------- Polygonisation (Polygonizer.cs)
// Masque raster → polygones exacts : arêtes de cellules entre dedans et dehors, intérieur à GAUCHE ; aux pincements
// (contact diagonal) on tourne à gauche. Anneaux extérieurs antihoraires (aire > 0), trous horaires.
// Sommets aux coins de cellules : (x0 + c·cell, y0 − r·cell).

// Ensemble de cellules → { cells (Int32Array), r0, c0, bw, bh, local (Uint8Array bw·bh) }.
function cellsBox(g, cells) {
  let r0 = Infinity, r1 = -1, c0 = Infinity, c1 = -1;
  for (let q = 0; q < cells.length; q++) {
    const i = cells[q], r = (i / g.nx) | 0, c = i - r * g.nx;
    if (r < r0) r0 = r; if (r > r1) r1 = r; if (c < c0) c0 = c; if (c > c1) c1 = c;
  }
  if (r1 < 0) return null;
  const bw = c1 - c0 + 1, bh = r1 - r0 + 1, local = new Uint8Array(bw * bh);
  for (let q = 0; q < cells.length; q++) {
    const i = cells[q], r = (i / g.nx) | 0, c = i - r * g.nx;
    local[(r - r0) * bw + (c - c0)] = 1;
  }
  return { r0, c0, bw, bh, local };
}

function pickLeftmost(cur, prev, cands, npr) {
  if (prev < 0) return cands[0];
  const ix = (cur % npr) - (prev % npr), iy = -(((cur / npr) | 0) - ((prev / npr) | 0)); // x = colonne, y = −ligne
  let best = cands[0], bestScore = -Infinity;
  for (const cand of cands) {
    const ox = (cand % npr) - (cur % npr), oy = -(((cand / npr) | 0) - ((cur / npr) | 0));
    const cross = ix * oy - iy * ox, dot = ix * ox + iy * oy;
    const score = cross > 0 ? 3 : cross === 0 && dot > 0 ? 2 : cross < 0 ? 1 : 0;
    if (score > bestScore) { bestScore = score; best = cand; }
  }
  return best;
}

function traceRings(g, box) {
  const { r0, c0, bw, bh, local } = box;
  const npr = bw + 1, nNodes = npr * (bh + 1);
  // Arêtes sortantes : au plus deux par nœud (pincement), stockées « + 1 » (0 = vide).
  const outA = new Int32Array(nNodes), outB = new Int32Array(nNodes);
  const order = []; // nœuds dans l'ordre de première arête sortante (ordre des clés du Dictionary C#)
  const add = (a, b) => { if (outA[a] === 0) { outA[a] = b + 1; order.push(a); } else outB[a] = b + 1; };
  const ins = (r, c) => r >= 0 && c >= 0 && r < bh && c < bw && local[r * bw + c] === 1;
  for (let r = 0; r < bh; r++) {
    for (let c = 0; c < bw; c++) {
      if (!local[r * bw + c]) continue;
      if (!ins(r - 1, c)) add(r * npr + c + 1, r * npr + c); // bord nord : E → O
      if (!ins(r + 1, c)) add((r + 1) * npr + c, (r + 1) * npr + c + 1); // bord sud : O → E
      if (!ins(r, c - 1)) add(r * npr + c, (r + 1) * npr + c); // bord ouest : N → S
      if (!ins(r, c + 1)) add((r + 1) * npr + c + 1, r * npr + c + 1); // bord est : S → N
    }
  }
  const rings = [], maxLen = 8 * bw * bh + 8;
  for (const start of order) {
    while (outA[start] !== 0) {
      const nodes = [start];
      let prev = -1, cur = start;
      for (;;) {
        const next = outB[cur] === 0 ? outA[cur] - 1 : pickLeftmost(cur, prev, [outA[cur] - 1, outB[cur] - 1], npr);
        if (next === -1) throw new Error('Polygonisation : anneau non fermé.');
        if (outA[cur] === next + 1) { outA[cur] = outB[cur]; outB[cur] = 0; } else outB[cur] = 0;
        prev = cur; cur = next;
        if (cur === start) break;
        nodes.push(cur);
        if (nodes.length > maxLen) throw new Error('Polygonisation : anneau non fermé.');
      }
      // Coordonnées, avec fusion des segments colinéaires.
      const pts = [];
      let pdr = NaN, pdc = NaN;
      for (let k = 0; k < nodes.length; k++) {
        const r = (nodes[k] / npr) | 0, c = nodes[k] % npr;
        if (k > 0) {
          const dr = r - ((nodes[k - 1] / npr) | 0), dc = c - (nodes[k - 1] % npr);
          if (dr === pdr && dc === pdc) pts.pop();
          pdr = dr; pdc = dc;
        }
        pts.push({ x: g.x0 + (c + c0) * g.cell, y: g.y0 - (r + r0) * g.cell });
      }
      pts.push(pts[0]);
      rings.push(pts);
    }
  }
  return rings;
}

// Ramer–Douglas–Peucker (GeoUtils.SimplifyRdp), tolérance en mètres. Distances comparées au carré (même ordre, même
// seuil que BVTrace, sans racine carrée) ; pile typée (pas de récursion).
function simplifyRdp(pts, tol) {
  const n = pts.length;
  if (n < 3 || tol <= 0) return pts.slice();
  const keep = new Uint8Array(n), stack = new Int32Array(2 * n);
  keep[0] = keep[n - 1] = 1;
  let sp = 0;
  stack[sp++] = 0; stack[sp++] = n - 1;
  const tol2 = tol * tol;
  while (sp > 0) {
    const b = stack[--sp], a = stack[--sp];
    const ax = pts[a].x, ay = pts[a].y, dx = pts[b].x - ax, dy = pts[b].y - ay, len2 = dx * dx + dy * dy;
    let maxD = -1, maxI = -1;
    for (let i = a + 1; i < b; i++) {
      const px = pts[i].x - ax, py = pts[i].y - ay;
      let d2;
      if (len2 < 1e-24) d2 = px * px + py * py;
      else {
        const t = Math.min(1, Math.max(0, (px * dx + py * dy) / len2));
        const qx = px - t * dx, qy = py - t * dy;
        d2 = qx * qx + qy * qy;
      }
      if (d2 > maxD) { maxD = d2; maxI = i; }
    }
    if (maxD > tol2 && maxI > 0) { keep[maxI] = 1; stack[sp++] = a; stack[sp++] = maxI; stack[sp++] = maxI; stack[sp++] = b; }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

function simplifyRing(ring, tol) {
  if (tol <= 0 || ring.length <= 5) return ring;
  const s = simplifyRdp(ring.slice(0, -1), tol);
  s.push(s[0]);
  return s;
}

// Aire signée (> 0 = antihoraire), calculée relativement au premier sommet (précision en UTM).
function signedArea(ring) {
  const ox = ring[0].x, oy = ring[0].y;
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += (ring[i].x - ox) * (ring[i + 1].y - oy) - (ring[i + 1].x - ox) * (ring[i].y - oy);
  return a / 2;
}

function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const xi = ring[i].x, yi = ring[i].y, xj = ring[j].x, yj = ring[j].y;
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygonizeBox(g, box, tol) {
  if (!box) return [];
  const ext = [], holes = [];
  for (const ring of traceRings(g, box)) {
    const s = simplifyRing(ring, tol);
    if (s.length < 4) continue;
    const a = signedArea(s);
    if (a > 0) ext.push({ ring: s, a }); else if (a < 0) holes.push(s);
  }
  ext.sort((p, q) => p.a - q.a); // du plus petit au plus grand
  const polys = ext.map((e) => [e.ring]);
  for (const h of holes) {
    for (let e = 0; e < ext.length; e++) if (pointInRing(h[0], ext[e].ring)) { polys[e].push(h); break; }
  }
  return polys;
}

// Liste de cellules à partir d'un masque (longueur n) ou d'une liste d'indices (Int32Array / Uint32Array).
function toCells(g, maskOrCells) {
  if (maskOrCells instanceof Int32Array || maskOrCells instanceof Uint32Array) return maskOrCells;
  if (!maskOrCells || maskOrCells.length !== g.n) throw new Error('Masque attendu : tableau de nx·ny valeurs, ou Int32Array d’indices de cellules.');
  let k = 0;
  for (let i = 0; i < g.n; i++) if (maskOrCells[i]) k++;
  const cells = new Int32Array(k);
  k = 0;
  for (let i = 0; i < g.n; i++) if (maskOrCells[i]) cells[k++] = i;
  return cells;
}

/**
 * Polygonisation exacte d'un masque raster (Polygonizer.ToPolygons).
 * @param mask Uint8Array / boolean[] de nx·ny valeurs (vrai = dedans), ou Int32Array d'indices de cellules.
 * @param opts.simplifyTol tolérance RDP (m) ; défaut 0,4·cell ; 0 = contours en escalier exacts.
 * @returns Polygon[] : chaque polygone = [anneau extérieur (antihoraire), trous… (horaires)],
 *          chaque anneau = [{x, y}…] fermé (dernier sommet = premier).
 */
export function polygonize(mask, grid, { simplifyTol } = {}) {
  const g = normGrid(grid);
  const tol = simplifyTol ?? g.cell * DEFAULTS.simplifyCellFactor;
  return polygonizeBox(g, cellsBox(g, toCells(g, mask)), tol);
}

// --------------------------------------------------------------------------- Morphométrie (BasinMetrics.cs + MainStream)
/** Indice de Gravelius KG = 0,282·P/√A et rectangle équivalent (L, l) en km. */
function gravelius(areaKm2, perimeterKm) {
  if (areaKm2 <= 0) return { kg: 0, L: 0, l: 0 };
  const kg = (0.28209 * perimeterKm) / Math.sqrt(areaKm2);
  let disc = 1 - (1.128 / Math.max(kg, 1e-9)) ** 2;
  if (disc < 0) disc = 0;
  const f = (kg * Math.sqrt(areaKm2)) / 1.128, s = Math.sqrt(disc);
  return { kg, L: f * (1 + s), l: f * (1 - s) };
}

// Pente équivalente Ieq (%) = (L / Σ lᵢ/√iᵢ)², à partir du profil en long [{d, z}].
function equivalentSlopePct(profile) {
  if (!profile || profile.length < 2) return 0;
  const L = profile[profile.length - 1].d - profile[0].d;
  if (L <= 0) return 0;
  const D = Math.max(0, profile[0].z - profile[profile.length - 1].z);
  const iMean = D > 0 ? D / L : 1e-3;
  const iFloor = Math.max(1e-4, 0.1 * iMean); // ≥ 0,01 % et ≥ 10 % de la pente brute
  let sum = 0, Lused = 0;
  for (let k = 1; k < profile.length; k++) {
    const li = profile[k].d - profile[k - 1].d;
    if (li <= 0) continue;
    const dz = profile[k - 1].z - profile[k].z;
    if (dz <= 0) continue; // remontées (bruit MNT) ignorées
    sum += li / Math.sqrt(Math.max(dz / li, iFloor));
    Lused += li;
  }
  if (sum <= 0 || Lused <= 0) return iMean * 100;
  return (Lused / sum) ** 2 * 100;
}

// Courbe hypsométrique (cotes BRUTES du MNT), H5 / H95 / Hmédiane / Hmoy / Hmax / Hmin ; cells triées croissantes.
function hypsometry(g, cells, samples = 21) {
  let nMasked = 0;
  for (let q = 0; q < cells.length; q++) if (g.valid[cells[q]]) nMasked++;
  const empty = { curve: [], h5: 0, h95: 0, hMean: 0, hMedian: 0, hMax: 0, hMin: 0 };
  if (nMasked === 0) return empty;
  const stride = Math.max(1, Math.floor((nMasked + 79999) / 80000)); // ≤ ~80 000 points pour la courbe
  const zs = new Float32Array(Math.ceil(nMasked / stride));
  const a = g.cellKm2;
  let total = 0, sumZA = 0, zMax = -Infinity, zMin = Infinity, seen = 0, m = 0;
  for (let q = 0; q < cells.length; q++) {
    const i = cells[q];
    if (!g.valid[i]) continue;
    const z = Math.fround(g.z[i]);
    if (z > zMax) zMax = z;
    if (z < zMin) zMin = z;
    total += a; sumZA += z * a;
    if (seen++ % stride === 0) zs[m++] = z;
  }
  const sorted = zs.subarray(0, m).sort(); // croissant ; parcouru du plus haut au plus bas
  const w = a * stride;
  let sampleTotal = 0;
  for (let k = 0; k < m; k++) sampleTotal += w;
  if (sampleTotal <= 0) sampleTotal = total;
  const H = (frac) => {
    const target = frac * sampleTotal;
    let c = 0;
    for (let k = m - 1; k >= 0; k--) { c += w; if (c >= target) return sorted[k]; }
    return sorted[0];
  };
  const curve = [];
  for (let s = 0; s < samples; s++) { const f = s / (samples - 1); curve.push({ areaPct: f * 100, z: H(f) }); }
  return { curve, h5: H(0.05), h95: H(0.95), hMean: sumZA / total, hMedian: H(0.5), hMax: zMax, hMin: zMin };
}

function makeMonotonicDescent(pts) {
  if (pts.length <= 1) return pts;
  let z = pts[0].z;
  return pts.map((p, i) => { if (i > 0 && p.z < z) z = p.z; return { d: p.d, z: i === 0 ? p.z : z }; });
}

// Douglas-Peucker à déviation VERTICALE sur un profil [{d, z}] (biefs de pente ~constante).
function simplifyProfile(pts, tolZ) {
  const n = pts.length;
  if (n <= 2) return pts.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const x0 = pts[a].d, y0 = pts[a].z, x1 = pts[b].d, y1 = pts[b].z, dx = x1 - x0;
    let maxDev = -1, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const zi = Math.abs(dx) < 1e-9 ? (y0 + y1) / 2 : y0 + ((pts[i].d - x0) / dx) * (y1 - y0);
      const dev = Math.abs(pts[i].z - zi);
      if (dev > maxDev) { maxDev = dev; mi = i; }
    }
    if (maxDev > tolZ && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function decimatePath(pts, maxPts) {
  const n = pts.length;
  if (n <= maxPts) return pts;
  const out = [], stepF = (n - 1) / (maxPts - 1);
  for (let i = 0; i < maxPts; i++) out.push(pts[Math.min(n - 1, roundEven(i * stepF))]);
  return out;
}

// Tampons réutilisables (dist = −1 partout entre deux appels) pour éviter une allocation n par bassin.
function scratchFor(g) {
  return { dist: new Float64Array(g.n).fill(-1), queue: new Int32Array(g.n), inMask: new Uint8Array(g.n) };
}

// Plus long cheminement hydraulique amont des semences, sans sortir du masque `within` (HydroEngine.MainStream).
function mainStream(g, H, seeds, within, S) {
  const { dist, queue } = S, { zf, dir } = H, w = g.nx;
  const seedSet = new Set();
  let qt = 0;
  for (const s of seeds) {
    if (s < 0 || s >= g.n || (within && !within[s])) continue;
    seedSet.add(s);
    if (dist[s] < 0) { dist[s] = 0; queue[qt++] = s; }
  }
  const zero = { lengthM: 0, dropM: 0, profile: [], path: [] };
  if (qt === 0) return zero;
  let maxDist = 0, maxCell = queue[0], qh = 0;
  while (qh < qt) {
    const cell = queue[qh++], r = (cell / w) | 0, c = cell - r * w;
    for (let k = 0; k < 8; k++) {
      const rr = r + DR[k], cc = c + DC[k];
      if (rr < 0 || cc < 0 || rr >= g.ny || cc >= w) continue;
      const j = rr * w + cc, d = dir[j];
      if (d !== ((k + 4) & 7)) continue; // j se déverse dans cell ⇔ sa direction est l'opposée de k (donc j valide)
      if (dist[j] >= 0 || (within && !within[j])) continue;
      dist[j] = dist[cell] + stepM(g, d);
      queue[qt++] = j;
      if (dist[j] > maxDist) { maxDist = dist[j]; maxCell = j; }
    }
  }
  for (let q = 0; q < qt; q++) dist[queue[q]] = -1; // remise à zéro du tampon
  // Cote hydrologique = MNT rempli (cohérent avec le D8).
  let outZ = Infinity;
  for (const s of seedSet) if (zf[s] < outZ) outZ = zf[s];
  let drop = Math.max(0, zf[maxCell] - outZ);
  let full = [{ d: 0, z: zf[maxCell] }];
  const geo = [{ x: cx(g, maxCell % w), y: cy(g, (maxCell / w) | 0), d: 0 }];
  let cur = maxCell, dd = 0;
  for (let guard = 0; guard < g.n; guard++) {
    const d = dir[cur];
    if (d < 0) break;
    const j = downstream(g, cur, d);
    if (j < 0 || !g.valid[j] || (within && !within[j])) break;
    dd += stepM(g, d);
    full.push({ d: dd, z: zf[j] });
    geo.push({ x: cx(g, j % w), y: cy(g, (j / w) | 0), d: dd });
    cur = j;
    if (seedSet.has(cur)) break;
  }
  full = makeMonotonicDescent(full);
  if (full.length >= 2) drop = Math.max(0, full[0].z - full[full.length - 1].z);
  return { lengthM: maxDist, dropM: drop, profile: simplifyProfile(full, Math.max(1.5, drop * 0.01)), path: decimatePath(geo, 700) };
}

// Exutoire hydrologique d'un masque quelconque (HydroEngine.MainOutletCells) : cellule du masque dont le D8 sort du
// masque, d'accumulation maximale ; repli : cellule la plus basse.
function mainOutletCells(g, H, cells, inMask) {
  let best = -1, bestAcc = -Infinity, lowest = -1, lowestZ = Infinity;
  for (let q = 0; q < cells.length; q++) {
    const i = cells[q];
    if (!g.valid[i]) continue;
    if (g.z[i] < lowestZ) { lowestZ = g.z[i]; lowest = i; }
    const d = H.dir[i], j = d >= 0 ? downstream(g, i, d) : -1;
    if (!(j < 0 || !g.valid[j] || !inMask[j])) continue;
    if (H.acc[i] > bestAcc) { bestAcc = H.acc[i]; best = i; }
  }
  return best >= 0 ? [best] : lowest >= 0 ? [lowest] : [];
}

// Métriques complètes d'un ensemble de cellules (triées croissantes) — cœur commun à delineate et basinMetrics.
function metricsOf(g, H, cells, seeds, polygons, S) {
  const { inMask } = S;
  for (let q = 0; q < cells.length; q++) inMask[cells[q]] = 1;
  if (!seeds || !seeds.length) seeds = mainOutletCells(g, H, cells, inMask);
  const ms = mainStream(g, H, seeds, inMask, S);
  for (let q = 0; q < cells.length; q++) inMask[cells[q]] = 0;
  let nValid = 0, edge = false;
  for (let q = 0; q < cells.length; q++) { const i = cells[q]; if (g.valid[i]) { nValid++; if (g.edge[i]) edge = true; } }
  const areaKm2 = nValid * g.cellKm2;
  let perimeterM = 0;
  for (const poly of polygons) for (const ring of poly) for (let k = 1; k < ring.length; k++) perimeterM += Math.hypot(ring[k].x - ring[k - 1].x, ring[k].y - ring[k - 1].y);
  const perimeterKm = perimeterM / 1000;
  const gr = gravelius(areaKm2, perimeterKm);
  const hy = hypsometry(g, cells);
  const lengthKm = ms.lengthM / 1000;
  const slopePct = lengthKm > 0 ? (ms.dropM / ms.lengthM) * 100 : 0;
  const slopeEqPct = equivalentSlopePct(ms.profile);
  const zOutlet = ms.profile.length >= 2 ? ms.profile[ms.profile.length - 1].z : hy.hMin;
  return {
    cells: nValid,
    areaKm2,
    touchesEdge: edge,
    perimeterM,
    perimeterKm,
    gravelius: gr.kg,
    rectLengthKm: gr.L,
    rectWidthKm: gr.l,
    hMax: hy.hMax,
    hMin: hy.hMin,
    hMean: hy.hMean,
    hMedian: hy.hMedian,
    h5: hy.h5,
    h95: hy.h95,
    meanReliefM: hy.hMean - hy.hMin, // « Hmoy » de Giandotti : altitude moyenne − altitude minimale
    totalReliefM: hy.hMax - hy.hMin,
    globalSlope: gr.L > 0 ? (hy.h5 - hy.h95) / gr.L : 0, // Ig (m/km)
    lengthM: ms.lengthM, // plus long cheminement hydraulique L
    lengthKm,
    dropM: ms.dropM, // dénivelée du plus long cheminement (MNT rempli, profil monotone)
    slopePct, // pente brute D/L (%)
    slopeEqPct, // pente équivalente Ieq (%)
    slopeTcPct: slopeEqPct > 0 ? slopeEqPct : slopePct, // pente retenue par BVTrace pour Ventura / Passini
    zOutlet,
    deltaHM: Math.max(0, hy.hMedian - zOutlet), // ΔH Ghorbel : Hmédiane − cote au franchissement
    seeds: Array.from(seeds),
    hypsometry: hy.curve,
    profile: ms.profile,
    streamPath: ms.path,
  };
}

function resolveOutlet(g, outlet) {
  if (outlet == null) return null;
  if (typeof outlet === 'number') return [outlet];
  if (Array.isArray(outlet) || ArrayBuffer.isView(outlet)) return Array.from(outlet);
  if (Number.isInteger(outlet.cell)) return [outlet.cell];
  if (Number.isInteger(outlet.i) && Number.isInteger(outlet.j)) return [outlet.j * g.nx + outlet.i];
  if (Number.isFinite(outlet.x) && Number.isFinite(outlet.y)) { const c = cellAt(g, outlet.x, outlet.y); return c >= 0 ? [c] : null; }
  return null;
}

/**
 * Morphométrie d'un bassin (BasinMetrics + HydroEngine.MainStream) : tout ce qu'exigent Kirpich, Ventura,
 * Passini et Giandotti.
 * @param mask   Uint8Array / boolean[] de nx·ny valeurs, ou Int32Array d'indices de cellules.
 * @param outlet cellule(s) exutoire : indice, tableau d'indices, { cell }, { i, j } ou { x, y } ;
 *               absent → exutoire principal du masque (MainOutletCells).
 * @param opts   { hydro (prepareHydro), polygons (déjà calculés), simplifyTol }
 */
export function basinMetrics(grid, mask, outlet, opts = {}) {
  const g = normGrid(grid);
  const H = ensureHydro(g, opts.hydro);
  let cells = toCells(g, mask);
  if (!(cells instanceof Int32Array)) cells = Int32Array.from(cells);
  cells = cells.slice().sort();
  const polygons = opts.polygons ?? polygonizeBox(g, cellsBox(g, cells), opts.simplifyTol ?? g.cell * DEFAULTS.simplifyCellFactor);
  return metricsOf(g, H, cells, resolveOutlet(g, outlet), polygons, scratchFor(g));
}

/**
 * Temps de concentration (HydrologyFormulas de BVTrace) à partir des métriques ; 0 si non calculable.
 * Kirpich, Ventura : minutes ; Passini, Giandotti : heures (tcMin donne les quatre en minutes).
 * Pente : Ieq si disponible, sinon D/L (comme BVTrace) ; Giandotti avec Hmoy = altitude moyenne − altitude minimale.
 */
export function concentrationTimes(m) {
  const A = m.areaKm2, Lkm = m.lengthKm, S = m.slopeTcPct;
  const D = m.profile?.length >= 2 ? m.dropM : Math.max(0, m.hMax - m.hMin);
  const kirpichMin = Lkm > 0 && D > 0 ? 0.0195 * ((Lkm * 1000) ** 3 / D) ** 0.385 : 0;
  const venturaMin = A > 0 && S > 0 ? 76 * Math.sqrt(A / S) : 0;
  const passiniH = A > 0 && Lkm > 0 && S > 0 ? (0.108 * Math.cbrt(A * Lkm)) / Math.sqrt(S / 100) : 0;
  const giandottiH = A > 0 && Lkm > 0 && m.meanReliefM > 0 ? (4 * Math.sqrt(A) + 1.5 * Lkm) / (0.8 * Math.sqrt(m.meanReliefM)) : 0;
  return { kirpichMin, venturaMin, passiniH, giandottiH, tcMin: { kirpich: kirpichMin, ventura: venturaMin, passini: passiniH * 60, giandotti: giandottiH * 60 } };
}

// --------------------------------------------------------------------------- Réseau d'écoulement (BuildStreamNetwork)
function streamNetwork(g, H, thrKm2, stopAtSea, seaLevelM) {
  const { n, nx: w } = g, { dir, acc } = H;
  const isStream = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (g.valid[i] && !(stopAtSea && g.z[i] <= seaLevelM) && acc[i] * g.cellKm2 >= thrKm2) isStream[i] = 1;
  const indeg = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!isStream[i] || dir[i] < 0) continue;
    const j = downstream(g, i, dir[i]);
    if (j >= 0 && isStream[j]) indeg[j]++;
  }
  const pt = (i) => ({ x: cx(g, i % w), y: cy(g, (i / w) | 0) });
  const links = [];
  for (let s = 0; s < n; s++) {
    if (!isStream[s] || indeg[s] === 1) continue; // départ : source (0) ou confluence (≥ 2)
    const pts = [pt(s)];
    let cur = s, maxAcc = acc[s];
    for (;;) {
      const d = dir[cur];
      if (d < 0) break;
      const j = downstream(g, cur, d);
      if (j < 0 || !isStream[j]) break;
      pts.push(pt(j));
      if (acc[j] > maxAcc) maxAcc = acc[j];
      cur = j;
      if (indeg[cur] >= 2) break; // confluence : point partagé avec le tronçon aval
    }
    if (pts.length >= 2) links.push({ pts, accKm2: maxAcc * g.cellKm2 }); // orienté amont → aval
  }
  return links;
}

// --------------------------------------------------------------------------- Pipeline complet
/** PK en notation routière « PK k+mmm » (GeoUtils.FormatPk). */
export function formatPk(meters) {
  const neg = meters < 0;
  meters = Math.abs(meters);
  let km = Math.trunc(meters / 1000), m = roundEven(meters - km * 1000);
  if (m === 1000) { km++; m = 0; }
  return `${neg ? '-' : ''}PK ${km}+${String(m).padStart(3, '0')}`;
}

// Fusion de listes triées croissantes et disjointes (fusions deux à deux équilibrées, O(N log m)).
function mergeSorted(lists) {
  while (lists.length > 1) {
    const next = [];
    for (let q = 0; q < lists.length; q += 2) {
      const a = lists[q], b = lists[q + 1];
      if (!b) { next.push(a); continue; }
      const out = new Int32Array(a.length + b.length);
      let i = 0, j = 0, p = 0;
      while (i < a.length && j < b.length) out[p++] = a[i] < b[j] ? a[i++] : b[j++];
      while (i < a.length) out[p++] = a[i++];
      while (j < b.length) out[p++] = b[j++];
      next.push(out);
    }
    lists = next;
  }
  return lists[0];
}

// Regroupe des cellules par étiquette (tri par comptage) → tableau de Int32Array triés croissants.
function groupBy(n, label, nb) {
  const count = new Int32Array(nb + 1);
  for (let i = 0; i < n; i++) if (label[i] >= 0) count[label[i] + 1]++;
  for (let k = 0; k < nb; k++) count[k + 1] += count[k];
  const all = new Int32Array(count[nb]), pos = count.slice(0, nb);
  for (let i = 0; i < n; i++) if (label[i] >= 0) all[pos[label[i]]++] = i;
  const out = [];
  for (let k = 0; k < nb; k++) out.push(all.subarray(count[k], count[k + 1]));
  return out;
}

/**
 * Délimitation complète.
 * @param grid   grille MNT GIRA (voir en-tête).
 * @param traces [{ key, name, pts: [{x, y}], pk0? }] — l'ordre fixe la priorité aux cellules communes.
 * @param opts   { minAreaKm2 = 0,05, streamKm2 = 0,1, clipTotalsToTrace = true, simplifyCellFactor = 0,4,
 *                 streams = true, polygons = true, metrics = true, stopAtSea = true, seaLevelM = 0,
 *                 hydro (résultat de prepareHydro, réutilisé), onProgress(msg) }
 */
export function delineate(grid, traces, opts = {}) {
  const o = { ...DEFAULTS, streams: true, polygons: true, metrics: true, ...opts };
  const g = normGrid(grid);
  const warnings = [];
  const onProgress = o.onProgress;
  const tm = {};
  let t = now();
  const lap = (k) => { const t2 = now(); tm[k] = t2 - t; t = t2; };

  const H = ensureHydro(g, o.hydro);
  Object.assign(tm, H === o.hydro ? { fillMs: 0, d8Ms: 0, accMs: 0, reused: true } : H.timings);
  t = now();

  onProgress?.('Rasterisation des tracés…');
  const R = rasterizeTraces(g, Array.isArray(traces) ? traces : [traces], warnings);
  if (!R.traces.some((tr) => tr.cells.length)) throw new Error('Le tracé est hors de la zone MNT valide.');
  lap('rasterMs');

  onProgress?.('Affectation des cellules aux franchissements…');
  const firstHit = computeFirstHit(g, H.dir, R.isRoad);
  lap('firstHitMs');

  // Franchissements, numérotés globalement (ordre des tracés, puis PK).
  onProgress?.('Détection des franchissements principaux…');
  const X = [];
  R.traces.forEach((tr, ti) => {
    const list = findCrossings(g, H.acc, tr, o.minAreaKm2);
    tr.first = X.length; tr.count = list.length;
    if (list.length === 1 && list[0].fallback) warnings.push(`Tracé « ${tr.name} » : aucun écoulement ≥ ${o.minAreaKm2} km² ; bassin unique à la cellule la plus drainée.`);
    for (const c of list) X.push({ ...c, trace: ti });
  });
  const nc = X.length;
  if (nc === 0) throw new Error('Aucun franchissement détecté.');
  lap('crossingsMs');

  // Partition sans vide : PK médians entre franchissements consécutifs d'un même tracé.
  onProgress?.('Construction de la partition (sans vides)…');
  const segOfRoad = new Int32Array(g.n).fill(-1);
  for (const tr of R.traces) {
    if (!tr.count) continue;
    const bounds = [];
    for (let k = 1; k < tr.count; k++) bounds.push(0.5 * (X[tr.first + k - 1].ch + X[tr.first + k].ch));
    for (let q = 0; q < tr.cells.length; q++) {
      const ch = tr.ch[q];
      let lo = 0, hi = bounds.length; // premier indice tel que ch < bounds[idx]
      while (lo < hi) { const mid = (lo + hi) >> 1; if (ch < bounds[mid]) hi = mid; else lo = mid + 1; }
      segOfRoad[tr.cells[q]] = tr.first + lo;
    }
  }
  const basinId = new Int32Array(g.n).fill(-1);
  for (let i = 0; i < g.n; i++) { const h = firstHit[i]; if (h >= 0) basinId[i] = segOfRoad[h]; }
  const partCells = groupBy(g.n, basinId, nc);
  lap('partitionMs');

  // Bassins totaux. memberOf : cellule de tracé → franchissement dont elle est semence.
  onProgress?.('Bassins versants totaux…');
  const memberOf = new Int32Array(g.n).fill(-1);
  X.forEach((c, k) => { for (const m of c.members) memberOf[m] = k; });
  // Emboîtement (sans barrière) : k contient m si le chemin D8 issu de la cellule représentative de m traverse une
  // semence de k — équivalent exact de rawMask[k][RepCell(m)] dans BVTrace, sans remontée complète.
  const containedIdx = X.map(() => []);
  for (let m = 0; m < nc; m++) {
    let c = X[m].rep;
    const hit = new Set();
    for (let guard = 0; guard < g.n; guard++) {
      const d = H.dir[c];
      if (d < 0) break;
      c = downstream(g, c, d);
      if (c < 0 || !g.valid[c]) break;
      const k = memberOf[c];
      if (k >= 0 && k !== m && !hit.has(k)) { hit.add(k); containedIdx[k].push(m); }
    }
  }
  for (const l of containedIdx) l.sort((a, b) => a - b);

  let totCells;
  if (o.clipTotalsToTrace) {
    // Remontée avec le tracé pour barrière = cellules non-tracé dont le premier impact est une semence de k, plus
    // les semences : se lit directement sur firstHit (ensembles disjoints d'un franchissement à l'autre).
    const clipOf = new Int32Array(g.n).fill(-1);
    for (let i = 0; i < g.n; i++) {
      const h = firstHit[i];
      if (h < 0) continue;
      const k = memberOf[h];
      if (k >= 0 && (!R.isRoad[i] || i === h)) clipOf[i] = k;
    }
    const clip = groupBy(g.n, clipOf, nc);
    // Masque affiché = découpe de k ∪ découpes des bassins qu'il englobe (disjointes → simple concaténation).
    totCells = X.map((_, k) => (o.nestTotals && containedIdx[k].length ? mergeSorted([clip[k], ...containedIdx[k].map((m) => clip[m])]) : clip[k]));
  } else {
    // Remontée D8 inversée complète, sans barrière (UpstreamMask), union avec les bassins englobés.
    const stamp = new Int32Array(g.n).fill(-1), queue = new Int32Array(g.n);
    const raw = X.map((c, k) => {
      let qt = 0, qh = 0;
      for (const s of c.members) if (stamp[s] !== k) { stamp[s] = k; queue[qt++] = s; }
      while (qh < qt) {
        const cell = queue[qh++], r = (cell / g.nx) | 0, cc0 = cell - r * g.nx;
        for (let d8 = 0; d8 < 8; d8++) {
          const rr = r + DR[d8], cc = cc0 + DC[d8];
          if (rr < 0 || cc < 0 || rr >= g.ny || cc >= g.nx) continue;
          const j = rr * g.nx + cc;
          if (stamp[j] === k || !g.valid[j]) continue;
          if (H.dir[j] === ((d8 + 4) & 7)) { stamp[j] = k; queue[qt++] = j; } // j se déverse dans cell
        }
      }
      return queue.slice(0, qt);
    });
    const seen = new Int32Array(g.n).fill(-1);
    totCells = X.map((_, k) => {
      const out = [];
      for (const src of [k, ...containedIdx[k]]) for (const i of raw[src]) if (seen[i] !== k) { seen[i] = k; out.push(i); }
      return Int32Array.from(out).sort();
    });
  }
  if (o.totalsFromPartition) totCells = partCells.map((c) => Int32Array.from(c).sort());
  const totKm2 = totCells.map((c) => c.length * g.cellKm2);
  lap('totalsMs');

  // Assemblage des franchissements, polygones et morphométrie.
  onProgress?.('Vectorisation et morphométrie…');
  const tol = g.cell * o.simplifyCellFactor;
  const S = o.metrics ? scratchFor(g) : null;
  const ids = X.map((_, k) => `BV-${String(k + 1).padStart(2, '0')}`);
  const crossings = X.map((c, k) => {
    const tr = R.traces[c.trace];
    const r = (c.rep / g.nx) | 0, col = c.rep - r * g.nx;
    const d = H.dir[c.rep];
    const flowDir = d >= 0 ? { x: DC[d] / Math.hypot(DC[d], DR[d]), y: -DR[d] / Math.hypot(DC[d], DR[d]) } : null;
    const pc = partCells[k], tc = totCells[k];
    let partEdge = false, totEdge = false;
    for (let q = 0; q < pc.length; q++) if (g.edge[pc[q]]) { partEdge = true; break; }
    for (let q = 0; q < tc.length; q++) if (g.edge[tc[q]]) { totEdge = true; break; }
    const contained = containedIdx[k];
    const incrementalKm2 = contained.length && o.nestTotals && !o.totalsFromPartition ? totKm2[k] - Math.max(...contained.map((m) => totKm2[m])) : null;
    const polygonTotal = o.polygons || o.metrics ? polygonizeBox(g, cellsBox(g, tc), tol) : null;
    const out = {
      id: ids[k],
      index: k,
      key: tr.key,
      traceName: tr.name,
      pk: c.ch + tr.pk0,
      pkLabel: formatPk(c.ch + tr.pk0),
      x: cx(g, col),
      y: cy(g, r),
      flowDir,
      accKm2: c.acc * g.cellKm2,
      totalKm2: totKm2[k],
      incrementalKm2,
      contains: contained.map((m) => ids[m]),
      partitionKm2: pc.length * g.cellKm2,
      touchesEdge: totEdge,
      partitionTouchesEdge: partEdge,
      fallback: c.fallback,
      outlet: { cell: c.rep, i: col, j: r },
      memberCells: c.members.slice(),
      polygonTotal: o.polygons ? polygonTotal : null,
      polygonPartition: o.polygons ? polygonizeBox(g, cellsBox(g, pc), tol) : null,
      metrics: o.metrics ? metricsOf(g, H, tc, c.members, polygonTotal, S) : null,
    };
    if (partEdge) warnings.push(`${ids[k]} (${tr.name}, ${out.pkLabel}) : la partition touche le bord du MNT — élargissez l'emprise du MNT.`);
    if (totEdge) warnings.push(`BVT-${ids[k].slice(3)} (${tr.name}, ${out.pkLabel}) : le bassin total touche le bord du MNT — surface probablement sous-estimée, élargissez l'emprise du MNT.`);
    return out;
  });
  lap('assemblyMs');

  let streams = null;
  if (o.streams) {
    onProgress?.("Extraction du réseau d'écoulement…");
    streams = streamNetwork(g, H, o.streamKm2 > 0 ? o.streamKm2 : o.minAreaKm2, o.stopAtSea, o.seaLevelM);
    lap('streamsMs');
  }

  let contributing = 0;
  for (let i = 0; i < g.n; i++) if (firstHit[i] >= 0) contributing++;
  onProgress?.(`Terminé : ${nc} franchissement(s).`);
  return {
    crossings,
    streams,
    warnings,
    // roadCells / roadPk : cellules propres au tracé (ordre de première atteinte) et PK de première atteinte (pk0 inclus).
    traces: R.traces.map((tr) => ({ key: tr.key, name: tr.name, lengthM: tr.lengthM, crossings: tr.count || 0, roadCells: Int32Array.from(tr.cells), roadPk: Float64Array.from(tr.ch, (v) => v + tr.pk0) })),
    contributingKm2: contributing * g.cellKm2,
    hydro: H,
    rasters: { isRoad: R.isRoad, owner: R.owner, firstHit, basinId, totalCells: totCells },
    timings: tm,
  };
}
