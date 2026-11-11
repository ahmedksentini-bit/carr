// Import d'un axe depuis une polyligne serrée (js/axisimport.js) — node tools/test-axisimport.mjs
import { buildAlignment } from '../js/clotho.js';
import { axisFromPolyline } from '../js/axisimport.js';
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.error('✖', m); } else console.log('✔', m); };
// axe de référence : 3 sommets intérieurs, R 400 / 250 / 600 m, clothoïdes 60 / 50 / 0 m (A = √(L R))
const V = [{ x: 0, y: 0, R: 0, A: 0 }, { x: 800, y: 0, R: 400, A: Math.sqrt(60 * 400) }, { x: 1300, y: 500, R: 250, A: Math.sqrt(50 * 250) }, { x: 2000, y: 450, R: 600, A: 0 }, { x: 2600, y: 900, R: 0, A: 0 }];
const al = buildAlignment(V, { name: 'réf' });
const L = al.elems.reduce((a, e) => a + e.len, 0), pts = [];
for (let s = 0; s <= L; s += 5) { const e = al.elems.find((q) => s >= q.s0 - 1e-9 && s <= q.s0 + q.len + 1e-9); const p = e.pointAt(s - e.s0); pts.push([p.x, p.y]); }
const r = axisFromPolyline(pts);
console.log(r.axis.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)} R${q.r} lc${q.lc}`).join(' | '), 'écart', r.ecart.toFixed(3));
ok(r.axis.length === 5 && r.virages === 3, '3 virages → 3 sommets intérieurs');
const near = (a, b, t) => Math.abs(a - b) <= t;
[[1, 400, 60], [2, 250, 50], [3, 600, 0]].forEach(([i, R, lc]) => {
  const q = r.axis[i];
  ok(Math.hypot(q.x - V[i].x, q.y - V[i].y) < 3, `sommet ${i} retrouvé à moins de 3 m`);
  ok(near(q.r, R, R * 0.03), `sommet ${i} : R ≈ ${R} m (trouvé ${q.r})`);
  ok(near(q.lc, lc, 8), `sommet ${i} : clothoïde ≈ ${lc} m (trouvé ${q.lc})`);
});
ok(r.ecart < 0.5, 'écart des points à l\'axe reconstitué < 0,5 m');
const st = axisFromPolyline([[0, 0], [100, 1e-9], [500, 0]]);
ok(st.axis.length === 2, 'ligne droite : deux sommets');
if (fail) { console.error(`${fail} échec(s)`); process.exit(1); }
console.log('Import d\'axe : tous les tests passent.');
