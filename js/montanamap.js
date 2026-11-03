// montanamap.js — carte des stations Montana (portage des cartes de BVTrace : Assets/montana_map.html, table 18 DRE
// Tunisie, et Assets/montana_afrique_map.html, référentiel CIEH Afrique de l'Ouest et centrale).
//
// Invariant (BVTrace, hydrologie-tunisie.md) : on rattache la STATION, pas un triplet a/b/c. Le sélecteur T de la
// carte n'est qu'un APERÇU : a, b, c sont résolus bassin par bassin d'après la période de retour de chacun.
// En FAO 54 on rattache la station CIEH et sa plage de durées ; seul T = 10 ans est publié (2 et 5 interpolés,
// 20 extrapolé : le statut voyage avec la valeur).
//
// Leaflet est chargé à la première ouverture (CDN), comme proj4.

const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
let leafletP = null;
function loadLeaflet() {
  if (window.L?.map) return Promise.resolve(window.L);
  if (leafletP) return leafletP;
  leafletP = new Promise((ok, ko) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = LEAFLET_CSS; document.head.appendChild(css);
    const js = document.createElement('script'); js.src = LEAFLET_JS; js.setAttribute('data-cfasync', 'false');
    js.onload = () => ok(window.L); js.onerror = () => { leafletP = null; ko(new Error('Leaflet n\'a pas pu être chargé (connexion Internet ?)')); };
    document.head.appendChild(js);
  });
  return leafletP;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fr = (v, d) => (v == null || !Number.isFinite(+v) ? '—' : (+v).toFixed(d).replace('.', ','));
const distKm = (a, b) => Math.hypot((a.lat - b.lat) * 111.2, (a.lon - b.lon) * 111.2 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180));

let map = null, layers = null, ctx = null;

/**
 * Ouvre la carte des stations.
 * @param {object} o
 *   mode : 'tunisie' | 'afrique' ; stations : listMontanaStations()[mode] ;
 *   resolve(st, T) → {a,b,c,tUsed,tabulated}|null (Tunisie) ; current : code (Tunisie) ou { station, range } (Afrique) ;
 *   T : période d'aperçu ; project : { lines: [[{lat,lon}]], basins: [{ id, rings: [[{lat,lon}]], color }] } ;
 *   onApply(sel) : Tunisie { code, name } · Afrique { station: key, range: index }.
 */
export async function openMontanaMap(o) {
  ctx = o;
  const dlg = document.getElementById('dlgMontana');
  const af = o.mode === 'afrique';
  document.getElementById('mtTitle').textContent = af ? 'Stations Montana — Afrique de l\'Ouest et centrale (CIEH)' : 'Stations Montana — table 18 DRE (Tunisie)';
  document.getElementById('mtHint').innerHTML = af
    ? 'i = A<sub>T</sub> · t<sup>−b</sup> (mm/min, t en min) ; GIRA applique i = a·t<sup>b</sup> en mm/h avec a = 60·A<sub>T</sub>. Seul <b>T = 10 ans</b> est publié par le CIEH (2 et 5 ans interpolés, 20 ans extrapolé). Rattachez la station et la plage de durées couvrant le tc des bassins.'
    : 'I = a<sub>T</sub> / (t<sub>h</sub> + c)<sup>b</sup> (mm/h). C\'est la <b>station</b> qui est rattachée : a, b et c sont résolus bassin par bassin d\'après la période de retour. Le sélecteur T ne sert qu\'à l\'aperçu.';
  const selT = document.getElementById('mtT');
  selT.innerHTML = (af ? [2, 5, 10, 20] : [2, 5, 10, 20, 50, 100]).map((t) => `<option${t === (af ? 10 : o.T) ? ' selected' : ''}>${t}</option>`).join('');
  if (!af && ![2, 5, 10, 20, 50, 100].includes(o.T)) selT.insertAdjacentHTML('beforeend', `<option selected>${o.T}</option>`);
  document.getElementById('mtFilter').value = '';
  if (!dlg.open) dlg.showModal();
  const list = document.getElementById('mtList');
  list.innerHTML = '<p class="note" style="padding:10px">Chargement de la carte…</p>';
  let L;
  try { L = await loadLeaflet(); } catch (e) { list.innerHTML = `<p class="err" style="padding:10px">${esc(e.message)}</p>`; return; }
  if (!map) {
    map = L.map('mtMap', { zoomControl: true, attributionControl: true }).setView([34.5, 9.5], 7);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri', maxZoom: 18 }).addTo(map);
    layers = { project: L.layerGroup().addTo(map), stations: L.layerGroup().addTo(map) };
    selT.addEventListener('change', () => { renderList(); paint(false); });
    document.getElementById('mtFilter').addEventListener('input', renderList);
  }
  setTimeout(() => { map.invalidateSize(); paint(true); renderList(); }, 60);
}

// ── modèle commun : une entrée par station (Afrique : plusieurs points possibles) ──
function entries() {
  const o = ctx, af = o.mode === 'afrique', ref = refPoint();
  return o.stations.map((st) => {
    const pts = af ? st.points.filter((p) => p.lat != null && p.lon != null).map((p) => ({ lat: p.lat, lon: p.lon, town: p.town })) : (st.lat != null ? [{ lat: st.lat, lon: st.lon }] : []);
    const d = ref && pts.length ? Math.min(...pts.map((p) => distKm(p, ref))) : null;
    return { st, id: af ? st.key : st.code, name: af ? `${st.name} (${st.country})` : st.name, pts, d, atyp: !af && st.atypical };
  });
}
function refPoint() {
  const p = ctx.project; const all = [...(p?.lines || []).flat(), ...(p?.basins || []).flatMap((b) => b.rings.flat())];
  if (!all.length) return null;
  return { lat: all.reduce((s, q) => s + q.lat, 0) / all.length, lon: all.reduce((s, q) => s + q.lon, 0) / all.length };
}
const isCurrent = (e) => (ctx.mode === 'afrique' ? ctx.current?.station === e.id : ctx.current === e.id);
const curT = () => +document.getElementById('mtT').value || 10;

function popupHtml(e) {
  const o = ctx, T = curT();
  const head = `<b>${esc(e.name)}</b><div class="mt-sub">${o.mode === 'afrique' ? esc(e.st.isZone ? 'zone' : 'station') + (e.st.towns ? ` — ${esc(e.st.towns)}` : '') : `code ${esc(e.st.code)}`}${e.d != null ? ` · ${fr(e.d, 0)} km du projet` : ''}</div>`;
  if (o.mode !== 'afrique') {
    const st = e.st, Ts = Object.keys(st.aByT || {}).map(Number).sort((a, b) => a - b);
    const r = o.resolve(st, T);
    const rows = Ts.map((t) => { const q = o.resolve(st, t); return `<tr${t === T ? ' class="on"' : ''}><td>${t} ans</td><td>${fr(q?.a, 1)}</td><td>${fr(q?.b, 3)}</td><td>${fr(q?.c, 3)}</td></tr>`; }).join('');
    return head + `<table class="mt-tab"><thead><tr><th>T</th><th>a<sub>T</sub></th><th>b</th><th>c</th></tr></thead><tbody>${rows}</tbody></table>`
      + (r && !r.tabulated ? `<div class="mt-warn">T = ${T} ans non tabulé : valeurs de T = ${r.tUsed} ans.</div>` : '')
      + (st.notes ? `<div class="mt-sub">${esc(st.notes)}</div>` : '') + (e.atyp ? '<div class="mt-warn">Station atypique — a, b, c non appliqués.</div>' : '')
      + `<button data-mtapply="${esc(e.id)}"${e.atyp ? ' disabled' : ''}>${isCurrent(e) ? 'Station rattachée ✓' : 'Rattacher cette station'}</button>`;
  }
  const rows = e.st.ranges.map((pl, i) => {
    const v = pl.byT.find((x) => x.T === T);
    return `<tr${ctx.current?.station === e.id && (ctx.current.range ?? 0) === i ? ' class="on"' : ''}><td>${esc(pl.label)}</td><td>${fr(pl.bPublished, 3)}</td><td>${fr(v?.A_T, 3)}</td><td>${fr(v ? 60 * v.A_T : null, 1)}</td><td><button class="mini" data-mtapply="${esc(e.id)}" data-mtrange="${i}">Rattacher</button></td></tr>`
      + (v && !v.published ? `<tr><td colspan="5" class="mt-warn">${esc(v.status)}</td></tr>` : '');
  }).join('');
  return head + `<table class="mt-tab"><thead><tr><th>Plage</th><th>b</th><th>A<sub>${T}</sub> mm/min</th><th>a mm/h</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
    + (e.st.points.length > 1 ? `<div class="mt-sub">Points : ${esc(e.st.points.map((p) => p.town).join(', '))}</div>` : '');
}

function paint(fit) {
  const L = window.L, o = ctx;
  layers.project.clearLayers(); layers.stations.clearLayers();
  const b = L.latLngBounds([]);
  for (const bs of o.project?.basins || []) for (const r of bs.rings) {
    const ll = r.map((q) => [q.lat, q.lon]); ll.forEach((q) => b.extend(q));
    L.polygon(ll, { color: '#0369a1', weight: 1, fillColor: bs.color || '#38bdf8', fillOpacity: 0.35 }).bindTooltip(bs.id).addTo(layers.project);
  }
  for (const ln of o.project?.lines || []) {
    const ll = ln.map((q) => [q.lat, q.lon]); ll.forEach((q) => b.extend(q));
    L.polyline(ll, { color: '#ff3b30', weight: 4, opacity: 0.95 }).bindTooltip('Projet').addTo(layers.project);
  }
  const E = entries(), near = E.filter((e) => e.pts.length).sort((a, c) => (a.d ?? 1e9) - (c.d ?? 1e9));
  for (const e of E) for (const p of e.pts) {
    const cur = isCurrent(e);
    const m = L.circleMarker([p.lat, p.lon], { radius: cur ? 9 : 7, color: cur ? '#fff' : '#0b3d6e', weight: cur ? 3 : 1.5, fillColor: e.atyp ? '#b26a00' : cur ? '#16a34a' : '#2c7fb8', fillOpacity: 0.95 });
    m.bindTooltip(e.st.isZone ? `${e.name} — ${p.town}` : e.name, { permanent: true, direction: 'right', offset: [9, 0], className: 'mt-label' });
    m.bindPopup(() => popupHtml(e), { maxWidth: 360 });
    m._id = e.id; m.addTo(layers.stations);
  }
  if (!fit) return;
  // cadrage : le projet et ses 4 stations les plus proches ; sans projet, toutes les stations
  if (b.isValid()) near.slice(0, 4).forEach((e) => e.pts.forEach((p) => b.extend([p.lat, p.lon])));
  else E.forEach((e) => e.pts.forEach((p) => b.extend([p.lat, p.lon])));
  if (b.isValid()) map.fitBounds(b, { padding: [40, 40], maxZoom: 11 });
}

function renderList() {
  const q = (document.getElementById('mtFilter').value || '').toLowerCase(), T = curT(), o = ctx;
  const E = entries().filter((e) => !q || e.name.toLowerCase().includes(q) || String(e.id).toLowerCase().includes(q))
    .sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9) || a.name.localeCompare(b.name, 'fr'));
  document.getElementById('mtList').innerHTML = E.map((e) => {
    let meta;
    if (o.mode !== 'afrique') { const r = o.resolve(e.st, T); meta = r ? `a ${fr(r.a, 0)} · b ${fr(r.b, 3)} · c ${fr(r.c, 3)}${r.tabulated ? '' : ` (T = ${r.tUsed} ans)`}` : 'atypique — non appliquée'; }
    else meta = e.st.ranges.map((pl) => `${pl.label} : b ${fr(pl.bPublished, 2)}`).join(' · ');
    return `<div class="mt-st${isCurrent(e) ? ' on' : ''}${e.pts.length ? '' : ' nopos'}${e.atyp ? ' atyp' : ''}" data-mtgo="${esc(e.id)}"><div class="nm">${esc(e.name)}${isCurrent(e) ? ' ✓' : ''}</div><div class="meta">${e.d != null ? `${fr(e.d, 0)} km · ` : ''}${esc(meta)}</div></div>`;
  }).join('') || '<p class="note" style="padding:10px">Aucune station.</p>';
}

/** Branchements une fois pour toutes (délégation). */
export function initMontanaMap() {
  const dlg = document.getElementById('dlgMontana');
  document.getElementById('mtClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (ev) => {
    const ap = ev.target.closest('[data-mtapply]');
    if (ap && !ap.disabled) {
      const e = entries().find((x) => x.id === ap.dataset.mtapply); if (!e) return;
      if (ctx.mode === 'afrique') ctx.current = { station: e.id, range: +(ap.dataset.mtrange || 0) };
      else ctx.current = e.id;
      ctx.onApply(ctx.mode === 'afrique' ? { ...ctx.current } : { code: e.id, name: e.name });
      map.closePopup(); paint(false); renderList();
      return;
    }
    const go = ev.target.closest('[data-mtgo]');
    if (go) layers.stations.eachLayer((m) => { if (m._id === go.dataset.mtgo) { map.setView(m.getLatLng(), Math.max(map.getZoom(), 9)); m.openPopup(); } });
  });
}
