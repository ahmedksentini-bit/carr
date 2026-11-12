// Le modèle de calcul inverse du guide Cerema/IDRRIM 2016, § 3.4.1 (portage de
// DiagnosticModel de Burmister-Calc) — celui qu'on construit AVANT de lancer le
// rétrocalcul, et qui n'est pas la structure de dimensionnement.
//
// Trois transformations, que le guide prescrit littéralement :
//  1. les graves non traitées sont découpées en sous-couches d'au plus 0,10 m,
//     EN PARTANT DU BAS (« une couche de 0,25 m se décompose en partant du bas
//     en sous-couches de 0,10 m, 0,10 m et 0,05 m ») : le reliquat est en haut ;
//  2. le module de chaque sous-couche granulaire vaut k = 2 fois celui de la
//     couche immédiatement inférieure, plafonné selon la propreté et
//     l'humidité constatées par la grille du pays (plafond-gnt.js) ;
//  3. le sol reçoit une épaisseur conventionnelle de 6 m et repose sur un
//     massif semi-infini rigide (E = 10 000 MPa, ν = 0,25).
//
// Le troisième point n'est pas cosmétique : un sol semi-infini surestime la
// déflexion sans toucher au rayon de courbure ; sans substratum, un modèle ne
// peut pas reproduire à la fois une déflexion et un rayon mesurés.

import { grillePlafond, RAPPORT_GRANULAIRE } from "./plafond-gnt.js";
import { nf, milliers } from "./format.js";

export const REFERENCE_MODELE_DIAGNOSTIC =
  "Guide Cerema/IDRRIM 2016 « Diagnostic et conception des renforcements de chaussée », "
  + "§ 3.4.1 (repris identiquement aux § 4.4.1, 5.4.1, 6.4.1 et 7.4.1)";

/** Épaisseur maximale d'une sous-couche granulaire (m). */
export const EPAISSEUR_SOUS_COUCHE_M = 0.10;
/** Épaisseur conventionnelle du sol support sous la chaussée (m). */
export const EPAISSEUR_SOL_CONVENTIONNELLE_M = 6.0;
export const MODULE_SUBSTRATUM_MPA = 10000;
export const POISSON_SUBSTRATUM = 0.25;
export const NOM_SUBSTRATUM = "Substratum rigide";

/**
 * Découpage d'une épaisseur en sous-couches de 0,10 m au plus, EN PARTANT DU
 * BAS. Épaisseurs rendues de HAUT en BAS : 0,25 m donne [0,05 ; 0,10 ; 0,10].
 */
export function epaisseursSousCouches(epaisseurM, maxM = EPAISSEUR_SOUS_COUCHE_M) {
  if (epaisseurM <= 0 || !Number.isFinite(epaisseurM)) return [epaisseurM];
  if (maxM <= 0 || epaisseurM <= maxM + 1e-9) return [epaisseurM];
  const pleines = Math.floor(epaisseurM / maxM + 1e-9);
  const reliquat = epaisseurM - pleines * maxM;
  const res = [];
  if (reliquat > 1e-9) res.push(reliquat);          // le reliquat est en HAUT
  for (let i = 0; i < pleines; i++) res.push(maxM);
  return res;
}

const decrireProprete = (p) => ({ propre: "propre", pollue: "pollué" }[p] ?? "très pollué");
const decrireHumidite = (h) => ({ sec: "sec", humide: "humide" }[h] ?? "suintant");

/**
 * Construit le modèle de calcul inverse à partir de la structure du projet
 * (de haut en bas, la dernière couche étant le sol).
 *
 * `options` : { proprete ("propre"), humidite ("humide"), epaisseurSol (6 m),
 * plafond — grille de plafonnement : objet de plafond-gnt.js, clé
 * `plafondGnt` du profil ("cerema2016"…) ou pays ("tunisie"…) ; Cerema par
 * défaut }.
 *
 * Renvoie { couches, etapes, avertissements, indiceSol (−1 si moins de deux
 * couches) }. Chaque sous-couche granulaire porte `moduleMax` : le plafond
 * voyage avec la couche, et le rétrocalcul le respectera.
 */
export function construireModeleDiagnostic(couches, {
  proprete = "propre", humidite = "humide", epaisseurSol = EPAISSEUR_SOL_CONVENTIONNELLE_M, plafond = null,
} = {}) {
  const etapes = [], avertissements = [];
  if (couches.length < 2) {
    avertissements.push("Moins de deux couches : il n'y a pas de structure à transformer.");
    return { couches: couches.map((c) => ({ ...c })), etapes, avertissements, indiceSol: -1 };
  }

  const sourceSol = couches.length - 1;
  const construit = [];
  const estSousCoucheGranulaire = [];

  // Une couche sans famille ne peut être reconnue ni comme granulaire ni comme
  // liée : elle traverse la transformation intacte — et il faut le dire.
  const sansFamille = couches.slice(0, sourceSol).filter((c) => !c.famille).map((c) => `« ${c.nom} »`);
  if (sansFamille.length > 0)
    avertissements.push(`${sansFamille.join(", ")} : aucun matériau de la bibliothèque n'y est `
      + "associé, donc aucune famille. Ces couches traversent la transformation "
      + "telles quelles — une grave non traitée ne sera ni découpée en sous-couches "
      + "de 10 cm, ni recalculée à k = 2. Choisissez leur matériau dans la colonne "
      + "« Bibliothèque de matériaux » avant de construire le modèle.");

  // 1. Découpage des couches granulaires d'assise (le sol est traité à part).
  for (let i = 0; i < sourceSol; i++) {
    const c = couches[i];
    const granulaire = c.famille === "sol" && Number.isFinite(c.h);
    if (!granulaire) { construit.push({ ...c }); estSousCoucheGranulaire.push(false); continue; }
    const coupes = epaisseursSousCouches(c.h);
    if (coupes.length === 1) { construit.push({ ...c }); estSousCoucheGranulaire.push(true); continue; }
    coupes.forEach((h, k) => {
      construit.push({ ...c, nom: `${c.nom} ${k + 1}/${coupes.length}`, h });
      estSousCoucheGranulaire.push(true);
    });
    etapes.push(`« ${c.nom} » : ${nf(c.h * 100, 1)} cm découpés en ${coupes.length} sous-couches `
      + `de ${coupes.map((x) => nf(x * 100, 1)).join(" / ")} cm, en partant du bas.`);
  }

  // 2. Le sol : épaisseur conventionnelle au lieu du demi-espace.
  const sol = { ...couches[sourceSol] };
  const ancienne = sol.h;
  sol.h = epaisseurSol;
  construit.push(sol);
  estSousCoucheGranulaire.push(false);
  const indiceSol = construit.length - 1;
  etapes.push(!Number.isFinite(ancienne)
    ? `« ${sol.nom} » : le demi-espace devient une couche de ${nf(epaisseurSol, 1)} m.`
    : `« ${sol.nom} » : épaisseur portée à ${nf(epaisseurSol, 1)} m (valeur conventionnelle).`);

  // 3. Le massif rigide, qui ferme l'empilement.
  construit.push({
    nom: NOM_SUBSTRATUM, h: Infinity, E: MODULE_SUBSTRATUM_MPA, nu: POISSON_SUBSTRATUM,
    interface: "collee", contrainte: "fixe",
  });
  estSousCoucheGranulaire.push(false);
  etapes.push(`Massif semi-infini rigide ajouté sous le sol : E = ${milliers(MODULE_SUBSTRATUM_MPA)} MPa, `
    + `ν = ${nf(POISSON_SUBSTRATUM, 2)}. Il rend compte de la non-linéarité du sol.`);

  // 4. Modules granulaires, de BAS en HAUT : E = min(2 × E_dessous, plafond).
  const grille = grillePlafond(plafond);
  const cap = grille.max(proprete, humidite);
  let plafonne = false;
  for (let i = indiceSol - 1; i >= 0; i--) {
    if (!estSousCoucheGranulaire[i]) continue;
    const brut = RAPPORT_GRANULAIRE * construit[i + 1].E;
    if (brut > cap + 1e-9) plafonne = true;
    construit[i].E = Math.min(brut, cap);
    construit[i].moduleMax = cap;          // le plafond voyage AVEC la couche
  }

  if (estSousCoucheGranulaire.some(Boolean))
    etapes.push(`Modules granulaires posés de bas en haut : E = ${nf(RAPPORT_GRANULAIRE, 1)} × `
      + `module de la couche inférieure, plafonné à ${nf(cap, 0)} MPa `
      + `(matériau ${decrireProprete(proprete)}, ${decrireHumidite(humidite)} — ${grille.reference})`);

  if (plafonne)
    avertissements.push(`Le plafond de la grille du pays (${nf(cap, 0)} MPa) a été atteint : les sous-couches hautes `
      + "ne suivent plus la règle k = 2. C'est le comportement voulu par le guide, mais "
      + "il vaut d'être su avant de lire les modules.");

  if (!(construit[indiceSol].E > 0))
    avertissements.push("Le sol support n'a pas de module de départ : posez-le avant de lancer le calage.");

  return { couches: construit, etapes, avertissements, indiceSol };
}
