// Sols organiques (O) et matériaux alternatifs (AN, AM, AR) du GTR 2024 (portage de
// Gtr2024OrganicSoils et Gtr2024AlternativeMaterials de Burmister-Calc).
//
// Le guide est ici plus avare en seuils que pour les sols : la plupart des familles de matériaux
// alternatifs n'ont qu'un paramètre déterminant. Ce qui est chiffré est appliqué ; le reste est
// dit plutôt que deviné.
//
// Possibilités d'emploi (tableau 4) : "oui" sans condition particulière, "sous-conditions"
// explicitement posées par le guide, "etude" subordonné à une étude particulière, "non" exclu.

import { classerSol } from "./gtr2024.js";
import { comparaison as cmp, encadrement, etape, memeNom, mesure, nombre } from "./justification.js";
import { afficherEtat } from "./plateforme.js";

export const EMPLOIS = ["oui", "sous-conditions", "etude", "non"];

// ═══════════════════════════════ Sols organiques ═══════════════════════════════

export const REFERENCE_ORGANIQUES = "GTR 2024, fascicule 1, § 2.4.1 et tableau 4 (p. 40-41)";

/** Teneur en matières organiques (%) au-delà de laquelle un sol est dit organique. */
export const SEUIL_ORGANIQUE = 2;

/**
 * Teneur (%) à partir de laquelle l'emploi d'un O1 en couche de forme demande une étude
 * particulière, alors même que la classe reste admissible jusqu'à 6 %.
 */
export const SEUIL_ETUDE_COUCHE_DE_FORME_O1 = 3;

/**
 * Tableau 4 : classes de sols organiques. Bornes en teneur en matières organiques mesurée par
 * perte au feu (NF EN 17685-1), intervalle ]min ; max].
 */
export const CLASSES_ORGANIQUES = [
  { nom: "O1", min: 2, max: 6, description: "Sol à faible teneur en matières organiques",
    emploiRemblai: "Oui, uniquement en remblai courant de moins de 10 m de hauteur", verdictRemblai: "sous-conditions",
    emploiCoucheDeForme: "Oui, avec étude particulière à partir de 3 %", verdictCoucheDeForme: "sous-conditions" },
  { nom: "O2", min: 6, max: 20, description: "Sol à teneur en matières organiques modérée",
    emploiRemblai: "À privilégier pour les surfaces à enherber, en merlons paysagers ou phoniques", verdictRemblai: "sous-conditions",
    emploiCoucheDeForme: "Non", verdictCoucheDeForme: "non" },
  { nom: "O3", min: 20, max: null, description: "Tourbe",
    emploiRemblai: "Non", verdictRemblai: "non",
    emploiCoucheDeForme: "Non", verdictCoucheDeForme: "non" },
];

/**
 * Classe organique d'une teneur en matières organiques (%). Classe null jusqu'à 2 % : le sol
 * relève alors de la classification ordinaire des sols ou des roches.
 * @returns {{ classe, etapes }}
 */
export function classerParTeneurOrganique(teneur) {
  if (!mesure(teneur)) {
    return { classe: null, etapes: [etape("Teneur en matières organiques non mesurée (perte au feu, NF EN 17685-1).")] };
  }
  const t = nombre(teneur);
  if (teneur <= SEUIL_ORGANIQUE) {
    return {
      classe: null,
      etapes: [etape(`Teneur en matières organiques = ${t} % ≤ ${SEUIL_ORGANIQUE} % : sol non organique, `
        + "il relève de la classification ordinaire.", [cmp("teneurOrganique", teneur, "≤", SEUIL_ORGANIQUE)])],
    };
  }
  let classe = CLASSES_ORGANIQUES.find((g) => teneur > g.min && (g.max == null || teneur <= g.max));
  classe ??= CLASSES_ORGANIQUES[CLASSES_ORGANIQUES.length - 1];
  const comps = [cmp("teneurOrganique", teneur, ">", classe.min)];
  if (classe.max != null) comps.push(cmp("teneurOrganique", teneur, "≤", classe.max));
  const plage = classe.max != null
    ? `comprise entre ${nombre(classe.min)} % (exclu) et ${nombre(classe.max)} % (inclus)`
    : `> ${nombre(classe.min)} %`;
  return {
    classe,
    etapes: [etape(`Teneur en matières organiques = ${t} %, ${plage} → classe ${classe.nom} `
      + `(${classe.description.toLowerCase()}).`, comps, classe.nom)],
  };
}

/**
 * Double symbole du guide : classe organique puis classe de la fraction de sol, par exemple
 * « O1F2m ». Sans classification de sol, la classe organique seule.
 */
export const symboleOrganique = (classe, sol = null) => (sol?.estClasse ? classe.nom + sol.symbole : classe.nom);

/** Réserves attachées à l'emploi d'un sol organique, selon sa teneur et l'usage visé. */
export function reservesOrganiques(classe, teneur, pourCoucheDeForme) {
  const w = [
    "Les matières organiques se désagrègent : risque de tassements en remblai. Leur caractère "
    + "acide peut par ailleurs perturber la prise des liants hydrauliques lors d'un traitement.",
  ];
  if (pourCoucheDeForme && classe.nom === "O1" && teneur >= SEUIL_ETUDE_COUCHE_DE_FORME_O1) {
    w.push(`Teneur en matières organiques de ${nombre(teneur)} % : au-delà de `
      + `${SEUIL_ETUDE_COUCHE_DE_FORME_O1} %, l'emploi en couche de forme demande une étude particulière.`);
  }
  if (pourCoucheDeForme && classe.verdictCoucheDeForme === "non") {
    w.push(`Classe ${classe.nom} : emploi en couche de forme exclu par le tableau 4.`);
  }
  w.push("La perte au feu (NF EN 17685-1) peut surestimer la teneur : le gypse, les phases "
    + "cimentaires des bétons concassés et les argiles libèrent de l'eau dans la même gamme de "
    + "température. Le dichromate (NF P94-055) ou le permanganate de potassium sont des "
    + "alternatives, elles-mêmes faussées par la présence de métaux ou d'hydrocarbures.");
  return w;
}

/**
 * Classement complet d'un sol organique : la teneur donne la classe O, l'identification
 * ordinaire de la fraction minérale le second terme du double symbole, le tableau 4 les emplois.
 * @returns {{ classe, sol, symbole, estClasse, etapes, manquants, avertissements }}
 */
export function classerSolOrganique(teneur, identification = {}, { pourCoucheDeForme = true } = {}) {
  const sol = classerSol(identification);
  const lu = classerParTeneurOrganique(teneur);
  const etapes = [...lu.etapes], manquants = [], avertissements = [];

  if (!mesure(teneur)) {
    manquants.push("teneur en matières organiques (perte au feu)");
    return { classe: null, sol, symbole: "—", estClasse: false, etapes, manquants, avertissements };
  }

  if (lu.classe == null) {
    for (const e of sol.etapes) etapes.push(e);
    manquants.push(...sol.manquants);
    avertissements.push(...sol.avertissements);
    return { classe: null, sol, symbole: sol.symbole, estClasse: sol.estClasse, etapes, manquants, avertissements };
  }

  const classe = lu.classe;
  etapes.push(etape(`Emploi en ouvrage en terre : ${classe.emploiRemblai}.`));
  etapes.push(etape(`Emploi en couche de forme : ${classe.emploiCoucheDeForme}.`));
  for (const e of sol.etapes) etapes.push({ ...e, texte: "Fraction minérale — " + e.texte });
  manquants.push(...sol.manquants);
  avertissements.push(...reservesOrganiques(classe, teneur, pourCoucheDeForme));
  avertissements.push("Sol organique : le tableau 17 ne le range pas parmi les cas de PST. La portance "
    + "se détermine sur le sol support réel, une fois la couche organique purgée ou réservée aux "
    + "merlons et aux surfaces à enherber.");
  return { classe, sol, symbole: symboleOrganique(classe, sol), estClasse: true, etapes, manquants, avertissements };
}

// ═══════════════════════════════ Matériaux alternatifs ═══════════════════════════════

export const REFERENCE_ALTERNATIFS =
  "GTR 2024, fascicule 1 § 2.4.2 (p. 41-43) et fascicule 2 annexe 1 (p. 13, 22-26) ; "
  + "symboles issus du CEN TS 17438";

/** Grandes familles : AN naturels particuliers, AM élaborés, AR recyclés. */
export const GROUPES_ALTERNATIFS = {
  AN: "Matériaux naturels particuliers (produits de dragage, schistes houillers non calcinés)",
  AM: "Matériaux élaborés (mâchefers, cendres, laitiers, sous-produits de fonderie)",
  AR: "Matériaux recyclés (déconstruction, ballast recyclé)",
};

const famille = (code, nom, groupe, sousGroupe, parametre, { etudeSpecifique = false, etatsHydriques = false } = {}) =>
  ({ code, nom, groupe, sousGroupe, parametre, etudeSpecifique, etatsHydriques });

/**
 * Familles de matériaux alternatifs : code CEN TS 17438, désignation, et paramètre qui commande
 * leurs possibilités d'emploi. Les critères d'emploi sont « à la fois très divers et spécifiques
 * à la famille considérée » : seules deux familles reçoivent une échelle d'état hydrique chiffrée.
 */
export const FAMILLES_ALTERNATIVES = [
  // ---------------------------------------------------------- AN
  famille("AN-H1", "Produit de dragage cohésif", "AN", "Produits de dragage",
    "Comportement géotechnique de la fraction fine ; la valorisation demande une étude spécifique.",
    { etudeSpecifique: true }),
  famille("AN-H2", "Produit de dragage non cohésif", "AN", "Produits de dragage",
    "Granularité et sensibilité à l'eau ; la valorisation demande une étude spécifique.",
    { etudeSpecifique: true }),
  famille("AN-G2", "Schistes houillers non calcinés (noirs)", "AN", "Schistes houillers",
    "Taux d'imbrûlés à 975 °C moins celui à 500 °C ≥ 20 % (NF EN 1744-1 art. 17) : "
    + "le schiste n'a pas brûlé et reste évolutif."),
  famille("AN-G3", "Schistes houillers fragmentables, riches en pyrite ou à taux de charbon élevé", "AN", "Schistes houillers",
    "Fragmentabilité, teneur en pyrite et taux de charbon : matériau évolutif."),

  // ---------------------------------------------------------- AR
  famille("AR-A1", "Fraisat d'enrobé", "AR", "Mélange de matériaux de déconstruction",
    "Composant du groupe AR-A5 : sulfates solubles, flottants et indésirables."),
  famille("AR-A2", "Béton concassé", "AR", "Mélange de matériaux de déconstruction",
    "Composant du groupe AR-A5 : sulfates solubles, flottants et indésirables."),
  famille("AR-A3", "Produit de déconstruction concassé (hors béton)", "AR", "Mélange de matériaux de déconstruction",
    "Composant du groupe AR-A5 : sulfates solubles, flottants et indésirables."),
  famille("AR-A4", "Matériaux traités et non traités", "AR", "Mélange de matériaux de déconstruction",
    "Composant du groupe AR-A5 : sulfates solubles, flottants et indésirables."),
  famille("AR-A5", "Mélange de matériaux de démolition et de déconstruction (regroupe AR-A1 à AR-A4)", "AR",
    "Mélange de matériaux de déconstruction",
    "Sulfates solubles dans l'eau (NF EN 1744-1 art. 10.2), flottants et indésirables "
    + "(NF EN 933-11 si Dmax ≤ 80 mm, appréciation visuelle au-delà), et nature du matériau."),
  famille("AR-A6", "Ballast recyclé", "AR", "Ballast",
    "Se rapporter à la classe de sols correspondante pour obtenir les conditions de réutilisation."),

  // ---------------------------------------------------------- AM
  famille("AM-B1", "Mâchefer d'incinération de déchets non dangereux (MIDND)", "AM", "Mâchefers",
    "État hydrique par w_n/w_OPN ou IPI. La VBS n'est pas discriminante de leur sensibilité à l'eau.",
    { etatsHydriques: true }),
  famille("AM-C1a", "Cendres volantes silico-alumineuses de charbon (CVCT)", "AM", "Cendres",
    "État hydrique par w_n/w_OPN ou IPI : au-delà d'une teneur en eau limite, la portance "
    + "chute brutalement.",
    { etatsHydriques: true }),
  famille("AM-D1", "Laitier granulé ou vitrifié de haut-fourneau", "AM", "Laitiers",
    "Pratiquement pas employé seul : moulu, il sert de liant dans les matériaux traités aux "
    + "liants hydrauliques. Ses caractéristiques le rapprochent d'un sable relativement friable."),
  famille("AM-D2", "Laitier cristallisé de haut-fourneau", "AM", "Laitiers",
    "Présence d'éléments ferreux (scraps) à retirer : déferraillage puis élaboration. "
    + "Essai de désintégration du silicate bicalcique et du fer."),
  famille("AM-D3", "Laitier de convertisseur à oxygène", "AM", "Laitiers",
    "Éléments instables volumétriquement : le taux de chaux libre résiduelle peut engendrer "
    + "des gonflements. Essai d'expansion à la vapeur (NF EN 1744-1)."),
  famille("AM-D4", "Laitier d'aciérie électrique en filière carbone", "AM", "Laitiers",
    "Déferraillage, élaboration et parfois maturation. Essai d'expansion à la vapeur (NF EN 1744-1)."),
  famille("AM-D5", "Laitier d'aciérie électrique en filière inox et allié", "AM", "Laitiers",
    "Déferraillage, élaboration et parfois maturation. Essai d'expansion à la vapeur (NF EN 1744-1)."),
  famille("AM-D6", "Laitier de métallurgie secondaire", "AM", "Laitiers",
    "Caractéristiques extrêmement variables, de rocheuses à pulvérulentes : les paramètres "
    + "déterminants sont à fixer par une étude particulière.",
    { etudeSpecifique: true }),
  famille("AM-F1", "Sable de fonderie", "AM", "Sous-produits de fonderie",
    "Granularité (homométrie, absence de fines < 0,1 mm) et sensibilité à l'eau, pour reclasser "
    + "le sable dans la classe de sol équivalente. Déferraillage et élaboration souvent nécessaires."),
  famille("AM-F2", "Laitier de fonderie en four cupola", "AM", "Sous-produits de fonderie",
    "La valorisation de ce matériau demande une étude spécifique.",
    { etudeSpecifique: true }),
  famille("AM-G1", "Schistes houillers calcinés (schistes rouges)", "AM", "Schistes houillers",
    "LA ≤ 45 et MDE ≤ 45, et taux d'imbrûlés à 975 °C moins celui à 500 °C inférieur à 20 % "
    + "(NF EN 1744-1 art. 17). Reconnaissables à leur couleur rouge."),
];

/** Famille par son code (casse indifférente), null si inconnue. */
export const familleAlternative = (code) => FAMILLES_ALTERNATIVES.find((f) => memeNom(f.code, code)) ?? null;

/** Familles d'un groupe ("AN", "AM" ou "AR"). */
export const famillesDuGroupe = (groupe) => FAMILLES_ALTERNATIVES.filter((f) => f.groupe === groupe);

/** Sous-classes du groupe AR-A5, distinguées par le degré d'élaboration du mélange. */
export const SOUS_CLASSES_AR_A5 = [
  { code: "AR-A51", description: "Graves de recyclage : matériaux de démolition sans plâtre, épurés des éléments "
    + "putrescibles, concassés, criblés, déferraillés et homogénéisés" },
  { code: "AR-A52", description: "Matériaux de démolition en mélange, non concassés, contenant une faible proportion "
    + "d'indésirables" },
  { code: "AR-A53", description: "Matériaux de démolition en mélange, non concassés, contenant une forte proportion "
    + "d'indésirables (plâtres, bois, plastiques)" },
];

// ─────────────────────────────── Schistes houillers ───────────────────────────────

/** Seuil d'imbrûlés (%) séparant un schiste calciné (rouge) d'un schiste non calciné (noir). */
export const SEUIL_IMBRULES_SCHISTES = 20;

/**
 * Classe un schiste houiller à partir de son taux d'imbrûlés (différence des taux mesurés à
 * 975 °C et à 500 °C, NF EN 1744-1 art. 17) : sous 20 % le schiste a brûlé et devient un AM-G1
 * élaboré, au-delà il reste un AN-G2 évolutif.
 * @returns {{ classe, etapes }}
 */
export function classerSchisteHouiller(tauxImbrules) {
  if (!mesure(tauxImbrules)) {
    return { classe: null, etapes: [etape("Taux d'imbrûlés non mesuré (NF EN 1744-1 art. 17).")] };
  }
  const brule = tauxImbrules < SEUIL_IMBRULES_SCHISTES;
  const classe = familleAlternative(brule ? "AM-G1" : "AN-G2");
  return {
    classe,
    etapes: [etape(`Taux d'imbrûlés = ${nombre(tauxImbrules)} % ${brule ? "<" : "≥"} ${SEUIL_IMBRULES_SCHISTES} % : `
      + (brule ? "le schiste a brûlé → AM-G1, schiste rouge élaboré." : "le schiste n'a pas brûlé → AN-G2, schiste noir évolutif."),
    [cmp("tauxImbrules", tauxImbrules, brule ? "<" : "≥", SEUIL_IMBRULES_SCHISTES)], classe.code)],
  };
}

// ─────────────────────────────── États hydriques ───────────────────────────────

/** Seuils d'état hydrique des deux familles auxquelles le guide donne une échelle. */
export const SEUILS_ETAT_ALTERNATIFS = {
  // Mâchefers : IPI < 10 (th), 10 à 20 (h), > 20 (m) ; w 1,3 / 1,2 / 0,8 / 0,6.
  "AM-B1": { ipiTh: 10, ipiHMax: 20, wTh: 1.3, wH: 1.2, wM: 0.8, wS: 0.6 },
  // Cendres volantes : IPI < 4 (th), 4 à 10 (h), > 10 (m) ; w 1,3 / 1,2 / 0,85 / 0,75.
  "AM-C1a": { ipiTh: 4, ipiHMax: 10, wTh: 1.3, wH: 1.2, wM: 0.85, wS: 0.75 },
};

const seuilsAlternatifs = (code) => {
  const cle = Object.keys(SEUILS_ETAT_ALTERNATIFS).find((k) => memeNom(k, code));
  return cle ? SEUILS_ETAT_ALTERNATIFS[cle] : null;
};

/** État hydrique et étape qui le justifie ; null quand la famille n'a pas d'échelle ou sans essai. */
function etatAlternatifDetaille(code, ipi, wSurWopn) {
  const t = seuilsAlternatifs(code);
  if (t == null) return null;
  const dire = (etat, comps) => ({ etat, etape: etape(`${encadrement(comps, 3)} → état ${afficherEtat(etat)}.`, comps, etat) });

  if (mesure(ipi)) {
    if (ipi < t.ipiTh) return dire("th", [cmp("ipi", ipi, "<", t.ipiTh)]);
    if (ipi <= t.ipiHMax) return dire("h", [cmp("ipi", ipi, "≥", t.ipiTh), cmp("ipi", ipi, "≤", t.ipiHMax)]);
    return dire("m", [cmp("ipi", ipi, ">", t.ipiHMax)]);
  }
  if (!mesure(wSurWopn)) return null;
  const w = wSurWopn;
  if (w > t.wTh) return dire("th", [cmp("wSurWopn", w, ">", t.wTh)]);
  if (w >= t.wH) return dire("h", [cmp("wSurWopn", w, "≤", t.wTh), cmp("wSurWopn", w, "≥", t.wH)]);
  if (w >= t.wM) return dire("m", [cmp("wSurWopn", w, "<", t.wH), cmp("wSurWopn", w, "≥", t.wM)]);
  if (w >= t.wS) return dire("s", [cmp("wSurWopn", w, "<", t.wM), cmp("wSurWopn", w, "≥", t.wS)]);
  return dire("ts", [cmp("wSurWopn", w, "<", t.wS)]);
}

/**
 * État hydrique d'un matériau alternatif, pour les deux familles auxquelles le guide donne une
 * échelle. L'IPI est lu en premier, comme pour les sols ; à défaut le rapport w_n/w_OPN. Null
 * quand la famille n'a pas d'échelle ou qu'aucun essai n'est fourni.
 */
export const etatHydriqueAlternatif = (code, ipi = null, wSurWopn = null) =>
  etatAlternatifDetaille(code, ipi, wSurWopn)?.etat ?? null;

/** Passant à 63 µm (%) au-delà duquel un mâchefer ne peut plus être dit insensible à l'eau. */
export const MIDND_FINES_MAX = 10;
/** CBR immergé minimal pour qu'un mâchefer soit dit insensible à l'eau. */
export const MIDND_CBRI_MIN = 20;

/**
 * Insensibilité à l'eau des mâchefers (AM-B1) : le guide la subordonne aux deux critères
 * combinés, la VBS n'étant pas discriminante sur ces matériaux. Un essai manquant : pas de
 * conclusion favorable.
 */
export const machefereInsensible = (tamisat63, cbri) =>
  mesure(tamisat63) && mesure(cbri) && tamisat63 <= MIDND_FINES_MAX && cbri > MIDND_CBRI_MIN;

/** Symbole complet : code de famille, puis état hydrique pour les familles qui en portent un. */
export const symboleAlternatif = (code, etat = null) => (code == null ? "—" : etat ? code + etat : code);

/**
 * Réserves communes à tous les matériaux alternatifs : le GTR subordonne leur emploi à une
 * acceptabilité environnementale qu'il ne définit pas lui-même.
 */
export function reservesEnvironnementales(f) {
  const w = [
    "L'emploi d'un matériau alternatif est subordonné à son acceptabilité environnementale : "
    + "guide « Acceptabilité de matériaux alternatifs en technique routière / Évaluation "
    + "environnementale » (mars 2011) et guides propres à chaque famille (laitiers sidérurgiques "
    + "et MIDND 2012, matériaux de déconstruction 2016, cendres de centrale et sables de fonderie 2019).",
    "Ces guides ont valeur méthodologique, à l'exception du guide MIDND, qui traduit l'arrêté "
    + "du 18 novembre 2011 et a donc valeur réglementaire.",
  ];
  if (f.etudeSpecifique) w.push(`${f.code} : la valorisation de ce matériau nécessite des études spécifiques.`);
  return w;
}

/**
 * Classement complet d'un matériau alternatif : famille, paramètre déterminant, état hydrique
 * pour les deux familles qui en portent un, insensibilité des mâchefers, contrôle des schistes
 * houillers par leur taux d'imbrûlés, réserves environnementales.
 *
 * @param p { code, ipi, wSurWopn, tamisat63, cbri, tauxImbrules }
 * @returns {{ famille, etat, symbole, estClasse, insensible, etapes, manquants, avertissements }}
 */
export function classerMateriauAlternatif({ code, ipi = null, wSurWopn = null, tamisat63 = null, cbri = null, tauxImbrules = null } = {}) {
  const etapes = [], manquants = [], avertissements = [];
  const f = familleAlternative(code);
  if (f == null) {
    manquants.push("famille de matériau alternatif (code CEN TS 17438)");
    return { famille: null, etat: null, symbole: "—", estClasse: false, insensible: null, etapes, manquants, avertissements };
  }

  etapes.push(etape(`Famille ${f.code} — ${f.nom} (${f.sousGroupe}).`, [], f.code));
  etapes.push(etape(`Paramètre déterminant : ${f.parametre}`));

  const lu = etatAlternatifDetaille(f.code, ipi, wSurWopn);
  if (f.etatsHydriques) {
    if (lu) etapes.push(lu.etape);
    else manquants.push("IPI ou w_n/w_OPN pour l'état hydrique");
  }

  let insensible = null;
  if (f.code === "AM-B1") {
    insensible = machefereInsensible(tamisat63, cbri);
    const comps = [];
    if (mesure(tamisat63)) comps.push(cmp("tamisat63", tamisat63, tamisat63 <= MIDND_FINES_MAX ? "≤" : ">", MIDND_FINES_MAX));
    if (mesure(cbri)) comps.push(cmp("cbri", cbri, cbri > MIDND_CBRI_MIN ? ">" : "≤", MIDND_CBRI_MIN));
    etapes.push(etape(insensible
      ? "Passant à 63 µm ≤ 10 % et CBR immergé > 20 : mâchefer insensible à l'eau."
      : "Insensibilité à l'eau non acquise : elle demande un passant à 63 µm ≤ 10 % "
        + "ET un CBR immergé supérieur à 20.", comps, insensible ? "ins" : null));
  }

  if (f.sousGroupe === "Schistes houillers" && mesure(tauxImbrules)) {
    const s = classerSchisteHouiller(tauxImbrules);
    etapes.push(...s.etapes);
    if (s.classe.code !== f.code) {
      avertissements.push(`Le taux d'imbrûlés mesuré désigne la famille ${s.classe.code}, pas ${f.code}.`);
    }
  }

  avertissements.push(...reservesEnvironnementales(f));
  avertissements.push("Matériau alternatif : le tableau 17 ne le range pas parmi les cas de PST. "
    + "Une fois ses conditions d'emploi vérifiées, il se rapporte à la classe de sol "
    + "ou de roche équivalente pour le classement de la plate-forme.");

  const etat = lu?.etat ?? null;
  return { famille: f, etat, symbole: symboleAlternatif(f.code, etat), estClasse: true, insensible, etapes, manquants, avertissements };
}
