// Classes de trafic (véhicules par jour) et de portance (S1-S5 par CBR)
// communes aux méthodes déterministes tropicales : guide CEBTP 1980 et
// catalogue LBTP Côte d'Ivoire 1977 (portage de TropicalClasses). Modules de
// plate-forme (Milfeuil) convertis des bars en MPa (1 MPa = 10 bar).

import { classeTrafic, classePortance } from "./base.js";

export const CLASSES_TRAFIC_TROPICALES = [
  classeTrafic("T1", 100, 300, { provisoire: true, note: "100-300 véh/j (%PL ~20-30 %)" }),
  classeTrafic("T2", 300, 1000, { provisoire: true, note: "300-1000 véh/j" }),
  classeTrafic("T3", 1000, 3000, { provisoire: true, note: "1000-3000 véh/j" }),
  classeTrafic("T4", 3000, 6000, { provisoire: true, note: "3000-6000 véh/j" }),
  classeTrafic("T5", 6000, 12000, { provisoire: true, note: "6000-12000 véh/j" }),
];

export const CLASSES_PORTANCE_TROPICALES = [
  classePortance("S1", 25, { cbrMin: 0, provisoire: true, note: "CBR < 5 (250 bar)" }),
  classePortance("S2", 50, { cbrMin: 5, provisoire: true, note: "CBR 5-10 (500 bar)" }),
  classePortance("S3", 75, { cbrMin: 10, provisoire: true, note: "CBR 10-15 (750 bar)" }),
  classePortance("S4", 150, { cbrMin: 15, provisoire: true, note: "CBR 15-30 (1500 bar)" }),
  classePortance("S5", 300, { cbrMin: 30, provisoire: true, note: "CBR ≥ 30 (3000 bar)" }),
];
