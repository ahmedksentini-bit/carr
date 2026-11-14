// sight3d.js — visibilité 3D le long d'un corridor (portage du module de BVTrace : Sight3DEngine, Sight3DScan,
// SightPath, FinishedSurface, guide Visibilité Cerema 2018).
//
// Une seule ligne de visée œil → cible dans l'espace, sur la SURFACE FINIE (plateforme et talus des profils en travers
// calculés, terrain naturel au-delà) : elle capte ensemble le masque vertical (angle saillant du profil en long) et le
// masque latéral (talus de déblai, terrain en virage), y compris leurs combinaisons qu'un contrôle séparé plan / profil
// laisse passer. Œil à 1,10 m sur la voie du conducteur (axe de la voie − 0,25 m, à droite de son sens) ; cible à la
// hauteur conventionnelle de l'obstacle (0,50 m route non isolée). Distance disponible = arc parcouru le long de la
// trajectoire jusqu'au premier point qui cesse d'être vu ; comparée station par station à la distance d'arrêt requise
// (pente locale, sens de parcours).

export const EYE_H = 1.1;
export const TARGETS = { 0.5: 'obstacle 0,50 m (route non isolée)', 0.7: 'obstacle 0,70 m (route isolée)', 0.85: 'obstacle 0,85 m (chaussées séparées)', 0.15: 'chute de pierres 0,15 m' };

// Distance d'arrêt (guide Visibilité Cerema 2018) : d = NPV · (1,8 v + v² / (2 g (γ − p))), γ = 0,46 / 0,44 / 0,41 pour
// V ≤ 50 / ≤ 70 / > 70 km/h, p = pente algébrique dans le sens de parcours (descente < 0 allonge d), NPV A 1,1 / B 1 / C 0,9.
export function stopDistCerema(V, grade = 0, npv = 'B') {
  if (!(V > 0)) return 0;
  const v = V / 3.6, g = V <= 50 ? 0.46 : V <= 70 ? 0.44 : 0.41, f = { A: 1.1, B: 1, C: 0.9 }[npv] ?? 1;
  const den = Math.max(1e-6, 2 * 9.81 * (g + grade));
  return f * (1.8 * v + (v * v) / den);
}

// Surface finie d'un ou plusieurs axes : coupes { s, p, t, n, proj: [{ y, z }] } (y le long de n). Hors de l'emprise
// des coupes : null (le terrain prend le relais).
export function finishedSurface(axesSections, cell = 25) {
  const secs = [], grid = new Map();
  for (const list of axesSections) {
    const L = list.filter((c) => c.proj?.length >= 2).sort((a, b) => a.s - b.s).map((c) => ({ ...c, proj: [...c.proj].sort((a, b) => a.y - b.y) }));
    L.forEach((c, i) => { c.prev = L[i - 1] || null; c.next = L[i + 1] || null; secs.push(c); });
  }
  const key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  for (const c of secs) {
    const y0 = c.proj[0].y, y1 = c.proj[c.proj.length - 1].y, sp = Math.max(c.next ? c.next.s - c.s : 0, c.prev ? c.s - c.prev.s : 0, 5);
    // la coupe est inscrite sur toute sa bande (largeur de l'emprise, ± demi-intervalle entre coupes)
    for (let a = -sp / 2; a <= sp / 2 + 1e-9; a += cell / 2) for (let y = y0; y <= y1 + 1e-9; y += cell / 2) {
      const k = key(c.p.x + c.t.x * a + c.n.x * y, c.p.y + c.t.y * a + c.n.y * y);
      let g = grid.get(k); if (!g) grid.set(k, (g = new Set())); g.add(c);
    }
  }
  const zAtY = (proj, y) => {
    if (y < proj[0].y - 1e-9 || y > proj[proj.length - 1].y + 1e-9) return null;
    for (let i = 1; i < proj.length; i++) if (y <= proj[i].y + 1e-9) { const d = proj[i].y - proj[i - 1].y; return d < 1e-12 ? proj[i].z : proj[i - 1].z + ((proj[i].z - proj[i - 1].z) * (y - proj[i - 1].y)) / d; }
    return proj[proj.length - 1].z;
  };
  return {
    count: secs.length,
    heightAt(x, y) {
      const g = grid.get(key(x, y)); if (!g) return null;
      let best = null, ba = Infinity;
      for (const c of g) { const a = (x - c.p.x) * c.t.x + (y - c.p.y) * c.t.y; if (Math.abs(a) < ba) { ba = Math.abs(a); best = { c, a }; } }
      if (!best) return null;
      const { c, a } = best, o = a >= 0 ? c.next : c.prev;
      const zi = zAtY(c.proj, (x - c.p.x) * c.n.x + (y - c.p.y) * c.n.y);
      if (!o) return Math.abs(a) < 1 ? zi : null;
      const ao = (x - o.p.x) * o.t.x + (y - o.p.y) * o.t.y, zo = zAtY(o.proj, (x - o.p.x) * o.n.x + (y - o.p.y) * o.n.y);
      if (zi == null || zo == null) return null; // bord de l'emprise : le terrain traitera au-delà
      const tt = Math.abs(a - ao) < 1e-9 ? 0 : Math.min(1, Math.max(0, a / (a - ao)));
      return zi + (zo - zi) * tt;
    },
  };
}
// Première couche qui répond (surface finie puis terrain).
export const composite = (...layers) => ({ heightAt: (x, y) => { for (const l of layers) { if (!l) continue; const z = l.heightAt(x, y); if (z != null && Number.isFinite(z)) return z; } return null; } });

// Droite œil → cible dégagée ? (échantillons strictement intérieurs) ; rise = dépassement maximal.
export function lineClear(eye, tg, surf, step = 5) {
  const d = Math.hypot(tg.x - eye.x, tg.y - eye.y); if (d < 1e-6) return { clear: true, rise: 0 };
  const n = Math.max(1, Math.ceil(d / Math.max(0.25, step)));
  let rise = 0, clear = true;
  for (let k = 1; k < n; k++) {
    const t = k / n, x = eye.x + (tg.x - eye.x) * t, y = eye.y + (tg.y - eye.y) * t, lz = eye.z + (tg.z - eye.z) * t, sz = surf.heightAt(x, y);
    if (sz != null && sz > lz + 1e-9) { clear = false; rise = Math.max(rise, sz - lz); }
  }
  return { clear, rise };
}

// Distance de visée disponible : arc le long de la trajectoire (cibles) jusqu'au premier point caché.
export function available(eye, path, surf, sampleStep = 5) {
  let arc = 0, prev = eye;
  for (const tg of path) {
    const seg = Math.hypot(tg.x - prev.x, tg.y - prev.y), r = lineClear(eye, tg, surf, sampleStep);
    if (!r.clear) return { avail: arc, blocked: true, hidden: tg, rise: r.rise };
    arc += seg; prev = tg;
  }
  return { avail: arc, blocked: false, end: true };
}

// Balayage : ax { len, at(s) → { p, t } }, zAt(s) cote projet, reqAt(s, dir) distance requise, laneOff déport (> 0) de
// l'œil depuis l'axe, à droite du sens de parcours. Verdicts { s, dir, avail, req, status: 'ok' | 'ko' | 'nd', sBlock }.
export function scanAxis(ax, zAt, surf, reqAt, laneOff, o = {}) {
  const { eyeH = EYE_H, tgtH = 0.5, step = 10, pathStep = 15, sampleStep = 5, s0 = 0, s1 = ax.len } = o;
  const P = (s, off, h) => { const { p, t } = ax.at(s), z = zAt(s); if (z == null || !Number.isFinite(z)) return null; return { x: p.x + t.y * off, y: p.y - t.x * off, z: z + h }; };
  const out = [];
  for (let s = s0; s <= s1 + 1e-9; s += step) {
    for (const dir of [1, -1]) {
      const req = Math.max(1, reqAt(s, dir)), scan = Math.max(req * 1.2, req + 20), off = dir * Math.abs(laneOff);
      const eye = P(s, off, eyeH); if (!eye) continue;
      const path = [];
      for (let d = pathStep; d <= scan + 1e-9; d += pathStep) { const q = s + dir * d; if (q < -1e-6 || q > ax.len + 1e-6) break; const tg = P(q, off, tgtH); if (tg) path.push(tg); }
      if (!path.length) continue;
      const r = available(eye, path, surf, sampleStep);
      const status = r.avail + 1e-6 >= req ? 'ok' : r.blocked ? 'ko' : 'nd';
      out.push({ s, dir, avail: r.avail, req, status, sBlock: r.blocked && r.hidden ? s + dir * Math.hypot(r.hidden.x - eye.x, r.hidden.y - eye.y) : null });
    }
  }
  return out;
}

// Tronçons continus d'insuffisance pour un sens (fusion des stations voisines).
export function insufficientRuns(verdicts, dir, step = 10) {
  const runs = [], gap = Math.max(1, step) * 1.5;
  let from = null, last = null, worst = null;
  const close = () => { if (from != null) runs.push({ from, to: last, worst }); from = last = worst = null; };
  for (const v of verdicts.filter((q) => q.dir === dir).sort((a, b) => a.s - b.s)) {
    if (v.status === 'ko') {
      if (from != null && v.s - last > gap) close();
      if (from == null) from = v.s;
      last = v.s; if (!worst || v.avail / v.req < worst.avail / worst.req) worst = v;
    } else close();
  }
  close();
  return runs;
}
