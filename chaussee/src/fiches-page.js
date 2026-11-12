// Page fiches.html : toutes les fiches matériaux, référentiel par référentiel et
// famille par famille. Elle sert aussi d'annexe au polycopié (tools/polycopie.py
// l'imprime après le cours) : chaque référentiel commence par un titre
// « Fiches matériaux — … » que l'outil repère pour le sommaire et les signets.

import { profils } from "./chaussee/pays/index.js";
import { htmlFiche, fichesParFamille, NOMS_FAMILLE, NOMS_COURTS } from "./fiches.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const el = (id) => document.getElementById(id);

profils().then((liste) => {
  const avec = liste.filter((p) => p.fiches?.length);
  const total = avec.reduce((s, p) => s + p.fiches.length, 0);
  el("fichesTitre").textContent = `Fiches matériaux — ${total} fiches`;
  el("fichesSommaire").innerHTML = avec.map((p) =>
    `<li><a href="#fiches-${esc(p.id)}">${esc(p.nom)}<small>${p.fiches.length} fiches · ${esc(p.reference ?? "")}</small></a></li>`).join("");
  el("fichesContenu").innerHTML = avec.map((p) => `
    <section class="card fiches-pays" id="fiches-${esc(p.id)}">
      <h2>Fiches matériaux — ${esc(NOMS_COURTS[p.id] ?? p.nom)}</h2>
      <p class="method-note">${esc(p.nom)} · ${esc(p.reference ?? "")}${p.provisoire ? " — profil provisoire : valeurs à confirmer." : ""}</p>
      ${fichesParFamille(p).map(([fam, fiches]) => `<h3>${esc(NOMS_FAMILLE[fam])}</h3>
        ${fiches.map((f) => htmlFiche(f, { niveau: "h4" })).join("")}`).join("")}
    </section>`).join("");
  // Arrivée sur une ancre (#fiches-senegal) : la page vient d'être remplie, on y va.
  if (location.hash.length > 1) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}).catch((e) => {
  el("fichesContenu").innerHTML = `<div class="card"><h2>Chargement impossible</h2><p>${esc(e.message)}</p></div>`;
});
