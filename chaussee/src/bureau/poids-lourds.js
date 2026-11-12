// Module « Trafic » : cumul des poids lourds, CAM et NE par famille de
// matériaux, et classes de trafic du référentiel choisi.

import { facteurCumul, multiPeriodes } from "../chaussee/cumul.js";
import { nplDe, neParFamille } from "../chaussee/pays/base.js";
import { graphe, COULEURS } from "../figures.js";
import { esc, f, fd, NOM_FAMILLE } from "./commun.js";
import { CHAMPS_TRAFIC, optionsPays, parametresDe, noteTrafic } from "./dimensionnement.js";

const bornes = (c) => {
  const a = c.mjaMin, b = c.mjaMax;
  return a == null && b == null ? "—" : a == null ? `< ${f(b, 4)}` : b == null ? `≥ ${f(a, 4)}` : `${f(a, 4)} à ${f(b, 4)}`;
};
const bornesNe = (c) => (c.min == null ? `< ${f(c.max, 3)}` : c.max == null ? `≥ ${f(c.min, 3)}` : `${f(c.min, 3)} à ${f(c.max, 3)}`);

export default {
  id: "trafic", groupe: "Données", icone: "⇶", titre: "Trafic", sous: "NPL, CAM, NE et classes du pays",
  entete: "Trafic cumulé",
  description: "Du trafic poids lourds à la mise en service au trafic cumulé sur la durée de service, puis aux essieux équivalents NE par famille de matériaux, et la classe de trafic que lui donne le référentiel.",
  champs: [
    ["Référentiel", [
      ["pays", "Référentiel", "choix", "france", optionsPays],
      ["reseau", "Réseau (catalogue français 1998)", "choix", "non", [["non", "non structurant (VRNS)"], ["oui", "structurant (VRS)"]], (v) => v.pays === "france"],
    ]],
    ["Trafic", CHAMPS_TRAFIC],
  ],
  calculer(v, ctx) {
    const profil = ctx.profils.get(v.pays);
    if (!profil) throw new Error(`référentiel « ${v.pays} » indisponible`);
    const p = parametresDe(v);
    const npl = nplDe(p), ne = neParFamille(p, profil);
    const etude = { npl, ne };
    const classe = profil.classerTraficDe?.(p) ?? null;
    const classeNe = profil.classerNe?.(ne.bitumineux / 1e6) ?? null;
    const cumulee = profil.classerTraficCumule?.(p) ?? null;
    // Courbe du cumul année par année.
    const n = Math.ceil(p.annees);
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const q = { ...p, annees: k, croissanceVariable: false };
      if (p.croissanceVariable) {
        let reste = k; const per = [];
        for (const x of p.periodes) { if (reste <= 0) break; per.push({ annees: Math.min(x.annees, reste), taux: x.taux }); reste -= x.annees; }
        pts.push([k, per.length ? multiPeriodes(p.mja, per).npl / 1e6 : 0]);
      } else pts.push([k, nplDe(q) / 1e6]);
    }
    const figure = graphe({ largeur: 600, hauteur: 280, xmin: 0, xmax: n, ymin: 0, ymax: Math.max(...pts.map((x) => x[1])) * 1.08,
      xlabel: "années de service", ylabel: "NPL cumulé (millions)", series: [{ points: pts, couleur: COULEURS.bleu, epaisseur: 2.6, libelle: "poids lourds cumulés" }] });
    const tClasses = profil.classesTrafic?.length ? `<h3>Classes de trafic — ${esc(profil.nom)}</h3>
      <table class="resultats"><thead><tr><th>Classe</th><th>MJA (PL/j/sens)</th><th>Note</th></tr></thead><tbody>
      ${profil.classesTrafic.map((c) => `<tr class="${classe && c.nom === classe.nom ? "ligne-retenue" : ""}"><td><strong>${esc(c.nom)}</strong></td><td>${bornes(c)}</td><td class="motif">${esc(c.note ?? "")}${c.provisoire ? " (à confirmer)" : ""}</td></tr>`).join("")}</tbody></table>` : "";
    const tNe = profil.classesNe?.length ? `<h3>Classes de trafic cumulé (millions d'essieux)</h3>
      <table class="resultats"><thead><tr><th>Classe</th><th>NE (millions)</th><th>Note</th></tr></thead><tbody>
      ${profil.classesNe.map((c) => `<tr class="${classeNe && c.nom === classeNe.nom ? "ligne-retenue" : ""}"><td><strong>${esc(c.nom)}</strong></td><td>${bornesNe(c)}</td><td class="motif">${esc(c.note ?? "")}</td></tr>`).join("")}</tbody></table>` : "";
    const synthese = `<p class="final-result bureau-verdict">NPL = <strong>${f(npl, 4)}</strong> poids lourds sur ${f(p.annees, 3)} ans
        ${classe ? ` · classe <strong>${esc(classe.nom)}</strong>` : ""}${classeNe ? ` · ${esc(classeNe.nom)}` : ""}${cumulee ? ` · classe cumulée ${esc(cumulee.nom)}` : ""}</p>
      <table class="resultats"><thead><tr><th>Famille</th><th class="num">CAM</th><th class="num">NE</th></tr></thead><tbody>
        ${["bitumineux", "hydraulique", "sol"].map((fam) => `<tr><td>${esc(NOM_FAMILLE[fam])}</td><td class="num">${fd(p.camParFamille[fam] ?? profil.camPour(fam).cam, 2)}</td><td class="q">${f(ne[fam], 4)}</td></tr>`).join("")}</tbody></table>
      ${tClasses}${tNe}`;
    const note = `<h3>1. Données</h3><p>Référentiel : ${esc(profil.nom)}. MJA = ${f(p.mja, 4)} PL/j/sens à la mise en service ; durée ${f(p.annees, 3)} ans${p.croissanceVariable ? " en sous-périodes" : `, croissance géométrique ${fd(p.taux, 2)} %/an (C = ${f(facteurCumul(p.taux / 100, p.annees), 5)})`}.</p>
      <h3>2. Trafic cumulé et équivalent</h3>${noteTrafic(p, etude, profil)}
      ${classe ? `<p>Classe de trafic du référentiel : <strong>${esc(classe.nom)}</strong>.</p>` : ""}${tClasses}${tNe}`;
    return { figure, synthese, note, verdict: null, etat: `NPL ${f(npl / 1e6, 3)} M · NE ${f(ne.bitumineux / 1e6, 3)} M` };
  },
};
