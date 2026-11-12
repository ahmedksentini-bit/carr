// Outils communs aux modules du bureau de calcul : formats, lecture des
// champs, tableaux de structure et de vérification, essieu.

import { ESSIEU_REFERENCE, rayonContact } from "../chaussee/burmister.js";
import { profilProfondeur } from "../figures-chaussee.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const f = (x, c = 3) => (Number.isFinite(x) ? Number(x).toLocaleString("fr-FR", { maximumSignificantDigits: c }) : "—");
export const fd = (x, d = 2) => (Number.isFinite(x) ? Number(x).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
export const nombre = (v, defaut = NaN) => {
  const x = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(x) ? x : defaut;
};
export const pastille = (ok, oui = "vérifié", non = "non vérifié") => (ok === null || ok === undefined
  ? `<span class="verdict na">sans objet</span>`
  : `<span class="verdict ${ok ? "ok" : "ko"}">${ok ? "✓ " + oui : "✕ " + non}</span>`);

export const OPT_INTERFACE = [["collee", "collée"], ["semi-collee", "semi-collée"], ["glissante", "glissante"]];
export const NOM_INTERFACE = Object.fromEntries(OPT_INTERFACE);
export const OPT_STRUCTURE = [["souple", "souple"], ["bitumineuse-epaisse", "bitumineuse épaisse"], ["semi-rigide", "semi-rigide (assise traitée)"],
  ["mixte", "mixte"], ["inverse", "inverse"], ["beton", "béton"]];
export const NOM_FAMILLE = { bitumineux: "bitumineux", hydraulique: "traité aux liants hydrauliques / béton", sol: "sol / GNT" };

/** Champs de l'essieu, communs aux modules qui calculent une structure. */
export const CHAMPS_ESSIEU = [
  ["essieu", "Chargement", "choix", "reference", [["reference", "jumelage de référence 2 × 32,5 kN (130 kN)"], ["libre", "jumelage personnalisé"]]],
  ["P", "Charge par roue", "kN", "32.5", (v) => v.essieu === "libre"],
  ["q", "Pression de contact", "MPa", "0.662", (v) => v.essieu === "libre"],
  ["a", "Rayon de contact (vide : déduit de P et q)", "m", "", (v) => v.essieu === "libre"],
  ["entraxe", "Entraxe des roues", "m", "0.375", (v) => v.essieu === "libre"],
];

/** Essieu de calcul d'après les champs. */
export function essieuDe(v) {
  if (v.essieu !== "libre") return ESSIEU_REFERENCE;
  const P = nombre(v.P), q = nombre(v.q), a = nombre(v.a), entraxe = nombre(v.entraxe);
  if (!(P > 0 && q > 0 && entraxe > 0)) throw new Error("essieu : charge, pression et entraxe positifs requis");
  return { P, q, entraxe, ...(a > 0 ? { a } : {}) };
}

export const texteEssieu = (e) => `jumelage de deux roues de ${f(e.P, 3)} kN, q = ${f(e.q, 3)} MPa, a = ${fd(rayonContact(e) * 100, 2)} cm, entraxe ${fd(e.entraxe * 100, 1)} cm`;

/** Tableau de la structure de calcul. */
export function tableauStructure(couches) {
  return `<table class="resultats"><thead><tr><th>n°</th><th>Couche</th><th>Matériau</th><th>Famille</th><th class="num">h (cm)</th><th class="num">E (MPa)</th><th class="num">ν</th><th>Interface avec la couche inférieure</th></tr></thead><tbody>
    ${couches.map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.nom)}</td><td>${esc(c.materiau ?? "—")}</td><td class="motif">${esc(NOM_FAMILLE[c.famille] ?? "—")}</td>
      <td class="num">${Number.isFinite(c.h) ? fd(c.h * 100, 1) : "∞"}</td><td class="num">${f(c.E, 4)}</td><td class="num">${fd(c.nu, 2)}</td>
      <td class="motif">${i < couches.length - 1 ? esc(NOM_INTERFACE[c.interface ?? "collee"]) : "—"}${c.dommage > 0 ? ` · dommage consommé ${fd(c.dommage, 2)}` : ""}</td></tr>`).join("")}
  </tbody></table>`;
}

const NOM_COEF = { Sh: "Sh (cm)", delta: "δ", kr: "kr", ktheta: "kθ", fNE: "(NE/10⁶)^b", ks: "ks", kc: "kc", kd: "kd", b: "b", A: "A", pente: "pente" };
export const texteCoefs = (coefs) => Object.entries(coefs ?? {}).map(([k, x]) => `${NOM_COEF[k] ?? k} = ${f(x, 4)}`).join(" · ");

const unite = (v) => (v.unite === "bar" ? "bar" : v.unite);
const chiffres = (v) => (v.unite === "MPa" ? 3 : v.unite === "bar" ? 3 : 4);

/** Tableau des vérifications (critères rationnels ou déterministes). */
export function tableauVerifications(verification, { coefs = true } = {}) {
  // Les coefficients se lisent sous l'intitulé du critère, en petit : une colonne de plus
  // élargissait le tableau au-delà du panneau de résultats.
  const detail = (v) => {
    const c = coefs ? texteCoefs(v.coefs) + (v.neApplique > 0 ? ` · NE = ${f(v.neApplique, 3)}` : "") : "";
    return [v.motif, c].filter(Boolean).map((t) => `<small>${esc(t)}</small>`).join("");
  };
  return `<table class="resultats tableau-verifs"><thead><tr><th>Couche</th><th>Critère</th><th class="num">Sollicitation</th><th class="num">Admissible</th><th class="num">Taux</th><th>Verdict</th></tr></thead><tbody>
    ${verification.verifs.map((v) => `<tr class="${v.applicable ? (v.ok ? "" : "ko") : "ecarte"}${verification.dimensionnant === v ? " ligne-retenue" : ""}">
      <td>${esc(v.nom)}</td><td>${esc(v.critere)}${detail(v)}</td>
      <td class="q">${v.applicable ? `${f(v.sollicitation, chiffres(v))} ${esc(unite(v))}` : "—"}</td>
      <td class="q">${v.applicable ? `${f(v.admissible, chiffres(v))} ${esc(unite(v))}` : "—"}</td>
      <td class="q">${v.applicable ? `${fd(v.taux, 0)} %` : "—"}</td>
      <td>${v.applicable ? pastille(v.ok) : pastille(null)}</td></tr>`).join("")}
  </tbody></table>`;
}

/** Grandeur que vérifie chaque critère, telle qu'on la nomme sous son profil. */
export const NOM_GRANDEUR = {
  epsT: "εT à la base des couches bitumineuses — fatigue des enrobés",
  sigT: "σT à la base des couches traitées — traction par flexion",
  epsZ: "εz au sommet des sols et des graves non traitées — déformation permanente",
  sigZ: "σz en tête de plateforme — compression admissible",
};

/**
 * Profils en profondeur des grandeurs que vérifient les critères applicables : εT des
 * enrobés, σT des matériaux traités, εz des sols et GNT — ou σT et σz d'une méthode à
 * contraintes admissibles —, chacun avec ses admissibles, le critère dimensionnant
 * d'abord. Un critère seulement informatif n'appelle pas de profil.
 */
export function profilsDesCriteres(pr, couches, verification, { largeur = 600, hauteur = 300 } = {}) {
  const dim = verification.dimensionnant;
  const retenues = verification.verifs.filter((v) => v.applicable && !v.informatif).map((v) => v.grandeur);
  const grandeurs = [...new Set([dim?.grandeur, ...retenues].filter((g) => g && NOM_GRANDEUR[g]))];
  return grandeurs.map((g) => `<figure class="profil-critere"><figcaption>${g === dim?.grandeur
      ? `<strong>Critère dimensionnant</strong> · ${esc(dim.nom)}, taux ${fd(dim.taux, 0)} %`
      : "Critère vérifié"} — ${esc(NOM_GRANDEUR[g])}</figcaption>
    <div class="software-diagram">${profilProfondeur(pr, couches, g, { largeur, hauteur, admissibles: paliers(couches, verification, g) })}</div></figure>`).join("");
}

/**
 * Champs dans la structure (src/carte-champs.js) : la synthèse porte l'emplacement du bloc
 * interactif, la note celui de la carte fixe ; la coque du bureau les remplit d'elle-même
 * après le calcul principal, d'après le descripteur `champs` que rend le module.
 */
export const BLOC_CHAMPS = `<section class="champs-bloc" data-champs-bloc></section>`;
export const NOTE_CHAMPS = `<div class="champs-note" data-champs-note><p class="method-note">Carte des champs en cours de calcul…</p></div>`;

/**
 * Descripteur des champs : structure calculée, essieu, grandeur du critère dimensionnant et
 * sa ligne (base de la couche pour εT et σT, sommet pour εz et σz), repérée sur la carte.
 */
export function descChamps(module, couches, essieu, verification = null, defaut = "epsT") {
  const dim = verification?.dimensionnant;
  const grandeur = dim?.grandeur && NOM_GRANDEUR[dim.grandeur] ? dim.grandeur : defaut;
  const motif = dim ? `Carte du critère dimensionnant — ${NOM_GRANDEUR[grandeur] ?? grandeur} (${dim.nom}, taux ${fd(dim.taux, 0)} %).` : "";
  const critere = dim && grandeur === dim.grandeur && couches[dim.couche]
    ? { couche: dim.couche, base: grandeur === "epsT" || grandeur === "sigT", libelle: dim.nom } : null;
  return { module, couches, essieu, grandeur, motif, critere };
}

/** Paliers admissibles à tracer sur les profils, signés comme la grandeur comparée. */
export function paliers(couches, verification, grandeur) {
  const sommets = [0];
  for (let i = 1; i < couches.length; i++) sommets.push(sommets[i - 1] + couches[i - 1].h);
  return verification.verifs.filter((v) => v.applicable && v.grandeur === grandeur && v.admissible > 0).map((v) => {
    const c = couches[v.couche];
    const valeur = (v.unite === "bar" ? v.admissible / 10 : v.admissible) * (grandeur === "epsZ" || grandeur === "sigZ" ? 1 : -1);
    return { zHaut: sommets[v.couche], zBas: Number.isFinite(c.h) ? sommets[v.couche] + c.h : sommets[v.couche] + 1, valeur };
  });
}

/**
 * Ce que le calcul retient pour chaque ligne de saisie, d'après les couches calculées (qui
 * gardent l'indice de leur ligne, `source`) : le module et ν, proposés en gris dans les cases
 * laissées vides, et, pour une GNT que le calcul découpe, le détail des sous-couches.
 * Renvoie un tableau aligné sur les lignes : { valeurs: { E, nu }, detail } ou null.
 */
export function indicationsCouches(lignes, couches, { bouton = false } = {}) {
  return lignes.map((l, i) => {
    const cs = couches.filter((c) => c.source === i);
    if (!cs.length) return null;
    const derniere = i === lignes.length - 1;
    const valeurs = { E: cs.map((c) => f(c.E, 4)).join(" / "), nu: fd(cs[0].nu, 2) };
    let detail = null;
    if (!derniere && cs[0].famille === "sol" && cs.length > 1) {
      detail = `↳ découpée par le calcul en ${cs.length} sous-couches de ${f(cs[0].h * 100, 3)} cm ; modules de haut en bas : ${cs.map((c) => f(c.E, 4)).join(" / ")} MPa`
        + (cs[0].moduleImpose ? " (module saisi conservé)." : bouton ? ". « Subdiviser les GNT » les écrit dans le tableau." : ".");
    }
    return { valeurs, detail };
  });
}
