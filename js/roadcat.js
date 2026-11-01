// roadcat.js — catégories de conception des sections courantes et leurs règles, reprises de BVTrace
// (BVTrace.Core/RoadDesignTables.cs, RoadDesignGeometry.cs, RoadDesignChecks.cs ; notes docs/axe-plan-regles-techniques.md
// et docs/conception-sections-courantes.md) :
//   • ARP 2022 (Cerema, Aménagement des routes principales) : R1, R2, artère interurbaine 110 km/h ;
//   • ICTAAL 2021 (autoroutes de liaison) : L1, L2 ;
//   • VSA 90 / 110 (Cerema 2014) ; AU70 (Certu 2013, sans clothoïde ni dévers) ; Libre (aucune règle) ;
//   • rayons saillants minimaux : guide Visibilité Cerema 2018 (substitués aux tables ARP / ICTAAL).
// Dévers : toit à dn (2,5 %) en alignement et pour R ≥ Rdn ; pour Rm ≤ R < Rdn, chaussée déversée vers l'intérieur,
// interpolation linéaire en 1/R entre dn à Rdn et 7 % à Rm ; variation linéaire le long de la clothoïde, jamais sur
// l'arc. Clothoïdes obligatoires si R < 1,5 Rdn :
//   ARP   Lclo = max(2·l·|Δd| ; k·R^0,4), k = 6 (2 voies) ou 12 (3 voies, 2×2) ;
//   ICTAAL Lclo = max(14·|Δd| ; R/9) ;  VSA  Lclo = max(R/9 ; 2·l·|Δd|) ;
//   Δd en % (dévers de l'arc − dévers normal, convention de BVTrace), l = largeur des voies à basculer (m).
import { fmt } from './common.js';

export const DCAT = {
  R1: { label: 'ARP R1 (80 km/h)', ref: 'ARP 2022 / Vis. 2018', fam: 'arp', Rm: 240, Rdn: 400, gMax: 6, Rvs: 3100, Rvr: 2100, V: 80 },
  R2: { label: 'ARP R2 (relief vallonné)', ref: 'ARP 2022 / Vis. 2018', fam: 'arp', Rm: 125, Rdn: 400, gMax: 7, Rvs: 1300, Rvr: 1300, V: 80 },
  A110: { label: 'ARP artère interurbaine 110', ref: 'ARP 2022 artère 110 / Vis. 2018', fam: 'arp', Rm: 400, Rdn: 650, gMax: 6, Rvs: 5200, Rvr: 3000, V: 110, dual: true },
  L1: { label: 'ICTAAL L1 (130 km/h)', ref: 'ICTAAL 2021 / Vis. 2018', fam: 'ictaal', Rm: 600, Rdn: 1000, gMax: 5, Rvs: 9200, Rvr: 4200, V: 130, dual: true },
  L2: { label: 'ICTAAL L2 (110 km/h)', ref: 'ICTAAL 2021 / Vis. 2018', fam: 'ictaal', Rm: 400, Rdn: 650, gMax: 6, Rvs: 5200, Rvr: 3000, V: 110, dual: true },
  VSA90: { label: 'VSA 90', ref: 'VSA 90 / Vis. 2018', fam: 'vsa', Rm: 240, Rdn: 370, gMax: 6, Rvs: 2700, Rvr: 2700, V: 90, dual: true },
  VSA110: { label: 'VSA 110', ref: 'VSA 110 / Vis. 2018', fam: 'vsa', Rm: 400, Rdn: 650, gMax: 6, Rvs: 5200, Rvr: 3000, V: 110, dual: true },
  AU70: { label: 'AU70 (artère urbaine, sans dévers)', ref: 'AU70 / Vis. 2018', fam: 'au', Rm: 200, Rdn: 200, gMax: 6, Rvs: 1300, Rvr: 1300, V: 70, noSuper: true },
  LIBRE: { label: 'Libre (aucune règle)', ref: 'libre', fam: 'libre', Rm: 0, Rdn: 0, gMax: 0, Rvs: 0, Rvr: 0, V: 0, noSuper: true, libre: true },
};
export const DMAX = 7; // dévers maximal normal (%)

// Catégorie de conception d'un axe : autoroute → L1 / L2 ; voie secondaire « autoroute » → sa catégorie ICTAAL ;
// route ordinaire → champ dcat (R1 par défaut).
export function designCatOf(H) {
  if (!H) return 'R1';
  if (H.kind === 'route') return DCAT[H.dcat] ? H.dcat : 'R1';
  return H.cat === 'L1' ? 'L1' : 'L2';
}
// Profil pour les clothoïdes ARP (k) et largeur des voies à basculer l.
export function bankParams(H) {
  const dual = (H?.median || 0) > 0;
  const lanes = Math.max(1, H?.lanes || 1), wl = H?.wLane || 3.5;
  return { k: dual || lanes >= 2 ? 12 : 6, l: dual ? lanes * wl : 2 * lanes * wl };
}

// Dévers (%) de la chaussée pour un rayon R (toit dn si R ≥ Rdn ; 7 % à Rm ; linéaire en 1/R entre les deux).
export function superPct(cat, R, dn = 2.5) {
  const C = DCAT[cat] || DCAT.R1;
  if (C.noSuper || !(R > 0) || !isFinite(R) || R >= C.Rdn) return dn;
  if (R <= C.Rm) return DMAX;
  const t = (1 / R - 1 / C.Rdn) / (1 / C.Rm - 1 / C.Rdn);
  return dn + t * (DMAX - dn);
}
// Longueur minimale de clothoïde (m) pour un arc de rayon R ; 0 si aucune n'est requise (R ≥ 1,5 Rdn, AU70, libre).
export function clothoidNeed(cat, R, H, dn = 2.5) {
  const C = DCAT[cat] || DCAT.R1;
  if (C.noSuper || !(R > 0) || R >= 1.5 * C.Rdn) return 0;
  const dd = Math.abs(superPct(cat, R, dn) - dn), { k, l } = bankParams(H);
  if (C.fam === 'ictaal') return Math.max(14 * dd, R / 9);
  if (C.fam === 'vsa') return Math.max(R / 9, 2 * l * dd);
  return Math.max(2 * l * dd, k * Math.pow(R, 0.4));
}

// Pentes transversales des deux demi-plates-formes (dz/dy vers l'extérieur de l'axe, côté gauche sd = 1 et droit
// sd = −1) à l'abscisse s d'un alignement de clotho.js : toit −dn ; dans une courbe déversée, côté intérieur −d, côté
// extérieur +d ; le long d'une clothoïde, variation linéaire (fraction f = κ(s)·R de 0 à 1).
export function deversAt(cat, al, s, dn = 2.5) {
  const toit = { left: -dn, right: -dn, d: dn, R: Infinity, f: 0, inner: 0 };
  const C = DCAT[cat] || DCAT.R1;
  if (!al?.elems?.length || C.noSuper) return toit;
  const e = al.elemAt(s);
  if (!e || e.kind === 'L' || !(e.R > 0) || e.R >= C.Rdn) return { ...toit, R: e?.R || Infinity };
  const d = superPct(cat, e.R, dn), inner = e.sg > 0 ? 1 : -1;
  const f = e.kind === 'A' ? 1 : Math.max(0, Math.min(1, Math.abs(al.curvAt(s)) * e.R));
  const sIn = -(dn + (d - dn) * f), sOut = -dn + (d + dn) * f;
  return { left: inner === 1 ? sIn : sOut, right: inner === 1 ? sOut : sIn, d, R: e.R, f, inner };
}

// Arcs d'un alignement avec leurs clothoïdes adjacentes : [{ s0, len, R, sg, Lin, Lout, sTS, sST }].
export function planCurves(al) {
  const E = al?.elems || [], out = [];
  E.forEach((e, i) => {
    if (e.kind !== 'A') return;
    const pv = E[i - 1], nx = E[i + 1];
    const Lin = pv?.kind === 'C' ? pv.len : 0, Lout = nx?.kind === 'C' ? nx.len : 0;
    out.push({ s0: e.s0, len: e.len, R: e.R, sg: e.sg, Lin, Lout, sTS: e.s0 - Lin, sST: e.s0 + e.len + Lout });
  });
  return out;
}

const lvlOf = { block: 'err', justify: 'warn', warn: 'warn', info: 'info' };

// Contrôles du tracé en plan (BVTrace CheckPlan) : Rm, clothoïdes, progressivité des rayons (courbes à moins de 500 m).
export function planChecks(cat, al, H, name, dn = 2.5) {
  const C = DCAT[cat] || DCAT.R1, out = [], add = (lvl, msg) => out.push({ lvl: lvlOf[lvl], msg: `${name} (plan, ${C.ref}) : ${msg}` });
  if (C.libre || !al) return out;
  const cv = planCurves(al);
  cv.forEach((c, i) => {
    if (c.R < C.Rm - 1e-6) add('block', `rayon ${fmt(c.R, 0)} m à s = ${fmt(c.s0, 0)} m < Rm = ${fmt(C.Rm, 0)} m.`);
    const need = clothoidNeed(cat, c.R, H, dn);
    if (need > 0 && (c.Lin + 1e-3 < need || c.Lout + 1e-3 < need)) add('block', `clothoïde${c.Lin === 0 && c.Lout === 0 ? ' absente' : ` insuffisante (${fmt(Math.min(c.Lin, c.Lout), 1)} m)`} pour R = ${fmt(c.R, 0)} m à s = ${fmt(c.s0, 0)} m : Lclo ≥ ${fmt(need, 1)} m${c.R < C.Rdn ? ' (le dévers ne peut varier que sur la clothoïde)' : ''}.`);
    const nx = cv[i + 1];
    if (nx && nx.sTS - c.sST < 500 && (c.R < 1.5 * C.Rdn || nx.R < 1.5 * C.Rdn)) {
      const r = c.R / nx.R;
      if (r < 0.67 - 1e-6 || r > 1.5 + 1e-6) add('block', `progressivité des rayons hors 0,67–1,5 entre R = ${fmt(c.R, 0)} m (s = ${fmt(c.s0, 0)} m) et R = ${fmt(nx.R, 0)} m (s = ${fmt(nx.s0, 0)} m) : R/R' = ${fmt(r, 2)}.`);
    }
  });
  return out;
}

// Contrôles du profil en long (BVTrace CheckProfile + coordination) ; PL = buildNodes (segs, curves, gradeAt).
export function profileChecks(cat, PL, al, name, dn = 2.5) {
  const C = DCAT[cat] || DCAT.R1, out = [], add = (lvl, msg) => out.push({ lvl: lvlOf[lvl], msg: `${name} (profil en long, ${C.ref}) : ${msg}` });
  if (C.libre || !PL) return out;
  for (const sg of PL.segs) {
    const g = Math.abs(sg.g) * 100;
    if (g > C.gMax + 1e-6) add(cat === 'R2' && g <= 7 + 1e-6 ? 'justify' : 'block', `déclivité ${fmt(g, 2)} % entre s = ${fmt(sg.s0, 0)} et ${fmt(sg.s1, 0)} m > ${fmt(C.gMax, 0)} %.`);
  }
  for (const c of PL.curves) {
    const crest = c.type === 'convexe', Rmin = crest ? C.Rvs : C.Rvr;
    if (c.R + 1e-3 < Rmin) add('block', crest ? `rayon saillant ${fmt(c.R, 0)} m à s = ${fmt(c.s, 0)} m < Rvs = ${fmt(Rmin, 0)} m (visibilité, guide 2018).` : `rayon rentrant ${fmt(c.R, 0)} m à s = ${fmt(c.s, 0)} m < ${fmt(Rmin, 0)} m.`);
  }
  // Coordination plan / profil (ARP 2022 § 3) : Rv ≥ 6 Rh sous une courbe de rayon < 1 500 m ; pas d'entrée de courbe
  // à moins de 50 m d'un point haut.
  const cv = planCurves(al);
  for (const c of cv) {
    if (c.R >= 1500) continue;
    const mid = c.s0 + c.len / 2, v = PL.curves.find((q) => mid >= q.sA - 1e-6 && mid <= q.sB + 1e-6);
    if (v && v.R + 1e-3 < 6 * c.R) add('block', `coordination : Rv = ${fmt(v.R, 0)} m < 6·Rh = ${fmt(6 * c.R, 0)} m sous la courbe R = ${fmt(c.R, 0)} m (s = ${fmt(c.s0, 0)} m).`);
  }
  for (const q of PL.curves.filter((x) => x.type === 'convexe')) for (const c of cv) {
    if (Math.abs(c.sTS - q.s) <= 50) add('warn', `début de courbe (R = ${fmt(c.R, 0)} m, s = ${fmt(c.sTS, 0)} m) à ${fmt(Math.abs(c.sTS - q.s), 0)} m d'un point haut (s = ${fmt(q.s, 0)} m) : courbe masquée.`);
  }
  // Pente résultante dans la zone où le côté extérieur passe par un dévers nul (≥ 1 % ; 0,5 % avec dispositions).
  if (!C.noSuper) for (const c of cv) {
    if (c.R >= C.Rdn) continue;
    const d = superPct(cat, c.R, dn), f0 = dn / (d + dn);
    for (const [L, s] of [[c.Lin, c.sTS + c.Lin * f0], [c.Lout, c.sST - c.Lout * f0]]) {
      if (!(L > 0)) continue;
      const g = Math.abs(PL.gradeAt(s)) * 100;
      if (g < 1 - 1e-6) add(g < 0.5 ? 'block' : 'warn', `pente résultante ${fmt(g, 2)} % à s = ${fmt(s, 0)} m (dévers nul sur la clothoïde de R = ${fmt(c.R, 0)} m) : ≥ 1 % requis, 0,5 % avec dispositions d'assainissement.`);
    }
  }
  return out;
}

// Contrôles de la plate-forme (largeur de voie, BDD) : alertes.
export function platformChecks(cat, H, name) {
  const C = DCAT[cat] || DCAT.R1, out = [];
  if (C.libre || !H) return out;
  const lane = ['L1', 'L2', 'VSA90', 'VSA110', 'A110'].includes(cat) ? 3.5 : null;
  if (lane && Math.abs(H.wLane - lane) > 0.05) out.push({ lvl: 'warn', msg: `${name} : voie de ${fmt(H.wLane, 2)} m ≠ ${fmt(lane, 2)} m (${C.ref}).` });
  if (!lane && (H.wLane < 3 - 1e-6 || H.wLane > 3.5 + 1e-6)) out.push({ lvl: 'warn', msg: `${name} : voie de ${fmt(H.wLane, 2)} m hors de 3,00–3,50 m (ARP, selon le niveau de fonctions).` });
  const bdd = ['L1', 'L2', 'VSA90', 'VSA110'].includes(cat) ? 2.5 : 2.0;
  if (H.bau + 1e-6 < bdd - 0.25) out.push({ lvl: 'warn', msg: `${name} : ${C.fam === 'ictaal' ? 'BAU' : 'BDD'} de ${fmt(H.bau, 2)} m < ${fmt(bdd, 2)} m typique (${C.ref}).` });
  if (C.dual && !(H.median > 0)) out.push({ lvl: 'warn', msg: `${name} : catégorie ${C.label} à chaussées séparées, bande médiane nulle.` });
  return out;
}
export function catText(cat) { const C = DCAT[cat] || DCAT.R1; return C.libre ? 'conception libre : aucune règle' : `${C.label} — Rm ${fmt(C.Rm, 0)} m, Rdn ${fmt(C.Rdn, 0)} m, pente ≤ ${fmt(C.gMax, 0)} %, Rv saillant ≥ ${fmt(C.Rvs, 0)} m, rentrant ≥ ${fmt(C.Rvr, 0)} m (${C.ref})`; }
