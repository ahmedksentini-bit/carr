// Bibliothèque de matériaux, classes de trafic et de portance, et table de
// risque de la Tunisie (portage de TunisiaMaterials de Burmister-Calc). Deux
// sources :
//  - catalogue RevA (fasc. 4, tab. 115-121) : modules de calcul à 28 °C / 20 Hz
//    (enrobés ν = 0,45), clés BBSG / GB2 / GB3 / EME2 / GCt3 / STLH / BC*
//    employées par les fiches du fascicule 5 ;
//  - note circulaire 2017 (tab. 7a) : tables E(T) à 10 Hz (clés eb-*),
//    conservées pour un calcul à θeq 20 / 23 °C.
// Même forme que materiaux.js : un bitumineux sans table E(T) porte son module
// de dimensionnement imposé (moduleImpose), un traité son module E.

import { classeTrafic, classePortance, catalogueRisque } from "./base.js";

const bit = (cle, E10, eps6, moinsInvB, SN, kc, tableE, note, nu = 0.35, moduleImpose = undefined) =>
  ({ cle, famille: "bitumineux", E10, eps6, b: -1 / moinsInvB, SN, kc, tableE, nu, note, moduleImpose });

const sol = (cle, E, Afaible, Afort) => ({ cle, famille: "sol", E, Afaible, Afort, pente: -0.222, nu: 0.35 });

const hyd = (cle, sigma6, moinsInvB, SN, Sh, kc, kd, E) =>
  ({ cle, famille: "hydraulique", sigma6, b: -1 / moinsInvB, SN, Sh, kc, kd, nu: 0.25, E });

// Catalogue RevA : E10 sert au kθ (valeurs 10 °C / 10 Hz de la note 2017) ;
// moduleImpose = E(28 °C, 20 Hz) imposé par le fascicule 4.
export const BITUMINEUX_TUNISIE = [
  bit("BBSG", 9310, 100, 5, 0.25, 1.1, null,
    "Catalogue RevA, Tab. 116 : E(28 °C,10 Hz)=2930 MPa, ν=0,45. Classes 2 et 3 identiques.", 0.45, 2930),
  bit("GB2", 11880, 80, 5, 0.30, 1.3, null, "Catalogue RevA, Tab. 115 : E(28 °C,20 Hz)=4170 MPa, ν=0,45.", 0.45, 4170),
  bit("GB3", 11880, 90, 5, 0.30, 1.3, null, "Catalogue RevA, Tab. 115 : E(28 °C,20 Hz)=4170 MPa, ν=0,45.", 0.45, 4170),
  bit("EME2", 16940, 130, 5, 0.25, 1.0, null, "Catalogue RevA, Tab. 115 : E(28 °C,20 Hz)=8650 MPa, ν=0,45.", 0.45, 8650),
  // Note 2017, tab. 7a — tables E(T) à 10 Hz, θeq 20 / 23 °C.
  bit("eb-bbsg1", 7315, 100, 5, 0.25, 1.1, [14800, 12000, 7315, 3685, 1300, 1000], "Note 2017, Tab. 7a"),
  bit("eb-bbsg2", 9310, 100, 5, 0.25, 1.1, [16000, 13500, 9310, 4690, 2200, 1500], "Note 2017, Tab. 7a"),
  bit("eb-bbsg3", 9310, 100, 5, 0.25, 1.1, [16000, 13500, 9310, 4690, 2200, 1500], "Note 2017, Tab. 7a"),
  bit("eb-bbme1", 11970, 100, 5, 0.25, 1.1, [17300, 15400, 11970, 6030, 3000, 1900], "Note 2017, Tab. 7a"),
  bit("eb-bbme2", 14630, 100, 5, 0.25, 1.1, [19500, 18200, 14630, 7370, 3800, 2300], "Note 2017, Tab. 7a"),
  bit("eb-bbme3", 14630, 100, 5, 0.25, 1.1, [19500, 18200, 14630, 7370, 3800, 2300], "Note 2017, Tab. 7a"),
  bit("eb-gb2", 11880, 80, 5, 0.30, 1.3, [22600, 18300, 11880, 6120, 2700, 1000], "Note 2017, Tab. 7a"),
  bit("eb-gb3", 11880, 90, 5, 0.30, 1.3, [22800, 18300, 11880, 6120, 3500, 1200], "Note 2017, Tab. 7a"),
  bit("eb-gb4", 14300, 100, 5, 0.30, 1.3, [25000, 20000, 14300, 7700, 3800, 2200], "Note 2017, Tab. 7a"),
  bit("eb-eme1", 16940, 100, 5, 0.25, 1.0, [30000, 24000, 16940, 11060, 6000, 3000], "Note 2017, Tab. 7a"),
  bit("eb-eme2", 16940, 130, 5, 0.25, 1.0, [30000, 24000, 16940, 11060, 6000, 3000], "Note 2017, Tab. 7a"),
];

// GNT : note 2017 §6.1. Cat. 1 (GRH) 500 MPa, cat. 2 (GC 0/31,5 - 0/20)
// 400 MPa ; structure inverse cat. 1 480 MPa. A du critère de déformation
// aligné sur la NF P98-086 : 16 000 / 12 000, pente −0,222.
export const SOLS_TUNISIE = [
  sol("PF1", 20, 16000, 12000),
  sol("PF2", 50, 16000, 12000),
  sol("PF2qs", 80, 16000, 12000),
  sol("PF3", 120, 16000, 12000),
  sol("PF4", 200, 16000, 12000),
  sol("GNT-cat1", 500, 16000, 12000),      // base GRH (note 2017)
  sol("GNT-cat2", 400, 16000, 12000),      // GC 0/31,5 - 0/20 (note 2017)
  sol("GNT-cat1-inv", 480, 16000, 12000),  // structure inverse (note 2017)
  sol("GNT", 200, 16000, 12000),           // CG3, base souple (catalogue RevA, Tab. 113)
];

// Catalogue RevA, tab. 117 / 120 / 121. kd béton = 1/1,7 (non goujonné),
// 1/1,47 (BC5g), 1/1,37 (BAC).
export const HYDRAULIQUES_TUNISIE = [
  hyd("GCt3", 0.75, 15, 1.0, 0.03, 1.4, 1.0, 23000),
  hyd("STLH-T1-F", 0.12, 11, 0.8, 0.04, 1.4, 1.0, 1600),
  hyd("STLH-T1-G", 0.15, 11, 1.0, 0.05, 1.4, 1.0, 2100),
  hyd("STLH-T2-F", 0.27, 11, 0.8, 0.04, 1.4, 1.0, 2600),
  hyd("STLH-T2-G", 0.33, 11, 1.0, 0.05, 1.4, 1.0, 5300),
  hyd("BC5", 2.15, 16, 1.0, 0.03, 1.5, 1 / 1.7, 35000),
  hyd("BC5g", 2.15, 16, 1.0, 0.03, 1.5, 1 / 1.47, 35000),
  hyd("BC3", 1.63, 15, 1.0, 0.03, 1.5, 1 / 1.7, 24000),
  hyd("BC2", 1.37, 14, 1.0, 0.03, 1.5, 1 / 1.7, 20000),
  hyd("BAC", 2.15, 16, 1.0, 0.03, 1.5, 1 / 1.37, 35000),
];

export const MATERIAUX_TUNISIE = {
  bitumineux: BITUMINEUX_TUNISIE, sols: SOLS_TUNISIE, hydrauliques: HYDRAULIQUES_TUNISIE,
};

// ─────────────────────── Classes (catalogue RevA, tab. 5 / 106) ───────────────────────

// Huit classes T1..T8 indexées par NPL cumulé (millions de PL), pas par TMJA.
// classeRisque = colonne de la table de risque (fasc. 4, tab. 122).
export const CLASSES_TRAFIC_TUNISIE = [
  classeTrafic("T1", null, null, { classeRisque: "T1", provisoire: false, note: "NPL ≤ 0,1 M PL ; durée type 10 ans" }),
  classeTrafic("T2", null, null, { classeRisque: "T2", provisoire: false, note: "NPL ≤ 0,3 M PL ; durée type 10 ans" }),
  classeTrafic("T3", null, null, { classeRisque: "T3", provisoire: false, note: "NPL ≤ 1 M PL ; durée type 20 ans" }),
  classeTrafic("T4", null, null, { classeRisque: "T4", provisoire: false, note: "NPL ≤ 3 M PL ; durée type 20 ans" }),
  classeTrafic("T5", null, null, { classeRisque: "T5", provisoire: false, note: "NPL ≤ 10 M PL ; durée type 20 ans" }),
  classeTrafic("T6", null, null, { classeRisque: "T6", provisoire: false, note: "NPL ≤ 30 M PL ; durée type 30 ans" }),
  classeTrafic("T7", null, null, { classeRisque: "T7", provisoire: false, note: "NPL ≤ 50 M PL ; durée type 30 ans" }),
  classeTrafic("T8", null, null, { classeRisque: "T8", provisoire: false, note: "NPL ≤ 100 M PL ; durée type 30 ans" }),
];

/** Bornes supérieures de NPL (millions de PL) des classes T1..T8 (RevA, tab. 106). */
export const BORNES_NPL_TUNISIE = [0.1, 0.3, 1, 3, 10, 30, 50, 100];

// Portances de plate-forme (tableau 3) : module = borne inférieure de la plage.
export const CLASSES_PORTANCE_TUNISIE = [
  classePortance("PF1", 20, { note: "20-50 MPa" }),
  classePortance("PF2", 50, { note: "50-80 MPa" }),
  classePortance("PF2qs", 80, { note: "80-120 MPa" }),
  classePortance("PF3", 120, { note: "120-200 MPa" }),
  classePortance("PF4", 200, { note: ">200 MPa" }),
];

// ─────────────────────── Risque (catalogue RevA, fasc. 4, tab. 122) ───────────────────────

const COLONNES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];
//                     T1  T2  T3 | T4  T5 | T6 T7 T8
const BITUMINEUX_R = [25, 25, 25, 10, 10, 5, 5, 5];
const HYDRAULIQUE_R = [25, 25, 25, 15, 15, 5, 5, 5];

const rangee = (structure, famille, r) =>
  COLONNES.map((classe, i) => ({ structure, famille, classe, risque: r[i], provisoire: false, note: null }));

export const RISQUE_TUNISIE = catalogueRisque([
  ...rangee("souple", "bitumineux", BITUMINEUX_R),
  ...rangee("bitumineuse-epaisse", "bitumineux", BITUMINEUX_R),
  ...rangee("semi-rigide", "bitumineux", BITUMINEUX_R),
  ...rangee("semi-rigide", "hydraulique", HYDRAULIQUE_R),
  ...rangee("mixte", "bitumineux", BITUMINEUX_R),
  ...rangee("mixte", "hydraulique", HYDRAULIQUE_R),
  ...rangee("beton", "hydraulique", HYDRAULIQUE_R),
], "Catalogue RevA, Fascicule 4, Tableau 122 : risque r(%) selon le groupe de trafic "
  + "(T1-T3 / T4-T5 / ≥T6) et le type de structure.");
