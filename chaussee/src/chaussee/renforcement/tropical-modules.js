// Modules résiduels de l'ancienne chaussée (portage de TropicalResidualModuli
// de Burmister-Calc) — manuel CEBTP/LCPC 1985 pour le renforcement des
// chaussées souples en pays tropicaux, § 1.2 et § 1.3 (pages 155 et 157).
//
// Ce manuel ne procède PAS par tableau à double entrée : il donne des
// fourchettes assorties d'une valeur d'usage (« 2 ≤ E₂/E₃ ≤ 4 et on choisit
// E₂/E₃ = 2 », « E = k × CBR, 50 < k < 100, on prend généralement k = 50 »).
// Chaque règle expose donc ses bornes en plus de sa valeur retenue. Il couvre
// la Côte d'Ivoire, dont les manuels nationaux ne traitent pas le renforcement.
//
// État d'un matériau bitumineux : "sain" | "degrade" | "faiencage" (faïençages importants).

export const REFERENCE_TROPICAL_MODULES =
  "Manuel pour le renforcement des chaussées souples en pays tropicaux, CEBTP/LCPC 1985 — "
  + "§ 1.2 « Modélisation de l'ancienne chaussée » (p. 155) et § 1.3 « Caractéristiques des "
  + "matériaux » (p. 157)";

export const RESERVE_FOURCHETTES =
  "Le manuel tropical raisonne par fourchettes, pas par tableau : il donne des bornes et une "
  + "valeur d'usage. Les valeurs proposées ici sont celles qu'il recommande de retenir ; les "
  + "bornes restent affichées, parce que le choix appartient au projeteur.";

export const ETATS_TROPICAUX = Object.freeze(["sain", "degrade", "faiencage"]);

// ──────────────────────────────── Support ─────────────────────────────────

/** Bornes du coefficient k de la corrélation E = k × CBR. */
export const K_SOL_MIN = 50;
export const K_SOL_MAX = 100;
/** Valeur d'usage : « on prend généralement k = 50 ». */
export const K_SOL_USUEL = 50;

/** Module du sol support (MPa) : E = k × CBR, k = 50 par défaut. */
export const moduleSolTropical = (cbr, k = K_SOL_USUEL) => k * cbr;

/** Coefficient de Poisson du support et des granulaires : 0,35 à 0,50. */
export const POISSON_NON_LIE_MIN = 0.35;
export const POISSON_NON_LIE_MAX = 0.50;

// ─────────────────────────────── Granulaires ──────────────────────────────

/** Bornes du rapport E₂/E₃ entre une couche granulaire et son support. */
export const RAPPORT_GRANULAIRE_TROPICAL_MIN = 2;
export const RAPPORT_GRANULAIRE_TROPICAL_MAX = 4;
/** Valeur retenue par le manuel : « on choisit E₂/E₃ = 2 ». */
export const RAPPORT_GRANULAIRE_TROPICAL = 2;

/** Module d'une couche granulaire (MPa), depuis celui de la couche sous-jacente. */
export const moduleGranulaireTropical = (dessous, rapport = RAPPORT_GRANULAIRE_TROPICAL) => rapport * dessous;

export const NOTE_GRANULAIRE_TROPICAL =
  "« Le module d'une couche granulaire est lié à celui des couches sous-jacentes. On choisit "
  + "couramment 2 E₃ ≤ E₂ ≤ 4 E₃. » Le manuel retient 2. Les limites admissibles des "
  + "granulaires sont celles des sols : le manuel n'en donne pas d'autres.";

// ─────────────────────────────── Bitumineux ───────────────────────────────

/** Grave-bitume aux conditions tropicales, exemple du manuel : 40 000 bars à 30 °C et 10 Hz (MPa). */
export const GRAVE_BITUME_TROPICALE_MPA = 4000;

/** Faïençages importants : « on adopte par exemple E = 20 000 bars » (MPa). */
export const MODULE_FAIENCAGE_MPA = 2000;

/**
 * Module d'un matériau bitumineux en place : { valeur (MPa), encadre }. Pour un
 * matériau DÉGRADÉ, le manuel ne donne qu'un encadrement (« entre celui d'une
 * grave non traitée et celui d'un matériau non dégradé ») : la moyenne des deux
 * bornes est retenue et `encadre` le signale — c'est une interpolation du
 * logiciel, pas une prescription du manuel.
 */
export function moduleBitumineuxTropical(etat, moduleSain, moduleGranulaire) {
  if (etat === "sain") return { valeur: moduleSain, encadre: false };
  if (etat === "faiencage") return { valeur: MODULE_FAIENCAGE_MPA, encadre: false };
  return { valeur: 0.5 * (moduleGranulaire + moduleSain), encadre: true };
}

/** Bornes de l'encadrement d'un matériau dégradé : { bas, haut }. */
export const encadrementDegrade = (moduleSain, moduleGranulaire) =>
  ({ bas: Math.min(moduleGranulaire, moduleSain), haut: Math.max(moduleGranulaire, moduleSain) });

export const NOTE_DEGRADE_TROPICAL =
  "« Pour les matériaux dégradés, cas difficile des structures anciennes, le module est "
  + "compris entre celui d'une grave non traitée et celui d'un matériau non dégradé. » Le "
  + "manuel n'en dit pas plus : la valeur proposée est le milieu de cet encadrement, et c'est "
  + "une interpolation du logiciel, pas une prescription.";

/**
 * Coefficient de Poisson d'un matériau bitumineux selon la température
 * (§ 1.3.3) : 0,30 sous 10 °C, 0,35 vers 15 °C, 0,40 vers 30 °C, 0,50 à 40 °C.
 */
export function poissonBitumineuxTropical(celsius) {
  if (celsius < 10) return 0.30;
  if (celsius < 22.5) return 0.35;
  if (celsius < 35) return 0.40;
  return 0.50;
}
