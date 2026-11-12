// Auscultation selon le manuel CEBTP 1985 (portage de DeflectionSurvey de
// Burmister-Calc) : lecture d'une série de déflexions collée depuis un
// tableur, moyenne, écart-type d'échantillon (n − 1), déflexion
// caractéristique dc = m + k·σ, puis grille « état apparent × bande de
// déflexion » du tableau 2 (p. 54) avec les seuils d1 / d2 du tableau 3
// (p. 55), propres à chaque pays.
//
// États apparents (codes de surface du tableau 2) : "bon" (1),
// "fissure-non-deforme" (2-3), "deforme-et-fissure" (4-7).
// Bandes de déflexion : "faible" (dc < d1), "intermediaire" (d1–d2), "elevee" (dc > d2).

export const K_TROPICAL = 1.3;
export const K_FRANCE = 2.0;

export const ETATS_APPARENTS = Object.freeze(["bon", "fissure-non-deforme", "deforme-et-fissure"]);
export const BANDES_DEFLEXION = Object.freeze(["faible", "intermediaire", "elevee"]);

const seuils = (pays, d1Min, d1Max, d2Min, d2Max) => Object.freeze({ pays, d1Min, d1Max, d2Min, d2Max });

/**
 * Seuils indicatifs d1 / d2 du manuel 1985, tableau 3 (p. 55), en 1/100 mm,
 * pour les chaussées en matériaux latéritiques mécaniquement stabilisés.
 */
export const SEUILS_DEFLEXION_PAYS = Object.freeze([
  seuils("Niger", 40, 40, 60, 60),
  seuils("Mali", 60, 70, 80, 100),
  seuils("Côte d'Ivoire", 50, 75, 100, 150),
  seuils("Cameroun", 50, 60, 80, 80),
  seuils("Gabon", 80, 80, 100, 100),
]);

/** Clé de comparaison d'un nom de pays : sans accents, sans casse, sans ponctuation. */
const cle = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Seuils d'un pays, par son nom (« Niger », « Côte d'Ivoire »… ; l'identifiant
 * « cote-divoire » convient aussi). À défaut, ceux de la Côte d'Ivoire.
 */
export const seuilsDeflexionPour = (pays) =>
  SEUILS_DEFLEXION_PAYS.find((t) => cle(t.pays) === cle(pays)) ?? SEUILS_DEFLEXION_PAYS[2];

/** Lecture d'un nombre : une virgule seule (sans point) est décimale. */
function lireNombre(jeton) {
  let t = jeton.trim();
  if (t.length === 0) return null;
  const virgules = (t.match(/,/g) ?? []).length, points = (t.match(/\./g) ?? []).length;
  if (virgules === 1 && points === 0) t = t.replace(",", ".");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return null;
  return parseFloat(t);
}

/**
 * Série de déflexions collée (colonne de tableur, décimales françaises) :
 * séparateurs blancs, « ; », « | » ou « / ». Un jeton illisible qui contient
 * des virgules est relu comme une liste séparée par des virgules.
 */
export function lireDeflexions(texte) {
  if (texte == null || String(texte).trim() === "") return [];
  const res = [];
  for (const jeton of String(texte).trim().split(/[\s;|/]+/)) {
    if (!jeton.trim()) continue;
    const v = lireNombre(jeton);
    if (v !== null) { res.push(v); continue; }
    if (!jeton.includes(",")) continue;
    for (const partie of jeton.split(",")) {
      const w = lireNombre(partie);
      if (w !== null) res.push(w);
    }
  }
  return res;
}

/**
 * Statistique d'une série (1/100 mm) : { valeurs, nombre, moyenne, ecartType
 * (échantillon, n − 1), dc = m + k·σ, k }, ou null pour une série vide.
 */
export function statistiquesDeflexion(valeurs, k) {
  if (valeurs.length === 0) return null;
  const moyenne = valeurs.reduce((s, x) => s + x, 0) / valeurs.length;
  let ecartType = 0;
  if (valeurs.length >= 2) {
    const ss = valeurs.reduce((s, x) => s + (x - moyenne) * (x - moyenne), 0);
    ecartType = Math.sqrt(ss / (valeurs.length - 1));
  }
  return { valeurs: [...valeurs], nombre: valeurs.length, moyenne, ecartType, dc: moyenne + k * ecartType, k };
}

/**
 * Bande de la déflexion caractéristique : { bande, ambigu }. Quand dc tombe
 * dans une plage publiée (d1 ou d2 donnés en intervalle), la bande est
 * tranchée du côté défavorable et `ambigu` le signale.
 */
export function bandeDeflexion(dc, s) {
  if (dc < s.d1Min) return { bande: "faible", ambigu: false };
  if (dc > s.d2Max) return { bande: "elevee", ambigu: false };
  if (dc >= s.d1Max && dc <= s.d2Min) return { bande: "intermediaire", ambigu: false };
  const dansD1 = s.d1Min !== s.d1Max && dc >= s.d1Min && dc < s.d1Max;
  return dansD1 ? { bande: "intermediaire", ambigu: true } : { bande: "elevee", ambigu: true };
}

export function libelleEtatApparent(etat) {
  if (etat === "fissure-non-deforme") return "fissuré non déformé (2-3)";
  if (etat === "deforme-et-fissure") return "déformé et fissuré (4-7)";
  return "bon (1)";
}

const GRILLE = {
  bon: { faible: "Q1", intermediaire: "Q2", elevee: "Q3" },
  "fissure-non-deforme": { faible: "Q2", intermediaire: "Q3", elevee: "Q4" },
  "deforme-et-fissure": { faible: "Q3", intermediaire: "Q4", elevee: "Q5" },
};

const fmt = (v) => v.toLocaleString("en-US", { maximumFractionDigits: 1, useGrouping: false });
const plage = (a, b) => (Math.abs(a - b) < 1e-9 ? fmt(a) : `${fmt(a)}–${fmt(b)}`);

/**
 * Classe de qualité Q1 … Q5 de la grille du tableau 2 : { classeQualite,
 * bande, seuilAmbigu, celluleGrisee (classement imprécis du guide, sondages
 * recommandés), note }.
 */
export function classerQualite(dc, etat, s) {
  const { bande, ambigu } = bandeDeflexion(dc, s);
  const q = GRILLE[etat]?.[bande] ?? "Q5";
  const grisee = (etat === "bon" && bande === "elevee")
    || (etat === "fissure-non-deforme" && bande === "intermediaire")
    || (etat === "deforme-et-fissure" && bande === "faible");
  const libelleBande = bande === "faible" ? `faible (dc < ${fmt(s.d1Min)})`
    : bande === "elevee" ? `élevée (dc > ${fmt(s.d2Max)})` : "intermédiaire (d1–d2)";
  let note = `CEBTP 1985 tab. 2 : ${libelleEtatApparent(etat)} × ${libelleBande} → ${q} `
    + `(${s.pays}, d1=${plage(s.d1Min, s.d1Max)}, d2=${plage(s.d2Min, s.d2Max)} 1/100 mm).`;
  if (ambigu) note += " dc dans une plage publiée (d1 ou d2 en intervalle) : bande tranchée du côté défavorable.";
  if (grisee) note += " Cellule grisée du guide : classement imprécis, sondages recommandés.";
  return { classeQualite: q, bande, seuilAmbigu: ambigu, celluleGrisee: grisee, note };
}
