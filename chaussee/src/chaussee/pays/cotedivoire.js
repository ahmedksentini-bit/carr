// Profil Côte d'Ivoire : manuel LBTP avril 2024 (chaussées neuves des routes
// interurbaines), méthode rationnelle type NF P98-086, θeq 32 °C / 20 Hz,
// essieu 130 kN (portage de CoteDIvoireProfile). Le catalogue LBTP 1977 reste
// disponible à part (cotedivoire1977.js). Le manuel renvoie au GTR France en
// attendant un GTR ivoirien.

import { creerProfil, nplDe, camDe } from "./base.js";
import {
  BITUMINEUX, SOLS, HYDRAULIQUES, CLASSES_TRAFIC, CLASSES_NE, CLASSES_PORTANCE, RISQUE, GLOSSAIRE,
} from "./cotedivoire-materiaux.js";
import { CATALOGUE } from "./cotedivoire-structures.js";
import { FICHES } from "./cotedivoire-fiches.js";
import { subdiviserGntCi2024 } from "./cotedivoire-regles.js";

import { ajusterLbtp2024 } from "./regles-verification.js";
/**
 * NE cumulé en millions d'essieux de 130 kN, au CAM le PLUS ÉLEVÉ des familles :
 * le manuel définit le CAM « pour la route et la technique de chaussée
 * considérée », la classe doit donc couvrir la technique la plus sollicitée.
 * Avec les CAM par défaut du pays, tous à 1, cela revient à NE = NPL.
 */
export function neCumuleMillions(p, profil = cotedivoire) {
  let cam = 0;
  for (const c of profil.cam) cam = Math.max(cam, camDe(p, c.famille, profil));
  return (nplDe(p) * cam) / 1e6;
}

export const cotedivoire = creerProfil({
  // Règle de vérification propre au référentiel (pays/regles-verification.js).
  ajusterVerification: ajusterLbtp2024,
  id: "cotedivoire",
  nom: "Côte d'Ivoire — manuel LBTP 2024 (catalogue)",
  reference: "Manuel pour la conception et le dimensionnement des chaussées neuves des routes interurbaines, LBTP, avril 2024",
  provisoire: true,
  noteProvisoire:
    "Manuel officiel avril 2024, méthode rationnelle. Teq 32 °C / 20 Hz et kc (GB 1,3, EME2 1) "
    + "sont provisoires (mesures CI à venir). Croissance trafic par défaut linéaire 5 % (Fasc. 3), "
    + "CAM 1 (routes nationales) ou 1,5 (autoroutes / UEMOA / >200 PL/j/sens). "
    + "Pas de catalogue de renforcement (guide 1980 à actualiser). "
    + "Le catalogue 1977 reste sélectionnable à part.",

  // Le manuel 2024 ne traite pas le renforcement : aucun barème de modules résiduels ne
  // lui appartient, et il vaut mieux le dire que d'emprunter celui d'un autre pays.
  modulesResiduels: "aucun",

  teqPropose: () => 32,
  materiaux: { bitumineux: BITUMINEUX, sols: SOLS, hydrauliques: HYDRAULIQUES },

  cam: [
    { famille: "bitumineux", cam: 1.0, provisoire: true,
      note: "Fasc. 3 tab. 3 : CAM = 1 (routes nationales) ou 1,5 (autoroutes / UEMOA / >200 PL/j/sens). Préférer un CAM de projet." },
    { famille: "hydraulique", cam: 1.0, provisoire: true,
      note: "Pas de MTLH semi-rigide dans le catalogue 2024 (matériaux améliorés au ciment = comportement souple)." },
    { famille: "sol", cam: 1.0, provisoire: true,
      note: "Critère εz, A = 0,020 (assise non traitée / améliorée ciment) ou 0,016–0,013 (assise bitumineuse)." },
  ],

  subdivisionGnt: () => ({
    epMax: 0.25, rapport: 2.5, plafond: 400,
    note: "CI 2024 §8.5 : sous-couches ≤ 25 cm. GNT k=2,5 Emax=400 ; GLn/SAn k=2 Emax=300 ; "
      + "Q1 k=2,5 Emax=450 ; Q2 E=1000 MPa fixe.",
  }),
  subdiviserGnt: (couches) => subdiviserGntCi2024(couches),

  classesTrafic: CLASSES_TRAFIC,
  classesNe: CLASSES_NE,
  classesPortance: CLASSES_PORTANCE,
  risque: RISQUE,
  catalogue: CATALOGUE,

  /**
   * Fasc. 1 tableau 5 : les classes TC1⁻…TC6⁺ sont tabulées en NE (essieux
   * équivalents de 130 kN, 0,07 à 50 millions), NE = CAM × NPL. Ni la TMJA ni
   * le NPL ne les indexent : les douze classes ont des bornes de TMJA nulles.
   */
  classerTraficDe: (p) => cotedivoire.classeTraficNommee(cotedivoire.classerNe(neCumuleMillions(p))?.nom ?? null),

  /** Colonne de risque : les trois premiers caractères de la classe de NE (« TC2 »). */
  libelleClasseRisque(classeTrafic, neMillions) {
    const ne = cotedivoire.classerNe(neMillions)?.nom;
    if (ne && ne.length >= 3) return ne.slice(0, 3);
    return classeTrafic?.classeRisque ?? null;
  },

  glossaire: GLOSSAIRE,
  fiches: FICHES,

  conseilStructure: (intervention) => (intervention === "renforcement" || intervention === "hybride"
    ? "Le manuel 2024 ne couvre que les chaussées neuves. Le guide de renforcement 1980 "
      + "n'est pas encore actualisé. Passer par le rétrocalcul, puis dimensionner l'apport "
      + "(itérateur d'épaisseur) ; le catalogue 1977 reste en archive."
    : "Chaussée neuve : choisir la région R1–R7 (ressources), la PPF (module long terme) "
      + "et la classe TC (NE 130 kN). PPF1 interdite ; PPF3 mini pour TC4 et plus."),
});

export default cotedivoire;
