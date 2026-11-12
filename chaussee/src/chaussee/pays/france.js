// Profil France — NF P98-086 (2011), méthode rationnelle LCPC-SETRA (portage
// de FranceProfile de Burmister-Calc). C'est le profil de référence, validé
// par les cas Alizé.
//
// Deux échelles de trafic coexistent en France et ne se convertissent pas
// l'une en l'autre par une simple table :
//  - les classes de DÉBIT JOURNALIER t4- à tex+ du manuel Scetauroute 2005
//    (poids lourd > 50 kN de charge utile, croissance géométrique 2 %), qui
//    indexent ses structures d'autoroutes concédées ;
//  - les classes TCi de trafic CUMULÉ du catalogue national de 1998 (poids
//    lourd > 35 kN de PTAC, croissance linéaire), qui indexent ses 52 fiches.
// Le catalogue du profil est celui de 1998 ; les structures Scetauroute
// restent accessibles par `catalogueScetauroute`.

import { creerProfil, classeTrafic, classePortance, classeNe } from "./base.js";
import { FICHES_FRANCE } from "./france-fiches.js";
import { subdiviserGntFrance, NOTE_GNT_FRANCE, EP_SOUS_COUCHE } from "./france-gnt.js";
import {
  CATALOGUE_1998, poidsLourdsCumules, classer, dureeDimensionnement, tauxCroissanceCatalogue,
} from "./france-catalogue1998.js";
import { CATALOGUE_SCETAUROUTE } from "./scetauroute.js";

/** Nombre au format français (virgule décimale), au plus `decimales` chiffres après la virgule. */
const nombreFr = (x, decimales = 2) =>
  String(Number(x.toFixed(decimales))).replace(".", ",");

export const france = creerProfil({
  id: "france",
  nom: "France — NF P98-086 (2011)",
  reference: "NF P98-086 (2011), guide technique LCPC-SETRA 1994, catalogue SETRA-LCPC des structures "
    + "types de chaussées neuves (1998)",
  provisoire: false,

  teqPropose: () => 15,

  // CAM pour l'essieu de référence de 130 kN, tableau 6 du catalogue de 1998,
  // colonne VRS. Points de départ éditables : sur réseau non structurant le même
  // tableau donne des valeurs plus basses (0,5 au lieu de 0,8 en bitumineux).
  cam: [
    { famille: "bitumineux", cam: 0.8, provisoire: false,
      note: "Catalogue 1998, tab. 6 : chaussées bitumineuses épaisses (et GB3/GNT, inverses) sur "
        + "voie du réseau structurant. Sur réseau non structurant : 0,5." },
    { famille: "hydraulique", cam: 1.3, provisoire: false,
      note: "Catalogue 1998, tab. 6 : assises traitées aux liants hydrauliques et chaussées béton, "
        + "voie du réseau structurant. Sur réseau non structurant : 0,8. Structures mixtes : "
        + "1,2 (VRS) ou 0,75 (VRNS)." },
    { famille: "sol", cam: 1.0, provisoire: false,
      note: "Critère de déformation verticale sur la plate-forme. Le catalogue 1998 lui donne un "
        + "CAM propre (tab. 10) : 0,5 sous TC2, 0,75 sous TC3, 1 à partir de TC4 — il ne "
        + "vient pas des stations de comptage mais de constatations sur le comportement." },
  ],

  // Règle indicative (affichée, et rapport > 1 pour activer « Subdiviser les GNT ») ; la règle
  // effective du tableau F.1 (trafic, base / fondation, catégorie, inverse) est dans subdiviserGnt.
  subdivisionGnt: () => ({ epMax: EP_SOUS_COUCHE, rapport: 3, plafond: 600, note: NOTE_GNT_FRANCE }),
  subdiviserGnt: (couches, contexte = {}) => subdiviserGntFrance(couches, contexte.mja),

  // Classes hautes du manuel Scetauroute 2005 (échelle CU ≥ 50 kN) : bornes
  // inférieures de TMJA PL sur la voie la plus chargée, [min, max[.
  classesTrafic: [
    classeTrafic("t4-", 50, 85),
    classeTrafic("t3-", 85, 150),
    classeTrafic("t3+", 150, 200),
    classeTrafic("t2-", 200, 300),
    classeTrafic("t2+", 300, 500),
    classeTrafic("t1-", 500, 750),
    classeTrafic("t1+", 750, 1200),
    classeTrafic("t0-", 1200, 2000),
    classeTrafic("t0+", 2000, 3000),
    classeTrafic("ts-", 3000, 5000),
    classeTrafic("ts+", 5000, 7500),
    classeTrafic("tex-", 7500, 12000),
    classeTrafic("tex+", 12000, null),
  ],

  // Classes de plate-forme NF P98-086 (module de dimensionnement à long terme).
  classesPortance: [
    classePortance("PF1", 20, { cbrMin: null, note: "20 ≤ E < 50 MPa" }),
    classePortance("PF2", 50, { cbrMin: null, note: "50 ≤ E < 80 MPa" }),
    classePortance("PF2qs", 80, { cbrMin: null, note: "80 ≤ E < 120 MPa" }),
    classePortance("PF3", 120, { cbrMin: null, note: "120 ≤ E < 200 MPa" }),
    classePortance("PF4", 200, { cbrMin: null, note: "≥ 200 MPa" }),
  ],

  fiches: FICHES_FRANCE,

  /** Les 52 fiches du catalogue national de 1998, indexées par classe TCi cumulée. */
  catalogue: CATALOGUE_1998,

  /** Les structures-types du manuel Scetauroute (autoroutes concédées, échelle t4- à tex+). */
  catalogueScetauroute: CATALOGUE_SCETAUROUTE,

  /**
   * Classe TCi du projet : poids lourds cumulés sur la voie la plus chargée,
   * comparés aux bornes du tableau 1 du catalogue. Le cumul se calcule ICI, en
   * croissance LINÉAIRE et sur la durée du réseau (30 ans VRS, 20 ans VRNS),
   * et non à partir du NPL géométrique du projet ni de sa durée de service :
   * les fiches ont été calculées ainsi. Renvoie une classe de NE
   * { nom, min: null, max: borne (millions de PL), note }.
   */
  classerTraficCumule(p) {
    const reseau = p.reseauStructurant ? "vrs" : "vrns";
    const taux = p.taux ?? tauxCroissanceCatalogue(reseau);
    const millions = poidsLourdsCumules(p.mja, reseau, taux) / 1e6;
    const tc = classer(millions, reseau);
    return classeNe(tc.nom, null, tc.borneSuperieure,
      `${nombreFr(millions)} millions de poids lourds cumulés sur ${dureeDimensionnement(reseau)} ans, `
      + `croissance linéaire de ${nombreFr(taux, 1)} %/an (catalogue 1998, tableau 1).`);
  },
});

export default france;
