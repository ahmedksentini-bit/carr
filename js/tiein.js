// Raccordement d'une branche aux limites de chaussée existantes (fond DXF) : deux clics sur les deux bords de la
// voirie existante → section perpendiculaire (milieu M, largeur w, direction de la voie vers l'extérieur), puis
// extrémité d'axe en M, largeurs de voie et BDD (surlargeur) calées sur w, longueur de branche jusqu'à M.
// Double sens conservé : la largeur est partagée entre les voies entrantes et sortantes.
import * as G from './geom.js';

// Point d'un trait DXF (calques visibles) le plus proche de p, à moins de rMax ; tangente unitaire du segment.
export function nearestOnDxf(geo, p, rMax = 3) {
  let best = rMax, out = null;
  const vis = (l) => geo.layers?.get?.(l)?.visible !== false;
  const scan = (a, closed, layer, ref) => {
    const n = a.length / 2, m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % n, ax = a[2 * i], ay = a[2 * i + 1], dx = a[2 * j] - ax, dy = a[2 * j + 1] - ay, L2 = dx * dx + dy * dy;
      if (!(L2 > 1e-12)) continue;
      const t = G.clamp(((p.x - ax) * dx + (p.y - ay) * dy) / L2, 0, 1), qx = ax + t * dx, qy = ay + t * dy, d = Math.hypot(p.x - qx, p.y - qy);
      if (d < best) { const l = Math.sqrt(L2); best = d; out = { p: { x: qx, y: qy }, t: { x: dx / l, y: dy / l }, layer, ref, d }; }
    }
  };
  for (const q of geo.polys || []) if (vis(q.layer)) {
    const a = q.pts; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < a.length; i += 2) { if (a[i] < x0) x0 = a[i]; if (a[i] > x1) x1 = a[i]; if (a[i + 1] < y0) y0 = a[i + 1]; if (a[i + 1] > y1) y1 = a[i + 1]; }
    if (p.x < x0 - rMax || p.x > x1 + rMax || p.y < y0 - rMax || p.y > y1 + rMax) continue;
    scan(a, q.closed, q.layer, q);
  }
  // contours de hachures (façades du bâti hachuré…)
  for (const h of geo.hatches || []) if (vis(h.layer)) for (const r of h.rings) scan(r, true, h.layer, { pts: r, closed: true });
  return out;
}

// Intersection de la droite (A, n) avec un trait (Float64Array), la plus proche de A (abscisse signée sur n).
function lineHit(A, n, q) {
  const a = q.pts, N = a.length / 2, m = q.closed ? N : N - 1;
  let best = null;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % N, P = { x: a[2 * i], y: a[2 * i + 1] }, e = { x: a[2 * j] - P.x, y: a[2 * j + 1] - P.y };
    const den = G.cross(n, e);
    if (Math.abs(den) < 1e-12) continue;
    const w = G.sub(P, A), s = G.cross(w, e) / den, u = G.cross(w, n) / den;
    if (u >= -1e-9 && u <= 1 + 1e-9 && (!best || Math.abs(s) < Math.abs(best))) best = s;
  }
  return best;
}

// Section de la voirie existante entre deux bords cliqués. O : centre du carrefour (oriente la voie vers l'extérieur).
export function tieSection(e1, e2, O) {
  if (!e1 || !e2) return { error: 'cliquez sur les deux limites de chaussée (traits du fond DXF)' };
  let t = e1.t;
  const t2 = G.dot(e1.t, e2.t) < 0 ? G.neg(e2.t) : e2.t;
  if (Math.abs(G.dot(e1.t, e2.t)) < Math.cos((35 * Math.PI) / 180)) return { error: 'les deux limites ne sont pas sensiblement parallèles (écart > 35°)' };
  t = G.norm(G.add(t, t2));
  const n = G.rot90(t);
  // largeur perpendiculaire au droit du premier clic (sur le trait du second bord, sinon par projection)
  let s = e2.ref ? lineHit(e1.p, n, e2.ref) : null;
  if (s == null || Math.abs(Math.abs(s) - Math.abs(G.dot(G.sub(e2.p, e1.p), n))) > 3) s = G.dot(G.sub(e2.p, e1.p), n);
  const w = Math.abs(s);
  if (w < 2.5) return { error: `largeur ${w.toFixed(2)} m : les deux clics sont sur le même bord ?` };
  const M = G.add(e1.p, G.mul(n, s / 2));
  if (O && G.dot(G.sub(M, O), t) < 0) t = G.neg(t);
  return { M, t, w, A: e1.p, B: G.add(e1.p, G.mul(n, s)) };
}

// Largeurs : w partagée entre nIn + nOut voies ; au-delà de vMax (3,75 m) par voie, voies de 3,50 m et le reste en
// BDD (surlargeur) de part et d'autre.
export function tieLanes(w, nIn = 1, nOut = 1, vMax = 3.75, vStd = 3.5) {
  const n = Math.max(1, +nIn || 1) + Math.max(1, +nOut || 1), r2 = (v) => Math.round(v * 100) / 100;
  if (w / n <= vMax + 1e-9) return { wLane: r2(w / n), bdd: 0 };
  return { wLane: vStd, bdd: r2((w - vStd * n) / 2) };
}

// Nouvel axe : prolongement de 30 m au-delà de M (la courbe d'approche doit pouvoir rejoindre l'axe ; la branche s'arrête en M) dans la direction de la voie, M, puis les sommets saisis situés en
// deçà de M (côté carrefour), dans l'ordre extérieur → carrefour.
export function tieAxis(axis, M, t, O) {
  const dM = G.dist(M, O);
  const keep = (axis || []).filter((p) => G.dist(p, O) < dM - 2 && G.dot(G.sub(p, M), t) < -1);
  const r3 = (p) => ({ ...p, x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 });
  const pts = [G.add(M, G.mul(t, 30)), M, ...keep].map(r3);
  if (pts.length < 3) pts.push(r3(G.add(O, G.mul(G.norm(G.sub(M, O)), Math.min(dM - 5, Math.max(5, dM / 2))))));
  return pts;
}

// Variante « orientation conservée » : l'axe saisi n'est pas modifié ; le raccordement se fait au point de l'axe le
// plus proche du milieu M de la section (axe prolongé de 30 m s'il s'arrête avant). Écart latéral axe ↔ milieu
// renvoyé (décalage de l'axe par rapport à la voirie existante).
export function tieKeepAxis(axis, M) {
  const a = axis || [];
  if (a.length < 2) return null;
  let best = null;
  for (let i = 0; i + 1 < a.length; i++) {
    const P = a[i], Q = a[i + 1], d = G.sub(Q, P), L2 = G.dot(d, d);
    if (!(L2 > 0)) continue;
    const t = G.dot(G.sub(M, P), d) / L2, tc = i === 0 ? Math.min(1, t) : G.clamp(t, 0, 1); // au-delà de l'extrémité extérieure : prolongement
    const p = G.add(P, G.mul(d, tc)), dd = G.dist(p, M);
    if (!best || dd < best.d) best = { p, d: dd, i, t: tc };
  }
  const out = a.map((q) => ({ ...q }));
  if (best.i === 0 && best.t < 0.05) { // le raccordement est au-delà (ou tout près) de l'extrémité saisie : axe prolongé
    const u = G.norm(G.sub(a[0], a[1]));
    const far = G.add(best.p, G.mul(u, 30));
    out[0] = { ...out[0], x: Math.round(far.x * 1000) / 1000, y: Math.round(far.y * 1000) / 1000 };
  }
  return { axis: out, M: best.p, offset: best.d };
}
