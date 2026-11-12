// Module « Sols et plateforme » : du sol à la plateforme. Deux voies :
//  · GTR 2024 (France, et référentiels qui le reprennent) : identification →
//    classe et état hydrique (avec l'arbre parcouru), cas de PST et arase,
//    couches de forme possibles, plateforme obtenue et son module ;
//  · par le CBR, pour les référentiels qui indexent leurs fiches sur une
//    classe de sol ou d'arase (Tunisie, Sénégal, Côte d'Ivoire, tropical).

import {
  classerSol, conseillerPst, proposerCouchesDeForme, classerPlateformeObtenue, moduleCalcul,
  ECHELLES_CBR_ARASE, ECHELLES_CBR_DIRECTES, classerAraseParCbr, classerSolParCbr, plateformeSansCouche, trouverArase,
} from "../chaussee/sols/index.js";
import { figureSolPlateforme } from "../figures-chaussee.js";
import { esc, f, fd, nombre } from "./commun.js";

const ECHELLES = [...ECHELLES_CBR_ARASE.map((e) => ({ ...e, type: "arase" })), ...ECHELLES_CBR_DIRECTES.map((e) => ({ ...e, type: "direct" }))];

const CHAMPS_ID = [
  ["dmax", "Dmax", "mm", "20"], ["tamisat63", "Tamisat à 63 µm", "%", "42"], ["tamisat2", "Tamisat à 2 mm", "%", "85"],
  ["vbs", "VBS", "", "3.2"], ["ip", "Ip (vide : non mesuré)", "", "18"], ["wSurWopn", "w_n / w_OPN", "", "1.15"],
  ["ic", "Ic (vide : non mesuré)", "", ""], ["ipi", "IPI (vide : non mesuré)", "", "9"], ["cbri", "CBR après immersion (vide)", "", ""],
  ["cu", "Cu (vide)", "", ""], ["losAngeles", "Los Angeles (vide)", "", ""], ["microDeval", "Micro-Deval (vide)", "", ""],
];

/** Étapes de justification en liste lisible, avec les comparaisons ✓ / ✗. */
export function htmlEtapes(etapes) {
  return `<ol class="etapes-justification">${etapes.map((e) => `<li>${esc(e.texte)}${e.comparaisons?.length
    ? `<small>${e.comparaisons.map((c) => `${c.verifie ? "✓" : "✗"} ${esc(c.libelle ?? c.parametre)} ${esc(c.operateur)} ${esc(String(c.seuil).replace(".", ","))}`).join(" · ")}</small>` : ""}</li>`).join("")}</ol>`;
}

const gtr = (v) => v.methode !== "cbr";

export default {
  id: "sols", groupe: "Données", icone: "◒", titre: "Sols et plateforme", sous: "GTR 2024, PST, couche de forme, CBR",
  entete: "Du sol à la plateforme",
  description: "Classer le sol support, en déduire la partie supérieure des terrassements, choisir la couche de forme et obtenir la classe de plateforme et son module de calcul — selon le GTR 2024, ou par le CBR pour les référentiels qui l'emploient.",
  champs: [
    ["Méthode", [
      ["methode", "Voie", "choix", "gtr", [["gtr", "GTR 2024 : identification, PST, couche de forme"], ["cbr", "par le CBR (barème d'un référentiel)"]]],
      ["echelle", "Barème", "choix", ECHELLES[0].cle, ECHELLES.map((e) => [e.cle, e.nom]), (v) => !gtr(v)],
      ["cbr", "CBR", "", "8", (v) => !gtr(v)],
    ]],
    ["Identification du sol", CHAMPS_ID.map((c) => [...c, gtr])],
    ["Terrassement et couche de forme", [
      ["situation", "Situation", "choix", "remblai", [["remblai", "remblai"], ["deblai", "déblai"], ["profil-rasant", "profil rasant"]], gtr],
      ["nappe", "Risque de remontée de nappe", "choix", "non", [["non", "non"], ["oui", "oui"]], gtr],
      ["drainage", "Drainage profond de la PST", "choix", "non", [["non", "non"], ["oui", "oui"]], gtr],
      ["traitement", "Couche de forme", "choix", "aucun", [["aucun", "non traitée"], ["chaux", "traitée à la chaux"], ["liant", "traitée aux liants hydrauliques"]], gtr],
      ["dimensionnement", "Règle (non traitée)", "choix", "securitaire", [["securitaire", "sécuritaire"], ["optimise", "optimisée"]], gtr],
      ["cible", "Plateforme visée", "choix", "PF2", [["PF1", "PF1"], ["PF2", "PF2"], ["PF2qs", "PF2qs"], ["PF3", "PF3"], ["PF4", "PF4"]], gtr],
      ["epaisseur", "Épaisseur de couche de forme mise en œuvre (vide : celle du tableau)", "cm", "", gtr],
    ]],
  ],
  calculer(v) { return gtr(v) ? calculerGtr(v) : calculerCbr(v); },
  apresCalcul(app, v, ctx, r) {
    app.querySelector("#versNeuve")?.addEventListener("click", () => {
      const n = ctx.valeurs("neuve");
      const couches = (n?.couches ?? []).map((c) => ({ ...c }));
      if (!couches.length) return;
      couches[couches.length - 1] = { ...couches[couches.length - 1], nom: `Plateforme ${r.plateforme}`, materiau: "", E: String(r.module), nu: "0.35" };
      ctx.envoyer("neuve", { couches }, `Plateforme ${r.plateforme} (${r.module} MPa) envoyée au dimensionnement.`);
    });
  },
};

function calculerGtr(v) {
  const id = {};
  for (const [cle] of CHAMPS_ID) { const x = nombre(v[cle]); if (Number.isFinite(x)) id[cle] = x; }
  const sol = classerSol(id);
  const pst = conseillerPst(sol, { situation: v.situation, risqueNappe: v.nappe === "oui", drainageProfond: v.drainage === "oui" });
  const options = { dimensionnement: v.dimensionnement };
  const props = pst.pst && pst.arase ? proposerCouchesDeForme(pst.pst, pst.arase, v.traitement, options) : [];
  const vers = props.find((p) => p.plateforme === v.cible);
  const ep = nombre(v.epaisseur, vers?.epaisseur ?? NaN);
  const obtenue = pst.pst && pst.arase ? classerPlateformeObtenue(pst.pst, pst.arase, v.cible, ep, v.traitement, options) : null;
  const pf = obtenue?.plateforme && obtenue.plateforme !== "—" ? obtenue.plateforme : null;
  const module = pf ? obtenue.module ?? moduleCalcul(pf) : null;
  const tabProps = props.length ? `<table class="resultats"><thead><tr><th>Couche de forme</th><th class="num">Épaisseur</th><th>Plateforme</th><th class="num">Module</th></tr></thead><tbody>
      ${props.map((p) => `<tr class="${p.plateforme === v.cible ? "ligne-retenue" : ""}"><td>${esc(p.libelle ?? p.regle ?? "")}<small>${esc(p.source ?? "")}</small></td><td class="num">${p.epaisseur == null ? "—" : `${f(p.epaisseur, 3)} cm`}</td>
        <td><strong>${esc(p.plateforme)}</strong></td><td class="num">${p.module == null ? "—" : `${f(p.module, 3)} MPa`}</td></tr>`).join("")}</tbody></table>` : "";
  const synthese = `<p class="final-result bureau-verdict${sol.estClasse ? "" : " ko"}">Sol <strong>${esc(sol.symbole ?? sol.classeNature ?? "non classé")}</strong>${sol.description ? ` — ${esc(sol.description)}` : ""}
      ${pst.pst ? ` · ${esc(pst.pst)} / ${esc(pst.arase)}` : ""}${pf ? ` · plateforme <strong>${esc(pf)}</strong> (${f(module, 3)} MPa)` : ""}</p>
    ${pf ? `<button class="secondary" id="versNeuve">Utiliser ${esc(pf)} comme support au module Dimensionnement →</button>` : ""}
    ${sol.manquants?.length ? `<div class="piege"><strong>Essais manquants</strong><p>${esc(sol.manquants.join(", "))}</p></div>` : ""}
    <h3>Classification GTR 2024</h3>${htmlEtapes(sol.etapes)}
    ${sol.avertissements?.length ? `<div class="piege"><strong>Réserves</strong>${sol.avertissements.map((a) => `<p>${esc(a)}</p>`).join("")}</div>` : ""}
    <h3>Partie supérieure des terrassements</h3>${htmlEtapes(pst.etapes)}
    ${pst.avertissements?.length ? `<div class="piege"><strong>Remarques</strong>${pst.avertissements.map((a) => `<p>${esc(a)}</p>`).join("")}</div>` : ""}
    ${tabProps ? `<h3>Couches de forme possibles</h3>${tabProps}` : ""}
    ${obtenue ? `<h3>Plateforme obtenue</h3>${obtenue.etapes?.length ? htmlEtapes(obtenue.etapes) : ""}${(obtenue.avertissements ?? []).map((a) => `<p class="method-note">${esc(a)}</p>`).join("")}` : ""}`;
  const note = `<h3>1. Identification</h3><p>${Object.entries(id).map(([k, x]) => `${esc(k)} = ${fd(x, 2)}`).join(" ; ")}.</p>
    <h3>2. Classification GTR 2024</h3>${htmlEtapes(sol.etapes)}<p>Classe retenue : <strong>${esc(sol.symbole ?? "—")}</strong>.</p>
    <h3>3. PST et arase</h3>${htmlEtapes(pst.etapes)}
    ${tabProps ? `<h3>4. Couche de forme</h3>${tabProps}` : ""}
    ${pf ? `<h3>5. Plateforme</h3><p>Plateforme ${esc(pf)} — module de calcul ${f(module, 3)} MPa${Number.isFinite(ep) ? `, couche de forme de ${f(ep, 3)} cm` : ""}.</p>` : ""}`;
  // Coupe : le sol de PST, l'arase, la couche de forme, la plateforme obtenue et son module.
  const traitement = { aucun: "Couche de forme non traitée", chaux: "Couche de forme traitée à la chaux", liant: "Couche de forme traitée aux liants" }[v.traitement] ?? "Couche de forme";
  const arase = pst.arase ? trouverArase(pst.arase) : null;
  const figure = sol.symbole ? figureSolPlateforme({
    sol: sol.symbole, pst: pst.pst, arase: pst.arase, moduleArase: arase?.module,
    couche: pf && Number.isFinite(ep) && ep > 0 ? { libelle: traitement, epCm: ep } : null, plateforme: pf, module,
  }) : "";
  return { figure, synthese, note, verdict: pf ? (obtenue.objectifAtteint ?? null) : null, etat: pf ? `${pf} · ${f(module, 3)} MPa` : sol.symbole ?? "non classé", plateforme: pf, module };
}

function calculerCbr(v) {
  const e = ECHELLES.find((x) => x.cle === v.echelle) ?? ECHELLES[0];
  const cbr = nombre(v.cbr);
  if (!(cbr > 0)) throw new Error("CBR à saisir");
  let classe, etapes, pf = null, module = null;
  if (e.type === "arase") {
    const r = classerAraseParCbr(e, cbr);
    classe = r.classe; etapes = r.etapes;
    pf = classe ? plateformeSansCouche(e, classe.nom)?.nom ?? null : null;
    module = pf ? e.plateformes.find((x) => x.nom === pf)?.module ?? null : null;
  } else {
    const r = classerSolParCbr(e, cbr);
    classe = r.classe; etapes = r.etapes;
    pf = classe?.nom ?? null; module = classe?.module ?? null;
  }
  const tableau = `<table class="resultats"><thead><tr><th>Classe</th><th class="num">CBR min</th><th class="num">Module</th><th>Note</th></tr></thead><tbody>
    ${(e.type === "arase" ? e.arases : e.classes).map((c) => `<tr class="${classe && c.nom === classe.nom ? "ligne-retenue" : ""}"><td><strong>${esc(c.nom)}</strong></td><td class="num">${c.cbrMin == null ? "—" : f(c.cbrMin, 3)}</td>
      <td class="num">${c.module > 0 ? `${f(c.module, 3)} MPa` : "—"}</td><td class="motif">${esc(c.note ?? "")}</td></tr>`).join("")}</tbody></table>`;
  const synthese = `<p class="final-result bureau-verdict">CBR ${f(cbr, 3)} → <strong>${esc(classe?.nom ?? "—")}</strong>${pf && pf !== classe?.nom ? ` · plateforme sans couche de forme ${esc(pf)}` : ""}${module ? ` · ${f(module, 3)} MPa` : ""}</p>
    ${module ? `<button class="secondary" id="versNeuve">Utiliser ce support au module Dimensionnement →</button>` : ""}
    ${htmlEtapes(etapes)}${tableau}<p class="method-note">${esc(e.conseil ?? "")}</p>`;
  const note = `<h3>Barème</h3><p>${esc(e.nom)} — ${esc(e.reference ?? "")}.</p>${htmlEtapes(etapes)}${tableau}`;
  return { figure: "", synthese, note, verdict: null, etat: classe?.nom ?? "—", plateforme: pf ?? classe?.nom, module };
}
