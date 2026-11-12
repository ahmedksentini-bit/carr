// Mise en forme des nombres dans les messages du renforcement, à la française
// (virgule décimale), comme les chaînes de Burmister-Calc sous la culture fr-FR.

/** Nombre avec au plus `decimales` chiffres après la virgule, sans séparateur de milliers ("0.##"). */
export function nf(x, decimales = 0) {
  if (x === null || x === undefined) return "";
  if (!Number.isFinite(x)) return Number.isNaN(x) ? "NaN" : x > 0 ? "∞" : "−∞";
  const s = x.toLocaleString("fr-FR", { maximumFractionDigits: decimales, useGrouping: false });
  return s === "-0" ? "0" : s;
}

/** Nombre entier avec séparateur de milliers ("N0"). */
export function milliers(x) {
  if (!Number.isFinite(x)) return nf(x);
  return x.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}
