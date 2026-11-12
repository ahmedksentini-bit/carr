// Catalogue de structures types LBTP Côte d'Ivoire 1977 (16 fiches), portage
// de CoteDIvoireStructures. Chaque fiche est indexée par classe de sol (S1..S5,
// portance CBR) et classe de trafic (T1..T5) ; la cellule donne les épaisseurs
// (cm) revêtement / base / fondation. Méthode DÉTERMINISTE (Peltier + abaques
// CBR), d'où `provisoire: true` sur toutes les structures. Transcription
// cellule par cellule des pages p-062..p-119 ; le couple base/fondation de
// chaque fiche vient du tableau IV (p-018). Les régions R1..R7 concernées par
// chaque fiche sont indiquées en commentaire.
//
// NB : la source annonce la fiche 2 « gC base » (graveleux-ciment) mais ses
// cellules emploient la grave-ciment (Gc) ; le portage reste fidèle à la source.

import { catalogueStructures } from "./base.js";
import { coucheFiche } from "./commun.js";

const SRC = "Catalogue LBTP CI 1977";

const mtl = (nat, famille, cle) => ({ nat, famille, cle });
const Gn = mtl("Graveleux naturel latéritique", "sol", "gn");
const Tvc = mtl("Tout-venant concassé", "sol", "TVC");
const Gc = mtl("Grave-ciment", "hydraulique", "GC");
const GcN = mtl("Graveleux-ciment", "hydraulique", "gC");
const Gb = mtl("Grave-bitume", "bitumineux", "GB");
const Sa = mtl("Sable argileux", "sol", "sa");
const Sb = mtl("Sable-bitume", "bitumineux", "sB");
const Sc = mtl("Sable argileux-ciment", "hydraulique", "sC");

/**
 * famille = libellé de fiche (préfixe « Fiche N — » utilisé pour la recherche) ;
 * rev = épaisseur du revêtement (enrobé/BB) ; base / fond = matériaux ;
 * fcm = 0 : pas de fondation.
 */
function F(famille, page, sol, trafic, rev, bas, bcm, fond, fcm) {
  const couches = [
    coucheFiche("Revêtement (enrobé/BB)", rev, "bitumineux", "revetement", "collee"),
    coucheFiche(`${bas.nat} (base)`, bcm, bas.famille, bas.cle),
  ];
  if (fcm > 0) couches.push(coucheFiche(`${fond.nat} (fondation)`, fcm, fond.famille, fond.cle));
  return { classeTrafic: trafic, classePortance: sol, famille, couches,
    source: `${SRC}, ${page}`, provisoire: true, note: null, intervention: "neuve" };
}

const F1 = "Fiche 1 — gn/gn (base graveleux naturel / fond. graveleux naturel)";
const F2 = "Fiche 2 — gC/gn (base graveleux-ciment / fond. graveleux naturel)";
const F3 = "Fiche 3 — TVC/gn (base tout-venant concassé / fond. graveleux naturel)";
const F4 = "Fiche 4 — GC/gn (base grave-ciment / fond. graveleux naturel)";
const F5 = "Fiche 5 — GB/gn (base grave-bitume / fond. graveleux naturel)";
const F6 = "Fiche 6 — TVC/TVC (base tout-venant / fond. tout-venant concassé)";
const F7 = "Fiche 7 — GC/TVC (base grave-ciment / fond. tout-venant concassé)";
const F8 = "Fiche 8 — GB/TVC (base grave-bitume / fond. tout-venant concassé)";
const F9 = "Fiche 9 — sC/sa (base sable argileux-ciment / fond. sable argileux)";
const F10 = "Fiche 10 — sB/sa (base sable-bitume / fond. sable argileux)";
const F11 = "Fiche 11 — sC/sC (base sable-ciment / fond. sable-ciment)";
const F12 = "Fiche 12 — GC/sC (base grave-ciment / fond. sable argileux-ciment)";
const F13 = "Fiche 13 — GB/sC (base grave-bitume / fond. sable argileux-ciment)";
const F14 = "Fiche 14 — GB/sB (base grave-bitume / fond. sable-bitume)";
const F15 = "Fiche 15 — GC/gC (base grave-ciment / fond. graveleux-ciment)";
const F16 = "Fiche 16 — GB/gC (base grave-bitume / fond. graveleux-ciment)";

export const FICHES = [
  // ---- Fiche 1 (p-062) gn/gn — R4,R5,R6,R7 -----------------------------------------
  F(F1, "p-062", "S1", "T1", 3, Gn, 15, Gn, 40), F(F1, "p-062", "S1", "T2", 4, Gn, 15, Gn, 45), F(F1, "p-062", "S1", "T3", 5, Gn, 20, Gn, 45),
  F(F1, "p-062", "S2", "T1", 3, Gn, 15, Gn, 20), F(F1, "p-062", "S2", "T2", 4, Gn, 15, Gn, 25), F(F1, "p-062", "S2", "T3", 5, Gn, 20, Gn, 25),
  F(F1, "p-062", "S3", "T1", 3, Gn, 15, Gn, 15), F(F1, "p-062", "S3", "T2", 4, Gn, 15, Gn, 20), F(F1, "p-062", "S3", "T3", 5, Gn, 20, Gn, 20),
  F(F1, "p-062", "S4", "T1", 3, Gn, 15, Gn, 10), F(F1, "p-062", "S4", "T2", 4, Gn, 15, Gn, 15), F(F1, "p-062", "S4", "T3", 5, Gn, 20, Gn, 15),
  F(F1, "p-062", "S5", "T1", 3, Gn, 15, Gn, 0),  F(F1, "p-062", "S5", "T2", 4, Gn, 15, Gn, 0),  F(F1, "p-062", "S5", "T3", 5, Gn, 20, Gn, 0),

  // ---- Fiche 2 (p-066) gC base / gn fond — R2..R7 ----------------------------------
  F(F2, "p-066", "S1", "T1", 3, Gc, 15, Gn, 40), F(F2, "p-066", "S1", "T2", 4, Gc, 15, Gn, 45), F(F2, "p-066", "S1", "T3", 5, Gc, 20, Gn, 45), F(F2, "p-066", "S1", "T4", 7, Gc, 20, Gn, 50),
  F(F2, "p-066", "S2", "T1", 3, Gc, 15, Gn, 20), F(F2, "p-066", "S2", "T2", 4, Gc, 15, Gn, 25), F(F2, "p-066", "S2", "T3", 5, Gc, 20, Gn, 25), F(F2, "p-066", "S2", "T4", 7, Gc, 20, Gn, 30),
  F(F2, "p-066", "S3", "T1", 3, Gc, 15, Gn, 15), F(F2, "p-066", "S3", "T2", 4, Gc, 15, Gn, 20), F(F2, "p-066", "S3", "T3", 5, Gc, 20, Gn, 20), F(F2, "p-066", "S3", "T4", 7, Gc, 20, Gn, 25),
  F(F2, "p-066", "S4", "T1", 3, Gc, 15, Gn, 10), F(F2, "p-066", "S4", "T2", 4, Gc, 15, Gn, 15), F(F2, "p-066", "S4", "T3", 5, Gc, 20, Gn, 15), F(F2, "p-066", "S4", "T4", 7, Gc, 20, Gn, 20),
  F(F2, "p-066", "S5", "T1", 3, Gc, 15, Gn, 0),  F(F2, "p-066", "S5", "T2", 4, Gc, 15, Gn, 0),  F(F2, "p-066", "S5", "T3", 5, Gc, 20, Gn, 0),  F(F2, "p-066", "S5", "T4", 7, Gc, 20, Gn, 0),

  // ---- Fiche 3 (p-070) TVC base / gn fond — R3..R7 ---------------------------------
  F(F3, "p-070", "S1", "T1", 3, Tvc, 15, Gn, 40), F(F3, "p-070", "S1", "T2", 4, Tvc, 15, Gn, 45), F(F3, "p-070", "S1", "T3", 5, Tvc, 20, Gn, 45), F(F3, "p-070", "S1", "T4", 7, Tvc, 20, Gn, 50),
  F(F3, "p-070", "S2", "T1", 3, Tvc, 15, Gn, 20), F(F3, "p-070", "S2", "T2", 4, Tvc, 15, Gn, 25), F(F3, "p-070", "S2", "T3", 5, Tvc, 20, Gn, 25), F(F3, "p-070", "S2", "T4", 7, Tvc, 20, Gn, 30),
  F(F3, "p-070", "S3", "T1", 3, Tvc, 15, Gn, 15), F(F3, "p-070", "S3", "T2", 4, Tvc, 15, Gn, 20), F(F3, "p-070", "S3", "T3", 5, Tvc, 20, Gn, 20), F(F3, "p-070", "S3", "T4", 7, Tvc, 20, Gn, 25),
  F(F3, "p-070", "S4", "T1", 3, Tvc, 15, Gn, 10), F(F3, "p-070", "S4", "T2", 4, Tvc, 15, Gn, 15), F(F3, "p-070", "S4", "T3", 5, Tvc, 20, Gn, 15), F(F3, "p-070", "S4", "T4", 7, Tvc, 20, Gn, 20),
  F(F3, "p-070", "S5", "T1", 3, Tvc, 15, Gn, 0),  F(F3, "p-070", "S5", "T2", 4, Tvc, 15, Gn, 0),  F(F3, "p-070", "S5", "T3", 5, Tvc, 20, Gn, 0),  F(F3, "p-070", "S5", "T4", 7, Tvc, 20, Gn, 0),

  // ---- Fiche 4 (p-074) GC base / gn fond — R2..R7 ----------------------------------
  F(F4, "p-074", "S1", "T3", 5, Gc, 15, Gn, 45), F(F4, "p-074", "S1", "T4", 7, Gc, 15, Gn, 50), F(F4, "p-074", "S1", "T5", 10, Gc, 20, Gn, 50),
  F(F4, "p-074", "S2", "T3", 5, Gc, 15, Gn, 25), F(F4, "p-074", "S2", "T4", 7, Gc, 15, Gn, 30), F(F4, "p-074", "S2", "T5", 10, Gc, 20, Gn, 30),
  F(F4, "p-074", "S3", "T3", 5, Gc, 15, Gn, 20), F(F4, "p-074", "S3", "T4", 7, Gc, 15, Gn, 25), F(F4, "p-074", "S3", "T5", 10, Gc, 20, Gn, 25),
  F(F4, "p-074", "S4", "T3", 5, Gc, 15, Gn, 15), F(F4, "p-074", "S4", "T4", 7, Gc, 15, Gn, 20), F(F4, "p-074", "S4", "T5", 10, Gc, 20, Gn, 20),
  F(F4, "p-074", "S5", "T3", 5, Gc, 15, Gn, 0),  F(F4, "p-074", "S5", "T4", 7, Gc, 15, Gn, 0),  F(F4, "p-074", "S5", "T5", 10, Gc, 20, Gn, 0),

  // ---- Fiche 5 (p-077) GB base / gn fond — R2..R7 (fond. S5 illisible) -------------
  F(F5, "p-077", "S1", "T3", 4, Gb, 12, Gn, 45), F(F5, "p-077", "S1", "T4", 5, Gb, 12, Gn, 50), F(F5, "p-077", "S1", "T5", 7, Gb, 17, Gn, 50),
  F(F5, "p-077", "S2", "T3", 4, Gb, 12, Gn, 25), F(F5, "p-077", "S2", "T4", 5, Gb, 12, Gn, 30), F(F5, "p-077", "S2", "T5", 7, Gb, 17, Gn, 30),
  F(F5, "p-077", "S3", "T3", 4, Gb, 12, Gn, 20), F(F5, "p-077", "S3", "T4", 5, Gb, 12, Gn, 25), F(F5, "p-077", "S3", "T5", 7, Gb, 17, Gn, 25),
  F(F5, "p-077", "S4", "T3", 4, Gb, 12, Gn, 15), F(F5, "p-077", "S4", "T4", 5, Gb, 12, Gn, 20), F(F5, "p-077", "S4", "T5", 7, Gb, 17, Gn, 20),
  F(F5, "p-077", "S5", "T3", 4, Gb, 12, Gn, 0),  F(F5, "p-077", "S5", "T4", 5, Gb, 12, Gn, 0),  F(F5, "p-077", "S5", "T5", 7, Gb, 17, Gn, 0),

  // ---- Fiche 6 (p-081) TVC/TVC — R4,R5,R6 (pas de S5) ------------------------------
  F(F6, "p-081", "S1", "T1", 3, Tvc, 15, Tvc, 40), F(F6, "p-081", "S1", "T2", 4, Tvc, 15, Tvc, 45), F(F6, "p-081", "S1", "T3", 5, Tvc, 20, Tvc, 45), F(F6, "p-081", "S1", "T4", 7, Tvc, 20, Tvc, 50),
  F(F6, "p-081", "S2", "T1", 3, Tvc, 15, Tvc, 20), F(F6, "p-081", "S2", "T2", 4, Tvc, 15, Tvc, 25), F(F6, "p-081", "S2", "T3", 5, Tvc, 20, Tvc, 25), F(F6, "p-081", "S2", "T4", 7, Tvc, 20, Tvc, 30),
  F(F6, "p-081", "S3", "T1", 3, Tvc, 15, Tvc, 15), F(F6, "p-081", "S3", "T2", 4, Tvc, 15, Tvc, 20), F(F6, "p-081", "S3", "T3", 5, Tvc, 20, Tvc, 20), F(F6, "p-081", "S3", "T4", 7, Tvc, 20, Tvc, 25),
  F(F6, "p-081", "S4", "T1", 3, Tvc, 15, Tvc, 12), F(F6, "p-081", "S4", "T2", 4, Tvc, 15, Tvc, 15), F(F6, "p-081", "S4", "T3", 5, Tvc, 20, Tvc, 15), F(F6, "p-081", "S4", "T4", 7, Tvc, 20, Tvc, 20),

  // ---- Fiche 7 (p-085) GC base / TVC fond — R4,R5,R6 -------------------------------
  F(F7, "p-085", "S1", "T3", 5, Gc, 15, Tvc, 45), F(F7, "p-085", "S1", "T4", 7, Gc, 15, Tvc, 50), F(F7, "p-085", "S1", "T5", 10, Gc, 20, Tvc, 50),
  F(F7, "p-085", "S2", "T3", 5, Gc, 15, Tvc, 25), F(F7, "p-085", "S2", "T4", 7, Gc, 15, Tvc, 30), F(F7, "p-085", "S2", "T5", 10, Gc, 20, Tvc, 30),
  F(F7, "p-085", "S3", "T3", 5, Gc, 15, Tvc, 20), F(F7, "p-085", "S3", "T4", 7, Gc, 15, Tvc, 25), F(F7, "p-085", "S3", "T5", 10, Gc, 20, Tvc, 25),
  F(F7, "p-085", "S4", "T3", 5, Gc, 15, Tvc, 15), F(F7, "p-085", "S4", "T4", 7, Gc, 15, Tvc, 20), F(F7, "p-085", "S4", "T5", 10, Gc, 20, Tvc, 20),

  // ---- Fiche 8 (p-089) GB base / TVC fond — R4,R5,R6 -------------------------------
  F(F8, "p-089", "S1", "T3", 4, Gb, 12, Tvc, 45), F(F8, "p-089", "S1", "T4", 5, Gb, 12, Tvc, 50), F(F8, "p-089", "S1", "T5", 7, Gb, 17, Tvc, 50),
  F(F8, "p-089", "S2", "T3", 4, Gb, 12, Tvc, 25), F(F8, "p-089", "S2", "T4", 5, Gb, 12, Tvc, 30), F(F8, "p-089", "S2", "T5", 7, Gb, 17, Tvc, 30),
  F(F8, "p-089", "S3", "T3", 4, Gb, 12, Tvc, 20), F(F8, "p-089", "S3", "T4", 5, Gb, 12, Tvc, 25), F(F8, "p-089", "S3", "T5", 7, Gb, 17, Tvc, 25),
  F(F8, "p-089", "S4", "T3", 4, Gb, 12, Tvc, 15), F(F8, "p-089", "S4", "T4", 5, Gb, 12, Tvc, 20), F(F8, "p-089", "S4", "T5", 7, Gb, 17, Tvc, 20),

  // ---- Fiche 9 (p-092) sC base / sa fond — R1,R4,R5,R6 -----------------------------
  F(F9, "p-092", "S1", "T1", 3, Sc, 15, Sa, 40), F(F9, "p-092", "S1", "T2", 4, Sc, 17, Sa, 45), F(F9, "p-092", "S1", "T3", 5, Sc, 20, Sa, 45),
  F(F9, "p-092", "S2", "T1", 3, Sc, 15, Sa, 20), F(F9, "p-092", "S2", "T2", 4, Sc, 17, Sa, 25), F(F9, "p-092", "S2", "T3", 5, Sc, 20, Sa, 25),
  F(F9, "p-092", "S3", "T1", 3, Sc, 15, Sa, 15), F(F9, "p-092", "S3", "T2", 4, Sc, 17, Sa, 20), F(F9, "p-092", "S3", "T3", 5, Sc, 20, Sa, 20),
  F(F9, "p-092", "S4", "T1", 3, Sc, 15, Sa, 10), F(F9, "p-092", "S4", "T2", 4, Sc, 17, Sa, 15), F(F9, "p-092", "S4", "T3", 5, Sc, 20, Sa, 15),
  F(F9, "p-092", "S5", "T1", 3, Sc, 15, Sa, 0),  F(F9, "p-092", "S5", "T2", 4, Sc, 17, Sa, 0),  F(F9, "p-092", "S5", "T3", 5, Sc, 20, Sa, 0),

  // ---- Fiche 10 (p-095) sB base / sa fond — R1,R4,R5 -------------------------------
  F(F10, "p-095", "S1", "T1", 3, Sb, 10, Sa, 40), F(F10, "p-095", "S1", "T2", 4, Sb, 12, Sa, 45), F(F10, "p-095", "S1", "T3", 5, Sb, 15, Sa, 45),
  F(F10, "p-095", "S2", "T1", 3, Sb, 10, Sa, 20), F(F10, "p-095", "S2", "T2", 4, Sb, 12, Sa, 25), F(F10, "p-095", "S2", "T3", 5, Sb, 15, Sa, 25),
  F(F10, "p-095", "S3", "T1", 3, Sb, 10, Sa, 15), F(F10, "p-095", "S3", "T2", 4, Sb, 12, Sa, 20), F(F10, "p-095", "S3", "T3", 5, Sb, 15, Sa, 20),
  F(F10, "p-095", "S4", "T1", 3, Sb, 10, Sa, 10), F(F10, "p-095", "S4", "T2", 4, Sb, 12, Sa, 15), F(F10, "p-095", "S4", "T3", 5, Sb, 15, Sa, 15),
  F(F10, "p-095", "S5", "T1", 3, Sb, 10, Sa, 0),  F(F10, "p-095", "S5", "T2", 4, Sb, 12, Sa, 0),  F(F10, "p-095", "S5", "T3", 5, Sb, 15, Sa, 0),

  // ---- Fiche 11 (p-099) sC/sC — R1,R4,R5,R6 (S1-S4) --------------------------------
  F(F11, "p-099", "S1", "T1", 3, Sc, 15, Sc, 35), F(F11, "p-099", "S1", "T2", 4, Sc, 15, Sc, 40), F(F11, "p-099", "S1", "T3", 5, Sc, 20, Sc, 40),
  F(F11, "p-099", "S2", "T1", 3, Sc, 15, Sc, 15), F(F11, "p-099", "S2", "T2", 4, Sc, 15, Sc, 20), F(F11, "p-099", "S2", "T3", 5, Sc, 20, Sc, 20),
  F(F11, "p-099", "S3", "T1", 3, Sc, 15, Sc, 10), F(F11, "p-099", "S3", "T2", 4, Sc, 15, Sc, 15), F(F11, "p-099", "S3", "T3", 5, Sc, 20, Sc, 15),
  F(F11, "p-099", "S4", "T1", 3, Sc, 15, Sc, 10), F(F11, "p-099", "S4", "T2", 4, Sc, 15, Sc, 10), F(F11, "p-099", "S4", "T3", 5, Sc, 20, Sc, 10),

  // ---- Fiche 12 (p-103) GC base / sC fond ------------------------------------------
  F(F12, "p-103", "S1", "T3", 5, Gc, 15, Sc, 40), F(F12, "p-103", "S1", "T4", 7, Gc, 15, Sc, 45), F(F12, "p-103", "S1", "T5", 10, Gc, 20, Sc, 45),
  F(F12, "p-103", "S2", "T3", 5, Gc, 15, Sc, 20), F(F12, "p-103", "S2", "T4", 7, Gc, 15, Sc, 25), F(F12, "p-103", "S2", "T5", 10, Gc, 20, Sc, 25),
  F(F12, "p-103", "S3", "T3", 5, Gc, 15, Sc, 15), F(F12, "p-103", "S3", "T4", 7, Gc, 15, Sc, 20), F(F12, "p-103", "S3", "T5", 10, Gc, 20, Sc, 20),
  F(F12, "p-103", "S4", "T3", 5, Gc, 15, Sc, 10), F(F12, "p-103", "S4", "T4", 7, Gc, 15, Sc, 15), F(F12, "p-103", "S4", "T5", 10, Gc, 20, Sc, 15),

  // ---- Fiche 13 (p-107) GB base / sC fond — R1 ------------------------------------
  F(F13, "p-107", "S1", "T3", 4, Gb, 12, Sc, 40), F(F13, "p-107", "S1", "T4", 5, Gb, 12, Sc, 45), F(F13, "p-107", "S1", "T5", 7, Gb, 17, Sc, 45),
  F(F13, "p-107", "S2", "T3", 4, Gb, 12, Sc, 20), F(F13, "p-107", "S2", "T4", 5, Gb, 12, Sc, 25), F(F13, "p-107", "S2", "T5", 7, Gb, 17, Sc, 25),
  F(F13, "p-107", "S3", "T3", 4, Gb, 12, Sc, 15), F(F13, "p-107", "S3", "T4", 5, Gb, 12, Sc, 20), F(F13, "p-107", "S3", "T5", 7, Gb, 17, Sc, 20),
  F(F13, "p-107", "S4", "T3", 4, Gb, 12, Sc, 10), F(F13, "p-107", "S4", "T4", 5, Gb, 12, Sc, 15), F(F13, "p-107", "S4", "T5", 7, Gb, 17, Sc, 15),

  // ---- Fiche 14 (p-111) GB base / sB fond — R1 ------------------------------------
  F(F14, "p-111", "S1", "T3", 4, Gb, 12, Sb, 40), F(F14, "p-111", "S1", "T4", 5, Gb, 12, Sb, 45), F(F14, "p-111", "S1", "T5", 7, Gb, 17, Sb, 45),
  F(F14, "p-111", "S2", "T3", 4, Gb, 12, Sb, 20), F(F14, "p-111", "S2", "T4", 5, Gb, 12, Sb, 25), F(F14, "p-111", "S2", "T5", 7, Gb, 17, Sb, 25),
  F(F14, "p-111", "S3", "T3", 4, Gb, 12, Sb, 15), F(F14, "p-111", "S3", "T4", 5, Gb, 12, Sb, 20), F(F14, "p-111", "S3", "T5", 7, Gb, 17, Sb, 20),
  F(F14, "p-111", "S4", "T3", 4, Gb, 12, Sb, 10), F(F14, "p-111", "S4", "T4", 5, Gb, 12, Sb, 15), F(F14, "p-111", "S4", "T5", 7, Gb, 17, Sb, 15),

  // ---- Fiche 15 (p-115) GC base / gC fond — R2,R3,R4 -------------------------------
  F(F15, "p-115", "S1", "T3", 5, Gc, 15, GcN, 40), F(F15, "p-115", "S1", "T4", 7, Gc, 15, GcN, 45), F(F15, "p-115", "S1", "T5", 10, Gc, 15, GcN, 45),
  F(F15, "p-115", "S2", "T3", 5, Gc, 15, GcN, 20), F(F15, "p-115", "S2", "T4", 7, Gc, 15, GcN, 25), F(F15, "p-115", "S2", "T5", 10, Gc, 20, GcN, 25),
  F(F15, "p-115", "S3", "T3", 5, Gc, 15, GcN, 15), F(F15, "p-115", "S3", "T4", 7, Gc, 15, GcN, 20), F(F15, "p-115", "S3", "T5", 10, Gc, 20, GcN, 20),
  F(F15, "p-115", "S4", "T3", 5, Gc, 15, GcN, 10), F(F15, "p-115", "S4", "T4", 7, Gc, 15, GcN, 15), F(F15, "p-115", "S4", "T5", 10, Gc, 20, GcN, 15),

  // ---- Fiche 16 (p-119) GB base / gC fond — R2,R3,R4 (S3/T4 rev=4, cf. incertitude) -
  F(F16, "p-119", "S1", "T3", 4, Gb, 12, GcN, 40), F(F16, "p-119", "S1", "T4", 5, Gb, 12, GcN, 45), F(F16, "p-119", "S1", "T5", 7, Gb, 17, GcN, 45),
  F(F16, "p-119", "S2", "T3", 4, Gb, 12, GcN, 20), F(F16, "p-119", "S2", "T4", 5, Gb, 12, GcN, 25), F(F16, "p-119", "S2", "T5", 7, Gb, 17, GcN, 25),
  F(F16, "p-119", "S3", "T3", 4, Gb, 12, GcN, 15), F(F16, "p-119", "S3", "T4", 4, Gb, 12, GcN, 20), F(F16, "p-119", "S3", "T5", 7, Gb, 17, GcN, 20),
  F(F16, "p-119", "S4", "T3", 4, Gb, 12, GcN, 10), F(F16, "p-119", "S4", "T4", 5, Gb, 12, GcN, 15), F(F16, "p-119", "S4", "T5", 7, Gb, 17, GcN, 15),
];

export const CATALOGUE = catalogueStructures({
  pays: "cotedivoire1977",
  reference: "Catalogue de structures types, LBTP Côte d'Ivoire, 1977 (16 fiches, méthode déterministe)",
  fiches: FICHES,
  cle: "classe-trafic",
});
