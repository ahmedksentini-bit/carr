// viewer.js — vue CAD en mètres (Y vers le haut), zoom au curseur, rendu canvas du projet et du fond DXF.
import * as G from './geom.js';

export const THEMES = {
  dark: {
    bg: '#1a1d22', grid: 'rgba(255,255,255,0.045)', gridMajor: 'rgba(255,255,255,0.09)', hud: '#d7dde5', hudBg: 'rgba(20,23,28,0.78)',
    dxfWhite: '#e8e8e8', sel: '#38bdf8', hover: '#7dd3fc', snap: '#facc15', rubber: '#facc15',
    L: {
      CHAUSSEE: { fill: 'rgba(64,68,76,0.82)' },
      AXE_SAISI: { stroke: '#facc15', w: 1.4, dash: [7, 5] },
      AXE: { stroke: '#f87171', w: 1, dash: [16, 4, 3, 4] },
      BORDURE: { stroke: '#f5f5f5', w: 1.6 },
      ILOT_CENTRAL: { stroke: '#f5f5f5', w: 1.6, fill: { ilot: 'rgba(74,140,82,0.62)', franchissable: 'rgba(190,176,150,0.5)' } },
      ILOT_SEP: { stroke: '#f5f5f5', w: 1.6, fill: { ilot: 'rgba(74,140,82,0.62)' } },
      MARQUAGE: { stroke: '#ffffff', w: 1 },
      CONSTRUCTION: { stroke: '#7d9bbd', w: 0.8, dash: [3, 3] },
      LIMITE: { stroke: '#94a3b8', w: 1, dash: [6, 4] },
      COTATION: { stroke: '#38bdf8', w: 0.9, text: '#7dd3fc' },
      DEVERS: { stroke: '#fb923c', w: 1.2, text: '#fdba74' },
      IMPLANTATION: { stroke: '#e879f9', w: 1, text: '#f0abfc' },
    },
  },
  light: {
    bg: '#ffffff', grid: 'rgba(0,0,0,0.05)', gridMajor: 'rgba(0,0,0,0.1)', hud: '#1f2937', hudBg: 'rgba(255,255,255,0.85)',
    dxfWhite: '#222222', sel: '#0369a1', hover: '#0284c7', snap: '#ca8a04', rubber: '#b45309',
    L: {
      CHAUSSEE: { fill: 'rgba(205,207,211,0.85)' },
      AXE_SAISI: { stroke: '#b45309', w: 1.4, dash: [7, 5] },
      AXE: { stroke: '#dc2626', w: 1, dash: [16, 4, 3, 4] },
      BORDURE: { stroke: '#111827', w: 1.6 },
      ILOT_CENTRAL: { stroke: '#111827', w: 1.6, fill: { ilot: 'rgba(134,190,120,0.7)', franchissable: 'rgba(214,200,170,0.75)' } },
      ILOT_SEP: { stroke: '#111827', w: 1.6, fill: { ilot: 'rgba(134,190,120,0.7)' } },
      MARQUAGE: { stroke: '#4b5563', w: 1 },
      CONSTRUCTION: { stroke: '#64748b', w: 0.8, dash: [3, 3] },
      LIMITE: { stroke: '#64748b', w: 1, dash: [6, 4] },
      COTATION: { stroke: '#0369a1', w: 0.9, text: '#0c4a6e' },
      DEVERS: { stroke: '#c2410c', w: 1.2, text: '#9a3412' },
      IMPLANTATION: { stroke: '#a21caf', w: 1, text: '#86198f' },
    },
  },
};

export class Viewer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.cx = 0; this.cy = 0; this.s = 2; // s : pixels par mètre
    this.W = 1; this.H = 1; this.dpr = 1;
    this.onRender = null;
    this._pending = false;
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
  }
  resize() {
    const r = this.cv.parentElement.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
    this.invalidate();
  }
  w2s(x, y) { return [(x - this.cx) * this.s + this.W / 2, -(y - this.cy) * this.s + this.H / 2]; }
  s2w(px, py) { return [(px - this.W / 2) / this.s + this.cx, -(py - this.H / 2) / this.s + this.cy]; }
  zoomAt(f, px, py) {
    const [wx, wy] = this.s2w(px, py);
    this.s = G.clamp(this.s * f, 1e-4, 2000);
    const [nx, ny] = this.s2w(px, py);
    this.cx += wx - nx; this.cy += wy - ny;
    this.invalidate();
  }
  panPx(dx, dy) { this.cx -= dx / this.s; this.cy += dy / this.s; this.invalidate(); }
  fit(bb, margin = 0.12) {
    if (!bb || !isFinite(bb.x0)) return;
    const w = Math.max(bb.x1 - bb.x0, 1), h = Math.max(bb.y1 - bb.y0, 1);
    this.cx = (bb.x0 + bb.x1) / 2; this.cy = (bb.y0 + bb.y1) / 2;
    this.s = Math.min(this.W / (w * (1 + 2 * margin)), this.H / (h * (1 + 2 * margin)));
    this.invalidate();
  }
  invalidate() {
    if (this._pending) return;
    this._pending = true;
    requestAnimationFrame(() => { this._pending = false; this.onRender && this.onRender(this.ctx, this); });
  }
}

// ---------------------------------------------------------------- Dessin
// Trace un chemin (segments monde) dans le contexte en coordonnées écran.
export function tracePath(ctx, v, segs, move = true) {
  let first = move;
  for (const s of segs) {
    if (s.t === 'L') {
      const [ax, ay] = v.w2s(s.a.x, s.a.y), [bx, by] = v.w2s(s.b.x, s.b.y);
      if (first) { ctx.moveTo(ax, ay); first = false; }
      ctx.lineTo(bx, by);
    } else if (s.t === 'A') {
      const [cx, cy] = v.w2s(s.c.x, s.c.y);
      if (first) { const p = G.segStart(s); const [px, py] = v.w2s(p.x, p.y); ctx.moveTo(px, py); first = false; }
      if (G.sweep(s) > 1e-9) ctx.arc(cx, cy, s.r * v.s, -s.sa, -s.ea, s.ccw);
    } else if (s.t === 'C') {
      const [cx, cy] = v.w2s(s.c.x, s.c.y);
      ctx.moveTo(cx + s.r * v.s, cy);
      ctx.arc(cx, cy, s.r * v.s, 0, Math.PI * 2);
      first = true;
    }
  }
}

function setStroke(ctx, v, st, prim) {
  ctx.strokeStyle = st.stroke;
  let w = st.w || 1;
  if (prim.wm) w = Math.max(w, prim.wm * v.s);
  ctx.lineWidth = w;
  if (prim.dash) {
    const d = prim.dash.map((x) => x * v.s);
    ctx.setLineDash(d[0] < 2 ? [] : d);
  } else ctx.setLineDash(st.dash || []);
}

function drawText(ctx, v, p, s, h, rot, align, color, minPx = 3.5) {
  const px = h * v.s;
  if (px < minPx) return;
  const [x, y] = v.w2s(p.x, p.y);
  if (x < -400 || y < -400 || x > v.W + 400 || y > v.H + 400) return;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(-rot);
  ctx.font = `${Math.min(px, 400)}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(s, 0, 0);
  ctx.restore();
}

function arrowHead(ctx, x0, y0, x1, y1, size) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - size * Math.cos(a - 0.38), y1 - size * Math.sin(a - 0.38));
  ctx.lineTo(x1 - size * Math.cos(a + 0.38), y1 - size * Math.sin(a + 0.38));
  ctx.closePath(); ctx.fill();
}

// Dessine les primitives du projet. vis : { CALQUE: bool }, highlight : index de branche sélectionnée.
export function drawDesign(ctx, v, D, theme, vis, opts = {}) {
  if (!D) return;
  const T = THEMES[theme];
  const order = ['CHAUSSEE', 'ILOT_CENTRAL', 'ILOT_SEP', 'CONSTRUCTION', 'LIMITE', 'BORDURE', 'MARQUAGE', 'AXE', 'DEVERS', 'COTATION'];
  ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
  for (const layer of order) {
    if (vis[layer] === false) continue;
    const st = T.L[layer];
    for (const pr of D.prims) {
      if (pr.L !== layer) continue;
      if (pr.k === 'fill') {
        const col = typeof st.fill === 'string' ? st.fill : st.fill?.[pr.role];
        if (!col) continue;
        ctx.beginPath();
        for (const ring of pr.rings) { tracePath(ctx, v, ring, true); ctx.closePath(); }
        ctx.fillStyle = opts.onImagery && layer === 'CHAUSSEE' ? 'rgba(52,55,62,0.78)' : col;
        ctx.fill('evenodd');
      } else if (pr.k === 'path') {
        setStroke(ctx, v, st, pr);
        ctx.beginPath(); tracePath(ctx, v, pr.segs); if (pr.closed) ctx.closePath(); ctx.stroke();
        if (pr.arrow) {
          const s = pr.segs[pr.segs.length - 1], a = G.segStart(s), b = G.segEnd(s);
          const [x0, y0] = v.w2s(a.x, a.y), [x1, y1] = v.w2s(b.x, b.y);
          ctx.fillStyle = st.stroke; arrowHead(ctx, x0, y0, x1, y1, 9);
        }
      } else if (pr.k === 'circle') {
        setStroke(ctx, v, st, pr);
        const [cx, cy] = v.w2s(pr.c.x, pr.c.y);
        ctx.beginPath(); ctx.arc(cx, cy, pr.r * v.s, 0, Math.PI * 2); ctx.stroke();
      } else if (pr.k === 'hatch') {
        setStroke(ctx, v, st, pr);
        ctx.lineWidth = Math.max(0.6, (pr.wm || 0) * v.s);
        ctx.beginPath();
        for (const [a, b] of pr.lines) { const [x0, y0] = v.w2s(a.x, a.y), [x1, y1] = v.w2s(b.x, b.y); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
        ctx.stroke();
      } else if (pr.k === 'cross') {
        ctx.setLineDash([]); ctx.strokeStyle = st.stroke; ctx.lineWidth = 1;
        const [x, y] = v.w2s(pr.p.x, pr.p.y), r = Math.max(4, pr.size * v.s);
        ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
      } else if (pr.k === 'text') {
        drawText(ctx, v, pr.p, pr.s, pr.h, pr.rot, pr.align, st.text || st.stroke);
      } else if (pr.k === 'arrow') {
        if (pr.len * v.s < 10) continue;
        const b = G.add(pr.p, G.mul(pr.dir, pr.len));
        const [x0, y0] = v.w2s(pr.p.x, pr.p.y), [x1, y1] = v.w2s(b.x, b.y);
        ctx.setLineDash([]); ctx.strokeStyle = st.stroke; ctx.fillStyle = st.stroke; ctx.lineWidth = st.w;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        arrowHead(ctx, x0, y0, x1, y1, Math.min(10, Math.max(5, pr.len * v.s * 0.3)));
        const m = G.add(G.lerp(pr.p, b, 0.5), G.mul(G.rot90(pr.dir), pr.h * 0.85));
        drawText(ctx, v, m, pr.text, pr.h, pr.rot, 'center', st.text);
      }
    }
  }
  ctx.setLineDash([]);
  // Points d'implantation
  if (vis.IMPLANTATION !== false && D.points) {
    const st = T.L.IMPLANTATION;
    ctx.strokeStyle = st.stroke; ctx.fillStyle = st.text; ctx.lineWidth = 1;
    ctx.font = '11px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    for (const q of D.points) {
      const [x, y] = v.w2s(q.p.x, q.p.y);
      if (x < -20 || y < -20 || x > v.W + 20 || y > v.H + 20) continue;
      ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.stroke();
      if (v.s > 2.5) ctx.fillText(String(q.n), x + 4, y - 2);
    }
  }
}

// ----------------------------------------------------------- Fond DXF
export function buildDxfCache(geo) {
  const bb = geo.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
  const ox = Math.round((bb.x0 + bb.x1) / 2), oy = Math.round((bb.y0 + bb.y1) / 2);
  const groups = new Map();
  for (const p of geo.polys) {
    const key = p.layer + '\u0001' + (p.color || '');
    let g = groups.get(key);
    if (!g) { g = { layer: p.layer, color: p.color, path: new Path2D() }; groups.set(key, g); }
    const a = p.pts;
    g.path.moveTo(a[0] - ox, a[1] - oy);
    for (let i = 2; i < a.length; i += 2) g.path.lineTo(a[i] - ox, a[i + 1] - oy);
    if (p.closed) g.path.closePath();
  }
  // Index d'accrochage (sommets) sur une grille de 5 m.
  const cell = 5, index = new Map();
  const put = (x, y) => {
    const k = Math.floor(x / cell) + ',' + Math.floor(y / cell);
    let c = index.get(k); if (!c) { c = []; index.set(k, c); }
    if (c.length < 64) c.push(x, y);
  };
  for (const p of geo.polys) { const a = p.pts; for (let i = 0; i < a.length; i += 2) put(a[i], a[i + 1]); }
  for (const p of geo.points) put(p.x, p.y);
  return { ox, oy, groups: [...groups.values()], index, cell };
}

export function snapDxf(cache, x, y, r) {
  if (!cache) return null;
  const c = cache.cell, i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((y - r) / c), j1 = Math.floor((y + r) / c);
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > 400) return null;
  let best = null, bd = r;
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const a = cache.index.get(i + ',' + j); if (!a) continue;
    for (let k = 0; k < a.length; k += 2) { const d = Math.hypot(a[k] - x, a[k + 1] - y); if (d < bd) { bd = d; best = { x: a[k], y: a[k + 1] }; } }
  }
  return best;
}

export function drawDxf(ctx, v, geo, cache, theme, opacity = 1) {
  if (!geo || !cache) return;
  const T = THEMES[theme];
  const col = (c, layer) => {
    let k = c || geo.layers.get(layer)?.color || '#ffffff';
    if (/^#(f{6}|f{3})$/i.test(k)) k = T.dxfWhite;
    else if (theme === 'light' && /^#(ffff00|00ffff|ffffff)$/i.test(k)) k = '#555555';
    return k;
  };
  ctx.save();
  ctx.globalAlpha = opacity;
  const s = v.s, dpr = v.dpr;
  ctx.setTransform(dpr * s, 0, 0, -dpr * s, dpr * ((cache.ox - v.cx) * s + v.W / 2), dpr * (-(cache.oy - v.cy) * s + v.H / 2));
  ctx.lineWidth = 1 / s;
  for (const g of cache.groups) {
    if (geo.layers.get(g.layer)?.visible === false) continue;
    ctx.strokeStyle = col(g.color, g.layer);
    ctx.stroke(g.path);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Points topo
  if (geo.points.length && s > 0.8) {
    for (const p of geo.points) {
      if (geo.layers.get(p.layer)?.visible === false) continue;
      const [x, y] = v.w2s(p.x, p.y);
      if (x < 0 || y < 0 || x > v.W || y > v.H) continue;
      ctx.fillStyle = col(p.color, p.layer);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }
  for (const t of geo.texts) {
    if (geo.layers.get(t.layer)?.visible === false) continue;
    if (t.h * s < 4) continue;
    drawText(ctx, v, t, t.s, t.h, t.rot, t.align, col(t.color, t.layer), 4);
  }
  ctx.restore();
}

// --------------------------------------------------------------- HUD
export function niceStep(target) {
  const p = 10 ** Math.floor(Math.log10(target));
  for (const m of [1, 2, 5, 10]) if (m * p >= target) return m * p;
  return 10 * p;
}

export function drawGrid(ctx, v, theme) {
  const T = THEMES[theme];
  const step = niceStep(40 / v.s);
  const [x0, y1] = v.s2w(0, 0), [x1, y0] = v.s2w(v.W, v.H);
  ctx.lineWidth = 1;
  for (const major of [false, true]) {
    const st = major ? step * 5 : step;
    ctx.strokeStyle = major ? T.gridMajor : T.grid;
    ctx.beginPath();
    for (let x = Math.ceil(x0 / st) * st; x <= x1; x += st) { const [px] = v.w2s(x, 0); ctx.moveTo(Math.round(px) + 0.5, 0); ctx.lineTo(Math.round(px) + 0.5, v.H); }
    for (let y = Math.ceil(y0 / st) * st; y <= y1; y += st) { const [, py] = v.w2s(0, y); ctx.moveTo(0, Math.round(py) + 0.5); ctx.lineTo(v.W, Math.round(py) + 0.5); }
    ctx.stroke();
  }
}

export function drawHud(ctx, v, theme, northAngle = 0, attribution = '') {
  const T = THEMES[theme];
  // Échelle graphique
  const L = niceStep(110 / v.s), w = L * v.s, x = 16, y = v.H - 22;
  ctx.fillStyle = T.hudBg; ctx.fillRect(x - 8, y - 22, w + 70, 34);
  ctx.strokeStyle = T.hud; ctx.fillStyle = T.hud; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y - 5); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y - 3); ctx.stroke();
  ctx.font = '12px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(L >= 1000 ? `${L / 1000} km` : `${L} m`, x + w + 8, y + 1);
  ctx.fillText(`1:${Math.round(3779.5 / v.s).toLocaleString('fr-FR')} (écran)`, x, y - 10);
  // Nord
  const cx = v.W - 34, cy = 40;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-northAngle);
  ctx.fillStyle = T.hudBg; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = T.hud; ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(7, 9); ctx.lineTo(0, 4); ctx.lineTo(-7, 9); ctx.closePath(); ctx.fill();
  ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('N', 0, 19);
  ctx.restore();
  if (attribution) {
    ctx.font = '10px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'right';
    const tw = ctx.measureText(attribution).width;
    ctx.fillStyle = T.hudBg; ctx.fillRect(v.W - tw - 12, v.H - 16, tw + 12, 16);
    ctx.fillStyle = T.hud; ctx.fillText(attribution, v.W - 6, v.H - 4);
  }
}
