// Tests de js/sight3d.js (portage de la visibilité 3D de BVTrace).
import { stopDistCerema, finishedSurface, composite, scanAxis, insufficientRuns, lineClear } from '../js/sight3d.js';
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.error('ÉCHEC', m); } };
// distance d'arrêt Cerema 2018 à 90 km/h, palier : 1,8·25 + 25²/(2·9,81·0,41) = 45 + 77,7 = 122,7 m
ok(Math.abs(stopDistCerema(90) - (45 + 625 / (2 * 9.81 * 0.41))) < 1e-9, 'da 90 km/h');
ok(stopDistCerema(90, -0.06) > stopDistCerema(90, 0.06), 'descente allonge la distance');
ok(Math.abs(stopDistCerema(90, 0, 'A') / stopDistCerema(90) - 1.1) < 1e-9, 'NPV A');
// axe droit le long de x, profil en long en dos d'âne (sommet à s = 500), surface = chaussée plate transversalement
const ax = { len: 1000, at: (s) => ({ p: { x: s, y: 0 }, t: { x: 1, y: 0 } }) };
const zc = (s) => -((s - 500) ** 2) / (2 * 1500), zAt = (s) => (Math.abs(s - 500) <= 150 ? zc(s) : zc(500 + Math.sign(s - 500) * 150) - (Math.abs(s - 500) - 150) * 0.1); // angle saillant R = 1500 m entre 350 et 650, pentes de 10 %
const secs = []; for (let s = 0; s <= 1000; s += 10) secs.push({ s, p: { x: s, y: 0 }, t: { x: 1, y: 0 }, n: { x: 0, y: 1 }, proj: [{ y: -8, z: zAt(s) }, { y: 8, z: zAt(s) }] });
const surf = composite(finishedSurface([secs]), { heightAt: () => -1e9 });
ok(Math.abs(surf.heightAt(250, 3) - zAt(250)) < 0.05, 'surface finie interpolée');
ok(!lineClear({ x: 400, y: 0, z: zAt(400) + 1.1 }, { x: 600, y: 0, z: zAt(600) + 0.5 }, surf).clear, 'sommet masque à 200 m');
const v = scanAxis(ax, zAt, surf, () => 150, 1.5, { tgtH: 0.5, step: 10 });
const ko = v.filter((q) => q.status === 'ko' && q.dir === 1);
ok(ko.length > 0 && ko.every((q) => q.s > 150 && q.s < 650), `masque avant le sommet dans le sens + (${ko.map((q) => q.s).join(',')})`);
// R = 1500 m, h1 = 1,10, h2 = 0,50 : visée = √(2R)(√h1 + √h2) ≈ 54,8·(1,049 + 0,707) ≈ 96 m < 150 m
const mid = v.find((q) => q.s === 450 && q.dir === 1); ok(mid && Math.abs(mid.avail - 96) < 16, `visée au sommet ≈ 96 m (${mid?.avail})`);
ok(insufficientRuns(v, 1, 10).length === 1, 'un seul tronçon masqué par sens');
ok(v.some((q) => q.status === 'nd'), 'fin de l\'axe : indéterminé');
console.log(fail ? `${fail} échec(s)` : 'test-sight3d : OK'); process.exit(fail ? 1 : 0);
