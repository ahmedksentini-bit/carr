// Conditions de mesure d'un module bitumineux, et retour aux conditions de
// dimensionnement (portage de ModulusConditions de Burmister-Calc).
//
// Un module retrouvé par calcul inverse ne vaut qu'aux conditions où la mesure
// a été faite : la température de la chaussée ce jour-là, et une fréquence de
// sollicitation qui dépend de la vitesse de l'appareil. Les catalogues donnent
// leurs modules à 15 °C et 10 Hz. Le guide Cerema/IDRRIM 2016 donne les deux
// conversions : la fréquence au § x.4.3 (diviser par 0,5 sous 10 km/h, par
// 0,75 au-dessus), la température par le tableau A7.3.
//
// Familles du tableau A7.3 : "surface" (enrobés de couche de surface : BBSG,
// BBME, BBTM…), "grave-bitume", "module-eleve" (EME).

export const REFERENCE_CONDITIONS_MODULES =
  "Guide Cerema/IDRRIM 2016, § 3.4.3 / 4.4.3 (fréquence) et annexe 7, tableau A7.3 (température)";

export const FAMILLES_BITUMINEUSES = Object.freeze(["surface", "grave-bitume", "module-eleve"]);

/** Températures tabulées du tableau A7.3 (°C). */
const TEMPERATURES = [-10, 0, 10, 15, 20, 30, 40];

/**
 * Coefficients du tableau A7.3, dans l'ordre des températures. Ils multiplient
 * le module mesuré à θ pour le ramener à 15 °C. La grave-bitume porte le
 * coefficient le plus fort à 40 °C (9,30), devant l'enrobé de surface (5,40) :
 * l'ordre n'est pas celui qu'on devinerait.
 */
const COEFFICIENTS = {
  surface: [0.36, 0.45, 0.75, 1.00, 1.50, 4.15, 5.40],
  "grave-bitume": [0.40, 0.49, 0.76, 1.00, 1.48, 3.44, 9.30],
  "module-eleve": [0.47, 0.58, 0.82, 1.00, 1.27, 2.33, 4.67],
};

export const TEMPERATURE_MIN_TABLEAU = TEMPERATURES[0];
export const TEMPERATURE_MAX_TABLEAU = TEMPERATURES[TEMPERATURES.length - 1];

/**
 * Coefficient de correction en température, interpolé linéairement entre deux
 * valeurs tabulées : { valeur, borne }. Hors table, la valeur de bord est
 * conservée et `borne` est vrai — extrapoler une thermosensibilité qui varie
 * d'un facteur neuf entre 15 et 40 °C n'aurait aucun sens.
 */
export function coefficientTemperatureDetail(famille, celsius) {
  const c = COEFFICIENTS[famille] ?? COEFFICIENTS.surface;
  const n = TEMPERATURES.length;
  const borne = celsius < TEMPERATURES[0] || celsius > TEMPERATURES[n - 1];
  if (celsius <= TEMPERATURES[0]) return { valeur: c[0], borne };
  if (celsius >= TEMPERATURES[n - 1]) return { valeur: c[n - 1], borne };
  for (let i = 1; i < n; i++) {
    if (celsius > TEMPERATURES[i]) continue;
    const t = (celsius - TEMPERATURES[i - 1]) / (TEMPERATURES[i] - TEMPERATURES[i - 1]);
    return { valeur: c[i - 1] + t * (c[i] - c[i - 1]), borne };
  }
  return { valeur: c[n - 1], borne };
}

/** Coefficient du tableau A7.3 (usage courant). */
export const coefficientTemperature = (famille, celsius) => coefficientTemperatureDetail(famille, celsius).valeur;

// ─────────────────────────────── Fréquence ────────────────────────────────

/**
 * Au-delà de ce module, une couche n'est plus un matériau de chaussée mais le
 * massif rigide de la modélisation (un béton de ciment culmine vers 35 000 MPa
 * en réalité, mais aucun modèle de diagnostic n'en porte sous le sol).
 */
export const SEUIL_SUBSTRATUM_MPA = 9000;

/** Vitesse au-delà de laquelle la fréquence estimée passe de 1 à 3 Hz (km/h). */
export const SEUIL_VITESSE_KMH = 10;

/** Fréquence de sollicitation estimée d'après la vitesse de mesure (Hz) : 1 Hz au déflectographe, 3 Hz au curviamètre. */
export const frequenceEstimeeHz = (vitesseKmh) => (vitesseKmh < SEUIL_VITESSE_KMH ? 1 : 3);

/** Diviseur du § x.4.3 pour ramener le module à 10 Hz : 0,5 sous 10 km/h, 0,75 au-dessus. */
export const diviseurFrequence = (vitesseKmh) => (vitesseKmh < SEUIL_VITESSE_KMH ? 0.5 : 0.75);

// ─────────────────────────── Les deux ensemble ────────────────────────────

/** Température de référence du tableau A7.3 : le coefficient y vaut 1. */
export const TEMPERATURE_REFERENCE_C = 15;

/**
 * Ramène un module retrouvé aux conditions de dimensionnement : 10 Hz et la
 * température `celsiusProjet` — celle du PROJET, qui n'est 15 °C qu'en France.
 * E(θ_projet) = c(θ_mesure) / c(θ_projet) × E(θ_mesure) / diviseur.
 * Sans ce paramètre, l'aller-retour multipliait le module par c(Teq) : 3,44
 * pour une grave-bitume à 28 °C.
 */
export const versConditionsProjet = (moduleTrouve, famille, celsiusMesure, vitesseKmh,
                                     celsiusProjet = TEMPERATURE_REFERENCE_C) =>
  (coefficientTemperature(famille, celsiusMesure) / coefficientTemperature(famille, celsiusProjet))
  * moduleTrouve / diviseurFrequence(vitesseKmh);

/**
 * Le chemin inverse (§ 3.4.2) : un module de catalogue exprimé à
 * `celsiusCatalogue` et 10 Hz, ramené aux conditions de la mesure. Les deux
 * conversions doivent être symétriques, ou aucune ne doit l'être.
 */
export function versConditionsMesure(moduleCatalogue, famille, celsiusCatalogue, celsiusMesure, vitesseKmh) {
  const versQuinze = coefficientTemperature(famille, celsiusCatalogue);
  const depuisQuinze = coefficientTemperature(famille, celsiusMesure);
  return moduleCatalogue * versQuinze / depuisQuinze * diviseurFrequence(vitesseKmh);
}

/**
 * Plafond de vraisemblance d'un module bitumineux ramené à 15 °C et 10 Hz. Le
 * matériau le plus raide du tableau A7.2 (EME classe 2) vaut 14 000 MPa ;
 * au-delà de 20 000, le résultat ne décrit plus un enrobé. Garde-fou, pas borne
 * de calcul.
 */
export const MODULE_INVRAISEMBLABLE_MPA = 20000;

const nfr = (x, d) => x.toLocaleString("fr-FR", { maximumFractionDigits: d, useGrouping: false });

/** Libellé de la ligne du tableau A7.3. */
export const libelleFamilleBitumineuse = (famille) =>
  (famille === "grave-bitume" ? "GB" : famille === "module-eleve" ? "EME" : "BB");

/** Explication littérale de la conversion, pour la note de calcul. */
export function expliquerConversion(moduleTrouve, famille, celsiusMesure, vitesseKmh) {
  const { valeur: ct, borne } = coefficientTemperatureDetail(famille, celsiusMesure);
  const fd = diviseurFrequence(vitesseKmh);
  return `${nfr(moduleTrouve, 0)} MPa retrouvés à ${nfr(celsiusMesure, 1)} °C et `
    + `${nfr(frequenceEstimeeHz(vitesseKmh), 0)} Hz (mesure à ${nfr(vitesseKmh, 1)} km/h)`
    + ` → ÷ ${nfr(fd, 2)} pour aller à 10 Hz, × ${nfr(ct, 3)} pour aller à 15 °C `
    + `(tab. A7.3, ligne ${libelleFamilleBitumineuse(famille)})`
    + (borne ? " — température hors table, coefficient de bord retenu" : "")
    + ` → ${nfr(versConditionsProjet(moduleTrouve, famille, celsiusMesure, vitesseKmh), 0)} MPa à 15 °C et 10 Hz.`;
}

/**
 * Range une couche dans l'une des trois lignes du tableau, d'après sa clé de
 * matériau puis son nom. L'EME est testé avant la grave-bitume : un libellé
 * libre peut porter les deux, et la famille la plus spécifique l'emporte.
 */
export function classerBitumineux(couche) {
  const texte = `${couche?.materiau ?? ""} ${couche?.nom ?? ""}`.toUpperCase();
  if (texte.includes("EME")) return "module-eleve";
  if (texte.includes("GB") || texte.includes("GRAVE-BITUME") || texte.includes("GRAVE BITUME")) return "grave-bitume";
  return "surface";
}
