// signs.js — signalisation verticale des carrefours (panneaux de police, de direction, balises J5).
// Règles d'implantation :
//  • interurbain : SETRA « L'équipement des routes interurbaines » (1998), vol. 2 ch. 2.11 « Carrefours plans » et
//    « Carrefours giratoires » (routes de type R), vol. 1 ch. 2 § 2.7 (hauteurs, recul) et ch. 7 (balises J5) ;
//    SETRA ACI/P ch. 2 § 4.1 (carrefours plans) et ch. 3 § 4.1 (giratoires) ;
//  • urbain : CERTU « Carrefours urbains » (2010) § 7.5 (régimes de priorité), § 8.5 (feux), § 9.6 (giratoires) ;
//    IISR Livre I, 1re partie (hauteur sous panneau jusqu'à 2,30 m en agglomération, gammes).
// Chaque panneau est placé sur l'axe de sa branche (abscisse depuis la ligne de cédez-le-passage / le bord de la
// principale), à droite du sens de circulation qu'il concerne, le bord du panneau à « recul » du bord de chaussée
// (ou du caniveau en urbain) ; les balises J5 et les panneaux d'îlot sont posés sur l'axe de l'îlot séparateur.
// Les mâts sont ajoutés aux points d'implantation ; les panneaux sont dessinés sur le calque GIRA_SIGNALISATION
// (mât, face du panneau vue de dessus, code).
import * as G from './geom.js';
import { isPlan, sectionParams, planParams, signParams } from './norms.js';
import { fmt } from './common.js';
import { cutAtX } from './crossing.js';

const { add, sub, mul, norm, rot90, neg, ang, dot, L } = G;

// Dimensions principales (m) par gamme — NF P 98-531 : triangle (A, AB1, AB2, AB3, AB25), disque (B), octogone (AB4),
// carré sur pointe (AB6), balise J5. Les valeurs AB4 / AB6 / J5 sont usuelles (≈), à confirmer sur la norme.
export const GAMMES = {
  miniature: { label: 'Miniature (urbain)', tri: 0.5, disc: 0.45, stop: 0.4, sq: 0.35, j5: 0.3 },
  petite: { label: 'Petite', tri: 0.7, disc: 0.65, stop: 0.5, sq: 0.5, j5: 0.4 },
  normale: { label: 'Normale', tri: 1.0, disc: 0.85, stop: 0.7, sq: 0.7, j5: 0.5 },
  grande: { label: 'Grande', tri: 1.25, disc: 1.05, stop: 0.9, sq: 0.9, j5: 0.7 },
  tgrande: { label: 'Très grande', tri: 1.5, disc: 1.25, stop: 1.2, sq: 1.05, j5: 0.9 },
};

// Catalogue : forme (pour la largeur selon la gamme), libellé. dir : panneau directionnel, largeur fixée (indicative).
export const CATALOG = {
  AB25: { label: 'Carrefour à sens giratoire (A25)', shape: 'tri' },
  AB3a: { label: 'Cédez-le-passage + M9c (position)', shape: 'tri' },
  AB3b: { label: 'Cédez-le-passage (signal avancé) + M1', shape: 'tri' },
  AB4: { label: 'STOP (position)', shape: 'stop' },
  AB5: { label: 'STOP (signal avancé) + M1', shape: 'tri' },
  AB2: { label: 'Priorité ponctuelle', shape: 'tri' },
  AB6: { label: 'Route prioritaire', shape: 'sq' },
  'B21-1': { label: 'Direction obligatoire (anneau)', shape: 'disc' },
  B21a1: { label: 'Contournement obligatoire par la droite', shape: 'disc' },
  J5: { label: 'Balise de tête d\'îlot', shape: 'j5' },
  D42b: { label: 'Présignalisation diagrammatique', shape: 'dir', w: 2.0 },
  D21: { label: 'Direction de position (sorties)', shape: 'dir', w: 1.5 },
  D40: { label: 'Présignalisation de direction', shape: 'dir', w: 2.0 },
  D20: { label: 'Direction de position', shape: 'dir', w: 1.5 },
  D60: { label: 'Confirmation de direction', shape: 'dir', w: 2.0 },
  D31: { label: 'Direction de position (voie directe)', shape: 'dir', w: 1.2 },
};

const widthOf = (code, gamme) => {
  const c = CATALOG[code], g = GAMMES[gamme] || GAMMES.normale;
  return c.shape === 'dir' ? c.w : g[c.shape];
};

// Point et tangente (vers l'extérieur) de l'axe d'une branche à l'abscisse locale x (x0 : ligne de cédez-le-passage ou
// bord de la principale) : alignement droit jusqu'à xEnd, puis axe suivi (cont), puis prolongement droit (beyond).
function along(bd, x) {
  const a = bd.a || 0;
  if (x <= bd.xEnd + 1e-9 || !bd.cont) return { p: bd.W({ x, y: a }), t: bd.u, beyond: x > bd.xEnd + 1e-9 };
  const d = x - bd.xEnd, len = G.pathLen(bd.cont);
  if (d <= len) {
    const p = G.pathPointAt(bd.cont, d), q = G.pathPointAt(bd.cont, Math.min(len, d + 0.5));
    return { p, t: d + 0.5 <= len ? norm(sub(q, p)) : bd.farDir, beyond: false };
  }
  return { p: add(bd.farAxis, mul(bd.farDir, d - len)), t: bd.farDir, beyond: true };
}

// Distance de l'axe au bord de chaussée (côté entrée s = +1, côté sortie s = −1) à l'abscisse x.
function edgeAt(bd, s, x, bdd) {
  const sd = s > 0 ? bd.entry : bd.exit, path = sd?.edge || sd?.curb;
  if (path && x <= bd.xEnd + 1e-9) {
    const c = cutAtX(path, x);
    if (c) return Math.abs(c.y) + (sd.edge ? 0 : bdd);
  }
  return (bd.th || 0) + (sd?.w ?? 3.5) + bdd;
}

// Largeur de l'îlot séparateur (triangle de construction) à l'abscisse x.
const islandWidthAt = (bd, x) => (bd.h > 0 ? Math.max(0, bd.b * (1 - (x - bd.x0) / bd.h)) : 0);

function pointInTri(p, a, b, c) {
  const s1 = G.cross(sub(b, a), sub(p, a)), s2 = G.cross(sub(c, b), sub(p, b)), s3 = G.cross(sub(a, c), sub(p, c));
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

// Calcule et ajoute la signalisation au projet dérivé D (prims, points, D.signs, D.signIssues).
export function addSigns(prj, D) {
  D.signs = []; D.signIssues = [];
  if (!D?.ok || !D.branches?.length) return;
  const SP = signParams(prj);
  if (!SP.on) return;
  const sec = sectionParams(prj), urb = prj.context === 'urbain', plan = isPlan(prj);
  const TH = +prj.opts?.textH || 0.8;
  const issues = D.signIssues, list = D.signs;
  const say = (lvl, msg) => issues.push({ lvl, msg });
  // Au-delà du bord de chaussée : BDD en interurbain (zone de récupération), caniveau + bordure en urbain.
  const bdd = sec.bdd || 0, kerb = urb ? (sec.caniveau || 0) + (sec.bordure || 0) : 0;
  const offRoad = (w) => kerb + SP.recul + w / 2;
  const hauteur = SP.hauteur;

  const sign = (o) => {
    const w = o.w ?? widthOf(o.code, o.gamme || SP.gamme);
    const s = { gamme: SP.gamme, h: hauteur, ...o, w, n: list.length + 1 };
    list.push(s);
    return s;
  };

  // --- Panneau à droite d'un sens de circulation sur une branche : x abscisse locale, s côté (+1 entrée, −1 sortie).
  const roadside = (bd, code, x, s, extra = {}) => {
    const w = widthOf(code, extra.gamme || SP.gamme);
    const { p, t, beyond } = along(bd, x);
    const nL = rot90(t), y = edgeAt(bd, s, x, bdd) + offRoad(w);
    const sg = sign({ code, branch: bd.name, bi: bd.idx, p: add(p, mul(nL, s * y)), face: s > 0 ? t : neg(t), out: mul(nL, s), x: x - bd.x0, where: s > 0 ? 'à droite, en approche' : 'à droite, en sortie', ...extra });
    if (beyond) { sg.note = (sg.note ? sg.note + ' ; ' : '') + 'au-delà de l\'axe dessiné (prolongement droit)'; say('info', `${bd.name} : ${code} à ${fmt(x, 0)} m, au-delà de l'axe dessiné — prolongez l'axe pour l'implanter.`); }
    return sg;
  };
  // --- Panneau sur l'îlot séparateur : point P (monde), face.
  const onIsland = (bd, code, p, face, extra = {}) => sign({ code, branch: bd.name, bi: bd.idx, p, face, out: rot90(face), where: 'îlot séparateur', ...extra });

  // Trottoir : cheminement libre de 1,40 m derrière le panneau (accessibilité).
  if (urb && sec.trottoir > 0) {
    const wMax = Math.max(...Object.values(GAMMES[SP.gamme] || GAMMES.normale).filter((v) => typeof v === 'number'));
    const emprise = hauteur >= 2.2 ? 0.15 : wMax; // panneau au-dessus du cheminement : seul le mât fait obstacle
    if (sec.trottoir - SP.recul - emprise < 1.4) say('warn', `Trottoir de ${fmt(sec.trottoir)} m : après le panneau (recul ${fmt(SP.recul)} m + ${fmt(emprise)} m), il reste moins de 1,40 m de cheminement libre — gamme réduite, hauteur ≥ 2,20 m ou panneau sur potence.`);
  }

  if (!plan) {
    // ================================================================ Giratoire
    const O = D.O;
    if (urb ? !(SP.dA25 >= 10 && SP.dA25 <= 50) : !(SP.dA25 >= 100 && SP.dA25 <= 150)) {
      say('warn', urb ? `AB25 à ${fmt(SP.dA25, 0)} m : CERTU, 10 à 50 m avant le carrefour.` : `AB25 à ${fmt(SP.dA25, 0)} m : guide SETRA, 100 à 150 m (ACI/P : ≈ 150 m).`);
    }
    if (SP.d42 && SP.dD42 < 50) say('warn', `D42b à ${fmt(SP.dD42, 0)} m de l'AB25 : 50 m minimum pour ne pas gêner sa perception.`);
    for (const bd of D.branches) {
      const br = prj.branches[bd.idx] || {}, nIn = Math.max(1, +br.nIn || 1);
      const gap = bd.isl?.gap ?? 0.5;
      // AB25 (A25) obligatoire sur chaque branche, D42b en amont.
      roadside(bd, 'AB25', bd.x0 + SP.dA25, 1, { note: urb ? 'obligatoire ; 10 à 50 m (CERTU)' : 'obligatoire ; 100 à 150 m (SETRA), sans panonceau M9' });
      if (SP.d42) roadside(bd, 'D42b', bd.x0 + SP.dA25 + SP.dD42, 1, { note: urb ? 'optionnel, axes structurants' : 'recommandé ; ≥ 50 m avant l\'AB25 (100 m si dédoublé)' });
      // AB3a + M9c au plus près de la ligne de cédez-le-passage, répété à gauche sur l'îlot si 2 voies d'entrée.
      roadside(bd, 'AB3a', bd.x0 + 1.0, 1, { note: 'au plus près de la ligne T\'2 (ligne obligatoire avec le panneau)' });
      const dbl = SP.doubleAB3a === 'oui' || (SP.doubleAB3a === 'auto' && nIn >= 2);
      if (dbl) {
        const xI = bd.x0 + gap + 1.5;
        if (bd.island?.outline && bd.island.closed && islandWidthAt(bd, xI) >= 1.0) {
          onIsland(bd, 'AB3a', bd.W({ x: xI, y: bd.ai ?? 0 }), bd.u, { note: nIn >= 2 ? 'répété à gauche : entrée à 2 voies' : 'répété à gauche (choix)' });
        } else say('warn', `${bd.name} : AB3a à répéter à gauche (entrée à ${nIn} voies) mais l'îlot séparateur n'est pas en saillie ou est trop étroit.`);
      }
      // B21-1 sur l'îlot central, face à l'entrée, axé sur la direction de la voie d'entrée (sauf mini-giratoire).
      if (!D.mini) {
        const yLane = (bd.hb || 0) + (bd.entry?.w ?? 3.5) / 2;
        const E0 = bd.W({ x: bd.x0, y: yLane }), E1 = bd.W({ x: bd.x0 + 8, y: yLane }), d = norm(sub(E0, E1));
        const R = Math.max(1.5, (D.Rb > 2 ? D.Rb : D.Rpi) - 0.8);
        const ts = G.lineCircle(E0, d, O, R).filter((t) => t > 0);
        let P;
        if (ts.length) P = add(E0, mul(d, ts[0]));
        else { const t = Math.max(0, dot(sub(O, E0), d)); const q = add(E0, mul(d, t)); P = G.polar(O, R, ang(sub(q, O))); }
        const dist = G.dist(P, E0);
        const sg = sign({ code: 'B21-1', branch: bd.name, bi: bd.idx, p: P, face: neg(d), out: norm(sub(P, O)), where: 'îlot central, face à l\'entrée', x: -dist, note: `à ${fmt(dist, 0)} m de la ligne de cédez-le-passage (ACI/P : ≈ ${fmt(SP.dB21, 0)} m) ; seul signal admis sur l'îlot central` });
        if (dist < 8) say('info', `${bd.name} : B21-1 à ${fmt(dist, 0)} m seulement de la ligne de cédez-le-passage — vérifier sa perception (ACI/P : ≈ ${fmt(SP.dB21, 0)} m).`);
        void sg;
      }
      // J5 en nez (amont) de l'îlot séparateur en saillie ; D21 sur l'îlot, face aux usagers de l'anneau.
      const I = bd.island;
      if (I?.outline && I.closed && I.tip) {
        if (!urb && bd.b < 1.9) say('warn', `${bd.name} : îlot de ${fmt(bd.b)} m de base, trop étroit pour une balise J5 de 500 (≥ 1,90 m, ACI) : prévoir une J5 de petite gamme.`);
        onIsland(bd, 'J5', sub(I.tip, mul(bd.u, 0.4)), bd.u, { gamme: !urb && bd.b < 1.9 ? 'petite' : SP.gamme, note: urb ? 'tête d\'îlot (ou B21a1 si pas de ligne axiale continue)' : 'au centre de la tête d\'îlot (circulaire 74-152)' });
        if (SP.d21) {
          const xD = bd.x0 + gap + (dbl ? 5 : 2.5);
          if (bd.h >= 8 && islandWidthAt(bd, xD) >= 0.8) onIsland(bd, 'D21', bd.W({ x: xD, y: bd.ai ?? 0 }), neg(bd.n), { note: 'mentions de sortie seulement ; jamais sur l\'îlot central' });
          else say('info', `${bd.name} : îlot trop court ou trop étroit pour un D21 de sortie.`);
        }
      } else if (I) say('info', `${bd.name} : îlot séparateur peint ou TPC — pas de balise J5 (uniquement en saillie).`);
      // AB6 après le giratoire si la route est classée à grande circulation.
      if (SP.gc) roadside(bd, 'AB6', bd.x0 + SP.dAB6, -1, { note: 'route classée à grande circulation' });
    }
    // Voies directes de tourne-à-droite : D31 en position sur l'îlot de séparation.
    for (const r of D.bypasses || []) {
      if (!r.noseK) continue;
      const bd = D.branches.find((q) => q.name === r.from);
      if (bd) sign({ code: 'D31', branch: bd.name, bi: bd.idx, p: add(r.noseK, mul(bd.u, 1.5)), face: bd.u, out: bd.n, where: 'îlot de la voie directe', note: 'voie directe de tourne-à-droite (étude particulière)' });
    }
    if (urb && SP.d42) say('info', 'D42b : optionnel en ville, à réserver aux axes structurants, aux grands giratoires ou à plus de 4 branches (CERTU).');
    if (!urb) say('info', 'Giratoire : inutile de surcharger les approches (limitations de vitesse, interdictions de dépasser) ; balises J4 / J6 à proscrire dans le carrefour (SETRA).');
  } else {
    // ================================================================ Carrefours plans (T, X)
    const P = planParams(prj), M = D.main;
    if (!M) return;
    const regime = urb && SP.regimeUrb !== 'auto' ? SP.regimeUrb : P.regime;
    const stop = regime === 'stop';
    for (const bd of D.branches) {
      if (bd.role !== 'secondaire') continue;
      if (regime === 'droite') { say('info', `${bd.name} : priorité à droite — aucun panneau (AB1 exceptionnel en agglomération, CERTU § 7.5).`); continue; }
      if (regime === 'feux') { say('info', `${bd.name} : carrefour à feux — signaux R11 non dessinés ; A17 seulement si les feux peuvent surprendre (CERTU § 8.5).`); }
      else {
        roadside(bd, stop ? 'AB4' : 'AB3a', bd.x0 + 1.0, 1, { note: 'au plus près de la ligne transversale, jamais répété à gauche (ACI/P)' });
        if (SP.dAv !== '' && SP.dAv > 0) roadside(bd, stop ? 'AB5' : 'AB3b', bd.x0 + SP.dAv, 1, { gamme: SP.gammeAv, note: `signal avancé + panonceau M1 « ${fmt(SP.dAv, 0)} m » (gamme ${GAMMES[SP.gammeAv]?.label?.toLowerCase() || SP.gammeAv})` });
      }
      const I = bd.island;
      // Îlot ACI en saillie : nez amont = milieu de l'arc de queue (rayon rn) de son contour ; sinon pointe de l'enveloppe.
      const tipUp = I?.outline?.[2]?.t === 'A' ? G.segAt(I.outline[2], 0.5) : I?.tip;
      if (I?.outline && tipUp) {
        if (!urb && bd.b < 1.9) say('warn', `${bd.name} : îlot de ${fmt(bd.b)} m, trop étroit pour une balise J5 de 500 (≥ 1,90 m, ACI).`);
        if (!urb) onIsland(bd, 'J5', sub(tipUp, mul(bd.u, 0.4)), bd.u, { gamme: bd.b < 1.9 ? 'petite' : SP.gamme, note: 'tête d\'îlot ; ≤ 1 m de haut sur la principale pour ne pas gêner les tourne-à-gauche' });
        onIsland(bd, 'B21a1', sub(tipUp, mul(bd.u, urb ? 0.5 : 1.4)), bd.u, { note: urb ? 'tête d\'îlot (J5 à la place si ligne axiale continue)' : 'seul signal admis sur l\'îlot en saillie (ACI/P)' });
      } else say('info', `${bd.name} : îlot peint ou absent — pas de J5 ni de B21a1 (îlot en saillie seulement) ; balise J3 possible sur la principale.`);
    }
    // Route principale : AB2 (ou AB6 si classée à grande circulation) hors des triangles de visibilité, D40 / D20 / D60.
    const half = D.plan.half, hw = D.plan.hw, lenA = D.plan.lenA || 0, lenB = D.plan.lenB || 0;
    const edgeMain = (X) => (D.plan.widened && X >= -lenA && X <= lenB ? hw : half) + bdd;
    const dAB2 = SP.dAB2 !== '' ? SP.dAB2 : stop ? 50 : urb ? 100 : 200;
    const secs = D.branches.filter((q) => q.role === 'secondaire');
    const vis = secs.map((q) => q.vis).filter(Boolean);
    const inVis = (p) => vis.some((v) => (v.pN && v.pF) ? pointInTri(p, v.obs, v.pN, v.tNear) || pointInTri(p, v.obs, v.pF, v.tFar) : pointInTri(p, v.obs, v.tNear, v.tFar));
    for (const sgn of [-1, 1]) {
      const bd = D.branches.find((q) => q.role === 'principale' && q.idx === (sgn < 0 ? M.a : M.b));
      if (!bd) continue;
      const dirM = mul(M.u, -sgn); // sens de circulation de ce conducteur (A → B pour sgn = −1)
      const face = mul(M.u, sgn), out = mul(M.Y, sgn);
      const put = (code, Xd, extra = {}) => { // Xd : abscisse le long du sens de circulation, 0 = centre du carrefour, < 0 en amont
        const w = widthOf(code, extra.gamme || SP.gamme), X = -sgn * Xd, Y = sgn * (edgeMain(X) + offRoad(w));
        const p = M.toW(X, Y);
        const sg = sign({ code, branch: bd.name, bi: bd.idx, p, face, out, x: Xd, where: Xd < 0 ? 'à droite, en approche' : 'à droite, après le carrefour', ...extra });
        if (Math.abs(X) > bd.xEnd + 1e-6) { sg.note = (sg.note ? sg.note + ' ; ' : '') + 'au-delà de l\'axe dessiné'; }
        if (inVis(p)) say(code === 'D20' ? 'info' : 'warn', code === 'D20'
          ? `${bd.name} : D20 au coin du carrefour, dans le triangle de visibilité de la secondaire — mât fin, panneau bas (≤ 1 m) ou reculé.`
          : `${bd.name} : ${code} à ${fmt(Math.abs(Xd), 0)} m dans un triangle de visibilité — l'implanter au-delà de D = ${fmt(Math.max(...vis.map((v) => v.D)), 0)} m de l'axe de la secondaire (ACI/P : hors des triangles, ≈ 200 m au cédez-le-passage, ≥ 50 m au STOP).`);
        return sg;
      };
      if (regime === 'droite' || regime === 'feux') continue;
      if (SP.main) {
        if (SP.gc) put('AB6', SP.dAB6, { note: 'route classée à grande circulation : après le carrefour' });
        else {
          put('AB2', -dAB2, { note: `priorité ponctuelle, obligatoire si la route n'est pas classée à grande circulation ; hors des triangles de visibilité (≈ ${stop ? '50' : '200'} m)` });
          if (!urb && dAB2 < (stop ? 50 : 150)) say('warn', `AB2 à ${fmt(dAB2, 0)} m : ACI/P, ≈ 200 m au cédez-le-passage, ≥ 50 m au STOP.`);
        }
      }
      if (SP.dir) {
        put('D40', -SP.dD40, { note: 'présignalisation (distances indicatives pour V85 de 75 à 90 km/h, circulaire 82-31)' });
        // D20 au coin aval du débouché situé à droite du conducteur (sinon au droit du centre).
        const right = secs.find((q) => q.sY === sgn);
        let Xd = 2;
        if (right) { const xs = [M.toM(right.entry.Tc).x, M.toM(right.exit.Tc).x]; Xd = -sgn * (sgn < 0 ? Math.max(...xs) : Math.min(...xs)) + 2; }
        put('D20', Xd, { note: 'signalisation de position' });
        put('D60', SP.dD60, { note: 'confirmation, à 300 m de l\'axe de la secondaire (guide type R)' });
      }
    }
    if (urb && !SP.main) say('info', 'Urbain : pas de présignalisation systématique du régime de priorité (CERTU § 7.5.1) ; cochez « Signalisation de la route principale » pour l\'ajouter.');
  }

  // ================================================================ Primitives et points d'implantation
  for (const sg of list) {
    const w = sg.w, pf = rot90(sg.face);
    D.prims.push({ k: 'circle', L: 'SIGNALISATION', c: sg.p, r: 0.12 });
    D.prims.push({ k: 'path', L: 'SIGNALISATION', segs: [L(add(sg.p, mul(pf, -w / 2)), add(sg.p, mul(pf, w / 2)))], wm: 0.1 });
    // Pictogramme (vue de face schématique) posé à côté du mât, du côté opposé à la chaussée, puis le code.
    D.prims.push({ k: 'sign', L: 'SIGNALISATION', p: sg.p, out: sg.out, face: sg.face, code: sg.code, w, h: TH * 0.7 });
    D.points.push({ n: D.points.length + 1, name: `${sg.branch} · mât ${sg.code}`, p: sg.p, bi: sg.bi, kind: 'signal' });
  }
}
