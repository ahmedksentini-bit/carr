// Normes françaises de produit, d'essais et de mise en œuvre (portage de
// FrenchMaterialStandards de Burmister-Calc). Elles servent telles quelles au
// profil France, et de repli lorsqu'un guide étranger ne cite pas de référence
// propre : la norme est alors marquée « à défaut » (aDefaut = true).
//
// Sources : NF P98-086 annexe F, manuel Scetauroute 2005 (annexe 4), séries
// NF EN 13108 / 13285 / 14227 / 13877, normes d'essais NF EN 12697 et NF EN 13286.

import { norme } from "./base.js";

/** Norme citée : (code, rôle, note), non marquée « à défaut » sauf demande. */
export const normeFr = (code, role, note = null, aDefaut = false) => norme(code, role, aDefaut, note);

/** Libellé d'affichage d'une norme (MaterialStandard.DisplayLabel). */
export const libelleNorme = (n) =>
  (n.aDefaut ? `${n.code}  —  ${n.role}  (à défaut : norme française)` : `${n.code}  —  ${n.role}`);

const N = normeFr;

const DIMENSIONNEMENT = [
  N("NF P98-086", "Dimensionnement", "Méthode rationnelle, essieu 130 kN, critères de fatigue."),
];

const BBSG = [
  N("NF EN 13108-1", "Produit", "Enrobés bitumineux, approche performancielle."),
  N("NF P98-130", "Spécification", "BBSG (fiche historique LCPC / manuel Scetauroute)."),
  N("NF EN 12697", "Essais", "Module complexe, fatigue, orniérage, PCG."),
  N("NF P98-150", "Mise en œuvre", "Couches de roulement / liaison en enrobé."),
];

const BBME = [
  N("NF EN 13108-1", "Produit"),
  N("NF P98-141", "Spécification", "BBME."),
  N("NF EN 12697", "Essais"),
  N("NF P98-150", "Mise en œuvre"),
];

const BBM = [
  N("NF EN 13108-1", "Produit"),
  N("NF P98-132", "Spécification", "BBM mince type A."),
  N("NF EN 12697", "Essais"),
  N("NF P98-150", "Mise en œuvre"),
];

const BBTM = [
  N("XP P98-137", "Spécification", "BBTM (très mince)."),
  N("NF EN 13108-1", "Produit"),
];

const BBDR = [
  N("NF P98-134", "Spécification", "BB drainant."),
  N("NF EN 13108-1", "Produit"),
];

const GB = [
  N("NF EN 13108-1", "Produit", "Grave-bitume en approche performancielle."),
  N("NF P98-138", "Spécification", "Grave-bitume classes 2, 3 et 4."),
  N("NF EN 12697", "Essais", "ε6 à 10 °C / 25 Hz, module à 15 °C / 10 Hz (France)."),
  N("NF EN 13043", "Granulats", "Granulats pour enrobés."),
];

const EME = [
  N("NF EN 13108-1", "Produit"),
  N("NF P98-140", "Spécification", "Enrobé à module élevé."),
  N("NF EN 12697", "Essais"),
];

const ACR = [
  N("NF EN 13108-6", "Produit", "Asphalte coulé (si ACR = mastic). À confirmer selon le document local."),
  N("NF EN 13108-1", "Produit", "Si ACR désigne un enrobé mince."),
];

const PAVE = [
  N("NF EN 1338", "Produit", "Pavés en béton."),
  N("NF P98-335", "Mise en œuvre", "Chaussées en pavés et dalles (historique)."),
];

const SABLE_POSE = [
  N("NF EN 13242", "Granulats", "Sable de pose / lit de pose."),
  N("NF P98-335", "Mise en œuvre"),
];

const ENDUIT = [
  N("NF EN 12271", "Produit", "Enduits superficiels."),
  N("NF P98-160", "Spécification", "Enduits superficiels d'usure."),
];

const ENROBE_SURFACE = [
  N("NF EN 13108-1", "Produit"),
  N("NF EN 12697", "Essais"),
  N("NF P98-150", "Mise en œuvre"),
];

const GNT = [
  N("NF EN 13285", "Produit", "Graves non traitées."),
  N("NF EN 13242", "Granulats", "Granulats pour assises."),
  N("NF EN 1097-2", "Essais", "Los Angeles."),
  N("NF EN 1097-1", "Essais", "Micro-Deval."),
  N("NF EN 933-8", "Essais", "Équivalent de sable (SE)."),
  N("NF P98-129", "Spécification", "GNT pour chaussées (historique)."),
];

const GRANULAIRE_NATUREL = [
  N("NF EN 13286-47", "Essais", "CBR / IPI."),
  N("NF EN 13286-2", "Essais", "Proctor (OPM)."),
  N("NF EN ISO 17892-12", "Essais", "Limites d'Atterberg / IP."),
  N("NF EN 13285", "Produit", "Si le matériau est spécifié comme GNT."),
];

const TRAITE_CIMENT_FAIBLE = [
  N("NF EN 197-1", "Liant", "Ciments CEM I / CEM II."),
  N("NF EN 13286-41", "Essais", "Résistance à la compression Rc."),
  N("NF EN 13286-42", "Essais", "Résistance à la traction R'c / Rit."),
  N("NF EN 13286-47", "Essais", "CBR imbibition."),
  N("NF EN 14227-1", "Produit", "Mélanges traités aux liants hydrauliques (si assimilé MTLH)."),
];

const GRAVE_CIMENT = [
  N("NF EN 14227-1", "Produit", "Grave-ciment, classes mécaniques T."),
  N("NF EN 13286-41", "Essais", "Rc."),
  N("NF EN 13286-43", "Essais", "Module de rigidité."),
];

const SABLE_CIMENT = [
  N("NF EN 14227-1", "Produit", "Sable-ciment."),
  N("NF EN 13286-41", "Essais", "Rc."),
  N("NF EN 13286-43", "Essais", "Module."),
];

const STLH = [
  N("NF EN 14227-10", "Produit", "Sols traités à la chaux."),
  N("NF EN 14227-11", "Produit", "Sols traités au ciment."),
  N("NF P98-113", "Spécification", "Sols traités aux liants hydrauliques (assise)."),
];

const BETON = [
  N("NF EN 13877-1", "Produit", "Bétons de chaussée."),
  N("NF P98-170", "Spécification", "Chaussées en béton de ciment."),
  N("NF EN 13877-2", "Essais", "Caractéristiques fonctionnelles."),
];

const BAC = [
  N("NF EN 13877-1", "Produit", "Béton armé continu, classe S2,7 (manuel Scetauroute)."),
  N("NF P98-170", "Spécification"),
];

const BANCO_COQUILLAGE = [
  N("NF EN 14227-1", "Produit", "Sol graveleux traité au ciment (guide sols traités en assises)."),
  N("NF EN 13286-41", "Essais"),
];

const PLATEFORME = [
  N("NF P98-086", "Dimensionnement", "Classes PF et module long terme."),
  N("NF P94-117-1", "Essais", "Module EV2 à la plaque."),
  N("NF EN 16907-2", "Classification", "Sols pour terrassements (GTR 2024)."),
];

const SABLE_BITUME = [
  N("NF EN 13108-1", "Produit", "Mélange bitumineux (si spécifié comme enrobé)."),
  N("NF EN 12697", "Essais"),
];

const SOL_CHAUX = [
  N("NF EN 14227-10", "Produit", "Sol traité à la chaux."),
  N("NF EN 13286-47", "Essais", "CBR."),
];

/** Listes de normes par famille de produit, exposées pour l'affichage et les tests. */
export const NORMES = Object.freeze({
  dimensionnement: DIMENSIONNEMENT, bbsg: BBSG, bbme: BBME, bbm: BBM, bbtm: BBTM, bbdr: BBDR,
  gb: GB, eme: EME, acr: ACR, pave: PAVE, sablePose: SABLE_POSE, enduit: ENDUIT,
  enrobeSurface: ENROBE_SURFACE, gnt: GNT, granulaireNaturel: GRANULAIRE_NATUREL,
  traiteCimentFaible: TRAITE_CIMENT_FAIBLE, graveCiment: GRAVE_CIMENT, sableCiment: SABLE_CIMENT,
  stlh: STLH, beton: BETON, bac: BAC, bancoCoquillage: BANCO_COQUILLAGE, plateforme: PLATEFORME,
  sableBitume: SABLE_BITUME, solChaux: SOL_CHAUX,
});

// Clé matériau normalisée → liste de normes. Les clés sont celles des
// bibliothèques de tous les pays (France, Tunisie, Sénégal, Côte d'Ivoire, CEBTP).
const TABLE = [
  [["bbsg", "bbsg1", "bbsg2", "bbsg2-3", "bbsg3"], BBSG],
  [["bbme", "bbme1", "bbme2", "bbme3"], BBME],
  [["bbm"], BBM],
  [["bbtm"], BBTM],
  [["bbdr"], BBDR],
  [["acr"], ACR],
  [["pave", "pavé"], PAVE],
  [["sable"], SABLE_POSE],
  [["gb", "gb2", "gb3", "gb4"], GB],
  [["eme", "eme1", "eme2"], EME],
  [["es", "enduit", "esu"], ENDUIT],
  [["revetement", "bb", "mb", "ts"], ENROBE_SURFACE],
  [["gnt", "gnt-be", "gnt-inv", "gnt1", "gnt2", "gnt3", "gnt-cat1", "gnt-cat2", "gnt-cat1-inv",
    "gnt (cg3)", "cg3", "con", "tvc"], GNT],
  [["gln", "gl1", "gl2", "gli", "lat", "lg0d", "lgc", "lgt", "glc", "gn", "sa", "san", "sco", "scop",
    "ban", "scoq30", "scoq50", "cor", "cors"], GRANULAIRE_NATUREL],
  [["gla", "gla1", "gla2", "saa1", "saa2", "gac", "latc", "sac", "gc", "mixc", "sgc", "banc", "corc",
    "scc"], TRAITE_CIMENT_FAIBLE],
  [["glc1", "glc2", "gct3", "gc-t3", "gc-t4", "gch-t3", "glhr-t3", "glp-t2", "glp-t3", "gcv-t3",
    "bcr-t5", "glc85", "gc85"], GRAVE_CIMENT],
  [["sc-t1", "sc-t2", "sc-t3", "sc", "bs"], SABLE_CIMENT],
  [["stlht1-f", "stlht1-g", "stlht2-f", "stlht2-g", "stlh-t1-f", "stlh-t1-g", "stlh-t2-f", "stlh-t2-g",
    "sl-t1", "sl-t2", "sl-t3"], STLH],
  [["bc2", "bc3", "bc4", "bc5", "bc5g", "bm"], BETON],
  [["bac"], BAC],
  [["bqc"], BANCO_COQUILLAGE],
  [["pf1", "pf2", "pf2qs", "pf3", "pf4", "ppf1", "ppf2", "ppf3", "ppf4", "ppf5"], PLATEFORME],
  [["sb", "sb85", "banb", "corb"], SABLE_BITUME],
  [["sch"], SOL_CHAUX],
];
const PAR_CLE = new Map(TABLE.flatMap(([cles, liste]) => cles.map((c) => [c, liste])));

/**
 * Normalisation d'une clé comme dans l'application : minuscules, espaces et
 * soulignés remplacés par des tirets (« GNT (CG3) » devient donc « gnt-(cg3) »,
 * qui retombe sur la liste de dimensionnement, comme en C#).
 */
const normaliser = (cle) => String(cle ?? "").trim().toLowerCase().replace(/ /g, "-").replace(/_/g, "-");

/** Normes françaises d'un matériau (FrenchMaterialStandards.For) ; à défaut, la NF P98-086. */
export const normesFrancaises = (cleMateriau) => PAR_CLE.get(normaliser(cleMateriau)) ?? DIMENSIONNEMENT;

/**
 * Fusionne les normes citées par le guide du pays et les normes françaises
 * manquantes, ces dernières marquées « à défaut » (FrenchMaterialStandards.Merge).
 */
export function fusionnerNormes(cleMateriau, ...citees) {
  const liste = [];
  const vus = new Set();
  for (const n of citees) {
    const k = n.code.toLowerCase();
    if (!vus.has(k)) { vus.add(k); liste.push(n); }
  }
  for (const n of normesFrancaises(cleMateriau)) {
    const k = n.code.toLowerCase();
    if (!vus.has(k)) { vus.add(k); liste.push({ ...n, aDefaut: true }); }
  }
  return liste;
}
