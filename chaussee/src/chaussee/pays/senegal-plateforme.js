// Détermination de la plate-forme support de chaussée : sol → arase → couche
// de forme → plate-forme (portage de IPlatformCatalog / SenegalPlatform). Le
// moteur a besoin d'un module ; cette chaîne est la façon dont le catalogue le
// fait obtenir à partir d'essais de sol (CBR), sans le faire inventer.
//
// Contrat d'une plate-forme (objet) :
//   reference, classesArase [{ nom, moduleMin (MPa), cbrMin, note }],
//   optionsCoucheForme [{ classeArase, traitee, classeTraitee, specNonTraitee,
//                         epCm, deuxCouches, classePlateforme, materiau, libelle }],
//   classerArase(cbr), epaisseurMinPstCm(cbr), plateformeSansCoucheForme(arase),
//   criteresSolsInaptes [texte], conseil.

/** Classe d'arase : portance à LONG TERME de la partie supérieure des terrassements. */
export const classeArase = (nom, moduleMin, cbrMin, note = null) => ({ nom, moduleMin, cbrMin, note });

/**
 * Ligne de dimensionnement de couche de forme : partant d'une classe d'arase,
 * l'épaisseur de matériau (traité ou non) qui donne une classe de plate-forme.
 * `deuxCouches` : mise en œuvre généralement en deux couches (astérisque de la source).
 */
export function optionCoucheForme(classeArase, traitee, classeTraitee, specNonTraitee, epCm, deuxCouches, classePlateforme) {
  const materiau = traitee ? `traitée, ${classeTraitee}` : `non traitée, ${specNonTraitee}`;
  return {
    classeArase, traitee, classeTraitee, specNonTraitee, epCm, deuxCouches, classePlateforme, materiau,
    libelle: `${classeArase} + ${Math.round(epCm)} cm (${materiau})${deuxCouches ? ", en deux couches" : ""} → ${classePlateforme}`,
  };
}

// Tableau 6 : E min à long terme et CBR min indicatif.
const ARASES = [
  classeArase("AR0", 0, null, "E < 20 MPa, CBR < 5 : couche de forme indispensable."),
  classeArase("AR1", 20, 5, "Classe la plus courante au Sénégal en l'absence de facteur favorable."),
  classeArase("AR2", 50, 10, "Atteignable pour les sables et graves propres, insensibles à l'eau, ou après traitement."),
  classeArase("AR2qs", 80, 15, null),
  classeArase("AR3", 120, 25, "CBR peu significatif pour les arases traitées."),
  classeArase("AR4", 200, 40, "CBR peu significatif pour les arases traitées."),
];

// Tableaux 7 et 8, cellule par cellule.
const OPTIONS = [
  // Tableau 7 — couche de forme NON traitée, depuis AR0.
  optionCoucheForme("AR0", false, null, "CBR 5 à 10", 45, true, "PF1"),
  optionCoucheForme("AR0", false, null, "CBR 10 à 15", 35, false, "PF1"),
  optionCoucheForme("AR0", false, null, "CBR 15 à 30", 30, false, "PF1"),
  optionCoucheForme("AR0", false, null, "CBR 10 à 15", 45, true, "PF2"),
  optionCoucheForme("AR0", false, null, "CBR 15 à 30", 35, false, "PF2"),
  optionCoucheForme("AR0", false, null, "CBR 15 à 40", 50, true, "PF2qs"),
  // Tableau 8 — couche de forme TRAITÉE. La cellule AR1 / classe 3 → PF2 est vide.
  optionCoucheForme("AR1", true, "Classe 4", null, 30, false, "PF2"),
  optionCoucheForme("AR1", true, "Classe 5", null, 35, false, "PF2"),
  optionCoucheForme("AR1", true, "Classe 3", null, 30, false, "PF3"),
  optionCoucheForme("AR1", true, "Classe 4", null, 35, false, "PF3"),
  optionCoucheForme("AR1", true, "Classe 5", null, 50, true, "PF3"),
  optionCoucheForme("AR1", true, "Classe 3", null, 40, true, "PF4"),
  optionCoucheForme("AR1", true, "Classe 4", null, 45, true, "PF4"),
  optionCoucheForme("AR1", true, "Classe 5", null, 55, true, "PF4"),
  optionCoucheForme("AR2", true, "Classe 3", null, 25, false, "PF3"),
  optionCoucheForme("AR2", true, "Classe 4", null, 30, false, "PF3"),
  optionCoucheForme("AR2", true, "Classe 5", null, 35, false, "PF3"),
  optionCoucheForme("AR2", true, "Classe 3", null, 30, false, "PF4"),
  optionCoucheForme("AR2", true, "Classe 4", null, 35, false, "PF4"),
  optionCoucheForme("AR2", true, "Classe 5", null, 45, true, "PF4"),
];

/**
 * Chaîne de détermination de la plate-forme du catalogue Sénégal 2015
 * (chapitre 3) : tableau 6 (classes d'arase, p. 28), épaisseurs minimales de
 * PST (p. 30), tableaux 7 et 8 (couche de forme, p. 32), tableau 11 (p. 35).
 */
export const PLATEFORME_SENEGAL = Object.freeze({
  reference: "Catalogue Sénégal 2015, chap. 3 — Tableaux 6 (p. 28), 7 et 8 (p. 32), 11 (p. 35)",
  classesArase: ARASES,
  optionsCoucheForme: OPTIONS,

  /** Tableau 6 : la classe dont le CBR minimal est le plus élevé encore atteint (AR0 sous CBR 5). */
  classerArase(cbr) {
    let meilleure = null;
    for (const a of ARASES) {
      if (a.cbrMin == null) continue;
      if (cbr >= a.cbrMin && (meilleure?.cbrMin == null || a.cbrMin > meilleure.cbrMin)) meilleure = a;
    }
    return meilleure ?? ARASES[0];
  },

  /** Épaisseur minimale (cm) de matériau de PST (p. 30) : 25 / 35 / 45 / 55 / 65 cm selon le CBR. */
  epaisseurMinPstCm(cbr) {
    return cbr < 5 ? 25 : cbr <= 7 ? 35 : cbr <= 14 ? 45 : cbr <= 29 ? 55 : 65;
  },

  /**
   * Sans couche de forme, la plate-forme prend le rang de l'arase : les critères
   * de réception d'une arase ARi sont ceux de la plate-forme PFi (p. 28). AR0
   * n'ouvre aucune plate-forme.
   */
  plateformeSansCoucheForme(arase) {
    return { AR1: "PF1", AR2: "PF2", AR2qs: "PF2qs", AR3: "PF3", AR4: "PF4" }[arase] ?? null;
  },

  // p. 30, « Sols à éliminer ».
  criteresSolsInaptes: [
    "sols hétérogènes",
    "sols gonflants (gonflement linéaire dans le moule CBR > 2 % après 4 jours d'immersion)",
    "sols organiques (teneur en matières organiques > 10 %)",
    "sols très compressibles (vases, tourbes : Cc/(1+e0) > 0,2)",
    "sols très argileux ou à faible portance (IP ≥ 40, ou wL ≥ 70, ou CBR < 5)",
  ],

  conseil:
    "Rechercher la portance maximale : viser PF2qs voire PF3 au moins pour les trafics de " +
    "classe C6 et plus. PF1 est réservée au réseau secondaire (RD, RR) et n'est pas retenue " +
    "sur le réseau principal (autoroute, RN). La classe d'arase la plus courante au Sénégal " +
    "est AR1 (20 MPa) : les sols y sont majoritairement sensibles à l'eau (sables et " +
    "latérites B1/B2/B5/B6 au sens du GTR NF P11-300), et le CBR du Tableau 6 n'est " +
    "qu'indicatif — il ne vaut pas critère de réception.",
});
