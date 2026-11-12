// Guidage PST / arase (portage de Gtr2024PstAdvisor de Burmister-Calc) : déduit le cas de partie
// supérieure de terrassement et la classe d'arase à partir de la classification du sol et du
// contexte (tableau 17 du GTR 2024). Le guide ne donne pas d'algorithme : il décrit des cas et
// laisse choisir. Ce module explicite les règles que le tableau énonce en toutes lettres et dit
// sur quoi il s'appuie, de sorte que l'ingénieur puisse suivre — ou passer outre.
//
// Contexte (tous champs facultatifs) :
//   { situation: "remblai" | "deblai" | "profil-rasant",
//     risqueNappe, drainageProfond,                      remontée de nappe et rabattement
//     traitement: "aucun" | "amelioration" | "stabilisation",   traitement de la PST elle-même
//     drainageBaseChaussee, impermeabilisationArase }    dispositions qui ouvrent l'AR2 en PST3
//
// Résultat : { pst, arase, concluant, etapes, avertissements } — `etapes` est le raisonnement.

import { familleDe } from "./gtr2024.js";
import { comparaison as cmp, etape, mesure, nombre } from "./justification.js";
import { afficherEtat } from "./plateforme.js";

export const REFERENCE_PST = "GTR 2024, fascicule 1, tableau 17 (p. 76-78) et § 4.3.3";

/**
 * Portance d'arase mesurée à court terme (MPa) au-delà de laquelle une PST insensible à l'eau
 * peut prétendre à l'AR3 : sur ces matériaux, le guide autorise à assimiler les valeurs long
 * terme aux valeurs mesurées à court terme.
 */
export const MODULE_COURT_TERME_AR3 = 120;

/** Situations topographiques de la PST. */
export const SITUATIONS = [
  { cle: "remblai", libelle: "remblai" },
  { cle: "deblai", libelle: "déblai" },
  { cle: "profil-rasant", libelle: "profil rasant" },
];

/**
 * Traitements de la PST elle-même. Le GTR distingue nettement les deux objectifs :
 * l'amélioration agit à court terme sur la traficabilité et ne permet pas le reclassement en
 * PST4 ; seule la stabilisation, durable, l'autorise.
 */
export const TRAITEMENTS_PST = [
  { cle: "aucun", libelle: "Aucun traitement de la PST" },
  { cle: "amelioration", libelle: "Amélioration (traficabilité, court terme)" },
  { cle: "stabilisation", libelle: "Stabilisation chaux et/ou liants sur 0,35 m minimum" },
];

export const CONTEXTE_PAR_DEFAUT = Object.freeze({
  situation: "remblai", risqueNappe: false, drainageProfond: false, traitement: "aucun",
  drainageBaseChaussee: false, impermeabilisationArase: false,
});

const libelleSituation = (cle) => SITUATIONS.find((s) => s.cle === cle)?.libelle ?? "profil rasant";

/**
 * Cas de PST et classe d'arase pour un sol classé (résultat de classerSol), dans un contexte
 * donné. `moduleCourtTerme` : portance d'arase mesurée à court terme (MPa), facultative.
 */
export function conseillerPst(sol, contexte = {}, moduleCourtTerme = null) {
  const ctx = { ...CONTEXTE_PAR_DEFAUT, ...contexte };
  const etapes = [], avertissements = [];
  const fin = (pst, arase) => ({ pst, arase, concluant: pst != null, etapes, avertissements });

  if (sol?.classeNature == null) {
    avertissements.push("Classez d'abord le sol : le cas de PST se lit sur le couple nature / état hydrique.");
    return fin(null, null);
  }

  const famille = familleDe(sol.classeNature) ?? "";

  // ---------------------------------------------------------------- Matériaux insensibles à l'eau
  if (sol.insensible) {
    const cas = famille === "S" ? "PST5" : "PST6";
    etapes.push(etape(famille === "S"
      ? `Sol ${sol.symbole} : sable insensible à l'eau → PST5.`
      : `Sol ${sol.symbole} : matériau graveleux ou rocheux insensible à l'eau → PST6.`, [], cas));

    let arase = "AR2";
    if (mesure(moduleCourtTerme) && moduleCourtTerme >= MODULE_COURT_TERME_AR3) {
      arase = "AR3";
      etapes.push(etape(`Portance mesurée à court terme ${nombre(moduleCourtTerme, 0)} MPa ≥ ${MODULE_COURT_TERME_AR3} MPa : sur ces `
        + "matériaux insensibles à l'eau, le guide assimile la portance à long terme aux valeurs "
        + "mesurées à court terme → AR3.",
      [cmp("moduleCourtTerme", moduleCourtTerme, "≥", MODULE_COURT_TERME_AR3)], "AR3"));
    } else {
      etapes.push(etape("Portance d'arase par défaut AR2 : sur cette PST elle dépend beaucoup de la nature des "
        + "matériaux, et l'AR3 demande une mesure de portance qui la justifie.",
      mesure(moduleCourtTerme) ? [cmp("moduleCourtTerme", moduleCourtTerme, "<", MODULE_COURT_TERME_AR3)] : [], "AR2"));
    }

    avertissements.push("La couche de forme ne s'impose ici que pour la traficabilité et le nivellement : "
      + "elle peut se réduire à une couche de réglage.");
    return fin(cas, arase);
  }

  // ---------------------------------------------------------------- Matériaux sensibles à l'eau
  const etat = sol.etat;
  if (etat == null) {
    avertissements.push("État hydrique indéterminé : renseignez l'IPI, l'Ic ou w_n/w_OPN.");
    return fin(null, null);
  }

  etapes.push(etape(`Sol ${sol.symbole} : sensible à l'eau, état hydrique ${afficherEtat(etat)}.`));

  // La stabilisation prime sur l'état hydrique : c'est elle qui définit la PST4.
  if (ctx.traitement === "stabilisation") {
    etapes.push(etape("PST stabilisée à la chaux et/ou aux liants hydrauliques sur 0,35 m minimum → PST4, arase AR2.", [], "PST4"));
    if (etat === "h" || etat === "th") {
      avertissements.push("Depuis une PST1, la stabilisation doit être menée en deux couches (0,70 m minimum) "
        + "pour atteindre une PST4.");
    }
    avertissements.push("La durabilité du traitement suppose une étude de performances, un contrôle d'exécution, "
      + "une finesse de mouture 0/40 mm max et un drainage approprié de la PST en déblai.");
    return fin("PST4", "AR2");
  }

  if (ctx.traitement === "amelioration") {
    avertissements.push("Traitement d'amélioration seulement : il agit sur la traficabilité, pas sur la portance "
      + "à long terme, et ne permet pas le reclassement en PST4. Le sol reste rangé selon son "
      + "état hydrique.");
  }

  if (etat === "th") {
    etapes.push(etape("État très humide (th) → PST0 : aucune couche de forme n'est possible en l'état.", [], "PST0"));
    avertissements.push("Reclassez la PST en PST1 à PST4 par drainage, purge, substitution ou traitement avec un "
      + "liant adapté. Un rabattement de nappe peut s'avérer nécessaire, et un drainage définitif "
      + "est fortement conseillé.");
    return fin("PST0", "AR0");
  }

  if (etat === "h") {
    etapes.push(etape("État humide (h), matériau sensible à l'eau de mauvaise portance à la mise en œuvre → PST1.", [], "PST1"));
    avertissements.push("Deux voies : améliorer le matériau par traitement — on est alors ramené en PST2, 3 ou 4 — "
      + "ou exécuter une couche de forme granulaire insensible à l'eau de forte épaisseur, ce qui "
      + "exige une portance de 15 à 20 MPa à l'arase ; en dessous, on retombe en PST0.");
    avertissements.push("Une couche de forme traitée est impossible sur une PST1.");
    if (ctx.situation !== "remblai") avertissements.push("En déblai ou profil rasant, un drainage de la PST est conseillé.");
    return fin("PST1", "AR1");
  }

  // États (m) et (s) : c'est le risque de remontée de nappe qui sépare PST2 de PST3.
  const solFin = famille === "F";
  const tresPlastique = ["F3", "F4", "F4+"].includes(sol.classeNature);

  let sansRisqueNappe;
  if (ctx.risqueNappe) {
    sansRisqueNappe = false;
    etapes.push(etape("Risque de remontée de nappe dans la PST signalé."));
  } else if (ctx.situation === "remblai") {
    sansRisqueNappe = true;
    etapes.push(etape("Remblai sans risque de remontée de nappe."));
  } else if (ctx.drainageProfond) {
    sansRisqueNappe = true;
    etapes.push(etape(`En ${libelleSituation(ctx.situation)}, un drainage profond de la PST permet le rabattement de la nappe.`));
  } else {
    sansRisqueNappe = false;
    etapes.push(etape(`En ${libelleSituation(ctx.situation)} sans drainage profond de la PST, le rabattement de nappe `
      + "n'est pas assuré."));
  }

  if (sansRisqueNappe && tresPlastique) {
    sansRisqueNappe = false;
    etapes.push(etape(`Matériau ${sol.classeNature} : le guide maintient le classement en PST2 pour les sols `
      + "F3 et F4, même lorsque le drainage est assuré."));
  }

  if (!sansRisqueNappe) {
    etapes.push(etape("→ PST2 : bonne portance à la mise en œuvre, mais chute possible à long terme sous "
      + "l'infiltration des eaux pluviales et une remontée de nappe.", [], "PST2"));
    avertissements.push("Un rabattement de nappe à profondeur suffisante et un drainage des eaux d'infiltration "
      + "ramèneraient en PST3, donc à une couche de forme moins épaisse.");
    return fin("PST2", "AR1");
  }

  etapes.push(etape("→ PST3 : chute de portance possible sous la seule infiltration, sans risque de remontée de nappe.", [], "PST3"));

  // Arase de la PST3 : l'AR2 se mérite.
  if (etat === "s") {
    etapes.push(etape("Sol à l'état sec (s) : le guide limite le classement à l'AR1.", [], "AR1"));
    return fin("PST3", "AR1");
  }

  if (solFin) {
    etapes.push(etape("Sol fin (classe F) : en général les sols fins ne permettent pas d'accéder en l'état à "
      + "une AR2 → AR1.", [], "AR1"));
    return fin("PST3", "AR1");
  }

  if (!ctx.drainageBaseChaussee || !ctx.impermeabilisationArase) {
    etapes.push(etape("L'AR2 exige un drainage à la base de la chaussée ET une imperméabilisation de l'arase "
      + "pour évacuer les eaux et éviter leur infiltration dans la PST : conditions non réunies → AR1.",
    [cmp("drainageBaseChaussee", !!ctx.drainageBaseChaussee, "=", true),
      cmp("impermeabilisationArase", !!ctx.impermeabilisationArase, "=", true)], "AR1"));
    return fin("PST3", "AR1");
  }

  etapes.push(etape("État moyen (m), drainage à la base de la chaussée et imperméabilisation de l'arase réunis, "
    + "matériau non fin → AR2 (50 MPa).", [], "AR2"));
  avertissements.push("Le classement d'arase reste à évaluer selon la nature réelle des matériaux.");
  return fin("PST3", "AR2");
}
