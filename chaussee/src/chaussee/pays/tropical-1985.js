// Vérification CEBTP/LCPC 1985 (renforcement), portage de Tropical1985Design.
// Les catalogues d'épaisseurs Q×T ne donnent pas les admissibles : on prend
// les cellules p. 117 (fiches) et la loi Shell de l'annexe II. Le neuf 1980
// reste sur tropical-calcul.js (fourchettes σt + Kerkhoven-Dormon).
//
//   εt,adm : p. 117, ≈ 30 °C, par classe de trafic T1..T5 (GB, BB, SB) ;
//   σt,adm : p. 117, en bar (MTLH3 par trafic ; MTLH2 jusqu'à T3) ;
//   εz,adm = 2,8·10⁻² · N^(−0,25) (Shell), à défaut la valeur tabulée p. 116.

import { ligneA } from "../burmister.js";
import { BAR_PAR_MPA } from "./base.js";
import { nombre } from "./commun.js";
import { neGlobal } from "./tropical-calcul.js";

export const METHODE_1985 = "CEBTP 1985";

/** εz,adm = SHELL_A · N^SHELL_B (déformation, pas µdéf). */
export const SHELL_A = 2.8e-2;
export const SHELL_B = -0.25;

/** εt p. 117 à ≈ 30 °C, en µdéf (2,5e-4 → 250), T1..T5 ; null = cellule absente. */
export const EPS_T_1985 = {
  GB: [250, 200, 150, 110, 80],
  BB: [400, 300, 230, 160, 130],
  SB: [600, 400, 300, null, null],
};

/** εz Shell p. 116 en µdéf (T1..T5), si N n'est pas utilisable. */
export const EPS_Z_1985 = [1560, 1320, 880, 590, 490];

/** σt,adm MTLH3 (bar), T1..T5. */
export const SIGMA_T_MTLH3 = [12, 10, 8, 7, 6];

/** Indice 0..4 d'une classe « T1 ».. « T5 », −1 sinon. */
export function indiceTrafic(t) {
  if (typeof t !== "string" || t.length < 2 || (t[0] !== "T" && t[0] !== "t")) return -1;
  const s = t.slice(1);
  if (!/^\s*[+-]?\d+\s*$/.test(s)) return -1;
  const n = Number.parseInt(s, 10);
  return n >= 1 && n <= 5 ? n - 1 : -1;
}

export function canoniqueBitumineux(cle) {
  const k = cle?.trim().toUpperCase();
  return k === "GB" ? "GB" : k === "BB" || k === "REVETEMENT" ? "BB" : k === "SB" || k === "SB85" ? "SB" : null;
}

export function canoniqueMtlh(cle) {
  const k = cle?.trim().toUpperCase();
  return k === "GC85" ? "MTLH3" : k === "GLC85" ? "MTLH2" : k === "SC" ? "MTLH1" : null;
}

const estCleLiee1985 = (cle) => canoniqueBitumineux(cle) != null || canoniqueMtlh(cle) != null
  || ["ES", "TS", "MB"].includes(String(cle ?? "").toUpperCase());

/** εt admissible p. 117 : { ok, valeur (µdéf), note }. */
export function epsTAdmissible1985(cle, trafic) {
  const canon = canoniqueBitumineux(cle);
  if (canon == null || !EPS_T_1985[canon]) return { ok: false, valeur: NaN, note: "" };
  const i = indiceTrafic(trafic);
  if (i < 0) return { ok: false, valeur: NaN, note: "CEBTP 1985 p. 117 : classe de trafic T1-T5 requise pour εt." };
  const v = EPS_T_1985[canon][i];
  if (v == null) return { ok: false, valeur: NaN, note: `CEBTP 1985 p. 117 : ${canon} sans εt en ${trafic}.` };
  return { ok: true, valeur: v, note: `CEBTP 1985 p. 117 : ${canon} εt,adm = ${Math.round(v)} µdéf (${trafic}, ≈ 30 °C).` };
}

const RIGIDES = ["semi-rigide", "mixte", "beton"];

/** σt admissible p. 117 (bar) : { ok, valeur, note }. `typeStructure` sépare MTLH2 souple / semi-rigide en T3. */
export function sigmaTAdmissible1985(cle, trafic, typeStructure) {
  const canon = canoniqueMtlh(cle);
  if (canon == null) return { ok: false, valeur: NaN, note: "" };
  const i = indiceTrafic(trafic);
  if (i < 0) return { ok: false, valeur: NaN, note: "CEBTP 1985 p. 117 : classe de trafic T1-T5 requise pour σt." };
  if (canon === "MTLH3") {
    const bar = SIGMA_T_MTLH3[i];
    return { ok: true, valeur: bar, note: `CEBTP 1985 p. 117 : MTLH3 σt,adm = ${nombre(bar)} bar (${trafic}).` };
  }
  if (canon === "MTLH2") {
    let bar;
    if (i === 0) bar = 8;
    else if (i === 1) bar = 6.5;
    else if (i === 2) bar = RIGIDES.includes(typeStructure) ? 4 : 5;
    else return { ok: false, valeur: NaN, note: `CEBTP 1985 p. 117 : MTLH2 sans σt en ${trafic}.` };
    const precision = i === 2 ? (bar < 4.5 ? ", semi-rigide" : ", souple") : "";
    return { ok: true, valeur: bar, note: `CEBTP 1985 p. 117 : MTLH2 σt,adm = ${nombre(bar)} bar (${trafic}${precision}).` };
  }
  return { ok: false, valeur: NaN, note: "CEBTP 1985 p. 117 : MTLH1 (SC) sans table σt par trafic." };
}

/** εz admissible (µdéf) : loi Shell si N ≥ 10, sinon la valeur tabulée de la classe, sinon T1. */
export function epsZAdmissible1985(ne, trafic) {
  if (ne >= 10) {
    const micro = SHELL_A * ne ** SHELL_B * 1e6;
    return { valeur: micro,
      note: `Shell Annexe II : εz,adm = 2,8e-2 × N^(-0,25) = ${nombre(micro, 1)} µdéf (N = ${Math.round(ne)} essieux).` };
  }
  const i = indiceTrafic(trafic);
  if (i >= 0)
    return { valeur: EPS_Z_1985[i],
      note: `CEBTP 1985 p. 116 : εz,adm = ${EPS_Z_1985[i]} µdéf (${trafic}, N trop faible pour la loi Shell).` };
  return { valeur: EPS_Z_1985[0], note: "CEBTP 1985 : N et classe T absents, εz T1 (1,56e-3) retenu." };
}

const COMPRIMEE = " Couche entièrement comprimée : critère non dimensionnant.";

function nonApplicable(i, c, critere, grandeur, unite, motif) {
  return { couche: i, nom: c.nom, famille: c.famille, critere, grandeur, unite, applicable: false, ok: null,
    motif, sollicitation: NaN, admissible: NaN, taux: NaN, coefs: {} };
}

/**
 * Vérification d'une chaussée renforcée (ou hybride) selon le manuel 1985 :
 * εt en base des enrobés (GB, BB, SB), σt en base des MTLH2/3, εz en tête du
 * sol support. `p` : { classeTrafic, typeStructure, mja, taux, annees, cam… }.
 */
export function verifier1985(couches, analyse, p) {
  const verifs = [];
  const sommets = [0];
  for (let i = 1; i < couches.length; i++) sommets.push(sommets[i - 1] + couches[i - 1].h);

  couches.forEach((c, i) => {
    const eps = epsTAdmissible1985(c.materiau, p.classeTrafic);
    if (eps.ok) {
      const critere = "Traction admissible en base (CEBTP 1985)";
      const l = ligneA(analyse, sommets[i] + c.h, true);
      if (!l) return verifs.push(nonApplicable(i, c, critere, "epsT", "µdéf", "Pas de sollicitation calculée à la base de cette couche."));
      const s = l.epsT < 0 ? -l.epsT : 0;
      return verifs.push({ couche: i, nom: c.nom, famille: c.famille, critere,
        formule: "εt ≤ εt,adm (p. 117, µdéf, ≈ 30 °C)", grandeur: "epsT", unite: "µdéf", applicable: true,
        sollicitation: s, admissible: eps.valeur, taux: (s / eps.valeur) * 100, ok: s <= eps.valeur,
        motif: eps.note + (l.epsT >= 0 ? COMPRIMEE : ""), coefs: {} });
    }
    const sig = sigmaTAdmissible1985(c.materiau, p.classeTrafic, p.typeStructure);
    if (sig.ok) {
      const critere = "Traction admissible en base (CEBTP 1985)";
      const l = ligneA(analyse, sommets[i] + c.h, true);
      if (!l) return verifs.push(nonApplicable(i, c, critere, "sigT", "bar", "Pas de sollicitation calculée à la base de cette couche."));
      const s = (l.sigT < 0 ? -l.sigT : 0) * BAR_PAR_MPA;
      return verifs.push({ couche: i, nom: c.nom, famille: c.famille, critere,
        formule: "σt ≤ σt,adm (p. 117, bar)", grandeur: "sigT", unite: "bar", applicable: true,
        sollicitation: s, admissible: sig.valeur, taux: (s / sig.valeur) * 100, ok: s <= sig.valeur,
        motif: sig.note + (l.sigT >= 0 ? COMPRIMEE : ""), coefs: {} });
    }
    if ((c.famille === "bitumineux" || c.famille === "hydraulique") && estCleLiee1985(c.materiau))
      verifs.push(nonApplicable(i, c, "Traction admissible (CEBTP 1985)", "epsT", "µdéf",
        `CEBTP 1985 p. 117 : pas de cellule εt/σt pour ${c.materiau} / ${p.classeTrafic ?? "trafic ?"}.`));
  });

  const der = couches.length - 1;
  const ez = epsZAdmissible1985(neGlobal(p), p.classeTrafic);
  const l = ligneA(analyse, sommets[der], false);
  if (!l) verifs.push(nonApplicable(der, couches[der], "Déformation plate-forme (CEBTP 1985)", "epsZ", "µdéf",
    "Pas de sollicitation calculée au sommet du sol support."));
  else {
    const s = Math.abs(l.epsZ);
    verifs.push({ couche: der, nom: couches[der].nom, famille: couches[der].famille,
      critere: "Déformation verticale admissible (Shell, CEBTP 1985)", formule: "εz,adm = 2,8e-2 × N^(-0,25)",
      grandeur: "epsZ", unite: "µdéf", applicable: true, sollicitation: s, admissible: ez.valeur,
      taux: (s / ez.valeur) * 100, ok: s <= ez.valeur, motif: ez.note, coefs: {} });
  }
  const applicables = verifs.filter((v) => v.applicable);
  return { verifs, deterministe: true, ok: applicables.every((v) => v.ok),
    dimensionnant: applicables.reduce((m, v) => (!m || v.taux > m.taux ? v : m), null) };
}
