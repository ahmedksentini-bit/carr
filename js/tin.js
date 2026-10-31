// tin.js — modèle numérique de terrain par triangulation de Delaunay (TIN) : construction incrémentale
// (localisation par marche, retournements d'arêtes de Lawson), interpolation linéaire de la cote en un point,
// courbes de niveau par « marching triangles », export des triangles.
// Les coordonnées sont centrées sur l'emprise des points pour préserver la précision (UTM : x ≈ 6·10⁵ m).
// Structure : V[3t + i] sommets du triangle t (sens trigonométrique), N[3t + i] voisin opposé au sommet i
// (c'est-à-dire de l'autre côté de l'arête (V[3t+(i+1)%3], V[3t+(i+2)%3])), −1 sur le bord.

const EPS = 1e-9;

function orient(ax, ay, bx, by, cx, cy) { return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); }

// q strictement à l'intérieur du cercle circonscrit à (a, b, c) donné dans le sens trigonométrique.
function inCircle(ax, ay, bx, by, cx, cy, qx, qy) {
  const adx = ax - qx, ady = ay - qy, bdx = bx - qx, bdy = by - qy, cdx = cx - qx, cdy = cy - qy;
  const ad = adx * adx + ady * ady, bd = bdx * bdx + bdy * bdy, cd = cdx * cdx + cdy * cdy;
  return adx * (bdy * cd - bd * cdy) - ady * (bdx * cd - bd * cdx) + ad * (bdx * cdy - bdy * cdx) > 1e-9 * (ad + bd + cd);
}

// pts : [{ x, y, z }]. Retourne un TIN { n, X, Y, Z, V, N, nt, bbox, cx, cy } (coordonnées locales X, Y + cx, cy).
export function buildTIN(ptsIn) {
  // Dédoublonnage (1 mm) et centrage.
  const map = new Map(), pts = [];
  for (const p of ptsIn) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) continue;
    const k = `${Math.round(p.x * 1000)}|${Math.round(p.y * 1000)}`;
    if (map.has(k)) continue;
    map.set(k, 1); pts.push(p);
  }
  const n = pts.length;
  if (n < 3) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, size = Math.max(x1 - x0, y1 - y0, 1);
  // Tri spatial (grille de cellules parcourue en serpentin) pour une marche courte entre insertions successives.
  const g = Math.max(1, Math.ceil(Math.sqrt(n / 2)));
  const key = (p) => { const i = Math.min(g - 1, Math.floor(((p.x - x0) / size) * g)), j = Math.min(g - 1, Math.floor(((p.y - y0) / size) * g)); return i * g + (i % 2 ? g - 1 - j : j); };
  pts.sort((a, b) => key(a) - key(b));
  // Léger bruit (1e-6 m) : évite les cas exactement dégénérés (points alignés sur une arête, grilles régulières).
  const X = new Float64Array(n + 3), Y = new Float64Array(n + 3), Z = new Float64Array(n + 3);
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
  for (let i = 0; i < n; i++) { X[i] = pts[i].x - cx + rnd() * 2e-6; Y[i] = pts[i].y - cy + rnd() * 2e-6; Z[i] = pts[i].z; }
  // Super-triangle (sommets n, n+1, n+2), décalé pour ne pas s'aligner avec le semis.
  const R = size * 40;
  X[n] = -R * 1.731 + 0.3137; Y[n] = -R + 0.1713; X[n + 1] = R * 1.731 - 0.2719; Y[n + 1] = -R + 0.0917; X[n + 2] = 0.1123; Y[n + 2] = 2 * R + 0.0731;
  const cap = 2 * (n + 3) + 10;
  const V = new Int32Array(cap * 3), N = new Int32Array(cap * 3).fill(-1);
  let nt = 1;
  V[0] = n; V[1] = n + 1; V[2] = n + 2;

  const setNb = (t, from, to) => { const b = 3 * t; if (N[b] === from) N[b] = to; else if (N[b + 1] === from) N[b + 1] = to; else if (N[b + 2] === from) N[b + 2] = to; };

  // Localisation par marche depuis le triangle t0.
  const locate = (px, py, t0) => {
    let t = t0 < 0 || t0 >= nt ? nt - 1 : t0;
    for (let it = 0; it < 4 * nt + 10; it++) {
      const b = 3 * t, a = V[b], c = V[b + 1], d = V[b + 2];
      // arête opposée au sommet i : (V[i+1], V[i+2]) ; le point est à l'extérieur si orient < 0
      const o0 = orient(X[c], Y[c], X[d], Y[d], px, py);
      if (o0 < -EPS) { if (N[b] < 0) return -1; t = N[b]; continue; }
      const o1 = orient(X[d], Y[d], X[a], Y[a], px, py);
      if (o1 < -EPS) { if (N[b + 1] < 0) return -1; t = N[b + 1]; continue; }
      const o2 = orient(X[a], Y[a], X[c], Y[c], px, py);
      if (o2 < -EPS) { if (N[b + 2] < 0) return -1; t = N[b + 2]; continue; }
      return t;
    }
    return -1;
  };

  // Retournement de l'arête opposée au sommet i de t si le sommet opposé du voisin viole Delaunay.
  const legalize = (t, i) => {
    const stack = [t, i];
    while (stack.length) {
      const ii = stack.pop(), tt = stack.pop(), b = 3 * tt, o = N[b + ii];
      if (o < 0) continue;
      const p = V[b + ii], u = V[b + ((ii + 1) % 3)], w = V[b + ((ii + 2) % 3)];
      const ob = 3 * o;
      let j = 0; if (N[ob + 1] === tt) j = 1; else if (N[ob + 2] === tt) j = 2;
      const q = V[ob + j];
      if (!inCircle(X[p], Y[p], X[u], Y[u], X[w], Y[w], X[q], Y[q])) continue;
      // Quadrilatère (p, u, q, w) : le retournement n'est possible que s'il est convexe.
      if (orient(X[p], Y[p], X[u], Y[u], X[q], Y[q]) <= EPS || orient(X[p], Y[p], X[q], Y[q], X[w], Y[w]) <= EPS) continue;
      const tu = N[b + ((ii + 1) % 3)], tw = N[b + ((ii + 2) % 3)];
      const ow = N[ob + ((j + 1) % 3)], ou = N[ob + ((j + 2) % 3)];
      V[b] = p; V[b + 1] = u; V[b + 2] = q; N[b] = ow; N[b + 1] = o; N[b + 2] = tw;
      V[ob] = p; V[ob + 1] = q; V[ob + 2] = w; N[ob] = ou; N[ob + 1] = tu; N[ob + 2] = tt;
      if (ow >= 0) setNb(ow, o, tt);
      if (tu >= 0) setNb(tu, tt, o);
      stack.push(tt, 0, o, 0);
    }
  };

  let last = 0;
  for (let i = 0; i < n; i++) {
    let t = locate(X[i], Y[i], last);
    if (t < 0) { // marche en échec (dégénérescence) : recherche exhaustive
      for (let k = 0; k < nt && t < 0; k++) {
        const b = 3 * k, a = V[b], c = V[b + 1], d = V[b + 2];
        if (orient(X[c], Y[c], X[d], Y[d], X[i], Y[i]) >= -EPS && orient(X[d], Y[d], X[a], Y[a], X[i], Y[i]) >= -EPS && orient(X[a], Y[a], X[c], Y[c], X[i], Y[i]) >= -EPS) t = k;
      }
      if (t < 0) continue;
    }
    const b = 3 * t, a = V[b], c = V[b + 1], d = V[b + 2], na = N[b], nb = N[b + 1], nc = N[b + 2];
    const t1 = nt++, t2 = nt++;
    // T0 = (p, c, d) ; T1 = (p, d, a) ; T2 = (p, a, c)
    V[b] = i; V[b + 1] = c; V[b + 2] = d; N[b] = na; N[b + 1] = t1; N[b + 2] = t2;
    const b1 = 3 * t1; V[b1] = i; V[b1 + 1] = d; V[b1 + 2] = a; N[b1] = nb; N[b1 + 1] = t2; N[b1 + 2] = t;
    const b2 = 3 * t2; V[b2] = i; V[b2 + 1] = a; V[b2 + 2] = c; N[b2] = nc; N[b2 + 1] = t; N[b2 + 2] = t1;
    if (nb >= 0) setNb(nb, t, t1);
    if (nc >= 0) setNb(nc, t, t2);
    legalize(t, 0); legalize(t1, 0); legalize(t2, 0);
    last = t;
  }
  // Retrait du super-triangle : triangles finaux et voisinage recalculé.
  const keep = new Int32Array(nt).fill(-1);
  let m = 0;
  for (let t = 0; t < nt; t++) { const b = 3 * t; if (V[b] < n && V[b + 1] < n && V[b + 2] < n) keep[t] = m++; }
  const V2 = new Int32Array(m * 3), N2 = new Int32Array(m * 3);
  for (let t = 0; t < nt; t++) {
    if (keep[t] < 0) continue;
    const b = 3 * t, b2 = 3 * keep[t];
    for (let i = 0; i < 3; i++) { V2[b2 + i] = V[b + i]; N2[b2 + i] = N[b + i] >= 0 ? keep[N[b + i]] : -1; }
  }
  let zmin = Infinity, zmax = -Infinity;
  for (let i = 0; i < n; i++) { if (Z[i] < zmin) zmin = Z[i]; if (Z[i] > zmax) zmax = Z[i]; }
  return { n, X: X.subarray(0, n), Y: Y.subarray(0, n), Z: Z.subarray(0, n), V: V2, N: N2, nt: m, cx, cy, bbox: { x0, y0, x1, y1 }, zmin, zmax, last: 0 };
}

// Triangle contenant (x, y) en coordonnées monde, ou −1 (hors du TIN). Marche depuis tin.last.
export function tinLocate(tin, x, y) {
  if (!tin || !tin.nt) return -1;
  const px = x - tin.cx, py = y - tin.cy, { X, Y, V, N, nt } = tin;
  const walk = (start) => {
    let t = start;
    for (let it = 0; it < nt + 5; it++) {
      const b = 3 * t, a = V[b], c = V[b + 1], d = V[b + 2];
      if (orient(X[c], Y[c], X[d], Y[d], px, py) < -EPS) { if (N[b] < 0) return -1; t = N[b]; continue; }
      if (orient(X[d], Y[d], X[a], Y[a], px, py) < -EPS) { if (N[b + 1] < 0) return -1; t = N[b + 1]; continue; }
      if (orient(X[a], Y[a], X[c], Y[c], px, py) < -EPS) { if (N[b + 2] < 0) return -1; t = N[b + 2]; continue; }
      return t;
    }
    return -1;
  };
  let t = walk(tin.last >= 0 && tin.last < nt ? tin.last : 0);
  if (t < 0 && tin.last !== 0) t = walk(0); // le point peut être hors de l'enveloppe convexe : seconde marche
  if (t >= 0) tin.last = t;
  return t;
}

// Cote interpolée linéairement sur le triangle contenant (x, y) ; null hors du TIN.
export function tinZ(tin, x, y) {
  const t = tinLocate(tin, x, y);
  if (t < 0) return null;
  const b = 3 * t, a = tin.V[b], c = tin.V[b + 1], d = tin.V[b + 2], { X, Y, Z } = tin;
  const px = x - tin.cx, py = y - tin.cy;
  const det = orient(X[a], Y[a], X[c], Y[c], X[d], Y[d]);
  if (Math.abs(det) < 1e-12) return (Z[a] + Z[c] + Z[d]) / 3;
  const wa = orient(X[c], Y[c], X[d], Y[d], px, py) / det, wc = orient(X[d], Y[d], X[a], Y[a], px, py) / det;
  return wa * Z[a] + wc * Z[c] + (1 - wa - wc) * Z[d];
}

// Triangles en coordonnées monde : [[{x,y,z},{x,y,z},{x,y,z}], ...]
export function tinTriangles(tin) {
  const out = [];
  for (let t = 0; t < tin.nt; t++) {
    const b = 3 * t, tri = [];
    for (let i = 0; i < 3; i++) { const v = tin.V[b + i]; tri.push({ x: tin.X[v] + tin.cx, y: tin.Y[v] + tin.cy, z: tin.Z[v] }); }
    out.push(tri);
  }
  return out;
}

// Arêtes uniques en coordonnées monde : [[p, q], ...]
export function tinEdges(tin) {
  const out = [];
  for (let t = 0; t < tin.nt; t++) {
    const b = 3 * t;
    for (let i = 0; i < 3; i++) {
      const u = tin.V[b + ((i + 1) % 3)], w = tin.V[b + ((i + 2) % 3)], o = tin.N[b + i];
      if (o >= 0 && o < t) continue; // arête déjà émise par le voisin
      out.push([{ x: tin.X[u] + tin.cx, y: tin.Y[u] + tin.cy }, { x: tin.X[w] + tin.cx, y: tin.Y[w] + tin.cy }]);
    }
  }
  return out;
}

// Courbes de niveau : [{ z, lines: [[{x,y},...], ...] }] pour les niveaux multiples de `step` (maxLevels : garde-fou).
export function tinContours(tin, step, maxLevels = 400) {
  if (!tin || !(step > 0)) return [];
  const k0 = Math.ceil(tin.zmin / step), k1 = Math.floor(tin.zmax / step);
  if (k1 - k0 + 1 > maxLevels) return [];
  const { X, Y, Z, V, nt, cx, cy } = tin, out = [];
  for (let k = k0; k <= k1; k++) {
    const z = k * step, segs = [];
    for (let t = 0; t < nt; t++) {
      const b = 3 * t, ids = [V[b], V[b + 1], V[b + 2]], pts = [];
      for (let i = 0; i < 3; i++) {
        const u = ids[i], w = ids[(i + 1) % 3], zu = Z[u], zw = Z[w];
        if ((zu < z && zw >= z) || (zw < z && zu >= z)) {
          const f = (z - zu) / (zw - zu);
          pts.push({ x: X[u] + (X[w] - X[u]) * f + cx, y: Y[u] + (Y[w] - Y[u]) * f + cy });
        }
      }
      if (pts.length === 2) segs.push(pts);
    }
    if (segs.length) out.push({ z, lines: joinSegments(segs) });
  }
  return out;
}

// Chaînage de segments en polylignes (extrémités confondues à 1 mm près).
function joinSegments(segs) {
  const key = (p) => `${Math.round(p.x * 1000)}|${Math.round(p.y * 1000)}`;
  const ends = new Map(); // clé → liste d'indices de segments
  segs.forEach((s, i) => { for (const p of s) { const k = key(p); if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); } });
  const used = new Uint8Array(segs.length), lines = [];
  const take = (k, exclude) => { const l = ends.get(k); if (!l) return -1; for (const i of l) if (!used[i] && i !== exclude) return i; return -1; };
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const line = [segs[i][0], segs[i][1]];
    for (const dir of [1, -1]) {
      for (;;) {
        const end = dir > 0 ? line[line.length - 1] : line[0];
        const j = take(key(end), -1);
        if (j < 0) break;
        used[j] = 1;
        const s = segs[j], nxt = key(s[0]) === key(end) ? s[1] : s[0];
        if (dir > 0) line.push(nxt); else line.unshift(nxt);
      }
    }
    lines.push(line);
  }
  return lines;
}
