// Rayon unique quand Re (branche i) et Rs (branche suivante) se chevauchent (fuseFillets, js/roundabout.js).
import * as G from '../js/geom.js';
import { buildDesign, RFUS } from '../js/roundabout.js';
import { empriseObstacles } from '../js/emprise.js';
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
// Bâti protégé : un bloc posé juste derrière l'arc de 12,50 m → rayon choisi pour que la bordure reste dehors.
{
  const D0 = buildDesign(prj([0, 35, 180, 270])), f0 = D0.branches[0].entry.fused;
  const e = f0.edge1[f0.edge1.length - 1], m = G.segAt(e, 0.5), out = G.norm(G.sub(m, f0.C)); // côté terrain : vers le centre de l'arc
  const c = G.add(m, G.mul(out, -1.0)); // bloc à 1 m derrière la bordure, côté terrain
  const sq = (c, h) => new Float64Array([c.x - h, c.y - h, c.x + h, c.y - h, c.x + h, c.y + h, c.x - h, c.y + h]);
  const ob = empriseObstacles({ polys: [], hatches: [{ layer: 'B', rings: [sq(c, 0.5)] }] }, 'B');
  const D1 = buildDesign(prj([0, 35, 180, 270]), { keep: { ob, ded: 0.4, min: 0.8, layer: 'B' } }), f1 = D1.branches[0].entry.fused;
  ok(f1 && !f1.intrude && f1.avail >= 0.8 - 1e-6 && Math.abs(f1.R - f0.R) > 0.2, `rayon modifié pour 0,80 m de trottoir (${f1 && f1.R} / ${f0.R}, ${f1 && f1.avail})`);
  ok(D1.issues.some((q) => /hors du calque B/.test(q.msg)), 'message de rayon choisi hors du bâti');
}
// Passages piétons et abaissés PMR recalés sur les bordures réelles après fusion (jamais dans la chaussée).
{
  const D2 = buildDesign(prj([0, 35, 180, 270]));
  const pts = D2.prims.filter((p) => p.k === 'path' && p.L === 'BORDURE').flatMap((p) => p.segs.flatMap((sg) => { const n = Math.max(2, Math.ceil(G.segLen(sg) / 0.1)); return Array.from({ length: n + 1 }, (_, i) => G.segAt(sg, i / n)); }));
  for (const bd of D2.branches) if (bd.cross) for (const e of bd.cross.ends) {
    const P = bd.W(e.E), d = Math.min(...pts.map((q) => G.dist(q, P)));
    ok(d < 0.1, `${bd.name} : extrémité du passage sur la bordure (${d.toFixed(2)} m)`);
  }
  ok(D2.branches.some((b) => b.cross), 'passages présents');
}
if (fails) { console.error(`${fails} échec(s)`); process.exit(1); }
console.log('test-fuse : OK');
