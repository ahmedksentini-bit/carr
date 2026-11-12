// Module « Fiches matériaux » : consulter et imprimer la fiche d'un matériau du
// référentiel (emploi, normes, exigences, paramètres de calcul), pour le CCTP.

import { htmlFiche, familleDe, memeCodeAilleurs, NOMS_FAMILLE } from "../fiches.js";
import { optionsPays } from "./dimensionnement.js";
import { esc } from "./commun.js";

const optionsFiches = (v, ctx) => {
  const p = ctx.profils.get(v.pays);
  const l = (p?.fiches ?? []).filter((f) => !v.famille || familleDe(f) === v.famille);
  return l.length ? l.map((f) => [f.code, `${f.code} — ${f.nom}`]) : [["", "aucune fiche"]];
};

export default {
  id: "fiches", groupe: "Données", icone: "≡", titre: "Fiches matériaux", sous: "emploi, normes, exigences du pays",
  entete: "Fiches matériaux des référentiels",
  description: "La fiche d'un matériau dans le référentiel choisi : emploi, normes de produit, d'essai et de mise en œuvre, exigences et paramètres de calcul. Les fiches des matériaux d'une structure sont aussi jointes en annexe des notes de dimensionnement et de renforcement.",
  champs: [
    ["Fiche", [
      ["pays", "Référentiel", "choix", "france", optionsPays],
      ["famille", "Famille", "choix", "", [["", "toutes"], ...Object.entries(NOMS_FAMILLE)]],
      ["code", "Fiche", "choix", "GB3", optionsFiches],
    ]],
  ],
  surChoix(id, v, ctx) {
    if (id === "pays" || id === "famille") {
      const o = optionsFiches(v, ctx);
      if (!o.some(([c]) => c === v.code)) v.code = o[0]?.[0] ?? "";
    }
  },
  calculer(v, ctx) {
    const p = ctx.profils.get(v.pays);
    if (!p) throw new Error(`référentiel « ${v.pays} » indisponible`);
    const f = (p.fiches ?? []).find((x) => x.code === v.code) ?? (p.fiches ?? [])[0];
    if (!f) return { figure: "", synthese: `<p class="en-preparation">Ce référentiel ne publie pas de fiches matériaux.</p>`, note: "", verdict: null, etat: "sans fiches" };
    const ailleurs = memeCodeAilleurs(f, [...ctx.profils.values()], p.id);
    const fiche = htmlFiche(f, { niveau: "h3", pays: p.nom });
    return {
      figure: "",
      synthese: `${ailleurs.length ? `<p class="method-note">Fiche de même code dans : ${ailleurs.map((x) => esc(x.nom)).join(", ")}.</p>` : ""}${fiche}
        <p class="method-note"><a href="fiches.html#fiches-${esc(p.id)}">Toutes les fiches de ce référentiel →</a></p>`,
      note: fiche, verdict: null, etat: `${p.fiches.length} fiches`,
    };
  },
};
