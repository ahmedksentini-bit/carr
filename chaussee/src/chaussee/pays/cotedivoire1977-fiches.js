// Fiches matériaux du catalogue LBTP Côte d'Ivoire, septembre 1977 : modules
// p. 24, épaisseurs minimales tableau VI p. 23, contraintes admissibles
// tableaux V et VII p. 22-25, cellule par cellule. Normes françaises en repli
// (aucune norme EN à l'époque). Portage de CoteDIvoire1977Datasheets.

import { N, fusionnerNormes, Of, Sec, R } from "./commun-normes.js";

const SRC = "Catalogue LBTP Côte d'Ivoire, septembre 1977";

export const FICHES = [
  revetement(), gb(), sb(), gn(), tvc(), sa(), gc(), gcGraveleux(), sc(),
  plateforme(),
];

function revetement() { return Of("revetement",
  "Enrobés denses / béton bitumineux de roulement",
  "bitumineux", SRC,
  "Structures 1, 3, 6. Mini 3 cm (0/10). Sand-asphalt 0/2-0/5 mini 3 cm.",
  fusionnerNormes("revetement", N("LBTP 1977 p.23-25", "Tableaux VI-VII")),
  Sec("Tableau VI — épaisseurs mini",
    R("Enrobés denses / BB 0/10", "3 cm"),
    R("Sand-asphalt 0/2-0/5", "3 cm"),
    R("Règle générale (p. 20)", "h ≥ 2,5 × D")),
  Sec("Tableau VII — σt max base roulement (bar)",
    R("T1 / T2 / T3 (struct. 1, 3, 6)", "15 / 12 / 10"),
    R("T4 / T5", "—")),
  Sec("Modules p. 24",
    R("E adopté", "30000 bar = 3000 MPa"),
    R("ν retenu", "0,35 (non indiqué au catalogue)"),
    R("Fatigue NF", "Non applicable")),
  methodeNote()); }

function gb() { return Of("GB",
  "Grave-bitume",
  "bitumineux", SRC,
  "Base structures 5, 8, 13, 14, 16 (T3-T5).",
  fusionnerNormes("GB", N("LBTP 1977 p.23-25", "Tableaux VI-VII")),
  Sec("Tableau VI",
    R("Granularité / h mini", "0/31,5 / 10 cm"),
    R("Règle", "h ≥ 2,5 × D")),
  Sec("Tableau VII — σt max base (bar)",
    R("T3 / T4 / T5", "10 / 8,5 / 7"),
    R("T1 / T2", "—")),
  Sec("Modules p. 24",
    R("E adopté base", "40000 bar = 4000 MPa"),
    R("ν retenu", "0,35"),
    R("Fatigue NF", "Non applicable")),
  methodeNote()); }

function sb() { return Of("sB",
  "Sable-bitume",
  "bitumineux", SRC,
  "Base structure 10 (T1-T2) ; aussi fondation sous GB (F14).",
  fusionnerNormes("sB", N("LBTP 1977 p.23-25", "Tableaux VI-VII")),
  Sec("Tableau VI",
    R("Granularité / h mini", "0/2-0/5 / 7-10 cm")),
  Sec("Tableau VII — σt max base (bar)",
    R("T1 / T2 / T3 (struct. 10)", "3,5 / 3 / 2,5")),
  Sec("Modules p. 24",
    R("E base / fondation sols-bitume", "10000 bar = 1000 MPa / 3500 bar"),
    R("ν retenu", "0,35")),
  methodeNote()); }

function gn() { return Of("gn",
  "Graveleux naturel latéritique",
  "sol", SRC,
  "Base et/ou fondation (F1-F5). Traité ou non : même mini 10 cm.",
  fusionnerNormes("gn", N("LBTP 1977 p.23-24", "Tableau VI / modules")),
  Sec("Tableau VI",
    R("Granularité / h mini", "0/40 / 10 cm (traités ou non)"),
    R("Règle", "h ≥ 2,5 × D"),
    R("Subdivision NF", "Aucune")),
  Sec("Modules p. 24",
    R("E fondation / base non liés", "3000 bar = 300 MPa"),
    R("ν retenu", "0,35")),
  Sec("Vérification PF (Tableau V)",
    R("σz max S1 à S5", "0,28 / 0,56 / 0,70 / 1,10 / 2,3 bar")),
  methodeNote()); }

function tvc() { return Of("TVC",
  "Tout-venant de concassage",
  "sol", SRC,
  "Base (F3, F6) et fondation (F7, F8).",
  fusionnerNormes("TVC", N("LBTP 1977 p.23-24", "Tableau VI / modules")),
  Sec("Tableau VI",
    R("Base 0/31,5", "h mini 10 cm"),
    R("Fondation 0/60", "h mini 15 cm"),
    R("Règle", "h ≥ 2,5 × D")),
  Sec("Modules p. 24",
    R("E non lié", "3000 bar = 300 MPa"),
    R("ν retenu", "0,35")),
  methodeNote()); }

function sa() { return Of("sa",
  "Sable argileux",
  "sol", SRC,
  "Fondation structures 9-10 (T1). Valeur indicative.",
  fusionnerNormes("sa", N("LBTP 1977 p.24", "Modules fondation")),
  Sec("Modules p. 24",
    R("E adopté (catalogue)", "150 MPa (sol fin ; fondation non liée 3000 bar si assimilée)"),
    R("ν retenu", "0,35")),
  Sec("Vérification PF (Tableau V)",
    R("σz max S1 à S5", "0,28 / 0,56 / 0,70 / 1,10 / 2,3 bar")),
  methodeNote()); }

function gc() { return Of("GC",
  "Grave-ciment",
  "hydraulique", SRC,
  "Base structures 4, 7, 12, 15 (T3-T5).",
  fusionnerNormes("GC-t3", N("LBTP 1977", "Guide", "Méthode déterministe, calage en bar.")),
  Sec("Tableau VI",
    R("Granularité / h mini", "0/31,5 / 10 cm")),
  Sec("Tableau VII — σt max base (bar)",
    R("T3 / T4 / T5 (struct. 4, 7, 12, 15)", "7,5 / 6,5 / 5"),
    R("T1 / T2", "—")),
  Sec("Modules p. 24",
    R("E adopté", "80000 bar = 8000 MPa"),
    R("ν retenu", "0,25"),
    R("Fatigue NF", "Non applicable")),
  methodeNote()); }

function gcGraveleux() { return Of("gC",
  "Graveleux-ciment",
  "hydraulique", SRC,
  "Base structure 2 (T1-T3) ; fondation sous GC/GB (F15-F16).",
  fusionnerNormes("gla", N("LBTP 1977", "Guide")),
  Sec("Tableau VI",
    R("Granularité / h mini", "0/40 / 10 cm (graveleux traités)")),
  Sec("Tableau VII — σt max base (bar)",
    R("T1 / T2 / T3 (struct. 2)", "3 / 2,5 / 2")),
  Sec("Modules p. 24",
    R("E base / fondation", "10000 bar = 1000 MPa / 4500 bar"),
    R("ν retenu", "0,25")),
  methodeNote()); }

function sc() { return Of("sC",
  "Sable argileux-ciment",
  "hydraulique", SRC,
  "Base structures 9, 11 (T1-T2) ; fondation sous GC/GB (F12-F13).",
  fusionnerNormes("SC-t2", N("LBTP 1977", "Guide")),
  Sec("Tableau VI",
    R("Granularité / h mini", "0/2-0/5 / 7-10 cm")),
  Sec("Tableau VII — σt max base (bar)",
    R("T1 / T2 / T3 (struct. 9, 11)", "3,75 / 3 / 2,5")),
  Sec("Modules p. 24",
    R("E base / fondation sol-ciment", "15000 bar = 1500 MPa / 4500 bar"),
    R("ν retenu", "0,25")),
  methodeNote()); }

function plateforme() { return Of("PF",
  "Plate-forme S1-S5",
  "sol", SRC,
  "CBR 95 % OPM, imbibition 4 j (Tableau II). Modules p. 24. σz Tableau V.",
  fusionnerNormes("PF2", N("LBTP 1977 p.10, 22, 24", "Tableaux II / V / modules")),
  [ "PF" ],
  Sec("Classes CBR (Tableau II)",
    R("S1 à S5", "< 5 / 5-10 / 10-15 / 15-30 / ≥ 30")),
  Sec("E p. 24 (bar)",
    R("S1 à S5", "250 / 500 / 750 / 1500 / 3000  (= 25 / 50 / 75 / 150 / 300 MPa)")),
  Sec("Tableau V — σz max tête PF (bar)",
    R("S1 à S5", "0,28 / 0,56 / 0,70 / 1,10 / 2,3")),
  Sec("Tableau V — déflexion 13 t (1/100 mm)",
    R("Struct. 1, 3, 6  T1 à T4", "200 / 125 / 75 / 50"),
    R("Struct. 2, 5, 8, 9, 10, 13, 14, 16  T1 à T5", "125-150 / 100 / 65 / 40 / 30"),
    R("Struct. 4, 7, 11, 12, 15  T1 à T5", "100 / 75 / 50 / 30 / 20")),
  methodeNote()); }

function methodeNote() { return Sec("Méthode (texte p. 20-21, autour des tableaux)",
  "Le dimensionnement fixe l'épaisseur totale (σz admissible en tête de PF) et les épaisseurs individuelles " +
  "(σt admissible en base des couches liées). Observation 1971 : durée de vie 10-15 ans (essieux, plasticité, entretien). " +
  "Les abaques CBR sont majorés de 5 cm en moyenne, puis vérifiés en élasticité.",
  R("Seuil technologique (p. 20)", "h ≥ 2,5 × D"),
  R("Compactage", "La déflexion en tête de chaque couche doit permettre de compacter la suivante (éviter le matelassage)."),
  R("Base empirique", "Abaques CBR / Peltier, + 5 cm"),
  R("Vérification", "Alizé 3 / Jones / Peattie ; Liautaud CEBTP 1969, notes 0/10-1 à 4"),
  R("Essieu de calcul", "13 t (6,5 t / roue ou 3,25 t jumelage)")); }
