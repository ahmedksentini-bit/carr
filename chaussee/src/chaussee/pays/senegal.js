// Profil Sénégal : catalogue des structures de chaussées neuves (Ageroute,
// novembre 2015), méthode rationnelle NF P98-086 / Alizé (portage de
// SenegalProfile). Paramètres calés sur le catalogue : θeq = 34 °C / 20 Hz,
// classes de NE C1..C8 pour le catalogue et le risque, subdivision propre des
// GNT, règles d'emploi des matériaux d'assise, chaîne de plate-forme.

import { creerProfil, dansClasseNe } from "./base.js";
import {
  BITUMINEUX, SOLS, HYDRAULIQUES, CLASSES_TRAFIC, CLASSES_NE, CLASSES_PORTANCE, RISQUE, GLOSSAIRE,
} from "./senegal-materiaux.js";
import { CATALOGUE } from "./senegal-structures.js";
import { FICHES } from "./senegal-fiches.js";
import { PLATEFORME_SENEGAL } from "./senegal-plateforme.js";
import { subdiviserGntSenegal, validerEmploiSenegal } from "./senegal-regles.js";

import { ajusterSenegal } from "./regles-verification.js";
/** Classe de NE cumulé (millions) qui porte le risque du tableau 70, ou null. */
const classeNeDe = (neMillions) => CLASSES_NE.find((c) => dansClasseNe(c, neMillions)) ?? null;

export const senegal = creerProfil({
  // Règle de vérification propre au référentiel (pays/regles-verification.js).
  ajusterVerification: ajusterSenegal,
  id: "senegal",
  nom: "Sénégal — catalogue Ageroute 2015 (NF P98-086)",
  reference: "Catalogue des structures de chaussées neuves du Sénégal (Ageroute), novembre 2015 ; NF P98-086 / Alizé",
  provisoire: false,

  // Guide AGEROUTE VFP 2023, tableaux 4 et 6 : état de dégradation, rôle, température.
  modulesResiduels: "senegal",

  // Température équivalente 34 °C à 20 Hz (annexe H : instrumentation Dakar / Kaolack).
  // Coefficient de Poisson des enrobés pris à 0,45 dans le catalogue (34 °C / 20 Hz).
  teqPropose: () => 34,

  materiaux: { bitumineux: BITUMINEUX, sols: SOLS, hydrauliques: HYDRAULIQUES },

  // Le catalogue ne tabule PAS de CAM par type de PL : il impose un calcul de projet à
  // partir d'une campagne de pesage (annexe G : A = K × (P/130)^α, α = 5 souple /
  // bitumineux, 11 grave-latérite-ciment, 12 semi-rigide / béton). Valeurs d'ordre de
  // grandeur (exemple du catalogue), à confirmer.
  cam: [
    { famille: "bitumineux", cam: 0.9, provisoire: true,
      note: "Sénégal : CAM calculé par A = K x (P/130)^alpha, alpha = 5 (souple/bitumineux). "
        + "Exemple catalogue ~0,90. À caler par une campagne de pesage." },
    { famille: "hydraulique", cam: 1.3, provisoire: true,
      note: "Sénégal : CAM calculé (alpha = 11 GLc à 12 semi-rigide/béton) ; l'exemple du catalogue "
        + "donne ~10-11 pour ces matériaux. À caler par une campagne de pesage." },
    { famille: "sol", cam: 1.0, provisoire: true,
      note: "Sénégal : sol / GNT (critère de déformation verticale). À caler par pesage." },
  ],

  // Catalogue 2015 (p. 79-80 / 126) : deux familles de GNT. GNT concassée → base 600 MPa,
  // fondation en sous-couches ≤ 25 cm, ×3, plafond 600 (GNT/GNT) ou 360 (GNT/GB).
  // Latérite → ×2, plafond = module de base (GL1 200, GL2/GLi/GLa 400).
  subdivisionGnt: () => ({
    epMax: 0.25, rapport: 3, plafond: 600,
    note: "Catalogue Sénégal 2015 — sous-couches GNT ≤ 25 cm, E_i = K x E_(i-1) de bas en haut. "
      + "GNT concassée : base 600 MPa, fondation x3 plafonnée à 600 MPa (GNT/GNT) ou 360 MPa (GNT/GB). "
      + "Latérite : x2, plafonnée au module de base (GL1 200 MPa ; GL2/GLi/GLa 400 MPa).",
  }),
  // Règle concrète : distingue GNT concassée (×3, 600/360) et latérite (×2, 200/400).
  subdiviserGnt: (couches) => subdiviserGntSenegal(couches),

  classesTrafic: CLASSES_TRAFIC,
  classesNe: CLASSES_NE,
  classesPortance: CLASSES_PORTANCE,
  risque: RISQUE,
  catalogue: CATALOGUE,
  plateforme: PLATEFORME_SENEGAL,

  // Le risque sénégalais dépend de la classe de NE atteinte (C1-C4 = 25 %, C5-C8 = 5 %).
  libelleClasseRisque: (classeTrafic, neMillions) => classeNeDe(neMillions)?.nom ?? null,

  glossaire: GLOSSAIRE,
  fiches: FICHES,

  // Emploi des matériaux d'assise selon le trafic (base / fondation), catalogue 2015.
  validerEmploi: (couches, nomClasseTrafic) => validerEmploiSenegal(couches, nomClasseTrafic),
});

export default senegal;
