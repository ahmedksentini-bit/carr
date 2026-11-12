// Recherche de l'épaisseur d'une couche : on essaie, on vérifie, on recommence
// (portage de ThicknessSearch de Burmister-Calc), et sa forme générale, qui
// sert aussi bien à l'apport d'un renforcement qu'au dimensionnement d'une
// chaussée neuve.
//
// Aucun guide ne donne de catalogue d'épaisseurs de renforcement : l'épaisseur
// se trouve par itération jusqu'à ce que la vérification passe, encadrée par
// les minima constructifs. La recherche NE SUPPOSE PAS LA MONOTONIE du
// critère : elle balaie le pas depuis l'épaisseur minimale et retient la
// première qui passe. Épaissir une couche liée déplace la fibre neutre et peut
// dégrader un autre critère — une dichotomie le manquerait en silence.

import { analyser, ESSIEU_REFERENCE } from "../burmister.js";
import { nf } from "./format.js";

export const REFERENCE_RECHERCHE_EPAISSEUR =
  "Cerema/IDRRIM 2016, ch. 4 § 3 ; guide sénégalais GRS 2023, ch. 6 (minima constructifs, tab. 23-26)";

export const NOTE_SANS_CATALOGUE =
  "Aucun guide ne tabule l'épaisseur d'apport d'un renforcement : elle se trouve par "
  + "itération, jusqu'à ce que la structure renforcée vérifie ses critères pour le trafic "
  + "futur, en respectant les minima constructifs de mise en œuvre.";

/** Lit le verdict d'un essai : booléen, ou objet { ok, detail? }. */
function verdict(v) {
  if (v && typeof v === "object")
    return { ok: !!v.ok, detail: v.detail ?? null, verification: "verification" in v ? v.verification : v };
  return { ok: !!v, detail: null, verification: null };
}

function balayer(passe, minCm, maxCm, pasCm, minimumConstructif) {
  const essais = [], avertissements = [];
  const fin = (epaisseurCm) => ({ epaisseurCm, essais, avertissements, trouve: epaisseurCm !== null, nombreEssais: essais.length });
  if (!(pasCm > 0) || !(maxCm >= minCm)) {
    avertissements.push("Bornes de recherche incohérentes : vérifier l'épaisseur minimale, maximale et le pas.");
    return fin(null);
  }
  for (let h = minCm; h <= maxCm + 1e-9; h += pasCm) {
    const v = verdict(passe(h));
    essais.push({ epaisseurCm: h, ok: v.ok, detail: v.detail, verification: v.verification });
    if (v.ok) {
      if (minimumConstructif && Math.abs(h - minCm) < 1e-9)
        avertissements.push(`La première épaisseur essayée (${nf(minCm, 1)} cm) passe déjà : c'est le `
          + "minimum constructif qui commande, pas le calcul. Vérifier s'il y a "
          + "vraiment un besoin structurel.");
      return fin(h);
    }
  }
  avertissements.push(`Aucune épaisseur de ${nf(minCm, 1)} à ${nf(maxCm, 1)} cm ne satisfait les critères. `
    + "Le renforcement par simple apport ne suffit pas : envisager un décaissement, "
    + "un retraitement en place, ou un matériau d'apport plus performant.");
  return fin(null);
}

/**
 * La plus petite épaisseur du pas (cm) qui satisfasse `passe(hCm)` — booléen
 * ou { ok, detail }. `minCm` porte le minimum constructif : on ne descend
 * jamais en dessous. Renvoie { epaisseurCm (null si rien ne passe), essais
 * [{ epaisseurCm, ok, detail, verification }], avertissements, trouve,
 * nombreEssais }.
 */
export const chercherEpaisseurPas = (passe, minCm, maxCm, pasCm) => balayer(passe, minCm, maxCm, pasCm, true);

/**
 * Recherche en deux temps : balayage au pas large, puis affinage au pas fin
 * entre la dernière épaisseur qui échoue et la première qui passe. La borne
 * basse de l'affinage n'est pas le minimum constructif : l'avertissement
 * « le minimum constructif commande » ne s'y arme pas.
 */
export function chercherEpaisseurAffinee(passe, minCm, maxCm, pasLargeCm, pasFinCm) {
  const large = balayer(passe, minCm, maxCm, pasLargeCm, true);
  if (!large.trouve || pasFinCm >= pasLargeCm) return large;
  const trouve = large.epaisseurCm;
  const depuis = Math.max(minCm, trouve - pasLargeCm + pasFinCm);
  if (depuis >= trouve) return large;
  const fine = balayer(passe, depuis, trouve, pasFinCm, false);
  const essais = [...large.essais, ...fine.essais];
  const avertissements = [...new Set([...large.avertissements, ...fine.avertissements])];
  const epaisseurCm = fine.epaisseurCm ?? trouve;
  return { epaisseurCm, essais, avertissements, trouve: true, nombreEssais: essais.length };
}

/**
 * Minima constructifs usuels d'une couche d'apport (cm) : bitumineux 4,
 * traité aux liants hydrauliques 12, granulaire 12, autre 2. Ce sont des
 * contraintes de mise en œuvre, pas des valeurs de calcul.
 */
export function epaisseurMinimaleCm(famille) {
  if (famille === "bitumineux") return 4;
  if (famille === "hydraulique" || famille === "sol") return 12;
  return 2;
}

export const RESERVE_MINIMA =
  "Les minima retenus sont des ordres de grandeur de mise en œuvre. Le minimum applicable "
  + "est celui de la fiche du matériau dans le catalogue du pays, qui prime.";

// ─────────────────────────────── Forme générale ───────────────────────────

const arrondi = (x) => Math.round(x * 1e6) / 1e6;

function detailDe(v) {
  if (v.detail) return v.detail;
  const d = v.verification?.dimensionnant;
  return d ? `${d.critere ?? "critère"} (${d.nom ?? ""}) : taux ${nf(d.taux, 1)} %` : null;
}

/**
 * Cherche l'épaisseur (m) de la couche `indiceCouche` pour laquelle la
 * structure passe la vérification. À chaque essai, la couche reçoit
 * l'épaisseur h, la structure est calculée par `analyser(couches, essieu)`,
 * puis jugée par `verifierFn(couches, analyse, h)` — qui rend un booléen ou
 * un objet portant `ok` (par exemple le résultat de criteres.verifier).
 *
 * Paramètres (épaisseurs en m) : hMin (minimum constructif), hMax, pas, et
 * `pasFin` facultatif pour un affinage en deux temps.
 *
 * Renvoie { trouve, h (m, null si rien ne passe), hCm, essais [{ h, hCm, ok,
 * detail, verification }], avertissements, couches (structure retenue),
 * analyse, verification }.
 */
export function chercherEpaisseur({
  couches, indiceCouche, essieu = ESSIEU_REFERENCE, verifierFn, hMin, hMax, pas, pasFin = null,
}) {
  if (!couches?.length) throw new Error("au moins une couche est requise");
  if (!(indiceCouche >= 0 && indiceCouche < couches.length - 1))
    throw new RangeError("la couche cherchée doit être une couche d'épaisseur finie (pas le support)");
  if (typeof verifierFn !== "function") throw new TypeError("verifierFn doit être une fonction");

  const memo = new Map();
  function essayer(hCm) {
    const cle = arrondi(hCm);
    if (memo.has(cle)) return memo.get(cle);
    const h = cle / 100;
    const essai = couches.map((c, i) => (i === indiceCouche ? { ...c, h } : { ...c }));
    const analyse = analyser(essai, essieu);
    const v = verdict(verifierFn(essai, analyse, h));
    const res = { ok: v.ok, detail: detailDe(v), verification: v.verification, couches: essai, analyse };
    memo.set(cle, res);
    return res;
  }

  const passe = (hCm) => {
    const e = essayer(hCm);
    return { ok: e.ok, detail: e.detail, verification: e.verification };
  };
  const minCm = arrondi(hMin * 100), maxCm = arrondi(hMax * 100), pasCm = arrondi(pas * 100);
  const r = Number.isFinite(pasFin) && pasFin > 0
    ? chercherEpaisseurAffinee(passe, minCm, maxCm, pasCm, arrondi(pasFin * 100))
    : chercherEpaisseurPas(passe, minCm, maxCm, pasCm);

  const retenu = r.trouve ? memo.get(arrondi(r.epaisseurCm)) : null;
  return {
    trouve: r.trouve,
    h: r.trouve ? arrondi(r.epaisseurCm) / 100 : null,
    hCm: r.trouve ? arrondi(r.epaisseurCm) : null,
    essais: r.essais.map((e) => ({ h: arrondi(e.epaisseurCm) / 100, hCm: arrondi(e.epaisseurCm), ok: e.ok, detail: e.detail, verification: e.verification })),
    avertissements: r.avertissements,
    couches: retenu?.couches ?? null,
    analyse: retenu?.analyse ?? null,
    verification: retenu?.verification ?? null,
  };
}
