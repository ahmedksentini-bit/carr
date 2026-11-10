// Raccordement d'une branche aux limites de chaussée (js/tiein.js).
import { nearestOnDxf, tieSection, tieLanes, tieAxis } from '../js/tiein.js';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('ÉCHEC', m); } };
const near = (a, b, t = 1e-6) => Math.abs(a - b) < t;
// Rue existante orientée à 30°, bords à ±4,3 m de son axe (largeur 8,6 m), le carrefour au sud-ouest (origine).
const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6), at = (u, v) => [u * c - v * s + 0, u * s + v * c];
const edge = (v, u0, u1) => ({ layer: 'T2', pts: new Float64Array([...at(u0, v), ...at(u1, v)]), closed: false });
const geo = { polys: [edge(4.3, 30, 90), edge(-4.3, 35, 80)], layers: new Map() };
const p1 = at(50, 4.6), p2 = at(56, -4.0);
const e1 = nearestOnDxf(geo, { x: p1[0], y: p1[1] }), e2 = nearestOnDxf(geo, { x: p2[0], y: p2[1] });
ok(e1 && near(e1.d, 0.3, 1e-9) && e2 && near(e2.d, 0.3, 1e-9), 'bords trouvés à 0,30 m');
ok(nearestOnDxf(geo, { x: 0, y: 50 }) === null, 'rien loin des traits');
const O = { x: 0, y: 0 };
const T = tieSection(e1, e2, O);
ok(!T.error && near(T.w, 8.6, 1e-6), `largeur perpendiculaire 8,60 m (${T.w})`);
const Mx = at(50, 0);
ok(near(T.M.x, Mx[0], 1e-6) && near(T.M.y, Mx[1], 1e-6), 'milieu au droit du premier clic, sur l\'axe de la rue');
ok(near(T.t.x, c, 1e-9) && near(T.t.y, s, 1e-9), 'direction vers l\'extérieur du carrefour');
// même bord cliqué deux fois, bords non parallèles
ok(!!tieSection(e1, nearestOnDxf(geo, { x: at(60, 4.4)[0], y: at(60, 4.4)[1] }), O).error, 'même bord : refus');
const g2 = { polys: [edge(4.3, 30, 90), { layer: 'X', pts: new Float64Array([0, 0, 0, 100]), closed: false }], layers: new Map() };
ok(!!tieSection(nearestOnDxf(g2, { x: p1[0], y: p1[1] }), nearestOnDxf(g2, { x: 0.2, y: 40 }), O).error, 'bords non parallèles : refus');
// largeurs : double sens, surlargeur en BDD
const L1 = tieLanes(8.6), L2 = tieLanes(5.4), L3 = tieLanes(15.1), L4 = tieLanes(15, 2, 2);
ok(L1.wLane === 3.5 && near(L1.bdd, 0.8), `8,6 m → 2 × 3,50 + 2 × 0,80 (${JSON.stringify(L1)})`);
ok(L2.wLane === 2.7 && L2.bdd === 0, '5,4 m → 2 × 2,70');
ok(L3.wLane === 3.5 && near(L3.bdd, 4.05), '15,1 m → 2 × 3,50 + 2 × 4,05');
ok(L4.wLane === 3.75 && L4.bdd === 0, '15 m en 2 + 2 voies → 4 × 3,75');
// axe : prolongement, M, sommets en deçà de M conservés (rayon compris), au-delà supprimés
const ax = [{ x: at(80, 0)[0], y: at(80, 0)[1] }, { x: at(65, 1)[0], y: at(65, 1)[1] }, { x: at(30, 0)[0], y: at(30, 0)[1], r: 25 }, { x: 5, y: 5 }];
const A = tieAxis(ax, T.M, T.t, O);
ok(A.length === 4 && near(A[1].x, T.M.x, 1e-3) && A[2].r === 25, `axe [M+10, M, sommets intérieurs] (${A.length})`);
ok(near(Math.hypot(A[0].x - A[1].x, A[0].y - A[1].y), 30, 1e-3), 'prolongement de 30 m');
if (fails) { console.error(`${fails} échec(s)`); process.exit(1); }
console.log('test-tiein : OK');
