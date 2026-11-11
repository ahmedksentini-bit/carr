// uvr.js — déclencheurs UVR et plan de gestion des vitesses le long des axes du projet, d'après le Guide M1
// ESCWA/UNRSF « Conception de routes sûres et inclusives » (version internationale 2026) :
//   • B.5.4 / AD 1.2 : déclencheurs UVR (école, marché, arrêt TC, santé, culte, zone résidentielle dense, gare
//     routière, traversée de localité > 400 m) dans un rayon de 200 m de l'axe → prescriptions de protection ;
//   • AD 1.1 / B.2 : catégories fonctionnelles A–E et vitesses-cibles (A 100, B 80, C 70, D 50, E 30 km/h ;
//     VC = vitesse-cible + 10 km/h, C1.5) ;
//   • C1.5, F1.12, F1.13, F1.15 : transitions de vitesse (annonce et pré-signalisation à 250 / 150 m, bandes
//     rugueuses à 150 / 100 / 50 m, rétrécissement, portail d'entrée, premier plateau à +50 m, séquence inverse) ;
//   • F1.09, F1.10, F1.11, F1.14, F1.17 : plateau traversant, refuge, trottoir continu, chicane, zone 30 scolaire ;
//   • E.4.2 : tableau linéaire des vitesses (PK début / fin, catégorie, vitesse-cible, VC, déclencheurs, dispositifs).
// V85 « géométrique » : formules SETRA reprises de BVTrace (RoadDesignGeometry.V85FromRadiusKmh / V85FromGradeKmh) :
//   V85 = V0 / (1 + 346 / R^1,5) en courbe, V0 − 0,31 p² en rampe (V0 = 120 2×2 voies, 102 2 voies, 92 2 voies 5 m),
//   lissée par des accélérations / décélérations de 0,85 m/s² (profil de vitesse pratiquée, non écrêté).
// Module pur (sans DOM) : axe = { key, name, len, at(s) → { p, t }, project(q) → { s, p, off } }.

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rot90 = (a) => ({ x: -a.y, y: a.x });
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pk = (s) => { const k = Math.floor(Math.round(s) / 1000), m = Math.round(s) - k * 1000; return `${k}+${String(m).padStart(3, '0')}`; };
export const fmtPK = pk;
const isLow = (c) => ['D', 'E', 'HUB', 'HUBS'].includes(c);
const isE = (c) => c === 'E' || c === 'HUB';

// ------------------------------------------------------------------ Référentiel M1
export const CATS = Object.freeze({
  A: { label: 'A — Autoroute / voie express', vt: 100, vc: 110, color: '#7c3aed' },
  B: { label: 'B — Nationale (liaison interurbaine)', vt: 80, vc: 90, color: '#2563eb' },
  C: { label: 'C — Régionale', vt: 70, vc: 80, color: '#0891b2' },
  D: { label: 'D — Traversée de localité', vt: 50, vc: 60, color: '#f59e0b' },
  E: { label: 'E — Zone sensible', vt: 30, vc: 40, color: '#dc2626' },
  // Cadre Roads-for-Life (R4L), Banque mondiale / WRI, Guide for Safe Speeds (2024), § 2.3 et figure 8 (routes rurales)
  // et § 2.2 et figure 7 (routes urbaines) : vitesses maximales.
  AC: { label: 'R4L — Rurale à accès contrôlé (100)', short: 'Accès contrôlé', vt: 100, vc: 110, color: '#7c3aed', r4l: true },
  L80: { label: 'R4L — Liaison rurale avec TPC / séparateur (80)', short: 'Liaison', vt: 80, vc: 90, color: '#2563eb', r4l: true },
  L70: { label: 'R4L — Liaison rurale sans séparateur (70)', short: 'Liaison', vt: 70, vc: 80, color: '#2563eb', r4l: true },
  A70: { label: 'R4L — Accès rurale, abords protégés (70)', short: 'Accès', vt: 70, vc: 80, color: '#0891b2', r4l: true },
  A50: { label: 'R4L — Accès rurale, abords non protégés (50)', short: 'Accès', vt: 50, vc: 60, color: '#0891b2', r4l: true },
  UL: { label: 'R4L — Liaison urbaine (50–70)', short: 'Liaison urbaine', vt: 70, vc: 80, color: '#0e7490', r4l: true },
  UM: { label: 'R4L — Axe urbain principal (50)', short: 'Axe principal', vt: 50, vc: 60, color: '#d97706', r4l: true },
  HUB: { label: 'R4L — Pôle d\'activité humaine (30)', short: 'Pôle d\'activité', vt: 30, vc: 40, color: '#dc2626', r4l: true },
  HUBS: { label: 'R4L — Pôle d\'activité, usagers vulnérables séparés (50)', short: 'Pôle (UVR séparés)', vt: 50, vc: 60, color: '#f59e0b', r4l: true },
  IX: { label: 'R4L — Approche de carrefour (50)', short: 'Carrefour', vt: 50, vc: 60, color: '#a855f7', r4l: true },
});
export const M1_BASES = ['A', 'B', 'C'];
export const R4L_BASES = ['AC', 'L80', 'L70', 'A70', 'A50', 'UL', 'UM'];
export const REFS = { M1: 'Guide M1 ESCWA/UNRSF (2026)', R4L: 'Roads-for-Life — Banque mondiale, Guide for Safe Speeds (2024)' };

// Types de déclencheurs (B.5.4, AD 1.2). v : vitesse-cible (AD 1.2) ; rural : la vitesse s'applique aussi hors
// traversée (sinon, hors agglomération, seuls les aménagements ponctuels sont prescrits — cas de l'arrêt TC du
// tableau E.4.2) ; must / should : aménagements du tableau AD 1.2 ; fiches : fiches M1 associées.
export const UVR_TYPES = Object.freeze({
  ecole: { label: 'École / établissement d\'enseignement', short: 'ÉC', color: '#dc2626', v: 30, rural: true, fiches: 'F1.17, F1.09, F1.14',
    must: ['Zone 30 (F1.17) : panneaux aux deux entrées et rappels tous les 100 m, marquage « 30 » tous les 50 m', 'Plateau traversant au droit de l\'entrée (F1.09)', 'Trottoirs continus ≥ 2,00 m des deux côtés (objectif 2,50 m), bordure 15 cm', 'Éclairage continu, renforcé au passage'],
    should: ['Clôture directrice ≥ 1,10 m sur ≥ 20 m de part et d\'autre de l\'entrée', 'Chicane ou rétrécissement en amont du plateau (F1.14)', 'Agent de sécurité scolaire aux heures d\'entrée / sortie'] },
  marche: { label: 'Marché / zone commerciale', short: 'MA', color: '#ea580c', v: 30, rural: true, fiches: 'F1.09, F1.10, F1.11',
    must: ['Trottoirs ≥ 1,50 m (objectif 2,50 m)', 'Passages protégés', 'Éclairage', 'Refuge si traversée > 7 m (F1.10)'],
    should: ['Limitation temporaire les jours de marché', 'Plateau traversant (F1.09)', 'Séparation des flux, signalisation renforcée'] },
  tc: { label: 'Arrêt de transport collectif', short: 'TC', color: '#0d9488', v: 50, rural: false, fiches: 'F1.09, F1.10',
    must: ['Passage piéton + refuge ≥ 2,00 m + éclairage au droit de l\'arrêt', 'Trottoir d\'accès'], should: ['Quai surélevé, abri'] },
  sante: { label: 'Centre de santé / hôpital', short: 'SA', color: '#db2777', v: 50, rural: true, fiches: 'F1.09, F1.11',
    must: ['Trottoirs continus', 'Passage protégé', 'Accès PMR', 'Éclairage'], should: ['Plateau traversant', 'Zone 30 si forte affluence'] },
  culte: { label: 'Lieu de culte', short: 'CU', color: '#7c3aed', v: 50, rural: false, fiches: 'F1.09',
    must: ['Passage piéton + éclairage', 'Trottoir'], should: ['Refuge', 'Limitation temporaire (heures de prière, vendredi / dimanche)'] },
  residentiel: { label: 'Zone résidentielle dense', short: 'RE', color: '#ca8a04', v: 50, rural: true, fiches: 'F1.11, F1.14',
    must: ['Trottoirs ≥ 1,50 m des deux côtés (objectif 2,50 m)', 'Passages piétons espacés ≤ 200 m'], should: ['Éclairage continu', 'Chicane ou rétrécissement (F1.14)'] },
  gare: { label: 'Gare routière / parking PL', short: 'GR', color: '#475569', v: 50, rural: true, fiches: 'F1.09, F1.11',
    must: ['Trottoirs', 'Traversée protégée', 'Éclairage'], should: ['Séparation PL / piétons, clôture'] },
});
export const TYPE_KEYS = Object.keys(UVR_TYPES);

export function defaultUvrOpts() {
  return {
    R: 200, // rayon d'influence (m) — B.5.4
    travMin: 400, // longueur minimale d'une traversée de localité (m) — B.5.4
    gapMin: 300, // une remontée de vitesse plus courte entre deux zones lentes est supprimée (m)
    travGap: 150, // trous de bâti fusionnés pour former une traversée (m)
    bldMin: 4, // bâtiments (OSM) dans la fenêtre de ±50 m × 80 m pour qu'un point de l'axe soit « bâti »
    spacing: 200, // espacement maximal des traversées piétonnes en cat. D / E (AD 1.2)
    v0: 'auto', // profil V85 : auto | 120 | 102 | 92
    ref: 'M1', // référentiel des vitesses : M1 (ESCWA/UNRSF) ou R4L (Banque mondiale)
    sep: false, // R4L : usagers vulnérables séparés du trafic dans les pôles d'activité (trottoirs, traversées sûres) → 50 km/h
    junc: true, // carrefours plans sur l'axe : vitesse d'approche ≤ 50 km/h (M1 AD 1.3, R4L § 2.3)
    juncL: 100, // longueur de la zone à 50 km/h de part et d'autre du centre du carrefour (m)
    types: Object.fromEntries(TYPE_KEYS.map((k) => [k, { v: UVR_TYPES[k].v, rural: UVR_TYPES[k].rural }])),
  };
}
export function uvrOpts(o) {
  const d = defaultUvrOpts(), r = { ...d, ...(o || {}) };
  r.types = Object.fromEntries(TYPE_KEYS.map((k) => [k, { ...d.types[k], ...(o?.types?.[k] || {}) }]));
  if (r.ref !== 'R4L') r.ref = 'M1';
  for (const k of ['R', 'travMin', 'gapMin', 'travGap', 'bldMin', 'spacing', 'juncL']) if (!(+r[k] > 0)) r[k] = d[k]; else r[k] = +r[k];
  return r;
}
// Catégorie de base d'un axe (rase campagne) : autoroute → A ; route à chaussées séparées → B ; sinon B.
export function baseCatOf(ax, ref = 'M1') {
  const auto = ax?.key === 'hwy' && ax?.H && ax.H.kind !== 'route';
  if (ref === 'R4L') return auto ? 'AC' : (ax?.H?.median || 0) > 0 ? 'L80' : 'L70';
  return auto ? 'A' : 'B';
}

// ------------------------------------------------------------------ OpenStreetMap (Overpass)
// Classement d'un objet OSM en déclencheur (null si non pertinent).
export function classifyOsm(tags = {}) {
  const a = tags.amenity, pt = tags.public_transport, h = tags.highway;
  if (/^(school|kindergarten|college|university|childcare)$/.test(a) || tags.building === 'school') return 'ecole';
  if (a === 'marketplace' || tags.landuse === 'retail' || /^(mall|supermarket)$/.test(tags.shop || '')) return 'marche';
  if (a === 'bus_station' || (pt === 'station' && tags.bus !== 'no' && !tags.railway)) return 'gare';
  if (h === 'bus_stop' || pt === 'platform' || a === 'taxi' || (pt === 'stop_position' && (tags.bus === 'yes' || tags.share_taxi === 'yes'))) return 'tc';
  if (/^(hospital|clinic|doctors)$/.test(a) || /^(hospital|clinic|centre|doctor)$/.test(tags.healthcare || '')) return 'sante';
  if (a === 'place_of_worship') return 'culte';
  return null;
}
// Requête Overpass : déclencheurs, zones bâties (landuse) et bâtiments (centres) le long de la polyligne [lat, lon].
export function overpassQL(polyLL, R = 200, Rb = 120) {
  const pts = polyLL.map(([lat, lon]) => `${lat.toFixed(6)},${lon.toFixed(6)}`).join(',');
  const ar = (r) => `(around:${Math.round(r)},${pts})`;
  return `[out:json][timeout:120];
(
  nwr["amenity"~"^(school|kindergarten|college|university|childcare|marketplace|bus_station|taxi|hospital|clinic|doctors|place_of_worship)$"]${ar(R)};
  nwr["highway"="bus_stop"]${ar(R)};
  nwr["public_transport"~"^(platform|station)$"]${ar(R)};
  nwr["healthcare"~"^(hospital|clinic|centre|doctor)$"]${ar(R)};
  nwr["shop"~"^(mall|supermarket)$"]${ar(R)};
)->.p;
.p out tags center;
way["landuse"~"^(residential|retail|commercial)$"]${ar(R)}->.l;
.l out tags geom;
way["building"]${ar(Rb)}->.b;
.b out ids center;`;
}
// Réponse Overpass → { triggers: [{ type, name, lon, lat, ring?, osm }], built: [{ kind, ring: [[lon, lat]] }], bld: [[lon, lat]] }
export function parseOverpass(json) {
  const triggers = [], built = [], bld = [], seen = new Set();
  for (const e of json?.elements || []) {
    const tags = e.tags || {}, c = e.center || (e.lat != null ? { lat: e.lat, lon: e.lon } : null);
    if (!e.tags && e.type === 'way' && c) { bld.push([+c.lon.toFixed(6), +c.lat.toFixed(6)]); continue; } // bâtiment (ids center)
    if (e.type === 'way' && tags.landuse && e.geometry?.length > 2) {
      const ring = e.geometry.map((g) => [+g.lon.toFixed(6), +g.lat.toFixed(6)]);
      if (tags.landuse === 'residential' || tags.landuse === 'commercial') built.push({ kind: tags.landuse, name: tags.name || '', ring });
      if (tags.landuse === 'retail') triggers.push({ type: 'marche', name: tags.name || 'Zone commerciale', lon: avg(ring, 0), lat: avg(ring, 1), ring, osm: `${e.type}/${e.id}` });
      continue;
    }
    const type = classifyOsm(tags);
    if (!type || !c) continue;
    const id = `${e.type}/${e.id}`;
    if (seen.has(id)) continue; seen.add(id);
    triggers.push({ type, name: tags.name || tags['name:fr'] || tags['name:ar'] || '', lon: +c.lon.toFixed(6), lat: +c.lat.toFixed(6), osm: id });
  }
  // un arrêt TC décrit par plusieurs objets (quai + poteau) à moins de 30 m : un seul déclencheur
  const out = [];
  for (const t of triggers) {
    if (t.type === 'tc' && out.some((q) => q.type === 'tc' && llDist(q, t) < 30)) continue;
    out.push(t);
  }
  return { triggers: out, built, bld };
}
const avg = (ring, i) => +(ring.reduce((s, p) => s + p[i], 0) / ring.length).toFixed(6);
const llDist = (a, b) => { const k = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180); return Math.hypot((a.lon - b.lon) * k, a.lat - b.lat) * 111320; };

// Repère KMZ / KML → type de déclencheur d'après son nom ou celui de son dossier (null si non reconnu).
const KW = [
  ['ecole', /(é|e)cole|lyc(é|e)e|coll(è|e)ge|universit|madrasa|medersa|kutt?ab|daara|\bcem\b|jardin d.enfant|cr(è|e)che|school|kindergarten|مدرسة|معهد|روضة|كتاب|جامعة/i],
  ['marche', /march(é|e)|souk|suq|louma|market|commerc|échoppe|echoppe|سوق/i],
  ['gare', /gare routi|garage (des |de )?(cars|taxis|bus)|station (de )?(bus|louage)|bus station|louage|محطة/i],
  ['tc', /arr(ê|e)t|abribus|bus stop|taxi|cars? rapides?|ndiaga|transport (en )?commun|موقف/i],
  ['sante', /h(ô|o)pital|clinique|dispensaire|centre de sant|poste de sant|case de sant|maternit|sant(é|e) de base|\bcsb\b|hospital|clinic|health|مستشفى|مستوصف|صحة/i],
  ['culte', /mosqu(é|e)e|(é|e)glise|zaou?ia|lieu de culte|mosque|church|جامع|مسجد|كنيسة/i],
  ['residentiel', /r(é|e)sidenti|lotissement|cit(é|e)\b|quartier|habitat|حي/i],
];
export function classifyName(...names) {
  const s = names.filter(Boolean).join(' ');
  for (const [k, re] of KW) if (re.test(s)) return k;
  return null;
}
export const BUILT_RE = /agglom(é|e)ration|localit(é|e)|village|douar|bourg|zone b(â|a)tie|tissu urbain|travers(é|e)e|built|town|قرية|تجمع/i;

// ------------------------------------------------------------------ géométrie
function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function distToRing(p, ring) {
  if (pointInRing(p, ring)) return 0;
  let d = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], ab = sub(b, a), L2 = ab.x * ab.x + ab.y * ab.y || 1;
    const u = clamp(((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / L2, 0, 1);
    d = Math.min(d, dist(p, add(a, mul(ab, u))));
  }
  return d;
}
// Échantillonnage de l'axe (pas ds) : [{ s, p, t, n }] (n = normale à gauche).
export function sampleAxis(ax, ds = 5) {
  const out = [], n = Math.max(1, Math.ceil(ax.len / ds));
  for (let i = 0; i <= n; i++) { const s = (ax.len * i) / n, q = ax.at(s); out.push({ s, p: q.p, t: q.t, n: rot90(q.t) }); }
  return out;
}

// Position d'un déclencheur sur l'axe : { s, off, d, s0, s1 } ou null s'il est à plus de R de l'axe.
// Point : PK projeté, zone ±R le long de l'axe (F1.17 : « 200 m de part et d'autre de l'entrée ») ;
// surface : partie de l'axe à moins de R du contour.
export function triggerOnAxis(ax, trg, R, samples) {
  if (trg.ring?.length > 2) {
    let s0 = Infinity, s1 = -Infinity, dmin = Infinity, best = null;
    for (const q of samples) {
      const d = distToRing(q.p, trg.ring);
      if (d < dmin) { dmin = d; best = q; }
      if (d <= R) { s0 = Math.min(s0, q.s); s1 = Math.max(s1, q.s); }
    }
    if (!(dmin <= R) || !best) return null;
    const c = { x: trg.x, y: trg.y }, side = (c.x - best.p.x) * best.n.x + (c.y - best.p.y) * best.n.y;
    return { s: best.s, off: Math.sign(side) * dmin, d: dmin, s0: Math.max(0, s0), s1: Math.min(ax.len, s1), area: true };
  }
  const pr = ax.project({ x: trg.x, y: trg.y });
  if (!pr) return null;
  const s = clamp(pr.s, 0, ax.len), foot = ax.at(s).p, d = dist(foot, trg);
  if (d > R) return null;
  return { s, off: pr.off ?? d, d, s0: Math.max(0, s - R), s1: Math.min(ax.len, s + R) };
}

// Traversées de localité détectées : intervalles de l'axe bordés de bâti (zones résidentielles / commerciales
// traversées ou longées à moins de 40 m, ou au moins bldMin bâtiments dans ±50 m le long × 80 m de part et d'autre),
// trous < travGap fusionnés. Renvoie toutes les plages, longues (≥ travMin : traversée, B.5.4) ou courtes.
export function detectBuilt(ax, { polys = [], bld = [] }, opts = {}) {
  const o = uvrOpts(opts), ds = 10, smp = sampleAxis(ax, ds);
  // index des bâtiments par cellule de 50 m
  const cell = 50, idx = new Map();
  for (const b of bld) { const k = `${Math.floor(b.x / cell)},${Math.floor(b.y / cell)}`; let a = idx.get(k); if (!a) idx.set(k, (a = [])); a.push(b); }
  const near = (p, r) => { const out = [], i0 = Math.floor((p.x - r) / cell), i1 = Math.floor((p.x + r) / cell), j0 = Math.floor((p.y - r) / cell), j1 = Math.floor((p.y + r) / cell); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const b of idx.get(`${i},${j}`) || []) if (dist(b, p) <= r) out.push(b); return out; };
  const flag = smp.map((q) => {
    for (const P of polys) for (const off of [0, 40, -40]) if (pointInRing(add(q.p, mul(q.n, off)), P)) return true;
    if (!bld.length) return false;
    let n = 0;
    for (const b of near(q.p, 100)) { const v = sub(b, q.p), lg = Math.abs(v.x * q.t.x + v.y * q.t.y), lt = Math.abs(v.x * q.n.x + v.y * q.n.y); if (lg <= 50 && lt <= 80) n++; }
    return n >= o.bldMin;
  });
  let runs = [];
  for (let i = 0; i < smp.length; i++) {
    if (!flag[i]) continue;
    const s0 = Math.max(0, smp[i].s - ds / 2);
    let j = i; while (j + 1 < smp.length && flag[j + 1]) j++;
    runs.push({ s0, s1: Math.min(ax.len, smp[j].s + ds / 2) }); i = j;
  }
  const merged = [];
  for (const r of runs) { const l = merged[merged.length - 1]; if (l && r.s0 - l.s1 < o.travGap) l.s1 = r.s1; else merged.push({ ...r }); }
  return merged.map((r) => ({ s0: Math.round(r.s0), s1: Math.round(r.s1), len: Math.round(r.s1 - r.s0), trav: r.s1 - r.s0 >= o.travMin }));
}

// ------------------------------------------------------------------ V85 géométrique (BVTrace)
export const V0_PROFILES = { 120: '2×2 voies', 102: '2 voies 6–7 m ou 3 voies', 92: '2 voies 5 m' };
export const v85FromRadius = (V0, R) => (R > 0 && isFinite(R) ? V0 / (1 + 346 / Math.pow(R, 1.5)) : V0);
export const v85FromGrade = (V0, p) => V0 - 0.31 * p * p;
export function v0Of(ax, opt) {
  if (+opt > 0) return +opt;
  const H = ax?.H;
  if ((H?.median || 0) > 0 || (H?.lanes || 1) >= 2 || ax?.key === 'hwy' && H && H.kind !== 'route') return 120;
  const w = H?.wLane || (ax?.half ? ax.half : 3.5);
  return w < 2.9 ? 92 : 102;
}
// Profil [{ s, R, v }] au pas ds : rayon local (variation de cap sur ±10 m), V85 en courbe et en rampe (zAt facultatif),
// lissage par accélération / décélération a (m/s²) dans les deux sens.
export function v85Profile(ax, { V0 = 102, ds = 10, zAt = null, a = 0.85 } = {}) {
  const n = Math.max(2, Math.ceil(ax.len / ds)), S = [];
  for (let i = 0; i <= n; i++) S.push((ax.len * i) / n);
  const h = Math.min(10, ax.len / 4);
  const pts = S.map((s) => {
    const t0 = ax.at(Math.max(0, s - h)).t, t1 = ax.at(Math.min(ax.len, s + h)).t, L = Math.min(ax.len, s + h) - Math.max(0, s - h);
    const dth = Math.abs(Math.atan2(t0.x * t1.y - t0.y * t1.x, t0.x * t1.x + t0.y * t1.y));
    const R = dth > 1e-5 ? L / dth : Infinity;
    let v = v85FromRadius(V0, R);
    if (zAt) { try { const z0 = zAt(Math.max(0, s - 25)), z1 = zAt(Math.min(ax.len, s + 25)); if (isFinite(z0) && isFinite(z1)) v = Math.min(v, v85FromGrade(V0, Math.abs((z1 - z0) / (Math.min(ax.len, s + 25) - Math.max(0, s - 25))) * 100)); } catch { /* profil indisponible */ } }
    return { s, R: isFinite(R) ? Math.round(R) : null, v };
  });
  const ms = (v) => v / 3.6;
  for (let i = 1; i < pts.length; i++) { const vm = Math.sqrt(ms(pts[i - 1].v) ** 2 + 2 * a * (pts[i].s - pts[i - 1].s)) * 3.6; pts[i].v = Math.min(pts[i].v, vm); }
  for (let i = pts.length - 2; i >= 0; i--) { const vm = Math.sqrt(ms(pts[i + 1].v) ** 2 + 2 * a * (pts[i + 1].s - pts[i].s)) * 3.6; pts[i].v = Math.min(pts[i].v, vm); }
  return pts.map((q) => ({ ...q, v: Math.round(q.v * 10) / 10 }));
}

// ------------------------------------------------------------------ analyse d'un axe
// input : { triggers: [{ id, type, name, x, y, ring? }], trav: [{ s0, s1, on }], baseCat, zAt, width }
export function analyzeAxis(ax, input = {}, opts = {}) {
  const o = uvrOpts(opts), R4L = o.ref === 'R4L';
  const okBase = (c) => CATS[c] && (R4L ? R4L_BASES : M1_BASES).includes(c);
  const baseCat = okBase(input.baseCat) ? input.baseCat : baseCatOf(ax, o.ref), base = CATS[baseCat];
  // R4L : tout générateur d'usagers vulnérables (hameau, école, commerce de bord de route, lieu de culte, arrêt, accès)
  // fait de la section un pôle d'activité humaine à 30 km/h, hors traversée comme en traversée ; 50 km/h si les
  // usagers vulnérables sont séparés du trafic (§ 2.3, p. 34).
  const hubV = o.sep ? 50 : 30;
  const typeV = (k) => (R4L ? { v: hubV, rural: true } : o.types[k]);
  const travV = R4L ? hubV : 50;
  // carrefours sur l'axe (centres projetés) : zone d'approche à 50 km/h
  const juncs = o.junc ? (input.junctions || []).map((s) => clamp(+s, 0, ax.len)).filter((s) => isFinite(s)) : [];
  const ds = 5, smp = sampleAxis(ax, ds), checks = [];
  const width = +input.width > 0 ? +input.width : (ax.half ? 2 * ax.half : 7);
  // traversées retenues
  const trav = (input.trav || []).filter((t) => t.on !== false && t.s1 > t.s0).map((t) => ({ s0: clamp(+t.s0, 0, ax.len), s1: clamp(+t.s1, 0, ax.len), name: t.name || '' }));
  const inTrav = (s) => trav.some((t) => s >= t.s0 - 1e-6 && s <= t.s1 + 1e-6);
  // déclencheurs sur l'axe
  const hits = [];
  for (const t of input.triggers || []) {
    if (!UVR_TYPES[t.type]) continue;
    const h = triggerOnAxis(ax, t, o.R, smp);
    if (h) hits.push({ ...h, id: t.id, type: t.type, name: t.name || '', src: t.src || '', x: t.x, y: t.y });
  }
  hits.sort((a, b) => a.s - b.s);
  // vitesse-cible au pas ds
  const V = smp.map((q) => {
    let v = base.vt, why = [];
    const tr = inTrav(q.s);
    if (tr && travV < v) { v = travV; why.push('traversée'); }
    for (const h of hits) {
      if (q.s < h.s0 || q.s > h.s1) continue;
      const T = typeV(h.type);
      if (!(T.rural || tr)) continue;
      if (T.v < v) { v = T.v; why = [h.type]; } else if (T.v === v && !why.includes(h.type)) why.push(h.type);
    }
    let ix = false;
    if (juncs.some((s) => Math.abs(q.s - s) <= o.juncL) && 50 < v) { v = 50; ix = true; }
    return { s: q.s, v, tr, ix };
  });
  // sections de vitesse constante
  let segs = [];
  for (const q of V) {
    const l = segs[segs.length - 1];
    if (l && l.v === q.v && l.tr === q.tr && l.ix === q.ix) l.s1 = q.s; else { if (l) l.s1 = q.s; segs.push({ s0: q.s, s1: q.s, v: q.v, tr: q.tr, ix: q.ix }); }
  }
  // remontées de vitesse trop courtes entre deux zones lentes (effet « yo-yo ») : supprimées
  for (let pass = 0; pass < 20; pass++) {
    let ch = false;
    for (let i = 1; i < segs.length - 1; i++) {
      const g = segs[i], a = segs[i - 1], b = segs[i + 1];
      if (g.v > a.v && g.v > b.v && g.s1 - g.s0 < o.gapMin) { g.v = Math.max(a.v, b.v); g.tr = g.tr || (a.tr && b.tr); ch = true; }
    }
    const m = [];
    for (const g of segs) { const l = m[m.length - 1]; if (l && l.v === g.v && l.tr === g.tr) { l.s1 = g.s1; l.ix = l.ix && g.ix; } else m.push({ ...g }); }
    segs = m;
    if (!ch) break;
  }
  // tronçon court (< 100 m) de vitesse intermédiaire entre deux zones : rattaché à la zone la plus lente (protection)
  for (let pass = 0; pass < 5; pass++) {
    let ch = false;
    for (let i = 0; i < segs.length; i++) {
      const g = segs[i], a = segs[i - 1], b = segs[i + 1];
      if (g.s1 - g.s0 >= 100 || !a || !b) continue;
      const lo = Math.min(a.v, b.v), hi = Math.max(a.v, b.v);
      if (g.v > lo && g.v < hi) { const L = a.v < b.v ? a : b; g.v = L.v; g.tr = L.tr; ch = true; }
    }
    const m = [];
    for (const g of segs) { const l = m[m.length - 1]; if (l && l.v === g.v && l.tr === g.tr) { l.s1 = g.s1; l.ix = l.ix && g.ix; } else m.push({ ...g }); }
    segs = m;
    if (!ch) break;
  }
  segs = segs.filter((g) => g.s1 - g.s0 > 0.5);
  { // même vitesse de part et d'autre d'une fin de traversée (ex. gare routière juste après) : une seule section
    const m = [];
    for (const g of segs) { const l = m[m.length - 1]; if (l && l.v === g.v) { l.s1 = g.s1; l.tr = l.tr || g.tr; l.ix = l.ix && g.ix; } else m.push({ ...g }); }
    segs = m;
  }
  for (const g of segs) {
    g.cat = g.v >= base.vt ? baseCat : R4L ? (g.ix && !g.tr ? 'IX' : g.v <= 30 ? 'HUB' : 'HUBS') : g.v <= 40 ? 'E' : 'D';
    if (!R4L && g.ix && !g.tr && g.v === 50 && g.v < base.vt) g.cat = 'D';
    g.vc = g.v >= base.vt ? base.vc : g.v + 10; // C1.5 : VC ≤ vitesse-cible + 10 km/h
    g.hits = hits.filter((h) => h.s1 >= g.s0 && h.s0 <= g.s1);
    g.len = g.s1 - g.s0;
  }
  // ------------------------------------------------ aménagements
  const treat = [];
  const T = (s, dir, code, label, fiche, lvl, extra = {}) => { if (s >= -1 && s <= ax.len + 1) treat.push({ s: clamp(s, 0, ax.len), dir, code, label, fiche, lvl, ...extra }); };
  const trans = [];
  for (let i = 1; i < segs.length; i++) {
    const a = segs[i - 1], b = segs[i], sb = a.s1;
    if (a.v === b.v) continue;
    const hi = a.v > b.v ? a : b, lo = a.v > b.v ? b : a, dir = a.v > b.v ? 1 : -1; // dir : sens de circulation qui entre dans la zone lente
    const at = (d) => sb - dir * d; // d > 0 : en amont (côté rapide) pour le sens entrant
    const dv = hi.v - lo.v, gate = hi.v >= 70 && lo.v <= 50, Ltr = gate || dv > 20 ? 250 : 100;
    trans.push({ s: sb, dir, vh: hi.v, vl: lo.v, catH: hi.cat, catL: lo.cat, gate, ix: lo.ix && !lo.tr, from: Math.min(sb, at(Ltr)), to: Math.max(sb, at(Ltr)), Ltr });
    if (lo.ix && !lo.tr && lo.cat !== 'E' && lo.cat !== 'HUB') { // approche d'un carrefour plan
      T(at(Math.min(250, Ltr)), dir, 'annonce', `Présignalisation du carrefour et limitation ${lo.v} km/h`, R4L ? 'R4L § 2.3' : 'AD 1.3', 'MUST', { sign: `B14-${lo.v}` });
      if (dv > 20) for (const d of [150, 100, 50]) T(at(d), dir, 'bandes', `Bandes rugueuses transversales — série à ${d} m`, 'F1.15', 'SHOULD');
      T(sb, dir, 'limite', `Approche du carrefour à ${lo.v} km/h au plus : giratoire compact, plateau ou îlot séparateur (chocs au-delà de 50 km/h rarement survivables)`, R4L ? 'R4L § 2.3, p. 34–35' : 'AD 1.3, F1.05–F1.07', 'MUST');
      T(sb, -dir, 'sortie', `Fin de la zone de carrefour (reprise ${hi.v} km/h)`, R4L ? 'R4L § 2.3' : 'AD 1.3', 'MUST', { sign: `B14-${hi.v}` });
      continue;
    }
    if (gate) {
      T(at(250), dir, 'annonce', `Panneau d'annonce${lo.tr ? ' « agglomération »' : ''} + pré-signalisation (250 m)`, 'F1.12, F1.13', 'MUST', { sign: 'ANN' });
      for (const d of [150, 100, 50]) T(at(d), dir, 'bandes', `Bandes rugueuses transversales — série à ${d} m (3 bandes de 15–20 cm, espacées de 30 cm)`, 'F1.15', 'SHOULD');
      T(at(150), dir, 'retrec', `Réduction de largeur de voie 3,50 → 3,25 m + panneau ${Math.min(hi.v, 60)} km/h + marquage d'approche`, 'F1.13', 'MUST', { sign: hi.v > 60 ? 'B14-60' : null });
      T(sb, dir, 'portail', `Portail d'entrée (gateway) : îlot central ≥ 2,0 × 10 m surélevé, voies 3,00–3,25 m, panneau ${lo.v} km/h, changement de texture, éclairage — V85 visée ≤ 55 km/h`, 'F1.12', 'MUST', { sign: lo.tr ? 'EB10' : `B14-${lo.v}` });
      if (lo.v <= 30) T(sb, dir, 'zone30', 'Entrée de zone 30 : panneau zone 30, marquage « 30 »', 'F1.17', 'MUST', { sign: 'B30' });
      T(sb + dir * Math.min(50, lo.len / 2), dir, 'plateau', 'Premier plateau traversant (ou giratoire compact) à +50 m du portail — h < 15 cm, plateau ≥ 4 m, rampes ≤ 10 %', 'F1.13, F1.09', 'MUST');
      T(sb, -dir, 'sortie', `Sortie : séquence inverse (fin ${lo.tr ? 'd\'agglomération' : 'de zone'}, élargissement progressif, reprise ${hi.v} km/h)`, 'F1.13', 'MUST', { sign: lo.tr ? 'EB20' : `B14-${hi.v}` });
    } else if (lo.v <= 30) { // D → E (entrée de zone 30)
      T(at(50), dir, 'chicane', 'Chicane ou rétrécissement en amont de la zone 30 (décalage ≥ 2,0 m, voie 3,00–3,50 m)', 'F1.14, F1.17', 'SHOULD');
      T(sb, dir, 'zone30', `Entrée de zone 30 : panneau zone 30, marquage « 30 », plateau traversant${dv > 20 ? ' (transition > 20 km/h : bandes rugueuses d\'annonce)' : ''}`, 'F1.17, F1.09', 'MUST', { sign: 'B30' });
      if (dv > 20) for (const d of [100, 50]) T(at(d), dir, 'bandes', `Bandes rugueuses transversales — série à ${d} m`, 'F1.15', 'SHOULD');
      T(sb, -dir, 'sortie', `Sortie de zone 30 (fin de zone, reprise ${hi.v} km/h)`, 'F1.17', 'MUST', { sign: 'B51' });
    } else { // autre changement (ex. 80 → 70, 70 → 50 hors traversée)
      T(at(Ltr), dir, 'annonce', `Panneau de limitation ${lo.v} km/h (pré-signalisation)`, 'C1.5', 'MUST', { sign: `B14-${lo.v}` });
      if (dv > 20) for (const d of [150, 100, 50]) T(at(d), dir, 'bandes', `Bandes rugueuses transversales — série à ${d} m`, 'F1.15', 'SHOULD');
      T(sb, dir, 'limite', `Limitation ${lo.v} km/h + marquage${lo.v <= 50 ? ' + rétrécissement de voie 3,00–3,25 m' : ''}`, lo.v <= 50 ? 'F1.14' : 'C1.5', 'MUST', { sign: `B14-${lo.v}` });
      T(sb, -dir, 'sortie', `Fin de la limitation ${lo.v} km/h (reprise ${hi.v} km/h)`, 'C1.5', 'MUST', { sign: `B14-${hi.v}` });
    }
  }
  // aménagements au droit des déclencheurs
  for (const h of hits) {
    const Ty = UVR_TYPES[h.type], g = segs.find((q) => h.s >= q.s0 - 1e-6 && h.s <= q.s1 + 1e-6) || segs[0];
    const lbl = `${Ty.label}${h.name ? ` « ${h.name} »` : ''}`;
    if (h.type === 'ecole') {
      T(h.s, 0, 'plateau', `Plateau traversant au droit de l'entrée — ${lbl}`, 'F1.09, F1.17', 'MUST', { trg: h.id, sign: 'A13a' });
      T(h.s, 0, 'cloture', 'Clôture directrice ≥ 1,10 m sur ≥ 20 m de part et d\'autre de l\'entrée', 'F1.17', 'SHOULD', { trg: h.id });
      for (const s of [h.s - 100, h.s + 100]) if (s > g.s0 + 20 && s < g.s1 - 20) T(s, 0, 'rappel30', 'Rappel zone 30 (panneau tous les 100 m, marquage « 30 » tous les 50 m)', 'F1.17', 'MUST', { trg: h.id, sign: 'B30' });
    } else if (h.type === 'tc' || h.type === 'culte' || h.type === 'gare' || h.type === 'sante' || h.type === 'marche') {
      const plat = g.v <= 50 && (h.type === 'marche' || h.type === 'sante');
      T(h.s, 0, plat ? 'plateau' : 'passage', `${plat ? 'Plateau traversant' : 'Passage piéton protégé'}${width > 7 ? ' + refuge ≥ 2,00 m (traversée > 7 m)' : ''} + éclairage dédié — ${lbl}`, plat ? 'F1.09, F1.10' : 'F1.10', plat ? 'SHOULD' : 'MUST', { trg: h.id, sign: 'C20a' });
    }
    for (const m of Ty.must) if (!/plateau traversant au droit|passage piéton \+|^passage protégé$/i.test(m)) T(h.s, 0, 'prescr', m, Ty.fiches, 'MUST', { trg: h.id, list: true });
    for (const m of Ty.should) T(h.s, 0, 'prescr', m, Ty.fiches, 'SHOULD', { trg: h.id, list: true });
  }
  // traversées piétonnes régulières et linéaires en D / E
  for (const g of segs) {
    if (!isLow(g.cat)) continue;
    const fixed = treat.filter((q) => (q.code === 'passage' || q.code === 'plateau') && q.s >= g.s0 && q.s <= g.s1).map((q) => q.s);
    const n = Math.max(0, Math.ceil(g.len / o.spacing) - 1);
    for (let k = 1; k <= n; k++) {
      const s = g.s0 + (g.len * k) / (n + 1);
      if (fixed.some((f) => Math.abs(f - s) < o.spacing / 2)) continue;
      T(s, 0, 'passage', `Passage piéton protégé${width > 7 ? ' + refuge ≥ 2,00 m' : ''} + éclairage dédié (espacement ≤ ${o.spacing} m)`, width > 7 ? 'F1.10, AD 1.2' : 'AD 1.2', 'MUST', { sign: 'C20a' });
    }
    T((g.s0 + g.s1) / 2, 0, 'lineaire', `Sur ${pk(g.s0)} – ${pk(g.s1)} : trottoirs continus des deux côtés ${isE(g.cat) ? '≥ 2,50 m (PMR)' : '2,50 m (1,50 m minimum)'}, bateaux aux traversées, éclairage continu, dépassement interdit (ligne continue)`, 'F1.11, C3.2.2', 'MUST', { s0: g.s0, s1: g.s1 });
  }
  treat.sort((a, b) => a.s - b.s);
  // ------------------------------------------------ V85 géométrique et cohérence vitesse-géométrie
  const V0 = v0Of(ax, o.v0);
  const v85 = v85Profile(ax, { V0, zAt: input.zAt || null });
  const vAt = (s) => { const i = clamp(Math.round((s / ax.len) * (v85.length - 1)), 0, v85.length - 1); return v85[i]?.v ?? V0; };
  for (const g of segs) {
    const inG = v85.filter((q) => q.s >= g.s0 && q.s <= g.s1);
    if (!inG.length) continue;
    const vmax = Math.max(...inG.map((q) => q.v)), vmin = Math.min(...inG.map((q) => q.v)), where = `${pk(g.s0)} – ${pk(g.s1)}`;
    if (isLow(g.cat) && vmax > g.v + 10) {
      checks.push({ lvl: 'warn', msg: `${ax.name}, ${where} (cat. ${g.cat}, ${g.v} km/h) : la géométrie autorise une V85 de ${Math.round(vmax)} km/h (> vitesse-cible + 10) — vitesse-cible non crédible sans modération physique : plateaux / chicanes répétés (F1.09, F1.14).` });
      const step = isE(g.cat) ? 75 : 150, n = Math.floor(g.len / step);
      for (let k = 1; k <= n; k++) { const s = g.s0 + (g.len * k) / (n + 1); if (!treat.some((q) => ['plateau', 'chicane', 'portail'].includes(q.code) && Math.abs(q.s - s) < step / 2)) T(s, 0, isE(g.cat) ? 'plateau' : 'chicane', `Dispositif de modération physique (${isE(g.cat) ? 'plateau traversant' : 'chicane ou rétrécissement'}) : V85 géométrique ${Math.round(vAt(s))} km/h pour ${g.v} km/h`, isE(g.cat) ? 'F1.09' : 'F1.14', 'SHOULD'); }
    } else if (!isLow(g.cat) && vmax > g.vc) checks.push({ lvl: 'info', msg: `${ax.name}, ${where} : V85 géométrique ${Math.round(vmax)} km/h > VC ${g.vc} km/h (C1.5 : VC ≤ vitesse-cible + 10) — contrôle des vitesses (signalisation, radar) ou reprise du tracé.` });
    if (vmin < g.v - 15 && !isE(g.cat)) {
      const q = inG.find((r) => r.v === vmin);
      checks.push({ lvl: 'warn', msg: `${ax.name}, ${pk(q.s)} : courbe R ≈ ${q.R ?? '—'} m, V85 ${Math.round(vmin)} km/h, nettement sous la vitesse-cible de ${g.v} km/h — signalisation de virage, balisage, vitesse conseillée ; à éviter en approche d'un déclencheur.` });
    }
  }
  for (const t of trans) if (t.gate) {
    const v = vAt(t.s);
    if (v > 70) checks.push({ lvl: 'info', msg: `${ax.name}, portail ${pk(t.s)} : V85 géométrique d'approche ${Math.round(v)} km/h — le portail et le rétrécissement doivent ramener la V85 à ≤ 55 km/h (F1.12) : mesure de la V85 après mise en service (F1.13).` });
  }
  if (!hits.length && !trav.length) checks.push({ lvl: 'info', msg: `${ax.name} : aucun déclencheur UVR à moins de ${o.R} m — profil standard de la catégorie ${baseCat} (AD 1.2).` });
  for (const h of hits) if (h.type === 'ecole' && !(input.trav || []).length && !o.types.ecole.rural) checks.push({ lvl: 'warn', msg: `${ax.name}, ${pk(h.s)} : école hors traversée sans zone 30 — F1.17 impose une zone 30 aménagée pour toute école déclencheur.` });
  // ------------------------------------------------ retouches de l'utilisateur (input.edits)
  // Chaque aménagement proposé a une clé « code:sens:déclencheur:PK » ; une retouche s'applique à l'aménagement de même
  // code, sens et déclencheur dont le PK est à moins de 15 m de celui de la clé (le tracé peut avoir un peu bougé).
  for (const q of treat) { q.key = treatKey(q); q.auto = true; }
  const E = input.edits || {};
  const match = (k) => { const a = parseKey(k); if (!a) return null; let best = null; for (const q of treat) if (q.auto && q.code === a.code && q.dir === a.dir && (q.trg || '') === a.trg && Math.abs(q.s0key - a.s) <= 15 && (!best || Math.abs(q.s0key - a.s) < Math.abs(best.s0key - a.s))) best = q; return best; };
  for (const q of treat) q.s0key = q.s;
  for (const k of E.del || []) { const q = match(k); if (q) q.deleted = true; }
  for (const [k, s] of Object.entries(E.mv || {})) { const q = match(k); if (q && isFinite(+s)) { q.s = clamp(+s, 0, ax.len); q.moved = true; } }
  for (const [k, c] of Object.entries(E.sign || {})) { const q = match(k); if (q) { q.sign = c || null; q.signEdited = true; } }
  const removed = treat.filter((q) => q.deleted);
  for (let i = treat.length - 1; i >= 0; i--) if (treat[i].deleted) treat.splice(i, 1);
  for (const a of E.add || []) {
    const C = MANUAL[a.code]; if (!C || !isFinite(+a.s)) continue;
    const v = +a.v || null;
    treat.push({ s: clamp(+a.s, 0, ax.len), dir: +a.dir || 0, code: a.code, label: `${C.label(v)} (ajouté)`, fiche: C.fiche, lvl: a.lvl || 'MUST', sign: a.sign !== undefined ? a.sign : C.sign(v), manual: a.id, key: `manual:${a.id}` });
  }
  treat.sort((a, b) => a.s - b.s);
  // vitesse visée (approche) : rampe linéaire sur la transition côté rapide
  const vv = V.map((q) => {
    const g = segs.find((x) => q.s >= x.s0 - 1e-6 && q.s <= x.s1 + 1e-6) || segs[segs.length - 1];
    let v = g.v;
    for (const t of trans) { const d = (t.s - q.s) * t.dir; if (d >= 0 && d <= t.Ltr) v = Math.min(v, Math.max(t.vl, t.vl + ((t.vh - t.vl) * d) / t.Ltr)); }
    return { s: q.s, v: Math.round(v) };
  });
  // tableau E.4.2
  const rows = [];
  for (const g of segs) {
    const trigs = g.hits.map((h) => `${UVR_TYPES[h.type].label.split(' /')[0]}${h.name ? ` « ${h.name} »` : ''} PK ${pk(h.s)}`);
    const IN = new Set(['passage', 'plateau', 'chicane', 'cloture', 'rappel30', 'lineaire']);
    const disp = [...new Set(treat.filter((q) => IN.has(q.code) && q.s > g.s0 + 1 && q.s < g.s1 - 1 && (q.lvl === 'MUST' || q.code === 'chicane' || q.code === 'plateau')).map((q) => q.code))].map((c) => CODE_LBL[c] || c);
    rows.push({ s0: g.s0, s1: g.s1, cat: CATS[g.cat].r4l ? CATS[g.cat].short : g.cat, vt: `${g.v} km/h`, vc: `${g.vc} km/h`, trig: trigs.join(' ; ') || 'Aucun', disp: disp.join(', ') || (g.cat === baseCat ? 'Profil standard de la catégorie (F1.01)' : '—') });
  }
  for (const t of trans) rows.push({ s0: t.from, s1: t.to, cat: `Transition ${t.dir === 1 ? `${t.catH}→${t.catL}` : `${t.catL}←${t.catH}`}`, vt: `${t.vh}→${t.vl} km/h`, vc: '—', trig: '—', disp: t.ix ? 'Présignalisation, limitation 50, bandes rugueuses, carrefour aménagé (giratoire / plateau)' : t.gate ? 'Annonce 250 m, bandes rugueuses 150/100/50 m, rétrécissement 150 m, portail, plateau +50 m (F1.12, F1.13, F1.15)' : t.vl <= 30 ? 'Entrée de zone 30, plateau, chicane (F1.17, F1.14)' : 'Limitation et marquage' , trans: true });
  rows.sort((a, b) => a.s0 - b.s0 || (a.trans ? 1 : -1));
  return { key: ax.key, name: ax.name, len: ax.len, ref: o.ref, baseCat, V0, width, hits, trav, segs, trans, treat, removed, v85, vv, rows, checks };
}
export const treatKey = (q) => `${q.code}:${q.dir}:${q.trg || ''}:${Math.round(q.s0key ?? q.s)}`;
const parseKey = (k) => { const m = /^([a-z0-9]+):(-?\d+):([^:]*):(-?\d+(?:\.\d+)?)$/.exec(k || ''); return m ? { code: m[1], dir: +m[2], trg: m[3], s: +m[4] } : null; };
// Aménagements ajoutables à la main (onglet Vitesses / UVR) : libellé, fiche M1, panneau par défaut.
export const MANUAL = {
  portail: { name: 'Portail d\'entrée (gateway)', fiche: 'F1.12', label: () => 'Portail d\'entrée : îlot central ≥ 2,0 × 10 m, voies 3,00–3,25 m, éclairage', sign: () => 'EB10' },
  plateau: { name: 'Plateau traversant', fiche: 'F1.09', label: () => 'Plateau traversant (h < 15 cm, ≥ 4 m, rampes ≤ 10 %)', sign: () => 'C20a' },
  passage: { name: 'Passage piéton protégé', fiche: 'F1.10', label: () => 'Passage piéton protégé + éclairage dédié', sign: () => 'C20a' },
  chicane: { name: 'Chicane / rétrécissement', fiche: 'F1.14', label: () => 'Chicane ou rétrécissement de voie', sign: () => null },
  bandes: { name: 'Bandes rugueuses', fiche: 'F1.15', label: () => 'Bandes rugueuses transversales (3 bandes)', sign: () => null },
  zone30: { name: 'Entrée de zone 30', fiche: 'F1.17', label: () => 'Entrée de zone 30', sign: () => 'B30' },
  limite: { name: 'Limitation de vitesse', fiche: 'C1.5', label: (v) => `Limitation ${v || 50} km/h`, sign: (v) => `B14-${v || 50}` },
  annonce: { name: 'Panneau d\'annonce', fiche: 'F1.13', label: () => 'Panneau d\'annonce de zone de modération', sign: () => 'ANN' },
  ecole: { name: 'Panneau « enfants »', fiche: 'F1.17', label: () => 'Signalisation de danger « enfants »', sign: () => 'A13a' },
};
export const SIGN_CHOICES = [['', '(aucun)'], ['B14-30', 'Limitation 30'], ['B14-50', 'Limitation 50'], ['B14-60', 'Limitation 60'], ['B14-70', 'Limitation 70'], ['B14-80', 'Limitation 80'], ['B30', 'Zone 30'], ['B51', 'Fin de zone 30'], ['EB10', 'Entrée d\'agglomération'], ['EB20', 'Sortie d\'agglomération'], ['A13a', 'Enfants'], ['C20a', 'Passage piéton'], ['ANN', 'Annonce « Ralentir »']];
export const CODE_LBL = { annonce: 'annonce', bandes: 'bandes rugueuses', retrec: 'rétrécissement', portail: 'portail d\'entrée', zone30: 'zone 30', plateau: 'plateaux traversants', sortie: 'séquence de sortie', chicane: 'chicane', limite: 'limitation', passage: 'passages piétons protégés', lineaire: 'trottoirs, éclairage continu, dépassement interdit', cloture: 'clôture directrice', rappel30: 'rappels zone 30', prescr: 'prescriptions UVR' };

// ------------------------------------------------------------------ exports
export function rowsCsv(results) {
  const c = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const out = ['Axe;PK début;PK fin;Cat.;Vitesse-cible;VC;Déclencheurs UVR;Dispositifs de modération'];
  for (const r of results) for (const q of r.rows) out.push([r.name, pk(q.s0), pk(q.s1), q.cat, q.vt, q.vc, q.trig, q.disp].map(c).join(';'));
  return out.join('\r\n');
}
export function treatCsv(results) {
  const c = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const out = ['Axe;PK;Sens;Aménagement;Niveau;Fiche M1'];
  for (const r of results) for (const q of r.treat) out.push([r.name, pk(q.s), q.dir === 1 ? 'croissant' : q.dir === -1 ? 'décroissant' : 'les deux', q.label, q.lvl, q.fiche].map(c).join(';'));
  return out.join('\r\n');
}

// Diagramme SVG du profil des vitesses d'un axe (vitesse-cible, vitesse visée, V85 géométrique, déclencheurs,
// catégories, aménagements). width en px ; renvoie une chaîne SVG autonome (couleurs fixes, imprimable).
export function speedSvg(r, { width = 1000, s0 = 0, s1 = r.len } = {}) {
  const height = 330;
  const ml = 46, mr = 12, mt = 16, chartH = 170, bandY = mt + chartH + 22, bandH = 16, trY = bandY + bandH + 10;
  const vmax = Math.max(60, ...r.v85.map((q) => q.v), ...r.segs.map((g) => g.v)) + 10;
  const X = (s) => ml + ((s - s0) / Math.max(1, s1 - s0)) * (width - ml - mr), Y = (v) => mt + chartH - (v / vmax) * chartH;
  const inR = (s) => s >= s0 - 1 && s <= s1 + 1;
  let g = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="Segoe UI, Arial, sans-serif" font-size="10">`;
  g += `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`;
  for (let v = 0; v <= vmax; v += 10) g += `<line x1="${ml}" x2="${width - mr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${v % 50 ? '#eef2f7' : '#d5dce6'}"/><text x="${ml - 5}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end" fill="#64748b">${v}</text>`;
  const stepPk = [100, 200, 250, 500, 1000, 2000, 5000].find((k) => (s1 - s0) / k <= 12) || 10000;
  for (let s = Math.ceil(s0 / stepPk) * stepPk; s <= s1; s += stepPk) g += `<line x1="${X(s).toFixed(1)}" x2="${X(s).toFixed(1)}" y1="${mt}" y2="${mt + chartH}" stroke="#eef2f7"/><text x="${X(s).toFixed(1)}" y="${mt + chartH + 12}" text-anchor="middle" fill="#64748b">${pk(s)}</text>`;
  g += `<text x="6" y="${mt + 4}" fill="#334155" font-weight="600">km/h</text>`;
  // zones de transition
  for (const t of r.trans) if (inR(t.from) || inR(t.to)) g += `<rect x="${X(Math.max(s0, t.from)).toFixed(1)}" y="${mt}" width="${Math.max(0, X(Math.min(s1, t.to)) - X(Math.max(s0, t.from))).toFixed(1)}" height="${chartH}" fill="#fde68a" opacity="0.35"/>`;
  // influence des déclencheurs
  for (const h of r.hits) g += `<rect x="${X(Math.max(s0, h.s0)).toFixed(1)}" y="${mt + chartH - 6}" width="${Math.max(0, X(Math.min(s1, h.s1)) - X(Math.max(s0, h.s0))).toFixed(1)}" height="6" fill="${UVR_TYPES[h.type].color}" opacity="0.35"/>`;
  const line = (pts, st) => `<polyline fill="none" ${st} points="${pts.filter((q) => inR(q.s)).map((q) => `${X(q.s).toFixed(1)},${Y(q.v).toFixed(1)}`).join(' ')}"/>`;
  g += line(r.v85, 'stroke="#94a3b8" stroke-width="1.4" stroke-dasharray="4 3"');
  g += line(r.vv, 'stroke="#f59e0b" stroke-width="1.6"');
  const step = []; for (const s of r.segs) step.push({ s: s.s0, v: s.v }, { s: s.s1, v: s.v });
  g += line(step, 'stroke="#1d4ed8" stroke-width="2.4"');
  for (const s of r.segs) if (s.s1 > s0 && s.s0 < s1) { const xm = X((Math.max(s0, s.s0) + Math.min(s1, s.s1)) / 2); if (X(Math.min(s1, s.s1)) - X(Math.max(s0, s.s0)) > 26) g += `<text x="${xm.toFixed(1)}" y="${(Y(s.v) - 4).toFixed(1)}" text-anchor="middle" fill="#1d4ed8" font-weight="700">${s.v}</text>`; }
  for (const h of r.hits) if (inR(h.s)) g += `<line x1="${X(h.s).toFixed(1)}" x2="${X(h.s).toFixed(1)}" y1="${mt}" y2="${mt + chartH}" stroke="${UVR_TYPES[h.type].color}" stroke-dasharray="2 2"/><circle cx="${X(h.s).toFixed(1)}" cy="${mt + 7}" r="7" fill="${UVR_TYPES[h.type].color}"/><text x="${X(h.s).toFixed(1)}" y="${mt + 10}" text-anchor="middle" fill="#fff" font-size="7.5" font-weight="700">${UVR_TYPES[h.type].short}</text>`;
  // bandeau des catégories
  g += `<text x="6" y="${bandY + 11}" fill="#334155">Cat.</text>`;
  for (const s of r.segs) if (s.s1 > s0 && s.s0 < s1) { const xa = X(Math.max(s0, s.s0)), xb = X(Math.min(s1, s.s1)); g += `<rect x="${xa.toFixed(1)}" y="${bandY}" width="${Math.max(0, xb - xa).toFixed(1)}" height="${bandH}" fill="${CATS[s.cat].color}"/>`; const lb = CATS[s.cat].r4l ? CATS[s.cat].short : s.cat; if (xb - xa > Math.max(14, lb.length * 5.6)) g += `<text x="${((xa + xb) / 2).toFixed(1)}" y="${bandY + 11.5}" text-anchor="middle" fill="#fff" font-weight="700">${lb}</text>`; }
  // bandeau des aménagements (symboles)
  g += `<text x="6" y="${trY + 10}" fill="#334155">Am.</text>`;
  const sym = { portail: ['▮', '#7c2d12'], plateau: ['▬', '#b45309'], bandes: ['≡', '#92400e'], annonce: ['▲', '#dc2626'], retrec: ['◇', '#9a3412'], zone30: ['30', '#dc2626'], chicane: ['S', '#a16207'], passage: ['‖', '#0f766e'], sortie: ['◁', '#64748b'], limite: ['○', '#dc2626'], rappel30: ['30', '#ef4444'] };
  const lanes = [[], [], []];
  for (const q of r.treat) {
    if (!sym[q.code] || !inR(q.s)) continue;
    const x = X(q.s), lane = q.dir === 1 ? 0 : q.dir === -1 ? 2 : 1;
    if (lanes[lane].some((xx) => Math.abs(xx - x) < 8)) continue; lanes[lane].push(x);
    g += `<text x="${x.toFixed(1)}" y="${(trY + 9 + lane * 12).toFixed(1)}" text-anchor="middle" fill="${sym[q.code][1]}" font-size="${sym[q.code][0].length > 1 ? 7.5 : 10}" font-weight="700">${sym[q.code][0]}</text>`;
  }
  g += `<text x="${width - mr}" y="${trY + 9}" text-anchor="end" fill="#94a3b8" font-size="8">sens →</text><text x="${width - mr}" y="${trY + 33}" text-anchor="end" fill="#94a3b8" font-size="8">← sens</text>`;
  // légende : ce que contient ce profil (lignes, catégories, déclencheurs, aménagements présents), en lignes qui se
  // replient selon la largeur
  const items = [], sec = (title) => items.push({ title });
  const it = (w, draw, label) => items.push({ w: w + 6 + label.length * 6.1, draw, label, sw: w });
  sec('Courbes');
  it(22, (x, y) => `<line x1="${x}" x2="${x + 22}" y1="${y - 3}" y2="${y - 3}" stroke="#1d4ed8" stroke-width="2.4"/>`, r.ref === 'R4L' ? 'vitesse maximale R4L par section' : 'vitesse-cible M1 par section');
  it(22, (x, y) => `<line x1="${x}" x2="${x + 22}" y1="${y - 3}" y2="${y - 3}" stroke="#f59e0b" stroke-width="1.6"/>`, 'vitesse visée en approche (séquence F1.13)');
  it(22, (x, y) => `<line x1="${x}" x2="${x + 22}" y1="${y - 3}" y2="${y - 3}" stroke="#94a3b8" stroke-width="1.4" stroke-dasharray="4 3"/>`, `V85 permise par la géométrie (V0 = ${r.V0} km/h)`);
  it(16, (x, y) => `<rect x="${x}" y="${y - 8}" width="16" height="9" fill="#fde68a" opacity="0.7"/>`, 'zone de transition de vitesse');
  if (r.hits.length) it(16, (x, y) => `<rect x="${x}" y="${y - 6}" width="16" height="6" fill="#94a3b8" opacity="0.5"/>`, 'zone d\'influence d\'un déclencheur (couleur du type)');
  const types = [...new Set(r.hits.map((h) => h.type))];
  if (types.length) { sec('Déclencheurs UVR'); for (const k of types) it(14, (x, y) => `<circle cx="${x + 7}" cy="${y - 4}" r="7" fill="${UVR_TYPES[k].color}"/><text x="${x + 7}" y="${y - 1}" text-anchor="middle" fill="#fff" font-size="7.5" font-weight="700">${UVR_TYPES[k].short}</text>`, UVR_TYPES[k].label.split(' /')[0]); }
  const cats = [...new Set(r.segs.map((s) => s.cat))];
  sec('Catégories (bandeau « Cat. »)'); for (const c of cats) it(16, (x, y) => `<rect x="${x}" y="${y - 9}" width="16" height="10" fill="${CATS[c].color}"/>`, CATS[c].r4l ? CATS[c].label.replace('R4L — ', '') : `${c} — ${CATS[c].label.replace(/^[A-E] — /, '')} (${CATS[c].vt} km/h)`);
  const SYML = { annonce: 'panneau d\'annonce / présignalisation', bandes: 'bandes rugueuses', retrec: 'rétrécissement de voie + panneau 60', portail: 'portail d\'entrée (gateway)', zone30: 'entrée de zone 30', rappel30: 'rappel zone 30', plateau: 'plateau traversant', chicane: 'chicane / rétrécissement', passage: 'passage piéton protégé', limite: 'limitation de vitesse', sortie: 'sortie de zone (séquence inverse)' };
  const codes = Object.keys(SYML).filter((c) => r.treat.some((q) => q.code === c && inR(q.s)));
  if (codes.length) {
    sec('Aménagements (bandeau « Am. »)');
    it(0, () => '', 'lignes : haut = sens des PK croissants · milieu = deux sens · bas = PK décroissants');
    for (const c of codes) it(12, (x, y) => `<text x="${x + 6}" y="${y}" text-anchor="middle" fill="${sym[c][1]}" font-size="${sym[c][0].length > 1 ? 7.5 : 10}" font-weight="700">${sym[c][0]}</text>`, SYML[c]);
  }
  let lx = ml, ly = trY + 52, leg = '';
  for (const q of items) {
    if (q.title) { if (lx > ml) ly += 15; lx = ml; ly += 4; leg += `<text x="${ml}" y="${ly}" fill="#0f172a" font-weight="700" font-size="9.5">${q.title}</text>`; ly += 14; continue; }
    if (lx + q.w > width - mr && lx > ml) { lx = ml; ly += 15; }
    leg += q.draw(lx, ly) + `<text x="${lx + q.sw + 5}" y="${ly}" fill="#334155" font-size="9.5">${q.label}</text>`;
    lx += q.w + 14;
  }
  const H = ly + 10;
  g = g.replace(`viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"`, `viewBox="0 0 ${width} ${H}" width="${width}" height="${H}"`).replace(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`, `<rect x="0" y="0" width="${width}" height="${H}" fill="#ffffff"/>`);
  g += `<line x1="${ml}" x2="${width - mr}" y1="${trY + 42}" y2="${trY + 42}" stroke="#e2e8f0"/>` + leg;
  return g + '</svg>';
}
