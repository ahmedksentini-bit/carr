// cadres.js — ouvrages enterrés sous remblai : cadre fermé (PICF, dalot) et portique ouvert (PIPO), placés sur un axe du
// projet (autoroute, voie secondaire, bretelle, branche). Paramètres : nombre de cellules n, ouverture B, hauteur
// intérieure H, orientation (gr, 100 = droit, angle de 20 à 180 gr entre l'axe de la voie portée et celui de l'ouvrage ;
// biais ψ = min(angle, 200 − angle), orientable sur le plan par la poignée de rotation), hauteur de remblai Hr
// sur la traverse, épaisseurs (par défaut : table simplifiée des cadres Sétra PICF, e ≈ 0,15 + B/20 arrondi à 5 cm),
// longueur L le long de l'axe de l'ouvrage (par défaut : plate-forme + talus 3/2 jusqu'au niveau de la traverse, divisée
// par le sinus du biais), murs en aile évasés à α (30° par défaut) de longueur 1,5 (H + e).
// Dessin en plan (calque OUVRAGE) : têtes en trait plein (parallèles à l'axe de la voie portée), faces extérieures et
// intérieures des piédroits et voiles cachées sous le remblai (tirets), semelles du PIPO, murs en aile, axe et étiquette. Export vers PSIDA
// (onglet « Cadres et portiques », champs cf_*).
// Pont à poutres (type « poutres ») : passage inférieur à travées indépendantes (VIPP, PRAD ou poutres BA) portant la
// voie au-dessus d'un écoulement (ou d'une voie) : tablier dans l'axe de la voie portée, lignes d'appui (culées, piles)
// parallèles à l'écoulement (orientation comme pour les cadres), travées mesurées le long de l'axe, largeur = plate-forme
// de la voie + corniches ; type de poutres et hauteur proposés selon la plus grande portée (ordres de grandeur des
// guides Sétra, à confirmer dans PSIDA, onglet « Ponts à poutres », champs pt_*).
import * as G from './geom.js';
import { fmt, upright, spanSupports } from './common.js';
import { pathProject, polySegs } from './clotho.js';
import { listAxes } from './profils.js';
import { PSIDA_URL } from './ouvrage.js';

const num = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);
const up5 = (v) => Math.ceil(v * 20 - 1e-9) / 20;
const up50 = (v) => Math.ceil(v * 2 - 1e-9) / 2;

export const CADRE_DEF = { type: 'picf', n: 1, B: 3, H: 2.5, Hr: 1.5, biais: 100, usage: 'eau' };
// Têtes (clés du catalogue HDS-5, hydro/data/culvert-catalog.js) → géométrie en plan. Familles d'angles de BVTrace
// (docs/context/ouvrages-tetes-murs.md) : 1 = 30 à 75° (45° proposé), 2 = 15° ou 90° seulement, 3 = 0°, 4 = 45° imposé,
// 5 et 6 = mur frontal sans aile ; buses : mur de tête (101, 102, 201, 301, 302) ou extrémité sans mur (103, 202, 203).
export const HEAD_TYPES = {
  1: { key: 1, a: 45, range: [30, 75], murette: true, label: 'ailes évasées 30° à 75°' },
  2: { key: 2, a: 15, set: [15, 90], murette: true, label: 'ailes à 15° ou mur frontal à 90°' },
  3: { key: 3, fix: 0, murette: true, label: 'ailes parallèles' },
  4: { key: 4, fix: 45, murette: true, label: 'ailes à 45°, biseau supérieur' },
  5: { key: 5, wings: false, murette: true, label: 'mur frontal à 90°, chanfreins' },
  6: { key: 6, wings: false, murette: true, label: 'mur frontal à 90°, biseaux' },
  101: { key: 101, wings: false, murette: true, label: 'mur de tête, arête vive' },
  102: { key: 102, wings: false, murette: true, label: 'mur de tête, emboîtement femelle' },
  103: { key: 103, wings: false, murette: false, label: 'emboîtement femelle en saillie' },
  201: { key: 201, wings: false, murette: true, label: 'métallique, mur de tête' },
  202: { key: 202, wings: false, murette: false, label: 'métallique, biseautée au talus' },
  203: { key: 203, wings: false, murette: false, label: 'métallique, en saillie' },
  301: { key: 301, wings: false, murette: true, label: 'anneau biseauté à 45°' },
  302: { key: 302, wings: false, murette: true, label: 'anneau biseauté à 33,7°' },
};
export const MURETTE = { t: 0.3, over: 0.5 }; // mur de tête : épaisseur, débord de part et d'autre de l'ouvrage (m)

// Pont à poutres : travées (m) saisies « 20 ; 20 » ou tableau.
export const parseSpansTxt = (v) => (Array.isArray(v) ? v : String(v ?? '').split(/[;+\s]+|,(?=\s)/)).map((x) => parseFloat(String(x).replace(',', '.'))).filter((x) => Number.isFinite(x) && x > 0);
// Type de poutres selon la plus grande portée : BA ≤ 16 m, PRAD ≤ 30 m (Sétra, dossier PRAD 73), VIPP au-delà
// (guide VIPP 1996 : 30 à 50 m). Élancement h_p / L : VIPP 1/17, PRAD 1/18, BA 1/13 (ordres de grandeur).
export const PP_TYPES = { BA: 'poutres en béton armé', PRAD: 'poutres précontraintes par adhérence (PRAD)', BP: 'poutres précontraintes par post-tension (VIPP)' };
// Voie portée à TPC (autoroute, voie secondaire de type autoroute) : deux tabliers jumeaux, un par sens (chaussée
// = BDG + voies + BAU, corniches de 0,60 m), séparés au droit du TPC ; sinon un tablier sur toute la plate-forme.
export function poutresDims(c, half = 6, H = null) {
  const spans = parseSpansTxt(c.spans), sp = spans.length ? spans : [20], Lmax = Math.max(...sp), Ltot = sp.reduce((a, b) => a + b, 0);
  const ang = Math.max(20, Math.min(180, num(c.biais, 100))), psi = ang <= 100 ? ang : 200 - ang, sinP = Math.sin((psi * Math.PI) / 200);
  const twinOk = !!(H && num(H.median, 0) > 0.5), twin = twinOk && c.twin !== 'non';
  const cw = twinOk ? num(H.bdg, 1) + Math.max(1, num(H.lanes, 2)) * num(H.wLane, 3.5) + num(H.bau, 2.5) : 2 * half;
  const Wauto = up5(cw + 2 * 0.6), Wone = up5(2 * half + 2 * 0.6), W = Math.max(3, num(c.Wd, twin ? Wauto : twinOk ? Wone : Wauto));
  const decks = twin ? [-1, 1].map((k) => k * (num(H.median, 0) / 2 + cw / 2)) : [0];
  const road = twin ? cw / 2 : Math.min(half, W / 2);
  const typ = PP_TYPES[c.pt] ? c.pt : Lmax <= 16 ? 'BA' : Lmax <= 30 ? 'PRAD' : 'BP';
  const hpAuto = up5(Lmax / (typ === 'BP' ? 17 : typ === 'PRAD' ? 18 : 13)), hp = Math.max(0.4, num(c.hp, hpAuto)), hd = Math.max(0.15, num(c.hd, 0.25));
  const nbAuto = Math.max(2, Math.round(W / 3)), nb = Math.max(2, Math.round(num(c.nb, nbAuto)));
  const about = Math.max(0.3, num(c.about, 0.5));
  return { type: 'poutres', spans: sp, n: sp.length, Lmax, Ltot, ang, psi, sinP, W, Wauto: twin || !twinOk ? Wauto : Wone, twin, twinOk, decks, road, typ, hp, hpAuto, hd, h: hp + hd, nb, nbAuto, b1: W / nb, about, Hr: 0, B: Lmax, H: hp, L: Ltot + 2 * about, Lg: (Ltot + 2 * about) / 2, Ld: (Ltot + 2 * about) / 2 };
}

// Grandeurs calculées d'un cadre (épaisseurs, largeur extérieure, longueur, murs).
export function cadreDims(c, half = 6, axH = null) {
  if (c.type === 'poutres') return poutresDims(c, half, axH);
  const buse = c.type === 'buse';
  const n = Math.max(1, Math.round(num(c.n, 1))), B = Math.max(0.3, num(c.B, buse ? 1 : 3)), H = buse ? B : Math.max(0.5, num(c.H, 2.5)), Hr = Math.max(0, num(c.Hr, 1.5));
  // buse : épaisseur de paroi ≈ D/12 + 0,08 m, entraxe libre entre buses ≥ max(0,40 m, D/3)
  const eAuto = buse ? up5(0.08 + B / 12) : up5(0.15 + B / 20);
  const ep = num(c.ep, eAuto), et = num(c.et, eAuto), ei = num(c.ei, buse ? Math.max(0.4, up5(B / 3)) : eAuto), er = num(c.er, eAuto);
  // orientation : angle (gr) entre l'axe de la voie portée et l'axe de l'ouvrage, mesuré à gauche, de 20 à 180 gr
  // (100 = droit ; < 100 et > 100 : biais d'un côté ou de l'autre) ; biais structurel ψ = min(angle, 200 − angle)
  const ang = Math.max(20, Math.min(180, num(c.biais, 100))), psi = ang <= 100 ? ang : 200 - ang, sinP = Math.sin((psi * Math.PI) / 200);
  const W = n * B + (n - 1) * ei + 2 * ep;
  const Lauto = up50((2 * (half + 1.5 * Hr + 0.5)) / sinP);
  // longueur par demi-ouvrage, mesurée le long de l'axe de l'ouvrage depuis l'axe de la voie portée : Lg côté gauche de
  // la voie, Ld côté droit (saisies ou tirées par les poignées) ; à défaut, la moitié de L saisie ou de Lauto
  const Lh = Math.max(W / 2, num(c.L, Lauto) / 2), Lg = Math.max(W / 2, num(c.Lg, Lh)), Ld = Math.max(W / 2, num(c.Ld, Lh));
  const L = Lg + Ld;
  // Tête (configuration d'entrée HDS-5, BVTrace « Têtes de dalot ») : famille d'angles des murs en aile (mesurés depuis
  // l'axe de l'ouvrage, 0 = prolongement des piédroits, 90 = mur frontal) et mur de tête (murette) ; une buse n'a pas
  // de mur en aile (mur de tête, ou extrémité en saillie / biseautée sans mur).
  const head = HEAD_TYPES[num(c.inlet, buse ? 101 : 4)] || HEAD_TYPES[buse ? 101 : 4];
  let wingA = Math.max(0, Math.min(90, num(c.wingA, head.a ?? 30)));
  if (head.fix != null) wingA = head.fix; else if (head.set && !head.set.includes(wingA)) wingA = head.set[0]; else if (head.range) wingA = Math.max(head.range[0], Math.min(head.range[1], wingA));
  const wingL = head.wings === false || buse ? 0 : Math.max(0, num(c.wingL, up50(1.5 * (H + et))));
  return { n, B, H, Hr, ep, et, ei, er, eAuto, ang, psi, sinP, W, L, Lg, Ld, Lauto, wingA, wingL, head, inlet: head.key, murette: head.murette, type: buse ? 'buse' : c.type === 'pipo' ? 'pipo' : 'picf' };
}

// Implantation : point et directions sur l'axe porteur, abscisse le long de l'autoroute (numérotation des ouvrages).
export function cadreGeoms(prj, D) {
  const axes = listAxes(prj, D), byKey = Object.fromEntries(axes.map((a) => [a.key, a])), out = [];
  for (const c of prj.cadres || []) {
    const ax = byKey[c.axis];
    if (!ax) { out.push({ c, err: `axe porteur introuvable (${c.axisName || c.axis})` }); continue; }
    const s = Math.max(0, Math.min(ax.len, num(c.s, 0))), { p, t } = ax.at(s), n = G.rot90(t);
    const K = cadreDims(c, c.type === 'poutres' ? ax.half || 6 : (ax.half || 6) + 1, ax.H);
    const th = (K.ang * Math.PI) / 200, d = G.norm(G.add(G.mul(t, Math.cos(th)), G.mul(n, Math.sin(th))));
    // demi-longueurs de part et d'autre de la voie : +d pointe à gauche (orientation 20 à 180 gr mesurée à gauche)
    const left = G.cross(t, d) > 0;
    K.Lp = left ? K.Lg : K.Ld; K.Lm = left ? K.Ld : K.Lg; K.leftP = left;
    const sX = D?.hwy?.ok ? (pathProject(D.hwy.path, p)?.s ?? s) : s;
    out.push({ c, ax, s, p, t, n, d, K, sX });
  }
  return out;
}

// Intersection de la droite (a, u) et de la droite (b, v).
const meet = (a, u, b, v) => { const den = G.cross(u, v); if (Math.abs(den) < 1e-9) return null; const k = G.cross(G.sub(b, a), v) / den; return G.add(a, G.mul(u, k)); };

// Lignes d'appui d'un pont à poutres : pour chaque appui (culée, piles, culée) et les deux abouts du tablier, abscisse
// sur l'axe porteur, point, tangente et extrémités sur les bords du tablier (droite parallèle à l'écoulement d).
export function poutresSupports(g, yc = 0) {
  const { ax, s, d, K } = g, out = [];
  const at = (x) => { const ss = Math.max(0, Math.min(ax.len, s + x)), q = ax.at(ss), cr = G.cross(q.t, d); return { x, s: ss, p: q.p, t: q.t, cr: Math.abs(cr) < 0.05 ? Math.sign(cr || 1) * 0.05 : cr }; };
  const edge = (A, y) => G.add(A.p, G.mul(d, y / A.cr)); // point de la ligne d'appui à la distance y de l'axe (gauche > 0)
  const xs = spanSupports(K.spans); // pile centrale (ou travée centrale) fixe au point d'implantation de l'ouvrage
  xs.forEach((xi, i) => { const A = at(xi); out.push({ ...A, kind: i === 0 || i === xs.length - 1 ? 'culee' : 'pile', L: edge(A, yc + K.W / 2), R: edge(A, yc - K.W / 2) }); });
  const ends = [at(xs[0] - K.about), at(xs[xs.length - 1] + K.about)].map((A) => ({ ...A, L: edge(A, yc + K.W / 2), R: edge(A, yc - K.W / 2) }));
  return { sup: out, ends, edge };
}
function drawPoutres(g, name, P, TH) {
  const { p, d, K } = g, m = G.rot90(d);
  const path = (pts, extra = {}) => P({ k: 'path', L: 'OUVRAGE', segs: polySegs(pts), ...extra });
  const text = (q, s, rot, align = 'left', h = TH) => P({ k: 'text', L: 'OUVRAGE', p: q, s, rot: upright(rot), align, h });
  let last = null;
  for (const yc of K.decks) {
    const { sup, ends, edge } = poutresSupports(g, yc);
    // tablier : contour (bords le long de l'axe, abouts parallèles à l'écoulement), remplissage
    const all = [ends[0], ...sup, ends[1]], poly = [...all.map((A) => A.L), ...all.map((A) => A.R).reverse()];
    P({ k: 'fill', L: 'OUVRAGE', rings: [polySegs([...poly, poly[0]])], role: 'tablier' });
    path([...poly, poly[0]], { wm: 0.25 });
    // poutres (sous le hourdis : cachées), de culée à culée
    for (let j = 0; j < K.nb; j++) { const y = yc - K.W / 2 + K.b1 * (j + 0.5); path(sup.map((A) => edge(A, y)), { role: 'cache', dash: [1.2, 0.6] }); }
    // lignes d'appui : culées (mur de front, débordant de 0,5 m, et sa semelle côté remblai) et piles (sous le tablier)
    for (const A of sup) {
      const e = G.mul(d, 0.5 * Math.sign(G.dot(G.sub(A.L, A.R), d) || 1));
      if (A.kind === 'culee') {
        const back = G.mul(G.norm(A.t), ((A.x < 0 ? -1 : 1) * 0.6) / Math.max(0.3, Math.abs(A.cr)));
        path([G.sub(A.R, e), G.add(A.L, e), G.add(G.add(A.L, e), back), G.add(G.sub(A.R, e), back), G.sub(A.R, e)], { wm: 0.25 });
      } else path([G.sub(A.R, e), G.add(A.L, e)], { role: 'cache', dash: [2, 0.8], wm: 0.35 });
    }
    last = sup;
  }
  // contour d'ensemble (sélection, masque des talus) : bords extérieurs des tabliers extrêmes
  const lo = Math.min(...K.decks) - K.W / 2, hi = Math.max(...K.decks) + K.W / 2;
  const { ends: e0, sup: s0, edge } = poutresSupports(g, 0), chain = [e0[0], ...s0, e0[1]];
  const poly = [...chain.map((A) => edge(A, hi)), ...chain.map((A) => edge(A, lo)).reverse()];
  // axe de l'écoulement et étiquette
  const hl = (hi - lo) / 2 / Math.max(0.2, K.sinP) + 8;
  path([G.add(p, G.mul(d, -hl)), G.add(p, G.mul(d, hl))], { role: 'axe', dash: [3, 1, 0.5, 1] });
  const desc = `${name} : pont à poutres ${K.typ === 'BP' ? 'VIPP' : K.typ}, ${K.spans.map((v) => fmt(v, 2)).join(' + ')} m, ${K.twin ? `2 tabliers de ${fmt(K.W, 2)} m` : `largeur ${fmt(K.W, 2)} m`}, ${K.nb} poutres h ${fmt(K.hp, 2)} m, biais ${fmt(K.psi, 1)} gr`;
  const A = last[last.length - 1];
  text(G.add(edge(A, hi + 1), G.mul(G.norm(A.t), 2)), desc, Math.atan2(A.t.y, A.t.x));
  return { poly, desc };
}

// Dessin en plan d'un cadre et fiche.
export function drawCadre(g, name, P, TH) {
  if (g.K?.type === 'poutres') return drawPoutres(g, name, P, TH);
  const { p, t, d, K } = g, m = G.rot90(d);
  const path = (pts, extra = {}) => P({ k: 'path', L: 'OUVRAGE', segs: polySegs(pts), ...extra });
  const text = (q, s, rot, align = 'left', h = TH) => P({ k: 'text', L: 'OUVRAGE', p: q, s, rot: upright(rot), align, h });
  // Têtes : droites parallèles à l'axe porteur à ± L/2 le long de l'axe de l'ouvrage.
  const E = [G.add(p, G.mul(d, -K.Lm)), G.add(p, G.mul(d, K.Lp))];
  const side = (w, k) => meet(G.add(p, G.mul(m, w)), d, E[k], t);
  const corner = (w) => [side(w, 0), side(w, 1)];
  const cL = corner(K.W / 2), cR = corner(-K.W / 2);
  if (!cL[0] || !cL[1] || !cR[0] || !cR[1]) return null;
  const poly = [cL[0], cL[1], cR[1], cR[0]];
  // Ouvrage enterré : faces latérales cachées sous le remblai (tirets), têtes vues (trait plein).
  path([cL[0], cL[1]], { role: 'cache', dash: [1.6, 0.8] }); path([cR[0], cR[1]], { role: 'cache', dash: [1.6, 0.8] });
  path([cL[0], cR[0]], { wm: 0.3 }); path([cL[1], cR[1]], { wm: 0.3 });
  // Faces intérieures des piédroits et des voiles (cachées sous le remblai).
  let w = K.W / 2 - K.ep;
  for (let i = 0; i < K.n; i++) {
    for (const ww of [w, w - K.B]) { const q = corner(ww); if (q[0] && q[1]) path(q, { role: 'cache', dash: [0.6, 0.6] }); }
    w -= K.B + K.ei;
  }
  // PIPO : semelles (largeur 3 × piédroit, centrées sous chaque piédroit), en tirets.
  if (K.type === 'pipo') {
    const bs = 3 * K.ep;
    for (const wc of [K.W / 2 - K.ep / 2, -K.W / 2 + K.ep / 2]) for (const ww of [wc + bs / 2, wc - bs / 2]) { const q = corner(ww); if (q[0] && q[1]) path(q, { role: 'cache', dash: [0.4, 0.4] }); }
  }
  // Têtes : mur de tête (murette) et murs en aile, alerte en rouge si la tête empiète sur le talus (g.headBad).
  for (const k of [0, 1]) for (const pl of cadreHeadPolys(g)[k] || []) path(pl, { wm: 0.2, closed: true, ...(g.headBad?.[k] ? { role: 'err' } : {}) });
  // Axe de l'ouvrage et étiquette.
  path([G.add(p, G.mul(d, -K.Lm - 2)), G.add(p, G.mul(d, K.Lp + 2))], { role: 'axe', dash: [3, 1, 0.5, 1] });
  const what = K.type === 'pipo' ? 'PIPO' : K.type === 'buse' ? 'buse' : 'PICF';
  const desc = K.type === 'buse' ? `${name} : ${K.n > 1 ? `${K.n} buses` : 'buse'} Ø ${fmt(K.B, 2)} m, L = ${fmt(K.L, 2)} m, biais ${fmt(K.psi, 1)} gr`
    : `${name} : ${what} ${K.n > 1 ? `${K.n} × ` : ''}${fmt(K.B, 2)} × ${fmt(K.H, 2)} m, L = ${fmt(K.L, 2)} m, biais ${fmt(K.psi, 1)} gr`;
  text(G.add(E[1], G.add(G.mul(d, 2 + K.wingL * 0.3), G.mul(m, K.W / 2 + 1))), desc, Math.atan2(d.y, d.x));
  return { poly, desc };
}

// Contours en plan des deux têtes (k = 0 : côté −d, k = 1 : côté +d) : mur de tête (débord MURETTE.over, épaisseur
// MURETTE.t vers l'intérieur du remblai) et murs en aile évasés depuis les angles extérieurs, à α de l'axe de l'ouvrage.
export function cadreHeadPolys(g) {
  const { p, t, d, K } = g; if (!K || K.type === 'poutres') return [[], []];
  const m = G.rot90(d), E = [G.add(p, G.mul(d, -K.Lm)), G.add(p, G.mul(d, K.Lp))];
  const side = (w, k) => meet(G.add(p, G.mul(m, w)), d, E[k], t);
  const out = [[], []];
  for (const [k, sg] of [[0, -1], [1, 1]]) {
    const a0 = side(K.W / 2, k), b0 = side(-K.W / 2, k); if (!a0 || !b0) continue;
    const u = G.norm(G.sub(a0, b0)), into = G.mul(d, -sg); // le long de la tête (vers cL) ; vers l'intérieur du remblai
    if (K.murette) {
      const A = G.add(a0, G.mul(u, MURETTE.over)), B = G.add(b0, G.mul(u, -MURETTE.over));
      out[k].push([A, B, G.add(B, G.mul(into, MURETTE.t)), G.add(A, G.mul(into, MURETTE.t))]);
    }
    if (K.wingL > 0.1) {
      const a = (K.wingA * Math.PI) / 180, tw = 0.3;
      for (const [c0, sw] of [[a0, 1], [b0, -1]]) {
        const dir = G.norm(G.add(G.mul(d, sg * Math.cos(a)), G.mul(m, sw * Math.sin(a))));
        const nn = G.mul(G.rot90(dir), -sw * sg), e1 = G.add(c0, G.mul(dir, K.wingL));
        out[k].push([c0, e1, G.add(e1, G.mul(nn, tw)), G.add(c0, G.mul(nn, tw))]);
      }
    }
  }
  return out;
}

// Contrôles d'un cadre.
export function cadreChecks(g, name) {
  const out = [], K = g.K, c = g.c;
  if (K?.type === 'poutres') {
    const lim = { BA: 20, PRAD: 35, BP: 50 }[K.typ];
    if (K.Lmax > lim) out.push({ lvl: 'warn', msg: `${name} : portée ${fmt(K.Lmax, 2)} m > ${lim} m, au-delà du domaine courant des ${PP_TYPES[K.typ]} (guides Sétra) ; choisir un autre type ou ajouter une pile.` });
    if (K.psi < 70) out.push({ lvl: 'warn', msg: `${name} : biais ${fmt(K.psi, 1)} gr < 70 gr — tablier biais : PSIDA calcule les travées droites (Guyon-Massonnet), l'effet du biais est à vérifier.` });
    if (K.b1 > 4 || K.b1 < 1.5) out.push({ lvl: 'info', msg: `${name} : entraxe des poutres ${fmt(K.b1, 2)} m hors de l'intervalle courant 1,50 – 4,00 m ; ajuster le nombre de poutres.` });
    return out;
  }
  for (const [v, side] of [[K.Lg, 'gauche'], [K.Ld, 'droit']]) if (v < K.Lauto / 2 - 0.05 && (c.Lg != null || c.Ld != null) && c[side === 'gauche' ? 'Lg' : 'Ld'] !== '' && c[side === 'gauche' ? 'Lg' : 'Ld'] != null) out.push({ lvl: 'warn', msg: `${name} : demi-longueur côté ${side} de la voie ${fmt(v, 2)} m < ${fmt(K.Lauto / 2, 2)} m nécessaires pour porter la demi-plate-forme et le talus 3/2 jusqu'au niveau de la traverse (biais compris).` });
  if (c.Lg == null && c.Ld == null && num(c.L, 0) && num(c.L, 0) < K.Lauto - 0.05) out.push({ lvl: 'warn', msg: `${name} : longueur ${fmt(K.L, 2)} m < ${fmt(K.Lauto, 2)} m nécessaires pour porter la plate-forme et le talus 3/2 jusqu'au niveau de la traverse (biais compris).` });
  if (K.psi < 50) out.push({ lvl: 'warn', msg: `${name} : biais ${fmt(K.psi, 1)} gr < 50 gr — biais prononcé (domaine des cadres Sétra PICF : 50 à 100 gr).` });
  if (c.usage === 'route' && K.H < 4.3) out.push({ lvl: 'warn', msg: `${name} : passage inférieur routier de hauteur libre ${fmt(K.H, 2)} m < 4,30 m (gabarit normal ; 4,75 m sous autoroute).` });
  if (K.Hr < 0.3 && K.type === 'picf') out.push({ lvl: 'info', msg: `${name} : remblai sur traverse ${fmt(K.Hr, 2)} m < 0,30 m — la traverse reçoit directement les charges de roue (vérifier le poinçonnement dans PSIDA).` });
  return out;
}

const b64 = (txt) => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(txt))) : Buffer.from(txt, 'utf8').toString('base64'));
const f2 = (v) => String(Math.round(v * 100) / 100);
export function cadreData(g, name, prj) {
  const K = g.K, c = g.c, d = { ouvrage: 'cadre', cf_type: K.type, cf_portee: 'route', cf_franchie: c.usage === 'route' ? 'route' : c.usage === 'rail' ? 'rail' : 'eau', cf_nom: name, cf_n: String(K.n), cf_B: f2(K.B), cf_H: f2(K.H), cf_L: f2(K.L), cf_biais: f2(K.psi), cf_Hr: f2(K.Hr) };
  for (const [k, f] of [['ep', 'cf_ep'], ['et', 'cf_et'], ['er', 'cf_er'], ['ei', 'cf_ei']]) if (c[k] !== '' && c[k] != null && isFinite(+c[k])) d[f] = f2(+c[k]);
  if (prj?.name) d.plan_projet = prj.name;
  return d;
}
// Données PSIDA (onglet « Ponts à poutres ») d'un pont à poutres.
export function poutresData(g, name, prj) {
  const K = g.K, r = Math.min(K.road, K.W / 2 - 0.3), e = K.W / 2 + 0.3; // un tablier (les tabliers jumeaux sont identiques)
  const d = { ouvrage: 'poutres', pt_spans: K.spans.map(f2).join(', '), pt_type: K.typ, pt_n: String(K.nb), pt_b1: f2(K.b1), pt_hd: f2(K.hd), pt_road: `${f2(-r)}, ${f2(r)}`, pt_foot: '', pt_lines: `18 @ ${f2(-e)} ; 18 @ ${f2(e)}` };
  if (K.typ === 'BA') Object.assign(d, { pt_geo: 'rect', pt_parts: `0.35 ${f2(K.hp)}`, pt_b0: '0.35' });
  else Object.assign(d, { pt_geo: 'dims', pt_hp: f2(K.hp) });
  if (prj?.name) d.plan_projet = prj.name;
  return d;
}
export const poutresLink = (g, name, prj) => `${PSIDA_URL}#poutres/d=${encodeURIComponent(b64(JSON.stringify(poutresData(g, name, prj))))}`;
export const cadreLink = (g, name, prj) => g.K?.type === 'poutres' ? poutresLink(g, name, prj) : `${PSIDA_URL}#cadres/d=${encodeURIComponent(b64(JSON.stringify(cadreData(g, name, prj))))}`;
export const cadreProject = (g, name, prj) => JSON.stringify({ format: 'psida-projet', version: '0.99', date: new Date().toISOString(), source: 'INFRA-KSR (carr.ksr-infra.org)', data: g.K?.type === 'poutres' ? poutresData(g, name, prj) : cadreData(g, name, prj) }, null, 1);
