// test-pl.mjs — proposition de ligne rouge depuis le TN (pl.js, plDraft, démarche BVTrace) : extrémité imposée,
// pentes bornées, espacement minimal, rayons dans [Rmin, Rmax] sans chevauchement, extrémité aval imposée.
// Exécution : node tools/test-pl.mjs — code de retour ≠ 0 en cas d'échec.
import { plDraft, plBuild } from '../js/pl.js';

let fails = 0, n = 0;
const check = (label, ok, info = '') => { n++; if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${info ? ' — ' + info : ''}`); };
const tn = []; for (let s = 0; s <= 800; s += 2) tn.push([s, 100 + 8 * Math.sin(s / 110) + 0.004 * s]);
const o = { s0: 0, s1: 800, start: { s: 0, z: 100 }, end: null, dz: 0.5, gUp: 0.05, gDown: 0.04, RsMin: 2500, RsMax: 7500, RrMin: 1500, RrMax: 4500, minSpan: 90 };
{
  const r = plDraft(tn, o), PL = plBuild({ pis: r.pis }, 100);
  check('proposition non vide, dernière abscisse à la fin de l\'axe', r.pis.length >= 2 && Math.abs(r.pis[r.pis.length - 1].s - 800) < 0.1, JSON.stringify(r.pis));
  check('pentes bornées (rampe ≤ 5 %, pente ≤ 4 %)', PL.segs.every((sg) => sg.g <= 0.05 + 1e-6 && sg.g >= -0.04 - 1e-6), PL.segs.map((sg) => (sg.g * 100).toFixed(2)).join(' '));
  check('espacement des sommets ≥ 90 m', PL.nodes.every((q, i) => !i || q.s - PL.nodes[i - 1].s >= 90 - 1e-6));
  check('raccordements sans chevauchement', PL.issues.length === 0, PL.issues.map((i) => i.msg).join(' | '));
  check('rayons dans [Rmin, Rmax] du type, ou réduits avec une note', PL.curves.every((c) => (c.type === 'convexe' ? c.R <= 7500 : c.R <= 4500)) && (PL.curves.every((c) => c.R >= (c.type === 'convexe' ? 2500 : 1500)) || r.notes.length > 0));
  const dev = Math.max(...tn.filter(([s]) => s > 50).map(([s, z]) => Math.abs(PL.zAt(s) - z - 0.5)));
  check('ligne rouge proche du TN + 0,50 m (écart < 4 m hors du départ imposé)', dev < 4, `écart max ${dev.toFixed(2)} m`);
}
{
  const r = plDraft(tn, { ...o, end: { s: 800, z: 104 } }), PL = plBuild({ pis: [...r.pis, { s: 800, z: 104, R: 0 }] }, 100);
  check('extrémité aval imposée : pas de sommet ajouté sur elle, pentes bornées', r.pis.every((q) => q.s < 800 - 1e-6) && PL.segs.every((sg) => sg.g <= 0.05 + 1e-6 && sg.g >= -0.04 - 1e-6));
}
check('TN absent : aucune proposition', plDraft([], o).pis.length === 0);
console.log(`\n${n - fails}/${n} contrôles réussis`);
if (fails) process.exit(1);
