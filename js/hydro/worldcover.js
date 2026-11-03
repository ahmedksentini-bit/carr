// hydro/worldcover.js — couverture végétale d'un bassin sur ESA WorldCover 10 m, en CLASSES nommées.
//
// Porté de BVTrace (Core/WorldCoverClasses.cs, App/WorldCoverClient.cs). Invariants
// (docs/context/hydrologie-tunisie.md de BVTrace) :
//  - classes, pas verdeur : végétation = forêt, arbustes, prairies, cultures, zone humide herbacée,
//    mangrove, mousses ; non végétation = bâti, sol nu, neige, eau ;
//  - couche DÉCOUVERTE dans les capabilities (identifiant, style, jeu EPSG:3857, gabarit des niveaux,
//    dimension TIME obligatoire relue avec sa valeur par défaut), jamais codée en dur ;
//  - aucun plus proche voisin sur les couleurs : au-delà de 5 % d'inconnus la mesure est REFUSÉE ;
//  - dénominateur = surface TOTALE du bassin, eau et bâti compris ;
//  - balayage par lignes (pair-impair sur tous les anneaux), pondération par cos²(lat) ;
//  - surface échantillonnée comparée à celle du bassin (écart > 10 % signalé) ;
//  - un échec n'écrit rien : pas de C plutôt qu'un C calculé sur une couverture inventée.
//
// Accès au service : le navigateur passe d'abord par le relais du site (/wc, fonction Cloudflare Pages,
// même origine), puis à défaut directement par https://wmts.terrascope.be/ (point d'entrée publié par la
// page « Data access » d'ESA WorldCover ; services.terrascope.be/wmts/v2 ne répond pas).

export const WC_CLASSES = Object.freeze([
  { code: 10, label: 'Forêt', rgb: [0x00, 0x64, 0x00], veg: true },
  { code: 20, label: 'Arbustes', rgb: [0xff, 0xbb, 0x22], veg: true },
  { code: 30, label: 'Prairies', rgb: [0xff, 0xff, 0x4c], veg: true },
  { code: 40, label: 'Cultures', rgb: [0xf0, 0x96, 0xff], veg: true },
  { code: 50, label: 'Bâti', rgb: [0xfa, 0x00, 0x00], veg: false },
  { code: 60, label: 'Sol nu ou végétation rare', rgb: [0xb4, 0xb4, 0xb4], veg: false },
  { code: 70, label: 'Neige et glace', rgb: [0xf0, 0xf0, 0xf0], veg: false },
  { code: 80, label: 'Eau permanente', rgb: [0x00, 0x64, 0xc8], veg: false },
  { code: 90, label: 'Zone humide herbacée', rgb: [0x00, 0x96, 0xa0], veg: true },
  { code: 95, label: 'Mangrove', rgb: [0x00, 0xcf, 0x75], veg: true },
  { code: 100, label: 'Mousses et lichens', rgb: [0xfa, 0xe6, 0xa0], veg: true },
]);
export const WC_MAX_UNKNOWN_PCT = 5;
const COLOR_TOL = 8, TILE = 256, NATIVE_ZOOM = 14, MAX_TILES = 240;
export const WC_ENDPOINTS = ['/wc', 'https://wmts.terrascope.be/'];
const BY_CODE = new Map(WC_CLASSES.map((c) => [c.code, c]));

/** Classe d'une couleur à la tolérance près, ou null (jamais de plus proche voisin). */
export function wcMatch(r, g, b) {
  for (const c of WC_CLASSES) if (Math.abs(c.rgb[0] - r) <= COLOR_TOL && Math.abs(c.rgb[1] - g) <= COLOR_TOL && Math.abs(c.rgb[2] - b) <= COLOR_TOL) return c;
  return null;
}
export const wcVegetationLegend = () => WC_CLASSES.filter((c) => c.veg).map((c) => c.label.toLowerCase()).join(', ');

/** Résultat à partir des surfaces par classe et de la surface des pixels inconnus. */
export function wcCompose(weightByCode, unknownW, pixelSizeM, pixels, source) {
  const known = [...weightByCode.values()].reduce((s, w) => s + w, 0), total = known + unknownW;
  if (!(total > 0)) return { ok: false, reason: 'aucun pixel de la couche ne tombe dans le bassin (bassin hors couverture, ou emprise erronée)', source };
  const unknownPct = unknownW / total * 100;
  if (unknownPct > WC_MAX_UNKNOWN_PCT) return { ok: false, unknownPct, pixels, source, reason: `${unknownPct.toFixed(1).replace('.', ',')} % des pixels n'appartiennent à aucune classe connue (limite ${WC_MAX_UNKNOWN_PCT} %) : palette inattendue ou tuile hors couverture. Mesure refusée plutôt que faussée.` };
  let veg = 0; const breakdown = [];
  for (const c of WC_CLASSES) { const w = weightByCode.get(c.code) || 0; if (!(w > 0)) continue; if (c.veg) veg += w; breakdown.push({ code: c.code, label: c.label, veg: c.veg, pct: w / total * 100 }); }
  breakdown.sort((a, b) => b.pct - a.pct);
  return { ok: true, coverPct: veg / total * 100, sampledKm2: total / 1e6, pixels, unknownPct, pixelSizeM, breakdown, source };
}

/** Capabilities WMTS → couche WorldCover (DOMParser). Renvoie { layer } ou { error }. */
export function wcParseCapabilities(xml, baseUrl) {
  if (typeof DOMParser === 'undefined') return { error: 'analyseur XML indisponible' };
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return { error: 'capabilités illisibles' };
  const WM = 'http://www.opengis.net/wmts/1.0', OWS = 'http://www.opengis.net/ows/1.1';
  const kids = (el, ns, name) => [...el.childNodes].filter((n) => n.nodeType === 1 && n.namespaceURI === ns && n.localName === name);
  const txt = (el, ns, name) => (kids(el, ns, name)[0]?.textContent || '').trim();
  const contents = doc.getElementsByTagNameNS(WM, 'Contents')[0] || doc.documentElement;
  const layers = kids(contents, WM, 'Layer').map((l) => ({
    id: txt(l, OWS, 'Identifier'), title: txt(l, OWS, 'Title'),
    style: (() => { const s = [...l.getElementsByTagNameNS(WM, 'Style')][0]; return s ? txt(s, OWS, 'Identifier') : ''; })(),
    sets: [...l.getElementsByTagNameNS(WM, 'TileMatrixSetLink')].map((s) => txt(s, WM, 'TileMatrixSet')),
    // dimensions et leur défaut : WorldCover publie TIME et refuse (HTTP 400) la requête qui l'omet
    dims: kids(l, WM, 'Dimension').map((d) => [txt(d, OWS, 'Identifier'), txt(d, WM, 'Default') || txt(d, WM, 'Value')]).filter(([k, v]) => k && v),
    levels: [...l.getElementsByTagNameNS(WM, 'TileMatrixLimits')].map((t) => Number(txt(t, WM, 'TileMatrix').split(':').pop())).filter((v) => Number.isInteger(v) && v >= 0),
  })).filter((l) => /worldcover/i.test(l.id) && /map/i.test(l.id)).sort((a, b) => (a.id < b.id ? 1 : -1));
  if (!layers.length) return { error: 'aucune couche WorldCover dans les capabilités du service (le service a peut-être renommé sa couche)' };
  const pick = layers[0];
  const set = pick.sets.find((m) => /3857|GoogleMapsCompatible/i.test(m));
  if (!set) return { error: `la couche « ${pick.id} » n'est pas publiée en Web Mercator (EPSG:3857)` };
  // certains services nomment leurs niveaux « EPSG:3857:14 », d'autres « 14 »
  const tms = [...doc.getElementsByTagNameNS(WM, 'TileMatrixSet')].find((s) => txt(s, OWS, 'Identifier') === set);
  const lvNames = tms ? kids(tms, WM, 'TileMatrix').map((m) => txt(m, OWS, 'Identifier')) : [];
  const template = lvNames.some((n) => n.includes(':')) ? `${set}:{z}` : '{z}';
  return { layer: { base: baseUrl, id: pick.id, title: pick.title, style: pick.style, set, template, dims: pick.dims, maxZoom: pick.levels.length ? Math.max(...pick.levels) : NATIVE_ZOOM } };
}

// ── géométrie Web Mercator (pixels globaux au zoom z) ──
const lonToX = (lon, z) => (lon + 180) / 360 * TILE * 2 ** z;
const latToY = (lat, z) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z; };
const yToLat = (y, z) => { const n = Math.PI - 2 * Math.PI * y / (TILE * 2 ** z); return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };

/** Abscisses où l'anneau traverse la ligne yPix (demi-ouvert sur y : un sommet sur la ligne compte une fois). */
function addCrossings(ring, yPix, z, xs) {
  const n = ring.length; if (n < 3) return;
  let px = lonToX(ring[n - 1].lon, z), py = latToY(ring[n - 1].lat, z);
  for (let i = 0; i < n; i++) {
    const cx = lonToX(ring[i].lon, z), cy = latToY(ring[i].lat, z);
    if ((cy > yPix) !== (py > yPix)) xs.push(px + (yPix - py) * (cx - px) / (cy - py));
    px = cx; py = cy;
  }
}

/** Segments de pixels intérieurs (pair-impair sur tous les anneaux) : onSpan(ligne, colDébut, colFin incluse, m² par pixel). */
export function wcScanSpans(rings, z, tileX0, tileY0, width, height, onSpan) {
  const y0 = tileY0 * TILE, x0 = tileX0 * TILE, xs = [];
  for (let row = 0; row < height; row++) {
    const yPix = y0 + row + 0.5; xs.length = 0;
    for (const r of rings) addCrossings(r, yPix, z, xs);
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    const lat = yToLat(yPix, z), mPerPx = 156543.033928 * Math.cos(lat * Math.PI / 180) / 2 ** z, areaPx = mPerPx * mPerPx;
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const cFrom = Math.ceil(xs[k] - x0 - 0.5), cTo = Math.floor(xs[k + 1] - x0 - 0.5);
      if (cTo < 0 || cFrom >= width || cTo < cFrom) continue;
      onSpan(row, Math.max(cFrom, 0), Math.min(cTo, width - 1), areaPx);
    }
  }
}

const bboxOf = (rings) => { let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity; for (const r of rings) for (const p of r) { w = Math.min(w, p.lon); e = Math.max(e, p.lon); s = Math.min(s, p.lat); n = Math.max(n, p.lat); } return { w, e, s, n }; };
function tileRange(bb, z) {
  return { tx0: Math.floor(lonToX(bb.w, z) / TILE), tx1: Math.floor(lonToX(bb.e, z) / TILE), ty0: Math.floor(latToY(bb.n, z) / TILE), ty1: Math.floor(latToY(bb.s, z) / TILE) };
}
/** Surface (km²) des pixels retenus, sans réseau : contrôle du balayage, de la projection et de cos²(lat). */
export function wcEstimateAreaKm2(rings, z = NATIVE_ZOOM) {
  const t = tileRange(bboxOf(rings), z); let total = 0;
  wcScanSpans(rings, z, t.tx0, t.ty0, (t.tx1 - t.tx0 + 1) * TILE, (t.ty1 - t.ty0 + 1) * TILE, (_, a, b, ap) => { total += (b - a + 1) * ap; });
  return total / 1e6;
}

/** PNG (Blob) → codes de classe (−1 hors couverture / alpha nul, 0 couleur inconnue). */
async function decodeTile(blob) {
  const bmp = await createImageBitmap(blob);
  if (bmp.width !== TILE || bmp.height !== TILE) return null;
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(TILE, TILE) : Object.assign(document.createElement('canvas'), { width: TILE, height: TILE });
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, TILE, TILE).data, codes = new Int16Array(TILE * TILE);
  for (let i = 0, p = 0; i < codes.length; i++, p += 4) codes[i] = d[p + 3] < 128 ? -1 : (wcMatch(d[p], d[p + 1], d[p + 2])?.code ?? 0);
  return codes;
}

/**
 * Client WorldCover : découvre le service une fois (points d'entrée essayés dans l'ordre, journal tenu),
 * puis mesure la couverture des bassins. Ne lève pas : un échec revient { ok:false, reason }.
 */
export function createWorldCover({ endpoints = WC_ENDPOINTS, fetchImpl = (u) => fetch(u, { mode: 'cors' }) } = {}) {
  let layer = null, discoveryError = '';
  const tiles = new Map();
  const log = [];
  async function discover() {
    if (layer) return layer;
    for (const ep of endpoints) {
      const base = ep.replace(/\?.*$/, '');
      const url = `${base}${base.includes('?') ? '&' : '?'}service=WMTS&request=GetCapabilities`;
      try {
        const res = await fetchImpl(url);
        if (!res.ok) { log.push(`${base} : HTTP ${res.status}`); continue; }
        const xml = await res.text();
        if (!/Capabilities/.test(xml.slice(0, 2000))) { log.push(`${base} : réponse qui n'est pas un document de capabilities`); continue; }
        const r = wcParseCapabilities(xml, base);
        if (r.error) { log.push(`${base} : ${r.error}`); discoveryError = r.error; continue; }
        layer = r.layer; log.push(`${base} : couche ${layer.id}`); return layer;
      } catch (e) { log.push(`${base} : ${e?.message || e} (réseau ou CORS)`); }
    }
    discoveryError = discoveryError || 'aucun point d\'entrée n\'a répondu';
    return null;
  }
  async function tile(z, x, y) {
    const key = `${z}/${x}/${y}`;
    if (tiles.has(key)) return tiles.get(key);
    const L = layer;
    let url = `${L.base}?service=WMTS&request=GetTile&version=1.0.0&layer=${encodeURIComponent(L.id)}&style=${encodeURIComponent(L.style)}`
      + `&tilematrixset=${encodeURIComponent(L.set)}&tilematrix=${encodeURIComponent(L.template.replace('{z}', String(z)))}&tilerow=${y}&tilecol=${x}&format=image/png`;
    for (const [k, v] of L.dims) url += `&${encodeURIComponent(k.toLowerCase())}=${encodeURIComponent(v)}`;
    const p = (async () => {
      try {
        let res = null;
        if (typeof caches !== 'undefined') { try { const cache = await caches.open('gira-worldcover'); res = await cache.match(url); if (!res) { res = await fetchImpl(url); if (res.ok) await cache.put(url, res.clone()); } } catch { res = null; } }
        if (!res) res = await fetchImpl(url);
        if (!res.ok) return null;
        return await decodeTile(await res.blob());
      } catch { return null; }
    })();
    tiles.set(key, p);
    return p;
  }
  /** rings : anneaux du bassin en { lon, lat } (extérieurs et trous, règle pair-impair). */
  async function measure(rings, onProgress) {
    const L = await discover();
    if (!L) return { ok: false, reason: 'WorldCover : ' + discoveryError };
    rings = (rings || []).filter((r) => r && r.length >= 3);
    if (!rings.length) return { ok: false, reason: 'contour du bassin absent ou dégénéré' };
    const bb = bboxOf(rings);
    if (bb.n > 84 || bb.s < -84) return { ok: false, reason: 'bassin hors de la grille Web Mercator' };
    let z = Math.min(NATIVE_ZOOM, L.maxZoom), t;
    for (; ; z--) { t = tileRange(bb, z); if ((t.tx1 - t.tx0 + 1) * (t.ty1 - t.ty0 + 1) <= MAX_TILES || z <= 8) break; }
    const nx = t.tx1 - t.tx0 + 1, ny = t.ty1 - t.ty0 + 1, W = nx * TILE;
    const codes = new Int16Array(W * ny * TILE).fill(-1);
    let missing = 0, done = 0;
    const jobs = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) jobs.push([i, j]);
    // 6 requêtes en parallèle au plus
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const [i, j] = jobs[next++];
        const px = await tile(z, t.tx0 + i, t.ty0 + j);
        if (!px) missing++;
        else for (let r = 0; r < TILE; r++) codes.set(px.subarray(r * TILE, (r + 1) * TILE), (j * TILE + r) * W + i * TILE);
        done++; onProgress?.(done, jobs.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, jobs.length) }, worker));
    if (missing === jobs.length) return { ok: false, reason: 'aucune tuile WorldCover n\'a pu être téléchargée pour ce bassin' };
    const weight = new Map(); let unknownW = 0, pixels = 0;
    wcScanSpans(rings, z, t.tx0, t.ty0, W, ny * TILE, (row, a, b, ap) => {
      const base = row * W;
      for (let col = a; col <= b; col++) {
        const code = codes[base + col];
        if (code < 0) continue;
        pixels++;
        if (code === 0) { unknownW += ap; continue; }
        weight.set(code, (weight.get(code) || 0) + ap);
      }
    });
    const resM = 156543.033928 * Math.cos((bb.n + bb.s) / 2 * Math.PI / 180) / 2 ** z;
    let src = `ESA WorldCover — ${L.id}, zoom ${z} (≈ ${resM.toFixed(1).replace('.', ',')} m/pixel)`;
    if (missing > 0) src += `, ${missing} tuile(s) manquante(s)`;
    return wcCompose(weight, unknownW, resM, pixels, src);
  }
  return { discover, measure, get log() { return log.slice(); }, get layer() { return layer; } };
}

export const wcClassLabel = (code) => BY_CODE.get(code)?.label ?? String(code);
