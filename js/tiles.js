// tiles.js — fond de plan en tuiles Web Mercator, reprojeté à la volée dans le système du projet.
// Chaque tuile est dessinée par une transformation affine calculée sur trois de ses coins.

export const PROVIDERS = {
  esri: {
    label: 'Satellite (Esri World Imagery)', max: 21,
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    attr: 'Imagerie © Esri, Maxar, Earthstar Geographics',
  },
  osm: {
    label: 'Plan (OpenStreetMap)', max: 19,
    url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    attr: '© contributeurs OpenStreetMap',
  },
  esriTopo: {
    label: 'Topographique (Esri)', max: 19,
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`,
    attr: '© Esri, HERE, Garmin, USGS',
  },
  // Surcouche transparente : noms des villes et localités, limites administratives (sur l'imagerie satellite).
  places: {
    label: 'Noms des lieux (Esri)', max: 23, overlay: true,
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`,
    attr: 'noms © Esri, HERE, Garmin, OpenStreetMap',
  },
};

const lon2t = (lon, n) => ((lon + 180) / 360) * n;
const lat2t = (lat, n) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n; };
const t2lon = (x, n) => (x / n) * 360 - 180;
const t2lat = (y, n) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;

export class TileLayer {
  constructor(onLoad) {
    this.cache = new Map();
    this.blank = new Set(); // tuiles sans imagerie à leur niveau (clés)
    this.onLoad = onLoad;
    this.provider = 'esri';
    this.opacity = 1;
    this.cors = true; // passe à false si le serveur refuse le CORS (export PNG alors sans fond)
  }

  _get(z, x, y, create = true) {
    const key = `${this.provider}/${z}/${x}/${y}`;
    let e = this.cache.get(key);
    if (e) { this.cache.delete(key); this.cache.set(key, e); return e; }
    if (!create) return null;
    // Au-delà d'une tuile vide, ses descendantes le sont aussi : pas de requête.
    for (let k = 0; k <= z; k++) if (this.blank.has(`${this.provider}/${z - k}/${x >> k}/${y >> k}`)) return { ok: false, blank: true };
    const img = new Image();
    if (this.cors) img.crossOrigin = 'anonymous';
    e = { img, ok: false, err: false, blank: false };
    img.onload = () => {
      e.ok = true;
      if (this._isBlank(img)) { e.blank = true; this.blank.add(key); }
      this.onLoad();
    };
    img.onerror = () => { e.err = true; this.onLoad(); };
    img.src = PROVIDERS[this.provider].url(z, x, y);
    this.cache.set(key, e);
    if (this.cache.size > 700) this.cache.delete(this.cache.keys().next().value);
    return e;
  }

  // Tuile « Map data not yet available » d'Esri : gris uniforme (204, 204, 204) avec un texte blanc.
  _isBlank(img) {
    if (!this.cors) return false;
    try {
      const c = (this._probe ||= Object.assign(document.createElement('canvas'), { width: 16, height: 16 }));
      const g = c.getContext('2d', { willReadFrequently: true });
      g.clearRect(0, 0, 16, 16);
      g.drawImage(img, 0, 0, 16, 16);
      const d = g.getImageData(0, 0, 16, 16).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 204) <= 2 && Math.abs(d[i + 1] - 204) <= 2 && Math.abs(d[i + 2] - 204) <= 2) n++;
      return n > 0.7 * 256;
    } catch { return false; }
  }

  // view : { s2w(px,py) → [x,y], w2s(x,y) → [px,py], W, H, s } ; crs : { toLL, fromLL }
  draw(ctx, view, crs, dpr) {
    const P = PROVIDERS[this.provider];
    const corners = [[0, 0], [view.W, 0], [0, view.H], [view.W, view.H]].map(([px, py]) => {
      const [x, y] = view.s2w(px, py);
      return crs.toLL(x, y);
    });
    const c = crs.toLL(...view.s2w(view.W / 2, view.H / 2));
    if (!corners.every((q) => isFinite(q.lat) && isFinite(q.lon)) || Math.abs(c.lat) > 85) return;
    const mpp = 156543.03392 * Math.cos((c.lat * Math.PI) / 180);
    let z = Math.floor(Math.log2(mpp * view.s) + 0.5);
    z = Math.max(2, Math.min(P.max, z));
    let n, x0, x1, y0, y1;
    for (;;) {
      n = 2 ** z;
      x0 = Math.floor(Math.min(...corners.map((q) => lon2t(q.lon, n))));
      x1 = Math.floor(Math.max(...corners.map((q) => lon2t(q.lon, n))));
      y0 = Math.floor(Math.min(...corners.map((q) => lat2t(q.lat, n))));
      y1 = Math.floor(Math.max(...corners.map((q) => lat2t(q.lat, n))));
      if ((x1 - x0 + 1) * (y1 - y0 + 1) <= 300 || z <= 2) break;
      z--;
    }
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.imageSmoothingQuality = 'high';
    this._budget = 4000; // morceaux dessinés au plus par image (vue très large)
    for (let ty = Math.max(0, y0); ty <= Math.min(n - 1, y1); ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const wx = ((tx % n) + n) % n;
        const e = this._get(z, wx, ty);
        if (e.ok && !e.blank) { this._blit(ctx, view, crs, n, dpr, e.img, 0, 0, 256, tx, ty, 1, 0); continue; }
        if (P.overlay) continue; // textes : pas de tuile parente agrandie (écritures démesurées)
        // En attendant, ou si l'imagerie n'existe pas à ce niveau : tuile parente agrandie. Quand la tuile est vide
        // ou en erreur, la parente est demandée au serveur ; sinon, seules les tuiles déjà en cache servent.
        let ask = e.blank || e.err;
        for (let k = 1; k <= 8 && z - k >= 0; k++) {
          const p = this._get(z - k, wx >> k, ty >> k, ask);
          if (p && !p.ok && !p.blank && !p.err) ask = false; // parente en cours de chargement
          if (p && p.ok && !p.blank) {
            const sz = 256 / 2 ** k;
            this._blit(ctx, view, crs, n, dpr, p.img, (wx - ((wx >> k) << k)) * sz, (ty - ((ty >> k) << k)) * sz, sz, tx, ty, 1, 0);
            break;
          }
        }
      }
    }
    ctx.restore();
  }

  // Morceau de tuile (rectangle source carré sx, sy, ss de l'image ; carré tx, ty, ts en coordonnées de tuiles) dessiné
  // par une transformation affine sur trois coins. La projection du projet (UTM, Lambert…) n'est pas affine à l'échelle
  // d'une tuile peu zoomée : le 4e coin s'écarte, des coins voisins ne se rejoignent plus et des triangles vides
  // (blancs) apparaissent entre les tuiles. Le morceau est alors coupé en quatre jusqu'à un écart de moins d'un pixel.
  _blit(ctx, view, crs, n, dpr, img, sx, sy, ss, tx, ty, ts, depth) {
    const NW = this._scr(view, crs, tx, ty, n), NE = this._scr(view, crs, tx + ts, ty, n), SW = this._scr(view, crs, tx, ty + ts, n);
    if (![...NW, ...NE, ...SW].every(Number.isFinite)) return;
    // hors écran (boîte des coins, marge) : rien à dessiner
    const SE = this._scr(view, crs, tx + ts, ty + ts, n);
    const xs = [NW[0], NE[0], SW[0], SE[0]], ys = [NW[1], NE[1], SW[1], SE[1]];
    if (Math.max(...xs) < -50 || Math.min(...xs) > view.W + 50 || Math.max(...ys) < -50 || Math.min(...ys) > view.H + 50) {
      if (Number.isFinite(SE[0]) && Math.max(...xs) - Math.min(...xs) < 4 * view.W) return;
    }
    const err = Number.isFinite(SE[0]) ? Math.hypot(NE[0] + SW[0] - NW[0] - SE[0], NE[1] + SW[1] - NW[1] - SE[1]) : Infinity;
    if (err > 1 && depth < 6 && ss >= 8 && this._budget > 4) {
      const h = ss / 2, t = ts / 2;
      for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) this._blit(ctx, view, crs, n, dpr, img, sx + i * h, sy + j * h, h, tx + i * t, ty + j * t, t, depth + 1);
      return;
    }
    if (this._budget-- <= 0) return;
    ctx.setTransform(
      (dpr * (NE[0] - NW[0])) / ss, (dpr * (NE[1] - NW[1])) / ss,
      (dpr * (SW[0] - NW[0])) / ss, (dpr * (SW[1] - NW[1])) / ss,
      dpr * NW[0], dpr * NW[1]);
    const o = (0.4 * ss) / 256 + 0.25; // léger recouvrement : pas de joint visible entre morceaux
    ctx.drawImage(img, sx, sy, ss, ss, -o, -o, ss + 2 * o, ss + 2 * o);
  }

  _scr(view, crs, tx, ty, n) {
    const w = crs.fromLL(t2lon(tx, n), t2lat(ty, n));
    return view.w2s(w.x, w.y);
  }
}
