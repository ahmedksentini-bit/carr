// Lien entre la classification de la NF P11-300 (septembre 1992, reprise par le GTR de 1992 et
// sa 2e édition de 2000 — « GTR 2000 » dans le guide) et la classification 2024 alignée sur la
// NF EN 16907-2 (GTR 2024, fascicule 1, annexe 2, p. 107). Portage de Gtr2024LegacyMapping de
// Burmister-Calc.
//
// Deux usages : relire une étude ancienne avec la nomenclature actuelle, et relier le module
// Sols aux catalogues étrangers — Sénégal, Tunisie, Côte d'Ivoire — qui citent encore la
// NF P11-300. La correspondance n'est pas bijective : un ancien code mène souvent à plusieurs
// classes 2024, que seul un essai supplémentaire départage (`discriminant` dit lequel).

import { memeNom } from "./justification.js";

export const REFERENCE_CORRESPONDANCE =
  "GTR 2024 (IDRRIM/Cerema), fascicule 1, annexe 2 « Lien entre classification GTR 2000 et "
  + "norme européenne » (p. 107) ; modifications listées au § 2.5.1 (p. 44)";

/**
 * Avertissement central de l'annexe : sur les matériaux rocheux, le CHIFFRE a changé de sens.
 * En 2000 il désignait la nature pétrographique ; en 2024 il désigne la résistance, et c'est la
 * lettre qui porte la nature.
 */
export const AVERTISSEMENT_NUMEROTATION_ROCHES =
  "Attention au piège des matériaux rocheux : dans le GTR 2000, le chiffre de R1 à R6 "
  + "désignait la nature pétrographique (R1 craies, R2 calcaires, R3 roches argileuses…). "
  + "En 2024, le chiffre désigne la classe de résistance (R1 extrêmement dure à R5 "
  + "fragmentable) et c'est la lettre qui porte la nature (Li, Cl, Sa, Co, Vo, Me). "
  + "Un « R3 » d'une étude ancienne n'a donc pas le même sens qu'un « R3 » d'aujourd'hui.";

/** Second piège, plus discret : les sols blocailleux ont vu leurs numéros s'inverser. */
export const AVERTISSEMENT_NUMEROTATION_BLOCAILLEUX =
  "Les sols blocailleux ont vu leur numérotation s'inverser : le C2 du GTR 2000 (matériau très "
  + "charpenté) devient VC1, et le C1 (peu charpenté) devient VC2.";

// ─────────────────────────────── Seuils déplacés ───────────────────────────────

/** Les six changements de la refonte : { parametre, avant (GTR 2000), apres (GTR 2024), consequence }. */
export const SEUILS_DEPLACES = [
  { parametre: "Tamisat de référence des fines", avant: "80 µm", apres: "63 µm",
    consequence: "Les pourcentages de fines des deux classifications ne sont pas mesurés sur le même tamis : "
      + "ils ne se comparent pas directement." },
  { parametre: "Dmax séparant sols et sols blocailleux", avant: "50 mm", apres: "63 mm",
    consequence: "Un sol de Dmax compris entre 50 et 63 mm était blocailleux (classe C) et devient un sol "
      + "ordinaire (F, I, S ou G)." },
  { parametre: "Limite de l'indice de plasticité entre A2 et A3", avant: "Ip = 25", apres: "Ip = 22",
    consequence: "Un sol d'Ip compris entre 22 et 25 était un A2 et devient un F3." },
  { parametre: "Tamisat séparant sols intermédiaires et sols sableux ou graveleux",
    avant: "12 % à 80 µm", apres: "15 % à 63 µm",
    consequence: "Un sol de 12 à 15 % de fines était un B5 ou B6 et devient un S3/S4 ou G3/G4." },
  { parametre: "Coefficient d'uniformité Cu", avant: "non utilisé au premier niveau",
    apres: "Cu = 6, granulométrie étalée ou uniforme",
    consequence: "C'est le paramètre nouveau : il dédouble chaque ancienne classe de sable ou de grave, "
      + "et aucune étude antérieure ne le fournit." },
  { parametre: "Symboles", avant: "A, B, C, D, R (français)", apres: "F, I, S, G, VC, R (termes anglais)",
    consequence: "F = fine soil, I = intermediate soil, S = sand, G = gravel, VC = very coarse soil." },
];

// ─────────────────────────────── Correspondances ───────────────────────────────

const lien = (ancienne, nouvelles, discriminant = null, note = null) => ({
  ancienne, nouvelles, discriminant, note,
  /** Vrai quand l'ancien code ne suffit pas à désigner une classe 2024 unique. */
  ambigue: nouvelles.length > 1,
  libelle: nouvelles.join(" ou "),
});

const DISCRIMINANT_CU =
  "Cu : granulométrie étalée (Cu ≥ 6) pour l'indice 1 ou 3, uniforme (Cu < 6) pour 2 ou 4. "
  + "Le GTR 2000 ne mesurait pas ce paramètre.";

const DISCRIMINANT_FINES =
  "Tamisat à 63 µm : au-delà de 15 % le sol est intermédiaire (I), entre 5 et 15 % il porte "
  + "l'indice 3 ou 4, en deçà de 5 % l'indice 1 ou 2.";

/** Sols : { ancienne, nouvelles, discriminant, note, ambigue, libelle }. */
export const CORRESPONDANCES_SOLS = [
  // Sols fins
  lien("A1", ["F1"]),
  lien("A2", ["F2"], null,
    "La limite avec la classe suivante passe de Ip = 25 à Ip = 22 : un sol d'Ip compris "
    + "entre 22 et 25 devient un F3."),
  lien("A3", ["F3"]),
  lien("A4", ["F4", "F4+"], "Ip : F4 jusqu'à 55, F4+ au-delà.",
    "La classe F4+ (Ip > 55) est nouvelle : le GTR 2000 ne distinguait pas les argiles les "
    + "plus plastiques."),

  // Sols intermédiaires et sols sableux ou graveleux peu argileux
  lien("B1", ["S1", "S2", "S3", "S4"], DISCRIMINANT_CU + " " + DISCRIMINANT_FINES,
    "Sables silteux : 0,1 < VBS ≤ 0,2 et moins de 12 % de fines."),
  lien("B2", ["S1", "S2", "S3", "S4"], DISCRIMINANT_CU + " " + DISCRIMINANT_FINES,
    "Sables argileux : VBS > 0,2 et moins de 12 % de fines."),
  lien("B3", ["G1", "G2", "G3", "G4"], DISCRIMINANT_CU + " " + DISCRIMINANT_FINES,
    "Graves silteuses : 0,1 < VBS ≤ 0,2 et moins de 12 % de fines."),
  lien("B4", ["G1", "G2", "G3", "G4"], DISCRIMINANT_CU + " " + DISCRIMINANT_FINES,
    "Graves argileuses : VBS > 0,2 et moins de 12 % de fines."),
  lien("B5", ["I1", "S3", "S4", "G3", "G4"], DISCRIMINANT_FINES + " " + DISCRIMINANT_CU,
    "Sables et graves très silteux (VBS ≤ 1,5). Au-delà de 15 % de fines ils deviennent I1 ; "
    + "entre 12 et 15 % ils basculent en S3/S4 ou G3/G4 du fait du changement de seuil."),
  lien("B6", ["I2", "S3", "S4", "G3", "G4"], DISCRIMINANT_FINES + " " + DISCRIMINANT_CU,
    "Sables et graves argileux à très argileux (VBS > 1,5). Même bascule de seuil que B5."),

  // Sols insensibles à l'eau
  lien("D1", ["S1ins", "S2ins", "S3ins", "S4ins"], DISCRIMINANT_CU + " " + DISCRIMINANT_FINES,
    "Sables insensibles à l'eau (VBS ≤ 0,1). Le suffixe « ins » remplace la classe D."),
  lien("D2", ["G1ins", "G2ins", "G3ins", "G4ins"], DISCRIMINANT_CU + " " + DISCRIMINANT_FINES,
    "Graves insensibles à l'eau (VBS ≤ 0,1). Le suffixe « ins » remplace la classe D."),
  lien("D3", ["VC1", "VC2"], "Part de la fraction 0/63 mm : VC1 en deçà de 60 à 80 %, VC2 au-delà.",
    "Matériaux blocailleux insensibles à l'eau : ils rejoignent les classes VC avec le "
    + "suffixe « ins » sur leur fraction 0/63 mm."),

  // Sols blocailleux : la numérotation s'inverse
  lien("C1", ["VC2"], null,
    "Matériaux roulés et anguleux peu charpentés : fraction 0/50 mm supérieure à 60-80 % "
    + "en 2000, fraction 0/63 mm supérieure à 60-80 % en 2024. Le numéro s'inverse."),
  lien("C2", ["VC1"], null,
    "Matériaux roulés et anguleux très charpentés : fraction 0/50 mm inférieure ou égale à "
    + "60-80 % en 2000, fraction 0/63 mm en 2024. Le numéro s'inverse."),
];

/** Matériaux rocheux : le chiffre de 2000 désignait la nature, il désigne la résistance en 2024. */
export const CORRESPONDANCES_ROCHES = [
  lien("R1", ["CH"], null, "Craies (roches sédimentaires carbonatées)."),
  lien("R2", ["Li"], null, "Calcaires (roches sédimentaires carbonatées)."),
  lien("R3", ["Cl"], null, "Roches argileuses : marnes, argilites, pélites."),
  lien("R4", ["Sa", "Co"], "Nature : Sa pour les grès, Co pour les brèches, poudingues et conglomérats.",
    "Roches sédimentaires siliceuses."),
  lien("R5", ["SR"], null, "Roches salines : sel gemme, gypse. Notées « Sr » dans l'annexe 2, « SR » dans l'annexe 1."),
  lien("R6", ["Vo", "Me"], "Origine : Vo pour les roches magmatiques, Me pour les roches métamorphiques.",
    "Granites, basaltes, trachytes et andésites d'un côté ; gneiss, schistes métamorphiques "
    + "et schistes ardoisiers de l'autre."),
];

/** Toutes les correspondances, sols et roches confondus. */
export const CORRESPONDANCES = [...CORRESPONDANCES_SOLS, ...CORRESPONDANCES_ROCHES];

/** Ce que devient une classe du GTR 2000 (casse indifférente) ; null si le code est inconnu. */
export const depuisAncienneClasse = (code) => CORRESPONDANCES.find((m) => memeNom(m.ancienne, code)) ?? null;

/**
 * Racine comparable d'une classe 2024 : on retire l'état hydrique et la sous-classe mécanique,
 * on conserve le suffixe « ins » qui, lui, portait une classe à part entière en 2000 (les D).
 */
export function racine2024(classe) {
  let s = String(classe).trim();
  const insensible = s.toLowerCase().endsWith("ins");
  if (insensible) s = s.slice(0, -3);

  // État hydrique accolé : « F2m », « G31s », « CH3 h ».
  for (const suffixe of ["ts", "th", "m", "h", "s"]) {
    if (s.length > 2 && s.endsWith(suffixe)) {
      s = s.slice(0, -suffixe.length).trimEnd();
      break;
    }
  }

  // Sous-classe mécanique des sables et des graves : « S31 » → « S3 », « G12 » → « G1 ».
  if (s.length === 3 && (s[0] === "S" || s[0] === "G") && /\d/.test(s[1]) && /\d/.test(s[2])) s = s.slice(0, 2);

  return insensible ? s + "ins" : s;
}

/**
 * Classes du GTR 2000 qui pouvaient donner une classe 2024. Le lien est recherché sur la racine
 * de la classe : « G31 » se rattache à « G3 », et le suffixe « ins » est significatif.
 */
export function anciennesClasses(classe2024) {
  if (classe2024 == null || String(classe2024).trim() === "") return [];
  const r = racine2024(classe2024);
  return CORRESPONDANCES.filter((m) => m.nouvelles.some((c) => memeNom(c, r))).map((m) => m.ancienne);
}

/**
 * Correspondance à afficher pour un sol classé : les anciens codes possibles, et la réserve qui
 * les accompagne quand la correspondance n'est pas univoque. Chaîne vide si aucune.
 */
export function decrireCorrespondance(classe2024) {
  const anciennes = anciennesClasses(classe2024);
  if (anciennes.length === 0) return "";
  const codes = anciennes.join(" ou ");
  return anciennes.length === 1
    ? `Correspondance GTR 2000 : ${codes}.`
    : `Correspondance GTR 2000 : ${codes} — plusieurs anciennes classes aboutissent à celle-ci.`;
}
