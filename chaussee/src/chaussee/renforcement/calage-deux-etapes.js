// Le calage en deux temps du guide Cerema/IDRRIM 2016, § 3.4.2 puis § 3.4.3
// (portage de TwoStageCalibration de Burmister-Calc).
//
// La méthode ne cale PAS la déflexion et le rayon ensemble : les deux mesures
// ne parlent pas de la même partie de la chaussée. La déflexion maximale
// intègre toute la structure, sol compris : elle donne le module du sol. Le
// rayon de courbure décrit le creux près de la charge, là où la raideur des
// couches liées domine : il donne le module des couches bitumineuses — « et
// indépendamment de la valeur de la déflexion ».
//
//  · Étape 2 — couches liées à leur valeur forfaitaire, granulaires à k = 2,
//    la déflexion caractéristique donne le module du sol (une inconnue, une
//    mesure).
//  · Étape 3 — le sol étant figé (et avec lui les granulaires), le rayon de
//    courbure donne le module des couches bitumineuses, à la température de
//    mesure et à la fréquence estimée, puis ramené aux conditions du projet.
//
// Une couche dont le module est ARRÊTÉ par le projeteur (`moduleArrete`) n'est
// jamais déplacée : la poser d'après les carottages est une décision.

import { retrocalculer } from "../retrocalcul.js";
import { ESSIEU_REFERENCE } from "../burmister.js";
import { RAPPORT_GRANULAIRE } from "./plafond-gnt.js";
import {
  classerBitumineux, coefficientTemperature, coefficientTemperatureDetail, frequenceEstimeeHz,
  versConditionsMesure, versConditionsProjet, MODULE_INVRAISEMBLABLE_MPA, SEUIL_SUBSTRATUM_MPA,
  TEMPERATURE_MIN_TABLEAU, TEMPERATURE_MAX_TABLEAU, TEMPERATURE_REFERENCE_C,
} from "./conditions-modules.js";
import { nf, milliers } from "./format.js";

export const REFERENCE_CALAGE_DEUX_ETAPES =
  "Guide Cerema/IDRRIM 2016, § 3.4.2 et § 3.4.3 (repris aux § 4.4, 5.4, 6.4 et 7.4)";

export const PRINCIPE_CALAGE_DEUX_ETAPES =
  "La déflexion maximale intègre toute la structure : elle donne le module du sol. Le rayon "
  + "de courbure décrit le creux près de la charge : il donne le module des couches "
  + "bitumineuses. Le guide cale l'un puis l'autre, et jamais les deux ensemble.";

/** Vitesse de mesure retenue par défaut (déflectographe ordinaire, sous 10 km/h). */
export const VITESSE_DEFAUT_KMH = 4;

const REGLE_SOL =
  "« Le module du sol est alors déterminé par calcul inverse à partir de la valeur de la "
  + "déflexion caractéristique de la section témoin, et conséquemment celui des couches "
  + "granulaires sus-jacentes. » (§ 3.4.2)";

const REGLE_BITUMINEUX =
  "« Le module du sol étant fixé, la valeur du rayon de courbure permet de déterminer le "
  + "module des couches bitumineuses, et indépendamment de la valeur de la déflexion, à la "
  + "température de mesure et pour une fréquence estimée de 1 Hz (sous 10 km/h) ou 3 Hz "
  + "(au-dessus). » (§ 3.4.3 / 4.4.3)";

const TITRE_SOL = "Étape 2 — le module du sol par la déflexion";
const TITRE_BITUMINEUX = "Étape 3 — les modules bitumineux par le rayon de courbure";

/** Une étape du calage : ce qu'elle a fait, et ce qu'elle a trouvé. */
function etape(titre, regle, menee, convergee, mesure, simule, etapes, avertissements) {
  return {
    titre, regle, menee, convergee, mesure, simule, etapes, avertissements,
    /** Écart relatif entre mesure et simulation, en %. */
    ecartPourcent: Math.abs(mesure) < 1e-12 || !Number.isFinite(mesure) ? NaN : ((simule - mesure) / mesure) * 100,
  };
}

/**
 * Le sol support : la dernière couche non bitumineuse au-dessus du substratum
 * (reconnu à sa raideur, ≥ 9 000 MPa), ou la dernière couche s'il n'y en a pas.
 */
function indiceDuSol(couches) {
  if (couches.length < 2) return -1;
  const dernier = couches.length - 1;
  const sol = couches[dernier].E >= SEUIL_SUBSTRATUM_MPA ? dernier - 1 : dernier;
  return sol >= 0 && couches[sol].famille !== "bitumineux" ? sol : -1;
}

/** Les couches bitumineuses, de haut en bas, en bloc contigu partant de la surface. */
function blocBitumineux(couches, indiceSol) {
  const bloc = [];
  for (let i = 0; i < indiceSol; i++) {
    if (couches[i].famille === "bitumineux") bloc.push(i);
    else if (bloc.length > 0) break;
  }
  return bloc;
}

function* reserves(r) {
  if (!r.converge) yield `Optimiseur sorti sans converger (écart ${nf(r.ecartRmsRelatifPourcent, 2)} %).`;
  if (r.avertissement) yield r.avertissement;
}

const appliquer = (travail, modules) => travail.forEach((c, i) => { c.E = modules[i]; });

// ──────────────────────────────── Étape 2 ─────────────────────────────────

function etapeSol(travail, essieu, d0, indiceSol, avertissements, conversionAller, arretes) {
  const etapes = [...conversionAller];
  const reservesEtape = [];

  if (Number.isNaN(d0) || !(d0 > 0)) {
    reservesEtape.push("Pas de déflexion caractéristique : l'étape 2 ne peut pas être menée.");
    return etape(TITRE_SOL, REGLE_SOL, false, false, d0, NaN, etapes, reservesEtape);
  }

  if (arretes[indiceSol]) {
    reservesEtape.push(`« ${travail[indiceSol].nom} » est figé par le projeteur : l'étape 2 n'a `
      + "plus d'inconnue et n'a pas été menée. Libérez le sol (statut « Libre ») "
      + "pour le caler sur la déflexion.");
    avertissements.push(...reservesEtape);
    return etape(TITRE_SOL, REGLE_SOL, false, false, d0, NaN, etapes, reservesEtape);
  }

  // Statuts du § x.4.2 : liées forfaitaires (figées), granulaires à k = 2, sol
  // cherché, substratum figé. Une couche arrêtée garde son module.
  travail.forEach((c, i) => {
    if (i === indiceSol) { c.contrainte = "libre"; return; }
    if (i > indiceSol || arretes[i]) { c.contrainte = "fixe"; return; }
    if (c.famille === "sol") { c.contrainte = "liee"; c.rapport ??= RAPPORT_GRANULAIRE; }
    else c.contrainte = "fixe";
  });

  const tenues = arretes.slice(0, indiceSol).filter(Boolean).length;
  if (tenues > 0) etapes.push(`${tenues} couche(s) figée(s) par le projeteur, laissée(s) telle(s) quelle(s).`);
  etapes.push("Couches liées figées à leur valeur forfaitaire : "
    + travail.filter((c) => c.famille === "bitumineux").map((c) => `${c.nom} ${nf(c.E, 0)} MPa`).join(", "));
  etapes.push(`Couches granulaires liées à la couche inférieure par k = ${nf(RAPPORT_GRANULAIRE, 1)}.`);
  etapes.push(`Seul inconnu : le module de « ${travail[indiceSol].nom} ».`);

  const r = retrocalculer(travail, essieu,
    { mode: "benkelman", d0, rdc: null, iterationsMax: 80, tolerance: 1e-12 },
    [travail[indiceSol].E]);
  appliquer(travail, r.modules);

  etapes.push(`Module du sol retrouvé : ${nf(travail[indiceSol].E, 1)} MPa `
    + "(les granulaires suivent : "
    + travail.slice(0, indiceSol).filter((c) => c.famille === "sol").map((c) => nf(c.E, 0)).join(", ") + " MPa).");

  reservesEtape.push(...reserves(r));
  avertissements.push(...reservesEtape);
  return etape(TITRE_SOL, REGLE_SOL, true, r.converge, d0, r.simule[0], etapes, reservesEtape);
}

// ──────────────────────────────── Étape 3 ─────────────────────────────────

function etapeBitumineuse(travail, essieu, rayon, indiceSol, avertissements, arretes) {
  const etapes = [], reservesEtape = [];
  const bloc = blocBitumineux(travail, indiceSol);

  if (!(typeof rayon === "number" && rayon > 0)) {
    reservesEtape.push("Rayon de courbure non mesuré : l'étape 3 est sautée et les modules "
      + "bitumineux restent à leur valeur forfaitaire. Le guide renvoie alors "
      + "au tableau 31, d'après l'état des carottes.");
    avertissements.push(...reservesEtape);
    return etape(TITRE_BITUMINEUX, REGLE_BITUMINEUX, false, false, NaN, NaN, etapes, reservesEtape);
  }

  if (bloc.length === 0) {
    reservesEtape.push("Aucune couche bitumineuse : l'étape 3 n'a pas d'objet.");
    avertissements.push(...reservesEtape);
    return etape(TITRE_BITUMINEUX, REGLE_BITUMINEUX, false, false, rayon, NaN, etapes, reservesEtape);
  }

  // Le sol est désormais FIGÉ, et les granulaires avec lui (elles suivent un sol qui ne bouge plus).
  travail.forEach((c, i) => {
    if (i >= indiceSol) { c.contrainte = "fixe"; return; }
    if (c.famille === "sol") { c.contrainte = "liee"; c.rapport ??= RAPPORT_GRANULAIRE; }
    else c.contrainte = "fixe";
  });

  const libres = bloc.filter((i) => !arretes[i]);
  if (libres.length === 0) {
    reservesEtape.push("Toutes les couches bitumineuses sont figées : leurs modules ont été "
      + "arrêtés délibérément — d'après les carottages, en général — et "
      + "l'étape 3 n'a rien à chercher. Le guide ne demande de les affiner "
      + "que « si possible ».");
    avertissements.push(...reservesEtape);
    return etape(TITRE_BITUMINEUX, REGLE_BITUMINEUX, false, false, rayon, NaN, etapes, reservesEtape);
  }

  if (libres.length < bloc.length)
    etapes.push(`${bloc.length - libres.length} couche(s) bitumineuse(s) laissée(s) figée(s) par `
      + "le projeteur : elles ne bougent pas.");

  // Les couches libres bougent ENSEMBLE, dans leurs proportions d'origine : un
  // rayon de courbure ne fait qu'une mesure, donc une seule inconnue.
  const plusProfonde = libres[libres.length - 1];
  travail[plusProfonde].contrainte = "libre";
  for (let k = libres.length - 2; k >= 0; k--) {
    const i = libres[k];
    const dessous = travail[i + 1].E;
    if (!(dessous > 0)) {
      reservesEtape.push(`« ${travail[i].nom} » : la couche inférieure n'a pas de module, `
        + "le rapport ne peut pas être posé — couche figée.");
      travail[i].contrainte = "fixe";
      continue;
    }
    travail[i].contrainte = "liee";
    travail[i].rapport = travail[i].E / dessous;
  }

  etapes.push(`Sol figé à ${nf(travail[indiceSol].E, 1)} MPa, granulaires figées avec lui.`);
  etapes.push("Les couches bitumineuses varient ensemble, dans leurs proportions d'origine : "
    + libres.map((i) => `${travail[i].nom} ${nf(travail[i].E, 0)}`).join(", ") + " MPa. "
    + "Un rayon de courbure ne fait qu'une mesure, donc une seule inconnue.");

  const r = retrocalculer(travail, essieu,
    { mode: "benkelman", d0: 0, rdc: rayon, poids: [0, 1], iterationsMax: 80, tolerance: 1e-12 },
    [travail[plusProfonde].E]);
  appliquer(travail, r.modules);

  etapes.push("Modules bitumineux retrouvés (conditions de la mesure) : "
    + bloc.map((i) => `${travail[i].nom} ${nf(travail[i].E, 1)}` + (arretes[i] ? " (figé)" : "")).join(", ") + " MPa.");

  reservesEtape.push(...reserves(r));
  avertissements.push(...reservesEtape);

  // Le résidu affiché est celui du RAYON, la seule grandeur que cette étape cale.
  return etape(TITRE_BITUMINEUX, REGLE_BITUMINEUX, true, r.converge, rayon, r.simule[1], etapes, reservesEtape);
}

// ──────────────────────────────── Enchaînement ────────────────────────────

/**
 * Enchaîne les deux étapes sur le modèle de diagnostic (diagnostic.js), de
 * haut en bas. Les statuts portés par les couches sont ignorés — la méthode
 * pose les siens —, sauf `moduleArrete`, qui tient la couche à toutes les étapes.
 *
 * `mesures` : { d0 (déflexion caractéristique, 1/100 mm), rayon (m, null si
 * non relevé : l'étape 3 est sautée), temperatureMesure (°C), vitesse (km/h,
 * 4 par défaut), temperatureModules (°C : température à laquelle les modules
 * bitumineux d'entrée sont exprimés — la Teq du projet ; null les prend pour
 * déjà exprimés aux conditions de la mesure) }.
 *
 * Renvoie { modules (état de travail, aux conditions de la MESURE),
 * modulesProjet ({ indice: module } des couches bitumineuses, ramenés à 10 Hz
 * et à la température du projet — ce sont eux qu'on pose), modulesPublies
 * (modules avec les bitumineux remplacés par modulesProjet : ce
 * qu'« Appliquer à la structure » écrit), etapeSol, etapeBitumineuse,
 * avertissements, ok }.
 */
export function calerEnDeuxEtapes(couches, essieu = ESSIEU_REFERENCE, {
  d0, rayon = null, temperatureMesure = TEMPERATURE_REFERENCE_C, vitesse = null, temperatureModules = null,
} = {}) {
  const avertissements = [];
  const v = Number.isFinite(vitesse) ? vitesse : VITESSE_DEFAUT_KMH;
  if (!Number.isFinite(vitesse))
    avertissements.push(`Vitesse de mesure non renseignée : ${nf(VITESSE_DEFAUT_KMH, 1)} km/h retenus, `
      + "soit 1 Hz. Elle change le module bitumineux d'un facteur 1,5.");

  const travail = couches.map((c) => ({ ...c }));
  const indiceSol = indiceDuSol(travail);
  // Les arrêts posés par le projeteur, relevés AVANT que les étapes ne posent leurs statuts.
  const arretes = travail.map((c) => !!c.moduleArrete);
  const fin = (sol, bit, modulesProjet) => {
    const modules = travail.map((c) => c.E);
    const modulesPublies = modules.slice();
    for (const [i, val] of Object.entries(modulesProjet)) modulesPublies[+i] = val;
    return {
      modules, modulesProjet, modulesPublies, etapeSol: sol, etapeBitumineuse: bit, avertissements,
      ok: sol.convergee && (!bit.menee || bit.convergee),
    };
  };

  if (indiceSol < 0) {
    avertissements.push("Aucun sol support identifiable : le calage ne peut pas commencer.");
    const vide = etape("—", "—", false, false, NaN, NaN, [], []);
    return fin(vide, vide, {});
  }

  const tCatalogue = Number.isFinite(temperatureModules) ? temperatureModules : null;

  // Conversion ALLER des modules bitumineux forfaitaires vers les conditions de la mesure.
  const aller = [];
  if (tCatalogue !== null) {
    for (const c of travail) {
      if (c.famille !== "bitumineux") continue;
      const avant = c.E;
      c.E = versConditionsMesure(avant, classerBitumineux(c), tCatalogue, temperatureMesure, v);
      aller.push(`« ${c.nom} » : ${nf(avant, 0)} MPa à ${nf(tCatalogue, 1)} °C et 10 Hz `
        + `→ ${nf(c.E, 0)} MPa aux conditions de la mesure `
        + `(${nf(temperatureMesure, 1)} °C, ${nf(frequenceEstimeeHz(v), 0)} Hz).`);
    }
  }

  const sol = etapeSol(travail, essieu, d0, indiceSol, avertissements, aller, arretes);
  const bit = etapeBitumineuse(travail, essieu, rayon, indiceSol, avertissements, arretes);

  // Retour à 10 Hz et à la température du PROJET (et non à 15 °C).
  const modulesProjet = {};
  travail.forEach((c, i) => {
    if (c.famille !== "bitumineux") return;
    // Une couche ARRÊTÉE revient telle qu'elle est partie.
    if (arretes[i]) { modulesProjet[i] = couches[i].E; return; }
    modulesProjet[i] = versConditionsProjet(c.E, classerBitumineux(c), temperatureMesure, v,
                                            tCatalogue ?? TEMPERATURE_REFERENCE_C);
  });

  if (bit.menee && Object.keys(modulesProjet).length > 0) {
    const premiere = travail.find((c) => c.famille === "bitumineux");
    if (coefficientTemperatureDetail(classerBitumineux(premiere), temperatureMesure).borne)
      avertissements.push(`Température de mesure (${nf(temperatureMesure, 1)} °C) hors du tableau A7.3 `
        + `[${nf(TEMPERATURE_MIN_TABLEAU, 0)} ; ${nf(TEMPERATURE_MAX_TABLEAU, 0)} °C] : `
        + "le coefficient de bord a été retenu, sans extrapolation.");

    // Garde-fou de vraisemblance, jugé À 15 °C (là où vit le tableau A7.2) :
    // seule la température est ramenée, E(15) = c(θ) × E(θ) ; le module rendu
    // est déjà à 10 Hz.
    for (const [cle, valeur] of Object.entries(modulesProjet)) {
      const i = +cle;
      const aQuinze = valeur * coefficientTemperature(classerBitumineux(travail[i]), tCatalogue ?? TEMPERATURE_REFERENCE_C);
      if (aQuinze <= MODULE_INVRAISEMBLABLE_MPA) continue;
      avertissements.push(`« ${travail[i].nom} » ressort à ${milliers(valeur)} MPa une fois ramené à `
        + "15 °C et 10 Hz, alors que le matériau bitumineux le plus raide du "
        + "tableau A7.2 vaut 14 000 MPa. Le rayon de courbure retenu "
        + `(${nf(rayon, 0)} m) n'est pas compatible avec cette structure : vérifiez `
        + `la mesure, la température retenue (${nf(temperatureMesure, 1)} °C) et `
        + "les épaisseurs avant de vous servir de ce calage.");
    }
  }

  return fin(sol, bit, modulesProjet);
}
