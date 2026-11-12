// Module « Catalogue » : les fiches de structures du référentiel pour une
// classe de trafic et une classe de plateforme, avec leur épaisseur totale,
// et l'envoi d'une fiche vers le module de dimensionnement pour la vérifier —
// une fiche de renforcement part au module Renforcement, posée en apport sur
// la chaussée en place.

import { optionsPays } from "./dimensionnement.js";
import { lignesDepuisFiche } from "./renforcement.js";
import { epaisseurTotaleCm } from "../chaussee/pays/base.js";
import { interfacesPourFiche } from "../chaussee/pays/interfaces-alize.js";
import { coupeChaussee } from "../figures-chaussee.js";
import { esc, f, fd, NOM_INTERFACE } from "./commun.js";

const catalogueDe = (v, ctx) => {
  const p = ctx.profils.get(v.pays);
  return v.source === "renforcement" ? p?.catalogueRenforcement : p?.catalogue;
};
// Recherche à facettes : chaque liste ne propose que les valeurs compatibles avec les choix
// faits dans les deux autres, avec le nombre de fiches correspondantes. Une liste tirée de
// tout le catalogue laissait choisir une famille absente de la classe retenue — « aucune fiche ».
const CRITERES = ["classeTrafic", "classePortance", "famille"];
const egal = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/** Fiches compatibles avec les critères choisis ; `sauf` : critère à ignorer (sa propre liste). */
function fichesFiltrees(v, ctx, sauf = null) {
  const c = catalogueDe(v, ctx);
  if (!c) return [];
  return c.fiches.filter((x) => CRITERES.every((k) => k === sauf || !v[k] || egal(x[k], v[k])));
}

const optionsClasse = (cle) => (v, ctx) => {
  const l = fichesFiltrees(v, ctx, cle);
  const comptes = new Map();
  for (const x of l) if (x[cle] != null && x[cle] !== "") comptes.set(x[cle], (comptes.get(x[cle]) ?? 0) + 1);
  return [["", `toutes (${l.length})`], ...[...comptes].map(([k, n]) => [k, `${k} (${n} fiche${n > 1 ? "s" : ""})`])];
};

/** Couches de saisie du module Dimensionnement d'après une fiche (épaisseurs en cm). */
export function saisieDepuisFiche(fiche, profil) {
  // Interfaces : celles de la fiche, sinon la règle d'Alizé selon la famille de structure.
  const itf = interfacesPourFiche(fiche);
  const lignes = fiche.couches.map((c, i) => ({
    nom: c.nature, materiau: c.materiau && profil.materiau(c.materiau) ? c.materiau : "",
    h: String(c.epCm), E: c.E ? String(c.E) : "", nu: "", interface: itf[i] ?? "collee",
  }));
  const pf = profil.classesPortance?.find((x) => x.nom === fiche.classePortance);
  const cleSol = profil.materiau(fiche.classePortance) ? fiche.classePortance : "";
  lignes.push({ nom: `Plateforme ${fiche.classePortance ?? ""}`.trim(), materiau: cleSol, h: "", E: cleSol ? "" : String(pf?.module ?? 50), nu: "", interface: "collee" });
  return lignes;
}

export default {
  id: "catalogue", groupe: "Chaussée neuve", icone: "☰", titre: "Catalogue", sous: "fiches de structures du pays",
  entete: "Catalogues de structures",
  description: "Les structures types du référentiel pour une classe de trafic et une plateforme. Chaque fiche peut être envoyée au module Dimensionnement, qui la vérifie par le calcul — c'est le meilleur moyen de voir ce que le catalogue suppose ; une fiche de renforcement part au module Renforcement, posée en apport sur la chaussée en place.",
  champs: [
    ["Recherche", [
      ["pays", "Référentiel", "choix", "france", optionsPays],
      ["source", "Catalogue", "choix", "neuf", [["neuf", "chaussées neuves"], ["renforcement", "renforcement"]]],
      ["classeTrafic", "Classe de trafic", "choix", "", optionsClasse("classeTrafic")],
      ["classePortance", "Classe de plateforme", "choix", "", optionsClasse("classePortance")],
      ["famille", "Famille de structure", "choix", "", optionsClasse("famille")],
    ]],
  ],
  surChoix(id, v, ctx) {
    if (id === "pays" || id === "source") { for (const k of CRITERES) v[k] = ""; return; }
    // Un choix qui ne laisse plus aucune fiche libère les autres critères, en commençant par
    // le plus fin : la valeur qu'on vient de choisir est toujours gardée.
    for (const k of [...CRITERES].reverse()) {
      if (k === id || !v[k] || fichesFiltrees(v, ctx).length) continue;
      v[k] = "";
    }
  },
  calculer(v, ctx) {
    const profil = ctx.profils.get(v.pays);
    if (!profil) throw new Error(`référentiel « ${v.pays} » indisponible`);
    const cat = catalogueDe(v, ctx);
    if (!cat) {
      const msg = v.source === "renforcement"
        ? "Ce référentiel ne publie pas de fiches de renforcement : le renforcement s'y dimensionne à partir d'un modèle de la chaussée existante (module Renforcement)."
        : "Ce référentiel ne publie pas de catalogue de structures neuves.";
      return { figure: "", synthese: `<p class="en-preparation">${esc(msg)}</p>`, note: `<p>${esc(msg)}</p>`, verdict: null, etat: "sans catalogue" };
    }
    const fiches = fichesFiltrees(v, ctx);
    const liste = fiches.slice(0, 60).map((fi, i) => `<details class="fiche-catalogue" data-cle="fiche-${i}"${i === 0 ? " open" : ""}><summary><strong>${esc(fi.famille)}</strong> — ${esc(fi.classeTrafic)} / ${esc(fi.classePortance)}
        · ${fd(epaisseurTotaleCm(fi), 0)} cm${fi.provisoire ? " · à confirmer" : ""}</summary>
      <table class="resultats"><thead><tr><th>Couche</th><th>Matériau</th><th class="num">e (cm)</th><th>Interface</th></tr></thead><tbody>
        ${fi.couches.map((c) => `<tr><td>${esc(c.nature)}</td><td>${esc(c.materiau ?? "—")}</td><td class="num">${fd(c.epCm, 1)}</td><td class="motif">${esc(NOM_INTERFACE[c.interface] ?? c.interface ?? "")}</td></tr>`).join("")}</tbody></table>
      <p class="method-note">${esc(fi.source ?? cat.reference ?? "")}${fi.note ? ` — ${esc(fi.note)}` : ""}</p>
      <button class="secondary" data-envoyer-fiche="${i}">${v.source === "renforcement" ? "Poser cet apport sur la chaussée en place (module Renforcement) →" : "Vérifier cette structure par le calcul →"}</button></details>`).join("");
    const premiere = fiches[0];
    // Sous une fiche de renforcement, la classe « de portance » est la qualité de la chaussée en place (Q1 à Q5).
    const dessous = (fi) => (v.source === "renforcement" ? `Chaussée en place ${fi.classePortance ?? ""}`.trim() : `Plateforme ${fi.classePortance}`);
    const figure = premiere ? coupeChaussee(premiere.couches.map((c) => ({ nom: c.nature, materiau: c.materiau, famille: c.famille, h: c.epCm / 100, E: profil.materiau(c.materiau)?.E ?? profil.materiau(c.materiau)?.E10 ?? 1000, nu: profil.materiau(c.materiau)?.nu ?? 0.35, interface: interfacesPourFiche(premiere)[premiere.couches.indexOf(c)] }))
      .concat([{ nom: dessous(premiere), famille: "sol", h: Infinity, E: profil.classesPortance?.find((x) => x.nom === premiere.classePortance)?.module ?? 50, nu: 0.35 }]), { largeur: 600 }) : "";
    const synthese = `<p class="final-result bureau-verdict">${fiches.length} fiche${fiches.length > 1 ? "s" : ""} — ${esc(cat.reference ?? profil.reference ?? "")}${fiches.length > 60 ? " (60 premières affichées : préciser la recherche)" : ""}</p>${liste || '<p class="en-preparation">Aucune fiche pour ces critères.</p>'}`;
    const note = `<h3>Catalogue — ${esc(profil.nom)}</h3><p>${esc(cat.reference ?? "")}. Recherche : trafic ${esc(v.classeTrafic || "toutes classes")}, plateforme ${esc(v.classePortance || "toutes")}${v.famille ? `, famille ${esc(v.famille)}` : ""}.</p>
      ${fiches.slice(0, 60).map((fi) => `<p><strong>${esc(fi.famille)} — ${esc(fi.classeTrafic)} / ${esc(fi.classePortance)}</strong> : ${fi.couches.map((c) => `${esc(c.nature)} ${fd(c.epCm, 0)} cm`).join(" + ")} (${fd(epaisseurTotaleCm(fi), 0)} cm).</p>`).join("")}`;
    return { figure, synthese, note, verdict: null, etat: `${fiches.length} fiches`, fiches };
  },
  apresCalcul(app, v, ctx, r) {
    app.querySelectorAll("[data-envoyer-fiche]").forEach((b) => b.addEventListener("click", () => {
      const fi = r.fiches[Number(b.dataset.envoyerFiche)];
      const profil = ctx.profils.get(v.pays);
      if (v.source === "renforcement") {
        // L'apport de la fiche se pose sur la chaussée en place du module Renforcement, et s'y vérifie.
        const { lignes, nApport, manquants } = lignesDepuisFiche(fi, profil, ctx.valeurs("renforcement"));
        ctx.envoyer("renforcement", { pays: v.pays, couches: lignes, nApport: String(nApport), dim: "", chercher: "non" },
          `Fiche ${fi.famille} ${fi.classeTrafic}/${fi.classePortance} posée en apport (${nApport} couche${nApport > 1 ? "s" : ""}) sur la chaussée en place : épaisseurs vérifiées par le calcul.`
          + (manquants.length ? ` Matériaux absents de la bibliothèque : ${manquants.join(", ")}.` : ""));
        return;
      }
      ctx.envoyer("neuve", { pays: v.pays, couches: saisieDepuisFiche(fi, profil), classeTrafic: fi.classeTrafic, dim: "" },
        `Fiche ${fi.famille} ${fi.classeTrafic}/${fi.classePortance} envoyée au dimensionnement.`);
    }));
  },
};
