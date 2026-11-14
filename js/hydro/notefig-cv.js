// notefig-cv.js — abaques HDS-5 et BCEOM de la note de calcul (côté serveur : ces figures sont retracées par le moteur
// hydraulique, qui n'est pas envoyé au navigateur). Dessin commun : abaqueSvg (notefig.js).
import { culvertHydraulics, inletsForShape } from './culvert.js';
import BCEOM from './data/bceom_abaques_71_84.js';
import { abaqueSvg } from './notefig.js';

const nf = (v, d = 2) => (Number.isFinite(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

export function hds5Svg(cv, rr) {
  if (!cv?.section || !rr?.dischargePerCell) return '';
  const cells = Math.max(1, cv.section.cells || 1), q0 = rr.dischargePerCell;
  const p = { ...cv.params }; delete p.roadLevel; delete p.maxHeadwater; delete p.minFreeboard;
  const shape = cv.section.shape === 'circular' ? 'circular' : 'box', qs = Array.from({ length: 36 }, (_, i) => q0 * (0.08 + (2.6 * i) / 35));
  const curves = inletsForShape(shape).map((c) => {
    const pts = [];
    for (const q of qs) { try { const r = culvertHydraulics(cv.section, q * cells, { ...p, inlet: c.key }); if (r && Number.isFinite(r.inletRatio) && r.inletRatio > 0) pts.push([r.dischargePerCell || q, r.inletRatio]); } catch { /* hors domaine */ } }
    return { pts, on: c.key === rr.inlet?.key, label: c.label.length > 34 ? c.label.slice(0, 33) + '…' : c.label };
  }).filter((c) => c.pts.length > 1);
  const D = shape === 'circular' ? cv.section.diameter : cv.section.height;
  return abaqueSvg({
    title: `Contrôle à l'entrée HDS-5 — ${shape === 'circular' ? `buse Ø ${nf(D, 2)} m` : `dalot ${nf(cv.section.width, 2)} × ${nf(D, 2)} m`}${cells > 1 ? ` (${cells} alvéoles)` : ''}`,
    xl: 'Débit par alvéole q (m³/s)', yl: 'HW / D (charge amont rapportée à la hauteur)', curves, x0: 0, y0: 0,
    mark: { x: q0, y: rr.inletRatio, label: `HW = ${nf(rr.hwInlet, 2)} m` },
  });
}

// ─── BCEOM : figure de niveau amont, toutes les courbes ─────────────────────────────────────────────
export function bceomSvg(bc) {
  if (!bc?.figure) return '';
  const fig = (BCEOM.abaques_niveau_amont || []).find((a) => a.figure === bc.figure);
  if (!fig) return '';
  const curves = (fig.courbes || []).map((c) => ({ pts: (c.points || []).filter((q) => q.q_reduit > 0 && q.h_amont_reduit > 0).map((q) => [q.q_reduit, q.h_amont_reduit]).sort((a, b) => a[0] - b[0]), on: String(c.id).toLowerCase() === String(bc.curveId).toLowerCase(), label: (() => { const t = c.libelle || c.id; return t.length > 34 ? t.slice(0, 33) + '…' : t; })() })).filter((c) => c.pts.length > 1);
  return abaqueSvg({ title: `Abaque BCEOM figure ${bc.figure}${fig.ouvrage ? ' — ' + fig.ouvrage : ''}`, xl: 'Débit réduit Q*', yl: 'Niveau amont réduit H1* = H1 / D', xlog: true, ylog: true, curves, mark: { x: bc.qStar, y: bc.h1Star, label: `H1 = ${nf(bc.headwater, 2)} m` } });
}

