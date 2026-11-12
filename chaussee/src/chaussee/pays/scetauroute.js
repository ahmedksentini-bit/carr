// Structures-types du manuel de conception des chaussées d'autoroutes de
// Scetauroute (groupe Egis, 2005), chap. 4, figures 1, 1bis, 4, 5, 6, 6bis et 7
// (portage de ScetaurouteStructures de Burmister-Calc).
//
// Ce n'est PAS le catalogue français : le document de référence du réseau
// national est le catalogue SETRA-LCPC de 1998 (france-catalogue1998.js). Le
// manuel Scetauroute est un document d'entreprise pour les autoroutes
// concédées, avec son échelle de trafic propre (t0 à tex, débit journalier).
//
// Épaisseurs lues sur les dessins (scans p-036, p-037, p-042, p-044, p-046,
// p-047, p-048). Cellules absentes du dessin omises (fig. 1 au-delà de t1+,
// fig. 5 avant t2-). Corrections « autres plates-formes » appliquées telles
// qu'imprimées. Provisoire : lecture graphique. Figures 2/2bis/3/3bis/4bis/
// 5bis/7bis/8/8bis non encodées (lecture incomplète).

import { catalogueStructures } from "./base.js";

const SRC = "Manuel Scetauroute 2005";

const SURFACE_HAUTE = new Set(["t0-", "t0+", "ts-", "ts+", "tex-", "tex+"]);

/** Couche d'une figure : nature, épaisseur, famille et clé de la bibliothèque française. */
function couche(trafic, nature, epCm) {
  const c = (famille, materiau) => ({ nature, epCm, famille, materiau, interface: null });
  switch (nature) {
    case "BB": return c("bitumineux", SURFACE_HAUTE.has(trafic.toLowerCase()) ? "BBSG3" : "BBSG2");
    case "GB4": return c("bitumineux", "GB4");
    case "GB3": return c("bitumineux", "GB3");
    case "EME2": return c("bitumineux", "EME2");
    case "GNT": return c("sol", "GNT2");
    case "GC": return c("hydraulique", "GC-t3");
    case "SC": return c("hydraulique", "SC-t3");
    case "BAC": return c(null, "BAC");   // hors bibliothèque de calcul Alizé
    case "BM": return c(null, "BM");
    default: return c("sol", nature);
  }
}

const jetons = (spec) => spec.split("/").map((t) => t.trim()).filter(Boolean);

function couches(trafic, spec) {
  return jetons(spec).map((t) => {
    const [nature, ep] = t.split(":");
    return couche(trafic, nature.trim(), parseFloat(ep));
  });
}

/** Corrige de `delta` cm la DERNIÈRE couche de nature `code` ; la retire si elle tombe à zéro. */
function corriger(spec, code, delta) {
  const t = jetons(spec);
  for (let i = t.length - 1; i >= 0; i--) {
    const [nature, ep] = t[i].split(":");
    if (nature.toLowerCase() !== code.toLowerCase()) continue;
    const e = parseFloat(ep) + delta;
    if (e <= 0) t.splice(i, 1);
    else t[i] = `${nature}:${Math.round(e * 10) / 10}`;
    return t.join("/");
  }
  return spec;
}

const fiche = (famille, page, trafic, pf, spec, note = null) => ({
  classeTrafic: trafic, classePortance: pf, famille, couches: couches(trafic, spec),
  source: `${SRC}, ${page}`, provisoire: true, note, intervention: "neuve",
});

const F1 = "Fig. 1 — souple BB/GB4/GNT";
const F1B = "Fig. 1bis — souple BB/GB3/GNT";
const F4 = "Fig. 4 — tout bitume BB/GB4";
const F5 = "Fig. 5 — tout bitume BB/EME2";
const F6 = "Fig. 6 — mixte BB/GB3/GC";
const F6B = "Fig. 6bis — mixte BB/GB3/SC";
const F7 = "Fig. 7 — béton BAC/BM";

const FIG1_PF2 = [
  ["t4-", "BB:7/BB:7/GNT:25"],
  ["t3-", "BB:7/BB:7/GNT:25"],
  ["t3+", "BB:7/BB:7/GNT:25"],
  ["t2-", "BB:7/GB4:9/GNT:25"],
  ["t2+", "BB:7/GB4:11/GNT:25"],
  ["t1-", "BB:7/GB4:13/GNT:25"],
  ["t1+", "BB:7/GB4:15/GNT:25"],
];

const FIG1BIS_PF2 = [
  ["t4-", "BB:7/GB3:8/GNT:25"],
  ["t3-", "BB:7/GB3:8/GNT:25"],
  ["t3+", "BB:7/GB3:10/GNT:25"],
  ["t2-", "BB:7/GB3:13/GNT:25"],
  ["t2+", "BB:7/GB3:15/GNT:25"],
  ["t1-", "BB:7/GB3:8/GB3:9/GNT:25"],
  ["t1+", "BB:7/GB3:9/GB3:10/GNT:25"],
];

const FIG4_PF3 = [
  ["t4-", "BB:7/GB4:9"],
  ["t3-", "BB:7/GB4:9"],
  ["t3+", "BB:7/GB4:10"],
  ["t2-", "BB:7/GB4:12"],
  ["t2+", "BB:7/GB4:13"],
  ["t1-", "BB:7/GB4:14"],
  ["t1+", "BB:7/GB4:8/GB4:9"],
  ["t0-", "BB:7/GB4:9/GB4:10"],
  ["t0+", "BB:7/GB4:10/GB4:11"],
  ["ts-", "BB:7/GB4:11/GB4:12"],
  ["ts+", "BB:7/GB4:12/GB4:13"],
  ["tex-", "BB:7/GB4:13/GB4:14"],
  ["tex+", "BB:7/GB4:9/GB4:10/GB4:10"],
];

const FIG5_PF3 = [
  ["t2-", "BB:7/EME2:9"],
  ["t2+", "BB:7/EME2:10"],
  ["t1-", "BB:7/EME2:11"],
  ["t1+", "BB:7/EME2:12"],
  ["t0-", "BB:7/EME2:7/EME2:7"],
  ["t0+", "BB:7/EME2:7/EME2:8"],
  ["ts-", "BB:7/EME2:8/EME2:9"],
  ["ts+", "BB:7/EME2:9/EME2:9"],
  ["tex-", "BB:7/EME2:9/EME2:10"],
  ["tex+", "BB:7/EME2:10/EME2:11"],
];

const FIG6_PF2 = [
  ["t4-", "BB:7/GB3:10/GC:16"],
  ["t3-", "BB:7/GB3:10/GC:17"],
  ["t3+", "BB:7/GB3:10/GC:18"],
  ["t2-", "BB:7/GB3:12/GC:19"],
  ["t2+", "BB:7/GB3:12/GC:20"],
  ["t1-", "BB:7/GB3:14/GC:21"],
  ["t1+", "BB:7/GB3:14/GC:22"],
  ["t0-", "BB:7/GB3:14/GC:24"],
  ["t0+", "BB:7/GB3:14/GC:26"],
  ["ts-", "BB:7/GB3:14/GC:28"],
  ["ts+", "BB:7/GB3:14/GC:29"],
  ["tex-", "BB:7/GB3:14/GC:30"],
  ["tex+", "BB:7/GB3:14/GC:31"],
];

const FIG6BIS_PF2 = [
  ["t4-", "BB:7/GB3:12/SC:18"],
  ["t3-", "BB:7/GB3:12/SC:19"],
  ["t3+", "BB:7/GB3:12/SC:21"],
  ["t2-", "BB:7/GB3:12/SC:22"],
  ["t2+", "BB:7/GB3:14/SC:23"],
  ["t1-", "BB:7/GB3:14/SC:24"],
  ["t1+", "BB:7/GB3:14/SC:27"],
  ["t0-", "BB:7/GB3:14/SC:28"],
  ["t0+", "BB:7/GB3:14/SC:30"],
  ["ts-", "BB:7/GB3:14/SC:31"],
  ["ts+", "BB:7/GB3:14/SC:32"],
  ["tex-", "BB:7/GB3:14/SC:33"],
  ["tex+", "BB:7/GB3:14/SC:33"],
];

const FIG7_BAC = [18, 18, 18, 19, 19, 20, 21, 22, 23, 24, 25, 26, 27];

/** Les treize classes de trafic du manuel, de t4- à tex+. */
export const CLASSES_SCETAUROUTE = ["t4-", "t3-", "t3+", "t2-", "t2+", "t1-", "t1+", "t0-", "t0+", "ts-", "ts+", "tex-", "tex+"];

function construire() {
  const l = [];
  const surf = "Variantes surface : BBTM/BBDR/BBM (ajustements GB imprimés sur la figure).";

  for (const [tr, spec] of FIG1_PF2) {
    l.push(fiche(F1, "p-036", tr, "PF2", spec, "Réf. PF2. " + surf));
    l.push(fiche(F1, "p-036", tr, "PF2qs", corriger(spec, "GNT", -5), "PF23 : −5 cm GNT."));
    l.push(fiche(F1, "p-036", tr, "PF3", corriger(corriger(spec, "GB4", -2), "GNT", -5),
      "PF3 : −2 cm GB / −5 cm GNT. PF4 : voir fig. 2 (non encodée)."));
  }

  for (const [tr, spec] of FIG1BIS_PF2) {
    l.push(fiche(F1B, "p-037", tr, "PF2", spec, "Réf. PF2. " + surf));
    l.push(fiche(F1B, "p-037", tr, "PF2qs", corriger(spec, "GNT", -5), "PF23 : −5 cm GNT."));
    l.push(fiche(F1B, "p-037", tr, "PF3", corriger(corriger(spec, "GB3", -2), "GNT", -5),
      "PF3 : −2 cm GB / −5 cm GNT (même famille de corrections que fig. 1)."));
  }

  const fiss = "Anti-fissure si PF traitée : sable/limon/craie si chaussée < 18 cm ; grave si < 22 cm.";
  for (const [tr, spec] of FIG4_PF3) {
    l.push(fiche(F4, "p-042", tr, "PF3", spec, "Réf. PF3. " + fiss));
    l.push(fiche(F4, "p-042", tr, "PF2", corriger(spec, "GB4", 4), "PF2 : +4 cm (assise)."));
    l.push(fiche(F4, "p-042", tr, "PF2qs", corriger(spec, "GB4", 2), "PF23 : +2 cm (assise)."));
    l.push(fiche(F4, "p-042", tr, "PF4", corriger(spec, "GB4", -3), "PF4 : −3 cm (assise)."));
  }

  for (const [tr, spec] of FIG5_PF3) {
    l.push(fiche(F5, "p-044", tr, "PF3", spec, "Réf. PF3. t4 / t3− / t3+ absents du dessin. " + fiss));
    l.push(fiche(F5, "p-044", tr, "PF2", corriger(spec, "EME2", 4), "PF2 : +4 cm (assise)."));
    l.push(fiche(F5, "p-044", tr, "PF2qs", corriger(spec, "EME2", 2), "PF23 : +2 cm (assise)."));
    l.push(fiche(F5, "p-044", tr, "PF4", corriger(spec, "EME2", -3), "PF4 : −3 cm (assise)."));
  }

  for (const [tr, spec] of FIG6_PF2) {
    l.push(fiche(F6, "p-046", tr, "PF2", spec, "Réf. PF2. Interface anti-fissure GB/GC (membrane, hors couche)."));
    l.push(fiche(F6, "p-046", tr, "PF2qs", corriger(spec, "GC", -1), "PF23 : −1 cm GH."));
    l.push(fiche(F6, "p-046", tr, "PF3", corriger(spec, "GC", -3), "PF3 : −3 cm GH."));
  }

  for (const [tr, spec] of FIG6BIS_PF2) {
    l.push(fiche(F6B, "p-047", tr, "PF2", spec, "Réf. PF2. SH du dessin = sable-ciment (SC-t3)."));
    l.push(fiche(F6B, "p-047", tr, "PF2qs", corriger(spec, "SC", -3), "PF23 : −3 cm SH."));
    l.push(fiche(F6B, "p-047", tr, "PF3", corriger(spec, "SC", -5), "PF3 : −5 cm SH."));
  }

  CLASSES_SCETAUROUTE.forEach((tr, i) => {
    const spec = `BAC:${FIG7_BAC[i]}/BM:15`;
    l.push(fiche(F7, "p-048", tr, "PF2", spec,
      "Réf. PF2. Film polyane entre BAC et BM. Surface BBTM. BAC/BM hors bibliothèque de calcul Alizé."));
    l.push(fiche(F7, "p-048", tr, "PF2qs", corriger(spec, "BAC", -1), "PF23 : −1 cm BAC."));
    l.push(fiche(F7, "p-048", tr, "PF3", corriger(spec, "BAC", -2), "PF3 : −2 cm BAC."));
  });

  return l;
}

/** Les structures-types lues sur les figures du manuel. */
export const FICHES_SCETAUROUTE = construire();

export const REFERENCE_SCETAUROUTE =
  "Scetauroute (groupe Egis), Manuel de conception des chaussées d'autoroutes, 2005, "
  + "chap. 4 (figures lues). Document d'entreprise pour autoroutes concédées : le "
  + "catalogue de référence du réseau national est le catalogue SETRA-LCPC de 1998.";

/** Catalogue des autoroutes concédées, indexé par classe de trafic journalier (t4- à tex+). */
export const CATALOGUE_SCETAUROUTE = catalogueStructures({
  pays: "france", reference: REFERENCE_SCETAUROUTE, fiches: FICHES_SCETAUROUTE, cle: "classe-trafic",
});
