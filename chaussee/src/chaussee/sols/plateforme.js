// Chaîne PST → arase → plate-forme du GTR 2024, fascicule 1, § 4.3 (portage de
// Gtr2024Platform de Burmister-Calc). C'est elle qui produit le module de Young du support de
// chaussée à partir de la géotechnique, sans le faire inventer.
//
// États hydriques : on les désigne par leur symbole du guide, du plus sec au plus humide —
// "ts" très sec, "s" sec, "m" moyen, "h" humide, "th" très humide.

import { etape, lirePaliers, memeNom, mesure, nombre } from "./justification.js";

export const REFERENCE_PLATEFORME =
  "GTR 2024 (IDRRIM/Cerema), fascicule 1, § 4.3 — tableaux 17 (p. 76-78), 18 et 19 (p. 79)";

// ─────────────────────────────── États hydriques ───────────────────────────────

/** Les cinq états hydriques, du plus sec au plus humide. */
export const ETATS_HYDRIQUES = ["ts", "s", "m", "h", "th"];

const LIBELLES_ETATS = { ts: "très sec", s: "sec", m: "moyen", h: "humide", th: "très humide" };

/** Ce que chaque état signifie pour les terrassements. */
export const SENS_ETATS = {
  ts: "Teneur en eau très faible : réemploi en général impossible en l'état.",
  s: "Teneur en eau faible : mise en œuvre moyennant humidification ou surcompactage.",
  m: "Proche de l'optimum Proctor normal : état optimum pour les terrassements.",
  h: "Teneur en eau élevée : traficabilité difficile.",
  th: "Au-delà de la teneur en eau permettant la traficabilité et la densification.",
};

/** Libellé d'un état : « humide ». */
export const libelleEtat = (e) => LIBELLES_ETATS[e] ?? null;

/** Libellé et symbole : « humide (h) ». */
export const afficherEtat = (e) => `${libelleEtat(e)} (${e})`;

/** État correspondant à un symbole saisi (« TH », « m »…), null s'il n'en est pas un. */
export function etatDepuisSymbole(symbole) {
  const s = symbole == null ? null : String(symbole).trim().toLowerCase();
  return ETATS_HYDRIQUES.includes(s) ? s : null;
}

// ─────────────────────────────── Seuils du nota ───────────────────────────────

/**
 * Portance minimale d'arase, à court terme, exigée pour mettre en œuvre une couche de forme
 * traitée à la chaux et/ou aux liants hydrauliques (nota, p. 79).
 */
export const MODULE_ARASE_MIN_COUCHE_TRAITEE = 35;

/**
 * Portance d'arase minimale, à court terme, supposée par les épaisseurs de couche de forme
 * granulaire préconisées sur PST1 (§ 4.3.5.1). En dessous, on retombe en PST0.
 */
export const MODULE_ARASE_MIN_COUCHE_PST1 = 15;

// ─────────────────────────────── Arases ───────────────────────────────

/**
 * Classes de portance de l'arase de terrassement, avec leur portance à LONG TERME (MPa) : la
 * valeur escomptable sur la durée de service, seule utilisable au dimensionnement (§ 4.3.1).
 */
export const ARASES = [
  { nom: "AR0", module: 0, note: "Portance quasi nulle : aucune couche de forme possible, reclassement obligatoire." },
  { nom: "AR1", module: 20, note: null },
  { nom: "AR2", module: 50, note: null },
  { nom: "AR3", module: 120, note: null },
];

// ─────────────────────────────── Tableau 17 : cas de PST ───────────────────────────────

const casPst = (nom, classesSol, etats, contexte, commentaire, arases) => ({
  nom, classesSol, etats, contexte, commentaire, arases,
  /** Vrai pour la PST0, qui n'ouvre aucune plate-forme et impose un reclassement. */
  exigeReclassement: arases.length === 1 && arases[0] === "AR0",
  /** États hydriques écrits comme dans le guide : « (m) ou (s) ». */
  libelleEtats: etats.map((e) => `(${e})`).join(" ou "),
});

/**
 * Tableau 17 : synoptique des PST et des arases. Les listes de classes de sol sont celles de la
 * classification GTR 2024 (F, I, S, G, VC, CH, R), pas celles du GTR 2000 (A, B, C, D).
 */
export const CAS_PST = [
  casPst("PST0",
    ["F1", "F2", "F3", "F4", "G1", "G2", "G3", "G4", "S1", "S2", "S3", "S4", "I1", "I2", "VC2"],
    ["th"],
    "Profil rasant avec nappe subaffleurante, ou déblai dans des matériaux très humides. "
    + "Portance risquant d'être quasi nulle au moment des travaux.",
    "Une PST0 ne permet pas la réalisation d'une couche de forme et nécessite un reclassement. "
    + "En phase chantier : drainage, purge, substitution ou traitement avec un liant adapté, "
    + "de manière à reclasser la PST en PST1, 2, 3 ou 4. Un rabattement de nappe peut être "
    + "nécessaire ; un dispositif de drainage définitif est fortement conseillé.",
    ["AR0"]),

  casPst("PST1",
    ["F1", "F2", "F3", "F4", "I1", "I2", "VC2", "R5 Cl", "G1", "G2", "G3", "G4",
      "S1", "S2", "S3", "S4", "CH3", "CH4", "VC1 (certains)", "R5 Sa/Co/Vo/Me (certains)"],
    ["h"],
    "PST en matériaux sensibles à l'eau, de mauvaise portance au moment de la mise en œuvre "
    + "de la couche de forme, et sans possibilité d'amélioration à long terme. "
    + "Se présente en remblai de faible hauteur ou en déblai.",
    "Deux voies : améliorer le matériau par un traitement à la chaux ou aux liants hydrauliques "
    + "sur une épaisseur adaptée (on est ramené en PST2, 3 ou 4 selon le contexte), ou exécuter "
    + "une couche de forme en matériau granulaire insensible à l'eau de forte épaisseur (on reste "
    + "en PST1). Cette seconde voie exige une portance de 15 à 20 MPa pour la mise en œuvre ; "
    + "en dessous, on est ramené en PST0 et l'amélioration devient indispensable. "
    + "Une couche de forme traitée est impossible sur cette classe : il faut se ramener à une PST "
    + "supérieure. En déblai ou profil rasant, un drainage de la PST est conseillé.",
    ["AR1"]),

  casPst("PST2",
    ["F1", "F2", "F3", "F4", "I1", "I2", "VC2", "R5 Cl", "G1", "G2", "G3", "G4",
      "S1", "S2", "S3", "S4", "CH3", "CH4", "VC1 (certains)", "R5 Sa/Co/Vo/Me (certains)"],
    ["m", "s"],
    "PST en matériaux sensibles à l'eau, de bonne portance au moment de la mise en œuvre, "
    + "mais pouvant chuter à long terme sous l'action de l'infiltration des eaux pluviales "
    + "ET d'une remontée de nappe. Comprend les sols sensibles à l'eau traités dans un but "
    + "d'amélioration seulement (ce qui ne permet pas le reclassement en PST4).",
    "Une couche de forme reste nécessaire même si les exigences court terme sont obtenues à "
    + "l'arase ; son épaisseur prend en compte la chute de portance à long terme. Un rabattement "
    + "de nappe à profondeur suffisante et un drainage des eaux d'infiltration ramènent en PST3 ; "
    + "si le drainage est insuffisant, le classement reste en PST2 (et pour des matériaux F3 ou F4, "
    + "on reste en PST2 dans tous les cas).",
    ["AR1"]),

  casPst("PST3",
    ["F1", "F2", "F3", "F4", "I1", "I2", "VC2", "R5 Cl", "G1", "G2", "G3", "G4",
      "S1", "S2", "S3", "S4", "CH3", "CH4", "VC1 (certains)", "R5 Sa/Co/Vo/Me (certains)"],
    ["m", "s"],
    "PST en matériaux sensibles à l'eau, de bonne portance au moment de la mise en œuvre, "
    + "pouvant baisser à long terme sous la seule infiltration des eaux pluviales — sans risque "
    + "de remontée de nappe (remblai, ou déblai et profils rasants avec drainage profond).",
    "Le classement en AR2 exige des matériaux à l'état (m), un drainage à la base de la chaussée "
    + "et une imperméabilisation de l'arase évitant l'infiltration dans la PST ; les sols fins ne "
    + "permettent en général pas d'y accéder en l'état, et le classement reste AR1. "
    + "Un sol à l'état (s) est limité à l'AR1. En déblai ou profil rasant sans drainage profond, "
    + "on est limité au cas de la PST2.",
    ["AR1", "AR2"]),

  casPst("PST4",
    ["F", "G1", "G2", "G3", "G4", "S1", "S2", "S3", "S4", "I1", "I2", "VC2",
      "CH3", "CH4", "R5 Cl", "VC1 (certains)", "R5 Sa/Co/Vo/Me (certains)"],
    ["m", "s", "h"],
    "PST en matériaux sensibles à l'eau STABILISÉS par un traitement à la chaux ou aux liants "
    + "hydrauliques sur une épaisseur adaptée, avec un minimum de 0,35 m. Depuis une PST1, "
    + "un traitement en deux couches (0,70 m minimum) est nécessaire pour atteindre une PST4.",
    "La durabilité du traitement suppose une étude de performances et un contrôle d'exécution, "
    + "une épaisseur de sol traité suffisamment dimensionnée, une finesse de mouture de la "
    + "fraction fine du mélange 0/40 mm max, et un drainage approprié de la PST en déblai. "
    + "La portance de l'arase peut être localement élevée mais n'autorise pas un classement "
    + "supérieur. La décision de réaliser une couche de forme sur cette PST dépend du projet. "
    + "Attention : un traitement visant la seule amélioration ne permet pas ce classement.",
    ["AR2"]),

  casPst("PST5",
    ["S1ins", "S2ins", "S3ins", "S4ins", "R5 Sa (certains)"],
    ["m", "s", "h"],
    "PST en matériaux sableux fins insensibles à l'eau, posant des problèmes de traficabilité. "
    + "Se présente en remblai ou en déblai, en l'absence de risque de remontée de nappe.",
    "Le drainage des sols-supports s'évalue selon le contexte hydrogéologique ; il n'est en "
    + "général pas nécessaire. La portance de l'arase dépend beaucoup de la nature des matériaux. "
    + "Les portances long terme sont assimilables aux valeurs mesurées à court terme. "
    + "La couche de forme ne s'impose que pour la traficabilité et peut se réduire à une couche "
    + "de réglage.",
    ["AR2", "AR3"]),

  casPst("PST6",
    ["G1ins", "G2ins", "G3ins", "G4ins", "CH1", "CH2", "R1", "R2",
      "R3 Cl/Li/Sa/Co/Vo/Me", "R4 Cl/Li/Sa/Co/Vo/Me",
      "VC1 (certains)", "R5 Li/Co/Vo (certains)"],
    ["m", "s", "h"],
    "PST en matériaux graveleux ou rocheux insensibles à l'eau, posant des problèmes de réglage "
    + "et/ou de traficabilité. Se présente en remblai ou en déblai.",
    "Le drainage des déblais rocheux ne s'impose que pour éviter que l'eau s'accumule ou surgisse "
    + "au travers de la structure. Les portances long terme sont assimilables aux valeurs mesurées "
    + "à court terme. Si les sols de PST ont des caractéristiques de matériaux de couche de forme, "
    + "celle-ci se réduit à une couche de fin réglage.",
    ["AR2", "AR3"]),
];

// ─────────────────────────────── Tableaux 18 et 19 : plates-formes ───────────────────────────────

/**
 * Tableau 18 (classement des PF) et tableau 19 (module de Young de calcul). Le module retenu
 * est la LIMITE BASSE de la classe : c'est ce que la NF P98-086 attend en entrée du calcul.
 * Forme commune aux classes de portance : { nom, module (MPa), cbrMin, provisoire, note }.
 */
export const PLATEFORMES = [
  { nom: "PF1", module: 20, cbrMin: null, provisoire: false, note: "20 ≤ E < 50 MPa — non recommandée hors voiries légères." },
  { nom: "PF2", module: 50, cbrMin: null, provisoire: false, note: "50 ≤ E < 80 MPa" },
  { nom: "PF2qs", module: 80, cbrMin: null, provisoire: false, note: "80 ≤ E < 120 MPa" },
  { nom: "PF3", module: 120, cbrMin: null, provisoire: false, note: "120 ≤ E < 200 MPa" },
  { nom: "PF4", module: 200, cbrMin: null, provisoire: false, note: "E ≥ 200 MPa" },
];

// ─────────────────────────────── Recherches ───────────────────────────────

/** Classe d'arase par son nom (casse indifférente), null si inconnue. */
export const trouverArase = (nom) => ARASES.find((a) => memeNom(a.nom, nom)) ?? null;

/** Cas de PST par son nom, null si inconnu. */
export const trouverPst = (nom) => CAS_PST.find((p) => memeNom(p.nom, nom)) ?? null;

/** Classe de plate-forme par son nom, null si inconnue. */
export const trouverPlateforme = (nom) => PLATEFORMES.find((p) => memeNom(p.nom, nom)) ?? null;

/** Module de calcul (MPa) d'une classe de plate-forme, tableau 19 ; null si la classe est inconnue. */
export const moduleCalcul = (nom) => trouverPlateforme(nom)?.module ?? null;

/**
 * Classe de plate-forme correspondant à un module mesuré, tableau 18 : la classe est celle dont
 * la limite basse est la plus élevée encore atteinte. Classe null en dessous de 20 MPa.
 * @returns {{ classe, etapes }}
 */
export function classerParModule(E, classes = PLATEFORMES) {
  if (!mesure(E)) {
    return { classe: null, etapes: [etape("Module non renseigné : aucune classe de plate-forme.")] };
  }
  const paliers = [...classes].sort((a, b) => b.module - a.module).map((c) => [c.module, c]);
  const lu = lirePaliers("module", E, paliers, { sens: "≥" });
  const c = lu.resultat;
  const texte = c
    ? `E = ${nombre(E, 1)} MPa ≥ ${nombre(c.module, 0)} MPa`
      + (lu.palier > 0 ? ` et < ${nombre(paliers[lu.palier - 1][0], 0)} MPa` : "")
      + ` → ${c.nom} (module de calcul ${nombre(c.module, 0)} MPa).`
    : `E = ${nombre(E, 1)} MPa < ${nombre(paliers[paliers.length - 1][0], 0)} MPa : portance insuffisante pour classer une plate-forme.`;
  return { classe: c, etapes: [etape(texte, lu.comparaisons, c?.nom ?? null)] };
}

/** Cas de PST compatibles avec un état hydrique donné. */
export const casPstPourEtat = (etat) => CAS_PST.filter((p) => p.etats.includes(etat));
