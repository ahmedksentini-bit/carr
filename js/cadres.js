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
import * as G from './geom.js';
import { fmt, upright } from './common.js';
import { pathProject, polySegs } from './clotho.js';
import { listAxes } from './profils.js';
import { PSIDA_URL } from './ouvrage.js';

const num = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);
const up5 = (v) => Math.ceil(v * 20 - 1e-9) / 20;
const up50 = (v) => Math.ceil(v * 2 - 1e-9) / 2;

export const CADRE_DEF = { type: 'picf', n: 1, B: 3, H: 2.5, Hr: 1.5, biais: 100, usage: 'eau', wingA: 30 };

// Grandeurs calculées d'un cadre (épaisseurs, largeur extérieure, longueur, murs).
export function cadreDims(c, half = 6) {
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
  const wingA = Math.max(0, Math.min(90, num(c.wingA, 30))), wingL = Math.max(0, num(c.wingL, up50(1.5 * (H + et))));
  return { n, B, H, Hr, ep, et, ei, er, eAuto, ang, psi, sinP, W, L, Lg, Ld, Lauto, wingA, wingL, type: buse ? 'buse' : c.type === 'pipo' ? 'pipo' : 'picf' };
}

// Implantation : point et directions sur l'axe porteur, abscisse le long de l'autoroute (numérotation des ouvrages).
export function cadreGeoms(prj, D) {
  const axes = listAxes(prj, D), byKey = Object.fromEntries(axes.map((a) => [a.key, a])), out = [];
  for (const c of prj.cadres || []) {
    const ax = byKey[c.axis];
    if (!ax) { out.push({ c, err: `axe porteur introuvable (${c.axisName || c.axis})` }); continue; }
    const s = Math.max(0, Math.min(ax.len, num(c.s, 0))), { p, t } = ax.at(s), n = G.rot90(t);
    const K = cadreDims(c, (ax.half || 6) + 1);
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

// Dessin en plan d'un cadre et fiche.
export function drawCadre(g, name, P, TH) {
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
  // Murs en aile évasés : depuis chaque angle extérieur, vers l'extérieur de l'ouvrage, à α de son axe.
  if (K.wingL > 0.1) {
    const a = (K.wingA * Math.PI) / 180, tw = 0.3;
    for (const [k, sg] of [[0, -1], [1, 1]]) for (const [cc, sw] of [[cL, 1], [cR, -1]]) {
      const c0 = cc[k], dir = G.norm(G.add(G.mul(d, sg * Math.cos(a)), G.mul(m, sw * Math.sin(a))));
      const nn = G.mul(G.rot90(dir), -sw * sg), e1 = G.add(c0, G.mul(dir, K.wingL));
      path([c0, e1, G.add(e1, G.mul(nn, tw)), G.add(c0, G.mul(nn, tw))], { wm: 0.2 });
    }
  }
  // Axe de l'ouvrage et étiquette.
  path([G.add(p, G.mul(d, -K.Lm - 2)), G.add(p, G.mul(d, K.Lp + 2))], { role: 'axe', dash: [3, 1, 0.5, 1] });
  const what = K.type === 'pipo' ? 'PIPO' : K.type === 'buse' ? 'buse' : 'PICF';
  const desc = K.type === 'buse' ? `${name} : ${K.n > 1 ? `${K.n} buses` : 'buse'} Ø ${fmt(K.B, 2)} m, L = ${fmt(K.L, 2)} m, biais ${fmt(K.psi, 1)} gr`
    : `${name} : ${what} ${K.n > 1 ? `${K.n} × ` : ''}${fmt(K.B, 2)} × ${fmt(K.H, 2)} m, L = ${fmt(K.L, 2)} m, biais ${fmt(K.psi, 1)} gr`;
  text(G.add(E[1], G.add(G.mul(d, 2 + K.wingL * 0.3), G.mul(m, K.W / 2 + 1))), desc, Math.atan2(d.y, d.x));
  return { poly, desc };
}

// Contrôles d'un cadre.
export function cadreChecks(g, name) {
  const out = [], K = g.K, c = g.c;
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
export const cadreLink = (g, name, prj) => `${PSIDA_URL}#cadres/d=${encodeURIComponent(b64(JSON.stringify(cadreData(g, name, prj))))}`;
export const cadreProject = (g, name, prj) => JSON.stringify({ format: 'psida-projet', version: '0.99', date: new Date().toISOString(), source: 'GIRA (carr.ksr-infra.org)', data: cadreData(g, name, prj) }, null, 1);
