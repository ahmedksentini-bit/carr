// virages.js — signalisation des virages selon le guide SETRA « Comment signaler les virages ? Signalisation
// verticale », guide pratique, juillet 2002 (méthode du rapport d'étude SETRA de mai 2000, reprise par l'IISR, arrêté
// du 8 avril 2002).
//
// Méthode, pour CHAQUE SENS d'un itinéraire (logique d'itinéraire, pas de virage isolé) :
//  - vitesse dans le virage (V85, km/h) : Vv = 102 / (1 + 346 / R^1,5), R = rayon minimal du virage ;
//  - vitesse d'approche (m/s) : Va = √[Vv(−1)² + 2 · (0,8 − g · Pe / 100) · (min(Aldroit, Distagglo) − 75)],
//    Vv(−1) vitesse dans le virage précédent, Pe pente en amont (+ montée, − descente), Aldroit alignement droit amont ;
//    si min(Aldroit, Distagglo) ≤ 75 m, Va = Vv(−1) ; Va et Vv plafonnées à 102 km/h ;
//  - classe d'après Va − Vv :
//      < 8 km/h           aucune signalisation (A1 si la visibilité en approche du virage est mauvaise) ;
//      8 à 16 km/h        balises J1 (et A1 si la visibilité sur le virage est mauvaise) ;
//      16 à 40 km/h       A1 + balises J1 + balise J4 tri-chevrons ;
//      ≥ 40 km/h          A1 + balises J4 monochevrons dans toute la courbe ;
//      classe E           situation exceptionnelle : étude de sécurité.
//  - sur- ou sous-classement après visite (lisibilité, visibilité sur et dans le virage, longueur du virage, accidents) ;
//    critères géométriques calculables signalés ici : rapport R(−1)/R > 1,3 entre virages non isolés (alignement
//    < 500 m), resserrement du rayon dans le virage, longue ligne droite (> 5 km) avant le virage.
// Domaine : routes bidirectionnelles à 2 voies (avec ou sans créneaux de dépassement) ; bretelles et routes à
// chaussées séparées exclues.
// Implantation (IISR, rase campagne) : panneau A1a (virage à droite) / A1b (à gauche) à 150 m en amont du début du
// virage, à droite ; balise J4 tri-chevrons à l'extérieur du virage dans l'axe de la voie d'approche ; balises J1 et
// J4 monochevrons sur le bord extérieur de la courbe (espacements indicatifs, à régler sur place).

const G9 = 9.8;
export const VMAX = 102;
/** Vitesse dans le virage (km/h). */
export const vVirage = (R) => (R > 0 ? Math.min(VMAX, 102 / (1 + 346 / Math.pow(R, 1.5))) : VMAX);
/** Vitesse d'approche (km/h) depuis la vitesse du virage précédent (km/h), pente amont (%), alignement et agglo (m). */
export function vApproche(vPrevKmh, pentePct, aldroit, distAgglo = Infinity) {
  const L = Math.min(aldroit, distAgglo);
  if (!(L > 75)) return Math.min(VMAX, vPrevKmh);
  const v = vPrevKmh / 3.6, a = 0.8 - (G9 * (pentePct || 0)) / 100;
  return Math.min(VMAX, Math.sqrt(Math.max(0, v * v + 2 * a * (L - 75))) * 3.6);
}
/** Classe et signalisation théorique d'après Va − Vv (km/h). */
export function classeVirage(dv) {
  if (dv < 8) return { cls: '0', text: 'aucune signalisation (A1 si la visibilité en approche est mauvaise)', A1: false, J1: false, J4: false, mono: false };
  if (dv < 16) return { cls: 'A', text: 'balises J1 (et A1 si la visibilité sur le virage est mauvaise)', A1: false, J1: true, J4: false, mono: false };
  if (dv < 40) return { cls: 'B', text: 'A1 + balises J1 + balise J4 tri-chevrons', A1: true, J1: true, J4: true, mono: false };
  return { cls: 'C', text: 'A1 + balises J4 monochevrons dans toute la courbe', A1: true, J1: false, J4: false, mono: true };
}

// Virages d'un axe : éléments courbes consécutifs (clothoïde – arc – clothoïde) ; rayon minimal, sens (+1 gauche).
function curvesOf(ax) {
  const els = (ax.al?.elems || []).filter((e) => e.len > 1e-6), out = [];
  for (let i = 0; i < els.length; i++) {
    if (els[i].kind === 'L') continue;
    // éléments courbes consécutifs d'un même sommet (les clothoïdes n'ont pas toujours le n° du sommet : on compare au
    // premier n° connu du groupe)
    const g = [els[i]]; let gpi = els[i].pi ?? null;
    while (i + 1 < els.length && els[i + 1].kind !== 'L' && (els[i + 1].pi == null || gpi == null || els[i + 1].pi === gpi)) { g.push(els[++i]); gpi = gpi ?? els[i].pi ?? null; }
    let km = 0, sm = g[0].s0;
    const ks = [];
    for (const e of g) for (let k = 0; k <= 4; k++) { const t = (e.len * k) / 4, kk = e.curvAt(t); ks.push([e.s0 + t, Math.abs(kk)]); if (Math.abs(kk) > Math.abs(km)) { km = kk; sm = e.s0 + t; } }
    if (Math.abs(km) < 1e-6) continue;
    out.push({ s0: g[0].s0, s1: g.at(-1).s0 + g.at(-1).len, R: 1 / Math.abs(km), sg: Math.sign(km), sm, ks });
  }
  return out;
}
// Axe bidirectionnel à 2 voies (domaine de la méthode) ?
function inDomain(ax) {
  if (!/^(hwy|x:)/.test(ax.key)) return { ok: false, why: 'bretelle ou branche (hors domaine)' };
  const H = ax.H || {};
  if (H.kind && H.kind !== 'route') return { ok: false, why: 'autoroute (hors domaine)' };
  if ((+H.median || 0) > 0 || (+H.lanes || 1) > 1) return { ok: false, why: 'chaussées séparées ou plus d\'une voie par sens (hors domaine)' };
  return { ok: true };
}

/**
 * Virages à signaler sur les axes, dans les deux sens.
 * @param {object[]} axes  axes (profils.js : key, name, len, at, al, H, half)
 * @param {object} o { grade(key, s) → pente (fraction, sens des s croissants) | null, agglo(key, s, dir) → distance (m) | Infinity, pk0(key) }
 * @returns {{ rows: object[], signs: object[], skipped: object[] }}
 */
export function curveSignage(axes, o = {}) {
  const rows = [], signs = [], skipped = [];
  for (const ax of axes) {
    const dom = inDomain(ax);
    const cs = curvesOf(ax);
    if (!cs.length) continue;
    if (!dom.ok) { skipped.push({ axis: ax.name, why: dom.why }); continue; }
    const half = ax.half || 3.5, pk0 = o.pk0?.(ax.key) || 0;
    for (const dir of [1, -1]) {
      const list = dir > 0 ? cs : [...cs].reverse();
      let vPrev = VMAX, endPrev = dir > 0 ? 0 : ax.len, Rprev = null;
      list.forEach((c, i) => {
        const sIn = dir > 0 ? c.s0 : c.s1, sOut = dir > 0 ? c.s1 : c.s0;
        const ald = Math.max(0, (sIn - endPrev) * dir);
        const g = o.grade?.(ax.key, sIn - dir * Math.min(100, ald / 2));
        const pe = g == null ? 0 : g * 100 * dir; // pente dans le sens de circulation (+ montée)
        const dAgg = o.agglo?.(ax.key, sIn, dir) ?? Infinity;
        const vv = vVirage(c.R), va = vApproche(vPrev, pe, ald, dAgg), dv = va - vv, K = classeVirage(dv);
        const left = c.sg * dir > 0; // virage à gauche dans ce sens
        const flags = [];
        if (Rprev && ald < 500 && Rprev / c.R > 1.3) flags.push(`R(−1)/R = ${(Rprev / c.R).toFixed(2)} > 1,3 : virage plus serré que le précédent (surclassement à examiner)`);
        // resserrement : courbure qui croît encore après le milieu du virage, dans le sens de circulation
        const ks = dir > 0 ? c.ks : [...c.ks].reverse(), kMid = ks[Math.floor(ks.length / 2)]?.[1] || 0, kMaxOut = Math.max(...ks.slice(Math.floor(ks.length / 2) + 1).map((q) => q[1]), 0);
        if (kMaxOut > kMid * 1.3 + 1e-9) flags.push('resserrement du rayon dans le virage (très accidentogène : reprise du tracé à étudier)');
        if (ald > 5000) flags.push('longue ligne droite (> 5 km) avant le virage : surclassement à examiner');
        if (dv >= 40 && c.R < 40) flags.push('classe E possible (situation exceptionnelle) : étude de sécurité');
        const row = { axis: ax.name, key: ax.key, dir, sens: dir > 0 ? 'sens des PK croissants' : 'sens des PK décroissants', n: i + 1, s0: Math.min(sIn, sOut), s1: Math.max(sIn, sOut), pkIn: pk0 + sIn, R: c.R, left, ald, pe, vPrev, vv, va, dv, ...K, flags, len: c.s1 - c.s0 };
        rows.push(row);
        // implantation : côté droit du sens de circulation (+ : gauche de l'axe si dir < 0)
        const put = (code, s, side, note, extra = {}) => { // side : +1 droite du sens, −1 gauche du sens
          const q = ax.at(Math.max(0, Math.min(ax.len, s))), t = { x: q.t.x * dir, y: q.t.y * dir }, nr = { x: t.y, y: -t.x };
          const off = half + 1.5, p = { x: q.p.x + nr.x * side * off, y: q.p.y + nr.y * side * off };
          signs.push({ code, axis: ax.name, key: ax.key, dir, s, p, out: { x: nr.x * side, y: nr.y * side }, face: { x: -t.x, y: -t.y }, note, row, ...extra });
        };
        const outer = left ? 1 : -1; // extérieur du virage : à droite pour un virage à gauche
        if (K.A1) put(left ? 'A1b' : 'A1a', sIn - dir * 150, 1, `annonce du virage (150 m en amont, rase campagne) — classe ${K.cls}`);
        if (K.J4) { // tri-chevrons : extérieur du virage, dans le prolongement de la voie d'approche
          const q0 = ax.at(sIn), t0 = { x: q0.t.x * dir, y: q0.t.y * dir };
          let sJ = (sIn + sOut) / 2;
          for (let k = 1; k <= 40; k++) { const s = sIn + ((sOut - sIn) * k) / 40, q = ax.at(s), d = (q.p.x - q0.p.x) * t0.y - (q.p.y - q0.p.y) * t0.x; if (Math.abs(d) * 1 > half) { sJ = s; break; } }
          put('J4', sJ, outer, `balise J4 tri-chevrons dans l'axe de la voie d'approche — classe ${K.cls}`);
        }
        if (K.J1 || K.mono) { // balises le long du bord extérieur
          const e = Math.max(8, Math.min(40, c.R / 5)), n = Math.max(3, Math.round(Math.abs(sOut - sIn) / e) + 1);
          for (let k = 0; k < n; k++) put(K.mono ? 'J4m' : 'J1', sIn + ((sOut - sIn) * k) / (n - 1), outer, K.mono ? `J4 monochevron (espacement ≈ ${Math.round(e)} m, indicatif)` : `balise J1 (espacement ≈ ${Math.round(e)} m, indicatif)`, { small: true });
        }
        vPrev = vv; endPrev = sOut; Rprev = c.R;
      });
    }
  }
  return { rows, signs, skipped };
}
