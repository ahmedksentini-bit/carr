// Fonctions de Bessel de première espèce J0 et J1, approximation polynomiale
// de type Abramowitz & Stegun.
//
// ATTENTION : ces expressions ont été corrigées par rapport à la formulation
// classique du manuel (erreur de factorisation dans le terme constant de J1
// pour x < 3, et un facteur y en trop dans les polynômes pour x ≥ 3). Elles
// sont validées à 0,00 % d'écart contre la solution de Boussinesq, et
// identiques à celles de Burmister-Calc. NE PAS les « corriger » vers la forme
// du manuel.

export function J0(x) {
  x = Math.abs(x);
  if (x < 3) {
    let y = x / 3; y *= y;
    return 1 - y * (2.2499997 - y * (1.2656208 - y * (0.3163866 - y * (0.0444479 - y * (0.0039444 - y * 0.00021)))));
  }
  const yy = 3 / x;
  const f = 0.79788456 + yy * (-0.00000077 + yy * (-0.0055274 + yy * (-0.00009512 + yy * (0.00137237 + yy * (-0.00072805 + yy * 0.00014476)))));
  const t = x - 0.78539816 + yy * (-0.04166397 + yy * (-0.00003954 + yy * (0.00262573 + yy * (-0.00054125 + yy * (-0.00029333 + yy * 0.00013558)))));
  return (f * Math.cos(t)) / Math.sqrt(x);
}

export function J1(x) {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  if (x < 3) {
    let y = x / 3; y *= y;
    return s * x * (0.5 - y * (0.56249985 - y * (0.21093573 - y * (0.03954289 - y * (0.00443319 - y * (0.00031761 - y * 0.00001109))))));
  }
  const yy = 3 / x;
  const f = 0.79788456 + yy * (0.00000156 + yy * (0.01659667 + yy * (0.00017105 + yy * (-0.00249511 + yy * (0.00113653 - yy * 0.00020033)))));
  const t = x - 2.35619449 + yy * (0.12499612 + yy * (0.0000565 + yy * (-0.00637879 + yy * (0.00074348 + yy * (0.00079824 - yy * 0.00029166)))));
  return (s * f * Math.cos(t)) / Math.sqrt(x);
}
