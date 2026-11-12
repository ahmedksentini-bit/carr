// Carte 2D des champs dans la structure, comme l'écran « grille » d'Alizé-LCPC : le plan
// vertical de l'axe des roues, la grandeur choisie en couleur continue (palette
// divergente centrée sur 0 pour les grandeurs signées — rouge en traction, bleu en
// compression —, séquentielle pour la déflexion), les interfaces, le jumelage au-dessus,
// des isolignes et les valeurs extrêmes repérées. Le tableau de la grille donne les
// valeurs aux nœuds (interfaces × abscisses caractéristiques) ; la grille entière se
// télécharge en CSV.
//
// Le calcul (src/chaussee/champs.js) s'étale en tranches de quelques millisecondes,
// avec une barre de progression, et se garde en cache par structure : la page ne se
// fige jamais, et revenir à une structure déjà vue est immédiat.
//
// La carte est une chaîne SVG. Dans un navigateur, le dégradé est peint dans un canvas
// et posé dans le SVG en image (lisse, léger, imprimable) ; ailleurs (Node, tests,
// vérification des chapitres), chaque maille est un rectangle de sa teinte moyenne.

import { svg, texte, ligne, COULEURS, fmt, pasJoli, placeur, couper } from "./figures.js";
import { jumelageDeFace, teinteCouche } from "./figures-chaussee.js";
import { GRANDEURS_CHAMPS, ORDRE_GRANDEURS, preparerChamps, cleChamps, lignesGrille, valeurNoeud, csvChamps } from "./chaussee/champs.js";

export { GRANDEURS_CHAMPS, ORDRE_GRANDEURS };

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fd = (x, d = 2) => (Number.isFinite(x) ? Number(x).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
const signe = (x, d) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${fd(Math.abs(x), d)}`;

/** Libellé court d'une grandeur pour un menu : « εT — déformation horizontale, min(x, y) (µdéf) ». */
export const libelleGrandeur = (cle) => {
  const g = GRANDEURS_CHAMPS[cle];
  return `${g.symbole} — ${g.court} (${g.unite})`;
};
/** Graduation : chiffres significatifs, vrai signe moins (le trait d'union disparaît à l'écran). */
const grad = (v) => fmt(v, 3).replace(/^-/, "−");

/** Options d'un menu des grandeurs, groupées comme dans Alizé. */
export function optionsGrandeurs(choix) {
  const groupe = (titre, cles) => `<optgroup label="${esc(titre)}">${cles.map((k) =>
    `<option value="${k}"${k === choix ? " selected" : ""}>${esc(libelleGrandeur(k))}</option>`).join("")}</optgroup>`;
  return groupe("Verticales", ["w", "sigZ", "epsZ"]) + groupe("Horizontales retenues (tableau d'Alizé, critères)", ["epsT", "sigT"])
    + groupe("Par direction", ["epsX", "sigX", "epsY", "sigY"]);
}

// ───────────────────────────── Couleurs ─────────────────────────────────
// ColorBrewer RdBu (traction rouge, compression bleue) et YlGnBu (déflexion).
const DIVERGENTE = ["#67001f", "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#f7f7f7", "#d1e5f0", "#92c5de", "#4393c3", "#2166ac", "#053061"];
const SEQUENTIELLE = ["#ffffd9", "#edf8b1", "#c7e9b4", "#7fcdbb", "#41b6c4", "#1d91c0", "#225ea8", "#253494", "#081d58"];
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => `#${c.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")}`;
function table(palette, n = 256) {
  const stops = palette.map(rgb), lut = new Uint8ClampedArray(3 * n);
  for (let k = 0; k < n; k++) {
    const u = (k / (n - 1)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(u)), t = u - i;
    for (let c = 0; c < 3; c++) lut[3 * k + c] = stops[i][c] + (stops[i + 1][c] - stops[i][c]) * t;
  }
  return lut;
}
const LUT = { divergente: table(DIVERGENTE), sequentielle: table(SEQUENTIELLE) };

/**
 * Échelle de couleurs d'une grandeur : t ∈ [0, 1] d'une valeur, couleur, graduations.
 * Signée : symétrique autour de 0 (blanc), bornée par le plus grand |v|. « racine » :
 * t suit la racine de |v|, ce qui fait voir les faibles valeurs (sol, GNT) sans
 * changer les graduations, qui restent les valeurs vraies.
 */
export function echelleCouleurs(res, cle, echelle = "lineaire") {
  const G = GRANDEURS_CHAMPS[cle], ex = res.extremes[cle];
  const racine = echelle === "racine";
  let lo, hi, versT;
  if (G.signee) {
    const L = Math.max(Math.abs(ex.min.v), Math.abs(ex.max.v)) || 1;
    lo = -L; hi = L;
    versT = (v) => {
      let u = Math.max(-1, Math.min(1, v / L));
      if (racine) u = Math.sign(u) * Math.sqrt(Math.abs(u));
      return (u + 1) / 2;
    };
  } else {
    lo = ex.min.v; hi = ex.max.v;
    const e = hi - lo || 1;
    versT = (v) => {
      const u = Math.max(0, Math.min(1, (v - lo) / e));
      return racine ? Math.sqrt(u) : u;
    };
  }
  const lut = G.signee ? LUT.divergente : LUT.sequentielle;
  const couleur = (v) => { const k = 3 * Math.round(versT(v) * 255); return [lut[k], lut[k + 1], lut[k + 2]]; };
  const pas = pasJoli(hi - lo, G.signee ? 8 : 6);
  const graduations = [];
  for (let v = Math.ceil(lo / pas - 1e-9) * pas; v <= hi + 1e-9 * Math.abs(hi || 1); v += pas) graduations.push(Math.abs(v) < pas * 1e-9 ? 0 : v);
  return { lo, hi, versT, couleur, graduations, pas, lut, signee: G.signee };
}

// ───────────────────────────── Interpolation ────────────────────────────
/** Indice i et fraction t tels que v soit entre tab[i] et tab[i + 1] (tab croissant). */
function encadrer(tab, v) {
  let lo = 0, hi = tab.length - 1;
  if (v <= tab[0]) return [0, 0];
  if (v >= tab[hi]) return [hi - 1, 1];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tab[m] <= v) lo = m; else hi = m; }
  return [lo, (v - tab[lo]) / (tab[lo + 1] - tab[lo] || 1)];
}

/** Dégradé peint dans un canvas (navigateur) : data URL PNG, ou null hors navigateur. */
function raster(res, cle, ech, W, H) {
  if (typeof document === "undefined" || typeof document.createElement !== "function") return null;
  let cv, g;
  try {
    cv = document.createElement("canvas");
    if (!cv || typeof cv.getContext !== "function") return null;
    g = cv.getContext("2d");
  } catch { return null; }
  if (!g || typeof g.createImageData !== "function") return null;
  const f = 2, cw = Math.max(2, Math.round(W * f)), ch = Math.max(2, Math.round(H * f));
  cv.width = cw; cv.height = ch;
  const img = g.createImageData(cw, ch), px = img.data;
  const xs = res.xs, nx = xs.length;
  const ci = new Int32Array(cw), ct = new Float64Array(cw);
  for (let p = 0; p < cw; p++) {
    const [i, t] = encadrer(xs, -res.Xmax + ((p + 0.5) / cw) * 2 * res.Xmax);
    ci[p] = i; ct[p] = t;
  }
  const lut = ech.lut;
  for (let q = 0; q < ch; q++) {
    const z = ((q + 0.5) / ch) * res.zMax;
    const tr = res.tranches.find((t) => z <= t.z1 + 1e-12) ?? res.tranches[res.tranches.length - 1];
    const [j, u] = encadrer(tr.zs, z);
    const tab = tr.valeurs[cle], l0 = j * nx, l1 = (j + 1) * nx;
    for (let p = 0; p < cw; p++) {
      const i = ci[p], t = ct[p];
      const v = (tab[l0 + i] * (1 - t) + tab[l0 + i + 1] * t) * (1 - u) + (tab[l1 + i] * (1 - t) + tab[l1 + i + 1] * t) * u;
      const k = 3 * Math.round(ech.versT(v) * 255), o = 4 * (q * cw + p);
      px[o] = lut[k]; px[o + 1] = lut[k + 1]; px[o + 2] = lut[k + 2]; px[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  try { return cv.toDataURL("image/png"); } catch { return null; }
}

/** Isolignes d'un niveau dans une tranche (carrés marchants), en segments SVG. */
function isoligne(tab, nx, xsPx, zsPx, niveau) {
  let d = "";
  const P = (x, y) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  for (let j = 0; j < zsPx.length - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = tab[j * nx + i], b = tab[j * nx + i + 1], c = tab[(j + 1) * nx + i + 1], e = tab[(j + 1) * nx + i];
      const k = (a > niveau ? 8 : 0) | (b > niveau ? 4 : 0) | (c > niveau ? 2 : 0) | (e > niveau ? 1 : 0);
      if (k === 0 || k === 15) continue;
      const x0 = xsPx[i], x1 = xsPx[i + 1], y0 = zsPx[j], y1 = zsPx[j + 1];
      const lerp = (p, q) => (niveau - p) / (q - p || 1e-300);
      const haut = () => P(x0 + (x1 - x0) * lerp(a, b), y0);
      const droite = () => P(x1, y0 + (y1 - y0) * lerp(b, c));
      const bas = () => P(x0 + (x1 - x0) * lerp(e, c), y1);
      const gauche = () => P(x0, y0 + (y1 - y0) * lerp(a, e));
      const seg = (p, q) => { d += `M${p()}L${q()}`; };
      const centre = (a + b + c + e) / 4 > niveau;
      switch (k) {
        case 1: case 14: seg(gauche, bas); break;
        case 2: case 13: seg(bas, droite); break;
        case 3: case 12: seg(gauche, droite); break;
        case 4: case 11: seg(haut, droite); break;
        case 6: case 9: seg(haut, bas); break;
        case 7: case 8: seg(gauche, haut); break;
        case 5: if (centre) { seg(gauche, haut); seg(bas, droite); } else { seg(gauche, bas); seg(haut, droite); } break;
        case 10: if (centre) { seg(haut, droite); seg(gauche, bas); } else { seg(gauche, haut); seg(bas, droite); } break;
        default: break;
      }
    }
  }
  return d;
}

// ──────────────────────────────── Carte ─────────────────────────────────
/**
 * Le critère sur sa ligne de la grille — base (εT, σT) ou sommet (εz, σz) de la couche
 * vérifiée — : `tableau`, le nœud le plus défavorable des deux verticales du tableau (sous
 * roue, entre jumelage), dont la valeur est celle que vérifie la méthode ; `ligne`, le plus
 * défavorable de toute la ligne (traction la plus forte ; compression pour εz, σz).
 * critere : { couche, base }.
 */
export function noeudCritere(res, cle, critere) {
  const t = res.tranches[critere?.couche];
  if (!t) return null;
  const G = GRANDEURS_CHAMPS[cle], nx = res.xs.length, j = critere.base ? t.zs.length - 1 : 0, tab = t.valeurs[cle];
  const maxi = !G.signee || cle === "epsZ" || cle === "sigZ";
  const d = res.entraxe / 2;
  let tableau = null, ligne = null;
  res.xs.forEach((X, i) => {
    const v = tab[j * nx + i], n = { v, X, z: t.zs[j], base: t.bases[j], couche: t.couche };
    const pire = (m) => !m || (maxi ? v > m.v : v < m.v) || (v === m.v && X >= 0 && m.X < 0);
    if (pire(ligne)) ligne = n;
    if ((Math.abs(X) < 1e-9 || Math.abs(Math.abs(X) - d) < 1e-9) && pire(tableau)) tableau = n;
  });
  return { tableau: tableau ?? ligne, ligne };
}

/** Phrase sur le critère : sa valeur au tableau et, si la grille trouve pire sur sa ligne, où et de combien. */
export function texteCritere(res, cle, critere) {
  const nc = critere ? noeudCritere(res, cle, critere) : null;
  if (!nc) return "";
  const G = GRANDEURS_CHAMPS[cle], val = (v) => `${G.signee ? signe(v, G.decimales) : fd(v, G.decimales)} ${G.unite}`;
  const ou = (X) => (Math.abs(X) < 1e-9 ? "entre jumelage" : Math.abs(Math.abs(X) - res.entraxe / 2) < 1e-9 ? "sous roue" : `à x = ${fd(Math.abs(X), 3)} m`);
  const ecart = (nc.ligne.v - nc.tableau.v) / Math.abs(nc.tableau.v || 1);
  return `Repère « critère » : le critère dimensionnant${critere.libelle ? ` (${esc(critere.libelle)})` : ""}, ${val(nc.tableau.v)} ${ou(nc.tableau.X)} — la valeur du tableau.`
    + (Math.abs(ecart) >= 0.005 ? ` Sur la même ligne, la grille trouve ${val(nc.ligne.v)} ${ou(nc.ligne.X)}, ${fd(100 * Math.abs(ecart), 1)} % au-delà, hors des deux verticales du tableau.` : "");
}

/**
 * Carte d'une grandeur (sortie de champsStructure ou du calcul par tranches).
 * options : largeur, isolignes, echelle ("lineaire" | "racine"), raster (false : mailles),
 * critere ({ couche, base, libelle } : repère du critère dimensionnant sur sa ligne).
 */
export function carteChamps(res, cle = "epsT", { largeur = 600, isolignes = true, echelle = "lineaire", raster: peindre = true, critere = null } = {}) {
  const G = GRANDEURS_CHAMPS[cle];
  if (!G) throw new Error(`grandeur inconnue : ${cle}`);
  const ech = echelleCouleurs(res, cle, echelle);
  const mg = 48, md = 126, Wp = largeur - mg - md;
  const sx = Wp / (2 * res.Xmax);
  const Hp = Math.max(230, Math.min(420, res.zMax * sx));
  const sz = Hp / res.zMax, exag = sz / sx;
  const lPneu = 2 * res.a * sx, hPneu = Math.max(36, Math.min(58, 0.62 * lPneu));
  const y0 = 30 + hPneu + 14;
  const X = (x) => mg + (x + res.Xmax) * sx, Z = (z) => y0 + z * sz;
  const yBas = y0 + Hp;
  const H = yBas + 104;
  const nx = res.xs.length, xsPx = res.xs.map(X);
  const image = peindre ? raster(res, cle, ech, Wp, Hp) : null;
  const titre = `${G.symbole} — ${G.court} (${G.unite})`;

  return svg({ largeur, hauteur: H, titre: `Carte des champs : ${titre}`, contenu: (id) => {
    let s = `<defs><clipPath id="${id}-cadre"><rect x="${mg}" y="${y0}" width="${Wp.toFixed(1)}" height="${Hp.toFixed(1)}"/></clipPath>
      <linearGradient id="${id}-barre" x1="0" x2="1" y1="0" y2="0">${Array.from({ length: 33 }, (_, k) => {
        const t = k / 32, c = [0, 1, 2].map((m) => ech.lut[3 * Math.round(t * 255) + m]);
        return `<stop offset="${t.toFixed(4)}" stop-color="${hex(c)}"/>`;
      }).join("")}</linearGradient></defs>`;
    s += texte(mg, 16, titre, `style="font-size:12.5px;font-weight:800"`);
    if (exag > 1.05) s += texte(mg + Wp, 16, `profondeurs × ${fmt(exag, 2)}`, `text-anchor="end" class="pt"`);
    // Le champ : image peinte, ou mailles de teinte moyenne.
    if (image) s += `<image href="${image}" x="${mg}" y="${y0}" width="${Wp.toFixed(1)}" height="${Hp.toFixed(1)}" preserveAspectRatio="none"/>`;
    else {
      s += `<g shape-rendering="crispEdges">`;
      for (const t of res.tranches) {
        const tab = t.valeurs[cle], zp = t.zs.map(Z);
        for (let j = 0; j < t.zs.length - 1; j++) for (let i = 0; i < nx - 1; i++) {
          const v = (tab[j * nx + i] + tab[j * nx + i + 1] + tab[(j + 1) * nx + i] + tab[(j + 1) * nx + i + 1]) / 4;
          s += `<rect x="${xsPx[i].toFixed(1)}" y="${zp[j].toFixed(1)}" width="${(xsPx[i + 1] - xsPx[i] + 0.4).toFixed(1)}" height="${(zp[j + 1] - zp[j] + 0.4).toFixed(1)}" fill="${hex(ech.couleur(v))}"/>`;
        }
      }
      s += `</g>`;
    }
    // Isolignes aux graduations de l'échelle ; la ligne 0 (axe neutre de la traction) en tirets.
    if (isolignes) {
      let iso = "", zero = "";
      for (const t of res.tranches) {
        const zp = t.zs.map(Z), tab = t.valeurs[cle];
        for (const v of ech.graduations) {
          if (v <= ech.lo + 1e-12 || v >= ech.hi - 1e-12) continue;
          const d = isoligne(tab, nx, xsPx, zp, v);
          if (v === 0 && ech.signee) zero += d; else iso += d;
        }
      }
      s += `<g clip-path="url(#${id}-cadre)" fill="none" stroke-linecap="round">`;
      if (iso) s += `<path d="${iso}" stroke="#fff" stroke-width="2" opacity=".35"/><path d="${iso}" stroke="#1e293b" stroke-width=".8" opacity=".6"/>`;
      if (zero) s += `<path d="${zero}" stroke="#fff" stroke-width="3" opacity=".5"/><path d="${zero}" stroke="#0f172a" stroke-width="1.6" stroke-dasharray="6 3"/>`;
      s += `</g>`;
    }
    // Verticales caractéristiques du tableau : entre jumelage et sous roue.
    for (const x of [0, -res.entraxe / 2, res.entraxe / 2])
      s += ligne(X(x), y0, X(x), yBas, "#fff", 1, `stroke-dasharray="1 4" opacity=".7"`);
    // Interfaces : collée en trait fin, glissante en tirets rouges, semi-collée en pointillés.
    const P = placeur({ x: mg + 2, y: y0 + 2, w: Wp - 4, h: Hp - 4 });
    res.couches.slice(0, -1).forEach((c, i) => {
      const y = Z(res.sommets[i + 1]), itf = c.interface ?? "collee";
      if (itf === "collee") s += ligne(mg, y, mg + Wp, y, "#0f172a", 1, `opacity=".55"`);
      else {
        s += ligne(mg, y, mg + Wp, y, "#fff", 3.4, `opacity=".6"`);
        s += ligne(mg, y, mg + Wp, y, COULEURS.rouge, 2, `stroke-dasharray="${itf === "glissante" ? "7 4" : "2 3"}"`);
        s += texte(mg + 6, y - 4, `interface ${itf === "glissante" ? "glissante" : "semi-collée"}`, `class="halo" style="font-size:10.5px;font-weight:800;fill:${COULEURS.rouge}"`);
      }
      P.segment(mg, y, mg + Wp, y, 3);
    });
    s += `<rect x="${mg}" y="${y0}" width="${Wp.toFixed(1)}" height="${Hp.toFixed(1)}" fill="none" stroke="#475569" stroke-width="1"/>`;
    s += ligne(mg, y0, mg + Wp, y0, "#0f172a", 1.6);
    // Jumelage au-dessus de la surface, à l'échelle des abscisses.
    s += jumelageDeFace([X(-res.entraxe / 2), X(res.entraxe / 2)], y0, lPneu, id, { h: hPneu });
    // Valeurs extrêmes : un repère (et son symétrique), une étiquette.
    const ex = res.extremes[cle], L = Math.max(Math.abs(ech.lo), Math.abs(ech.hi));
    const marques = [];
    if (G.signee) {
      if (ex.min.v < -0.03 * L) marques.push({ n: ex.min, texte: `traction max. ${signe(ex.min.v, G.decimales)}`, couleur: "#7f1d1d" });
      else marques.push({ n: ex.min, texte: `min. ${signe(ex.min.v, G.decimales)}`, couleur: "#0f172a" });
      if (ex.max.v > 0.03 * L) marques.push({ n: ex.max, texte: `compression max. ${signe(ex.max.v, G.decimales)}`, couleur: "#0c4a6e" });
      else marques.push({ n: ex.max, texte: `max. ${signe(ex.max.v, G.decimales)}`, couleur: "#0f172a" });
    } else marques.push({ n: ex.max, texte: `${G.symbole} max. ${fd(ex.max.v, G.decimales)}`, couleur: "#0f172a" });
    // Le critère dimensionnant, sur sa ligne : confondu avec un extrême, il le dit ; sinon il a son losange.
    const nc = critere ? noeudCritere(res, cle, critere)?.tableau : null;
    if (nc) {
      const meme = marques.find((m) => Math.abs(Math.abs(m.n.X) - Math.abs(nc.X)) < 1e-9 && Math.abs(m.n.z - nc.z) < 1e-9 && m.n.base === nc.base);
      if (meme) { meme.texte += " · critère"; meme.priorite = 1; }
      else marques.push({ n: nc, texte: `critère${critere.libelle ? ` (${critere.libelle})` : ""} ${G.signee ? signe(nc.v, G.decimales) : fd(nc.v, G.decimales)}`,
        couleur: "#92400e", losange: true, priorite: 1 });
    }
    for (const m of marques) {
      const xs = Math.abs(m.n.X) > 1e-9 ? [m.n.X, -m.n.X] : [m.n.X];
      for (const x of xs) {
        const cx = X(x), cy = Z(m.n.z);
        s += m.losange
          ? `<path d="M${cx.toFixed(1)} ${(cy - 6).toFixed(1)}l6 6-6 6-6-6z" fill="#fde68a" stroke="${m.couleur}" stroke-width="1.8"/>`
          : `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="#fff" stroke="${m.couleur}" stroke-width="2"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="1.6" fill="${m.couleur}"/>`;
        P.boite({ x: cx - 7, y: cy - 7, w: 14, h: 14 }, 6);
      }
    }
    for (const m of marques) {
      const cx = X(Math.abs(m.n.X)), cy = Z(m.n.z);
      const lignes = [m.texte];
      P.texte([
        { x: cx + 10, y: cy - 7, ancre: "start", lignes }, { x: cx + 10, y: cy + 15, ancre: "start", lignes },
        { x: cx - 10, y: cy - 7, ancre: "end", lignes }, { x: cx - 10, y: cy + 15, ancre: "end", lignes },
        { x: cx, y: cy + 21, ancre: "middle", lignes }, { x: cx, y: cy - 11, ancre: "middle", lignes },
        { x: cx + 10, y: cy + 30, ancre: "start", lignes }, { x: cx - 10, y: cy - 22, ancre: "end", lignes },
      ], `class="halo" style="font-size:11px;font-weight:800;fill:${m.couleur}"`, { taille: 11, priorite: m.priorite ?? 0 });
    }
    s += P.rendre();
    // Axes.
    const pz = pasJoli(res.zMax, 5);
    for (let z = 0; z <= res.zMax + 1e-9; z += pz) {
      s += ligne(mg - 4, Z(z), mg, Z(z), "#475569", 1);
      s += texte(mg - 7, Z(z) + 4, grad(z), `text-anchor="end" class="pt"`);
    }
    s += texte(14, y0 + Hp / 2, "z (m)", `text-anchor="middle" transform="rotate(-90 14 ${(y0 + Hp / 2).toFixed(1)})" class="pt" style="font-weight:700"`);
    const px = pasJoli(2 * res.Xmax, 6);
    for (let x = Math.ceil(-res.Xmax / px) * px; x <= res.Xmax + 1e-9; x += px) {
      const xx = Math.abs(x) < 1e-9 ? 0 : x;
      s += ligne(X(xx), yBas, X(xx), yBas + 4, "#475569", 1);
      s += texte(X(xx), yBas + 15, grad(xx), `text-anchor="middle" class="pt"`);
    }
    s += texte(mg + Wp / 2, yBas + 30, `x (m), transversal — 0 : entre jumelage · roues en ±${fmt(res.entraxe / 2, 3)} m`, `text-anchor="middle" class="pt" style="font-weight:700"`);
    // Couches, dans la marge de droite : pastille de teinte, nom (sur deux lignes au plus),
    // épaisseur et module. Si la hauteur de la carte ne les tient pas toutes, les couches
    // minces perdent d'abord leur ligne de détail, puis leur nom est abrégé.
    const abreger = (l) => (l.length > 1 ? [`${l[0].replace(/[\s,·(—-]+$/, "")}…`] : l);
    const etiquettes = res.tranches.map((t) => {
      const c = res.couches[t.couche], fin = Number.isFinite(c.h);
      const yh = Z(t.z0), yb = Z(t.z1);
      let nom = couper(String(t.nom), md - 26, 10.5);
      if (nom.length > 2) nom = [nom[0], `${nom[1].replace(/[\s,·(—-]+$/, "")}…`];
      return { yc: (yh + yb) / 2, epaisseur: yb - yh, nom, detail: `${fin ? `${grad(c.h * 100)} cm · ` : ""}E ${fmt(c.E, 4)} MPa`, teinte: teinteCouche(c).fond };
    });
    const hauteurEt = (e) => 12 * (e.nom.length + (e.detail ? 1 : 0));
    const total = () => etiquettes.reduce((s, e) => s + hauteurEt(e) + 3, 0);
    for (const e of [...etiquettes].sort((a, b) => a.epaisseur - b.epaisseur)) { if (total() <= Hp + 12) break; if (e.epaisseur < 30) e.detail = null; }
    for (const e of [...etiquettes].sort((a, b) => a.epaisseur - b.epaisseur)) { if (total() <= Hp + 12) break; e.nom = abreger(e.nom); }
    for (const e of etiquettes) e.lignes = [...e.nom.map((l) => [l, true]), ...(e.detail ? [[e.detail, false]] : [])];
    // Étiquettes empilées sans chevauchement, ramenées dans la hauteur de la carte.
    let bas = -Infinity;
    for (const e of etiquettes) { const h = 12 * e.lignes.length; e.y = Math.max(e.yc - h / 2 + 9, bas + 3 + 9); bas = e.y - 9 + h; }
    const excedent = bas - (yBas + 6);
    if (excedent > 0) {
      let haut = Infinity;
      for (const e of [...etiquettes].reverse()) { const h = 12 * e.lignes.length; e.y = Math.min(e.y - excedent, haut - 3 - h + 9); haut = e.y - 9; }
    }
    for (const e of etiquettes) {
      const xt = mg + Wp + 22;
      s += `<rect x="${mg + Wp + 8}" y="${(e.y - 8).toFixed(1)}" width="9" height="9" rx="1.5" fill="${e.teinte}" stroke="#475569" stroke-width=".6"/>`;
      if (Math.abs(e.y - 4 - e.yc) > 4) s += ligne(mg + Wp + 1, e.yc, mg + Wp + 7, e.y - 4, "#94a3b8", 0.8);
      e.lignes.forEach(([l, gras], k) => { s += texte(xt, e.y + 12 * k, l, gras ? `style="font-size:10.5px;font-weight:800"` : `class="pt" style="font-size:10px"`); });
    }
    // Barre de couleurs, graduée en valeurs vraies.
    const yb = yBas + 46, hb = 11;
    s += `<rect x="${mg}" y="${yb}" width="${Wp.toFixed(1)}" height="${hb}" fill="url(#${id}-barre)" stroke="#64748b" stroke-width=".6"/>`;
    let dernier = -Infinity;
    for (const v of ech.graduations) {
      const x = mg + ech.versT(v) * Wp;
      s += ligne(x, yb + hb, x, yb + hb + 4, "#475569", 1);
      const lib = grad(v), demi = 3.2 * lib.length + 3;
      if (x - demi > dernier + 4 || v === 0) { s += texte(x, yb + hb + 15, lib, `text-anchor="middle" class="pt"`); dernier = x + demi; }
    }
    const sens = G.signee ? "traction < 0 (rouge), compression > 0 (bleu)" : "positive vers le bas";
    s += texte(mg, yb + hb + 31, `${G.symbole} (${G.unite}) — ${sens}${echelle === "racine" ? " · teintes contrastées (racine)" : ""}${isolignes ? ` · isolignes tous les ${fmt(ech.pas, 3)}` : ""}`,
      `style="font-size:11px;font-weight:700;fill:${COULEURS.trait}"`);
    return s;
  } });
}

// ─────────────────────────────── Grille ─────────────────────────────────
/** Tableau de la grille : interfaces × abscisses caractéristiques, pour une grandeur. */
export function tableauGrille(res, cle = "epsT") {
  const G = GRANDEURS_CHAMPS[cle];
  const lignes = lignesGrille(res);
  const vals = lignes.map((l) => res.colonnes.map((c) => valeurNoeud(res, cle, c.X, l.z, l.base)));
  const tous = vals.flat().filter(Number.isFinite);
  const vmin = Math.min(...tous), vmax = Math.max(...tous);
  const cellule = (v) => `<td class="num${v === vmin || v === vmax ? " extreme" : ""}">${G.signee ? signe(v, G.decimales) : fd(v, G.decimales)}</td>`;
  return `<table class="resultats champs-tableau"><thead><tr><th>Cote (m)</th>${res.colonnes.map((c) =>
      `<th class="num">${esc(c.nom)}<small>x = ${fd(c.X, 3)} m</small></th>`).join("")}</tr></thead><tbody>
    ${lignes.map((l, k) => `<tr><td>${fd(l.z, 3)} ${esc(l.libelle)}</td>${vals[k].map(cellule).join("")}</tr>`).join("")}</tbody></table>`;
}

/** Durée d'un calcul, lisible : « 85 ms », « 1,2 s » ; vide si elle n'a pas été mesurée. */
export const texteDuree = (ms) => (!(ms >= 0.5) ? "" : ms < 1000 ? `${Math.round(ms)} ms` : `${fd(ms / 1000, 1)} s`);

/** Légende d'une carte : ce qu'elle montre, la grille, le coût du calcul. */
export function legendeCarte(res, cle) {
  const G = GRANDEURS_CHAMPS[cle];
  const lignes = res.tranches.reduce((s, t) => s + t.zs.length, 0);
  const cout = texteDuree(res.duree) ? ` calculés en ${texteDuree(res.duree)}` : "";
  return `${esc(G.symbole)} — ${esc(G.nom)}, dans le plan vertical de l'axe des roues. Grille de ${res.xs.length} abscisses × ${lignes} cotes
    (${res.noeuds.toLocaleString("fr-FR")} nœuds, resserrés sous les roues et aux interfaces, chaque interface calculée des deux côtés) ;
    ${res.points.toLocaleString("fr-FR")} points de Burmister${res.symetrie ? " (une moitié, l'autre par symétrie)" : ""}${cout}.
    Signes d'Alizé : compression positive, traction négative.`;
}

/** Télécharge la grille entière en CSV (séparateur « ; », virgule décimale, UTF-8). */
export function telechargerCsv(res, nom = "champs-structure.csv") {
  if (typeof Blob !== "function" || typeof URL?.createObjectURL !== "function") return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff) + csvChamps(res)], { type: "text/csv;charset=utf-8" }));
  a.download = nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ─────────────────────── Calcul étalé, avec cache ───────────────────────
const CACHE = new Map(), TAILLE_CACHE = 16;
let tache = null;
const maintenant = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Champs déjà calculés pour cette structure, ou null. */
export function champsEnCache(couches, essieu) {
  const cle = cleChamps(couches, essieu), r = CACHE.get(cle);
  if (r) { CACHE.delete(cle); CACHE.set(cle, r); }
  return r ?? null;
}

function demarrer(cle, couches, essieu) {
  const t = { cle, annulee: false, abonnes: new Set(), k: 0, total: 1, points: 0 };
  let prep;
  const echec = (e) => { if (tache === t) tache = null; for (const a of t.abonnes) a.erreur?.(e); };
  try { prep = preparerChamps(couches, essieu); } catch (e) { setTimeout(() => echec(e), 0); return t; }
  t.total = prep.total; t.points = prep.points;
  const t0 = maintenant();
  let calcul = 0;
  const pas = () => {
    if (t.annulee) return;
    const debut = maintenant();
    try {
      do prep.etape(t.k++); while (t.k < t.total && maintenant() - debut < 12);
    } catch (e) { echec(e); return; }
    calcul += maintenant() - debut;
    for (const a of t.abonnes) a.progres?.(t.k, t.total, t.points);
    if (t.k < t.total) { setTimeout(pas, 0); return; }
    let res;
    try { res = prep.fini(); } catch (e) { echec(e); return; }
    res.duree = calcul; res.dureeTotale = maintenant() - t0;
    CACHE.set(cle, res);
    while (CACHE.size > TAILLE_CACHE) CACHE.delete(CACHE.keys().next().value);
    if (tache === t) tache = null;
    for (const a of t.abonnes) a.fin?.(res);
  };
  setTimeout(pas, 0);
  return t;
}

const abonnements = new Map();
/**
 * Demande les champs d'une structure : immédiatement s'ils sont en cache (fin appelé
 * avant le retour), sinon par tranches, avec progres(k, total, points). Un nouvel appel
 * sur la même place (`place`) remplace le précédent ; un calcul que plus personne
 * n'attend s'arrête. Renvoie true si le résultat était en cache.
 */
export function obtenirChamps(couches, essieu, { place = "defaut", progres = null, fin, erreur = null }) {
  // L'ancien abonné de cette place se retire ; le calcul en cours continue s'il sert encore.
  abonnements.get(place)?.();
  abonnements.delete(place);
  const abandonner = () => { if (tache && !tache.abonnes.size) { tache.annulee = true; tache = null; } };
  let cle;
  try { cle = cleChamps(couches, essieu); } catch (e) { abandonner(); erreur?.(e); return false; }
  const r = CACHE.get(cle);
  if (r) { CACHE.delete(cle); CACHE.set(cle, r); abandonner(); fin(r); return true; }
  // Une seule structure à la fois : la dernière demandée.
  if (tache && tache.cle !== cle) { tache.annulee = true; tache = null; }
  if (!tache) tache = demarrer(cle, couches, essieu);
  const t = tache, abonne = { progres, fin, erreur };
  t.abonnes.add(abonne);
  progres?.(t.k, t.total, t.points);
  abonnements.set(place, () => { t.abonnes.delete(abonne); });
  return false;
}

/** Barre de progression du calcul (HTML). */
export function barreProgres(k, total, points) {
  const p = Math.round((100 * k) / Math.max(1, total));
  return `<span class="champs-progres" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"><span style="width:${p}%"></span></span>
    <small>Calcul des champs : ${p} % de ${points.toLocaleString("fr-FR")} points de Burmister</small>`;
}

// ─────────────────────── Bloc du bureau de calcul ───────────────────────
const memoire = new Map();

/** Carte en image fixe et grille de la note de calcul, pour la grandeur `cle`. */
export function noteChampsHtml(res, cle, { motif = "", critere = null } = {}) {
  return `<figure class="champs-figure">${carteChamps(res, cle, { largeur: 680, critere })}
      <figcaption>${motif ? `<strong>${esc(motif)}</strong> ` : ""}${texteCritere(res, cle, critere)} ${legendeCarte(res, cle)}</figcaption></figure>
    <p class="method-note">Grille des valeurs de ${esc(GRANDEURS_CHAMPS[cle].symbole)} (${esc(GRANDEURS_CHAMPS[cle].unite)}) aux nœuds caractéristiques ;
      en gras, les extrêmes du tableau.</p>${tableauGrille(res, cle)}`;
}

/**
 * Monte le bloc « Champs dans la structure » dans `zone` et le calcule de lui-même :
 * desc = { couches, essieu, grandeur (celle du critère dimensionnant), motif, module }.
 * `note` : élément de la note de calcul où poser la carte fixe de desc.grandeur.
 */
export function monterChamps(zone, desc, { note = null } = {}) {
  if (!zone || !desc?.couches?.length) return;
  const id = desc.module ?? "bureau";
  const defaut = GRANDEURS_CHAMPS[desc.grandeur] ? desc.grandeur : "epsT";
  let m = memoire.get(id);
  // Le choix de l'utilisateur tient tant que le critère dimensionnant ne change pas.
  if (!m || m.defaut !== defaut) m = { defaut, grandeur: defaut, iso: true, echelle: "lineaire", svg: m?.svg ?? "" };
  memoire.set(id, m);
  zone.innerHTML = `<div class="champs-entete"><h4>Champs dans la structure</h4>
      <p class="method-note">Plan vertical de l'axe des roues, comme la grille d'Alizé : la grandeur choisie en couleur, les interfaces,
        le jumelage au-dessus. Rouge : traction ; bleu : compression. Calculé de lui-même après le calcul principal.</p></div>
    <div class="champs-commandes">
      <label>Grandeur <select data-champs="grandeur">${optionsGrandeurs(m.grandeur)}</select></label>
      <label>Teintes <select data-champs="echelle"><option value="lineaire"${m.echelle === "lineaire" ? " selected" : ""}>linéaires</option>
        <option value="racine"${m.echelle === "racine" ? " selected" : ""}>contrastées (faibles valeurs)</option></select></label>
      <label><input type="checkbox" data-champs="iso"${m.iso ? " checked" : ""}> isolignes</label>
      <button type="button" class="ghost" data-champs="csv" disabled>Grille complète (CSV)</button>
    </div>
    <div class="champs-etat" data-champs="etat"></div>
    <div class="champs-carte" data-champs="carte">${m.svg}</div>
    <p class="champs-legende" data-champs="legende"></p>
    <details class="champs-grille" data-cle="champs-grille-${esc(id)}"><summary>Grille des valeurs aux nœuds (interfaces × abscisses)</summary><div data-champs="grille"></div></details>`;
  const q = (k) => zone.querySelector?.(`[data-champs="${k}"]`) ?? null;
  const carte = q("carte"), etat = q("etat");
  if (carte && m.svg) carte.classList?.add("recalcul");
  if (note) note.innerHTML = `<p class="method-note">Carte des champs en cours de calcul…</p>`;
  let res = null;
  const dessiner = () => {
    if (!res) return;
    try {
      m.svg = carteChamps(res, m.grandeur, { isolignes: m.iso, echelle: m.echelle, critere: m.grandeur === defaut ? desc.critere : null });
      if (carte) { carte.innerHTML = m.svg; carte.classList?.remove("recalcul"); }
      const lg = q("legende"), gr = q("grille");
      if (lg) lg.innerHTML = `${m.grandeur === defaut ? `${texteCritere(res, m.grandeur, desc.critere)} ` : ""}${legendeCarte(res, m.grandeur)}`;
      if (gr) gr.innerHTML = tableauGrille(res, m.grandeur);
    } catch (e) { if (etat) etat.innerHTML = `<p class="final-result bureau-verdict ko">Carte impossible : ${esc(e.message)}</p>`; }
  };
  q("grandeur")?.addEventListener("change", (e) => { m.grandeur = e.target.value; dessiner(); });
  q("echelle")?.addEventListener("change", (e) => { m.echelle = e.target.value; dessiner(); });
  q("iso")?.addEventListener("change", (e) => { m.iso = !!e.target.checked; dessiner(); });
  q("csv")?.addEventListener("click", () => { if (res) telechargerCsv(res, `champs-${id}.csv`); });
  obtenirChamps(desc.couches, desc.essieu, {
    place: `bureau-${id}`,
    progres: (k, total, points) => { if (etat) etat.innerHTML = barreProgres(k, total, points); },
    fin: (r) => {
      res = r;
      if (etat) etat.innerHTML = "";
      const b = q("csv"); if (b) b.disabled = false;
      dessiner();
      if (note) {
        try { note.innerHTML = noteChampsHtml(r, defaut, { motif: desc.motif, critere: desc.critere }); }
        catch (e) { note.innerHTML = `<p class="method-note">Carte des champs indisponible : ${esc(e.message)}</p>`; }
      }
    },
    erreur: (e) => {
      if (etat) etat.innerHTML = `<p class="final-result bureau-verdict ko">Champs incalculables : ${esc(e.message)}</p>`;
      if (carte) { carte.innerHTML = ""; m.svg = ""; }
      if (note) note.innerHTML = `<p class="method-note">Champs incalculables : ${esc(e.message)}</p>`;
    },
  });
}
