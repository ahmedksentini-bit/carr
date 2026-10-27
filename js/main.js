// main.js — application GIRA : état du projet, outils de dessin, panneaux, imports / exports.
import * as G from './geom.js';
import { makeCRS, CRS_PRESETS, utmZoneOf } from './crs.js';
import { TileLayer, PROVIDERS } from './tiles.js';
import { parseDXF, buildDxfGeometry } from './dxf-parse.js';
import { DxfWriter } from './dxf-write.js';
import { Viewer, THEMES, drawDesign, drawDxf, buildDxfCache, snapDxf, drawGrid, drawHud, niceStep } from './viewer.js';
import { buildDesign, fmt, fmtGis } from './roundabout.js';
import { PRESETS, RING_DEVERS, GUIDE_NOTES, aciRow, checkDesign, hintFor, getPath, setPath } from './norms.js';
import { LAYERS } from './layers.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const parseNum = (v) => {
  if (v === '' || v == null) return '';
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : '';
};
const showNum = (v) => (v === '' || v == null ? '' : String(v).replace('.', ','));

// ================================================================ Projet
let seq = 0;
const uid = () => 'b' + Date.now().toString(36) + (seq++).toString(36);

function nextName(prj) {
  const names = new Set(prj.branches.map((b) => b.name));
  let k = prj.branches.length + 1;
  while (names.has('B' + k)) k++;
  return 'B' + k;
}

function newBranch(prj, axis) {
  const P = PRESETS[prj.context].branch;
  const row = prj.context === 'interurbain' ? aciRow(+prj.ring.Rg) : null;
  return {
    id: uid(), name: nextName(prj), axis, radial: true,
    nIn: 1, nOut: 1, wLane: P.wLane,
    le: P.le, ls: row ? row.ls : P.ls, Re: row ? Math.min(row.Re, +prj.ring.Rg) : P.Re, Rs: row ? row.Rs : P.Rs,
    island: { type: 'physique', base: '', length: '', gap: '', shift: '' },
    tpc: { on: false, width: P.tpcWidth },
    length: '', pente: '', camber: P.camber, transition: '',
  };
}

function newProject(context = 'interurbain') {
  const R = PRESETS[context].ring;
  return {
    app: 'GIRA', version: 1, name: 'Giratoire sans titre', context,
    crs: { id: 'utm', zone: 32, south: false, def: '' },
    bg: { provider: 'esri', opacity: 1 },
    center: { auto: true, x: null, y: null },
    ring: { Rg: R.Rg, la: R.la, bf: R.bf, zC: 100, devers: R.devers, pente: 0, gisPente: 0, mode: 'aci' },
    branches: [],
    opts: { angleUnit: 'gon', textH: 0.8, theme: 'dark', vis: {}, dxfOpacity: 0.9 },
  };
}

function migrate(p) {
  const base = newProject(p.context === 'urbain' ? 'urbain' : 'interurbain');
  const out = {
    ...base, ...p,
    ring: { ...base.ring, ...p.ring }, opts: { ...base.opts, ...p.opts, vis: { ...(p.opts?.vis || {}) } },
    center: { ...base.center, ...p.center }, crs: { ...base.crs, ...p.crs }, bg: { ...base.bg, ...p.bg },
  };
  delete out.view;
  out.ring.devers = RING_DEVERS; // valeur imposée
  out.branches = [];
  for (const b of p.branches || []) {
    if (!Array.isArray(b.axis) || b.axis.length < 2) continue;
    const t = newBranch(out, b.axis.map((q) => ({ x: +q.x, y: +q.y })));
    out.branches.push({ ...t, ...b, axis: t.axis, island: { ...t.island, ...b.island }, tpc: { ...t.tpc, ...b.tpc } });
  }
  return out;
}

// ================================================================ État
const S = {
  prj: null, D: null, checks: [], crs: null,
  dxf: null, dxfCache: null, dxfName: '', dxfRaw: null,
  tool: 'select', sel: -1, hover: -1,
  draft: [], meas: [], drag: null, mouse: null, cursorW: null, snap: null,
  tog: { snap: true, ortho: false, grid: false }, space: false,
  hist: [], fut: [],
};
let viewer, tiles;

function init() {
  viewer = new Viewer($('#cv'));
  viewer.onRender = (ctx, v) => renderScene(ctx, v);
  tiles = new TileLayer(() => viewer.invalidate());
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('gira.autosave') || 'null'); } catch { saved = null; }
  S.prj = saved && saved.app === 'GIRA' ? migrate(saved) : newProject();
  applyCRS();
  buildStaticPanels();
  bindUI();
  bindCanvas();
  bindKeys();
  update({ commit: false });
  S.hist = [JSON.stringify(S.prj)];
  setTool('select');
  requestAnimationFrame(() => {
    const v = saved?.view;
    if (v && isFinite(v.cx) && isFinite(v.s)) { viewer.cx = v.cx; viewer.cy = v.cy; viewer.s = v.s; viewer.invalidate(); }
    else if (S.prj.branches.length) zoomGira();
    else if (S.crs.geo) goToLL(36.8065, 10.1815, 0.25);
  });
}

// ================================================================ Coordonnées
function applyCRS() {
  S.crs = makeCRS(S.prj.crs);
  if (S.prj.crs.id !== 'local' && !S.crs.geo) toast('Système de coordonnées non reconnu : vérifiez la définition proj4.', 'warn');
}

function goToLL(lat, lon, s) {
  if (!S.crs.geo) { toast('Système local : choisissez un système géoréférencé pour vous localiser.', 'warn'); return; }
  if (S.prj.crs.id === 'utm' && !S.prj.branches.length) {
    const z = utmZoneOf(lon), south = lat < 0;
    if (z !== +S.prj.crs.zone || south !== !!S.prj.crs.south) { S.prj.crs.zone = z; S.prj.crs.south = south; applyCRS(); syncCrsUI(); }
  }
  const w = S.crs.fromLL(lon, lat);
  viewer.cx = w.x; viewer.cy = w.y;
  if (s) viewer.s = s;
  viewer.invalidate(); autosave();
}

function changeCRS(cfg) {
  const old = S.crs, nxt = makeCRS(cfg);
  if (cfg.id !== 'local' && !nxt.geo) { toast('Définition non valide.', 'err'); syncCrsUI(); return; }
  const tr = (p) => { const ll = old.toLL(p.x, p.y); const q = nxt.fromLL(ll.lon, ll.lat); return { x: q.x, y: q.y }; };
  if (old.geo && nxt.geo) {
    if (S.prj.branches.length) {
      S.prj.branches.forEach((b) => (b.axis = b.axis.map(tr)));
      toast('Axes reprojetés dans le nouveau système.');
    }
    if (S.prj.center.x != null) { const q = tr({ x: +S.prj.center.x, y: +S.prj.center.y }); S.prj.center.x = q.x; S.prj.center.y = q.y; }
    const c = tr({ x: viewer.cx, y: viewer.cy }); viewer.cx = c.x; viewer.cy = c.y;
  }
  S.prj.crs = cfg; S.crs = nxt;
  syncCrsUI(); update();
}

// ================================================================ Mise à jour
function update({ commit = true, panels = true } = {}) {
  try { S.D = buildDesign(S.prj); } catch (e) { console.error(e); S.D = null; toast('Erreur de calcul : ' + e.message, 'err'); }
  if (S.prj.center.auto && S.D?.O) { S.prj.center.x = S.D.O.x; S.prj.center.y = S.D.O.y; }
  try { S.checks = checkDesign(S.prj, S.D); } catch (e) { console.error(e); S.checks = []; }
  if (panels) refreshPanels();
  viewer.invalidate();
  if (commit) commitHistory();
  autosave();
}

function commitHistory() {
  const js = JSON.stringify(S.prj);
  if (S.hist[S.hist.length - 1] === js) return;
  S.hist.push(js);
  if (S.hist.length > 150) S.hist.shift();
  S.fut = [];
}
function undo() { if (S.hist.length < 2) return; S.fut.push(S.hist.pop()); restore(S.hist[S.hist.length - 1]); }
function redo() { if (!S.fut.length) return; const js = S.fut.pop(); S.hist.push(js); restore(js); }
function restore(js) {
  S.prj = JSON.parse(js);
  if (S.sel >= S.prj.branches.length) S.sel = -1;
  applyCRS(); syncCrsUI(); syncCtxUI(); renderBranchForm();
  update({ commit: false });
}

let saveTimer = null;
function autosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem('gira.autosave', JSON.stringify({ ...S.prj, view: { cx: viewer.cx, cy: viewer.cy, s: viewer.s } })); } catch { /* stockage indisponible */ }
  }, 500);
}

// ================================================================ Rendu
function renderScene(ctx, v, exp = null) {
  const theme = S.prj.opts.theme === 'light' ? 'light' : 'dark', T = THEMES[theme];
  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  ctx.fillStyle = T.bg; ctx.fillRect(0, 0, v.W, v.H);
  const imagery = S.crs.geo && S.prj.bg.provider !== 'none' && !exp?.noTiles;
  if (imagery) {
    tiles.provider = S.prj.bg.provider; tiles.opacity = +S.prj.bg.opacity || 1;
    try { tiles.draw(ctx, v, S.crs, v.dpr); } catch (e) { console.warn(e); }
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  }
  if (S.tog.grid) drawGrid(ctx, v, theme);
  if (S.dxf) { drawDxf(ctx, v, S.dxf, S.dxfCache, theme, +S.prj.opts.dxfOpacity || 1); ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0); }
  drawDesign(ctx, v, S.D, theme, S.prj.opts.vis, { onImagery: imagery && S.prj.bg.provider === 'esri' });
  drawAxes(ctx, v, T, !!exp);
  if (!exp) drawOverlay(ctx, v, T);
  drawHud(ctx, v, theme, northAngle(v), imagery ? PROVIDERS[S.prj.bg.provider].attr : '');
}

function northAngle(v) {
  if (!S.crs.geo) return 0;
  try {
    const ll = S.crs.toLL(v.cx, v.cy), q = S.crs.fromLL(ll.lon, Math.min(89, ll.lat + 0.001));
    return -Math.atan2(q.x - v.cx, q.y - v.cy);
  } catch { return 0; }
}

function drawAxes(ctx, v, T, exp) {
  if (S.prj.opts.vis.AXE_SAISI === false) return;
  S.prj.branches.forEach((b, i) => {
    if (!b.axis?.length) return;
    const sel = !exp && i === S.sel, hov = !exp && i === S.hover;
    ctx.strokeStyle = sel ? T.sel : hov ? T.hover : T.L.AXE_SAISI.stroke;
    ctx.lineWidth = sel ? 2.4 : hov ? 2 : T.L.AXE_SAISI.w;
    ctx.setLineDash(sel || hov ? [] : T.L.AXE_SAISI.dash);
    ctx.beginPath();
    b.axis.forEach((p, k) => { const [x, y] = v.w2s(p.x, p.y); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.setLineDash([]);
    if (sel || hov) {
      ctx.fillStyle = sel ? T.sel : T.hover;
      for (const p of b.axis) { const [x, y] = v.w2s(p.x, p.y); ctx.fillRect(x - 3.5, y - 3.5, 7, 7); }
    }
  });
}

function drawOverlay(ctx, v, T) {
  if (S.D?.O) {
    const [x, y] = v.w2s(S.D.O.x, S.D.O.y);
    ctx.strokeStyle = S.prj.center.auto ? T.L.AXE.stroke : T.sel; ctx.lineWidth = 1.6; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 7, y); ctx.closePath(); ctx.stroke();
  }
  const cur = S.cursorW;
  const poly = (pts, color) => {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.6;
    ctx.beginPath();
    pts.forEach((p, k) => { const [x, y] = v.w2s(p.x, p.y); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
    for (const p of pts) { const [x, y] = v.w2s(p.x, p.y); ctx.fillRect(x - 3, y - 3, 6, 6); }
  };
  if (S.tool === 'axis' && S.draft.length) poly(cur ? [...S.draft, cur] : S.draft, T.rubber);
  if (S.tool === 'measure' && S.meas.length) poly(S.meas.length === 1 && cur ? [S.meas[0], cur] : S.meas, T.rubber);
  if (S.snap) {
    const [x, y] = v.w2s(S.snap.x, S.snap.y);
    ctx.strokeStyle = T.snap; ctx.lineWidth = 2; ctx.strokeRect(x - 6, y - 6, 12, 12);
  }
}

// ================================================================ Outils
const PROMPTS = {
  select: 'Sélection : cliquez un axe pour le modifier ; glissez ses sommets ou le centre.',
  pan: 'Panoramique : glissez pour déplacer la vue.',
  axis0: 'Axe : cliquez le 1er point, côté extérieur (ou saisissez X,Y).',
  axis1: 'Axe : point suivant vers le carrefour — Entrée / clic droit pour terminer, Retour arrière pour annuler.',
  center: 'Centre : cliquez la position du centre de l\'anneau.',
  measure: 'Mesure : cliquez deux points.',
};

function setTool(t) {
  if (S.tool === 'axis' && t !== 'axis' && S.draft.length >= 2) finishAxis();
  S.tool = t; S.draft = []; S.meas = []; S.drag = null;
  $$('.tools [data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  updateCursor(); setPrompt(); viewer.invalidate();
}
function updateCursor() {
  $('#cv').style.cursor = S.space || S.tool === 'pan' ? 'grab' : S.tool === 'select' ? 'default' : 'crosshair';
}
function setPrompt() {
  const k = S.tool === 'axis' ? (S.draft.length ? 'axis1' : 'axis0') : S.tool;
  $('#stPrompt').textContent = PROMPTS[k] || '';
  $('#empty').hidden = !!S.prj.branches.length || S.tool === 'axis';
}
function cancelTool() {
  if (S.tool === 'axis' && S.draft.length) { S.draft = []; setPrompt(); viewer.invalidate(); return; }
  setTool('select');
}
function toggle(k) {
  S.tog[k] = !S.tog[k];
  $$(`.tog[data-tog="${k}"]`).forEach((b) => b.classList.toggle('on', S.tog[k]));
  viewer.invalidate();
}

function dedupe(pts) {
  const out = [];
  for (const p of pts) if (!out.length || G.dist(out[out.length - 1], p) > 0.05) out.push(p);
  return out;
}

function finishAxis() {
  const pts = dedupe(S.draft);
  S.draft = [];
  if (pts.length >= 2) {
    S.prj.branches.push(newBranch(S.prj, pts));
    S.sel = S.prj.branches.length - 1;
    renderBranchForm(); showTab('branches');
    update();
    if (S.prj.branches.length === 1) toast('Première branche créée : dessinez les suivantes, le centre se calcule à l\'intersection des axes.');
  }
  setPrompt(); viewer.invalidate();
}

function deleteBranch(i) {
  const b = S.prj.branches[i];
  if (!b || !confirm(`Supprimer la branche ${b.name} ?`)) return;
  S.prj.branches.splice(i, 1);
  S.sel = -1; S.hover = -1;
  renderBranchForm(); update();
}

function selectBranch(i) {
  if (S.sel === i) return;
  S.sel = i;
  renderBranchForm(); refreshPanels(); viewer.invalidate();
}

function pickPoint(px, py) {
  let [x, y] = viewer.s2w(px, py);
  S.snap = null;
  if (S.tog.snap && S.tool !== 'pan') {
    let best = null, bd = 10 / viewer.s;
    const consider = (p, kind) => { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = { x: p.x, y: p.y, kind }; } };
    S.prj.branches.forEach((b, i) => b.axis.forEach((p, k) => { if (!(S.drag?.kind === 'vertex' && S.drag.bi === i && S.drag.vi === k)) consider(p, 'sommet'); }));
    S.draft.forEach((p) => consider(p, 'sommet'));
    if (S.D && S.drag?.kind !== 'center') { S.D.points.forEach((q) => consider(q.p, 'point')); if (S.D.O) consider(S.D.O, 'centre'); }
    const d = snapDxf(S.dxfCache, x, y, bd);
    if (d) consider(d, 'DXF');
    if (best) { S.snap = best; return { x: best.x, y: best.y }; }
  }
  const last = S.tool === 'axis' ? S.draft[S.draft.length - 1] : S.tool === 'measure' && S.meas.length === 1 ? S.meas[0] : null;
  if (S.tog.ortho && last) { if (Math.abs(x - last.x) > Math.abs(y - last.y)) y = last.y; else x = last.x; }
  return { x, y };
}

function hitHandle(px, py) {
  const vtx = (i) => {
    const b = S.prj.branches[i];
    for (let k = 0; k < b.axis.length; k++) {
      const [x, y] = viewer.w2s(b.axis[k].x, b.axis[k].y);
      if (Math.hypot(px - x, py - y) < 7) return { kind: 'vertex', bi: i, vi: k };
    }
    return null;
  };
  if (S.sel >= 0) { const h = vtx(S.sel); if (h) return h; }
  if (S.D?.O) { const [x, y] = viewer.w2s(S.D.O.x, S.D.O.y); if (Math.hypot(px - x, py - y) < 9) return { kind: 'center' }; }
  if (S.hover >= 0) { const h = vtx(S.hover); if (h) return h; }
  return null;
}

function hitAxis(px, py) {
  const P = { x: px, y: py };
  let best = -1, bd = 7;
  S.prj.branches.forEach((b, i) => {
    for (let k = 0; k + 1 < b.axis.length; k++) {
      const a = viewer.w2s(b.axis[k].x, b.axis[k].y), c = viewer.w2s(b.axis[k + 1].x, b.axis[k + 1].y);
      const d = G.distToSeg(P, { x: a[0], y: a[1] }, { x: c[0], y: c[1] });
      if (d < bd) { bd = d; best = i; }
    }
  });
  if (best < 0 && S.D) {
    for (const q of S.D.branches) {
      const a = q.W({ x: q.x0, y: q.a }), c = q.W({ x: q.xEnd, y: q.a });
      const sa = viewer.w2s(a.x, a.y), sc = viewer.w2s(c.x, c.y);
      const d = G.distToSeg(P, { x: sa[0], y: sa[1] }, { x: sc[0], y: sc[1] });
      if (d < Math.max(10, 4 * viewer.s)) { best = q.idx; break; }
    }
  }
  return best;
}

function bindCanvas() {
  const cv = $('#cv');
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [px, py] = pos(e);
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    viewer.zoomAt(Math.pow(1.0016, -dy), px, py);
    onMove(px, py); autosave();
  }, { passive: false });

  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    const [px, py] = pos(e);
    if (e.button === 1 || (e.button === 0 && (S.tool === 'pan' || S.space))) {
      S.drag = { kind: 'pan', px, py, moved: false }; cv.style.cursor = 'grabbing'; return;
    }
    if (e.button === 2) {
      if (S.tool === 'axis') finishAxis();
      else if (S.tool === 'measure') { S.meas = []; viewer.invalidate(); }
      else if (S.tool !== 'select') setTool('select');
      return;
    }
    if (e.button !== 0) return;
    const w = pickPoint(px, py);
    if (S.tool === 'axis') { S.draft.push(w); setPrompt(); }
    else if (S.tool === 'center') { S.prj.center = { auto: false, x: w.x, y: w.y }; syncInputs(); update(); setTool('select'); }
    else if (S.tool === 'measure') { S.meas.push(w); if (S.meas.length > 2) S.meas = [w]; showMeasure(); }
    else if (S.tool === 'select') {
      const h = hitHandle(px, py);
      if (h) { S.drag = { ...h, moved: false }; if (h.bi != null) selectBranch(h.bi); return; }
      const bi = hitAxis(px, py);
      if (bi >= 0) selectBranch(bi);
      S.drag = { kind: 'pan', px, py, moved: false, deselect: bi < 0 };
    }
    viewer.invalidate();
  });

  cv.addEventListener('pointermove', (e) => { const [px, py] = pos(e); onMove(px, py, e); });

  cv.addEventListener('pointerup', () => {
    const d = S.drag;
    S.drag = null; updateCursor();
    if (!d) return;
    if ((d.kind === 'vertex' || d.kind === 'center') && d.moved) { syncInputs(); update(); }
    else if (d.kind === 'pan') { if (!d.moved && d.deselect && S.sel >= 0) selectBranch(-1); autosave(); }
  });
  cv.addEventListener('dblclick', () => { if (S.tool === 'axis') finishAxis(); });
  cv.addEventListener('pointerleave', () => { S.mouse = null; S.cursorW = null; S.snap = null; $('#tip').hidden = true; viewer.invalidate(); });
}

function onMove(px, py) {
  S.mouse = { px, py };
  const d = S.drag;
  if (d?.kind === 'pan') {
    if (Math.abs(px - d.px) + Math.abs(py - d.py) > 0) { viewer.panPx(px - d.px, py - d.py); d.moved = true; }
    d.px = px; d.py = py;
    $('#cv').style.cursor = 'grabbing';
  }
  const w = d?.kind === 'pan' ? { x: viewer.s2w(px, py)[0], y: viewer.s2w(px, py)[1] } : pickPoint(px, py);
  S.cursorW = w;
  if (d?.kind === 'vertex') { S.prj.branches[d.bi].axis[d.vi] = w; d.moved = true; update({ commit: false, panels: false }); }
  else if (d?.kind === 'center') { S.prj.center = { auto: false, x: w.x, y: w.y }; d.moved = true; update({ commit: false, panels: false }); }
  else if (!d && S.tool === 'select') {
    const h = hitAxis(px, py);
    if (h !== S.hover) S.hover = h;
    const hh = hitHandle(px, py);
    $('#cv').style.cursor = hh ? 'move' : h >= 0 ? 'pointer' : 'default';
  }
  // Barre d'état
  $('#stXY').textContent = `X ${w.x.toFixed(3)}   Y ${w.y.toFixed(3)}`;
  if (S.crs.geo) { try { const ll = S.crs.toLL(w.x, w.y); $('#stLL').textContent = `${ll.lat.toFixed(6)}°, ${ll.lon.toFixed(6)}°`; } catch { /* hors domaine */ } }
  else $('#stLL').textContent = '';
  // Info-bulle
  const tip = $('#tip');
  const ref = S.tool === 'axis' ? S.draft[S.draft.length - 1] : S.tool === 'measure' && S.meas.length === 1 ? S.meas[0] : null;
  if (ref) {
    const L = G.dist(ref, w), a = Math.atan2(w.y - ref.y, w.x - ref.x);
    tip.textContent = `L = ${fmt(L, 2)} m · G = ${fmtGis(a, S.prj.opts.angleUnit)}${S.snap ? ' · ' + S.snap.kind : ''}`;
    tip.hidden = false;
  } else if (S.snap) { tip.textContent = S.snap.kind; tip.hidden = false; }
  else tip.hidden = true;
  if (!tip.hidden) { tip.style.left = px + 16 + 'px'; tip.style.top = py + 18 + 'px'; }
  viewer.invalidate();
}

function showMeasure() {
  if (S.meas.length === 2) {
    const [a, b] = S.meas, L = G.dist(a, b), g = Math.atan2(b.y - a.y, b.x - a.x);
    toast(`Distance ${fmt(L, 3)} m · gisement ${fmtGis(g, S.prj.opts.angleUnit)} · ΔX ${fmt(b.x - a.x, 3)} · ΔY ${fmt(b.y - a.y, 3)}`);
  }
}

// --------------------------------------------------------- Clavier
function bindKeys() {
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    if ((e.ctrlKey || e.metaKey) && (!typing || t.id === 'cmd')) {
      const k = e.key.toLowerCase();
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (k === 'y') { e.preventDefault(); redo(); return; }
      if (k === 's') { e.preventDefault(); saveProject(); return; }
    }
    if (typing) return;
    if ($('#dlgHelp').open) return;
    switch (e.key) {
      case 'Escape': cancelTool(); return;
      case 'Enter': if (S.tool === 'axis') finishAxis(); return;
      case 'Backspace': if (S.tool === 'axis' && S.draft.length) { e.preventDefault(); S.draft.pop(); setPrompt(); viewer.invalidate(); } return;
      case 'Delete': if (S.sel >= 0) deleteBranch(S.sel); return;
      case 'F3': e.preventDefault(); toggle('snap'); return;
      case 'F7': e.preventDefault(); toggle('grid'); return;
      case 'F8': e.preventDefault(); toggle('ortho'); return;
      case ' ': e.preventDefault(); if (!S.space) { S.space = true; updateCursor(); } return;
      default: break;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9@.\-]$/.test(e.key) && ['axis', 'measure', 'center'].includes(S.tool)) { $('#cmd').focus(); return; }
    const k = e.key.toLowerCase();
    const map = { s: () => setTool('select'), a: () => setTool('axis'), c: () => setTool('center'), m: () => setTool('measure'), h: () => setTool('pan'), g: zoomGira, e: zoomAll };
    if (map[k]) { e.preventDefault(); map[k](); }
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ') { S.space = false; updateCursor(); } });

  const cmd = $('#cmd');
  cmd.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); runCmd(cmd.value); cmd.value = ''; if (!['axis', 'measure'].includes(S.tool)) cmd.blur(); }
    else if (e.key === 'Escape') { cmd.value = ''; cmd.blur(); cancelTool(); }
  });
}

function runCmd(str) {
  const s = str.trim();
  if (!s) { if (S.tool === 'axis') finishAxis(); return; }
  const words = { axe: 'axis', a: 'axis', centre: 'center', c: 'center', mesure: 'measure', m: 'measure', s: 'select', select: 'select', pan: 'pan' };
  const low = s.toLowerCase();
  if (words[low]) { setTool(words[low]); return; }
  if (low === 'z' || low === 'zoom' || low === 'g') { zoomGira(); return; }
  if (low === 'e') { zoomAll(); return; }
  const p = parsePoint(s);
  if (!p) { toast('Saisie non reconnue : ' + s, 'warn'); return; }
  if (S.tool === 'axis') { S.draft.push(p); setPrompt(); }
  else if (S.tool === 'measure') { S.meas.push(p); if (S.meas.length > 2) S.meas = [p]; showMeasure(); }
  else if (S.tool === 'center') { S.prj.center = { auto: false, x: p.x, y: p.y }; syncInputs(); update(); setTool('select'); }
  else { viewer.cx = p.x; viewer.cy = p.y; }
  viewer.invalidate();
}

function parsePoint(s) {
  const last = S.tool === 'axis' ? S.draft[S.draft.length - 1] : S.tool === 'measure' ? S.meas[S.meas.length - 1] : null;
  s = s.replace(/\s+/g, '');
  let rel = false;
  if (s[0] === '@') { rel = true; s = s.slice(1); }
  if (s.includes('<')) {
    const [d, a] = s.split('<').map((x) => parseFloat(x.replace(',', '.')));
    if (!isFinite(d) || !isFinite(a) || !last) return null;
    const t = (a * Math.PI) / 180;
    return { x: last.x + d * Math.cos(t), y: last.y + d * Math.sin(t) };
  }
  let parts;
  if (s.includes(';')) parts = s.split(';').map((x) => parseFloat(x.replace(',', '.')));
  else if (s.includes(',')) parts = s.split(',').map(parseFloat);
  else {
    const d = parseFloat(s);
    if (!isFinite(d) || !last || !S.cursorW || G.dist(S.cursorW, last) < 1e-9) return null;
    return G.add(last, G.mul(G.norm(G.sub(S.cursorW, last)), d));
  }
  if (parts.length !== 2 || !parts.every(isFinite)) return null;
  if (rel) return last ? { x: last.x + parts[0], y: last.y + parts[1] } : null;
  return { x: parts[0], y: parts[1] };
}

// --------------------------------------------------------- Zoom
function designBBox() {
  const pts = [];
  if (S.D?.O) {
    const O = S.D.O, r = S.D.Rg;
    pts.push({ x: O.x - r, y: O.y - r }, { x: O.x + r, y: O.y + r });
    for (const bd of S.D.branches) pts.push(bd.entry.F, bd.exit.F, bd.W({ x: bd.xEnd + 8, y: bd.a }));
  }
  S.prj.branches.forEach((b) => pts.push(...b.axis));
  return pts.length ? G.bboxOf(pts) : null;
}
function zoomGira() {
  if (S.D?.O) {
    const O = S.D.O, r = S.D.Rg + Math.max(S.D.Rg, ...S.D.branches.map((bd) => bd.h)) + 15;
    viewer.fit({ x0: O.x - r, y0: O.y - r, x1: O.x + r, y1: O.y + r }, 0.02); autosave(); return;
  }
  zoomAll();
}
function zoomAll() {
  let bb = designBBox();
  if (S.dxf?.bbox) {
    const d = S.dxf.bbox;
    bb = bb ? { x0: Math.min(bb.x0, d.x0), y0: Math.min(bb.y0, d.y0), x1: Math.max(bb.x1, d.x1), y1: Math.max(bb.y1, d.y1) } : { ...d };
  }
  if (bb) { viewer.fit(bb); autosave(); }
}

// ================================================================ Panneaux
function fld(k, label, unit = 'm', { ph = '', branch = false, title = '', text = false } = {}) {
  const attr = branch ? 'data-bk' : 'data-k';
  return `<div class="fw"><label class="fld"${title ? ` title="${esc(title)}"` : ''}><span class="lb">${label}</span>` +
    `<input ${attr}="${k}" type="text" ${text ? 'data-type="text"' : 'inputmode="decimal"'} autocomplete="off" spellcheck="false" placeholder="${esc(ph)}">` +
    `<span class="un">${unit}</span></label><div class="hint" data-h="${k}"></div></div>`;
}
function sel(k, label, opts, { branch = true } = {}) {
  return `<label class="fld"><span class="lb">${label}</span><select ${branch ? 'data-bk' : 'data-k'}="${k}">` +
    opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('') + '</select></label>';
}

function buildStaticPanels() {
  $('#crsSel').innerHTML = CRS_PRESETS.map((p) => `<option value="${p.id}">${esc(p.label)}</option>`).join('');
  $('#ringFields').innerHTML =
    fld('ring.Rg', 'Rayon extérieur Rg', 'm', { title: 'Rayon du marquage de rive extérieure de l\'anneau' }) +
    fld('ring.la', 'Largeur de l\'anneau la', 'm') +
    fld('ring.bf', 'Bande franchissable bf', 'm');
  $('#deversFields').innerHTML =
    fld('ring.zC', 'Cote projet au centre zC', 'm') +
    fld('ring.devers', 'Dévers de l\'anneau d (vers l\'extérieur, imposé)', '%') +
    fld('ring.pente', 'Déclivité générale du site p', '%') +
    fld('ring.gisPente', 'Gisement de la ligne de plus grande pente (descente)', 'gr') +
    sel('ring.mode', 'Calage de l\'anneau', [['aci', 'Dévers constant, rive ext. dans la pente (ACI)'], ['cone', 'Cône posé sur le plan incliné']], { branch: false });
  $('[data-k="ring.devers"]').disabled = true; // 1,5 % imposé
  $('#visLayers').innerHTML = Object.entries(LAYERS).map(([k, l]) =>
    `<label class="chk"><input type="checkbox" data-vis="${k}"> ${esc(l.label)}</label>`).join('');
  syncCtxUI(); syncCrsUI(); syncInputs();
}

function syncCtxUI() {
  $$('#ctxSeg [data-ctx]').forEach((b) => b.classList.toggle('on', b.dataset.ctx === S.prj.context));
  $('#ctxNote').textContent = S.prj.context === 'interurbain'
    ? 'Valeurs par défaut et contrôles : SETRA, Aménagement des carrefours interurbains (ACI, 1998).'
    : 'Valeurs par défaut et contrôles : CERTU, Guide des carrefours urbains (1999) / fiche Giratoires urbains ; mini-giratoires (1997).';
  $('#ringGuide').innerHTML = '<h4>Rappels du guide</h4><ul>' + GUIDE_NOTES[S.prj.context].map((t) => `<li>${esc(t)}</li>`).join('') + '</ul>';
}

function syncCrsUI() {
  const c = S.prj.crs;
  $('#crsSel').value = c.id;
  $('#crsUtm').hidden = c.id !== 'utm';
  $('#crsZone').value = c.zone;
  $('#crsSouth').checked = !!c.south;
  $('#crsCustomRow').hidden = c.id !== 'custom';
  $('#crsDef').value = c.def || '';
  $('#crsNote').textContent = S.crs.geo
    ? `Coordonnées du projet : ${S.crs.label}. Un DXF topo dans ce système se superpose à l'imagerie.${window.proj4 ? '' : ' (proj4 non chargé : UTM uniquement)'}`
    : 'Système local : pas d\'imagerie. Les coordonnées sont celles du DXF importé.';
  $('#bgSel').value = S.prj.bg.provider;
  $('#bgOpacity').value = S.prj.bg.opacity;
  $('#bgSel').disabled = !S.crs.geo;
}

function syncInputs() {
  const br = S.sel >= 0 ? S.prj.branches[S.sel] : null;
  for (const el of $$('[data-k],[data-bk]')) {
    if (el === document.activeElement) continue;
    const src = el.dataset.k ? S.prj : br;
    if (!src) continue;
    const v = getPath(src, el.dataset.k || el.dataset.bk);
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.tagName === 'SELECT') el.value = v ?? '';
    else el.value = el.dataset.type === 'text' ? v ?? '' : showNum(typeof v === 'number' ? +v.toFixed(4) : v);
  }
  for (const el of $$('[data-h]')) {
    const isBranch = !!el.closest('#branchForm');
    if (isBranch && !br) continue;
    const h = hintFor(el.dataset.h, S.prj, isBranch ? br : null);
    el.textContent = h?.txt || '';
    el.className = 'hint' + (h?.lvl ? ' ' + h.lvl : '');
  }
  $('#centerAuto').checked = !!S.prj.center.auto;
  $('#prjName').value = S.prj.name;
  $('#themeSel').value = S.prj.opts.theme;
  $('#angSel').value = S.prj.opts.angleUnit;
  for (const el of $$('[data-vis]')) el.checked = S.prj.opts.vis[el.dataset.vis] !== false;
  const gl = $('[data-k="ring.gisPente"]')?.closest('.fld')?.querySelector('.un');
  if (gl) gl.textContent = 'gr';
}

function refreshPanels() {
  syncInputs();
  const D = S.D, br = S.prj.branches;
  // Anneau : grandeurs calculées
  const leMax = Math.max(0, ...br.map((b) => +b.le || 0));
  $('#ringOut').innerHTML = D?.O ? kv([
    ['Rayon intérieur Ri = Rg − la', fmt(D.Ri) + ' m'],
    ['Îlot central infranchissable', fmt(D.Rb) + ' m'],
    ['Diamètre extérieur 2·Rg', fmt(2 * D.Rg) + ' m'],
    ['1,2 × entrée la plus large', leMax ? fmt(1.2 * leMax) + ' m' : '—'],
    ['Branches', String(D.branches.length)],
    ['Centre', `${D.O.x.toFixed(3)} ; ${D.O.y.toFixed(3)}`],
  ]) : '<p class="note">Le centre sera calculé dès qu\'un axe sera dessiné.</p>';
  // Liste des branches
  const lvlOf = (name) => {
    const ls = S.checks.filter((c) => c.group === name).map((c) => c.lvl);
    return ls.includes('err') ? 'err' : ls.includes('warn') ? 'warn' : 'ok';
  };
  $('#branchList').innerHTML = br.length ? br.map((b, i) => {
    const bd = D?.branches.find((q) => q.idx === i);
    return `<li data-bi="${i}" class="${i === S.sel ? 'on' : ''}"><span class="dot ${lvlOf(b.name)}"></span><b>${esc(b.name)}</b>` +
      `<span class="mono dim">${bd ? bd.gis : '—'}</span><span class="dim">le ${fmt(+b.le)} · ls ${fmt(+b.ls)}${b.tpc?.on ? ' · TPC' : ''}</span></li>`;
  }).join('') : '<li class="empty-li">Aucune branche. Utilisez « Dessiner une branche » ou la touche A.</li>';
  refreshBranchOut();
  refreshDevers();
  refreshChecks();
  refreshPoints();
  setPrompt();
}

function kv(rows) {
  return '<dl>' + rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('') + '</dl>';
}

function renderBranchForm() {
  const host = $('#branchForm');
  const b = S.sel >= 0 ? S.prj.branches[S.sel] : null;
  if (!b) { host.innerHTML = '<p class="note">Sélectionnez une branche dans la liste ou cliquez son axe sur le plan.</p>'; return; }
  host.innerHTML = `
    <div class="bhead">${fld('name', 'Nom', '', { branch: true, text: true })}<button id="btnDelBranch" class="danger" title="Supprimer (Suppr)">Supprimer</button></div>
    <div id="branchOut" class="kv"></div>
    <h4>Axe</h4>
    <label class="chk"><input type="checkbox" data-bk="radial"> Axe radial (passe par le centre de l'anneau)</label>
    <h4>Voies de la branche</h4>
    <div class="row">${sel('nIn', 'Voies entrantes', [['1', '1'], ['2', '2']])}${sel('nOut', 'Voies sortantes', [['1', '1'], ['2', '2']])}</div>
    ${fld('wLane', 'Largeur de voie courante', 'm', { branch: true })}
    <h4>Entrée</h4>
    ${fld('le', 'Largeur d\'entrée le', 'm', { branch: true, title: 'Mesurée du bord de l\'îlot au bord extérieur, au droit de l\'anneau' })}
    ${fld('Re', 'Rayon d\'entrée Re', 'm', { branch: true })}
    <h4>Sortie</h4>
    ${fld('ls', 'Largeur de sortie ls', 'm', { branch: true })}
    ${fld('Rs', 'Rayon de sortie Rs', 'm', { branch: true })}
    <h4>Îlot séparateur</h4>
    ${sel('island.type', 'Type', [['physique', 'En saillie (bordures)'], ['peint', 'Peint (franchissable)'], ['aucun', 'Aucun']])}
    ${fld('island.base', 'Base du triangle', 'm', { branch: true, ph: 'auto' })}
    ${fld('island.length', 'Hauteur du triangle', 'm', { branch: true, ph: 'auto' })}
    ${fld('island.shift', 'Décalage vers la gauche', 'm', { branch: true, ph: 'auto' })}
    ${fld('island.gap', 'Retrait de la tête / anneau', 'm', { branch: true, ph: 'auto' })}
    <h4>Terre-plein central (TPC)</h4>
    <label class="chk"><input type="checkbox" data-bk="tpc.on"> Branche à chaussées séparées (TPC)</label>
    ${fld('tpc.width', 'Largeur du TPC', 'm', { branch: true })}
    <h4>Profil et dévers</h4>
    ${fld('length', 'Longueur dessinée depuis l\'anneau', 'm', { branch: true, ph: 'auto' })}
    ${fld('pente', 'Pente en long (+ en montée)', '%', { branch: true, ph: 'auto' })}
    ${fld('camber', 'Dévers courant (toit)', '%', { branch: true })}
    ${fld('transition', 'Longueur de variation du dévers', 'm', { branch: true, ph: 'auto' })}`;
  syncInputs();
  refreshBranchOut();
}

function refreshBranchOut() {
  const host = $('#branchOut');
  if (!host) return;
  const bd = S.D?.branches.find((q) => q.idx === S.sel);
  if (!bd) { host.innerHTML = '<p class="note">Branche non construite : voir l\'onglet Contrôles.</p>'; return; }
  const off = bd.a > 0.005 ? `${fmt(bd.a)} m à droite ⚠` : bd.a < -0.005 ? `${fmt(-bd.a)} m à gauche` : 'radial';
  host.innerHTML = kv([
    ['Gisement de l\'axe', bd.gis],
    ['Excentrement', off],
    ['Îlot (base × hauteur)', bd.isl.type === 'aucun' && !bd.th ? '—' : `${fmt(bd.b)} × ${fmt(bd.h)} m`],
    ['Décalage du triangle', fmt(bd.isl.shift) + ' m'],
    ['Largeur au droit de l\'anneau (entrée / sortie)', `${fmt(bd.entry.wRing)} / ${fmt(bd.exit.wRing)} m`],
    ['Déflexion', bd.defl ? `R ≈ ${fmt(bd.defl.R, 0)} m vers ${bd.defl.to}` : '—'],
  ]);
}

// --------------------------------------------------------- Dévers
function ticks(a, b, n = 5) {
  const st = niceStep((b - a) / n), out = [];
  for (let v = Math.ceil(a / st) * st; v <= b + 1e-9; v += st) out.push(+v.toFixed(10));
  return out;
}
function lineChart({ series, xMin, xMax, yMin, yMax, xLabel, yLabel, yFmt = (v) => fmt(v, 2), xTicks }) {
  const w = 360, h = 190, m = { l: 50, r: 12, t: 26, b: 34 };
  if (yMax - yMin < 1e-6) { yMax += 0.5; yMin -= 0.5; }
  const X = (x) => m.l + ((x - xMin) / (xMax - xMin)) * (w - m.l - m.r);
  const Y = (y) => h - m.b - ((y - yMin) / (yMax - yMin)) * (h - m.t - m.b);
  let s = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(yLabel)}">`;
  for (const t of ticks(yMin, yMax, 4)) s += `<line class="gl" x1="${m.l}" x2="${w - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="tk" x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${esc(yFmt(t))}</text>`;
  for (const t of xTicks || ticks(xMin, xMax, 5)) s += `<text class="tk" x="${X(t)}" y="${h - m.b + 15}" text-anchor="middle">${esc(fmt(t, 0))}</text>`;
  s += `<line class="ax" x1="${m.l}" x2="${w - m.r}" y1="${h - m.b}" y2="${h - m.b}"/>`;
  s += `<text class="al" x="${(m.l + w - m.r) / 2}" y="${h - 4}" text-anchor="middle">${esc(xLabel)}</text>`;
  let lx = m.l;
  series.forEach((se) => {
    const d = se.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join('');
    s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round"${se.dash ? ' stroke-dasharray="5 4"' : ''}/>`;
    s += `<line x1="${lx}" x2="${lx + 16}" y1="12" y2="12" stroke="${se.color}" stroke-width="2"${se.dash ? ' stroke-dasharray="5 4"' : ''}/><text class="lg" x="${lx + 20}" y="16">${esc(se.name)}</text>`;
    lx += 26 + se.name.length * 6.2;
  });
  s += `<text class="al" x="${m.l}" y="${m.t - 4}" text-anchor="start" opacity="0">${esc(yLabel)}</text></svg>`;
  return s;
}

function refreshDevers() {
  const D = S.D;
  if (!D?.devers) { $('#deversOut').innerHTML = ''; $('#ringChart').innerHTML = ''; $('#branchChart').innerHTML = ''; $('#branchDevTable').innerHTML = ''; return; }
  const dv = D.devers, pc = (v) => fmt(v * 100, 2) + ' %';
  const zs = D.ringProfile.map((q) => q.zExt), zi = D.ringProfile.map((q) => q.zInt);
  $('#deversOut').innerHTML = kv([
    ['Dévers radial de l\'anneau', dv.mode === 'cone' ? `${pc(dv.minRadial)} à ${pc(dv.maxRadial)}` : pc(dv.d) + ' constant'],
    ['Pente transversale maximale', pc(dv.maxTransverse)],
    ['Rive extérieure : cotes', `${fmt(Math.min(...zs), 3)} à ${fmt(Math.max(...zs), 3)} m`],
    ['Rive intérieure : cotes', `${fmt(Math.min(...zi), 3)} à ${fmt(Math.max(...zi), 3)} m`],
  ]);
  const ymin = Math.min(...zs, ...zi), ymax = Math.max(...zs, ...zi);
  $('#ringChart').innerHTML = lineChart({
    series: [
      { name: 'Rive extérieure (Rg)', color: 'var(--c1)', pts: D.ringProfile.map((q) => [q.gon, q.zExt]) },
      { name: 'Rive intérieure (Ri)', color: 'var(--c2)', pts: D.ringProfile.map((q) => [q.gon, q.zInt]) },
    ],
    xMin: 0, xMax: 400, xTicks: [0, 100, 200, 300, 400], yMin: ymin - 0.05, yMax: ymax + 0.05,
    xLabel: 'Gisement depuis le centre (gr)', yLabel: 'Cote (m)', yFmt: (v) => fmt(v, 2),
  });
  const bi = S.sel >= 0 ? S.sel : D.branches[0]?.idx;
  const db = dv.branches.find((q) => q.idx === bi);
  $('#dvBranchName').textContent = db ? db.name : 'branche';
  if (!db) { $('#branchChart').innerHTML = '<p class="note">Aucune branche construite.</p>'; $('#branchDevTable').innerHTML = ''; return; }
  const L = db.Ltr + 10;
  const pts = (s) => [[0, (s > 0 ? db.d0In : db.d0Out) * 100], [db.Ltr, db.camber * 100], [L, db.camber * 100]];
  const all = [db.d0In, db.d0Out, db.camber, 0].map((v) => v * 100);
  $('#branchChart').innerHTML = lineChart({
    series: [
      { name: 'Voie entrante', color: 'var(--c1)', pts: pts(1) },
      { name: 'Voie sortante', color: 'var(--c2)', pts: pts(-1), dash: true },
    ],
    xMin: 0, xMax: L, yMin: Math.min(...all) - 0.5, yMax: Math.max(...all) + 0.5,
    xLabel: 'Distance depuis le bord de l\'anneau (m)', yLabel: 'Dévers (%)', yFmt: (v) => fmt(v, 1) + ' %',
  });
  $('#branchDevTable').innerHTML = `<p class="note">Dévers négatif : la voie descend vers l'extérieur (bord de chaussée). Pente en long ${fmt(db.grade * 100, 2)} %, transition sur ${fmt(db.Ltr, 1)} m.</p>` +
    '<table class="pts"><thead><tr><th>Dist. (m)</th><th>Z axe</th><th>Dévers entrée</th><th>Dévers sortie</th></tr></thead><tbody>' +
    db.stations.map((q) => `<tr><td>${fmt(q.dx, 1)}</td><td>${fmt(q.zAxe, 3)}</td><td>${fmt(q.dIn * 100, 2)} %</td><td>${fmt(q.dOut * 100, 2)} %</td></tr>`).join('') +
    '</tbody></table>';
}

function refreshChecks() {
  const order = { err: 0, warn: 1, info: 2, ok: 3 };
  const list = [...S.checks].sort((a, b) => order[a.lvl] - order[b.lvl]);
  const icon = { err: '✕', warn: '!', info: 'i', ok: '✓' };
  $('#checks').innerHTML = list.map((c) => `<li class="${c.lvl}"><span class="ic">${icon[c.lvl]}</span><span class="grp">${esc(c.group)}</span><span>${esc(c.msg)}</span></li>`).join('');
  const n = S.checks.filter((c) => c.lvl === 'err').length, w = S.checks.filter((c) => c.lvl === 'warn').length;
  const bd = $('#chkBadge');
  bd.textContent = n ? String(n) : w ? String(w) : '';
  bd.className = 'badge' + (n ? ' err' : w ? ' warn' : '');
}

function refreshPoints() {
  const pts = S.D?.points || [];
  $('#ptsInfo').textContent = pts.length ? `${pts.length} points · ${S.crs.geo ? S.crs.label : 'coordonnées locales'}` : '';
  $('#ptsTable').innerHTML = pts.length
    ? '<thead><tr><th>N°</th><th>Désignation</th><th>X</th><th>Y</th><th>Z</th></tr></thead><tbody>' +
      pts.map((q) => `<tr data-pt="${q.n - 1}"><td>${q.n}</td><td>${esc(q.name)}</td><td class="mono">${q.p.x.toFixed(3)}</td><td class="mono">${q.p.y.toFixed(3)}</td><td class="mono">${q.z == null ? '' : q.z.toFixed(3)}</td></tr>`).join('') + '</tbody>'
    : '<tbody><tr><td class="note">Aucun point : dessinez les branches.</td></tr></tbody>';
}

function showTab(name) {
  $$('.tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  $$('.tab').forEach((t) => (t.hidden = t.id !== 'tab-' + name));
}

// --------------------------------------------------------- Liaisons
function readInput(t) {
  if (t.type === 'checkbox') return t.checked;
  if (t.tagName === 'SELECT') return /^\d+$/.test(t.value) ? +t.value : t.value;
  if (t.dataset.type === 'text') return t.value;
  return parseNum(t.value);
}

function bindUI() {
  const panel = $('.panel');
  panel.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.k) {
      setPath(S.prj, t.dataset.k, readInput(t));
      if (t.dataset.k.startsWith('center.')) { S.prj.center.auto = false; $('#centerAuto').checked = false; }
      update({ commit: false });
    } else if (t.dataset.bk && S.sel >= 0) {
      setPath(S.prj.branches[S.sel], t.dataset.bk, readInput(t));
      update({ commit: false });
    } else if (t.dataset.vis) {
      S.prj.opts.vis[t.dataset.vis] = t.checked; viewer.invalidate(); autosave();
    }
  });
  panel.addEventListener('change', (e) => { if (e.target.dataset.k || e.target.dataset.bk) { commitHistory(); syncInputs(); } });
  panel.addEventListener('click', (e) => {
    const li = e.target.closest('#branchList li[data-bi]');
    if (li) { selectBranch(+li.dataset.bi); return; }
    if (e.target.id === 'btnDelBranch') deleteBranch(S.sel);
    const tr = e.target.closest('#ptsTable tr[data-pt]');
    if (tr) {
      const q = S.D?.points[+tr.dataset.pt];
      if (q) { viewer.cx = q.p.x; viewer.cy = q.p.y; viewer.s = Math.max(viewer.s, 6); S.snap = { ...q.p, kind: `point ${q.n}` }; viewer.invalidate(); }
    }
  });
  $$('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $$('.tools [data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $$('.tools [data-act]').forEach((b) => b.addEventListener('click', () => (b.dataset.act === 'zoomGira' ? zoomGira() : zoomAll())));
  $$('.tog').forEach((b) => { b.classList.toggle('on', !!S.tog[b.dataset.tog]); b.addEventListener('click', () => toggle(b.dataset.tog)); });

  $$('#ctxSeg [data-ctx]').forEach((b) => b.addEventListener('click', () => setContext(b.dataset.ctx)));
  $('#crsSel').addEventListener('change', (e) => {
    const id = e.target.value, c = { ...S.prj.crs, id };
    if (id === 'utm' && S.crs.geo) { const ll = S.crs.toLL(viewer.cx, viewer.cy); c.zone = utmZoneOf(ll.lon); c.south = ll.lat < 0; }
    if (id === 'custom' && !c.def) { syncCrsUI(); $('#crsSel').value = 'custom'; $('#crsCustomRow').hidden = false; $('#crsDef').focus(); return; }
    changeCRS(c);
  });
  $('#crsZone').addEventListener('change', (e) => { const z = Math.round(+e.target.value); if (z >= 1 && z <= 60) changeCRS({ ...S.prj.crs, zone: z }); else syncCrsUI(); });
  $('#crsSouth').addEventListener('change', (e) => changeCRS({ ...S.prj.crs, south: e.target.checked }));
  $('#crsDef').addEventListener('change', (e) => changeCRS({ ...S.prj.crs, id: 'custom', def: e.target.value.trim() }));
  $('#bgSel').addEventListener('change', (e) => { S.prj.bg.provider = e.target.value; viewer.invalidate(); commitHistory(); autosave(); });
  $('#bgOpacity').addEventListener('input', (e) => { S.prj.bg.opacity = +e.target.value; viewer.invalidate(); autosave(); });
  $('#themeSel').addEventListener('change', (e) => { S.prj.opts.theme = e.target.value; viewer.invalidate(); autosave(); });
  $('#angSel').addEventListener('change', (e) => { S.prj.opts.angleUnit = e.target.value; update(); });
  $('#centerAuto').addEventListener('change', (e) => { S.prj.center.auto = e.target.checked; update(); });
  $('#prjName').addEventListener('change', (e) => { S.prj.name = e.target.value.trim() || 'Giratoire'; commitHistory(); autosave(); });
  $('#btnRingDefaults').addEventListener('click', applyGuideValues);
  $('#btnAddBranch').addEventListener('click', () => setTool('axis'));
  $('#btnApplyAll').addEventListener('click', applyToAll);

  $('#geoGo').addEventListener('click', () => geoSearch($('#geoQ').value));
  $('#geoQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') geoSearch(e.target.value); });
  $('#geoRes').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-lat]');
    if (li) { goToLL(+li.dataset.lat, +li.dataset.lon, 2.5); $('#geoRes').innerHTML = ''; }
  });

  $('#btnImportDxf').addEventListener('click', () => $('#fileDxf').click());
  $('#fileDxf').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importDXF(f); e.target.value = ''; });
  $('#dxfLayers').addEventListener('input', (e) => {
    const n = e.target.dataset.layer;
    if (n != null && S.dxf) { S.dxf.layers.get(n).visible = e.target.checked; viewer.invalidate(); }
    if (e.target.id === 'dxfOpacity') { S.prj.opts.dxfOpacity = +e.target.value; viewer.invalidate(); }
  });
  $('#dxfLayers').addEventListener('click', (e) => {
    if (!S.dxf) return;
    if (e.target.dataset.all != null) { for (const l of S.dxf.layers.values()) l.visible = e.target.dataset.all === '1'; renderDxfLayers(); viewer.invalidate(); }
    if (e.target.id === 'dxfZoom') { viewer.fit(S.dxf.bbox); autosave(); }
    if (e.target.id === 'dxfRemove') { S.dxf = null; S.dxfCache = null; S.dxfName = ''; renderDxfLayers(); viewer.invalidate(); }
  });

  $('#btnNew').addEventListener('click', () => {
    if (S.prj.branches.length && !confirm('Créer un nouveau projet ? Le projet en cours non enregistré sera perdu.')) return;
    const keep = { crs: S.prj.crs, bg: S.prj.bg, opts: S.prj.opts };
    S.prj = { ...newProject(S.prj.context), ...keep };
    S.sel = -1; S.hist = []; S.fut = [];
    syncCtxUI(); syncCrsUI(); renderBranchForm(); update();
  });
  $('#btnOpen').addEventListener('click', () => $('#fileOpen').click());
  $('#fileOpen').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) openProject(f); e.target.value = ''; });
  $('#btnSave').addEventListener('click', saveProject);
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#btnDxf').addEventListener('click', exportDXF);
  $('#btnPng').addEventListener('click', exportPNG);
  $('#btnCsv').addEventListener('click', exportCSV);
  $('#btnHelp').addEventListener('click', () => $('#dlgHelp').showModal());
  renderBranchForm();
  renderDxfLayers();
}

function setContext(c) {
  if (c === S.prj.context) return;
  const apply = !S.prj.branches.length || confirm(`Appliquer les valeurs par défaut du guide ${c === 'urbain' ? 'CERTU (urbain)' : 'SETRA ACI (interurbain)'} à l'anneau et à toutes les branches ?`);
  S.prj.context = c;
  if (apply) {
    const P = PRESETS[c];
    Object.assign(S.prj.ring, { Rg: P.ring.Rg, la: P.ring.la, bf: P.ring.bf, devers: P.ring.devers });
    S.prj.branches.forEach((b) => {
      const t = newBranch(S.prj, b.axis);
      Object.assign(b, { wLane: t.wLane, le: t.le, ls: t.ls, Re: t.Re, Rs: t.Rs, camber: t.camber });
      b.island.shift = ''; b.island.gap = '';
    });
  }
  syncCtxUI(); renderBranchForm(); update();
}

// Valeurs du guide pour le Rg courant (anneau + branches).
function applyGuideValues() {
  const p = S.prj, Rg = +p.ring.Rg;
  if (p.context === 'interurbain') {
    const r = aciRow(Rg);
    const any2 = p.branches.some((b) => +b.nIn >= 2);
    p.ring.la = any2 ? 8.5 : r.la;
    p.ring.bf = Rg <= 15 ? 1.5 : 0;
    p.ring.devers = RING_DEVERS;
    p.branches.forEach((b) => {
      b.le = +b.nIn >= 2 ? 7 : 4; b.ls = +b.nOut >= 2 ? 7 : r.ls;
      b.Re = Math.min(r.Re, Rg); b.Rs = r.Rs;
    });
  } else {
    const leMax = Math.max(3.5, ...p.branches.map((b) => (+b.nIn >= 2 ? 6.5 : 3.5)));
    p.ring.la = Math.max(Rg < 15 ? 6 : 6.5, Math.ceil(1.2 * leMax * 2) / 2);
    p.ring.bf = Rg < 20 ? 1.5 : 0;
    p.ring.devers = RING_DEVERS;
    p.branches.forEach((b) => {
      b.le = +b.nIn >= 2 ? 6.5 : 3.5; b.ls = +b.nOut >= 2 ? 7 : 4;
      b.Re = Math.min(12, Rg); b.Rs = 15;
    });
  }
  renderBranchForm(); update();
  toast('Valeurs du guide appliquées.');
}

function applyToAll() {
  const src = S.prj.branches[S.sel];
  if (!src) { toast('Sélectionnez d\'abord la branche modèle.', 'warn'); return; }
  const keys = ['nIn', 'nOut', 'wLane', 'le', 'ls', 'Re', 'Rs', 'camber', 'transition', 'radial'];
  S.prj.branches.forEach((b) => {
    if (b === src) return;
    for (const k of keys) b[k] = src[k];
    b.island = { ...src.island }; b.tpc = { ...src.tpc };
  });
  update(); toast(`Paramètres de ${src.name} copiés sur toutes les branches.`);
}

// ================================================================ Localisation
async function geoSearch(q) {
  q = (q || '').trim();
  if (!q) return;
  const m = q.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)\s*$/);
  if (m) { goToLL(parseFloat(m[1].replace(',', '.')), parseFloat(m[2].replace(',', '.')), 2.5); return; }
  const ul = $('#geoRes');
  ul.innerHTML = '<li class="dim">Recherche…</li>';
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=fr&q=${encodeURIComponent(q)}`);
    const js = await r.json();
    ul.innerHTML = js.length
      ? js.map((x) => `<li data-lat="${x.lat}" data-lon="${x.lon}">${esc(x.display_name)}</li>`).join('')
      : '<li class="dim">Aucun résultat.</li>';
  } catch (e) {
    ul.innerHTML = `<li class="dim">Recherche indisponible (${esc(e.message)}). Saisissez « lat, lon ».</li>`;
  }
}

// ================================================================ Import DXF
async function importDXF(file) {
  toast(`Lecture de ${file.name} (${(file.size / 1048576).toFixed(1)} Mo)…`);
  await new Promise((r) => setTimeout(r, 30));
  try {
    const buf = await file.arrayBuffer();
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { text = new TextDecoder('windows-1252').decode(buf); }
    if (/^\s*AutoCAD Binary DXF/.test(text.slice(0, 30))) throw new Error('DXF binaire non pris en charge : enregistrez-le en DXF ASCII.');
    const parsed = parseDXF(text);
    const sel = $('#dxfUnit').value;
    const factor = sel === 'auto' ? parsed.unitFactor ?? 1 : +sel;
    const geo = buildDxfGeometry(parsed, factor);
    if (!geo.polys.length && !geo.texts.length && !geo.points.length) throw new Error('aucune entité lisible (le fichier est-il un DXF ASCII ?)');
    S.dxf = geo; S.dxfCache = buildDxfCache(geo); S.dxfName = file.name;
    renderDxfLayers();
    const far = S.dxf.bbox && (viewer.cx < S.dxf.bbox.x0 - 5000 || viewer.cx > S.dxf.bbox.x1 + 5000 || viewer.cy < S.dxf.bbox.y0 - 5000 || viewer.cy > S.dxf.bbox.y1 + 5000);
    if (!S.prj.branches.length || far) viewer.fit(S.dxf.bbox);
    viewer.invalidate();
    toast(`${file.name} : ${geo.polys.length} lignes, ${geo.texts.length} textes, ${geo.points.length} points, ${geo.layers.size} calques.` + (far && S.crs.geo ? ' Il est loin de la vue : vérifiez le système de coordonnées.' : ''));
  } catch (e) {
    console.error(e);
    toast('Import DXF impossible : ' + e.message, 'err');
  }
}

function renderDxfLayers() {
  const host = $('#dxfLayers');
  if (!S.dxf) { host.innerHTML = ''; $('#dxfInfo').textContent = 'Aucun fond DXF. Formats : DXF ASCII (R12 à 2018). Un DWG doit être enregistré en DXF.'; return; }
  const bb = S.dxf.bbox;
  $('#dxfInfo').textContent = `${S.dxfName} — emprise X ${bb.x0.toFixed(0)}…${bb.x1.toFixed(0)}, Y ${bb.y0.toFixed(0)}…${bb.y1.toFixed(0)}`;
  const layers = [...S.dxf.layers.values()].sort((a, b) => a.name.localeCompare(b.name));
  host.innerHTML = `<div class="row"><button id="dxfZoom">Zoom sur le DXF</button><button data-all="1">Tout afficher</button><button data-all="0">Tout masquer</button><button id="dxfRemove" class="danger">Retirer</button></div>` +
    `<label class="fld wide"><span class="lb">Opacité du DXF</span><input id="dxfOpacity" type="range" min="0.15" max="1" step="0.05" value="${S.prj.opts.dxfOpacity}"></label>` +
    '<div class="lyrs">' + layers.map((l) => `<label class="chk"><input type="checkbox" data-layer="${esc(l.name)}" ${l.visible ? 'checked' : ''}><i style="background:${l.color}"></i>${esc(l.name)} <span class="dim">${l.count}</span></label>`).join('') + '</div>';
}

// ================================================================ Exports
const fname = (ext) => `${(S.prj.name || 'giratoire').replace(/[\\/:*?"<>|]+/g, '_')}.${ext}`;

function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

function exportDXF() {
  const D = S.D;
  if (!D?.ok || !D.branches.length) { toast('Rien à exporter : dessinez au moins une branche.', 'warn'); return; }
  download(fname('dxf'), buildDxfText(), 'application/dxf');
  toast('Plan DXF exporté (calques GIRA_*).');
}

function buildDxfText() {
  const D = S.D;
  const w = new DxfWriter();
  for (const l of Object.values(LAYERS)) if (l.dxf) w.layer(l.dxf, l.aci, l.ltype || 'CONTINUOUS');
  const lay = (k) => LAYERS[k]?.dxf;
  const TH = +S.prj.opts.textH || 0.8;
  for (const pr of D.prims) {
    const L = lay(pr.L);
    if (!L || S.prj.opts.vis[pr.L] === false) continue;
    const ex = pr.lt ? { ltype: pr.lt } : undefined;
    if (pr.k === 'path') {
      w.path(L, pr.segs, !!pr.closed, ex);
      if (pr.arrow) {
        const s = pr.segs[pr.segs.length - 1], a = G.segStart(s), b = G.segEnd(s), d = G.norm(G.sub(b, a)), n = G.rot90(d), hl = Math.min(1, 0.6 * TH);
        w.line(L, b, G.add(G.sub(b, G.mul(d, hl)), G.mul(n, hl * 0.35))); w.line(L, b, G.sub(G.sub(b, G.mul(d, hl)), G.mul(n, hl * 0.35)));
      }
    } else if (pr.k === 'circle') w.circle(L, pr.c, pr.r);
    else if (pr.k === 'text') w.text(L, pr.p, pr.h, pr.rot, pr.s, pr.align);
    else if (pr.k === 'hatch') for (const [a, b] of pr.lines) w.line(L, a, b);
    else if (pr.k === 'cross') {
      const r = pr.size, p = pr.p;
      w.line(L, { x: p.x - r, y: p.y }, { x: p.x + r, y: p.y }); w.line(L, { x: p.x, y: p.y - r }, { x: p.x, y: p.y + r });
    } else if (pr.k === 'arrow') {
      const b = G.add(pr.p, G.mul(pr.dir, pr.len)), hl = Math.min(0.6, pr.len * 0.3), back = G.mul(pr.dir, -hl), sd = G.mul(G.rot90(pr.dir), hl * 0.4);
      w.line(L, pr.p, b); w.line(L, b, G.add(G.add(b, back), sd)); w.line(L, b, G.sub(G.add(b, back), sd));
      w.text(L, G.add(G.lerp(pr.p, b, 0.5), G.mul(G.rot90(pr.dir), pr.h * 0.85)), pr.h, pr.rot, pr.text, 'center');
    }
  }
  if (S.prj.opts.vis.AXE_SAISI !== false) for (const b of S.prj.branches) w.path(lay('AXE_SAISI'), b.axis.slice(1).map((p, i) => G.L(b.axis[i], p)));
  if (S.prj.opts.vis.IMPLANTATION !== false) for (const q of D.points) {
    w.point(lay('IMPLANTATION'), q.p, q.z ?? 0);
    w.text(lay('IMPLANTATION'), { x: q.p.x + 0.25, y: q.p.y + 0.25 }, TH * 0.5, 0, String(q.n));
  }
  // Cartouche sommaire
  const bb = designBBox(), x = bb.x0, y = bb.y0 - 4 * TH, l = lay('COTATION');
  const lines = [
    S.prj.name,
    `Carrefour giratoire ${S.prj.context === 'interurbain' ? 'interurbain (SETRA ACI)' : 'urbain (CERTU)'} — Rg ${fmt(D.Rg)} m, la ${fmt(D.la)} m, Ri ${fmt(D.Ri)} m, ${D.branches.length} branches`,
    `Coordonnées : ${S.crs.geo ? S.crs.label : 'locales'} · Altimétrie de principe (avant-projet)`,
    `Établi le ${new Date().toLocaleDateString('fr-FR')} avec GIRA`,
  ];
  lines.forEach((s, i) => w.text(l, { x, y: y - i * TH * 1.8 }, i ? TH : TH * 1.6, 0, s));
  return w.toString();
}

function exportPNG() {
  const k = 2, c = document.createElement('canvas');
  c.width = Math.round(viewer.W * k); c.height = Math.round(viewer.H * k);
  const v = { W: viewer.W, H: viewer.H, s: viewer.s, cx: viewer.cx, cy: viewer.cy, dpr: k };
  v.w2s = viewer.w2s.bind(v); v.s2w = viewer.s2w.bind(v);
  const ctx = c.getContext('2d');
  const save = (note) => c.toBlob((b) => { if (b) { download(fname('png'), b); if (note) toast(note); } }, 'image/png');
  renderScene(ctx, v, { export: true });
  try { save(); } catch {
    renderScene(ctx, v, { export: true, noTiles: true });
    save('Image exportée sans le fond satellite (restriction du fournisseur).');
  }
}

function exportCSV() {
  const pts = S.D?.points || [];
  if (!pts.length) { toast('Aucun point à exporter.', 'warn'); return; }
  const c = (v, d = 3) => (v == null ? '' : v.toFixed(d).replace('.', ','));
  const rows = ['N°;Désignation;X;Y;Z', ...pts.map((q) => `${q.n};"${q.name.replace(/"/g, '""')}";${c(q.p.x)};${c(q.p.y)};${c(q.z)}`)];
  download(fname('csv').replace(/\.csv$/, '_implantation.csv'), '﻿' + rows.join('\r\n'), 'text/csv;charset=utf-8');
}

function saveProject() {
  const data = JSON.stringify({ ...S.prj, view: { cx: viewer.cx, cy: viewer.cy, s: viewer.s }, savedAt: new Date().toISOString() }, null, 1);
  download(fname('gira.json'), data, 'application/json');
}

async function openProject(file) {
  try {
    const js = JSON.parse(await file.text());
    if (js.app !== 'GIRA') throw new Error('ce fichier n\'est pas un projet GIRA');
    S.prj = migrate(js);
    S.sel = -1; S.hist = []; S.fut = [];
    applyCRS(); syncCtxUI(); syncCrsUI(); renderBranchForm(); update();
    if (js.view && isFinite(js.view.s)) { viewer.cx = js.view.cx; viewer.cy = js.view.cy; viewer.s = js.view.s; viewer.invalidate(); } else zoomGira();
    toast(`Projet « ${S.prj.name} » ouvert.`);
  } catch (e) { toast('Ouverture impossible : ' + e.message, 'err'); }
}

// ================================================================ Messages
let toastTimer = null;
function toast(msg, lvl = 'info') {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg; t.className = 'toast ' + lvl; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), lvl === 'err' ? 7000 : 4500);
}

init();
// Poignée de débogage (console du navigateur).
window.GIRA = { S, update, get viewer() { return viewer; }, zoomGira, newBranch, finishAxis, setTool, buildDxfText, parseDXF, buildDxfGeometry };
