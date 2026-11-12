// Modules à poser AVANT le rétrocalcul, et géométrie du modèle (portage de
// StartingModuli de Burmister-Calc).
//
// C'est le cœur de l'articulation entre le diagnostic et le rétrocalcul : les
// carottages fixent les épaisseurs, les interfaces et les modules des couches
// liées ; le rétrocalcul ne cherche alors que le module du sol support, et les
// couches granulaires en découlent par le rapport k. Valeurs du guide Cerema
// 2016 (§ 3.4, § 4.4, tableaux 20, 21, 30 et 31), reprises à l'identique par
// le fascicule 6 tunisien (sauf la carotte fissurée, 1 500 MPa).
//
// Vocabulaire : classe de fissuration Cerema "F1" … "F5" (tableau 21) ;
// support d'un enduit "sur-non-lie-non-fissure" | "sur-non-lie-fissure" |
// "empile-sur-lie-2cm" | "sur-bitumineux-moins-2cm" ; qualité de carotte et
// paroi : voir carottages.js ; état du matériau : idem.

import { GRILLE_CEREMA_2016, RAPPORT_GRANULAIRE } from "./plafond-gnt.js";
import { moduleBitumineuxSenegal, moduleHydrauliqueSenegal } from "./senegal-modules.js";
import { moduleBitumineuxTropical } from "./tropical-modules.js";

export { RAPPORT_GRANULAIRE } from "./plafond-gnt.js";

export const REFERENCE_MODULES_DEPART =
  "Cerema/IDRRIM 2016, § 3.4 et 4.4, tableaux 20, 21, 30 et 31 ; "
  + "repris au fascicule 6 du catalogue tunisien RevA";

// ─────────────────────────── Géométrie du modèle ──────────────────────────

/** Épaisseur conventionnelle du sol dans le modèle (m). */
export const EPAISSEUR_SOL_MODELE_M = 6.0;

/** Module du massif semi-infini rigide placé sous le sol (MPa). */
export const MODULE_MASSIF_RIGIDE_MPA = 10000;

/** Coefficient de Poisson de ce massif. */
export const POISSON_MASSIF_RIGIDE = 0.25;

export const REGLE_MODELE_SOL =
  "Le sol est modélisé sur 6 m d'épaisseur, reposant sur un massif semi-infini rigide "
  + "(E ≥ 10 000 MPa, ν = 0,25), de façon à rendre compte de l'effet de non-linéarité du sol.";

/** Épaisseur maximale d'une sous-couche de grave non traitée (m). */
export const EPAISSEUR_MAX_SOUS_COUCHE_M = 0.10;

/**
 * Découpe une couche de grave non traitée en sous-couches d'au plus 10 cm, EN
 * PARTANT DU BAS : 0,25 m donne 0,10 + 0,10 + 0,05, et c'est la sous-couche
 * mince qui se retrouve en haut. Épaisseurs rendues de haut en bas.
 */
export function decouperGranulaire(epaisseurM, maxM = EPAISSEUR_MAX_SOUS_COUCHE_M) {
  if (!(epaisseurM > 0) || !(maxM > 0)) return [];
  const depuisLeBas = [];
  let reste = epaisseurM;
  while (reste > maxM + 1e-9) {
    depuisLeBas.push(maxM);
    reste -= maxM;
  }
  depuisLeBas.push(reste);
  return depuisLeBas.reverse();
}

// ─────────────────────────── Matériaux non liés ───────────────────────────

/**
 * Module maximal d'un matériau granulaire d'assise selon la grille du CEREMA
 * (tableaux 20 et 30). Pour un autre pays, passer par plafond-gnt.js
 * (grillePlafond) : la Tunisie plafonne à 360 MPa.
 */
export const moduleMaxGranulaire = (proprete, humidite) => GRILLE_CEREMA_2016.max(proprete, humidite);

/** Module d'une couche granulaire selon la grille du Cerema : 2 × dessous, plafonné. */
export const moduleGranulaire = (dessous, proprete, humidite) => GRILLE_CEREMA_2016.module(dessous, proprete, humidite);

/** Ordre de grandeur du module d'un sol fin : E (MPa) ≈ 5 × IPI (%). Contrôle de cohérence seulement. */
export const moduleSolDepuisIpi = (ipiPourcent) => 5 * ipiPourcent;

// ─────────────────────────── Matériaux bitumineux ─────────────────────────

/** Module retenu faute de carottage, pour toutes les couches bitumineuses (MPa). */
export const MODULE_SANS_CAROTTAGE_MPA = 2000;

/** Plancher du module bitumineux après application du facteur de vitesse (MPa). */
export const PLANCHER_VITESSE_MPA = 2000;

/**
 * Module bitumineux du tableau 31, d'après la qualité de la carotte et celle de
 * la paroi du trou. Null pour les trois cases « non rencontré ».
 * `moduleReference` est le module du matériau à l'état sain.
 */
export function moduleDepuisCarotte(qualite, paroi, moduleReference) {
  if (paroi === "lisse") {
    if (qualite === "saine") return moduleReference;
    if (qualite === "mediocre") return 0.7 * moduleReference;
    if (qualite === "fissuree") return 2000;
    return null;
  }
  if (paroi === "arrachee") {
    if (qualite === "mediocre") return 0.7 * moduleReference;
    if (qualite === "fissuree") return 2000;
    if (qualite === "fragmentee") return 1000;
    if (qualite === "desagregee") return 500;
  }
  return null;
}

/**
 * Variante tunisienne du tableau 31 (fascicule 6, tableau 5) : le module de
 * référence y est E(28 °C, 20 Hz) et la carotte fissurée vaut 1 500 MPa au
 * lieu de 2 000. Le reste est identique, cases « non rencontré » comprises.
 */
export function moduleDepuisCarotteTunisie(qualite, paroi, moduleReference) {
  if (qualite === "fissuree" && (paroi === "lisse" || paroi === "arrachee")) return 1500;
  return moduleDepuisCarotte(qualite, paroi, moduleReference);
}

/**
 * Module bitumineux d'après la seule classe de fissuration, quand ni carotte
 * ni rayon de courbure ne sont disponibles (tableau 21) : F1 garde le module
 * de référence, F2 et F3 tombent à 3 000 MPa, F4 et F5 à 2 000 MPa.
 */
export function moduleDepuisFissuration(classe, moduleReference) {
  if (classe === "F1") return moduleReference;
  if (classe === "F2" || classe === "F3") return 3000;
  return 2000;
}

/** Facteur de fréquence associé à la vitesse de mesure (0,5 sous 10 km/h, 0,75 au-dessus). */
export const facteurVitesse = (vitesseKmh) => (vitesseKmh < 10 ? 0.5 : 0.75);

/**
 * Ajustement du module bitumineux à la vitesse de mesure, pour le calage du
 * sol. Il ne s'applique qu'aux matériaux sains et médiocres ; pour un matériau
 * fissuré, fragmenté ou désagrégé, la valeur du tableau s'applique telle
 * quelle. Le résultat ne descend jamais sous 2 000 MPa.
 */
export function ajusterVitesse(module, etat, vitesseKmh) {
  if (etat !== "sain" && etat !== "mediocre") return module;
  return Math.max(module * facteurVitesse(vitesseKmh), PLANCHER_VITESSE_MPA);
}

/** Ramène à 10 Hz un module rétrocalculé à la fréquence de mesure. */
export const versDixHertz = (moduleMesure, vitesseKmh) => moduleMesure / facteurVitesse(vitesseKmh);

// ─────────────────────────── Couches de surface minces ────────────────────

/**
 * Module d'un enduit superficiel, d'une imprégnation ou d'une semi-pénétration.
 * Moins de 2 cm sur une couche bitumineuse : le module de la couche
 * sous-jacente.
 */
export function moduleEnduit(support, moduleDessous) {
  if (support === "sur-non-lie-non-fissure" || support === "empile-sur-lie-2cm") return 1000;
  if (support === "sur-non-lie-fissure") return 500;
  return moduleDessous;
}

// ──────────────────────────────── Interfaces ──────────────────────────────

/**
 * Condition d'interface à retenir dans le modèle : toutes les interfaces sont
 * supposées collées, sauf celles avérées décollées ENTRE COUCHES BITUMINEUSES.
 * Rend "collee" ou "decollee" (vocabulaire de carottages.js).
 */
export const interfacePourModele = (observee, entreBitumineuses) =>
  (observee === "decollee" && entreBitumineuses ? "decollee" : "collee");

// ───────────────────────── Barème résiduel du pays ────────────────────────

/**
 * Module de départ d'une couche liée selon le barème de modules résiduels du
 * pays — la valeur `modulesResiduels` d'un profil : "carotte-paroi" (Cerema
 * tableau 31, variante tunisienne si `pays` désigne la Tunisie), "senegal"
 * (tableaux 4 et 6 du guide AGEROUTE), "tropical" (fourchettes du manuel
 * CEBTP 1985) ou "aucun".
 *
 * `entree` : { pays, moduleReference (module sain), qualite, paroi (carotte ×
 * paroi) ; famille, etat, role, temperatureSurface, classeHydraulique
 * (Sénégal) ; etatTropical, moduleGranulaire (tropical) }.
 *
 * Renvoie { module (null sur une case « non rencontré »), encadre (vrai quand
 * la valeur est le milieu d'un encadrement tropical), bareme }.
 */
export function proposerModuleResiduel(bareme, entree = {}) {
  const ref = entree.moduleReference;
  if (bareme === "senegal") {
    const module = entree.famille === "hydraulique"
      ? moduleHydrauliqueSenegal(entree.classeHydraulique ?? "GC", entree.etat ?? "sain", ref)
      : moduleBitumineuxSenegal(entree.role ?? "assise", entree.etat ?? "sain", entree.temperatureSurface ?? 30);
    return { module, encadre: false, bareme };
  }
  if (bareme === "tropical") {
    const r = moduleBitumineuxTropical(entree.etatTropical ?? "sain", ref, entree.moduleGranulaire ?? 0);
    return { module: r.valeur, encadre: r.encadre, bareme };
  }
  if (bareme === "aucun") return { module: null, encadre: false, bareme };
  const tunisie = /tunis/i.test(String(entree.pays ?? ""));
  const module = tunisie
    ? moduleDepuisCarotteTunisie(entree.qualite ?? "saine", entree.paroi ?? "lisse", ref)
    : moduleDepuisCarotte(entree.qualite ?? "saine", entree.paroi ?? "lisse", ref);
  return { module, encadre: false, bareme: "carotte-paroi" };
}
