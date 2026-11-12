// Bibliothèque des matériaux normalisés de la méthode rationnelle française
// (Alizé-LCPC, annexe F de la NF P98-086:2011), reprise de Burmister-Calc.
// Ces valeurs sont recopiées dans la couche à l'affectation ; l'utilisateur
// peut ensuite les modifier couche par couche.
//
// Bitumineux : E10 (MPa à 10 °C / 10 Hz, sert à kθ), ε6 (µdéf à 10 °C /
// 25 Hz ; NaN si le matériau n'est pas vérifié en fatigue), −1/b, SN, kc, et
// la table E(T) à 10 Hz pour T = −10, 0, 10, 20, 30, 40 °C.
// Sols et GNT : module indicatif, coefficient A du critère de déformation
// verticale (trafic faible, trafic fort), pente −0,222.
// Traités aux liants hydrauliques et bétons : σ6 (MPa), −1/b, SN, Sh (m), kc, kd.

export const TEMPERATURES = [-10, 0, 10, 20, 30, 40];

const bit = (cle, E10, eps6, moinsInvB, SN, kc, tableE, note) =>
  ({ cle, famille: "bitumineux", E10, eps6, b: -1 / moinsInvB, SN, kc, tableE, nu: 0.35, note });

export const BITUMINEUX = [
  bit("BBSG1", 7315, 100, 5, 0.25, 1.1, [14800, 12000, 7315, 3685, 1300, 1000]),
  bit("BBSG2", 9310, 100, 5, 0.25, 1.1, [16000, 13500, 9310, 4690, 1800, 1000]),
  bit("BBSG3", 9310, 100, 5, 0.25, 1.1, [16000, 13500, 9310, 4690, 1800, 1000]),
  bit("BBME1", 11970, 100, 5, 0.25, 1.1, [17300, 15400, 11970, 6030, 3000, 1900]),
  bit("BBME2", 14630, 100, 5, 0.25, 1.1, [19500, 18200, 14630, 7370, 3800, 2300]),
  bit("BBME3", 14630, 100, 5, 0.25, 1.1, [19500, 18200, 14630, 7370, 3800, 2300]),
  bit("GB2", 11880, 80, 5, 0.30, 1.3, [22800, 18300, 11880, 6120, 2700, 1000]),
  bit("GB3", 11880, 90, 5, 0.30, 1.3, [22800, 18300, 11880, 6120, 2700, 1000]),
  bit("GB4", 14300, 100, 5, 0.30, 1.3, [25000, 20000, 14300, 7700, 3500, 1200]),
  bit("EME1", 16940, 100, 5, 0.30, 1.0, [30000, 24000, 16940, 11060, 6000, 3000]),
  // SN = 0,25 pour l'EME2, 0,30 pour l'EME1 : NF P98-086, tableau F.7.
  bit("EME2", 16940, 130, 5, 0.25, 1.0, [30000, 24000, 16940, 11060, 6000, 3000]),
];

const sol = (cle, E, Afaible, Afort) => ({ cle, famille: "sol", E, Afaible, Afort, pente: -0.222, nu: 0.35 });

// Les GNT reprennent les coefficients A des sols support (16 000 en trafic
// faible, 12 000 en trafic fort), sauf valeur spécifique tabulée.
export const SOLS = [
  sol("PF1", 20, 16000, 12000),
  sol("PF2", 50, 16000, 12000),
  sol("PF2qs", 80, 16000, 12000),
  sol("PF3", 120, 16000, 12000),
  sol("PF4", 200, 16000, 12000),
  sol("GNT-BE", 360, 16000, 12000),
  // GNT de structure inverse : A majoré de 1,2 dans les deux niveaux de trafic (NF P98-086).
  sol("GNT-inv", 480, 19200, 14400),
  sol("GNT1", 600, 16000, 12000),
  sol("GNT2", 400, 16000, 12000),
  sol("GNT3", 200, 16000, 12000),
];

const hyd = (cle, sigma6, moinsInvB, SN, Sh, kc, kd, E) =>
  ({ cle, famille: "hydraulique", sigma6, b: -1 / moinsInvB, SN, Sh, kc, kd, nu: 0.25, E });

// Modules de calcul (MPa) : NF P98-086, tableaux F.2, F.3 et F.13 — Burmister-Calc ne les
// porte pas et laisse le module à saisir (500 MPa par défaut). Bétons : dalles non
// goujonnées, kd = 1/1,7 et Sh = 3 cm (le cas le plus défavorable ; 1/1,47 goujonnées,
// 1/1,37 BAC, Sh de 1 à 3 cm selon le matériel — à ajuster couche par couche).

export const HYDRAULIQUES = [
  hyd("BC2", 1.37, 14, 1.0, 0.03, 1.5, 1 / 1.7, 20000),
  hyd("BC3", 1.63, 15, 1.0, 0.03, 1.5, 1 / 1.7, 24000),
  hyd("BC4", 1.95, 15, 1.0, 0.03, 1.5, 1 / 1.7, 24000),
  hyd("BC5", 2.15, 16, 1.0, 0.03, 1.5, 1 / 1.7, 35000),
  hyd("GC-t3", 0.75, 15, 1.0, 0.03, 1.4, 1.0, 23000),
  hyd("GC-t4", 1.20, 15, 1.0, 0.03, 1.4, 0.8, 25000),
  hyd("GLHR-t3", 0.75, 15, 1.0, 0.03, 1.4, 1.0, 23000),   // kc = 1,4 : NF P98-086, tableau F.4
  hyd("GCH-t3", 0.75, 15, 1.0, 0.03, 1.5, 1.0, 23000),
  hyd("GLP-t2", 0.60, 12.5, 1.0, 0.03, 1.5, 1.0, 15000),
  hyd("GLP-t3", 0.70, 13.7, 1.0, 0.03, 1.5, 1.0, 20000),
  hyd("GCV-t3", 1.40, 16, 1.0, 0.03, 1.5, 1.0, 30000),
  hyd("BCR-t5", 1.85, 15, 1.0, 0.03, 1.5, 0.8, 28000),
  hyd("SL-t1", 0.175, 10, 0.8, 0.025, 1.5, 1.0, 3700),
  hyd("SL-t2", 0.425, 10, 0.8, 0.025, 1.5, 1.0, 8500),
  hyd("SL-t3", 0.65, 10, 0.8, 0.025, 1.5, 1.0, 12500),
  hyd("SC-t1", 0.21, 12, 0.8, 0.025, 1.5, 1.0, 5000),
  hyd("SC-t2", 0.50, 12, 0.8, 0.025, 1.5, 1.0, 12000),
  hyd("SC-t3", 0.75, 12, 0.8, 0.025, 1.5, 1.0, 17200),
];

export const trouver = (cle) =>
  BITUMINEUX.find((m) => m.cle === cle) ?? SOLS.find((m) => m.cle === cle)
  ?? HYDRAULIQUES.find((m) => m.cle === cle) ?? null;

/**
 * Module à la température équivalente, par interpolation LINÉAIRE (pas
 * logarithmique) entre les deux températures tabulées qui encadrent θeq,
 * bornée aux extrémités de la table — comme Alizé.
 */
export function moduleA(tableE, teq) {
  const T = TEMPERATURES;
  if (teq <= T[0]) return tableE[0];
  if (teq >= T[5]) return tableE[5];
  for (let i = 0; i < 5; i++)
    if (teq >= T[i] && teq <= T[i + 1])
      return tableE[i] + ((teq - T[i]) / (T[i + 1] - T[i])) * (tableE[i + 1] - tableE[i]);
  return tableE[2];
}

/** Module d'un matériau bitumineux à θeq (table E(T), sinon module imposé, sinon E10). */
export const moduleBitumineux = (m, teq) => (m.tableE ? moduleA(m.tableE, teq) : m.moduleImpose ?? m.E10);

/**
 * Couche dotée des paramètres normalisés d'un matériau. Le module est
 * recalculé (bitumineux à θeq, sol à son module indicatif) sauf si
 * `garderModule` ; celui d'un traité aux liants hydrauliques est laissé.
 */
export function appliquer(couche, materiau, { teq = 15, garderModule = false } = {}) {
  const c = { ...couche, materiau: materiau.cle, famille: materiau.famille, nu: materiau.nu };
  delete c.bit; delete c.hyd; delete c.sol;
  if (materiau.famille === "bitumineux") {
    c.bit = { E10: materiau.E10, eps6: materiau.eps6, b: materiau.b, SN: materiau.SN, kc: materiau.kc };
    if (!garderModule) c.E = moduleBitumineux(materiau, teq);
  } else if (materiau.famille === "hydraulique") {
    c.hyd = { sigma6: materiau.sigma6, b: materiau.b, SN: materiau.SN, Sh: materiau.Sh, kc: materiau.kc, kd: materiau.kd };
    if (!garderModule && materiau.E > 0) c.E = materiau.E;
  } else {
    c.sol = { Afaible: materiau.Afaible, Afort: materiau.Afort, pente: materiau.pente };
    if (!garderModule) c.E = materiau.E;
  }
  return c;
}
