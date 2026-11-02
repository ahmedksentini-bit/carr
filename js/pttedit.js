// pttedit.js — éditeur graphique d'un demi-profil type (repris de l'éditeur de construction de BVTrace) :
// barre d'outils (sélection, point libre, ΔX / ΔZ, ΔX / pente, pente → TN, condition D/R, lignes Projet et Arase,
// suppression), liste des points, vue de la construction avec un TN de contrôle, inspecteur du point choisi et
// couches de chaussée. Le profil est édité sur une copie : « Valider » la rend à l'appelant (onSave), « Annuler » la
// jette. Molette ou boutons ± : zoom ; glisser dans le vide (outil Sélection) : déplacement de la vue.
import { fmt } from './common.js';
import { METHODES, BRANCHES, methodeLib, newPoint, evaluate, halfSection, layersDepth, profileIssues } from './ptype.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 0) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(x) ? x : d; };
const f3 = (v) => (isFinite(v) ? String(Math.round(v * 1000) / 1000) : '');
const TOOLS = [
  ['sel', 'Sélection', 'Choisissez un point pour modifier sa règle ; glisser dans le vide déplace la vue.'],
  ['libre', 'Point libre', 'Cliquez pour créer un point de coordonnées absolues.'],
  ['dxdz', 'ΔX / ΔZ', 'Choisissez le point de référence, puis cliquez la position du nouveau point.'],
  ['dxpente', 'ΔX / pente', 'Choisissez le point de référence, puis cliquez la position : la pente est déduite du clic.'],
  ['tn', 'Pente → TN', 'Choisissez le départ, puis cliquez dans la direction du talus : pente jusqu\'au TN (branche du cas affiché).'],
  ['cond', 'Condition D/R', 'Choisissez le point de test (bord de plate-forme) puis cliquez : branches remblai et déblai créées.'],
  ['lproj', 'Ligne Projet', 'Cliquez un point pour l\'ajouter à la ligne Projet ou l\'en retirer.'],
  ['larase', 'Ligne Arase', 'Cliquez un point pour l\'ajouter à la ligne Arase ou l\'en retirer.'],
  ['del', 'Supprimer', 'Cliquez le point à supprimer (avec les points qui en dépendent).'],
];

let E = null; // état de l'éditeur ouvert

function dialog() {
  let d = document.getElementById('dlgPTT');
  if (d) return d;
  d = document.createElement('dialog');
  d.id = 'dlgPTT'; d.className = 'dlg-big ptt-dlg';
  d.innerHTML = `
    <div class="dlg-head">
      <span class="ttl">Profil type — construction du demi-profil</span>
      <label class="fld ptt-name"><span class="lb">Nom</span><input id="pttName" type="text"></label>
      <button id="pttUndo" title="Annuler la dernière modification">↶</button>
      <button id="pttCancel">Annuler</button>
      <button id="pttOk" class="primary">Valider</button>
    </div>
    <div class="ptt-tools" id="pttTools">
      ${TOOLS.map(([k, l]) => `<button data-tool="${k}">${l}</button>`).join('')}
      <span class="ptt-sep"></span>
      <label class="fld"><span class="lb">Cas affiché</span><select id="pttBr"><option value="R">Remblai</option><option value="D">Déblai</option></select></label>
      <label class="fld"><span class="lb">TN à l'axe</span><input id="pttTnZ" type="text" inputmode="decimal" value="-1"><span class="un">m</span></label>
      <label class="fld"><span class="lb">Pente TN</span><input id="pttTnP" type="text" inputmode="decimal" value="-2"><span class="un">%</span></label>
      <label class="fld"><span class="lb">Dévers chaussée</span><input id="pttDev" type="text" inputmode="decimal" value="-2.5"><span class="un">%</span></label>
      <button id="pttZin" title="Zoom avant">+</button><button id="pttZout" title="Zoom arrière">−</button><button id="pttFit">Cadrer</button>
    </div>
    <div class="ptt-body">
      <div class="ptt-list"><div class="ptt-h">Points de construction</div><ul id="pttPts"></ul>
        <div class="ptt-leg"><i class="c"></i> commun <i class="r"></i> remblai <i class="d"></i> déblai <i class="k"></i> condition</div></div>
      <div class="ptt-view" id="pttView"><svg id="pttSvg"></svg></div>
      <div class="ptt-insp" id="pttInsp"></div>
    </div>
    <div class="ptt-foot">
      <div class="ptt-layers"><div class="ptt-h">Couches de chaussée <span id="pttDepth" class="dim"></span></div>
        <table class="pts" id="pttLayers"></table>
        <div class="row"><button id="pttAddLayer">Ajouter une couche</button><button id="pttArase" title="Recrée la ligne Arase sous les points de zone CHAUSSEE / ACCOTEMENT à la profondeur totale des couches">Arase depuis les couches</button><button id="pttReset" hidden>Repartir du profil automatique</button></div></div>
      <p class="note" id="pttStatus"></p>
    </div>`;
  document.body.appendChild(d);
  d.querySelector('#pttCancel').addEventListener('click', () => d.close());
  d.querySelector('#pttOk').addEventListener('click', save);
  d.querySelector('#pttUndo').addEventListener('click', undo);
  d.querySelector('#pttTools').addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) setTool(b.dataset.tool); });
  for (const id of ['pttBr', 'pttTnZ', 'pttTnP', 'pttDev']) d.querySelector('#' + id).addEventListener('input', () => draw());
  d.querySelector('#pttZin').addEventListener('click', () => zoom(1.25));
  d.querySelector('#pttZout').addEventListener('click', () => zoom(1 / 1.25));
  d.querySelector('#pttFit').addEventListener('click', () => { fit(); draw(); });
  d.querySelector('#pttName').addEventListener('change', (e) => { E.P.name = e.target.value.trim() || E.P.name; });
  d.querySelector('#pttPts').addEventListener('click', (e) => { const li = e.target.closest('[data-id]'); if (li) select(li.dataset.id); });
  d.querySelector('#pttInsp').addEventListener('change', onInspector);
  d.querySelector('#pttLayers').addEventListener('change', onLayer);
  d.querySelector('#pttLayers').addEventListener('click', (e) => { const b = e.target.closest('[data-dellayer]'); if (b) { snap(); E.P.layers.splice(+b.dataset.dellayer, 1); renderLayers(); } });
  d.querySelector('#pttAddLayer').addEventListener('click', () => { snap(); E.P.layers.push({ nom: 'Couche', mat: '', e: 0.2, color: '#B0BEC5' }); renderLayers(); });
  d.querySelector('#pttArase').addEventListener('click', araseFromLayers);
  d.querySelector('#pttReset').addEventListener('click', () => { if (!E.reset) return; snap(); const a = E.reset(); E.P.cons = a.cons; E.P.layers = a.layers; E.sel = null; refresh(); fit(); draw(); status('Construction reprise du profil automatique de l\'axe (« Annuler » pour revenir).'); });
  const svg = d.querySelector('#pttSvg');
  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onUp);
  svg.addEventListener('wheel', (e) => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  d.addEventListener('close', () => { E = null; });
  window.addEventListener('resize', () => { if (E) draw(); });
  return d;
}

/** Ouvre l'éditeur sur une copie du profil. opts : { title, devers (% pour l'aperçu), reset() → profil, onSave(profil) }. */
export function openTypeEditor(profile, opts = {}) {
  const d = dialog();
  E = { P: JSON.parse(JSON.stringify(profile)), sel: null, tool: 'sel', hist: [], view: { s: 30, ox: 60, oy: 200 }, drag: null, onSave: opts.onSave, reset: opts.reset };
  delete E.P.auto;
  if (!E.P.layers) E.P.layers = [];
  d.querySelector('.ttl').textContent = opts.title || 'Profil type — construction du demi-profil';
  d.querySelector('#pttName').value = E.P.name || '';
  if (opts.devers != null) d.querySelector('#pttDev').value = String(opts.devers);
  d.querySelector('#pttReset').hidden = !opts.reset;
  E.sel = E.P.cons.points[0]?.id || null;
  status('');
  if (!d.open) d.showModal();
  setTool('sel');
  refresh();
  requestAnimationFrame(() => { fit(); draw(); });
}

// --------------------------------------------------------------------------------------------- état, annulation
const pt = (id) => E.P.cons.points.find((q) => q.id === id) || null;
const status = (m) => { const s = document.getElementById('pttStatus'); if (s) s.textContent = m; };
function snap() { E.hist.push(JSON.stringify(E.P)); if (E.hist.length > 80) E.hist.shift(); }
function undo() { if (!E?.hist.length) return; E.P = JSON.parse(E.hist.pop()); if (!pt(E.sel)) E.sel = E.P.cons.points[0]?.id || null; refresh(); draw(); }
function setTool(t) {
  E.tool = t;
  document.querySelectorAll('#pttTools [data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  status(TOOLS.find((q) => q[0] === t)?.[2] || '');
}
function select(id) { E.sel = id; refresh(); draw(); }
function refresh() { renderList(); renderInsp(); renderLayers(); }

// --------------------------------------------------------------------------------------------- évaluation de l'aperçu
const prev = () => {
  const d = document.getElementById('dlgPTT');
  const tz = num(d.querySelector('#pttTnZ').value, -1), tp = num(d.querySelector('#pttTnP').value, -2);
  return { br: d.querySelector('#pttBr').value, tn: (x) => tz + (x * tp) / 100, dev: num(d.querySelector('#pttDev').value, -2.5) / 100 };
};
const evalPrev = () => { const p = prev(); return evaluate(E.P.cons, p.br, p.tn, { devers: p.dev, xmax: 120 }); };

// --------------------------------------------------------------------------------------------- liste et inspecteur
const brClass = (q) => (q.m === 'cond' ? 'k' : q.br === 'R' ? 'r' : q.br === 'D' ? 'd' : 'c');
function renderList() {
  const c = E.P.cons;
  document.getElementById('pttPts').innerHTML = c.points.map((q) => `<li data-id="${q.id}" class="${q.id === E.sel ? 'on' : ''}"><i class="${brClass(q)}"></i>${esc(q.code || '—')}<span class="dim"> · ${methodeLib(q.m)}${c.project.includes(q.id) ? ' · P' : ''}${(c.arase || []).includes(q.id) ? ' · A' : ''}</span></li>`).join('');
}
function renderInsp() {
  const q = pt(E.sel), box = document.getElementById('pttInsp'), c = E.P.cons;
  if (!q) { box.innerHTML = '<p class="note">Aucun point choisi.</p>'; return; }
  const rel = !['origine', 'libre'].includes(q.m);
  const fld = (k, l, v, un = '') => `<label class="fld"><span class="lb">${l}${un ? ` (${un})` : ''}</span><input data-f="${k}" type="text" inputmode="decimal" value="${esc(f3(v))}"></label>`;
  const opts = (list, v) => list.map(([k, l]) => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(l)}</option>`).join('');
  box.innerHTML = `<div class="ptt-h">Propriétés du point</div>
    <label class="fld"><span class="lb">Code</span><input data-f="code" type="text" value="${esc(q.code)}"></label>
    <label class="fld"><span class="lb">Méthode</span><select data-f="m">${opts(METHODES, q.m)}</select></label>
    ${rel ? `<label class="fld"><span class="lb">Point de référence</span><select data-f="parent"><option value="">—</option>${opts(c.points.filter((r) => r.id !== q.id).map((r) => [r.id, `${r.code} (${methodeLib(r.m)})`]), q.parent)}</select></label>` : ''}
    <label class="fld"><span class="lb">Branche</span><select data-f="br">${opts(BRANCHES, q.br)}</select></label>
    ${!rel ? fld('x', 'X absolu (vers l\'extérieur)', q.x, 'm') + fld('z', 'Z absolu (par rapport à l\'axe)', q.z, 'm') : ''}
    ${q.m === 'dxdz' ? fld('dx', 'ΔX', q.dx, 'm') + fld('dz', 'ΔZ', q.dz, 'm') : ''}
    ${q.m === 'dxpente' ? fld('dx', 'ΔX', q.dx, 'm') + `<label class="fld"><span class="lb">Pente</span><select data-f="src">${opts([['fixe', 'fixe'], ['devers', 'dévers de la chaussée']], q.src || 'fixe')}</select></label>` + fld('p', q.src === 'devers' ? 'Pente ajoutée au dévers' : 'Pente (+ montante vers l\'extérieur)', q.p, '%') : ''}
    ${q.m === 'tn' ? fld('p', 'Pente du talus (− remblai, + déblai)', q.p, '%') + `<p class="note">Talus ${Math.abs(q.p) > 1e-9 ? `${fmt(100 / Math.abs(q.p), 2)}/1 (H/V)` : 'horizontal'}.</p>` : ''}
    <label class="fld"><span class="lb">Zone</span><input data-f="zone" type="text" value="${esc(q.zone)}" placeholder="CHAUSSEE, ACCOTEMENT, BERME, TALUS…"></label>
    <label class="chk"><input type="checkbox" data-f="lp"${c.project.includes(q.id) ? ' checked' : ''}> Ligne Projet</label>
    <label class="chk"><input type="checkbox" data-f="la"${(c.arase || []).includes(q.id) ? ' checked' : ''}> Ligne Arase</label>
    <label class="chk"><input type="checkbox" data-f="test"${c.test === q.id ? ' checked' : ''}> Point de test déblai / remblai</label>
    <p class="note">Une croix rouge signale un point impossible à construire avec le TN de contrôle.</p>`;
}
function cycle(id, parent) {
  const seen = new Set([id]);
  while (parent) { if (seen.has(parent)) return true; seen.add(parent); parent = pt(parent)?.parent; }
  return false;
}
function onInspector(e) {
  const el = e.target.closest('[data-f]'), q = pt(E.sel);
  if (!el || !q) return;
  const k = el.dataset.f, c = E.P.cons;
  snap();
  if (k === 'code' || k === 'zone') q[k] = el.value.trim();
  else if (k === 'm') {
    const was = q.m; q.m = el.value;
    if (['origine', 'libre'].includes(q.m)) q.parent = null;
    else if (!q.parent) { const cand = c.points.find((r) => r.id !== q.id && !cycle(q.id, r.id)); q.parent = cand?.id || null; }
    if (q.m === 'tn' && was !== 'tn' && !q.p) q.p = q.br === 'D' ? 100 : -66.667;
  } else if (k === 'parent') {
    if (el.value && cycle(q.id, el.value)) { status('Cette référence créerait un cycle de construction.'); E.hist.pop(); renderInsp(); return; }
    q.parent = el.value || null;
  } else if (k === 'br' || k === 'src') q[k] = el.value;
  else if (['x', 'z', 'dx', 'dz', 'p'].includes(k)) {
    const v = num(el.value, NaN);
    if (!isFinite(v)) { status('Valeur numérique attendue.'); E.hist.pop(); renderInsp(); return; }
    q[k] = v;
  } else if (k === 'lp' || k === 'la') { setMember(k === 'lp' ? 'project' : 'arase', q.id, el.checked); }
  else if (k === 'test') c.test = el.checked ? q.id : null;
  status('');
  refresh(); draw();
}
// Appartenance à une ligne : insertion à sa place selon X (cas affiché), retrait sinon.
function setMember(line, id, on) {
  const c = E.P.cons, L = (c[line] = (c[line] || []).filter((x) => x !== id));
  if (!on) return;
  const ev = evalPrev(), x = ev.get(id)?.ok ? ev.get(id).x : Infinity;
  let i = L.findIndex((o) => { const r = ev.get(o); return r?.ok && r.x > x + 1e-9; });
  if (i < 0) i = L.length;
  L.splice(i, 0, id);
}

// --------------------------------------------------------------------------------------------- couches
function renderLayers() {
  const L = E.P.layers;
  document.getElementById('pttLayers').innerHTML = '<thead><tr><th>Couche</th><th>Matériau</th><th>Épaisseur (m)</th><th></th></tr></thead><tbody>'
    + L.map((l, i) => `<tr><td><input data-l="${i}" data-k="nom" value="${esc(l.nom)}"></td><td><input data-l="${i}" data-k="mat" value="${esc(l.mat)}"></td><td><input data-l="${i}" data-k="e" inputmode="decimal" value="${esc(f3(l.e))}"></td><td><button data-dellayer="${i}" title="Supprimer la couche">✕</button></td></tr>`).join('')
    + (L.length ? '' : '<tr><td colspan="4" class="note">Aucune couche.</td></tr>') + '</tbody>';
  document.getElementById('pttDepth').textContent = L.length ? `— épaisseur totale ${fmt(layersDepth(L), 2)} m` : '';
}
function onLayer(e) {
  const el = e.target.closest('[data-l]'); if (!el) return;
  snap();
  const l = E.P.layers[+el.dataset.l];
  l[el.dataset.k] = el.dataset.k === 'e' ? Math.max(0, num(el.value, l.e)) : el.value;
  renderLayers();
}
// Ligne Arase recréée sous les points communs de la ligne Projet de zone CHAUSSEE ou ACCOTEMENT (et sous le début de
// la première de ces bandes), à la profondeur totale des couches ; sans zone, sous tous les points de plate-forme.
function araseFromLayers() {
  const c = E.P.cons, depth = layersDepth(E.P.layers);
  if (!(depth > 0)) { status('Donnez des couches d\'épaisseur non nulle.'); return; }
  snap();
  const kids = new Set(c.points.map((q) => q.parent).filter(Boolean));
  const old = new Set((c.arase || []).filter((id) => { const q = pt(id); return q && q.m === 'dxdz' && !kids.has(id) && !c.project.includes(id); }));
  c.points = c.points.filter((q) => !old.has(q.id));
  const plat = c.project.map(pt).filter((q) => q && q.br === 'C' && q.m !== 'tn' && q.m !== 'cond');
  const zoned = (q) => /^(CHAUSSEE|ACCOTEMENT)$/i.test(q?.zone || '');
  const idx = new Set();
  if (plat.some(zoned)) plat.forEach((q, i) => { if (i && zoned(q)) { idx.add(i - 1); idx.add(i); } });
  else plat.forEach((q, i) => idx.add(i));
  c.arase = [...idx].sort((a, b) => a - b).map((i) => { const r = newPoint({ parent: plat[i].id, m: 'dxdz', dx: 0, dz: -depth, code: `Arase ${plat[i].code}`, zone: 'ARASE' }); c.points.push(r); return r.id; });
  refresh(); draw();
  status(`Ligne Arase recréée sous ${c.arase.length} point(s), à ${fmt(depth, 2)} m.`);
}

// --------------------------------------------------------------------------------------------- vue
const svgEl = () => document.getElementById('pttSvg');
const W = (x) => E.view.ox + x * E.view.s, Hy = (z) => E.view.oy - z * E.view.s;
const toWorld = (px, py) => ({ x: (px - E.view.ox) / E.view.s, z: (E.view.oy - py) / E.view.s });
function zoom(k, px, py) {
  const r = svgEl().getBoundingClientRect();
  px = px ?? r.width / 2; py = py ?? r.height / 2;
  const w = toWorld(px, py);
  E.view.s = Math.max(2, Math.min(400, E.view.s * k));
  E.view.ox = px - w.x * E.view.s; E.view.oy = py + w.z * E.view.s;
  draw();
}
function fit() {
  const r = svgEl().getBoundingClientRect(), all = [];
  for (const br of ['R', 'D']) for (const v of evaluate(E.P.cons, br, prev().tn, { devers: prev().dev, xmax: 120 }).values()) if (v.ok) all.push(v);
  let x0 = Math.min(-2, ...all.map((v) => v.x)) - 1, x1 = Math.max(8, ...all.map((v) => v.x)) + 2;
  let z0 = Math.min(-2, ...all.map((v) => v.z)) - 1, z1 = Math.max(1, ...all.map((v) => v.z)) + 1;
  const w = Math.max(200, r.width), h = Math.max(160, r.height);
  E.view.s = Math.max(2, Math.min(120, Math.min((w - 40) / (x1 - x0), (h - 40) / (z1 - z0))));
  E.view.ox = w / 2 - ((x0 + x1) / 2) * E.view.s; E.view.oy = h / 2 + ((z0 + z1) / 2) * E.view.s; // centré
}
function niceStep() { const raw = 55 / E.view.s, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }

function draw() {
  if (!E) return;
  const svg = svgEl(), r = svg.getBoundingClientRect(), w = Math.max(100, r.width), h = Math.max(100, r.height);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const pv = prev(), ev = evalPrev(), c = E.P.cons;
  const a = toWorld(0, h), b = toWorld(w, 0), st = niceStep();
  let o = '';
  for (let x = Math.floor(a.x / st) * st; x <= b.x; x += st) o += `<line class="g" x1="${W(x)}" y1="0" x2="${W(x)}" y2="${h}"/><text class="tk" x="${W(x) + 2}" y="${h - 4}">${fmt(x, st < 1 ? 1 : 0)}</text>`;
  for (let z = Math.floor(a.z / st) * st; z <= b.z; z += st) o += `<line class="g" x1="0" y1="${Hy(z)}" x2="${w}" y2="${Hy(z)}"/><text class="tk" x="3" y="${Hy(z) - 2}">${fmt(z, st < 1 ? 1 : 0)}</text>`;
  o += `<line class="ax0" x1="0" y1="${Hy(0)}" x2="${w}" y2="${Hy(0)}"/><line class="axe" x1="${W(0)}" y1="0" x2="${W(0)}" y2="${h}"/>`;
  // TN de contrôle
  o += `<line class="tn" x1="${W(a.x)}" y1="${Hy(pv.tn(a.x))}" x2="${W(b.x)}" y2="${Hy(pv.tn(b.x))}"/><text class="tnl" x="8" y="${Hy(pv.tn(a.x + 8 / E.view.s)) + 14}">TN de contrôle</text>`;
  // liens de construction
  for (const v of ev.values()) if (v.ok && v.q.parent) { const p = ev.get(v.q.parent); if (p?.ok) o += `<line class="lk" x1="${W(p.x)}" y1="${Hy(p.z)}" x2="${W(v.x)}" y2="${Hy(v.z)}"/>`; }
  const path = (ids, cls) => { const L = ids.map((id) => ev.get(id)).filter((v) => v?.ok); return L.length > 1 ? `<path class="${cls}" d="${L.map((v, i) => `${i ? 'L' : 'M'}${W(v.x).toFixed(1)},${Hy(v.z).toFixed(1)}`).join('')}"/>` : ''; };
  o += path(c.arase || [], 'la') + path(c.project, 'lp');
  for (const q of c.points) {
    const v = ev.get(q.id);
    if (v.hors) continue;
    if (!v.ok) { const p = ev.get(q.parent); if (p?.ok) o += `<g class="ko"><path d="M${W(p.x) + 6},${Hy(p.z) - 6}l12,12m0,-12l-12,12"/><text x="${W(p.x) + 20}" y="${Hy(p.z) - 8}">${esc(q.code)} impossible</text></g>`; continue; }
    const sel = q.id === E.sel, X = W(v.x), Y = Hy(v.z);
    o += q.m === 'cond' ? `<path class="pt k${sel ? ' on' : ''}" d="M${X},${Y - 7}l7,7l-7,7l-7,-7z"/>` : `<circle class="pt ${brClass(q)}${sel ? ' on' : ''}" cx="${X}" cy="${Y}" r="${sel ? 6.5 : 5}"/>`;
    // étiquettes : points de la ligne Projet (hors condition) et point choisi ; arase et constructions au survol du choix
    if (sel || (c.project.includes(q.id) && q.m !== 'cond')) o += `<text class="pl${sel ? ' on' : ''}" x="${X + 6}" y="${Y - 8}">${esc(q.code)}</text>`;
    if (c.test === q.id) o += `<text class="tst" x="${X + 6}" y="${Y + 14}">TEST D/R</text>`;
  }
  // cas retenu par la condition avec ce TN
  if (c.points.some((q) => q.m === 'cond')) { const hs = halfSection(E.P, pv.tn, { devers: pv.dev, xmax: 120 }); o += `<text class="cas" x="${w - 8}" y="16" text-anchor="end">Avec ce TN, la condition donne : ${hs.br === 'D' ? 'déblai' : hs.br === 'R' ? 'remblai' : '—'}${hs.br && hs.br !== pv.br ? ' (autre cas que celui affiché)' : ''}</text>`; }
  svg.innerHTML = o;
}

// --------------------------------------------------------------------------------------------- souris / doigt
function hit(px, py) {
  let best = null, d = 14;
  for (const v of evalPrev().values()) { if (!v.ok) continue; const dd = Math.hypot(W(v.x) - px, Hy(v.z) - py); if (dd < d) { d = dd; best = v.q.id; } }
  return best;
}
function onDown(e) {
  const r = svgEl().getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, h = hit(px, py), wpt = toWorld(px, py), c = E.P.cons;
  if (E.tool === 'sel' || e.button === 1) {
    if (h && e.button !== 1) { select(h); return; }
    E.drag = { x: e.clientX, y: e.clientY, ox: E.view.ox, oy: E.view.oy };
    svgEl().setPointerCapture(e.pointerId); return;
  }
  if (E.tool === 'lproj' || E.tool === 'larase') {
    if (!h) return;
    snap(); const line = E.tool === 'lproj' ? 'project' : 'arase';
    setMember(line, h, !(c[line] || []).includes(h)); E.sel = h; refresh(); draw(); return;
  }
  if (E.tool === 'del') { if (h) del(h); return; }
  if (E.tool === 'libre') { snap(); const q = newPoint({ m: 'libre', x: round(wpt.x), z: round(wpt.z), code: 'Point libre' }); c.points.push(q); E.sel = q.id; refresh(); draw(); return; }
  const par = pt(E.sel), ev = evalPrev(), pe = par && ev.get(par.id);
  if (!par) { status('Choisissez d\'abord le point de référence.'); return; }
  if (!pe?.ok) { status('Le point de référence n\'est pas calculable dans le cas affiché.'); return; }
  snap();
  if (E.tool === 'cond') {
    const k = newPoint({ parent: par.id, m: 'cond', code: 'Condition D/R' });
    const fr = newPoint({ parent: k.id, m: 'tn', br: 'R', p: -66.667, code: 'EET remblai', zone: 'TALUS' });
    const cu = newPoint({ parent: k.id, m: 'tn', br: 'D', p: 100, code: 'EET déblai', zone: 'TALUS' });
    c.points.push(k, fr, cu); c.test = par.id;
    setMember('project', fr.id, true); setMember('project', cu.id, true);
    E.sel = k.id; refresh(); draw(); return;
  }
  const dx = round(wpt.x - pe.x), dz = round(wpt.z - pe.z), br = prev().br;
  let q;
  if (E.tool === 'dxdz') q = newPoint({ parent: par.id, m: 'dxdz', br: par.br, dx, dz, code: 'Point projet' });
  else if (E.tool === 'dxpente') q = newPoint({ parent: par.id, m: 'dxpente', br: par.br, dx, p: Math.abs(dx) < 1e-6 ? 0 : Math.round((dz / dx) * 1000) / 10, code: 'Point projet' });
  else if (E.tool === 'tn') q = newPoint({ parent: par.id, m: 'tn', br, p: Math.abs(dx) < 1e-6 || Math.sign(dz) !== (br === 'D' ? 1 : -1) ? (br === 'D' ? 100 : -66.667) : Math.round((dz / dx) * 1000) / 10, code: br === 'D' ? 'EET déblai' : 'EET remblai', zone: 'TALUS' });
  else { E.hist.pop(); return; }
  c.points.push(q); setMember('project', q.id, true);
  E.sel = q.id; refresh(); draw();
}
const round = (v) => Math.round(v * 100) / 100;
function onMove(e) { if (!E?.drag) return; E.view.ox = E.drag.ox + e.clientX - E.drag.x; E.view.oy = E.drag.oy + e.clientY - E.drag.y; draw(); }
function onUp() { if (E) E.drag = null; }
function del(id) {
  const c = E.P.cons, doomed = new Set([id]);
  let ch = true;
  while (ch) { ch = false; for (const q of c.points) if (q.parent && doomed.has(q.parent) && !doomed.has(q.id)) { doomed.add(q.id); ch = true; } }
  snap();
  c.points = c.points.filter((q) => !doomed.has(q.id));
  c.project = c.project.filter((x) => !doomed.has(x)); c.arase = (c.arase || []).filter((x) => !doomed.has(x));
  if (doomed.has(c.test)) c.test = null;
  if (doomed.has(E.sel)) E.sel = c.points[0]?.id || null;
  refresh(); draw();
  status(doomed.size > 1 ? `${doomed.size} points supprimés (le point et ceux qui en dépendent) ; ↶ pour revenir.` : 'Point supprimé ; ↶ pour revenir.');
}

function save() {
  const iss = profileIssues(E.P);
  if (iss.length) { status('À corriger : ' + iss.join(' ; ') + '.'); return; }
  const P = E.P, cb = E.onSave;
  document.getElementById('dlgPTT').close();
  cb?.(P);
}
