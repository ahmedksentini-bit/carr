// Plafond du module d'une grave non traitée en place (portage de
// GranularCapScale de Burmister-Calc) : une grille de NEUF cases, trois états
// hydriques × trois degrés de propreté.
//
// Sans ce plafond, le rapport k = 2 appliqué en cascade fait monter les
// sous-couches hautes sans limite — trois sous-couches sur un sol à 80 MPa
// donneraient 640 MPa, ce qu'aucune grave non traitée n'atteint.
//
// Les valeurs changent d'un pays à l'autre : le fascicule 6 tunisien reprend la
// grille du Cerema mais pas ses chiffres (360 MPa au mieux au lieu de 600, 120
// au pire au lieu de 200). D'où une grille par pays, et non une constante.
//
// Vocabulaire : propreté "propre" | "pollue" | "tres-pollue" ;
//               humidité "sec" | "humide" | "suintant".

/** Rapport entre le module d'une couche granulaire et celui de la couche sous-jacente (k = 2). */
export const RAPPORT_GRANULAIRE = 2.0;

export const PROPRETES = Object.freeze(["propre", "pollue", "tres-pollue"]);
export const HUMIDITES = Object.freeze(["sec", "humide", "suintant"]);

function indice(liste, valeur, quoi) {
  const i = liste.indexOf(valeur);
  if (i < 0) throw new RangeError(`${quoi} inconnue : « ${valeur} » (attendu : ${liste.join(", ")})`);
  return i;
}

function grille(cle, mpa, reference, note = null) {
  const g = {
    cle, reference, note,
    /** Tableau [humidité][propreté] en MPa. */
    table: mpa.map((l) => Object.freeze([...l])),
    /** Plafond (MPa) à la croisée de la propreté et de l'état hydrique. */
    max: (proprete = "propre", humidite = "humide") =>
      mpa[indice(HUMIDITES, humidite, "humidité")][indice(PROPRETES, proprete, "propreté")],
    /** Module d'une couche granulaire : le double de celui du dessous, plafonné. */
    module: (dessous, proprete = "propre", humidite = "humide") =>
      Math.min(RAPPORT_GRANULAIRE * dessous, g.max(proprete, humidite)),
  };
  return Object.freeze(g);
}

/**
 * Cerema/IDRRIM 2016, tableau 20 (chaussées souples ; le tableau 30 des
 * bitumineuses épaisses porte les mêmes valeurs).
 *
 *              Propre  Pollué  Très pollué
 *   Sec          600     400       400
 *   Humide       400     400       200
 *   Suintant     400     200       200
 */
export const GRILLE_CEREMA_2016 = grille("cerema2016",
  [[600, 400, 400], [400, 400, 200], [400, 200, 200]],
  "Guide Cerema/IDRRIM 2016 « Diagnostic et conception des renforcements de chaussée », "
  + "tableau 20 (chaussées souples ; tableau 30, mêmes valeurs, pour les bitumineuses épaisses).");

/**
 * Tunisie, catalogue RevA fascicule 6, tableau 5 (page 332). Même grille,
 * chiffres propres :
 *
 *              Propre  Pollué  Très pollué
 *   Sec          360     360       360
 *   Humide       360     360       120
 *   Suintant     360     200       120
 */
export const GRILLE_TUNISIE_FASC6 = grille("tunisie-fasc6",
  [[360, 360, 360], [360, 360, 120], [360, 200, 120]],
  "Tunisie, catalogue RevA, fascicule 6 « Caractérisation et classification des chaussées "
  + "à renforcer », tableau 5 (p. 332).",
  "Le fascicule précise que ces valeurs prennent déjà en compte un k = 2 par rapport à la "
  + "portance de la plateforme. Elles sont nettement plus basses que celles du Cerema "
  + "(360 au lieu de 600 MPa au mieux, 120 au lieu de 200 au pire) : appliquer la grille "
  + "française ici surestimerait le module d'assise de moitié.");

/**
 * Grille de plafonnement désignée par la clé `plafondGnt` d'un profil pays
 * ("cerema2016", "tunisie-fasc6"…) ou par le pays lui-même ("tunisie",
 * "tunisie-1984"…). Toute clé qui désigne la Tunisie donne la grille du
 * fascicule 6 ; sinon, celle du Cerema, référence par défaut. Une grille déjà
 * construite est rendue telle quelle.
 */
export function grillePlafond(cle) {
  if (cle && typeof cle === "object" && typeof cle.max === "function") return cle;
  const s = String(cle ?? "").toLowerCase();
  return /tunis/.test(s) ? GRILLE_TUNISIE_FASC6 : GRILLE_CEREMA_2016;
}
