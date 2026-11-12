// Outils partagés par les profils Sénégal, Côte d'Ivoire et pays tropicaux :
// fabriques de matériaux (même forme que materiaux.js), lecture des cellules
// de catalogue, construction d'une structure de calcul à partir d'une fiche.
// Le repli Alizé des interfaces et l'injection d'une fiche (portages de
// AlizeInterfaceRules et de StructureViewModel.BuildLayersFromTemplate) sont
// ceux d'interfaces-alize.js, réexportés ici.

import { couchesDeFiche } from "./interfaces-alize.js";

export { typeAlize, lireInterface, interfacesPourFiche, couchesDeFiche, OPTIONS_CATALOGUE } from "./interfaces-alize.js";

// ───────────────────────────── Matériaux ───────────────────────────────────

/**
 * Matériau bitumineux. `moinsInvB` = −1/b. eps6 = NaN : couche non vérifiée en
 * fatigue. Sans table E(T), `moduleImpose` est le module de calcul (sinon E10).
 */
export const materiauBitumineux = (cle, E10, eps6, moinsInvB, SN, kc,
  { tableE = null, note = null, nu = 0.35, moduleImpose = null } = {}) =>
  ({ cle, famille: "bitumineux", E10, eps6, b: -1 / moinsInvB, SN, kc, tableE, nu, note,
     ...(moduleImpose != null ? { moduleImpose } : {}) });

/** Sol ou grave non traitée : critère εz,adm = A · NE^pente. A = NaN : critère non défini. */
export const materiauSol = (cle, E, Afaible, Afort, pente = -0.222, nu = 0.35) =>
  ({ cle, famille: "sol", E, Afaible, Afort, pente, nu });

/** Matériau traité aux liants hydrauliques ou béton. Sh en m ; E = module de calcul (0 : non imposé). */
export const materiauHydraulique = (cle, sigma6, moinsInvB, SN, Sh, kc, kd, { nu = 0.25, E = 0 } = {}) =>
  ({ cle, famille: "hydraulique", sigma6, b: -1 / moinsInvB, SN, Sh, kc, kd, nu, E });

/** Recherche EXACTE d'une clé dans une famille de la bibliothèque d'un profil. */
export function materiauDeFamille(profil, famille, cle) {
  if (cle == null) return null;
  const liste = famille === "bitumineux" ? profil.materiaux.bitumineux
    : famille === "hydraulique" ? profil.materiaux.hydrauliques
    : famille === "sol" ? profil.materiaux.sols : [];
  return liste.find((m) => m.cle === cle) ?? null;
}

// ───────────────────────────── Mise en forme ───────────────────────────────

/** Nombre à la française, au plus `dec` décimales, sans zéros inutiles (format « 0.## »). */
export function nombre(x, dec = 2) {
  if (!Number.isFinite(x)) return String(x);
  const t = Number(x.toFixed(dec)).toString();
  return t.replace(".", ",");
}

/** Indice de la classe « Tn » (1 pour T1…), 0 si illisible. */
export function rangTrafic(t) {
  if (typeof t !== "string" || t.length < 2) return 0;
  const n = Number.parseInt(t.slice(1), 10);
  return Number.isFinite(n) && String(n) === t.slice(1).trim() ? n : 0;
}

// ─────────────────────────── Cellules de catalogue ─────────────────────────

/** « CODE:cm/CODE:cm » → [{ code, cm }] ; un code sans épaisseur prend `defautCm`. */
export function decouperSpec(spec, defautCm = null) {
  return spec.split("/").map((t) => t.trim()).filter(Boolean).map((tok) => {
    const [code, cm] = tok.split(":");
    const ep = cm === undefined ? defautCm : Number(cm);
    if (!Number.isFinite(ep)) throw new Error(`épaisseur illisible dans « ${spec} »`);
    return { code: code.trim(), cm: ep };
  });
}

/** Couche de fiche : { nature, epCm, famille, materiau, interface }. */
export const coucheFiche = (nature, epCm, famille, materiau = null, iface = null) =>
  ({ nature, epCm, famille, materiau, interface: iface });

// ─────────────────────── Construction d'une structure ──────────────────────

/**
 * Structure complète d'une fiche de chaussée neuve : couches de la fiche
 * (matériau du pays appliqué par sa clé, interfaces de la fiche ou repli
 * Alizé) et support semi-infini au module de la classe de portance (50 MPa à
 * défaut), doté des paramètres du sol correspondant, sinon des coefficients
 * génériques A = 16 000 / 12 000 et pente −0,222. Renvoie { couches, manquants }.
 */
export const construireStructure = (profil, fiche, { teq, classePortance } = {}) =>
  couchesDeFiche(profil, fiche, { teq, classePortance });

/**
 * Fiche de renforcement : les couches d'apport sont posées AU-DESSUS de la
 * chaussée existante (modélisée par ailleurs, support compris), qui est conservée.
 */
export const construireApport = (profil, fiche, existant, { teq } = {}) =>
  couchesDeFiche(profil, fiche, { teq, existant });
