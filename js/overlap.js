// overlap.js — contrôle des chaussées qui se chevauchent hors ouvrage.
//
// Deux plates-formes (chaussée et accotements revêtus) ne peuvent se superposer qu'au droit d'un ouvrage (franchissement
// dénivelé). Sont exclus : une bretelle et la chaussée qui la porte au voisinage de son raccordement (divergent,
// convergent, voie d'insertion), les deux voies d'une trompette (S-semi et boucle, séparées par leur terre-plein), et
// les abords des giratoires (branches) et les extrémités voisines de deux bretelles (même carrefour plan). Méthode : l'axe de chaque bretelle est échantillonné tous les 2 m ; un point est
// en conflit si sa distance à l'axe d'un autre élément est inférieure à la somme des demi-plates-formes (moins 0,30 m de
// tolérance) et s'il n'est dans aucun tablier d'ouvrage.
import * as G from './geom.js';
import { fmt } from './common.js';

const inPoly = (p, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};
const bbox = (pts, m = 0) => { const b = G.bboxOf(pts); return { x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m }; };
const hit = (a, b) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;

export function chausseeOverlaps(prj, D, { decks = [], juncs = [] } = {}) {
  const issues = [];
  if (!D?.hwy?.ok) return issues;
  const els = [];
  // routes : autoroute et voies secondaires (partie dessinée)
  els.push({ id: 'hwy', name: D.hwy.H?.name || 'Autoroute', pts: G.samplePath(D.hwy.path, 2), half: D.hwy.E2, road: true });
  (D.crosses || []).forEach((c, k) => {
    if (!c?.ok) return;
    const [a, b] = c.drawn || [0, c.sEnd];
    if (b - a < 5) return;
    const pts = G.samplePath(c.path, 2).filter((p, i, arr) => { const s = (i / Math.max(1, arr.length - 1)) * c.sEnd; return s >= a - 1 && s <= b + 1; });
    els.push({ id: `cross${k}`, refs: [`x${k ? k + ':' : ''}1`, `x${k ? k + ':' : ''}2`], name: c.H?.name || `Voie secondaire ${k + 1}`, pts, half: c.E2, road: true });
  });
  // bretelles
  (prj.ramps || []).forEach((r, i) => {
    const R = D.ramps?.[i];
    if (!R?.al?.path || !(R.al.length > 5)) return;
    const pts = G.samplePath(R.al.path, 2), Ls = [0];
    for (let k = 1; k < pts.length; k++) Ls.push(Ls[k - 1] + G.dist(pts[k - 1], pts[k]));
    els.push({ id: r.id, r, name: r.name, pts, Ls, L: Ls[Ls.length - 1], half: (R.rp?.w || 3.5) / 2 + Math.max(R.rp?.bdd ?? 1, R.rp?.bdg ?? 0.5), grp: r.grp, ramp: true });
  });
  for (const e of els) e.bb = bbox(e.pts, e.half + 5);
  const nearJ = (p) => juncs.some((j) => G.dist(p, j.O) < j.Rg + 75);
  const inDeck = (p) => decks.some((d) => inPoly(p, d));
  const hostRefs = (a) => [a.r?.from?.ref, a.r?.to?.ref].filter(Boolean);
  const linked = (a, b) => {
    if (a.grp && a.grp === b.grp) return true;
    const refs = hostRefs(a), refsB = hostRefs(b);
    if (b.id === 'hwy' && refs.some((x) => /^hwy[12]$/.test(x))) return 'end';
    if (b.refs && refs.some((x) => b.refs.includes(x))) return 'end';
    if (refs.includes(b.id) || refsB.includes(a.id)) return 'end';
    return false;
  };
  const seen = new Set();
  for (const a of els.filter((e) => e.ramp)) {
    for (const b of els) {
      if (a === b || !hit(a.bb, b.bb)) continue;
      const key = [a.id, b.id].sort().join('|');
      if (b.ramp && seen.has(key)) continue;
      const lk = linked(a, b), lkB = b.ramp ? linked(b, a) : false;
      if (lk === true || lkB === true) continue;
      const lim = a.half + b.half - 0.3;
      // extrémités communes (deux bretelles aboutissant au même carrefour plan) : zone de jonction, non contrôlée
      const shared = [];
      if (b.ramp) for (const [ia, sa] of [[0, 0], [a.pts.length - 1, a.L]]) for (const ib of [0, b.pts.length - 1]) if (G.dist(a.pts[ia], b.pts[ib]) < 80) shared.push(sa);
      let run = 0, worst = null, total = 0;
      const flush = () => { if (run >= 3) total += run; run = 0; };
      for (let k = 0; k < a.pts.length; k++) {
        const p = a.pts[k];
        // zone de raccordement d'une bretelle à sa chaussée hôte (biseau, Lm, insertion, voie parallèle)
        if ((lk === 'end' || lkB === 'end') && (a.Ls[k] < 450 || a.L - a.Ls[k] < 450)) { flush(); continue; }
        if (shared.some((s0) => Math.abs(a.Ls[k] - s0) < 200)) { flush(); continue; }
        let d = Infinity;
        for (const q of b.pts) { const e = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (e < d) d = e; }
        d = Math.sqrt(d);
        if (d < lim && !nearJ(p) && !inDeck(p)) { run++; if (!worst || d < worst.d) worst = { d, p }; } else flush();
      }
      flush();
      if (b.ramp) seen.add(key);
      if (total >= 3 && worst) issues.push({ lvl: 'err', msg: `${a.name} et ${b.name} : chaussées superposées sur ${fmt(total * 2, 0)} m hors ouvrage (axes à ${fmt(worst.d)} m pour ${fmt(a.half + b.half)} m de demi-plates-formes) — deux chaussées ne se croisent qu'au droit d'un ouvrage.`, p: worst.p });
    }
  }
  return issues;
}
