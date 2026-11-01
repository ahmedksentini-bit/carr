// hydro/dem.js — grille MNT régulière pour l'hydrologie (délimitation des bassins versants).
// Deux sources :
//  • SRTM (tuiles Terrarium, ≈ 30 m au zoom 12) sur une emprise élargie autour des axes : les bassins versants
//    débordent largement l'emprise du projet ; la grille est construite dans le système de coordonnées du projet,
//    chaque centre de cellule étant converti en lon/lat et lu par interpolation bilinéaire dans la mosaïque de tuiles ;
//  • MNT du projet (TIN de l'onglet Terrain : semis DXF, fichier de points) échantillonné aux centres des cellules.
// Format (attendu par hydro/watershed.js) : { nx, ny, x0, y0, cell, z: Float32Array (ligne 0 = nord), nodata: NaN },
// (x0, y0) coin nord-ouest, centre de la cellule (i, j) = (x0 + (i + 0,5)·cell, y0 − (j + 0,5)·cell).
import { SRTM_URL } from '../terrain.js';
import { tinZ } from '../tin.js';

const lon2t = (lon, n) => ((lon + 180) / 360) * n;
const lat2t = (lat, n) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n; };

async function loadTile(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`tuile ${res.status}`);
  const bmp = await createImageBitmap(await res.blob());
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data, w = bmp.width, h = bmp.height, z = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) { const v = d[4 * k] * 256 + d[4 * k + 1] + d[4 * k + 2] / 256 - 32768; z[k] = v < -500 || v > 9000 ? NaN : v; }
  return { w, h, z };
}

const emptyGrid = (bb, cell) => {
  const nx = Math.max(2, Math.ceil((bb.x1 - bb.x0) / cell)), ny = Math.max(2, Math.ceil((bb.y1 - bb.y0) / cell));
  return { nx, ny, x0: bb.x0, y0: bb.y0 + ny * cell, cell, z: new Float32Array(nx * ny).fill(NaN), nodata: NaN };
};

// Grille SRTM : bbox (projet) élargie de margin, pas cell (m). crs : { toLL(x, y) → { lon, lat } }.
export async function demFromSRTM(crs, bbox, { margin = 3000, cell = 30, zoom = 12, maxTiles = 120, maxCells = 4e6, onProgress } = {}) {
  const bb = { x0: bbox.x0 - margin, y0: bbox.y0 - margin, x1: bbox.x1 + margin, y1: bbox.y1 + margin };
  let c = cell;
  while (((bb.x1 - bb.x0) / c) * ((bb.y1 - bb.y0) / c) > maxCells) c *= 1.25;
  const corners = [[bb.x0, bb.y0], [bb.x1, bb.y0], [bb.x1, bb.y1], [bb.x0, bb.y1]].map(([x, y]) => crs.toLL(x, y));
  let z = zoom, n, tx0, tx1, ty0, ty1;
  for (; ; z--) {
    n = 2 ** z;
    tx0 = Math.floor(lon2t(Math.min(...corners.map((q) => q.lon)), n)); tx1 = Math.floor(lon2t(Math.max(...corners.map((q) => q.lon)), n));
    ty0 = Math.floor(lat2t(Math.max(...corners.map((q) => q.lat)), n)); ty1 = Math.floor(lat2t(Math.min(...corners.map((q) => q.lat)), n));
    if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) <= maxTiles || z <= 8) break;
  }
  const tiles = new Map(), nT = (tx1 - tx0 + 1) * (ty1 - ty0 + 1);
  let done = 0;
  const jobs = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) jobs.push([tx, ty]);
  // téléchargement par lots de 6
  for (let i = 0; i < jobs.length; i += 6) {
    await Promise.all(jobs.slice(i, i + 6).map(async ([tx, ty]) => { try { tiles.set(`${tx}/${ty}`, await loadTile(SRTM_URL(z, tx, ty))); } catch (e) { tiles.set(`${tx}/${ty}`, null); } done++; onProgress?.(done, nT, 'tuiles'); }));
  }
  const sample = (lon, lat) => {
    const fx = lon2t(lon, n), fy = lat2t(lat, n), tx = Math.floor(fx), ty = Math.floor(fy), T = tiles.get(`${tx}/${ty}`);
    if (!T) return NaN;
    const px = (fx - tx) * T.w - 0.5, py = (fy - ty) * T.h - 0.5;
    const i0 = Math.max(0, Math.min(T.w - 2, Math.floor(px))), j0 = Math.max(0, Math.min(T.h - 2, Math.floor(py))), u = Math.max(0, Math.min(1, px - i0)), v = Math.max(0, Math.min(1, py - j0));
    const a = T.z[j0 * T.w + i0], b = T.z[j0 * T.w + i0 + 1], cc = T.z[(j0 + 1) * T.w + i0], d = T.z[(j0 + 1) * T.w + i0 + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (cc * (1 - u) + d * u) * v;
  };
  const G = emptyGrid(bb, c);
  for (let j = 0; j < G.ny; j++) {
    for (let i = 0; i < G.nx; i++) { const ll = crs.toLL(G.x0 + (i + 0.5) * c, G.y0 - (j + 0.5) * c); G.z[j * G.nx + i] = sample(ll.lon, ll.lat); }
    if (j % 50 === 0) { onProgress?.(j, G.ny, 'grille'); await new Promise((r) => setTimeout(r, 0)); }
  }
  G.source = `SRTM (Terrarium, zoom ${z}, ${nT} tuiles), cellule ${Math.round(c)} m`;
  G.bbox = bb; G.margin = margin;
  return G;
}

// Grille depuis le TIN du projet (bbox des points du TIN).
export function demFromTIN(tin, { cell = 10, maxCells = 4e6 } = {}) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let k = 0; k < tin.n; k++) { const x = tin.X[k] + tin.cx, y = tin.Y[k] + tin.cy; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  let c = cell;
  while (((x1 - x0) / c) * ((y1 - y0) / c) > maxCells) c *= 1.25;
  const G = emptyGrid({ x0, y0, x1, y1 }, c);
  for (let j = 0; j < G.ny; j++) for (let i = 0; i < G.nx; i++) { const z = tinZ(tin, G.x0 + (i + 0.5) * c, G.y0 - (j + 0.5) * c); G.z[j * G.nx + i] = z == null ? NaN : z; }
  G.source = `MNT du projet (TIN, ${tin.n} points), cellule ${Math.round(c * 10) / 10} m`;
  G.bbox = { x0, y0, x1, y1 }; G.margin = 0;
  return G;
}
