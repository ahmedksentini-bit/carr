// Bibliothèque de matériaux du guide CEBTP 1980 (pays tropicaux), complétée
// par le manuel de renforcement 1985 (portage de TropicalMaterials). Méthode
// DÉTERMINISTE (catalogue CBR + vérification élastique) : matériaux sans loi de
// fatigue rationnelle (ε6 / σ6 = NaN, critères NF « non applicables »), portant
// le module de dimensionnement adopté et le coefficient de Poisson.
//
// Modules adoptés (p. 137-138, bar → MPa) : base concassé 5000, graves 3000,
// sols-ciment 15 000, grave-ciment 80 000, grave-bitume 40 000 ; fondation
// GNT / sable argileux 3000, sols-ciment 4500, sols-bitume 3500, sols-chaux
// 3500 (bar). E_dyn = 100 × CBR pour les graves et latérites naturelles. Le
// guide prend ν = 0,5 en général ; on retient les valeurs usuelles de calcul
// (granulaire 0,35 ; traité 0,25 ; bitumineux 0,35) pour la stabilité
// numérique du modèle multicouche.

import { materiauBitumineux, materiauSol, materiauHydraulique } from "./commun.js";

const gran = (cle, E) => materiauSol(cle, E, NaN, NaN, -0.222, 0.35);
const bit = (cle, E) => materiauBitumineux(cle, E, NaN, 5, 0.3, 1.0,
  { note: "Guide CEBTP 1980 : module adopté (bar -> MPa), méthode déterministe.", nu: 0.35, moduleImpose: E });
const hyd = (cle, E) => materiauHydraulique(cle, NaN, 15, 1.0, 0.03, 1.4, 1.0, { nu: 0.25, E });

export const BITUMINEUX = [
  bit("revetement", 3000),   // enrobés / BB (surface)
  bit("GB", 4000),           // grave-bitume (40 000 bar)
  bit("SB", 1000),           // sable-bitume (base)
  bit("BANB", 1000),         // banco-coquillage amélioré bitume
  bit("CORB", 1000),         // corail concassé traité bitume
  // Manuel de renforcement CEBTP 1985 (p. 116) : E à ~28-30 °C / 10 Hz, bar → MPa.
  bit("ES", 1500),           // enduit superficiel (indicatif)
  bit("TS", 1500),           // tapis sable
  bit("MB", 2000),           // microbéton
  bit("BB", 2500),           // béton bitumineux (25 000 bar)
  bit("SB85", 2000),         // sable-bitume 1985 (20 000 bar)
];

export const SOLS = [
  gran("CON", 500),          // concassé 0/d (5000 bar)
  gran("LAT", 300),          // graveleux latéritique naturel (3000 bar)
  gran("LG0D", 300),         // latérite naturelle ou grave 0/D
  gran("LGC", 300),          // latérite, grave ou concassé 0/d
  gran("LGT", 300),          // latérite, grave ou tout-venant de concassage
  gran("GLC", 300),          // grave, latérite naturelle ou concassé 0/d
  gran("SCO", 300),          // scories volcaniques
  gran("SCOP", 300),         // scories ou pouzzolanes
  gran("SA", 150),           // sable argileux (sol fin)
  gran("BAN", 150),          // banco-coquillage (indicatif)
  gran("SCOQ30", 150),       // sable coquillier 0/30
  gran("SCOQ50", 150),       // sable coquillier 0/50
  gran("COR", 200),          // soupe de corail ou corail mort
  gran("CORS", 200),         // soupe de corail
  gran("GNT", 300),          // grave non traitée (renforcement 1985)
];

export const HYDRAULIQUES = [
  hyd("GC", 8000),           // grave-ciment (80 000 bar)
  hyd("LATC", 1500),         // latérite ou grave améliorée ciment (sols-ciment 15 000 bar)
  hyd("SAC", 1500),          // sable argileux amélioré ciment
  hyd("BS", 1500),           // béton de sol
  hyd("BANC", 1500),         // banco-coquillage amélioré ciment
  hyd("CORC", 1500),         // corail traité ciment
  hyd("SCC", 1500),          // soupe corallienne traitée ciment
  hyd("GAC", 1500),          // grave améliorée ciment
  hyd("MIXC", 1500),         // sable-ciment, grave-ciment ou sable-bitume
  hyd("SGC", 450),           // sable argileux ou grave améliorés ciment (fondation 4500 bar)
  hyd("SCH", 350),           // sol-chaux (fondation 3500 bar)
  hyd("SC", 1500),           // sol-ciment / MTLH1 (15 000 bar, CEBTP 1985)
  hyd("GLC85", 5000),        // grave latéritique ciment / MTLH2 (50 000 bar)
  hyd("GC85", 15000),        // grave-ciment / MTLH3 (150 000 bar)
];
