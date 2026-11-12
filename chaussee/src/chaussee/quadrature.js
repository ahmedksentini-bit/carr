// Schéma d'intégration de Gauss-Legendre du noyau NOYAU5 d'Alizé, repris de
// Burmister-Calc :
//  · premier cycle 0 → 5,52 (en unités de ξ·a) découpé en sous-intervalles,
//    quadrature à 16 points ;
//  · queue au-delà de 5,52, découpée sur 14 zéros consécutifs de J0,
//    quadrature à 12 points.
// Chaque sous-intervalle est encore divisé en SOUS_SEGMENTS = 2 : indispensable
// pour que l'intégrale de Weber-Schafheitlin s'annule pour r > a (la
// contrainte verticale doit être nulle en surface hors de l'empreinte).

export const SOUS_SEGMENTS = 2;

// Demi-tableaux de Gauss-Legendre sur [-1, 1].
const X16 = [0.0950125098376374, 0.2816035507792589, 0.4580167776572274, 0.6178762444026438,
  0.7554044083550030, 0.8656312023878318, 0.9445750230732326, 0.9894009349916499];
const W16 = [0.1894506104550685, 0.1826034150449236, 0.1691565193950025, 0.1495959888165767,
  0.1246289712555339, 0.0951585116824928, 0.0622535239386479, 0.0271524594117541];
const X12 = [0.1252334085114689, 0.3678314989981802, 0.5873179542866175,
  0.7699026741943047, 0.9041172563704749, 0.9815606342467192];
const W12 = [0.2491470458134028, 0.2334925365383548, 0.2031674267230659,
  0.1600783285433462, 0.1069393259953184, 0.0471753363865118];

/** Bornes du premier cycle, en unités de ξ·a (les zéros de J0 et J1 y figurent). */
export const BORNES_PREMIER_CYCLE = [
  0, 0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9, 1.2, 1.4, 1.6, 1.8, 2.2,
  2.40482568740845, 2.6, 2.8, 3.2, 3.4, 3.6, 3.83170604705811,
  4.2, 4.6, 5.0, 5.52007818222046,
];

/** Bornes de la queue : zéros de J0, du 2e au 44e de 3 en 3, en unités de ξ·a. */
export const BORNES_QUEUE = [
  5.52007818222046, 14.9309177398682, 24.3524723052979, 33.775821685791,
  43.1997909545898, 52.6240501403809, 62.048469543457, 71.4729843139648,
  80.8975524902344, 90.3221740722656, 99.7468185424805, 109.171493530273,
  118.596183776855, 128.020874023438, 137.445587158203,
];

/** Nœud négatif d'abord puis nœud positif, dans le même ordre et avec le même poids. */
function symetriser(demiX, demiW) {
  const m = demiX.length;
  const x = new Float64Array(2 * m), w = new Float64Array(2 * m);
  for (let i = 0; i < m; i++) {
    x[i] = -demiX[i]; w[i] = demiW[i];
    x[m + i] = demiX[i]; w[m + i] = demiW[i];
  }
  return { x, w };
}

const G16 = symetriser(X16, W16);
const G12 = symetriser(X12, W12);

/**
 * Nœuds (ξ en rad/m) et poids de la quadrature pour un rayon de charge a (m).
 * Les bornes tabulées sont en ξ·a : elles sont divisées par a.
 */
export function noeuds(rayon) {
  if (!(rayon > 0)) throw new RangeError("le rayon de charge doit être positif");
  const n = (BORNES_PREMIER_CYCLE.length - 1) * SOUS_SEGMENTS * G16.x.length
          + (BORNES_QUEUE.length - 1) * SOUS_SEGMENTS * G12.x.length;
  const xi = new Float64Array(n), w = new Float64Array(n);
  let k = 0;
  const ajouter = (bornes, g) => {
    for (let s = 0; s < bornes.length - 1; s++) {
      const lo = bornes[s] / rayon, hi = bornes[s + 1] / rayon;
      const pas = (hi - lo) / SOUS_SEGMENTS;
      for (let sub = 0; sub < SOUS_SEGMENTS; sub++) {
        const a = lo + sub * pas, b = a + pas;
        const milieu = 0.5 * (a + b), demi = 0.5 * (b - a);
        for (let j = 0; j < g.x.length; j++) {
          xi[k] = milieu + demi * g.x[j];
          w[k] = g.w[j] * demi;
          k++;
        }
      }
    }
  };
  ajouter(BORNES_PREMIER_CYCLE, G16);
  ajouter(BORNES_QUEUE, G12);
  return { xi, w, n };
}
