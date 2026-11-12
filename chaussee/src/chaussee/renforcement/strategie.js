// Choix de la solution de renforcement, et façon de conduire le calcul
// (portage de ReinforcementStrategy de Burmister-Calc ; Cerema 2016, ch. 4 § 3
// et § 3.1.4 ; guide sénégalais GRS 2023, ch. 6).
//
// Le guide pose d'abord une question binaire : toutes les couches en place
// ont-elles encore du capital ? Si oui, on le valorise par Miner. Si une seule
// est à la ruine, le renforcement se calcule comme une chaussée neuve posée sur
// ce qui reste.
//
// Solutions : "renouvellement-surface" | "rechargement" | "decaissement-partiel"
// | "decaissement-total" | "retraitement". Bases de calcul : "dommage-residuel"
// | "chaussee-neuve". Voies du dommage : voir dommage.js.

import { nf } from "./format.js";

export const REFERENCE_STRATEGIE = "Cerema/IDRRIM 2016, ch. 4 § 3 et § 3.1.4 ; guide sénégalais GRS 2023, ch. 6";

export const SOLUTIONS_RENFORCEMENT = Object.freeze([
  "renouvellement-surface", "rechargement", "decaissement-partiel", "decaissement-total", "retraitement",
]);
export const BASES_CALCUL = Object.freeze(["dommage-residuel", "chaussee-neuve"]);

/**
 * Base de calcul d'après les dommages des couches en place : une seule couche
 * à 1 (ou plus) fait basculer tout le dimensionnement. Un dommage non
 * calculable (NaN) ne déclenche rien.
 */
export const baseDeCalcul = (dommages) =>
  (dommages.some((d) => Number.isFinite(d) && d >= 1) ? "chaussee-neuve" : "dommage-residuel");

/**
 * Ce que veut dire la base. Avec `voie` ("miner" | "forfait" | "residuel"), la
 * phrase dit SUR QUOI elle porte : le module n'examine qu'un dommage à la
 * fois, et « toutes les couches » promettrait plus que le calcul.
 */
export function expliquerBase(base, voie) {
  if (voie === undefined) {
    return base === "dommage-residuel"
      ? "Toutes les couches en place ont un dommage inférieur à 1 : le renforcement valorise "
        + "leur capital résiduel, et se calcule selon la loi de cumul de Miner."
      : "Au moins une couche en place a atteint un dommage de 1 : le renforcement se calcule "
        + "comme une chaussée neuve, reposant sur tout ou partie de l'ancienne chaussée.";
  }
  const examine = voie === "miner" ? "La couche décrite dans l'historique"
    : voie === "residuel" ? "La structure en place, prise dans son ensemble"
    : "L'appréciation globale de la chaussée";
  const reserve = voie === "miner"
    ? " Reprenez ce calcul pour chaque couche conservée : une seule à la ruine fait "
      + "basculer tout le dimensionnement."
    : "";
  return base === "dommage-residuel"
    ? `${examine} donne un dommage inférieur à 1 : le renforcement valorise le capital `
      + "résiduel, et se calcule selon la loi de cumul de Miner." + reserve
    : `${examine} donne un dommage de 1 : le renforcement se calcule comme une chaussée `
      + "neuve, reposant sur tout ou partie de l'ancienne chaussée." + reserve;
}

/**
 * Trafic à retenir pour dimensionner une couche CONSERVÉE : NE futur / (1 − D₀).
 * Infini si la couche est déjà à la ruine.
 */
export function traficEquivalent(neFutur, dommageConsomme) {
  const disponible = 1 - dommageConsomme;
  return disponible > 0 ? neFutur / disponible : Infinity;
}

/**
 * Le « nota » du guide : une couche conservée dont le dommage est inférieur à
 * 1 aujourd'hui doit l'être encore à la fin de la durée de calcul.
 */
export const seraEpuiseeDurantLaVie = (dommageConsomme, neFutur, neDureeDeVie) =>
  neDureeDeVie > 0 && Number.isFinite(dommageConsomme) && dommageConsomme + neFutur / neDureeDeVie >= 1;

export const REGLE_EPUISEMENT =
  "Une couche conservée dont le dommage est aujourd'hui inférieur à 1 doit l'être encore à "
  + "la fin de la durée de calcul du renforcement. Dans le cas contraire, son module doit "
  + "être ramené à sa valeur endommagée conventionnelle à partir du moment où son dommage "
  + "atteint 1 — le calcul se conduit alors en deux périodes.";

/** Ce que le guide dit de chaque configuration : { solution, nom, quandChoisir, reserve }. */
export const CONSEILS_SOLUTIONS = Object.freeze([
  { solution: "renouvellement-surface", nom: "Renouvellement de surface",
    quandChoisir: "La chaussée n'a pas de besoin structurel : la capacité restante couvre le trafic futur. "
      + "On refait la couche de roulement pour rendre l'usage et l'étanchéité.",
    reserve: "Ne règle rien de structurel. À écarter dès qu'un dommage approche 1." },
  { solution: "rechargement", nom: "Rechargement",
    quandChoisir: "Configuration qui conduit à l'apport de matériaux neufs le plus faible. À choisir dès "
      + "que l'environnement de la chaussée le permet — pas ou peu de passages supérieurs, "
      + "pas de problème de glissières — et que le maître d'ouvrage l'autorise.",
    reserve: "Relève le niveau de la chaussée : vérifier les seuils, les ouvrages et les équipements." },
  { solution: "decaissement-partiel", nom: "Décaissement partiel",
    quandChoisir: "À envisager dès que la structure en place présente des décollements d'interface en "
      + "partie supérieure — dans les quinze premiers centimètres environ — afin de les "
      + "supprimer par fraisage et apport de couches neuves et collées. C'est aussi la "
      + "solution en cas de contrainte de seuil forte.",
    reserve: "Le fraisage coûte et allonge le chantier, mais il supprime le défaut au lieu de le couvrir." },
  { solution: "decaissement-total", nom: "Décaissement total",
    quandChoisir: "Mêmes exigences que le décaissement partiel, poussées à l'extrême : abaissement du fil "
      + "rouge, ou insuffisance structurelle notoire de la chaussée existante.",
    reserve: "On perd tout le capital de la chaussée en place : à ne retenir que s'il n'en reste rien." },
  { solution: "retraitement", nom: "Retraitement en place",
    quandChoisir: "S'apparente au décaissement partiel ou total. Le guide demande de l'envisager "
      + "dans tous les cas, afin d'optimiser le réemploi des matériaux en place chaque "
      + "fois que cela s'avère possible.",
    reserve: "Suppose que les matériaux du site s'y prêtent : une étude de traitement est nécessaire." },
].map(Object.freeze));

export const conseilSolution = (solution) => CONSEILS_SOLUTIONS.find((a) => a.solution === solution) ?? null;

export const nomSolution = (solution) => conseilSolution(solution)?.nom ?? String(solution);

/**
 * Épaisseur en deçà de laquelle un décollement d'interface relève de la partie
 * supérieure de la structure, donc du décaissement partiel (Cerema § 3.1.4).
 */
export const PROFONDEUR_DECOLLEMENT_HAUT_CM = 15;

/**
 * Configurations que le guide écarte, encourage ou impose au vu du diagnostic.
 * Rien n'est choisi à la place du projeteur : le module range les options.
 */
export function orientations(base, decollementHaut, contrainteSeuil, besoinStructurel) {
  const notes = [];
  if (!besoinStructurel)
    notes.push("La capacité restante couvre le trafic futur : un renouvellement de surface "
      + "suffit à rendre l'usage. Le calcul de renforcement n'a pas lieu d'être.");
  if (decollementHaut)
    notes.push(`Décollements d'interface dans les ${nf(PROFONDEUR_DECOLLEMENT_HAUT_CM, 0)} premiers centimètres : `
      + "le guide oriente vers un décaissement partiel, pour les supprimer par fraisage "
      + "et apport de couches neuves et collées, plutôt que de les recouvrir.");
  if (contrainteSeuil)
    notes.push("Contrainte de seuil : le rechargement relèverait la chaussée. Le décaissement, "
      + "partiel ou total, est alors la voie à retenir.");
  if (base === "chaussee-neuve")
    notes.push("Au moins une couche est à la ruine théorique : le renforcement se calcule "
      + "comme une chaussée neuve sur ce qui reste, et non par valorisation du résiduel.");
  notes.push("Le retraitement en place est à envisager dans tous les cas, pour réemployer les "
    + "matériaux du site chaque fois que cela s'avère possible.");
  return notes;
}

/**
 * La solution vers laquelle le guide oriente, d'après le diagnostic :
 * { solution, nom, pourquoi }. L'ordre des critères suit le guide : la ruine,
 * puis les décollements, puis la contrainte de niveau, et à défaut le
 * rechargement.
 */
export function proposerSolution(base, decollementHaut, contrainteSeuil, besoinStructurel) {
  let solution, pourquoi;
  if (!besoinStructurel) {
    solution = "renouvellement-surface";
    pourquoi = "la capacité restante couvre le trafic futur, et rien de structurel n'est à reprendre.";
  } else if (base === "chaussee-neuve") {
    solution = "decaissement-total";
    pourquoi = "le dommage a atteint 1, et un rechargement poserait des couches neuves sur une "
      + "assise sans capital. Le guide oriente vers le décaissement ou le retraitement "
      + "en place, à arbitrer sur la nature des matériaux du site.";
  } else if (decollementHaut) {
    solution = "decaissement-partiel";
    pourquoi = `des décollements ont été relevés dans les ${nf(PROFONDEUR_DECOLLEMENT_HAUT_CM, 0)} premiers `
      + "centimètres, et le guide veut les supprimer par fraisage plutôt que les recouvrir.";
  } else if (contrainteSeuil) {
    solution = "decaissement-partiel";
    pourquoi = "une contrainte de seuil interdit de relever la chaussée, et le décaissement rend "
      + "la place que l'apport prendrait.";
  } else {
    solution = "rechargement";
    pourquoi = "rien n'interdit de recharger, et c'est la configuration qui conduit à l'apport "
      + "de matériaux neufs le plus faible.";
  }
  return { solution, nom: nomSolution(solution), pourquoi };
}

/**
 * Ce qu'il y a à dire quand la solution retenue n'est pas celle vers laquelle
 * le guide oriente. Null quand les deux s'accordent, ou quand la solution
 * retenue va plus loin que demandé (décaissement total ou retraitement à la
 * place d'un partiel, retraitement à la place d'un total).
 */
export function desaccordSolution(choisie, proposition) {
  if (choisie === proposition.solution) return null;
  if (proposition.solution === "decaissement-partiel"
      && (choisie === "decaissement-total" || choisie === "retraitement")) return null;
  if (proposition.solution === "decaissement-total" && choisie === "retraitement") return null;
  return `La solution retenue est « ${nomSolution(choisie)} », alors que le diagnostic oriente vers `
    + `« ${proposition.nom} » — ${proposition.pourquoi} À justifier dans la note, ou à changer.`;
}
