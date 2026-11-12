// Valeurs caractéristiques d'une campagne de mesures et classes de déflexion
// et de rayon de courbure (portage de DeflectionScales de Burmister-Calc) :
// Cerema 2016 (tableaux 7 et 8), fascicule 6 tunisien (tableaux 6, 7 et 8).
//
// Les guides ne s'accordent pas sur la façon de résumer une campagne : un
// seuil à 97,5 % et une moyenne majorée de deux écarts-types ne désignent pas
// le même point de la distribution. Le module dit donc laquelle il applique,
// et ne compare jamais un chiffre issu d'une règle aux seuils d'une autre.
//
// Règles : "centile-97,5" (déflexion caractéristique du Cerema, § 2.6.2),
// "deuxieme-decile" (rayon caractéristique du Cerema, § 2.7.2), "mediane"
// (rayon médian, ajustement des modules bitumineux, § 3.4.3), "moyenne-k-sigma"
// (déflexion caractéristique du CEBTP 1985 et de la Tunisie).
// Niveaux de comportement : "bon" | "moyen" | "mauvais".

export const REGLES_CARACTERISTIQUES = Object.freeze(["centile-97,5", "deuxieme-decile", "mediane", "moyenne-k-sigma"]);
export const NIVEAUX = Object.freeze(["bon", "moyen", "mauvais"]);

/** Une classe : un nom et l'intervalle [min, max[ qui la définit (max = Infinity pour la dernière). */
export function bande(nom, min, max) {
  return Object.freeze({
    nom, min, max,
    contient: (v) => v >= min && (max === Infinity ? true : v < max),
    plage: max === Infinity ? `≥ ${fmt(min)}` : min <= 0 ? `< ${fmt(max)}` : `${fmt(min)} à ${fmt(max)}`,
  });
}

const fmt = (x) => x.toLocaleString("fr-FR", { maximumFractionDigits: 1, useGrouping: false });

// ───────────────────────── Valeurs caractéristiques ───────────────────────

/** Interpolation linéaire entre les valeurs encadrantes, série déjà triée. */
function centile(trie, p) {
  if (trie.length === 1) return trie[0];
  const rang = p * (trie.length - 1);
  const bas = Math.floor(rang), haut = Math.ceil(rang);
  return bas === haut ? trie[bas] : trie[bas] + (rang - bas) * (trie[haut] - trie[bas]);
}

export const moyenne = (v) => v.reduce((s, x) => s + x, 0) / v.length;

/** Écart-type d'échantillon (n − 1), celui qu'utilisent les guides. */
export function ecartType(v) {
  if (v.length < 2) return 0;
  const m = moyenne(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / (v.length - 1));
}

/**
 * Valeur caractéristique d'une série. `k` n'est lu que pour la règle
 * « moyenne + k·σ » (CEBTP : k = 2 pour environ 2,5 % de dépassement, k = 1,3
 * pour 10 %). NaN pour une série vide.
 */
export function valeurCaracteristique(valeurs, regle, k = 2.0) {
  const propres = valeurs.filter(Number.isFinite).sort((a, b) => a - b);
  if (propres.length === 0) return NaN;
  switch (regle) {
    case "centile-97,5": return centile(propres, 0.975);
    case "deuxieme-decile": return centile(propres, 0.20);
    case "mediane": return centile(propres, 0.50);
    case "moyenne-k-sigma": return moyenne(propres) + k * ecartType(propres);
    default: return NaN;
  }
}

export function decrireRegle(regle, k = 2.0) {
  if (regle === "centile-97,5") return "seuil à 97,5 % des déflexions maximales";
  if (regle === "deuxieme-decile") return "2ᵉ décile, soit le seuil à 20 % des rayons";
  if (regle === "mediane") return "valeur médiane";
  return `moyenne majorée de ${fmt(k)} écart(s)-type(s)`;
}

// ─────────────────────────── Cerema, tableaux 7 et 8 ──────────────────────

export const REFERENCE_CLASSES_CEREMA = "Cerema/IDRRIM 2016, tableaux 7 et 8 (p. 45 et 47)";

/** Déflexion caractéristique corrigée à 15 °C, en 1/100 mm. */
export const CLASSES_DEFLEXION_CEREMA = Object.freeze([
  bande("D1", 0, 20), bande("D2", 20, 30), bande("D3", 30, 45), bande("D4", 45, 75),
  bande("D5", 75, 100), bande("D6", 100, 150), bande("D7", 150, 200), bande("D8", 200, 300),
  bande("D9", 300, Infinity),
]);

/**
 * Rayon caractéristique à 20 %, en mètres. Un PETIT rayon est un mauvais signe,
 * alors qu'une petite déflexion est un bon signe : les deux échelles vont en
 * sens inverse.
 */
export const CLASSES_RAYON_CEREMA = Object.freeze([
  bande("R1", 0, 200), bande("R2", 200, 400), bande("R3", 400, 800),
  bande("R4", 800, 1200), bande("R5", 1200, 1600), bande("R6", 1600, Infinity),
]);

export const classerDeflexionCerema = (dcar) => CLASSES_DEFLEXION_CEREMA.find((b) => b.contient(dcar)) ?? null;
export const classerRayonCerema = (rcar) => CLASSES_RAYON_CEREMA.find((b) => b.contient(rcar)) ?? null;

/**
 * Lecture en clair d'une classe de déflexion : bon (D1-D3), moyen (D4-D5),
 * mauvais (D6-D9). Le regroupement en trois mots N'EST PAS du guide : il ne
 * sert qu'à la comparaison avant / après d'un même tronçon.
 */
export function niveauDeflexionCerema(nom) {
  if (["D1", "D2", "D3"].includes(nom)) return "bon";
  if (["D4", "D5"].includes(nom)) return "moyen";
  if (["D6", "D7", "D8", "D9"].includes(nom)) return "mauvais";
  return null;
}

/** Lecture en clair d'une classe de rayon (échelle inverse : un petit rayon est un mauvais signe). */
export function niveauRayonCerema(nom) {
  if (["R5", "R6"].includes(nom)) return "bon";
  if (["R3", "R4"].includes(nom)) return "moyen";
  if (["R1", "R2"].includes(nom)) return "mauvais";
  return null;
}

/** Le mot d'un niveau, ou un tiret quand la valeur sort des tableaux. */
export const motNiveau = (niveau) => ({ bon: "bon", moyen: "moyen", mauvais: "médiocre" }[niveau] ?? "—");

export const RESERVE_LECTURE_CEREMA =
  "Les classes D1 à D9 et R1 à R6 sont celles des tableaux 7 et 8 du guide Cerema. Leur "
  + "regroupement en « bon / moyen / médiocre » est une commodité de lecture du logiciel, "
  + "destinée à la comparaison avant / après d'un même tronçon : le guide ne qualifie pas "
  + "une déflexion dans l'absolu, celle-ci ne prenant son sens qu'au regard de la structure "
  + "et du trafic supporté.";

// ────────────────────────── Tunisie, tableaux 6 à 8 ───────────────────────

export const REFERENCE_CLASSES_TUNISIE =
  "Catalogue Tunisie RevA, fascicule 6, tableaux 6, 7 et 8 (p. imprimées 339)";

/** Chaussées souples — déflexion caractéristique à 28 °C, en 1/100 mm. */
export const CLASSES_TUNISIE_SOUPLES = Object.freeze([
  bande("D1", 0, 35), bande("D2", 35, 55), bande("D3", 55, 85), bande("D4", 85, 110),
  bande("D5", 110, 170), bande("D6", 170, 220), bande("D7", 220, Infinity),
]);

/** Chaussées bitumineuses — déflexion caractéristique à 28 °C, en 1/100 mm. */
export const CLASSES_TUNISIE_BITUMINEUSES = Object.freeze([
  bande("D1", 0, 35), bande("D2", 35, 55), bande("D3", 55, 85), bande("D4", 85, 110),
  bande("D5", 110, 170), bande("D6", 170, Infinity),
]);

/** Longueur des sections de regroupement en Tunisie : 100 m, et non les 200 m du Cerema. */
export const LONGUEUR_SECTION_TUNISIE_M = 100;

/** Déflexion caractéristique tunisienne : dc = dm + k·σ (règle du CEBTP)… */
export const REGLE_TUNISIE = "moyenne-k-sigma";
/** … avec k = 1,3, soit 10 % de dépassement. */
export const K_TUNISIE = 1.3;

/**
 * Facteur de passage de 15 °C à 28 °C donné par le fascicule : 1,17 pour les
 * chaussées bitumineuses, 1,13 pour les souples (c = 1 + K (28 − 15)/15).
 */
export const facteurTranspositionTunisie = (bitumineuse) => (bitumineuse ? 1.173 : 1.13);

/** Classes de trafic cumulé du catalogue (tableau 6), en millions de poids lourds. */
export const CLASSES_TRAFIC_TUNISIE = Object.freeze([
  bande("T1", 0, 0.1), bande("T2", 0.1, 0.3), bande("T3", 0.3, 1), bande("T4", 1, 3),
  bande("T5", 3, 10), bande("T6", 10, 30), bande("T7", 30, 50), bande("T8", 50, 100),
]);

export const classerTraficTunisie = (nplMillions) => CLASSES_TRAFIC_TUNISIE.find((b) => b.contient(nplMillions)) ?? null;

// Tableau 7 — souples : une seule bande de trafic, T1-T2 (moins de 300 000 PL).
const SOUPLES_T1T2 = ["bon", "bon", "bon", "bon", "bon", "moyen", "mauvais"];
// Tableau 8 — bitumineuses : trois bandes de trafic.
const BITUMINEUSES_T1T3 = ["bon", "bon", "bon", "bon", "moyen", "mauvais"];
const BITUMINEUSES_T4T5 = ["bon", "bon", "moyen", "moyen", "mauvais", "mauvais"];
const BITUMINEUSES_T6T8 = ["bon", "bon", "moyen", "mauvais", "mauvais", "mauvais"];

/**
 * Niveau global de comportement d'après la déflexion caractéristique (1/100 mm
 * à 28 °C) et le trafic cumulé (millions de PL). Null quand le croisement sort
 * des tableaux — pour une chaussée souple sous plus de 300 000 PL, le catalogue
 * ne se prononce pas, et c'est une information en soi.
 */
export function niveauTunisie(dcar, nplMillions, bitumineuse) {
  const bandes = bitumineuse ? CLASSES_TUNISIE_BITUMINEUSES : CLASSES_TUNISIE_SOUPLES;
  const i = bandes.findIndex((b) => b.contient(dcar));
  if (i < 0) return null;
  if (!bitumineuse) return nplMillions < 0.3 ? SOUPLES_T1T2[i] : null;
  if (nplMillions < 1) return BITUMINEUSES_T1T3[i];
  if (nplMillions < 10) return BITUMINEUSES_T4T5[i];
  if (nplMillions <= 100) return BITUMINEUSES_T6T8[i];
  return null;
}

export const classerDeflexionTunisie = (dcar, bitumineuse) =>
  (bitumineuse ? CLASSES_TUNISIE_BITUMINEUSES : CLASSES_TUNISIE_SOUPLES).find((b) => b.contient(dcar)) ?? null;
