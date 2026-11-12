// Module « Calcul de structure » : le moteur de Burmister seul, sur une
// structure quelconque, comme un écran de résultats d'Alizé.

import { analyser, profils } from "../chaussee/burmister.js";
import { coupeChaussee, profilProfondeur, figureBassin, tableauSollicitations } from "../figures-chaussee.js";
import { esc, f, fd, nombre, OPT_INTERFACE, CHAMPS_ESSIEU, essieuDe, texteEssieu, tableauStructure, NOM_GRANDEUR, BLOC_CHAMPS, NOTE_CHAMPS } from "./commun.js";

const DEFAUT = [
  { nom: "BBSG", E: "5400", nu: "0.35", h: "6", interface: "collee" },
  { nom: "GB3", E: "9300", nu: "0.35", h: "12", interface: "collee" },
  { nom: "GB3", E: "9300", nu: "0.35", h: "12", interface: "collee" },
  { nom: "Plateforme PF2", E: "50", nu: "0.35", h: "", interface: "collee" },
];

/**
 * Grandeurs des critères usuels pour cette structure. Sans matériau, la famille se lit au
 * coefficient de Poisson, comme dans Alizé : 0,25 pour les matériaux traités et les bétons
 * (σT), 0,35 pour les enrobés (εT, si leur module dépasse 1 000 MPa) et pour les sols et GNT (εz).
 */
export function grandeursCriteres(couches) {
  const finies = couches.slice(0, -1);
  return [...(finies.some((c) => c.nu >= 0.3 && c.E >= 1000) ? ["epsT"] : []), ...(finies.some((c) => c.nu < 0.3) ? ["sigT"] : []), "epsZ"];
}
const profilsCriteres = (p, couches) => grandeursCriteres(couches).map((g) =>
  `<figure class="profil-critere"><figcaption>${esc(NOM_GRANDEUR[g])}</figcaption><div class="software-diagram">${profilProfondeur(p, couches, g, { largeur: 600, hauteur: 300 })}</div></figure>`).join("");

/** Couches de calcul d'après la table (épaisseurs en cm). */
export function couchesStructure(lignes) {
  return lignes.map((c, i) => {
    const derniere = i === lignes.length - 1;
    const E = nombre(c.E), nu = nombre(c.nu, 0.35), h = nombre(c.h) / 100;
    if (!(E > 0)) throw new Error(`couche ${i + 1} : module E à saisir`);
    if (!(nu > 0 && nu < 0.5)) throw new Error(`couche ${i + 1} : ν doit être compris entre 0 et 0,5`);
    if (!derniere && !(h > 0)) throw new Error(`couche ${i + 1} : épaisseur à saisir`);
    return { nom: c.nom || `couche ${i + 1}`, E, nu, h: derniere ? Infinity : h, interface: c.interface || "collee" };
  });
}

export default {
  id: "structure", groupe: "Calcul", icone: "≋", titre: "Calcul de structure", sous: "Burmister : sollicitations, déflexion, Rdc",
  entete: "Modèle multicouche de Burmister",
  description: "Une structure quelconque sous un jumelage : tableau des sollicitations aux interfaces (convention Alizé), profils en profondeur, déflexions, bassin et rayon de courbure. Le moteur est celui du cours, vérifié sur les cas de référence d'Alizé.",
  champs: [["Chargement", CHAMPS_ESSIEU]],
  couches: {
    titre: "Structure", aide: "(épaisseurs en cm, de la surface vers le sol ; la dernière couche est semi-infinie)",
    colonnes: [["nom", "Couche", "texte"], ["h", "h (cm)", "nombre"], ["E", "E (MPa)", "nombre"], ["nu", "ν", "nombre"], ["interface", "Interface", "choix", OPT_INTERFACE]],
    sansSol: ["h", "interface"],
    defaut: DEFAUT,
    nouvelle: () => ({ nom: "Nouvelle couche", E: "500", nu: "0.35", h: "15", interface: "collee" }),
    minimum: 1,
  },
  calculer(v) {
    const couches = couchesStructure(v.couches);
    const essieu = essieuDe(v);
    const r = analyser(couches, essieu);
    const p = profils(couches, essieu);
    const figure = coupeChaussee(couches, { essieu, largeur: 600 });
    const synthese = `<p class="final-result bureau-verdict">Déflexion entre jumelage <strong>${fd(r.deflexionEntreJumelage, 1)} mm/100</strong>
        · sous roue ${fd(r.deflexionSousRoue, 1)} mm/100 · rayon de courbure <strong>${f(r.rdc, 4)} m</strong></p>
      ${tableauSollicitations(r, { avecPositions: true })}
      <p class="method-note">εT et σT : minimum de (−εxx, −εyy) et (−σxx, −σyy) sous roue et entre jumelage — une traction est négative ;
        εz et σz : maximum de −εzz et −σzz (compression positive). Convention d'Alizé.</p>
      ${profilsCriteres(p, couches)}
      <div class="software-diagram">${figureBassin(p.bassin, { largeur: 600 })}</div>
      ${BLOC_CHAMPS}`;
    const note = `<h3>1. Modèle</h3>
      <p>Massif multicouche élastique linéaire de Burmister : couches horizontales infinies, homogènes et isotropes, la dernière semi-infinie.
        Fonction de contrainte de Love intégrée dans le domaine de Hankel (quadrature de Gauss d'Alizé, 1 104 nœuds) ; une interface semi-collée est
        la moyenne des calculs collé et glissant. Chargement : ${esc(texteEssieu(essieu))}.</p>
      <h3>2. Structure</h3>${tableauStructure(couches)}
      <h3>3. Sollicitations</h3>${tableauSollicitations(r, { avecPositions: true })}
      <h3>4. Déflexions</h3>
      <p>Déflexion entre jumelage d = ${fd(r.deflexionEntreJumelage, 2)} mm/100 ; sous roue ${fd(r.deflexionSousRoue, 2)} mm/100.
        Rayon de courbure au point entre-jumelage, calculé analytiquement (dérivée seconde de la déflexion dans le sens de circulation) :
        Rc = ${f(r.rdc, 4)} m.</p>
      <h3>5. Sollicitations des critères</h3>
      <p>Profils en profondeur des grandeurs que vérifient les critères usuels : εT à la base des enrobés, σT à la base des
        couches traitées (coefficient de Poisson 0,25), εz au sommet des sols et des GNT.</p>
      ${profilsCriteres(p, couches)}
      <h3>6. Champs dans la structure</h3>
      <p>Carte, dans le plan vertical de l'axe des roues, de la grandeur du premier critère usuel — ${esc(NOM_GRANDEUR[grandeursCriteres(couches)[0]])} —,
        calculée par le même modèle sur une grille de nœuds (comme l'écran « grille » d'Alizé), et ses valeurs aux interfaces.</p>
      ${NOTE_CHAMPS}`;
    const champs = { module: "structure", couches, essieu, grandeur: grandeursCriteres(couches)[0], motif: "" };
    return { figure, synthese, note, verdict: null, etat: `d = ${fd(r.deflexionEntreJumelage, 1)} mm/100`, champs };
  },
};
