// Règles de vérification propres à un référentiel rationnel, appliquées après
// les critères génériques de criteres.verifier (hook `ajusterVerification` du
// profil, appelé par dimensionnement.etudier). Elles corrigent ce que le
// critère générique ferait à tort pour ce pays.

import { epsZAdmissible } from "../criteres.js";

/** Verdict et critère dimensionnant d'une liste de vérifications. */
export function resumerVerifs(verifs, base = {}) {
  const app = verifs.filter((x) => x.applicable);
  return { ...base, verifs, ok: app.every((x) => x.ok), dimensionnant: app.reduce((m, x) => (!m || x.taux > m.taux ? x : m), null) };
}

/**
 * Côte d'Ivoire — manuel LBTP 2024, fascicule 2, § 9.1 et tableau 16 : la
 * déformation verticale n'est vérifiée qu'au sommet de la plateforme, pour
 * toutes les structures. A = 20 000 µdéf sous une assise non traitée ou
 * améliorée au ciment, εz étant alors majorée de ka = 1,20 pour une assise
 * améliorée ; sous une assise bitumineuse, A = 16 000 (TC1-TC2), 14 000
 * (TC3-TC4), 13 000 (TC5-TC6). Le tableau 16 ne donne pas A en TC1 sous assise
 * bitumineuse : la valeur de TC2 est retenue. La fatigue des matériaux liés
 * reste celle de la NF P98-086.
 */
export const A_LBTP_2024 = Object.freeze({ nonTraitee: 20000, ka: 1.2, bitumineuse: [[2, 16000], [4, 14000], [6, 13000]] });

export function ajusterLbtp2024(verification, { couches, ne, classe }) {
  const der = couches.length - 1;
  const bitumineuse = couches.some((c) => c.famille === "bitumineux" && Number.isFinite(c.bit?.eps6));
  const amelioree = !bitumineuse && couches.some((c) => /^(GLa|SAa)/.test(c.materiau ?? ""));
  const rang = Number(String(classe ?? "").match(/^TC(\d)/)?.[1] ?? 2);
  const A = bitumineuse ? (A_LBTP_2024.bitumineuse.find(([r]) => rang <= r) ?? [0, 13000])[1] : A_LBTP_2024.nonTraitee;
  const ka = amelioree ? A_LBTP_2024.ka : 1;
  const pf = verification.verifs.find((x) => x.couche === der && x.grandeur === "epsZ");
  const autres = verification.verifs.filter((x) => x.grandeur !== "epsZ");
  if (!pf?.applicable) return resumerVerifs(autres, { u: verification.u });
  const adm = epsZAdmissible(A, -0.222, ne.sol), s = pf.sollicitation * ka;
  return resumerVerifs([...autres, {
    ...pf, critere: "Déformation verticale de la plateforme (LBTP 2024, § 9.1)",
    formule: `εz,adm = A · NE^(−0,222), A = ${A} µdéf${ka > 1 ? ", εz majorée de ka = 1,20 (assise améliorée)" : ""}`,
    sollicitation: s, admissible: adm, taux: (s / adm) * 100, ok: s <= adm, coefs: { A, ka },
  }], { u: verification.u });
}

/**
 * Sénégal — catalogue 2015, chapitre 8 : une chaussée souple ne se vérifie
 * qu'au sommet de la plateforme ; les graves non traitées et latérites de
 * l'assise ne portent pas de critère propre.
 */
export function ajusterSenegal(verification, { couches, p }) {
  if (p.typeStructure !== "souple") return verification;
  const der = couches.length - 1;
  return resumerVerifs(verification.verifs.filter((x) => x.couche === der), { u: verification.u });
}
