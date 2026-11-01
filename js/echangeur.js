// echangeur.js — échangeur autoroutier : section courante, bretelles et boucles, divergents (Sd1, sortie depuis une
// bretelle) et convergents (Ei1, Eb11), gabarit de trompette, contrôles géométriques.
// Une bretelle a deux extrémités (from, to) : chacune est libre ou raccordée à l'autoroute (sens 1 / 2) ou à une autre
// bretelle ; son axe est orienté dans le sens de circulation, sommets (PI) compris.
// Sources : Cerema, « Les échangeurs sur routes de type Autoroute », éd. 2013, maj 2021 (noté [ECH]) ;
// ICTAAL éd. 2015, maj 2021 (noté [ICTAAL]). Les renvois § sont ceux de ces guides.
import * as G from './geom.js';
import { buildAlignment, offsetPolyline, polySegs, pathTangentAt, pathProject, cloMinLength, tangentLength, tangentLengths, cloXY } from './clotho.js';
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
export const J14_W = 2.0; // emprise de la balise J14 au musoir, déduite du schéma 6-1 (5,20 − 2,50 − 0,70)

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

// Route transversale (second axe) : autoroute (catégories ICTAAL) ou route ordinaire (2×1 voies par défaut :
// chaussée 7,00 m, BDD 2,00 m, berme 0,75 m — valeurs de départ à ajuster selon le parti d'aménagement).
export function crossParams(prj) {
  const h = prj.cross || {}, auto = h.kind === 'autoroute';
  const cat = auto ? HWY_CAT[h.cat] || HWY_CAT.L2 : null;
  return {
    on: !!h.on, kind: auto ? 'autoroute' : 'route', name: h.name || (auto ? 'Autoroute 2' : 'Route transversale'),
    cat: auto ? (HWY_CAT[h.cat] ? h.cat : 'L2') : '', C: cat, V: num(h.V, auto ? cat.V : 90),
    lanes: Math.max(1, Math.round(num(h.lanes, auto ? 2 : 1))), wLane: num(h.wLane, 3.5), bau: num(h.bau, auto ? 2.5 : 2.0),
    bdg: num(h.bdg, auto ? 1.0 : 0), median: num(h.median, auto ? 3.0 : 0), berme: num(h.berme, auto ? 1.0 : 0.75), pk0: num(h.pk0, 0),
    axis: (h.axis || []).map((p) => ({ x: +p.x, y: +p.y, r: +p.r || 0 })),
  };
}

// Ancien format (kind, sens, s…) → extrémités from / to ; l'axe d'une ancienne entrée était saisi depuis E.1,00 m.
export function normRamp(r) {
  if (r.from && r.to) return r;
  const out = { ...r }, ref = 'hwy' + (+r.sens === 2 ? 2 : 1);
  const e = { ref, s: r.s ?? 0, biseau: r.biseau ?? '', obl: r.obl ?? '', tpl: r.tpl ?? '' };
  if (r.kind === 'entree') { out.from = { ref: 'free' }; out.to = { ...e, ins: r.ins ?? '' }; out.pis = (r.pis || []).slice().reverse(); }
  else { out.from = e; out.to = { ref: 'free' }; }
  for (const k of ['kind', 'sens', 's', 'biseau', 'obl', 'tpl', 'ins']) delete out[k];
  return out;
}

const isHwyRef = (ref) => /^(hwy|x)[12]$/.test(ref || ''); // chaussée d'un axe (autoroute ou route transversale)

export function rampParams(prj, r0) {
  const r = normRamp(r0);
  const cat = RAMP_CAT[r.cat] || RAMP_CAT.b50;
  const lanes = Math.max(1, Math.round(num(r.lanes, cat.lanes)));
  const w = lanes * num(r.wLane, 3.5);
  const bdd = num(r.bdd, cat.bdd), bdg = num(r.bdg, cat.bdg), berme = num(r.berme, 0.75);
  const H = hwyParams(prj);
  const host = (ref) => {
    if (isHwyRef(ref)) {
      const road = ref[0] === 'x' ? 'cross' : 'hwy', Q = road === 'cross' ? crossParams(prj) : H;
      return { kind: 'hwy', ref, road, roadKind: road === 'cross' ? Q.kind : 'autoroute', sens: +ref[ref.length - 1], lanes: Q.lanes, bau: Q.bau, berme: Q.berme, V: Q.V, name: `${Q.name} sens ${ref[ref.length - 1]}` };
    }
    const pr = (prj.ramps || []).find((q) => q.id === ref);
    if (!pr || pr.id === r.id) return null;
    const pc = RAMP_CAT[pr.cat] || RAMP_CAT.b50;
    return { kind: 'ramp', ref, lanes: Math.max(1, Math.round(num(pr.lanes, pc.lanes))), bau: num(pr.bdd, pc.bdd), berme: num(pr.berme, 0.75), V: pc.V, name: pr.name || '?' };
  };
  // Divergent : biseau 150 m depuis l'autoroute (110 en relief difficile, 90 si une voie, § 4.1.3.1), 90 m depuis une
  // bretelle à une voie (150 m à deux voies, schéma 4-8) ; obliquité = (1,00 + l) / biseau, soit 3 % et 5 % (§ 6.1).
  // Convergent : obliquité 3 à 5 % (§ 6.1), voie d'insertion 200 m sur l'autoroute (schéma 5-1), 100 m sur une bretelle
  // à une voie (200 m à deux voies, schéma 5-6), biseau 75 m.
  const end = (e, role) => {
    const h = e && e.ref && e.ref !== 'free' ? host(e.ref) : null;
    if (!h) return null;
    const isH = h.kind === 'hwy';
    const biseau = num(e.biseau, role === 'div' ? (isH || h.lanes >= 2 ? 150 : 90) : 75);
    const p = role === 'div' ? (e.obl !== '' && e.obl != null ? num(e.obl, 3) / 100 : (1 + w) / biseau) : num(e.obl, isH ? 3 : 5) / 100;
    // Largeur au tpl ([ECH] § 6.1 et schéma 6-1) : BAU (ou BDD) de la chaussée émettrice + emprise de la balise J14
    // (2,00 m) + BDG de la bretelle portée à 0,70 m au moins (note 9) — 2,50 + 2,00 + 0,70 = 5,20 m dans le schéma 6-1.
    const tpl = num(e.tpl, Math.round((h.bau + J14_W + Math.max(bdg, 0.7)) * 100) / 100);
    const Lm = Math.max(0, (tpl - 1) / p);
    const ins = role === 'conv' ? num(e.ins, isH || h.lanes >= 2 ? 200 : 100) : 0;
    return { role, ref: e.ref, host: h, isHwy: isH, s: num(e.s, 0), biseau, p, tpl, Lm, ins };
  };
  const from = end(r.from, 'div'), to = end(r.to, 'conv');
  const auto = (e) => e.isHwy && e.host.roadKind === 'autoroute';
  const label = [from ? (auto(from) ? 'sortie Sd1' : 'sortie depuis ' + from.host.name) : '', to ? (auto(to) ? 'entrée Ei1' : (to.isHwy ? 'entrée sur ' : 'entrée Eb11 sur ') + to.host.name) : ''].filter(Boolean).join(' → ') || 'bretelle libre';
  return { r, name: r.name || 'B', cat: RAMP_CAT[r.cat] ? r.cat : 'b50', C: cat, lanes, w, bdd, bdg, berme, pente: num(r.pente, 0), from, to, label, pis: Array.isArray(r.pis) ? r.pis : [] };
}

// Repère d'une extrémité sur sa chaussée hôte : S.1,00 / E.1,00, point A de l'axe, direction de circulation de la
// bretelle (div : A + λ·dir ; conv : A − λ·dir).
export function endFrame(host, e, w) {
  const s = Math.max(0, Math.min(host.sEnd, e.s));
  const d = host.dirAt(s), nr = neg(rot90(d));
  const S1 = host.off(s, 1), A = add(S1, mul(nr, w / 2));
  const dir = e.role === 'div' ? norm(add(d, mul(nr, e.p))) : norm(sub(d, mul(nr, e.p)));
  return { s, d, nr, S1, A, dir };
}


// Voies d'entrecroisement ([ECH] § 3.4.3, 7.3.2, 7.3.3) : sur une même chaussée hôte, une entrée suivie d'une sortie
// dont le point S.1,00 est à Z ≥ 0 du point E.1,00, avec une voie d'insertion (+ biseau) qui atteindrait le biseau de la
// sortie, ou Z ≤ 750 m sur une autoroute : les deux accès sont reliés par une voie continue de 3,50 m contiguë à la
// chaussée, avec une BDD de 1,00 m. Rend id de l'entrée → { sid, sE, sS, Z } et id de la sortie → id de l'entrée.
export function weavePairs(prj) {
  const out = { byE: new Map(), byS: new Map() }, ev = new Map();
  for (const r of prj.ramps || []) {
    const rp = rampParams(prj, r);
    for (const e of [rp.from, rp.to]) {
      if (!e) continue;
      const sd = e.isHwy ? (e.host.sens === 1 ? 1 : -1) : 1;
      if (!ev.has(e.ref)) ev.set(e.ref, []);
      ev.get(e.ref).push({ id: r.id, e, u: e.s * sd, kind: e.role === 'div' ? 'S' : 'E' });
    }
  }
  for (const list of ev.values()) for (const E of list) {
    if (E.kind !== 'E') continue;
    const S = list.filter((q) => q.kind === 'S' && q.id !== E.id && q.u > E.u - E.e.Lm).sort((a, b) => a.u - b.u)[0];
    if (!S) continue;
    const Z = S.u - E.u, auto = E.e.isHwy && E.e.host.roadKind === 'autoroute';
    if (Z < 0 || out.byS.has(S.id)) continue;
    if (Z <= E.e.ins + E.e.biseau + S.e.biseau + 1e-6 || (auto && Z <= 750)) {
      out.byE.set(E.id, { sid: S.id, sE: E.e.s, sS: S.e.s, Z, pS: S.e.p });
      out.byS.set(S.id, E.id);
    }
  }
  return out;
}

// Construit l'échangeur ; ajoute prims, points, issues au projet dérivé D.
export function buildEchangeur(prj, D) {
  const H = hwyParams(prj);
  D.hwy = null; D.ramps = []; D.echIssues = [];
  if (!H.on || H.axis.length < 2) return;
  const issues = D.echIssues, prims = D.prims, TH = +prj.opts?.textH || 0.8;
  const P = (o) => prims.push(o);
  const pt = (name, p, extra = {}) => D.points.push({ n: D.points.length + 1, name, p, bi: null, kind: 'echangeur', ...extra });
  const text = (lay, p, s, rot = 0, align = 'center', h = TH) => P({ k: 'text', L: lay, p, s, rot: upright(rot), align, h });
  const WV = weavePairs(prj);
  D.weaves = WV;

  // --- Sections courantes (autoroute et route transversale) ----------------------------------
  const drawRoad = (key, H) => {
    const path = G.roundPolyline(H.axis, H.axis.map((p) => p.r));
    const sEnd = G.pathLen(path), isRoute = key === 'cross' && H.kind === 'route';
    const E0 = H.median / 2 + H.bdg, E1 = E0 + H.lanes * H.wLane, E2 = E1 + H.bau;
    const off = (delta) => G.offsetPath(path, delta);
    const road = { key, H, path, sEnd, E0, E1, E2, ok: sEnd > 1, isRoute };
    if (!road.ok) return road;
    // Rayons de la section courante [ICTAAL] tab. 3-1 (autoroutes).
    if (H.C) path.forEach((sg) => {
      if (sg.t !== 'A') return;
      if (sg.r < H.C.Rm) issues.push({ lvl: 'err', msg: `${H.name} : rayon ${fmt(sg.r)} m < Rm = ${H.C.Rm} m (catégorie ${H.cat}, ICTAAL tab. 3-1).` });
      else if (sg.r < H.C.Rdn) issues.push({ lvl: 'warn', msg: `${H.name} : rayon ${fmt(sg.r)} m < Rdn = ${H.C.Rdn} m → courbe déversée ; pas d'échangeur dans une courbe déversée (guide échangeurs § 1).` });
    });
    // Interruptions des rives et des bords de plate-forme au droit des bretelles (stations le long de l'axe).
    const gaps = { 1: { rive: [], bord: [] }, '-1': { rive: [], bord: [] } };
    for (const r of prj.ramps || []) {
      const rp = rampParams(prj, r), I = (a, b) => [Math.min(a, b), Math.max(a, b)];
      for (const e of [rp.from, rp.to]) {
        if (!e?.isHwy || e.host.road !== key) continue;
        const s0 = Math.max(0, Math.min(sEnd, e.s)), sg = e.host.sens === 1 ? -1 : 1, sd = e.host.sens === 1 ? 1 : -1;
        const bis = e.role === 'div' && WV.byS.has(r.id) ? 0 : e.biseau, wv = e.role === 'conv' ? WV.byE.get(r.id) : null;
        if (e.role === 'div') { gaps[sg].rive.push(I(s0 - sd * bis, s0)); gaps[sg].bord.push(I(s0 - sd * bis, s0 + sd * e.Lm)); }
        else { const sFin = wv ? wv.sS : s0 + sd * (e.ins + e.biseau); gaps[sg].rive.push(I(s0, sFin)); gaps[sg].bord.push(I(s0 - sd * e.Lm, sFin)); }
      }
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
      // Chaussée, BDG et BAU (ou BDD) revêtues ([ICTAAL] § 4.1.2, 4.1.3).
      P({ k: 'fill', L: 'CHAUSSEE', rings: [ring(off(sg * H.median / 2), off(sg * E2))], role: 'chaussee', rule: 'nonzero' });
      for (const segs of offPieces(sg * E2, gaps[sg].bord)) P({ k: 'path', L: 'BORDURE', segs });
      for (const segs of offPieces(sg * (E2 + H.berme), gaps[sg].bord)) P({ k: 'path', L: 'ACCOTEMENT', segs });
      for (let i = 1; i < H.lanes; i++) P({ k: 'path', L: 'MARQUAGE', segs: off(sg * (E0 + i * H.wLane)), dash: [3, 10], wm: 0.15 }); // T1 3u
      for (const segs of offPieces(sg * (E1 - 0.1), gaps[sg].rive)) P({ k: 'path', L: 'MARQUAGE', segs, wm: 0.15 }); // rive continue 3u
      if (H.median > 0) P({ k: 'path', L: 'MARQUAGE', segs: off(sg * (E0 + 0.1)), wm: 0.15 }); // rive gauche 3u
    }
    if (H.median > 0) {
      P({ k: 'fill', L: 'ILOT_SEP', rings: [ring(off(H.median / 2), off(-H.median / 2))], role: 'ilot' });
      P({ k: 'path', L: 'BORDURE', segs: off(H.median / 2) }); P({ k: 'path', L: 'BORDURE', segs: off(-H.median / 2) });
    } else P({ k: 'path', L: 'MARQUAGE', segs: off(0), dash: [3, 10], wm: 0.15 }); // ligne axiale T1 (chaussée bidirectionnelle)
    P({ k: 'path', L: 'AXE', segs: path, role: 'principale' });
    text('COTATION', G.pathPointAt(path, Math.min(sEnd, 30)), `${H.name} — ${isRoute ? `route ${H.median > 0 ? '2×' : ''}${H.lanes * (H.median > 0 ? 1 : 2)} voie(s)` : `${H.cat}, 2×${H.lanes} voies`}`, ang(pathTangentAt(path, 30)), 'center', TH * 1.2);
    // PK / PR tous les 100 m.
    for (let st = 0; st <= sEnd + 1e-6; st += 100) {
      const p = G.pathPointAt(path, st), tg = pathTangentAt(path, st), n = rot90(tg);
      P({ k: 'path', L: 'COTATION', segs: [G.L(add(p, mul(n, -1)), add(p, mul(n, 1)))] });
      text('COTATION', add(p, mul(n, E2 + H.berme + 2.5)), `${isRoute ? 'PR' : 'PK'} ${fmt((H.pk0 + st) / 1000, 3)}`, ang(tg), 'center', TH * 0.8);
      pt(`${H.name} · ${isRoute ? 'PR' : 'PK'} ${fmt((H.pk0 + st) / 1000, 3)}`, p);
    }
    pt(`${H.name} · origine`, G.pathPointAt(path, 0)); pt(`${H.name} · fin`, G.pathPointAt(path, sEnd));
    return road;
  };
  const hwy = drawRoad('hwy', H);
  D.hwy = hwy;
  if (!hwy.ok) return;
  const XP = crossParams(prj);
  const crossR = XP.on && XP.axis.length >= 2 ? drawRoad('cross', XP) : null;
  D.cross = crossR?.ok ? crossR : null;

  // --- Bretelles ------------------------------------------------------------------------
  // Chaussées hôtes : stations le long de l'axe de l'autoroute (sens 1 : croissantes, sens 2 : décroissantes dans le sens
  // de circulation) ou le long de l'axe d'une bretelle ; off(st, o) : point à o m à droite de la rive droite.
  const mkOff = (h) => { h.off = (st, o) => add(h.pointAt(st), mul(neg(rot90(h.dirAt(st))), h.edgeOff(st) + o)); return h; };
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const hostRoad = (road, sens) => {
    const sd = sens === 1 ? 1 : -1, { path, sEnd, E1, H: Q } = road;
    return mkOff({
      kind: 'hwy', road: road.key, roadKind: road.isRoute ? 'route' : 'autoroute', ref: (road.key === 'cross' ? 'x' : 'hwy') + sens, sens, sd, sEnd, name: `${Q.name} sens ${sens}`, lanes: Q.lanes, bau: Q.bau, berme: Q.berme, V: Q.V, C: Q.C, path,
      pointAt: (st) => G.pathPointAt(path, cl(st, 0, sEnd)),
      dirAt: (st) => { const t = pathTangentAt(path, cl(st, 0, sEnd)); return sd === 1 ? t : neg(t); },
      edgeOff: () => E1,
    });
  };
  const hostRamp = (R) => mkOff({
    kind: 'ramp', ref: R.id, R, sd: 1, sEnd: R.al.length, name: R.name, lanes: R.rp.lanes, bau: R.rp.bdd, berme: R.rp.berme, V: R.C.V,
    pointAt: (s) => R.al.pointAt(cl(s, 0, R.al.length)), dirAt: (s) => unit(R.al.headAt(cl(s, 0, R.al.length))), edgeOff: (s) => -R.offR(cl(s, 0, R.al.length)),
  });
  const hosts = { hwy1: hostRoad(hwy, 1), hwy2: hostRoad(hwy, 2), ...(D.cross ? { x1: hostRoad(D.cross, 1), x2: hostRoad(D.cross, 2) } : {}) };
  D.echHost = (ref) => { if (hosts[ref]) return hosts[ref]; const R = D.ramps.find((q) => q?.id === ref); return R?.al ? R.host || (R.host = hostRamp(R)) : null; };
  const along = (h, s0, s1, f, step = 2) => { const pts = [], n = Math.max(2, Math.ceil(Math.abs(s1 - s0) / step)); for (let i = 0; i <= n; i++) { const st = s0 + ((s1 - s0) * i) / n; pts.push(h.off(st, f(st))); } return pts; };

  // Ordre de calcul : une bretelle après celles auxquelles elle se raccorde.
  const list = (prj.ramps || []).map((r, idx) => ({ r: normRamp(r), idx }));
  const byId = new Map(list.map((q) => [q.r.id, q]));
  const order = [], state = new Map();
  const visit = (q) => {
    if (state.get(q)) return;
    state.set(q, 1);
    for (const e of [q.r.from, q.r.to]) { const dep = e && byId.get(e.ref); if (dep && dep !== q && !state.get(dep)) visit(dep); }
    state.set(q, 2); order.push(q);
  };
  list.forEach(visit);
  D.ramps = new Array(list.length).fill(null);
  const built = new Map();

  // --- Phase 1 : axes et contrôles -----------------------------------------------------
  for (const q of order) {
    const rp = rampParams(prj, q.r), name = rp.name, C = rp.C;
    const R = { idx: q.idx, id: q.r.id, name, rp, C, cat: rp.cat, w: rp.w, label: rp.label, issues: [], ok: false, children: [] };
    D.ramps[q.idx] = R;
    const say = (lvl) => (msg) => { issues.push({ lvl, msg: `${name} : ${msg}` }); R.issues.push({ lvl, msg }); };
    const err = say('err'), warn = say('warn'), info = say('info');
    const hostOf = (e) => {
      if (!e) return null;
      if (e.isHwy) { if (!hosts[e.ref]) err(`${e.host.name} : axe non dessiné.`); return hosts[e.ref] || null; }
      const Pr = built.get(e.ref);
      if (!Pr?.al) { err(`raccordement à ${e.host.name} impossible (bretelle non calculée ou raccordement circulaire).`); return null; }
      return Pr.host || (Pr.host = hostRamp(Pr));
    };
    const hF = hostOf(rp.from), hT = hostOf(rp.to);
    const Fs = hF ? endFrame(hF, rp.from, rp.w) : null, Ft = hT ? endFrame(hT, rp.to, rp.w) : null;
    Object.assign(R, { hF, hT, Fs, Ft });
    for (const [h, F] of [[hF, Fs], [hT, Ft]]) {
      if (h?.kind !== 'hwy') continue;
      if (!h.C) continue;
      const hr = (() => { let acc = 0; for (const sg of h.path) { const l = G.segLen(sg); if (F.s <= acc + l) return sg.t === 'A' ? sg.r : 0; acc += l; } return 0; })();
      if (hr && hr < 1.5 * h.C.Rdn) warn(`point d'accès dans une courbe de rayon ${fmt(hr)} m < 1,5 Rdn (${fmt(1.5 * h.C.Rdn)} m) : point singulier à éviter (guide échangeurs § 1).`);
    }
    // Sommets : le premier est projeté sur la ligne d'obliquité du divergent, le dernier sur celle du convergent ;
    // les distances sont augmentées jusqu'à obtenir un alignement droit ≥ Lm (prolongement de l'obliquité, § 6.1).
    const up = rp.pis.map((p) => ({ x: +p.x, y: +p.y, R: num(p.R, 0), A: num(p.A, 0), loop: !!p.loop, link: !!p.link }));
    if (up.length < (Fs ? 0 : 1) + (Ft ? 0 : 1) || (!Fs && !Ft && up.length < 2)) { err('extrémité libre sans sommet : ajoutez des sommets.'); continue; }
    const both1 = Fs && Ft && up.length === 1;
    let lamS = Fs && up.length ? Math.max(10, G.dot(sub(up[0], Fs.A), Fs.dir)) : 0;
    let lamT = Ft && up.length ? Math.max(10, G.dot(sub(up[up.length - 1], Ft.A), neg(Ft.dir))) : 0;
    let X = null;
    if (both1) { const I = G.lineLine(Fs.A, Fs.dir, Ft.A, neg(Ft.dir)); if (I && I.t > 10 && G.dot(sub(I.p, Ft.A), neg(Ft.dir)) > 10) X = I.p; else warn('les lignes d\'obliquité des deux extrémités ne se coupent pas en avant : ajoutez un sommet.'); }
    let al;
    for (let pass = 0; pass < 10; pass++) {
      if (both1) up[0] = { ...up[0], ...(X || add(Fs.A, mul(Fs.dir, lamS))) };
      else {
        if (Fs && up.length) up[0] = { ...up[0], ...add(Fs.A, mul(Fs.dir, lamS)) };
        if (Ft && up.length) up[up.length - 1] = { ...up[up.length - 1], ...sub(Ft.A, mul(Ft.dir, lamT)) };
      }
      const pts = [...(Fs ? [{ ...Fs.A, R: 0, A: 0 }] : []), ...up, ...(Ft ? [{ ...Ft.A, R: 0, A: 0 }] : [])];
      al = buildAlignment(pts, { name });
      R.pts = pts;
      if (both1 || al.elems.length < 2) break;
      let again = false;
      const e0 = al.elems[0], eN = al.elems[al.elems.length - 1];
      if (Fs && up.length) { const l0 = e0.kind === 'L' ? e0.len : 0; if (l0 < rp.from.Lm - 1e-6) { lamS += (rp.from.Lm - l0) * 1.5 + 0.5; again = true; } }
      if (Ft && up.length) { const lN = eN.kind === 'L' ? eN.len : 0; if (lN < rp.to.Lm - 1e-6) { lamT += (rp.to.Lm - lN) * 1.5 + 0.5; again = true; } }
      if (!again) break;
    }
    R.pis = up; R.al = al; R.length = al.length;
    al.issues.forEach((i) => (i.lvl === 'err' ? err : warn)(i.msg.replace(`${name} : `, '').replace(`${name} `, '')));
    if (!(al.length > 1)) { err('axe de bretelle trop court.'); continue; }
    const half = rp.w / 2;
    // Rayons : les valeurs limites du tab. 3-1 sont mesurées au bord intérieur de la chaussée, sans la surlargeur (§ 3.2.1) ;
    // les contrôles, dévers et vitesses portent donc sur Ri = R(axe) − l/2.
    const rIn = (Rax) => Rax - half;
    R.rIn = rIn;
    // Surlargeur (§ 3.4.2) : 50/R par voie, à l'intérieur des courbes de rayon < 100 m, introduite linéairement le long des
    // clothoïdes (proportionnelle à la courbure, nulle ailleurs).
    R.surl = (s) => { const e = al.elemAt(s); if (!e || e.kind === 'L' || !(rIn(e.R) < 100)) return 0; const k = Math.abs(al.curvAt(s)); return k > 1e-9 ? (50 * rp.lanes * k * e.R) / rIn(e.R) : 0; };
    R.offL = (s) => half + (al.curvAt(s) > 0 ? R.surl(s) : 0);
    R.offR = (s) => -(half + (al.curvAt(s) < 0 ? R.surl(s) : 0));
    R.sTplS = Fs ? Math.min(al.length, rp.from.Lm) : 0;
    R.sTplE = Ft ? Math.min(al.length, rp.to.Lm) : 0;
    // Contrôles des rayons [ECH] tab. 3-1, § 3.2.1 à 3.2.3 ; boucles § 3.2.1, 6.2.4.
    // Courbes : sommets successifs de même sens reliés sans clothoïde (« arc continu ») = une seule courbe, éventuellement
    // à plusieurs rayons (courbe composée) ; R = plus petit rayon, Rs = rayons successifs.
    const curves = [];
    for (const t of al.tangents) {
      const g = curves[curves.length - 1];
      if (g && t.link && t.sg === g.sg) { g.defl += t.defl; g.L2 = t.L2; g.last = t.i; g.loop = g.loop || t.loop; g.R = Math.min(g.R, t.R); g.Rs.push(t.R); g.Rlast = t.R; }
      else curves.push({ i: t.i, last: t.i, R: t.R, Rs: [t.R], Rfirst: t.R, Rlast: t.R, sg: t.sg, defl: t.defl, L1: t.L1, L2: t.L2, A: t.A, loop: t.loop, linkIn: !!t.link });
    }
    curves.forEach((g, j) => { g.linkOut = !!curves[j + 1]?.linkIn; });
    for (const g of curves) { g.loop = g.loop || g.defl >= (150 * Math.PI) / 180; g.L = Math.min(g.L1, g.L2); }
    curves.forEach((c, j) => {
      const Rr = rIn(c.R), pis = c.last > c.i ? `PI ${c.i}–${c.last}` : `PI ${c.i}`, tag = c.loop ? `boucle (${pis})` : pis;
      if (c.loop) {
        if (rp.lanes > 1) err(`${tag} : une boucle ne comporte qu'une voie (§ 3.2.1, 6.2.4).`);
        const Rmin = rp.cat === 'b50' ? 40 : C.Rm;
        if (Rr < Rmin) err(`${tag} : Ri = ${fmt(Rr)} m < ${Rmin} m (${C.label}, tab. 3-1, bord intérieur).`);
        else if (rp.cat === 'b50' && Rr > 60) warn(`${tag} : Ri = ${fmt(Rr)} m > 60 m — préconisé ≤ 60 m pour éviter les mises en vitesse (§ 3.2.1).`);
        info(`${tag} : Ri = ${fmt(Rr)} m, vitesse associée ${fmt(speedOfRadius(Rr), 0)} km/h, développement ${fmt((c.defl * 180) / Math.PI, 0)}°.`);
      } else if (Rr < C.Rm) err(`${tag} : Ri = ${fmt(Rr)} m < Rm = ${C.Rm} m (${C.label}, tab. 3-1).`);
      else if (Rr < C.Rdn) info(`${tag} : Ri = ${fmt(Rr)} m < Rdn = ${C.Rdn} m → courbe déversée à ${fmt(deversOfRadius(Rr, C), 1)} % (§ 3.5).`);
      if (rp.cat === 'b50' && Rr < 54) warn(`${tag} : Ri = ${fmt(Rr)} m < 54 m → vitesse < 50 km/h (§ 3.2.1 : 54 m conseillé).`);
      if (j === 0 && rp.from?.isHwy) {
        if (c.loop) {
          if (rp.from.host.roadKind !== 'autoroute') { /* sortie en boucle depuis une route ordinaire : pas de restriction */ } else {
          warn(`sortie en boucle : à titre exceptionnel et sur justification (§ 6.2.4).`);
          const l0 = al.elems[0]?.kind === 'L' ? al.elems[0].len : 0;
          if (l0 < rp.from.Lm + 60 - 1e-6) err(`sortie en boucle : collectrice de ${fmt(l0 - rp.from.Lm)} m au-delà du tpl < 60 m (§ 6.2.4).`);
          }
        } else if (Rr < C.Rfirst) (C.branche ? warn : err)(`premier rayon de sortie Ri = ${fmt(Rr)} m < ${C.Rfirst} m (${C.branche ? '1,5 Rdn, branche' : '100 m hors boucle, bretelle'} ; § 3.2.2).`);
      }
      // Clothoïdes aux extrémités non raccordées en arc continu, avec le rayon de l'arc qu'elles abordent.
      for (const [Rx, Lx, linked] of [[c.Rfirst, c.L1, c.linkIn], [c.Rlast, c.L2, c.linkOut]]) {
        if (linked) continue;
        const Ri_ = rIn(Rx), Lmin = cloMinLength(Rx, Math.abs(deversOfRadius(Ri_, C) - 2.5), rp.lanes);
        if (Ri_ <= 1.5 * C.Rdn && Lx + 1e-6 < Lmin) warn(`${tag} : clothoïde L = ${fmt(Lx)} m < ${fmt(Lmin)} m (max(${rp.lanes >= 2 ? 'R/9 ; 14|Δd|' : '6R^0,4 ; 7|Δd|'}), § 3.2.3) → A ≥ ${fmt(Math.sqrt(Lmin * Rx))}.`);
        if (Ri_ <= C.Rdn && Lx <= 0) warn(`${tag} : courbe de rayon Ri ${fmt(Ri_)} m ≤ Rdn sans clothoïde (§ 3.2.3).`);
      }
      for (let q = 1; q < c.Rs.length; q++) {
        const ra = rIn(c.Rs[q - 1]), rb = rIn(c.Rs[q]);
        if (Math.abs(ra - rb) > 1e-6 && !(C.branche ? ra <= 1.5 * rb && rb <= 1.5 * ra : ra < 2 * rb && rb < 2 * ra)) warn(`${tag} : courbe composée Ri ${fmt(ra)} → ${fmt(rb)} m : rapport ${C.branche ? '≤ 1,5' : '< 2'} requis (§ 3.2.2).`);
      }
      if (j > 0) {
        const R1 = rIn(curves[j - 1].R), R2 = Rr;
        const okSeq = R2 >= 1.5 * C.Rdn || (C.branche ? R1 <= 1.5 * R2 : R1 < 2 * R2);
        if (!okSeq) warn(`enchaînement PI ${curves[j - 1].last} → PI ${c.i} : Ri1 = ${fmt(R1)} m, Ri2 = ${fmt(R2)} m ne respecte pas ${C.branche ? 'R1 ≤ 1,5 R2' : 'R1 < 2 R2'} (§ 3.2.2).`);
      }
    });
    R.curves = curves;
    // Alignements droits intermédiaires ([ECH] § 3.2.2 : ≥ 60 m bretelle / 100 m branche entre courbes de même sens < 1,5 Rdn).
    const curveElems = al.elems.filter((e) => e.kind === 'A');
    for (let i = 1; i < curveElems.length; i++) {
      const a = curveElems[i - 1], b = curveElems[i];
      if (a.sg !== b.sg || a.R >= 1.5 * C.Rdn || b.R >= 1.5 * C.Rdn) continue;
      if (al.elems.indexOf(b) === al.elems.indexOf(a) + 1) continue; // arc continu (courbe composée)
      const lad = al.elems.filter((e) => e.kind === 'L' && e.s0 > a.s0 && e.s0 < b.s0).reduce((acc, e) => acc + e.len, 0);
      const min = C.branche ? 100 : 60;
      if (lad < min && !(C.branche ? false : a.R < b.R)) warn(`alignement droit de ${fmt(lad)} m entre deux courbes de même sens < 1,5 Rdn : ${min} m minimum (§ 3.2.2).`);
    }
    // Zones de décélération / d'accélération [ECH] § 3.2.5 ; vitesse au point S.1,00 m : 70 km/h depuis l'autoroute ou une
    // bretelle à deux voies, 50 km/h depuis une bretelle à une voie (§ 4.3).
    const grade = rp.pente / 100, first = curves[0], last = curves[curves.length - 1];
    const e0 = al.elems[0], eN = al.elems[al.elems.length - 1];
    R.lad = e0.kind === 'L' ? e0.len : 0; R.ladE = eN.kind === 'L' ? eN.len : 0;
    if (Fs) {
      if (R.lad + 1e-6 < rp.from.Lm) err(`alignement droit depuis S.1,00 m de ${fmt(R.lad)} m < Lm = ${fmt(rp.from.Lm)} m (§ 6.1).`);
      const vS = rp.from.isHwy || rp.from.host.lanes >= 2 ? 70 : 50;
      const Vs = vS / 3.6, VR = (first ? speedOfRadius(rIn(first.R)) : 70) / 3.6;
      const Ld = Math.max(0, (Vs * Vs - VR * VR) / (2 * (1.5 + 10 * grade)));
      R.Ld = Ld; R.Ldisp = R.lad + (first?.L || 0); R.VR = VR * 3.6; R.Vs = vS;
      if (first && Ld > R.Ldisp + 1e-6) err(`zone de décélération ${fmt(R.Ldisp)} m < Ld = ${fmt(Ld)} m (${vS} → ${fmt(VR * 3.6)} km/h, Ri = ${fmt(rIn(first.R))} m, p = ${fmt(rp.pente, 1)} %, § 3.2.5).`);
      if (rp.from.isHwy && ![150, 110, 90].includes(rp.from.biseau)) info(`biseau de ${fmt(rp.from.biseau)} m : 150 m en règle générale, 110 m en relief difficile, 90 m si une seule voie (§ 4.1.3.1).`);
      if (!rp.from.isHwy) {
        const Pr = hF.R, st0 = Fs.s - (WV.byS.has(R.id) ? 0 : rp.from.biseau);
        if (st0 < 0) warn(`le biseau commence avant l'origine de ${Pr.name} (${fmt(st0)} m).`);
        if (Pr.Fs && st0 - Pr.sTplS < 25 - 1e-6) warn(`${fmt(st0 - Pr.sTplS)} m entre le tpl de ${Pr.name} et le début du biseau : 25 m minimum (§ 4.3).`);
        Pr.children.push({ a: st0, b: Fs.s + rp.from.Lm });
      }
    }
    if (Ft) {
      if (R.ladE + 1e-6 < rp.to.Lm) err(`alignement droit jusqu'à E.1,00 m de ${fmt(R.ladE)} m < Lm = ${fmt(rp.to.Lm)} m (§ 6.1).`);
      if (rp.to.p < 0.03 - 1e-9 || rp.to.p > 0.05 + 1e-9) warn(`obliquité d'entrée ${fmt(rp.to.p * 100, 1)} % hors de 3 à 5 % (§ 6.1).`);
      if (rp.to.isHwy) {
        const VE = 55 / 3.6, VR = (last ? speedOfRadius(rIn(last.R)) : 70) / 3.6;
        const La = Math.max(0, (VE * VE - VR * VR) / (2 * (1 - 10 * grade)));
        R.La = La; R.Ladisp = R.ladE + (last?.L || 0); R.VRe = VR * 3.6;
        if (last && La > R.Ladisp + 1e-6) err(`zone d'accélération ${fmt(R.Ladisp)} m < La = ${fmt(La)} m (${fmt(VR * 3.6)} → 55 km/h, Ri = ${fmt(rIn(last.R))} m, rampe ${fmt(rp.pente, 1)} %, § 3.2.5).`);
      } else {
        const Pr = hT.R, sFin = WV.byE.get(R.id)?.sS ?? Ft.s + rp.to.ins + rp.to.biseau;
        if (sFin > Pr.al.length) warn(`la voie d'insertion dépasse l'extrémité de ${Pr.name} (${fmt(sFin - Pr.al.length)} m).`);
        if (Pr.Ft && Pr.al.length - Pr.sTplE - sFin < 25 - 1e-6) warn(`${fmt(Pr.al.length - Pr.sTplE - sFin)} m entre la fin de l'insertion et le tpl de ${Pr.name} : 25 m minimum (§ 5.3).`);
        Pr.children.push({ a: Ft.s - rp.to.Lm, b: sFin });
      }
    }
    R.deversAt = (s) => { const k = al.curvAt(s); const Rr = Math.abs(k) > 1e-9 ? rIn(1 / Math.abs(k)) : Infinity; return Rr >= C.Rdn ? -2.5 : (k > 0 ? 1 : -1) * deversOfRadius(Rr, C); }; // + vers la gauche
    R.ok = !R.issues.some((i) => i.lvl === 'err');
    built.set(R.id, R);
  }

  // --- Entrecroisements (§ 7.3) : entrée suivie d'une sortie sur la même chaussée hôte -------------------------
  {
    const ev = new Map(), push = (h, o) => { if (!ev.has(h.ref)) ev.set(h.ref, { h, list: [] }); ev.get(h.ref).list.push(o); };
    for (const R of D.ramps) {
      if (!R?.al) continue;
      if (R.Fs) push(R.hF, { u: R.Fs.s * R.hF.sd, kind: 'S', name: R.name, p: R.rp.from.p, id: R.id });
      if (R.Ft) push(R.hT, { u: R.Ft.s * R.hT.sd, kind: 'E', name: R.name, Lm: R.rp.to.Lm, id: R.id });
    }
    for (const { h, list } of ev.values()) {
      list.sort((a, b) => a.u - b.u);
      list.forEach((e, k) => {
        if (e.kind !== 'E') return;
        // Sortie suivante : S.1,00 en aval du nez d'entrée (Z < 0 : voies d'insertion et de décélération confondues).
        const x = list.filter((q) => q.kind === 'S' && q.u > e.u - e.Lm).sort((a, b) => a.u - b.u)[0];
        if (!x) return;
        const Z = x.u - e.u, Z15 = Z - 0.5 / x.p, tag = `${h.name} : ${e.name} (E.1,00) → ${x.name} (S.1,00)${Z < 0 ? ' — S.1,00 en amont de E.1,00 : voie auxiliaire continue' : ''}`;
        const say = (lvl, msg) => issues.push({ lvl, msg: `${tag} : ${msg}` });
        if (Z < 0) say('err', `zones de musoir superposées (S.1,00 à ${fmt(-Z)} m en amont de E.1,00) : pas d'entrecroisement possible, éloigner les accès (§ 6.1, 7.3).`);
        else if (WV.byE.get(e.id)?.sid === x.id) say('info', `voie d'entrecroisement de 3,50 m + BDD 1,00 m dessinée de E.1,00 à S.1,00 (Z = ${fmt(Z)} m, § 3.4.3).`);
        if (h.kind === 'ramp') { if (Z < 275 - 1e-6) say('warn', `entrecroisement sur bretelle / collectrice Z = ${fmt(Z)} m < 275 m (§ 7.3.3).`); }
        else if (h.roadKind === 'route') say('info', `entrecroisement Z = ${fmt(Z)} m sur route ordinaire (hors du champ du guide échangeurs : à vérifier selon le guide de la route).`);
        else if (Z15 >= 1200) return;
        else if (Z < 500) say('err', `Z = ${fmt(Z)} m < 500 m : l'entrecroisement doit être reporté sur une voie collectrice (§ 7.3.2, 7.3.3).`);
        else if (Z <= 750) say('warn', `Z = ${fmt(Z)} m (500 à 750 m) : voie d'entrecroisement à prévoir, non dessinée (§ 7.3.2).`);
        else say('warn', `E.1,00 → S.1,50 = ${fmt(Z15)} m < 1 200 m et Z = ${fmt(Z)} m > 750 m : ni enchaînement direct ni entrecroisement conforme (§ 7.3.1, 7.3.2).`);
      });
    }
  }

  // --- Phase 2 : dessin -----------------------------------------------------------------
  const cutRanges = (L, gaps) => {
    let cuts = [[0, L]];
    for (const { a, b } of gaps) for (let i = cuts.length - 1; i >= 0; i--) {
      const [c, d] = cuts[i]; if (b <= c || a >= d) continue;
      cuts.splice(i, 1, ...[[c, a], [b, d]].filter(([x, y]) => y - x > 0.5));
    }
    return cuts;
  };
  for (const q of order) {
    const R = D.ramps[q.idx];
    if (!R?.al || !(R.al.length > 1)) continue;
    const { rp, al, Fs, Ft, hF, hT, name, C } = R, L = al.length, half = rp.w / 2, stp = 1;
    const { offL, offR } = R;
    const lft = (s) => offL(s) + rp.bdg, rgt = (s) => offR(s) - rp.bdd;
    // Plate-forme de la bretelle (chaussée + BDG + BDD), revêtue.
    const body = [...offsetPolyline(al, rgt, stp), ...offsetPolyline(al, lft, stp).reverse()];
    P({ k: 'fill', L: 'CHAUSSEE', rings: [polySegs([...body, body[0]])], role: 'chaussee', rule: 'nonzero' });
    P({ k: 'path', L: 'BORDURE', segs: polySegs(offsetPolyline(al, offL, stp)), role: 'principale' });
    const sA = R.sTplS, sB = L - R.sTplE;
    if (sB - sA > 0.5) {
      P({ k: 'path', L: 'BORDURE', segs: polySegs(offsetPolyline(al, lft, stp, sA, sB)) });
      P({ k: 'path', L: 'ACCOTEMENT', segs: polySegs(offsetPolyline(al, (s) => lft(s) + rp.berme, stp, sA, sB)) });
    }
    for (const [a, b] of cutRanges(L, R.children)) {
      P({ k: 'path', L: 'BORDURE', segs: polySegs(offsetPolyline(al, offR, stp, a, b)), role: 'principale' });
      P({ k: 'path', L: 'BORDURE', segs: polySegs(offsetPolyline(al, rgt, stp, a, b)) });
      P({ k: 'path', L: 'ACCOTEMENT', segs: polySegs(offsetPolyline(al, (s) => rgt(s) - rp.berme, stp, a, b)) });
    }
    P({ k: 'path', L: 'AXE', segs: al.path, role: 'secondaire', arrow: true });
    const accLAt = (s) => add(al.pointAt(s), mul(rot90(unit(al.headAt(s))), lft(s)));
    // Divergent (§ 4.1.3.1, 4.3, 6.1, 6.2 ; schémas 4-1, 4-8, 6-1, 6-2) : la voie de sortie se forme sur l'accotement de la
    // chaussée émettrice (BAU ou BDD), qui est interrompu et hachuré de S.1,00 m au tpl, puis rétabli après le nez.
    if (Fs) {
      // Sortie précédée d'une voie d'entrecroisement : pas de biseau, la voie arrive à pleine largeur (dessinée avec l'entrée).
      const woven = WV.byS.has(R.id);
      const h = hF, e = rp.from, sd = h.sd, st0 = Fs.s - sd * (woven ? 0 : e.biseau), sNose = Fs.s + sd * R.sTplS;
      const k = (st) => cl((st - st0) / (Fs.s - st0), 0, 1), lane = (st) => (1 + rp.w) * k(st);
      const outer = woven ? [] : along(h, st0, Fs.s, (st) => Math.max(h.bau, lane(st) + rp.bdd));
      const berm = along(h, st0, Fs.s, (st) => Math.max(h.bau + h.berme, lane(st) + rp.bdd + rp.berme));
      const edgeN = offsetPolyline(al, offL, 2, 0, R.sTplS);
      const poly = [...along(h, st0, sNose, () => 0), ...edgeN.slice().reverse(), ...outer.slice().reverse()];
      P({ k: 'fill', L: 'CHAUSSEE', rings: [polySegs([...poly, poly[0]])], role: 'chaussee', rule: 'nonzero' });
      if (!woven) {
        P({ k: 'path', L: 'BORDURE', segs: polySegs(along(h, st0, Fs.s, lane)), role: 'principale' });
        P({ k: 'path', L: 'BORDURE', segs: polySegs(outer) }); P({ k: 'path', L: 'ACCOTEMENT', segs: polySegs(berm) });
        P({ k: 'path', L: 'MARQUAGE', segs: polySegs(along(h, st0, Fs.s, () => 0)), dash: [3, 3.5], wm: 0.15 }); // T2 3u
      }
      const mus = [...along(h, Fs.s, sNose, () => 0), ...edgeN.slice().reverse()];
      P({ k: 'hatch', L: 'MARQUAGE', lines: G.hatchPolygon(mus, ang(Fs.d) + Math.PI / 4, 1.0), wm: 0.12 });
      P({ k: 'path', L: 'MARQUAGE', segs: polySegs(mus), wm: 0.15 });
      P({ k: 'path', L: 'BORDURE', segs: polySegs([h.off(sNose, h.bau), accLAt(R.sTplS)]) }); // nez du musoir (tpl)
      const pJ14 = h.off(sNose + sd * 1.5, h.bau + J14_W / 2); // balise J14 sur le nez (assimilée au point S.5,00 m, § 2.3.1)
      P({ k: 'circle', L: 'SIGNALISATION', c: pJ14, r: 0.5 });
      text('SIGNALISATION', h.off(sNose + sd * 6, h.bau + J14_W / 2), 'J14', ang(Fs.d), 'center', TH * 0.8);
      if (!woven) pt(`${name} · origine du biseau (${fmt(e.biseau)} m)`, h.off(st0, 0));
      pt(`${name} · S.1,00 m`, Fs.S1);
      pt(`${name} · tpl (${fmt(e.tpl)} m)`, h.off(sNose, e.tpl / 2)); pt(`${name} · balise J14`, pJ14);
      if (!woven) text('COTATION', h.off(st0, -1.5), `origine du biseau ${fmt(e.biseau)} m`, ang(Fs.d), 'center', TH * 0.8);
      text('COTATION', h.off(Fs.s, -1.5), 'S.1,00', ang(Fs.d), 'center', TH * 0.8);
      text('COTATION', h.off(sNose, -1.5), `tpl ${fmt(e.tpl)} m · Lm ${fmt(e.Lm)} m`, ang(Fs.d), 'center', TH * 0.8);
      // Signalisation de direction (schémas 4-1, 4-8, tab. 4-2) : D30 au point S.1,50 m ; D40 et D50 en amont (autoroute).
      const sD30 = Fs.s + sd * 0.5 / e.p;
      const signs = [['D30', 0], ...(h.kind === 'hwy' ? [['D40', { 90: 750, 110: 900, 130: 1000 }[h.V] || 900], ['D50', { 90: 1500, 110: 1800, 130: 2000 }[h.V] || 1800]] : [])];
      for (const [code, back] of signs) {
        const st = sD30 - sd * back;
        if (st < 0 || st > h.sEnd) { if (back) { const msg = `${code} à ${fmt(back)} m en amont de D30 : hors de l'axe dessiné.`; issues.push({ lvl: 'info', msg: `${name} : ${msg}` }); R.issues.push({ lvl: 'info', msg }); } continue; }
        const qp = h.off(st, code === 'D30' ? 1.5 + rp.w + rp.bdd + 0.7 : h.bau + h.berme);
        P({ k: 'circle', L: 'SIGNALISATION', c: qp, r: 0.25 });
        text('SIGNALISATION', add(qp, mul(neg(rot90(h.dirAt(st))), 1.5)), code, ang(h.dirAt(st)), 'center', TH * 0.8);
        pt(`${name} · ${code}${back ? ` (${fmt(back)} m en amont de D30)` : ' (S.1,50 m)'}`, qp);
      }
    }
    // Convergent (schémas 5-1, 5-6) : voie d'insertion parallèle puis biseau de rabattement ; l'accotement de la chaussée
    // réceptrice est reporté à l'extérieur de la voie d'insertion (raccord de principe sur 50 m).
    if (Ft) {
      // Voie d'entrecroisement (§ 3.4.3) : la voie d'insertion se prolonge jusqu'au point S.1,00 de la sortie suivante,
      // 3,50 m contiguë à la chaussée + BDD de 1,00 m ; le mètre de séparation se referme / se rouvre à l'obliquité.
      const wv = WV.byE.get(R.id);
      const h = hT, e = rp.to, sd = h.sd, sNoseE = Ft.s - sd * R.sTplE;
      const insL = wv ? wv.Z : e.ins, bisL = wv ? 0 : e.biseau, sIns = Ft.s + sd * insL, sFin = sIns + sd * bisL;
      const u = (st) => (st - Ft.s) * sd;
      const lane = wv ? (st) => rp.w + Math.max(0, 1 - u(st) * e.p, 1 - (insL - u(st)) * wv.pS)
        : (st) => (u(st) <= e.ins ? rp.w + Math.max(0, 1 - u(st) * e.p) : rp.w * Math.max(0, 1 - (u(st) - e.ins) / e.biseau));
      const sh = wv ? () => 1.0 : (st) => (u(st) <= e.ins ? rp.bdd + (h.bau - rp.bdd) * Math.min(1, u(st) / 50) : h.bau);
      const outer = along(h, Ft.s, sFin, (st) => lane(st) + sh(st));
      const berm = along(h, Ft.s, sFin, (st) => lane(st) + sh(st) + (wv ? h.berme : u(st) <= 50 ? rp.berme + ((h.berme - rp.berme) * u(st)) / 50 : h.berme));
      const edgeN = offsetPolyline(al, offL, 2, L - R.sTplE, L);
      const poly = [...along(h, sNoseE, sFin, () => 0), ...outer.slice().reverse(), ...edgeN.slice().reverse()];
      P({ k: 'fill', L: 'CHAUSSEE', rings: [polySegs([...poly, poly[0]])], role: 'chaussee', rule: 'nonzero' });
      P({ k: 'path', L: 'BORDURE', segs: polySegs(along(h, Ft.s, sFin, lane)), role: 'principale' });
      P({ k: 'path', L: 'BORDURE', segs: polySegs(outer) }); P({ k: 'path', L: 'ACCOTEMENT', segs: polySegs(berm) });
      P({ k: 'path', L: 'MARQUAGE', segs: polySegs(along(h, Ft.s, sIns, () => 0)), dash: [3, 3.5], wm: 0.15 });
      const mus = [...edgeN, ...along(h, Ft.s, sNoseE, () => 0)];
      P({ k: 'hatch', L: 'MARQUAGE', lines: G.hatchPolygon(mus, ang(Ft.d) + Math.PI / 4, 1.0), wm: 0.12 });
      P({ k: 'path', L: 'MARQUAGE', segs: polySegs(mus), wm: 0.15 });
      P({ k: 'path', L: 'BORDURE', segs: polySegs([h.off(sNoseE, h.bau), accLAt(L - R.sTplE)]) });
      pt(`${name} · tpl (${fmt(e.tpl)} m)`, h.off(sNoseE, e.tpl / 2)); pt(`${name} · E.1,00 m`, Ft.S1);
      if (!wv) { pt(`${name} · fin de la voie d'insertion (${fmt(e.ins)} m)`, h.off(sIns, rp.w)); pt(`${name} · fin du biseau (${fmt(e.biseau)} m)`, h.off(sFin, 0)); }
      text('COTATION', h.off(Ft.s, -1.5), 'E.1,00', ang(Ft.d), 'center', TH * 0.8);
      text('COTATION', h.off(sNoseE, -1.5), `tpl ${fmt(e.tpl)} m · Lm ${fmt(e.Lm)} m`, ang(Ft.d), 'center', TH * 0.8);
      if (wv) text('COTATION', h.off(Ft.s + sd * insL / 2, rp.w + 1 + 2), `voie d'entrecroisement Z = ${fmt(wv.Z)} m (3,50 m + BDD 1,00 m)`, ang(Ft.d), 'center', TH * 0.8);
      else text('COTATION', h.off(sIns, rp.w + h.bau + 2), `insertion ${fmt(e.ins)} m + biseau ${fmt(e.biseau)} m`, ang(Ft.d), 'center', TH * 0.8);
    }
    for (const qq of al.points) pt(`${name} · ${qq.name}`, qq.p);
    if (!Fs) pt(`${name} · origine`, al.pointAt(0));
    if (!Ft) pt(`${name} · extrémité`, al.pointAt(L));
    // Cotations : R, A, dévers des courbes ; nom et type ; BDD / BDG.
    al.elems.forEach((el) => {
      if (el.kind !== 'A') return;
      const m = el.pointAt(el.len / 2), hd = el.headAt(el.len / 2), n = rot90(unit(hd));
      const side = el.sg > 0 ? -1 : 1, tg = al.tangents.find((t) => Math.abs(t.R - el.R) < 1e-9);
      text('COTATION', add(m, mul(n, side * (half + rp.bdd + 2))), `${tg?.loop ? 'boucle ' : ''}R ${fmt(el.R)} m (Ri ${fmt(R.rIn(el.R))}) · A ${fmt(tg?.A || 0)} · d ${fmt(deversOfRadius(R.rIn(el.R), C), 1)} %${R.rIn(el.R) < 100 ? ` · surl. ${fmt((50 * rp.lanes) / R.rIn(el.R))}` : ''}`, hd, 'center', TH * 0.8);
    });
    const sl = Math.min(L, R.sTplS + 30), m0 = al.pointAt(sl), n0 = rot90(unit(al.headAt(sl)));
    text('COTATION', add(m0, mul(n0, -(half + rp.bdd + 2))), `${name} — ${rp.label}`, al.headAt(sl), 'center', TH);
    text('COTATION', add(m0, mul(n0, offR(sl) - rp.bdd / 2)), `BDD ${fmt(rp.bdd)}`, al.headAt(sl), 'center', TH * 0.6);
    text('COTATION', add(m0, mul(n0, offL(sl) + rp.bdg / 2)), `BDG ${fmt(rp.bdg)}`, al.headAt(sl), 'center', TH * 0.6);
  }
}

// Contrôles pour l'onglet Contrôles.
export function echChecks(D) {
  return (D?.echIssues || []).map((i) => ({ ...i, msg: `Échangeur — ${i.msg}` }));
}

// --- Gabarit de trompette -------------------------------------------------------------------------------------------
// Diffuseur en trompette avec boucle en entrée (la sortie en boucle n'est admise qu'à titre exceptionnel, § 6.2.4).
// Repère local : x le long de l'autoroute, y vers la voirie ordinaire (tige), origine au droit de l'ouvrage.
// Chaussée éloignée (y < 0, circulation +x) : entrée en boucle (E-boucle) et sortie semi-directe (S-semi) qui contourne
// la boucle ; chaussée proche (y > 0, circulation −x) : sortie directe (S-directe) insérée sur S-semi (Eb11) et entrée
// directe (E-directe) qui se détache de E-boucle (sortie depuis bretelle). La tige est bidirectionnelle (deux bretelles
// à sens unique accolées) et franchit l'autoroute ; son extrémité reste libre (giratoire ou carrefour du projet).
export function trumpet(prj, D, click, mkId, opt = {}) {
  const hw = D?.hwy;
  if (!hw?.ok) return { err: 'Dessinez d\'abord l\'axe de l\'autoroute.' };
  const pr = pathProject(hw.path, click);
  if (!pr) return { err: 'Point non reconnu.' };
  const s0 = pr.s, P0 = pr.p, t = pathTangentAt(hw.path, s0), sgn = pr.off >= 0 ? 1 : -1;
  const tL = sgn > 0 ? t : neg(t), nL = rot90(tL);
  const W = (x, y) => { const q = add(P0, add(mul(tL, x), mul(nL, y))); return { x: +q.x.toFixed(3), y: +q.y.toFixed(3) }; };
  const Lc = (q) => { const v = sub(q, P0); return { x: G.dot(v, tL), y: G.dot(v, nL) }; };
  const st = (x) => +(s0 + x * sgn).toFixed(2);
  const far = sgn > 0 ? 'hwy1' : 'hwy2', near = sgn > 0 ? 'hwy2' : 'hwy1';
  const w = 3.5, yA = hw.E1 + 1 + w / 2, off2 = w / 2 + 0.5; // axe de la bretelle à E.1,00 ; demi-entraxe de la tige
  const Rl = opt.Rl || 56, Al = opt.Al || 45, Rd = opt.Rd || 120, Ad = opt.Ad || 80, Ys = opt.Ystem || 450;
  const p3 = 0.03, lam = 150;
  const ids = [mkId(), mkId(), mkId(), mkId()];
  const base = { cat: 'b50', lanes: 1, pente: '' };
  // E-boucle : sommet de boucle au croisement de la tige (x = −off2) et de la ligne d'obliquité du convergent.
  const xE = lam - off2, yPI = -yA - p3 * lam;
  const B1 = { ...base, id: ids[0], name: 'E-boucle', from: { ref: 'free' }, to: { ref: far, s: st(xE), ins: '', biseau: '', obl: '', tpl: '' },
    pis: [W(-off2, Ys), { ...W(-off2, yPI), R: Rl, A: Al, loop: true }] };
  const alL = buildAlignment([{ x: -off2, y: Ys }, { x: -off2, y: yPI, R: Rl, A: Al, loop: true }, { x: xE, y: -yA }]);
  const arc = alL.elems.find((e) => e.kind === 'A');
  const yc = arc ? arc.C.y : yPI - Rl; // la grande courbe de S-semi enveloppe la boucle (tangente à la tige à cette hauteur)
  // S-semi : sortie par la droite (R1), puis grande courbe à gauche qui enveloppe la boucle (R2) et remonte la tige.
  // Le cercle de R2 est centré à g mètres en amont du centre de la boucle et tangent à la tige. Par défaut g = 0 : les deux
  // cercles sont concentriques et les plates-formes de la boucle et de S-semi sont tangentes sur tout le contour ; g > 0
  // ouvre un terre-plein qui croît de 0 (le long de la tige) à 2g (côté amont).
  // Contraintes : 1er rayon de sortie ≥ 100 m et R1 < 2·R2 (§ 3.2.2) ; clothoïdes ≥ max(6R^0,4 ; 7|Δd|) (§ 3.2.3).
  const g = Math.max(0, opt.gap ?? 0), Cl = arc ? arc.C : { x: -off2 - Rl, y: yPI - Rl };
  // La surlargeur de S-semi (50/Ri, côté intérieur, donc côté boucle, § 3.4.2) s'ajoute à l'écart pour garder les
  // plates-formes tangentes sans chevauchement.
  const Amin = (R) => Math.ceil(Math.sqrt(cloMinLength(R, Math.abs(deversOfRadius(R - w / 2, RAMP_CAT.b50) - 2.5), 1) * R) / 5) * 5;
  const Qy = Cl.y;
  let R2 = off2 - Cl.x + g, A2 = 50, sw = 0, Qx = Cl.x - g, rho = off2 - Qx;
  for (let i = 0; i < 6; i++) {
    Qx = Cl.x - g - sw; rho = off2 - Qx; // rayon effectif (arc + ripage de la clothoïde)
    A2 = opt.A2 || Amin(R2); const L2 = (A2 * A2) / R2, e = cloXY(A2, L2), tau = L2 / (2 * R2); R2 = rho - (e.y - R2 * (1 - Math.cos(tau)));
    sw = R2 - w / 2 < 100 ? 50 / (R2 - w / 2) : 0;
  }
  R2 = Math.round(R2 * 10) / 10;
  // Rayons comparés au bord intérieur (axe − 1,75 m) : Ri1 ≥ 100 m et Ri1 < 2·Ri2.
  const R1 = opt.R1 || Math.max(100, Math.min(Math.floor((2 * (R2 - w / 2) - 1) / 5) * 5, 150)) + w / 2, A1 = opt.A1 || Amin(R1);
  let best = null;
  for (let deg = 25; deg <= 70; deg += 5) { // angle de la droite entre R1 et R2 : le plus compact (divergent le plus proche)
    const f = (deg * Math.PI) / 180, u = { x: Math.cos(f), y: -Math.sin(f) };
    const Tp = { x: Qx - rho * Math.sin(f), y: Qy - rho * Math.cos(f) }; // point de tangence de la droite sur le cercle effectif
    const P2 = { x: off2, y: Tp.y + ((off2 - Tp.x) / u.x) * u.y };
    const T1 = tangentLength(R1, A1, f - Math.atan(p3)), T2 = tangentLength(R2, A2, Math.PI / 2 + f);
    const lam1 = 140 + T1 + 10, P1y = -yA - p3 * lam1, P1 = { x: P2.x - (P1y - P2.y) / Math.tan(f), y: P1y };
    if (Math.hypot(P2.x - P1.x, P2.y - P1.y) >= T1 + T2 + 5 && (!best || P1.x - lam1 > best.xS)) best = { P1, P2, xS: P1.x - lam1, deg };
  }
  if (!best) return { err: 'Gabarit impossible avec ces rayons.' };
  const B2 = { ...base, id: ids[1], name: 'S-semi', from: { ref: far, s: st(best.xS), biseau: '', obl: '', tpl: '' }, to: { ref: 'free' },
    pis: [{ ...W(best.P1.x, best.P1.y), R: R1, A: A1 }, { ...W(best.P2.x, best.P2.y), R: R2, A: A2 }, W(off2, Ys)] };
  const alS = buildAlignment([{ x: best.xS, y: -yA }, { ...best.P1, R: R1, A: A1 }, { ...best.P2, R: R2, A: A2 }, { x: off2, y: Ys }]);
  // Bretelles directes : raccordées à la tige vers y = 240 m (insertion de 100 + 75 m sur S-semi).
  const yM = opt.yM || 240, Ld = opt.Ldir || 300;
  const B3 = { ...base, id: ids[2], name: 'S-directe', from: { ref: near, s: st(off2 + w + 1 + Ld), biseau: '', obl: '', tpl: '' },
    to: { ref: ids[1], s: +(alS.length - (Ys - yM)).toFixed(2), ins: '', biseau: '', obl: '', tpl: '' }, pis: [{ ...W(off2 + 15, yA + 10), R: Rd, A: Ad }] };
  const B4 = { ...base, id: ids[3], name: 'E-directe', from: { ref: ids[0], s: +(Ys - (yM + 5)).toFixed(2), biseau: '', obl: '', tpl: '' },
    to: { ref: near, s: st(-(off2 + w + 1 + Ld)), ins: '', biseau: '', obl: '', tpl: '' }, pis: [{ ...W(-off2 - 15, yA + 10), R: Rd, A: Ad }] };
  // Emprise nécessaire le long de l'autoroute (biseaux, insertions) ; ouvrage : la tige franchit l'autoroute en x = 0.
  const need = [st(best.xS - 150), st(xE + 275), st(off2 + w + 1 + Ld + 150), st(-(off2 + w + 1 + Ld) - 275)];
  const lo = Math.min(...need), hi = Math.max(...need);
  const warn = lo < 0 || hi > hw.sEnd ? `L'axe de l'autoroute doit couvrir les abscisses ${fmt(Math.max(0, lo), 0)} à ${fmt(hi, 0)} m (actuellement 0 à ${fmt(hw.sEnd, 0)} m).` : '';
  void Lc;
  return { ramps: [B1, B2, B3, B4], warn, bridge: { p: P0, dir: nL } };
}

// --- Trèfle et demi-trèfle ------------------------------------------------------------------------------------------
// Repère local : x le long de l'autoroute (sens 1), y le long de la route transversale, origine au croisement ; l'axe
// transversal est (re)créé perpendiculaire à l'autoroute au point cliqué. Chaussées dans l'ordre de rotation :
// autoroute sens 1 (y < 0, +x), transversale sens 1 (x > 0, +y), autoroute sens 2 (y > 0, −x), transversale sens 2.
// Dans le repère canonique d'un quadrant k (rotation de k × 90°), l'hôte A circule vers +X (rive droite y = −eA) et
// l'hôte B vers +Y (rive droite x = +eB) : la boucle va de A vers B, la bretelle directe de B vers A.
const ROT = [(X, Y) => ({ x: X, y: Y }), (X, Y) => ({ x: -Y, y: X }), (X, Y) => ({ x: -X, y: -Y }), (X, Y) => ({ x: Y, y: -X })];

function interchangeFrame(prj, D, click, Lc) {
  const hw = D?.hwy;
  if (!hw?.ok) return { err: 'Dessinez d\'abord l\'axe de l\'autoroute.' };
  const pr = pathProject(hw.path, click);
  if (!pr) return { err: 'Point non reconnu.' };
  const s0 = pr.s, P0 = pr.p, tL = pathTangentAt(hw.path, s0), nL = rot90(tL);
  const W = (q) => { const r = add(P0, add(mul(tL, q.x), mul(nL, q.y))); return { x: +r.x.toFixed(3), y: +r.y.toFixed(3) }; };
  return { hw, s0, P0, tL, nL, W, Lc, crossAxis: [W({ x: 0, y: -Lc }), W({ x: 0, y: Lc })] };
}

export function cloverleaf(prj, D, click, mkId, opt = {}) {
  const Lc = opt.Lc || 1500, F = interchangeFrame(prj, D, click, Lc);
  if (F.err) return F;
  const { hw, s0, W } = F, w = 3.5, half = w / 2;
  const X = crossParams({ ...prj, cross: { ...prj.cross, on: true } }), Hm = hwyParams(prj);
  const E1c = X.median / 2 + X.bdg + X.lanes * X.wLane, crossAuto = X.kind === 'autoroute';
  const cyc = [
    { ref: 'hwy1', base: s0, sg: 1, e: hw.E1, bau: Hm.bau, coll: true, name: 'C1' },
    { ref: 'x1', base: Lc, sg: 1, e: E1c, bau: X.bau, coll: crossAuto, name: 'CX1', lanes: X.lanes },
    { ref: 'hwy2', base: s0, sg: -1, e: hw.E1, bau: Hm.bau, coll: true, name: 'C2' },
    { ref: 'x2', base: Lc, sg: -1, e: E1c, bau: X.bau, coll: crossAuto, name: 'CX2', lanes: X.lanes },
  ];
  // Collectrice (§ 3.4.3, 6.2.3, 6.3.3) : bretelle sortant de la chaussée (biseau 150 m, 3 %) et y revenant (3 %),
  // parallèle au-delà du tpl ; ses propres sorties et entrées sont à 5 % (Lm = (1,00 + 2,00 + 0,70 − 1,00) / 0,05 = 54 m).
  const pR = 0.03, nR = Math.hypot(1, pR);
  for (const h of cyc) {
    h.LmRoad = (h.bau + J14_W + 0.7 - 1) / pR;
    if (h.coll) {
      h.lamC = h.LmRoad + 25; h.yc = h.e + 1 + half + (pR * h.lamC) / nR;
      Object.assign(h, { edge: h.yc + half, p: 0.05, Lm: (1 + J14_W + 0.7 - 1) / 0.05, id: mkId() });
    } else Object.assign(h, { edge: h.e, p: 0.05, Lm: (h.bau + J14_W + 0.7 - 1) / 0.05 });
  }
  // A minimal d'une clothoïde de bretelle ≤ 70 km/h (§ 3.2.3 : L ≥ max(6R^0,4 ; 7|Δd|)), arrondi à 5.
  // Nœud (deux autoroutes) : boucles en branche 70 km/h (Rm = 125 m, tab. 3-1), bretelles directes 90 km/h (Rm = 240 m).
  const catL = crossAuto ? 'b70' : 'b50', catD = crossAuto ? 'b90' : 'b50';
  const Rl0 = opt.Rl || Math.ceil(RAMP_CAT[catL].Rm + half + (crossAuto ? 0 : 14.25)), Ro0 = Math.ceil(Math.max(RAMP_CAT[catD].Rm, 100) + half + (crossAuto ? 0 : 18.25));
  const AminC = (R, cat) => Math.ceil(Math.sqrt(cloMinLength(R, Math.abs(deversOfRadius(R - half, RAMP_CAT[cat]) - 2.5), 1) * R) / 5) * 5;
  const Amin = (R) => AminC(R, catL);
  const label = ['SE', 'NE', 'NO', 'SO'], Ao0 = opt.Ao || 0, Zmin = opt.Zmin ?? 0;
  let quads = [];
  const ux = { x: 1, y: 1 }, nD = norm({ x: 1, y: -1 }), uD = norm(ux);
  // Rayon des boucles relevé si nécessaire pour que, sur chaque chaussée, le point S.1,00 de la boucle sortante reste en
  // aval du point E.1,00 de la boucle entrante (Z ≥ 0 : voie d'entrecroisement entre musoirs distincts, § 3.4.3, 7.3).
  for (let Rb = Rl0; ; Rb += 2) {
  quads = [];
  for (let k = 0; k < 4; k++) {
    const A = cyc[k], B = cyc[(k + 1) % 4], ps = A.p, pe = B.p, ns = Math.hypot(1, ps), ne = Math.hypot(1, pe);
    const ys0 = -(A.edge + 1 + half), xe0 = B.edge + 1 + half;
    // Boucle de 270° sur trois sommets (arc continu) : rayon Rl (54 m conseillé au bord intérieur, § 3.2.1) ; si les
    // nez ne peuvent être dégagés des plates-formes croisées, premier arc de rayon R1 > Rl (courbe composée,
    // R1 < 2 R2, § 3.2.2) qui éloigne la boucle de la chaussée A.
    let g = null;
    for (let Rl = Rb; Rl <= Rb + 24 && !g; Rl += 2) {
      const Al = Amin(Rl);
      for (let R1 = Rl; R1 - half < 2 * (Rl - half) - 2; R1 += 2) {
        const A1 = Amin(R1), d1 = Math.PI / 2 - Math.atan(ps), d3 = Math.PI / 2 - Math.atan(pe);
        const [T1i, T1o] = tangentLengths(R1, A1, 0, d1), T2 = Rl, [T3i, T3o] = tangentLengths(Rl, 0, Al, d3);
        const lam1 = A.Lm + T1i + 3, lam3 = B.Lm + T3o + 3;
        const X3 = xe0 + (pe * lam3) / ne, X1 = X3 + T2 + T3i, Y1 = ys0 - (ps * lam1) / ns, Y3 = Y1 - (T1o + T2);
        const yE = Y3 + lam3, x1 = X1 - lam1 / ns;
        // Nez (tpl) d'entrée sur B en deçà de la plate-forme de A, nez de sortie de A au-delà de celle de B (4 m).
        if (yE - B.Lm <= ys0 - 4 && x1 + A.Lm >= xe0 + 4) { g = { Rl, Al, R1, A1, PI1: { x: X1, y: Y1 }, PI2: { x: X1, y: Y3 }, PI3: { x: X3, y: Y3 }, x1: X1 - lam1 / ns, yE }; break; }
      }
    }
    if (!g) return { err: `Boucle impossible à loger avec un rayon ≤ ${Rb + 24} m.` };
    const alL = buildAlignment([{ x: g.x1, y: ys0 }, { ...g.PI1, R: g.R1, A: g.A1 }, { ...g.PI2, R: g.Rl, A: g.Al, link: true }, { ...g.PI3, R: g.Rl, A: g.Al, link: true }, { x: xe0, y: g.yE }]);
    const Cl = alL.elems.filter((e) => e.kind === 'A').pop().C;
    // Bretelle directe (B → A) qui contourne la boucle : deux courbes à droite (Ro ≥ 100 m au bord intérieur, premier
    // rayon de sortie § 3.2.2) reliées par un alignement à 45° tangent à la boucle, à distance de plate-forme
    // (Rl + l/2 + BDD de la boucle + 6 m de séparation + BDG + l/2) ; alignement intermédiaire ≥ 60 m (§ 3.2.2).
    const dsep = g.Rl + w + RAMP_CAT.b50.bdd + RAMP_CAT.b50.bdg + 6, cD = nD.x * Cl.x + nD.y * Cl.y + dsep;
    const onDiag = (P, d) => { const t = (cD - (nD.x * P.x + nD.y * P.y)) / (nD.x * d.x + nD.y * d.y); return add(P, mul(d, t)); };
    const db = norm({ x: pe, y: 1 }), da = norm({ x: 1, y: ps });
    let dg = null;
    for (let Ro = Ro0; Ro <= Ro0 + 300 && !dg; Ro += 20) {
      const Ao = Ao0 || AminC(Ro, catD), dfa = Math.atan2(db.y, db.x) - Math.PI / 4, dfb = Math.PI / 4 - Math.atan2(da.y, da.x);
      const Ta = tangentLength(Ro, Ao, dfa), Tb = tangentLength(Ro, Ao, dfb);
      let yS = ys0 - 300, xE2 = xe0 + 300, PIa, PIb;
      for (let j = 0; j < 6; j++) {
        PIa = onDiag({ x: xe0, y: yS }, db); yS = PIa.y - (B.Lm + Ta + 5) * db.y; // B : x = xe0 au point S.1,00 m
        PIb = onDiag({ x: xE2, y: ys0 }, da); xE2 = PIb.x + (A.Lm + Tb + 5) * da.x;
      }
      PIa = onDiag({ x: xe0, y: yS }, db); PIb = onDiag({ x: xE2, y: ys0 }, da);
      const lad = dist(PIa, PIb) - Ta - Tb;
      if (lad >= 60) dg = { Ro, Ao, yS, xE2, PIa, PIb, lad };
    }
    if (!dg) return { err: 'Bretelle directe impossible à loger.' };
    quads.push({ k, A, B, loop: g, dir: dg, name: label[k] });
  }
  const Zs = quads.map((q, i) => q.loop.x1 - quads[(i + 3) % 4].loop.yE);
  if (Math.min(...Zs) >= Zmin - 1e-6 || Rb >= Rl0 + 40) break;
  }
  // Collectrices : étendues pour encadrer leurs raccordements (biseau 90 m, insertion 100 + 75 m, 25 m de § 4.3 / 5.3).
  const ramps = [];
  const station = (h, u) => +(h.base + h.sg * u).toFixed(2);
  for (let i = 0; i < 4; i++) {
    const h = cyc[i], qa = quads[i], qb = quads[(i + 3) % 4];
    if (!h.coll) continue;
    const uMin = Math.min(qb.dir.yS - 90, qb.loop.yE - 175, qa.loop.x1 - 90), uMax = Math.max(qa.dir.xE2 + 175, qa.loop.x1);
    const u0 = uMin - 25 - h.lamC - 40, u1 = uMax + 25 + h.lamC + 40, yl = -h.yc;
    h.u0 = u0; h.u1 = u1;
    const P1 = { x: u0 + h.lamC / nR, y: yl }, P2 = { x: u1 - h.lamC / nR, y: yl };
    h.alC = buildAlignment([{ x: u0, y: -(h.e + 1 + half) }, { ...P1, R: 1000, A: 0 }, { ...P2, R: 1000, A: 0 }, { x: u1, y: -(h.e + 1 + half) }]);
    const Wk = (q) => W(ROT[i](q.x, q.y));
    ramps.push({ id: h.id, name: h.name, cat: 'b90', lanes: 1, pente: '', from: { ref: h.ref, s: station(h, u0), biseau: '', obl: '', tpl: '' }, to: { ref: h.ref, s: station(h, u1), ins: '', biseau: '', obl: '', tpl: '' },
      pis: [{ ...Wk(P1), R: 1000, A: 0 }, { ...Wk(P2), R: 1000, A: 0 }] });
  }
  // Raccordement sur un hôte : référence et abscisse (collectrice : abscisse curviligne du point projeté).
  const attach = (h, u, role) => {
    const base = role === 'div' ? { biseau: 90, obl: '', tpl: '' } : { ins: '', biseau: '', obl: 5, tpl: '' };
    if (!h.coll) return { ref: h.ref, s: station(h, u), ...base };
    const pr = pathProject(h.alC.path, { x: u, y: -h.yc });
    return { ref: h.id, s: +pr.s.toFixed(2), ...base };
  };
  for (const q of quads) {
    const { k, A, B, loop: g, dir: dg } = q, Wk = (p) => W(ROT[k](p.x, p.y));
    ramps.push({ id: mkId(), name: `B-${q.name}`, cat: catL, lanes: 1, pente: '', from: attach(A, g.x1, 'div'), to: attach(B, g.yE, 'conv'),
      pis: [{ ...Wk(g.PI1), R: g.R1, A: g.A1 }, { ...Wk(g.PI2), R: g.Rl, A: g.Al, link: true }, { ...Wk(g.PI3), R: g.Rl, A: g.Al, link: true }] });
    ramps.push({ id: mkId(), name: `D-${q.name}`, cat: catD, lanes: 1, pente: '', from: attach(B, dg.yS, 'div'), to: attach(A, dg.xE2, 'conv'),
      pis: [{ ...Wk(dg.PIa), R: dg.Ro, A: dg.Ao }, { ...Wk(dg.PIb), R: dg.Ro, A: dg.Ao }] });
  }
  // Emprise nécessaire le long des axes.
  let warn = '';
  const mainNeed = [cyc[0], cyc[2]].map((h) => [station(h, h.u0 - 150), station(h, h.u1 + 275)]).flat();
  const lo = Math.min(...mainNeed), hi = Math.max(...mainNeed);
  if (lo < 0 || hi > hw.sEnd) warn = `L'axe de l'autoroute doit couvrir les abscisses ${fmt(Math.max(0, lo), 0)} à ${fmt(hi, 0)} m (actuellement 0 à ${fmt(hw.sEnd, 0)} m).`;
  const loopR = quads.map((q) => q.loop.Rl), loopR1 = quads.map((q) => q.loop.R1), dirR = quads.map((q) => q.dir.Ro);
  return { ramps, crossAxis: F.crossAxis, warn, info: `boucles R ${[...new Set(quads.map((q) => (q.loop.R1 > q.loop.Rl ? `${q.loop.R1}/${q.loop.Rl}` : q.loop.Rl)))].join(', ')} m, bretelles directes R ${[...new Set(dirR)].join(', ')} m` };
}

// Demi-trèfle (route transversale ordinaire) : de chaque côté de l'autoroute, une sortie directe et une entrée en
// boucle de 180° (§ 6.2.4 : boucle en entrée) raccordées à la route transversale par une branche bidirectionnelle dont
// l'extrémité reste libre (carrefour plan ou giratoire à étudier, § 8). Côté sens 1 dans le quadrant sud-ouest,
// côté sens 2 dans le quadrant nord-est (rotation de 180°). La sortie enveloppe la boucle (plates-formes tangentes).
export function halfCloverleaf(prj, D, click, mkId, opt = {}) {
  if ((prj.cross?.kind || 'route') === 'autoroute') return { err: 'Le demi-trèfle se raccorde à une route ordinaire (carrefours plans) : choisissez le type « Route ordinaire » pour la route transversale.' };
  const Lc = opt.Lc || 800, F = interchangeFrame(prj, D, click, Lc);
  if (F.err) return F;
  const { hw, s0, W } = F, w = 3.5, half = w / 2, p = 0.03, n = Math.hypot(1, p);
  const X = crossParams({ ...prj, cross: { ...prj.cross, on: true, kind: 'route' } }), Hm = hwyParams(prj);
  const E2c = X.median / 2 + X.bdg + X.lanes * X.wLane + X.bau, Lm = (Hm.bau + J14_W + 0.7 - 1) / p;
  const Rl = opt.Rl || 56, Al = opt.Al || 45, yA = hw.E1 + 1 + half, xJ = -(E2c + X.berme + 25), xE = -(E2c + X.berme + 10);
  const [Tai, Tao] = tangentLengths(Rl, Al, 0, Math.PI / 2), [Tbi, Tbo] = tangentLengths(Rl, 0, Al, Math.PI / 2 - Math.atan(p));
  const lamB = Lm + Tbo + 3, PIb = { x: xE - lamB / n, y: -yA - (p * lamB) / n }, PIa = { x: PIb.x, y: PIb.y - (Tao + Tbi) };
  const alL = buildAlignment([{ x: xJ, y: PIa.y }, { ...PIa, R: Rl, A: Al }, { ...PIb, R: Rl, A: Al, link: true }, { x: xE, y: -yA }]);
  const arc = alL.elems.find((e) => e.kind === 'A'), Q = arc.C, rhoL = Q.y - PIa.y; // rayon effectif de la boucle
  // Sortie : grande courbe à gauche concentrique à la boucle, à 4,50 m + surlargeur ; Ri1 ≥ 100 m et Ri1 < 2·Ri2.
  const Amin = (R) => Math.ceil(Math.sqrt(cloMinLength(R, Math.abs(deversOfRadius(R - half, RAMP_CAT.b50) - 2.5), 1) * R) / 5) * 5;
  let R2 = rhoL + 4.5, A2 = 50, sw = 0, rho = R2;
  for (let i = 0; i < 6; i++) {
    rho = rhoL + 4.5 + sw;
    A2 = Amin(R2); const L2 = (A2 * A2) / R2, e = cloXY(A2, L2), tau = L2 / (2 * R2); R2 = rho - (e.y - R2 * (1 - Math.cos(tau)));
    sw = R2 - half < 100 ? 50 / (R2 - half) : 0;
  }
  R2 = Math.round(R2 * 10) / 10;
  const R1 = Math.max(100, Math.min(Math.floor((2 * (R2 - half) - 1) / 5) * 5, 150)) + half, A1 = Amin(R1);
  const yOut = Q.y - rho;
  let best = null;
  for (let deg = 25; deg <= 85; deg += 5) {
    const f = (deg * Math.PI) / 180, u = { x: Math.cos(f), y: -Math.sin(f) };
    const Tp = { x: Q.x - rho * Math.sin(f), y: Q.y - rho * Math.cos(f) };
    const P2 = { x: Tp.x + ((yOut - Tp.y) / u.y) * u.x, y: yOut };
    const T1 = tangentLength(R1, A1, f - Math.atan(p)), T2 = tangentLength(R2, A2, f);
    const lam1 = Lm + T1 + 10, P1y = -yA - (p * lam1) / n, P1 = { x: P2.x - (P1y - P2.y) / Math.tan(f), y: P1y };
    const ok = Math.hypot(P2.x - P1.x, P2.y - P1.y) >= T1 + T2 + 5 && xJ - P2.x >= T2 + 10 && P1.x + T1 < PIb.x - 10;
    if (ok && (!best || P1.x - lam1 / n > best.xS)) best = { P1, P2, xS: P1.x - lam1 / n };
  }
  if (!best) return { err: 'Gabarit impossible avec ces rayons.' };
  const ramps = [];
  for (const [k, sens] of [[0, 1], [2, 2]]) {
    const Wk = (q) => W(ROT[k](q.x, q.y)), ref = 'hwy' + sens, st = (x) => +(s0 + (k ? -x : x)).toFixed(2);
    ramps.push({ id: mkId(), name: `S${sens}-dir`, cat: 'b50', lanes: 1, pente: '', from: { ref, s: st(best.xS), biseau: '', obl: '', tpl: '' }, to: { ref: 'free' },
      pis: [{ ...Wk(best.P1), R: R1, A: A1 }, { ...Wk(best.P2), R: R2, A: A2 }, Wk({ x: xJ, y: yOut })] });
    ramps.push({ id: mkId(), name: `E${sens}-boucle`, cat: 'b50', lanes: 1, pente: '', from: { ref: 'free' }, to: { ref, s: st(xE), ins: '', biseau: '', obl: '', tpl: '' },
      pis: [Wk({ x: xJ, y: PIa.y }), { ...Wk(PIa), R: Rl, A: Al }, { ...Wk(PIb), R: Rl, A: Al, link: true }] });
  }
  const need = [st0(best.xS - 150), st0(xE + 275), st0(-(best.xS - 150)), st0(-(xE + 275))];
  function st0(x) { return s0 + x; }
  const lo = Math.min(...need), hi = Math.max(...need);
  const warn = lo < 0 || hi > hw.sEnd ? `L'axe de l'autoroute doit couvrir les abscisses ${fmt(Math.max(0, lo), 0)} à ${fmt(hi, 0)} m (actuellement 0 à ${fmt(hw.sEnd, 0)} m).` : '';
  return { ramps, crossAxis: F.crossAxis, warn, info: `boucles R ${Rl} m, sorties R ${fmt(R1)} / ${fmt(R2)} m ; extrémités libres à ${fmt(-xJ, 0)} m de l'axe transversal` };
}
