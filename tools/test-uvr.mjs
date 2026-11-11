// Tests du module UVR / plan de gestion des vitesses (js/uvr.js) — node tools/test-uvr.mjs
import { analyzeAxis, detectBuilt, classifyOsm, classifyName, parseOverpass, v85FromRadius, v85Profile, rowsCsv, speedSvg, overpassQL, overpassBBoxOf, overpassPoiQL, overpassBldQL } from '../js/uvr.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('✖', m); } else console.log('✔', m); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// Axe droit de 6 km le long de x, puis axe avec une courbe de R = 200 m.
const straight = (L) => ({ key: 'hwy', name: 'RN test', len: L, half: 3.5, H: { kind: 'route', lanes: 1, wLane: 3.5 },
  at: (s) => ({ p: { x: s, y: 0 }, t: { x: 1, y: 0 } }), project: (q) => ({ s: Math.max(0, Math.min(L, q.x)), p: { x: q.x, y: 0 }, off: q.y }) });

// V85 (BVTrace) : V0 / (1 + 346 / R^1,5)
ok(near(v85FromRadius(102, 200), 102 / (1 + 346 / Math.pow(200, 1.5))), 'V85 en courbe = formule SETRA / BVTrace');
ok(v85FromRadius(102, Infinity) === 102, 'V85 en alignement = V0');

const ax = straight(6000);
// traversée 2 000–3 000, école à 2 500 (40 m de l'axe), arrêt TC hors agglomération à 4 800, mosquée à 300 m (hors rayon)
const R = analyzeAxis(ax, {
  baseCat: 'B',
  trav: [{ s0: 2000, s1: 3000 }],
  triggers: [
    { id: 'e1', type: 'ecole', name: 'École A', x: 2500, y: 40 },
    { id: 't1', type: 'tc', name: '', x: 4800, y: -15 },
    { id: 'c1', type: 'culte', name: 'Mosquée', x: 1000, y: 300 },
  ],
}, {});
ok(R.hits.length === 2, 'déclencheurs retenus à moins de 200 m (mosquée à 300 m écartée)');
const sAt = (s) => R.segs.find((g) => s >= g.s0 && s <= g.s1);
ok(sAt(1000).v === 80 && sAt(1000).cat === 'B', 'rase campagne : cat. B, 80 km/h');
ok(sAt(2100).v === 50 && sAt(2100).cat === 'D', 'traversée : cat. D, 50 km/h');
ok(sAt(2500).v === 30 && sAt(2500).cat === 'E', 'école : zone 30 (cat. E)');
ok(near(sAt(2500).s0, 2300, 5.01) && near(sAt(2500).s1, 2700, 5.01), 'zone 30 : 200 m de part et d\'autre de l\'entrée (F1.17)');
ok(sAt(4800).v === 80, 'arrêt TC hors traversée : pas de baisse de vitesse (tableau E.4.2)');
ok(R.treat.some((q) => q.code === 'passage' && near(q.s, 4800, 1)), 'arrêt TC : passage piéton protégé au droit de l\'arrêt');
const portals = R.treat.filter((q) => q.code === 'portail');
ok(portals.length === 2 && portals.some((q) => near(q.s, 2000, 5.01) && q.dir === 1) && portals.some((q) => near(q.s, 3000, 5.01) && q.dir === -1), 'portail d\'entrée aux deux extrémités de la traversée (F1.12, F1.13)');
const bands = R.treat.filter((q) => q.code === 'bandes' && q.dir === 1 && q.s < 2000).map((q) => Math.round(2000 - q.s)).sort((a, b) => a - b);
ok(JSON.stringify(bands) === '[50,100,150]', 'bandes rugueuses à 150, 100 et 50 m en amont (F1.15)');
ok(R.treat.some((q) => q.code === 'annonce' && near(q.s, 1750, 5.01)), 'annonce à 250 m du portail');
ok(R.treat.some((q) => q.code === 'zone30' && near(q.s, 2300, 5.01)), 'entrée de zone 30 côté traversée');
ok(R.treat.filter((q) => q.code === 'passage' && q.s > 2000 && q.s < 3000).length >= 2, 'passages piétons répétés (≤ 200 m) dans la traversée');
ok(R.rows.some((r) => /Transition/.test(r.cat)), 'tableau E.4.2 : lignes de transition');
ok(rowsCsv([R]).split('\r\n').length === R.rows.length + 1, 'CSV E.4.2');
ok(speedSvg(R).startsWith('<svg'), 'diagramme SVG');
ok(R.checks.some((c) => /non crédible/.test(c.msg)), 'alignement droit en traversée : V85 géométrique > vitesse-cible + 10 signalée');

// retouches : suppression, déplacement, changement de panneau, ajout manuel — gardées après recalcul
{
  const inp = { baseCat: 'B', trav: [{ s0: 2000, s1: 3000 }], triggers: [{ id: 'e1', type: 'ecole', name: 'École A', x: 2500, y: 40 }] };
  const A = analyzeAxis(ax, inp, {});
  const ann = A.treat.find((q) => q.code === 'annonce' && q.dir === 1), por = A.treat.find((q) => q.code === 'portail' && q.dir === 1), pla = A.treat.find((q) => q.code === 'plateau' && q.trg === 'e1');
  const B = analyzeAxis(ax, { ...inp, edits: { del: [ann.key], mv: { [por.key]: 1950 }, sign: { [pla.key]: '' }, add: [{ id: 'm1', code: 'limite', v: 70, dir: 1, s: 1500 }] } }, {});
  ok(!B.treat.some((q) => q.code === 'annonce' && q.dir === 1 && Math.abs(q.s - ann.s) < 1) && B.removed.length === 1, 'retouche : aménagement supprimé (rétablissable)');
  ok(B.treat.some((q) => q.code === 'portail' && q.dir === 1 && q.s === 1950 && q.moved), 'retouche : portail déplacé au PK 1+950');
  ok(!B.treat.find((q) => q.code === 'plateau' && q.trg === 'e1').sign, 'retouche : panneau retiré');
  ok(B.treat.some((q) => q.manual === 'm1' && q.sign === 'B14-70' && q.s === 1500), 'ajout manuel : limitation 70 avec son panneau');
  // le tracé bouge de quelques mètres : les retouches suivent l'aménagement le plus proche (15 m)
  const C = analyzeAxis(ax, { ...inp, trav: [{ s0: 2008, s1: 3000 }], edits: { mv: { [por.key]: 1950 } } }, {});
  ok(C.treat.some((q) => q.code === 'portail' && q.dir === 1 && q.s === 1950), 'retouche gardée après un léger déplacement de la traversée');
}

// référentiel R4L (Banque mondiale) : liaison rurale 70, pôles d'activité à 30 (hors traversée aussi), carrefour à 50
{
  const inp = { trav: [{ s0: 2000, s1: 3000 }], triggers: [{ id: 't1', type: 'tc', x: 4800, y: -15 }], junctions: [1000] };
  const Q = analyzeAxis(ax, inp, { ref: 'R4L' });
  const at = (s) => Q.segs.find((g) => s >= g.s0 && s <= g.s1);
  ok(Q.baseCat === 'L70' && at(500).v === 70, 'R4L : route 2 voies sans séparateur → liaison rurale 70 km/h');
  ok(at(2500).v === 30 && at(2500).cat === 'HUB', 'R4L : traversée de village → pôle d\'activité humaine 30 km/h');
  ok(at(4800).v === 30, 'R4L : arrêt de bus hors village → 30 km/h (hop-on / hop-off)');
  ok(at(1000).v === 50 && at(1000).cat === 'IX' && Q.treat.some((q) => q.code === 'limite' && /carrefour/.test(q.label)), 'R4L : carrefour → approche à 50 km/h');
  const Qs = analyzeAxis(ax, inp, { ref: 'R4L', sep: true });
  ok(Qs.segs.find((g) => g.s0 <= 2500 && g.s1 >= 2500).v === 50, 'R4L : usagers vulnérables séparés → 50 km/h');
  const M = analyzeAxis(ax, inp, {});
  ok(M.segs.find((g) => g.s0 <= 1000 && g.s1 >= 1000).v === 50, 'M1 : carrefour → approche ≤ 50 km/h (AD 1.3)');
}

// remontée courte entre deux zones lentes supprimée
const R2 = analyzeAxis(straight(3000), { baseCat: 'B', trav: [{ s0: 500, s1: 1000 }, { s0: 1150, s1: 1700 }] }, {});
ok(R2.segs.filter((g) => g.cat === 'D').length === 1, 'deux traversées séparées de 150 m : une seule zone 50 (pas de yo-yo)');

// détection du bâti : bâtiments de part et d'autre entre 1 000 et 1 600 m, et 200 m isolés à 3 000 m
const bld = [];
for (let s = 1000; s <= 1600; s += 15) bld.push({ x: s, y: 25 }, { x: s + 5, y: -30 });
for (let s = 3000; s <= 3200; s += 15) bld.push({ x: s, y: 25 }, { x: s, y: -25 });
const B = detectBuilt(straight(5000), { bld }, {});
ok(B.length === 2 && B[0].trav && !B[1].trav, 'bâti continu ≥ 400 m → traversée ; 200 m isolés → non classés');

// OSM
ok(classifyOsm({ amenity: 'school' }) === 'ecole' && classifyOsm({ highway: 'bus_stop' }) === 'tc' && classifyOsm({ amenity: 'place_of_worship' }) === 'culte' && classifyOsm({ amenity: 'clinic' }) === 'sante' && classifyOsm({ amenity: 'marketplace' }) === 'marche' && classifyOsm({ amenity: 'bus_station' }) === 'gare' && classifyOsm({ amenity: 'bank' }) === null, 'classement des objets OSM');
const P = parseOverpass({ elements: [
  { type: 'node', id: 1, lat: 34.7, lon: 10.7, tags: { amenity: 'school', name: 'École' } },
  { type: 'node', id: 2, lat: 34.70100, lon: 10.70100, tags: { highway: 'bus_stop' } },
  { type: 'node', id: 3, lat: 34.70105, lon: 10.70105, tags: { public_transport: 'platform' } },
  { type: 'way', id: 4, center: { lat: 34.702, lon: 10.702 } },
  { type: 'way', id: 5, tags: { landuse: 'residential' }, geometry: [{ lat: 34.7, lon: 10.7 }, { lat: 34.71, lon: 10.7 }, { lat: 34.71, lon: 10.71 }] },
] });
ok(P.triggers.length === 2 && P.bld.length === 1 && P.built.length === 1, 'réponse Overpass : déclencheurs (arrêt TC dédoublonné), bâtiments, zones bâties');
ok(classifyName('Daara Serigne Touba') === 'ecole' && classifyName('Louma de Keur') === 'marche' && classifyName('Poste de santé') === 'sante' && classifyName('Garage des cars') === 'gare' && classifyName('Arrêt cars rapides') === 'tc', 'termes sénégalais (daara, louma, poste de santé, garage)');
ok(classifyName('Ecole primaire Sidi Mansour') === 'ecole' && classifyName('Souk hebdomadaire') === 'marche' && classifyName('جامع') === 'culte' && classifyName('Pont') === null, 'classement des repères KMZ par leur nom');
ok(/around:200,34\.700000,10\.700000/.test(overpassQL([[34.7, 10.7], [34.71, 10.71]])), 'requête Overpass le long de l\'axe');

// courbe : V85 lissée sous V0
const Rc = 200, curve = { key: 'x:1', name: 'Courbe', len: 600, at: (s) => { const a = s / Rc; return { p: { x: Rc * Math.sin(a), y: Rc * (1 - Math.cos(a)) }, t: { x: Math.cos(a), y: Math.sin(a) } }; }, project: () => null };
const pf = v85Profile(curve, { V0: 102 });
ok(Math.abs(pf[30].v - v85FromRadius(102, Rc)) < 1.5, 'V85 en courbe circulaire R = 200 m');

// requêtes Overpass par tronçon : rectangle englobant élargi de R, bâtiments à part
const bb = overpassBBoxOf([[18.08, -15.98], [18.10, -15.96]], 200);
ok(bb[0] < 18.08 && bb[2] > 18.10 && Math.abs(bb[0] - (18.08 - 200 / 111320)) < 1e-9 && bb[1] < -15.98 && bb[3] > -15.96, 'rectangle englobant du tronçon élargi de R');
const qp = overpassPoiQL(bb), qb = overpassBldQL([[18.08, -15.98], [18.10, -15.96]], 120);
ok(/timeout:60/.test(qp) && !/building/.test(qp) && !/around/.test(qp) && /amenity/.test(qp) && /landuse/.test(qp), 'requête légère sans bâtiments ni « around »');
ok(/way\["building"\]\(around:120,/.test(qb) && /out ids center/.test(qb), 'requête bâtiments séparée');

if (fail) { console.error(`${fail} échec(s)`); process.exit(1); }
console.log('Tous les tests UVR passent.');
