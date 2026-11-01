// culvert-catalog.js — catalogues des ouvrages hydrauliques (buses et dalots), portés de BVTrace :
//   · CulvertInletCatalog.cs  : coefficients HDS-5 des configurations d'entrée (FHWA HDS-5, 3ᵉ éd., annexe A) ;
//   · CulvertSizing.cs        : diamètres courants des buses, gammes et pas des dalots ;
//   · HydraulicDefaults.cs    : vitesse maximale admise, relecture des anciens projets ;
//   · CulvertModels.cs / Tailwater.cs : valeurs par défaut des données d'entrée du moteur.
// Unités SI. Données pures, sans dépendance : utilisables dans le navigateur et sous Node.
//
// Trois « K » distincts ne doivent jamais être confondus (piège BVTrace) :
//   StricklerK  rugosité de Manning-Strickler (m^(1/3)/s) — paramètre du calcul ;
//   Ke          perte de charge à l'entrée, utilisée par le CONTRÔLE À LA SORTIE ;
//   exitLossCoefficient  perte de sortie (1 par défaut) — portée par les paramètres, pas par le catalogue ;
// et KSlope, correction de pente de l'équation du CONTRÔLE À L'ENTRÉE (−0,5 partout, +0,7 pour 2/2).
//
// Nomenclature des abaques (piège classique) : l'abaque distingue le matériau, l'échelle distingue l'entrée.
// Abaque 1 = buses béton (échelles 1 à 3), abaque 2 = métal ondulé (échelles 1 à 3), abaque 3 = bague
// biseautée (échelles A et B), abaques 8 à 10 = dalots. Les trois entrées béton ne sont PAS les abaques 1, 2, 3.

/** Formes de section. 'box' = dalot rectangulaire B × D ; 'circular' = buse de diamètre D. */
export const SHAPES = Object.freeze({ BOX: 'box', CIRCULAR: 'circular' });

/**
 * Configurations d'entrée HDS-5. `key` reprend la valeur entière de l'énumération C# CulvertInletType
 * (1…6 = têtes de dalot de la carte, 1xx/2xx/3xx = entrées de buse par abaque et échelle), `id` son nom.
 * Équation dénoyée : forme 1  HW/D = Hc/D + K·X^M + KSlope·S ; forme 2  HW/D = K·X^M.
 * Équation noyée   :           HW/D = C·X² + Y + KSlope·S,  avec X = 1,811·q/(A·√D).
 */
export const CULVERT_INLETS = Object.freeze([
  // ── Dalots rectangulaires — abaques 8 à 10 ──────────────────────────────────────────────
  { key: 1, id: 'WingwallFlared30To75', shape: 'box', material: 'béton',
    label: 'Ailes évasées 30° à 75°', detail: 'arête supérieure vive',
    chart: 8, scale: 1, scaleLabel: '1', form: 1, K: 0.026, M: 1.0, C: 0.0347, Y: 0.81, KSlope: -0.50, Ke: 0.40 },
  { key: 2, id: 'WingwallFlared15OrHeadwall', shape: 'box', material: 'béton',
    label: 'Ailes à 15° ou mur frontal à 90°', detail: 'arête vive',
    chart: 8, scale: 2, scaleLabel: '2', form: 1, K: 0.061, M: 0.75, C: 0.0400, Y: 0.80, KSlope: -0.50, Ke: 0.50 },
  { key: 3, id: 'WingwallParallel', shape: 'box', material: 'béton',
    label: 'Ailes parallèles', detail: 'prolongement des piédroits',
    chart: 8, scale: 3, scaleLabel: '3', form: 1, K: 0.061, M: 0.75, C: 0.0423, Y: 0.82, KSlope: -0.50, Ke: 0.70 },
  { key: 4, id: 'Wingwall45Beveled', shape: 'box', material: 'béton',
    label: 'Ailes à 45°', detail: 'biseau supérieur d = 0,043 D',
    chart: 9, scale: 1, scaleLabel: '1', form: 2, K: 0.510, M: 0.667, C: 0.0309, Y: 0.80, KSlope: -0.50, Ke: 0.20 },
  { key: 5, id: 'Headwall90Chamfered', shape: 'box', material: 'béton',
    label: 'Mur frontal à 90°', detail: 'trois chanfreins de 19 mm',
    chart: 10, scale: 1, scaleLabel: '1', form: 2, K: 0.515, M: 0.667, C: 0.0375, Y: 0.79, KSlope: -0.50, Ke: 0.20 },
  { key: 6, id: 'Headwall90Beveled45', shape: 'box', material: 'béton',
    label: 'Mur frontal à 90°', detail: 'trois biseaux à 45°',
    chart: 10, scale: 2, scaleLabel: '2', form: 2, K: 0.495, M: 0.667, C: 0.0314, Y: 0.82, KSlope: -0.50, Ke: 0.20 },

  // ── Buses circulaires en béton — abaque 1 ──────────────────────────────────────────────
  { key: 101, id: 'PipeConcreteSquareEdgeHeadwall', shape: 'circular', material: 'béton',
    label: 'Bout droit avec mur de tête, arête vive', detail: "extrémité sciée droite, arête d'entrée vive",
    chart: 1, scale: 1, scaleLabel: '1', form: 1, K: 0.0098, M: 2.00, C: 0.0398, Y: 0.67, KSlope: -0.50, Ke: 0.50 },
  { key: 102, id: 'PipeConcreteGrooveEndHeadwall', shape: 'circular', material: 'béton',
    label: 'Emboîtement femelle avec mur de tête', detail: 'about femelle du tuyau conservé, encastré dans le mur de tête',
    chart: 1, scale: 2, scaleLabel: '2', form: 1, K: 0.0018, M: 2.00, C: 0.0292, Y: 0.74, KSlope: -0.50, Ke: 0.20 },
  { key: 103, id: 'PipeConcreteGrooveEndProjecting', shape: 'circular', material: 'béton',
    label: 'Emboîtement femelle en saillie', detail: 'about femelle en saillie hors du remblai, sans mur de tête',
    chart: 1, scale: 3, scaleLabel: '3', form: 1, K: 0.0045, M: 2.00, C: 0.0317, Y: 0.69, KSlope: -0.50, Ke: 0.20 },

  // ── Buses circulaires en métal ondulé — abaque 2 ───────────────────────────────────────
  { key: 201, id: 'PipeCorrugatedHeadwall', shape: 'circular', material: 'métal ondulé',
    label: 'Métal ondulé avec mur de tête', detail: 'extrémité droite encastrée dans un mur de tête',
    chart: 2, scale: 1, scaleLabel: '1', form: 1, K: 0.0078, M: 2.00, C: 0.0379, Y: 0.69, KSlope: -0.50, Ke: 0.50 },
  { key: 202, id: 'PipeCorrugatedMitered', shape: 'circular', material: 'métal ondulé',
    label: 'Entrée coupée suivant le talus', detail: 'extrémité biseautée au profil du talus — Kpente positif',
    chart: 2, scale: 2, scaleLabel: '2', form: 1, K: 0.0210, M: 1.33, C: 0.0463, Y: 0.75, KSlope: +0.70, Ke: 0.70 },
  { key: 203, id: 'PipeCorrugatedProjecting', shape: 'circular', material: 'métal ondulé',
    label: 'Extrémité en saillie', detail: 'buse en saillie hors du remblai, sans mur de tête',
    chart: 2, scale: 3, scaleLabel: '3', form: 1, K: 0.0340, M: 1.50, C: 0.0553, Y: 0.54, KSlope: -0.50, Ke: 0.90 },

  // ── Buses à bague d'entrée biseautée — abaque 3 ────────────────────────────────────────
  { key: 301, id: 'PipeBeveledRing45', shape: 'circular', material: 'béton',
    label: 'Bague biseautée à 45°', detail: "bague d'entrée, biseau à 45° de largeur b = 0,042 D",
    chart: 3, scale: 1, scaleLabel: 'A', form: 1, K: 0.0018, M: 2.50, C: 0.0300, Y: 0.74, KSlope: -0.50, Ke: 0.20 },
  { key: 302, id: 'PipeBeveledRing337', shape: 'circular', material: 'béton',
    label: 'Bague biseautée à 33,7°', detail: "bague d'entrée, biseau à 33,7° de largeur b = 0,083 D",
    chart: 3, scale: 2, scaleLabel: 'B', form: 1, K: 0.0018, M: 2.50, C: 0.0243, Y: 0.83, KSlope: -0.50, Ke: 0.20 },
].map(o => Object.freeze(o)));

/** Entrée par défaut d'une forme (CulvertInletCatalog.DefaultFor) : dalot = ailes à 45° (4) ; buse = abaque 1 échelle 1 (101). */
export const DEFAULT_INLET = Object.freeze({ box: 4, circular: 101 });

/** Diamètres courants des buses préfabriquées (m) — CulvertSizing.StandardDiameters. */
export const PIPE_DIAMETERS = Object.freeze([0.60, 0.80, 1.00, 1.20, 1.50, 1.80, 2.00, 2.50, 3.00]);

/**
 * Gammes de recherche des dalots (CulvertSizing.ProposeAll) : pas B = 1 m, pas H = 0,5 m, H ≤ B ≤ H + 2 m.
 * `primary` = premier essai de l'application BVTrace, `fallback` = second essai si rien ne passe
 * (HydraulicWindow / CulvertSitingRunner).
 */
export const BOX_SIZING_RANGES = Object.freeze({
  widthStep: 1.0,
  heightStep: 0.5,
  maxWidthOverHeight: 2.0,       // B ≤ H + 2 m
  primary: Object.freeze({ maxCells: 12, maxB: 4, maxH: 4.5, minB: 1.0, minH: 1.5 }),
  fallback: Object.freeze({ maxCells: 16, maxB: 4, maxH: 5.5, minB: 1.0, minH: 1.5 }),
});

/** Pentes balayées quand la pente de projet est libre (%), toutes multiples de 0,1 %. */
export const FREE_SLOPES_PCT = Object.freeze([0.1, 0.2, 0.3, 0.5, 0.8, 1.0, 1.5]);

/** HydraulicDefaults.cs */
export const HYDRAULIC_DEFAULTS = Object.freeze({
  maxVelocity: 3.00,          // m/s, projet neuf
  legacyMaxVelocity: 3.50,    // m/s, projets antérieurs au schéma 3
  schemaVersion: 4,
});

/**
 * Valeurs par défaut des données d'entrée du moteur (CulvertInput, DownstreamChannel) et constantes
 * du calcul (CulvertCalculator, CulvertSizing). `appSession` rappelle les valeurs que l'application
 * BVTrace injecte par défaut dans une session neuve (HydraulicSessionJson) — à titre d'information.
 */
export const ENGINE_DEFAULTS = Object.freeze({
  StricklerK: 70,             // m^(1/3)/s
  exitLossCoefficient: 1.0,   // K sortie (perte de sortie, contrôle à la sortie)
  maxFillRatioPct: 75,        // %
  maxVelocity: HYDRAULIC_DEFAULTS.maxVelocity,
  minFreeboard: 0,            // m (le moteur ; l'application BVTrace propose 0,50 m)
  upstreamInvert: 0,          // m
  sizingLengthIfMissing: 10,  // m (CulvertSizing.Run / HydraulicInputBuilder)
  weirCoefficient: 1.70,      // Cd du déversoir épais (SI)
  submergenceFactor: 1.0,     // kt du déversoir routier (pas un état de sortie)
  channel: Object.freeze({ bedWidth: 0, sideSlope: 1.5, StricklerK: 30 }),
  maxHeadwaterRatio: 1.2,     // HW/D admissible du dimensionnement (CulvertSizing.MaxHeadwaterRatio)
  g: 9.81,
  xUnsubmerged: 1.93,
  xSubmerged: 2.21,
  depthTolerance: 1e-4,       // m
  appSession: Object.freeze({ StricklerK: 70, exitLossCoefficient: 1.0, minFreeboard: 0.5, maxVelocity: 3.00, weirCoefficient: 1.70 }),
});
