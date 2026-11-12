// Élimination de Gauss à pivot partiel sur matrice dense, stockage ligne
// majeure. Sert au noyau multicouche et au système normal du rétrocalcul.

/**
 * Résout A x = b. La matrice (n × n) et le second membre sont modifiés ; la
 * solution est laissée dans v. Une colonne sans pivot est ignorée et
 * l'inconnue correspondante mise à zéro.
 */
export function resoudreEnPlace(m, v, n) {
  for (let col = 0; col < n; col++) {
    let meilleur = col, max = Math.abs(m[col * n + col]);
    for (let r = col + 1; r < n; r++) {
      const av = Math.abs(m[r * n + col]);
      if (av > max) { max = av; meilleur = r; }
    }
    if (max === 0) continue;
    if (meilleur !== col) {
      for (let c = col; c < n; c++) {
        const t = m[col * n + c]; m[col * n + c] = m[meilleur * n + c]; m[meilleur * n + c] = t;
      }
      const t = v[col]; v[col] = v[meilleur]; v[meilleur] = t;
    }
    const piv = m[col * n + col];
    for (let r = col + 1; r < n; r++) {
      let f = m[r * n + col];
      if (f === 0) continue;
      f /= piv;
      m[r * n + col] = 0;
      for (let c = col + 1; c < n; c++) m[r * n + c] -= f * m[col * n + c];
      v[r] -= f * v[col];
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = v[i];
    for (let c = i + 1; c < n; c++) s -= m[i * n + c] * v[c];
    const piv = m[i * n + i];
    v[i] = piv !== 0 ? s / piv : 0;
  }
}

/** Résout A x = b sans modifier les entrées. A est un tableau de lignes. */
export function resoudre(A, b) {
  const n = b.length;
  const m = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) m[i * n + j] = A[i][j];
  const v = Float64Array.from(b);
  resoudreEnPlace(m, v, n);
  return Array.from(v);
}
