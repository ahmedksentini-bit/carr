// crs.js — systèmes de coordonnées du projet. Les coordonnées « monde » de l'application sont
// celles du système projeté choisi (UTM, Lambert…) : un DXF topo dans le même système se superpose au fond satellite.
// proj4js (chargé depuis le CDN) est utilisé quand il est disponible ; l'UTM WGS84 a une implémentation interne de secours.

export const CRS_PRESETS = [
  { id: 'utm', label: 'UTM WGS84 (fuseau automatique)' },
  { id: 'EPSG:22391', label: 'Carthage / Nord Tunisie (EPSG:22391)',
    def: '+proj=lcc +lat_1=36 +lat_0=36 +lon_0=9.9 +k_0=0.999625544 +x_0=500000 +y_0=300000 +a=6378249.2 +b=6356515 +towgs84=-263,6,431,0,0,0,0 +units=m +no_defs' },
  { id: 'EPSG:22392', label: 'Carthage / Sud Tunisie (EPSG:22392)',
    def: '+proj=lcc +lat_1=33.3 +lat_0=33.3 +lon_0=9.9 +k_0=0.999625769 +x_0=500000 +y_0=300000 +a=6378249.2 +b=6356515 +towgs84=-263,6,431,0,0,0,0 +units=m +no_defs' },
  { id: 'EPSG:26191', label: 'Merchich / Nord Maroc (EPSG:26191)',
    def: '+proj=lcc +lat_1=33.3 +lat_0=33.3 +lon_0=-5.4 +k_0=0.999625769 +x_0=500000 +y_0=300000 +a=6378249.2 +b=6356515 +towgs84=31,146,47,0,0,0,0 +units=m +no_defs' },
  { id: 'EPSG:2154', label: 'RGF93 / Lambert-93 (France)',
    def: '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs' },
  { id: 'custom', label: 'Autre (définition proj4)' },
  { id: 'local', label: 'Local (non géoréférencé)' },
];

export const utmZoneOf = (lon) => Math.min(60, Math.max(1, Math.floor((lon + 180) / 6) + 1));

const D2R = Math.PI / 180;
const WGS = { a: 6378137, f: 1 / 298.257223563, k0: 0.9996 };

function utmForward(lon, lat, zone, south) {
  const { a, f, k0 } = WGS, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const lon0 = ((zone - 1) * 6 - 180 + 3) * D2R, phi = lat * D2R, lam = lon * D2R;
  const s = Math.sin(phi), c = Math.cos(phi), t = Math.tan(phi);
  const N = a / Math.sqrt(1 - e2 * s * s), T = t * t, C = ep2 * c * c, A = c * (lam - lon0);
  const M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256) * phi
    - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi)
    + (15 * e2 * e2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
  const x = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
  let y = k0 * (M + N * t * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
  if (south) y += 10000000;
  return [x, y];
}

function utmInverse(x, y, zone, south) {
  const { a, f, k0 } = WGS, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const lon0 = ((zone - 1) * 6 - 180 + 3) * D2R;
  x -= 500000; if (south) y -= 10000000;
  const mu = y / k0 / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const s = Math.sin(p1), c = Math.cos(p1), t = Math.tan(p1);
  const N1 = a / Math.sqrt(1 - e2 * s * s), T1 = t * t, C1 = ep2 * c * c;
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * s * s, 1.5), D = x / (N1 * k0);
  const lat = p1 - (N1 * t / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
  const lon = lon0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / c;
  return [lon / D2R, lat / D2R];
}

export function utmDef(zone, south) {
  return `+proj=utm +zone=${zone}${south ? ' +south' : ''} +datum=WGS84 +units=m +no_defs`;
}

// cfg : { id, zone, south, def }  →  { geo, label, toLL(x,y) → {lon,lat}, fromLL(lon,lat) → {x,y} }
export function makeCRS(cfg) {
  if (!cfg || cfg.id === 'local') return { geo: false, label: 'Local (non géoréférencé)' };
  let def, label;
  if (cfg.id === 'utm') {
    def = utmDef(cfg.zone, cfg.south);
    label = `UTM WGS84 fuseau ${cfg.zone}${cfg.south ? 'S' : 'N'}`;
  } else if (cfg.id === 'custom') {
    def = cfg.def; label = 'proj4 personnalisé';
  } else {
    const p = CRS_PRESETS.find((q) => q.id === cfg.id);
    def = p?.def; label = p?.label;
  }
  const P4 = typeof window !== 'undefined' ? window.proj4 : null;
  if (P4 && def) {
    try {
      const conv = P4('+proj=longlat +datum=WGS84 +no_defs', def);
      return {
        geo: true, label, def,
        toLL: (x, y) => { const r = conv.inverse([x, y]); return { lon: r[0], lat: r[1] }; },
        fromLL: (lon, lat) => { const r = conv.forward([lon, lat]); return { x: r[0], y: r[1] }; },
      };
    } catch (e) { console.warn('proj4 :', e); }
  }
  if (cfg.id === 'utm') {
    return {
      geo: true, label, def,
      toLL: (x, y) => { const r = utmInverse(x, y, cfg.zone, cfg.south); return { lon: r[0], lat: r[1] }; },
      fromLL: (lon, lat) => { const r = utmForward(lon, lat, cfg.zone, cfg.south); return { x: r[0], y: r[1] }; },
    };
  }
  return { geo: false, label: (label || '?') + ' (proj4 indisponible)' };
}
