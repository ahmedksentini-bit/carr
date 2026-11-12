// Barèmes nationaux de portance fondés sur le CBR (portage de CbrPlatformScales et
// CbrBearingScales de Burmister-Calc, et de la chaîne plate-forme du catalogue sénégalais,
// SenegalPlatform). Chacun est recopié de son catalogue : aucune valeur n'est transposée d'un pays
// à l'autre, même quand les bandes coïncident.
//
// Deux familles de barèmes :
//  · « CBR → classe d'arase → couche de forme → plate-forme » (Tunisie RevA, Sénégal 2015,
//    Côte d'Ivoire 2024). Les six bandes de portance sont les mêmes d'un pays à l'autre
//    (< 20, 20, 50, 80, 120, 200 MPa) ; seuls changent les noms de classes et, parfois,
//    l'épaisseur minimale de matériau de PST exigée.
//  · « CBR → classe de sol » sans arase ni couche de forme : guide tropical CEBTP 1980, manuel
//    ivoirien 1977 et catalogue tunisien de 1984, qui indexent directement leurs fiches sur S1…S5.
//
// Formes : grade d'arase { nom, module (MPa, long terme), cbrMin, epaisseurMinPst (cm), note } ;
// classe de portance { nom, module, cbrMin, provisoire, note } (comme pays/base.js) ;
// option de couche de forme { arase, traitee, classeTraitee, specNonTraitee, epaisseur, deuxCouches,
// plateforme, materiau, libelle }.

import { comparaison as cmp, etape, memeNom, mesure, nombre } from "./justification.js";
import { PLATEFORMES, classerParModule } from "./plateforme.js";

// ─────────────────────────────── Briques ───────────────────────────────

const grade = (nom, module, cbrMin, epaisseurMinPst = null, note = null) => ({ nom, module, cbrMin, epaisseurMinPst, note });
const classe = (nom, module, cbrMin = null, { provisoire = false, note = null } = {}) => ({ nom, module, cbrMin, provisoire, note });

/** Une ligne de dimensionnement de couche de forme d'un catalogue national. */
export function optionCoucheDeForme(arase, traitee, classeTraitee, specNonTraitee, epaisseur, deuxCouches, plateforme) {
  const materiau = traitee ? `traitée, ${classeTraitee}` : `non traitée, ${specNonTraitee}`;
  return {
    arase, traitee, classeTraitee, specNonTraitee, epaisseur, deuxCouches, plateforme, materiau,
    libelle: `${arase} + ${nombre(epaisseur, 0)} cm (${materiau})${deuxCouches ? ", en deux couches" : ""} → ${plateforme}`,
  };
}

/**
 * Lecture d'un barème « le seuil de CBR le plus élevé encore atteint l'emporte » : une classe
 * sans CBR minimal sert de plancher ; sans classe atteinte, la première de la liste.
 */
function lireCbr(classes, cbr) {
  let retenue = null;
  for (const c of classes) {
    if (c.cbrMin == null) { retenue ??= c; continue; }
    if (cbr >= c.cbrMin && (retenue?.cbrMin == null || c.cbrMin > retenue.cbrMin)) retenue = c;
  }
  return retenue ?? classes[0] ?? null;
}

/** Étape justifiant une lecture de barème CBR : seuil atteint, seuil suivant non atteint. */
function etapeCbr(classes, cbr, c, suffixe) {
  // Sous le premier seuil d'un barème sans classe plancher : la classe la plus basse est retenue.
  if (c.cbrMin != null && cbr < c.cbrMin) {
    return etape(`CBR = ${nombre(cbr)} < ${nombre(c.cbrMin)}, sous le premier seuil du barème : `
      + `classe la plus basse, ${c.nom}${suffixe}.`, [cmp("cbr", cbr, "<", c.cbrMin)], c.nom);
  }
  const seuils = classes.filter((x) => x.cbrMin != null).map((x) => x.cbrMin).sort((a, b) => a - b);
  const suivant = seuils.find((s) => s > (c.cbrMin ?? -Infinity) && s > cbr);
  const comps = [];
  if (c.cbrMin != null) comps.push(cmp("cbr", cbr, "≥", c.cbrMin));
  if (suivant != null) comps.push(cmp("cbr", cbr, "<", suivant));
  const encadre = c.cbrMin != null
    ? (suivant != null ? `${nombre(c.cbrMin)} ≤ CBR = ${nombre(cbr)} < ${nombre(suivant)}` : `CBR = ${nombre(cbr)} ≥ ${nombre(c.cbrMin)}`)
    : (suivant != null ? `CBR = ${nombre(cbr)} < ${nombre(suivant)}` : `CBR = ${nombre(cbr)}`);
  return etape(`${encadre} → ${c.nom}${suffixe}.`, comps, c.nom);
}

// ─────────────────────────────── Barèmes « CBR → arase → plate-forme » ───────────────────────────────

/**
 * Classe d'arase correspondant à un CBR : celle dont le seuil est le plus élevé encore atteint.
 * @returns {{ classe, etapes }}
 */
export function classerAraseParCbr(echelle, cbr) {
  if (!mesure(cbr)) return { classe: null, etapes: [etape("Saisir un CBR pour déterminer la classe d'arase.")] };
  const c = lireCbr(echelle.arases, cbr);
  const suffixe = c.module > 0
    ? `, E ≥ ${nombre(c.module, 0)} MPa à long terme`
    : (c.note ? ` — ${c.note.replace(/\.$/, "")}` : "");
  const etapes = [etapeCbr(echelle.arases, cbr, c, suffixe)];
  // Une règle d'épaisseur fonction du CBR lui-même (Sénégal, catalogue 2015 p. 30) prime sur la
  // valeur rattachée à la classe d'arase : deux CBR d'une même classe n'appellent pas la même épaisseur.
  const ep = echelle.epaisseurMinPstCbr ? echelle.epaisseurMinPstCbr(cbr) : c.epaisseurMinPst;
  if (ep != null) {
    etapes.push(etape(`Épaisseur minimale de matériau de PST pour retenir ${c.nom} : ${nombre(ep, 0)} cm${echelle.epaisseurMinPstCbr ? ` (règle du CBR = ${nombre(cbr)})` : ""}.`));
  }
  return { classe: ep != null && ep !== c.epaisseurMinPst ? { ...c, epaisseurMinPst: ep } : c, etapes };
}

/** Classe de plate-forme d'un barème correspondant à un module : limite basse la plus élevée atteinte. */
export const plateformeParModule = (echelle, E) => classerParModule(E, echelle.plateformes).classe;

/**
 * Plate-forme obtenue sans couche de forme : elle prend le rang de portance de l'arase. Null
 * quand l'arase est trop faible pour classer une plate-forme (AR0).
 */
export function plateformeSansCouche(echelle, nomArase) {
  const a = echelle.arases.find((x) => x.nom === nomArase);
  return a && a.module > 0 ? plateformeParModule(echelle, a.module) : null;
}

/** Les cinq classes de plate-forme françaises, reprises telles quelles en Tunisie et au Sénégal. */
const PLATEFORMES_FRANCAISES = PLATEFORMES;

/**
 * Tunisie — Catalogue RevA, fascicule 2, tableau 18. Le catalogue reprend la classification et
 * les tables de couche de forme du GTR 2023 ; il y ajoute l'entrée par le CBR et deux classes
 * d'arase intermédiaires (AR2qs et AR4).
 */
export const ECHELLE_TUNISIE = {
  cle: "tn-reva",
  nom: "Tunisie — Catalogue RevA (CBR → arase)",
  reference: "Catalogue de dimensionnement des chaussées, Tunisie, RevA — fascicule 2 « Plateforme », "
    + "tableaux 17 (classes de plateforme) et 18 (classes d'arase)",
  arases: [
    grade("AR0", 0, null, null, "E < 20 MPa, CBR < 5 : couche de forme indispensable."),
    grade("AR1", 20, 5),
    grade("AR2", 50, 10),
    grade("AR2qs", 80, 15),
    grade("AR3", 120, 25, null, "CBR peu significatif pour les arases traitées."),
    grade("AR4", 200, 40, null, "CBR peu significatif pour les arases traitées."),
  ],
  plateformes: PLATEFORMES_FRANCAISES,
  couchesDeForme: [],
  utiliseTablesGtr: true,
  conseil: "L'essai retenu est le CBR immergé 4 jours à 95 % de la densité sèche OPM. Les modalités "
    + "dépendent de la pluviométrie : teneur en eau 0,8 w_OPM si moins de 250 mm/an, w_OPM entre "
    + "250 et 800 mm/an, 1,15 w_OPM au-delà de 800 mm/an ; pas d'immersion en région sèche "
    + "(moins de 250 mm/an), immersion 4 jours au-delà.",
  reserves: [
    "Le critère CBR seul ne suffit pas à évaluer la portance : les conditions de nappe et de "
    + "drainage la conditionnent et elle peut chuter à long terme, notamment en PST2 et PST3.",
    "Les valeurs du barème peuvent être ajustées après analyse des sols du projet.",
  ],
};

// ─────────────────────────────── Sénégal : chaîne du catalogue 2015 ───────────────────────────────

export const REFERENCE_PLATEFORME_SENEGAL =
  "Catalogue Senegal 2015, chap. 3 — Tableaux 6 (p. 28), 7 et 8 (p. 32), 11 (p. 35)";

/** Tableaux 7 et 8 du catalogue sénégalais, cellule par cellule. */
export const COUCHES_DE_FORME_SENEGAL = [
  // Tableau 7 — couche de forme NON traitée, depuis AR0.
  optionCoucheDeForme("AR0", false, null, "CBR 5 à 10", 45, true, "PF1"),
  optionCoucheDeForme("AR0", false, null, "CBR 10 à 15", 35, false, "PF1"),
  optionCoucheDeForme("AR0", false, null, "CBR 15 à 30", 30, false, "PF1"),
  optionCoucheDeForme("AR0", false, null, "CBR 10 à 15", 45, true, "PF2"),
  optionCoucheDeForme("AR0", false, null, "CBR 15 à 30", 35, false, "PF2"),
  optionCoucheDeForme("AR0", false, null, "CBR 15 à 40", 50, true, "PF2qs"),

  // Tableau 8 — couche de forme TRAITÉE. La cellule AR1 / classe 3 → PF2 est vide.
  optionCoucheDeForme("AR1", true, "Classe 4", null, 30, false, "PF2"),
  optionCoucheDeForme("AR1", true, "Classe 5", null, 35, false, "PF2"),
  optionCoucheDeForme("AR1", true, "Classe 3", null, 30, false, "PF3"),
  optionCoucheDeForme("AR1", true, "Classe 4", null, 35, false, "PF3"),
  optionCoucheDeForme("AR1", true, "Classe 5", null, 50, true, "PF3"),
  optionCoucheDeForme("AR1", true, "Classe 3", null, 40, true, "PF4"),
  optionCoucheDeForme("AR1", true, "Classe 4", null, 45, true, "PF4"),
  optionCoucheDeForme("AR1", true, "Classe 5", null, 55, true, "PF4"),
  optionCoucheDeForme("AR2", true, "Classe 3", null, 25, false, "PF3"),
  optionCoucheDeForme("AR2", true, "Classe 4", null, 30, false, "PF3"),
  optionCoucheDeForme("AR2", true, "Classe 5", null, 35, false, "PF3"),
  optionCoucheDeForme("AR2", true, "Classe 3", null, 30, false, "PF4"),
  optionCoucheDeForme("AR2", true, "Classe 4", null, 35, false, "PF4"),
  optionCoucheDeForme("AR2", true, "Classe 5", null, 45, true, "PF4"),
];

/** p. 30, « Sols à éliminer » comme arase. */
export const SOLS_A_ELIMINER_SENEGAL = [
  "sols hétérogènes",
  "sols gonflants (gonflement linéaire dans le moule CBR > 2 % après 4 jours d'immersion)",
  "sols organiques (teneur en matières organiques > 10 %)",
  "sols très compressibles (vases, tourbes : Cc/(1+e0) > 0,2)",
  "sols très argileux ou à faible portance (IP ≥ 40, ou wL ≥ 70, ou CBR < 5)",
];

const CONSEIL_SENEGAL =
  "Rechercher la portance maximale : viser PF2qs voire PF3 au moins pour les trafics de "
  + "classe C6 et plus. PF1 est réservée au réseau secondaire (RD, RR) et n'est pas retenue "
  + "sur le réseau principal (autoroute, RN). La classe d'arase la plus courante au Sénégal "
  + "est AR1 (20 MPa) : les sols y sont majoritairement sensibles à l'eau (sables et "
  + "latérites B1/B2/B5/B6 au sens du GTR NF P11-300), et le CBR du Tableau 6 n'est "
  + "qu'indicatif — il ne vaut pas critère de réception.";

/**
 * Épaisseur minimale (cm) de matériau de PST pour retenir la classe d'arase associée au CBR
 * (catalogue sénégalais, p. 30) : 25 cm si CBR < 5, 35 de 5 à 7, 45 de 8 à 14, 55 de 15 à 29,
 * 65 au-delà de 30.
 */
export const epaisseurMinimalePstSenegal = (cbr) =>
  (cbr < 5 ? 25 : cbr <= 7 ? 35 : cbr <= 14 ? 45 : cbr <= 29 ? 55 : 65);

/**
 * Sénégal — Catalogue Ageroute 2015, tableaux 6 (arase), 7 et 8 (couche de forme), 11
 * (plate-forme). Sans couche de forme, la plate-forme prend le rang de l'arase : les critères de
 * réception d'une arase ARi sont ceux de la plate-forme PFi (p. 28).
 */
export const ECHELLE_SENEGAL = {
  cle: "sn-2015",
  nom: "Sénégal — Catalogue 2015 (CBR → arase)",
  reference: REFERENCE_PLATEFORME_SENEGAL,
  arases: [
    grade("AR0", 0, null, 25, "E < 20 MPa, CBR < 5 : couche de forme indispensable."),
    grade("AR1", 20, 5, 35, "Classe la plus courante au Sénégal en l'absence de facteur favorable."),
    grade("AR2", 50, 10, 45, "Atteignable pour les sables et graves propres, insensibles à l'eau, ou après traitement."),
    grade("AR2qs", 80, 15, 55),
    grade("AR3", 120, 25, 65, "CBR peu significatif pour les arases traitées."),
    grade("AR4", 200, 40, 65, "CBR peu significatif pour les arases traitées."),
  ],
  plateformes: PLATEFORMES_FRANCAISES,
  epaisseurMinPstCbr: (cbr) => epaisseurMinimalePstSenegal(cbr),
  couchesDeForme: COUCHES_DE_FORME_SENEGAL,
  utiliseTablesGtr: false,
  conseil: CONSEIL_SENEGAL,
  reserves: SOLS_A_ELIMINER_SENEGAL.map((c) => `Sol à éliminer comme arase : ${c}.`),
};

/**
 * Côte d'Ivoire — Manuel LBTP avril 2024, fascicule 1 tableaux 6 et 7, fascicule 3 § 4. Les
 * classes de plate-forme y sont notées PPF1 à PPF5 et les arases AR0 à AR5 : les bandes de
 * portance sont les mêmes qu'en France, la numérotation ne l'est pas.
 */
export const ECHELLE_COTE_DIVOIRE_2024 = {
  cle: "ci-2024",
  nom: "Côte d'Ivoire — Manuel LBTP 2024 (CBR → arase)",
  reference: "Manuel de conception et de dimensionnement des chaussées neuves des routes "
    + "interurbaines, LBTP, avril 2024 — fasc. 1 tab. 6 et 7, fasc. 3 § 4",
  arases: [
    grade("AR0", 0, null, 25, "Non acceptable sur le réseau national : le sol de PST doit être amélioré."),
    grade("AR1", 20, 5, 35),
    grade("AR2", 50, 10, 45),
    grade("AR3", 80, 15, 55),
    grade("AR4", 120, 25, 65),
    grade("AR5", 200, 40, 65),
  ],
  plateformes: [
    classe("PPF1", 20, null, { note: "20 ≤ E < 50 MPa — exclue du catalogue." }),
    classe("PPF2", 50, null, { note: "50 ≤ E < 80 MPa" }),
    classe("PPF3", 80, null, { note: "80 ≤ E < 120 MPa" }),
    classe("PPF4", 120, null, { note: "120 ≤ E < 200 MPa" }),
    classe("PPF5", 200, null, { note: "E ≥ 200 MPa" }),
  ],
  couchesDeForme: [
    optionCoucheDeForme("AR0", false, null, "CBR 10 à 15", 45, false, "PPF2"),
    optionCoucheDeForme("AR0", false, null, "CBR 15 à 30", 35, false, "PPF2"),
    optionCoucheDeForme("AR0", false, null, "CBR 15 à 40", 50, false, "PPF3"),
  ],
  utiliseTablesGtr: false,
  conseil: "La portance à long terme remplace le paramètre sol du manuel 1977 : les seuls essais CBR "
    + "ne suffisent plus à caractériser la plate-forme, et le manuel annonce l'élaboration d'un "
    + "GTR ivoirien. Les épaisseurs de couche de forme du tableau 8 sont inspirées du guide CEBTP "
    + "1984 et restent indicatives : elles doivent être confirmées par des mesures de portance sur "
    + "l'arase et sur la couche de forme, avec des matériaux insensibles à l'eau.",
  reserves: [
    "La classe d'arase AR0 n'est pas acceptable pour les routes du réseau national : "
    + "améliorer le sol par substitution, traitement ou apport de couche de forme.",
    "Les plates-formes PPF1 sont exclues du catalogue : viser PPF2 au minimum.",
    "À partir de la classe de trafic cumulé TC4, la classe minimale retenue est PPF3.",
    "En phase travaux : nivellement à ± 3 cm (± 2 cm si l'assise bitumineuse fait 12 cm ou moins) "
    + "et module minimal de 50 MPa, ou l'objectif de classe s'il est plus élevé.",
  ],
};

export const ECHELLES_CBR_ARASE = [ECHELLE_TUNISIE, ECHELLE_SENEGAL, ECHELLE_COTE_DIVOIRE_2024];

/** Barème « CBR → arase » par sa clé (casse indifférente), null si inconnu. */
export const echelleCbrArase = (cle) => ECHELLES_CBR_ARASE.find((e) => memeNom(e.cle, cle)) ?? null;

// ─────────────────────────────── Barèmes « CBR → classe de sol » ───────────────────────────────

/**
 * Classe correspondant à un CBR : celle dont le CBR minimal est le plus élevé encore atteint.
 * @returns {{ classe, etapes }}
 */
export function classerSolParCbr(echelle, cbr) {
  if (!mesure(cbr)) return { classe: null, etapes: [etape("Saisir un CBR pour déterminer la classe de sol.")] };
  const c = lireCbr(echelle.classes, cbr);
  return { classe: c, etapes: [etapeCbr(echelle.classes, cbr, c, `, module ${nombre(c.module, 0)} MPa`)] };
}

/**
 * Guide pratique CEBTP 1980 (p. 21) et manuel ivoirien 1977 (tableau II) : mêmes classes, mêmes
 * modules. Les modules sont donnés en bars dans les guides, convertis ici en MPa.
 */
export const ECHELLE_TROPICALE = {
  cle: "cebtp-1980",
  nom: "Tropical CEBTP 1980 / Côte d'Ivoire 1977 (CBR → S1…S5)",
  reference: "Guide pratique de dimensionnement des chaussées pour les pays tropicaux, CEBTP 1980, "
    + "p. 21 et p. 137 ; manuel LBTP Côte d'Ivoire 1977, tableaux II et p. 24",
  classes: [
    classe("S1", 25, null, { note: "CBR < 5 — 250 bar" }),
    classe("S2", 50, 5, { note: "CBR 5 à 10 — 500 bar" }),
    classe("S3", 75, 10, { note: "CBR 10 à 15 — 750 bar" }),
    classe("S4", 150, 15, { note: "CBR 15 à 30 — 1500 bar" }),
    classe("S5", 300, 30, { note: "CBR > 30 — 3000 bar" }),
  ],
  conseil: "CBR mesuré sur les 30 cm supérieurs, à 95 % de l'OPM après 4 jours d'imbibition. "
    + "Corrélations du guide : E_dynamique ≈ 100 × CBR, E_statique ≈ 50 × CBR pour les matériaux "
    + "à gros éléments et 30 × CBR pour les matériaux fins. La classe de sol indexe directement "
    + "les fiches du catalogue : il n'y a ni classe d'arase ni table de couche de forme.",
};

/**
 * Tunisie — catalogue de 1984, chapitre III. Le catalogue de 1984 n'a ni classe d'arase ni
 * classe de plate-forme : ses fiches sont indexées directement sur la classe de sol S1 à S4,
 * déduite du CBR caractéristique. La chaîne « CBR → arase → plate-forme » du catalogue RevA lui
 * est postérieure et ne s'y applique pas. Modules provisoires, comme dans l'application.
 */
export const ECHELLE_TUNISIE_1984 = {
  cle: "tn-1984",
  nom: "Tunisie — catalogue 1984 (CBR → S1…S4)",
  reference: "Catalogue de dimensionnement des chaussées, Tunisie, août 1984 — chapitre III « Sol support »",
  classes: [
    classe("S1", 35, 5, { provisoire: true, note: "CBR caractéristique 5-8. Sol faible. S0 (CBR < 5) hors catalogue." }),
    classe("S2", 50, 8, { provisoire: true, note: "CBR 8-12." }),
    classe("S3", 80, 12, { provisoire: true, note: "CBR 12-20." }),
    classe("S4", 150, 20, { provisoire: true, note: "CBR > 20. Sol le plus portant." }),
  ],
  conseil: "Le catalogue de 1984 classe le sol directement en S1 à S4 d'après le CBR caractéristique, "
    + "sans passer par une classe d'arase ni par une plate-forme : ce sont ces classes qui "
    + "indexent ses fiches. S0 (CBR < 5) est hors catalogue — il faut alors une couche de forme "
    + "(seuils 0,25 m et 0,70 m) ou, sur sol saturé, un remblai d'environ 1 m. Un mauvais "
    + "drainage fait descendre d'une classe. Les régions climatiques A, B et C (figure 1, "
    + "pluviométrie) commandent ensuite le choix des matériaux.",
};

export const ECHELLES_CBR_DIRECTES = [ECHELLE_TROPICALE, ECHELLE_TUNISIE_1984];

/** Barème « CBR → classe de sol » par sa clé, null si inconnu. */
export const echelleCbrDirecte = (cle) => ECHELLES_CBR_DIRECTES.find((e) => memeNom(e.cle, cle)) ?? null;
