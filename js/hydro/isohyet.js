// isohyet.js — champ de pluie reconstruit à partir des isohyètes du bulletin FAO 54 (portage de
// BVTrace.Core/IsohyetField.cs ; invariants : BVTrace docs/context/fao54-cartes-isohyetes.md).
//
// Source : relevé manuel des figures 3 (Pan) et 4 (P10) du bulletin FAO 54 (data/fao54-pan.js, data/fao54-p10.js,
// copies des GeoJSON de BVTrace). La valeur en un point vient d'une interpolation entre les DEUX isohyètes
// encadrantes les plus proches, pondérée par la distance. Hors du faisceau — ou si une seule valeur est à portée —
// le champ refuse de répondre (motif) : jamais de valeur par défaut, jamais d'extrapolation.
// Ancres (bulletin p. 55-56, petit bassin par 14° N, 0°) : P10 ≈ 86 mm, Pan ≈ 500 mm ; le champ rend 85,2 et 513 mm.
// Les figures sont au ~1:20 000 000 : elles situent le bassin dans une bande d'isohyètes, pas au mm près.
import PAN from './data/fao54-pan.js';
import P10 from './data/fao54-p10.js';

function parse(gj) {
  const lines = [];
  for (const f of gj?.features || []) {
    const p = f.properties || {}, v = [p.valeur_mm, p.valeur, p.value, p.mm].find((x) => typeof x === 'number');
    if (v == null) continue; // sans valeur : ignorée, jamais devinée
    const g = f.geometry || {}, parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    const ps = parts.map((pt) => (pt || []).filter((q) => Number.isFinite(q?.[0]) && Number.isFinite(q?.[1]))).filter((q) => q.length);
    if (ps.length) lines.push({ v, parts: ps });
  }
  return { grandeur: gj?.grandeur || '', source: gj?.source || '', lines };
}
const FIELDS = { pan: parse(PAN), p10: parse(P10) };

function segNearest(ax, ay, bx, by, px, py) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 <= 1e-18 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  const cx = ax + t * dx, cy = ay + t * dy;
  return [Math.hypot(px - cx, py - cy), cx, cy];
}
function nearestOn(iso, lon, lat) {
  let best = [Infinity, lon, lat];
  for (const part of iso.parts) {
    if (part.length === 1) { const d = Math.hypot(part[0][0] - lon, part[0][1] - lat); if (d < best[0]) best = [d, part[0][0], part[0][1]]; }
    for (let i = 0; i + 1 < part.length; i++) { const r = segNearest(part[i][0], part[i][1], part[i + 1][0], part[i + 1][1], lon, lat); if (r[0] < best[0]) best = r; }
  }
  return best;
}

/**
 * Valeur (mm) du champ « pan » ou « p10 » au point (lon, lat, degrés).
 * @returns {{ ok:boolean, value?:number, low?:number, high?:number, reason?:string, source:string }}
 */
export function isohyetValueAt(kind, lon, lat) {
  const F = FIELDS[kind], source = F?.source || '';
  if (!F?.lines.length) return { ok: false, reason: 'Aucune isohyète chargée.', source };
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return { ok: false, reason: 'Position inconnue (projet non géoréférencé).', source };
  // distance du point à chaque valeur d'isohyète (tronçons de même valeur = une seule isohyète)
  const byV = new Map();
  for (const iso of F.lines) { const r = nearestOn(iso, lon, lat), prev = byV.get(iso.v); if (!prev || r[0] < prev[0]) byV.set(iso.v, r); }
  if (byV.size < 2) return { ok: false, reason: 'Une seule valeur d\'isohyète disponible — pas d\'encadrement.', source };
  const ord = [...byV.entries()].sort((a, b) => a[1][0] - b[1][0]);
  const n1 = ord[0], n2 = ord.slice(1).find((q) => Math.abs(q[0] - n1[0]) > 1e-9);
  if (!n2) return { ok: false, reason: 'Pas de seconde isohyète de valeur distincte.', source };
  const d1 = n1[1][0], d2 = n2[1][0], span = Math.hypot(n2[1][1] - n1[1][1], n2[1][2] - n1[1][2]), sum = d1 + d2;
  // ENCADREMENT : le point doit être ENTRE les deux courbes (d1 + d2 ≈ écart entre les points de contact)
  if (span > 1e-9 && sum > span * 1.25) return { ok: false, reason: 'Point hors du faisceau d\'isohyètes : il n\'est encadré par aucune paire de courbes (le bulletin ne dit rien au-delà de ses tracés).', source };
  const low = Math.min(n1[0], n2[0]), high = Math.max(n1[0], n2[0]);
  if (sum <= 1e-12) return { ok: true, value: n1[0], low, high, source };
  return { ok: true, value: n1[0] + ((n2[0] - n1[0]) * d1) / sum, low, high, source };
}
