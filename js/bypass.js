// bypass.js — voie directe de tourne-à-droite (by-pass) d'une branche k vers la branche suivante j du giratoire.
// Rayon donné en axe de la chaussée de la voie directe ; rives peintes à ± w/2, bords de chaussée à la BDD
// (intérieur de la courbe) et à la BDG (côté îlot). ACI : rive intérieure de rayon ≥ 40 m (de préférence < 75 m),
// îlot de séparation le long du giratoire, biseau de décélération de 80 m, insertion de 70 m + biseau de 70 m.
import * as G from './geom.js';
import { frame } from './common.js';

const { sub, ang, L, A } = G;

// Longueurs ACI (interurbain) ; en urbain, longueurs réduites (valeurs usuelles, non tirées du guide).
export const BYPASS = { sep: 2, decel: 80, ins: 70, taper: 70, straight: 10 };
export const BYPASS_URBAIN = { sep: 1.5, decel: 20, ins: 15, taper: 15, straight: 5 };

// Partie d'un chemin local (parcouru des x décroissants) située en deçà de x = xc ; null si le chemin ne franchit pas xc.
function cutBelowX(segs, xc) {
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i], p = G.segStart(s), q = G.segEnd(s);
    if ((p.x - xc) * (q.x - xc) > 0) continue;
    let lo = 0, hi = 1;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if ((G.segAt(s, m).x - xc) * (p.x - xc) > 0) lo = m; else hi = m; }
    const P = G.segAt(s, (lo + hi) / 2);
    const head = s.t === 'L' ? L(P, s.b) : A(s.c, s.r, ang(sub(P, s.c)), s.ea, s.ccw);
    return { P, segs: [head, ...segs.slice(i + 1)] };
  }
  return null;
}

// bk, bj : branches construites (roundabout.js) ; ringArc : bord de chaussée de l'anneau entre l'entrée de k et la
// sortie de j ; o : { R (rayon en axe), w (largeur de chaussée), bdg, bdd, bddBr (BDD des branches), urbain }.
// Retourne la géométrie en coordonnées monde, { needK, needJ } si les branches sont trop courtes, ou { error }.
export function buildBypass(D, bk, bj, ringArc, o) {
  const B = o.urbain ? BYPASS_URBAIN : BYPASS, O = D.O, w2 = o.w / 2;
  const fk = frame(O, bk.u), fj = frame(O, bj.u);
  const yk0 = bk.a + bk.th + bk.entry.wa, yj0 = bj.a - (bj.th + bj.exit.wa); // rives des chaussées d'approche
  const ek = yk0 + o.bddBr, ej = yj0 - o.bddBr;                              // bords de chaussée
  const yAc = ek + B.sep + o.bdg + w2, yBc = ej - (B.sep + o.bdg + w2);       // axes de la voie directe
  const Rc = o.R;
  const V = G.lineLine(fk.W({ x: 0, y: yAc }), bk.u, fj.W({ x: 0, y: yBc }), bj.u);
  if (!V) return { error: 'branches parallèles' };
  const f = G.filletCorner(fk.W({ x: 1e4, y: yAc }), V.p, fj.W({ x: 1e4, y: yBc }), Rc, 1, 1);
  if (!f || f.ccw) return { error: 'géométrie impossible (angle entre les branches)' };
  if (Rc - w2 - o.bdd <= 0.5) return { error: 'rayon trop petit pour la largeur de chaussée' };
  const t1x = fk.toL(f.T1).x, t2x = fj.toL(f.T2).x;
  const xDiv = Math.max(t1x + B.straight, bk.xT + B.straight), xMrg = Math.max(t2x + B.straight, bj.xT + B.straight);
  const needK = xDiv + B.straight + B.decel + 15, needJ = xMrg + B.straight + B.ins + B.taper + 15;
  if (t1x < bk.x0 + 2 || t2x < bj.x0 + 2) return { error: 'la courbe recoupe l\'anneau : augmenter le rayon ou allonger les branches', needK, needJ };
  if (bk.xEnd < needK || bj.xEnd < needJ) return { needK, needJ };

  const arcR = (r) => A(f.C, r, ang(sub(f.T1, f.C)), ang(sub(f.T2, f.C)), false);
  const yRk = yAc + w2 + o.bdd, yLk = yAc - w2 - o.bdg;
  const yRj = yBc - w2 - o.bdd, yLj = yBc + w2 + o.bdg;
  const round = (pts) => G.roundPolyline(pts, pts.map((_, i) => (i > 0 && i < pts.length - 1 ? 60 : 0)));

  // Bord de chaussée côté intérieur de la courbe (opposé à l'anneau), de la fin de l'alignement droit de k à celle de j.
  // Le long des voies de décélération et d'insertion, la voie directe est accolée à la voie de la branche.
  const right = [
    ...round([
      fk.W({ x: bk.xEnd, y: ek }), fk.W({ x: xDiv + B.straight + B.decel, y: ek }),
      fk.W({ x: xDiv + B.straight, y: yk0 + o.w + o.bdd }), fk.W({ x: xDiv, y: yRk }), fk.W({ x: t1x, y: yRk }),
    ]),
    arcR(Rc - w2 - o.bdd),
    ...round([
      fj.W({ x: t2x, y: yRj }), fj.W({ x: xMrg, y: yRj }), fj.W({ x: xMrg + B.straight, y: yj0 - o.w - o.bdd }),
      fj.W({ x: xMrg + B.straight + B.ins, y: yj0 - o.w - o.bdd }), fj.W({ x: xMrg + B.straight + B.ins + B.taper, y: ej }),
      fj.W({ x: bj.xEnd, y: ej }),
    ]),
  ];
  // Bord de chaussée côté îlot de séparation, de k vers j.
  const left = [L(fk.W({ x: xDiv, y: yLk }), fk.W({ x: t1x, y: yLk })), arcR(Rc + w2 + o.bdg), L(fj.W({ x: t2x, y: yLj }), fj.W({ x: xMrg, y: yLj }))];

  // Îlot de séparation entre les bords de chaussée du giratoire (raccourcis au nez) et la voie directe.
  const ck = cutBelowX(bk.entry.edge, xDiv), cj = cutBelowX(bj.exit.edge, xMrg);
  if (!ck || !cj) return { error: 'bords de chaussée d\'entrée / sortie trop courts', needK, needJ };
  const entryCut = fk.Wp(ck.segs), exitCut = fj.Wp(cj.segs);
  const noseK = fk.W(ck.P), noseJ = fj.W(cj.P);
  const island = [
    ...entryCut, ...(ringArc ? [ringArc] : []), ...G.revPath(exitCut),
    L(noseJ, G.segEnd(left[left.length - 1])), ...G.revPath(left), L(G.segStart(left[0]), noseK),
  ];
  const rive = [
    [L(fk.W({ x: xDiv, y: yAc + w2 }), fk.W({ x: t1x, y: yAc + w2 })), arcR(Rc - w2), L(fj.W({ x: t2x, y: yBc - w2 }), fj.W({ x: xMrg, y: yBc - w2 }))],
    [L(fk.W({ x: xDiv, y: yAc - w2 }), fk.W({ x: t1x, y: yAc - w2 })), arcR(Rc + w2), L(fj.W({ x: t2x, y: yBc + w2 }), fj.W({ x: xMrg, y: yBc + w2 }))],
  ];
  const dashes = [
    [L(fk.W({ x: xDiv, y: yk0 }), fk.W({ x: xDiv + B.straight + B.decel, y: yk0 }))],
    [L(fj.W({ x: xMrg, y: yj0 }), fj.W({ x: xMrg + B.straight + B.ins + B.taper, y: yj0 }))],
  ];
  const axis = [L(fk.W({ x: xDiv, y: yAc }), f.T1), f.arc, L(f.T2, fj.W({ x: xMrg, y: yBc }))];
  return {
    right, left, island, entryCut, exitCut, rive, dashes, axis, noseK, noseJ, needK, needJ,
    C: f.C, T1: f.T1, T2: f.T2, Rc, w: o.w, rin: Rc - w2, arc: f.arc,
  };
}
