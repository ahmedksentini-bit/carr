// capacity-plan.js — capacité des carrefours plans à priorité (T, X) : mouvements non prioritaires.
// L'ACI renvoie au logiciel OCTAVE et le CERTU à un abaque, sans formule publiée : on applique la méthode
// d'acceptation de créneaux de Brilon (HBS) dans la structure de l'HCM (« TWSC »), d'après Troutbeck & Brilon,
// Traffic Flow Theory, chap. 8 (FHWA) : trafic conflictuel q_p (tableau 8.2), capacité de base de Siegloch,
// probabilités d'absence de file chaînées par rang, voie partagée, effet d'un tourne-à-gauche sans voie
// réservée ; attente moyenne de l'HBS 2015 et contrôle CERTU T = 3600 / (C − S).
// Débits en uvp/h, circulation à droite. Route principale A → B : la gauche est du côté +Y (sY = +1).
import { uvp } from './capacity.js';

// Créneau critique tg et temps de suivi tf (s) : valeurs de base de l'HCM, route principale à 1 / 2 voies par sens.
export const GAPS = {
  tagP: { label: 'TAG depuis la principale', tg: [4.1, 4.1], tf: 2.2 },
  tadS: { label: 'TAD depuis la secondaire', tg: [6.2, 6.9], tf: 3.3 },
  tdS: { label: 'Traversée (TD secondaire)', tg: [6.5, 6.5], tf: 4.0 },
  tagS: { label: 'TAG depuis la secondaire', tg: [7.1, 7.5], tf: 3.5 },
};
const T3LT = 0.7;   // HCM : tg du TAG secondaire réduit de 0,7 s en carrefour en T
const TB = 2;       // s, temps de passage d'un véhicule prioritaire (débit de saturation 1800 uvp/h)

// tg / tf par défaut, puis valeurs saisies (traffic.gaps).
export function gapParams(traffic, kind, nLanes) {
  const out = {};
  for (const [k, g] of Object.entries(GAPS)) {
    const tg0 = g.tg[nLanes > 1 ? 1 : 0] - (k === 'tagS' && kind === 'T' ? T3LT : 0);
    const u = traffic?.gaps?.[k] || {}, num = (v, d) => (v === '' || v == null || !(+v > 0) ? d : +v);
    out[k] = { tg: num(u.tg, tg0), tf: num(u.tf, g.tf), tg0, tf0: g.tf };
  }
  return out;
}

// Capacité de base de Siegloch (uvp/h).
const siegloch = (qp, g) => (3600 / g.tf) * Math.exp(-(qp / 3600) * (g.tg - g.tf / 2));
const p0 = (q, C) => (q > 0 ? (C > 0 ? Math.max(0, 1 - q / C) : 0) : 1);

// Indicateurs d'une voie : réserve, attente HBS (T = 1 h), niveau de qualité, attente CERTU, file à 95 % (HCM, T = 0,25 h).
function perf(q, C) {
  const R = C - q, Rp = C > 0 ? R / C : -1, x = C > 0 ? q / C : Infinity;
  const w = C > 0 ? 3600 / C + 900 * ((x - 1) + Math.sqrt((x - 1) ** 2 + (8 * x) / C)) : Infinity;
  const qsv = x > 1 ? 'F' : w <= 10 ? 'A' : w <= 20 ? 'B' : w <= 30 ? 'C' : w <= 45 ? 'D' : 'E';
  const Tc = R > 0 ? 3600 / R : Infinity;
  const T = 0.25, q95 = C > 0 && q > 0 ? 900 * T * ((x - 1) + Math.sqrt((x - 1) ** 2 + ((3600 / C) * x) / (150 * T))) * (C / 3600) : 0;
  const lvl = x >= 1 || w > 45 || Tc > 60 ? 'err' : w > 30 || Tc > 30 ? 'warn' : 'ok';
  return { q, C, R, Rp, x, w, qsv, Tc, q95, lvl };
}

// D : carrefour plan construit (plan.js) ; lanesOf(bd) : nombre de voies d'entrée de la branche secondaire.
// Retourne { moves, lanes, notes, total, gaps } ou { error }.
export function analysePlan(traffic, D, lanesOf) {
  const P = D.plan, br = D.branches;
  const A = br.find((b) => b.idx === D.main.a), B = br.find((b) => b.idx === D.main.b);
  const secs = br.filter((b) => b.role === 'secondaire');
  if (!A || !B || !secs.length) return { error: 'carrefour incomplet' };
  if (secs.length === 2 && secs[0].sY === secs[1].sY) return { error: 'les deux branches secondaires sont du même côté de la route principale' };
  const kind = secs.length === 2 ? 'X' : 'T', n = P.nLanes;
  const gp = gapParams(traffic, kind, n);
  const side = (sg) => secs.find((s) => s.sY === sg) || null;
  const q = (o, d) => (o && d ? uvp(traffic, o.id, d.id) : 0);
  const pl = (o) => Math.max(0, Math.min(100, +traffic?.pl?.[o.id] || 0)) / 100;

  // Courants de la route principale : A roule vers B (gauche = +Y), B vers A (gauche = −Y).
  const main = new Map([[A, { to: B, left: side(1), right: side(-1), tag: P.tagA }], [B, { to: A, left: side(-1), right: side(1), tag: P.tagB }]]);
  for (const [o, m] of main) Object.assign(m, { TD: q(o, m.to), TAG: q(o, m.left), TAD: q(o, m.right) });
  const mA = main.get(A), mB = main.get(B);

  const moves = [], lanes = [], notes = [];
  const mv = (o, d, type, rank, qq, qp, g, C) => { const r = { o, d, type, rank, q: qq, qp, tg: g.tg, tf: g.tf, C }; moves.push(r); return r; };

  // Rang 2 : tourne-à-gauche depuis la principale, gêné par le TD et le TAD du sens opposé.
  const p0m = new Map();
  for (const [o, m] of main) {
    if (!m.left) continue;
    const opp = main.get(m.to), qp = opp.TD + opp.TAD;
    const r = mv(o, m.left, 'TAG principale', 2, m.TAG, qp, gp.tagP, siegloch(qp, gp.tagP));
    let p = p0(m.TAG, r.C);
    if (!m.tag) {
      // Sans voie de TAG, un véhicule arrêté bloque la voie directe (Brilon, éq. 8.101).
      const den = 1 - ((m.TD / n + (n > 1 ? 0 : m.TAD)) / 3600) * TB;
      r.p0 = p; p = den > 0 ? Math.max(0, 1 - (1 - p) / den) : 0; r.p0b = p;
      if (m.TAG > 0 && p < 0.9) notes.push({ lvl: 'warn', grp: o.name, msg: `sans voie de TAG, les tourne-à-gauche arrêtés bloquent la voie directe (probabilité sans file ${Math.round(100 * p)} %) : une voie de TAG est conseillée` });
    }
    p0m.set(o, p);
    const res = perf(m.TAG, r.C);
    res.label = `${o.name} → ${m.left.name}`; res.type = m.tag ? 'TAG (voie réservée)' : 'TAG (dans la voie directe)';
    res.notes = [];
    if (m.tag && m.TAG > 0) {
      const N = Math.max(1, Math.ceil(res.q95)), Lj = (7 + 10 * pl(o)) * N;
      res.Lj = Lj;
      if (Lj > P.tag.storage + 1e-6) res.notes.push(`stockage ${Math.round(P.tag.storage)} m < (7 + 10p)·N = ${Math.round(Lj)} m (N = ${N} véh., file à 95 %)`);
    }
    lanes.push(res);
  }
  const px = (p0m.get(A) ?? 1) * (p0m.get(B) ?? 1);

  // Branches secondaires : le courant « proche » vient de la gauche de l'usager (de B pour sY = +1).
  const S = new Map();
  for (const s of secs) {
    const near = s.sY > 0 ? mB : mA, far = s.sY > 0 ? mA : mB;
    const left = s.sY > 0 ? B : A, right = s.sY > 0 ? A : B, opp = secs.find((t) => t !== s) || null;
    S.set(s, { near, far, left, right, opp, TAG: q(s, left), TD: q(s, opp), TAD: q(s, right) });
  }
  // Rang 2 : TAD secondaire ; rang 3 : TD secondaire (X).
  for (const [s, f] of S) {
    const qp = f.near.TD / n + 0.5 * f.near.TAD;
    f.mTAD = mv(s, f.right, 'TAD secondaire', 2, f.TAD, qp, gp.tadS, siegloch(qp, gp.tadS));
    if (f.opp) {
      const qp3 = f.near.TD + 0.5 * f.near.TAD + f.far.TD + f.far.TAD + f.near.TAG + f.far.TAG;
      f.mTD = mv(s, f.opp, 'TD secondaire', 3, f.TD, qp3, gp.tdS, px * siegloch(qp3, gp.tdS));
      f.mTD.base = siegloch(qp3, gp.tdS);
    }
  }
  // TAG secondaire : rang 3 en T, rang 4 en X (correction de dépendance des files, éq. 8.97).
  const kS2 = P.regime === 'stop' ? 0.5 : 1;
  for (const [s, f] of S) {
    const o = f.opp && S.get(f.opp);
    const qp = f.near.TD + 0.5 * f.near.TAD + f.far.TD + f.near.TAG + f.far.TAG + (o ? kS2 * (o.TD + o.TAD) : 0);
    const base = siegloch(qp, gp.tagS);
    let C;
    if (!o) C = px * base;
    else {
      const py = px * p0(o.TD, o.mTD.C), pz = 0.65 * py - py / (py + 3) + 0.6 * Math.sqrt(py);
      C = pz * p0(o.TAD, o.mTAD.C) * base;
    }
    f.mTAG = mv(s, f.left, 'TAG secondaire', o ? 4 : 3, f.TAG, qp, gp.tagS, C);
    f.mTAG.base = base;
  }
  // Voies des branches secondaires : une voie partagée, ou TAD à part si deux voies d'entrée.
  const share = (ms) => {
    const Q = ms.reduce((a, m) => a + m.q, 0);
    if (ms.some((m) => m.q > 0 && !(m.C > 0))) return { q: Q, C: 0 };
    const C = Q > 0 ? Q / ms.reduce((a, m) => a + m.q / m.C, 0) : ms.length / ms.reduce((a, m) => a + 1 / Math.max(m.C, 1e-9), 0);
    return { q: Q, C };
  };
  for (const [s, f] of S) {
    const all = [f.mTAG, f.mTD, f.mTAD].filter(Boolean);
    const groups = (lanesOf(s) || 1) > 1 ? [[f.mTAD], all.filter((m) => m !== f.mTAD)] : [all];
    for (const g of groups) {
      const sh = share(g), res = perf(sh.q, sh.C);
      res.label = s.name;
      res.type = g.map((m) => m.type.split(' ')[0]).join(' + ') + (groups.length > 1 || g.length === 1 ? '' : ' (voie partagée)');
      res.notes = [];
      lanes.push(res);
    }
  }
  for (const r of lanes) {
    if (r.x > 1) r.notes.push('voie saturée (demande > capacité)');
    else if (r.Tc > 60) r.notes.push(`attente CERTU ${Math.round(r.Tc)} s > 1 min : feux ou giratoire à envisager`);
    else if (r.Tc > 30) r.notes.push(`attente CERTU ${Math.round(r.Tc)} s entre 30 s et 1 min : à apprécier`);
  }
  const total = [...br].reduce((a, o) => a + br.reduce((b, d) => b + q(o, d), 0), 0);
  const uturn = br.some((o) => q(o, o) > 0);
  if (uturn) notes.push({ lvl: 'info', grp: 'Carrefour', msg: 'demi-tours non pris en compte dans le calcul' });
  return { kind, moves, lanes, notes, total, gaps: gp, px };
}
