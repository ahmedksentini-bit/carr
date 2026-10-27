// capacity.js — trafic à l'heure de pointe et capacité des entrées d'un giratoire, modèle de type Girabase.
// Réimplémentation indépendante des formules de Girabase 4 (Cerema), d'après son manuel et son code source
// publié (github.com/CEREMA/territoires-ville.Girabase) : capacité de type Siegloch, trafic gênant pondéré
// par la géométrie de l'anneau, perte due aux piétons, temps d'attente et files.
// Matrice origine-destination en véh/h, convertie en uvp/h ; l'anneau est parcouru dans le sens trigonométrique.

const DEG = 180 / Math.PI;
const TAU = Math.PI * 2;

// Milieu : créneau critique Tg, intervalle de suivi Tf, exposant de largeur Te.
export const SITES = {
  rase: { label: 'Rase campagne', Tg: 4.75, Tf: 2.25, Te: 0.70, tma: [20, 40], lk: [10, 20], lkm: 25 },
  periurbain: { label: 'Périurbain', Tg: 4.55, Tf: 2.05, Te: 0.80, tma: [60, 120], lk: [20, 40], lkm: 30 },
  urbain: { label: 'Urbain', Tg: 4.40, Tf: 1.80, Te: 0.85, tma: [60, 120], lk: [20, 40], lkm: 30 },
};

// Débit d'un mouvement en uvp/h (PL = k uvp, arrondi à l'unité supérieure, plafonné à 2500).
export function uvp(traffic, o, d) {
  const v = +(traffic?.od?.[o]?.[d]) || 0;
  if (v <= 0) return 0;
  const k = +traffic?.uvpPL || 2, pl = Math.max(0, Math.min(100, +(traffic?.pl?.[o]) || 0)) / 100;
  return Math.min(2500, Math.ceil(v * (1 - pl + pl * k) - 1e-9));
}

// Débits par branche à partir de la matrice OD (order : identifiants dans le sens de giration).
//   Qe : entrant ; Qs : sortant ; Qc : circulant devant l'entrée (demi-tours des autres branches compris) ;
//   Qtd : tourne-à-droite (sortie à la branche suivante) ; Qbp : part écoulée par une voie directe de TAD.
//   contrib : flux passant devant l'entrée, avec la position relative de leur sortie (1 = branche suivante).
export function flows(traffic, order) {
  const n = order.length, pos = new Map(order.map((id, i) => [id, i]));
  const res = new Map(order.map((id) => [id, { Qe: 0, Qs: 0, Qc: 0, Qtd: 0, Qbp: 0, contrib: [] }]));
  for (const o of order) {
    for (const d of order) {
      const q = uvp(traffic, o, d);
      if (!q) continue;
      const io = pos.get(o), id = pos.get(d);
      const steps = id === io ? n : (id - io + n) % n;
      if (steps === 1) {
        res.get(o).Qtd += q;
        if (traffic?.tad?.[o]) { res.get(o).Qbp += q; continue; } // voie directe : hors giratoire
      }
      res.get(o).Qe += q;
      res.get(d).Qs += q;
      for (let s = 1; s < steps; s++) {
        const r = res.get(order[(io + s) % n]);
        r.Qc += q;
        r.contrib.push({ q, d, rel: steps - s });
      }
    }
  }
  return res;
}

// Coefficient d'affectation à l'extérieur de l'anneau, selon l'écart angulaire α (degrés, sens de giration)
// entre l'entrée et la sortie du flux, pour les flux sortant à la 1re ou 2e branche après l'entrée.
const kae = (rel, alpha) => (rel > 2 ? 0.1 : alpha < 70 ? 1 : alpha <= 115 ? (120 - alpha) / 50 : 0.1);

// ring : { R (rayon de l'îlot infranchissable), bf, la } ; entries : [{ id, theta, le4, le15, li, ls, lanes, rampe, qp }]
// dans le sens de giration. Retourne Map id → résultats, et les constantes du giratoire.
export function analyse(traffic, ring, entries) {
  const mini = !(ring.R > 0);
  const site = SITES[mini ? 'rase' : traffic?.site] || SITES.rase;
  const { Tg, Te } = site;
  const RU = mini ? 3.5 : ring.R + 0.5 * ring.bf;
  const LAU = mini ? ring.la + ring.bf - 3.5 : ring.la + 0.5 * ring.bf;
  const LEU = LAU / (1.2 * (1 + 1 / (2 * RU)));
  const LImax = Tg * Math.sqrt(RU + LAU / 2);
  const KE = LAU <= 8 ? 1 : 1 - (RU / (RU + LAU)) ** 2 * ((LAU - 8) / LAU);
  const KI = Math.min(KE, (8 / LAU) * Math.sqrt(20 / (RU + LAU)));
  const order = entries.map((e) => e.id), theta = new Map(entries.map((e) => [e.id, e.theta]));
  const F = flows(traffic, order);
  const out = new Map();

  for (const e of entries) {
    const f = F.get(e.id);
    let QTE = 0;
    for (const c of f.contrib) {
      const alpha = ((((theta.get(c.d) - e.theta) % TAU) + TAU) % TAU) * DEG;
      QTE += kae(c.rel, alpha) * c.q;
    }
    const QTI = f.Qc - QTE;
    const KS = Math.max(0, RU / (RU + LAU) - (e.li + 0.5 * Math.max(e.ls - 5, 0)) / LImax);
    const Qg = KE * QTE + KI * QTI + (f.Qc + f.Qs > 0 ? KS * f.Qs * (1 - f.Qs / (f.Qc + f.Qs)) : 0);
    const Tf = site.Tf * (e.rampe ? 1.35 : 1);
    const expo = -(Qg / 3600) * (Tg - Tf / 2);
    const Ci = (3600 / Tf) * Math.exp(expo);
    const LE = e.le15 != null && Math.abs(e.le15 - e.le4) > 0.01 ? (e.le4 + e.le15) / 2 : e.le4;
    const LEG = Math.min(LE, LEU);
    const Cvh = Ci * (LEG / 3.5) ** Te;
    const QP = e.qp ?? 10, TTP = Math.min(e.le4, 4);
    const Cp = (TTP / 10) * (1 - Math.exp(-QP / 360)) * ((1800 + QP) / 2160) * Math.exp(expo);
    const C = Cvh * (1 - Cp);
    const Qe = f.Qe, RC = C - Qe, RCp = C > 0 ? RC / C : -1;
    // Temps moyen d'attente (s), raccord continu entre régime fluide et saturé.
    const x = C > 0 ? Qe / C : Infinity, q = Qe / 3600;
    let TMA;
    if (Qe <= 0) TMA = Math.max(0, 3600 / C - Tf);
    else if (x < 0.9) TMA = (Math.exp(-q * Tf) / (1 - x) - 1) / q;
    else if (x > 1.1) TMA = 1800 * (x - 1);
    else { const B = (10 * Math.exp(-q * Tf) - 1) / q; TMA = B + 5 * (180 - B) * (x - 0.9); }
    TMA = Math.max(0, TMA);
    const lanes = Math.max(1, e.lanes || 1);
    const LK0 = (TMA * Math.min(Qe, C)) / 3600;
    const LKM0 = Qe < C ? 2 + 3 * LK0 : 2 + (3 + (2 * RC) / Qe) * LK0;
    const res = { ...f, QTE, QTI, KS, Qg, LEG, Ci, Cp, C, RC, RCp, TMA, LK: LK0 / lanes, LKM: LKM0 / lanes, notes: [] };
    res.lvl = RCp < 0.05 ? 'err' : RCp < 0.25 ? 'warn' : RCp > 0.8 ? 'info' : 'ok';
    if (RCp < 0) res.notes.push('entrée saturée');
    else if (RCp < 0.05) res.notes.push('réserve < 5 % : fortes perturbations');
    else if (RCp < 0.15) res.notes.push('réserve faible (< 15 %)');
    else if (RCp < 0.25) res.notes.push('files possibles aux hyper-pointes (réserve 5–25 %)');
    else if (RCp > 0.5) res.notes.push('réserve > 50 % : vérifier un éventuel surdimensionnement');
    if (TMA >= site.tma[1]) res.notes.push(`attente très importante (≥ ${site.tma[1]} s)`);
    else if (TMA >= site.tma[0]) res.notes.push(`attente importante (≥ ${site.tma[0]} s)`);
    if (res.LKM >= site.lkm) res.notes.push(`file maximale ≥ ${site.lkm} véh.`);
    if (RCp < 0.15 && f.Qtd > 0.33 * (Qe + f.Qbp) && Qe + f.Qbp > 600 && !traffic?.tad?.[e.id]) {
      res.notes.push('envisager une voie directe de tourne-à-droite');
      res.tadAdvice = true;
    }
    out.set(e.id, res);
  }
  const all = [...out.values()];
  const consts = { site, RU, LAU, LEU, LImax, KE, KI, mini };
  consts.oversized = all.length > 0 && all.every((r) => r.RCp > 0.8);
  return { res: out, consts };
}
