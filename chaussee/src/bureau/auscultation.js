// Module « Auscultation » : une campagne de déflexions dépouillée — soit à la
// manière du guide Cerema/IDRRIM 2016 (correction de température, sections
// élémentaires, déflexion au fractile 97,5 %, rayon au 2ᵉ décile), soit à la
// manière du manuel CEBTP 1985 (dc = m + kσ, grille état apparent × seuils
// d1/d2 du pays, classe de qualité Q1 à Q5). Comme l'onglet Auscultation de
// Burmister-Calc, il alimente le Rétrocalcul (valeurs à caler) et le
// Renforcement (syntheseAuscultation).

import {
  creerCampagne, coefficientK, LONGUEUR_SECTION_M, TEMPERATURE_REFERENCE_DEFLEXION_C,
  REGLE_TEMPERATURE_REFERENCE, REGLE_SONDE_TEMPERATURE,
} from "../chaussee/renforcement/campagne-deflexion.js";
import {
  lireDeflexions, statistiquesDeflexion, classerQualite, seuilsDeflexionPour, SEUILS_DEFLEXION_PAYS,
  ETATS_APPARENTS, libelleEtatApparent, K_TROPICAL, K_FRANCE,
} from "../chaussee/renforcement/auscultation.js";
import {
  classerDeflexionCerema, classerRayonCerema, niveauDeflexionCerema, niveauRayonCerema, motNiveau, decrireRegle,
  valeurCaracteristique, classerDeflexionTunisie, RESERVE_LECTURE_CEREMA, REFERENCE_CLASSES_CEREMA,
  REFERENCE_CLASSES_TUNISIE, LONGUEUR_SECTION_TUNISIE_M, K_TUNISIE,
} from "../chaussee/renforcement/baremes-deflexion.js";
import { mesuresDepuisCampagne } from "../chaussee/renforcement/mise-en-place.js";
import { graphe, COULEURS } from "../figures.js";
import { esc, f, fd, nombre } from "./commun.js";
import { optionsPays } from "./dimensionnement.js";

export const OPT_PORTEE = [
  ["zone-homogene", "Zone homogène — linéaire ausculté en continu"],
  ["section-temoin", "Section témoin — quelques dizaines de mètres instrumentés"],
];
// Le type de structure de l'auscultation n'est pas celui du dimensionnement : il ne sert
// qu'au coefficient K de la correction de température (Cerema, tableau 6).
export const OPT_TYPE_CHAUSSEE = [
  ["souple", "Chaussée souple (K = 0,15)"], ["bitumineuse-epaisse", "Chaussée bitumineuse épaisse (K = 0,20)"],
  ["mixte", "Chaussée mixte (K = 0,08)"], ["semi-rigide", "Chaussée semi-rigide (K = 0,04)"],
];
const OPT_K = [[String(K_TROPICAL), "1,3 — 10 % de dépassement (pays tropicaux)"], [String(K_FRANCE), "2,0 — 2,5 % de dépassement"]];

// Campagne d'exemple, dans l'ordre des colonnes de Burmister-Calc : 60 points tous les 10 m sur
// 600 m, une zone plus faible au milieu, et une mesure aberrante écartée (« x »).
const EXEMPLE = ["PK (m) ; d (1/100 mm) ; θ (°C) ; Rdc (m) ; écarté", ...Array.from({ length: 60 }, (_, i) => {
  const pk = i * 10;
  const base = pk >= 220 && pk < 400 ? 78 : 46;
  const d = base + 12 * Math.sin(i * 1.7) + 6 * Math.cos(i * 0.9);
  const t = 18 + 6 * Math.sin(i / 9);
  if (i === 31) return `${pk} ; 165 ; ${t.toFixed(1)} ; 120 ; x`;
  return `${pk} ; ${d.toFixed(0)} ; ${t.toFixed(1)} ; ${(Math.max(90, 520 - 4.5 * d)).toFixed(0)}`;
})].join("\n");
const EXEMPLE_CEBTP = "62 71 55 80 66 59 74 90 68 63 77 58 70 85 61 69 73 64 81 67";

/** Température de référence et longueur de section proposées par le pays (Burmister-Calc). */
export const referencesProposees = (pays) => (pays === "tunisie"
  ? { tRef: 28, longueur: LONGUEUR_SECTION_TUNISIE_M }
  : { tRef: TEMPERATURE_REFERENCE_DEFLEXION_C, longueur: LONGUEUR_SECTION_M });

/** Les classes de déflexion du Cerema (tableau 7) sont définies à 15 °C, et nulle part ailleurs. */
export const classesCeremaApplicables = (tRef) => Math.abs(tRef - TEMPERATURE_REFERENCE_DEFLEXION_C) < 0.05;
export const CLASSES_NON_APPLICABLES = "classes Cerema de déflexion non applicables hors 15 °C";

// ─────────────────────────────── Lecture du relevé ───────────────────────────

/** Une cellule : virgule décimale acceptée ; vide ou illisible → null. */
function cellule(t) {
  const s = String(t ?? "").replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s) ? parseFloat(s) : null;
}

/**
 * Relevé collé d'un tableur, une ligne par point, dans l'ordre de Burmister-Calc :
 * PK (m) ; déflexion (1/100 mm) ; température (°C) ; rayon (m) ; « x » pour écarter le point.
 * Une ligne qui contient « ; » ou une tabulation est découpée sur chacun d'eux — deux
 * séparateurs de suite laissent une cellule VIDE (température ou rayon non relevés), au lieu
 * de décaler les colonnes ; sinon, sur les blancs. Une ligne sans PK ni déflexion lisibles
 * (en-tête, commentaire) est ignorée et comptée.
 * Renvoie { lectures: [{ pk, deflexion, temperature, rayon, exclu }], lues, ignorees }.
 */
export function lireReleve(texte) {
  const lectures = [];
  let ignorees = 0;
  for (const brute of String(texte ?? "").split(/\r?\n/)) {
    const ligne = brute.trim();
    if (!ligne) continue;
    const c = /[;\t]/.test(ligne) ? ligne.split(/[;\t]/) : ligne.split(/\s+/);
    const pk = cellule(c[0]), d = cellule(c[1]);
    if (c.length < 2 || pk === null || d === null) { ignorees++; continue; }
    const t = cellule(c[2]), r = cellule(c[3]);
    lectures.push({ pk, deflexion: d, temperature: t ?? NaN, rayon: r > 0 ? r : null, exclu: /^x$/i.test(String(c[4] ?? "").trim()) });
  }
  return { lectures, lues: lectures.length, ignorees };
}

/** « n point(s) lus, m ligne(s) ignorée(s) », comme le collage de Burmister-Calc. */
export function texteLecture(l) {
  const exclus = l.lectures.filter((x) => x.exclu).length;
  return `${l.lues} point(s) lus${exclus ? ` (dont ${exclus} écarté${exclus > 1 ? "s" : ""})` : ""}${l.ignorees ? `, ${l.ignorees} ligne(s) ignorée(s)` : ""}.`;
}

// ──────────────────────────────── Dépouillements ─────────────────────────────

/** Règle de correction affichée, avec K et, hors 15 °C, le coefficient c de transposition. */
export function regleCorrection(typeChaussee, tRef) {
  const K = coefficientK(typeChaussee);
  const c = 1 + (K * (tRef - 15)) / 15;
  return `d${f(tRef, 3)} °C = d mesurée / (1 + K × (θ − 15) / 15), K = ${fd(K, 2)}`
    + (classesCeremaApplicables(tRef) ? "" : `, puis × c = 1 + K × (${f(tRef, 3)} − 15) / 15 = ${fd(c, 3)} pour passer de 15 à ${f(tRef, 3)} °C`);
}

/** Dépouillement Cerema d'après les valeurs du module ; lève une erreur si rien n'est exploitable. */
function depouillerCerema(v) {
  const lecture = lireReleve(v.releve);
  if (!lecture.lectures.length) throw new Error("aucune mesure lisible : une ligne « PK ; déflexion ; température ; rayon » par point");
  const prop = referencesProposees(v.pays);
  const tRef = nombre(v.tReference, prop.tRef), L = nombre(v.longueurSection, prop.longueur);
  if (!(L > 0)) throw new Error("longueur des sections élémentaires : valeur positive attendue");
  const vitesse = nombre(v.vitesse, NaN);
  const type = OPT_TYPE_CHAUSSEE.some(([k]) => k === v.typeChaussee) ? v.typeChaussee : "souple";
  const portee = v.portee === "section-temoin" ? "section-temoin" : "zone-homogene";
  const camp = creerCampagne(lecture.lectures, type, portee, { temperatureReference: tRef, vitesse: Number.isFinite(vitesse) ? vitesse : null });
  const retenues = camp.retenues();
  if (!retenues.length) throw new Error("tous les points sont écartés : aucune mesure retenue");
  const classes = classesCeremaApplicables(tRef);
  const sections = camp.sections(L).map((s) => ({
    ...s,
    classeD: classes ? classerDeflexionCerema(s.deflexionCaracteristique)?.nom ?? null : null,
    classeR: s.rayonCaracteristique == null ? null : classerRayonCerema(s.rayonCaracteristique)?.nom ?? null,
  }));
  const tout = camp.ensemble();
  const bD = classes ? classerDeflexionCerema(tout.deflexionCaracteristique) : null;
  const bR = tout.rayonCaracteristique == null ? null : classerRayonCerema(tout.rayonCaracteristique);
  // À 28 °C, la lecture tunisienne — sur SA règle, dm + 1,3σ, jamais sur le seuil à 97,5 %.
  let tunisie = null;
  if (Math.abs(tRef - 28) < 0.05) {
    const dc = valeurCaracteristique(retenues.map(camp.deflexionCorrigee), "moyenne-k-sigma", K_TUNISIE);
    tunisie = { dc, bitumineuse: type !== "souple", classe: classerDeflexionTunisie(dc, type !== "souple")?.nom ?? null };
  }
  return {
    lecture, tRef, L, type, portee, camp, sections, tout, classes, bD, bR, tunisie,
    exclus: lecture.lectures.filter((l) => l.exclu).length,
    alertes: camp.avertissements(L), mesures: mesuresDepuisCampagne(camp),
  };
}

/** Résumé de la campagne, comme l'onglet Auscultation de Burmister-Calc. */
function resumeCerema(dep) {
  const { tout, tRef, bD, bR, classes, tunisie } = dep;
  return `${dep.camp.retenues().length} point(s) du PK ${f(tout.debutPk, 6)} au PK ${f(tout.finPk, 6)} — `
    + `déflexion caractéristique ${fd(tout.deflexionCaracteristique, 1)} (1/100 mm) à ${f(tRef, 3)} °C`
    + (bD ? `, classe ${bD.nom}` : "")
    + (tout.rayonCaracteristique != null ? ` · rayon caractéristique ${f(tout.rayonCaracteristique, 4)} m${bR ? `, classe ${bR.nom}` : ""}` : " · rayon non mesuré")
    + (classes ? "" : ` · ${CLASSES_NON_APPLICABLES}`)
    + (tunisie ? ` · fascicule 6 tunisien : dm + ${fd(K_TUNISIE, 1)}σ = ${fd(tunisie.dc, 1)} (1/100 mm)${tunisie.classe ? `, classe ${tunisie.classe}` : ""}` : "");
}

const ligneNote = (libelle, valeur) => `<tr><th>${libelle}</th><td>${valeur}</td></tr>`;

/** Section « Auscultation » de la note (Cerema), reprise par le Renforcement. */
function noteCerema(dep) {
  const { tout, tRef, bD, bR, classes, tunisie, mesures } = dep;
  const portee = OPT_PORTEE.find(([k]) => k === dep.portee)[1];
  const regle = `déflexion : ${decrireRegle("centile-97,5")}${tout.rayonCaracteristique != null ? ` ; rayon : ${decrireRegle("deuxieme-decile")}` : ""}`;
  return `<h3>Auscultation</h3><table class="resultats note-auscultation"><tbody>
    ${ligneNote("Étendue de la campagne", esc(portee))}
    ${ligneNote("Points de mesure retenus", `${dep.camp.retenues().length}${dep.exclus ? ` (${dep.exclus} écarté${dep.exclus > 1 ? "s" : ""})` : ""} — ${dep.sections.length} section(s) élémentaire(s) de ${f(dep.L, 4)} m`)}
    ${ligneNote("Température de référence", `d corrigée à ${f(tRef, 3)} °C — ${esc(regleCorrection(dep.type, tRef))}`)}
    ${ligneNote("Règle de la valeur caractéristique", esc(regle))}
    ${ligneNote("Déflexion caractéristique d<sub>car</sub>", `<strong>${fd(tout.deflexionCaracteristique, 1)} (1/100 mm)</strong>${bD ? ` — classe ${esc(bD.nom)} (${esc(bD.plage)}) — ${motNiveau(niveauDeflexionCerema(bD.nom))}` : classes ? "" : ` — ${CLASSES_NON_APPLICABLES} (tableau 7, défini à 15 °C)`}`)}
    ${tout.rayonCaracteristique != null
      ? ligneNote("Rayon de courbure caractéristique R<sub>car</sub>", `<strong>${f(tout.rayonCaracteristique, 4)} m</strong>${bR ? ` — classe ${esc(bR.nom)} (${esc(bR.plage)}) — ${motNiveau(niveauRayonCerema(bR.nom))}` : ""}`)
      : ligneNote("Rayon de courbure", "non mesuré : le diagnostic repose sur la seule déflexion, ce qui ne permet pas de distinguer un défaut de surface d'un défaut de support.")}
    ${tout.rayonMedian != null ? ligneNote("Rayon médian", `${f(tout.rayonMedian, 4)} m — ${esc(mesures.regleRayon)}`) : ""}
    ${tunisie ? ligneNote("Fascicule 6 tunisien", `dc = dm + ${fd(K_TUNISIE, 1)}σ = ${fd(tunisie.dc, 1)} (1/100 mm) à 28 °C${tunisie.classe ? ` — classe ${esc(tunisie.classe)} (chaussée ${tunisie.bitumineuse ? "bitumineuse" : "souple"})` : ""} — ${esc(REFERENCE_CLASSES_TUNISIE)}`) : ""}
  </tbody></table>
  <p class="method-note">${esc(RESERVE_LECTURE_CEREMA)} ${esc(REFERENCE_CLASSES_CEREMA)}.</p>
  ${dep.alertes.length ? `<div class="piege"><strong>Réserves</strong>${dep.alertes.map((a) => `<p>${esc(a)}</p>`).join("")}</div>` : ""}`;
}

/** Dépouillement CEBTP 1985. */
function depouillerCebtp(v) {
  const vals = lireDeflexions(v.serie);
  if (vals.length < 2) throw new Error("au moins deux déflexions sont nécessaires");
  const k = nombre(v.coefK, K_TROPICAL);
  const st = statistiquesDeflexion(vals, k);
  const s = seuilsDeflexionPour(v.paysSeuils);
  const etat = ETATS_APPARENTS.includes(v.etat) ? v.etat : "bon";
  const q = classerQualite(st.dc, etat, s);
  return { vals, k, st, s, etat, q };
}

function noteCebtp(dep) {
  const { vals, k, st, s, etat, q } = dep;
  return `<h3>Auscultation</h3><table class="resultats note-auscultation"><tbody>
    ${ligneNote("Méthode", "manuel CEBTP 1985 — série de déflexions")}
    ${ligneNote("Mesures", `${vals.length} ; moyenne m = ${fd(st.moyenne, 2)} (1/100 mm) ; écart-type (n − 1) σ = ${fd(st.ecartType, 2)} (1/100 mm)`)}
    ${ligneNote("Déflexion caractéristique", `<strong>dc = m + k·σ = ${fd(st.dc, 1)} (1/100 mm)</strong>, k = ${fd(k, 1)}`)}
    ${ligneNote("État apparent", esc(libelleEtatApparent(etat)))}
    ${ligneNote(`Seuils de ${esc(s.pays)}`, `d1 = ${f(s.d1Min, 3)}${s.d1Max !== s.d1Min ? `–${f(s.d1Max, 3)}` : ""}, d2 = ${f(s.d2Min, 3)}${s.d2Max !== s.d2Min ? `–${f(s.d2Max, 3)}` : ""} (1/100 mm)`)}
    ${ligneNote("Classe de qualité", `<strong>${esc(q.classeQualite)}</strong> — ${esc(q.note)}`)}
  </tbody></table>`;
}

// ───────────────────────────── Passerelles du bureau ─────────────────────────

/**
 * Ce que l'auscultation transmet aux autres modules (Rétrocalcul, Renforcement). `va` : valeurs
 * du module (ctx.valeurs("auscultation")), éventuellement absentes. Ne lève jamais d'erreur ;
 * null si rien n'est exploitable. Voir le contrat dans le compte rendu de la fusion :
 * { methode, disponible, d0, rdc, rayonMedian, rayonCalage, regleRayon, temperature, vitesse,
 *   proposition, noteRayonMedian, typeStructure, classeD, classeR, niveauD, niveauR, resume,
 *   noteHtml, qualite, lectureTunisie }.
 */
export function syntheseAuscultation(va) {
  if (!va || typeof va !== "object") return null;
  try {
    if (va.methode === "cebtp") {
      const dep = depouillerCebtp(va);
      return {
        methode: "cebtp", disponible: true, d0: dep.st.dc, rdc: null, rayonMedian: null, rayonCalage: null, regleRayon: "",
        temperature: null, vitesse: null,
        proposition: `Le dépouillement CEBTP 1985 donne une déflexion caractéristique dc = ${fd(dep.st.dc, 1)} (1/100 mm), `
          + `classe de qualité ${dep.q.classeQualite}, sans rayon de courbure. C'est cette valeur qu'il faut caler, et non une mesure isolée.`,
        noteRayonMedian: "", typeStructure: null, classeD: null, classeR: null, niveauD: null, niveauR: null,
        resume: `Mesuré : dc = m + ${fd(dep.k, 1)}σ = ${fd(dep.st.dc, 1)} (1/100 mm), classe de qualité ${dep.q.classeQualite} ; rayon non mesuré.`,
        noteHtml: noteCebtp(dep),
        qualite: { dc: dep.st.dc, classeQualite: dep.q.classeQualite, bande: dep.q.bande, note: dep.q.note },
        lectureTunisie: null,
      };
    }
    const dep = depouillerCerema(va);
    const m = dep.mesures;
    if (!m.disponible) return null;
    const classeD = dep.bD?.nom ?? null, classeR = dep.bR?.nom ?? null;
    return {
      methode: "cerema", disponible: true, d0: m.d0, rdc: m.rdc, rayonMedian: m.rayonMedian, rayonCalage: m.rayonCalage,
      regleRayon: m.regleRayon, temperature: m.temperature, vitesse: m.vitesse, proposition: m.proposition,
      noteRayonMedian: m.noteRayonMedian, typeStructure: dep.type,
      classeD, classeR, niveauD: niveauDeflexionCerema(classeD), niveauR: niveauRayonCerema(classeR),
      resume: `Mesuré : d caractéristique ${fd(m.d0, 1)} (1/100 mm)`
        + (m.rdc != null ? `, rayon ${f(m.rdc, 4)} m.` : ", rayon non mesuré."),
      noteHtml: noteCerema(dep), qualite: null, lectureTunisie: dep.tunisie,
    };
  } catch {
    return null;
  }
}

/**
 * Valeurs que « Reprendre les valeurs de l'auscultation » écrit dans le Rétrocalcul (mode
 * Benkelman, d0 à 0,01 près, Rdc à 0,1 m près ou vide) et le message qui l'annonce. Le calage
 * en deux temps reçoit aussi le rayon de calage (médian pour une chaussée souple), la
 * température de référence et la vitesse de la campagne. Null si `s` n'est pas exploitable.
 */
export function repriseRetrocalcul(s) {
  if (!s?.disponible || !(s.d0 > 0)) return null;
  const arr = (x, d) => String(Math.round(x * 10 ** d) / 10 ** d);
  const d0 = arr(s.d0, 2), rdc = s.rdc > 0 ? arr(s.rdc, 1) : "";
  const valeurs = { mode: "benkelman", d0, rdc, rayonCalage: s.rayonCalage > 0 ? arr(s.rayonCalage, 1) : "" };
  if (Number.isFinite(s.temperature)) valeurs.tMesure = String(s.temperature);
  if (Number.isFinite(s.vitesse)) valeurs.vitesse = String(s.vitesse);
  const message = rdc
    ? `Déflexion et rayon caractéristiques repris de l'auscultation (${fd(s.d0, 1)} et ${rdc.replace(".", ",")} m).`
    : `Déflexion caractéristique reprise de l'auscultation (${fd(s.d0, 1)}). Rayon non mesuré : le calage portera sur la seule déflexion.`;
  return { valeurs, message };
}

// ──────────────────────────────────── Module ─────────────────────────────────

export default {
  id: "auscultation", groupe: "Renforcement", icone: "⌇", titre: "Auscultation", sous: "déflexions, sections homogènes, qualité",
  entete: "Auscultation de la chaussée existante",
  description: "Une campagne de déflexions dépouillée : correction de température et sections élémentaires (guide Cerema/IDRRIM 2016), ou déflexion caractéristique et classe de qualité des pays tropicaux (manuel CEBTP 1985). Ses valeurs caractéristiques passent au Rétrocalcul et au Renforcement.",
  champs: [
    ["Méthode", [
      ["methode", "Dépouillement", "choix", "cerema", [["cerema", "Cerema/IDRRIM 2016 — campagne au PK"], ["cebtp", "CEBTP 1985 — série de déflexions"]]],
      ["pays", "Référentiel (température et sections proposées)", "choix", "france", optionsPays, (v) => v.methode !== "cebtp"],
      ["portee", "Portée", "choix", "zone-homogene", OPT_PORTEE, (v) => v.methode !== "cebtp"],
      ["typeChaussee", "Structure (correction de température)", "choix", "souple", OPT_TYPE_CHAUSSEE, (v) => v.methode !== "cebtp"],
      ["tReference", "Température de référence (vide : proposée)", "°C", "", (v) => v.methode !== "cebtp"],
      ["longueurSection", "Sections élémentaires de (vide : proposée)", "m", "", (v) => v.methode !== "cebtp"],
      ["vitesse", "Vitesse de mesure (vide : non renseignée)", "km/h", "", (v) => v.methode !== "cebtp"],
      ["paysSeuils", "Seuils d1/d2 du pays", "choix", "Côte d'Ivoire", SEUILS_DEFLEXION_PAYS.map((s) => [s.pays, s.pays]), (v) => v.methode === "cebtp"],
      ["etat", "État apparent", "choix", "bon", ETATS_APPARENTS.map((e) => [e, libelleEtatApparent(e)]), (v) => v.methode === "cebtp"],
      ["coefK", "Coefficient k de dc = m + kσ", "choix", String(K_TROPICAL), OPT_K, (v) => v.methode === "cebtp"],
    ]],
    ["Mesures", [
      ["releve", "Une mesure par ligne : PK (m) ; déflexion (1/100 mm) ; température (°C) ; rayon Rdc (m) ; « x » pour écarter le point — les trois dernières facultatives", "texte", EXEMPLE, (v) => v.methode !== "cebtp"],
      ["serie", "Déflexions (1/100 mm), collées d'un tableur", "texte", EXEMPLE_CEBTP, (v) => v.methode === "cebtp"],
    ]],
  ],
  apresSaisie(v) {
    if (v.methode === "cebtp") return `<h3>Lecture</h3><p class="method-note" id="auscStatut"></p>`;
    return `<h3>Correction de température</h3>
      <p class="formula" id="auscRegle"></p>
      <p class="method-note">${esc(REGLE_TEMPERATURE_REFERENCE)}</p>
      <p class="method-note">${esc(REGLE_SONDE_TEMPERATURE)}</p>
      <p class="method-note">Déflexion caractéristique : seuil à 97,5 % des mesures. Rayon caractéristique : 2ᵉ décile. Le rayon médian, reporté à part, sert à ajuster les modules bitumineux.</p>
      <p class="method-note" id="auscStatut"></p>`;
  },
  calculer(v) {
    return v.methode === "cebtp" ? calculerCebtp(v) : calculerCerema(v);
  },
  apresCalcul(app, v, ctx, r) {
    const statut = app.querySelector("#auscStatut");
    if (statut) statut.textContent = r.statut ?? "";
    const regle = app.querySelector("#auscRegle");
    if (regle) regle.textContent = r.regle ?? "";
    app.querySelector("#versRetro")?.addEventListener("click", () => {
      const rep = repriseRetrocalcul(syntheseAuscultation(v));
      if (!rep) return;
      ctx.envoyer("retrocalcul", rep.valeurs, rep.message);
    });
    app.querySelector("#versCatalogue")?.addEventListener("click", () => {
      ctx.envoyer("catalogue", { pays: "tropical", source: "renforcement", classePortance: r.classeQualite, classeTrafic: "", famille: "" },
        `Fiches de renforcement ${r.classeQualite} du manuel CEBTP.`);
    });
  },
};

function calculerCerema(v) {
  const dep = depouillerCerema(v);
  const { camp, sections, tout, alertes, L, tRef, classes } = dep;
  const pts = camp.retenues().slice().sort((a, b) => a.pk - b.pk);
  const exclus = dep.lecture.lectures.filter((l) => l.exclu);
  const tousPk = dep.lecture.lectures.map((l) => l.pk);
  const dMax = Math.max(...dep.lecture.lectures.map((l) => l.deflexion), ...pts.map((l) => camp.deflexionCorrigee(l)), ...sections.map((s) => s.deflexionCaracteristique));
  const xmin = Math.min(...tousPk), xmax = Math.max(...tousPk);
  const figure = graphe({
    largeur: 600, hauteur: 300, xmin, xmax: xmax > xmin ? xmax : xmin + 1, ymin: 0, ymax: dMax * 1.1,
    xlabel: "PK (m)", ylabel: "déflexion (1/100 mm)",
    series: [
      { points: pts.map((l) => [l.pk, l.deflexion]), couleur: COULEURS.discret, nuage: true, rayon: 2.5, libelle: "mesurée" },
      { points: pts.map((l) => [l.pk, camp.deflexionCorrigee(l)]), couleur: COULEURS.bleu, epaisseur: 1.6, libelle: `ramenée à ${f(tRef, 3)} °C` },
      ...(exclus.length ? [{ points: exclus.map((l) => [l.pk, l.deflexion]), couleur: COULEURS.violet, nuage: true, rayon: 3, libelle: "écartée" }] : []),
      ...sections.map((s, i) => ({ points: [[s.debutPk, s.deflexionCaracteristique], [s.finPk, s.deflexionCaracteristique]], couleur: COULEURS.rouge, epaisseur: 2.6, libelle: i === 0 ? "valeur caractéristique (97,5 %)" : undefined })),
    ],
  });
  const cl = (x) => (x ? esc(x) : "—");
  const tab = `<table class="resultats"><thead><tr><th>Section</th><th class="num">Points</th><th class="num">d car. (1/100 mm)</th><th>Classe D</th><th class="num">R car. 2ᵉ décile (m)</th><th>Classe R</th><th class="num">R médian (m)</th></tr></thead><tbody>
    ${sections.map((s) => `<tr class="${s.assezDePoints ? "" : "alerte"}"><td>${esc(s.libelle)}</td><td class="num">${s.nombrePoints}</td><td class="q">${fd(s.deflexionCaracteristique, 1)}</td><td>${cl(s.classeD)}</td>
      <td class="num">${s.rayonCaracteristique == null ? "—" : f(s.rayonCaracteristique, 4)}</td><td>${cl(s.classeR)}</td><td class="num">${s.rayonMedian == null ? "—" : f(s.rayonMedian, 4)}</td></tr>`).join("")}
    <tr class="ligne-retenue"><td><strong>Ensemble</strong></td><td class="num">${tout.nombrePoints}</td><td class="q">${fd(tout.deflexionCaracteristique, 1)}</td><td>${cl(dep.bD?.nom)}</td>
      <td class="num">${tout.rayonCaracteristique == null ? "—" : f(tout.rayonCaracteristique, 4)}</td><td>${cl(dep.bR?.nom)}</td><td class="num">${tout.rayonMedian == null ? "—" : f(tout.rayonMedian, 4)}</td></tr></tbody></table>
    ${classes ? "" : `<p class="method-note">Campagne ramenée à ${f(tRef, 3)} °C : ${CLASSES_NON_APPLICABLES} (tableau 7). Le rayon, non corrigé en température, garde sa classe.</p>`}`;
  const synthese = `<p class="final-result bureau-verdict">${esc(resumeCerema(dep))}</p>
    ${alertes.length ? `<div class="piege"><strong>Réserves</strong>${alertes.map((a) => `<p>${esc(a)}</p>`).join("")}</div>` : ""}${tab}
    <p class="method-note">Deux sections voisines de valeurs caractéristiques proches forment une même zone homogène ; une rupture nette marque une limite de zone. ${esc(dep.mesures.regleRayon)}</p>
    <button class="secondary" id="versRetro">Reprendre dans le Rétrocalcul →</button>`;
  const note = `<h3>1. Méthode</h3><p>Guide Cerema/IDRRIM 2016 : chaque déflexion est ramenée à ${f(tRef, 3)} °C
      (${esc(OPT_TYPE_CHAUSSEE.find(([k]) => k === dep.type)[1])}) par ${esc(regleCorrection(dep.type, tRef))} ;
      le linéaire est découpé en sections élémentaires de ${f(L, 4)} m, chacune représentée par la déflexion au fractile 97,5 % et le rayon de courbure au 2ᵉ décile.</p>
    <p>${esc(REGLE_TEMPERATURE_REFERENCE)}</p>
    ${noteCerema(dep).replace("<h3>Auscultation</h3>", "<h3>2. Valeurs caractéristiques</h3>")}
    <h3>3. Sections élémentaires</h3>${tab}`;
  return {
    figure, synthese, note, verdict: null, etat: `d car. ${fd(tout.deflexionCaracteristique, 0)} (1/100 mm)`,
    proposes: { tReference: f(referencesProposees(v.pays).tRef, 3), longueurSection: f(referencesProposees(v.pays).longueur, 4) },
    statut: texteLecture(dep.lecture),
    regle: regleCorrection(dep.type, tRef),
  };
}

function calculerCebtp(v) {
  const dep = depouillerCebtp(v);
  const { vals, k, st, s, q } = dep;
  const n = vals.length;
  const figure = graphe({
    largeur: 600, hauteur: 280, xmin: 1, xmax: n, ymin: 0, ymax: Math.max(...vals, st.dc, s.d2Max) * 1.1,
    xlabel: "point de mesure", ylabel: "déflexion (1/100 mm)",
    zones: [{ x0: 1, x1: n, y0: 0, y1: s.d1Min, couleur: "#16a34a", opacite: 0.08, libelle: "faible" },
            { x0: 1, x1: n, y0: s.d2Max, y1: Math.max(...vals, st.dc, s.d2Max) * 1.1, couleur: "#dc2626", opacite: 0.08, libelle: "élevée" }],
    series: [
      { points: vals.map((d, i) => [i + 1, d]), couleur: COULEURS.bleu, marqueurs: true, epaisseur: 1.4, libelle: "déflexions" },
      { points: [[1, st.moyenne], [n, st.moyenne]], couleur: COULEURS.discret, tirets: "5 4", libelle: "moyenne" },
      { points: [[1, st.dc], [n, st.dc]], couleur: COULEURS.rouge, epaisseur: 2.4, libelle: "dc = m + kσ" },
    ],
  });
  const synthese = `<p class="final-result bureau-verdict">dc = ${fd(st.moyenne, 1)} + ${fd(k, 1)} × ${fd(st.ecartType, 1)} = <strong>${fd(st.dc, 1)} (1/100 mm)</strong>
      → classe de qualité <strong>${esc(q.classeQualite)}</strong> (bande ${esc({ faible: "faible", intermediaire: "intermédiaire", elevee: "élevée" }[q.bande] ?? q.bande)}${q.seuilAmbigu ? ", seuil publié en fourchette" : ""})</p>
    <p class="method-note">${esc(q.note)}</p>
    ${q.celluleGrisee ? `<div class="piege"><strong>Case grisée du tableau</strong><p>Le guide juge ce classement imprécis : des sondages et carottages sont recommandés avant de conclure.</p></div>` : ""}
    <div class="actions"><button class="secondary" id="versCatalogue">Voir les fiches de renforcement ${esc(q.classeQualite)} →</button>
      <button class="ghost" id="versRetro">Reprendre dans le Rétrocalcul →</button></div>`;
  const note = `${noteCebtp(dep).replace("<h3>Auscultation</h3>", "<h3>1. Dépouillement</h3>")}
    <h3>2. Classement</h3><p>${esc(q.note)}</p>`;
  return {
    figure, synthese, note, verdict: null, etat: `dc ${fd(st.dc, 0)} · ${q.classeQualite}`,
    statut: `${n} déflexion(s) lue(s).`, classeQualite: q.classeQualite,
  };
}
