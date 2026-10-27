// dxf-parse.js — lecture d'un DXF ASCII (fond topographique).
// Entités gérées : LINE, LWPOLYLINE, POLYLINE (2D/3D), ARC, CIRCLE, ELLIPSE, SPLINE, POINT, TEXT, MTEXT,
// ATTRIB, INSERT (blocs imbriqués), DIMENSION (bloc anonyme), SOLID, 3DFACE, LEADER.
// Sortie : polylignes / textes / points en coordonnées monde (mètres), groupés par calque.

const ACI = buildAciPalette();

function buildAciPalette() {
  const pal = new Array(256).fill('#ffffff');
  const base = ['#000000', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffffff', '#808080', '#c0c0c0'];
  base.forEach((c, i) => (pal[i] = c));
  const vals = [1, 0.8, 0.6, 0.5, 0.3];
  for (let i = 10; i < 250; i++) {
    const h = Math.floor((i - 10) / 10) * 15, v = (i - 10) % 10;
    const val = vals[Math.floor(v / 2)], sat = v % 2 ? 0.5 : 1;
    pal[i] = hsv(h, sat, val);
  }
  ['#333333', '#505050', '#696969', '#828282', '#bebebe', '#ffffff'].forEach((c, k) => (pal[250 + k] = c));
  return pal;
}
function hsv(h, s, v) {
  const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  const to = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return '#' + to(f(5)) + to(f(3)) + to(f(1));
}
export const aciColor = (i) => ACI[Math.abs(i) % 256];
const trueColor = (v) => '#' + (v & 0xffffff).toString(16).padStart(6, '0');

const UNIT_FACTORS = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1, 14: 0.1 };

// Lecture séquentielle des couples (code, valeur).
class Reader {
  constructor(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    this.l = text.split(/\r\n|\r|\n/);
    this.i = 0;
  }
  get done() { return this.i + 1 >= this.l.length; }
  peekCode() { return parseInt(this.l[this.i], 10); }
  peekVal() { return (this.l[this.i + 1] || '').trim(); }
  next() { const c = parseInt(this.l[this.i], 10), v = this.l[this.i + 1]; this.i += 2; return [c, v === undefined ? '' : v.trim()]; }
  // Lit un enregistrement « 0 / TYPE » complet : retourne { type, g: [[code,val]...] }.
  record() {
    const [, type] = this.next();
    const g = [];
    while (!this.done && this.peekCode() !== 0) g.push(this.next());
    return { type, g };
  }
}

const num = (g, c, d = 0) => { for (const [k, v] of g) if (k === c) return parseFloat(v); return d; };
const str = (g, c, d = '') => { for (const [k, v] of g) if (k === c) return v; return d; };
const has = (g, c) => g.some(([k]) => k === c);

export function parseDXF(text) {
  const R = new Reader(text);
  const header = {};
  const layers = new Map();
  const blocks = new Map();
  const ents = [];

  while (!R.done) {
    const [c, v] = R.next();
    if (c !== 0 || v !== 'SECTION') continue;
    const [, name] = R.next();
    if (name === 'HEADER') readHeader(R, header);
    else if (name === 'TABLES') readTables(R, layers);
    else if (name === 'BLOCKS') readBlocks(R, blocks);
    else if (name === 'ENTITIES') readEntities(R, ents, 'ENDSEC');
    else skipSection(R);
  }
  return { header, layers, blocks, ents, unitFactor: UNIT_FACTORS[header.$INSUNITS] ?? null };
}

function skipSection(R) { while (!R.done) { const [c, v] = R.next(); if (c === 0 && v === 'ENDSEC') return; } }

function readHeader(R, header) {
  let cur = null;
  while (!R.done) {
    const [c, v] = R.next();
    if (c === 0 && v === 'ENDSEC') return;
    if (c === 9) cur = v; else if (cur && header[cur] === undefined) header[cur] = isNaN(+v) ? v : +v;
  }
}

function readTables(R, layers) {
  while (!R.done) {
    if (R.peekCode() === 0 && R.peekVal() === 'ENDSEC') { R.next(); return; }
    if (R.peekCode() === 0 && R.peekVal() === 'LAYER') {
      const { g } = R.record();
      const name = str(g, 2);
      if (!name) continue;
      const col = num(g, 62, 7);
      layers.set(name, {
        name, aci: col,
        color: has(g, 420) ? trueColor(num(g, 420)) : aciColor(col),
        off: col < 0, frozen: (num(g, 70) & 1) === 1,
      });
    } else R.next();
  }
}

function readBlocks(R, blocks) {
  while (!R.done) {
    if (R.peekCode() !== 0) { R.next(); continue; }
    const v = R.peekVal();
    if (v === 'ENDSEC') { R.next(); return; }
    if (v === 'BLOCK') {
      const { g } = R.record();
      const blk = { name: str(g, 2), bx: num(g, 10), by: num(g, 20), ents: [] };
      readEntities(R, blk.ents, 'ENDBLK');
      blocks.set(blk.name, blk);
    } else R.record();
  }
}

// Lit des entités jusqu'au marqueur de fin (ENDSEC / ENDBLK), qui est consommé.
function readEntities(R, out, end) {
  while (!R.done) {
    if (R.peekCode() !== 0) { R.next(); continue; }
    if (R.peekVal() === end) { R.record(); return; }
    const rec = R.record();
    if (rec.type === 'POLYLINE') {
      rec.verts = [];
      while (!R.done && R.peekCode() === 0 && R.peekVal() === 'VERTEX') rec.verts.push(R.record().g);
      if (R.peekVal() === 'SEQEND') R.record();
    } else if (rec.type === 'INSERT' && num(rec.g, 66) === 1) {
      rec.attribs = [];
      while (!R.done && R.peekCode() === 0 && R.peekVal() === 'ATTRIB') rec.attribs.push(R.record().g);
      if (R.peekVal() === 'SEQEND') R.record();
    }
    out.push(rec);
  }
}

// --- Conversion en géométrie monde ---------------------------------------------------

const IDENT = [1, 0, 0, 1, 0, 0];
const mulM = (m, n) => [ // m ∘ n
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const ocs = (g) => (num(g, 230, 1) < 0 ? [-1, 0, 0, 1, 0, 0] : IDENT);

function arcPts(cx, cy, r, a0, a1, out) { // a0→a1 en radians, sens trigo
  let sw = a1 - a0; while (sw <= 0) sw += Math.PI * 2;
  const n = Math.max(4, Math.min(128, Math.ceil(sw / (Math.PI / 32)) + Math.ceil(r > 50 ? sw * 8 : 0)));
  for (let i = 0; i <= n; i++) { const a = a0 + (sw * i) / n; out.push(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
}

function bulgeTo(x0, y0, x1, y1, b, out) {
  const th = 4 * Math.atan(b), c = Math.hypot(x1 - x0, y1 - y0);
  if (c < 1e-12) return;
  const r = c / (2 * Math.sin(Math.abs(th) / 2));
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, nx = -(y1 - y0) / c, ny = (x1 - x0) / c;
  const h = r * Math.cos(Math.abs(th) / 2) * (b > 0 ? 1 : -1); // centre à gauche de la corde si b > 0 et |θ| < π
  const cx = mx + nx * h, cy = my + ny * h;
  const a0 = Math.atan2(y0 - cy, x0 - cx), a1 = Math.atan2(y1 - cy, x1 - cx);
  const tmp = [];
  if (b > 0) arcPts(cx, cy, r, a0, a1, tmp);
  else { arcPts(cx, cy, r, a1, a0, tmp); for (let i = tmp.length - 4; i >= 0; i -= 2) out.push(tmp[i], tmp[i + 1]); return; }
  for (let i = 2; i < tmp.length; i += 2) out.push(tmp[i], tmp[i + 1]);
}

function vertsWithBulge(vs, closed) { // vs: [{x,y,b}]
  const out = [];
  if (!vs.length) return out;
  out.push(vs[0].x, vs[0].y);
  const n = closed ? vs.length : vs.length - 1;
  for (let i = 0; i < n; i++) {
    const a = vs[i], b = vs[(i + 1) % vs.length];
    if (a.b) bulgeTo(a.x, a.y, b.x, b.y, a.b, out); else out.push(b.x, b.y);
  }
  return out;
}

function deBoor(deg, knots, cps, t) {
  const n = cps.length;
  let k = deg;
  while (k < n - 1 && knots[k + 1] <= t) k++;
  const d = [];
  for (let j = 0; j <= deg; j++) { const p = cps[k - deg + j]; d.push([p[0] * p[2], p[1] * p[2], p[2]]); }
  for (let r = 1; r <= deg; r++) {
    for (let j = deg; j >= r; j--) {
      const i = k - deg + j, den = knots[i + deg - r + 1] - knots[i];
      const a = den > 0 ? (t - knots[i]) / den : 0;
      for (let q = 0; q < 3; q++) d[j][q] = (1 - a) * d[j - 1][q] + a * d[j][q];
    }
  }
  return [d[deg][0] / d[deg][2], d[deg][1] / d[deg][2]];
}

// Ajoute à `out` les primitives d'une entité (récursif pour les blocs).
function emit(e, M, layer, color, ctx, out, depth) {
  const g = e.g;
  let lay = str(g, 8, '0');
  if (lay === '0' && layer) lay = layer;
  let col = null;
  if (has(g, 420)) col = trueColor(num(g, 420));
  else if (has(g, 62)) { const c = num(g, 62); col = c === 0 ? color : c === 256 ? null : aciColor(c); }
  else col = null;
  const Mo = mulM(M, ocs(g));
  const poly = (flat, closed) => {
    if (flat.length < 4) return;
    const p = new Float64Array(flat.length);
    for (let i = 0; i < flat.length; i += 2) { const q = apply(Mo, flat[i], flat[i + 1]); p[i] = q[0]; p[i + 1] = q[1]; }
    out.polys.push({ layer: lay, color: col, pts: p, closed });
  };
  const text = (x, y, h, rotDeg, s, align) => {
    if (!s) return;
    const [wx, wy] = apply(Mo, x, y);
    const sc = Math.hypot(Mo[2], Mo[3]);
    const rot = Math.atan2(Mo[1], Mo[0]) + (rotDeg * Math.PI) / 180;
    out.texts.push({ layer: lay, color: col, x: wx, y: wy, h: h * sc, rot, s, align });
  };

  switch (e.type) {
    case 'LINE': poly([num(g, 10), num(g, 20), num(g, 11), num(g, 21)], false); break;
    case 'LWPOLYLINE': {
      const vs = [];
      for (const [k, v] of g) {
        if (k === 10) vs.push({ x: +v, y: 0, b: 0 });
        else if (k === 20 && vs.length) vs[vs.length - 1].y = +v;
        else if (k === 42 && vs.length) vs[vs.length - 1].b = +v;
      }
      const closed = (num(g, 70) & 1) === 1;
      poly(vertsWithBulge(vs, closed), closed);
      break;
    }
    case 'POLYLINE': {
      const fl = num(g, 70);
      if (fl & (16 | 64)) break; // maillages : ignorés
      const vs = (e.verts || []).filter((vg) => !(num(vg, 70) & 16)).map((vg) => ({ x: num(vg, 10), y: num(vg, 20), b: num(vg, 42) }));
      const closed = (fl & 1) === 1;
      poly(vertsWithBulge(vs, closed), closed);
      break;
    }
    case 'ARC': {
      const f = [];
      arcPts(num(g, 10), num(g, 20), num(g, 40), (num(g, 50) * Math.PI) / 180, (num(g, 51) * Math.PI) / 180, f);
      poly(f, false); break;
    }
    case 'CIRCLE': {
      const f = []; arcPts(num(g, 10), num(g, 20), num(g, 40), 0, Math.PI * 2, f); poly(f, true); break;
    }
    case 'ELLIPSE': {
      const cx = num(g, 10), cy = num(g, 20), mx = num(g, 11), my = num(g, 21), ra = num(g, 40, 1);
      let t0 = num(g, 41, 0), t1 = num(g, 42, Math.PI * 2);
      while (t1 <= t0) t1 += Math.PI * 2;
      const n = Math.max(8, Math.ceil(((t1 - t0) / (Math.PI * 2)) * 72)), f = [];
      for (let i = 0; i <= n; i++) {
        const t = t0 + ((t1 - t0) * i) / n, c = Math.cos(t), s = Math.sin(t);
        f.push(cx + mx * c - my * ra * s, cy + my * c + mx * ra * s);
      }
      poly(f, false); break;
    }
    case 'SPLINE': {
      const deg = num(g, 71, 3), knots = [], cps = [], fit = [];
      let w = [];
      for (const [k, v] of g) {
        if (k === 40) knots.push(+v);
        else if (k === 41) w.push(+v);
        else if (k === 10) cps.push([+v, 0, 1]);
        else if (k === 20 && cps.length) cps[cps.length - 1][1] = +v;
        else if (k === 11) fit.push(+v, 0);
        else if (k === 21 && fit.length) fit[fit.length - 1] = +v;
      }
      if (w.length === cps.length) cps.forEach((p, i) => (p[2] = w[i] || 1));
      if (cps.length > deg && knots.length === cps.length + deg + 1) {
        const lo = knots[deg], hi = knots[cps.length], n = Math.min(600, cps.length * 10), f = [];
        for (let i = 0; i <= n; i++) f.push(...deBoor(deg, knots, cps, lo + ((hi - lo) * i) / n - (i === n ? 1e-9 : 0)));
        poly(f, (num(g, 70) & 1) === 1);
      } else if (fit.length >= 4) poly(fit, false);
      break;
    }
    case 'SOLID': case '3DFACE': case 'TRACE': {
      const p = [num(g, 10), num(g, 20), num(g, 11), num(g, 21)];
      if (e.type === 'SOLID' || e.type === 'TRACE') p.push(num(g, 13), num(g, 23), num(g, 12), num(g, 22));
      else p.push(num(g, 12), num(g, 22), num(g, 13), num(g, 23));
      poly(p, true); break;
    }
    case 'LEADER': {
      const f = [];
      for (const [k, v] of g) { if (k === 10) f.push(+v, 0); else if (k === 20 && f.length) f[f.length - 1] = +v; }
      poly(f, false); break;
    }
    case 'POINT': {
      const [x, y] = apply(Mo, num(g, 10), num(g, 20));
      out.points.push({ layer: lay, color: col, x, y, z: num(g, 30) });
      break;
    }
    case 'TEXT': case 'ATTRIB': {
      if (e.type === 'ATTRIB' && (num(g, 70) & 1)) break;
      const h72 = num(g, 72), v73 = num(g, e.type === 'TEXT' ? 73 : 74);
      const useAlign = (h72 || v73) && has(g, 11);
      const align = h72 === 1 || h72 === 4 ? 'center' : h72 === 2 ? 'right' : 'left';
      text(useAlign ? num(g, 11) : num(g, 10), useAlign ? num(g, 21) : num(g, 20), num(g, 40, 1), num(g, 50), cleanText(str(g, 1)), align);
      break;
    }
    case 'MTEXT': {
      let s = '';
      for (const [k, v] of g) if (k === 3) s += v;
      s += str(g, 1);
      let rot = num(g, 50);
      if (has(g, 11)) rot = (Math.atan2(num(g, 21), num(g, 11)) * 180) / Math.PI;
      const att = num(g, 71, 1), align = [2, 5, 8].includes(att) ? 'center' : [3, 6, 9].includes(att) ? 'right' : 'left';
      text(num(g, 10), num(g, 20), num(g, 40, 1), rot, cleanMText(s), align);
      break;
    }
    case 'INSERT': case 'DIMENSION': {
      if (depth > 6) break;
      const blk = ctx.blocks.get(str(g, 2));
      if (e.attribs) for (const ag of e.attribs) emit({ type: 'ATTRIB', g: ag }, M, lay, col ?? color, ctx, out, depth + 1);
      if (!blk) break;
      let T;
      if (e.type === 'DIMENSION') T = M;
      else {
        const sx = num(g, 41, 1), sy = num(g, 42, 1), r = (num(g, 50) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
        const local = [c * sx, s * sx, -s * sy, c * sy, num(g, 10), num(g, 20)];
        T = mulM(Mo, mulM(local, [1, 0, 0, 1, -blk.bx, -blk.by]));
      }
      const blkCol = col ?? (ctx.layers.get(lay)?.color || null);
      for (const be of blk.ents) emit(be, T, lay, blkCol, ctx, out, depth + 1);
      break;
    }
    default: break;
  }
}

function cleanText(s) {
  return s.replace(/%%[cC]/g, 'Ø').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±').replace(/%%[uUoO]/g, '')
    .replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function cleanMText(s) {
  return cleanText(s)
    .replace(/\\P/g, ' ').replace(/\\[ACcFfHhQqTtWw][^;]*;/g, '').replace(/\\[LlOoKk]/g, '')
    .replace(/\\S([^;]*);/g, '$1').replace(/[{}]/g, '').replace(/\\\\/g, '\\').trim();
}

// Convertit le résultat de parseDXF en géométrie exploitable (unité → mètres).
export function buildDxfGeometry(parsed, unitFactor = 1) {
  const out = { polys: [], texts: [], points: [] };
  const ctx = { blocks: parsed.blocks, layers: parsed.layers };
  for (const e of parsed.ents) emit(e, IDENT, null, null, ctx, out, 0);
  if (unitFactor !== 1) {
    for (const p of out.polys) for (let i = 0; i < p.pts.length; i++) p.pts[i] *= unitFactor;
    for (const t of out.texts) { t.x *= unitFactor; t.y *= unitFactor; t.h *= unitFactor; }
    for (const p of out.points) { p.x *= unitFactor; p.y *= unitFactor; }
  }
  // Calques : ceux de la table + ceux rencontrés.
  const layers = new Map();
  for (const [n, l] of parsed.layers) layers.set(n, { name: n, color: l.color, visible: !l.off && !l.frozen, count: 0 });
  const touch = (n) => { if (!layers.has(n)) layers.set(n, { name: n, color: '#ffffff', visible: true, count: 0 }); layers.get(n).count++; };
  out.polys.forEach((p) => touch(p.layer)); out.texts.forEach((t) => touch(t.layer)); out.points.forEach((p) => touch(p.layer));
  for (const [n, l] of layers) if (!l.count) layers.delete(n);
  // Emprise robuste (centiles 1–99 %) pour le zoom.
  const xs = [], ys = [];
  for (const p of out.polys) for (let i = 0; i < p.pts.length; i += Math.max(2, (p.pts.length >> 3) & ~1)) { xs.push(p.pts[i]); ys.push(p.pts[i + 1]); }
  for (const p of out.points) { xs.push(p.x); ys.push(p.y); }
  for (const t of out.texts) { xs.push(t.x); ys.push(t.y); }
  xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
  const q = (arr, f) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(f * (arr.length - 1))))];
  const bbox = xs.length ? { x0: q(xs, 0.01), x1: q(xs, 0.99), y0: q(ys, 0.01), y1: q(ys, 0.99) } : null;
  return { ...out, layers, bbox };
}
