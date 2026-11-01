// profils.js — implantation des profils en travers sur les axes du projet (autoroute, voies secondaires, bretelles,
// branches du carrefour actif). Trois sources, réunies et numérotées le long de chaque axe :
//   • séries : entre deux points cliqués sur un même axe, au pas choisi (extrémités comprises), avec en option les
//     points de tangence situés entre les deux (changements d'élément : droite / clothoïde / arc) ;
//   • profils isolés placés à la main ;
//   • (les doublons à moins de 5 cm sont fusionnés ; un point de tangence garde son type).
// Symbole en plan (à la manière de Macao / Covadis) : petit cercle sur l'axe et court segment perpendiculaire, numéro au
// bout du segment. Les profils sont tracés sur le calque PROFILS (GIRA_PROFILS en DXF) et listés dans l'onglet
// Implantation (numéro, axe, abscisse, X, Y, gisement de la normale).
import * as G from './geom.js';
import { pathTangentAt, pathProject } from './clotho.js';
import { crossList } from './echangeur.js';
import { axisPointAt, axisLength } from './pl.js';
import { fmt } from './common.js';

const num = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);

// Axes disponibles : { key, name, len, at(s) → { p, t }, tan: [{ s, type }], poly (échantillonnage 1 m avec abscisses) }.
export function listAxes(prj, D) {
  const out = [];
  const fromPath = (key, name, path, tan, extra = {}) => {
    const len = G.pathLen(path);
    if (!(len > 1)) return;
    out.push({ key, name, len, at: (s) => { const c = Math.max(0, Math.min(len, s)); return { p: G.pathPointAt(path, c), t: G.norm(pathTangentAt(path, c)) }; }, project: (q) => pathProject(path, q), tan, ...extra });
  };
  const segTan = (path) => {
    const t = [];
    let s = 0;
    path.forEach((sg, i) => { if (i) t.push({ s, type: `${sg.t === 'A' || path[i - 1].t === 'A' ? 'tangence droite / arc' : 'sommet'}` }); s += G.segLen(sg); });
    return t;
  };
  const KN = { L: 'droite', C: 'clothoïde', A: 'arc' };
  // points de tangence d'un alignement exact (droite / clothoïde / arc)
  const alTan = (al) => { const els = al?.elems || [], tan = []; for (let j = 1; j < els.length; j++) if (els[j].kind !== els[j - 1].kind || els[j].kind !== 'L') tan.push({ s: els[j].s0, type: `${KN[els[j - 1].kind] || els[j - 1].kind} / ${KN[els[j].kind] || els[j].kind}` }); return tan; };
  // autoroute et voies secondaires : alignement exact (clothoïdes) gardé pour le dévers et les contrôles de catégorie
  const road = (key, r, name) => fromPath(key, name, r.path, r.al?.elems?.some((e) => e.kind === 'C') ? alTan(r.al) : segTan(r.path), { half: r.E2, al: r.al, cat: r.cat, H: r.H });
  if (D?.hwy?.ok) road('hwy', D.hwy, D.hwy.H?.name || 'Autoroute');
  (D?.crosses || []).forEach((c, k) => { if (c?.ok) road(`x:${crossList(prj)[k]?.id || k}`, c, c.H?.name || `Voie secondaire ${k + 1}`); });
  (prj.ramps || []).forEach((r, i) => {
    const R = D?.ramps?.[i];
    if (!R?.al?.path) return;
    const els = R.al.elems || [], tan = [];
    for (let j = 1; j < els.length; j++) if (els[j].kind !== els[j - 1].kind || els[j].kind !== 'L') tan.push({ s: els[j].s0, type: `${KN[els[j - 1].kind] || els[j - 1].kind} / ${KN[els[j].kind] || els[j].kind}` });
    fromPath(`r:${r.id}`, r.name, R.al.path, tan, { half: (R.rp?.w || 3.5) / 2 + (R.rp?.bdd ?? 1), al: R.al });
  });
  // Branches du carrefour actif : axe projet de la branche (alignement, puis axe suivi).
  for (const bd of D?.branches || []) {
    if (bd.role === 'principale' || !(bd.xEnd > bd.x0)) continue;
    const len = axisLength(bd);
    if (!(len > 1)) continue;
    const tan = [];
    if (bd.cont) { // changements droite / arc de l'axe suivi (les petits segments d'une polyligne ne comptent pas)
      let s = bd.xEnd - bd.x0, prev = 'L';
      for (const sg of bd.cont) { if (sg.t !== prev && s > 0.5 && s < len - 0.5 && !(tan.length && s - tan[tan.length - 1].s < 0.5)) tan.push({ s, type: 'tangence droite / arc' }); prev = sg.t; s += G.segLen(sg); }
    }
    const at = (s) => { const q = axisPointAt(bd, Math.max(0, Math.min(len, s))); return { p: q.p, t: G.norm(q.t) }; };
    const poly = [];
    for (let s = 0; s <= len + 1e-9; s += Math.max(0.5, len / 2000)) poly.push({ s, p: at(s).p });
    const project = (q) => {
      let best = null;
      for (let i = 1; i < poly.length; i++) {
        const a = poly[i - 1], b = poly[i], ab = G.sub(b.p, a.p), L2 = G.dot(ab, ab) || 1;
        const u = Math.max(0, Math.min(1, G.dot(G.sub(q, a.p), ab) / L2)), c = G.add(a.p, G.mul(ab, u)), d = G.dist(q, c);
        if (!best || d < best.d) best = { d, s: a.s + u * (b.s - a.s), p: c, off: G.cross(G.norm(ab), G.sub(q, a.p)) };
      }
      return best && { s: best.s, p: best.p, off: best.off };
    };
    out.push({ key: `b:${bd.id}`, name: bd.name || 'Branche', len, at, project, tan, half: Math.max(bd.entry?.w || 3.5, bd.exit?.w || 3.5) });
  }
  return out;
}

// Axe le plus proche d'un point (distance à l'axe < tol m) : { ax, s, off }.
export function nearestAxis(axes, w, tol) {
  let best = null;
  for (const ax of axes) {
    const pr = ax.project(w);
    if (!pr) continue;
    const d = Math.abs(pr.off);
    if (d < tol + (ax.half || 0) && (!best || d < best.d)) best = { ax, s: Math.max(0, Math.min(ax.len, pr.s)), d };
  }
  return best;
}

export function profParams(prj) {
  const p = prj.prof || {};
  return { step: Math.max(1, num(p.step, 25)), tan: p.tan !== false, tick: Math.max(1, num(p.tick, 4)), series: p.series || [], manual: p.manual || [], on: p.on !== false };
}

// Liste numérotée des profils et symboles en plan (D.prims, calque PROFILS).
export function buildProfils(prj, D, TH = 1) {
  const P = profParams(prj), axes = listAxes(prj, D), byKey = Object.fromEntries(axes.map((a) => [a.key, a]));
  const per = {}, issues = [];
  // Fusion des profils voisins : à moins de 5 cm, un seul profil ; un point de tangence à moins de 0,50 m d'un profil de
  // série le remplace (le profil est placé exactement au point de tangence).
  const add = (key, s, src, type, ref) => {
    const L = (per[key] = per[key] || []);
    const q = L.find((x) => Math.abs(x.s - s) < 0.05) || (src === 'tangence' ? L.find((x) => x.src === 'série' && Math.abs(x.s - s) < 0.5) : null);
    if (q) { if (src === 'tangence') { q.s = s; q.type = type; q.src = 'tangence'; } else if (type && !q.type) q.type = type; if (src === 'manuel') q.src = 'manuel'; return; }
    L.push({ s, src, type, ref });
  };
  for (const se of P.series) {
    const ax = byKey[se.axis];
    if (!ax) { issues.push({ lvl: 'warn', msg: `Série de profils sur un axe supprimé (${se.axisName || se.axis}) : ignorée.` }); continue; }
    const a = Math.max(0, Math.min(ax.len, Math.min(+se.s0, +se.s1))), b = Math.max(0, Math.min(ax.len, Math.max(+se.s0, +se.s1)));
    const st = Math.max(1, num(se.step, P.step)), n = Math.floor((b - a) / st + 1e-6);
    // stations régulières depuis le premier point ; le second point clôt la série (la dernière station régulière à moins
    // de 0,50 m de lui est remplacée par lui).
    const last = b - (a + n * st) < 0.5 ? n - 1 : n;
    for (let k = 0; k <= last; k++) add(ax.key, a + k * st, 'série', '', se.id);
    if (b - a > 0.05) add(ax.key, b, 'série', '', se.id);
    if (se.tan ?? P.tan) for (const t of ax.tan) if (t.s > a + 0.05 && t.s < b - 0.05) add(ax.key, t.s, 'tangence', t.type, se.id);
  }
  for (const m of P.manual) { const ax = byKey[m.axis]; if (ax) add(ax.key, Math.max(0, Math.min(ax.len, +m.s)), 'manuel', '', m.id); }
  const list = [];
  for (const ax of axes) {
    const L = (per[ax.key] || []).sort((u, v) => u.s - v.s);
    L.forEach((q, i) => {
      const { p, t } = ax.at(q.s), n = G.rot90(t);
      const gis = (((Math.atan2(n.x, n.y) * 200) / Math.PI) % 400 + 400) % 400; // gisement de la normale (gr, depuis le nord)
      list.push({ axis: ax.key, axisName: ax.name, n: i + 1, name: `P${i + 1}`, s: q.s, p, t, nrm: n, gis, src: q.src, type: q.type, ref: q.ref });
    });
  }
  // Symbole : cercle sur l'axe, segment perpendiculaire (des deux côtés), numéro au bout du segment côté gauche.
  if (P.on && D?.prims) {
    const r = Math.max(0.35, TH * 0.45), tk = Math.max(P.tick, TH * 3);
    for (const q of list) {
      D.prims.push({ k: 'circle', L: 'PROFILS', c: q.p, r });
      D.prims.push({ k: 'path', L: 'PROFILS', segs: [G.L(G.add(q.p, G.mul(q.nrm, -tk)), G.add(q.p, G.mul(q.nrm, -r))), G.L(G.add(q.p, G.mul(q.nrm, r)), G.add(q.p, G.mul(q.nrm, tk)))] });
      const rot = Math.atan2(q.nrm.y, q.nrm.x);
      D.prims.push({ k: 'text', L: 'PROFILS', p: G.add(q.p, G.mul(q.nrm, tk + TH * 0.4)), s: q.name, rot, align: 'left', h: TH * 0.9 });
    }
  }
  return { list, axes, issues };
}

export function profilsCsv(list) {
  const rows = ['Profil;Axe;Abscisse (m);X;Y;Gisement normale (gr);Origine;Point de tangence'];
  for (const q of list) rows.push([q.name, q.axisName, q.s.toFixed(3), q.p.x.toFixed(3), q.p.y.toFixed(3), q.gis.toFixed(4), q.src, q.type || ''].join(';'));
  return rows.join('\r\n');
}

export const fmtS = (s) => fmt(s, 2);
