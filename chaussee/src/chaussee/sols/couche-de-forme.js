// Dimensionnement de la couche de forme selon le GTR 2024, § 4.3.5 (portage de Gtr2024Capping de
// Burmister-Calc) : tableaux 20 et 21 (matériaux non traités, règles sécuritaires puis
// optimisées), 22 (chaux seule) et 23 (liants hydrauliques). Aucune interpolation : ce sont les
// cellules des tableaux.
//
// Traitement de la couche de forme : "aucun" (granulaire non traité, tableaux 20 et 21),
// "chaux" (chaux seule, tableau 22, matériaux F3), "liant" (liants hydrauliques éventuellement
// associés à la chaux, tableau 23).
// Dimensionnement des couches non traitées : "securitaire" (tableau 20, matériau non connu) ou
// "optimise" (tableau 21, matériau connu par retours d'expérience ou planches d'essai).

import { horsDomaine } from "../outils.js";
import { comparaison as cmp, etape, memeNom, mesure, nombre } from "./justification.js";
import { MODULE_ARASE_MIN_COUCHE_TRAITEE, trouverArase as araseDe, classerParModule, moduleCalcul } from "./plateforme.js";

export const REFERENCE_COUCHE_DE_FORME =
  "GTR 2024 (IDRRIM/Cerema), fascicule 1, § 4.3.5 — tableaux 20 et 21 (p. 81), 22 et 23 (p. 82)";

export const TRAITEMENTS_COUCHE_DE_FORME = [
  { cle: "aucun", libelle: "Matériau granulaire non traité" },
  { cle: "chaux", libelle: "Traitée à la chaux seule" },
  { cle: "liant", libelle: "Traitée aux liants hydrauliques" },
];

export const DIMENSIONNEMENTS = [
  { cle: "securitaire", libelle: "Règles sécuritaires — matériau non connu", tableau: 20 },
  { cle: "optimise", libelle: "Optimisation — matériau connu", tableau: 21 },
];

/** Couche de réglage (cm) à laquelle se réduit la couche de forme dans les cas notés (GNT D ≤ 31,5 mm). */
export const COUCHE_DE_REGLAGE = { min: 10, max: 15 };

/** Réduction d'épaisseur (cm) apportée par un géotextile de séparation/filtration. */
export const REDUCTION_GEOTEXTILE = 10;

/** Majoration (cm) à appliquer aux épaisseurs préconisées en cas de trafic de chantier élevé. */
export const MAJORATION_TRAFIC_CHANTIER = { min: 10, max: 20 };

/** Classes mécaniques de matériau traité figurant au tableau 23. */
export const CLASSES_MECANIQUES = ["3", "4", "5"];

const NOTE_REGLAGE =
  "Si les sols présents en PST ont, étude à l'appui, des caractéristiques de matériau de couche "
  + "de forme, celle-ci peut se limiter à une couche de réglage de 10 à 15 cm (GNT avec D ≤ 31,5 mm) "
  + "pour tenir les exigences de nivellement et résoudre les problèmes de traficabilité.";

const NOTE_GEOTEXTILE =
  "L'intercalation d'un géotextile de séparation/filtration entre la couche de forme granulaire et "
  + "le sol sensible à l'eau humide sauvegarde les caractéristiques du matériau granulaire et réduit "
  + "l'épaisseur de couche de forme de 10 cm.";

const NOTE_DEUX_COUCHES =
  "L'obtention de la compacité recherchée en fond de couche conduit généralement à une mise en "
  + "œuvre en deux couches.";

const NOTE_PF3_GRANULAIRE =
  "Certains matériaux granulaires ne permettent pas l'obtention d'une PF3 sans un traitement "
  + "aux liants hydrauliques et/ou à la chaux.";

/**
 * Une cellule des tableaux 20 à 23 : ce qu'il faut mettre en œuvre, sur un couple PST/arase
 * donné, pour obtenir une classe de plate-forme donnée. `pst` vaut null pour les couches de forme
 * traitées, dont les tableaux ne dépendent que de la classe d'arase ; `dimensionnement` aussi.
 */
function regle(tableau, pst, arase, plateforme, traitement, dimensionnement, {
  epaisseur = null, classeMecanique = null, coucheDeReglage = false, reductionGeotextile = false,
  deuxCouches = false, note = null,
} = {}) {
  return {
    tableau, pst, arase, plateforme, traitement, dimensionnement, epaisseur, classeMecanique,
    coucheDeReglage, reductionGeotextile, deuxCouches, note,
    /** Faux quand la cellule ne donne pas d'épaisseur chiffrée. */
    aEpaisseur: epaisseur != null && epaisseur > 0,
  };
}

function construireRegles() {
  const r = [];

  // ------------------------------------------------------------------
  // Tableau 20 — règles sécuritaires, couche de forme non traitée.
  // ------------------------------------------------------------------
  const sec = (pst, arase, pf, o) => r.push(regle(20, pst, arase, pf, "aucun", "securitaire", o));

  sec("PST1", "AR1", "PF2", { epaisseur: 75, reductionGeotextile: true, note: NOTE_GEOTEXTILE });
  sec("PST2", "AR1", "PF2", { epaisseur: 50 });
  sec("PST3", "AR1", "PF2", { epaisseur: 40 });
  sec("PST3", "AR2", "PF2", { epaisseur: 30,
    note: "Une couche de forme est ici obligatoire ; il est généralement plus intéressant "
      + "économiquement de viser au minimum une PF2qs." });
  for (const pst of ["PST4", "PST5", "PST6"]) sec(pst, "AR2", "PF2", { coucheDeReglage: true, note: NOTE_REGLAGE });

  sec("PST1", "AR1", "PF2qs", { epaisseur: 100, reductionGeotextile: true, note: NOTE_GEOTEXTILE });
  sec("PST2", "AR1", "PF2qs", { epaisseur: 75 });
  sec("PST3", "AR1", "PF2qs", { epaisseur: 65 });
  for (const pst of ["PST3", "PST4", "PST5", "PST6"]) sec(pst, "AR2", "PF2qs", { epaisseur: 40 });

  // La PF3 n'est pas garantie par ces règles : seules les colonnes AR3 offrent une issue.
  for (const pst of ["PST5", "PST6"]) sec(pst, "AR3", "PF3", { coucheDeReglage: true, note: NOTE_REGLAGE });

  // ------------------------------------------------------------------
  // Tableau 21 — optimisation, matériaux de couche de forme connus.
  // ------------------------------------------------------------------
  const opt = (pst, arase, pf, o) => r.push(regle(21, pst, arase, pf, "aucun", "optimise", o));

  opt("PST1", "AR1", "PF2", { epaisseur: 60, reductionGeotextile: true, note: NOTE_GEOTEXTILE });
  opt("PST2", "AR1", "PF2", { epaisseur: 50 });
  opt("PST3", "AR1", "PF2", { epaisseur: 35 });
  opt("PST3", "AR2", "PF2", { epaisseur: 25 });
  for (const pst of ["PST4", "PST5", "PST6"]) opt(pst, "AR2", "PF2", { coucheDeReglage: true, note: NOTE_REGLAGE });

  opt("PST1", "AR1", "PF2qs", { epaisseur: 75, reductionGeotextile: true, note: NOTE_GEOTEXTILE });
  opt("PST2", "AR1", "PF2qs", { epaisseur: 65 });
  opt("PST3", "AR1", "PF2qs", { epaisseur: 55 });
  opt("PST3", "AR2", "PF2qs", { epaisseur: 35 });
  opt("PST4", "AR2", "PF2qs", { epaisseur: 30 });
  opt("PST5", "AR2", "PF2qs", { epaisseur: 35 });
  opt("PST6", "AR2", "PF2qs", { epaisseur: 35 });

  opt("PST2", "AR1", "PF3", { epaisseur: 90, note: NOTE_PF3_GRANULAIRE });
  opt("PST3", "AR1", "PF3", { epaisseur: 80, note: NOTE_PF3_GRANULAIRE });
  for (const pst of ["PST3", "PST4", "PST5", "PST6"]) opt(pst, "AR2", "PF3", { epaisseur: 50, note: NOTE_PF3_GRANULAIRE });
  for (const pst of ["PST5", "PST6"]) opt(pst, "AR3", "PF3", { coucheDeReglage: true, note: NOTE_REGLAGE });

  // ------------------------------------------------------------------
  // Tableau 22 — couche de forme traitée à la chaux seule (matériaux F3).
  // ------------------------------------------------------------------
  const chaux = (arase, pf, o) => r.push(regle(22, null, arase, pf, "chaux", null, o));
  chaux("AR1", "PF2", { epaisseur: 50, deuxCouches: true, note: NOTE_DEUX_COUCHES });
  chaux("AR1", "PF2qs", { epaisseur: 60, deuxCouches: true, note: NOTE_DEUX_COUCHES });
  chaux("AR1", "PF3", { epaisseur: 70, deuxCouches: true, note: NOTE_DEUX_COUCHES });
  chaux("AR2", "PF2", { note: "Solution de couche de forme peu appropriée, sauf à vouloir rechercher un "
    + "dimensionnement en PF2qs ou PF3." });
  chaux("AR2", "PF2qs", { epaisseur: 45, deuxCouches: true, note: NOTE_DEUX_COUCHES });
  chaux("AR2", "PF3", { epaisseur: 50, deuxCouches: true, note: NOTE_DEUX_COUCHES });

  // ------------------------------------------------------------------
  // Tableau 23 — traitement aux liants hydrauliques, par classe mécanique du mélange.
  // ------------------------------------------------------------------
  const lh = (arase, meca, pf, cm, deuxCouches) => r.push(regle(23, null, arase, pf, "liant", null,
    { epaisseur: cm, classeMecanique: meca, deuxCouches, note: deuxCouches ? NOTE_DEUX_COUCHES : null }));

  lh("AR1", "3", "PF3", 30, false);
  lh("AR1", "3", "PF4", 40, true);
  lh("AR1", "4", "PF2", 30, false);
  lh("AR1", "4", "PF2qs", 35, false);
  lh("AR1", "4", "PF3", 35, false);
  lh("AR1", "4", "PF4", 45, true);
  lh("AR1", "5", "PF2", 35, false);
  lh("AR1", "5", "PF2qs", 45, true);
  lh("AR1", "5", "PF3", 50, true);
  lh("AR1", "5", "PF4", 55, true);

  lh("AR2", "3", "PF3", 25, false);
  lh("AR2", "3", "PF4", 30, false);
  lh("AR2", "4", "PF2qs", 25, false);
  lh("AR2", "4", "PF3", 30, false);
  lh("AR2", "4", "PF4", 35, false);
  lh("AR2", "5", "PF2qs", 30, false);
  lh("AR2", "5", "PF3", 35, false);
  lh("AR2", "5", "PF4", 45, true);

  return r;
}

/**
 * Toutes les cellules des quatre tableaux. Les colonnes des tableaux 20 et 21 sont des couples
 * (cas de PST, classe d'arase) ; la colonne « PST1 » y correspond à l'arase AR1.
 */
export const REGLES_COUCHE_DE_FORME = construireRegles();

/** Où la règle se lit dans le guide : « tableau 20, PST2 / AR1 → PF2 ». */
export function sourceRegle(r) {
  const colonne = r.pst ? `${r.pst} / ${r.arase}` : r.arase;
  const meca = r.classeMecanique ? `, classe mécanique ${r.classeMecanique}` : "";
  return `Tableau ${r.tableau}, ${colonne}${meca} → ${r.plateforme}`;
}

/**
 * Réserves attachées à l'emploi d'une couche de forme TRAITÉE sur un cas de PST donné
 * (§ 4.3.5.2 et tableau 17). Liste vide quand rien ne s'oppose au traitement.
 */
export function reservesCoucheTraitee(pst, moduleCourtTerme = null) {
  const w = [];
  switch (pst) {
    case "PST0":
      w.push("PST0 : aucune couche de forme n'est possible avant reclassement de la PST.");
      break;
    case "PST1":
      w.push("Une couche de forme traitée est impossible sur une PST1 : il faut se ramener "
        + "à un cas de PST supérieur (traitement de la PST elle-même).");
      break;
    case "PST2":
      w.push("Couche de forme traitée déconseillée sur une PST2 : en cas de remontée de nappe, "
        + "la couche de forme risque d'être endommagée. Il est recommandé de la réaliser "
        + "au moins sur une PST3.");
      break;
    default:
  }
  if (mesure(moduleCourtTerme) && moduleCourtTerme < MODULE_ARASE_MIN_COUCHE_TRAITEE) {
    w.push(`Portance d'arase à court terme de ${nombre(moduleCourtTerme, 0)} MPa : une couche de forme traitée exige `
      + `${MODULE_ARASE_MIN_COUCHE_TRAITEE} MPa minimum à l'arase.`);
  }
  return w;
}

/** Libellé d'une proposition : « PF2 — 50 cm (50 MPa) ». */
function libelleProposition(p) {
  const epaisseur = p.epaisseur != null
    ? `${nombre(p.epaisseur, 0)} cm`
    : p.regle.coucheDeReglage
      ? `couche de réglage ${COUCHE_DE_REGLAGE.min} à ${COUCHE_DE_REGLAGE.max} cm`
      : "épaisseur non chiffrée";
  return `${p.plateforme} — ${epaisseur} (${nombre(p.module, 0)} MPa)`;
}

/**
 * Voies de couche de forme possibles depuis un couple (cas de PST, classe d'arase), ordonnées par
 * module de plate-forme croissant puis par épaisseur.
 *
 * @param options { dimensionnement = "securitaire", geotextile = false,
 *                  classeMecanique = null (toutes les classes du tableau 23), moduleCourtTerme = null }
 * @returns [{ regle, source, epaisseur, plateforme, module, avertissements, libelle }]
 */
export function proposerCouchesDeForme(pst, arase, traitement = "aucun", {
  dimensionnement = "securitaire", geotextile = false, classeMecanique = null, moduleCourtTerme = null,
} = {}) {
  const reservesTraitee = traitement === "aucun" ? [] : reservesCoucheTraitee(pst, moduleCourtTerme);
  const meca = classeMecanique == null ? null : String(classeMecanique);

  const retenues = REGLES_COUCHE_DE_FORME.filter((r) =>
    r.traitement === traitement
    && memeNom(r.arase, arase)
    && (r.pst == null || memeNom(r.pst, pst))
    && (traitement !== "aucun" || r.dimensionnement === dimensionnement)
    // Classe mécanique non précisée : on rend toutes les classes du tableau 23.
    && (meca == null || r.classeMecanique == null || r.classeMecanique === meca));

  const propositions = retenues.map((r) => {
    let epaisseur = r.epaisseur;
    const avertissements = [...reservesTraitee];
    if (epaisseur != null && geotextile && r.reductionGeotextile) {
      epaisseur = r.epaisseur - REDUCTION_GEOTEXTILE;
      avertissements.push(`Épaisseur réduite de ${REDUCTION_GEOTEXTILE} cm par le géotextile `
        + `de séparation/filtration (${nombre(r.epaisseur, 0)} cm sans géotextile).`);
    }
    if (r.coucheDeReglage) avertissements.push(NOTE_REGLAGE);
    if (r.deuxCouches) avertissements.push(NOTE_DEUX_COUCHES);
    if (!r.aEpaisseur && !r.coucheDeReglage && r.note) avertissements.push(r.note);

    const p = { regle: r, source: sourceRegle(r), epaisseur, plateforme: r.plateforme, module: moduleCalcul(r.plateforme), avertissements };
    p.libelle = libelleProposition(p);
    return p;
  });

  return propositions.sort((a, b) => a.module - b.module || (a.epaisseur ?? 0) - (b.epaisseur ?? 0));
}

/**
 * Classement de la plate-forme réellement obtenue. Règle du § 4.3.4 : au-delà de l'épaisseur
 * préconisée, la plate-forme est celle des tableaux ; en dessous, elle retombe à la classe de
 * l'arase. Une épaisseur supérieure ne fait pas monter de classe : le GTR ne le prévoit pas.
 *
 * @returns {{ applicable, plateforme, module, objectifAtteint, epaisseurRequise, etapes, avertissements }}
 *          (horsDomaine quand l'arase ne permet de classer aucune plate-forme)
 */
export function classerPlateformeObtenue(pst, arase, cible, epaisseurReelle, traitement = "aucun", options = {}) {
  const etapes = [], avertissements = [];
  if (!mesure(epaisseurReelle)) {
    return horsDomaine("Épaisseur de couche de forme mise en œuvre non renseignée.",
      { plateforme: "—", module: null, objectifAtteint: false, epaisseurRequise: null, etapes, avertissements });
  }

  const proposition = proposerCouchesDeForme(pst, arase, traitement, options)
    .find((p) => memeNom(p.plateforme, cible));

  if (proposition == null) {
    avertissements.push(`Aucune règle du GTR ne donne une ${cible} depuis ${pst} / ${arase} `
      + "avec ce type de couche de forme.");
    etapes.push(etape(`Aucune cellule des tableaux 20 à 23 ne mène de ${pst} / ${arase} à une ${cible} avec ce type de couche de forme.`));
    return retombeeSurArase(arase, null, avertissements, etapes);
  }

  avertissements.push(...proposition.avertissements);
  etapes.push(etape(`${proposition.source} : ${proposition.libelle}.`));

  // Cas des cellules sans épaisseur chiffrée : la couche de réglage ne garantit rien de plus que
  // l'arase, et une cellule vide n'est pas une solution.
  if (proposition.epaisseur == null) {
    if (proposition.regle.coucheDeReglage) {
      avertissements.push("La couche de forme se réduit ici à une couche de réglage : le classement "
        + "de la plate-forme s'appuie sur la portance de l'arase elle-même.");
    }
    etapes.push(etape("Cellule sans épaisseur chiffrée : la plate-forme se classe sur la portance de l'arase."));
    return retombeeSurArase(arase, null, avertissements, etapes);
  }

  const requise = proposition.epaisseur;
  if (epaisseurReelle + 1e-9 < requise) {
    avertissements.push(`Épaisseur mise en œuvre (${nombre(epaisseurReelle)} cm) inférieure à l'épaisseur `
      + `préconisée (${nombre(requise, 0)} cm) : la plate-forme retombe à la classe de l'arase.`);
    etapes.push(etape(`Épaisseur mise en œuvre ${nombre(epaisseurReelle)} cm < ${nombre(requise, 0)} cm préconisés : `
      + "la plate-forme retombe à la classe de l'arase.", [cmp("epaisseur", epaisseurReelle, "<", requise)]));
    return retombeeSurArase(arase, requise, avertissements, etapes);
  }

  etapes.push(etape(`Épaisseur mise en œuvre ${nombre(epaisseurReelle)} cm ≥ ${nombre(requise, 0)} cm préconisés → `
    + `${proposition.plateforme} (module de calcul ${nombre(proposition.module, 0)} MPa).`,
  [cmp("epaisseur", epaisseurReelle, "≥", requise)], proposition.plateforme));
  return {
    applicable: true, plateforme: proposition.plateforme, module: proposition.module,
    objectifAtteint: true, epaisseurRequise: requise, etapes, avertissements,
  };
}

function retombeeSurArase(nomArase, requise, avertissements, etapes) {
  const a = araseDe(nomArase);
  const lu = a ? classerParModule(a.module) : null;
  const pf = lu?.classe ?? null;

  if (pf == null) {
    const motif = "Portance d'arase insuffisante pour classer une plate-forme.";
    avertissements.push(motif);
    etapes.push(etape(a
      ? `Arase ${a.nom} : ${nombre(a.module, 0)} MPa à long terme, insuffisant pour classer une plate-forme.`
      : `Arase ${nomArase} inconnue : aucune plate-forme ne peut être classée.`));
    return horsDomaine(motif, { plateforme: "—", module: null, objectifAtteint: false, epaisseurRequise: requise, etapes, avertissements });
  }

  avertissements.push(`Rappel du GTR : une PST ${nomArase} ne répond pas forcément aux caractéristiques `
    + `d'une ${pf.nom}.`);
  etapes.push(etape(`Arase ${a.nom} : ${nombre(a.module, 0)} MPa à long terme → ${pf.nom} `
    + `(module de calcul ${nombre(pf.module, 0)} MPa).`, lu.etapes[0].comparaisons, pf.nom));
  return { applicable: true, plateforme: pf.nom, module: pf.module, objectifAtteint: false, epaisseurRequise: requise, etapes, avertissements };
}
