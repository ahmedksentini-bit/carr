// Module « Chaussée neuve » : une structure, un référentiel, un trafic → les
// sollicitations, la vérification (rationnelle NF P98-086 ou déterministe
// selon le pays) et, sur demande, l'épaisseur minimale d'une couche.

import { annexeFiches } from "../fiches.js";
import { fichesRetenues } from "../chaussee/pays/base.js";
import { etudier, epaisseurMinimale, tauxMax, subdivisionProposee } from "../chaussee/dimensionnement.js";
import { profils as profilsEnProfondeur } from "../chaussee/burmister.js";
import { facteurCumul, multiPeriodes } from "../chaussee/cumul.js";
import { FORMULES } from "../chaussee/criteres.js";
import { IDS, LIBELLES } from "../chaussee/pays/index.js";
import { coupeChaussee, tableauSollicitations } from "../figures-chaussee.js";
import {
  esc, f, fd, nombre, pastille, OPT_INTERFACE, OPT_STRUCTURE, NOM_FAMILLE, CHAMPS_ESSIEU, essieuDe, texteEssieu,
  tableauStructure, tableauVerifications, texteCoefs, indicationsCouches, profilsDesCriteres,
  BLOC_CHAMPS, NOTE_CHAMPS, descChamps,
} from "./commun.js";

export const DEFAUT_NEUVE = [
  { nom: "Couche de roulement", materiau: "BBSG1", h: "6", E: "", nu: "", interface: "collee" },
  { nom: "Couche de base", materiau: "GB3", h: "11", E: "", nu: "", interface: "collee" },
  { nom: "Couche de fondation", materiau: "GB3", h: "11", E: "", nu: "", interface: "collee" },
  { nom: "Plateforme", materiau: "PF2", h: "", E: "", nu: "", interface: "collee" },
];

/** Options de matériau du référentiel choisi, par famille. */
export function optionsMateriaux(v, ctx) {
  const p = ctx.profils.get(v.pays);
  if (!p) return [["", "—"]];
  const m = p.materiaux;
  const lst = (t, pre) => (t ?? []).map((x) => [x.cle, `${pre} ${x.cle}${x.nom && x.nom !== x.cle ? ` — ${x.nom}` : ""}`]);
  return [["", "— module saisi —"], ...lst(m.bitumineux, "▪"), ...lst(m.hydrauliques, "▫"), ...lst(m.sols, "·")];
}

export const optionsPays = (v, ctx) => IDS.filter((id) => ctx.profils.has(id)).map((id) => [id, ctx.profils.get(id).nom ?? LIBELLES[id]]);

/** Règle de découpage des GNT du référentiel choisi : { active, note }. */
function regleGnt(v, ctx) {
  const profil = ctx.profils.get(v.pays);
  const r = profil?.subdivisionGnt?.("neuve");
  return { active: !!profil?.subdiviserGnt && (r?.rapport ?? 1) > 1, note: r?.note ?? "" };
}

/**
 * Remplace chaque GNT du tableau par ses sous-couches, épaisseur et module écrits (bouton
 * « Subdiviser les GNT » de Burmister-Calc). Les autres lignes sont gardées telles quelles.
 */
export function subdiviserLignes(v, ctx) {
  const profil = ctx.profils.get(v.pays);
  const r = subdivisionProposee({ profil, p: parametresDe(v), saisie: saisieDe(v.couches) });
  if (!r.active) return { lignes: v.couches, n: 0, alertes: [] };
  const lignes = [];
  let n = 0;
  v.couches.forEach((l, i) => {
    const cs = r.couches.filter((c) => c.source === i);
    const gnt = i < v.couches.length - 1 && cs[0]?.famille === "sol";
    if (!gnt) { lignes.push(l); return; }
    n += cs.length;
    for (const c of cs) lignes.push({ ...l, nom: c.nom, h: String(Math.round(c.h * 1000) / 10), E: String(Math.round(c.E * 10) / 10) });
  });
  return { lignes, n, alertes: r.alertes };
}

/** Champs de trafic et de calcul, partagés avec le module de renforcement. */
export const CHAMPS_TRAFIC = [
  ["mja", "Trafic poids lourds à la mise en service (MJA)", "PL/j/sens", "300"],
  ["taux", "Taux de croissance géométrique", "%/an", "2"],
  ["annees", "Durée de service", "ans", "20"],
  ["periodes", "Croissance variable (facultatif) : une sous-période par ligne « durée (ans) ; taux (%) »", "texte", ""],
  ["camBit", "CAM des bitumineux (vide : proposé)", "", ""],
  ["camHyd", "CAM des traités / bétons (vide : proposé)", "", ""],
  ["camSol", "CAM des sols et GNT (vide : proposé)", "", ""],
];
export const CHAMPS_CALCUL = [
  ["risque", "Risque de calcul (vide : proposé par le référentiel)", "%", ""],
  ["teq", "Température équivalente θeq (vide : proposée)", "°C", ""],
  ["ks", "Coefficient ks", "choix", "1", [["1", "1 (défaut, comme Alizé)"], ["0.9090909091", "1/1,1"], ["0.8333333333", "1/1,2"], ["support", "selon le module du support"]]],
  ["niveauTrafic", "Coefficient A du critère sol", "choix", "fort", [["fort", "trafic fort (A = 12 000)"], ["faible", "trafic faible (A = 16 000)"]]],
];

/** Paramètres de projet (contrat pays/base.js) d'après les champs. */
export function parametresDe(v, intervention = "neuve") {
  const periodes = String(v.periodes ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const [a, t] = l.split(/[;\t]/).map((x) => nombre(x));
    if (!(a > 0 && Number.isFinite(t))) throw new Error(`sous-période « ${l} » : écrire « durée ; taux »`);
    return { annees: a, taux: t };
  });
  const cam = {};
  for (const [cle, fam] of [["camBit", "bitumineux"], ["camHyd", "hydraulique"], ["camSol", "sol"]]) {
    const x = nombre(v[cle]);
    if (x > 0) cam[fam] = x;
  }
  const mja = nombre(v.mja), taux = nombre(v.taux, 0), annees = nombre(v.annees);
  if (!(mja > 0)) throw new Error("trafic : MJA à saisir");
  if (!(annees > 0) && !periodes.length) throw new Error("trafic : durée de service à saisir");
  const risque = nombre(v.risque), teq = nombre(v.teq);
  return {
    pays: v.pays, intervention, mja, taux, annees: periodes.length ? periodes.reduce((s, x) => s + x.annees, 0) : annees,
    croissanceVariable: periodes.length > 0, periodes, camParFamille: cam,
    risque: risque > 0 ? risque : undefined, teq: Number.isFinite(teq) ? teq : undefined,
    ks: v.ks === "support" ? "support" : nombre(v.ks, 1), niveauTrafic: v.niveauTrafic ?? "fort",
    typeStructure: v.typeStructure ?? "bitumineuse-epaisse", reseauStructurant: v.reseau === "oui",
    classeTrafic: v.classeTrafic || null,
  };
}

/**
 * Valeurs que le calcul retient pour les champs laissés vides (risque, θeq, CAM), proposées
 * en gris dans ces champs ; une saisie les remplace.
 */
export function valeursProposees(etude, profil) {
  const cam = (fam) => fd(profil.camPour(fam)?.cam, 2);
  return { risque: fd(etude.risque, 1), teq: f(etude.teq, 3), camBit: cam("bitumineux"), camHyd: cam("hydraulique"), camSol: cam("sol") };
}

/** Saisie des couches (épaisseurs en cm → m). */
export const saisieDe = (lignes) => lignes.map((c, i) => {
  const derniere = i === lignes.length - 1;
  const h = nombre(c.h) / 100;
  if (!derniere && !(h > 0)) throw new Error(`couche ${i + 1} : épaisseur à saisir`);
  const E = nombre(c.E), nu = nombre(c.nu), D = nombre(c.dommage, 0);
  return { nom: c.nom, materiau: c.materiau || null, h: derniere ? Infinity : h, E: E > 0 ? E : undefined, nu: nu > 0 ? nu : undefined,
    interface: c.interface || "collee", dommage: D > 0 ? D : 0 };
});

/** Paragraphe « trafic » de la note : cumul, CAM et NE par famille. */
export function noteTrafic(p, etude, profil) {
  const lignes = p.croissanceVariable
    ? multiPeriodes(p.mja, p.periodes).detail.map((d) => `<tr><td>${d.indice + 1}</td><td class="num">${f(d.mjaDebut, 4)}</td><td class="num">${fd(d.taux, 2)} %</td><td class="num">${f(d.annees, 3)}</td><td class="num">${f(d.C, 4)}</td><td class="num">${f(d.npl, 4)}</td></tr>`).join("")
    : "";
  const C = facteurCumul(p.taux / 100, p.annees);
  const cam = (fam) => p.camParFamille?.[fam] ?? profil.camPour(fam).cam;
  return `<p>${p.croissanceVariable
      ? `Croissance par sous-périodes, la MJA de début de chacune prolongeant la précédente :</p>
        <table class="resultats"><thead><tr><th>Période</th><th class="num">MJA début</th><th class="num">Taux</th><th class="num">Durée (ans)</th><th class="num">C</th><th class="num">NPL</th></tr></thead><tbody>${lignes}</tbody></table><p>`
      : `Croissance géométrique : C = ((1 + τ)<sup>n</sup> − 1)/τ = ((1 + ${fd(p.taux / 100, 3)})<sup>${f(p.annees, 3)}</sup> − 1)/${fd(p.taux / 100, 3)} = ${f(C, 5)} ;
         NPL = 365 × MJA × C = 365 × ${f(p.mja, 4)} × ${f(C, 5)} = `}<strong>${f(etude.npl, 4)} poids lourds</strong>.</p>
    <table class="resultats"><thead><tr><th>Famille</th><th class="num">CAM</th><th>Origine</th><th class="num">NE = NPL × CAM</th></tr></thead><tbody>
      ${["bitumineux", "hydraulique", "sol"].map((fam) => `<tr><td>${esc(NOM_FAMILLE[fam])}</td><td class="num">${fd(cam(fam), 2)}</td>
        <td class="motif">${p.camParFamille?.[fam] ? "saisi" : `proposé par le référentiel${profil.camPour(fam).provisoire ? " (à confirmer)" : ""}`}</td>
        <td class="q">${f(etude.ne[fam], 4)}</td></tr>`).join("")}</tbody></table>`;
}

/** Application numérique d'une vérification, pour la note. */
export function noteVerif(v) {
  if (!v.applicable) return `<p><strong>${esc(v.nom)}</strong> — ${esc(v.critere)} : non applicable (${esc(v.motif)}).</p>`;
  const u = v.unite;
  const cf = texteCoefs(v.coefs);
  return `<div class="exemple"><h4>${esc(v.nom)} — ${esc(v.critere)}</h4>
    ${v.formule ? `<p class="formula">${esc(v.formule)}</p>` : ""}
    ${cf ? `<p>Coefficients : ${esc(cf)}${v.neApplique > 0 ? ` ; NE opposé à la couche = ${f(v.neApplique, 4)}${v.dommage > 0 ? ` (dommage déjà consommé ${fd(v.dommage, 2)} : NE/(1 − D))` : ""}` : ""}.</p>` : ""}
    <p>Admissible = <strong>${f(v.admissible, 4)} ${esc(u)}</strong> ; sollicitation calculée = <strong>${f(v.sollicitation, 4)} ${esc(u)}</strong> ;
       taux de travail ${fd(v.taux, 1)} % ${pastille(v.ok)}${v.motif ? `<br><small>${esc(v.motif)}</small>` : ""}</p></div>`;
}

export default {
  id: "neuve", groupe: "Chaussée neuve", icone: "▦", titre: "Dimensionnement", sous: "vérification et épaisseur d'une structure",
  entete: "Méthode rationnelle et catalogues",
  description: "Une structure, un référentiel et un trafic : les matériaux du pays à la température équivalente, la subdivision des graves non traitées, le calcul de Burmister, puis la vérification — par la fatigue (NF P98-086) ou par les contraintes admissibles selon le référentiel — et l'épaisseur minimale d'une couche.",
  champs: [
    ["Référentiel", [
      ["pays", "Référentiel", "choix", "france", optionsPays],
      ["typeStructure", "Type de structure (table de risque)", "choix", "bitumineuse-epaisse", OPT_STRUCTURE],
      ["reseau", "Réseau (catalogue français 1998)", "choix", "non", [["non", "non structurant (VRNS)"], ["oui", "structurant (VRS)"]], (v) => v.pays === "france"],
      ["classeTrafic", "Classe de trafic (vide : déduite du trafic)", "choix", "", (v, ctx) =>
        [["", "déduite du trafic"], ...(ctx.profils.get(v.pays)?.classesTrafic ?? []).map((c) => [c.nom, c.nom])]],
    ]],
    ["Trafic", CHAMPS_TRAFIC],
    ["Calcul", [...CHAMPS_CALCUL, ...CHAMPS_ESSIEU,
      ["dim", "Couche dont chercher l'épaisseur minimale", "choix", "", (v) => [["", "aucune"], ...v.couches.slice(0, -1).map((c, i) => [String(i), `${i + 1} · ${c.nom || c.materiau}`])]],
    ]],
  ],
  couches: {
    titre: "Structure", aide: "(de la surface vers le sol ; épaisseurs en cm ; en gris dans E et ν : valeurs retenues par le calcul, à remplacer pour les imposer)",
    colonnes: [["nom", "Couche", "texte"], ["materiau", "Matériau", "choix", optionsMateriaux], ["h", "h (cm)", "nombre"],
      ["E", "E imposé", "nombre"], ["nu", "ν", "nombre", null, "3.6em"], ["interface", "Interface", "choix", OPT_INTERFACE]],
    sansSol: ["h", "interface"],
    defaut: DEFAUT_NEUVE,
    nouvelle: () => ({ nom: "Nouvelle couche", materiau: "", h: "15", E: "", nu: "", interface: "collee" }),
    surChoix(col, c) { if (col === "materiau") { c.E = ""; c.nu = ""; } },
    minimum: 2,
    boutons: (v, ctx) => {
      const r = regleGnt(v, ctx);
      return `<button class="ghost" id="subdiviserGnt"${r.active ? "" : " disabled"} title="${esc(r.active ? "Découpe chaque GNT en sous-couches et écrit leurs épaisseurs et modules dans le tableau" : "La méthode de ce référentiel ne découpe pas les GNT")}">Subdiviser les GNT</button>
        ${r.note ? `<p class="method-note">${esc(r.note)}</p>` : ""}`;
    },
  },
  surChoix(id, v) { if (id === "pays") v.dim = ""; },
  brancher(app, v, ctx, { rendre, toast, ecrireEtat }) {
    app.querySelector("#subdiviserGnt")?.addEventListener("click", () => {
      try {
        const r = subdiviserLignes(v, ctx);
        if (!r.n) return toast("Aucune GNT à subdiviser (couche de matériau GNT au-dessus du sol support).");
        v.couches = r.lignes;
        v.dim = "";
        ecrireEtat(); rendre();
        toast(`GNT subdivisées : ${r.n} sous-couche${r.n > 1 ? "s" : ""}, épaisseurs et modules écrits dans le tableau.${r.alertes.length ? ` ${r.alertes.join(" ")}` : ""}`);
      } catch (e) { toast(`Subdivision impossible : ${e.message}`); }
    });
  },
  calculer(v, ctx) {
    const profil = ctx.profils.get(v.pays);
    if (!profil) throw new Error(`référentiel « ${v.pays} » indisponible`);
    const p = parametresDe(v);
    const essieu = essieuDe(v);
    const saisie = saisieDe(v.couches);
    const etude = etudier({ profil, p, saisie, essieu });
    let recherche = null;
    if (v.dim !== "" && v.dim != null) recherche = epaisseurMinimale({ profil, p, saisie, indice: Number(v.dim), essieu });
    const { couches, analyse, verification } = etude;
    const pr = profilsEnProfondeur(couches, essieu, { parCouche: 7 });
    const dim = verification.dimensionnant;
    const classe = etude.classeTrafic;
    const t = tauxMax(verification);
    const figure = coupeChaussee(couches, { essieu, largeur: 600 });
    const rech = recherche ? (recherche.h
      ? `<p class="final-result">Épaisseur minimale de la couche ${Number(v.dim) + 1} (${esc(saisie[Number(v.dim)].nom ?? "")}) : <strong>${fd(recherche.h * 100, 1)} cm</strong>
          — critère dimensionnant alors : ${esc(recherche.etude.verification.dimensionnant?.nom ?? "—")}, ${fd(tauxMax(recherche.etude.verification), 0)} %.</p>`
      : `<p class="final-result bureau-verdict ko">Épaisseur minimale introuvable : ${esc(recherche.motif)}.</p>`) : "";
    const synthese = `
      <p class="final-result bureau-verdict${verification.ok ? "" : " ko"}">${pastille(verification.ok, "structure vérifiée", "structure non vérifiée")}
        Taux de travail maximal <strong>${fd(t, 0)} %</strong>${dim ? ` (${esc(dim.nom)}, ${esc(dim.critere.toLowerCase())})` : ""}.</p>
      ${rech}
      <p class="method-note">${esc(profil.nom)}${etude.deterministe ? " — vérification par contraintes admissibles" : " — vérification rationnelle (NF P98-086)"} ·
        NPL = ${f(etude.npl, 3)} · NE bitumineux = ${f(etude.ne.bitumineux, 3)} · risque ${fd(etude.risque, 1)} %${etude.risquePropose ? " (proposé)" : ""} · u = ${fd(etude.u, 3)}
        · θeq = ${f(etude.teq, 3)} °C${classe ? ` · classe de trafic ${esc(classe.nom)}` : ""}</p>
      ${etude.alertes.length ? `<div class="piege"><strong>Alertes du référentiel</strong>${etude.alertes.map((a) => `<p>${esc(a)}</p>`).join("")}</div>` : ""}
      ${tableauVerifications(verification)}
      ${profilsDesCriteres(pr, couches, verification)}
      ${BLOC_CHAMPS}`;
    const note = `
      <h3>1. Référentiel et hypothèses</h3>
      <p>${esc(profil.nom)} — ${esc(profil.reference ?? "")}. ${etude.deterministe
        ? "Méthode déterministe : les contraintes calculées par le modèle de Burmister sont comparées aux contraintes admissibles tabulées par le référentiel (en bar)."
        : `Méthode rationnelle NF P98-086 : ${esc(FORMULES.bitumineux)} ; ${esc(FORMULES.hydraulique)} ; ${esc(FORMULES.sol)}.`}
        Température équivalente θeq = ${f(etude.teq, 3)} °C. Risque de calcul r = ${fd(etude.risque, 1)} %${etude.risquePropose ? " (proposé par le référentiel)" : ""}, fractile u = ${fd(etude.u, 4)}.
        Chargement : ${esc(texteEssieu(essieu))}.</p>
      <h3>2. Trafic</h3>${noteTrafic(p, etude, profil)}
      ${classe ? `<p>Classe de trafic du référentiel : <strong>${esc(classe.nom)}</strong>${classe.note ? ` — ${esc(classe.note)}` : ""}.</p>` : ""}
      <h3>3. Structure de calcul</h3>
      <p>Matériaux du référentiel à θeq ; les graves non traitées sont, le cas échéant, découpées et leur module plafonné selon la règle du pays.</p>
      ${tableauStructure(couches)}
      ${etude.alertes.length ? `<div class="piege"><strong>Alertes</strong>${etude.alertes.map((a) => `<p>${esc(a)}</p>`).join("")}</div>` : ""}
      <h3>4. Sollicitations</h3>${tableauSollicitations(analyse)}
      <p>Déflexion entre jumelage ${fd(analyse.deflexionEntreJumelage, 1)} mm/100 ; rayon de courbure ${f(analyse.rdc, 4)} m.</p>
      <h3>5. Vérifications</h3>${verification.verifs.map(noteVerif).join("")}
      <h3>6. Sollicitations des critères</h3>
      <p>Profils en profondeur des grandeurs que vérifient les critères, avec leurs valeurs admissibles (tirets rouges), le critère dimensionnant d'abord.</p>
      ${profilsDesCriteres(pr, couches, verification)}
      <h3>7. Champs dans la structure</h3>
      <p>Carte, dans le plan vertical de l'axe des roues, de la grandeur que vérifie le critère dimensionnant, calculée par le même
        modèle de Burmister sur une grille de nœuds (comme l'écran « grille » d'Alizé), et ses valeurs aux interfaces.</p>
      ${NOTE_CHAMPS}
      <h3>8. Conclusion</h3>
      <p>${verification.ok ? "Tous les critères applicables sont satisfaits." : "Au moins un critère n'est pas satisfait : la structure doit être renforcée ou modifiée."}
        Critère dimensionnant : ${dim ? `${esc(dim.nom)} — ${esc(dim.critere)}, taux ${fd(dim.taux, 1)} %` : "—"}.
        ${recherche?.h ? `Épaisseur minimale de la couche ${Number(v.dim) + 1} : ${fd(recherche.h * 100, 1)} cm.` : ""}</p>`;
    const annexe = annexeFiches(fichesRetenues(profil, couches), profil.nom);
    return { figure, synthese, note: note + annexe, verdict: verification.ok, taux: t, indications: indicationsCouches(v.couches, couches, { bouton: true }), proposes: valeursProposees(etude, profil),
      champs: descChamps("neuve", couches, essieu, verification) };
  },
};
