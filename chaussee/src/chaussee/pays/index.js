// Registre des profils de dimensionnement, dans l'ordre d'affichage. Ajouter
// un pays revient à écrire son module (contrat : pays/base.js) et à le
// déclarer ici.

export const IDS = ["france", "tunisie", "tunisie1984", "senegal", "cotedivoire", "cotedivoire1977", "tropical"];

const CHARGEURS = {
  france: () => import("./france.js"),
  tunisie: () => import("./tunisie.js"),
  tunisie1984: () => import("./tunisie1984.js"),
  senegal: () => import("./senegal.js"),
  cotedivoire: () => import("./cotedivoire.js"),
  cotedivoire1977: () => import("./cotedivoire1977.js"),
  tropical: () => import("./tropical.js"),
};

/** Libellés courts, utiles avant le chargement des profils (menus, pastilles). */
export const LIBELLES = {
  france: "France — NF P98-086 (2011)",
  tunisie: "Tunisie — catalogue RevA et note 2017",
  tunisie1984: "Tunisie — catalogue 1984",
  senegal: "Sénégal — catalogue 2015",
  cotedivoire: "Côte d'Ivoire — manuel LBTP 2024",
  cotedivoire1977: "Côte d'Ivoire — catalogue LBTP 1977",
  tropical: "Pays tropicaux — guide CEBTP",
};

/** Pastille de référentiel (classes CSS tag-fr, tag-tn…). */
export const PASTILLES = {
  france: ["fr", "FR"], tunisie: ["tn", "TN"], tunisie1984: ["tn", "TN 1984"], senegal: ["sn", "SN"],
  cotedivoire: ["ci", "CI"], cotedivoire1977: ["ci", "CI 1977"], tropical: ["tr", "TR"],
};

const cache = new Map();

/** Profil d'un pays (chargé à la demande). */
export async function profil(id) {
  if (!CHARGEURS[id]) throw new Error(`référentiel inconnu : ${id}`);
  if (!cache.has(id)) cache.set(id, CHARGEURS[id]().then((m) => m.default));
  return cache.get(id);
}

/** Tous les profils disponibles ; un module absent est signalé et écarté plutôt que de tout bloquer. */
export async function profils() {
  const r = await Promise.allSettled(IDS.map((id) => profil(id)));
  const ok = [];
  r.forEach((x, i) => {
    if (x.status === "fulfilled") ok.push(x.value);
    else console.error(`Profil ${IDS[i]} indisponible :`, x.reason);
  });
  return ok;
}
