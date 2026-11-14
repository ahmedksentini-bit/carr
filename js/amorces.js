// amorces.js — amorces : simples accès qui raccordent une voie secondaire (ou une desserte) au bord de la chaussée
// d'une route du projet, sans carrefour aménagé.
//
// Saisie : outil « Amorce », deux clics (une droite) : le premier près du bord de la route, le second à l'extrémité de
// l'amorce. Le premier point est calé sur le bord de chaussée de la route la plus proche (côté du second point) et
// suit la route si son axe est modifié. Sur le plan (outil Sélection) : surbrillance au survol, clic → menu
// Déplacer / Supprimer / Propriétés.
//
// Profil en long : TN lu sur le modèle de terrain le long de l'amorce ; projet = une droite du bord de la chaussée
// principale (cote projet de la route au bord, dévers de 2,5 % compté depuis son axe ; TN à défaut de profil en long)
// jusqu'au TN de l'extrémité.
// Profil type et métré sommaires : chaussée de largeur l à pente transversale unique, couches de la structure ;
// terrassements sur la plate-forme (fond de forme = projet − épaisseur de la structure), talus 3/2 en remblai et 1/1 en
// déblai, sans décapage ni purge.
import { tinZ } from './tin.js';

const CROSSFALL = 0.025;
const DEF_STRUCT = () => [
  { n: 'Béton bitumineux (BB 0/10)', e: 0.05 },
  { n: 'Grave concassée 0/20 (base)', e: 0.2 },
  { n: 'Grave non traitée 0/31,5 (fondation)', e: 0.25 },
];

export function initAmorces(api) {
  const { S, $, viewer, update, toast, esc, fmt, uid, listAxes, setTool, showTab } = api;
  const list = () => (S.prj.amorces = Array.isArray(S.prj.amorces) ? S.prj.amorces : []);
  const byId = (id) => list().find((q) => q.id === id);
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y }), add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y }), mul = (a, k) => ({ x: a.x * k, y: a.y * k });
  const len = (a) => Math.hypot(a.x, a.y), dist = (a, b) => len(sub(a, b)), unit = (a) => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l }; };
  const rot = (a) => ({ x: -a.y, y: a.x });
  const num = (v, d) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : d; };

  // ---------------------------------------------------------------- géométrie
  const axes = () => (S.prof?.axes || listAxes(S.prj, S.D) || []).filter((a) => a.len > 1);
  // Distance de l'axe au bord de la chaussée (voies + BDG + demi-TPC ; à défaut, demi-plate-forme de l'axe).
  const edgeOf = (ax) => {
    const H = ax.H;
    if (H && Number.isFinite(+H.lanes) && Number.isFinite(+H.wLane)) return (+H.median > 0 ? +H.median / 2 : 0) + (+H.bdg || 0) + +H.lanes * +H.wLane;
    return Number.isFinite(ax.half) ? ax.half : 3.5;
  };
  // Point de raccordement : projection de a sur la route la plus proche, porté au bord de chaussée du côté de b.
  function snap(a, b) {
    let best = null;
    for (const ax of axes()) {
      const pr = ax.project(a); if (!pr || !Number.isFinite(pr.s)) continue;
      const e = edgeOf(ax), { p, t } = ax.at(pr.s), n = rot(t);
      const c1 = add(p, mul(n, e)), c2 = add(p, mul(n, -e));
      const side = dist(c1, b) <= dist(c2, b) ? 1 : -1, q = side > 0 ? c1 : c2, d = Math.abs(dist(a, p) - e);
      if (dist(a, p) > e + 60) continue;
      if (!best || d < best.d) best = { d, ax, key: ax.key, name: ax.name, s: pr.s, side, e, p: q, t };
    }
    return best;
  }
  function geom(am) {
    const h = snap(am.a, am.b), a = h ? h.p : am.a, b = am.b, u = unit(sub(b, a)), n = rot(u), w = Math.max(2, num(am.w, 5)) / 2;
    // côté route, l'amorce s'arrête sur le bord de chaussée (coins sur la ligne du bord, amorce biaise comprise)
    let a1 = add(a, mul(n, w)), a2 = add(a, mul(n, -w));
    if (h) { const tn = h.t.x * n.x + h.t.y * n.y; if (Math.abs(tn) > 0.35) { a1 = add(a, mul(h.t, w / tn)); a2 = add(a, mul(h.t, -w / tn)); } }
    // Raccordement au bord de chaussée : de chaque côté, arc de rayon R tangent au bord de l'amorce et au bord de la
    // chaussée principale (évasement). Coin C, demi-droites d1 (le long de l'amorce) et d2 (le long du bord, en
    // s'éloignant de l'amorce) ; tangente T = R / tan(θ/2) ; aire ajoutée = R·T − R²(π − θ)/2.
    const R = Math.max(0, num(am.R, 6)), L = dist(a, b), fil = [], side = (C, sg) => {
      if (!h || R < 0.05) return { pts: [C], area: 0, T: 0 };
      let d2 = h.t; if (d2.x * n.x * sg + d2.y * n.y * sg < 0) d2 = mul(d2, -1);
      const d1 = u, cos = Math.max(-1, Math.min(1, d1.x * d2.x + d1.y * d2.y)), th = Math.acos(cos);
      if (th < 0.2 || th > Math.PI - 0.05) return { pts: [C], area: 0, T: 0 };
      let T = R / Math.tan(th / 2); const Tmax = Math.max(0, L - 0.5); let Rr = R;
      if (T > Tmax) { T = Tmax; Rr = T * Math.tan(th / 2); }
      const P1 = add(C, mul(d1, T)), P2 = add(C, mul(d2, T)), bis = unit(add(d1, d2)), O = add(C, mul(bis, Rr / Math.sin(th / 2)));
      const a0 = Math.atan2(P2.y - O.y, P2.x - O.x); let a1 = Math.atan2(P1.y - O.y, P1.x - O.x), da = a1 - a0;
      while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const k = Math.max(2, Math.ceil(Math.abs(da) / 0.12)), pts = [];
      for (let i = 0; i <= k; i++) { const t = a0 + (da * i) / k; pts.push({ x: O.x + Rr * Math.cos(t), y: O.y + Rr * Math.sin(t) }); }
      fil.push({ O, R: Rr, P1, P2, a0, da });
      return { pts, area: Rr * T - (Rr * Rr * (Math.PI - th)) / 2, T, R: Rr };
    };
    const sp = side(a1, 1), sm = side(a2, -1);
    // contour : bord de chaussée (côté +) → arc → bord + de l'amorce → extrémité → bord − → arc → bord de chaussée (côté −)
    const poly = [...sp.pts, add(b, mul(n, w)), add(b, mul(n, -w)), ...[...sm.pts].reverse()];
    return { h, a, b, u, n, L, poly, rect: [a1, add(b, mul(n, w)), add(b, mul(n, -w)), a2], fil, fillet: { area: sp.area + sm.area, R: Math.max(sp.R || 0, sm.R || 0), Rset: R } };
  }

  // ---------------------------------------------------------------- profil en long et métré
  function compute(am) {
    const g = geom(am), tin = S.tn?.tin || null, L = g.L;
    const tn = (p) => { if (!tin) return null; const z = tinZ(tin, p.x, p.y); return Number.isFinite(z) ? z : null; };
    let z0 = null, z0src = '';
    if (g.h) {
      const A = S.axpl?.get?.(g.h.key);
      if (A?.defined) { z0 = A.PL.zAt(Math.max(0, Math.min(g.h.ax.len, g.h.s))) - CROSSFALL * g.h.e; z0src = `projet de ${g.h.name} au bord`; }
    }
    if (z0 == null) { z0 = tn(g.a); z0src = z0 != null ? 'TN au bord (route sans profil en long)' : ''; }
    const zEnd = tn(g.b) ?? z0, n = Math.max(2, Math.min(400, Math.ceil(L / 0.5)));
    const pts = [];
    for (let i = 0; i <= n; i++) { const t = (L * i) / n, p = add(g.a, mul(g.u, t)); pts.push({ t, z: tn(p), zp: z0 == null ? null : z0 + ((zEnd - z0) * t) / Math.max(1e-9, L) }); }
    const struct = (am.struct || []).map((c) => ({ n: c.n, e: Math.max(0, num(c.e, 0)) })), E = struct.reduce((s, c) => s + c.e, 0), w = Math.max(2, num(am.w, 5));
    let rem = 0, deb = 0;
    if (z0 != null && tin) for (let i = 1; i < pts.length; i++) {
      const f = (q) => { if (q.z == null) return [0, 0]; const h = q.zp - E - q.z; return h > 0 ? [h * (w + 1.5 * h), 0] : [0, -h * (w - h)]; };
      const [r0, d0] = f(pts[i - 1]), [r1, d1] = f(pts[i]), dt = pts[i].t - pts[i - 1].t;
      rem += ((r0 + r1) / 2) * dt; deb += ((d0 + d1) / 2) * dt;
    }
    const grade = z0 != null && L > 0 ? ((zEnd - z0) / L) * 100 : null;
    const surf = w * L + g.fillet.area;
    return { g, pts, z0, z0src, zEnd, grade, struct, E, w, L, surf, layers: struct.map((c) => ({ ...c, v: surf * c.e })), rem, deb, hasTn: !!tin };
  }

  // ---------------------------------------------------------------- repérage, surbrillance, menu
  const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };
  function hit(px, py) {
    if (!list().length) return null;
    const [x, y] = viewer.s2w(px, py), w = { x, y }, tol = 6 / viewer.s;
    for (const am of list()) {
      const g = geom(am);
      if (inPoly(w, g.poly)) return am.id;
      const t = Math.max(0, Math.min(g.L, (w.x - g.a.x) * g.u.x + (w.y - g.a.y) * g.u.y)), q = add(g.a, mul(g.u, t));
      if (dist(q, w) < num(am.w, 5) / 2 + tol) return am.id;
    }
    return null;
  }
  function hover(px, py) {
    const id = S.amMove ? null : hit(px, py);
    if ((id || null) === (S.amHover || null)) return false;
    S.amHover = id; return true;
  }
  function closeMenu() { const m = document.getElementById('amMenu'); if (m) m.hidden = true; }
  function menu(id, cx, cy) {
    const am = byId(id); if (!am) return;
    let m = document.getElementById('amMenu');
    if (!m) { m = document.createElement('div'); m.id = 'amMenu'; m.className = 'ctxmenu'; document.body.appendChild(m); }
    const r = compute(am);
    m.innerHTML = `<div class="ttl">${esc(am.name)} · ${fmt(r.L, 1)} m × ${fmt(r.w, 2)} m${r.g.h ? ` · ${esc(r.g.h.name)}` : ''}</div>`
      + '<button data-m="move">Déplacer</button><button data-m="props">Propriétés</button><button data-m="del" class="danger">Supprimer</button>';
    m.hidden = false;
    m.style.left = `${Math.min(cx, window.innerWidth - 220)}px`; m.style.top = `${Math.min(cy, window.innerHeight - 160)}px`;
    const away = (e) => { if (!m.contains(e.target)) { closeMenu(); document.removeEventListener('pointerdown', away, true); } };
    setTimeout(() => document.addEventListener('pointerdown', away, true));
    m.onclick = (e) => {
      const b = e.target.closest('button[data-m]'); if (!b) return;
      closeMenu(); document.removeEventListener('pointerdown', away, true);
      if (b.dataset.m === 'move') startMove(am);
      else if (b.dataset.m === 'props') openProps(am.id);
      else if (b.dataset.m === 'del') remove(am.id);
    };
  }
  function remove(id) {
    const am = byId(id); if (!am) return;
    S.prj.amorces = list().filter((q) => q.id !== id);
    if (S.amSel === id) S.amSel = null; S.amHover = null;
    update({ panels: false }); render(); toast(`${am.name} supprimée.`);
  }
  function openProps(id) { S.amSel = id; showTab('amorces'); render(); viewer.invalidate(); }

  // ---------------------------------------------------------------- saisie (outil Amorce) et déplacement
  function start() { S.amA = null; setTool('amorce'); toast('Amorce : cliquez près du bord de la route, puis à l\'extrémité de l\'amorce.'); }
  function pick(w) {
    if (S.tool !== 'amorce') return;
    if (!S.amA) {
      if (!snap(w, w)) { toast('Aucune route à proximité : cliquez près du bord d\'une chaussée du projet.', 'warn'); return; }
      S.amA = w; viewer.invalidate(); return;
    }
    if (dist(w, S.amA) < 2) { toast('Amorce trop courte (2 m au moins).', 'warn'); return; }
    const nb = list().length + 1, am = { id: uid(), name: `Amorce ${nb}`, a: { ...S.amA }, b: { x: w.x, y: w.y }, w: 5, dev: 2.5, R: 6, struct: DEF_STRUCT() };
    list().push(am); S.amA = null; setTool('select');
    update({ panels: false }); openProps(am.id);
    toast(`${am.name} créée : ${fmt(geom(am).L, 1)} m.`);
  }
  function startMove(am) {
    // l'amorce suit le curseur par son milieu (au toucher : posée là où l'on touche)
    S.amMove = { id: am.id, a0: { ...am.a }, b0: { ...am.b }, from: mul(add(am.a, am.b), 0.5) };
    S.amHover = null; toast(`Déplacez ${am.name}, cliquez pour la poser (Échap : annuler).`); viewer.invalidate();
  }
  function moveTo(w) {
    const M = S.amMove; if (!M) return false;
    const am = byId(M.id); if (!am) return false;
    if (!M.from) M.from = { ...w };
    const d = sub(w, M.from); am.a = add(M.a0, d); am.b = add(M.b0, d); return true;
  }
  function drop() {
    const M = S.amMove; if (!M) return false;
    S.amMove = null; update({ panels: false }); render(); return true;
  }
  function cancel() {
    if (S.tool === 'amorce' && S.amA) { S.amA = null; viewer.invalidate(); return true; }
    const M = S.amMove; if (!M) return false;
    const am = byId(M.id); if (am) { am.a = M.a0; am.b = M.b0; }
    S.amMove = null; viewer.invalidate(); return true;
  }

  // ---------------------------------------------------------------- dessin sur le plan
  function overlay(ctx, v) {
    const path = (poly) => { ctx.beginPath(); poly.forEach((p, i) => { const [x, y] = v.w2s(p.x, p.y); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); };
    for (const am of list()) {
      const g = geom(am), hot = S.amHover === am.id || S.amMove?.id === am.id, sel = S.amSel === am.id;
      ctx.save();
      path(g.poly); ctx.fillStyle = hot ? 'rgba(250,204,21,.45)' : 'rgba(148,163,184,.55)'; ctx.fill();
      ctx.lineWidth = hot || sel ? 2.4 : 1.2; ctx.strokeStyle = hot ? '#facc15' : sel ? '#38bdf8' : '#334155'; ctx.stroke();
      const [x0, y0] = v.w2s(g.a.x, g.a.y), [x1, y1] = v.w2s(g.b.x, g.b.y);
      ctx.setLineDash([6, 4]); ctx.strokeStyle = hot ? '#a16207' : '#475569'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
      if (g.L * v.s > 40) {
        let ang = Math.atan2(y1 - y0, x1 - x0); if (Math.cos(ang) < 0) ang += Math.PI;
        ctx.translate((x0 + x1) / 2, (y0 + y1) / 2); ctx.rotate(ang);
        ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const txt = `${am.name} · ${fmt(g.L, 1)} m`, tw = ctx.measureText(txt).width;
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(-tw / 2 - 4, -8, tw + 8, 16); ctx.fillStyle = '#0f172a'; ctx.fillText(txt, 0, 0);
      }
      ctx.restore();
    }
    // aperçu de l'outil Amorce
    if (S.tool === 'amorce' && S.amA && S.cursorW) {
      const am = { a: S.amA, b: S.cursorW, w: 5 }, g = geom(am);
      ctx.save(); path(g.poly); ctx.fillStyle = 'rgba(56,189,248,.25)'; ctx.fill(); ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.5; ctx.stroke();
      const [xa, ya] = v.w2s(g.a.x, g.a.y); ctx.beginPath(); ctx.arc(xa, ya, 5, 0, Math.PI * 2); ctx.fillStyle = '#38bdf8'; ctx.fill(); ctx.restore();
    }
  }

  // ---------------------------------------------------------------- onglet : propriétés, profil type, profil en long, métré
  function typeSvg(r, dev) {
    const W = 460, H = 160, w = r.w, k = Math.min(170 / (w + 1), 40), top = 46, x0 = 20;
    const kz = Math.min(160, 75 / Math.max(r.E, 0.2)), d = (dev / 100) * w * k; // couches exagérées ; dévers à l'échelle
    const cols = ['#334155', '#a8a29e', '#d6d3d1', '#e7e5e4', '#f5f5f4'];
    const X = (x) => x0 + (x + 1.2) * k; // x : 0 au bord gauche
    let y = 0, s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,sans-serif" font-size="10"><rect width="${W}" height="${H}" fill="#fff"/>`;
    r.struct.forEach((c, i) => {
      const h = c.e * kz, ya = top + y, yb = ya + h, m = 1.5 * k * (y / kz), m2 = 1.5 * k * ((y + h) / kz); // talus 3/2 des couches
      s += `<path d="M${X(0) - m},${ya}L${X(w) + m},${ya + d}L${X(w) + m2},${yb + d}L${X(0) - m2},${yb}Z" fill="${cols[i % cols.length]}" stroke="#475569" stroke-width="0.6"/>`;
      s += `<path d="M${X(w) + m2 + 2},${(ya + yb) / 2 + d}H${X(w) + 40}" stroke="#94a3b8" stroke-width="0.6"/><text x="${X(w) + 44}" y="${(ya + yb) / 2 + d + 3}" fill="#0f172a">${esc(c.n)} — ${fmt(c.e * 100, 0)} cm</text>`;
      y += h;
    });
    s += `<path d="M${X(0)},${top - 14}H${X(w)}M${X(0)},${top - 18}v8M${X(w)},${top - 18}v8" stroke="#0369a1"/>`;
    s += `<text x="${(X(0) + X(w)) / 2}" y="${top - 20}" text-anchor="middle" fill="#0369a1">l = ${fmt(w, 2)} m · pente ${fmt(dev, 1)} %</text>`;
    s += `<text x="8" y="${H - 8}" fill="#64748b">Profil type sommaire — épaisseur totale ${fmt(r.E * 100, 0)} cm (épaisseurs exagérées)</text>`;
    return s + '</svg>';
  }
  function plSvg(r) {
    const W = 420, H = 170, M = { l: 44, r: 10, t: 12, b: 26 }, pts = r.pts, zs = pts.flatMap((q) => [q.z, q.zp]).filter(Number.isFinite);
    if (!zs.length) return '<p class="note">Pas de modèle de terrain ni de cote de la route : profil en long indisponible.</p>';
    let z0 = Math.min(...zs), z1 = Math.max(...zs); if (z1 - z0 < 1) { const m = (z0 + z1) / 2; z0 = m - 0.5; z1 = m + 0.5; }
    const X = (t) => M.l + (t / Math.max(1e-9, r.L)) * (W - M.l - M.r), Y = (z) => M.t + (1 - (z - z0) / (z1 - z0)) * (H - M.t - M.b);
    const line = (key, st) => { const q = pts.filter((p) => Number.isFinite(p[key])); return q.length > 1 ? `<polyline fill="none" ${st} points="${q.map((p) => `${X(p.t).toFixed(1)},${Y(p[key]).toFixed(1)}`).join(' ')}"/>` : ''; };
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,sans-serif" font-size="10"><rect width="${W}" height="${H}" fill="#fff"/>`;
    for (let i = 0; i <= 4; i++) { const z = z0 + ((z1 - z0) * i) / 4; s += `<path d="M${M.l},${Y(z)}H${W - M.r}" stroke="#e2e8f0"/><text x="${M.l - 4}" y="${Y(z) + 3}" text-anchor="end" fill="#64748b">${fmt(z, 2)}</text>`; }
    s += line('z', 'stroke="#92400e" stroke-width="1.4"') + line('zp', 'stroke="#dc2626" stroke-width="2"');
    s += `<text x="${M.l}" y="${H - 8}" fill="#64748b">0 (bord de chaussée)</text><text x="${W - M.r}" y="${H - 8}" text-anchor="end" fill="#64748b">${fmt(r.L, 1)} m</text>`;
    s += `<text x="${W - M.r}" y="${M.t + 8}" text-anchor="end"><tspan fill="#92400e">— TN</tspan>  <tspan fill="#dc2626">— projet${r.grade != null ? ` ${fmt(r.grade, 2)} %` : ''}</tspan></text>`;
    return s + '</svg>';
  }
  function render() {
    const host = $('#amProps'); if (!host) return;
    const n = list().length;
    $('#amSummary').textContent = n ? `${n} amorce(s) sur le plan. Cliquez une amorce pour la déplacer, la supprimer ou afficher ses propriétés.` : 'Aucune amorce : tracez-en une avec le bouton ci-dessus.';
    const am = byId(S.amSel);
    if (!am) { host.innerHTML = ''; return; }
    const r = compute(am), dev = num(am.dev, 2.5);
    const kv = (rows) => '<div class="kv"><dl>' + rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('') + '</dl></div>';
    host.innerHTML = `<h3>${esc(am.name)}</h3>
      <div class="fields">
        <label class="fld">Nom <input data-af="name" value="${esc(am.name)}"></label>
        <label class="fld">Largeur (m) <input data-af="w" value="${fmt(r.w, 2)}" inputmode="decimal"></label>
        <label class="fld">Pente transversale (%) <input data-af="dev" value="${fmt(dev, 1)}" inputmode="decimal"></label>
        <label class="fld">Rayon de raccordement au bord de chaussée (m) <input data-af="R" value="${fmt(num(am.R, 6), 1)}" inputmode="decimal"></label>
      </div>
      ${kv([
        ['Longueur', `${fmt(r.L, 2)} m`],
        ['Raccordée à', r.g.h ? `${esc(r.g.h.name)}, abscisse ${fmt(r.g.h.s, 2)} m, côté ${r.g.h.side > 0 ? 'gauche' : 'droit'}` : '—'],
        ['Cote au bord de chaussée', r.z0 != null ? `${fmt(r.z0, 3)} m (${esc(r.z0src)})` : '—'],
        ['Cote à l\'extrémité (TN)', r.zEnd != null ? `${fmt(r.zEnd, 3)} m` : '—'],
        ['Pente du projet', r.grade != null ? `${fmt(r.grade, 2)} %` : '—'],
      ])}
      <h4>Structure de chaussée</h4>
      <div class="am-struct">${r.struct.map((c, i) => `<div class="row"><input data-al="${i}" data-k="n" value="${esc(c.n)}" style="flex:1"><input data-al="${i}" data-k="e" value="${fmt(c.e * 100, 0)}" inputmode="decimal" style="width:4.5em"> cm <button data-am="dl" data-i="${i}" title="Retirer la couche">✕</button></div>`).join('')}
      <div class="row"><button data-am="al">+ Couche</button></div></div>
      <h4>Profil type</h4>${typeSvg(r, dev)}
      <h4>Profil en long</h4>${plSvg(r)}
      <h4>Métré</h4>${kv([
        ['Surface de chaussée', `${fmt(r.surf, 1)} m² (dont raccordements ${fmt(r.g.fillet.area, 1)} m²${r.g.fillet.R > 0 && r.g.fillet.R < r.g.fillet.Rset - 0.05 ? `, rayon réduit à ${fmt(r.g.fillet.R, 1)} m faute de longueur` : ''})`],
        ...r.layers.map((c) => [esc(c.n), `${fmt(c.v, 2)} m³ (${fmt(c.e * 100, 0)} cm × ${fmt(r.surf, 1)} m²)`]),
        ['Remblai', r.hasTn ? `${fmt(r.rem, 1)} m³` : '— (pas de modèle de terrain)'],
        ['Déblai', r.hasTn ? `${fmt(r.deb, 1)} m³` : '— (pas de modèle de terrain)'],
      ])}
      <p class="note">Métré sommaire : couches sur la largeur l, terrassements jusqu'au fond de forme (projet − ${fmt(r.E * 100, 0)} cm), talus 3/2 en remblai et 1/1 en déblai, sans décapage ni purge.</p>
      <div class="row"><button data-am="move">Déplacer</button><button data-am="del" class="danger">Supprimer</button></div>`;
  }
  function bind() {
    $('#btnAmNew')?.addEventListener('click', start);
    const host = $('#amProps'); if (!host) return;
    const live = (e, commit) => {
      const am = byId(S.amSel); if (!am) return;
      const f = e.target.dataset.af, li = e.target.dataset.al;
      if (f === 'name') { am.name = e.target.value || am.name; if (commit) { update({ panels: false }); render(); } viewer.invalidate(); return; }
      if (f === 'w') { const v = num(e.target.value, null); if (v != null && v >= 2 && v <= 30) am.w = v; }
      else if (f === 'dev') { const v = num(e.target.value, null); if (v != null && v >= 0 && v <= 10) am.dev = v; }
      else if (f === 'R') { const v = num(e.target.value, null); if (v != null && v >= 0 && v <= 30) am.R = v; }
      else if (li != null) { const c = am.struct[+li]; if (!c) return; if (e.target.dataset.k === 'n') c.n = e.target.value; else { const v = num(e.target.value, null); if (v != null && v >= 0) c.e = v / 100; } }
      else return;
      viewer.invalidate();
      if (commit) { update({ panels: false }); render(); } else refreshFigures();
    };
    // en temps réel pendant la saisie : seuls le profil type et le métré sont recalculés (le champ garde le focus)
    const refreshFigures = () => { const keep = document.activeElement, sel = keep?.dataset ? { ...keep.dataset } : null; render(); if (sel) { const q = host.querySelector(sel.af ? `[data-af="${sel.af}"]` : sel.al != null ? `[data-al="${sel.al}"][data-k="${sel.k}"]` : null); if (q) { q.focus(); const v = q.value; q.value = ''; q.value = v; } } };
    host.addEventListener('input', (e) => live(e, false));
    host.addEventListener('change', (e) => live(e, true));
    host.addEventListener('click', (e) => {
      const b = e.target.closest('[data-am]'); if (!b) return;
      const am = byId(S.amSel); if (!am) return;
      if (b.dataset.am === 'al') { am.struct.push({ n: 'Couche', e: 0.1 }); update({ panels: false }); render(); }
      else if (b.dataset.am === 'dl') { am.struct.splice(+b.dataset.i, 1); update({ panels: false }); render(); }
      else if (b.dataset.am === 'move') startMove(am);
      else if (b.dataset.am === 'del') remove(am.id);
    });
  }

  // Export DXF : contour (bords et arcs de raccordement), axe et étiquette de chaque amorce.
  function dxfItems() {
    return list().map((am) => { const g = geom(am), m = mul(add(g.a, g.b), 0.5); let rot = Math.atan2(g.u.y, g.u.x); if (Math.cos(rot) < 0) rot += Math.PI; return { name: am.name, poly: g.poly, axis: [g.a, g.b], label: add(m, mul(g.n, num(am.w, 5) / 2 + 0.8)), rot, L: g.L, w: num(am.w, 5) }; });
  }

  return { hit, hover, menu, pick, start, moveTo, drop, cancel, overlay, render, bind, compute, openProps, dxfItems };
}
