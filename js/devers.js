// devers.js — modèle altimétrique simplifié (niveau avant-projet) et plan de variation des dévers.
// Terrain : plan de déclivité p (%) dont la ligne de plus grande pente descend suivant le gisement G ;
//           il passe par la cote zC au centre du giratoire.
// Anneau, mode « aci » (par défaut) : le bord extérieur (Rg) suit le plan, le dévers d (%) vers l'extérieur
//           est constant tout autour (« aucune pente n'est ajoutée au dévers normal » sur assiette inclinée).
// Anneau, mode « cone » : cône de dévers d posé sur le plan incliné ; le dévers radial varie de d − p à d + p.
// Branche : profil en long rectiligne de pente i (%) à partir du bord de l'anneau ; dévers de chaque voie
//           variant linéairement, sur la longueur de transition, de la valeur imposée par l'anneau au bord
//           extérieur jusqu'au dévers courant de la section (toit).
import * as G from './geom.js';

const { sub, dot, mul, add, polar } = G;

export const gisVec = (gon) => { const t = (gon * Math.PI) / 200; return { x: Math.sin(t), y: Math.cos(t) }; };
const pct = (v) => (v * 100).toFixed(1).replace('.', ',') + ' %';
const upright = (r) => { r = G.normAng(r); return r > Math.PI / 2 && r <= 1.5 * Math.PI ? r - Math.PI : r; };

export function addDevers(prj, D) {
  const r = prj.ring, O = D.O;
  const p = (+r.pente || 0) / 100, d = (+r.devers || 0) / 100;
  const g = gisVec(+r.gisPente || 0);
  const zC = +r.zC || 0;
  const mode = r.mode === 'cone' ? 'cone' : 'aci';
  const zPlane = (P) => zC - p * dot(sub(P, O), g);
  const zRing = (P) => {
    const rr = G.dist(P, O);
    if (mode === 'cone') return zPlane(P) - d * Math.max(0, rr - D.Ri);
    if (rr >= D.Rg) return zPlane(P);
    // Îlot central : surface interpolée, raccordée à la rive intérieure (zC + d·la au centre).
    if (rr <= D.Ri) return zC - p * dot(sub(P, O), g) * (D.Rg / D.Ri) + d * (D.Rg - D.Ri);
    return zC - p * D.Rg * dot(mul(sub(P, O), 1 / rr), g) + d * (D.Rg - rr);
  };
  // Dévers radial descendant vers l'extérieur, à l'azimut trigonométrique phi.
  const radial = (phi) => (mode === 'cone' ? d + p * dot(G.unit(phi), g) : d);
  const TH = +prj.opts?.textH || 0.8;

  // Dévers radial le long de l'anneau
  let mn = Infinity, mx = -Infinity, phiMin = 0;
  for (let k = 0; k < 360; k++) {
    const v = radial((k * Math.PI) / 180);
    if (v < mn) { mn = v; phiMin = (k * Math.PI) / 180; }
    if (v > mx) mx = v;
  }
  D.devers = { p, d, g, zC, mode, minRadial: mn, maxRadial: mx, maxTransverse: Math.max(Math.abs(mn), Math.abs(mx)), phiMin, branches: [] };
  D.zRing = zRing;

  // Profil en long de l'anneau (bords extérieur et intérieur) par gisement.
  D.ringProfile = [];
  for (let k = 0; k <= 72; k++) {
    const gon = (k * 400) / 72, t = Math.PI / 2 - (gon * Math.PI) / 200;
    D.ringProfile.push({ gon, zExt: zRing(polar(O, D.Rg, t)), zInt: zRing(polar(O, D.Ri, t)), rad: radial(t) });
  }

  const P = (o) => D.prims.push(o);
  const arrow = (pt, dir, len, label, h = TH * 0.8) => P({ k: 'arrow', L: 'DEVERS', p: pt, dir, len, text: label, h, rot: upright(G.ang(dir)) });

  // Flèches de dévers sur l'anneau (évite les embouchures des branches).
  const rm = (D.Rg + D.Ri) / 2;
  for (let k = 0; k < 12; k++) {
    const phi = (k * Math.PI) / 6 + Math.PI / 12;
    const v = radial(phi);
    const e = G.unit(phi);
    const dir = v >= 0 ? e : G.neg(e);
    arrow(G.add(polar(O, rm, phi), mul(dir, -1.2)), dir, 2.4, pct(Math.abs(v)));
  }
  if (p > 0) {
    arrow(G.add(O, mul(g, -D.Rb * 0.35)), g, D.Rb * 0.7, `plan p = ${pct(p)}`, TH);
  }

  // Branches
  for (const bd of D.branches) {
    const b = prj.branches[bd.idx];
    const grade = b.pente !== '' && b.pente != null && isFinite(+b.pente) ? +b.pente / 100 : -p * dot(bd.u, g);
    const z0 = zRing(bd.W({ x: bd.x0, y: bd.a }));
    const camber = -(+b.camber || 2.5) / 100;
    const Ltr = b.transition !== '' && b.transition != null && +b.transition > 0 ? +b.transition : Math.max(bd.h, 10);
    const d0 = { 1: -p * dot(bd.n, g), [-1]: p * dot(bd.n, g) };
    const dev = (s, x) => {
      const t = G.clamp((x - bd.x0) / Ltr, 0, 1);
      return d0[s] + (camber - d0[s]) * t;
    };
    const zAxis = (x) => z0 + grade * (x - bd.x0);
    const zAt = (Pw) => {
      const q = sub(Pw, O), x = dot(q, bd.u), y = dot(q, bd.n);
      if (x <= bd.x0 + 1e-6 && G.dist(Pw, O) <= D.Rg + 0.05) return zRing(Pw);
      const s = y - bd.a >= 0 ? 1 : -1;
      return zAxis(x) + dev(s, x) * Math.abs(y - bd.a);
    };
    const stations = [];
    const xs = [0, Ltr / 4, Ltr / 2, (3 * Ltr) / 4, Ltr, Ltr + 10];
    for (const dx of xs) {
      const x = bd.x0 + dx;
      if (x > bd.xEnd) break;
      stations.push({ dx, zAxe: zAxis(x), dIn: dev(1, x), dOut: dev(-1, x) });
    }
    D.devers.branches.push({ idx: bd.idx, name: bd.name, grade, Ltr, camber, d0In: d0[1], d0Out: d0[-1], stations, zAt });
    bd.zAt = zAt;

    // Flèches sur la branche : début, milieu et fin de transition, section courante.
    for (const dx of [2, Ltr / 2, Ltr, Ltr + 12]) {
      const x = bd.x0 + dx;
      if (x > bd.xEnd - 2) continue;
      for (const sd of [bd.entry, bd.exit]) {
        const s = sd.s, v = dev(s, x);
        const isl = dx < bd.h ? bd.hb + (bd.th - bd.hb) * (dx / bd.h) : bd.th;
        const wl = dx < bd.h ? sd.w : sd.wa;
        const yc = bd.a + s * (isl + wl / 2);
        const away = mul(bd.n, s);
        const dir = v <= 0 ? away : G.neg(away);
        arrow(add(bd.W({ x, y: yc }), mul(dir, -1)), dir, 2, pct(Math.abs(v)), TH * 0.7);
      }
    }
  }

  // Altitudes des points d'implantation
  for (const q of D.points) {
    const bd = q.bi != null ? D.branches.find((x) => x.idx === q.bi) : null;
    q.z = bd && bd.zAt && q.kind !== 'centre' ? bd.zAt(q.p) : zRing(q.p);
    if (q.kind === 'centre' && q.bi != null) q.z = null; // centres de raccordement : pas de cote
  }
}
