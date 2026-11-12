// Le point de départ du rétrocalcul, tel que les guides le prescrivent
// (portage de BackCalculationSetup de Burmister-Calc), et les passerelles que
// l'application tend entre l'auscultation, la structure et le rétrocalcul.
//
// Le raisonnement des guides est économe : un rétrocalcul cherche d'autant
// mieux qu'il cherche moins. Les carottages fixent les épaisseurs, l'état des
// interfaces et le module des couches liées ; les couches granulaires se
// déduisent de la couche du dessous par le rapport k ; il ne reste que LE
// MODULE DU SOL SUPPORT à chercher. Une inconnue pour une mesure : la solution
// est unique.

import { grillePlafond, RAPPORT_GRANULAIRE } from "./plafond-gnt.js";
import { MODULE_SANS_CAROTTAGE_MPA, PLANCHER_VITESSE_MPA, ajusterVitesse, facteurVitesse } from "./modules-depart.js";
import { SEUIL_SUBSTRATUM_MPA } from "./conditions-modules.js";
import { nf } from "./format.js";

export const REFERENCE_MISE_EN_PLACE =
  "Cerema/IDRRIM 2016, § 3.4 et 4.4 (tableaux 20, 21, 30 et 31) ; "
  + "fascicule 6 du catalogue tunisien RevA, tableau 5";

export const PRINCIPE_MISE_EN_PLACE =
  "Un rétrocalcul cherche d'autant mieux qu'il cherche moins. Les carottages fixent les "
  + "modules des couches liées, les couches granulaires se déduisent de la couche du dessous "
  + "par le rapport k = 2, et il ne reste que le module du sol support à chercher : une "
  + "inconnue pour une mesure, donc une solution unique.";

/**
 * Point de départ « sans carottage » : 2 000 MPa pour toutes les couches
 * bitumineuses (forfait assumé par le guide), granulaires à k = 2 plafonnées
 * par la grille du pays, sol cherché.
 *
 * `options` : { vitesse (km/h, facultative : elle fait chuter le module
 * bitumineux retenu pour caler le sol, plancher 2 000 MPa), proprete
 * ("propre"), humidite ("humide"), plafond (grille, clé `plafondGnt` ou pays ;
 * Cerema par défaut) }.
 *
 * Renvoie { couches: [{ indice, nom, moduleDepart, cherche, raison }], notes,
 * avertissements, nombreCherches }.
 */
export function pointDeDepartSansCarottage(couches, {
  vitesse = null, proprete = "propre", humidite = "humide", plafond = null,
} = {}) {
  const grille = grillePlafond(plafond);
  const res = [], notes = [], avertissements = [], nonDeclarees = [];
  const fin = () => ({ couches: res, notes, avertissements, nombreCherches: res.filter((l) => l.cherche).length });

  if (couches.length === 0) {
    avertissements.push("Aucune couche dans l'empilement : rien à préparer.");
    return fin();
  }

  notes.push(PRINCIPE_MISE_EN_PLACE);
  notes.push("Aucun carottage n'a été saisi : les couches bitumineuses partent au forfait de "
    + `${nf(MODULE_SANS_CAROTTAGE_MPA, 0)} MPa, valeur que le guide retient faute de sondage.`);

  const dernier = couches.length - 1;
  // Le modèle de diagnostic se termine par un massif rigide de 10 000 MPa : ce n'est pas le
  // sol. Le prendre pour le support revenait à chercher le module du substratum et à figer le
  // vrai sol. Reconnu à sa raideur, comme dans le calage en deux temps ; le sol est au-dessus.
  const substratum = couches.length >= 2 && couches[dernier].E >= SEUIL_SUBSTRATUM_MPA;
  const indiceSol = substratum ? dernier - 1 : dernier;
  const departSol = couches[indiceSol].E > 0 ? couches[indiceSol].E : 50;
  const avecVitesse = Number.isFinite(vitesse);

  // Parcours DE BAS EN HAUT : une couche granulaire se déduit de celle du dessous.
  let dessous = departSol;
  for (let i = dernier; i >= 0; i--) {
    const c = couches[i];
    if (substratum && i === dernier) {
      res.push({ indice: i, nom: c.nom, moduleDepart: c.E, cherche: false,
        raison: `Massif rigide (${nf(c.E, 0)} MPa, au-delà de ${nf(SEUIL_SUBSTRATUM_MPA, 0)} MPa) : `
          + "module conservé et fixé. Ce n'est pas le sol support — c'est la couche du dessus qui est cherchée." });
      continue;
    }
    if (i === indiceSol) {
      res.push({ indice: i, nom: c.nom, moduleDepart: departSol, cherche: true,
        raison: "Support : c'est le seul module cherché. Le point de départ vaut la portance "
          + "estimée ; sur un système déterminé, il n'influence pas la solution trouvée." });
      continue;
    }
    let e;
    if (c.famille === "bitumineux") {
      e = MODULE_SANS_CAROTTAGE_MPA;
      let raison = `Matériau bitumineux sans carottage : ${nf(e, 0)} MPa (Cerema § 4.4).`;
      if (avecVitesse) {
        raison += ` Vitesse de mesure ${nf(vitesse, 1)} km/h, facteur `
          + `${nf(facteurVitesse(vitesse), 2)} — le plancher de `
          + `${nf(PLANCHER_VITESSE_MPA, 0)} MPa s'applique.`;
        e = ajusterVitesse(e, "sain", vitesse);
      }
      res.push({ indice: i, nom: c.nom, moduleDepart: e, cherche: false, raison });
    } else if (c.famille === "sol") {
      e = grille.module(dessous, proprete, humidite);
      res.push({ indice: i, nom: c.nom, moduleDepart: e, cherche: false,
        raison: `Grave non traitée : ${nf(RAPPORT_GRANULAIRE, 0)} × ${nf(dessous, 0)} MPa `
          + "(couche inférieure), plafonné à "
          + `${nf(grille.max(proprete, humidite), 0)} MPa selon la propreté et `
          + `l'état hydrique constatés (${grille.reference}).` });
    } else if (!c.famille) {
      // Famille non déclarée : on ne sait pas de quel matériau il s'agit, il y a une saisie à compléter.
      e = c.E > 0 ? c.E : MODULE_SANS_CAROTTAGE_MPA;
      nonDeclarees.push(c.nom);
      res.push({ indice: i, nom: c.nom, moduleDepart: e, cherche: false,
        raison: "Famille de matériau non renseignée : le module saisi est conservé faute de "
          + "savoir quelle règle du guide appliquer. Choisir un matériau dans l'onglet "
          + "Structure ou Matériaux fait entrer la couche dans le barème." });
    } else {
      e = c.E > 0 ? c.E : MODULE_SANS_CAROTTAGE_MPA;
      res.push({ indice: i, nom: c.nom, moduleDepart: e, cherche: false,
        raison: "Module conservé tel qu'il est saisi : le guide ne donne pas de forfait "
          + "pour cette famille sans carottage." });
    }
    dessous = e;
  }
  res.reverse();

  if (nonDeclarees.length > 0)
    avertissements.push(`Famille de matériau non renseignée sur ${nonDeclarees.length} couche(s) — `
      + nonDeclarees.join(", ") + ". Aucune règle du guide ne leur a été "
      + "appliquée : leur module reste celui qui a été saisi. Choisir un matériau "
      + "du catalogue du pays les fait entrer dans le barème.");
  if (!avecVitesse)
    avertissements.push("Vitesse de mesure non renseignée : le facteur de fréquence n'a pas été "
      + "appliqué aux modules bitumineux. Le module du sol calé s'en trouvera "
      + "surestimé si la mesure a été faite au déflectographe.");
  avertissements.push("Point de départ forfaitaire, faute de carottage. Le guide demande des sondages : "
    + "ils fixent les épaisseurs réelles, l'état des interfaces et le module des couches "
    + "liées, et ce sont eux qui font passer d'une estimation à une détermination.");
  return fin();
}

/** Diagnostic du système avant lancement : combien d'inconnues pour combien de mesures. */
export function determination(cherches, mesures) {
  if (cherches === 0) return "Aucun module n'est recherché : il n'y a rien à caler.";
  if (cherches > mesures)
    return `${cherches} module(s) recherché(s) pour ${mesures} mesure(s) : le système est `
      + "sous-déterminé. Une infinité de jeux de modules reproduisent exactement les mêmes "
      + "mesures, et celui que le calcul retiendra dépendra du point de départ. Fixer une "
      + "couche, lier deux modules par un ratio, ou ajouter une mesure.";
  if (cherches === mesures)
    return `${cherches} module(s) recherché(s) pour ${mesures} mesure(s) : le système est `
      + "déterminé, la solution est unique.";
  return `${cherches} module(s) recherché(s) pour ${mesures} mesure(s) : le système est `
    + "surdéterminé. La solution est unique au sens des moindres carrés, et l'écart "
    + "résiduel mesure la qualité du modèle autant que celle du calage.";
}

// ───────────────────── Passerelles de l'application ───────────────────────

/**
 * Écrit le point de départ dans la structure (geste « Appliquer le point de
 * départ du guide ») : une couche cherchée devient "libre" et part du module
 * proposé (`moduleDepart`), les autres deviennent "fixe" à ce module. Rien
 * n'est verrouillé : la structure rendue reste modifiable.
 *
 * Renvoie { couches, modulesDepart (dans l'ordre des couches libres, à
 * passer à retrocalculer), etapes (une ligne par couche), avertissements,
 * resume }. `nombreMesures` sert au diagnostic de détermination.
 */
export function appliquerPointDeDepart(couches, pointDeDepart, nombreMesures = 1) {
  const n = Math.min(pointDeDepart.couches.length, couches.length);
  const res = couches.map((c) => ({ ...c }));
  const modulesDepart = [];
  const etapes = [];
  for (let i = 0; i < n; i++) {
    const p = pointDeDepart.couches[i];
    if (p.cherche) {
      res[i].contrainte = "libre";
      res[i].moduleDepart = p.moduleDepart;
      modulesDepart.push(p.moduleDepart);
    } else {
      res[i].contrainte = "fixe";
      res[i].E = p.moduleDepart;
    }
    etapes.push(`${p.nom} — ${nf(p.moduleDepart, 0)} MPa ` + (p.cherche ? "(recherché)" : "(fixé)") + " : " + p.raison);
  }
  const resume = pointDeDepart.couches.length === 0
    ? "Aucune couche à préparer."
    : `${pointDeDepart.nombreCherches} module(s) laissé(s) à chercher. `
      + determination(pointDeDepart.nombreCherches, nombreMesures);
  return { couches: res, modulesDepart, etapes, avertissements: [...pointDeDepart.avertissements], resume };
}

/**
 * Les mesures à caler, tirées du dépouillement d'une campagne (campagne-deflexion.js) :
 * { disponible, d0 (déflexion caractéristique), rdc (rayon caractéristique au
 * 2ᵉ décile, null si non mesuré), rayonMedian, rayonCalage (médian pour une
 * chaussée souple — § 3.4.3 —, caractéristique sinon — § 4.4.3), regleRayon,
 * temperature, vitesse, proposition, noteRayonMedian }.
 */
export function mesuresDepuisCampagne(campagne) {
  const ens = campagne.retenues().length > 0 ? campagne.ensemble() : null;
  const d0 = ens ? ens.deflexionCaracteristique : NaN;
  const disponible = Number.isFinite(d0);
  const rdc = ens?.rayonCaracteristique ?? null;
  const rayonMedian = ens?.rayonMedian ?? null;
  const souple = campagne.typeStructure === "souple";
  const regleRayon = souple
    ? "Chaussée souple : le guide retient le rayon MÉDIAN pour ajuster les modules bitumineux (§ 3.4.3)."
    : "Chaussée non souple : le guide retient le rayon CARACTÉRISTIQUE, 2ᵉ décile (§ 4.4.3).";
  const proposition = !disponible
    ? "Aucune mesure dans l'auscultation. Les valeurs à caler sont à saisir à la main."
    : `L'auscultation donne une déflexion caractéristique de ${nf(d0, 1)} (1/100 mm) `
      + (rdc !== null ? `et un rayon caractéristique de ${nf(rdc, 0)} m, ` : "sans rayon de courbure, ")
      + `à ${nf(campagne.temperatureReference, 1)} °C. `
      + "Ce sont ces valeurs qu'il faut caler, et non une mesure isolée : c'est le "
      + "dépouillement de la campagne qui fait foi.";
  const noteRayonMedian = disponible && rayonMedian !== null
    ? `Rayon médian de la campagne : ${nf(rayonMedian, 0)} m. Il ne sert pas au calage — le guide le `
      + "réserve à l'ajustement des modules bitumineux — mais il figure ici pour éviter "
      + "qu'on le confonde avec le rayon caractéristique au 2ᵉ décile."
    : "";
  return {
    disponible, d0, rdc, rayonMedian,
    rayonCalage: souple ? rayonMedian : rdc,
    regleRayon,
    temperature: campagne.temperatureReference,
    vitesse: Number.isFinite(campagne.vitesse) ? campagne.vitesse : null,
    proposition, noteRayonMedian,
  };
}
