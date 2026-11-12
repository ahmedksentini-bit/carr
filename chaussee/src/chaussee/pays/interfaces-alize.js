// Repli des conditions d'interface quand une fiche de catalogue ne les précise
// pas (portage d'AlizeInterfaceRules de Burmister-Calc). Source : fenêtre
// Alizé-LCPC « Interfaces, Guide LCPC-SETRA 1994 et NF P98-086 ». Une interface
// imposée par la fiche (couche.interface) reste prioritaire.
//
// Ce module porte aussi l'injection d'une fiche dans le moteur
// (couchesDeFiche) : matériaux du pays appliqués par clé, interfaces Alizé,
// support semi-infini au module de la classe de portance — comme l'onglet
// Structure de l'application.
//
// Interfaces rendues : "collee" | "glissante" | "semi-collee", une par couche
// de la fiche (la dernière est le contact avec le support).

import { appliquer } from "../materiaux.js";

/** Types de structure au sens de la table d'interfaces d'Alizé. */
export const TYPES_ALIZE = Object.freeze(["souple", "bitumineuse", "inverse", "mixte", "semi-rigide", "beton"]);

/**
 * Options absentes des catalogues d'épaisseurs (cases d'Alizé). Repli
 * catalogue : mixte en phase 2, fondation sans membrane de cure, pas d'étude
 * globale, BAC sur GB3 âgé de 0 à 15 ans.
 */
export const OPTIONS_CATALOGUE = Object.freeze({
  /** Mixte phase 2 : base / fondation glissante. Phase 1 = toutes couches collées. */
  mixtePhase2: true,
  /** Fondation / support avec membrane de cure → glissante. */
  membraneCureFondation: false,
  /** Étude globale SETRA : fondation / support glissante. */
  etudeGlobale: false,
  /** BAC sur GB3 après 15 ans → glissante (collée de 0 à 15 ans). */
  bacSurGb3PlusDe15Ans: false,
});

// Comparaison insensible à la casse, mais PAS aux accents — comme
// StringComparison.OrdinalIgnoreCase en C# : « Béton » ne contient pas « beton ».
const contient = (texte, aiguille) => !!texte && texte.toLowerCase().includes(aiguille.toLowerCase());

/** Jeton d'une couche : clé matériau, sinon nature ; minuscules, é/è ramenés à e. */
const jeton = (c) => String(c.materiau ?? c.nature ?? "").trim().toLowerCase().replace(/[éè]/g, "e");

/** Lit une interface écrite dans une fiche ; null si absente ou illisible. */
export function lireInterface(texte) {
  if (texte == null || !String(texte).trim()) return null;
  const t = String(texte).trim().toLowerCase().replace(/[éè]/g, "e");
  if (["glissante", "glissant", "sliding"].includes(t)) return "glissante";
  if (["semi-collee", "semi collee", "1/2 collee", "1/2-collee", "semibonded"].includes(t)) return "semi-collee";
  if (["collee", "colle", "bonded"].includes(t)) return "collee";
  return null;
}

const estBeton = (c) => {
  const t = jeton(c);
  if (["bac", "bm", "bc2", "bc3", "bc5", "bc5g"].includes(t)) return true;
  if (t.startsWith("bc") && t.length <= 5 && t !== "bc") return true;
  const n = c.nature ?? "";
  if (contient(n, "dalle")) return true;
  if (contient(n, "beton arme") || contient(n, "beton maigre")) return true;
  return contient(n, "beton") && !contient(n, "bitum");
};

const estTraitee = (c) => c.famille === "hydraulique" && !estBeton(c);

const estBitumineuseSurface = (c) => {
  const t = jeton(c);
  if (["bb", "bbsg", "bbsg1", "bbsg2", "bbsg3", "bbsg2-3", "es", "esu", "bbm", "bbtm", "bbdr", "acr", "mb",
       "ts", "revetement", "pave"].includes(t)) return true;
  return ["roulement", "enduit", "pave", "bicouche", "tricouche", "enrobe"].some((m) => contient(c.nature, m));
};

const estBaseBitumineuse = (c) => {
  const t = jeton(c);
  if (t.startsWith("gb") || t.startsWith("eme") || ["sb", "sb85", "banb", "corb"].includes(t)) return true;
  return ["grave-bitume", "sable-bitume", "enrobe module"].some((m) => contient(c.nature, m));
};

const estGb3 = (c) => jeton(c).startsWith("gb3");
const estBitumineuse = (c) => c.famille === "bitumineux" || estGb3(c) || estBitumineuseSurface(c) || estBaseBitumineuse(c);
const estGcv = (c) => jeton(c) === "gcv" || contient(c.nature, "gcv");
const estGc4 = (c) => ["gc4", "gc-t4", "gct4"].includes(jeton(c));
const estGlg = (c) => jeton(c) === "glg" || contient(c.nature, "laitier");

/** Type de structure Alizé, lu sur le libellé de la fiche, sinon déduit des couches. */
export function typeAlize(famille, couches = []) {
  if (contient(famille, "inverse")) return "inverse";
  if (contient(famille, "mixte")) return "mixte";
  if (contient(famille, "semi-rigide") || contient(famille, "semi rigide")) return "semi-rigide";
  if (contient(famille, "beton") || contient(famille, "béton")) return "beton";
  if (contient(famille, "souple")) return "souple";
  if (contient(famille, "bitumineuse") || contient(famille, "tout bitume")) return "bitumineuse";

  const beton = couches.some(estBeton);
  const traitee = couches.some(estTraitee);
  const baseBit = couches.some(estBaseBitumineuse);
  if (beton) return "beton";
  if (traitee && baseBit) return "mixte";
  if (traitee) return "semi-rigide";
  if (baseBit || couches.filter((c) => c.famille === "bitumineux").length >= 2) return "bitumineuse";
  return "souple";
}

function contactSupport(opt, traiteeOuBeton) {
  if (!traiteeOuBeton) return "collee";
  if (opt.etudeGlobale || opt.membraneCureFondation) return "glissante";
  return "collee";   // sans cure
}

// Phase 1 : toutes couches collées ; phase 2 : base / fondation glissante, autres collées.
function mixte(haut, bas, surSupport, opt) {
  if (!opt.mixtePhase2 || surSupport || !bas) return "collee";
  if (estBitumineuse(haut) && (estTraitee(bas) || estBeton(bas))) return "glissante";
  return "collee";
}

function semiRigide(haut, bas, surSupport, opt) {
  if (bas && estGcv(haut) && estGcv(bas)) return "glissante";
  if (bas && estGc4(haut) && estGc4(bas)) return "glissante";
  if (bas && estGlg(haut) && estGlg(bas)) return "collee";
  if (surSupport) return contactSupport(opt, estTraitee(haut) || estBeton(haut));
  // Roulement / base : première couche bitumineuse de surface sur l'assise.
  if (estBitumineuseSurface(haut) && bas && (estTraitee(bas) || estBeton(bas))) return "collee";
  // Base / fondation en autres matériaux → semi-collée.
  if (estTraitee(haut) && bas) return "semi-collee";
  return "collee";
}

function beton(haut, bas, surSupport, opt, goujonne) {
  if (estBitumineuseSurface(haut) && bas) return "collee";
  if (bas && estBeton(haut) && estGb3(bas)) {
    if (goujonne) return "semi-collee";
    return opt.bacSurGb3PlusDe15Ans ? "glissante" : "collee";
  }
  if (estGb3(haut) && surSupport) return "collee";
  if (bas && estBeton(haut) && (estBeton(bas) || estTraitee(bas))) return "glissante";
  if (surSupport) return contactSupport(opt, estTraitee(haut) || estBeton(haut));
  return "collee";
}

/**
 * Interface sous chaque couche d'une fiche { famille, couches [{ nature,
 * famille, materiau, interface }] } ; la dernière est le contact avec le
 * support. Les options manquantes prennent le repli catalogue.
 */
export function interfacesPourFiche(fiche, options = {}) {
  const opt = { ...OPTIONS_CATALOGUE, ...options };
  const couches = fiche.couches;
  const type = typeAlize(fiche.famille, couches);
  const goujonne = contient(fiche.famille, "goujonn");
  return couches.map((c, i) => {
    const imposee = lireInterface(c.interface);
    if (imposee) return imposee;
    const surSupport = i === couches.length - 1;
    const bas = surSupport ? null : couches[i + 1];
    switch (type) {
      case "mixte": return mixte(c, bas, surSupport, opt);
      case "semi-rigide": return semiRigide(c, bas, surSupport, opt);
      case "beton": return beton(c, bas, surSupport, opt, goujonne);
      default: return "collee";   // souple, bitumineuse, inverse
    }
  });
}

// ─────────────────────────── Injection d'une fiche ───────────────────────────

const chercher = (liste, cle) => (cle == null ? null : liste?.find((m) => m.cle === cle) ?? null);

/**
 * Convertit une fiche de catalogue en couches de calcul, comme l'onglet
 * Structure de l'application :
 *  - chaque couche reçoit nom = nature, h (m), ν = 0,35, E = 500 MPa, puis les
 *    paramètres du matériau du pays trouvé par sa clé (module à θeq pour un
 *    bitumineux, module de dimensionnement d'un traité s'il en a un) ;
 *  - l'interface vient de la fiche, sinon du repli Alizé ;
 *  - sans `existant`, un support semi-infini est ajouté : module de la classe
 *    de portance (50 MPa à défaut), critère du sol de même nom s'il existe,
 *    sinon critère générique (A = 16 000 / 12 000, pente −0,222).
 * Une fiche de renforcement se pose sur `existant` (couches de la chaussée en
 * place), sans support ajouté.
 *
 * Renvoie { couches, manquants } — manquants : matériaux cités par la fiche et
 * absents de la bibliothèque du pays (couches sans critère).
 */
export function couchesDeFiche(profil, fiche, { teq, classePortance, existant = null, options = {} } = {}) {
  const t = teq ?? profil.teqPropose(fiche.intervention ?? "neuve");
  const ifaces = interfacesPourFiche(fiche, options);
  const manquants = [];
  const couches = fiche.couches.map((sl, i) => {
    const base = { nom: sl.nature, h: sl.epCm / 100, nu: 0.35, E: 500, interface: ifaces[i] };
    const m = sl.famille === "bitumineux" ? chercher(profil.materiaux.bitumineux, sl.materiau)
      : sl.famille === "hydraulique" ? chercher(profil.materiaux.hydrauliques, sl.materiau)
        : sl.famille === "sol" ? chercher(profil.materiaux.sols, sl.materiau) : null;
    if (m) return appliquer(base, m, { teq: t });
    if (sl.famille == null) return { ...base, famille: null };
    manquants.push(sl.materiau ?? sl.nature);
    return { ...base, famille: sl.famille, materiau: sl.materiau ?? null };
  });
  if (existant) return { couches: [...couches, ...existant.map((c) => ({ ...c }))], manquants };

  const nomPortance = classePortance ?? fiche.classePortance;
  const portance = profil.classesPortance.find((b) => b.nom === nomPortance) ?? null;
  let support = {
    nom: portance ? `Sol support ${portance.nom}` : "Sol support",
    E: portance?.module ?? 50, nu: 0.35, h: Infinity, interface: "collee",
  };
  const sol = portance ? chercher(profil.materiaux.sols, portance.nom) : null;
  support = sol ? appliquer(support, sol, { garderModule: true })
    : { ...support, famille: "sol", sol: { Afaible: 16000, Afort: 12000, pente: -0.222 } };
  return { couches: [...couches, support], manquants };
}
