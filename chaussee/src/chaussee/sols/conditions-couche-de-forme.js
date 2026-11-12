// Conditions d'utilisation en couche de forme, classe par classe et selon la situation
// météorologique (GTR 2024, fascicule 2, annexe 3) — portage de Gtr2024CappingConditions de
// Burmister-Calc. Ces tableaux disent ce qu'on peut faire d'un matériau donné le jour où on le
// met en œuvre — un même sol pouvant être acceptable par temps sec et refusé sous la pluie.
//
// Situations météorologiques : "pluie-forte" (++), "pluie-faible" (+), "neutre" (=),
// "evaporation" (−). Les symboles expriment le SENS dans lequel la teneur en eau du matériau a
// tendance à varier, pas une hauteur de pluie.

import { decrireCodeGwts } from "./acceptation-couche-de-forme.js";
import { memeNom } from "./justification.js";

export const REFERENCE_CONDITIONS =
  "GTR 2024 (IDRRIM/Cerema), fascicule 2, annexe 3 (p. 57-66) ; échelle météorologique "
  + "définie au fascicule 1, § 3.2 (p. 50)";

// ─────────────────────────────── Échelle météorologique ───────────────────────────────

/** Les quatre situations du § 3.2, avec leur symbole, leur libellé et leur sens. */
export const SITUATIONS_METEO = [
  { cle: "pluie-forte", symbole: "++", libelle: "pluie forte",
    sens: "la situation accroît la teneur en eau du matériau de manière brutale et imprévisible" },
  { cle: "pluie-faible", symbole: "+", libelle: "pluie faible",
    sens: "la situation accroît la teneur en eau de manière lente et relativement prévisible" },
  { cle: "neutre", symbole: "=", libelle: "ni pluie ni évaporation importante",
    sens: "la situation n'a pas d'action sensible sur la teneur en eau du matériau" },
  { cle: "evaporation", symbole: "−", libelle: "évaporation importante",
    sens: "la situation diminue la teneur en eau, de façon relativement prévisible sous les climats français" },
];

const meteo = (cle) => SITUATIONS_METEO.find((m) => m.cle === cle) ?? null;
export const symboleMeteo = (cle) => meteo(cle)?.symbole ?? null;
export const libelleMeteo = (cle) => meteo(cle)?.libelle ?? null;
export const sensMeteo = (cle) => meteo(cle)?.sens ?? null;
/** « ++ — pluie forte ». */
export const afficherMeteo = (cle) => `${symboleMeteo(cle)} — ${libelleMeteo(cle)}`;

/**
 * Mise en garde que le guide attache lui-même à ces symboles, et qu'il ne faut pas taire : ils ne
 * se ramènent à aucun seuil mesurable.
 */
export const MISE_EN_GARDE_METEO =
  "Ces symboles ne correspondent pas à des seuils quantifiables (hauteur ou intensité de pluie) : "
  + "les effets de la pluie ne sont indépendants ni du vent, ni de la température, ni du sol "
  + "lui-même. C'est au géotechnicien du chantier de caractériser la situation météorologique au "
  + "moment de la mise en œuvre.";

// ─────────────────────────────── Lignes de l'annexe 3 ───────────────────────────────

const SANS_MAITRISE_HYDRIQUE =
  "Situation météorologique ne garantissant pas une maîtrise suffisante de l'état hydrique "
  + "du mélange sol + liant(s).";

const SANS_MISE_EN_OEUVRE =
  "Situation météorologique ne permettant pas une mise en œuvre correcte.";

const SEC = ["neutre", "evaporation"];
const PLUIE = ["pluie-forte", "pluie-faible"];
const FAIBLE = ["pluie-faible"];

/**
 * Une cellule de l'annexe 3 : pour un groupe de classes et une ou plusieurs situations
 * météorologiques, la conduite à tenir en couche de forme et son code GWTS. Le code est
 * reconstitué à partir des actions listées par le guide ; `codeImprimeDiffere` signale le cas où
 * le code imprimé n'y correspond pas — mieux vaut le dire que choisir en silence.
 */
function ligne(groupe, classes, situations, utilisable, { G = 0, W = 0, T = 0, S = 0, solution = null, codeImprime = null, motif = null } = {}) {
  const code = utilisable ? `${G}${W}${T}${S}` : "NON";
  return {
    groupe, classes, situations, utilisable, G, W, T, S, solution, codeImprime, motif, code,
    codeImprimeDiffere: codeImprime != null && codeImprime !== code,
    actions: decrireCodeGwts(code),
    libelleSituations: situations.map(symboleMeteo).join(" ou "),
  };
}

const VC_RESISTANTS = [
  "VC2S11ins", "VC2S21ins", "VC2S31ins", "VC2S41ins", "VC2G11ins", "VC2G21ins", "VC2G31ins", "VC2G41ins",
  "VC1S11ins", "VC1S21ins", "VC1S31ins", "VC1S41ins", "VC1G11ins", "VC1G21ins", "VC1G31ins", "VC1G41ins",
];
const VC_FRIABLES = [
  "VC2S12ins", "VC2S22ins", "VC2S32ins", "VC2S42ins", "VC2G12ins", "VC2G22ins", "VC2G32ins", "VC2G42ins",
  "VC1S12ins", "VC1S22ins", "VC1S32ins", "VC1S42ins", "VC1G12ins", "VC1G22ins", "VC1G32ins", "VC1G42ins",
];
const ROCHES_DURES = ["R1 Vo", "R2 Vo", "R3 Vo", "R3 Li", "R3 Sa", "R3 Co"];
const R4_VC1 = ["R4 Li VC1", "R4 Sa VC1", "R4 Co VC1", "R4 Vo VC1"];
const R4_AUTRES = ["R4 Li", "R4 Sa", "R4 Co", "R4 Vo"];
const ME_DURES = ["R1 Me", "R2 Me", "R3 Me"];

/** Toutes les lignes de l'annexe 3. */
export const CONDITIONS_COUCHE_DE_FORME = [
  // ---------------------------------------------------------- Sols fins
  ligne("F1", ["F1"], FAIBLE, false, { motif: SANS_MAITRISE_HYDRIQUE }),
  ligne("F1", ["F1"], SEC, true, { W: 1, T: 2, S: 2, codeImprime: "0122" }),

  ligne("F2", ["F2"], FAIBLE, false, { motif: SANS_MAITRISE_HYDRIQUE }),
  ligne("F2", ["F2"], ["neutre"], true, { W: 1, T: 2, S: 2, codeImprime: "0122" }),

  ligne("F3", ["F3"], ["pluie-forte"], false, { motif: SANS_MAITRISE_HYDRIQUE }),
  ligne("F3", ["F3"], ["pluie-faible", "neutre"], true, { W: 1, T: 3, S: 2, solution: "Solution 1", codeImprime: "0132" }),
  ligne("F3", ["F3"], ["pluie-faible", "neutre"], true, { W: 1, T: 4, S: 2, solution: "Solution 2 — chaux seule", codeImprime: "0142" }),
  ligne("F3", ["F3"], ["evaporation"], false,
    { motif: SANS_MAITRISE_HYDRIQUE + " À l'état sec, l'humidification homogène est difficile." }),

  // ---------------------------------------------------------- Sols intermédiaires
  ligne("I1", ["I1"], FAIBLE, false, { motif: SANS_MAITRISE_HYDRIQUE }),
  ligne("I1", ["I1"], SEC, true, { W: 1, T: 2, S: 1, codeImprime: "0121" }),

  ligne("I2", ["I2"], FAIBLE, false, { motif: SANS_MAITRISE_HYDRIQUE }),
  ligne("I2", ["I2"], SEC, true, { W: 1, T: 3, S: 1, codeImprime: "0131" }),

  // ---------------------------------------------------------- Sables
  ligne("S…1ins", ["S11ins", "S21ins", "S31ins", "S41ins"], FAIBLE, true,
    { codeImprime: "0000", solution: "Utilisation en l'état" }),
  ligne("S…1ins", ["S11ins", "S21ins", "S31ins", "S41ins"], SEC, true,
    { W: 1, T: 5, S: 2, solution: "Solution 1 — traitement", codeImprime: "0152" }),
  ligne("S…1ins", ["S11ins", "S21ins", "S31ins", "S41ins"], SEC, true,
    { solution: "Solution 2 — utilisation en l'état", codeImprime: "0000" }),

  ligne("S…1", ["S11", "S21", "S31", "S41"], FAIBLE, false, { motif: SANS_MAITRISE_HYDRIQUE }),
  ligne("S…1", ["S11", "S21", "S31", "S41"], SEC, true, { W: 1, T: 1, S: 2, codeImprime: "0112" }),

  ligne("S…2ins", ["S12ins", "S22ins", "S32ins", "S42ins"], FAIBLE, false, { motif: SANS_MISE_EN_OEUVRE }),
  ligne("S…2ins", ["S12ins", "S22ins", "S32ins", "S42ins"], SEC, true, { W: 1, T: 5, S: 2, codeImprime: "0152" }),

  ligne("S…2", ["S12", "S22", "S32", "S42"], FAIBLE, false, { motif: SANS_MAITRISE_HYDRIQUE }),
  ligne("S…2", ["S12", "S22", "S32", "S42"], SEC, true, { W: 1, T: 1, S: 2, codeImprime: "0112" }),

  // ---------------------------------------------------------- Graves
  ligne("G…1ins", ["G11ins", "G21ins", "G31ins", "G41ins"], PLUIE, true,
    { codeImprime: "0000", solution: "Utilisation en l'état" }),
  ligne("G…1ins", ["G11ins", "G21ins", "G31ins", "G41ins"], SEC, true,
    { solution: "Solution 1 — utilisation en l'état", codeImprime: "0000" }),
  ligne("G…1ins", ["G11ins", "G21ins", "G31ins", "G41ins"], SEC, true,
    { W: 1, T: 1, S: 1, solution: "Solution 2 — traitement", codeImprime: "0111" }),

  ligne("G…1", ["G11", "G21", "G31", "G41"], FAIBLE, false, { motif: SANS_MISE_EN_OEUVRE }),
  ligne("G…1", ["G11", "G21", "G31", "G41"], SEC, true, { W: 1, T: 1, S: 1, codeImprime: "0111" }),

  ligne("G…2ins", ["G12ins", "G22ins", "G32ins", "G42ins"], FAIBLE, false, { motif: SANS_MISE_EN_OEUVRE }),
  ligne("G…2ins", ["G12ins", "G22ins", "G32ins", "G42ins"], SEC, true, { W: 1, T: 1, S: 1, codeImprime: "0111" }),

  ligne("G…2", ["G12", "G22", "G32", "G42"], FAIBLE, false, { motif: SANS_MISE_EN_OEUVRE }),
  ligne("G…2", ["G12", "G22", "G32", "G42"], SEC, true, { W: 1, T: 1, S: 1, codeImprime: "0111" }),

  // ---------------------------------------------------------- Sols blocailleux
  ligne("VC…F1, F2 et I2", ["VC2F1", "VC2F2", "VC2I2", "VC1F1", "VC1F2", "VC1I2"], FAIBLE, false,
    { motif: SANS_MAITRISE_HYDRIQUE }),
  ligne("VC…F1, F2 et I2", ["VC2F1", "VC2F2", "VC2I2", "VC1F1", "VC1F2", "VC1I2"], SEC, true,
    { G: 2, W: 1, T: 2, S: 1, codeImprime: "2121" }),

  ligne("VC…F3", ["VC2F3", "VC1F3"], FAIBLE, false, { motif: SANS_MAITRISE_HYDRIQUE }),
  ligne("VC…F3", ["VC2F3", "VC1F3"], SEC, true,
    { G: 2, W: 1, T: 3, S: 2, solution: "Solution 1 — chaux + ciment", codeImprime: "2132" }),
  ligne("VC…F3", ["VC2F3", "VC1F3"], SEC, true,
    { G: 2, W: 1, T: 4, S: 2, solution: "Solution 2 — chaux seule", codeImprime: "2142" }),

  ligne("VC…S et G résistants (fraction 0/63 insensible)", VC_RESISTANTS, PLUIE, true, { G: 3, codeImprime: "3000" }),
  ligne("VC…S et G résistants (fraction 0/63 insensible)", VC_RESISTANTS, SEC, true,
    { G: 3, solution: "Solution 1 — utilisation en l'état", codeImprime: "3000" }),
  ligne("VC…S et G résistants (fraction 0/63 insensible)", VC_RESISTANTS, SEC, true,
    { G: 2, W: 1, T: 1, S: 1, solution: "Solution 2 — traitement", codeImprime: "2111" }),

  ligne("VC…S et G friables (fraction 0/63 insensible)", VC_FRIABLES, FAIBLE, false, { motif: SANS_MAITRISE_HYDRIQUE }),
  ligne("VC…S et G friables (fraction 0/63 insensible)", VC_FRIABLES, SEC, true,
    { G: 2, W: 1, T: 1, S: 1, codeImprime: "2111" }),

  // ---------------------------------------------------------- Craies
  ligne("CH1 à CH4", ["CH1", "CH2", "CH3", "CH4"], FAIBLE, false,
    { motif: "Situation météorologique ne garantissant pas une exécution correcte du traitement." }),
  ligne("CH1 à CH4", ["CH1", "CH2", "CH3", "CH4"], SEC, true, { G: 5, W: 1, T: 1, S: 2, codeImprime: "5112" }),

  // ---------------------------------------------------------- Roches dures
  ligne("R1 à R3 Vo, R3 Li, R3 Sa, R3 Co", ROCHES_DURES, PLUIE, true, { G: 3, codeImprime: "3000" }),
  ligne("R1 à R3 Vo, R3 Li, R3 Sa, R3 Co", ROCHES_DURES, SEC, true,
    { G: 3, solution: "Solution 1 — utilisation en l'état", codeImprime: "3000" }),
  ligne("R1 à R3 Vo, R3 Li, R3 Sa, R3 Co", ROCHES_DURES, SEC, true,
    { G: 2, W: 1, T: 1, S: 1, solution: "Solution 2 — traitement", codeImprime: "2111" }),

  ligne("R4 Li, Sa, Co, Vo — granulométrie VC1", R4_VC1, PLUIE, true, { G: 4, S: 3, codeImprime: "4003" }),
  ligne("R4 Li, Sa, Co, Vo — granulométrie VC1", R4_VC1, SEC, true,
    { G: 4, S: 3, solution: "Solution 1", codeImprime: "4003" }),
  ligne("R4 Li, Sa, Co, Vo — granulométrie VC1", R4_VC1, SEC, true,
    { G: 2, W: 1, T: 1, S: 1, solution: "Solution 2 — traitement", codeImprime: "2111" }),

  ligne("R4 Li, Sa, Co, Vo — autres granulométries", R4_AUTRES, FAIBLE, false, { motif: SANS_MAITRISE_HYDRIQUE }),
  ligne("R4 Li, Sa, Co, Vo — autres granulométries", R4_AUTRES, SEC, true, { G: 2, W: 1, T: 1, S: 1, codeImprime: "2111" }),

  ligne("R5 Li et R4 Cl", ["R5 Li", "R4 Cl"], FAIBLE, false, { motif: SANS_MAITRISE_HYDRIQUE }),
  ligne("R5 Li et R4 Cl", ["R5 Li", "R4 Cl"], SEC, true, { G: 2, W: 1, T: 1, S: 1, codeImprime: "2111" }),

  ligne("R1 à R3 Me", ME_DURES, FAIBLE, false, { motif: SANS_MISE_EN_OEUVRE }),
  ligne("R1 à R3 Me", ME_DURES, SEC, true, { G: 4, S: 1, solution: "Solution 1", codeImprime: "4001" }),
  // Seule cellule incohérente du guide : la solution liste un traitement, le code imprimé porte T = 0.
  ligne("R1 à R3 Me", ME_DURES, SEC, true,
    { G: 2, W: 1, T: 1, S: 1, solution: "Solution 2 — traitement", codeImprime: "2101" }),

  ligne("R4 Me", ["R4 Me"], FAIBLE, false, { motif: SANS_MISE_EN_OEUVRE }),
  ligne("R4 Me", ["R4 Me"], SEC, true, { G: 4, W: 1, T: 0, S: 1, codeImprime: "4101" }),
];

/**
 * Classes que l'annexe 3 déclare normalement inutilisables en couche de forme, avec le motif que
 * le guide en donne.
 */
export const INUTILISABLES = {
  F4: "Sols normalement inutilisables en couche de forme.",
  VC2F3s: "Sols normalement inutilisables en couche de forme.",
  VC1F3s: "Sols normalement inutilisables en couche de forme.",
  VC2F4: "Sols normalement inutilisables en couche de forme.",
  VC1A4: "Sols normalement inutilisables en couche de forme.",
  "R3 Cl": "Roche normalement inutilisable en couche de forme. En raison de sa dureté, son "
    + "comportement dégradable peut n'apparaître qu'à long terme : l'essai de dégradabilité "
    + "n'est pas totalement adéquat pour caractériser son potentiel d'évolution. L'évaluation "
    + "peut être menée par la poursuite des essais sur un plus grand nombre de cycles (une "
    + "vingtaine au lieu des quatre de la norme). En l'absence d'évolution et sous réserve de "
    + "vérification du LA, on se reportera à la classe R3 Sa, R3 Co ou R3 Li.",
  "R3 Xxd": "Roches normalement inutilisables en couche de forme.",
  "R4 Cld1": "Roches normalement inutilisables en couche de forme.",
  "R4 Cld2": "Roches normalement inutilisables en couche de forme.",
  "R4 Xxd": "Roches normalement inutilisables en couche de forme.",
  SR1: "Roches normalement inutilisables en couche de forme.",
  SR2: "Roches normalement inutilisables en couche de forme.",
  SR3: "Roches normalement inutilisables en couche de forme.",
  SR4: "Roches normalement inutilisables en couche de forme.",
  SR5: "Roches normalement inutilisables en couche de forme.",
};

/**
 * Classes que l'annexe 3 renvoie aux tableaux des sols : roches très friables dont l'emploi suit
 * celui du sol auquel on prévoit qu'elles seront assimilables.
 */
export const RENVOIS_AU_SOL = ["R5 Sa", "R5 Co", "R5 Vo", "R5 Me", "R5 Cl", "AR-A6"];

/**
 * Lignes qui concernent une classe (casse indifférente) ; toutes situations confondues, ou pour
 * la seule situation météorologique donnée.
 */
export function conditionsPour(classe, situation = null) {
  if (classe == null) return [];
  return CONDITIONS_COUCHE_DE_FORME
    .filter((c) => c.classes.some((x) => memeNom(x, classe)))
    .filter((c) => situation == null || c.situations.includes(situation));
}

/** Motif d'inutilisabilité d'une classe (clé exacte, comme dans le guide), null si elle n'est pas exclue. */
export const motifInutilisable = (classe) => (classe != null && Object.hasOwn(INUTILISABLES, classe) ? INUTILISABLES[classe] : null);

/** Vrai quand l'annexe 3 renvoie à la classe de sol équivalente plutôt qu'à ses propres règles. */
export const renvoieAuSol = (classe) => classe != null && RENVOIS_AU_SOL.some((x) => memeNom(x, classe));

/**
 * Racine de classe attendue par ces tableaux : sous-classe mécanique quand elle existe, sinon
 * classe de nature, suivie du suffixe « ins » pour les matériaux insensibles à l'eau. L'état
 * hydrique n'entre pas dans la clé : c'est la situation météorologique qui joue ce rôle ici.
 */
export function racineConditions(c) {
  if (c?.classeNature == null) return "";
  if (c.estBlocailleux) return c.sousFraction == null ? c.classeNature : c.classeNature + racineConditions(c.sousFraction);
  const racine = c.sousClasse ?? c.classeNature;
  return c.insensible ? racine + "ins" : racine;
}

/** Lignes de l'annexe 3 applicables à un sol classé (classerSol), pour une situation donnée. */
export const conditionsPourSol = (c, situation = null) => conditionsPour(racineConditions(c), situation);
