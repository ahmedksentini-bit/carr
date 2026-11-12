// Profil Côte d'Ivoire — catalogue LBTP 1977, conservé en archive (portage de
// CoteDIvoire1977Profile). Méthode DÉTERMINISTE : contraintes admissibles en
// bar (tableau VII en base des couches liées, tableau V en tête de
// plate-forme), formule de Peltier et abaques CBR. Pas de loi de fatigue ε6,
// pas de température équivalente unique, pas de risque probabiliste : profil
// provisoire. Le profil par défaut du pays est le manuel 2024 (cotedivoire.js).

import { creerProfil, SUBDIVISION_NEUTRE } from "./base.js";
import { BITUMINEUX, SOLS, HYDRAULIQUES } from "./cotedivoire1977-materiaux.js";
import { CATALOGUE } from "./cotedivoire1977-structures.js";
import { FICHES } from "./cotedivoire1977-fiches.js";
import { verifierLbtp1977 } from "./cotedivoire1977-calcul.js";
import { CLASSES_TRAFIC_TROPICALES, CLASSES_PORTANCE_TROPICALES } from "./tropical-classes.js";

export const cotedivoire1977 = creerProfil({
  id: "cotedivoire1977",
  nom: "Côte d'Ivoire — catalogue LBTP 1977 (archive)",
  reference: "Catalogue de structures types, LBTP Côte d'Ivoire, édition provisoire, septembre 1977",
  provisoire: true,
  noteProvisoire:
    "Catalogue LBTP 1977 : méthode DÉTERMINISTE (contraintes admissibles en bar, formule de "
    + "PELTIER + abaques CBR, vérification Alizé). Pas de loi de fatigue ε6, pas de température "
    + "équivalente unique, pas de risque probabiliste. CAM par loi puissance C = (P/8,2)^4 "
    + "(essieu de référence 8,2 t) ; l'exemple du catalogue donne ~2,5 essieux équivalents par PL. "
    + "Portances S1-S5 par CBR (modules 250/500/750/1500/3000 bar). Vérification par CONTRAINTES "
    + "ADMISSIBLES (bar) désormais active : Tableau VII (traction en base, par matériau et trafic) "
    + "et Tableau V (compression en tête de plate-forme, par portance). Statut provisoire conservé "
    + "(pas de risque probabiliste, valeurs d'époque).",

  // Catalogue déterministe : contraintes admissibles tabulées, pas de loi en ε6.
  fatigueRationnelle: false,

  // Manuel tropical CEBTP/LCPC 1985 : fourchettes assorties d'une valeur d'usage.
  modulesResiduels: "tropical",

  // 7 régions climatiques R1-R7, pas de température équivalente unique : valeur chaude
  // indicative (températures régionales moyennes ~24-27 °C).
  teqPropose: () => 30,

  materiaux: { bitumineux: BITUMINEUX, sols: SOLS, hydrauliques: HYDRAULIQUES },

  cam: [
    { famille: "bitumineux", cam: 0.8, provisoire: true,
      note: "LBTP 1977 : CAM non tabulé. Loi C = (P/8,2)^4, essieu de référence 8,2 t (exemple ~2,5 par PL)." },
    { famille: "hydraulique", cam: 1.0, provisoire: true,
      note: "LBTP 1977 : dimensionnement par contrainte de traction admissible (bar), non par CAM." },
    { famille: "sol", cam: 1.0, provisoire: true,
      note: "LBTP 1977 : sol / GNT. Contrainte de compression admissible en tête de plate-forme (bar)." },
  ],

  // Pas de subdivision NF des GNT : règle d'épaisseur minimale h ≥ 2,5 × D.
  subdivisionGnt: () => ({
    ...SUBDIVISION_NEUTRE,
    note: "Catalogue LBTP : pas de subdivision NF des GNT. Épaisseur minimale h >= 2,5 x D.",
  }),

  // Mêmes classes de trafic (véh/j) et de portance (CBR) que le guide tropical (S1-S5).
  classesTrafic: CLASSES_TRAFIC_TROPICALES,
  classesPortance: CLASSES_PORTANCE_TROPICALES,
  catalogue: CATALOGUE,
  fiches: FICHES,

  // Vérification DÉTERMINISTE : traction admissible en base (tableau VII, par trafic) et
  // compression admissible en tête de plate-forme (tableau V, par portance), en bar.
  verifierDeterministe: (couches, analyse, p) => verifierLbtp1977(couches, analyse, p),
});

export default cotedivoire1977;
