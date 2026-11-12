// Profil Tunisie — catalogue de dimensionnement RevA (fascicules 1 à 5) et
// note circulaire DGPC du 4 mars 2017 (portage de TunisiaProfile de
// Burmister-Calc). Méthode rationnelle alignée sur la NF P98-086, essieu
// 130 kN, θeq = 28 °C / 20 Hz. L'archive d'août 1984 est le profil
// « tunisie1984 ».
//
// Les classes T1..T8 sont indexées par NPL cumulé, pas par TMJA : c'est la
// classe de trafic, et non le NE, qui interroge la table de risque.

import { creerProfil } from "./base.js";
import {
  MATERIAUX_TUNISIE, CLASSES_TRAFIC_TUNISIE, CLASSES_PORTANCE_TUNISIE, RISQUE_TUNISIE, BORNES_NPL_TUNISIE,
} from "./tunisie-materiaux.js";
import { CATALOGUE_TUNISIE } from "./tunisie-structures.js";
import { FICHES_TUNISIE } from "./tunisie-fiches.js";
import { subdiviserGntTunisie, validerEmploiTunisie } from "./tunisie-gnt.js";

export const tunisie = creerProfil({
  id: "tunisie",
  nom: "Tunisie — catalogue RevA (NF P98-086)",
  reference: "Catalogue de dimensionnement des structures de chaussée (Tunisie, RevA) ; "
    + "note circulaire DGPC du 4 mars 2017 ; méthode NF P98-086",
  provisoire: false,

  // Catalogue RevA, fasc. 4 §1.3.3 / tab. 115 : 28 °C, 20 Hz. La note 2017
  // proposait 20 °C (Nord / Centre) ou 23 °C (Sud) à 10 Hz.
  teqPropose: () => 28,

  materiaux: MATERIAUX_TUNISIE,

  // Catalogue RevA, fasc. 4 tab. 107 / fasc. 5 tab. 128 : CAM par famille et
  // classe de trafic. Par défaut : colonne T7-T8 et autoroutes (NPL > 30 M).
  cam: [
    { famille: "bitumineux", cam: 0.4, provisoire: false,
      note: "Catalogue RevA, Tab. 107. T1-T5 : 0,2 ; T6 : 0,3 ; T7-T8 et autoroutes : 0,4." },
    { famille: "hydraulique", cam: 0.2, provisoire: false,
      note: "Catalogue RevA, Tab. 107. Matériaux hydrauliques et bétons : 0,2 (toutes classes)." },
    { famille: "sol", cam: 0.6, provisoire: false,
      note: "Catalogue RevA, Tab. 107. T1-T4 : 0,3 ; T5 : 0,4 ; T6 : 0,5 ; T7-T8 et autoroutes : 0,6." },
  ],

  // Règle uniforme indicative ; la règle effective (catégorie, base / fondation,
  // trafic, structure inverse) est dans subdiviserGnt ci-dessous.
  subdivisionGnt: () => ({
    epMax: 0.25, rapport: 3.0, plafond: 360,
    note: "Catalogue RevA (Tab. 113-114) : GNT CG3, sous-couches de 0,25 m. Souple : base 200 MPa, "
      + "fondation k=2 bornée au module de base. Bitumineuse : fondation k=3, plafond 360 MPa. "
      + "Note 2017 (§6.1) encore proposée pour un calcul rationnel hors catalogue : K = 3 cat.1 GRH / "
      + "2,5 cat.2 GC ; base fixe 500/400 (inverse 480) si trafic ≤ T3, fondation bornée à 360 MPa si > T3.",
  }),

  /**
   * Subdivision effective des GNT (note 2017, §6.1). `contexte.classeRisque`
   * (ou `contexte.classeTrafic`) : classe T1..T8 du projet.
   */
  subdiviserGnt(couches, contexte = {}) {
    const r = subdiviserGntTunisie(couches, contexte.classeRisque ?? contexte.classeTrafic ?? null);
    return { couches: r.couches, alertes: r.alertes };
  },

  classesTrafic: CLASSES_TRAFIC_TUNISIE,
  classesPortance: CLASSES_PORTANCE_TUNISIE,
  risque: RISQUE_TUNISIE,
  catalogue: CATALOGUE_TUNISIE,

  // Le fascicule 6 publie ses propres neuf cases (tab. 5, p. 332) : 360 MPa au
  // mieux contre 600 pour le Cerema, 120 au pire contre 200.
  plafondGnt: "tunisie-fascicule6",

  /** Le risque tunisien s'interroge par la classe de trafic T1..T8 retenue. */
  libelleClasseRisque: (classeTrafic) => classeTrafic?.classeRisque ?? null,

  /** Classe T1..T8 contenant le NPL cumulé (millions de PL), bornes hautes du tab. 106 ; null au-delà de 100 M. */
  classerNpl(nplMillions) {
    const i = BORNES_NPL_TUNISIE.findIndex((b) => nplMillions <= b);
    return i < 0 ? null : CLASSES_TRAFIC_TUNISIE[i] ?? null;
  },

  glossaire: [
    { code: "BBSG", nom: "Béton bitumineux semi-grenu (cl. 2/3)",
      emploi: "Roulement / liaison. E(28 °C)=2930 MPa, ν=0,45. Ép. 6 cm (T1-T4) ou 8-14 cm (trafic fort)." },
    { code: "GB2 / GB3", nom: "Grave-bitume classe 2 / 3",
      emploi: "Assise bitumineuse. E(28 °C,20 Hz)=4170 MPa, ε6=80/90. Fondation GNT : CG3, k=3, plafond 360 MPa." },
    { code: "EME2", nom: "Enrobé à module élevé classe 2",
      emploi: "Assise. E(28 °C,20 Hz)=8650 MPa, ε6=130. Plate-forme minimale PF2qs." },
    { code: "GNT (CG3)", nom: "Grave non traitée, classe CG3",
      emploi: "Souple : base 200 MPa, fondation k=2. Bitumineuse : fondation k=3, plafond 360 MPa (RevA Tab. 113-114)." },
    { code: "GCt3", nom: "Grave-ciment classe t3",
      emploi: "MTLH. E=23000 MPa, σ6=0,75 MPa. Épaisseurs catalogue majorées de 4 cm (surcharges)." },
    { code: "STLH T1/T2", nom: "Sol traité aux liants hydrauliques",
      emploi: "Fins T1/T2 : 1600/2600 MPa ; graveleux T1/T2 : 2100/5300 MPa. Base ≤ T2, fondation ≤ T4." },
    { code: "BC5 / BC5g / BAC", nom: "Béton de ciment",
      emploi: "BC5 E=35000 MPa ; BC5g goujonné (kd=1/1,47) ; BAC (kd=1/1,37). Fondation BC2/BC3/GCt3/STLH." },
    { code: "GRH / GC (note 2017)", nom: "GNT cat.1 / cat.2",
      emploi: "Note 2017 : cat.1 GRH base 500 MPa (×3) ; cat.2 GC 400 MPa (×2,5). Seule la cat.1 est admise sous une GB." },
  ],

  fiches: FICHES_TUNISIE,

  /** Sous une grave-bitume, seule la GNT catégorie 1 (GRH) est autorisée. */
  validerEmploi: (couches) => validerEmploiTunisie(couches),
});

export default tunisie;
