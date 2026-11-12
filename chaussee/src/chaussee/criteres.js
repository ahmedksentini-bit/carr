// Critères de dimensionnement de la méthode rationnelle française
// (NF P98-086:2011) : fatigue des matériaux bitumineux, traction par flexion
// des matériaux traités aux liants hydrauliques et des bétons, déformation
// verticale des sols et des graves non traitées.
//
//   εt,adm = ε6 · kθ · (NE/10⁶)^b · kr · kc · ks        kθ = √(E10 / E(θeq))
//   σt,adm = σ6 · (NE/10⁶)^b · kr · kd · kc · ks
//   εz,adm = A · NE^(−0,222)
//   kr = 10^(−u·b·δ)      δ = √(SN² + (c·Sh / b)²),  c = 0,02 cm⁻¹
//
// Le facteur (NE/10⁶)^b de σt,adm, longtemps oublié par Burmister-Calc, y est
// appliqué depuis la correction du critère MTLH : les deux calculs concordent.
//
// Unités : E en MPa, h en m, Sh en cm dans les formules (stocké en m pour les
// matériaux hydrauliques, comme dans Alizé), ε en µdéf, σ en MPa.

import { fractileDuRisque } from "./fractile.js";
import { ligneA } from "./burmister.js";

/** Sh (cm) d'un matériau bitumineux, selon l'épaisseur de la couche (cm). */
export const shBitumineux = (eCm) => (eCm <= 10 ? 1 : eCm >= 15 ? 2.5 : 1 + 0.3 * (eCm - 10));

/**
 * ks selon le module de la couche qui porte la couche liée (NF P98-086) :
 * 1/1,2 sous 50 MPa, 1/1,1 de 50 à 80, 1/1,065 de 80 à 120, 1 au-delà (tableau D.2).
 */
export const ksSupport = (Esupport) =>
  (Esupport < 50 ? 1 / 1.2 : Esupport < 80 ? 1 / 1.1 : Esupport < 120 ? 1 / 1.065 : 1);

/** δ et kr d'un critère de fatigue. Sh en cm. */
export function kr({ b, SN, ShCm, u }) {
  const delta = Math.sqrt(SN * SN + ((0.02 * ShCm) / b) ** 2);
  return { delta, kr: 10 ** (-u * b * delta) };
}

/**
 * εt admissible (µdéf) à la base d'une couche bitumineuse d'épaisseur h (m)
 * et de module E (MPa), sous NE essieux. `ks` imposé, sinon déduit de Esupport.
 */
export function epsTAdmissible({ bit, E, h, ne, u, ks, Esupport }) {
  const Sh = shBitumineux(h * 100);
  const { delta, kr: k } = kr({ b: bit.b, SN: bit.SN, ShCm: Sh, u });
  const ktheta = Math.sqrt(bit.E10 / E);
  const kS = ks ?? ksSupport(Esupport);
  const fNE = (ne / 1e6) ** bit.b;
  return {
    valeur: bit.eps6 * ktheta * fNE * k * bit.kc * kS,
    coefs: { Sh, delta, kr: k, ktheta, fNE, ks: kS, kc: bit.kc, b: bit.b },
  };
}

/** σt admissible (MPa) à la base d'une couche traitée aux liants hydrauliques. */
export function sigmaTAdmissible({ hyd, ne, u, ks = 1 }) {
  const Sh = hyd.Sh * 100;
  const { delta, kr: k } = kr({ b: hyd.b, SN: hyd.SN, ShCm: Sh, u });
  const fNE = (ne / 1e6) ** hyd.b;
  return {
    valeur: hyd.sigma6 * fNE * k * hyd.kd * hyd.kc * ks,
    coefs: { Sh, delta, kr: k, fNE, kd: hyd.kd, kc: hyd.kc, ks, b: hyd.b },
  };
}

/** εz admissible (µdéf) au sommet d'un sol ou d'une GNT : A · NE^pente. */
export const epsZAdmissible = (A, pente, ne) => A * ne ** pente;

export const FORMULES = {
  bitumineux: "εt,adm = ε6 · kθ · (NE/10⁶)^b · kr · kc · ks,  kθ = √(E10/E),  kr = 10^(−u·b·δ),  δ = √(SN² + (0,02·Sh/b)²)",
  hydraulique: "σt,adm = σ6 · (NE/10⁶)^b · kr · kd · kc · ks,  kr = 10^(−u·b·δ),  δ = √(SN² + (0,02·Sh/b)²)",
  sol: "εz,adm = A · NE^(−0,222)",
};

const NOMS = {
  bitumineux: { critere: "Fatigue bitumineuse (base de couche)", grandeur: "epsT", unite: "µdéf" },
  hydraulique: { critere: "Traction par flexion (base de couche)", grandeur: "sigT", unite: "MPa" },
  sol: { critere: "Déformation verticale (sommet de couche)", grandeur: "epsZ", unite: "µdéf" },
};

/** Part de durée de vie restante d'une couche qui a déjà consommé le dommage D. */
const vieRestante = (D) => (Number.isFinite(D) && D > 0 ? Math.min(Math.max(1 - D, 1e-6), 1) : 1);

/**
 * Vérifie chaque couche dotée d'une famille de matériau.
 *
 * `params` : { ne: { bitumineux, hydraulique, sol } (NE par famille, NPL × CAM),
 *              risque (%) ou u, niveauTrafic "fort" | "faible", ks (défaut 1,
 *              ou "support" : règle du module de la couche qui porte chaque couche liée) }.
 *
 * Une couche qui a déjà consommé un dommage D (chaussée renforcée) doit tenir
 * NE / (1 − D) : c'est la loi de Miner portée couche par couche.
 */
export function verifier(couches, analyse, params) {
  const u = params.u ?? fractileDuRisque(params.risque ?? 5);
  const niveau = params.niveauTrafic ?? "fort";
  const n = couches.length;
  // ks : valeur imposée pour toutes les couches liées (1 par défaut, comme Alizé), ou
  // "support" — la règle de la norme : seule une couche liée posée sur une couche non
  // liée (GNT, plateforme) est minorée, selon le module de cette couche.
  const ksDe = (i) => {
    if (params.ks !== "support") return params.ks ?? 1;
    const dessous = couches[i + 1];
    return dessous && (dessous.famille === "sol" || dessous.famille == null || i + 1 === n - 1) &&
      dessous.famille !== "bitumineux" && dessous.famille !== "hydraulique" ? ksSupport(dessous.E) : 1;
  };
  const sommets = [0];
  for (let i = 1; i < n; i++) sommets.push(sommets[i - 1] + couches[i - 1].h);

  const verifs = [];
  couches.forEach((c, i) => {
    const fam = c.famille;
    if (!NOMS[fam]) return;
    const base = { couche: i, nom: c.nom ?? `couche ${i + 1}`, famille: fam, ...NOMS[fam],
                   formule: FORMULES[fam], dommage: c.dommage ?? 0 };
    const nonApplicable = (motif) => verifs.push({ ...base, applicable: false, ok: null, motif,
      sollicitation: NaN, admissible: NaN, taux: NaN, neApplique: NaN, coefs: {} });
    const neFam = params.ne?.[fam];
    if (!(neFam > 0)) return nonApplicable("trafic NE de la famille non renseigné");
    const neC = neFam / vieRestante(c.dommage);

    if (fam === "bitumineux") {
      if (!c.bit) return nonApplicable(`paramètres du matériau « ${c.materiau ?? base.nom} » absents`);
      if (!Number.isFinite(c.bit.eps6)) return nonApplicable("couche de surface non vérifiée en fatigue (ε6 non défini)");
      const l = ligneA(analyse, sommets[i] + c.h, true);
      if (!l) return nonApplicable("pas de sollicitation calculée à la base de la couche");
      const adm = epsTAdmissible({ bit: c.bit, E: c.E, h: c.h, ne: neC, u, ks: ksDe(i) });
      const s = l.epsT < 0 ? -l.epsT : 0;
      verifs.push({ ...base, applicable: true, sollicitation: s, admissible: adm.valeur,
        taux: (s / adm.valeur) * 100, ok: s <= adm.valeur, coefs: adm.coefs, neApplique: neC,
        motif: l.epsT >= 0 ? "couche entièrement comprimée : critère non dimensionnant" : null });
    } else if (fam === "hydraulique") {
      if (!c.hyd) return nonApplicable(`paramètres du matériau « ${c.materiau ?? base.nom} » absents`);
      if (!Number.isFinite(c.hyd.sigma6)) return nonApplicable("matériau traité sans loi de fatigue σ6");
      const l = ligneA(analyse, sommets[i] + c.h, true);
      if (!l) return nonApplicable("pas de sollicitation calculée à la base de la couche");
      const adm = sigmaTAdmissible({ hyd: c.hyd, ne: neC, u, ks: ksDe(i) });
      const s = l.sigT < 0 ? -l.sigT : 0;
      verifs.push({ ...base, applicable: true, sollicitation: s, admissible: adm.valeur,
        taux: (s / adm.valeur) * 100, ok: s <= adm.valeur, coefs: adm.coefs, neApplique: neC,
        motif: l.sigT >= 0 ? "couche entièrement comprimée : critère non dimensionnant" : null });
    } else {
      if (!c.sol) return nonApplicable(`paramètres du matériau « ${c.materiau ?? base.nom} » absents`);
      const A = niveau === "faible" ? c.sol.Afaible : c.sol.Afort;
      if (!Number.isFinite(A)) return nonApplicable(`coefficient A non défini en trafic ${niveau}`);
      const l = ligneA(analyse, sommets[i], false);
      if (!l) return nonApplicable("pas de sollicitation calculée au sommet de la couche");
      const adm = epsZAdmissible(A, c.sol.pente, neC);
      const s = Math.abs(l.epsZ);
      verifs.push({ ...base, applicable: true, sollicitation: s, admissible: adm,
        taux: (s / adm) * 100, ok: s <= adm, coefs: { A, pente: c.sol.pente }, neApplique: neC, motif: null });
    }
  });
  const applicables = verifs.filter((v) => v.applicable);
  const dimensionnant = applicables.reduce((m, v) => (!m || v.taux > m.taux ? v : m), null);
  return { verifs, u, ok: applicables.every((v) => v.ok), dimensionnant };
}
