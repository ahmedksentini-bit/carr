// Modules des GNT selon la NF P98-086 (2011), annexe F normative, tableau F.1 —
// portage de FranceGntSubdivider (Burmister-Calc). La règle dépend du trafic
// (classe ≤ T3 : TMJA < 150 PL/j, tableau E.4 ; ou T2 / T1), de la couche
// (base : GNT sous les enrobés posée sur une fondation en GNT ; ou fondation),
// de la catégorie NF EN 13285 lue dans la clé matériau (GNT1, GNT2, GNT3 ;
// 2 par défaut) et de la structure (inverse : 480 MPa).
//
//   trafic ≤ T3 : base à module fixe (600 / 400 / 200 MPa selon la catégorie) ;
//     fondation en sous-couches de 0,25 m depuis la plate-forme,
//     E1 = 3 × E plate-forme, Ei = k × Ei−1 (k = 3 / 2,5 / 2), bornée au module
//     de base de sa catégorie ;
//   trafic T2 ou T1 (bitumineuses épaisses), et GNT-BE : k = 3, borne 360 MPa ;
//     une base en GNT y est signalée hors domaine.
//
// Un module imposé à la saisie (`moduleImpose`) est conservé et sert d'appui.

import { nombreSousCouches } from "./base.js";

export const EP_SOUS_COUCHE = 0.25;
export const TMJA_MAX_T3 = 150;

export const NOTE_GNT_FRANCE = "NF P98-086, tableau F.1. Trafic ≤ T3 : base en GNT à module fixe (cat. 1 600, cat. 2 400, "
  + "cat. 3 200 MPa) ; fondation en sous-couches de 0,25 m depuis la plate-forme, E1 = 3 × E plate-forme, "
  + "puis k × la sous-couche inférieure (k = 3 / 2,5 / 2 selon la catégorie), borné au module de base. "
  + "Trafic T2-T1 (bitumineuse épaisse) : k = 3, borné à 360 MPa. Structure inverse : 480 MPa.";

/** Trafic au-delà de T3 (TMJA ≥ 150) ; inconnu : trafic ≤ T3. */
export const auDelaDeT3 = (mja) => Number.isFinite(mja) && mja >= TMJA_MAX_T3;

const cle = (c) => String(c.materiau ?? c.nom ?? "").toLowerCase();

/** Catégorie NF EN 13285 d'après la clé matériau (ou le nom) : 1, 2 ou 3 ; 2 par défaut. */
export function categorieGnt(c) {
  const s = cle(c);
  if (s.includes("gnt1") || s.includes("cat.1") || s.includes("cat1")) return 1;
  if (s.includes("gnt3") || s.includes("cat.3") || s.includes("cat3")) return 3;
  return 2;
}
export const moduleBaseGnt = (cat) => (cat === 1 ? 600 : cat === 3 ? 200 : 400);
export const rapportGnt = (cat) => (cat === 1 ? 3 : cat === 3 ? 2 : 2.5);

const support = (couches, i) => i === couches.length - 1 || couches[i].h === Infinity;
const bitumineuxAuDessus = (couches, i) => couches.slice(0, i).some((c) => c.famille === "bitumineux");
const traiteEnDessous = (couches, i) => couches.slice(i + 1).some((c) => c.famille === "hydraulique");
const fondationGntDessous = (couches, i) => i + 1 < couches.length - 1 && couches[i + 1].h !== Infinity && couches[i + 1].famille === "sol";

export function subdiviserGntFrance(couches, mja) {
  const fort = auDelaDeT3(mja);
  const alertes = [];
  const res = [];   // { couche, role: "passive" | "fixe" | "fondation", k, plafond, E }
  couches.forEach((c, i) => {
    if (c.famille !== "sol" || support(couches, i)) { res.push({ couche: { ...c }, role: "passive" }); return; }
    if (cle(c).includes("gnt-inv") || (bitumineuxAuDessus(couches, i) && traiteEnDessous(couches, i))) {
      res.push({ couche: { ...c, nom: `${c.nom} [inverse]` }, role: "fixe", E: 480 });
      return;
    }
    const cat = categorieGnt(c);
    const epaisse = fort || cle(c).includes("gnt-be");
    const base = i > 0 && couches[i - 1].famille === "bitumineux" && fondationGntDessous(couches, i);
    if (base && !epaisse) {
      res.push({ couche: { ...c, nom: `${c.nom} [base cat. ${cat}]` }, role: "fixe", E: moduleBaseGnt(cat) });
      return;
    }
    if (base) alertes.push(`Trafic au-delà de T3 : la couche de base « ${c.nom} » ne peut pas être en GNT `
      + "(NF P98-086, tableau F.1 : GNT en fondation seulement sous bitumineuse épaisse). "
      + "Elle est découpée comme une fondation (k = 3, borne 360 MPa).");
    const k = epaisse ? 3 : rapportGnt(cat), plafond = epaisse ? 360 : moduleBaseGnt(cat);
    const n = Math.max(nombreSousCouches(c.h, EP_SOUS_COUCHE), 1);
    for (let s = 0; s < n; s++)
      res.push({ couche: { ...c, h: c.h / n, nom: n === 1 ? `${c.nom} [fond.]` : `${c.nom} ${s + 1}/${n} [fond.]` }, role: "fondation", k, plafond });
  });

  // Passe unique de bas en haut : la première sous-couche de fondation au-dessus d'une couche qui
  // n'en est pas une (la plate-forme) prend 3 × son module, les suivantes k × la précédente.
  let dessous = res.length ? res[res.length - 1].couche.E : 0, dessousFondation = false;
  for (let i = res.length - 1; i >= 0; i--) {
    const r = res[i];
    if (r.couche.moduleImpose) { /* module saisi : conservé */ }
    else if (r.role === "fondation") r.couche.E = Math.min((dessousFondation ? r.k : 3) * dessous, r.plafond);
    else if (r.role === "fixe") r.couche.E = r.E;
    dessousFondation = r.role === "fondation";
    dessous = r.couche.E;
  }
  return { couches: res.map((r) => r.couche), alertes };
}
