// test-trefle-overlap.mjs — bretelles d'échangeur sur autoroute en courbe (js/echangeur.js : termBendR, termArc,
// deriveTrumpet) : à l'intérieur du virage, la droite d'obliquité d'un divergent ou d'un convergent recoupait la
// chaussée (flèche λ²/2R > p·λ) ; elle est remplacée par un arc d'extrémité. Contrôles : aucune plate-forme de bretelle
// sur la chaussée de l'autoroute (hors franchissements), autoroute droite inchangée (pas d'arc d'extrémité), boucle de
// trompette raccordée sans erreur, arc d'extrémité tangent en A à la direction d'obliquité.
// Exécution : node tools/test-trefle-overlap.mjs — code de retour ≠ 0 en cas d'échec.
import * as G from '../js/geom.js';
import { pathProject, pathTangentAt } from '../js/clotho.js';
import { buildEchangeur, trumpet, cloverleaf, halfCloverleaf, termArc, termBendR } from '../js/echangeur.js';

let fails = 0, n = 0;
const check = (label, ok, info = '') => { n++; if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${info ? ' — ' + info : ''}`); };

// Autoroute droite (R = 0) ou en courbe de rayon |R| (sommet à l'origine, déviation 0,5 rad ; R < 0 : virage à gauche),
// voie secondaire perpendiculaire passant par l'origine.
function project(R) {
  const axis = R ? [{ x: -2500, y: 0 }, { x: 0, y: 0, r: Math.abs(R) }, { x: 2500 * Math.cos(0.5), y: -Math.sign(R) * 2500 * Math.sin(0.5) }] : [{ x: -2500, y: 0 }, { x: 2500, y: 0 }];
  return { hwy: { on: true, kind: 'autoroute', axis }, crosses: [{ on: true, kind: 'route', axis: [{ x: 0, y: -2500 }, { x: 0, y: 2500 }] }], ramps: [] };
}
// Génération comme main.js (trompette : reprise avec une marge croissante si la S-semi est en erreur).
function generate(kind, R) {
  const prj = project(R);
  let D = { prims: [], points: [] };
  buildEchangeur(prj, D);
  let id = 0, T;
  const fn = { trumpet, cloverleaf, half: halfCloverleaf }[kind];
  for (const m of kind === 'trumpet' ? [5, 15, 30, 50] : [0]) {
    T = fn(prj, D, { x: 0, y: 50 }, () => `r${++id}`, { crossK: 0, semiMargin: m });
    if (T.err) break;
    const D2 = { prims: [], points: [] };
    buildEchangeur({ ...prj, ramps: T.ramps }, D2);
    if (!D2.echIssues.some((i) => i.lvl === 'err')) break;
  }
  if (T.err) return { err: T.err };
  prj.ramps = T.ramps;
  if (T.crossAxis && kind !== 'trumpet') prj.crosses[0].axis = T.crossAxis;
  D = { prims: [], points: [] };
  buildEchangeur(prj, D);
  return { prj, D };
}
// Longueur (m) où une rive de plate-forme de bretelle (BDG / BDD comprises) est sur la chaussée de l'autoroute, là où la
// bretelle la longe (angle < 25°) ; pire empiètement (m).
function overlap(D, R) {
  const hw = D.hwy, L = R.al.length;
  let bad = 0, worst = Infinity;
  for (let s = 0; s <= L; s += 1) {
    const p = R.al.pointAt(s), h = G.unit(R.al.headAt(s)), nrm = G.rot90(h);
    for (const off of [R.offL(s) + R.rp.bdg, R.offR(s) - R.rp.bdd]) {
      const q = G.add(p, G.mul(nrm, off)), pr = pathProject(hw.path, q), th = G.norm(pathTangentAt(hw.path, pr.s));
      if (Math.abs(G.cross(th, nrm)) < Math.cos((25 * Math.PI) / 180)) continue; // franchissement (tige, ouvrage)
      const d = Math.abs(pr.off) - hw.E1;
      worst = Math.min(worst, d);
      if (d < -0.05) { bad++; break; }
    }
  }
  return { bad, worst };
}

// --- Arc d'extrémité : tangent en A, obliquité tenue par rapport à la rive -------------------------------------------
{
  const A = { x: 0, y: 0 }, dir = { x: 1, y: 0 }, P = { x: 200, y: 0 };
  const a = termArc(A, dir, 1500, 'div', P, 40);
  check('termArc (divergent) : arc tangent en A, sommet sur la direction d\'obliquité', a && Math.abs(a.PI.y) < 1e-9 && a.PI.x > 0, a ? `PI ${a.PI.x.toFixed(2)}` : 'null');
  check('termArc : sommet suivant reporté sur la tangente à dT du point de tangence', a && Math.abs(G.dot(G.sub(a.P, a.T), a.t) - 40) < 1e-6 && Math.abs(G.cross(a.t, G.sub(a.P, a.T))) < 1e-6);
  check('termArc : arc tournant à droite (centre du côté de la bretelle)', a && a.t.y < 0 && a.P.y < 0);
  const c = termArc(A, dir, 1500, 'conv', { x: -200, y: 0 }, 40);
  check('termArc (convergent) : arc parcouru jusqu\'à A, en amont (cap tourné à gauche avant l\'arc)', c && c.PI.x < 0 && c.T.x < 0 && c.T.y < 0 && c.t.y > 0);
  const hp = [G.L({ x: -1000, y: 0 }, { x: 1000, y: 0 })];
  check('termBendR : chaussée droite → pas d\'arc', termBendR(hp, 2000, 1000, 1, 'div', 15) === 0);
}

// --- Trompettes : aucune plate-forme de bretelle sur l'autoroute ---------------------------------------------------
for (const R of [0, 3000, 2000, 1500, 1000, 700]) {
  const g = generate('trumpet', R);
  if (g.err) { check(`trompette, autoroute R = ${R || '∞'} : construite`, false, g.err); continue; }
  const errs = g.D.echIssues.filter((i) => i.lvl === 'err');
  check(`trompette, autoroute R = ${R || '∞'} : aucune erreur`, !errs.length, errs.map((i) => i.msg).join(' | '));
  for (const Rm of g.D.ramps) {
    if (!Rm?.al) continue;
    const o = overlap(g.D, Rm);
    check(`trompette R = ${R || '∞'} : ${Rm.name} hors de la chaussée de l'autoroute`, o.bad === 0, `empiètement ${o.bad} m, écart mini ${o.worst.toFixed(2)} m`);
  }
  const terms = g.D.ramps.filter((q) => q?.al?.elems.some((e) => e.term)).map((q) => q.name);
  if (!R) check('trompette, autoroute droite : alignements d\'extrémité droits (pas d\'arc)', !terms.length, terms.join(', '));
  else check(`trompette R = ${R} : convergent de la boucle par un arc d'extrémité`, terms.includes('E-boucle'), terms.join(', '));
}

// --- Demi-trèfles et trèfles ---------------------------------------------------------------------------------------
for (const [kind, label] of [['half', 'demi-trèfle'], ['cloverleaf', 'trèfle']]) {
  for (const R of [0, 1500, -1500, 1000]) {
    const g = generate(kind, R);
    if (g.err) { check(`${label}, R = ${R || '∞'} : construit`, false, g.err); continue; }
    let bad = 0, names = [];
    for (const Rm of g.D.ramps) { if (!Rm?.al) continue; const o = overlap(g.D, Rm); if (o.bad) { bad += o.bad; names.push(`${Rm.name} ${o.bad} m`); } }
    check(`${label}, autoroute R = ${R || '∞'} : bretelles hors de la chaussée de l'autoroute`, bad === 0, names.join(', '));
  }
}

console.log(`\n${n - fails}/${n} contrôles réussis.`);
process.exit(fails ? 1 : 0);
