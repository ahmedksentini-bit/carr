// dims.js — cotations de type DAO : cotes alignées (lignes d'attache, traits obliques, texte au-dessus de la
// ligne de cote), chaînes de cotes et cotes de rayon (flèche sur l'arc, ligne de rappel, texte au bout).
import * as G from './geom.js';
import { fmt, upright } from './common.js';

const { add, sub, mul, norm, rot90, ang, L } = G;

// P : fonction qui enregistre une primitive ; TH : hauteur de texte (m).
export function makeDims(P, TH, layer = 'COTATION') {
  const text = (p, s, rot, h = TH, align = 'center') => P({ k: 'text', L: layer, p, s, rot: upright(rot), align, h });
  const textW = (s, h) => 0.58 * h * String(s).length; // largeur approchée d'un texte

  // Cote alignée entre a et b, ligne de cote décalée de `off` (vers la gauche de a→b si off > 0).
  // shift : décalage du texte le long de la cote (pour les petites cotes d'une chaîne).
  function aligned(a, b, off, label, { h = TH * 0.8, side = 1, shift = 0 } = {}) {
    const d = norm(sub(b, a)), n = rot90(d), o = mul(n, off);
    const a2 = add(a, o), b2 = add(b, o);
    if (Math.abs(off) > 1e-3) {
      const over = mul(n, Math.sign(off) * 0.35 * TH), gap = mul(n, Math.sign(off) * 0.25 * TH);
      P({ k: 'path', L: layer, segs: [L(add(a, gap), add(a2, over)), L(add(b, gap), add(b2, over))] });
    }
    P({ k: 'path', L: layer, segs: [L(add(a2, mul(d, -0.5 * TH)), add(b2, mul(d, 0.5 * TH)))] });
    const t = mul(norm(add(d, n)), 0.4 * TH);
    for (const p of [a2, b2]) P({ k: 'path', L: layer, segs: [L(sub(p, t), add(p, t))] });
    const m = add(G.lerp(a2, b2, 0.5), mul(d, shift));
    text(add(m, mul(n, side * 0.7 * h)), label ?? fmt(G.dist(a, b), 2), ang(d), h);
  }

  // Chaîne de cotes entre points alignés ; quand le texte ne tient pas, il passe de l'autre côté
  // de la ligne de cote, puis est décalé le long de la chaîne.
  function chain(pts, off, labels, { h = TH * 0.75 } = {}) {
    let flip = 1;
    for (let i = 0; i + 1 < pts.length; i++) {
      const l = G.dist(pts[i], pts[i + 1]);
      if (l < 1e-3) continue;
      const lab = labels[i], small = textW(lab, h) > l * 0.95;
      if (small) flip = -flip; else flip = 1;
      const shift = small && flip > 0 ? Math.min(textW(lab, h), 2.5) * (i % 2 ? 1 : -1) : 0;
      aligned(pts[i], pts[i + 1], off, lab, { h, side: small ? flip : 1, shift });
    }
  }

  // Cote de rayon : flèche au point p de l'arc, ligne de rappel dans la direction dir, texte dans son prolongement.
  function radius(p, dir, label, { len = 2.5 * TH, h = TH * 0.8 } = {}) {
    const e = add(p, mul(dir, len));
    P({ k: 'path', L: layer, segs: [L(e, p)], arrow: true });
    text(add(e, mul(dir, textW(label, h) / 2 + 0.3 * h)), label, ang(dir), h);
  }

  // Rayon d'un cercle de centre c : trait du centre au cercle, flèche sur le cercle, texte le long du trait.
  function radial(c, r, phi, label, { h = TH * 0.85 } = {}) {
    const e = G.polar(c, r, phi), d = G.unit(phi);
    P({ k: 'path', L: layer, segs: [L(c, e)], arrow: true });
    text(add(G.lerp(c, e, 0.55), mul(rot90(d), 0.7 * h)), label, phi, h);
  }

  return { aligned, chain, radius, radial, text };
}
