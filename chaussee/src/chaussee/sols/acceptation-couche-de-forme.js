// Critères d'acceptation d'un matériau en couche de forme (GTR 2024, § 4.2) et conditions
// d'utilisation par classe (fascicule 2, annexe 3) — portage de Gtr2024CappingAcceptance et
// Gtr2024CappingTechniques de Burmister-Calc.
//
// Le guide est explicite sur un point que le module respecte : le respect de l'ensemble des
// critères est impératif sur les grands chantiers, mais certaines exigences peuvent être modulées
// ailleurs — c'est au géotechnicien d'apprécier. Un critère qu'aucun essai fourni ne permet de
// trancher reste indécis (satisfait: null) : le guide n'autorise alors ni à accepter ni à refuser.
//
// Les cinq critères : "insensibilite-eau", "dimension-elements", "resistance-trafic", "gel",
// "performances-traitement". Traitement de la couche : "aucun" | "chaux" | "liant".

import { familleDe } from "./gtr2024.js";
import { nombre } from "./justification.js";

export const REFERENCE_ACCEPTATION =
  "GTR 2024 (IDRRIM/Cerema), fascicule 1 § 4.2 (p. 63-71) et fascicule 2 annexe 3 (p. 53-70)";

// ═══════════════════════════════ Code GWTS (tableau 15) ═══════════════════════════════

export const REFERENCE_TECHNIQUES = "GTR 2024, fascicule 1, tableau 15 (p. 70)";

/**
 * Actions de préparation et de protection d'un matériau de couche de forme, codifiées sur quatre
 * rubriques : G granularité, W teneur en eau, T traitement, S protection superficielle. Le code
 * GWTS accole les quatre chiffres.
 */
export const TECHNIQUES_GWTS = [
  // G — action sur la granularité
  { rubrique: "G", code: 0, libelle: "Pas de condition particulière à recommander" },
  { rubrique: "G", code: 1, libelle: "Élimination de la fraction 0/d sensible à l'eau" },
  { rubrique: "G", code: 2, libelle: "Élimination de la fraction grossière empêchant un malaxage correct du sol" },
  { rubrique: "G", code: 3, libelle: "Élimination de la fraction grossière empêchant un réglage correct de la plateforme" },
  { rubrique: "G", code: 4, libelle: "Élimination de la fraction 0/d sensible à l'eau et de la fraction grossière empêchant un réglage correct" },
  { rubrique: "G", code: 5, libelle: "Fragmentation de la fraction grossière pour l'obtention d'éléments fins" },
  // W — action sur la teneur en eau
  { rubrique: "W", code: 0, libelle: "Pas de condition particulière à recommander" },
  { rubrique: "W", code: 1, libelle: "Arrosage ou humidification pour gestion de l'état hydrique" },
  // T — traitement
  { rubrique: "T", code: 0, libelle: "Pas de condition particulière à recommander" },
  { rubrique: "T", code: 1, libelle: "Traitement avec un liant hydraulique (ciment ou LHR)" },
  { rubrique: "T", code: 2, libelle: "Traitement avec un liant hydraulique éventuellement associé à la chaux" },
  { rubrique: "T", code: 3, libelle: "Traitement mixte : chaux + liant hydraulique" },
  { rubrique: "T", code: 4, libelle: "Traitement à la chaux seule" },
  { rubrique: "T", code: 5, libelle: "Traitement avec un liant hydraulique et éventuellement un correcteur granulométrique" },
  // S — protection superficielle
  { rubrique: "S", code: 0, libelle: "Pas de condition particulière à recommander" },
  { rubrique: "S", code: 1, libelle: "Enduit de cure éventuellement gravillonné" },
  { rubrique: "S", code: 2, libelle: "Enduit de cure gravillonné éventuellement clouté" },
  { rubrique: "S", code: 3, libelle: "Couche de fin réglage" },
];

/** Technique d'une rubrique (« G », « W », « T », « S ») et d'un code, null si inconnue. */
export const technique = (rubrique, code) =>
  TECHNIQUES_GWTS.find((t) => t.rubrique === rubrique && t.code === code) ?? null;

/** Traduit un code GWTS (« 0122 ») en actions lisibles, en omettant les rubriques à zéro. */
export function decrireCodeGwts(gwts) {
  if (gwts == null || String(gwts).length !== 4) return [];
  const lignes = [];
  const rubriques = "GWTS";
  for (let i = 0; i < 4; i++) {
    const ch = String(gwts)[i];
    if (!/\d/.test(ch)) continue;
    const code = Number(ch);
    if (code === 0) continue;
    const t = technique(rubriques[i], code);
    if (t) lignes.push(`${t.rubrique}${t.code} — ${t.libelle}`);
  }
  return lignes;
}

// ═══════════════════════════════ Seuils du guide ═══════════════════════════════

/** Lmax maximale admise en couche de forme non traitée (mm). */
export const LMAX_MAX_NON_TRAITE = 250;
/** Dmax admise pour un matériau traité, selon le mode de malaxage (mm). */
export const DMAX_MAX_CENTRALE = 63;
export const DMAX_MAX_EN_PLACE = 100;
/** Seuils de résistance mécanique du § 2.2.1, repris comme critères de trafic de chantier. */
export const LA_MAX = 45;
export const MDE_MAX = 45;
export const FS_MAX = 60;
/**
 * Tolérance sur LA et MDE lorsque la fraction 0/d a été éliminée (rubrique G1) : le guide admet
 * des valeurs « légèrement supérieures », sans dépasser 50.
 */
export const LA_MAX_APRES_ELIMINATION_FINES = 50;
/** Absorption d'eau (%) au-dessous de laquelle le matériau est insensible à la gélifraction. */
export const WA24_MAX = 2;
/** Pente de gonflement au gel admissible pour un matériau traité (mm/(°C·h)^0,5). */
export const PENTE_GONFLEMENT_MAX = 0.05;
/** Résistance en compression simple exigée à défaut d'essai de gonflement, chaux seule (MPa). */
export const RC_MIN_CHAUX = 2.5;
/** Résistance en traction diamétrale exigée à défaut d'essai de gonflement, liants hydrauliques (MPa). */
export const RIT_MIN_LIANT = 0.25;
/** Fenêtre dans laquelle une étude spécifique d'insensibilité à l'eau reste possible. */
export const ETUDE_SPECIFIQUE_VBS_MAX = 0.2;
export const ETUDE_SPECIFIQUE_FINES_MAX = 12;

// ═══════════════════════════════ Tableau 13 ═══════════════════════════════

/**
 * Tableau 13 (p. 64) : épaisseur de la couche élémentaire compactée (cm), Lmax admise (mm) et
 * classe 0/D. La règle générale reste Lmax ≤ 250 mm et Lmax ≤ la moitié de l'épaisseur compactée.
 */
export const COUCHES_ELEMENTAIRES = [
  { epaisseur: 30, lmaxMax: 150, classeGranulaire: "0/90 mm" },
  { epaisseur: 35, lmaxMax: 175, classeGranulaire: "0/100 mm" },
  { epaisseur: 40, lmaxMax: 200, classeGranulaire: "0/120 mm" },
  { epaisseur: 45, lmaxMax: 225, classeGranulaire: "0/135 mm" },
  { epaisseur: 50, lmaxMax: 250, classeGranulaire: "0/150 mm" },
  { epaisseur: 60, lmaxMax: 250, classeGranulaire: "0/150 mm" },
];

/** Ligne du tableau 13 applicable à une épaisseur de couche élémentaire (cm), null sous 30 cm. */
export function coucheElementairePour(epaisseurCm) {
  let retenue = null;
  for (const l of COUCHES_ELEMENTAIRES) if (epaisseurCm >= l.epaisseur) retenue = l;
  return retenue;
}

// ═══════════════════════════════ Tableau 14 ═══════════════════════════════

/**
 * Tableau 14 (p. 67) : classe mécanique d'un matériau traité selon la zone de l'abaque et le
 * mode de traitement. Le traitement en place perd un rang par rapport au traitement en
 * centrale, pour tenir compte de l'hétérogénéité du mélange : la zone 1 en place ne donne qu'une
 * classe 2, et la zone 5 en place ne donne plus de classe (null).
 */
export function classeMecanique(zone, malaxageEnPlace) {
  if (!Number.isInteger(zone) || zone < 1 || zone > 5) return null;
  const cls = malaxageEnPlace ? zone + 1 : zone;
  return cls >= 1 && cls <= 5 ? cls : null;
}

// ═══════════════════════════════ Annexe 3 : conditions par classe ═══════════════════════════════

const usage = (groupe, utilisableEnEtat, utilisableTraite, traitements, observation) =>
  ({ groupe, utilisableEnEtat, utilisableTraite, traitements, observation });

/**
 * Ce que l'annexe 3 dit d'une famille de classes : utilisable en l'état ou non, traitements
 * applicables (codes T du tableau 15), et l'observation générale du guide.
 */
export const USAGES_ANNEXE3 = [
  usage("F1, F2", false, true, [2],
    "La grande sensibilité à l'eau de ces sols impose de les traiter avec des liants hydrauliques "
    + "éventuellement associés à de la chaux. La maîtrise de l'état hydrique du sol traité est souvent "
    + "délicate : leur portance varie brutalement pour de faibles écarts de teneur en eau. "
    + "Traitement en place ou en centrale."),
  usage("F3", false, true, [3, 4],
    "La sensibilité à l'eau et la plasticité élevée imposent un traitement associant chaux et liant "
    + "hydraulique. Pour les plus plastiques, un traitement à la chaux seule est envisageable, notamment "
    + "en l'absence de risque de gel peu après la réalisation. Ces sols se traitent exclusivement en place. "
    + "À l'état sec, leur emploi en couche de forme est à déconseiller : l'humidification homogène est difficile."),
  usage("F4", false, false, [], "Sols normalement inutilisables en couche de forme."),
  usage("I1, I2", false, true, [2, 3],
    "La grande sensibilité à l'eau impose de traiter ces sols : liant hydraulique pour les moins argileux, "
    + "chaux associée au liant hydraulique pour les plus argileux et les plus humides. "
    + "Traitement le plus souvent en place, éventuellement en centrale après un prétraitement à la chaux."),
  usage("S…1ins (sables propres, grains résistants)", true, true, [1, 5],
    "Insensibles à l'eau mais peu « traficables » du fait de leur finesse et de leur uniformité granulaire. "
    + "Deux voies : traiter avec un liant hydraulique, ou les employer non traités moyennant une correction "
    + "granulométrique (se reporter alors à la classe du matériau élaboré) ou un cloutage de surface."),
  usage("S…1 (sables sensibles à l'eau)", false, true, [1],
    "La sensibilité à l'eau impose un traitement au liant hydraulique. Traitement souvent en place, "
    + "en centrale possible quand l'état hydrique est moyen ou sec."),
  usage("S…2ins (sables propres, grains friables)", false, true, [1],
    "Insensibles à l'eau mais peu traficables, et constitués de grains friables qui, sous l'action du trafic, "
    + "pourraient se transformer en éléments fins sensibles à l'eau. Ils doivent donc être traités avec un "
    + "liant hydraulique pour être utilisables."),
  usage("S…2 (sables friables sensibles à l'eau)", false, true, [1, 5],
    "Sensibles à l'eau et à grains friables : traitement au liant hydraulique, éventuellement associé à un "
    + "correcteur granulométrique."),
  usage("G…1ins (graves propres, granulats résistants)", true, true, [1],
    "Insensibles à l'eau et constitués de granulats résistants : utilisables en couche de forme dans leur "
    + "état naturel, ou traités avec un liant hydraulique en place ou en centrale. L'emploi à l'état naturel "
    + "exige la vérification des spécifications complémentaires (insensibilité au gel, Dmax)."),
  usage("G…1 (graves sensibles à l'eau, fraction grenue résistante)", false, true, [1],
    "Ces sols contiennent une fraction fine en faible quantité mais suffisante pour les rendre très sensibles "
    + "à l'eau ; leur fraction grenue est résistante et ne risque pas de se broyer sous le trafic. Deux "
    + "solutions : éliminer la fraction 0/d responsable de la sensibilité à l'eau — le matériau élaboré change "
    + "alors de classe et doit à son tour vérifier les spécifications — ou traiter au liant hydraulique."),
  usage("G…2ins et G…2 (graves à granulats peu résistants)", false, true, [1],
    "La fraction grenue ne satisfait pas les seuils de LA et MDE : elle risque de produire des fines sous le "
    + "trafic de chantier. Un traitement au liant hydraulique est nécessaire."),
];

const usageDuGroupe = (groupe) => USAGES_ANNEXE3.find((u) => u.groupe === groupe) ?? null;

/**
 * Conditions d'utilisation de la famille à laquelle appartient une classe. Null pour les classes
 * que l'annexe 3 traite ailleurs (VC, CH, R, O et matériaux alternatifs).
 */
export function usagePour(classeNature, sousClasse = null, insensible = false) {
  if (classeNature == null) return null;
  if (classeNature.startsWith("F4")) return usageDuGroupe("F4");
  if (classeNature === "F1" || classeNature === "F2") return usageDuGroupe("F1, F2");
  if (classeNature === "F3") return usageDuGroupe("F3");
  if (classeNature === "I1" || classeNature === "I2") return usageDuGroupe("I1, I2");

  const famille = familleDe(classeNature) ?? "";
  if (famille !== "S" && famille !== "G") return null;

  // La sous-classe mécanique (…1 ou …2) décide autant que l'insensibilité à l'eau.
  const resistant = sousClasse == null || sousClasse.endsWith("1");
  if (famille === "S") {
    if (resistant && insensible) return usageDuGroupe("S…1ins (sables propres, grains résistants)");
    if (resistant) return usageDuGroupe("S…1 (sables sensibles à l'eau)");
    if (insensible) return usageDuGroupe("S…2ins (sables propres, grains friables)");
    return usageDuGroupe("S…2 (sables friables sensibles à l'eau)");
  }
  if (resistant && insensible) return usageDuGroupe("G…1ins (graves propres, granulats résistants)");
  if (resistant) return usageDuGroupe("G…1 (graves sensibles à l'eau, fraction grenue résistante)");
  return usageDuGroupe("G…2ins et G…2 (graves à granulats peu résistants)");
}

// ═══════════════════════════════ Examen d'acceptation ═══════════════════════════════

const controle = (critere, nom, satisfait, verdict, exigence = null) => ({ critere, nom, satisfait, verdict, exigence });
const vaut = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Examine un matériau au regard des cinq critères du § 4.2.1.
 *
 * @param id              identification du matériau (identification.js)
 * @param classification  résultat de classerSol(id)
 * @param traitement      "aucun" | "chaux" | "liant"
 * @param options { epaisseurCouche = 30 (cm, couche élémentaire compactée),
 *                  malaxageEnPlace = true (Dmax 100 mm, sinon 63 mm en centrale),
 *                  verifierGel = false (le contexte impose-t-il l'insensibilité au gel ?) }
 * @returns {{ acceptable: true|false|null, controles, echecs, indecis, usage, techniques,
 *             avertissements, resume }}
 */
export function evaluerAcceptation(id, classification, traitement = "aucun", {
  epaisseurCouche = 30, malaxageEnPlace = true, verifierGel = false,
} = {}) {
  const controles = [], avertissements = [];
  const traite = traitement !== "aucun";

  controles.push(controleInsensibiliteEau(id, classification, traite, avertissements));
  controles.push(controleDimension(id, traite, malaxageEnPlace, epaisseurCouche));
  if (!traite) controles.push(controleTrafic(id, classification));
  if (verifierGel) controles.push(controleGel(id, classification, traitement));
  if (traite) controles.push(controlePerformances(id, classification, traitement, malaxageEnPlace, avertissements));

  const u = usagePour(classification.classeNature, classification.sousClasse, classification.insensible);

  if (u && !u.utilisableTraite && !u.utilisableEnEtat) {
    avertissements.push(`Annexe 3, classe ${u.groupe} : ${u.observation}`);
  } else if (u && !traite && !u.utilisableEnEtat) {
    avertissements.push(`Annexe 3 : les sols ${u.groupe} ne sont pas utilisables en couche de forme `
      + "sans traitement.");
  }

  let acceptable = controles.some((c) => c.satisfait === false) ? false
    : controles.some((c) => c.satisfait == null) ? null
      : true;

  // Une classe déclarée inutilisable par l'annexe 3 l'emporte sur les critères chiffrés.
  if (u && !u.utilisableEnEtat && !u.utilisableTraite) acceptable = false;
  if (u && !u.utilisableEnEtat && !traite) acceptable = false;

  const techniques = [];
  for (const t of u?.traitements ?? []) {
    const tech = technique("T", t);
    if (tech) techniques.push(`T${tech.code} — ${tech.libelle}`);
  }

  return {
    acceptable, controles,
    echecs: controles.filter((c) => c.satisfait === false),
    indecis: controles.filter((c) => c.satisfait == null),
    usage: u, techniques, avertissements,
    resume: acceptable === true ? "Matériau acceptable en couche de forme."
      : acceptable === false ? "Matériau non acceptable en couche de forme en l'état."
        : "Acceptation indéterminée : essais manquants.",
  };
}

function controleInsensibiliteEau(id, c, traite, avertissements) {
  const nom = "Insensibilité à l'eau";
  const exigence = "Caractéristiques mécaniques très peu dépendantes de l'état hydrique, à l'état naturel ou "
    + "après modification (traitement, élimination de la fraction 0/d).";
  const k = "insensibilite-eau";

  if (traite) {
    avertissements.push("Les sols traités restent souvent sensibles à l'eau au jeune âge : le choix du liant "
      + "et son dosage doivent en tenir compte, au vu de la chute de résistance en compression "
      + "après immersion et de la période prévisionnelle des travaux.");
    return controle(k, nom, true, "Insensibilité obtenue par le traitement, sous réserve de l'étude de traitement (GTS).", exigence);
  }

  if (c.insensible) {
    return controle(k, nom, true, `Matériau ${c.symbole} : insensible à l'eau au sens des critères de l'annexe 1.`, exigence);
  }

  // Les critères d'insensibilité de l'annexe 1 ne concernent que les sables et les graves. Un sol
  // fin ou intermédiaire est sensible à l'eau par nature : aucun essai ne le rachète.
  const famille = familleDe(c.classeNature) ?? "";
  if (famille === "F" || famille === "I") {
    return controle(k, nom, false,
      `Sol ${famille === "F" ? "fin" : "intermédiaire"} de classe ${c.classeNature} : `
      + "sensible à l'eau par nature. Son emploi en couche de forme passe nécessairement par un traitement.", exigence);
  }

  if (!vaut(id.tamisat63) || !vaut(id.vbs)) {
    return controle(k, nom, null, "Tamisat à 63 µm et VBS nécessaires pour statuer sur l'insensibilité à l'eau.", exigence);
  }
  const fines = id.tamisat63, vbs = id.vbs;

  if (vbs < ETUDE_SPECIFIQUE_VBS_MAX && fines < ETUDE_SPECIFIQUE_FINES_MAX) {
    return controle(k, nom, null,
      `VBS ${nombre(vbs, 3)} < 0,2 et tamisat à 63 µm ${nombre(fines)} % < 12 % : le matériau ne satisfait pas `
      + "les critères d'insensibilité, mais une étude spécifique reste possible (granulométrie et VBS, "
      + "CBR immergé, courbes Proctor et IPI, planche d'essai avec mesure à la plaque avant et après arrosage).", exigence);
  }

  return controle(k, nom, false,
    `Matériau sensible à l'eau (VBS ${nombre(vbs, 3)}, tamisat à 63 µm ${nombre(fines)} %) : il faut le traiter, `
    + "éliminer la fraction 0/d, ou changer de matériau.", exigence);
}

function controleDimension(id, traite, malaxageEnPlace, epaisseurCm) {
  const nom = "Dimension des plus gros éléments";
  const k = "dimension-elements";

  if (traite) {
    const max = malaxageEnPlace ? DMAX_MAX_EN_PLACE : DMAX_MAX_CENTRALE;
    const mode = malaxageEnPlace ? "malaxage en place" : "malaxage en centrale";
    const exigence = `Dmax ≤ ${max} mm (${mode}).`;
    if (!vaut(id.dmax)) return controle(k, nom, null, "Dmax non renseigné.", exigence);
    const ok = id.dmax <= max;
    return controle(k, nom, ok, ok
      ? `Dmax ${nombre(id.dmax)} mm ≤ ${max} mm.`
      : `Dmax ${nombre(id.dmax)} mm > ${max} mm : éliminer ou fragmenter la fraction grossière. Des valeurs `
        + "sensiblement supérieures restent admissibles selon la puissance des matériels de malaxage.", exigence);
  }

  const demiEpaisseur = (epaisseurCm * 10) / 2; // cm → mm
  const ligne = coucheElementairePour(epaisseurCm);
  const indice = ligne == null ? ""
    : ` Tableau 13 : pour une couche élémentaire de ${nombre(ligne.epaisseur, 0)} cm, Lmax ≤ ${nombre(ligne.lmaxMax, 0)} mm `
      + `(matériau ${ligne.classeGranulaire}).`;
  const exigence = `Lmax ≤ ${LMAX_MAX_NON_TRAITE} mm et Lmax ≤ la moitié de l'épaisseur de la couche `
    + `élémentaire compactée, soit ${nombre(demiEpaisseur, 0)} mm ici.${indice}`;

  if (!vaut(id.lmax)) {
    return controle(k, nom, null, "Lmax non renseignée (elle peut être estimée visuellement ou au mètre ruban).", exigence);
  }

  const admise = Math.min(LMAX_MAX_NON_TRAITE, demiEpaisseur);
  const ok = id.lmax <= admise;
  return controle(k, nom, ok, ok
    ? `Lmax ${nombre(id.lmax)} mm ≤ ${nombre(admise, 0)} mm.`
    : `Lmax ${nombre(id.lmax)} mm > ${nombre(admise, 0)} mm : prévoir une couche de réglage de 5 à 10 cm en matériau `
      + "plus fin, ou éliminer la fraction grossière. Sur une PST1 où la couche de forme sert aussi de "
      + "blocage, la limite de 250 mm peut exceptionnellement être dépassée.", exigence);
}

function controleTrafic(id, c) {
  const nom = "Résistance au trafic de chantier";
  const k = "resistance-trafic";
  const famille = familleDe(c.classeNature) ?? "";

  if (famille === "S") {
    const exigence = `Friabilité des sables FS ≤ ${FS_MAX}.`;
    if (!vaut(id.friabilite)) return controle(k, nom, null, "FS non mesurée.", exigence);
    const ok = id.friabilite <= FS_MAX;
    return controle(k, nom, ok, ok
      ? `FS ${nombre(id.friabilite)} ≤ ${FS_MAX}.`
      : `FS ${nombre(id.friabilite)} > ${FS_MAX} : les grains risquent de se transformer en fines `
        + "sensibles à l'eau sous le trafic.", exigence);
  }

  const exigence = `Los Angeles ≤ ${LA_MAX} et micro-Deval ≤ ${MDE_MAX} `
    + `(jusqu'à ${LA_MAX_APRES_ELIMINATION_FINES} admis après élimination de la fraction 0/d).`;

  if (!vaut(id.losAngeles) || !vaut(id.microDeval)) {
    return controle(k, nom, null, "Los Angeles et micro-Deval non mesurés.", exigence);
  }
  const la = id.losAngeles, mde = id.microDeval;
  const ok = la <= LA_MAX && mde <= MDE_MAX;
  const tolere = !ok && la <= LA_MAX_APRES_ELIMINATION_FINES && mde <= LA_MAX_APRES_ELIMINATION_FINES;

  return controle(k, nom, ok ? true : tolere ? null : false,
    ok ? `LA ${nombre(la)} et MDE ${nombre(mde)} sous le seuil de ${LA_MAX}.`
      : tolere
        ? `LA ${nombre(la)} / MDE ${nombre(mde)} au-dessus de 45 mais sous 50 : acceptable seulement si la fraction `
          + "0/d est éliminée (rubrique G1)."
        : `LA ${nombre(la)} / MDE ${nombre(mde)} : le matériau produira des fines sous compactage et trafic, `
          + "ce qui le rendrait sensible à l'eau.", exigence);
}

function controleGel(id, c, traitement) {
  const nom = "Insensibilité au gel";
  const k = "gel";

  if (traitement === "aucun") {
    const exigence = "Insensibilité à l'eau, et insensibilité à la gélifraction : LA ≤ 45 et MDE ≤ 45, "
      + "ou catégorie F4 au gel-dégel (NF EN 1367-1), ou WA24 ≤ 2 %.";

    if (!c.insensible) {
      return controle(k, nom, false, "Matériau sensible à l'eau : il ne peut pas être déclaré insensible au gel.", exigence);
    }

    // Un essai manquant ne satisfait aucun des trois critères.
    const parLaMde = vaut(id.losAngeles) && vaut(id.microDeval) && id.losAngeles <= LA_MAX && id.microDeval <= MDE_MAX;
    const parCategorie = id.gelDegelF4 === true;
    const parAbsorption = vaut(id.wa24) && id.wa24 <= WA24_MAX;

    if (parLaMde || parCategorie || parAbsorption) {
      const pourquoi = parLaMde ? `LA ${nombre(id.losAngeles)} et MDE ${nombre(id.microDeval)} ≤ 45`
        : parCategorie ? "catégorie F4 à l'essai de gel-dégel"
          : `WA24 ${nombre(id.wa24, 2)} % ≤ 2 %`;
      return controle(k, nom, true, `Insensible à l'eau et à la gélifraction (${pourquoi}).`, exigence);
    }
    return controle(k, nom, null,
      "Aucun des trois critères de gélifraction n'est renseigné (LA et MDE, catégorie F4, ou WA24).", exigence);
  }

  const exigence = "Pente p ≤ 0,05 mm/(°C·h)^0,5 à l'essai de gonflement au gel (NF P98-234-2). "
    + "À défaut : Rc ≥ 2,5 MPa pour la chaux seule, Rit ≥ 0,25 MPa pour les liants "
    + "hydrauliques, à l'âge de première apparition statistique du gel dans la région.";

  if (vaut(id.penteGonflement)) {
    const p = id.penteGonflement, ok = p <= PENTE_GONFLEMENT_MAX;
    return controle(k, nom, ok, ok
      ? `Pente de gonflement ${nombre(p, 3)} ≤ ${nombre(PENTE_GONFLEMENT_MAX, 2)} : matériau non gélif.`
      : `Pente de gonflement ${nombre(p, 3)} > ${nombre(PENTE_GONFLEMENT_MAX, 2)} : matériau gélif.`, exigence);
  }

  if (traitement === "chaux" && vaut(id.rcTraite)) {
    const rc = id.rcTraite, ok = rc >= RC_MIN_CHAUX;
    return controle(k, nom, ok, ok
      ? `Rc ${nombre(rc, 2)} MPa ≥ 2,5 MPa : non gélif à défaut d'essai de gonflement. Les craies et marnes `
        + "exigent en plus une mouture ≤ 20 mm et un passant à 5 mm ≥ 60 %."
      : `Rc ${nombre(rc, 2)} MPa < 2,5 MPa.`, exigence);
  }

  if (traitement === "liant" && vaut(id.ritTraite)) {
    const rit = id.ritTraite, ok = rit >= RIT_MIN_LIANT;
    return controle(k, nom, ok, ok
      ? `Rit ${nombre(rit, 3)} MPa ≥ 0,25 MPa : non gélif à défaut d'essai de gonflement.`
      : `Rit ${nombre(rit, 3)} MPa < 0,25 MPa.`, exigence);
  }

  return controle(k, nom, null, "Ni pente de gonflement au gel, ni résistance de substitution renseignée.", exigence);
}

function controlePerformances(id, c, traitement, malaxageEnPlace, avertissements) {
  const nom = "Performances mécaniques du matériau traité";
  const k = "performances-traitement";
  const exigence = "Étude de traitement conforme au GTS, aux normes NF P94-102-1 et -2 et à la NF EN 16907-4. "
    + "Classe mécanique lue sur l'abaque de la figure 12 (E et Rt à 90 jours), puis corrigée du mode "
    + "de traitement (tableau 14).";

  if (traitement === "chaux" && c.classeNature != null && c.classeNature !== "F3") {
    return controle(k, nom, false,
      "Le traitement à la chaux seule en couche de forme n'est applicable qu'aux sols F3 ; "
      + `le matériau est classé ${c.classeNature}.`, exigence);
  }

  if (!Number.isInteger(id.zoneAbaque)) {
    return controle(k, nom, null,
      "Zone de l'abaque non renseignée : elle se lit à 90 jours dans le plan (E, Rt) sur éprouvette "
      + "moulée à la compacité prévisible en fond de couche.", exigence);
  }
  const zone = id.zoneAbaque;
  const meca = classeMecanique(zone, malaxageEnPlace);
  if (meca == null) {
    return controle(k, nom, false,
      `Zone ${zone} en traitement en place : le tableau 14 ne lui associe aucune classe mécanique. `
      + "Un traitement en centrale est nécessaire.", exigence);
  }

  if (malaxageEnPlace) {
    avertissements.push("Traitement en place : le tableau 14 décale la classe mécanique d'un rang pour tenir "
      + `compte de l'hétérogénéité du mélange (zone ${zone} → classe ${meca}).`);
  }
  return controle(k, nom, true,
    `Zone ${zone} de l'abaque, traitement ${malaxageEnPlace ? "en place" : "en centrale"} → classe mécanique ${meca}.`, exigence);
}
