// Module « Renforcement » : le pendant de l'onglet Renforcement de Burmister-Calc,
// dans l'ordre de l'application — diagnostic (dommage déjà consommé, par l'une
// des trois voies), solution (proposée d'après le diagnostic, retenue par le
// projeteur, appliquée à la chaussée en place), apport (complexe de couches
// neuves dont l'une est cherchée par balayage puis affinage), puis comparaison
// avant / après. Les moteurs sont ceux du cours (chaussee/renforcement), portés
// à l'identique du C#.
//
// Table des couches : les `nApport` premières lignes sont l'apport, neuf
// (D = 0) ; les suivantes, la chaussée en place, sol compris. La colonne D y est
// le dommage PROPRE d'une couche : vide, elle prend le dommage global du
// diagnostic, que l'application applique à toutes les couches conservées, GNT et
// sol compris. Chaque couche conservée est vérifiée sous NE/(1 − D) ; l'apport,
// sous le trafic futur brut.

import { annexeFiches } from "../fiches.js";
import { fichesRetenues } from "../chaussee/pays/base.js";
import { construireApport } from "../chaussee/pays/commun.js";
import { etudier } from "../chaussee/dimensionnement.js";
import { profils as profilsEnProfondeur } from "../chaussee/burmister.js";
import { coupeChaussee, tableauSollicitations } from "../figures-chaussee.js";
import {
  esc, f, fd, nombre, pastille, OPT_INTERFACE, OPT_STRUCTURE, NOM_FAMILLE, CHAMPS_ESSIEU, essieuDe, texteEssieu,
  tableauStructure, texteCoefs, indicationsCouches, profilsDesCriteres, BLOC_CHAMPS, NOTE_CHAMPS, descChamps,
} from "./commun.js";
import { CHAMPS_TRAFIC, CHAMPS_CALCUL, optionsPays, optionsMateriaux, parametresDe, noteTrafic, noteVerif, valeursProposees } from "./dimensionnement.js";
import { dommageParMiner, dommageParEtat, dommageParVieResiduelle, phaseDommage, REFERENCE_DOMMAGE } from "../chaussee/renforcement/dommage.js";
import {
  classerDegradationTunisie, niveauDegradation, nomClasseDegradation, SILENCE_FISSURATION, SILENCE_ORNIERAGE,
  SEUIL_ORNIERAGE_MM,
} from "../chaussee/renforcement/tunisie-degradation.js";
import {
  baseDeCalcul, expliquerBase, proposerSolution, desaccordSolution, orientations, conseilSolution, nomSolution,
  traficEquivalent, CONSEILS_SOLUTIONS, SOLUTIONS_RENFORCEMENT, PROFONDEUR_DECOLLEMENT_HAUT_CM, REFERENCE_STRATEGIE,
} from "../chaussee/renforcement/strategie.js";
import { appliquerTravaux, besoinProfondeur, epaisseurEnlevableCm, EPAISSEUR_MINIMALE_RESTANTE_M } from "../chaussee/renforcement/travaux-existant.js";
import { chercherEpaisseurAffinee, epaisseurMinimaleCm, NOTE_SANS_CATALOGUE, RESERVE_MINIMA } from "../chaussee/renforcement/recherche-epaisseur.js";
import {
  REFERENCE_SENEGAL, decrireModeleSct, NOTE_SCT3, risqueSct3, NOTE_RISQUE_SENEGAL, epaisseurMinimaleRoulement,
  HORS_TABLEAUX_SENEGAL,
} from "../chaussee/renforcement/senegal.js";
import {
  classerDeflexionCerema, classerRayonCerema, niveauDeflexionCerema, niveauRayonCerema, motNiveau, RESERVE_LECTURE_CEREMA,
} from "../chaussee/renforcement/baremes-deflexion.js";
// Les modules Auscultation et Rétrocalcul exposent, quand ils le peuvent, ce que le
// renforcement leur emprunte (syntheseAuscultation, lignesEnPlace) : importés sous garde,
// leur absence laisse le module calculer seul.
import * as ausc from "./auscultation.js";
import * as retro from "./retrocalcul.js";

export const DEFAUT_RENFORCEMENT = [
  { nom: "Rechargement", materiau: "BBSG1", h: "8", E: "", nu: "", interface: "collee", dommage: "" },
  { nom: "Enrobés anciens", materiau: "BBSG1", h: "6", E: "2500", nu: "", interface: "semi-collee", dommage: "" },
  { nom: "Grave-bitume en place", materiau: "GB3", h: "15", E: "4500", nu: "", interface: "collee", dommage: "" },
  { nom: "GNT en place", materiau: "GNT2", h: "25", E: "250", nu: "", interface: "collee", dommage: "" },
  { nom: "Sol support", materiau: "PF2", h: "", E: "60", nu: "", interface: "collee", dommage: "" },
];

const OUI_NON = [["non", "non"], ["oui", "oui"]];
const NIVEAUX = ["bon", "moyen", "mauvais"];
const OPT_VOIE = [["forfait", "Forfait d'après l'état global (Cli)"], ["miner", "Cumul de Miner sur l'historique"],
  ["residuel", "Vie résiduelle de la structure en place"]];
const OPT_SOLUTION = CONSEILS_SOLUTIONS.map((c) => [c.solution, c.nom]);
const OPT_ASSISE_SN = [["bitumineuse", "assise en matériaux bitumineux (tab. 23)"], ["hydraulique", "assise traitée aux liants hydrauliques (tab. 24)"],
  ["non-liee", "assise non traitée, chaussée souple (tab. 25)"], ["laterite-ciment", "base en grave latéritique améliorée au ciment (tab. 26)"]];
const PHASES_EXEMPLE = "2004-2013 ; 2100000 ; 4800000\n2013-2025 ; 3400000 ; 9200000";
const PAYS_FORFAIT = ["tunisie", "tunisie1984"];

const forfait = (v) => (v.voie ?? "forfait") === "forfait";
const releves = (v) => forfait(v) && v.releves === "oui";
const cherche = (v) => v.chercher !== "non";
const cm = (x) => f(x, 4);

// ─────────────────────────── Emprunts aux autres modules ──────────────────

/** Synthèse du module Auscultation (contrat syntheseAuscultation), ou null. */
export function syntheseAusc(ctx) {
  try {
    const s = ausc.syntheseAuscultation?.(ctx.valeurs?.("auscultation")) ?? null;
    return s && s.disponible !== false ? s : null;
  } catch { return null; }
}

/** Lignes en place calées par le Rétrocalcul (contrat lignesEnPlace), ou null. */
function lignesCalees(ctx) {
  try {
    const l = retro.lignesEnPlace?.(ctx.valeurs?.("retrocalcul"), ctx);
    return Array.isArray(l) && l.length ? l : null;
  } catch { return null; }
}

/** Champs repris du module Trafic (bouton « Reprendre le trafic »), ou null. */
export function traficDepuisModule(vt) {
  if (!vt) return null;
  const r = {};
  for (const k of ["pays", "mja", "taux", "annees", "periodes", "camBit", "camHyd", "camSol"]) if (vt[k] != null) r[k] = vt[k];
  return Object.keys(r).length ? r : null;
}

// ─────────────────────────────── Lecture ──────────────────────────────────

/** Nombre de premières lignes qui sont l'apport (au moins 1). */
export const nombreApport = (v) => Math.max(1, Math.round(nombre(v.nApport, 1)) || 1);

/** Ligne de l'apport dont l'épaisseur est cherchée : celle choisie, sinon la plus profonde. */
function indiceCherche(v, n) {
  const d = v.dim === "" || v.dim == null ? NaN : Number(v.dim);
  return Number.isInteger(d) && d >= 0 && d < n ? d : n - 1;
}

const familleDe = (profil, l) => (l?.materiau ? profil.materiau(l.materiau)?.famille ?? null : null);

/** Lignes du tableau, contrôlées (épaisseurs en m). La couche cherchée peut rester sans épaisseur. */
function lireLignes(lignes, n, iCherche) {
  return lignes.map((c, i) => {
    const derniere = i === lignes.length - 1;
    const hCm = nombre(c.h);
    if (!derniere && !(hCm > 0) && i !== iCherche) throw new Error(`couche ${i + 1} : épaisseur à saisir`);
    const E = nombre(c.E), nu = nombre(c.nu), D = nombre(c.dommage);
    if (D < 0) throw new Error(`couche ${i + 1} : le dommage D ne peut pas être négatif`);
    return { ligne: i, apport: i < n, nom: c.nom || c.materiau || `couche ${i + 1}`, materiau: c.materiau || null,
      h: derniere ? Infinity : hCm / 100, E: E > 0 ? E : undefined, nu: nu > 0 ? nu : undefined,
      interface: c.interface || "collee", Dpropre: Number.isFinite(D) ? D : null };
  });
}

/** Phases de l'historique : « libellé ; NE subis ; NE de durée de vie » (le libellé peut manquer). */
function lirePhases(texte) {
  return String(texte ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l, k) => {
    const m = l.split(/[;\t]/).map((x) => x.trim());
    const [lib, subis, vie] = m.length >= 3 ? m : ["", ...m];
    const a = nombre(subis), b = nombre(vie);
    if (m.length < 2 || !(a >= 0) || !(b > 0)) throw new Error(`phase « ${l} » : écrire « libellé ; NE subis ; NE de durée de vie »`);
    return phaseDommage(lib || `Phase ${k + 1}`, a, b);
  });
}

/**
 * Matériau retraité par défaut : la 1re fiche hydraulique du pays qui soit un MTLH — la
 * bibliothèque française commence par les bétons (BC2…), dont la loi ne convient pas à une
 * assise retraitée en place.
 */
const mtlhParDefaut = (profil) => {
  const h = profil.materiaux.hydrauliques ?? [];
  return (h.find((m) => !/^(BC|BAC)/i.test(m.cle)) ?? h[0])?.cle ?? null;
};

/** La couche reconstituée par un retraitement : MTLH du pays à défaut, 3000 MPa, neuve. */
function coucheRetraitee(v, profil) {
  const cle = v.retraiteMateriau && profil.materiau(v.retraiteMateriau) ? v.retraiteMateriau : mtlhParDefaut(profil);
  const E = nombre(v.retraiteE);
  return { ligne: null, apport: false, retraitee: true, nom: "Assise retraitée", materiau: cle, E: E > 0 ? E : 3000, nu: undefined,
    interface: "collee", Dpropre: 0, dommage: 0 };
}

// ─────────────────────────────── Diagnostic ───────────────────────────────

/**
 * Ce que la structure en place peut encore porter, en inversant les lois d'admissible
 * (manuel CEBTP 1985, annexe II) : pour chaque critère, NE restant = NE × taux^(1/b) ; le plus
 * petit gouverne. Rendu en essieux équivalents bitumineux, pour se comparer au trafic futur.
 * Null pour une méthode déterministe, dont les admissibles ne dépendent pas du trafic.
 */
export function capaciteRestante(etude) {
  if (etude.deterministe) return null;
  let m = null;
  for (const x of etude.verification.verifs) {
    if (!x.applicable || !(x.taux > 0)) continue;
    const b = x.famille === "sol" ? x.coefs?.pente : x.coefs?.b;
    if (!(b < 0)) continue;
    const rapport = (x.taux / 100) ** (1 / b);
    if (!m || rapport < m.rapport) m = { rapport, verif: x };
  }
  return m && { ...m, ne: m.rapport * etude.ne.bitumineux };
}

/** Niveau de déflexion proposé par l'auscultation (bon / moyen / mauvais), ou null. */
const niveauAusc = (a) => (NIVEAUX.includes(a?.niveauD) ? a.niveauD : null);

function libelleVoie(voie, pays, { note = false } = {}) {
  if (voie === "miner") return "cumul de Miner sur l'historique (Cerema § 2.1.3)";
  if (voie === "residuel") return "vie résiduelle de la structure en place (CEBTP 1985)";
  return PAYS_FORFAIT.includes(pays) ? "forfait d'après l'état global Cli (fascicule 6 tunisien, tab. 9 et 10)"
    : `forfait d'après l'état global Cli — table du fascicule 6 tunisien (tab. 9 et 10)${note ? ", employée ici à défaut d'équivalent national : le référentiel retenu ne publie pas de barème de dommage forfaitaire" : ", empruntée"}`;
}

/** Dommage global du diagnostic, par la voie choisie, avec ses étapes et ses réserves. */
function diagnostiquer(v, profil, avant, a) {
  const voie = ["miner", "residuel"].includes(v.voie) ? v.voie : "forfait";
  const neFutur = avant.ne.bitumineux;
  const r = { voie, avant: [], reserves: [], niveauDeflexion: null, releves: null, capacite: null, phases: null, neRestant: null, emprunt: null };
  if (voie === "miner") {
    r.phases = lirePhases(v.phases);
    r.dom = dommageParMiner(r.phases, v.nonLiee === "oui");
  } else if (voie === "residuel") {
    r.capacite = capaciteRestante(avant);
    const saisi = nombre(v.neRestant);
    r.neRestantPropose = !(saisi > 0);
    r.neRestant = saisi > 0 ? saisi : r.capacite?.ne ?? NaN;
    if (r.neRestantPropose && r.capacite) {
      const x = r.capacite.verif;
      r.avant.push(`NE restant proposé en inversant les lois d'admissible sur la structure en place : « ${x.nom} », ${x.critere.toLowerCase()}, `
        + `taux ${fd(x.taux, 0)} % sous le trafic futur → ${f(r.capacite.ne, 4)} essieux équivalents.`);
    } else if (r.neRestantPropose) {
      r.reserves.push(avant.deterministe
        ? "Méthode déterministe : ses contraintes admissibles ne dépendent pas du trafic, la vie résiduelle ne s'en déduit pas — saisir le NE restant."
        : "Aucun critère applicable sur la structure en place : saisir le NE restant.");
    }
    r.dom = dommageParVieResiduelle(r.neRestant, neFutur);
  } else {
    const nivA = niveauAusc(a);
    const choisi = NIVEAUX.includes(v.niveauDeflexion) ? v.niveauDeflexion : null;
    const niv = choisi ?? nivA ?? "moyen";
    r.niveauDeflexion = { valeur: niv, source: choisi ? "saisi" : nivA ? "auscultation" : "defaut" };
    if (!choisi) r.avant.push(nivA
      ? `Niveau de déflexion proposé par l'auscultation : ${niv}${a.classeD ? ` (classe ${a.classeD})` : ""}.`
      : "Niveau de déflexion : moyen, valeur par défaut de l'application faute d'auscultation — à choisir.");
    let deg = NIVEAUX.includes(v.niveauDegradation) ? v.niveauDegradation : "moyen";
    if (v.releves === "oui") {
      const fi = nombre(v.fissuration), or = nombre(v.ornierage), pr = nombre(v.profondeurOrniere);
      if (![fi, or, pr].every((x) => x >= 0)) throw new Error("relevés de surface : fissuration (%), orniérage (%) et profondeur d'ornière (mm) à saisir");
      r.releves = classerDegradationTunisie(fi, v.fissBandes !== "non", or, pr);
      deg = niveauDegradation(r.releves.classe);
      r.avant.push(...r.releves.etapes);
      if (v.fissBandes === "non" && fi < 20) r.reserves.push(SILENCE_FISSURATION);
      if (pr < SEUIL_ORNIERAGE_MM) r.reserves.push(SILENCE_ORNIERAGE);
    }
    r.dom = dommageParEtat(niv, deg, v.interfacesDecollees === "oui");
    if (!PAYS_FORFAIT.includes(profil.id))
      r.emprunt = `La voie forfaitaire est une table tunisienne (fascicule 6, tableaux 9 et 10${r.releves ? ", relevés des tableaux 1 à 3" : ""}), `
        + `employée ici à défaut d'équivalent national : ${profil.nom} ne publie pas de barème de dommage forfaitaire.`;
  }
  return r;
}

// ──────────────────────── Réserve du § 5.2.1.2 du guide ───────────────────

export const RESERVE_APPORT_BITUMINEUX =
  "Réserve du guide (§ 5.2.1.2) : le critère de traction à la base d'un rechargement en matériaux bitumineux n'est PAS "
  + "dimensionnant, en raison du collage du rechargement sur l'ancienne chaussée. Il est calculé et affiché à titre "
  + "d'information. Un rechargement en matériaux traités aux liants hydrauliques obéit à la règle inverse : c'est alors "
  + "la contrainte à sa base qui dimensionne, avec un kc majoré de 15 %.";

/**
 * Marque « informative » la fatigue des couches d'apport bitumineuses (méthode rationnelle) :
 * elle reste au tableau, mais sort du verdict et du critère dimensionnant.
 */
function appliquerReserve(verification, couches, estApport) {
  const verifs = verification.verifs.map((x) => (x.applicable && x.grandeur === "epsT" && couches[x.couche]?.famille === "bitumineux" && estApport(couches[x.couche])
    ? { ...x, informatif: true } : x));
  const dims = verifs.filter((x) => x.applicable && !x.informatif);
  return { ...verification, verifs, ok: dims.every((x) => x.ok), dimensionnant: dims.reduce((m, x) => (!m || x.taux > m.taux ? x : m), null) };
}

const detailEssai = (verification) => {
  const d = verification.dimensionnant;
  return d ? `${d.nom} : ${d.critere.toLowerCase()}, ${fd(d.taux, 0)} %` : null;
};

// ─────────────────────────────── Calcul ───────────────────────────────────

/**
 * Toute l'étude de renforcement, sans mise en forme : diagnostic, solution, travaux,
 * recherche de l'épaisseur, vérification retenue, avant / après.
 */
export function analyserRenforcement(v, ctx) {
  const profil = ctx.profils.get(v.pays);
  if (!profil) throw new Error(`référentiel « ${v.pays} » indisponible`);
  const p = parametresDe(v, "renforcement");
  const essieu = essieuDe(v);
  const n = nombreApport(v);
  if (n > v.couches.length - 2)
    throw new Error(`apport de ${n} couche(s) : il faut au moins une couche en place et le sol support sous l'apport (le tableau compte ${v.couches.length} lignes)`);
  const chercher = cherche(v);
  const iCherche = indiceCherche(v, n);
  const lignes = lireLignes(v.couches, n, chercher ? iCherche : -1);
  const alertes = [];

  // L'apport est neuf : il n'a rien consommé, quoi qu'on ait écrit dans sa colonne D.
  const apport = lignes.slice(0, n).map((l) => {
    if (l.Dpropre > 0) alertes.push(`Ligne ${l.ligne + 1} (${l.nom}) : couche d'apport, neuve — son D saisi (${f(l.Dpropre, 3)}) est ignoré.`);
    return { ...l, dommage: 0 };
  });
  const enPlace0 = lignes.slice(n);

  // La chaussée telle qu'elle est aujourd'hui, sans dommage : d0 et Rc d'avant, et capacité restante.
  // Une erreur de saisie y est rapportée au numéro de sa ligne dans le tableau.
  let avant;
  try { avant = etudier({ profil, p, saisie: enPlace0.map((l) => ({ ...l, dommage: 0 })), essieu }); }
  catch (e) { throw new Error(e.message.replace(/^couche (\d+)/, (_, k) => `couche ${Number(k) + n}`)); }
  const a = syntheseAusc(ctx);
  const diag = diagnostiquer(v, profil, avant, a);
  const Dg = diag.dom.consomme;
  const enPlace = enPlace0.map((l) => ({ ...l, dommage: l.Dpropre ?? (Number.isFinite(Dg) ? Math.max(0, Dg) : 0), Dglobal: l.Dpropre == null }));
  const dConnu = Number.isFinite(Dg) || enPlace0.some((l) => l.Dpropre != null);
  const dommages = enPlace.map((l) => l.dommage);

  // Ce vers quoi le diagnostic oriente : une seule couche à la ruine change la base du calcul.
  // Besoin structurel : un dommage consommé (règle de l'application), ou, tous les D étant
  // nuls, une chaussée en place qui ne tient pas le trafic futur.
  const base = baseDeCalcul(dommages);
  const besoin = Math.max(...dommages) > 0 || !avant.verification.ok;
  const haut = v.decollementHaut === "oui", seuil = v.contrainteSeuil === "oui";
  const proposition = dConnu ? proposerSolution(base, haut, seuil, besoin) : null;
  const solution = SOLUTIONS_RENFORCEMENT.includes(v.solution) ? v.solution : "rechargement";
  const desaccord = proposition ? desaccordSolution(solution, proposition) : null;
  const notes = dConnu ? orientations(base, haut, seuil, besoin) : [];

  // La solution retenue s'applique à la chaussée en place AVANT qu'on y pose l'apport.
  const retraitee = solution === "retraitement" ? coucheRetraitee(v, profil) : null;
  const enlevable = epaisseurEnlevableCm(enPlace);
  const travaux = appliquerTravaux(enPlace, solution, nombre(v.profondeur, 0), retraitee);

  // Recherche de l'épaisseur : chaque essai est une étude complète de la structure renforcée.
  const famCherchee = familleDe(profil, apport[iCherche]);
  const minFamille = epaisseurMinimaleCm(famCherchee);
  const hMinSaisi = nombre(v.hMin);
  const hMin = hMinSaisi > 0 ? hMinSaisi : minFamille;
  const hDefaut = apport[iCherche].h > 0 ? apport[iCherche].h * 100 : hMin;
  const memo = new Map();
  const essayer = (hCm) => {
    const cle = Math.round(hCm * 1e6) / 1e6;
    if (!memo.has(cle)) {
      const saisie = [...apport.map((l, i) => (i === iCherche ? { ...l, h: cle / 100 } : l)), ...travaux.couches];
      const etude = etudier({ profil, p, saisie, essieu });
      const verification = appliquerReserve(etude.verification, etude.couches, (c) => saisie[c.source]?.apport === true);
      memo.set(cle, { saisie, etude, verification });
    }
    return memo.get(cle);
  };
  const premier = essayer(chercher ? hMin : hDefaut);
  const aucunCritere = premier.verification.verifs.every((x) => !x.applicable || x.informatif);
  let recherche = null, bornes = null, hRetenue = null;
  if (chercher && !aucunCritere) {
    const hMax = nombre(v.hMax, 30), pas = nombre(v.pas, 1);
    if (!(pas > 0)) throw new Error("recherche de l'épaisseur : pas à saisir (cm)");
    if (!(hMax >= hMin)) throw new Error(`recherche de l'épaisseur : maximum (${cm(hMax)} cm) inférieur au minimum (${cm(hMin)} cm)`);
    bornes = { hMin, hMax, pas, pasLarge: Math.max(pas, 2), minFamille, minSaisi: hMinSaisi > 0 };
    recherche = chercherEpaisseurAffinee((h) => {
      const x = essayer(h);
      return { ok: x.verification.ok, detail: detailEssai(x.verification), verification: x.verification };
    }, hMin, hMax, bornes.pasLarge, pas);
    hRetenue = recherche.trouve ? recherche.epaisseurCm : null;
    if (hMinSaisi > 0 && hMinSaisi < minFamille)
      alertes.push(`Épaisseur minimale essayée ${cm(hMinSaisi)} cm, sous le minimum constructif de la famille (${cm(minFamille)} cm).`);
  }
  const hFinale = bornes ? hRetenue ?? bornes.hMax : hDefaut;
  const final = essayer(hFinale);
  const { saisie, etude, verification } = final;
  const dims = verification.verifs.filter((x) => x.applicable && !x.informatif);
  const taux = dims.length ? Math.max(...dims.map((x) => x.taux)) : NaN;
  const verdict = aucunCritere ? null : bornes ? hRetenue != null && verification.ok : verification.ok;

  // Alertes de saisie : couches sans loi (A0), GNT en place sans module (B5), minima, ordre.
  const presentes = new Set(saisie.map((s) => s.ligne));
  lignes.forEach((l, i) => {
    if (!presentes.has(i) || familleDe(profil, l)) return;
    const support = i === lignes.length - 1;
    if (support && profil.fatigueRationnelle === false) return;
    alertes.push(support
      ? `Ligne ${i + 1} (${l.nom}) : sol support sans matériau du référentiel — couche sans loi, sa déformation verticale n'est pas vérifiée.`
      : `Ligne ${i + 1} (${l.nom}) : couche sans loi, non vérifiée — ${l.materiau ? `matériau « ${l.materiau} » absent de ce référentiel` : "aucun matériau du référentiel n'est choisi"}, seul son module entre dans le calcul.`);
  });
  if (retraitee && !familleDe(profil, retraitee))
    alertes.push("Assise retraitée : ce référentiel n'a pas de matériau traité à lui associer — couche sans loi, non vérifiée.");
  enPlace0.forEach((l) => {
    if (l.ligne === lignes.length - 1 || l.E > 0 || familleDe(profil, l) !== "sol" || !presentes.has(l.ligne)) return;
    const E = etude.couches.filter((c) => saisie[c.source]?.ligne === l.ligne).map((c) => f(c.E, 3));
    alertes.push(`Ligne ${l.ligne + 1} (${l.nom}) : grave non traitée en place sans « E en place » — le calcul retient ${E.join(" / ")} MPa `
      + "(règle des chaussées neuves, proposé en gris). Saisir le module en place, calé au rétrocalcul ou pris dans un barème.");
  });
  apport.forEach((l, i) => {
    if (bornes && i === iCherche) return;
    const fam = familleDe(profil, l), mini = epaisseurMinimaleCm(fam);
    const h = i === iCherche ? hFinale : l.h * 100;
    if (h < mini - 1e-9) alertes.push(`Ligne ${i + 1} (${l.nom}) : ${cm(h)} cm, sous le minimum constructif de sa famille (${cm(mini)} cm).`);
  });
  const ordre = n >= 2 && iCherche === 0
    ? `« ${apport[0].nom} » est la couche dont l'épaisseur est cherchée, et elle est posée EN SURFACE. Une assise structurante se couvre `
      + "normalement d'une couche de roulement : vérifiez l'ordre des lignes d'apport. Le tableau se lit de la surface vers la profondeur, "
      + "et cet ordre est celui de la chaussée — il change les sollicitations de chaque couche."
    : null;
  if (etude.deterministe) alertes.push("Référentiel déterministe (contraintes admissibles) : le dommage consommé oriente la solution, mais n'entre pas dans les admissibles.");
  if (travaux.couches.some((c) => c.dommage >= 1))
    alertes.push("Une couche conservée a un dommage de 1 : elle n'a plus de capital, et aucune épaisseur d'apport ne la rattrape. "
      + "Décaisser ou retraiter ce qui est à la ruine, ou lui donner son propre D (colonne D) si le diagnostic le permet.");
  alertes.push(...etude.alertes);

  return {
    profil, p, essieu, n, iCherche, chercher, lignes, apport, enPlace, a, avant, diag, base, besoin, dConnu, proposition,
    solution, desaccord, notes, retraitee, enlevable, travaux, famCherchee, minFamille, recherche, bornes, hRetenue, hFinale,
    saisie, etude, verification, aucunCritere, taux, verdict, alertes, ordre,
    apres: verdict === null || !bornes || hRetenue != null ? { d0: etude.analyse.deflexionEntreJumelage, rdc: etude.analyse.rdc } : null,
  };
}

// ─────────────────────────── Reprises et écritures ────────────────────────

/** Lignes de la structure renforcée, posées pour un second temps (bouton « Poser… »). */
export function lignesPosees(v, R) {
  const enCm = (h) => String(Math.round(h * 1000) / 10);
  const enPlace = (nom) => (/\(en place\)$/.test(nom) ? nom : `${nom} (en place)`);
  const posees = v.couches.slice(0, R.n).map((l, i) => ({ ...l, nom: enPlace(l.nom || l.materiau || "Apport"),
    h: i === R.iCherche ? String(R.hFinale) : l.h, dommage: "0" }));
  const reste = R.travaux.couches.map((c) => {
    const support = !Number.isFinite(c.h);
    if (c.ligne == null) return { nom: c.nom, materiau: c.materiau ?? "", h: enCm(c.h), E: String(c.E), nu: "", interface: c.interface ?? "collee", dommage: "0" };
    return { ...v.couches[c.ligne], h: support ? "" : enCm(c.h), dommage: String(Math.round(c.dommage * 1000) / 1000) };
  });
  return [...v.couches.slice(0, R.n).map((l) => ({ ...l })), ...posees, ...reste];
}

/**
 * Lignes du module d'après une fiche de renforcement du catalogue : les couches de la fiche
 * posées en apport (construireApport) au-dessus de la chaussée en place du module.
 * Renvoie { lignes, nApport, manquants }.
 */
export function lignesDepuisFiche(fiche, profil, vr) {
  const actuelles = vr?.couches?.length ? vr.couches : DEFAUT_RENFORCEMENT;
  const n = Math.min(nombreApport(vr ?? {}), actuelles.length - 2);
  const enPlace = actuelles.slice(Math.max(1, n)).map((l) => ({ ...l }));
  const { couches, manquants } = construireApport(profil, fiche, enPlace);
  const k = fiche.couches.length;
  const apport = couches.slice(0, k).map((c, i) => {
    const cle = c.materiau && profil.materiau(c.materiau) ? c.materiau : "";
    return { nom: c.nom, materiau: cle, h: String(fiche.couches[i].epCm), E: cle ? "" : String(c.E), nu: "", interface: c.interface ?? "collee", dommage: "0" };
  });
  return { lignes: [...apport, ...couches.slice(k)], nApport: k, manquants };
}

// ─────────────────────────────── Options ──────────────────────────────────

function optionsNiveauDeflexion(v, ctx) {
  const nivA = niveauAusc(syntheseAusc(ctx));
  return [["", nivA ? `${nivA} — proposé par l'auscultation` : "moyen — par défaut, sans auscultation"], ...NIVEAUX.map((x) => [x, x])];
}

function optionsNApport(v) {
  const max = Math.max(1, v.couches.length - 2, nombreApport(v));
  return Array.from({ length: max }, (_, k) => [String(k + 1), k === 0 ? "1 — la 1re ligne" : `${k + 1} — lignes 1 à ${k + 1}`]);
}

function optionsCherchee(v) {
  const n = Math.min(nombreApport(v), v.couches.length - 1);
  return [["", `la plus profonde de l'apport (ligne ${n})`], ...v.couches.slice(0, n).map((c, i) => [String(i), `${i + 1} · ${c.nom || c.materiau || "couche"}`])];
}

function optionsRetraitee(v, ctx) {
  const profil = ctx.profils.get(v.pays);
  const cle = profil ? mtlhParDefaut(profil) : null;
  return [["", cle ? `1re fiche MTLH du pays — ${cle}` : "— aucun matériau traité au référentiel —"], ...optionsMateriaux(v, ctx).slice(1)];
}

// ─────────────────────────────── Rendu ────────────────────────────────────

const piege = (titre, lignes) => (lignes.length ? `<div class="piege"><strong>${esc(titre)}</strong>${lignes.map((x) => `<p>${esc(x)}</p>`).join("")}</div>` : "");
const liste = (lignes) => (lignes.length ? `<ul class="notions">${lignes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");

/** Le complexe d'apport en clair : « 6 cm BBSG1 + 11 cm GB3 (cherchée) = 17 cm au total ». */
function texteComplexe(R) {
  const nomDe = (l) => l.materiau ?? l.nom;
  const parties = R.apport.map((l, i) => (R.bornes && i === R.iCherche
    ? `${R.hRetenue != null ? cm(R.hRetenue) : "?"} cm ${nomDe(l)} (cherchée)` : `${cm(i === R.iCherche ? R.hFinale : l.h * 100)} cm ${nomDe(l)}`));
  const total = R.apport.reduce((s, l, i) => s + (i === R.iCherche ? R.hFinale : l.h * 100), 0);
  return `${R.apport.length} couche${R.apport.length > 1 ? "s" : ""} d'apport, ${parties.join(" + ")}${!R.bornes || R.hRetenue != null ? ` = ${cm(total)} cm au total` : ""}`;
}

/** D, disponible et trafic majoré, en une phrase. */
function texteDommage(R) {
  const d = R.diag.dom;
  if (!Number.isFinite(d.consomme)) return "Dommage non calculable en l'état : les couches sans D propre ne sont pas majorées.";
  const ne = R.etude.ne.bitumineux;
  return `Dommage consommé D = ${f(d.consomme, 3)}, disponible ${f(d.disponible, 3)}. ${d.disponible > 0
    ? `Une couche conservée se vérifie donc sous NE/(1 − D) = ${f(ne, 4)}/${f(d.disponible, 3)} = ${f(traficEquivalent(ne, d.consomme), 4)} essieux équivalents.`
    : "Il ne reste rien à consommer."}`;
}

/** « Le diagnostic oriente vers… », le bouton qui retient la proposition, et l'écart s'il y en a un. */
function htmlProposition(R) {
  const p = R.proposition;
  if (!p) return `<p class="method-note">Dommage inconnu : le diagnostic n'oriente vers aucune solution.</p>`;
  return `<p>Le diagnostic oriente vers « <strong>${esc(p.nom)}</strong> » — ${esc(p.pourquoi)}${p.solution !== R.solution
    ? ` <button class="secondary" data-retenir-solution>Retenir cette solution</button>` : ""}</p>${R.desaccord ? piege("Écart au diagnostic", [R.desaccord]) : ""}`;
}

/** Origine d'une couche calculée : apport, retraitée, ou conservée avec son dommage. */
function origineDe(R, c) {
  const s = R.saisie[c.source];
  if (s?.apport) return "apport, neuve";
  if (s?.retraitee) return "retraitée, neuve";
  return `conservée, D ${f(c.dommage ?? 0, 3)}${s?.Dglobal ? " (global)" : ""}`;
}

/** Vérifications de la structure renforcée : origine de chaque couche, critères informatifs à part. */
function tableauRenforce(R) {
  const v = R.verification, cs = R.etude.couches;
  const u = (x) => (x.unite === "bar" ? "bar" : x.unite);
  const ch = (x) => (x.unite === "MPa" || x.unite === "bar" ? 3 : 4);
  return `<table class="resultats tableau-verifs"><thead><tr><th>Couche</th><th>Critère</th><th class="num">Sollicitation</th><th class="num">Admissible</th><th class="num">Taux</th><th>Verdict</th></tr></thead><tbody>
    ${v.verifs.map((x) => {
      const detail = [x.informatif ? "§ 5.2.1.2 : information, non dimensionnant" : null, x.motif,
        [texteCoefs(x.coefs), x.neApplique > 0 ? `NE = ${f(x.neApplique, 3)}` : ""].filter(Boolean).join(" · ")].filter(Boolean);
      return `<tr class="${x.applicable && !x.informatif ? (x.ok ? "" : "ko") : "ecarte"}${v.dimensionnant === x ? " ligne-retenue" : ""}">
        <td>${esc(x.nom)}<small>${esc(origineDe(R, cs[x.couche] ?? {}))}</small></td><td>${esc(x.critere)}${detail.map((t) => `<small>${esc(t)}</small>`).join("")}</td>
        <td class="q">${x.applicable ? `${f(x.sollicitation, ch(x))} ${esc(u(x))}` : "—"}</td>
        <td class="q">${x.applicable ? `${f(x.admissible, ch(x))} ${esc(u(x))}` : "—"}</td>
        <td class="q">${x.applicable ? `${fd(x.taux, 0)} %` : "—"}</td>
        <td>${x.informatif ? `<span class="verdict na">information</span>` : x.applicable ? pastille(x.ok) : pastille(null)}</td></tr>`;
    }).join("")}
  </tbody></table>`;
}

/**
 * Avant / après : déflexion entre jumelage et rayon de courbure calculés, classes du Cerema
 * regroupées en bon / moyen / médiocre, et la mesure de l'auscultation quand elle existe.
 */
export function tableauAvantApres(avant, apres, mesure) {
  const ligne = (titre, x, note) => {
    if (!x || !Number.isFinite(x.d0)) return "";
    const cd = classerDeflexionCerema(x.d0), cr = Number.isFinite(x.rdc) ? classerRayonCerema(x.rdc) : null;
    return `<tr><td>${esc(titre)}${note ? `<small>${esc(note)}</small>` : ""}</td><td class="num">${fd(x.d0, 1)}</td>
      <td class="motif">${cd ? `${cd.nom} — ${motNiveau(niveauDeflexionCerema(cd.nom))}` : "—"}</td>
      <td class="num">${Number.isFinite(x.rdc) ? f(x.rdc, 4) : "—"}</td><td class="motif">${cr ? `${cr.nom} — ${motNiveau(niveauRayonCerema(cr.nom))}` : "—"}</td></tr>`;
  };
  const gain = apres && avant?.d0 > 0 ? (1 - apres.d0 / avant.d0) * 100 : NaN;
  return `<table class="resultats"><thead><tr><th></th><th class="num">d0 (1/100 mm)</th><th>Classe</th><th class="num">Rc (m)</th><th>Classe</th></tr></thead><tbody>
      ${ligne("Avant renforcement", avant, "calculé, chaussée en place")}${ligne("Après renforcement", apres, "calculé, structure renforcée")}
      ${ligne("Mesuré", mesure, "auscultation, valeurs caractéristiques")}</tbody></table>
    ${Number.isFinite(gain) ? `<p>Réduction de la déflexion : 1 − ${fd(apres.d0, 1)}/${fd(avant.d0, 1)} = <strong>${fd(gain, 1)} %</strong> ; rayon de courbure ${f(avant.rdc, 4)} → ${f(apres.rdc, 4)} m.</p>` : ""}
    <p class="method-note">${esc(mesure?.resume && !/NaN|undefined/.test(mesure.resume) ? mesure.resume : "Aucune mesure dans le module Auscultation.")}</p>`;
}

/** Panneau des modèles SCT du guide sénégalais : risque du tableau 18, roulement minimal. */
function panneauSct(v, R) {
  const ne = R.etude.ne.bitumineux;
  const risque = risqueSct3(ne);
  const mini = epaisseurMinimaleRoulement(v.sctAssise || "bitumineuse", ne / 1e6);
  const hSurface = R.iCherche === 0 ? R.hFinale : R.apport[0].h * 100;
  return `<ul class="notions">${["sct1", "sct2", "sct3"].map((m) => `<li>${esc(decrireModeleSct(m))}</li>`).join("")}</ul>
    <p>${esc(NOTE_SCT3)}</p>
    <p>${risque != null ? `Risque proposé pour le modèle SCT3 : <strong>${f(risque, 3)} %</strong> (tableau 18, pour ${f(ne, 4)} essieux équivalents futurs) ; le calcul retient ${fd(R.etude.risque, 1)} %.`
      : `Le tableau 18 s'arrête à 100 millions d'essieux équivalents ; avec ${f(ne, 4)}, il ne propose pas de risque.`} <small>${esc(NOTE_RISQUE_SENEGAL)}</small></p>
    <p>${mini ? `Couche de roulement : au moins <strong>${cm(mini.epaisseurCm)} cm</strong> (${esc(mini.base)}, pour ${f(ne / 1e6, 3)} millions d'essieux).${mini.reserve ? ` <small>⚠ ${esc(mini.reserve)}</small>` : ""}`
      : `Aucune épaisseur minimale tabulée pour ${f(ne / 1e6, 3)} millions d'essieux avec cette assise. ${esc(HORS_TABLEAUX_SENEGAL)}`}</p>
    ${mini && hSurface < mini.epaisseurCm - 1e-9 ? piege("Roulement trop mince", [`La couche d'apport de surface fait ${cm(hSurface)} cm, sous les ${cm(mini.epaisseurCm)} cm du ${mini.base.toLowerCase()}.`]) : ""}
    <p class="method-note">${esc(REFERENCE_SENEGAL)}</p>`;
}

function rendreSynthese(v, R) {
  const { profil, etude, verification: ver, diag, proposition } = R;
  const dim = ver.dimensionnant;
  const tauxTxt = Number.isFinite(R.taux) ? ` · taux de travail maximal ${fd(R.taux, 0)} %${dim ? ` (${esc(dim.nom)})` : ""}` : "";
  const cherchee = R.apport[R.iCherche];
  const tete = R.aucunCritere
    ? `<p class="final-result bureau-verdict ko">Aucun critère dimensionnant : aucune couche de la structure renforcée ne porte de loi vérifiable — choisir le matériau des couches${
      profil.catalogueRenforcement ? ", ou lire le renforcement dans les fiches du référentiel (module Catalogue)" : ""}.</p>`
    : R.bornes
      ? `<p class="final-result bureau-verdict${R.verdict ? "" : " ko"}">${R.hRetenue != null
        ? `Épaisseur d'apport : <strong>${cm(R.hRetenue)} cm</strong> de ${esc(cherchee.materiau ?? cherchee.nom)}`
        : `Aucune épaisseur de ${cm(R.bornes.hMin)} à ${cm(R.bornes.hMax)} cm ne suffit`}${tauxTxt}</p>`
      : `<p class="final-result bureau-verdict${R.verdict ? "" : " ko"}">${pastille(R.verdict, "renforcement vérifié", "renforcement insuffisant")}${tauxTxt}</p>`;
  const voie = libelleVoie(diag.voie, profil.id);
  const diagHtml = `<h4>Diagnostic — dommage déjà consommé</h4>
    <p>${esc(voie[0].toUpperCase() + voie.slice(1))}.<br>${esc(texteDommage(R))}</p>
    <p class="method-note">${esc(expliquerBase(R.base, diag.voie))}${R.enPlace.some((l) => !l.Dglobal) ? " Les couches dont la colonne D est remplie portent leur propre dommage ; les autres, le dommage global (en gris)." : ""}</p>
    <details data-cle="renfo-dommage"><summary>Étapes et réserves du dommage</summary>
      ${liste([...diag.avant, ...diag.dom.etapes])}${piege("Réserves", [...(diag.emprunt ? [diag.emprunt] : []), ...diag.reserves, ...diag.dom.avertissements])}</details>`;
  const conseil = conseilSolution(R.solution);
  const solHtml = `<h4>Solution</h4>
    ${htmlProposition(R)}
    <p>Solution retenue : <strong>${esc(nomSolution(R.solution))}</strong>. ${esc(conseil?.quandChoisir ?? "")} <small>${esc(conseil?.reserve ?? "")}</small></p>
    ${liste(R.travaux.etapes)}${besoinProfondeur(R.solution) ? `<p class="method-note">Au plus ${cm(R.enlevable)} cm enlevables au-dessus du sol support (garde de ${cm(EPAISSEUR_MINIMALE_RESTANTE_M * 100)} cm).</p>` : ""}
    ${piege("Travaux sur l'existant", R.travaux.avertissements)}
    <details data-cle="renfo-orientations"><summary>Ce que le guide écarte, encourage ou impose</summary>${liste(R.notes)}</details>`;
  const essais = R.recherche ? `<details data-cle="renfo-essais"><summary>${R.recherche.nombreEssais} essai${R.recherche.nombreEssais > 1 ? "s" : ""} : balayage au pas de ${cm(R.bornes.pasLarge)} cm${R.bornes.pas < R.bornes.pasLarge ? `, affinage au pas de ${cm(R.bornes.pas)} cm` : ""}</summary>
      <ul class="notions">${R.recherche.essais.map((e) => `<li>${cm(e.epaisseurCm)} cm — ${e.ok ? "vérifie" : "ne vérifie pas"}${e.detail ? ` <small>(${esc(e.detail)})</small>` : ""}</li>`).join("")}</ul></details>` : "";
  const apportHtml = `<h4>Apport</h4>
    <p>${esc(texteComplexe(R))}.${R.bornes ? ` Minimum constructif de la couche cherchée (${esc(NOM_FAMILLE[R.famCherchee] ?? "famille non précisée")}) : ${cm(R.minFamille)} cm.` : ""}</p>
    ${essais}${piege("Recherche de l'épaisseur", [...(R.recherche?.avertissements ?? []), ...(R.ordre ? [R.ordre] : [])])}
    ${R.verdict === true ? `<div class="actions"><button class="ghost" id="poserRenforcee" title="Réécrit le tableau : l'apport à l'épaisseur retenue et la chaussée après travaux deviennent la chaussée en place, l'apport reste en tête pour un second temps">Poser la structure renforcée</button></div>` : ""}`;
  const pr = profilsEnProfondeur(etude.couches, R.essieu, { parCouche: 7 });
  return `${tete}
    <p class="method-note">${esc(profil.nom)}${etude.deterministe ? " — vérification par contraintes admissibles" : " — vérification rationnelle (NF P98-086)"} ·
      NE futur bitumineux ${f(etude.ne.bitumineux, 4)} · risque ${fd(etude.risque, 1)} %${etude.risquePropose ? " (proposé)" : ""} · θeq = ${f(etude.teq, 3)} °C</p>
    ${piege("Alertes", R.alertes)}
    ${diagHtml}${solHtml}${apportHtml}
    <h4>Vérification de la structure renforcée</h4>${tableauRenforce(R)}
    <p class="method-note">Les couches conservées sont vérifiées sous le trafic majoré de leur dommage, NE/(1 − D) ; l'apport, qui est neuf, sous le trafic futur.${ver.verifs.some((x) => x.informatif) ? " La fatigue de l'apport bitumineux est donnée à titre d'information (§ 5.2.1.2)." : ""}</p>
    <h4>Avant / après</h4>${R.apres ? "" : `<p class="method-note">Pas de structure renforcée retenue : seul l'état d'avant est donné.</p>`}${tableauAvantApres(
      { d0: R.avant.analyse.deflexionEntreJumelage, rdc: R.avant.analyse.rdc }, R.apres, R.a)}
    ${v.pays === "senegal" ? `<h4>Modèles SCT — guide sénégalais</h4>${panneauSct(v, R)}` : ""}
    ${profilsDesCriteres(pr, etude.couches, ver)}
    ${BLOC_CHAMPS}`;
}

function rendreNote(v, R) {
  const { profil, etude, verification: ver, diag, proposition, p } = R;
  const d = diag.dom;
  let k = 0;
  const h = (titre) => `<h3>${++k}. ${titre}</h3>`;
  const conseil = conseilSolution(R.solution);
  const phases = diag.phases?.length ? `<table class="resultats"><thead><tr><th>Phase</th><th class="num">NE subis</th><th class="num">NE de durée de vie</th><th class="num">Dommage</th></tr></thead><tbody>
      ${diag.phases.map((x) => `<tr><td>${esc(x.libelle)}</td><td class="num">${f(x.essieuxSubis, 4)}</td><td class="num">${f(x.essieuxDureeDeVie, 4)}</td><td class="q">${f(x.dommage, 4)}</td></tr>`).join("")}</tbody></table>` : "";
  const tableD = `<table class="resultats"><thead><tr><th>Couche en place</th><th class="num">D retenu</th><th>Origine</th></tr></thead><tbody>
      ${R.enPlace.map((l) => `<tr><td>${esc(l.nom)}</td><td class="q">${f(l.dommage, 3)}</td><td class="motif">${l.Dglobal ? "dommage global du diagnostic" : "dommage propre saisi"}</td></tr>`).join("")}</tbody></table>`;
  const cherchee = R.apport[R.iCherche];
  const cCherchee = etude.couches.find((c) => R.saisie[c.source]?.ligne === R.iCherche);
  const informatifs = ver.verifs.some((x) => x.informatif);
  const noteHtml = R.a?.noteHtml && !/NaN|undefined/.test(R.a.noteHtml) ? R.a.noteHtml : "";
  return `${h("Référentiel et hypothèses")}<p>${esc(profil.nom)}${etude.deterministe ? " — vérification par contraintes admissibles" : " — méthode rationnelle NF P98-086"}.
      Chargement : ${esc(texteEssieu(R.essieu))}. Risque r = ${fd(etude.risque, 1)} %${etude.risquePropose ? " (proposé par le référentiel)" : ""}, u = ${fd(etude.u, 3)}, θeq = ${f(etude.teq, 3)} °C.
      Les couches conservées portent leur module en place et le dommage déjà consommé D : chacune est vérifiée sous NE/(1 − D) (loi de Miner, couche par couche).
      L'apport, neuf, est vérifié sous le trafic futur.</p>
    ${h("Trafic à venir")}${noteTrafic(p, etude, profil)}
    ${noteHtml ? `${h("Auscultation")}${noteHtml}` : ""}
    ${h("Dommage déjà consommé")}<p>Voie suivie : ${esc(libelleVoie(diag.voie, profil.id, { note: true }))}.</p>
    ${phases}${diag.releves ? `<p>Classe de dégradation de surface, relevée sur le terrain : <strong>${esc(nomClasseDegradation(diag.releves.classe))}</strong>
      (fascicule 6 tunisien, tableaux 1 à 3${diag.emprunt ? ", empruntés de même" : ""}).</p>` : ""}
    ${liste([...diag.avant, ...d.etapes])}
    <p>${esc(texteDommage(R))}</p>${tableD}
    ${[...diag.reserves, ...d.avertissements].map((x) => `<p><small>Réserve : ${esc(x)}</small></p>`).join("")}
    <p class="method-note">${esc(REFERENCE_DOMMAGE)}</p>
    ${h("Solution retenue et travaux sur l'existant")}
    <p>Mode de renforcement : <strong>${esc(nomSolution(R.solution))}</strong>. Base de dimensionnement : ${esc(expliquerBase(R.base, diag.voie))}</p>
    ${proposition ? `<p>Le diagnostic oriente vers « ${esc(proposition.nom)} » — ${esc(proposition.pourquoi)}</p>` : ""}
    ${R.desaccord ? `<p><strong>${esc(R.desaccord)}</strong></p>` : ""}
    ${conseil ? `<p>${esc(conseil.quandChoisir)} Réserve : ${esc(conseil.reserve)}</p>` : ""}
    ${R.travaux.enleveCm > 0 ? `<p>Épaisseur enlevée ou retraitée : ${cm(R.travaux.enleveCm)} cm.</p>` : ""}
    ${liste([...R.travaux.etapes, ...R.travaux.avertissements])}${liste(R.notes)}
    <p class="method-note">${esc(REFERENCE_STRATEGIE)}</p>
    ${h("Apport")}<p>Complexe d'apport : ${esc(texteComplexe(R))}.</p>
    <p>Couche ${R.bornes ? "dont l'épaisseur est cherchée" : "dimensionnante"} : ${esc(cherchee.nom)} (${esc(cherchee.materiau ?? "module saisi")}, ${esc(NOM_FAMILLE[R.famCherchee] ?? "famille non précisée")}${cCherchee ? `, E = ${f(cCherchee.E, 4)} MPa` : ""}).
      ${R.bornes ? (R.hRetenue != null ? `Épaisseur retenue : <strong>${cm(R.hRetenue)} cm</strong>, plus petite épaisseur qui vérifie les critères dimensionnants.` : `Aucune épaisseur de ${cm(R.bornes.hMin)} à ${cm(R.bornes.hMax)} cm ne vérifie les critères.`) : `Épaisseur saisie : ${cm(R.hFinale)} cm.`}</p>
    ${R.recherche ? `<p>Recherche : balayage de ${cm(R.bornes.hMin)} à ${cm(R.bornes.hMax)} cm au pas de ${cm(R.bornes.pasLarge)} cm${R.bornes.pas < R.bornes.pasLarge ? `, puis affinage au pas de ${cm(R.bornes.pas)} cm` : ""}, sans supposer la monotonie des critères —
      ${R.recherche.essais.map((e) => `${cm(e.epaisseurCm)} cm ${e.ok ? "✓" : "✕"}`).join(", ")}.</p>${R.recherche.avertissements.map((x) => `<p><small>${esc(x)}</small></p>`).join("")}` : ""}
    <p><small>${esc(NOTE_SANS_CATALOGUE)} ${esc(RESERVE_MINIMA)}</small></p>
    ${h("Structure renforcée")}${tableauStructure(etude.couches)}
    ${R.alertes.length ? `<div class="piege"><strong>Alertes</strong>${R.alertes.map((x) => `<p>${esc(x)}</p>`).join("")}</div>` : ""}
    ${h("Sollicitations")}${tableauSollicitations(etude.analyse)}
    <p>Déflexion entre jumelage ${fd(etude.analyse.deflexionEntreJumelage, 1)} mm/100 ; rayon de courbure ${f(etude.analyse.rdc, 4)} m.</p>
    ${h("Vérification de la structure renforcée")}${ver.verifs.map((x) => (x.informatif ? `<p class="method-note">Critère donné à titre d'information, non dimensionnant (§ 5.2.1.2) :</p>` : "") + noteVerif(x)).join("")}
    <p>Verdict de la structure renforcée : <strong>${R.verdict === null ? "aucun critère dimensionnant" : R.verdict ? "conforme" : "NON conforme"}</strong>${ver.dimensionnant ? ` ; critère dimensionnant : ${esc(ver.dimensionnant.nom)} — ${esc(ver.dimensionnant.critere)}, taux ${fd(ver.dimensionnant.taux, 1)} %` : ""}.</p>
    <p>Les couches conservées sont vérifiées sous le trafic majoré du dommage, NE/(1 − D) ; l'apport, qui est neuf, sous le trafic futur. Un taux de travail ne se lit donc pas sans savoir sous quel trafic il a été calculé.</p>
    ${informatifs ? `<p><small>${esc(RESERVE_APPORT_BITUMINEUX)}</small></p>` : ""}
    ${h("Sollicitations des critères")}<p>Profils en profondeur de la structure renforcée, pour les grandeurs que vérifient les critères, avec leurs valeurs admissibles (tirets rouges), le critère dimensionnant d'abord.</p>
    ${profilsDesCriteres(profilsEnProfondeur(etude.couches, R.essieu, { parCouche: 7 }), etude.couches, ver)}
    ${h("Champs dans la structure renforcée")}<p>Carte, dans le plan vertical de l'axe des roues, de la grandeur que vérifie le critère dimensionnant,
      calculée par le même modèle de Burmister sur une grille de nœuds (comme l'écran « grille » d'Alizé), et ses valeurs aux interfaces.</p>
    ${NOTE_CHAMPS}
    ${h("Comparaison avant / après")}${tableauAvantApres({ d0: R.avant.analyse.deflexionEntreJumelage, rdc: R.avant.analyse.rdc }, R.apres, R.a)}
    <p><small>${esc(RESERVE_LECTURE_CEREMA)}</small></p>
    ${v.pays === "senegal" ? `${h("Modèles SCT — guide sénégalais")}${panneauSct(v, R)}` : ""}
    ${h("Conclusion")}<p>${R.aucunCritere ? "Aucun critère dimensionnant : la structure renforcée n'est pas vérifiée."
      : R.bornes ? (R.hRetenue != null ? `Renforcement retenu : ${esc(nomSolution(R.solution).toLowerCase())}, ${esc(texteComplexe(R))}.` : "L'apport seul ne suffit pas dans la plage étudiée : envisager un décaissement, un retraitement en place ou un matériau d'apport plus performant.")
        : R.verdict ? `Le renforcement saisi (${esc(texteComplexe(R))}) est vérifié.` : `Le renforcement saisi (${esc(texteComplexe(R))}) est insuffisant.`}</p>`
    + annexeFiches(fichesRetenues(profil, etude.couches), profil.nom);
}

/** Ce que le calcul retient pour chaque ligne, en gris dans les cases vides, et ce que les travaux en font. */
function indications(v, R) {
  const couches = R.etude.couches.map((c) => ({ ...c, source: R.saisie[c.source]?.ligne ?? -1 }));
  const ind = indicationsCouches(v.couches, couches);
  const restant = new Map(R.travaux.couches.filter((c) => c.ligne != null).map((c) => [c.ligne, c.h]));
  const action = R.solution === "retraitement" ? "le retraitement" : "le décaissement";
  return v.couches.map((l, i) => {
    const valeurs = { ...(ind[i]?.valeurs ?? {}) };
    const details = [ind[i]?.detail];
    if (i < R.n) {
      valeurs.dommage = "0";
      if (R.bornes && i === R.iCherche) {
        if (R.hRetenue != null) valeurs.h = cm(R.hRetenue);
        details.push(R.hRetenue != null ? `↳ épaisseur cherchée : ${cm(R.hRetenue)} cm retenus (l'épaisseur saisie est ignorée pendant la recherche).` : "↳ épaisseur cherchée : aucune ne suffit dans la plage étudiée.");
      }
    } else {
      const e = R.enPlace[i - R.n];
      valeurs.dommage = f(e.dommage, 3);
      if (!restant.has(i)) details.push(`↳ enlevée par ${action}.`);
      else if (Number.isFinite(e.h) && restant.get(i) < e.h - 1e-9) details.push(`↳ ramenée à ${cm(restant.get(i) * 100)} cm par ${action}.`);
    }
    const detail = details.filter(Boolean).join(" ");
    return { valeurs, detail: detail || null };
  });
}

// ─────────────────────────────── Module ───────────────────────────────────

export default {
  id: "renforcement", groupe: "Renforcement", icone: "▤", titre: "Renforcement", sous: "diagnostic, solution, apport",
  entete: "Dimensionnement du renforcement",
  description: "Comme l'onglet Renforcement de Burmister-Calc : le dommage déjà consommé (forfait Cli, cumul de Miner ou vie résiduelle), la solution vers laquelle le diagnostic oriente, les travaux sur la chaussée en place, puis l'épaisseur de l'apport — chaque couche conservée tenant le trafic à venir majoré de son dommage, NE/(1 − D) — et la comparaison avant / après. Les modules calés au Rétrocalcul et la mesure de l'Auscultation y sont repris.",
  champs: [
    ["Référentiel", [
      ["pays", "Référentiel", "choix", "france", optionsPays],
      ["typeStructure", "Type de structure (table de risque)", "choix", "bitumineuse-epaisse", OPT_STRUCTURE],
      ["sctAssise", "Assise de la chaussée (guide sénégalais, tab. 23 à 26)", "choix", "bitumineuse", OPT_ASSISE_SN, (v) => v.pays === "senegal"],
    ]],
    ["Trafic à venir", CHAMPS_TRAFIC],
    ["Calcul", [...CHAMPS_CALCUL, ...CHAMPS_ESSIEU]],
    ["Dommage déjà consommé", [
      ["voie", "Voie vers le dommage", "choix", "forfait", OPT_VOIE],
      ["niveauDeflexion", "Niveau de déflexion", "choix", "", optionsNiveauDeflexion, forfait],
      ["releves", "Dégradation d'après les relevés de surface (fascicule 6 tunisien, tab. 1 à 3)", "choix", "non", OUI_NON, forfait],
      ["niveauDegradation", "Niveau de dégradation", "choix", "moyen", NIVEAUX.map((x) => [x, x]), (v) => forfait(v) && v.releves !== "oui"],
      ["fissuration", "Fissuration : étendue (faïençage et fissures longitudinales)", "%", "20", releves],
      ["fissBandes", "Fissures dans les bandes de roulement", "choix", "oui", OUI_NON, releves],
      ["ornierage", "Orniérage : étendue", "%", "15", releves],
      ["profondeurOrniere", "Orniérage : profondeur", "mm", "15", releves],
      ["interfacesDecollees", "Interfaces décollées relevées en assise (carottages)", "choix", "non", OUI_NON, forfait],
      ["phases", "Historique : une phase par ligne « libellé ; NE subis ; NE de durée de vie »", "texte", PHASES_EXEMPLE, (v) => v.voie === "miner"],
      ["nonLiee", "La couche examinée est non liée (GNT, sol)", "choix", "non", OUI_NON, (v) => v.voie === "miner"],
      ["neRestant", "NE restant de la structure en place (vide : proposé)", "essieux", "", (v) => v.voie === "residuel"],
    ]],
    ["Solution", [
      ["decollementHaut", `Décollements d'interface dans les ${PROFONDEUR_DECOLLEMENT_HAUT_CM} premiers cm`, "choix", "non", OUI_NON],
      ["contrainteSeuil", "Contrainte de seuil (cote à ne pas relever)", "choix", "non", OUI_NON],
      ["solution", "Solution retenue", "choix", "rechargement", OPT_SOLUTION],
      ["profondeur", "Profondeur de décaissement ou de retraitement", "cm", "15", (v) => besoinProfondeur(v.solution)],
      ["retraiteMateriau", "Matériau retraité (loi de fatigue)", "choix", "", optionsRetraitee, (v) => v.solution === "retraitement"],
      ["retraiteE", "Module de la couche retraitée", "MPa", "3000", (v) => v.solution === "retraitement"],
    ]],
    ["Apport", [
      ["nApport", "Couches d'apport (premières lignes du tableau)", "choix", "1", optionsNApport],
      ["chercher", "Épaisseur de l'apport", "choix", "oui", [["oui", "chercher l'épaisseur d'une couche"], ["non", "vérifier l'épaisseur saisie"]]],
      ["dim", "Couche dont chercher l'épaisseur", "choix", "", optionsCherchee, cherche],
      ["hMin", "Épaisseur minimale essayée (vide : minimum constructif)", "cm", "", cherche],
      ["hMax", "Épaisseur maximale envisagée", "cm", "30", cherche],
      ["pas", "Pas de la recherche (balayage à 2 cm au moins, puis affinage)", "cm", "1", cherche],
    ]],
  ],
  couches: {
    titre: "Apport et chaussée en place",
    aide: "(de la surface vers le sol : d'abord les couches d'apport, neuves — leur nombre se règle au groupe Apport — puis la chaussée en place, module en place et dommage propre D facultatif : vide, le dommage global du diagnostic, en gris)",
    colonnes: [["nom", "Couche", "texte"], ["materiau", "Matériau", "choix", optionsMateriaux], ["h", "h (cm)", "nombre"],
      ["E", "E en place", "nombre"], ["nu", "ν", "nombre", null, "3.6em"], ["dommage", "D", "nombre", null, "3.6em"], ["interface", "Interface", "choix", OPT_INTERFACE]],
    sansSol: ["h", "interface"],
    defaut: DEFAUT_RENFORCEMENT,
    nouvelle: () => ({ nom: "Couche en place", materiau: "", h: "15", E: "500", nu: "", interface: "collee", dommage: "" }),
    // Le module d'une couche en place vient du rétrocalcul : changer son matériau (sa loi) ne l'efface pas.
    surChoix(col, c, v) { if (col === "materiau" && v.couches.indexOf(c) < nombreApport(v)) { c.E = ""; c.nu = ""; } },
    minimum: 3,
    boutons: (v, ctx) => (lignesCalees(ctx)
      ? `<button class="ghost" id="reprendreRetro" title="Remplace les lignes en place par la chaussée calée au module Rétrocalcul ; l'apport est conservé">Reprendre la chaussée calée du Rétrocalcul</button>` : ""),
  },
  surChoix(id, v) {
    if (id === "pays") v.retraiteMateriau = "";
    if (id === "nApport") v.dim = "";
  },
  brancher(app, v, ctx, { rendre, toast, ecrireEtat }) {
    // Un niveau de déflexion laissé vide est une proposition : grisé, comme les valeurs proposées.
    const sel = app.querySelector('select[data-champ="niveauDeflexion"]');
    if (sel) { sel.style.color = v.niveauDeflexion ? "" : "#94a3b8"; sel.style.fontStyle = v.niveauDeflexion ? "" : "italic"; }
    // Le dommage et la solution proposée, rappelés sous leur groupe comme dans l'application ;
    // effacés dès la frappe, ils ne reviennent qu'avec un calcul abouti.
    app.querySelector("#g3")?.insertAdjacentHTML("beforeend", `<p class="method-note" id="renfoDommage"></p>`);
    app.querySelector("#g4")?.insertAdjacentHTML("beforeend", `<div id="renfoProposition"></div>`);
    const effacer = () => { for (const id of ["renfoDommage", "renfoProposition"]) { const e = app.querySelector(`#${id}`); if (e) e.innerHTML = ""; } };
    app.querySelectorAll("input[data-champ], textarea[data-champ], input[data-couche]").forEach((e) => e.addEventListener("input", effacer));
    app.querySelector("#g1")?.insertAdjacentHTML("beforeend", `<div class="actions"><button class="ghost" id="reprendreTrafic" title="Référentiel, MJA, croissance, durée et CAM du module Trafic">Reprendre le trafic du module Trafic</button></div>`);
    app.querySelector("#reprendreTrafic")?.addEventListener("click", () => {
      const t = traficDepuisModule(ctx.valeurs("trafic"));
      if (!t) return toast("Module Trafic sans données.");
      const pays = t.pays !== v.pays;
      Object.assign(v, t);
      if (pays) v.retraiteMateriau = "";
      ecrireEtat(); rendre();
      toast(`Trafic repris du module Trafic${pays ? " — référentiel changé : vérifier les matériaux du tableau" : ""}.`);
    });
    app.querySelector("#reprendreRetro")?.addEventListener("click", () => {
      const calees = lignesCalees(ctx);
      if (!calees) return toast("Le Rétrocalcul n'a pas de chaussée calée à reprendre.");
      const n = nombreApport(v), actuelles = v.couches.slice(n);
      // Le rétrocalcul cale des modules, pas un dommage : la colonne D revient au dommage global.
      const enPlace = calees.map((l, i) => ({ nom: "", materiau: "", h: "", E: "", nu: "", interface: "collee", ...l,
        materiau: l.materiau || (calees.length === actuelles.length ? actuelles[i]?.materiau ?? "" : ""), dommage: "" }));
      v.couches = [...v.couches.slice(0, n), ...enPlace];
      ecrireEtat(); rendre();
      toast(`Chaussée calée reprise : ${enPlace.length} lignes en place, D au dommage global du diagnostic.`);
    });
  },
  apresCalcul(app, v, ctx, r, { rendre, toast, ecrireEtat }) {
    const dom = app.querySelector("#renfoDommage"), prop = app.querySelector("#renfoProposition");
    if (dom) dom.textContent = r.resumeDommage;
    if (prop) prop.innerHTML = r.htmlProposition;
    app.querySelectorAll("[data-retenir-solution]").forEach((b) => b.addEventListener("click", () => {
      v.solution = r.solutionProposee;
      ecrireEtat(); rendre();
      toast(`Solution retenue : ${nomSolution(r.solutionProposee)}.`);
    }));
    app.querySelector("#poserRenforcee")?.addEventListener("click", () => {
      v.couches = r.lignesPosees;
      v.solution = "rechargement";
      v.decollementHaut = "non";
      ecrireEtat(); rendre();
      toast("Structure renforcée posée comme chaussée en place, dommages conservés ; l'apport reste en tête pour un second temps (solution ramenée au rechargement).");
    });
  },
  calculer(v, ctx) {
    const R = analyserRenforcement(v, ctx);
    return {
      figure: coupeChaussee(R.etude.couches, { essieu: R.essieu, largeur: 600 }),
      synthese: rendreSynthese(v, R),
      note: rendreNote(v, R),
      verdict: R.verdict,
      taux: R.taux,
      etat: R.verdict === null ? "aucun critère dimensionnant" : undefined,
      indications: indications(v, R),
      proposes: { ...valeursProposees(R.etude, R.profil), hMin: cm(R.minFamille), neRestant: R.diag.capacite ? f(R.diag.capacite.ne, 4) : "" },
      solutionProposee: R.proposition?.solution ?? null,
      resumeDommage: texteDommage(R),
      htmlProposition: htmlProposition(R),
      lignesPosees: lignesPosees(v, R),
      etude: R,
      champs: descChamps("renforcement", R.etude.couches, R.essieu, R.verification),
    };
  },
};
