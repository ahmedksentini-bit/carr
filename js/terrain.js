// terrain.js — terrain naturel (TN) du projet : sources de points (calque 3D du DXF, SRTM téléchargé, semis XYZ ou
// grille ASCII), construction du MNT (TIN de Delaunay, tin.js) et dessin (courbes de niveau, arêtes, points).
//  • DXF : sommets 3D d'un calque choisi (POINT, LINE, polylignes 3D ou à élévation, 3DFACE, maillages), ou cotes
//    écrites (TEXT numériques) ; on vérifie qu'il existe bien des cotes non nulles.
//  • SRTM : tuiles « terrain » Terrarium (AWS Open Data, Mapzen/Tilezen : SRTM 1" et autres sources, ~30 m),
//    z = (R × 256 + G + B / 256) − 32768, reprojetées dans le système du projet. Précision verticale de l'ordre de
//    quelques mètres : avant-projet seulement.
//  • Fichiers : semis « X Y Z » (txt, csv, xyz ; séparateurs espace, tabulation, ; ou ,) et grille ESRI ASCII (.asc).
import * as G from './geom.js';
import { buildTIN, tinContours, tinEdges } from './tin.js';
import { fmt } from './common.js';

export const SRTM_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
export const SRTM_ATTR = 'Terrain : Terrarium tiles (AWS Open Data / Mapzen) — SRTM, GMTED, ETOPO1 ; ≈ 30 m';

// --------------------------------------------------------------------------- DXF
// Calques du DXF portant des sommets 3D : [{ name, n, nz, nText, zmin, zmax }], les plus riches d'abord.
export function dxfTerrainLayers(geo) {
  if (!geo?.tnLayers) return [];
  return [...geo.tnLayers.entries()].map(([name, s]) => ({ name, ...s })).filter((s) => s.nz || s.nText).sort((a, b) => (b.nz + b.nText) - (a.nz + a.nText));
}
// Points TN d'un calque : sommets à cote non nulle (et cotes écrites si texts = true).
export function pointsFromDxf(geo, layer, { texts = false } = {}) {
  const out = [];
  for (const v of geo?.verts3 || []) {
    if (v.layer !== layer) continue;
    if (v.text) { if (texts) out.push({ x: v.x, y: v.y, z: v.z }); continue; }
    if (v.z !== 0 && Number.isFinite(v.z)) out.push({ x: v.x, y: v.y, z: v.z });
  }
  return out;
}

// --------------------------------------------------------------------------- Fichiers
// Semis « X Y Z » (une ligne par point ; en-tête éventuel ignoré) ou grille ESRI ASCII.
export function parsePointsFile(text) {
  const head = text.slice(0, 400).toLowerCase();
  if (/^\s*ncols\s+\d+/i.test(head)) return parseASC(text);
  const out = [];
  // Séparateur : point-virgule, tabulation, virgule (sans espaces) ou espaces ; la virgule décimale est admise
  // avec les autres séparateurs.
  const sample = text.split(/\r?\n/).slice(0, 20).join('\n');
  const sep = sample.includes(';') ? /;/ : sample.includes('\t') ? /\t/ : /,/.test(sample) && !/[ ]/.test(sample.trim()) ? /,/ : /\s+/;
  for (const line of text.split(/\r?\n/)) {
    const f = line.trim().split(sep).map((v) => v.trim()).filter(Boolean);
    if (f.length < 3) continue;
    // colonnes numériques : X Y Z (ou N X Y Z si 4 colonnes et la première est un entier)
    const nums = f.map((v) => parseFloat(sep.source === ',' ? v : v.replace(',', '.')));
    if (nums.slice(0, 3).some((v) => !Number.isFinite(v))) continue;
    const [x, y, z] = f.length >= 4 && Number.isFinite(nums[3]) && /^\d+$/.test(f[0]) ? nums.slice(1, 4) : nums;
    out.push({ x, y, z });
  }
  return out;
}
function parseASC(text) {
  const lines = text.split(/\r?\n/), hdr = {};
  let i = 0;
  for (; i < lines.length; i++) {
    const m = lines[i].trim().match(/^([a-z_]+)\s+(\S+)/i);
    if (!m || !/^(ncols|nrows|xllcorner|yllcorner|xllcenter|yllcenter|cellsize|nodata_value)$/i.test(m[1])) break;
    hdr[m[1].toLowerCase()] = parseFloat(m[2]);
  }
  const nc = hdr.ncols, nr = hdr.nrows, cs = hdr.cellsize, nd = hdr.nodata_value ?? -9999;
  const x0 = (hdr.xllcorner ?? hdr.xllcenter - cs / 2) + cs / 2, y0 = (hdr.yllcorner ?? hdr.yllcenter - cs / 2) + cs / 2;
  const vals = lines.slice(i).join(' ').trim().split(/\s+/).map(Number);
  const out = [];
  for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
    const z = vals[r * nc + c];
    if (!Number.isFinite(z) || z === nd) continue;
    out.push({ x: x0 + c * cs, y: y0 + (nr - 1 - r) * cs, z });
  }
  return out;
}

// --------------------------------------------------------------------------- SRTM (tuiles Terrarium)
const lon2t = (lon, n) => ((lon + 180) / 360) * n;
const lat2t = (lat, n) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n; };
const t2lon = (x, n) => (x / n) * 360 - 180;
const t2lat = (y, n) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;

async function loadTile(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`tuile ${res.status}`);
  const bmp = await createImageBitmap(await res.blob());
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0);
  return { w: bmp.width, h: bmp.height, d: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
}

// Points TN SRTM dans l'emprise bbox (coordonnées projet) élargie de margin : { pts, zoom, res, tiles }.
// crs : { toLL(x, y), fromLL(lon, lat) }. zoom 12 ≈ 30 m par pixel aux latitudes moyennes (données SRTM 1").
export async function fetchSRTM(crs, bbox, { zoom = 12, margin = 0, maxPts = 8000, onProgress } = {}) {
  const b = { x0: bbox.x0 - margin, y0: bbox.y0 - margin, x1: bbox.x1 + margin, y1: bbox.y1 + margin };
  const corners = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(([x, y]) => crs.toLL(x, y));
  const lon0 = Math.min(...corners.map((c) => c.lon)), lon1 = Math.max(...corners.map((c) => c.lon));
  const lat0 = Math.min(...corners.map((c) => c.lat)), lat1 = Math.max(...corners.map((c) => c.lat));
  const n = 2 ** zoom;
  const tx0 = Math.floor(lon2t(lon0, n)), tx1 = Math.floor(lon2t(lon1, n)), ty0 = Math.floor(lat2t(lat1, n)), ty1 = Math.floor(lat2t(lat0, n));
  const nTiles = (tx1 - tx0 + 1) * (ty1 - ty0 + 1);
  if (nTiles > 36) throw new Error(`emprise trop grande (${nTiles} tuiles) : réduisez la marge ou le niveau de zoom`);
  const pts = [];
  let done = 0;
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const tile = await loadTile(SRTM_URL(zoom, tx, ty));
    const { w, h, d } = tile;
    for (let j = 0; j < h; j++) {
      const lat = t2lat(ty + (j + 0.5) / h, n);
      if (lat < lat0 || lat > lat1) continue;
      for (let i = 0; i < w; i++) {
        const lon = t2lon(tx + (i + 0.5) / w, n);
        if (lon < lon0 || lon > lon1) continue;
        const k = 4 * (j * w + i), z = d[k] * 256 + d[k + 1] + d[k + 2] / 256 - 32768;
        if (z < -500 || z > 9000) continue;
        const p = crs.fromLL(lon, lat);
        if (p.x < b.x0 || p.x > b.x1 || p.y < b.y0 || p.y > b.y1) continue;
        pts.push({ x: p.x, y: p.y, z: Math.round(z * 100) / 100 });
      }
    }
    done++; onProgress?.(done, nTiles);
  }
  // Résolution approximative (m / pixel) à la latitude moyenne.
  const res = (156543.03 * Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180)) / n;
  // Sous-échantillonnage régulier si le semis est trop dense.
  let out = pts;
  if (pts.length > maxPts) { const step = Math.ceil(pts.length / maxPts); out = pts.filter((_, i) => i % step === 0); }
  return { pts: out, zoom, res, tiles: nTiles, raw: pts.length };
}

// --------------------------------------------------------------------------- MNT et dessin
// Construit le TIN et ses primitives de dessin (calque MNT). opts : { step (équidistance, 0 = aucune), edges, points, textH }.
export function buildTerrain(pts, opts = {}) {
  const tin = buildTIN(pts);
  if (!tin) return null;
  const TH = +opts.textH || 0.8, prims = [];
  const P = (o) => prims.push(o);
  if (opts.edges) for (const [p, q] of tinEdges(tin)) P({ k: 'path', L: 'MNT', segs: [G.L(p, q)], role: 'tin' });
  if (opts.points && tin.n <= 5000) for (let i = 0; i < tin.n; i++) P({ k: 'cross', L: 'MNT', p: { x: tin.X[i] + tin.cx, y: tin.Y[i] + tin.cy }, size: 0.3 });
  const step = +opts.step || 0;
  let contours = [];
  if (step > 0) {
    contours = tinContours(tin, step);
    const major = (z) => Math.abs(z / (5 * step) - Math.round(z / (5 * step))) < 1e-6;
    for (const c of contours) {
      for (const line of c.lines) {
        if (line.length < 2) continue;
        const segs = line.slice(1).map((p, i) => G.L(line[i], p));
        P({ k: 'path', L: 'MNT', segs, role: major(c.z) ? 'major' : 'minor', wm: major(c.z) ? 0.08 : 0 });
        // Étiquette au milieu des courbes maîtresses assez longues.
        if (major(c.z) && G.pathLen(segs) > 25 * TH) {
          const mid = G.pathPointAt(segs, G.pathLen(segs) / 2), m2 = G.pathPointAt(segs, G.pathLen(segs) / 2 + 1);
          const a = Math.atan2(m2.y - mid.y, m2.x - mid.x);
          P({ k: 'text', L: 'MNT', p: mid, s: fmt(c.z, step < 1 ? 1 : 0), rot: a > Math.PI / 2 || a < -Math.PI / 2 ? a + Math.PI : a, align: 'center', h: TH * 0.8 });
        }
      }
    }
  }
  return { tin, prims, contours: contours.length, step };
}
