// Petits outils communs aux solveurs de chaussée.

/** Résultat d'une méthode qui ne s'applique pas : on dit pourquoi, plutôt qu'un NaN muet. */
export function horsDomaine(motif, extra = {}) {
  return { applicable: false, motif, ...extra };
}

/** Borne x dans [a, b]. */
export const borner = (x, a, b) => Math.min(Math.max(x, a), b);

/** Interpolation linéaire dans une table [[x, y], …] triée en x, bornée aux extrémités. */
export function interpoler(table, x) {
  if (x <= table[0][0]) return table[0][1];
  const n = table.length;
  if (x >= table[n - 1][0]) return table[n - 1][1];
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = table[i], [x1, y1] = table[i + 1];
    if (x >= x0 && x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return table[n - 1][1];
}

/** Nombre au format français, chiffres significatifs (textes des exercices et des notes). */
export const fr = (x, chiffres = 3) => (Number.isFinite(x)
  ? Number(x).toLocaleString("fr-FR", { maximumSignificantDigits: chiffres })
  : "—");

/** Nombre au format français, décimales fixes. */
export const frd = (x, decimales = 2) => (Number.isFinite(x)
  ? Number(x).toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
  : "—");
