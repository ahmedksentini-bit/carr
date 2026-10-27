// norms.js — valeurs par défaut et contrôles d'après :
//  • SETRA, « Aménagement des carrefours interurbains sur les routes principales » (ACI, 1998), chap. carrefours giratoires ;
//  • CERTU, « Guide des carrefours urbains » (1999) et fiche CERTU n°24 « Giratoires urbains » ; CERTU « Les mini-giratoires » (1997).
// Les valeurs marquées (≈) proviennent de sources secondaires (IDRRIM 2015, cours) et sont à confirmer sur le guide.

// Dévers de l'anneau vers l'extérieur : valeur imposée (règle de conception retenue pour GIRA).
export const RING_DEVERS = 1.5;

export const PRESETS = {
  interurbain: {
    label: 'Interurbain — SETRA ACI',
    ring: { Rg: 20, la: 7, bf: 0, devers: RING_DEVERS },
    branch: { le: 4, ls: 4.5, Re: 15, Rs: 20, wLane: 3.5, camber: 2.5, tpcWidth: 3 },
    island: { gap: 0.5 },
  },
  urbain: {
    label: 'Urbain — CERTU',
    ring: { Rg: 15, la: 7, bf: 1.5, devers: RING_DEVERS },
    branch: { le: 3.5, ls: 4, Re: 12, Rs: 15, wLane: 3.25, camber: 2.5, tpcWidth: 2 },
    island: { gap: 0.5 },
  },
};

// Valeurs courantes du tableau ACI selon Rg (interurbain).
export const ACI_TABLE = [
  { Rg: 12, la: 7, bf: 1.5, Re: 12, Rs: 15, le: 4, ls: 4 },
  { Rg: 15, la: 7, bf: 1.5, Re: 15, Rs: 20, le: 4, ls: 4 },
  { Rg: 20, la: 7, bf: 0, Re: 15, Rs: 20, le: 4, ls: 4.5 },
  { Rg: 25, la: 8, bf: 0, Re: 15, Rs: 20, le: 4, ls: 5 },
];
export function aciRow(Rg) {
  let best = ACI_TABLE[0];
  for (const r of ACI_TABLE) if (Math.abs(r.Rg - Rg) < Math.abs(best.Rg - Rg)) best = r;
  return best;
}

const num = (v, d) => (v === '' || v == null || !isFinite(+v) ? d : +v);

export const isPlan = (prj) => prj.kind === 'T' || prj.kind === 'X';

// Profil en travers. Les rayons Rg / Ri et les largeurs le / ls / la sont mesurés aux rives peintes ;
// les bords de chaussée sont à la BDG (côté gauche du sens de circulation) ou à la BDD (côté droit) de ces rives ;
// la BDD est commune à l'anneau et aux branches pour que les bords se raccordent aux points de tangence.
// Au-delà du bord de chaussée : caniveau, bordure, trottoir et contre-bordure en urbain, berme en interurbain.
// Vues (hauteurs) des bordures : 3 cm côté anneau pour la bande franchissable, 6 cm pour l'îlot central.
// Passages piétons (urbain) : largeur ppW, recul ppRecul de la ligne de cédez-le-passage ; aménagements PMR.
export const SECTION = {
  interurbain: {
    rive: true, bdd: 1, bdgRing: 0.5, bdgBr: 0.5,
    caniveau: 0, bordure: 0, trottoir: 0, cBordure: 0, bordureVue: 0.14, trottoirPente: 2,
    berme: 1.5, bermePente: 8, bfPente: 4, bfVue: 0.03, ilotVue: 0.06, axeR: 80,
    pp: false, pmr: false, ppW: 2.5, ppRecul: 5, visOn: true, visObs: 15,
  },
  urbain: {
    rive: false, bdd: 0, bdgRing: 0, bdgBr: 0,
    caniveau: 0.25, bordure: 0.15, trottoir: 2.5, cBordure: 0.1, bordureVue: 0.14, trottoirPente: 2,
    berme: 0, bermePente: 8, bfPente: 4, bfVue: 0.03, ilotVue: 0.06, axeR: 40,
    pp: true, pmr: true, ppW: 2.5, ppRecul: 5, visOn: true, visObs: 15,
  },
};
export function sectionParams(prj) {
  const d = SECTION[prj.context], s = prj.section || {}, out = {};
  for (const k in d) out[k] = typeof d[k] === 'boolean' ? s[k] ?? d[k] : num(s[k], d[k]);
  return out;
}

// Largeurs des abords au-delà du bord de chaussée : [libellé, largeur] (urbain : caniveau, bordure, trottoir,
// contre-bordure ; interurbain : berme).
export function sideBands(prj, sec = sectionParams(prj)) {
  const list = prj.context === 'urbain'
    ? [['caniveau', sec.caniveau], ['bordure', sec.bordure], ['trottoir', sec.trottoir], ['contre-bordure', sec.cBordure]]
    : [['berme', sec.berme]];
  return list.filter(([, w]) => w > 0);
}

// Voie directe de tourne-à-droite : rayon en axe de la chaussée et largeur de chaussée (hors bandes dérasées).
export const TAD = { interurbain: { R: 42, w: 4 }, urbain: { R: 20, w: 3.5 } };

// Carrefours plans (T, X) d'après l'ACI (chap. « Carrefours plans ») et le CERTU (« Carrefours urbains »).
// l : largeur de la chaussée de la branche secondaire (somme de ses voies).
export const PLAN = {
  interurbain: {
    main: {
      wLane: 3.5, nLanes: 1, camber: 2.5, pente: '', regime: 'cedez', v85: 90, tVis: '', dObs: '',
      // TAG : voie de 2,75–3,25 m + îlot a (0,25–2 m), largeur centrale ≤ 5 m ; déport 1/15 ; sifflet 20–30 m ;
      // alignement droit ≥ 10 m ; stockage 20–50 m (40–60 m avec PL) ; présignalisation 58,5 m.
      tag: { on: true, width: 3, island: 2, raised: true, storage: 30, sifflet: 25, align: 10, deport: '', presig: 58.5 },
    },
    sec: { wLane: 3, camber: 2.5 },
    island: { base: 2, gap: 1, rHead: 1, rTip: 0.5 },
  },
  urbain: {
    main: {
      wLane: 3, nLanes: 1, camber: 2.5, pente: '', regime: 'cedez', v85: 50, tVis: '', dObs: '',
      tag: { on: false, width: 3, island: 1, raised: false, storage: 15, sifflet: 15, align: 5, deport: '', presig: 20 },
    },
    sec: { wLane: 3, camber: 2.5, R: 8 },
    island: { base: 1.5, length: 12, gap: 1, rHead: 0.75, rTip: 0.5 },
  },
};

export function defaultPlan(context) {
  const m = PLAN[context].main;
  return { main: ['', ''], ...m, tag: { ...m.tag } };
}

// Paramètres de la route principale, normalisés (valeurs vides → valeurs automatiques du guide).
export function planParams(prj) {
  const d = PLAN[prj.context].main, p = prj.plan || {}, t = p.tag || {};
  const regime = p.regime === 'stop' || p.regime === 'cedez' ? p.regime : d.regime;
  const wLane = num(p.wLane, d.wLane), nLanes = Math.max(1, Math.round(num(p.nLanes, d.nLanes)));
  const tag = {
    on: t.on ?? d.tag.on, width: num(t.width, d.tag.width), island: num(t.island, d.tag.island), raised: t.raised ?? d.tag.raised,
    storage: num(t.storage, d.tag.storage), sifflet: num(t.sifflet, d.tag.sifflet), align: num(t.align, d.tag.align), presig: num(t.presig, d.tag.presig),
  };
  const c = tag.width + tag.island;
  // Déport des bords au 1/15 (1/10 si la chaussée fait 5 m ou moins), symétrique : c/2 de chaque côté.
  tag.deport = num(t.deport, (2 * nLanes * wLane <= 5 ? 10 : 15) * (c / 2));
  // Visibilité (ACI) : STOP 8 s, cédez-le-passage 10 s, + 1 s avec TAG ; observateur à 4 m (STOP)
  // ou 15 m (cédez) en arrière de la ligne, à 2 m du bord droit de la branche.
  const tVis = num(p.tVis, (regime === 'stop' ? 8 : 10) + (tag.on ? 1 : 0));
  const dObs = num(p.dObs, regime === 'stop' ? 4 : 15);
  return {
    main: p.main || ['', ''], wLane, nLanes, camber: num(p.camber, d.camber), pente: p.pente ?? '', regime,
    v85: num(p.v85, d.v85), tVis, dObs, tag, c,
  };
}

// Valeurs automatiques d'une branche secondaire (ACI tab. 8) : le = sup(l/2 ; 3), ls = l/2 + 0,50 (≥ 3),
// Re = 2l, Rs = 4l, îlot de longueur 4l, raccordements 8l. En urbain, le guide renvoie à l'épure de giration :
// rayons usuels de 8 m.
export function secondaryAuto(prj, br) {
  const l = (Math.max(1, +br.nIn || 1) + Math.max(1, +br.nOut || 1)) * (+br.wLane || 3);
  const inter = prj.context === 'interurbain', R = PLAN.urbain.sec.R;
  return {
    l, le: Math.max(l / 2, 3), ls: Math.max(l / 2 + 0.5, 3),
    Re: inter ? 2 * l : R, Rs: inter ? 4 * l : R, h: inter ? 4 * l : PLAN.urbain.island.length, Rr: inter ? 8 * l : 5 * l,
  };
}

// Dimensions de l'îlot séparateur : triangle de construction ACI (hauteur Rg sur l'axe, base Rg/4 côté anneau),
// décalé vers la gauche de d = (0,5 + Rg/50)/2 pour Rg > 15 m en interurbain ; rayons de bordure Rg/50.
// Carrefour plan : îlot de la branche secondaire, tête arrondie (rayon de nez 1 m) en retrait de 1 m du bord principal.
export function islandDims(prj, br) {
  const i = br.island || {};
  if (isPlan(prj)) {
    const d = PLAN[prj.context].island, a = secondaryAuto(prj, br);
    return { type: i.type || 'physique', b: num(i.base, d.base), h: num(i.length, a.h), gap: num(i.gap, d.gap), rHead: d.rHead, rTip: d.rTip, shift: 0, autoShift: 0, Rr: a.Rr, bdg: sectionParams(prj).bdgBr };
  }
  const Rg = +prj.ring.Rg;
  const autoShift = prj.context === 'interurbain' && Rg > 15 ? (0.5 + Rg / 50) / 2 : 0;
  return {
    type: i.type || 'physique',
    b: num(i.base, Rg / 4),
    h: num(i.length, Rg),
    gap: num(i.gap, Math.max(PRESETS[prj.context].island.gap, sectionParams(prj).bdd)), // tête hors de la chaussée de l'anneau
    rHead: Math.max(0.3, Rg / 50),
    rTip: Math.max(0.3, Rg / 50),
    shift: br.tpc?.on ? 0 : num(i.shift, autoShift),
    autoShift,
    Rr: 4 * Rg,
    bdg: sectionParams(prj).bdgBr, // retrait de l'îlot en saillie par rapport à l'enveloppe peinte
  };
}

export const GUIDE_NOTES = {
  interurbain: [
    'Rg est le rayon du marquage de rive extérieure de l\'anneau.',
    'Rg : 15 à 25 m conseillé, ≈ 20 m sur routes importantes, 20–25 m au-delà de 4 branches ; 12–15 m réservé à la voirie secondaire à trafic PL négligeable ; < 12 m toujours déconseillé.',
    'Largeur d\'anneau : 20 % de plus que l\'entrée la plus large, 6 m minimum, 7 m normal ; 8 m si semi-remorques sur petit giratoire ; ≤ 9 m (8,5 m typique) avec entrées à 2 voies.',
    'Bande franchissable : 1,5 à 2 m pour Rg 12–15 m (pente 4–6 % vers l\'extérieur) ; partie infranchissable de rayon ≥ 3,5 m.',
    'Entrée : 4 m (1 voie), 7 m (2 voies) ; Re 10–15 m et Re ≤ Rg. Sortie : 4–5 m (1 voie), 7 m (2 voies) ; Rs 15–30 m et Rs > Ri.',
    'Îlot séparateur : triangle de construction de hauteur Rg et de base Rg/4, décalé à gauche de (0,5 + Rg/50)/2 si Rg > 15 m ; bordures r = Rg/50 ; marquage de rive à 0,50 m.',
    'Axes par le centre ; légère excentration à gauche admise, jamais à droite ; 3 à 6 branches.',
    'Dévers de l\'anneau : 1,5 % vers l\'extérieur (valeur imposée ; l\'ACI admet 1,5 à 2 %) ; pente transversale ≤ 3 % en tout point ; déclivité générale < 3 % (3–6 % défavorable, > 6 % à éviter).',
    'Déflexion : la trajectoire passant à 1,50 m de l\'îlot central et à 2 m des bordures d\'entrée et de sortie doit avoir un rayon < 100 m (≈ 30 m souhaitable).',
    'Ligne de cédez-le-passage T\'2 de 0,50 m sur la rive de l\'anneau ; passages piétons à 4 m en amont.',
  ],
  urbain: [
    'Giratoire compact : Rg > 12 m (15 m sur ligne de bus), le plus compact possible. Moyens / grands : Rg > 15 m.',
    'Mini-giratoire (guide CERTU 1997) : Rg 7,5 à 12 m, îlot central entièrement franchissable (dôme), agglomération ≤ 50 km/h.',
    'Largeur d\'anneau : ≥ 6 m (compact) ; 1,2 × l\'entrée la plus large (moyens / grands) ; ≈ 6,5–7,5 m pour entrées à 1 voie, 8–9 m dès qu\'une entrée a 2 voies.',
    'Bande franchissable de 1 à 2 m (≈ indispensable si Rg < 20 m).',
    'Entrée : 3,00–3,50 m (1 voie), 6–7 m (2 voies) ; Re 8–15 m. Sortie : ≥ 3,50 m (1 voie), 7 m (2 voies, > 1 200 véh/h) ; Rs 15–20 m.',
    'Îlot séparateur : refuge piéton si largeur > 1,50 m, 2 m souhaitable au droit du passage piéton.',
    'Au moins 3 branches ; plus de 6 exceptionnel. Déflexion : rayon < 100 m.',
    'Dévers de l\'anneau : 1,5 % vers l\'extérieur (valeur imposée).',
  ],
  plan_interurbain: [
    'Carrefour plan (té, croix) quand le trafic secondaire est faible ; giratoire si trafic secondaire important, problème de sécurité, routes de même niveau ou plus de 4 branches.',
    'Incidence de la branche secondaire à moins de 20° de la normale à la route principale (70 à 110°), sinon la réaligner.',
    'Rayons de bordure (l = largeur de la chaussée secondaire) : Rs = 4l (tourne-à-droite depuis la principale), Re = 2l (sortie de la secondaire) ; +25 % pour favoriser le tourne-à-droite.',
    'Îlot séparateur sur chaque branche secondaire : triangle de hauteur 4l, nez de rayon 1 m en retrait de 1 m du bord de la principale ; îlot en saillie à bordures basses, ≥ 1,90 m de large pour une balise J5.',
    'Voies de la branche : entrée sup(l/2 ; 3 m), sortie l/2 + 0,50 m (3 m mini).',
    'Tourne-à-gauche : souhaitable au-delà de 100 v/j tournant (té), 200 v/j (croix). Voie de 2,75 à 3,25 m, îlot en saillie, largeur centrale ≤ 5 m, déport des bords au 1/15, sifflet 20–30 m, stockage 20–50 m (40–60 m avec PL).',
    'Régime : cédez-le-passage en règle générale ; STOP seulement si la visibilité du cédez-le-passage n\'est pas assurée.',
    'Visibilité D = V85 × t : STOP 8 s (6 s mini), cédez 10 s (8 s), +1 s avec TAG ; œil à 1 m, à 2 m du bord droit, 4 m (STOP) ou 15–20 m (cédez) en arrière de la ligne ; cible à 1 m sur l\'axe de la voie prioritaire.',
    'Profil de la branche secondaire : pente ≤ 2 % sur les 10 à 20 derniers mètres (5 à 6 m en relief difficile).',
  ],
  plan_urbain: [
    'Régime : priorité à droite jusqu\'à ≈ 900 uvp/h, cédez-le-passage jusqu\'à ≈ 1 200 uvp/h ; STOP seulement en cas de réel problème de visibilité.',
    'Voies de 3 m (2,50 m en zone 30 sans bus ni PL) ; voie de tourne-à-gauche de 3 m avec bus ou PL, sinon 2,75 m.',
    'Rayons de bordure : le guide renvoie à l\'épure de giration (valeur par défaut 8 m, à vérifier).',
    'Visibilité : dégager entre 0,60 et 2,30 m de hauteur ; pas de stationnement 5 à 10 m avant le carrefour.',
  ],
};

const rng = (v, a, b) => v >= a - 1e-9 && v <= b + 1e-9;
const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '—');

// Aide affichée sous un champ : { txt, lvl } ; lvl ∈ ok | warn | err | ''
export function hintFor(key, prj, br) {
  if (isPlan(prj)) { const h = planHint(key, prj, br); if (h !== undefined) return h; }
  const C = prj.context, Rg = +prj.ring.Rg, la = +prj.ring.la;
  const v = br ? +getPath(br, key) : +getPath(prj, key);
  const two = (n) => (+br?.[n] || 1) >= 2;
  const H = (txt, lvl = '') => ({ txt, lvl });
  switch (key) {
    case 'ring.Rg':
      if (C === 'interurbain') {
        if (v < 12) return H('ACI : Rg < 12 m toujours déconseillé', 'err');
        if (v < 15) return H('ACI : 12–15 m seulement en voirie secondaire à trafic PL négligeable', 'warn');
        if (v > 25) return H('ACI : 15–25 m conseillé (guère plus de 25 m)', 'warn');
        return H('ACI : 15–25 m conseillé, ≈ 20 m sur routes importantes', 'ok');
      }
      if (v < 7.5) return H('CERTU : en dessous du mini-giratoire (7,5 m)', 'err');
      if (v < 12) return H('Mini-giratoire (CERTU 1997) : îlot central franchissable, ≤ 50 km/h', 'warn');
      return H(v < 15 ? 'CERTU : giratoire compact (12–15 m)' : 'CERTU : giratoire moyen / grand (> 15 m)', 'ok');
    case 'ring.la': {
      const leMax = Math.max(0, ...prj.branches.map((b) => +b.le || 0));
      const any2 = prj.branches.some((b) => (+b.nIn || 1) >= 2);
      const need = 1.2 * leMax;
      if (v < 6) return H('Minimum 6 m', 'err');
      if (leMax && v < need - 1e-6) return H(`1,2 × entrée la plus large = ${f(need)} m`, 'warn');
      if (v > 9) return H('≤ 9 m (2 voies : 8,5 m typique)', 'warn');
      if (any2 && v < 8) return H('Entrée à 2 voies : 8 à 9 m', 'warn');
      return H(C === 'interurbain' ? `7 m normal (1,2 × le max = ${f(need)} m)` : `≥ 1,2 × le max = ${f(need)} m`, 'ok');
    }
    case 'ring.bf':
      if (C === 'interurbain') {
        if (Rg <= 15 && v < 1.5) return H('ACI : 1,5 à 2 m nécessaire pour Rg 12–15 m', 'warn');
        if (v > 2) return H('ACI : 1,5 à 2 m', 'warn');
        return H(Rg <= 15 ? 'ACI : 1,5 à 2 m (pente 4–6 %)' : 'ACI : non nécessaire pour Rg ≥ 20 m', 'ok');
      }
      if (Rg < 20 && v < 1) return H('≈ indispensable si Rg < 20 m (1 à 2 m)', 'warn');
      if (v > 2) return H('CERTU : 1 à 2 m', 'warn');
      return H('CERTU : 1 à 2 m, légèrement surélevée', 'ok');
    case 'ring.devers':
      return Math.abs(v - RING_DEVERS) < 1e-9 ? H('1,5 % vers l\'extérieur (valeur imposée)', 'ok') : H('Le dévers de l\'anneau doit être de 1,5 %', 'err');
    case 'ring.pente':
      if (v > 6) return H('ACI : > 6 % — problèmes importants', 'err');
      if (v >= 3) return H('ACI : 3–6 % défavorable', 'warn');
      return H('ACI : < 3 % sans difficulté', 'ok');
    case 'le':
      if (C === 'interurbain') {
        if (two('nIn')) return rng(v, 6, 7.5) ? H('ACI : 7 m (6 m si très peu de PL)', 'ok') : H('ACI : 7 m pour 2 voies', 'warn');
        if (v < 2.2) return H('ACI : 2,20 m minimum absolu', 'err');
        return rng(v, 3.5, 4.5) ? H('ACI : 4 m pour 1 voie', 'ok') : H('ACI : 4 m pour 1 voie (2,20 m mini, branche très secondaire)', 'warn');
      }
      if (two('nIn')) return rng(v, 6, 7) ? H('CERTU : 6 à 7 m pour 2 voies', 'ok') : H('CERTU : 6 à 7 m pour 2 voies', 'warn');
      return rng(v, 3, 3.5) ? H('CERTU : 3,00 à 3,50 m', 'ok') : H('CERTU : 3,00 à 3,50 m pour 1 voie', 'warn');
    case 'ls':
      if (C === 'interurbain') {
        if (two('nOut')) return rng(v, 6.5, 7.5) ? H('ACI : 7 m pour 2 voies', 'ok') : H('ACI : 7 m pour 2 voies', 'warn');
        return rng(v, 4, 5) ? H('ACI : 4 à 5 m pour 1 voie', 'ok') : H('ACI : 4 à 5 m pour 1 voie', 'warn');
      }
      if (two('nOut')) return rng(v, 6.5, 7.5) ? H('CERTU : 7 m (> 1 200 véh/h)', 'ok') : H('CERTU : 7 m pour 2 voies', 'warn');
      return v >= 3.5 - 1e-9 ? H('CERTU : ≥ 3,50 m', 'ok') : H('CERTU : ≥ 3,50 m', 'warn');
    case 'Re':
      if (v > Rg + 1e-9) return H(`Re ≤ Rg (${f(Rg)} m)`, 'err');
      return C === 'interurbain'
        ? (rng(v, 10, 15) ? H('ACI : 10 à 15 m, ≤ Rg', 'ok') : H('ACI : 10 à 15 m, ≤ Rg', 'warn'))
        : (rng(v, 8, 15) ? H('CERTU : 8 à 15 m', 'ok') : H('CERTU : 8 à 15 m', 'warn'));
    case 'Rs': {
      const Ri = Rg - la;
      if (C === 'interurbain') {
        if (v <= Ri) return H(`ACI : Rs > Ri (${f(Ri)} m)`, 'err');
        return rng(v, 15, 30) ? H('ACI : 15 à 30 m, > Ri', 'ok') : H('ACI : 15 à 30 m, > Ri', 'warn');
      }
      return rng(v, 15, 20) ? H('CERTU : 15 à 20 m', 'ok') : H('CERTU : 15 à 20 m', 'warn');
    }
    case 'island.base': {
      const b = getPath(br, key) === '' ? Rg / 4 : v;
      if (br.island?.type === 'physique' && b < 2) return H('Largeur minimale 2 m', 'err');
      return H(`auto : Rg/4 = ${f(Rg / 4)} m${C === 'urbain' ? ' · refuge piéton si > 1,50 m' : ''}`, 'ok');
    }
    case 'island.length': return H(`auto : Rg = ${f(Rg)} m (triangle de construction)`, '');
    case 'island.shift': {
      const d = islandDims(prj, br).autoShift;
      return H(C === 'interurbain' ? `auto : ACI (0,5 + Rg/50)/2 = ${f(d)} m${Rg <= 15 ? ' (0 si Rg ≤ 15 m)' : ''}` : 'auto : 0 en urbain', '');
    }
    case 'camber': return H(C === 'interurbain' ? '2,5 % en toit (≈ ARP)' : '2,5 % par défaut', '');
    case 'axeR': return H(`auto : ${f(sectionParams(prj).axeR)} m (onglet Profil) ; raccorde l'alignement radial à l'axe dessiné et ses sommets`, '');
    default: return null;
  }
}

// Aides des champs des carrefours plans ; undefined → champ non concerné.
function planHint(key, prj, br) {
  const C = prj.context, inter = C === 'interurbain', P = planParams(prj);
  const H = (txt, lvl = '') => ({ txt, lvl });
  const raw = br ? getPath(br, key) : getPath(prj, key);
  const v = +raw, auto = raw === '' || raw == null;
  if (br) {
    const a = secondaryAuto(prj, br);
    switch (key) {
      case 'le': return auto ? H(`auto : sup(l/2 ; 3) = ${f(a.le)} m (l = ${f(a.l)} m)`) : v < 3 - 1e-9 ? H('ACI : 3 m minimum', 'warn') : H(`ACI : sup(l/2 ; 3) = ${f(a.le)} m`, 'ok');
      case 'ls': return auto ? H(`auto : l/2 + 0,50 = ${f(a.ls)} m`) : v < 3 - 1e-9 ? H('ACI : 3 m minimum', 'warn') : H(`ACI : l/2 + 0,50 = ${f(a.ls)} m`, 'ok');
      case 'Re':
        if (!inter) return H(auto ? `auto : ${f(a.Re)} m — à vérifier par épure de giration` : 'CERTU : épure de giration', '');
        return auto ? H(`auto : 2l = ${f(a.Re)} m`) : v < a.Re - 1e-6 ? H(`ACI : 2l = ${f(a.Re)} m (épure PL si plus petit)`, 'warn') : H(`ACI : 2l = ${f(a.Re)} m`, 'ok');
      case 'Rs':
        if (!inter) return H(auto ? `auto : ${f(a.Rs)} m — à vérifier par épure de giration` : 'CERTU : épure de giration', '');
        return auto ? H(`auto : 4l = ${f(a.Rs)} m`) : v < a.Rs - 1e-6 ? H(`ACI : 4l = ${f(a.Rs)} m`, 'warn') : H(`ACI : 4l = ${f(a.Rs)} m (+25 % pour favoriser le tourne-à-droite)`, 'ok');
      case 'island.base': {
        const b = auto ? PLAN[C].island.base : v;
        if (br.island?.type === 'physique' && b < 1.9) return H('Îlot en saillie : 1,90 m mini pour une balise J5', 'warn');
        return H(auto ? `auto : ${f(b)} m` : 'ACI : ≥ 1,90 m avec balise J5', auto ? '' : 'ok');
      }
      case 'island.length': return H(inter ? `auto : 4l = ${f(a.h)} m (triangle de construction)` : `auto : ${f(a.h)} m`);
      case 'island.gap': return H('ACI : nez en retrait de 1 m du bord de la principale');
      case 'pente': return auto ? H('auto : pente du site') : Math.abs(v) > 2 ? H('ACI : ≤ 2 % sur les 10 à 20 m avant le carrefour', 'warn') : H('ACI : ≤ 2 % près du carrefour', 'ok');
      case 'camber': return H(inter ? '2,5 % en toit (≈ ARP)' : '2,5 % par défaut');
      default: return undefined;
    }
  }
  switch (key) {
    case 'plan.wLane': return v > 3.5 + 1e-9 ? H('ACI : jamais plus de 3,50 m au carrefour', 'warn') : H(inter ? 'ACI : largeur de section courante, 3,50 m maxi' : 'CERTU : 3 m en général', 'ok');
    case 'plan.tag.width': return rng(v, 2.75, 3.25) ? H(inter ? 'ACI : 2,75 à 3,25 m' : 'CERTU : 3 m avec bus / PL, sinon 2,75 m', 'ok') : H('2,75 à 3,25 m', 'warn');
    case 'plan.tag.island': return rng(v, 0.25, 2) ? H(`ACI : a = 0,25 à 2 m ; largeur centrale ${f(P.c)} m (≤ 5 m)`, P.c <= 5 + 1e-9 ? 'ok' : 'warn') : H('ACI : a = 0,25 à 2 m', 'warn');
    case 'plan.tag.storage': return v < (2 * P.nLanes * P.wLane > 6 ? 20 : 15) ? H('ACI : 20–50 m (40–60 m avec PL) ; 15 m si chaussée < 6 m', 'warn') : H('ACI : 20–50 m, 40–60 m avec PL ; Lst = (7 + 10p)·N', 'ok');
    case 'plan.tag.sifflet': return rng(v, 15, 30) ? H('ACI : 20–30 m (15 m si chaussée < 6 m)', 'ok') : H('ACI : 20–30 m', 'warn');
    case 'plan.tag.align': return v >= 10 - 1e-9 ? H('ACI : ≥ 10 m', 'ok') : H('ACI : ≥ 10 m', 'warn');
    case 'plan.tag.deport': return H(`auto : déport au 1/${2 * P.nLanes * P.wLane <= 5 ? 10 : 15} = ${f(P.tag.deport, 1)} m`);
    case 'plan.tag.presig': return H('ACI : L/2 = 58,5 m pour un déport symétrique (chaussée 5–7 m)');
    case 'plan.tVis': return H(`auto : ${P.regime === 'stop' ? 'STOP 8 s' : 'cédez 10 s'}${P.tag.on ? ' + 1 s (TAG)' : ''} ; +1 s si la branche monte de plus de 2 %`);
    case 'plan.dObs': return H(`auto : ${P.regime === 'stop' ? '4 m (STOP)' : '15 m (cédez, 15 à 20 m)'} en arrière de la ligne`);
    case 'plan.v85': return H('V85 réelle, non plafonnée à la vitesse limite');
    case 'plan.camber': return H(inter ? '2,5 % en toit (≈ ARP)' : '2,5 % par défaut');
    default: return undefined;
  }
}

// Contrôles d'un carrefour plan.
function checkPlan(prj, D) {
  const out = [], add = (lvl, group, msg) => out.push({ lvl, group, msg });
  const inter = prj.context === 'interurbain', P = planParams(prj), kind = prj.kind;
  if (!D || !D.O) { add('info', 'Projet', 'Dessinez les axes des branches : la route principale est la paire la plus alignée.'); return out; }
  if (inter) add('info', 'Choix', 'ACI : giratoire préférable si le trafic secondaire est important, en cas de problème de sécurité, pour deux routes de même niveau ou de 7 m et plus.');
  for (const k of ['plan.wLane', ...(P.tag.on ? ['plan.tag.width', 'plan.tag.island', 'plan.tag.storage', 'plan.tag.sifflet', 'plan.tag.align'] : [])]) {
    const h = planHint(k, prj);
    if (h?.lvl && h.lvl !== 'ok') add(h.lvl, 'Route principale', `${k.replace('plan.tag.', 'TAG : ').replace('plan.', '')} = ${f(+getPath(prj, k))} — ${h.txt}`);
  }
  if (P.tag.on && P.tag.raised && P.tag.island < 1.2) add('warn', 'Route principale', 'Îlot central trop étroit pour être en saillie (a < 1,20 m) : il est dessiné en marquage.');
  if (inter && !P.tag.on) add('info', 'Route principale', `Pas de voie de tourne-à-gauche : souhaitable au-delà de ${kind === 'T' ? '100' : '200'} v/j tournant à gauche (ACI).`);
  if (inter && P.tag.on && !P.tag.raised) add('warn', 'Route principale', 'ACI : l\'îlot en saillie est indispensable avec une voie de tourne-à-gauche (un îlot peint dégrade fortement la sécurité).');
  if (P.regime === 'stop') add('info', 'Régime', 'STOP : à réserver aux cas où la visibilité du cédez-le-passage n\'est pas assurée (ACI).');
  for (const bd of D.branches) {
    if (bd.role !== 'secondaire') continue;
    const br = prj.branches[bd.idx], deg = (bd.angle * 180) / Math.PI;
    if (deg < 70) add('warn', bd.name, `Incidence de ${f(deg, 0)}° sur la route principale (70 à 110° attendus) : réaligner la branche.`);
    for (const k of ['le', 'ls', 'Re', 'Rs', 'island.base', 'pente']) {
      const h = planHint(k, prj, br);
      if (h?.lvl && h.lvl !== 'ok') add(h.lvl, bd.name, `${LBL[k] || k} — ${h.txt}`);
    }
    if (bd.vis) add('info', bd.name, `Dégager le triangle de visibilité : ${f(bd.vis.D, 0)} m de part et d'autre (${f(P.tVis, 0)} s à ${f(P.v85, 0)} km/h).`);
  }
  for (const it of D.issues) add(it.lvl, 'Géométrie', it.msg);
  return out;
}

export function getPath(o, k) { return k.split('.').reduce((a, p) => (a == null ? a : a[p]), o); }
export function setPath(o, k, v) {
  const ks = k.split('.'); let a = o;
  for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null || typeof a[ks[i]] !== 'object') a[ks[i]] = {}; a = a[ks[i]]; }
  a[ks[ks.length - 1]] = v;
}

// Contrôles globaux : [{ lvl, group, msg }]
export function checkDesign(prj, D) {
  if (isPlan(prj)) return checkPlan(prj, D);
  const out = [];
  const add = (lvl, group, msg) => out.push({ lvl, group, msg });
  if (!D || !D.O) { add('info', 'Projet', 'Dessinez au moins un axe de branche pour générer le giratoire.'); return out; }
  for (const k of ['ring.Rg', 'ring.la', 'ring.bf', 'ring.devers', 'ring.pente']) {
    const h = hintFor(k, prj);
    if (h) add(h.lvl || 'info', 'Anneau', `${LBL[k]} = ${f(+getPath(prj, k))} — ${h.txt}`);
  }
  if (D.Rb > 0 && D.Rb < 3.5) add('warn', 'Anneau', `Partie infranchissable de l'îlot central : rayon ${f(D.Rb)} m < 3,5 m.`);
  if (prj.context === 'interurbain' && D.Ri < 10 && D.Ri > 0) add('info', 'Anneau', `Ri = ${f(D.Ri)} m : Ri ≈ 10 m souhaitable avec semi-remorques.`);
  if (+prj.ring.la < 9 || +prj.ring.Rg < 20) add('info', 'Marquage', 'Pas de marquage axial sur l\'anneau (la < 9 m ou Rg < 20 m).');

  const n = D.branches.length;
  if (n && n < 3) add('warn', 'Branches', `${n} branche(s) : un giratoire comporte normalement au moins 3 branches.`);
  if (n > 6) add(prj.context === 'interurbain' ? 'warn' : 'info', 'Branches', `${n} branches : au-delà de 6, configuration exceptionnelle.`);
  if (prj.context === 'interurbain' && n > 4 && +prj.ring.Rg < 20) add('warn', 'Anneau', 'Plus de 4 branches : Rg de 20 à 25 m conseillé (ACI).');

  for (const bd of D.branches) {
    const br = prj.branches[bd.idx];
    for (const k of ['le', 'ls', 'Re', 'Rs', 'island.base']) {
      const h = hintFor(k, prj, br);
      if (h && h.lvl && h.lvl !== 'ok') add(h.lvl, bd.name, `${LBL[k]} = ${f(+getPath(br, k) || (k === 'island.base' ? bd.b : 0))} — ${h.txt}`);
    }
    if (bd.a > 0.05) add('err', bd.name, `Axe excentré à droite de ${f(bd.a)} m : à exclure (ACI).`);
    else if (bd.a < -0.05) add(Math.abs(bd.a) > +prj.ring.Rg / 10 ? 'warn' : 'ok', bd.name, `Axe excentré à gauche de ${f(-bd.a)} m (légère excentration admise).`);
    if (bd.defl) {
      const R = bd.defl.R;
      add(R < 100 ? 'ok' : 'warn', bd.name, `Déflexion vers ${bd.defl.to} : rayon ≈ ${f(R, 0)} m ${R < 100 ? '< 100 m' : '≥ 100 m — insuffisante'}${R < 100 && R > 45 ? ' (≈ 30 m souhaitable)' : ''} (méthode des 3 points, à confirmer sur l'épure).`);
    }
    const dv = D.devers?.branches?.find((x) => x.idx === bd.idx);
    if (dv) {
      const m = Math.max(Math.abs(dv.d0In), Math.abs(dv.d0Out), Math.abs(dv.camber));
      if (m > 0.03 + 1e-9) add('warn', bd.name, `Pente transversale de ${f(m * 100, 1)} % dans la zone de raccordement (≤ 3 %).`);
    }
  }
  if (D.mini) {
    for (let i = 0; i < D.branches.length; i++) {
      const a = D.branches[i], b = D.branches[(i + 1) % D.branches.length];
      const ang = (((b.theta - a.theta) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) * 180 / Math.PI;
      if (D.branches.length > 1 && ang < 80) add(ang < 70 ? 'warn' : 'info', 'Mini-giratoire', `${a.name} / ${b.name} : ${f(ang, 0)}° entre branches (< 70° à éviter, 70–80° avec précaution).`);
    }
  }
  if (D.devers) {
    const mx = D.devers.maxTransverse;
    if (mx > 0.03 + 1e-9) add('warn', 'Dévers', `Pente transversale maximale sur l'anneau ${f(mx * 100, 1)} % > 3 %.`);
    if (D.devers.minRadial < 0) add('warn', 'Dévers', `Dévers inversé (vers l'îlot central) sur une partie de l'anneau : ${f(D.devers.minRadial * 100, 1)} %.`);
  }
  for (const it of D.issues) add(it.lvl, 'Géométrie', it.msg);
  return out;
}

const LBL = {
  'ring.Rg': 'Rg', 'ring.la': 'la', 'ring.bf': 'bf', 'ring.devers': 'Dévers anneau (%)', 'ring.pente': 'Déclivité générale (%)',
  le: 'le', ls: 'ls', Re: 'Re', Rs: 'Rs', 'island.base': 'Base îlot', pente: 'Pente en long',
};
