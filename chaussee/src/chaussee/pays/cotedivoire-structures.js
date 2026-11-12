// Catalogue LBTP Côte d'Ivoire, avril 2024 : 17 fiches (Fasc. 1), portage de
// CoteDIvoire2024Structures. Index = sous-classe de NE (TC1−..TC6+) × PPF2..PPF5.
// Coupes lues sur les dessins PDF p. 27–91. Les variantes d'une même cellule
// sont deux fiches (même TC/PPF, famille suffixée). F14 GB3/GB3 : grille
// complète (coupes PDF p. 79, confirmée).

import { catalogueStructures } from "./base.js";
import { decouperSpec, coucheFiche } from "./commun.js";

const SRC = "Manuel LBTP CI avril 2024";

// Nature → (famille, clé, interface imposée). Les couches de surface sont collées.
const MAT = {
  ES: ["bitumineux", "ES", "collee"], BBM: ["bitumineux", "BBM", "collee"], BBSG: ["bitumineux", "BBSG", "collee"],
  GB3: ["bitumineux", "GB3", null], GB4: ["bitumineux", "GB4", null], EME2: ["bitumineux", "EME2", null],
  GNT: ["sol", "GNT", null], GLN: ["sol", "GLn", null], SAN: ["sol", "SAn", null],
  GLA1: ["sol", "GLa1", null], GLA2: ["sol", "GLa2", null], SAA1: ["sol", "SAa1", null], SAA2: ["sol", "SAa2", null],
};

const couches = (spec) => decouperSpec(spec).map(({ code, cm }) => {
  const [famille, cle, iface] = MAT[code.toUpperCase()] ?? ["sol", code, null];
  return coucheFiche(code, cm, famille, cle, iface);
});

const T = (famille, page, trafic, pf, spec, note = null) => ({
  classeTrafic: trafic, classePortance: pf, famille, couches: couches(spec),
  source: `${SRC}, ${page}`, provisoire: false, note, intervention: "neuve",
});

const F1 = "F1 — GNT/GNT";
const F2 = "F2 — GNT/GLa1";
const F2b = "F2 — GNT/GLa1 (variante)";
const F3 = "F3 — GNT/SAa1";
const F3b = "F3 — GNT/SAa1 (variante)";
const F4 = "F4 — GLa2/GLn";
const F5 = "F5 — GLa2/GLa1";
const F6 = "F6 — SAa2/SAn";
const F7 = "F7 — SAa2/SAa1";
const F8 = "F8 — GB3/GNT";
const F9 = "F9 — GB3/GLa1";
const F9b = "F9 — GB3/GLa1 (GB seule)";
const F10 = "F10 — GB3/SAa1";
const F10b = "F10 — GB3/SAa1 (GB seule)";
const F11 = "F11 — GB4/GNT";
const F12 = "F12 — GB4/GLa1";
const F13 = "F13 — GB4/SAa1";
const F14 = "F14 — GB3/GB3";
const F15 = "F15 — GB4/GB4";
const F16 = "F16 — EME2/GB3";
const F17 = "F17 — EME2/EME2";

export const FICHES = [
  // ---- F1 GNT/GNT (PDF p. 27) — TC1− : ES ; BBM 3 cm → assise −5 cm (note) ----
  T(F1, "p.27", "TC1-", "PPF2", "ES:1/GNT:20/GNT:25", "TC1− + BBM 3 cm : assise GNT −5 cm."),
  T(F1, "p.27", "TC1-", "PPF3", "ES:1/GNT:32"),
  T(F1, "p.27", "TC1-", "PPF4", "ES:1/GNT:25"),
  T(F1, "p.27", "TC1-", "PPF5", "ES:1/GNT:17"),
  T(F1, "p.27", "TC1+", "PPF2", "BBM:4/GNT:20/GNT:22"),
  T(F1, "p.27", "TC1+", "PPF3", "BBM:4/GNT:32"),
  T(F1, "p.27", "TC1+", "PPF4", "BBM:4/GNT:22"),
  T(F1, "p.27", "TC1+", "PPF5", "BBM:4/GNT:15"),
  T(F1, "p.27", "TC2-", "PPF2", "BBSG:5/GNT:20/GNT:25"),
  T(F1, "p.27", "TC2-", "PPF3", "BBSG:5/GNT:35"),
  T(F1, "p.27", "TC2-", "PPF4", "BBSG:5/GNT:25"),
  T(F1, "p.27", "TC2-", "PPF5", "BBSG:5/GNT:15"),
  T(F1, "p.27", "TC2+", "PPF2", "BBSG:5/GNT:25/GNT:25"),
  T(F1, "p.27", "TC2+", "PPF3", "BBSG:5/GNT:20/GNT:20"),
  T(F1, "p.27", "TC2+", "PPF4", "BBSG:5/GNT:30"),
  T(F1, "p.27", "TC2+", "PPF5", "BBSG:5/GNT:20"),

  // ---- F2 GNT/GLa1 (PDF p. 31) ----
  T(F2, "p.31", "TC1-", "PPF2", "ES:1/GNT:15/GLa1:30"),
  T(F2, "p.31", "TC1-", "PPF3", "ES:1/GNT:12/GLa1:20"),
  T(F2b, "p.31", "TC1-", "PPF3", "ES:1/GLa1:27"),
  T(F2, "p.31", "TC1-", "PPF4", "ES:1/GLa1:25"),
  T(F2b, "p.31", "TC1-", "PPF4", "ES:1/GNT:25"),
  T(F2, "p.31", "TC1-", "PPF5", "ES:1/GLa1:17"),
  T(F2b, "p.31", "TC1-", "PPF5", "ES:1/GNT:17"),
  T(F2, "p.31", "TC1+", "PPF2", "BBM:4/GNT:12/GLa1:30"),
  T(F2, "p.31", "TC1+", "PPF3", "BBM:4/GNT:10/GLa1:32"),
  T(F2b, "p.31", "TC1+", "PPF3", "BBM:4/GNT:32"),
  T(F2, "p.31", "TC1+", "PPF4", "BBM:4/GLa1:22"),
  T(F2b, "p.31", "TC1+", "PPF4", "BBM:4/GNT:22"),
  T(F2, "p.31", "TC1+", "PPF5", "BBM:4/GNT:15"),
  T(F2b, "p.31", "TC1+", "PPF5", "BBM:4/GLa1:15"),
  T(F2, "p.31", "TC2-", "PPF2", "BBSG:5/GNT:15/GLa1:30"),
  T(F2, "p.31", "TC2-", "PPF3", "BBSG:5/GNT:10/GLa1:25"),
  T(F2b, "p.31", "TC2-", "PPF3", "BBSG:5/GLa1:25"),
  T(F2, "p.31", "TC2-", "PPF4", "BBSG:5/GNT:25"),
  T(F2b, "p.31", "TC2-", "PPF4", "BBSG:5/GLa1:25"),
  T(F2, "p.31", "TC2-", "PPF5", "BBSG:5/GNT:15"),
  T(F2b, "p.31", "TC2-", "PPF5", "BBSG:5/GLa1:15"),
  T(F2, "p.31", "TC2+", "PPF2", "BBSG:5/GNT:15/GLa1:30"),
  T(F2, "p.31", "TC2+", "PPF3", "BBSG:5/GNT:15/GLa1:25"),
  T(F2b, "p.31", "TC2+", "PPF3", "BBSG:5/GLa1:25"),
  T(F2, "p.31", "TC2+", "PPF4", "BBSG:5/GNT:30"),
  T(F2b, "p.31", "TC2+", "PPF4", "BBSG:5/GLa1:30"),
  T(F2, "p.31", "TC2+", "PPF5", "BBSG:5/GNT:17"),
  T(F2b, "p.31", "TC2+", "PPF5", "BBSG:5/GLa1:17"),

  // ---- F3 GNT/SAa1 (PDF p. 35) ----
  T(F3, "p.35", "TC1-", "PPF2", "ES:1/GNT:15/SAa1:30"),
  T(F3, "p.35", "TC1-", "PPF3", "ES:1/GNT:12/SAa1:20"),
  T(F3, "p.35", "TC1-", "PPF4", "ES:1/SAa1:25"),
  T(F3b, "p.35", "TC1-", "PPF4", "ES:1/GNT:25"),
  T(F3, "p.35", "TC1-", "PPF5", "ES:1/SAa1:17"),
  T(F3b, "p.35", "TC1-", "PPF5", "ES:1/GNT:17"),
  T(F3, "p.35", "TC1+", "PPF2", "BBM:4/GNT:12/SAa1:30"),
  T(F3, "p.35", "TC1+", "PPF3", "BBM:4/SAa1:32"),
  T(F3b, "p.35", "TC1+", "PPF3", "BBM:4/GNT:32"),
  T(F3, "p.35", "TC1+", "PPF4", "BBM:4/SAa1:22"),
  T(F3b, "p.35", "TC1+", "PPF4", "BBM:4/GNT:22"),
  T(F3, "p.35", "TC1+", "PPF5", "BBM:4/GNT:15"),
  T(F3b, "p.35", "TC1+", "PPF5", "BBM:4/SAa1:15"),
  T(F3, "p.35", "TC2-", "PPF2", "BBSG:5/GNT:15/SAa1:30"),
  T(F3, "p.35", "TC2-", "PPF3", "BBSG:5/GNT:10/SAa1:25"),
  T(F3, "p.35", "TC2-", "PPF4", "BBSG:5/GNT:25"),
  T(F3b, "p.35", "TC2-", "PPF4", "BBSG:5/SAa1:25"),
  T(F3, "p.35", "TC2-", "PPF5", "BBSG:5/GNT:15"),
  T(F3b, "p.35", "TC2-", "PPF5", "BBSG:5/SAa1:15"),
  T(F3, "p.35", "TC2+", "PPF2", "BBSG:5/GNT:15/SAa1:30"),
  T(F3, "p.35", "TC2+", "PPF3", "BBSG:5/GNT:15/SAa1:25"),
  T(F3, "p.35", "TC2+", "PPF4", "BBSG:5/GNT:30"),
  T(F3b, "p.35", "TC2+", "PPF4", "BBSG:5/SAa1:30"),
  T(F3, "p.35", "TC2+", "PPF5", "BBSG:5/GNT:17"),
  T(F3b, "p.35", "TC2+", "PPF5", "BBSG:5/SAa1:17"),

  // ---- F4 GLa2/GLn (PDF p. 39) ----
  T(F4, "p.39", "TC1+", "PPF2", "BBM:4/GLa2:15/GLn:30"),
  T(F4, "p.39", "TC1+", "PPF3", "BBM:4/GLa2:15/GLn:15"),
  T(F4, "p.39", "TC1+", "PPF4", "BBM:4/GLa2:18"),
  T(F4, "p.39", "TC1+", "PPF5", "BBM:4/GLa2:15"),
  T(F4, "p.39", "TC2-", "PPF2", "BBSG:5/GLa2:15/GLn:30"),
  T(F4, "p.39", "TC2-", "PPF3", "BBSG:5/GLa2:15/GLn:20"),
  T(F4, "p.39", "TC2-", "PPF4", "BBSG:5/GLa2:19"),
  T(F4, "p.39", "TC2-", "PPF5", "BBSG:5/GLa2:15"),
  T(F4, "p.39", "TC2+", "PPF2", "BBSG:5/GLa2:20/GLn:30"),
  T(F4, "p.39", "TC2+", "PPF3", "BBSG:5/GLa2:15/GLn:25"),
  T(F4, "p.39", "TC2+", "PPF4", "BBSG:5/GLa2:22"),
  T(F4, "p.39", "TC2+", "PPF5", "BBSG:5/GLa2:20"),
  T(F4, "p.39", "TC3-", "PPF2", "BBSG:5/GLa2:25/GLn:35"),
  T(F4, "p.39", "TC3-", "PPF3", "BBSG:5/GLa2:20/GLn:30"),
  T(F4, "p.39", "TC3-", "PPF4", "BBSG:5/GLa2:28"),
  T(F4, "p.39", "TC3-", "PPF5", "BBSG:5/GLa2:25"),

  // ---- F5 GLa2/GLa1 (PDF p. 43) ----
  T(F5, "p.43", "TC1+", "PPF2", "BBM:4/GLa2:15/GLa1:30"),
  T(F5, "p.43", "TC1+", "PPF3", "BBM:4/GLa2:15/GLa1:15"),
  T(F5, "p.43", "TC1+", "PPF4", "BBM:4/GLa2:18"),
  T(F5, "p.43", "TC1+", "PPF5", "BBM:4/GLa2:15"),
  T(F5, "p.43", "TC2-", "PPF2", "BBSG:5/GLa2:15/GLa1:30"),
  T(F5, "p.43", "TC2-", "PPF3", "BBSG:5/GLa2:15/GLa1:20"),
  T(F5, "p.43", "TC2-", "PPF4", "BBSG:5/GLa2:20"),
  T(F5, "p.43", "TC2-", "PPF5", "BBSG:5/GLa2:15"),
  T(F5, "p.43", "TC2+", "PPF2", "BBSG:5/GLa2:20/GLa1:30"),
  T(F5, "p.43", "TC2+", "PPF3", "BBSG:5/GLa2:15/GLa1:20"),
  T(F5, "p.43", "TC2+", "PPF4", "BBSG:5/GLa2:22"),
  T(F5, "p.43", "TC2+", "PPF5", "BBSG:5/GLa2:20"),
  T(F5, "p.43", "TC3-", "PPF2", "BBSG:5/GLa2:25/GLa1:30"),
  T(F5, "p.43", "TC3-", "PPF3", "BBSG:5/GLa2:20/GLa1:25"),
  T(F5, "p.43", "TC3-", "PPF4", "BBSG:5/GLa2:28"),
  T(F5, "p.43", "TC3-", "PPF5", "BBSG:5/GLa2:25"),

  // ---- F6 SAa2/SAn (PDF p. 47) — TC2−/PPF2 SAa2=25 cm tel que dessiné ----
  T(F6, "p.47", "TC1+", "PPF2", "BBM:4/SAa2:15/SAn:30"),
  T(F6, "p.47", "TC1+", "PPF3", "BBM:4/SAa2:15/SAn:15"),
  T(F6, "p.47", "TC1+", "PPF4", "BBM:4/SAa2:18"),
  T(F6, "p.47", "TC1+", "PPF5", "BBM:4/SAa2:15"),
  T(F6, "p.47", "TC2-", "PPF2", "BBSG:5/SAa2:25/SAn:30"),
  T(F6, "p.47", "TC2-", "PPF3", "BBSG:5/SAa2:15/SAn:20"),
  T(F6, "p.47", "TC2-", "PPF4", "BBSG:5/SAa2:19"),
  T(F6, "p.47", "TC2-", "PPF5", "BBSG:5/SAa2:15"),
  T(F6, "p.47", "TC2+", "PPF2", "BBSG:5/SAa2:20/SAn:30"),
  T(F6, "p.47", "TC2+", "PPF3", "BBSG:5/SAa2:15/SAn:25"),
  T(F6, "p.47", "TC2+", "PPF4", "BBSG:5/SAa2:22"),
  T(F6, "p.47", "TC2+", "PPF5", "BBSG:5/SAa2:20"),
  T(F6, "p.47", "TC3-", "PPF2", "BBSG:5/SAa2:25/SAn:35"),
  T(F6, "p.47", "TC3-", "PPF3", "BBSG:5/SAa2:20/SAn:30"),
  T(F6, "p.47", "TC3-", "PPF4", "BBSG:5/SAa2:28"),
  T(F6, "p.47", "TC3-", "PPF5", "BBSG:5/SAa2:25"),

  // ---- F7 SAa2/SAa1 (PDF p. 51) ----
  T(F7, "p.51", "TC1+", "PPF2", "BBM:4/SAa2:15/SAa1:30"),
  T(F7, "p.51", "TC1+", "PPF3", "BBM:4/SAa2:15/SAa1:15"),
  T(F7, "p.51", "TC1+", "PPF4", "BBM:4/SAa2:18"),
  T(F7, "p.51", "TC1+", "PPF5", "BBM:4/SAa2:15"),
  T(F7, "p.51", "TC2-", "PPF2", "BBSG:5/SAa2:15/SAa1:30"),
  T(F7, "p.51", "TC2-", "PPF3", "BBSG:5/SAa2:15/SAa1:20"),
  T(F7, "p.51", "TC2-", "PPF4", "BBSG:5/SAa2:20"),
  T(F7, "p.51", "TC2-", "PPF5", "BBSG:5/SAa2:15"),
  T(F7, "p.51", "TC2+", "PPF2", "BBSG:5/SAa2:20/SAa1:30"),
  T(F7, "p.51", "TC2+", "PPF3", "BBSG:5/SAa2:15/SAa1:20"),
  T(F7, "p.51", "TC2+", "PPF4", "BBSG:5/SAa2:22"),
  T(F7, "p.51", "TC2+", "PPF5", "BBSG:5/SAa2:20"),
  T(F7, "p.51", "TC3-", "PPF2", "BBSG:5/SAa2:25/SAa1:30"),
  T(F7, "p.51", "TC3-", "PPF3", "BBSG:5/SAa2:20/SAa1:25"),
  T(F7, "p.51", "TC3-", "PPF4", "BBSG:5/SAa2:28"),
  T(F7, "p.51", "TC3-", "PPF5", "BBSG:5/SAa2:25"),

  // ---- F8 GB3/GNT (PDF p. 55) ----
  T(F8, "p.55", "TC1+", "PPF2", "BBM:4/GB3:12/GNT:35", "Couche de réglage insensible à l'eau."),
  T(F8, "p.55", "TC1+", "PPF3", "BBM:4/GB3:9/GNT:30"),
  T(F8, "p.55", "TC2-", "PPF2", "BBSG:5/GB3:13/GNT:35"),
  T(F8, "p.55", "TC2-", "PPF3", "BBSG:5/GB3:10/GNT:30"),
  T(F8, "p.55", "TC2-", "PPF4", "BBSG:5/GB3:9/GNT:25"),
  T(F8, "p.55", "TC2-", "PPF5", "BBSG:5/GB3:11"),
  T(F8, "p.55", "TC2+", "PPF2", "BBSG:5/GB3:15/GNT:35"),
  T(F8, "p.55", "TC2+", "PPF3", "BBSG:5/GB3:12/GNT:30"),
  T(F8, "p.55", "TC2+", "PPF4", "BBSG:5/GB3:11/GNT:25"),
  T(F8, "p.55", "TC2+", "PPF5", "BBSG:5/GB3:13"),
  T(F8, "p.55", "TC3-", "PPF3", "BBSG:5/GB3:14/GNT:35"),
  T(F8, "p.55", "TC3-", "PPF4", "BBSG:5/GB3:14/GNT:25"),
  T(F8, "p.55", "TC3-", "PPF5", "BBSG:5/GB3:16"),
  T(F8, "p.55", "TC3+", "PPF3", "BBSG:5/GB3:16/GNT:35"),
  T(F8, "p.55", "TC3+", "PPF4", "BBSG:5/GB3:16/GNT:25"),
  T(F8, "p.55", "TC3+", "PPF5", "BBSG:5/GB3:13/GNT:20"),

  // ---- F9 GB3/GLa1 (PDF p. 59) ----
  T(F9, "p.59", "TC1+", "PPF2", "BBM:4/GB3:12/GLa1:35", "Couche de réglage insensible à l'eau."),
  T(F9, "p.59", "TC1+", "PPF3", "BBM:4/GB3:9/GLa1:30"),
  T(F9, "p.59", "TC2-", "PPF2", "BBSG:5/GB3:13/GLa1:35"),
  T(F9, "p.59", "TC2-", "PPF3", "BBSG:5/GB3:10/GLa1:30"),
  T(F9, "p.59", "TC2-", "PPF4", "BBSG:5/GB3:9/GLa1:25"),
  T(F9b, "p.59", "TC2-", "PPF4", "BBSG:5/GB3:11"),
  T(F9, "p.59", "TC2+", "PPF2", "BBSG:5/GB3:15/GLa1:35"),
  T(F9, "p.59", "TC2+", "PPF3", "BBSG:5/GB3:12/GLa1:30"),
  T(F9, "p.59", "TC2+", "PPF4", "BBSG:5/GB3:11/GLa1:25"),
  T(F9b, "p.59", "TC2+", "PPF4", "BBSG:5/GB3:13"),
  T(F9, "p.59", "TC3-", "PPF3", "BBSG:5/GB3:15/GLa1:30"),
  T(F9, "p.59", "TC3-", "PPF4", "BBSG:5/GB3:14/GLa1:25"),
  T(F9b, "p.59", "TC3-", "PPF4", "BBSG:5/GB3:16"),
  T(F9, "p.59", "TC3+", "PPF4", "BBSG:5/GB3:16/GLa1:25"),
  T(F9b, "p.59", "TC3+", "PPF4", "BBSG:5/GB3:12/GLa1:20"),

  // ---- F10 GB3/SAa1 (PDF p. 63) ----
  T(F10, "p.63", "TC1+", "PPF2", "BBM:4/GB3:12/SAa1:35", "Couche de réglage insensible à l'eau."),
  T(F10, "p.63", "TC1+", "PPF3", "BBM:4/GB3:9/SAa1:30"),
  T(F10, "p.63", "TC2-", "PPF2", "BBSG:5/GB3:13/SAa1:35"),
  T(F10, "p.63", "TC2-", "PPF3", "BBSG:5/GB3:10/SAa1:30"),
  T(F10, "p.63", "TC2-", "PPF4", "BBSG:5/GB3:9/SAa1:25"),
  T(F10b, "p.63", "TC2-", "PPF4", "BBSG:5/GB3:11"),
  T(F10, "p.63", "TC2+", "PPF2", "BBSG:5/GB3:15/SAa1:35"),
  T(F10, "p.63", "TC2+", "PPF3", "BBSG:5/GB3:12/SAa1:30"),
  T(F10, "p.63", "TC2+", "PPF4", "BBSG:5/GB3:11/SAa1:25"),
  T(F10b, "p.63", "TC2+", "PPF4", "BBSG:5/GB3:13"),
  T(F10, "p.63", "TC3-", "PPF3", "BBSG:5/GB3:15/SAa1:30"),
  T(F10, "p.63", "TC3-", "PPF4", "BBSG:5/GB3:14/SAa1:25"),
  T(F10b, "p.63", "TC3-", "PPF4", "BBSG:5/GB3:16"),
  T(F10, "p.63", "TC3+", "PPF4", "BBSG:5/GB3:16/SAa1:25"),
  T(F10b, "p.63", "TC3+", "PPF4", "BBSG:5/GB3:12/SAa1:20"),

  // ---- F11 GB4/GNT (PDF p. 67) ----
  T(F11, "p.67", "TC2+", "PPF2", "BBSG:5/GB4:12/GNT:35", "Couche de réglage insensible à l'eau."),
  T(F11, "p.67", "TC2+", "PPF3", "BBSG:5/GB4:10/GNT:30"),
  T(F11, "p.67", "TC2+", "PPF4", "BBSG:5/GB4:10/GNT:15"),
  T(F11, "p.67", "TC2+", "PPF5", "BBSG:5/GB4:10"),
  T(F11, "p.67", "TC3-", "PPF2", "BBSG:5/GB4:14/GNT:35"),
  T(F11, "p.67", "TC3-", "PPF3", "BBSG:5/GB4:12/GNT:30"),
  T(F11, "p.67", "TC3-", "PPF4", "BBSG:5/GB4:12/GNT:15"),
  T(F11, "p.67", "TC3-", "PPF5", "BBSG:5/GB4:12"),
  T(F11, "p.67", "TC3+", "PPF3", "BBSG:5/GB4:14/GNT:30"),
  T(F11, "p.67", "TC3+", "PPF4", "BBSG:5/GB4:14/GNT:15"),
  T(F11, "p.67", "TC3+", "PPF5", "BBSG:5/GB4:14"),

  // ---- F12 GB4/GLa1 (PDF p. 71) ----
  T(F12, "p.71", "TC2+", "PPF2", "BBSG:5/GB4:12/GLa1:35", "Réglage ±2 cm, matériau insensible à l'eau."),
  T(F12, "p.71", "TC2+", "PPF3", "BBSG:5/GB4:10/GLa1:30"),
  T(F12, "p.71", "TC2+", "PPF4", "BBSG:5/GB4:10/GLa1:15"),
  T(F12, "p.71", "TC2+", "PPF5", "BBSG:5/GB4:10"),
  T(F12, "p.71", "TC3-", "PPF2", "BBSG:5/GB4:14/GLa1:35"),
  T(F12, "p.71", "TC3-", "PPF3", "BBSG:5/GB4:12/GLa1:30"),
  T(F12, "p.71", "TC3-", "PPF4", "BBSG:5/GB4:12/GLa1:15"),
  T(F12, "p.71", "TC3-", "PPF5", "BBSG:5/GB4:12"),
  T(F12, "p.71", "TC3+", "PPF2", "BBSG:5/GB4:16/GLa1:35"),
  T(F12, "p.71", "TC3+", "PPF3", "BBSG:5/GB4:14/GLa1:30"),
  T(F12, "p.71", "TC3+", "PPF4", "BBSG:5/GB4:14/GLa1:15"),
  T(F12, "p.71", "TC3+", "PPF5", "BBSG:5/GB4:14"),

  // ---- F13 GB4/SAa1 (PDF p. 75) ----
  T(F13, "p.75", "TC2+", "PPF2", "BBSG:5/GB4:12/SAa1:35", "Réglage ±2 cm, matériau insensible à l'eau."),
  T(F13, "p.75", "TC2+", "PPF3", "BBSG:5/GB4:10/SAa1:30"),
  T(F13, "p.75", "TC2+", "PPF4", "BBSG:5/GB4:10/SAa1:15"),
  T(F13, "p.75", "TC2+", "PPF5", "BBSG:5/GB4:10"),
  T(F13, "p.75", "TC3-", "PPF2", "BBSG:5/GB4:14/SAa1:35"),
  T(F13, "p.75", "TC3-", "PPF3", "BBSG:5/GB4:12/SAa1:30"),
  T(F13, "p.75", "TC3-", "PPF4", "BBSG:5/GB4:12/SAa1:15"),
  T(F13, "p.75", "TC3-", "PPF5", "BBSG:5/GB4:12"),
  T(F13, "p.75", "TC3+", "PPF2", "BBSG:5/GB4:16/SAa1:35"),
  T(F13, "p.75", "TC3+", "PPF3", "BBSG:5/GB4:14/SAa1:30"),
  T(F13, "p.75", "TC3+", "PPF4", "BBSG:5/GB4:14/SAa1:15"),
  T(F13, "p.75", "TC3+", "PPF5", "BBSG:5/GB4:14"),

  // ---- F14 GB3/GB3 (PDF p. 79) — PPF2 vide ; PPF3 vide dès TC5− ----
  T(F14, "p.79", "TC2-", "PPF3", "BBSG:5/GB3:9/GB3:9"),
  T(F14, "p.79", "TC2-", "PPF4", "BBSG:5/GB3:14"),
  T(F14, "p.79", "TC2-", "PPF5", "BBSG:5/GB3:11"),
  T(F14, "p.79", "TC2+", "PPF3", "BBSG:5/GB3:10/GB3:10"),
  T(F14, "p.79", "TC2+", "PPF4", "BBSG:5/GB3:16"),
  T(F14, "p.79", "TC2+", "PPF5", "BBSG:5/GB3:13"),
  T(F14, "p.79", "TC3-", "PPF3", "BBSG:5/GB3:11/GB3:11"),
  T(F14, "p.79", "TC3-", "PPF4", "BBSG:5/GB3:9/GB3:10"),
  T(F14, "p.79", "TC3-", "PPF5", "BBSG:5/GB3:16"),
  T(F14, "p.79", "TC3+", "PPF3", "BBSG:5/GB3:12/GB3:12"),
  T(F14, "p.79", "TC3+", "PPF4", "BBSG:5/GB3:10/GB3:11"),
  T(F14, "p.79", "TC3+", "PPF5", "BBSG:5/GB3:9/GB3:9"),
  T(F14, "p.79", "TC4-", "PPF3", "BBSG:5/GB3:13/GB3:14"),
  T(F14, "p.79", "TC4-", "PPF4", "BBSG:5/GB3:11/GB3:12"),
  T(F14, "p.79", "TC4-", "PPF5", "BBSG:5/GB3:10/GB3:10"),
  T(F14, "p.79", "TC4+", "PPF3", "BBSG:5/GB3:14/GB3:15"),
  T(F14, "p.79", "TC4+", "PPF4", "BBSG:5/GB3:12/GB3:13"),
  T(F14, "p.79", "TC4+", "PPF5", "BBSG:5/GB3:11/GB3:11"),
  T(F14, "p.79", "TC5-", "PPF4", "BBSG:5/GB3:14/GB3:15"),
  T(F14, "p.79", "TC5-", "PPF5", "BBSG:5/GB3:12/GB3:13"),
  T(F14, "p.79", "TC5+", "PPF4", "BBSG:5/GB3:10/GB3:10/GB3:11"),
  T(F14, "p.79", "TC5+", "PPF5", "BBSG:5/GB3:13/GB3:14"),
  T(F14, "p.79", "TC6-", "PPF4", "BBSG:5/GB3:11/GB3:11/GB3:11"),
  T(F14, "p.79", "TC6-", "PPF5", "BBSG:5/GB3:14/GB3:15"),
  T(F14, "p.79", "TC6+", "PPF4", "BBSG:5/GB3:11/GB3:11/GB3:13"),
  T(F14, "p.79", "TC6+", "PPF5", "BBSG:5/GB3:10/GB3:10/GB3:11"),

  // ---- F15 GB4/GB4 (PDF p. 83) ----
  T(F15, "p.83", "TC3-", "PPF3", "BBSG:5/GB4:9/GB4:9"),
  T(F15, "p.83", "TC3-", "PPF4", "BBSG:5/GB4:15"),
  T(F15, "p.83", "TC3-", "PPF5", "BBSG:5/GB4:13"),
  T(F15, "p.83", "TC3+", "PPF3", "BBSG:5/GB4:10/GB4:10"),
  T(F15, "p.83", "TC3+", "PPF4", "BBSG:5/GB4:8/GB4:9"),
  T(F15, "p.83", "TC3+", "PPF5", "BBSG:5/GB4:15"),
  T(F15, "p.83", "TC4-", "PPF3", "BBSG:5/GB4:11/GB4:11"),
  T(F15, "p.83", "TC4-", "PPF4", "BBSG:5/GB4:9/GB4:10"),
  T(F15, "p.83", "TC4-", "PPF5", "BBSG:5/GB4:8/GB4:9"),
  T(F15, "p.83", "TC4+", "PPF3", "BBSG:5/GB4:12/GB4:12"),
  T(F15, "p.83", "TC4+", "PPF4", "BBSG:5/GB4:10/GB4:11"),
  T(F15, "p.83", "TC4+", "PPF5", "BBSG:5/GB4:9/GB4:10"),
  T(F15, "p.83", "TC5-", "PPF4", "BBSG:5/GB4:12/GB4:12"),
  T(F15, "p.83", "TC5-", "PPF5", "BBSG:5/GB4:10/GB4:11"),
  T(F15, "p.83", "TC5+", "PPF4", "BBSG:5/GB4:13/GB4:13"),
  T(F15, "p.83", "TC5+", "PPF5", "BBSG:5/GB4:11/GB4:12"),
  T(F15, "p.83", "TC6-", "PPF4", "BBSG:5/GB4:14/GB4:14"),
  T(F15, "p.83", "TC6-", "PPF5", "BBSG:5/GB4:12/GB4:13"),
  T(F15, "p.83", "TC6+", "PPF4", "BBSG:5/GB4:9/GB4:10/GB4:11"),
  T(F15, "p.83", "TC6+", "PPF5", "BBSG:5/GB4:13/GB4:14"),

  // ---- F16 EME2/GB3 (PDF p. 87) — 1re ligne 1,5–2,5 M = TC3− ----
  T(F16, "p.87", "TC3-", "PPF3", "BBSG:5/EME2:9/GB3:12"),
  T(F16, "p.87", "TC3-", "PPF4", "BBSG:5/EME2:7/GB3:11"),
  T(F16, "p.87", "TC3-", "PPF5", "BBSG:5/EME2:11"),
  T(F16, "p.87", "TC3+", "PPF3", "BBSG:5/EME2:10/GB3:13"),
  T(F16, "p.87", "TC3+", "PPF4", "BBSG:5/EME2:8/GB3:12"),
  T(F16, "p.87", "TC3+", "PPF5", "BBSG:5/EME2:13"),
  T(F16, "p.87", "TC4-", "PPF3", "BBSG:5/EME2:10/GB3:15"),
  T(F16, "p.87", "TC4-", "PPF4", "BBSG:5/EME2:10/GB3:12"),
  T(F16, "p.87", "TC4-", "PPF5", "BBSG:5/EME2:9/GB3:10"),
  T(F16, "p.87", "TC4+", "PPF3", "BBSG:5/EME2:11/GB3:16"),
  T(F16, "p.87", "TC4+", "PPF4", "BBSG:5/EME2:10/GB3:14"),
  T(F16, "p.87", "TC4+", "PPF5", "BBSG:5/EME2:10/GB3:12"),
  T(F16, "p.87", "TC5-", "PPF4", "BBSG:5/EME2:12/GB3:14"),
  T(F16, "p.87", "TC5-", "PPF5", "BBSG:5/EME2:11/GB3:13"),
  T(F16, "p.87", "TC5+", "PPF4", "BBSG:5/EME2:12/GB3:16"),
  T(F16, "p.87", "TC5+", "PPF5", "BBSG:5/EME2:11/GB3:15"),
  T(F16, "p.87", "TC6-", "PPF4", "BBSG:5/EME2:10/GB3:10/GB3:11"),
  T(F16, "p.87", "TC6-", "PPF5", "BBSG:5/EME2:12/GB3:15"),
  T(F16, "p.87", "TC6+", "PPF4", "BBSG:5/EME2:10/GB3:11/GB3:12"),
  T(F16, "p.87", "TC6+", "PPF5", "BBSG:5/EME2:13/GB3:16"),

  // ---- F17 EME2/EME2 (PDF p. 91) ----
  T(F17, "p.91", "TC3-", "PPF3", "BBSG:5/EME2:8/EME2:8"),
  T(F17, "p.91", "TC3-", "PPF4", "BBSG:5/EME2:6/EME2:6"),
  T(F17, "p.91", "TC3-", "PPF5", "BBSG:5/EME2:5/EME2:5"),
  T(F17, "p.91", "TC3+", "PPF3", "BBSG:5/EME2:9/EME2:9"),
  T(F17, "p.91", "TC3+", "PPF4", "BBSG:5/EME2:7/EME2:7"),
  T(F17, "p.91", "TC3+", "PPF5", "BBSG:5/EME2:6/EME2:6"),
  T(F17, "p.91", "TC4-", "PPF3", "BBSG:5/EME2:10/EME2:10"),
  T(F17, "p.91", "TC4-", "PPF4", "BBSG:5/EME2:8/EME2:8"),
  T(F17, "p.91", "TC4-", "PPF5", "BBSG:5/EME2:7/EME2:7"),
  T(F17, "p.91", "TC4+", "PPF3", "BBSG:5/EME2:11/EME2:11"),
  T(F17, "p.91", "TC4+", "PPF4", "BBSG:5/EME2:9/EME2:9"),
  T(F17, "p.91", "TC4+", "PPF5", "BBSG:5/EME2:8/EME2:8"),
  T(F17, "p.91", "TC5-", "PPF4", "BBSG:5/EME2:10/EME2:10"),
  T(F17, "p.91", "TC5-", "PPF5", "BBSG:5/EME2:9/EME2:9"),
  T(F17, "p.91", "TC5+", "PPF4", "BBSG:5/EME2:11/EME2:11"),
  T(F17, "p.91", "TC5+", "PPF5", "BBSG:5/EME2:10/EME2:10"),
  T(F17, "p.91", "TC6-", "PPF4", "BBSG:5/EME2:12/EME2:12"),
  T(F17, "p.91", "TC6-", "PPF5", "BBSG:5/EME2:11/EME2:11"),
  T(F17, "p.91", "TC6+", "PPF4", "BBSG:5/EME2:13/EME2:13"),
  T(F17, "p.91", "TC6+", "PPF5", "BBSG:5/EME2:12/EME2:12")
];

export const CATALOGUE = catalogueStructures({
  pays: "cotedivoire",
  reference: "Manuel LBTP CI avril 2024 — 17 fiches neuves (Fasc. 1), essieu 130 kN, PPF × TC",
  fiches: FICHES,
  cle: "classe-ne",
});
