// Classification des sols selon le GTR 2024 (portage de Gtr2024Classifier de Burmister-Calc) :
// synoptique de nature (fascicule 2, annexe 1, p. 12) puis état hydrique (tableaux de l'annexe 1
// et tableau 2 du fascicule 1). Les classes A / B / C / D du GTR 2000 n'existent plus : la
// nomenclature 2024 est alignée sur la NF EN 16907-2.
//
// Traite les sols des classes F, I, S et G — ceux que les essais de laboratoire usuels
// identifient — et les sols blocailleux VC par leur fraction 0/63 mm. Les matériaux rocheux et
// les craies sont classés par roches.js, les sols organiques et les matériaux alternatifs par
// organiques-alternatifs.js.
//
// Résultat de classerSol(identification) :
//   { classeNature, famille, description, sousClasse, etat, insensible, sousFraction,
//     dmaxBlocailleux, estClasse, estBlocailleux, symbole, etapes, manquants, avertissements }
// `etapes` est le chemin suivi dans le synoptique (voir justification.js) ; `manquants` dit
// quels essais manquent, plutôt que de les deviner.

import { comparaison as cmp, encadrement, etape, lirePaliers, memeNom, mesure, nombre } from "./justification.js";
import { CAS_PST, afficherEtat, trouverPst } from "./plateforme.js";

export const REFERENCE_GTR2024 =
  "GTR 2024 (IDRRIM/Cerema), fascicule 2 annexe 1 (p. 12-26) et fascicule 1 tableau 2 (p. 34)";

/** Classes de nature du GTR 2024 : { nom, famille, description }. */
export const CLASSES_NATURE = [
  { nom: "F1", famille: "F", description: "Limons peu plastiques, lœss, silts alluvionnaires, sables fins peu pollués, arènes peu plastiques" },
  { nom: "F2", famille: "F", description: "Sables fins argileux, limons, argiles et marnes peu plastiques" },
  { nom: "F3", famille: "F", description: "Argiles et argiles marneuses, limons très plastiques" },
  { nom: "F4", famille: "F", description: "Argiles et argiles marneuses très plastiques" },
  { nom: "F4+", famille: "F", description: "Argiles très plastiques (Ip > 55) : hors étude spécifique, remblais de faible hauteur seulement" },
  { nom: "I1", famille: "I", description: "Sables et graves très silteux" },
  { nom: "I2", famille: "I", description: "Sables et graves argileux à très argileux" },
  { nom: "S1", famille: "S", description: "Sables propres ou silteux, granulométrie étalée" },
  { nom: "S2", famille: "S", description: "Sables propres ou silteux, granulométrie mal graduée" },
  { nom: "S3", famille: "S", description: "Sables limoneux ou argileux (peu argileux), granulométrie étalée" },
  { nom: "S4", famille: "S", description: "Sables limoneux ou argileux (peu argileux), granulométrie mal graduée" },
  { nom: "G1", famille: "G", description: "Graves à peu de fines, granulométrie étalée, roulées à anguleuses" },
  { nom: "G2", famille: "G", description: "Graves homométriques à peu de fines (galets, matériaux rocheux)" },
  { nom: "G3", famille: "G", description: "Graves silteuses ou argileuses (peu argileuses), granulométrie étalée" },
  { nom: "G4", famille: "G", description: "Graves silteuses ou argileuses (peu argileuses), mal graduées" },
  { nom: "VC1", famille: "VC", description: "Sol blocailleux dont le comportement est piloté par la fraction > 63 mm" },
  { nom: "VC2", famille: "VC", description: "Sol blocailleux dont le comportement est piloté par la fraction 0/63 mm" },
];

/** Classe de nature par son nom (casse indifférente), null si inconnue. */
export const natureDe = (nom) => CLASSES_NATURE.find((c) => memeNom(c.nom, nom)) ?? null;

/** Famille (F, I, S, G, VC) d'une classe de nature, null si inconnue. */
export const familleDe = (nom) => natureDe(nom)?.famille ?? null;

/** Bornes de la bande qui sépare VC1 de VC2 (part de la fraction 0/63 mm, %). */
export const VC_BANDE_BASSE = 60;
export const VC_BANDE_HAUTE = 80;

// ─────────────────────────────── Résultat et symbole ───────────────────────────────

/**
 * Symbole complet tel qu'il s'écrit dans le guide : classe de nature, sous-classe mécanique
 * éventuelle, puis état hydrique ou le suffixe « ins » des matériaux insensibles à l'eau. Pour un
 * sol blocailleux, le Dmax et la classe de la fraction 0/63 mm s'y accolent (VC2¹⁵⁰S3h s'écrit
 * « VC2150S3h »).
 */
export function symboleSol(c) {
  if (c?.classeNature == null) return "—";
  if (c.classeNature === "VC1" || c.classeNature === "VC2") {
    const dmax = mesure(c.dmaxBlocailleux) ? nombre(c.dmaxBlocailleux, 0) : "";
    return c.classeNature + dmax + (c.sousFraction?.symbole ?? "");
  }
  const racine = c.sousClasse ?? c.classeNature;
  if (c.insensible) return racine + "ins";
  return c.etat ? racine + c.etat : racine;
}

function resultat({
  classeNature = null, sousClasse = null, etat = null, insensible = false,
  sousFraction = null, dmaxBlocailleux = null, etapes, manquants, avertissements,
}) {
  const r = {
    classeNature, famille: familleDe(classeNature), description: natureDe(classeNature)?.description ?? "",
    sousClasse, etat, insensible, sousFraction, dmaxBlocailleux,
    estClasse: classeNature != null,
    estBlocailleux: classeNature === "VC1" || classeNature === "VC2",
    etapes, manquants, avertissements,
  };
  r.symbole = symboleSol(r);
  return r;
}

// ─────────────────────────────── Classification ───────────────────────────────

/**
 * Classe le sol à partir de ses résultats d'essais. Ce qui manque est signalé dans `manquants`
 * plutôt que deviné.
 */
export function classerSol(id = {}) {
  return classer(id, false);
}

function classer(id, enSousFraction) {
  const etapes = [], manquants = [], avertissements = [];

  // Sol blocailleux : le symbole est double, et c'est la fraction 0/63 mm qui porte l'état
  // hydrique comme la sensibilité à l'eau.
  if (mesure(id.dmax) && id.dmax > 63) return classerBlocailleux(id, id.dmax, etapes, manquants, avertissements);

  if (!enSousFraction) {
    etapes.push(mesure(id.dmax)
      ? etape(`Dmax = ${nombre(id.dmax)} mm ≤ 63 mm : sol sans gros éléments, classé sur sa granularité.`,
        [cmp("dmax", id.dmax, "≤", 63)])
      : etape("Dmax non renseigné : le sol est supposé sans gros éléments (Dmax ≤ 63 mm)."));
  }

  const nature = classerNature(id, etapes, manquants);
  if (nature == null) return resultat({ etapes, manquants, avertissements });

  const famille = familleDe(nature);
  const sousClasse = sousClasseMecanique(nature, famille, id, etapes, manquants);
  const insensible = insensibleALEau(famille, id, etapes);
  const etat = insensible ? null : etatHydrique(nature, famille, id, etapes, manquants, avertissements);

  return resultat({ classeNature: nature, sousClasse, etat, insensible, etapes, manquants, avertissements });
}

// ─────────────────────────────── Sols blocailleux (VC) ───────────────────────────────

/**
 * Sols comportant de gros éléments (Dmax > 63 mm). VC2 quand la fraction 0/63 mm domine — le
 * comportement est alors celui de cette fraction — VC1 quand le matériau est très charpenté et
 * que la fraction 63/D pèse aussi. Le seuil est une bande de 60 à 80 % : dans cette bande, le
 * guide laisse trancher le géotechnicien.
 */
function classerBlocailleux(id, dmax, etapes, manquants, avertissements) {
  etapes.push(etape(`Dmax = ${nombre(dmax)} mm > 63 mm : sol comportant de gros éléments, classe VC.`,
    [cmp("dmax", dmax, ">", 63)], "VC"));

  let nature;
  const part = id.fraction0a63;
  const b = nombre(VC_BANDE_BASSE, 0), h = nombre(VC_BANDE_HAUTE, 0);
  if (!mesure(part)) {
    nature = "VC2";
    manquants.push("part de la fraction 0/63 mm (%) pour trancher entre VC1 et VC2");
    etapes.push(etape("Part de la fraction 0/63 mm non mesurée : VC2 retenu par défaut.", [], "VC2"));
    avertissements.push("Sans la part de la fraction 0/63 mm, le classement VC2 est retenu par défaut "
      + `(cas le plus courant). VC1 s'impose si cette fraction ne dépasse pas ${b} à ${h} % : le comportement dépend `
      + "alors aussi de la fraction 63/D, et des essais en semi ou vraie grandeur sont souvent nécessaires.");
  } else if (part > VC_BANDE_HAUTE) {
    nature = "VC2";
    etapes.push(etape(`Fraction 0/63 mm = ${nombre(part)} % > ${h} % : matériau peu `
      + "charpenté, classe VC2 — le comportement est celui de la fraction 0/63 mm.",
    [cmp("fraction0a63", part, ">", VC_BANDE_HAUTE)], "VC2"));
  } else if (part <= VC_BANDE_BASSE) {
    nature = "VC1";
    etapes.push(etape(`Fraction 0/63 mm = ${nombre(part)} % ≤ ${b} % : matériau très charpenté, classe VC1.`,
      [cmp("fraction0a63", part, "≤", VC_BANDE_BASSE)], "VC1"));
    avertissements.push("VC1 : le comportement dépend aussi de la fraction 63/D et ne peut plus être "
      + "assimilé à celui de la seule fraction 0/63 mm. L'influence de cette fraction est "
      + "difficile à évaluer en laboratoire ; des essais en semi ou vraie grandeur sont "
      + "souvent nécessaires.");
  } else {
    nature = "VC2";
    etapes.push(etape(`Fraction 0/63 mm = ${nombre(part)} % : dans la bande ${b} à ${h} % du guide.`,
      [cmp("fraction0a63", part, ">", VC_BANDE_BASSE), cmp("fraction0a63", part, "≤", VC_BANDE_HAUTE)], "VC2"));
    avertissements.push(`La part de la fraction 0/63 mm tombe dans la bande ${b} à ${h} % du guide : `
      + "le guide n'y fixe pas de seuil. VC2 est retenu, "
      + "mais VC1 reste défendable selon l'angularité et la continuité granulométrique.");
  }

  // La fraction 0/63 mm se classe avec les règles ordinaires : c'est elle que les essais de
  // laboratoire caractérisent, et elle qui porte l'état hydrique.
  const sous = classer({ ...id, dmax: null, fraction0a63: null }, true);
  for (const e of sous.etapes) etapes.push({ ...e, texte: "Fraction 0/63 mm — " + e.texte });
  for (const m of sous.manquants) manquants.push(m + " (fraction 0/63 mm)");

  return resultat({
    classeNature: nature, sousClasse: null, etat: sous.etat, insensible: sous.insensible,
    sousFraction: sous.estClasse ? sous : null, dmaxBlocailleux: dmax, etapes, manquants, avertissements,
  });
}

// ─────────────────────────────── Nature ───────────────────────────────

function classerNature(id, etapes, manquants) {
  const fines = id.tamisat63;
  if (!mesure(fines)) {
    manquants.push("tamisat à 63 µm");
    return null;
  }
  const f = nombre(fines);

  if (fines > 35) {
    etapes.push(etape(`Tamisat à 63 µm = ${f} % > 35 % : sol fin, classe F.`, [cmp("tamisat63", fines, ">", 35)], "F"));
    return sousClasseFine(id, etapes, manquants);
  }

  if (fines > 15) {
    etapes.push(etape(`Tamisat à 63 µm = ${f} % (15 à 35 %) : sol intermédiaire, classe I.`,
      [cmp("tamisat63", fines, ">", 15), cmp("tamisat63", fines, "≤", 35)], "I"));
    // I1 : VBS ≤ 1,5 ou Ip ≤ 12 ; I2 au-delà. La VBS est le critère à privilégier.
    if (mesure(id.vbs)) {
      const vbs = id.vbs, i1 = vbs <= 1.5, cls = i1 ? "I1" : "I2";
      etapes.push(etape(`VBS = ${nombre(vbs, 2)} : ${i1 ? "≤ 1,5 → I1" : "> 1,5 → I2"}.`,
        [cmp("vbs", vbs, i1 ? "≤" : ">", 1.5)], cls));
      return cls;
    }
    if (mesure(id.ip)) {
      const ip = id.ip, i1 = ip <= 12, cls = i1 ? "I1" : "I2";
      etapes.push(etape(`Ip = ${nombre(ip)} : ${i1 ? "≤ 12 → I1" : "> 12 → I2"} (VBS à privilégier).`,
        [cmp("ip", ip, i1 ? "≤" : ">", 12)], cls));
      return cls;
    }
    manquants.push("VBS (ou Ip) pour distinguer I1 de I2");
    return null;
  }

  etapes.push(etape(`Tamisat à 63 µm = ${f} % ≤ 15 % : sol sableux (S) ou graveleux (G).`,
    [cmp("tamisat63", fines, "≤", 15)]));

  const tendance = tendanceDetaillee(id);
  if (tendance == null) {
    manquants.push("fractions 0,063/2 mm et 2/63 mm (ou tamisat à 2 mm) pour trancher sableux / graveleux");
    return null;
  }
  etapes.push(tendance.etape);

  const graduation = graduationDetaillee(id);
  if (graduation == null) {
    manquants.push("Cu = D60/D10 (ou D60 si les fines sont comprises entre 10 et 15 %)");
    return null;
  }
  etapes.push(graduation.etape);

  // Les fines séparent le couple 1/2 (≤ 5 %) du couple 3/4 (5 à 15 %).
  const propre = fines <= 5;
  const lettre = tendance.sableux ? "S" : "G";
  const indice = propre ? (graduation.etalee ? "1" : "2") : (graduation.etalee ? "3" : "4");
  const cls = lettre + indice;
  etapes.push(propre
    ? etape(`Tamisat à 63 µm = ${f} % ≤ 5 % : ${cls}.`, [cmp("tamisat63", fines, "≤", 5)], cls)
    : etape(`Tamisat à 63 µm = ${f} %, compris entre 5 et 15 % : ${cls}.`,
      [cmp("tamisat63", fines, ">", 5), cmp("tamisat63", fines, "≤", 15)], cls));
  return cls;
}

/** Tendance sableuse ou graveleuse, avec l'étape qui la justifie (null si indéterminable). */
function tendanceDetaillee(id) {
  let fin, gros, texteFin, texteGros, parametres;
  if (mesure(id.fraction63a2) && mesure(id.fraction2a63)) {
    fin = id.fraction63a2; gros = id.fraction2a63;
    texteFin = `${nombre(fin)} %`; texteGros = `${nombre(gros)} %`;
    parametres = true;
  } else if (mesure(id.tamisat2) && mesure(id.tamisat63)) {
    fin = id.tamisat2 - id.tamisat63; gros = 100 - id.tamisat2;
    texteFin = `${nombre(id.tamisat2)} − ${nombre(id.tamisat63)} = ${nombre(fin)} %`;
    texteGros = `100 − ${nombre(id.tamisat2)} = ${nombre(gros)} %`;
    parametres = false;
  } else return null;

  const sableux = fin >= gros;
  const c = cmp("fraction63a2", fin, sableux ? "≥" : "<", gros);
  const origine = parametres ? "" : " (déduites des tamisats à 2 mm et à 63 µm)";
  return {
    sableux,
    etape: etape(sableux
      ? `Fraction 0,063/2 mm = ${texteFin} ≥ fraction 2/63 mm = ${texteGros}${origine} : tendance sableuse, classe S.`
      : `Fraction 2/63 mm = ${texteGros} > fraction 0,063/2 mm = ${texteFin}${origine} : tendance graveleuse, classe G.`,
    [c], sableux ? "S" : "G"),
  };
}

/** Granulométrie étalée ou uniforme, avec l'étape qui la justifie (null si indéterminable). */
function graduationDetaillee(id) {
  if (mesure(id.cu)) {
    const etalee = id.cu >= 6;
    return {
      etalee,
      etape: etape(etalee
        ? `Cu = ${nombre(id.cu)} ≥ 6 : granulométrie étalée.`
        : `Cu = ${nombre(id.cu)} < 6 : granulométrie uniforme ou mal graduée.`,
      [cmp("cu", id.cu, etalee ? "≥" : "<", 6)]),
    };
  }
  if (mesure(id.d60) && mesure(id.tamisat63) && id.tamisat63 >= 10 && id.tamisat63 <= 15) {
    const etalee = id.d60 >= 400;
    return {
      etalee,
      etape: etape(`Cu non mesuré, fines comprises entre 10 et 15 % : D60 = ${nombre(id.d60)} µm `
        + (etalee ? "≥ 400 µm, granulométrie étalée." : "< 400 µm, granulométrie uniforme ou mal graduée."),
      [cmp("tamisat63", id.tamisat63, "≥", 10), cmp("tamisat63", id.tamisat63, "≤", 15),
        cmp("d60", id.d60, etalee ? "≥" : "<", 400)]),
    };
  }
  return null;
}

/**
 * Sous-classe des sols fins (tableau 2, fasc. 1). La VBS est préférée à l'Ip pour F1, l'Ip est
 * préféré à la VBS dès que le sol devient moyennement à très argileux.
 */
function sousClasseFine(id, etapes, manquants) {
  if (mesure(id.ip)) {
    const lu = lirePaliers("ip", id.ip, [[12, "F1"], [22, "F2"], [40, "F3"], [55, "F4"]], { sens: "≤", defaut: "F4+" });
    etapes.push(etape(`${encadrement(lu.comparaisons, 1)} → ${lu.resultat}.`, lu.comparaisons, lu.resultat));
    return lu.resultat;
  }
  if (mesure(id.vbs)) {
    const lu = lirePaliers("vbs", id.vbs, [[2.5, "F1"], [6, "F2"], [8, "F3"]], { sens: "≤", defaut: "F4" });
    etapes.push(etape(`${encadrement(lu.comparaisons, 2)} → ${lu.resultat} (Ip à privilégier au-delà de F1).`,
      lu.comparaisons, lu.resultat));
    return lu.resultat;
  }
  manquants.push("Ip ou VBS pour la sous-classe de sol fin");
  return null;
}

// ─────────────────────────────── Comportement mécanique ───────────────────────────────

function sousClasseMecanique(nature, famille, id, etapes, manquants) {
  if (famille === "S") {
    if (!mesure(id.friabilite)) {
      manquants.push("friabilité des sables FS (sous-classe mécanique, emploi en couche de forme)");
      return null;
    }
    const fs = id.friabilite, resistant = fs <= 60, sous = nature + (resistant ? "1" : "2");
    etapes.push(etape(`FS = ${nombre(fs)} : ${resistant ? "≤ 60" : "> 60"} → ${sous}.`,
      [cmp("friabilite", fs, resistant ? "≤" : ">", 60)], sous));
    return sous;
  }

  if (famille === "G") {
    if (!mesure(id.losAngeles) || !mesure(id.microDeval)) {
      manquants.push("Los Angeles et micro-Deval (sous-classe mécanique, emploi en couche de forme)");
      return null;
    }
    const la = id.losAngeles, mde = id.microDeval;
    const resistant = la <= 45 && mde <= 45, sous = nature + (resistant ? "1" : "2");
    etapes.push(etape(`LA = ${nombre(la)}, MDE = ${nombre(mde)} : ${resistant ? "tous deux ≤ 45" : "au moins un > 45"} → ${sous}.`,
      [cmp("losAngeles", la, la <= 45 ? "≤" : ">", 45), cmp("microDeval", mde, mde <= 45 ? "≤" : ">", 45)], sous));
    return sous;
  }

  return null; // F, I et VC n'ont pas de sous-classe mécanique
}

// ─────────────────────────────── Insensibilité à l'eau ───────────────────────────────

/**
 * Critères d'insensibilité à l'eau des sables et des graves (annexe 1). Un matériau insensible
 * sort de l'échelle des états hydriques et prend le suffixe « ins » : c'est lui qui ouvre les cas
 * de PST5 (sables) et PST6 (graves), donc les arases AR2 et AR3.
 *
 * @param famille "S" ou "G" (toute autre famille est sensible à l'eau)
 * @param etapes  liste où consigner le raisonnement, facultative
 */
export function insensibleALEau(famille, id, etapes = null) {
  if (famille !== "S" && famille !== "G") return false;
  const dire = (e) => etapes?.push(e);
  const fines = id.tamisat63, vbs = id.vbs;
  if (!mesure(fines) || !mesure(vbs)) {
    dire(etape("VBS non mesurée : l'insensibilité à l'eau ne peut être établie, le matériau est traité "
      + "comme sensible à l'eau."));
    return false;
  }

  const v = nombre(vbs, 3);
  if (fines <= 5 && vbs < 0.2) {
    dire(etape(`Tamisat à 63 µm ≤ 5 % et VBS = ${v} < 0,2 : matériau insensible à l'eau.`,
      [cmp("tamisat63", fines, "≤", 5), cmp("vbs", vbs, "<", 0.2)], "ins"));
    return true;
  }
  if (fines >= 5 && fines <= 10 && vbs < 0.1) {
    dire(etape(`Tamisat à 63 µm entre 5 et 10 % et VBS = ${v} < 0,1 : matériau insensible à l'eau.`,
      [cmp("tamisat63", fines, "≥", 5), cmp("tamisat63", fines, "≤", 10), cmp("vbs", vbs, "<", 0.1)], "ins"));
    return true;
  }

  // CBR immergé : faute d'essai, le critère n'est pas satisfait.
  const cbri = id.cbri, cbriOk = mesure(cbri) && cbri > 20;
  const cCbri = () => cmp("cbri", cbri ?? null, ">", 20);
  if (famille === "S" && vbs < 0.1 && fines < 12 && cbriOk) {
    dire(etape(`VBS < 0,1, tamisat à 63 µm < 12 % et CBRi = ${nombre(cbri)} > 20 : sable insensible à l'eau.`,
      [cmp("vbs", vbs, "<", 0.1), cmp("tamisat63", fines, "<", 12), cCbri()], "ins"));
    return true;
  }
  if (famille === "G" && fines >= 5 && fines <= 10 && vbs >= 0.1 && vbs < 0.2 && cbriOk) {
    dire(etape(`Tamisat à 63 µm entre 5 et 10 %, 0,1 ≤ VBS < 0,2 et CBRi = ${nombre(cbri)} > 20 : grave insensible à l'eau.`,
      [cmp("tamisat63", fines, "≥", 5), cmp("tamisat63", fines, "≤", 10),
        cmp("vbs", vbs, "≥", 0.1), cmp("vbs", vbs, "<", 0.2), cCbri()], "ins"));
    return true;
  }
  if (famille === "G" && fines >= 10 && fines <= 12 && vbs < 0.1 && cbriOk) {
    dire(etape(`Tamisat à 63 µm entre 10 et 12 %, VBS < 0,1 et CBRi = ${nombre(cbri)} > 20 : grave insensible à l'eau.`,
      [cmp("tamisat63", fines, "≥", 10), cmp("tamisat63", fines, "≤", 12), cmp("vbs", vbs, "<", 0.1), cCbri()], "ins"));
    return true;
  }

  dire(etape(`Tamisat à 63 µm = ${nombre(fines)} %, VBS = ${v}`
    + (mesure(cbri) ? `, CBRi = ${nombre(cbri)}` : ", CBRi non mesuré")
    + " : aucun critère d'insensibilité à l'eau de l'annexe 1 n'est satisfait, matériau sensible à l'eau."));
  return false;
}

// ─────────────────────────────── État hydrique ───────────────────────────────

const s = (ipiTh, ipiH, ipiM, icTh, icH, icM, icS, wTh, wH, wM, wS) =>
  ({ ipiTh, ipiH, ipiM, icTh, icH, icM, icS, wTh, wH, wM, wS });

/**
 * Seuils d'état hydrique par classe (annexe 1). null : le paramètre n'intervient pas pour cette
 * classe. Les plages sont lues dans l'ordre th → h → m → s → ts, ce qui tranche les recouvrements
 * imprimés dans le guide. Pour les sables, le jeu dépend du tamisat à 2 mm (seuil 70 %).
 */
export const SEUILS_ETAT_HYDRIQUE = {
  F1: s(3, 8, 25, null, null, null, null, 1.25, 1.1, 0.9, 0.7),
  F2: s(2, 6, 15, 0.95, 1.05, 1.15, 1.3, 1.3, 1.1, 0.9, 0.7),
  F3: s(2, 4, 10, 0.85, 1.0, 1.1, 1.25, 1.4, 1.2, 0.9, 0.7),
  F4: s(1, 3, 10, 0.8, 1.0, 1.1, 1.2, 1.4, 1.2, 0.9, 0.7),
  I1: s(5, 12, 30, null, null, null, null, 1.25, 1.1, 0.9, 0.6),
  I2: s(4, 10, 25, 0.85, 1.0, 1.15, 1.25, 1.3, 1.1, 0.9, 0.7),
  "S (tamisat à 2 mm > 70 %)": s(4, 8, null, null, null, null, null, 1.25, 1.1, 0.9, 0.5),
  "S (tamisat à 2 mm ≤ 70 %)": s(6, 12, null, null, null, null, null, 1.25, 1.1, 0.9, 0.6),
  // Le guide imprime « 7 < IPI ≤ 15 » pour h et « 12 < IPI ≤ 30 » pour m : les plages se
  // recouvrent. La lecture dans l'ordre donne la priorité à h entre 12 et 15.
  G: s(7, 15, 30, null, null, null, null, 1.25, 1.1, 0.9, 0.6),
};

/** Jeu de seuils applicable à une classe ({ cas, ...seuils }), null si le guide n'en donne pas. */
export function seuilsEtatHydrique(nature, id = {}) {
  if (SEUILS_ETAT_HYDRIQUE[nature]) return { cas: nature, ...SEUILS_ETAT_HYDRIQUE[nature] };
  const famille = familleDe(nature);
  if (famille === "S") {
    const cas = mesure(id.tamisat2) && id.tamisat2 > 70 ? "S (tamisat à 2 mm > 70 %)" : "S (tamisat à 2 mm ≤ 70 %)";
    return { cas, ...SEUILS_ETAT_HYDRIQUE[cas] };
  }
  if (famille === "G") return { cas: "G", ...SEUILS_ETAT_HYDRIQUE.G };
  return null;
}

function etatHydrique(nature, famille, id, etapes, manquants, avertissements) {
  const t = seuilsEtatHydrique(nature, id);
  if (t == null) {
    manquants.push(`seuils d'état hydrique pour la classe ${nature}`);
    return null;
  }

  if (famille === "S") {
    if (!mesure(id.tamisat2)) {
      avertissements.push("Tamisat à 2 mm non renseigné : les seuils d'état hydrique des sables retenus "
        + "sont ceux du cas « ≤ 70 % », le plus courant pour un sable fin.");
    } else {
      const gros = id.tamisat2 > 70;
      etapes.push(etape(`Sable, tamisat à 2 mm = ${nombre(id.tamisat2)} % ${gros ? "> 70 %" : "≤ 70 %"} : `
        + `seuils d'état hydrique du cas « ${gros ? "> 70 %" : "≤ 70 %"} ».`,
      [cmp("tamisat2", id.tamisat2, gros ? ">" : "≤", 70)]));
    }
  }

  const rapporter = (etat, lu, decimales) => {
    etapes.push(etape(`${encadrement(lu.comparaisons, decimales)} → état ${afficherEtat(etat)}.`, lu.comparaisons, etat));
    return etat;
  };

  // IPI d'abord : c'est le paramètre à privilégier pour (h) et (th), et il perd son sens dans les
  // états secs, où l'on bascule sur Ic puis sur w_n / w_OPN.
  if (mesure(id.ipi) && t.ipiTh != null) {
    const paliers = [[t.ipiTh, "th"], [t.ipiH, "h"], [t.ipiM, "m"]].filter(([x]) => x != null);
    const lu = lirePaliers("ipi", id.ipi, paliers, { sens: "≤" });
    if (lu.resultat) return rapporter(lu.resultat, lu, 1);
    const [dernier, etatDernier] = paliers[paliers.length - 1];
    etapes.push(etape(`IPI = ${nombre(id.ipi)} > ${nombre(dernier)} : au-delà de l'état (${etatDernier}), l'IPI ne `
      + "tranche plus ; l'état se lit sur Ic ou sur w_n/w_OPN.", lu.comparaisons));
  }

  if (mesure(id.ic)) {
    if (t.icTh != null) {
      const lu = lirePaliers("ic", id.ic, [[t.icTh, "th"], [t.icH, "h"], [t.icM, "m"], [t.icS, "s"]],
        { sens: "≤", defaut: "ts" });
      return rapporter(lu.resultat, lu, 3);
    }
    etapes.push(etape(`Ic = ${nombre(id.ic, 3)} non exploité : le guide ne fixe pas de seuils d'Ic pour la classe ${nature}.`));
  }

  if (mesure(id.wSurWopn)) {
    const lu = lirePaliers("wSurWopn", id.wSurWopn, [[t.wTh, "th"], [t.wH, "h"], [t.wM, "m"], [t.wS, "s"]],
      { sens: "≥", defaut: "ts" });
    return rapporter(lu.resultat, lu, 3);
  }

  manquants.push("IPI, Ic ou w_n/w_OPN pour l'état hydrique");
  return null;
}

// ─────────────────────────────── Lien vers la PST ───────────────────────────────

/**
 * Cas de PST compatibles avec une classification donnée : ceux dont le tableau 17 cite la classe
 * de sol et l'état hydrique. Un matériau insensible à l'eau vise les PST5 (sables) et PST6
 * (graves), qui sont les seuls cas ouverts aux arases AR3.
 */
export function casPstPourSol(c) {
  if (c?.classeNature == null) return [];

  if (c.insensible) {
    const famille = familleDe(c.classeNature);
    const voulu = famille === "S" ? "PST5" : famille === "G" ? "PST6" : "";
    const cas = trouverPst(voulu);
    return cas ? [cas] : [];
  }

  if (c.etat == null) return [];
  const famille = familleDe(c.classeNature);
  return CAS_PST
    .filter((p) => p.etats.includes(c.etat))
    .filter((p) => p.nom !== "PST5" && p.nom !== "PST6") // réservés aux matériaux insensibles
    .filter((p) => p.classesSol.some((x) => x === c.classeNature || x === famille));
}
