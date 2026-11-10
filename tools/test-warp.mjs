// Approche en courbe : repère local enroulé sur un axe courbe (warpFrame).
import * as G from '../js/geom.js';
import { warpFrame, frame } from '../js/common.js';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('ÉCHEC', m); } };
const O = { x: 0, y: 0 }, u = { x: 1, y: 0 }, xs = 30, R = 80;
// axe : arc de rayon 80 à gauche, tangent à u en (30, 0), puis droite
const C = G.roundPolyline([{ x: xs, y: 0 }, { x: xs + 60, y: 0 }, { x: xs + 60 + 80 * Math.cos(Math.PI / 3), y: 80 * Math.sin(Math.PI / 3) }], [0, R, 0]);
const F = warpFrame(O, u, C, xs), F0 = frame(O, u);
// identique au repère droit avant xs
for (const p of [{ x: 10, y: 3 }, { x: 29.9, y: -4 }]) ok(G.dist(F.W(p), F0.W(p)) < 1e-9, 'avant xs');
// continuité à xs, axe local y = 0 sur C, décalage y à distance |y| de C
const L = G.pathLen(C);
for (const s of [0.3, 10, 40, L - 1]) {
  const P = G.pathPointAt(C, s), Q = F.W({ x: xs + s, y: 0 });
  ok(G.dist(P, Q) < 0.05, `axe à s = ${s} : écart ${G.dist(P, Q)}`);
  const Y = F.W({ x: xs + s, y: 5 }), d = Math.min(...C.flatMap((sg) => Array.from({ length: 401 }, (_, i) => G.dist(G.segAt(sg, i / 400), Y))));
  ok(Math.abs(d - 5) < 0.05, `décalage 5 m à s = ${s} : ${d}`);
}
// inverse
for (const p of [{ x: 45, y: 3 }, { x: 80, y: -6 }, { x: xs + L + 12, y: 2 }]) { const q = F.toL(F.W(p)); ok(Math.abs(q.x - p.x) < 0.05 && Math.abs(q.y - p.y) < 0.05, `toL(W(${p.x}, ${p.y})) = ${q.x}, ${q.y}`); }
// Wp : un segment local traversant xs suit la courbe
const seg = F.Wp([G.L({ x: 0, y: 0 }, { x: xs + 50, y: 0 })]);
ok(Math.abs(G.pathLen(seg) - (xs + 50)) < 0.1, `longueur enroulée ${G.pathLen(seg)}`);
// pathTail
const T = G.pathTail(C, 20);
ok(Math.abs(G.pathLen(T) - (L - 20)) < 1e-6 && G.dist(G.segStart(T[0]), G.pathPointAt(C, 20)) < 1e-6, 'pathTail');
console.log(fails ? `${fails} échec(s)` : 'warp : tous les contrôles passent');
process.exit(fails ? 1 : 0);
