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
    branch: { le: 3.5, ls: 4, Re: 12, Rs: 15, wLane: 3.25, camber: 2.0, tpcWidth: 2 },
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

// Dimensions de l'îlot séparateur : triangle de construction ACI (hauteur Rg sur l'axe, base Rg/4 côté anneau),
// décalé vers la gauche de d = (0,5 + Rg/50)/2 pour Rg > 15 m en interurbain ; rayons de bordure Rg/50.
export function islandDims(prj, br) {
  const Rg = +prj.ring.Rg;
  const i = br.island || {};
  const autoShift = prj.context === 'interurbain' && Rg > 15 ? (0.5 + Rg / 50) / 2 : 0;
  return {
    type: i.type || 'physique',
    b: num(i.base, Rg / 4),
    h: num(i.length, Rg),
    gap: num(i.gap, PRESETS[prj.context].island.gap),
    rHead: Math.max(0.3, Rg / 50),
    rTip: Math.max(0.3, Rg / 50),
    shift: br.tpc?.on ? 0 : num(i.shift, autoShift),
    autoShift,
    Rr: 4 * Rg,
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
};

const rng = (v, a, b) => v >= a - 1e-9 && v <= b + 1e-9;
const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '—');

// Aide affichée sous un champ : { txt, lvl } ; lvl ∈ ok | warn | err | ''
export function hintFor(key, prj, br) {
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
    case 'camber': return H(C === 'interurbain' ? '2,5 % en toit (≈ ARP)' : 'valeur courante ≈ 2 %', '');
    default: return null;
  }
}

export function getPath(o, k) { return k.split('.').reduce((a, p) => (a == null ? a : a[p]), o); }
export function setPath(o, k, v) {
  const ks = k.split('.'); let a = o;
  for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null || typeof a[ks[i]] !== 'object') a[ks[i]] = {}; a = a[ks[i]]; }
  a[ks[ks.length - 1]] = v;
}

// Contrôles globaux : [{ lvl, group, msg }]
export function checkDesign(prj, D) {
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
  le: 'le', ls: 'ls', Re: 'Re', Rs: 'Rs', 'island.base': 'Base îlot',
};
