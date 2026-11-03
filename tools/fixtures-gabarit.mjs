// Projet d'essai : autoroute est-ouest (z = 100), voie secondaire nord-sud à cote zX, bretelle libre franchissant la
// voie secondaire à cote zR (null : pas de bretelle).
export function prjBase(zX, zR) {
  return {
    app: 'GIRA', name: 't', context: 'interurbain', kind: 'giratoire', center: { auto: false, x: 0, y: 0 },
    ring: { Rg: 20, la: 7, zC: 100 }, plan: {}, section: {}, signs: {}, tn: { pts: [] }, pt: {}, branches: [], others: [],
    hwy: { on: true, kind: 'autoroute', name: 'A1', cat: 'L2', lanes: 2, axis: [{ x: -800, y: 0 }, { x: 800, y: 0 }] },
    crosses: [{ id: 'c1', name: 'RN1', kind: 'route', axis: [{ x: 0, y: -600 }, { x: 0, y: 600 }] }],
    ramps: zR == null ? [] : [{ id: 'r1', name: 'B1', cat: 'b50', from: { ref: 'free' }, to: { ref: 'free' }, pis: [{ x: -300, y: 300 }, { x: 300, y: 320 }] }],
    axpl: { hwy: { pis: [{ s: 0, z: 100, R: 0 }, { s: 1600, z: 100, R: 0 }] }, 'x:c1': { pis: [{ s: 0, z: zX, R: 0 }, { s: 1200, z: zX, R: 0 }] }, ...(zR == null ? {} : { 'r:r1': { pis: [{ s: 0, z: zR, R: 0 }, { s: 700, z: zR, R: 0 }] } }) },
    traffic: { od: {}, pl: {}, qp: {}, tad: {} }, opts: { angleUnit: 'gon', textH: 0.8, vis: {} },
  };
}
