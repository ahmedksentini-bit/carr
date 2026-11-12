// Trafic cumulé poids lourds à croissance géométrique, et trafic équivalent
// en essieux de référence. Mêmes formules que l'onglet Trafic de Burmister-Calc.
//
// Facteur de cumul sur n années au taux τ : C = ((1 + τ)ⁿ − 1)/τ, et C = n si
// τ = 0 (limite). NPL = MJA × 365 × C ; NE = NPL × CAM.
// Unités : MJA en PL/j/sens, taux en % par an, durées en années.

/** Facteur de cumul géométrique C(τ, n), τ en fraction. */
export function facteurCumul(taux, annees) {
  if (!(annees > 0)) return 0;
  return Math.abs(taux) < 1e-12 ? annees : ((1 + taux) ** annees - 1) / taux;
}

/** NPL cumulé d'une période unique : MJA × 365 × C(τ, n), taux en %. */
export const nplPeriodeUnique = (mja, tauxPourcent, annees) =>
  365 * mja * facteurCumul(tauxPourcent / 100, annees);

/** MJA en fin de période, qui devient la MJA de début de la suivante. */
export const mjaFinDePeriode = (mja, tauxPourcent, annees) =>
  mja * (1 + tauxPourcent / 100) ** annees;

/**
 * Cumul sur plusieurs sous-périodes [{ annees, taux (%) }] : la MJA de début de
 * chacune est déduite de la précédente (continuité du chaînage géométrique).
 */
export function multiPeriodes(mjaInitiale, periodes) {
  let mja = mjaInitiale;
  const detail = periodes.map((p, i) => {
    const C = facteurCumul(p.taux / 100, p.annees);
    const npl = 365 * mja * C;
    const fin = mjaFinDePeriode(mja, p.taux, p.annees);
    const ligne = { indice: i, mjaDebut: mja, mjaFin: fin, taux: p.taux, annees: p.annees, C, npl };
    mja = fin;
    return ligne;
  });
  return { detail, npl: detail.reduce((s, d) => s + d.npl, 0) };
}

/** NE d'une famille de matériaux : NPL × CAM. */
export const ne = (npl, cam) => npl * cam;
