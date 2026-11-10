// Contrôle d'emprise : trottoir disponible entre les bordures du projet et un calque protégé du fond DXF (bâti).
// Trottoir disponible = distance de la bordure (bord de chaussée) à l'obstacle − caniveau − bordure ; à l'intérieur
// d'un contour fermé du calque (hachure, polyligne fermée), la distance est comptée négative.
// Seuils (urbain) : < min (1,50 m) → erreur, < trottoir du profil (2,50 m) → avertissement.
import * as G from './geom.js';

const CELL = 5;

// Obstacles d'un calque : segments indexés sur une grille, contours fermés (test d'intérieur).
export function empriseObstacles(geo, layer) {
  if (!geo || !layer) return null;
  const segs = [], rings = [];
  const add = (a, closed) => {
    const n = a.length / 2;
    for (let i = 0; i + 1 < n; i++) segs.push(a[2 * i], a[2 * i + 1], a[2 * i + 2], a[2 * i + 3]);
    if (closed && n > 2) {
      segs.push(a[2 * n - 2], a[2 * n - 1], a[0], a[1]);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < a.length; i += 2) { x0 = Math.min(x0, a[i]); x1 = Math.max(x1, a[i]); y0 = Math.min(y0, a[i + 1]); y1 = Math.max(y1, a[i + 1]); }
      rings.push({ a, x0, y0, x1, y1 });
    }
  };
  for (const p of geo.polys || []) if (p.layer === layer) {
    const a = p.pts, n = a.length / 2;
    // polyligne refermée sur elle-même sans l'indicateur « fermée »
    const cl = p.closed || (n > 3 && Math.hypot(a[0] - a[2 * n - 2], a[1] - a[2 * n - 1]) < 1e-3);
    add(a, cl);
  }
  for (const h of geo.hatches || []) if (h.layer === layer) for (const r of h.rings) add(r, true);
  if (!segs.length) return null;
  const grid = new Map();
  for (let k = 0; k < segs.length; k += 4) {
    const i0 = Math.floor(Math.min(segs[k], segs[k + 2]) / CELL), i1 = Math.floor(Math.max(segs[k], segs[k + 2]) / CELL);
    const j0 = Math.floor(Math.min(segs[k + 1], segs[k + 3]) / CELL), j1 = Math.floor(Math.max(segs[k + 1], segs[k + 3]) / CELL);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 2500) continue; // segment démesuré (cadre, erreur de dessin)
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const key = i + ',' + j; let c = grid.get(key); if (!c) grid.set(key, (c = [])); c.push(k); }
  }
  return { layer, segs, rings, grid, n: segs.length / 4 };
}

function inside(rings, x, y) {
  let ins = false;
  for (const r of rings) {
    if (x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1) continue;
    const a = r.a, n = a.length / 2;
    let c = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yi = a[2 * i + 1], yj = a[2 * j + 1];
      if ((yi > y) !== (yj > y) && x < ((a[2 * j] - a[2 * i]) * (y - yi)) / (yj - yi) + a[2 * i]) c = !c;
    }
    if (c) ins = !ins; // pair-impair : un trou de hachure est hors obstacle
  }
  return ins;
}

// Distance (signée : < 0 à l'intérieur) du point au calque, plafonnée à rMax ; point de l'obstacle le plus proche.
export function obstacleDist(ob, x, y, rMax = 8) {
  const i0 = Math.floor((x - rMax) / CELL), i1 = Math.floor((x + rMax) / CELL), j0 = Math.floor((y - rMax) / CELL), j1 = Math.floor((y + rMax) / CELL);
  const s = ob.segs, seen = new Set();
  let best = rMax, q = null;
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const c = ob.grid.get(i + ',' + j); if (!c) continue;
    for (const k of c) {
      if (seen.has(k)) continue; seen.add(k);
      const ax = s[k], ay = s[k + 1], dx = s[k + 2] - ax, dy = s[k + 3] - ay, L2 = dx * dx + dy * dy;
      const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0;
      const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
      if (d < best) { best = d; q = { x: px, y: py }; }
    }
  }
  const ins = inside(ob.rings, x, y);
  return { d: ins ? -best : best, q, inside: ins };
}

// Échantillonne un chemin (segments de geom.js) tous les `step` mètres.
function sample(segs, step) {
  const out = [];
  for (const sg of segs) {
    const L = G.segLen(sg), n = Math.max(1, Math.ceil(L / step));
    for (let i = out.length ? 1 : 0; i <= n; i++) out.push(G.segAt(sg, i / n));
  }
  return out;
}

// Contrôle sur les bordures (primitives BORDURE) d'un ou plusieurs carrefours.
//  designs : [{ D, name }] ; ded : largeur retranchée (caniveau + bordure) ; min / want : trottoir mini / voulu.
// Résultat : tronçons non conformes { lvl, pts, min (trottoir disponible mini), len, at (point le plus défavorable),
// q (obstacle correspondant), where }, et statistiques.
export function empriseCheck(designs, ob, { ded = 0, min = 1.5, want = 2.5, step = 0.5 } = {}) {
  const runs = [];
  let nPts = 0, worst = Infinity;
  const rMax = want + ded + 2;
  for (const { D, name } of designs) {
    if (!D?.prims) continue;
    for (const pr of D.prims) {
      if (pr.k !== 'path' || pr.L !== 'BORDURE' || !pr.segs?.length) continue;
      const pts = sample(pr.segs, step);
      let cur = null;
      const close = () => { if (cur) { cur.len = Math.max(step, (cur.pts.length - 1) * step); runs.push(cur); cur = null; } };
      for (const p of pts) {
        nPts++;
        const r = obstacleDist(ob, p.x, p.y, rMax), avail = r.d - ded;
        if (avail < worst) worst = avail;
        const lvl = avail < min - 1e-9 ? 'err' : avail < want - 1e-9 ? 'warn' : null;
        if (!lvl) { close(); continue; }
        if (cur && cur.lvl !== lvl) {
          // un tronçon orange qui devient rouge (ou l'inverse) : nouveau tronçon, contigu
          const last = cur.pts[cur.pts.length - 1]; close(); cur = { lvl, pts: [last], min: Infinity, design: name, D };
        }
        if (!cur) cur = { lvl, pts: [], min: Infinity, design: name, D };
        cur.pts.push(p);
        if (avail < cur.min) { cur.min = avail; cur.at = p; cur.q = r.q; cur.inside = r.inside; }
      }
      close();
    }
  }
  const edgesOf = new Map();
  for (const r of runs) r.where = locate(r, edgesOf);
  for (const r of runs) delete r.D;
  return { runs, nPts, worst: Number.isFinite(worst) ? worst : null, nErr: runs.filter((r) => r.lvl === 'err').length, nWarn: runs.filter((r) => r.lvl === 'warn').length };
}

// Lieu d'un tronçon : bord de chaussée de branche le plus proche (rayon unique Re/Rs : les deux branches), sinon anneau.
function locate(r, cache) {
  const D = r.D;
  if (!D?.branches?.length) return '';
  let E = cache.get(D);
  if (!E) {
    E = [];
    const bds = D.branches, n = bds.length;
    bds.forEach((bd, i) => {
      for (const sd of [bd.entry, bd.exit]) {
        const segs = sd?.edgeW;
        if (!segs?.length) continue;
        const fusedArc = sd === bd.entry && sd.fused ? segs[segs.length - 1] : null;
        const nx = bds[(i + 1) % n];
        for (const sg of segs) E.push({ pts: sample([sg], 1), name: sg === fusedArc ? `raccordement ${bd.name} / ${nx.name}` : `branche ${bd.name}` });
      }
    });
    cache.set(D, E);
  }
  let best = Infinity, name = '';
  for (const e of E) for (const p of e.pts) { const d = Math.hypot(p.x - r.at.x, p.y - r.at.y); if (d < best) { best = d; name = e.name; } }
  return best < 1.5 ? name : D.O ? 'anneau' : '';
}

const f2 = (v) => v.toFixed(2).replace('.', ',');

// Messages de la liste des contrôles (un par tronçon, tronçons voisins de même niveau regroupés par lieu).
export function empriseMessages(res, layer, { min = 1.5, want = 2.5, multi = false } = {}) {
  const out = [];
  if (!res) return out;
  const groups = new Map();
  for (const r of res.runs) {
    const key = r.lvl + '|' + (multi ? r.design + ' · ' : '') + r.where;
    const g = groups.get(key);
    if (!g) groups.set(key, { ...r, n: 1, where: (multi && r.design ? r.design + ' · ' : '') + r.where });
    else { g.len += r.len; g.n++; if (r.min < g.min) Object.assign(g, { min: r.min, at: r.at, q: r.q, inside: r.inside }); }
  }
  for (const g of [...groups.values()].sort((a, b) => a.min - b.min)) {
    const dispo = g.inside ? `bordure à l'intérieur du calque ${layer}` : `trottoir disponible ${f2(g.min)} m ${g.lvl === 'err' ? `< ${f2(min)} m (minimum)` : `< ${f2(want)} m (trottoir du profil)`}`;
    out.push({
      lvl: g.lvl, group: 'Emprise', at: g.at,
      msg: `${g.where ? g.where[0].toUpperCase() + g.where.slice(1) + ' : ' : ''}${dispo} sur ≈ ${Math.round(g.len)} m${g.n > 1 ? ` (${g.n} tronçons)` : ''} — reculer la bordure ou réduire la chaussée.`,
    });
  }
  if (!res.runs.length && res.nPts) out.push({ lvl: 'info', group: 'Emprise', msg: `Trottoir ≥ ${f2(want)} m le long de toutes les bordures (calque ${layer}, plus faible : ${res.worst != null && res.worst < want + 2 ? f2(res.worst) + ' m' : '> ' + f2(want + 2) + ' m'}).` });
  return out;
}
