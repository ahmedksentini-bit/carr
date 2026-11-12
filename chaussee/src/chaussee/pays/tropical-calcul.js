// Barèmes DÉTERMINISTES du guide CEBTP 1980 (pays tropicaux), portage de
// TropicalDesign :
//  - traction admissible (bar) en base des couches liées, donnée en
//    FOURCHETTES par famille de matériau (p. 137-138) : enrobés 10-15,
//    grave-bitume 7-10, sols-bitume 2,5-3,5, grave-ciment 5-7,5,
//    graveleux-ciment 2-3, sols-ciment 2,5-3,5. Valeur retenue = milieu de
//    fourchette (la fourchette est rappelée dans la justification) ;
//  - compression admissible (bar) en tête de plate-forme par la formule de
//    Kerkhoven-Dormon : σz,adm = 0,3 × CBR / (1 + 0,7 log10 N) [kg/cm² ≈ bar],
//    N = nombre d'essieux équivalents.

import { verifierDeterministe, nplDe } from "./base.js";
import { nombre } from "./commun.js";

export const METHODE_CEBTP_1980 = "CEBTP 1980";

/** NE global du projet (NPL × CAM global), comme DesignParameters.NE. */
export const neGlobal = (p) => nplDe(p) * (p.cam ?? 1);

/** Fourchettes de σt admissible (bar) par clé matériau du catalogue tropical. */
export const TRACTION_CEBTP_1980 = {
  revetement: [10, 15],                                        // enrobés
  GB: [7, 10],                                                 // grave-bitume
  SB: [2.5, 3.5], CORB: [2.5, 3.5], BANB: [2.5, 3.5],          // sols-bitume
  GC: [5, 7.5],                                                // grave-ciment
  GAC: [2, 3],                                                 // graveleux ciment
  LATC: [2.5, 3.5], SAC: [2.5, 3.5], BS: [2.5, 3.5],           // sols-ciment
  BANC: [2.5, 3.5], CORC: [2.5, 3.5], SCC: [2.5, 3.5],
  SGC: [2.5, 3.5], MIXC: [2.5, 3.5],
  SCH: [2, 3],                                                 // sol-chaux (≈ graveleux ciment)
};

/** CBR représentatif de chaque classe de portance (médiane de la plage S1-S5). */
export const CBR_REPRESENTATIF = { S1: 3, S2: 7, S3: 12, S4: 22, S5: 40 };
export const cbrRepresentatif = (classe) => CBR_REPRESENTATIF[classe] ?? 3;

/** σz,adm de Kerkhoven-Dormon (bar) ; N borné à 10 pour éviter log10(N ≤ 0). */
export function kerkhovenDormon(cbr, ne) {
  const n = Math.max(ne, 10);
  return { bar: (0.3 * cbr) / (1 + 0.7 * Math.log10(n)), n };
}

export const REGLES_CEBTP_1980 = {
  methode: METHODE_CEBTP_1980,

  tractionBar(i, couche) {
    const cle = couche.materiau;
    if (cle == null || !Object.hasOwn(TRACTION_CEBTP_1980, cle)) return null;
    const [min, max] = TRACTION_CEBTP_1980[cle];
    const mid = (min + max) / 2;
    return { bar: mid,
      note: `CEBTP : ${cle} en base, σt admissible ${nombre(min)}-${nombre(max)} bar (valeur retenue ${nombre(mid)}).` };
  },

  compressionBar(p) {
    const cbr = cbrRepresentatif(p.classePortance);
    const { bar, n } = kerkhovenDormon(cbr, neGlobal(p));
    return { bar,
      note: `Kerkhoven-Dormon : σz,adm = 0,3 CBR / (1 + 0,7 log N) = ${nombre(bar, 3)} bar `
        + `(CBR ${nombre(cbr, 1)}, N = ${Math.round(n)} essieux).` };
  },
};

/** Vérification par contraintes admissibles (bar) du guide CEBTP 1980 (chaussée neuve). */
export const verifierCebtp1980 = (couches, analyse, p) => verifierDeterministe(couches, analyse, p, REGLES_CEBTP_1980);
