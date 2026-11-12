// Rendu des fiches matériaux des référentiels (emploi, normes, exigences,
// paramètres de calcul) : une seule mise en forme pour le cours (chapitre 4),
// le bureau de calcul, les notes de calcul et la page fiches.html du polycopié.
// Les fiches viennent des profils (src/chaussee/pays/*-fiches.js, contrat dans
// pays/base.js : { code, nom, famille, source, emploi, normes, sections, cles }).

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const NOMS_FAMILLE = {
  bitumineux: "Matériaux bitumineux",
  hydraulique: "Matériaux traités aux liants hydrauliques et bétons",
  sol: "Graves non traitées, sols et matériaux naturels",
  autre: "Autres matériaux (revêtements, pavés, produits divers)",
};
/** Nom court de chaque référentiel, pour les titres (une ligne, même imprimée). */
export const NOMS_COURTS = {
  france: "France", tunisie: "Tunisie", tunisie1984: "Tunisie 1984", senegal: "Sénégal",
  cotedivoire: "Côte d'Ivoire", cotedivoire1977: "Côte d'Ivoire 1977", tropical: "Pays tropicaux",
};

export const familleDe = (f) => (NOMS_FAMILLE[f.famille] ? f.famille : "autre");

/** Fiches d'un profil, rangées par famille dans l'ordre bitumineux, traités, non traités, autres. */
export function fichesParFamille(profil) {
  const groupes = Object.fromEntries(Object.keys(NOMS_FAMILLE).map((k) => [k, []]));
  for (const f of profil.fiches ?? []) groupes[familleDe(f)].push(f);
  return Object.entries(groupes).filter(([, l]) => l.length);
}

/** Référentiels qui publient une fiche de même code (comparaisons d'un pays à l'autre). */
export function memeCodeAilleurs(fiche, profils, idCourant) {
  const cle = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return profils.filter((p) => p.id !== idCourant && (p.fiches ?? []).some((x) => cle(x.code) === cle(fiche.code)));
}

/**
 * Une fiche en HTML : en-tête (code, nom, source), emploi, normes (les normes
 * françaises prises à défaut du texte national sont signalées), puis les
 * sections d'exigences et de paramètres. `niveau` : balise du titre.
 */
export function htmlFiche(f, { niveau = "h4", pays = null } = {}) {
  const normes = (f.normes ?? []).length ? `<table class="resultats fiche-normes"><thead><tr><th>Norme</th><th>Rôle</th><th>Note</th></tr></thead><tbody>
      ${f.normes.map((n) => `<tr><td><strong>${esc(n.code)}</strong>${n.aDefaut ? ' <span class="fiche-defaut" title="Le texte national ne cite pas de norme : norme française à défaut">à défaut : NF</span>' : ""}</td>
        <td>${esc(n.role)}</td><td class="motif">${esc(n.note ?? "")}</td></tr>`).join("")}</tbody></table>` : "";
  const sections = (f.sections ?? []).map((s) => `<div class="fiche-section"><h5>${esc(s.titre)}</h5>
      ${s.intro ? `<p class="method-note">${esc(s.intro)}</p>` : ""}
      ${s.lignes?.length ? `<table class="resultats"><tbody>${s.lignes.map((l) => `<tr><th scope="row">${esc(l.libelle)}</th>
        <td>${esc(l.valeur)}${l.note ? `<small>${esc(l.note)}</small>` : ""}</td><td class="motif">${esc(l.norme ?? "")}</td></tr>`).join("")}</tbody></table>` : ""}</div>`).join("");
  return `<article class="fiche-materiau">
    <${niveau}><span class="fiche-code">${esc(f.code)}</span> ${esc(f.nom)}</${niveau}>
    <p class="fiche-source">${pays ? `${esc(pays)} · ` : ""}${esc(f.source ?? "")}</p>
    ${f.emploi ? `<p class="fiche-emploi"><strong>Emploi.</strong> ${esc(f.emploi)}</p>` : ""}
    ${normes}${sections}</article>`;
}

/** Annexe d'une note de calcul : les fiches des matériaux de la structure (s'il y en a). */
export function annexeFiches(fiches, pays) {
  if (!fiches?.length) return "";
  return `<h3>Annexe — fiches des matériaux retenus</h3>
    <p class="method-note">Fiches du référentiel ${esc(pays)} pour les matériaux de la structure : emploi, normes et exigences à reporter au CCTP.</p>
    ${fiches.map((f) => htmlFiche(f, { niveau: "h4" })).join("")}`;
}
