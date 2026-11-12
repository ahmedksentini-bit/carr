// profedit.js — édition des profils en travers sur le plan (outil Sélection) : le profil survolé (symbole ou numéro)
// passe en surbrillance ; clic droit : déplacer (le profil suit le curseur le long de son axe, posé au clic), ajouter un
// profil avant ou après (placé de même entre ses voisins), ajouter un profil à un PK précis, supprimer. Les nouveaux
// profils sont numérotés à la suite (renumérotation de l'axe) ou prennent le suffixe bis, ter… du profil qui les
// précède, au choix (prj.prof.bis).
//
// Modèle (profils.js) : séries régulières + profils manuels + points de tangence. Un profil de série ou de tangence
// déplacé ou supprimé est retiré par prj.prof.skip [{ axis, s }] ; le profil déplacé devient un profil manuel.
import { pkText, BIS } from './profils.js';

export function initProfEdit(api) {
  const { S, viewer, update, toast, esc, uid } = api;
  const TH = () => (S.prj.opts?.textH || 0.8) * 1.2;
  const prof = () => (S.prj.prof = S.prj.prof || {});
  const list = () => S.prof?.list || [];
  const axisOf = (key) => (S.prof?.axes || []).find((a) => a.key === key);
  const axList = (key) => list().filter((q) => q.axis === key).sort((a, b) => a.s - b.s);
  const bisMode = () => S.prj.prof?.bis === true;
  const pk0 = (q) => q.pk - q.s;

  // ---------------------------------------------------------------- repérage
  // Distance (px) du curseur au profil : trait perpendiculaire et numéro au bout du trait.
  function geomOf(q) {
    const th = TH(), tk = Math.max(+S.prj.prof?.tick > 0 ? +S.prj.prof.tick : 2, th * 1.6), lab = (q.name.length + 1) * th * 0.9 * 0.6;
    const a = { x: q.p.x - q.nrm.x * tk, y: q.p.y - q.nrm.y * tk }, b = { x: q.p.x + q.nrm.x * (tk + th * 0.4 + lab), y: q.p.y + q.nrm.y * (tk + th * 0.4 + lab) };
    return { a, b, tk };
  }
  const segDist = (P, A, B) => { const dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy; let t = L2 ? ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(P[0] - A[0] - t * dx, P[1] - A[1] - t * dy); };
  function hit(px, py) {
    if (S.prj.prof?.on === false) return null;
    let best = null, bd = 9;
    for (const q of list()) {
      const g = geomOf(q), d = segDist([px, py], viewer.w2s(g.a.x, g.a.y), viewer.w2s(g.b.x, g.b.y));
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }
  const keyOf = (q) => `${q.axis}|${q.s.toFixed(3)}`;
  function hover(px, py) {
    const q = S.profMode ? null : hit(px, py), k = q ? keyOf(q) : null;
    if (k === (S.profHover || null)) return false;
    S.profHover = k; return true;
  }
  const findByKey = (k) => list().find((q) => keyOf(q) === k);

  // ---------------------------------------------------------------- modifications du modèle
  const near = (a, b) => Math.abs(a - b) < 0.05;
  function removeProfile(q) {
    const P = prof();
    if (q.src === 'manuel') P.manual = (P.manual || []).filter((m) => m.id !== q.ref);
    else (P.skip = P.skip || []).push({ axis: q.axis, s: +q.s.toFixed(3) });
  }
  function moveProfile(q, s) {
    const P = prof(), m = q.src === 'manuel' ? (P.manual || []).find((x) => x.id === q.ref) : null;
    if (m) m.s = +s.toFixed(3);
    else { removeProfile(q); (P.manual = P.manual || []).push({ id: uid(), axis: q.axis, axisName: q.axisName, s: +s.toFixed(3) }); }
  }
  function addProfile(axis, axisName, s) {
    const P = prof();
    if (axList(axis).some((q) => near(q.s, s))) return 'un profil existe déjà à cette abscisse';
    (P.skip || []).forEach((k, i) => { if (k.axis === axis && near(+k.s, s)) P.skip.splice(i, 1); });
    (P.manual = P.manual || []).push({ id: uid(), axis, axisName, s: +s.toFixed(3), ...(bisMode() ? { bis: true } : {}) });
    return null;
  }
  // Nom que prendrait un nouveau profil à l'abscisse s (aperçu).
  function nameFor(axis, s, excludeKey) {
    const L = axList(axis).filter((q) => keyOf(q) !== excludeKey), prev = L.filter((q) => q.s < s).pop();
    if (!bisMode()) return `P${L.filter((q) => q.s < s && !q.bis).length + 1}`;
    const base = prev ? prev.n : 0, nb = L.filter((q) => q.bis && q.n === base && q.s < s).length;
    return `P${base}${BIS[Math.min(nb, BIS.length - 1)]}`;
  }

  // ---------------------------------------------------------------- menu
  function closeMenu() { const m = document.getElementById('profMenu'); if (m) m.hidden = true; }
  function menu(q, cx, cy) {
    let m = document.getElementById('profMenu');
    if (!m) { m = document.createElement('div'); m.id = 'profMenu'; m.className = 'ctxmenu'; document.body.appendChild(m); }
    const bis = bisMode(), anyBis = list().some((x) => x.bis);
    m.innerHTML = `<div class="ttl">${esc(q.name)} · PK ${pkText(q.pk)} · ${esc(q.axisName)}</div>`
      + '<button data-m="move">Déplacer</button><button data-m="before">Ajouter un profil avant</button><button data-m="after">Ajouter un profil après</button>'
      + `<div class="ctxrow"><input data-m="pk" placeholder="PK (ex. 1+234,50)" value="${esc(pkText(q.pk).replace(/,00$/, ''))}" inputmode="decimal"><button data-m="atpk">Ajouter au PK</button></div>`
      + '<button data-m="del" class="danger">Supprimer</button>'
      + `<div class="ctxsep"></div><div class="ctxlbl">Nouveaux profils</div>`
      + `<label class="ctxopt"><input type="radio" name="profBis" value="0"${bis ? '' : ' checked'}> numérotation reprise</label>`
      + `<label class="ctxopt"><input type="radio" name="profBis" value="1"${bis ? ' checked' : ''}> suffixe bis, ter…</label>`
      + (anyBis ? '<button data-m="renum">Renuméroter (supprimer les bis)</button>' : '');
    m.hidden = false;
    const W = window.innerWidth, H = window.innerHeight;
    m.style.left = `${Math.min(cx, W - 240)}px`; m.style.top = `${Math.min(cy, H - 330)}px`;
    const away = (e) => { if (!m.contains(e.target)) { closeMenu(); document.removeEventListener('pointerdown', away, true); } };
    setTimeout(() => document.addEventListener('pointerdown', away, true));
    const done = () => { closeMenu(); document.removeEventListener('pointerdown', away, true); };
    m.onchange = (e) => { if (e.target.name === 'profBis') { prof().bis = e.target.value === '1'; update({ panels: false }); } };
    m.onkeydown = (e) => { if (e.key === 'Enter' && e.target.dataset.m === 'pk') { e.preventDefault(); m.querySelector('[data-m="atpk"]').click(); } e.stopPropagation(); };
    m.onclick = (e) => {
      const b = e.target.closest('button[data-m]'); if (!b) return;
      const act = b.dataset.m, ax = axisOf(q.axis);
      if (act === 'atpk') {
        const v = parsePk(m.querySelector('[data-m="pk"]').value);
        if (!Number.isFinite(v)) { toast('PK illisible : 1+234,50 ou 1234,50.', 'warn'); return; }
        const s = v - pk0(q);
        if (!ax || s < -0.01 || s > ax.len + 0.01) { toast(`PK hors de l'axe ${q.axisName} (${pkText(pk0(q))} à ${pkText(pk0(q) + (ax?.len || 0))}).`, 'warn'); return; }
        done();
        const name = nameFor(q.axis, s), err = addProfile(q.axis, q.axisName, Math.max(0, Math.min(ax.len, s)));
        if (err) { toast(err, 'warn'); return; }
        update(); toast(`Profil ${name} ajouté au PK ${pkText(v)}.`); return;
      }
      done();
      if (act === 'move') startMode('move', q);
      else if (act === 'before' || act === 'after') startMode(act, q);
      else if (act === 'del') { removeProfile(q); S.profHover = null; update(); toast(`Profil ${q.name} supprimé.`); }
      else if (act === 'renum') { for (const x of prof().manual || []) delete x.bis; update(); toast('Profils renumérotés (sans suffixe bis).'); }
    };
    setTimeout(() => m.querySelector('[data-m="move"]')?.focus());
  }
  function parsePk(t) {
    t = String(t || '').trim().replace(/\s/g, '').replace(',', '.').replace(/^PK/i, '');
    if (!t) return NaN;
    if (t.includes('+')) { const [km, mm] = t.split('+'); const a = +km, b = +mm; return Number.isFinite(a) && Number.isFinite(b) ? (a < 0 || km.startsWith('-') ? -1 : 1) * (Math.abs(a) * 1000 + b) : NaN; }
    return +t;
  }

  // ---------------------------------------------------------------- déplacement / ajout en temps réel
  function startMode(kind, q) {
    const ax = axisOf(q.axis); if (!ax) return;
    const L = axList(q.axis), i = L.findIndex((x) => keyOf(x) === keyOf(q)), prev = L[i - 1], next = L[i + 1];
    let lo = 0, hi = ax.len, s = q.s;
    if (kind === 'before') { lo = prev ? prev.s : 0; hi = q.s; s = (lo + hi) / 2; }
    if (kind === 'after') { lo = q.s; hi = next ? next.s : ax.len; s = (lo + hi) / 2; }
    if (hi - lo < 0.2) { toast('Pas de place entre ces deux profils.', 'warn'); return; }
    S.profMode = { kind, q, key: keyOf(q), axis: q.axis, lo, hi, s };
    S.profHover = null;
    toast(kind === 'move' ? `Déplacez ${q.name} le long de ${q.axisName}, cliquez pour le poser (Échap : annuler).` : `Placez le nouveau profil ${kind === 'before' ? 'avant' : 'après'} ${q.name}, cliquez pour le poser (Échap : annuler).`);
    viewer.invalidate();
  }
  function moveTo(w) {
    const M = S.profMode; if (!M) return false;
    const ax = axisOf(M.axis), pr = ax?.project(w); if (!pr) return false;
    const e = M.kind === 'move' ? 0 : 0.05;
    M.s = Math.round(Math.max(M.lo + e, Math.min(M.hi - e, pr.s)) * 100) / 100; return true;
  }
  function drop() {
    const M = S.profMode; if (!M) return false;
    S.profMode = null;
    const ax = axisOf(M.axis); if (!ax) return true;
    if (M.kind === 'move') {
      if (near(M.s, M.q.s)) { viewer.invalidate(); return true; }
      if (axList(M.axis).some((q) => keyOf(q) !== M.key && near(q.s, M.s))) { toast('Un profil existe déjà à cette abscisse.', 'warn'); viewer.invalidate(); return true; }
      moveProfile(M.q, M.s); update(); toast(`Profil déplacé au PK ${pkText(pk0(M.q) + M.s)}.`);
    } else {
      const name = nameFor(M.axis, M.s), err = addProfile(M.axis, M.q.axisName, M.s);
      if (err) { toast(err, 'warn'); viewer.invalidate(); return true; }
      update(); toast(`Profil ${name} ajouté au PK ${pkText(pk0(M.q) + M.s)}.`);
    }
    return true;
  }
  function cancel() { if (!S.profMode) return false; S.profMode = null; viewer.invalidate(); return true; }

  // ---------------------------------------------------------------- dessin (surbrillance, aperçu)
  function overlay(ctx, v) {
    const th = TH();
    const drawProf = (p, nrm, t, name, pkTxt, col, fill) => {
      const tk = Math.max(+S.prj.prof?.tick > 0 ? +S.prj.prof.tick : 2, th * 1.6), half = tk + th * 0.4;
      const [x0, y0] = v.w2s(p.x - nrm.x * tk, p.y - nrm.y * tk), [x1, y1] = v.w2s(p.x + nrm.x * half, p.y + nrm.y * half), [xc, yc] = v.w2s(p.x, p.y);
      ctx.save(); ctx.setLineDash([]); ctx.lineCap = 'round';
      ctx.strokeStyle = fill; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.beginPath(); ctx.arc(xc, yc, 5, 0, Math.PI * 2); ctx.stroke();
      if (name) {
        const ang = Math.atan2(-(y1 - y0), x1 - x0), flip = Math.cos(ang) < 0;
        ctx.translate(x1, y1); ctx.rotate(-(flip ? ang + Math.PI : ang));
        ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = flip ? 'right' : 'left'; ctx.textBaseline = 'middle';
        const txt = `${name} · PK ${pkTxt}`, w = ctx.measureText(txt).width;
        ctx.fillStyle = 'rgba(15,23,42,.85)'; ctx.fillRect(flip ? -w - 10 : 4, -9, w + 8, 18);
        ctx.fillStyle = col; ctx.fillText(txt, flip ? -6 : 8, 0);
      }
      ctx.restore();
    };
    const M = S.profMode;
    if (M) {
      const ax = axisOf(M.axis); if (!ax) return;
      if (M.kind === 'move') { const q = M.q, [xc, yc] = v.w2s(q.p.x, q.p.y); ctx.save(); ctx.strokeStyle = 'rgba(148,163,184,.8)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(xc, yc, 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      const { p, t } = ax.at(M.s), nrm = { x: -t.y, y: t.x };
      const name = M.kind === 'move' ? M.q.name : nameFor(M.axis, M.s);
      drawProf(p, nrm, t, name, pkText(pk0(M.q) + M.s), '#38bdf8', 'rgba(56,189,248,.3)');
      return;
    }
    const q = S.profHover && findByKey(S.profHover);
    if (q) drawProf(q.p, q.nrm, q.t, '', '', '#facc15', 'rgba(250,204,21,.35)');
  }

  return { hit, hover, menu, moveTo, drop, cancel, overlay };
}
