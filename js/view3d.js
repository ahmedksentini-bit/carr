// view3d.js — vue 3D du carrefour (three.js, vendu dans js/vendor) : terrain naturel (TIN du MNT), anneau et
// branches reconstruits par sections (plateforme, dévers, îlots, abords, talus jusqu'au TN), route principale des
// carrefours plans, mâts et panneaux de signalisation (pictogrammes), vue orbitale et vue conducteur, PNG et OBJ.
// Repère three.js : x = X − X0, y = Z (altitude, exagération éventuelle), z = −(Y − Y0).
import * as THREE from './vendor/three-0.170.module.min.js';
import { OrbitControls } from './vendor/OrbitControls-0.170.js';
import * as G from './geom.js';
import { sectionParams } from './norms.js';
import { ptParams, platform, mainPlatform, crossSectionFrom, sampleSection } from './pt.js';
import { axisPointAt, axisLength } from './pl.js';
import { ringProfile } from './profile.js';
import { tinZ, tinTriangles } from './tin.js';
import { signSVG } from './signicons.js';

const COLORS = {
  chaussee: 0x4b4f57, bdd: 0x5c6069, ilot: 0x4f8a4e, trottoir: 0xc9b59a, bordure: 0xd9d4cc, berme: 0x8b7d57, talus: 0x7a6b4a,
  franchissable: 0xb9ad93, bdg: 0x6b6f78, anneau: 0x4b4f57, terrain: [0x5c6b3f, 0x9a8c5a, 0xb9a36b],
};
const kindColor = (k) => COLORS[k] ?? COLORS.talus;

export class View3D {
  constructor(host) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    host.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfd7ea);
    this.scene.fog = new THREE.Fog(0xbfd7ea, 400, 1500);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.3, 4000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6b5a3a, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(200, 300, 150); this.scene.add(sun);
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.meshes = []; this.ve = 1; this.X0 = 0; this.Y0 = 0; this.Z0 = 0;
    this._raf = 0; this._alive = true;
    const loop = () => { if (!this._alive) return; this._raf = requestAnimationFrame(loop); this.controls.update(); this.renderer.render(this.scene, this.camera); };
    loop();
    this.resize();
  }
  resize() {
    const w = this.host.clientWidth || 800, h = this.host.clientHeight || 500;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  dispose() { this._alive = false; cancelAnimationFrame(this._raf); this.clear(); this.renderer.dispose(); this.renderer.domElement.remove(); }
  clear() { for (const m of this.meshes) { this.group.remove(m); m.geometry?.dispose?.(); if (m.material?.map) m.material.map.dispose(); m.material?.dispose?.(); } this.meshes = []; }
  // Point monde → three.js
  v(x, y, z) { return [x - this.X0, (z - this.Z0) * this.ve, -(y - this.Y0)]; }

  // Construit la scène depuis le projet dérivé D, le MNT (tin) et les options { ve, wire, halfW }.
  build(prj, D, tin, opts = {}) {
    this.clear();
    this.ve = +opts.ve || 1;
    const O = D.O || { x: 0, y: 0 };
    this.X0 = O.x; this.Y0 = O.y;
    this.Z0 = (tin ? tinZ(tin, O.x, O.y) : null) ?? (+prj.ring.zC || 0);
    if (tin) this.addTerrain(tin, opts.wire);
    const sec = sectionParams(prj), P = { ...ptParams(prj), halfW: opts.halfW || ptParams(prj).halfW };
    if (D.kind === 'giratoire') this.addRing(prj, D);
    else if (D.main && D.zMain) this.addMain(prj, D, tin, sec, P);
    for (const bd of D.branches) if (bd.zAt && bd.role !== 'principale') this.addBranch(prj, D, bd, tin, sec, P);
    this.addSigns(D, tin);
    this.overview(D);
  }

  addMesh(geo, color, opts = {}) {
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, vertexColors: !!opts.vertexColors, polygonOffset: !!opts.offset, polygonOffsetFactor: opts.offset ? -2 : 0, polygonOffsetUnits: opts.offset ? -2 : 0, wireframe: !!opts.wire });
    const m = new THREE.Mesh(geo, mat); m.name = opts.name || '';
    this.group.add(m); this.meshes.push(m);
    return m;
  }

  // Terrain : triangles du TIN, couleur par altitude.
  addTerrain(tin, wire) {
    const tris = tinTriangles(tin), pos = [], col = [];
    const c0 = new THREE.Color(COLORS.terrain[0]), c1 = new THREE.Color(COLORS.terrain[1]), c2 = new THREE.Color(COLORS.terrain[2]);
    const span = Math.max(1e-6, tin.zmax - tin.zmin);
    for (const t of tris) for (const q of t) {
      pos.push(...this.v(q.x, q.y, q.z));
      const f = (q.z - tin.zmin) / span, c = f < 0.5 ? c0.clone().lerp(c1, f * 2) : c1.clone().lerp(c2, (f - 0.5) * 2);
      col.push(c.r, c.g, c.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.addMesh(geo, 0xffffff, { vertexColors: true, wire, name: 'terrain' });
  }

  // Grille (s × y) → maillage par nature de surface : cells[k][j] = { z, kind } ; les cellules sans nature sont omises.
  addGrid(rows, ys, pts, name) {
    // rows : [{ z: [], kind: [] }] pour chaque station ; pts : [[x, y] monde pour chaque (station, y)]
    const byKind = new Map();
    for (let k = 0; k + 1 < rows.length; k++) for (let j = 0; j + 1 < ys.length; j++) {
      const a = rows[k], b = rows[k + 1];
      const kind = a.kind[j + 1] ?? a.kind[j] ?? b.kind[j + 1] ?? b.kind[j];
      if (!kind) continue;
      const z = [a.z[j], a.z[j + 1], b.z[j + 1], b.z[j]];
      if (z.some((v) => v == null)) continue;
      const p = [pts[k][j], pts[k][j + 1], pts[k + 1][j + 1], pts[k + 1][j]];
      if (!byKind.has(kind)) byKind.set(kind, []);
      const arr = byKind.get(kind);
      const q = p.map((pp, i) => this.v(pp[0], pp[1], z[i]));
      arr.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
    }
    for (const [kind, arr] of byKind) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      this.addMesh(geo, kindColor(kind), { offset: kind !== 'talus', name: `${name}:${kind}` });
    }
  }

  // Branche : sections tous les 2 m (1 m près du carrefour), échantillonnées tous les 0,5 m en travers.
  addBranch(prj, D, bd, tin, sec, P) {
    const sEnd = axisLength(bd), ys = [];
    for (let y = -P.halfW; y <= P.halfW + 1e-9; y += 0.5) ys.push(Math.round(y * 100) / 100);
    const rows = [], pts = [];
    for (let s = 0.2; s <= sEnd + 1e-9; s += s < 30 ? 1 : 2) {
      let cs;
      try { cs = crossSectionFrom(platform(prj, bd, s, sec), tin, P); } catch { continue; }
      const sm = sampleSection(cs, ys);
      rows.push(sm);
      pts.push(ys.map((y) => { const q = G.add(cs.p, G.mul(cs.n, y)); return [q.x, q.y]; }));
    }
    this.addGrid(rows, ys, pts, bd.name);
  }

  // Route principale d'un carrefour plan : sections le long de l'axe principal (hors débouchés : tout le long, la
  // chaussée des secondaires se superpose).
  addMain(prj, D, tin, sec, P) {
    const M = D.main, LA = D.plan.LA, LB = D.plan.LB, ys = [];
    for (let y = -P.halfW; y <= P.halfW + 1e-9; y += 0.5) ys.push(Math.round(y * 100) / 100);
    const rows = [], pts = [];
    for (let X = -LA; X <= LB + 1e-9; X += 2) {
      const cs = crossSectionFrom(mainPlatform(prj, D, X, sec), tin, P);
      rows.push(sampleSection(cs, ys));
      pts.push(ys.map((y) => { const q = M.toW(X, y); return [q.x, q.y]; }));
    }
    this.addGrid(rows, ys, pts, 'principale');
  }

  // Anneau : surface de révolution du profil radial type (îlot central, bande franchissable, anneau, BDD, abords),
  // posée sur le modèle altimétrique zRing au bord Rg.
  addRing(prj, D) {
    const prof = ringProfile(prj, D), O = D.O, zR = D.zRing;
    const line = prof.line, parts = prof.parts;
    const zrel = (r) => { let z = -Infinity; for (let i = 0; i + 1 < line.length; i++) { const [x0, z0] = line[i], [x1, z1] = line[i + 1]; if (r < Math.min(x0, x1) - 1e-9 || r > Math.max(x0, x1) + 1e-9) continue; z = Math.max(z, Math.abs(x1 - x0) < 1e-9 ? Math.max(z0, z1) : z0 + ((r - x0) / (x1 - x0)) * (z1 - z0)); } return z; };
    const kindR = (r) => { const p = parts.find((q) => r >= q.x0 - 1e-9 && r <= q.x1 + 1e-9); const l = p?.label || ''; return /îlot/.test(l) ? 'ilot' : /franchissable/.test(l) ? 'franchissable' : /BDG/.test(l) ? 'bdg' : /anneau/.test(l) ? 'anneau' : /BDD/.test(l) ? 'bdd' : /trottoir/.test(l) ? 'trottoir' : /berme/.test(l) ? 'berme' : /caniveau/.test(l) ? 'chaussee' : 'bordure'; };
    const rs = [0]; for (const [r] of line) if (r > rs[rs.length - 1] + 1e-6) rs.push(r);
    const zTop = zrel(line[0][0]);
    const N = 144, rows = [], pts = [];
    for (let j = 0; j <= N; j++) {
      const phi = (j / N) * Math.PI * 2, base = zR(G.polar(O, D.Rg, phi)) - 0; // cote du bord Rg à cet azimut
      const z = [], kind = [];
      rs.forEach((r, i) => { z.push(base + (r < line[0][0] ? zTop : zrel(r))); kind.push(i === 0 ? 'ilot' : kindR((rs[i - 1] + r) / 2)); });
      rows.push({ z, kind });
      pts.push(rs.map((r) => { const q = G.polar(O, Math.max(r, 0.01), phi); return [q.x, q.y]; }));
    }
    // addGrid attend kind[j+1] pour la cellule j : décalage fait ci-dessus (kind[i] = nature entre rs[i-1] et rs[i]).
    this.addGrid(rows, rs, pts, 'anneau');
  }

  // Panneaux : mât cylindrique et face texturée (pictogramme) orientée vers les usagers concernés.
  addSigns(D, tin) {
    const loader = new THREE.TextureLoader();
    for (const sg of D.signs || []) {
      const bd = D.branches.find((q) => q.idx === sg.bi);
      let zg = bd?.zAt ? bd.zAt(sg.p) : null;
      if (zg == null || !Number.isFinite(zg)) zg = tin ? tinZ(tin, sg.p.x, sg.p.y) : null;
      if (zg == null) zg = D.zRing ? D.zRing(sg.p) : this.Z0;
      const h = sg.h || 1, w = sg.w || 1;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, (h + w) * this.ve, 8), new THREE.MeshLambertMaterial({ color: 0x9a9a9a }));
      const [mx, my, mz] = this.v(sg.p.x, sg.p.y, zg);
      mast.position.set(mx, my + ((h + w) * this.ve) / 2, mz); mast.name = `mat:${sg.code}`;
      this.group.add(mast); this.meshes.push(mast);
      const tex = loader.load('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(signSVG(sg.code, 256)));
      tex.colorSpace = THREE.SRGBColorSpace;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
      const f = sg.face || { x: 1, y: 0 };
      panel.position.set(mx + f.x * 0.06, my + (h + w / 2) * this.ve, mz - f.y * 0.06);
      panel.rotation.y = Math.atan2(f.x, -f.y);
      panel.name = `panneau:${sg.code}`;
      this.group.add(panel); this.meshes.push(panel);
    }
  }

  overview(D) {
    const R = Math.max(60, (D?.zoomR || 60) * 1.2);
    this.camera.position.set(R * 0.9, R * 0.8, R * 0.9);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
  // Vue conducteur : sur la branche bd, à s mètres du carrefour, au milieu de la voie d'entrée, œil à 1,10 m.
  driver(D, bd, s) {
    const yLane = (bd.hb || 0) + (bd.entry?.wa ?? bd.entry?.w ?? 3.5) / 2;
    const { p, t } = axisPointAt(bd, s), n = G.rot90(t);
    const eye = G.add(p, G.mul(n, yLane)), ahead = G.add(eye, G.mul(t, -40));
    const z = bd.zAt ? bd.zAt(eye) : this.Z0, z2 = bd.zAt ? bd.zAt(ahead) : this.Z0;
    const [ex, ey, ez] = this.v(eye.x, eye.y, z), [ax, ay, az] = this.v(ahead.x, ahead.y, z2);
    this.camera.position.set(ex, ey + 1.1 * this.ve, ez);
    this.controls.target.set(ax, ay + 1.1 * this.ve, az);
    this.controls.update();
  }
  snapshot() { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/png'); }
  // OBJ : un groupe par maillage, coordonnées monde (X, Y, Z en mètres, exagération retirée).
  exportOBJ(name = 'carrefour') {
    const out = [`# GIRA — ${name} — X Y Z (m)`], ve = this.ve;
    let off = 1;
    for (const m of this.meshes) {
      const g = m.geometry, pos = g.getAttribute('position'); if (!pos) continue;
      out.push(`o ${m.name || 'mesh'}`);
      m.updateMatrixWorld();
      const vtx = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        vtx.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        out.push(`v ${(vtx.x + this.X0).toFixed(3)} ${(-vtx.z + this.Y0).toFixed(3)} ${(vtx.y / ve + this.Z0).toFixed(3)}`);
      }
      const idx = g.getIndex();
      if (idx) for (let i = 0; i + 2 < idx.count; i += 3) out.push(`f ${off + idx.getX(i)} ${off + idx.getX(i + 1)} ${off + idx.getX(i + 2)}`);
      else for (let i = 0; i + 2 < pos.count; i += 3) out.push(`f ${off + i} ${off + i + 1} ${off + i + 2}`);
      off += pos.count;
    }
    return out.join('\n') + '\n';
  }
}
