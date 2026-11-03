// vsa.js — accès sur une voie principale (ou secondaire) de catégorie VSA 90 / VSA 110.
//
// Référentiels :
//   [VSA]  Cerema, « VSA 90 et 110 — Conception des voies à 90 et 110 km/h », nov. 2014, § 4.2, 6.1 à 6.4 ;
//   [VRUA] Certu, « Conception des accès sur voies rapides urbaines de type A », 2003 — auquel [VSA] § 6.2.4 renvoie pour
//          le dimensionnement des accès rapprochés (distances de signalisation d1, d1m, ds, module L, lb).
// [VSA] prime quand les deux guides chiffrent la même grandeur (np = 170 m au lieu de 125 m, déboîtement 150 m…).
// Les minima conditionnés par un trafic (uvp/h) ne peuvent pas être vérifiés ici (aucun trafic saisi sur les bretelles) :
// ils sont signalés comme « admis si … » plutôt que rejetés.

export const isVsa = (dcat) => dcat === 'VSA90' || dcat === 'VSA110';

// [VRUA] p. 39 (tableau des distances de signalisation) : V = 90 → colonne 70/90 (exemple p. 54 : 770 m pour
// 2 voies à 90 km/h = 305 + 125 + 240 + 100), V = 110 → colonne 90/110. Indices : 2, 3, 4 voies (ν).
const SIG = {
  VSA90: { d1: 600, d1m: { 2: 240, 3: 360, 4: 480 }, ds: { 2: 120, 3: 240, 4: 360 }, L: 117 },
  VSA110: { d1: 800, d1m: { 2: 300, 3: 450, 4: 600 }, ds: { 2: 150, 3: 300, 4: 450 }, L: 195 },
};

// Règles d'une VSA. lanes = nombre de voies de la chaussée hôte (ν, borné à 2…4 pour les tableaux).
export function vsaRules(dcat, lanes = 2) {
  if (!isVsa(dcat)) return null;
  const v110 = dcat === 'VSA110', n = Math.max(2, Math.min(4, Math.round(lanes) || 2)), sg = SIG[dcat];
  return {
    dcat, V: v110 ? 110 : 90, label: v110 ? 'VSA 110' : 'VSA 90',
    // [VSA] § 6.4.3.4 : vitesses conventionnelles aux nez (Ld / La).
    vS: v110 ? 70 : 50, vE: 55,
    // [VSA] sch. 14 et § 6.2.2.1 : déboîtement 150 m (110 m si S < 650 uvp/h, VSA 90 seulement).
    biseauS: 150, biseauSmin: v110 ? null : 110,
    // [VSA] sch. 26 : insertion 200 m + biseau 75 m (150 m si E < 600 uvp/h, VSA 90, avec BAU en aval).
    insE: 200, insEmin: v110 ? null : 150, biseauE: 75,
    // [VSA] § 4.2 : distances d'arrêt (alignement / courbe R < 5V), de lecture lc, de non-perturbation np.
    da: v110 ? 195 : 130, daC: v110 ? 230 : 150, lc: v110 ? 155 : 125, np: 170,
    // [VSA] § 6.2.4.3 : entrecroisement 300 à 750 m (Z = E.1,00 → S.1,00), en deçà sur collectrice.
    zMin: 300, zMax: 750,
    // [VSA] § 6.1 : pas d'échangeur dans une courbe déversée ; éviter R < 1,5 Rdn.
    Rdn: v110 ? 650 : 370,
    // [VRUA] p. 39.
    d1: sg.d1, d1m: sg.d1m[n], ds: sg.ds[n], L: sg.L, n,
    // [VRUA] p. 12 : signalisation d'avertissement D50 à d du D30 (aucune en 70/90).
    d: v110 ? 1500 : null,
  };
}

// [VRUA] § 1.6 p. 14 : longueur lb du marquage en amont de S.1,00 (zébras) ; l1 = (0,75 − 0,375)/p, l2 = (1,00 − 0,75)/p.
export function lbOf(L, p) {
  const l1 = 0.375 / p, l2 = 0.25 / p;
  return L / 6 >= l1 ? L / 6 + l2 : l1 + l2;
}

// Abscisse (dans le sens de circulation) du panneau D40 d'une sortie : D30 au point S.1,50 ([VRUA] p. 39), D40 à d en
// amont du D30. Le musoir s'élargit vers l'aval : S.1,50 est à 0,50/p en aval de S.1,00 (obliquité constante).
export const d40At = (uS, p, d) => uS + 0.5 / p - d;

// Contrôles d'enchaînement sur une chaussée hôte VSA. list : accès triés par u croissant (sens de circulation) :
//   { kind: 'S' | 'E', u (S.1,00 ou E.1,00), p, name, id, uEnd (E : fin du biseau, null si voie d'entrecroisement) }.
// weaveOf(idE) → id de la sortie reliée par une voie d'entrecroisement dessinée. say(lvl, msg).
// Rend, pour chaque sortie dont la présignalisation doit être rapprochée, id → d1m (distance D30 → D40 à dessiner).
export function vsaSequenceChecks(V, list, weaveOf, say, fmt) {
  const d40 = new Map();
  const at = (g, ref) => (g >= 0 ? `à ${fmt(g)} m ${ref}` : `${fmt(-g)} m en amont ${ref}`);
  list.forEach((a, k) => {
    const next = (kind) => list.slice(k + 1).find((q) => q.kind === kind);
    if (a.kind === 'E') {
      // Entrée – entrée ([VSA] § 6.2.4.1) : fin de la 1re (biseau) à da au moins en amont de E.1,00 de la 2nde.
      const e2 = next('E');
      if (e2 && a.uEnd != null) {
        const g = e2.u - a.uEnd;
        if (g < V.da - 1e-6) say('err', `${a.name} → ${e2.name} (entrée – entrée) : ${fmt(g)} m entre la fin du biseau de ${a.name} et E.1,00 de ${e2.name} < da = ${V.da} m (${V.label}, § 6.2.4.1).`);
      }
      // Entrée – sortie ([VSA] § 6.2.4.3).
      const s = list.slice(k + 1).find((q) => q.kind === 'S');
      if (!s) return;
      const Z = s.u - a.u, tag = `${a.name} → ${s.name} (entrée – sortie, Z = ${fmt(Z)} m)`;
      if (Z < 0) return; // musoirs superposés : signalé par le contrôle général des entrecroisements
      if (weaveOf(a.id) === s.id) {
        const zl = V.lc + V.ds + lbOf(V.L, s.p);
        if (Z < V.zMin - 1e-6) say('err', `${tag} : entrecroisement < ${V.zMin} m → à reporter sur une collectrice (§ 6.2.4.3).`);
        else if (Z > V.zMax + 1e-6) say('warn', `${tag} : entrecroisement > ${V.zMax} m (§ 6.2.4.3).`);
        else if (Z < zl - 1e-6) say('warn', `${tag} : Z < lc + ds + lb = ${fmt(V.lc)} + ${fmt(V.ds)} + ${fmt(lbOf(V.L, s.p), 2)} = ${fmt(zl)} m → disposition exceptionnelle (VRU A § 2.4.1).`);
        return;
      }
      if (a.uEnd == null) return;
      const gN = d40At(s.u, s.p, V.d1) - a.uEnd, gM = d40At(s.u, s.p, V.d1m) - a.uEnd;
      if (gN >= V.lc - 1e-6) return;
      if (gM >= V.lc - 1e-6) { d40.set(s.id, V.d1m); say('warn', `${tag} : D40 de ${s.name} à d1 = ${V.d1} m du D30 tomberait ${at(gN, "de la fin de l'entrée")} (< lc = ${V.lc} m) ; présignalisation ramenée à d1m = ${V.d1m} m (minimum absolu, VRU A p. 39 ; § 6.2.4.3).`); return; }
      say('err', `${tag} : enchaînement direct impossible (D40 de ${s.name} avec d1m = ${V.d1m} m ${at(gM, "de la fin de l'entrée")}, < lc = ${V.lc} m) — ${Z < V.zMin ? `entrecroisement sur collectrice (Z < ${V.zMin} m)` : Z <= V.zMax ? `voie d'entrecroisement de ${V.zMin} à ${V.zMax} m à prévoir` : `éloigner les accès`} (§ 6.2.4.3).`);
      return;
    }
    // Sortie – sortie ([VSA] § 6.2.4.2) : D40 / Da40 de la 2nde à np au moins de S.1,00 de la 1re.
    const s2 = next('S');
    if (!s2) return;
    const gN = d40At(s2.u, s2.p, V.d1) - a.u, gM = d40At(s2.u, s2.p, V.d1m) - a.u, tag = `${a.name} → ${s2.name} (sortie – sortie, ${fmt(s2.u - a.u)} m entre S.1,00)`;
    if (gN >= V.np - 1e-6) return;
    if (gM >= V.np - 1e-6) d40.set(s2.id, V.d1m), say('warn', `${tag} : D40 de ${s2.name} avec d1 = ${V.d1} m ${at(gN, `de S.1,00 de ${a.name}`)} (< np = ${V.np} m) ; présignalisation ramenée à d1m = ${V.d1m} m (minimum absolu, VRU A p. 39 ; § 6.2.4.2).`);
    else say('err', `${tag} : D40 de ${s2.name} ${at(gM, `de S.1,00 de ${a.name}`)} (< np = ${V.np} m) même avec d1m = ${V.d1m} m — sorties à éloigner ou à regrouper (sortie commune puis divergent sur bretelle) (§ 6.2.4.2).`);
  });
  return d40;
}

// Longueur Z en deçà de laquelle une entrée suivie d'une sortie ne peut pas être enchaînée directement (D40 de la sortie
// à lc de la fin de l'entrée, avec d1m) : en deçà, et jusqu'à 750 m, une voie d'entrecroisement est dessinée.
export function vsaDirectZmin(V, insE, biseauE, pS) {
  return insE + biseauE + V.lc + V.d1m - 0.5 / pS;
}

// Section courante d'une VSA ([VSA] § 1.5, 5.1 à 5.3) : chaussées séparées à 2 voies au moins, BAU 2,50 m (ou BDD
// ≥ 1,00 m), BDG 1,00 m (0,75 m minimum), berme ≥ 0,75 m.
export function vsaSectionChecks(H, say, fmt) {
  const V = vsaRules(H.dcat, H.lanes);
  if (!V) return;
  if (!(H.median > 0)) say('err', `${V.label} : chaussées séparées obligatoires — saisissez un terre-plein central (§ 1.5).`);
  if (H.lanes < 2) say('err', `${V.label} : au moins 2 voies par sens (§ 1.5).`);
  if (H.bdg < 0.75 - 1e-6) say('warn', `${V.label} : BDG ${fmt(H.bdg, 2)} m < 0,75 m (1,00 m normalement, § 5.2.1).`);
  if (H.bau < 1 - 1e-6) say('err', `${V.label} : BAU / BDD ${fmt(H.bau, 2)} m < 1,00 m (§ 5.3.2).`);
  else if (H.bau < 2.5 - 1e-6) say('info', `${V.label} : BDD de ${fmt(H.bau, 2)} m (sans BAU) — la BAU de 2,50 m est la règle (§ 5.3.2).`);
  if (H.berme < 0.75 - 1e-6) say('warn', `${V.label} : berme ${fmt(H.berme, 2)} m < 0,75 m (§ 5.3.3).`);
}
