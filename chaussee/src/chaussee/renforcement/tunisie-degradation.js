// Relevés de surface du fascicule 6 tunisien (portage de TunisiaDegradation de
// Burmister-Calc) : fissuration (tableau 1), orniérage (tableau 2) et leur
// croisement en classe de dégradation (tableau 3). Cette classe est l'un des
// deux termes de l'indicateur global Cli — l'autre étant la déflexion — et donc
// du dommage forfaitaire.
//
// Notes de fissuration tunisiennes "F1" … "F3" (étendue, toutes gravités
// confondues) : à ne pas confondre avec les classes F1 à F5 du Cerema, qui
// servent à choisir un module forfaitaire. Orniérage "O1" … "O3". Classes de
// dégradation "CH1" … "CH4".

import { nf } from "./format.js";

export const REFERENCE_DEGRADATION_TUNISIE = "Catalogue Tunisie RevA, fascicule 6, tableaux 1, 2 et 3 (p. imprimées 327-328)";

export const NOTES_FISSURATION_TUNISIE = Object.freeze(["F1", "F2", "F3"]);
export const NOTES_ORNIERAGE_TUNISIE = Object.freeze(["O1", "O2", "O3"]);
export const CLASSES_DEGRADATION_TUNISIE = Object.freeze(["CH1", "CH2", "CH3", "CH4"]);

/**
 * Note de fissuration d'après l'étendue cumulée du faïençage et des fissures
 * longitudinales (%). Les fissures dans les bandes de roulement comptent plus
 * lourd : 15 % dans les traces de roues valent F2, quand il en faut 30 % ailleurs.
 */
export function noteFissuration(pourcent, dansBandesRoulement) {
  if (dansBandesRoulement) return pourcent < 10 ? "F1" : pourcent <= 30 ? "F2" : "F3";
  return pourcent <= 30 ? "F1" : pourcent <= 50 ? "F2" : "F3";
}

export const SILENCE_FISSURATION =
  "Sous 20 % de fissures non spécifiques aux bandes de roulement, le tableau ne se prononce "
  + "pas : ces cas sont rangés en F1 par interprétation, la classe la plus favorable.";

/**
 * Note de déformation d'après l'étendue de l'orniérage (%) et sa profondeur
 * (mm). La profondeur prime : au-delà de 20 mm, la note est O3 quelle que soit
 * l'étendue.
 */
export function noteOrnierage(pourcentEtendue, profondeurMm) {
  if (profondeurMm > 20) return "O3";
  return pourcentEtendue <= 10 ? "O1" : pourcentEtendue <= 30 ? "O2" : "O3";
}

/** Le tableau ne compte les déformations qu'à partir de 10 mm de profondeur. */
export const SEUIL_ORNIERAGE_MM = 10;

export const SILENCE_ORNIERAGE =
  "Le tableau ne s'ouvre qu'à partir de 10 mm de profondeur d'ornière : en deçà, l'orniérage "
  + "n'est pas compté comme une dégradation structurelle. Au-delà de 20 mm, la note est O3 "
  + "quelle que soit l'étendue.";

const TABLEAU_3 = {
  F1: { O1: "CH1", O2: "CH2", O3: "CH3" },
  F2: { O1: "CH2", O2: "CH2", O3: "CH3" },
  F3: { O1: "CH3", O2: "CH3", O3: "CH4" },
};

/** Classe de dégradation, croisement de la note de fissuration et de la note de déformation (tableau 3). */
export const classeDegradation = (fissuration, ornierage) => TABLEAU_3[fissuration]?.[ornierage] ?? "CH4";

/** Comportement associé, tel que l'indicateur global le consomme : CH3 et CH4 sont « mauvais ». */
export const niveauDegradation = (classe) => (classe === "CH1" ? "bon" : classe === "CH2" ? "moyen" : "mauvais");

export function nomClasseDegradation(classe) {
  if (classe === "CH1") return "CH1 — bon comportement";
  if (classe === "CH2") return "CH2 — comportement moyen";
  if (classe === "CH3") return "CH3 — mauvais comportement";
  return "CH4 — mauvais comportement, fissuration et déformations importantes";
}

/**
 * Le chemin complet, du relevé de surface à la classe de dégradation, avec la
 * trace de chaque étape : { classe, etapes }.
 */
export function classerDegradationTunisie(fissurationPourcent, dansBandesRoulement, ornieragePourcent, profondeurOrniereMm) {
  const f = noteFissuration(fissurationPourcent, dansBandesRoulement);
  const o = noteOrnierage(ornieragePourcent, profondeurOrniereMm);
  const classe = classeDegradation(f, o);
  const etapes = [
    `Fissuration ${nf(fissurationPourcent, 1)} % `
      + (dansBandesRoulement ? "dans les bandes de roulement" : "non spécifique aux bandes de roulement")
      + ` → ${f}`,
    `Orniérage ${nf(ornieragePourcent, 1)} % du linéaire, profondeur ${nf(profondeurOrniereMm, 1)} mm → ${o}`,
    `${f} × ${o} → ${nomClasseDegradation(classe)}`,
  ];
  if (profondeurOrniereMm > 20)
    etapes.push("Profondeur supérieure à 20 mm : la note de déformation est O3 quelle que soit l'étendue.");
  return { classe, etapes };
}
