// test-talus.mjs — contrôles du dessin des talus en plan (js/talus.js) : deux remblais droits qui se croisent à des
// hauteurs différentes sur TN plat, découpe sur la ligne de rencontre et sous les plates-formes, barbules du déblai
// sous un remblai. Exécution : node tools/test-talus.mjs — code de retour ≠ 0 en cas d'échec.
import { talusPrims } from '../js/talus.js';

let fails = 0, n = 0;
const check = (label, ok, info = '') => { n++; if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${info ? ' — ' + info : ''}`); };

// Couloir droit le long de dir (0 : axe x, 1 : axe y), plate-forme demi-largeur w à la cote h au-dessus du TN (z = 0),
// talus 1/1 : EET à w + h (remblai, h > 0) ou plate-forme sous le TN (déblai, h < 0, EET à w + |h|).
function corridor(dir, w, h, from = -60, to = 60, step = 2) {
  const rows = [];
  for (let s = from; s <= to + 1e-9; s += step) {
    const P = (y, z) => (dir === 0 ? { x: s, y, z } : { x: -y, y: s, z });
    const br = h >= 0 ? 'R' : 'D', d = w + Math.abs(h);
    rows.push({ s, L: { edge: P(-w, h), c: P(-w, h), e: P(-d, 0), br }, R: { edge: P(w, h), c: P(w, h), e: P(d, 0), br } });
  }
  return { rows };
}
const inRect = (p, x0, x1, y0, y1) => p.x > x0 + 1e-6 && p.x < x1 - 1e-6 && p.y > y0 + 1e-6 && p.y < y1 - 1e-6;
const lines = (res, role, L = 'TALUS') => res.prims.filter((p) => p.L === L && (role == null || p.role === role)).flatMap((p) => p.lines);
const mid = ([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

{ // A : remblai de 2 m le long de x (plate-forme |y| ≤ 5, EET |y| = 7) ; B : remblai de 6 m le long de y (|x| ≤ 4, EET |x| = 10)
  const res = talusPrims([corridor(0, 5, 2), corridor(1, 4, 6)]);
  const all = lines(res, 'R');
  check('barbules produites', all.length > 100, `${all.length} barbules`);
  // aucune barbule de quoi que ce soit dans la plate-forme de B (|x| < 4) ni dans celle de A (|y| < 5) hors croisement
  check('aucune barbule sous la plate-forme de B', !all.some((l) => inRect(mid(l), -4, 4, -60, 60) && Math.abs(mid(l).y) < 5 + 2 + 1e-6 && Math.abs(mid(l).y) > 0 && inRect(mid(l), -4, 4, -7, 7)));
  // talus de A dans le talus de B (4 < |x| < 10) : B plus haut partout où z_B(x) = 6 − (|x| − 4) > z_A ; A masqué
  const aInB = all.filter((l) => Math.abs(l[1].y - l[0].y) > Math.abs(l[1].x - l[0].x)).filter((l) => { /* barbules de A : orientées selon y */ const m = mid(l); const zB = 6 - (Math.abs(m.x) - 4), zA = Math.abs(m.y) <= 5 ? 2 : 2 - (Math.abs(m.y) - 5); return Math.abs(m.y) < 7 && Math.abs(m.y) > 5 && Math.abs(m.x) > 4 && Math.abs(m.x) < 10 && zB > zA + 0.3; });
  check('talus de A masqué sous le remblai plus haut de B', aInB.length === 0, `${aInB.length} barbule(s) de A sous B`);
  // le talus de B reste dessiné au-dessus de la plate-forme de A ? non : la plate-forme de A masque B
  const bOnA = all.filter((l) => { const m = mid(l); return Math.abs(m.y) < 5 - 0.2 && Math.abs(m.x) > 4.2 && Math.abs(m.x) < 10; });
  check('talus de B masqué sur la plate-forme de A', bOnA.length === 0, `${bOnA.length}`);
  // les bords (crêtes) sont découpés aussi
  const cr = lines(res, 'crete');
  check('crête de A interrompue dans la plate-forme de B', !cr.some((l) => { const m = mid(l); return Math.abs(m.x) < 3.8 && Math.abs(Math.abs(m.y) - 5) < 0.01; }));
  const eet = lines(res, null, 'EET');
  check('EET de A interrompue sous le remblai de B', !eet.some((l) => { const m = mid(l); return Math.abs(m.x) < 9.5 && Math.abs(Math.abs(m.y) - 7) < 0.01; }));
  check('EET de A conservée loin de B', eet.some((l) => { const m = mid(l); return Math.abs(m.x) > 20 && Math.abs(Math.abs(m.y) - 7) < 0.01; }));
}
{ // A : déblai de 3 m le long de x ; B : remblai de 4 m le long de y : le déblai de A est masqué sous le remblai de B
  const res = talusPrims([corridor(0, 5, -3), corridor(1, 4, 4)]);
  const d = lines(res, 'D');
  check('barbules de déblai produites', d.length > 50, `${d.length}`);
  check('déblai de A masqué sous le remblai de B', !d.some((l) => { const m = mid(l); return Math.abs(m.x) < 8 - 0.2; }));
}
{ // masque (tablier) : aucune barbule dans le rectangle
  const deck = [{ x: -20, y: -20 }, { x: -10, y: -20 }, { x: -10, y: 20 }, { x: -20, y: 20 }];
  const res = talusPrims([corridor(0, 5, 2)], [deck]);
  check('aucune barbule sous le tablier', !lines(res, 'R').some((l) => inRect(mid(l), -20, -10, -20, 20)));
}
{ // alternance longue / courtes : une longue (2 m en plan) pour trois courtes (0,68 m)
  const res = talusPrims([corridor(0, 5, 2, 0, 40)], [], { esp: 2 });
  const len = lines(res, 'R').map(([a, b]) => Math.hypot(b.x - a.x, b.y - a.y));
  const lg = len.filter((v) => v > 1.9).length, sh = len.filter((v) => v < 0.7).length;
  check('trois courtes pour une longue', Math.abs(sh - 3 * lg) <= 6, `${lg} longues, ${sh} courtes`);
}
console.log(`\n${n - fails}/${n} contrôles réussis`);
process.exit(fails ? 1 : 0);
