// dxf-write.js — écriture DXF R12 (AC1009), lisible par AutoCAD, Covadis, BricsCAD, LibreCAD, QGIS.
import { sweep, segStart, segEnd } from './geom.js';

const LTYPES = {
  CONTINUOUS: { desc: 'Solid line', pat: [] },
  AXE: { desc: 'Axe ____ _ ____ _', pat: [8, -1.5, 1.5, -1.5] },
  TIRETS: { desc: 'Tirets __ __ __', pat: [2, -2] },
  CONSTRUCTION: { desc: 'Construction . . .', pat: [0.6, -0.6] },
  CLP: { desc: 'Cedez-le-passage 0.50/0.50', pat: [0.5, -0.5] },
  T1: { desc: 'Marquage T1 3/10', pat: [3, -10] },
  T3: { desc: 'Marquage T3 3/1.33', pat: [3, -1.33] },
};

const f = (v) => (Math.abs(v) < 1e-10 ? '0.0' : v.toFixed(4));
const enc = (s) => String(s).replace(/[^\x20-\x7e]/g, (c) => '\\U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
const deg = (r) => ((r * 180) / Math.PI + 360) % 360;

export class DxfWriter {
  constructor() { this.layers = new Map(); this.out = []; }

  layer(name, aci = 7, ltype = 'CONTINUOUS') { this.layers.set(name, { aci, ltype }); return this; }
  _g(...pairs) { for (let i = 0; i < pairs.length; i += 2) this.out.push(String(pairs[i]), String(pairs[i + 1])); }
  _ent(type, layer, extra) { this._g(0, type, 8, layer); if (extra?.ltype) this._g(6, extra.ltype); if (extra?.aci != null) this._g(62, extra.aci); }

  line(layer, a, b, extra) { this._ent('LINE', layer, extra); this._g(10, f(a.x), 20, f(a.y), 30, '0.0', 11, f(b.x), 21, f(b.y), 31, '0.0'); }
  circle(layer, c, r, extra) { this._ent('CIRCLE', layer, extra); this._g(10, f(c.x), 20, f(c.y), 30, '0.0', 40, f(r)); }
  arc(layer, s, extra) { // s : segment arc { c, r, sa, ea, ccw }
    const a0 = s.ccw ? s.sa : s.ea, a1 = s.ccw ? s.ea : s.sa;
    this._ent('ARC', layer, extra); this._g(10, f(s.c.x), 20, f(s.c.y), 30, '0.0', 40, f(s.r), 50, f(deg(a0)), 51, f(deg(a1)));
  }
  point(layer, p, z = 0) { this._ent('POINT', layer); this._g(10, f(p.x), 20, f(p.y), 30, f(z)); }
  text(layer, p, h, rot, s, align = 'left', extra) {
    this._ent('TEXT', layer, extra);
    this._g(10, f(p.x), 20, f(p.y), 30, '0.0', 40, f(h), 1, enc(s), 50, f(deg(rot)));
    if (align !== 'left') this._g(72, align === 'right' ? 2 : 1, 11, f(p.x), 21, f(p.y), 31, '0.0', 73, 2);
  }
  // Polyligne 2D avec arrondis (bulge) : verts = [{ x, y, b }]
  poly(layer, verts, closed = false, extra) {
    this._ent('POLYLINE', layer, extra); this._g(66, 1, 10, '0.0', 20, '0.0', 30, '0.0', 70, closed ? 1 : 0);
    for (const v of verts) { this._g(0, 'VERTEX', 8, layer, 10, f(v.x), 20, f(v.y), 30, '0.0'); if (v.b) this._g(42, f(v.b)); }
    this._g(0, 'SEQEND', 8, layer);
  }
  // Chemin de segments (droites/arcs) → une polyligne.
  path(layer, segs, closed = false, extra) {
    if (!segs.length) return;
    const verts = segs.map((s) => {
      const p = segStart(s);
      return { x: p.x, y: p.y, b: s.t === 'A' ? Math.tan(sweep(s) / 4) * (s.ccw ? 1 : -1) : 0 };
    });
    if (!closed) { const e = segEnd(segs[segs.length - 1]); verts.push({ x: e.x, y: e.y, b: 0 }); }
    this.poly(layer, verts, closed, extra);
  }

  toString() {
    const H = [];
    const g = (...p) => { for (let i = 0; i < p.length; i += 2) H.push(String(p[i]), String(p[i + 1])); };
    g(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSBASE', 10, '0.0', 20, '0.0', 30, '0.0', 9, '$LTSCALE', 40, '1.0', 0, 'ENDSEC');
    g(0, 'SECTION', 2, 'TABLES');
    g(0, 'TABLE', 2, 'LTYPE', 70, Object.keys(LTYPES).length);
    for (const [name, lt] of Object.entries(LTYPES)) {
      const total = lt.pat.reduce((a, b) => a + Math.abs(b), 0);
      g(0, 'LTYPE', 2, name, 70, 0, 3, lt.desc, 72, 65, 73, lt.pat.length, 40, f(total));
      for (const e of lt.pat) g(49, f(e));
    }
    g(0, 'ENDTAB');
    g(0, 'TABLE', 2, 'LAYER', 70, this.layers.size + 1);
    g(0, 'LAYER', 2, '0', 70, 0, 62, 7, 6, 'CONTINUOUS');
    for (const [name, l] of this.layers) g(0, 'LAYER', 2, name, 70, 0, 62, l.aci, 6, l.ltype);
    g(0, 'ENDTAB');
    g(0, 'TABLE', 2, 'STYLE', 70, 1, 0, 'STYLE', 2, 'STANDARD', 70, 0, 40, '0.0', 41, '1.0', 50, '0.0', 71, 0, 42, '2.5', 3, 'txt', 4, '', 0, 'ENDTAB');
    g(0, 'ENDSEC');
    return [...H, '0', 'SECTION', '2', 'ENTITIES', ...this.out, '0', 'ENDSEC', '0', 'EOF'].join('\r\n') + '\r\n';
  }
}
