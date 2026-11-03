// test-vsa.mjs — contrôles des accès sur VSA 90 / 110 (js/vsa.js et son branchement dans js/echangeur.js) : tables,
// lb, enchaînements sortie – sortie, entrée – entrée, entrée – sortie (direct / entrecroisement / collectrice),
// déboîtement et insertion, courbe déversée, section courante, autoroute inchangée.
// Exécution : node tools/test-vsa.mjs — code de retour ≠ 0 en cas d'échec.
import { vsaRules, lbOf } from '../js/vsa.js';
import { buildEchangeur } from '../js/echangeur.js';

let fails = 0, n = 0;
const check = (label, ok, info = '') => { n++; if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${info ? ' — ' + info : ''}`); };
const near = (a, b, t = 0.01) => Math.abs(a - b) <= t;

// --- Tables -----------------------------------------------------------------------------------------------------
{
  const A = vsaRules('VSA90', 2), B = vsaRules('VSA110', 3);
  check('VSA 90 : da 130, lc 125, np 170, d1 600, d1m(2 v.) 240', A.da === 130 && A.lc === 125 && A.np === 170 && A.d1 === 600 && A.d1m === 240);
  check('VSA 110 : da 195, lc 155, d1 800, d1m(3 v.) 450, ds(3 v.) 300, d 1500', B.da === 195 && B.lc === 155 && B.d1 === 800 && B.d1m === 450 && B.ds === 300 && B.d === 1500);
  check('vitesses aux nez : S.1,00 50 / 70, E.1,00 55', A.vS === 50 && B.vS === 70 && A.vE === 55 && B.vE === 55);
  check('minima conditionnels (110 m, 150 m) seulement sur VSA 90', A.biseauSmin === 110 && A.insEmin === 150 && B.biseauSmin == null && B.insEmin == null);
  check('autres catégories : pas de règle VSA', vsaRules('R1') === null && vsaRules('') === null);
  // [VRUA] p. 14 : lb = 12,50 (V 50, p 1/20), 27,00 (V 90, p 1/30), 40,00 (V 110, p 1/30).
  check('lb (VRU A § 1.6)', near(lbOf(39, 1 / 20), 12.5) && near(lbOf(117, 1 / 30), 27) && near(lbOf(195, 1 / 30), 40), `${lbOf(39, 1 / 20)} ${lbOf(117, 1 / 30)} ${lbOf(195, 1 / 30)}`);
}

// --- Projets ------------------------------------------------------------------------------------------------------
const mk = (id, from, to, pis, extra = {}) => ({ id, name: id, cat: 'b50', from, to, pis, ...extra });
const S = (id, s, extra = {}) => mk(id, { ref: 'hwy1', s, ...extra }, { ref: 'free' }, [{ x: s + 300, y: -120 }, { x: s + 500, y: -200 }]);
const E = (id, s, extra = {}) => mk(id, { ref: 'free' }, { ref: 'hwy1', s, ...extra }, [{ x: s - 500, y: -300 }, { x: s - 200, y: -100 }]);
function run(ramps, hwy = {}) {
  const prj = { hwy: { on: true, kind: 'route', dcat: 'VSA90', axis: [{ x: 0, y: 0 }, { x: 6000, y: 0 }], ...hwy }, ramps };
  const D = { prims: [], points: [] };
  buildEchangeur(prj, D);
  const I = D.echIssues.filter((i) => !/hors de l'axe dessiné/.test(i.msg));
  return { D, I, has: (lvl, re) => I.some((i) => i.lvl === lvl && re.test(i.msg)) };
}

{ // Sortie – sortie à 400 m : VSA 90 → D40 ramené à d1m (avertissement) et dessiné à 240 m ; VSA 110 → erreur.
  const a = run([S('S1', 600), S('S2', 1000)]);
  check('S–S 400 m, VSA 90 : avertissement d1m', a.has('warn', /S1 → S2 \(sortie – sortie.*d1m = 240/));
  check('S–S 400 m, VSA 90 : D40 de S2 dessiné à d1m', a.D.points.some((p) => /S2 · D40 \(240,00 m en amont de D30\)/.test(p.name)));
  const b = run([S('S1', 600), S('S2', 1000)], { dcat: 'VSA110' });
  check('S–S 400 m, VSA 110 : erreur np', b.has('err', /S1 → S2 \(sortie – sortie.*< np = 170 m\) même avec d1m/));
  const c = run([S('S1', 600), S('S2', 1600)]);
  check('S–S 1 000 m, VSA 90 : conforme', !c.I.some((i) => /sortie – sortie/.test(i.msg)));
}

{ // Entrée – entrée : fin du biseau de E1 (2 000 + 200 + 75) à 75 m de E.1,00 de E2 < da = 130 m.
  const a = run([E('E1', 2000), E('E2', 2350)]);
  check('E–E : fin du biseau à 75 m < da', a.has('err', /E1 → E2 \(entrée – entrée\) : 75,00 m .*< da = 130 m/));
  const b = run([E('E1', 2000), E('E2', 2450)]);
  check('E–E : 175 m ≥ da conforme', !b.I.some((i) => /entrée – entrée/.test(i.msg)));
}

{ // Entrée – sortie.
  const z200 = run([E('E1', 2000), S('S3', 2200)]);
  check('E–S Z = 200 m : voie d\'entrecroisement + erreur collectrice', z200.D.weaves.byE.get('E1')?.sid === 'S3' && z200.has('err', /entrecroisement < 300 m → à reporter sur une collectrice/));
  const z500 = run([E('E1', 2000), S('S3', 2500)]);
  check('E–S Z = 500 m : entrecroisement conforme (aucune alerte VSA)', z500.D.weaves.byE.get('E1')?.sid === 'S3' && !z500.I.some((i) => /entrée – sortie/.test(i.msg) && i.lvl !== 'info'));
  const z700 = run([E('E1', 2000), S('S3', 2700)]);
  check('E–S Z = 700 m : enchaînement direct avec d1m (pas de voie d\'entrecroisement)', !z700.D.weaves.byE.has('E1') && z700.has('warn', /E1 → S3 \(entrée – sortie.*d1m = 240/));
  const z1100 = run([E('E1', 2000), S('S3', 3100)]);
  check('E–S Z = 1 100 m : enchaînement direct conforme', !z1100.I.some((i) => /entrée – sortie/.test(i.msg)));
}

{ // Déboîtement, insertion, courbe déversée.
  const a = run([S('S1', 600, { biseau: 110 })]);
  check('déboîtement 110 m VSA 90 : admis si S < 650 uvp/h', a.has('info', /déboîtement réduit à 110,00 m/));
  const b = run([S('S1', 600, { biseau: 110 })], { dcat: 'VSA110' });
  check('déboîtement 110 m VSA 110 : avertissement', b.has('warn', /déboîtement de 110,00 m < 150 m/));
  const c = run([E('E1', 2000, { ins: 150 })]);
  check('insertion 150 m VSA 90 : admise si E < 600 uvp/h', c.has('info', /voie d'insertion réduite à 150,00 m/));
  const d = run([E('E1', 2000, { ins: 120 })]);
  check('insertion 120 m : avertissement', d.has('warn', /voie d'insertion de 120,00 m < 200 m/));
  const e = run([S('S1', 2000)], { axis: [{ x: 0, y: 0 }, { x: 2000, y: 0, r: 300 }, { x: 3000, y: 1000 }] });
  check('accès dans une courbe R = 300 m < Rdn 370 m : erreur', e.has('err', /courbe déversée R = 300,00 m < Rdn = 370 m/), e.I.filter((i) => /courbe/.test(i.msg)).map((i) => i.msg).join(' | '));
}

{ // Section courante et autoroute inchangée.
  const a = run([], { lanes: 1, median: 0, bau: 0.5 });
  check('section : chaussée unique / 1 voie / BDD < 1 m → erreurs', a.has('err', /chaussées séparées/) && a.has('err', /au moins 2 voies/) && a.has('err', /BAU \/ BDD 0,50 m/));
  const b = run([]);
  check('section VSA par défaut (2 voies, TPC, BAU 2,50, BDG 1,00) : conforme', !b.I.some((i) => /VSA/.test(i.msg)), b.I.map((i) => i.msg).join(' | '));
  const c = run([S('S1', 600), S('S2', 1000), E('E1', 2000), S('S3', 2200)], { kind: 'autoroute', dcat: '' });
  check('autoroute : aucune règle VSA', !c.I.some((i) => /VSA|sortie – sortie|entrée – entrée/.test(i.msg)));
}

console.log(`\n${n - fails}/${n} contrôles réussis`);
if (fails) process.exit(1);
