// Modules de départ du modèle SCT1 sénégalais (portage de SenegalStartingModuli
// de Burmister-Calc) — guide de renforcement AGEROUTE, VFP du 15 décembre 2023,
// § 5.1.1, tableaux 4, 5 et 6.
//
// Rien ici ne vient du guide français : le Sénégal n'utilise ni le tableau 31
// du Cerema (carotte × paroi) ni son tableau 20. Il entre par l'ÉTAT DE
// DÉGRADATION et, pour les enrobés, par la TEMPÉRATURE DE SURFACE au moment de
// la mesure ; ses modules sont absolus ; le modèle SCT1 est pris à 2 Hz.
//
// Vocabulaire : état "sain" | "fissure" | "desagrege" ; rôle de l'enrobé
// "surface" | "assise" ; humidité "sec" | "humide" | "tres-humide" ; classes
// non liées "GL1" | "GL2" | "GLa1" | "GLa2" | "GNT" | "sable" ; classes
// hydrauliques "GLc" | "GC" | "BQc" | "SC".

export const REFERENCE_SENEGAL_MODULES =
  "Guide de renforcement des chaussées au Sénégal, AGEROUTE — rapport final provisoire VFP "
  + "du 15 décembre 2023, § 5.1.1, tableaux 4, 5 et 6";

export const ETATS_SENEGAL = Object.freeze(["sain", "fissure", "desagrege"]);
export const ROLES_BITUMINEUX_SENEGAL = Object.freeze(["surface", "assise"]);
export const HUMIDITES_SENEGAL = Object.freeze(["sec", "humide", "tres-humide"]);
export const CLASSES_NON_LIEES_SENEGAL = Object.freeze(["GL1", "GL2", "GLa1", "GLa2", "GNT", "sable"]);
export const CLASSES_HYDRAULIQUES_SENEGAL = Object.freeze(["GLc", "GC", "BQc", "SC"]);

/** Fréquence du modèle SCT1 : l'essai de déflexion est lent (§ 5.1.2). */
export const FREQUENCE_SCT1_HZ = 2;

/** Température au-delà de laquelle l'enrobé sain passe à sa valeur basse (tableau 4). */
export const SEUIL_SURFACE_CHAUDE_C = 30;

/** Épaisseur conventionnelle du sol support, comme dans le guide français (m). */
export const EPAISSEUR_SOL_SENEGAL_M = 6;

/** Épaisseur maximale d'une sous-couche non liée (m, § 5.1.1). */
export const EPAISSEUR_SOUS_COUCHE_SENEGAL_M = 0.10;

/**
 * Coefficients de Poisson imposés aux modèles SCT1, SCT2 et SCT3 (§ 5.1.1) :
 * 0,45 pour les bitumineux (0,35 en France), 0,25 pour les traités, 0,35 sinon.
 */
export function poissonSenegal(famille) {
  if (famille === "bitumineux") return 0.45;
  if (famille === "hydraulique") return 0.25;
  return 0.35;
}

/**
 * Module d'un enrobé en place (MPa), tableau 4. Le module d'un matériau SAIN
 * dépend de la température de surface relevée pendant l'essai ; fissuré et
 * désagrégé valent la même chose à toute température.
 */
export function moduleBitumineuxSenegal(role, etat, temperatureSurfaceC) {
  if (etat === "fissure") return 800;
  if (etat === "desagrege") return 600;
  const chaud = temperatureSurfaceC > SEUIL_SURFACE_CHAUDE_C;
  return role === "surface" ? (chaud ? 800 : 1200) : (chaud ? 1200 : 2200);
}

/**
 * Rapport de sous-découpage (tableau 5) : il vaut 2 SEULEMENT à l'état sec et
 * tombe à 1,5 dès que le matériau est humide. Un sable monte moins : 1,5 à
 * sec, 1,2 sinon.
 */
export function rapportSousCoucheSenegal(materiau, humidite) {
  if (materiau === "sable") return humidite === "sec" ? 1.5 : 1.2;
  return humidite === "sec" ? 2.0 : 1.5;
}

const MAX_NON_LIES = {
  GL1: [200, 150, 100],
  GL2: [400, 300, 200],
  GLa1: [400, 300, 200],
  GLa2: [600, 500, 400],
  GNT: [600, 500, 400],
  sable: [300, 200, 150],
};

/** Module maximal d'un matériau non lié en place (MPa), tableau 5. */
export function moduleMaxNonLieSenegal(materiau, humidite) {
  const ligne = MAX_NON_LIES[materiau] ?? MAX_NON_LIES.sable;
  return humidite === "sec" ? ligne[0] : humidite === "humide" ? ligne[1] : ligne[2];
}

/** Module d'une sous-couche non liée : le multiple de celle du dessous, plafonné. */
export const moduleNonLieSenegal = (dessous, materiau, humidite) =>
  Math.min(rapportSousCoucheSenegal(materiau, humidite) * dessous, moduleMaxNonLieSenegal(materiau, humidite));

export const PRUDENCE_LATERITE_AMELIOREE =
  "Grave latéritique améliorée : retenir GLa1 par sécurité tant qu'on ne connaît pas "
  + "l'évolution de sa rigidité. GLa2 n'est adoptée que si l'exploitation complète du bassin "
  + "de déflexion conduit à un module supérieur ou égal à 600 MPa (guide, § 5.1.1).";

/**
 * Module d'un matériau traité aux liants hydrauliques en place (MPa), tableau
 * 6. À l'état sain, le guide veut le module MESURÉ sur les carottages : la
 * valeur rendue est le forfait « à défaut », et `mesure` le remplace quand il
 * existe (seulement à l'état sain).
 */
export function moduleHydrauliqueSenegal(classe, etat, mesure = null) {
  if (etat === "fissure") return { GLc: 600, GC: 6000, BQc: 3000 }[classe] ?? 3500;
  if (etat === "desagrege") return { GLc: 500, GC: 500 }[classe] ?? 400;
  if (Number.isFinite(mesure)) return mesure;
  return { GLc: 2500, GC: 20000, BQc: 10000 }[classe] ?? 12000;
}

export const NOTE_HYDRAULIQUE_MESUREE =
  "Le module d'un matériau traité aux liants hydrauliques en bon état se détermine de "
  + "préférence sur les carottages (§ 4.3.2.2). Les valeurs ci-dessus ne sont que le forfait "
  + "« à défaut ».";
