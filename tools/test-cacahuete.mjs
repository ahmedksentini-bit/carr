// test-cacahuete.mjs — carrefour « cacahuète » (js/ringshape.js et son branchement dans js/roundabout.js) : contour
// fermé et continu, décalages parallèles, cols concaves / rectilignes, largeur d'îlot au col, rattachement des
// branches aux lobes, contrôles (branche dans un col, cols croisés, col trop serré), déflexion en S, cercle inchangé.
// Référence : Sétra, fiche d'expérience RACA « Le carrefour cacahuète », mai 2010 (Rg = 20 m, cols R = 30 m, la = 7 m).
// Exécution : node tools/test-cacahuete.mjs — code de retour ≠ 0 en cas d'échec.
import * as G from '../js/geom.js';
import { peanutShape, peanutParams, projectOnPath, subPath, waistWidth, signedOffset } from '../js/ringshape.js';
import { buildDesign } from '../js/roundabout.js';
import { checkDesign } from '../js/norms.js';

let fails = 0, n = 0;
const check = (label, ok, info = '') => { n++; if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${info ? ' — ' + info : ''}`); };
const near = (a, b, t = 0.01) => Math.abs(a - b) <= t;
const O = { x: 0, y: 0 }, X = { x: 1, y: 0 };

// --- Forme ------------------------------------------------------------------------------------------------------
{
  const S = peanutShape(O, X, peanutParams({ e: 44, Rwg: 30, Rwd: 30 }, 20));
  const P = S.path(0);
  const gap = Math.max(...P.map((sg, i) => G.dist(G.segEnd(sg), G.segStart(P[(i + 1) % P.length]))));
  check('contour Rg fermé et continu', S.ok && gap < 1e-9, `écart ${gap}`);
  check('sens trigonométrique (aire > 0)', G.polyArea(G.samplePath(P, 0.5)) > 0);
  // Col : centre P à Rg + Rw des deux centres ; décalage t parallèle (distance au centre du col Rw − t).
  const W = S.waists[0], P7 = S.path(-7)[1];
  check('col concave : centre à Rg + Rw = 50 m des lobes', near(G.dist(W.P, S.C1), 50) && near(G.dist(W.P, S.C2), 50));
  check('décalage parallèle au col (rive intérieure : Rw + la = 37 m)', near(P7.r, 37) && near(G.dist(P7.c, W.P), 0));
  const a = projectOnPath(P, { x: 40, y: 0 }), b = projectOnPath(P, { x: -40, y: 0 });
  check('symétrie : demi-contours égaux', near(G.pathLen(subPath(P, a.s, b.s)), G.pathLen(subPath(P, b.s, a.s)), 0.05));
  check('décalage signé : centre d\'un lobe à −Rg', near(signedOffset(S, S.C1).off, -20, 0.05));
  check('îlot au col (t = −7) : 2 (√(50² − 22²) − 37) = 15,80 m', near(waistWidth(S, -7), 2 * (Math.sqrt(50 * 50 - 22 * 22) - 37), 0.05), `${waistWidth(S, -7)}`);
  const Ob = peanutShape(O, X, peanutParams({ e: 44, Rwg: 0, Rwd: 0 }, 20));
  check('giratoire oblong (cols rectilignes) : largeur 2 Rg au col', Ob.ok && Ob.waists.every((w) => w.kind === 'L') && near(waistWidth(Ob, 0), 40, 0.05));
  check('entraxe trop faible : refus', !peanutShape(O, X, peanutParams({ e: 0.2, Rg2: 20 }, 20)).ok);
}

// --- Construction du carrefour -------------------------------------------------------------------------------------
const br = (id, name, pts) => ({ id, name, axis: pts.map(([x, y]) => ({ x, y })), radial: true, nIn: 1, nOut: 1, island: { type: 'physique', base: '', length: '', gap: '', shift: '' }, tpc: { on: false, width: 2 }, length: '', pente: '', transition: '', wLane: 3.5, camber: 2.5, le: 4, ls: 4.5, Re: 15, Rs: 20 });
const N = br('c', 'N', [[-22 - 160 * 0.1736, 160 * 0.9848], [-22 - 40 * 0.1736, 40 * 0.9848]]);
function prj(ring = {}, extra = []) {
  return {
    app: 'GIRA', name: 't', context: 'interurbain', kind: 'giratoire', center: { auto: false, x: 0, y: 0 },
    ring: { Rg: 20, la: 7, bf: 0, zC: 100, devers: 1.5, pente: 0, gisPente: 0, mode: 'aci', shape: 'cacahuete', e: 44, Rwg: 20, Rwd: 30, ...ring },
    plan: {}, section: {}, signs: {}, tn: { pts: [] }, pt: {}, hwy: { on: false, axis: [] }, ramps: [], crosses: [], traffic: { od: {}, pl: {}, qp: {}, tad: {} },
    branches: [br('a', 'O', [[-200, 0], [-60, 0]]), br('b', 'E', [[200, 0], [60, 0]]), N, ...extra],
    opts: { angleUnit: 'gon', textH: 0.8, vis: {} }, others: [],
  };
}
const errs = (D) => D.issues.filter((i) => i.lvl === 'err');
{
  const P = prj(), D = buildDesign(P);
  check('3 branches construites, rattachées aux lobes (O, N : lobe 1 ; E : lobe 2)', D.ok && D.branches.length === 3 && D.branches.find((b) => b.name === 'E').lobe === 2 && D.branches.find((b) => b.name === 'O').lobe === 1 && D.branches.find((b) => b.name === 'N').lobe === 1);
  check('aucune erreur géométrique', errs(D).length === 0, errs(D).map((i) => i.msg).join(' | '));
  check('gisement automatique = axe de la route principale (100 gon)', near(D.peanut.gis, 100, 1e-6) && D.peanut.gisAuto);
  const zIsl = D.zRing(D.shape.C1), zOut = D.zRing({ x: 0, y: 60 });
  check('dévers : îlot relevé de d·la au-dessus de la rive', near(zIsl - zOut, 0.015 * 7, 1e-6), `${zIsl} ${zOut}`);
  check('chaussée annulaire dessinée (contours de la cacahuète)', D.prims.some((p) => p.k === 'path' && p.closed && p.L === 'BORDURE'));
  check('cédez-le-passage centré sur le lobe de la branche', D.prims.filter((p) => p.lt === 'CLP').every((p) => near(G.dist(p.segs[0].c, D.shape.C1), 0) || near(G.dist(p.segs[0].c, D.shape.C2), 0)));
  check('déflexion : trajectoires en S au droit des cols', D.branches.every((b) => !b.defl || b.defl.sCurve));
  const C = checkDesign(P, D);
  check('contrôles : fiche RACA citée, forme non circulaire signalée hors agglomération', C.some((c) => /RACA 2010/.test(c.msg)) && C.some((c) => c.lvl === 'warn' && /forme circulaire/.test(c.msg)));
  check('points : centres des lobes et des cols', D.points.filter((p) => /Lobe \d : centre|Col .* : centre/.test(p.name)).length === 4);
}
{
  const S = br('d', 'S', [[22 + 160 * 0.4226, -160 * 0.9063], [22 + 50 * 0.4226, -50 * 0.9063]]);
  const D = buildDesign(prj({ Rwd: 0 }, [S]));
  check('branche raccordée dans un col : erreur', errs(D).some((i) => /S : raccordée au lobe 2 en partie dans un col/.test(i.msg)));
  const D2 = buildDesign(prj({ e: 50, Rwg: 10, Rwd: 10, la: 9 }));
  check('cols croisés (îlot coupé) : erreur', errs(D2).some((i) => /îlot central est coupé en deux/.test(i.msg)), `îlot ${D2.peanut?.waistIsl}`);
  const D3 = buildDesign(prj({ Rwg: 3 }));
  check('col plus serré que BDD + abords : erreur', errs(D3).some((i) => /Col gauche : rayon 3,00 m/.test(i.msg)), errs(D3).map((i) => i.msg).join(' | '));
}
{
  const P = prj({ shape: 'cercle' }), D = buildDesign(P);
  check('anneau circulaire inchangé (pas de forme, déflexion < 100 m)', !D.shape && D.branches.every((b) => b.defl && b.defl.R < 100 && !b.defl.sCurve));
}

console.log(`\n${n - fails}/${n} contrôles réussis`);
if (fails) process.exit(1);
