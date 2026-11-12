// Voies de détermination de la portance du support (portage de SoilMethods et de
// PlatformDetermination de Burmister-Calc), et chaîne complète de chaque voie, de l'essai au
// module de calcul (portage, en fonctions pures, de la logique de l'onglet Sol de l'application).
//
// Quatre voies :
//   "gtr-2024"     identification GTR complète : nature + état hydrique → PST → arase → couche de
//                  forme → plate-forme ;
//   "cbr-arase"    barème national CBR → classe d'arase → couche de forme → classe de plate-forme ;
//   "cbr-directe"  barème CBR direct, sans arase ni couche de forme (catalogues déterministes) ;
//   "directe"      classe ou module imposés : essai de plaque, déflectomètre, rétrocalcul,
//                  exigence du projet.
//
// Pays (mêmes identifiants que pays/index.js) : "france", "tunisie", "tunisie1984", "senegal",
// "cotedivoire", "cotedivoire1977", "tropical". Le module Sols offre toutes les voies ; le pays retenu met en
// avant celles qui le concernent, sans interdire les autres — un projet peut vouloir croiser
// deux approches.
//
// Sortie commune (determinationPlateforme) : { cleVoie, nomVoie, reference, plateforme, module,
//   arase, moduleArase, epaisseurCouche, descriptionCouche, objectifAtteint, etapes,
//   avertissements, parDefaut, utilisable, resume } — ce que l'onglet Structure consomme comme
//   support de chaussée, avec la trace du raisonnement et les réserves attachées.

import { horsDomaine } from "../outils.js";
import {
  TRAITEMENTS_COUCHE_DE_FORME, classerPlateformeObtenue, proposerCouchesDeForme,
} from "./couche-de-forme.js";
import {
  ECHELLE_COTE_DIVOIRE_2024, ECHELLE_SENEGAL, ECHELLE_TROPICALE, ECHELLE_TUNISIE, ECHELLE_TUNISIE_1984,
  classerAraseParCbr, classerSolParCbr, echelleCbrArase, echelleCbrDirecte, plateformeSansCouche,
} from "./echelles-cbr.js";
import { REFERENCE_GTR2024 } from "./gtr2024.js";
import { etape, memeNom, mesure, nombre } from "./justification.js";
import { PLATEFORMES, classerParModule, trouverArase as araseDe, trouverPst as pstDe } from "./plateforme.js";

export const TYPES_VOIE = ["gtr-2024", "cbr-arase", "cbr-directe", "directe"];

export const PAYS_SOLS = ["france", "tunisie", "tunisie1984", "senegal", "cotedivoire", "cotedivoire1977", "tropical"];

const voieDe = (cle, type, nom, reference, echelle, pays) =>
  ({ cle, type, nom, reference, echelle, pays, universelle: pays.length === 0 });

/** Catalogue des voies de détermination de la portance du support. */
export const VOIES = [
  voieDe("gtr-2024", "gtr-2024", "GTR 2024 — identification complète (nature + état hydrique)",
    REFERENCE_GTR2024, null, ["france", "tunisie"]),
  voieDe("cbr-tn", "cbr-arase", ECHELLE_TUNISIE.nom, ECHELLE_TUNISIE.reference, ECHELLE_TUNISIE.cle, ["tunisie"]),
  voieDe("cbr-sn", "cbr-arase", ECHELLE_SENEGAL.nom, ECHELLE_SENEGAL.reference, ECHELLE_SENEGAL.cle, ["senegal"]),
  voieDe("cbr-ci", "cbr-arase", ECHELLE_COTE_DIVOIRE_2024.nom, ECHELLE_COTE_DIVOIRE_2024.reference,
    ECHELLE_COTE_DIVOIRE_2024.cle, ["cotedivoire"]),
  voieDe("cbr-tropical", "cbr-directe", ECHELLE_TROPICALE.nom, ECHELLE_TROPICALE.reference, ECHELLE_TROPICALE.cle,
    ["tropical", "cotedivoire1977"]),
  // Le catalogue tunisien de 1984 indexe ses fiches sur S1 à S4, sans arase ni plate-forme : il
  // relève donc de la voie CBR directe, comme les catalogues tropicaux, et non de la chaîne
  // « CBR → arase → PF » de la RevA, qui lui est postérieure.
  voieDe("cbr-tn-1984", "cbr-directe", ECHELLE_TUNISIE_1984.nom, ECHELLE_TUNISIE_1984.reference,
    ECHELLE_TUNISIE_1984.cle, ["tunisie1984"]),
  voieDe("direct", "directe", "Saisie directe — classe ou module imposé",
    "Essai de plaque (EV2), déflectomètre, rétrocalcul, ou exigence du maître d'ouvrage", null, []),
];

/** Voie par sa clé (casse indifférente), null si inconnue. */
export const voie = (cle) => VOIES.find((v) => memeNom(v.cle, cle)) ?? null;

/** Vrai quand la voie s'applique au pays (une voie universelle s'applique partout). */
export const voieSAppliqueA = (v, pays) => v.universelle || v.pays.includes(pays);

/** Voies mises en avant pour un pays : les siennes, puis la saisie directe. */
export const voiesPour = (pays) => VOIES.filter((v) => voieSAppliqueA(v, pays));

/** Voie proposée par défaut pour un pays : la première qui ne soit pas la saisie directe. */
export const voieParDefaut = (pays) => voiesPour(pays).find((v) => v.type !== "directe") ?? voie("direct");

// ─────────────────────────────── Sortie commune ───────────────────────────────

/**
 * Détermination de portance. `parDefaut` : le module part sur des valeurs par défaut tant
 * qu'aucun essai n'est saisi ; la portance existe, mais rien ne la justifie, et il faut le dire —
 * sinon une valeur que personne n'a déterminée se lit comme une valeur déterminée.
 */
export function determinationPlateforme({
  cleVoie, nomVoie, reference, plateforme, module, arase = null, moduleArase = null,
  epaisseurCouche = null, descriptionCouche = null, objectifAtteint = null,
  etapes = [], avertissements = [], parDefaut = false,
}) {
  const utilisable = mesure(module) && module > 0;
  const resume = !utilisable
    ? "Portance non déterminée"
    : parDefaut
      ? `${plateforme} — ${nombre(module, 0)} MPa par défaut, portance non déterminée`
      : `${plateforme} — module de calcul ${nombre(module, 0)} MPa`;
  return {
    cleVoie, nomVoie, reference, plateforme, module, arase, moduleArase, epaisseurCouche, descriptionCouche,
    objectifAtteint, etapes, avertissements, parDefaut, utilisable, resume,
  };
}

const libelleTraitement = (t) => TRAITEMENTS_COUCHE_DE_FORME.find((x) => x.cle === t)?.libelle ?? t;

const descriptionCouche = (traitement, regle) =>
  libelleTraitement(traitement) + (regle?.classeMecanique ? `, classe mécanique ${regle.classeMecanique}` : "");

// ─────────────────────────────── Voie GTR 2024 ───────────────────────────────

/**
 * Chaîne GTR : cas de PST et arase (issus de conseillerPst ou choisis), couche de forme des
 * tableaux 20 à 23, plate-forme obtenue (§ 4.3.4).
 *
 * @param p { sol (classerSol, facultatif), pst = "PST3", arase = "AR1",
 *            plateforme (visée ; défaut : la première proposition), epaisseur (mise en œuvre, cm ;
 *            défaut : l'épaisseur préconisée), traitement = "aucun", dimensionnement = "securitaire",
 *            geotextile = false, classeMecanique = "4" (couche aux liants), moduleCourtTerme,
 *            parDefaut = false }
 */
export function determinerParGtr({
  sol = null, pst = "PST3", arase = "AR1", plateforme = null, epaisseur = null, traitement = "aucun",
  dimensionnement = "securitaire", geotextile = false, classeMecanique = "4", moduleCourtTerme = null,
  parDefaut = false,
} = {}) {
  const v = voie("gtr-2024");
  const cas = pstDe(pst);
  if (cas == null) return horsDomaine(`Cas de PST inconnu : ${pst}.`);
  if (cas.exigeReclassement) {
    return horsDomaine(`${cas.nom} : aucune couche de forme n'est possible avant reclassement de la PST ; `
      + "la portance ne peut pas être déterminée en l'état.");
  }

  const options = {
    dimensionnement, geotextile, moduleCourtTerme,
    classeMecanique: traitement === "liant" ? classeMecanique : null,
  };
  const propositions = proposerCouchesDeForme(pst, arase, traitement, options);
  const proposition = plateforme == null ? propositions[0] : propositions.find((p) => memeNom(p.plateforme, plateforme));
  const cible = plateforme ?? proposition?.plateforme;
  if (cible == null) {
    return horsDomaine(`Aucune couche de forme n'est tabulée depuis ${pst} / ${arase} pour ce type de traitement.`);
  }

  const e = mesure(epaisseur) ? epaisseur : proposition?.epaisseur ?? 0;
  const issue = classerPlateformeObtenue(pst, arase, cible, e, traitement, options);
  const moduleArase = araseDe(arase)?.module ?? null;

  const etapes = [];
  if (sol?.estClasse) etapes.push(etape(`Sol classé ${sol.symbole} — ${sol.description}`, [], sol.symbole));
  etapes.push(etape(`Cas de PST retenu : ${pst}`, [], pst));
  etapes.push(etape(`Arase ${arase} : ${nombre(moduleArase, 0)} MPa à long terme`, [], arase));
  const couche = libelleTraitement(traitement).toLowerCase();
  etapes.push(etape(proposition?.epaisseur != null
    ? `Couche de forme ${couche}, ${nombre(e)} cm mis en œuvre pour ${nombre(proposition.epaisseur, 0)} cm préconisés`
    : `Couche de forme ${couche}, sans épaisseur chiffrée par le guide`));
  etapes.push(...issue.etapes);

  const d = determinationPlateforme({
    cleVoie: v.cle, nomVoie: v.nom, reference: v.reference,
    plateforme: issue.plateforme, module: issue.module, arase, moduleArase,
    epaisseurCouche: issue.epaisseurRequise, descriptionCouche: descriptionCouche(traitement, proposition?.regle),
    objectifAtteint: issue.objectifAtteint, etapes, avertissements: issue.avertissements, parDefaut,
  });
  return issue.applicable === false ? horsDomaine(issue.motif, d) : d;
}

// ─────────────────────────────── Voie CBR → arase ───────────────────────────────

/**
 * Lignes proposées par un barème « CBR → arase » : sans couche de forme (l'arase vaut
 * plate-forme de même rang), puis tables du GTR si le pays les reprend, ou table nationale.
 * @returns [{ plateforme, epaisseur, module, detail, avertissement, gtr (proposition GTR ou null) }]
 */
export function propositionsCbrArase(echelle, nomArase, {
  pst = "PST3", traitement = "aucun", dimensionnement = "securitaire", geotextile = false,
  classeMecanique = "4", moduleCourtTerme = null,
} = {}) {
  const lignes = [];
  if (echelle.utiliseTablesGtr) {
    const cas = pstDe(pst);
    if (cas && !cas.exigeReclassement) {
      for (const p of proposerCouchesDeForme(pst, nomArase, traitement, {
        dimensionnement, geotextile, moduleCourtTerme, classeMecanique: traitement === "liant" ? classeMecanique : null,
      })) {
        lignes.push({ plateforme: p.plateforme, epaisseur: p.epaisseur, module: p.module,
          detail: descriptionCouche(traitement, p.regle), avertissement: p.avertissements.join(" "), gtr: p });
      }
    }
  } else {
    for (const o of echelle.couchesDeForme.filter((x) => x.arase === nomArase)) {
      lignes.push({
        plateforme: o.plateforme, epaisseur: o.epaisseur,
        module: echelle.plateformes.find((p) => p.nom === o.plateforme)?.module ?? null,
        detail: o.materiau, avertissement: o.deuxCouches ? "Mise en œuvre généralement en deux couches." : "", gtr: null,
      });
    }
  }

  // Sans couche de forme, la plate-forme prend le rang de portance de l'arase.
  const nue = plateformeSansCouche(echelle, nomArase);
  if (nue) {
    lignes.unshift({ plateforme: nue.nom, epaisseur: 0, module: nue.module, detail: "arase = plate-forme de même rang",
      avertissement: "Les critères de réception de la plate-forme doivent être vérifiés sur l'arase elle-même.", gtr: null });
  }
  return lignes;
}

/**
 * Chaîne « CBR → arase → plate-forme » d'un barème national.
 *
 * @param p { echelle (clé ou objet), cbr, arase (défaut : déduite du CBR), plateforme (visée ;
 *            défaut : la première ligne, c'est-à-dire l'arase seule quand elle classe une
 *            plate-forme), epaisseur (cm ; défaut : celle de la ligne), et, pour les pays qui
 *            reprennent les tables du GTR : pst = "PST3", traitement, dimensionnement,
 *            geotextile, classeMecanique, moduleCourtTerme ; parDefaut }
 */
export function determinerParCbrArase({
  echelle, cbr = null, arase = null, plateforme = null, epaisseur = null, parDefaut = false, ...couche
} = {}) {
  const ech = typeof echelle === "string" ? echelleCbrArase(echelle) : echelle;
  if (ech == null) return horsDomaine(`Barème « CBR → arase » inconnu : ${echelle}.`);
  const v = VOIES.find((x) => x.echelle === ech.cle);

  const lu = mesure(cbr) ? classerAraseParCbr(ech, cbr) : null;
  const nomArase = arase ?? lu?.classe?.nom;
  if (nomArase == null) return horsDomaine("Saisir un CBR (ou une classe d'arase) pour déterminer la portance.");
  const grade = ech.arases.find((a) => a.nom === nomArase);
  if (grade == null) return horsDomaine(`Classe d'arase ${nomArase} inconnue du barème ${ech.nom}.`);

  const avertissements = [...ech.reserves];
  const etapes = [];
  if (lu) etapes.push(...lu.etapes);
  if (arase != null && lu && lu.classe.nom !== arase) {
    etapes.push(etape(`Classe d'arase imposée ${arase}, au lieu de ${lu.classe.nom} déduite du CBR.`));
  }
  etapes.push(etape(`Arase ${nomArase} : ${nombre(grade.module, 0)} MPa à long terme`, [], nomArase));

  const traitement = couche.traitement ?? "aucun";
  const lignes = propositionsCbrArase(ech, nomArase, couche);
  const ligne = plateforme == null ? lignes[0] : lignes.find((l) => memeNom(l.plateforme, plateforme));
  if (ligne == null) {
    return horsDomaine(plateforme == null
      ? `Aucune plate-forme ne peut être obtenue depuis ${nomArase} avec les lignes du barème.`
      : `Aucune ligne du barème ne mène de ${nomArase} à une ${plateforme}.`);
  }
  const e = mesure(epaisseur) ? epaisseur : ligne.epaisseur ?? 0;
  const base = { cleVoie: v?.cle ?? ech.cle, nomVoie: v?.nom ?? ech.nom, reference: ech.reference, arase: nomArase, moduleArase: grade.module, parDefaut };

  // Les tables du GTR, quand le pays les reprend, sont lues comme en voie GTR.
  if (ech.utiliseTablesGtr && ligne.gtr && ligne.epaisseur > 0) {
    const issue = classerPlateformeObtenue(couche.pst ?? "PST3", nomArase, ligne.plateforme, e, traitement, {
      dimensionnement: couche.dimensionnement ?? "securitaire", geotextile: couche.geotextile ?? false,
      moduleCourtTerme: couche.moduleCourtTerme ?? null,
      classeMecanique: traitement === "liant" ? (couche.classeMecanique ?? "4") : null,
    });
    etapes.push(etape(`Couche de forme ${nombre(e)} cm pour ${nombre(issue.epaisseurRequise, 0)} cm préconisés`));
    etapes.push(...issue.etapes);
    const d = determinationPlateforme({
      ...base, plateforme: issue.plateforme, module: issue.module, epaisseurCouche: issue.epaisseurRequise,
      descriptionCouche: ligne.detail, objectifAtteint: issue.objectifAtteint, etapes,
      avertissements: [...avertissements, ...issue.avertissements],
    });
    return issue.applicable === false ? horsDomaine(issue.motif, d) : d;
  }

  // Table nationale, ou plate-forme sans couche de forme : l'épaisseur mise en œuvre doit
  // atteindre celle de la ligne, faute de quoi on retombe sur la portance de l'arase.
  const atteinte = ligne.epaisseur == null || e + 1e-9 >= ligne.epaisseur;
  let nom = ligne.plateforme, module = ligne.module;
  if (!atteinte) {
    const nue = plateformeSansCouche(ech, nomArase);
    nom = nue?.nom ?? "—";
    module = nue?.module ?? null;
    avertissements.push(`Épaisseur mise en œuvre (${nombre(e)} cm) inférieure à l'épaisseur de la `
      + `ligne (${nombre(ligne.epaisseur, 0)} cm) : la plate-forme retombe au rang de l'arase.`);
    etapes.push(etape(`Épaisseur ${nombre(e)} cm < ${nombre(ligne.epaisseur, 0)} cm de la ligne : retour au rang de l'arase → ${nom}.`, [], nom));
  } else if (ligne.epaisseur > 0) {
    etapes.push(etape(`Couche de forme ${ligne.detail}, ${nombre(ligne.epaisseur, 0)} cm → ${ligne.plateforme}`, [], ligne.plateforme));
  } else {
    etapes.push(etape("Pas de couche de forme : la plate-forme prend le rang de portance de l'arase.", [], ligne.plateforme));
  }
  if (ligne.avertissement) avertissements.push(ligne.avertissement);

  const d = determinationPlateforme({
    ...base, plateforme: nom, module, epaisseurCouche: ligne.epaisseur, descriptionCouche: ligne.detail,
    objectifAtteint: atteinte, etapes, avertissements,
  });
  return d.utilisable ? d : horsDomaine("Portance d'arase insuffisante pour classer une plate-forme.", d);
}

// ─────────────────────────────── Voie CBR directe ───────────────────────────────

/** Barème CBR direct (catalogues déterministes) : la classe de sol indexe le catalogue. */
export function determinerParCbrDirecte({ echelle, cbr = null, parDefaut = false } = {}) {
  const ech = typeof echelle === "string" ? echelleCbrDirecte(echelle) : echelle;
  if (ech == null) return horsDomaine(`Barème « CBR → classe de sol » inconnu : ${echelle}.`);
  if (!mesure(cbr)) return horsDomaine("Saisir un CBR pour déterminer la classe de sol.");
  const v = VOIES.find((x) => x.echelle === ech.cle);

  const lu = classerSolParCbr(ech, cbr);
  const c = lu.classe;
  const etapes = [...lu.etapes];
  if (c.note) etapes.push(etape(c.note));
  return determinationPlateforme({
    cleVoie: v?.cle ?? ech.cle, nomVoie: v?.nom ?? ech.nom, reference: ech.reference,
    plateforme: c.nom, module: c.module, objectifAtteint: true, etapes, avertissements: [ech.conseil], parDefaut,
  });
}

// ─────────────────────────────── Saisie directe ───────────────────────────────

/**
 * Classe ou module imposés. Un module saisi l'emporte sur la classe : il vient d'une mesure,
 * elle d'un choix. `echelle` : barème dont les classes sont proposées (classes de plate-forme
 * françaises par défaut).
 */
export function determinerDirecte({ module = null, plateforme = null, echelle = null, parDefaut = false } = {}) {
  const v = voie("direct");
  const base = { cleVoie: v.cle, nomVoie: v.nom, reference: v.reference, objectifAtteint: true, parDefaut };

  if (mesure(module) && module > 0) {
    const lu = classerParModule(module);
    const c = lu.classe;
    return determinationPlateforme({
      ...base, plateforme: c?.nom ?? "—", module,
      etapes: [etape(`Module imposé ${nombre(module, 0)} MPa` + (c == null ? "" : `, soit une ${c.nom}`), lu.etapes[0].comparaisons, c?.nom ?? null)],
      avertissements: ["Module imposé : sa justification (essai de plaque, déflectomètre, "
        + "rétrocalcul ou exigence du maître d'ouvrage) doit figurer au dossier."],
    });
  }

  const ech = typeof echelle === "string" ? (echelleCbrArase(echelle) ?? echelleCbrDirecte(echelle)) : echelle;
  const classes = ech?.plateformes ?? ech?.classes ?? PLATEFORMES;
  const c = classes.find((p) => p.nom === plateforme);
  if (c == null) return horsDomaine("Choisir une classe de plate-forme ou saisir un module.");
  return determinationPlateforme({
    ...base, plateforme: c.nom, module: c.module,
    etapes: [etape(`Classe imposée ${c.nom} → module de calcul ${nombre(c.module, 0)} MPa`, [], c.nom)],
    avertissements: c.note == null ? [] : [c.note],
  });
}

/** Aiguillage : détermine la portance par la voie demandée (clé de voie). */
export function determinerPortance(cleVoie, parametres = {}) {
  const v = voie(cleVoie);
  if (v == null) return horsDomaine(`Voie de détermination inconnue : ${cleVoie}.`);
  switch (v.type) {
    case "gtr-2024": return determinerParGtr(parametres);
    case "cbr-arase": return determinerParCbrArase({ echelle: v.echelle, ...parametres });
    case "cbr-directe": return determinerParCbrDirecte({ echelle: v.echelle, ...parametres });
    default: return determinerDirecte(parametres);
  }
}
