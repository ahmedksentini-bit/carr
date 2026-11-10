// HATCH DXF : contours polylignes (bulges) et arêtes ligne / arc (sens trigo et horaire) / ellipse.
import { hatchLoops, buildDxfGeometry, parseDXF } from '../js/dxf-parse.js';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('ÉCHEC', m); } };
const area = (f) => { let a = 0; for (let i = 0; i < f.length; i += 2) { const j = (i + 2) % f.length; a += f[i] * f[j + 1] - f[j] * f[i + 1]; } return a / 2; };
const near = (a, b, t, m) => ok(Math.abs(a - b) < t, `${m} : ${a} ≠ ${b}`);

// 1. Polyligne fermée : carré 10 × 10 avec un côté en demi-cercle (bulge 1) → 100 + π·25/2
let L = hatchLoops([[91, 1], [92, 2], [72, 1], [73, 1], [93, 4], [10, 0], [20, 0], [42, 0], [10, 10], [20, 0], [42, 1], [10, 10], [20, 10], [42, 0], [10, 0], [20, 10], [42, 0], [97, 0], [75, 0]]);
ok(L.length === 1, 'un contour polyligne');
near(Math.abs(area(L[0])), 100 + (Math.PI * 25) / 2, 0.5, 'aire carré + demi-disque');

// 2. Arêtes : demi-disque de rayon 5 fermé par son diamètre — arc trigo 0 → 180°
const E = (ccw, a0, a1) => [[91, 1], [92, 1], [93, 2], [72, 2], [10, 0], [20, 0], [40, 5], [50, a0], [51, a1], [73, ccw], [72, 1], [10, -5], [20, 0], [11, 5], [21, 0], [97, 0]];
L = hatchLoops(E(1, 0, 180));
near(Math.abs(area(L[0])), (Math.PI * 25) / 2, 0.3, 'demi-disque supérieur (arc trigo)');
ok(L[0].some((v, i) => i % 2 === 1 && v > 4.9), 'arc trigo au-dessus de l\'axe');
// arc horaire : angles stockés en complément (360 − a) → demi-disque inférieur
L = hatchLoops(E(0, 0, 180));
ok(L[0].some((v, i) => i % 2 === 1 && v < -4.9) && !L[0].some((v, i) => i % 2 === 1 && v > 0.01), 'arc horaire sous l\'axe');

// 3. Deux contours (trou) + ellipse complète
L = hatchLoops([[91, 2], [92, 1], [93, 1], [72, 3], [10, 0], [20, 0], [11, 10], [21, 0], [40, 0.5], [50, 0], [51, 360], [73, 1], [97, 0],
  [92, 2], [72, 0], [73, 1], [93, 4], [10, -1], [20, -1], [10, 1], [20, -1], [10, 1], [20, 1], [10, -1], [20, 1], [97, 0]]);
ok(L.length === 2, 'deux contours');
near(Math.abs(area(L[0])), Math.PI * 10 * 5, 1, 'aire ellipse');
near(Math.abs(area(L[1])), 4, 1e-9, 'aire trou');

// 4. Entité complète via le lecteur DXF (calque, transformations, unités)
const dxf = ['0', 'SECTION', '2', 'ENTITIES', '0', 'HATCH', '8', 'Bati_H', '10', '0', '20', '0', '30', '0', '2', 'ANSI31', '70', '0', '71', '0', '91', '1',
  '92', '2', '72', '0', '73', '1', '93', '3', '10', '0', '20', '0', '10', '4', '20', '0', '10', '0', '20', '3', '97', '0', '75', '0', '76', '1', '0', 'ENDSEC', '0', 'EOF'].join('\n');
const geo = buildDxfGeometry(parseDXF(dxf), 1000);
ok(geo.hatches.length === 1 && geo.hatches[0].layer === 'Bati_H', 'hachure lue sur son calque');
near(Math.abs(area(Array.from(geo.hatches[0].rings[0]))), 6e6, 1, 'triangle mis à l\'échelle des unités');
ok(geo.layers.has('Bati_H'), 'calque recensé');

if (fails) { console.error(`${fails} échec(s)`); process.exit(1); }
console.log('test-hatch : OK');
