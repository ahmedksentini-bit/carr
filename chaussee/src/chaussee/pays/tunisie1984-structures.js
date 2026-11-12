// Catalogue de chaussées neuves SETIC / DPC d'août 1984 (portage de
// Tunisia1984Structures de Burmister-Calc) : 10 fiches (scans p058-p067,
// ordre du PDF inversé), indexées T1-T5 × S1-S4. T1 = trafic le plus LOURD.
// Les cellules « voir fiches… » et les cases vides sont omises. Enduits
// monocouche / bicouche : 1 cm / 2 cm, par convention (non chiffrés au
// catalogue). Provisoire.

import { catalogueStructures } from "./base.js";

const SRC = "Catalogue Tunisie 1984";

const l = (nature, epCm, famille, materiau) => ({ nature, epCm, famille, materiau, interface: null });
const mc = () => l("Enduit monocouche", 1, "bitumineux", "MC");
const bc = () => l("Enduit bicouche", 2, "bitumineux", "BC");
const bb = (cm) => l("Béton bitumineux", cm, "bitumineux", "BB");

const f = (famille, page, sol, trafic, couches, note = null) => ({
  classeTrafic: trafic, classePortance: sol, famille, couches, source: `${SRC}, ${page}`,
  provisoire: true, note, intervention: "neuve",
});

const F1 = "Fiche 1 — GR/GR (base et fondation grave reconstituée)";
const F2 = "Fiche 2 — GR/G (base GR / fondation grave concassée)";
const F3 = "Fiche 3 — G/G (base et fondation grave concassée)";
const F4 = "Fiche 4 — T/T (tuf compact, région C)";
const F5 = "Fiche 5 — SG/SG (sable gypseux, région C)";
const F6 = "Fiche 6 — GB/G (base grave-bitume / fondation G)";
const F7 = "Fiche 7 — GB/T (base GB / fondation tuf, région C)";
const F8 = "Fiche 8 — GC/G (base grave-ciment / fondation G)";
const F9 = "Fiche 9 — GL/G (base grave laitier / fondation G)";
const F10 = "Fiche 10 — SL/G (base sable laitier / fondation G)";

const GLX = "Épaisseurs = GLY (gypsonat). GLX (chaux) : majorer la couche traitée de 10 %.";
const SCLX = "Épaisseurs = SCLY (gypsonat). SCLX (chaux) : majorer la couche traitée de 10 %.";
const NAT_G = "Fondation +15 % si grave naturelle (note fiche 2).";
const G40 = "Fondation +10 % si grave 0/40 à indice de concassage < 50 %.";

export const FICHES_TUNISIE_1984 = [
  // ---- Fiche 1 (p-067) GR/GR — T1 renvoyé aux fiches 6-10 ----
  f(F1, "p-067", "S1", "T2", [bb(5), l("GR (base)", 20, "sol", "GR"), l("GR (fondation)", 35, "sol", "GR")]),
  f(F1, "p-067", "S1", "T2", [bc(), l("GR (base)", 30, "sol", "GR"), l("GR (fondation)", 35, "sol", "GR")], "Variante enduit bicouche."),
  f(F1, "p-067", "S2", "T2", [bb(5), l("GR (base)", 20, "sol", "GR"), l("GR (fondation)", 30, "sol", "GR")]),
  f(F1, "p-067", "S2", "T2", [bc(), l("GR (base)", 30, "sol", "GR"), l("GR (fondation)", 30, "sol", "GR")], "Variante enduit bicouche."),
  f(F1, "p-067", "S3", "T2", [bb(5), l("GR (base)", 20, "sol", "GR"), l("GR (fondation)", 25, "sol", "GR")]),
  f(F1, "p-067", "S3", "T2", [bc(), l("GR (base)", 20, "sol", "GR"), l("GR (fondation)", 30, "sol", "GR")], "Variante enduit bicouche."),
  f(F1, "p-067", "S4", "T2", [bb(5), l("GR (base)", 15, "sol", "GR"), l("GR (fondation)", 20, "sol", "GR")]),
  f(F1, "p-067", "S4", "T2", [bc(), l("GR (base)", 20, "sol", "GR"), l("GR (fondation)", 25, "sol", "GR")], "Variante enduit bicouche."),
  f(F1, "p-067", "S1", "T3", [bc(), l("GR (base)", 20, "sol", "GR"), l("GR (fondation)", 40, "sol", "GR")]),
  f(F1, "p-067", "S2", "T3", [bc(), l("GR (base)", 20, "sol", "GR"), l("GR (fondation)", 30, "sol", "GR")]),
  f(F1, "p-067", "S3", "T3", [bc(), l("GR (base)", 20, "sol", "GR"), l("GR (fondation)", 25, "sol", "GR")]),
  f(F1, "p-067", "S4", "T3", [bc(), l("GR (base)", 15, "sol", "GR"), l("GR (fondation)", 20, "sol", "GR")]),
  f(F1, "p-067", "S1", "T4", [bc(), l("GR (base)", 20, "sol", "GR"), l("GR (fondation)", 30, "sol", "GR")]),
  f(F1, "p-067", "S2", "T4", [bc(), l("GR (base)", 20, "sol", "GR"), l("GR (fondation)", 25, "sol", "GR")]),
  f(F1, "p-067", "S3", "T4", [bc(), l("GR (base)", 15, "sol", "GR"), l("GR (fondation)", 20, "sol", "GR")]),
  f(F1, "p-067", "S4", "T4", [bc(), l("GR (assise)", 30, "sol", "GR")], "Couche unique (pas de fondation distincte)."),
  f(F1, "p-067", "S1", "T5", [mc(), l("GR (base)", 20, "sol", "GR"), l("GR (fondation)", 20, "sol", "GR")]),
  f(F1, "p-067", "S2", "T5", [mc(), l("GR (base)", 15, "sol", "GR"), l("GR (fondation)", 20, "sol", "GR")]),
  f(F1, "p-067", "S3", "T5", [mc(), l("GR (assise)", 30, "sol", "GR")], "Couche unique."),
  f(F1, "p-067", "S4", "T5", [mc(), l("GR (assise)", 20, "sol", "GR")], "Couche unique."),

  // ---- Fiche 2 (p-066) GR/G — T1 renvoyé aux fiches 6-10 ----
  f(F2, "p-066", "S1", "T2", [bb(5), l("GR (base)", 20, "sol", "GR"), l("G (fondation)", 40, "sol", "G")], NAT_G),
  f(F2, "p-066", "S1", "T2", [bc(), l("GR (base)", 20, "sol", "GR"), l("G (fondation)", 50, "sol", "G")], NAT_G + " Variante bicouche."),
  f(F2, "p-066", "S2", "T2", [bb(5), l("GR (base)", 20, "sol", "GR"), l("G (fondation)", 35, "sol", "G")], NAT_G),
  f(F2, "p-066", "S2", "T2", [bc(), l("GR (base)", 20, "sol", "GR"), l("G (fondation)", 45, "sol", "G")], NAT_G + " Variante bicouche."),
  f(F2, "p-066", "S3", "T2", [bb(5), l("GR (base)", 20, "sol", "GR"), l("G (fondation)", 30, "sol", "G")], NAT_G),
  f(F2, "p-066", "S3", "T2", [bc(), l("GR (base)", 20, "sol", "GR"), l("G (fondation)", 40, "sol", "G")], NAT_G + " Variante bicouche."),
  f(F2, "p-066", "S4", "T2", [bb(5), l("GR (base)", 20, "sol", "GR"), l("G (fondation)", 20, "sol", "G")], NAT_G),
  f(F2, "p-066", "S4", "T2", [bc(), l("GR (base)", 20, "sol", "GR"), l("G (fondation)", 30, "sol", "G")], NAT_G + " Variante bicouche."),
  f(F2, "p-066", "S1", "T3", [bc(), l("GR (base)", 20, "sol", "GR"), l("G (fondation)", 45, "sol", "G")], NAT_G),
  f(F2, "p-066", "S2", "T3", [bc(), l("GR (base)", 20, "sol", "GR"), l("G (fondation)", 40, "sol", "G")], NAT_G),
  f(F2, "p-066", "S3", "T3", [bc(), l("GR (base)", 20, "sol", "GR"), l("G (fondation)", 30, "sol", "G")], NAT_G),
  f(F2, "p-066", "S4", "T3", [bc(), l("GR (base)", 20, "sol", "GR"), l("G (fondation)", 25, "sol", "G")], NAT_G),
  f(F2, "p-066", "S1", "T4", [bc(), l("GR (base)", 15, "sol", "GR"), l("G (fondation)", 45, "sol", "G")], NAT_G),
  f(F2, "p-066", "S2", "T4", [bc(), l("GR (base)", 15, "sol", "GR"), l("G (fondation)", 35, "sol", "G")], NAT_G),
  f(F2, "p-066", "S3", "T4", [bc(), l("GR (base)", 15, "sol", "GR"), l("G (fondation)", 25, "sol", "G")], NAT_G),
  f(F2, "p-066", "S4", "T4", [bc(), l("GR (base)", 15, "sol", "GR"), l("G (fondation)", 20, "sol", "G")], NAT_G),
  f(F2, "p-066", "S1", "T5", [mc(), l("GR (base)", 15, "sol", "GR"), l("G (fondation)", 30, "sol", "G")], NAT_G),
  f(F2, "p-066", "S2", "T5", [mc(), l("GR (base)", 15, "sol", "GR"), l("G (fondation)", 25, "sol", "G")], NAT_G),
  f(F2, "p-066", "S3", "T5", [mc(), l("GR (base)", 15, "sol", "GR"), l("G (fondation)", 20, "sol", "G")], NAT_G),
  f(F2, "p-066", "S4", "T5", [mc(), l("GR (base)", 20, "sol", "GR"), l("G (fondation)", 20, "sol", "G")], NAT_G),

  // ---- Fiche 3 (p-065) G/G — T1-T3 renvoyés ; T4-T5 : épaisseur granulaire totale ----
  f(F3, "p-065", "S1", "T4", [bc(), l("G (assise)", 60, "sol", "G")], "Épaisseur granulaire totale (Tab. X : fractionner ≤ 30 cm/couche)."),
  f(F3, "p-065", "S2", "T4", [bc(), l("G (assise)", 50, "sol", "G")], "Épaisseur granulaire totale."),
  f(F3, "p-065", "S3", "T4", [bc(), l("G (assise)", 45, "sol", "G")], "Épaisseur granulaire totale."),
  f(F3, "p-065", "S4", "T4", [bc(), l("G (assise)", 40, "sol", "G")], "Épaisseur granulaire totale."),
  f(F3, "p-065", "S1", "T5", [mc(), l("G (assise)", 50, "sol", "G")], "Épaisseur granulaire totale."),
  f(F3, "p-065", "S2", "T5", [mc(), l("G (assise)", 45, "sol", "G")], "Épaisseur granulaire totale."),
  f(F3, "p-065", "S3", "T5", [mc(), l("G (assise)", 40, "sol", "G")], "Épaisseur granulaire totale."),
  f(F3, "p-065", "S4", "T5", [mc(), l("G (assise)", 30, "sol", "G")], "Épaisseur granulaire totale."),

  // ---- Fiche 4 (p-064) T/T région C — T1-T2 renvoyés aux fiches 6-10 ----
  f(F4, "p-064", "S2", "T3", [bb(6), l("Tuf (base)", 20, "sol", "T"), l("Tuf (fondation)", 30, "sol", "T")], "Région C. Enrobé 6 cm préférable dès T3 (arrachement)."),
  f(F4, "p-064", "S2", "T3", [bc(), l("Tuf (base)", 30, "sol", "T"), l("Tuf (fondation)", 30, "sol", "T")], "Région C. Variante bicouche (aléatoire dès T3)."),
  f(F4, "p-064", "S3", "T3", [bb(6), l("Tuf (base)", 20, "sol", "T"), l("Tuf (fondation)", 20, "sol", "T")], "Région C."),
  f(F4, "p-064", "S3", "T3", [bc(), l("Tuf (base)", 20, "sol", "T"), l("Tuf (fondation)", 30, "sol", "T")], "Région C. Variante bicouche."),
  f(F4, "p-064", "S4", "T3", [bb(6), l("Tuf (assise)", 30, "sol", "T")], "Région C. Assise unique."),
  f(F4, "p-064", "S4", "T3", [bc(), l("Tuf (base)", 20, "sol", "T"), l("Tuf (fondation)", 20, "sol", "T")], "Région C. Variante bicouche."),
  f(F4, "p-064", "S2", "T4", [bc(), l("Tuf (base)", 20, "sol", "T"), l("Tuf (fondation)", 35, "sol", "T")], "Région C."),
  f(F4, "p-064", "S3", "T4", [bc(), l("Tuf (base)", 20, "sol", "T"), l("Tuf (fondation)", 25, "sol", "T")], "Région C."),
  f(F4, "p-064", "S4", "T4", [bc(), l("Tuf (assise)", 40, "sol", "T")], "Région C. Assise unique."),
  f(F4, "p-064", "S2", "T5", [mc(), l("Tuf (base)", 20, "sol", "T"), l("Tuf (fondation)", 30, "sol", "T")], "Région C."),
  f(F4, "p-064", "S3", "T5", [mc(), l("Tuf (assise)", 40, "sol", "T")], "Région C. Assise unique."),
  f(F4, "p-064", "S4", "T5", [mc(), l("Tuf (assise)", 30, "sol", "T")], "Région C. Assise unique."),

  // ---- Fiche 5 (p-063) SG/SG région C — T1-T4 renvoyés ; T5 seulement ----
  f(F5, "p-063", "S2", "T5", [bc(), l("SG (base)", 20, "sol", "SG"), l("SG (fondation)", 35, "sol", "SG")], "Région C. Enduit superficiel délicat sur SG."),
  f(F5, "p-063", "S3", "T5", [bc(), l("SG (base)", 20, "sol", "SG"), l("SG (fondation)", 25, "sol", "SG")], "Région C."),
  f(F5, "p-063", "S4", "T5", [bc(), l("SG (assise)", 35, "sol", "SG")], "Région C. Assise unique."),

  // ---- Fiche 6 (p-062) GB/G — T4-T5 renvoyés aux fiches 1-5 ----
  f(F6, "p-062", "S1", "T1", [bb(5), l("GB (base)", 16, "bitumineux", "GB"), l("G (fondation)", 40, "sol", "G")], G40),
  f(F6, "p-062", "S2", "T1", [bb(5), l("GB (base)", 16, "bitumineux", "GB"), l("G (fondation)", 35, "sol", "G")], G40),
  f(F6, "p-062", "S3", "T1", [bb(5), l("GB (base)", 14, "bitumineux", "GB"), l("G (fondation)", 30, "sol", "G")], G40),
  f(F6, "p-062", "S4", "T1", [bb(5), l("GB (base)", 14, "bitumineux", "GB"), l("G (fondation)", 25, "sol", "G")], G40),
  f(F6, "p-062", "S1", "T2", [bb(5), l("GB (base)", 14, "bitumineux", "GB"), l("G (fondation)", 35, "sol", "G")], G40),
  f(F6, "p-062", "S1", "T2", [bc(), l("GB (base)", 16, "bitumineux", "GB"), l("G (fondation)", 20, "sol", "G"), l("G (sous-couche)", 25, "sol", "G")], G40 + " Variante bicouche."),
  f(F6, "p-062", "S2", "T2", [bb(5), l("GB (base)", 14, "bitumineux", "GB"), l("G (fondation)", 30, "sol", "G")], G40),
  f(F6, "p-062", "S2", "T2", [bc(), l("GB (base)", 16, "bitumineux", "GB"), l("G (fondation)", 20, "sol", "G"), l("G (sous-couche)", 20, "sol", "G")], G40 + " Variante bicouche."),
  f(F6, "p-062", "S3", "T2", [bb(5), l("GB (base)", 12, "bitumineux", "GB"), l("G (fondation)", 25, "sol", "G")], G40),
  f(F6, "p-062", "S3", "T2", [bc(), l("GB (base)", 14, "bitumineux", "GB"), l("G (fondation)", 15, "sol", "G"), l("G (sous-couche)", 20, "sol", "G")], G40 + " Variante bicouche."),
  f(F6, "p-062", "S4", "T2", [bb(5), l("GB (base)", 12, "bitumineux", "GB"), l("G (fondation)", 20, "sol", "G")], G40),
  f(F6, "p-062", "S4", "T2", [bc(), l("GB (base)", 12, "bitumineux", "GB"), l("G (fondation)", 30, "sol", "G")], G40 + " Variante bicouche."),
  f(F6, "p-062", "S1", "T3", [bc(), l("GB (base)", 14, "bitumineux", "GB"), l("G (fondation)", 20, "sol", "G"), l("G (sous-couche)", 20, "sol", "G")], G40),
  f(F6, "p-062", "S2", "T3", [bc(), l("GB (base)", 14, "bitumineux", "GB"), l("G (fondation)", 15, "sol", "G"), l("G (sous-couche)", 20, "sol", "G")], G40),
  f(F6, "p-062", "S3", "T3", [bc(), l("GB (base)", 12, "bitumineux", "GB"), l("G (fondation)", 30, "sol", "G")], G40),
  f(F6, "p-062", "S4", "T3", [bc(), l("GB (base)", 10, "bitumineux", "GB"), l("G (fondation)", 25, "sol", "G")], G40),

  // ---- Fiche 7 (p-061) GB/T région C — S1 vide ; T3-T5 renvoyés ----
  f(F7, "p-061", "S2", "T1", [bb(5), l("GB (base)", 16, "bitumineux", "GB"), l("Tuf (fondation)", 30, "sol", "T")], "Région C uniquement."),
  f(F7, "p-061", "S3", "T1", [bb(5), l("GB (base)", 14, "bitumineux", "GB"), l("Tuf (fondation)", 25, "sol", "T")], "Région C uniquement."),
  f(F7, "p-061", "S4", "T1", [bb(5), l("GB (base)", 14, "bitumineux", "GB"), l("Tuf (fondation)", 20, "sol", "T")], "Région C uniquement."),
  f(F7, "p-061", "S2", "T2", [bb(5), l("GB (base)", 14, "bitumineux", "GB"), l("Tuf (fondation)", 25, "sol", "T")], "Région C uniquement."),
  f(F7, "p-061", "S2", "T2", [bc(), l("GB (base)", 16, "bitumineux", "GB"), l("Tuf (fondation)", 30, "sol", "T")], "Région C. Variante bicouche."),
  f(F7, "p-061", "S3", "T2", [bb(5), l("GB (base)", 12, "bitumineux", "GB"), l("Tuf (fondation)", 25, "sol", "T")], "Région C uniquement."),
  f(F7, "p-061", "S3", "T2", [bc(), l("GB (base)", 14, "bitumineux", "GB"), l("Tuf (fondation)", 30, "sol", "T")], "Région C. Variante bicouche."),
  f(F7, "p-061", "S4", "T2", [bb(5), l("GB (base)", 12, "bitumineux", "GB"), l("Tuf (fondation)", 20, "sol", "T")], "Région C uniquement."),
  f(F7, "p-061", "S4", "T2", [bc(), l("GB (base)", 12, "bitumineux", "GB"), l("Tuf (fondation)", 30, "sol", "T")], "Région C. Variante bicouche."),

  // ---- Fiche 8 (p-060) GC/G — T3 → fiches 9-10 ; T4-T5 → 1-5 ----
  f(F8, "p-060", "S1", "T1", [bb(6), l("GC (base)", 20, "hydraulique", "GC"), l("G (fondation)", 35, "sol", "G")], "Enrobé majoré pour retarder la remontée de fissures."),
  f(F8, "p-060", "S2", "T1", [bb(6), l("GC (base)", 20, "hydraulique", "GC"), l("G (fondation)", 30, "sol", "G")], "Enrobé majoré pour retarder la remontée de fissures."),
  f(F8, "p-060", "S3", "T1", [bb(6), l("GC (base)", 20, "hydraulique", "GC"), l("G (fondation)", 20, "sol", "G")], "Enrobé majoré pour retarder la remontée de fissures."),
  f(F8, "p-060", "S4", "T1", [bb(6), l("GC (base)", 20, "hydraulique", "GC"), l("G (fondation)", 15, "sol", "G")], "Enrobé majoré pour retarder la remontée de fissures."),
  f(F8, "p-060", "S1", "T2", [bb(6), l("GC (base)", 20, "hydraulique", "GC"), l("G (fondation)", 25, "sol", "G")]),
  f(F8, "p-060", "S1", "T2", [bc(), l("GC (base)", 22, "hydraulique", "GC"), l("G (fondation)", 20, "sol", "G"), l("G (sous-couche)", 20, "sol", "G")], "Variante bicouche."),
  f(F8, "p-060", "S2", "T2", [bb(6), l("GC (base)", 20, "hydraulique", "GC"), l("G (fondation)", 20, "sol", "G")]),
  f(F8, "p-060", "S2", "T2", [bc(), l("GC (base)", 22, "hydraulique", "GC"), l("G (fondation)", 15, "sol", "G"), l("G (sous-couche)", 20, "sol", "G")], "Variante bicouche."),
  f(F8, "p-060", "S3", "T2", [bb(6), l("GC (base)", 20, "hydraulique", "GC"), l("G (fondation)", 15, "sol", "G")]),
  f(F8, "p-060", "S3", "T2", [bc(), l("GC (base)", 22, "hydraulique", "GC"), l("G (fondation)", 30, "sol", "G")], "Variante bicouche."),
  f(F8, "p-060", "S4", "T2", [bb(6), l("GC (base)", 20, "hydraulique", "GC"), l("G (fondation)", 15, "sol", "G")]),
  f(F8, "p-060", "S4", "T2", [bc(), l("GC (base)", 20, "hydraulique", "GC"), l("G (fondation)", 20, "sol", "G")], "Variante bicouche."),

  // ---- Fiche 9 (p-059) GL/G — T4-T5 renvoyés ----
  f(F9, "p-059", "S1", "T1", [bb(5), l("GLY (base)", 22, "hydraulique", "GLY"), l("G (fondation)", 35, "sol", "G")], GLX),
  f(F9, "p-059", "S2", "T1", [bb(5), l("GLY (base)", 22, "hydraulique", "GLY"), l("G (fondation)", 30, "sol", "G")], GLX),
  f(F9, "p-059", "S3", "T1", [bb(5), l("GLY (base)", 18, "hydraulique", "GLY"), l("G (fondation)", 30, "sol", "G")], GLX),
  f(F9, "p-059", "S4", "T1", [bb(5), l("GLY (base)", 18, "hydraulique", "GLY"), l("G (fondation)", 25, "sol", "G")], GLX),
  f(F9, "p-059", "S1", "T2", [bb(5), l("GLY (base)", 20, "hydraulique", "GLY"), l("G (fondation)", 35, "sol", "G")], GLX),
  f(F9, "p-059", "S1", "T2", [bc(), l("GLY (base)", 22, "hydraulique", "GLY"), l("G (fondation)", 20, "sol", "G")], GLX + " Variante bicouche."),
  f(F9, "p-059", "S2", "T2", [bb(5), l("GLY (base)", 20, "hydraulique", "GLY"), l("G (fondation)", 30, "sol", "G")], GLX),
  f(F9, "p-059", "S2", "T2", [bc(), l("GLY (base)", 20, "hydraulique", "GLY"), l("G (fondation)", 35, "sol", "G")], GLX + " Variante bicouche."),
  f(F9, "p-059", "S3", "T2", [bb(5), l("GLY (base)", 18, "hydraulique", "GLY"), l("G (fondation)", 20, "sol", "G")], GLX),
  f(F9, "p-059", "S3", "T2", [bc(), l("GLY (base)", 18, "hydraulique", "GLY"), l("G (fondation)", 35, "sol", "G")], GLX + " Variante bicouche."),
  f(F9, "p-059", "S4", "T2", [bb(5), l("GLY (base)", 15, "hydraulique", "GLY"), l("G (fondation)", 15, "sol", "G")], GLX),
  f(F9, "p-059", "S4", "T2", [bc(), l("GLY (base)", 15, "hydraulique", "GLY"), l("G (fondation)", 30, "sol", "G")], GLX + " Variante bicouche."),
  f(F9, "p-059", "S1", "T3", [bc(), l("GLY (base)", 18, "hydraulique", "GLY"), l("G (fondation)", 20, "sol", "G")], GLX),
  f(F9, "p-059", "S2", "T3", [bc(), l("GLY (base)", 18, "hydraulique", "GLY"), l("G (fondation)", 30, "sol", "G")], GLX),
  f(F9, "p-059", "S3", "T3", [bc(), l("GLY (base)", 15, "hydraulique", "GLY"), l("G (fondation)", 30, "sol", "G")], GLX),
  f(F9, "p-059", "S4", "T3", [bc(), l("GLY (base)", 15, "hydraulique", "GLY"), l("G (fondation)", 20, "sol", "G")], GLX),

  // ---- Fiche 10 (p-058) SL/G — T4-T5 renvoyés ----
  f(F10, "p-058", "S1", "T1", [bb(5), l("SCLY (base)", 22, "hydraulique", "SCLY"), l("G (fondation)", 15, "sol", "G"), l("G (sous-couche)", 20, "sol", "G")], SCLX),
  f(F10, "p-058", "S2", "T1", [bb(5), l("SCLY (base)", 22, "hydraulique", "SCLY"), l("G (fondation)", 30, "sol", "G")], SCLX),
  f(F10, "p-058", "S3", "T1", [bb(5), l("SCLY (base)", 18, "hydraulique", "SCLY"), l("G (fondation)", 30, "sol", "G")], SCLX),
  f(F10, "p-058", "S4", "T1", [bb(5), l("SCLY (base)", 18, "hydraulique", "SCLY"), l("G (fondation)", 25, "sol", "G")], SCLX),
  f(F10, "p-058", "S1", "T2", [bb(5), l("SCLY (base)", 20, "hydraulique", "SCLY"), l("G (fondation)", 35, "sol", "G")], SCLX),
  f(F10, "p-058", "S1", "T2", [bc(), l("SCLY (base)", 35, "hydraulique", "SCLY"), l("G (fondation)", 20, "sol", "G"), l("G (sous-couche)", 20, "sol", "G")], SCLX + " Variante bicouche."),
  f(F10, "p-058", "S2", "T2", [bb(5), l("SCLY (base)", 20, "hydraulique", "SCLY"), l("G (fondation)", 30, "sol", "G")], SCLX),
  f(F10, "p-058", "S2", "T2", [bc(), l("SCLY (base)", 20, "hydraulique", "SCLY"), l("G (fondation)", 20, "sol", "G"), l("G (sous-couche)", 20, "sol", "G")], SCLX + " Variante bicouche."),
  f(F10, "p-058", "S3", "T2", [bb(5), l("SCLY (base)", 18, "hydraulique", "SCLY"), l("G (fondation)", 20, "sol", "G")], SCLX),
  f(F10, "p-058", "S3", "T2", [bc(), l("SCLY (base)", 18, "hydraulique", "SCLY"), l("G (fondation)", 15, "sol", "G"), l("G (sous-couche)", 20, "sol", "G")], SCLX + " Variante bicouche."),
  f(F10, "p-058", "S4", "T2", [bb(5), l("SCLY (base)", 15, "hydraulique", "SCLY"), l("G (fondation)", 15, "sol", "G")], SCLX),
  f(F10, "p-058", "S4", "T2", [bc(), l("SCLY (base)", 15, "hydraulique", "SCLY"), l("G (fondation)", 30, "sol", "G")], SCLX + " Variante bicouche."),
  f(F10, "p-058", "S1", "T3", [bc(), l("SCLY (base)", 22, "hydraulique", "SCLY"), l("G (fondation)", 20, "sol", "G"), l("G (sous-couche)", 20, "sol", "G")], SCLX),
  f(F10, "p-058", "S2", "T3", [bc(), l("SCLY (base)", 18, "hydraulique", "SCLY"), l("G (fondation)", 15, "sol", "G"), l("G (sous-couche)", 20, "sol", "G")], SCLX),
  f(F10, "p-058", "S3", "T3", [bc(), l("SCLY (base)", 15, "hydraulique", "SCLY"), l("G (fondation)", 30, "sol", "G")], SCLX),
  f(F10, "p-058", "S4", "T3", [bc(), l("SCLY (base)", 15, "hydraulique", "SCLY"), l("G (fondation)", 20, "sol", "G")], SCLX),
];

export const CATALOGUE_TUNISIE_1984 = catalogueStructures({
  pays: "tunisie1984",
  reference: "Catalogue Tunisie 1984 — chaussées neuves (10 fiches, T×S)",
  fiches: FICHES_TUNISIE_1984,
  cle: "classe-trafic",
});
