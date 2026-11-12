// Catalogue de structures types du guide CEBTP 1980 (pays tropicaux), portage
// de TropicalStructures. 29 familles de solutions (matériaux locaux inclus :
// latérite, concassé, sable argileux/ciment, sable-bitume, grave-ciment,
// grave-bitume, sol-chaux, scories volcaniques, banco-coquillage, corail…).
// Chaque cellule est indexée par classe de sol (S1..S5, portance CBR) et
// classe de trafic (T1..T5) et donne les épaisseurs (cm) revêtement / base /
// fondation. Transcription des pages 36-53 du document (scans p-17..p-25).
// Méthode DÉTERMINISTE (catalogue empirique CBR × trafic) : `provisoire: true`.
// Cases barrées (solutions proscrites) non transcrites. Revêtement :
// « bicouche/3 cm enrobé » (T1), « 4 cm enrobé/tricouche » (T2) ou béton
// bitumineux (T3-T5).

import { catalogueStructures } from "./base.js";
import { decouperSpec, coucheFiche } from "./commun.js";

const SRC = "Guide CEBTP 1980";

// Code → (nature, famille).
const MAT = {
  LAT: ["Graveleux latéritique naturel", "sol"],
  LATC: ["Latérite ou grave améliorées ciment", "hydraulique"],
  CON: ["Concassé 0/d", "sol"],
  SA: ["Sable argileux", "sol"],
  SAC: ["Sable argileux amélioré ciment", "hydraulique"],
  SB: ["Sable-bitume", "bitumineux"],
  GC: ["Grave-ciment", "hydraulique"],
  GB: ["Grave-bitume", "bitumineux"],
  SCH: ["Sol-chaux", "hydraulique"],
  SCO: ["Scories volcaniques", "sol"],
  SCOP: ["Scories ou pouzzolanes", "sol"],
  BS: ["Béton de sol", "hydraulique"],
  BAN: ["Banco-coquillage", "sol"],
  BANB: ["Banco-coquillage amélioré bitume", "bitumineux"],
  BANC: ["Banco-coquillage amélioré ciment", "hydraulique"],
  SCOQ30: ["Sable coquillier 0/30", "sol"],
  SCOQ50: ["Sable coquillier 0/50", "sol"],
  COR: ["Soupe de corail ou corail mort", "sol"],
  CORS: ["Soupe de corail", "sol"],
  CORC: ["Corail traité ciment", "hydraulique"],
  CORB: ["Corail concassé traité bitume", "bitumineux"],
  SCC: ["Soupe corallienne traitée ciment", "hydraulique"],
  GAC: ["Grave améliorée ciment", "hydraulique"],
  LG0D: ["Latérite naturelle ou grave 0/D", "sol"],
  LGC: ["Latérite, grave ou concassé 0/d", "sol"],
  LGT: ["Latérite, grave ou tout-venant de concassage", "sol"],
  SGC: ["Sable argileux ou grave améliorés ciment", "hydraulique"],
  MIXC: ["Sable-ciment, grave-ciment ou sable-bitume", "hydraulique"],
  GLC: ["Grave, latérite naturelle ou concassé 0/d", "sol"],
};

const libelleRevetement = (code) =>
  (code === "b" ? "Bicouche ou 3 cm enrobé" : code === "t" ? "4 cm enrobé ou tricouche" : "Béton bitumineux");

/** revCode b / t / e ; rev = épaisseur du revêtement (cm) ; spec = « CODE:cm[/CODE:cm] » base [+ fondation]. */
function T(famille, page, sol, trafic, revCode, rev, spec) {
  const couches = [coucheFiche(libelleRevetement(revCode), rev, "bitumineux", "revetement", "collee")];
  for (const { code, cm } of decouperSpec(spec)) {
    const [nature, fam] = MAT[code.toUpperCase()] ?? [code, "sol"];
    couches.push(coucheFiche(nature, cm, fam, code));
  }
  return { classeTrafic: trafic, classePortance: sol, famille, couches,
    source: `${SRC}, ${page}`, provisoire: true, note: null, intervention: "neuve" };
}

const F1 = "1 — latérite naturelle base+fondation";
const F2 = "2 — latérite/grave améliorée ciment (base) / latérite-grave (fond.)";
const F3 = "3 — concassé 0/d (base) / latérite-grave-concassé (fond.)";
const F4 = "4 — concassé 0/d base+fondation";
const F5 = "5 — grave/latérite/concassé (base) / sable argileux (fond.)";
const F6 = "6 — sable-ciment (base) / sable argileux (fond.)";
const F7 = "7 — sable-ciment (base) / sable ou grave ciment (fond.)";
const F8 = "8 — sable-bitume (base) / sable argileux (fond.)";
const F9 = "9 — sable/grave-bitume (base) / sol-chaux (fond.)";
const F10 = "10 — sol-chaux (base) / sable argileux (fond.)";
const F11 = "11 — concassé 0/d (base) / sol-chaux (fond.)";
const F12 = "12 — grave-ciment (base) / latérite-grave-concassé (fond.)";
const F13 = "13 — grave-ciment (base) / sable ou grave ciment (fond.)";
const F14 = "14 — grave-ciment (base) / sol-chaux (fond.)";
const F15 = "15 — grave-ciment (base) / scories volcaniques (fond.)";
const F16 = "16 — grave-bitume (base) / graveleux naturel ou concassé (fond.)";
const F17 = "17 — grave-bitume (base) / sable-ciment, grave-ciment ou sable-bitume (fond.)";
const F18 = "18 — grave-bitume (base) / sable-bitume (fond.)";
const F19 = "19 — grave-bitume (base) / scories volcaniques (fond.)";
const F20 = "20 — grave-bitume (base) / sol-chaux (fond.)";
const F21 = "21 — scories/concassé (base) / scories ou pouzzolanes (fond.)";
const F22 = "22 — béton de sol (base) / graveleux latéritique (fond.)";
const F23 = "23 — banco-coquillage / grave-bitume (base) / banco-coquillage (fond.)";
const F24 = "24 — banco-coquillage amélioré ciment (base) / banco-coquillage (fond.)";
const F25 = "25 — sable coquillier 0/30 (base) / sable coquillier 0/50 (fond.)";
const F26 = "26 — soupe de corail (base) / soupe de corail (fond.)";
const F27 = "27 — corail traité ciment (base) / soupe de corail (fond.)";
const F28 = "28 — corail concassé traité ciment (base) / soupe corallienne ciment (fond.)";
const F29 = "29 — corail concassé traité bitume (base) / soupe corallienne ciment (fond.)";

export const FICHES = [
  // ---- 1 latérite naturelle (p-17 T1-T2, p-20 T3) ----------------------------------
  T(F1,"p-17","S1","T1","b",3,"LAT:15/LAT:45"), T(F1,"p-17","S1","T2","t",4,"LAT:15/LAT:45"),
  T(F1,"p-17","S2","T1","b",3,"LAT:15/LAT:35"), T(F1,"p-17","S2","T2","t",4,"LAT:15/LAT:35"),
  T(F1,"p-17","S3","T1","b",3,"LAT:15/LAT:25"), T(F1,"p-17","S3","T2","t",4,"LAT:15/LAT:30"),
  T(F1,"p-17","S4","T1","b",3,"LAT:15/LAT:15"), T(F1,"p-17","S4","T2","t",4,"LAT:15/LAT:20"),
  T(F1,"p-17","S5","T1","b",3,"LAT:25"),        T(F1,"p-17","S5","T2","t",4,"LAT:25"),
  T(F1,"p-20","S1","T3","e",5,"LAT:20/LAT:40"), T(F1,"p-20","S2","T3","e",5,"LAT:20/LAT:30"),
  T(F1,"p-20","S3","T3","e",5,"LAT:20/LAT:20"), T(F1,"p-20","S4","T3","e",5,"LAT:20/LAT:15"),
  T(F1,"p-20","S5","T3","e",5,"LAT:25"),

  // ---- 2 latérite/grave améliorée ciment (p-17/p-20) -------------------------------
  T(F2,"p-17","S1","T1","b",3,"LATC:15/LG0D:40"), T(F2,"p-17","S1","T2","t",4,"LATC:15/LG0D:45"),
  T(F2,"p-17","S2","T1","b",3,"LATC:15/LG0D:30"), T(F2,"p-17","S2","T2","t",4,"LATC:15/LG0D:35"),
  T(F2,"p-17","S3","T1","b",3,"LATC:15/LG0D:25"), T(F2,"p-17","S3","T2","t",4,"LATC:15/LG0D:25"),
  T(F2,"p-17","S4","T1","b",3,"LATC:15/LG0D:15"), T(F2,"p-17","S4","T2","t",4,"LATC:15/LG0D:20"),
  T(F2,"p-17","S5","T1","b",3,"LATC:20"),         T(F2,"p-17","S5","T2","t",4,"LATC:20"),
  T(F2,"p-20","S1","T3","e",5,"LATC:20/LG0D:45"), T(F2,"p-20","S2","T3","e",5,"LATC:20/LG0D:25"),
  T(F2,"p-20","S3","T3","e",5,"LATC:20/LG0D:20"), T(F2,"p-20","S4","T3","e",5,"LATC:20/LG0D:15"),
  T(F2,"p-20","S5","T3","e",5,"LATC:20"),
  T(F2,"p-20","S1","T4","e",7,"LATC:20/LG0D:50"), T(F2,"p-20","S2","T4","e",7,"LATC:20/LG0D:30"),
  T(F2,"p-20","S3","T4","e",7,"LATC:20/LG0D:25"), T(F2,"p-20","S4","T4","e",7,"LATC:20/LG0D:20"),
  T(F2,"p-20","S5","T4","e",7,"LATC:20"),

  // ---- 3 concassé (base) / latérite-grave-concassé (fond.) -------------------------
  T(F3,"p-17","S1","T1","b",3,"CON:15/LGC:40"), T(F3,"p-17","S1","T2","t",4,"CON:15/LGC:45"),
  T(F3,"p-17","S2","T1","b",3,"CON:15/LGC:30"), T(F3,"p-17","S2","T2","t",4,"CON:15/LGC:35"),
  T(F3,"p-17","S3","T1","b",3,"CON:15/LGC:25"), T(F3,"p-17","S3","T2","t",4,"CON:15/LGC:25"),
  T(F3,"p-17","S4","T1","b",3,"CON:15/LGC:15"), T(F3,"p-17","S4","T2","t",4,"CON:15/LGC:20"),
  T(F3,"p-17","S5","T1","b",3,"CON:20"),        T(F3,"p-17","S5","T2","t",4,"CON:20"),
  T(F3,"p-20","S1","T3","e",5,"CON:20/LGT:40"), T(F3,"p-20","S2","T3","e",5,"CON:20/LGT:30"),
  T(F3,"p-20","S3","T3","e",5,"CON:20/LGT:25"), T(F3,"p-20","S4","T3","e",5,"CON:20/LGT:20"),
  T(F3,"p-20","S5","T3","e",5,"CON:20"),
  T(F3,"p-20","S1","T4","e",7,"CON:20/LGT:45"), T(F3,"p-20","S2","T4","e",7,"CON:30/LGT:30"),
  T(F3,"p-20","S3","T4","e",7,"CON:25/LGT:25"), T(F3,"p-20","S4","T4","e",7,"CON:25/LGT:20"),
  T(F3,"p-20","S5","T4","e",7,"CON:25"),

  // ---- 4 concassé base+fondation (T1-T2 combine, T3-T4 separe) ---------------------
  T(F4,"p-17","S1","T1","b",3,"CON:50"), T(F4,"p-17","S1","T2","t",4,"CON:55"),
  T(F4,"p-17","S2","T1","b",3,"CON:30"), T(F4,"p-17","S2","T2","t",4,"CON:35"),
  T(F4,"p-17","S3","T1","b",3,"CON:25"), T(F4,"p-17","S3","T2","t",4,"CON:30"),
  T(F4,"p-17","S4","T1","b",3,"CON:25"), T(F4,"p-17","S4","T2","t",4,"CON:30"),
  T(F4,"p-17","S5","T1","b",3,"CON:20"), T(F4,"p-17","S5","T2","t",4,"CON:20"),
  T(F4,"p-20","S1","T3","e",5,"CON:25/CON:60"), T(F4,"p-20","S2","T3","e",5,"CON:25/CON:45"),
  T(F4,"p-20","S3","T3","e",5,"CON:25/CON:40"), T(F4,"p-20","S4","T3","e",5,"CON:25/CON:30"),
  T(F4,"p-20","S5","T3","e",5,"CON:20/CON:20"),
  T(F4,"p-20","S1","T4","e",7,"CON:30/CON:65"), T(F4,"p-20","S2","T4","e",7,"CON:25/CON:50"),
  T(F4,"p-20","S3","T4","e",7,"CON:25/CON:45"), T(F4,"p-20","S4","T4","e",7,"CON:25/CON:35"),
  T(F4,"p-20","S5","T4","e",7,"CON:25/CON:25"),

  // ---- 5 grave/latérite/concassé (base) / sable argileux (fond.) -------------------
  T(F5,"p-17","S1","T1","b",3,"GLC:20/SA:40"), T(F5,"p-17","S1","T2","t",4,"GLC:20/SA:40"),
  T(F5,"p-17","S2","T1","b",3,"GLC:20/SA:30"), T(F5,"p-17","S2","T2","t",4,"GLC:20/SA:30"),
  T(F5,"p-17","S3","T1","b",3,"GLC:20/SA:25"), T(F5,"p-17","S3","T2","t",4,"GLC:20/SA:25"),
  T(F5,"p-17","S4","T1","b",3,"GLC:20/SA:15"), T(F5,"p-17","S4","T2","t",4,"GLC:20/SA:20"),
  T(F5,"p-17","S5","T1","b",3,"GLC:25"),       T(F5,"p-17","S5","T2","t",4,"GLC:25"),
  T(F5,"p-20","S1","T3","e",5,"GLC:25/SA:45"), T(F5,"p-20","S2","T3","e",5,"GLC:25/SA:30"),
  T(F5,"p-20","S3","T3","e",5,"GLC:25/SA:25"), T(F5,"p-20","S4","T3","e",5,"GLC:25/SA:20"),
  T(F5,"p-20","S5","T3","e",5,"GLC:20"),

  // ---- 6 sable-ciment (base) / sable argileux (fond.) ------------------------------
  T(F6,"p-17","S1","T1","b",3,"SAC:15/SA:40"), T(F6,"p-17","S1","T2","t",4,"SAC:15/SA:45"),
  T(F6,"p-17","S2","T1","b",3,"SAC:15/SA:30"), T(F6,"p-17","S2","T2","t",4,"SAC:15/SA:35"),
  T(F6,"p-17","S3","T1","b",3,"SAC:15/SA:20"), T(F6,"p-17","S3","T2","t",4,"SAC:15/SA:25"),
  T(F6,"p-17","S4","T1","b",3,"SAC:15/SA:15"), T(F6,"p-17","S4","T2","t",4,"SAC:15/SA:20"),
  T(F6,"p-17","S5","T1","b",3,"SAC:20/SA:10"), T(F6,"p-17","S5","T2","t",4,"SAC:20/SA:15"),
  T(F6,"p-20","S1","T3","e",5,"SAC:20/SA:55"), T(F6,"p-20","S2","T3","e",5,"SAC:20/SA:35"),
  T(F6,"p-20","S3","T3","e",5,"SAC:20/SA:25"), T(F6,"p-20","S4","T3","e",5,"SAC:20/SA:20"),
  T(F6,"p-20","S5","T3","e",5,"SAC:20"),

  // ---- 7 sable-ciment (base) / sable ou grave ciment (fond.) T3 --------------------
  T(F7,"p-21","S1","T3","e",5,"SAC:20/SGC:40"), T(F7,"p-21","S2","T3","e",5,"SAC:20/SGC:25"),
  T(F7,"p-21","S3","T3","e",5,"SAC:20/SGC:20"), T(F7,"p-21","S4","T3","e",5,"SAC:20/SGC:15"),
  T(F7,"p-21","S5","T3","e",5,"SAC:20"),

  // ---- 8 sable-bitume (base) / sable argileux (fond.) ------------------------------
  T(F8,"p-18","S1","T1","b",3,"SB:12/SA:40"), T(F8,"p-18","S1","T2","t",4,"SB:15/SA:45"),
  T(F8,"p-18","S2","T1","b",3,"SB:12/SA:30"), T(F8,"p-18","S2","T2","t",4,"SB:15/SA:30"),
  T(F8,"p-18","S3","T1","b",3,"SB:12/SA:20"), T(F8,"p-18","S3","T2","t",4,"SB:15/SA:25"),
  T(F8,"p-18","S4","T1","b",3,"SB:12/SA:15"), T(F8,"p-18","S4","T2","t",4,"SB:15/SA:20"),
  T(F8,"p-18","S5","T1","b",3,"SB:12"),       T(F8,"p-18","S5","T2","t",4,"SB:15"),
  T(F8,"p-22","S1","T3","e",5,"SB:15/SA:50"), T(F8,"p-22","S2","T3","e",5,"SB:15/SA:30"),
  T(F8,"p-22","S3","T3","e",5,"SB:15/SA:25"), T(F8,"p-22","S4","T3","e",5,"SB:15/SA:20"),
  T(F8,"p-22","S5","T3","e",5,"SB:20"),

  // ---- 9 sable/grave-bitume (base) / sol-chaux (fond.) -----------------------------
  T(F9,"p-18","S1","T1","b",3,"SB:12/SCH:20"), T(F9,"p-18","S1","T2","t",4,"SB:15/SCH:20"),
  T(F9,"p-18","S2","T1","b",3,"SB:12/SCH:15"), T(F9,"p-18","S2","T2","t",4,"SB:15/SCH:20"),
  T(F9,"p-18","S3","T1","b",3,"SB:12/SCH:15"), T(F9,"p-18","S3","T2","t",4,"SB:15/SCH:20"),
  T(F9,"p-18","S4","T1","b",3,"SB:12/SCH:15"), T(F9,"p-18","S4","T2","t",4,"SB:15/SCH:15"),
  T(F9,"p-18","S5","T1","b",3,"SB:12"),        T(F9,"p-18","S5","T2","t",4,"SB:15"),
  T(F9,"p-22","S1","T3","e",5,"SB:15/SCH:25"), T(F9,"p-22","S2","T3","e",5,"SB:15/SCH:20"),
  T(F9,"p-22","S3","T3","e",5,"SB:15/SCH:20"), T(F9,"p-22","S4","T3","e",5,"SB:15/SCH:15"),
  T(F9,"p-22","S5","T3","e",5,"SB:20"),

  // ---- 10 sol-chaux (base) / sable argileux (fond.) T1-T2 --------------------------
  T(F10,"p-18","S1","T1","b",3,"SCH:15/SA:40"), T(F10,"p-18","S1","T2","t",4,"SCH:15/SA:45"),
  T(F10,"p-18","S2","T1","b",3,"SCH:15/SA:30"), T(F10,"p-18","S2","T2","t",4,"SCH:15/SA:30"),
  T(F10,"p-18","S3","T1","b",3,"SCH:15/SA:20"), T(F10,"p-18","S3","T2","t",4,"SCH:15/SA:25"),
  T(F10,"p-18","S4","T1","b",3,"SCH:15/SA:15"), T(F10,"p-18","S4","T2","t",4,"SCH:15/SA:20"),
  T(F10,"p-18","S5","T1","b",3,"SCH:15"),       T(F10,"p-18","S5","T2","t",4,"SCH:15"),

  // ---- 11 concassé (base) / sol-chaux (fond.) --------------------------------------
  T(F11,"p-18","S1","T1","b",3,"CON:20/SCH:20"), T(F11,"p-18","S1","T2","t",4,"CON:20/SCH:20"),
  T(F11,"p-18","S2","T1","b",3,"CON:20/SCH:15"), T(F11,"p-18","S2","T2","t",4,"CON:20/SCH:20"),
  T(F11,"p-18","S3","T1","b",3,"CON:20/SCH:15"), T(F11,"p-18","S3","T2","t",4,"CON:20/SCH:20"),
  T(F11,"p-18","S4","T1","b",3,"CON:20/SCH:15"), T(F11,"p-18","S4","T2","t",4,"CON:20/SCH:15"),
  T(F11,"p-18","S5","T1","b",3,"CON:20"),        T(F11,"p-18","S5","T2","t",4,"CON:20"),
  T(F11,"p-22","S1","T3","e",5,"CON:20/SCH:25"), T(F11,"p-22","S2","T3","e",5,"CON:20/SCH:20"),
  T(F11,"p-22","S3","T3","e",5,"CON:20/SCH:15"), T(F11,"p-22","S4","T3","e",5,"CON:20/SCH:15"),
  T(F11,"p-22","S5","T3","e",5,"CON:20"),

  // ---- 12 grave-ciment (base) / latérite-grave-concassé (fond.) S1 proscrit --------
  T(F12,"p-21","S2","T3","e",5,"GC:20/LGC:30"), T(F12,"p-21","S3","T3","e",5,"GC:20/LGC:25"),
  T(F12,"p-21","S4","T3","e",5,"GC:20/LGC:20"), T(F12,"p-21","S5","T3","e",5,"GC:20"),
  T(F12,"p-21","S2","T4","e",7,"GC:20/LGC:35"), T(F12,"p-21","S3","T4","e",7,"GC:20/LGC:30"),
  T(F12,"p-21","S4","T4","e",7,"GC:20/LGC:20"), T(F12,"p-21","S5","T4","e",7,"GC:20"),
  T(F12,"p-24","S2","T5","e",10,"GC:22/LGT:35"), T(F12,"p-24","S3","T5","e",10,"GC:22/LGT:20"),
  T(F12,"p-24","S4","T5","e",10,"GC:22/LGT:25"), T(F12,"p-24","S5","T5","e",10,"GC:25"),

  // ---- 13 grave-ciment (base) / sable ou grave ciment (fond.) ----------------------
  T(F13,"p-21","S1","T3","e",5,"GC:20/SGC:40"), T(F13,"p-21","S2","T3","e",5,"GC:20/SGC:25"),
  T(F13,"p-21","S3","T3","e",5,"GC:20/SGC:20"), T(F13,"p-21","S4","T3","e",5,"GC:20/SGC:15"),
  T(F13,"p-21","S5","T3","e",5,"GC:20"),
  T(F13,"p-21","S1","T4","e",7,"GC:20/SGC:45"), T(F13,"p-21","S2","T4","e",7,"GC:20/SGC:30"),
  T(F13,"p-21","S3","T4","e",7,"GC:20/SGC:25"), T(F13,"p-21","S4","T4","e",7,"GC:20/SGC:15"),
  T(F13,"p-21","S5","T4","e",7,"GC:20"),
  T(F13,"p-24","S1","T5","e",10,"GC:22/SGC:45"), T(F13,"p-24","S2","T5","e",10,"GC:22/SGC:25"),
  T(F13,"p-24","S3","T5","e",10,"GC:22/SGC:20"), T(F13,"p-24","S4","T5","e",10,"GC:22/SGC:15"),
  T(F13,"p-24","S5","T5","e",10,"GC:25"),

  // ---- 14 grave-ciment (base) / sol-chaux (fond.) ----------------------------------
  T(F14,"p-22","S1","T3","e",5,"GC:20/SCH:20"), T(F14,"p-22","S2","T3","e",5,"GC:20/SCH:20"),
  T(F14,"p-22","S3","T3","e",5,"GC:20/SCH:15"), T(F14,"p-22","S4","T3","e",5,"GC:20/SCH:15"),
  T(F14,"p-22","S5","T3","e",5,"GC:20"),
  T(F14,"p-22","S1","T4","e",7,"GC:20/SCH:25"), T(F14,"p-22","S2","T4","e",7,"GC:20/SCH:20"),
  T(F14,"p-22","S3","T4","e",7,"GC:20/SCH:20"), T(F14,"p-22","S4","T4","e",7,"GC:20/SCH:15"),
  T(F14,"p-22","S5","T4","e",7,"GC:20"),
  T(F14,"p-25","S1","T5","e",10,"GC:22/SCH:30"), T(F14,"p-25","S2","T5","e",10,"GC:22/SCH:25"),
  T(F14,"p-25","S3","T5","e",10,"GC:22/SCH:20"), T(F14,"p-25","S4","T5","e",10,"GC:22/SCH:15"),
  T(F14,"p-25","S5","T5","e",10,"GC:25"),

  // ---- 15 grave-ciment (base) / scories (fond.) S1 proscrit ------------------------
  T(F15,"p-22","S2","T3","e",5,"GC:20/SCO:35"), T(F15,"p-22","S3","T3","e",5,"GC:20/SCO:25"),
  T(F15,"p-22","S4","T3","e",5,"GC:20/SCO:20"), T(F15,"p-22","S5","T3","e",5,"GC:20"),
  T(F15,"p-22","S2","T4","e",7,"GC:20/SCO:40"), T(F15,"p-22","S3","T4","e",7,"GC:20/SCO:30"),
  T(F15,"p-22","S4","T4","e",7,"GC:20/SCO:20"), T(F15,"p-22","S5","T4","e",7,"GC:20"),
  T(F15,"p-24","S2","T5","e",10,"GC:22/SCO:35"), T(F15,"p-24","S3","T5","e",10,"GC:22/SCO:30"),
  T(F15,"p-24","S4","T5","e",10,"GC:22/SCO:25"), T(F15,"p-24","S5","T5","e",10,"GC:25"),

  // ---- 16 grave-bitume (base) / graveleux naturel ou concassé (fond.) --------------
  T(F16,"p-21","S1","T3","e",4,"GB:15/LGC:45"), T(F16,"p-21","S2","T3","e",4,"GB:15/LGC:30"),
  T(F16,"p-21","S3","T3","e",4,"GB:15/LGC:25"), T(F16,"p-21","S4","T3","e",4,"GB:15/LGC:15"),
  T(F16,"p-21","S5","T3","e",4,"GB:15"),
  T(F16,"p-21","S1","T4","e",5,"GB:15/LGC:50"), T(F16,"p-21","S2","T4","e",5,"GB:15/LGC:35"),
  T(F16,"p-21","S3","T4","e",5,"GB:15/LGC:25"), T(F16,"p-21","S4","T4","e",5,"GB:15/LGC:20"),
  T(F16,"p-21","S5","T4","e",5,"GB:15"),
  T(F16,"p-24","S1","T5","e",7,"GB:18/LGT:50"), T(F16,"p-24","S2","T5","e",7,"GB:18/LGT:35"),
  T(F16,"p-24","S3","T5","e",7,"GB:18/LGT:30"), T(F16,"p-24","S4","T5","e",7,"GB:18/LGT:25"),
  T(F16,"p-24","S5","T5","e",7,"GB:18"),

  // ---- 17 grave-bitume (base) / sable-ciment, grave-ciment ou sable-bitume (fond.) -
  T(F17,"p-21","S1","T3","e",4,"GB:15/MIXC:40"), T(F17,"p-21","S2","T3","e",4,"GB:15/MIXC:25"),
  T(F17,"p-21","S3","T3","e",4,"GB:15/MIXC:20"), T(F17,"p-21","S4","T3","e",4,"GB:15/MIXC:15"),
  T(F17,"p-21","S5","T3","e",4,"GB:15"),
  T(F17,"p-21","S1","T4","e",5,"GB:15/MIXC:45"), T(F17,"p-21","S2","T4","e",5,"GB:15/MIXC:30"),
  T(F17,"p-21","S3","T4","e",5,"GB:15/MIXC:25"), T(F17,"p-21","S4","T4","e",5,"GB:15/MIXC:15"),
  T(F17,"p-21","S5","T4","e",5,"GB:15"),
  T(F17,"p-24","S1","T5","e",7,"GB:17/GAC:45"), T(F17,"p-24","S2","T5","e",7,"GB:17/GAC:25"),
  T(F17,"p-24","S3","T5","e",7,"GB:17/GAC:20"), T(F17,"p-24","S4","T5","e",7,"GB:17/GAC:15"),
  T(F17,"p-24","S5","T5","e",7,"GB:20"),

  // ---- 18 grave-bitume (base) / sable-bitume (fond.) T5 ----------------------------
  T(F18,"p-24","S1","T5","e",7,"GB:17/SB:45"), T(F18,"p-24","S2","T5","e",7,"GB:17/SB:25"),
  T(F18,"p-24","S3","T5","e",7,"GB:17/SB:20"), T(F18,"p-24","S4","T5","e",7,"GB:17/SB:20"),
  T(F18,"p-24","S5","T5","e",7,"GB:20"),

  // ---- 19 grave-bitume (base) / scories (fond.) ------------------------------------
  T(F19,"p-22","S1","T3","e",4,"GB:15/SCO:50"), T(F19,"p-22","S2","T3","e",4,"GB:15/SCO:35"),
  T(F19,"p-22","S3","T3","e",4,"GB:15/SCO:25"), T(F19,"p-22","S4","T3","e",4,"GB:15/SCO:20"),
  T(F19,"p-22","S5","T3","e",4,"GB:20"),
  T(F19,"p-22","S1","T4","e",5,"GB:15/SCO:50"), T(F19,"p-22","S2","T4","e",5,"GB:15/SCO:40"),
  T(F19,"p-22","S3","T4","e",5,"GB:15/SCO:30"), T(F19,"p-22","S4","T4","e",5,"GB:15/SCO:20"),
  T(F19,"p-22","S5","T4","e",5,"GB:20"),
  T(F19,"p-25","S1","T5","e",7,"GB:18/SCO:55"), T(F19,"p-25","S2","T5","e",7,"GB:18/SCO:35"),
  T(F19,"p-25","S3","T5","e",7,"GB:18/SCO:30"), T(F19,"p-25","S4","T5","e",7,"GB:18/SCO:25"),
  T(F19,"p-25","S5","T5","e",7,"GB:20"),

  // ---- 20 grave-bitume (base) / sol-chaux (fond.) T5 -------------------------------
  T(F20,"p-25","S1","T5","e",7,"GB:17/SCH:30"), T(F20,"p-25","S2","T5","e",7,"GB:17/SCH:25"),
  T(F20,"p-25","S3","T5","e",7,"GB:17/SCH:20"), T(F20,"p-25","S4","T5","e",7,"GB:17/SCH:15"),
  T(F20,"p-25","S5","T5","e",7,"GB:20"),

  // ---- 21 scories/concassé (base) / scories ou pouzzolanes (fond.) -----------------
  T(F21,"p-18","S1","T1","b",3,"SCO:15/SCOP:45"), T(F21,"p-18","S1","T2","t",4,"SCO:15/SCOP:50"),
  T(F21,"p-18","S2","T1","b",3,"SCO:15/SCOP:30"), T(F21,"p-18","S2","T2","t",4,"SCO:15/SCOP:40"),
  T(F21,"p-18","S3","T1","b",3,"SCO:15/SCOP:25"), T(F21,"p-18","S3","T2","t",4,"SCO:15/SCOP:25"),
  T(F21,"p-18","S4","T1","b",3,"SCO:15/SCOP:15"), T(F21,"p-18","S4","T2","t",4,"SCO:15/SCOP:20"),
  T(F21,"p-18","S5","T2","t",4,"SCO:20"),
  T(F21,"p-22","S1","T3","e",5,"CON:20/SCO:45"), T(F21,"p-22","S2","T3","e",5,"CON:20/SCO:30"),
  T(F21,"p-22","S3","T3","e",5,"CON:20/SCO:25"), T(F21,"p-22","S4","T3","e",5,"CON:20/SCO:15"),
  T(F21,"p-22","S5","T3","e",5,"CON:20"),

  // ---- 22 béton de sol (base) / graveleux latéritique (fond.) T1-T2 ----------------
  T(F22,"p-18","S1","T1","b",3,"BS:15/LAT:45"), T(F22,"p-18","S1","T2","t",4,"BS:15/LAT:45"),
  T(F22,"p-18","S2","T1","b",3,"BS:15/LAT:35"), T(F22,"p-18","S2","T2","t",4,"BS:15/LAT:35"),
  T(F22,"p-18","S3","T1","b",3,"BS:15/LAT:25"), T(F22,"p-18","S3","T2","t",4,"BS:15/LAT:25"),
  T(F22,"p-18","S4","T1","b",3,"BS:15/LAT:15"), T(F22,"p-18","S4","T2","t",4,"BS:15/LAT:20"),
  T(F22,"p-18","S5","T2","t",4,"BS:20"),

  // ---- 23 banco-coquillage / grave-bitume (base) / banco-coquillage (fond.) --------
  T(F23,"p-18","S1","T1","b",3,"BANB:10/BAN:45"), T(F23,"p-18","S2","T1","b",3,"BANB:10/BAN:30"),
  T(F23,"p-18","S3","T1","b",3,"BANB:10/BAN:20"), T(F23,"p-18","S4","T1","b",3,"BANB:10/BAN:15"),
  T(F23,"p-18","S5","T1","b",3,"BANB:12"),
  T(F23,"p-23","S1","T3","e",4,"GB:12/BANC:20"), T(F23,"p-23","S2","T3","e",4,"GB:12/BANC:15"),
  T(F23,"p-23","S3","T3","e",4,"GB:12/BANC:15"), T(F23,"p-23","S4","T3","e",4,"GB:12/BANC:15"),
  T(F23,"p-23","S5","T3","e",4,"GB:15"),
  T(F23,"p-23","S1","T4","e",5,"GB:12/BANC:25"), T(F23,"p-23","S2","T4","e",5,"GB:12/BANC:20"),
  T(F23,"p-23","S3","T4","e",5,"GB:12/BANC:15"), T(F23,"p-23","S4","T4","e",5,"GB:12/BANC:10"),
  T(F23,"p-23","S5","T4","e",5,"GB:15"),
  T(F23,"p-25","S1","T5","e",7,"GB:17/BANB:30"), T(F23,"p-25","S2","T5","e",7,"GB:17/BANB:25"),
  T(F23,"p-25","S3","T5","e",7,"GB:17/BANB:20"), T(F23,"p-25","S4","T5","e",7,"GB:17/BANB:15"),
  T(F23,"p-25","S5","T5","e",7,"GB:20"),

  // ---- 24 banco-coquillage amélioré ciment (base) / banco-coquillage (fond.) -------
  T(F24,"p-19","S1","T1","b",3,"BANC:15/BAN:45"), T(F24,"p-19","S1","T2","t",4,"BANC:15/BAN:50"),
  T(F24,"p-19","S2","T1","b",3,"BANC:15/BAN:30"), T(F24,"p-19","S2","T2","t",4,"BANC:15/BAN:35"),
  T(F24,"p-19","S3","T1","b",3,"BANC:15/BAN:20"), T(F24,"p-19","S3","T2","t",4,"BANC:15/BAN:25"),
  T(F24,"p-19","S4","T1","b",3,"BANC:15/BAN:15"), T(F24,"p-19","S4","T2","t",4,"BANC:15/BAN:20"),
  T(F24,"p-19","S5","T1","b",3,"BANC:20"),        T(F24,"p-19","S5","T2","t",4,"BANC:20"),

  // ---- 25 sable coquillier 0/30 (base) / 0/50 (fond.) T1 ---------------------------
  T(F25,"p-19","S1","T1","b",3,"SCOQ30:20/SCOQ50:45"), T(F25,"p-19","S2","T1","b",3,"SCOQ30:20/SCOQ50:30"),
  T(F25,"p-19","S3","T1","b",3,"SCOQ30:20/SCOQ50:25"), T(F25,"p-19","S4","T1","b",3,"SCOQ30:20/SCOQ50:20"),
  T(F25,"p-19","S5","T1","b",3,"SCOQ30:20"),

  // ---- 26 soupe de corail (base) / soupe de corail (fond.) T1-T2 -------------------
  T(F26,"p-19","S1","T1","b",3,"COR:15/CORS:45"), T(F26,"p-19","S1","T2","t",4,"COR:20/CORS:50"),
  T(F26,"p-19","S2","T1","b",3,"COR:15/CORS:30"), T(F26,"p-19","S2","T2","t",4,"COR:20/CORS:35"),
  T(F26,"p-19","S3","T1","b",3,"COR:15/CORS:20"), T(F26,"p-19","S3","T2","t",4,"COR:20/CORS:25"),
  T(F26,"p-19","S4","T1","b",3,"COR:15/CORS:15"), T(F26,"p-19","S4","T2","t",4,"COR:20/CORS:20"),
  T(F26,"p-19","S5","T1","b",3,"COR:20"),         T(F26,"p-19","S5","T2","t",4,"COR:25"),

  // ---- 27 corail traité ciment (base) / soupe de corail (fond.) T2-T3 --------------
  T(F27,"p-19","S1","T2","t",4,"CORC:15/CORS:50"), T(F27,"p-19","S2","T2","t",4,"CORC:15/CORS:35"),
  T(F27,"p-19","S3","T2","t",4,"CORC:15/CORS:25"), T(F27,"p-19","S4","T2","t",4,"CORC:15/CORS:20"),
  T(F27,"p-19","S5","T2","t",4,"CORC:20"),
  T(F27,"p-23","S1","T3","e",5,"CORC:20/CORS:50"), T(F27,"p-23","S2","T3","e",5,"CORC:20/CORS:35"),
  T(F27,"p-23","S3","T3","e",5,"CORC:20/CORS:25"), T(F27,"p-23","S4","T3","e",5,"CORC:20/CORS:20"),
  T(F27,"p-23","S5","T3","e",5,"CORC:25"),

  // ---- 28 corail concassé traité ciment (base) / soupe corallienne ciment (fond.) -
  T(F28,"p-23","S1","T3","e",5,"CORC:15/SCC:40"), T(F28,"p-23","S2","T3","e",5,"CORC:15/SCC:20"),
  T(F28,"p-23","S3","T3","e",5,"CORC:15/SCC:15"), T(F28,"p-23","S4","T3","e",5,"CORC:15/SCC:15"),
  T(F28,"p-23","S5","T3","e",5,"CORC:20"),
  T(F28,"p-23","S1","T4","e",7,"CORC:15/SCC:45"), T(F28,"p-23","S2","T4","e",7,"CORC:15/SCC:25"),
  T(F28,"p-23","S3","T4","e",7,"CORC:15/SCC:20"), T(F28,"p-23","S4","T4","e",7,"CORC:15/SCC:15"),
  T(F28,"p-23","S5","T4","e",7,"CORC:20"),
  T(F28,"p-25","S1","T5","e",10,"CORC:20/SCC:45"), T(F28,"p-25","S2","T5","e",10,"CORC:20/SCC:25"),
  T(F28,"p-25","S3","T5","e",10,"CORC:20/SCC:20"), T(F28,"p-25","S4","T5","e",10,"CORC:20/SCC:15"),
  T(F28,"p-25","S5","T5","e",10,"CORC:25"),

  // ---- 29 corail concassé traité bitume (base) / soupe corallienne ciment (fond.) -
  T(F29,"p-23","S1","T3","e",4,"CORB:12/SCC:40"), T(F29,"p-23","S2","T3","e",4,"CORB:12/SCC:20"),
  T(F29,"p-23","S3","T3","e",4,"CORB:12/SCC:15"), T(F29,"p-23","S4","T3","e",4,"CORB:12/SCC:15"),
  T(F29,"p-23","S5","T3","e",4,"CORB:15"),
  T(F29,"p-23","S1","T4","e",5,"CORB:12/SCC:45"), T(F29,"p-23","S2","T4","e",5,"CORB:12/SCC:25"),
  T(F29,"p-23","S3","T4","e",5,"CORB:12/SCC:20"), T(F29,"p-23","S4","T4","e",5,"CORB:12/SCC:15"),
  T(F29,"p-23","S5","T4","e",5,"CORB:15"),
  T(F29,"p-25","S1","T5","e",7,"CORB:17/SCC:45"), T(F29,"p-25","S2","T5","e",7,"CORB:17/SCC:25"),
  T(F29,"p-25","S3","T5","e",7,"CORB:17/SCC:20"), T(F29,"p-25","S4","T5","e",7,"CORB:17/SCC:15"),
  T(F29,"p-25","S5","T5","e",7,"CORB:20"),
];

export const CATALOGUE = catalogueStructures({
  pays: "tropical",
  reference: "Guide pratique de dimensionnement CEBTP 1980 (29 familles, méthode déterministe)",
  fiches: FICHES,
  cle: "classe-trafic",
});
