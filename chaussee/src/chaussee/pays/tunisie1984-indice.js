// Catalogue tunisien SETIC / DPC d'août 1984 — renforcement (portage de
// Tunisia1984StructuralIndex, Tunisia1984PavementClass et
// Tunisia1984Reinforcement de Burmister-Calc) :
//  - indice de structure SN̄ = Σ(aᵢ·hᵢ)/2,54 + ΔSN(CBR), de type AASHTO, avec
//    les coefficients aᵢ des pages 21-22 (neufs et résiduels) et ΔSN de la fig. 2 ;
//  - classe de la chaussée existante C1 (la plus faible) à C5, par la coupe
//    (tab. VI régions A/B, tab. VII région C) et/ou par SN̄ (tab. VIII) ;
//  - les 6 fiches de renforcement, indexées T1-T4 × C1-C5.
//
// Vocabulaire : région climatique "A" (nord) | "B" (sahel) | "C" (sud) ;
// revêtement "enduit" (a, enduit + granulaires) | "enrobe" (b, enrobé ≥ 5 cm) ;
// état résiduel "peu-degrade" | "fissures-ponctuelles" | "faiencage" |
// "faiencage-ouvert" ; rôle "surface" | "base" | "fondation".

import { catalogueStructures } from "./base.js";

const fr = (x, d) => String(Number(x.toFixed(d))).replace(".", ",");
const fixe = (x, d, sep = ",") => x.toFixed(d).replace(".", sep);

// ═══════════════════════ Classe de chaussée existante C1-C5 ═══════════════════════

export const CLASSES_CHAUSSEE = Object.freeze(["C1", "C2", "C3", "C4", "C5"]);

/** Tab. VIII : C1 < 2,0 ; C2 [2,0 ; 2,5[ ; C3 [2,5 ; 3,0[ ; C4 [3,0 ; 3,5[ ; C5 ≥ 3,5. */
export function classeDepuisSn(snBar) {
  if (!Number.isFinite(snBar) || snBar <= 0) return null;
  if (snBar < 2.0) return "C1";
  if (snBar < 2.5) return "C2";
  if (snBar < 3.0) return "C3";
  if (snBar < 3.5) return "C4";
  return "C5";
}

// Lignes S1-S4 ; colonnes (a, b) × bandes 13-20 … 48-65. null = case hachurée.
const TAB6 = [
  [null, "C1", "C1", "C2", "C2", "C3", "C2", "C3", "C3", "C4", "C4", "C4"],
  ["C1", "C2", "C2", "C3", "C2", "C3", "C3", "C4", "C4", "C4", "C4", "C5"],
  ["C2", "C3", "C2", "C3", "C3", "C4", "C4", "C5", "C4", "C5", "C5", "C5"],
  ["C3", "C4", "C3", "C4", "C4", "C5", "C4", "C5", "C4", "C5", null, null],
];

// Lignes S2-S4 ; colonnes (a, b) × bandes 13-20 … 34-41.
const TAB7 = [
  ["C2", "C2", "C2", "C3", "C3", "C4", "C4", "C4"],
  ["C2", "C3", "C3", "C4", "C4", "C4", "C4", "C5"],
  ["C3", "C4", "C4", "C4", "C4", "C5", "C5", null],
];

/** Bande d'épaisseur : [13,20[, [20,27[, [27,34[, [34,41[, [41,48[, [48,65] ; −1 hors domaine. */
function bande(e, sud) {
  if (e < 13) return -1;
  if (e < 20) return 0;
  if (e < 27) return 1;
  if (e < 34) return 2;
  if (e < 41) return 3;
  if (sud) return -1;
  if (e < 48) return 4;
  if (e <= 65) return 5;
  return -1;
}

const resultat = (classe, note, horsTableau = false) => ({ classe, note, horsTableau });

/**
 * Classe C par la coupe (tab. VI régions A/B, tab. VII région C).
 * `epaisseurCm` = e, corps de chaussée (fondation + base + revêtement).
 * Une case hachurée rend une classe nulle, jamais une classe inventée.
 */
export function classeDepuisCoupe(region, sol, revetement, epaisseurCm) {
  if (!Number.isFinite(epaisseurCm) || epaisseurCm <= 0)
    return resultat(null, "Saisir l'épaisseur du corps de chaussée e (cm).");
  const sud = region === "C";
  const b = bande(epaisseurCm, sud);
  if (b < 0) {
    const plage = sud ? "13 à 41 cm (Tab. VII, région C)" : "13 à 65 cm (Tab. VI, régions A/B)";
    return resultat(null, `e = ${fr(epaisseurCm, 1)} cm hors domaine ${plage}.`, true);
  }
  const s = String(sol ?? "").trim().toUpperCase();
  if (!["S1", "S2", "S3", "S4"].includes(s)) return resultat(null, "Classe de sol S1-S4 requise.");

  let ligne = s.charCodeAt(1) - "1".charCodeAt(0);
  if (sud && ligne === 0) return resultat(null, "Région C : S1 absent du Tab. VII.", true);
  if (sud) ligne -= 1;
  const enrobe = revetement === "enrobe";
  const c = (sud ? TAB7 : TAB6)[ligne][b * 2 + (enrobe ? 1 : 0)];
  if (c == null) {
    const cellule = `${s}, e=${fr(epaisseurCm, 1)} cm, type ${enrobe ? "b" : "a"}`;
    return resultat(null, `Cellule hachurée (${cellule}) : hors catalogue, pas de classe C.`, true);
  }
  const tab = sud ? "Tab. VII (région C)" : "Tab. VI (régions A/B)";
  const type = enrobe ? "b, enrobé ≥ 5 cm" : "a, enduit superficiel";
  return resultat(c, `${tab} : ${s}, e = ${fr(epaisseurCm, 1)} cm, type ${type} → ${c}.`);
}

/**
 * Combine la classe de la coupe et celle de SN̄. En désaccord, la plus faible
 * (C1 < C5) est retenue : renforcement plus épais, côté sûr.
 */
export function combinerClasses(coupe, classeSn) {
  if (coupe?.classe && classeSn && coupe.classe.toLowerCase() !== classeSn.toLowerCase()) {
    const faible = coupe.classe < classeSn ? coupe.classe : classeSn;
    return resultat(faible, `${coupe.note} Tab. VIII (SN̄) → ${classeSn}. Désaccord : ${faible} retenu (plus faible).`);
  }
  if (coupe?.classe) return coupe;
  if (classeSn) return resultat(classeSn, `Tab. VIII : SN̄ → ${classeSn}.`);
  return coupe ?? resultat(null, "Pas assez d'éléments pour classer la chaussée existante.");
}

// ═══════════════════════ Indice de structure SN̄ ═══════════════════════

const CBR_FIG2 = [4, 7, 10, 15, 20, 30, 50];
const DSN_FIG2 = [0.44, 1.10, 1.48, 1.84, 2.06, 2.26, 2.45];

/** ΔSN lu sur la fig. 2 (CBR en échelle logarithmique) ; NaN sous CBR 3. */
export function deltaSnDepuisCbr(cbr) {
  if (!Number.isFinite(cbr) || cbr < 3) return NaN;
  const c = CBR_FIG2, d = DSN_FIG2;
  if (cbr <= c[0]) return d[0];
  if (cbr >= c[c.length - 1]) return d[d.length - 1];
  for (let i = 1; i < c.length; i++) {
    if (cbr > c[i]) continue;
    const t = (Math.log(cbr) - Math.log(c[i - 1])) / (Math.log(c[i]) - Math.log(c[i - 1]));
    return d[i - 1] + t * (d[i] - d[i - 1]);
  }
  return d[d.length - 1];
}

const CBR_DE_CLASSE = { S0: 4, S1: 7, S2: 10, S3: 15, S4: 30 };

/** ΔSN d'une classe de sol S0-S4 (CBR représentatif de la classe) ; NaN sinon. */
export function deltaSnDepuisSol(sol) {
  const cbr = CBR_DE_CLASSE[String(sol ?? "").trim().toUpperCase()];
  return cbr == null ? NaN : deltaSnDepuisCbr(cbr);
}

/**
 * Annexe II : CBR caractéristique pondéré (moyenne géométrique). Poids
 * imbibé / avant imbibition : région A 0,50 / 0,50 ; B 0,33 / 0,67 ; C 0,17 / 0,83.
 */
export function cbrCaracteristique(imbibe, nonImbibe, region) {
  if (imbibe <= 0 || nonImbibe <= 0) return NaN;
  const [pHumide, pSec] = region === "B" ? [0.33, 0.67] : region === "C" ? [0.17, 0.83] : [0.5, 0.5];
  return 10 ** (pHumide * Math.log10(imbibe) + pSec * Math.log10(nonImbibe));
}

/** Ch. III : S0 < 5 ; S1 5-8 ; S2 8-12 ; S3 12-20 ; S4 > 20. */
export function classeSolDepuisCbr(cbr) {
  if (!Number.isFinite(cbr) || cbr <= 0) return null;
  if (cbr < 5) return "S0";
  if (cbr < 8) return "S1";
  if (cbr < 12) return "S2";
  if (cbr < 20) return "S3";
  return "S4";
}

/** Nature d'une couche au sens des tables aᵢ (clé matériau, puis nom, puis famille). */
function nature(c) {
  const cle = String(c.materiau ?? "").trim().toUpperCase();
  const nom = String(c.nom ?? "").toUpperCase();
  if (cle === "MC" || cle === "BC" || nom.includes("ENDUIT") || nom.includes("MONOCOUCHE") || nom.includes("BICOUCHE"))
    return "enduit";
  if (cle === "BB" || nom.includes("BETON BITUM") || nom.includes("BÉTON BITUM")) return "bb";
  if (nom.includes("ENROBE OUVERT") || nom.includes("ENROBÉ OUVERT")) return "ouvert";
  if (cle === "GB" || nom.includes("GRAVE-BITUME") || nom.includes("GRAVE BITUME")) return "gb";
  if (cle === "GC") return "gc";
  if (cle === "GLY" || cle === "SCLY") return "gly";
  if (cle === "GLX" || cle === "SCLX") return "glx";
  if (cle === "GR" || cle === "GRH") return "gr";
  if (cle === "T" || nom.includes("TUF")) return "t";
  if (cle === "SG") return "sg";
  if (cle === "G" || cle === "GNT") return "g";
  return c.famille === "bitumineux" ? "bb" : c.famille === "hydraulique" ? "gc" : c.famille === "sol" ? "g" : null;
}

const enduitAi = (etat, e, residuel) => {
  if (!residuel) return 0.10;
  const b = e < 3 ? 0 : e < 6 ? 1 : 2;
  if (etat === "peu-degrade") return [0.10, 0.14, 0.18][b];
  if (etat === "fissures-ponctuelles") return [0.09, 0.12, 0.16][b];
  return [0.08, 0.10, 0.14][b];
};

const bbAi = (etat, residuel) =>
  (residuel ? (etat === "faiencage-ouvert" ? 0.14 : etat === "faiencage" ? 0.20 : 0.30) : 0.39);

const ouvertAi = (etat, residuel) =>
  (residuel ? (etat === "faiencage-ouvert" ? 0.14 : etat === "faiencage" ? 0.16 : 0.25) : 0.30);

function gbAi(etat, residuel, role) {
  if (role === "surface") return NaN;
  if (!residuel) return 0.28;
  return etat === "faiencage" || etat === "faiencage-ouvert" ? 0.14 : 0.20;
}

// Neuf : a2 ; résiduel : ayant fait prise (haut / bas selon le sol) ou comme une GNT.
function hydAi(a2Neuf, etat, residuel, fort, role) {
  if (role === "surface") return NaN;
  if (!residuel) return a2Neuf;
  if (etat === "peu-degrade") return fort ? 0.18 : 0.14;
  return fort ? 0.14 : 0.10;
}

// Coefficients granulaires : [neuf a2 (sol faible, fort), neuf a3 (faible, fort),
// résiduel a2 bon (faible, fort), a2 dégradé, a3 bon, a3 dégradé].
function granAi(k, role, etat, residuel, fort) {
  const [n2f, n2s, n3f, n3s, a2bf, a2bs, a2mf, a2ms, a3bf, a3bs, a3mf, a3ms] = k;
  const fond = role === "fondation";
  if (!residuel) return fond ? (fort ? n3s : n3f) : (fort ? n2s : n2f);
  const bon = etat === "peu-degrade";
  if (fond) return bon ? (fort ? a3bs : a3bf) : (fort ? a3ms : a3mf);
  return bon ? (fort ? a2bs : a2bf) : (fort ? a2ms : a2mf);
}

const GRANULAIRES = {
  gr: [0.16, 0.16, 0.13, 0.16, 0.14, 0.15, 0.12, 0.13, 0.11, 0.12, 0.10, 0.11],
  g: [0.15, 0.15, 0.13, 0.15, 0.13, 0.14, 0.11, 0.12, 0.11, 0.12, 0.10, 0.11],
  t: [0.14, 0.14, 0.12, 0.14, 0.11, 0.13, 0.07, 0.10, 0.10, 0.11, 0.07, 0.09],
  sg: [0.12, 0.12, 0.10, 0.12, 0.10, 0.11, 0.07, 0.09, 0.09, 0.10, 0.07, 0.09],
};

/**
 * Coefficient aᵢ d'une couche (p. 21-22) : `role`, `etat` résiduel, épaisseur
 * (cm), sol fort (S3-S4), `residuel` (chaussée en place) ou neuf. Renvoie
 * { ai } ou { ai: null, manque } quand le matériau ou la case n'est pas tabulé.
 */
export function coefficientAi(couche, role, etat, epaisseurCm, solFort, residuel) {
  const k = nature(couche);
  if (k == null) return { ai: null, manque: `Matériau « ${couche.materiau ?? couche.nom} » hors tables aᵢ.` };
  let ai;
  switch (k) {
    case "enduit": ai = enduitAi(etat, epaisseurCm, residuel); break;
    case "bb": ai = bbAi(etat, residuel); break;
    case "ouvert": ai = ouvertAi(etat, residuel); break;
    case "gb": ai = gbAi(etat, residuel, role); break;
    case "gc": ai = hydAi(0.22, etat, residuel, solFort, role); break;
    case "gly": ai = hydAi(0.23, etat, residuel, solFort, role); break;
    case "glx": ai = hydAi(0.22, etat, residuel, solFort, role); break;
    default: ai = granAi(GRANULAIRES[k], role, etat, residuel, solFort);
  }
  if (!Number.isFinite(ai) || ai <= 0) return { ai: null, manque: `aᵢ non tabulé pour ${k} en ${role}.` };
  return { ai };
}

function role(i, n, c) {
  const k = nature(c);
  if (k === "enduit" || k === "bb" || k === "ouvert") return "surface";
  if (n >= 3 && i === n - 1) return "fondation";
  return "base";
}

/**
 * SN̄ résiduel de la chaussée en place : couches d'épaisseur finie (le support
 * est ignoré), coefficients résiduels selon l'état, ΔSN du CBR s'il est donné,
 * sinon de la classe de sol. Renvoie { sn, deltaSn, snBar, classe, couches
 * [{ nature, epCm, ai, role }], alertes, resume }.
 */
export function snResiduel(couches, sol, etat, cbr = 0) {
  const finies = couches.filter((c) => Number.isFinite(c.h) && c.h > 0);
  const alertes = [];
  const lignes = [];
  const s = String(sol ?? "").toUpperCase();
  const fort = s === "S3" || s === "S4";
  finies.forEach((c, i) => {
    const r = role(i, finies.length, c);
    const cm = c.h * 100;
    const { ai, manque } = coefficientAi(c, r, etat, cm, fort, true);
    if (ai == null) { alertes.push(manque ?? `Couche « ${c.nom} » sans aᵢ tabulé : ignorée.`); return; }
    lignes.push({ nature: c.nom, epCm: cm, ai, role: r });
  });

  const sn = lignes.reduce((t, l) => t + l.ai * l.epCm, 0) / 2.54;
  let deltaSn = cbr > 0 ? deltaSnDepuisCbr(cbr) : deltaSnDepuisSol(sol);
  if (!Number.isFinite(deltaSn)) {
    alertes.push("ΔSN : saisir S1-S4 ou un CBR caractéristique (Fig. 2).");
    deltaSn = 0;
  }
  const snBar = sn + deltaSn;
  const classe = lignes.length === 0 ? null : classeDepuisSn(snBar);
  const termes = lignes.map((l) => `${fixe(l.ai, 2, ".")}×${fr(l.epCm, 1)}`).join(" + ");
  const resume = `SN = (${termes}) / 2,54 = ${fixe(sn, 2)} ; ΔSN = ${fixe(deltaSn, 2)} ; SN̄ = ${fixe(snBar, 2)}`
    + (classe == null ? "." : ` → ${classe}.`) + (alertes.length ? " " + alertes.join(" ") : "");
  return { sn, deltaSn, snBar, classe, couches: lignes, alertes, resume };
}

// ═══════════════════════ Fiches de renforcement 1984 ═══════════════════════
//
// 6 fiches (scans p048-p055), indexées T1-T4 × C1-C5 (qualité résiduelle de la
// chaussée existante). Les cellules « voir fiches… » sont omises ; enduit
// bicouche = 2 cm par convention. Provisoire.

const SRC = "Catalogue Tunisie 1984";

const l = (nature, epCm, famille, materiau) => ({ nature, epCm, famille, materiau, interface: null });
const bc = () => l("Enduit bicouche", 2, "bitumineux", "BC");
const bb = (cm) => l("Béton bitumineux", cm, "bitumineux", "BB");

const r = (famille, page, c, trafic, couches, note = null) => ({
  classeTrafic: trafic, classePortance: c, famille, couches, source: `${SRC}, ${page}`,
  provisoire: true, note, intervention: "renforcement",
});

const F1 = "Fiche 1 — renforcement GR / GRH";
const F1B = "Fiche 1bis — renforcement grave concassée G";
const F2 = "Fiche 2 — renforcement tuf compact (régions IV-V)";
const F3 = "Fiche 3 — renforcement grave-bitume";
const F4 = "Fiche 4 — renforcement grave laitier";
const F5 = "Fiche 5 — renforcement béton bitumineux";

const GLX = "Épaisseurs = GLY. GLX : majorer la couche traitée de 10 %.";

export const FICHES_RENFORCEMENT_1984 = [
  // ---- Fiche 1 (p-055) GR — T2 tabulé ; T1 → 3-4-5 ; T3-T4 → 1bis et 2 ----
  r(F1, "p-055", "C2", "T2", [bb(5), l("GR (renfort)", 30, "sol", "GR")]),
  r(F1, "p-055", "C3", "T2", [bb(5), l("GR (renfort)", 25, "sol", "GR")]),
  r(F1, "p-055", "C3", "T2", [bc(), l("GR (renfort)", 15, "sol", "GR"), l("GR (reprofilage)", 20, "sol", "GR")], "Variante bicouche (reprofilage 15 cm mini)."),
  r(F1, "p-055", "C4", "T2", [bb(5), l("GR (renfort)", 17, "sol", "GR")]),
  r(F1, "p-055", "C4", "T2", [bc(), l("GR (renfort)", 25, "sol", "GR")], "Variante bicouche."),
  r(F1, "p-055", "C5", "T2", [bc(), l("GR (renfort)", 20, "sol", "GR")]),

  // ---- Fiche 1bis (p-054) G 0/31,5 — T3-T4 ; T2 → fiche 1 ----
  r(F1B, "p-054", "C2", "T3", [bc(), l("G (renfort)", 35, "sol", "G")], "15 cm minimum en reprofilage."),
  r(F1B, "p-054", "C3", "T3", [bc(), l("G (renfort)", 15, "sol", "G"), l("G (reprofilage)", 20, "sol", "G")], "15 cm minimum en reprofilage."),
  r(F1B, "p-054", "C4", "T3", [bc(), l("G (renfort)", 25, "sol", "G")]),
  r(F1B, "p-054", "C5", "T3", [bc(), l("G (renfort)", 20, "sol", "G")]),
  r(F1B, "p-054", "C2", "T4", [bc(), l("G (renfort)", 30, "sol", "G")]),
  r(F1B, "p-054", "C3", "T4", [bc(), l("G (renfort)", 25, "sol", "G")]),
  r(F1B, "p-054", "C4", "T4", [bc(), l("G (renfort)", 15, "sol", "G")]),

  // ---- Fiche 2 (p-053) tuf — T3-T4 ; T2 → 1 et 1bis ----
  r(F2, "p-053", "C2", "T3", [bb(6), l("Tuf (renfort)", 30, "sol", "T")], "Régions IV et V."),
  r(F2, "p-053", "C2", "T3", [bc(), l("Tuf (renfort)", 20, "sol", "T"), l("Tuf (reprofilage)", 20, "sol", "T")], "Régions IV et V. Variante bicouche."),
  r(F2, "p-053", "C3", "T3", [bb(6), l("Tuf (renfort)", 25, "sol", "T")], "Régions IV et V."),
  r(F2, "p-053", "C3", "T3", [bc(), l("Tuf (renfort)", 35, "sol", "T")], "Régions IV et V. Variante bicouche."),
  r(F2, "p-053", "C4", "T3", [bb(6), l("Tuf (renfort)", 20, "sol", "T")], "Régions IV et V."),
  r(F2, "p-053", "C4", "T3", [bc(), l("Tuf (renfort)", 30, "sol", "T")], "Régions IV et V. Variante bicouche."),
  r(F2, "p-053", "C5", "T3", [bc(), l("Tuf (renfort)", 20, "sol", "T")], "Régions IV et V."),
  r(F2, "p-053", "C2", "T4", [bc(), l("Tuf (renfort)", 35, "sol", "T")], "Régions IV et V."),
  r(F2, "p-053", "C3", "T4", [bc(), l("Tuf (renfort)", 30, "sol", "T")], "Régions IV et V."),
  r(F2, "p-053", "C4", "T4", [bc(), l("Tuf (renfort)", 20, "sol", "T")], "Régions IV et V."),

  // ---- Fiche 3 (p-052) GB — T1-T2 ; T3-T4 → 1, 1bis, 2 ----
  r(F3, "p-052", "C1", "T1", [bb(5), l("GB (renfort)", 20, "bitumineux", "GB")]),
  r(F3, "p-052", "C2", "T1", [bb(5), l("GB (renfort)", 17, "bitumineux", "GB")]),
  r(F3, "p-052", "C3", "T1", [bb(5), l("GB (renfort)", 14, "bitumineux", "GB")]),
  r(F3, "p-052", "C4", "T1", [bb(5), l("GB (renfort)", 11, "bitumineux", "GB")]),
  r(F3, "p-052", "C5", "T1", [bb(5), l("GB (renfort)", 8, "bitumineux", "GB")]),
  r(F3, "p-052", "C1", "T2", [bb(5), l("GB (renfort)", 17, "bitumineux", "GB")]),
  r(F3, "p-052", "C1", "T2", [bc(), l("GB (renfort)", 23, "bitumineux", "GB")], "Variante bicouche."),
  r(F3, "p-052", "C2", "T2", [bb(5), l("GB (renfort)", 14, "bitumineux", "GB")]),
  r(F3, "p-052", "C2", "T2", [bc(), l("GB (renfort)", 20, "bitumineux", "GB")], "Variante bicouche."),
  r(F3, "p-052", "C3", "T2", [bb(5), l("GB (renfort)", 11, "bitumineux", "GB")]),
  r(F3, "p-052", "C3", "T2", [bc(), l("GB (renfort)", 17, "bitumineux", "GB")], "Variante bicouche."),
  r(F3, "p-052", "C4", "T2", [bb(5), l("GB (renfort)", 8, "bitumineux", "GB")]),
  r(F3, "p-052", "C4", "T2", [bc(), l("GB (renfort)", 13, "bitumineux", "GB")], "Variante bicouche."),
  r(F3, "p-052", "C5", "T2", [bc(), l("GB (renfort)", 10, "bitumineux", "GB")]),

  // ---- Fiche 4 (p-051) GL — T1-T2 ; T3-T4 → 1, 1bis, 2 ----
  r(F4, "p-051", "C1", "T1", [bb(5), l("GLY (renfort)", 29, "hydraulique", "GLY")], GLX),
  r(F4, "p-051", "C2", "T1", [bb(5), l("GLY (renfort)", 25, "hydraulique", "GLY")], GLX),
  r(F4, "p-051", "C3", "T1", [bb(5), l("GLY (renfort)", 20, "hydraulique", "GLY")], GLX),
  r(F4, "p-051", "C4", "T1", [bb(5), l("GLY (renfort)", 15, "hydraulique", "GLY")], GLX),
  r(F4, "p-051", "C1", "T2", [bb(5), l("GLY (renfort)", 25, "hydraulique", "GLY")], GLX),
  r(F4, "p-051", "C2", "T2", [bb(5), l("GLY (renfort)", 20, "hydraulique", "GLY")], GLX),
  r(F4, "p-051", "C2", "T2", [bc(), l("GLY (renfort)", 28, "hydraulique", "GLY")], GLX + " Variante bicouche."),
  r(F4, "p-051", "C3", "T2", [bb(5), l("GLY (renfort)", 15, "hydraulique", "GLY")], GLX),
  r(F4, "p-051", "C3", "T2", [bc(), l("GLY (renfort)", 23, "hydraulique", "GLY")], GLX + " Variante bicouche."),
  r(F4, "p-051", "C4", "T2", [bc(), l("GLY (renfort)", 19, "hydraulique", "GLY")], GLX),

  // ---- Fiche 5 (p-048) BB — overlay bitumineux (parfois 2 couches) ----
  r(F5, "p-048", "C4", "T1", [bb(7), bb(7)], "Deux couches de BB (7+7)."),
  r(F5, "p-048", "C5", "T1", [bb(6), bb(6)], "Deux couches de BB (6+6)."),
  r(F5, "p-048", "C4", "T2", [bb(6), bb(6)], "Deux couches de BB (6+6)."),
  r(F5, "p-048", "C5", "T2", [bb(8)]),
  r(F5, "p-048", "C5", "T3", [bb(6)], "En traversée urbanisée ou si problème de seuils."),
];

export const CATALOGUE_RENFORCEMENT_1984 = catalogueStructures({
  pays: "tunisie1984",
  reference: "Catalogue Tunisie 1984 — renforcement (6 fiches, T×C)",
  fiches: FICHES_RENFORCEMENT_1984,
  cle: "classe-trafic",
});
