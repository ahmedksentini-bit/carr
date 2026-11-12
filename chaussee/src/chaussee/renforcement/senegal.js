// Le guide de renforcement des chaussées au Sénégal (portage de
// SenegalReinforcement de Burmister-Calc ; AGEROUTE, GRS 2023) : modèles SCT1
// à SCT3, risque du modèle SCT3, épaisseurs minimales de couche de roulement et
// épaisseurs de mise en œuvre des matériaux d'apport.
//
// Toutes les valeurs ont été relues SUR IMAGE : la couche texte du PDF est
// corrompue. Les modules de départ du modèle SCT1 sont dans senegal-modules.js.
//
// Modèles : "sct1" (chaussée actuelle, modules rétrocalculés), "sct2"
// (chaussée à la mise en service, modules neufs), "sct3" (chaussée renforcée).
// Assise : "bitumineuse" (tab. 23) | "hydraulique" (tab. 24) | "non-liee"
// (tab. 25) | "laterite-ciment" (grave latéritique améliorée au ciment, tab. 26).

export const REFERENCE_SENEGAL =
  "AGEROUTE, Guide de renforcement des chaussées au Sénégal, rapport final provisoire "
  + "du 15 décembre 2023, ch. 6 (tableaux 18, 23 à 26 et § 6.1.6)";

export const RESERVE_SOURCE_SENEGAL =
  "Valeurs relevées sur les pages rendues en image : la couche texte du PDF du guide est "
  + "corrompue et ne peut pas servir de source.";

export const MODELES_SCT = Object.freeze(["sct1", "sct2", "sct3"]);
export const ASSISES_SENEGAL = Object.freeze(["bitumineuse", "hydraulique", "non-liee", "laterite-ciment"]);

export function decrireModeleSct(modele) {
  if (modele === "sct1") return "SCT1 — chaussée actuelle, modules rétrocalculés sur le bassin de déflexion.";
  if (modele === "sct2") return "SCT2 — chaussée à la mise en service, modules neufs : sert à calculer le "
    + "dommage déjà consommé et le trafic admissible restant.";
  return "SCT3 — chaussée renforcée : structure existante aux modules adaptés, plus les "
    + "matériaux d'apport. C'est le modèle que l'on dimensionne.";
}

export const NOTE_SCT3 =
  "Tout le chapitre 6 du guide raisonne sur le modèle SCT3 : c'est le modèle de la chaussée "
  + "future, après renforcement.";

/**
 * Risque de calcul du modèle SCT3 (tableau 18), en % : 25 sous 3 millions
 * d'essieux équivalents, 5 de 3 à 100 millions ; null au-delà.
 */
export function risqueSct3(neFutur) {
  if (neFutur < 3e6) return 25;
  if (neFutur < 100e6) return 5;
  return null;
}

export const NOTE_RISQUE_SENEGAL =
  "Le risque est fixé par le maître d'ouvrage : sa valeur reflète l'exigence de niveau de "
  + "service assignée à l'itinéraire. Les valeurs du tableau 18 sont celles du catalogue de "
  + "chaussées neuves, et peuvent être adaptées au contexte.";

const minimum = (epaisseurCm, base, reserve = null) => ({ epaisseurCm, base, reserve });

/**
 * Épaisseur minimale de la couche de roulement selon la nature de l'assise et
 * le trafic futur en millions d'essieux équivalents (tableaux 23 à 26) :
 * { epaisseurCm, base, reserve } ou null hors des tableaux.
 */
export function epaisseurMinimaleRoulement(assise, neFuturMillions) {
  const ne = neFuturMillions;
  if (assise === "bitumineuse") {
    const b = "Tableau 23, assise en matériaux bitumineux";
    if (ne < 3) return minimum(6, b);
    if (ne < 10) return minimum(7, b);
    // La troisième colonne du tableau 23 est imprimée « > 30 », là où le
    // tableau 24 porte « [10-30[ » : très probablement une coquille du guide.
    return minimum(8, b,
      "La troisième colonne du tableau 23 est imprimée « > 30 » alors que le tableau 24, "
      + "identique par ailleurs, porte « [10-30[ ». La tranche de 10 à 30 millions n'est "
      + "donc couverte par aucune colonne du tableau 23 : très probablement une coquille "
      + "du guide. La valeur de 8 cm est retenue par analogie avec le tableau 24 ; il "
      + "appartient au projeteur de trancher.");
  }
  if (assise === "hydraulique") {
    const b = "Tableau 24, assise traitée aux liants hydrauliques";
    if (ne < 3) return minimum(6, b);
    if (ne < 10) return minimum(7, b);
    if (ne < 30) return minimum(8, b);
    return null;
  }
  if (assise === "non-liee") {
    const b = "Tableau 25, chaussée souple non traitée";
    if (ne < 0.2) return minimum(5.0, b);
    if (ne < 0.4) return minimum(5.5, b);
    if (ne < 0.6) return minimum(6.0, b);
    if (ne < 0.8) return minimum(7.0, b);
    if (ne < 1.0) return minimum(8.0, b);
    return null;
  }
  const b = "Tableau 26, base en grave latéritique améliorée au ciment";
  if (ne < 3) return minimum(6, b);
  if (ne < 3.5) return minimum(7, b);
  if (ne < 4) return minimum(8, b);
  return null;
}

export const HORS_TABLEAUX_SENEGAL =
  "Pour des trafics plus importants que ceux couverts par les tableaux, le guide conseille "
  + "de mettre en œuvre des structures de chaussées à assise en matériaux traités, plutôt "
  + "que d'épaissir une couche de surface sur une assise non liée.";

/** Couche de base non liée (latérite, litho-stabilisée, GNT…) : 15 cm si NE ≤ 100 000, 20 cm au-delà. */
export const epaisseurBaseNonLieeCm = (neFutur) => (neFutur <= 100000 ? 15 : 20);

/** Épaisseurs de mise en œuvre en une seule application : { minCm, maxCm } ou null. */
export function plageMiseEnOeuvre(familleMateriau) {
  switch (familleMateriau) {
    case "GLa": case "grave latéritique améliorée au ciment": return { minCm: 20, maxCm: 30 };
    case "GB": case "EME": case "enrobé": return { minCm: 7, maxCm: 14 };
    case "MTLH": case "traité aux liants hydrauliques": return { minCm: 18, maxCm: 30 };
    default: return null;
  }
}

/** Sous-couches de la fondation non liée : de 1 à 25 cm (contrainte de mise en œuvre). */
export const SOUS_COUCHE_FONDATION_MIN_CM = 1;
export const SOUS_COUCHE_FONDATION_MAX_CM = 25;

export const DISTINCTION_SOUS_COUCHES =
  "Le sous-couchage à 25 cm du guide sénégalais est une contrainte de mise en œuvre de la "
  + "couche de fondation ; le découpage à 10 cm du Cerema est un artifice de modélisation "
  + "des graves non traitées. Les deux coexistent sans se contredire.";
