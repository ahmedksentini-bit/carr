// test-gabarit.mjs — tirant d'air sous les ouvrages, dévers compris (js/gabarit.js).
import { buildDesign } from '../js/roundabout.js';
import { buildOuvrages } from '../js/ouvrage.js';
import { listAxes } from '../js/profils.js';
import { buildAxisProfiles } from '../js/axpl.js';
import { clearanceChecks, worstClearance, lineAt } from '../js/gabarit.js';
import { prjBase } from './fixtures-gabarit.mjs';
let fail = 0;
const check = (l, ok, got = '') => { if (!ok) fail++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${l.padEnd(64)} ${got}`); };
const run = (zX, zR = null) => {
  const prj = prjBase(zX, zR);
  const D = buildDesign(prj);
  const O = buildOuvrages(prj, D, {});
  const axes = listAxes(prj, D).filter((a) => !a.key.startsWith('b:'));
  const P = buildAxisProfiles(prj, D, axes, [], null);
  return { prj, D, O, axes, P, C: clearanceChecks(prj, D, P, axes, O.list) };
};
// coupe : interpolation et bande revêtue
const line = [{ y: -10, z: 99.75, paved: false }, { y: -9, z: 99.775, paved: true }, { y: 0, z: 100, label: 'axe' }, { y: 9, z: 99.775, paved: true }];
check('lineAt : cote interpolée', Math.abs(lineAt(line, 4.5).z - 99.8875) < 1e-9);
check('lineAt : berme non revêtue', lineAt(line, -9.5).paved === false);
check('lineAt : hors plate-forme', lineAt(line, 12) === null);

const r = run(108);
const o = r.O.list.find((q) => q.key.startsWith('x:'));
check('passage supérieur implanté', !!o, o ? `${o.name} h ${o.h}` : '');
const q = worstClearance(r.C, o?.name);
check('tirant d\'air calculé sur l\'autoroute', q && q.lower === 'hwy' && q.uppers[0].startsWith('x:'), q?.msg);
// toit : chaussées de l'autoroute en pente vers l'extérieur depuis le TPC ; voie portée en toit 2,5 %
const E2x = r.D.crosses[0].E2;
const expect = 108 - 0.025 * (q ? Math.abs(q.crit.zInt - (108 - o.h)) / 0.025 : 0) - o.h - 100;
check('point critique : sommet de la chaussée franchie (bord du TPC)', q && Math.abs(q.crit.zLow - 100) < 0.02, q ? `zLow ${q.crit.zLow.toFixed(3)} y ${q.crit.yLow}` : '');
check('intrados le plus bas : rive de la voie portée (dévers)', q && q.crit.zInt < 108 - o.h - 0.01 && q.crit.zInt > 108 - o.h - 0.025 * (E2x + 1) - 0.01, q ? `zInt ${q.crit.zInt.toFixed(3)}` : '');
check('tirant d\'air < calcul à l\'axe (ancien calcul)', q && q.ta < 108 - o.h - 100 - 0.01, q ? `${q.ta.toFixed(3)} < ${(108 - o.h - 100).toFixed(3)}` : '');
check('conforme si ≥ gabarit', q && (q.lvl === 'ok') === (q.ta >= q.gab - 0.005), `${q?.lvl}`);
const r2 = run(104.5);
const q2 = worstClearance(r2.C, r2.O.list.find((x) => x.key.startsWith('x:'))?.name);
check('erreur si voie portée trop basse', q2?.lvl === 'err' && q2.zNeed > 104.5, q2?.msg);
// bretelle franchissant la voie secondaire sans tablier implanté : croisement générique
const r3 = run(100, 107);
const g = r3.C.find((c) => c.generic);
check('croisement bretelle / voie secondaire détecté', !!g, g?.msg);
check('bretelle portée, voie secondaire franchie', g && g.uppers[0].startsWith('r:') && g.lower.startsWith('x:'));
console.log(fail ? `\n${fail} échec(s)` : '\nTous les contrôles passent.');
process.exit(fail ? 1 : 0);
