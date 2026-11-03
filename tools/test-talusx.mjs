// Rencontre de deux talus (talus.js) : deux plates-formes parallèles en remblai, axes à 25 m, TN plat à 0.
//   A : axe y = 0, demi-largeur 5, z = 10 → talus 3/2 jusqu'à y = ±20 ;
//   B : axe y = 25, demi-largeur 5, z = 8 → talus 3/2 jusqu'à y = 8 et 42.
// Rencontre attendue : 10 − (y − 5)/1,5 = 8 − (20 − y)/1,5 → y = 14 (z = 4), sur toute la longueur (100 m).
// Même cas en déblai (plates-formes à −10 et −8) : rencontre au même endroit (enveloppe inférieure).
import { talusPrims } from '../js/talus.js';
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('ÉCHEC', m); } else console.log('ok', m); };
const P = (x, y, z) => ({ x, y, z });
function corridor(yc, h, z, sgn) { // sgn = +1 remblai, −1 déblai
  const rows = [], d = 1.5 * Math.abs(z), br = sgn > 0 ? 'R' : 'D';
  for (let x = 0; x <= 100; x += 5) {
    const side = (s) => { const c = P(x, yc + s * h, z); return { edge: c, c, e: P(x, yc + s * (h + d), 0), br }; };
    rows.push({ s: x, L: side(-1), R: side(1) });
  }
  return { id: String(yc), rows };
}
const len = (l) => l.reduce((t, [p, q]) => t + Math.hypot(q.x - p.x, q.y - p.y), 0);
for (const [sgn, nm] of [[1, 'remblai'], [-1, 'déblai']]) {
  const T = talusPrims([corridor(0, 5, 10 * sgn, sgn), corridor(25, 5, 8 * sgn, sgn)], [], { esp: 2 });
  const inter = T.prims.find((p) => p.role === 'inter')?.lines || [], eet = T.prims.find((p) => p.L === 'EET')?.lines || [];
  ok(Math.abs(len(inter) - 100) < 0.5, `${nm} : ligne de rencontre ${len(inter).toFixed(2)} m ≈ 100 m`);
  ok(inter.every(([p, q]) => Math.abs(p.y - 14) < 0.05 && Math.abs(q.y - 14) < 0.05), `${nm} : rencontre en y = 14`);
  ok(eet.every(([p, q]) => !((p.y > 7.9 && p.y < 20.1) || (q.y > 7.9 && q.y < 20.1))), `${nm} : aucune EET entre les plates-formes`);
  ok(Math.abs(len(eet) - 200) < 1, `${nm} : EET extérieures ${len(eet).toFixed(1)} m ≈ 200 m`);
  const barb = T.prims.filter((p) => p.role === 'R' || p.role === 'D').flatMap((p) => p.lines);
  ok(barb.every(([p, q]) => !(p.y > 5 && p.y < 14 - 0.05 && q.y > 14.05) && !(q.y > 5 && q.y < 13.95 && p.y > 14.05)), `${nm} : barbules arrêtées à la rencontre`);
}
// Plates-formes éloignées (talus disjoints) : pas de ligne de rencontre.
{
  const T = talusPrims([corridor(0, 5, 10, 1), corridor(60, 5, 8, 1)], [], { esp: 2 });
  ok(!T.prims.some((p) => p.role === 'inter'), 'talus disjoints : pas de ligne de rencontre');
}
if (fail) { console.log(`${fail} échec(s)`); process.exit(1); }
console.log('test-talusx : tout est bon');
