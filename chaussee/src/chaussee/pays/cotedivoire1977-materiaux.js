// Bibliothèque de matériaux du catalogue LBTP Côte d'Ivoire 1977 (portage de
// CoteDIvoireMaterials). Méthode DÉTERMINISTE (Peltier + abaques CBR,
// vérification élastique Alizé) : pas de loi de fatigue rationnelle (ε6 / σ6
// = NaN, critères NF « non applicables »), mais le module de dimensionnement
// adopté et le coefficient de Poisson, pour qu'une structure type injectée
// reçoive directement les bons modules.
//
// Modules adoptés (p-024, bar → MPa, 1 MPa = 10 bar) : base non liée 3000,
// grave-ciment 80 000, grave-bitume 40 000, graveleux-ciment 10 000,
// sable-ciment 15 000, sable-bitume 10 000, revêtement enrobé 30 000 (bar).
// Poisson non indiqué par le catalogue : valeurs usuelles (granulaire 0,35 ;
// traité 0,25 ; bitumineux 0,35).

import { materiauBitumineux, materiauSol, materiauHydraulique } from "./commun.js";

const gran = (cle, E) => materiauSol(cle, E, NaN, NaN, -0.222, 0.35);
const bit = (cle, E) => materiauBitumineux(cle, E, NaN, 5, 0.3, 1.0,
  { note: "Catalogue LBTP 1977 : module adopté (bar -> MPa), méthode déterministe.", nu: 0.35, moduleImpose: E });
const hyd = (cle, E) => materiauHydraulique(cle, NaN, 15, 1.0, 0.03, 1.4, 1.0, { nu: 0.25, E });

export const BITUMINEUX = [
  bit("revetement", 3000),   // enrobés / BB (30 000 bar)
  bit("GB", 4000),           // grave-bitume (40 000 bar)
  bit("sB", 1000),           // sable-bitume, base (10 000 bar)
];

export const SOLS = [
  gran("gn", 300),           // graveleux naturel latéritique (non lié, 3000 bar)
  gran("TVC", 300),          // tout-venant concassé (3000 bar)
  gran("sa", 150),           // sable argileux (sol fin, valeur indicative)
];

export const HYDRAULIQUES = [
  hyd("GC", 8000),           // grave-ciment (80 000 bar)
  hyd("gC", 1000),           // graveleux-ciment, base (10 000 bar)
  hyd("sC", 1500),           // sable argileux-ciment, base (15 000 bar)
];
