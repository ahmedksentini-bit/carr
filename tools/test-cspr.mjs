// Tests de js/cspr.js : distance d'arrêt et visibilité verticale.
import { stopDist, sightGap } from '../js/cspr.js';
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.error('ÉCHEC', m); } };
ok(Math.abs(stopDist(50) - (2 * 50 / 3.6 + (50 / 3.6) ** 2 / (2 * 9.81 * 0.46))) < 1e-9, 'd(50)');
ok(stopDist(130) > stopDist(110) && stopDist(110) > stopDist(90), 'd croissante');
ok(Math.abs(stopDist(130) - (2 * 130 / 3.6 + (130 / 3.6) ** 2 / (2 * 9.81 * 0.30))) < 1e-9, 'γ 0,30 à 130 km/h');
// plat : visible ; dos d'âne de 2 m au milieu : masqué
ok(sightGap(() => 10, 0, 200, 1, 1).gap <= 0, 'plat visible');
const bump = (s) => 10 + 2 * Math.exp(-(((s - 100) / 10) ** 2));
const g = sightGap(bump, 0, 200, 1, 1); ok(g.gap > 0.9 && Math.abs(g.s - 100) < 2, 'bosse masque');
console.log(fail ? `${fail} échec(s)` : 'test-cspr : OK'); process.exit(fail ? 1 : 0);
