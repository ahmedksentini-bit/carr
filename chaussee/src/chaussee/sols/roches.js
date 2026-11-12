// Classification des matériaux rocheux (R) et des craies (CH) selon le GTR 2024 (portage de
// Gtr2024RockClassifier de Burmister-Calc) : nature pétrographique d'abord (fascicule 1,
// § 2.3.1), puis état et comportement mécanique (§ 2.3.2 et fascicule 2, annexe 1). Le guide
// prévient que la seule nature pétrographique ne suffit généralement pas : ce sont les essais
// qui décident de la classe.
//
// Le GTR classe d'abord sur l'origine géologique, même si le nom des classes commence par la
// classe de résistance (R1 extrêmement dure à R5 fragmentable) : « R3 Li » est un calcaire dur.
//
// Identification d'une roche (tous champs optionnels) :
//   { famille: "CH" | "Li" | "Cl" | "Sa" | "Co" | "SR" | "Vo" | "Me",
//     lmax (mm), losAngeles, microDeval, rhoD (t/m³), ifr, idga, wn (%),
//     wSurWopn, ipi (fraction 0/63 mm, pour les R5 Cl), solubles (%) }
//
// Résultat de classerRoche : { classe, libelle, etat, estClasse, symbole, reclasserSolGrossier,
//   etapes, manquants, avertissements }.

import { comparaison as cmp, encadrement, etape, lirePaliers, memeNom, mesure, nombre } from "./justification.js";
import { CAS_PST, afficherEtat } from "./plateforme.js";

export const REFERENCE_ROCHES =
  "GTR 2024 (IDRRIM/Cerema), fascicule 1 § 2.3 (p. 35-39) et fascicule 2 annexe 1 (p. 19-21)";

/** Lmax en deçà de laquelle un matériau rocheux dur se classe avec les sols grossiers (mm). */
export const LMAX_SOL_GROSSIER = 250;

/** Familles pétrographiques : code du guide, libellé, exemples et groupe. */
export const FAMILLES_ROCHES = [
  { code: "CH", nom: "Craies", exemples: "craies blanches, craies marneuses", groupe: "Roches sédimentaires carbonatées" },
  { code: "Li", nom: "Calcaires rocheux", exemples: "calcaires grossiers, travertins, tufs et encroûtements", groupe: "Roches sédimentaires carbonatées" },
  { code: "Cl", nom: "Roches argileuses", exemples: "marnes, schistes sédimentaires, argilites, pélites", groupe: "Roches sédimentaires argileuses" },
  { code: "Sa", nom: "Grès", exemples: "grès", groupe: "Roches sédimentaires siliceuses" },
  { code: "Co", nom: "Brèches, poudingues, conglomérats", exemples: "brèches, poudingues, conglomérats", groupe: "Roches sédimentaires siliceuses" },
  { code: "SR", nom: "Roches salines", exemples: "sel gemme, gypse", groupe: "Roches sédimentaires salines" },
  { code: "Vo", nom: "Roches magmatiques", exemples: "granite, basalte, trachyte, andésite", groupe: "Roches magmatiques" },
  { code: "Me", nom: "Roches métamorphiques", exemples: "gneiss, amphibolites, schistes métamorphiques, schistes ardoisiers, quartzites, marbres", groupe: "Roches métamorphiques" },
];

/** Famille pétrographique par son code (casse indifférente), null si inconnue. */
export const familleRoche = (code) => FAMILLES_ROCHES.find((f) => memeNom(f.code, code)) ?? null;

/** Symbole complet : classe, puis état hydrique quand la classe en porte un (« CH4 h »). */
export const symboleRoche = (c) => (c?.classe == null ? "—" : c.etat ? `${c.classe} ${c.etat}` : c.classe);

const nu = (classe, libelle, etat = null, ...avertissements) => ({ classe, libelle, etat, avertissements });

/** Classe un matériau rocheux ou une craie à partir de ses essais. */
export function classerRoche(id = {}) {
  const etapes = [], manquants = [], avertissements = [];
  const fin = (r, reclasser = false) => {
    const c = {
      classe: r.classe, libelle: r.libelle, etat: r.etat, estClasse: r.classe != null,
      reclasserSolGrossier: reclasser, etapes, manquants,
      avertissements: [...avertissements, ...r.avertissements],
    };
    c.symbole = symboleRoche(c);
    return c;
  };

  const info = familleRoche(id.famille);
  if (info == null) {
    manquants.push("nature pétrographique de la roche");
    return fin(nu(null, null));
  }
  etapes.push(etape(`Nature pétrographique : ${info.nom} (${info.code}) — ${info.groupe}.`, [], info.code));

  let r;
  switch (info.code) {
    case "CH": r = classerCraie(id, etapes, manquants); break;
    case "Li": r = classerCalcaire(id, etapes, manquants); break;
    case "Cl": r = classerArgileuse(id, etapes, manquants, avertissements); break;
    case "Sa": case "Co": r = classerSiliceuse(id, info.code, etapes, manquants); break;
    case "SR": r = classerSaline(id, etapes, manquants, avertissements); break;
    default: r = classerRocheDure(id, info.code, etapes, manquants);
  }

  // La règle des 250 mm ajoute son propre avertissement : l'évaluer avant de figer la liste.
  const reclasser = regleDes250mm(r.classe, id.lmax, etapes, avertissements);
  return fin(r, reclasser);
}

/**
 * § 2.3.3 : les matériaux rocheux durs dont la Lmax ne dépasse pas 250 mm après extraction sont
 * à classer avec les sols grossiers. Le guide le rappelle classe par classe pour les R3 Li, R3 Sa,
 * R3 Co et les R1 à R3 Vo et Me.
 */
function regleDes250mm(classe, lmax, etapes, avertissements) {
  if (classe == null || !mesure(lmax) || lmax > LMAX_SOL_GROSSIER) return false;
  const dur = classe.startsWith("R1") || classe.startsWith("R2") || classe.startsWith("R3");
  if (!dur) return false;
  etapes.push(etape(`Roche dure (${classe}) et Lmax = ${nombre(lmax, 0)} mm ≤ ${LMAX_SOL_GROSSIER} mm : à classer avec les sols grossiers.`,
    [cmp("lmax", lmax, "≤", LMAX_SOL_GROSSIER)]));
  avertissements.push(`Matériau rocheux dur de Lmax ${nombre(lmax, 0)} mm ≤ ${LMAX_SOL_GROSSIER} mm : le guide impose `
    + "de le classer avec les sols grossiers (§ 2.3.3), donc de l'identifier comme un sol "
    + "des classes S, G ou VC plutôt que comme une roche.");
  return true;
}

// ─────────────────────────────── Craies ───────────────────────────────

const FRAGMENTATION_CRAIES_DENSES =
  "Certaines craies denses à très denses peuvent continuer à se fragmenter après mise en "
  + "œuvre, sous l'effet des contraintes mécaniques et du gel.";

/** Échelles d'état des craies, sur la teneur en eau naturelle w_n (%). */
export const ETATS_CRAIES = {
  // CH3 : le guide ne définit pas d'état très humide.
  CH3: [[27, "h"], [22, "m"], [18, "s"]],
  CH4: [[31, "th"], [26, "h"], [21, "m"], [16, "s"]],
};

/**
 * Craies : la masse volumique déshydratée donne la classe, la teneur en eau naturelle l'état
 * pour les craies de densité moyenne et peu denses.
 */
function classerCraie(id, etapes, manquants) {
  if (!mesure(id.rhoD)) {
    manquants.push("masse volumique de la roche déshydratée ρd");
    return nu(null, null);
  }
  const rho = id.rhoD, r = nombre(rho, 3);

  if (rho > 1.95) {
    etapes.push(etape(`ρd = ${r} > 1,95 → CH1, craie très dense.`, [cmp("rhoD", rho, ">", 1.95)], "CH1"));
    return nu("CH1", "Craie très dense", null, FRAGMENTATION_CRAIES_DENSES);
  }
  if (rho > 1.7) {
    etapes.push(etape(`ρd = ${r} (1,7 à 1,95) → CH2, craie dense.`,
      [cmp("rhoD", rho, ">", 1.7), cmp("rhoD", rho, "≤", 1.95)], "CH2"));
    return nu("CH2", "Craie dense", null, FRAGMENTATION_CRAIES_DENSES);
  }

  const moyenne = rho > 1.55;
  const cls = moyenne ? "CH3" : "CH4";
  const cRho = moyenne ? [cmp("rhoD", rho, ">", 1.55), cmp("rhoD", rho, "≤", 1.7)] : [cmp("rhoD", rho, "≤", 1.55)];

  if (!mesure(id.wn)) {
    manquants.push("teneur en eau naturelle w_n (%)");
    etapes.push(etape(`ρd = ${r} → ${cls}, mais l'état demande la teneur en eau naturelle.`, cRho, cls));
    return nu(cls, moyenne ? "Craie de densité moyenne" : "Craie peu dense");
  }

  const wn = id.wn;
  const lu = lirePaliers("wn", wn, ETATS_CRAIES[cls], { sens: "≥", defaut: "ts" });
  if (moyenne) {
    etapes.push(etape(`ρd = ${r} (1,55 à 1,7) et w_n = ${nombre(wn)} % → CH3 ${lu.resultat}.`,
      [...cRho, ...lu.comparaisons], `CH3 ${lu.resultat}`));
    return nu("CH3", "Craie de densité moyenne", lu.resultat);
  }
  etapes.push(etape(`ρd = ${r} ≤ 1,55 et w_n = ${nombre(wn)} % → CH4 ${lu.resultat}.`,
    [...cRho, ...lu.comparaisons], `CH4 ${lu.resultat}`));
  return nu("CH4", "Craie peu dense", lu.resultat,
    "Craie saturée ou proche de la saturation : l'eau des pores se communique aux fines produites "
    + "au terrassement et confère au matériau le comportement d'une pâte, empêchant la circulation "
    + "des engins et générant des pressions interstitielles.");
}

// ─────────────────────────────── Calcaires ───────────────────────────────

function classerCalcaire(id, etapes, manquants) {
  if (mesure(id.microDeval) && id.microDeval <= 45) {
    etapes.push(etape(`MDE = ${nombre(id.microDeval)} ≤ 45 → R3 Li, calcaire dur.`,
      [cmp("microDeval", id.microDeval, "≤", 45)], "R3 Li"));
    return nu("R3 Li", "Calcaire dur");
  }

  if (!mesure(id.rhoD)) {
    manquants.push(!mesure(id.microDeval)
      ? "micro-Deval MDE (et masse volumique ρd si MDE > 45)"
      : "masse volumique de la roche déshydratée ρd");
    return nu(null, null);
  }

  const rho = id.rhoD;
  const cMde = mesure(id.microDeval) ? [cmp("microDeval", id.microDeval, ">", 45)] : [];
  const mdeLu = mesure(id.microDeval) ? "MDE > 45" : "MDE non mesuré";
  if (rho > 1.8) {
    etapes.push(etape(`${mdeLu} et ρd = ${nombre(rho, 3)} > 1,8 → R4 Li, calcaire de dureté moyenne.`,
      [...cMde, cmp("rhoD", rho, ">", 1.8)], "R4 Li"));
    return nu("R4 Li", "Calcaire de dureté moyenne");
  }

  etapes.push(etape(`ρd = ${nombre(rho, 3)} ≤ 1,8 → R5 Li, calcaire fragmentable.`,
    [...cMde, cmp("rhoD", rho, "≤", 1.8)], "R5 Li"));
  return nu("R5 Li", "Calcaire fragmentable", null,
    "En couche de forme, la friabilité de ces calcaires peut conduire, par attrition ou "
    + "désagrégation, à la formation de fines conférant à l'ensemble du matériau un comportement "
    + "sensible à l'eau sous la circulation des engins. Leur gélivité est également à surveiller.");
}

// ─────────────────────────────── Roches argileuses ───────────────────────────────

function classerArgileuse(id, etapes, manquants, avertissements) {
  if (!mesure(id.ifr)) {
    manquants.push("coefficient de fragmentabilité IFR");
    return nu(null, null);
  }
  const ifr = id.ifr;

  if (ifr > 7) {
    etapes.push(etape(`IFR = ${nombre(ifr, 2)} > 7 → R5 Cl, roche argileuse fragmentable.`,
      [cmp("ifr", ifr, ">", 7)], "R5 Cl"));
    avertissements.push("R5 Cl : le guide impose de caractériser l'état de la fraction 0/63 mm, "
      + "car c'est elle qui pilotera le comportement après fragmentation.");
    const etat = etatArgileuse(id, etapes, manquants);
    return nu("R5 Cl", "Roche argileuse fragmentable", etat);
  }

  if (!mesure(id.microDeval) || !mesure(id.idga)) {
    manquants.push(!mesure(id.microDeval) ? "micro-Deval MDE" : "coefficient de dégradabilité IDGa");
    return nu(null, null);
  }
  const mde = id.microDeval, idga = id.idga;
  const cIfr = cmp("ifr", ifr, "≤", 7);

  if (idga <= 5 && mde <= 45) {
    etapes.push(etape(`IFR ≤ 7, IDGa = ${nombre(idga, 2)} ≤ 5 et MDE = ${nombre(mde)} ≤ 45 → R3 Cl, roche argileuse dure.`,
      [cIfr, cmp("idga", idga, "≤", 5), cmp("microDeval", mde, "≤", 45)], "R3 Cl"));
    return nu("R3 Cl", "Roche argileuse dure");
  }
  // Au-delà de 5, la dégradabilité décide seule (R4 Cld1 ou Cld2), quel que soit le MDE.
  const mdeLu = `MDE = ${nombre(mde)} ${mde > 45 ? ">" : "≤"} 45`;
  if (idga > 20) {
    etapes.push(etape(`IFR ≤ 7, IDGa = ${nombre(idga, 2)} > 20 et ${mdeLu} → R4 Cld1, peu fragmentable et très dégradable.`,
      [cIfr, cmp("idga", idga, ">", 20), cmp("microDeval", mde, mde > 45 ? ">" : "≤", 45)], "R4 Cld1"));
    return nu("R4 Cld1", "Roche argileuse peu fragmentable, très dégradable");
  }
  if (idga > 5) {
    etapes.push(etape(`IFR ≤ 7, IDGa = ${nombre(idga, 2)} (5 à 20) et ${mdeLu} → R4 Cld2, peu fragmentable et `
      + "moyennement dégradable.",
    [cIfr, cmp("idga", idga, ">", 5), cmp("idga", idga, "≤", 20), cmp("microDeval", mde, mde > 45 ? ">" : "≤", 45)], "R4 Cld2"));
    return nu("R4 Cld2", "Roche argileuse peu fragmentable, moyennement dégradable");
  }
  etapes.push(etape(`IFR ≤ 7, IDGa = ${nombre(idga, 2)} ≤ 5 et MDE = ${nombre(mde)} > 45 → R4 Cl, peu fragmentable et `
    + "peu dégradable.",
  [cIfr, cmp("idga", idga, "≤", 5), cmp("microDeval", mde, ">", 45)], "R4 Cl"));
  return nu("R4 Cl", "Roche argileuse peu fragmentable, peu dégradable");
}

/** État hydrique des R5 Cl, lu sur la fraction 0/63 mm. */
function etatArgileuse(id, etapes, manquants) {
  if (mesure(id.ipi)) {
    if (id.ipi < 2) {
      etapes.push(etape(`IPI = ${nombre(id.ipi)} < 2 → état très humide (th).`, [cmp("ipi", id.ipi, "<", 2)], "th"));
      return "th";
    }
    if (id.ipi < 5) {
      etapes.push(etape(`IPI = ${nombre(id.ipi)} (2 à 5) → état humide (h).`,
        [cmp("ipi", id.ipi, "≥", 2), cmp("ipi", id.ipi, "<", 5)], "h"));
      return "h";
    }
    etapes.push(etape(`IPI = ${nombre(id.ipi)} ≥ 5 : l'IPI ne tranche qu'entre (th) et (h) ; l'état se lit sur w_n/w_OPN.`,
      [cmp("ipi", id.ipi, "≥", 5)]));
  }

  if (!mesure(id.wSurWopn)) {
    manquants.push("w_n / w_OPN (ou IPI) de la fraction 0/63 mm pour l'état des R5 Cl");
    return null;
  }
  const lu = lirePaliers("wSurWopn", id.wSurWopn, [[1.3, "th"], [1.1, "h"], [0.9, "m"], [0.7, "s"]], { sens: "≥", defaut: "ts" });
  etapes.push(etape(`${encadrement(lu.comparaisons, 3)} → état ${afficherEtat(lu.resultat)}.`, lu.comparaisons, lu.resultat));
  return lu.resultat;
}

// ─────────────────────────────── Roches siliceuses ───────────────────────────────

function classerSiliceuse(id, code, etapes, manquants) {
  const la = id.losAngeles, mde = id.microDeval;
  if (mesure(la) && mesure(mde) && la <= 45 && mde <= 45) {
    etapes.push(etape(`LA = ${nombre(la)} ≤ 45 et MDE = ${nombre(mde)} ≤ 45 → R3 ${code}, roche siliceuse dure.`,
      [cmp("losAngeles", la, "≤", 45), cmp("microDeval", mde, "≤", 45)], `R3 ${code}`));
    return nu(`R3 ${code}`, "Roche siliceuse dure");
  }

  if (!mesure(id.ifr)) {
    manquants.push("coefficient de fragmentabilité IFR");
    return nu(null, null);
  }
  const ifr = id.ifr;
  // Ce qui a écarté la classe R3 : LA ou MDE au-dessus de 45 (ou non mesurés).
  const cDur = [];
  if (mesure(la)) cDur.push(cmp("losAngeles", la, la > 45 ? ">" : "≤", 45));
  if (mesure(mde)) cDur.push(cmp("microDeval", mde, mde > 45 ? ">" : "≤", 45));

  if (ifr > 7) {
    etapes.push(etape(`IFR = ${nombre(ifr, 2)} > 7 → R5 ${code}, roche siliceuse fragmentable.`,
      [...cDur, cmp("ifr", ifr, ">", 7)], `R5 ${code}`));
    return nu(`R5 ${code}`, "Roche siliceuse fragmentable", null,
      "Certaines de ces roches contiennent une fraction argileuse suffisante pour leur conférer "
      + "un comportement voisin des R5 Cl : leurs conditions d'utilisation s'y rattachent.");
  }

  if (!mesure(id.idga)) {
    manquants.push("coefficient de dégradabilité IDGa");
    return nu(null, null);
  }
  const idga = id.idga;

  if (idga > 5) {
    etapes.push(etape(`LA ou MDE > 45, IFR ≤ 7 et IDGa = ${nombre(idga, 2)} > 5 → R4 ${code}d, roche siliceuse de `
      + "dureté moyenne et dégradable.",
    [...cDur, cmp("ifr", ifr, "≤", 7), cmp("idga", idga, ">", 5)], `R4 ${code}d`));
    return nu(`R4 ${code}d`, "Roche siliceuse de dureté moyenne et dégradable", null,
      "Les conditions d'utilisation des roches siliceuses dégradables se rattachent aux classes "
      + "R3 Xxd et R4 Xxd.");
  }

  etapes.push(etape(`LA ou MDE > 45, IFR ≤ 7 et IDGa = ${nombre(idga, 2)} ≤ 5 → R4 ${code}, roche siliceuse de `
    + "dureté moyenne.",
  [...cDur, cmp("ifr", ifr, "≤", 7), cmp("idga", idga, "≤", 5)], `R4 ${code}`));
  return nu(`R4 ${code}`, "Roche siliceuse de dureté moyenne");
}

// ─────────────────────────────── Roches salines ───────────────────────────────

function classerSaline(id, etapes, manquants, avertissements) {
  avertissements.push("Roches salines : leur emploi est gouverné par la teneur en éléments solubles "
    + "(NF ISO 11048, NF EN 1744-5). Le GTR ne leur associe pas de classe de résistance : "
    + "elles relèvent d'une étude spécifique.");

  if (mesure(id.solubles)) {
    etapes.push(etape(`Teneur en éléments solubles = ${nombre(id.solubles, 2)} % : à confronter aux exigences du projet.`));
  } else {
    manquants.push("teneur en éléments solubles (%)");
  }
  return nu("SR", "Roche saline");
}

// ─────────────────────────────── Roches dures (Vo, Me) ───────────────────────────────

/**
 * Roches magmatiques et métamorphiques : cinq classes de résistance sur LA et MDE, puis la
 * fragmentabilité pour séparer la dureté moyenne des matériaux fragmentables ou altérés.
 */
function classerRocheDure(id, code, etapes, manquants) {
  const sorte = code === "Vo" ? "magmatique" : "métamorphique";
  const la = id.losAngeles, mde = id.microDeval;

  if (!mesure(la) || !mesure(mde)) {
    manquants.push("Los Angeles et micro-Deval");
    return nu(null, null);
  }
  const L = nombre(la), M = nombre(mde);

  if (la <= 25 && mde <= 10) {
    etapes.push(etape(`LA = ${L} ≤ 25 et MDE = ${M} ≤ 10 → R1 ${code}, roche ${sorte} extrêmement dure.`,
      [cmp("losAngeles", la, "≤", 25), cmp("microDeval", mde, "≤", 10)], `R1 ${code}`));
    return nu(`R1 ${code}`, `Roche ${sorte} extrêmement dure`);
  }
  if (la <= 35 && mde <= 25) {
    etapes.push(etape(`LA = ${L} ≤ 35 et MDE = ${M} ≤ 25 → R2 ${code}, roche ${sorte} très dure.`,
      [cmp("losAngeles", la, "≤", 35), cmp("microDeval", mde, "≤", 25)], `R2 ${code}`));
    return nu(`R2 ${code}`, `Roche ${sorte} très dure`);
  }
  if (la <= 45 && mde <= 45) {
    etapes.push(etape(`LA = ${L} ≤ 45 et MDE = ${M} ≤ 45 → R3 ${code}, roche ${sorte} dure.`,
      [cmp("losAngeles", la, "≤", 45), cmp("microDeval", mde, "≤", 45)], `R3 ${code}`));
    return nu(`R3 ${code}`, `Roche ${sorte} dure`);
  }

  if (!mesure(id.ifr)) {
    manquants.push("coefficient de fragmentabilité IFR");
    return nu(null, null);
  }
  const ifr = id.ifr;
  const cDur = [cmp("losAngeles", la, la > 45 ? ">" : "≤", 45), cmp("microDeval", mde, mde > 45 ? ">" : "≤", 45)];

  if (ifr <= 7) {
    etapes.push(etape(`LA ou MDE > 45 et IFR = ${nombre(ifr, 2)} ≤ 7 → R4 ${code}, roche ${sorte} de dureté moyenne.`,
      [...cDur, cmp("ifr", ifr, "≤", 7)], `R4 ${code}`));
    return nu(`R4 ${code}`, `Roche ${sorte} de dureté moyenne`);
  }

  etapes.push(etape(`IFR = ${nombre(ifr, 2)} > 7 → R5 ${code}, roche ${sorte} fragmentable ou altérée.`,
    [...cDur, cmp("ifr", ifr, ">", 7)], `R5 ${code}`));
  return nu(`R5 ${code}`, `Roche ${sorte} fragmentable ou altérée`, null,
    `Les R5 ${code} ont un comportement voisin des R5 Cl, R5 Sa ou R5 Co : les classes R1 à R3 et la `
    + "majorité des R4 ne s'altèrent pas dans l'ouvrage, ces derniers si.");
}

// ─────────────────────────────── Lien vers la PST ───────────────────────────────

/**
 * Le tableau 17 groupe certaines sous-natures (« R3 Cl/Li/Sa/Co/Vo/Me ») : vrai quand la classe
 * citée couvre la classe rocheuse.
 */
function couvre(cite, classe) {
  if (memeNom(cite, classe)) return true;
  const barre = cite.indexOf("/");
  if (barre < 0) return false;
  const prefixe = cite.slice(0, barre); // « R3 Cl »
  const espace = prefixe.lastIndexOf(" ");
  if (espace < 0) return false;
  const rang = prefixe.slice(0, espace); // « R3 »
  if (!classe.toLowerCase().startsWith((rang + " ").toLowerCase())) return false;
  const suffixe = classe.slice(rang.length + 1); // « Sa »
  return cite.slice(espace).split("/").map((x) => x.trim()).some((x) => memeNom(x, suffixe));
}

/**
 * Cas de PST que le tableau 17 associe à une classe rocheuse ou de craie. Les craies denses et
 * très denses et les roches dures relèvent de la PST6 ; les craies fines et les roches argileuses
 * fragmentables suivent l'état hydrique de leur fraction 0/63 mm.
 */
export function casPstPourRoche(c) {
  if (c?.classe == null) return [];
  return CAS_PST.filter((p) => p.classesSol.some((x) => couvre(x, c.classe)));
}
