// Graves non traitées en Tunisie : subdivision selon la note circulaire 2017
// (§6.1), règle d'emploi sous grave-bitume, et grille de plafonnement du
// module des GNT en place du fascicule 6 (portage de TunisiaGntSubdivider, de
// TunisiaMaterialRules et de GranularCapScale.TunisiaFascicule6).
//
// La subdivision différencie :
//  - la catégorie de GNT : cat. 1 = GRH (K = 3) ; cat. 2 = GC 0/31,5 ou 0/20 (K = 2,5) ;
//  - la couche : base (GNT directement sous les enrobés) ou fondation ;
//  - le trafic : faible (≤ T3) ou fort (strictement > T3) ;
//  - la structure inverse : GNT entre un bitumineux au-dessus et un traité en dessous.
// Trafic faible : la base GNT prend un module fixe (cat. 1 500 MPa, cat. 2
// 400 MPa, inverse cat. 1 480 MPa), non subdivisée ; la fondation est découpée
// en sous-couches de 0,25 m, E_i = K × E_(i−1) de bas en haut, bornées au
// module de la base. Trafic fort : la base ne doit plus être en GNT (défaut de
// conception signalé) et la fondation est bornée à 360 MPa.

import { nombreSousCouches } from "./base.js";

const EP_SOUS_COUCHE = 0.25;
const ORDRE = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];

/** Trafic « fort » = classe strictement supérieure à T3 ; une classe inconnue vaut trafic faible. */
export const traficFort = (classeRisque) => ORDRE.indexOf(classeRisque) > ORDRE.indexOf("T3");

const estSupport = (couches, i) => i === couches.length - 1 || !Number.isFinite(couches[i].h);
const cleOuNom = (c) => String(c.materiau ?? c.nom ?? "").toLowerCase();

/** Catégorie de GNT : 2 pour une GC 0/31,5 - 0/20, sinon 1 (GRH). */
const categorie = (c) => {
  const s = cleOuNom(c);
  return ["cat2", "cat.2", "gc0", "gc 0", "0/31", "0/20"].some((m) => s.includes(m)) ? 2 : 1;
};

const bitumineuxAuDessus = (couches, i) => couches.slice(0, i).some((c) => c.famille === "bitumineux");
const traiteEnDessous = (couches, i) => couches.slice(i + 1).some((c) => c.famille === "hydraulique");
const moduleBase = (cat, inverse) => (cat === 1 ? (inverse ? 480 : 500) : 400);
const libelleCategorie = (cat, inverse) => (cat === 1 ? (inverse ? "GRH cat.1 inverse" : "GRH cat.1") : "GC cat.2");

/** Module de la vraie couche de base GNT (sous les enrobés) ; 500 MPa (cat. 1) à défaut. */
function moduleCoucheDeBase(couches) {
  for (let i = 0; i < couches.length; i++) {
    const c = couches[i];
    if (estSupport(couches, i) || c.famille !== "sol") continue;
    if (i > 0 && couches[i - 1].famille === "bitumineux")
      return moduleBase(categorie(c), bitumineuxAuDessus(couches, i) && traiteEnDessous(couches, i));
  }
  return 500;
}

/**
 * Subdivise les GNT d'un empilement selon la note 2017. `classeRisque` est
 * la classe de trafic T1..T8. Renvoie { couches, alertes }. Fonction pure,
 * idempotente : un second passage rend le même empilement.
 */
export function subdiviserGntTunisie(couches, classeRisque) {
  const fort = traficFort(classeRisque);
  const alertes = [];
  const plafondFaible = moduleCoucheDeBase(couches);
  const res = [];   // { couche, role: "passive" | "base" | "fondation", K, plafond, E }

  couches.forEach((c, i) => {
    const estGnt = c.famille === "sol" && !estSupport(couches, i);
    if (!estGnt) { res.push({ couche: { ...c }, role: "passive" }); return; }

    const cat = categorie(c);
    const K = cat === 1 ? 3.0 : 2.5;
    const inverse = bitumineuxAuDessus(couches, i) && traiteEnDessous(couches, i);
    const estBase = i > 0 && couches[i - 1].famille === "bitumineux";

    if (estBase && !fort) {
      res.push({ couche: { ...c, nom: `${c.nom} [base ${libelleCategorie(cat, inverse)}]` },
                 role: "base", E: moduleBase(cat, inverse) });
      return;
    }
    if (estBase && fort)
      alertes.push(`Trafic fort (> T3) : la couche de base « ${c.nom} » ne peut pas être en GNT `
        + "(défaut de conception — prévoir un matériau traité). Elle est subdivisée comme une "
        + "couche de fondation (plafond 360 MPa).");

    const plafond = fort ? 360 : plafondFaible;
    const n = Math.max(nombreSousCouches(c.h, EP_SOUS_COUCHE), 1);
    for (let k = 0; k < n; k++) {
      const nom = n === 1
        ? `${c.nom} [fond. ${libelleCategorie(cat, inverse)}]`
        : `${c.nom} ${k + 1}/${n} [fond. ${libelleCategorie(cat, inverse)}]`;
      res.push({ couche: { ...c, nom, h: c.h / n }, role: "fondation", K, plafond });
    }
  });

  // Passe unique de bas en haut : la fondation prend min(K × E_dessous, plafond),
  // la base garde son module fixe.
  let dessous = res.length ? res[res.length - 1].couche.E : 0;
  for (let i = res.length - 1; i >= 0; i--) {
    const r = res[i];
    if (r.couche.moduleImpose) { /* module saisi : conservé */ } else if (r.role === "fondation") r.couche.E = Math.min(r.K * dessous, r.plafond);
    else if (r.role === "base") r.couche.E = r.E;
    dessous = r.couche.E;
  }
  return { couches: res.map((r) => r.couche), alertes };
}

// ─────────────────────────── Règle d'emploi (note 2017, §6.1) ───────────────────────────

const graveBitumeAuDessus = (couches, i) => couches.slice(0, i).some((c) => {
  if (c.famille !== "bitumineux") return false;
  const s = cleOuNom(c);
  return s.includes("gb") || s.includes("grave bitume") || s.includes("grave-bitume");
});

/**
 * Sous une grave-bitume, seule la GNT catégorie 1 (GRH) est admise : la
 * catégorie 2 (GC 0/31,5 - 0/20) y est signalée. Renvoie la liste des défauts.
 */
export function validerEmploiTunisie(couches) {
  const defauts = [];
  couches.forEach((c, i) => {
    const estGnt = c.famille === "sol" && !estSupport(couches, i);
    if (estGnt && categorie(c) === 2 && graveBitumeAuDessus(couches, i))
      defauts.push("Sous une grave-bitume (GB), seule la GNT catégorie 1 (GRH) est autorisée : la "
        + `catégorie 2 (GC 0/31,5 - 0/20) de la couche « ${c.nom} » n'est pas admise `
        + "(note circulaire 2017, §6.1).");
  });
  return defauts;
}

// ─────────────────── Plafond du module des GNT en place (fascicule 6) ───────────────────

/**
 * Tunisie, catalogue RevA fascicule 6, tableau 5 (p. 332) : même grille que
 * le Cerema (propreté × état hydrique), chiffres propres — 360 MPa au mieux
 * au lieu de 600, 120 au pire au lieu de 200.
 *
 *               propre  pollué  très pollué
 *   sec           360     360       360
 *   humide        360     360       120
 *   suintant      360     200       120
 */
export const PLAFOND_GNT_FASCICULE6 = Object.freeze({
  cle: "tunisie-fascicule6",
  valeurs: Object.freeze({
    sec: Object.freeze({ propre: 360, pollue: 360, "tres-pollue": 360 }),
    humide: Object.freeze({ propre: 360, pollue: 360, "tres-pollue": 120 }),
    suintant: Object.freeze({ propre: 360, pollue: 200, "tres-pollue": 120 }),
  }),
  reference: "Tunisie, catalogue RevA, fascicule 6 « Caractérisation et classification des chaussées "
    + "à renforcer », tableau 5 (p. 332).",
  note: "Le fascicule précise que ces valeurs prennent déjà en compte un k = 2 par rapport à la "
    + "portance de la plateforme. Elles sont nettement plus basses que celles du Cerema "
    + "(360 au lieu de 600 MPa au mieux, 120 au lieu de 200 au pire) : appliquer la grille "
    + "française ici surestimerait le module d'assise de moitié.",
});

/** Plafond (MPa) à la croisée de l'état hydrique ("sec" | "humide" | "suintant") et de la propreté ("propre" | "pollue" | "tres-pollue"). */
export const plafondGntFascicule6 = (humidite, proprete) => PLAFOND_GNT_FASCICULE6.valeurs[humidite]?.[proprete] ?? null;

/** Module d'une couche granulaire en place : 2 × celui du dessous, plafonné par la grille. */
export const moduleGntEnPlace = (dessousMPa, humidite, proprete) =>
  Math.min(2 * dessousMPa, plafondGntFascicule6(humidite, proprete));
