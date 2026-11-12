// Fiches matériaux France (portage de FranceDatasheets de Burmister-Calc) :
// NF P98-086 annexe F (paramètres de calcul) et manuel Scetauroute 2005
// (autoroutes), annexe 4 (normes produit, seuils E / ε6 à 15 °C / 10 Hz).

import { fiche, section, ligne } from "./base.js";
import { normesFrancaises } from "./normes-francaises.js";

// Fabriques au plus près de la syntaxe des fiches C# (Sheets.Of / Sec / R) :
// les clés éventuelles précèdent les blocs, l'introduction éventuelle précède
// les lignes.
const feuille = (code, nom, famille, source, emploi, normes, ...reste) => {
  const cles = Array.isArray(reste[0]) && typeof reste[0][0] === "string" ? reste.shift() : null;
  return fiche(code, nom, famille, source, emploi, normes, reste, cles);
};
const bloc = (titre, ...reste) => {
  const intro = typeof reste[0] === "string" ? reste.shift() : null;
  return section(titre, reste, intro);
};

const SRC = "NF P98-086:2011 annexe F ; Manuel Scetauroute 2005 (autoroutes) annexe 4";

const fr = (cle) => normesFrancaises(cle);

const bbsg = () => feuille("BBSG", "Béton bitumineux semi-grenu",
  "bitumineux", SRC,
  "Roulement / liaison. Classes 1, 2 et 3. Fatigue si utilisé en assise (catalogue : surface).",
  fr("BBSG"),
  ["BBSG1", "BBSG2", "BBSG3"],
  bloc("Emploi (fiche 1, autour des specs)",
    "Roulement / liaison. Classe 2 si trafic < t0 ; classe 3 si ≥ t0 (NF P98-130). " +
    "Liant usuel 35/50 (EN 12591). Fatigue seulement si utilisé en assise (catalogue : surface). " +
    "E et ε6 des fiches sont des seuils produit ; ν, −1/b, SN/Sh, kc : NF P98-086 / guide SETRA 1994.",
    ligne("Granularité", "0/10 ou 0/14"),
    ligne("Roulement / liaison", "Bnc, LA20, MDE15, PSV50, Ang 1 / Cnc, LA25, MDE20, Ang 2")),
  bloc("Mélange (fiche 1 p. 106)",
    ligne("K 0/10 / 0/14", "≥ 3,5 / ≥ 3,3"),
    ligne("PCG 10 gir. / 60 gir. 0/10 / 80 gir. 0/14", "V ≥ 11 % ; 5-8 % ; 4-8 %"),
    ligne("Duriez 18 °C r/R", "≥ 0,75"),
    ligne("Orniérage 60 °C / 30 000 c. (vides 5-8)", "cl. 2 ≤ 7,5 % ; cl. 3 ≤ 5 %")),
  bloc("Norme produit (manuel Scetauroute, fiche 1)",
    ligne("Spécification", "NF P98-130"),
    ligne("ε6 mini (10 °C, 25 Hz)", "≥ 120 µdéf", "NF P98-261-1"),
    ligne("E mini (15 °C, 10 Hz)", "≥ 7000 MPa", "NF P98-260-2"),
    ligne("Module de richesse", "≥ 3,5 (0/10) ; ≥ 3,3 (0/14)")),
  bloc("Calcul NF P98-086 (annexe F)",
    ligne("BBSG1 E10 / ε6 / kc / SN", "7315 MPa / 100 / 1,1 / 0,25"),
    ligne("BBSG2-3 E10 / ε6 / kc / SN", "9310 MPa / 100 / 1,1 / 0,25"),
    ligne("E(T) 10 Hz", "Table −10…40 °C (annexe F)"),
    ligne("ν", "0,35"),
    ligne("Teq de convention", "15 °C / 10 Hz"),
    ligne("Note annexe F", "Teq 15 °C / 10 Hz est une convention de calcul (pas une température de chantier). Les E(T) de l'annexe F servent à kθ.")));

const bbme = () => feuille("BBME", "Béton bitumineux à module élevé",
  "bitumineux", SRC,
  "Roulement / liaison à module élevé. Classes 1 à 3.",
  fr("BBME"),
  ["BBME1", "BBME2", "BBME3"],
  bloc("Emploi (fiche 2)",
    "Roulement / liaison à module élevé, classes 1 à 3. Convention E : 15 °C / 10 Hz ; ε6 : 10 °C / 25 Hz. " +
    "K ≥ 3,5 (0/10) et ≥ 3,3 (0/14) comme le BBSG.",
    ligne("Teq de convention", "15 °C / 10 Hz (pas une température de chantier)")),
  bloc("Norme produit (fiche 2)",
    ligne("Spécification", "NF P98-141"),
    ligne("ε6 mini", "≥ 100 µdéf"),
    ligne("E mini (15 °C, 10 Hz)", "≥ 12000 MPa")),
  bloc("Calcul annexe F",
    ligne("BBME1 E10", "11970 MPa, ε6=100, kc=1,1"),
    ligne("BBME2-3 E10", "14630 MPa, ε6=100, kc=1,1")));

const bbm = () => feuille("BBM", "Béton bitumineux mince type A",
  "bitumineux", SRC,
  "Couche de roulement mince, non fatiguée (fiche 5, cl. 3).",
  fr("BBM"),
  bloc("Emploi (fiche 5 / fig. 1)",
    "Surface mince type A, classe 3. Non fatiguée. Variantes catalogue : BBM+5 BB, BBM+3 GB…",
    ligne("Fatigue", "Non (surface)")),
  bloc("Norme produit (fiche 5)",
    ligne("Spécification", "NF P98-132"),
    ligne("Fatigue", "Non (surface)"),
    ligne("Emploi catalogue", "Variante de surface (BBM+5 BB, BBM+3 GB…)")));

const bbtm = () => feuille("BBTM", "Béton bitumineux très mince",
  "bitumineux", SRC,
  "Surface très mince, cl. 1 (fiche 3). Requise sur chaussée béton.",
  fr("BBTM"),
  bloc("Emploi (fiche 3 p. 114)",
    "Surface très mince, classe 1. Non fatiguée. Requise sur chaussée béton (fig. 7). " +
    "Aussi fig. 3 / 3bis (souple / inverse EME).",
    ligne("K 0/16 / 0/10", "≥ 3,5 / ≥ 3,4"),
    ligne("PCG 25 gir. 0/6 / 0/10", "12-20 % / 10-18 %"),
    ligne("Duriez 18 °C r/R", "≥ 0,80"),
    ligne("Orniérage 60 °C / 3 000 c. dalle 5 cm", "0/6 ≤ 20 % (vides 16-22) ; 0/10 ≤ 15 % (vides 9-16)")),
  bloc("Norme produit (fiche 3)",
    ligne("Spécification", "XP P98-137"),
    ligne("Fatigue", "Non (surface)"),
    ligne("Emploi", "Fig. 3 / 3bis / 7 (surface sur BAC)")));

const bbdr = () => feuille("BBDr", "Béton bitumineux drainant",
  "bitumineux", SRC,
  "Surface drainante, cl. 1 (fiche 4).",
  fr("BBDr"),
  bloc("Emploi (fiche 4 / fig. 1)",
    "Surface drainante, classe 1. Non fatiguée. Variante catalogue BBDR+5 BB.",
    ligne("Fatigue", "Non (surface)")),
  bloc("Norme produit (fiche 4)",
    ligne("Spécification", "NF P98-134"),
    ligne("Fatigue", "Non (surface)"),
    ligne("Emploi", "Variante BBDR+5 BB (fig. 1)")));

const gb2 = () => gb("GB2", 80, 11880, "≥ 80 µdéf (classe 2)", "—");
const gb3 = () => gb("GB3", 90, 11880, "≥ 90 µdéf", "≥ 9000 MPa");
const gb4 = () => gb("GB4", 100, 14300, "≥ 100 µdéf", "≥ 11000 MPa");

const gb = (code, epsi6, e10, epsiNorme, eNorme) =>
  feuille(code, `Grave-bitume classe ${code.at(-1)}`,
    "bitumineux", SRC,
    "Assise bitumineuse.",
    fr("GB3"),
    bloc("Emploi (fiche 6 p. 123-124)",
      "Fondation et base, classes 3 et 4 (NF P98-138). 0/14 ou 0/20. Liant usuel 35/50. " +
      "Manuel : durée souple / tout-bitume 15 ans ; CAM GB/GB = 0,8 (CU ≥ 50 kN). " +
      "Δe max profil : 3 cm (0/14 et 0/20) — variation transversale, pas un découpage de calcul.",
      ligne("Fondation / base gravillons", "Dnc LA30 MDE25 / Cnc LA25 MDE20 ; Ang 2"),
      ligne("PCG cl. 3 / cl. 4", "V ≤ 10 % / ≤ 9 % (120 gir. si e ≥ 12 cm ; 100 gir. si 9-11 cm)"),
      ligne("Duriez 18 °C r/R", "≥ 0,70"),
      ligne("Orniérage 60 °C", "cl. 3 ≤ 10 % (10 000 c., vides 7-10) ; cl. 4 ≤ 5 % (30 000 c., vides 5-8)")),
    bloc("Norme produit (fiche 6, NF P98-138)",
      ligne("ε6 mini", epsiNorme),
      ligne("E mini (15 °C, 10 Hz)", eNorme),
      ligne("Richesse", "≥ 2,8 (cl.3) / ≥ 2,9 (cl.4)")),
    bloc("Calcul annexe F",
      ligne("E10 (10 °C, 10 Hz)", `${e10} MPa`),
      ligne("ε6", `${epsi6} µdéf`),
      ligne("kc / SN / −1/b", "1,3 / 0,30 / 5"),
      ligne("ν", "0,35"),
      ligne("Teq de convention", "15 °C / 10 Hz est une convention de calcul (pas une température de chantier).")));

const eme1 = () => eme("EME1", 100, "0,30", "classe 1");
const eme2 = () => eme("EME2", 130, "0,25", "classe 2");

const eme = (code, epsi6, sn, classe) =>
  feuille(code, `Enrobé à module élevé ${classe}`,
    "bitumineux", SRC,
    "Assise à fort trafic.",
    fr("EME2"),
    bloc("Emploi (fiche 7 p. 128)",
      "Assise à fort trafic, classe 2 au catalogue (fig. 3, 5). Durée tout-bitume 15 ans ; CAM EME = 1 (CU ≥ 50 kN). " +
      "Δe max profil : 2 cm (0/10) / 3 cm (0/14).",
      ligne("PCG 80 gir. 0/10 / 100 gir. 0/14", "V ≤ 5 %"),
      ligne("Duriez 18 °C r/R", "≥ 0,75"),
      ligne("Orniérage 60 °C / 30 000 c. (vides 3-6)", "≤ 5 %")),
    bloc("Norme produit (fiche 7, NF P98-140)",
      ligne("ε6 mini (cl. 2)", "≥ 130 µdéf"),
      ligne("E mini (15 °C, 10 Hz, cl. 2)", "≥ 14000 MPa"),
      ligne("Richesse", "≥ 3,4")),
    bloc("Calcul annexe F",
      ligne("E10", "16940 MPa"),
      ligne("ε6", `${epsi6} µdéf`),
      ligne("kc / SN", `1,0 / ${sn}`, null, "NF P98-086, tableau F.7 : SN 0,30 (EME1), 0,25 (EME2)."),
      ligne("ν", "0,35"),
      ligne("Teq de convention", "15 °C / 10 Hz est une convention de calcul (pas une température de chantier).")));

const gnt = () => feuille("GNT", "Grave non traitée",
  "sol", SRC,
  "Assise granulaire. Modules du tableau F.1 de la NF P98-086 : base fixe selon la catégorie, fondation en sous-couches ≤ 0,25 m.",
  fr("GNT"),
  ["GNT1", "GNT2", "GNT3"],
  bloc("Emploi (fiche 11 p. 142 + fig. 1)",
    "Assise granulaire. Figures du Manuel : GNT en une couche de 25 cm (souple). " +
    "Δe max profil 5 cm (0/14 ou 0/20) : variation transversale, PAS une règle de subdivision mécanistique. " +
    "Le module et le découpage ≤ 0,25 m viennent de NF P98-086, pas de cette fiche (compacité seulement).",
    ligne("Densité chantier", "95 % des points ≥ 98 % OPM (planche + journalier)"),
    ligne("Nivellement / épaisseur", "95 % ± 1 cm ; 97,5 % > e−2 cm"),
    ligne("Flaches 3 m", "1,5 cm travers ; 1,0 cm long")),
  bloc("Norme produit (fiche 11)",
    ligne("Produit", "NF EN 13285"),
    ligne("Compacité OPM", "≥ 82 % recomposée / ≥ 80 % non recomposée")),
  bloc("Calcul",
    ligne("Base, trafic ≤ T3 : cat. 1 / 2 / 3", "600 / 400 / 200 MPa"),
    ligne("Fondation, trafic ≤ T3", "sous-couches ≤ 0,25 m : E1 = 3 × E plate-forme, puis k × la précédente", null,
      "k = 3 / 2,5 / 2 (cat. 1 / 2 / 3), borné au module de base de la catégorie (NF P98-086, tableau F.1)."),
    ligne("Fondation, trafic T2-T1", "k = 3, borné à 360 MPa (bitumineuse épaisse)"),
    ligne("A (εz)", "16000 (trafic faible) / 12000 (trafic fort)"),
    ligne("Pente", "−0,222"),
    ligne("ν", "0,35")));

const gntInv = () => feuille("GNT-inv", "GNT structure inverse",
  "sol", SRC,
  "Structure inverse : module de calcul 480 MPa.",
  fr("GNT"),
  bloc("Emploi (fig. 2 / 2bis)",
    "Structure inverse sur PF4. Module de calcul 480 MPa (NF P98-086), pas dans la fiche 11 du Manuel.",
    ligne("E", "480 MPa")),
  bloc("Dimensionnement",
    ligne("E", "480 MPa"),
    ligne("A", "19200 / 14400 µdéf", null, "Trafic faible / fort : 1,2 × 16000 / 1,2 × 12000 (NF P98-086, éq. 21 et 22).")));

const gntBe = () => feuille("GNT-BE", "GNT sous bitumineuse épaisse",
  "sol", SRC,
  "Fondation sous assise bitumineuse, plafond usuel 360 MPa.",
  fr("GNT"),
  bloc("Emploi",
    "Fondation sous assise bitumineuse épaisse. Plafond usuel 360 MPa (NF P98-086).",
    ligne("E", "360 MPa")),
  bloc("Dimensionnement",
    ligne("E", "360 MPa"),
    ligne("A", "16000 / 12000 µdéf")));

const gc = () => feuille("GC", "Grave-ciment / graves hydrauliques",
  "hydraulique", SRC,
  "Assise semi-rigide. Classes t3 / t4 et variantes (GLHR, GCH, GLP, GCV, BCR).",
  fr("GC-t3"),
  ["GC-t3", "GC-t4", "GLHR-t3", "GCH-t3", "GLP-t2", "GLP-t3", "GCV-t3", "BCR-t5"],
  bloc("Emploi (fiche 8 p. 132)",
    "Assise semi-rigide. Calcul : Rt et E à 360 j (étude NF P98-114-1). Classe T3 EN 14227-1. " +
    "Manuel : durée mixte GB/GH 20 ans ; CAM 0,8 dans GB / 1,2 dans GC. Δe max profil GC 0/20 : 5 cm.",
    ligne("Densité chantier", "95 % des points ≥ 98 % OPM"),
    ligne("Nivellement / épaisseur", "95 % ± 1 cm ; 97,5 % > e−3 cm")),
  bloc("Norme produit (fiche 8)",
    ligne("Produit", "NF EN 14227-1"),
    ligne("GC T3", "Rt90 ≥ 0,75 MPa")),
  bloc("Calcul annexe F (extraits)",
    ligne("GC-t3", "σ6=0,75 MPa, −1/b=15, kc=1,4, kd=1"),
    ligne("GLHR-t3", "σ6=0,75 MPa, −1/b=15, kc=1,4 (tableau F.4), kd=1"),
    ligne("GC-t4", "σ6=1,20 MPa, kd=0,8"),
    ligne("ν", "0,25")));

const sc = () => feuille("SC", "Sable-ciment",
  "hydraulique", SRC,
  "Assise traitée. Classes t1 à t3.",
  fr("SC-t2"),
  ["SC-t1", "SC-t2", "SC-t3"],
  bloc("Emploi (fiche 8)",
    "Assise traitée. Étude NF P98-114-2. Classe T3 : Rt90 ≥ 0,7 MPa et E90 > 12500 MPa. " +
    "Fig. 6bis (mixte BB/GB3/SC). Δe max profil : 10 cm.",
    ligne("Calcul", "Rt et E à 360 j")),
  bloc("Norme produit",
    ligne("Produit", "NF EN 14227-1"),
    ligne("SC T3 (fiche 8)", "Rt90 ≥ 0,7 MPa, E90 > 12500 MPa")),
  bloc("Calcul",
    ligne("SC-t2", "σ6=0,50 MPa, −1/b=12, SN=0,8, Sh=0,025 m, kc=1,5")));

const stlh = () => feuille("SL", "Sol traité aux liants hydrauliques",
  "hydraulique", SRC,
  "STLH d'assise, classes t1 à t3.",
  fr("SL-t2"),
  ["SL-t1", "SL-t2", "SL-t3"],
  bloc("Emploi",
    "STLH d'assise, classes t1 à t3. Paramètres mécanistiques : NF P98-086 (absents du manuel Scetauroute).",
    ligne("Produit", "NF EN 14227-10 / -11 ; NF P98-113")),
  bloc("Normes",
    ligne("Produit", "NF EN 14227-10 / -11"),
    ligne("Spécification", "NF P98-113")),
  bloc("Calcul",
    ligne("SL-t1 / t2 / t3 σ6", "0,175 / 0,425 / 0,65 MPa"),
    ligne("−1/b / SN / Sh", "10 / 0,8 / 0,025 m")));

const beton = () => feuille("BC", "Béton de chaussée",
  "hydraulique", SRC,
  "Dalle (BC5) et fondations (BC2 à BC4).",
  fr("BC5"),
  ["BC2", "BC3", "BC4", "BC5"],
  bloc("Emploi (manuel chap. 4 / fiche béton)",
    "Dalle BC5 et fondations BC2-BC4. Durée béton 25 ans ; CAM 1,3 (CU ≥ 50 kN). Surface : BBTM ou traitement.",
    ligne("Produit", "NF EN 13877-1 / NF P98-170")),
  bloc("Normes",
    ligne("Produit", "NF EN 13877-1"),
    ligne("Chaussées", "NF P98-170")),
  bloc("Calcul annexe F",
    ligne("BC5", "σ6=2,15 MPa, −1/b=16, kc=1,5"),
    ligne("BC2", "σ6=1,37 MPa, −1/b=14")));

const bac = () => feuille("BAC", "Béton armé continu",
  "hydraulique", SRC,
  "Dalle BAC (fiche 9 / fig. 7). Caractérisée par la classe, pas par un E de calcul dans le Manuel.",
  fr("BAC"),
  bloc("Emploi (fiche 9 / fig. 7)",
    "Dalle BAC, classe S2,7 (pas un E de calcul dans le Manuel). Durée 25 ans. Surface BBTM obligatoire. " +
    "Réf. PF2 : 18 à 27 cm + BM 15 cm + polyane. Δe max profil : 2 cm.",
    ligne("Correction PF", "PF2qs −1 cm ; PF3 −2 cm")),
  bloc("Norme produit (fiche 9)",
    ligne("Produit", "NF EN 13877-1"),
    ligne("Classe", "S2,7"),
    ligne("Épaisseur type (fig. 7)", "18 à 27 cm sur PF2"),
    ligne("Correction PF", "PF2qs −1 cm ; PF3 −2 cm"),
    ligne("Surface", "BBTM ou traitement de surface"),
    ligne("Δe max profil", "2 cm")));

const bm = () => feuille("BM", "Béton maigre",
  "hydraulique", SRC,
  "Fondation des dalles BAC (fiche 10 / fig. 7).",
  fr("BM"),
  bloc("Emploi (fiche 10 / fig. 7)",
    "Fondation des dalles BAC. 15 cm + film polyane. Δe max profil : 3 cm.",
    ligne("Produit", "NF EN 13877-1")),
  bloc("Norme produit (fiche 10)",
    ligne("Produit", "NF EN 13877-1"),
    ligne("Épaisseur type (fig. 7)", "15 cm + film polyane"),
    ligne("Δe max profil", "3 cm")));

const pf = () => feuille("PF", "Plate-forme",
  "sol", SRC,
  "Classes de portance long terme NF P98-086.",
  fr("PF2"),
  ["PF1", "PF2", "PF2qs", "PF3", "PF4"],
  bloc("Emploi (manuel p. 22-23)",
    "Autoroutes : pas de PF1 (gamme PF2 → PF4). PF23 = intermédiaire 80 MPa (assimilé PF2qs ici). " +
    "Réception : 95 % des points conformes (plaque + déflexion). Classes d'arase AR1…AR4 en amont.",
    ligne("E long terme PF2 / PF23 / PF3 / PF4", "50 / 80 / 120 / 200 MPa")),
  bloc("Classes",
    ligne("PF1 à PF4", "20 / 50 / 80 / 120 / 200 MPa (bornes inf.)"),
    ligne("A (εz)", "16000 / 12000 µdéf"),
    ligne("ν", "0,35")));


/** Les vingt fiches France, dans l'ordre de l'application. */
export const FICHES_FRANCE = [
  bbsg(), bbme(), bbm(), bbtm(), bbdr(),
  gb2(), gb3(), gb4(), eme1(), eme2(),
  gnt(), gntInv(), gntBe(),
  gc(), sc(), stlh(), beton(), bac(), bm(),
  pf(),
];
