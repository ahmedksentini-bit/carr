// Champs dans la structure : le plan vertical qui passe par l'axe des deux roues du
// jumelage (X transversal, z profondeur), calculé sur une grille de nœuds — l'écran
// « grille » d'Alizé-LCPC. Chaque nœud est un point du moteur de Burmister
// (creerMoteur().evaluer, celui du tableau des sollicitations) : les interfaces
// collées, glissantes et semi-collées y sont traitées de la même façon.
//
// Repère de la carte : X (m) compté depuis le point entre-jumelage, roues en
// X = ±entraxe/2 (le moteur, lui, les place en x = 0 et x = entraxe) ; z (m) vers le bas.
// Signes d'Alizé, ceux du tableau : compression positive, traction NÉGATIVE ;
// déflexion en mm/100, positive vers le bas.
//
// La grille est resserrée près des roues (pas ≈ a/5 jusqu'à un rayon au-delà du bord
// extérieur, puis croissant) et près des interfaces (cotes de Tchebychev dans chaque
// couche). Chaque interface est calculée des deux côtés — base de la couche du dessus,
// sommet de celle du dessous — : σxx, εxx… y sautent, et la carte se dessine couche
// par couche. Le champ étant symétrique par rapport à l'axe du jumelage, on ne calcule
// que la moitié X ≥ 0 (option symetrie: false pour tout calculer, comme le font les tests).
//
// Le calcul se découpe en tranches de cotes (preparerChamps → etape(k)) pour qu'une page
// puisse l'étaler sans se figer ; champsStructure() les enchaîne d'un trait.

import { creerMoteur, rouesJumelage, rayonContact, ESSIEU_REFERENCE } from "./burmister.js";

/**
 * Grandeurs de la carte, au signe d'Alizé. `valeur(p)` lit une réponse du moteur
 * ({ sxx, syy, szz, exx, eyy, ezz, uz }). Les grandeurs « retenues » (sigT, epsT) sont
 * celles du tableau des sollicitations et des critères : min(−σxx, −σyy), min(−εxx, −εyy).
 */
export const GRANDEURS_CHAMPS = Object.freeze({
  w: { symbole: "w", nom: "déflexion verticale", court: "déflexion", unite: "mm/100", signee: false, decimales: 2, valeur: (p) => p.uz * 1e5 },
  sigZ: { symbole: "σz", nom: "contrainte verticale", court: "contrainte verticale", unite: "MPa", signee: true, decimales: 4, valeur: (p) => -p.szz },
  epsZ: { symbole: "εz", nom: "déformation verticale", court: "déformation verticale", unite: "µdéf", signee: true, decimales: 1, valeur: (p) => -p.ezz },
  sigT: { symbole: "σT", nom: "contrainte horizontale retenue, min des directions x et y", court: "contrainte horizontale, min(x, y)",
    unite: "MPa", signee: true, decimales: 4, valeur: (p) => Math.min(-p.sxx, -p.syy) },
  epsT: { symbole: "εT", nom: "déformation horizontale retenue, min des directions x et y", court: "déformation horizontale, min(x, y)",
    unite: "µdéf", signee: true, decimales: 1, valeur: (p) => Math.min(-p.exx, -p.eyy) },
  sigX: { symbole: "σxx", nom: "contrainte transversale, selon l'axe des roues", court: "contrainte transversale (x)", unite: "MPa", signee: true, decimales: 4, valeur: (p) => -p.sxx },
  epsX: { symbole: "εxx", nom: "déformation transversale, selon l'axe des roues", court: "déformation transversale (x)", unite: "µdéf", signee: true, decimales: 1, valeur: (p) => -p.exx },
  sigY: { symbole: "σyy", nom: "contrainte longitudinale, sens de circulation", court: "contrainte longitudinale (y)", unite: "MPa", signee: true, decimales: 4, valeur: (p) => -p.syy },
  epsY: { symbole: "εyy", nom: "déformation longitudinale, sens de circulation", court: "déformation longitudinale (y)", unite: "µdéf", signee: true, decimales: 1, valeur: (p) => -p.eyy },
});
export const ORDRE_GRANDEURS = Object.freeze(Object.keys(GRANDEURS_CHAMPS));

const borner = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** Abscisses X ≥ 0 de la demi-grille : fines sous les roues, croissantes au-delà. */
function abscisses(a, d, Xmax) {
  const pasFin = Math.max(a / 5, (d + a) / 14);
  const zoneFine = d + 2 * a;
  const ancres = [];
  for (const x of [0, d - a, d, d + a, d + 2 * a, Xmax]) {
    if (x < -1e-12 || x > Xmax + 1e-12) continue;
    if (!ancres.some((y) => Math.abs(y - x) < 1e-6)) ancres.push(Math.max(0, x));
  }
  ancres.sort((p, q) => p - q);
  const xs = [0];
  for (let k = 1; k < ancres.length; k++) {
    const x0 = ancres[k - 1], x1 = ancres[k], L = x1 - x0;
    if (x1 <= zoneFine + 1e-9) {
      const n = Math.max(1, Math.round(L / pasFin));
      for (let i = 1; i <= n; i++) xs.push(i === n ? x1 : x0 + (L * i) / n);
    } else {
      // Pas géométriques (raison 1,3) à partir du pas fin, ramenés sur l'intervalle.
      const pas = [];
      let s = pasFin * 1.2, somme = 0;
      while (somme < L * 0.98) { pas.push(s); somme += s; s *= 1.3; }
      let x = x0;
      pas.forEach((p, i) => { x += (p * L) / somme; xs.push(i === pas.length - 1 ? x1 : x); });
    }
  }
  return xs;
}

/** Cotes d'une couche finie : Tchebychev-Lobatto, serrées au sommet et à la base. */
function cotesCouche(z0, h, m) {
  return Array.from({ length: m }, (_, k) => (k === m - 1 ? z0 + h : z0 + (h * (1 - Math.cos((Math.PI * k) / (m - 1)))) / 2));
}

/**
 * Géométrie de la grille, sans calcul : couches normalisées (la dernière semi-infinie),
 * abscisses de la carte (complètes, symétriques) et de calcul, tranches de cotes par
 * couche, colonnes caractéristiques du tableau. Unités : m.
 */
export function grilleChamps(couchesEntree, essieu = ESSIEU_REFERENCE, { symetrie = true } = {}) {
  if (!couchesEntree?.length) throw new Error("au moins une couche est requise");
  const n = couchesEntree.length;
  const couches = couchesEntree.map((c, i) => ({ ...c, interface: c.interface ?? "collee", h: i === n - 1 ? Infinity : c.h }));
  for (const [i, c] of couches.entries()) {
    if (!(c.E > 0) || !(c.nu > 0 && c.nu < 0.5)) throw new Error(`couche ${i + 1} : module et coefficient de Poisson requis`);
    if (i < n - 1 && !(c.h > 0)) throw new Error(`couche ${i + 1} : épaisseur requise`);
  }
  const a = rayonContact(essieu), entraxe = essieu.entraxe, d = entraxe / 2;
  if (!(a > 0 && entraxe > 0)) throw new Error("jumelage : rayon de contact et entraxe positifs requis");
  const sommets = [0];
  for (let i = 1; i < n; i++) sommets.push(sommets[i - 1] + couches[i - 1].h);
  const zLie = sommets[n - 1];
  // Le sol est exploré sur 0,3 à 0,8 m selon l'épaisseur liée, la largeur au-delà du bord
  // extérieur d'au moins 20 cm : la carte reste proche de l'échelle vraie.
  const zMax = zLie + borner(0.8 * zLie, 0.3, 0.8);
  const Xmax = d + a + Math.max(0.2, 0.5 * zMax);
  const demi = abscisses(a, d, Xmax);
  const xs = [...demi.slice(1).map((x) => -x).reverse(), ...demi];
  const dzRef = Math.max(zLie, 0.05) / 20;
  const tranches = couches.map((c, i) => {
    const z0 = sommets[i];
    if (i < n - 1) {
      const m = borner(Math.round(c.h / dzRef) + 1, 3, 9);
      const zs = cotesCouche(z0, c.h, m);
      return { couche: i, z0, z1: z0 + c.h, zs, bases: zs.map((_, k) => k === m - 1) };
    }
    const L = zMax - z0, m = 10;
    const zs = Array.from({ length: m }, (_, k) => (k === m - 1 ? zMax : z0 + L * (k / (m - 1)) ** 1.7));
    return { couche: i, z0, z1: zMax, zs, bases: zs.map(() => false) };
  });
  const colonnes = [
    { X: 0, nom: "entre jumelage" }, { X: d - a, nom: "bord intérieur" }, { X: d, nom: "sous roue" },
    { X: d + a, nom: "bord extérieur" }, { X: d + 2 * a, nom: "à un rayon du bord" },
  ].filter((c) => c.X > -1e-9 && c.X < Xmax - 1e-9 && demi.some((x) => Math.abs(x - c.X) < 1e-9));
  return {
    couches, essieu, a, entraxe, sommets, zLie, zMax, Xmax, xs,
    xsCalcul: symetrie ? demi : xs, symetrie, tranches, colonnes,
    noeuds: xs.length * tranches.reduce((s, t) => s + t.zs.length, 0),
  };
}

/**
 * Prépare le calcul par tranches : { grille, total, etape(k), fini() }. Chaque étape
 * évalue quelques rangées de cotes sur toutes les abscisses de calcul (≈ 120 points, de
 * l'ordre de 5 à 20 ms) ; fini() rend le résultat complet, extrema compris.
 */
export function preparerChamps(couchesEntree, essieu = ESSIEU_REFERENCE, options = {}) {
  const g = grilleChamps(couchesEntree, essieu, options);
  const moteur = creerMoteur(g.couches);
  const roues = rouesJumelage(essieu);
  const d = g.entraxe / 2, nx = g.xs.length, xc = g.xsCalcul, ncx = xc.length;
  // Colonnes de la carte que remplit chaque abscisse calculée (deux par symétrie).
  const cibles = xc.map((X) => g.xs.flatMap((x, i) => (Math.abs(x - X) < 1e-12 || (g.symetrie && Math.abs(x + X) < 1e-12) ? [i] : [])));
  const tranches = g.tranches.map((t) => ({
    ...t, nom: g.couches[t.couche].nom ?? `couche ${t.couche + 1}`,
    E: g.couches[t.couche].E, nu: g.couches[t.couche].nu, interface: g.couches[t.couche].interface,
    valeurs: Object.fromEntries(ORDRE_GRANDEURS.map((k) => [k, new Float64Array(t.zs.length * nx).fill(NaN)])),
  }));
  const rangees = tranches.flatMap((t) => t.zs.map((z, j) => ({ t, j, z, base: t.bases[j] })));
  const parEtape = Math.max(1, Math.round(120 / ncx));
  const total = Math.ceil(rangees.length / parEtape);
  const faites = new Set();

  function etape(k) {
    if (k < 0 || k >= total || faites.has(k)) return;
    const lot = rangees.slice(k * parEtape, (k + 1) * parEtape);
    const points = [];
    for (const r of lot) for (const X of xc) points.push({ x: X + d, y: 0, z: r.z, base: r.base });
    const rep = moteur.evaluer(roues, points);
    lot.forEach((r, l) => {
      for (let i = 0; i < ncx; i++) {
        const p = rep[l * ncx + i];
        for (const cle of ORDRE_GRANDEURS) {
          const v = GRANDEURS_CHAMPS[cle].valeur(p), tab = r.t.valeurs[cle];
          for (const col of cibles[i]) tab[r.j * nx + col] = v;
        }
      }
    });
    faites.add(k);
  }

  function fini() {
    for (let k = 0; k < total; k++) etape(k);
    const extremes = {};
    for (const cle of ORDRE_GRANDEURS) {
      let min = null, max = null;
      for (const t of tranches) {
        const tab = t.valeurs[cle];
        t.zs.forEach((z, j) => g.xs.forEach((X, i) => {
          const v = tab[j * nx + i];
          const n = { v, X, z, couche: t.couche, base: t.bases[j] };
          // À égalité (symétrie), on garde le nœud du côté X ≥ 0.
          if (!min || v < min.v - 1e-12 * Math.abs(v) || (Math.abs(v - min.v) <= 1e-12 * Math.abs(v) && min.X < 0 && X >= 0)) min = n;
          if (!max || v > max.v + 1e-12 * Math.abs(v) || (Math.abs(v - max.v) <= 1e-12 * Math.abs(v) && max.X < 0 && X >= 0)) max = n;
        }));
      }
      extremes[cle] = { min, max };
    }
    return {
      couches: g.couches, essieu: g.essieu, a: g.a, entraxe: g.entraxe, sommets: g.sommets,
      zLie: g.zLie, zMax: g.zMax, Xmax: g.Xmax, xs: g.xs, colonnes: g.colonnes, symetrie: g.symetrie,
      tranches, extremes, noeuds: g.noeuds, points: rangees.length * ncx, semiCollee: moteur.semiCollee,
    };
  }
  return { grille: g, total, etape, fini, points: rangees.length * ncx };
}

/** Calcul complet d'un trait (Node, tests ; une page passe par preparerChamps). */
export function champsStructure(couches, essieu = ESSIEU_REFERENCE, options = {}) {
  return preparerChamps(couches, essieu, options).fini();
}

/** Clé d'un calcul : ce qui change les champs, rien d'autre (noms, matériaux ignorés). */
export function cleChamps(couches, essieu = ESSIEU_REFERENCE, { symetrie = true } = {}) {
  const n = couches.length;
  return JSON.stringify([
    couches.map((c, i) => [c.E, c.nu, i < n - 1 ? c.h : null, i < n - 1 ? (c.interface ?? "collee") : null]),
    [essieu.P ?? null, essieu.q, rayonContact(essieu), essieu.entraxe], symetrie,
  ]);
}

/** Valeur d'une grandeur au nœud (X, z) ; à une interface, `base` choisit la couche du dessus. */
export function valeurNoeud(res, cle, X, z, base = false) {
  const i = res.xs.findIndex((x) => Math.abs(x - X) < 1e-9);
  if (i < 0) return NaN;
  for (const t of res.tranches) {
    const j = t.zs.findIndex((zz, k) => Math.abs(zz - z) < 1e-9 && t.bases[k] === !!base);
    if (j >= 0) return t.valeurs[cle][j * res.xs.length + i];
  }
  return NaN;
}

/**
 * Lignes du tableau de la grille, comme le tableau des sollicitations : surface, puis base
 * et sommet de chaque interface, et le fond de la grille dans le sol.
 */
export function lignesGrille(res) {
  const nom = (i) => res.couches[i].nom ?? `couche ${i + 1}`;
  const lignes = [{ libelle: "Surface", z: 0, base: false, couche: 0 }];
  for (let i = 0; i < res.couches.length - 1; i++) {
    const z = res.sommets[i + 1];
    lignes.push({ libelle: `base ${nom(i)}`, z, base: true, couche: i });
    lignes.push({ libelle: `sommet ${nom(i + 1)}`, z, base: false, couche: i + 1 });
  }
  lignes.push({ libelle: `fond de la grille (${nom(res.couches.length - 1)})`, z: res.zMax, base: false, couche: res.couches.length - 1 });
  return lignes;
}

/**
 * Grille complète au format CSV des tableurs français (séparateur « ; », virgule
 * décimale) : un nœud par ligne, toutes les grandeurs.
 */
export function csvChamps(res) {
  const nombre = (x, d) => (Number.isFinite(x) ? x.toFixed(d).replace(".", ",") : "");
  const entete = ["x (m)", "z (m)", "côté", "couche", "E (MPa)",
    ...ORDRE_GRANDEURS.map((k) => `${GRANDEURS_CHAMPS[k].symbole} (${GRANDEURS_CHAMPS[k].unite})`)];
  const lignes = [entete.join(";")];
  for (const t of res.tranches) {
    t.zs.forEach((z, j) => {
      const cote = t.bases[j] ? "base" : j === 0 ? "sommet" : "";
      res.xs.forEach((X, i) => {
        lignes.push([nombre(X, 4), nombre(z, 4), cote, `"${String(t.nom).replace(/"/g, "'")}"`, nombre(t.E, 0),
          ...ORDRE_GRANDEURS.map((k) => nombre(t.valeurs[k][j * res.xs.length + i], GRANDEURS_CHAMPS[k].decimales + 2))].join(";"));
      });
    });
  }
  return lignes.join("\r\n") + "\r\n";
}
