// Rayon unique quand Re (branche i) et Rs (branche suivante) se chevauchent (fuseFillets, js/roundabout.js).
import * as G from '../js/geom.js';
import { buildDesign, RFUS } from '../js/roundabout.js';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('ÉCHEC', m); } };
const br = (name, deg) => { const a = (deg * Math.PI) / 180; return { id: name, name, radial: true, nIn: 1, nOut: 1, island: { type: 'aucun' }, tpc: { on: false }, wLane: 3, le: 3.5, ls: 4, Re: 12, Rs: 15, axis: [{ x: 90 * Math.cos(a), y: 90 * Math.sin(a) }, { x: 25 * Math.cos(a), y: 25 * Math.sin(a) }] }; };
const prj = (angles, ring = {}) => ({ kind: 'giratoire', context: 'urbain', center: { auto: false, x: 0, y: 0 }, ring: { Rg: 15, la: 7, bf: 1.5, shape: 'cercle', ...ring }, section: {}, opts: { vis: {} }, traffic: {}, branches: angles.map((d, i) => br('B' + i, d)) });
// Branches à 0° et 35° : Re de B0 et Rs de B1 se chevauchent → rayon unique.
let D = buildDesign(prj([0, 35, 180, 270]));
const f = D.branches[0].entry.fused;
ok(f && D.branches[1].exit.fused === f, 'rayon unique porté par l\'entrée de B0 et la sortie de B1');
ok(!D.issues.some((q) => q.lvl === 'err' && /se chevauchent/.test(q.msg)), 'plus d\'erreur de chevauchement');
if (f) {
  ok(Math.abs(G.dist(f.C, f.T1) - f.R) < 0.02 && Math.abs(G.dist(f.C, f.T2) - f.R) < 0.02, 'arc tangent aux deux rives');
  ok(f.R >= RFUS - 1e-6 || f.limited, `rayon ≥ minimum bus (${f.R})`);
  if (f.onRing) ok(Math.abs(G.dist(f.C, D.O) - (f.R + 15)) < 0.02, 'tangent à la rive de l\'anneau');
  else ok(G.dist(f.C, D.O) > f.R + 15, 'en retrait de l\'anneau');
  // bordure continue dans le secteur : fin du bord d'entrée = début de la sortie de B1 (sens inverse)
  const e1 = D.branches[0].entry.edgeW, e2 = D.branches[1].exit.edgeW;
  ok(G.dist(G.segEnd(e1[e1.length - 1]), G.segEnd(e2[e2.length - 1])) < 1e-3, 'bord de chaussée continu');
}
// Minimum bas : le rayon tangent à l'anneau est retenu.
D = buildDesign(prj([0, 35, 180, 270], { Rfus: 1 }));
const g = D.branches[0].entry.fused;
ok(g && g.onRing && Math.abs(G.dist(g.C, D.O) - (g.R + 15)) < 0.02, `rayon tangent à l'anneau retenu (${g && g.R})`);
// Branches bien séparées : Re / Rs inchangés.
D = buildDesign(prj([0, 90, 180, 270]));
ok(D.branches.every((b) => !b.entry.fused && !b.exit.fused), 'pas de fusion sans chevauchement');
// Rayon unique demandé (fuseNext) entre deux branches bien séparées : arc tangent à l'anneau.
{
  const P = prj([0, 90, 180, 270]); P.branches[0].fuseNext = true;
  D = buildDesign(P);
  const h = D.branches[0].entry.fused;
  ok(h && D.branches[1].exit.fused === h && h.onRing, `fusion demandée, tangente à l'anneau (${h && h.R})`);
  ok(D.branches.slice(1).every((b) => !b.entry.fused), 'autres secteurs inchangés');
}
if (fails) { console.error(`${fails} échec(s)`); process.exit(1); }
console.log('test-fuse : OK');
