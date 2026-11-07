// test-psgr.mjs — PSGR (js/psgr.js) : paramètres par gabarit, coupe RECTUR, profil en long, contrôles, plan.
// Exécution : node tools/test-psgr.mjs — code de retour ≠ 0 en cas d'échec.
import { psgrParams, psgrSection, psgrProfile, psgrChecks, psgrPlan, PSGR_GAB } from '../js/psgr.js';

let fails = 0, n = 0;
const check = (label, ok, info = '') => { n++; if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${info ? ' — ' + info : ''}`); };
const near = (a, b, t = 0.01) => Math.abs(a - b) <= t;

{ // hauteurs libres minimales [RECTUR 5 B 1.4] : 2,15 / 2,85 / 3,70
  check('Hm RECTUR 2,00 / 2,70 / 3,50', near(psgrParams({ gab: 'G200' }).Hm, 2.15) && near(psgrParams({ gab: 'G270' }).Hm, 2.85) && near(psgrParams({ gab: 'G350' }).Hm, 3.7));
  check('PSGR B : 2,60 + 0,15', near(psgrParams({ gab: 'B' }).Hm, 2.75) && near(psgrParams({ gab: 'A' }).Hm, 2.0));
  const L = psgrParams({ gab: 'libre', G: 3.0 });
  check('gabarit libre 3,00 : classe 350, revanche 20 cm', L.cls === 350 && near(L.Hm, 3.2));
}
{ // largeur à 1 m [RECTUR annexe 1 / 5 C 1.1] : 2 voies, G 2,70, Vr 60 → 2,4 + 2×2,0 + 1,0 = 7,40
  const P = psgrParams({ gab: 'G270', tubes: 2, n: 2 }), S = psgrSection(P);
  check('W1m 2 voies G 2,70 Vr 60 = 7,40', near(S.W1m, 7.4), String(S.W1m));
  check('voies 2,80 (gauche) + 3,00 (droite)', S.lanes.join() === '2.8,3', S.lanes.join());
  check('plate-forme = voies + 2 bd + 2 trottoirs', near(S.Wp, 5.8 + 0.5 + 1.5));
  check('hors tout 2 tubes', near(S.Wo, 2 * S.Wp + 0.4 + 1.2));
}
{ // profil : profondeur couverte exactement
  const P = psgrParams({ gab: 'B' }), S = psgrSection(P), pr = psgrProfile(P, S, 40, 100);
  check('fond = zs − profondeur', near(pr.zb, 100 - S.depth));
  check('tête au niveau de la surface', near(pr.z(pr.s3), 100, 1e-6) && near(pr.z(-pr.s3), 100, 1e-6));
  check('continuité au début du saillant', near(pr.z(pr.s2 - 1e-6), pr.z(pr.s2 + 1e-6), 1e-4));
  check('pente 6 % conservée', near(pr.p, 0.06, 1e-9) && pr.Ls > 0, `Ls ${pr.Ls}`);
  // pente de la rampe droite
  const g = (pr.z(pr.s2 - 1) - pr.z(pr.s1 + 1)) / (pr.s2 - pr.s1 - 2);
  check('pente mesurée sur la rampe', near(g, 0.06, 1e-6));
  const ch = psgrChecks(P, S, pr, 'T');
  check('contrôles : pas d\'erreur avec les défauts', !ch.some((c) => c.lvl === 'err'), ch.filter((c) => c.lvl === 'err').map((c) => c.msg).join(' | '));
  const P2 = psgrParams({ gab: 'B', p: 12, Rr: 200, Rs: 300 }), pr2 = psgrProfile(P2, S, 40, 100), ch2 = psgrChecks(P2, S, pr2, 'T');
  check('12 %, Rs 300, Rr 200 : trois erreurs', ch2.filter((c) => c.lvl === 'err').length === 3, ch2.filter((c) => c.lvl === 'err').map((c) => c.msg).join(' | '));
  const P3 = psgrParams({ gab: 'B', p: 6, Rs: 20000, Rr: 20000 }), pr3 = psgrProfile(P3, S, 40, 100);
  check('rayons très grands : pente réduite, sans alignement', pr3.p < 0.06 && pr3.Ls === 0 && near(pr3.z(pr3.s3), 100, 1e-6));
}
{ // plan
  const P = psgrParams({}), S = psgrSection(P), pr = psgrProfile(P, S, 50, 100);
  const R = psgrPlan(P, S, pr, { x: 1000, y: 2000 }, { x: 1, y: 0 }, { edge: () => 12 });
  check('plan : 8 panneaux (4 par sens)', R.signs.length === 8);
  const b12 = R.signs.filter((q) => q.code === 'B12');
  check('B12 sur le musoir, à droite du sens entrant', b12.some((q) => q.p.x > 1000 + pr.s3 && q.p.y > 2000) && b12.some((q) => q.p.x < 1000 - pr.s3 && q.p.y < 2000));
  check('gabarits disponibles', Object.keys(PSGR_GAB).length === 6);
}
console.log(`\n${n - fails} / ${n} OK`);
if (fails) process.exit(1);
