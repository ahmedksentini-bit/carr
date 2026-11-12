// Fiches matériaux du catalogue tunisien SETIC / DPC d'août 1984 (portage de
// Tunisia1984Datasheets de Burmister-Calc) : partie D et tableaux IX-X. Le
// document cite des spécifications internes, pas de normes EN : les normes
// françaises complètent, marquées « à défaut ».

import { fiche, section, ligne } from "./base.js";
import { normeFr, fusionnerNormes } from "./normes-francaises.js";

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

const SRC = "Catalogue Tunisie SETIC / DPC, août 1984";

const n = (cle, ...citees) => fusionnerNormes(cle, ...citees);

const cite = (code, role, note = null) => normeFr(code, role, note);

const bb = () => feuille("BB",
  "Béton bitumineux 0/10-0/14",
  "bitumineux", SRC,
  "Roulement (neuf et renfort) ; aussi couche de renforcement (fiche 5). Marshall > 750 kg.",
  n("BB", cite("SETIC 1984 p.78 / Tab. X", "Spécifications / seuils")),
  bloc("Tableau X — seuils",
    ligne("Granularité", "0/12-0/14"),
    ligne("Mini roulement / rechargement", "5 cm"),
    ligne("Maxi renforcement", "8 cm par couche")),
  bloc("Calcul",
    ligne("E indicatif", "3000 MPa"),
    ligne("ν", "0,35"),
    ligne("Fatigue NF", "Non applicable")),
  methode());

const gb = () => feuille("GB",
  "Grave-bitume 0/20",
  "bitumineux", SRC,
  "Base fiches 6-7 ; renforcement fiche 3. Marshall > 650 kg, 4-5 % bitume.",
  n("GB", cite("SETIC 1984 p.82 / Tab. X", "Spécifications / seuils")),
  bloc("Tableau X",
    ligne("Granularité", "0/20"),
    ligne("Mini base / renfort", "8-10 cm"),
    ligne("Maxi par couche", "14-15 cm")),
  bloc("Calcul",
    ligne("E indicatif", "4000 MPa"),
    ligne("Fatigue NF", "Non applicable")),
  methode());

const enduits = () => feuille("BC",
  "Enduits superficiels (monocouche / bicouche)",
  "bitumineux", SRC,
  "Roulement T3-T5 (neuf) et variantes de renforcement. Épaisseur non chiffrée aux fiches.",
  n("BC", cite("SETIC 1984 p.68 / Tab. IX.A", "Revêtements minces")),
  ["BC", "MC"],
  bloc("Convention d'injection",
    ligne("MC", "1 cm (non imprimé au catalogue)"),
    ligne("BC", "2 cm (non imprimé au catalogue)")),
  bloc("a1 (chaussée neuve)",
    ligne("Enduit mono/bicouche", "0,10")),
  methode());

const gr = () => feuille("GR",
  "Grave concassée reconstituée / humidifiée",
  "sol", SRC,
  "Base et fondation fiche 1 ; base fiche 2 ; renforcement fiche 1.",
  n("GNT", cite("SETIC 1984 p.57 / Tab. IX.B", "GNT")),
  ["GR", "GRH"],
  bloc("Emploi",
    ligne("Symboles", "G.R / G.R.H"),
    ligne("Base et fondation", "Autorisés (Tab. IX.B)"),
    ligne("Renforcement", "Autorisé")),
  bloc("Calcul",
    ligne("E indicatif", "300 MPa"),
    ligne("ν", "0,35")),
  methode());

const g = () => feuille("G",
  "Grave concassée / tout-venant de concassage",
  "sol", SRC,
  "Fondation (fiches 2, 3, 6, 8-10) ; base fiche 3 ; renfort fiche 1bis.",
  n("GNT", cite("SETIC 1984 p.57 / Tab. X", "GNT")),
  bloc("Spécifications",
    ligne("Fondation Dmax", "31,5 mm ; LA < 40 ; ES > 30"),
    ligne("Base Dmax", "20 mm ; LA < 30 ; ES > 30"),
    ligne("Maxi / couche (Tab. X)", "30 cm")),
  bloc("Calcul",
    ligne("E indicatif", "250 MPa")),
  methode());

const tuf = () => feuille("T",
  "Encroûtement calcaire (tuf compact)",
  "sol", SRC,
  "Région C (et IV-V au renfort). Fiches 4 et 7 (neuf), fiche 2 (renfort).",
  n("GNT", cite("SETIC 1984 p.63", "Tufs")),
  bloc("Limites",
    ligne("Trafic", "Inadapté au trafic très lourd"),
    ligne("Eau", "Perd sa cohésion à l'imbibition — drainage obligatoire")),
  bloc("Calcul",
    ligne("E indicatif", "200 MPa")),
  methode());

const sg = () => feuille("SG",
  "Sable gypseux",
  "sol", SRC,
  "Région C, fiche 5 (T5). Tab. IX.B : fondation seulement.",
  n("GNT", cite("SETIC 1984 p.97 / Tab. X", "Sables gypseux")),
  bloc("Tableau X",
    ligne("Granularité", "0/6"),
    ligne("Mini fondation mauvais sol", "25 cm"),
    ligne("Maxi / couche", "30 cm")),
  bloc("Calcul",
    ligne("E indicatif", "150 MPa")),
  methode());

const gc = () => feuille("GC",
  "Grave-ciment",
  "hydraulique", SRC,
  "Base fiche 8 (T1-T2). Pas de fiche de renforcement GC.",
  n("GC", cite("SETIC 1984 p.86 / Tab. X", "MTLH")),
  bloc("Tableau X",
    ligne("Granularité", "0/20"),
    ligne("Mini base", "15 cm"),
    ligne("Maxi / couche", "30 cm"),
    ligne("Rc 7 j / Rt 28 j", "> 60 bar / > 5 bar")),
  bloc("Calcul",
    ligne("E indicatif", "8000 MPa"),
    ligne("Fatigue NF", "Non applicable")),
  methode());

const gly = () => feuille("GLY",
  "Grave laitier gypsonat",
  "hydraulique", SRC,
  "Base fiche 9 ; renforcement fiche 4. Épaisseurs du catalogue = GLY.",
  n("GC", cite("SETIC 1984 p.90 / Tab. X", "Laitier")),
  bloc("Seuils",
    ligne("Mini / maxi", "15 / 30 cm"),
    ligne("Rc 28 j / Rt 90 j", "> 70 bar / > 6,1 bar")),
  bloc("Calcul",
    ligne("E indicatif", "4000 MPa")),
  methode());

const glx = () => feuille("GLX",
  "Grave laitier à la chaux",
  "hydraulique", SRC,
  "Même emploi que GLY. Majorer les épaisseurs tabulées de 10 %.",
  n("GC", cite("SETIC 1984 fiche 9 / 4", "GLX +10 %")),
  bloc("Règle catalogue",
    ligne("Épaisseur", "1,10 × épaisseur GLY")),
  methode());

const scly = () => feuille("SCLY",
  "Sable concassé laitier gypsonat 0/6",
  "hydraulique", SRC,
  "Base fiche 10. Épaisseurs = SCLY.",
  n("SC", cite("SETIC 1984 p.94 / Tab. X", "Sable laitier")),
  ["SCLY"],
  bloc("Tableau X",
    ligne("Mini / maxi", "15-20 / 40 cm")),
  bloc("Calcul",
    ligne("E indicatif", "2000 MPa")),
  methode());

const sclx = () => feuille("SCLX",
  "Sable concassé laitier à la chaux 0/6",
  "hydraulique", SRC,
  "Même emploi que SCLY. Majorer les épaisseurs de 10 %.",
  n("SC", cite("SETIC 1984 fiche 10", "SCLX +10 %")),
  bloc("Règle catalogue",
    ligne("Épaisseur", "1,10 × épaisseur SCLY")),
  methode());

const plateforme = () => feuille("PF",
  "Sol support S1-S4 / chaussée existante C1-C5",
  "sol", SRC,
  "Neuf : CBR caractéristique (moyenne annuelle). Renfort : classe C via coupe ou SN̄.",
  n("PF2", cite("SETIC 1984 ch. III-IV", "Si / Ci")),
  ["PF"],
  bloc("Classes de sol (Tab. CBR)",
    ligne("S1 / S2 / S3 / S4", "CBR 5-8 / 8-12 / 12-20 / > 20"),
    ligne("S0", "CBR < 5 : hors catalogue, couche de forme obligatoire")),
  bloc("Classes de chaussée (Tab. VIII)",
    ligne("C1 à C5", "SN̄ < 2,0 / 2,0-2,5 / 2,5-3,0 / 3,0-3,5 / > 3,5")),
  methode());

const methode = () => bloc("Méthode",
  "Catalogue de fiches (T×S neuf, T×C renfort) et indice de structure SN = Σ ai·hi/2,54 + ΔSN(CBR). " +
  "Durée type 15 ans, croissance 8 % (corrigée Tab. III). 1 PL ≈ 0,36 essieu 13 t. " +
  "Hors autoroute et zones urbaines / industrielles.",
  ligne("Essieu de référence", "8,15 t ou 13 t (Tab. I)"),
  ligne("Vérification NF ε6/σ6", "Non applicable"));


/** Les treize fiches du catalogue 1984. */
export const FICHES_TUNISIE_1984 = [
  bb(), gb(), enduits(), gr(), g(), tuf(), sg(), gc(), gly(), glx(), scly(), sclx(), plateforme(),
];
