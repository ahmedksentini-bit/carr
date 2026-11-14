// engine.js — moteur hydrologique et hydraulique d'INFRA-KSR, exécuté CÔTÉ SERVEUR (Cloudflare Pages Function
// functions/api/hydro.js). Ce module et ceux qu'il importe (hydrology.js, culvert.js, notefig-cv.js, tables de data/)
// ne sont pas publiés dans la version du site (tools/build.mjs) : le navigateur n'en reçoit que les résultats.
// En développement (racine du dépôt servie sans fonctions), remote.js le charge directement.
import {
  computeAll, defaultHypotheses, listMontanaStations, TC_FORMULAS, FRANCOU_RODIER_REGIONS, suggestCiehRegressions,
  listCiehRegressions, OPTION_LISTS, resolveMontanaStation, montanaAfricaIdf, KR10_GEOLOGY_CATEGORIES,
} from './hydrology.js';
import { sizeCulvert, culvertHydraulics, inletsForShape, defaultInletFor } from './culvert.js';
import { hds5Svg, bceomSvg } from './notefig-cv.js';

// Figures de la note (abaques HDS-5 et BCEOM) d'un ouvrage calculé : section et paramètres retenus, résultat.
function figs(section, params, rr) {
  const out = {};
  try { out.hds5 = section && rr ? hds5Svg({ section, params }, rr) : ''; } catch { out.hds5 = ''; }
  try { out.bceom = rr?.bceom ? bceomSvg(rr.bceom) : ''; } catch { out.bceom = ''; }
  return out;
}

export function handle(op, a = {}) {
  switch (op) {
    case 'meta': return {
      stations: listMontanaStations(), ciehList: listCiehRegressions(),
      defaults: { tunisie: defaultHypotheses('tunisie'), fao54: defaultHypotheses('fao54') },
      TC_FORMULAS, OPTION_LISTS, FRANCOU_RODIER_REGIONS, KR10_GEOLOGY_CATEGORIES,
      inlets: { box: inletsForShape('box'), circular: inletsForShape('circular') },
      defaultInlet: { box: defaultInletFor('box'), circular: defaultInletFor('circular') },
    };
    case 'suggestCieh': return suggestCiehRegressions(a);
    case 'montana': return resolveMontanaStation(a.code, a.T);
    case 'montanaAfrica': return montanaAfricaIdf(a);
    case 'computeAll': return computeAll(a.basins || [], a.hyp || {});
    // jobs : [{ kind: 'verif', section, Q, params } | { kind: 'size', Q, constraints, params, shape }]
    case 'culverts': return (a.jobs || []).map((j) => {
      try {
        if (j.kind === 'verif') { const r = culvertHydraulics(j.section, j.Q, j.params); return { r, figs: figs(j.section, j.params, r) }; }
        const sz = sizeCulvert(j.Q, j.constraints, j.params), ret = sz?.retained, rr = ret?.result;
        const section = ret ? (j.shape === 'circular' ? { shape: 'circular', diameter: ret.diameter, cells: ret.cells } : { shape: 'box', width: ret.width, height: ret.height, cells: ret.cells }) : null;
        return { sz, figs: figs(section, j.params, rr) };
      } catch (e) { return { error: e.message }; }
    });
    default: throw new Error(`opération inconnue : ${op}`);
  }
}
