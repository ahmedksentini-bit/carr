// culvert.js — hydraulique des ouvrages de franchissement (buses circulaires et dalots rectangulaires),
// portage JavaScript (modules ES, sans dépendance, navigateur et Node ≥ 22) du moteur de BVTrace :
//   BVTrace.Core/CulvertCalculator.cs  chaîne HDS-5 complète (entrée, sortie, remous, surverse) ;
//   BVTrace.Core/CulvertSection.cs     géométrie A(y), P(y), T(y), yc, yn, pente de frottement ;
//   BVTrace.Core/Tailwater.cs          condition aval (PHE connue / chenal aval / sortie libre) ;
//   BVTrace.Core/CulvertSizing.cs      recherche de N × B × H (dalots) ou N × Ø (buses) ;
//   BVTrace.Core/BceomCharts.cs        contre-épreuve BCEOM (abaques 71 à 84) — jamais gouvernante ;
//   BVTrace.Core/HydraulicDefaults.cs, RoadElevation.cs (revanche), CulvertClearance.cs (cote mini de rasante).
//
// Méthode : FHWA HDS-5 (3ᵉ éd., §3.1 à 3.5 et annexe A). Une seule chaîne pour les deux formes :
//   géométrie → Manning-Strickler → profondeur critique → contrôle à l'entrée → contrôle à la sortie
//   → HW = max(HWi, HWo) → cote amont → revanche → surverse.
// Manning-Strickler ne fixe pas le niveau amont : il donne capacité, yn, V, remplissage, pente de frottement.
//
// Unités SI partout : m, m², m³/s, m/s ; pentes en m/m sauf mention « Pct » (%).
// Trois « K » à ne pas confondre : StricklerK (rugosité), Ke (perte d'entrée du contrôle à la sortie),
// exitLossCoefficient (perte de sortie, 1 par défaut) — plus KSlope, correction de pente du contrôle à l'entrée.
//
// Les textes (avertissements, statuts) reprennent mot pour mot ceux de BVTrace, nombres au point décimal.

import {
  CULVERT_INLETS, DEFAULT_INLET, PIPE_DIAMETERS, BOX_SIZING_RANGES, FREE_SLOPES_PCT,
  HYDRAULIC_DEFAULTS, ENGINE_DEFAULTS, SHAPES,
} from './data/culvert-catalog.js';
import { BCEOM_ABAQUES } from './data/bceom_abaques_71_84.js';

export {
  CULVERT_INLETS, DEFAULT_INLET, PIPE_DIAMETERS, BOX_SIZING_RANGES, FREE_SLOPES_PCT,
  HYDRAULIC_DEFAULTS, ENGINE_DEFAULTS, SHAPES, BCEOM_ABAQUES,
};

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Constantes du moteur (CulvertCalculator)
// ═══════════════════════════════════════════════════════════════════════════════════════════

export const G = 9.81;
/** Bornes de la zone de transition HDS-5 sur l'intensité adimensionnelle X. */
export const X_UNSUBMERGED = 1.93;
export const X_SUBMERGED = 2.21;
/** Tolérance de classement des profondeurs (m) : 0,1 mm. */
export const DEPTH_TOLERANCE = 1e-4;
/** Rapport HW/D admissible du dimensionnement (CulvertSizing.MaxHeadwaterRatio). */
export const MAX_HEADWATER_RATIO = 1.2;
/** Pas de profondeur du calcul de remous (m). */
const STEP_MIN = 0.003, STEP_MAX = 0.015;

// ─── utilitaires numériques (sémantique .NET conservée) ────────────────────────────────────

/** Math.Clamp de .NET : NaN traverse. */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Math.Round de .NET : arrondi au pair (banker's rounding). */
function roundEven(x, digits = 0) {
  const p = Math.pow(10, digits);
  const y = x * p;
  const fl = Math.floor(y);
  const diff = y - fl;
  let r;
  if (diff > 0.5) r = fl + 1;
  else if (diff < 0.5) r = fl;
  else r = fl % 2 === 0 ? fl : fl + 1;
  return r / p;
}

/** Format « F<n> » invariant de .NET. */
function F(x, n) {
  if (Number.isNaN(x)) return 'NaN';
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '-∞';
  return x.toFixed(n);
}

/** Format « 0.# » de .NET (au plus une décimale, sans zéro inutile). */
function F01(x) {
  const r = Math.sign(x) * Math.round(Math.abs(x) * 10) / 10;
  return String(r);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Sections (CulvertSection.cs) — toutes les grandeurs par alvéole
// ═══════════════════════════════════════════════════════════════════════════════════════════

function withCommon(sec) {
  sec.fullHydraulicRadius = sec.fullPerimeter > 0 ? sec.fullArea / sec.fullPerimeter : 0;
  sec.hydraulicRadius = (y) => {
    const p = sec.wettedPerimeter(y);
    return p > 0 ? sec.area(y) / p : 0;
  };
  /** Débit uniforme q(y) = K·A·Rh^(2/3)·√J (m³/s). */
  sec.conveyance = (y, k, slope) =>
    k * sec.area(y) * Math.pow(sec.hydraulicRadius(y), 2.0 / 3.0) * Math.sqrt(slope);
  /** Pente de frottement à surface libre Sf = [q/(K·A·Rh^(2/3))]². */
  sec.frictionSlope = (y, q, k) => {
    const a = sec.area(y);
    if (a <= 0) return Infinity;
    return Math.pow(q / (k * a * Math.pow(sec.hydraulicRadius(y), 2.0 / 3.0)), 2);
  };
  /**
   * Pente de frottement en section pleine, ouvrage EN CHARGE (périmètre complet 2(B+D) pour un dalot).
   * Ne jamais prolonger la formule à surface libre jusqu'à y = D pour un écoulement en charge.
   */
  sec.fullFrictionSlope = (q, k) =>
    Math.pow(q / (k * sec.fullArea * Math.pow(sec.fullHydraulicRadius, 2.0 / 3.0)), 2);
  /** Profondeur de débitance maximale : balayage (400 pas) ; une section rectangulaire rend D. */
  sec.depthOfMaxConveyance = (k, slope) => {
    const n = 400;
    let best = sec.rise, bestQ = sec.conveyance(sec.rise, k, slope);
    for (let i = 1; i <= n; i++) {
      const y = sec.rise * i / n;
      const qq = sec.conveyance(y, k, slope);
      if (qq > bestQ) { bestQ = qq; best = y; }
    }
    return best;
  };
  /** Tirant normal par dichotomie, borné à la profondeur de débitance maximale (branche stable). */
  sec.normalDepth = (q, k, slope) => {
    if (slope <= 0) return sec.rise;
    const peak = sec.depthOfMaxConveyance(k, slope);
    if (sec.conveyance(peak, k, slope) < q) return sec.rise;
    let lo = 1e-9, hi = peak;
    for (let i = 0; i < 200; i++) {
      const mid = 0.5 * (lo + hi);
      if (sec.conveyance(mid, k, slope) < q) lo = mid; else hi = mid;
      if (hi - lo < 1e-12) break;
    }
    return 0.5 * (lo + hi);
  };
  return sec;
}

/** Dalot rectangulaire B × D : A = B·y, P = B + 2y, T = B ; yc = (q²/(g·B²))^(1/3). */
export function rectangularSection(width, height) {
  const b = width, d = height;
  const cl = (y) => (y < 0 ? 0 : y > d ? d : y);
  return withCommon({
    shape: 'box', rise: d, width: b,
    fullArea: b * d,
    fullPerimeter: 2 * (b + d),
    area: (y) => b * cl(y),
    wettedPerimeter: (y) => b + 2 * cl(y),
    topWidth: () => b,
    criticalDepth: (q) => Math.pow(q * q / (G * b * b), 1.0 / 3.0),
    describe: 'rectangulaire',
  });
}

/**
 * Buse circulaire de diamètre D. θ = 2·arccos(1 − 2y/D) : A = D²/8·(θ − sin θ), P = D·θ/2, T = D·sin(θ/2).
 * Section pleine : A = πD²/4, Rh = D/4. yc par dichotomie sur q²·T/(g·A³) − 1 (toujours < D).
 */
export function circularSection(diameter) {
  const d = diameter;
  const theta = (y) => (y <= 0 ? 0 : y >= d ? 2 * Math.PI : 2 * Math.acos(1 - 2 * y / d));
  const area = (y) => { const th = theta(y); return d * d / 8.0 * (th - Math.sin(th)); };
  const topWidth = (y) => d * Math.sin(theta(y) / 2.0);
  return withCommon({
    shape: 'circular', rise: d, width: d, diameter: d,
    fullArea: Math.PI * d * d / 4.0,
    fullPerimeter: Math.PI * d,
    area,
    wettedPerimeter: (y) => d * theta(y) / 2.0,
    topWidth,
    criticalDepth: (q) => {
      if (q <= 0) return 0;
      const Fc = (y) => {
        const a = area(y);
        if (a <= 0) return Infinity;
        return q * q * topWidth(y) / (G * a * a * a) - 1;
      };
      let lo = 1e-9, hi = d;
      if (Fc(lo) < 0) return lo;
      for (let i = 0; i < 200; i++) {
        const mid = 0.5 * (lo + hi);
        if (Fc(mid) > 0) lo = mid; else hi = mid;
        if (hi - lo < 1e-13) break;
      }
      return 0.5 * (lo + hi);
    },
    describe: 'circulaire',
  });
}

/** Section adaptée à la forme (CulvertSection.Create). */
export function makeSection(shape, width, rise) {
  return shape === 'circular' ? circularSection(rise) : rectangularSection(width, rise);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Catalogue des entrées (CulvertInletCatalog.cs)
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** Configuration exacte par clé entière (1…6, 101…302) ou par identifiant, ou null. Aucun repli. */
export function findInlet(keyOrId) {
  if (keyOrId == null) return null;
  if (typeof keyOrId === 'object' && keyOrId.key != null) keyOrId = keyOrId.key;
  const n = Number(keyOrId);
  if (Number.isInteger(n)) return CULVERT_INLETS.find((c) => c.key === n) || null;
  const s = String(keyOrId).toLowerCase();
  return CULVERT_INLETS.find((c) => c.id.toLowerCase() === s) || null;
}

/** CulvertInletCatalog.Get : repli sur la première configuration (usage interne, après contrôle). */
function inletGet(key) { return findInlet(key) || CULVERT_INLETS[0]; }

/** Configurations applicables à une forme ('box' | 'circular'). */
export function inletsForShape(shape) {
  const s = normalizeShape(shape);
  return CULVERT_INLETS.filter((c) => c.shape === s);
}

/** Entrée par défaut d'une forme : dalot = ailes à 45° (4) ; buse = béton, mur de tête, arête vive (101). */
export function defaultInletFor(shape) { return DEFAULT_INLET[normalizeShape(shape)]; }

/** « abaque n, échelle x ». */
export function chartLabel(c) {
  return `abaque ${c.chart}, échelle ${c.scaleLabel && c.scaleLabel.length > 0 ? c.scaleLabel : String(c.scale)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Chenal aval (Tailwater.cs, DownstreamChannel)
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Lit récepteur trapézoïdal : A = (b + z·y)·y, P = b + 2y·√(1+z²), q = K·A·Rh^(2/3)·√i.
 * @param {{bedWidth?:number, sideSlope?:number, slope:number, StricklerK?:number}} c
 *   bedWidth b (m, défaut 0 = triangulaire), sideSlope z (H/V, défaut 1,5), slope i (m/m), StricklerK (défaut 30).
 */
export function downstreamChannel(c = {}) {
  const ch = {
    bedWidth: c.bedWidth ?? ENGINE_DEFAULTS.channel.bedWidth,
    sideSlope: c.sideSlope ?? c.sideSlopeZ ?? ENGINE_DEFAULTS.channel.sideSlope,
    slope: c.slope ?? 0,
    StricklerK: c.StricklerK ?? ENGINE_DEFAULTS.channel.StricklerK,
  };
  ch.area = (y) => (ch.bedWidth + ch.sideSlope * y) * y;
  ch.wettedPerimeter = (y) => ch.bedWidth + 2 * y * Math.sqrt(1 + ch.sideSlope * ch.sideSlope);
  ch.hydraulicRadius = (y) => { const p = ch.wettedPerimeter(y); return p > 0 ? ch.area(y) / p : 0; };
  ch.conveyance = (y) => (y <= 0 || ch.slope <= 0
    ? 0
    : ch.StricklerK * ch.area(y) * Math.pow(ch.hydraulicRadius(y), 2.0 / 3.0) * Math.sqrt(ch.slope));
  ch.usable = () => {
    if (ch.bedWidth <= 0 && ch.sideSlope <= 0)
      return 'chenal aval sans section : renseigner la largeur en plafond b ou le fruit z';
    if (ch.slope <= 0) return 'pente du chenal aval nulle ou négative : la hauteur normale n\'existe pas';
    if (ch.StricklerK <= 0) return 'coefficient de Strickler du chenal aval invalide';
    return '';
  };
  ch.normalDepth = (q) => {
    if (q <= 0 || ch.usable() !== '') return 0;
    let hi = 0.5;
    for (let i = 0; i < 60 && ch.conveyance(hi) < q; i++) hi *= 2;
    if (ch.conveyance(hi) < q) return hi;
    let lo = 0;
    for (let i = 0; i < 200; i++) {
      const mid = 0.5 * (lo + hi);
      if (ch.conveyance(mid) < q) lo = mid; else hi = mid;
      if (hi - lo < 1e-10) break;
    }
    return 0.5 * (lo + hi);
  };
  ch.describe = () => `b = ${F(ch.bedWidth, 2)} m, fruit ${F(ch.sideSlope, 1)}/1, ` +
    `i = ${F(ch.slope * 100, 2)} %, K = ${F(ch.StricklerK, 0)}`;
  return ch;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Revanche (RoadElevation.cs)
// ═══════════════════════════════════════════════════════════════════════════════════════════

export const FREEBOARD_LABELS = Object.freeze({
  conforme: 'conforme', insuffisante: 'insuffisante', surverse: 'surverse de la route', nonVerifiable: 'non vérifiable',
});
export const MISSING_ROAD_ELEV_MESSAGE =
  'Vérification provisoire : cote du point bas de la chaussée non renseignée, ' +
  'revanche et surverse non vérifiables.';

/** Revanche = Z chaussée point bas − Z PHE amont : ≥ min → conforme · [0, min[ → insuffisante · < 0 → surverse. */
export function freeboardCompliance(freeboard, minFreeboard) {
  if (Number.isNaN(freeboard)) return FREEBOARD_LABELS.nonVerifiable;
  if (freeboard < -DEPTH_TOLERANCE) return FREEBOARD_LABELS.surverse;
  if (freeboard + DEPTH_TOLERANCE < minFreeboard) return FREEBOARD_LABELS.insuffisante;
  return FREEBOARD_LABELS.conforme;
}
const freeboardIsOk = (fb, min) => !Number.isNaN(fb) && fb + DEPTH_TOLERANCE >= min;

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Libellés (CulvertCalculator)
// ═══════════════════════════════════════════════════════════════════════════════════════════

export const controlLabel = (c) => (c === 'inlet' ? "Contrôle à l'entrée" : 'Contrôle par l\'aval (sortie)');

export const controlExplanation = (c) => (c === 'inlet'
  ? "Contrôle à l'entrée : le niveau amont est principalement imposé par la géométrie " +
    "et les pertes de la tête d'entrée."
  : "Contrôle par l'aval : le niveau amont dépend du niveau d'eau aval, des pertes dans " +
    "l'ouvrage et des conditions d'écoulement à la sortie.");

/** État de la sortie, complété de l'influence effective de l'aval quand on passe le résultat. */
export function outletConditionLabel(rOrCondition) {
  if (typeof rOrCondition === 'string') {
    return rOrCondition === 'submerged' ? 'sortie noyée'
      : rOrCondition === 'partial' ? 'sortie partiellement noyée' : 'sortie libre';
  }
  const r = rOrCondition;
  if (r.outletCondition === 'submerged') return 'sortie noyée';
  if (r.outletCondition === 'partial') {
    return r.tailwaterInfluences
      ? 'sortie partiellement noyée, avec influence aval'
      : 'sortie partiellement noyée, sans influence (TW ≤ yc)';
  }
  return 'sortie libre (TW ≈ 0)';
}

export function freeboardLabel(fb) {
  if (Number.isNaN(fb)) return 'cote de route inconnue';
  if (fb > DEPTH_TOLERANCE) return 'marge disponible';
  return fb < -DEPTH_TOLERANCE ? 'chaussée submergée' : "niveau d'eau à la chaussée";
}

export function tailwaterModeLabel(m) {
  switch (m) {
    case 'known': return 'PHE connue';
    case 'channel': return 'calcul par le chenal aval';
    case 'free': return 'sortie libre supposée';
    default: return 'mode aval non défini';
  }
}

export function inletRegimeLabel(r) {
  return r === 'submerged' ? 'entrée noyée' : r === 'transition' ? 'transition' : 'entrée dénoyée';
}

export function methodLabel(m) {
  switch (m) {
    case 'fullFlowEnergy': return 'énergie pleine section';
    case 'directStep': return 'pas directs';
    case 'inletGoverningFreeTorrential': return "contrôle à l'entrée — sortie libre torrentielle";
    default: return 'approximation FHWA';
  }
}

/** Résumé d'une ligne. */
export function summary(r) {
  return `${controlLabel(r.control)} · HW = ${F(r.headwater, 3)} m · Z eau amont = ${F(r.upstreamWaterElev, 3)} m`;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Moteur HDS-5 (CulvertCalculator.Calculate) — entrée « interne » calquée sur CulvertInput
// ═══════════════════════════════════════════════════════════════════════════════════════════

function emptyResult() {
  return {
    valid: false, warnings: [],
    shape: 'box', cells: 0, cellWidth: 0, cellHeight: 0, length: 0, slope: 0,
    Ke: 0, exitLossCoefficient: 0,
    // écoulement uniforme
    dischargePerCell: 0, normalDepth: 0, capacityExceeded: false, fillRatioPct: 0,
    uniformVelocity: 0, froude: 0, fullCapacity: 0, criticalDepth: 0, criticalEnergy: 0,
    criticalSlopePct: 0, slopeAboveCritical: false, maxVelocity: 0, velocityOk: true,
    // contrôle à l'entrée
    inlet: null, hds5Applied: false, hds5Status: '', inletX: 0, inletRegime: 'unsubmerged',
    inletRatio: 0, inletRatioUnsubmerged: 0, inletRatioSubmerged: 0, hwInlet: 0, inletWaterElev: 0,
    // contrôle à la sortie
    downstreamInvert: 0, tailwaterMode: 'none', downstreamWaterElev: 0, tailwaterSource: '',
    tailwaterDepth: 0, outletCondition: 'free', tailwaterInfluences: false, fullVelocity: 0,
    entranceLoss: 0, frictionLoss: 0, exitLoss: 0, totalLoss: 0, outletMethod: 'fullFlowEnergy',
    outletMethodNote: '', hwOutlet: 0, outletWaterElev: 0, profileEntranceDepth: 0, profileOutletDepth: 0,
    // résultat gouvernant
    control: 'inlet', headwater: 0, upstreamWaterElev: 0, freeboard: NaN, minFreeboard: 0, freeboardOk: true,
    culvertDischarge: 0, roadDischarge: 0, roadOverflowDepth: 0, balanceError: 0, roadOvertopped: false,
    // contre-épreuve BCEOM
    bceom: null, bceomNote: '',
  };
}

function tailwaterUsable(input) {
  switch (input.tailwaterMode) {
    case 'known':
      if (!Number.isFinite(input.downstreamWaterElev))
        return 'Mode aval « PHE connue » : la cote du plan d\'eau aval n\'est pas renseignée.';
      return '';
    case 'channel': {
      if (!input.downstreamChannel)
        return 'Mode aval « calcul par le chenal aval » : le lit récepteur n\'est pas décrit.';
      const why = input.downstreamChannel.usable();
      if (why) return 'Mode aval « calcul par le chenal aval » : ' + why + '.';
      return '';
    }
    case 'free':
      return '';
    default:
      return 'Mode aval non défini : choisir « PHE connue », ' +
        '« calcul par le chenal aval » ou « sortie libre supposée ».';
  }
}

function resolveTailwater(input, zInvOut, culvertQ) {
  switch (input.tailwaterMode) {
    case 'known':
      return { elev: input.downstreamWaterElev, source: `PHE connue (${F(input.downstreamWaterElev, 2)} m)` };
    case 'channel': {
      const ch = input.downstreamChannel;
      const yn = ch.normalDepth(culvertQ);
      return {
        elev: zInvOut + yn,
        source: `chenal aval : hauteur normale ${F(yn, 3)} m pour ${F(culvertQ, 2)} m³/s (${ch.describe()})`,
      };
    }
    default:
      return { elev: zInvOut, source: 'sortie libre supposée (plan d\'eau aval au radier de sortie)' };
  }
}

/** Calcul complet (CulvertCalculator.Calculate) sur une entrée normalisée. */
function calculate(input) {
  const r = emptyResult();
  const cells = Math.max(1, input.cells);
  const circular = input.shape === 'circular';
  if (!(input.totalDischarge > 0) || !(input.height > 0) || (!circular && !(input.width > 0))
      || !(input.length > 0) || !(input.StricklerK > 0)) {
    r.warnings.push(circular ? 'Données incomplètes (Q, D, L, K).' : 'Données incomplètes (Q, B, D, L, K).');
    return r;
  }

  // La configuration d'entrée doit correspondre à la forme réelle.
  const chosen = findInlet(input.inlet);
  if (chosen == null || chosen.shape !== input.shape) {
    r.shape = input.shape;
    r.hds5Status = circular
      ? "Configuration d'entrée non applicable à une buse : choisir une entrée " +
        'des abaques 1 (béton), 2 (métal ondulé) ou 3 (bague biseautée).'
      : "Configuration d'entrée non applicable à un dalot : choisir une tête " +
        'des abaques 8 à 10.';
    r.warnings.push(r.hds5Status);
    return r;
  }

  // Mode aval obligatoire.
  const refusal = tailwaterUsable(input);
  if (refusal) {
    r.shape = input.shape;
    r.tailwaterMode = input.tailwaterMode;
    r.hds5Status = refusal;
    r.warnings.push(refusal);
    return r;
  }

  // Partage avec la route : tout le fonctionnement est recalculé à chaque débit essayé.
  let qCulvert = input.totalDischarge;
  let qRoad = 0;
  let overflowSolved = false;
  if (input.allowRoadOverflow && input.roadCrestLength > 0 && !Number.isNaN(input.roadElev)) {
    const full = evaluate(input, input.totalDischarge, cells);
    const headAtFull = full.upstreamWaterElev - input.roadElev;
    if (headAtFull > 0) {
      const s = solveSplit(input, cells);
      qCulvert = s.q; qRoad = s.qRoad;
      overflowSolved = true;
    }
  }

  const res = evaluate(input, qCulvert, cells);
  res.culvertDischarge = qCulvert;
  res.roadDischarge = qRoad;
  res.roadOverflowDepth = Math.max(0, res.upstreamWaterElev - input.roadElev);
  res.roadOvertopped = res.roadOverflowDepth > 0;
  res.balanceError = Math.abs(qCulvert + qRoad - input.totalDischarge);
  if (res.roadOvertopped && !overflowSolved) {
    res.warnings.push(input.allowRoadOverflow
      ? 'Surverse détectée mais crête de route non renseignée : débit non partagé.'
      : 'Cote d\'eau amont au-dessus de la route : surverse non calculée (option désactivée).');
  }
  return res;
}

/** Dichotomie Q ouvrage + Q route = Q total, le déversé recalculé depuis le niveau amont de l'ouvrage. */
function solveSplit(input, cells) {
  const residual = (qc) => qc + roadDischarge(input, evaluate(input, qc, cells).upstreamWaterElev) - input.totalDischarge;
  let lo = 0, hi = input.totalDischarge;
  for (let i = 0; i < 200; i++) {
    const mid = 0.5 * (lo + hi);
    if (residual(mid) > 0) hi = mid; else lo = mid;
    if (hi - lo < 1e-13) break;
  }
  const q = 0.5 * (lo + hi);
  return { q, qRoad: roadDischarge(input, evaluate(input, q, cells).upstreamWaterElev) };
}

/** Déversoir épais sur la chaussée : Q = Cd·kt·Lr·Hr^1,5. */
function roadDischarge(input, upstreamWaterElev) {
  if (!input.allowRoadOverflow || input.roadCrestLength <= 0 || Number.isNaN(input.roadElev)) return 0;
  const hr = upstreamWaterElev - input.roadElev;
  if (hr <= 0) return 0;
  return input.weirCoefficient * input.submergenceFactor * input.roadCrestLength * Math.pow(hr, 1.5);
}

/** Calcul complet pour un débit donné dans l'ouvrage (CulvertCalculator.Evaluate). */
function evaluate(input, totalQ, cells) {
  const r = emptyResult();
  r.valid = true;
  const sec = makeSection(input.shape, input.width, input.height);
  const d = sec.rise, len = input.length;
  const s0 = input.slope, k = input.StricklerK;
  const q = totalQ / cells;

  const coef = inletGet(input.inlet);
  const ke = input.Ke ?? coef.Ke;
  const kOut = input.exitLossCoefficient;

  const af = sec.fullArea;
  const rhFull = sec.fullHydraulicRadius;

  r.dischargePerCell = q;
  r.inlet = coef;
  r.shape = sec.shape;
  r.hds5Applied = true;
  r.hds5Status = 'Contrôle HDS-5 appliqué — ' + chartLabel(coef);
  r.minFreeboard = input.minFreeboard;
  r.cells = cells;
  r.cellWidth = sec.shape === 'box' ? sec.width : d;
  r.cellHeight = d;
  r.length = len;
  r.slope = s0;
  r.Ke = ke;
  r.exitLossCoefficient = kOut;

  // ── 3. Écoulement uniforme ─────────────────────────────────────────────────────────────
  const qFull = s0 > 0 ? k * af * Math.pow(rhFull, 2.0 / 3.0) * Math.sqrt(s0) : 0;
  r.fullCapacity = qFull * cells;
  let yn;
  if (s0 <= 0) {
    yn = d; r.capacityExceeded = true;
    r.warnings.push('Pente nulle ou négative : pas de régime uniforme, seul le contrôle à la sortie a un sens.');
  } else if (qFull < q) {
    yn = d; r.capacityExceeded = true;
    r.warnings.push(`Capacité uniforme dépassée (${F(qFull * cells, 2)} m³/s < ${F(totalQ, 2)} m³/s) : ouvrage en charge.`);
  } else {
    yn = sec.normalDepth(q, k, s0);
  }
  r.normalDepth = yn;
  r.fillRatioPct = yn / d * 100;
  r.uniformVelocity = q / sec.area(yn);
  // Froude sur la profondeur hydraulique A/T (nul à la clé d'une buse : écoulement en charge).
  const tn = sec.topWidth(yn);
  r.froude = tn > 1e-9 ? r.uniformVelocity / Math.sqrt(G * sec.area(yn) / tn) : 0;

  // ── 4. Profondeur critique ─────────────────────────────────────────────────────────────
  const yc = sec.criticalDepth(q);
  const ycEff = Math.min(yc, d);
  const vc = q / sec.area(ycEff);
  r.criticalDepth = yc;
  r.criticalEnergy = ycEff + vc * vc / (2 * G);
  r.criticalSlopePct = (ycEff > 0 ? sec.frictionSlope(ycEff, q, k) : 0) * 100;

  // ── 5. Contrôle à l'entrée (HDS-5) : X = 1,811·q/(Af·√D) ──────────────────────────────
  const x = 1.811 * q / (af * Math.sqrt(d));
  r.inletX = x;
  const unsub = coef.form === 1
    ? r.criticalEnergy / d + coef.K * Math.pow(x, coef.M) + coef.KSlope * s0
    : coef.K * Math.pow(x, coef.M);
  const sub = coef.C * x * x + coef.Y + coef.KSlope * s0;
  r.inletRatioUnsubmerged = unsub;
  r.inletRatioSubmerged = sub;
  if (x <= X_UNSUBMERGED) { r.inletRatio = unsub; r.inletRegime = 'unsubmerged'; }
  else if (x >= X_SUBMERGED) { r.inletRatio = sub; r.inletRegime = 'submerged'; }
  else {
    const lambda = (x - X_UNSUBMERGED) / (X_SUBMERGED - X_UNSUBMERGED);
    r.inletRatio = (1 - lambda) * unsub + lambda * sub;
    r.inletRegime = 'transition';
  }
  r.hwInlet = d * r.inletRatio;
  r.inletWaterElev = input.upstreamInvert + r.hwInlet;

  // ── 7. Radier aval, profondeur aval, état de la sortie (déduit, jamais saisi) ────────────
  const zInvOut = input.upstreamInvert - s0 * len;
  const tws = resolveTailwater(input, zInvOut, totalQ);
  const tw = Math.max(0, tws.elev - zInvOut);
  r.downstreamInvert = zInvOut;
  r.tailwaterMode = input.tailwaterMode;
  r.downstreamWaterElev = zInvOut + tw;
  r.tailwaterSource = tws.source;
  r.tailwaterDepth = tw;
  r.outletCondition = tw >= d - DEPTH_TOLERANCE ? 'submerged' : tw > DEPTH_TOLERANCE ? 'partial' : 'free';
  r.tailwaterInfluences = tw > ycEff;
  r.profileOutletDepth = r.outletCondition === 'submerged'
    ? d
    : tw <= ycEff ? ycEff : clamp(outletDepth(q, sec, tw, ycEff, kOut), 0, d);

  // ── 8. Pertes de charge en pleine section ──────────────────────────────────────────────
  const vf = q / af;
  const hv = vf * vf / (2 * G);
  const sfFull = sec.fullFrictionSlope(q, k);
  r.fullVelocity = vf;
  r.entranceLoss = ke * hv;
  r.frictionLoss = sfFull * len;
  r.exitLoss = kOut * hv;
  r.totalLoss = r.entranceLoss + r.frictionLoss + r.exitLoss;

  if (r.outletCondition === 'submerged') {
    r.profileEntranceDepth = d;
    r.hwOutlet = tw + r.totalLoss - s0 * len;
    r.outletMethod = 'fullFlowEnergy';
    r.outletMethodNote = "Équation d'énergie en pleine section (sortie noyée).";
  } else {
    // ── 9. Sortie non noyée : remous par pas directs, repli FHWA ─────────────────────────
    const h0 = Math.max(tw, (ycEff + d) / 2.0);
    const approx = Math.max(0, h0 + r.totalLoss - s0 * len);
    const step = directStep(q, sec, len, s0, k, tw, ycEff, yn, r.capacityExceeded, kOut);
    if (step.converged) {
      r.hwOutlet = step.energy + ke * step.velocity * step.velocity / (2 * G);
      r.profileEntranceDepth = step.depth;
      r.outletMethod = 'directStep';
      r.outletMethodNote = 'Profil de remous par pas directs' +
        (step.fullFlowLength > 0 ? `, raccord en pleine section sur ${F(step.fullFlowLength, 1)} m.` : '.');
    } else {
      r.hwOutlet = approx;
      r.outletMethod = 'fhwaApproximation';
      r.outletMethodNote = 'Niveau amont sous contrôle à la sortie calculé par méthode approchée.';
      r.warnings.push('Niveau amont sous contrôle à la sortie calculé par méthode approchée.');
      if (approx < 0.75 * d)
        r.warnings.push(`Approximation FHWA hors domaine (HWo = ${F(approx, 3)} m < 0,75 D) : ` +
          'valeur indicative, à confronter à un calcul de remous.');
    }
  }
  r.outletWaterElev = input.upstreamInvert + r.hwOutlet;

  const slopePct = s0 * 100;
  r.slopeAboveCritical = slopePct >= r.criticalSlopePct;

  // ── 10. Niveau amont gouvernant ─────────────────────────────────────────────────────────
  const fhwaOutOfDomain = r.outletMethod === 'fhwaApproximation' && r.hwOutlet < 0.75 * d - DEPTH_TOLERANCE;
  const freeTorrential = r.outletCondition === 'free' && tw <= DEPTH_TOLERANCE
    && r.slopeAboveCritical && !r.capacityExceeded;
  const discardOodOutlet = fhwaOutOfDomain && freeTorrential && !input.allowRoadOverflow;
  if (discardOodOutlet) {
    r.outletMethod = 'inletGoverningFreeTorrential';
    r.outletMethodNote =
      'HWo indicatif non utilisé pour le dimensionnement ' +
      `(approximation FHWA hors domaine, HWo = ${F(r.hwOutlet, 3)} m < 0,75 D). ` +
      "Contrôle à l'entrée — sortie libre torrentielle.";
    r.warnings.push(
      'HWo approximatif indicatif non retenu pour le dimensionnement ' +
      '(hors domaine HWo < 0,75 D, sortie libre torrentielle) — HWdesign = HWi.');
    r.control = 'inlet';
    r.headwater = r.hwInlet;
  } else {
    r.control = r.hwInlet >= r.hwOutlet ? 'inlet' : 'outlet';
    r.headwater = Math.max(r.hwInlet, r.hwOutlet);
  }
  r.upstreamWaterElev = input.upstreamInvert + r.headwater;

  // ── 11. Revanche = Z chaussée point bas − Z PHE amont ──────────────────────────────────
  if (!Number.isNaN(input.roadElev)) {
    r.freeboard = input.roadElev - r.upstreamWaterElev;
    r.freeboardOk = freeboardIsOk(r.freeboard, input.minFreeboard);
    if (!r.freeboardOk) {
      const cls = freeboardCompliance(r.freeboard, input.minFreeboard);
      r.warnings.push(r.freeboard < 0
        ? `Revanche négative (${F(r.freeboard, 2)} m) : ${cls}.`
        : `Revanche ${F(r.freeboard, 2)} m < ${F(input.minFreeboard, 2)} m exigés (${cls}).`);
    }
  } else {
    r.warnings.push(MISSING_ROAD_ELEV_MESSAGE);
  }

  // ── Contrôles de dimensionnement ────────────────────────────────────────────────────────
  if (r.fillRatioPct > input.maxFillRatioPct)
    r.warnings.push(`Taux de remplissage ${F(r.fillRatioPct, 0)} % > ${F(input.maxFillRatioPct, 0)} %.`);
  r.maxVelocity = input.maxVelocity;
  r.velocityOk = r.uniformVelocity <= input.maxVelocity;
  if (!r.velocityOk)
    r.warnings.push(`V = ${F(r.uniformVelocity, 2)} m/s > ${F(input.maxVelocity, 2)} m/s admis : ` +
      "risque d'érosion, prévoir une protection de l'exutoire.");
  if (r.headwater > 1.2 * d)
    r.warnings.push(`HW/D = ${F(r.headwater / d, 2)} > 1,2 : mise en charge marquée à l'amont.`);

  if (r.outletCondition !== 'submerged' && !r.capacityExceeded && s0 > 0 && !r.slopeAboveCritical)
    r.warnings.push(`Pente de l'ouvrage ${F(slopePct, 3)} % < pente critique ${F(r.criticalSlopePct, 3)} % : ` +
      "un régime non torrentiel ou un ressaut hydraulique peut apparaître dans l'ouvrage.");

  if (r.outletMethod === 'directStep' && input.tailwaterMode === 'free'
      && !r.slopeAboveCritical && r.outletCondition !== 'submerged') {
    r.warnings.push('Résultat provisoire : régime fluvial influençable par l\'aval. ' +
      'Une PHE aval réelle ou un profil du chenal récepteur est recommandé.');
  }

  const freeAssumed = input.tailwaterMode === 'free';
  const roadMissing = Number.isNaN(input.roadElev);
  if (freeAssumed && roadMissing)
    r.warnings.push('Vérification hydraulique provisoire : ' +
      'condition aval supposée et cote de chaussée non renseignée.');
  else if (freeAssumed)
    r.warnings.push('Vérification hydraulique provisoire : condition aval supposée.');
  else if (roadMissing)
    r.warnings.push('Vérification hydraulique provisoire : cote de chaussée non renseignée.');

  // ── Contre-épreuve BCEOM (abaques 71 à 78) — n'intervient jamais dans HW ───────────────
  const bc = bceomHeadwater(input.shape, coef.key, r.cellWidth, d, q, input.upstreamInvert);
  r.bceom = bc.result;
  r.bceomNote = bc.note;
  if (!r.slopeAboveCritical && r.outletCondition !== 'submerged') {
    const strict = 'Hypothèse BCEOM de régime torrentiel non satisfaite';
    if (r.bceom != null) {
      r.bceom.note = !r.bceom.note || !r.bceom.note.trim() ? strict : r.bceom.note + ' ; ' + strict;
      r.bceomNote = r.bceom.note;
    } else if (!r.bceomNote || !r.bceomNote.trim()) r.bceomNote = strict;
    else r.bceomNote += ' ; ' + strict;
  }

  r.culvertDischarge = totalQ;
  r.roadOverflowDepth = Number.isNaN(input.roadElev) ? 0 : Math.max(0, r.upstreamWaterElev - input.roadElev);
  return r;
}

/**
 * Remontée de la ligne d'eau de la sortie vers l'entrée par pas directs sur la profondeur :
 * Δx = (E₂ − E₁)/(Sf,moy − S₀). L'énergie obtenue est rapportée au radier amont.
 */
function directStep(q, sec, len, s0, k, tw, yc, yn, capacityExceeded, kOut) {
  const FAIL = { converged: false, energy: 0, depth: 0, velocity: 0, fullFlowLength: 0 };
  const d = sec.rise;
  const A = (y) => sec.area(y);
  const V = (y) => q / A(y);
  const E = (y) => y + V(y) * V(y) / (2 * G);
  const Sf = (y) => sec.frictionSlope(y, q, k);

  let y0;
  if (tw <= yc) y0 = yc;                  // chute libre : contrôle critique
  else if (tw >= d) return FAIL;          // sortie noyée : traitée en pleine section
  else y0 = outletDepth(q, sec, tw, yc, kOut);
  if (!(y0 > 0) || Number.isNaN(y0)) return FAIL;

  const dy = clamp(d / 300.0, STEP_MIN, STEP_MAX);
  let y = Math.min(y0, d);
  let remaining = len;
  const sfFull = sec.fullFrictionSlope(q, k);

  for (let guard = 0; guard < 200000 && remaining > 1e-9; guard++) {
    if (y >= d - 1e-9) {
      // Raccord en pleine section jusqu'à l'entrée.
      const eFull = E(d) + (sfFull - s0) * remaining;
      return { converged: true, energy: eFull, depth: d, velocity: q / sec.fullArea, fullFlowLength: remaining };
    }
    if (!capacityExceeded && Math.abs(y - yn) <= 1e-7)
      return { converged: true, energy: E(y), depth: y, velocity: V(y), fullFlowLength: 0 };

    const dir = (capacityExceeded || y < yn) ? +1 : -1;
    let y2 = y + dir * dy;
    if (!capacityExceeded) {
      if (dir > 0 && y2 > yn) y2 = yn;
      else if (dir < 0 && y2 < yn) y2 = yn;
    }
    if (y2 > d) y2 = d;
    if (y2 < 1e-4) return FAIL;

    const denom = 0.5 * (Sf(y) + Sf(y2)) - s0;
    const dx = (E(y2) - E(y)) / denom;
    if (Number.isNaN(dx) || !Number.isFinite(dx) || dx <= 0) return FAIL;

    if (dx >= remaining) {
      const f = remaining / dx;
      const yEnd = y + (y2 - y) * f;
      return { converged: true, energy: E(yEnd), depth: yEnd, velocity: V(yEnd), fullFlowLength: 0 };
    }
    remaining -= dx;
    y = y2;
  }
  return FAIL;
}

/** Profondeur à la sortie quand l'aval impose sa loi : E(y₀) = TW + K_sortie·V(y₀)²/2g (branche fluviale). */
function outletDepth(q, sec, tw, yc, kOut) {
  const d = sec.rise;
  if (Math.abs(kOut - 1.0) < 1e-12) return Math.min(tw, d);
  const Fo = (y) => { const v = q / sec.area(y); return y + (1 - kOut) * v * v / (2 * G) - tw; };
  let lo = Math.max(yc, 1e-6), hi = d;
  if (Fo(lo) > 0) return lo;
  if (Fo(hi) < 0) return hi;
  for (let i = 0; i < 200; i++) {
    const mid = 0.5 * (lo + hi);
    if (Fo(mid) < 0) lo = mid; else hi = mid;
    if (hi - lo < 1e-12) break;
  }
  return 0.5 * (lo + hi);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Abaques BCEOM (BceomCharts.cs) — contre-épreuve, jamais moteur
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Table de correspondance HDS-5 → courbe BCEOM. Aucun report silencieux hors de cette table ;
 * exact = false marque un voisinage documenté.
 */
export const BCEOM_CORRESPONDENCES = Object.freeze([
  { shape: 'box', inlet: 1, figure: 77, curveId: 'A_ailes_30_75', exact: true, note: '' },
  { shape: 'box', inlet: 4, figure: 77, curveId: 'A_ailes_30_75', exact: true,
    note: "ailes à 45°, dans la plage 30°–75° de la courbe A ; le biseau supérieur n'est pas distingué par l'abaque BCEOM" },
  { shape: 'box', inlet: 5, figure: 77, curveId: 'B_mur_de_tete_sans_ailes', exact: true,
    note: "le chanfrein des arêtes n'est pas distingué par l'abaque BCEOM" },
  { shape: 'box', inlet: 6, figure: 77, curveId: 'B_mur_de_tete_sans_ailes', exact: true,
    note: "le biseau des arêtes n'est pas distingué par l'abaque BCEOM" },
  { shape: 'box', inlet: 2, figure: 77, curveId: 'B_mur_de_tete_sans_ailes', exact: false,
    note: "correspondance approchée : l'abaque BCEOM ne distingue pas les ailes à 15° du mur de tête sans aile" },
  { shape: 'box', inlet: 3, figure: 77, curveId: 'C_saillante_ou_sifflet', exact: false,
    note: 'correspondance approchée : ailes parallèles rapprochées de la courbe C (contraction forte)' },
  { shape: 'circular', inlet: 201, figure: 71, curveId: 'mur_de_tete', exact: true, note: '' },
  { shape: 'circular', inlet: 203, figure: 71, curveId: 'tete_saillante_hors_remblai', exact: true, note: '' },
  { shape: 'circular', inlet: 102, figure: 72, curveId: 'emboitement_femelle', exact: true, note: '' },
  { shape: 'circular', inlet: 103, figure: 72, curveId: 'emboitement_femelle', exact: false,
    note: 'correspondance approchée : la figure 72 ne distingue pas la saillie hors remblai' },
].map((o) => Object.freeze(o)));

export function findBceomCorrespondence(shape, inletKey) {
  const s = normalizeShape(shape);
  const key = findInlet(inletKey)?.key;
  return BCEOM_CORRESPONDENCES.find((c) => c.shape === s && c.inlet === key) || null;
}

/** Interpolation linéaire en log₁₀/log₁₀ dans une table croissante en x ; null hors domaine. */
export function logLog(pts, x) {
  if (!pts || pts.length < 2 || !(x > 0)) return null;
  if (x < pts[0][0] || x > pts[pts.length - 1][0]) return null;
  for (let i = 1; i < pts.length; i++) {
    if (x > pts[i][0]) continue;
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    if (!(x1 > 0 && x2 > 0 && y1 > 0 && y2 > 0)) return null;
    if (Math.abs(x - x1) <= 1e-15 * Math.max(1, x1)) return y1;
    if (Math.abs(x - x2) <= 1e-15 * Math.max(1, x2)) return y2;
    if (x2 - x1 <= 0) return y2;
    const t = (Math.log10(x) - Math.log10(x1)) / (Math.log10(x2) - Math.log10(x1));
    return Math.pow(10, Math.log10(y1) + t * (Math.log10(y2) - Math.log10(y1)));
  }
  return pts[pts.length - 1][1];
}

/**
 * Débit réduit des abaques de niveau amont, calculé directement (nomogrammes 74 et 78) :
 * buse Q* = Q/√(2g·D⁵) ; dalot Q* = Q/(B·D·√(2g·D)).
 */
export function bceomReducedDischarge(shape, width, height, q) {
  const g = 9.81;
  return normalizeShape(shape) === 'circular'
    ? q / Math.sqrt(2 * g * Math.pow(height, 5))
    : q / (width * height * Math.sqrt(2 * g * height));
}

const relativeClose = (a, b) => Math.abs(a - b) <= 1e-9 || Math.abs(a - b) / Math.max(Math.abs(b), 1e-12) < 1e-4;
const anchorMatch = (qs, aq) => Math.abs(qs - aq) <= 5e-4 || Math.abs(qs - aq) / Math.max(Math.abs(aq), 1e-12) < 0.005;
const eqIgnoreCase = (a, b) => a != null && b != null && String(a).toLowerCase() === String(b).toLowerCase();

function sortUnique(pts) {
  const groups = new Map();           // ordre d'apparition des clés, dernier élément conservé
  for (const p of pts) groups.set(p[0], p);
  return [...groups.values()].sort((a, b) => a[0] - b[0]);
}

/** Fusion des points digitalisés et des ancres de validation de la courbe (priorité aux ancres). */
export function mergeWithAnchors(curve, anchors) {
  let pts = (curve.points || [])
    .filter((p) => p.q_reduit > 0 && p.h_amont_reduit > 0)
    .map((p) => [p.q_reduit, p.h_amont_reduit]);
  if (anchors) {
    for (const a of anchors) {
      const qs = a['Q*'], hs = a['H1*'];
      if (!(qs > 0) || !(hs > 0)) continue;
      pts = pts.filter((p) => !relativeClose(p[0], qs));
      pts.push([qs, hs]);
    }
  }
  return sortUnique(pts);
}

/**
 * Lecture de H1* sur une figure / courbe pour un Q* donné (BceomCharts.Read).
 * @returns {{result: object|null, note: string}}
 */
export function bceomRead(figure, curveId, qStar, riseM, upstreamInvert = 0, data = BCEOM_ABAQUES) {
  if (!data) return { result: null, note: 'Abaques BCEOM introuvables (data/bceom_abaques_71_84.json).' };
  if (!(riseM > 0) || !(qStar > 0)) return { result: null, note: 'géométrie ou Q* invalide' };
  const fig = (data.abaques_niveau_amont || []).find((a) => a.figure === figure);
  const curve = fig?.courbes?.find((c) => eqIgnoreCase(c.id, curveId));
  if (!fig || !curve) return { result: null, note: `figure ${figure}, courbe « ${curveId} » absente du fichier d'abaques` };

  const curveAnchors = (fig.ancres_validation || [])
    .filter((a) => eqIgnoreCase(a.courbe, curve.id) && a['Q*'] > 0 && a['H1*'] > 0);
  const pts = mergeWithAnchors(curve, curveAnchors);
  if (pts.length < 2) return { result: null, note: `figure ${figure} — courbe « ${curveId} » : moins de deux points` };

  const h1Star = logLog(pts, qStar);
  if (h1Star == null) {
    return {
      result: null,
      note: `Q* = ${F(qStar, 4)} hors du domaine digitalisé de la figure ` +
        `${fig.figure} [${F(pts[0][0], 3)} ; ${F(pts[pts.length - 1][0], 3)}] — extrapolation refusée`,
    };
  }
  const usedAnchor = curveAnchors.some((a) => anchorMatch(qStar, a['Q*']));
  const h1 = h1Star * riseM;
  const notes = [];
  if (fig.qualite && fig.qualite.toLowerCase().includes('a_valider'))
    notes.push('digitalisation graphique à valider — pas une équation analytique exacte');
  if (usedAnchor) notes.push('ancre de validation (exemple imprimé) prioritaire sur le relevé graphique');
  else if (curveAnchors.length > 0)
    notes.push('Interpolation logarithmique entre points digitalisés. ' +
      'La courbe contient des ancres de validation issues des exemples du manuel.');

  return {
    result: {
      method: 'BCEOM — niveau amont en sortie libre',
      figure: fig.figure,
      ouvrage: fig.ouvrage || '',
      curveId: curve.id || curveId,
      curveLabel: curve.libelle || '',
      quality: fig.qualite || '',
      uncertaintyPct: fig.incertitude_relative_estimee_pct || 0,
      qStar,
      h1Star,
      headwater: h1,
      waterElev: upstreamInvert + h1,
      domainMin: pts[0][0],
      domainMax: pts[pts.length - 1][0],
      usedValidationAnchor: usedAnchor,
      approximateMatch: false,
      note: notes.join(' ; '),
    },
    note: '',
  };
}

/** Lecture branchée sur une configuration HDS-5 pour un débit par alvéole q (BceomCharts.Headwater). */
export function bceomHeadwater(shape, inletKey, width, height, q, upstreamInvert = 0) {
  const s = normalizeShape(shape);
  if (!(height > 0) || !(q > 0) || (s === 'box' && !(width > 0))) return { result: null, note: 'géométrie incomplète' };
  const map = findBceomCorrespondence(s, inletKey);
  if (!map) {
    return {
      result: null,
      note: "aucune courbe BCEOM dans la table de correspondance pour cette configuration d'entrée ; " +
        'seul le contrôle HDS-5 est disponible',
    };
  }
  if (map.figure === 71 && height > 2.0)
    return { result: null, note: 'figure 71 limitée aux buses métalliques de diamètre ≤ 2 m' };
  const qStar = bceomReducedDischarge(s, width, height, q);
  const rd = bceomRead(map.figure, map.curveId, qStar, height, upstreamInvert);
  if (!rd.result) return rd;
  rd.result.approximateMatch = !map.exact;
  if (map.note && map.note.trim())
    rd.result.note = !rd.result.note || !rd.result.note.trim() ? map.note : rd.result.note + ' ; ' + map.note;
  return rd;
}

function bceomAnalytic(figure, qStar) {
  const a = (BCEOM_ABAQUES.abaques_analytiques || []).find((x) => x.figure === figure);
  if (!a || a.points.length < 2) return null;
  const pts = a.points.map((p) => [p.q_reduit, p.valeur_reduite])
    .filter((p) => p[0] > 0 && p[1] > 0)
    .sort((u, v) => u[0] - v[0]);
  return logLog(pts, qStar);
}

/**
 * Pente critique réduite (fig. 79 buse : Q* = Q/√(g·R⁵), Ic* = Ic·K²·R^(1/3)/g ;
 * fig. 82 dalot : Q* = Q/(√g·B^(5/2)), Ic* = Ic·K²·B^(1/3)/g). Contre-épreuve seulement.
 */
export const bceomCriticalSlopeReduced = (shape, qStar) =>
  bceomAnalytic(normalizeShape(shape) === 'circular' ? 79 : 82, qStar);
/**
 * Vitesse réduite (fig. 83 buse : Q* = Q/(K√I·R^(8/3)), V* = V/(K·R^(2/3)·√I) ; fig. 84 dalot avec B).
 * Contre-épreuve seulement.
 */
export const bceomVelocityReduced = (shape, qStar) =>
  bceomAnalytic(normalizeShape(shape) === 'circular' ? 83 : 84, qStar);

/** Résumé affichable d'une lecture BCEOM. */
export function bceomSummary(b) {
  return `${b.method} · fig. ${b.figure} — ${b.curveLabel} · ` +
    `Q* = ${F(b.qStar, 4)} · H1* = ${F(b.h1Star, 3)} · H1 = ${F(b.headwater, 3)} m · ` +
    `domaine [${F(b.domainMin, 3)} ; ${F(b.domainMax, 3)}]` + (b.quality ? ' · ' + b.quality : '');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Normalisation de l'API publique
// ═══════════════════════════════════════════════════════════════════════════════════════════

function normalizeShape(s) {
  const v = String(s ?? '').toLowerCase();
  if (['circular', 'circ', 'buse', 'pipe', 'round'].includes(v)) return 'circular';
  return 'box';
}

/**
 * Section publique → { shape, cells, width, height }.
 * Buse : { shape:'circular'|'buse', diameter (m), cells|n|count (défaut 1) }.
 * Dalot : { shape:'box'|'dalot', width|B (m), height|H|D (m), cells|n|count (défaut 1) }.
 */
export function normalizeSection(section = {}) {
  let shape = section.shape ?? section.type;
  shape = shape != null ? normalizeShape(shape) : (section.diameter != null ? 'circular' : 'box');
  const cellsRaw = section.cells ?? section.n ?? section.count ?? section.N ?? 1;
  const cells = Math.max(1, Math.round(Number(cellsRaw)) || 1);
  if (shape === 'circular') {
    const dia = Number(section.diameter ?? section.D ?? section.height ?? section.H);
    return { shape, cells, width: dia, height: dia };
  }
  return {
    shape, cells,
    width: Number(section.width ?? section.B),
    height: Number(section.height ?? section.H ?? section.D),
  };
}

function normalizeTailwaterMode(m) {
  const v = String(m ?? '').toLowerCase();
  if (['known', 'knownlevel', 'phe', 'level', 'cote'].includes(v)) return 'known';
  if (['channel', 'downstreamchannel', 'chenal'].includes(v)) return 'channel';
  if (['free', 'freeoutfall', 'libre', 'sortie libre'].includes(v)) return 'free';
  return 'none';
}

/** Construit l'entrée interne du moteur (équivalent de CulvertInput) depuis l'API publique. */
function buildInput(sec, Q, p = {}) {
  const shape = sec.shape;
  const length = Number(p.length ?? p.L);
  let slope = p.slope != null ? Number(p.slope) : p.slopePct != null ? Number(p.slopePct) / 100 : 0;
  const upstreamInvert = Number(p.upstreamInvert ?? ENGINE_DEFAULTS.upstreamInvert);

  // Condition aval : 'free' par défaut (toute ligne neuve de BVTrace naît en « sortie libre supposée »).
  const tw = p.tailwater ?? { mode: 'free' };
  const mode = typeof tw === 'string' ? normalizeTailwaterMode(tw) : normalizeTailwaterMode(tw.mode ?? 'free');
  let downstreamWaterElev = NaN;
  let downstreamChannelObj = null;
  if (mode === 'known' && typeof tw === 'object') {
    if (tw.level != null) downstreamWaterElev = Number(tw.level);
    else if (tw.depth != null) downstreamWaterElev = upstreamInvert - slope * length + Number(tw.depth);
  } else if (mode === 'channel' && typeof tw === 'object' && (tw.channel || tw.bedWidth != null || tw.sideSlope != null)) {
    const c = tw.channel ?? tw;
    // Pente du chenal non renseignée = pente du radier de l'ouvrage (HydraulicInputBuilder).
    downstreamChannelObj = downstreamChannel({ ...c, slope: c.slope != null ? Number(c.slope) : slope });
  }

  const roadLevel = p.roadLevel ?? p.roadElev;
  return {
    shape,
    totalDischarge: Number(Q),
    cells: sec.cells,
    width: sec.width,
    height: sec.height,
    length,
    slope,
    StricklerK: Number(p.StricklerK ?? p.K ?? ENGINE_DEFAULTS.StricklerK),
    upstreamInvert,
    tailwaterMode: mode,
    downstreamWaterElev,
    downstreamChannel: downstreamChannelObj,
    roadElev: roadLevel == null ? NaN : Number(roadLevel),
    minFreeboard: Number(p.minFreeboard ?? ENGINE_DEFAULTS.minFreeboard),
    inlet: p.inlet != null ? (findInlet(p.inlet)?.key ?? -1) : DEFAULT_INLET[shape],
    inletDefaulted: p.inlet == null,
    Ke: p.Ke != null ? Number(p.Ke) : null,
    exitLossCoefficient: Number(p.exitLossCoefficient ?? ENGINE_DEFAULTS.exitLossCoefficient),
    maxFillRatioPct: Number(p.maxFillRatioPct ?? ENGINE_DEFAULTS.maxFillRatioPct),
    maxVelocity: Number(p.maxVelocity ?? ENGINE_DEFAULTS.maxVelocity),
    allowRoadOverflow: !!p.allowRoadOverflow,
    roadCrestLength: Number(p.roadCrestLength ?? 0),
    weirCoefficient: Number(p.weirCoefficient ?? ENGINE_DEFAULTS.weirCoefficient),
    submergenceFactor: Number(p.submergenceFactor ?? ENGINE_DEFAULTS.submergenceFactor),
    maxHeadwater: p.maxHeadwater != null ? Number(p.maxHeadwater) : null,
  };
}

/**
 * Grandeurs dérivées ajoutées par le portage (absentes de BVTrace) : vitesses d'entrée / de sortie,
 * HW admissible. N'affectent aucune grandeur du moteur ni la liste `warnings` de BVTrace (les
 * avertissements propres au portage sont ajoutés EN FIN de liste et repris dans `extraWarnings`).
 */
function decorate(r, input) {
  const out = r;
  out.inletDefaulted = !!input.inletDefaulted;
  out.flowRegime = r.slopeAboveCritical ? 'torrentiel' : 'fluvial';
  out.extraWarnings = [];
  out.velocities = { uniform: null, full: null, critical: null, inlet: null, outlet: null, outletBasis: '' };
  out.headwaterOk = null;
  if (!r.valid) return out;
  const sec = makeSection(r.shape, r.cellWidth, r.cellHeight);
  const q = r.dischargePerCell, d = r.cellHeight;
  const ycEff = Math.min(r.criticalDepth, d);
  const v = out.velocities;
  v.uniform = r.uniformVelocity;
  v.full = r.fullVelocity;
  v.critical = q / sec.area(ycEff);
  v.inlet = r.profileEntranceDepth > 0 ? q / sec.area(r.profileEntranceDepth) : null;
  // Vitesse de sortie selon HDS-5 §3.6 : contrôle à l'entrée → tirant normal ; contrôle à la sortie →
  // section pleine si TW ≥ D, sinon max(yc, TW) borné à D.
  if (r.control === 'inlet') {
    v.outlet = r.capacityExceeded ? r.fullVelocity : q / sec.area(r.normalDepth);
    v.outletBasis = r.capacityExceeded ? 'section pleine (capacité dépassée)' : 'tirant normal yn (contrôle à l\'entrée)';
  } else if (r.outletCondition === 'submerged') {
    v.outlet = r.fullVelocity;
    v.outletBasis = 'section pleine (sortie noyée)';
  } else {
    const y = Math.min(Math.max(ycEff, r.tailwaterDepth), d);
    v.outlet = q / sec.area(y);
    v.outletBasis = 'max(yc, TW) borné à D (contrôle à la sortie)';
  }
  if (input.maxHeadwater != null && Number.isFinite(input.maxHeadwater)) {
    out.headwaterOk = r.headwater <= input.maxHeadwater + DEPTH_TOLERANCE;
    if (!out.headwaterOk)
      out.extraWarnings.push(`HW = ${F(r.headwater, 3)} m > HW admissible ${F(input.maxHeadwater, 3)} m.`);
  }
  if (v.outlet > r.maxVelocity && r.velocityOk)
    out.extraWarnings.push(`Vitesse de sortie ${F(v.outlet, 2)} m/s > ${F(r.maxVelocity, 2)} m/s admis ` +
      `(${v.outletBasis}) : protection de l'exutoire à examiner.`);
  out.warnings.push(...out.extraWarnings);
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// API publique — calcul d'un ouvrage
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Calcul hydraulique complet d'un ouvrage (buse ou dalot) — FHWA HDS-5, portage de CulvertCalculator.Calculate.
 *
 * @param {object} section  Buse : { shape:'circular'|'buse', diameter, cells=1 } ;
 *                          dalot : { shape:'box'|'dalot', width (B), height (H = D), cells=1 }. m.
 * @param {number} Q        Débit total de projet (m³/s), partagé également entre les alvéoles.
 * @param {object} params   (tous en SI ; défauts entre crochets)
 *   length              L, longueur de l'ouvrage (m) — requis.
 *   slope               J = S₀, pente du radier (m/m) [0] ; ou slopePct (%).
 *   StricklerK          K de Manning-Strickler [70].
 *   upstreamInvert      cote du radier amont (m) [0] ; radier aval = amont − J·L.
 *   inlet               clé (1…6 dalots, 101…302 buses) ou id du catalogue [4 dalot, 101 buse].
 *                       Une entrée étrangère à la forme fait REFUSER le calcul (aucune échelle par défaut).
 *   Ke                  perte d'entrée du contrôle à la sortie [valeur du catalogue pour l'entrée].
 *   exitLossCoefficient perte de sortie [1].
 *   tailwater           condition aval [{ mode:'free' }] :
 *                         { mode:'free' }                       sortie libre supposée (provisoire) ;
 *                         { mode:'known', level }              PHE aval connue, cote absolue (m) ;
 *                         { mode:'known', depth }              ou profondeur TW au-dessus du radier aval (m) ;
 *                         { mode:'channel', channel:{ bedWidth=0, sideSlope=1.5, slope=J, StricklerK=30 } } ;
 *                         { mode:'none' }                      → calcul refusé (mode aval obligatoire).
 *                       L'état de la sortie (libre / partiellement noyée / noyée) est toujours un RÉSULTAT.
 *   roadLevel           cote du point bas de la chaussée (m) [inconnue → revanche non vérifiable].
 *   minFreeboard        revanche minimale (m) [0 ; l'application BVTrace propose 0,50].
 *   maxHeadwater        HW admissible au-dessus du radier amont (m) [aucun] — ajout du portage.
 *   maxFillRatioPct     taux de remplissage admissible (%) [75].
 *   maxVelocity         vitesse maximale admise (m/s) [3,00 — HydraulicDefaults.MaxVelocity].
 *   allowRoadOverflow   partager le débit avec la chaussée (déversoir épais) [false].
 *   roadCrestLength     Lr, longueur équivalente de crête (m) [0].
 *   weirCoefficient     Cd du déversoir (SI) [1,70] ;  submergenceFactor kt [1,0].
 * @returns {object} résultat — champs de CulvertResult (BVTrace) en camelCase, notamment :
 *   valid, warnings[], hds5Applied, hds5Status, inlet{…}, inletX, inletRegime ('unsubmerged'|'transition'|'submerged'),
 *   hwInlet, hwOutlet, headwater (m / radier amont), control ('inlet'|'outlet'), upstreamWaterElev,
 *   outletCondition ('free'|'partial'|'submerged'), tailwaterInfluences, tailwaterDepth, outletMethod,
 *   normalDepth, criticalDepth, criticalSlopePct, slopeAboveCritical, flowRegime ('torrentiel'|'fluvial'),
 *   uniformVelocity, fullVelocity, velocities{uniform, full, critical, inlet, outlet}, velocityOk,
 *   entranceLoss, frictionLoss, exitLoss, totalLoss, freeboard, freeboardOk, fullCapacity, fillRatioPct,
 *   culvertDischarge, roadDischarge, roadOverflowDepth, bceom{…}|null, bceomNote, headwaterOk, labels{…}.
 */
export function culvertHydraulics(section, Q, params = {}) {
  const sec = normalizeSection(section);
  const input = buildInput(sec, Q, params);
  const r = decorate(calculate(input), input);
  r.labels = {
    control: controlLabel(r.control),
    outletCondition: outletConditionLabel(r),
    inletRegime: inletRegimeLabel(r.inletRegime),
    outletMethod: methodLabel(r.outletMethod),
    tailwaterMode: tailwaterModeLabel(r.tailwaterMode),
    freeboard: freeboardLabel(r.freeboard),
    freeboardCompliance: freeboardCompliance(r.freeboard, r.minFreeboard),
    summary: r.valid ? summary(r) : r.hds5Status || r.warnings[0] || '',
  };
  return r;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Dimensionnement (CulvertSizing.cs)
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Pente de projet au-dessus de la pente critique : premier multiple de 0,1 % au-dessus de Ic
 * (StructureHydraulics.SlopeAboveCritical). Ic = 0,519 % → 0,6 %.
 */
export function slopeAboveCritical(criticalSlopePct) {
  if (!(criticalSlopePct > 0)) return 0;
  return roundEven(Math.ceil(criticalSlopePct / 0.1 - 1e-9) * 0.1, 3);
}

/** Motifs de rejet ; vide ⇔ CulvertSizing.IsHardOk (+ HW admissible si fourni). */
function hardReasons(r, t, maxHeadwaterRatio) {
  const why = [];
  if (!r || !r.valid) { why.push(r?.hds5Status || 'calcul refusé'); return why; }
  if (r.capacityExceeded) why.push('capacité uniforme dépassée');
  if (r.fillRatioPct > t.maxFillRatioPct) why.push(`taux ${F(r.fillRatioPct, 0)} % > ${F(t.maxFillRatioPct, 0)} %`);
  if (r.uniformVelocity > t.maxVelocity) why.push(`V ${F(r.uniformVelocity, 2)} > ${F(t.maxVelocity, 2)} m/s`);
  if (r.cellHeight > 0 && r.headwater > maxHeadwaterRatio * r.cellHeight)
    why.push(`HW/D ${F(r.headwater / r.cellHeight, 2)} > ${F(maxHeadwaterRatio, 2)}`);
  if (!Number.isNaN(r.freeboard) && !r.freeboardOk) why.push(`revanche ${F(r.freeboard, 2)} m insuffisante`);
  if (t.maxHeadwater != null && Number.isFinite(t.maxHeadwater) && r.headwater > t.maxHeadwater + DEPTH_TOLERANCE)
    why.push(`HW ${F(r.headwater, 3)} m > HW admissible ${F(t.maxHeadwater, 3)} m`);
  return why;
}

function sizingScore(r, n, b, h) {
  let score = 100.0;
  score -= (n - 1) * 8.0;
  score -= n * b * h * 1.5;
  const fill = r.fillRatioPct;
  if (fill >= 50 && fill <= 70) score += 12;
  else if (fill >= 40 && fill < 50) score += 4;
  else if (fill > 70 && fill <= 75) score += 2;
  else score -= Math.abs(fill - 60) * 0.2;
  const v = r.uniformVelocity;
  if (v >= 2.0 && v <= 3.0) score += 10;
  else if (v >= 1.5 && v < 2.0) score += 4;
  else if (v > 3.0 && v <= 3.5) score += 2;
  else score -= Math.abs(v - 2.5) * 2;
  const ratio = h > 0 ? r.headwater / h : 99;
  if (ratio <= 0.8) score += 18;
  else if (ratio <= 1.0) score += 12;
  else if (ratio <= MAX_HEADWATER_RATIO) score += 4;
  if (!Number.isNaN(r.freeboard)) {
    if (r.freeboard >= r.minFreeboard + 0.5) score += 8;
    else if (r.freeboardOk) score += 3;
  }
  return score;
}

/** Une passe de CulvertSizing.ProposeAll ; renvoie { candidates (triées par score), examined }. */
function proposeAll(template, slopePct, opts, maxHeadwaterRatio, diameters) {
  const list = [];
  const examined = [];
  if (!(template.totalDischarge > 0) || !(template.StricklerK > 0)) return { candidates: list, examined };
  const maxCells = clamp(opts.maxCells, 1, 20);

  const run = (n, b, h, sPct) => calculate({
    ...template,
    cells: n, width: b, height: h,
    length: template.length > 0 ? template.length : ENGINE_DEFAULTS.sizingLengthIfMissing,
    slope: sPct / 100.0,
    allowRoadOverflow: false,           // pas de surverse pendant la recherche : on cherche à l'éviter
  });

  const tryAdd = (n, b, h, sPct, slopeFree) => {
    if (template.shape === 'box' && h > b + 1e-9) return;
    let r = run(n, b, h, sPct);
    const why = hardReasons(r, template, maxHeadwaterRatio);
    const rec = { cells: n, width: b, height: h, slopePct: sPct, accepted: why.length === 0, reasons: why,
      headwater: r.headwater, uniformVelocity: r.uniformVelocity, fillRatioPct: r.fillRatioPct };
    examined.push(rec);
    if (why.length) return;
    let used = sPct;
    if (slopeFree) {
      const prefer = Math.max(sPct, slopeAboveCritical(r.criticalSlopePct));
      if (prefer > sPct + 1e-6) {
        const r2 = run(n, b, h, prefer);
        if (hardReasons(r2, template, maxHeadwaterRatio).length === 0) { r = r2; used = prefer; }
      }
    }
    const dims = template.shape === 'circular' ? `${n} × Ø${F(h, 2)} m` : `${n} × ${F01(b)}×${F01(h)} m`;
    list.push({
      cells: n, width: b, height: h,
      slopePct: roundEven(used, 3),
      result: r,
      score: sizingScore(r, n, b, h),
      totalArea: n * (template.shape === 'circular' ? Math.PI * h * h / 4 : b * h),
      rationale: `${dims} · taux ${F(r.fillRatioPct, 0)} % · V=${F(r.uniformVelocity, 2)} m/s · ` +
        `${controlLabel(r.control)} · HW/D=${F(r.headwater / h, 2)}`,
    });
  };

  const slopeFree = !(slopePct > 0);
  const slopes = slopeFree ? FREE_SLOPES_PCT : [slopePct];

  if (template.shape === 'circular') {
    for (const s of slopes)
      for (let n = 1; n <= maxCells; n++)
        for (const dia of diameters) {
          if (dia > opts.maxH + 1e-9) continue;
          tryAdd(n, dia, dia, s, slopeFree);
        }
    return { candidates: dedupe(list, (p) => `${p.cells}|${p.height}`), examined };
  }

  const minB = Math.max(1.0, roundEven(opts.minB));
  const maxB = Math.max(minB, roundEven(opts.maxB));
  const minH = Math.max(0.5, roundEven(opts.minH * 2) / 2.0);
  const maxH = Math.max(minH, roundEven(opts.maxH * 2) / 2.0);
  for (const s of slopes)
    for (let n = 1; n <= maxCells; n++)
      for (let b = minB; b <= maxB + 1e-9; b += 1.0)
        for (let h = minH; h <= maxH + 1e-9; h += 0.5) {
          const bb = roundEven(b, 0), hh = roundEven(h, 1);
          if (hh > bb + 1e-9) continue;          // la hauteur ne dépasse jamais la largeur
          if (bb > hh + 2.0 + 1e-9) continue;    // largeur au plus 2 m au-dessus de la hauteur
          tryAdd(n, bb, hh, s, slopeFree);
        }
  return { candidates: dedupe(list, (p) => `${p.cells}|${p.width}|${p.height}`), examined };
}

/** GroupBy (ordre d'apparition) → meilleur score du groupe (premier en cas d'égalité) → tri stable décroissant. */
function dedupe(list, keyOf) {
  const groups = new Map();
  for (const p of list) {
    const k = keyOf(p);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const best = [...groups.values()].map((g) => g.reduce((a, c) => (c.score > a.score ? c : a)));
  return best.sort((a, b) => b.score - a.score);
}

/**
 * Dimensionnement d'un ouvrage pour un débit Q — portage de CulvertSizing.ProposeAll / Propose, avec la
 * double passe de l'application BVTrace (gammes `primary` puis `fallback`).
 *
 * Critères durs (CulvertSizing.IsHardOk) : capacité uniforme non dépassée, taux ≤ maxFillRatioPct,
 * V uniforme ≤ maxVelocity, HW/D ≤ maxHeadwaterRatio (1,2), revanche ≥ minFreeboard si roadLevel est donnée,
 * et (ajout du portage) HW ≤ maxHeadwater si fourni. Dalots : pas B = 1 m, pas H = 0,5 m, H ≤ B ≤ H + 2 m.
 * Buses : diamètres courants PIPE_DIAMETERS (≤ maxH).
 *
 * @param {number} Q            débit total (m³/s).
 * @param {object} constraints
 *   shape            'box'|'dalot' ou 'circular'|'buse' ['box'].
 *   slopePct         pente imposée (%) ; ≤ 0 ou absente → pente libre : balayage FREE_SLOPES_PCT puis
 *                    relèvement au premier multiple de 0,1 % au-dessus de Ic si les critères restent tenus.
 *                    (à défaut params.slope en m/m est pris).
 *   maxCells, minB, maxB, minH, maxH   gammes [BOX_SIZING_RANGES.primary : 12, 1, 4, 1,5, 4,5].
 *   fallback         second essai avec BOX_SIZING_RANGES.fallback si rien ne passe [true].
 *   maxHeadwaterRatio  [1,2] ;  maxHeadwater (m) [aucun] ; diameters [PIPE_DIAMETERS].
 *   strategy         'score' (choix BVTrace, meilleur score) | 'smallest' (plus petite section totale) ['score'].
 * @param {object} params       mêmes paramètres que culvertHydraulics (length [10 si absente], StricklerK,
 *                              inlet, tailwater, roadLevel, minFreeboard, maxVelocity, maxFillRatioPct…).
 * @returns {{ retained, best, smallest, candidates, examined, pass, slopeFree, message }}
 *   retained   proposition retenue selon `strategy` ({cells, width, height, slopePct, score, rationale,
 *              totalArea, result, section}) ou null ;  best = meilleur score (BVTrace) ;  smallest = plus
 *              petite aire totale ;  candidates = toutes les propositions valides de la passe retenue,
 *              triées par score ;  examined = toutes les combinaisons essayées avec motifs de rejet.
 */
export function sizeCulvert(Q, constraints = {}, params = {}) {
  const shape = normalizeShape(constraints.shape ?? params.shape ?? 'box');
  let slopePct = constraints.slopePct != null ? Number(constraints.slopePct)
    : params.slopePct != null ? Number(params.slopePct)
    : params.slope != null ? Number(params.slope) * 100 : 0;
  const slopeFree = !(slopePct > 0);
  // Gabarit : comme l'application, la pente du gabarit vaut la pente imposée, ou 0,5 % si elle est libre
  // (elle ne sert alors qu'à la pente d'un chenal aval non renseignée).
  const templateSlopePct = slopePct > 0 ? slopePct : 0.5;
  const sec = { shape, cells: 1, width: 1, height: 1 };
  const template = buildInput(sec, Q, { ...params, slope: templateSlopePct / 100, slopePct: undefined });
  template.maxHeadwater = constraints.maxHeadwater != null ? Number(constraints.maxHeadwater) : template.maxHeadwater;
  const maxHeadwaterRatio = Number(constraints.maxHeadwaterRatio ?? MAX_HEADWATER_RATIO);
  const diameters = constraints.diameters ?? PIPE_DIAMETERS;

  const primary = {
    maxCells: constraints.maxCells ?? BOX_SIZING_RANGES.primary.maxCells,
    maxB: constraints.maxB ?? BOX_SIZING_RANGES.primary.maxB,
    maxH: constraints.maxH ?? BOX_SIZING_RANGES.primary.maxH,
    minB: constraints.minB ?? BOX_SIZING_RANGES.primary.minB,
    minH: constraints.minH ?? BOX_SIZING_RANGES.primary.minH,
  };
  const passes = [['primary', primary]];
  if (constraints.fallback !== false) passes.push(['fallback', { ...BOX_SIZING_RANGES.fallback }]);

  let out = null;
  const allExamined = [];
  for (const [name, opts] of passes) {
    const { candidates, examined } = proposeAll(template, slopeFree ? 0 : slopePct, opts, maxHeadwaterRatio, diameters);
    allExamined.push(...examined.map((e) => ({ ...e, pass: name })));
    if (candidates.length > 0) { out = { pass: name, candidates }; break; }
  }

  const decorateProp = (p) => {
    if (!p) return null;
    p.section = shape === 'circular'
      ? { shape, cells: p.cells, diameter: p.height }
      : { shape, cells: p.cells, width: p.width, height: p.height };
    decorate(p.result, template);
    return p;
  };
  if (!out) {
    return {
      retained: null, best: null, smallest: null, candidates: [], examined: allExamined, pass: null, slopeFree,
      message: shape === 'circular'
        ? `Aucun diamètre courant valide (V≤${F(template.maxVelocity, 2)} ; taux≤${F(template.maxFillRatioPct, 0)} % ; ` +
          `HW/D≤${F(maxHeadwaterRatio, 1)} ; revanche). Augmentez la pente I, le nombre de buses ou réduisez Q.`
        : `Aucune combinaison N/B/H valide (V≤${F(template.maxVelocity, 2)} ; taux≤${F(template.maxFillRatioPct, 0)} % ; ` +
          `HW/D≤${F(maxHeadwaterRatio, 1)} ; revanche ; H≤B≤H+2). Augmentez la pente I, la longueur disponible ou réduisez Q.`,
    };
  }
  const cands = out.candidates.map(decorateProp);
  const best = cands[0];
  const smallest = cands.reduce((a, c) => (c.totalArea < a.totalArea - 1e-12
    || (Math.abs(c.totalArea - a.totalArea) <= 1e-12 && c.cells < a.cells) ? c : a));
  const retained = constraints.strategy === 'smallest' ? smallest : best;
  return {
    retained, best, smallest, candidates: cands, examined: allExamined, pass: out.pass, slopeFree,
    message: retained.rationale,
  };
}

/** Catalogue des sections de dalots balayées (mêmes règles que sizeCulvert) : [{width, height}]. */
export function boxCatalogue(opts = BOX_SIZING_RANGES.primary) {
  const minB = Math.max(1.0, roundEven(opts.minB));
  const maxB = Math.max(minB, roundEven(opts.maxB));
  const minH = Math.max(0.5, roundEven(opts.minH * 2) / 2.0);
  const maxH = Math.max(minH, roundEven(opts.maxH * 2) / 2.0);
  const out = [];
  for (let b = minB; b <= maxB + 1e-9; b += 1.0)
    for (let h = minH; h <= maxH + 1e-9; h += 0.5) {
      const bb = roundEven(b, 0), hh = roundEven(h, 1);
      if (hh > bb + 1e-9 || bb > hh + 2.0 + 1e-9) continue;
      out.push({ width: bb, height: hh });
    }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Relecture des projets (HydraulicDefaults.cs) et cote minimale de rasante (CulvertClearance.cs)
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** Vitesse maximale d'un projet relu : valeur enregistrée, sinon 3,50 m/s avant le schéma 3, sinon 3,00 m/s. */
export function maxVelocityFor(schemaVersion, storedValue) {
  return storedValue > 0 ? storedValue
    : schemaVersion < 3 ? HYDRAULIC_DEFAULTS.legacyMaxVelocity
    : HYDRAULIC_DEFAULTS.maxVelocity;
}

/** Mode aval d'un projet relu : avant le schéma 2, une cote aval > 0 valait « PHE connue », sinon sortie libre. */
export function tailwaterModeFor(schemaVersion, stored, storedDownstreamElev) {
  if (schemaVersion >= 2) return stored;
  return storedDownstreamElev > 0 ? 'known' : 'free';
}

/** Couverture minimale au-dessus de la dalle, jusqu'à la rasante (m). */
export const CLEARANCE_DEFAULT_COVER = 1.00;

/**
 * Cote minimale de rasante au droit d'un ouvrage (CulvertClearance.Compute) :
 * Zmin = Z radier au croisement + H + épaisseur de dalle + max(1,00 ; couverture).
 * @param {{invertAtCrossing:number, height:number, slabThickness?:number, cover?:number}} o  m.
 */
export function minRoadLevelOverCulvert({ invertAtCrossing, height, slabThickness = 0, cover = CLEARANCE_DEFAULT_COVER }) {
  const h = Math.max(0, height), e = Math.max(0, slabThickness);
  const c = Math.max(CLEARANCE_DEFAULT_COVER, cover);
  const zMin = invertAtCrossing + h + e + c;
  return {
    zMin, invert: invertAtCrossing, height: h, slabThickness: e, cover: c,
    detail: `radier ${F(invertAtCrossing, 2)} + H ${F(h, 2)} + dalle ${F(e, 2)} + couverture ${F(c, 2)} = ${F(zMin, 2)} m`,
  };
}
