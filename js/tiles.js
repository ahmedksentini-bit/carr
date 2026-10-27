// tiles.js — fond de plan en tuiles Web Mercator, reprojeté à la volée dans le système du projet.
// Chaque tuile est dessinée par une transformation affine calculée sur trois de ses coins.

export const PROVIDERS = {
  esri: {
    label: 'Satellite (Esri World Imagery)', max: 19,
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
};

const lon2t = (lon, n) => ((lon + 180) / 360) * n;
const lat2t = (lat, n) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n; };
const t2lon = (x, n) => (x / n) * 360 - 180;
const t2lat = (y, n) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;

export class TileLayer {
  constructor(onLoad) {
    this.cache = new Map();
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
    const img = new Image();
    if (this.cors) img.crossOrigin = 'anonymous';
    e = { img, ok: false, err: false };
    img.onload = () => { e.ok = true; this.onLoad(); };
    img.onerror = () => { e.err = true; };
    img.src = PROVIDERS[this.provider].url(z, x, y);
    this.cache.set(key, e);
    if (this.cache.size > 700) this.cache.delete(this.cache.keys().next().value);
    return e;
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
    for (let ty = Math.max(0, y0); ty <= Math.min(n - 1, y1); ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const wx = ((tx % n) + n) % n;
        const sNW = this._scr(view, crs, tx, ty, n), sNE = this._scr(view, crs, tx + 1, ty, n), sSW = this._scr(view, crs, tx, ty + 1, n);
        ctx.setTransform(
          (dpr * (sNE[0] - sNW[0])) / 256, (dpr * (sNE[1] - sNW[1])) / 256,
          (dpr * (sSW[0] - sNW[0])) / 256, (dpr * (sSW[1] - sNW[1])) / 256,
          dpr * sNW[0], dpr * sNW[1]);
        const e = this._get(z, wx, ty);
        if (e.ok) { ctx.drawImage(e.img, 0, 0, 256, 256, -0.4, -0.4, 256.8, 256.8); continue; }
        // En attendant : tuile parente agrandie si elle est déjà en cache.
        for (let k = 1; k <= 4 && z - k >= 0; k++) {
          const p = this._get(z - k, wx >> k, ty >> k, false);
          if (p && p.ok) {
            const sz = 256 / 2 ** k;
            ctx.drawImage(p.img, (wx - ((wx >> k) << k)) * sz, (ty - ((ty >> k) << k)) * sz, sz, sz, -0.4, -0.4, 256.8, 256.8);
            break;
          }
        }
      }
    }
    ctx.restore();
  }

  _scr(view, crs, tx, ty, n) {
    const w = crs.fromLL(t2lon(tx, n), t2lat(ty, n));
    return view.w2s(w.x, w.y);
  }
}
