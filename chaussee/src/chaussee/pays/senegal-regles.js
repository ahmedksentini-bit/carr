// Règles propres au catalogue Sénégal 2015 : subdivision des graves non
// traitées (portage de SenegalGntSubdivider) et emploi des matériaux d'assise
// selon le trafic (portage de SenegalMaterialRules). Fonctions pures.

import { nombreSousCouches } from "./base.js";

const SOUS_COUCHE = 0.25;   // m

const estSupport = (couches, i) => i === couches.length - 1 || couches[i].h === Infinity;
const estGntHorsSupport = (couches, i) => couches[i].famille === "sol" && !estSupport(couches, i);
const cleOuNom = (c) => String(c.materiau ?? c.nom ?? "").toLowerCase();

/** (rapport K, module de base, latérite ?) d'après la clé, à défaut le nom du matériau. */
function familleGrave(c) {
  const s = cleOuNom(c);
  // « later » de la source ; « latér » couvre les noms accentués du site.
  if (s.startsWith("gl") || s.includes("later") || s.includes("latér"))
    return { k: 2, eBase: s.includes("gl1") ? 200 : 400, laterite: true };
  return { k: 3, eBase: 600, laterite: false };   // GNT concassée par défaut
}

const libelleFamille = (laterite) => (laterite ? "latérite" : "GNT concassée");

/**
 * Subdivision des GNT selon le catalogue Sénégal 2015 (chap. 7, p-085 et p-078).
 *  - GNT concassée (clé « GNT ») : couche de base E = 600 MPa ; fondation en
 *    sous-couches ≤ 25 cm, Eᵢ = 3 × Eᵢ₋₁, plafonnée à 600 MPa en structure
 *    GNT/GNT ou à 360 MPa en structure GNT/GB (fondation sous grave-bitume) ;
 *  - latérite (GL1 / GL2 / GLi / GLa) : Eᵢ = 2 × Eᵢ₋₁, plafonnée au module de
 *    base — GL1 = 200 MPa, GL2 / GLi / GLa = 400 MPa.
 * La couche de base (grave directement sous les enrobés, sur une fondation
 * granulaire) prend un module fixe et n'est pas subdivisée ; la fondation est
 * calculée de bas en haut en une seule passe (idempotente).
 */
export function subdiviserGntSenegal(couches) {
  const res = [], role = [], rapport = [], plafond = [], eFixe = [];
  const passive = (c) => { res.push(c); role.push("passive"); rapport.push(0); plafond.push(0); eFixe.push(0); };

  couches.forEach((c, i) => {
    if (!estGntHorsSupport(couches, i)) return passive({ ...c });
    const { k, eBase, laterite } = familleGrave(c);
    const surBitumineux = i > 0 && couches[i - 1].famille === "bitumineux";
    const surGnt = i > 0 && couches[i - 1].famille === "sol";
    let gntDessous = false;
    for (let j = i + 1; j < couches.length; j++) if (estGntHorsSupport(couches, j)) { gntDessous = true; break; }

    if (surBitumineux && gntDessous) {   // grave d'assise sur une fondation granulaire
      res.push({ ...c, nom: `${c.nom} [base ${libelleFamille(laterite)} ${eBase}]` });
      role.push("base"); rapport.push(0); plafond.push(0); eFixe.push(eBase);
      return;
    }
    // Fondation : GNT concassée → 600 (GNT/GNT) ou 360 (GNT/GB) ; latérite → module de base.
    const cap = laterite ? eBase : (surGnt ? 600 : 360);
    const n = Math.max(nombreSousCouches(c.h, SOUS_COUCHE), 1);
    for (let s = 0; s < n; s++) {
      res.push({ ...c, h: c.h / n,
        nom: n === 1 ? `${c.nom} [fond. ${libelleFamille(laterite)}]` : `${c.nom} ${s + 1}/${n} [fond. ${libelleFamille(laterite)}]` });
      role.push("fondation"); rapport.push(k); plafond.push(cap); eFixe.push(0);
    }
  });

  // Passe ascendante unique : E = min(K × E_dessous, plafond) ; la base garde son module fixe.
  let dessous = res.length ? res[res.length - 1].E : 0;
  for (let i = res.length - 1; i >= 0; i--) {
    if (res[i].moduleImpose) { /* module saisi : conservé */ } else if (role[i] === "fondation") res[i].E = Math.min(rapport[i] * dessous, plafond[i]);
    else if (role[i] === "base") res[i].E = eFixe[i];
    dessous = res[i].E;
  }
  return { couches: res, alertes: [] };
}

// ───────────────────────── Emploi des matériaux ────────────────────────────

/** Ordre croissant des classes de trafic : « emploi ≤ Tx » = rang(classe) ≤ rang(Tx). */
export const ORDRE_TRAFIC = ["T5", "T4", "T3", "T2", "T1", "T0", "TS", "TEX"];

/** Emploi maximal (classe) en base / en fondation ; null = pas de limite de trafic. */
export const REGLES_EMPLOI = {
  gnt: { maxBase: null, maxFondation: null, libelle: "GNT concassée" },
  gl1: { maxBase: "T3", maxFondation: "T1", libelle: "GL1 (latérite crue cl.1)" },
  gl2: { maxBase: "T1", maxFondation: "T1", libelle: "GL2 (latérite crue cl.2)" },
  gli: { maxBase: "T1", maxFondation: "T1", libelle: "GLi (latérite litho-stabilisée)" },
  gla: { maxBase: "T1", maxFondation: "T1", libelle: "GLa (latérite améliorée ciment)" },
  glc1: { maxBase: "T4", maxFondation: "T4", libelle: "GLc1 (latérite-ciment)" },
  glc2: { maxBase: "T2", maxFondation: "T2", libelle: "GLc2 (latérite-ciment)" },
  gc: { maxBase: null, maxFondation: null, libelle: "GC-T3 (grave-ciment cl.3)" },
  sc: { maxBase: "T5", maxFondation: "T1", libelle: "SC-T2 (sable-ciment cl.2)" },
};

const rang = (nom) => (nom == null ? -1 : ORDRE_TRAFIC.indexOf(String(nom).trim().toUpperCase()));

function regleDe(c) {
  const s = cleOuNom(c);
  // Les clés les plus spécifiques d'abord.
  if (s.includes("glc1")) return REGLES_EMPLOI.glc1;
  if (s.includes("glc2")) return REGLES_EMPLOI.glc2;
  if (s.includes("gl1")) return REGLES_EMPLOI.gl1;
  if (s.includes("gl2")) return REGLES_EMPLOI.gl2;
  if (s.includes("gli") || s.includes("glli")) return REGLES_EMPLOI.gli;
  if (s.includes("gla")) return REGLES_EMPLOI.gla;
  if (s.startsWith("gc") || s.includes("grave-ciment") || s.includes("grave ciment")) return REGLES_EMPLOI.gc;
  if (s.startsWith("sc") || s.includes("sable-ciment") || s.includes("sable ciment")) return REGLES_EMPLOI.sc;
  if (s.startsWith("gnt")) return REGLES_EMPLOI.gnt;
  return null;
}

/**
 * Emploi des matériaux d'assise du catalogue Sénégal 2015 selon la classe de
 * trafic journalier choisie (T5..TEX) : GL1 base ≤ T3 et fondation ≤ T1 ;
 * GL2, GLi, GLa assise ≤ T1 ; GLc1 ≤ T4 ; GLc2 ≤ T2 ; GC-T3 tout trafic ;
 * SC-T2 base ≤ T5 et fondation ≤ T1. Une couche est « de base » quand elle est
 * posée directement sous un enrobé. Renvoie les défauts (vide si conforme).
 */
export function validerEmploiSenegal(couches, nomClasseTrafic) {
  const sel = rang(nomClasseTrafic);
  if (sel < 0) return [];   // pas de classe : pas de vérification de trafic
  const alertes = [];
  couches.forEach((c, i) => {
    if (estSupport(couches, i) || c.famille === "bitumineux") return;   // enrobés validés ailleurs
    const regle = regleDe(c);
    if (!regle) return;
    const base = i > 0 && couches[i - 1].famille === "bitumineux";
    const role = base ? "couche de base" : "couche de fondation";
    const max = base ? regle.maxBase : regle.maxFondation;
    if (max == null) return;
    if (sel > rang(max))
      alertes.push(`${regle.libelle} en ${role} : emploi limité au trafic ${max} `
        + `(classe ${ORDRE_TRAFIC[sel]} sélectionnée) — catalogue Sénégal 2015.`);
  });
  return alertes;
}
