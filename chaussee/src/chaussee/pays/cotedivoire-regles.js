// Subdivision des couches granulaires du manuel Côte d'Ivoire 2024 (Fasc. 2
// §8.5.1–8.5.2), portage de CoteDIvoire2024GntSubdivider : sous-couches
// ≤ 25 cm, Eᵢ = min(k × E_dessous, Emax), de la plate-forme vers le haut.
// GNT k = 2,5, Emax = 400 ; GLn/SAn k = 2, Emax = 300 ; Q1 (GLa1/SAa1) k = 2,5,
// Emax = 450. Q2 (GLa2/SAa2) : module fixe 1000 MPa, pas de subdivision.

import { nombreSousCouches } from "./base.js";

const SOUS_COUCHE = 0.25;   // m

/** Règle par nature de grave : { k, emax } ; Q2 : module fixe. */
export const REGLES_GNT_CI2024 = {
  gnt: { k: 2.5, emax: 400 },
  naturel: { k: 2.0, emax: 300 },
  q1: { k: 2.5, emax: 450 },
  q2: { eFixe: 1000 },
};

function natureGrave(c) {
  const s = String(c.materiau ?? c.nom ?? "").toLowerCase();
  if (s.includes("gla2") || s.includes("saa2")) return "q2";
  if (s.includes("gla1") || s.includes("saa1")) return "q1";
  if (s.includes("gln") || s.includes("san")) return "naturel";
  return "gnt";   // « gnt » et toute autre grave
}

export function subdiviserGntCi2024(couches) {
  const res = [], nat = [];
  couches.forEach((c, i) => {
    const support = i === couches.length - 1 || c.h === Infinity;
    const k = support || c.famille !== "sol" ? "passive" : natureGrave(c);
    if (k === "passive" || k === "q2") { res.push({ ...c }); nat.push(k); return; }
    const n = Math.max(nombreSousCouches(c.h, SOUS_COUCHE), 1);
    for (let j = 0; j < n; j++) {
      res.push({ ...c, h: c.h / n, nom: n === 1 ? c.nom : `${c.nom} ${j + 1}/${n}` });
      nat.push(k);
    }
  });
  let dessous = res.length ? res[res.length - 1].E : 0;
  for (let i = res.length - 1; i >= 0; i--) {
    const regle = REGLES_GNT_CI2024[nat[i]];
    if (res[i].moduleImpose) { /* module saisi : conservé */ } else if (regle?.eFixe) res[i].E = regle.eFixe;
    else if (regle) res[i].E = Math.min(regle.k * dessous, regle.emax);
    dessous = res[i].E;
  }
  return { couches: res, alertes: [] };
}
