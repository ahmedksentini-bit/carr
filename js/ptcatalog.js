// ptcatalog.js — catalogue de demi-profils en travers types prédéfinis (bibliothèque du projet, ptype.js) :
// urbain et rural (interurbain), chaussée bidirectionnelle (axe au milieu) ou à chaussées séparées (axe au milieu du
// TPC), stationnement longitudinal ou en bataille, caniveau CS2 / CC2, bordures T1 à T4, trottoir 2,50 m (1,50 m
// minimum), bande dérasée et accotement, accotement revêtu, BAU, bermes, fossé en déblai, TPC au niveau de la
// chaussée (revêtu, au dévers), TPC surélevé entre bordures, TPC creux déversé vers un caniveau CC2 central, TPC
// engazonné.
//
// Dimensions des bordures et caniveaux : profils de la norme NF P 98-340/CN (complément national à la NF EN 1340), d'après
// les fiches des fabricants — T1 12 × 20 cm, T2 15 × 25, T3 17 × 28, T4 20 × 30 ; CS1 20 × 12, CS2 25 × 13 (simple
// pente) ; CC1 40 × 12, CC2 50 × 14 (double pente). La vue (saillie au-dessus du fil d'eau) est une valeur de pose
// usuelle, à adapter au projet : T1 10 cm, T2 14 cm, T3 16 cm, T4 18 cm. Pentes : caniveau simple pente 5 % vers la
// bordure, double pente 6 % vers le fil d'eau central, trottoir 2 % vers la chaussée, accotement non revêtu 4 %,
// berme 8 %, TPC surélevé 2 %, TPC creux et engazonné 4 % vers le centre. Talus 3/2 en remblai, 1/1 en déblai.
import { consFromBands, defaultLayers, layersDepth } from './ptype.js';

export const CURBS = { T1: { w: 0.12, h: 0.20, vue: 0.10 }, T2: { w: 0.15, h: 0.25, vue: 0.14 }, T3: { w: 0.17, h: 0.28, vue: 0.16 }, T4: { w: 0.20, h: 0.30, vue: 0.18 } };
export const GUTTERS = { CS2: { w: 0.25, kind: 'simple' }, CC2: { w: 0.50, kind: 'double' } };
const f = (v) => String(v.toFixed(2)).replace('.', ',');

// Bandes d'un caniveau (fil d'eau au pied de la bordure pour CS, au milieu pour CC)
const gutter = (g) => (GUTTERS[g].kind === 'simple'
  ? [{ w: GUTTERS[g].w, code: g, mode: 'fixe', p: -5, zone: 'CANIVEAU', arase: true }]
  : [{ w: GUTTERS[g].w / 2, code: `${g} (fil d'eau)`, mode: 'fixe', p: -6, zone: 'CANIVEAU', arase: true }, { w: GUTTERS[g].w / 2, code: g, mode: 'fixe', p: 6, zone: 'CANIVEAU', arase: true }]);
// Bordure vue depuis la chaussée : face verticale (vue), tête de la bordure
const curb = (t) => [{ w: 0, dz: CURBS[t].vue, code: `Bordure ${t} (vue ${f(CURBS[t].vue)})`, zone: 'BORDURE' }, { w: CURBS[t].w, code: `Tête ${t}`, mode: 'fixe', p: 0, zone: 'BORDURE' }];
const lanes = (n, w, code = 'Voie') => Array.from({ length: n }, (_, i) => ({ w, code: n > 1 ? `${code} ${i + 1}` : code, mode: 'devers', zone: 'CHAUSSEE', arase: true }));

// Partie urbaine extérieure : stationnement, caniveau, bordure, trottoir
function urbanEdge(o) {
  const b = [];
  if (o.park === 'long') b.push({ w: 2.0, code: 'Stationnement longitudinal', mode: 'devers', zone: 'STATIONNEMENT', arase: true });
  if (o.park === 'bataille') b.push({ w: 5.0, code: 'Stationnement en bataille', mode: 'devers', zone: 'STATIONNEMENT', arase: true });
  if (o.gut !== 'sans') b.push(...gutter(o.gut));
  b.push(...curb(o.curb));
  b.push({ w: o.trot, code: 'Trottoir', mode: 'fixe', p: 2, zone: 'TROTTOIR' });
  return b;
}
// TPC (demi-largeur depuis l'axe du TPC) : { bands, z0 }
function tpcBands(type, half, curbT = 'T2') {
  if (type === 'niveau') return { z0: 0, bands: [{ w: half, code: 'TPC revêtu (au dévers)', mode: 'devers', zone: 'TPC', arase: true }] };
  if (type === 'bordure') {
    const C = CURBS[curbT], top = Math.max(0.2, half - C.w), z0 = C.vue + 0.02 * top; // dessus du TPC à 2 %, fil d'eau au niveau de la chaussée
    return { z0, bands: [{ w: top, code: 'TPC surélevé', mode: 'fixe', p: -2, zone: 'TPC' }, { w: C.w, code: `Tête ${curbT}`, mode: 'fixe', p: 0, zone: 'BORDURE' }, { w: 0, dz: -C.vue, code: `Bordure ${curbT} (vue ${f(C.vue)})`, zone: 'BORDURE' }] };
  }
  if (type === 'creux') { // TPC déversé vers un caniveau CC2 central (fil d'eau sur l'axe)
    const g = GUTTERS.CC2.w / 2, rest = Math.max(0.2, half - g), z0 = -(g * 0.06 + rest * 0.04);
    return { z0, bands: [{ w: g, code: 'CC2 central', mode: 'fixe', p: 6, zone: 'CANIVEAU', arase: true }, { w: rest, code: 'TPC déversé vers le CC2', mode: 'fixe', p: 4, zone: 'TPC', arase: true }] };
  }
  // engazonné : cuvette à 4 % vers le centre, sans revêtement
  return { z0: -half * 0.04, bands: [{ w: half, code: 'TPC engazonné', mode: 'fixe', p: 4, zone: 'TPC' }] };
}
const TPC_LBL = { niveau: 'TPC au niveau (revêtu, au dévers)', bordure: 'TPC surélevé entre bordures T2', creux: 'TPC creux déversé vers caniveau CC2', engazonne: 'TPC engazonné' };

function build(name, bands, o = {}) {
  const layers = defaultLayers();
  return { name, layers, cons: consFromBands(bands, { remblai: 1.5, deblai: 1, fosse: o.fosse || 0, fosseW: 1.5, depth: layersDepth(layers), z0: o.z0 || 0 }) };
}

// Catalogue : [{ key, ctx, axe, tags { … }, name, make() → { name, layers, cons } }]
export function catalog() {
  const out = [];
  const push = (key, ctx, axe, tags, name, make) => out.push({ key, ctx, axe, tags, name, make });
  // ---------- urbain, chaussée bidirectionnelle (axe au milieu de la chaussée)
  for (const v of [3.0, 3.25, 3.5]) for (const park of ['sans', 'long', 'bataille']) for (const gut of ['sans', 'CS2', 'CC2']) for (const c of ['T1', 'T2', 'T3', 'T4']) for (const trot of [2.5, 1.5]) {
    const name = `U · voie ${f(v)}${park === 'long' ? ' · stat. long. 2,00' : park === 'bataille' ? ' · stat. bataille 5,00' : ''}${gut !== 'sans' ? ` · ${gut}` : ''} · ${c} · trottoir ${f(trot)}`;
    push(`u1-${v}-${park}-${gut}-${c}-${trot}`, 'urbain', 'bidirectionnelle', { voies: `1 × ${f(v)}`, park, gut, curb: c, trot: f(trot), tpc: 'sans' }, name,
      () => build(name, [...lanes(1, v), ...urbanEdge({ park, gut, curb: c, trot })]));
  }
  // ---------- urbain, 2 × 2 voies avec TPC (axe au milieu du TPC)
  for (const tpc of ['niveau', 'bordure', 'creux']) for (const v of [3.0, 3.25, 3.5]) for (const park of ['sans', 'long']) for (const gut of ['CS2', 'CC2']) for (const c of ['T2', 'T3']) for (const trot of [2.5, 1.5]) {
    const half = tpc === 'bordure' ? 1.0 : 0.75, T = tpcBands(tpc, half);
    const name = `U · 2×2 · ${TPC_LBL[tpc].replace(' entre bordures T2', ' (T2)')} ${f(2 * half)} · 2 × ${f(v)}${park === 'long' ? ' · stat. long. 2,00' : ''} · ${gut} · ${c} · trottoir ${f(trot)}`;
    push(`u2-${tpc}-${v}-${park}-${gut}-${c}-${trot}`, 'urbain', 'TPC', { voies: `2 × ${f(v)}`, park, gut, curb: c, trot: f(trot), tpc }, name,
      () => build(name, [...T.bands, ...lanes(2, v), ...urbanEdge({ park, gut, curb: c, trot })], { z0: T.z0 }));
  }
  // ---------- rural, chaussée bidirectionnelle
  const RB = {
    bdd25: { lbl: 'BDD 0,25 + accotement 1,75', b: [{ w: 0.25, code: 'BDD', mode: 'devers', zone: 'CHAUSSEE', arase: true }, { w: 1.75, code: 'Accotement non revêtu', mode: 'fixe', p: -4, zone: 'ACCOTEMENT', arase: true }] },
    bdd50: { lbl: 'BDD 0,50 + accotement 2,00', b: [{ w: 0.5, code: 'BDD', mode: 'devers', zone: 'CHAUSSEE', arase: true }, { w: 2.0, code: 'Accotement non revêtu', mode: 'fixe', p: -4, zone: 'ACCOTEMENT', arase: true }] },
    accrev: { lbl: 'accotement revêtu 2,00', b: [{ w: 2.0, code: 'Accotement revêtu', mode: 'devers', zone: 'ACCOTEMENT', arase: true }] },
    bau25: { lbl: 'BAU 2,50', b: [{ w: 2.5, code: 'BAU', mode: 'devers', zone: 'BAU', arase: true }] },
    bau30: { lbl: 'BAU 3,00', b: [{ w: 3.0, code: 'BAU', mode: 'devers', zone: 'BAU', arase: true }] },
  };
  const berm = (bm) => (bm ? [{ w: bm, code: 'Berme', mode: 'fixe', p: -8, zone: 'BERME' }] : []);
  for (const v of [3.0, 3.25, 3.5]) for (const bd of ['bdd25', 'bdd50', 'accrev', 'bau25']) for (const bm of [0, 0.75, 1.0]) for (const fo of [0, 0.5]) {
    const name = `R · voie ${f(v)} · ${RB[bd].lbl}${bm ? ` · berme ${f(bm)}` : ' · sans berme'}${fo ? ' · fossé 0,50' : ''}`;
    push(`r1-${v}-${bd}-${bm}-${fo}`, 'rural', 'bidirectionnelle', { voies: `1 × ${f(v)}`, bord: bd, berme: bm ? f(bm) : 'sans', fosse: fo ? 'oui' : 'non', tpc: 'sans' }, name,
      () => build(name, [...lanes(1, v), ...RB[bd].b, ...berm(bm)], { fosse: fo }));
  }
  // ---------- rural, chaussées séparées (2 × 2, 2 × 3 voies)
  for (const tpc of ['niveau', 'bordure', 'creux', 'engazonne']) for (const bdg of [0.5, 1.0]) for (const n of [2, 3]) for (const bd of ['bau25', 'bau30', 'bdd25']) for (const bm of [0, 1.0]) for (const fo of [0, 0.5]) {
    const half = tpc === 'engazonne' ? 2.5 : tpc === 'bordure' ? 1.0 : 0.75, T = tpcBands(tpc, half);
    const name = `R · 2×${n} · ${TPC_LBL[tpc].replace(' entre bordures T2', ' (T2)')} ${f(2 * half)} · BDG ${f(bdg)} · ${n} × 3,50 · ${RB[bd].lbl}${bm ? ` · berme ${f(bm)}` : ' · sans berme'}${fo ? ' · fossé 0,50' : ''}`;
    push(`r2-${tpc}-${bdg}-${n}-${bd}-${bm}-${fo}`, 'rural', 'TPC', { voies: `${n} × 3,50`, bord: bd, berme: bm ? f(bm) : 'sans', fosse: fo ? 'oui' : 'non', tpc, bdg: f(bdg) }, name,
      () => build(name, [...T.bands, { w: bdg, code: 'BDG', mode: 'devers', zone: 'CHAUSSEE', arase: true }, ...lanes(n, 3.5), ...RB[bd].b, ...berm(bm)], { z0: T.z0, fosse: fo }));
  }
  return out;
}
