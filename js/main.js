// main.js — application GIRA : état du projet, outils de dessin, panneaux, imports / exports.
import * as G from './geom.js';
import { makeCRS, CRS_PRESETS, utmZoneOf } from './crs.js';
import { TileLayer, PROVIDERS } from './tiles.js';
import { parseDXF, buildDxfGeometry } from './dxf-parse.js';
import { DxfWriter } from './dxf-write.js';
import { Viewer, THEMES, drawDesign, drawDxf, buildDxfCache, snapDxf, drawGrid, drawHud, niceStep } from './viewer.js';
import { buildDesign, fmt, fmtGis } from './roundabout.js';
import { PRESETS, RING_DEVERS, PLAN, GUIDE_NOTES, aciRow, checkDesign, hintFor, getPath, setPath, isPlan, defaultPlan, SECTION, sectionParams, TAD, SIGNS, signParams } from './norms.js';
import { GAMMES, CATALOG } from './signs.js';
import { signSVG, signOutline } from './signicons.js';
import { rampParams, endFrame, normRamp, buildEchangeur, trumpet, deriveTrumpet, crossingWith, xref, cloverleaf, halfCloverleaf, diamond, gradeRoundabout, HWY_CAT, RAMP_CAT } from './echangeur.js';
import { pathProject, pathTangentAt } from './clotho.js';
import { dxfTerrainLayers, pointsFromDxf, parsePointsFile, fetchSRTM, buildTerrain, SRTM_ATTR } from './terrain.js';
import { tinZ } from './tin.js';
import { ptParams, crossSection, crossSections, ptChartSVG, ptDXF } from './pt.js';
import { plParams, plBuild, plStations, plTerrainLine, plFromTerrain, plChartSVG, plChartPick, plDXF, plChecks, axisLength } from './pl.js';
import { ringProfile, profileSVG, profileDXF } from './profile.js';
import { LAYERS } from './layers.js';
import { buildOuvrages, W_CLASSES } from './ouvrage.js';
import { analyse, SITES } from './capacity.js';
import { initLang, getLang, t } from './i18n.js';
import { analysePlan, gapParams, GAPS } from './capacity-plan.js';

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
  const base = {
    id: uid(), name: nextName(prj), axis, radial: true, nIn: 1, nOut: 1,
    island: { type: 'physique', base: '', length: '', gap: '', shift: '' },
    tpc: { on: false, width: P.tpcWidth }, length: '', pente: '', transition: '',
  };
  if (isPlan(prj)) {
    const s = PLAN[prj.context].sec; // largeurs et rayons automatiques (fonction de l, ACI tab. 8)
    return { ...base, wLane: s.wLane, le: '', ls: '', Re: '', Rs: '', camber: s.camber };
  }
  const row = prj.context === 'interurbain' ? aciRow(+prj.ring.Rg) : null;
  return {
    ...base, wLane: P.wLane, camber: P.camber,
    le: P.le, ls: row ? row.ls : P.ls, Re: row ? Math.min(row.Re, +prj.ring.Rg) : P.Re, Rs: row ? row.Rs : P.Rs,
  };
}

function newCross(k) {
  return { id: uid(), on: true, kind: 'route', name: `Voie secondaire ${k + 1}`, cat: 'L2', V: '', lanes: '', wLane: '', bau: '', bdg: '', median: '', berme: '', pk0: '', axis: [] };
}
function newProject(context = 'interurbain') {
  const R = PRESETS[context].ring, jid = uid();
  return {
    app: 'GIRA', version: 1, name: 'Giratoire sans titre', context, kind: 'giratoire',
    crs: { id: 'utm', zone: 32, south: false, def: '' },
    bg: { provider: 'esri', opacity: 1, places: true },
    center: { auto: true, x: null, y: null },
    ring: { Rg: R.Rg, la: R.la, bf: R.bf, zC: 100, devers: R.devers, pente: 0, gisPente: 0, mode: 'aci' },
    plan: defaultPlan(context),
    section: {}, // profil en travers : valeurs vides = valeurs par défaut du contexte (norms.SECTION)
    signs: {}, // signalisation verticale : valeurs vides = valeurs par défaut du contexte (norms.SIGNS)
    tn: { source: '', step: '', edges: false, points: false, pts: [], info: null }, // terrain naturel (points x, y, z)
    pt: {}, // profils en travers : pas, demi-largeur, talus (valeurs vides = défauts de pt.js)
    hwy: { on: false, name: 'A1', cat: 'L2', V: '', lanes: 2, wLane: '', bau: '', bdg: '', median: '', berme: '', pk0: '', axis: [] }, // échangeur : section courante
    ramps: [], // échangeur : bretelles
    crosses: [], // voies secondaires (une par échangeur : tige, route croisée ou seconde autoroute)
    traffic: { period: 'HPM', site: context === 'urbain' ? 'urbain' : 'rase', uvpPL: 2, od: {}, pl: {}, qp: {}, tad: {} },
    branches: [],
    opts: { angleUnit: 'gon', textH: 0.8, theme: 'dark', vis: {}, dxfOpacity: 0.9 },
    jid, jname: 'Carrefour 1', others: [], jorder: [jid], // carrefours du projet (le premier est actif)
  };
}

function migrate(p, opt = {}) {
  const base = newProject(p.context === 'urbain' ? 'urbain' : 'interurbain');
  const out = {
    ...base, ...p,
    ring: { ...base.ring, ...p.ring }, opts: { ...base.opts, ...p.opts, vis: { ...(p.opts?.vis || {}) } },
    center: { ...base.center, ...p.center }, crs: { ...base.crs, ...p.crs }, bg: { ...base.bg, ...p.bg },
    plan: { ...base.plan, ...p.plan, tag: { ...base.plan.tag, ...p.plan?.tag } },
    section: { ...p.section }, signs: { ...p.signs }, tn: { ...base.tn, ...p.tn, pts: Array.isArray(p.tn?.pts) ? p.tn.pts : [] }, pt: { ...p.pt },
    hwy: { ...base.hwy, ...p.hwy, axis: Array.isArray(p.hwy?.axis) ? p.hwy.axis : [] }, ramps: Array.isArray(p.ramps) ? p.ramps.map(normRamp) : [], crosses: (Array.isArray(p.crosses) ? p.crosses : p.cross && (p.cross.on || p.cross.axis?.length) ? [p.cross] : []).map((c, k) => ({ ...newCross(k), ...c, id: c.id || uid(), axis: Array.isArray(c.axis) ? c.axis : [] })),
    traffic: { ...base.traffic, ...p.traffic, od: { ...p.traffic?.od }, pl: { ...p.traffic?.pl }, qp: { ...p.traffic?.qp }, tad: { ...p.traffic?.tad } },
  };
  delete out.view; delete out.cross;
  out.kind = ['T', 'X'].includes(p.kind) ? p.kind : 'giratoire';
  if (!Array.isArray(out.plan.main)) out.plan.main = ['', ''];
  out.ring.devers = RING_DEVERS; // valeur imposée
  out.branches = [];
  for (const b of p.branches || []) {
    if (!Array.isArray(b.axis) || b.axis.length < 2) continue;
    const t = newBranch(out, b.axis.map((q) => ({ x: +q.x, y: +q.y })));
    out.branches.push({ ...t, ...b, axis: t.axis, island: { ...t.island, ...b.island }, tpc: { ...t.tpc, ...b.tpc } });
  }
  // Plusieurs carrefours : le carrefour actif est au niveau du projet (jid, jname et les clés JKEYS), les autres sont
  // rangés dans others ; jorder donne l'ordre de la liste.
  out.jid = p.jid || uid(); out.jname = p.jname || 'Carrefour 1';
  if (!opt.inner) {
    out.others = (Array.isArray(p.others) ? p.others : []).map((sn) => ({ id: sn.id || uid(), name: sn.name || 'Carrefour', ...pickJ(migrate({ ...p, ...sn, others: [] }, { inner: true })) }));
    const ids = [out.jid, ...out.others.map((o) => o.id)];
    out.jorder = (Array.isArray(p.jorder) ? p.jorder.filter((id) => ids.includes(id)) : []).concat(ids.filter((id) => !(p.jorder || []).includes(id)));
  }
  return out;
}

// ================================================================ Carrefours multiples
const JKEYS = ['context', 'kind', 'center', 'ring', 'plan', 'section', 'signs', 'pt', 'traffic', 'branches'];
const pickJ = (o) => Object.fromEntries(JKEYS.map((k) => [k, o[k]]));
const clone = (o) => JSON.parse(JSON.stringify(o));
function junctionList() {
  const all = [{ id: S.prj.jid, name: S.prj.jname, active: true, kind: S.prj.kind, n: S.prj.branches.length }, ...S.prj.others.map((o) => ({ id: o.id, name: o.name, active: false, kind: o.kind, n: o.branches.length }))];
  return S.prj.jorder.map((id) => all.find((j) => j.id === id)).filter(Boolean);
}
// Rend actif le carrefour id : l'actif courant est rangé dans others, celui-ci remonte au niveau du projet.
function switchJunction(id, { zoom = true } = {}) {
  if (id === S.prj.jid) return;
  const k = S.prj.others.findIndex((o) => o.id === id);
  if (k < 0) return;
  closePop(false);
  const sn = S.prj.others[k];
  S.prj.others[k] = { id: S.prj.jid, name: S.prj.jname, ...clone(pickJ(S.prj)) };
  Object.assign(S.prj, clone(pickJ(sn)), { jid: sn.id, jname: sn.name });
  S.sel = -1; S.hover = -1; S.formRole = undefined; S.plSel = -1; S.ptSel = -1;
  syncCtxUI(); renderBranchForm(); update();
  if (zoom && S.prj.branches.length) zoomGira();
}
function addJunction() {
  const n = S.prj.jorder.length + 1, fresh = newProject(S.prj.context), id = uid();
  S.prj.others.push({ id: S.prj.jid, name: S.prj.jname, ...clone(pickJ(S.prj)) });
  Object.assign(S.prj, clone(pickJ(fresh)), { jid: id, jname: `Carrefour ${n}` });
  S.prj.jorder.push(id);
  S.sel = -1; S.formRole = undefined;
  syncCtxUI(); renderBranchForm(); update();
  toast(t(`Carrefour ${n} créé : choisissez son type, puis dessinez ses branches (outil Axe).`));
}
// Supprime le carrefour actif ; un autre devient actif (s'il n'en reste qu'un, ses branches sont effacées).
function deleteJunction() {
  if (!S.prj.others.length) { S.prj.branches = []; S.sel = -1; S.prj.center = { ...S.prj.center, auto: true }; renderBranchForm(); update(); return; }
  const gone = S.prj.jid, next = S.prj.jorder.find((id) => id !== gone);
  switchJunction(next, { zoom: false });
  S.prj.others = S.prj.others.filter((o) => o.id !== gone);
  S.prj.jorder = S.prj.jorder.filter((id) => id !== gone);
  update();
}
// Projets dérivés des carrefours inactifs (dessin, sélection, export), recalculés seulement s'ils changent.
const junctionCache = new Map();
function otherDesigns() {
  const out = [];
  for (const o of S.prj.others || []) {
    const sub = { ...S.prj, ...pickJ(o), hwy: { ...S.prj.hwy, on: false }, ramps: [], crosses: [] };
    const sig = JSON.stringify(pickJ(o)) + S.prj.opts.textH + S.prj.opts.angleUnit;
    let c = junctionCache.get(o.id);
    if (!c || c.sig !== sig) { let D = null; try { D = buildDesign(sub); } catch (e) { console.warn(e); } c = { sig, D }; junctionCache.set(o.id, c); }
    if (c.D) out.push({ id: o.id, name: o.name, D: c.D });
  }
  return out;
}

// ================================================================ État
const S = {
  prj: null, D: null, checks: [], crs: null,
  dxf: null, dxfCache: null, dxfName: '', dxfRaw: null,
  tool: 'select', sel: -1, hover: -1, hoverEl: null, pop: null, // élément survolé / fenêtre ouverte { type, i }
  rsel: -1, hwyDraw: false, rampKind: null, echSig: '', // échangeur : bretelle sélectionnée, saisie de l'axe autoroutier, type de bretelle à placer
  draft: [], meas: [], drag: null, mouse: null, cursorW: null, snap: null,
  tog: { snap: true, ortho: false, grid: false }, space: false,
  hist: [], fut: [],
  tn: null, tnSig: '', // MNT construit (tin, prims) et signature des points / options dont il dépend
  plSel: -1, plPi: -1, plDrag: null, // profil en long : branche affichée, PI sélectionné, glissement en cours
  ptSel: -1, ptSt: 0, // profils en travers : branche et station affichées
};
let viewer, tiles, placeTiles;
S.xsel = 0; S.pendingTpl = null;

function init() {
  viewer = new Viewer($('#cv'));
  viewer.onRender = (ctx, v) => renderScene(ctx, v);
  tiles = new TileLayer(() => viewer.invalidate());
  placeTiles = new TileLayer(() => viewer.invalidate());
  placeTiles.provider = 'places';
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('gira.autosave') || 'null'); } catch { saved = null; }
  S.prj = saved && saved.app === 'GIRA' ? migrate(saved) : newProject();
  applyCRS();
  rebuildTerrain();
  buildStaticPanels();
  bindUI();
  bindPop();
  bindJunctions();
  bindCanvas();
  bindKeys();
  update({ commit: false });
  S.hist = [JSON.stringify(S.prj)];
  setTool('select');
  initLang();
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
  rebuildTerrain();
  try { syncTrumpets(); } catch (e) { console.error(e); }
  try { syncRampBranches(); syncTrumpets(); } catch (e) { console.error(e); } // la tige peut avoir été raccourcie par une branche
  try { S.D = buildDesign(S.prj); } catch (e) { console.error(e); S.D = null; toast('Erreur de calcul : ' + e.message, 'err'); }
  if (S.prj.center.auto && S.D?.O) { S.prj.center.x = S.D.O.x; S.prj.center.y = S.D.O.y; }
  try { S.checks = checkDesign(S.prj, S.D); } catch (e) { console.error(e); S.checks = []; }
  S.Do = otherDesigns();
  S.ouvr = null;
  if (S.D) try { // ouvrages de franchissement de l'autoroute (passages supérieurs)
    S.ouvr = buildOuvrages(S.prj, S.D, { girden: girdenList() });
    for (const q of S.ouvr.issues) S.checks.push({ lvl: q.lvl, group: 'Ouvrages', msg: q.msg });
  } catch (e) { console.error(e); }
  for (const [id, msg] of S.trBad || []) { const r = S.prj.ramps.find((q) => q.id === id); if (r) S.checks.push({ lvl: 'err', group: 'Échangeur', msg: `Trompette (${r.name}) : boucle non déduite de la S-semi — ${msg}` }); else S.trBad.delete(id); }
  if (panels) refreshPanels();
  viewer.invalidate();
  if (commit) commitHistory();
  autosave();
}

// Giratoires dénivelés générés (anneau franchissant l'autoroute) : centre, rayons, nom.
function girdenList() {
  const out = [];
  for (const [id, g] of Object.entries(S.prj.genJ || {})) {
    if (g.kind !== 'girden') continue;
    const j = id === S.prj.jid ? S.prj : S.prj.others.find((o) => o.id === id);
    if (!j || j.center?.x == null) continue;
    const O = id === S.prj.jid ? S.D?.O : (S.Do || []).find((d) => d.id === id)?.D?.O;
    out.push({ name: id === S.prj.jid ? S.prj.jname : j.name, O: O || { x: +j.center.x, y: +j.center.y }, Rg: +j.ring.Rg, la: +j.ring.la || 8 });
  }
  return out;
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
  closePop(false);
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

// ================================================================ Échangeur
// Champs de la section courante (ICTAAL 2015, maj 2021).
// Voies secondaires : liste, voie sélectionnée (S.xsel) et ses champs.
function renderCrossFields() {
  const C = S.prj.crosses || [];
  if (S.xsel >= C.length) S.xsel = C.length - 1;
  if (S.xsel < 0 && C.length) S.xsel = 0;
  const k = S.xsel, p = `crosses.${k}.`;
  $('#crossList').innerHTML = C.map((c, i) => `<li data-xi="${i}" class="${i === k ? 'on' : ''}"><span class="dot"></span><b>${esc(c.name || `Voie secondaire ${i + 1}`)}</b><span>${c.kind === 'autoroute' ? 'autoroute (nœud)' : 'route ordinaire'}</span><span></span></li>`).join('') || '<li class="empty-li">Aucune voie secondaire.</li>';
  $('#crossFields').innerHTML = k < 0 ? '' :
    `<label class="chk"><input type="checkbox" data-k="${p}on"> Voie active</label>` +
    '<div class="row">' + fld(p + 'name', 'Nom', '', { text: true }) + sel(p + 'kind', 'Type', [['route', 'Route ordinaire (diffuseur)'], ['autoroute', 'Autoroute (nœud)']], { branch: false }) + '</div>' +
    '<div class="row">' + sel(p + 'cat', 'Catégorie (autoroute)', Object.entries(HWY_CAT).map(([kk, c]) => [kk, c.label]), { branch: false }) + fld(p + 'V', 'Vitesse limite', 'km/h', { ph: '90 / 110' }) + '</div>' +
    '<div class="row">' + fld(p + 'lanes', 'Voies par sens', '', { ph: '1 / 2' }) + fld(p + 'wLane', 'Largeur de voie', 'm', { ph: '3,50' }) + '</div>' +
    '<div class="row">' + fld(p + 'bau', 'BAU / BDD', 'm', { ph: '2,00 / 2,50' }) + fld(p + 'median', 'Bande médiane', 'm', { ph: '0 / 3,00' }) + '</div>' +
    '<div class="row">' + fld(p + 'bdg', 'BDG', 'm', { ph: '0 / 1,00' }) + fld(p + 'berme', 'Berme', 'm', { ph: '0,75 / 1,00' }) + '</div>';
}
function buildOuvrFields() {
  const Wopts = Object.entries(W_CLASSES).map(([k, v]) => [k, `${k} (${fmt(v, 2)} m)`]);
  $('#ouvrFields').innerHTML =
    '<div class="row">' + sel('ouvr.on', 'Ouvrages', [['', 'dessinés'], ['non', 'non dessinés']], { branch: false }) + sel('ouvr.nTrav', 'Travure', [['auto', 'automatique (4 travées si TPC ≥ 3 m)'], ['4', '4 travées (pile centrale)'], ['3', '3 travées (sans pile centrale)']], { branch: false }) + '</div>' +
    '<div class="row">' + fld('ouvr.gab', 'Tirant d\'air', 'm', { ph: '4,75' }) + fld('ouvr.ep', 'Épaisseur des piles voiles', 'm', { ph: '0,80' }) + '</div>' +
    '<div class="row">' + fld('ouvr.dRet', 'Bord de BAU → face du dispositif de retenue', 'm', { ph: '0' }) + sel('ouvr.Wr', 'Largeur de fonctionnement en rive', Wopts, { branch: false }) + sel('ouvr.Wt', 'Largeur de fonctionnement dans le TPC', Wopts, { branch: false }) + '</div>' +
    '<div class="row">' + fld('ouvr.corn', 'Largeur hors chaussée de chaque côté (corniche, longrine)', 'm', { ph: '0,50' }) + fld('ouvr.fck', 'Béton de la dalle fck', 'MPa', { ph: '30' }) + '</div>';
}
function buildEchFields() {
  $('#hwyFields').innerHTML =
    '<div class="row">' + fld('hwy.name', 'Nom', '', { text: true }) + sel('hwy.cat', 'Catégorie', Object.entries(HWY_CAT).map(([k, c]) => [k, c.label]), { branch: false }) + '</div>' +
    '<div class="row">' + fld('hwy.V', 'Vitesse limite', 'km/h', { ph: '110' }) + sel('hwy.lanes', 'Voies par sens', [['2', '2'], ['3', '3'], ['4', '4']], { branch: false }) + '</div>' +
    '<div class="row">' + fld('hwy.wLane', 'Largeur de voie', 'm', { ph: '3,50' }) + fld('hwy.bau', 'BAU', 'm', { ph: '2,50', title: '2,50 m ; 3,00 m si plus de 2 000 PL/j (ICTAAL § 4.1.3)' }) + '</div>' +
    '<div class="row">' + fld('hwy.bdg', 'BDG', 'm', { ph: '1,00' }) + fld('hwy.median', 'Bande médiane', 'm', { ph: '3,00' }) + '</div>' +
    '<div class="row">' + fld('hwy.berme', 'Berme', 'm', { ph: '1,00' }) + fld('hwy.pk0', 'PK origine', 'm', { ph: '0' }) + '</div>' +
    '';
  renderCrossFields();
  buildOuvrFields();
  $('#hwyFields').innerHTML +=
    '<div class="row">' + fld('hwy.trR2', 'Trompette : rayon R2 de la S-semi', 'm', { ph: '62', title: 'Grande courbe de la sortie semi-directe ; la boucle en est déduite (concentrique)' }) + fld('hwy.trGap', 'Trompette : écart boucle / S-semi', 'm', { ph: '0', title: 'Terre-plein entre la boucle et la sortie semi-directe, côté amont (0 : plates-formes tangentes)' }) + fld('hwy.trTpc', 'Trompette : séparation des voies de la tige (TPC)', 'm', { ph: '1', title: 'Entre les bords des deux voies de la tige, BDG comprises ; constante sur toute la tige et sur l\'ouvrage' }) + '</div>' +
    '<div class="row">' + fld('hwy.loY', 'Losange / demi-échangeur : distance des carrefours à l\'axe', 'm', { ph: 'auto', title: 'Centre des giratoires ou extrémité des bretelles, mesuré le long de la voie secondaire depuis l\'axe de l\'autoroute (auto : plate-forme + 100 m)' }) + fld('hwy.loRg', 'Losange : rayon Rg des giratoires', 'm', { ph: '20' }) + '</div>' +
    '<div class="row">' + sel('hwy.dmSide', 'Demi-échangeur : bretelles côté', [['debut', 'origine de l\'axe'], ['fin', 'fin de l\'axe']], { branch: false }) + sel('hwy.dmGir', 'Demi-échangeur : raccordement', [['gir', 'giratoires'], ['libre', 'extrémités libres']], { branch: false }) + fld('hwy.gdRg', 'Giratoire dénivelé : rayon Rg', 'm', { ph: 'auto ≥ 60', title: 'Rive extérieure de l\'anneau ; l\'anneau franchit l\'autoroute sur deux ouvrages' }) + '</div>';
}

// Panneaux : liste des bretelles, formulaire de la bretelle sélectionnée, sommets de l'autoroute, résultats.
function refreshEch() {
  const H = S.prj.hwy, ramps = S.prj.ramps || [], D = S.D;
  if (S.rsel >= ramps.length) S.rsel = ramps.length - 1;
  const r = ramps[S.rsel], R = D?.ramps?.[S.rsel];
  const sig = JSON.stringify([S.rsel, S.xsel, H.axis?.length, (S.prj.crosses || []).map((c) => [c.id, c.name, c.kind, c.axis?.length]), ramps.map((q) => [q.id, q.name, q.from?.ref, q.to?.ref, q.pis?.length, q.cat])]);
  if (sig !== S.echSig) {
    S.echSig = sig;
    $('#rampList').innerHTML = ramps.map((q, i) => `<li data-ri="${i}" class="rli${i === S.rsel ? ' on' : ''}"><b>${esc(q.name)}</b> ${esc(rampParams(S.prj, q).label)} · ${esc(RAMP_CAT[q.cat]?.label || '')}</li>`).join('') || '<li class="empty-li">Aucune bretelle.</li>';
    const nV = H.axis?.length || 0;
    $('#hwyVertices').innerHTML = nV > 2 ? '<h3>Sommets de l\'axe</h3><div class="tablewrap"><table class="pts"><tr><th>#</th><th>X</th><th>Y</th><th>R (m)</th></tr>' +
      H.axis.map((q, k) => `<tr><td>${k}</td><td><input data-k="hwy.axis.${k}.x" inputmode="decimal"></td><td><input data-k="hwy.axis.${k}.y" inputmode="decimal"></td><td>${k && k < nV - 1 ? `<input data-k="hwy.axis.${k}.r" inputmode="decimal">` : ''}</td></tr>`).join('') + '</table></div>' : '';
    renderCrossFields();
    const xk = S.xsel, XC = S.prj.crosses?.[xk]?.axis || [], nX = XC.length;
    $('#crossVertices').innerHTML = nX >= 2 ? '<h3>Sommets de l\'axe de la voie secondaire</h3><div class="tablewrap"><table class="pts"><tr><th>#</th><th>X</th><th>Y</th><th>R (m)</th></tr>' +
      XC.map((q, k) => `<tr><td>${k}</td><td><input data-k="crosses.${xk}.axis.${k}.x" inputmode="decimal"></td><td><input data-k="crosses.${xk}.axis.${k}.y" inputmode="decimal"></td><td>${k && k < nX - 1 ? `<input data-k="crosses.${xk}.axis.${k}.r" inputmode="decimal">` : ''}</td></tr>`).join('') + '</table></div>' : '';
    if (!r) $('#rampForm').innerHTML = '';
    else {
      const i = S.rsel, k = (f) => `ramps.${i}.${f}`;
      const xRefs = (S.prj.crosses || []).flatMap((c, k) => (c.on === false ? [] : [[xref(k, 1), `${c.name || `Voie secondaire ${k + 1}`} — sens 1`], [xref(k, 2), `${c.name || `Voie secondaire ${k + 1}`} — sens 2`]]));
      const refs = (role) => [['free', 'Libre (extrémité du tracé)'], ['hwy1', `${H.name || 'Autoroute'} — sens 1`], ['hwy2', `${H.name || 'Autoroute'} — sens 2`], ...xRefs,
        ...ramps.filter((q) => q.id !== r.id).map((q) => [q.id, `Bretelle ${q.name}`])].map(([v, l]) => [v, role === 'from' && v !== 'free' ? `Sortie de ${l.replace(/^Bretelle /, '')}` : role === 'to' && v !== 'free' ? `Entrée sur ${l.replace(/^Bretelle /, '')}` : l]);
      const endFields = (role) => {
        const e = r[role], att = e?.ref && e.ref !== 'free', hw = att && /^hwy/.test(e.ref), div = role === 'from';
        return '<div class="row">' + sel(k(`${role}.ref`), div ? 'Origine' : 'Extrémité', refs(role), { branch: false }) + (att ? fld(k(`${role}.s`), div ? 'Abscisse de S.1,00' : 'Abscisse de E.1,00', 'm', { title: hw ? 'Abscisse sur l\'axe de l\'autoroute' : 'Abscisse le long de l\'axe de la bretelle hôte' }) : '') + '</div>' +
          (!att ? '' : '<div class="row">' +
            fld(k(`${role}.biseau`), div ? 'Biseau de déboîtement' : 'Biseau de rabattement', 'm', { ph: div ? (hw ? '150' : '90') : '75', title: div ? '150 m sur autoroute (110 en relief difficile, 90 si une voie, § 4.1.3.1) ; 90 m depuis une bretelle à une voie (schéma 4-8)' : '75 m (schémas 5-1, 5-6)' }) +
            fld(k(`${role}.obl`), 'Obliquité', '%', { ph: div ? '(1 + l) / biseau' : (hw ? '3' : '5'), title: div ? 'Découle du biseau en déboîtement : 3 % (150 m), 5 % (90 m) (§ 6.1)' : '3 à 5 % (§ 6.1)' }) + '</div>' +
            '<div class="row">' + fld(k(`${role}.tpl`), 'Largeur au tpl', 'm', { ph: 'BAU + 2,00 + 0,70' }) + (div ? '' : fld(k(`${role}.ins`), 'Voie d\'insertion', 'm', { ph: hw ? '200' : '100' })) + '</div>');
      };
      const fromFree = !(r.from?.ref && r.from.ref !== 'free'), toFree = !(r.to?.ref && r.to.ref !== 'free');
      $('#rampForm').innerHTML =
        '<div class="row">' + fld(k('name'), 'Nom', '', { text: true }) + sel(k('cat'), 'Catégorie', Object.entries(RAMP_CAT).map(([c, q]) => [c, q.label]), { branch: false }) + '</div>' +
        '<div class="row">' + fld(k('pente'), 'Déclivité (sens de circulation)', '%', { ph: '0', title: 'Valeur algébrique : pente < 0, rampe > 0 (§ 3.2.5)' }) + '</div>' +
        '<h3>Origine</h3>' + endFields('from') + '<h3>Extrémité</h3>' + endFields('to') +
        (r.tp ? '<h3>Paramètres de la trompette</h3><p class="note">Trompette paramétrique : la S-semi, la tige, l\'ouvrage, la boucle et les bretelles directes forment un bloc reconstruit à chaque modification de ces paramètres, de la voie secondaire (déplacez ses sommets) ou de l\'axe de l\'autoroute. Sur le plan, seule l\'extrémité de la tige se déplace (longueur).</p>' +
          '<div class="row">' + fld(k('tp.R2'), 'R2 de la S-semi', 'm', { ph: '62', title: 'Grande courbe de la sortie semi-directe ; la boucle est concentrique' }) + fld(k('tp.tpc'), 'TPC de la tige', 'm', { ph: '1', title: 'Séparation des deux voies de la tige, BDG comprises' }) + '</div>' +
          '<div class="row">' + fld(k('tp.gap'), 'Écart boucle / S-semi', 'm', { ph: '0' }) + fld(k('tp.Ys'), 'Longueur de la tige', 'm', { ph: 'auto', title: 'Depuis l\'ouvrage, le long de la tige' }) + '</div>' : '') +
        (isDerivedLoop(r) ? '<p class="note warn">Boucle de trompette déduite de la S-semi (concentrique à sa grande courbe, tangente à la tige et au convergent) : modifiez les paramètres de la trompette (fenêtre de la S-semi).</p>' : '') +
        '<h3>Sommets (PI) de la bretelle</h3><p class="note">Dans le sens de circulation. R : rayon de l\'arc, A : paramètre des clothoïdes (L = A²/R). Boucle : le raccordement tourne par le grand côté (environ 270°), l\'axe se recoupe au sommet (ouvrage).</p>' +
        '<div class="tablewrap"><table class="pts"><tr><th>PI</th><th>X</th><th>Y</th><th>R (m)</th><th>A (m)</th><th title="Boucle de trompette : le raccordement tourne par le grand côté">Boucle</th><th title="Arc continu avec le sommet précédent (même rayon, sans clothoïde entre les deux)">Arc ↺</th><th></th></tr>' +
        r.pis.map((q, j) => {
          const endp = (j === 0 && fromFree) || (j === r.pis.length - 1 && toFree);
          return `<tr><td>${j + 1}</td><td><input data-k="${k(`pis.${j}.x`)}" inputmode="decimal"></td><td><input data-k="${k(`pis.${j}.y`)}" inputmode="decimal"></td>` +
            (endp ? `<td colspan="4" class="note">${j === 0 && fromFree ? 'origine' : 'extrémité'}</td>` : `<td><input data-k="${k(`pis.${j}.R`)}" inputmode="decimal"></td><td><input data-k="${k(`pis.${j}.A`)}" inputmode="decimal"></td><td><input type="checkbox" data-k="${k(`pis.${j}.loop`)}"></td><td>${j > (fromFree ? 1 : 0) ? `<input type="checkbox" data-k="${k(`pis.${j}.link`)}">` : ''}</td>`) +
            `<td>${r.pis.length > 1 ? `<button class="mini" data-rpidel="${j}" title="Supprimer ce sommet">✕</button>` : ''}</td></tr>`;
        }).join('') + '</table></div>' +
        '<div class="row"><button id="btnRpiAdd">+ Sommet</button></div>';
    }
  }
  // Résultats (recalculés à chaque mise à jour).
  const hw = D?.hwy;
  $('#hwyOut').innerHTML = hw?.ok ? kv([
    ['Longueur de l\'axe', fmt(hw.sEnd) + ' m'],
    ['Profil en travers (par sens)', `BDG ${fmt(hw.H.bdg)} + ${hw.H.lanes} × ${fmt(hw.H.wLane)} + BAU ${fmt(hw.H.bau)} m`],
    ['Plate-forme', fmt(2 * (hw.E2 + hw.H.berme)) + ' m'],
    ['Rm / Rdn (ICTAAL tab. 3-1)', `${hw.H.C.Rm} / ${hw.H.C.Rdn} m`],
  ]) : '<p class="note">Activez l\'autoroute et dessinez son axe (milieu du terre-plein central).</p>';
  const OV = S.ouvr?.list || [], lvlCls = { ok: 'ok', info: '', warn: 'warn', err: 'err' };
  $('#ouvrOut').innerHTML = OV.length ? OV.map((o) => `<details class="ouvr"${OV.length === 1 ? ' open' : ''}><summary><b>${esc(o.name)}</b> — ${esc(o.src)} : ${o.spans.length} travées ${o.spans.map((v) => fmt(v, 2)).join(' + ')} m</summary>` + kv([
    ['Biais géométrique ψ', `${fmt(o.psi, 1)} gr`],
    ['Travure', `${o.spans.map((v) => fmt(v, 2)).join(' + ')} = ${fmt(o.spans.reduce((a, b) => a + b, 0), 2)} m${o.central ? ' (pile centrale dans le TPC)' : ' (sans appui central)'}`],
    ['Largeur du tablier', `${fmt(o.width, 2)} m`],
    ['Dalle', `PSI-${o.type}, h ≈ ${fmt(o.h, 2)} m ; about ≥ ${fmt(o.about, 2)} m`],
    ['Axe des piles de rive', `à ${fmt(o.yP, 2)} m de l'axe de l'autoroute`],
    ['Talus 3/2 sous culée', `hauteur ${fmt(o.Ht, 2)} m, emprise ${fmt(1.5 * o.Ht, 2)} m`],
  ]) + `<p class="note">${esc(o.hText)}</p><ul class="ouvr-items">${o.items.map((it) => `<li class="${lvlCls[it.level] || ''}">${esc(it.text)}</li>`).join('')}</ul></details>`).join('')
    : '<p class="note">Aucun ouvrage : une voie secondaire, la tige d\'une trompette ou l\'anneau d\'un giratoire dénivelé doit croiser l\'autoroute.</p>';
  const xr = D?.crosses?.[S.xsel];
  $('#crossOut').innerHTML = xr?.ok ? kv([
    ['Longueur de l\'axe', fmt(xr.sEnd) + ' m'],
    ['Profil en travers (par sens)', `${xr.H.median > 0 ? `BDG ${fmt(xr.H.bdg)} + ` : ''}${xr.H.lanes} × ${fmt(xr.H.wLane)} + ${xr.isRoute ? 'BDD' : 'BAU'} ${fmt(xr.H.bau)} m`],
    ['Plate-forme', fmt(2 * (xr.E2 + xr.H.berme)) + ' m'],
  ]) : '';
  if (R?.al) {
    const rp = R.rp, rows = [['Type', rp.label], ['Longueur de l\'axe', fmt(R.length) + ' m']];
    if (rp.from) rows.push(['Divergent : obliquité · Lm = (tpl − 1) / p', `${fmt(rp.from.p * 100, 2)} % · ${fmt(rp.from.Lm)} m`], ['Alignement droit depuis S.1,00', fmt(R.lad) + ' m']);
    if (R.Ld != null) rows.push([`Ld (${R.Vs} → VR) · disponible`, `${fmt(R.Ld)} m (VR ${fmt(R.VR, 0)} km/h) · ${fmt(R.Ldisp)} m`]);
    if (rp.to) rows.push(['Convergent : obliquité · Lm', `${fmt(rp.to.p * 100, 2)} % · ${fmt(rp.to.Lm)} m`], ['Alignement droit jusqu\'à E.1,00', fmt(R.ladE) + ' m']);
    if (R.La != null) rows.push(['La (VR → 55) · disponible', `${fmt(R.La)} m (VR ${fmt(R.VRe, 0)} km/h) · ${fmt(R.Ladisp)} m`]);
    R.al.tangents.forEach((t) => rows.push([`PI ${t.i}${t.loop ? ' (boucle)' : ''} : R · A · L clothoïde`, `${fmt(t.R)} m · ${fmt(t.A)} · ${fmt(t.L)} m`]));
    $('#rampOut').innerHTML = kv(rows) + (R.issues.length ? '<ul class="rissues">' + R.issues.map((q) => `<li class="${q.lvl}">${esc(q.msg)}</li>`).join('') + '</ul>' : '');
  } else $('#rampOut').innerHTML = R?.issues?.length ? '<ul class="rissues">' + R.issues.map((q) => `<li class="${q.lvl}">${esc(q.msg)}</li>`).join('') + '</ul>' : '';
}

// Chaussée hôte sous le point cliqué : autoroute (sens selon le côté) ou bretelle existante.
function hostAt(w) {
  const D = S.D;
  let best = null;
  if (D?.hwy?.ok) {
    const pr = pathProject(D.hwy.path, w);
    if (pr && Math.abs(pr.off) >= D.hwy.E0 && Math.abs(pr.off) <= D.hwy.E2 + 30) best = { ref: pr.off < 0 ? 'hwy1' : 'hwy2', s: pr.s, d: Math.abs(pr.off) - D.hwy.E1 };
  }
  (D?.crosses || []).forEach((c, k) => {
    if (!c?.ok) return;
    const pr = pathProject(c.path, w);
    if (pr && Math.abs(pr.off) >= c.E0 && Math.abs(pr.off) <= c.E2 + 30 && (!best || Math.abs(pr.off) - c.E1 < best.d)) best = { ref: xref(k, pr.off < 0 ? 1 : 2), s: pr.s, d: Math.abs(pr.off) - c.E1 };
  });
  for (const R of D?.ramps || []) {
    if (!R?.al) continue;
    const pr = pathProject(R.al.path, w);
    if (pr && pr.d < R.w / 2 + 6 && (!best || pr.d < Math.abs(best.d))) best = { ref: R.id, s: pr.s, d: pr.d };
  }
  return best;
}

// Place une bretelle (sortie ou entrée) sur la chaussée cliquée : autoroute ou autre bretelle.
function addRampAt(w) {
  const D = S.D, kind = S.rampKind || 'sortie';
  const h = hostAt(w);
  if (!h) { toast('Cliquez sur une chaussée de l\'autoroute (pas sur le terre-plein central) ou sur une bretelle.', 'warn'); return; }
  const ramps = S.prj.ramps, div = kind === 'sortie';
  const n = ramps.length + 1;
  const end = { ref: h.ref, s: Math.round(h.s * 10) / 10, biseau: '', obl: '', tpl: '', ...(div ? {} : { ins: '' }) };
  const r = { id: uid(), name: (div ? 'S' : 'E') + n, cat: 'b50', lanes: 1, pente: '', from: div ? end : { ref: 'free' }, to: div ? { ref: 'free' } : end, pis: [] };
  const rp = rampParams(S.prj, r), e = div ? rp.from : rp.to, host = D.echHost(h.ref);
  if (!host) { toast('Chaussée hôte non calculée.', 'warn'); return; }
  const F = endFrame(host, e, rp.w);
  const fx = (q) => ({ x: +q.x.toFixed(3), y: +q.y.toFixed(3) });
  if (div) { const P1 = G.add(F.A, G.mul(F.dir, e.Lm + 200)), P2 = G.add(P1, G.mul(F.nr, 260)); r.pis = [{ ...fx(P1), R: 120, A: 80 }, { ...fx(P2), R: '', A: '' }]; }
  else { const P1 = G.sub(F.A, G.mul(F.dir, e.Lm + 200)), P0 = G.add(P1, G.mul(F.nr, 260)); r.pis = [{ ...fx(P0), R: '', A: '' }, { ...fx(P1), R: 120, A: 80 }]; }
  ramps.push(r); S.rsel = ramps.length - 1;
  setTool('select'); update();
  toast(`${r.name} placée : déplacez ses sommets ou saisissez-les dans l'onglet Échangeur.`);
}

// Trompette : quatre bretelles générées autour du point d'ouvrage cliqué sur l'axe ; la tige part du côté du clic.
// Gabarits générés (trompette, trèfle, demi-trèfle) : un nouveau gabarit remplace ceux du même croisement (bretelles
// marquées gen, ou portant un nom de gabarit pour les projets antérieurs, dont un sommet est à moins de R0 du point P0).
const GEN_NAMES = /^(E-boucle|S-semi|S-directe|E-directe|[BD]-(SE|NE|NO|SO)|CX?[12]|S[12]-dir|E[12]-boucle)$/;
const DIAMONDS = ['losange', 'losangegir', 'demiech', 'girden'];
function removeGenerated(P0, R0 = 900) {
  const gone = new Set(S.prj.ramps.filter((r) => (r.gen || GEN_NAMES.test(r.name || '')) && (r.pis || []).some((q) => Math.hypot(q.x - P0.x, q.y - P0.y) < R0)).map((r) => r.id));
  if (!gone.size) return 0;
  S.prj.ramps = S.prj.ramps.filter((r) => !gone.has(r.id));
  for (const q of S.prj.ramps) for (const e of [q.from, q.to]) if (gone.has(e?.ref)) e.ref = 'free';
  return gone.size;
}
// Trompettes : la boucle, la tige et les directes suivent la S-semi. Groupe : grp / role (gabarits récents) ou, pour les
// projets antérieurs, noms et raccordements (S-directe → S-semi, E-directe ← E-boucle).
const isDerivedLoop = (r) => !!r && (r.role === 'boucle' || (r.gen === 'trompette' && r.name === 'E-boucle'));
const isParamTrumpet = (r) => !!r?.grp && !!S.prj.ramps.find((q) => q.id === r.grp && q.role === 'semi')?.tp;
function trumpetGroup(semi) {
  const R = S.prj.ramps;
  if (semi.grp) { const by = (role) => R.find((q) => q.grp === semi.grp && q.role === role); return { boucle: by('boucle'), sdir: by('sdir'), edir: by('edir') }; }
  const sdir = R.find((q) => q.to?.ref === semi.id && q.name === 'S-directe');
  const end = semi.pis?.[semi.pis.length - 1];
  const loops = R.filter((q) => q.name === 'E-boucle' && q.to?.ref === semi.from?.ref && q.pis?.[0]);
  const boucle = end ? loops.sort((a, b) => G.dist(a.pis[0], end) - G.dist(b.pis[0], end))[0] : null;
  const edir = boucle ? R.find((q) => q.from?.ref === boucle.id && q.name === 'E-directe') : null;
  return { boucle, sdir, edir };
}
function regenTrumpet(semi) {
  const tp = semi.tp, grp = trumpetGroup(semi);
  S.trSig = S.trSig || new Map(); S.trGood = S.trGood || new Map();
  const X = tp.crossK != null ? S.prj.crosses?.[tp.crossK] : null;
  const sig = JSON.stringify([tp.crossK, tp.click, tp.R2, tp.gap, tp.tpc, tp.Ys, X?.axis, X?.kind, S.prj.hwy.axis, S.prj.hwy.lanes, S.prj.hwy.wLane, S.prj.hwy.bau, S.prj.hwy.bdg, S.prj.hwy.median, semi.cut, grp.boucle?.cut]);
  if (S.trSig.get(semi.id) === sig) return;
  S.trSig.set(semi.id, sig);
  const ids = [grp.boucle?.id, semi.id, grp.sdir?.id, grp.edir?.id];
  let n = 0; const mk = () => ids[n++] || uid();
  const T = trumpet(S.prj, S.D, tp.click, mk, { ...tpOpt(tp), boucleCut: grp.boucle?.cut });
  if (T.err) { // retour aux derniers paramètres valides
    const g = S.trGood.get(semi.id);
    if (g) { semi.tp = JSON.parse(g); S.trSig.set(semi.id, ''); }
    if (S.trErr !== T.err) toast(`${T.err}${g ? ' Modification annulée.' : ''}`, 'warn');
    S.trErr = T.err; return;
  }
  S.trErr = null;
  const prev = { boucle: grp.boucle, semi, sdir: grp.sdir, edir: grp.edir };
  T.ramps.forEach((r) => {
    const old = prev[r.role], j = old ? S.prj.ramps.findIndex((q) => q.id === old.id) : -1;
    const nr = { ...r, gen: 'trompette', name: old?.name || r.name, ...(old?.cut ? { cut: old.cut } : {}), ...(r.role === 'semi' ? { tp: { ...tp, P0: { x: +T.P0.x.toFixed(3), y: +T.P0.y.toFixed(3) }, u: { x: +T.bridge.dir.x.toFixed(6), y: +T.bridge.dir.y.toFixed(6) } } } : {}) };
    if (j >= 0) S.prj.ramps[j] = nr; else S.prj.ramps.push(nr);
  });
  const ns = S.prj.ramps.find((q) => q.id === semi.id);
  S.trGood.set(semi.id, JSON.stringify(ns.tp));
  S.trSig.set(semi.id, JSON.stringify([ns.tp.crossK, ns.tp.click, ns.tp.R2, ns.tp.gap, ns.tp.tpc, ns.tp.Ys, X?.axis, X?.kind, S.prj.hwy.axis, S.prj.hwy.lanes, S.prj.hwy.wLane, S.prj.hwy.bau, S.prj.hwy.bdg, S.prj.hwy.median, ns.cut, trumpetGroup(ns).boucle?.cut]));
}
function syncTrumpets() {
  if (!S.D?.hwy?.ok) return;
  S.trSig = S.trSig || new Map();
  for (const semi of S.prj.ramps.filter((r) => r.role === 'semi' && r.tp)) regenTrumpet(semi);
  for (const semi of S.prj.ramps.filter((r) => !r.tp && (r.role === 'semi' || (r.name === 'S-semi' && r.from?.ref?.startsWith('hwy'))))) {
    const sigOf = () => JSON.stringify([semi.from, semi.pis, semi.cut, trumpetGroup(semi).boucle?.cut, S.prj.hwy.axis, S.prj.hwy.trGap, S.prj.hwy.trTpc, S.prj.hwy.E1]);
    const sig = sigOf();
    if (S.trSig.get(semi.id) === sig) continue;
    S.trSig.set(semi.id, sig);
    const grp = trumpetGroup(semi);
    if (!grp.boucle) continue;
    const dv = deriveTrumpet(S.prj, S.D, semi, grp, { gap: parseNum(String(S.prj.hwy.trGap ?? '')) || 0 });
    // La trompette reste un bloc cohérent : une modification de la S-semi qui rend la boucle impossible est annulée
    // (retour au dernier état valide) ; sans état valide connu (projet antérieur), l'incohérence est signalée.
    S.trGood = S.trGood || new Map(); S.trBad = S.trBad || new Map();
    if (dv.err) {
      const g = S.trGood.get(semi.id);
      if (g) { Object.assign(semi, JSON.parse(g)); S.trSig.set(semi.id, sigOf()); if (S.trErr !== dv.err) toast(`${dv.err} Modification annulée.`, 'warn'); }
      else { S.trBad.set(semi.id, dv.err); if (S.trErr !== dv.err) toast(dv.err, 'warn'); }
      S.trErr = dv.err; continue;
    }
    // Essai : les bretelles déduites ne doivent pas introduire d'erreur géométrique (raccordements, Lm…).
    const names = new Set([semi, grp.boucle, grp.sdir, grp.edir].filter(Boolean).map((q) => q.name));
    const nErr = (D) => (D?.echIssues || []).filter((i) => i.lvl === 'err' && [...names].some((nm) => i.msg.startsWith(nm + ' :'))).map((i) => i.msg);
    const trial = { ...S.prj, ramps: S.prj.ramps.map((q) => { for (const k of ['boucle', 'sdir', 'edir']) if (grp[k] && q.id === grp[k].id) return dv[k]; return q; }) };
    const D2 = { prims: [], points: [] };
    try { buildEchangeur(trial, D2); } catch (e) { console.error(e); }
    const before = nErr(S.D).length, after = nErr(D2);
    const g0 = S.trGood.get(semi.id);
    if (after.length > before && g0) {
      Object.assign(semi, JSON.parse(g0)); S.trSig.set(semi.id, sigOf());
      if (S.trErr !== after[0]) toast(`${after[0]} — modification de la S-semi annulée.`, 'warn');
      S.trErr = after[0]; continue;
    }
    S.trErr = null; S.trBad.delete(semi.id);
    S.trGood.set(semi.id, JSON.stringify({ from: semi.from, pis: semi.pis }));
    for (const k of ['boucle', 'sdir', 'edir']) { const j = grp[k] ? S.prj.ramps.findIndex((q) => q.id === grp[k].id) : -1; if (j >= 0) S.prj.ramps[j] = dv[k]; }
  }
}
// Bretelle dont l'extrémité libre est dans un giratoire : une branche du giratoire est dessinée automatiquement dans
// l'axe de sa dernière (ou première) branche ; deux bretelles de sens contraires dont les extrémités sont voisines
// (tige d'une trompette, bretelles accolées) forment une seule branche à double sens. La bretelle s'arrête au bout de la
// branche (longueur dessinée AUTO_BL au-delà de l'anneau). Supprimer la branche détache la bretelle (noBranch).
const AUTO_BL = 60;
function syncRampBranches() {
  const juncs = [{ j: S.prj, id: S.prj.jid, O: S.D?.O || (S.prj.center?.x != null ? { x: +S.prj.center.x, y: +S.prj.center.y } : null) },
    ...(S.prj.others || []).map((o) => ({ j: o, id: o.id, O: (S.Do || []).find((d) => d.id === o.id)?.D?.O || (o.center?.x != null ? { x: +o.center.x, y: +o.center.y } : null) }))]
    .filter((q) => q.O && (q.j.kind || 'giratoire') === 'giratoire');
  // Extrémités libres : point, direction vers l'extrémité (dernier côté de la bretelle), sens de circulation.
  const ends = [];
  S.prj.ramps.forEach((r, i) => {
    const R = S.D?.ramps?.[i], P = R?.pts || r.pis || [];
    const pis = r.pis || [];
    if (r.noBranch) { // détachée : rattachée de nouveau si l'extrémité est déplacée de plus de 5 m
      const E = r.noBranch.end === 'from' ? pis[0] : pis[pis.length - 1];
      if (E && G.dist(E, r.noBranch) < 5) return;
      delete r.noBranch;
    }
    if (r.to?.ref === 'free' && pis.length) { const E = pis[pis.length - 1], V = P.length >= 2 ? P[P.length - 2] : null; if (V && G.dist(V, E) > 1) ends.push({ r, end: 'to', E, d: G.norm(G.sub(E, V)) }); }
    if (r.from?.ref === 'free' && pis.length) { const E = pis[0], V = P.length >= 2 ? P[1] : null; if (V && G.dist(V, E) > 1) ends.push({ r, end: 'from', E, d: G.norm(G.sub(E, V)) }); }
  });
  const used = new Set();
  for (const q of juncs) {
    const Rg = +q.j.ring?.Rg || 20;
    const inside = ends.filter((e) => G.dist(e.E, q.O) < Rg);
    const groups = [];
    for (const e of inside) {
      if (used.has(e)) continue;
      const mate = inside.find((f) => f !== e && !used.has(f) && f.end !== e.end && G.dist(f.E, e.E) < 15 && G.dot(f.d, e.d) > 0.9);
      const g = mate ? [e, mate] : [e]; g.forEach((x) => used.add(x)); groups.push(g);
    }
    const keep = new Set();
    for (const g of groups) {
      const key = g.map((e) => e.r.id + ':' + e.end).sort().join('|');
      const d = G.norm(g.reduce((a, e) => G.add(a, e.d), { x: 0, y: 0 }));
      const mid = G.mul(g.reduce((a, e) => G.add(a, e.E), { x: 0, y: 0 }), 1 / g.length);
      const Pc = G.add(mid, G.mul(d, G.dot(G.sub(q.O, mid), d))); // pied de la perpendiculaire du centre sur l'axe
      const at = (dd) => { const p = G.sub(Pc, G.mul(d, dd)); return { x: +p.x.toFixed(3), y: +p.y.toFixed(3) }; };
      const axis = [at(Rg + AUTO_BL + 30), at(Rg + 6)];
      let b = q.j.branches.find((x) => x.rampLink === key);
      if (!b) { b = { ...newBranch(q.j, axis), rampLink: key, length: AUTO_BL }; q.j.branches.push(b); }
      // Tige de trompette (deux bretelles d'un même groupe) : la branche reprend la séparation des voies de la tige.
      const tpc = parseNum(String(S.prj.hwy.trTpc ?? '')) || 1;
      if (g.length === 2 && g[0].r.grp && g[0].r.grp === g[1].r.grp && tpc > 1.001 && (!b.tpc?.on || Math.abs(+b.tpc.width - tpc) > 1e-3)) b.tpc = { ...b.tpc, on: true, width: tpc };
      else if (G.dist(b.axis[0], axis[0]) > 0.01 || G.dist(b.axis[b.axis.length - 1], axis[1]) > 0.01) b.axis = axis;
      keep.add(key);
      for (const e of g) {
        const cut = G.sub(e.E, G.mul(e.d, G.dot(G.sub(e.E, Pc), d) + Rg + AUTO_BL));
        const c = { x: +cut.x.toFixed(3), y: +cut.y.toFixed(3), end: e.end, j: q.id };
        if (JSON.stringify(e.r.cut) !== JSON.stringify(c)) e.r.cut = c;
      }
    }
    q.j.branches = q.j.branches.filter((b) => !b.rampLink || keep.has(b.rampLink));
  }
  for (const r of S.prj.ramps) if (r.cut && !ends.some((e) => used.has(e) && e.r === r)) delete r.cut;
}
// Gabarit d'échangeur : clic sur une voie secondaire existante (au croisement, du côté de la voirie ordinaire pour une
// trompette), sinon le clic commence le tracé d'une nouvelle voie secondaire ; le gabarit est construit à sa fin.
function pickSecondary(w, px, py) {
  let best = null;
  (S.D?.crosses || []).forEach((c, k) => {
    if (!c?.ok) return;
    const pr = pathProject(c.path, w);
    if (pr && Math.abs(pr.off) * viewer.s < Math.max(12, (c.E2 + 6) * viewer.s) && (!best || Math.abs(pr.off) < best.d)) best = { k, d: Math.abs(pr.off) };
  });
  if (best) { runTemplate(S.pendingTpl, w, best.k); return; }
  const kind = S.pendingTpl;
  setTool('axis'); S.hwyDraw = 'cross'; S.pendingTpl = kind; S.draft = [w]; setPrompt(); viewer.invalidate();
}
function runTemplate(kind, w, k) {
  S.pendingTpl = null; S.xsel = k;
  if (kind === 'trompette') addTrumpetAt(w, k); else if (DIAMONDS.includes(kind)) addDiamondAt(w, kind, k); else addCloverAt(w, kind, k);
  setTool('select');
}
// Trompette paramétrique : la S-semi porte les paramètres (tp) ; toute modification (paramètres, voie secondaire, axe de
// l'autoroute, longueur de la tige) reconstruit le bloc S-semi + tige + ouvrage + boucle + directes (identifiants conservés).
const tpOpt = (tp) => ({ gap: +tp.gap || 0, tpc: +tp.tpc || 1, ...(+tp.R2 > 0 ? { R2: +tp.R2 } : {}), ...(tp.crossK != null ? { crossK: tp.crossK } : {}), ...(+tp.Ys > 0 ? { Ystem: +tp.Ys } : {}) });
// La voie secondaire d'une trompette s'arrête peu après l'ouvrage côté boucle (la tige ne se prolonge pas au-delà de la
// boucle) : on garde la plate-forme de l'autoroute + 30 m de ce côté, assez pour la culée et le recalcul du croisement.
function trimCrossLoopSide(X, P0, u) {
  if (!X?.axis?.length || !S.D?.hwy?.ok) return;
  const hw = S.D.hwy, pr = pathProject(hw.path, P0), tH = pr ? G.norm(pathTangentAt(hw.path, pr.s)) : { x: 1, y: 0 };
  const sinP = Math.max(0.3, Math.abs(G.cross(tH, u)));
  const Dl = (hw.E2 + hw.H.berme) / sinP + 30, f = (p) => G.dot(G.sub(p, P0), u) + Dl;
  const out = [];
  X.axis.forEach((p, i) => {
    if (i) { const q = X.axis[i - 1], a = f(q), b = f(p); if ((a < 0) !== (b < 0)) { const c = G.lerp(q, p, a / (a - b)); out.push({ x: +c.x.toFixed(3), y: +c.y.toFixed(3) }); } }
    if (f(p) >= 0) out.push(p);
  });
  if (out.length >= 2 && (out.length !== X.axis.length || out.some((p, i) => p !== X.axis[i]))) X.axis = out;
}
// Gabarit plus long que l'axe de l'autoroute (abscisses cover = [lo, hi] hors de [0, longueur]) : l'axe est prolongé
// en ligne droite à ses extrémités (+ 50 m), les abscisses des raccordements existants sont décalées et le PK origine
// corrigé (PK inchangés aux points existants), puis le gabarit est recalculé.
function withHwyCover(build) {
  let T = build();
  if (T.err || !T.cover || !S.D?.hwy?.ok) return T;
  const [lo, hi] = T.cover, L = S.D.hwy.sEnd, H = S.prj.hwy, ax = H.axis;
  const dA = lo < 0 ? Math.ceil(-lo + 50) : 0, dB = hi > L ? Math.ceil(hi - L + 50) : 0;
  if (!(dA || dB) || ax.length < 2) return T;
  const ext = (p, q, d) => { const u = G.norm(G.sub(p, q)); return { ...p, x: +(p.x + u.x * d).toFixed(3), y: +(p.y + u.y * d).toFixed(3) }; };
  if (dA) ax[0] = ext(ax[0], ax[1], dA);
  if (dB) ax[ax.length - 1] = ext(ax[ax.length - 1], ax[ax.length - 2], dB);
  if (dA) {
    for (const r of S.prj.ramps) for (const e of [r.from, r.to]) if (/^hwy[12]$/.test(e?.ref || '') && e.s !== '' && e.s != null) e.s = +(+e.s + dA).toFixed(2);
    H.pk0 = String(+((parseNum(String(H.pk0 ?? '')) || 0) - dA).toFixed(3));
  }
  update({ commit: false });
  T = build();
  if (!T.err) T.extNote = `Axe de l'autoroute prolongé${dA ? ` de ${dA} m à l'origine` : ''}${dA && dB ? ' et' : ''}${dB ? ` de ${dB} m à la fin` : ''} pour loger le gabarit${dA ? ' (PK conservés)' : ''}.`;
  return T;
}
function addTrumpetAt(w, crossK) {
  const tp = { crossK: crossK ?? null, click: { x: +w.x.toFixed(3), y: +w.y.toFixed(3) }, R2: parseNum(String(S.prj.hwy.trR2 ?? '')) || 62, gap: parseNum(String(S.prj.hwy.trGap ?? '')) || 0, tpc: parseNum(String(S.prj.hwy.trTpc ?? '')) || 1, Ys: '' };
  const T = withHwyCover(() => trumpet(S.prj, S.D, w, uid, tpOpt(tp)));
  if (T.err) { toast(T.err, 'warn'); return; }
  const nOld = removeGenerated(T.P0);
  tp.P0 = { x: +T.P0.x.toFixed(3), y: +T.P0.y.toFixed(3) }; tp.u = { x: +T.bridge.dir.x.toFixed(6), y: +T.bridge.dir.y.toFixed(6) };
  S.prj.ramps.push(...T.ramps.map((r) => ({ ...r, gen: 'trompette', ...(r.role === 'semi' ? { tp } : {}) }))); S.rsel = S.prj.ramps.length - 3;
  if (crossK != null) trimCrossLoopSide(S.prj.crosses[crossK], T.P0, T.bridge.dir);
  setTool('select'); update(); zoomAll();
  toast(`Trompette générée${crossK != null ? ` sur ${S.prj.crosses[crossK]?.name || 'la voie secondaire'}` : ''} : ${T.info}.${nOld ? ` ${nOld} bretelle(s) du gabarit précédent remplacée(s) (Ctrl+Z pour annuler).` : ''} Raccordez le haut de la tige au carrefour.` + (T.extNote ? ' ' + T.extNote : '') + (T.warn ? ' ' + T.warn : ''), T.warn ? 'warn' : 'info');
}

// Trèfle / demi-trèfle sur la voie secondaire k : construit au croisement avec l'autoroute ; l'axe de la voie est redressé
// perpendiculairement à l'autoroute (biais non traité pour ces gabarits), sur 1,5 km de part et d'autre (800 m : demi).
function addCloverAt(w, kind, k) {
  const X = S.prj.crosses[k];
  if (!X) return;
  if (kind === 'demitrefle' && X.kind === 'autoroute') { toast('Le demi-trèfle se raccorde à une route ordinaire : choisissez « Route ordinaire » pour cette voie secondaire.', 'warn'); return; }
  const C = crossingWith(S.D, w, k), P = C ? C.P0 : w;
  const T = withHwyCover(() => (kind === 'trefle' ? cloverleaf : halfCloverleaf)(S.prj, S.D, P, uid, { crossK: k }));
  if (T.err) { toast(T.err, 'warn'); return; }
  const skew = C ? (Math.acos(Math.min(1, Math.abs(G.dot(C.dir, G.norm(G.sub(T.crossAxis[1], T.crossAxis[0])))))) * 180) / Math.PI : 0;
  X.on = true; X.axis = T.crossAxis;
  if (skew > 0.5) toast(t(`${X.name} : axe redressé perpendiculairement à l'autoroute (biais de ${fmt(skew, 1)}° non traité pour ce gabarit).`), 'warn');
  const nOld = removeGenerated(G.lerp(T.crossAxis[0], T.crossAxis[1], 0.5), 1500);
  const n0 = S.prj.ramps.length;
  S.prj.ramps.push(...T.ramps.map((r) => ({ ...r, gen: kind }))); S.rsel = n0;
  setTool('select'); update(); zoomAll();
  const what = (kind === 'trefle' ? (X.kind === 'autoroute' ? 'Trèfle (nœud autoroutier, collectrices sur les deux axes)' : 'Trèfle complet (collectrices sur l\'autoroute)') : 'Demi-trèfle (extrémités libres sur la voie secondaire)') + ` sur ${X.name}`;
  toast(`${what} généré : ${T.info}.${nOld ? ` ${nOld} bretelle(s) du gabarit précédent remplacée(s) (Ctrl+Z pour annuler).` : ''}` + (T.extNote ? ' ' + T.extNote : '') + (T.warn ? ' ' + T.warn : ''), T.warn ? 'warn' : 'info');
}

// Losange, losange à giratoires, demi-échangeur, giratoire dénivelé sur la voie secondaire k. Les giratoires sont créés
// comme carrefours du projet (liste des carrefours), marqués dans genJ pour être remplacés avec le gabarit ; les bretelles
// dont l'extrémité est dans l'anneau y dessinent leur branche.
function removeGenJunctions(P0, R0) {
  const G0 = S.prj.genJ || {};
  const gone = new Set(Object.keys(G0).filter((id) => Math.hypot(G0[id].x - P0.x, G0[id].y - P0.y) < R0));
  for (const id of Object.keys(G0)) if (!S.prj.jorder.includes(id)) delete G0[id];
  if (!gone.size) return 0;
  if (gone.has(S.prj.jid)) {
    const next = S.prj.jorder.find((id) => !gone.has(id));
    if (next) switchJunction(next, { zoom: false });
    else Object.assign(S.prj, clone(pickJ(newProject(S.prj.context))), { jid: uid(), jname: 'Carrefour 1' }), S.prj.jorder.push(S.prj.jid);
  }
  S.prj.others = S.prj.others.filter((o) => !gone.has(o.id));
  S.prj.jorder = S.prj.jorder.filter((id) => !gone.has(id));
  for (const id of gone) delete G0[id];
  return gone.size;
}
function addDiamondAt(w, kind, k) {
  const X = S.prj.crosses[k], H = S.prj.hwy;
  if (!X) return;
  const nv = (v) => parseNum(String(v ?? '')) || 0;
  const C = crossingWith(S.D, w, k), P = C ? C.P0 : w, demi = kind === 'demiech';
  const gir = kind === 'losangegir' || (demi && H.dmGir !== 'libre');
  const T = withHwyCover(() => (kind === 'girden' ? gradeRoundabout(S.prj, S.D, P, uid, { crossK: k, dir: C?.dir, Rg: nv(H.gdRg) })
    : diamond(S.prj, S.D, P, uid, { crossK: k, dir: C?.dir, gir, part: demi ? (H.dmSide === 'fin' ? 'fin' : 'debut') : 'complet', Yj: nv(H.loY), Rg: nv(H.loRg) })));
  if (T.err) { toast(T.err, 'warn'); return; }
  const nOld = removeGenerated(P, 1500), nJ = removeGenJunctions(P, 1500);
  if (T.crossOff) X.on = false; else { X.on = true; X.axis = T.crossAxis; }
  const n0 = S.prj.ramps.length;
  S.prj.ramps.push(...T.ramps.map((r) => ({ ...r, name: `${r.name}-X${k + 1}`, gen: kind }))); S.rsel = n0; // S1-X2 : sortie du sens 1 sur la voie secondaire 2
  S.prj.genJ = S.prj.genJ || {};
  (T.juncs || []).forEach((J, i) => {
    const j = { id: uid(), name: T.juncs.length > 1 ? `${X.name} – giratoire côté sens ${J.side < 0 ? 1 : 2}` : `${X.name} – giratoire dénivelé`, ...clone(pickJ(newProject(S.prj.context))) };
    Object.assign(j, { kind: 'giratoire', center: { auto: false, x: J.center.x, y: J.center.y }, branches: [] });
    j.ring = { ...j.ring, Rg: J.Rg };
    for (const a of J.arms) j.branches.push({ ...newBranch(j, a.axis), length: a.length });
    S.prj.others.push(j); S.prj.jorder.push(j.id);
    S.prj.genJ[j.id] = { kind, x: +P.x.toFixed(3), y: +P.y.toFixed(3) };
  });
  if (S.D) S.D.ramps = []; // indices des bretelles modifiés
  setTool('select'); update({ commit: false }); update(); zoomAll();
  const what = { losange: 'Losange (carrefours plans à compléter aux extrémités libres)', losangegir: 'Losange à deux giratoires', demiech: `Demi-échangeur (bretelles côté ${H.dmSide === 'fin' ? 'fin' : 'origine'} de l'axe${gir ? ', giratoires' : ', extrémités libres'})`, girden: 'Giratoire dénivelé à deux ouvrages' }[kind];
  const msgs = [`${what} généré sur ${X.name} : ${T.info}.`];
  if (T.crossOff) msgs.push(`${X.name} est désactivée : le giratoire la remplace par deux branches.`);
  if (nOld || nJ) msgs.push(`Gabarit précédent remplacé (${nOld} bretelle(s)${nJ ? `, ${nJ} giratoire(s)` : ''}) — Ctrl+Z pour annuler.`);
  if (T.extNote) msgs.push(T.extNote);
  if (T.warn) msgs.push(T.warn);
  toast(msgs.join(' '), T.warn ? 'warn' : 'info');
}

// Axe de l'autoroute et polygones des bretelles (sommets déplaçables).
function drawEch(ctx, v, T, exp) {
  const H = S.prj.hwy;
  if (exp || !H?.on) return;
  const poly = (pts, col, w, dash) => {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash);
    ctx.beginPath(); pts.forEach((p, k) => { const [x, y] = v.w2s(p.x, p.y); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
    ctx.setLineDash([]);
  };
  const sq = (pts, col) => { ctx.fillStyle = col; for (const p of pts) { const [x, y] = v.w2s(p.x, p.y); ctx.fillRect(x - 3.5, y - 3.5, 7, 7); } };
  if (H.axis?.length >= 2) { poly(H.axis, T.L.AXE_SAISI.stroke, 1.2, [7, 5]); if (S.tool === 'select') sq(H.axis, T.L.AXE_SAISI.stroke); }
  for (const X of S.prj.crosses || []) if (X.on !== false && X.axis?.length >= 2) { poly(X.axis, T.L.AXE_SAISI.stroke, 1.2, [7, 5]); if (S.tool === 'select') sq(X.axis, T.L.AXE_SAISI.stroke); }
  (S.D?.ramps || []).forEach((R, i) => {
    if (!R?.pts) return;
    const on = i === S.rsel, col = on ? T.sel : T.L.AXE_SAISI.stroke;
    poly(R.pts, col, on ? 1.6 : 1, [5, 4]);
    if (S.tool === 'select' && !isDerivedLoop(S.prj.ramps[i])) sq(isParamTrumpet(S.prj.ramps[i]) ? (S.prj.ramps[i].role === 'semi' ? [S.prj.ramps[i].pis[S.prj.ramps[i].pis.length - 1]] : []) : R.pis, col);
  });
}
function hitEchHandle(px, py) {
  if (!S.prj.hwy?.on) return null;
  const near = (p) => { const [x, y] = viewer.w2s(p.x, p.y); return Math.hypot(px - x, py - y) < 7; };
  const order = (S.D?.ramps || []).map((R, i) => i).sort((a, b) => (b === S.rsel) - (a === S.rsel));
  for (const i of order) {
    const R = S.D.ramps[i];
    const r = S.prj.ramps[i];
    if (!R?.pis || isDerivedLoop(r)) continue; // boucle de trompette : déduite de la S-semi, non déplaçable
    if (isParamTrumpet(r)) { // trompette paramétrique : seule l'extrémité de la tige (longueur) se déplace
      if (r.role === 'semi' && near(r.pis[r.pis.length - 1])) return { kind: 'tige', ri: i };
      continue;
    }
    for (let k = 0; k < R.pis.length; k++) if (near(R.pis[k])) return { kind: 'rpi', ri: i, k };
  }
  const ax = S.prj.hwy.axis || [];
  for (let k = 0; k < ax.length; k++) if (near(ax[k])) return { kind: 'hvx', k };
  for (const [c, X] of (S.prj.crosses || []).entries()) { if (X.on === false) continue; const cx = X.axis || []; for (let k = 0; k < cx.length; k++) if (near(cx[k])) return { kind: 'cvx', c, k }; }
  return null;
}

function bindEch() {
  $('#btnHwyAxis').addEventListener('click', () => { setTool('axis'); S.hwyDraw = 'hwy'; setPrompt(); });
  $('#btnCrossAxis').addEventListener('click', () => { setTool('axis'); S.hwyDraw = 'cross'; setPrompt(); });
  $('#crossList').addEventListener('click', (e) => { const li = e.target.closest('li[data-xi]'); if (!li) return; S.xsel = +li.dataset.xi; S.echSig = ''; refreshPanels(); viewer.invalidate(); });
  const place = (kind) => {
    if (!S.D?.hwy?.ok) { toast('Activez l\'autoroute et dessinez d\'abord son axe.', 'warn'); return; }
    if (['trompette', 'trefle', 'demitrefle', ...DIAMONDS].includes(kind)) { setTool('pickx'); S.pendingTpl = kind; setPrompt(); return; } // l'échangeur se construit sur une voie secondaire
    setTool('ramp'); S.rampKind = kind; setPrompt();
  };
  $('#btnRampOut').addEventListener('click', () => place('sortie'));
  $('#btnRampIn').addEventListener('click', () => place('entree'));
  $('#btnTrumpet').addEventListener('click', () => place('trompette'));
  $('#btnTrefle').addEventListener('click', () => place('trefle'));
  $('#btnDemiTrefle').addEventListener('click', () => place('demitrefle'));
  $('#btnLosange').addEventListener('click', () => place('losange'));
  $('#btnLosangeGir').addEventListener('click', () => place('losangegir'));
  $('#btnDemiEch').addEventListener('click', () => place('demiech'));
  $('#btnGirDen').addEventListener('click', () => place('girden'));
  $('#btnRampDel').addEventListener('click', () => {
    const r = S.prj.ramps[S.rsel];
    if (!r || !confirm(t(`Supprimer la bretelle ${r.name} ?`))) return;
    for (const q of S.prj.ramps) for (const e of [q.from, q.to]) if (e?.ref === r.id) e.ref = 'free'; // les raccordements à cette bretelle deviennent libres
    S.prj.ramps.splice(S.rsel, 1); S.rsel = -1; update();
  });
  $('#rampList').addEventListener('click', (e) => { const li = e.target.closest('[data-ri]'); if (!li) return; S.rsel = +li.dataset.ri; refreshPanels(); viewer.invalidate(); });
  // Changement d'extrémité (capturé avant la mise à jour) : une extrémité qui devient libre reçoit un sommet à la position
  // actuelle ; une extrémité raccordée prend l'abscisse du sommet le plus proche projeté sur la chaussée hôte.
  $('#rampForm').addEventListener('input', (e) => {
    const m = /^ramps\.(\d+)\.(from|to)\.ref$/.exec(e.target.dataset.k || ''); if (!m) return;
    const r = S.prj.ramps[+m[1]], R = S.D?.ramps?.[+m[1]], role = m[2], ref = e.target.value;
    const wasFree = !(r[role]?.ref && r[role].ref !== 'free');
    if (ref === 'free' && !wasFree && R?.pts) { const q = role === 'from' ? R.pts[0] : R.pts[R.pts.length - 1]; const pnt = { x: +q.x.toFixed(3), y: +q.y.toFixed(3), R: '', A: '' }; if (role === 'from') r.pis.unshift(pnt); else r.pis.push(pnt); }
    if (ref !== 'free') {
      const path = ref.startsWith('hwy') ? S.D?.hwy?.path : S.D?.ramps?.find((x) => x?.id === ref)?.al?.path;
      const q = role === 'from' ? r.pis[0] : r.pis[r.pis.length - 1];
      if (path && q) { const pr = pathProject(path, q); r[role] = { biseau: '', obl: '', tpl: '', ...(role === 'to' ? { ins: '' } : {}), ...r[role], ref, s: Math.round(pr.s * 10) / 10 }; }
      if (wasFree && r.pis.length > 1) { if (role === 'from') r.pis.shift(); else r.pis.pop(); } // l'ancien point libre devient le divergent / convergent
    }
  }, true);
  $('#rampForm').addEventListener('click', (e) => {
    const r = S.prj.ramps[S.rsel]; if (!r) return;
    const del = e.target.closest('[data-rpidel]');
    if (del) { r.pis.splice(+del.dataset.rpidel, 1); update(); return; }
    if (e.target.id === 'btnRpiAdd') {
      const R = S.D?.ramps?.[S.rsel], pts = R?.pts || r.pis;
      const toFree = !(r.to?.ref && r.to.ref !== 'free');
      if (toFree) { // prolonge au-delà de l'extrémité libre
        const a = pts[pts.length - 2], b = pts[pts.length - 1], d = G.norm(G.sub(b, a)), q = G.add(b, G.mul(d, 120));
        const last = r.pis[r.pis.length - 1]; if (last) { last.R = last.R || 150; last.A = last.A || 90; }
        r.pis.push({ x: +q.x.toFixed(3), y: +q.y.toFixed(3), R: '', A: '' });
      } else { // insère un sommet au milieu du dernier côté, avant le convergent
        const a = pts[pts.length - 2], b = pts[pts.length - 1], q = G.lerp(a, b, 0.5);
        r.pis.push({ x: +q.x.toFixed(3), y: +q.y.toFixed(3), R: 150, A: 90 });
      }
      update();
    }
  });
}

// ================================================================ Rendu
function renderScene(ctx, v, exp = null) {
  const theme = S.prj.opts.theme === 'light' ? 'light' : 'dark', T = THEMES[theme];
  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  ctx.fillStyle = T.bg; ctx.fillRect(0, 0, v.W, v.H);
  const imagery = S.crs.geo && S.prj.bg.provider !== 'none' && !exp?.noTiles;
  const places = imagery && S.prj.bg.provider === 'esri' && S.prj.bg.places;
  if (imagery) {
    tiles.provider = S.prj.bg.provider; tiles.opacity = +S.prj.bg.opacity || 1;
    try { tiles.draw(ctx, v, S.crs, v.dpr); } catch (e) { console.warn(e); }
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  }
  if (places) {
    try { placeTiles.draw(ctx, v, S.crs, v.dpr); } catch (e) { console.warn(e); }
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  }
  if (S.tog.grid) drawGrid(ctx, v, theme);
  if (S.dxf) { drawDxf(ctx, v, S.dxf, S.dxfCache, theme, +S.prj.opts.dxfOpacity || 1); ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0); }
  if (S.tn) drawDesign(ctx, v, { prims: S.tn.prims }, theme, S.prj.opts.vis, {});
  for (const o of S.Do || []) drawDesign(ctx, v, o.D, theme, S.prj.opts.vis, { onImagery: imagery && S.prj.bg.provider === 'esri', onImage: () => viewer.invalidate() });
  drawDesign(ctx, v, S.D, theme, S.prj.opts.vis, { onImagery: imagery && S.prj.bg.provider === 'esri', onImage: () => viewer.invalidate() });
  if (!exp) for (const o of [{ D: S.D, name: S.prj.jname, active: true }, ...(S.Do || [])]) { // nom des carrefours
    if (!o.D?.O || (S.Do || []).length === 0) continue;
    const [x, y] = v.w2s(o.D.O.x, o.D.O.y);
    ctx.font = `${o.active ? 600 : 500} 13px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = o.active ? T.sel : T.L.COTATION?.stroke || '#9cf';
    ctx.fillText(o.name || '', x, y - Math.max(18, ((o.D.Rpo || 20) + 6) * v.s));
  }
  drawAxes(ctx, v, T, !!exp);
  drawEch(ctx, v, T, !!exp);
  if (!exp) drawOverlay(ctx, v, T);
  drawHud(ctx, v, theme, northAngle(v), imagery ? PROVIDERS[S.prj.bg.provider].attr + (places ? ' · ' + PROVIDERS.places.attr : '') : '');
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
    if (sel) {
      // Poignées de milieu de segment : déplacent le segment (sommets voisins compris).
      ctx.strokeStyle = T.sel; ctx.lineWidth = 1.5;
      for (let k = 0; k + 1 < b.axis.length; k++) {
        const [x, y] = v.w2s((b.axis[k].x + b.axis[k + 1].x) / 2, (b.axis[k].y + b.axis[k + 1].y) / 2);
        ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.closePath(); ctx.stroke();
      }
    }
  });
  // « + » au bout extérieur de chaque axe : prolonge la saisie.
  if (exp || S.tool !== 'select') return;
  ctx.lineWidth = 1.6;
  S.prj.branches.forEach((b, i) => {
    const e = outerEnd(i);
    if (!e) return;
    const [x, y] = plusPos(e);
    ctx.fillStyle = i === S.sel ? T.sel : T.L.AXE_SAISI.stroke;
    ctx.beginPath(); ctx.arc(x, y, 8, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.beginPath(); ctx.moveTo(x - 4.5, y); ctx.lineTo(x + 4.5, y); ctx.moveTo(x, y - 4.5); ctx.lineTo(x, y + 4.5); ctx.stroke();
  });
}

// Extrémité extérieure d'un axe (la plus éloignée du centre ; le 1er point saisi à défaut de centre).
function outerEnd(i) {
  const ax = S.prj.branches[i]?.axis;
  if (!ax || ax.length < 2) return null;
  const n = ax.length - 1, O = S.D?.O;
  const atStart = !O || G.dist(ax[0], O) >= G.dist(ax[n], O);
  return atStart ? { bi: i, atStart, p: ax[0], prev: ax[1] } : { bi: i, atStart, p: ax[n], prev: ax[n - 1] };
}
// Position écran du « + » : 18 px au-delà de l'extrémité, dans le prolongement de l'axe.
function plusPos(e) {
  const [x, y] = viewer.w2s(e.p.x, e.p.y), [xp, yp] = viewer.w2s(e.prev.x, e.prev.y);
  const d = Math.hypot(x - xp, y - yp) || 1;
  return [x + ((x - xp) / d) * 18, y + ((y - yp) / d) * 18];
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
  // Surbrillance de l'élément survolé et de celui dont la fenêtre est ouverte.
  for (const [el, a] of [[S.pop, 0.28], [S.hoverEl, 0.4]]) {
    const g = el && elGeom(el);
    if (!g) continue;
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = T.sel; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
    ctx.lineWidth = Math.max(8, 2 * g.half * v.s);
    for (const pts of g.lines) { ctx.beginPath(); pts.forEach((p, k) => { const [x, y] = v.w2s(p.x, p.y); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); }
    ctx.restore();
  }
}

// ================================================================ Éléments cliquables (survol, fenêtre)
// Géométrie de surbrillance d'un élément : polylignes (monde) et demi-largeur (m).
function elGeom(el) {
  const D = S.D;
  if (el.type === 'ramp') { const R = D?.ramps?.[el.i]; return R?.al?.path ? { lines: [G.samplePath(R.al.path, 2)], half: R.rp.w / 2 + R.rp.bdd } : null; }
  if (el.type === 'hwy' || el.type === 'cross') { const r = el.type === 'hwy' ? D?.hwy : D?.crosses?.[el.i]; return r?.ok ? { lines: [G.samplePath(r.path, 4)], half: r.E2 + r.H.berme } : null; }
  if (el.type === 'branch') {
    const b = S.prj.branches[el.i], q = D?.branches?.find((x) => x.idx === el.i);
    const pts = b?.axis?.length >= 2 ? b.axis : q ? [q.W({ x: q.x0, y: q.a }), q.W({ x: q.xEnd, y: q.a })] : null;
    return pts ? { lines: [pts], half: 5 } : null;
  }
  if (el.type === 'junction') {
    const o = (S.Do || []).find((x) => x.id === el.i); if (!o?.D?.O) return null;
    const R = o.D.kind === 'giratoire' ? o.D.Rg : 14, pts = [];
    for (let k = 0; k <= 64; k++) pts.push(G.polar(o.D.O, R, (k / 64) * 2 * Math.PI));
    return { lines: [pts], half: o.D.kind === 'giratoire' ? (o.D.la || 8) / 2 : 10 };
  }
  if (el.type === 'ring' && D?.O) {
    const R = D.kind === 'giratoire' ? D.Rg - (D.la || 8) / 2 : 12, pts = [];
    for (let k = 0; k <= 64; k++) pts.push(G.polar(D.O, R, (k / 64) * 2 * Math.PI));
    return { lines: [pts], half: D.kind === 'giratoire' ? (D.la || 8) / 2 : 12 };
  }
  return null;
}
// Élément sous le curseur : branches et bretelles avant les axes de section courante, puis l'anneau.
function hitElement(px, py) {
  const D = S.D, P = { x: px, y: py }, cands = [];
  const polyDist = (pts) => { let d = Infinity; for (let k = 1; k < pts.length; k++) { const a = viewer.w2s(pts[k - 1].x, pts[k - 1].y), b = viewer.w2s(pts[k].x, pts[k].y); d = Math.min(d, G.distToSeg(P, { x: a[0], y: a[1] }, { x: b[0], y: b[1] })); } return d; };
  const bi = hitAxis(px, py);
  if (bi >= 0) cands.push({ type: 'branch', i: bi, sc: -100 });
  (D?.ramps || []).forEach((R, i) => { if (!R?.al?.path) return; const tol = Math.max(7, (R.rp.w / 2 + 1) * viewer.s), d = polyDist(R.samp || (R.samp = G.samplePath(R.al.path, 3))); if (d < tol) cands.push({ type: 'ramp', i, sc: d - tol }); });
  if (D?.O) { const [x, y] = viewer.w2s(D.O.x, D.O.y), R = (D.kind === 'giratoire' ? D.Rpo || D.Rg : 15) * viewer.s; const d = Math.hypot(px - x, py - y); if (d < Math.max(10, R)) cands.push({ type: 'ring', i: 0, sc: d < R ? -200 : -50 }); } // dans l'anneau : prioritaire sur l'axe des branches
  for (const o of S.Do || []) { // autres carrefours : un clic dans leur emprise les rend actifs
    if (!o.D?.O) continue;
    const [x, y] = viewer.w2s(o.D.O.x, o.D.O.y), R = Math.max(18, (o.D.kind === 'giratoire' ? o.D.Rpo : 20) * viewer.s), d = Math.hypot(px - x, py - y);
    if (d < R) cands.push({ type: 'junction', i: o.id, sc: -150 + d / R });
  }
  for (const [type, i, r] of [['hwy', 0, D?.hwy], ...(D?.crosses || []).map((c, k) => ['cross', k, c])]) {
    if (!r?.ok) continue;
    const tol = Math.max(7, (r.E2 + r.H.berme) * viewer.s), d = polyDist(G.samplePath(r.path, Math.max(2, 6 / viewer.s)));
    if (d < tol) cands.push({ type, i, sc: d - tol + 1000 }); // les bretelles et branches posées dessus restent prioritaires
  }
  cands.sort((a, b) => a.sc - b.sc);
  return cands[0] ? { type: cands[0].type, i: cands[0].i } : null;
}
// Groupes de champs de la barre latérale affichés dans la fenêtre.
const POP_GROUP = { ramp: '#grpRamp', hwy: '#grpHwy', cross: '#grpCross', branch: '#branchForm', ring: '#grpRing' };
function popTitle(el) {
  if (el.type === 'ramp') { const r = S.prj.ramps[el.i]; return `Bretelle ${r?.name || ''} — ${S.D?.ramps?.[el.i]?.label || ''}`; }
  if (el.type === 'hwy') return `Autoroute ${S.prj.hwy.name || ''}`;
  if (el.type === 'cross') return `Voie secondaire ${S.prj.crosses[el.i]?.name || ''}`;
  if (el.type === 'branch') return `Branche ${S.prj.branches[el.i]?.name || ''}`;
  return `${S.D?.kind === 'giratoire' ? 'Giratoire' : 'Carrefour'} — ${S.prj.jname || ''}`;
}
function openPop(el, px, py) {
  closePop(false);
  if (el.type === 'junction') { switchJunction(el.i, { zoom: false }); el = { type: 'ring', i: 0 }; }
  if (el.type === 'ramp') { S.rsel = el.i; refreshPanels(); }
  if (el.type === 'branch') selectBranch(el.i);
  if (el.type === 'cross') { S.xsel = el.i; S.echSig = ''; refreshPanels(); }
  const pop = $('#elPop'), node = $(POP_GROUP[el.type]);
  if (!node) return;
  const ph = document.createElement('p'); ph.className = 'note moved-note'; ph.textContent = t('Affiché dans la fenêtre de l\'élément sur le plan.');
  node.parentNode.insertBefore(ph, node);
  pop.querySelector('.elpop-body').appendChild(node);
  pop.querySelector('.ttl').textContent = popTitle(el);
  S.pop = el; S.popHome = ph;
  pop.hidden = false;
  const st = $('.stage').getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  pop.style.left = Math.max(12, Math.min(st.width - w - 12, px + 24)) + 'px';
  pop.style.top = Math.max(12, Math.min(st.height - h - 12, py - 40)) + 'px';
  viewer.invalidate();
}
function closePop(redraw = true) {
  if (!S.pop) return;
  const pop = $('#elPop'), node = $(POP_GROUP[S.pop.type]);
  if (node && S.popHome?.parentNode) S.popHome.parentNode.replaceChild(node, S.popHome);
  else S.popHome?.remove();
  S.pop = null; S.popHome = null; pop.hidden = true;
  if (redraw) viewer.invalidate();
}
function popDelete() {
  const el = S.pop; if (!el) return;
  if (el.type === 'ramp') { S.rsel = el.i; closePop(); $('#btnRampDel').click(); return; }
  if (el.type === 'branch') { const n = S.prj.branches.length; deleteBranch(el.i); if (S.prj.branches.length < n) closePop(); return; }
  if (el.type === 'hwy') {
    if (!confirm(t(`Supprimer l'axe de l'autoroute ${S.prj.hwy.name || ''} ? Les bretelles qui s'y raccordent restent à supprimer ou à raccorder.`))) return;
    S.prj.hwy.axis = []; closePop(); update(); return;
  }
  if (el.type === 'cross') {
    const X = S.prj.crosses[el.i]; if (!X) return;
    if (!confirm(t(`Supprimer la voie secondaire ${X.name || ''} ? Les bretelles qui s'y raccordent deviennent libres.`))) return;
    // Les références des voies suivantes (xk:s) sont décalées ; celles de la voie supprimée deviennent libres.
    const shift = (ref) => { const m = /^x(?:(\d+):)?([12])$/.exec(ref || ''); if (!m) return ref; const k = m[1] ? +m[1] : 0; if (k === el.i) return 'free'; return k > el.i ? xref(k - 1, +m[2]) : ref; };
    S.prj.ramps.forEach((r, i) => {
      for (const role of ['from', 'to']) {
        const e = r[role]; if (!e?.ref) continue;
        const nr = shift(e.ref);
        if (nr === 'free' && e.ref !== 'free') { // l'extrémité devient libre : un sommet à sa position actuelle
          const P = S.D?.ramps?.[i]?.pts, q = P && (role === 'from' ? P[0] : P[P.length - 1]);
          if (q) { const v = { x: +q.x.toFixed(3), y: +q.y.toFixed(3), R: '', A: '' }; if (role === 'from') r.pis.unshift(v); else r.pis.push(v); }
          r[role] = { ref: 'free' };
        } else e.ref = nr;
      }
    });
    S.prj.crosses.splice(el.i, 1); S.xsel = Math.min(S.xsel, S.prj.crosses.length - 1); S.echSig = '';
    closePop(); update(); return;
  }
  if (el.type === 'ring') {
    if (!confirm(t(`Supprimer le carrefour ${S.prj.jname || ''} et toutes ses branches ?`))) return;
    closePop(); deleteJunction();
  }
}
function bindJunctions() {
  $('#jList').addEventListener('click', (e) => { const li = e.target.closest('li[data-jid]'); if (!li) return; if (li.dataset.jid === S.prj.jid) zoomGira(); else switchJunction(li.dataset.jid); });
  $('#btnJAdd').addEventListener('click', addJunction);
}
function bindPop() {
  $('#popClose').addEventListener('click', () => closePop());
  $('#popDel').addEventListener('click', popDelete);
  // Déplacement de la fenêtre par son en-tête.
  const head = $('#elPop .elpop-head');
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const pop = $('#elPop'), x0 = e.clientX - pop.offsetLeft, y0 = e.clientY - pop.offsetTop;
    const mv = (ev) => { pop.style.left = ev.clientX - x0 + 'px'; pop.style.top = ev.clientY - y0 + 'px'; };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  });
}

// ================================================================ Outils
const PROMPTS = {
  select: 'Sélection : survolez un élément (branche, giratoire, bretelle, autoroute) et cliquez-le pour ouvrir sa fenêtre ; glissez ses sommets ou le centre.',
  pan: 'Panoramique : glissez pour déplacer la vue.',
  axis0: 'Axe : cliquez le 1er point, côté extérieur (ou saisissez X,Y).',
  axis1: 'Axe : point suivant vers le carrefour — Entrée / clic droit pour terminer, Retour arrière pour annuler.',
  extend: 'Prolonger l\'axe : cliquez les points suivants vers l\'extérieur — Entrée / clic droit pour terminer, Échap pour annuler.',
  center: 'Centre : cliquez la position du centre de l\'anneau.',
  hwy: 'Autoroute : cliquez les sommets de l\'axe (milieu du TPC) — Entrée / clic droit pour terminer.',
  cross: 'Voie secondaire : cliquez les sommets de son axe (du côté de la voirie ordinaire vers l\'autoroute) — Entrée / clic droit pour terminer.',
  trefle: 'Trèfle : cliquez sur l\'axe de l\'autoroute à l\'endroit du croisement.',
  demitrefle: 'Demi-trèfle : cliquez sur l\'axe de l\'autoroute à l\'endroit du croisement.',
  ramp: 'Bretelle : cliquez sur la chaussée de l\'autoroute ou d\'une bretelle au point S.1,00 m (sortie) ou E.1,00 m (entrée).',
  pickx: 'Échangeur : cliquez la voie secondaire au croisement (trompette : du côté de la voirie ordinaire), ou dessinez une nouvelle voie secondaire en commençant du côté de la voirie ordinaire — Entrée / clic droit pour terminer.',
  trumpet: 'Trompette : cliquez au croisement de la route transversale (ou sur l\'autoroute à l\'endroit de l\'ouvrage), du côté de la voirie ordinaire.',
  measure: 'Mesure : cliquez deux points.',
};

function setTool(t) {
  if (S.tool === 'axis' && t !== 'axis' && S.draft.length >= 2) finishAxis();
  S.tool = t; S.draft = []; S.meas = []; S.drag = null; S.extend = null; S.hwyDraw = false;
  if (!['ramp', 'trumpet', 'trefle', 'demitrefle'].includes(t)) S.rampKind = null;
  if (!['pickx', 'axis'].includes(t)) S.pendingTpl = null;
  $$('.tools [data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  updateCursor(); setPrompt(); viewer.invalidate();
}
function updateCursor() {
  $('#cv').style.cursor = S.space || S.tool === 'pan' ? 'grab' : S.tool === 'select' ? 'default' : 'crosshair';
}
function setPrompt() {
  const k = S.tool === 'axis' ? (S.hwyDraw ? (S.hwyDraw === 'cross' ? 'cross' : 'hwy') : S.extend ? 'extend' : S.draft.length ? 'axis1' : 'axis0') : S.tool;
  $('#stPrompt').textContent = PROMPTS[k] || '';
}
function cancelTool() {
  if (S.extend) { S.draft = []; setTool('select'); return; }
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

// Prolongement d'un axe depuis son « + » : outil axe amorcé sur l'extrémité extérieure.
function startExtend(e) {
  setTool('axis');
  S.extend = { bi: e.bi, atStart: e.atStart };
  S.draft = [e.p];
  S.sel = e.bi;
  renderBranchForm(); setPrompt(); viewer.invalidate();
}

function finishAxis() {
  const pts = dedupe(S.draft);
  S.draft = [];
  if (S.hwyDraw) { // axe de l'autoroute ou nouvelle voie secondaire
    const key = S.hwyDraw === 'cross' ? 'cross' : 'hwy', tpl = S.pendingTpl;
    S.hwyDraw = false; S.pendingTpl = null;
    if (pts.length >= 2) {
      const axis = pts.map((p, i) => ({ x: p.x, y: p.y, r: i && i < pts.length - 1 ? (key === 'hwy' ? 1500 : 400) : '' }));
      if (key === 'hwy') { S.prj.hwy.axis = axis; S.prj.hwy.on = true; }
      else { const k = S.prj.crosses.length; S.prj.crosses.push({ ...newCross(k), axis }); S.xsel = k; }
      S.echSig = ''; update();
      if (key === 'cross' && tpl) { runTemplate(tpl, pts[0], S.prj.crosses.length - 1); return; } // premier point : côté de la voirie ordinaire
    }
    setTool('select'); return;
  }
  if (S.extend) {
    const { bi, atStart } = S.extend, b = S.prj.branches[bi], add = pts.slice(1);
    S.extend = null;
    if (b && add.length) { b.axis = atStart ? [...add.reverse(), ...b.axis] : [...b.axis, ...add]; update(); }
    setTool('select');
    return;
  }
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
  if (!b || !confirm(t(`Supprimer la branche ${b.name} ?`))) return;
  if (b.rampLink) for (const part of b.rampLink.split('|')) { const [rid, end] = part.split(':'), r = S.prj.ramps.find((x) => x.id === rid); if (r) { const E = end === 'from' ? r.pis[0] : r.pis[r.pis.length - 1]; r.noBranch = { x: E.x, y: E.y, end }; delete r.cut; } }
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
    const dragged = (i, k) => S.drag?.bi === i && (S.drag.kind === 'vertex' ? S.drag.vi === k : S.drag.kind === 'seg' && (k === S.drag.vi || k === S.drag.vi + 1));
    S.prj.branches.forEach((b, i) => b.axis.forEach((p, k) => { if (!dragged(i, k)) consider(p, 'sommet'); }));
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
  if (S.sel >= 0) {
    const h = vtx(S.sel);
    if (h) return h;
    const ax = S.prj.branches[S.sel].axis;
    for (let k = 0; k + 1 < ax.length; k++) {
      const [x, y] = viewer.w2s((ax[k].x + ax[k + 1].x) / 2, (ax[k].y + ax[k + 1].y) / 2);
      if (Math.hypot(px - x, py - y) < 7) return { kind: 'seg', bi: S.sel, vi: k, orig: [ax[k], ax[k + 1]] };
    }
  }
  const eh = hitEchHandle(px, py);
  if (eh) return eh;
  for (let i = 0; i < S.prj.branches.length; i++) {
    const e = outerEnd(i);
    if (!e) continue;
    const [x, y] = plusPos(e);
    if (Math.hypot(px - x, py - y) < 9) return { kind: 'plus', e };
  }
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
    else if (S.tool === 'ramp') addRampAt(w);
    else if (S.tool === 'pickx') pickSecondary(w, px, py);
    else if (S.tool === 'measure') { S.meas.push(w); if (S.meas.length > 2) S.meas = [w]; showMeasure(); }
    else if (S.tool === 'select') {
      const h = hitHandle(px, py);
      if (h?.kind === 'plus') { startExtend(h.e); return; }
      if (h) { S.drag = { ...h, start: w, moved: false }; if (h.bi != null) selectBranch(h.bi); return; }
      const el = hitElement(px, py);
      if (el?.type === 'branch') selectBranch(el.i);
      S.drag = { kind: 'pan', px, py, moved: false, deselect: !el, clickEl: el, cpx: px, cpy: py };
    }
    viewer.invalidate();
  });

  cv.addEventListener('pointermove', (e) => { const [px, py] = pos(e); onMove(px, py, e); });

  cv.addEventListener('pointerup', () => {
    const d = S.drag;
    S.drag = null; updateCursor();
    if (!d) return;
    if (['vertex', 'seg', 'center', 'rpi', 'hvx', 'cvx', 'tige'].includes(d.kind) && d.moved) { syncInputs(); update(); }
    else if (d.kind === 'pan') {
      if (!d.moved && d.clickEl) openPop(d.clickEl, d.cpx, d.cpy);
      else if (!d.moved && d.deselect) { if (S.sel >= 0) selectBranch(-1); closePop(); }
      autosave();
    }
  });
  cv.addEventListener('dblclick', () => { if (S.tool === 'axis') finishAxis(); });
  cv.addEventListener('pointerleave', () => { S.hoverEl = null; S.mouse = null; S.cursorW = null; S.snap = null; $('#tip').hidden = true; viewer.invalidate(); });
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
  if (d?.kind === 'vertex') { const ax = S.prj.branches[d.bi].axis; ax[d.vi] = { ...w, r: ax[d.vi].r }; d.moved = true; update({ commit: false, panels: false }); } // le sommet garde son rayon
  else if (d?.kind === 'seg') {
    const ax = S.prj.branches[d.bi].axis, dv = G.sub(w, d.start);
    ax[d.vi] = { ...G.add(d.orig[0], dv), r: d.orig[0].r }; ax[d.vi + 1] = { ...G.add(d.orig[1], dv), r: d.orig[1].r };
    d.moved = true; update({ commit: false, panels: false });
  }
  else if (d?.kind === 'tige') { const tp = S.prj.ramps[d.ri].tp; if (tp?.P0 && tp.u) { tp.Ys = Math.round(Math.max(250, G.dot(G.sub(w, tp.P0), tp.u))); d.moved = true; update({ commit: false, panels: false }); } }
  else if (d?.kind === 'rpi') { const q = S.prj.ramps[d.ri].pis[d.k]; S.prj.ramps[d.ri].pis[d.k] = { ...q, x: w.x, y: w.y }; d.moved = true; update({ commit: false, panels: false }); }
  else if (d?.kind === 'cvx') { const ax = S.prj.crosses[d.c].axis, q = ax[d.k]; ax[d.k] = { ...q, x: w.x, y: w.y }; d.moved = true; update({ commit: false, panels: false }); }
  else if (d?.kind === 'hvx') { const q = S.prj.hwy.axis[d.k]; S.prj.hwy.axis[d.k] = { ...q, x: w.x, y: w.y }; d.moved = true; update({ commit: false, panels: false }); }
  else if (d?.kind === 'center') { S.prj.center = { auto: false, x: w.x, y: w.y }; d.moved = true; update({ commit: false, panels: false }); }
  else if (!d && S.tool === 'select') {
    const h = hitAxis(px, py);
    if (h !== S.hover) S.hover = h;
    const hh = hitHandle(px, py), el = hh ? null : hitElement(px, py);
    S.hoverEl = el;
    $('#cv').style.cursor = hh ? (hh.kind === 'plus' ? 'copy' : 'move') : el ? 'pointer' : 'default';
  } else S.hoverEl = null;
  // Barre d'état
  const zTn = S.tn ? tinZ(S.tn.tin, w.x, w.y) : null;
  $('#stXY').textContent = `X ${w.x.toFixed(3)}   Y ${w.y.toFixed(3)}` + (zTn != null ? `   Z TN ${zTn.toFixed(2)}` : '');
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
      case 'Escape': if (S.pop) { closePop(); return; } cancelTool(); return;
      case 'Enter': if (S.tool === 'axis') finishAxis(); return;
      case 'Backspace': if (S.tool === 'axis' && S.draft.length) { e.preventDefault(); S.draft.pop(); setPrompt(); viewer.invalidate(); } return;
      case 'Delete': if (S.pop) { popDelete(); return; } if (S.sel >= 0) deleteBranch(S.sel); return;
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
  for (const o of S.prj.others || []) for (const b of o.branches || []) pts.push(...b.axis);
  if (S.prj.hwy?.on) { pts.push(...(S.prj.hwy.axis || [])); for (const R of S.D?.ramps || []) if (R?.pts) pts.push(...R.pts); }
  return pts.length ? G.bboxOf(pts) : null;
}
function zoomGira() {
  if (S.D?.O && S.D.zoomR) {
    const O = S.D.O, r = S.D.zoomR;
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
  $('#planFields').innerHTML =
    `<div class="row">${sel('plan.nLanes', 'Voies par sens', [['1', '1'], ['2', '2']], { branch: false })}` +
    `${sel('plan.regime', 'Régime des secondaires', [['stop', 'STOP'], ['cedez', 'Cédez-le-passage']], { branch: false })}</div>` +
    fld('plan.wLane', 'Largeur de voie de la principale', 'm') +
    '<h3>Tourne-à-gauche (TAG)</h3>' +
    '<label class="chk"><input type="checkbox" data-k="plan.tag.on"> Voie de tourne-à-gauche sur la route principale</label>' +
    fld('plan.tag.width', 'Largeur de la voie de TAG', 'm') +
    fld('plan.tag.island', 'Largeur de l\'îlot central a', 'm') +
    '<label class="chk"><input type="checkbox" data-k="plan.tag.raised"> Îlot central en saillie (sinon en marquage)</label>' +
    fld('plan.tag.storage', 'Longueur de stockage', 'm') +
    fld('plan.tag.sifflet', 'Sifflet d\'ouverture de la TAG', 'm') +
    fld('plan.tag.align', 'Alignement droit avant le sifflet', 'm') +
    fld('plan.tag.deport', 'Longueur de déport des bords', 'm', { ph: 'auto' }) +
    fld('plan.tag.presig', 'Présignalisation (nez peint)', 'm') +
    fld('plan.tag.nose', 'Largeur du nez de l\'îlot c (fin de présignalisation)', 'm') +
    fld('plan.tag.mark', 'Distance de marquage (enveloppe peinte / îlot en saillie)', 'm') +
    fld('plan.tag.headBack', 'Recul des têtes d\'îlots centraux (épure PL)', 'm', { ph: '0' }) +
    '<h4>Rayons de raccordement des zones</h4>' +
    fld('plan.tag.rSto', 'Stockage – sifflet', 'm') +
    fld('plan.tag.rSif', 'Sifflet – alignement droit', 'm') +
    fld('plan.tag.rAl', 'Alignement droit – déport', 'm') +
    fld('plan.tag.rDep', 'Déport – présignalisation', 'm') +
    fld('plan.tag.rPre', 'Présignalisation – ligne continue', 'm') +
    '<h3>Épures de giration</h3>' +
    '<label class="chk"><input type="checkbox" data-k="plan.epure"> Semi-remorque 16,50 m : tourne-à-droite et tourne-à-gauche de chaque branche</label>' +
    '<p class="note">Surface balayée tracée sur le calque GIRA_EPURE ; les empiètements sur les bordures et îlots sont signalés dans Contrôles. Visibilité depuis les branches secondaires : onglet Visibilité.</p>';
  $('#visFields').innerHTML =
    '<label class="chk"><input type="checkbox" data-k="section.visOn"> Dessiner les zones de visibilité sur le plan</label>' +
    '<div id="visPick"></div>' +
    '<div data-for="giratoire">' +
    fld('section.visObs', 'Recul de l\'observateur derrière le cédez-le-passage', 'm', { ph: '15' }) + '</div>' +
    '<div data-for="plan">' +
    fld('plan.v85', 'Vitesse V85 de la route principale', 'km/h') +
    fld('plan.tVis', 'Temps de visibilité', 's', { ph: 'auto' }) +
    fld('plan.dObs', 'Recul de l\'œil derrière la ligne', 'm', { ph: 'auto' }) + '</div>';
  $('#deversFields').innerHTML =
    '<div data-for="giratoire">' +
    fld('ring.zC', 'Cote projet au centre zC', 'm') +
    fld('ring.devers', 'Dévers de l\'anneau d (vers l\'extérieur, imposé)', '%') + '</div>' +
    '<div data-for="plan">' +
    fld('ring.zC', 'Cote de l\'axe principal au centre', 'm') +
    fld('plan.camber', 'Dévers en toit de la route principale', '%') +
    fld('plan.pente', 'Pente en long de la principale (+ vers B)', '%', { ph: 'auto' }) + '</div>' +
    fld('ring.pente', 'Déclivité générale du site p', '%') +
    fld('ring.gisPente', 'Gisement de la ligne de plus grande pente (descente)', 'gr') +
    '<div data-for="giratoire">' +
    sel('ring.mode', 'Calage de l\'anneau', [['aci', 'Dévers constant, rive ext. dans la pente (ACI)'], ['cone', 'Cône posé sur le plan incliné']], { branch: false }) + '</div>';
  $('[data-k="ring.devers"]').disabled = true; // 1,5 % imposé
  $('#capFields').innerHTML = '<div data-for="giratoire">' +
    sel('traffic.site', 'Milieu', Object.entries(SITES).map(([k, s]) => [k, s.label]), { branch: false }) + '</div>' +
    fld('traffic.uvpPL', 'Équivalence d\'un poids lourd', 'uvp') +
    '<div data-for="plan"><h3>Créneaux critiques tg et temps de suivi tf</h3>' +
    '<p class="note">Valeurs de base de l\'HCM (vides = automatiques, selon le nombre de voies et le type T / X).</p>' +
    '<table class="pts gaps"><thead><tr><th>Mouvement</th><th>tg (s)</th><th>tf (s)</th></tr></thead><tbody>' +
    Object.entries(GAPS).map(([k, g]) => `<tr><td>${esc(g.label)}</td>` +
      ['tg', 'tf'].map((t) => `<td><input class="odc" data-k="traffic.gaps.${k}.${t}" type="text" inputmode="decimal" autocomplete="off"></td>`).join('') + '</tr>').join('') +
    '</tbody></table></div>';
  $('#visLayers').innerHTML = Object.entries(LAYERS).map(([k, l]) =>
    `<label class="chk"><input type="checkbox" data-vis="${k}"> ${esc(l.label)}</label>`).join('');
  syncCtxUI(); syncCrsUI(); syncInputs();
}

function syncCtxUI() {
  const plan = isPlan(S.prj);
  buildSectionFields();
  buildSignFields();
  buildEchFields();
  $$('#ctxSeg [data-ctx]').forEach((b) => b.classList.toggle('on', b.dataset.ctx === S.prj.context));
  $$('#kindSeg [data-kind]').forEach((b) => b.classList.toggle('on', b.dataset.kind === (S.prj.kind || 'giratoire')));
  $('#ctxNote').textContent = S.prj.context === 'interurbain'
    ? 'Valeurs par défaut et contrôles : SETRA, Aménagement des carrefours interurbains (ACI, 1998).'
    : 'Valeurs par défaut et contrôles : CERTU, Guide des carrefours urbains (1999) / fiche Giratoires urbains ; mini-giratoires (1997).';
  $('#ringGuide').innerHTML = '<h4>Rappels du guide</h4><ul>' + GUIDE_NOTES[plan ? 'plan_' + S.prj.context : S.prj.context].map((t) => `<li>${esc(t)}</li>`).join('') + '</ul>';
  $('#tabRingBtn').textContent = plan ? 'Carrefour' : 'Anneau';
  $('#ringPane').hidden = plan;
  $('#planPane').hidden = !plan;
  $$('#deversFields [data-for], #capFields [data-for], #visFields [data-for]').forEach((el) => (el.hidden = (el.dataset.for === 'plan') !== plan));
  $('#dvHead').textContent = plan ? 'Route principale' : 'Anneau';
  $('#dvChartHead').textContent = plan ? 'Profil en long de la route principale' : 'Profil en long des bords de l\'anneau';
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
  $('#bgPlaces').checked = !!S.prj.bg.places;
  $('#bgPlaces').disabled = S.prj.bg.provider !== 'esri';
  $('#bgSel').disabled = !S.crs.geo;
}

function syncInputs() {
  const br = S.sel >= 0 ? S.prj.branches[S.sel] : null;
  for (const el of $$('[data-k],[data-bk]')) {
    if (el === document.activeElement) continue;
    const src = el.dataset.k ? S.prj : br;
    if (!src) continue;
    let v = getPath(src, el.dataset.k || el.dataset.bk);
    // Signalisation : cases et listes non renseignées → valeur par défaut du contexte.
    if (el.dataset.k?.startsWith('signs.') && (v == null || v === '') && (el.type === 'checkbox' || el.tagName === 'SELECT')) v = signParams(S.prj)[el.dataset.k.slice(6)];
    // Cases du profil en travers non renseignées : valeur par défaut du contexte.
    if (el.type === 'checkbox') el.checked = !!(v ?? (el.dataset.k?.startsWith('section.') ? sectionParams(S.prj)[el.dataset.k.slice(8)] : v));
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
  $('#jList').innerHTML = junctionList().map((j) => `<li data-jid="${j.id}" class="${j.active ? 'on' : ''}"><span class="dot"></span><b>${esc(j.name)}</b><span>${j.kind === 'giratoire' ? 'Giratoire' : `Carrefour en ${j.kind}`} · ${j.n} branche(s)</span><span>${j.active ? t('actif') : ''}</span></li>`).join('');
  if (S.pop) $('#elPop .ttl').textContent = popTitle(S.pop);
  refreshMainSelects();
  refreshEch();
  syncInputs();
  const D = S.D, br = S.prj.branches, plan = isPlan(S.prj);
  if (!plan) {
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
  } else {
    const P = D?.plan;
    $('#planOut').innerHTML = D?.ok && D.main ? kv([
      ['Type', S.prj.kind === 'T' ? 'Carrefour en T' : 'Carrefour en X (croix)'],
      ['Route principale (A – B)', `${br[D.main.a]?.name} – ${br[D.main.b]?.name}`],
      ['Largeur de chaussée', P.widened ? `${fmt(2 * P.half)} m, élargie à ${fmt(2 * P.hw)} m` : `${fmt(2 * P.half)} m`],
      ['Largeur centrale (TAG + îlot)', P.widened ? `${fmt(P.c)} m` : '—'],
      ['Déport des bords', P.widened ? `présignalisation ${fmt(P.tag.presig, 1)} m jusqu'au nez ${fmt(Math.min(P.tag.nose, P.c), 2)} m, puis ${fmt(P.tag.deport, 1)} m (1/${fmt(P.tag.deport / Math.max(0.01, (P.c - Math.min(P.tag.nose, P.c)) / 2), 0)})` : '—'],
      ['Demi-longueur du débouché', fmt(P.Lm, 1) + ' m'],
      ['Visibilité requise', `${fmt((P.v85 / 3.6) * P.tVis, 0)} m (${fmt(P.tVis, 0)} s)`],
      ['Centre', `${D.O.x.toFixed(3)} ; ${D.O.y.toFixed(3)}`],
    ]) : '<p class="note">Dessinez les axes : la route principale est, par défaut, la paire de branches la plus alignée.</p>';
  }
  // Liste des branches
  const lvlOf = (name) => {
    const ls = S.checks.filter((c) => c.group === name).map((c) => c.lvl);
    return ls.includes('err') ? 'err' : ls.includes('warn') ? 'warn' : 'ok';
  };
  $('#branchList').innerHTML = br.length ? br.map((b, i) => {
    const bd = D?.branches.find((q) => q.idx === i);
    const info = bd?.role === 'principale' ? 'route principale'
      : bd?.role === 'secondaire' ? `le ${fmt(bd.entry.w)} · ls ${fmt(bd.exit.w)}`
        : `le ${fmt(+b.le)} · ls ${fmt(+b.ls)}${b.tpc?.on ? ' · TPC' : ''}`;
    return `<li data-bi="${i}" class="${i === S.sel ? 'on' : ''}"><span class="dot ${lvlOf(b.name)}"></span><b>${esc(b.name)}</b>` +
      `<span class="mono dim">${bd ? bd.gis : '—'}</span><span class="dim">${info}</span></li>`;
  }).join('') : '<li class="empty-li">Aucune branche. Utilisez « Dessiner une branche » ou la touche A.</li>';
  if (branchRole() !== S.formRole) renderBranchForm();
  refreshBranchOut();
  refreshAxisRadii();
  refreshDevers();
  refreshChecks();
  refreshPoints();
  refreshCapacity();
  refreshVisibility();
  refreshProfile();
  refreshSigns();
  refreshTerrain();
  refreshPL();
  refreshPT();
  setPrompt();
}

// Liste des branches proposées pour la route principale.
function refreshMainSelects() {
  if (!isPlan(S.prj)) return;
  const opts = '<option value="">automatique</option>' + S.prj.branches.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');
  for (const s of $$('.mainSel')) if (s !== document.activeElement && s.dataset.sig !== opts) { s.innerHTML = opts; s.dataset.sig = opts; }
}

function kv(rows) {
  return '<dl>' + rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('') + '</dl>';
}

// Rôle de la branche sélectionnée : branche de giratoire, route principale ou branche secondaire (T, X).
function branchRole() {
  if (S.sel < 0) return null;
  if (!isPlan(S.prj)) return 'branche';
  return S.D?.branches.find((q) => q.idx === S.sel)?.role || 'secondaire';
}

function renderBranchForm() {
  const host = $('#branchForm');
  const b = S.sel >= 0 ? S.prj.branches[S.sel] : null;
  const role = branchRole();
  S.formRole = role;
  if (!b) { host.innerHTML = '<p class="note">Sélectionnez une branche dans la liste ou cliquez son axe sur le plan.</p>'; return; }
  const head = `<div class="bhead">${fld('name', 'Nom', '', { branch: true, text: true })}<button id="btnDelBranch" class="danger" title="Supprimer (Suppr)">Supprimer</button></div>
    <div id="branchOut" class="kv"></div>`;
  const lanes = `<h4>Voies de la branche</h4>
    <div class="row">${sel('nIn', 'Voies entrantes', [['1', '1'], ['2', '2']])}${sel('nOut', 'Voies sortantes', [['1', '1'], ['2', '2']])}</div>
    ${fld('wLane', 'Largeur de voie courante', 'm', { branch: true })}`;
  const profile = (from) => `<h4>Profil et dévers</h4>
    ${fld('length', `Longueur dessinée depuis ${from}`, 'm', { branch: true, ph: 'auto' })}
    ${fld('pente', 'Pente en long (+ en montée)', '%', { branch: true, ph: 'auto' })}
    ${fld('camber', 'Dévers courant (toit)', '%', { branch: true })}
    ${fld('transition', 'Longueur de variation du dévers', 'm', { branch: true, ph: 'auto' })}`;
  const islandType = sel('island.type', 'Type', [['physique', 'En saillie (bordures)'], ['peint', 'Peint (franchissable)'], ['aucun', 'Aucun']]);
  if (role === 'principale') {
    host.innerHTML = `${head}<p class="note">Branche de la route principale : largeurs, tourne-à-gauche et dévers se règlent dans l'onglet Carrefour.</p>
      ${fld('length', 'Longueur dessinée au-delà du débouché', 'm', { branch: true, ph: 'auto' })}`;
  } else if (role === 'secondaire') {
    host.innerHTML = `${head}
      <h4>Axe</h4>
      <p class="note">Alignement droit sur la longueur du débouché (îlot, retour des bordures, 30 m au-delà de l'îlot), puis raccordement à l'axe saisi, qui est suivi au-delà.</p>
      ${fld('axeR', 'Rayon au raccordement avec l\'alignement droit', 'm', { branch: true, ph: 'auto' })}
      <p class="note">Rayons de raccordement aux sommets de l'axe saisi (vide : rayon ci-dessus) ; ils sont cotés sur le plan.</p>
      <div id="axisRadii"></div>
      <p class="note">Pour une branche courbe, placez des sommets le long du tracé : sur le plan, sommets et milieux de segments se déplacent à la souris ; le « + » au bout de l'axe le prolonge.</p>
      ${lanes}
      <h4>Voie d'entrée (vers la route principale)</h4>
      ${fld('le', 'Largeur à la ligne de cédez / STOP', 'm', { branch: true, ph: 'auto', title: 'Mesurée du bord de l\'îlot au bord extérieur' })}
      ${fld('Re', 'Rayon de bordure côté entrée Re', 'm', { branch: true, ph: 'auto' })}
      <h4>Voie de sortie (depuis la route principale)</h4>
      ${fld('ls', 'Largeur de sortie ls', 'm', { branch: true, ph: 'auto' })}
      ${fld('Rs', 'Rayon de bordure côté sortie Rs', 'm', { branch: true, ph: 'auto' })}
      <h4>Îlot séparateur de la branche (ACI, Fig. 25)</h4>
      ${islandType}
      ${fld('island.length', 'Hauteur du triangle de construction H', 'm', { branch: true, ph: 'auto' })}
      ${fld('island.Ris', 'Rayon Ris (tourne-à-gauche vers la secondaire)', 'm', { branch: true, ph: 'auto' })}
      ${fld('island.Rie', 'Rayon Rie (tourne-à-gauche vers la principale)', 'm', { branch: true, ph: 'auto' })}
      ${fld('island.gap', 'Retrait de l\'îlot en saillie / rive de la principale', 'm', { branch: true, ph: 'auto' })}
      ${profile('le bord de la chaussée principale')}`;
  } else {
    host.innerHTML = `${head}
      <h4>Axe</h4>
      <label class="chk"><input type="checkbox" data-bk="radial"> Axe radial (passe par le centre de l'anneau)</label>
      ${fld('axeR', 'Rayon au raccordement avec l\'alignement radial', 'm', { branch: true, ph: 'auto' })}
      <p class="note">Rayons de raccordement aux sommets de l'axe saisi (vide : rayon ci-dessus) ; ils sont cotés sur le plan.</p>
      <div id="axisRadii"></div>
      <p class="note">Sur le plan, les sommets et milieux de segments se déplacent à la souris (les rayons sont conservés) ; le « + » au bout de l'axe le prolonge.</p>
      ${lanes}
      <h4>Entrée</h4>
      ${fld('le', 'Largeur d\'entrée le', 'm', { branch: true, title: 'Mesurée du bord de l\'îlot au bord extérieur, au droit de l\'anneau' })}
      ${fld('Re', 'Rayon d\'entrée Re', 'm', { branch: true })}
      <h4>Sortie</h4>
      ${fld('ls', 'Largeur de sortie ls', 'm', { branch: true })}
      ${fld('Rs', 'Rayon de sortie Rs', 'm', { branch: true })}
      <h4>Îlot séparateur</h4>
      ${islandType}
      ${fld('island.base', 'Base du triangle', 'm', { branch: true, ph: 'auto' })}
      ${fld('island.length', 'Hauteur du triangle', 'm', { branch: true, ph: 'auto' })}
      ${fld('island.shift', 'Décalage vers la gauche', 'm', { branch: true, ph: 'auto' })}
      ${fld('island.gap', 'Retrait de la tête / anneau', 'm', { branch: true, ph: 'auto' })}
      <h4>Terre-plein central (TPC)</h4>
      <label class="chk"><input type="checkbox" data-bk="tpc.on"> Branche à chaussées séparées (TPC)</label>
      ${fld('tpc.width', 'Largeur du TPC', 'm', { branch: true })}
      <h4>Voie directe de tourne-à-droite (vers la branche suivante)</h4>
      <label class="chk"><input type="checkbox" data-tadb="${b.id}" ${S.prj.traffic.tad?.[b.id] ? 'checked' : ''}> Dessiner une voie directe de tourne-à-droite</label>
      ${fld('tadR', 'Rayon en axe de la chaussée', 'm', { branch: true, ph: showNum(TAD[S.prj.context].R) })}
      ${fld('tadW', 'Largeur de la chaussée', 'm', { branch: true, ph: showNum(TAD[S.prj.context].w) })}
      ${profile('l\'anneau')}`;
  }
  syncInputs();
  refreshBranchOut();
  refreshAxisRadii();
}

// Rayons de raccordement aux sommets de l'axe saisi (giratoire) : un champ par sommet raccordé, rayon obtenu rappelé.
// Le tableau n'est reconstruit que si la liste des sommets change (on ne perd pas la saisie en cours).
function refreshAxisRadii() {
  const host = $('#axisRadii');
  if (!host) return;
  const b = S.prj.branches[S.sel], bd = S.D?.branches?.find((q) => q.idx === S.sel);
  const fl = (bd?.axisFillets || []).filter((f) => f.vi >= 0);
  const sig = `${S.sel}|${fl.map((f) => f.vi).join(',')}`;
  if (host.dataset.sig !== sig) {
    host.dataset.sig = sig;
    host.innerHTML = fl.length
      ? '<table class="pts axr"><thead><tr><th>Sommet</th><th>Rayon (m)</th><th>Obtenu</th></tr></thead><tbody>' +
        fl.map((f, k) => `<tr><td>S${k + 1}</td><td><input class="odc" data-bk="axis.${f.vi}.r" inputmode="decimal" autocomplete="off" value="${showNum(b?.axis[f.vi]?.r ?? '')}"></td><td class="mono" data-axr="${f.vi}"></td></tr>`).join('') +
        '</tbody></table>'
      : `<p class="note">Aucun sommet raccordé : l'axe saisi est rectiligne au-delà de l'alignement ${isPlan(S.prj) ? 'droit du débouché' : 'radial'}.</p>`;
  }
  const def = +b?.axeR > 0 ? +b.axeR : sectionParams(S.prj).axeR;
  for (const el of host.querySelectorAll('input')) el.placeholder = `auto ${fmt(def, 0)}`;
  for (const f of fl) {
    const td = host.querySelector(`[data-axr="${f.vi}"]`);
    if (td) td.textContent = fmt(f.r, 1) + (Math.abs(f.r - f.want) > 0.05 ? ' (réduit : segments trop courts)' : '');
  }
}

function refreshBranchOut() {
  const host = $('#branchOut');
  if (!host) return;
  const bd = S.D?.branches.find((q) => q.idx === S.sel);
  if (!bd) { host.innerHTML = '<p class="note">Branche non construite : voir l\'onglet Contrôles.</p>'; return; }
  if (bd.role === 'principale') { host.innerHTML = kv([['Gisement de l\'axe', bd.gis], ['Rôle', 'route principale']]); return; }
  const islTxt = bd.isl.type === 'aucun' && !bd.th ? '—' : `${fmt(bd.b)} × ${fmt(bd.h)} m`;
  if (bd.role === 'secondaire') {
    host.innerHTML = kv([
      ['Gisement de l\'axe', bd.gis],
      ['Angle avec la route principale', `${fmt((bd.angle * 200) / Math.PI, 1)} gr`],
      ['Chaussée de la branche l', `${fmt(bd.l)} m`],
      ['le / ls retenues', `${fmt(bd.entry.w)} / ${fmt(bd.exit.w)} m`],
      ['Re / Rs retenus', `${fmt(bd.entry.R)} / ${fmt(bd.exit.R)} m`],
      ...(bd.island?.aci ? [
        ['Triangle H / b1 / b2', `${fmt(bd.h)} / ${fmt(0.55 * bd.l)} / ${fmt(1.45 * bd.l)} m`],
        ['Ris / Rie (giration)', `${fmt(bd.island.aci.Ris)} / ${fmt(bd.island.aci.Rie)} m`],
        ['Têtes d\'îlot central (A / B)', `${fmt(S.D.plan.LdA, 1)} / ${fmt(S.D.plan.LdB, 1)} m du centre`],
      ] : [['Îlot séparateur', 'aucun']]),
      ['Visibilité requise', bd.vis ? `${fmt(bd.vis.D, 0)} m de part et d'autre` : '—'],
    ]);
    return;
  }
  const off = bd.a > 0.005 ? `${fmt(bd.a)} m à droite ⚠` : bd.a < -0.005 ? `${fmt(-bd.a)} m à gauche` : 'radial';
  host.innerHTML = kv([
    ['Gisement de l\'axe', bd.gis],
    ['Excentrement', off],
    ['Îlot (base × hauteur)', islTxt],
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
  if (dv.mode === 'plan') {
    const pr = D.mainProfile, za = pr.map((q) => q.zAxe), zb = pr.map((q) => q.zBord);
    $('#deversOut').innerHTML = kv([
      ['Dévers en toit de la principale', pc(dv.d)],
      ['Pente en long de la principale (A → B)', pc(dv.gradeM)],
      ['Axe : cotes aux extrémités', `${fmt(za[0], 3)} / ${fmt(za[za.length - 1], 3)} m`],
    ]);
    $('#ringChart').innerHTML = lineChart({
      series: [
        { name: 'Axe', color: 'var(--c1)', pts: pr.map((q) => [q.x, q.zAxe]) },
        { name: 'Bords de chaussée', color: 'var(--c2)', pts: pr.map((q) => [q.x, q.zBord]), dash: true },
      ],
      xMin: pr[0].x, xMax: pr[pr.length - 1].x, yMin: Math.min(...za, ...zb) - 0.05, yMax: Math.max(...za, ...zb) + 0.05,
      xLabel: 'Abscisse depuis le centre, de A vers B (m)', yLabel: 'Cote (m)', yFmt: (v) => fmt(v, 2),
    });
  } else {
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
  }
  const db = dv.branches.find((q) => q.idx === S.sel) || dv.branches[0];
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
    xLabel: `Distance depuis le bord ${dv.mode === 'plan' ? 'de la chaussée principale' : 'de l\'anneau'} (m)`, yLabel: 'Dévers (%)', yFmt: (v) => fmt(v, 1) + ' %',
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
  refreshFixPanel();
}

// --------------------------------------------------------- Corrections des épures de giration
// Paramètre à faire varier selon ce que balaie le véhicule : bordure → rayon de bordure du mouvement (Re / Rs) ;
// îlot séparateur → rayon de giration de l'îlot (Ris / Rie) ; tête d'îlot central → recul des têtes.
// Chaque entrée : [objet ('branche' | 'projet'), champ, nom, valeur actuelle, pas, plafond].
function fixParams(e, bd) {
  const P = S.D.plan, out = [];
  const right = e.label.startsWith('tourne-à-droite'), entering = e.label.endsWith('entrant');
  if (e.dC > e.tolC && right) out.push(entering ? ['branche', 'Rs', 'Rs', bd.exit.R, 2, 80] : ['branche', 'Re', 'Re', bd.entry.R, 2, 80]);
  if (e.dS > 0 && !right) out.push(entering ? ['branche', 'island.Ris', 'Ris', bd.K.Ris, 2, 70] : ['branche', 'island.Rie', 'Rie', bd.K.Rie, 2, 70]);
  if (e.dM > 0) out.push(['projet', 'plan.tag.headBack', 'recul des têtes', P.tag.headBack, 0.5, 30]);
  return out;
}

// Pour chaque épure en défaut et chaque paramètre concerné : plus petite valeur qui supprime tout empiètement de ce
// mouvement (le carrefour est reconstruit pour chaque essai, seule cette épure étant calculée), par pas croissants puis
// dichotomie, arrondie au demi-mètre supérieur.
function computeFixes() {
  const src = JSON.stringify(S.prj), out = [];
  for (const e of (S.D?.epures || []).filter((x) => !x.ok)) {
    const bd = S.D.branches.find((q) => q.idx === e.bi);
    if (!bd) continue;
    for (const [obj, key, nm, p0, step, cap] of fixParams(e, bd)) {
      const ok = (v) => {
        const prj = JSON.parse(src);
        setPath(obj === 'projet' ? prj : prj.branches[e.bi], key, v);
        const r = buildDesign(prj, { only: { bi: e.bi, label: e.label } }).epures?.find((x) => x.bi === e.bi && x.label === e.label);
        return !!r?.ok;
      };
      let lo = p0, hi = null;
      for (let v = p0 + step; v <= cap; v = v * 1.25 + step) { if (ok(v)) { hi = v; break; } lo = v; }
      if (hi != null) for (let k = 0; k < 8; k++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; }
      out.push({ e, obj, key, nm, p0, value: hi != null ? Math.ceil(hi * 2) / 2 : null, cap });
    }
  }
  return out;
}

function refreshFixPanel() {
  const host = $('#fixPanel'), bad = (S.D?.epures || []).filter((x) => !x.ok);
  if (!isPlan(S.prj) || !bad.length) { host.innerHTML = ''; return; }
  const fresh = S.fixes && S.fixes.sig === JSON.stringify(S.prj);
  let html = '<h3>Corrections des épures de giration</h3><p class="note">Plus petit rayon qui supprime chaque empiètement du semi-remorque (le carrefour est recalculé pour chaque essai), ou l\'aménagement équivalent sans changer le rayon.</p>';
  if (!fresh) html += `<button id="btnFixes" class="primary">Calculer les corrections (${bad.length} empiètement${bad.length > 1 ? 's' : ''})</button>`;
  else {
    // Aménagement équivalent sans changer le paramètre : surlargeur revêtue (bordure) ou partie franchissable (îlot).
    const alt = ({ e, key }) => (key === 'Re' || key === 'Rs'
      ? `surlargeur revêtue de ${fmt(Math.ceil((e.dC - e.tolC) * 20) / 20, 2)} m à l'intérieur du virage`
      : key === 'plan.tag.headBack' ? `nez de l'îlot central franchissable sur ${fmt(Math.ceil(e.dM * 20) / 20, 2)} m`
        : `îlot séparateur franchissable ou réduit de ${fmt(Math.ceil(e.dS * 20) / 20, 2)} m`);
    html += '<div class="tablewrap"><table class="pts fixes"><thead><tr><th>Branche</th><th>Mouvement</th><th>Correction</th><th>Ou</th><th></th></tr></thead><tbody>' +
      S.fixes.list.map((f, i) => `<tr><td>${esc(f.e.name)}</td><td>${esc(f.e.label)}</td>` +
        `<td class="mono">${esc(f.nm)} ${fmt(f.p0, 1)} → ${f.value != null ? `<b>${fmt(f.value, 1)} m</b>` : `insuffisant jusqu'à ${fmt(f.cap, 0)} m`}</td>` +
        `<td>${esc(alt(f))}</td><td>${f.value != null ? `<button data-fix="${i}">Appliquer</button>` : ''}</td></tr>`).join('') +
      '</tbody></table></div><p class="note">« Appliquer » reporte la valeur dans la fiche de la branche (ou, pour le recul des têtes, dans l\'onglet Carrefour) ; relancer ensuite le calcul pour vérifier l\'ensemble.</p>';
  }
  host.innerHTML = html;
}

function refreshPoints() {
  const pts = S.D?.points || [];
  $('#ptsInfo').textContent = pts.length ? `${pts.length} points · ${S.crs.geo ? S.crs.label : 'coordonnées locales'}` : '';
  $('#ptsTable').innerHTML = pts.length
    ? '<thead><tr><th>N°</th><th>Désignation</th><th>X</th><th>Y</th><th>Z</th></tr></thead><tbody>' +
      pts.map((q) => `<tr data-pt="${q.n - 1}"><td>${q.n}</td><td>${esc(q.name)}</td><td class="mono">${q.p.x.toFixed(3)}</td><td class="mono">${q.p.y.toFixed(3)}</td><td class="mono">${q.z == null ? '' : q.z.toFixed(3)}</td></tr>`).join('') + '</tbody>'
    : '<tbody><tr><td class="note">Aucun point : dessinez les branches.</td></tr></tbody>';
}

// --------------------------------------------------------- Profil en travers
function buildSectionFields() {
  const d = SECTION[S.prj.context], urb = S.prj.context === 'urbain';
  const f = (k, label, unit) => fld('section.' + k, label, unit, { ph: showNum(d[k]) });
  $('#sectionFields').innerHTML =
    '<h3>Rives et bandes dérasées</h3>' +
    '<label class="chk"><input type="checkbox" data-k="section.rive"> Rives peintes (marquage de rive)</label>' +
    f('bdd', 'BDD — bord extérieur (anneau et branches)', 'm') +
    f('bdgRing', 'BDG de l\'anneau — côté îlot central', 'm') +
    f('bdgBr', 'BDG des branches — côté îlots séparateurs', 'm') +
    (urb
      ? '<h3>Abords urbains (largeurs en plan)</h3>' + f('caniveau', 'Caniveau', 'm') + f('bordure', 'Bordure', 'm') +
        f('trottoir', 'Trottoir', 'm') + f('cBordure', 'Contre-bordure de fin de trottoir', 'm') +
        f('bordureVue', 'Vue de la bordure de trottoir', 'm') + f('trottoirPente', 'Pente du trottoir vers la chaussée', '%')
      : '<h3>Accotement</h3>' + f('berme', 'Berme (au-delà de la BDD)', 'm') + f('bermePente', 'Pente de la berme', '%')) +
    '<h3>Passages piétons et PMR</h3>' +
    '<label class="chk"><input type="checkbox" data-k="section.pp"> Passages piétons sur les branches</label>' +
    f('ppW', 'Largeur du passage (IISR : 2,50 m mini)', 'm') + f('ppRecul', 'Recul depuis le cédez-le-passage / le bord de la principale', 'm') +
    '<label class="chk"><input type="checkbox" data-k="section.pmr"> Abaissés de trottoir et bandes d\'éveil de vigilance (PMR)</label>' +
    '<h3>Îlot central et bande franchissable</h3>' + f('bfPente', 'Pente de la bande franchissable', '%') +
    f('bfVue', 'Vue de la bordure de la bande franchissable', 'm') + f('ilotVue', 'Vue de la bordure de l\'îlot central', 'm') +
    '<h3>Axes des branches</h3>' + f('axeR', 'Rayon de raccordement à l\'axe saisi', 'm');
}

// --------------------------------------------------------- Signalisation verticale
function buildSignFields() {
  const urb = S.prj.context === 'urbain', plan = isPlan(S.prj), d = SIGNS[S.prj.context];
  const f = (k, label, unit = 'm') => fld('signs.' + k, label, unit, { ph: d[k] === '' ? 'aucun' : showNum(d[k]) });
  const gammes = Object.entries(GAMMES).map(([k, g]) => [k, g.label]);
  $('#signFields').innerHTML =
    '<label class="chk"><input type="checkbox" data-k="signs.on"> Placer la signalisation verticale sur le plan</label>' +
    '<div class="row">' + sel('signs.gamme', 'Gamme des panneaux', gammes, { branch: false }) +
    sel('signs.classe', 'Rétroréflexion', [['1', 'classe 1'], ['2', 'classe 2']], { branch: false }) + '</div>' +
    `<p class="note">${urb ? 'IISR : gamme normale en agglomération, petite ou miniature si l\'espace manque ; classe 2 recommandée.' : 'SETRA (type R) : tous les panneaux du carrefour en grande gamme, classe 2 ; signal avancé de la secondaire en gamme normale.'}</p>` +
    f('recul', 'Recul du bord du panneau (depuis la BDD / le bord de la voie)') +
    f('hauteur', 'Hauteur sous panneau') +
    (plan
      ? '<h3>Branches secondaires</h3>' +
        (urb ? sel('signs.regimeUrb', 'Régime (signalisation)', [['auto', 'selon l\'onglet Carrefour'], ['cedez', 'Cédez-le-passage'], ['stop', 'STOP'], ['feux', 'Feux tricolores'], ['droite', 'Priorité à droite']], { branch: false }) : '') +
        f('dAv', 'Signal avancé AB3b / AB5 (distance)') +
        '<div class="row">' + sel('signs.gammeAv', 'Gamme du signal avancé', gammes, { branch: false }) + '</div>' +
        '<h3>Route principale</h3>' +
        '<label class="chk"><input type="checkbox" data-k="signs.main"> Signalisation de priorité de la route principale (AB2 / AB6)</label>' +
        '<label class="chk"><input type="checkbox" data-k="signs.gc"> Route principale classée à grande circulation (AB6 après le carrefour)</label>' +
        f('dAB2', 'AB2 en amont du carrefour') + f('dAB6', 'AB6 après le carrefour') +
        '<label class="chk"><input type="checkbox" data-k="signs.dir"> Signalisation de direction D40 / D20 / D60</label>' +
        f('dD40', 'Présignalisation D40') + f('dD60', 'Confirmation D60')
      : '<h3>Giratoire</h3>' +
        f('dA25', 'AB25 (A25) avant la ligne de cédez-le-passage') +
        '<label class="chk"><input type="checkbox" data-k="signs.d42"> Présignalisation diagrammatique D42b</label>' +
        f('dD42', 'D42b avant l\'AB25') +
        sel('signs.doubleAB3a', 'AB3a répété à gauche sur l\'îlot', [['auto', 'si entrée à 2 voies'], ['oui', 'toujours'], ['non', 'jamais']], { branch: false }) +
        f('dB21', 'B21-1 : distance de contrôle à la ligne') +
        '<label class="chk"><input type="checkbox" data-k="signs.d21"> D21 de sortie sur les îlots séparateurs</label>' +
        '<label class="chk"><input type="checkbox" data-k="signs.gc"> Route classée à grande circulation (AB6 après le giratoire)</label>' +
        f('dAB6', 'AB6 après la sortie'));
}

function refreshSigns() {
  const list = S.D?.signs || [], SP = signParams(S.prj);
  $('#signInfo').textContent = !SP.on ? 'Signalisation désactivée.' : list.length ? `${list.length} panneau(x) et balise(s) — calque GIRA_SIGNALISATION, mâts dans les points d'implantation.` : 'Aucun panneau : dessinez les branches.';
  const c = (v, d = 2) => (v == null || v === '' || !Number.isFinite(+v) ? '—' : fmt(+v, d));
  $('#signTable').innerHTML = !list.length ? '' :
    '<thead><tr><th>N°</th><th>Branche</th><th></th><th>Panneau</th><th>Désignation</th><th>Implantation</th><th>Abscisse</th><th>X</th><th>Y</th><th>Gamme</th><th>Largeur</th><th>Hauteur</th><th>Remarque</th></tr></thead><tbody>' +
    list.map((s) => `<tr><td class="mono">${s.n}</td><td>${esc(s.branch)}</td><td class="pict">${signSVG(s.code, 26)}</td><td class="mono"><b>${esc(s.code)}</b></td><td>${esc(CATALOG[s.code]?.label || '')}</td><td>${esc(s.where || '')}</td>` +
      `<td class="mono">${s.x == null ? '—' : c(s.x, 1) + ' m'}</td><td class="mono">${s.p.x.toFixed(3)}</td><td class="mono">${s.p.y.toFixed(3)}</td>` +
      `<td>${esc(GAMMES[s.gamme]?.label || s.gamme)}</td><td class="mono">${c(s.w)} m</td><td class="mono">${c(s.h)} m</td><td class="dim">${esc(s.note || '')}</td></tr>`).join('') + '</tbody>';
}

// --------------------------------------------------------- Terrain naturel (MNT)
// Reconstruit le TIN et ses primitives quand les points ou les options de dessin changent.
function rebuildTerrain() {
  const t = S.prj.tn || {};
  const pts = Array.isArray(t.pts) ? t.pts : [];
  const sig = pts.length ? `${pts.length}|${pts[0]}|${pts[pts.length - 1]}|${t.step}|${t.edges}|${t.points}|${S.prj.opts.textH}` : '';
  if (sig === S.tnSig) return;
  S.tnSig = sig;
  if (pts.length < 3) { S.tn = null; return; }
  try {
    const list = pts.map((p) => ({ x: p[0], y: p[1], z: p[2] }));
    S.tn = buildTerrain(list, { step: t.step === '' || t.step == null ? 1 : +t.step, edges: !!t.edges, points: !!t.points, textH: +S.prj.opts.textH || 0.8 });
  } catch (e) { console.error(e); S.tn = null; toast('MNT : ' + e.message, 'err'); }
}

function setTerrainPoints(pts, source, info) {
  if (pts.length < 3) { toast('Moins de 3 points : pas de MNT.', 'warn'); return; }
  S.prj.tn = { ...S.prj.tn, source, pts: pts.map((p) => [Math.round(p.x * 1000) / 1000, Math.round(p.y * 1000) / 1000, Math.round(p.z * 1000) / 1000]), info: { ...info, n: pts.length } };
  update();
  const tn = S.tn;
  toast(tn ? `MNT : ${tn.tin.n} points, ${tn.tin.nt} triangles, z de ${fmt(tn.tin.zmin)} à ${fmt(tn.tin.zmax)} m.` : 'MNT non construit.', tn ? 'info' : 'err');
}

function refreshTerrain() {
  const t = S.prj.tn || {}, src = t.source || (S.dxf ? 'dxf' : S.crs.geo ? 'srtm' : 'file');
  const cur = S.tnSrc || src;
  $$('#tnSrcSeg [data-tnsrc]').forEach((b) => b.classList.toggle('on', b.dataset.tnsrc === cur));
  $('#tnDxfPane').hidden = cur !== 'dxf'; $('#tnSrtmPane').hidden = cur !== 'srtm'; $('#tnFilePane').hidden = cur !== 'file';
  // Calques 3D du DXF
  const layers = dxfTerrainLayers(S.dxf), sel = $('#tnLayer'), sig = JSON.stringify(layers.map((l) => l.name));
  if (sel.dataset.sig !== sig) {
    sel.dataset.sig = sig;
    sel.innerHTML = layers.length ? layers.map((l) => `<option value="${esc(l.name)}">${esc(l.name)} — ${l.nz} pt 3D${l.nText ? `, ${l.nText} cotes écrites` : ''}</option>`).join('') : '<option value="">(aucun calque avec des cotes)</option>';
  }
  const L = layers.find((l) => l.name === sel.value) || layers[0];
  $('#tnDxfInfo').textContent = !S.dxf ? 'Importez d\'abord un fond DXF (onglet Projet).'
    : !layers.length ? 'Aucune entité avec une cote non nulle dans ce DXF (POINT, LINE, polylignes 3D ou à élévation, 3DFACE, maillages) ni texte numérique.'
      : `${L.name} : ${L.nz} sommets 3D${L.nz ? ` (z de ${fmt(L.zmin)} à ${fmt(L.zmax)} m)` : ''}${L.nText ? `, ${L.nText} cotes écrites` : ''}${L.n > L.nz ? ` ; ${L.n - L.nz} sommets à z = 0 ignorés` : ''}.`;
  $('#btnTnDxf').disabled = !L || (!L.nz && !L.nText);
  $('#btnTnSrtm').disabled = !S.crs.geo;
  $('#tnSrtmInfo').textContent = S.crs.geo ? '' : 'Choisissez un système de coordonnées géoréférencé (onglet Projet).';
  // Résultat
  const tn = S.tn, info = t.info || {};
  const srcLabel = { dxf: `calque DXF « ${info.layer || ''} »`, srtm: `SRTM (niveau ${info.zoom || ''}, ≈ ${fmt(info.res || 0, 0)} m)`, file: `fichier ${info.file || ''}` }[t.source] || '—';
  $('#tnOut').innerHTML = tn ? kv([
    ['Source', srcLabel],
    ['Points / triangles', `${tn.tin.n} / ${tn.tin.nt}`],
    ['Cotes', `${fmt(tn.tin.zmin)} à ${fmt(tn.tin.zmax)} m`],
    ['Emprise', `${fmt(tn.tin.bbox.x1 - tn.tin.bbox.x0, 0)} × ${fmt(tn.tin.bbox.y1 - tn.tin.bbox.y0, 0)} m`],
    ['Courbes de niveau', tn.step > 0 ? `${tn.contours} niveaux (équidistance ${fmt(tn.step, 2)} m)` : 'aucune'],
    ['Cote TN au centre', S.D?.O ? (tinZ(tn.tin, S.D.O.x, S.D.O.y) != null ? fmt(tinZ(tn.tin, S.D.O.x, S.D.O.y)) + ' m' : 'hors du MNT') : '—'],
  ]) : '<p class="note">Aucun MNT. Choisissez une source de points.</p>';
  $('#btnTnZc').disabled = !tn || !S.D?.O;
  $('#btnTnClear').disabled = !tn;
  $('#tnNote').textContent = t.source === 'srtm' ? SRTM_ATTR + '. Altitudes orthométriques (EGM96) ; le projet peut être calé sur une autre référence.' : tn ? 'Cote TN affichée sous le curseur dans la barre d\'état.' : '';
}

function bindTerrain() {
  $('#tnSrcSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-tnsrc]'); if (!b) return; S.tnSrc = b.dataset.tnsrc; refreshTerrain(); });
  $('#tnLayer').addEventListener('change', refreshTerrain);
  $('#btnTnDxf').addEventListener('click', () => {
    const layer = $('#tnLayer').value;
    if (!S.dxf || !layer) return;
    const pts = pointsFromDxf(S.dxf, layer, { texts: $('#tnTexts').checked });
    setTerrainPoints(pts, 'dxf', { layer, file: S.dxfName });
  });
  $('#btnTnSrtm').addEventListener('click', async () => {
    if (!S.crs.geo) return;
    let bb = designBBox();
    if (bb && !(isFinite(bb.x0) && isFinite(bb.y0) && isFinite(bb.x1) && isFinite(bb.y1))) bb = G.bboxOf(S.prj.branches.flatMap((b) => b.axis));
    if (!bb || !isFinite(bb.x0)) { toast('Dessinez d\'abord les branches : l\'emprise du SRTM est celle du projet.', 'warn'); return; }
    const margin = parseNum($('#tnMargin').value) || 300, zoom = +$('#tnZoom').value || 12, btn = $('#btnTnSrtm');
    btn.disabled = true; $('#tnSrtmInfo').textContent = 'Téléchargement…';
    try {
      const r = await fetchSRTM(S.crs, bb, { zoom, margin, onProgress: (d, n) => { $('#tnSrtmInfo').textContent = `Tuiles ${d} / ${n}…`; } });
      $('#tnSrtmInfo').textContent = `${r.raw} pixels lus${r.pts.length < r.raw ? `, ${r.pts.length} conservés` : ''}.`;
      setTerrainPoints(r.pts, 'srtm', { zoom: r.zoom, res: r.res, tiles: r.tiles, margin });
    } catch (e) {
      console.error(e);
      $('#tnSrtmInfo').textContent = '';
      toast('SRTM : ' + e.message + ' — si le téléchargement est bloqué (réseau, CORS), exportez le MNT en .asc depuis QGIS et importez-le comme fichier.', 'err');
    } finally { btn.disabled = false; }
  });
  $('#btnTnFile').addEventListener('click', () => $('#fileTn').click());
  $('#fileTn').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const pts = parsePointsFile(await f.text());
      if (pts.length < 3) throw new Error('aucun point X Y Z lisible');
      setTerrainPoints(pts, 'file', { file: f.name });
    } catch (err) { toast('Fichier de points : ' + err.message, 'err'); }
  });
  $('#btnTnZc').addEventListener('click', () => {
    if (!S.tn || !S.D?.O) return;
    const z = tinZ(S.tn.tin, S.D.O.x, S.D.O.y);
    if (z == null) { toast('Le centre du carrefour est hors du MNT.', 'warn'); return; }
    S.prj.ring.zC = Math.round(z * 100) / 100;
    update();
    toast(`zC calée sur le TN : ${fmt(S.prj.ring.zC)} m.`);
  });
  $('#btnTnClear').addEventListener('click', () => { S.prj.tn = { ...S.prj.tn, source: '', pts: [], info: null }; update(); });
}

// --------------------------------------------------------- Profil en long
// Branche affichée dans l'onglet : celle choisie, sinon la branche sélectionnée sur le plan, sinon la première.
function plBranch() {
  const D = S.D, cands = (D?.branches || []).filter((bd) => bd.role !== 'principale');
  if (!cands.length) return null;
  let bd = cands.find((q) => q.idx === S.plSel) || cands.find((q) => q.idx === S.sel) || cands[0];
  return bd;
}
function plData() {
  const bd = plBranch();
  if (!bd) return null;
  const db = S.D.devers?.branches?.find((q) => q.idx === bd.idx);
  if (!db) return null;
  const br = S.prj.branches[bd.idx], sEnd = axisLength(bd);
  // Sans profil saisi : ligne droite à la pente courante, affichée à titre indicatif.
  const PL = db.pl || plBuild({ pis: [{ s: sEnd, z: db.z0 + db.grade * sEnd, R: 0 }] }, db.z0);
  return { bd, db, br, sEnd, PL, defined: !!db.pl };
}
function refreshPL() {
  const sel = $('#plBranch'), cands = (S.D?.branches || []).filter((bd) => bd.role !== 'principale');
  const sig = JSON.stringify(cands.map((b) => [b.idx, b.name]));
  if (sel.dataset.sig !== sig) { sel.dataset.sig = sig; sel.innerHTML = cands.map((b) => `<option value="${b.idx}">${esc(b.name)}</option>`).join(''); }
  const d = plData();
  if (!d) { $('#plChart').innerHTML = '<p class="note">Dessinez les branches pour afficher leur profil en long.</p>'; $('#plTable').innerHTML = ''; $('#plStations').innerHTML = ''; $('#plChecks').innerHTML = ''; return; }
  sel.value = String(d.bd.idx);
  const { bd, PL, sEnd, br } = d;
  const tnLine = S.tn ? plTerrainLine(bd, S.tn.tin, Math.max(sEnd, PL.sEnd)) : [];
  const ve = +($('#plVe').value || 0);
  $('#plChart').innerHTML = plChartSVG(PL, tnLine, sEnd, { ve, sel: S.plPi });
  // Tableau des PI
  const pis = br.pl?.pis || [];
  $('#plTable').innerHTML = '<thead><tr><th>PI</th><th>s (m)</th><th>z (m)</th><th>R (m)</th><th>pente aval</th><th></th></tr></thead><tbody>' +
    `<tr><td>anneau</td><td class="mono">0,00</td><td class="mono">${fmt(d.db.z0)}</td><td class="mono">—</td><td class="mono">${PL.segs[0] ? fmt(PL.segs[0].g * 100, 2) + ' %' : '—'}</td><td></td></tr>` +
    pis.map((q, i) => `<tr class="${i === S.plPi ? 'on' : ''}"><td>PI ${i + 1}</td>` +
      ['s', 'z', 'R'].map((f) => `<td><input data-pi="${i}" data-f="${f}" type="text" inputmode="decimal" value="${showNum(q[f] ?? '')}"></td>`).join('') +
      `<td class="mono">${PL.segs[i + 1] ? fmt(PL.segs[i + 1].g * 100, 2) + ' %' : '—'}</td><td class="act"><button data-pidel="${i}" title="Supprimer ce point">×</button></td></tr>`).join('') + '</tbody>';
  // Contrôles du profil
  const checks = d.defined ? plChecks(PL, S.prj.context, sEnd) : [];
  $('#plChecks').innerHTML = checks.length ? '<ul class="checks">' + checks.map((c) => `<li class="${c.lvl}"><span class="ic">${{ err: '✖', warn: '!', info: 'i', ok: '✔' }[c.lvl] || 'i'}</span><span>${esc(c.msg)}</span></li>`).join('') + '</ul>'
    : d.defined ? '<p class="note">Profil conforme aux valeurs de contrôle (ARP / ACI).</p>' : '<p class="note">Aucun profil saisi : pente constante de l\'onglet Branches. Cliquez sur le graphique ou « Proposer depuis le TN ».</p>';
  // Stations
  const step = parseNum($('#plStep').value) || 10;
  const st = plStations(bd, PL, S.tn?.tin, sEnd, step);
  $('#plStations').innerHTML = '<thead><tr><th>s (m)</th><th>X</th><th>Y</th><th>z TN</th><th>z projet</th><th>projet − TN</th><th>pente</th></tr></thead><tbody>' +
    st.map((q) => `<tr><td>${fmt(q.s, 2)}</td><td>${q.p.x.toFixed(2)}</td><td>${q.p.y.toFixed(2)}</td><td>${q.zTN == null ? '—' : fmt(q.zTN)}</td><td>${fmt(q.zP)}</td>` +
      `<td class="${q.dz == null ? '' : q.dz >= 0 ? 'fill' : 'cut'}">${q.dz == null ? '—' : (q.dz >= 0 ? '+' : '−') + fmt(Math.abs(q.dz))}</td><td>${fmt(q.g * 100, 2)} %</td></tr>`).join('') + '</tbody>';
  $('#plNote').textContent = (S.tn ? '' : 'Aucun MNT : le terrain naturel n\'est pas tracé (onglet Terrain). ') + (bd.cont ? 'Au-delà de l\'alignement droit, s suit l\'axe saisi (raccordement compris).' : '');
}
function plSetPi(i, f, v) {
  const br = S.prj.branches[plBranch()?.idx];
  if (!br) return;
  br.pl = br.pl || { pis: [] };
  br.pl.pis[i] = { ...br.pl.pis[i], [f]: v };
}
function plAddPi(s, z, R) {
  const br = S.prj.branches[plBranch()?.idx];
  if (!br) return;
  br.pl = br.pl || { pis: [] };
  br.pl.pis.push({ s: Math.round(s * 10) / 10, z: Math.round(z * 100) / 100, R: R ?? (S.prj.context === 'urbain' ? 800 : 3000) });
  br.pl.pis.sort((a, b) => +a.s - +b.s);
  S.plPi = br.pl.pis.findIndex((q) => Math.abs(+q.s - Math.round(s * 10) / 10) < 1e-6);
  update();
}
function bindPL() {
  $('#plBranch').addEventListener('change', (e) => { S.plSel = +e.target.value; S.plPi = -1; refreshPL(); });
  $('#plVe').addEventListener('change', refreshPL);
  $('#plStep').addEventListener('change', refreshPL);
  const chart = $('#plChart');
  const pick = (e) => {
    const svg = chart.querySelector('svg'); if (!svg) return null;
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return plChartPick(svg, ((e.clientX - r.left) / r.width) * vb.width, ((e.clientY - r.top) / r.height) * vb.height);
  };
  chart.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('.pl-pi'); if (!h || h.classList.contains('fixed')) return;
    S.plPi = +h.dataset.pi; S.plDrag = { moved: false };
    chart.setPointerCapture?.(e.pointerId); e.preventDefault();
  });
  chart.addEventListener('pointermove', (e) => {
    if (!S.plDrag) return;
    const q = pick(e); if (!q) return;
    S.plDrag.moved = true;
    plSetPi(S.plPi, 's', Math.max(0.5, Math.round(q.s * 10) / 10)); plSetPi(S.plPi, 'z', Math.round(q.z * 100) / 100);
    update({ commit: false });
  });
  chart.addEventListener('pointerup', (e) => {
    if (S.plDrag) { const moved = S.plDrag.moved; S.plDrag = null; if (moved) { commitHistory(); refreshPL(); } else refreshPL(); return; }
    const d = plData(), q = pick(e); if (!d || !q || q.s <= 0.5) return;
    plAddPi(q.s, q.z);
  });
  $('#btnPlAdd').addEventListener('click', () => { const d = plData(); if (!d) return; const s = Math.min(d.sEnd, (d.PL.sEnd || 0) + 40); plAddPi(s, d.PL.zAt(s), 0); });
  $('#btnPlTn').addEventListener('click', () => {
    const d = plData(); if (!d) return;
    if (!S.tn) { toast('Construisez d\'abord le MNT (onglet Terrain).', 'warn'); return; }
    const pis = plFromTerrain(d.bd, S.tn.tin, d.sEnd, { R: S.prj.context === 'urbain' ? 800 : 3000, z0: d.db.z0 });
    if (!pis.length) { toast('La branche est hors du MNT.', 'warn'); return; }
    d.br.pl = { ...d.br.pl, pis }; S.plPi = -1; update();
  });
  $('#btnPlClear').addEventListener('click', () => { const d = plData(); if (!d) return; if (d.br.pl) d.br.pl.pis = []; S.plPi = -1; update(); });
  $('#plTable').addEventListener('input', (e) => { const t = e.target; if (t.dataset.pi == null) return; plSetPi(+t.dataset.pi, t.dataset.f, parseNum(t.value)); update({ commit: false }); });
  $('#plTable').addEventListener('change', (e) => { if (e.target.dataset.pi != null) { const br = S.prj.branches[plBranch()?.idx]; if (br?.pl) br.pl.pis.sort((a, b) => +a.s - +b.s); commitHistory(); refreshPL(); } });
  $('#plTable').addEventListener('click', (e) => { const b = e.target.closest('[data-pidel]'); if (!b) return; const br = S.prj.branches[plBranch()?.idx]; if (!br?.pl) return; br.pl.pis.splice(+b.dataset.pidel, 1); S.plPi = -1; update(); });
  $('#btnPlDxf').addEventListener('click', () => {
    const d = plData(); if (!d) { toast('Aucune branche.', 'warn'); return; }
    const tnLine = S.tn ? plTerrainLine(d.bd, S.tn.tin, Math.max(d.sEnd, d.PL.sEnd)) : [];
    const st = plStations(d.bd, d.PL, S.tn?.tin, d.sEnd, parseNum($('#plStep').value) || 10);
    const ve = +($('#plVe').value || 0) || 5;
    download(fname('dxf').replace(/\.dxf$/, `_PL_${d.bd.name}.dxf`), plDXF(d.PL, tnLine, st, `Profil en long ${d.bd.name} — ${S.prj.name}`, ve), 'application/dxf');
    toast(`Profil en long ${d.bd.name} exporté (exagération × ${ve}).`);
  });
  $('#btnPlCsv').addEventListener('click', () => {
    const d = plData(); if (!d) return;
    const st = plStations(d.bd, d.PL, S.tn?.tin, d.sEnd, parseNum($('#plStep').value) || 10);
    const c = (v, k = 3) => (v == null ? '' : v.toFixed(k).replace('.', ','));
    const rows = ['s;X;Y;Z_TN;Z_projet;projet-TN;pente_%', ...st.map((q) => `${c(q.s, 2)};${c(q.p.x)};${c(q.p.y)};${c(q.zTN, 2)};${c(q.zP, 2)};${c(q.dz, 2)};${c(q.g * 100, 2)}`)];
    download(fname('csv').replace(/\.csv$/, `_PL_${d.bd.name}.csv`), '﻿' + rows.join('\r\n'), 'text/csv;charset=utf-8');
  });
}

// --------------------------------------------------------- Profils en travers
function ptBranch() {
  const cands = (S.D?.branches || []).filter((bd) => bd.role !== 'principale' && bd.zAt);
  if (!cands.length) return null;
  return cands.find((q) => q.idx === S.ptSel) || cands.find((q) => q.idx === S.sel) || cands[0];
}
function ptList() {
  const bd = ptBranch();
  return bd ? crossSections(S.prj, bd, S.tn?.tin) : [];
}
function refreshPT() {
  const sel = $('#ptBranch'), cands = (S.D?.branches || []).filter((bd) => bd.role !== 'principale');
  const sig = JSON.stringify(cands.map((b) => [b.idx, b.name]));
  if (sel.dataset.sig !== sig) { sel.dataset.sig = sig; sel.innerHTML = cands.map((b) => `<option value="${b.idx}">${esc(b.name)}</option>`).join(''); }
  const bd = ptBranch();
  if (!bd) { $('#ptChart').innerHTML = '<p class="note">Dessinez les branches pour afficher leurs profils en travers.</p>'; $('#ptTable').innerHTML = ''; $('#ptStation').innerHTML = ''; return; }
  sel.value = String(bd.idx);
  let list;
  try { list = ptList(); } catch (e) { console.error(e); $('#ptChart').innerHTML = `<p class="note">Profils en travers : ${esc(e.message)}</p>`; return; }
  if (S.ptSt >= list.length) S.ptSt = list.length - 1;
  if (S.ptSt < 0) S.ptSt = 0;
  const st = $('#ptStation'), ssig = JSON.stringify(list.map((c) => c.s));
  if (st.dataset.sig !== ssig) { st.dataset.sig = ssig; st.innerHTML = list.map((c, i) => `<option value="${i}">s = ${fmt(c.s, 1)} m</option>`).join(''); }
  st.value = String(S.ptSt);
  const cs = list[S.ptSt];
  $('#ptChart').innerHTML = cs ? ptChartSVG(cs, { ve: +($('#ptVe').value || 0) }) : '';
  const last = list[list.length - 1];
  $('#ptTable').innerHTML = '<thead><tr><th>s (m)</th><th>z axe</th><th>z TN</th><th>déblai m²</th><th>remblai m²</th><th>V déblai m³</th><th>V remblai m³</th></tr></thead><tbody>' +
    list.map((c, i) => `<tr class="${i === S.ptSt ? 'on' : ''}" data-pts="${i}"><td class="mono">${fmt(c.s, 1)}</td><td class="mono">${fmt(c.zAxe)}</td><td class="mono">${c.zTN == null ? '—' : fmt(c.zTN)}</td>` +
      `<td class="mono cut">${fmt(c.cut, 2)}</td><td class="mono fill">${fmt(c.fill, 2)}</td><td class="mono cut">${fmt(c.vCut, 0)}</td><td class="mono fill">${fmt(c.vFill, 0)}</td></tr>`).join('') + '</tbody>';
  const noTN = list.filter((c) => !c.ok).length, noEnd = list.filter((c) => c.ok && (!c.endL || !c.endR)).length;
  $('#ptNote').textContent = (S.tn ? '' : 'Aucun MNT : les talus et les cubatures ne peuvent pas être calculés (onglet Terrain). ')
    + (noTN ? `${noTN} station(s) hors du MNT. ` : '') + (noEnd ? `${noEnd} station(s) : talus sans entrée en terre dans la demi-largeur de coupe (élargir la coupe). ` : '')
    + (last ? `Total ${bd.name} : déblai ${fmt(last.vCut, 0)} m³, remblai ${fmt(last.vFill, 0)} m³ (aires moyennes, sans décapage ni foisonnement).` : '');
}
function bindPT() {
  $('#ptBranch').addEventListener('change', (e) => { S.ptSel = +e.target.value; S.ptSt = 0; refreshPT(); });
  $('#ptVe').addEventListener('change', refreshPT);
  $('#ptStation').addEventListener('change', (e) => { S.ptSt = +e.target.value; refreshPT(); });
  $('#btnPtPrev').addEventListener('click', () => { S.ptSt = Math.max(0, S.ptSt - 1); refreshPT(); });
  $('#btnPtNext').addEventListener('click', () => { S.ptSt += 1; refreshPT(); });
  $('#ptTable').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-pts]'); if (tr) { S.ptSt = +tr.dataset.pts; refreshPT(); } });
  $('#btnPtDxf').addEventListener('click', () => {
    const bd = ptBranch(); if (!bd) return;
    const list = ptList(), ve = +($('#ptVe').value || 0) || 2;
    download(fname('dxf').replace(/\.dxf$/, `_PT_${bd.name}.dxf`), ptDXF(list, `Profils en travers ${bd.name} — ${S.prj.name}`, ve), 'application/dxf');
    toast(`${list.length} profils en travers exportés (exagération × ${ve}).`);
  });
  $('#btnPtCsv').addEventListener('click', () => {
    const bd = ptBranch(); if (!bd) return;
    const c = (v, k = 2) => (v == null ? '' : v.toFixed(k).replace('.', ','));
    const rows = ['s;X;Y;Z_axe;Z_TN;deblai_m2;remblai_m2;V_deblai_m3;V_remblai_m3', ...ptList().map((q) => `${c(q.s, 1)};${c(q.p.x, 3)};${c(q.p.y, 3)};${c(q.zAxe)};${c(q.zTN)};${c(q.cut)};${c(q.fill)};${c(q.vCut, 1)};${c(q.vFill, 1)}`)];
    download(fname('csv').replace(/\.csv$/, `_PT_${bd.name}.csv`), '﻿' + rows.join('\r\n'), 'text/csv;charset=utf-8');
  });
}

// --------------------------------------------------------- Vue 3D
let v3d = null;
async function open3D() {
  if (!S.D?.ok) { toast('Dessinez d\'abord le carrefour.', 'warn'); return; }
  const box = $('#view3d'); box.hidden = false;
  if (!v3d) {
    try {
      const { View3D } = await import('./view3d.js');
      v3d = new View3D($('#v3dHost'));
      window.addEventListener('resize', () => v3d?.resize());
    } catch (e) { console.error(e); box.hidden = true; toast('Vue 3D indisponible : ' + e.message, 'err'); return; }
  }
  v3d.resize();
  const sel = $('#v3dBranch'), cands = S.D.branches.filter((bd) => bd.role !== 'principale' && bd.zAt);
  sel.innerHTML = cands.map((bd) => `<option value="${bd.idx}">${esc(bd.name)}</option>`).join('');
  build3D();
}
function build3D() {
  if (!v3d || !S.D?.ok) return;
  try { v3d.build(S.prj, S.D, S.tn?.tin, { ve: +$('#v3dVe').value || 1, wire: $('#v3dWire').checked }); }
  catch (e) { console.error(e); toast('Vue 3D : ' + e.message, 'err'); }
  $('#v3dNote').textContent = (S.tn ? '' : 'Aucun MNT (onglet Terrain) : terrain et talus absents. ') + 'Orbite : bouton gauche · panoramique : bouton droit · zoom : molette.';
}
function bind3D() {
  $('#btn3d').addEventListener('click', open3D);
  $('#v3dClose').addEventListener('click', () => { $('#view3d').hidden = true; });
  $('#v3dOverview').addEventListener('click', () => v3d?.overview(S.D));
  $('#v3dRebuild').addEventListener('click', build3D);
  $('#v3dVe').addEventListener('change', build3D);
  $('#v3dWire').addEventListener('change', build3D);
  $('#v3dDriver').addEventListener('click', () => {
    const bd = S.D?.branches.find((q) => q.idx === +$('#v3dBranch').value);
    if (bd && v3d) v3d.driver(S.D, bd, Math.max(5, parseNum($('#v3dDist').value) || 80));
  });
  $('#v3dPng').addEventListener('click', () => { if (!v3d) return; const a = document.createElement('a'); a.href = v3d.snapshot(); a.download = fname('png').replace(/\.png$/, '_3D.png'); a.click(); });
  $('#v3dObj').addEventListener('click', () => { if (!v3d) return; download(fname('obj'), v3d.exportOBJ(S.prj.name), 'text/plain'); toast('Modèle 3D exporté (OBJ, coordonnées du projet).'); });
}

// --------------------------------------------------------- Visibilité
function refreshVisibility() {
  const plan = isPlan(S.prj), V = S.D?.vis || [];
  // Branche dont la zone est dessinée : toutes, ou une seule pour la lisibilité (le tableau les donne toutes).
  const opts = [['', 'Toutes les branches'], ...(S.D?.branches || []).filter((bd) => !plan || bd.role === 'secondaire').map((bd) => [String(bd.id), bd.name])];
  const pick = $('#visPick'), sig = JSON.stringify(opts);
  if (pick.dataset.sig !== sig) {
    pick.dataset.sig = sig;
    pick.innerHTML = '<label class="fld"><span class="lb">Zone dessinée</span><select data-k="section.visBranch">' +
      opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('') + '</select></label>';
  }
  pick.querySelector('select').value = String(S.prj.section?.visBranch ?? '');
  $('#visIntro').textContent = plan
    ? 'Carrefour plan (ACI) : depuis l\'œil du conducteur arrêté sur la branche secondaire, triangles de visibilité sur la route principale jusqu\'à D = V85 × t de part et d\'autre (t = 8 s au STOP, 10 s au cédez-le-passage, + 1 s avec TAG).'
    : 'Giratoire (SETRA) : depuis un observateur placé en amont du cédez-le-passage, au milieu de la voie d\'entrée, le conducteur doit voir en entier le quart gauche de l\'anneau, c\'est-à-dire la chaussée annulaire entre l\'axe de la branche et un quart de tour en amont. Le cône de visibilité doit rester dégagé ; sur l\'îlot central, pas de plantation haute à moins de 2 m de la bordure.';
  $('#visTable').innerHTML = !V.length ? '' : plan
    ? '<thead><tr><th>Branche</th><th>Œil</th><th>V85</th><th>t</th><th>D requise</th></tr></thead><tbody>' +
      V.map((v) => `<tr><td>${esc(v.name)}</td><td class="mono">${fmt(v.obs, 1)} m</td><td class="mono">${fmt(v.v85, 0)} km/h</td><td class="mono">${fmt(v.t, 0)} s</td><td class="mono">${fmt(v.D, 0)} m</td></tr>`).join('') + '</tbody>'
    : '<thead><tr><th>Branche</th><th>Recul</th><th>Quart d\'anneau visé</th><th>Visée la plus longue</th><th>Cône dans l\'îlot central</th></tr></thead><tbody>' +
      V.map((v) => `<tr><td>${esc(v.name)}</td><td class="mono">${fmt(v.obs, 1)} m</td><td class="mono">R ${fmt(v.Ri, 2)} à ${fmt(v.Rg, 2)} m</td><td class="mono">${fmt(v.sight, 1)} m</td><td class="mono${v.depth > 2 ? ' warn' : ''}">${fmt(v.depth, 1)} m</td></tr>`).join('') + '</tbody>';
  $('#visNote').textContent = V.length ? 'Zones tracées sur le calque GIRA_VISIBILITE. Les obstacles ne sont pas contrôlés automatiquement : vérifier sur le fond topographique.' : 'Aucune zone : tracez les branches, ou cochez l\'affichage.';
}

function refreshProfile() {
  const host = $('#profileSvg');
  if (isPlan(S.prj) || !S.D?.ok) { host.innerHTML = '<p class="note">Profil type disponible pour les giratoires.</p>'; return; }
  host.innerHTML = profileSVG(ringProfile(S.prj, S.D));
}

function exportProfileDXF() {
  if (isPlan(S.prj) || !S.D?.ok) { toast('Profil type disponible pour les giratoires.', 'warn'); return; }
  const txt = profileDXF(ringProfile(S.prj, S.D), `Profil en travers type de l'anneau — ${S.prj.name}`);
  download(fname('dxf').replace(/\.dxf$/, '_profil_type.dxf'), txt, 'application/dxf');
}

// --------------------------------------------------------- Capacité
// Entrées du giratoire dans le sens de giration, avec la géométrie utile au calcul de capacité.
function capEntries() {
  if (S.D?.kind !== 'giratoire' || !S.D.ok) return [];
  const T = S.prj.traffic;
  return S.D.branches.map((bd) => {
    const b = S.prj.branches[bd.idx], dv = S.D.devers?.branches.find((q) => q.idx === bd.idx);
    return {
      id: bd.id, name: bd.name, theta: bd.theta,
      le4: bd.entry.w, le15: bd.h >= 15 ? bd.entry.w : bd.entry.wa, // largeur à 4 m et à 15 m en amont
      li: bd.isl.type === 'aucun' ? 2 * bd.th : Math.max(bd.b, 2 * bd.th), ls: bd.exit.w,
      lanes: Math.max(1, +b.nIn || 1), rampe: dv ? -dv.grade > 0.03 : false, // entrée en rampe > 3 %
      qp: T.qp?.[bd.id] === '' || T.qp?.[bd.id] == null ? 10 : +T.qp[bd.id],
    };
  });
}

// Matrice OD : construite quand la liste des branches change ; sinon, seules les cases qui n'ont pas le focus
// reprennent les valeurs du projet (annuler, ouvrir), sans remplacer le tableau pendant la saisie.
function refreshOdTable(entries, giratoire) {
  const T = S.prj.traffic, tbl = $('#odTable');
  const sig = (giratoire ? 'G|' : 'P|') + entries.map((e) => e.id + ':' + e.name).join(',');
  if (tbl.dataset.sig !== sig) {
    tbl.dataset.sig = sig;
    tbl.innerHTML = '<thead><tr><th>de \\ vers</th>' + entries.map((e) => `<th>${esc(e.name)}</th>`).join('') +
      '<th title="Part de poids lourds">% PL</th>' +
      (giratoire ? '<th title="Piétons traversant l\'entrée (10/h par défaut)">Piét./h</th><th title="Voie directe de tourne-à-droite">TAD</th>' : '') +
      '</tr></thead><tbody>' +
      entries.map(({ id: o, name }) => `<tr><th>${esc(name)}</th>` +
        entries.map(({ id: d }) => `<td><input class="odc${o === d ? ' diag' : ''}" data-od="${o}|${d}" inputmode="numeric" placeholder="0"></td>`).join('') +
        `<td><input class="odc" data-pl="${o}" inputmode="decimal" placeholder="0"></td>` +
        (giratoire ? `<td><input class="odc" data-qp="${o}" inputmode="numeric" placeholder="10"></td><td><input type="checkbox" data-tad="${o}"></td>` : '') +
        '</tr>').join('') +
      '</tbody>';
  }
  for (const el of tbl.querySelectorAll('input')) {
    if (el === document.activeElement) continue;
    const { od, pl, qp, tad } = el.dataset;
    if (tad) { el.checked = !!T.tad?.[tad]; continue; }
    const [o, d] = (od || '').split('|');
    const v = od ? T.od?.[o]?.[d] : pl ? T.pl?.[pl] : T.qp?.[qp];
    el.value = showNum(v ?? '');
  }
}

// Branches d'un carrefour plan, dans l'ordre du dessin.
const planEntries = () => (S.D?.ok && S.D.kind !== 'giratoire' && S.D.main ? S.D.branches.map((b) => ({ id: b.id, name: b.name })) : []);

function refreshCapacity() {
  const T = S.prj.traffic, giratoire = !isPlan(S.prj);
  const entries = giratoire ? capEntries() : planEntries();
  $('#capIntro').textContent = giratoire
    ? 'Débits de l\'heure de pointe du matin. Capacité calculée avec le modèle de Girabase 4 (Cerema) : trafic gênant, largeur d\'entrée, îlot, anneau, piétons.'
    : 'Débits de l\'heure de pointe du matin. Carrefour à priorité : capacité des mouvements non prioritaires par acceptation de créneaux (méthode de Brilon / HBS dans la structure de l\'HCM), l\'ACI et le CERTU ne publiant pas de formule (OCTAVE, abaque).';
  $('#capHead').textContent = giratoire ? 'Résultats par entrée' : 'Résultats par voie';
  $('#capMovesWrap').hidden = giratoire;
  if (entries.length < 2) {
    const tbl = $('#odTable');
    tbl.innerHTML = ''; tbl.dataset.sig = '';
    $('#capTable').innerHTML = ''; $('#capMoves').innerHTML = ''; $('#capNotes').innerHTML = '';
    return;
  }
  refreshOdTable(entries, giratoire);
  if (giratoire) refreshCapRound(entries, T);
  else refreshCapPlan(T);
}

const capIcon = { err: '✕', warn: '!', info: 'i', ok: '✓' };
const capLi = (lvl, grp, t) => `<li class="${lvl}"><span class="ic">${capIcon[lvl]}</span><span class="grp">${esc(grp)}</span><span>${esc(t)}</span></li>`;
const n0 = (v) => (Number.isFinite(v) ? v.toFixed(0) : '—');

function refreshCapRound(entries, T) {
  // Girabase : R = îlot infranchissable, LA = largeur roulable de l'anneau (rives + BDG + BDD).
  const ring = { R: S.D.Rb, bf: S.D.bf, la: S.D.la + S.D.sec.bdgRing + S.D.sec.bdd };
  const { res, consts } = analyse(T, ring, entries);
  const rows = entries.map((e) => {
    const r = res.get(e.id);
    return `<tr><td>${esc(e.name)}</td><td class="mono">${n0(r.Qe)}</td><td class="mono">${n0(r.Qc)}</td><td class="mono">${n0(r.Qs)}</td>` +
      `<td class="mono">${n0(r.Qg)}</td><td class="mono">${n0(r.C)}</td><td class="mono ${r.lvl}">${n0(r.RC)}</td>` +
      `<td class="mono ${r.lvl}">${n0(r.RCp * 100)} %</td><td class="mono">${n0(r.TMA)}</td><td class="mono">${fmt(r.LK, 1)} / ${fmt(r.LKM, 1)}</td></tr>`;
  });
  $('#capTable').innerHTML = '<thead><tr><th>Entrée</th><th>Qe</th><th>Qc</th><th>Qs</th><th>Qg</th><th>C</th><th>Réserve</th><th>%</th><th>Att. (s)</th><th>File moy./max</th></tr></thead><tbody>' + rows.join('') + '</tbody>';
  $('#capMoves').innerHTML = '';
  const notes = entries.flatMap((e) => res.get(e.id).notes.map((t) => capLi(res.get(e.id).lvl, e.name, t)));
  if (consts.oversized) notes.push(capLi('info', 'Giratoire', 'Réserve > 80 % sur toutes les entrées : giratoire probablement injustifié.'));
  const bypass = entries.filter((e) => res.get(e.id).Qbp > 0).map((e) => `${e.name} (${n0(res.get(e.id).Qbp)} uvp/h)`);
  $('#capNotes').innerHTML =
    (notes.length ? '<ul class="checks">' + notes.join('') + '</ul>' : '<p class="note">Aucune remarque : réserves comprises entre 25 et 50 %.</p>') +
    (bypass.length ? `<p class="note">Voies directes de tourne-à-droite (retirées du giratoire) : ${esc(bypass.join(', '))}.</p>` : '') +
    `<p class="note">${esc(consts.site.label)}${consts.mini ? ' (mini-giratoire)' : ''} : Tg ${fmt(consts.site.Tg)} s, Tf ${fmt(consts.site.Tf)} s · anneau utile ${fmt(consts.LAU)} m (KE ${fmt(consts.KE)}, KI ${fmt(consts.KI)}) · largeur d'entrée utile max ${fmt(consts.LEU)} m. ` +
    'Débits en uvp/h ; Qc : débit sur l\'anneau devant l\'entrée ; Qg : trafic gênant ; réserve en % de la capacité ; files en véhicules par voie. ' +
    'Seuils du manuel Girabase : 25–80 % bon fonctionnement, 5–25 % files aux hyper-pointes, < 5 % saturation.</p>';
}

function refreshCapPlan(T) {
  const P = S.D.plan;
  const gp = gapParams(T, S.prj.kind, P.nLanes);
  for (const [k, g] of Object.entries(gp)) {
    const a = $(`[data-k="traffic.gaps.${k}.tg"]`), b = $(`[data-k="traffic.gaps.${k}.tf"]`);
    if (a) a.placeholder = showNum(+g.tg0.toFixed(2));
    if (b) b.placeholder = showNum(g.tf0);
  }
  const r = analysePlan(T, S.D, (bd) => Math.max(1, +S.prj.branches[bd.idx]?.nIn || 1));
  if (r.error) {
    $('#capTable').innerHTML = ''; $('#capMoves').innerHTML = '';
    $('#capNotes').innerHTML = `<ul class="checks">${capLi('err', 'Carrefour', r.error)}</ul>`;
    return;
  }
  const pc = (v) => (Number.isFinite(v) ? `${Math.round(v * 100)} %` : '—');
  $('#capTable').innerHTML = '<thead><tr><th>Voie</th><th>Mouvements</th><th>q</th><th>C</th><th>Réserve</th><th>%</th>' +
    '<th title="Attente moyenne HBS (T = 1 h)">Att. (s)</th><th title="Niveau de qualité HBS (A à F)">Niv.</th>' +
    '<th title="Attente CERTU T = 3600 / (C − S)">T CERTU</th><th title="File à 95 % (HCM), en véhicules">File 95 %</th></tr></thead><tbody>' +
    r.lanes.map((l) => `<tr><td>${esc(l.label)}</td><td>${esc(l.type)}</td><td class="mono">${n0(l.q)}</td><td class="mono">${n0(l.C)}</td>` +
      `<td class="mono ${l.lvl}">${n0(l.R)}</td><td class="mono ${l.lvl}">${pc(l.Rp)}</td><td class="mono">${n0(l.w)}</td>` +
      `<td class="mono ${l.lvl}">${l.qsv}</td><td class="mono">${n0(l.Tc)}</td><td class="mono">${fmt(l.q95, 1)}</td></tr>`).join('') + '</tbody>';
  $('#capMoves').innerHTML = '<thead><tr><th>Mouvement</th><th>Type</th><th>Rang</th><th>q</th><th title="Trafic conflictuel">qp</th><th>tg</th><th>tf</th><th>C</th></tr></thead><tbody>' +
    r.moves.map((m) => `<tr><td>${esc(m.o.name)} → ${esc(m.d.name)}</td><td>${esc(m.type)}</td><td class="mono">${m.rank}</td><td class="mono">${n0(m.q)}</td>` +
      `<td class="mono">${n0(m.qp)}</td><td class="mono">${fmt(m.tg, 1)}</td><td class="mono">${fmt(m.tf, 1)}</td><td class="mono">${n0(m.C)}</td></tr>`).join('') + '</tbody>';
  const notes = [
    ...r.notes.map((n) => capLi(n.lvl, n.grp, n.msg)),
    ...r.lanes.flatMap((l) => l.notes.map((t) => capLi(l.lvl === 'ok' ? 'warn' : l.lvl, l.label, t))),
  ];
  if (S.prj.context === 'urbain' && r.total > 1200) notes.push(capLi('warn', 'Carrefour', `trafic total ${n0(r.total)} uvp/h, au-delà de la limite indicative du CERTU (≈ 1200 uvp/h) pour un carrefour à cédez-le-passage`));
  $('#capNotes').innerHTML =
    (notes.length ? '<ul class="checks">' + notes.join('') + '</ul>' : '<p class="note">Aucune remarque : attentes inférieures à 30 s.</p>') +
    `<p class="note">Débits en uvp/h. Route principale à ${P.nLanes} voie(s) par sens, ${P.tagA || P.tagB ? 'avec' : 'sans'} voie de TAG ; secondaires au ${P.regime === 'stop' ? 'STOP' : 'cédez-le-passage'}. ` +
    'Mouvements prioritaires (TD et TAD de la principale) non limités. Capacité de base de Siegloch C = 3600/tf · exp(−qp/3600 · (tg − tf/2)), réduite par les probabilités d\'absence de file des rangs supérieurs. ' +
    'Niveaux HBS : A ≤ 10 s, B ≤ 20, C ≤ 30, D ≤ 45, E > 45, F si saturé. CERTU : T = 3600/(C − S) acceptable sous 30 s, à apprécier jusqu\'à 1 min, feux au-delà. ' +
    'Stockage de TAG selon l\'ACI : (7 + 10p)·N, N pris égal à la file à 95 %.</p>';
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
  // Les champs de la fenêtre d'élément (déplacés depuis la barre latérale) partagent les mêmes gestionnaires délégués.
  const panel = { addEventListener: (ty, f, o) => { $('.panel').addEventListener(ty, f, o); $('#elPop').addEventListener(ty, f, o); } };
  panel.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.k) {
      setPath(S.prj, t.dataset.k, readInput(t));
      if (t.dataset.k.startsWith('center.')) { S.prj.center.auto = false; $('#centerAuto').checked = false; }
      update({ commit: false });
    } else if (t.dataset.bk && S.sel >= 0) {
      setPath(S.prj.branches[S.sel], t.dataset.bk, readInput(t));
      update({ commit: false });
    } else if (t.dataset.od || t.dataset.pl || t.dataset.qp || t.dataset.tad) {
      const T = S.prj.traffic, v = parseNum(t.value);
      if (t.dataset.od) { const [o, d] = t.dataset.od.split('|'); T.od[o] = { ...T.od[o], [d]: v }; }
      else if (t.dataset.pl) T.pl[t.dataset.pl] = v;
      else if (t.dataset.qp) T.qp = { ...T.qp, [t.dataset.qp]: v };
      else T.tad = { ...T.tad, [t.dataset.tad]: t.checked };
      if (t.dataset.tad) update({ commit: false }); // la voie directe modifie aussi le dessin
      else { refreshCapacity(); autosave(); }
    } else if (t.dataset.tadb) {
      S.prj.traffic.tad = { ...S.prj.traffic.tad, [t.dataset.tadb]: t.checked };
      update({ commit: false });
    } else if (t.dataset.vis) {
      S.prj.opts.vis[t.dataset.vis] = t.checked; viewer.invalidate(); autosave();
    }
  });
  panel.addEventListener('change', (e) => {
    if (e.target.dataset.k || e.target.dataset.bk) { commitHistory(); syncInputs(); }
    if (e.target.dataset.od || e.target.dataset.pl || e.target.dataset.qp || e.target.dataset.tad || e.target.dataset.tadb) commitHistory();
  });
  panel.addEventListener('click', (e) => {
    const li = e.target.closest('#branchList li[data-bi]');
    if (li) { selectBranch(+li.dataset.bi); return; }
    if (e.target.id === 'btnFixes') {
      e.target.disabled = true; e.target.textContent = 'Calcul en cours…';
      setTimeout(() => { S.fixes = { sig: JSON.stringify(S.prj), list: computeFixes() }; refreshFixPanel(); }, 30);
      return;
    }
    if (e.target.dataset.fix != null) {
      const f = S.fixes?.list[+e.target.dataset.fix];
      if (f) { setPath(f.obj === 'projet' ? S.prj : S.prj.branches[f.e.bi], f.key, f.value); syncInputs(); update(); }
      return;
    }
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
  $$('#kindSeg [data-kind]').forEach((b) => b.addEventListener('click', () => setKind(b.dataset.kind)));
  $('#crsSel').addEventListener('change', (e) => {
    const id = e.target.value, c = { ...S.prj.crs, id };
    if (id === 'utm' && S.crs.geo) { const ll = S.crs.toLL(viewer.cx, viewer.cy); c.zone = utmZoneOf(ll.lon); c.south = ll.lat < 0; }
    if (id === 'custom' && !c.def) { syncCrsUI(); $('#crsSel').value = 'custom'; $('#crsCustomRow').hidden = false; $('#crsDef').focus(); return; }
    changeCRS(c);
  });
  $('#crsZone').addEventListener('change', (e) => { const z = Math.round(+e.target.value); if (z >= 1 && z <= 60) changeCRS({ ...S.prj.crs, zone: z }); else syncCrsUI(); });
  $('#crsSouth').addEventListener('change', (e) => changeCRS({ ...S.prj.crs, south: e.target.checked }));
  $('#crsDef').addEventListener('change', (e) => changeCRS({ ...S.prj.crs, id: 'custom', def: e.target.value.trim() }));
  $('#bgSel').addEventListener('change', (e) => { S.prj.bg.provider = e.target.value; $('#bgPlaces').disabled = e.target.value !== 'esri'; viewer.invalidate(); commitHistory(); autosave(); });
  $('#bgPlaces').addEventListener('change', (e) => { S.prj.bg.places = e.target.checked; viewer.invalidate(); autosave(); });
  $('#bgOpacity').addEventListener('input', (e) => { S.prj.bg.opacity = +e.target.value; viewer.invalidate(); autosave(); });
  $('#themeSel').addEventListener('change', (e) => { S.prj.opts.theme = e.target.value; viewer.invalidate(); autosave(); });
  $('#angSel').addEventListener('change', (e) => { S.prj.opts.angleUnit = e.target.value; update(); });
  $('#centerAuto').addEventListener('change', (e) => { S.prj.center.auto = e.target.checked; update(); });
  $('#prjName').addEventListener('change', (e) => { S.prj.name = e.target.value.trim() || 'Giratoire'; commitHistory(); autosave(); });
  $('#btnRingDefaults').addEventListener('click', applyGuideValues);
  $('#btnAddBranch').addEventListener('click', () => setTool('axis'));
  $('#btnPlaceCenter').addEventListener('click', () => setTool('center'));
  $('#btnProfilDxf').addEventListener('click', exportProfileDXF);
  $('#btnApplyAll').addEventListener('click', applyToAll);

  $('#geoGo').addEventListener('click', () => geoSearch($('#geoQ').value));
  $('#geoQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') geoSearch(e.target.value); });
  $('#geoRes').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-lat]');
    if (li) { goToLL(+li.dataset.lat, +li.dataset.lon, 2.5); $('#geoRes').innerHTML = ''; }
  });

  bindTerrain();
  bindPL();
  bindPT();
  bind3D();
  bindEch();
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
    if (S.prj.branches.length && !confirm(t('Créer un nouveau projet ? Le projet en cours non enregistré sera perdu.'))) return;
    const keep = { crs: S.prj.crs, bg: S.prj.bg, opts: S.prj.opts, kind: S.prj.kind };
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
  const apply = !S.prj.branches.length || confirm(t(`Appliquer les valeurs par défaut du guide ${c === 'urbain' ? 'CERTU (urbain)' : 'SETRA ACI (interurbain)'} à l'anneau et à toutes les branches ?`));
  S.prj.context = c;
  if (apply) {
    const P = PRESETS[c];
    Object.assign(S.prj.ring, { Rg: P.ring.Rg, la: P.ring.la, bf: P.ring.bf, devers: P.ring.devers });
    S.prj.plan = { ...defaultPlan(c), main: S.prj.plan?.main || ['', ''] };
    S.prj.section = {}; // profil en travers : valeurs par défaut du nouveau contexte
    S.prj.traffic.site = c === 'urbain' ? 'urbain' : 'rase';
    resetBranchDefaults();
  }
  syncCtxUI(); renderBranchForm(); update();
}

// Valeurs par défaut des branches pour le type et le contexte courants (axes et noms conservés).
function resetBranchDefaults() {
  S.prj.branches.forEach((b) => {
    const t = newBranch(S.prj, b.axis);
    Object.assign(b, { wLane: t.wLane, le: t.le, ls: t.ls, Re: t.Re, Rs: t.Rs, camber: t.camber });
    b.island.shift = ''; b.island.gap = ''; b.island.base = ''; b.island.length = '';
  });
}

function setKind(k) {
  if (k === (S.prj.kind || 'giratoire')) return;
  const changesFamily = isPlan({ kind: k }) !== isPlan(S.prj);
  S.prj.kind = k;
  if (changesFamily && S.prj.branches.length && confirm(t('Appliquer aux branches les valeurs par défaut de ce type de carrefour ?'))) resetBranchDefaults();
  S.formRole = undefined;
  syncCtxUI(); update();
  zoomGira();
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
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=${getLang() === 'ar' ? 'ar,fr' : 'fr'}&q=${encodeURIComponent(q)}`);
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
    renderDxfLayers(); refreshTerrain();
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
  for (const pr of [...(S.tn && S.prj.opts.vis.MNT !== false ? S.tn.prims : []), ...(S.Do || []).flatMap((o) => o.D.prims || []), ...D.prims]) {
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
    } else if (pr.k === 'sign') {
      // Symbole du panneau (contour de la forme à sa largeur réelle, « haut » vers l'extérieur de la route) et code.
      const up = pr.out, rt = G.rot90(G.neg(up)), c = G.add(pr.p, G.mul(up, pr.w / 2 + 0.3));
      const pts = signOutline(pr.code).map(([x, y]) => G.add(G.add(c, G.mul(rt, x * pr.w)), G.mul(up, y * pr.w)));
      w.path(L, pts.map((q, i) => G.L(q, pts[(i + 1) % pts.length])), true);
      w.text(L, G.add(c, G.mul(up, pr.w * 0.75 + 0.2)), pr.h, G.ang(rt) > Math.PI / 2 || G.ang(rt) < -Math.PI / 2 ? G.ang(rt) + Math.PI : G.ang(rt), pr.code, 'center');
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
    isPlan(S.prj)
      ? `Carrefour en ${S.prj.kind} ${S.prj.context === 'interurbain' ? 'interurbain (SETRA ACI)' : 'urbain (CERTU)'} — chaussée principale ${fmt(2 * D.plan.half)} m${D.plan.widened ? `, tourne-à-gauche ${fmt(D.plan.tag.width)} m` : ''}, régime ${D.plan.regime === 'stop' ? 'STOP' : 'cédez-le-passage'}`
      : `Carrefour giratoire ${S.prj.context === 'interurbain' ? 'interurbain (SETRA ACI)' : 'urbain (CERTU)'} — Rg ${fmt(D.Rg)} m, la ${fmt(D.la)} m, Ri ${fmt(D.Ri)} m, ${D.branches.length} branches`,
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
window.GIRA = { S, update, get viewer() { return viewer; }, zoomGira, newBranch, finishAxis, setTool, buildDxfText, parseDXF, buildDxfGeometry, setTerrainPoints, tinZ, hitElement, openPop, closePop };
