// Barèmes DÉTERMINISTES du catalogue LBTP Côte d'Ivoire 1977 (portage de
// CoteDIvoireDesign) :
//  - traction admissible (bar) en base des couches liées, par matériau et
//    classe de trafic (tableau VII, p-025) ;
//  - compression admissible (bar) en tête de plate-forme, par classe de
//    portance (tableau V, p-022 : S1 0,28 / S2 0,56 / S3 0,70 / S4 1,10 / S5 2,30).
// La vérification compare les sollicitations du modèle de Burmister à ces
// valeurs (base.js, verifierDeterministe).

import { verifierDeterministe } from "./base.js";
import { nombre, rangTrafic } from "./commun.js";

export const METHODE_LBTP_1977 = "LBTP 1977";

/** Tableau VII : σt admissible (bar) par clé matériau et classe de trafic. */
export const TRACTION_LBTP_1977 = {
  revetement: [["T1", 15.0], ["T2", 12.0], ["T3", 10.0]],   // roulement enrobés (struct. 1, 3, 6)
  GB: [["T3", 10.0], ["T4", 8.5], ["T5", 7.0]],             // grave-bitume (5, 8, 13, 14, 16)
  sB: [["T1", 3.5], ["T2", 3.0], ["T3", 2.5]],              // sable-bitume (10)
  GC: [["T3", 7.5], ["T4", 6.5], ["T5", 5.0]],              // grave-ciment (4, 7, 12, 15)
  gC: [["T1", 3.0], ["T2", 2.5], ["T3", 2.0]],              // graveleux-ciment (2)
  sC: [["T1", 3.75], ["T2", 3.0], ["T3", 2.5]],             // sable-ciment (9, 11)
};

/** Tableau V : σz admissible (bar) en tête de plate-forme par classe de portance. */
export const COMPRESSION_LBTP_1977 = { S1: 0.28, S2: 0.56, S3: 0.70, S4: 1.10, S5: 2.30 };

/** Valeur de la classe de trafic ; hors plage, bornée aux extrémités de la table. */
export function choisirParTrafic(table, trafic) {
  const e = table.find(([t]) => t === trafic);
  if (e) return e;
  const r = rangTrafic(trafic);
  if (r !== 0 && r < rangTrafic(table[0][0])) return table[0];
  if (r !== 0 && r > rangTrafic(table[table.length - 1][0])) return table[table.length - 1];
  return table[0];
}

export const REGLES_LBTP_1977 = {
  methode: METHODE_LBTP_1977,

  tractionBar(i, couche, couches, p) {
    const cle = couche.materiau;
    if (cle == null || !Object.hasOwn(TRACTION_LBTP_1977, cle)) return null;
    const [tc, bar] = choisirParTrafic(TRACTION_LBTP_1977[cle], p.classeTrafic);
    return { bar, note: `Tableau VII LBTP : ${cle} en base, σt admissible = ${nombre(bar)} bar (trafic ${tc}).` };
  },

  compressionBar(p) {
    const s = p.classePortance ?? "";
    if (Object.hasOwn(COMPRESSION_LBTP_1977, s)) {
      const bar = COMPRESSION_LBTP_1977[s];
      return { bar, note: `Tableau V LBTP : plate-forme ${s}, σz admissible = ${nombre(bar)} bar.` };
    }
    return { bar: 0.28, note: "Tableau V LBTP : portance non renseignée, valeur S1 (0,28 bar) retenue par défaut." };
  },
};

/** Vérification par contraintes admissibles (bar) du catalogue LBTP 1977. */
export const verifierLbtp1977 = (couches, analyse, p) => verifierDeterministe(couches, analyse, p, REGLES_LBTP_1977);
