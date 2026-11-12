// Catalogue de structures types du Sénégal (Ageroute 2015, chapitre 6),
// portage de SenegalStructures. Les 17 tableaux (T1..T17) sont indexés par
// classe de NE cumulé (C1..C8) et classe de portance (PF1, PF2, PF2qs, PF3,
// PF4). Transcription cellule par cellule des pages p-048..p-064 ; chaque
// cellule donne les épaisseurs (cm) de la surface vers le bas.

import { catalogueStructures } from "./base.js";
import { decouperSpec, coucheFiche } from "./commun.js";

const SRC = "Catalogue Sénégal 2015";

// Nature de couche → (famille, clé matériau). Les interfaces ne sont pas données
// par le catalogue d'épaisseurs : repli Alizé à la construction.
const MAT = {
  BBSG: ["bitumineux", "BBSG2-3"], BBSG3: ["bitumineux", "BBSG2-3"],
  GB2: ["bitumineux", "GB2"], GB3: ["bitumineux", "GB3"], EME2: ["bitumineux", "EME2"],
  GC3: ["hydraulique", "GC-T3"], SC2: ["hydraulique", "SC-T2"],
  GLC1: ["hydraulique", "GLc1"], GLC2: ["hydraulique", "GLc2"], BQC: ["hydraulique", "BQc"],
  BC5: ["hydraulique", "BC5"], BC5G: ["hydraulique", "BC5g"], BC2: ["hydraulique", "BC2"],
  GL1: ["sol", "GL1"], GL2: ["sol", "GL2"], GNT: ["sol", "GNT"],
  // Sable de pose sous pavés et pavés : couches de construction sans critère de
  // dimensionnement (famille nulle) — les déclarer granulaires leur prêterait un
  // critère de déformation verticale que le catalogue ne leur donne pas.
  SABLE: [null, "sable de pose"], PAVE: [null, "pavé autobloquant"],
};

const couches = (spec) => decouperSpec(spec).map(({ code, cm }) => {
  const [famille, cle] = MAT[code.toUpperCase()] ?? ["sol", code];
  return coucheFiche(code, cm, famille, cle);
});

const T = (famille, page, trafic, pf, spec) => ({
  classeTrafic: trafic, classePortance: pf, famille, couches: couches(spec),
  source: `${SRC}, ${page}`, provisoire: false, note: null, intervention: "neuve",
});

// Libellés de famille (préfixe = code du tableau, utilisé pour la recherche).
const F1 = "T1 — bitumineuse épaisse (BBSG/GB2)";
const F2 = "T2 — bitumineuse épaisse (BBSG/GB3)";
const F3 = "T3 — bitumineuse épaisse (BBSG/GB2/GNT)";
const F4 = "T4 — bitumineuse épaisse (BBSG/GB3/GNT)";
const F5 = "T5 — bitumineuse épaisse (BBSG/EME2)";
const F6 = "T6 — semi-rigide (BBSG/GC-T3)";
const F7 = "T7 — semi-rigide (BBSG/SC-T2)";
const F8 = "T8 — semi-rigide (BBSG/GLc2)";
const F9 = "T9 — semi-rigide (BBSG/GLc2/GL2)";
const F10 = "T10 — semi-rigide (BBSG/GLc1)";
const F11 = "T11 — semi-rigide (BBSG/BQc)";
const F12 = "T12 — souple (pavés/GNT)";
const F13 = "T13 — souple (BBSG/GNT)";
const F14 = "T14 — souple (BBSG/GL1)";
const F15 = "T15 — souple (BBSG/GL2/GL1)";
const F16 = "T16 — béton (BC5/BC2)";
const F17 = "T17 — béton goujonné (BC5g/BC2)";

export const FICHES = [
  // ---- T1 (p-048) BBSG + GB2 + GB2 -------------------------------------------------
  T(F1, "p-048", "C1", "PF1",   "BBSG:6/GB2:11/GB2:11"),
  T(F1, "p-048", "C1", "PF2",   "BBSG:6/GB2:8/GB2:9"),
  T(F1, "p-048", "C1", "PF2qs", "BBSG:6/GB2:7/GB2:7"),
  T(F1, "p-048", "C1", "PF3",   "BBSG:6/GB2:11"),
  T(F1, "p-048", "C1", "PF4",   "BBSG:6/GB2:8"),
  T(F1, "p-048", "C2", "PF1",   "BBSG:6/GB2:13/GB2:13"),
  T(F1, "p-048", "C2", "PF2",   "BBSG:6/GB2:10/GB2:10"),
  T(F1, "p-048", "C2", "PF2qs", "BBSG:6/GB2:8/GB2:9"),
  T(F1, "p-048", "C2", "PF3",   "BBSG:6/GB2:14"),
  T(F1, "p-048", "C2", "PF4",   "BBSG:6/GB2:11"),
  T(F1, "p-048", "C3", "PF1",   "BBSG:6/GB2:10/GB2:10/GB2:10"),
  T(F1, "p-048", "C3", "PF2",   "BBSG:6/GB2:12/GB2:13"),
  T(F1, "p-048", "C3", "PF2qs", "BBSG:6/GB2:11/GB2:11"),
  T(F1, "p-048", "C3", "PF3",   "BBSG:6/GB2:9/GB2:9"),
  T(F1, "p-048", "C3", "PF4",   "BBSG:6/GB2:15"),
  T(F1, "p-048", "C4", "PF2",   "BBSG:6/GB2:9/GB2:10/GB2:10"),
  T(F1, "p-048", "C4", "PF2qs", "BBSG:6/GB2:13/GB2:13"),
  T(F1, "p-048", "C4", "PF3",   "BBSG:6/GB2:11/GB2:12"),
  T(F1, "p-048", "C4", "PF4",   "BBSG:6/GB2:9/GB2:10"),
  T(F1, "p-048", "C5", "PF3",   "BBSG:8/GB2:10/GB2:10/GB2:10"),
  T(F1, "p-048", "C5", "PF4",   "BBSG:8/GB2:13/GB2:13"),
  T(F1, "p-048", "C6", "PF3",   "BBSG:8/GB2:11/GB2:12/GB2:12"),
  T(F1, "p-048", "C6", "PF4",   "BBSG:8/GB2:10/GB2:10/GB2:11"),
  T(F1, "p-048", "C7", "PF3",   "BBSG:8/GB2:12/GB2:13/GB2:13"),
  T(F1, "p-048", "C7", "PF4",   "BBSG:8/GB2:11/GB2:11/GB2:12"),
  T(F1, "p-048", "C8", "PF3",   "BBSG:8/GB2:14/GB2:14/GB2:14"),
  T(F1, "p-048", "C8", "PF4",   "BBSG:8/GB2:12/GB2:13/GB2:13"),

  // ---- T2 (p-049) BBSG + GB3 + GB3 -------------------------------------------------
  T(F2, "p-049", "C1", "PF2",   "BBSG:6/GB3:7/GB3:8"),
  T(F2, "p-049", "C1", "PF2qs", "BBSG:6/GB3:12"),
  T(F2, "p-049", "C1", "PF3",   "BBSG:6/GB3:9"),
  T(F2, "p-049", "C1", "PF4",   "BBSG:6/GB3:8"),
  T(F2, "p-049", "C2", "PF2",   "BBSG:6/GB3:9/GB3:10"),
  T(F2, "p-049", "C2", "PF2qs", "BBSG:6/GB3:8/GB3:8"),
  T(F2, "p-049", "C2", "PF3",   "BBSG:6/GB3:14"),
  T(F2, "p-049", "C2", "PF4",   "BBSG:6/GB3:10"),
  T(F2, "p-049", "C3", "PF2",   "BBSG:6/GB3:12/GB3:12"),
  T(F2, "p-049", "C3", "PF2qs", "BBSG:6/GB3:10/GB3:10"),
  T(F2, "p-049", "C3", "PF3",   "BBSG:6/GB3:8/GB3:9"),
  T(F2, "p-049", "C3", "PF4",   "BBSG:6/GB3:14"),
  T(F2, "p-049", "C4", "PF2",   "BBSG:6/GB3:9/GB3:10/GB3:10"),
  T(F2, "p-049", "C4", "PF2qs", "BBSG:6/GB3:12/GB3:13"),
  T(F2, "p-049", "C4", "PF3",   "BBSG:6/GB3:11/GB3:11"),
  T(F2, "p-049", "C4", "PF4",   "BBSG:6/GB3:8/GB3:9"),
  T(F2, "p-049", "C5", "PF2qs", "BBSG:8/GB3:10/GB3:10/GB3:11"),
  T(F2, "p-049", "C5", "PF3",   "BBSG:8/GB3:13/GB3:14"),
  T(F2, "p-049", "C5", "PF4",   "BBSG:8/GB3:11/GB3:12"),
  T(F2, "p-049", "C6", "PF3",   "BBSG:8/GB3:10/GB3:11/GB3:11"),
  T(F2, "p-049", "C6", "PF4",   "BBSG:8/GB3:9/GB3:10/GB3:10"),
  T(F2, "p-049", "C7", "PF3",   "BBSG:8/GB3:11/GB3:12/GB3:12"),
  T(F2, "p-049", "C7", "PF4",   "BBSG:8/GB3:10/GB3:10/GB3:11"),
  T(F2, "p-049", "C8", "PF3",   "BBSG:8/GB3:13/GB3:13/GB3:13"),
  T(F2, "p-049", "C8", "PF4",   "BBSG:8/GB3:11/GB3:12/GB3:12"),

  // ---- T3 (p-050) BBSG + GB2 + GNT -------------------------------------------------
  T(F3, "p-050", "C2", "PF2",   "BBSG:6/GB2:7/GB2:8/GNT:25"),
  T(F3, "p-050", "C2", "PF2qs", "BBSG:6/GB2:11/GNT:25"),
  T(F3, "p-050", "C2", "PF3",   "BBSG:6/GB2:8/GNT:15"),
  T(F3, "p-050", "C3", "PF2",   "BBSG:6/GB2:10/GB2:10/GNT:25"),
  T(F3, "p-050", "C3", "PF2qs", "BBSG:6/GB2:7/GB2:8/GNT:25"),
  T(F3, "p-050", "C3", "PF3",   "BBSG:6/GB2:13/GNT:15"),
  T(F3, "p-050", "C4", "PF2",   "BBSG:6/GB2:12/GB2:12/GNT:25"),
  T(F3, "p-050", "C4", "PF2qs", "BBSG:6/GB2:10/GB2:10/GNT:25"),
  T(F3, "p-050", "C4", "PF3",   "BBSG:6/GB2:9/GB2:9/GNT:15"),
  T(F3, "p-050", "C5", "PF2",   "BBSG:8/GB2:10/GB2:11/GB2:11/GNT:25"),
  T(F3, "p-050", "C5", "PF2qs", "BBSG:8/GB2:14/GB2:14/GNT:25"),
  T(F3, "p-050", "C5", "PF3",   "BBSG:8/GB2:12/GB2:13/GNT:15"),

  // ---- T4 (p-051) BBSG + GB3 + GNT -------------------------------------------------
  T(F4, "p-051", "C1", "PF2",   "BBSG:6/GB3:9/GNT:25"),
  T(F4, "p-051", "C2", "PF2",   "BBSG:6/GB3:14/GNT:25"),
  T(F4, "p-051", "C2", "PF2qs", "BBSG:6/GB3:9/GNT:25"),
  T(F4, "p-051", "C2", "PF3",   "BBSG:6/GB3:8/GNT:15"),
  T(F4, "p-051", "C3", "PF2",   "BBSG:6/GB3:9/GB3:10/GNT:25"),
  T(F4, "p-051", "C3", "PF2qs", "BBSG:6/GB3:14/GNT:25"),
  T(F4, "p-051", "C3", "PF3",   "BBSG:6/GB3:13/GNT:15"),
  T(F4, "p-051", "C4", "PF2",   "BBSG:6/GB3:12/GB3:12/GNT:25"),
  T(F4, "p-051", "C4", "PF2qs", "BBSG:6/GB3:9/GB3:9/GNT:25"),
  T(F4, "p-051", "C4", "PF3",   "BBSG:6/GB3:8/GB3:9/GNT:15"),
  T(F4, "p-051", "C5", "PF2",   "BBSG:8/GB3:9/GB3:10/GB3:10/GNT:25"),
  T(F4, "p-051", "C5", "PF2qs", "BBSG:8/GB3:12/GB3:13/GNT:15"),
  T(F4, "p-051", "C5", "PF3",   "BBSG:8/GB3:12/GB3:13/GNT:15"),
  T(F4, "p-051", "C6", "PF2qs", "BBSG:8/GB3:10/GB3:10/GB3:11/GNT:25"),
  T(F4, "p-051", "C6", "PF3",   "BBSG:8/GB3:14/GB3:14/GNT:15"),
  T(F4, "p-051", "C7", "PF3",   "BBSG:8/GB3:10/GB3:10/GB3:11/GNT:15"),

  // ---- T5 (p-052) BBSG + EME2 ------------------------------------------------------
  T(F5, "p-052", "C1", "PF2qs", "BBSG:6/EME2:7"),
  T(F5, "p-052", "C2", "PF2qs", "BBSG:6/EME2:11"),
  T(F5, "p-052", "C2", "PF3",   "BBSG:6/EME2:9"),
  T(F5, "p-052", "C2", "PF4",   "BBSG:6/EME2:7"),
  T(F5, "p-052", "C3", "PF2qs", "BBSG:6/EME2:7/EME2:7"),
  T(F5, "p-052", "C3", "PF3",   "BBSG:6/EME2:12"),
  T(F5, "p-052", "C3", "PF4",   "BBSG:6/EME2:9"),
  T(F5, "p-052", "C4", "PF2qs", "BBSG:6/EME2:9/EME2:9"),
  T(F5, "p-052", "C4", "PF3",   "BBSG:6/EME2:7/EME2:8"),
  T(F5, "p-052", "C4", "PF4",   "BBSG:6/EME2:12"),
  T(F5, "p-052", "C5", "PF2qs", "BBSG:8/EME2:10/EME2:11"),
  T(F5, "p-052", "C5", "PF3",   "BBSG:8/EME2:9/EME2:9"),
  T(F5, "p-052", "C5", "PF4",   "BBSG:8/EME2:8/EME2:8"),
  T(F5, "p-052", "C6", "PF2qs", "BBSG:8/EME2:12/EME2:13"),
  T(F5, "p-052", "C6", "PF3",   "BBSG:8/EME2:11/EME2:11"),
  T(F5, "p-052", "C6", "PF4",   "BBSG:8/EME2:10/EME2:10"),
  T(F5, "p-052", "C7", "PF2qs", "BBSG:8/EME2:9/EME2:9/EME2:9"),
  T(F5, "p-052", "C7", "PF3",   "BBSG:8/EME2:12/EME2:12"),
  T(F5, "p-052", "C7", "PF4",   "BBSG:8/EME2:11/EME2:11"),
  T(F5, "p-052", "C8", "PF2qs", "BBSG:8/EME2:10/EME2:10/EME2:10"),
  T(F5, "p-052", "C8", "PF3",   "BBSG:8/EME2:9/EME2:9/EME2:9"),
  T(F5, "p-052", "C8", "PF4",   "BBSG:8/EME2:12/EME2:12"),

  // ---- T6 (p-053) BBSG + GC-T3 -----------------------------------------------------
  T(F6, "p-053", "C2", "PF2",   "BBSG:6/GC3:29"),
  T(F6, "p-053", "C2", "PF2qs", "BBSG:6/GC3:27"),
  T(F6, "p-053", "C2", "PF3",   "BBSG:6/GC3:25"),
  T(F6, "p-053", "C2", "PF4",   "BBSG:6/GC3:22"),
  T(F6, "p-053", "C3", "PF2",   "BBSG:6/GC3:20/GC3:20"),
  T(F6, "p-053", "C3", "PF2qs", "BBSG:6/GC3:29"),
  T(F6, "p-053", "C3", "PF3",   "BBSG:6/GC3:26"),
  T(F6, "p-053", "C3", "PF4",   "BBSG:6/GC3:25"),
  T(F6, "p-053", "C4", "PF2",   "BBSG:6/GC3:20/GC3:20"),
  T(F6, "p-053", "C4", "PF2qs", "BBSG:6/GC3:30"),
  T(F6, "p-053", "C4", "PF3",   "BBSG:6/GC3:27"),
  T(F6, "p-053", "C4", "PF4",   "BBSG:6/GC3:25"),
  T(F6, "p-053", "C5", "PF2",   "BBSG:8/GC3:23/GC3:20"),
  T(F6, "p-053", "C5", "PF2qs", "BBSG:8/GC3:21/GC3:20"),
  T(F6, "p-053", "C5", "PF3",   "BBSG:8/GC3:19/GC3:18"),
  T(F6, "p-053", "C5", "PF4",   "BBSG:8/GC3:18/GC3:15"),
  T(F6, "p-053", "C6", "PF2",   "BBSG:10/GC3:23/GC3:20"),
  T(F6, "p-053", "C6", "PF2qs", "BBSG:10/GC3:21/GC3:20"),
  T(F6, "p-053", "C6", "PF3",   "BBSG:10/GC3:19/GC3:18"),
  T(F6, "p-053", "C6", "PF4",   "BBSG:10/GC3:18/GC3:15"),
  T(F6, "p-053", "C7", "PF2qs", "BBSG:12/GC3:21/GC3:20"),
  T(F6, "p-053", "C7", "PF3",   "BBSG:12/GC3:19/GC3:18"),
  T(F6, "p-053", "C7", "PF4",   "BBSG:12/GC3:18/GC3:15"),
  T(F6, "p-053", "C8", "PF2qs", "BBSG:14/GC3:21/GC3:20"),
  T(F6, "p-053", "C8", "PF3",   "BBSG:14/GC3:19/GC3:18"),
  T(F6, "p-053", "C8", "PF4",   "BBSG:14/GC3:18/GC3:15"),

  // ---- T7 (p-054) BBSG + SC-T2 -----------------------------------------------------
  T(F7, "p-054", "C1", "PF2qs", "BBSG:6/SC2:28"),
  T(F7, "p-054", "C1", "PF3",   "BBSG:6/SC2:25"),
  T(F7, "p-054", "C1", "PF4",   "BBSG:6/SC2:23"),
  T(F7, "p-054", "C2", "PF2qs", "BBSG:6/SC2:30"),
  T(F7, "p-054", "C2", "PF3",   "BBSG:6/SC2:27"),
  T(F7, "p-054", "C2", "PF4",   "BBSG:6/SC2:24"),
  T(F7, "p-054", "C3", "PF2",   "BBSG:6/SC2:20/SC2:20"),
  T(F7, "p-054", "C3", "PF2qs", "BBSG:6/SC2:20/SC2:20"),
  T(F7, "p-054", "C3", "PF3",   "BBSG:6/SC2:29"),
  T(F7, "p-054", "C3", "PF4",   "BBSG:6/SC2:26"),
  T(F7, "p-054", "C4", "PF2",   "BBSG:6/SC2:22/SC2:20"),
  T(F7, "p-054", "C4", "PF2qs", "BBSG:6/SC2:20/SC2:20"),
  T(F7, "p-054", "C4", "PF3",   "BBSG:6/SC2:18/SC2:18"),
  T(F7, "p-054", "C4", "PF4",   "BBSG:6/SC2:28"),

  // ---- T8 (p-055) BBSG + GLc2 ------------------------------------------------------
  T(F8, "p-055", "C1", "PF2qs", "BBSG:6/GLc2:27"),
  T(F8, "p-055", "C1", "PF3",   "BBSG:6/GLc2:22"),
  T(F8, "p-055", "C1", "PF4",   "BBSG:6/GLc2:18"),
  T(F8, "p-055", "C2", "PF2qs", "BBSG:6/GLc2:29"),
  T(F8, "p-055", "C2", "PF3",   "BBSG:6/GLc2:24"),
  T(F8, "p-055", "C2", "PF4",   "BBSG:6/GLc2:20"),
  T(F8, "p-055", "C3", "PF2qs", "BBSG:6/GLc2:20/GLc2:20"),
  T(F8, "p-055", "C3", "PF3",   "BBSG:6/GLc2:27"),
  T(F8, "p-055", "C3", "PF4",   "BBSG:6/GLc2:25"),
  T(F8, "p-055", "C4", "PF2",   "BBSG:6/GLc2:22/GLc2:20"),
  T(F8, "p-055", "C4", "PF2qs", "BBSG:6/GLc2:20/GLc2:20"),
  T(F8, "p-055", "C4", "PF3",   "BBSG:6/GLc2:29"),
  T(F8, "p-055", "C4", "PF4",   "BBSG:6/GLc2:25"),
  T(F8, "p-055", "C5", "PF2",   "BBSG:8/GLc2:27/GLc2:24"),
  T(F8, "p-055", "C5", "PF2qs", "BBSG:8/GLc2:24/GLc2:21"),
  T(F8, "p-055", "C5", "PF3",   "BBSG:8/GLc2:20/GLc2:18"),
  T(F8, "p-055", "C5", "PF4",   "BBSG:8/GLc2:17/GLc2:15"),
  T(F8, "p-055", "C6", "PF2qs", "BBSG:10/GLc2:23/GLc2:22"),
  T(F8, "p-055", "C6", "PF3",   "BBSG:10/GLc2:20/GLc2:19"),
  T(F8, "p-055", "C6", "PF4",   "BBSG:10/GLc2:17/GLc2:17"),
  T(F8, "p-055", "C7", "PF2qs", "BBSG:12/GLc2:23/GLc2:22"),
  T(F8, "p-055", "C7", "PF3",   "BBSG:12/GLc2:20/GLc2:19"),
  T(F8, "p-055", "C7", "PF4",   "BBSG:12/GLc2:17/GLc2:17"),
  T(F8, "p-055", "C8", "PF2qs", "BBSG:14/GLc2:23/GLc2:22"),
  T(F8, "p-055", "C8", "PF3",   "BBSG:14/GLc2:21/GLc2:19"),
  T(F8, "p-055", "C8", "PF4",   "BBSG:14/GLc2:18/GLc2:17"),

  // ---- T9 (p-056) BBSG + GLc2 + GL2 ------------------------------------------------
  T(F9, "p-056", "C1", "PF2",   "BBSG:6/GLc2:26/GL2:25"),
  T(F9, "p-056", "C1", "PF2qs", "BBSG:6/GLc2:22/GL2:25"),
  T(F9, "p-056", "C2", "PF2",   "BBSG:6/GLc2:29/GL2:25"),
  T(F9, "p-056", "C2", "PF2qs", "BBSG:6/GLc2:25/GL2:25"),
  T(F9, "p-056", "C3", "PF2",   "BBSG:6/GLc2:30/GL2:30"),
  T(F9, "p-056", "C3", "PF2qs", "BBSG:6/GLc2:25/GL2:30"),
  T(F9, "p-056", "C4", "PF2qs", "BBSG:6/GLc2:28/GL2:30"),

  // ---- T10 (p-057) BBSG + GLc1 -----------------------------------------------------
  T(F10, "p-057", "C1", "PF2",   "BBSG:6/GLc1:25/GLc1:23"),
  T(F10, "p-057", "C1", "PF2qs", "BBSG:6/GLc1:23/GLc1:21"),
  T(F10, "p-057", "C1", "PF3",   "BBSG:6/GLc1:20/GLc1:18"),
  T(F10, "p-057", "C1", "PF4",   "BBSG:6/GLc1:16/GLc1:15"),
  T(F10, "p-057", "C2", "PF2",   "BBSG:6/GLc1:27/GLc1:25"),
  T(F10, "p-057", "C2", "PF2qs", "BBSG:6/GLc1:24/GLc1:22"),
  T(F10, "p-057", "C2", "PF3",   "BBSG:6/GLc1:22/GLc1:20"),
  T(F10, "p-057", "C2", "PF4",   "BBSG:6/GLc1:18/GLc1:17"),
  T(F10, "p-057", "C3", "PF2",   "BBSG:6/GLc1:29/GLc1:27"),
  T(F10, "p-057", "C3", "PF2qs", "BBSG:6/GLc1:26/GLc1:24"),
  T(F10, "p-057", "C3", "PF3",   "BBSG:6/GLc1:24/GLc1:22"),
  T(F10, "p-057", "C3", "PF4",   "BBSG:6/GLc1:19/GLc1:19"),
  T(F10, "p-057", "C4", "PF2",   "BBSG:6/GLc1:30/GLc1:30"),
  T(F10, "p-057", "C4", "PF2qs", "BBSG:6/GLc1:28/GLc1:26"),
  T(F10, "p-057", "C4", "PF3",   "BBSG:6/GLc1:25/GLc1:24"),
  T(F10, "p-057", "C4", "PF4",   "BBSG:6/GLc1:22/GLc1:20"),
  T(F10, "p-057", "C5", "PF4",   "BBSG:8/GLc1:28/GLc1:27"),
  T(F10, "p-057", "C6", "PF4",   "BBSG:10/GLc1:29/GLc1:28"),

  // ---- T11 (p-058) BBSG + BQc ------------------------------------------------------
  T(F11, "p-058", "C1", "PF2",   "BBSG:6/BQc:24/BQc:23"),
  T(F11, "p-058", "C1", "PF2qs", "BBSG:6/BQc:23/BQc:21"),
  T(F11, "p-058", "C1", "PF3",   "BBSG:6/BQc:21/BQc:20"),
  T(F11, "p-058", "C1", "PF4",   "BBSG:6/BQc:19/BQc:18"),
  T(F11, "p-058", "C2", "PF2",   "BBSG:6/BQc:26/BQc:25"),
  T(F11, "p-058", "C2", "PF2qs", "BBSG:6/BQc:24/BQc:23"),
  T(F11, "p-058", "C2", "PF3",   "BBSG:6/BQc:23/BQc:21"),
  T(F11, "p-058", "C2", "PF4",   "BBSG:6/BQc:21/BQc:19"),
  T(F11, "p-058", "C3", "PF2",   "BBSG:6/BQc:27/BQc:27"),
  T(F11, "p-058", "C3", "PF2qs", "BBSG:6/BQc:26/BQc:24"),
  T(F11, "p-058", "C3", "PF3",   "BBSG:6/BQc:25/BQc:23"),
  T(F11, "p-058", "C3", "PF4",   "BBSG:6/BQc:22/BQc:21"),
  T(F11, "p-058", "C4", "PF2",   "BBSG:6/BQc:29/BQc:28"),
  T(F11, "p-058", "C4", "PF2qs", "BBSG:6/BQc:28/BQc:26"),
  T(F11, "p-058", "C4", "PF3",   "BBSG:6/BQc:26/BQc:24"),
  T(F11, "p-058", "C4", "PF4",   "BBSG:6/BQc:24/BQc:22"),
  T(F11, "p-058", "C5", "PF4",   "BBSG:8/BQc:29/BQc:27"),

  // ---- T12 (p-059) pavés + sable de pose + GNT -------------------------------------
  T(F12, "p-059", "C1", "PF2",   "Pave:8/Sable:3/GNT:15"),
  T(F12, "p-059", "C2", "PF2",   "Pave:8/Sable:3/GNT:15/GNT:20"),
  T(F12, "p-059", "C2", "PF2qs", "Pave:8/Sable:3/GNT:20"),
  T(F12, "p-059", "C3", "PF2",   "Pave:10/Sable:3/GNT:20/GNT:20"),
  T(F12, "p-059", "C3", "PF2qs", "Pave:10/Sable:3/GNT:30"),
  T(F12, "p-059", "C3", "PF3",   "Pave:10/Sable:3/GNT:20"),
  T(F12, "p-059", "C4", "PF2",   "Pave:10/Sable:3/GNT:25/GNT:25"),
  T(F12, "p-059", "C4", "PF2qs", "Pave:10/Sable:3/GNT:20/GNT:20"),
  T(F12, "p-059", "C4", "PF3",   "Pave:10/Sable:3/GNT:30"),

  // ---- T13 (p-060) BBSG + GNT ------------------------------------------------------
  T(F13, "p-060", "C1", "PF2",   "BBSG:6/GNT:30"),
  T(F13, "p-060", "C1", "PF2qs", "BBSG:6/GNT:20"),
  T(F13, "p-060", "C1", "PF3",   "BBSG:6/GNT:15"),
  T(F13, "p-060", "C2", "PF2",   "BBSG:6/GNT:25/GNT:25"),
  T(F13, "p-060", "C2", "PF2qs", "BBSG:6/GNT:15/GNT:20"),
  T(F13, "p-060", "C2", "PF3",   "BBSG:6/GNT:25"),
  T(F13, "p-060", "C3", "PF2",   "BBSG:6/GNT:25/GNT:30"),
  T(F13, "p-060", "C3", "PF2qs", "BBSG:6/GNT:20/GNT:25"),
  T(F13, "p-060", "C3", "PF3",   "BBSG:6/GNT:15/GNT:20"),
  T(F13, "p-060", "C4", "PF2",   "BBSG:6/GNT:20/GNT:20/GNT:25"),
  T(F13, "p-060", "C4", "PF2qs", "BBSG:6/GNT:25/GNT:30"),
  T(F13, "p-060", "C4", "PF3",   "BBSG:6/GNT:20/GNT:25"),

  // ---- T14 (p-061) BBSG + GL1 ------------------------------------------------------
  T(F14, "p-061", "C1", "PF1",   "BBSG:6/GL1:15/GL1:25/GL1:25"),
  T(F14, "p-061", "C1", "PF2",   "BBSG:6/GL1:15/GL1:25"),
  T(F14, "p-061", "C1", "PF2qs", "BBSG:6/GL1:15/GL1:15"),
  T(F14, "p-061", "C1", "PF3",   "BBSG:6/GL1:15/GL1:10"),
  T(F14, "p-061", "C2", "PF2",   "BBSG:6/GL1:20/GL1:20/GL1:20"),
  T(F14, "p-061", "C2", "PF2qs", "BBSG:6/GL1:20/GL1:25"),
  T(F14, "p-061", "C2", "PF3",   "BBSG:6/GL1:20/GL1:15"),

  // ---- T15 (p-062) BBSG + GL2 + GL1 ------------------------------------------------
  T(F15, "p-062", "C1", "PF1",   "BBSG:6/GL2:15/GL1:20/GL1:25"),
  T(F15, "p-062", "C1", "PF2",   "BBSG:6/GL2:15/GL1:20"),
  T(F15, "p-062", "C1", "PF2qs", "BBSG:6/GL2:15/GL1:10"),
  T(F15, "p-062", "C2", "PF2",   "BBSG:6/GL2:20/GL1:15/GL1:20"),
  T(F15, "p-062", "C2", "PF2qs", "BBSG:6/GL2:20/GL1:20"),
  T(F15, "p-062", "C2", "PF3",   "BBSG:6/GL2:20/GL1:10"),
  T(F15, "p-062", "C3", "PF2",   "BBSG:6/GL2:20/GL1:20/GL1:25"),
  T(F15, "p-062", "C3", "PF2qs", "BBSG:6/GL2:20/GL1:30"),
  T(F15, "p-062", "C3", "PF3",   "BBSG:6/GL2:20/GL1:20"),
  T(F15, "p-062", "C4", "PF2",   "BBSG:6/GL2:20/GL1:25/GL1:30"),
  T(F15, "p-062", "C4", "PF2qs", "BBSG:6/GL2:20/GL1:20/GL1:20"),
  T(F15, "p-062", "C4", "PF3",   "BBSG:6/GL2:20/GL1:30"),

  // ---- T16 (p-063) BC5 + BC2 -------------------------------------------------------
  T(F16, "p-063", "C1", "PF4",   "BC5:13/BC2:13"),
  T(F16, "p-063", "C2", "PF3",   "BC5:15/BC2:15"),
  T(F16, "p-063", "C2", "PF4",   "BC5:14/BC2:13"),
  T(F16, "p-063", "C3", "PF3",   "BC5:16/BC2:15"),
  T(F16, "p-063", "C3", "PF4",   "BC5:15/BC2:14"),
  T(F16, "p-063", "C4", "PF2",   "BC5:18/BC2:18"),
  T(F16, "p-063", "C4", "PF2qs", "BC5:18/BC2:18"),
  T(F16, "p-063", "C4", "PF3",   "BC5:17/BC2:15"),
  T(F16, "p-063", "C4", "PF4",   "BC5:15/BC2:15"),

  // ---- T17 (p-064) BC5 goujonné + BC2 ----------------------------------------------
  T(F17, "p-064", "C5", "PF2",   "BC5g:19/BC2:19"),
  T(F17, "p-064", "C5", "PF2qs", "BC5g:18/BC2:18"),
  T(F17, "p-064", "C5", "PF3",   "BC5g:17/BC2:17"),
  T(F17, "p-064", "C5", "PF4",   "BC5g:16/BC2:16"),
  T(F17, "p-064", "C6", "PF2qs", "BC5g:20/BC2:18"),
  T(F17, "p-064", "C6", "PF3",   "BC5g:18/BC2:18"),
  T(F17, "p-064", "C6", "PF4",   "BC5g:17/BC2:16"),
  T(F17, "p-064", "C7", "PF2qs", "BC5g:20/BC2:18"),
  T(F17, "p-064", "C7", "PF3",   "BC5g:19/BC2:18"),
  T(F17, "p-064", "C7", "PF4",   "BC5g:17/BC2:17"),
  T(F17, "p-064", "C8", "PF2qs", "BC5g:21/BC2:18"),
  T(F17, "p-064", "C8", "PF3",   "BC5g:19/BC2:19"),
  T(F17, "p-064", "C8", "PF4",   "BC5g:18/BC2:17"),
];

// Les fiches sénégalaises sont indexées par classe de NE cumulé (C1..C8), pas
// par classe de trafic journalier.
export const CATALOGUE = catalogueStructures({
  pays: "senegal",
  reference: "Catalogue des structures de chaussées neuves du Sénégal (Ageroute, 2015), chap. 6 (T1-T17)",
  fiches: FICHES,
  cle: "classe-ne",
});
