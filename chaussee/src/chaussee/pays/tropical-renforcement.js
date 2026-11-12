// Catalogue de renforcement CEBTP/LCPC 1985 (manuel pays tropicaux), 14 fiches
// Q×T (p. 120-127), portage de TropicalReinforcement. Chaque cellule est
// l'épaisseur MINIMALE à poser sur la chaussée existante (modèle bicouche ou
// tricouche résiduel). Index : classe de qualité Q1-Q5 (déflexion
// caractéristique) × trafic T1-T5. Transcription des scans p. 121-127 ;
// cellules vides du catalogue omises. `provisoire: true` (catalogue
// déterministe, lecture de scan). L'apport est collé sur l'existant.

import { catalogueStructures } from "./base.js";
import { decouperSpec, coucheFiche } from "./commun.js";

const SRC = "Manuel CEBTP 1985";

// Code → (nature, famille, clé matériau).
const MAT = {
  ES: ["Enduit superficiel", "bitumineux", "ES"],
  TS: ["Tapis sable", "bitumineux", "TS"],
  MB: ["Microbéton", "bitumineux", "MB"],
  BB: ["Béton bitumineux", "bitumineux", "BB"],
  SB: ["Sable-bitume", "bitumineux", "SB85"],
  GB: ["Grave-bitume", "bitumineux", "GB"],
  GNT: ["Grave non traitée", "sol", "GNT"],
  SC: ["Sol-ciment (MTLH1)", "hydraulique", "SC"],
  GLC: ["Grave latéritique ciment (MTLH2)", "hydraulique", "GLC85"],
  GC: ["Grave-ciment (MTLH3)", "hydraulique", "GC85"],
};

/** spec = « CODE:cm[/CODE:cm] » ; un ES sans épaisseur explicite compte 1 cm. */
function T(famille, page, q, trafic, spec, note = null) {
  const couches = decouperSpec(spec, 1.0).map(({ code, cm }) => {
    const [nature, fam, cle] = MAT[code.toUpperCase()] ?? [code, "sol", code];
    return coucheFiche(nature, cm, fam, cle, "collee");
  });
  return { classeTrafic: trafic, classePortance: q, famille, couches,
    source: `${SRC}, p-${page}`, provisoire: true, note, intervention: "renforcement" };
}

const F1 = "1 — GNT sur bicouche (ES)";
const F2 = "2 — GNT sur tricouche (ES)";
const F1b = "1bis — GNT sur bicouche (microbéton)";
const F2b = "2bis — GNT sur tricouche (microbéton)";
const F3 = "3 — BB sur bicouche";
const F4 = "4 — BB sur tricouche";
const F5 = "5 — sable-bitume sur bicouche";
const F6 = "6 — sable-bitume sur tricouche";
const F7 = "7 — grave-bitume sur bicouche";
const F8 = "8 — grave-bitume sur tricouche";
const F9 = "9 — sol-ciment (MTLH1) sur bicouche";
const F10 = "10 — sol-ciment (MTLH1) sur tricouche";
const F11 = "11 — GLC (MTLH2) sur bicouche";
const F12 = "12 — GLC (MTLH2) sur tricouche";
const F13 = "13 — grave-ciment (MTLH3) sur bicouche";
const F14 = "14 — grave-ciment (MTLH3) sur tricouche";

const Exp = "BB à titre expérimental.";

export const FICHES = [
  // ---- Fiches 1 et 2 : GNT + ES (p. 121) — mêmes épaisseurs bicouche / tricouche ----
  T(F1, "121", "Q3", "T1", "ES:1/GNT:15"), T(F1, "121", "Q3", "T2", "ES:1/GNT:20"),
  T(F1, "121", "Q4", "T1", "ES:1/GNT:22"), T(F1, "121", "Q4", "T2", "ES:1/GNT:25"),
  T(F2, "121", "Q3", "T1", "ES:1/GNT:15"), T(F2, "121", "Q3", "T2", "ES:1/GNT:20"),
  T(F2, "121", "Q4", "T1", "ES:1/GNT:22"), T(F2, "121", "Q4", "T2", "ES:1/GNT:25"),

  // ---- Fiches 1bis / 2bis : GNT + microbéton (p. 121) ----
  T(F1b, "121", "Q3", "T1", "MB:3/GNT:15"), T(F1b, "121", "Q3", "T2", "MB:3.5/GNT:18"),
  T(F1b, "121", "Q4", "T1", "MB:3/GNT:20"), T(F1b, "121", "Q4", "T2", "MB:3/GNT:22"),
  T(F2b, "121", "Q3", "T1", "MB:3/GNT:15"), T(F2b, "121", "Q3", "T2", "MB:3.5/GNT:18"),
  T(F2b, "121", "Q4", "T1", "MB:3/GNT:20"), T(F2b, "121", "Q4", "T2", "MB:3/GNT:22"),

  // ---- Fiche 3 BB bicouche (p. 122) — alternatives ES/TS/μB encodees par la couche liée ----
  T(F3, "122", "Q1", "T1", "MB:3"), T(F3, "122", "Q1", "T2", "BB:4"),
  T(F3, "122", "Q1", "T3", "BB:5"), T(F3, "122", "Q1", "T4", "BB:8"), T(F3, "122", "Q1", "T5", "BB:10"),
  T(F3, "122", "Q2", "T1", "BB:4"), T(F3, "122", "Q2", "T2", "BB:5"),
  T(F3, "122", "Q2", "T3", "BB:8"), T(F3, "122", "Q2", "T4", "BB:10"),
  T(F3, "122", "Q3", "T1", "BB:5"), T(F3, "122", "Q3", "T2", "BB:8"), T(F3, "122", "Q3", "T3", "BB:10"),
  T(F3, "122", "Q4", "T1", "BB:8"), T(F3, "122", "Q4", "T2", "BB:10"),
  T(F3, "122", "Q5", "T1", "BB:10"),

  // ---- Fiche 4 BB tricouche (p. 122) ----
  T(F4, "122", "Q1", "T1", "MB:3"), T(F4, "122", "Q1", "T2", "BB:4"),
  T(F4, "122", "Q1", "T3", "BB:5"), T(F4, "122", "Q1", "T4", "BB:6"), T(F4, "122", "Q1", "T5", "BB:8"),
  T(F4, "122", "Q2", "T1", "BB:4"), T(F4, "122", "Q2", "T2", "BB:5"),
  T(F4, "122", "Q2", "T3", "BB:6"), T(F4, "122", "Q2", "T4", "BB:8"),
  T(F4, "122", "Q3", "T1", "BB:5"), T(F4, "122", "Q3", "T2", "BB:6"), T(F4, "122", "Q3", "T3", "BB:8"),
  T(F4, "122", "Q4", "T1", "BB:6"), T(F4, "122", "Q4", "T2", "BB:8"),
  T(F4, "122", "Q5", "T1", "BB:10"),

  // ---- Fiche 5 SB bicouche (p. 123) ----
  T(F5, "123", "Q3", "T1", "ES:1/SB:7"), T(F5, "123", "Q3", "T2", "ES:1/SB:10"),
  T(F5, "123", "Q3", "T3", "BB:5/SB:8"),
  T(F5, "123", "Q4", "T1", "ES:1/SB:10"), T(F5, "123", "Q4", "T2", "ES:1/SB:12"),
  T(F5, "123", "Q5", "T1", "BB:4/SB:12"),

  // ---- Fiche 6 SB tricouche (p. 123) ----
  T(F6, "123", "Q3", "T1", "ES:1/SB:6"), T(F6, "123", "Q3", "T2", "ES:1/SB:8"),
  T(F6, "123", "Q3", "T3", "BB:5/SB:8"),
  T(F6, "123", "Q4", "T1", "ES:1/SB:8"), T(F6, "123", "Q4", "T2", "ES:1/SB:10"),
  T(F6, "123", "Q5", "T1", "ES:1/SB:12"), T(F6, "123", "Q5", "T2", "BB:4/SB:10"),

  // ---- Fiche 7 GB bicouche (p. 124) ----
  T(F7, "124", "Q2", "T4", "BB:8/GB:10"), T(F7, "124", "Q2", "T5", "BB:8/GB:12"),
  T(F7, "124", "Q3", "T4", "BB:6/GB:12"), T(F7, "124", "Q3", "T5", "BB:8/GB:15"),
  T(F7, "124", "Q4", "T2", "ES:1/GB:10"), T(F7, "124", "Q4", "T3", "BB:5/GB:12"),
  T(F7, "124", "Q4", "T4", "BB:6/GB:15"), T(F7, "124", "Q4", "T5", "BB:8/GB:18"),
  T(F7, "124", "Q5", "T1", "ES:1/GB:10"), T(F7, "124", "Q5", "T2", "ES:1/GB:12"),
  T(F7, "124", "Q5", "T3", "BB:5/GB:15"), T(F7, "124", "Q5", "T4", "BB:6/GB:18"),

  // ---- Fiche 8 GB tricouche (p. 124) ----
  T(F8, "124", "Q2", "T5", "BB:8/GB:10"),
  T(F8, "124", "Q3", "T4", "BB:6/GB:10"), T(F8, "124", "Q3", "T5", "BB:8/GB:12"),
  T(F8, "124", "Q4", "T2", "ES:1/GB:10"), T(F8, "124", "Q4", "T3", "BB:5/GB:10"),
  T(F8, "124", "Q4", "T4", "BB:6/GB:12"), T(F8, "124", "Q4", "T5", "BB:8/GB:15"),
  T(F8, "124", "Q5", "T1", "ES:1/GB:10"), T(F8, "124", "Q5", "T2", "ES:1/GB:12"),
  T(F8, "124", "Q5", "T3", "BB:5/GB:12"), T(F8, "124", "Q5", "T4", "BB:6/GB:15"),
  T(F8, "124", "Q5", "T5", "BB:8/GB:18"),

  // ---- Fiche 9 SC bicouche (p. 125) ----
  T(F9, "125", "Q3", "T1", "ES:1/SC:15"), T(F9, "125", "Q3", "T2", "ES:1/SC:20"),
  T(F9, "125", "Q3", "T3", "BB:5/SC:22", Exp),
  T(F9, "125", "Q4", "T1", "ES:1/SC:22"), T(F9, "125", "Q4", "T2", "ES:1/SC:25"),
  T(F9, "125", "Q5", "T1", "ES:1/SC:25"), T(F9, "125", "Q5", "T2", "ES:1/SC:28"),

  // ---- Fiche 10 SC tricouche (p. 125) ----
  T(F10, "125", "Q3", "T1", "ES:1/SC:15"), T(F10, "125", "Q3", "T2", "ES:1/SC:18"),
  T(F10, "125", "Q3", "T3", "BB:5/SC:22", Exp),
  T(F10, "125", "Q4", "T1", "ES:1/SC:20"), T(F10, "125", "Q4", "T2", "ES:1/SC:22"),
  T(F10, "125", "Q4", "T3", "BB:5/SC:28", Exp),
  T(F10, "125", "Q5", "T1", "ES:1/SC:22"), T(F10, "125", "Q5", "T2", "ES:1/SC:25"),

  // ---- Fiche 11 GLC bicouche (p. 126) ----
  T(F11, "126", "Q3", "T2", "ES:1/GLC:20"), T(F11, "126", "Q3", "T3", "BB:5/GLC:22"),
  T(F11, "126", "Q4", "T1", "ES:1/GLC:20"), T(F11, "126", "Q4", "T2", "ES:1/GLC:22"),
  T(F11, "126", "Q4", "T3", "BB:5/GLC:25"),
  T(F11, "126", "Q5", "T1", "ES:1/GLC:22"), T(F11, "126", "Q5", "T2", "ES:1/GLC:25"),
  T(F11, "126", "Q5", "T3", "BB:5/GLC:28"),

  // ---- Fiche 12 GLC tricouche (p. 126) ----
  T(F12, "126", "Q3", "T2", "ES:1/GLC:18"), T(F12, "126", "Q3", "T3", "BB:5/GLC:20"),
  T(F12, "126", "Q4", "T1", "ES:1/GLC:18"), T(F12, "126", "Q4", "T2", "ES:1/GLC:20"),
  T(F12, "126", "Q4", "T3", "BB:5/GLC:22"),
  T(F12, "126", "Q5", "T1", "ES:1/GLC:20"), T(F12, "126", "Q5", "T2", "ES:1/GLC:22"),
  T(F12, "126", "Q5", "T3", "BB:5/GLC:28"),

  // ---- Fiche 13 GC bicouche (p. 127) ----
  T(F13, "127", "Q2", "T5", "BB:8/GC:25"),
  T(F13, "127", "Q3", "T3", "BB:5/GC:20"), T(F13, "127", "Q3", "T4", "BB:6/GC:22"),
  T(F13, "127", "Q3", "T5", "BB:8/GC:25"),
  T(F13, "127", "Q4", "T2", "ES:1/GC:20"), T(F13, "127", "Q4", "T3", "BB:5/GC:22"),
  T(F13, "127", "Q4", "T4", "BB:6/GC:25"), T(F13, "127", "Q4", "T5", "BB:8/GC:28"),
  T(F13, "127", "Q5", "T1", "ES:1/GC:20"), T(F13, "127", "Q5", "T2", "ES:1/GC:22"),
  T(F13, "127", "Q5", "T3", "BB:5/GC:25"), T(F13, "127", "Q5", "T4", "BB:6/GC:28"),
  T(F13, "127", "Q5", "T5", "BB:8/GC:28"),

  // ---- Fiche 14 GC tricouche (p. 127) ----
  T(F14, "127", "Q2", "T5", "BB:8/GC:22"),
  T(F14, "127", "Q3", "T3", "BB:5/GC:18"), T(F14, "127", "Q3", "T4", "BB:6/GC:20"),
  T(F14, "127", "Q3", "T5", "BB:8/GC:22"),
  T(F14, "127", "Q4", "T2", "ES:1/GC:18"), T(F14, "127", "Q4", "T3", "BB:5/GC:20"),
  T(F14, "127", "Q4", "T4", "BB:6/GC:22"), T(F14, "127", "Q4", "T5", "BB:8/GC:25"),
  T(F14, "127", "Q5", "T1", "ES:1/GC:18"), T(F14, "127", "Q5", "T2", "ES:1/GC:20"),
  T(F14, "127", "Q5", "T3", "BB:5/GC:22"), T(F14, "127", "Q5", "T4", "BB:6/GC:25"),
  T(F14, "127", "Q5", "T5", "BB:8/GC:25"),
];

export const CATALOGUE_RENFORCEMENT = catalogueStructures({
  pays: "tropical",
  reference: "Manuel CEBTP/LCPC 1985 — 14 fiches de renforcement (Q1-Q5 × T1-T5). "
    + "Épaisseurs minimales à poser sur l'existant (bicouche / tricouche). "
    + "Q = classe de qualité par déflexion caractéristique, pas la portance CBR.",
  fiches: FICHES,
  cle: "classe-trafic",
});
