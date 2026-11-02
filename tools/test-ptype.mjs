// test-ptype.mjs — contrôles du profil type construit point par point (js/ptype.js) sur des cas calculés à la main :
// demi-profil en remblai et en déblai sur TN plat, pente prise au dévers, condition sans TN, cubatures à l'arase,
// copie de profil et contrôles de validité. Exécution : node tools/test-ptype.mjs — code de retour ≠ 0 en cas d'échec.
import * as T from '../js/ptype.js';
import { areas, tnAt } from '../js/pt.js';

let fails = 0, n = 0;
function check(label, exp, got, tol = 1e-6) {
  n++;
  const ok = typeof exp === 'number' ? Number.isFinite(got) && Math.abs(got - exp) <= tol : exp === got;
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(58)} attendu ${String(exp).padStart(10)}   obtenu ${String(typeof got === 'number' ? +got.toFixed(6) : got).padStart(10)}`);
}

// Demi-profil : voie 3,50 au dévers, condition au bord, talus 3/2 en remblai et 1/1 en déblai.
const lane = (o = {}) => ({ id: 'x', name: 'test', layers: [], cons: T.consFromBands([{ w: 3.5, code: 'Voie', mode: 'devers', zone: 'CHAUSSEE', arase: true }], { remblai: 1.5, deblai: 1, ...o }) });

{ // remblai : TN plat à −2 ; bord de voie à −0,0875 (dévers −2,5 %) ; EET à 3,5 + (2 − 0,0875) × 1,5
  const h = T.halfSection(lane(), () => -2, { devers: -0.025, xmax: 50 });
  check('remblai : branche retenue', 'R', h.br);
  check('remblai : x de l\'EET', 3.5 + (2 - 0.0875) * 1.5, h.eet.x);
  check('remblai : z de l\'EET', -2, h.eet.z);
}
{ // déblai : TN plat à +1 ; EET à 3,5 + 1,0875
  const h = T.halfSection(lane(), () => 1, { devers: -0.025, xmax: 50 });
  check('déblai : branche retenue', 'D', h.br);
  check('déblai : x de l\'EET', 3.5 + 1.0875, h.eet.x);
}
{ // déblai avec fossé 0,5 m de profondeur, 1,2 m de large : fond à x 4,1 ; z −0,5875 ; EET à 4,1 + 1,5875
  const h = T.halfSection(lane({ fosse: 0.5, fosseW: 1.2 }), () => 1, { devers: -0.025, xmax: 50 });
  check('fossé : x de l\'EET', 4.1 + 1.5875, h.eet.x);
  check('fossé : point du fond dans la ligne Projet', 'Fond de fossé', h.proj[h.proj.length - 2].code);
}
{ // pente au dévers : bord de voie à +4 % × 3,5 = 0,14
  const h = T.halfSection(lane(), () => -2, { devers: 0.04, xmax: 50 });
  check('dévers +4 % : z du bord de voie', 0.14, h.proj[1].z);
}
{ // sans TN : la condition ne peut pas trancher
  const h = T.halfSection(lane(), null, { devers: -0.025 });
  check('sans TN : branche indéterminée', null, h.br);
  check('sans TN : pas d\'EET', null, h.eet);
}
{ // talus qui n'atteint pas le TN dans la demi-largeur
  const h = T.halfSection(lane(), () => -40, { devers: -0.025, xmax: 20 });
  check('TN hors d\'atteinte : pas d\'EET', null, h.eet);
}

// Cubatures : plate-forme plate de 5 m, arase à 0,5 m sous toute la plate-forme, talus 1/1 ; TN plat à −1.
{
  const prof = { id: 'p', name: 'plat', layers: [], cons: T.consFromBands([{ w: 5, code: 'Plate-forme', mode: 'fixe', p: 0, zone: 'CHAUSSEE', arase: true }], { remblai: 1, deblai: 1, depth: 0.5 }) };
  const tl = []; for (let y = -30; y <= 30 + 1e-9; y += 0.5) tl.push({ y, z: 99 });
  const S = T.sectionFromTypes({ p: { x: 0, y: 0 }, n: { x: 0, y: 1 }, zA: 100, dev: { left: 0, right: 0 }, tl, tnAt, halfW: 30, left: prof, right: prof });
  // par côté : 5 × 0,5 sous l'arase + triangle de talus 1 × 1 / 2 ; projet seul : 5 × 1 + 0,5
  check('remblai à l\'arase (deux côtés)', 6, areas(S.terr, tl).fill, 0.02);
  check('remblai sous le projet (deux côtés)', 11, areas(S.proj, tl).fill, 0.02);
  check('EET gauche (y)', 6, S.endR.y, 1e-6);
  check('EET droite (y)', -6, S.endL.y, 1e-6);
  check('ligne Projet croissante en y', true, S.proj.every((q, i) => !i || q.y >= S.proj[i - 1].y - 1e-9));
}

// Nouveau profil, copie, contrôles
{
  const p = T.newProfile('Standard');
  check('profil standard : aucun défaut', 0, T.profileIssues(p).length);
  check('profil standard : profondeur des couches', 0.75, T.layersDepth(p.layers));
  const c = T.cloneProfile(p, 'Copie');
  check('copie : nouveaux identifiants', true, c.cons.points.every((q) => !p.cons.points.some((r) => r.id === q.id)));
  const h1 = T.halfSection(p, () => -3, { devers: -0.025 }), h2 = T.halfSection(c, () => -3, { devers: -0.025 });
  check('copie : même EET', h1.eet.x, h2.eet.x);
  const bad = T.cloneProfile(p); bad.cons.points = bad.cons.points.filter((q) => !(q.m === 'tn' && q.br === 'D'));
  check('condition sans branche déblai : signalée', true, T.profileIssues(bad).some((m) => /déblai/.test(m)));
  // cycle de références : les points restent non calculables, sans boucle infinie
  const cyc = T.cloneProfile(p); const a = cyc.cons.points[1], b = cyc.cons.points[2]; a.parent = b.id; b.parent = a.id;
  const ev = T.evaluate(cyc.cons, 'R', () => -3, {});
  check('cycle : points non calculables', false, ev.get(a.id).ok || ev.get(b.id).ok);
}

console.log(`\n${n - fails}/${n} contrôles réussis`);
process.exit(fails ? 1 : 0);
