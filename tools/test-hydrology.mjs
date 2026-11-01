// test-hydrology.mjs — banc d'essai du portage JS du calcul hydrologique de BVTrace (js/hydro/hydrology.js).
//
//   node tools/test-hydrology.mjs        (code de retour ≠ 0 en cas d'échec)
//
// Rejoue les campagnes de validation de BVTrace :
//   BVTrace.Validation/CiehCampaign.cs, OrstomCampaign.cs, RunoffCoefficientCampaign.cs, ChecklistCampaign.cs
//   et les contrôles hydrologiques de tools/ReportCheck/Program.cs (abaque C, tc retenu, Giandotti,
//   Francou-Rodier, « ne pas utiliser », tables de T de Frigui, jeu FAO 54 du modèle de contrôle).
// Les valeurs imprimées du bulletin FAO 54 sont contrôlées avec la tolérance de la campagne C# (2 %, 0,6 %
// ou 1 % selon la grandeur, le manuel arrondissant à chaque étape) ; les recalculs indépendants faits
// ici à partir des formules (et non du module) sont contrôlés à 0,5 % au plus — le plus souvent à 1e-9.
// Contrôles non portés : WorldCover (classes de couleurs) et frontières Natural Earth (CountryLookup),
// qui ne font pas partie du module (voir le compte rendu de portage).

import * as H from '../js/hydro/hydrology.js';

let failures = 0, passed = 0;
const pad = (s, n) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
function check(label, ok, got = '') {
  if (ok) passed++; else failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${pad(label, 62)} ${got}`);
}
/** Écart relatif |obtenu − attendu| / attendu ≤ tolPct %. */
function near(label, expected, actual, tolPct = 0.5) {
  if (actual == null || !Number.isFinite(actual)) { check(label, false, `non calculé (${actual})`); return; }
  const dev = expected === 0 ? Math.abs(actual) * 100 : 100 * (actual - expected) / expected;
  check(label, Math.abs(dev) <= tolPct, `attendu ${expected.toFixed(4)}  obtenu ${actual.toFixed(4)}  écart ${dev.toFixed(3)} % (tol. ${tolPct} %)`);
}
const exact = (label, expected, actual) => check(label, actual === expected || Math.abs(actual - expected) < 1e-9,
  `attendu ${expected}  obtenu ${actual}`);
const section = (t) => console.log(`\n=== ${t} ===`);
const hasW = (r, s) => r.warnings.some((w) => w.includes(s));

// ═════════════════════════════════════════════════════════════════════════
section('Régressions CIEH — bulletin FAO 54, exemples pages 71-73 (CiehCampaign)');
// ═════════════════════════════════════════════════════════════════════════
near('abattement A · Pan 500 mm · S 6 km2', 0.89, H.abattement(500, 6), 1.0);
near('abattement A · Pan 550 mm · S 30 km2', 0.80, H.abattement(550, 30), 1.0);
near('Kr10 grès · Pan 500 mm', 29, H.kr10FromGeology('grès', 500), 2.0);
near('Kr10 granite + gneiss · Pan 550 mm', 34, H.kr10FromGeology('granite + gneiss', 550), 2.0);

const petit = { areaKm2: 6, igMPerKm: 20, kr10Pct: 32, pm10Mm: 76.5, panMm: 500 };
const moyen = { areaKm2: 30, igMPerKm: 15, kr10Pct: 34, ddKmPerKm2: 5.7, panMm: 550 };
const qCieh = (no, inp) => H.applyCiehRegression(no, inp).q10;
for (const [no, exp] of [[10, 32], [26, 25], [40, 23], [42, 33], [12, 37]]) near(`ligne ${no} petit bassin (manuel)`, exp, qCieh(no, petit), 2.0);
for (const [no, exp] of [[5, 99], [10, 77], [48, 107], [11, 78], [23, 101]]) near(`ligne ${no} bassin moyen (manuel)`, exp, qCieh(no, moyen), 2.0);
// Recalcul indépendant (coefficients du tableau 11 retapés) : fidélité ≤ 0,5 %.
near('ligne 10 petit bassin = 0,0833·6^0,696·20^0,953·32^0,534', 0.0833 * 6 ** 0.696 * 20 ** 0.953 * 32 ** 0.534, qCieh(10, petit));
near('ligne 26 petit bassin = 146·6^0,479·76,5^-0,969·32^0,457', 146 * 6 ** 0.479 * 76.5 ** -0.969 * 32 ** 0.457, qCieh(26, petit));
near('ligne 5 bassin moyen = 1,83·30^0,62·15^0,618·5,7^0,121', 1.83 * 30 ** 0.62 * 15 ** 0.618 * 5.7 ** 0.121, qCieh(5, moyen));
const sansKr = H.applyCiehRegression(10, { areaKm2: 6, igMPerKm: 20 });
check('refus si Kr10 manquant', !sansKr.ok && sansKr.reason.includes('Kr10'), sansKr.reason);
check("aucune régression n'exponentie Pan", H.listCiehRegressions().every((r) => !r.formula.includes('Pan^')));
check('48 régressions du tableau 11 listées avec domaine', H.listCiehRegressions().length === 48
  && H.listCiehRegressions().every((r) => r.required.length > 0 && 'domain' in r));

// Proposition : le pays se passe explicitement (frontières Natural Earth non portées).
const sugg = H.suggestCiehRegressions({ lon: -1.0, pan: 500, country: 'Burkina Faso' });
check('proposition : découpages Burkina Faso retenus', sugg.some((s) => s.groupe.includes('Burkina Faso')), `${sugg.length} régression(s)`);
check('proposition : pas de pays étranger au bassin', sugg.every((s) => s.groupe !== "Côte d'Ivoire"));
check('proposition : motif renseigné partout', sugg.every((s) => s.motif.length > 0));
const est = H.suggestCiehRegressions({ lon: 20, pan: 500, country: 'Tchad' });
check('proposition : bande de longitude respectée', est.every((s) => !s.groupe.includes('10° Ouest et 10° Est') && !s.groupe.includes('de 10° E à 10° W')), `${est.length} à 20° E`);
const sansPays = H.suggestCiehRegressions({ lon: -1.0, pan: 500 });
const countryGroups = new Set(H.listCiehRegressions().filter((r) => r.domain.countries).map((r) => r.groupe));
check('proposition : pas de pays ⇒ aucun découpage par pays', sansPays.every((s) => !countryGroups.has(s.groupe)));
const sansLon = H.suggestCiehRegressions({ pan: 500 });
check('proposition : pas de longitude ⇒ pas de découpage géo', sansLon.every((s) => !s.motif.includes('longitude')));

// ═════════════════════════════════════════════════════════════════════════
section('Méthode Orstom — bulletin FAO 54, exemples pages 55-60 (OrstomCampaign)');
// ═════════════════════════════════════════════════════════════════════════
const rm = H.computeOrstom({ zone: 'sahelienne', areaKm2: 30, igMPerKm: 15, panMm: 550, p10Mm: 88,
  infiltrabilityOrdinal: 1.2, alpha10: 1.9, delayedRunoffRatio: 0.04 });
check('bassin moyen calculé', rm.ok, rm.reason);
near('bassin moyen · abattement A (manuel)', 0.80, rm.abattement, 0.6);
near('bassin moyen · Pm10 (manuel)', 70.4, rm.pm10Mm, 0.6);
near('bassin moyen · Kr10 % (manuel)', 44, rm.kr10Pct, 2);
near('bassin moyen · Kr70 exposé (manuel)', 40, rm.kr70Pct, 2);
near('bassin moyen · Kr100 exposé (manuel)', 46, rm.kr100Pct, 2);
near('bassin moyen · Lr10 mm (manuel)', 31.0, rm.lr10Mm, 2);
near('bassin moyen · Vr10 m3 (manuel)', 930000, rm.vr10M3, 2);
near('bassin moyen · Tb10 min (manuel)', 224, rm.tb10Min, 2);
near('bassin moyen · Qm10 (manuel)', 69.2, rm.qm10, 2);
near('bassin moyen · Qr10 (manuel)', 131.5, rm.qr10, 2);
near('bassin moyen · Q10 (manuel)', 136.8, rm.q10, 2);
near('bassin moyen · Vret10 (manuel)', 70700, rm.vret10M3, 2);
near('bassin moyen · Tm10 (manuel)', 62, rm.tm10Min, 2);

// Recalcul indépendant de la chaîne (équations du manuel, coefficients des tableaux 1 et 2 retapés).
{
  const A = 1 - (161 - 0.042 * 550) / 1000 * Math.log10(30), Pm = 88 * A;
  const kr = (a, b, c) => a / (30 + b) + c;
  const k70 = kr(1455, 33, 21) + (kr(329, 18.5, 16.5) - kr(1455, 33, 21)) * 0.2;   // I → RI à l'ordinal 1,2
  const k100 = kr(1833, 38, 24) + (kr(421, 20.5, 17.5) - kr(1833, 38, 24)) * 0.2;
  const K = k70 + (k100 - k70) * (88 - 70) / 30;
  const tb10 = (5 * 10 + 139) + ((5 * 10 + 120) - (5 * 10 + 139)) * 0.1;         // branches I/P à S = 10
  const tb45 = 55 * 45 ** 0.35 + 30;
  const Tb = tb10 + (tb45 - tb10) * (Math.log10(30) - 1) / (Math.log10(45) - 1);   // interpolation logarithmique
  const Qm = 16.7 * Pm * K / 100 * 30 / Tb, Q10 = 1.9 * Qm * 1.04;
  near('bassin moyen · Kr10 recalculé', K, rm.kr10Pct);
  near('bassin moyen · Tb10 recalculé', Tb, rm.tb10Min);
  near('bassin moyen · Q10 recalculé', Q10, rm.q10);
}
const k70 = H.orstomKr10({ zone: 'sahelienne', areaKm2: 30, igMPerKm: 15, panMm: 550, p10Mm: 70, infiltrabilityOrdinal: 1.2 }).value;
const k100 = H.orstomKr10({ zone: 'sahelienne', areaKm2: 30, igMPerKm: 15, panMm: 550, p10Mm: 100, infiltrabilityOrdinal: 1.2 }).value;
near('bassin moyen · Kr70 (manuel)', 40, k70, 2);
near('bassin moyen · Kr100 (manuel)', 46, k100, 2);

const refus = H.computeOrstom({ zone: 'sahelienne', areaKm2: 6, igMPerKm: 20, panMm: 500, p10Mm: 86, infiltrabilityOrdinal: 2 });
check('petit bassin · refus Kr10 hors domaine', !refus.ok && refus.reason.includes('Kr10'), refus.ok ? 'calculé à tort' : refus.reason);
const rp = H.computeOrstom({ zone: 'sahelienne', areaKm2: 6, igMPerKm: 20, panMm: 500, p10Mm: 86, infiltrabilityOrdinal: 2,
  kr10PctOverride: 33, alpha10: 2.6, delayedRunoffRatio: 0.05 });
check('petit bassin calculé avec Kr10 lu (33 %)', rp.ok, rp.reason);
check('petit bassin · Kr70/Kr100 absents si Kr10 saisi', Number.isNaN(rp.kr70Pct) && Number.isNaN(rp.kr100Pct));
near('petit bassin · abattement A (manuel)', 0.89, rp.abattement, 0.6);
near('petit bassin · Pm10 (manuel)', 76.5, rp.pm10Mm, 0.6);
near('petit bassin · Lr10 (manuel)', 25.2, rp.lr10Mm, 2);
near('petit bassin · Vr10 (manuel)', 151200, rp.vr10M3, 2);
near('petit bassin · Tb10 (manuel)', 147, rp.tb10Min, 2);
near('petit bassin · Qm10 (manuel)', 17.1, rp.qm10, 2);
near('petit bassin · Qr10 (manuel)', 44.5, rp.qr10, 2);
near('petit bassin · Q10 (manuel)', 46.7, rp.q10, 2);
near('petit bassin · Vret10 (manuel)', 19625, rp.vret10M3, 2);
near('petit bassin · Tm10 (manuel)', 44, rp.tm10Min, 2);

// Gradex (page 29) : C = 1 + 0,45·(Tb/24)^0,12 / Kr10 (Tb en h, Kr10 fraction).
const cAtt = 1 + 0.45 * Math.pow(rm.tb10Min / 60 / 24, 0.12) / (rm.kr10Pct / 100);
near('bassin moyen · C (10 → 100 ans)', cAtt, rm.c100, 0.1);
near('bassin moyen · Q100 = C·Q10', cAtt * rm.q10, rm.q100, 0.1);
exact('rapport (P100-P10)/P10 sahélien = 0,45', 0.45, rm.p100Ratio);
const rp100 = H.computeOrstom({ zone: 'sahelienne', areaKm2: 30, igMPerKm: 15, panMm: 550, p10Mm: 88, p100Mm: 132,
  infiltrabilityOrdinal: 1.2, alpha10: 1.9, delayedRunoffRatio: 0.04 });
exact('P100 saisi ⇒ rapport calculé', (132 - 88) / 88, rp100.p100Ratio);
const rt = H.computeOrstom({ zone: 'tropicale', areaKm2: 30, igMPerKm: 15, panMm: 900, p10Mm: 88, infiltrabilityOrdinal: 1.2 });
check('rapport tropical = 0,38', rt.ok && Math.abs(rt.p100Ratio - 0.38) < 1e-9, rt.ok ? String(rt.p100Ratio) : rt.reason);
const rs = H.computeOrstom({ zone: 'sahelienne', areaKm2: 30, igMPerKm: 15, panMm: 800, p10Mm: 88, infiltrabilityOrdinal: 1 });
const rt2 = H.computeOrstom({ zone: 'tropicale', areaKm2: 30, igMPerKm: 15, panMm: 800, p10Mm: 88, infiltrabilityOrdinal: 1 });
check('zones distinctes · Kr10', rs.ok && rt2.ok && Math.abs(rs.kr10Pct - rt2.kr10Pct) > 1e-6, `${rs.kr10Pct?.toFixed(2)} / ${rt2.kr10Pct?.toFixed(2)}`);
check('zones distinctes · Tb10', Math.abs(rs.tb10Min - rt2.tb10Min) > 1e-6, `${rs.tb10Min.toFixed(1)} / ${rt2.tb10Min.toFixed(1)}`);
check('zones distinctes · Q10', Math.abs(rs.q10 - rt2.q10) > 1e-6, `${rs.q10.toFixed(1)} / ${rt2.q10.toFixed(1)}`);
check('tropical · Tm10 = 0,33 · Tb10', Math.abs(rt2.tm10Min - 0.33 * rt2.tb10Min) < 1e-6);
check('sahélien · Tm10 a ses propres branches', Math.abs(rs.tm10Min - 0.33 * rs.tb10Min) > 1e-6);
const rhp = H.computeOrstom({ zone: 'tropicale', areaKm2: 30, igMPerKm: 15, panMm: 1600, p10Mm: 88, infiltrabilityOrdinal: 1 });
check('Pan = 1600 mm ⇒ avertissement hors domaine', rhp.ok && rhp.warnings.some((w) => w.includes('1200')));
const rmz = H.computeOrstom({ zone: 'sahelienne', areaKm2: 30, igMPerKm: 15, panMm: 1000, p10Mm: 88, infiltrabilityOrdinal: 1 });
check('Pan 1000 mm en zone sahélienne ⇒ incohérence signalée', rmz.ok && rmz.warnings.some((w) => w.includes('Zone déclarée')));
const rok = H.computeOrstom({ zone: 'sahelienne', areaKm2: 30, igMPerKm: 15, panMm: 550, p10Mm: 88, infiltrabilityOrdinal: 1 });
check('Pan 550 mm, S 30 km² ⇒ aucun avertissement de domaine', rok.ok && !rok.warnings.some((w) => w.includes('hors du domaine') || w.includes('Zone déclarée')));
check('CIEH : Pan 1300 mm ⇒ au-delà de 1150 mm', H.ciehDomainWarnings(1300, 30).some((w) => w.includes('1150')));
check('CIEH : S 400 km² ⇒ hors plage de calage 10-100', H.ciehDomainWarnings(700, 400).some((w) => w.includes('calage')));
check('CIEH : Pan 700 mm, S 30 km² ⇒ aucun avertissement', H.ciehDomainWarnings(700, 30).length === 0);
exact('coefficient de pointe par défaut = 2,6', 2.6, H.ORSTOM_INFO.alpha10Default);

// ═════════════════════════════════════════════════════════════════════════
section('Check-list FAO 54, annexe 1 (ChecklistCampaign)');
// ═════════════════════════════════════════════════════════════════════════
const sah = H.listChecklistItems('sahelienne'), tro = H.listChecklistItems('tropicale');
check('zone sahélienne chargée (> 15 items)', sah.length > 15, `${sah.length} items`);
check('zone tropicale chargée (> 12 items)', tro.length > 12, `${tro.length} items`);
for (const [nom, items] of [['sahélienne', sah], ['tropicale', tro]]) {
  const i1a = items.find((i) => i.code === '1a');
  check(`item 1a présent et bloquant (${nom})`, !!i1a && i1a.bloquant, i1a?.titre ?? 'absent');
}
const isNeutral = (e) => e.blocking.length === 0 && e.alphaOverride == null
  && [e.sFactor, e.krFactor, e.tbFactor, e.tmFactor, e.qOrstomFactor, e.qCiehFactor, e.alphaFactor].every((f) => f === 1);
check('aucun choix ⇒ effet neutre', isNeutral(H.composeChecklist(null)));
check('liste vide ⇒ effet neutre', isNeutral(H.composeChecklist([])));
const red = H.composeChecklist([{ itemCode: '3a1d', parametre: 'Tb', type: 'reduction_pct', value: 40 }]);
exact('Tb réduit de 40 % ⇒ facteur 0,60', 0.60, red.tbFactor);
exact('Kr majoré de 50 % ⇒ facteur 1,50', 1.50, H.composeChecklist([{ itemCode: '3a4a', parametre: 'Kr', type: 'majoration_pct', value: 50 }]).krFactor);
const cumul = H.composeChecklist([
  { itemCode: '3a1b', parametre: 'Tb', type: 'reduction_pct', value: 30 },
  { itemCode: '3a1d', parametre: 'Tb', type: 'reduction_pct', value: 30 }]);
exact('deux réductions de 30 % ⇒ 0,49 (multiplicatif)', 0.49, cumul.tbFactor);
const alpha = H.composeChecklist([{ itemCode: '3a1c', parametre: 'alpha', type: 'valeur', value: 1.9 }]);
exact('3a1c ⇒ alpha imposé à 1,9', 1.9, alpha.alphaOverride);
const bloc = H.composeChecklist([{ itemCode: '1a', parametre: '', type: '', value: 0 }]);
check('1a coché ⇒ méthodes non applicables', bloc.blocking.length === 1, bloc.blocking[0] ?? '');
check('1a coché ⇒ aucun facteur modifié', bloc.tbFactor === 1 && bloc.qOrstomFactor === 1);
const pctCorr = sah.flatMap((i) => i.corrections).filter((c) => c.type.endsWith('_pct'));
check('toute correction en % annonce sa fourchette', pctCorr.length > 0 && pctCorr.every((c) => c.rangeText.trim()), `${pctCorr.length} correction(s)`);
check('le journal consigne chaque correction', red.journal.length === 1, red.journal[0] ?? 'vide');
// Raccourci GIRA : type et paramètre repris de l'item quand ils manquent.
const auto2d = H.composeChecklist([{ itemCode: '2d', value: 0.5 }]);
exact('choix { itemCode: 2d, value: 0,5 } ⇒ S × 0,5 (fraction aval)', 0.5, auto2d.sFactor);

// ═════════════════════════════════════════════════════════════════════════
section('Abaque C — méthode rationnelle tunisienne (RunoffCoefficientCampaign §1 à §6)');
// ═════════════════════════════════════════════════════════════════════════
const C = (slopePct, vegetationIndex) => H.runoffCoefficientTunisia({ slopePct, vegetationIndex });
for (const [s, cls] of [[1, 'faible'], [5, 'moyenne'], [12, 'forte']])
  [1, 2, 3].forEach((iv) => exact(`${cls} · Iv ${iv}`, (cls === 'forte' ? [0.5, 0.6, 0.7] : [0.4, 0.5, 0.6])[iv - 1], C(s, iv).C));
check('faible ≡ moyenne pour les trois indices', [1, 2, 3].every((i) => C(1, i).C === C(5, i).C));
check('pente forte = pente moyenne + 0,10', [1, 2, 3].every((i) => Math.abs(C(12, i).C - C(5, i).C - 0.1) < 1e-12));
for (const [s, cls] of [[0.5, 'faible'], [1.99, 'faible'], [2, 'moyenne'], [5, 'moyenne'], [8, 'moyenne'], [8.01, 'forte'], [25, 'forte']])
  check(`${s} % → ${cls}`, C(s, 2).slopeClass === cls);
exact('C identique de part et d\'autre de 2 % (Iv 2)', C(1.99, 2).C, C(2.01, 2).C);
check('C change de part et d\'autre de 8 % (Iv 2)', Math.abs(C(7.99, 2).C - C(8.01, 2).C + 0.1) < 1e-12);
for (const [cov, iv] of [[80, 1], [50.1, 1], [50, 2], [40, 2], [30, 2], [29.9, 3], [0, 3], [-5, null], [140, null]])
  check(`${cov} % couvert → indice ${iv}`, H.vegetationIndexFromCover(cov) === iv);
const sansIndice = C(4, null);
check('sans indice de végétation : aucun C', !sansIndice.ok && sansIndice.C === 0, sansIndice.reason);
check('indice 4 hors abaque : refus', !C(4, 4).ok, C(4, 4).reason);
check('indice 0 hors abaque : refus', !C(4, 0).ok);
check('pente inconnue : refus', !C(0, 2).ok, C(0, 2).reason);
const cov = (s, c) => H.runoffCoefficientTunisia({ slopePct: s, coverPct: c });
for (const [s, c, e] of [[1, 70, 0.4], [5, 40, 0.5], [5, 10, 0.6], [15, 70, 0.5], [15, 40, 0.6], [15, 10, 0.7]])
  exact(`pente ${s} % · ${c} % couvert`, e, cov(s, c).C);
check('couverture aberrante : refus, pas de C', !cov(5, 140).ok, cov(5, 140).reason);
check('la couverture mesurée est tracée dans l\'origine', cov(5, 40).source.includes('40.0'), cov(5, 40).source);
exact('Q = 0,278 × 0,70 × 60 × 1,2 (m³/s)', 0.278 * 0.70 * 60 * 1.2, H.formulas.rationalPeakDischarge(cov(12, 10).C, 60, 1.2));
exact('tc 2 min borné au minimum IDF 5 min', 5, H.formulas.effectiveIdfDurationMinutes(2, 5));
exact('tc 8 min inchangé si minimum IDF 5 min', 8, H.formulas.effectiveIdfDurationMinutes(8, 5));
check('origine tracée dans la lecture', cov(12, 10).source.includes('forte') && cov(12, 10).source.includes('3'), cov(12, 10).source);

// ═════════════════════════════════════════════════════════════════════════
section('Calcul complet — contrôles hydrologiques de tools/ReportCheck');
// ═════════════════════════════════════════════════════════════════════════
// Hypothèses du modèle de contrôle (MakeModel) : Pan 700, P10 88, P0 20, P100 130, zones I / NordCapBon / SudEst / Nord.
const hypTun = { methodSet: 'tunisie', pan: 700, p10: 88, p0: 20, p100: 130,
  ghorbelZone: 'I', kallelRegion: 'NordCapBon', fersiSector: 'SudEst', friguiRegion: 'Nord' };
const petitBassin = (coverPct, cSaisi) => ({ name: 'BV-C', areaKm2: 1.2, perimeterKm: 5, lengthM: 2000, slopePct: 12,
  igMPerKm: 120, intensityMmH: 60, runoffCoeff: cSaisi, vegetationCoverPct: coverPct, returnPeriod: 10 });
const bvAbaque = H.computeBasin(petitBassin(10, null), hypTun);
exact('Abaque C : C retenu = 0,70 sans aucune saisie', 0.70, bvAbaque.values.runoffCoeff?.C);
exact('Abaque C : Q rationnel avec le C de l\'abaque = 14,01', 14.01, bvAbaque.values.discharges.rational);
const bvSansMesure = H.computeBasin(petitBassin(null, null), hypTun);
check('Abaque C : sans mesure, aucun C ni aucun Q rationnel', bvSansMesure.values.runoffCoeff == null
  && bvSansMesure.values.discharges.rational == null && hasW(bvSansMesure, 'Abaque C'), bvSansMesure.warnings.join(' | '));
const bvHerite = H.computeBasin(petitBassin(10, 0.5), hypTun);
check('Abaque C : un C hérité ne prend jamais le dessus', bvHerite.values.runoffCoeff.C === 0.7
  && bvHerite.values.discharges.rational === 14.01, `${bvHerite.values.runoffCoeff.source} · Q = ${bvHerite.values.discharges.rational}`);
const hypFao = { ...hypTun, methodSet: 'fao54', ciehRegressionIds: [11, 12, 13], orstomZone: 'sahelienne' };
const bvFao = H.computeBasin(petitBassin(10, 0.35), hypFao);
check('FAO 54 : C saisi conservé, abaque tunisien non appliqué', bvFao.values.runoffCoeff?.source.includes('saisi')
  && bvFao.values.discharges.rational === 7.01, `${bvFao.values.runoffCoeff?.source} · Q = ${bvFao.values.discharges.rational}`);

// Temps de concentration : quatre formules, une seule retenue et affichée.
const bassinTc = () => ({ name: 'BV-tc', areaKm2: 2.5, perimeterKm: 8, lengthM: 3200, slopePct: 4, dropM: 120,
  igMPerKm: 40, hMean: 340, hMin: 200, hMax: 520, returnPeriod: 10, vegetationCoverPct: 45 });
const hypTc = { ...hypTun, montanaA: 6.0, montanaB: 0.65, montanaC: 0.15 };
const bvTc = H.computeBasin(bassinTc(), hypTc);
const tcRef = (4 * Math.sqrt(2.5) + 1.5 * 3.2) / (0.8 * Math.sqrt(340 - 200));
check('Giandotti : calculé', bvTc.values.tc.Giandotti != null, String(bvTc.values.tc.Giandotti?.value));
check('Giandotti : valeur conforme (Hmoy = Hmean − Hmin)', Math.abs(bvTc.values.tc.Giandotti.value - tcRef) < 0.01, `${bvTc.values.tc.Giandotti.value} h contre ${tcRef.toFixed(2)} h`);
check('Giandotti : unité h, minutes = h × 60', bvTc.values.tc.Giandotti.unit === 'h' && bvTc.values.tc.Giandotti.minutes === bvTc.values.tc.Giandotti.value * 60);
const bvSansH = H.computeBasin({ ...bassinTc(), hMean: undefined }, hypTc);
check('Giandotti : sans altitude moyenne, aucune valeur ni repli sur Hmax − Hmin', bvSansH.values.tc.Giandotti == null && hasW(bvSansH, 'Giandotti'), bvSansH.warnings.join(' | '));
for (const f of H.TC_FORMULAS.map((x) => x.id)) {
  const r = H.computeBasin(bassinTc(), { ...hypTc, tcFormula: f });
  const att = r.values.tc[f].minutes;
  check(`tc retenu « ${f} » réellement appliqué et affiché`, r.values.tcRetained?.formula === f && att > 0
    && r.values.tcRetained.minutes === att && r.values.tcRetained.label.startsWith(att.toFixed(1)), r.values.tcRetained?.label);
}
const iK = H.computeBasin(bassinTc(), { ...hypTc, tcFormula: 'Kirpich' }).values.intensityMmH;
const iG = H.computeBasin(bassinTc(), { ...hypTc, tcFormula: 'Giandotti' }).values.intensityMmH;
check('le choix du tc change réellement l\'intensité', Math.abs(iK - iG) > 1e-6, `Kirpich i = ${iK} · Giandotti i = ${iG}`);

const bvFr = H.computeBasin(bassinTc(), { ...hypTc, francouRodierK: 0 });
check('Francou-Rodier : K non renseigné → motif affiché', bvFr.values.discharges.francouRodier == null && hasW(bvFr, 'Francou-Rodier'));
const bvFr2 = H.computeBasin(bassinTc(), { ...hypTc, francouRodierK: 4.0 });
near('Francou-Rodier : Q = 10⁶·(A/10⁸)^(1−K/10)', 1e6 * (2.5 / 1e8) ** (1 - 0.4), bvFr2.values.discharges.francouRodier);
const bvFr3 = H.computeBasin(bassinTc(), { ...hypTc, francouRodierRegion: 'NordIchkeul' });
exact('Francou-Rodier : région choisie ⇒ K proposé (4,0)', bvFr2.values.discharges.francouRodier, bvFr3.values.discharges.francouRodier);

const skip = { ...H.defaultHypotheses(), ghorbelZone: 'NePasUtiliser', kallelRegion: 'NePasUtiliser',
  fersiSector: 'NePasUtiliser', friguiRegion: 'NePasUtiliser', francouRodierK: 0 };
const bvSkip = H.computeBasin({ name: 'BV-skip', areaKm2: 120, perimeterKm: 50, lengthM: 20000, slopePct: 1.5, dropM: 80,
  deltaHM: 40, returnPeriod: 50, gravelius: 1.4 }, skip);
check('Ghorbel « ne pas utiliser » → pas de débit', bvSkip.values.discharges.ghorbel == null);
check('Ghorbel « ne pas utiliser » → pas d\'erreur de zone', !hasW(bvSkip, 'Ghorbel'));
check('Kallel « ne pas utiliser » → pas de débit', bvSkip.values.discharges.kallel == null);
const bvNoZone = H.computeBasin({ areaKm2: 120, returnPeriod: 10 }, { ghorbelZone: null });
check('Ghorbel : zone vide → « zone non choisie »', hasW(bvNoZone, 'Ghorbel : zone non choisie'));

// Régionalisations : jamais de colonne vide sans motif (Frigui calé à 2, 5, 10, 50 ans seulement).
const grand = (t) => ({ name: 'BV-T', areaKm2: 120, perimeterKm: 50, lengthM: 20000, slopePct: 1.5, igMPerKm: 15, deltaHM: 90, gravelius: 1.28, returnPeriod: t });
for (const [t, att] of [[10, true], [50, true], [100, false], [30, false]]) {
  const r = H.computeBasin(grand(t), hypTun);
  const calc = r.values.discharges.frigui != null;
  check(`Frigui : T = ${t} ans ${att ? 'calculé' : 'refusé AVEC motif'}`, calc === att && (calc || hasW(r, 'Frigui')), calc ? `Q = ${r.values.discharges.frigui}` : r.warnings.find((w) => w.includes('Frigui')));
}

// Modèle de contrôle FAO 54 (MakeModel) : S = 30 km², Ig = 15, I, Pan 700, P10 88, P100 130, régressions 11, 12, 13.
const faoMake = H.computeBasin({ name: 'BV1', areaKm2: 30, perimeterKm: 25, igMPerKm: 15, lengthM: 9000, lon: -1.5, lat: 13.5, infiltrability: 'I' }, hypFao);
{
  const A = 1 - (161 - 0.042 * 700) / 1000 * Math.log10(30);
  const kr = (a, b, c) => a / (30 + b) + c;
  const K = kr(1455, 33, 21) + (kr(1833, 38, 24) - kr(1455, 33, 21)) * (88 - 70) / 30;   // classe I, Ig = 15
  const q11 = 0.41 * 30 ** 0.524 * K ** 0.982, q12 = 0.095 * 30 ** 0.643 * 15 ** 0.406 * K ** 1.038, q13 = 1.78 * 30 ** 0.557 * 15 ** 0.805;
  const tb10 = 5 * 10 + 139, tb45 = 55 * 45 ** 0.35 + 30;
  const Tb = tb10 + (tb45 - tb10) * (Math.log10(30) - 1) / (Math.log10(45) - 1);
  const qOr = 2.6 * (16.7 * 88 * A * K / 100 * 30 / Tb) * 1.03;
  const all = [q11, q12, q13, qOr].sort((a, b) => a - b);
  near('FAO 54 modèle : Kr10 Orstom réinjecté dans le CIEH', K, faoMake.values.kr10.value);
  check('FAO 54 modèle : source de Kr10 = méthode Orstom', faoMake.values.kr10.source.includes('Orstom'));
  near('FAO 54 modèle : régression 11', q11, faoMake.values.cieh.rows.find((r) => r.no === 11).q10);
  near('FAO 54 modèle : régression 12', q12, faoMake.values.cieh.rows.find((r) => r.no === 12).q10);
  near('FAO 54 modèle : régression 13', q13, faoMake.values.cieh.rows.find((r) => r.no === 13).q10);
  near('FAO 54 modèle : Q10 Orstom', qOr, faoMake.values.orstom.q10);
  near('FAO 54 modèle : médiane CIEH', [q11, q12, q13].sort((a, b) => a - b)[1], faoMake.values.cieh.median);
  near('FAO 54 modèle : médiane CIEH + Orstom (débit retenu)', (all[1] + all[2]) / 2, faoMake.retained.Q);
  check('FAO 54 modèle : fourchette min / max', Math.abs(faoMake.values.stats.min - all[0]) < 1e-9 && Math.abs(faoMake.values.stats.max - all[3]) < 1e-9);
}
check('FAO 54 : aucun débit tunisien (jeux exclusifs)', Object.keys(faoMake.values.discharges).join() === 'rational');
check('Tunisie : aucune grandeur FAO 54 (jeux exclusifs)', !('cieh' in bvTc.values) && !('orstom' in bvTc.values));

// ═════════════════════════════════════════════════════════════════════════
section('Cas manuels vérifiés à la main');
// ═════════════════════════════════════════════════════════════════════════
// Kirpich : L = 8000 m, D = 160 m ⇒ tc = 0,0195·(8000³/160)^0,385 = 89,026 min (valeur enregistrée par BVTrace.Web, BV-01).
near('Kirpich L 8000 m, D 160 m = 89,026 min', 89.02610092763959, H.formulas.kirpichMinutes(8000, 160));
// Ventura : S = 2,5 km², I = 4 % ⇒ 76·√0,625 = 60,08 min.
near('Ventura S 2,5 km², I 4 % = 60,08 min', 76 * Math.sqrt(2.5 / 4), H.formulas.venturaMinutes(2.5, 4));
// Passini : S 2,5, L 3,2 km, I 4 % ⇒ 0,108·8^(1/3)/0,2 = 1,08 h.
near('Passini S 2,5 km², L 3,2 km, I 4 % = 1,08 h', 1.08, H.formulas.passiniHours(2.5, 3.2, 4));
// BV-01 de BVTrace.Web : S 25 km², L 8 km, D 160 m, Montana a 60 / b 0,7 / c 0,1, T = 100 ans, P0 20 / P100 90.
const bv01 = H.computeBasin({ name: 'BV-01', areaKm2: 25, perimeterKm: 22, lengthM: 8000, slopePct: 2, dropM: 160, meanReliefM: 100, returnPeriod: 100 },
  { montanaA: 60, montanaB: 0.7, montanaC: 0.1 });
exact('BV-01 : tc Kirpich relu en F2 = 89,03 min', 89.03, bv01.values.tc.Kirpich.minutes);
near('BV-01 : i = 60/(89,03/60 + 0,1)^0,7 = 43,49 mm/h (Web : 43,4878)', 43.48776505579716, bv01.values.intensityMmH, 0.01);
exact('BV-01 : intensité arrondie à 2 décimales', 43.49, bv01.values.intensityMmH);
near('BV-01 : SOGREAH 25^0,75·(90 − 20)/12 = 65,2186 (Web)', 65.21864934374388, bv01.values.discharges.sogreah, 0.01);
near('BV-01 : Giandotti (4·5 + 12)/(0,8·10) = 4,00 h', 4.0, bv01.values.tc.Giandotti.value);
// Rationnelle : C 0,5 (pente 5 %, 40 % couvert), Montana station Sidi Ali Jbali (T = 10 : a 247, b 0,651, c 0,208).
const st = H.findMontanaStation('1484943000');
check('station table 18 « Sidi Ali Jbali » trouvée', st?.name === 'Sidi Ali Jbali', st?.name);
near('Sidi Ali Jbali : latitude 40,888 gon × 0,9', 40.888 * 0.9, st.lat, 1e-6);
near('Sidi Ali Jbali : longitude 9,4231 gon × 0,9 + Paris', 9.4231 * 0.9 + 2.337222222, st.lon, 1e-6);
const ratBas = { name: 'BV-R', areaKm2: 1.5, perimeterKm: 5.5, lengthM: 1800, slopePct: 5, dropM: 45, vegetationCoverPct: 40, returnPeriod: 10 };
const rat = H.computeBasin(ratBas, { montanaStationCode: '1484943000', francouRodierK: 0 });
{
  const tc = Number((0.0195 * Math.pow(1800 ** 3 / 45, 0.385)).toFixed(2));
  const i = Math.round(247 / Math.pow(tc / 60 + 0.208, 0.651) * 100) / 100;
  near('rationnelle : tc Kirpich', tc, rat.values.tcRetained.minutes);
  near('rationnelle : i = 247/(tc/60 + 0,208)^0,651', i, rat.values.intensityMmH);
  near('rationnelle : Q = 0,278 × 0,50 × i × 1,5', Number((0.278 * 0.5 * i * 1.5).toFixed(2)), rat.values.discharges.rational);
}
// Montana : T = 30 ans non tabulé ⇒ T tabulé le plus proche (20 ans), signalé.
const r30 = H.computeBasin({ ...ratBas, returnPeriod: 30 }, { montanaStationCode: '1484943000' });
check('Montana : T = 30 ans ⇒ coefficients de T = 20 ans, signalé', r30.values.montana.tUsed === 20 && r30.values.montana.a === 246 && hasW(r30, 'non tabulé'), r30.warnings.find((w) => w.includes('Montana')));
// Station à b variable selon T (Halg Enneb) et station atypique (Siah Amara).
const halg = H.resolveMontanaStation('1484922000', 50);
check('Halg Enneb : b dépend de T (T = 50 ⇒ b = 0,5, a = 106)', halg?.b === 0.5 && halg?.a === 106);
const siah = H.computeBasin(ratBas, { montanaStationCode: '14899455' });
check('Siah Amara : station atypique, a/b/c non appliqués', hasW(siah, 'atypique') && siah.values.intensitySource == null);
// Durée minimale : tc < 5 min ⇒ intensité évaluée à 5 min, signalé.
const court = H.computeBasin({ areaKm2: 0.05, lengthM: 150, dropM: 20, slopePct: 13, vegetationCoverPct: 10 }, { montanaStationCode: '1484943000' });
check('tc < 5 min ⇒ intensité calculée à 5 min (minimum table 18)', court.values.tcRetained?.idfMinutes === 5 && hasW(court, 'durée minimale'), court.values.tcRetained?.label);
// Note DGPC 1054 : route classée, dalot, S 25 km², TJMA 500 ⇒ 50 ans (mode auto) ; ignorée en FAO 54.
exact('DGPC : route classée, dalot, S 25, TJMA 500 ⇒ 50 ans', 50, H.recommendReturnPeriodDgpc('RouteClassee', 'DalotBuseOuAutre', 25, 500));
exact('DGPC : piste rurale, S 5 km² ⇒ 30 ans', 30, H.recommendReturnPeriodDgpc('PisteRurale', 'DalotBuseOuAutre', 5));
exact('DGPC : submersible ⇒ 100 ans', 100, H.recommendReturnPeriodDgpc('PisteRurale', 'Submersible', 5));
const dg = H.computeBasin({ areaKm2: 25, returnPeriod: 10 }, { dgpc1054: true, dgpcReturnPeriod: 0, tjma: 500 });
exact('DGPC appliquée au calcul tunisien (auto §4)', 50, dg.values.returnPeriod);
const dgF = H.computeBasin({ areaKm2: 25, returnPeriod: 10 }, { methodSet: 'fao54', dgpc1054: true, dgpcReturnPeriod: 0, tjma: 500 });
exact('DGPC ignorée en FAO 54 (T = 10 ans)', 10, dgF.values.returnPeriod);
const t50 = H.computeBasin({ areaKm2: 30, igMPerKm: 15, returnPeriod: 50 }, { ...hypFao });
check('FAO 54 : T = 50 ans ⇒ 10 ans retenu, signalé', t50.values.returnPeriod === 10 && hasW(t50, 'le bulletin ne donne que 10 et 100 ans'));
// FAO 54 à T = 100 ans : Q100 = C · médiane (Gradex).
const f100 = H.computeBasin({ areaKm2: 30, igMPerKm: 15, infiltrability: 'I', returnPeriod: 100 }, hypFao);
near('FAO 54 : T = 100 ⇒ Q100 = C · médiane', Math.round(f100.values.stats.median * f100.values.orstom.c100 * 100) / 100, f100.retained.Q, 1e-6);
// Montana Afrique : Bohicon 5–60 min, T = 10 ⇒ a = 60 × 7,7 = 462 mm/h, b = −0,4 ; durée minimale 5 min.
const boh = H.montanaAfricaIdf({ station: 'Bénin — Bohicon', range: '5–60 min', T: 10 });
check('Montana Afrique : Bohicon a = 462 mm/h, b = −0,4, publié', boh.ok && boh.a === 462 && boh.b === -0.4 && boh.published, boh.source);
const fBoh = H.computeBasin({ areaKm2: 1.5, lengthM: 1800, dropM: 45, slopePct: 5, igMPerKm: 50, runoffCoeff: 0.4 },
  { ...hypFao, montanaAfrica: { station: 'Bénin — Bohicon', range: 0, T: 10 } });
{
  const tc = Number((0.0195 * Math.pow(1800 ** 3 / 45, 0.385)).toFixed(2));
  near('FAO 54 : i = 462 · tc^−0,4 (IDF CIEH)', Math.round(462 * tc ** -0.4 * 100) / 100, fBoh.values.intensityMmH);
  near('FAO 54 : rationnelle avec C saisi 0,4', Number((0.278 * 0.4 * fBoh.values.intensityMmH * 1.5).toFixed(2)), fBoh.values.discharges.rational);
}
check('Montana Afrique : stations listées (Afrique + Tunisie)', H.listMontanaStations().afrique.length > 50 && H.listMontanaStations().tunisie.length === 47,
  `${H.listMontanaStations().afrique.length} / ${H.listMontanaStations().tunisie.length}`);
// Ghorbel zone I : S^0,8·[1,075·√(P·ΔH/L)/Ic − 0,232] × ratio(T) — ΔH = Hmédiane − altitude au franchissement.
const gh = H.computeBasin({ areaKm2: 40, perimeterKm: 30, lengthM: 12000, hMedian: 350, zOutletM: 200, returnPeriod: 10 },
  { ...hypTun, pan: 600, ghorbelZone: 'I' });
{
  const ic = 30 / (2 * Math.sqrt(Math.PI * 40));
  const q = 40 ** 0.8 * (1.075 * Math.sqrt(0.6 * 150 / 12) / ic - 0.232) * 1.79;
  near('Ghorbel I : ΔH = Hmédiane − Zfranchissement = 150 m', Number(q.toFixed(2)), gh.values.discharges.ghorbel);
}
// Kallel Nord & Cap-Bon : 5,5·√S·T^0,41.
near('Kallel NordCapBon S 150 km², T 50 ans', Number((5.5 * Math.sqrt(150) * 50 ** 0.41).toFixed(2)),
  H.computeBasin({ areaKm2: 150, returnPeriod: 50 }, { kallelRegion: 'NordCapBon' }).values.discharges.kallel);
// Arrondi bancaire de Math.Round (.NET) reproduit.
// .NET multiplie par 10^d puis arrondit au pair : 2,675 × 100 = 267,5 exactement ⇒ 268 (toFixed donnerait 2,67).
exact('roundNet(2.675, 2) = 2.68 (comme Math.Round .NET)', 2.68, H._internals.roundNet(2.675, 2));
exact('roundNet(0.125, 2) = 0.12 (au pair)', 0.12, H._internals.roundNet(0.125, 2));
// Cumul amont → aval.
const camp = H.computeAll([
  { uid: 'a', name: 'A', areaKm2: 150, returnPeriod: 50 },
  { uid: 'b', name: 'B', areaKm2: 120, returnPeriod: 50, upstreamUids: ['a'] },
], { kallelRegion: 'NordCapBon', ghorbelZone: 'NePasUtiliser', fersiSector: 'NePasUtiliser', friguiRegion: 'NePasUtiliser' });
near('cumul amont : Q(B) = Q(A) + Q(B)', H._internals.roundNet(camp[0].retained.Q + camp[1].retained.Q, 2), camp[1].cumulative.Q, 1e-6);
check('cumul amont : débit effectif de B = cumul', camp[1].effectiveQ === camp[1].cumulative.Q);

console.log(`\n${passed} contrôle(s) réussi(s), ${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
