// Profil Tunisie 1984 — catalogue de structures types pour chaussées neuves et
// renforcement (SETIC International / SCI-UTIFC-SOTINFOR, Direction des Ponts
// et Chaussées, août 1984), conservé en archive (portage de Tunisia1984Profile
// et de Tunisia1984Materials de Burmister-Calc). Le profil courant est
// « tunisie » (catalogue RevA + note 2017).
//
// Méthode d'époque : fiches T×S (neuf) et T×C (renforcement), indice de
// structure SN de type AASHTO (tunisie1984-indice.js). Pas de loi de fatigue
// NF : ε6 / σ6 / A valent NaN, la vérification rationnelle déclare donc ses
// critères non applicables. Les modules sont indicatifs (injection).

import { creerProfil, classeTrafic, classePortance } from "./base.js";
import { CATALOGUE_TUNISIE_1984 } from "./tunisie1984-structures.js";
import { CATALOGUE_RENFORCEMENT_1984 } from "./tunisie1984-indice.js";
import { FICHES_TUNISIE_1984 } from "./tunisie1984-fiches.js";

const NOTE_BIT = "Catalogue Tunisie 1984 : module indicatif (injection), méthode SN / fiches. Pas de fatigue NF.";

const bit = (cle, E) => ({ cle, famille: "bitumineux", E10: E, eps6: NaN, b: -1 / 5, SN: 0.3, kc: 1.0,
  tableE: null, nu: 0.35, note: NOTE_BIT, moduleImpose: E });
const gran = (cle, E) => ({ cle, famille: "sol", E, Afaible: NaN, Afort: NaN, pente: -0.222, nu: 0.35 });
const hyd = (cle, E) => ({ cle, famille: "hydraulique", sigma6: NaN, b: -1 / 15, SN: 1.0, Sh: 0.03, kc: 1.4,
  kd: 1.0, nu: 0.25, E });

/** Bibliothèque 1984 : modules indicatifs calés sur les ordres de grandeur CEBTP / LBTP 1977. */
export const MATERIAUX_TUNISIE_1984 = {
  bitumineux: [bit("BB", 3000), bit("GB", 4000), bit("BC", 2000), bit("MC", 1500)],
  sols: [gran("GR", 300), gran("GRH", 300), gran("G", 250), gran("T", 200), gran("SG", 150)],
  hydrauliques: [hyd("GC", 8000), hyd("GLY", 4000), hyd("GLX", 4000), hyd("SCLY", 2000), hyd("SCLX", 2000)],
};

export const tunisie1984 = creerProfil({
  id: "tunisie1984",
  nom: "Tunisie — catalogue 1984 (archive)",
  reference: "Catalogue de structures types pour chaussées neuves et renforcement, SETIC / DPC, août 1984 "
    + "(étude de l'entretien routier ; couvertures aussi datées 1983)",
  provisoire: true,
  noteProvisoire:
    "Archive août 1984 : catalogue déterministe (fiches T×S neuves, T×C renforcement) + indice de "
    + "structure SN type AASHTO (ai, ΔSN(CBR)). T1 = trafic le plus lourd (600-1200 PL/j voie), T5 = "
    + "le plus léger. S4 = sol le plus portant (CBR > 20) ; S0 hors catalogue. C1-C5 = qualité résiduelle "
    + "de la chaussée existante. Routes de rase campagne seulement (hors autoroute / zones urbaines "
    + "industrielles). Renforcement limité aux chaussées souples traditionnelles. Pas de loi ε6/σ6 NF, "
    + "pas de Teq unique. Modules d'injection indicatifs. Onglet Sol : saisie directe (le barème 1984 "
    + "n'est pas branché sur le module Sol).",

  teqPropose: () => 28,

  materiaux: MATERIAUX_TUNISIE_1984,

  cam: [
    { famille: "bitumineux", cam: 0.36, provisoire: true,
      note: "1984 : 1 PL ≈ 0,36 essieu 13 t (ou 2,4 essieux 8,15 t). CAM indicatif, non tabulé NF." },
    { famille: "hydraulique", cam: 0.36, provisoire: true,
      note: "1984 : équivalence PL → essieu 13 t (campagne de pesage mars 1983), pas de CAM NF." },
    { famille: "sol", cam: 0.36, provisoire: true,
      note: "1984 : même équivalence PL. Dimensionnement par fiches, pas par CAM." },
  ],

  // Pas de subdivision NF : la règle neutre conserve les modules saisis.
  subdivisionGnt: () => ({
    epMax: Infinity, rapport: 1, plafond: Infinity,
    note: "Catalogue 1984, Tableau X : max 30 cm par couche de grave ; mini 15/10/25 cm selon "
      + "emploi (couche unique / base-renfort / fondation sur mauvais sol). Pas de subdivision NF.",
  }),

  // Le catalogue de 1984 ne publie pas de plafond pour les GNT en place : c'est
  // le fascicule 6 du catalogue tunisien courant qui s'applique.
  plafondGnt: "tunisie-fascicule6",

  // T1 = trafic le plus LOURD (inverse des catalogues tropicaux). Bornes : PL/j
  // sur la voie la plus chargée à la mise en service (fiches sur 15 ans, ~6-8 %).
  classesTrafic: [
    classeTrafic("T5", 0, 50, { classeRisque: "T5", provisoire: true,
      note: "Léger : < 50 PL/j voie chargée (TMJA 2 sens < 650)." }),
    classeTrafic("T4", 50, 150, { classeRisque: "T4", provisoire: true,
      note: "50-150 PL/j voie chargée (TMJA 2 sens 650-1650)." }),
    classeTrafic("T3", 150, 300, { classeRisque: "T3", provisoire: true,
      note: "150-300 PL/j voie chargée (TMJA 2 sens 1650-3300)." }),
    classeTrafic("T2", 300, 600, { classeRisque: "T2", provisoire: true,
      note: "300-600 PL/j voie chargée (TMJA 2 sens 3300-7200)." }),
    classeTrafic("T1", 600, 1201, { classeRisque: "T1", provisoire: true,
      note: "Lourd : 600-1200 PL/j voie chargée (TMJA 2 sens 7200-14400). Au-delà : hors catalogue (autoroutier)." }),
  ],

  // S1-S4 = sol support (CBR). Le renforcement s'indexe à part par C1-C5.
  classesPortance: [
    classePortance("S1", 35, { cbrMin: 5, provisoire: true, note: "CBR caractéristique 5-8. Sol faible. S0 (CBR < 5) hors catalogue." }),
    classePortance("S2", 50, { cbrMin: 8, provisoire: true, note: "CBR 8-12." }),
    classePortance("S3", 80, { cbrMin: 12, provisoire: true, note: "CBR 12-20." }),
    classePortance("S4", 150, { cbrMin: 20, provisoire: true, note: "CBR > 20. Sol le plus portant." }),
  ],

  catalogue: CATALOGUE_TUNISIE_1984,
  catalogueRenforcement: CATALOGUE_RENFORCEMENT_1984,
  fiches: FICHES_TUNISIE_1984,

  glossaire: [
    { code: "GR / GRH", nom: "Grave concassée reconstituée (humidifiée)",
      emploi: "Base et/ou fondation neuve ; renforcement T2. Fiches 1 (neuf) et 1 (renfort)." },
    { code: "G", nom: "Grave concassée / tout-venant de concassage 0/31,5-0/40",
      emploi: "Fondation (et base fiche 3). +15 % de fondation si grave naturelle (fiche 2). +10 % si 0/40 IC < 50 % (fiche 6)." },
    { code: "T", nom: "Encroûtement calcaire (tuf compact)",
      emploi: "Région C surtout. Fiches 4 et 7 (neuf), fiche 2 (renfort)." },
    { code: "SG", nom: "Sable gypseux",
      emploi: "Région C, fiche 5 neuve (T5). Fondation seulement au Tableau IX.B." },
    { code: "GB", nom: "Grave-bitume", emploi: "Base fiches 6-7 ; renforcement fiche 3." },
    { code: "GC", nom: "Grave-ciment", emploi: "Base fiche 8 (T1-T2). Pas de fiche de renforcement GC." },
    { code: "GLY / GLX", nom: "Grave laitier gypsonat / chaux",
      emploi: "Base fiche 9 ; renfort fiche 4. Épaisseurs tabulées = GLY ; GLX : +10 %." },
    { code: "SCLY / SCLX", nom: "Sable concassé laitier gypsonat / chaux 0/6",
      emploi: "Base fiche 10. Épaisseurs = SCLY ; SCLX : +10 %." },
    { code: "BB / BC / MC", nom: "Béton bitumineux / bicouche / monocouche",
      emploi: "Roulement. BC et MC : épaisseur d'enduit non chiffrée au catalogue (1 cm MC / 2 cm BC, convention)." },
  ],

  conseilStructure: (intervention) => (intervention === "renforcement" || intervention === "hybride"
    ? "Renforcement 1984 : fiches C1-C5 × T1-T4 sur chaussée souple existante. "
      + "La classe C se détermine ici (coupe Tab. VI-VII et/ou SN̄ = Σ(aᵢ·hᵢ)/2,54 + ΔSN). "
      + "Décrire l'existant dans la grille puis calculer SN̄ avant d'injecter l'overlay. "
      + "Caler les modules de l'existant par rétrocalcul."
    : "Chaussée neuve 1984 : fiches T1-T5 × S1-S4. T1 = lourd. Les cellules « voir fiches… » "
      + "ne sont pas recopiées : ouvrir la fiche indiquée. S0 (CBR < 5) exige une couche de forme."),
});

export default tunisie1984;
