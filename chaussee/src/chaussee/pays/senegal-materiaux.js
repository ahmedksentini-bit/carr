// Bibliothèque de matériaux et classes du catalogue Sénégal 2015 (Ageroute),
// portage de SenegalMaterials. Méthode rationnelle NF P98-086 / Alizé,
// θeq = 34 °C à 20 Hz, ν des enrobés = 0,45. Les enrobés n'ont pas de table
// E(T) dans le catalogue : leur module de calcul est E(34 °C, 20 Hz) imposé
// (moduleImpose), tandis que E10 = E(10 °C, 10 Hz) sert au coefficient kθ.

import { classeTrafic, classeNe, classePortance, catalogueRisque } from "./base.js";
import { materiauBitumineux as bit, materiauSol as sol, materiauHydraulique as hyd } from "./commun.js";

export const BITUMINEUX = [
  // GB : E(10, 10) = 11 880 pour kθ, module de calcul E(34, 20) = 2588, ν = 0,45.
  bit("GB2", 11880, 80, 5, 0.30, 1.3,
    { note: "Catalogue Sénégal 2015 (T44) : E(34 °C,20 Hz)=2588 MPa, ν=0,45.", nu: 0.45, moduleImpose: 2588 }),
  bit("GB3", 11880, 90, 5, 0.30, 1.3,
    { note: "Catalogue Sénégal 2015 (T44) : E(34 °C,20 Hz)=2588 MPa, ν=0,45.", nu: 0.45, moduleImpose: 2588 }),
  // BBSG de surface, non vérifiés en fatigue (ε6 = NaN) : module de calcul seul.
  bit("BBSG1", 1512, NaN, 5, 0.25, 1.1,
    { note: "Catalogue Sénégal 2015 (T54) : surface non fatiguée, E(34,20)=1512 MPa, ν=0,45.", nu: 0.45, moduleImpose: 1512 }),
  bit("BBSG2-3", 1896, NaN, 5, 0.25, 1.1,
    { note: "Catalogue Sénégal 2015 (T54) : surface non fatiguée, E(34,20)=1896 MPa, ν=0,45.", nu: 0.45, moduleImpose: 1896 }),
  // EME2 : le tableau 49 ne donne que les spécifications ; le tableau 50
  // (« caractéristiques de dimensionnement ») donne E(10, 10) = 16 940 MPa.
  bit("EME2", 16940, 130, 5, 0.25, 1.0,
    { note: "Catalogue Sénégal 2015 (T50) : E(34 °C,20 Hz)=6151 MPa, ν=0,45, Sh=2,5 cm.", nu: 0.45, moduleImpose: 6151 }),
];

// Sol / GNT : εz,adm = A × NE^(−1/4,5) ; A = 16 000 (NE ≤ 250 000) / 12 000 (NE > 250 000).
const PENTE = -1 / 4.5;
export const SOLS = [
  sol("PF1", 20, 16000, 12000, PENTE),
  sol("PF2", 50, 16000, 12000, PENTE),
  sol("PF2qs", 80, 16000, 12000, PENTE),
  sol("PF3", 120, 16000, 12000, PENTE),
  sol("PF4", 200, 16000, 12000, PENTE),
  sol("GNT", 600, 16000, 12000, PENTE),   // GNT concassée de base
  sol("GL1", 200, 16000, 12000, PENTE),   // latérite, base 200
  sol("GL2", 400, 16000, 12000, PENTE),
  sol("GLi", 400, 16000, 12000, PENTE),
  sol("GLa", 400, 16000, 12000, PENTE),
];

// MTLH / béton : σt,adm = σ6 × (NE/10⁶)^b × kc × kr × ks × kd ; ν = 0,25.
export const HYDRAULIQUES = [
  // GLc : grave-latérite-ciment (T19). σ6 = 0,95 × Rt360j.
  hyd("GLc1", 0.19, 11, 1.0, 0.03, 1.4, 1.0, { E: 2500 }),
  hyd("GLc2", 0.37, 11, 1.0, 0.03, 1.4, 1.0, { E: 3000 }),
  // GC-T3 / SC-T2 (T33).
  hyd("GC-T3", 0.75, 15, 1.0, 0.03, 1.4, 1.0, { E: 23000 }),
  hyd("SC-T2", 0.50, 12, 0.8, 0.025, 1.5, 1.0, { E: 12000 }),
  // BQc : banco-coquillage de Rao traité au ciment (6 %, classe mécanique T1 à 90 j),
  // tableau 35 : E = 10 000, σ6 = 0,30, b = −1/11, SN = 1, Sh = 0,03 m, kc = 1,4, kd = 1.
  hyd("BQc", 0.30, 11, 1.0, 0.03, 1.4, 1.0, { E: 10000 }),
  // Béton (T37), Sh = 0. kd BC5 : 1/1,7 non goujonné ; BC5g goujonné : 1/1,47 ; BC2 : 1,0 (à confirmer).
  hyd("BC5", 2.15, 16, 1.0, 0, 1.5, 1 / 1.7, { E: 35000 }),
  hyd("BC5g", 2.15, 16, 1.0, 0, 1.5, 1 / 1.47, { E: 35000 }),
  hyd("BC2", 1.37, 14, 1.0, 0, 1.5, 1.0, { E: 20000 }),
];

// Classes journalières (tableau 3) : bornes de PL/j sur la voie la plus chargée.
export const CLASSES_TRAFIC = [
  classeTrafic("T5", 0, 25, { note: "moyenne géo. 5 PL/j" }),
  classeTrafic("T4", 25, 50, { note: "moyenne géo. 35" }),
  classeTrafic("T3", 50, 150, { note: "moyenne géo. 85" }),
  classeTrafic("T2", 150, 300, { note: "moyenne géo. 215" }),
  classeTrafic("T1", 300, 750, { note: "moyenne géo. 475" }),
  classeTrafic("T0", 750, 2000, { note: "moyenne géo. 1225" }),
  classeTrafic("TS", 2000, 5000, { note: "moyenne géo. 3165" }),
  classeTrafic("TEX", 5000, 7000, { note: "moyenne géo. 5920" }),
];

// Classes de NE cumulé (tableau 5, millions d'essieux de 130 kN).
export const CLASSES_NE = [
  classeNe("C1", 0.05, 0.1), classeNe("C2", 0.1, 0.3), classeNe("C3", 0.3, 1), classeNe("C4", 1, 3),
  classeNe("C5", 3, 10), classeNe("C6", 10, 30), classeNe("C7", 30, 50), classeNe("C8", 50, 100),
];

// Portances de plate-forme (tableau 11) : module de dimensionnement (E min).
export const CLASSES_PORTANCE = [
  classePortance("PF1", 20, { cbrMin: 5, note: "EV2 court terme 30 MPa, CBR ≥ 5" }),
  classePortance("PF2", 50, { cbrMin: 10, note: "EV2 80, CBR ≥ 10" }),
  classePortance("PF2qs", 80, { cbrMin: 15, note: "EV2 100, CBR ≥ 15" }),
  classePortance("PF3", 120, { cbrMin: 25, note: "EV2 120, CBR ≥ 25" }),
  classePortance("PF4", 200, { cbrMin: 40, note: "EV2 200, CBR ≥ 40" }),
];

// Risque (tableau 70) : C1-C4 (< 3 M) r = 25 % ; C5-C8 (3-100 M) r = 5 %.
const r = (classe, risque) => ({ structure: null, famille: null, classe, risque, provisoire: false, note: null });
export const RISQUE = catalogueRisque(
  [r("C1", 25), r("C2", 25), r("C3", 25), r("C4", 25), r("C5", 5), r("C6", 5), r("C7", 5), r("C8", 5)],
  "Catalogue Sénégal 2015, tableau 70 : C1-C4 → r = 25 % ; C5-C8 → r = 5 % (risque fixé par le maître d'ouvrage, 1-50 %).");

export const GLOSSAIRE = [
  { code: "GNT", nom: "Grave non traitée (concassée)",
    emploi: "Assise granulaire : base 600 MPa, fondation ×3 (plafond 600 GNT/GNT ou 360 GNT/GB)." },
  { code: "GL1", nom: "Grave latéritique crue, classe 1",
    emploi: "Latérite naturelle de faible portance (200 MPa, ×2). Base ≤ T3, fondation ≤ T1." },
  { code: "GL2", nom: "Grave latéritique crue, classe 2",
    emploi: "Latérite naturelle (400 MPa, ×2). Emploi en assise ≤ T1." },
  { code: "GLi (GLli)", nom: "Grave latéritique litho-stabilisée",
    emploi: "Latérite + correcteur granulaire (400 MPa, ×2). Emploi en assise ≤ T1." },
  { code: "GLa", nom: "Grave latéritique améliorée au ciment (2-3 %)",
    emploi: "Comportement souple (400 MPa, ×2). Emploi en assise ≤ T1." },
  { code: "GLc1 / GLc2", nom: "Grave latérite traitée au ciment (4-6 %)",
    emploi: "MTLH semi-rigide (E 2500 / 3000 MPa). GLc1 ≤ T4 ; GLc2 ≤ T2." },
  { code: "GC-T3", nom: "Grave-ciment classe 3", emploi: "MTLH (E 23000 MPa) : base et fondation, tout trafic." },
  { code: "SC-T2", nom: "Sable-ciment classe 2", emploi: "MTLH (E 12000 MPa) : base ≤ T5, fondation ≤ T1." },
  { code: "GB2 / GB3", nom: "Grave-bitume classe 2 / 3", emploi: "Assise bitumineuse (E 34 °C,20 Hz = 2588 MPa)." },
  { code: "BC5 / BC2", nom: "Béton de ciment", emploi: "Dalle / fondation béton (chaussée rigide)." },
];
