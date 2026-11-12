// Noyau multicouche : pour une valeur donnée du paramètre de Hankel ξ, assemble
// et résout le système linéaire des coefficients de la fonction de contrainte
// de Love dans chaque couche.
//
// Convention : dans chaque couche G(ξ, z) = (A + Bz) e^(−ξz) + (C + Dz) e^(+ξz).
// Les inconnues réduites sont a = Aξ³, b = Bξ², c = Cξ³, d = Dξ² : c'est ce qui
// assure la stabilité numérique. La dernière couche effective est
// semi-infinie : pas de terme croissant, donc c = d = 0 et deux inconnues
// seulement. Le système compte 4(nE − 1) + 2 inconnues.
//
// Les lignes du noyau ont été dérivées et vérifiées analytiquement terme à
// terme dans Burmister-Calc : NE PAS les réécrire.

import { resoudreEnPlace } from "./gauss.js";

/** Au-delà de ξh = 35, e^(−35) ≈ 6·10⁻¹⁶ : la couche est traitée comme semi-infinie. */
export const LIMITE_TRONCATURE = 35;

function ligneSigmaZ(t, nu, r) {
  const e = Math.exp(-t), E = Math.exp(t);
  r[0] = e; r[1] = (1 - 2 * nu + t) * e; r[2] = -E; r[3] = (1 - 2 * nu - t) * E;
}
function ligneTauRZ(t, nu, r) {
  const e = Math.exp(-t), E = Math.exp(t);
  r[0] = e; r[1] = (t - 2 * nu) * e; r[2] = E; r[3] = (2 * nu + t) * E;
}
function ligneUz(t, nu, r) {
  const e = Math.exp(-t), E = Math.exp(t);
  r[0] = -e; r[1] = (4 * nu - 2 - t) * e; r[2] = -E; r[3] = (2 - 4 * nu - t) * E;
}
function ligneUr(t, nu, r) {
  const e = Math.exp(-t), E = Math.exp(t);
  r[0] = -e; r[1] = (1 - t) * e; r[2] = E; r[3] = (1 + t) * E;
}

/**
 * Solveur du noyau pour une structure donnée. `couches` : [{ E (MPa), nu, h (m),
 * interface }], la dernière semi-infinie (h = Infinity) ; `interface` décrit
 * la liaison avec la couche du dessous : "collee" ou "glissante" (une
 * interface semi-collée est résolue en amont, par moyenne des deux calculs).
 */
export class Noyau {
  constructor(couches) {
    const n = couches.length;
    if (n < 1) throw new Error("au moins une couche est requise");
    this.n = n;
    this.nu = new Float64Array(n);
    this.h = new Float64Array(n);
    this.mu = new Float64Array(n);          // Pa
    this.glissante = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
      const c = couches[i];
      this.nu[i] = c.nu;
      this.h[i] = c.h;
      this.mu[i] = (c.E * 1e6) / (2 * (1 + c.nu));
      if (c.interface === "semi-collee")
        throw new Error("une interface semi-collée doit être résolue (collée ou glissante) avant le noyau");
      this.glissante[i] = c.interface === "glissante";
    }
    if (this.h[n - 1] !== Infinity) throw new Error("la dernière couche doit être semi-infinie");
    const cap = 4 * (n - 1) + 2;
    this.mat = new Float64Array(cap * cap);
    this.rhs = new Float64Array(cap);
    this.sc = new Float64Array(n);          // facteurs de normalisation e^(−ξ h_k)
    this.A = new Float64Array(n); this.B = new Float64Array(n);
    this.C = new Float64Array(n); this.D = new Float64Array(n);
    this.semiInfinie = new Array(n).fill(true);
    this.nombre = n;                        // couches effectives au dernier ξ résolu
    this._ligne = new Float64Array(4);
  }

  _placer(N, ligne, couche, coef, facteur, nE) {
    const off = ligne * N + 4 * couche;
    const m = this.mat;
    m[off] += coef[0] * facteur;
    m[off + 1] += coef[1] * facteur;
    if (couche < nE - 1) {
      const s = this.sc[couche];
      m[off + 2] += coef[2] * facteur * s;
      m[off + 3] += coef[3] * facteur * s;
    }
  }

  /** Résout le système pour ξ et remplit A, B, C, D (valeurs dénormalisées). */
  resoudre(xi) {
    const n = this.n;
    // Troncature adaptative : la première couche finie telle que ξh > 35 devient semi-infinie.
    let nE = n;
    for (let k = 0; k < n - 1; k++) if (xi * this.h[k] > LIMITE_TRONCATURE) { nE = k + 1; break; }
    this.nombre = nE;
    const N = 4 * (nE - 1) + 2;
    this.mat.fill(0, 0, N * N);
    this.rhs.fill(0, 0, N);
    for (let k = 0; k < nE - 1; k++) this.sc[k] = Math.exp(-xi * this.h[k]);

    const r = this._ligne, nu = this.nu;
    // Surface (z = 0 de la couche 0), contrainte normalisée.
    ligneSigmaZ(0, nu[0], r); this._placer(N, 0, 0, r, 1, nE);
    this.rhs[0] = 1;
    ligneTauRZ(0, nu[0], r); this._placer(N, 1, 0, r, 1, nE);

    for (let k = 0; k < nE - 1; k++) {
      const b = 2 + 4 * k;
      const t = xi * this.h[k];
      const nuk = nu[k], nuk1 = nu[k + 1];
      const f1 = 1 / (2 * this.mu[k]);
      const f2 = 1 / (2 * this.mu[k + 1]);
      if (this.glissante[k]) {
        ligneSigmaZ(t, nuk, r); this._placer(N, b, k, r, 1, nE);
        ligneSigmaZ(0, nuk1, r); this._placer(N, b, k + 1, r, -1, nE);
        ligneUz(t, nuk, r); this._placer(N, b + 1, k, r, f1, nE);
        ligneUz(0, nuk1, r); this._placer(N, b + 1, k + 1, r, -f2, nE);
        ligneTauRZ(t, nuk, r); this._placer(N, b + 2, k, r, 1, nE);
        ligneTauRZ(0, nuk1, r); this._placer(N, b + 3, k + 1, r, 1, nE);
      } else {
        ligneSigmaZ(t, nuk, r); this._placer(N, b, k, r, 1, nE);
        ligneSigmaZ(0, nuk1, r); this._placer(N, b, k + 1, r, -1, nE);
        ligneTauRZ(t, nuk, r); this._placer(N, b + 1, k, r, 1, nE);
        ligneTauRZ(0, nuk1, r); this._placer(N, b + 1, k + 1, r, -1, nE);
        ligneUz(t, nuk, r); this._placer(N, b + 2, k, r, f1, nE);
        ligneUz(0, nuk1, r); this._placer(N, b + 2, k + 1, r, -f2, nE);
        ligneUr(t, nuk, r); this._placer(N, b + 3, k, r, f1, nE);
        ligneUr(0, nuk1, r); this._placer(N, b + 3, k + 1, r, -f2, nE);
      }
    }

    resoudreEnPlace(this.mat, this.rhs, N);

    for (let k = 0; k < nE; k++) {
      this.A[k] = this.rhs[4 * k];
      this.B[k] = this.rhs[4 * k + 1];
      if (k < nE - 1) {
        // Annulation de la normalisation exponentielle des colonnes croissantes.
        this.C[k] = this.rhs[4 * k + 2] * this.sc[k];
        this.D[k] = this.rhs[4 * k + 3] * this.sc[k];
        this.semiInfinie[k] = false;
      } else {
        this.C[k] = 0; this.D[k] = 0;
        this.semiInfinie[k] = true;
      }
    }
    for (let k = nE; k < n; k++) {
      this.A[k] = this.B[k] = this.C[k] = this.D[k] = 0;
      this.semiInfinie[k] = true;
    }
  }
}
