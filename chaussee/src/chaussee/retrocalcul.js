// Rétrocalcul des modules par Levenberg-Marquardt (portage de BackCalculator de
// Burmister-Calc). Aucune physique nouvelle : l'optimiseur s'appuie sur le
// moteur direct de Burmister. Les paramètres optimisés sont les LOGARITHMES des
// modules des couches libres, ce qui garantit leur positivité.
//
// Deux modes de mesure :
//   « benkelman » — déflexion d0 entre jumelage (mm/100) et, s'il est relevé,
//                   rayon de courbure Rdc (m) ;
//   « bassin »    — bassin FWD / curviamètre : déflexions (mm/100) au point
//                   entre-jumelage décalé de chaque distance (m) dans le sens
//                   de circulation.
//
// Statut d'une couche (champ `contrainte`) : "libre" (module cherché), "fixe"
// (module imposé, valeur par défaut) ou "liee" (module = rapport × module de la
// couche du dessous, plafonné à `moduleMax` s'il est renseigné).
//
// Performances : la géométrie (rayon de charge, distances roue-point, nœuds de
// quadrature) ne change pas d'une itération à l'autre. Le simulateur calcule
// donc une fois pour toutes les fonctions de Bessel, puis ne résout plus que
// le noyau multicouche, une seule passe donnant à la fois les déflexions et le
// rayon de courbure. Les valeurs obtenues sont identiques, opération pour
// opération, à celles de burmister.js (un test le vérifie).

import { J0, J1 } from "./bessel.js";
import { noeuds } from "./quadrature.js";
import { Noyau } from "./noyau.js";
import { resoudre } from "./gauss.js";
import { ESSIEU_REFERENCE, rayonContact, rouesJumelage } from "./burmister.js";

export const MODES_MESURE = Object.freeze({ BENKELMAN: "benkelman", BASSIN: "bassin" });

const maintenant = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

const contrainteDe = (c) => c?.contrainte ?? "fixe";

const fmt = (x, d) => (Number.isFinite(x)
  ? x.toLocaleString("fr-FR", { maximumFractionDigits: d, useGrouping: false })
  : String(x));

// ─────────────────────────────── Réglages ────────────────────────────────

/**
 * Réglages d'un rétrocalcul, complétés des valeurs par défaut :
 * { mode: "benkelman" | "bassin", d0 (mm/100), rdc (m, null si non mesuré),
 *   decalages [m], deflexions [mm/100], iterationsMax (50), tolerance (1e-6),
 *   poids (null : toutes les mesures comptent autant) }.
 */
export function normaliserReglages(r = {}) {
  const rdc = typeof r.rdc === "number" && !Number.isNaN(r.rdc) ? r.rdc : null;
  return {
    mode: r.mode === MODES_MESURE.BASSIN ? MODES_MESURE.BASSIN : MODES_MESURE.BENKELMAN,
    d0: r.d0 ?? 0,
    rdc,
    decalages: [...(r.decalages ?? [])],
    deflexions: [...(r.deflexions ?? [])],
    iterationsMax: r.iterationsMax ?? 50,
    tolerance: r.tolerance ?? 1e-6,
    poids: r.poids ? [...r.poids] : null,
  };
}

/** Vrai quand le rayon de courbure fait partie des mesures à caler. */
export function utiliseRdc(reglages) {
  const r = normaliserReglages(reglages);
  return r.mode === MODES_MESURE.BENKELMAN && r.rdc !== null;
}

/** Vecteur des mesures, dans l'ordre attendu par l'optimiseur. */
export function cibleMesures(reglages) {
  const r = normaliserReglages(reglages);
  if (r.mode === MODES_MESURE.BENKELMAN) return r.rdc !== null ? [r.d0, r.rdc] : [r.d0];
  return [...r.deflexions];
}

/** Libellés des mesures, dans le même ordre que le vecteur cible. */
export function libellesMesures(reglages) {
  const r = normaliserReglages(reglages);
  if (r.mode === MODES_MESURE.BENKELMAN) return r.rdc !== null ? ["d0 (mm/100)", "Rdc (m)"] : ["d0 (mm/100)"];
  return r.decalages.map((y) => `déflexion à ${fmt(y, 3)} m (mm/100)`);
}

/** Nombre de mesures effectivement calées, selon le mode. */
export function nombreMesures(reglages) {
  const r = normaliserReglages(reglages);
  return r.mode === MODES_MESURE.BENKELMAN ? (r.rdc !== null ? 2 : 1) : r.deflexions.length;
}

// ──────────────────────────── Vecteur des modules ─────────────────────────

/** Nombre de couches dont le module est recherché. */
export const nombreLibres = (couches) => couches.filter((c) => contrainteDe(c) === "libre").length;

/** Indices des couches libres, dans l'ordre du vecteur de paramètres. */
export const indicesLibres = (couches) =>
  couches.map((c, i) => (contrainteDe(c) === "libre" ? i : -1)).filter((i) => i >= 0);

/**
 * Reconstitue le vecteur complet des modules (MPa) à partir des logarithmes
 * des modules libres. Passe 1 : couches fixes et libres, dans l'ordre. Passe
 * 2 : couches liées, du bas vers le haut, de sorte qu'une chaîne de
 * dépendances se résolve naturellement. Le plafond `moduleMax` du pays
 * s'impose au rapport : sans lui, trois sous-couches à k = 2 sur un sol à
 * 80 MPa donneraient 640 MPa, là où le tableau 20 du Cerema arrête à 400.
 */
export function resoudreModules(couches, logLibres = []) {
  const n = couches.length;
  const e = new Array(n).fill(0);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const s = contrainteDe(couches[i]);
    if (s === "fixe") e[i] = couches[i].E;
    else if (s === "libre") e[i] = Math.exp(logLibres[k++]);
    // les couches liées restent à 0, résolues en passe 2
  }
  for (let i = n - 2; i >= 0; i--) {
    const c = couches[i];
    if (contrainteDe(c) !== "liee") continue;
    const brut = (c.rapport ?? 1) * e[i + 1];
    e[i] = Number.isFinite(c.moduleMax) && brut > c.moduleMax ? c.moduleMax : brut;
  }
  return e;
}

/** Copie des couches portant les modules donnés. */
export const avecModules = (couches, modules) => couches.map((c, i) => ({ ...c, E: modules[i] }));

// ─────────────────────────────── Simulation ───────────────────────────────

/**
 * Prépare la simulation répétée d'une structure dont seuls les modules
 * changent : épaisseurs, coefficients de Poisson, interfaces et essieu sont
 * figés. Renvoie { simuler(modules) → grandeurs simulées (même ordre que la
 * cible), evaluations }. En mode Benkelman sans Rdc, la passe du rayon de
 * courbure est purement et simplement évitée.
 */
export function creerSimulateur(couches, essieu = ESSIEU_REFERENCE, reglagesEntree = {}) {
  if (!couches?.length) throw new Error("au moins une couche est requise");
  const reglages = normaliserReglages(reglagesEntree);
  const benkelman = reglages.mode === MODES_MESURE.BENKELMAN;
  const avecRdc = benkelman && reglages.rdc !== null;
  const a = rayonContact(essieu);
  const roues = rouesJumelage(essieu);
  const kf = -roues[0].q * a;                   // −q·a, q en Pa
  const qPa = essieu.q * 1e6;
  const xm = essieu.entraxe / 2;
  const points = benkelman ? [{ x: xm, y: 0 }] : reglages.decalages.map((y) => ({ x: xm, y }));

  // Distances roue-point distinctes : une seule série de Bessel par distance.
  const rValeurs = [];
  const indicesR = points.map((p) => roues.map((w) => {
    const dx = p.x - w.x, dy = p.y - w.y;
    const r = Math.sqrt(dx * dx + dy * dy);
    let ri = rValeurs.findIndex((v) => Math.abs(v - r) < 1e-12);
    if (ri < 0) { rValeurs.push(r); ri = rValeurs.length - 1; }
    return ri;
  }));

  const q = noeuds(a);
  const nq = q.n, nr = rValeurs.length;
  const fg = new Float64Array(nr * nq);          // J1(ξa)·w · J0(ξr)
  const j1a = new Float64Array(nq), cd = new Float64Array(nq);
  const d = essieu.entraxe / 2;
  for (let k = 0; k < nq; k++) {
    const xi = q.xi[k];
    j1a[k] = J1(xi * a);
    const f = j1a[k] * q.w[k];
    for (let j = 0; j < nr; j++) {
      const r = rValeurs[j];
      fg[j * nq + k] = f * (r > 1e-9 ? J0(xi * r) : 1);
    }
    if (avecRdc) cd[k] = (-xi * J1(xi * d)) / d;
  }

  // Topologie figée : la dernière couche est semi-infinie, une interface
  // semi-collée se résout comme Alizé (moyenne des variantes collée et glissante).
  const base = couches.map((c) => ({ E: c.E, nu: c.nu, h: c.h, interface: c.interface ?? "collee" }));
  base[base.length - 1].h = Infinity;
  const types = base.some((c) => c.interface === "semi-collee") ? ["collee", "glissante"] : [null];

  let evaluations = 0;
  const s = new Float64Array(nr);

  function simuler(modules) {
    evaluations++;
    const uz = new Float64Array(points.length);
    let wpp = 0;
    const nv = types.length;
    for (const t of types) {
      const variante = base.map((c, i) => ({
        ...c, E: modules[i], interface: t && c.interface === "semi-collee" ? t : c.interface,
      }));
      const noyau = new Noyau(variante);
      const nu0 = variante[0].nu;
      const mu0 = (variante[0].E * 1e6) / (2 * (1 + nu0));
      s.fill(0);
      let sR = 0;
      for (let k = 0; k < nq; k++) {
        const xi = q.xi[k];
        noyau.resoudre(xi);
        const ep = noyau.semiInfinie[0] ? 0 : 1;
        const v0 = noyau.A[0], v1 = noyau.B[0], v2 = noyau.C[0] * ep, v3 = noyau.D[0] * ep;
        const expr = -v0 + v1 * (4 * nu0 - 2) - v2 + v3 * (2 - 4 * nu0);
        const kUz = expr * (1 / (2 * mu0 * xi));
        for (let j = 0; j < nr; j++) s[j] += kUz * fg[j * nq + k];
        if (avecRdc) sR += (expr / (2 * mu0 * xi)) * j1a[k] * cd[k] * q.w[k];
      }
      for (let p = 0; p < points.length; p++) {
        let u = 0;
        for (const ri of indicesR[p]) u += kf * s[ri];
        uz[p] += (1 / nv) * u;
      }
      if (avecRdc) wpp += (2 * (-qPa * a) * sR) / nv;
    }
    const deflexions = Array.from(uz, (u) => u * 1e5);
    if (!benkelman) return deflexions;
    return avecRdc ? [deflexions[0], 1 / Math.abs(wpp)] : [deflexions[0]];
  }

  return { simuler, get evaluations() { return evaluations; } };
}

/** Grandeurs simulées correspondant au mode de mesure, pour les modules portés par les couches. */
export function simuler(couches, essieu = ESSIEU_REFERENCE, reglages = {}) {
  return creerSimulateur(couches, essieu, reglages).simuler(couches.map((c) => c.E));
}

/** Écart quadratique moyen relatif entre mesure et simulation, en pourcentage. */
export function ecartRmsRelatif(cible, simule) {
  let s = 0, n = 0;
  for (let i = 0; i < cible.length; i++) {
    if (Math.abs(cible[i]) < 1e-12) continue;
    if (!(i < simule.length)) return NaN;
    const d = (simule[i] - cible[i]) / cible[i];
    s += d * d; n++;
  }
  return n === 0 ? NaN : Math.sqrt(s / n) * 100;
}

// ─────────────────────────────── Diagnostic ───────────────────────────────

/**
 * Examine la configuration. Les erreurs de structure (rien à rechercher,
 * rapport manquant, mesures incohérentes) sont bloquantes. Le cas « moins de
 * mesures que d'inconnues » ne l'est pas : le système amorti reste résoluble
 * et rend une solution parmi une infinité, calée sur le point de départ.
 * Renvoie { message, bloquant } ou null.
 */
export function diagnostiquer(couches, reglagesEntree = {}) {
  const reglages = normaliserReglages(reglagesEntree);
  const bloquant = (message) => ({ message, bloquant: true });

  const libres = nombreLibres(couches);
  if (libres === 0) return bloquant("Aucune couche libre : rien à rechercher.");

  if (contrainteDe(couches[couches.length - 1]) === "liee")
    return bloquant("La couche semi-infinie ne peut pas dépendre d'une couche en dessous.");

  for (let i = 0; i < couches.length; i++) {
    const c = couches[i];
    if (contrainteDe(c) !== "liee") continue;
    if (!(c.rapport > 0))
      return bloquant(`La couche ${c.nom ?? `couche ${i + 1}`} est dépendante mais son ratio n'est pas renseigné.`);
  }

  const m = nombreMesures(reglages);
  if (reglages.mode === MODES_MESURE.BASSIN && reglages.decalages.length !== reglages.deflexions.length)
    return bloquant("Le nombre d'offsets et le nombre de déflexions mesurées diffèrent.");
  if (m === 0) return bloquant("Aucune mesure fournie.");
  if (m < libres) {
    const cause = reglages.mode === MODES_MESURE.BENKELMAN && reglages.rdc === null
      ? "Système sous-déterminé : sans rayon de courbure mesuré, le calage porte sur la seule "
        + `déflexion d0, soit 1 mesure pour ${libres} modules recherchés.`
      : `Système sous-déterminé : ${m} mesure(s) pour ${libres} module(s) recherché(s).`;
    return {
      message: cause + " Le calcul reste possible, mais la solution n'est pas unique : une infinité de jeux "
        + "de modules reproduisent les mêmes mesures, et celui retenu dépend des valeurs de départ. "
        + "Pour lever l'indétermination : fixer une couche, lier deux modules par un ratio, "
        + "ou ajouter une mesure (rayon de courbure, bassin de déflexion).",
      bloquant: false,
    };
  }
  return null;
}

/** Message de diagnostic seul, bloquant ou non (null si rien à dire). */
export const valider = (couches, reglages) => diagnostiquer(couches, reglages)?.message ?? null;

// ─────────────────────────────── Optimiseur ───────────────────────────────

/**
 * Lance l'optimisation de Levenberg-Marquardt. `modulesDepart` donne le point
 * de départ des couches libres (MPa, dans l'ordre des couches libres) ; à
 * défaut, les modules courants des couches sont utilisés.
 *
 * Renvoie { modules (MPa, toutes couches), converge, iterations, cible,
 * simule, residus, cout, ecartRmsRelatifPourcent, avertissement,
 * sousDetermine, dureeMs, evaluations }.
 */
export function retrocalculer(couches, essieu = ESSIEU_REFERENCE, reglagesEntree = {}, modulesDepart = null) {
  const t0 = maintenant();
  const reglages = normaliserReglages(reglagesEntree);
  const diagnostic = diagnostiquer(couches, reglages);
  const libres = nombreLibres(couches);
  const sousDetermine = nombreMesures(reglages) < libres;
  const cible = cibleMesures(reglages);
  const fin = (r) => ({
    ...r, cible,
    residus: r.simule.length ? cible.map((t, i) => t - r.simule[i]) : [],
    ecartRmsRelatifPourcent: r.simule.length ? ecartRmsRelatif(cible, r.simule) : NaN,
    sousDetermine, dureeMs: maintenant() - t0,
  });

  if (diagnostic?.bloquant) {
    return fin({ modules: couches.map((c) => c.E), converge: false, iterations: 0, simule: [],
                 cout: NaN, avertissement: diagnostic.message, evaluations: 0 });
  }

  const idx = indicesLibres(couches);
  let x = idx.map((i, j) => {
    const e0 = modulesDepart && j < modulesDepart.length && modulesDepart[j] > 0 ? modulesDepart[j] : couches[i].E;
    return Math.log(Math.max(e0, 1e-6));
  });

  const m = cible.length;
  const w = reglages.poids ? [...reglages.poids] : new Array(m).fill(1);
  if (w.length !== m) throw new Error("Le nombre de poids ne correspond pas au nombre de mesures.");

  // Les résidus sont ramenés à des ÉCARTS RELATIFS avant d'entrer dans le coût.
  // Sans cela, en mode Benkelman, le coût additionne des mm/100 et des mètres :
  // un rayon de 400 m pèse cinq fois une déflexion de 70, et ses résidus pèsent
  // le carré de ce rapport. L'optimiseur minimise donc l'écart RMS relatif que
  // l'interface affiche ; les poids de l'appelant restent un facteur par-dessus.
  for (let i = 0; i < m; i++) w[i] /= Math.max(Math.abs(cible[i]), 1e-9);

  const simulateur = creerSimulateur(couches, essieu, reglages);
  const simulerEn = (xx) => simulateur.simuler(resoudreModules(couches, xx));
  const coutDe = (sim) => {
    let s = 0;
    for (let i = 0; i < m; i++) { const d = w[i] * (cible[i] - sim[i]); s += d * d; }
    return s;
  };

  // Plancher d'amortissement : quand le système est sous-déterminé, JᵀJ est
  // singulière et seul λ·diag(JᵀJ) la rend inversible. Le maintenir à 1e-6
  // borne le pas, façon régression ridge : l'optimiseur s'arrête sur le point
  // de la variété des solutions atteint depuis le départ.
  const lambdaPlancher = sousDetermine ? 1e-6 : 1e-12;
  let lambda = 1e-3;
  let simX = simulerEn(x);
  let coutPrecedent = coutDe(simX);
  let converge = false, stationnaire = false;
  let iter = 0;
  const h = 1e-4;
  const nl = libres;
  let jacobien = null;               // conservé tant que x ne bouge pas (pas refusé)

  for (; iter < reglages.iterationsMax; iter++) {
    const sim0 = simX;

    // Jacobien par différences finies sur les log-modules.
    if (!jacobien) {
      jacobien = Array.from({ length: m }, () => new Array(nl).fill(0));
      for (let c = 0; c < nl; c++) {
        const xh = x.slice();
        xh[c] += h;
        const simh = simulerEn(xh);
        for (let i = 0; i < m; i++) jacobien[i][c] = (w[i] * (simh[i] - sim0[i])) / h;
      }
    }
    const J = jacobien;

    // Système normal amorti : (JᵀJ + λ·diag(JᵀJ)) dx = Jᵀr
    const jtj = Array.from({ length: nl }, () => new Array(nl).fill(0));
    const jtr = new Array(nl).fill(0);
    for (let i = 0; i < nl; i++) {
      for (let k = 0; k < nl; k++) {
        let s = 0;
        for (let r = 0; r < m; r++) s += J[r][i] * J[r][k];
        jtj[i][k] = s;
      }
      let sr = 0;
      for (let r = 0; r < m; r++) sr += J[r][i] * w[r] * (cible[r] - sim0[r]);
      jtr[i] = sr;
    }
    for (let i = 0; i < nl; i++) jtj[i][i] *= 1 + lambda;

    const dx = resoudre(jtj, jtr);
    const xNouveau = x.map((v, i) => v + dx[i]);

    // Un système mal conditionné peut rendre un pas non fini : le traiter
    // comme un pas refusé plutôt que de propager des NaN dans les modules.
    if (!xNouveau.every(Number.isFinite)) {
      lambda *= 10;
      if (lambda > 1e12) break;
      continue;
    }

    const simNouveau = simulerEn(xNouveau);
    const coutNouveau = coutDe(simNouveau);
    if (coutNouveau < coutPrecedent) {
      x = xNouveau;
      simX = simNouveau;
      jacobien = null;
      lambda = Math.max(lambda / 10, lambdaPlancher);
      // Critère relatif : le coût porte les unités des mesures, un seuil absolu
      // ne serait pas transposable d'un mode à l'autre.
      if (Math.abs(coutPrecedent - coutNouveau) < reglages.tolerance * Math.max(1, coutPrecedent)) {
        coutPrecedent = coutNouveau; converge = true; iter++; break;
      }
      coutPrecedent = coutNouveau;
    } else {
      lambda *= 10;
      // Amortissement saturé après un pas REFUSÉ : plus aucune direction ne
      // diminue le coût. C'est un point stationnaire — donc une convergence,
      // et non un échec (deux mesures pour une inconnue n'annulent jamais le
      // résidu ; la qualité du calage se juge sur l'écart affiché).
      if (lambda > 1e12) { stationnaire = true; break; }
    }
  }

  if (stationnaire) converge = true;
  let echelle = 0;
  for (let i = 0; i < m; i++) echelle += w[i] * cible[i] * w[i] * cible[i];
  if (!converge && coutPrecedent <= 1e-12 * Math.max(echelle, 1)) converge = true;

  return fin({
    modules: resoudreModules(couches, x),
    converge, iterations: iter,
    simule: simX,
    cout: coutPrecedent,
    avertissement: diagnostic?.message ?? null,
    evaluations: simulateur.evaluations,
  });
}
