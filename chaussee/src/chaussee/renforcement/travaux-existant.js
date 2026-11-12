// Ce que la solution retenue fait de la chaussée en place, AVANT qu'on y pose
// l'apport (portage d'ExistingPavementWork de Burmister-Calc) : décaissement
// et retraitement appliqués à l'empilement.
//
// Décaissement partiel et total sont la même opération géométrique, à des
// profondeurs différentes : on enlève par le haut jusqu'à une cote. Ce qui les
// sépare est doctrinal — le partiel vise les décollements des quinze premiers
// centimètres, le total descend jusqu'à l'assise inférieure ou le sol. La
// profondeur est donc demandée dans les deux cas.
//
// La dernière couche (ou toute couche d'épaisseur non finie) est le sol
// support : on n'y touche jamais.

import { nf } from "./format.js";
import { nomSolution } from "./strategie.js";

/** Épaisseur minimale laissée en place au-dessus du sol (m). */
export const EPAISSEUR_MINIMALE_RESTANTE_M = 0.05;

const estSupport = (couches, i) => i === couches.length - 1 || !Number.isFinite(couches[i].h);

/** Vrai pour les solutions qui enlèvent de la matière, et qui exigent donc une cote. */
export const besoinProfondeur = (solution) =>
  solution === "decaissement-partiel" || solution === "decaissement-total" || solution === "retraitement";

/**
 * Ce qu'on peut enlever, en cm : tout ce qui est au-dessus du sol support,
 * moins une garde de 5 cm. S'il ne reste rien de l'ancienne chaussée, ce n'est
 * plus un renforcement mais une chaussée neuve.
 */
export function epaisseurEnlevableCm(couches) {
  let total = 0;
  for (let i = 0; i < couches.length; i++) {
    if (estSupport(couches, i)) break;
    total += couches[i].h;
  }
  return Math.max(0, (total - EPAISSEUR_MINIMALE_RESTANTE_M) * 100);
}

/** Enlève une épaisseur par le haut ; une couche coupée en son milieu garde son reste (fraisage). */
function enleverParLeHaut(couches, profondeurCm) {
  let reste = profondeurCm / 100;
  let enleve = 0;
  while (couches.length > 0 && reste > 1e-9) {
    const haut = couches[0];
    if (estSupport(couches, 0)) break;
    if (haut.h <= reste + 1e-9) {
      enleve += haut.h;
      reste -= haut.h;
      couches.shift();
    } else {
      haut.h -= reste;
      enleve += reste;
      reste = 0;
    }
  }
  return enleve * 100;
}

function resteEnPlace(couches) {
  const gardees = couches.filter((c, i) => !estSupport(couches, i)).map((c) => `${c.nom} ${nf(c.h * 100, 1)} cm`);
  return gardees.length === 0
    ? "Il ne reste que le sol support sous l'apport."
    : "Reste en place : " + gardees.join(" · ") + ", puis le sol support.";
}

/**
 * Applique la solution à l'empilement en place (calé par le rétrocalcul, sol
 * en fin). `profondeurCm` : profondeur de décaissement ou de retraitement.
 * `retraitee` : couche reconstituée par le retraitement (module, ν, loi de
 * fatigue), son épaisseur étant imposée par la profondeur.
 *
 * Renvoie { couches (ce qui subsiste, de haut en bas, sol compris),
 * nombreCouchesNeuves (couches neuves en tête : 1 pour un retraitement, dont
 * la couche reconstituée se vérifie au trafic brut), enleveCm, etapes,
 * avertissements }.
 */
export function appliquerTravaux(couches, solution, profondeurCm = 0, retraitee = null) {
  const etapes = [], avertissements = [];
  const gardees = couches.map((c) => ({ ...c }));
  const resultat = (cs, neuves, enleve) => ({ couches: cs, nombreCouchesNeuves: neuves, enleveCm: enleve, etapes, avertissements });

  if (!besoinProfondeur(solution)) {
    etapes.push(solution === "renouvellement-surface"
      ? "Renouvellement de surface : la chaussée en place est conservée entière."
      : "Rechargement : la chaussée en place est conservée entière, l'apport se pose dessus.");
    return resultat(gardees, 0, 0);
  }

  if (!(profondeurCm > 0)) {
    avertissements.push(`${nomSolution(solution)} : aucune profondeur n'est saisie. `
      + "La chaussée est traitée comme si rien n'était enlevé — le calcul revient "
      + "à un simple rechargement, ce qui n'est pas la solution retenue.");
    return resultat(gardees, 0, 0);
  }

  const enlevable = epaisseurEnlevableCm(couches);
  let profondeur = profondeurCm;
  if (profondeur > enlevable) {
    avertissements.push(`Profondeur demandée ${nf(profondeurCm, 1)} cm, mais la chaussée en place n'offre `
      + `que ${nf(enlevable, 1)} cm au-dessus du sol support (moins la garde de `
      + `${nf(EPAISSEUR_MINIMALE_RESTANTE_M * 100, 1)} cm). Le décaissement est ramené à cette valeur.`);
    profondeur = enlevable;
  }

  const enleve = enleverParLeHaut(gardees, profondeur);

  // Rien à enlever : ni prétendre avoir décaissé, ni insérer une couche
  // retraitée d'épaisseur nulle — un modèle avec une couche de 0 cm est faux.
  if (enleve <= 1e-9) {
    avertissements.push(`${nomSolution(solution)} : la chaussée en place n'offre rien `
      + "à enlever au-dessus du sol support. Décrivez la chaussée existante dans "
      + "l'onglet Structure — sans elle, la solution retenue ne peut pas s'appliquer, "
      + "et le calcul revient à un rechargement sur le sol nu.");
    return resultat(gardees, 0, 0);
  }

  if (solution === "retraitement") {
    if (!retraitee) {
      avertissements.push("Retraitement en place : aucun matériau retraité n'est décrit. "
        + "La profondeur est enlevée sans être reconstituée — décrivez le "
        + "matériau, sans quoi le calcul porte sur une chaussée amputée.");
      etapes.push(`Retraitement sur ${nf(enleve, 1)} cm — couche reconstituée manquante.`);
      return resultat(gardees, 0, enleve);
    }
    const couche = { ...retraitee, h: enleve / 100 };
    gardees.unshift(couche);
    etapes.push(`Retraitement en place sur ${nf(enleve, 1)} cm : les couches supérieures sont `
      + `reconstituées en une couche de « ${couche.nom} » à ${nf(couche.E, 0)} MPa. Elle est `
      + "NEUVE — elle n'a pas de dommage passé, et se vérifie au trafic futur brut.");
    return resultat(gardees, 1, enleve);
  }

  etapes.push(`${nomSolution(solution)} sur ${nf(enleve, 1)} cm : les couches `
    + "supérieures sont enlevées avant l'apport. Ce qui reste garde son dommage et se "
    + "vérifie au trafic majoré.");
  etapes.push(resteEnPlace(gardees));
  return resultat(gardees, 0, enleve);
}
