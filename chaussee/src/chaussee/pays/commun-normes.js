// Normes et raccourcis d'écriture des fiches matériaux pour les profils
// Sénégal, Côte d'Ivoire et pays tropicaux. Les normes françaises de repli
// (portage de FrenchMaterialStandards) viennent de normes-francaises.js ; ce
// module n'ajoute que les raccourcis Of / Sec / R (portage de Sheets.Of / Sec / R).

import { fiche, section, ligne } from "./base.js";

export { normeFr as N, libelleNorme, normesFrancaises, fusionnerNormes } from "./normes-francaises.js";

/**
 * Fiche dans l'ordre d'écriture de la source : code, nom, famille, source,
 * emploi, normes, puis éventuellement le tableau des clés couvertes, puis les
 * sections.
 */
export function Of(code, nom, famille, source, emploi, normes, ...reste) {
  const cles = Array.isArray(reste[0]) ? reste.shift() : null;
  return fiche(code, nom, famille, source, emploi, normes, reste, cles);
}

/** Section : titre, puis éventuellement un texte d'introduction, puis les lignes. */
export function Sec(titre, ...reste) {
  return typeof reste[0] === "string" ? section(titre, reste.slice(1), reste[0]) : section(titre, reste);
}

/** Ligne : libellé, valeur, norme, note. */
export const R = (libelle, valeur, normeLigne = null, note = null) => ligne(libelle, valeur, normeLigne, note);
