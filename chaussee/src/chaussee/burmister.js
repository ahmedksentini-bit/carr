// Moteur de Burmister : intégration de Hankel des noyaux multicouches,
// superposition des roues du jumelage, interfaces semi-collées, déflexions et
// rayon de courbure. Portage fidèle du moteur de Burmister-Calc, lui-même
// calé sur Alizé-LCPC (tests/burmister.test.mjs rejoue ses cas de référence).
//
// Unités à l'entrée : E en MPa, h en m · essieu : P charge par roue en kN,
// q pression de contact en MPa, a rayon de contact en m, entraxe en m.
// Unités à la sortie : contraintes en MPa (compression négative dans le
// repère mécanique), déformations en µdéf, déplacement vertical en m (positif
// vers le bas), déflexions en mm/100, rayon de courbure en m.

import { J0, J1 } from "./bessel.js";
import { noeuds } from "./quadrature.js";
import { Noyau } from "./noyau.js";

const TOL = 1e-9;

/** Essieu de référence français : jumelage 2 × 32,5 kN, q = 0,662 MPa, a = 0,125 m, entraxe 0,375 m. */
export const ESSIEU_REFERENCE = Object.freeze({ P: 32.5, q: 0.662, a: 0.125, entraxe: 0.375 });

/** Rayon de contact (m) : imposé, ou déduit de la charge et de la pression (P = q·πa²). */
export function rayonContact(essieu) {
  return essieu.a ?? Math.sqrt((essieu.P * 1e3) / (Math.PI * essieu.q * 1e6));
}

/** Les deux roues du jumelage, en x = 0 et x = entraxe (convention Alizé). Pression en Pa. */
export function rouesJumelage(essieu) {
  const a = rayonContact(essieu), q = essieu.q * 1e6;
  return [{ x: 0, y: 0, a, q }, { x: essieu.entraxe, y: 0, a, q }];
}

/** Copie des couches, la dernière rendue semi-infinie. */
function normaliser(couches) {
  if (!couches?.length) throw new Error("au moins une couche est requise");
  const c = couches.map((x) => ({ ...x, interface: x.interface ?? "collee" }));
  c[c.length - 1].h = Infinity;
  return c;
}

/**
 * Prépare une structure pour l'évaluation. Une interface semi-collée est
 * traitée comme Alizé : moyenne des champs des variantes collée et
 * glissante, la loi de Hooke étant appliquée APRÈS la moyenne.
 */
export function creerMoteur(couchesEntree) {
  const couches = normaliser(couchesEntree);
  const n = couches.length;
  const sommets = new Float64Array(n);
  for (let i = 1; i < n; i++) sommets[i] = sommets[i - 1] + couches[i - 1].h;

  const variantes = couches.some((c) => c.interface === "semi-collee")
    ? ["collee", "glissante"].map((t) => couches.map((c) =>
        ({ ...c, interface: c.interface === "semi-collee" ? t : c.interface })))
    : [couches];

  /** Couche contenant la cote z ; à une interface, `base` choisit la couche du dessus (z⁻). */
  function localiser(z, base = false) {
    if (z < -TOL) throw new RangeError("cote négative");
    for (let i = 0; i < n; i++) {
      const fond = sommets[i] + couches[i].h;
      const dedans = base ? z <= fond + TOL : z < fond - TOL;
      if (dedans) return { couche: i, zLocal: Math.max(0, z - sommets[i]) };
    }
    return { couche: n - 1, zLocal: z - sommets[n - 1] };
  }

  /**
   * Réponse en chaque point { x, y, z, base }, roues superposées.
   * Renvoie [{ couche, E, nu, sxx, syy, szz, sxy (MPa), exx, eyy, ezz (µdéf), uz (m) }].
   */
  function evaluer(roues, points) {
    if (!roues?.length) throw new Error("aucune roue");
    const np = points.length;
    const loc = points.map((p) => localiser(p.z, !!p.base));
    const acc = loc.map((l) => ({
      couche: l.couche, E: couches[l.couche].E, nu: couches[l.couche].nu,
      sxx: 0, syy: 0, szz: 0, sxy: 0, uz: 0, exx: 0, eyy: 0, ezz: 0,
    }));
    const wv = 1 / variantes.length;
    for (const v of variantes) {
      const champs = evaluerVariante(v, roues, points, loc);
      for (let i = 0; i < np; i++) {
        acc[i].sxx += wv * champs.sxx[i];
        acc[i].syy += wv * champs.syy[i];
        acc[i].szz += wv * champs.szz[i];
        acc[i].sxy += wv * champs.sxy[i];
        acc[i].uz += wv * champs.uz[i];
      }
    }
    // Loi de Hooke appliquée aux champs moyennés (jamais l'inverse).
    for (const p of acc) {
      p.exx = ((p.sxx - p.nu * (p.syy + p.szz)) / p.E) * 1e6;
      p.eyy = ((p.syy - p.nu * (p.sxx + p.szz)) / p.E) * 1e6;
      p.ezz = ((p.szz - p.nu * (p.sxx + p.syy)) / p.E) * 1e6;
    }
    return acc;
  }

  function evaluerVariante(variante, roues, points, loc) {
    const np = points.length;
    const res = {
      sxx: new Float64Array(np), syy: new Float64Array(np), szz: new Float64Array(np),
      sxy: new Float64Array(np), uz: new Float64Array(np),
    };
    const mu = variante.map((c) => (c.E * 1e6) / (2 * (1 + c.nu)));
    const nu = variante.map((c) => c.nu);

    // Les roues de même rayon partagent la quadrature.
    const groupes = new Map();
    roues.forEach((r, i) => {
      if (!groupes.has(r.a)) groupes.set(r.a, []);
      groupes.get(r.a).push(i);
    });

    for (const [rayon, indices] of groupes) {
      // Distances point/roue distinctes : les appels de Bessel sont mutualisés.
      const rValeurs = [];
      const taches = [];
      for (const wi of indices) {
        const w = roues[wi];
        for (let pi = 0; pi < np; pi++) {
          const dx = points[pi].x - w.x, dy = (points[pi].y ?? 0) - w.y;
          const r = Math.sqrt(dx * dx + dy * dy);
          let ri = rValeurs.findIndex((v) => Math.abs(v - r) < 1e-12);
          if (ri < 0) { rValeurs.push(r); ri = rValeurs.length - 1; }
          taches.push({ pi, wi, li: loc[pi].couche, zl: loc[pi].zLocal, ri, dx, dy, r });
        }
      }
      const nt = taches.length, nr = rValeurs.length;
      const sSz = new Float64Array(nt), sUz = new Float64Array(nt), sH = new Float64Array(nt);
      const sSs = new Float64Array(nt), sUrr = new Float64Array(nt);
      const g0 = new Float64Array(nr), g1 = new Float64Array(nr);
      const q = noeuds(rayon);
      const noyau = new Noyau(variante);

      for (let k = 0; k < q.n; k++) {
        const xi = q.xi[k];
        noyau.resoudre(xi);
        const f = J1(xi * rayon) * q.w[k];
        for (let j = 0; j < nr; j++) {
          const r = rValeurs[j];
          if (r > 1e-9) { g0[j] = J0(xi * r); g1[j] = J1(xi * r) / r; }
          else { g0[j] = 1; g1[j] = xi / 2; }
        }
        for (let ti = 0; ti < nt; ti++) {
          const tk = taches[ti];
          const li = tk.li;
          if (li >= noyau.nombre) continue;   // sous une couche tronquée : contribution négligeable
          const t = xi * tk.zl;
          const en = Math.exp(-t);
          const ep = noyau.semiInfinie[li] ? 0 : Math.exp(t);
          const v0 = noyau.A[li] * en, v1 = noyau.B[li] * en;
          const v2 = noyau.C[li] * ep, v3 = noyau.D[li] * ep;
          const nn = nu[li];
          const inv = 1 / (2 * mu[li] * xi);
          const kSz = v0 + v1 * (1 - 2 * nn + t) - v2 + v3 * (1 - 2 * nn - t);
          const kUz = (-v0 + v1 * (4 * nn - 2 - t) - v2 + v3 * (2 - 4 * nn - t)) * inv;
          const kUr = (-v0 + v1 * (1 - t) + v2 + v3 * (1 + t)) * inv;
          // Partie J0 de σr. Le coefficient de v3 est (1 + 2ν + t) : dérivé de
          // H = ∂/∂z[(ν − 1)∇²φ + ∂²φ/∂z²], même structure que kSs.
          const kH = -v0 + v1 * (1 + 2 * nn - t) + v2 + v3 * (1 + 2 * nn + t);
          const kSs = -v0 + v1 * (1 + 4 * nn - t) + v2 + v3 * (1 + 4 * nn + t);
          const fg = f * g0[tk.ri];
          sSz[ti] += kSz * fg;
          sUz[ti] += kUz * fg;
          sH[ti] += kH * fg;
          sSs[ti] += kSs * fg;
          sUrr[ti] += kUr * f * g1[tk.ri];
        }
      }

      // Grandeurs physiques, puis projection dans le repère cartésien.
      for (let ti = 0; ti < nt; ti++) {
        const tk = taches[ti];
        const w = roues[tk.wi];
        const kf = -w.q * w.a;
        const sigmaZ = kf * sSz[ti];
        const uz = kf * sUz[ti];
        const h = kf * sH[ti];
        const srpt = kf * sSs[ti];
        const urr = kf * sUrr[ti];
        const sigmaR = h - 2 * mu[tk.li] * urr;
        const sigmaT = srpt - sigmaR;
        const cs = tk.r > 1e-9 ? tk.dx / tk.r : 1;
        const sn = tk.r > 1e-9 ? tk.dy / tk.r : 0;
        const c2 = cs * cs, s2 = sn * sn;
        res.sxx[tk.pi] += (sigmaR * c2 + sigmaT * s2) / 1e6;
        res.syy[tk.pi] += (sigmaR * s2 + sigmaT * c2) / 1e6;
        res.sxy[tk.pi] += ((sigmaR - sigmaT) * sn * cs) / 1e6;
        res.szz[tk.pi] += sigmaZ / 1e6;
        res.uz[tk.pi] += uz;
      }
    }
    return res;
  }

  /**
   * Rayon de courbure (m) au point entre-jumelage, calculé analytiquement dans
   * le domaine de Hankel (dérivée seconde de la déflexion dans le sens de
   * circulation). Des différences finies sur la déflexion donneraient des
   * valeurs fausses : ne pas les utiliser.
   * a en m, q en Pa, entraxe en m.
   */
  function rayonCourbure(a, qPa, entraxe) {
    const d = entraxe / 2;
    if (!(d > 0)) throw new RangeError("entraxe nul");
    let wpp = 0;
    for (const v of variantes) {
      const qd = noeuds(a);
      const noyau = new Noyau(v);
      const nu0 = v[0].nu;
      const mu0 = (v[0].E * 1e6) / (2 * (1 + nu0));
      let s = 0;
      for (let k = 0; k < qd.n; k++) {
        const xi = qd.xi[k];
        noyau.resoudre(xi);
        const ep = noyau.semiInfinie[0] ? 0 : 1;
        const v0 = noyau.A[0], v1 = noyau.B[0], v2 = noyau.C[0] * ep, v3 = noyau.D[0] * ep;
        const kUz = (-v0 + v1 * (4 * nu0 - 2) - v2 + v3 * (2 - 4 * nu0)) / (2 * mu0 * xi);
        s += kUz * J1(xi * a) * ((-xi * J1(xi * d)) / d) * qd.w[k];
      }
      wpp += (2 * (-qPa * a) * s) / variantes.length;
    }
    return 1 / Math.abs(wpp);
  }

  return {
    couches, sommets: Array.from(sommets),
    profondeurLiee: sommets[n - 1],
    semiCollee: variantes.length > 1,
    localiser, evaluer, rayonCourbure,
  };
}

// ─────────────────────── Tableau des sollicitations ───────────────────────

export const SOUS_ROUE = "sous roue";
export const ENTRE_JUMELAGE = "entre jumelage";

const fmtZ = (z) => z.toFixed(3);

/** Surface, puis base et sommet de chaque interface. */
function cotes(moteur) {
  const { couches, sommets } = moteur;
  const liste = [{ z: 0, base: false, libelle: "Surface" }];
  for (let i = 0; i < couches.length - 1; i++) {
    const z = sommets[i] + couches[i].h;
    liste.push({ z, base: true, libelle: `${fmtZ(z)} base ${couches[i].nom ?? `couche ${i + 1}`}` });
    liste.push({ z, base: false, libelle: `${fmtZ(z)} sommet ${couches[i + 1].nom ?? `couche ${i + 2}`}` });
  }
  return liste;
}

/**
 * Extrema retenus sur les deux positions caractéristiques, convention d'Alizé :
 * εT et σT = minimum de (−εxx, −εyy) et (−σxx, −σyy) ; εz et σz = maximum de
 * −εzz et −σzz. Une traction horizontale apparaît donc NÉGATIVE.
 */
function extrema(reponses, noms) {
  const r = { epsT: Infinity, sigT: Infinity, epsZ: -Infinity, sigZ: -Infinity,
              epsTDe: null, sigTDe: null, epsZDe: null, sigZDe: null };
  reponses.forEach((p, k) => {
    const epsT = Math.min(-p.exx, -p.eyy), sigT = Math.min(-p.sxx, -p.syy);
    if (epsT < r.epsT) { r.epsT = epsT; r.epsTDe = noms[k]; }
    if (sigT < r.sigT) { r.sigT = sigT; r.sigTDe = noms[k]; }
    if (-p.ezz > r.epsZ) { r.epsZ = -p.ezz; r.epsZDe = noms[k]; }
    if (-p.szz > r.sigZ) { r.sigZ = -p.szz; r.sigZDe = noms[k]; }
  });
  return r;
}

/**
 * Calcul complet d'une structure sous un jumelage : tableau des sollicitations
 * (une ligne par cote caractéristique, détail par position), déflexions sous
 * roue et entre jumelage, rayon de courbure.
 */
export function analyser(couches, essieu = ESSIEU_REFERENCE) {
  const moteur = creerMoteur(couches);
  const roues = rouesJumelage(essieu);
  const xs = [0, essieu.entraxe / 2];
  const noms = [SOUS_ROUE, ENTRE_JUMELAGE];
  const liste = cotes(moteur);
  const points = [];
  for (const d of liste) for (const x of xs) points.push({ x, y: 0, z: d.z, base: d.base });
  const rep = moteur.evaluer(roues, points);

  const lignes = liste.map((d, i) => {
    const { couche } = moteur.localiser(d.z, d.base);
    const parPosition = xs.map((x, k) => ({ x, nom: noms[k], ...rep[i * xs.length + k] }));
    return {
      libelle: d.libelle, z: d.z, base: d.base, couche,
      E: moteur.couches[couche].E, nu: moteur.couches[couche].nu,
      ...extrema(parPosition, noms),
      positions: parPosition,
    };
  });

  const a = rayonContact(essieu);
  const rdc = moteur.rayonCourbure(a, essieu.q * 1e6, essieu.entraxe);
  return {
    lignes,
    deflexionSousRoue: rep[0].uz * 1e5,
    deflexionEntreJumelage: rep[xs.length - 1].uz * 1e5,
    rdc,
    rayonContact: a,
    moteur,
  };
}

/** Ligne du tableau à la cote z, du côté demandé (base = z⁻). */
export function ligneA(analyse, z, base) {
  return analyse.lignes.find((l) => Math.abs(l.z - z) < 1e-9 && l.base === base) ?? null;
}

// ─────────────────────────────── Déflexions ───────────────────────────────

/**
 * Bassin de déflexion (mm/100) : déflexions au point entre-jumelage décalé de
 * chaque distance dans le sens de circulation (axe y). Une seule intégration.
 */
export function bassin(couches, essieu = ESSIEU_REFERENCE, decalages = [0]) {
  const moteur = creerMoteur(couches);
  const xm = essieu.entraxe / 2;
  const rep = moteur.evaluer(rouesJumelage(essieu), decalages.map((y) => ({ x: xm, y, z: 0 })));
  return rep.map((p) => p.uz * 1e5);
}

/** Déflexion (mm/100) au point entre-jumelage. */
export const deflexionEntreJumelage = (couches, essieu = ESSIEU_REFERENCE) => bassin(couches, essieu, [0])[0];

/** Déflexion (mm/100) sous roue. */
export function deflexionSousRoue(couches, essieu = ESSIEU_REFERENCE) {
  const rep = creerMoteur(couches).evaluer(rouesJumelage(essieu), [{ x: 0, y: 0, z: 0 }]);
  return rep[0].uz * 1e5;
}

/** Rayon de courbure (m) au point entre-jumelage. */
export function rayonDeCourbure(couches, essieu = ESSIEU_REFERENCE) {
  return creerMoteur(couches).rayonCourbure(rayonContact(essieu), essieu.q * 1e6, essieu.entraxe);
}

// ──────────────────────────────── Profils ─────────────────────────────────

/**
 * Profils en profondeur (mêmes extrema que le tableau des sollicitations, pour
 * que courbes et tableau ne puissent pas se contredire) et bassin de surface.
 * À chaque interface, les deux côtés sont échantillonnés : le saut de σT doit
 * se voir sur la courbe.
 */
export function profils(couches, essieu = ESSIEU_REFERENCE,
                        { parCouche = 8, pointsBassin = 25, etendueBassin = 0 } = {}) {
  const moteur = creerMoteur(couches);
  const xs = [0, essieu.entraxe / 2];
  parCouche = Math.max(2, parCouche);
  const lie = moteur.profondeurLiee;
  // La couche semi-infinie est explorée sur une profondeur conventionnelle.
  const dansLeSol = Math.max(1, 0.6 * Math.max(lie, 0.5));
  const echantillons = [];
  moteur.couches.forEach((c, i) => {
    const derniere = i === moteur.couches.length - 1;
    const h = derniere ? dansLeSol : c.h;
    for (let k = 0; k < parCouche; k++) {
      const z = moteur.sommets[i] + (k / (parCouche - 1)) * h;
      echantillons.push({ z, base: !derniere && k === parCouche - 1 });
    }
  });
  const points = [];
  for (const s of echantillons) for (const x of xs) points.push({ x, y: 0, z: s.z, base: s.base });
  const rep = moteur.evaluer(rouesJumelage(essieu), points);
  const profondeur = echantillons.map((s, i) => {
    const e = extrema(xs.map((_, k) => rep[i * xs.length + k]), [SOUS_ROUE, ENTRE_JUMELAGE]);
    return { z: s.z, base: s.base, couche: moteur.localiser(s.z, s.base).couche,
             epsT: e.epsT, sigT: e.sigT, epsZ: e.epsZ, sigZ: e.sigZ };
  });

  const etendue = etendueBassin > 0 ? etendueBassin : Math.max(1.5, 3 * essieu.entraxe);
  pointsBassin = Math.max(2, pointsBassin);
  const decalages = Array.from({ length: pointsBassin }, (_, i) => (etendue * i) / (pointsBassin - 1));
  const d = bassin(couches, essieu, decalages);
  return {
    profondeur,
    bassin: decalages.map((y, i) => ({ y, d: d[i] })),
    profondeurMax: lie + dansLeSol,
  };
}
