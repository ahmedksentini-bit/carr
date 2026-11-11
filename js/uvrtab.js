// uvrtab.js — onglet « Vitesses / UVR » : déclencheurs UVR et plan de gestion des vitesses des axes du projet
// (Guide M1 ESCWA/UNRSF, moteur js/uvr.js), sur le modèle de l'onglet Hydrologie (axes cochés, détection le long des
// tracés, tableau des résultats, dessin sur le plan, note imprimable). Sources des déclencheurs : OpenStreetMap
// (Overpass), calques KMZ / KML du projet (nom du repère ou de son dossier), saisie sur le plan.
import { registerIcon } from './signicons.js';
import { MANUAL, SIGN_CHOICES, REFS, M1_BASES, R4L_BASES, UVR_TYPES, TYPE_KEYS, CATS, uvrOpts, defaultUvrOpts, baseCatOf, analyzeAxis, detectBuilt, overpassBBoxOf, overpassPoiQL, overpassBldQL, parseOverpass, classifyName, BUILT_RE, speedSvg, rowsCsv, treatCsv, fmtPK, V0_PROFILES } from './uvr.js';

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];

for (const [k, T] of Object.entries(UVR_TYPES)) registerIcon(`UVR:${k}`, () => `<circle cx="32" cy="32" r="28" fill="${T.color}" stroke="#ffffff" stroke-width="4"/><text x="32" y="40" font-family="Arial, sans-serif" font-weight="bold" font-size="22" fill="#ffffff" text-anchor="middle">${T.short}</text>`);

export function initUvr(api) {
  const { S, $, toast, update, listAxes, viewer, setTool, esc, fmt, parseNum, download, fname, G } = api;
  const cfg = () => {
    const u = (S.prj.uvr = S.prj.uvr || {});
    u.opts = uvrOpts(u.opts); u.trg = u.trg || []; u.trav = u.trav || {}; u.axes = u.axes || {}; u.built = u.built || { polys: [], bld: [] }; u.edits = u.edits || {};
    return u;
  };
  const allAxes = () => (S.prof?.axes || (S.D ? listAxes(S.prj, S.D) : []));
  const axOn = (u, ax) => u.axes[ax.key]?.on ?? (ax.key === 'hwy' || ax.key.startsWith('x:'));
  const bKey = (u) => (u.opts.ref === 'R4L' ? 'baseR' : 'base');
  const axBase = (u, ax) => { const b = u.axes[ax.key]?.[bKey(u)]; return (u.opts.ref === 'R4L' ? R4L_BASES : M1_BASES).includes(b) ? b : baseCatOf(ax, u.opts.ref); };
  // centres des carrefours (actif et autres) à moins de 40 m de l'axe : abscisses des zones d'approche à 50 km/h
  const junctionsOn = (ax) => { const O = [S.D?.branches?.length ? S.D.O : null, ...(S.Do || []).map((o) => (o.D?.branches?.length ? o.D.O : null))].filter((p) => p && isFinite(p.x)); const out = []; for (const p of O) { const pr = ax.project(p); if (pr && Math.abs(pr.off) <= 40) out.push(pr.s); } return out; };
  const geo = () => !!S.crs?.geo;
  const xyOf = (t) => { if (t.lon != null && geo()) { const q = S.crs.fromLL(t.lon, t.lat); return { x: q.x, y: q.y }; } return { x: +t.x, y: +t.y }; };
  const ringXY = (r) => (geo() && r?.length ? r.map(([lon, lat]) => { const q = S.crs.fromLL(lon, lat); return { x: q.x, y: q.y }; }) : null);
  const uid = () => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const used = () => { const u = S.prj.uvr; return !!u && (u.trg?.length || Object.values(u.trav || {}).some((a) => a.length) || u.run); };
  const edOf = (u, k) => (u.edits[k] = u.edits[k] || { del: [], mv: {}, sign: {}, add: [] });

  // ---------------------------------------------------------------- calcul
  function compute() {
    S.uvr = null; S.uvrHits = [];
    if (!S.D || !used()) return;
    const u = cfg(), axes = allAxes().filter((ax) => axOn(u, ax));
    if (!axes.length) return;
    const trg = u.trg.filter((t) => t.on !== false).map((t) => { const p = xyOf(t); const ring = t.ring ? ringXY(t.ring) : null; return { ...t, ...p, ring }; }).filter((t) => isFinite(t.x) && isFinite(t.y));
    const res = [];
    for (const ax of axes) {
      const A = S.axpl?.get?.(ax.key), zAt = A?.defined && A.PL?.zAt ? (s) => A.PL.zAt(s) : null;
      try { res.push(analyzeAxis(ax, { baseCat: axBase(u, ax), trav: u.trav[ax.key] || [], triggers: trg, arterial: !!u.axes[ax.key]?.art, zAt, edits: u.edits[ax.key], junctions: junctionsOn(ax) }, u.opts)); } catch (e) { console.error(e); }
    }
    S.uvr = { res };
    for (const r of res) for (const c of r.checks) S.checks.push({ lvl: c.lvl, group: 'Vitesses / UVR', msg: c.msg });
    if (u.plan !== false) try { draw(res, axes); } catch (e) { console.error(e); }
  }

  // ---------------------------------------------------------------- plan
  function draw(res, axes) {
    S.uvrHits = [];
    const TH = (S.prj.opts?.textH || 0.8) * 1.2, P = (o) => S.D.prims.push(o);
    const u = cfg();
    for (const r of res) {
      const ax = axes.find((a) => a.key === r.key); if (!ax) continue;
      const half = Math.max(3, ax.half || 3.5), off = half + 3;
      const ptAt = (s, o) => { const q = ax.at(s); return G.add(q.p, G.mul(G.rot90(q.t), o)); };
      const line = (s0, s1, o) => { const pts = []; const n = Math.max(2, Math.ceil((s1 - s0) / 5)); for (let i = 0; i <= n; i++) pts.push(ptAt(s0 + ((s1 - s0) * i) / n, o)); return pts.slice(1).map((p, i) => G.L(pts[i], p)); };
      const ang = (s) => { const t = ax.at(s).t; let a = Math.atan2(t.y, t.x); if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI; return a; };
      // bandes des catégories des deux côtés, étiquettes « B · 80 km/h »
      for (const g of r.segs) {
        if (g.s1 - g.s0 < 1) continue;
        for (const sd of [1, -1]) P({ k: 'path', L: 'UVR', segs: line(g.s0, g.s1, sd * off), color: CATS[g.cat].color, wm: 0.9 });
        const step = Math.max(150, Math.min(600, g.len / 2));
        for (let s = g.s0 + Math.min(g.len / 2, step / 2); s < g.s1; s += step) P({ k: 'text', L: 'UVR', p: ptAt(s, off + TH * 3), s: `${CATS[g.cat].r4l ? CATS[g.cat].short : `Cat. ${g.cat}`} · ${g.v} km/h`, rot: ang(s), align: 'center', h: TH * 2.5, color: CATS[g.cat].color });
      }
      // aménagements
      const across = (s, o0, o1) => [G.L(ptAt(s, o0), ptAt(s, o1))];
      for (const q of r.treat) {
        if (q.list || q.code === 'lineaire' || q.code === 'prescr') continue;
        const s = q.s, w = half + 0.5;
        const poly = (pts) => pts.map((p, i) => G.L(p, pts[(i + 1) % pts.length]));
        const band = (a, b, o0, o1) => { const n = Math.max(1, Math.ceil((b - a) / 2)), L = [], R = []; for (let i = 0; i <= n; i++) { const x = a + ((b - a) * i) / n; L.push(ptAt(x, o0)); R.push(ptAt(x, o1)); } return poly([...L, ...R.reverse()]); };
        const fillPoly = (segs, color) => { P({ k: 'fill', L: 'UVR', rings: [segs], color }); P({ k: 'path', L: 'UVR', role: 'am', closed: true, segs }); };
        const cl = (v) => Math.max(0, Math.min(r.len, v));
        const half2 = q.dir === 1 ? [-w, 0] : q.dir === -1 ? [0, w] : [-w, w];
        if (q.code === 'bandes') { for (const d of [-0.3, 0, 0.3]) P({ k: 'path', L: 'UVR', role: 'am', segs: across(cl(s + d), half2[0], half2[1]) }); }
        else if (q.code === 'portail') { // îlot central 2 × 10 m (rempli) et ligne du portail
          const s1 = cl(s - q.dir * 10);
          fillPoly(band(Math.min(s, s1), Math.max(s, s1), 1, -1), 'rgba(250,204,21,0.55)');
          P({ k: 'path', L: 'UVR', role: 'am', segs: across(s, -w, w) });
        } else if (q.code === 'plateau') { // plateau de 4 m (rempli) et rampes de 1,5 m de part et d'autre
          fillPoly(band(cl(s - 2), cl(s + 2), w, -w), 'rgba(234,88,12,0.45)');
          for (const d of [-3.5, 3.5]) P({ k: 'path', L: 'UVR', role: 'am', dash: [0.6, 0.4], segs: across(cl(s + d), -w, w) });
        } else if (q.code === 'passage' || q.code === 'feux') { // zébra : bandes de 0,5 m parallèles à l'axe sur 2,5 m
          for (let o = -w + 0.25; o < w - 0.2; o += 1.0) fillPoly(band(cl(s - 1.25), cl(s + 1.25), o, o + 0.5), 'rgba(255,255,255,0.9)');
        } else if (q.code === 'chicane') { // deux îlots décalés (2 m de saillie sur 10 m), de part et d'autre
          fillPoly(poly([ptAt(cl(s - 12), w), ptAt(cl(s - 7), w - 2), ptAt(cl(s - 3), w - 2), ptAt(cl(s), w)]), 'rgba(22,163,74,0.55)');
          fillPoly(poly([ptAt(cl(s), -w), ptAt(cl(s + 3), -w + 2), ptAt(cl(s + 7), -w + 2), ptAt(cl(s + 12), -w)]), 'rgba(22,163,74,0.55)');
        } else P({ k: 'path', L: 'UVR', role: 'am', segs: across(s, half2[0], half2[1]) });
        // étiquette courte au bord de la chaussée, côté du sens concerné
        const LBL = { feux: 'Feux', radar: 'Radar', pmv: '30 heures scol.', bandes: 'Bandes ×3', portail: 'Portail', plateau: 'Plateau', passage: 'Passage', chicane: 'Chicane', zone30: 'Zone 30', rappel30: 'Rappel 30', annonce: 'Annonce', retrec: 'Rétréciss.', limite: 'Limitation', sortie: 'Sortie', cloture: 'Clôture' };
        const lp = ptAt(s, (q.dir === -1 ? 1 : -1) * (w + 2.2));
        if (LBL[q.code]) P({ k: 'text', L: 'UVR', p: lp, s: LBL[q.code], rot: ang(s), align: 'center', h: TH * 1.3, color: '#fbbf24' });
        // points de sélection : l'étiquette (au bord, hors des poignées de l'axe) et le symbole sur la chaussée
        for (const hp of [lp, ptAt(s, (q.dir === -1 ? 1 : -1) * w * 0.5)]) (S.uvrHits = S.uvrHits || []).push({ key: q.key, ax: r.key, p: hp, label: q.label });
        // panneau : à droite du sens concerné (les deux côtés si le dispositif vaut pour les deux sens)
        if (q.sign) for (const sd of q.dir === 1 ? [-1] : q.dir === -1 ? [1] : [-1, 1]) {
          const t = ax.at(s).t, n = G.rot90(t), out = G.mul(n, sd);
          P({ k: 'sign', L: 'UVR', p: ptAt(s, sd * (half + 1)), out, face: G.mul(t, -sd), code: q.sign, w: 1.2, h: TH * 0.7 });
        }
      }
      // déclencheurs : symbole, nom, rattachement à l'axe
      for (const h of r.hits) {
        const T = UVR_TYPES[h.type], c = { x: h.x, y: h.y }, foot = ax.at(h.s).p;
        P({ k: 'sign', L: 'UVR', p: G.sub(c, { x: 0, y: 1.8 }), out: { x: 0, y: 1 }, face: { x: 1, y: 0 }, code: `UVR:${h.type}`, w: 3, h: TH });
        P({ k: 'text', L: 'UVR', p: { x: c.x + 3.5, y: c.y - TH * 0.4 }, s: `${h.name || T.label.split(' /')[0]} · PK ${fmtPK(h.s)}`, rot: 0, align: 'left', h: TH * 1.6, color: T.color });
        if (G.dist(c, foot) > 3) P({ k: 'path', L: 'UVR', role: 'link', segs: [G.L(c, foot)] });
      }
    }
    // déclencheurs non rattachés (à plus de R de tout axe coché)
    const hit = new Set(res.flatMap((r) => r.hits.map((h) => h.id)));
    for (const t of u.trg) {
      if (t.on === false || hit.has(t.id)) continue;
      const c = xyOf(t); if (!isFinite(c.x)) continue;
      P({ k: 'circle', L: 'UVR', c, r: TH * 1.0, color: '#94a3b8', wm: 0.25 });
      P({ k: 'text', L: 'UVR', p: { x: c.x + TH * 1.4, y: c.y - TH * 0.4 }, s: `${UVR_TYPES[t.type]?.short || '?'} hors rayon`, rot: 0, align: 'left', h: TH * 0.75, color: '#94a3b8' });
    }
  }

  // ---------------------------------------------------------------- détection
  function polylineLL(axes, step = 80) {
    return axes.map((ax) => { const out = []; for (let s = 0; s <= ax.len + 1e-6; s += Math.min(step, ax.len)) { const p = ax.at(s).p, ll = S.crs.toLL(p.x, p.y); out.push([ll.lat, ll.lon]); } const p = ax.at(ax.len).p, ll = S.crs.toLL(p.x, p.y); out.push([ll.lat, ll.lon]); return out; });
  }
  // Requête Overpass : chaque serveur à son tour, deux tours (le second après une pause), 75 s au plus par essai.
  async function overpass(q) {
    let last = null;
    for (let round = 0; round < 2; round++) {
      if (round) await new Promise((ok) => setTimeout(ok, 3000));
      for (const url of OVERPASS) {
        const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 75000);
        try {
          const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: ctl.signal });
          if (!r.ok) { last = new Error(`${new URL(url).host} : HTTP ${r.status}`); continue; }
          const j = await r.json();
          if (OVERPASS[0] !== url) OVERPASS.splice(0, OVERPASS.length, url, ...OVERPASS.filter((v) => v !== url)); // le serveur qui a répondu passe en tête
          return j;
        } catch (e) { last = e.name === 'AbortError' ? new Error(`${new URL(url).host} : délai dépassé`) : e; } finally { clearTimeout(tm); }
      }
    }
    throw last || new Error('Overpass indisponible');
  }
  async function fromOsm() {
    const u = cfg(), axes = allAxes().filter((ax) => axOn(u, ax));
    if (!axes.length) { toast('Cochez au moins un axe.', 'warn'); return; }
    if (!geo()) { toast('OpenStreetMap demande un système de coordonnées géoréférencé (onglet Projet).', 'warn'); return; }
    const info = (t) => { const el = $('#uvrInfo'); if (el) el.textContent = t; }, btn = $('#btnUvrOsm');
    if (btn) btn.disabled = true;
    let nT = 0, nB = 0, nP = 0;
    const failed = [], bldFailed = [], step = 80;
    let bldKo = 0;
    const take = (P) => {
      for (const t of P.triggers) if (!u.trg.some((q) => q.osm && q.osm === t.osm)) { u.trg.push({ id: uid(), src: 'OSM', on: true, ...t }); nT++; }
      for (const b of P.built) if (!u.built.polys.some((q) => q.ring[0][0] === b.ring[0][0] && q.ring[0][1] === b.ring[0][1])) { u.built.polys.push({ ...b, src: 'OSM' }); nP++; }
      const seen = new Set(u.built.bld.map((q) => q.join(',')));
      for (const b of P.bld) { const k2 = b.join(','); if (!seen.has(k2)) { seen.add(k2); u.built.bld.push(b); nB++; } }
    };
    // un tronçon dont la requête échoue est coupé en deux et retenté une fois
    const poi = async (pl, depth = 0) => {
      try { take(parseOverpass(await overpass(overpassPoiQL(overpassBBoxOf(pl, u.opts.R))))); return true; }
      catch (e) { if (depth < 1 && pl.length > 3) { const m = Math.floor(pl.length / 2); const a = await poi(pl.slice(0, m + 1), depth + 1), b = await poi(pl.slice(m), depth + 1); return a && b; } console.warn(e); return false; }
    };
    try {
      const polys = polylineLL(axes, step);
      for (let i = 0; i < polys.length; i++) {
        // tronçons d'environ 2 km
        const pl = polys[i], chunk = 25, n = Math.ceil((pl.length - 1) / chunk);
        for (let k = 0, j = 1; k < pl.length - 1; k += chunk, j++) {
          const part = pl.slice(k, k + chunk + 1), s0 = k * step, s1 = Math.min(axes[i].len, (k + chunk) * step);
          info(`OpenStreetMap — ${axes[i].name} : tronçon ${j} / ${n} (PK ${fmtPK(s0)} – ${fmtPK(s1)})…`);
          if (!(await poi(part))) failed.push(`${axes[i].name} ${fmtPK(s0)}–${fmtPK(s1)}`);
          // bâtiments : après trois échecs de suite, on cesse de les demander (les traversées restent à vérifier)
          if (bldKo >= 3) bldFailed.push(`${fmtPK(s0)}–${fmtPK(s1)}`);
          else try { take(parseOverpass(await overpass(overpassBldQL(part, 120)))); bldKo = 0; } catch (e) { console.warn(e); bldKo++; bldFailed.push(`${fmtPK(s0)}–${fmtPK(s1)}`); }
        }
      }
      if (u.built.bld.length > 40000) u.built.bld = u.built.bld.slice(-40000);
      u.run = true;
      const nTr = detectTrav();
      update();
      info(`OSM : ${nT} déclencheur(s), ${nP} zone(s) bâtie(s), ${nB} bâtiment(s) ; ${nTr} traversée(s) de localité détectée(s).${failed.length ? ` Tronçons sans réponse : ${failed.join(', ')}.` : ''}${bldFailed.length ? ` Bâtiments non lus : PK ${bldFailed.join(', ')}.` : ''}`);
      if (failed.length) toast(`OpenStreetMap : ${nT} déclencheur(s) ajouté(s), mais ${failed.length} tronçon(s) sans réponse des serveurs (${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}) — relancez la recherche plus tard : les déclencheurs déjà trouvés sont gardés, sans doublon.`, 'warn');
      else toast(`OpenStreetMap : ${nT} déclencheur(s) UVR ajouté(s), ${nTr} traversée(s) de localité${bldFailed.length ? ` (bâtiments non lus sur ${bldFailed.length} tronçon(s) : traversées à vérifier)` : ''}. Vérifiez la liste (sources OSM incomplètes : confirmation terrain C1.6).`);
    } catch (e) {
      console.error(e); info(`OpenStreetMap indisponible : ${e.message}`);
      toast(`Requête OpenStreetMap impossible (${e.message}) : importez un KMZ ou saisissez les déclencheurs sur le plan.`, 'err');
    } finally { if (btn) btn.disabled = false; }
  }
  function fromKml() {
    const u = cfg(), L = S.kml || [];
    if (!L.length) { toast('Aucun calque KMZ / KML (onglet Projet).', 'warn'); return; }
    let nT = 0, nP = 0, nU = 0;
    for (const lay of L) {
      const fName = (i) => { const out = []; for (; i >= 0; i = lay.folders[i]?.parent ?? -1) out.push(lay.folders[i]?.name || ''); return out.join(' '); };
      for (const f of lay.feats) {
        const folder = fName(f.f), type = classifyName(f.name, folder) || classifyName(folder);
        for (const q of f.parts) {
          if (q.t === 'P') {
            if (!type) { nU++; continue; }
            const lon = q.c[0], lat = q.c[1], key = `kmz:${lay.id}:${lon.toFixed(6)},${lat.toFixed(6)}`;
            if (u.trg.some((t) => t.osm === key)) continue;
            u.trg.push({ id: uid(), src: 'KMZ', on: true, type, name: f.name || '', lon, lat, osm: key }); nT++;
          } else if (q.t === 'A' && q.r?.[0]?.length >= 6) {
            const ring = []; for (let i = 0; i < q.r[0].length; i += 2) ring.push([q.r[0][i], q.r[0][i + 1]]);
            if (BUILT_RE.test(`${f.name || ''} ${folder}`) || type === 'residentiel') { u.built.polys.push({ kind: 'kmz', name: f.name || '', ring, src: 'KMZ' }); nP++; }
            else if (type) { const lon = ring.reduce((a, p) => a + p[0], 0) / ring.length, lat = ring.reduce((a, p) => a + p[1], 0) / ring.length; u.trg.push({ id: uid(), src: 'KMZ', on: true, type, name: f.name || '', lon, lat, ring, osm: `kmz:${lay.id}:${f.name}:${lon.toFixed(5)}` }); nT++; }
          }
        }
      }
    }
    u.run = true;
    const nTr = nP ? detectTrav() : 0;
    update();
    toast(`Calques KMZ : ${nT} déclencheur(s)${nP ? `, ${nP} zone(s) bâtie(s) → ${nTr} traversée(s)` : ''}${nU ? ` ; ${nU} repère(s) non reconnu(s) (nom sans « école », « marché », « mosquée », « arrêt »… )` : ''}.`);
  }
  // Traversées détectées (zones bâties et bâtiments) : remplace les plages « auto » de chaque axe coché.
  function detectTrav() {
    const u = cfg(), axes = allAxes().filter((ax) => axOn(u, ax));
    if (!geo()) return 0;
    const polys = u.built.polys.map((p) => ringXY(p.ring)).filter((r) => r?.length > 2), bld = u.built.bld.map(([lon, lat]) => { const q = S.crs.fromLL(lon, lat); return { x: q.x, y: q.y }; });
    let n = 0;
    for (const ax of axes) {
      const B = detectBuilt(ax, { polys, bld }, u.opts);
      const keep = (u.trav[ax.key] || []).filter((t) => t.src !== 'auto');
      u.trav[ax.key] = [...keep, ...B.map((b) => ({ s0: b.s0, s1: b.s1, on: b.trav, src: 'auto', short: !b.trav }))].sort((a, b) => a.s0 - b.s0);
      n += B.filter((b) => b.trav).length;
    }
    return n;
  }
  // Clic sur le plan (outil « uvrpt ») : déclencheur du type choisi.
  function pick(w) {
    if (S.tool === 'uvram') { // aménagement ajouté à la main au droit du clic, sur l'axe coché le plus proche
      const u = cfg(), axes = allAxes().filter((ax) => axOn(u, ax));
      let best = null; for (const ax of axes) { const pr = ax.project(w); if (pr && (!best || Math.abs(pr.off) < Math.abs(best.pr.off))) best = { ax, pr }; }
      if (!best || Math.abs(best.pr.off) > 60) { toast('Cliquez près d\'un axe coché (à moins de 60 m).', 'warn'); return; }
      const code = S.uvrAm || 'plateau', dir = +(S.uvrAmDir ?? 0), v = +(S.uvrAmV || 50);
      edOf(u, best.ax.key).add.push({ id: uid(), code, dir, s: Math.round(best.pr.s * 10) / 10, ...(code === 'limite' ? { v } : {}) });
      u.run = true; S.uvrAx = best.ax.key; update();
      toast(`${MANUAL[code].name} ajouté(e) sur ${best.ax.name} au PK ${fmtPK(best.pr.s)} (clic droit ou Échap pour terminer).`); return;
    }
    const u = cfg(), type = S.uvrType || 'ecole', t = { id: uid(), src: 'plan', on: true, type, name: '', x: +w.x.toFixed(3), y: +w.y.toFixed(3) };
    if (geo()) { const ll = S.crs.toLL(w.x, w.y); t.lon = +ll.lon.toFixed(7); t.lat = +ll.lat.toFixed(7); }
    u.trg.push(t); u.run = true; update();
    toast(`${UVR_TYPES[type].label} ajouté(e) ; nommez-le dans l'onglet Vitesses / UVR (clic droit ou Échap pour terminer).`);
  }

  // ---------------------------------------------------------------- onglet
  const optRow = (sel, list) => list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`).join('');
  function render() {
    const tab = $('#tab-uvr'); if (!tab || tab.hidden && !S.uvrForce) return;
    const u = cfg(), axes = allAxes(), res = S.uvr?.res || [];
    const o = u.opts;
    const R4 = o.ref === 'R4L';
    $('#uvrParams').innerHTML = `<div class="row"><label class="fld"><span class="lb">Référentiel</span><select data-uvo="ref">${optRow(o.ref, Object.entries(REFS))}</select></label>
      ${R4 ? `<label class="chk" title="R4L § 2.3 (p. 34) : 50 km/h possible dans un pôle d'activité seulement si les usagers vulnérables sont séparés du trafic (trottoirs, traversées sûres)"><input type="checkbox" data-uvo="sep"${o.sep ? ' checked' : ''}> Usagers vulnérables séparés (pôles à 50 km/h)</label>` : ''}
      <label class="chk" title="${R4 ? 'R4L § 2.3 (p. 34–35) : vitesse réduite à 50 km/h aux carrefours' : 'M1 AD 1.3 : vitesse d\'approche ≤ 50 km/h'}"><input type="checkbox" data-uvo="junc"${o.junc ? ' checked' : ''}> Carrefours à 50 km/h sur ±</label><label class="fld"><input data-uvo="juncL" class="mini-in" type="text" size="4" value="${o.juncL}"><span class="un">m</span></label></div>
      ${R4 ? '<p class="note">Roads-for-Life (Guide for Safe Speeds, Banque mondiale / WRI, 2024, § 2.2–2.3, fig. 7–8, p. 28–35) : catégorie de base de chaque axe ci-dessus ; tout générateur d\'usagers vulnérables (école, commerce de bord de route, lieu de culte, arrêt de bus, hameau, village) fait de la section un pôle d\'activité humaine à 30 km/h maximum, hors village comme en traversée.</p>' : ''}<div class="row">
      <label class="fld"><span class="lb">Rayon d'influence</span><input data-uvo="R" type="text" inputmode="decimal" value="${o.R}"><span class="un">m</span></label>
      <label class="fld"><span class="lb">Traversée minimale</span><input data-uvo="travMin" type="text" inputmode="decimal" value="${o.travMin}"><span class="un">m</span></label>
      <label class="fld"><span class="lb">Remontée minimale</span><input data-uvo="gapMin" type="text" inputmode="decimal" value="${o.gapMin}" title="Une zone à vitesse plus élevée plus courte que cette longueur, entre deux zones lentes, est supprimée (pas d'effet « yo-yo »)"><span class="un">m</span></label>
      <label class="fld"><span class="lb">Traversées piétonnes ≤</span><input data-uvo="spacing" type="text" inputmode="decimal" value="${o.spacing}"><span class="un">m</span></label><label class="fld" title="Plateaux / traversées surélevées en zone 30 (cat. E)"><span class="lb">Plateaux (30 km/h) tous les</span><input data-uvo="physE" type="text" inputmode="decimal" value="${o.physE}"><span class="un">m</span></label><label class="fld" title="Chicanes / rétrécissements en cat. D, seulement là où la V85 géométrique dépasse la vitesse-cible + 10"><span class="lb">Chicanes (50 km/h) tous les</span><input data-uvo="physD" type="text" inputmode="decimal" value="${o.physD}"><span class="un">m</span></label>
      <label class="fld"><span class="lb">V85 géométrique (V0)</span><select data-uvo="v0">${optRow(o.v0, [['auto', 'auto (selon l\'axe)'], ...Object.entries(V0_PROFILES).map(([k, l]) => [k, `${k} km/h — ${l}`])])}</select></label>
      <label class="chk"><input type="checkbox" data-uvo="plan"${u.plan !== false ? ' checked' : ''}> Afficher sur le plan</label></div>
      <details${R4 ? ' hidden' : ''}><summary>Vitesses par type de déclencheur (AD 1.2)</summary><table class="pts"><thead><tr><th>Type</th><th>Vitesse-cible</th><th>Hors traversée</th><th>Fiches</th></tr></thead><tbody>${TYPE_KEYS.map((k) => `<tr><td>${esc(UVR_TYPES[k].label)}</td><td><input class="mini-in" data-uvt="${k}" data-f="v" type="text" size="4" value="${o.types[k].v}"> km/h</td><td><label class="chk"><input type="checkbox" data-uvt="${k}" data-f="rural"${o.types[k].rural ? ' checked' : ''}> vitesse appliquée</label></td><td>${esc(UVR_TYPES[k].fiches)}</td></tr>`).join('')}</tbody></table><p class="note">Hors traversée, un type non coché ne fait pas baisser la vitesse : seuls ses aménagements ponctuels sont prescrits (cas de l'arrêt TC du tableau E.4.2).</p></details>`;
    $('#uvrAxes').innerHTML = axes.length ? axes.map((ax) => `<label class="chk"><input type="checkbox" data-uvax="${esc(ax.key)}"${axOn(u, ax) ? ' checked' : ''}> ${esc(ax.name)}</label> <label class="chk" title="TMJA > 3 000 véh/j, > 300 PL/j ou ligne de transport collectif : ni dos d'âne, ni plateau, ni chicane sur la chaussée principale ; traversées à feux, refuges, contrôle automatisé (seuil du décret français n° 94-447, référence de pratique)"><input type="checkbox" data-uvart="${esc(ax.key)}"${u.axes[ax.key]?.art ? ' checked' : ''}> artère à fort trafic</label> <select class="mini-in" data-uvbase="${esc(ax.key)}" title="Catégorie de base de l'axe en rase campagne (AD 1.1)">${optRow(axBase(u, ax), (o.ref === 'R4L' ? R4L_BASES : M1_BASES).map((c) => [c, CATS[c].r4l ? CATS[c].label.replace('R4L — ', '') : `${c} — ${CATS[c].vt} km/h`]))}</select>`).join(' &nbsp; ') : '<span class="note">Aucun axe : dessinez une route, une autoroute ou un carrefour.</span>';
    $('#uvrTypeSel').innerHTML = optRow(S.uvrType || 'ecole', TYPE_KEYS.map((k) => [k, UVR_TYPES[k].label]));
    // déclencheurs
    const hitOf = (t) => { for (const r of res) { const h = r.hits.find((q) => q.id === t.id); if (h) return { r, h }; } return null; };
    $('#uvrTrg').innerHTML = u.trg.length ? `<thead><tr><th></th><th>Type</th><th>Nom</th><th>Source</th><th>Axe</th><th>PK</th><th>Distance</th><th></th></tr></thead><tbody>${u.trg.map((t, i) => { const q = hitOf(t); return `<tr data-uvrow="${i}" class="${S.uvrSel === t.id ? 'on' : ''}"><td><input type="checkbox" data-uvon="${i}"${t.on !== false ? ' checked' : ''} title="Retenu"></td><td><select class="mini-in" data-uvtype="${i}">${optRow(t.type, TYPE_KEYS.map((k) => [k, UVR_TYPES[k].label.split(' /')[0]]))}</select></td><td><input class="mini-in" data-uvname="${i}" type="text" size="16" value="${esc(t.name || '')}"></td><td>${esc(t.src || '')}</td><td>${q ? esc(q.r.name) : '<span class="note">hors rayon</span>'}</td><td class="mono">${q ? fmtPK(q.h.s) : '—'}</td><td class="mono">${q ? `${fmt(Math.abs(q.h.off), 0)} m ${q.h.off > 0 ? 'G' : 'D'}` : '—'}</td><td><button class="mini danger" data-uvdel="${i}" title="Supprimer">✕</button></td></tr>`; }).join('')}</tbody>` : '<tbody><tr><td class="note">Aucun déclencheur : interrogez OpenStreetMap, importez les calques KMZ ou ajoutez-les sur le plan.</td></tr></tbody>';
    // traversées
    const tv = axes.filter((ax) => axOn(u, ax));
    $('#uvrTrav').innerHTML = tv.map((ax) => `<tr><th colspan="5">${esc(ax.name)} <button class="mini" data-uvtadd="${esc(ax.key)}" title="Ajouter une traversée (PK début et fin à saisir)">+ traversée</button></th></tr>` + (u.trav[ax.key] || []).map((t, i) => `<tr><td><input type="checkbox" data-uvtron="${esc(ax.key)}|${i}"${t.on !== false ? ' checked' : ''}></td><td>du PK <input class="mini-in" data-uvtr="${esc(ax.key)}|${i}|s0" type="text" size="7" value="${Math.round(t.s0)}"> au PK <input class="mini-in" data-uvtr="${esc(ax.key)}|${i}|s1" type="text" size="7" value="${Math.round(t.s1)}"> m</td><td class="mono">${fmt(t.s1 - t.s0, 0)} m</td><td>${t.src === 'auto' ? `détectée${t.short ? ` — < ${o.travMin} m : non classée (zone résidentielle dense ?)` : ''}` : 'saisie'}</td><td><button class="mini danger" data-uvtrdel="${esc(ax.key)}|${i}">✕</button></td></tr>`).join('')).join('') || '<tr><td class="note">Cochez un axe.</td></tr>';
    // résultats
    if (!res.length) { $('#uvrOut').innerHTML = '<p class="note">Les résultats (profil des vitesses, tableau E.4.2, aménagements) s\'affichent dès qu\'un déclencheur ou une traversée est saisi.</p>'; return; }
    const k = res.find((r) => r.key === S.uvrAx) ? S.uvrAx : res[0].key, r = res.find((q) => q.key === k);
    const W = Math.max(420, Math.min(1400, ($('#tab-uvr').clientWidth || 900) - 16));
    $('#uvrOut').innerHTML = `<div class="row"><label class="fld"><span class="lb">Axe</span><select id="uvrAxSel">${optRow(k, res.map((q) => [q.key, q.name]))}</select></label><span class="note">Catégorie de base ${r.baseCat} · V85 géométrique avec V0 = ${r.V0} km/h${S.axpl?.get?.(r.key)?.defined ? ' (rampes du profil en long comprises)' : ' (sans profil en long)'} · largeur roulable ${fmt(r.width, 1)} m</span></div>
      <div class="uvr-chart" style="overflow-x:auto">${speedSvg(r, { width: W })}</div>
      <h4>Plan de gestion des vitesses — tableau linéaire (E.4.2)</h4>
      <div class="tablewrap"><table class="pts"><thead><tr><th>PK début</th><th>PK fin</th><th>Cat.</th><th>Vitesse-cible</th><th>VC</th><th>Déclencheurs UVR</th><th>Dispositifs de modération</th></tr></thead><tbody>${r.rows.map((q) => `<tr${q.trans ? ' class="note"' : ''}><td class="mono">${fmtPK(q.s0)}</td><td class="mono">${fmtPK(q.s1)}</td><td>${esc(q.cat)}</td><td>${esc(q.vt)}</td><td>${esc(q.vc)}</td><td>${esc(q.trig)}</td><td>${esc(q.disp)}</td></tr>`).join('')}</tbody></table></div>
      <h4>Aménagements (${r.treat.filter((q) => q.lvl === 'MUST').length} obligatoires, ${r.treat.filter((q) => q.lvl === 'SHOULD').length} recommandés) — modifiables</h4>
      <p class="note">PK et panneau modifiables ligne par ligne, ✕ pour supprimer ; les retouches sont gardées quand le calcul est refait (rattachées à l'aménagement proposé le plus proche, à 15 m près).</p>
      <div class="row"><select id="uvrAmCode" class="mini-in">${optRow(S.uvrAm || 'plateau', Object.entries(MANUAL).map(([k, c]) => [k, c.name]))}</select>
        <select id="uvrAmDir" class="mini-in">${optRow(S.uvrAmDir ?? 0, [[0, 'deux sens'], [1, 'sens PK croissants'], [-1, 'sens PK décroissants']])}</select>
        <label class="fld" title="Pour une limitation de vitesse"><span class="lb">V</span><input id="uvrAmV" class="mini-in" type="text" size="3" value="${S.uvrAmV || 50}"><span class="un">km/h</span></label>
        <label class="fld"><span class="lb">PK</span><input id="uvrAmS" class="mini-in" type="text" size="7" placeholder="m"></label>
        <button id="btnUvrAmAdd" title="Ajoute l'aménagement au PK saisi">Ajouter</button><button id="btnUvrAmPlan" title="Ajoute l'aménagement au droit de chaque clic sur le plan">Ajouter sur le plan</button>
        ${(() => { const e = u.edits[r.key]; const n = e ? e.del.length + Object.keys(e.mv).length + Object.keys(e.sign).length + e.add.length : 0; return n ? `<button id="btnUvrAmReset" class="danger" title="Supprime toutes les retouches de cet axe">Rétablir la proposition (${n} retouche${n > 1 ? 's' : ''})</button>` : ''; })()}</div>
      <div class="tablewrap"><table class="pts"><thead><tr><th>PK</th><th>Sens</th><th>Aménagement</th><th>Panneau</th><th>Niveau</th><th>Fiche M1</th><th></th></tr></thead><tbody>${r.treat.map((q) => `<tr data-uvs="${q.s.toFixed(1)}"${q.manual || q.moved || q.signEdited ? ' class="on"' : ''}><td>${q.list || q.code === 'lineaire' ? `<span class="mono">${fmtPK(q.s)}</span>` : `<input class="mini-in" data-uvmv="${esc(q.key)}" type="text" size="6" value="${Math.round(q.s)}" title="PK en m">`}</td><td>${q.dir === 1 ? '→' : q.dir === -1 ? '←' : '⇄'}</td><td>${esc(q.label)}${q.moved ? ' <i>(déplacé)</i>' : ''}</td><td>${q.list || q.code === 'lineaire' ? '' : `<select class="mini-in" data-uvsign="${esc(q.key)}">${optRow(q.sign || '', SIGN_CHOICES)}</select>`}</td><td>${q.lvl === 'MUST' ? '<b>MUST</b>' : 'SHOULD'}</td><td>${esc(q.fiche)}</td><td><button class="mini danger" data-uvtdel="${esc(q.key)}" title="Supprimer">✕</button></td></tr>`).join('')}</tbody></table></div>
      ${r.removed?.length ? `<details><summary>Aménagements supprimés (${r.removed.length})</summary><ul class="blist">${r.removed.map((q) => `<li>${fmtPK(q.s)} — ${esc(q.label)} <button class="mini" data-uvrest="${esc(q.key)}">Rétablir</button></li>`).join('')}</ul></details>` : ''}
      ${r.checks.length ? `<details class="uvck"><summary>Contrôles (${r.checks.length}) — ${r.checks.filter((c) => c.lvl === 'warn').length} alerte(s)</summary><ul class="blist">${r.checks.map((c) => `<li class="${c.lvl}">${esc(c.msg)}</li>`).join('')}</ul></details>` : ''}`;
  }

  // Plan du tracé (SVG, nord en haut) : fond satellite Esri si le projet est géoréférencé, axe coloré par catégorie,
  // PK, déclencheurs (pastilles) et aménagements principaux, flèche du nord et échelle graphique.
  function planSvg(r, { W = 1000, sat = true, s0 = 0, s1 = null, tiles = null, collect = null } = {}) {
    const ax = allAxes().find((a) => a.key === r.key); if (!ax) return '';
    if (s1 == null) s1 = ax.len; s0 = Math.max(0, s0); s1 = Math.min(ax.len, s1);
    const inW = (s) => s >= s0 - 1e-6 && s <= s1 + 1e-6, hits = r.hits.filter((h) => inW(h.s));
    const n = 400, P = []; for (let i = 0; i <= n; i++) { const s = s0 + ((s1 - s0) * i) / n; P.push({ s, ...ax.at(s).p }); }
    const pts = [...P, ...hits.map((h) => ({ x: h.x, y: h.y }))];
    let x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x)), y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
    const pad = Math.max(60, 0.06 * Math.max(x1 - x0, y1 - y0)); x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    const H = Math.round(Math.min(720, Math.max(360, (W * (y1 - y0)) / (x1 - x0))));
    const m = Math.max((x1 - x0) / W, (y1 - y0) / H), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; // m : mètres par pixel
    const X = (x) => (x - cx) / m + W / 2, Y = (y) => H / 2 - (y - cy) / m, f = (v) => v.toFixed(1);
    let g = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Segoe UI, Arial, sans-serif" font-size="11"><rect width="${W}" height="${H}" fill="#e5e7eb"/>`;
    // fond satellite : tuiles Esri World Imagery placées par leurs coins projetés dans le système du projet
    if (sat && geo()) {
      const c = S.crs.toLL(cx, cy), z = Math.max(1, Math.min(19, Math.round(Math.log2((156543.03 * Math.cos((c.lat * Math.PI) / 180)) / m)) + 1)); // un niveau de plus : image nette à l'impression
      // sous-couche à z − 2 (16 fois moins de tuiles) : une tuile manquante laisse voir une image floue, pas un trou gris
      const layer = (z) => {
        const lon2x = (lon) => ((lon + 180) / 360) * 2 ** z, lat2y = (lat) => { const r2 = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r2) + 1 / Math.cos(r2)) / Math.PI) / 2) * 2 ** z; };
        const x2lon = (x) => (x / 2 ** z) * 360 - 180, y2lat = (y) => { const k = Math.PI - (2 * Math.PI * y) / 2 ** z; return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(k) - Math.exp(-k))); };
        // coins de la vue réellement dessinée (la hauteur est bornée : la vue déborde souvent le rectangle de l'axe)
        const vx0 = cx - (W / 2) * m, vx1 = cx + (W / 2) * m, vy0 = cy - (H / 2) * m, vy1 = cy + (H / 2) * m;
        const cs = []; for (let i = 0; i <= 8; i++) { const a = vx0 + ((vx1 - vx0) * i) / 8, b = vy0 + ((vy1 - vy0) * i) / 8; cs.push(S.crs.toLL(a, vy0), S.crs.toLL(a, vy1), S.crs.toLL(vx0, b), S.crs.toLL(vx1, b)); } // bords échantillonnés : ils se courbent en lon/lat
        const tx0 = Math.floor(Math.min(...cs.map((q) => lon2x(q.lon)))), tx1 = Math.floor(Math.max(...cs.map((q) => lon2x(q.lon)))), ty0 = Math.floor(Math.min(...cs.map((q) => lat2y(q.lat)))), ty1 = Math.floor(Math.max(...cs.map((q) => lat2y(q.lat))));
        if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 160) return;
        for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) {
          // tuile placée par trois coins projetés (transformation affine) : les tuiles Web Mercator sont tournées dans le
          // système du projet (convergence des méridiens), un simple rectangle laissait des bandes vides en escalier
          const tl = S.crs.fromLL(x2lon(tx), y2lat(ty)), tr = S.crs.fromLL(x2lon(tx + 1), y2lat(ty)), bl = S.crs.fromLL(x2lon(tx), y2lat(ty + 1));
          const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`; if (collect) collect.push(url);
          const href = tiles?.get(url) || url; // tuile non téléchargée : adresse directe ; si elle échoue aussi, la sous-couche reste visible
          const e = X(tl.x), fy = Y(tl.y), ax_ = X(tr.x) - e, ay_ = Y(tr.y) - fy, cx_ = X(bl.x) - e, cy_ = Y(bl.y) - fy, k = 1.004; // léger recouvrement
          g += `<image href="${href}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" transform="matrix(${(ax_ * k).toFixed(3)} ${(ay_ * k).toFixed(3)} ${(cx_ * k).toFixed(3)} ${(cy_ * k).toFixed(3)} ${e.toFixed(2)} ${fy.toFixed(2)})"/>`;
        }
      };
      if (z > 3) layer(z - 2);
      layer(z);
    }
    // axe : liseré blanc, puis sections colorées par catégorie
    const path = (arr) => arr.map((p, i) => `${i ? 'L' : 'M'}${f(X(p.x))},${f(Y(p.y))}`).join('');
    g += `<path d="${path(P)}" fill="none" stroke="#ffffff" stroke-width="9" stroke-linejoin="round" opacity="0.9"/>`;
    for (const s of r.segs) { if (s.s1 < s0 || s.s0 > s1) continue; const a0 = Math.max(s0, s.s0), a1 = Math.min(s1, s.s1); const q = P.filter((p) => p.s >= a0 - 1e-6 && p.s <= a1 + 1e-6); q.unshift({ ...ax.at(a0).p }); q.push({ ...ax.at(a1).p }); g += `<path d="${path(q)}" fill="none" stroke="${CATS[s.cat].color}" stroke-width="5.5" stroke-linejoin="round"/>`; }
    // PK
    const occ = []; // emprises déjà occupées (PK, symboles) : les étiquettes des déclencheurs les évitent
    const stepPk = [50, 100, 200, 250, 500, 1000, 2000, 5000].find((k) => (s1 - s0) / k <= 14) || 10000;
    for (let s = Math.ceil(s0 / stepPk) * stepPk; s <= s1 + 1e-6; s += stepPk) { const q = ax.at(s), nx = -q.t.y, ny = q.t.x, p = q.p; const a = { x: p.x + nx * 7 * m, y: p.y + ny * 7 * m }, b = { x: p.x - nx * 7 * m, y: p.y - ny * 7 * m }, l = { x: p.x + nx * 16 * m, y: p.y + ny * 16 * m };
      occ.push({ x0: X(l.x) - 20, x1: X(l.x) + 20, y0: Y(l.y) - 7, y1: Y(l.y) + 7 });
      g += `<line x1="${f(X(a.x))}" y1="${f(Y(a.y))}" x2="${f(X(b.x))}" y2="${f(Y(b.y))}" stroke="#111827" stroke-width="1.5"/><text x="${f(X(l.x))}" y="${f(Y(l.y) + 4)}" text-anchor="middle" fill="#111827" stroke="#ffffff" stroke-width="3" paint-order="stroke" font-weight="600">${fmtPK(s)}</text>`; }
    // aménagements principaux (même symboles que le profil)
    const sym = { feux: ['F', '#15803d'], radar: ['R', '#1d4ed8'], portail: ['▮', '#7c2d12'], plateau: ['▬', '#b45309'], zone30: ['30', '#dc2626'], passage: ['‖', '#0f766e'], chicane: ['S', '#a16207'], limite: ['○', '#dc2626'] }, seen = [];
    for (const q of r.treat) {
      if (!sym[q.code] || !inW(q.s)) continue;
      const tq = ax.at(q.s), side = q.dir === -1 ? 1 : -1, p = { x: tq.p.x - tq.t.y * side * 11 * m, y: tq.p.y + tq.t.x * side * 11 * m };
      if (seen.some((o) => Math.hypot(o.x - X(p.x), o.y - Y(p.y)) < 11)) continue; seen.push({ x: X(p.x), y: Y(p.y) }); occ.push({ x0: X(p.x) - 6, x1: X(p.x) + 6, y0: Y(p.y) - 7, y1: Y(p.y) + 7 });
      g += `<text x="${f(X(p.x))}" y="${f(Y(p.y) + 4)}" text-anchor="middle" fill="${sym[q.code][1]}" stroke="#ffffff" stroke-width="2.5" paint-order="stroke" font-weight="700" font-size="${sym[q.code][0].length > 1 ? 9 : 12}">${sym[q.code][0]}</text>`;
    }
    // déclencheurs
    // étiquettes : placées à droite, sinon à gauche de la pastille, et omises si elles chevauchent une autre étiquette ou pastille
    const boxes = [...occ, ...hits.map((h) => ({ x0: X(h.x) - 9, x1: X(h.x) + 9, y0: Y(h.y) - 9, y1: Y(h.y) + 9 }))], lab = [];
    const free = (bx) => !boxes.some((o) => bx.x0 < o.x1 && bx.x1 > o.x0 && bx.y0 < o.y1 && bx.y1 > o.y0);
    for (const h of hits) {
      if (!h.name) continue;
      // nom bilingue (français + arabe) : la partie latine seule sur le plan, le texte mêlé se dessine mal en SVG
      let nm = /[A-Za-zÀ-ÿ]/.test(h.name) && /[\u0600-\u06FF]/.test(h.name) ? h.name.replace(/[\u0600-\u06FF\u0750-\u077F]+/g, '').replace(/\s+/g, ' ').trim() : h.name;
      if (nm.length > 28) nm = `${nm.slice(0, 27)}…`;
      const w = nm.length * 5.6, hx = X(h.x), hy = Y(h.y);
      const cand = [{ x0: hx + 11, x1: hx + 11 + w, y0: hy - 6, y1: hy + 6, a: 'start', tx: hx + 11 }, { x0: hx - 11 - w, x1: hx - 11, y0: hy - 6, y1: hy + 6, a: 'end', tx: hx - 11 }]
        .map((c) => ({ ...c, x0: c.x0 - 2, x1: c.x1 + 2, y0: c.y0 - 2, y1: c.y1 + 2 })).filter((c) => c.x0 >= 0 && c.x1 <= W && free(c));
      if (!cand.length) continue;
      const c = cand[0]; boxes.push(c); lab.push(`<text x="${f(c.tx)}" y="${f(hy + 4)}" text-anchor="${c.a}" fill="#111827" stroke="#ffffff" stroke-width="3" paint-order="stroke" font-size="10">${esc(nm)}</text>`);
    }
    for (const h of hits) { const T = UVR_TYPES[h.type], foot = ax.at(h.s).p;
      g += `<line x1="${f(X(h.x))}" y1="${f(Y(h.y))}" x2="${f(X(foot.x))}" y2="${f(Y(foot.y))}" stroke="${T.color}" stroke-dasharray="3 2" stroke-width="1.2"/><circle cx="${f(X(h.x))}" cy="${f(Y(h.y))}" r="8.5" fill="${T.color}" stroke="#ffffff" stroke-width="1.5"/><text x="${f(X(h.x))}" y="${f(Y(h.y) + 3.5)}" text-anchor="middle" fill="#ffffff" font-size="8.5" font-weight="700">${T.short}</text>`;
    }
    g += lab.join('');
    // nord, échelle
    let rotN = 0; if (geo()) { const c0 = S.crs.toLL(cx, cy), q0 = S.crs.fromLL(c0.lon, c0.lat), q1 = S.crs.fromLL(c0.lon, c0.lat + 0.01); rotN = (Math.atan2(q1.x - q0.x, q1.y - q0.y) * 180) / Math.PI; } // nord géographique dans le système du projet
    g += `<g transform="translate(${W - 34},34) rotate(${rotN.toFixed(1)})"><circle r="18" fill="#ffffff" opacity="0.85"/><path d="M0,-13 L6,8 L0,4 L-6,8 Z" fill="#111827"/><text y="16" text-anchor="middle" font-size="9" font-weight="700">N</text></g>`;
    const sc = [50, 100, 200, 250, 500, 1000, 2000, 5000].find((k) => k / m >= 90) || 10000, sw = sc / m;
    g += `<g transform="translate(18,${H - 18})"><rect x="-6" y="-16" width="${f(sw + 60)}" height="24" fill="#ffffff" opacity="0.85" rx="3"/><rect width="${f(sw / 2)}" height="5" fill="#111827"/><rect x="${f(sw / 2)}" width="${f(sw / 2)}" height="5" fill="#ffffff" stroke="#111827"/><text x="${f(sw + 6)}" y="6" font-size="10">${sc >= 1000 ? `${sc / 1000} km` : `${sc} m`}</text></g>`;
    if (sat && geo()) g += `<text x="${W - 6}" y="${H - 5}" text-anchor="end" font-size="8" fill="#ffffff" stroke="#000000" stroke-width="2" paint-order="stroke">Imagerie © Esri, Maxar, Earthstar Geographics</text>`;
    return g + '</svg>';
  }

  // Zones à détailler : sections lentes (D, E, pôles d'activité, carrefours) regroupées si moins de 300 m les séparent.
  function zonesOf(r) {
    const base = r.segs.length ? Math.max(...r.segs.map((g) => g.v)) : 0, out = [];
    for (const g of r.segs) {
      if (g.v >= base) continue;
      const l = out[out.length - 1];
      if (l && g.s0 - l.s1 < 300) { l.s1 = g.s1; l.cats.add(g.cat); } else out.push({ s0: g.s0, s1: g.s1, cats: new Set([g.cat]) });
    }
    // une zone de plus de 3 km est découpée en plans de détail égaux (échelle lisible)
    const cut = []; for (const z of out) { const n = Math.max(1, Math.ceil((z.s1 - z.s0) / 3000)), d = (z.s1 - z.s0) / n; for (let i = 0; i < n; i++) cut.push({ ...z, s0: z.s0 + i * d, s1: z.s0 + (i + 1) * d }); }
    return cut.map((z) => ({ ...z, lbl: [...z.cats].map((c) => (CATS[c].r4l ? CATS[c].short : `cat. ${c}`)).join(', ') }));
  }

  // Page imprimable : plan de gestion des vitesses du corridor (E.4) + checklist de la faisabilité / APS.
  // Tuiles satellite incorporées dans la page (data URI) : le plan s'imprime en PDF avec son fond, même hors ligne.
  async function embedTiles(urls) {
    const map = new Map(), list = [...new Set(urls)];
    let k = 0;
    // 4 téléchargements simultanés, 3 essais par tuile ; une tuile perdue est omise (la sous-couche z − 2 la remplace)
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (k < list.length) {
        const u = list[k++];
        for (let a = 0; a < 3 && !map.has(u); a++) {
          if (a) await new Promise((ok) => setTimeout(ok, 500 * a));
          try {
            const r = await fetch(u, { mode: 'cors' }); if (!r.ok) continue;
            const b = await r.blob(); if (!b.size || !/^image\//.test(b.type)) continue;
            const d = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(null); fr.readAsDataURL(b); });
            if (d) map.set(u, d);
          } catch { /* nouvel essai */ }
        }
      }
    }));
    return map;
  }
  async function notePage() {
    const res = S.uvr?.res || []; if (!res.length) { toast('Aucun résultat.', 'warn'); return; }
    const w = window.open('', '_blank');
    if (w) w.document.write('<p style="font:14px sans-serif;margin:24px">Préparation du plan de gestion des vitesses et du fond satellite…</p>');
    let tiles = null;
    if (geo()) { const urls = []; for (const r of res) { planSvg(r, { collect: urls }); for (const z of zonesOf(r)) planSvg(r, { s0: z.s0 - 150, s1: z.s1 + 150, collect: urls }); } try { tiles = await embedTiles(urls); } catch { tiles = null; } }
    const u = cfg(), date = new Date().toLocaleDateString('fr-FR'), pname = !S.prj.name || /sans titre/i.test(S.prj.name) ? res.map((r) => r.name).join(', ') : S.prj.name;
    const ck = (id, txt, ok) => `<tr><td>${id}</td><td>${txt}</td><td>${ok ? '✔ produit par GIRA' : 'à compléter'}</td></tr>`;
    const nT = res.reduce((a, r) => a + r.hits.length, 0);
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Plan de gestion des vitesses — ${esc(pname)}</title>
<style>body{font:12px "Segoe UI",Arial,sans-serif;color:#0f172a;margin:24px}h1{font-size:18px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 6px;border-bottom:2px solid #1d4ed8;padding-bottom:3px}h3{font-size:13px;margin:14px 0 4px}table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #cbd5e1;padding:3px 5px;text-align:left;vertical-align:top}th{background:#eff6ff}.n{color:#64748b}.must{font-weight:700}svg{max-width:100%;height:auto}@media print{h2{page-break-before:auto}.pb{page-break-before:always}.noprint{display:none}}</style></head><body>
<button class="noprint" onclick="print()" style="float:right;padding:6px 14px;font-size:13px">Imprimer / PDF</button><h1>Plan de gestion des vitesses du corridor — ${esc(pname)}</h1>
<div class="n">${u.opts.ref === 'R4L' ? 'Vitesses : cadre Roads-for-Life (R4L), Banque mondiale / WRI, Guide for Safe Speeds (2024), § 2.2–2.3, figures 7 et 8 (p. 28–35). Aménagements : ' : ''}Guide M1 ESCWA/UNRSF (version internationale 2026), sections B.5.4, C1.3, C1.5, C1.6, E.4 ; arbres AD 1.1 et AD 1.2 ; fiches F1.09–F1.17. Établi le ${date} avec GIRA. ${nT} déclencheur(s) UVR rattaché(s) à moins de ${u.opts.R} m.</div>
<h2>E.4.1 Informations générales</h2><table><tr><th>Projet</th><td>${esc(pname)}</td></tr><tr><th>Corridor</th><td>${res.map((r) => `${esc(r.name)} : PK 0+000 — ${fmtPK(r.len)} (${fmt(r.len / 1000, 2)} km)`).join('<br>')}</td></tr><tr><th>Date / version</th><td>${date}</td></tr><tr><th>Hypothèses</th><td>Référentiel : ${REFS[u.opts.ref]} ; rayon d'influence ${u.opts.R} m ; traversée de localité ≥ ${u.opts.travMin} m ; ${u.opts.junc ? `carrefours à 50 km/h sur ±${u.opts.juncL} m ; ` : ''}${u.opts.ref === 'R4L' ? `pôles d'activité humaine à ${u.opts.sep ? '50 km/h (usagers vulnérables séparés)' : '30 km/h'}` : 'vitesses par type :'} ${u.opts.ref === 'R4L' ? '' : TYPE_KEYS.map((k) => `${UVR_TYPES[k].label.split(' /')[0]} ${u.opts.types[k].v} km/h${u.opts.types[k].rural ? '' : ' (en traversée seulement)'}`).join(', ')} ; VC = vitesse-cible + 10 km/h (C1.5).${res.some((r) => r.arterial) ? ` Artère(s) à fort trafic (${res.filter((r) => r.arterial).map((r) => esc(r.name)).join(', ')}) : vitesse plancher 50 km/h, ni dos d'âne, ni plateau, ni chicane sur la chaussée principale — traversées à feux, refuges, barrières directrices et contrôle automatisé (seuil de pratique : décret français n° 94-447 du 27 mai 1994, TMJA > 3 000 véh/j, > 300 PL/j ou ligne de transport collectif).` : ''}</td></tr></table>
${res.map((r, i) => `<h2${i ? ' class="pb"' : ''}>${esc(r.name)} — plan du tracé</h2>${planSvg(r, { tiles })}${zonesOf(r).map((z, k) => `<h3>Détail ${k + 1} : PK ${fmtPK(z.s0)} – ${fmtPK(z.s1)} (${esc(z.lbl)})</h3>${planSvg(r, { s0: z.s0 - 150, s1: z.s1 + 150, W: 1000, tiles })}`).join('')}<p class="n">Axe coloré par catégorie (voir la légende du profil), PK tous les ${[100, 200, 250, 500, 1000, 2000, 5000].find((k) => r.len / k <= 14) || 10000} m, déclencheurs UVR (pastilles) et aménagements principaux (▮ portail, ▬ plateau, 30 zone 30, ‖ passage piéton, S chicane, ○ limitation, F traversée à feux, R contrôle automatisé).</p><h2 class="pb">${esc(r.name)} — profil des vitesses</h2>${speedSvg(r, { width: 1000 })}
<h3>E.4.2 Tableau linéaire des vitesses</h3><table><thead><tr><th>PK début</th><th>PK fin</th><th>Cat.</th><th>Vitesse-cible</th><th>VC</th><th>Déclencheurs UVR</th><th>Dispositifs de modération</th></tr></thead><tbody>${r.rows.map((q) => `<tr><td>${fmtPK(q.s0)}</td><td>${fmtPK(q.s1)}</td><td>${esc(q.cat)}</td><td>${esc(q.vt)}</td><td>${esc(q.vc)}</td><td>${esc(q.trig)}</td><td>${esc(q.disp)}</td></tr>`).join('')}</tbody></table>
<h3>Cartographie des déclencheurs UVR (C1.6)</h3>${r.hits.length ? `<table><thead><tr><th>Type</th><th>Nom</th><th>PK</th><th>Distance à l'axe</th><th>Zone</th><th>Prescriptions MUST (AD 1.2)</th><th>SHOULD</th></tr></thead><tbody>${r.hits.map((h) => `<tr><td>${esc(UVR_TYPES[h.type].label)}</td><td>${esc(h.name)}</td><td>${fmtPK(h.s)}</td><td>${fmt(Math.abs(h.off), 0)} m ${h.off > 0 ? 'à gauche' : 'à droite'}</td><td>${fmtPK(h.s0)} — ${fmtPK(h.s1)}</td><td>${UVR_TYPES[h.type].must.map(esc).join('<br>')}</td><td>${UVR_TYPES[h.type].should.map(esc).join('<br>')}</td></tr>`).join('')}</tbody></table>` : '<p class="n">Aucun déclencheur à moins du rayon d\'influence : profil standard de la catégorie (AD 1.2).</p>'}
<h3>Aménagements</h3><table><thead><tr><th>PK</th><th>Sens</th><th>Aménagement</th><th>Niveau</th><th>Fiche</th></tr></thead><tbody>${r.treat.filter((q) => !q.list).map((q) => `<tr><td>${fmtPK(q.s)}</td><td>${q.dir === 1 ? 'PK croissants' : q.dir === -1 ? 'PK décroissants' : 'deux sens'}</td><td>${esc(q.label)}</td><td class="${q.lvl === 'MUST' ? 'must' : ''}">${q.lvl}</td><td>${esc(q.fiche)}</td></tr>`).join('')}</tbody></table>
${r.checks.length ? `<h3>Contrôles</h3><ul>${r.checks.map((c) => `<li>${esc(c.msg)}</li>`).join('')}</ul>` : ''}`).join('')}
<h2 class="pb">Checklists de fin de phase (extraits C1.8 et C2)</h2><table><thead><tr><th>Item</th><th>Description</th><th>Statut</th></tr></thead><tbody>
${ck('CK-F03', 'Générateurs UVR identifiés et cartographiés', nT > 0)}${ck('CK-F04', 'Classification fonctionnelle de chaque section établie', true)}${ck('CK-F05', 'Vitesses-cibles par section définies (grille B.2)', true)}${ck('CK-F06', 'Plan de gestion des vitesses du corridor produit', true)}${ck('CK-A08', 'Aménagements UVR intégrés pour chaque déclencheur identifié', nT > 0)}${ck('CK-A12', 'Plan de gestion des vitesses mis à jour', true)}${ck('CK-A13', 'Transitions entrées de localité conçues (séquences de modération)', res.some((r) => r.trans.some((t) => t.gate)))}
</tbody></table>
<p class="n">Les déclencheurs issus d'OpenStreetMap ou d'un KMZ doivent être confirmés sur le terrain (enquête, comptages UVR — C1.6). La V85 géométrique (formules SETRA reprises de BVTrace) ne tient pas compte des dispositifs de modération : la V85 doit être mesurée après mise en service (F1.13, F1.17).</p>
</body></html>`;
    if (!w || w.closed) { download(fname('html').replace(/\.html$/, '_plan_vitesses.html'), html, 'text/html;charset=utf-8'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  function bind() {
    const tab = $('#tab-uvr'); if (!tab) return;
    const done = () => { cfg().run = true; update(); };
    const curKey = () => { const res = S.uvr?.res || []; return (res.find((q) => q.key === S.uvrAx) || res[0])?.key; };
    tab.addEventListener('change', (e) => {
      const el = e.target, u = cfg(), d = el.dataset;
      if (d.uvo) { if (d.uvo === 'plan') u.plan = el.checked; else if (d.uvo === 'v0' || d.uvo === 'ref') u.opts[d.uvo] = el.value; else if (d.uvo === 'sep' || d.uvo === 'junc') u.opts[d.uvo] = el.checked; else { const v = parseNum(el.value); if (v > 0) u.opts[d.uvo] = v; } done(); }
      else if (d.uvt) { const T = u.opts.types[d.uvt]; if (d.f === 'rural') T.rural = el.checked; else { const v = parseNum(el.value); if (v >= 10 && v <= 130) T.v = Math.round(v); } done(); }
      else if (d.uvax) { const ax = allAxes().find((a) => a.key === d.uvax); u.axes[d.uvax] = { ...(u.axes[d.uvax] || {}), on: el.checked }; done(); }
      else if (d.uvart) { u.axes[d.uvart] = { on: true, ...(u.axes[d.uvart] || {}), art: el.checked }; done(); }
      else if (d.uvbase) { u.axes[d.uvbase] = { on: true, ...(u.axes[d.uvbase] || {}), [bKey(u)]: el.value }; done(); }
      else if (d.uvon != null) { u.trg[+d.uvon].on = el.checked; done(); }
      else if (d.uvtype != null) { u.trg[+d.uvtype].type = el.value; done(); }
      else if (d.uvname != null) { u.trg[+d.uvname].name = el.value; done(); }
      else if (d.uvtron) { const [k, i] = d.uvtron.split('|'); u.trav[k][+i].on = el.checked; done(); }
      else if (d.uvtr) { const [k, i, f] = d.uvtr.split('|'); const v = parseNum(el.value); if (isFinite(v)) { const t = u.trav[k][+i]; t[f] = Math.max(0, v); t.src = 'saisie'; if (t.s1 < t.s0) [t.s0, t.s1] = [t.s1, t.s0]; } done(); }
      else if (d.uvmv) { const v = parseNum(el.value); const k = d.uvmv, e = edOf(u, curKey()); if (isFinite(v)) { if (k.startsWith('manual:')) { const a = e.add.find((x) => `manual:${x.id}` === k); if (a) a.s = v; } else e.mv[k] = v; } done(); }
      else if (d.uvsign) { const k = d.uvsign, e = edOf(u, curKey()); if (k.startsWith('manual:')) { const a = e.add.find((x) => `manual:${x.id}` === k); if (a) a.sign = el.value || null; } else e.sign[k] = el.value; done(); }
      else if (el.id === 'uvrAmCode') S.uvrAm = el.value;
      else if (el.id === 'uvrAmDir') S.uvrAmDir = +el.value;
      else if (el.id === 'uvrAmV') S.uvrAmV = parseNum(el.value) || 50;
      else if (el.id === 'uvrAxSel') { S.uvrAx = el.value; render(); }
      else if (el.id === 'uvrTypeSel') S.uvrType = el.value;
    });
    tab.addEventListener('click', (e) => {
      const b = e.target.closest('button'), u = cfg();
      if (b?.id === 'btnUvrOsm') { fromOsm(); return; }
      if (b?.id === 'btnUvrKml') { fromKml(); return; }
      if (b?.id === 'btnUvrAdd') { S.uvrType = $('#uvrTypeSel').value; setTool('uvrpt'); return; }
      if (b?.id === 'btnUvrTrav') { const n = detectTrav(); u.run = true; update(); toast(n ? `${n} traversée(s) de localité détectée(s) (bâti ≥ ${u.opts.travMin} m).` : u.built.polys.length || u.built.bld.length ? 'Aucune traversée de localité ≥ ' + u.opts.travMin + ' m.' : 'Aucune donnée de bâti : interrogez OpenStreetMap ou importez un KMZ de zones bâties.', n ? 'info' : 'warn'); return; }
      if (b?.id === 'btnUvrCsv') { const res = S.uvr?.res || []; if (!res.length) return; download(fname('csv').replace(/\.csv$/, '_plan_vitesses_E42.csv'), '﻿' + rowsCsv(res), 'text/csv;charset=utf-8'); download(fname('csv').replace(/\.csv$/, '_amenagements_UVR.csv'), '﻿' + treatCsv(res), 'text/csv;charset=utf-8'); return; }
      if (b?.id === 'btnUvrNote') { notePage(); return; }
      if (b?.id === 'btnUvrClear') { if (!confirm('Effacer les déclencheurs, les traversées et les données de bâti de l\'onglet Vitesses / UVR ?')) return; S.prj.uvr = { opts: u.opts, axes: u.axes, plan: u.plan }; update(); return; }
      if (b?.dataset.uvtdel) { const k = b.dataset.uvtdel, e = edOf(u, curKey()); if (k.startsWith('manual:')) e.add = e.add.filter((x) => `manual:${x.id}` !== k); else { e.del.push(k); delete e.mv[k]; delete e.sign[k]; } done(); return; }
      if (b?.dataset.uvrest) { const e = edOf(u, curKey()); e.del = e.del.filter((x) => x !== b.dataset.uvrest); done(); return; }
      if (b?.id === 'btnUvrAmReset') { if (confirm('Supprimer toutes les retouches des aménagements de cet axe ?')) { delete u.edits[curKey()]; done(); } return; }
      if (b?.id === 'btnUvrAmAdd') { const s = parseNum($('#uvrAmS').value), code = $('#uvrAmCode').value; if (!isFinite(s)) { toast('Saisissez le PK (m).', 'warn'); return; } edOf(u, curKey()).add.push({ id: uid(), code, dir: +$('#uvrAmDir').value, s, ...(code === 'limite' ? { v: parseNum($('#uvrAmV').value) || 50 } : {}) }); S.uvrAm = code; done(); return; }
      if (b?.id === 'btnUvrAmPlan') { S.uvrAm = $('#uvrAmCode').value; S.uvrAmDir = +$('#uvrAmDir').value; S.uvrAmV = parseNum($('#uvrAmV').value) || 50; setTool('uvram'); return; }
      if (b?.dataset.uvdel != null) { u.trg.splice(+b.dataset.uvdel, 1); done(); return; }
      if (b?.dataset.uvtadd) { const ax = allAxes().find((a) => a.key === b.dataset.uvtadd); const L = ax?.len || 500; (u.trav[b.dataset.uvtadd] = u.trav[b.dataset.uvtadd] || []).push({ s0: Math.round(L * 0.4), s1: Math.round(Math.min(L, L * 0.4 + 500)), on: true, src: 'saisie' }); done(); return; }
      if (b?.dataset.uvtrdel) { const [k, i] = b.dataset.uvtrdel.split('|'); u.trav[k].splice(+i, 1); done(); return; }
      if (b) return;
      const tr = e.target.closest('tr[data-uvrow]');
      if (tr && !e.target.closest('input,select')) {
        const t = u.trg[+tr.dataset.uvrow], c = xyOf(t); S.uvrSel = t.id;
        if (isFinite(c.x)) viewer.fit({ x0: c.x - 120, y0: c.y - 120, x1: c.x + 120, y1: c.y + 120 }, 0.02);
        render(); return;
      }
      const ts = e.target.closest('tr[data-uvs]');
      if (ts && !e.target.closest('input,select')) { const r = (S.uvr?.res || []).find((q) => q.key === (S.uvrAx || S.uvr.res[0].key)), ax = allAxes().find((a) => a.key === r?.key); if (ax) { const p = ax.at(+ts.dataset.uvs).p; viewer.fit({ x0: p.x - 80, y0: p.y - 80, x1: p.x + 80, y1: p.y + 80 }, 0.02); } }
    });
  }
  // Aménagement touché sur le plan : fiche (PK, sens, panneau, fiche M1) avec Supprimer / Fermer.
  function hit(px, py) {
    let best = null;
    for (const h of S.uvrHits || []) { const [x, y] = viewer.w2s(h.p.x, h.p.y), d = Math.hypot(px - x, py - y); if (d < 16 && (!best || d < best.d)) best = { ...h, d }; }
    return best;
  }
  function openTreat(h) {
    const u = cfg(), r = (S.uvr?.res || []).find((q) => q.key === h.ax), q = r?.treat.find((x) => x.key === h.key); if (!q) return;
    let dlg = document.getElementById('dlgUvrAm');
    if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'dlgUvrAm'; document.body.appendChild(dlg); }
    const fixed = q.list || q.code === 'lineaire';
    dlg.innerHTML = `<h3 style="margin-top:0">${esc((MANUAL[q.code]?.name) || q.code)}</h3><p>${esc(q.label)}</p>
      <p class="note">${esc(r.name)} · ${q.dir === 1 ? 'sens des PK croissants' : q.dir === -1 ? 'sens des PK décroissants' : 'deux sens'} · ${q.lvl} · fiche ${esc(q.fiche)}</p>
      ${fixed ? '' : `<div class="row"><label class="fld"><span class="lb">PK</span><input id="amPk" type="text" inputmode="decimal" size="8" value="${Math.round(q.s)}"><span class="un">m</span></label>
      <label class="fld"><span class="lb">Panneau</span><select id="amSign">${SIGN_CHOICES.map(([v, l]) => `<option value="${esc(v)}"${(q.sign || '') === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label></div>`}
      <div class="row right"><button id="amDel" class="danger">Supprimer</button>${fixed ? '' : '<button id="amOk" class="primary">Appliquer</button>'}<button id="amClose">Fermer</button></div>`;
    const ed = edOf(u, r.key), man = q.key.startsWith('manual:') ? ed.add.find((x) => `manual:${x.id}` === q.key) : null;
    dlg.querySelector('#amClose').onclick = () => dlg.close();
    dlg.querySelector('#amDel').onclick = () => { if (man) ed.add = ed.add.filter((x) => x !== man); else { ed.del.push(q.key); delete ed.mv[q.key]; delete ed.sign[q.key]; } u.run = true; dlg.close(); update(); toast('Aménagement supprimé (rétablissable dans l\'onglet Vitesses / UVR).'); };
    const ok = dlg.querySelector('#amOk');
    if (ok) ok.onclick = () => {
      const v = parseNum(dlg.querySelector('#amPk').value), sg = dlg.querySelector('#amSign').value;
      if (man) { if (isFinite(v)) man.s = v; man.sign = sg || null; }
      else { if (isFinite(v) && Math.abs(v - q.s) > 0.05) ed.mv[q.key] = v; if ((q.sign || '') !== sg) ed.sign[q.key] = sg; }
      u.run = true; dlg.close(); update();
    };
    dlg.showModal();
  }
  return { compute, render, bind, pick, cfg, hit, openTreat };
}
export { defaultUvrOpts };
