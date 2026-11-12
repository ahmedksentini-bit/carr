// Module « Rétrocalcul » : les modules de la chaussée en place, calés sur les
// déflexions mesurées (Benkelman : d0 et Rdc ; FWD : bassin) — soit
// simultanément, par Levenberg-Marquardt sur le moteur de Burmister, soit en
// deux temps comme le prescrit le guide Cerema/IDRRIM 2016 (la déflexion donne
// le sol, puis le rayon les couches bitumineuses). Comme l'onglet Rétrocalcul
// de Burmister-Calc, il reprend les valeurs de l'Auscultation, construit le
// modèle de diagnostic, pose les modules de départ du guide, et échange la
// chaussée en place avec le module Renforcement.

import { retrocalculer, diagnostiquer, nombreMesures, nombreLibres, libellesMesures, simuler } from "../chaussee/retrocalcul.js";
import { bassin } from "../chaussee/burmister.js";
import { appliquer } from "../chaussee/materiaux.js";
import { construireModeleDiagnostic, NOM_SUBSTRATUM } from "../chaussee/renforcement/diagnostic.js";
import { pointDeDepartSansCarottage, appliquerPointDeDepart, determination, PRINCIPE_MISE_EN_PLACE } from "../chaussee/renforcement/mise-en-place.js";
import { calerEnDeuxEtapes, PRINCIPE_CALAGE_DEUX_ETAPES, REFERENCE_CALAGE_DEUX_ETAPES, VITESSE_DEFAUT_KMH } from "../chaussee/renforcement/calage-deux-etapes.js";
import { frequenceEstimeeHz, SEUIL_SUBSTRATUM_MPA } from "../chaussee/renforcement/conditions-modules.js";
import { coupeChaussee, figureBassin } from "../figures-chaussee.js";
import { lireTableau } from "../ui.js";
import { esc, f, fd, nombre, pastille, OPT_INTERFACE, CHAMPS_ESSIEU, essieuDe, texteEssieu, tableauStructure } from "./commun.js";
import { optionsPays, optionsMateriaux } from "./dimensionnement.js";
import { syntheseAuscultation, repriseRetrocalcul } from "./auscultation.js";

const OPT_CONTRAINTE = [["fixe", "fixé"], ["libre", "recherché"], ["liee", "lié à la couche inférieure"]];
const OPT_ARRETE = [["", "non"], ["oui", "oui"]];
const OPT_METHODE = [["simultane", "simultané — Levenberg-Marquardt sur toutes les mesures"], ["deux-temps", "en deux temps — méthode du guide (étapes 2 et 3)"]];
const OPT_PROPRETE = [["propre", "Propre"], ["pollue", "Pollué (fines > 12 % et MB/D < 0,8)"], ["tres-pollue", "Très pollué (fines > 12 %)"]];
const OPT_HUMIDITE = [["sec", "Sec (teneur en eau ≤ 3 %)"], ["humide", "Humide"], ["suintant", "Suintant (eau libre dans le trou)"]];

/**
 * Au-delà de cet écart, un calage convergé reste douteux (Burmister-Calc) : dix pour cent est
 * l'ordre de grandeur de la dispersion d'une campagne de déflexion.
 */
export const ECART_SUSPECT_POURCENT = 10;

// Exemple de Burmister-Calc : seul le sol est recherché, sur d0 et Rdc.
const ligne = (nom, materiau, h, E, contrainte = "fixe") =>
  ({ nom, materiau, h, E, nu: "0.35", contrainte, rapport: "", depart: "", arrete: "", interface: "collee" });
const DEFAUT = [
  ligne("BB", "BBSG1", "6", "3600"), ligne("GB", "GB3", "18", "6300"), ligne("GNT", "GNT2", "25", "400"), ligne("Sol", "PF2", "", "100", "libre"),
];

const PRINCIPE_MODELE =
  "Ce référentiel ne publie aucune fiche d'épaisseur de renforcement et vérifie ses couches liées par la "
  + "fatigue : le dimensionnement part de la chaussée qui existe. Saisissez d'abord la coupe relevée — "
  + "épaisseurs et surtout MATÉRIAU de chaque couche, qui apporte la famille : une couche seulement nommée "
  + "« GNT » n'est pas reconnue comme granulaire. Le bouton la met ensuite sous la forme du calcul inverse : "
  + "graves non traitées découpées en sous-couches de 10 cm depuis le bas, modules granulaires à k = 2 "
  + "plafonnés par la grille du pays, sol ramené à 6 m et massif rigide de 10 000 MPa dessous.";

const NOTE_DEUX_TEMPS =
  "Ce calage pose ses propres statuts à chaque étape — couches liées figées puis cherchées, sol cherché "
  + "puis figé. Il ne tient compte que de la colonne « Arrêté » : une couche arrêtée ne bouge à aucune "
  + "étape. La colonne « Module » (fixé / recherché / lié) sert au calage simultané.";

const n3 = (x) => {
  if (!Number.isFinite(x)) return "—";
  const s = x.toLocaleString("fr-FR", { maximumFractionDigits: 3, useGrouping: false });
  return /^-0(,0*)?$/.test(s) ? "0" : s;
};
const arrondi = (x, d) => String(Math.round(x * 10 ** d) / 10 ** d);

// ──────────────────────────────── Lecture de la saisie ───────────────────────

/** θeq à laquelle s'expriment les modules des matériaux : saisie, sinon proposée par le pays. */
const teqDe = (v, profil) => nombre(v.teq, profil?.teqPropose?.("renforcement") ?? 15);

/**
 * Couches de calcul d'après les lignes : module saisi, sinon celui du matériau du pays à θeq ;
 * famille tirée du matériau (elle commande le modèle de diagnostic, le point de départ et le
 * calage en deux temps). Le plafond `moduleMax` d'une sous-couche granulaire voyage avec elle.
 */
export function couchesDe(lignes, profil, teq) {
  return lignes.map((c, i) => {
    const der = i === lignes.length - 1;
    const m = c.materiau ? profil?.materiau(c.materiau) ?? null : null;
    const h = nombre(c.h) / 100, k = nombre(c.rapport), Es = nombre(c.E), nus = nombre(c.nu), dep = nombre(c.depart), max = nombre(c.moduleMax);
    if (!der && !(h > 0)) throw new Error(`couche ${i + 1} : épaisseur à saisir`);
    let E = Es > 0 ? Es : NaN;
    if (!(E > 0) && m) E = appliquer({ nom: c.nom, h, E: undefined }, m, { teq }).E;
    if (!(E > 0)) throw new Error(`couche ${i + 1} : module à saisir${c.materiau && !m ? ` (matériau « ${c.materiau} » inconnu de ce référentiel)` : ""}`);
    // Une ligne sans statut (reprise d'un autre module) : le sol est cherché, le reste fixé.
    let contrainte = c.contrainte || (der ? "libre" : "fixe");
    // La couche semi-infinie ne dépend de rien : Burmister-Calc la rend libre.
    if (der && contrainte === "liee") contrainte = "libre";
    return {
      nom: c.nom || m?.nom || `couche ${i + 1}`, materiau: c.materiau || null, famille: m?.famille ?? null,
      E, nu: nus > 0 ? nus : m?.nu ?? 0.35, h: der ? Infinity : h, interface: c.interface || "collee", contrainte,
      ...(k > 0 ? { rapport: k } : {}), ...(max > 0 ? { moduleMax: max } : {}),
      moduleArrete: c.arrete === "oui", depart: dep > 0 ? dep : null, source: i,
    };
  });
}

/** Mesures à caler ; d0 positif exigé, tolérance 1e-10 comme Burmister-Calc. */
function reglagesDe(v) {
  const iterationsMax = Math.round(nombre(v.iterationsMax, 50));
  if (!(iterationsMax >= 1)) throw new Error("itérations maximales : entier positif attendu");
  if (v.mode === "bassin") {
    const t = lireTableau(v.bassin);
    if (t.length < 2) throw new Error("bassin : au moins deux points « distance ; déflexion »");
    if (t.some((r) => !(r[1] > 0))) throw new Error("bassin : chaque déflexion mesurée doit être positive");
    return { mode: "bassin", decalages: t.map((r) => r[0]), deflexions: t.map((r) => r[1]), iterationsMax, tolerance: 1e-10 };
  }
  const d0 = nombre(v.d0), rdc = nombre(v.rdc);
  if (!(d0 > 0)) throw new Error("d0 : déflexion mesurée à saisir (valeur positive)");
  return { mode: "benkelman", d0, rdc: rdc > 0 ? rdc : null, iterationsMax, tolerance: 1e-10 };
}

/** Aide sous le champ Rdc (Burmister-Calc). */
const aideRdc = (reglages) => (reglages.rdc !== null
  ? "Calage sur d0 et Rdc : deux mesures, donc jusqu'à deux modules déterminés de façon unique."
  : "Champ Rdc vide : calage sur la seule déflexion d0. Au-delà d'un module recherché, le calcul reste possible mais la solution dépend du point de départ.");

/** Indice du sol support : la couche au-dessus du substratum rigide s'il y en a un. */
const indiceDuSol = (couches) => (couches.length >= 2 && couches[couches.length - 1].E >= SEUIL_SUBSTRATUM_MPA ? couches.length - 2 : couches.length - 1);

// ─────────────────────────────────── Calages ─────────────────────────────────

function calageSimultane(couches, essieu, reglages) {
  const diag = diagnostiquer(couches, reglages);
  if (diag?.bloquant) throw new Error(diag.message);
  const departs = couches.map((c) => (c.contrainte === "libre" ? c.depart ?? c.E : null));
  const r = retrocalculer(couches, essieu, reglages, departs.filter((x) => x !== null));
  const libelles = libellesMesures(reglages);
  const statut = (r.converge
    ? `Convergence en ${r.iterations} itérations (${fd(r.dureeMs, 0)} ms), écart RMS relatif ${n3(r.ecartRmsRelatifPourcent)} %.`
    : `Pas de convergence en ${r.iterations} itérations : écart RMS relatif ${n3(r.ecartRmsRelatifPourcent)} %. Essayez un autre point de départ.`)
    + (r.sousDetermine ? " Solution non unique (moins de mesures que d'inconnues) : elle dépend du point de départ." : "");
  const libres = nombreLibres(couches), nm = nombreMesures(reglages);
  return {
    methode: "simultane", modules: r.modules, modulesMesure: r.modules, converge: r.converge, rms: r.ecartRmsRelatifPourcent,
    lignes: r.cible.map((c, i) => ({ libelle: libelles[i], mesure: c, calcule: r.simule[i] })),
    statut, departs, iterations: r.iterations, sousDetermine: r.sousDetermine, avertissement: r.avertissement,
    diagnostic: determination(libres, nm) + (reglages.mode === "benkelman" && reglages.rdc === null ? " (d0 seule, Rdc non renseigné.)" : ""),
    avertissements: [],
  };
}

function calageDeuxTemps(v, couches, essieu, reglages, teq) {
  if (reglages.mode === "bassin")
    throw new Error("le calage en deux temps cale d0 puis le rayon de courbure : choisir la poutre Benkelman / le déflectographe");
  const rc = nombre(v.rayonCalage);
  const rayon = rc > 0 ? rc : reglages.rdc;
  const tMesure = nombre(v.tMesure, 15);
  const vit = nombre(v.vitesse);
  const vitesse = Number.isFinite(vit) ? vit : null;
  const r = calerEnDeuxEtapes(couches, essieu, { d0: reglages.d0, rayon, temperatureMesure: tMesure, vitesse, temperatureModules: teq });
  const lignes = [];
  if (r.etapeSol.menee) lignes.push({ libelle: "d0 (mm/100) — étape 2", mesure: r.etapeSol.mesure, calcule: r.etapeSol.simule });
  if (r.etapeBitumineuse.menee) lignes.push({ libelle: "Rdc (m) — étape 3", mesure: r.etapeBitumineuse.mesure, calcule: r.etapeBitumineuse.simule });
  const pct = lignes.map((l) => ((l.calcule - l.mesure) / l.mesure) * 100);
  const rms = pct.length ? Math.sqrt(pct.reduce((s, x) => s + x * x, 0) / pct.length) : NaN;
  return {
    methode: "deux-temps", modules: r.modulesPublies, modulesMesure: r.modules, converge: r.ok, rms, lignes,
    statut: r.ok
      ? `Calage en deux temps abouti — déflexion et rayon calés séparément (écarts ${pct.map((x) => `${n3(x)} %`).join(" / ")}).`
      : "Calage en deux temps incomplet : voir le détail des étapes.",
    departs: couches.map((c) => c.E), sousDetermine: false, avertissement: null,
    diagnostic: "Étape 2 : une inconnue (le sol) pour la déflexion ; étape 3 : une inconnue (le bloc bitumineux, dans ses proportions) pour le rayon.",
    avertissements: r.avertissements, deuxTemps: { r, rayon, tMesure, vitesse, teq, rayonSaisi: rc > 0 },
  };
}

/** Qualité du calage dite au moment de s'en servir (Burmister-Calc, « Appliquer à la structure »). */
export function messageQualite(res) {
  if (!res.converge)
    return `⚠ Le rétrocalcul n'a PAS convergé (écart RMS relatif ${fd(res.rms, 1)} %) : la structure ne reproduit pas les mesures, `
      + "et tout ce qui en découle — vérification, épaisseur de renforcement — porte sur une chaussée qui n'est pas celle "
      + "qu'on a auscultée. Reprenez le point de départ ou les statuts avant d'aller plus loin.";
  if (res.rms > ECART_SUSPECT_POURCENT)
    return `⚠ Écart RMS relatif ${fd(res.rms, 1)} % : le calage converge mais reste lâche. Vérifiez le détail mesuré / calculé avant de vous en servir.`;
  return `Écart RMS relatif ${fd(res.rms, 1)} %.`;
}

// ──────────────────────────────── Passerelles ────────────────────────────────

/** Nombre de lignes d'apport en tête du module Renforcement (champ `nApport`, 1 par défaut). */
export const nApportDe = (ren) => {
  const n = Math.round(nombre(ren?.nApport, 1));
  return n >= 0 ? n : 1;
};

/**
 * Lignes « chaussée en place » du module Renforcement d'après un calage : E calé arrondi à
 * 0,01 MPa (modules ramenés aux conditions du projet après un calage en deux temps), matériau
 * gardé, dommage de la ligne en place de même rang s'il existe.
 */
function lignesRenforcement(v, ren, modules) {
  const enPlace = (ren?.couches ?? []).slice(nApportDe(ren));
  const der = v.couches.length - 1;
  return v.couches.map((l, i) => ({
    nom: l.nom ?? "", materiau: l.materiau ?? "", h: i === der ? "" : String(l.h ?? ""),
    E: arrondi(modules[i], 2), nu: String(l.nu ?? ""), interface: l.interface || "collee",
    dommage: enPlace[i]?.dommage ?? "",
  }));
}

/**
 * Le calage courant du Rétrocalcul, prêt à reprendre dans le Renforcement :
 * { lignes, converge, rms, message } ou null si le calcul est impossible.
 */
export function calageRetrocalcul(vr, ctx) {
  if (!vr?.couches?.length) return null;
  let r;
  try { r = moduleRetro.calculer(vr, ctx); } catch { return null; }
  return { lignes: lignesRenforcement(vr, ctx.valeurs?.("renforcement"), r.calage.modules), converge: r.calage.converge, rms: r.calage.rms, message: messageQualite(r.calage) };
}

/** Lignes « chaussée en place » du Renforcement d'après le calage du Rétrocalcul (null si impossible). */
export const lignesEnPlace = (vr, ctx) => calageRetrocalcul(vr, ctx)?.lignes ?? null;

/** Lignes du Rétrocalcul d'après la chaussée en place du Renforcement (sol cherché, le reste fixé). */
export function lignesDepuisRenforcement(ren) {
  const enPlace = (ren?.couches ?? []).slice(nApportDe(ren));
  const der = enPlace.length - 1;
  return enPlace.map((l, i) => ({
    nom: l.nom ?? "", materiau: l.materiau ?? "", h: i === der ? "" : String(l.h ?? ""), E: String(l.E ?? ""), nu: String(l.nu ?? ""),
    contrainte: i === der ? "libre" : "fixe", rapport: "", depart: "", arrete: "", interface: l.interface || "collee",
  }));
}

/** Remplace la structure par le modèle de diagnostic (§ 3.4.1) ; idempotent. */
export function modeleDiagnosticLignes(v, ctx) {
  const profil = ctx.profils.get(v.pays);
  if (!profil) throw new Error(`référentiel « ${v.pays} » indisponible`);
  // Idempotence : un substratum déjà là est retiré avant de reconstruire.
  const lignes = v.couches.length > 2 && v.couches[v.couches.length - 1].nom === NOM_SUBSTRATUM ? v.couches.slice(0, -1) : v.couches;
  const couches = couchesDe(lignes, profil, teqDe(v, profil));
  const res = construireModeleDiagnostic(couches, { proprete: v.proprete || "propre", humidite: v.humidite || "humide", plafond: profil.plafondGnt });
  const der = res.couches.length - 1;
  // Statuts du guide (§ 3.4) : liées figées, granulaires liées à k = 2, sol cherché, substratum figé.
  const nouvelles = res.couches.map((c, i) => {
    const sol = i === res.indiceSol, granulaire = i < res.indiceSol && c.famille === "sol";
    return {
      nom: c.nom, materiau: c.materiau ?? "", h: i === der ? "" : arrondi(c.h * 100, 1), E: arrondi(c.E, 1), nu: String(c.nu),
      contrainte: i === der ? "fixe" : sol ? "libre" : granulaire ? "liee" : "fixe", rapport: granulaire ? "2" : "",
      depart: sol ? arrondi(c.E, 1) : "", arrete: lignes[c.source]?.arrete ?? "", interface: c.interface || "collee",
      ...(granulaire && c.moduleMax > 0 ? { moduleMax: String(c.moduleMax) } : {}),
    };
  });
  return { lignes: nouvelles, etapes: res.etapes, avertissements: res.avertissements };
}

/** Pose les modules de départ du guide (sans carottage) dans les lignes. */
export function pointDeDepartLignes(v, ctx) {
  const profil = ctx.profils.get(v.pays);
  if (!profil) throw new Error(`référentiel « ${v.pays} » indisponible`);
  const couches = couchesDe(v.couches, profil, teqDe(v, profil));
  const vit = nombre(v.vitesse);
  const pdd = pointDeDepartSansCarottage(couches, {
    vitesse: Number.isFinite(vit) ? vit : null, proprete: v.proprete || "propre", humidite: v.humidite || "humide", plafond: profil.plafondGnt,
  });
  let mesures = 1;
  try { mesures = nombreMesures(reglagesDe(v)); } catch { /* mesures pas encore saisies */ }
  const a = appliquerPointDeDepart(couches, pdd, mesures);
  const lignes = v.couches.map((l, i) => {
    const p = pdd.couches[i];
    if (!p) return l;
    return p.cherche ? { ...l, contrainte: "libre", depart: arrondi(p.moduleDepart, 1) } : { ...l, contrainte: "fixe", E: arrondi(p.moduleDepart, 1) };
  });
  return { lignes, resume: a.resume, etapes: a.etapes, avertissements: a.avertissements };
}

// ──────────────────────────────────── Module ─────────────────────────────────

const moduleRetro = {
  id: "retrocalcul", groupe: "Renforcement", icone: "⟲", titre: "Rétrocalcul", sous: "modules en place d'après les déflexions",
  entete: "Rétrocalcul des modules",
  description: "Les modules de la chaussée en place, recherchés pour que le modèle de Burmister reproduise les déflexions mesurées — simultanément par Levenberg-Marquardt, ou en deux temps comme le prescrit le guide (la déflexion donne le sol, le rayon les couches bitumineuses). On ne cherche jamais plus de modules qu'on n'a de mesures.",
  champs: [
    ["Référentiel", [
      ["pays", "Référentiel (matériaux, θeq, plafond des GNT)", "choix", "france", optionsPays],
    ]],
    ["Mesures", [
      ["mode", "Appareil", "choix", "benkelman", [["benkelman", "poutre Benkelman / déflectographe : d0 et Rdc"], ["bassin", "déflectomètre à masse tombante : bassin"]]],
      ["d0", "Déflexion entre jumelage d0", "mm/100", "33.4", (v) => v.mode !== "bassin"],
      ["rdc", "Rayon de courbure Rdc (vide : non mesuré)", "m", "758", (v) => v.mode !== "bassin"],
      ["bassin", "Bassin : une ligne « distance (m) ; déflexion (mm/100) »", "texte", "0 ; 48\n0.2 ; 42\n0.3 ; 37\n0.45 ; 30\n0.6 ; 24\n0.9 ; 16\n1.2 ; 11\n1.5 ; 8", (v) => v.mode === "bassin"],
    ]],
    ["Calage", [
      ["methode", "Méthode de calage", "choix", "simultane", OPT_METHODE],
      ["iterationsMax", "Itérations maximales", "", "50", (v) => v.methode !== "deux-temps"],
      ["rayonCalage", "Rayon de l'étape 3 (vide : Rdc ci-dessus)", "m", "", (v) => v.methode === "deux-temps"],
      ["tMesure", "Température des mesures θ (vide : 15 °C)", "°C", "", (v) => v.methode === "deux-temps"],
      ["vitesse", "Vitesse de mesure (vide : non renseignée)", "km/h", ""],
      ["teq", "Température θeq des modules (vide : proposée)", "°C", ""],
    ]],
    ["Graves non traitées en place", [
      ["proprete", "Propreté constatée", "choix", "propre", OPT_PROPRETE],
      ["humidite", "État hydrique constaté", "choix", "humide", OPT_HUMIDITE],
    ]],
    ["Chargement", CHAMPS_ESSIEU],
  ],
  couches: {
    titre: "Structure en place", aide: "(épaisseurs relevées aux carottages, en cm ; E : module fixé ou de départ — vide : celui du matériau à θeq ; Départ : point de départ d'un module recherché, vide = E ; Arrêté : tenu par le calage en deux temps)",
    colonnes: [["nom", "Couche", "texte"], ["materiau", "Matériau", "choix", optionsMateriaux], ["h", "h (cm)", "nombre"], ["E", "E (MPa)", "nombre"],
      ["nu", "ν", "nombre", null, "3.6em"], ["contrainte", "Module", "choix", OPT_CONTRAINTE], ["rapport", "k", "nombre", null, "3.2em"],
      ["depart", "Départ", "nombre"], ["arrete", "Arrêté", "choix", OPT_ARRETE], ["interface", "Interface", "choix", OPT_INTERFACE]],
    sansSol: ["h", "interface"],
    defaut: DEFAUT,
    nouvelle: () => ligne("Couche", "", "15", "500"),
    surChoix(col, c) {
      if (col === "materiau") { c.E = ""; c.nu = ""; }
      // Une couche liée part du rapport usuel des granulaires, k = 2.
      if (col === "contrainte" && c.contrainte === "liee" && !(nombre(c.rapport) > 0)) c.rapport = "2";
    },
    minimum: 2,
    boutons: (v, ctx) => {
      const modele = !!ctx.profils.get(v.pays)?.besoinModeleExistant?.("renforcement");
      const md = v.modeleDiagnostic;
      return `<button class="ghost" id="reprendreRenfo">Reprendre la chaussée en place du Renforcement</button>
        ${modele ? `<button class="ghost" id="construireModele">Construire le modèle de diagnostic</button>` : ""}
        <button class="ghost" id="remplirMesures" title="Écrit dans les mesures la réponse de la structure telle qu'elle est saisie (aide à la prise en main)">Remplir les mesures avec la structure courante</button>
        ${modele ? `<p class="method-note">${esc(PRINCIPE_MODELE)}</p>` : ""}
        ${md ? `<div class="method-note"><strong>Modèle de diagnostic</strong><ul>${md.etapes.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
          ${md.avertissements.map((a) => `<p>⚠ ${esc(a)}</p>`).join("")}</div>` : ""}`;
    },
  },
  surChoix(id, v) { if (id === "pays") { v.modeleDiagnostic = null; v.miseEnPlace = null; } },
  apresSaisie(v, ctx) {
    const s = syntheseAuscultation(ctx.valeurs?.("auscultation"));
    const mp = v.miseEnPlace;
    return `<h3>Ce que le diagnostic apporte</h3>
      <p class="method-note">${esc(s?.proposition ?? "Aucune mesure exploitable dans le module Auscultation. Les valeurs à caler sont saisies à la main.")}</p>
      ${s?.noteRayonMedian ? `<p class="method-note">${esc(s.noteRayonMedian)}</p>` : ""}
      ${s?.regleRayon ? `<p class="method-note">${esc(s.regleRayon)}</p>` : ""}
      <div class="actions"><button class="ghost" id="reprendreAusc"${s ? "" : " disabled"}>Reprendre les valeurs de l'auscultation</button></div>
      <p class="method-note">${esc(PRINCIPE_MISE_EN_PLACE)}</p>
      <div class="actions"><button class="ghost" id="poserDepart">Poser les modules de départ du guide</button></div>
      ${mp ? `<p><strong>${esc(mp.resume)}</strong></p><ul class="method-note">${mp.etapes.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
        ${mp.avertissements.length ? `<div class="piege">${mp.avertissements.map((a) => `<p>${esc(a)}</p>`).join("")}</div>` : ""}` : ""}
      ${v.methode === "deux-temps" ? `<h3>Calage en deux temps</h3><p class="method-note">${esc(PRINCIPE_CALAGE_DEUX_ETAPES)}</p>
        <p class="method-note">${esc(REFERENCE_CALAGE_DEUX_ETAPES)}</p><p class="method-note"><strong>${esc(NOTE_DEUX_TEMPS)}</strong></p>` : ""}`;
  },
  brancher(app, v, ctx, { rendre, toast, ecrireEtat }) {
    const geste = (id, action) => app.querySelector(id)?.addEventListener("click", () => {
      try { const msg = action(); ecrireEtat(); rendre(); if (msg) toast(msg); } catch (e) { toast(`Impossible : ${e.message}`); }
    });
    geste("#reprendreAusc", () => {
      const rep = repriseRetrocalcul(syntheseAuscultation(ctx.valeurs("auscultation")));
      if (!rep) throw new Error("l'auscultation n'a pas de valeur caractéristique exploitable");
      Object.assign(v, rep.valeurs);
      return rep.message;
    });
    geste("#poserDepart", () => {
      const r = pointDeDepartLignes(v, ctx);
      v.couches = r.lignes;
      v.miseEnPlace = { resume: r.resume, etapes: r.etapes, avertissements: r.avertissements };
      return "Modules de départ du guide posés dans la structure.";
    });
    geste("#reprendreRenfo", () => {
      const ren = ctx.valeurs("renforcement");
      const lignes = lignesDepuisRenforcement(ren);
      if (lignes.length < 2) throw new Error("le module Renforcement n'a pas de chaussée en place (au moins deux couches sous l'apport)");
      v.couches = lignes;
      if (ren?.pays && ctx.profils.has(ren.pays)) v.pays = ren.pays;
      v.modeleDiagnostic = null; v.miseEnPlace = null;
      return `Chaussée en place du Renforcement reprise : ${lignes.length} couches, seul le sol est recherché.`;
    });
    geste("#construireModele", () => {
      const r = modeleDiagnosticLignes(v, ctx);
      v.couches = r.lignes;
      v.modeleDiagnostic = { etapes: r.etapes, avertissements: r.avertissements };
      v.miseEnPlace = null;
      return `Modèle de diagnostic construit : ${r.lignes.length} couches, sol cherché, substratum figé.`;
    });
    geste("#remplirMesures", () => {
      const profil = ctx.profils.get(v.pays);
      const couches = couchesDe(v.couches, profil, teqDe(v, profil));
      const essieu = essieuDe(v);
      if (v.mode === "bassin") {
        const t = lireTableau(v.bassin);
        const dec = t.length ? t.map((r) => r[0]) : [0, 0.3, 0.6, 0.9, 1.2];
        const d = simuler(couches, essieu, { mode: "bassin", decalages: dec, deflexions: dec.map(() => 1) });
        v.bassin = dec.map((y, i) => `${y} ; ${arrondi(d[i], 3)}`).join("\n");
      } else {
        const avecRdc = nombre(v.rdc) > 0;
        const s = simuler(couches, essieu, { mode: "benkelman", d0: 1, rdc: avecRdc ? 1 : null });
        v.d0 = arrondi(s[0], 3);
        // Un champ Rdc laissé vide le reste : l'utilisateur a signifié qu'il n'a pas la mesure.
        if (avecRdc) v.rdc = arrondi(s[1], 2);
      }
      return "Mesures remplies avec la réponse de la structure courante.";
    });
  },
  calculer(v, ctx) {
    const profil = ctx.profils.get(v.pays);
    if (!profil) throw new Error(`référentiel « ${v.pays} » indisponible`);
    const teq = teqDe(v, profil);
    const couches = couchesDe(v.couches, profil, teq);
    const essieu = essieuDe(v);
    const reglages = reglagesDe(v);
    const res = v.methode === "deux-temps" ? calageDeuxTemps(v, couches, essieu, reglages, teq) : calageSimultane(couches, essieu, reglages);
    return rendu(v, ctx, profil, couches, essieu, reglages, res, teq);
  },
  apresCalcul(app, v, ctx, r, { rendre, toast, ecrireEtat }) {
    app.querySelector("#appliquerCales")?.addEventListener("click", () => {
      v.couches.forEach((l, i) => { if (Number.isFinite(r.calage.modules[i])) l.E = arrondi(r.calage.modules[i], 2); });
      ecrireEtat(); rendre();
      toast(`${v.couches.length} module(s) recopié(s) dans le tableau. ${messageQualite(r.calage)}`);
    });
    app.querySelector("#versRenfo")?.addEventListener("click", () => {
      const ren = ctx.valeurs("renforcement");
      const n = nApportDe(ren);
      const apport = (ren?.couches ?? []).slice(0, n);
      while (apport.length < n) apport.push({ nom: "Renforcement", materiau: "", h: "8", E: "", nu: "", interface: "collee", dommage: "0" });
      const lignes = lignesRenforcement(v, ren, r.calage.modules);
      const pays = ren?.pays && ren.pays !== v.pays ? { pays: v.pays } : {};
      ctx.envoyer("renforcement", { couches: [...apport, ...lignes], ...pays },
        `Chaussée calée envoyée au Renforcement (${lignes.length} couches en place${pays.pays ? `, référentiel aligné sur ${ctx.profils.get(v.pays)?.nom ?? v.pays}` : ""}). ${messageQualite(r.calage)}`);
    });
  },
};
export default moduleRetro;

// ──────────────────────────────────── Rendu ──────────────────────────────────

function statutDe(c, i, res, indiceSol) {
  if (res.methode === "deux-temps") {
    if (c.moduleArrete) return "arrêté par le projeteur";
    if (i === indiceSol) return "étape 2 : cherché par la déflexion";
    if (i > indiceSol) return "fixé (substratum)";
    if (c.famille === "bitumineux") return "étape 3 : cherché par le rayon";
    if (c.famille === "sol") return "suit la couche inférieure (k = 2)";
    return "fixé";
  }
  if (c.contrainte === "libre") return "recherché";
  if (c.contrainte === "liee") return `lié à la couche inférieure (k = ${n3(c.rapport ?? 1)})${c.moduleMax ? `, plafond ${f(c.moduleMax, 4)} MPa` : ""}`;
  return "fixé";
}

function rapportDeuxTemps(dt, s) {
  const { r, tMesure, vitesse, teq, rayon, rayonSaisi } = dt;
  const signe = (x) => (Number.isFinite(x) ? `${x > 0 ? "+" : ""}${n3(x)}` : "—");
  const dejaDits = new Set([...r.etapeSol.avertissements, ...r.etapeBitumineuse.avertissements]);
  const etape = (e) => `<div class="exemple"><h4>${esc(e.titre)}</h4><p><em>${esc(e.regle)}</em></p>
    ${e.menee ? `<p>Mesuré ${n3(e.mesure)} → calculé ${n3(e.simule)} (${signe(e.ecartPourcent)} %)</p>
      <ul>${e.etapes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "<p>— étape non menée.</p>"}
    ${e.avertissements.map((w) => `<p>⚠ ${esc(w)}</p>`).join("")}</div>`;
  const hz = frequenceEstimeeHz(vitesse ?? VITESSE_DEFAUT_KMH);
  const projet = Object.entries(r.modulesProjet);
  return `<p class="method-note">${rayonSaisi && s?.regleRayon ? esc(s.regleRayon) : `Rayon de l'étape 3 : ${rayon ? `${n3(rayon)} m` : "non mesuré"}${rayonSaisi ? "" : " (Rdc saisi)"}.`}</p>
    ${etape(r.etapeSol)}${etape(r.etapeBitumineuse)}
    ${projet.length ? `<div class="exemple"><h4>Modules bitumineux ramenés aux conditions du projet (${f(teq, 3)} °C et 10 Hz) — ce sont eux qui sont posés</h4>
      <p>Le calage travaille aux conditions de la mesure (${f(tMesure, 3)} °C, ${hz} Hz) ; ces valeurs-ci sont celles de la colonne « E calé » et celles qu'« Appliquer » écrira.</p>
      <p>À noter : une fois ces modules posés, recalculer la déflexion et le rayon ne redonnera PAS les valeurs mesurées, et c'est normal. La chaussée a été mesurée à ${f(tMesure, 3)} °C sous ${hz} Hz, et elle est calculée à ${f(teq, 3)} °C sous 10 Hz — elle y est plus raide, donc elle s'y enfonce moins. Le calage a bien reproduit la mesure : le tableau mesuré / calculé le montre, aux conditions de la mesure.</p>
      <ul>${projet.map(([i, val]) => `<li>${esc(dt.couches[i]?.nom ?? "")} : ${f(val, 5)} MPa${dt.couches[i]?.moduleArrete ? " (arrêtée — rendue intacte)" : ""}</li>`).join("")}</ul></div>` : ""}
    ${r.avertissements.filter((w) => !dejaDits.has(w)).map((w) => `<p class="method-note">⚠ ${esc(w)}</p>`).join("")}`;
}

function rendu(v, ctx, profil, couches, essieu, reglages, res, teq) {
  const calees = couches.map((c, i) => ({ ...c, E: res.modules[i] }));
  const mesure = couches.map((c, i) => ({ ...c, E: res.modulesMesure[i] }));
  const indiceSol = indiceDuSol(couches);
  // La coupe ne montre pas le massif rigide ni les 6 m du sol conventionnel : le sol y redevient semi-infini.
  const coupe = calees.length > 2 && calees[calees.length - 1].E >= SEUIL_SUBSTRATUM_MPA
    ? calees.slice(0, -1).map((c, i, t) => (i === t.length - 1 ? { ...c, h: Infinity } : c)) : calees;
  const decal = reglages.mode === "bassin" ? reglages.decalages : [0, 0.3, 0.6, 0.9, 1.2, 1.5];
  const etendue = Math.max(1.5, ...decal);
  const pts = Array.from({ length: 25 }, (_, i) => (etendue * i) / 24);
  const calc = bassin(mesure, essieu, pts);
  const fig = figureBassin(pts.map((y, i) => ({ y, d: calc[i] })), {
    largeur: 600, mesures: reglages.mode === "bassin" ? reglages.decalages.map((y, i) => [y, reglages.deflexions[i]]) : [[0, reglages.d0]] });
  const tabModules = `<table class="resultats"><thead><tr><th>Couche</th><th>Matériau</th><th>Statut</th><th class="num">E de départ (MPa)</th><th class="num">E calé (MPa)</th></tr></thead><tbody>
    ${couches.map((c, i) => `<tr class="${(res.methode === "deux-temps" ? i === indiceSol || (c.famille === "bitumineux" && i < indiceSol) : c.contrainte === "libre") ? "ligne-retenue" : ""}">
      <td>${esc(c.nom)}</td><td>${esc(c.materiau ?? "—")}</td><td class="motif">${esc(statutDe(c, i, res, indiceSol))}</td>
      <td class="num">${f(res.methode === "deux-temps" ? c.E : res.departs[i] ?? c.E, 4)}</td><td class="q">${f(res.modules[i], 4)}</td></tr>`).join("")}</tbody></table>`;
  const tabMesures = `<table class="resultats"><thead><tr><th>Grandeur</th><th class="num">Mesuré</th><th class="num">Calculé</th><th class="num">Écart</th><th class="num">Écart (%)</th></tr></thead><tbody>
    ${res.lignes.map((l) => `<tr><td>${esc(l.libelle)}</td><td class="num">${n3(l.mesure)}</td><td class="num">${n3(l.calcule)}</td>
      <td class="num">${n3(l.calcule - l.mesure)}</td><td class="num">${n3(((l.calcule - l.mesure) / l.mesure) * 100)}</td></tr>`).join("")}</tbody></table>`;
  const s = syntheseAuscultation(ctx.valeurs?.("auscultation"));
  const rapport = res.deuxTemps ? rapportDeuxTemps({ ...res.deuxTemps, couches }, s) : "";
  const synthese = `<p class="final-result bureau-verdict${res.converge ? "" : " ko"}">${pastille(res.converge, "calage convergé", "calage non convergé")} ${esc(res.statut)}</p>
    <p class="method-note">${esc(res.diagnostic)}${reglages.mode === "benkelman" ? ` ${esc(aideRdc(reglages))}` : ""}</p>
    ${res.avertissement ? `<div class="piege"><strong>Attention</strong><p>${esc(res.avertissement)}</p></div>` : ""}
    ${res.converge && res.rms > ECART_SUSPECT_POURCENT ? `<div class="piege"><p>${esc(messageQualite(res))}</p></div>` : ""}
    ${tabModules}${tabMesures}${rapport}
    <div class="actions"><button class="secondary" id="appliquerCales">Appliquer : écrire les E calés dans le tableau</button>
      <button class="secondary" id="versRenfo">Appliquer au Renforcement →</button></div>`;
  const libres = nombreLibres(couches), nm = nombreMesures(reglages);
  const noteCalage = res.methode === "deux-temps"
    ? `<p>Calage en deux temps du guide Cerema/IDRRIM 2016 (${esc(REFERENCE_CALAGE_DEUX_ETAPES)}) : ${esc(PRINCIPE_CALAGE_DEUX_ETAPES)}
        Température des mesures ${f(res.deuxTemps.tMesure, 3)} °C, vitesse ${res.deuxTemps.vitesse === null ? `non renseignée (${f(VITESSE_DEFAUT_KMH, 2)} km/h retenus)` : `${f(res.deuxTemps.vitesse, 3)} km/h`}, modules exprimés à θeq = ${f(teq, 3)} °C.</p>
       ${tabMesures}<p>Écart quadratique moyen relatif : ${n3(res.rms)} % ; ${res.converge ? "calage abouti" : "calage incomplet"}.</p>${rapport}${tabModules}`
    : `<table class="resultats"><tbody>
        <tr><th>Mode de mesure</th><td>${reglages.mode === "benkelman" ? (reglages.rdc !== null ? "poutre Benkelman (d0 et Rdc)" : "poutre Benkelman (d0 seule)") : `bassin de déflexion (${reglages.deflexions.length} points)`}</td></tr>
        <tr><th>Modules recherchés n</th><td>${libres}</td></tr><tr><th>Mesures calées m</th><td>${nm}</td></tr>
        ${res.lignes.map((l) => `<tr><th>${esc(l.libelle)}</th><td>mesure → calcul : ${n3(l.mesure)} → ${n3(l.calcule)} ; écart ${n3(l.calcule - l.mesure)} (${n3(((l.calcule - l.mesure) / l.mesure) * 100)} %)</td></tr>`).join("")}
        <tr><th>Écart quadratique moyen relatif</th><td>${n3(res.rms)} %</td></tr>
        <tr><th>Convergence</th><td>${res.converge ? `atteinte en ${res.iterations} itérations` : "non atteinte"} (tolérance relative 10<sup>−10</sup>, ${reglages.iterationsMax} itérations au plus)</td></tr>
      </tbody></table>${tabModules}
      <p>${res.sousDetermine
        ? "Système sous-déterminé : il y a moins de mesures que de modules recherchés. Une infinité de jeux de modules reproduisent exactement les mêmes mesures ; celui retenu découle du point de départ indiqué ci-dessus, et n'a donc aucun caractère unique. Les modules issus de ce calage ne valent que comme ordre de grandeur, sauf à être confortés par une mesure supplémentaire (rayon de courbure, bassin de déflexion) ou par une hypothèse de liaison entre couches (rapport imposé)."
        : "Modules obtenus par minimisation des écarts mesure / calcul (Levenberg-Marquardt sur les logarithmes des modules, moteur direct de Burmister inchangé)."}</p>`;
  const note = `<h3>1. Mesures</h3><p>${reglages.mode === "bassin" ? `Bassin de déflexion : ${reglages.decalages.map((y, i) => `${fd(y, 2)} m → ${f(reglages.deflexions[i], 3)}`).join(" ; ")} (mm/100).`
      : `Déflexion d0 = ${f(reglages.d0, 4)} mm/100${reglages.rdc ? ` ; rayon de courbure Rdc = ${f(reglages.rdc, 4)} m` : " ; rayon de courbure non mesuré"}.`} Chargement : ${esc(texteEssieu(essieu))}.</p>
    ${s && reglages.mode === "benkelman" && Math.abs(reglages.d0 - Math.round(s.d0 * 100) / 100) < 1e-9
      ? `<p>Valeurs reprises du module Auscultation. ${esc(s.resume)}</p>` : ""}
    <h3>2. Modèle de calcul</h3><p>${esc(profil.nom)} ; modules des matériaux à θeq = ${f(teq, 3)} °C quand ils ne sont pas saisis.</p>${tableauStructure(couches)}
    <h3>3. Calage</h3>${noteCalage}
    ${res.avertissement ? `<p><strong>Avertissement :</strong> ${esc(res.avertissement)}</p>` : ""}`;
  // En gris : le module retenu des lignes sans module saisi, et le départ d'un module recherché.
  const indications = couches.map((c, i) => ({ valeurs: {
    E: f(c.E, 4), nu: fd(c.nu, 2), ...(c.contrainte === "libre" ? { depart: f(c.E, 4) } : {}),
  } }));
  const proposes = { teq: f(profil.teqPropose?.("renforcement") ?? 15, 3), tMesure: "15", rayonCalage: reglages.rdc ? n3(reglages.rdc) : "" };
  return {
    figure: `${coupeChaussee(coupe, { essieu, largeur: 600 })}${fig}`, synthese, note, verdict: res.converge ? null : false,
    etat: res.converge ? `calé (${fd(res.rms, 2)} %)` : "non calé", calees, calage: res, indications, proposes,
  };
}
