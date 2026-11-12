// Le Catalogue des structures types de chaussées neuves du réseau routier
// national, SETRA-LCPC, édition 1998 (portage de FranceCatalogue1998 et de
// FranceCatalogue1998Structures de Burmister-Calc) : classes de trafic cumulé
// TCi, durées de dimensionnement, risques de calcul, coefficients
// d'agressivité, plate-forme, et les 52 fiches de structures.
//
// C'est LE document français de référence pour une chaussée neuve du réseau
// national. Il ne se confond pas avec le manuel Scetauroute (scetauroute.js),
// document d'entreprise destiné aux autoroutes concédées.
//
// Deux pièges de lecture, verrouillés par les tests :
//  - les classes TCi portent sur un trafic CUMULÉ sur la durée de
//    dimensionnement, pas sur un débit journalier ;
//  - la croissance y est LINÉAIRE, non géométrique : C = d + t·d·(d − 1)/2.
//
// Réseau : "vrs" (voies du réseau structurant, 30 ans) ou "vrns" (réseau non
// structurant, 20 ans) ; un booléen « réseau structurant » est aussi accepté.
// Familles de structure (au sens du catalogue, pour le risque et le CAM) :
// "bitumineuse-epaisse" | "semi-rigide-ou-beton" | "mixte" | "souple".

import { catalogueStructures } from "./base.js";

export const VRS = "vrs";
export const VRNS = "vrns";

export const FAMILLES_1998 = Object.freeze({
  /** Chaussées bitumineuses épaisses — et, pour le CAM, GB3/GNT et structures inverses. */
  bitumineuseEpaisse: "bitumineuse-epaisse",
  /** Assises traitées aux liants hydrauliques et chaussées en béton de ciment. */
  semiRigideOuBeton: "semi-rigide-ou-beton",
  /** Structures mixtes : assise bitumineuse sur fondation traitée aux liants hydrauliques. */
  mixte: "mixte",
  /** Chaussées souples : couverture bitumineuse mince sur GNT (VRNS seulement). */
  souple: "souple",
});

/** Vrai pour le réseau structurant ("vrs", "structurant" ou true). */
export const estStructurant = (reseau) =>
  reseau === true || ["vrs", "structurant"].includes(String(reseau).toLowerCase());

export const REFERENCE =
  "SETRA-LCPC, Catalogue des structures types de chaussées neuves, réseau routier national, "
  + "édition 1998 (lettre circulaire du directeur des routes du 26 octobre 1998)";

/**
 * Définition du poids lourd retenue par le catalogue : véhicule de plus de
 * 35 kN de PTAC (NF P 98-082), et non plus de 50 kN de charge utile.
 */
export const DEFINITION_POIDS_LOURD =
  "Poids lourd = véhicule de plus de 35 kN de poids total autorisé en charge (PTAC), "
  + "conformément à la norme NF P 98-082. Le catalogue de 1977 retenait les véhicules de "
  + "plus de 50 kN de charge utile : les deux comptages ne sont pas interchangeables.";

/** Comptage à l'ancienne définition (CU > 50 kN) vers la nouvelle : N_PTAC = 1,25 × N_CU. */
export const poidsLourdsAncienneDefinition = (nCu) => 1.25 * nCu;

export const RESERVE_CONVERSION =
  "La relation N_PTAC = 1,25 × N_CU n'est donnée valable qu'en rase campagne : la "
  + "composition du parc y diffère de celle du milieu urbain.";

// ─────────────────────────── Durée et risque, tableau 5 ───────────────────────────

/** Durée de dimensionnement initiale : 30 ans sur VRS, 20 ans sur VRNS (tab. 5). */
export const dureeDimensionnement = (reseau) => (estStructurant(reseau) ? 30 : 20);

/**
 * Risque de calcul (%) du tableau 5, selon la famille et l'indice i de TCi.
 * Null hors du tableau (TC2 à TC8). Le risque décroît quand le trafic croît.
 */
export function risque(famille, indice) {
  if (!(indice >= 2 && indice <= 8)) return null;
  const ligne = famille === "bitumineuse-epaisse" || famille === "souple"
    ? [30, 18, 10, 5, 2, 1, 1]
    : [12.5, 10, 7.5, 5, 2.5, 1, 1];   // semi-rigide, béton, et assise d'une structure mixte
  return ligne[indice - 2];
}

/**
 * Risque de la FONDATION d'une structure mixte (dernière ligne du tableau 5),
 * nettement plus élevé que celui de son assise : 50 % sous TC2, 1 % sous TC8.
 */
export function risqueFondationMixte(indice) {
  if (!(indice >= 2 && indice <= 8)) return null;
  return [50, 35, 20, 10, 3, 2, 1][indice - 2];
}

export const NOTE_RISQUE =
  "Le risque de calcul de x % sur une durée de p années est la probabilité qu'apparaissent "
  + "au cours de ces p années des désordres imposant des travaux de renforcement "
  + "assimilables à une reconstruction, en l'absence de toute intervention d'entretien "
  + "structurel. Il est différencié selon le type de structure — comportement en fatigue "
  + "différent en moyenne comme en dispersion — et selon le trafic.";

// ─────────────────────────── Agressivité, tableau 6 ───────────────────────────

/**
 * CAM du tableau 6 par famille et réseau. Null quand le catalogue déclare le
 * couple sans objet : une GNT/GNT ne se rencontre pas sur le réseau structurant.
 */
export function cam(famille, reseau) {
  const vrs = estStructurant(reseau);
  switch (famille) {
    case "bitumineuse-epaisse": return vrs ? 0.8 : 0.5;
    case "souple": return vrs ? null : 1.0;
    case "mixte": return vrs ? 1.2 : 0.75;
    default: return vrs ? 1.3 : 0.8;
  }
}

export const NOTE_CAM =
  "Le CAM du tableau 6 vaut aussi pour les structures GB3/GNT et pour les structures "
  + "inverses, que le catalogue range avec les chaussées bitumineuses épaisses. Il résulte du "
  + "dépouillement des stations d'analyse du trafic lourd (SATL) ; lorsque l'agressivité "
  + "attendue s'en écarte nettement, le catalogue demande de recalculer le NE avec ses "
  + "propres hypothèses et de revenir au tableau 8 pour en déduire la classe.";

/**
 * CAM de la SEULE vérification de la plate-forme (tableau 10) : 0,5 sous TC2,
 * 0,75 sous TC3, 1 à partir de TC4. À ne pas confondre avec le tableau 6.
 */
export function camPlateforme(indice) {
  if (indice === 2) return 0.5;
  if (indice === 3) return 0.75;
  if (indice >= 4 && indice <= 8) return 1.0;
  return null;
}

/** Déformation verticale admissible au sommet de la plate-forme : εz,ad = 0,012 · NE^−0,222 (m/m). */
export const epsZAdmissiblePlateforme = (ne) => 0.012 * ne ** -0.222;

export const NOTE_DEFORMATION_PLATEFORME =
  "εz,ad = 0,012 · NE^−0,222. Le Guide de conception fournit deux relations selon le niveau "
  + "de trafic ; le catalogue retient celle des trafics supérieurs ou égaux à T3 sur "
  + "l'ensemble du réseau national, par souci d'homogénéité du niveau de service. Le NE de "
  + "cette vérification se calcule avec les CAM du tableau 10, non ceux du tableau 6.";

// ─────────────────────────── Classes TCi, tableau 1 ───────────────────────────

const tc = (nom, indice, borneSuperieure, aDesFiches) =>
  Object.freeze({ nom, indice, borneSuperieure, aDesFiches });

const CLASSES_VRS = Object.freeze([
  tc("TC1₃₀", 1, 0.5, false),
  tc("TC2₃₀", 2, 1.0, false),
  tc("TC3₃₀", 3, 3.0, false),
  tc("TC4₃₀", 4, 6.0, true),
  tc("TC5₃₀", 5, 14.0, true),
  tc("TC6₃₀", 6, 38.0, true),
  tc("TC7₃₀", 7, 94.0, true),
  tc("TC8₃₀", 8, null, true),
]);

const CLASSES_VRNS = Object.freeze([
  tc("TC1₂₀", 1, 0.2, false),
  tc("TC2₂₀", 2, 0.5, true),
  tc("TC3₂₀", 3, 1.5, true),
  tc("TC4₂₀", 4, 2.5, true),
  tc("TC5₂₀", 5, 6.5, true),
  tc("TC6₂₀", 6, 17.5, true),
  tc("TC7₂₀", 7, 43.5, true),
  tc("TC8₂₀", 8, null, false),
]);

/**
 * Les huit classes de trafic cumulé d'une série : { nom, indice,
 * borneSuperieure (millions de PL, null pour la plus haute), aDesFiches }.
 * Sans fiches : TC1 dans les deux séries, TC2₃₀ et TC3₃₀, TC8₂₀.
 */
export const classesTrafic = (reseau) => (estStructurant(reseau) ? CLASSES_VRS : CLASSES_VRNS);

/** Classe TCi d'un cumul de poids lourds (millions) ; la borne est incluse dans la classe qu'elle borne. */
export function classer(millionsPL, reseau) {
  const classes = classesTrafic(reseau);
  return classes.find((c) => c.borneSuperieure == null || millionsPL <= c.borneSuperieure)
    ?? classes[classes.length - 1];
}

// ─────────────────────────── Cumul, notice § 2.3 ───────────────────────────

/** Taux de croissance LINÉAIRE retenu par le catalogue : 5 % sur VRS, 2 % sur VRNS. */
export const tauxCroissanceCatalogue = (reseau) => (estStructurant(reseau) ? 5 : 2);

/**
 * Poids lourds cumulés sur la voie la plus chargée : 365 × T × C, avec
 * C = d + t·d·(d − 1)/2 (croissance linéaire), d la durée du réseau.
 */
export function poidsLourdsCumules(plParJourMiseEnService, reseau, tauxPourcent = null) {
  const d = dureeDimensionnement(reseau);
  const t = (tauxPourcent ?? tauxCroissanceCatalogue(reseau)) / 100;
  return 365 * plParJourMiseEnService * (d + (t * d * (d - 1)) / 2);
}

export const NOTE_CROISSANCE =
  "Le catalogue de 1998 raisonne en croissance LINÉAIRE : C = d + t·d·(d − 1)/2. La formule "
  + "géométrique usuelle, C = [(1 + t)^d − 1] / t, donne un cumul sensiblement plus élevé "
  + "pour le même taux. Les structures du catalogue ayant été calculées avec la première, "
  + "il faut la retenir pour retrouver leurs classes.";

/** Part du trafic PL sur la voie la plus chargée (rase campagne) : 1 voie 100 %, 2 voies 90 %, 3 voies 80 %. */
export const partVoieLaPlusChargee = (voies) => (voies <= 1 ? 1.0 : voies === 2 ? 0.9 : 0.8);

export const NOTE_VOIES =
  "Répartition valable en section courante de rase campagne. Dans tous les autres cas, le "
  + "catalogue demande une étude particulière.";

// ─────────────────────────── NE de dimensionnement, tableaux 7 et 8 ───────────────────────────

const ligneVrs = (famille, bit, srb, mix) =>
  (famille === "bitumineuse-epaisse" ? bit : famille === "semi-rigide-ou-beton" ? srb
    : famille === "mixte" ? mix : null);
const ligneVrns = (famille, bit, srb, mix, souple) =>
  (famille === "bitumineuse-epaisse" ? bit : famille === "semi-rigide-ou-beton" ? srb
    : famille === "mixte" ? mix : souple);

/**
 * Bornes supérieures des classes en millions d'ESSIEUX ÉQUIVALENTS (tableau 8),
 * indices 1 à 7. Null si sans objet (TC1 sur VRS, souple sur VRS) ou hors tableau.
 */
export function borneSuperieureEssieux(famille, reseau, indice) {
  if (!(indice >= 1 && indice <= 7)) return null;
  const ligne = estStructurant(reseau)
    ? ligneVrs(famille,
      [null, 0.7, 2.2, 4.5, 11.3, 30, 75],
      [null, 1.2, 3.6, 7.3, 18.4, 49, 122],
      [null, 1.1, 3.4, 6.8, 17, 45, 113])
    : ligneVrns(famille,
      [0.1, 0.2, 0.6, 1.3, 3.2, 8.6, 21],
      [0.1, 0.3, 1.0, 2.0, 5.2, 13.8, 34],
      [0.1, 0.3, 0.9, 1.9, 4.8, 13, 32],
      [0.2, 0.5, 1.5, 2.5, 6.5, 17.5, 43.5]);
  return ligne?.[indice - 1] ?? null;
}

/**
 * NE (millions) effectivement utilisé pour calculer les fiches du catalogue
 * (tableau 7), indices 2 à 8 : la valeur à reprendre pour recalculer une fiche.
 */
export function essieuxDeCalcul(famille, reseau, indice) {
  if (!(indice >= 2 && indice <= 8)) return null;
  const ligne = estStructurant(reseau)
    ? ligneVrs(famille,
      [0.5, 1.3, 3, 7.5, 18, 45, 106],
      [0.8, 2, 5, 12, 29, 73, 171],
      [0.8, 2, 4.5, 11, 27, 68, 158])
    : ligneVrns(famille,
      [0.1, 0.3, 0.8, 2, 5, 13, 30],
      [0.2, 0.6, 1.4, 3.5, 8.3, 20, 48],
      [0.2, 0.5, 1.3, 3.2, 7.8, 19, 45],
      [0.3, 0.7, 1.7, 4.3, 10.4, 26, 60]);
  return ligne?.[indice - 2] ?? null;
}

/** Trafic de mise en service (PL/j/sens) du tableau 7 : 35, 85, 200, 500, 1200, 3000, 7000 pour TC2 à TC8. */
export function plParJourDeCalcul(indice) {
  if (!(indice >= 2 && indice <= 8)) return null;
  return [35, 85, 200, 500, 1200, 3000, 7000][indice - 2];
}

// ─────────────────────────── Plate-forme, tableau 9 ───────────────────────────

const MODULES_PF = { PF1: 20, PF2: 50, PF3: 120, PF4: 200 };

/** Module de calcul (MPa) d'une classe de plate-forme : la LIMITE INFÉRIEURE de la classe. */
export const modulePlateforme = (classe) => MODULES_PF[String(classe).toUpperCase()] ?? null;

export const POISSON_PLATEFORME = 0.35;

/** PF1 reste définie, mais le catalogue ne la retient plus pour une chaussée neuve. */
export const retenuePourChausseeNeuve = (classe) =>
  String(classe).toUpperCase() !== "PF1" && modulePlateforme(classe) != null;

export const NOTE_PLATEFORME =
  "Le catalogue ne retient plus la réalisation de plates-formes PF1, dont la portance à long "
  + "terme est trop faible pour garantir une bonne tenue des chaussées. Le module de calcul "
  + "est la limite inférieure de la classe, non sa valeur moyenne.";

// ═══════════════════════════ Les 52 fiches de structures ═══════════════════════════
//
// 25 fiches pour les voies du réseau structurant (VRS), 27 pour le réseau non
// structurant (VRNS). Les deux séries ne se mélangent pas : la classe de
// trafic porte son indice de durée (TC4₃₀ / TC4₂₀).
//
// Les épaisseurs d'assise sont encodées cellule par cellule (relues sur les
// planches puis recoupées avec la couche texte du PDF). La couche de surface,
// elle, n'est chiffrée que sur la fiche GNT/GNT : ailleurs la planche renvoie
// à un jeu d'options de la page de commentaires, repéré par une couleur, que
// l'on conserve (jeuSurface, note) sans en inventer l'épaisseur.
//
// Provisoire : la répartition des sous-couches entre matériaux est une lecture
// du dessin (sûre quand le nombre de sous-couches égale le nombre de matériaux
// de la fiche ; sinon, les sous-couches surnuméraires sont des passes de base).

export const REFERENCE_FICHES =
  "SETRA-LCPC, Catalogue des structures types de chaussées neuves, édition 1998, "
  + "52 fiches de structures (série VRS et série VRNS)";

export const NOTE_COUCHE_SURFACE =
  "La couche de surface n'est pas chiffrée sur la fiche : elle se choisit parmi les "
  + "combinaisons de la page de commentaires, repérées par une couleur. L'épaisseur "
  + "d'assise ci-dessus n'inclut donc pas la couche de surface.";

export const NOTE_EPAISSEURS =
  "Épaisseurs nominales d'assise au bord droit (côté rive) de la voie la plus chargée.";

/** L'astérisque sur une assise traitée aux liants hydrauliques : préfissuration. */
export const NOTE_PREFISSURATION =
  "* — Préfissuration de la couche de base traitée aux liants hydrauliques : obligatoire "
  + "sous trafic supérieur ou égal à TC6, vivement conseillée sinon.";

/** L'astérisque sur une assise bitumineuse : nivellement de la plate-forme. */
export const NOTE_NIVELLEMENT =
  "* — L'épaisseur totale d'assise en matériau bitumineux étant inférieure ou égale à "
  + "12 cm, un nivellement de la plate-forme à ± 2 cm est exigé ; il peut être obtenu par "
  + "une couche de réglage de 10 cm en GNT insensible à l'eau.";

export const NOTE_COMPACTAGE =
  "(2) — Cette épaisseur nécessite un atelier de compactage adapté.";

// Une ligne par cellule : série|fiche|classe de trafic|plate-forme|jeu de couche
// de surface|épaisseurs d'assise en cm, de haut en bas.
// Jeu : B, R, V, O = bleu, rose, vert, orange de la page de commentaires ;
// « - » = pas de couche de surface rapportée (chaussées béton) ; « N » = couche
// de surface chiffrée sur la planche, première épaisseur de la liste.
// Marqueurs : « * » préfissuration (assises traitées) ou nivellement (assises
// bitumineuses) ; « (2) » atelier de compactage adapté.
const DONNEES = `
VRS|GB2/GB2|TC8|PF3|B|12/13/13
VRS|GB2/GB2|TC8|PF4|B|11/12/12
VRS|GB2/GB2|TC7|PF3|B|11/11/11
VRS|GB2/GB2|TC7|PF4|B|10/10/11
VRS|GB2/GB2|TC6|PF3|B|14/14
VRS|GB2/GB2|TC6|PF4|B|13/13
VRS|GB2/GB2|TC5|PF2|B|14/14
VRS|GB2/GB2|TC5|PF3|B|11/12
VRS|GB2/GB2|TC5|PF4|B|10/11
VRS|GB2/GB2|TC4|PF2|R|12/13
VRS|GB2/GB2|TC4|PF3|R|10/10
VRS|GB2/GB2|TC4|PF4|R|9/9
VRS|GB3/GB3|TC8|PF3|B|11/12/12
VRS|GB3/GB3|TC8|PF4|B|10/11/11
VRS|GB3/GB3|TC7|PF3|B|10/10/11
VRS|GB3/GB3|TC7|PF4|B|14/14
VRS|GB3/GB3|TC6|PF3|B|13/13
VRS|GB3/GB3|TC6|PF4|B|11/12
VRS|GB3/GB3|TC5|PF2|B|13/13
VRS|GB3/GB3|TC5|PF3|B|10/11
VRS|GB3/GB3|TC5|PF4|B|9/9
VRS|GB3/GB3|TC4|PF2|R|11/12
VRS|GB3/GB3|TC4|PF3|R|9/9
VRS|GB3/GB3|TC4|PF4|R|8/8
VRS|EME2/EME2|TC8|PF3|B|13/13
VRS|EME2/EME2|TC8|PF4|B|12/12
VRS|EME2/EME2|TC7|PF3|B|11/12
VRS|EME2/EME2|TC7|PF4|B|10/11
VRS|EME2/EME2|TC6|PF3|B|9/10
VRS|EME2/EME2|TC6|PF4|B|8/9
VRS|EME2/EME2|TC5|PF2|R|11/12
VRS|EME2/EME2|TC5|PF3|R|9/10
VRS|EME2/EME2|TC5|PF4|R|8/9
VRS|EME2/EME2|TC4|PF2|R|10/10
VRS|EME2/EME2|TC4|PF3|R|7/9
VRS|EME2/EME2|TC4|PF4|R|6/8
VRS|GC3/GC3|TC8|PF3|B|20*/18
VRS|GC3/GC3|TC8|PF4|B|19*/15
VRS|GC3/GC3|TC7|PF3|B|19*/18
VRS|GC3/GC3|TC7|PF4|B|18*/15
VRS|GC3/GC3|TC6|PF3|R|19*/18
VRS|GC3/GC3|TC6|PF4|R|18*/15
VRS|GC3/GC3|TC5|PF2|V|22/20
VRS|GC3/GC3|TC5|PF3|V|32(2)
VRS|GC3/GC3|TC5|PF4|V|29
VRS|GC3/GC3|TC4|PF2|O|21/20
VRS|GC3/GC3|TC4|PF3|O|31
VRS|GC3/GC3|TC4|PF4|O|28
VRS|GC4/GC4|TC8|PF3|B|20*/18
VRS|GC4/GC4|TC8|PF4|B|20*/15
VRS|GC4/GC4|TC7|PF3|B|18*/18
VRS|GC4/GC4|TC7|PF4|B|19*/15
VRS|GC4/GC4|TC6|PF3|R|18*/18
VRS|GC4/GC4|TC6|PF4|R|18*/15
VRS|GC4/GC4|TC5|PF2|V|19*/20
VRS|GC4/GC4|TC5|PF3|V|27*
VRS|GC4/GC4|TC5|PF4|V|25*
VRS|GC4/GC4|TC4|PF2|O|18*/20
VRS|GC4/GC4|TC4|PF3|O|26*
VRS|GC4/GC4|TC4|PF4|O|24*
VRS|GC3/SC3|TC8|PF3|B|20*/18
VRS|GC3/SC3|TC8|PF4|B|19*/15
VRS|GC3/SC3|TC7|PF3|B|19*/18
VRS|GC3/SC3|TC7|PF4|B|18*/15
VRS|GC3/SC3|TC6|PF3|R|19*/18
VRS|GC3/SC3|TC6|PF4|R|18*/15
VRS|GC3/SC3|TC5|PF2|V|22/20
VRS|GC3/SC3|TC5|PF3|V|32
VRS|GC3/SC3|TC5|PF4|V|29
VRS|GC3/SC3|TC4|PF2|O|21/20
VRS|GC3/SC3|TC4|PF3|O|31
VRS|GC3/SC3|TC4|PF4|O|28
VRS|GLp/SL3|TC8|PF3|B|20*/18
VRS|GLp/SL3|TC8|PF4|B|19*/15
VRS|GLp/SL3|TC7|PF3|B|19*/18
VRS|GLp/SL3|TC7|PF4|B|18*/15
VRS|GLp/SL3|TC6|PF3|R|19*/18
VRS|GLp/SL3|TC6|PF4|R|18*/15
VRS|GLp/SL3|TC5|PF2|V|22/20
VRS|GLp/SL3|TC5|PF3|V|32
VRS|GLp/SL3|TC5|PF4|V|29
VRS|GLp/SL3|TC4|PF2|O|21/20
VRS|GLp/SL3|TC4|PF3|O|31
VRS|GLp/SL3|TC4|PF4|O|28
VRS|GLp/GLp|TC8|PF3|B|20*/18
VRS|GLp/GLp|TC8|PF4|B|19*/15
VRS|GLp/GLp|TC7|PF3|B|19*/18
VRS|GLp/GLp|TC7|PF4|B|17*/15
VRS|GLp/GLp|TC6|PF3|R|19*/18
VRS|GLp/GLp|TC6|PF4|R|17*/15
VRS|GLp/GLp|TC5|PF2|V|22/20
VRS|GLp/GLp|TC5|PF3|V|32
VRS|GLp/GLp|TC5|PF4|V|29
VRS|GLp/GLp|TC4|PF2|O|21/20
VRS|GLp/GLp|TC4|PF3|O|30
VRS|GLp/GLp|TC4|PF4|O|28
VRS|GLg/GLg|TC6|PF3|B|21*/20
VRS|GLg/GLg|TC6|PF4|B|19*/19
VRS|GLg/GLg|TC5|PF2|R|23/22
VRS|GLg/GLg|TC5|PF3|R|20/19
VRS|GLg/GLg|TC5|PF4|R|18/18
VRS|GLg/GLg|TC4|PF2|V|22/22
VRS|GLg/GLg|TC4|PF3|V|19/18
VRS|GLg/GLg|TC4|PF4|V|17/17
VRS|GCV/GCV|TC8|PF3|B|20*/18
VRS|GCV/GCV|TC8|PF4|B|18*/18
VRS|GCV/GCV|TC7|PF3|B|18*/18
VRS|GCV/GCV|TC7|PF4|B|19*/15
VRS|GCV/GCV|TC6|PF3|R|18*/18
VRS|GCV/GCV|TC6|PF4|R|18*/15
VRS|GCV/GCV|TC5|PF2|V|20/20
VRS|GCV/GCV|TC5|PF3|V|27
VRS|GCV/GCV|TC5|PF4|V|25
VRS|GCV/GCV|TC4|PF2|O|17/20
VRS|GCV/GCV|TC4|PF3|O|26
VRS|GCV/GCV|TC4|PF4|O|24
VRS|SC3|TC4|PF2|B|32
VRS|SC3|TC4|PF3|B|26
VRS|SC3|TC4|PF4|B|24
VRS|SL3|TC4|PF2|B|34
VRS|SL3|TC4|PF3|B|28
VRS|SL3|TC4|PF4|B|25
VRS|GC3/SC2|TC8|PF3|B|18*/23
VRS|GC3/SC2|TC8|PF4|B|18*/20
VRS|GC3/SC2|TC7|PF3|B|18*/21
VRS|GC3/SC2|TC7|PF4|B|18*/18
VRS|GC3/SC2|TC6|PF3|R|18*/20
VRS|GC3/SC2|TC6|PF4|R|18*/18
VRS|GC3/SC2|TC5|PF2|V|19/27
VRS|GC3/SC2|TC5|PF3|V|18/18
VRS|GC3/SC2|TC5|PF4|V|15/17
VRS|GC3/SC2|TC4|PF2|O|18/27
VRS|GC3/SC2|TC4|PF3|O|18/18
VRS|GC3/SC2|TC4|PF4|O|15/16
VRS|GLp/SL2|TC8|PF3|B|19*/29
VRS|GLp/SL2|TC8|PF4|B|18*/23
VRS|GLp/SL2|TC7|PF3|B|18*/26
VRS|GLp/SL2|TC7|PF4|B|18*/21
VRS|GLp/SL2|TC6|PF3|R|18*/24
VRS|GLp/SL2|TC6|PF4|R|18*/19
VRS|GLp/SL2|TC5|PF2|V|20/30
VRS|GLp/SL2|TC5|PF3|V|18/20
VRS|GLp/SL2|TC5|PF4|V|15/21
VRS|GLp/SL2|TC4|PF2|O|19/28
VRS|GLp/SL2|TC4|PF3|O|18/19
VRS|GLp/SL2|TC4|PF4|O|15/18
VRS|GB3/GC3|TC8|PF3|B|8/9/25
VRS|GB3/GC3|TC8|PF4|B|8/8/24
VRS|GB3/GC3|TC7|PF3|B|8/8/24
VRS|GB3/GC3|TC7|PF4|B|14/22
VRS|GB3/GC3|TC6|PF3|B|14/22
VRS|GB3/GC3|TC6|PF4|B|13/21
VRS|GB3/GC3|TC5|PF2|B|7/8/23
VRS|GB3/GC3|TC5|PF3|B|12/20
VRS|GB3/GC3|TC5|PF4|B|11/19
VRS|GB3/GC3|TC4|PF2|R|7/8/21
VRS|GB3/GC3|TC4|PF3|R|12/18
VRS|GB3/GLp|TC8|PF3|B|9/9/26
VRS|GB3/GLp|TC8|PF4|B|8/8/24
VRS|GB3/GLp|TC7|PF3|B|8/8/24
VRS|GB3/GLp|TC7|PF4|B|14/22
VRS|GB3/GLp|TC6|PF3|B|14/22
VRS|GB3/GLp|TC6|PF4|B|13/21
VRS|GB3/GLp|TC5|PF2|B|7/8/23
VRS|GB3/GLp|TC5|PF3|B|12/20
VRS|GB3/GLp|TC5|PF4|B|10/18
VRS|GB3/GLp|TC4|PF2|R|14/20
VRS|GB3/GLp|TC4|PF3|R|12/18
VRS|GB3/SC3|TC8|PF3|B|8/8/24
VRS|GB3/SC3|TC8|PF4|B|14/22
VRS|GB3/SC3|TC7|PF3|B|14/22
VRS|GB3/SC3|TC7|PF4|B|13/21
VRS|GB3/SC3|TC6|PF3|B|13/21
VRS|GB3/SC3|TC6|PF4|B|11/19
VRS|GB3/SC3|TC5|PF2|B|13/21
VRS|GB3/SC3|TC5|PF3|B|10/18
VRS|GB3/SL3|TC8|PF3|B|9/9/26
VRS|GB3/SL3|TC8|PF4|B|8/8/24
VRS|GB3/SL3|TC7|PF3|B|8/8/24
VRS|GB3/SL3|TC7|PF4|B|14/22
VRS|GB3/SL3|TC6|PF3|B|14/22
VRS|GB3/SL3|TC6|PF4|B|12/20
VRS|GB3/SL3|TC5|PF2|B|14/22
VRS|GB3/SL3|TC5|PF3|B|11/19
VRS|GB3/SL3|TC5|PF4|B|10/18
VRS|GB3/SL3|TC4|PF2|R|14/20
VRS|BAC/BC2|TC8|PF3|-|20/18
VRS|BAC/BC2|TC7|PF3|-|19/18
VRS|BAC/BC2|TC6|PF3|-|19/15
VRS|BAC/BC2|TC5|PF2|-|17/18
VRS|BAC/BC2|TC5|PF3|-|17/15
VRS|BC5g/BC2|TC8|PF3|-|22/18
VRS|BC5g/BC2|TC7|PF3|-|23/15
VRS|BC5g/BC2|TC6|PF3|-|21/15
VRS|BC5g/BC2|TC5|PF2|-|19/18
VRS|BC5g/BC2|TC5|PF3|-|19/15
VRS|BAC/BBSG|TC8|PF3|-|25/5
VRS|BAC/BBSG|TC8|PF4|-|23/5
VRS|BAC/BBSG|TC7|PF3|-|24/5
VRS|BAC/BBSG|TC7|PF4|-|22/5
VRS|BAC/BBSG|TC6|PF3|-|22/5
VRS|BAC/BBSG|TC6|PF4|-|20/5
VRS|BAC/BBSG|TC5|PF3|-|20/5
VRS|BAC/BBSG|TC5|PF4|-|18/5
VRS|BC5/BC2|TC5|PF2|-|23/18
VRS|BC5/BC2|TC5|PF3|-|22/15
VRS|BC5/BC2|TC5|PF4|-|21/12
VRS|BC5/BC2|TC4|PF2|-|20/18
VRS|BC5/BC2|TC4|PF3|-|20/15
VRS|BC5/BC2|TC4|PF4|-|20/12
VRS|BC5/GC3|TC5|PF2|-|24/20
VRS|BC5/GC3|TC5|PF3|-|20/18
VRS|BC5/GC3|TC5|PF4|-|20/15
VRS|BC5/GC3|TC4|PF2|-|22/20
VRS|BC5/GC3|TC4|PF3|-|18/18
VRS|BC5/GC3|TC4|PF4|-|18/15
VRS|DALLE/CD|TC5|PF2|-|37/10
VRS|DALLE/CD|TC5|PF3|-|35/10
VRS|DALLE/CD|TC5|PF4|-|33/10
VRS|DALLE/CD|TC4|PF2|-|35/10
VRS|DALLE/CD|TC4|PF3|-|33/10
VRS|DALLE/CD|TC4|PF4|-|31/10
VRS|GB3/GNT/CdForme(MTLH)|TC5|PF3|B|9/9/12
VRS|GB3/GNT/CdForme(MTLH)|TC5|PF4|B|8/8/12
VRS|GB3/GNT/CdForme(MTLH)|TC4|PF3|R|14/12
VRS|GB3/GNT/CdForme(MTLH)|TC4|PF4|R|12/12
VRNS|GB2/GB2|TC7|PF3|B|14/14
VRNS|GB2/GB2|TC7|PF4|B|12/13
VRNS|GB2/GB2|TC6|PF2|B|14/14
VRNS|GB2/GB2|TC6|PF3|B|11/12
VRNS|GB2/GB2|TC6|PF4|B|10/11
VRNS|GB2/GB2|TC5|PF2|B|11/12
VRNS|GB2/GB2|TC5|PF3|B|9/9
VRNS|GB2/GB2|TC5|PF4|B|8/8
VRNS|GB2/GB2|TC4|PF2|R|10/11
VRNS|GB2/GB2|TC4|PF3|R|8/8
VRNS|GB2/GB2|TC4|PF4|R|14
VRNS|GB2/GB2|TC3|PF2|R|8/9
VRNS|GB2/GB2|TC3|PF3|R|12*
VRNS|GB2/GB2|TC3|PF4|R|10*
VRNS|GB2/GB2|TC2|PF2|R|13
VRNS|GB2/GB2|TC2|PF3|R|9*
VRNS|GB2/GB2|TC2|PF4|R|8*
VRNS|GB3/GB3|TC7|PF3|B|12/13
VRNS|GB3/GB3|TC7|PF4|B|11/12
VRNS|GB3/GB3|TC6|PF2|B|13/13
VRNS|GB3/GB3|TC6|PF3|B|10/11
VRNS|GB3/GB3|TC6|PF4|B|9/9
VRNS|GB3/GB3|TC5|PF2|B|10/11
VRNS|GB3/GB3|TC5|PF3|B|8/8
VRNS|GB3/GB3|TC5|PF4|B|14
VRNS|GB3/GB3|TC4|PF2|R|9/10
VRNS|GB3/GB3|TC4|PF3|R|14
VRNS|GB3/GB3|TC4|PF4|R|11*
VRNS|GB3/GB3|TC3|PF2|R|8/8
VRNS|GB3/GB3|TC3|PF3|R|11*
VRNS|GB3/GB3|TC3|PF4|R|8*
VRNS|GB3/GB3|TC2|PF2|R|12*
VRNS|GB3/GB3|TC2|PF3|R|8*
VRNS|GB3/GB3|TC2|PF4|V|8*
VRNS|EME2/EME2|TC7|PF3|B|9/10
VRNS|EME2/EME2|TC7|PF4|B|8/9
VRNS|EME2/EME2|TC6|PF2|B|9/10
VRNS|EME2/EME2|TC6|PF3|B|6/9
VRNS|EME2/EME2|TC6|PF4|B|12*
VRNS|EME2/EME2|TC5|PF2|R|10/10
VRNS|EME2/EME2|TC5|PF3|R|7/9
VRNS|EME2/EME2|TC5|PF4|R|6/8
VRNS|EME2/EME2|TC4|PF2|R|6/10
VRNS|EME2/EME2|TC4|PF3|R|12*
VRNS|EME2/EME2|TC4|PF4|R|10*
VRNS|GC3/GC3|TC7|PF4|B|16*/15
VRNS|GC3/GC3|TC6|PF2|R|22*/20
VRNS|GC3/GC3|TC6|PF3|R|17*/18
VRNS|GC3/GC3|TC6|PF4|R|16*/15
VRNS|GC3/GC3|TC5|PF2|V|20/20
VRNS|GC3/GC3|TC5|PF3|V|30
VRNS|GC3/GC3|TC5|PF4|V|28
VRNS|GC3/GC3|TC4|PF2|O|20/20
VRNS|GC3/GC3|TC4|PF3|O|29
VRNS|GC3/GC3|TC4|PF4|O|27
VRNS|GC3/GC3|TC3|PF2|O|32
VRNS|GC3/GC3|TC3|PF3|O|27
VRNS|GC3/GC3|TC3|PF4|O|25
VRNS|GC3/GC3|TC2|PF2|O|30
VRNS|GC3/GC3|TC2|PF3|O|25
VRNS|GC3/GC3|TC2|PF4|O|23
VRNS|GC4/GC4|TC7|PF4|B|16*/15
VRNS|GC4/GC4|TC6|PF2|R|19*/20
VRNS|GC4/GC4|TC6|PF3|R|17*/18
VRNS|GC4/GC4|TC6|PF4|R|15*/15
VRNS|GC4/GC4|TC5|PF2|V|18*/20
VRNS|GC4/GC4|TC5|PF3|V|25*
VRNS|GC4/GC4|TC5|PF4|V|23*
VRNS|GC4/GC4|TC4|PF2|O|17*/20
VRNS|GC4/GC4|TC4|PF3|O|25*
VRNS|GC4/GC4|TC4|PF4|O|22*
VRNS|GC4/GC4|TC3|PF2|O|28*
VRNS|GC4/GC4|TC3|PF3|O|23*
VRNS|GC4/GC4|TC3|PF4|O|21*
VRNS|GC4/GC4|TC2|PF2|O|26*
VRNS|GC4/GC4|TC2|PF3|O|22*
VRNS|GC4/GC4|TC2|PF4|O|19*
VRNS|GC3/SC3|TC7|PF4|B|16*/15
VRNS|GC3/SC3|TC6|PF2|R|22*/20
VRNS|GC3/SC3|TC6|PF3|R|17*/18
VRNS|GC3/SC3|TC6|PF4|R|16*/15
VRNS|GC3/SC3|TC5|PF2|V|20/20
VRNS|GC3/SC3|TC5|PF3|V|30
VRNS|GC3/SC3|TC5|PF4|V|28
VRNS|GC3/SC3|TC4|PF2|O|20/20
VRNS|GC3/SC3|TC4|PF3|O|29
VRNS|GC3/SC3|TC4|PF4|O|27
VRNS|GC3/SC3|TC3|PF2|O|32
VRNS|GC3/SC3|TC3|PF3|O|27
VRNS|GC3/SC3|TC3|PF4|O|25
VRNS|GC3/SC3|TC2|PF2|O|30
VRNS|GC3/SC3|TC2|PF3|O|25
VRNS|GC3/SC3|TC2|PF4|O|23
VRNS|GLp/SL3|TC7|PF4|B|16*/15
VRNS|GLp/SL3|TC6|PF2|R|22*/20
VRNS|GLp/SL3|TC6|PF3|R|17*/18
VRNS|GLp/SL3|TC6|PF4|R|16*/15
VRNS|GLp/SL3|TC5|PF2|V|20/20
VRNS|GLp/SL3|TC5|PF3|V|30
VRNS|GLp/SL3|TC5|PF4|V|28
VRNS|GLp/SL3|TC4|PF2|O|20/20
VRNS|GLp/SL3|TC4|PF3|O|29
VRNS|GLp/SL3|TC4|PF4|O|27
VRNS|GLp/SL3|TC3|PF2|O|32
VRNS|GLp/SL3|TC3|PF3|O|27
VRNS|GLp/SL3|TC3|PF4|O|25
VRNS|GLp/SL3|TC2|PF2|O|30
VRNS|GLp/SL3|TC2|PF3|O|25
VRNS|GLp/SL3|TC2|PF4|O|23
VRNS|GLp/GLp|TC7|PF4|B|16*/15
VRNS|GLp/GLp|TC6|PF2|R|21*/20
VRNS|GLp/GLp|TC6|PF3|R|17*/18
VRNS|GLp/GLp|TC6|PF4|R|16*/15
VRNS|GLp/GLp|TC5|PF2|V|20/20
VRNS|GLp/GLp|TC5|PF3|V|29
VRNS|GLp/GLp|TC5|PF4|V|27
VRNS|GLp/GLp|TC4|PF2|O|19/20
VRNS|GLp/GLp|TC4|PF3|O|28
VRNS|GLp/GLp|TC4|PF4|O|26
VRNS|GLp/GLp|TC3|PF2|O|32
VRNS|GLp/GLp|TC3|PF3|O|27
VRNS|GLp/GLp|TC3|PF4|O|24
VRNS|GLp/GLp|TC2|PF2|O|30
VRNS|GLp/GLp|TC2|PF3|O|25
VRNS|GLp/GLp|TC2|PF4|O|22
VRNS|GLg/GLg|TC6|PF2|B|23*/22
VRNS|GLg/GLg|TC6|PF3|B|19*/19
VRNS|GLg/GLg|TC6|PF4|B|18*/17
VRNS|GLg/GLg|TC5|PF2|R|22/21
VRNS|GLg/GLg|TC5|PF3|R|18/18
VRNS|GLg/GLg|TC5|PF4|R|17/16
VRNS|GLg/GLg|TC4|PF2|V|21/20
VRNS|GLg/GLg|TC4|PF3|V|18/17
VRNS|GLg/GLg|TC4|PF4|V|16/16
VRNS|GLg/GLg|TC3|PF2|V|19/19
VRNS|GLg/GLg|TC3|PF3|V|16/16
VRNS|GLg/GLg|TC3|PF4|V|15/14
VRNS|GLg/GLg|TC2|PF2|V|18/18
VRNS|GLg/GLg|TC2|PF3|V|15/15
VRNS|GLg/GLg|TC2|PF4|V|14/13
VRNS|GCV/GCV|TC7|PF3|B|16*/18
VRNS|GCV/GCV|TC7|PF4|B|16*/15
VRNS|GCV/GCV|TC6|PF2|R|20*/20
VRNS|GCV/GCV|TC6|PF3|R|15*/18
VRNS|GCV/GCV|TC6|PF4|R|15*/15
VRNS|GCV/GCV|TC5|PF2|V|16/20
VRNS|GCV/GCV|TC5|PF3|V|26
VRNS|GCV/GCV|TC5|PF4|V|24
VRNS|GCV/GCV|TC4|PF2|O|15/20
VRNS|GCV/GCV|TC4|PF3|O|25
VRNS|GCV/GCV|TC4|PF4|O|23
VRNS|GCV/GCV|TC3|PF2|O|28
VRNS|GCV/GCV|TC3|PF3|O|23
VRNS|GCV/GCV|TC3|PF4|O|21
VRNS|GCV/GCV|TC2|PF2|O|26
VRNS|GCV/GCV|TC2|PF3|O|22
VRNS|GCV/GCV|TC2|PF4|O|20
VRNS|SC3|TC4|PF2|B|29
VRNS|SC3|TC4|PF3|B|24
VRNS|SC3|TC4|PF4|B|22
VRNS|SC3|TC3|PF2|B|27
VRNS|SC3|TC3|PF3|B|22
VRNS|SC3|TC3|PF4|B|20
VRNS|SC3|TC2|PF2|R|27
VRNS|SC3|TC2|PF3|R|22
VRNS|SC3|TC2|PF4|R|19
VRNS|SL3|TC4|PF2|B|31
VRNS|SL3|TC4|PF3|B|26
VRNS|SL3|TC4|PF4|B|23
VRNS|SL3|TC3|PF2|B|29
VRNS|SL3|TC3|PF3|B|23
VRNS|SL3|TC3|PF4|B|20
VRNS|SL3|TC2|PF2|R|28
VRNS|SL3|TC2|PF3|R|22
VRNS|SL3|TC2|PF4|R|20
VRNS|GC3/SC2|TC7|PF3|B|18*/19
VRNS|GC3/SC2|TC7|PF4|B|15*/18
VRNS|GC3/SC2|TC6|PF2|R|18*/28
VRNS|GC3/SC2|TC6|PF3|R|18*/18
VRNS|GC3/SC2|TC6|PF4|R|15*/17
VRNS|GC3/SC2|TC5|PF2|V|18/24
VRNS|GC3/SC2|TC5|PF3|V|16/18
VRNS|GC3/SC2|TC5|PF4|V|15/16
VRNS|GC3/SC2|TC4|PF2|O|18/22
VRNS|GC3/SC2|TC4|PF3|O|15/18
VRNS|GC3/SC2|TC4|PF4|O|15/15
VRNS|GLp/SL2|TC7|PF3|B|18*/21
VRNS|GLp/SL2|TC7|PF4|B|18*/18
VRNS|GLp/SL2|TC6|PF2|R|20*/28
VRNS|GLp/SL2|TC6|PF3|R|18*/20
VRNS|GLp/SL2|TC6|PF4|R|16*/18
VRNS|GLp/SL2|TC5|PF2|V|18/28
VRNS|GLp/SL2|TC5|PF3|V|18/18
VRNS|GLp/SL2|TC5|PF4|V|15/17
VRNS|GLp/SL2|TC4|PF2|O|18/25
VRNS|GLp/SL2|TC4|PF3|O|16/18
VRNS|GLp/SL2|TC4|PF4|O|15/16
VRNS|GB3/GC3|TC7|PF3|B|15/23
VRNS|GB3/GC3|TC7|PF4|B|13/21
VRNS|GB3/GC3|TC6|PF2|B|8/8/24
VRNS|GB3/GC3|TC6|PF3|B|13/21
VRNS|GB3/GC3|TC6|PF4|B|12/20
VRNS|GB3/GC3|TC5|PF2|B|13/21
VRNS|GB3/GC3|TC5|PF3|B|11/19
VRNS|GB3/GLp|TC7|PF3|B|14/22
VRNS|GB3/GLp|TC7|PF4|B|13/21
VRNS|GB3/GLp|TC6|PF2|B|8/8/24
VRNS|GB3/GLp|TC6|PF3|B|13/21
VRNS|GB3/GLp|TC6|PF4|B|12/20
VRNS|GB3/GLp|TC5|PF2|B|13/21
VRNS|GB3/GLp|TC5|PF3|B|10/18
VRNS|GB3/SC3|TC7|PF3|B|13/21
VRNS|GB3/SC3|TC7|PF4|B|11/19
VRNS|GB3/SC3|TC6|PF2|B|14/22
VRNS|GB3/SC3|TC6|PF3|B|11/19
VRNS|GB3/SC3|TC6|PF4|B|10/18
VRNS|GB3/SC3|TC5|PF2|B|12/20
VRNS|GB3/SL3|TC7|PF3|B|14/22
VRNS|GB3/SL3|TC7|PF4|B|12/20
VRNS|GB3/SL3|TC6|PF2|B|15/23
VRNS|GB3/SL3|TC6|PF3|B|12/20
VRNS|GB3/SL3|TC6|PF4|B|11/19
VRNS|GB3/SL3|TC5|PF2|B|13/21
VRNS|GB3/SL3|TC5|PF3|B|10/18
VRNS|BAC/BC2|TC7|PF3|-|19/15
VRNS|BAC/BC2|TC6|PF2|-|18/18
VRNS|BAC/BC2|TC6|PF3|-|17/15
VRNS|BAC/BC2|TC5|PF2|-|16/18
VRNS|BAC/BC2|TC5|PF3|-|15/15
VRNS|BC5g/BC2|TC7|PF3|-|21/15
VRNS|BC5g/BC2|TC6|PF2|-|20/18
VRNS|BC5g/BC2|TC6|PF3|-|19/15
VRNS|BC5g/BC2|TC5|PF2|-|18/18
VRNS|BC5g/BC2|TC5|PF3|-|17/15
VRNS|BAC/BBSG|TC7|PF3|-|22/5
VRNS|BAC/BBSG|TC7|PF4|-|21/5
VRNS|BAC/BBSG|TC6|PF3|-|21/5
VRNS|BAC/BBSG|TC6|PF4|-|19/5
VRNS|BAC/BBSG|TC5|PF3|-|19/5
VRNS|BAC/BBSG|TC5|PF4|-|17/5
VRNS|BC5/BC2|TC6|PF2|-|23/18
VRNS|BC5/BC2|TC6|PF3|-|22/15
VRNS|BC5/BC2|TC6|PF4|-|22/12
VRNS|BC5/BC2|TC5|PF2|-|21/18
VRNS|BC5/BC2|TC5|PF3|-|20/15
VRNS|BC5/BC2|TC5|PF4|-|20/12
VRNS|BC5/BC2|TC4|PF2|-|18/18
VRNS|BC5/BC2|TC4|PF3|-|18/15
VRNS|BC5/BC2|TC4|PF4|-|18/12
VRNS|BC5/BC2|TC3|PF2|-|16/18
VRNS|BC5/BC2|TC3|PF3|-|16/15
VRNS|BC5/BC2|TC3|PF4|-|17/12
VRNS|BC5/GC3|TC6|PF2|-|24/20
VRNS|BC5/GC3|TC6|PF3|-|21/18
VRNS|BC5/GC3|TC6|PF4|-|20/15
VRNS|BC5/GC3|TC5|PF2|-|22/20
VRNS|BC5/GC3|TC5|PF3|-|19/18
VRNS|BC5/GC3|TC5|PF4|-|18/15
VRNS|BC5/GC3|TC4|PF2|-|20/20
VRNS|BC5/GC3|TC4|PF3|-|17/18
VRNS|BC5/GC3|TC4|PF4|-|16/15
VRNS|DALLE/CD|TC5|PF2|-|36/10
VRNS|DALLE/CD|TC5|PF3|-|33/10
VRNS|DALLE/CD|TC5|PF4|-|31/10
VRNS|DALLE/CD|TC4|PF2|-|34/10
VRNS|DALLE/CD|TC4|PF3|-|31/10
VRNS|DALLE/CD|TC4|PF4|-|30/10
VRNS|DALLE/CD|TC3|PF2|-|29/10
VRNS|DALLE/CD|TC3|PF3|-|27/10
VRNS|DALLE/CD|TC3|PF4|-|25/10
VRNS|DALLE/CD|TC2|PF2|-|28/10
VRNS|DALLE/CD|TC2|PF3|-|26/10
VRNS|DALLE/CD|TC2|PF4|-|24/10
VRNS|GB3/GNT/CdForme(MTLH)|TC6|PF3|B|9/10/12
VRNS|GB3/GNT/CdForme(MTLH)|TC6|PF4|B|8/9/12
VRNS|GB3/GNT/CdForme(MTLH)|TC5|PF3|B|12/12
VRNS|GB3/GNT/CdForme(MTLH)|TC5|PF4|B|10/12
VRNS|GB3/GNT/CdForme(MTLH)|TC4|PF3|R|8/12
VRNS|GB3/GNT/CdForme(MTLH)|TC4|PF4|R|8/12
VRNS|GB3/GNT|TC5|PF2|B|8/9/35
VRNS|GB3/GNT|TC5|PF3|B|13/20
VRNS|GB3/GNT|TC4|PF2|R|14/35
VRNS|GB3/GNT|TC4|PF3|R|11/20
VRNS|GB3/GNT|TC3|PF2|R|10/35
VRNS|GB3/GNT|TC3|PF3|R|8/20
VRNS|GB3/GNT|TC2|PF2|V|9/35
VRNS|GNT/GNT|TC3|PF2|N|8/25/25
VRNS|GNT/GNT|TC3|PF3|N|8/25
VRNS|GNT/GNT|TC3|PF4|N|8/15
VRNS|GNT/GNT|TC2|PF2|N|5/20/25
VRNS|GNT/GNT|TC2|PF3|N|5/25
VRNS|GNT/GNT|TC2|PF4|N|5/15
`;

/**
 * Ce que désigne chaque sigle de fiche : famille, clé de la bibliothèque
 * française (null quand le matériau n'y est pas : béton armé continu, dalle,
 * couche drainante…) et libellé.
 */
const MATERIAUX_FICHES = {
  GB2: ["bitumineux", "GB2", "Grave-bitume classe 2"],
  GB3: ["bitumineux", "GB3", "Grave-bitume classe 3"],
  EME2: ["bitumineux", "EME2", "Enrobé à module élevé classe 2"],
  BBSG: ["bitumineux", "BBSG2", "Béton bitumineux semi-grenu"],
  GC3: ["hydraulique", "GC-t3", "Grave-ciment classe 3"],
  GC4: ["hydraulique", "GC-t4", "Grave-ciment classe 4"],
  GCV: ["hydraulique", "GCV-t3", "Grave-cendres volantes"],
  GLp: ["hydraulique", "GLP-t3", "Grave-laitier prébroyé"],
  GLg: ["hydraulique", null, "Grave-laitier granulé"],
  SC2: ["hydraulique", "SC-t2", "Sable-ciment classe 2"],
  SC3: ["hydraulique", "SC-t3", "Sable-ciment classe 3"],
  SL2: ["hydraulique", "SL-t2", "Sable-laitier classe 2"],
  SL3: ["hydraulique", "SL-t3", "Sable-laitier classe 3"],
  BC2: ["hydraulique", "BC2", "Béton maigre classe 2"],
  BC5: ["hydraulique", "BC5", "Béton de ciment classe 5"],
  BC5g: ["hydraulique", "BC5", "Béton de ciment classe 5, goujonné"],
  BAC: ["hydraulique", null, "Béton armé continu"],
  DALLE: ["hydraulique", null, "Dalle de béton de ciment"],
  "CdForme(MTLH)": ["hydraulique", null, "Couche de forme traitée aux liants hydrauliques"],
  GNT: ["sol", null, "Grave non traitée"],
  CD: ["sol", null, "Couche drainante"],
};
const materiauFiche = (code) => MATERIAUX_FICHES[code] ?? [null, null, code];

const JEUX = {
  B: "jeu bleu de la page de commentaires",
  R: "jeu rose de la page de commentaires",
  V: "jeu vert de la page de commentaires",
  O: "jeu orange de la page de commentaires",
  N: "épaisseur chiffrée sur la fiche",
};

/** Épaisseur d'un jeton « 20* », « 32(2) » : le nombre de tête. */
const cm = (jeton) => parseFloat(jeton.match(/^[\d.,]+/)[0].replace(",", "."));

function lire() {
  const fiches = [];
  for (const brut of DONNEES.split("\n")) {
    const l = brut.trim();
    if (!l) continue;
    const f = l.split("|");
    if (f.length !== 6) continue;
    const [serie, feuille, trafic, portance, surface] = f;
    const parts = f[5].split("/").filter(Boolean);
    const codes = feuille.split("/").filter(Boolean);
    const couches = [];
    let etoile = false, compactage = false, decalage = 0;

    // La couche de surface chiffrée (fiche GNT/GNT) est la première épaisseur listée.
    if (surface === "N" && parts.length > 0) {
      couches.push({ nature: "Couche de surface bitumineuse", epCm: cm(parts[0]), famille: "bitumineux",
                     materiau: "BBSG2", interface: null });
      decalage = 1;
    }
    const nAssise = parts.length - decalage;
    for (let i = 0; i < nAssise; i++) {
      const jeton = parts[decalage + i];
      if (jeton.includes("*")) etoile = true;
      if (jeton.includes("(2)")) compactage = true;
      // La dernière sous-couche revient à la fondation, les premières à la base
      // (une base peut être répandue en plusieurs passes).
      const code = nAssise === codes.length ? codes[i] : i === nAssise - 1 ? codes[codes.length - 1] : codes[0];
      const [famille, materiau, libelle] = materiauFiche(code);
      const nature = nAssise > codes.length && i < nAssise - 1 && codes.length > 1
        ? `${libelle} (passe ${i + 1})` : libelle;
      couches.push({ nature, epCm: cm(jeton), famille, materiau, interface: null });
    }

    const notes = [NOTE_EPAISSEURS];
    if (surface !== "-" && surface !== "N") notes.push(`Couche de surface : ${JEUX[surface]}. ${NOTE_COUCHE_SURFACE}`);
    if (etoile) notes.push(codes[0].startsWith("GB") || codes[0].startsWith("EME") ? NOTE_NIVELLEMENT : NOTE_PREFISSURATION);
    if (compactage) notes.push(NOTE_COMPACTAGE);

    fiches.push({
      classeTrafic: trafic + (serie === "VRS" ? "₃₀" : "₂₀"),
      classePortance: portance,
      famille: `${feuille} — ${serie}`,
      couches,
      source: REFERENCE_FICHES,
      provisoire: true,
      note: notes.join(" "),
      intervention: "neuve",
      jeuSurface: surface,
    });
  }
  return fiches;
}

/** Les fiches des deux séries réunies (une entrée par cellule). */
export const FICHES_1998 = lire();

/**
 * Jeu de couche de surface d'une fiche : « B », « R », « V », « O » (bleu,
 * rose, vert, orange), « N » (chiffré sur la fiche) ou « - » (chaussées béton).
 * L'épaisseur d'assise seule n'est donc pas monotone d'un jeu à l'autre.
 */
export const jeuCoucheSurface = (fiche) => fiche?.jeuSurface ?? "-";

/** Les fiches d'une série, réseau structurant ou non. */
export const fichesDuReseau = (reseau) => {
  const suffixe = estStructurant(reseau) ? " — VRS" : " — VRNS";
  return FICHES_1998.filter((f) => f.famille.endsWith(suffixe));
};

/** Le catalogue, indexé par classe de trafic poids lourds cumulé (TC4₃₀, TC4₂₀…). */
export const CATALOGUE_1998 = catalogueStructures({
  pays: "france", reference: REFERENCE_FICHES, fiches: FICHES_1998, cle: "classe-cumulee",
});
