// test-worldcover.mjs — couverture végétale ESA WorldCover (js/hydro/worldcover.js), sans réseau.
// Le décodage des tuiles et l'analyse des capabilities (DOMParser) sont vérifiés dans le navigateur.
import { wcMatch, wcCompose, wcEstimateAreaKm2, WC_CLASSES } from '../js/hydro/worldcover.js';
let fail = 0;
const check = (l, ok, got = '') => { if (!ok) fail++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${l.padEnd(64)} ${got}`); };
// légende contrôlée sur tuile réelle (BVTrace) : F096FF cultures, FFFF4C prairies, 006400 forêt, FFBB22 arbustes, FA0000 bâti, B4B4B4 sol nu
check('cultures F096FF', wcMatch(0xf0, 0x96, 0xff)?.code === 40);
check('prairies FFFF4C', wcMatch(0xff, 0xff, 0x4c)?.code === 30);
check('sol nu B4B4B4 non végétal', wcMatch(0xb4, 0xb4, 0xb4)?.veg === false);
check('ré-encodage léger toléré', wcMatch(0x03, 0x60, 0x02)?.code === 10);
check('couleur hors légende : inconnue (pas de plus proche voisin)', wcMatch(0x80, 0x40, 0x20) === null);
check('11 classes', WC_CLASSES.length === 11);
// composition : dénominateur = surface totale, eau et bâti compris
const r = wcCompose(new Map([[10, 30], [40, 20], [60, 40], [80, 10]]), 0, 10, 100, 't');
check('végétation = (forêt + cultures) / total', r.ok && Math.abs(r.coverPct - 50) < 1e-9, r.coverPct);
check('détail trié', r.breakdown[0].code === 60 && r.breakdown.length === 4);
const bad = wcCompose(new Map([[10, 90]]), 10, 10, 100, 't');
check('> 5 % d\'inconnus : refus motivé', !bad.ok && /aucune classe connue/.test(bad.reason), bad.reason?.slice(0, 40));
check('4 % d\'inconnus accepté', wcCompose(new Map([[10, 96]]), 4, 10, 100, 't').ok);
check('aucun pixel : refus', !wcCompose(new Map(), 0, 10, 0, 't').ok);
// surface balayée ≈ surface géodésique (carré de 0,02° vers 35° N)
const R = 6371008.8, rad = Math.PI / 180;
const sq = (lon0, lat0, d) => [{ lon: lon0, lat: lat0 }, { lon: lon0 + d, lat: lat0 }, { lon: lon0 + d, lat: lat0 + d }, { lon: lon0, lat: lat0 + d }];
const geod = (lat0, d) => R * R * d * rad * (Math.sin((lat0 + d) * rad) - Math.sin(lat0 * rad)) / 1e6;
const A = geod(35, 0.02), a1 = wcEstimateAreaKm2([sq(10, 35, 0.02)]);
check('carré 0,02° à 35° N : surface balayée', Math.abs(a1 - A) / A < 0.005, `${a1.toFixed(4)} / ${A.toFixed(4)} km²`);
const a2 = wcEstimateAreaKm2([sq(10, 35, 0.02), sq(10.005, 35.005, 0.01)]);
const A2 = A - geod(35.005, 0.01);
check('trou soustrait (pair-impair)', Math.abs(a2 - A2) / A2 < 0.01, `${a2.toFixed(4)} / ${A2.toFixed(4)} km²`);
const a3 = wcEstimateAreaKm2([sq(10, 35, 0.01), sq(10.05, 35, 0.01)]);
check('morceaux disjoints additionnés', Math.abs(a3 - 2 * geod(35, 0.01)) / (2 * geod(35, 0.01)) < 0.01, `${a3.toFixed(4)} km²`);
console.log(fail ? `\n${fail} échec(s)` : '\nTous les contrôles passent.');
process.exit(fail ? 1 : 0);
