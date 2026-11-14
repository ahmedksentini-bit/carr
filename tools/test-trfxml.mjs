// Tests de js/trfxml.js : éléments exacts → sommets (aller-retour avec clotho.js), lecture d'un TRF Piste.
import { buildAlignment } from '../js/clotho.js';
import { elementsToAxis, densePoints, parseTRF, rasanteToPis, axisEcart } from '../js/trfxml.js';
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.error('ÉCHEC', m); } };
// axe de référence : 4 sommets, deux virages (gauche R 400 + clothoïdes 80 m, droite R 250 sans clothoïde)
const pis = [{ x: 0, y: 0 }, { x: 600, y: 0, R: 400, A: Math.sqrt(80 * 400) }, { x: 1000, y: 420, R: 250 }, { x: 1600, y: 380 }];
const al = buildAlignment(pis);
const els = al.elems.map((e) => {
  const a = e.pointAt(0), b = e.pointAt(e.len);
  if (e.kind === 'L') return { type: 'line', a, b, len: e.len };
  if (e.kind === 'A') return { type: 'arc', a, b, c: e.C, r: e.R, len: e.len };
  return { type: 'clo', a, b, len: e.len, r: e.R, entry: !e.out };
});
const R = elementsToAxis(els);
ok(R.axis.length === 4, `4 sommets (${R.axis.length})`);
const near = (p, q, tol) => Math.hypot(p.x - q.x, p.y - q.y) < tol;
ok(near(R.axis[1], pis[1], 0.05) && near(R.axis[2], pis[2], 0.05), `sommets retrouvés (${JSON.stringify(R.axis.slice(1, 3))})`);
ok(Math.abs(R.axis[1].r - 400) < 0.01 && Math.abs(R.axis[1].lc - 80) < 0.01, `R 400 / lc 80 (${R.axis[1].r} / ${R.axis[1].lc})`);
ok(Math.abs(R.axis[2].r - 250) < 0.01 && !R.axis[2].lc, `R 250 sans clothoïde (${R.axis[2].r} / ${R.axis[2].lc})`);
// écart entre la géométrie du « fichier » et l'axe reconstitué
const dmax = axisEcart(R.axis, els);
ok(dmax < 0.02, `écart < 2 cm (${dmax.toFixed(3)})`);
// TRF minimal : axe (droite + cercle) et profil en long (droite, parabole, droite)
const pad = (v, n) => String(v).padStart(n);
const trf = [
  `${pad(3, 3)}   400${pad(2, 4)}`,
  `1      00${pad('0', 23)}${pad('0', 23)}${pad('0', 23)}`, ' 1000.0 0.0 0.0 1100.0 100.0 0.0',
  `2      00${pad('100.0', 23)}${pad('200.0', 23)}${pad('200.0', 23)}`, ' 1100.0 100.0 0.0 1414.159 300.0 200.0',
  `${pad(4, 3)}   400${pad(3, 4)}`,
  '1D1 1000.0 10.0 1150.0 13.0 2.0',
  '2D2 1150.0 13.0 1250.0 13.0 -2500.0 1200.0 13.5',
  '1D3 1250.0 13.0 1414.159 9.717 -2.0',
].join('\n');
const T = parseTRF(trf);
ok(T.elements.length === 2 && T.elements[1].type === 'arc' && Math.abs(T.elements[1].r - 200) < 1e-9, `TRF : axe lu (${T.note})`);
const A2 = elementsToAxis(T.elements);
ok(A2.axis.length === 3 && Math.abs(A2.axis[1].r - 200) < 0.01 && near(A2.axis[1], { x: 300, y: 0 }, 0.05), `TRF : sommet du quart de cercle (${JSON.stringify(A2.axis[1])})`);
const pl = rasanteToPis(T.rasante, 1000);
ok(pl.length === 3 && Math.abs(pl[1].s - 200) < 0.01 && Math.abs(pl[1].z - 14) < 0.01 && pl[1].R === 2500, `TRF : PIV (${JSON.stringify(pl)})`);
console.log(fail ? `${fail} échec(s)` : 'test-trfxml : OK'); process.exit(fail ? 1 : 0);
