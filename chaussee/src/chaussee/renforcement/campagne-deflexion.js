// Campagne de mesures de déflexion le long d'un itinéraire, et son exploitation
// (portage de DeflectionCampaign de Burmister-Calc) : correction en
// température, découpage en sections élémentaires, valeurs caractéristiques.
// Cerema/IDRRIM 2016, § 2.6, 2.7 et ch. 2 § 3.
//
// Une lecture : { pk (m), deflexion (1/100 mm), temperature (°C, facultative),
// rayon (m, facultatif), exclu (booléen) }.
// Type de structure (coefficient K du tableau 6) : "souple" | "bitumineuse-epaisse"
// | "mixte" | "semi-rigide" (vocabulaire des profils pays).
// Portée : "zone-homogene" (linéaire ausculté en continu) | "section-temoin"
// (quelques dizaines de mètres instrumentés, modèle de calcul de la zone).

import { valeurCaracteristique } from "./baremes-deflexion.js";
import { nf } from "./format.js";

export const REFERENCE_CORRECTION_TEMPERATURE = "Cerema/IDRRIM 2016, § 2.6.3, formule E5 et tableau 6 (p. 44)";
export const REFERENCE_CAMPAGNE = "Cerema/IDRRIM 2016, § 2.6, 2.7 et ch. 2 § 3";

export const PORTEES = Object.freeze(["section-temoin", "zone-homogene"]);

export const TEMPERATURE_REFERENCE_DEFLEXION_C = 15.0;

/** Coefficient K du tableau 6 : souple 0,15 ; bitumineuse épaisse 0,20 ; mixte 0,08 ; semi-rigide 0,04. */
export function coefficientK(typeStructure) {
  if (typeStructure === "souple") return 0.15;
  if (typeStructure === "bitumineuse-epaisse") return 0.20;
  if (typeStructure === "mixte") return 0.08;
  return 0.04;
}

/**
 * Passage d'une déflexion DÉJÀ ramenée à 15 °C vers une autre température de
 * référence : c = 1 + K × (θcible − 15) / 15. Le 15 du dénominateur appartient
 * à la corrélation du Cerema, il ne désigne pas la température du pays : le
 * fascicule 6 tunisien ramène d'abord à 15 °C, puis transpose à 28 °C.
 */
export const transposerDeflexion = (deflexionA15, cibleC, typeStructure) =>
  deflexionA15 * (1 + (coefficientK(typeStructure) * (cibleC - TEMPERATURE_REFERENCE_DEFLEXION_C)) / TEMPERATURE_REFERENCE_DEFLEXION_C);

/**
 * Déflexion ramenée à la température de référence (formule E5) :
 * d₁₅ = d_θ / (1 + K (θ − 15) / 15), puis, si `referenceC` diffère de 15 °C,
 * transposée par le coefficient c. Une mesure prise à chaud est réduite.
 */
export function deflexionVersReference(mesure, temperatureC, typeStructure, referenceC = TEMPERATURE_REFERENCE_DEFLEXION_C) {
  const a15 = mesure / (1 + (coefficientK(typeStructure) * (temperatureC - TEMPERATURE_REFERENCE_DEFLEXION_C)) / TEMPERATURE_REFERENCE_DEFLEXION_C);
  return transposerDeflexion(a15, referenceC, typeStructure);
}

export const REGLE_TEMPERATURE_REFERENCE =
  "La formule de correction est calée sur 15 °C : le 15 du dénominateur appartient à la "
  + "corrélation, il n'est pas la température de dimensionnement du pays. Pour travailler à "
  + "une autre référence — 28 °C en Tunisie — on ramène d'abord la mesure à 15 °C, puis on "
  + "la transpose par le coefficient c = 1 + K (θcible − 15) / 15.";

export const RESERVE_VITESSE =
  "Les déflexions du guide sont mesurées sous charge roulante à moins de 20 km/h. Pour un "
  + "autre type de chargement, la relation d'équivalence entre les deux mesures doit être justifiée.";

export const REGLE_SONDE_TEMPERATURE =
  "Température relevée à mi-hauteur des matériaux bitumineux si leur épaisseur dépasse 0,15 m ; "
  + "à défaut, en surface de la chaussée, à l'abri de l'ensoleillement.";

/** Longueur usuelle d'une section élémentaire de découpage (m). */
export const LONGUEUR_SECTION_M = 200;

/** Nombre minimal de points de mesure par section de 200 m. */
export const POINTS_MINIMUM_PAR_SECTION = 10;

/** Une section élémentaire et ses valeurs caractéristiques. */
function section(debutPk, finPk, nombrePoints, deflexionCaracteristique, rayonCaracteristique, rayonMedian) {
  return {
    debutPk, finPk, nombrePoints, deflexionCaracteristique, rayonCaracteristique, rayonMedian,
    /** Le guide demande au moins 10 points par section de 200 m. */
    assezDePoints: nombrePoints >= POINTS_MINIMUM_PAR_SECTION,
    libelle: `PK ${nf(debutPk, 0)} à ${nf(finPk, 0)}`,
  };
}

const avecRayon = (l) => typeof l.rayon === "number" && Number.isFinite(l.rayon);
const avecTemperature = (l) => typeof l.temperature === "number" && !Number.isNaN(l.temperature);

/**
 * Construit une campagne. `options` : { temperatureReference (15 °C en
 * France, 28 °C en Tunisie), vitesse (km/h, commande le passage de fréquence
 * des modules) }.
 */
export function creerCampagne(lectures, typeStructure, portee = "zone-homogene",
                              { temperatureReference = TEMPERATURE_REFERENCE_DEFLEXION_C, vitesse = null } = {}) {
  const retenues = () => lectures.filter((l) => !l.exclu);

  /** Déflexion d'un point ramenée à la référence ; sans température, la valeur mesurée telle quelle. */
  const deflexionCorrigee = (l) => (avecTemperature(l)
    ? deflexionVersReference(l.deflexion, l.temperature, typeStructure, temperatureReference)
    : l.deflexion);

  const aDesLecturesNonCorrigees = () => retenues().some((l) => !avecTemperature(l));

  const trieesParPk = () => retenues().slice().sort((a, b) => a.pk - b.pk);

  function resumer(debut, fin, points) {
    const d = points.map(deflexionCorrigee);
    const r = points.filter(avecRayon).map((p) => p.rayon);
    return section(debut, fin, points.length,
      d.length > 0 ? valeurCaracteristique(d, "centile-97,5") : NaN,
      r.length > 0 ? valeurCaracteristique(r, "deuxieme-decile") : null,
      r.length > 0 ? valeurCaracteristique(r, "mediane") : null);
  }

  /**
   * Découpage en sections élémentaires de longueur constante, avec leurs
   * valeurs caractéristiques : déflexion au seuil de 97,5 %, rayon au 2ᵉ
   * décile, et rayon médian (ajustement des modules bitumineux).
   */
  function sections(longueur = LONGUEUR_SECTION_M) {
    const points = trieesParPk();
    if (points.length === 0 || longueur <= 0) return [];
    const debut = Math.floor(points[0].pk / longueur) * longueur;
    const fin = points[points.length - 1].pk;
    const res = [];
    for (let pk = debut; pk <= fin; pk += longueur) {
      const de = pk, a = pk + longueur;
      const dedans = points.filter((p) => p.pk >= de && p.pk < a);
      if (dedans.length === 0) continue;
      res.push(resumer(de, a, dedans));
    }
    return res;
  }

  /** Valeurs caractéristiques de l'ensemble de la campagne, sans découpage. */
  function ensemble() {
    const points = trieesParPk();
    return resumer(points.length > 0 ? points[0].pk : NaN,
                   points.length > 0 ? points[points.length - 1].pk : NaN, points);
  }

  /** Ce que le guide reproche à la campagne, s'il y a lieu. */
  function avertissements(longueur = LONGUEUR_SECTION_M) {
    const res = [];
    const points = retenues();
    if (points.length === 0) return ["Aucune mesure retenue."];

    if (aDesLecturesNonCorrigees()) {
      const manquantes = points.filter((l) => !avecTemperature(l)).length;
      res.push(`${manquantes} mesure(s) sans température relevée : elles sont prises telles quelles, `
        + `sans correction vers ${nf(temperatureReference, 1)} °C. ` + REGLE_SONDE_TEMPERATURE);
    }

    if (portee === "zone-homogene") {
      const pks = points.map((l) => l.pk);
      const longueurAuscultee = Math.max(...pks) - Math.min(...pks);
      if (longueurAuscultee < longueur)
        res.push(`Le linéaire ausculté (${nf(longueurAuscultee, 0)} m) est plus court qu'une section élémentaire `
          + `(${nf(longueur, 0)} m) : une zone homogène fait au moins cette longueur, hors purge.`);

      const courtes = sections(longueur).filter((s) => !s.assezDePoints);
      if (courtes.length > 0)
        res.push(`${courtes.length} section(s) élémentaire(s) comptent moins de `
          + `${POINTS_MINIMUM_PAR_SECTION} points de mesure : le guide juge la valeur `
          + "caractéristique peu représentative en deçà, vu la dispersion du comportement.");
    }

    if (Number.isFinite(vitesse) && vitesse > 20)
      res.push(`Mesure à ${nf(vitesse, 1)} km/h : au-delà de 20 km/h, le guide demande de justifier `
        + "la relation d'équivalence avec la charge roulante de référence.");
    return res;
  }

  return {
    lectures, typeStructure, portee, temperatureReference, vitesse,
    retenues, deflexionCorrigee, aDesLecturesNonCorrigees, sections, ensemble, avertissements,
  };
}
