// Contrôle d'emprise (js/emprise.js) : distance signée bordure ↔ calque protégé, tronçons rouge / orange.
import { empriseObstacles, obstacleDist, empriseCheck, empriseMessages } from '../js/emprise.js';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('ÉCHEC', m); } };
// Bâtiment 10 × 10 (hachure) de x = 0 à 10, y = 3 à 13 ; un trou (cour) 4 × 4 au centre.
const geo = {
  polys: [{ layer: 'Bati_H', pts: new Float64Array([20, 3, 30, 3, 30, 13]), closed: false }],
  hatches: [{ layer: 'Bati_H', rings: [new Float64Array([0, 3, 10, 3, 10, 13, 0, 13]), new Float64Array([3, 6, 7, 6, 7, 10, 3, 10])] }],
};
const ob = empriseObstacles(geo, 'Bati_H');
ok(ob && ob.rings.length === 2, 'contours fermés recensés');
ok(Math.abs(obstacleDist(ob, 5, 0).d - 3) < 1e-9, 'distance 3 m sous le bâtiment');
ok(obstacleDist(ob, 5, 4).inside && Math.abs(obstacleDist(ob, 5, 4).d + 1) < 1e-9, 'intérieur : distance négative');
ok(!obstacleDist(ob, 5, 8).inside, 'cour (trou de hachure) hors obstacle');
ok(Math.abs(obstacleDist(ob, 25, 1).d - 2) < 1e-9, 'polyligne ouverte : distance au segment');
ok(empriseObstacles(geo, 'Autre') === null, 'calque absent');
// Bordure y = 1 de x = −10 à 40 : trottoir = 2 − 0,4 = 1,6 m (orange) devant le bâtiment et la polyligne,
// bordure y = 2,5 : 0,1 m (rouge).
const D = (y) => ({ prims: [{ k: 'path', L: 'BORDURE', segs: [{ t: 'L', a: { x: -10, y }, b: { x: 40, y } }] }] });
let r = empriseCheck([{ D: D(1), name: 'a' }], ob, { ded: 0.4, min: 1.5, want: 2.5 });
ok(r.nErr === 0 && r.nWarn === 2, `deux tronçons orange (${r.nErr}/${r.nWarn})`);
ok(Math.abs(r.worst - 1.6) < 1e-9, `trottoir mini 1,60 m (${r.worst})`);
const L = r.runs.map((q) => q.len).sort((a, b) => a - b);
ok(Math.abs(L[1] - 14.8) < 1.1, `longueur du tronçon devant le bâtiment ≈ 14,8 m (${L[1]})`);
r = empriseCheck([{ D: D(2.5), name: 'a' }], ob, { ded: 0.4, min: 1.5, want: 2.5 });
ok(r.nErr === 2 && r.runs.filter((q) => q.lvl === 'err').every((q) => q.min < 1.5), 'rouge au plus près, orange aux transitions');
const M = empriseMessages(r, 'Bati_H', { min: 1.5, want: 2.5 });
ok(M[0].lvl === 'err' && /0,10 m < 1,50 m/.test(M[0].msg) && /2 tronçons/.test(M[0].msg), M.map((m) => m.msg).join(' | '));
r = empriseCheck([{ D: D(-5), name: 'a' }], ob, { ded: 0.4 });
ok(!r.runs.length && empriseMessages(r, 'Bati_H')[0].lvl === 'info', 'tout conforme : info');
if (fails) { console.error(`${fails} échec(s)`); process.exit(1); }
console.log('test-emprise : OK');
