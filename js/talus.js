// talus.js — talus en plan : bord de plate-forme côté talus, entrées en terre (EET) et barbules, pour tous les axes
// du projet (autoroute, voies secondaires, bretelles, branches et anneau des carrefours, route principale d'un
// carrefour plan), découpés automatiquement entre axes.
//
// Chaque axe donne un « couloir » : des rangées (stations) avec, de chaque côté, le point de départ du talus c (bord de
// plate-forme ou fond de fossé), l'entrée en terre e et le bord extérieur de la plate-forme. Entre deux stations :
// un quadrilatère de plate-forme et, de chaque côté, un quadrilatère de talus (cotes aux sommets).
// Découpe (barbules et lignes) en un point P du talus de l'axe K, de cote zK et de nature remblai (R) ou déblai (D) :
//   • P sous la plate-forme d'un autre axe ou sous un tablier : masqué ;
//   • P dans le talus de remblai d'un autre axe plus haut que zK (K en remblai) : masqué, le remblai le plus haut
//     l'emporte (enveloppe supérieure) ;
//   • P dans le talus de déblai d'un autre axe plus bas que zK (K en déblai) : masqué, le déblai le plus profond
//     l'emporte (enveloppe inférieure) ;
//   • K en déblai sous le remblai d'un autre axe : masqué (le remblai est mis en place sur l'emprise).
// Les lignes s'arrêtent donc sur la ligne de rencontre des deux surfaces, qui est dessinée (meetLines). Barbules (comme BVTrace) : une longue de
// la crête au pied puis trois courtes (34 % de la longueur) partant de la crête — bord de plate-forme en remblai,
// entrée en terre en déblai —, à l'espacement esp le long de la crête.
import * as G from './geom.js';
import { tinZ } from './tin.js';

const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

// Rangée d'un couloir à partir d'une coupe (pt.js / ptaxes.js) : { L (côté y < 0), R (côté y > 0) }.
export function rowFromSection(cs) {
  const W = (q) => ({ x: cs.p.x + cs.n.x * q.y, y: cs.p.y + cs.n.y * q.y, z: q.z });
  const P = cs.proj, pf = cs.platform?.length ? cs.platform : P;
  const side = (end, c, edge) => {
    if (!edge) return null;
    const out = { edge: W(edge) };
    if (end && c) { out.e = W(end); out.c = W(c); out.br = c.z >= end.z ? 'R' : 'D'; }
    return out;
  };
  return {
    s: cs.s,
    L: side(cs.endL, cs.endL && P.length > 1 ? P[1] : null, pf[0]),
    R: side(cs.endR, cs.endR && P.length > 1 ? P[P.length - 2] : null, pf[pf.length - 1]),
  };
}

// Talus radial de l'anneau : depuis le bord (point c, cote z0) vers l'extérieur (u unitaire), pente 1/remblai ou
// 1/déblai jusqu'au TN. Rend { c, e, br } ou null.
export function radialTalus(c, u, tin, P, maxD = 60) {
  const tn0 = tinZ(tin, c.x, c.y);
  if (tn0 == null) return null;
  const fill = c.z >= tn0, g = fill ? -1 / P.remblai : 1 / P.deblai;
  const F = (d) => { const q = G.add(c, G.mul(u, d)), t = tinZ(tin, q.x, q.y); return t == null ? NaN : c.z + g * d - t; };
  let da = 0, fa = F(0);
  for (let db = 0.25; db <= maxD; db += 0.25) {
    const fb = F(db);
    if (!isFinite(fb)) return null;
    if (fa * fb <= 0) {
      let lo = da, hi = db, flo = fa;
      for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2, fm = F(m); if (flo * fm <= 0) hi = m; else { lo = m; flo = fm; } }
      const d = (lo + hi) / 2, q = G.add(c, G.mul(u, d));
      return { c, e: { x: q.x, y: q.y, z: c.z + g * d }, br: fill ? 'R' : 'D' };
    }
    da = db; fa = fb;
  }
  return null;
}

// ------------------------------------------------------------------------------------------------ régions
function inTri(t, x, y) {
  const { a, b, c } = t, d = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(d) < 1e-12) return null;
  const l1 = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / d, l2 = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / d, l3 = 1 - l1 - l2;
  const eps = -1e-9;
  return l1 >= eps && l2 >= eps && l3 >= eps ? l1 * a.z + l2 * b.z + l3 * c.z : null;
}
class Regions {
  constructor(cell = 10) { this.cell = cell; this.grid = new Map(); this.tris = []; }
  add(a, b, c, kind, cid) {
    const t = { a, b, c, kind, cid }, i = this.tris.push(t) - 1, k = this.cell;
    const x0 = Math.floor(Math.min(a.x, b.x, c.x) / k), x1 = Math.floor(Math.max(a.x, b.x, c.x) / k);
    const y0 = Math.floor(Math.min(a.y, b.y, c.y) / k), y1 = Math.floor(Math.max(a.y, b.y, c.y) / k);
    if ((x1 - x0) * (y1 - y0) > 4000) return; // triangle dégénéré (rangées incohérentes) : ignoré
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) { const key = gx + ',' + gy; if (!this.grid.has(key)) this.grid.set(key, []); this.grid.get(key).push(i); }
  }
  quad(a, b, c, d, kind, cid) { this.add(a, b, c, kind, cid); this.add(a, c, d, kind, cid); }
  // Le point (x, y) du talus de l'axe cid, de cote z et de nature br, est-il apparent ? (cid2 : second axe ignoré,
  // pour la ligne de rencontre de deux talus)
  visible(x, y, z, br, cid, cid2 = cid) {
    const list = this.grid.get(Math.floor(x / this.cell) + ',' + Math.floor(y / this.cell));
    if (!list) return true;
    for (const i of list) {
      const t = this.tris[i];
      if (t.cid === cid || t.cid === cid2) continue;
      const zt = inTri(t, x, y);
      if (zt == null) continue;
      if (t.kind === 'P') return false;
      if (br === 'R' && t.kind === 'R' && zt > z + 0.02) return false;
      if (br === 'D' && t.kind === 'D' && zt < z - 0.02) return false;
      if (br === 'D' && t.kind === 'R') return false;
    }
    return true;
  }
}

// Parties apparentes du segment a → b (points { x, y, z }) : [[p, q], …].
function clipSeg(R, a, b, br, cid, cid2 = cid) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (!(len > 1e-6)) return [];
  const n = Math.max(1, Math.ceil(len / 0.3)), vis = (t) => { const p = lerp(a, b, t); return R.visible(p.x, p.y, p.z, br, cid, cid2); };
  const out = [];
  let prevT = 0, prevV = vis(0), start = prevV ? 0 : null;
  const edge = (t0, t1, v0) => { for (let i = 0; i < 12; i++) { const m = (t0 + t1) / 2; if (vis(m) === v0) t0 = m; else t1 = m; } return (t0 + t1) / 2; };
  for (let i = 1; i <= n; i++) {
    const t = i / n, v = vis(t);
    if (v !== prevV) {
      const te = edge(prevT, t, prevV);
      if (prevV) { out.push([lerp(a, b, start), lerp(a, b, te)]); start = null; } else start = te;
    }
    prevT = t; prevV = v;
  }
  if (prevV && start != null && 1 - start > 1e-6) out.push([lerp(a, b, start), b]);
  return out;
}

// ------------------------------------------------------------------------------------------------ rencontre de deux talus
// Plan z = a·x + b·y + c d'un triangle (null s'il est vertical ou dégénéré).
function planeOf(t) {
  const { a, b, c } = t, ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z, vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  if (!(Math.abs(nz) > 1e-9)) return null;
  return { a: -nx / nz, b: -ny / nz, c: a.z + (nx * a.x + ny * a.y) / nz };
}
// Polygone convexe poly découpé par le triangle t (Sutherland-Hodgman).
function clipByTri(poly, t) {
  let P = poly;
  const V = [t.a, t.b, t.c], sg = Math.sign((t.b.x - t.a.x) * (t.c.y - t.a.y) - (t.b.y - t.a.y) * (t.c.x - t.a.x)) || 1;
  for (let k = 0; k < 3 && P.length; k++) {
    const A = V[k], B = V[(k + 1) % 3], f = (p) => sg * ((B.x - A.x) * (p.y - A.y) - (B.y - A.y) * (p.x - A.x));
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length], fp = f(p), fq = f(q);
      if (fp >= -1e-9) out.push(p);
      if ((fp >= -1e-9) !== (fq >= -1e-9)) { const u = fp / (fp - fq); out.push({ x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u }); }
    }
    P = out;
  }
  return P;
}
// Ligne de rencontre des talus de deux axes différents de même nature (remblai / remblai : arête de l'enveloppe
// supérieure ; déblai / déblai : arête de l'enveloppe inférieure) : pour chaque paire de triangles qui se recouvrent en
// plan, la droite où leurs plans ont la même cote, limitée à la partie commune ; on ne garde que les parties apparentes
// vis-à-vis des autres axes (plates-formes, tabliers, autres talus). Un remblai posé sur un déblai masque celui-ci : la
// limite est alors l'entrée en terre du remblai, déjà dessinée.
function meetLines(R) {
  const out = [], seen = new Set(), N = R.tris.length, planes = new Map();
  const pl = (i) => { if (!planes.has(i)) planes.set(i, planeOf(R.tris[i])); return planes.get(i); };
  for (const list of R.grid.values()) {
    for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
      const i = Math.min(list[x], list[y]), j = Math.max(list[x], list[y]), t1 = R.tris[i], t2 = R.tris[j];
      if (t1.cid === t2.cid || t1.cid < 0 || t2.cid < 0 || t1.kind === 'P' || t1.kind !== t2.kind) continue;
      if (Math.max(t1.a.x, t1.b.x, t1.c.x) < Math.min(t2.a.x, t2.b.x, t2.c.x) || Math.max(t2.a.x, t2.b.x, t2.c.x) < Math.min(t1.a.x, t1.b.x, t1.c.x)
        || Math.max(t1.a.y, t1.b.y, t1.c.y) < Math.min(t2.a.y, t2.b.y, t2.c.y) || Math.max(t2.a.y, t2.b.y, t2.c.y) < Math.min(t1.a.y, t1.b.y, t1.c.y)) continue;
      const key = i * N + j;
      if (seen.has(key)) continue;
      seen.add(key);
      const p1 = pl(i), p2 = pl(j);
      if (!p1 || !p2) continue;
      const A = p1.a - p2.a, B = p1.b - p2.b, C = p1.c - p2.c;
      if (Math.hypot(A, B) < 1e-6) continue; // talus parallèles
      const poly = clipByTri([t1.a, t1.b, t1.c], t2);
      if (poly.length < 3) continue;
      const d = (p) => A * p.x + B * p.y + C, pts = [];
      for (let k = 0; k < poly.length; k++) {
        const p = poly[k], q = poly[(k + 1) % poly.length], dp = d(p), dq = d(q);
        if (dp === 0) pts.push(p);
        else if (dp * dq < 0) { const u = dp / (dp - dq); pts.push({ x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u }); }
      }
      if (pts.length < 2) continue;
      let a = pts[0], b = pts[1];
      for (const p of pts) for (const q of pts) if (Math.hypot(q.x - p.x, q.y - p.y) > Math.hypot(b.x - a.x, b.y - a.y)) { a = p; b = q; }
      if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-3) continue;
      const Z = (p) => ({ x: p.x, y: p.y, z: p1.a * p.x + p1.b * p.y + p1.c });
      out.push(...clipSeg(R, Z(a), Z(b), t1.kind, t1.cid, t2.cid));
    }
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ dessin
// corridors : [{ id, rows: [{ L, R }], closed, plat (contour de plate-forme, facultatif) }] ; masks : polygones [{ x, y }] (tabliers) ; opts : { esp }.
// Rend { prims, n: { barbules, meet } } : hachures TALUS (rôle R ou D), bords TALUS (rôle crete), rencontre de deux
// talus (TALUS, rôle inter) et EET (calque EET).
export function talusPrims(corridors, masks = [], opts = {}) {
  const esp = Math.max(0.5, +opts.esp || 2), R = new Regions(10);
  corridors.forEach((K, cid) => {
    const rows = K.rows, n = rows.length, m = K.closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const A = rows[i], B = rows[(i + 1) % n];
      if (A.L && A.R && B.L && B.R) R.quad(A.L.edge, A.R.edge, B.R.edge, B.L.edge, 'P', cid);
      for (const sd of ['L', 'R']) { const a = A[sd], b = B[sd]; if (a?.e && b?.e && a.br === b.br) R.quad(a.c, a.e, b.e, b.c, a.br, cid); }
    }
    // plate-forme donnée par son contour (anneau) : triangles en éventail depuis le premier sommet
    if (K.plat?.length > 2) for (let i = 1; i + 1 < K.plat.length; i++) R.add(K.plat[0], K.plat[i], K.plat[i + 1], 'P', cid);
  });
  const flat = (p) => ({ x: p.x, y: p.y, z: 0 });
  for (const poly of masks) if (poly?.length > 2) for (let i = 1; i + 1 < poly.length; i++) R.add(flat(poly[0]), flat(poly[i]), flat(poly[i + 1]), 'P', -1);

  const barb = { R: [], D: [] }, bord = [], eet = [];
  let nb = 0;
  corridors.forEach((K, cid) => {
    const rows = K.rows, n = rows.length, m = K.closed ? n : n - 1;
    for (const sd of ['L', 'R']) {
      let k = 0, acc = 0, next = 0, run = null;
      for (let i = 0; i < m; i++) {
        const a = rows[i][sd], b = rows[(i + 1) % n][sd];
        if (!(a?.e && b?.e)) { run = null; continue; }
        // bord côté talus et entrée en terre (découpés), même au changement remblai / déblai
        for (const [p, q, br] of [[a.c, b.c, a.br], [a.e, b.e, a.br]]) for (const s of clipSeg(R, p, q, br, cid)) (p === a.c ? bord : eet).push(s);
        if (a.br !== b.br) { run = null; continue; }
        if (run !== a.br) { run = a.br; k = 0; acc = 0; next = 0; }
        const top0 = a.br === 'R' ? a.c : a.e, bot0 = a.br === 'R' ? a.e : a.c, top1 = a.br === 'R' ? b.c : b.e, bot1 = a.br === 'R' ? b.e : b.c;
        const d = Math.hypot(top1.x - top0.x, top1.y - top0.y);
        while (next <= acc + d + 1e-9) {
          const t = d > 1e-9 ? (next - acc) / d : 0, top = lerp(top0, top1, t), bot = lerp(bot0, bot1, t);
          const end = k % 4 === 0 ? bot : lerp(top, bot, 0.34);
          for (const s of clipSeg(R, top, end, a.br, cid)) { barb[a.br].push(s); nb++; }
          k++; next += esp;
        }
        acc += d;
      }
    }
  });
  const meet = meetLines(R);
  const strip = (l) => l.map(([p, q]) => [{ x: p.x, y: p.y }, { x: q.x, y: q.y }]);
  const prims = [];
  if (meet.length) prims.push({ k: 'hatch', L: 'TALUS', role: 'inter', lines: strip(meet), wm: 0.06 });
  if (barb.R.length) prims.push({ k: 'hatch', L: 'TALUS', role: 'R', lines: strip(barb.R), wm: 0.04 });
  if (barb.D.length) prims.push({ k: 'hatch', L: 'TALUS', role: 'D', lines: strip(barb.D), wm: 0.04 });
  if (bord.length) prims.push({ k: 'hatch', L: 'TALUS', role: 'crete', lines: strip(bord), wm: 0.06 });
  if (eet.length) prims.push({ k: 'hatch', L: 'EET', lines: strip(eet), wm: 0.06 });
  return { prims, n: { barbules: nb, meet: meet.length } };
}
