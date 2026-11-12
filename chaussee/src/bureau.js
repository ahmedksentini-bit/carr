// Bureau de calcul : des modules dans une coque de logiciel (reprise du cours
// fond). Chaque module est décrit dans src/bureau/*.js : ses champs, sa table
// de couches et sa fonction de calcul, qui rend { figure, synthese, note,
// verdict, taux }. Ce fichier ne gère que la saisie, la sauvegarde, la coque
// et l'impression de la note.

import { profils as chargerProfils, IDS, LIBELLES } from "./chaussee/pays/index.js";
import { MODULES } from "./bureau/modules.js";
import { poserCurseurs } from "./curseurs.js";
import { monterChamps } from "./carte-champs.js";

const app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fd = (x, d = 2) => (Number.isFinite(x) ? Number(x).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
const CLE = "chaussee-bureau-v1";

/** Contexte partagé par les modules : profils chargés, par identifiant. */
const ctx = { profils: new Map() };

// ─────────────────────────── État et sauvegarde ───────────────────────────
const optionsDe = (o, v) => (typeof o === "function" ? o(v, ctx) : o);
function valeursParDefaut(m) {
  const v = {};
  for (const [, champs] of m.champs) for (const [id, , , def] of champs) v[id] = def;
  if (m.couches) v.couches = m.couches.defaut.map((c) => ({ ...c }));
  return v;
}
function lireEtat() {
  try { const e = JSON.parse(localStorage.getItem(CLE) || "null"); if (e && e.valeurs) return e; } catch { /* stockage indisponible */ }
  return { module: "projet", valeurs: {} };
}
function ecrireEtat() {
  try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* navigation privée */ }
  majEtatFichier();
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const PROJET_DEFAUT = () => ({
  affaire: "Étude de chaussée", ouvrage: "", lieu: "", auteur: "", verificateur: "", indice: "A", date: aujourdhui(),
  revisions: [{ indice: "A", date: aujourdhui(), objet: "Première émission" }],
});

const etat = lireEtat();
for (const m of MODULES) etat.valeurs[m.id] = { ...valeursParDefaut(m), ...(etat.valeurs[m.id] ?? {}) };
etat.projet = { ...PROJET_DEFAUT(), ...(etat.projet ?? {}) };

// Lien direct vers un module : bureau#renforcement ouvre le module Renforcement (un lien
// de formation, un signet) ; l'adresse suit ensuite le module affiché.
const moduleDeAdresse = () => {
  const id = decodeURIComponent(location.hash.slice(1));
  return id === "projet" || MODULES.some((x) => x.id === id) ? id : null;
};
etat.module = moduleDeAdresse() ?? etat.module;
window.addEventListener("hashchange", () => {
  const id = moduleDeAdresse();
  if (id && id !== etat.module) { etat.module = id; ecrireEtat(); rendre(); }
});
const suivreAdresse = () => { if (location.hash !== `#${etat.module}`) history.replaceState(null, "", `#${etat.module}`); };

function toast(texte) {
  const t = document.getElementById("toast");
  t.textContent = texte; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

/** Passe des données d'un module à un autre (ex. structure du catalogue → dimensionnement). */
export function envoyer(cible, valeurs, message) {
  const m = MODULES.find((x) => x.id === cible);
  if (!m) return;
  etat.valeurs[cible] = { ...etat.valeurs[cible], ...valeurs };
  etat.module = cible;
  ecrireEtat(); rendre();
  if (message) toast(message);
  window.scrollTo(0, 0);
}
ctx.envoyer = envoyer;
ctx.valeurs = (id) => etat.valeurs[id];

// ──────────────────── Enregistrer et ouvrir tout le bureau ────────────────────
// Le bureau entier — chaque module et le cartouche — tient dans un fichier. Sur Edge et
// Chrome, « Enregistrer » réécrit le fichier ouvert ou déjà enregistré, comme un logiciel
// de bureau ; ailleurs, il le télécharge. Entre deux enregistrements, le navigateur garde
// de toute façon le travail en cours (localStorage).
let fichierBureau = null;   // FileSystemFileHandle, quand le navigateur en donne un
const enregistrement = { nom: null, heure: null, instantane: null };
const TYPES_FICHIER = [{ description: "Bureau de calcul — chaussées", accept: { "application/json": [".json"] } }];
const signature = () => JSON.stringify([etat.projet, etat.valeurs]);
const contenuBureau = () => ({ format: "chaussee-projet", version: 1, date: new Date().toISOString(), projet: etat.projet, module: etat.module, valeurs: etat.valeurs });
function nomFichierBureau() {
  const nom = (etat.projet.affaire || "projet").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `chaussee-${nom || "projet"}.json`;
}
function texteEtatFichier() {
  if (!enregistrement.nom) return "Travail gardé dans ce navigateur. Ctrl+S : l'enregistrer dans un fichier.";
  const h = enregistrement.heure.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return signature() === enregistrement.instantane
    ? `Enregistré dans « ${enregistrement.nom} » à ${h}.`
    : `Modifié depuis l'enregistrement dans « ${enregistrement.nom} » (${h}).`;
}
function majEtatFichier() {
  const e = document.getElementById("etatFichier");
  if (!e) return;
  e.textContent = texteEtatFichier();
  e.classList.toggle("modifie", !!enregistrement.nom && signature() !== enregistrement.instantane);
}
function marquerEnregistre(nom) {
  Object.assign(enregistrement, { nom, heure: new Date(), instantane: signature() });
  majEtatFichier();
}

/** Enregistre tout le bureau ; `sous` : choisir un autre fichier. */
async function enregistrerBureau(sous = false) {
  const texte = JSON.stringify(contenuBureau(), null, 1);
  if ("showSaveFilePicker" in window) {
    try {
      if (!fichierBureau || sous) fichierBureau = await window.showSaveFilePicker({ suggestedName: nomFichierBureau(), types: TYPES_FICHIER });
      const w = await fichierBureau.createWritable();
      await w.write(texte);
      await w.close();
      marquerEnregistre(fichierBureau.name);
      toast(`Bureau enregistré dans « ${fichierBureau.name} ».`);
      return;
    } catch (e) {
      if (e.name === "AbortError") return;   // fenêtre d'enregistrement refermée
      fichierBureau = null;                   // fichier devenu inaccessible : on télécharge
    }
  }
  telecharger(nomFichierBureau(), contenuBureau());
  marquerEnregistre(nomFichierBureau());
  toast(`Bureau enregistré : « ${nomFichierBureau()} » est dans vos téléchargements.`);
}

/** Ouvre un bureau enregistré (ou un module exporté seul). */
async function ouvrirBureau() {
  if ("showOpenFilePicker" in window) {
    try {
      const [poignee] = await window.showOpenFilePicker({ types: TYPES_FICHIER });
      const f = await poignee.getFile();
      return importerTexte(await f.text(), f.name, poignee);
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  document.getElementById("fichierImport").click();
}

/** Bureau entier (format « chaussee-projet ») ou module seul, d'après le contenu du fichier. */
function importerTexte(texte, nom, poignee = null) {
  try {
    const d = JSON.parse(texte);
    if (d.format === "chaussee-projet") {
      for (const m of MODULES) etat.valeurs[m.id] = { ...valeursParDefaut(m), ...(d.valeurs?.[m.id] ?? {}) };
      etat.projet = { ...PROJET_DEFAUT(), ...(d.projet ?? {}) };
      etat.module = d.module === "projet" || MODULES.some((x) => x.id === d.module) ? d.module : "projet";
      fichierBureau = poignee;
      ecrireEtat(); rendre();
      marquerEnregistre(nom);
      toast(`Bureau « ${etat.projet.affaire} » ouvert : ${MODULES.length} modules et le cartouche.`);
      return;
    }
    const m = MODULES.find((x) => x.id === d.module);
    if (!m || typeof d.valeurs !== "object") throw new Error("ni un bureau enregistré, ni un module exporté");
    etat.module = m.id;
    etat.valeurs[m.id] = { ...valeursParDefaut(m), ...d.valeurs };
    ecrireEtat(); rendre(); toast(`Module « ${m.titre} » importé.`);
  } catch (err) { toast(`Ouverture impossible : ${err.message}`); }
}

// Ctrl+S enregistre, Ctrl+Maj+S enregistre sous, Ctrl+O ouvre.
document.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === "s") { e.preventDefault(); enregistrerBureau(e.shiftKey); }
  else if (k === "o" && !e.shiftKey) { e.preventDefault(); ouvrirBureau(); }
});

// ─────────────────────────── Rendu de la coque ────────────────────────────
function coque(actif, contenu) {
  const groupes = [...new Set(MODULES.map((x) => x.groupe))];
  const bouton = (id, icone, titre, sous) => `<button class="software-module${id === actif ? " active" : ""}" data-module="${id}"><span class="module-icon">${icone}</span>
    <span><strong>${esc(titre)}</strong><small>${esc(sous)}</small></span></button>`;
  return `
  <div class="software-shell bureau">
    <aside class="software-sidebar">
      <div class="software-title"><span class="module-icon">⌗</span><div><p>BUREAU DE CALCUL</p><h1>Chaussées</h1></div></div>
      <nav><div class="software-group"><p>Projet</p>${bouton("projet", "▤", "Projet et tableau de bord", etat.projet.affaire || "cartouche, indices, état des modules")}</div>
        ${groupes.map((g) => `<div class="software-group"><p>${esc(g)}</p>${MODULES.filter((x) => x.groupe === g).map((x) => bouton(x.id, x.icone, x.titre, x.sous)).join("")}</div>`).join("")}</nav>
      <div class="software-fichier">
        <button type="button" id="enregistrer" title="Enregistrer tout le bureau, chaque module et le cartouche, dans un fichier (Ctrl+S ; Ctrl+Maj+S : enregistrer sous)">Enregistrer</button>
        <button type="button" id="ouvrir" title="Ouvrir un bureau enregistré, ou importer un module exporté (Ctrl+O)">Ouvrir…</button>
        <p id="etatFichier" aria-live="polite">${esc(texteEtatFichier())}</p>
      </div>
      <button class="software-study" id="imprimer">${actif === "projet" ? "Imprimer le tableau de bord" : "Imprimer la note de calcul"}</button>
    </aside>
    <section class="software-main">${contenu}</section>
  </div>`;
}

const etapesDe = (m) => [
  ...m.champs.map(([titre], i) => ({ titre, cible: `g${i}` })),
  ...(m.couches ? [{ titre: m.couches.titre ?? "Couches", cible: "gc" }] : []),
  { titre: "Résultats", cible: "resultats" }, { titre: "Note de calcul", cible: "note" },
];

function rendre() {
  suivreAdresse();
  if (etat.module === "projet") return rendreProjet();
  const m = MODULES.find((x) => x.id === etat.module) ?? MODULES[0];
  const v = etat.valeurs[m.id];
  const etapes = etapesDe(m);
  app.innerHTML = coque(m.id, `
      <div class="software-head"><div><p class="eyebrow">${esc(m.entete ?? "Chaussées")} · ${esc(etat.projet.affaire)}</p><h2>${esc(m.titre)}</h2><p>${esc(m.description)}</p></div>
        <div class="bureau-actions">
          <button class="ghost" id="exporter" title="Exporter les données de ce seul module dans un fichier">Exporter ce module</button>
          <button class="ghost" id="importer" title="Importer un module exporté, ou ouvrir un bureau enregistré">Importer un module</button>
          <button class="ghost" id="reinit">Valeurs de départ</button></div></div>
      <nav class="etapes" aria-label="Étapes du calcul">${etapes.map((e, i) => `<button type="button" data-cible="${e.cible}"><span class="num">${i + 1}</span>${esc(e.titre)}<span class="etat" data-etat="${e.cible}"></span></button>`).join("")}</nav>
      <div class="bureau-grid">
        <div class="software-panel bureau-saisie">
          ${m.champs.map(([titre, champs], i) => `<div class="bureau-groupe" id="g${i}"><h3><span class="num">${i + 1}</span>${esc(titre)}</h3><div class="data-grid">
            ${champs.map((c) => champ(c, v)).join("")}</div></div>`).join("")}
          ${m.couches ? `<div class="bureau-groupe" id="gc"><h3><span class="num">${m.champs.length + 1}</span>${esc(m.couches.titre ?? "Couches")} <small>${esc(m.couches.aide ?? "")}</small></h3>
            <div class="table-large"><table class="couches-table"><thead><tr><th>n°</th>${m.couches.colonnes.map(([, t]) => `<th>${esc(t)}</th>`).join("")}<th></th></tr></thead>
            <tbody>${v.couches.map((c, i) => ligneCouche(m, v, c, i)).join("")}</tbody></table></div>
            <div class="actions"><button class="ghost" id="ajouterCouche">Ajouter une couche</button>${typeof m.couches.boutons === "function" ? m.couches.boutons(v, ctx) : m.couches.boutons ?? ""}</div></div>` : ""}
          ${m.apresSaisie ? `<div class="bureau-groupe" id="gx">${m.apresSaisie(v, ctx)}</div>` : ""}
        </div>
        <div class="software-panel bureau-resultats" id="resultats">
          <div class="software-diagram" id="figure"></div>
          <div id="synthese"></div>
        </div>
      </div>
      <section class="software-panel note-calcul" id="note"></section>`);
  brancher(m);
  calculer(m);
}

// ─────────────────────────── Projet et tableau de bord ────────────────────
function cartouche(titre) {
  const p = etat.projet;
  return `<table class="cartouche"><tbody>
    <tr><th>Affaire</th><td colspan="3">${esc(p.affaire || "—")}</td><th>Indice</th><td>${esc(p.indice || "—")}</td></tr>
    <tr><th>Ouvrage</th><td colspan="3">${esc(p.ouvrage || "—")}${p.lieu ? ` · ${esc(p.lieu)}` : ""}</td><th>Date</th><td>${esc(dateFr(p.date))}</td></tr>
    <tr><th>Élément</th><td>${esc(titre)}</td><th>Établi par</th><td>${esc(p.auteur || "—")}</td><th>Vérifié par</th><td>${esc(p.verificateur || "—")}</td></tr>
  </tbody></table>
  <p class="note-origine">Note de calcul établie sur <strong>chaussee.ksr-infra.org</strong> le ${new Date().toLocaleDateString("fr-FR")}.</p>`;
}
const dateFr = (iso) => { const d = new Date(`${iso}T12:00:00`); return Number.isNaN(d.getTime()) ? String(iso ?? "") : d.toLocaleDateString("fr-FR"); };
const historique = () => `<h3>Historique des indices</h3><table class="resultats"><thead><tr><th>Indice</th><th>Date</th><th>Objet</th></tr></thead><tbody>
  ${etat.projet.revisions.map((r) => `<tr><td>${esc(r.indice)}</td><td>${esc(dateFr(r.date))}</td><td class="motif">${esc(r.objet)}</td></tr>`).join("")}</tbody></table>`;

function tableauDeBord() {
  return MODULES.map((m, i) => {
    let r = null, motif = "";
    try { r = m.calculer(etat.valeurs[m.id], ctx); } catch (e) { motif = e.message; }
    const verdict = r ? r.verdict : false;
    const etat_ = r === null ? `<span class="verdict ko">✕ calcul impossible</span> <small>${esc(motif)}</small>`
      : verdict === true ? `<span class="verdict ok">✓ vérifié</span>` : verdict === false ? `<span class="verdict ko">✕ non vérifié</span>`
        : `<span class="verdict na">${esc(r.etat ?? "calcul sans vérification")}</span>`;
    const taux = Number.isFinite(r?.taux) ? `${fd(r.taux, 0)} %` : "—";
    return `<tr><td>${i + 1}</td><td><strong>${esc(m.titre)}</strong><small>${esc(m.groupe)}</small></td><td>${etat_}</td><td class="n">${taux}</td>
      <td><button class="ghost" data-module="${m.id}">Ouvrir</button></td></tr>`;
  }).join("");
}

function rendreProjet() {
  const p = etat.projet;
  const champP = (id, label, type = "text") => `<div class="field"><label for="pj_${id}">${esc(label)}</label><div class="input-wrap">
    <input id="pj_${id}" data-projet="${id}" type="${type}" value="${esc(p[id] ?? "")}"></div></div>`;
  app.innerHTML = coque("projet", `
      <div class="software-head"><div><p class="eyebrow">Projet</p><h2>${esc(p.affaire || "Projet")}</h2>
        <p>Le cartouche figure en tête de chaque note de calcul. Le tableau de bord recalcule chaque module sur ses données et en donne l'état ;
           le projet entier, cartouche compris, s'enregistre dans un seul fichier.</p></div>
        <div class="bureau-actions">
          <button class="ghost" id="projEnregistrer">Enregistrer le bureau</button><button class="ghost" id="projOuvrir">Ouvrir un bureau</button>
          <button class="ghost" id="projNouveau">Nouveau projet</button></div></div>
      <div class="bureau-grid">
        <div class="software-panel bureau-saisie">
          <div class="bureau-groupe"><h3><span class="num">1</span>Cartouche</h3><div class="data-grid">
            ${champP("affaire", "Affaire")}${champP("ouvrage", "Ouvrage, section")}${champP("lieu", "Lieu")}${champP("indice", "Indice")}
            ${champP("auteur", "Établi par")}${champP("verificateur", "Vérifié par")}${champP("date", "Date", "date")}</div></div>
          <div class="bureau-groupe"><h3><span class="num">2</span>Indices de révision</h3>
            <div class="table-large"><table class="couches-table"><thead><tr><th>Indice</th><th>Date</th><th>Objet</th><th></th></tr></thead><tbody>
              ${p.revisions.map((r, i) => `<tr><td><input data-rev="${i}" data-col="indice" value="${esc(r.indice)}" style="width:4em" aria-label="Indice ${i + 1}"></td>
                <td><input data-rev="${i}" data-col="date" type="date" value="${esc(r.date)}" aria-label="Date de l'indice ${i + 1}"></td>
                <td><input data-rev="${i}" data-col="objet" value="${esc(r.objet)}" style="width:16em" aria-label="Objet de l'indice ${i + 1}"></td>
                <td><button data-suppr-rev="${i}" title="Supprimer l'indice" aria-label="Supprimer l'indice ${i + 1}">✕</button></td></tr>`).join("")}
            </tbody></table></div>
            <div class="actions"><button class="ghost" id="ajouterRev">Nouvel indice</button></div></div>
          <div class="bureau-groupe"><h3><span class="num">3</span>Référentiels disponibles</h3>
            <ul class="notions">${IDS.map((id) => `<li>${esc(ctx.profils.get(id)?.nom ?? LIBELLES[id])}${ctx.profils.has(id) ? "" : " — indisponible"}</li>`).join("")}</ul></div>
        </div>
        <div class="software-panel bureau-resultats">
          <h3>Tableau de bord</h3>
          <div class="table-large"><table class="resultats tableau-bord"><thead><tr><th>n°</th><th>Module</th><th>État</th><th class="num">Taux max</th><th></th></tr></thead>
            <tbody>${tableauDeBord()}</tbody></table></div>
          <p class="method-note">Le taux de travail est le plus grand rapport sollicitation / admissible des critères du module.
             « Valeurs de départ » d'un module rétablit son exemple.</p>
          ${cartouche("dossier de calcul")}
        </div>
      </div>`);
  app.querySelectorAll("[data-module]").forEach((b) => b.addEventListener("click", () => { etat.module = b.dataset.module; ecrireEtat(); rendre(); }));
  app.querySelectorAll("[data-projet]").forEach((e) => e.addEventListener("input", () => { p[e.dataset.projet] = e.value; ecrireEtat(); }));
  app.querySelectorAll("[data-projet]").forEach((e) => e.addEventListener("change", () => rendreProjet()));
  app.querySelectorAll("[data-rev]").forEach((e) => e.addEventListener("input", () => { p.revisions[Number(e.dataset.rev)][e.dataset.col] = e.value; ecrireEtat(); }));
  app.querySelectorAll("[data-suppr-rev]").forEach((b) => b.addEventListener("click", () => {
    if (p.revisions.length <= 1) return toast("Il faut au moins un indice.");
    p.revisions.splice(Number(b.dataset.supprRev), 1); ecrireEtat(); rendreProjet();
  }));
  app.querySelector("#ajouterRev").addEventListener("click", () => {
    const der = p.revisions[p.revisions.length - 1];
    const suivant = /^[A-Y]$/.test(der.indice) ? String.fromCharCode(der.indice.charCodeAt(0) + 1) : `${der.indice}+`;
    p.revisions.push({ indice: suivant, date: aujourdhui(), objet: "" });
    p.indice = suivant; ecrireEtat(); rendreProjet();
  });
  app.querySelector("#imprimer").addEventListener("click", () => window.print());
  app.querySelector("#projEnregistrer").addEventListener("click", () => enregistrerBureau(false));
  app.querySelector("#projOuvrir").addEventListener("click", ouvrirBureau);
  brancherFichier();
  app.querySelector("#projNouveau").addEventListener("click", () => {
    if (!confirm("Commencer un nouveau projet ? Les données de tous les modules reviennent aux valeurs de départ.")) return;
    for (const m of MODULES) etat.valeurs[m.id] = valeursParDefaut(m);
    etat.projet = PROJET_DEFAUT(); ecrireEtat(); rendreProjet(); toast("Nouveau projet.");
  });
}

function telecharger(nom, contenu) {
  const blob = new Blob([JSON.stringify(contenu, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nom; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function brancherFichier() {
  app.querySelector("#enregistrer")?.addEventListener("click", () => enregistrerBureau(false));
  app.querySelector("#ouvrir")?.addEventListener("click", ouvrirBureau);
}

// ─────────────────────────── Champs et couches ────────────────────────────
function champ([id, label, unite, , options, visible], v) {
  if (typeof options === "function" && unite !== "choix") { visible = options; options = null; }
  const cache = visible && !visible(v, ctx) ? ' style="display:none"' : "";
  if (unite === "texte") {
    return `<div class="field champ-large"${cache}><label for="c_${id}">${esc(label)}</label>
      <textarea id="c_${id}" data-champ="${id}" rows="${String(v[id] ?? "").split("\n").length > 12 ? 10 : 5}" spellcheck="false">${esc(v[id])}</textarea></div>`;
  }
  if (unite === "choix") {
    const opts = optionsDe(options, v);
    return `<div class="field"${cache}><label for="c_${id}">${esc(label)}</label><div class="input-wrap"><select id="c_${id}" data-champ="${id}">
      ${opts.map(([val, t]) => `<option value="${esc(val)}"${String(v[id]) === String(val) ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div></div>`;
  }
  return `<div class="field"${cache}><label for="c_${id}">${esc(label)}</label><div class="input-wrap">
    <input id="c_${id}" data-champ="${id}" type="text" inputmode="decimal" value="${esc(v[id])}">${unite ? `<span class="unit">${esc(unite)}</span>` : ""}</div></div>`;
}

function ligneCouche(m, v, c, i) {
  const derniere = i === v.couches.length - 1;
  return `<tr><td class="n">${i + 1}</td>${m.couches.colonnes.map(([id, t, type, options, largeur]) => {
    if (derniere && m.couches.sansSol?.includes(id)) return `<td class="motif">${id === "h" ? "∞" : "—"}</td>`;
    if (type === "choix") {
      const opts = optionsDe(options, v);
      return `<td><select data-couche="${i}" data-col="${id}" aria-label="${esc(t)}, couche ${i + 1}">${opts.map(([val, txt]) => `<option value="${esc(val)}"${String(c[id] ?? "") === String(val) ? " selected" : ""}>${esc(txt)}</option>`).join("")}</select></td>`;
    }
    const w = largeur ?? (type === "texte" ? "10em" : "4.6em");
    return `<td><input data-couche="${i}" data-col="${id}" type="text" ${type === "texte" ? "" : 'inputmode="decimal"'} value="${esc(c[id] ?? "")}" style="width:${w}" aria-label="${esc(t)}, couche ${i + 1}"></td>`;
  }).join("")}
    <td><button data-monter="${i}" title="Monter la couche" aria-label="Monter la couche ${i + 1}"${i === 0 ? " disabled" : ""}>↑</button>
      <button data-suppr="${i}" title="Supprimer la couche" aria-label="Supprimer la couche ${i + 1}">✕</button></td></tr>`;
}

let minuteur = null;
function brancher(m) {
  const v = etat.valeurs[m.id];
  app.querySelectorAll("[data-module]").forEach((b) => b.addEventListener("click", () => { etat.module = b.dataset.module; ecrireEtat(); rendre(); }));
  const maj = () => { clearTimeout(minuteur); minuteur = setTimeout(() => { ecrireEtat(); calculer(m); }, 180); };
  app.querySelectorAll("[data-champ]").forEach((e) => {
    const evt = e.tagName === "SELECT" ? "change" : "input";
    e.addEventListener(evt, () => {
      v[e.dataset.champ] = e.value;
      if (e.tagName === "SELECT") { m.surChoix?.(e.dataset.champ, v, ctx); ecrireEtat(); rendre(); } else maj();
    });
  });
  app.querySelectorAll("[data-couche]").forEach((e) => {
    e.addEventListener(e.tagName === "SELECT" ? "change" : "input", () => {
      const c = v.couches[Number(e.dataset.couche)];
      c[e.dataset.col] = e.value;
      if (e.tagName === "SELECT") { m.couches.surChoix?.(e.dataset.col, c, v, ctx); ecrireEtat(); rendre(); } else maj();
    });
  });
  app.querySelectorAll("[data-suppr]").forEach((b) => b.addEventListener("click", () => {
    if (v.couches.length <= (m.couches.minimum ?? 1)) return toast("Il faut garder au moins le sol support.");
    v.couches.splice(Number(b.dataset.suppr), 1); ecrireEtat(); rendre();
  }));
  app.querySelectorAll("[data-monter]").forEach((b) => b.addEventListener("click", () => {
    const i = Number(b.dataset.monter);
    if (i < 1 || i === v.couches.length - 1) return;
    [v.couches[i - 1], v.couches[i]] = [v.couches[i], v.couches[i - 1]]; ecrireEtat(); rendre();
  }));
  const ajout = app.querySelector("#ajouterCouche");
  if (ajout) ajout.addEventListener("click", () => {
    const n = v.couches.length;
    v.couches.splice(n - 1, 0, { ...(m.couches.nouvelle?.(v, ctx) ?? v.couches[Math.max(0, n - 2)]) }); ecrireEtat(); rendre();
  });
  m.brancher?.(app, v, ctx, { rendre, toast, ecrireEtat });
  brancherFichier();
  app.querySelector("#imprimer").addEventListener("click", () => window.print());
  app.querySelector("#reinit").addEventListener("click", () => { etat.valeurs[m.id] = valeursParDefaut(m); ecrireEtat(); rendre(); toast("Valeurs de départ rétablies."); });
  app.querySelector("#exporter").addEventListener("click", () =>
    telecharger(`chaussee-${m.id}.json`, { module: m.id, valeurs: etat.valeurs[m.id], date: new Date().toISOString() }));
  app.querySelector("#importer").addEventListener("click", () => document.getElementById("fichierImport").click());
  app.querySelectorAll(".etapes [data-cible]").forEach((b) => b.addEventListener("click", () => {
    const cible = document.getElementById(b.dataset.cible);
    if (!cible) return;
    if (cible.tagName === "DETAILS") cible.open = true;
    cible.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
}

document.getElementById("fichierImport").addEventListener("change", async (e) => {
  const fichier = e.target.files[0];
  e.target.value = "";
  if (fichier) importerTexte(await fichier.text(), fichier.name);
});

/**
 * Valeurs que le calcul retient, en gris dans les champs laissés vides (risque, θeq, CAM…)
 * et dans les cases vides du tableau des couches (une saisie les remplace), et ligne de
 * détail sous une couche découpée.
 */
function poserIndications(indications, proposes) {
  app.querySelectorAll("input[data-champ][data-propose]").forEach((e) => { e.placeholder = ""; e.removeAttribute("data-propose"); e.removeAttribute("title"); });
  for (const [id, val] of Object.entries(proposes ?? {})) {
    const e = app.querySelector(`input[data-champ="${id}"]`);
    if (e && val && val !== "—") { e.placeholder = val; e.dataset.propose = ""; e.title = `Proposé : ${val} — saisir une valeur pour l'imposer`; }
  }
  app.querySelectorAll(".couches-table tr.couche-indication").forEach((x) => x.remove());
  app.querySelectorAll(".couches-table input[data-couche]").forEach((e) => { e.placeholder = ""; e.removeAttribute("title"); });
  (indications ?? []).forEach((ind, i) => {
    if (!ind) return;
    for (const [col, val] of Object.entries(ind.valeurs ?? {})) {
      const e = app.querySelector(`.couches-table input[data-couche="${i}"][data-col="${col}"]`);
      if (e && val) { e.placeholder = val; e.title = `Retenu par le calcul : ${val}${col === "E" ? " MPa" : ""} — saisir une valeur pour l'imposer`; }
    }
    const tr = app.querySelector(`.couches-table [data-couche="${i}"]`)?.closest("tr");
    if (ind.detail && tr) tr.insertAdjacentHTML("afterend", `<tr class="couche-indication"><td></td><td colspan="${tr.children.length - 1}">${esc(ind.detail)}</td></tr>`);
  });
}

function calculer(m) {
  const v = etat.valeurs[m.id];
  const zones = { figure: app.querySelector("#figure"), synthese: app.querySelector("#synthese"), note: app.querySelector("#note") };
  const marquer = (cible, classe, texte) => {
    const e = app.querySelector(`.etapes [data-etat="${cible}"]`);
    if (!e) return;
    e.className = `etat ${classe}`; e.textContent = texte;
  };
  const ouverts = new Set([...app.querySelectorAll("details[open][data-cle]")].map((d) => d.dataset.cle));
  try {
    const r = m.calculer(v, ctx);
    zones.figure.innerHTML = r.figure ?? "";
    zones.synthese.innerHTML = r.synthese;
    zones.note.innerHTML = `${cartouche(m.titre)}<h2>Note de calcul — ${esc(m.titre)}</h2>
      <p class="method-note">Bureau de calcul du cours « Chaussées : dimensionnement et renforcement ». Les valeurs sont celles de la saisie.</p>
      ${r.note}${historique()}`;
    // Champs dans la structure : calculés d'eux-mêmes, par tranches, après le calcul principal.
    if (r.champs) monterChamps(zones.synthese.querySelector("[data-champs-bloc]"), r.champs, { note: zones.note.querySelector("[data-champs-note]") });
    app.querySelectorAll("details[data-cle]").forEach((d) => { if (ouverts.has(d.dataset.cle)) d.open = true; });
    for (const e of etapesDe(m)) marquer(e.cible, "ok", "✓");
    if (r.verdict === false) marquer("resultats", "ko", "✕");
    else if (r.verdict !== true) marquer("resultats", "na", "·");
    poserIndications(r.indications, r.proposes);
    m.apresCalcul?.(app, v, ctx, r, { rendre, toast, ecrireEtat });
    poserCurseurs(app);
  } catch (e) {
    console.error(e);
    zones.figure.innerHTML = "";
    zones.synthese.innerHTML = `<p class="final-result bureau-verdict ko">Calcul impossible : ${esc(e.message)}</p>`;
    zones.note.innerHTML = "";
    poserIndications(null, null);
    for (const x of etapesDe(m)) marquer(x.cible, "na", "");
    marquer(/couche/.test(e.message) && m.couches ? "gc" : "resultats", "ko", "!");
    marquer("note", "na", "—");
  }
}

// ─────────────────────────────── Démarrage ────────────────────────────────
chargerProfils().then((liste) => {
  for (const p of liste) ctx.profils.set(p.id, p);
  rendre();
}).catch((e) => {
  app.innerHTML = `<div class="card"><h2>Chargement impossible</h2><p>${esc(e.message)}</p></div>`;
});
