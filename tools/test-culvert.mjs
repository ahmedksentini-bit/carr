// test-culvert.mjs — rejoue sous Node les campagnes de validation de BVTrace consacrées aux buses et
// aux dalots (BVTrace.Validation/Program.cs « Test A … » à « Proposition des dalots », BceomCampaign.cs,
// et le CSV de contrôle calcul_hydraulique.csv régénéré par la validation C#), puis quelques cas
// vérifiés à la main. Exécution : node tools/test-culvert.mjs — code de retour ≠ 0 en cas d'échec.
//
// Tolérances : celles de BVTrace pour chaque contrôle (1e-8 m sur HWi, 1e-5 m sur HWo…, ±0,03 m / ±3 %
// sur les valeurs imprimées du manuel BCEOM). Les valeurs issues d'une exécution du code C#
// (référence « C# ») sont en outre tenues à 0,5 % relatif au plus.

import * as C from '../js/hydro/culvert.js';

let failures = 0, checks = 0, deviations = 0;
let maxRelCs = 0;          // plus grand écart relatif sur les références issues du code C#

const fmt = (x, n = 7) => (typeof x === 'number' ? (Number.isNaN(x) ? 'NaN' : x.toFixed(n)) : String(x));
function title(s) { console.log(`\n=== ${s} ===`); }

/** Contrôle numérique : |obtenu − attendu| ≤ tol. `cs` = référence produite par le code C# (≤ 0,5 %). */
function check(label, expected, actual, tol, cs = false) {
  checks++;
  let ok = Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
  const rel = expected !== 0 ? Math.abs(actual - expected) / Math.abs(expected) : Math.abs(actual - expected);
  if (cs) {
    if (Number.isFinite(rel)) maxRelCs = Math.max(maxRelCs, rel);
    if (!(rel <= 0.005) && Math.abs(actual - expected) > 1e-12) ok = false;
  }
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(52)} attendu ${fmt(expected).padStart(14)}   obtenu ${fmt(actual).padStart(14)}` +
    `   écart ${(actual - expected).toExponential(2)}${cs ? '  [C#]' : ''}`);
}
function checkBool(label, expected, actual) {
  checks++;
  const ok = expected === actual;
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(52)} attendu ${String(expected).padStart(14)}   obtenu ${String(actual).padStart(14)}`);
}
function checkStr(label, expected, actual) {
  checks++;
  const ok = expected === actual;
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`);
  if (!ok) console.log(`       attendu : ${expected}\n       obtenu  : ${actual}`);
}
/** Écart documenté (non bloquant), comme `Compare` côté C#. */
function compare(label, reference, actual, tol) {
  const ok = Math.abs(actual - reference) <= tol;
  if (!ok) deviations++;
  console.log(`${ok ? 'OK  ' : 'ÉCART'} ${label.padEnd(51)} référence ${fmt(reference).padStart(14)}   obtenu ${fmt(actual).padStart(14)}`);
}

// ─── raccourcis calqués sur les aides du programme C# ─────────────────────────────────────

/** Dalot B × D (N cellules). */
const box = (Q, B, D, p, cells = 1) => C.culvertHydraulics({ shape: 'box', width: B, height: D, cells }, Q, p);

/** Buse (Program.cs « Pipe ») : zDown NaN = sortie libre supposée, sinon PHE connue. */
function pipe(q, diameter, inlet, slope, kStr, length, zInvert, zDown, ke = null, cells = 1) {
  return C.culvertHydraulics({ shape: 'circular', diameter, cells }, q, {
    length, slope, StricklerK: kStr, upstreamInvert: zInvert, inlet, Ke: ke ?? undefined,
    exitLossCoefficient: 1.0,
    tailwater: Number.isNaN(zDown) ? { mode: 'free' } : { mode: 'known', level: zDown },
  });
}
const has = (r, s) => r.warnings.some((w) => w.includes(s));

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Program.cs — tests A à D (dalots)
// ═══════════════════════════════════════════════════════════════════════════════════════════

title('Test A — sortie noyée (BCEOM)');
const a = box(14.0, 4.0, 2.0, {
  length: 15.8, slope: 0.01, StricklerK: 67, upstreamInvert: 10.0,
  tailwater: { mode: 'known', level: 13.0 }, inlet: 5, Ke: 0.20, exitLossCoefficient: 1.0,
});
checkBool('sortie noyée', true, a.outletCondition === 'submerged');
check('perte totale HL (m)', 0.206, a.totalLoss, 0.006);
check("cote d'eau amont contrôle sortie (m)", 13.206, a.outletWaterElev, 0.006);
checkBool('contrôle à la sortie gouverne', true, a.control === 'outlet');
check('identité TW + HL − JL == Zav + HL', a.outletWaterElev, a.downstreamInvert + a.tailwaterDepth + a.totalLoss, 1e-9);

title('Test B — profil uniforme par pas directs');
const ynB = C.rectangularSection(2.0, 2.0).normalDepth(4.4, 67, 0.005);
const zInvOutB = 100.0 - 0.005 * 30.0;
const bres = box(4.4, 2.0, 2.0, {
  length: 30.0, slope: 0.005, StricklerK: 67, upstreamInvert: 100.0,
  tailwater: { mode: 'known', level: zInvOutB + ynB }, inlet: 1, Ke: 0.40, exitLossCoefficient: 1.0,
});
check('tirant normal yn (m)', 0.7980686, bres.normalDepth, 1e-6, true);
check("profondeur à l'entrée = yn (m)", ynB, bres.profileEntranceDepth, 1e-6);
check('HWo (m au-dessus du radier amont)', 1.3403116, bres.hwOutlet, 1e-5, true);
checkBool('méthode = pas directs', true, bres.outletMethod === 'directStep');

title('Test C — raccord en pleine section');
const c = box(2.0, 1.0, 1.0, {
  length: 100.0, slope: 0.001, StricklerK: 60, upstreamInvert: 100.0,
  tailwater: { mode: 'free' }, inlet: 1, exitLossCoefficient: 1.0,
});
checkBool('capacité uniforme dépassée', true, c.capacityExceeded);
checkBool('le profil atteint la voûte', true, c.profileEntranceDepth >= 1.0 - 1e-9);
checkBool('méthode = pas directs', true, c.outletMethod === 'directStep');
checkBool('raccord pleine section signalé', true, c.outletMethodNote.includes('pleine section'));

title('Test D — surverse routière');
const dParams = (extra = {}) => ({
  length: 30.0, slope: 0.005, StricklerK: 67, upstreamInvert: 100.0, tailwater: { mode: 'free' }, roadLevel: 100.9,
  inlet: 1, Ke: 0.40, exitLossCoefficient: 1.0,
  allowRoadOverflow: true, roadCrestLength: 20.0, weirCoefficient: 1.70, submergenceFactor: 1.0, ...extra,
});
const d = box(8.0, 2.0, 2.0, dParams());
checkBool('route submergée', true, d.roadOvertopped);
check('fermeture du bilan (m3/s)', 0, d.balanceError, 1e-8);
check('cohérence Q route = Cd·kt·Lr·Hr^1,5', 1.70 * 1.0 * 20.0 * Math.pow(d.roadOverflowDepth, 1.5), d.roadDischarge, 1e-9);
compare('Q dalot (référence K-HydroRoute)', 2.8229089, d.culvertDischarge, 1e-6);
compare('Q route (référence K-HydroRoute)', 5.1770911, d.roadDischarge, 1e-6);
compare('Hr (référence K-HydroRoute)', 0.2851486, d.roadOverflowDepth, 1e-6);
console.log('     (écarts K-HydroRoute documentés côté BVTrace : configuration d\'entrée et Ke non fixés par l\'énoncé)');
console.log('     Sensibilité du partage à la configuration d\'entrée :');
for (const t of C.inletsForShape('box')) {
  const s = box(8.0, 2.0, 2.0, dParams({ inlet: t.key, Ke: undefined }));
  console.log(`       ${t.key}. Ke=${t.Ke.toFixed(2)}  Q dalot=${s.culvertDischarge.toFixed(7)}  Q route=${s.roadDischarge.toFixed(7)}` +
    `  HW=${s.headwater.toFixed(7)}  [${s.labels.control}]`);
}
{
  const keSplit = (ke) => box(8.0, 2.0, 2.0, dParams({ Ke: ke })).culvertDischarge;
  let lo = 0, hi = 1;
  for (let i = 0; i < 80; i++) { const m = 0.5 * (lo + hi); if (keSplit(m) > 2.8229089) lo = m; else hi = m; }
  console.log(`     Ke reproduisant la référence : ${(0.5 * (lo + hi)).toFixed(4)} — aucune des six configurations HDS-5.`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Program.cs — buses circulaires
// ═══════════════════════════════════════════════════════════════════════════════════════════

title('Test 1 — buse béton, mur de tête arête vive, entrée dénoyée');
const p1 = pipe(0.50, 1.00, 101, 0.01, 60, 10.0, 100.0, NaN);
checkBool('entrée dénoyée', true, p1.inletRegime === 'unsubmerged');
check('HWi (m)', 0.5560705304, p1.hwInlet, 1e-8, true);
checkBool('abaque 1, échelle 1', true, C.chartLabel(p1.inlet) === 'abaque 1, échelle 1');
checkBool('contrôle HDS-5 appliqué', true, p1.hds5Applied);

title('Test 2 — buse béton, mur de tête arête vive, entrée noyée');
const p2 = pipe(2.00, 1.00, 101, 0.01, 60, 10.0, 100.0, NaN);
checkBool('entrée noyée', true, p2.inletRegime === 'submerged');
check('HWi (m)', 1.5114478404, p2.hwInlet, 1e-8, true);

title('Test 3 — buse métallique, sortie noyée (BCEOM)');
const p3 = pipe(14.0, 3.21, 201, 0.01, 37, 14.6, 10.0, 13.20, 0.50);
checkBool('sortie noyée', true, p3.outletCondition === 'submerged');
check('perte totale HL (m)', 0.272, p3.totalLoss, 0.002);
check("cote d'eau amont contrôle sortie (m)", 13.472, p3.outletWaterElev, 0.002);
check('identité TW + HL − JL == Zav + HL', p3.outletWaterElev, p3.downstreamInvert + p3.tailwaterDepth + p3.totalLoss, 1e-9);

title('Buses — géométrie et garde-fous');
const circ = C.circularSection(2.0);
check('aire pleine section πD²/4 (m²)', Math.PI, circ.fullArea, 1e-12);
check('rayon hydraulique plein D/4 (m)', 0.5, circ.fullHydraulicRadius, 1e-12);
check('aire à mi-hauteur = demi-section (m²)', Math.PI / 2, circ.area(1.0), 1e-12);
check('largeur au miroir à mi-hauteur = D (m)', 2.0, circ.topWidth(1.0), 1e-12);
check('largeur au miroir nulle à la clé (m)', 0.0, circ.topWidth(2.0), 1e-12);
const ycCirc = circ.criticalDepth(3.0);
check('profondeur critique : q²T/(gA³) = 1', 1.0, 9.0 * circ.topWidth(ycCirc) / (C.G * Math.pow(circ.area(ycCirc), 3)), 1e-9);
const ynCirc = circ.normalDepth(2.0, 70, 0.01);
check('tirant normal : q(yn) = q', 2.0, circ.conveyance(ynCirc, 70, 0.01), 1e-9);
checkBool('tirant normal sur la branche stable (y < 0,94 D)', true, ynCirc < 0.94 * 2.0);
const mismatch = pipe(0.50, 1.00, 1, 0.01, 60, 10.0, 100.0, NaN);
checkBool('tête de dalot sur une buse : contrôle HDS-5 refusé', false, mismatch.hds5Applied);
checkBool('aucun HWi calculé dans ce cas', true, mismatch.hwInlet === 0);
console.log('     motif : ' + mismatch.hds5Status);
const mismatchBox = box(2, 2, 2, { length: 20, slope: 0.01, inlet: 101 });
checkBool('entrée de buse sur un dalot : calcul refusé', false, mismatchBox.valid);
console.log('\n     Entrées de buse (D = 1,00 m, Q = 1,20 m³/s, J = 1 %, K = 60) :');
for (const t of C.inletsForShape('circular')) {
  const s = pipe(1.20, 1.00, t.key, 0.01, 60, 10.0, 100.0, NaN);
  console.log(`       ${C.chartLabel(t).padEnd(24)} ${t.material.padEnd(13)} X=${s.inletX.toFixed(4)}  ` +
    `${s.labels.inletRegime.padEnd(15)} HWi=${s.hwInlet.toFixed(5)} m  HWo=${s.hwOutlet.toFixed(5)} m  [${s.labels.control}]`);
}
checkBool('catalogue : 6 têtes de dalot et 8 entrées de buse', true,
  C.inletsForShape('box').length === 6 && C.inletsForShape('buse').length === 8);
checkBool('Kpente = +0,70 pour 2/2 seulement, −0,50 ailleurs', true,
  C.CULVERT_INLETS.every((t) => (t.key === 202 ? t.KSlope === 0.70 : t.KSlope === -0.50)));

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Program.cs — condition aval
// ═══════════════════════════════════════════════════════════════════════════════════════════

title('Condition aval — mode obligatoire et états de la sortie');
const Box = (tailwater) => box(4.4, 2.0, 2.0, {
  length: 30.0, slope: 0.005, StricklerK: 67, upstreamInvert: 100.0, tailwater, inlet: 1, exitLossCoefficient: 1.0,
});
const zInvOut = 100.0 - 0.005 * 30.0;
const ycBox = C.rectangularSection(2.0, 2.0).criticalDepth(4.4);
console.log(`     radier aval = ${zInvOut.toFixed(3)} m · yc = ${ycBox.toFixed(4)} m · D = 2,000 m`);

const noMode = Box({ mode: 'none' });
checkBool('mode aval non défini : calcul refusé', false, noMode.valid);
checkBool('aucun niveau amont produit', true, noMode.headwater === 0 && noMode.hwOutlet === 0);
checkBool('motif explicite', true, noMode.hds5Status.startsWith('Mode aval non défini'));
const noPhe = Box({ mode: 'known' });
checkBool('PHE connue sans cote : calcul refusé', false, noPhe.valid);
const noChannel = Box({ mode: 'channel' });
checkBool('chenal aval non décrit : calcul refusé', false, noChannel.valid);
const flatChannel = Box({ mode: 'channel', channel: { bedWidth: 2, sideSlope: 1.5, slope: 0, StricklerK: 30 } });
checkBool('chenal aval sans pente : calcul refusé', false, flatChannel.valid);
console.log('     motif : ' + flatChannel.hds5Status);

const free = Box({ mode: 'free' });
check('sortie libre supposée : TW (m)', 0.0, free.tailwaterDepth, 1e-12);
check('sortie libre : h intérieur sortie = yc (m)', ycBox, free.profileOutletDepth, 1e-9);
check('cote d\'eau aval = radier de sortie (m)', zInvOut, free.downstreamWaterElev, 1e-12);
checkBool('état déduit : sortie libre', true, free.outletCondition === 'free');
const freeAsPhe = Box({ mode: 'known', level: zInvOut });
check('PHE au radier de sortie ≡ sortie libre (HW, m)', free.headwater, freeAsPhe.headwater, 1e-12);

const stateFree = Box({ mode: 'known', level: zInvOut + 0.40 });
const statePart = Box({ mode: 'known', level: zInvOut + 1.20 });
const stateSub = Box({ mode: 'known', level: zInvOut + 2.50 });
checkBool('0 < TW = 0,40 m < D : partiellement noyée', true, stateFree.outletCondition === 'partial');
checkBool('TW = 0,40 m < yc : pas d\'influence aval effective', false, stateFree.tailwaterInfluences);
checkBool('yc < TW = 1,20 m < D : partielle avec influence', true, statePart.outletCondition === 'partial' && statePart.tailwaterInfluences);
checkBool('TW = 2,50 m ≥ D : sortie noyée', true, stateSub.outletCondition === 'submerged');
check('sortie partiellement noyée : h intérieur sortie (m)', 1.20, statePart.profileOutletDepth, 1e-9);
check('sortie noyée : h intérieur sortie = D (m)', 2.0, stateSub.profileOutletDepth, 1e-9);
checkBool('libellés distinguant l\'influence effective', true,
  stateFree.labels.outletCondition === 'sortie partiellement noyée, sans influence (TW ≤ yc)'
  && statePart.labels.outletCondition === 'sortie partiellement noyée, avec influence aval');
checkBool('sortie noyée traitée en pleine section', true, stateSub.outletMethod === 'fullFlowEnergy');
checkBool("l'influence aval relève le niveau amont", true,
  statePart.hwOutlet > stateFree.hwOutlet && stateSub.hwOutlet > statePart.hwOutlet);
const depthMode = Box({ mode: 'known', depth: 1.20 });
check('PHE donnée en profondeur TW ≡ cote absolue (HW, m)', statePart.headwater, depthMode.headwater, 1e-12);

const tol = C.DEPTH_TOLERANCE;
checkBool('TW = 0 à la tolérance près : sortie libre', true, Box({ mode: 'known', level: zInvOut + 0.5 * tol }).outletCondition === 'free');
checkBool('TW = 1 mm : déjà partiellement noyée', true, Box({ mode: 'known', level: zInvOut + 10 * tol }).outletCondition === 'partial');
checkBool('TW = D exactement : sortie noyée', true, Box({ mode: 'known', level: zInvOut + 2.0 }).outletCondition === 'submerged');
checkBool('TW = D − 1 mm : encore partiellement noyée', true, Box({ mode: 'known', level: zInvOut + 2.0 - 10 * tol }).outletCondition === 'partial');

const litDef = { bedWidth: 2.0, sideSlope: 1.5, slope: 0.005, StricklerK: 30 };
const lit = C.downstreamChannel(litDef);
const byChannel = Box({ mode: 'channel', channel: litDef });
check('chenal aval : q(TW) = Q (m³/s)', 4.4, lit.conveyance(byChannel.tailwaterDepth), 1e-7);
check('cote d\'eau aval = radier + hauteur normale (m)', zInvOut + lit.normalDepth(4.4), byChannel.downstreamWaterElev, 1e-9);
checkBool('état déduit du chenal, non déclaré', true, byChannel.outletCondition === 'partial');
console.log('     ' + byChannel.tailwaterSource);
const chanNoSlope = Box({ mode: 'channel', channel: { bedWidth: 2.0, sideSlope: 1.5, StricklerK: 30 } });
check('chenal sans pente renseignée = pente du radier (HW)', byChannel.headwater, chanNoSlope.headwater, 1e-12);
const declared = box(4.4, 2.0, 2.0, { length: 30, slope: 0.005, StricklerK: 67, upstreamInvert: 100, inlet: 1,
  tailwater: { mode: 'free' }, outletCondition: 'submerged', submerged: true });
checkBool("l'état de la sortie n'est jamais une donnée d'entrée", true, declared.outletCondition === 'free');

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Program.cs — sortie noyée 4 × 2, pente critique, vitesse, revanche, surverse
// ═══════════════════════════════════════════════════════════════════════════════════════════

title('Sortie noyée — dalot 4 × 2 m, PHE aval 13,20 m');
const noyP = { length: 15.8, slope: 0.01, StricklerK: 67, upstreamInvert: 10.0,
  tailwater: { mode: 'known', level: 13.20 }, inlet: 5, Ke: 0.20, exitLossCoefficient: 1.0 };
const noy = box(14.0, 4.0, 2.0, noyP);
check('section pleine A (m²)', 8.0, C.rectangularSection(4, 2).fullArea, 1e-12);
check('rayon hydraulique plein Rh (m)', 2.0 / 3.0, C.rectangularSection(4, 2).fullHydraulicRadius, 1e-12);
check('vitesse pleine section V (m/s)', 1.75, noy.fullVelocity, 1e-9);
checkBool('sortie noyée', true, noy.outletCondition === 'submerged');
check("perte d'entrée He (m)", 0.031, noy.entranceLoss, 0.001);
check('perte de frottement Hf (m)', 0.019, noy.frictionLoss, 0.001);
check('perte de sortie Hs (m)', 0.156, noy.exitLoss, 0.001);
check('perte totale HL (m)', 0.206, noy.totalLoss, 0.002);
check('somme des trois pertes = HL', noy.totalLoss, noy.entranceLoss + noy.frictionLoss + noy.exitLoss, 1e-12);
check('PHE amont = PHE aval + HL (m)', 13.406, noy.outletWaterElev, 0.002);
checkBool("contrôle par l'aval gouverne", true, noy.control === 'outlet');
check('HW retenu = max(HWi, HWo)', Math.max(noy.hwInlet, noy.hwOutlet), noy.headwater, 1e-12);

title('Pente critique, vitesse limite, revanche et surverse');
checkBool('pente < pente critique : avertissement émis', true, has(bres, 'pente critique'));
checkBool("le calcul aboutit malgré l'avertissement", true, bres.valid && bres.headwater > 0);
checkBool('indicateur de pente cohérent', false, bres.slopeAboveCritical);
const raide = box(4.4, 2.0, 2.0, { length: 30, slope: 0.03, StricklerK: 67, upstreamInvert: 100, tailwater: { mode: 'free' }, inlet: 1 });
checkBool('pente 3 % ≥ pente critique : conforme', true, raide.slopeAboveCritical);
checkBool('aucun avertissement de pente critique', false, has(raide, 'pente critique'));
const vP = (maxVelocity) => ({ length: 30, slope: 0.005, StricklerK: 67, upstreamInvert: 100, tailwater: { mode: 'free' }, inlet: 1, maxVelocity });
check('vitesse maximale par défaut (m/s)', 3.00, box(4.4, 2, 2, vP(undefined)).maxVelocity, 1e-12);
const vSerre = box(4.4, 2, 2, vP(2.0)), vLarge = box(4.4, 2, 2, vP(5.0));
checkBool('V = 2,76 m/s > 2,00 m/s admis : dépassement signalé', false, vSerre.velocityOk);
checkBool("avertissement d'érosion et de protection", true, has(vSerre, 'érosion'));
checkBool('même vitesse sous 5,00 m/s admis : conforme', true, vLarge.velocityOk);
check('la vitesse calculée ne dépend pas du seuil (m/s)', vSerre.uniformVelocity, vLarge.uniformVelocity, 1e-12);
checkBool('revanche positive → marge disponible', true, C.freeboardLabel(0.42) === 'marge disponible');
checkBool("revanche nulle → niveau d'eau à la chaussée", true, C.freeboardLabel(0.0) === "niveau d'eau à la chaussée");
checkBool('revanche négative → chaussée submergée', true, C.freeboardLabel(-0.15) === 'chaussée submergée');
const sansSurverse = box(8.0, 2.0, 2.0, { length: 30, slope: 0.005, StricklerK: 67, upstreamInvert: 100,
  tailwater: { mode: 'free' }, roadLevel: 100.9, minFreeboard: 0.5, inlet: 1, Ke: 0.40, allowRoadOverflow: false });
checkBool('revanche négative détectée', true, sansSurverse.freeboard < 0);
checkBool('revanche non conforme', false, sansSurverse.freeboardOk);
check('aucun débit déversé sans l\'option', 0.0, sansSurverse.roadDischarge, 1e-12);
check("tout le débit reste dans l'ouvrage (m³/s)", 8.0, sansSurverse.culvertDischarge, 1e-12);
checkBool('surverse non calculée : hypothèse affichée', true, has(sansSurverse, 'surverse non calculée'));
checkBool('option activée : le débit se partage', true, d.roadDischarge > 0 && d.culvertDischarge < 8.0);
check('bilan Q dalot + Q route = Q total (m³/s)', 8.0, d.culvertDischarge + d.roadDischarge, 1e-8);
checkBool('classement revanche : conforme / insuffisante / surverse / non vérifiable', true,
  C.freeboardCompliance(0.55, 0.50) === 'conforme' && C.freeboardCompliance(0.20, 0.50) === 'insuffisante'
  && C.freeboardCompliance(-0.10, 0.50) === 'surverse de la route' && C.freeboardCompliance(NaN, 0.50) === 'non vérifiable');

title('Anciens projets — conservation des hypothèses enregistrées');
check('projet neuf : vitesse maximale (m/s)', 3.00, C.maxVelocityFor(C.HYDRAULIC_DEFAULTS.schemaVersion, 0), 1e-12);
check('projet schéma 2 : vitesse alors appliquée (m/s)', 3.50, C.maxVelocityFor(2, 0), 1e-12);
check('projet schéma 1 : vitesse alors appliquée (m/s)', 3.50, C.maxVelocityFor(1, 0), 1e-12);
check('valeur enregistrée conservée, ex. 5 m/s', 5.00, C.maxVelocityFor(3, 5.00), 1e-12);
check('valeur enregistrée prioritaire même sur un ancien schéma', 5.00, C.maxVelocityFor(1, 5.00), 1e-12);
checkBool('schéma 1 avec PHE aval : « PHE connue »', true, C.tailwaterModeFor(1, 'none', 13.0) === 'known');
checkBool('schéma 1 sans PHE aval : « sortie libre supposée »', true, C.tailwaterModeFor(1, 'none', 0) === 'free');
checkBool('schéma ≥ 2 : mode enregistré conservé', true,
  C.tailwaterModeFor(2, 'none', 13.0) === 'none' && C.tailwaterModeFor(3, 'channel', 0) === 'channel');

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Program.cs — abaques BCEOM
// ═══════════════════════════════════════════════════════════════════════════════════════════

title('Abaques BCEOM — inventaire et lecture');
const data = C.BCEOM_ABAQUES;
checkBool('fichier d\'abaques chargé (module de données)', true, !!data && data.abaques_niveau_amont.length === 5);
function checkAnchor(fig, curve, qStar, h1Star) {
  const { result: r, note } = C.bceomRead(fig, curve, qStar, 1.0, 0);
  check(`fig ${fig} ${curve} Q*=${qStar} → H1*`, h1Star, r ? r.h1Star : NaN, 1e-9);
  checkBool(`fig ${fig} Q*=${qStar} : ancre prioritaire`, true, r != null && r.usedValidationAnchor);
  if (!r) console.log('     motif : ' + note);
}
checkAnchor(73, 'chanfrein_type_A', 0.171, 0.795);
checkAnchor(73, 'chanfrein_type_A', 0.134, 0.690);
checkAnchor(75, 'courbe_2_sifflet_talus', 0.280, 0.810);
checkAnchor(75, 'courbe_2_sifflet_talus', 0.169, 0.600);
checkAnchor(77, 'A_ailes_30_75', 0.280, 0.830);
checkAnchor(77, 'A_ailes_30_75', 0.287, 0.840);
{
  const m = C.findBceomCorrespondence('box', 1);
  checkBool('table de correspondance : ailes 30–75 → fig. 77 A', true, !!m && m.figure === 77 && m.curveId === 'A_ailes_30_75' && m.exact);
  checkBool('bague biseautée absente de la table BCEOM', true, C.findBceomCorrespondence('circular', 301) === null);
}

function resolveCurveId(figure, key) {
  const curves = figure.courbes;
  if (!key || !String(key).trim()) return curves[0].id;
  const k = String(key).toLowerCase();
  const byId = curves.find((cv) => cv.id.toLowerCase() === k || cv.id.toLowerCase().startsWith(k) || cv.id.toLowerCase().endsWith('_' + k));
  if (byId) return byId.id;
  const n = parseInt(key, 10);
  if (Number.isInteger(n) && n >= 1 && n <= curves.length) return curves[n - 1].id;
  return curves[0].id;
}
let exOk = 0, exTotal = 0;
for (const ex of data.exemples_validation) {
  const txt = ex.resultat || '';
  const eq = txt.indexOf('=');
  const expected = eq >= 0 ? Number(txt.slice(eq + 1)) : NaN;
  if (!Number.isFinite(expected)) continue;
  exTotal++;
  let read = null;
  if (ex.figure === 79 || ex.figure === 82) read = C.bceomCriticalSlopeReduced(ex.figure === 79 ? 'circular' : 'box', ex['Q*']);
  else if (ex.figure === 83 || ex.figure === 84) read = C.bceomVelocityReduced(ex.figure === 83 ? 'circular' : 'box', ex['Q*']);
  else {
    const figure = data.abaques_niveau_amont.find((f) => f.figure === ex.figure);
    read = C.bceomRead(ex.figure, resolveCurveId(figure, ex.courbe), ex['Q*'], 1.0, 0).result?.h1Star ?? null;
  }
  const tolRel = ex.figure >= 79 ? 0.05 : 0.03;
  const ok = read != null && Math.abs(read - expected) <= tolRel * Math.max(1e-9, expected);
  if (ok) exOk++;
  console.log(`     ${ok ? 'OK  ' : 'FAIL'} fig ${ex.figure} courbe ${String(ex.courbe ?? '').padEnd(2)} Q* = ${ex['Q*'].toFixed(4)} → attendu ` +
    `${expected.toFixed(4)} · lu ${read != null ? read.toFixed(4) + ' · écart ' + ((read / expected - 1) * 100).toFixed(1) + ' %' : 'hors domaine'}`);
}
checkBool('les 14 exemples imprimés sont retrouvés (3 % / 5 %)', true, exOk === exTotal && exTotal === 14);
checkBool('hors domaine bas : aucune valeur', false, C.bceomCriticalSlopeReduced('box', 1e-9) != null);
checkBool('hors domaine haut : aucune valeur', false, C.bceomCriticalSlopeReduced('box', 1e9) != null);
{
  const secCtl = C.rectangularSection(2.0, 2.0);
  const qCtl = 4.4, kCtl = 67, jCtl = 0.005, bCtl = 2.0;
  const ic82 = C.bceomCriticalSlopeReduced('box', qCtl / (Math.sqrt(C.G) * Math.pow(bCtl, 2.5)));
  const icAna = secCtl.frictionSlope(secCtl.criticalDepth(qCtl), qCtl, kCtl);
  check('figure 82 : pente critique (%)', icAna * 100, (ic82 ?? 0) * C.G / (kCtl * kCtl * Math.pow(bCtl, 1 / 3)) * 100, 5e-3);
  const v84 = C.bceomVelocityReduced('box', qCtl / (kCtl * Math.sqrt(jCtl) * Math.pow(bCtl, 8 / 3)));
  const vAna = qCtl / secCtl.area(secCtl.normalDepth(qCtl, kCtl, jCtl));
  check('figure 84 : vitesse uniforme (m/s)', vAna, (v84 ?? 0) * kCtl * Math.pow(bCtl, 2 / 3) * Math.sqrt(jCtl), 5e-3);
}
const bceomBox = box(4.4, 2.0, 2.0, { length: 30, slope: 0.005, StricklerK: 67, upstreamInvert: 100, tailwater: { mode: 'free' }, inlet: 1 });
checkBool('dalot : lecture de la figure 77 courbe A', true, bceomBox.bceom != null && bceomBox.bceom.figure === 77 && bceomBox.bceom.curveId === 'A_ailes_30_75');
if (bceomBox.bceom) console.log('     ' + C.bceomSummary(bceomBox.bceom) + ` · HDS-5 HWi = ${bceomBox.hwInlet.toFixed(3)} m`);
{
  const hwAtt = bceomBox.outletMethod === 'inletGoverningFreeTorrential' ? bceomBox.hwInlet : Math.max(bceomBox.hwInlet, bceomBox.hwOutlet);
  checkBool('la lecture BCEOM ne change pas le niveau retenu', true, Math.abs(bceomBox.headwater - hwAtt) < 1e-12);
}
const bceomPipe = pipe(0.80, 1.00, 102, 0.01, 60, 10.0, 100.0, NaN);
checkBool('buse à emboîtement femelle : figure 72', true, bceomPipe.bceom != null && bceomPipe.bceom.figure === 72);
const bceomOut = pipe(0.50, 1.00, 102, 0.01, 60, 10.0, 100.0, NaN);
checkBool('Q* sous le domaine de la figure 72 : lecture refusée', true, bceomOut.bceom === null && bceomOut.bceomNote.includes('hors du domaine'));
const bceomNone = pipe(0.50, 1.00, 301, 0.01, 60, 10.0, 100.0, NaN);
checkBool('bague biseautée : aucune courbe BCEOM, motif affiché', true, bceomNone.bceom === null && bceomNone.bceomNote.length > 0);
const bceomBig = pipe(12.0, 2.50, 201, 0.01, 40, 20.0, 100.0, NaN);
checkBool('figure 71 refusée au-delà de D = 2 m', true, bceomBig.bceom === null && bceomBig.bceomNote.includes('≤ 2 m'));

// ═══════════════════════════════════════════════════════════════════════════════════════════
// BceomCampaign.cs — trois cas de référence
// ═══════════════════════════════════════════════════════════════════════════════════════════

title('Campagne BCEOM — cas 1 : dalot noyé 4 × 2 m, Q = 14 m³/s, PHE aval 13,20 m');
{
  const r = box(14.0, 4.0, 2.0, { ...noyP, maxVelocity: 3.0 });
  check('Cas1 V pleine section', 1.75, r.fullVelocity, 0.10);
  check('Cas1 ΔHe', 0.031, r.entranceLoss, 0.01);
  check('Cas1 ΔHf', 0.019, r.frictionLoss, 0.01);
  check('Cas1 ΔHs', 0.156, r.exitLoss, 0.01);
  check('Cas1 ΔHtotal', 0.206, r.totalLoss, 0.01);
  check('Cas1 PHE amont', 13.406, r.outletWaterElev, 0.03);
  checkBool('Cas1 sortie noyée', true, r.outletCondition === 'submerged');
  checkBool("Cas1 contrôle par l'aval", true, r.control === 'outlet');
}
function freeOutletCase(tag, cells, b, dd, qTotal, q, e) {
  title(`Campagne BCEOM — ${tag} : ${cells} dalots ${b}×${dd} m, Q = ${qTotal} m³/s, sortie libre`);
  const VMax = 3.0;
  const qStar = C.bceomReducedDischarge('box', b, dd, q);
  const bceom = C.bceomRead(77, 'A_ailes_30_75', qStar, dd, 0).result;
  const sec = C.rectangularSection(b, dd);
  const yc = sec.criticalDepth(q);
  const vc = q / sec.area(Math.min(yc, dd));
  const velocityOk = vc <= VMax + 1e-12;
  const accepted = bceom != null && velocityOk;
  const hds = box(qTotal, b, dd, { length: 20, slope: 0.01, StricklerK: 67, upstreamInvert: 100, tailwater: { mode: 'free' }, inlet: 1, maxVelocity: VMax }, cells);
  console.log(`     HDS-5 HWi / HWo / HW = ${hds.hwInlet.toFixed(3)} / ${hds.hwOutlet.toFixed(3)} / ${hds.headwater.toFixed(3)} m` +
    (bceom ? ` · BCEOM H1 = ${bceom.headwater.toFixed(3)} m · Vc = ${vc.toFixed(3)} m/s` : ''));
  check(`${tag} Q*`, e.qStar, qStar, 0.03 * e.qStar);
  checkBool(`${tag} lecture BCEOM figure 77 A`, true, bceom != null);
  if (bceom) {
    check(`${tag} H1*`, e.h1Star, bceom.h1Star, 0.03 * e.h1Star);
    check(`${tag} H1`, e.h1, bceom.headwater, 0.03);
    checkBool(`${tag} ancre de validation utilisée`, true, bceom.usedValidationAnchor);
  }
  check(`${tag} Vc`, e.vc, vc, 0.10);
  checkBool(`${tag} conformité vitesse`, e.velocityOk, velocityOk);
  checkBool(`${tag} dimension ${e.accepted ? 'acceptable' : 'rejetée'}`, e.accepted, accepted);
  checkBool(`${tag} HDS-5 : configuration appliquée`, true, hds.hds5Applied && hds.valid);
}
freeOutletCase('Cas2', 2, 2.0, 2.0, 14.0, 7.0, { qStar: 0.280, h1Star: 0.830, h1: 1.66, vc: 3.25, velocityOk: false, accepted: false });
freeOutletCase('Cas3', 4, 1.5, 1.5, 14.0, 3.5, { qStar: 0.287, h1Star: 0.840, h1: 1.26, vc: 2.85, velocityOk: true, accepted: true });

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Program.cs — HWo torrentiel hors domaine, fluvial, ancres, vérification provisoire, fils d'eau
// ═══════════════════════════════════════════════════════════════════════════════════════════

title('HWo torrentiel hors domaine, régime fluvial, ancres BCEOM, vérification provisoire');
let torr = null, torrCase = null;
for (const [qT, bT, hT, lenT, jT] of [[0.35, 1.5, 1.5, 25, 0.02], [0.50, 1.5, 1.5, 30, 0.025], [0.80, 2.0, 1.5, 20, 0.03],
  [1.20, 2.0, 2.0, 40, 0.04], [0.20, 1.0, 1.0, 15, 0.05], [0.15, 1.5, 1.5, 35, 0.015]]) {
  const t = box(qT, bT, hT, { length: lenT, slope: jT, StricklerK: 70, upstreamInvert: 100, tailwater: { mode: 'free' }, inlet: 1 });
  if (t.valid && t.slopeAboveCritical && t.outletCondition === 'free' && t.hwOutlet < 0.75 * hT && t.hwOutlet > t.hwInlet
      && (t.outletMethod === 'inletGoverningFreeTorrential' || t.outletMethod === 'fhwaApproximation')) {
    torr = t; torrCase = [qT, bT, hT, jT]; break;
  }
}
checkBool('cas torrentiel libre HWo > HWi trouvé pour le test', true, torr != null);
if (torr) {
  checkBool('HWo hors domaine ne gouverne pas', true, torr.control === 'inlet' && Math.abs(torr.headwater - torr.hwInlet) < 1e-12);
  checkBool('méthode = entrée — sortie libre torrentielle', true, torr.outletMethod === 'inletGoverningFreeTorrential');
  checkBool('HWo approximatif conservé en information', true, torr.hwOutlet > torr.hwInlet);
  checkBool('note HWo indicatif', true, torr.outletMethodNote.toLowerCase().includes('indicatif'));
}
const fluvial = box(4.4, 2.0, 2.0, { length: 30, slope: 0.005, StricklerK: 67, upstreamInvert: 100, tailwater: { mode: 'free' }, inlet: 1 });
checkBool('cas fluvial : pas directs', true, fluvial.outletMethod === 'directStep');
checkBool('cas fluvial : I < Ic', true, !fluvial.slopeAboveCritical);
checkBool('avertissement provisoire fluvial', true, has(fluvial, 'régime fluvial influençable'));
checkBool('réserve BCEOM régime torrentiel', true,
  (fluvial.bceom?.note ?? fluvial.bceomNote).includes('Hypothèse BCEOM de régime torrentiel non satisfaite'));
{
  const anchor = C.bceomRead(77, 'A_ailes_30_75', 0.28, 2.0, 0).result;
  checkBool('ancre exacte fig. 77 : UsedValidationAnchor', true, !!anchor && anchor.usedValidationAnchor);
  checkBool('ancre exacte : message ancre prioritaire', true, !!anchor && anchor.note.toLowerCase().includes('ancre de validation'));
  check('ancre exacte H1*', 0.83, anchor.h1Star, 1e-9);
  const interp = C.bceomRead(77, 'A_ailes_30_75', 0.2835, 2.0, 0).result;
  checkBool('interpolation entre deux ancres : pas une ancre exacte', true, !!interp && !interp.usedValidationAnchor);
  checkBool('interpolation : message log entre points digitalisés', true, !!interp && interp.note.includes('Interpolation logarithmique'));
  const hors = C.bceomRead(77, 'A_ailes_30_75', 1e-6, 2.0, 0);
  checkBool('hors domaine : null + extrapolation refusée', true, hors.result === null && hors.note.includes('extrapolation refusée'));
}
checkBool('vérification provisoire (aval + route)', true, has(fluvial, 'Vérification hydraulique provisoire'));
const withRoad = box(4.4, 2.0, 2.0, { length: 30, slope: 0.005, StricklerK: 67, upstreamInvert: 100,
  tailwater: { mode: 'known', level: 100.2 }, roadLevel: 102.0, minFreeboard: 0.5, inlet: 1 });
checkBool('aval justifié + Z route : pas de message provisoire global', false, has(withRoad, 'Vérification hydraulique provisoire'));
const noRoad = box(2.0, 2.0, 1.5, { length: 20, slope: 0.01, StricklerK: 70, upstreamInvert: 100, tailwater: { mode: 'free' }, inlet: 1 });
checkBool('sans Z chaussée : calcul OK + avertissement provisoire', true, noRoad.valid && has(noRoad, 'point bas de la chaussée'));
{
  const rFe = box(1.0, 1.5, 1.5, { length: 15, slope: 0.01, StricklerK: 70, upstreamInvert: 100, tailwater: { mode: 'known', level: 100.25 }, inlet: 1 });
  check('moteur ZFE aval', 99.85, rFe.downstreamInvert, 1e-9);
  check('moteur TW = PHE − ZFE', 0.40, rFe.tailwaterDepth, 1e-9);
  check('moteur ZPHE amont = ZFE + HW', 100.0 + rFe.headwater, rFe.upstreamWaterElev, 1e-9);
}

// ── calcul_hydraulique.csv : valeurs et avertissements produits par le code C# ─────────────
title('CSV de contrôle de BVTrace (sortie du code C#, 3 décimales)');
function csvRow(name, r, ref) {
  check(`${name} TW`, ref.tw, r.tailwaterDepth, 5e-4);
  check(`${name} HWi`, ref.hwi, r.hwInlet, 5e-4, true);
  check(`${name} HWo`, ref.hwo, r.hwOutlet, 5e-4, true);
  check(`${name} HW`, ref.hw, r.headwater, 5e-4, true);
  checkStr(`${name} méthode « ${ref.method} »`, ref.method, C.methodLabel(r.outletMethod));
  checkStr(`${name} contrôle « ${ref.control} »`, ref.control, r.control === 'inlet' ? 'Entrée' : 'Aval (sortie)');
  checkStr(`${name} régime « ${ref.regime} »`, ref.regime, r.slopeAboveCritical ? 'Torrentiel' : 'Fluvial');
  checkStr(`${name} avertissements identiques au texte C#`, ref.warnings, r.warnings.join('; '));
}
if (torr && torrCase[0] === 0.35) {
  csvRow('BVT-torr-libre', torr, { tw: 0, hwi: 0.260, hwo: 0.341, hw: 0.260, method: "contrôle à l'entrée — sortie libre torrentielle",
    control: 'Entrée', regime: 'Torrentiel',
    warnings: "Niveau amont sous contrôle à la sortie calculé par méthode approchée.; Approximation FHWA hors domaine (HWo = 0.341 m < 0,75 D) : valeur indicative, à confronter à un calcul de remous.; HWo approximatif indicatif non retenu pour le dimensionnement (hors domaine HWo < 0,75 D, sortie libre torrentielle) — HWdesign = HWi.; Vérification provisoire : cote du point bas de la chaussée non renseignée, revanche et surverse non vérifiables.; Vérification hydraulique provisoire : condition aval supposée et cote de chaussée non renseignée." });
} else { checkBool('BVT-torr-libre : même cas que la validation C# (Q = 0,35)', true, false); }
csvRow('BVT-fluvial', fluvial, { tw: 0, hwi: 1.254, hwo: 1.340, hw: 1.340, method: 'pas directs', control: 'Aval (sortie)', regime: 'Fluvial',
  warnings: "Vérification provisoire : cote du point bas de la chaussée non renseignée, revanche et surverse non vérifiables.; Pente de l'ouvrage 0.500 % < pente critique 0.514 % : un régime non torrentiel ou un ressaut hydraulique peut apparaître dans l'ouvrage.; Résultat provisoire : régime fluvial influençable par l'aval. Une PHE aval réelle ou un profil du chenal récepteur est recommandé.; Vérification hydraulique provisoire : condition aval supposée et cote de chaussée non renseignée." });
csvRow('BVT-aval-route', withRoad, { tw: 0.350, hwi: 1.254, hwo: 1.340, hw: 1.340, method: 'pas directs', control: 'Aval (sortie)', regime: 'Fluvial',
  warnings: "Pente de l'ouvrage 0.500 % < pente critique 0.514 % : un régime non torrentiel ou un ressaut hydraulique peut apparaître dans l'ouvrage." });

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Program.cs — proposition des dalots (CulvertSizing)
// ═══════════════════════════════════════════════════════════════════════════════════════════

title('Dimensionnement (CulvertSizing)');
const sizingParams = { length: 20.0, StricklerK: 70, upstreamInvert: 100.0, tailwater: { mode: 'free' }, roadLevel: 105.0, inlet: 1 };
const sz = C.sizeCulvert(2.0, { shape: 'box', slopePct: 0.5, fallback: false }, sizingParams);
checkBool('propositions HDS-5 disponibles', true, sz.candidates.length > 0);
checkBool('propositions HDS-5 : H ≤ B', true, sz.candidates.every((p) => p.height <= p.width + 1e-9));
checkBool('propositions HDS-5 : B ≤ H + 2', true, sz.candidates.every((p) => p.width <= p.height + 2.0 + 1e-9));
checkBool('candidates triées par score décroissant', true, sz.candidates.every((p, i, l) => i === 0 || l[i - 1].score >= p.score));
checkBool('retenue = meilleur score (choix BVTrace)', true, sz.retained === sz.best && sz.best === sz.candidates[0]);
checkBool('chaque proposition passe les critères durs', true, sz.candidates.every((p) =>
  p.result.valid && !p.result.capacityExceeded && p.result.fillRatioPct <= 75 && p.result.uniformVelocity <= 3.0
  && p.result.headwater <= 1.2 * p.height && p.result.freeboardOk));
{
  const big = C.sizeCulvert(12.0, { shape: 'box', slopePct: 0.5, fallback: false }, sizingParams);
  checkBool('« examined » : toutes les combinaisons, rejets motivés', true,
    big.examined.some((e) => !e.accepted && e.reasons.length > 0)
    && big.examined.filter((e) => e.accepted).length >= big.candidates.length);
  console.log(`     Q = 12 m³/s : ${big.examined.length} combinaisons examinées, ${big.candidates.length} retenables · ${big.retained?.rationale}`);
}
console.log(`     retenue : ${sz.retained.rationale} · pente ${sz.retained.slopePct} %`);
console.log(`     plus petite section : ${sz.smallest.rationale}`);
{
  // Recalcul direct de la proposition retenue : mêmes résultats que dans la recherche.
  const p = sz.retained;
  const r = box(2.0, p.width, p.height, { ...sizingParams, slope: p.slopePct / 100 }, p.cells);
  check('proposition retenue recalculée : HW (m)', p.result.headwater, r.headwater, 1e-12);
  checkBool('stratégie « smallest » : aire totale minimale', true,
    C.sizeCulvert(2.0, { shape: 'box', slopePct: 0.5, strategy: 'smallest' }, sizingParams).retained.totalArea
      <= Math.min(...sz.candidates.map((x) => x.totalArea)) + 1e-12);
}
{
  const szp = C.sizeCulvert(1.5, { shape: 'buse', slopePct: 1.0 }, { ...sizingParams, inlet: 101 });
  checkBool('buses : diamètres du catalogue seulement', true,
    szp.candidates.length > 0 && szp.candidates.every((p) => C.PIPE_DIAMETERS.includes(p.height) && p.width === p.height));
  console.log(`     buse retenue : ${szp.retained.rationale}`);
  const szFree = C.sizeCulvert(1.5, { shape: 'buse' }, { ...sizingParams, inlet: 101 });
  checkBool('pente libre : pente retenue multiple de 0,1 %', true,
    szFree.slopeFree && szFree.candidates.every((p) => Math.abs(p.slopePct * 10 - Math.round(p.slopePct * 10)) < 1e-9));
  const hwMax = 0.9;
  const szHw = C.sizeCulvert(2.0, { shape: 'box', slopePct: 0.5, maxHeadwater: hwMax }, sizingParams);
  checkBool('HW admissible respecté par toutes les propositions', true,
    szHw.candidates.length > 0 && szHw.candidates.every((p) => p.result.headwater <= hwMax + 1e-4));
  const none = C.sizeCulvert(2.0, { shape: 'box', slopePct: 0.5 }, { ...sizingParams, inlet: 101 });
  checkBool('entrée de buse imposée à un dalot : aucune proposition', true, none.retained === null && none.message.length > 0);
  checkBool('pente critique → pente de projet : 0,519 % → 0,6 %', true, C.slopeAboveCritical(0.519) === 0.6 && C.slopeAboveCritical(0.5) === 0.5);
  checkBool('catalogue dalots : H ≤ B ≤ H + 2, pas 1 m / 0,5 m', true,
    C.boxCatalogue().every((s) => s.height <= s.width && s.width <= s.height + 2) && C.boxCatalogue().length === 11);  // B=2 : 2 · B=3 : 4 · B=4 : 5
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Cas vérifiés à la main (formules écrites indépendamment du module)
// ═══════════════════════════════════════════════════════════════════════════════════════════

title('Vérifications à la main');
{
  // 1. Débit plein d'un dalot 2 × 2 m par Manning-Strickler, K = 67, J = 0,5 % :
  //    A = 4 m², P = 8 m, Rh = 0,5 m → Q = 67 × 4 × 0,5^(2/3) × √0,005 = 11,938 m³/s par cellule.
  const qFull = 67 * 4 * Math.pow(0.5, 2 / 3) * Math.sqrt(0.005);
  check('Q plein 2×2 (calcul à la main ≈ 11,938 m³/s)', 11.938, qFull, 5e-4);
  const r1 = box(4.4, 2, 2, { length: 30, slope: 0.005, StricklerK: 67, inlet: 1 });
  check('Q plein 1 × 2×2 : moteur = Manning-Strickler', qFull, r1.fullCapacity, 1e-9);
  const r3 = box(13.2, 2, 2, { length: 30, slope: 0.005, StricklerK: 67, inlet: 1 }, 3);
  check('Q plein 3 × 2×2 = 3 × Q cellule', 3 * qFull, r3.fullCapacity, 1e-9);
  // 2. Tirant normal : q = K·B·y·(B·y/(B+2y))^(2/3)·√J doit redonner 4,4 m³/s.
  const yn = r1.normalDepth;
  check('tirant normal : Manning à la main redonne q', 4.4, 67 * 2 * yn * Math.pow(2 * yn / (2 + 2 * yn), 2 / 3) * Math.sqrt(0.005), 1e-9);
  check('vitesse uniforme V = q/(B·yn)', 4.4 / (2 * yn), r1.uniformVelocity, 1e-12);
  // 3. Contrôle à l'entrée, dalot 2 × 2, q = 4,4, abaque 8 échelle 1 (forme 1, K = 0,026, M = 1, Ks = −0,5) :
  //    yc = (q²/(g·B²))^(1/3) ; Hc = 1,5·yc ; X = 1,811·q/(B·D·√D) ≤ 1,93 → HW/D = Hc/D + 0,026·X − 0,5·J.
  const yc = Math.pow(4.4 * 4.4 / (9.81 * 4), 1 / 3);
  const X = 1.811 * 4.4 / (4 * Math.sqrt(2));
  const hwi = 2 * (1.5 * yc / 2 + 0.026 * X - 0.5 * 0.005);
  check('X dalot (à la main)', X, r1.inletX, 1e-12);
  checkBool('X ≤ 1,93 : équation dénoyée', true, X <= 1.93 && r1.inletRegime === 'unsubmerged');
  check('HWi dalot dénoyé (à la main ≈ 1,2535 m)', hwi, r1.hwInlet, 1e-9);
  check('HWi dalot dénoyé = CSV BVTrace 1,254', 1.254, hwi, 5e-4);
  // 4. Contrôle à l'entrée noyé, buse béton D = 1 m, Q = 2 m³/s (abaque 1 éch. 1 : c = 0,0398, Y = 0,67) :
  //    X = 1,811·2/(π/4) ; HW/D = c·X² + Y − 0,5·J.
  const Xp = 1.811 * 2 / (Math.PI / 4);
  check('HWi buse noyée (à la main)', 1.0 * (0.0398 * Xp * Xp + 0.67 - 0.5 * 0.01), p2.hwInlet, 1e-12);
  // 5. Contrôle à la sortie noyée, dalot 4 × 2, PHE 13,20 (cas 1) :
  //    HWo = TW + (Ke + 1)·V²/2g + L·V²/(K²·Rh^(4/3)) − J·L, Rh pleine section en charge = 8/12.
  const V = 14 / 8, rh = 8 / 12;
  const hwo = (13.20 - (10 - 0.01 * 15.8)) + (0.2 + 1) * V * V / (2 * 9.81) + 15.8 * V * V / (67 * 67 * Math.pow(rh, 4 / 3)) - 0.01 * 15.8;
  check('HWo sortie noyée (à la main)', hwo, noy.hwOutlet, 1e-12);
  // 6. Transition 1,93 < X < 2,21 : interpolation linéaire entre les deux équations.
  const qT = 2.05 * 4 * Math.sqrt(2) / 1.811;  // X = 2,05
  const rt = box(qT, 2, 2, { length: 30, slope: 0.01, StricklerK: 67, inlet: 1 });
  const lam = (rt.inletX - 1.93) / (2.21 - 1.93);
  checkBool('X = 2,05 : zone de transition', true, rt.inletRegime === 'transition');
  check('HWi transition = interpolation linéaire', 2 * ((1 - lam) * rt.inletRatioUnsubmerged + lam * rt.inletRatioSubmerged), rt.hwInlet, 1e-12);
  // 7. Vitesses de sortie (ajout du portage) : contrôle à l'entrée → V au tirant normal.
  const vr = box(3.0, 2, 1.5, { length: 20, slope: 0.02, StricklerK: 70, inlet: 4 });
  checkBool('vitesse de sortie sous contrôle à l\'entrée = V uniforme', true,
    vr.control === 'inlet' ? Math.abs(vr.velocities.outlet - vr.uniformVelocity) < 1e-12 : true);
  // 8. HW admissible (ajout du portage) : avertissement ajouté APRÈS ceux de BVTrace.
  const hwAdm = box(4.4, 2, 2, { length: 30, slope: 0.005, StricklerK: 67, upstreamInvert: 100, inlet: 1, maxHeadwater: 1.0 });
  checkBool('HW > HW admissible : signalé', true, hwAdm.headwaterOk === false && hwAdm.warnings.at(-1).startsWith('HW = '));
  // 9. Cote minimale de rasante (CulvertClearance) : radier 100 + H 2 + dalle 0,30 + couverture max(1 ; 0,8).
  check('cote minimale de rasante (m)', 103.30, C.minRoadLevelOverCulvert({ invertAtCrossing: 100, height: 2, slabThickness: 0.30, cover: 0.8 }).zMin, 1e-12);
}

// ─── bilan ─────────────────────────────────────────────────────────────────────────────────
console.log(`\n${checks} contrôles · plus grand écart relatif sur les références C# : ${(maxRelCs * 100).toExponential(2)} %`);
console.log(failures === 0 ? 'TOUS LES CONTRÔLES PASSENT' : `${failures} CONTRÔLE(S) EN ÉCHEC`);
if (deviations > 0)
  console.log(`${deviations} écart(s) documenté(s) avec les références K-HydroRoute du cas D (non bloquants, comme dans BVTrace).`);
process.exitCode = failures === 0 ? 0 : 1;
