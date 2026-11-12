// Les trois voies vers le dommage déjà consommé (portage de Damage et de
// GlobalConditionIndicator de Burmister-Calc) :
//   "miner"    — cumul de Miner sur les phases de l'historique (Cerema § 2.1.3) ;
//   "forfait"  — forfait d'après l'appréciation globale de l'état (fascicule 6
//                tunisien, tableaux 9 et 10), quand l'historique manque ;
//   "residuel" — vie résiduelle : on inverse la loi d'admissible sur la
//                structure telle qu'elle est aujourd'hui (manuel CEBTP 1985).
//
// La convention la plus facile à manquer : UN ENTRETIEN EFFACE LA DÉFORMATION
// PERMANENTE DES COUCHES NON LIÉES. Pour le sol et les graves non traitées, le
// dommage ne se cumule qu'entre deux séquences de travaux — contrairement aux
// couches liées, dont la fatigue ne s'efface pas.
//
// Niveaux : "bon" | "moyen" | "mauvais". Indicateur global : "Cl1" … "Cl4".

import { nf } from "./format.js";

export const REFERENCE_DOMMAGE =
  "Cerema/IDRRIM 2016, § 2.1.2 à 2.1.3 et § 3.5 ; fascicule 6 tunisien, tableaux 9 et 10 ; "
  + "manuel CEBTP 1985, annexe II";

export const VOIES_DOMMAGE = Object.freeze(["miner", "forfait", "residuel"]);
export const CLASSES_ETAT_GLOBAL = Object.freeze(["Cl1", "Cl2", "Cl3", "Cl4"]);

export const REGLE_REMISE_A_ZERO =
  "Un entretien efface la déformation permanente des couches non liées et les ramène à leur "
  + "état initial : pour le sol et les graves non traitées, le dommage ne se cumule qu'entre "
  + "deux séquences de travaux. La fatigue des couches liées, elle, ne s'efface pas.";

/** Une phase de fonctionnement entre deux séquences de travaux, avec son dommage élémentaire. */
export function phaseDommage(libelle, essieuxSubis, essieuxDureeDeVie) {
  return {
    libelle, essieuxSubis, essieuxDureeDeVie,
    dommage: essieuxDureeDeVie > 0 ? essieuxSubis / essieuxDureeDeVie : NaN,
  };
}

/** Dommage consommé, et ce qui reste disponible pour le renforcement. */
function resultatDommage(voie, consomme, etapes, avertissements) {
  return {
    voie, consomme, etapes, avertissements,
    /** Dommage disponible pour le trafic futur : 1 − consommé, jamais négatif (NaN si inconnu). */
    disponible: Math.max(0, 1 - consomme),
    /** Vrai quand la couche a théoriquement atteint sa ruine. */
    epuise: consomme >= 1,
  };
}

// ───────────────────────────────── Voie 1 : Miner ─────────────────────────

/**
 * Cumul de Miner : d = Σ (ne subi / NE durée de vie). Le résultat n'est pas
 * plafonné — un dommage supérieur à 1 dit que la chaussée a dépassé sa durée de
 * vie théorique. `phases` : [{ libelle, essieuxSubis, essieuxDureeDeVie }].
 */
export function dommageParMiner(phases, coucheNonLiee = false) {
  const etapes = [], avertissements = [];
  if (phases.length === 0) {
    avertissements.push("Aucune phase d'historique : le cumul de Miner ne peut pas s'appliquer. "
      + "À défaut, passer par l'appréciation globale de l'état (dommage forfaitaire).");
    return resultatDommage("miner", NaN, etapes, avertissements);
  }
  let total = 0;
  for (const p of phases) {
    const d = p.dommage ?? phaseDommage(p.libelle, p.essieuxSubis, p.essieuxDureeDeVie).dommage;
    total += Number.isFinite(d) ? d : 0;
    etapes.push(`${p.libelle} : ${nf(p.essieuxSubis, 0)} essieux subis pour ${nf(p.essieuxDureeDeVie, 0)} `
      + `de durée de vie → dommage ${nf(d, 3)}`);
    if (!Number.isFinite(d))
      avertissements.push(`${p.libelle} : durée de vie non calculable, la phase est comptée pour zéro.`);
  }
  etapes.push(`Cumul de Miner : ${nf(total, 3)}`);
  if (coucheNonLiee && phases.length > 1)
    avertissements.push(REGLE_REMISE_A_ZERO + " Vérifier que les phases retenues sont bien celles qui "
      + "séparent deux interventions, et non toute la vie de la chaussée.");
  if (total >= 1)
    avertissements.push(`Dommage cumulé de ${nf(total, 3)} : la couche a théoriquement atteint sa ruine. `
      + "Il ne reste rien à consommer pour le trafic futur.");
  return resultatDommage("miner", total, etapes, avertissements);
}

// ──────────────────────────── Voie 2 : forfait tunisien ───────────────────

/** Dommage forfaitaire (fascicule 6, tableau 10) : Cl1 → 0,3 · Cl2 → 0,5 · Cl3 → 0,7 · Cl4 → 1. */
export const dommageForfaitaire = (classe) => ({ Cl1: 0.3, Cl2: 0.5, Cl3: 0.7 }[classe] ?? 1.0);

const nomNiveau = (n) => ({ bon: "bonne", moyen: "moyenne" }[n] ?? "mauvaise");

/**
 * Voie forfaitaire complète : l'indicateur global, le déclassement éventuel dû
 * aux interfaces décollées en assise, et le dommage qui en découle.
 */
export function dommageParEtat(niveauDeflexion, niveauDegradation, interfacesDecolleesEnAssise = false) {
  const etapes = [], avertissements = [];
  const brut = indicateurEtatGlobal(niveauDeflexion, niveauDegradation);
  etapes.push(`Déflexion ${nomNiveau(niveauDeflexion)} × dégradations ${nomNiveau(niveauDegradation)} → ${brut}`);
  let final = brut;
  if (interfacesDecolleesEnAssise) {
    final = declasserEtatGlobal(brut);
    etapes.push(`Interfaces décollées relevées en assise : l'appréciation baisse d'une classe, ${brut} → ${final}`);
  }
  const d = dommageForfaitaire(final);
  etapes.push(`${final} → dommage forfaitaire passé ${nf(d, 1)}`);
  avertissements.push("Dommage forfaitaire : il remplace le cumul de Miner faute d'historique de la "
    + "chaussée. Il vaut ce que vaut l'appréciation globale de l'état, et n'a pas la "
    + "finesse d'un calcul par phases.");
  if (final === "Cl4")
    avertissements.push("Cl4 : dommage de 1, la chaussée est théoriquement à la ruine. Un simple "
      + "renforcement ne suffira pas — envisager décaissement ou retraitement.");
  return resultatDommage("forfait", d, etapes, avertissements);
}

// ─────────────────────────── Voie 3 : vie résiduelle ──────────────────────

/**
 * Essieux équivalents qu'une couche liée peut encore porter, en inversant la
 * loi de fatigue : NE = 10⁶ × (εt / (ε6 · kθ · kr · kc · ks))^(1/b). NaN si la
 * sollicitation ou l'admissible ne sont pas positifs.
 */
export function essieuxRestantsBitumineux(epsCalcule, eps6, kTheta, kr, kc, ks, b) {
  const admissibleUnMillion = eps6 * kTheta * kr * kc * ks;
  if (!(epsCalcule > 0) || !(admissibleUnMillion > 0) || b >= 0) return NaN;
  return 1e6 * (epsCalcule / admissibleUnMillion) ** (1 / b);
}

/**
 * Essieux équivalents que peut encore porter le sol ou une grave non traitée,
 * en inversant εz,adm = A × NE^pente : NE = (εz / A)^(1/pente).
 */
export function essieuxRestantsSol(epsZCalcule, A, pente = -0.222) {
  if (!(epsZCalcule > 0) || !(A > 0) || pente >= 0) return NaN;
  return (epsZCalcule / A) ** (1 / pente);
}

/** Coefficient A du critère de déformation verticale : 16 000 µdéf sous T3, 12 000 au-delà. */
export const coefficientASol = (traficAuMoinsT3) => (traficAuMoinsT3 ? 12000 : 16000);

/**
 * Voie résiduelle : capacité restante rapportée au trafic futur. Le dommage
 * consommé vaut 1 − NE restant / NE futur quand la capacité ne couvre pas le
 * besoin, et 0 quand elle le couvre.
 */
export function dommageParVieResiduelle(essieuxRestants, essieuxFuturs) {
  const etapes = [], avertissements = [];
  if (!Number.isFinite(essieuxRestants) || essieuxRestants <= 0) {
    avertissements.push("Vie résiduelle non calculable : vérifier la sollicitation calculée et les "
      + "paramètres de la loi de fatigue.");
    return resultatDommage("residuel", NaN, etapes, avertissements);
  }
  etapes.push(`Capacité restante de la structure en place : ${nf(essieuxRestants, 0)} essieux équivalents.`);
  etapes.push(`Trafic futur demandé : ${nf(essieuxFuturs, 0)} essieux équivalents.`);
  if (essieuxFuturs <= 0) {
    avertissements.push("Trafic futur non renseigné : le besoin de renforcement ne peut pas être établi.");
    return resultatDommage("residuel", NaN, etapes, avertissements);
  }
  const rapport = essieuxRestants / essieuxFuturs;
  const consomme = Math.max(0, 1 - rapport);
  etapes.push(rapport >= 1
    ? `La structure en place couvre le trafic futur (${nf(rapport, 2)} fois) : pas de besoin structurel.`
    : `La structure en place ne couvre que ${nf(rapport, 2)} du trafic futur : un renforcement est nécessaire.`);
  avertissements.push("Voie résiduelle : elle regarde ce que la structure peut encore porter, sans "
    + "remonter son historique. Elle suppose que la modélisation actuelle — modules "
    + "rétrocalculés compris — représente bien son état.");
  return resultatDommage("residuel", consomme, etapes, avertissements);
}

// ──────────────────── Indicateur global d'état (tableaux 9 et 10) ─────────

export const REFERENCE_ETAT_GLOBAL = "Catalogue Tunisie RevA, fascicule 6, tableaux 9 et 10 (p. 341 et 345)";

/**
 * Indicateur global Cl1 … Cl4, croisement « niveau de déflexion × niveau de
 * dégradation » (tableau 9). Asymétrie à respecter : « mauvais » d'un seul côté
 * suffit à faire Cl3, alors que « moyen » des deux côtés reste en Cl2.
 */
export function indicateurEtatGlobal(niveauDeflexion, niveauDegradation) {
  const d = niveauDeflexion, g = niveauDegradation;
  if (d === "bon") return g === "bon" ? "Cl1" : g === "moyen" ? "Cl2" : "Cl3";
  if (d === "moyen") return g === "mauvais" ? "Cl3" : "Cl2";
  if (d === "mauvais" && (g === "bon" || g === "moyen")) return "Cl3";
  return "Cl4";
}

/** Déclassement d'une classe (interfaces décollées en assise) ; Cl4 ne bouge plus. */
export const declasserEtatGlobal = (c) => ({ Cl1: "Cl2", Cl2: "Cl3" }[c] ?? "Cl4");

export const REGLE_DECLASSEMENT =
  "Si les carottages révèlent des interfaces décollées au niveau des couches d'assise, "
  + "l'appréciation globale de la chaussée baisse d'une classe — un Cl2 devient Cl3, et son "
  + "dommage forfaitaire passe de 0,5 à 0,7.";

/** Ce que l'indicateur veut dire pour le concepteur. */
export function significationEtatGlobal(c) {
  if (c === "Cl1") return "Chaussée en bon état : dommage passé estimé à 0,3.";
  if (c === "Cl2") return "Chaussée moyennement dégradée : dommage passé estimé à 0,5.";
  if (c === "Cl3") return "Chaussée dégradée : dommage passé estimé à 0,7.";
  return "Chaussée à la ruine théorique : dommage passé de 1, il ne reste rien à consommer.";
}
