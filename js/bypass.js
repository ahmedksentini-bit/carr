// bypass.js — voie directe de tourne-à-droite (by-pass) d'une branche k vers la branche suivante j du giratoire.
// ACI : voie de 4 m, bandes dérasées 2,00 m à droite et 0,50 m à gauche, rayon de la rive intérieure ≥ 40 m
// (de préférence < 75 m), séparée de l'anneau par un îlot ; décélération par un biseau ≥ 80 m, réinsertion par
// une voie d'insertion de 70 m suivie d'un biseau de 70 m.
import * as G from './geom.js';
import { frame } from './common.js';

const { add, sub, mul, ang, L, A } = G;

export const BYPASS = { lane: 4, bdd: 2, bdg: 0.5, sep: 2, rin: 40, decel: 80, ins: 70, taper: 70, straight: 10 };

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

// bk, bj : branches construites (roundabout.js) ; ringArc : arc de l'anneau entre l'entrée de k et la sortie de j.
// Retourne la géométrie en coordonnées monde, ou { error }.
export function buildBypass(D, bk, bj, ringArc) {
  const B = BYPASS, O = D.O;
  const fk = frame(O, bk.u), fj = frame(O, bj.u);
  const yk0 = bk.a + bk.th + bk.entry.wa;  // bord de la chaussée d'approche de k (côté entrée)
  const yj0 = bj.a - (bj.th + bj.exit.wa); // bord de la chaussée de j (côté sortie)
  const off = B.sep + B.bdg + B.lane / 2;
  const yAc = yk0 + off, yBc = yj0 - off;  // axes de la voie directe le long de k et de j
  const Rc = B.rin + B.lane / 2;
  const V = G.lineLine(fk.W({ x: 0, y: yAc }), bk.u, fj.W({ x: 0, y: yBc }), bj.u);
  if (!V) return { error: 'branches parallèles' };
  const f = G.filletCorner(fk.W({ x: 1e4, y: yAc }), V.p, fj.W({ x: 1e4, y: yBc }), Rc, 1, 1);
  if (!f || f.ccw) return { error: 'géométrie impossible (angle entre les branches)' };
  const t1x = fk.toL(f.T1).x, t2x = fj.toL(f.T2).x;
  const xDiv = Math.max(t1x + B.straight, bk.xT + B.straight), xMrg = Math.max(t2x + B.straight, bj.xT + B.straight);
  const needK = xDiv + B.straight + B.decel + 15, needJ = xMrg + B.straight + B.ins + B.taper + 15;
  if (t1x < bk.x0 + 2 || t2x < bj.x0 + 2) return { error: 'la courbe recoupe l\'anneau : augmenter le rayon ou allonger les branches', needK, needJ };
  if (bk.xEnd < needK || bj.xEnd < needJ) return { needK, needJ };

  const arcR = (r) => A(f.C, r, ang(sub(f.T1, f.C)), ang(sub(f.T2, f.C)), false);
  const yRk = yAc + B.lane / 2 + B.bdd, yLk = yAc - B.lane / 2 - B.bdg;
  const yRj = yBc - B.lane / 2 - B.bdd, yLj = yBc + B.lane / 2 + B.bdg;
  const round = (pts) => G.roundPolyline(pts, pts.map((_, i) => (i > 0 && i < pts.length - 1 ? 60 : 0)));

  // Bord droit (côté extérieur, opposé à l'anneau) : de l'extrémité de k à l'extrémité de j.
  const rightK = round([
    fk.W({ x: bk.xEnd, y: yk0 }), fk.W({ x: xDiv + B.straight + B.decel, y: yk0 }),
    fk.W({ x: xDiv + B.straight, y: yk0 + B.lane + B.bdd }), fk.W({ x: xDiv, y: yRk }), fk.W({ x: t1x, y: yRk }),
  ]);
  const rightJ = round([
    fj.W({ x: t2x, y: yRj }), fj.W({ x: xMrg, y: yRj }), fj.W({ x: xMrg + B.straight, y: yj0 - B.lane - B.bdd }),
    fj.W({ x: xMrg + B.straight + B.ins, y: yj0 - B.lane - B.bdd }), fj.W({ x: xMrg + B.straight + B.ins + B.taper, y: yj0 }),
    fj.W({ x: bj.xEnd, y: yj0 }),
  ]);
  const right = [...rightK, arcR(Rc - B.lane / 2 - B.bdd), ...rightJ];
  // Bord gauche (côté îlot de séparation), de k vers j.
  const left = [L(fk.W({ x: xDiv, y: yLk }), fk.W({ x: t1x, y: yLk })), arcR(Rc + B.lane / 2 + B.bdg), L(fj.W({ x: t2x, y: yLj }), fj.W({ x: xMrg, y: yLj }))];

  // Bordures existantes raccourcies : l'îlot de séparation commence au nez (x = xDiv sur k, x = xMrg sur j).
  const ck = cutBelowX(bk.entry.curb, xDiv), cj = cutBelowX(bj.exit.curb, xMrg);
  if (!ck || !cj) return { error: 'bordures d\'entrée / sortie trop courtes', needK, needJ };
  const entryCut = fk.Wp(ck.segs), exitCut = fj.Wp(cj.segs);
  const noseK = fk.W(ck.P), noseJ = fj.W(cj.P);
  const island = [
    ...entryCut, ...(ringArc ? [ringArc] : []), ...G.revPath(exitCut),
    L(noseJ, G.segEnd(left[left.length - 1])), ...G.revPath(left), L(G.segStart(left[0]), noseK),
  ];
  const rive = [
    [L(fk.W({ x: xDiv, y: yAc + B.lane / 2 }), fk.W({ x: t1x, y: yAc + B.lane / 2 })), arcR(Rc - B.lane / 2), L(fj.W({ x: t2x, y: yBc - B.lane / 2 }), fj.W({ x: xMrg, y: yBc - B.lane / 2 }))],
    [L(fk.W({ x: xDiv, y: yAc - B.lane / 2 }), fk.W({ x: t1x, y: yAc - B.lane / 2 })), arcR(Rc + B.lane / 2), L(fj.W({ x: t2x, y: yBc + B.lane / 2 }), fj.W({ x: xMrg, y: yBc + B.lane / 2 }))],
  ];
  const dashes = [
    [L(fk.W({ x: xDiv, y: yk0 }), fk.W({ x: xDiv + B.straight + B.decel, y: yk0 }))],
    [L(fj.W({ x: xMrg, y: yj0 }), fj.W({ x: xMrg + B.straight + B.ins + B.taper, y: yj0 }))],
  ];
  const axis = [L(fk.W({ x: xDiv, y: yAc }), f.T1), f.arc, L(f.T2, fj.W({ x: xMrg, y: yBc }))];
  return {
    right, left, island, entryCut, exitCut, rive, dashes, axis, noseK, noseJ, needK, needJ,
    C: f.C, T1: f.T1, T2: f.T2, Rc, rin: B.rin, labelAt: G.segAt(f.arc, 0.5),
  };
}
