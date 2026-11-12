// Briques communes des justifications du module Sols.
//
// Chaque fonction de classement rend, avec sa conclusion, le chemin suivi dans l'arbre de
// décision : une suite d'étapes lisibles, dont chacune porte les comparaisons qu'elle a faites.
//
//   étape        { texte, comparaisons: [comparaison…], conclusion }
//   comparaison  { parametre, libelle, valeur, operateur, seuil, verifie }
//
// `texte` est la phrase à afficher telle quelle (« VBS = 1,2 : ≤ 1,5 → I1. ») ; `comparaisons`
// détaille les seuils confrontés, pour qu'un exerciseur puisse les reposer un à un ; `conclusion`
// dit ce que l'étape décide (une classe, un état, un cas de PST…), null quand elle ne fait
// qu'orienter. L'ordre des étapes est l'ordre de lecture de l'arbre.

import { libelleEssai } from "./identification.js";

/** Vrai pour une valeur mesurée : null, undefined, NaN ou texte valent « essai non réalisé ». */
export const mesure = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Nombre au format français, à `decimales` chiffres après la virgule au plus et sans séparateur
 * de milliers — l'équivalent des formats « 0 », « 0.# », « 0.## » de l'application.
 */
export function nombre(x, decimales = 1) {
  if (!mesure(x)) return "—";
  return x.toLocaleString("fr-FR", { maximumFractionDigits: decimales, useGrouping: false });
}

const TESTS = {
  "<": (a, b) => a < b,
  "≤": (a, b) => a <= b,
  ">": (a, b) => a > b,
  "≥": (a, b) => a >= b,
  "=": (a, b) => a === b,
  "≠": (a, b) => a !== b,
};

/** Une comparaison d'un essai (ou d'une donnée de contexte) à un seuil. */
export function comparaison(parametre, valeur, operateur, seuil) {
  const test = TESTS[operateur];
  if (!test) throw new Error(`Opérateur de comparaison inconnu : ${operateur}`);
  return {
    parametre, libelle: libelleEssai(parametre), valeur, operateur, seuil,
    verifie: valeur != null && seuil != null && test(valeur, seuil),
  };
}

/** Une étape du raisonnement. */
export const etape = (texte, comparaisons = [], conclusion = null) => ({ texte, comparaisons, conclusion });

/** Phrase courte d'une comparaison : « VBS = 1,2 ≤ 1,5 ». */
export function decrireComparaison(c, decimales = 3) {
  const v = typeof c.valeur === "number" ? nombre(c.valeur, decimales) : String(c.valeur);
  const s = typeof c.seuil === "number" ? nombre(c.seuil, decimales) : String(c.seuil);
  return `${c.libelle} = ${v} ${c.operateur} ${s}`;
}

const CONTRAIRE = { "≥": "<", ">": "≤", "≤": ">", "<": "≥" };
const RETOURNE = { ">": "<", "≥": "≤", "<": ">", "≤": "≥" };

/**
 * Encadrement lisible d'une valeur par une ou deux comparaisons sur le même paramètre :
 * « IPI = 3 ≤ 3 », « 8 < IPI = 9 ≤ 25 », « 0,9 ≤ w_n/w_OPN = 1 < 1,1 ».
 */
export function encadrement(comparaisons, decimales = 3) {
  const v = (x) => (typeof x === "number" ? nombre(x, decimales) : String(x));
  const [a, b] = comparaisons;
  if (!b) return `${a.libelle} = ${v(a.valeur)} ${a.operateur} ${v(a.seuil)}`;
  const minorant = (c) => c.operateur === ">" || c.operateur === "≥";
  const [bas, haut] = minorant(a) ? [a, b] : [b, a];
  return `${v(bas.seuil)} ${RETOURNE[bas.operateur]} ${a.libelle} = ${v(a.valeur)} ${haut.operateur} ${v(haut.seuil)}`;
}

/**
 * Lit une échelle de paliers. Avec `sens` « ≥ » (ou « > »), les seuils sont décroissants et le
 * premier palier tel que valeur ≥ seuil l'emporte ; avec « ≤ » (ou « < »), ils sont croissants et
 * le premier tel que valeur ≤ seuil l'emporte. Sans palier atteint, la lecture rend `defaut`
 * (null quand l'échelle ne conclut pas). Les comparaisons rendues établissent la conclusion :
 * le palier franchi et, s'il y en a un, le palier précédent qui ne l'a pas été.
 *
 * @param paliers [[seuil, résultat], …]
 */
export function lirePaliers(parametre, valeur, paliers, { sens = "≥", defaut = null } = {}) {
  const inclus = sens, exclus = CONTRAIRE[sens];
  for (let i = 0; i < paliers.length; i++) {
    const [seuil, resultat] = paliers[i];
    if (TESTS[inclus](valeur, seuil)) {
      const comparaisons = [];
      if (i > 0) comparaisons.push(comparaison(parametre, valeur, exclus, paliers[i - 1][0]));
      comparaisons.push(comparaison(parametre, valeur, inclus, seuil));
      return { resultat, comparaisons, palier: i };
    }
  }
  const dernier = paliers[paliers.length - 1][0];
  return { resultat: defaut, comparaisons: [comparaison(parametre, valeur, exclus, dernier)], palier: -1 };
}

/** Comparaison de chaînes insensible à la casse, comme StringComparison.OrdinalIgnoreCase. */
export const memeNom = (a, b) => a != null && b != null && String(a).toLowerCase() === String(b).toLowerCase();
