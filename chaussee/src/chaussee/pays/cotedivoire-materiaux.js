// Matériaux et classes du manuel LBTP Côte d'Ivoire, avril 2024 (Fasc. 2 §8.5
// et tab. 15-19), portage de CoteDIvoire2024Materials. θeq = 32 °C / 20 Hz.
// E10 est calculé pour retrouver les kθ tabulés (kθ = √(E10 / E(32 °C, 20 Hz)) :
// GB3 2,16, GB4 2,03, EME2 1,67). A en plate-forme : 16 000 / 13 000 µdéf
// (assise bitumineuse, tab. 16) ; assise non traitée A = 20 000. Q1/Q2 :
// A = 20 000 / 1,20 pour encoder ka = 1,20 sans toucher au moteur.

import { classeTrafic, classeNe, classePortance, catalogueRisque } from "./base.js";
import { materiauBitumineux as bit, materiauSol as sol } from "./commun.js";

// kθ tab. 17 → E10 = kθ² × E(32 °C, 20 Hz).
export const E10_GB3 = 2.16 * 2.16 * 3000;   // 13 996,8
export const E10_GB4 = 2.03 * 2.03 * 4000;   // 16 483,6
export const E10_EME2 = 1.67 * 1.67 * 6800;  // 18 969,32

export const BITUMINEUX = [
  bit("ES", 1500, NaN, 5, 0.25, 1.0,
    { note: "Enduit superficiel (surface, non fatigué).", nu: 0.45, moduleImpose: 1500 }),
  bit("BBM", 1500, NaN, 5, 0.25, 1.0,
    { note: "BBM, E(32 °C, 20 Hz)=1500 MPa, surface non fatiguée (tab. 15).", nu: 0.45, moduleImpose: 1500 }),
  bit("BBSG", 2000, NaN, 5, 0.25, 1.1,
    { note: "BBSG, E(32 °C, 20 Hz)=2000 MPa, surface non fatiguée (tab. 15).", nu: 0.45, moduleImpose: 2000 }),
  bit("GB3", E10_GB3, 90, 5, 0.30, 1.3,
    { note: "GB3 : E(32 °C, 20 Hz)=3000, ε6=90, kθ=2,16, kc=1,3, SN=0,30.", nu: 0.45, moduleImpose: 3000 }),
  bit("GB4", E10_GB4, 100, 5, 0.30, 1.3,
    { note: "GB4 : E(32 °C, 20 Hz)=4000, ε6=100, kθ=2,03, kc=1,3, SN=0,30.", nu: 0.45, moduleImpose: 4000 }),
  bit("EME2", E10_EME2, 130, 5, 0.25, 1.0,
    { note: "EME2 : E(32 °C, 20 Hz)=6800, ε6=130, kθ=1,67, kc=1, SN=0,25.", nu: 0.45, moduleImpose: 6800 }),
];

// A = 20 000 µdéf (0,020) en assise non traitée ; Q1/Q2 ÷ 1,20 (ka). Pente −0,222.
export const SOLS = [
  sol("PPF2", 50, 16000, 13000),
  sol("PPF3", 80, 16000, 13000),
  sol("PPF4", 120, 16000, 13000),
  sol("PPF5", 200, 16000, 13000),
  sol("GNT", 400, 20000, 20000),
  sol("GLn", 300, 20000, 20000),
  sol("SAn", 300, 20000, 20000),
  sol("GLa1", 450, 20000 / 1.20, 20000 / 1.20),
  sol("SAa1", 450, 20000 / 1.20, 20000 / 1.20),
  sol("GLa2", 1000, 20000 / 1.20, 20000 / 1.20),
  sol("SAa2", 1000, 20000 / 1.20, 20000 / 1.20),
];

/** Pas de MTLH semi-rigide au catalogue 2024 (les matériaux améliorés au ciment restent souples). */
export const HYDRAULIQUES = [];

// Fasc. 1 tab. 5 : classes de NE (millions d'essieux de 130 kN).
export const CLASSES_NE = [
  classeNe("TC1-", 0.07, 0.2, "0,07 à 0,2 M essieux 130 kN"),
  classeNe("TC1+", 0.2, 0.5),
  classeNe("TC2-", 0.5, 0.9),
  classeNe("TC2+", 0.9, 1.5),
  classeNe("TC3-", 1.5, 2.5),
  classeNe("TC3+", 2.5, 4.0),
  classeNe("TC4-", 4.0, 6.5),
  classeNe("TC4+", 6.5, 10),
  classeNe("TC5-", 10, 16),
  classeNe("TC5+", 16, 25),
  classeNe("TC6-", 25, 35),
  classeNe("TC6+", 35, 50.001, "35 à 50 M ; dimensionnement à la borne haute"),
];

const tc = (nom, risque) => classeTrafic(nom, null, null, {
  classeRisque: risque,
  note: "Classe de NE (essieux 130 kN). La TMJA seule ne fixe pas la classe (Fasc. 3).",
});

/** Les classes de trafic SONT les classes de NE : bornes de TMJA nulles, exprès. */
export const CLASSES_TRAFIC = [
  tc("TC1-", "TC1"), tc("TC1+", "TC1"),
  tc("TC2-", "TC2"), tc("TC2+", "TC2"),
  tc("TC3-", "TC3"), tc("TC3+", "TC3"),
  tc("TC4-", "TC4"), tc("TC4+", "TC4"),
  tc("TC5-", "TC5"), tc("TC5+", "TC5"),
  tc("TC6-", "TC6"), tc("TC6+", "TC6"),
];

export const CLASSES_PORTANCE = [
  classePortance("PPF1", 20, { note: "20 ≤ E < 50 MPa — exclue du catalogue, viser PPF2." }),
  classePortance("PPF2", 50, { note: "50 ≤ E < 80 MPa ; calcul à 50 MPa" }),
  classePortance("PPF3", 80, { note: "80 ≤ E < 120 MPa ; calcul à 80 MPa. Mini pour TC4+." }),
  classePortance("PPF4", 120, { note: "120 ≤ E < 200 MPa ; calcul à 120 MPa" }),
  classePortance("PPF5", 200, { note: "E ≥ 200 MPa ; calcul à 200 MPa" }),
];

const r = (classe, risque) => ({ structure: null, famille: null, classe, risque, provisoire: false, note: null });
export const RISQUE = catalogueRisque(
  [r("TC1", 30), r("TC2", 25), r("TC3", 15), r("TC4", 10), r("TC5", 5), r("TC6", 5)],
  "LBTP 2024 tab. 12 : r = 30/25/15/10/5/5 % selon TC1..TC6.");

export const GLOSSAIRE = [
  { code: "GNT", nom: "Grave non traitée", emploi: "k=2,5, Emax 400 MPa, sous-couches ≤ 25 cm." },
  { code: "GLn / SAn", nom: "Graveleux latéritique / sable argileux naturels", emploi: "Fondation, k=2, Emax 300 MPa." },
  { code: "GLa1 / SAa1", nom: "Amélioré ciment qualité Q1", emploi: "Fondation, Emax 450 MPa, k=2,5. Pas un MTLH semi-rigide." },
  { code: "GLa2 / SAa2", nom: "Amélioré ciment qualité Q2", emploi: "Base, E = 1000 MPa fixe. ka = 1,20 sur εz." },
  { code: "GB3 / GB4", nom: "Grave-bitume NF EN 13108-1", emploi: "E(32 °C, 20 Hz) = 3000 / 4000 MPa." },
  { code: "EME2", nom: "Enrobé à module élevé classe 2", emploi: "E(32 °C, 20 Hz) = 6800 MPa, kc = 1." },
  { code: "PPF", nom: "Portance long terme", emploi: "PPF1 exclue. Calcul à la borne inf. ν = 0,35. Mini PPF3 dès TC4." },
];
