// Réponses aux questions « Échangeurs » de la grille CSPR (contrôle de sécurité des projets routiers, conception
// détaillée, VRU type A, 9 juillet 2010) pour chaque bretelle du projet, à partir de la géométrie calculée
// (echangeur.js), des profils en long (axpl.js) et des contrôles déjà émis. Points de référence : guide « Les
// échangeurs sur routes de type Autoroute » (Cerema, version corrigée mai 2015), § 2.3.1 — S.0 / E.0 (pointe peinte),
// S.1,00 / E.1,00, S.5,00 / E.4,00 sur la droite d'obliquité.
//
// Réponses : 'Oui' (conforme), 'Non' (non conforme ou à reprendre), 'NV' (non vérifiable par le logiciel : à apprécier
// sur le terrain ou sur plan), 'SO' (sans objet). Le constat cite les valeurs utilisées.
import { hostKey, CROSSFALL, axisPlChecks } from './axpl.js';

const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : '—');

// Distance d'arrêt (temps de réaction 2 s, coefficient de frottement longitudinal γ de l'ARP : 0,46 à 50 km/h,
// −0,02 par 10 km/h jusqu'à 0,30 à 130 km/h).
export function stopDist(V) {
  const v = V / 3.6, g = Math.max(0.3, Math.min(0.46, 0.46 - ((V - 50) / 10) * 0.02));
  return 2 * v + (v * v) / (2 * 9.81 * g);
}

// Visibilité verticale sur un profil en long : œil h0 au-dessus de la chaussée en s0, objet h1 en s1 ; renvoie le
// défaut de dégagement le plus fort (m, > 0 : masqué) et son abscisse.
export function sightGap(zAt, s0, s1, h0, h1, step = 1) {
  const z0 = zAt(s0) + h0, z1 = zAt(s1) + h1, L = s1 - s0, n = Math.max(2, Math.ceil(Math.abs(L) / step));
  let worst = -Infinity, at = s0;
  for (let i = 1; i < n; i++) {
    const s = s0 + (L * i) / n, line = z0 + ((z1 - z0) * i) / n, d = zAt(s) - line;
    if (d > worst) { worst = d; at = s; }
  }
  return { gap: worst, s: at };
}

// rows : [{ code, q, ramp, ans, note }]
export function csprEchangeurs({ prj, D, axes = [], axpl = null }) {
  const rows = [], byKey = new Map(axes.map((a) => [a.key, a]));
  const issues = D?.echIssues || [];
  for (const R of D?.ramps || []) {
    if (!R?.al) continue;
    const r = (prj.ramps || [])[R.idx] || (prj.ramps || []).find((q) => q.id === R.id), rp = R.rp, name = R.name, cs = R.cspr || {};
    const add = (code, q, ans, note) => rows.push({ code, q, ramp: name, ans, note });
    const own = (re) => R.issues.filter((i) => i.lvl !== 'info' && re.test(i.msg));
    const others = (re) => issues.filter((i) => i.lvl !== 'info' && !i.msg.startsWith(name + ' :') && i.msg.includes(name) && re.test(i.msg));
    const verdict = (bad, okNote) => (bad.length ? ['Non', bad.map((i) => i.msg).join(' ')] : ['Oui', okNote]);
    const ax = byKey.get(`r:${R.id}`), A = axpl?.get?.(`r:${R.id}`), PLok = !!A?.defined;
    // écart du profil en long de la bretelle au plan de la chaussée hôte (dévers 2,5 % compté depuis son axe)
    const hostDev = (ref, a, b) => {
      const hk = hostKey(prj, ref), H = hk && axpl?.get?.(hk), hax = hk && byKey.get(hk);
      if (!PLok || !H?.defined || !hax || !ax || !(b > a)) return null;
      const zh = (s) => { const pr = hax.project(ax.at(Math.min(ax.len, s)).p); return pr ? H.PL.zAt(Math.max(0, Math.min(hax.len, pr.s))) - CROSSFALL * Math.abs(pr.off) : null; };
      let worst = 0, at = a;
      for (let s = a; s <= b + 1e-9; s += Math.max(0.5, (b - a) / 200)) {
        const z = zh(s); if (z == null) continue;
        const d = A.PL.zAt(s) - z;
        if (Math.abs(d) > Math.abs(worst)) { worst = d; at = s; }
      }
      return { worst, at, zA: zh(a), zB: zh(b) };
    };
    const curveRe = /^(PI |boucle|enchaînement|alignement droit de|sortie en boucle)/;
    const c0 = R.curves?.[0], cN = R.curves?.[R.curves.length - 1];

    // ---- Sortie (divergent) --------------------------------------------------------------------------
    if (rp.from && R.Fs) {
      const e = rp.from;
      {
        const bad = others(/S\.1,00|tpl de|musoir|Z = |enchaînement|sortie/i).concat(own(/tpl de .* début du biseau|biseau commence/));
        add('EC1', 'La sortie est-elle bien distincte des accès voisins ?', ...verdict(bad, 'Aucun conflit d\'enchaînement ni d\'entrecroisement relevé avec les accès voisins (§ 7.3).'));
      }
      add('EC2', 'La géométrie de la sortie est-elle conforme au guide ?', ...verdict(own(/déboîtement|obliquité de sortie|biseau|Lm =|point d'accès|S\.1,00 à l'abscisse/),
        `Biseau ${fmt(e.biseau, 0)} m, obliquité ${fmt(e.p * 100, 2)} %, tpl ${fmt(e.tpl, 2)} m, Lm ${fmt(e.Lm, 1)} m (§ 4.1, 6.1)${cs.lbS ? `. Marquage : lb = L/6 + l2 = ${fmt(cs.lbS.L6, 2)} + ${fmt(cs.lbS.l2, 2)} = ${fmt(cs.lbS.lb, 2)} m avant S.1,00 (L = ${cs.lbS.L} m à ${cs.lbS.V} km/h)` : ''}.`));
      add('EC4', 'Le panneau D30 et le musoir sont-ils visibles simultanément ?', 'NV', 'Implantation de la signalisation de direction : à vérifier sur le plan de signalisation.');
      {
        const okL = R.lad + 1e-6 >= e.Lm, okP = e.p <= 0.05 + 1e-9;
        add('EC6', 'Les règles d\'obliquité sont-elles respectées à partir de S.1,00 ?', okL && okP ? 'Oui' : 'Non',
          `Alignement droit depuis S.1,00 : ${fmt(R.lad, 1)} m ${okL ? '≥' : '<'} Lm ${fmt(e.Lm, 1)} m ; obliquité ${fmt(e.p * 100, 2)} %${okP ? '' : ' > 5 %'} (§ 6.1). S.0 → S.1,00 = ${fmt(cs.s1, 1)} m${Number.isFinite(cs.s5) ? `, S.1,00 → S.5,00 = ${fmt(cs.s5 - cs.s1, 1)} m` : ''}.`);
      }
      if (R.Ld != null) add('EC7', 'La zone de décélération à partir de S.1,00 est-elle suffisante ?', R.Ld <= R.Ldisp + 1e-6 ? 'Oui' : 'Non',
        `Ld = ${fmt(R.Ld, 1)} m (${R.Vs} → ${fmt(R.VR, 0)} km/h, déclivité ${fmt(+rp.pente || 0, 1)} %) ; disponible ${fmt(R.Ldisp, 1)} m jusqu'au début de l'arc (§ 3.2.5).`);
      else add('EC7', 'La zone de décélération à partir de S.1,00 est-elle suffisante ?', 'SO', 'Pas de courbe sur la bretelle.');
      if (!Number.isFinite(cs.s5)) add('EC8', 'Le profil en long de la bretelle est-il déduit de la chaussée émettrice jusqu\'à S.5,00 ?', 'Non', `S.5,00 non atteint en alignement droit (${fmt(R.lad, 1)} m depuis S.1,00 < ${fmt(4 / e.p, 1)} m).`);
      else {
        const d = hostDev(r?.from?.ref, 0, cs.s5);
        add('EC8', 'Le profil en long de la bretelle est-il déduit de la chaussée émettrice jusqu\'à S.5,00 ?', d == null ? 'NV' : Math.abs(d.worst) <= 0.05 ? 'Oui' : 'Non',
          d == null ? 'Profil en long de la bretelle ou de la chaussée hôte non défini.' : `S.5,00 à ${fmt(cs.s5, 1)} m de S.0 ; écart maximal au plan de la chaussée émettrice ${fmt(d.worst * 100, 0)} cm à s = ${fmt(d.at, 0)} m (tolérance 5 cm).${Math.abs(d.worst) > 0.05 && d.zB != null ? ` Caler un point du profil en long à s = ${fmt(cs.s5, 1)} m, z = ${fmt(d.zB, 3)} m.` : ''}`);
      }
      if (c0) {
        const Rr = R.rIn(c0.R), dev = Rr < R.C.Rdn;
        if (!dev) add('EC9', 'Le dévers est-il porté de 2,5 % à sa valeur avant le premier arc déversé ?', 'SO', `Première courbe Ri = ${fmt(Rr, 0)} m ≥ Rdn = ${R.C.Rdn} m : dévers normal.`);
        else add('EC9', 'Le dévers est-il porté de 2,5 % à sa valeur avant le premier arc déversé ?', c0.L1 > 0.5 ? 'Oui' : 'Non',
          c0.L1 > 0.5 ? `Variation de dévers sur la clothoïde d'entrée L = ${fmt(c0.L1, 1)} m, entièrement avant l'arc Ri = ${fmt(Rr, 0)} m (§ 3.2.3, 3.5).` : `Arc déversé Ri = ${fmt(Rr, 0)} m sans clothoïde d'entrée.`);
      }
      {
        const sD = c0 ? R.lad : null, Ld = R.Ld;
        if (sD == null) add('EC39', 'Depuis S.1,00, l\'origine de la première courbe est-elle visible à au moins la distance de décélération ?', 'SO', 'Pas de courbe sur la bretelle.');
        else {
          const sS1 = cs.s1, sC = R.ref?.sRef ? R.ref.sRef(sD) : sS1 + sD, g = PLok ? sightGap((s) => A.PL.zAt(s), sS1, sC, 1.0, 0) : null;
          const okD = Ld == null || sD + 1e-6 >= Ld, okV = !g || g.gap <= 0;
          add('EC39', 'Depuis S.1,00, l\'origine de la première courbe est-elle visible à au moins la distance de décélération ?', okD && okV ? (g ? 'Oui' : 'NV') : 'Non',
            `Origine de la courbe à ${fmt(sD, 1)} m de S.1,00 en alignement droit${Ld != null ? ` (Ld = ${fmt(Ld, 1)} m)` : ''} ; ${g ? (okV ? 'visibilité verticale assurée (œil 1,00 m, objet 0 m)' : `masquée par le profil en long à s = ${fmt(g.s, 0)} m (${fmt(g.gap * 100, 0)} cm)`) : 'profil en long non défini'} ; masques latéraux à vérifier.`);
        }
      }
    }

    // ---- Tracé en plan et profil en long de la bretelle -----------------------------------------------
    {
      const bad = R.issues.filter((i) => i.lvl === 'err' && curveRe.test(i.msg));
      add('EC10', 'Le tracé en plan est-il adapté à la vitesse ?', ...verdict(bad, (R.curves || []).length
        ? `Courbes : ${R.curves.map((c) => `Ri ${fmt(R.rIn(c.R), 0)} m`).join(', ')} ≥ Rm = ${R.C.Rm} m (${R.C.label}, tab. 3-1).` : 'Bretelle sans courbe.'));
      const bad2 = R.issues.filter((i) => i.lvl === 'warn' && curveRe.test(i.msg));
      add('EC11', 'L\'enchaînement et le dimensionnement des courbes (clothoïdes, surlargeurs) sont-ils corrects ?', ...verdict(bad2, 'Rapports de rayons, alignements entre courbes, clothoïdes et surlargeurs conformes (§ 3.2.2, 3.2.3, 3.4.2).'));
      if (!PLok) add('EC15', 'Le profil en long de la bretelle est-il correct (déclivités, raccordements) ?', 'NV', 'Profil en long non défini.');
      else {
        const bad3 = axisPlChecks(prj, A).filter((i) => i.lvl !== 'info');
        const g = A.PL.segs?.length ? Math.max(...A.PL.segs.map((q) => Math.abs(q.g))) * 100 : 0;
        add('EC15', 'Le profil en long de la bretelle est-il correct (déclivités, raccordements) ?', ...verdict(bad3, `Déclivité maximale ${fmt(g, 2)} %, ${A.PL.curves?.length || 0} raccordement(s) parabolique(s).`));
      }
    }

    // ---- Entrée (convergent) ----------------------------------------------------------------------------
    if (rp.to && R.Ft) {
      const e = rp.to;
      if (!Number.isFinite(cs.e4)) add('EC19', 'Le profil en long de la bretelle est-il déduit de la chaussée réceptrice à partir de E.4,00 ?', 'Non', `E.4,00 non atteint en alignement droit (${fmt(R.ladE, 1)} m jusqu'à E.1,00 < ${fmt(3 / e.p, 1)} m).`);
      else {
        const d = hostDev(r?.to?.ref, cs.e4, ax?.len ?? R.ref?.len ?? cs.e0);
        add('EC19', 'Le profil en long de la bretelle est-il déduit de la chaussée réceptrice à partir de E.4,00 ?', d == null ? 'NV' : Math.abs(d.worst) <= 0.05 ? 'Oui' : 'Non',
          d == null ? 'Profil en long de la bretelle ou de la chaussée hôte non défini.' : `E.4,00 à ${fmt(cs.e0 - cs.e4, 1)} m de E.0 ; écart maximal au plan de la chaussée réceptrice ${fmt(d.worst * 100, 0)} cm à s = ${fmt(d.at, 0)} m (tolérance 5 cm).${Math.abs(d.worst) > 0.05 && d.zA != null ? ` Caler un point du profil en long à s = ${fmt(cs.e4, 1)} m, z = ${fmt(d.zA, 3)} m.` : ''}`);
      }
      if (cN) {
        const Rr = R.rIn(cN.R), dev = Rr < R.C.Rdn;
        if (dev) add('EC23', 'Le dévers est-il ramené à 2,5 % après le dernier arc déversé, avant la zone d\'obliquité ?', cN.L2 > 0.5 ? 'Oui' : 'Non',
          cN.L2 > 0.5 ? `Variation de dévers sur la clothoïde de sortie L = ${fmt(cN.L2, 1)} m (Ri = ${fmt(Rr, 0)} m).` : `Arc déversé Ri = ${fmt(Rr, 0)} m sans clothoïde de sortie.`);
      }
      {
        const okL = R.ladE + 1e-6 >= e.Lm, okP = e.p >= 0.03 - 1e-9 && e.p <= 0.05 + 1e-9;
        add('EC34', 'Les règles d\'obliquité sont-elles respectées à partir de E.1,00 ?', okL && okP ? 'Oui' : 'Non',
          `Alignement droit jusqu'à E.1,00 : ${fmt(R.ladE, 1)} m ${okL ? '≥' : '<'} Lm ${fmt(e.Lm, 1)} m ; obliquité ${fmt(e.p * 100, 2)} %${okP ? '' : ' hors de 3 à 5 %'} (§ 6.1). E.1,00 → E.0 = ${fmt(cs.e0 - cs.e1, 1)} m${Number.isFinite(cs.e4) ? `, E.4,00 → E.1,00 = ${fmt(cs.e1 - cs.e4, 1)} m` : ''}.`);
      }
      add('EC36', 'La géométrie de l\'entrée est-elle conforme au guide ?', ...verdict(own(/voie d'insertion|biseau d'insertion|obliquité d'entrée|zone d'accélération|insertion dépasse|fin de l'insertion/),
        `Voie d'insertion ${fmt(e.ins, 0)} m + biseau ${fmt(e.biseau, 0)} m, obliquité ${fmt(e.p * 100, 2)} %${R.La != null ? `, La = ${fmt(R.La, 1)} m ≤ ${fmt(R.Ladisp, 1)} m disponibles` : ''} (§ 3.2.5, 5)${cs.lbE ? `. Marquage : lb = ${cs.lbE.L6 >= cs.lbE.l1 ? `L/6 + l2 = ${fmt(cs.lbE.L6, 2)}` : `l1 + l2 = ${fmt(cs.lbE.l1, 2)}`} + ${fmt(cs.lbE.l2, 2)} = ${fmt(cs.lbE.lb, 2)} m après E.1,00 (L = ${cs.lbE.L} m à ${cs.lbE.V} km/h)` : ''}.`));
      {
        const hk = hostKey(prj, r?.to?.ref), H = hk && axpl?.get?.(hk), hax = hk && byKey.get(hk), V = +e.host?.V || 70, d = stopDist(V);
        let ans = 'NV', note = `Distance d'arrêt sur la chaussée réceptrice : ${fmt(d, 0)} m à ${fmt(V, 0)} km/h (tr 2 s).`;
        const pr = hax && hax.project(R.Ft.S1);
        if (H?.defined && pr) {
          const sd = R.hT?.kind === 'hwy' ? R.hT.sd || 1 : 1, sE = pr.s, sU = sE - sd * d;
          if (sU < 0 || sU > hax.len) note += ` Profil de ${hax.name} trop court en amont de E.1,00 pour conclure.`;
          else {
            const g = sightGap((s) => H.PL.zAt(Math.max(0, Math.min(hax.len, s))), sU, sE, 1.0, 1.0);
            ans = g.gap <= 0 ? 'Oui' : 'Non';
            note += g.gap <= 0 ? ' Visibilité verticale assurée (œil et objet 1,00 m) ; masques latéraux à vérifier.' : ` Masqué par le profil en long de ${hax.name} à s = ${fmt(g.s, 0)} m (${fmt(g.gap * 100, 0)} cm).`;
          }
        } else note += ' Profil en long de la chaussée réceptrice non défini.';
        add('EC40', 'Un véhicule entrant en E.1,00 est-il visible à la distance d\'arrêt ?', ans, note);
      }
    }

    // ---- Entrecroisements ---------------------------------------------------------------------------------
    {
      const wv = issues.filter((i) => i.msg.includes(name) && /\(E\.1,00\) →|\(S\.1,00\)/.test(i.msg) && /Z = |musoir|entrecroisement/.test(i.msg));
      if (wv.length) {
        const bad = wv.filter((i) => i.lvl !== 'info');
        add('EC47', 'Les longueurs d\'entrecroisement sont-elles suffisantes ?', bad.length ? 'Non' : 'Oui', wv.map((i) => i.msg).join(' '));
      }
    }
  }
  // ordre de la grille dans chaque bretelle
  const ord = new Map(); rows.forEach((q) => { if (!ord.has(q.ramp)) ord.set(q.ramp, ord.size); });
  return rows.sort((a, b) => ord.get(a.ramp) - ord.get(b.ramp) || +a.code.slice(2) - +b.code.slice(2));
}
