// Contrat commun des profils de dimensionnement par pays (portage de
// IDesignProfile / DesignProfileBase de Burmister-Calc). Un profil est un objet
// simple ; `creerProfil(def)` complète ce que le pays ne redéfinit pas.
//
// Vocabulaire (identique dans tous les modules) :
//   famille        "bitumineux" | "hydraulique" | "sol"
//   intervention   "neuve" | "renforcement" | "hybride"
//   typeStructure  "souple" | "bitumineuse-epaisse" | "semi-rigide" | "inverse" | "mixte" | "beton"
//   modulesResiduels "aucun" | "carotte-paroi" | "senegal" | "tropical"
//
// Paramètres de projet (portage de DesignParameters) — objet `p` :
//   { pays, intervention, mja, taux (%/an), annees, croissanceVariable, periodes [{annees, taux}],
//     cam (global), camParFamille { famille: cam }, risque (%), niveauTrafic "fort"|"faible",
//     teq (°C), ks (1 | 1/1.1 | 1/1.2 | "support"), typeStructure, classeTrafic, classePortance,
//     classeQualite, reseauStructurant, … champs propres à un pays }

import { nplPeriodeUnique, multiPeriodes } from "../cumul.js";
import { fractileDuRisque } from "../fractile.js";
import { BITUMINEUX, SOLS, HYDRAULIQUES } from "../materiaux.js";
import { ligneA } from "../burmister.js";

export const FAMILLES = ["bitumineux", "hydraulique", "sol"];
export const INTERVENTIONS = ["neuve", "renforcement", "hybride"];
export const TYPES_STRUCTURE = ["souple", "bitumineuse-epaisse", "semi-rigide", "inverse", "mixte", "beton"];

// ─────────────────────────── Paramètres de trafic ──────────────────────────

/** Paramètres par défaut d'un projet (mêmes valeurs que l'application). */
export const parametresParDefaut = () => ({
  pays: "france", intervention: "neuve",
  mja: 300, taux: 2, annees: 20, croissanceVariable: false, periodes: [],
  cam: 0.8, camParFamille: {}, risque: 5, niveauTrafic: "fort", teq: 15, ks: 1,
  typeStructure: "bitumineuse-epaisse",
  classeTrafic: null, classePortance: null, classeQualite: null, reseauStructurant: false,
});

/** NPL cumulé : multi-périodes si la croissance est variable, sinon période unique. */
export const nplDe = (p) =>
  (p.croissanceVariable && p.periodes?.length
    ? multiPeriodes(p.mja, p.periodes).npl
    : nplPeriodeUnique(p.mja, p.taux, p.annees));

/** CAM d'une famille : valeur saisie, sinon proposition du profil. */
export const camDe = (p, famille, profil) => p.camParFamille?.[famille] ?? profil.camPour(famille).cam;

/** NE d'une famille : NPL × CAM(famille). */
export const neDe = (p, famille, profil) => nplDe(p) * camDe(p, famille, profil);

/** NE des trois familles, sous la forme attendue par criteres.verifier. */
export const neParFamille = (p, profil) =>
  Object.fromEntries(FAMILLES.map((f) => [f, neDe(p, f, profil)]));

export const uDe = (p) => fractileDuRisque(p.risque);

// ─────────────────────────────── Classes ───────────────────────────────────

/** Classe de trafic : { nom, mjaMin, mjaMax, classeRisque, provisoire, note }, bornes [min, max[. */
export const classeTrafic = (nom, mjaMin, mjaMax, extra = {}) => ({ nom, mjaMin, mjaMax, ...extra });

/** Classe de NE cumulé (millions), bornes [min, max[. */
export const classeNe = (nom, min, max, note = null) => ({ nom, min, max, note });
export const dansClasseNe = (c, ne) => (c.min == null || ne >= c.min) && (c.max == null || ne < c.max);

/** Classe de portance : { nom, module (MPa), cbrMin, provisoire, note }. */
export const classePortance = (nom, module, extra = {}) => ({ nom, module, ...extra });

/**
 * Table de risque : entrées { structure, famille, classe, risque, provisoire, note }.
 * La proposition retient l'entrée la plus spécifique (structure et famille renseignées).
 */
export function catalogueRisque(entrees = [], note = null) {
  return {
    entrees, note,
    proposer(structure, famille, classe) {
      if (classe == null) return null;
      let meilleure = null, score = -1;
      for (const e of entrees) {
        if (String(e.classe).toLowerCase() !== String(classe).toLowerCase()) continue;
        if (e.structure && structure && e.structure !== structure) continue;
        if (e.famille && famille && e.famille !== famille) continue;
        const s = (e.structure ? 1 : 0) + (e.famille ? 1 : 0);
        if (s > score) { meilleure = e; score = s; }
      }
      return meilleure?.risque ?? null;
    },
  };
}

/**
 * Catalogue de structures types : fiches { classeTrafic, classePortance, famille,
 * couches [{ nature, epCm, famille, materiau, interface }], source, provisoire, note,
 * intervention }. `cle` : "classe-trafic" | "classe-ne" | "classe-cumulee".
 */
export function catalogueStructures({ pays, reference, fiches, cle = "classe-trafic" }) {
  const eq = (a, b) => a == null || String(a).toLowerCase() === String(b).toLowerCase();
  return {
    pays, reference, fiches, cle,
    chercher: (classeTrafic, classePortance) =>
      fiches.filter((f) => eq(classeTrafic, f.classeTrafic) && eq(classePortance, f.classePortance)),
  };
}

export const epaisseurTotaleCm = (fiche) => fiche.couches.reduce((s, c) => s + c.epCm, 0);

// ─────────────────────────── Fiches matériaux ──────────────────────────────

/** Fiche matériau : emploi, normes, exigences, paramètres de calcul. */
export const fiche = (code, nom, famille, source, emploi, normes, sections, cles = null) =>
  ({ code, nom, famille, source, emploi, normes, sections, cles: cles?.length ? cles : [code] });
export const norme = (code, role, aDefaut = false, note = null) => ({ code, role, aDefaut, note });
export const section = (titre, lignes, intro = null) => ({ titre, lignes, intro });
export const ligne = (libelle, valeur, norme = null, note = null) => ({ libelle, valeur, norme, note });

/** Fiches retenues pour les couches d'une structure (clé matériau, sinon nom). */
export function fichesRetenues(profil, couches) {
  const trouver = (cle) => (cle ? profil.fiches.find((f) => f.cles.some((k) => k.toLowerCase() === String(cle).toLowerCase())) : null);
  const res = [];
  for (const c of couches) {
    const f = trouver(c.materiau) ?? trouver(c.nom);
    if (f && !res.includes(f)) res.push(f);
  }
  return res;
}

// ─────────────────────────── Subdivision des GNT ───────────────────────────

/** Règle : { epMax (m), rapport, plafond (MPa), note }. Neutre : aucune subdivision. */
export const SUBDIVISION_NEUTRE = Object.freeze({ epMax: Infinity, rapport: 1, plafond: Infinity, note: "Pas de subdivision particulière." });

export function nombreSousCouches(h, epMax) {
  if (!(epMax > 0) || epMax === Infinity || h <= epMax) return 1;
  return Math.ceil(h / epMax - 1e-9);
}

/**
 * Scinde chaque GNT (hors support) en sous-couches d'épaisseur ≤ epMax, puis
 * affecte de bas en haut E = min(rapport × E_dessous, plafond). Avec la règle
 * neutre (rapport = 1), ou pour une couche dont le module est imposé
 * (`moduleImpose`), les modules saisis sont conservés.
 */
export function subdiviserGnt(couches, regle) {
  const res = [], gnt = [];
  couches.forEach((c, i) => {
    const derniere = i === couches.length - 1;
    const estGnt = c.famille === "sol" && !derniere && Number.isFinite(c.h);
    const n = estGnt ? nombreSousCouches(c.h, regle.epMax) : 1;
    if (n <= 1) { res.push({ ...c }); gnt.push(estGnt); return; }
    for (let k = 0; k < n; k++) {
      res.push({ ...c, nom: `${c.nom} ${k + 1}/${n}`, h: c.h / n });
      gnt.push(true);
    }
  });
  if (regle.rapport > 1) {
    let dessous = res.length ? res[res.length - 1].E : 0;
    for (let i = res.length - 1; i >= 0; i--) {
      if (gnt[i] && !res[i].moduleImpose) res[i].E = Math.min(regle.rapport * dessous, regle.plafond);
      dessous = res[i].E;
    }
  }
  return res;
}

// ─────────────────────── Vérification déterministe ─────────────────────────

export const BAR_PAR_MPA = 10;

/**
 * Vérification par contraintes admissibles tabulées (catalogues LBTP 1977 et
 * CEBTP) : traction en base des couches liées, compression en tête de
 * plateforme, en bar. `regles` : { methode, tractionBar(i, couche, couches, p)
 * → { bar, note } | null, compressionBar(p) → { bar, note } }.
 */
export function verifierDeterministe(couches, analyse, p, regles) {
  const verifs = [];
  const sommets = [0];
  for (let i = 1; i < couches.length; i++) sommets.push(sommets[i - 1] + couches[i - 1].h);
  const na = (i, critere, grandeur, motif) => verifs.push({
    couche: i, nom: couches[i].nom, famille: couches[i].famille, critere, grandeur, unite: "bar",
    applicable: false, ok: null, motif, sollicitation: NaN, admissible: NaN, taux: NaN, coefs: {} });

  couches.forEach((c, i) => {
    if (c.famille !== "bitumineux" && c.famille !== "hydraulique") return;
    const adm = regles.tractionBar(i, c, couches, p);
    if (!adm) return;
    const l = ligneA(analyse, sommets[i] + c.h, true);
    if (!l) return na(i, `Traction admissible (${regles.methode})`, "sigT", "pas de sollicitation calculée à la base");
    const s = (l.sigT < 0 ? -l.sigT : 0) * BAR_PAR_MPA;
    verifs.push({ couche: i, nom: c.nom, famille: c.famille, critere: `Traction admissible en base (${regles.methode})`,
      formule: "σt ≤ σt,adm (contrainte admissible tabulée, bar)", grandeur: "sigT", unite: "bar",
      applicable: true, sollicitation: s, admissible: adm.bar, taux: (s / adm.bar) * 100, ok: s <= adm.bar,
      motif: adm.note + (l.sigT >= 0 ? " Couche entièrement comprimée : critère non dimensionnant." : ""), coefs: {} });
  });

  const der = couches.length - 1;
  const comp = regles.compressionBar(p);
  const l = ligneA(analyse, sommets[der], false);
  if (!l) na(der, `Compression plateforme (${regles.methode})`, "sigZ", "pas de sollicitation au sommet du sol");
  else {
    const s = Math.abs(l.sigZ) * BAR_PAR_MPA;
    verifs.push({ couche: der, nom: couches[der].nom, famille: couches[der].famille,
      critere: `Compression admissible en tête de plateforme (${regles.methode})`,
      formule: "σz ≤ σz,adm (contrainte admissible de la plateforme, bar)", grandeur: "sigZ", unite: "bar",
      applicable: true, sollicitation: s, admissible: comp.bar, taux: (s / comp.bar) * 100, ok: s <= comp.bar,
      motif: comp.note, coefs: {} });
  }
  const applicables = verifs.filter((v) => v.applicable);
  return { verifs, deterministe: true, ok: applicables.every((v) => v.ok),
           dimensionnant: applicables.reduce((m, v) => (!m || v.taux > m.taux ? v : m), null) };
}

// ─────────────────────────────── Profil ────────────────────────────────────

const CONSEIL = {
  renforcement: "Renforcement : caler d'abord les modules de la chaussée existante par rétrocalcul, puis dimensionner la couche de renforcement.",
  hybride: "Hybride : reconstruction partielle. Caler par rétrocalcul la partie conservée, puis dimensionner les couches neuves.",
  neuve: "Chaussée neuve : dimensionnement complet à partir de la portance du support.",
};

/**
 * Complète la définition d'un pays avec les comportements par défaut de
 * DesignProfileBase. Champs attendus au minimum : id, nom, reference,
 * teqPropose(intervention), cam [{ famille, cam, provisoire, note }],
 * subdivisionGnt(intervention).
 */
export function creerProfil(def) {
  const p = {
    provisoire: false, noteProvisoire: null,
    interventions: [...INTERVENTIONS],
    materiaux: { bitumineux: BITUMINEUX, sols: SOLS, hydrauliques: HYDRAULIQUES },
    glossaire: [], fiches: [],
    classesTrafic: [], classesNe: [], classesPortance: [],
    risque: catalogueRisque(),
    catalogue: null, catalogueRenforcement: null, plateforme: null,
    fatigueRationnelle: true,
    modulesResiduels: "carotte-paroi",
    plafondGnt: "cerema2016",
    validerEmploi: () => [],
    verifierDeterministe: () => null,
    classerTraficCumule: () => null,
    classerNpl: () => null,
    libelleClasseRisque: () => null,
    recommandeRetrocalcul: (i) => i === "renforcement" || i === "hybride",
    conseilStructure: (i) => CONSEIL[i] ?? CONSEIL.neuve,
    ...def,
  };
  p.camPour ??= (famille) => p.cam.find((c) => c.famille === famille)
    ?? { famille, cam: 1, provisoire: true, note: "Aucune valeur tabulée pour cette famille : valeur neutre 1,0, à confirmer." };
  p.subdiviserGnt ??= (couches, contexte = {}) =>
    ({ couches: subdiviserGnt(couches, p.subdivisionGnt(contexte.intervention ?? "neuve")), alertes: [] });
  p.classerTrafic ??= (mja) => p.classesTrafic.find((c) =>
    !(c.mjaMin == null && c.mjaMax == null)
    && (c.mjaMin == null || mja >= c.mjaMin) && (c.mjaMax == null || mja < c.mjaMax)) ?? null;
  p.classerNe ??= (neM) => p.classesNe.find((c) => dansClasseNe(c, neM)) ?? null;
  p.classerTraficDe ??= (par) => p.classerTrafic(par.mja) ?? p.classerNpl(nplDe(par) / 1e6);
  p.classeTraficNommee ??= (nom) => p.classesTrafic.find((c) => c.nom === nom) ?? null;
  p.besoinModeleExistant ??= (i) => p.recommandeRetrocalcul(i) && !p.catalogueRenforcement && p.fatigueRationnelle;
  p.materiau ??= (cle) => p.materiaux.bitumineux.find((m) => m.cle === cle)
    ?? p.materiaux.sols.find((m) => m.cle === cle) ?? p.materiaux.hydrauliques.find((m) => m.cle === cle) ?? null;
  return p;
}
