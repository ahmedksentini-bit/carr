// Étude d'une chaussée d'un bout à l'autre, pour un référentiel donné :
// matériaux du pays à la température équivalente, subdivision des GNT selon
// la règle du pays, calcul de Burmister, vérification rationnelle
// (NF P98-086) ou déterministe (contraintes admissibles), et recherche de
// l'épaisseur minimale d'une couche. Partagé par le bureau de calcul, le
// cours et l'exerciseur.
//
// Saisie d'une couche : { nom, materiau (clé du catalogue du pays), h (m),
// E (MPa, facultatif : sinon module du matériau), nu (facultatif),
// interface, dommage }. La dernière couche est le sol support.

import { analyser, ESSIEU_REFERENCE } from "./burmister.js";
import { verifier } from "./criteres.js";
import { appliquer } from "./materiaux.js";
import { nplDe, neParFamille } from "./pays/base.js";
import { fractileDuRisque } from "./fractile.js";

/** Température équivalente retenue : saisie, sinon proposée par le pays. */
export const teqDe = (profil, p) => p.teq ?? profil.teqPropose(p.intervention ?? "neuve");

/**
 * Couches de calcul : paramètres du matériau du pays recopiés, module et ν imposés s'ils sont saisis.
 * Chaque couche garde l'indice de sa ligne de saisie (`source`, recopié dans les sous-couches
 * des GNT) et sait si son module a été imposé (`moduleImpose`, que le découpage respecte).
 */
export function preparerCouches(saisie, profil, p) {
  const teq = teqDe(profil, p);
  return saisie.map((s, i) => {
    const derniere = i === saisie.length - 1;
    const base = { nom: s.nom || s.materiau || `couche ${i + 1}`, E: s.E, nu: s.nu ?? 0.35,
      h: derniere ? Infinity : s.h, interface: s.interface ?? "collee", dommage: s.dommage ?? 0,
      source: i, moduleImpose: s.E > 0 };
    const m = s.materiau ? profil.materiau(s.materiau) : null;
    if (!m) {
      if (!(base.E > 0)) throw new Error(`couche ${i + 1} : matériau « ${s.materiau ?? ""} » inconnu de ce référentiel et module non saisi`);
      return { ...base, famille: s.famille ?? null };
    }
    const c = appliquer(base, m, { teq, garderModule: s.E > 0 });
    if (s.E > 0) c.E = s.E;
    if (s.nu > 0) c.nu = s.nu;
    if (!(c.E > 0)) throw new Error(`couche ${i + 1} (${c.nom}) : module inconnu — le saisir`);
    return c;
  });
}

/** Découpe les GNT selon la règle du référentiel : { couches, alertes }. */
function decouper(profil, p, couches) {
  const classe = profil.classerTraficDe?.(p);
  const r = profil.subdiviserGnt(couches, { intervention: p.intervention ?? "neuve", classeRisque: classe?.classeRisque ?? classe?.nom ?? null, mja: p.mja });
  return { couches: r.couches, alertes: r.alertes ?? [] };
}

/**
 * Découpage des GNT proposé par la règle du référentiel, comme le bouton « Subdiviser les
 * GNT » de Burmister-Calc : chaque GNT (hors support) est scindée en sous-couches et leurs
 * modules sont recalculés de bas en haut, même s'ils avaient été saisis ; les autres couches
 * gardent les leurs. Renvoie { active, note, couches, alertes } ; `active` est faux quand la
 * méthode du pays ne prescrit pas de vraie subdivision (rapport ≤ 1).
 */
export function subdivisionProposee({ profil, p, saisie }) {
  const regle = profil.subdivisionGnt?.(p.intervention ?? "neuve") ?? null;
  const active = !!profil.subdiviserGnt && (regle?.rapport ?? 1) > 1;
  if (!active) return { active, note: regle?.note ?? "", couches: [], alertes: [] };
  const libre = saisie.map((s, i) => (i < saisie.length - 1 && s.materiau && profil.materiau(s.materiau)?.famille === "sol" ? { ...s, E: undefined } : s));
  return { active, note: regle?.note ?? "", ...decouper(profil, p, preparerCouches(libre, profil, p)) };
}

/** Risque retenu : saisi, sinon proposé par la table du pays, sinon 5 %. */
export function risqueDe(profil, p, ne) {
  if (Number.isFinite(p.risque) && p.risque > 0) return { risque: p.risque, propose: false };
  const classe = profil.classeTraficNommee?.(p.classeTrafic) ?? profil.classerTraficDe?.(p) ?? null;
  const libelle = profil.libelleClasseRisque(classe, (ne.bitumineux ?? 0) / 1e6);
  const r = profil.risque.proposer(p.typeStructure, null, libelle);
  return Number.isFinite(r) ? { risque: r, propose: true, libelle } : { risque: 5, propose: false, libelle: null, defaut: true };
}

/**
 * Étude complète. Renvoie { couches (calculées, GNT subdivisées), analyse,
 * verification, npl, ne (par famille), risque, u, teq, classeTrafic, alertes }.
 */
export function etudier({ profil, p, saisie, essieu = ESSIEU_REFERENCE, subdiviser = true }) {
  const alertes = [];
  let couches = preparerCouches(saisie, profil, p);
  if (subdiviser && profil.subdiviserGnt) {
    const r = decouper(profil, p, couches);
    couches = r.couches;
    alertes.push(...r.alertes);
  }
  alertes.push(...(profil.validerEmploi?.(couches, p.classeTrafic ?? profil.classerTraficDe?.(p)?.nom ?? null) ?? []));
  const npl = nplDe(p);
  const ne = neParFamille(p, profil);
  const { risque, propose, defaut } = risqueDe(profil, p, ne);
  // Un référentiel qui publie une table de risque mais n'y a rien pour cette classe le signale ;
  // en France, le risque se choisit (NF P98-086) : 5 % par défaut, sans alerte.
  if (defaut && profil.risque?.entrees?.length) alertes.push("Aucun risque proposé par le référentiel pour cette classe : 5 % retenu, à confirmer.");
  const u = fractileDuRisque(risque);
  const analyse = analyser(couches, essieu);
  const deterministe = profil.fatigueRationnelle === false ? profil.verifierDeterministe(couches, analyse, p) : null;
  let verification = deterministe ?? verifier(couches, analyse, {
    ne, u, niveauTrafic: p.niveauTrafic ?? "fort", ks: p.ks ?? 1,
  });
  // Règle propre au référentiel (Côte d'Ivoire 2024 : εz au seul sommet de la plateforme ;
  // Sénégal : chaussée souple vérifiée à la plateforme seule).
  if (!deterministe && profil.ajusterVerification) {
    const classe = p.classeTrafic ?? profil.classerTraficDe?.(p)?.nom ?? null;
    verification = profil.ajusterVerification(verification, { couches, analyse, p, ne, classe });
  }
  return {
    couches, analyse, verification, npl, ne, risque, risquePropose: propose, u,
    teq: teqDe(profil, p), classeTrafic: profil.classerTraficDe?.(p) ?? null, alertes,
    deterministe: !!deterministe,
  };
}

/** Plus grand taux de travail des critères applicables (%), NaN si aucun. */
export const tauxMax = (verification) => {
  const t = verification.verifs.filter((v) => v.applicable).map((v) => v.taux);
  return t.length ? Math.max(...t) : NaN;
};

/**
 * Épaisseur minimale (multiple de `pas`, m) de la couche `indice` pour que
 * tous les critères soient satisfaits, par dichotomie entre hMin et hMax.
 * Renvoie { h, etude } ou { h: null, motif } si même hMax ne suffit pas.
 */
export function epaisseurMinimale({ profil, p, saisie, indice, essieu = ESSIEU_REFERENCE, hMin = 0.03, hMax = 0.6, pas = 0.005 }) {
  if (!(indice >= 0 && indice < saisie.length - 1)) throw new Error("couche à dimensionner invalide");
  const avec = (h) => saisie.map((s, i) => (i === indice ? { ...s, h } : s));
  const ok = (h) => {
    const e = etudier({ profil, p, saisie: avec(h), essieu });
    return { e, ok: e.verification.ok };
  };
  let bas = Math.round(hMin / pas), haut = Math.round(hMax / pas);
  const fin = ok(haut * pas);
  if (!fin.ok) return { h: null, motif: `même ${Math.round(hMax * 100)} cm ne suffisent pas`, etude: fin.e };
  const debut = ok(bas * pas);
  if (debut.ok) return { h: bas * pas, etude: debut.e };
  let meilleur = fin;
  while (haut - bas > 1) {
    const mil = Math.floor((bas + haut) / 2);
    const r = ok(mil * pas);
    if (r.ok) { haut = mil; meilleur = r; } else bas = mil;
  }
  return { h: haut * pas, etude: meilleur.e };
}
