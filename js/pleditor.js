// pleditor.js — éditeur interactif du profil en long, ergonomie reprise de BVTrace (map.html : panneau
// « Profil en long du tracé », outils de rasante à gauche, loupes, consigne d'outil, lecture au survol, cartouche
// figé sous le dessin, bandes de déblai / remblai).
//
// Le modèle reste celui de pl.js : une chaîne de points d'inflexion (s, z, R) — la forme que BVTrace recommande
// lui-même (docs/context/rasante.md : « la rasante se modélise comme une chaîne de sommets (S, Z) + rayon, d'où
// droites et paraboles se déduisent ») ; chaque outil ne fait que créer, déplacer ou régler ces sommets.
//
// Ce module ne connaît pas le projet : main.js lui fournit un contexte (getCtx) et reçoit les modifications
// (setPis). Contexte : { key, name, PL (plBuild / buildNodes), defined, tn [[s, z]], pis [{ s, z, R }] (points
// saisis, triés), nodeInfo(i, nœud) → { fixed, pi, label }, sMin, sEnd, stations [{ num, s, z }], overlay(ctx),
// zExtra [z], limits { gMax, Rconv, Rconc, label }, defaultR, startFixed / endFixed { s, z } | null (extrémités
// imposées : bord de l'anneau, chaussée hôte), plan, devers (bandeaux), note }.
import { fmt } from './common.js';
import { plCartSVG, cartH, plDraft, plStrips } from './pl.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pnum = (v) => { const t = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.'); return t === '' || !isFinite(+t) ? NaN : +t; };
const nice = (v) => { const p = 10 ** Math.floor(Math.log10(Math.max(1e-9, v))), r = v / p; return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * p; };
const niceFloor = (v) => { const p = 10 ** Math.floor(Math.log10(Math.max(1e-9, v))), r = v / p; return (r < 2 ? 1 : r < 5 ? 2 : 5) * p; };
const pct = (g) => `${g >= 0 ? '+' : '−'}${fmt(Math.abs(g) * 100, 2)} %`;

const TOOLS = [
  { id: 'sel', ico: '↖', lb: 'Sélection', t: 'Sélectionner un point, le glisser pour le déplacer ; glisser le fond pour se déplacer dans le profil (Échap)' },
  { id: 'add', ico: '＋', lb: 'Point', t: 'Ajouter un point d\'inflexion au clic — accroché au TN ou à la ligne rouge quand le curseur en est proche (P)' },
  { id: 'slope', ico: '∠', lb: 'Pente', t: 'Cliquer un point puis donner la pente et la longueur : nouveau point ; ou cliquer un segment pour imposer sa pente (I)' },
  { id: 'radius', ico: '⌒', lb: 'Rayon', t: 'Cliquer un point : rayon du raccordement parabolique (R)' },
  { id: 'del', ico: '✕', lb: 'Supprimer', t: 'Cliquer un point pour le supprimer (Suppr sur le point sélectionné)' },
];
const STEP_TXT = {
  sel: 'Sélection : cliquez un point pour le régler, glissez-le pour le déplacer ; glissez le fond pour vous déplacer. Molette : zoom.',
  add: 'Point : cliquez à l\'endroit voulu — le point s\'accroche au TN (◆) ou à la ligne rouge (●) quand le curseur en est proche.',
  slope: 'Pente : cliquez le point de départ (ou un segment de la ligne rouge pour imposer sa pente).',
  radius: 'Rayon : cliquez le point d\'inflexion à raccorder.',
  del: 'Supprimer : cliquez le point à supprimer.',
  win: 'Zoom fenêtre : tracez un rectangle sur le profil.',
};

export function createPlEditor(host, hooks) {
  const st = { tool: 'sel', view: null, key: null, sel: -1, snap: true, labels: true, ve: 0, form: null, drag: null, hover: null, raf: 0, ctx: null, geo: null };
  host.classList.add('ple');
  host.innerHTML = `
    <div class="ple-tools">
      ${TOOLS.map((t) => `<button type="button" data-tool="${t.id}" title="${esc(t.t)}"><span class="i">${t.ico}</span>${t.lb}</button>`).join('')}
      <hr>
      <button type="button" data-act="sz" title="Ajouter un point par ses coordonnées s / z / R">S / Z…</button>
      <button type="button" data-act="draft" title="Proposer une ligne rouge depuis le terrain naturel (écart, pentes et rayons de la catégorie)">Draft TN…</button>
      <hr>
      <button type="button" data-act="undo" title="Annuler (Ctrl+Z)">↶ Annuler</button>
      <button type="button" data-act="redo" title="Rétablir (Ctrl+Y)">↷ Rétablir</button>
      <button type="button" data-act="clear" title="Effacer tous les points saisis (Annuler permet de revenir)">Effacer tout</button>
    </div>
    <div class="ple-main">
      <div class="ple-bar">
        <span class="ple-loupes">
          <button type="button" data-zoom="all" title="Zoom tout (F)">⤢</button>
          <button type="button" data-zoom="win" title="Zoom fenêtre : tracer un rectangle">▭</button>
          <button type="button" data-zoom="in" title="Zoom avant (+)">＋</button>
          <button type="button" data-zoom="out" title="Zoom arrière (−)">－</button>
        </span>
        <label title="Exagération des cotes par rapport aux distances">Exag. <select data-ve>${[0, 1, 2, 5, 10, 20, 50].map((v) => `<option value="${v}">${v ? `× ${v}` : 'auto'}</option>`).join('')}</select></label>
        <label title="Accrocher les points au terrain naturel et à la ligne rouge"><input type="checkbox" data-snap checked> Accrochage</label>
        <label title="Pentes, longueurs et rayons sur le dessin"><input type="checkbox" data-labels checked> Cotes</label>
        <span class="ple-key"><i class="k-tn"></i>TN <i class="k-red"></i>projet <i class="k-cut"></i>déblai <i class="k-fill"></i>remblai</span>
      </div>
      <div class="ple-cmd"></div>
      <div class="ple-plot"><svg class="ple-svg plsvg"></svg></div>
      <div class="ple-cart"><svg class="plsvg"></svg></div>
      <div class="ple-read">Survolez le profil : abscisse, cotes TN et projet, écart, pente.</div>
    </div>
    <div class="ple-insp"></div>`;
  const $ = (q) => host.querySelector(q), svg = $('.ple-svg'), plot = $('.ple-plot'), cmd = $('.ple-cmd'), read = $('.ple-read'), insp = $('.ple-insp');

  // ------------------------------------------------------------------ géométrie de la vue
  const M = { l: 124, r: 18, t: 18, b: 28 };
  const tnAt = (s) => {
    const tn = st.ctx?.tn; if (!tn?.length || s < tn[0][0] - 1e-6 || s > tn[tn.length - 1][0] + 1e-6) return null;
    let a = 0, b = tn.length - 1; while (b - a > 1) { const m = (a + b) >> 1; if (tn[m][0] <= s) a = m; else b = m; }
    const [s0, z0] = tn[a], [s1, z1] = tn[b]; return s1 - s0 < 1e-9 ? z0 : z0 + ((z1 - z0) * (s - s0)) / (s1 - s0);
  };
  const size = () => ({ W: Math.max(320, plot.clientWidth), H: Math.max(180, plot.clientHeight) });
  function zRange(ctx) {
    const zs = [...ctx.tn.map((p) => p[1]), ...ctx.PL.nodes.map((n) => n.z), ...(ctx.zExtra || [])].filter(Number.isFinite);
    const sA = ctx.sMin, sB = Math.max(ctx.sEnd, ctx.PL.sEnd);
    for (let k = 0; k <= 40; k++) { const z = ctx.PL.zAt(sA + ((sB - sA) * k) / 40); if (Number.isFinite(z)) zs.push(z); }
    let lo = Math.min(...zs), hi = Math.max(...zs); if (!(hi - lo > 1)) { lo -= 1; hi += 1; }
    return [lo, hi];
  }
  function zoomAll() {
    const ctx = st.ctx; if (!ctx) return;
    const { W, H } = size(), pw = W - M.l - M.r, ph = H - M.t - M.b;
    const sA = ctx.sMin, sB = Math.max(ctx.sEnd, ctx.PL.sEnd, sA + 20), pad = (sB - sA) * 0.03;
    const [lo, hi] = zRange(ctx), sx = pw / (sB - sA + 2 * pad);
    const ve = st.ve > 0 ? st.ve : Math.max(1, Math.min(50, niceFloor((ph * 0.82) / ((hi - lo) * sx))));
    st.view = { s0: sA - pad, s1: sB + pad, zc: (lo + hi) / 2, ve, fit: true };
  }
  function geo() {
    const { W, H } = size(), v = st.view, pw = W - M.l - M.r, ph = H - M.t - M.b, sx = pw / (v.s1 - v.s0), sz = sx * v.ve, mid = M.t + ph / 2;
    return { W, H, pw, ph, sx, sz, X: (s) => M.l + (s - v.s0) * sx, Y: (z) => mid - (z - v.zc) * sz, S: (x) => v.s0 + (x - M.l) / sx, Z: (y) => v.zc - (y - mid) / sz, mid };
  }
  function zoomAt(f, px, py) {
    const g = geo(), s = g.S(px), z = g.Z(py), v = st.view;
    v.s0 = s - (s - v.s0) / f; v.s1 = s + (v.s1 - s) / f; v.fit = false;
    const sx2 = g.pw / (v.s1 - v.s0), sz2 = sx2 * v.ve; v.zc = z + (py - g.mid) / sz2;
    draw();
  }

  // ------------------------------------------------------------------ dessin
  function draw() {
    const ctx = st.ctx; if (!ctx) return;
    if (!st.view) zoomAll();
    const G = (st.geo = geo()), { W, H, X, Y } = G, v = st.view, PL = ctx.PL;
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const sVis0 = Math.max(ctx.sMin, v.s0), sVis1 = Math.min(Math.max(ctx.sEnd, PL.sEnd), v.s1);
    let o = `<defs><clipPath id="ple-clip"><rect x="${M.l}" y="${M.t}" width="${G.pw}" height="${G.ph}"/></clipPath></defs>`;
    // grille 1-2-5 (au moins 60 px en distance, 28 px en cote)
    const gs = nice(60 / G.sx), gz = nice(28 / G.sz), zTop = G.Z(M.t), zBot = G.Z(M.t + G.ph);
    o += '<g class="ple-grid">';
    for (let s = Math.ceil(v.s0 / gs) * gs; s <= v.s1; s += gs) o += `<line x1="${X(s).toFixed(1)}" y1="${M.t}" x2="${X(s).toFixed(1)}" y2="${M.t + G.ph}"/><text class="tk" x="${X(s).toFixed(1)}" y="${H - 9}" text-anchor="middle">${fmt(s, gs < 1 ? 1 : 0)}</text>`;
    for (let z = Math.ceil(zBot / gz) * gz; z <= zTop; z += gz) o += `<line x1="${M.l}" y1="${Y(z).toFixed(1)}" x2="${M.l + G.pw}" y2="${Y(z).toFixed(1)}"/><text class="tk" x="${M.l - 6}" y="${(Y(z) + 4).toFixed(1)}" text-anchor="end">${fmt(z, gz < 1 ? 2 : gz < 10 ? 1 : 0)}</text>`;
    o += `</g><text class="ple-ax" x="${M.l - 6}" y="${M.t - 5}" text-anchor="end">z (m)</text><text class="ple-ax" x="${M.l}" y="${H - 9}" text-anchor="end">s (m) </text>`;
    o += `<g clip-path="url(#ple-clip)">`;
    // déblai / remblai entre TN et projet (coupés aux croisements, interpolation de l'écart)
    const tn = ctx.tn.filter(([s]) => s >= sVis0 - 2 && s <= sVis1 + 2);
    if (ctx.defined && tn.length > 1) {
      let cut = '', fill = '';
      for (let i = 0; i + 1 < tn.length; i++) {
        const [s0, t0] = tn[i], [s1, t1] = tn[i + 1], p0 = PL.zAt(s0), p1 = PL.zAt(s1), d0 = p0 - t0, d1 = p1 - t1;
        const poly = (a, ta, pa, b, tb, pb) => `M${X(a).toFixed(1)},${Y(ta).toFixed(1)}L${X(b).toFixed(1)},${Y(tb).toFixed(1)}L${X(b).toFixed(1)},${Y(pb).toFixed(1)}L${X(a).toFixed(1)},${Y(pa).toFixed(1)}Z`;
        if (d0 * d1 < 0) { const f = d0 / (d0 - d1), sc = s0 + f * (s1 - s0), zc = t0 + f * (t1 - t0); const A = poly(s0, t0, p0, sc, zc, zc), B = poly(sc, zc, zc, s1, t1, p1); if (d0 > 0) { fill += A; cut += B; } else { cut += A; fill += B; } }
        else if (d0 + d1 >= 0) fill += poly(s0, t0, p0, s1, t1, p1); else cut += poly(s0, t0, p0, s1, t1, p1);
      }
      o += `<path class="ple-cut" d="${cut}"/><path class="ple-fill" d="${fill}"/>`;
    }
    if (ctx.overlay) o += ctx.overlay({ X, Y, vis: Y, m: { l: M.l, r: M.r, t: M.t, b: G.H - M.t - G.ph }, w: W, h: H, sMax: v.s1 });
    if (tn.length > 1) o += `<path class="ple-tn" d="${tn.map(([s, z], i) => `${i ? 'L' : 'M'}${X(s).toFixed(1)},${Y(z).toFixed(1)}`).join('')}"/>`;
    // ligne rouge : polygone des tangentes (sommets) puis courbe
    if (ctx.defined || PL.nodes.length > 1) {
      o += `<path class="ple-poly" d="${PL.nodes.map((n, i) => `${i ? 'L' : 'M'}${X(n.s).toFixed(1)},${Y(n.z).toFixed(1)}`).join('')}"/>`;
      const a = Math.max(PL.nodes[0].s, v.s0), b = Math.min(PL.sEnd, v.s1), n = Math.max(2, Math.ceil(G.pw / 3)), pts = [];
      for (let k = 0; k <= n; k++) { const s = a + ((b - a) * k) / n; pts.push(`${k ? 'L' : 'M'}${X(s).toFixed(1)},${Y(PL.zAt(s)).toFixed(1)}`); }
      if (b > a) o += `<path class="ple-red${ctx.defined ? '' : ' ind'}" d="${pts.join('')}"/>`;
      if (st.labels && ctx.defined) {
        for (const c of PL.curves) {
          for (const s of [c.sA, c.sB]) o += `<line class="ple-tg" x1="${X(s).toFixed(1)}" y1="${(Y(PL.zAt(s)) - 9).toFixed(1)}" x2="${X(s).toFixed(1)}" y2="${(Y(PL.zAt(s)) + 9).toFixed(1)}"/>`;
          if (X(c.sB) - X(c.sA) > 40) o += `<text class="ple-lr" x="${X(c.s).toFixed(1)}" y="${(c.type === 'convexe' ? Math.min(Y(PL.zAt(c.s)), Y(c.z)) - 26 : Math.max(Y(PL.zAt(c.s)), Y(c.z)) + 20).toFixed(1)}" text-anchor="middle">R ${fmt(c.R, 0)} · T ${fmt(c.T, 1)}</text>`;
        }
        for (const sg of PL.segs) {
          const sm = (sg.s0 + sg.s1) / 2, wpx = X(sg.s1) - X(sg.s0); if (wpx < 70) continue;
          const ang = (-Math.atan2(sg.g * G.sz, G.sx) * 180) / Math.PI;
          o += `<text class="ple-ls" x="${X(sm).toFixed(1)}" y="${(Y(PL.zAt(sm)) - 7).toFixed(1)}" text-anchor="middle" transform="rotate(${ang.toFixed(2)} ${X(sm).toFixed(1)} ${(Y(PL.zAt(sm)) - 7).toFixed(1)})">${pct(sg.g)} · ${fmt(sg.s1 - sg.s0, 1)} m</text>`;
        }
      }
    }
    o += '</g>';
    // sommets (au-dessus du cadre pour rester saisissables au bord)
    PL.nodes.forEach((nd, i) => {
      const inf = ctx.nodeInfo(i, nd); if (!Number.isFinite(nd.s) || nd.s < v.s0 - 1 || nd.s > v.s1 + 1) return;
      const sel = !inf.fixed && st.sel === inf.pi;
      o += `<g class="ple-node${inf.fixed ? ' fixed' : ''}${sel ? ' sel' : ''}" data-pi="${inf.fixed ? -1 : inf.pi}" data-n="${i}"><circle cx="${X(nd.s).toFixed(1)}" cy="${Y(nd.z).toFixed(1)}" r="${inf.fixed ? 4.5 : 6}"/>`;
      if (st.labels) o += `<text x="${X(nd.s).toFixed(1)}" y="${(Y(nd.z) - 11).toFixed(1)}" text-anchor="middle">${esc(inf.label)}</text>`;
      o += '</g>';
    });
    if (!ctx.defined) o += `<text class="ple-empty" x="${(M.l + W - M.r) / 2}" y="${M.t + 22}" text-anchor="middle">${esc(ctx.note || 'Aucune ligne rouge : outil « Point » ou « Draft TN… » pour la créer.')}</text>`;
    o += `<rect class="ple-frame" x="${M.l}" y="${M.t}" width="${G.pw}" height="${G.ph}"/>`;
    o += `<text class="ple-ve" x="${W - M.r}" y="${M.t - 5}" text-anchor="end">exagération × ${fmt(v.ve, v.ve < 1 ? 2 : 0)}${st.ve ? '' : ' (auto)'}</text>`;
    // survol (mis à jour sans tout redessiner)
    o += `<g class="ple-hov" style="display:none"><line class="ple-cur" y1="${M.t}" y2="${M.t + G.ph}"/><circle class="ple-mtn" r="4"/><circle class="ple-mred" r="4"/><g class="ple-snap"><rect x="-6" y="-6" width="12" height="12" transform="rotate(45)"/></g><path class="ple-prev"/><rect class="ple-win"/></g>`;
    svg.innerHTML = o;
    drawCart();
    syncBar(); drawInsp();
  }
  // Cartouche (BVTrace) puis bandeaux du tracé en plan (courbures) et des dévers, à la même échelle des abscisses.
  function drawCart() {
    const ctx = st.ctx, G = st.geo, box = $('.ple-cart svg'), stripH = (ctx.plan ? 34 : 0) + (ctx.devers?.length ? 84 : 0), H = cartH() + 4 + stripH;
    box.setAttribute('width', G.W); box.setAttribute('height', H); box.setAttribute('viewBox', `0 0 ${G.W} ${H}`);
    const C = plCartSVG(ctx.PL, ctx.stations || [], { X: G.X, m: { l: M.l }, w: G.W, y0: 1, sMax: Math.min(st.view.s1, Math.max(ctx.sEnd, ctx.PL.sEnd)), sMin: Math.max(st.view.s0, ctx.sMin), clip: 'ple-cclip', noRed: !ctx.defined });
    const sv = stripH ? plStrips({ plan: ctx.plan, devers: ctx.devers }, { X: G.X, m: { l: M.l, r: M.r }, w: G.W, h: H, sMax: st.view.s1, stripH }) : '';
    // libellés des bandeaux (dans la colonne de gauche, hors de la zone défilante)
    const labels = (sv.match(/<text [^>]*x="([\d.]+)"[^>]*>[^<]*(?:<tspan[^>]*>[^<]*<\/tspan>[^<]*)*<\/text>/g) || []).filter((t) => +t.match(/x="([\d.]+)"/)[1] < M.l).join('');
    const strips = stripH ? `<g clip-path="url(#ple-cclip)">${sv}</g>${labels}` : '';
    box.innerHTML = `<defs><clipPath id="ple-cclip"><rect x="${M.l}" y="0" width="${G.pw + M.r}" height="${H}"/></clipPath></defs>` + C.svg + strips;
  }

  // ------------------------------------------------------------------ barre, consigne, inspecteur
  function syncBar() {
    host.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === st.tool));
    $('[data-ve]').value = String(st.ve); $('[data-snap]').checked = st.snap; $('[data-labels]').checked = st.labels;
    if (!st.form) cmd.innerHTML = `<span>${esc(STEP_TXT[st.win ? 'win' : st.tool])}</span>`;
  }
  function form(title, fields, onOk, extra = '') {
    st.form = { onOk };
    cmd.innerHTML = `<form class="ple-form"><b>${esc(title)}</b>${fields.map((f) => `<label>${esc(f.lb)} <input name="${f.k}" value="${esc(f.v ?? '')}" inputmode="decimal" autocomplete="off" size="${f.size || 7}"${f.ph ? ` placeholder="${esc(f.ph)}"` : ''}></label>`).join('')}${extra}<button type="submit">Valider</button><button type="button" data-cancel>Annuler</button><span class="ple-err"></span></form>`;
    const fm = cmd.querySelector('form');
    fm.querySelector('input')?.focus(); fm.querySelector('input')?.select();
    fm.addEventListener('submit', (e) => { e.preventDefault(); const vals = Object.fromEntries(fields.map((f) => [f.k, pnum(fm.elements[f.k].value)])); const err = onOk(vals); if (err) { fm.querySelector('.ple-err').textContent = err; return; } closeForm(); });
    fm.querySelector('[data-cancel]').addEventListener('click', closeForm);
    fm.addEventListener('input', () => st.form?.onInput?.(Object.fromEntries(fields.map((f) => [f.k, pnum(fm.elements[f.k].value)]))));
  }
  function closeForm() { st.form = null; st.pending = null; hidePrev(); syncBar(); }
  function drawInsp() {
    const ctx = st.ctx, PL = ctx.PL, i = st.sel, q = ctx.pis[i];
    const lim = ctx.limits || {};
    let h = `<h4>${esc(ctx.name)}</h4><p class="ple-lim">${esc(lim.label || '')}</p>`;
    if (q) {
      const k = PL.nodes.findIndex((n, j) => !ctx.nodeInfo(j, n).fixed && ctx.nodeInfo(j, n).pi === i);
      const g1 = k > 0 ? PL.segs[k - 1]?.g : null, g2 = PL.segs[k]?.g ?? null, cv = PL.curves.find((c) => c.i === k);
      h += `<div class="ple-pt"><b>${esc(ctx.nodeInfo(k, PL.nodes[k]).label)}</b>` +
        ['s', 'z', 'R'].map((f) => `<label>${{ s: 's (m)', z: 'z (m)', R: 'R (m)' }[f]}<input data-f="${f}" value="${fmt(+q[f] || 0, f === 'z' ? 3 : f === 's' ? 2 : 0)}" inputmode="decimal"></label>`).join('') +
        `<dl><dt>pente amont</dt><dd>${g1 == null ? '—' : pct(g1)}</dd><dt>pente aval</dt><dd>${g2 == null ? '—' : pct(g2)}</dd>` +
        (cv ? `<dt>raccordement</dt><dd>${cv.type} · T ${fmt(cv.T, 2)} m</dd><dt>flèche</dt><dd>${fmt((cv.R * (cv.g2 - cv.g1) ** 2) / 8, 3)} m</dd>` : g1 != null && g2 != null && Math.abs(g2 - g1) > 1e-6 ? '<dt>raccordement</dt><dd>aucun (R = 0)</dd>' : '') +
        `<dt>TN</dt><dd>${tnAt(+q.s) == null ? '—' : `${fmt(tnAt(+q.s), 2)} (${(+q.z - tnAt(+q.s) >= 0 ? '+' : '−') + fmt(Math.abs(+q.z - tnAt(+q.s)), 2)})`}</dd></dl>` +
        `<div class="row"><button type="button" data-insp="tn"${tnAt(+q.s) == null ? ' disabled' : ''} title="Cote du point = cote du terrain naturel">Caler sur TN</button><button type="button" data-insp="del">Supprimer</button></div></div>`;
    } else h += '<p class="ple-hint">Cliquez un point de la ligne rouge pour le régler ici (s, z, R, pentes, flèche).</p>';
    h += `<p class="ple-hint"><kbd>P</kbd> point · <kbd>I</kbd> pente · <kbd>R</kbd> rayon · <kbd>Suppr</kbd> supprimer · <kbd>F</kbd> zoom tout · <kbd>Échap</kbd> sélection</p>`;
    insp.innerHTML = h;
  }

  // ------------------------------------------------------------------ modifications
  const pisCopy = () => st.ctx.pis.map((q) => ({ s: +q.s, z: +q.z, R: +q.R || 0 }));
  function commit(pis, sel, opts = { commit: true }) {
    pis.sort((a, b) => a.s - b.s);
    const selQ = sel != null ? pis[sel] ?? sel : null;
    st.sel = selQ && typeof selQ === 'object' ? pis.indexOf(selQ) : st.sel;
    hooks.setPis(pis.map((q) => ({ s: Math.round(q.s * 100) / 100, z: Math.round(q.z * 1000) / 1000, R: Math.max(0, Math.round(q.R || 0)) })), opts);
  }
  const R0 = () => st.ctx.defaultR ?? st.ctx.limits?.Rconv ?? 0;
  // Nouveau point : rayon par défaut (minimum de la catégorie, saillant ou rentrant selon les pentes voisines), réduit
  // pour que ses tangentes T = R·|Δi|/2 tiennent dans 45 % des intervalles voisins — sans quoi le raccordement
  // chevaucherait ses voisins et la ligne rouge serait fausse dès le clic.
  function fitR(s, z, Rwant, nodes = st.ctx.PL.nodes) {
    const ns = nodes.map((n) => ({ s: n.s, z: n.z })).filter((n) => Math.abs(n.s - s) > 1e-6);
    const a = [...ns].reverse().find((n) => n.s < s), b = ns.find((n) => n.s > s);
    if (!a || !b) return 0;
    const g1 = (z - a.z) / (s - a.s), g2 = (b.z - z) / (b.s - s), dg = Math.abs(g2 - g1);
    if (dg < 1e-5) return 0;
    const lim = st.ctx.limits || {}, Rcat = Rwant ?? (g2 < g1 ? lim.Rconv : lim.Rconc) ?? R0();
    return Math.max(0, Math.floor(Math.min(Rcat, (0.9 * Math.min(s - a.s, b.s - s)) / dg) / 10) * 10);
  }
  function addAt(s, z, R) {
    const ctx = st.ctx;
    if (ctx.startFixed && !(s > ctx.startFixed.s + 0.05)) return 'abscisse avant l\'origine imposée';
    if (ctx.endFixed && !(s < ctx.endFixed.s - 0.05)) return 'abscisse au-delà de l\'extrémité imposée';
    const pis = pisCopy();
    if (pis.some((q) => Math.abs(q.s - s) < 0.5) || ctx.PL.nodes.some((n, j) => ctx.nodeInfo(j, n).fixed && Math.abs(n.s - s) < 0.5)) return 'un point existe déjà à cette abscisse';
    const q = { s, z, R: R ?? fitR(s, z) }; pis.push(q);
    // le point qui terminait la ligne rouge devient intérieur : on lui donne aussi un raccordement
    const fixedN = ctx.PL.nodes.filter((n, j) => ctx.nodeInfo(j, n).fixed), all = [...fixedN, ...pis].sort((u, w) => u.s - w.s);
    const prev = [...pis].sort((u, w) => u.s - w.s).reverse().find((u) => u.s < s);
    if (prev && !(prev.R > 0) && all[all.length - 1] === q) prev.R = fitR(prev.s, prev.z, undefined, all);
    commit(pis, q); return null;
  }
  // nœud le plus proche du pointeur (≤ 10 px) : { k (indice PL), inf }
  function nodeAt(px, py) {
    const ctx = st.ctx, G = st.geo; let best = null, bd = 10;
    ctx.PL.nodes.forEach((n, k) => { const d = Math.hypot(G.X(n.s) - px, G.Y(n.z) - py); if (d < bd) { bd = d; best = { k, n, inf: ctx.nodeInfo(k, n) }; } });
    return best;
  }
  // accrochage : TN (◆) ou ligne rouge (●) à moins de 9 px
  function snapZ(s, py) {
    const ctx = st.ctx, G = st.geo;
    if (!st.snap) return { z: G.Z(py), kind: null };
    const zt = tnAt(s), zr = ctx.defined || ctx.PL.nodes.length > 1 ? ctx.PL.zAt(s) : null;
    const dt = zt == null ? Infinity : Math.abs(G.Y(zt) - py), dr = zr == null || s > ctx.PL.sEnd ? Infinity : Math.abs(G.Y(zr) - py);
    if (dr < 9 && dr <= dt) return { z: zr, kind: 'red' };
    if (dt < 9) return { z: zt, kind: 'tn' };
    return { z: G.Z(py), kind: null };
  }
  function segAt(px, py) {
    const ctx = st.ctx, G = st.geo, s = G.S(px); if (!ctx.defined || s < ctx.PL.nodes[0].s || s > ctx.PL.sEnd) return null;
    if (Math.abs(G.Y(ctx.PL.zAt(s)) - py) > 9) return null;
    const j = ctx.PL.segs.findIndex((sg) => s >= sg.s0 && s <= sg.s1); return j < 0 ? null : j;
  }

  // ------------------------------------------------------------------ outils
  function startSlope(k) {
    const ctx = st.ctx, n = ctx.PL.nodes[k], gPrev = k > 0 ? ctx.PL.segs[k - 1]?.g : ctx.PL.segs[0]?.g;
    st.pending = { k };
    form(`Pente depuis ${ctx.nodeInfo(k, n).label} (s ${fmt(n.s, 1)}, z ${fmt(n.z, 2)})`, [
      { k: 'i', lb: 'pente (%)', v: gPrev != null ? fmt(gPrev * 100, 2) : '0', ph: '+ rampe / − pente' },
      { k: 'ds', lb: 'longueur ΔS (m)', v: '100' },
    ], (vals) => {
      if (!Number.isFinite(vals.i) || !(vals.ds > 0.5)) return 'pente et longueur (> 0,5 m) requises';
      if (ctx.limits?.gMax && Math.abs(vals.i / 100) > ctx.limits.gMax + 1e-9) hooks.toast?.(`Pente ${fmt(Math.abs(vals.i), 2)} % > ${fmt(ctx.limits.gMax * 100, 1)} % (${ctx.limits.label}).`, 'warn');
      return addAt(n.s + vals.ds, n.z + (vals.i / 100) * vals.ds);
    });
    st.form.onInput = (vals) => { if (Number.isFinite(vals.i) && vals.ds > 0) showPrev([[n.s, n.z], [n.s + vals.ds, n.z + (vals.i / 100) * vals.ds]]); };
    st.form.onInput({ i: gPrev != null ? gPrev * 100 : 0, ds: 100 });
  }
  function startSegSlope(j) {
    const ctx = st.ctx, sg = ctx.PL.segs[j], a = ctx.PL.nodes[j], b = ctx.PL.nodes[j + 1];
    const ia = ctx.nodeInfo(j, a), ib = ctx.nodeInfo(j + 1, b);
    if (ia.fixed && ib.fixed) { hooks.toast?.('Segment entre deux points imposés : pente non modifiable.', 'warn'); return; }
    form(`Pente du segment ${ia.label} → ${ib.label} (${ib.fixed ? `${ia.label} déplacé` : `${ib.label} déplacé`})`, [{ k: 'i', lb: 'pente (%)', v: fmt(sg.g * 100, 3) }], (vals) => {
      if (!Number.isFinite(vals.i)) return 'pente requise';
      const pis = pisCopy(), g = vals.i / 100;
      if (!ib.fixed) pis[ib.pi].z = a.z + g * (b.s - a.s); else pis[ia.pi].z = b.z - g * (b.s - a.s);
      commit(pis, null); return null;
    });
  }
  function startRadius(k) {
    const ctx = st.ctx, inf = ctx.nodeInfo(k, ctx.PL.nodes[k]);
    if (inf.fixed) { hooks.toast?.('Point imposé : pas de raccordement réglable ici.', 'warn'); return; }
    const g1 = ctx.PL.segs[k - 1]?.g, g2 = ctx.PL.segs[k]?.g, conv = g1 != null && g2 != null && g2 < g1, lim = ctx.limits || {};
    const Rmin = conv ? lim.Rconv : lim.Rconc;
    st.sel = inf.pi;
    form(`Rayon au ${inf.label}${g1 != null && g2 != null ? ` (${conv ? 'saillant' : 'rentrant'}, Δi ${fmt(Math.abs(g2 - g1) * 100, 2)} %)` : ''}`, [{ k: 'R', lb: 'R (m)', v: String(+ctx.pis[inf.pi].R || Rmin || 0), ph: '0 = sans raccordement' }], (vals) => {
      if (!(vals.R >= 0)) return 'rayon ≥ 0 requis';
      const pis = pisCopy(); pis[inf.pi].R = vals.R; commit(pis, null); return null;
    }, Rmin ? `<span class="ple-note">minimum ${fmt(Rmin, 0)} m</span>` : '');
  }
  function del(pi) { if (pi < 0) return; const pis = pisCopy(); pis.splice(pi, 1); st.sel = -1; commit(pis, null); }
  function openSZ() {
    form('Point par coordonnées', [{ k: 's', lb: 's (m)' }, { k: 'z', lb: 'z (m)' }, { k: 'R', lb: 'R (m)', ph: 'auto' }], (vals) => {
      if (!Number.isFinite(vals.s) || !Number.isFinite(vals.z)) return 's et z requis';
      return addAt(vals.s, vals.z, Number.isFinite(vals.R) ? vals.R : undefined);
    });
  }
  function openDraft() {
    const ctx = st.ctx, lim = ctx.limits || {};
    if (!ctx.tn.length) { hooks.toast?.('Aucun terrain naturel sur cet axe (onglet Terrain).', 'warn'); return; }
    const g = Number.isFinite(lim.gMax) ? lim.gMax * 100 : 6, L = Math.max(ctx.sEnd, ctx.PL.sEnd) - ctx.sMin;
    form('Draft depuis le TN', [
      { k: 'dz', lb: 'écart au TN (m)', v: '0,50', ph: '+ remblai / − déblai' },
      { k: 'gu', lb: 'rampe max (%)', v: fmt(g, 1), size: 5 },
      { k: 'gd', lb: 'pente max (%)', v: fmt(g, 1), size: 5 },
      { k: 'rs', lb: 'R saillant (m)', v: String(lim.Rconv || 1500) },
      { k: 'rr', lb: 'R rentrant (m)', v: String(lim.Rconc || 1000) },
      { k: 'sp', lb: 'espacement min (m)', v: String(Math.round(Math.max(40, Math.min(250, L / 8)))), size: 5 },
    ], (v) => {
      if (![v.dz, v.gu, v.gd, v.rs, v.rr, v.sp].every(Number.isFinite) || v.sp <= 0) return 'valeurs numériques requises';
      if (ctx.pis.length && !window.confirm('Remplacer les points saisis par la proposition ? (Annuler permet de revenir)')) return null;
      const fixed0 = ctx.startFixed;
      const r = plDraft(ctx.tn, { s0: fixed0 ? fixed0.s : ctx.sMin, s1: ctx.endFixed ? ctx.endFixed.s : ctx.sEnd, start: fixed0 || null, end: ctx.endFixed, dz: v.dz, gUp: v.gu / 100, gDown: v.gd / 100, RsMin: v.rs, RsMax: v.rs * 3, RrMin: v.rr, RrMax: v.rr * 3, minSpan: v.sp });
      if (!r.pis.length) return r.notes[0] || 'aucune proposition';
      let pis = r.pis;
      if (!fixed0) { const z0 = tnAt(ctx.sMin); if (z0 != null) pis = [{ s: ctx.sMin, z: Math.round((z0 + v.dz) * 100) / 100, R: 0 }, ...pis]; }
      st.sel = -1; commit(pis, null);
      hooks.toast?.(`Ligne rouge proposée : ${pis.length} point(s)${r.notes.length ? ` — ${r.notes.join(' ; ')}` : ''}. Ajustez-la avec les outils.`, r.notes.length ? 'warn' : 'info');
      return null;
    });
  }

  // ------------------------------------------------------------------ survol et aperçus
  const hovEl = (q) => svg.querySelector(q);
  function showPrev(pts) { const G = st.geo, p = hovEl('.ple-prev'); if (!p) return; hovEl('.ple-hov').style.display = ''; p.setAttribute('d', pts.map(([s, z], i) => `${i ? 'L' : 'M'}${G.X(s).toFixed(1)},${G.Y(z).toFixed(1)}`).join('')); }
  function hidePrev() { const p = hovEl('.ple-prev'); if (p) p.setAttribute('d', ''); }
  function hover(px, py) {
    const ctx = st.ctx, G = st.geo, g = hovEl('.ple-hov'); if (!g || !ctx) return;
    const inside = px >= M.l && px <= M.l + G.pw && py >= M.t && py <= M.t + G.ph;
    if (!inside) { if (!st.form) g.style.display = 'none'; read.textContent = 'Survolez le profil : abscisse, cotes TN et projet, écart, pente.'; return; }
    g.style.display = '';
    const s = G.S(px), zt = tnAt(s), inRed = ctx.defined && s >= ctx.PL.nodes[0].s - 1e-6 && s <= ctx.PL.sEnd + 1e-6, zr = inRed ? ctx.PL.zAt(s) : null;
    hovEl('.ple-cur').setAttribute('x1', px); hovEl('.ple-cur').setAttribute('x2', px);
    const mt = hovEl('.ple-mtn'), mr = hovEl('.ple-mred');
    mt.style.display = zt == null ? 'none' : ''; if (zt != null) { mt.setAttribute('cx', px); mt.setAttribute('cy', G.Y(zt)); }
    mr.style.display = zr == null ? 'none' : ''; if (zr != null) { mr.setAttribute('cx', px); mr.setAttribute('cy', G.Y(zr)); }
    const sn = hovEl('.ple-snap'), q = st.tool === 'add' ? snapZ(s, py) : null;
    sn.style.display = q?.kind ? '' : 'none'; if (q?.kind) { sn.setAttribute('transform', `translate(${px} ${G.Y(q.z)})`); sn.setAttribute('class', `ple-snap ${q.kind}`); }
    const nd = nodeAt(px, py);
    svg.style.cursor = st.win ? 'crosshair' : st.tool === 'sel' ? (nd && !nd.inf.fixed ? 'grab' : 'default') : st.tool === 'add' ? 'crosshair' : nd ? 'pointer' : st.tool === 'slope' && segAt(px, py) != null ? 'pointer' : 'default';
    const parts = [`s = ${fmt(s, 2)} m`, `TN ${zt == null ? '—' : fmt(zt, 2)}`, `projet ${zr == null ? '—' : fmt(zr, 2)}`];
    if (zt != null && zr != null) parts.push(`écart ${zr - zt >= 0 ? '+' : '−'}${fmt(Math.abs(zr - zt), 2)} m (${zr - zt >= 0 ? 'remblai' : 'déblai'})`);
    if (zr != null) parts.push(`pente ${pct(ctx.PL.gradeAt(s))}`);
    if (st.tool === 'add') parts.push(`point à z = ${fmt(q.z, 2)}${q.kind ? (q.kind === 'tn' ? ' (TN)' : ' (sur la ligne rouge)') : ''}`);
    if (nd) parts.push(`${nd.inf.label} : s ${fmt(nd.n.s, 2)}, z ${fmt(nd.n.z, 3)}`);
    read.textContent = parts.join(' · ');
  }

  // ------------------------------------------------------------------ événements
  const pos = (e) => { const r = svg.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  svg.addEventListener('wheel', (e) => { if (!st.ctx) return; e.preventDefault(); const [x, y] = pos(e); zoomAt(Math.pow(1.0015, -e.deltaY), x, y); hover(x, y); }, { passive: false });
  svg.addEventListener('pointerdown', (e) => {
    if (!st.ctx || e.button === 2) return;
    const [x, y] = pos(e), nd = nodeAt(x, y);
    svg.setPointerCapture?.(e.pointerId);
    if (st.win) { st.drag = { kind: 'win', x0: x, y0: y }; return; }
    if (e.button === 1 || (st.tool === 'sel' && !(nd && !nd.inf.fixed))) { st.drag = { kind: 'pan', x0: x, y0: y, v: { ...st.view }, moved: false, nd }; return; }
    if (st.tool === 'sel' && nd && !nd.inf.fixed) { st.sel = nd.inf.pi; st.drag = { kind: 'pt', pi: nd.inf.pi, moved: false }; draw(); }
  });
  svg.addEventListener('pointermove', (e) => {
    if (!st.ctx) return;
    const [x, y] = pos(e), d = st.drag, G = st.geo;
    if (d?.kind === 'pan') {
      if (Math.abs(x - d.x0) + Math.abs(y - d.y0) > 3) d.moved = true;
      const ds = (x - d.x0) / G.sx, dz = (y - d.y0) / G.sz;
      st.view = { ...d.v, s0: d.v.s0 - ds, s1: d.v.s1 - ds, zc: d.v.zc + dz, fit: !d.moved && d.v.fit };
      if (!st.raf) st.raf = requestAnimationFrame(() => { st.raf = 0; draw(); });
      return;
    }
    if (d?.kind === 'win') { const r = hovEl('.ple-win'); hovEl('.ple-hov').style.display = ''; r.setAttribute('x', Math.min(x, d.x0)); r.setAttribute('y', Math.min(y, d.y0)); r.setAttribute('width', Math.abs(x - d.x0)); r.setAttribute('height', Math.abs(y - d.y0)); return; }
    if (d?.kind === 'pt') {
      d.moved = true;
      const ctx = st.ctx, pis = pisCopy(), lo = Math.max(ctx.sMin, ...ctx.PL.nodes.filter((n) => n.s < pis[d.pi].s - 1e-9).map((n) => n.s)) + 0.5;
      const hi = Math.min(...ctx.PL.nodes.filter((n) => n.s > pis[d.pi].s + 1e-9).map((n) => n.s), Infinity) - 0.5;
      const s = Math.max(lo, Math.min(hi, Math.round(G.S(x) * 10) / 10));
      const zt = st.snap ? tnAt(s) : null, z = zt != null && Math.abs(G.Y(zt) - y) < 9 ? zt : Math.round(G.Z(y) * 100) / 100;
      pis[d.pi] = { ...pis[d.pi], s, z };
      if (!st.raf) st.raf = requestAnimationFrame(() => { st.raf = 0; commit(pis, null, { commit: false }); });
      return;
    }
    hover(x, y);
  });
  svg.addEventListener('pointerup', (e) => {
    if (!st.ctx) return;
    const [x, y] = pos(e), d = st.drag; st.drag = null;
    if (d?.kind === 'win') {
      st.win = false; hovEl('.ple-win')?.setAttribute('width', 0);
      if (Math.abs(x - d.x0) > 8 && Math.abs(y - d.y0) > 8) {
        const G = st.geo, s0 = G.S(Math.min(x, d.x0)), s1 = G.S(Math.max(x, d.x0)), za = G.Z(Math.max(y, d.y0)), zb = G.Z(Math.min(y, d.y0));
        const sx = G.pw / (s1 - s0), sxz = G.ph / ((zb - za) * st.view.ve), f = Math.min(sx, sxz); // un seul facteur : le plus contraignant
        const sm = (s0 + s1) / 2, half = G.pw / f / 2; st.view = { ...st.view, s0: sm - half, s1: sm + half, zc: (za + zb) / 2, fit: false };
      }
      draw(); return;
    }
    if (d?.kind === 'pt') { if (d.moved) { cancelAnimationFrame(st.raf); st.raf = 0; hooks.commit?.(); } draw(); return; }
    if (d?.kind === 'pan') { if (!d.moved) { st.sel = d.nd && !d.nd.inf.fixed ? d.nd.inf.pi : -1; draw(); } return; }
    if (st.form && st.tool !== 'slope' && st.tool !== 'radius') return;
    const nd = nodeAt(x, y), G = st.geo;
    if (st.tool === 'add') { const s = G.S(x), q = snapZ(s, y), err = addAt(Math.round(s * 10) / 10, Math.round(q.z * 1000) / 1000); if (err) hooks.toast?.(err, 'warn'); return; }
    if (st.tool === 'slope') { if (nd) startSlope(nd.k); else { const j = segAt(x, y); if (j != null) startSegSlope(j); } return; }
    if (st.tool === 'radius') { if (nd) startRadius(nd.k); return; }
    if (st.tool === 'del') { if (nd && !nd.inf.fixed) del(nd.inf.pi); else if (nd) hooks.toast?.('Point imposé : non supprimable.', 'warn'); }
  });
  svg.addEventListener('pointerleave', () => { if (!st.drag) { const g = hovEl('.ple-hov'); if (g && !st.form) g.style.display = 'none'; } });
  svg.addEventListener('contextmenu', (e) => { e.preventDefault(); setTool('sel'); });
  function setTool(t) { st.tool = t; st.win = false; closeForm(); syncBar(); }
  host.querySelector('.ple-tools').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !st.ctx) return;
    if (b.dataset.tool) { setTool(b.dataset.tool); return; }
    const a = b.dataset.act;
    if (a === 'sz') openSZ();
    else if (a === 'draft') openDraft();
    else if (a === 'undo') hooks.undo?.();
    else if (a === 'redo') hooks.redo?.();
    else if (a === 'clear') { if (st.ctx.pis.length && window.confirm('Effacer tous les points saisis de cet axe ? (Annuler permet de revenir)')) { st.sel = -1; commit([], null); } }
  });
  host.querySelector('.ple-loupes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-zoom]'); if (!b || !st.ctx) return;
    const z = b.dataset.zoom, G = st.geo;
    if (z === 'all') { zoomAll(); draw(); } else if (z === 'win') { st.win = true; syncBar(); } else zoomAt(z === 'in' ? 1.5 : 1 / 1.5, M.l + G.pw / 2, M.t + G.ph / 2);
  });
  $('[data-ve]').addEventListener('change', (e) => { st.ve = +e.target.value; if (st.ve > 0 && st.view) { const G = st.geo, zMid = G.Z(G.mid); st.view.ve = st.ve; st.view.zc = zMid; draw(); } else { zoomAll(); draw(); } });
  $('[data-snap]').addEventListener('change', (e) => { st.snap = e.target.checked; });
  $('[data-labels]').addEventListener('change', (e) => { st.labels = e.target.checked; draw(); });
  insp.addEventListener('change', (e) => {
    const f = e.target.dataset.f; if (!f || st.sel < 0) return;
    const v = pnum(e.target.value); if (!Number.isFinite(v)) return;
    const pis = pisCopy(), q = pis[st.sel]; q[f] = f === 'R' ? Math.max(0, v) : v; commit(pis, q);
  });
  insp.addEventListener('click', (e) => {
    const b = e.target.closest('[data-insp]'); if (!b || st.sel < 0) return;
    if (b.dataset.insp === 'del') del(st.sel);
    else { const pis = pisCopy(), z = tnAt(pis[st.sel].s); if (z != null) { pis[st.sel].z = z; commit(pis, pis[st.sel]); } }
  });
  host.tabIndex = 0;
  host.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea')) { if (e.key === 'Escape') { closeForm(); e.preventDefault(); } return; }
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z')) { e.preventDefault(); (e.shiftKey ? hooks.redo : hooks.undo)?.(); return; }
    if ((e.ctrlKey || e.metaKey) && (k === 'y' || k === 'Y')) { e.preventDefault(); hooks.redo?.(); return; }
    if (k === 'Escape') { setTool('sel'); e.preventDefault(); e.stopPropagation(); return; }
    if (k === 'Delete' || k === 'Backspace') { if (st.sel >= 0) { del(st.sel); e.preventDefault(); } return; }
    const map = { p: 'add', i: 'slope', r: 'radius' };
    if (map[k.toLowerCase()]) { setTool(map[k.toLowerCase()]); e.preventDefault(); return; }
    if (k === 'f' || k === 'F') { zoomAll(); draw(); e.preventDefault(); return; }
    if (k === '+' || k === '=') { const G = st.geo; zoomAt(1.5, M.l + G.pw / 2, M.t + G.ph / 2); } else if (k === '-') { const G = st.geo; zoomAt(1 / 1.5, M.l + G.pw / 2, M.t + G.ph / 2); }
  });
  host.addEventListener('pointerdown', () => { if (!host.contains(document.activeElement) || document.activeElement === document.body) host.focus({ preventScroll: true }); });
  // Redimensionnement : la vue « tout » se recadre, une vue zoomée garde son échelle.
  const ro = new ResizeObserver(() => { if (!st.ctx || !plot.clientWidth) return; if (!st.view || st.view.fit) zoomAll(); draw(); });
  ro.observe(plot);

  return {
    // Rend le contexte courant (appelé à chaque mise à jour du projet) ; garde le zoom tant que l'axe est le même.
    render(ctx) {
      const changed = ctx.key !== st.key;
      st.ctx = ctx;
      if (changed) { st.key = ctx.key; st.view = null; st.sel = -1; closeForm(); }
      if (st.sel >= ctx.pis.length) st.sel = -1;
      if (!plot.clientWidth) return;
      draw();
    },
    zoomAll() { zoomAll(); draw(); },
    get sel() { return st.sel; },
    set sel(i) { st.sel = i; if (st.ctx) draw(); },
  };
}
