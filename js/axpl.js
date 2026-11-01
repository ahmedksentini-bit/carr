// axpl.js — profils en long des axes de l'échangeur : autoroute, voies secondaires et bretelles (les branches du
// carrefour ont le leur, pl.js). Ligne rouge par points d'inflexion (abscisse s le long de l'axe, cote z, rayon R du
// raccordement parabolique), mêmes conventions que pl.js.
// • Autoroute et voies secondaires : profil entièrement saisi (ou proposé depuis le TN).
// • Bretelles : extrémités calées automatiquement, quand c'est possible, sur la chaussée hôte (cote de l'hôte à
//   l'abscisse du raccordement, moins le dévers de 2,5 % sur le décalage latéral) ou sur la cote zC du giratoire où
//   elles aboutissent ; les points saisis s'intercalent entre ces deux extrémités imposées.
// • Contrôles : pente maximale et rayons minimaux saillants / rentrants de la catégorie (ICTAAL tab. 3-1 pour
//   l'autoroute, guide des échangeurs tab. 3-1 pour les bretelles, ARP pour une route ordinaire) ; tirant d'air sous
//   les passages supérieurs (cote de la voie portée − épaisseur du tablier − cote de l'autoroute ≥ gabarit).
import * as G from './geom.js';
import { fmt } from './common.js';
import { plBuild } from './pl.js';
import { tinZ } from './tin.js';
import { HWY_CAT, RAMP_CAT, crossList, crossParams, parseXref, hwyParams } from './echangeur.js';
import { DCAT, designCatOf, profileChecks } from './roadcat.js';

const num = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);
const CROSSFALL = 0.025;

// Construit un profil à partir de nœuds absolus [{ s, z, R }] (le premier peut être à s > 0).
export function buildNodes(nodes) {
  if (!nodes.length) return null;
  const n0 = nodes[0];
  const P = plBuild({ pis: nodes.slice(1).map((q) => ({ s: q.s - n0.s, z: q.z, R: q.R || 0 })) }, n0.z);
  const zAt = (s) => P.zAt(s - n0.s), gradeAt = (s) => P.gradeAt(s - n0.s);
  return {
    nodes: P.nodes.map((q, i) => ({ ...q, s: q.s + n0.s, R: i ? q.R : n0.R || 0 })),
    segs: P.segs.map((q) => ({ ...q, s0: q.s0 + n0.s, s1: q.s1 + n0.s })),
    curves: P.curves.map((c) => ({ ...c, s: c.s + n0.s, sA: c.sA + n0.s, sB: c.sB + n0.s })),
    issues: P.issues, zAt, gradeAt, sEnd: P.sEnd + n0.s, s0: n0.s,
  };
}

// Clé d'axe de l'hôte d'une extrémité de bretelle.
export function hostKey(prj, ref) {
  if (!ref || ref === 'free') return null;
  if (/^hwy[12]$/.test(ref)) return 'hwy';
  const x = parseXref(ref);
  if (x) { const id = crossList(prj)[x.k]?.id; return `x:${id ?? x.k}`; }
  return (prj.ramps || []).some((r) => r.id === ref) ? `r:${ref}` : null;
}

const sortPis = (pis) => (Array.isArray(pis) ? pis : []).map((q) => ({ s: num(q.s, NaN), z: num(q.z, NaN), R: Math.max(0, num(q.R, 0)) }))
  .filter((q) => Number.isFinite(q.s) && Number.isFinite(q.z)).sort((a, b) => a.s - b.s);

// Limites de la catégorie de l'axe : { gMax, Rconv, Rconc, label }.
export function axisLimits(prj, key) {
  // autoroute et voies secondaires : catégorie de conception (roadcat.js, règles reprises de BVTrace)
  if (key === 'hwy' || key.startsWith('x:')) {
    const H = key === 'hwy' ? hwyParams(prj) : crossParams(prj, Math.max(0, crossList(prj).findIndex((c) => `x:${c.id}` === key)));
    const cat = designCatOf(key === 'hwy' ? { ...H, kind: 'autoroute' } : H), C = DCAT[cat];
    if (C.libre) return { cat, gMax: Infinity, Rconv: 1000, Rconc: 1000, label: 'conception libre (aucune règle ; rayon proposé 1 000 m)' };
    return { cat, gMax: C.gMax / 100, Rconv: C.Rvs, Rconc: C.Rvr, label: `${C.label} : pente ≤ ${C.gMax} %, Rv saillant ≥ ${fmt(C.Rvs, 0)} m, rentrant ≥ ${fmt(C.Rvr, 0)} m (${C.ref})` };
  }
  const r = (prj.ramps || []).find((q) => `r:${q.id}` === key), C = RAMP_CAT[r?.cat] || RAMP_CAT.b70;
  return { gMax: C.pente / 100, Rconv: C.Rs, Rconc: C.Rr, label: `guide des échangeurs (${C.label}) : pente ≤ ${C.pente} %, Rv saillant ≥ ${fmt(C.Rs, 0)} m, rentrant ≥ ${fmt(C.Rr, 0)} m` };
}

// Profils de tous les axes : Map clé → { key, name, len, PL, user (PI saisis), tied: [{ s, z, why }], defined, checks }.
// axes : listAxes(prj, D) ; juncs : [{ O, Rg, zC }] ; tin : MNT (ou null).
export function buildAxisProfiles(prj, D, axes, juncs = [], tin = null) {
  const out = new Map(), byKey = Object.fromEntries(axes.map((a) => [a.key, a]));
  const store = prj.axpl || {};
  const ramps = prj.ramps || [];
  const mk = (ax, nodes, user, tied) => {
    const PL = nodes.length >= 1 ? buildNodes(nodes) : null;
    out.set(ax.key, { key: ax.key, name: ax.name, len: ax.len, PL, user, tied, defined: !!PL && nodes.length >= 2, al: ax.al, cat: ax.cat });
  };
  for (const ax of axes) if (ax.key === 'hwy' || ax.key.startsWith('x:')) { const u = sortPis(store[ax.key]?.pis); mk(ax, u, u, []); }
  // Bretelles : extrémités calées sur l'hôte (dans l'ordre des dépendances : une collectrice avant ses bretelles).
  const zHost = (key, p) => {
    const H = out.get(key), ax = byKey[key];
    if (!H?.defined || !ax) return null;
    const pr = ax.project(p); if (!pr) return null;
    return { z: H.PL.zAt(Math.max(0, Math.min(ax.len, pr.s))) - CROSSFALL * Math.abs(pr.off), s: pr.s };
  };
  const pending = ramps.filter((r) => byKey[`r:${r.id}`]);
  for (let pass = 0; pass < 4 && pending.length; pass++) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const r = pending[i], ax = byKey[`r:${r.id}`];
      const hk = [hostKey(prj, r.from?.ref), hostKey(prj, r.to?.ref)];
      if (pass < 3 && hk.some((k) => k && k.startsWith('r:') && byKey[k] && !out.has(k))) continue; // hôte bretelle pas encore résolu
      const tied = [];
      for (const [end, k] of [[0, hk[0]], [1, hk[1]]]) {
        const s = end ? ax.len : 0, p = ax.at(s).p;
        let z = null, why = '';
        if (k) { const h = zHost(k, p); if (h) { z = h.z; why = `${byKey[k].name} (s = ${fmt(h.s, 1)} m)`; } }
        // extrémité libre posée sur une autre chaussée (carrefour plan à compléter) : calée sur elle
        if (z == null && !k) for (const a of axes) {
          if (a.key === ax.key || a.key.startsWith('b:') || !out.get(a.key)?.defined) continue;
          const pr = a.project(p);
          if (pr && Math.abs(pr.off) < (a.half || 4) + 40) { const H = out.get(a.key); z = H.PL.zAt(Math.max(0, Math.min(a.len, pr.s))) - CROSSFALL * Math.min(Math.abs(pr.off), a.half || 4); why = `${a.name} (carrefour à ${fmt(Math.abs(pr.off), 0)} m de l'axe, s = ${fmt(pr.s, 1)} m)`; break; }
        }
        if (z == null) { const j = juncs.find((q) => q.zC != null && Number.isFinite(q.zC) && G.dist(q.O, p) < q.Rg + 40); if (j) { z = j.zC; why = `${j.name || 'giratoire'} (zC)`; } }
        if (z != null) tied.push({ s, z: Math.round(z * 1000) / 1000, R: 0, why, end });
      }
      const u = sortPis(store[`r:${r.id}`]?.pis).filter((q) => !tied.some((t) => Math.abs(t.s - q.s) < 1));
      const nodes = [...tied, ...u].sort((a, b) => a.s - b.s);
      mk(ax, nodes, u, tied);
      pending.splice(i, 1);
    }
  }
  return out;
}

// Contrôles d'un profil d'axe (pente, rayons, raccordements) ; la portée des messages est préfixée par le nom de l'axe.
export function axisPlChecks(prj, A) {
  const out = [];
  if (!A?.defined) return out;
  const lim = axisLimits(prj, A.key), PL = A.PL, add = (lvl, msg) => out.push({ lvl, msg: `${A.name} (profil en long) : ${msg}` });
  for (const it of PL.issues) add(it.lvl, it.msg);
  if (lim.cat) { // autoroute / voie secondaire : contrôles de la catégorie (pente, Rv, coordination, pente résultante)
    out.push(...profileChecks(lim.cat, PL, A.al, A.name, Math.max(0, +(prj.pt?.dev ?? 2.5) || 2.5)));
    for (let i = 1; i + 1 < PL.nodes.length; i++) if (!(PL.nodes[i].R > 0) && Math.abs(PL.segs[i].g - PL.segs[i - 1].g) > 0.005) add('warn', `changement de pente de ${fmt(Math.abs(PL.segs[i].g - PL.segs[i - 1].g) * 100, 2)} % à s = ${fmt(PL.nodes[i].s, 0)} m sans raccordement (R = 0).`);
    if (PL.sEnd > A.len + 0.5) add('info', `dernier point à s = ${fmt(PL.sEnd, 0)} m, au-delà de l'axe (${fmt(A.len, 0)} m).`);
    return out;
  }
  for (const sg of PL.segs) if (Math.abs(sg.g) > lim.gMax + 1e-9) add('warn', `pente de ${fmt(Math.abs(sg.g) * 100, 2)} % entre s = ${fmt(sg.s0, 0)} et ${fmt(sg.s1, 0)} m — ${lim.label}.`);
  for (const c of PL.curves) { const Rmin = c.type === 'convexe' ? lim.Rconv : lim.Rconc; if (c.R < Rmin - 1e-9) add('warn', `raccordement ${c.type === 'convexe' ? 'saillant' : 'rentrant'} R = ${fmt(c.R, 0)} m à s = ${fmt(c.s, 0)} m < ${fmt(Rmin, 0)} m — ${lim.label}.`); }
  for (let i = 1; i + 1 < PL.nodes.length; i++) if (!(PL.nodes[i].R > 0) && Math.abs(PL.segs[i].g - PL.segs[i - 1].g) > 0.005) add('warn', `changement de pente de ${fmt(Math.abs(PL.segs[i].g - PL.segs[i - 1].g) * 100, 2)} % à s = ${fmt(PL.nodes[i].s, 0)} m sans raccordement (R = 0).`);
  if (PL.sEnd > A.len + 0.5) add('info', `dernier point à s = ${fmt(PL.sEnd, 0)} m, au-delà de l'axe (${fmt(A.len, 0)} m).`);
  return out;
}

// Tirant d'air sous chaque passage supérieur : cote de la voie portée au croisement − épaisseur du tablier − cote de
// l'autoroute (sous l'ouvrage, au droit de la voie portée) ≥ gabarit.
export function clearanceChecks(prj, profiles, axes, ouvrList) {
  const out = [], byKey = Object.fromEntries(axes.map((a) => [a.key, a])), H = profiles.get('hwy'), axH = byKey.hwy;
  if (!H?.defined || !axH) return out;
  for (const o of ouvrList || []) {
    const m = /^x:([^:]+):/.exec(o.key || '');
    if (!m) continue;
    const key = `x:${m[1]}`, X = profiles.get(key), axX = byKey[key];
    if (!X?.defined || !axX || !o.P) continue;
    const prX = axX.project(o.P), prH = axH.project(o.P);
    if (!prX || !prH) continue;
    const zX = X.PL.zAt(prX.s), zH = H.PL.zAt(prH.s), ta = zX - (o.h || 0) - zH;
    const lvl = ta < o.gab - 0.005 ? 'err' : 'ok';
    out.push({ lvl, ouvr: o.name, ta, key, sX: prX.s, zNeed: zH + (o.h || 0) + o.gab + 0.10, msg: `${o.name} : tirant d'air ${fmt(ta, 2)} m (voie portée ${fmt(zX, 2)} − tablier ${fmt(o.h, 2)} − autoroute ${fmt(zH, 2)})${lvl === 'err' ? ` < gabarit ${fmt(o.gab, 2)} m : relevez le profil de ${X.name} ou abaissez celui de l'autoroute.` : ` ≥ ${fmt(o.gab, 2)} m.`}` });
  }
  return out;
}

// Ligne de terrain naturel le long d'un axe (pas 2 m sur les longs axes).
export function axisTerrainLine(ax, tin, step) {
  const out = [];
  if (!tin) return out;
  const st = step || Math.max(1, Math.min(5, ax.len / 600));
  for (let s = 0; s <= ax.len + 1e-9; s += st) { const { p } = ax.at(s); const z = tinZ(tin, p.x, p.y); if (z != null) out.push([s, z]); }
  return out;
}

// Proposition depuis le TN (PI tous les `every` m, rayons plafonnés), en respectant les extrémités imposées.
export function axisFromTerrain(ax, tin, { every, R = 3000, tied = [] } = {}) {
  const ev = every || Math.max(60, Math.min(250, ax.len / 12));
  const pis = [];
  const zt = (s) => { const { p } = ax.at(s); return tinZ(tin, p.x, p.y); };
  const s0 = tied.some((t) => t.end === 0) ? ev : 0, s1 = tied.some((t) => t.end === 1) ? ax.len - ev / 2 : ax.len;
  for (let s = s0; s <= s1 + 1e-9; s += ev) { const z = zt(s); if (z != null) pis.push({ s: Math.round(s * 10) / 10, z: Math.round(z * 100) / 100, R }); }
  if (!tied.some((t) => t.end === 1)) { const z = zt(ax.len); if (z != null && (!pis.length || ax.len - pis[pis.length - 1].s > 1)) pis.push({ s: Math.round(ax.len * 10) / 10, z: Math.round(z * 100) / 100, R: 0 }); }
  const nodes = [...tied, ...pis].sort((a, b) => a.s - b.s);
  for (let i = 1; i < nodes.length - 1; i++) {
    const q = nodes[i]; if (!pis.includes(q)) continue;
    const g1 = (q.z - nodes[i - 1].z) / (q.s - nodes[i - 1].s), g2 = (nodes[i + 1].z - q.z) / (nodes[i + 1].s - q.s);
    const dg = Math.abs(g2 - g1), dmin = Math.min(q.s - nodes[i - 1].s, nodes[i + 1].s - q.s);
    q.R = dg < 1e-6 ? 0 : Math.max(100, Math.floor(Math.min(R, (0.8 * dmin) / dg) / 100) * 100);
  }
  if (pis.length && !tied.some((t) => t.end === 0)) pis[0].R = 0;
  return pis;
}

export { CROSSFALL, hwyParams };
