// layers.js — calques du dessin projet (affichage + export DXF).
export const LAYERS = {
  CHAUSSEE: { label: 'Chaussée (remplissage)', dxf: null },
  AXE_SAISI: { label: 'Axes saisis (existant)', dxf: 'GIRA_AXE_EXISTANT', aci: 2, ltype: 'TIRETS' },
  AXE: { label: 'Axes projet', dxf: 'GIRA_AXE_PROJET', aci: 1, ltype: 'AXE' },
  BORDURE: { label: 'Bordures / bords de chaussée', dxf: 'GIRA_BORDURE', aci: 7 },
  ILOT_CENTRAL: { label: 'Îlot central', dxf: 'GIRA_ILOT_CENTRAL', aci: 3 },
  ILOT_SEP: { label: 'Îlots séparateurs / TPC', dxf: 'GIRA_ILOT_SEPARATEUR', aci: 3 },
  MARQUAGE: { label: 'Marquage', dxf: 'GIRA_MARQUAGE', aci: 7 },
  CONSTRUCTION: { label: 'Construction', dxf: 'GIRA_CONSTRUCTION', aci: 8, ltype: 'CONSTRUCTION' },
  LIMITE: { label: 'Limites de projet', dxf: 'GIRA_LIMITE', aci: 8, ltype: 'TIRETS' },
  COTATION: { label: 'Cotations', dxf: 'GIRA_COTATION', aci: 4 },
  DEVERS: { label: 'Dévers', dxf: 'GIRA_DEVERS', aci: 30 },
  IMPLANTATION: { label: "Points d'implantation", dxf: 'GIRA_IMPLANTATION', aci: 6 },
};
