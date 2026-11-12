// Profil pays tropicaux : guide pratique de dimensionnement des chaussées pour
// les pays tropicaux (CEBTP, 1980) pour le neuf, manuel de renforcement
// CEBTP/LCPC 1985 pour le renforcement (portage de TropicalProfile). Méthode
// DÉTERMINISTE (catalogue CBR + Peltier, vérification Alizé) : sans loi de
// fatigue ε6, sans température équivalente unique, sans risque probabiliste.
// Le profil reste provisoire tant que ces grandeurs ne sont pas transposées
// dans le moteur rationnel.

import { creerProfil, SUBDIVISION_NEUTRE } from "./base.js";
import { BITUMINEUX, SOLS, HYDRAULIQUES } from "./tropical-materiaux.js";
import { CATALOGUE } from "./tropical-structures.js";
import { CATALOGUE_RENFORCEMENT } from "./tropical-renforcement.js";
import { FICHES } from "./tropical-fiches.js";
import { verifierCebtp1980 } from "./tropical-calcul.js";
import { verifier1985 } from "./tropical-1985.js";
import { CLASSES_TRAFIC_TROPICALES, CLASSES_PORTANCE_TROPICALES } from "./tropical-classes.js";

export const tropical = creerProfil({
  id: "tropical",
  nom: "Pays tropicaux — guide CEBTP 1980 (catalogue)",
  reference: "Guide pratique de dimensionnement des chaussées pour les pays tropicaux, CEBTP, 1980",
  provisoire: true,
  noteProvisoire:
    "Guide CEBTP 1980 (neuf) : contraintes admissibles en bar (fourchettes σt, Kerkhoven-Dormon). "
    + "Manuel 1985 (renforcement / hybride) : εt et σt des fiches p. 117 par classe T, εz Shell "
    + "2,8e-2·N^(-0,25). Pas de Teq unique ni de risque NF. CAM indicatif C = (P/8,2)^alpha. "
    + "Portances S1-S5 (CBR) pour le neuf ; Q1-Q5 (déflexion) pas encore classées automatiquement.",

  // Catalogue déterministe : contraintes admissibles tabulées, pas de loi en ε6.
  fatigueRationnelle: false,

  // Manuel CEBTP/LCPC 1985 : fourchettes assorties d'une valeur d'usage. Le pays a un
  // catalogue d'apport ET modélise l'ancienne chaussée pour la vérification rationnelle
  // de ses couches traitées — les deux ne s'excluent pas.
  modulesResiduels: "tropical",

  // Aucune température équivalente unique dans le guide : valeur chaude indicative
  // (vérification réelle aux températures extrêmes).
  teqPropose: () => 30,

  // Modules de dimensionnement adoptés du guide (bar → MPa) : l'injection d'une fiche
  // affecte directement les bons modules. Matériaux sans loi de fatigue.
  materiaux: { bitumineux: BITUMINEUX, sols: SOLS, hydrauliques: HYDRAULIQUES },

  cam: [
    { famille: "bitumineux", cam: 0.8, provisoire: true,
      note: "CEBTP : CAM non tabulé. Loi C = (P/8,2)^4 (chaussée souple), essieu de référence 8,2 t." },
    { famille: "hydraulique", cam: 1.0, provisoire: true,
      note: "CEBTP : CAM non tabulé. Loi C = (P/8,2)^alpha, alpha = 4 à 8 (matériaux rigides/béton)." },
    { famille: "sol", cam: 1.0, provisoire: true,
      note: "CEBTP : sol / GNT. Dimensionnement par contrainte admissible de compression, non par CAM." },
  ],

  // Le guide n'utilise pas la subdivision NF des GNT. Seule règle sur les couches
  // granulaires : épaisseur minimale de mise en œuvre h ≥ 2,5 × D (p. 33). Les modules
  // ne sont pas propagés : le catalogue donne des structures à épaisseurs fixes.
  subdivisionGnt: () => ({
    ...SUBDIVISION_NEUTRE,
    note: "Guide CEBTP (p. 33) : pas de subdivision NF des GNT. Seule règle sur les couches "
      + "granulaires : épaisseur minimale h >= 2,5 x D (D = plus gros élément). Le catalogue "
      + "fournit des structures à épaisseurs fixes vérifiées par contraintes admissibles (bar).",
  }),

  // Classes de trafic CEBTP (véhicules/j, %PL ~30 %), provisoires.
  classesTrafic: CLASSES_TRAFIC_TROPICALES,
  classesPortance: CLASSES_PORTANCE_TROPICALES,
  catalogue: CATALOGUE,
  catalogueRenforcement: CATALOGUE_RENFORCEMENT,
  fiches: FICHES,

  // Neuf : fourchettes 1980 + Kerkhoven-Dormon. Renforcement / hybride : fiches 1985 + Shell.
  verifierDeterministe: (couches, analyse, p) =>
    (p.intervention === "renforcement" || p.intervention === "hybride"
      ? verifier1985(couches, analyse, p)
      : verifierCebtp1980(couches, analyse, p)),
});

export default tropical;
