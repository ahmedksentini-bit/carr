// kml.js — import de fichiers KMZ / KML (Google Earth) en calques de fond.
// Chaque fichier importé devient un calque de la liste « Calques KMZ / KML » (onglet Projet), avec ses dossiers KML
// comme sous-calques affichables séparément. La géométrie est gardée en WGS84 (lon, lat) : elle est projetée dans le
// système de coordonnées du projet à l'affichage, et suit donc un changement de système.
// Géométries lues : Point, LineString, LinearRing, Polygon (avec trous), MultiGeometry, gx:Track, gx:MultiTrack.
// Styles lus : Style / StyleMap partagés (styleUrl « #id ») et styles en ligne — LineStyle, PolyStyle, IconStyle.

// ------------------------------------------------------------------ Décompression KMZ (ZIP)
// Lecture du répertoire central du ZIP ; entrées « stockées » (0) ou « deflate » (8), décompressées par
// DecompressionStream('deflate-raw') du navigateur.
async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('décompression non prise en charge par ce navigateur : extrayez le doc.kml du KMZ');
  const ds = new DecompressionStream('deflate-raw');
  const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
  return new Uint8Array(await out.arrayBuffer());
}

export function zipEntries(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('archive KMZ illisible (fin de ZIP introuvable)');
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const list = [];
  for (let k = 0; k < n && p + 46 <= u8.length; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true);
    const el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
    list.push({ name, method, csize, off });
    p += 46 + nl + el + cl;
  }
  return list.map((e) => ({
    name: e.name,
    async bytes() {
      const ln = dv.getUint16(e.off + 26, true), le = dv.getUint16(e.off + 28, true), s = e.off + 30 + ln + le;
      const raw = u8.subarray(s, s + e.csize);
      if (e.method === 0) return raw;
      if (e.method === 8) return inflateRaw(raw);
      throw new Error(`méthode de compression ${e.method} non prise en charge`);
    },
  }));
}

function decodeText(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return new TextDecoder('windows-1252').decode(bytes); }
}

// Texte KML d'un fichier .kmz ou .kml (ArrayBuffer).
export async function kmlTextOf(buf, fileName = '') {
  const u8 = new Uint8Array(buf);
  const isZip = u8[0] === 0x50 && u8[1] === 0x4b;
  if (!isZip) return decodeText(u8);
  const ents = zipEntries(buf).filter((e) => /\.kml$/i.test(e.name) && !/^__MACOSX\//.test(e.name));
  if (!ents.length) throw new Error(`${fileName || 'KMZ'} : aucun fichier .kml dans l'archive`);
  const main = ents.find((e) => /(^|\/)doc\.kml$/i.test(e.name)) || ents.sort((a, b) => a.name.split('/').length - b.name.split('/').length)[0];
  return decodeText(await main.bytes());
}

// ------------------------------------------------------------------ Lecture KML
const kids = (n) => [...(n?.childNodes || [])].filter((c) => c.nodeType === 1);
const lname = (n) => n.localName || String(n.nodeName).replace(/^.*:/, '');
const child = (n, name) => kids(n).find((c) => lname(c) === name);
const childText = (n, name) => { const c = child(n, name); return c ? String(c.textContent || '').trim() : ''; };

// Couleur KML aabbggrr → { css: '#rrggbb', a: 0…1 }
export function kmlColor(s) {
  const m = String(s || '').trim().match(/^#?([0-9a-f]{8})$/i);
  if (!m) return null;
  const h = m[1];
  return { css: '#' + h.slice(6, 8) + h.slice(4, 6) + h.slice(2, 4), a: parseInt(h.slice(0, 2), 16) / 255 };
}

function readStyle(st) {
  const o = {};
  const ls = child(st, 'LineStyle'), ps = child(st, 'PolyStyle'), is = child(st, 'IconStyle');
  if (ls) { const c = kmlColor(childText(ls, 'color')); if (c) o.lc = c; const w = parseFloat(childText(ls, 'width')); if (w >= 0) o.lw = w; }
  if (ps) {
    const c = kmlColor(childText(ps, 'color')); if (c) o.pc = c;
    if (childText(ps, 'fill') === '0') o.nofill = true;
    if (childText(ps, 'outline') === '0') o.nooutline = true;
  }
  if (is) { const c = kmlColor(childText(is, 'color')); if (c) o.ic = c; }
  return o;
}

const R7 = (v) => Math.round(v * 1e7) / 1e7;
function coords(txt) {
  const out = [];
  for (const tok of String(txt || '').trim().split(/\s+/)) {
    if (!tok) continue;
    const [lo, la] = tok.split(',').map(Number);
    if (Number.isFinite(lo) && Number.isFinite(la)) out.push(R7(lo), R7(la));
  }
  return out;
}

function readGeometry(g, parts) {
  switch (lname(g)) {
    case 'Point': { const c = coords(childText(g, 'coordinates')); if (c.length >= 2) parts.push({ t: 'P', c: c.slice(0, 2) }); break; }
    case 'LineString': { const c = coords(childText(g, 'coordinates')); if (c.length >= 4) parts.push({ t: 'L', c }); break; }
    case 'LinearRing': { const c = coords(childText(g, 'coordinates')); if (c.length >= 6) parts.push({ t: 'A', r: [c] }); break; }
    case 'Polygon': {
      const ring = (b) => coords(childText(child(b, 'LinearRing'), 'coordinates'));
      const r = [];
      for (const b of kids(g)) if (lname(b) === 'outerBoundaryIs') r.unshift(ring(b)); else if (lname(b) === 'innerBoundaryIs') r.push(ring(b));
      if (r[0]?.length >= 6) parts.push({ t: 'A', r: r.filter((q) => q.length >= 6) });
      break;
    }
    case 'MultiGeometry': case 'MultiTrack': for (const c of kids(g)) readGeometry(c, parts); break;
    case 'Track': {
      const c = [];
      for (const q of kids(g)) if (lname(q) === 'coord') { const [lo, la] = String(q.textContent).trim().split(/\s+/).map(Number); if (Number.isFinite(lo) && Number.isFinite(la)) c.push(R7(lo), R7(la)); }
      if (c.length >= 4) parts.push({ t: 'L', c });
      break;
    }
    default: break;
  }
}

// Texte KML → { name, folders: [{ name, depth, parent, visible, n }], feats: [{ f, name, parts, s }] }.
// Le dossier 0 est la racine du fichier ; un dossier masqué dans le KML (<visibility>0) est importé décoché.
export function parseKML(text, Parser = globalThis.DOMParser) {
  if (!Parser) throw new Error('DOMParser indisponible');
  const doc = new Parser().parseFromString(text, 'text/xml');
  const root = doc.documentElement;
  if (!root || lname(root) === 'parsererror' || doc.getElementsByTagName('parsererror').length) throw new Error('KML mal formé (XML illisible)');
  const styles = new Map(), maps = new Map();
  const all = [...doc.getElementsByTagName('*')];
  for (const n of all) {
    const id = n.getAttribute?.('id');
    if (!id) continue;
    if (lname(n) === 'Style') styles.set(id, readStyle(n));
    else if (lname(n) === 'StyleMap') {
      for (const p of kids(n)) if (lname(p) === 'Pair' && childText(p, 'key') === 'normal') {
        const inl = child(p, 'Style');
        maps.set(id, inl ? { inline: readStyle(inl) } : { url: childText(p, 'styleUrl') });
      }
    }
  }
  const resolve = (url, depth = 0) => {
    const id = String(url || '').replace(/^.*#/, '');
    if (!id || depth > 4) return null;
    if (styles.has(id)) return styles.get(id);
    const m = maps.get(id);
    return m ? m.inline || resolve(m.url, depth + 1) : null;
  };
  const top = child(root, 'Document') || child(root, 'Folder') || root;
  const out = { name: childText(top, 'name'), folders: [{ name: '(racine)', depth: 0, parent: -1, visible: true, n: 0 }], feats: [] };
  const walk = (node, fi) => {
    for (const c of kids(node)) {
      const k = lname(c);
      if (k === 'Folder' || k === 'Document') {
        const fo = { name: childText(c, 'name') || 'Dossier', depth: out.folders[fi].depth + 1, parent: fi, visible: childText(c, 'visibility') !== '0', n: 0 };
        out.folders.push(fo); walk(c, out.folders.length - 1);
      } else if (k === 'Placemark') {
        const parts = [];
        for (const g of kids(c)) readGeometry(g, parts);
        if (!parts.length) continue;
        const inl = child(c, 'Style');
        const s = { ...(resolve(childText(c, 'styleUrl')) || {}), ...(inl ? readStyle(inl) : {}) };
        const f = { f: fi, name: childText(c, 'name'), parts };
        if (Object.keys(s).length) f.s = s;
        out.feats.push(f);
      }
    }
  };
  walk(top, 0);
  // Comptes par dossier (avec les sous-dossiers), puis élagage des dossiers vides.
  for (const f of out.feats) for (let i = f.f; i >= 0; i = out.folders[i].parent) out.folders[i].n++;
  const keep = out.folders.map((fo, i) => i === 0 || fo.n > 0), remap = [];
  const folders = [];
  out.folders.forEach((fo, i) => { if (keep[i]) { remap[i] = folders.length; folders.push({ ...fo, parent: fo.parent < 0 ? -1 : remap[fo.parent] }); } });
  for (const f of out.feats) f.f = remap[f.f];
  out.folders = folders;
  return out;
}

// ------------------------------------------------------------------ Calques
const PALETTE = ['#ff5ad1', '#ffd23f', '#3ee0ff', '#7cff6b', '#ff8c42', '#b48cff', '#ff4d4d', '#40ffb0'];
export function newKmlLayer(parsed, fileName, k = 0) {
  return {
    id: Math.random().toString(36).slice(2, 10), name: parsed.name || fileName.replace(/\.(kmz|kml)$/i, ''), file: fileName,
    visible: true, labels: true, opacity: 1, color: PALETTE[k % PALETTE.length], force: false,
    folders: parsed.folders, feats: parsed.feats,
  };
}

export function kmlStats(L) {
  let p = 0, l = 0, a = 0;
  for (const f of L.feats) for (const q of f.parts) if (q.t === 'P') p++; else if (q.t === 'L') l++; else a++;
  return { p, l, a };
}

export function kmlBBoxLL(L) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (c) => { for (let i = 0; i < c.length; i += 2) { x0 = Math.min(x0, c[i]); x1 = Math.max(x1, c[i]); y0 = Math.min(y0, c[i + 1]); y1 = Math.max(y1, c[i + 1]); } };
  for (const f of L.feats) for (const q of f.parts) if (q.t === 'A') q.r.forEach(add); else add(q.c);
  return Number.isFinite(x0) ? { lon0: x0, lat0: y0, lon1: x1, lat1: y1 } : null;
}

// Dossier affiché : lui-même et tous ses parents cochés.
export function folderShown(L, i) {
  for (; i >= 0; i = L.folders[i].parent) if (L.folders[i].visible === false) return false;
  return true;
}

// Projection dans le système du projet + chemins Path2D (groupés par dossier et style) + index d'accrochage (même
// structure que le cache DXF, pour snapDxf).
export function buildKmlCache(L, crs) {
  if (!crs?.geo) return null;
  const P = (lon, lat) => { const q = crs.fromLL(lon, lat); return [q.x, q.y]; };
  const xy = (c) => { const o = new Float64Array(c.length); for (let i = 0; i < c.length; i += 2) { const [x, y] = P(c[i], c[i + 1]); o[i] = x; o[i + 1] = y; } return o; };
  const feats = L.feats.map((f) => ({ ...f, xy: f.parts.map((q) => (q.t === 'A' ? { t: 'A', r: q.r.map(xy) } : { t: q.t, c: xy(q.c) })) }));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const ext = (c) => { for (let i = 0; i < c.length; i += 2) { if (c[i] < x0) x0 = c[i]; if (c[i] > x1) x1 = c[i]; if (c[i + 1] < y0) y0 = c[i + 1]; if (c[i + 1] > y1) y1 = c[i + 1]; } };
  for (const f of feats) for (const q of f.xy) if (q.t === 'A') q.r.forEach(ext); else ext(q.c);
  if (!Number.isFinite(x0)) return { bbox: null, groups: [], points: [], index: new Map(), cell: 5, feats };
  const bbox = { x0, y0, x1, y1 };
  const ox = Math.round((x0 + x1) / 2), oy = Math.round((y0 + y1) / 2);
  const groups = new Map(), points = [];
  const cell = 5, index = new Map();
  const put = (x, y) => { const k = Math.floor(x / cell) + ',' + Math.floor(y / cell); let c = index.get(k); if (!c) { c = []; index.set(k, c); } if (c.length < 64) c.push(x, y); };
  const grp = (f, kind) => {
    const s = f.s || {}, key = f.f + '|' + kind + '|' + JSON.stringify(s) + (f.hidden ? '|h' : '');
    let g = groups.get(key);
    if (!g) { g = { f: f.f, kind, s, hidden: !!f.hidden, path: new Path2D() }; groups.set(key, g); }
    return g;
  };
  const trace = (path, c, close) => { path.moveTo(c[0] - ox, c[1] - oy); for (let i = 2; i < c.length; i += 2) path.lineTo(c[i] - ox, c[i + 1] - oy); if (close) path.closePath(); };
  for (const f of feats) for (const q of f.xy) {
    if (q.t === 'P') { points.push({ f: f.f, x: q.c[0], y: q.c[1], name: f.name, s: f.s || {}, hidden: !!f.hidden }); put(q.c[0], q.c[1]); }
    else if (q.t === 'L') { trace(grp(f, 'L').path, q.c, false); for (let i = 0; i < q.c.length; i += 2) put(q.c[i], q.c[i + 1]); }
    else { const g = grp(f, 'A'); for (const r of q.r) { trace(g.path, r, true); for (let i = 0; i < r.length; i += 2) put(r[i], r[i + 1]); } }
  }
  // Étiquettes des lignes et surfaces : au milieu de la plus longue partie.
  const labels = [];
  for (const f of feats) {
    if (!f.name || f.xy.some((q) => q.t === 'P')) continue; // un repère avec un point est déjà nommé au point
    const c = f.xy.map((q) => (q.t === 'A' ? q.r[0] : q.c)).sort((a, b) => b.length - a.length)[0];
    if (!c || c.length < 4) continue;
    let x = 0, y = 0; const n = c.length / 2; for (let i = 0; i < c.length; i += 2) { x += c[i]; y += c[i + 1]; }
    labels.push({ f: f.f, x: x / n, y: y / n, name: f.name, hidden: !!f.hidden, span: Math.max(...[0, 1].map((d) => { let lo = Infinity, hi = -Infinity; for (let i = d; i < c.length; i += 2) { lo = Math.min(lo, c[i]); hi = Math.max(hi, c[i]); } return hi - lo; })) });
  }
  return { ox, oy, bbox, groups: [...groups.values()], points, labels, index, cell, feats };
}

const rgba = (hex, a) => { const h = hex.replace('#', ''); return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; };

// Dessin d'un calque KML sur le canevas du plan (v : Viewer).
export function drawKml(ctx, v, L, cache) {
  if (!L?.visible || !cache?.bbox) return;
  const s = v.s, dpr = v.dpr, force = !!L.force;
  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(1, +L.opacity || 1));
  ctx.setTransform(dpr * s, 0, 0, -dpr * s, dpr * ((cache.ox - v.cx) * s + v.W / 2), dpr * (-(cache.oy - v.cy) * s + v.H / 2));
  for (const g of cache.groups) {
    if (g.hidden || !folderShown(L, g.f)) continue;
    const st = g.s;
    if (g.kind === 'A') {
      if (!st.nofill) {
        const c = force || !st.pc ? { css: L.color, a: 0.25 } : st.pc;
        if (c.a > 0) { ctx.fillStyle = rgba(c.css, c.a); ctx.fill(g.path, 'evenodd'); }
      }
      if (st.nooutline && !force) continue;
    }
    const lc = force || !st.lc ? { css: L.color, a: 1 } : st.lc;
    if (lc.a <= 0) continue;
    ctx.strokeStyle = rgba(lc.css, lc.a);
    ctx.lineWidth = Math.max(1, Math.min(6, st.lw ?? (g.kind === 'L' ? 2 : 1.5))) / s;
    ctx.stroke(g.path);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '500 11px system-ui, sans-serif';
  const ink = (txt, x, y, col) => { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.strokeText(txt, x, y); ctx.fillStyle = col; ctx.fillText(txt, x, y); };
  for (const p of cache.points) {
    if (p.hidden || !folderShown(L, p.f)) continue;
    const [x, y] = v.w2s(p.x, p.y);
    if (x < -50 || y < -20 || x > v.W + 50 || y > v.H + 20) continue;
    const c = force || !p.s.ic ? L.color : p.s.ic.css;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.stroke();
    if (L.labels && p.name && (cache.points.length <= 300 || s > 1)) ink(p.name, x + 7, y, '#fff');
  }
  if (L.labels) for (const q of cache.labels) {
    if (q.hidden || q.span * s < 60 || !folderShown(L, q.f)) continue;
    const [x, y] = v.w2s(q.x, q.y);
    if (x < -100 || y < -20 || x > v.W + 100 || y > v.H + 20) continue;
    ctx.textAlign = 'center'; ink(q.name, x, y, '#fff'); ctx.textAlign = 'left';
  }
  ctx.restore();
}
