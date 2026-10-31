// echangeur.js — échangeur autoroutier : section courante, bretelles de sortie (Sd1, déboîtement) et
// d'entrée (Ei1, insertion), divergents / convergents, contrôles géométriques.
// Sources : Cerema, « Les échangeurs sur routes de type Autoroute », éd. 2013, maj 2021 (noté [ECH]) ;
// ICTAAL éd. 2015, maj 2021 (noté [ICTAAL]). Les renvois § sont ceux de ces guides.
import * as G from './geom.js';
import { buildAlignment, offsetPolyline, polySegs, pathTangentAt, cloMinLength } from './clotho.js';
import { fmt, upright } from './common.js';

const { add, sub, mul, norm, rot90, neg, dist, ang, unit } = G;
const num = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);

// [ICTAAL] tab. 3-1 et 3-2 : section courante.
export const HWY_CAT = {
  L1: { label: 'L1 (130 km/h)', V: 130, Rm: 600, Rdn: 1000, pente: 5, Rs: 9200, Rr: 4200, zs: 10 },
  L2: { label: 'L2 (110 km/h)', V: 110, Rm: 400, Rdn: 650, pente: 6, Rs: 5200, Rr: 3000, zs: 8.5 },
};
// [ECH] tab. 3-1, 3-2, § 3.4.2 : branches et bretelles.
export const RAMP_CAT = {
  b50: { label: 'Bretelle 1 voie ≤ 70 km/h', V: 70, Rdn: 300, Rm: 40, R7: 125, Rfirst: 100, Rs: 1100, Rr: 800, pente: 6, lanes: 1, bdd: 1.0, bdg: 0.5, two: false, branche: false },
  b70: { label: 'Bretelle / branche 1 voie 70 km/h', V: 70, Rdn: 300, Rm: 125, Rfirst: 100, Rs: 1200, Rr: 1200, pente: 6, lanes: 1, bdd: 1.0, bdg: 0.5, two: false, branche: false },
  b90: { label: 'Bretelle / branche 1 ou 2 voies 90 km/h', V: 90, Rdn: 370, Rm: 240, Rfirst: 100, Rs: 2700, Rr: 1900, pente: 6, lanes: 1, bdd: 1.0, bdg: 0.5, two: false, branche: false },
  n90: { label: 'Branche de nœud 1 voie 90 km/h', V: 90, Rdn: 370, Rm: 240, Rfirst: 555, Rs: 2700, Rr: 1900, pente: 6, lanes: 1, bdd: 2.5, bdg: 0.75, two: false, branche: true },
  n110: { label: 'Branche de nœud 2 voies 110 km/h', V: 110, Rdn: 650, Rm: 400, Rfirst: 975, Rs: 5200, Rr: 3000, pente: 6, lanes: 2, bdd: 2.5, bdg: 1.0, two: true, branche: true },
};
// [ECH] annexe tab. 12-1 : vitesse (km/h) associée au rayon pour un dévers de 7 %.
const VR_TABLE = [[40, 45], [50, 49], [54, 50], [60, 52], [70, 56], [80, 59], [85, 60], [90, 62], [100, 64], [110, 67], [120, 69], [125, 70]];
export function speedOfRadius(R) {
  if (!(R > 0)) return 70;
  if (R <= 40) return 45 * Math.sqrt(R / 40);
  if (R >= 125) return 70;
  for (let i = 1; i < VR_TABLE.length; i++) {
    const [r0, v0] = VR_TABLE[i - 1], [r1, v1] = VR_TABLE[i];
    if (R <= r1) return v0 + ((v1 - v0) * (R - r0)) / (r1 - r0);
  }
  return 70;
}
// [ECH] § 3.5 : pente transversale (%) d'une courbe de rayon R, linéaire en 1/R entre 2,5 % (Rdn) et 7 % (Rm).
export function deversOfRadius(R, cat) {
  if (!(R > 0) || R >= cat.Rdn) return 2.5;
  const Rm = cat.R7 || cat.Rm, Rdn = cat.Rdn; // bretelle ≤ 70 km/h : 7 % atteint à 125 m puis constant
  if (R <= Rm) return 7;
  return 2.5 + ((7 - 2.5) * (1 / R - 1 / Rdn)) / (1 / Rm - 1 / Rdn);
}
// [ECH] tab. 4-4 / 5-2 : longueur d'insertion Li (adjonction) ; Ei1 : 200 m + biseau 75 m (schéma 5-1).
export const LI = { 130: 470, 110: 310, 90: 234 };

export function hwyParams(prj) {
  const h = prj.hwy || {};
  const cat = HWY_CAT[h.cat] || HWY_CAT.L2;
  return {
    on: !!h.on, name: h.name || 'Autoroute', cat: HWY_CAT[h.cat] ? h.cat : 'L2', C: cat, V: num(h.V, cat.V),
    lanes: Math.max(1, Math.round(num(h.lanes, 2))), wLane: num(h.wLane, 3.5), bau: num(h.bau, 2.5), bdg: num(h.bdg, 1.0),
    median: num(h.median, 3.0), berme: num(h.berme, 1.0), z0: num(h.z0, 100), pente: num(h.pente, 0), pk0: num(h.pk0, 0),
    axis: (h.axis || []).map((p) => ({ x: +p.x, y: +p.y, r: +p.r || 0 })),
  };
}

export function rampParams(prj, r) {
  const cat = RAMP_CAT[r.cat] || RAMP_CAT.b50;
  const kind = r.kind === 'entree' ? 'entree' : 'sortie';
  const biseau = kind === 'sortie' ? num(r.biseau, 150) : num(r.biseau, 75);
  const lanes = Math.max(1, Math.round(num(r.lanes, cat.lanes)));
  const w = lanes * num(r.wLane, 3.5);
  const bdd = num(r.bdd, cat.bdd), bdg = num(r.bdg, cat.bdg);
  const H = hwyParams(prj);
  // Obliquité : 3 % (150 m), ≈ 4 % (110 m), 5 % (90 m) en sortie ([ECH] § 6.1, biseau sur 4,50 m = 1,00 + 3,50) ; 3 à 5 % en entrée.
  const p = kind === 'sortie' ? (r.obl !== '' && r.obl != null ? num(r.obl, 3) / 100 : 4.5 / biseau) : num(r.obl, 3) / 100;
  const tpl = num(r.tpl, Math.round((H.bau + bdg + 0.7) * 100) / 100); // BAU émettrice + BDG bretelle + balise J14 (0,70 m) [ECH] § 6.1 (9)
  const Lm = Math.max(0, (tpl - 1) / p);
  return { kind, name: r.name || (kind === 'sortie' ? 'S' : 'E'), sens: +r.sens === 2 ? 2 : 1, s: num(r.s, 0), cat: RAMP_CAT[r.cat] ? r.cat : 'b50', C: cat, lanes, w, bdd, bdg, berme: num(r.berme, 0.75), biseau, p, tpl, Lm, pente: num(r.pente, 0), ins: num(r.ins, 200), pis: Array.isArray(r.pis) ? r.pis : [] };
}

// Repère de la bretelle sur la chaussée émettrice/réceptrice : point A (axe de la bretelle au droit de S.1,00 / E.1,00) et direction dA vers l'extérieur.
export function rampFrame(prj, H, hwyPath, rp) {
  const sEnd = G.pathLen(hwyPath), s = Math.max(0, Math.min(sEnd, rp.s));
  const P = G.pathPointAt(hwyPath, s), t = pathTangentAt(hwyPath, s);
  const d = rp.sens === 1 ? t : neg(t);     // sens de circulation
  const nr = neg(rot90(d));                 // normale à droite du sens de circulation
  const E0 = H.median / 2 + H.bdg, E1 = E0 + H.lanes * H.wLane, E2 = E1 + H.bau;
  const edge = (st) => add(G.pathPointAt(hwyPath, st), mul(nr, E1));
  const S1 = add(P, mul(nr, E1 + 1));       // S.1,00 m / E.1,00 m : rives à 1,00 m
  const A = add(S1, mul(nr, rp.w / 2));
  const dA = norm(rp.kind === 'sortie' ? add(d, mul(nr, rp.p)) : add(neg(d), mul(nr, rp.p)));
  return { s, P, t, d, nr, E0, E1, E2, S1, A, dA, edge, sEnd };
}

const surl = (k) => (Math.abs(k) < 0.01 ? 0.5 * Math.pow(Math.abs(k) / 0.01, 2) : 50 * Math.abs(k)); // [ECH] § 3.4.2 : 50/R si R < 100 m

// Construit l'échangeur ; ajoute prims, points, issues au projet dérivé D.
export function buildEchangeur(prj, D) {
  const H = hwyParams(prj);
  D.hwy = null; D.ramps = []; D.echIssues = [];
  if (!H.on || H.axis.length < 2) return;
  const issues = D.echIssues, prims = D.prims, TH = +prj.opts?.textH || 0.8;
  const P = (o) => prims.push(o);
  const pt = (name, p, extra = {}) => D.points.push({ n: D.points.length + 1, name, p, bi: null, kind: 'echangeur', ...extra });
  const text = (lay, p, s, rot = 0, align = 'center', h = TH) => P({ k: 'text', L: lay, p, s, rot: upright(rot), align, h });

  // --- Section courante ----------------------------------------------------------------
  const path = G.roundPolyline(H.axis, H.axis.map((p) => p.r));
  const sEnd = G.pathLen(path);
  const E0 = H.median / 2 + H.bdg, E1 = E0 + H.lanes * H.wLane, E2 = E1 + H.bau;
  const off = (delta) => G.offsetPath(path, delta);
  const hwy = { H, path, sEnd, E0, E1, E2, ok: sEnd > 1 };
  D.hwy = hwy;
  if (!hwy.ok) return;
  // Rayons de la section courante [ICTAAL] tab. 3-1.
  path.forEach((sg) => {
    if (sg.t !== 'A') return;
    if (sg.r < H.C.Rm) issues.push({ lvl: 'err', msg: `${H.name} : rayon ${fmt(sg.r)} m < Rm = ${H.C.Rm} m (catégorie ${H.cat}, ICTAAL tab. 3-1).` });
    else if (sg.r < H.C.Rdn) issues.push({ lvl: 'warn', msg: `${H.name} : rayon ${fmt(sg.r)} m < Rdn = ${H.C.Rdn} m → courbe déversée ; pas d'échangeur dans une courbe déversée (guide échangeurs § 1).` });
  });
  // Interruptions des rives et des bords de plate-forme au droit des bretelles (stations le long de l'axe).
  const gaps = { 1: { rive: [], bord: [] }, '-1': { rive: [], bord: [] } };
  for (const r of prj.ramps || []) {
    const rp = rampParams(prj, r), s0 = Math.max(0, Math.min(sEnd, rp.s));
    const sg = rp.sens === 1 ? -1 : 1, st = (rp.sens === 1 ? 1 : -1) * (rp.kind === 'sortie' ? 1 : -1);
    const I = (a, b) => [Math.min(a, b), Math.max(a, b)];
    if (rp.kind === 'sortie') { gaps[sg].rive.push(I(s0 - st * rp.biseau, s0)); gaps[sg].bord.push(I(s0 - st * rp.biseau * 0.5, s0 + st * rp.Lm)); }
    else { const sFin = s0 - st * (rp.ins + rp.biseau); gaps[sg].rive.push(I(s0, sFin)); gaps[sg].bord.push(I(s0 + st * rp.Lm, sFin)); }
  }
  // Ligne décalée de delta, échantillonnée le long de l'axe, coupée par les intervalles g : liste de morceaux.
  const offPieces = (delta, g) => {
    const cuts = [[0, sEnd]];
    for (const [a, b] of g) for (let i = cuts.length - 1; i >= 0; i--) {
      const [c, d] = cuts[i]; if (b <= c || a >= d) continue;
      cuts.splice(i, 1, ...[[c, a], [b, d]].filter(([x, y]) => y - x > 0.5));
    }
    return cuts.map(([a, b]) => {
      const n = Math.max(1, Math.ceil((b - a) / 2)), pts = [];
      for (let i = 0; i <= n; i++) { const st = a + ((b - a) * i) / n; pts.push(add(G.pathPointAt(path, st), mul(rot90(pathTangentAt(path, st)), delta))); }
      return polySegs(pts);
    });
  };
  // Chaussées, TPC, accotements.
  const ring = (a, b) => { const pts = [...G.samplePath(a, 2), ...G.samplePath(G.revPath(b), 2)]; return polySegs([...pts, pts[0]]); };
  for (const sg of [1, -1]) { // +1 : côté gauche de l'axe (sens 2), −1 : côté droit (sens 1)
    // Chaussée, BDG et BAU revêtues ([ICTAAL] § 4.1.2, 4.1.3).
    P({ k: 'fill', L: 'CHAUSSEE', rings: [ring(off(sg * H.median / 2), off(sg * E2))], role: 'chaussee', rule: 'nonzero' });
    for (const segs of offPieces(sg * E2, gaps[sg].bord)) P({ k: 'path', L: 'BORDURE', segs });
    for (const segs of offPieces(sg * (E2 + H.berme), gaps[sg].bord)) P({ k: 'path', L: 'ACCOTEMENT', segs });
    for (let i = 1; i < H.lanes; i++) P({ k: 'path', L: 'MARQUAGE', segs: off(sg * (E0 + i * H.wLane)), dash: [3, 10], wm: 0.15 }); // T1 3u
    for (const segs of offPieces(sg * (E1 - 0.1), gaps[sg].rive)) P({ k: 'path', L: 'MARQUAGE', segs, wm: 0.15 }); // rive continue 3u
    P({ k: 'path', L: 'MARQUAGE', segs: off(sg * (E0 + 0.1)), wm: 0.15 }); // rive gauche 3u
  }
  P({ k: 'fill', L: 'ILOT_SEP', rings: [ring(off(H.median / 2), off(-H.median / 2))], role: 'ilot' });
  P({ k: 'path', L: 'BORDURE', segs: off(H.median / 2) }); P({ k: 'path', L: 'BORDURE', segs: off(-H.median / 2) });
  P({ k: 'path', L: 'AXE', segs: path, role: 'principale' });
  text('COTATION', G.pathPointAt(path, Math.min(sEnd, 30)), `${H.name} — ${H.cat}, 2×${H.lanes} voies`, ang(pathTangentAt(path, 30)), 'center', TH * 1.2);
  // PK tous les 100 m.
  for (let s = 0; s <= sEnd + 1e-6; s += 100) {
    const p = G.pathPointAt(path, s), tg = pathTangentAt(path, s), n = rot90(tg);
    P({ k: 'path', L: 'COTATION', segs: [G.L(add(p, mul(n, -1)), add(p, mul(n, 1)))] });
    text('COTATION', add(p, mul(n, E2 + H.berme + 2.5)), `PK ${fmt((H.pk0 + s) / 1000, 3)}`, ang(tg), 'center', TH * 0.8);
    pt(`${H.name} · PK ${fmt((H.pk0 + s) / 1000, 3)}`, p);
  }
  pt(`${H.name} · origine`, G.pathPointAt(path, 0)); pt(`${H.name} · fin`, G.pathPointAt(path, sEnd));

  // --- Bretelles ------------------------------------------------------------------------
  (prj.ramps || []).forEach((r, idx) => {
    const rp = rampParams(prj, r);
    const name = rp.name;
    const F = rampFrame(prj, H, path, rp);
    const R = { idx, id: r.id, name, kind: rp.kind, cat: rp.cat, C: rp.C, sens: rp.sens, s: F.s, F, w: rp.w, rp, issues: [], ok: false };
    D.ramps.push(R);
    const warn = (msg) => { issues.push({ lvl: 'warn', msg: `${name} : ${msg}` }); R.issues.push({ lvl: 'warn', msg }); };
    const err = (msg) => { issues.push({ lvl: 'err', msg: `${name} : ${msg}` }); R.issues.push({ lvl: 'err', msg }); };
    const info = (msg) => { issues.push({ lvl: 'info', msg: `${name} : ${msg}` }); R.issues.push({ lvl: 'info', msg }); };
    // Point singulier de la section courante au droit du point d'accès.
    const hr = (() => { let acc = 0; for (const sg of path) { const l = G.segLen(sg); if (F.s <= acc + l) return sg.t === 'A' ? sg.r : 0; acc += l; } return 0; })();
    if (hr && hr < 1.5 * H.C.Rdn) warn(`point d'accès dans une courbe de rayon ${fmt(hr)} m < 1,5 Rdn (${fmt(1.5 * H.C.Rdn)} m) : point singulier à éviter (guide échangeurs § 1).`);
    // Alignement de la bretelle : A, puis PI de l'utilisateur (le premier projeté sur la direction d'obliquité).
    const pis = rp.pis.map((q) => ({ x: +q.x, y: +q.y, R: num(q.R, 0), A: num(q.A, 0) }));
    const userPis = pis.length > 0;
    let proj = userPis ? Math.max(rp.Lm + 20, G.dot(sub(pis[0], F.A), F.dA)) : Math.max(200, rp.Lm + 100);
    if (!userPis) pis.push({ R: 0, A: 0 });
    let al;
    for (let pass = 0; pass < 8; pass++) { // le 1er PI est projeté sur la direction d'obliquité, au-delà du tpl (alignement droit ≥ Lm)
      pis[0] = { ...pis[0], ...add(F.A, mul(F.dA, proj)) };
      al = buildAlignment([{ x: F.A.x, y: F.A.y, R: 0, A: 0 }, ...pis], { name });
      const l0 = al.elems[0]?.kind === 'L' ? al.elems[0].len : 0;
      if (!userPis || l0 >= rp.Lm - 1e-6 || al.elems.length < 2) break;
      proj += (rp.Lm - l0) * 1.5 + 0.5;
    }
    R.pis = pis;
    al.issues.forEach((i) => (i.lvl === 'err' ? err : warn)(i.msg.replace(`${name} : `, '').replace(`${name} `, '')));
    R.al = al; R.length = al.length;
    if (!(al.length > 1)) { err('axe de bretelle trop court.'); return; }
    // Direction de parcours : sortie = s croissant depuis S.1,00 ; entrée = s décroissant vers E.1,00.
    const fwd = rp.kind === 'sortie';
    const curves = al.tangents.map((tg, i) => ({ ...tg, k: i })); // dans l'ordre géométrique (depuis l'autoroute)
    const run = fwd ? curves : curves.slice().reverse();
    // Contrôles des rayons [ECH] tab. 3-1, § 3.2.1, § 3.2.2.
    const C = rp.C;
    run.forEach((c, j) => {
      const Rr = c.R;
      if (Rr < C.Rm) err(`PI ${c.i} : R = ${fmt(Rr)} m < Rm = ${C.Rm} m (${C.label}, tab. 3-1).`);
      else if (Rr < C.Rdn) info(`PI ${c.i} : R = ${fmt(Rr)} m < Rdn = ${C.Rdn} m → courbe déversée à ${fmt(deversOfRadius(Rr, C), 1)} % (§ 3.5).`);
      if (rp.cat === 'b50' && Rr < 54) warn(`PI ${c.i} : R = ${fmt(Rr)} m < 54 m → vitesse < 50 km/h (§ 3.2.1 : 54 m conseillé).`);
      if (j === 0 && rp.kind === 'sortie' && Rr < C.Rfirst) (C.branche ? warn : err)(`premier rayon de sortie R = ${fmt(Rr)} m < ${C.Rfirst} m (${C.branche ? '1,5 Rdn, branche' : '100 m hors boucle, bretelle'} ; § 3.2.2).`);
      const Lmin = cloMinLength(Rr, Math.abs(deversOfRadius(Rr, C) - 2.5), rp.lanes);
      if (Rr <= 1.5 * C.Rdn && c.L + 1e-6 < Lmin) warn(`PI ${c.i} : clothoïde L = ${fmt(c.L)} m < ${fmt(Lmin)} m (max(${rp.lanes >= 2 ? 'R/9 ; 14|Δd|' : '6R^0,4 ; 7|Δd|'}), § 3.2.3) → A ≥ ${fmt(Math.sqrt(Lmin * Rr))}.`);
      if (Rr <= C.Rdn && c.L <= 0) warn(`PI ${c.i} : courbe de rayon ${fmt(Rr)} m ≤ Rdn sans clothoïde (§ 3.2.3).`);
      if (j > 0) {
        const R1 = run[j - 1].R, R2 = Rr;
        const okSeq = R2 >= 1.5 * C.Rdn || (C.branche ? R1 <= 1.5 * R2 : R1 < 2 * R2);
        if (!okSeq) warn(`enchaînement PI ${run[j - 1].i} → PI ${c.i} : R1 = ${fmt(R1)} m, R2 = ${fmt(R2)} m ne respecte pas ${C.branche ? 'R1 ≤ 1,5 R2' : 'R1 < 2 R2'} (§ 3.2.2).`);
      }
    });
    // Alignements droits intermédiaires ([ECH] § 3.2.2 : ≥ 60 m bretelle / 100 m branche entre courbes de même sens < 1,5 Rdn).
    const curveElems = al.elems.filter((e) => e.kind === 'A');
    for (let i = 1; i < curveElems.length; i++) {
      const a = curveElems[i - 1], b = curveElems[i];
      if (a.sg !== b.sg || a.R >= 1.5 * C.Rdn || b.R >= 1.5 * C.Rdn) continue;
      const lad = al.elems.filter((e) => e.kind === 'L' && e.s0 > a.s0 && e.s0 < b.s0).reduce((acc, e) => acc + e.len, 0);
      const min = C.branche ? 100 : 60;
      if (lad < min && !(C.branche ? false : a.R < b.R)) warn(`alignement droit de ${fmt(lad)} m entre deux courbes de même sens < 1,5 Rdn : ${min} m minimum (§ 3.2.2).`);
    }
    // Zone de décélération / accélération [ECH] § 3.2.5.
    const grade = rp.pente / 100; // déclivité algébrique dans le sens de parcours (pente < 0, rampe > 0)
    const firstCurve = curves[0];
    const lad0 = al.elems[0]?.kind === 'L' ? al.elems[0].len : 0;
    const Lcl0 = firstCurve?.L || 0;
    R.lad = lad0; R.Lm = rp.Lm; R.tplS = Math.min(al.length, rp.Lm);
    if (lad0 + 1e-6 < rp.Lm) err(`alignement droit depuis ${fwd ? 'S' : 'E'}.1,00 m de ${fmt(lad0)} m < Lm = ${fmt(rp.Lm)} m (prolongement de l'obliquité jusqu'au tpl, § 6.1).`);
    if (rp.kind === 'sortie') {
      const Vs = 70 / 3.6, VR = (firstCurve ? speedOfRadius(firstCurve.R) : 70) / 3.6;
      const Ld = Math.max(0, (Vs * Vs - VR * VR) / (2 * (1.5 + 10 * grade)));
      R.Ld = Ld; R.Ldisp = lad0 + Lcl0; R.VR = VR * 3.6;
      if (firstCurve && Ld > lad0 + Lcl0 + 1e-6) err(`zone de décélération ${fmt(lad0 + Lcl0)} m < Ld = ${fmt(Ld)} m (70 → ${fmt(VR * 3.6)} km/h, R = ${fmt(firstCurve.R)} m, p = ${fmt(rp.pente, 1)} %, § 3.2.5).`);
      else if (firstCurve) info(`zone de décélération ${fmt(lad0 + Lcl0)} m ≥ Ld = ${fmt(Ld)} m (vitesse cible ${fmt(VR * 3.6)} km/h).`);
    } else {
      const VE = 55 / 3.6, VR = (firstCurve ? speedOfRadius(firstCurve.R) : 70) / 3.6;
      const La = Math.max(0, (VE * VE - VR * VR) / (2 * (1 - 10 * grade)));
      R.La = La; R.Ladisp = lad0 + Lcl0; R.VR = VR * 3.6;
      if (firstCurve && La > lad0 + Lcl0 + 1e-6) err(`zone d'accélération ${fmt(lad0 + Lcl0)} m < La = ${fmt(La)} m (${fmt(VR * 3.6)} → 55 km/h, R = ${fmt(firstCurve.R)} m, rampe ${fmt(rp.pente, 1)} %, § 3.2.5).`);
      else if (firstCurve) info(`zone d'accélération ${fmt(lad0 + Lcl0)} m ≥ La = ${fmt(La)} m.`);
      if (rp.p < 0.03 - 1e-9 || rp.p > 0.05 + 1e-9) warn(`obliquité d'entrée ${fmt(rp.p * 100, 1)} % hors de 3 à 5 % (§ 6.1).`);
    }
    if (rp.kind === 'sortie' && ![150, 110, 90].includes(rp.biseau)) info(`biseau de ${fmt(rp.biseau)} m : 150 m en règle générale, 110 m en relief difficile, 90 m si une seule voie (§ 4.1.3.1).`);
    // Dévers le long de l'axe.
    R.deversAt = (s) => { const k = al.curvAt(s); const Rr = Math.abs(k) > 1e-9 ? 1 / Math.abs(k) : Infinity; return Rr >= C.Rdn ? -2.5 : (k > 0 ? 1 : -1) * deversOfRadius(Rr, C); }; // signe : + vers la gauche
    // --- Plate-forme -------------------------------------------------------------------
    const half = rp.w / 2;
    const offL = (s) => { const k = al.curvAt(s); return half + (k > 0 ? surl(k) : 0); };
    const offR = (s) => { const k = al.curvAt(s); return -(half + (k < 0 ? surl(k) : 0)); };
    const stp = 1;
    const left = offsetPolyline(al, offL, stp), right = offsetPolyline(al, offR, stp);
    R.left = left; R.right = right;
    const sTpl = Math.min(al.length, rp.Lm);
    const accL = offsetPolyline(al, (s) => offL(s) + rp.bdg, stp, sTpl), accR = offsetPolyline(al, (s) => offR(s) - rp.bdd, stp, 0);
    const bermL = offsetPolyline(al, (s) => offL(s) + rp.bdg + rp.berme, stp, sTpl), bermR = offsetPolyline(al, (s) => offR(s) - rp.bdd - rp.berme, stp, 0);
    const hwyEdgeAt = (st) => F.edge(Math.max(0, Math.min(F.sEnd, st)));
    const dir = rp.kind === 'sortie' ? 1 : -1; // sens du biseau le long de l'autoroute (station croissante si sens 1)
    const stDir = rp.sens === 1 ? dir : -dir;
    const hwyEdgeSeg = (s0, s1) => { const pts = []; const n = Math.max(2, Math.ceil(Math.abs(s1 - s0) / 2)); for (let i = 0; i <= n; i++) pts.push(hwyEdgeAt(s0 + ((s1 - s0) * i) / n)); return pts; };
    let ringPts;
    if (rp.kind === 'sortie') {
      // Biseau de déboîtement : la rive droite s'écarte de 4,50 m sur Lb jusqu'à S.1,00 m, puis bord droit de la bretelle.
      const D0 = hwyEdgeAt(F.s - stDir * rp.biseau);
      ringPts = [...hwyEdgeSeg(F.s - stDir * rp.biseau, F.s), ...left, ...right.slice().reverse(), D0];
      P({ k: 'path', L: 'BORDURE', segs: polySegs([D0, right[0]]), role: 'principale' });
      P({ k: 'path', L: 'MARQUAGE', segs: polySegs(hwyEdgeSeg(F.s - stDir * rp.biseau, F.s)), dash: [3, 3.5], wm: 0.15 }); // T2 3u sur le biseau
      pt(`${name} · origine du biseau (${fmt(rp.biseau)} m)`, D0);
      text('COTATION', add(D0, mul(F.nr, -1.5)), `biseau ${fmt(rp.biseau)} m`, ang(F.d), 'center', TH * 0.8);
    } else {
      // Insertion : voie parallèle de 200 m après E.1,00 m, puis biseau de rabattement de 75 m (schéma 5-1).
      const sIns = F.s + stDir * rp.ins, sFin = sIns + stDir * rp.biseau;
      const outer = (st) => add(hwyEdgeAt(st), mul(F.nr, rp.w));
      const ins = [outer(F.s), ...hwyEdgeSeg(F.s, sIns).slice(1).map((q) => add(q, mul(F.nr, rp.w))), hwyEdgeAt(sFin)];
      ringPts = [hwyEdgeAt(sFin), ...hwyEdgeSeg(sFin, F.s).slice(1), ...left, ...right.slice().reverse(), ...ins];
      P({ k: 'path', L: 'BORDURE', segs: polySegs([right[0], ...ins]), role: 'principale' });
      P({ k: 'path', L: 'MARQUAGE', segs: polySegs(hwyEdgeSeg(F.s, sIns)), dash: [3, 3.5], wm: 0.15 }); // T2 3u le long de la voie d'insertion
      P({ k: 'path', L: 'ACCOTEMENT', segs: polySegs([add(hwyEdgeAt(F.s), mul(F.nr, rp.w + H.bau)), ...hwyEdgeSeg(F.s, sIns).slice(1).map((q) => add(q, mul(F.nr, rp.w + H.bau))), add(hwyEdgeAt(sFin), mul(F.nr, H.bau))]) });
      pt(`${name} · fin de la voie d'insertion (${fmt(rp.ins)} m)`, outer(sIns)); pt(`${name} · fin du biseau (${fmt(rp.biseau)} m)`, hwyEdgeAt(sFin));
      text('COTATION', add(hwyEdgeAt(sIns), mul(F.nr, rp.w + 1.5)), `insertion ${fmt(rp.ins)} m + biseau ${fmt(rp.biseau)} m`, ang(F.d), 'center', TH * 0.8);
    }
    P({ k: 'fill', L: 'CHAUSSEE', rings: [polySegs([...ringPts, ringPts[0]])], role: 'chaussee', rule: 'nonzero' });
    P({ k: 'path', L: 'BORDURE', segs: polySegs(left), role: 'principale' });
    P({ k: 'path', L: 'BORDURE', segs: polySegs(right), role: 'principale' });
    P({ k: 'path', L: 'ACCOTEMENT', segs: polySegs(accL) }); P({ k: 'path', L: 'ACCOTEMENT', segs: polySegs(accR) });
    P({ k: 'path', L: 'ACCOTEMENT', segs: polySegs(bermL) }); P({ k: 'path', L: 'ACCOTEMENT', segs: polySegs(bermR) });
    P({ k: 'path', L: 'AXE', segs: al.path, role: 'secondaire', arrow: rp.kind === 'sortie' });
    // Musoir peint entre la rive de l'autoroute et la rive gauche de la bretelle, de S.1,00 m au tpl ; balise J14 à S.5,00 m.
    const sJ14 = Math.min(al.length, 4 / rp.p); // point théorique S.5,00 m (rives écartées de 5 m)
    const musoir = [...hwyEdgeSeg(F.s, F.s + stDir * sTpl), ...offsetPolyline(al, offL, 2, 0, sTpl).reverse()];
    P({ k: 'hatch', L: 'MARQUAGE', lines: G.hatchPolygon(musoir, ang(F.d) + Math.PI / 4, 1.0), wm: 0.12 });
    P({ k: 'path', L: 'MARQUAGE', segs: polySegs(musoir), wm: 0.15 });
    const pJ14 = add(hwyEdgeAt(F.s + stDir * sJ14), mul(F.nr, 2.5)), pTpl = add(hwyEdgeAt(F.s + stDir * sTpl), mul(F.nr, rp.tpl / 2));
    P({ k: 'circle', L: 'SIGNALISATION', c: pJ14, r: 0.3 });
    text('SIGNALISATION', add(pJ14, mul(F.nr, -1.2)), 'J14', ang(F.d), 'center', TH * 0.8);
    pt(`${name} · ${fwd ? 'S' : 'E'}.1,00 m`, F.S1); pt(`${name} · ${fwd ? 'S' : 'E'}.5,00 m (musoir, J14)`, pJ14); pt(`${name} · tpl (${fmt(rp.tpl)} m)`, pTpl);
    text('COTATION', add(F.S1, mul(F.nr, -1.2)), `${fwd ? 'S' : 'E'}.1,00`, ang(F.d), 'center', TH * 0.8);
    text('COTATION', add(pTpl, mul(F.nr, 2.5)), `tpl ${fmt(rp.tpl)} m · Lm ${fmt(rp.Lm)} m`, ang(F.dA), 'center', TH * 0.8);
    for (const q of al.points) pt(`${name} · ${q.name}`, q.p);
    pt(`${name} · fin d'axe`, al.pointAt(al.length));
    // Cotations des courbes : R, A, dévers.
    al.elems.forEach((e) => {
      if (e.kind !== 'A') return;
      const m = e.pointAt(e.len / 2), hd = e.headAt(e.len / 2), n = rot90(unit(hd));
      const side = e.sg > 0 ? -1 : 1; // étiquette à l'extérieur de la courbe
      const tg = al.tangents.find((t) => Math.abs(t.R - e.R) < 1e-9 && e.s0 >= 0);
      text('COTATION', add(m, mul(n, side * (half + rp.bdd + 2))), `R ${fmt(e.R)} m · A ${fmt(tg?.A || 0)} · d ${fmt(deversOfRadius(e.R, C), 1)} %`, hd, 'center', TH * 0.8);
    });
    text('COTATION', add(al.pointAt(Math.min(al.length, sTpl + 30)), mul(rot90(unit(al.headAt(Math.min(al.length, sTpl + 30)))), half + rp.bdd + 2)), `${name} — ${rp.kind === 'sortie' ? 'sortie Sd1' : 'entrée Ei1'}, ${C.label}`, al.headAt(Math.min(al.length, sTpl + 30)), 'center', TH);
    // Signalisation directionnelle de sortie [ECH] tab. 4-2 : D30 à l'origine du biseau, D40 à d3, D50 à d2.
    if (rp.kind === 'sortie') {
      const d3 = { 90: 750, 110: 900, 130: 1000 }[H.V] || 900, d2 = { 90: 1500, 110: 1800, 130: 2000 }[H.V] || 1800;
      const pos = (back) => add(hwyEdgeAt(F.s - stDir * (rp.biseau + back)), mul(F.nr, E2 - E1 + H.berme));
      [['D30', 0], ['D40', d3], ['D50', d2]].forEach(([code, back]) => {
        if (rp.biseau + back > F.s && rp.sens === 1) return;
        if (F.sEnd - F.s < rp.biseau + back && rp.sens === 2) return;
        const q = pos(back);
        P({ k: 'circle', L: 'SIGNALISATION', c: q, r: 0.25 });
        text('SIGNALISATION', add(q, mul(F.nr, 1.5)), code, ang(F.d), 'center', TH * 0.8);
        pt(`${name} · ${code}${back ? ` (${fmt(back)} m avant D30)` : ' (origine du biseau)'}`, q);
      });
    }
    R.ok = !R.issues.some((i) => i.lvl === 'err');
  });
}

// Contrôles pour l'onglet Contrôles.
export function echChecks(D) {
  return (D?.echIssues || []).map((i) => ({ ...i, msg: `Échangeur — ${i.msg}` }));
}
