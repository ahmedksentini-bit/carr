// Figures propres aux chaussées : coupe d'une structure sous le jumelage,
// profils de sollicitations en profondeur avec les paliers admissibles, bassin
// de déflexion. Comme figures.js, tout sort en chaîne SVG : cours, exerciseur,
// bureau de calcul et polycopié partagent les mêmes dessins.

import { svg, texte, ligne, graphe, couper, COULEURS, fmt } from "./figures.js";

/** Teinte et motif d'une couche selon son matériau. */
export function teinteCouche(c) {
  const m = String(c.materiau ?? c.nom ?? "").toUpperCase();
  const famille = c.famille ?? familleDevinee(m, c);
  if (famille !== c.famille) return teinteCouche({ ...c, famille });
  if (c.famille === "bitumineux") {
    if (/^BB|ENROB|BETON BITUM|ES\b|ENDUIT|BBM|BBTM|BBDR/.test(m)) return { fond: "#3f3f46", texte: "#fff", motif: null };
    if (/^EME/.test(m)) return { fond: "#292524", texte: "#fff", motif: null };
    return { fond: "#57534e", texte: "#fff", motif: null };   // graves-bitume
  }
  if (c.famille === "hydraulique") {
    if (/^BC|BETON|BAC|BCR/.test(m)) return { fond: "#cbd5e1", texte: COULEURS.encre, motif: "beton" };
    return { fond: "#a8a29e", texte: COULEURS.encre, motif: "craie" };   // GC, SC, SL, GL…
  }
  if (c.famille === "sol" && !/^PF|^S\d|^SOL|PLATE|SUPPORT|ARASE/.test(m) && Number.isFinite(c.h))
    return { fond: "#e3d3a0", texte: COULEURS.encre, motif: "grave" };   // GNT, graveleux
  return { fond: "#dccab0", texte: COULEURS.encre, motif: "argile" };    // sol support
}

/** Famille d'une couche décrite par son seul nom (module de calcul libre). */
function familleDevinee(m, c) {
  if (/\b(BB\w*|GB\d?|EME\d?|ENROB\w*|ENDUIT|ES|BITUM\w*|GRAVE[- ]BITUME|SABLE[- ]BITUME|SB)\b/.test(m)) return "bitumineux";
  if (/\b(GC\w*|SC\w*|SL\w*|BC\d?|BAC|BCR|GL\w*|BETON|CIMENT|TRAIT[ÉE]\w*|MTLH|GRH)\b/.test(m)) return "hydraulique";
  if (!Number.isFinite(c.h)) return "sol-support";
  return "sol";
}

const fmtE = (E) => (E >= 1000 ? `${fmt(E, 3)} MPa` : `${fmt(E, 3)} MPa`);

/**
 * Jumelage vu de face, dans le plan d'une coupe transversale : deux pneus debout
 * (largeur l, celle du disque de contact ; hauteur h, environ 1,7 l), les rainures
 * de leur bande de roulement, le moyeu qui les relie, et sous chacun la pression
 * de contact (bandeau rouge et flèches). xs : axes des roues ; yc : surface de la
 * chaussée ; id : préfixe des marqueurs de la figure (flèche « fl »).
 * Un pneu reste DEBOUT quelle que soit l'échelle : quand la hauteur disponible ne
 * suffit pas (figure très dilatée en largeur, comme la carte des champs), le corps
 * du pneu est rétréci à h / 1,45 ; la pression de contact garde, elle, la largeur
 * exacte du disque (l), qui est la donnée du calcul.
 */
export function jumelageDeFace(xs, yc, l, id, { h = Math.max(40, Math.min(120, 1.7 * l)), fleches = true } = {}) {
  const lb = Math.min(l, h / 1.45), yb = yc - 7, yh = yb - h, rx = Math.min(lb * 0.3, 14);
  let s = "";
  if (xs.length > 1) {   // le moyeu, vu entre les deux pneus
    const x0 = Math.min(...xs), x1 = Math.max(...xs), ym = yh + h * 0.5;
    s += `<rect x="${x0.toFixed(1)}" y="${(ym - 6).toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="12" rx="3" fill="#6b7280"/>`;
  }
  for (const x of xs) {
    s += `<rect x="${(x - lb / 2).toFixed(1)}" y="${yh.toFixed(1)}" width="${lb.toFixed(1)}" height="${h.toFixed(1)}" rx="${rx.toFixed(1)}" fill="#1f2937"/>`;
    for (const f of [-0.22, 0, 0.22])
      s += `<path d="M${(x + f * lb).toFixed(1)} ${(yh + 6).toFixed(1)}V${(yb - 6).toFixed(1)}" stroke="#4b5563" stroke-width="${Math.max(1.2, lb / 30).toFixed(1)}"/>`;
    s += `<rect x="${(x - l / 2).toFixed(1)}" y="${(yc - 6).toFixed(1)}" width="${l.toFixed(1)}" height="6" fill="${COULEURS.effort}" opacity=".85"/>`;
    if (fleches) for (let k = -2; k <= 2; k++) {
      const xx = x + (k * l) / 5;
      s += ligne(xx, yc - 9, xx, yc - 1, COULEURS.effort, 1.4, `marker-end="url(#${id}-fl)"`);
    }
  }
  return s;
}

/**
 * Coupe d'une structure : couches à l'échelle (hauteur minimale pour les
 * couches minces), sol support en bas, jumelage et pression de contact en
 * haut, nature des interfaces (collée en trait plein, glissante en tirets
 * rouges, semi-collée en pointillés).
 * options : essieu, largeur, hauteur, marques [{ z, base, libelle, couleur }].
 */
export function coupeChaussee(couches, { essieu = null, largeur = 560, hauteur = 0, marques = [], titre = "Coupe de la structure" } = {}) {
  const n = couches.length;
  const finies = couches.slice(0, n - 1);
  const hTot = finies.reduce((s, c) => s + c.h, 0);
  const gx = 18, dx = 18, xg = gx, xd = largeur - dx, W = xd - xg;
  // Jumelage vu de face, à une échelle commune à l'entraxe et aux pneus.
  let jum = null;
  if (essieu) {
    const e = essieu.entraxe, a = essieu.a ?? Math.sqrt((essieu.P * 1e3) / (Math.PI * essieu.q * 1e6));
    const ech = Math.min(W * 0.32 / (e + 2 * a), 400), l = 2 * a * ech;
    jum = { e, a, ech, l, h: Math.max(48, Math.min(110, 1.7 * l)) };
  }
  const yRoue = jum ? jum.h + 36 : 14;
  const hMinPx = 22;
  const echelle = hTot > 0 ? Math.max(260, hTot * 520) / Math.max(hTot, 0.05) : 0;
  const hauteurs = finies.map((c) => Math.max(hMinPx, c.h * echelle));
  const hSol = 54;
  const hTotPx = hauteurs.reduce((s, h) => s + h, 0) + hSol;
  const H = hauteur || yRoue + hTotPx + 26;
  return svg({ largeur, hauteur: H, titre, contenu: (id) => {
    let s = "";
    // Couches.
    let y = yRoue;
    const tops = [];
    couches.forEach((c, i) => {
      const h = i < n - 1 ? hauteurs[i] : hSol;
      tops.push(y);
      const t = teinteCouche(c);
      s += `<rect x="${xg}" y="${y.toFixed(1)}" width="${W}" height="${h.toFixed(1)}" fill="${t.fond}"/>`;
      if (t.motif) s += `<rect x="${xg}" y="${y.toFixed(1)}" width="${W}" height="${h.toFixed(1)}" fill="url(#${id}-${t.motif})"/>`;
      const nom = c.materiau && c.nom && !String(c.nom).includes(c.materiau) ? `${c.nom} (${c.materiau})` : (c.nom ?? c.materiau ?? `couche ${i + 1}`);
      const ep = i < n - 1 ? `${fmt(c.h * 100, 3)} cm` : "semi-infini";
      const gauche = couper(nom, W * 0.55, 11)[0];
      const droite = `${ep} · E = ${fmtE(c.E)} · ν = ${fmt(c.nu, 2)}`;
      const ty = y + Math.min(h / 2 + 4, 17);
      s += texte(xg + 8, ty, gauche, `style="font-size:11px;font-weight:800;fill:${t.texte}"`);
      s += texte(xd - 8, ty, droite, `text-anchor="end" style="font-size:11px;font-weight:600;fill:${t.texte}"`);
      y += h;
    });
    // Bord inférieur « ouvert » du sol support.
    s += `<path d="M${xg} ${y.toFixed(1)}l12 -5l12 5l12 -5l12 5" stroke="${COULEURS.discret}" fill="none" opacity=".5"/>`;
    // Interfaces.
    for (let i = 0; i < n - 1; i++) {
      const yi = tops[i + 1];
      const itf = couches[i].interface ?? "collee";
      const attrs = itf === "glissante" ? `stroke-dasharray="7 4"` : itf === "semi-collee" ? `stroke-dasharray="2 3"` : "";
      const col = itf === "collee" ? "#fff" : COULEURS.rouge;
      s += ligne(xg, yi, xd, yi, col, itf === "collee" ? 1.2 : 2.2, attrs);
      if (itf !== "collee")
        s += texte(xg + W / 2, yi - 3, itf === "glissante" ? "glissante" : "semi-collée", `text-anchor="middle" class="halo" style="font-size:10px;font-weight:800;fill:${COULEURS.rouge}"`);
    }
    // Jumelage, vu de face.
    if (jum) {
      const xc = xg + W / 2, { e, a, ech, l, h } = jum;
      s += jumelageDeFace([xc - (e / 2) * ech, xc + (e / 2) * ech], yRoue, l, id, { h });
      s += texte(xc, yRoue - 7 - h - 9, `jumelage ${fmt(essieu.P, 3)} kN par roue · q = ${fmt(essieu.q, 3)} MPa · a = ${fmt(a * 100, 3)} cm · entraxe ${fmt(e * 100, 3)} cm`,
        `text-anchor="middle" style="font-size:11px;font-weight:700"`);
    }
    // Marques de cote (points d'évaluation).
    for (const m of marques) {
      const i = locate(couches, m.z, m.base);
      const yl = i < n - 1 ? tops[i] + ((m.z - sommet(couches, i)) / couches[i].h) * hauteurs[i] : tops[n - 1] + 4;
      const col = m.couleur ?? COULEURS.effort;
      s += `<circle cx="${(xg + W / 2).toFixed(1)}" cy="${yl.toFixed(1)}" r="4" fill="${col}" stroke="#fff" stroke-width="1.4"/>`;
      if (m.libelle) s += texte(xg + W / 2 + 8, yl + 4, m.libelle, `class="halo" style="font-size:11px;font-weight:800;fill:${col}"`);
    }
    return s;
  } });
}

function sommet(couches, i) {
  let z = 0;
  for (let k = 0; k < i; k++) z += couches[k].h;
  return z;
}
function locate(couches, z, base) {
  let top = 0;
  for (let i = 0; i < couches.length - 1; i++) {
    const fond = top + couches[i].h;
    if (base ? z <= fond + 1e-9 : z < fond - 1e-9) return i;
    top = fond;
  }
  return couches.length - 1;
}

const GRANDEURS = {
  epsT: { libelle: "εT (µdéf) — traction < 0", couleur: COULEURS.bleu },
  sigT: { libelle: "σT (MPa) — traction < 0", couleur: COULEURS.violet },
  epsZ: { libelle: "εz (µdéf)", couleur: COULEURS.ec7 },
  sigZ: { libelle: "σz (MPa)", couleur: COULEURS.f62 },
};

/**
 * Profil d'une grandeur en profondeur (sortie de profils()), bandes des
 * couches en fond, et paliers admissibles en tirets (même signe que la
 * grandeur comparée : la courbe franchit le palier exactement quand le
 * critère échoue). admissibles : [{ zHaut, zBas, valeur }] déjà signés.
 */
export function profilProfondeur(profil, couches, grandeur = "epsT", { admissibles = [], largeur = 560, hauteur = 340, zMax = null } = {}) {
  const G = GRANDEURS[grandeur];
  const pts = profil.profondeur.map((p) => [p[grandeur], p.z]);
  const valeurs = [...pts.map((p) => p[0]), ...admissibles.map((a) => a.valeur), 0];
  let xmin = Math.min(...valeurs), xmax = Math.max(...valeurs);
  const marge = (xmax - xmin) * 0.08 || 1;
  xmin -= marge; xmax += marge;
  const zM = zMax ?? profil.profondeurMax;
  const zones = [];
  let z = 0;
  couches.forEach((c, i) => {
    const z1 = i < couches.length - 1 ? z + c.h : zM;
    const t = teinteCouche(c);
    zones.push({ x0: xmin, x1: xmax, y0: z, y1: z1, couleur: t.fond, opacite: 0.22,
      libelle: c.nom ?? c.materiau, position: "droite" });
    z = z1;
  });
  return graphe({
    largeur, hauteur, xmin, xmax, ymin: 0, ymax: zM, inverserY: true,
    xlabel: G.libelle, ylabel: "profondeur (m)", zones,
    series: [
      { points: [[0, 0], [0, zM]], couleur: COULEURS.discret, epaisseur: 1 },
      { points: pts, couleur: G.couleur, epaisseur: 2.6, libelle: G.libelle.split(" —")[0] },
      ...admissibles.map((a, k) => ({ points: [[a.valeur, a.zHaut], [a.valeur, a.zBas]], couleur: COULEURS.rouge, tirets: "7 4", epaisseur: 2,
        libelle: k === 0 ? "valeur admissible" : undefined })),
    ],
  });
}

/** Bassin de déflexion (mm/100) depuis le point entre-jumelage ; mesures facultatives [[y, d]]. */
export function figureBassin(bassin, { mesures = [], largeur = 560, hauteur = 280, titre = "Bassin de déflexion" } = {}) {
  const ys = bassin.map((b) => b.y), ds = bassin.map((b) => b.d);
  const dmax = Math.max(...ds, ...mesures.map((m) => m[1]), 1);
  return graphe({
    largeur, hauteur, titre, xmin: 0, xmax: Math.max(...ys, ...mesures.map((m) => m[0])), ymin: 0, ymax: dmax * 1.1, inverserY: true,
    xlabel: "distance au point entre-jumelage (m)", ylabel: "déflexion (mm/100)",
    series: [
      { points: bassin.map((b) => [b.y, b.d]), couleur: COULEURS.bleu, epaisseur: 2.6, libelle: "calculée" },
      ...(mesures.length ? [{ points: mesures, couleur: COULEURS.effort, nuage: true, rayon: 4, libelle: "mesurée" }] : []),
    ],
    marques: [{ x: 0, y: ds[0], couleur: COULEURS.bleu, libelle: `d0 = ${fmt(ds[0], 3)}` }],
  });
}

/** Tableau HTML des sollicitations (sortie de analyser()), au format d'Alizé. */
export function tableauSollicitations(analyse, { avecPositions = false } = {}) {
  const f = (x, d) => (Number.isFinite(x) ? x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
  const lignes = analyse.lignes.map((l) => `<tr>
      <td>${l.libelle}</td><td class="num">${f(l.E, 0)}</td><td class="num">${f(l.nu, 2)}</td>
      <td class="q">${f(l.epsT, 1)}</td><td class="q">${f(l.sigT, 3)}</td><td class="q">${f(l.epsZ, 1)}</td><td class="q">${f(l.sigZ, 3)}</td>
      ${avecPositions ? `<td class="motif">${l.epsTDe ?? ""}</td>` : ""}</tr>`).join("");
  return `<table class="resultats"><thead><tr><th>Cote (m)</th><th class="num">E (MPa)</th><th class="num">ν</th>
    <th class="num">εT (µdéf)</th><th class="num">σT (MPa)</th><th class="num">εz (µdéf)</th><th class="num">σz (MPa)</th>
    ${avecPositions ? "<th>εT retenue</th>" : ""}</tr></thead><tbody>${lignes}</tbody></table>`;
}

/**
 * Du sol à la plateforme : sol de PST (classe GTR, état), arase, couche de forme éventuelle
 * (nature et épaisseur), plateforme obtenue et son module de calcul. Les niveaux sont nommés
 * sur le côté : c'est la chaîne qu'on lit de bas en haut pour obtenir le module du sol support.
 * { sol, pst, arase, moduleArase, couche: { libelle, epCm } | null, plateforme, module }
 */
export function figureSolPlateforme({ sol, pst = null, arase = null, moduleArase = null, couche = null, plateforme = null, module = null }, { largeur = 600 } = {}) {
  const x0 = 24, x1 = 360, xt = 376;
  const hForme = couche ? Math.min(150, Math.max(46, couche.epCm * 2.2)) : 0;
  const yPf = 56, yArase = yPf + hForme, ySol = yArase + 92, H = ySol + 34;
  return svg({ largeur, hauteur: H, titre: "Du sol à la plateforme", contenu: (id) => {
    let s = "";
    // Corps de chaussée à venir, en pointillé.
    s += `<rect x="${x0}" y="12" width="${x1 - x0}" height="${yPf - 12}" fill="#f1f5f9" stroke="${COULEURS.discret}" stroke-dasharray="5 4"/>`;
    s += texte((x0 + x1) / 2, (12 + yPf) / 2 + 4, "corps de chaussée", `text-anchor="middle" class="pt"`);
    if (couche) {
      s += `<rect x="${x0}" y="${yPf}" width="${x1 - x0}" height="${hForme}" fill="#e3d3a0"/><rect x="${x0}" y="${yPf}" width="${x1 - x0}" height="${hForme}" fill="url(#${id}-grave)"/>`;
      s += texte((x0 + x1) / 2, yPf + hForme / 2 + 4, `${couche.libelle} — ${fmt(couche.epCm, 3)} cm`, `text-anchor="middle" class="gr halo" style="font-size:12px"`);
    }
    s += `<rect x="${x0}" y="${yArase}" width="${x1 - x0}" height="${ySol - yArase + 20}" fill="#dccab0"/><rect x="${x0}" y="${yArase}" width="${x1 - x0}" height="${ySol - yArase + 20}" fill="url(#${id}-argile)"/>`;
    s += texte((x0 + x1) / 2, yArase + 44, `${pst ? `${pst} — ` : ""}sol ${sol ?? ""}`, `text-anchor="middle" class="gr halo" style="font-size:12px"`);
    s += `<path d="M${x0} ${ySol + 20}l14 -6l14 6l14 -6l14 6" stroke="${COULEURS.discret}" fill="none" opacity=".5"/>`;
    // Niveaux nommés.
    const niveau = (y, libelle, detail, couleur) => {
      s += ligne(x0 - 6, y, x1 + 8, y, couleur, 2.2);
      s += texte(xt, y + 1, libelle, `style="font-size:12.5px;font-weight:800;fill:${couleur}"`);
      if (detail) s += texte(xt, y + 16, detail, `class="pt"`);
    };
    const detailArase = moduleArase > 0 ? `EV2 ≥ ${fmt(moduleArase, 3)} MPa` : "";
    const detailPf = module ? `module de calcul ${fmt(module, 3)} MPa` : "";
    // Sans couche de forme, la plateforme est l'arase : un seul niveau, deux noms.
    if (!couche) { if (plateforme || arase) niveau(yPf, [plateforme && `Plateforme ${plateforme}`, arase && `arase ${arase}`].filter(Boolean).join(" = "), detailPf || detailArase, plateforme ? COULEURS.bleu : COULEURS.f62); }
    else {
      if (plateforme) niveau(yPf, `Plateforme ${plateforme}`, detailPf, COULEURS.bleu);
      if (arase) niveau(yArase, `Arase ${arase}`, detailArase, COULEURS.f62);
    }
    return s;
  } });
}
