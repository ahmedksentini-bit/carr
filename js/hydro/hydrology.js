// hydrology.js — calcul hydrologique des bassins versants, porté de BVTrace (C#) pour GIRA.
//
// Sources portées (dépôt BVTrace) :
//   BVTrace.App/HydroCalculator.cs          orchestration (ComputeAll, TcMinutes, Montana, IDF locale)
//   BVTrace.App/MontanaStations.cs          table 18 DRE Tunisie (stations, gon → WGS84)
//   BVTrace.App/CampaignModels.cs           HydroHypotheses (valeurs par défaut, zone Orstom effective)
//   BVTrace.App/BasinData.cs                ComputeRecommendation (médiane, fourchette)
//   BVTrace.App/BasinDischargeAggregator.cs cumul des débits amont → aval
//   BVTrace.Core/HydrologyFormulas.cs       formules (tc, rationnelle, Montana, Ghorbel, Kallel, Fersi, Frigui…)
//   BVTrace.Core/RunoffCoefficientTunisia.cs abaque C (pente × indice de végétation)
//   BVTrace.Core/FrancouRodierTunisia.cs    propositions de K
//   BVTrace.Core/ReturnPeriodSelector.cs    note circulaire DGPC N°1054/2019, §4
//   BVTrace.Core/MontanaAfrica.cs           Montana Afrique de l'Ouest et centrale (CIEH)
//   BVTrace.Core/CiehCharts.cs              régressions CIEH (FAO 54, tableaux 9 à 11)
//   BVTrace.Core/OrstomMethod.cs            méthode Orstom (FAO 54, tableaux 1 à 4)
//   BVTrace.Core/Fao54Checklist.cs          check-list de l'annexe 1
//
// Module ES sans dépendance, exécutable dans le navigateur et sous Node 22.
//
// INVARIANTS (docs/context/hydrologie-*.md de BVTrace) — à préserver absolument :
//  - Jeux « tunisie » et « fao54 » EXCLUSIFS : on branche dès la première ligne, jamais de
//    débit tunisien mélangé, moyenné ou comparé à un débit CIEH/Orstom.
//  - Pan et P10 sont une seule grandeur chacune, partagée par les deux jeux.
//  - Note DGPC 1054 appliquée en jeu Tunisie seulement ; T forcée à 10 ans (ou 100 via Gradex) en FAO 54.
//  - Quatre formules de tc (Kirpich, Ventura en min ; Passini, Giandotti en h), toutes affichées,
//    UNE seule retenue (choisie, jamais d'ordre de préférence caché) et affichée avec sa valeur en minutes.
//  - Giandotti : Hmoy = altitude MOYENNE − altitude MINIMALE, jamais Hmax − Hmin ; sans elle, pas de valeur.
//  - Francou-Rodier : pas de K par défaut ; à 0 elle ne sort rien mais le dit.
//  - Tunisie : C n'est JAMAIS une saisie (abaque pente × couverture) ; FAO 54 : C se saisit.
//  - ΔH de Ghorbel = altitude MÉDIANE − altitude au franchissement (pas Hmax − Hmin).
//  - Tables de T tunisiennes : hors table on refuse AVEC motif, sans interpolation.
//  - Montana : on rattache la STATION ; a, b, c résolus bassin par bassin d'après T ; repli sur
//    le T tabulé le plus proche jamais en silence.
//  - CIEH : sélection multiple, débit retenu = MÉDIANE, fourchette affichée ; Pan sans exposant ;
//    Kr10 en pourcent ; donnée absente ⇒ refus motivé. Synthèse FAO = CIEH ET Orstom.
//  - Orstom : Kr10 analytique seulement en sahélien S > 10 km² et Igcor ≤ 15 m/km, sinon saisie exigée.
//  - Check-list : rien d'appliqué d'office ; cumul multiplicatif ; item 1a bloquant.
//  - Limites de domaine : avertissements, pas des refus.
//
// Fidélité numérique : BVTrace stocke plusieurs résultats intermédiaires sous forme de texte
// formaté (« F2 ») puis les relit (tc, débits tunisiens, médiane) ; l'intensité est arrondie par
// Math.Round(i, 2) (arrondi bancaire). Ces arrondis sont reproduits ici à l'identique (f2, roundNet).
// Les textes sont formatés en culture invariante (point décimal).

import MONTANA_TN_DATA from './data/montana-tunisie.js';
import MONTANA_AF_DATA from './data/montana-afrique.js';
import CIEH_DATA from './data/cieh-fao54.js';
import ORSTOM_DATA from './data/orstom-fao54.js';
import CHECKLIST_DATA from './data/fao54-checklist.js';

// ═══════════════════════════════════════════════════════════════════════════
// Utilitaires numériques et de formatage (émulation .NET)
// ═══════════════════════════════════════════════════════════════════════════

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : (v == null || v === '' ? NaN : Number(v)));
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** Formatage « Fd » en culture invariante. */
const fx = (x, d) => (Number.isFinite(x) ? x.toFixed(d) : String(x));

/** Valeur telle que BVTrace la relit après l'avoir formatée en « F2 » (ex. KirpichResult). */
const f2 = (x) => Number(x.toFixed(2));

/** Formatage personnalisé « 0.### » (d décimales au plus, zéros de queue supprimés). */
function fg(x, d) {
  if (!Number.isFinite(x)) return String(x);
  let s = x.toFixed(d);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}

/** Formatage « G6 » de .NET (6 chiffres significatifs, notation scientifique hors [1e-5 ; 1e6[). */
function g6(x) {
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= 6 || e < -5) {
    const [m, ex] = x.toExponential(5).split('e');
    const mant = m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m;
    const n = Number(ex);
    return `${mant}E${n < 0 ? '-' : '+'}${String(Math.abs(n)).padStart(2, '0')}`;
  }
  return String(Number(x.toPrecision(6)));
}

/** Math.Round(value, digits) de .NET : mise à l'échelle puis arrondi au pair (MidpointRounding.ToEven). */
function roundNet(value, digits) {
  if (!Number.isFinite(value) || Math.abs(value) >= 1e16) return value;
  const p = 10 ** digits;
  let v = value * p;
  const fl = Math.floor(v);
  const diff = v - fl;
  if (diff > 0.5) v = fl + 1;
  else if (diff < 0.5) v = fl;
  else v = (fl % 2 === 0) ? fl : fl + 1;
  return v / p;
}

/** Médiane d'une liste déjà triée (convention BVTrace). */
function medianSorted(values) {
  const n = values.length;
  return n % 2 === 0 ? (values[n / 2 - 1] + values[n / 2]) / 2 : values[(n - 1) / 2];
}

/** Coefficient de variation (%) — écart type de population / moyenne. */
function cvPct(values) {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (!(mean > 0)) return 0;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  return sd / mean * 100;
}

/** Clé d'une table indexée par T (entier), au plus proche ; égalité ⇒ la première dans l'ordre de la table. */
function closestKey(table, t) {
  let best = null;
  for (const k of Object.keys(table).map(Number)) {
    if (best === null || Math.abs(k - t) < Math.abs(best - t)) best = k;
  }
  return best;
}

const periodsLabel = (table) => Object.keys(table).map(Number).sort((a, b) => a - b).join(', ') + ' ans';

// ═══════════════════════════════════════════════════════════════════════════
// Formules (BVTrace.Core/HydrologyFormulas.cs)
// ═══════════════════════════════════════════════════════════════════════════

const gumbelReduced = (T) => -Math.log(-Math.log(1 - 1 / T));

export const formulas = Object.freeze({
  /** Indice de compacité de Gravelius : P / (2 √(π S)) — P km, S km². */
  gravelius: (perimeterKm, areaKm2) => (areaKm2 <= 0 ? 0 : perimeterKm / (2 * Math.sqrt(Math.PI * areaKm2))),
  /** Méthode rationnelle Q = 0,278 · C · i · S (m³/s) — i mm/h, S km². */
  rationalPeakDischarge: (c, iMmH, areaKm2) => 0.278 * c * iMmH * areaKm2,
  /** Ventura : tc (MIN) = 76 √(S / I) — S km², I pente en % (cm/m). */
  venturaMinutes: (areaKm2, slopePct) => (slopePct <= 0 || areaKm2 <= 0 ? 0 : 76 * Math.sqrt(areaKm2 / slopePct)),
  /** Kirpich : tc (MIN) = 0,0195 (L³ / D)^0,385 — L et D en MÈTRES. */
  kirpichMinutes: (lengthM, dropM) => (lengthM <= 0 || dropM <= 0 ? 0 : 0.0195 * Math.pow(Math.pow(lengthM, 3) / dropM, 0.385)),
  /** Passini : tc (HEURES) = 0,108 (S·L)^(1/3) / √(I/100) — S km², L km, I %. */
  passiniHours: (areaKm2, lengthKm, slopePct) => (slopePct <= 0 || areaKm2 <= 0 || lengthKm <= 0 ? 0
    : 0.108 * Math.pow(areaKm2 * lengthKm, 1 / 3) / Math.sqrt(slopePct / 100)),
  /** Giandotti : tc (HEURES) = (4√S + 1,5 L) / (0,8 √Hmoy) — S km², L km, Hmoy = alt. moyenne − alt. min (m). */
  giandottiHours: (areaKm2, lengthKm, meanReliefM) => (areaKm2 <= 0 || lengthKm <= 0 || meanReliefM <= 0 ? 0
    : (4 * Math.sqrt(areaKm2) + 1.5 * lengthKm) / (0.8 * Math.sqrt(meanReliefM))),
  /** Montana 2 paramètres : I = a · t^(−b) (mm/h), t en minutes. */
  montanaIntensity: (a, b, tMin) => (tMin <= 0 || a <= 0 ? 0 : a * Math.pow(tMin, -b)),
  /** Montana 3 paramètres (table 18 DRE) : I = a / (t_h + c)^b — t en minutes, t_h = t/60, I en mm/h. */
  montanaIntensity3(a, b, c, tMin) {
    if (a <= 0 || tMin <= 0) return 0;
    const den = Math.pow(tMin / 60 + c, b);
    return den > 0 ? a / den : 0;
  },
  /** IDF générique I = a · t^b (b négatif en général). */
  intensityDurationFrequency: (a, b, tMin) => (tMin <= 0 ? 0 : a * Math.pow(tMin, b)),
  /** Durée injectée dans l'IDF : jamais en dessous de la durée minimale tabulée (0 = domaine inconnu). */
  effectiveIdfDurationMinutes: (tcMin, minTableMin) => (tcMin <= 0 ? 0 : minTableMin > 0 ? Math.max(tcMin, minTableMin) : tcMin),
  /** Ghorbel zones I-III : S^0,8 · [1,075·√(P·ΔH/L)/Ic − 0,232] — P en MÈTRES, ΔH m, L km. */
  ghorbelQmaxZone123: (areaKm2, rainM, deltaH, lengthKm, ic) => (lengthKm <= 0 || ic <= 0 ? 0
    : Math.pow(areaKm2, 0.8) * (1.075 * (Math.sqrt((rainM * deltaH) / lengthKm) / ic) - 0.232)),
  /** Ghorbel zones IV-V : 85 · ln S. */
  ghorbelQmaxZone45: (areaKm2) => (areaKm2 <= 0 ? 0 : 85 * Math.log(areaKm2)),
  /** Kallel (analytique en T). */
  kallel(region, areaKm2, T) {
    const tf = Math.pow(T, 0.41);
    switch (region) {
      case 'NordCapBon': return 5.5 * Math.pow(areaKm2, 0.5) * tf;
      case 'NoyauDorsale': return 2.6 * Math.pow(areaKm2, 0.8) * tf;
      case 'CentreSahel': return (T <= 20 ? 14.3 : 24.7) * Math.pow(areaKm2, 0.5) * tf;
      case 'SudEstSudOuest': return 12.35 * Math.pow(areaKm2, 0.5) * tf;
      default: throw new RangeError('Kallel : région inconnue');
    }
  },
  fersiMeanRunoff: (pMm, ig) => (ig <= 0 ? 0 : 0.01639 * pMm * Math.sqrt(ig)),
  fersiAnnualMax(hemoy, areaKm2) {
    if (areaKm2 < 1) return 0.266 * hemoy * Math.sqrt(areaKm2) * Math.log10(areaKm2 + 2);
    if (areaKm2 < 2) return 0.266 * hemoy * Math.sqrt(areaKm2) * Math.log10(areaKm2 + 1);
    return 0.266 * hemoy * Math.sqrt(areaKm2) * Math.log10(Math.max(areaKm2, 1e-6));
  },
  fersiPeak(qxMoy, areaKm2, ig, yT) {
    if (areaKm2 <= 0 || ig <= 0) return 0;
    return yT * Math.pow((areaKm2 * ig) / 270, -0.423) * qxMoy;
  },
  friguiPeak: (areaKm2, p, lambda) => lambda * p.am / Math.pow(areaKm2 + 1, p.n) * areaKm2,
  /** SOGREAH : pluie journalière de période T, interpolée en variable réduite de Gumbel entre P10 et P100. */
  sogreahRainfall(T, p10, p100) {
    const y10 = 2.25, y100 = 4.60;
    if (T <= 10) return p10;
    if (T >= 100) return p100;
    return p10 + ((gumbelReduced(T) - y10) / (y100 - y10)) * (p100 - p10);
  },
  sogreahDischarge: (areaKm2, pT, p0) => Math.pow(areaKm2, 0.75) * (pT - p0) / 12,
  /** Francou-Rodier : Q = 10⁶ · (S / 10⁸)^(1 − K/10). */
  francouRodier: (areaKm2, k) => (areaKm2 <= 0 || k <= 0 ? 0 : 1e6 * Math.pow(areaKm2 / 1e8, 1 - k / 10)),
});

// ═══════════════════════════════════════════════════════════════════════════
// Régionalisations tunisiennes (HydrologyReferenceData) et listes d'options
// ═══════════════════════════════════════════════════════════════════════════

/** Code « ne pas utiliser » : la méthode est exclue du calcul et de la médiane, sans message. */
export const UNUSED_CODE = 'NePasUtiliser';

const ENUMS = {
  ghorbel: ['I', 'II', 'III', 'IV', 'V'],
  kallel: ['NordCapBon', 'NoyauDorsale', 'CentreSahel', 'SudEstSudOuest'],
  fersi: ['SudEst', 'SudOuest'],
  frigui: ['Nord', 'Medjerda', 'CapBonMeliane', 'CentreSud'],
};

/** Listes d'options (identifiant + libellé), dans l'ordre des listes de BVTrace. */
export const OPTION_LISTS = Object.freeze({
  ghorbelZones: [
    { id: UNUSED_CODE, label: 'Ne pas utiliser' },
    { id: 'I', label: 'Extrême nord' },
    { id: 'II', label: 'Rive droite Mejerda, Cap-Bon, Zeroud amont' },
    { id: 'III', label: 'Meliane, Merguellil, nord Zeroud' },
    { id: 'IV', label: 'Sahel' },
    { id: 'V', label: 'Sud' },
  ],
  kallelRegions: [
    { id: UNUSED_CODE, label: 'Ne pas utiliser' },
    { id: 'NordCapBon', label: 'Nord & Cap-Bon' },
    { id: 'NoyauDorsale', label: 'Noyau de la dorsale' },
    { id: 'CentreSahel', label: 'Centre & Sahel' },
    { id: 'SudEstSudOuest', label: 'Sud-Est & Sud-Ouest' },
  ],
  fersiSectors: [
    { id: UNUSED_CODE, label: 'Ne pas utiliser' },
    { id: 'SudEst', label: 'Sud-Est' },
    { id: 'SudOuest', label: 'Sud-Ouest' },
  ],
  friguiRegions: [
    { id: UNUSED_CODE, label: 'Ne pas utiliser' },
    { id: 'Nord', label: 'Nord' },
    { id: 'Medjerda', label: 'Medjerda' },
    { id: 'CapBonMeliane', label: 'Cap-Bon & Meliane' },
    { id: 'CentreSud', label: 'Centre & Sud' },
  ],
  roadCategories: [
    { id: 'AutorouteExpressRocade', label: 'Autoroute / express / rocade' },
    { id: 'RouteClassee', label: 'Route classée (RN, RR, RL)' },
    { id: 'PisteRurale', label: 'Piste rurale' },
  ],
  structureTypes: [
    { id: 'OuvrageArt', label: "Ouvrage d'art (pont, cadre…)" },
    { id: 'DalotBuseOuAutre', label: 'Dalot / buse / autre forme' },
    { id: 'Submersible', label: 'Submersible / semi-submersible' },
  ],
  infiltrability: [
    { id: 'PI', label: 'particulièrement imperméable', ordinal: 0 },
    { id: 'I', label: 'imperméable', ordinal: 1 },
    { id: 'RI', label: 'relativement imperméable', ordinal: 2 },
    { id: 'P', label: 'perméable', ordinal: 3 },
    { id: 'TP', label: 'très perméable', ordinal: 4 },
  ],
});

const GHORBEL_RATIOS = {
  I: { 2: 0.86, 5: 1.39, 10: 1.79, 20: 2.19, 50: 2.72, 100: 3.12 },
  II: { 2: 0.70, 5: 1.33, 10: 1.98, 20: 2.84, 50: 4.40, 100: 6.04 },
  III: { 2: 0.59, 5: 1.45, 10: 2.34, 20: 3.52, 50: 5.68, 100: 7.93 },
  IV: { 2: 0.50, 5: 1.60, 10: 2.50, 20: 3.50, 50: 5.10, 100: 6.20 },
  V: { 2: 0.30, 5: 1.00, 10: 2.20, 20: 3.70, 50: 6.70, 100: 9.20 },
};
const FERSI_FACTORS = {
  SudEst: { 5: 1.28, 10: 2.22, 20: 3.82, 50: 6.59, 100: 10.2 },
  SudOuest: { 5: 1.145, 10: 2.068, 20: 3.507, 50: 6.808, 100: 10.337 },
};
const FRIGUI_PARAMS = {
  Nord: { am: 26.2, n: 0.47 }, Medjerda: { am: 53.5, n: 0.53 },
  CapBonMeliane: { am: 38.4, n: 0.44 }, CentreSud: { am: 76.7, n: 0.44 },
};
const FRIGUI_LAMBDAS = {
  Nord: { 2: 0.20, 5: 0.34, 10: 0.45, 50: 0.80 },
  Medjerda: { 2: 0.15, 5: 0.27, 10: 0.38, 50: 0.78 },
  CapBonMeliane: { 2: 0.10, 5: 0.22, 10: 0.35, 50: 0.77 },
  CentreSud: { 2: 0.08, 5: 0.21, 10: 0.33, 50: 0.74 },
};

/** Tables de calage exposées pour l'affichage (T disponibles par méthode). */
export const TUNISIA_TABLES = Object.freeze({
  ghorbelRatios: GHORBEL_RATIOS, fersiFactors: FERSI_FACTORS,
  friguiParameters: FRIGUI_PARAMS, friguiLambdas: FRIGUI_LAMBDAS,
});

/** « I - Extrême nord » → « I » (BasinOptionLists.ExtractEnumCode). */
const extractCode = (v) => String(v).split(' - ')[0].trim();
const isUnused = (v) => v != null && String(v).trim() !== '' && extractCode(v).toLowerCase() === UNUSED_CODE.toLowerCase();

/** Enum.TryParse(ignoreCase) : nom ou valeur numérique (1-based) d'un membre défini ; null sinon. */
function parseEnum(value, names) {
  if (value == null || String(value).trim() === '') return null;
  const code = extractCode(value);
  const byName = names.find((n) => n.toLowerCase() === code.toLowerCase());
  if (byName) return byName;
  if (/^\d+$/.test(code)) {
    const i = Number(code);
    if (i >= 1 && i <= names.length) return names[i - 1];
  }
  return null;
}

// ── Francou-Rodier : propositions de K pour la Tunisie (jamais de K par défaut) ──
export const FRANCOU_RODIER_MIN_RELIABLE_AREA_KM2 = 100;
export const FRANCOU_RODIER_REGIONS = Object.freeze([
  { id: 'NordMedjerda', label: 'Nord / Medjerda (~100 ans)', suggestedK: 3.8, periodHint: '3,5–4,1' },
  { id: 'NordIchkeul', label: 'Nord / Ichkeul centennale', suggestedK: 4.0, periodHint: '≈ 4' },
  { id: 'NordCatastrophe', label: 'Nord catastrophe (indicatif)', suggestedK: 4.5, periodHint: '≈ 4,5' },
  { id: 'CentreDorsale', label: 'Centre dorsale (~50–100 ans)', suggestedK: 4.8, periodHint: '4,5–5,1' },
  { id: 'Zeroud', label: 'Zéroud / Sidi Saad (fort)', suggestedK: 5.6, periodHint: '≈ 5,6' },
  { id: 'Sud50', label: 'Sud / Centre-Sud (~50 ans)', suggestedK: 4.3, periodHint: '4,2–4,5' },
  { id: 'Sud100', label: 'Sud / Centre-Sud (~100–200 ans)', suggestedK: 5.0, periodHint: '4,9–5,1' },
]);
const francouRodierRegion = (id) => (id ? FRANCOU_RODIER_REGIONS.find((r) => r.id.toLowerCase() === String(id).toLowerCase()) ?? null : null);

// ═══════════════════════════════════════════════════════════════════════════
// Note circulaire DGPC N°1054/2019, §4 (ReturnPeriodSelector.cs)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Période de retour recommandée (30, 50 ou 100 ans) selon la note DGPC 1054/2019 §4.
 * @param {'AutorouteExpressRocade'|'RouteClassee'|'PisteRurale'} roadCategory
 * @param {'OuvrageArt'|'DalotBuseOuAutre'|'Submersible'} structureType
 * @param {number} areaKm2  surface du bassin
 * @param {number} tjma     TJMA à l'horizon projet (véh/j, deux sens) — routes classées seulement
 */
export function recommendReturnPeriodDgpc(roadCategory, structureType, areaKm2, tjma = 0) {
  if (structureType === 'Submersible') return 100;
  switch (roadCategory) {
    case 'AutorouteExpressRocade': return 100;
    case 'RouteClassee':
      if (structureType === 'OuvrageArt') return 100;
      if (structureType === 'DalotBuseOuAutre') {
        if (areaKm2 >= 100 || tjma > 3300) return 100;
        if (tjma > 650) return 50;
        return areaKm2 >= 10 ? 50 : 30;
      }
      return 100;
    case 'PisteRurale': return areaKm2 >= 100 ? 100 : areaKm2 >= 10 ? 50 : 30;
    default: return 100;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Stations Montana tunisiennes — table 18 DRE (MontanaStations.cs)
// ═══════════════════════════════════════════════════════════════════════════

/** Méridien de Paris ≈ 2°20′14″ E. */
const PARIS_MERIDIAN_DEG = 2.337222222;

/** Degrés WGS84 : lat_deg/lon_deg prioritaires, sinon gon × 0,9 (+ méridien de Paris pour la longitude). */
function resolveLatLon(c) {
  if (!c) return { lat: null, lon: null };
  if (typeof c.lat_deg === 'number' && typeof c.lon_deg === 'number') return { lat: c.lat_deg, lon: c.lon_deg };
  if (typeof c.lat_gon !== 'number' || typeof c.lon_gon !== 'number') return { lat: null, lon: null };
  const hasGr = (s) => typeof s === 'string' && s.toLowerCase().includes('gr');
  const looksLikeGon = hasGr(c.lat_gon_raw) || hasGr(c.lon_gon_raw) || c.lat_gon >= 38.5 || c.lon_gon < 7.0;
  if (looksLikeGon) return { lat: c.lat_gon * 0.9, lon: c.lon_gon * 0.9 + PARIS_MERIDIAN_DEG };
  return { lat: c.lat_gon, lon: c.lon_gon };
}

/** aT ≈ T sur presque toutes les périodes : fiche illisible / mal saisie (ex. Siah Amara). */
function looksLikeAtypicalAT(aT) {
  if (!aT) return false;
  let n = 0, hit = 0;
  for (const [t, a] of Object.entries(aT)) { n++; if (Math.abs(a - Number(t)) < 0.5) hit++; }
  return n >= 3 && hit >= n - 1;
}

const numTable = (o) => (o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [Number(k), v])) : null);

const MONTANA_TN = (MONTANA_TN_DATA.stations || []).filter((s) => s && s.table18).map((s) => {
  const t = s.table18;
  const { lat, lon } = resolveLatLon(s.coordinates);
  const notes = t.notes ?? null;
  return Object.freeze({
    region: 'tunisie',
    code: s.code ?? '',
    name: s.name ?? s.code ?? '?',
    lat, lon, notes,
    atypical: (notes != null && notes.toLowerCase().includes('atypique')) || looksLikeAtypicalAT(t.aT_by_T_years),
    // Première durée pluviographique couverte par la table 18 (5 min pour toutes les stations).
    minDurationMinutes: 5,
    aByT: numTable(t.aT_by_T_years) ?? {},
    b: typeof t.b === 'number' ? t.b : null,
    c: typeof t.c === 'number' ? t.c : null,
    bByT: numTable(t.b_by_T_years),
    cByT: numTable(t.c_by_T_years),
    formula: 'I (mm/h) = a_T / (t_h + c)^b, t_h en heures',
  });
});

/** Station de la table 18 par son code (insensible à la casse), ou null. */
export function findMontanaStation(code) {
  if (code == null || String(code).trim() === '') return null;
  const k = String(code).toLowerCase();
  return MONTANA_TN.find((s) => s.code.toLowerCase() === k) ?? null;
}

/**
 * a, b, c d'une station tunisienne pour la période T (MontanaStation.TryResolve) : repli sur la
 * période TABULÉE la plus proche, signalé par `tabulated: false` et `tUsed`.
 * @returns {{a:number,b:number,c:number,tUsed:number,tabulated:boolean}|null}
 */
export function resolveMontanaStation(stationOrCode, T) {
  const st = typeof stationOrCode === 'string' ? findMontanaStation(stationOrCode) : stationOrCode;
  if (!st || st.atypical) return null;
  const look = (tbl) => {
    if (!tbl || Object.keys(tbl).length === 0) return null;
    if (tbl[T] !== undefined) return tbl[T];
    return tbl[closestKey(tbl, T)];
  };
  const a = look(st.aByT);
  if (!(a > 0)) return null;
  let b;
  if (st.b > 0) b = st.b; else { b = look(st.bByT); if (!(b > 0)) return null; }
  let c;
  if (st.c != null && st.c >= 0) c = st.c; else { c = look(st.cByT); if (!(c != null && c >= 0)) return null; }
  const tabulated = st.aByT[T] !== undefined;
  return { a, b, c, tUsed: tabulated ? T : closestKey(st.aByT, T), tabulated };
}

// ═══════════════════════════════════════════════════════════════════════════
// Stations Montana d'Afrique de l'Ouest et centrale — CIEH (MontanaAfrica.cs)
// Forme publiée : i = A_T · t^(−b), i en mm/min, t en minutes, b > 0.
// Convention BVTrace : i = a · tc^b en mm/h ⇒ a = 60 · A_T, b = −b.
// Seul T = 10 ans est PUBLIÉ ; 2 et 5 ans interpolés, 20 ans extrapolé : le statut voyage avec la valeur.
// ═══════════════════════════════════════════════════════════════════════════

const MONTANA_AF = (MONTANA_AF_DATA.stations || []).map((s, i) => Object.freeze({
  region: 'afrique',
  key: `${s.pays} — ${s.station}`,
  index: i,
  country: s.pays,
  name: s.station,
  towns: s.villes_representatives ?? null,
  isZone: !!s.est_zone,
  points: (s.points || []).map((p) => ({ town: p.ville, lat: p.lat ?? null, lon: p.lon ?? null, note: p.note ?? null })),
  ranges: (s.plages || []).map((p) => ({
    label: p.libelle, tMinMinutes: p.t_min_min, tMaxMinutes: p.t_max_min, bPublished: p.b,
    byT: (p.A_par_T || []).map((v) => ({
      T: v.T, A_T: v.A_T, status: v.statut, published: /publié/i.test(v.statut || ''),
    })),
  })),
  url: s.url ?? null,
}));

function findMontanaAfrica(ref) {
  if (ref == null) return null;
  if (typeof ref === 'number') return MONTANA_AF[ref] ?? null;
  const k = String(ref).trim().toLowerCase();
  return MONTANA_AF.find((s) => s.key.toLowerCase() === k)
    ?? MONTANA_AF.find((s) => s.name.toLowerCase() === k) ?? null;
}

/**
 * Coefficients IDF (convention BVTrace : i = a · t^b, mm/h, t en minutes) d'une station CIEH.
 * Reproduit ce que fait la carte « Montana Afrique » de BVTrace : a = 60·A_T et b = −b, saisis à
 * 3 décimales, source « CIEH station (pays), T = … ans, plage — statut » (d'où la durée minimale).
 * @param {{station:string|number, range?:string|number, T?:number}} ref
 *   station : « Pays — Station », nom de station ou indice ; range : libellé (« 5–60 min ») ou indice
 *   de la plage (défaut : la première) ; T : période de retour (défaut 10, seule valeur publiée).
 */
export function montanaAfricaIdf({ station, range = 0, T = 10 } = {}) {
  const st = findMontanaAfrica(station);
  if (!st) return { ok: false, reason: `Station Montana Afrique « ${station} » introuvable.` };
  const pl = typeof range === 'number' ? st.ranges[range]
    : st.ranges.find((p) => p.label === range) ?? null;
  if (!pl) return { ok: false, reason: `Plage « ${range} » absente pour ${st.key}.` };
  const v = pl.byT.find((x) => x.T === T);
  if (!v) return { ok: false, reason: `T = ${T} ans non disponible pour ${st.key}, ${pl.label} (disponibles : ${pl.byT.map((x) => x.T).join(', ')} ans).` };
  const a = Number(fg(60 * v.A_T, 3));
  const b = Number(fg(-pl.bPublished, 3));
  return {
    ok: true, a, b, unit: 'min', T, status: v.status, published: v.published,
    range: pl.label, tMinMinutes: pl.tMinMinutes, tMaxMinutes: pl.tMaxMinutes,
    source: `CIEH ${st.name} (${st.country}), T = ${T} ans, ${pl.label} — ${v.status}`,
  };
}

/**
 * Stations Montana disponibles.
 * @returns {{tunisie: object[], afrique: object[], formulas: {tunisie:string, afrique:string}}}
 */
export function listMontanaStations() {
  return {
    tunisie: MONTANA_TN,
    afrique: MONTANA_AF,
    formulas: {
      tunisie: 'Table 18 DRE : I (mm/h) = a_T / (t/60 + c)^b, t en minutes ; durée minimale 5 min',
      afrique: MONTANA_AF_DATA.formule + ' (' + MONTANA_AF_DATA.unite_i + ', t en ' + MONTANA_AF_DATA.unite_t + ') — '
        + MONTANA_AF_DATA.conversion_bvtrace + ' ' + MONTANA_AF_DATA.avertissement,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Abaque C de la méthode rationnelle tunisienne (RunoffCoefficientTunisia.cs)
// Pente faible (0-2 %) ou moyenne (2-8 %) : C = 0,40 / 0,50 / 0,60 ; forte (> 8 %) : 0,50 / 0,60 / 0,70
// pour les indices de végétation 1 (> 50 % couvert) / 2 (30 à 50 %) / 3 (< 30 %).
// ═══════════════════════════════════════════════════════════════════════════

export const RUNOFF_ABAQUE = Object.freeze({
  lowSlopeMaxPct: 2, steepSlopeMinPct: 8,
  rows: [
    { label: 'Pente faible ou moyenne', values: [0.40, 0.50, 0.60] },
    { label: 'Pente forte', values: [0.50, 0.60, 0.70] },
  ],
});

const slopeClassOf = (pct) => (pct < 2 ? 'faible' : pct > 8 ? 'forte' : 'moyenne');
const SLOPE_CLASS_LABEL = { faible: 'pente faible (0 à 2 %)', moyenne: 'pente moyenne (2 à 8 %)', forte: 'pente forte (> 8 %)' };

/** Indice de végétation d'après la couverture (%) : > 50 ⇒ 1, 30 à 50 ⇒ 2, < 30 ⇒ 3 ; null hors 0-100. */
export function vegetationIndexFromCover(coverPct) {
  if (typeof coverPct !== 'number' || Number.isNaN(coverPct) || coverPct < 0 || coverPct > 100) return null;
  if (coverPct > 50) return 1;
  return coverPct >= 30 ? 2 : 3;
}

/**
 * Lecture de l'abaque C : la pente (%) donne la classe, l'indice de végétation la colonne.
 * Aucune valeur sans les deux entrées : le motif est renvoyé à la place.
 * @param {{slopePct:number, vegetationIndex?:number|null, coverPct?:number}} p
 */
export function runoffCoefficientTunisia({ slopePct, vegetationIndex = undefined, coverPct = NaN }) {
  const iv = vegetationIndex !== undefined ? vegetationIndex : vegetationIndexFromCover(coverPct);
  if (iv == null) return { ok: false, C: 0, reason: "couverture végétale du bassin non mesurée : sans elle, l'indice de végétation (1, 2 ou 3) est inconnu" };
  if (!(iv >= 1 && iv <= 3) || !Number.isInteger(iv)) return { ok: false, C: 0, reason: `indice de végétation « ${iv} » hors abaque : seuls 1, 2 et 3 existent` };
  if (!(slopePct > 0)) return { ok: false, C: 0, reason: 'pente du bassin inconnue : la classe de pente ne peut être déduite' };
  const cls = slopeClassOf(slopePct);
  const C = (cls === 'forte' ? RUNOFF_ABAQUE.rows[1] : RUNOFF_ABAQUE.rows[0]).values[iv - 1];
  const source = `abaque C — ${SLOPE_CLASS_LABEL[cls]} (${fx(slopePct, 2)} %) · indice de végétation ${iv}`
    + (Number.isNaN(coverPct) ? '' : ` (${fx(coverPct, 1)} % couvert)`);
  return { ok: true, C, slopeClass: cls, vegetationIndex: iv, slopePct, coverPct, source };
}

// ═══════════════════════════════════════════════════════════════════════════
// Méthode CIEH — FAO 54, chapitre 4 (CiehCharts.cs)
// Q10 = a · S^s · Ig^i · Pm10^pm · Kr10^k · Dd^d (éq. 4.1) ; Pan ne porte AUCUN exposant.
// ═══════════════════════════════════════════════════════════════════════════

const CIEH_REGS = CIEH_DATA.regressions?.lignes ?? [];
const CIEH_DOMAIN = { pan_min_mm: 400, pan_max_mm: 1150, s_calage_min_km2: 10, s_calage_max_km2: 100, s_max_km2: 1000, ...(CIEH_DATA.domaine_application || {}) };
const ciehById = (no) => CIEH_REGS.find((r) => r.no === no) ?? null;

function ciehFormula(r) {
  const t = [];
  if (r.s != null) t.push(`S^${fg(r.s, 3)}`);
  if (r.ig != null) t.push(`Ig^${fg(r.ig, 3)}`);
  if (r.pm10 != null) t.push(`Pm10^${fg(r.pm10, 3)}`);
  if (r.kr10 != null) t.push(`Kr10^${fg(r.kr10, 3)}`);
  if (r.dd != null) t.push(`Dd^${fg(r.dd, 3)}`);
  return `Q10 = ${g6(r.a)}` + (t.length ? ' · ' + t.join(' · ') : '');
}
function ciehRequired(r) {
  const o = [];
  if (r.s != null) o.push('S'); if (r.ig != null) o.push('Ig'); if (r.pm10 != null) o.push('Pm10');
  if (r.kr10 != null) o.push('Kr10'); if (r.dd != null) o.push('Dd');
  return o;
}

/** Coefficient d'abattement (éq. 1.9) : A = 1 − (161 − 0,042·Pan)/1000 · log10(S). */
export function abattement(panMm, areaKm2) {
  if (!(areaKm2 > 0) || !(panMm > 0)) return null;
  return 1 - (161 - 0.042 * panMm) / 1000 * Math.log10(areaKm2);
}
/** Pm10 = P10 · A ; null si P10, Pan ou S manque. */
export function pm10(p10Mm, panMm, areaKm2) {
  if (p10Mm == null || panMm == null || areaKm2 == null) return null;
  const a = abattement(panMm, areaKm2);
  return a == null ? null : p10Mm * a;
}
/** Kr10 (%) de secours d'après la géologie (tableau 9) : Kr10 = a · Pan^b. Corrélations faibles. */
export function kr10FromGeology(category, panMm) {
  const row = (CIEH_DATA.kr10_geologie?.categories || []).find((c) => c.categorie.toLowerCase() === String(category ?? '').toLowerCase());
  if (!row || !(panMm > 0)) return null;
  return row.a * Math.pow(panMm, row.b);
}
export const KR10_GEOLOGY_CATEGORIES = Object.freeze((CIEH_DATA.kr10_geologie?.categories || []).map((c) => ({ ...c })));

/**
 * Applique une régression du tableau 11. Toute variable exigée mais absente annule le calcul.
 * @param {number} no  numéro de ligne du tableau 11
 * @param {{areaKm2?:number, igMPerKm?:number, panMm?:number, p10Mm?:number, pm10Mm?:number, kr10Pct?:number, ddKmPerKm2?:number}} input
 */
export function applyCiehRegression(no, input) {
  const reg = typeof no === 'object' ? no : ciehById(no);
  if (!reg) return { ok: false, no, q10: null, reason: `régression n° ${no} absente du tableau 11` };
  const res = {
    ok: false, no: reg.no, groupe: reg.groupe, description: reg.description, n: reg.n, r2: reg.r2,
    formula: ciehFormula(reg), q10: null, reason: '',
  };
  const p = input.pm10Mm ?? pm10(input.p10Mm ?? null, input.panMm ?? null, input.areaKm2 ?? null);
  const miss = [];
  if (reg.s != null && !(input.areaKm2 > 0)) miss.push('S');
  if (reg.ig != null && !(input.igMPerKm > 0)) miss.push('Ig');
  if (reg.pm10 != null && !(p > 0)) miss.push('Pm10 (P10 et Pan requis)');
  if (reg.kr10 != null && !(input.kr10Pct > 0)) miss.push('Kr10');
  if (reg.dd != null && !(input.ddKmPerKm2 > 0)) miss.push('Dd');
  if (miss.length) { res.reason = 'Donnée manquante : ' + miss.join(', '); return res; }
  let q = reg.a;
  if (reg.s != null) q *= Math.pow(input.areaKm2, reg.s);
  if (reg.ig != null) q *= Math.pow(input.igMPerKm, reg.ig);
  if (reg.pm10 != null) q *= Math.pow(p, reg.pm10);
  if (reg.kr10 != null) q *= Math.pow(input.kr10Pct, reg.kr10);
  if (reg.dd != null) q *= Math.pow(input.ddKmPerKm2, reg.dd);
  if (!Number.isFinite(q) || q <= 0) { res.reason = 'Résultat non représentable pour ces données.'; return res; }
  res.ok = true; res.q10 = q;
  return res;
}

/** Limites d'application CIEH (page 96) — avertissements, pas des refus. */
export function ciehDomainWarnings(panMm, areaKm2) {
  const d = CIEH_DOMAIN, out = [];
  if (panMm > 0) {
    if (panMm > d.pan_max_mm) out.push(`Pan = ${fx(panMm, 0)} mm > ${fx(d.pan_max_mm, 0)} mm : le manuel n'a retenu que les équations sous cette limite.`);
    else if (panMm < d.pan_min_mm) out.push(`Pan = ${fx(panMm, 0)} mm < ${fx(d.pan_min_mm, 0)} mm : hors du domaine de la méthode.`);
  }
  if (areaKm2 > 0) {
    if (areaKm2 > d.s_max_km2) out.push(`S = ${fx(areaKm2, 0)} km² > ${fx(d.s_max_km2, 0)} km² : hors du domaine d'application.`);
    else if (areaKm2 < d.s_calage_min_km2 || areaKm2 > d.s_calage_max_km2)
      out.push(`S = ${fx(areaKm2, 1)} km² hors de la plage de calage (${fx(d.s_calage_min_km2, 0)}-${fx(d.s_calage_max_km2, 0)} km²) — estimation moins assurée.`);
  }
  return out;
}

const CIEH_GROUPS = new Map();
for (const g of CIEH_DATA.criteres_selection?.groupes || []) if (!CIEH_GROUPS.has(g.groupe)) CIEH_GROUPS.set(g.groupe, g);
const CIEH_PAN_BANDS = new Map();
for (const b of CIEH_DATA.criteres_selection?.bandes_pan_par_ligne || []) if (!CIEH_PAN_BANDS.has(b.no)) CIEH_PAN_BANDS.set(b.no, b);

/**
 * Régressions du tableau 11 avec leur domaine : variables exigées, exposants, n, r², critère de
 * sélection (bande de Pan, bande de longitude, pays) tel que transcrit du bulletin.
 */
export function listCiehRegressions() {
  return CIEH_REGS.map((r) => {
    const g = CIEH_GROUPS.get(r.groupe) || {};
    const band = CIEH_PAN_BANDS.get(r.no);
    return {
      no: r.no, groupe: r.groupe, description: r.description, n: r.n, r2: r.r2, r: r.r,
      coefficients: { a: r.a, s: r.s ?? null, ig: r.ig ?? null, pm10: r.pm10 ?? null, kr10: r.kr10 ?? null, dd: r.dd ?? null },
      required: ciehRequired(r), formula: ciehFormula(r), note: r.note ?? '',
      domain: {
        panMinMm: g.par_ligne ? band?.pan_min ?? null : g.pan_min ?? null,
        panMaxMm: g.par_ligne ? band?.pan_max ?? null : g.pan_max ?? null,
        lonMinDeg: g.lon_min ?? null, lonMaxDeg: g.lon_max ?? null, countries: g.pays ?? null,
      },
    };
  });
}

/** Domaine global de la méthode CIEH (page 96) et note de sélection du manuel. */
export const CIEH_INFO = Object.freeze({
  domain: CIEH_DOMAIN, selectionNote: CIEH_DATA.regressions?.note_selection ?? '',
  source: CIEH_DATA.source, equation: CIEH_DATA.equation,
});

function fmtLonRange(min, max) {
  const L = (v) => (v < 0 ? `${fx(-v, 0)}° W` : `${fx(v, 0)}° E`);
  if (min != null && max != null) return `longitude ${L(min)} à ${L(max)}`;
  if (min != null) return `longitude > ${L(min)}`;
  return `longitude < ${L(max)}`;
}

/**
 * Proposition de régressions applicables (CiehCharts.Suggest). Ne fait que PROPOSER : le choix final
 * reste à l'utilisateur. Les frontières Natural Earth de BVTrace ne sont pas portées : le pays se
 * passe en `country` (« Sénégal », « Burkina Faso »…) ; sans pays, aucun découpage par pays n'est proposé.
 * @returns {{no:number, groupe:string, description:string, motif:string}[]}
 */
export function suggestCiehRegressions({ lon = null, pan = null, country = null } = {}) {
  const out = [];
  for (const reg of CIEH_REGS) {
    const g = CIEH_GROUPS.get(reg.groupe);
    if (!g) continue;
    const motifs = [];
    if (g.pays && g.pays.length) {
      if (country == null) continue;
      if (!g.pays.some((p) => p.toLowerCase() === String(country).toLowerCase())) continue;
      motifs.push(String(country));
    }
    if (g.par_ligne) {
      const band = CIEH_PAN_BANDS.get(reg.no);
      if (!band || pan == null) continue;
      if (pan < band.pan_min || pan > band.pan_max) continue;
      motifs.push(`Pan ${fx(band.pan_min, 0)}-${fx(band.pan_max, 0)} mm`);
    } else {
      if (g.pan_min != null) { if (pan == null || pan < g.pan_min) continue; motifs.push(`Pan ≥ ${fx(g.pan_min, 0)} mm`); }
      if (g.pan_max != null) { if (pan == null || pan > g.pan_max) continue; motifs.push(`Pan ≤ ${fx(g.pan_max, 0)} mm`); }
    }
    if (g.lon_min != null || g.lon_max != null) {
      if (lon == null) continue;
      if (g.lon_min != null && lon < g.lon_min) continue;
      if (g.lon_max != null && lon > g.lon_max) continue;
      motifs.push(fmtLonRange(g.lon_min ?? null, g.lon_max ?? null));
    }
    if (!motifs.length) continue;
    out.push({ no: reg.no, groupe: reg.groupe, description: reg.description, motif: motifs.join(' · ') });
  }
  return out.sort((a, b) => a.no - b.no);
}

// ═══════════════════════════════════════════════════════════════════════════
// Check-list de l'annexe 1 (Fao54Checklist.cs) — rien n'est appliqué d'office
// ═══════════════════════════════════════════════════════════════════════════

const zoneId = (zone) => (zone === 'tropicale' ? 'tropicale' : 'sahelienne');

function rangeText(c) {
  if (c.min == null && c.max == null) return '';
  const unit = (c.type || '').endsWith('_pct') ? ' %' : '';
  if (c.min != null && c.max != null && Math.abs(c.min - c.max) < 1e-9) return `${fg(c.min, 2)}${unit}`;
  if (c.min != null && c.max != null) return `${fg(c.min, 2)} à ${fg(c.max, 2)}${unit}`;
  return c.max != null ? `≤ ${fg(c.max, 2)}${unit}` : `≥ ${fg(c.min, 2)}${unit}`;
}

/** Items de la check-list pour la zone ('sahelienne' | 'tropicale'), fourchettes lisibles comprises. */
export function listChecklistItems(zone = 'sahelienne') {
  const z = (CHECKLIST_DATA.zones || []).find((x) => x.id === zoneId(zone));
  return (z?.items || []).map((it) => ({
    code: it.code, titre: it.titre, texte: it.texte, bloquant: !!it.bloquant,
    corrections: (it.corrections || []).map((c) => ({ ...c, rangeText: rangeText(c) })),
  }));
}

/**
 * Compose les choix de l'utilisateur en facteurs multiplicatifs (cumul multiplicatif).
 * Choix : { itemCode, value, parametre?, type?, libelle?, correctionIndex? } — parametre/type/libelle
 * sont repris de la correction n° correctionIndex (0 par défaut) de l'item s'ils manquent.
 */
export function composeChecklist(choices, zone = 'sahelienne') {
  const eff = {
    sFactor: 1, krFactor: 1, tbFactor: 1, tmFactor: 1, qOrstomFactor: 1, qCiehFactor: 1,
    alphaOverride: null, alphaFactor: 1, blocking: [], journal: [],
  };
  if (!choices) return eff;
  const items = listChecklistItems(zone);
  const apply = (p, f) => {
    switch (p) {
      case 'S': eff.sFactor *= f; break; case 'Kr': eff.krFactor *= f; break;
      case 'Tb': eff.tbFactor *= f; break; case 'Tm': eff.tmFactor *= f; break;
      case 'alpha': eff.alphaFactor *= f; break; case 'Q_orstom': eff.qOrstomFactor *= f; break;
      case 'Q_cieh': eff.qCiehFactor *= f; break;
    }
  };
  for (const ch of choices) {
    const item = items.find((i) => i.code === ch.itemCode);
    if (item && item.bloquant) {
      eff.blocking.push(`${item.code} — ${item.titre}`);
      eff.journal.push(`${item.code} : BLOQUANT — ${item.titre}`);
      continue;
    }
    const corr = item?.corrections?.[ch.correctionIndex ?? 0] ?? {};
    const parametre = ch.parametre ?? corr.parametre ?? '';
    const type = ch.type ?? corr.type ?? '';
    const libelle = ch.libelle ?? corr.libelle ?? '';
    const v = Number(ch.value ?? 0);
    const label = libelle.trim() ? libelle : parametre;
    switch (type) {
      case 'reduction_pct':
        apply(parametre, 1 - v / 100);
        eff.journal.push(`${ch.itemCode} : ${parametre} réduit de ${fg(v, 1)} % — ${label}`);
        break;
      case 'majoration_pct':
        apply(parametre, 1 + v / 100);
        eff.journal.push(`${ch.itemCode} : ${parametre} majoré de ${fg(v, 1)} % — ${label}`);
        break;
      case 'valeur':
      case 'valeur_max':
        if (parametre === 'alpha') {
          eff.alphaOverride = v;
          eff.journal.push(`${ch.itemCode} : alpha imposé à ${fg(v, 2)} — ${label}`);
        }
        break;
      case 'fraction_aval':
        eff.sFactor *= v;
        eff.journal.push(`${ch.itemCode} : S réduite à ${fg(v * 100, 1)} % (partie aval) — ${label}`);
        break;
      case 'surface_reduite':
        // Comme BVTrace : journalisé seulement, la superficie S' n'est pas convertie en facteur.
        eff.journal.push(`${ch.itemCode} : calcul sur la superficie réduite S' = ${fg(v, 3)} km² — ${label}`);
        break;
    }
  }
  return eff;
}

const isIdentity = (e) => e.blocking.length === 0 && e.alphaOverride == null
  && [e.sFactor, e.krFactor, e.tbFactor, e.tmFactor, e.qOrstomFactor, e.qCiehFactor, e.alphaFactor].every((f) => Math.abs(f - 1) < 1e-12);

/** Résumé court des corrections (CampaignOps.SummariseChecklist). */
function summariseChecklist(choices, zone) {
  if (!choices || choices.length === 0) return '';
  const eff = composeChecklist(choices, zone);
  if (eff.blocking.length) return 'BLOQUANT : ' + eff.blocking.join(' · ');
  const parts = [];
  const add = (n, f) => { if (Math.abs(f - 1) > 1e-12) parts.push(`${n}×${fg(f, 3)}`); };
  add('S', eff.sFactor); add('Kr', eff.krFactor); add('Tb', eff.tbFactor);
  add('Tm', eff.tmFactor); add('Qo', eff.qOrstomFactor); add('Qc', eff.qCiehFactor);
  if (eff.alphaOverride != null) parts.push(`α=${fg(eff.alphaOverride, 2)}`); else add('α', eff.alphaFactor);
  return parts.join(' · ');
}

// ═══════════════════════════════════════════════════════════════════════════
// Méthode Orstom (Rodier) — FAO 54, chapitre 3 (OrstomMethod.cs)
// Pm10 = P10·A → Kr10 → Vr10 → Tb10 → Qm10 = 16,7·Pm10·Kr10·S/Tb10 → Qr10 = α10·Qm10
// → Q10 = (1 + r)·Qr10 → Vc10, Tm10 ; Q100 = C·Q10 (Gradex, page 29).
// ═══════════════════════════════════════════════════════════════════════════

const ORSTOM_ORDINALS = ORSTOM_DATA.classes_infiltrabilite?.ordinaux ?? {};
const ORSTOM_ORD_SORTED = Object.entries(ORSTOM_ORDINALS).map(([key, value]) => ({ key, value })).sort((a, b) => a.value - b.value);
const orstomOrdinal = (cls) => (cls == null ? null : (ORSTOM_ORDINALS[String(cls).trim().toUpperCase()] ?? null));

function krRowEval(r, s) { return r.a / (s + r.b) + r.c; }

function krAt(rows, s, ig, ordinal, tpMedian) {
  if (!rows || rows.length === 0) return null;
  const atClass = (classe, igT) => {
    const byClass = rows.filter((r) => r.classe === classe).sort((a, b) => a.ig - b.ig);
    if (byClass.length === 0) return (classe === 'TP' && tpMedian != null) ? tpMedian : null;
    const below = [...byClass].reverse().find((r) => r.ig <= igT) ?? null;
    const above = byClass.find((r) => r.ig >= igT) ?? null;
    if (!below && !above) return null;
    if (!below) return krRowEval(above, s);
    if (!above) return krRowEval(below, s);
    if (Math.abs(above.ig - below.ig) < 1e-9) return krRowEval(below, s);
    const vb = krRowEval(below, s), va = krRowEval(above, s);
    return vb + (va - vb) * (igT - below.ig) / (above.ig - below.ig);
  };
  if (ORSTOM_ORD_SORTED.length === 0) return null;
  const none = { key: null, value: 0 };   // default(KeyValuePair) de C#
  const lo = [...ORSTOM_ORD_SORTED].reverse().find((kv) => kv.value <= ordinal + 1e-9) ?? none;
  const hi = ORSTOM_ORD_SORTED.find((kv) => kv.value >= ordinal - 1e-9) ?? none;
  const vLo = atClass(lo.key ?? '', ig), vHi = atClass(hi.key ?? '', ig);
  if (vLo == null && vHi == null) return null;
  if (vLo == null) return vHi;
  if (vHi == null) return vLo;
  if (Math.abs(hi.value - lo.value) < 1e-9) return vLo;
  return vLo + (vHi - vLo) * (ordinal - lo.value) / (hi.value - lo.value);
}

/** Kr10 (%) analytique (éq. 3.2/3.3) : interpolation classe → Ig → P10 entre Kr70 et Kr100. */
export function orstomKr10(input) {
  const zone = input.zone === 'tropicale' ? ORSTOM_DATA.kr?.tropical : ORSTOM_DATA.kr?.sahelien;
  const out = { value: null, kr70: NaN, kr100: NaN, reason: '' };
  if (!zone) { out.reason = 'Données Orstom non chargées.'; return out; }
  const d = zone.domaine;
  if (d) {
    if (d.s_min_km2 != null && input.areaKm2 < d.s_min_km2) { out.reason = d.motif_hors_domaine; return out; }
    if (d.s_max_km2 != null && input.areaKm2 > d.s_max_km2) { out.reason = d.motif_hors_domaine; return out; }
    if (d.ig_max_m_par_km != null && input.igMPerKm > d.ig_max_m_par_km) { out.reason = d.motif_hors_domaine; return out; }
  }
  const ord = input.infiltrabilityOrdinal ?? 2;
  const k70 = krAt(zone.kr70, input.areaKm2, input.igMPerKm, ord, zone.kr70_tp_median ?? null);
  const k100 = krAt(zone.kr100, input.areaKm2, input.igMPerKm, ord, zone.kr100_tp_median ?? null);
  if (k70 == null || k100 == null) { out.reason = 'Aucune classe tabulée n\'encadre cette combinaison Ig / infiltrabilité.'; return out; }
  if (!(input.p10Mm > 0)) { out.reason = 'P10 requis.'; return out; }
  out.kr70 = k70; out.kr100 = k100;
  out.value = k70 + (k100 - k70) * (input.p10Mm - 70) / 30;
  return out;
}

function branchEval(b, s) {
  switch (b.type) {
    case 'linear': return b.k * s + b.d;
    case 'power': return b.k * Math.pow(s, b.e) + b.d;
    case 'powerShift': return b.k * Math.pow(Math.max(0, s - (b.shift ?? 0)), b.e) + b.d;
    default: return NaN;
  }
}
const inRange = (b, s) => (b.sMin == null || s >= b.sMin) && (b.sMax == null || s <= b.sMax);

function reductionPct(pts, s) {
  const sorted = [...pts].sort((a, b) => a.s - b.s);
  if (sorted.length === 1) return clamp(sorted[0].pct, 0, 100);
  let lo = sorted[0], hi = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) if (s >= sorted[i].s) { lo = sorted[i]; hi = sorted[i + 1]; }
  if (s < sorted[0].s) { lo = sorted[0]; hi = sorted[1]; }
  const span = hi.s - lo.s;
  if (Math.abs(span) < 1e-9) return clamp(lo.pct, 0, 100);
  return clamp(lo.pct + (hi.pct - lo.pct) * (s - lo.s) / span, 0, 100);
}

function evalClass(cls, s, ordinal) {
  const plain = cls.branches.find((b) => b.infiltrabilite == null && inRange(b, s));
  if (plain) return branchEval(plain, s);
  const bI = cls.branches.find((b) => b.infiltrabilite === 'I' && inRange(b, s));
  const bP = cls.branches.find((b) => b.infiltrabilite === 'P' && inRange(b, s));
  const oI = orstomOrdinal('I'), oP = orstomOrdinal('P');
  const vI = bI ? branchEval(bI, s) : null;
  let vP = bP ? branchEval(bP, s) : null;
  // Temps de montée : pas de branche P, réduction en % de la valeur I, tabulée en S.
  if (vP == null && vI != null && cls.reductionP && cls.reductionP.length) vP = vI * (1 - reductionPct(cls.reductionP, s) / 100);
  if (vI != null && vP != null && oI != null && oP != null) {
    const t = clamp((ordinal - oI) / (oP - oI), 0, 1);
    return vI + (vP - vI) * t;
  }
  return vI ?? vP;
}

function timeForClass(cls, s, ordinal) {
  const direct = evalClass(cls, s, ordinal);
  if (direct != null) return direct;
  if (!cls.interpLog) return null;
  const { sLow, sHigh } = cls.interpLog;
  if (!(s > sLow && s < sHigh)) return null;
  const vLow = evalClass(cls, sLow, ordinal), vHigh = evalClass(cls, sHigh, ordinal);
  if (vLow == null || vHigh == null) return null;
  const f = (Math.log10(s) - Math.log10(sLow)) / (Math.log10(sHigh) - Math.log10(sLow));
  return vLow + (vHigh - vLow) * f;
}

function timeInterpolated(classes, s, ig, ordinal) {
  if (!classes || classes.length === 0) return null;
  const sorted = [...classes].sort((a, b) => a.ig - b.ig);
  const below = [...sorted].reverse().find((c) => c.ig <= ig) ?? null;
  const above = sorted.find((c) => c.ig >= ig) ?? null;
  if (!below && !above) return null;
  if (!below) return timeForClass(above, s, ordinal);
  if (!above) return timeForClass(below, s, ordinal);
  if (Math.abs(above.ig - below.ig) < 1e-9) return timeForClass(below, s, ordinal);
  const vb = timeForClass(below, s, ordinal), va = timeForClass(above, s, ordinal);
  if (vb == null || va == null) return vb ?? va;
  return vb + (va - vb) * (ig - below.ig) / (above.ig - below.ig);
}

function orstomTb10(input) {
  const T = ORSTOM_DATA.temps;
  if (!T) return null;
  if (input.zone === 'tropicale') {
    const t = T.tb10_tropical;
    if (!t || !t.lignes.length) return null;
    const sorted = [...t.lignes].sort((a, b) => a.ig - b.ig);
    const below = [...sorted].reverse().find((r) => r.ig <= input.igMPerKm) ?? null;
    const above = sorted.find((r) => r.ig >= input.igMPerKm) ?? null;
    const ev = (r) => r.a * Math.pow(input.areaKm2, t.exposant ?? 0.36) + r.b;
    if (!below && !above) return null;
    if (!below) return ev(above);
    if (!above) return ev(below);
    if (Math.abs(above.ig - below.ig) < 1e-9) return ev(below);
    const vb = ev(below), va = ev(above);
    return vb + (va - vb) * (input.igMPerKm - below.ig) / (above.ig - below.ig);
  }
  return timeInterpolated(T.tb10_sahelien, input.areaKm2, input.igMPerKm, input.infiltrabilityOrdinal ?? 2);
}

function orstomTm10(input, tb10) {
  const T = ORSTOM_DATA.temps;
  if (!T) return null;
  if (input.zone === 'tropicale') return tb10 != null ? tb10 * (T.tm10_tropical_ratio_tb ?? 0.33) : null;
  return timeInterpolated(T.tm10_sahelien, input.areaKm2, input.igMPerKm, input.infiltrabilityOrdinal ?? 2);
}

function defaultDelayedRatio(input) {
  const oI = orstomOrdinal('I') ?? 1, oP = orstomOrdinal('P') ?? 3;
  const t = clamp(((input.infiltrabilityOrdinal ?? 2) - oI) / (oP - oI), 0, 1);
  return input.zone === 'sahelienne' ? 0.03 + (0.06 - 0.03) * t : 0.03 + (0.05 - 0.03) * t;
}

/**
 * Chaîne Orstom complète pour un bassin.
 * @param {{zone?:'sahelienne'|'tropicale', areaKm2:number, igMPerKm:number, panMm:number, p10Mm:number,
 *   infiltrabilityOrdinal?:number, kr10PctOverride?:number|null, alpha10?:number|null,
 *   delayedRunoffRatio?:number|null, p100Mm?:number|null, checklist?:object|null}} inp
 */
export function computeOrstom(inp) {
  let input = { zone: 'sahelienne', infiltrabilityOrdinal: 2, ...inp };
  const res = {
    ok: false, reason: '', warnings: [],
    abattement: 0, pm10Mm: 0, kr10Pct: 0, kr10Source: '', kr70Pct: NaN, kr100Pct: NaN,
    lr10Mm: 0, vr10M3: 0, tb10Min: 0, qm10: 0, alpha10: 0, qr10: 0, delayedRatio: 0, q10: 0,
    vret10M3: 0, vc10M3: 0, tm10Min: NaN, p100Ratio: NaN, p100RatioSource: '', c100: NaN, q100: NaN,
  };
  const eff = input.checklist ?? null;
  if (eff && eff.blocking.length > 0) {
    res.reason = 'Check-list annexe 1 — les méthodes Orstom et CIEH ne s\'appliquent pas : ' + eff.blocking.join(' · ');
    return res;
  }
  if (eff && Math.abs(eff.sFactor - 1) > 1e-12 && input.areaKm2 > 0) {
    const s2 = input.areaKm2 * eff.sFactor;
    input = { ...input, areaKm2: s2 };
    res.warnings.push(`Check-list : calcul sur la superficie réduite S' = ${fx(s2, 3)} km² (${fx(eff.sFactor * 100, 0)} % de S).`);
  }
  if (!(input.areaKm2 > 0)) { res.reason = 'Superficie requise.'; return res; }
  if (!(input.p10Mm > 0)) { res.reason = 'P10 requis.'; return res; }
  if (!(input.panMm > 0)) { res.reason = 'Pan requis (abattement).'; return res; }

  const a = abattement(input.panMm, input.areaKm2);
  if (a == null) { res.reason = 'Abattement non calculable.'; return res; }
  res.abattement = a;
  res.pm10Mm = input.p10Mm * a;

  if (input.kr10PctOverride > 0) {
    res.kr10Pct = input.kr10PctOverride;
    res.kr10Source = 'saisi (lecture graphique)';
  } else {
    const kr = orstomKr10(input);
    if (kr.value == null) { res.reason = 'Kr10 : ' + kr.reason; return res; }
    res.kr10Pct = kr.value; res.kr70Pct = kr.kr70; res.kr100Pct = kr.kr100;
    res.kr10Source = 'équations 3.2/3.3 (tableaux 1 à 4)';
  }
  if (eff && Math.abs(eff.krFactor - 1) > 1e-12) {
    res.kr10Pct *= eff.krFactor;
    res.kr10Source += ` · check-list ×${fg(eff.krFactor, 3)}`;
  }

  const krFrac = res.kr10Pct / 100;
  res.lr10Mm = res.pm10Mm * krFrac;
  res.vr10M3 = 1000 * res.pm10Mm * krFrac * input.areaKm2;

  const tb = orstomTb10(input);
  if (tb == null || !(tb > 0)) { res.reason = 'Temps de base non calculable pour cette combinaison S / Ig.'; return res; }
  res.tb10Min = tb;
  if (eff) res.tb10Min *= eff.tbFactor;

  res.qm10 = 16.7 * res.pm10Mm * krFrac * input.areaKm2 / res.tb10Min;
  res.alpha10 = eff?.alphaOverride ?? input.alpha10 ?? ORSTOM_DATA.debits?.alpha10_defaut ?? 2.6;
  if (eff && eff.alphaOverride == null) res.alpha10 *= eff.alphaFactor;
  res.qr10 = res.alpha10 * res.qm10;

  const ratio = input.delayedRunoffRatio ?? defaultDelayedRatio(input);
  res.delayedRatio = ratio;
  res.q10 = res.qr10 * (1 + ratio);
  if (eff) res.q10 *= eff.qOrstomFactor;
  res.vret10M3 = res.qr10 * ratio * res.tb10Min * 60;
  res.vc10M3 = res.vr10M3 + res.vret10M3;

  // Passage à la crue centennale — Gradex : C = 1 + ((P100 − P10)/P10)·(Tb/24)^0,12 / Kr10 (Tb en h, Kr10 fraction).
  const cfg = ORSTOM_DATA.crue_de_projet;
  if (cfg && res.tb10Min > 0 && res.kr10Pct > 0) {
    let r = null;
    if (input.p100Mm > 0 && input.p10Mm > 0) {
      r = (input.p100Mm - input.p10Mm) / input.p10Mm;
      if (r <= 0) { res.warnings.push('P100 ≤ P10 : coefficient de passage non calculé.'); r = null; }
      else res.p100RatioSource = 'calculé sur P100 et P10 saisis';
    } else if (cfg.rapport_p100_p10_defaut) {
      const d = cfg.rapport_p100_p10_defaut;
      r = input.zone === 'sahelienne' ? d.sahelien : d.tropical;
      res.p100RatioSource = input.zone === 'sahelienne'
        ? 'approximation du manuel — 0,45 en zone sahélienne'
        : 'approximation du manuel — 0,38 en zone tropicale';
    }
    if (r != null) {
      res.p100Ratio = r;
      res.c100 = 1 + r * Math.pow((res.tb10Min / 60) / 24, cfg.exposant_tb ?? 0.12) / krFrac;
      res.q100 = res.c100 * res.q10;
    }
  }

  const tm = orstomTm10(input, res.tb10Min);
  res.tm10Min = tm ?? NaN;
  if (eff && !Number.isNaN(res.tm10Min)) res.tm10Min *= eff.tmFactor;
  if (eff) for (const j of eff.journal) res.warnings.push('Check-list : ' + j);
  if (tm == null) res.warnings.push('Temps de montée non disponible pour cette combinaison S / Ig.');

  // Limites d'application (page 32) — avertissements, pas des refus.
  const dom = { pan_min_mm: 150, pan_max_mm: 1200, pan_limite_sahelien_tropical_mm: 850, s_max_km2: 1500, ...(ORSTOM_DATA.domaine_application || {}) };
  if (input.panMm > 0) {
    if (input.panMm > dom.pan_max_mm) res.warnings.push(`Pan = ${fx(input.panMm, 0)} mm > ${fx(dom.pan_max_mm, 0)} mm : hors du domaine du manuel (limite sud des isohyètes).`);
    else if (input.panMm < dom.pan_min_mm) res.warnings.push(`Pan = ${fx(input.panMm, 0)} mm < ${fx(dom.pan_min_mm, 0)} mm : hors du domaine du manuel (limite nord).`);
    const shouldTrop = input.panMm > dom.pan_limite_sahelien_tropical_mm;
    const isTrop = input.zone === 'tropicale';
    if (shouldTrop !== isTrop)
      res.warnings.push(`Zone déclarée « ${isTrop ? 'tropicale sèche' : 'sahélienne'} » alors que Pan = ${fx(input.panMm, 0)} mm (limite des régimes : ${fx(dom.pan_limite_sahelien_tropical_mm, 0)} mm) — vérifiez le réglage.`);
  }
  if (input.areaKm2 > dom.s_max_km2) res.warnings.push(`S = ${fx(input.areaKm2, 0)} km² > ${fx(dom.s_max_km2, 0)} km² : hors du domaine annoncé par le manuel.`);

  res.ok = true;
  return res;
}

export const ORSTOM_INFO = Object.freeze({
  alpha10Default: ORSTOM_DATA.debits?.alpha10_defaut ?? 2.6,
  domain: ORSTOM_DATA.domaine_application, ordinals: ORSTOM_ORDINALS,
  labels: ORSTOM_DATA.classes_infiltrabilite?.libelles ?? {}, source: ORSTOM_DATA.source,
});

// ═══════════════════════════════════════════════════════════════════════════
// Temps de concentration, hypothèses, entrées du bassin
// ═══════════════════════════════════════════════════════════════════════════

/** Les quatre formules de tc, dans l'ordre des colonnes de BVTrace. Une seule est retenue pour l'IDF. */
export const TC_FORMULAS = Object.freeze([
  { id: 'Kirpich', unit: 'min', formula: 'tc (min) = 0,0195 · (L³ / D)^0,385', inputs: 'L plus long chemin hydraulique (m), D dénivelée de ce chemin (m)' },
  { id: 'Ventura', unit: 'min', formula: 'tc (min) = 76 · √(S / I)', inputs: 'S (km²), I pente équivalente (%)' },
  { id: 'Passini', unit: 'h', formula: 'tc (h) = 0,108 · (S·L)^(1/3) / √(I/100)', inputs: 'S (km²), L (km), I (%)' },
  { id: 'Giandotti', unit: 'h', formula: 'tc (h) = (4√S + 1,5 L) / (0,8 √Hmoy)', inputs: 'S (km²), L (km), Hmoy = altitude moyenne − altitude minimale (m)' },
]);
const TC_IDS = TC_FORMULAS.map((f) => f.id);

export const METHOD_SETS = Object.freeze([
  { id: 'tunisie', label: 'Méthodes tunisiennes (SOGREAH, Ghorbel, Kallel, Fersi, Frigui, Francou-Rodier, rationnelle)' },
  { id: 'fao54', label: 'Bulletin FAO n° 54 — Afrique sahélienne et tropicale sèche (CIEH, Orstom)' },
]);

/**
 * Hypothèses de projet par défaut (HydroCalculator.DefaultHypotheses + HydroHypotheses).
 * Les mêmes champs Pan (pan) et P10 (p10) servent aux deux jeux de méthodes.
 */
export function defaultHypotheses(methodSet = 'tunisie') {
  return {
    methodSet,                       // 'tunisie' | 'fao54' — exclusifs
    returnPeriod: 10,                // ans ; surchargé par basin.returnPeriod, la note DGPC (Tunisie) ou forcé 10/100 (FAO 54)
    tcFormula: 'Kirpich',            // formule de tc RETENUE pour l'IDF : 'Kirpich' | 'Ventura' | 'Passini' | 'Giandotti'
    pan: 400,                        // pluie annuelle moyenne Pan (mm)
    p0: 20,                          // seuil de ruissellement SOGREAH P0 (mm)
    p10: 45,                         // pluie journalière décennale ponctuelle P10 (mm)
    p100: 90,                        // pluie journalière centennale P100 (mm)
    // ── IDF Tunisie (table 18) : station rattachée, sinon a/b/c saisis ──
    montanaStationCode: null,
    montanaA: 0, montanaB: 0, montanaC: 0,   // I (mm/h) = a / (t_h + c)^b, t_h en heures
    idfMinDurationMinutes: 0,        // 0 = auto (5 min pour une station table 18 ; plage de la source IDF en FAO 54)
    // ── Régionalisations tunisiennes ('NePasUtiliser' pour exclure) ──
    ghorbelZone: 'I', kallelRegion: 'NordCapBon', fersiSector: 'SudEst', friguiRegion: 'Nord',
    francouRodierK: 0,               // 0 = méthode désactivée (motif affiché) — pas de K par défaut
    francouRodierRegion: null,       // id de FRANCOU_RODIER_REGIONS : choisir une région préremplit K (comme la liste de BVTrace) ;
                                     // un K saisi (> 0) l'emporte toujours
    // ── Note circulaire DGPC 1054/2019 (Tunisie seulement, opt-in) ──
    dgpc1054: false,
    roadCategory: 'RouteClassee', structureType: 'DalotBuseOuAutre', tjma: 0,
    dgpcReturnPeriod: 100,           // 0 = auto §4 ; sinon T forcée (défaut BVTrace : 100)
    // ── FAO 54 : IDF locale i = a · tc^b (pas de terme en (t + c)) ──
    idfA: 0, idfB: 0,                // a (mm/h) et b (négatif) ; 0 = intensité saisie par bassin
    idfTimeUnit: 'min',              // unité de tc attendue par l'IDF : 'min' | 'h'
    idfSource: '',                   // origine de l'IDF (sa plage « 5–60 min » fixe la durée minimale)
    montanaAfrica: null,             // { station, range, T } : remplit idfA/idfB/idfSource depuis le référentiel CIEH
    // ── FAO 54 : CIEH / Orstom ──
    ciehRegressionIds: [],           // numéros du tableau 11 — sélection multiple, médiane retenue
    kr10Geology: null,               // catégorie du tableau 9 pour un Kr10 de secours
    orstomZone: 'sahelienne',        // 'sahelienne' | 'tropicale' (pris en compte si orstomZoneAuto = false)
    orstomZoneAuto: true,            // déduire la zone de Pan (limite 850 mm)
    alpha10: 0,                      // coefficient de pointe ; 0 = 2,6 (manuel)
  };
}

/** Documentation des hypothèses : unités et valeurs par défaut (pour l'interface). */
export const HYPOTHESES_DOC = Object.freeze([
  ['methodSet', '—', "'tunisie' | 'fao54' — jeux exclusifs"],
  ['returnPeriod', 'ans', 'période de retour par défaut des bassins (10)'],
  ['tcFormula', '—', 'formule de tc retenue pour l\'IDF (Kirpich)'],
  ['pan', 'mm', 'pluie annuelle moyenne Pan (400)'],
  ['p0', 'mm', 'seuil SOGREAH P0 (20)'],
  ['p10', 'mm', 'pluie journalière décennale P10 (45)'],
  ['p100', 'mm', 'pluie journalière centennale P100 (90)'],
  ['montanaStationCode', '—', 'code station table 18 (null)'],
  ['montanaA / montanaB / montanaC', 'mm/h, —, h', 'Montana saisi à défaut de station : I = a/(t_h + c)^b (0)'],
  ['idfMinDurationMinutes', 'min', 'durée minimale de l\'IDF, 0 = auto (0)'],
  ['ghorbelZone', '—', "I…V ou 'NePasUtiliser' (I)"],
  ['kallelRegion', '—', "NordCapBon, NoyauDorsale, CentreSahel, SudEstSudOuest ou 'NePasUtiliser' (NordCapBon)"],
  ['fersiSector', '—', "SudEst, SudOuest ou 'NePasUtiliser' (SudEst)"],
  ['friguiRegion', '—', "Nord, Medjerda, CapBonMeliane, CentreSud ou 'NePasUtiliser' (Nord)"],
  ['francouRodierK', '—', 'K régional, 0 = désactivé avec motif (0)'],
  ['francouRodierRegion', '—', 'id de FRANCOU_RODIER_REGIONS, préremplit K si K = 0 (null)'],
  ['dgpc1054', '—', 'appliquer la note DGPC 1054 en Tunisie (false)'],
  ['roadCategory / structureType / tjma', '—, —, véh/j', 'critères §4 (RouteClassee, DalotBuseOuAutre, 0)'],
  ['dgpcReturnPeriod', 'ans', '0 = auto §4, sinon T forcée (100)'],
  ['idfA / idfB', 'mm/h, —', 'FAO 54 : IDF locale i = a·tc^b (0 = intensité saisie)'],
  ['idfTimeUnit', '—', "'min' | 'h' ('min')"],
  ['idfSource', '—', 'origine de l\'IDF (\'\')'],
  ['montanaAfrica', '—', '{ station, range, T } référentiel CIEH (null)'],
  ['ciehRegressionIds', '—', 'numéros du tableau 11 ([])'],
  ['kr10Geology', '—', 'catégorie du tableau 9 (null)'],
  ['orstomZone / orstomZoneAuto', '—', "'sahelienne' / true"],
  ['alpha10', '—', 'coefficient de pointe, 0 = 2,6 (0)'],
]);

/**
 * Normalise l'entrée d'un bassin GIRA vers les grandeurs de BasinData (BVTrace), unités de BVTrace :
 * Area km², Perimeter km, Slope = Ieq en %, Length km, Drop m, GlobalSlope = Ig m/km.
 */
function normalizeBasin(inb, hyp, notes) {
  const n = (v) => { const x = num(v); return Number.isFinite(x) ? x : NaN; };
  const area = n(inb.areaKm2);
  const lengthM = n(inb.lengthM ?? inb.L);
  const slopeMm = n(inb.slope);
  const slopePct = Number.isFinite(n(inb.slopePct)) ? n(inb.slopePct) : (Number.isFinite(slopeMm) ? slopeMm * 100 : NaN);
  const hMax = n(inb.hMax), hMin = n(inb.hMin), hMean = n(inb.hMean), hMedian = n(inb.hMedian);

  // Dénivelée du plus long chemin (Kirpich) : extrémités du profil ; à défaut Hmax − Hmin (repli de BVTrace).
  let drop = n(inb.dropM);
  if (!Number.isFinite(drop) && Number.isFinite(hMax) && Number.isFinite(hMin)) {
    drop = Math.max(0, hMax - hMin);
    notes.push('Kirpich : dénivelée D du cheminement non fournie — Hmax − Hmin retenu (repli de BVTrace sans profil).');
  }
  // Giandotti : Hmoy = altitude MOYENNE − altitude MINIMALE. Jamais Hmax − Hmin.
  let meanRelief = n(inb.meanReliefM);
  if (!Number.isFinite(meanRelief) && Number.isFinite(hMean) && Number.isFinite(hMin)) meanRelief = hMean - hMin;
  // ΔH de Ghorbel = altitude MÉDIANE − altitude au franchissement (à défaut Hmin, comme BVTrace sans profil).
  let deltaH = n(inb.deltaHM);
  if (!Number.isFinite(deltaH) && Number.isFinite(hMedian)) {
    const zOut = Number.isFinite(n(inb.zOutletM)) ? n(inb.zOutletM) : hMin;
    if (Number.isFinite(zOut)) deltaH = Math.max(0, hMedian - zOut);
  }
  const z = (v) => (Number.isFinite(v) ? v : 0);
  return {
    Name: inb.name ?? inb.id ?? '',
    Area: z(area), Perimeter: z(n(inb.perimeterKm ?? inb.perimeter)), Slope: z(slopePct),
    Length: Number.isFinite(lengthM) ? lengthM / 1000 : 0, Drop: z(drop), DeltaH: z(deltaH),
    Gravelius: z(n(inb.gravelius)), GlobalSlope: z(n(inb.igMPerKm)),
    MeanRelief: z(meanRelief),
    ReturnPeriod: Number.isFinite(n(inb.returnPeriod)) ? n(inb.returnPeriod) : (Number.isFinite(n(hyp.returnPeriod)) ? n(hyp.returnPeriod) : 10),
    RunoffCoeff: Number.isFinite(n(inb.runoffCoeff)) ? n(inb.runoffCoeff) : null,
    VegetationCoverPct: Number.isFinite(n(inb.vegetationCoverPct)) ? n(inb.vegetationCoverPct) : null,
    VegetationIndex: Number.isFinite(n(inb.vegetationIndex)) ? n(inb.vegetationIndex) : null,
    Intensity: z(n(inb.intensityMmH)),
    DrainageDensity: Number.isFinite(n(inb.drainageDensity)) ? n(inb.drainageDensity) : null,
    Kr10Pct: Number.isFinite(n(inb.kr10Pct)) ? n(inb.kr10Pct) : null,
    Infiltrability: inb.infiltrability ?? 'RI',
    ChecklistChoices: Array.isArray(inb.checklist) ? inb.checklist : [],
    Lon: Number.isFinite(n(inb.lon)) ? n(inb.lon) : null,
    Lat: Number.isFinite(n(inb.lat)) ? n(inb.lat) : null,
  };
}

/** Zone Orstom réellement appliquée (HydroHypotheses.EffectiveOrstomZone) : limite des régimes 850 mm. */
export function effectiveOrstomZone(hyp) {
  const auto = hyp.orstomZoneAuto !== false;
  if (!auto || !(hyp.pan > 0)) return hyp.orstomZone === 'tropicale' ? 'tropicale' : 'sahelienne';
  return hyp.pan > 850 ? 'tropicale' : 'sahelienne';
}
function orstomZoneSource(hyp) {
  if (hyp.orstomZoneAuto === false) return "forcée par l'utilisateur";
  if (!(hyp.pan > 0)) return 'non déterminée (Pan manquant) — valeur par défaut';
  return `déduite de Pan = ${fx(hyp.pan, 0)} mm (limite des régimes : 850 mm)`;
}

/** Durée minimale de l'IDF (HydroCalculator.ResolveIdfMinimumMinutes). */
function resolveIdfMinimumMinutes(hyp) {
  if (hyp.idfMinDurationMinutes > 0) return hyp.idfMinDurationMinutes;
  if (hyp.methodSet !== 'fao54') return findMontanaStation(hyp.montanaStationCode)?.minDurationMinutes ?? 0;
  const m = /(?<!\d)(\d+(?:[.,]\d+)?)\s*[–—-]\s*\d+(?:[.,]\d+)?\s*min/i.exec(hyp.idfSource ?? '');
  if (!m) return 0;
  const v = Number(m[1].replace(',', '.'));
  return v > 0 ? v : 0;
}

const tcIdfLabel = (tcMin, usedMin, which) => (usedMin > tcMin + 1e-9
  ? `${fx(tcMin, 1)} min → ${fx(usedMin, 1)} min (minimum IDF · ${which})`
  : `${fx(tcMin, 1)} min (${which})`);
function noteIdfMinimum(w, tcMin, usedMin) {
  if (usedMin > tcMin + 1e-9)
    w.push(`IDF/Montana : tc = ${fx(tcMin, 1)} min inférieur à la durée minimale tabulée (${fx(usedMin, 1)} min) — intensité calculée à ${fx(usedMin, 1)} min.`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Calcul par bassin (HydroCalculator.ComputeAll)
// ═══════════════════════════════════════════════════════════════════════════

/** Grandeurs universelles : Gravelius et les quatre tc (valeurs relues en « F2 » comme BVTrace). */
function computeUniversal(B, w, v) {
  if (B.Perimeter > 0 && B.Area > 0) v.gravelius = Number(fx(formulas.gravelius(B.Perimeter, B.Area), 3));
  const tc = { Kirpich: null, Ventura: null, Passini: null, Giandotti: null };
  if (B.Area > 0 && B.Slope > 0) { const t = f2(formulas.venturaMinutes(B.Area, B.Slope)); tc.Ventura = { value: t, unit: 'min', minutes: t }; }
  if (B.Length > 0 && B.Drop > 0) { const t = f2(formulas.kirpichMinutes(B.Length * 1000, B.Drop)); tc.Kirpich = { value: t, unit: 'min', minutes: t }; }
  if (B.Area > 0 && B.Length > 0 && B.Slope > 0) { const t = f2(formulas.passiniHours(B.Area, B.Length, B.Slope)); tc.Passini = { value: t, unit: 'h', minutes: t * 60 }; }
  const relief = B.MeanRelief;
  if (B.Area > 0 && B.Length > 0 && relief > 0) {
    const tg = formulas.giandottiHours(B.Area, B.Length, relief);
    if (tg > 0) { const t = f2(tg); tc.Giandotti = { value: t, unit: 'h', minutes: t * 60 }; }
  } else if (B.Area > 0 && B.Length > 0) {
    w.push('Giandotti : dénivelée moyenne (Hmoy − Hmin) indisponible');
  }
  // Valeur nulle ou négative relue : BVTrace la traite comme indisponible (TcMinutes renvoie 0).
  for (const k of TC_IDS) if (tc[k] && !(tc[k].value > 0)) tc[k] = { ...tc[k], minutes: 0 };
  v.tc = tc;
}

/** tc demandé, en minutes (HydroCalculator.TcMinutes) — source unique des deux jeux. */
function tcMinutes(v, which) {
  const id = TC_IDS.includes(String(which ?? '').trim()) ? String(which).trim() : 'Kirpich';
  const t = v.tc?.[id];
  return t && t.minutes > 0 ? t.minutes : 0;
}

/** Méthode rationnelle (universelle) : Q = 0,278·C·i·S, S < 4 km². */
function computeRational(B, c, w, v) {
  if (!(c > 0 && B.Intensity > 0 && B.Area > 0)) return;
  if (B.Area >= 4) { w.push('Rationnelle : S ≥ 4 km² (hors limite)'); return; }
  v.discharges.rational = f2(formulas.rationalPeakDischarge(c, B.Intensity, B.Area));
}

function applyMontanaIntensity(B, hyp, w, v) {
  let a = num(hyp.montanaA) || 0, b = num(hyp.montanaB) || 0, c = num(hyp.montanaC) || 0;
  const station = findMontanaStation(hyp.montanaStationCode);
  const tYears = B.ReturnPeriod > 0 ? Math.trunc(B.ReturnPeriod) : 10;
  let montana = null;
  if (hyp.montanaStationCode && !station)
    w.push(`Montana : station « ${hyp.montanaStationCode} » inconnue de la table 18 — a/b/c saisis utilisés s'ils existent.`);
  if (station) {
    if (station.atypical) { w.push('Montana: station atypique (a,b,c non appliqués)'); return; }
    const r = resolveMontanaStation(station, tYears);
    if (!r) { w.push(`Montana : a/b/c indisponibles pour T = ${tYears} ans (station ${station.name})`); return; }
    ({ a, b, c } = r);
    if (!r.tabulated && Object.keys(station.aByT).length > 0)
      w.push(`Montana : T = ${tYears} ans non tabulé pour ${station.name} — coefficients de T = ${r.tUsed} ans employés.`);
    montana = { station: station.code, stationName: station.name, a, b, c, tUsed: r.tUsed, tabulated: r.tabulated };
  } else if (a <= 0 || b <= 0) {
    return;
  } else {
    montana = { station: null, stationName: null, a, b, c, tUsed: null, tabulated: null };
  }
  const which = hyp.tcFormula && String(hyp.tcFormula).trim() ? String(hyp.tcFormula).trim() : 'Kirpich';
  const tcMin = tcMinutes(v, which);
  if (tcMin <= 0) { w.push(`Montana : tc « ${which} » indisponible pour ce bassin — intensité non calculée.`); return; }
  const usedMin = formulas.effectiveIdfDurationMinutes(tcMin, resolveIdfMinimumMinutes(hyp));
  noteIdfMinimum(w, tcMin, usedMin);
  const i = formulas.montanaIntensity3(a, b, c, usedMin);
  if (i <= 0) return;
  B.Intensity = roundNet(i, 2);
  v.intensityMmH = B.Intensity;
  v.intensitySource = 'montana';
  v.montana = montana;
  v.tcRetained = { formula: which, minutes: tcMin, idfMinutes: usedMin, label: tcIdfLabel(tcMin, usedMin, which) };
}

/** IDF locale FAO 54 : i = a · tc^b (sans terme en (t + c)). */
function applyLocalIdf(B, hyp, w, v) {
  if (!(hyp.idfA > 0) || Math.abs(hyp.idfB || 0) < 1e-12) {
    if (!(B.Intensity > 0))
      w.push('Rationnelle : i non renseigné et aucune IDF locale — le bulletin FAO 54 ne fournit pas de relation intensité-durée-fréquence.');
    return;
  }
  const which = hyp.tcFormula ?? 'Kirpich';
  const tcMin = tcMinutes(v, which);
  if (tcMin <= 0) { w.push(`IDF locale : temps de concentration « ${which} » indisponible.`); return; }
  const usedMin = formulas.effectiveIdfDurationMinutes(tcMin, resolveIdfMinimumMinutes(hyp));
  noteIdfMinimum(w, tcMin, usedMin);
  const hours = String(hyp.idfTimeUnit ?? 'min').toLowerCase() === 'h';
  const t = hours ? usedMin / 60 : usedMin;
  if (hyp.idfB > 0)
    w.push(`IDF locale : b = ${fg(hyp.idfB, 3)} positif — l'intensité croîtrait avec la durée. Vérifiez le signe.`);
  const i = hyp.idfA * Math.pow(t, hyp.idfB);
  if (i > 0) {
    B.Intensity = roundNet(i, 2);
    v.intensityMmH = B.Intensity;
    v.intensitySource = 'idf';
    v.tcRetained = { formula: which, minutes: tcMin, idfMinutes: usedMin, label: tcIdfLabel(tcMin, usedMin, which) };
  }
}

function computeTunisie(B, hyp, w, v) {
  const d = v.discharges = { rational: null, sogreah: null, ghorbel: null, kallel: null, fersi: null, frigui: null, francouRodier: null };
  computeUniversal(B, w, v);
  if (B.Intensity > 0) { v.intensityMmH = B.Intensity; v.intensitySource = 'saisie'; }
  applyMontanaIntensity(B, hyp, w, v);

  // Coefficient C : CALCULÉ par l'abaque, jamais saisi en jeu Tunisie.
  let c = 0;
  if (B.RunoffCoeff != null)
    w.push(`C saisi (${fx(B.RunoffCoeff, 2)}) ignoré : en jeu Tunisie, C vient de l'abaque pente × couverture végétale.`);
  let read = null, slopeNote = '';
  if (B.VegetationCoverPct != null || B.VegetationIndex != null) {
    let slopePct = B.Slope;
    if (!(slopePct > 0) && B.GlobalSlope > 0) { slopePct = B.GlobalSlope / 10; slopeNote = ' — classe déduite de Ig, à défaut de Ieq'; }
    read = runoffCoefficientTunisia({
      slopePct,
      vegetationIndex: B.VegetationCoverPct != null ? vegetationIndexFromCover(B.VegetationCoverPct) : B.VegetationIndex,
    });
  }
  if (!read || !read.ok) {
    if (B.Area > 0 && B.Area < 4) w.push('Abaque C : ' + (read?.reason ?? 'couverture végétale non mesurée'));
  } else {
    c = read.C;
    v.runoffCoeff = { C: read.C, source: read.source + slopeNote, slopeClass: read.slopeClass, vegetationIndex: read.vegetationIndex, slopePct: read.slopePct };
  }
  if (c > 0 && !(B.Intensity > 0) && B.Area > 0 && B.Area < 4)
    w.push('Rationnelle : intensité indisponible (ni station Montana, ni a/b/c, ni i saisi).');
  computeRational(B, c, w, v);

  // SOGREAH
  if (B.Area > 0 && hyp.p0 > 0 && B.ReturnPeriod > 0 && hyp.p10 > 0 && hyp.p100 > 0) {
    const pt = formulas.sogreahRainfall(B.ReturnPeriod, hyp.p10, hyp.p100);
    if (hyp.pan > 500) w.push('Sogreah: P > 500 mm (hors limite)');
    else if (pt <= hyp.p0) w.push('Sogreah: PT <= P0');
    else d.sogreah = f2(formulas.sogreahDischarge(B.Area, pt, hyp.p0));
  }

  // Ghorbel
  const gZone = parseEnum(hyp.ghorbelZone, ENUMS.ghorbel);
  if (isUnused(hyp.ghorbelZone)) { /* exclu volontairement */ }
  else if (gZone && B.Area > 0 && B.ReturnPeriod > 0) {
    if (gZone === 'V') w.push('Ghorbel: Zone V peu testée (résultat indicatif)');
    let qMax = 0, valid = false;
    if (gZone === 'IV' || gZone === 'V') { qMax = formulas.ghorbelQmaxZone45(B.Area); valid = qMax > 0; }
    else if (hyp.pan > 0 && B.DeltaH > 0 && B.Length > 0 && B.Perimeter > 0) {
      const ic = B.Gravelius > 0 ? B.Gravelius : formulas.gravelius(B.Perimeter, B.Area);
      qMax = formulas.ghorbelQmaxZone123(B.Area, hyp.pan / 1000, B.DeltaH, B.Length, ic);
      valid = qMax > 0;
    } else w.push('Ghorbel I-III: P, DeltaH, L, Périm. requis');
    if (valid) {
      const ratios = GHORBEL_RATIOS[gZone];
      const tk = Math.trunc(B.ReturnPeriod);
      if (ratios[tk] !== undefined) d.ghorbel = f2(qMax * ratios[tk]);
      else w.push(`Ghorbel : T = ${fx(B.ReturnPeriod, 0)} ans non calé (disponibles : ${periodsLabel(ratios)})`);
    } else if (qMax <= 0 && (gZone === 'IV' || gZone === 'V' || (hyp.pan > 0 && B.DeltaH > 0 && B.Length > 0 && B.Perimeter > 0))) {
      w.push('Ghorbel : Qmax ≤ 0 pour ces données (hors domaine de la formule).');
    }
  } else if (!gZone) w.push('Ghorbel : zone non choisie');

  // Kallel
  const kRegion = parseEnum(hyp.kallelRegion, ENUMS.kallel);
  if (isUnused(hyp.kallelRegion)) { /* exclu */ }
  else if (kRegion && B.Area > 0 && B.ReturnPeriod > 0) {
    if (B.Area < 100) w.push('Kallel: S < 100 km² (hors limite)');
    else d.kallel = f2(formulas.kallel(kRegion, B.Area, B.ReturnPeriod));
  } else if (!kRegion) w.push('Kallel : région non choisie');

  // Fersi
  const ig = B.GlobalSlope > 0 ? B.GlobalSlope : B.Slope * 10;
  const fSector = parseEnum(hyp.fersiSector, ENUMS.fersi);
  if (isUnused(hyp.fersiSector)) { /* exclu */ }
  else if (fSector && B.Area > 0 && B.ReturnPeriod > 0 && hyp.pan > 0 && ig > 0) {
    if (hyp.pan > 400) w.push('Fersi: P > 400 mm (hors limite)');
    else {
      const qxMoy = formulas.fersiAnnualMax(formulas.fersiMeanRunoff(hyp.pan, ig), B.Area);
      const factors = FERSI_FACTORS[fSector];
      const tk = Math.trunc(B.ReturnPeriod);
      if (factors[tk] !== undefined) d.fersi = f2(formulas.fersiPeak(qxMoy, B.Area, ig, factors[tk]));
      else w.push(`Fersi : T = ${fx(B.ReturnPeriod, 0)} ans non calé (disponibles : ${periodsLabel(factors)})`);
    }
  } else if (!fSector) w.push('Fersi : secteur non choisi');

  // Frigui
  const frRegion = parseEnum(hyp.friguiRegion, ENUMS.frigui);
  if (isUnused(hyp.friguiRegion)) { /* exclu */ }
  else if (frRegion && B.Area > 0 && B.ReturnPeriod > 0) {
    const lambdas = FRIGUI_LAMBDAS[frRegion];
    const tk = Math.trunc(B.ReturnPeriod);
    if (lambdas[tk] !== undefined) d.frigui = f2(formulas.friguiPeak(B.Area, FRIGUI_PARAMS[frRegion], lambdas[tk]));
    else w.push(`Frigui : T = ${fx(B.ReturnPeriod, 0)} ans non calé (disponibles : ${periodsLabel(lambdas)})`);
  } else if (!frRegion) w.push('Frigui : région non choisie');

  // Francou-Rodier : K régional, jamais de valeur par défaut.
  if (B.Area > 0) {
    let k = num(hyp.francouRodierK) || 0;
    const reg = francouRodierRegion(hyp.francouRodierRegion);
    if (!(k > 0) && reg) {
      // Choix régional explicite de l'utilisateur : K proposé par la région (BVTrace le préremplit).
      k = reg.suggestedK;
      w.push(`Francou-Rodier : K = ${reg.suggestedK} proposé par la région « ${reg.label} » (plage ${reg.periodHint}) — modifiable.`);
    }
    if (k > 0) {
      if (B.Area < FRANCOU_RODIER_MIN_RELIABLE_AREA_KM2)
        w.push(`Francou-Rodier : S = ${fx(B.Area, 1)} km² < ${fx(FRANCOU_RODIER_MIN_RELIABLE_AREA_KM2, 0)} km² (domaine peu fiable — résultat indicatif)`);
      if (k > 6.5)
        w.push('Francou-Rodier : K > 6,5 hors plage usuelle des enveloppes (vérifier que ce n\'est pas un ancien K de Q=K·A^0,8)');
      d.francouRodier = f2(formulas.francouRodier(B.Area, k));
    } else {
      w.push('Francou-Rodier : K non renseigné (0 = méthode désactivée) — choisir une région Tunisie ou saisir K (typ. 3,5–5,6).');
    }
  }

  // Synthèse (BasinData.ComputeRecommendation) : médiane des débits disponibles.
  const order = [['rational', 'Rational'], ['sogreah', 'Sogreah'], ['ghorbel', 'Ghorbel'], ['kallel', 'Kallel'],
    ['fersi', 'Fersi'], ['frigui', 'Frigui'], ['francouRodier', 'Francou']];
  const list = order.filter(([k]) => d[k] != null).map(([k, m]) => ({ key: k, method: m, value: d[k] }));
  if (list.length === 0) { v.recommendation = 'Aucun débit calculé'; return; }
  const values = list.map((x) => x.value).sort((a, b) => a - b);
  const median = medianSorted(values), cv = cvPct(values);
  v.stats = { n: values.length, min: values[0], median, max: values[values.length - 1], cvPct: cv };
  let txt = '';
  if (B.Area < 4 && d.rational != null) txt += 'Petit BV: Rational recommandé. ';
  else if (B.Area >= 100 && d.kallel != null) txt += 'Grand BV: Kallel recommandé. ';
  else if (B.Area >= 10 && B.Area < 100) {
    if (d.ghorbel != null) txt += 'BV moyen: Ghorbel adapté. ';
    else if (d.frigui != null) txt += 'BV moyen: Frigui adapté. ';
  }
  txt += `Q: [${fx(values[0], 1)} - ${fx(values[values.length - 1], 1)}] m³/s, Médiane: ${fx(median, 1)} m³/s`;
  if (cv > 50) txt += ` — forte dispersion (CV=${fx(cv, 0)}%)`;
  v.recommendation = txt;
}

function computeFao54(B, hyp, w, v) {
  v.discharges = { rational: null };
  // Méthodes DÉCENNALES par construction : T choisit seulement Q10 ou Q100 = C·Q10 (Gradex).
  let tRet = B.ReturnPeriod > 0 ? B.ReturnPeriod : 10;
  if (Math.abs(tRet - 10) > 1e-9 && Math.abs(tRet - 100) > 1e-9) {
    w.push(`T = ${fx(tRet, 0)} ans : le bulletin ne donne que 10 et 100 ans — 10 ans retenu.`);
    tRet = 10;
  }
  B.ReturnPeriod = tRet;
  v.returnPeriod = tRet;

  computeUniversal(B, w, v);
  if (B.Intensity > 0) { v.intensityMmH = B.Intensity; v.intensitySource = 'saisie'; }
  applyLocalIdf(B, hyp, w, v);
  // C se SAISIT en FAO 54 : l'abaque tunisien ne s'y applique pas.
  const cFao = B.RunoffCoeff ?? 0;
  if (cFao > 0) v.runoffCoeff = { C: cFao, source: `${fx(cFao, 2)} (saisi)` };
  computeRational(B, cFao, w, v);

  let ig = B.GlobalSlope;
  if (ig <= 0 && B.Slope > 0) { ig = B.Slope * 10; w.push('Ig déduit de Ieq (approximation)'); }
  v.igMPerKm = ig > 0 ? ig : null;

  const zone = effectiveOrstomZone(hyp);
  v.orstomZone = { id: zone, source: orstomZoneSource(hyp) };

  const kr10Override = B.Kr10Pct ?? 0;
  let kr10 = kr10Override, kr10Src = 'saisi';
  if (kr10 <= 0 && hyp.kr10Geology && String(hyp.kr10Geology).trim() && hyp.pan > 0) {
    const est = kr10FromGeology(hyp.kr10Geology, hyp.pan);
    if (est != null) { kr10 = est; kr10Src = `tableau 9 — ${hyp.kr10Geology}`; w.push('Kr10 estimé (tableau 9, corrélation faible)'); }
  }

  const checklist = composeChecklist(B.ChecklistChoices, zone);
  v.checklist = { summary: '', journal: checklist.journal, blocking: checklist.blocking, identity: isIdentity(checklist), effect: checklist };
  if (checklist.blocking.length > 0) {
    w.push("Check-list annexe 1 — les méthodes Orstom et CIEH ne s'appliquent pas : " + checklist.blocking.join(' · '));
    v.recommendation = 'Méthodes non applicables (check-list annexe 1)';
    return;
  }

  // Orstom AVANT le CIEH : il fournit Kr10 analytiquement (éq. 3.2/3.3).
  let qOrstom = null, kr10Orstom = 0, c100 = 0;
  {
    const ord = parseInfiltrability(B.Infiltrability);
    const r = computeOrstom({
      zone, areaKm2: B.Area, igMPerKm: ig, panMm: hyp.pan, p10Mm: hyp.p10,
      infiltrabilityOrdinal: ord,
      kr10PctOverride: kr10Override > 0 ? kr10Override : null,
      alpha10: hyp.alpha10 > 0 ? hyp.alpha10 : null,
      p100Mm: hyp.p100 > 0 ? hyp.p100 : null,
      checklist,
    });
    v.orstom = r;
    if (!r.ok) w.push('Orstom : ' + r.reason);
    else {
      if (!(kr10Override > 0)) kr10Orstom = r.kr10Pct;
      if (!Number.isNaN(r.c100)) c100 = r.c100;
      for (const x of r.warnings) w.push('Orstom : ' + x);
      qOrstom = r.q10;
    }
  }
  if (kr10 <= 0 && kr10Orstom > 0) { kr10 = kr10Orstom; kr10Src = 'méthode Orstom (éq. 3.2/3.3)'; }
  v.kr10 = kr10 > 0 ? { value: kr10, source: kr10Src } : null;

  const p = pm10(hyp.p10 > 0 ? hyp.p10 : null, hyp.pan > 0 ? hyp.pan : null, B.Area > 0 ? B.Area : null);
  if (p != null) v.pm10 = { value: p, abattement: abattement(hyp.pan, B.Area) };

  const input = {
    areaKm2: B.Area > 0 ? B.Area : null, igMPerKm: ig > 0 ? ig : null, panMm: hyp.pan > 0 ? hyp.pan : null,
    p10Mm: hyp.p10 > 0 ? hyp.p10 : null, pm10Mm: p, kr10Pct: kr10 > 0 ? kr10 : null,
    ddKmPerKm2: B.DrainageDensity > 0 ? B.DrainageDensity : null,
  };
  v.ciehInput = input;

  const ids = hyp.ciehRegressionIds || [];
  if (ids.length === 0) {
    w.push('CIEH : aucune régression sélectionnée');
    v.recommendation = 'Sélectionnez au moins une régression du tableau 11';
    return;
  }
  const unknown = ids.filter((id) => !ciehById(Number(id)));
  if (unknown.length) w.push(`CIEH : régression(s) inconnue(s) ignorée(s) : ${unknown.join(', ')}`);
  const rows = ids.map(Number).filter((id) => ciehById(id)).map((id) => applyCiehRegression(id, input));
  const ok = rows.filter((r) => r.ok);
  if (Math.abs(checklist.qCiehFactor - 1) > 1e-12) {
    for (const r of ok) r.q10 *= checklist.qCiehFactor;
    w.push(`Check-list : débits CIEH ×${fg(checklist.qCiehFactor, 3)}`);
  }
  v.checklist.summary = summariseChecklist(B.ChecklistChoices, zone);
  v.cieh = { rows, median: null, min: null, max: null, cvPct: null };
  for (const reason of [...new Set(rows.filter((r) => !r.ok).map((r) => r.reason))]) w.push('CIEH : ' + reason);

  if (ok.length === 0 && qOrstom == null) { v.recommendation = 'Aucune méthode FAO 54 calculable'; return; }

  let txt = '';
  if (ok.length > 0) {
    const values = ok.map((r) => r.q10).sort((a, b) => a - b);
    const med = medianSorted(values), cv = cvPct(values);
    Object.assign(v.cieh, { median: med, min: values[0], max: values[values.length - 1], cvPct: cv });
    txt += `CIEH ${values.length} régression(s) : Q10 ∈ [${fx(values[0], 1)} – ${fx(values[values.length - 1], 1)}] m³/s, médiane ${fx(med, 1)} m³/s`;
    if (cv > 50) txt += ` — forte dispersion (CV = ${fx(cv, 0)} %)`;
  }
  if (qOrstom != null) { if (txt) txt += ' · '; txt += `Orstom : ${fx(qOrstom, 1)} m³/s`; }

  // Synthèse sur les deux méthodes du bulletin, qu'il invite à confronter.
  const all = ok.map((r) => r.q10);
  if (qOrstom != null) all.push(qOrstom);
  all.sort((a, b) => a - b);
  const median = medianSorted(all);
  v.stats = { n: all.length, min: all[0], median, max: all[all.length - 1], cvPct: cvPct(all) };
  txt += ' · incertitude ±50 % (bulletin FAO 54)';

  let qDesign = median, designMethod = `médiane FAO 54 (${ok.length} régression(s) CIEH${qOrstom != null ? ' + Orstom' : ''}) — Q10`;
  if (Math.abs(tRet - 100) < 1e-9) {
    if (c100 > 0) {
      qDesign = median * c100;
      v.q100 = { value: qDesign, c100 };
      designMethod = `Q100 = C·Q10 (Gradex, C = ${fx(c100, 2)}) sur la médiane FAO 54`;
      txt += ` · T = 100 ans : Q100 = C·Q10 = ${fx(c100, 2)} × ${fx(median, 1)} = ${fx(qDesign, 1)} m³/s`;
    } else {
      w.push('T = 100 ans demandé mais le coefficient C n\'a pas pu être calculé : il exige Tb10 et Kr10, donc une chaîne Orstom aboutie. Q10 conservé comme débit de projet.');
    }
  }
  for (const x of ciehDomainWarnings(hyp.pan > 0 ? hyp.pan : null, B.Area > 0 ? B.Area : null)) w.push('CIEH : ' + x);
  v.recommendation = txt;
  v.design = { Q: roundNet(qDesign, 2), method: designMethod };
}

/** Classe d'infiltrabilité : sigle (PI, I, RI, P, TP) ou ordinal fractionnaire ; défaut RI (2). */
function parseInfiltrability(value) {
  if (value == null || String(value).trim() === '') return 2;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 2;
  const t = String(value).trim();
  const byName = orstomOrdinal(t);
  if (byName != null) return byName;
  const x = Number(t.replace(',', '.'));
  return Number.isFinite(x) ? x : 2;
}

/**
 * Calcule toutes les grandeurs hydrologiques d'un bassin.
 *
 * @param {object} basin  entrée GIRA (unités explicites) :
 *   areaKm2, perimeterKm, lengthM (plus long chemin hydraulique, m), slope (Ieq, m/m) ou slopePct (%),
 *   dropM (dénivelée du chemin, m ; défaut Hmax − Hmin), hMax, hMin, hMean (altitude MOYENNE, m),
 *   hMedian (m), meanReliefM (Hmoy − Hmin, m ; défaut hMean − hMin), deltaHM (ΔH Ghorbel ; défaut
 *   hMedian − zOutletM|hMin), zOutletM, igMPerKm (Ig), gravelius, lon, lat, returnPeriod (ans),
 *   intensityMmH (i saisi, à défaut d'IDF), vegetationCoverPct (%) ou vegetationIndex (1-3) [Tunisie],
 *   runoffCoeff [FAO 54 seulement], drainageDensity (km/km²), kr10Pct (%), infiltrability (PI…TP ou ordinal),
 *   checklist (choix de l'annexe 1), selectedDischarge (m³/s) / selectedMethod (clé de values.discharges).
 * @param {object} hypotheses  voir defaultHypotheses() (les champs absents prennent la valeur par défaut)
 * @returns {{ methodSet:string, values:object, retained:{Q:number|null, method:string|null}, warnings:string[] }}
 */
export function computeBasin(basin, hypotheses = {}) {
  const hyp = { ...defaultHypotheses(hypotheses.methodSet === 'fao54' ? 'fao54' : 'tunisie'), ...hypotheses };
  hyp.methodSet = hyp.methodSet === 'fao54' ? 'fao54' : 'tunisie';
  for (const k of ['pan', 'p0', 'p10', 'p100', 'idfA', 'idfB', 'alpha10', 'idfMinDurationMinutes']) hyp[k] = num(hyp[k]) || 0;
  const warnings = [];
  const B = normalizeBasin(basin || {}, hyp, warnings);

  // IDF Afrique de l'Ouest (FAO 54) : remplit a, b et la source comme la carte de BVTrace.
  if (hyp.methodSet === 'fao54' && hyp.montanaAfrica && !(hyp.idfA > 0)) {
    const r = montanaAfricaIdf(hyp.montanaAfrica);
    if (r.ok) { hyp.idfA = r.a; hyp.idfB = r.b; hyp.idfTimeUnit = 'min'; hyp.idfSource = r.source; }
    else warnings.push('IDF Montana Afrique : ' + r.reason);
  }

  // Note DGPC 1054 : T calée avant les formules, en Tunisie seulement.
  if (hyp.methodSet === 'tunisie' && hyp.dgpc1054) {
    const forced = num(hyp.dgpcReturnPeriod) || 0;
    B.ReturnPeriod = forced > 0 ? forced : recommendReturnPeriodDgpc(hyp.roadCategory, hyp.structureType, B.Area, num(hyp.tjma) || 0);
  }

  const v = {
    methodSet: hyp.methodSet, returnPeriod: B.ReturnPeriod,
    gravelius: null, tc: null, tcRetained: null,
    intensityMmH: null, intensitySource: null, montana: null, runoffCoeff: null,
    discharges: null, stats: null, recommendation: '',
  };
  if (hyp.methodSet === 'fao54') computeFao54(B, hyp, warnings, v);
  else computeTunisie(B, hyp, warnings, v);
  if (v.tc) v.tcFormula = TC_IDS.includes(String(hyp.tcFormula)) ? String(hyp.tcFormula) : 'Kirpich';

  // Débit retenu : choix explicite de l'utilisateur, sinon médiane (Tunisie) / crue de projet FAO 54.
  let retained = { Q: null, method: null };
  const sel = num(basin?.selectedDischarge);
  if (sel > 0) retained = { Q: sel, method: basin.selectedMethodLabel ?? 'saisi' };
  else if (basin?.selectedMethod && v.discharges && v.discharges[basin.selectedMethod] != null)
    retained = { Q: v.discharges[basin.selectedMethod], method: basin.selectedMethod };
  else if (basin?.selectedMethod && v.discharges)
    warnings.push(`Méthode retenue « ${basin.selectedMethod} » sans débit pour ce bassin — débit par défaut conservé.`);
  if (retained.Q == null) {
    if (hyp.methodSet === 'fao54') { if (v.design) retained = { ...v.design }; }
    else if (v.stats) retained = { Q: v.stats.median, method: `médiane (${v.stats.n} méthode${v.stats.n > 1 ? 's' : ''})` };
  }
  return { methodSet: hyp.methodSet, name: B.Name, values: v, retained, warnings };
}

/**
 * Calcule une campagne de bassins puis cumule les débits amont → aval (BasinDischargeAggregator) :
 * chaque bassin peut porter `uid` et `upstreamUids` ; chaque résultat reçoit `cumulative`
 * { Q, upstream: [noms], error } et `effectiveQ` (débit à retenir pour l'ouvrage).
 */
export function computeAll(basins, hypotheses = {}) {
  const results = (basins || []).map((b) => computeBasin(b, hypotheses));
  const byUid = new Map();
  (basins || []).forEach((b, i) => { if (b?.uid && !byUid.has(b.uid)) byUid.set(b.uid, i); });
  const localQ = (i) => {
    const r = results[i];
    if (r.retained.Q > 0) return r.retained.Q;
    return r.values.stats?.median > 0 ? r.values.stats.median : null;
  };
  (basins || []).forEach((b, i) => {
    const res = results[i];
    res.cumulative = { Q: null, upstream: [], error: '' };
    const closure = new Set(), visiting = new Set();
    let cycle = false;
    const visit = (uid) => {
      if (cycle || closure.has(uid)) return;
      if (visiting.has(uid)) { cycle = true; return; }
      visiting.add(uid);
      const j = byUid.get(uid);
      if (j !== undefined) for (const p of basins[j].upstreamUids || []) visit(p);
      visiting.delete(uid);
      closure.add(uid);
    };
    for (const uid of b?.upstreamUids || []) visit(uid);
    closure.delete(b?.uid);
    const up = [...closure].filter((u) => byUid.has(u)).map((u) => byUid.get(u));
    res.cumulative.upstream = up.map((j) => results[j].name);
    if (cycle) res.cumulative.error = 'Boucle détectée dans les relations entre bassins amont.';
    else {
      const all = [i, ...up];
      const missing = all.filter((j) => !(localQ(j) > 0)).map((j) => results[j].name);
      if (missing.length) res.cumulative.error = 'Q de projet manquant pour : ' + missing.join(', ') + '.';
      else res.cumulative.Q = roundNet(all.reduce((s, j) => s + localQ(j), 0), 2);
    }
  });
  results.forEach((r, i) => {
    const hasUp = (basins[i]?.upstreamUids || []).length > 0;
    r.effectiveQ = hasUp ? (r.cumulative.Q > 0 ? r.cumulative.Q : null) : (r.cumulative.Q > 0 ? r.cumulative.Q : localQ(i));
  });
  return results;
}

/** Accès bas niveau pour les tests et l'interface (lecture seule). */
export const _internals = Object.freeze({ roundNet, f2, fg, g6, normalizeBasin, resolveIdfMinimumMinutes, parseInfiltrability });
