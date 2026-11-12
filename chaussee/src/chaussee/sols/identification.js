// Résultats d'identification géotechnique d'un sol, tels qu'ils sortent du laboratoire
// (portage de SoilIdentification de Burmister-Calc).
//
// Une identification est un objet simple dont tous les champs sont optionnels : la
// classification dit elle-même ce qui lui manque plutôt que d'exiger une fiche complète. Un
// champ absent, null ou non numérique vaut « essai non réalisé » — jamais zéro. Sauf mention
// contraire, les essais portent sur la fraction 0/63 mm, seule fraction identifiable par les
// essais de laboratoire usuels.
//
//   Granularité      lmax, dmax (mm) ; tamisat63, tamisat2 (%) ; cu ; d60 (µm) ;
//                    fraction63a2, fraction2a63, fraction0a63 (%)
//   Argilosité       vbs, ip
//   État hydrique    wSurWopn, ic, ipi, cbri
//   Mécanique        losAngeles, microDeval, friabilite
//   Gel              wa24 (%), gelDegelF4 (booléen), penteGonflement (mm/(°C·h)^0,5)
//   Matériau traité  rcTraite, ritTraite (MPa), zoneAbaque (1 à 5)
//
// Les matériaux rocheux ont leur propre fiche (roches.js) : famille, lmax, losAngeles,
// microDeval, rhoD, ifr, idga, wn, wSurWopn, ipi, solubles.

/**
 * Description des essais : libellé, unité, norme d'essai quand le guide la cite, et seuils où
 * l'essai intervient. Sert aux libellés des justifications et aux tableaux du cours.
 */
export const ESSAIS = {
  // ---------------------------------------------------------------- Granularité
  lmax: { libelle: "Lmax", unite: "mm", norme: null,
    role: "Dimension maximale des plus gros éléments. Seuil 250 mm : matériaux blocailleux ; en couche de forme non traitée, Lmax ≤ 250 mm et ≤ la moitié de l'épaisseur compactée." },
  dmax: { libelle: "Dmax", unite: "mm", norme: null,
    role: "Plus grand diamètre des éléments, assimilé au D95. Seuil 63 mm : sols / sols blocailleux VC." },
  tamisat63: { libelle: "Tamisat à 63 µm", unite: "%", norme: null,
    role: "Seuils 5, 12, 15 et 35 %." },
  tamisat2: { libelle: "Tamisat à 2 mm", unite: "%", norme: null,
    role: "Seuil 70 % pour les états hydriques des sols sableux." },
  cu: { libelle: "Cu", unite: "", norme: "NF EN ISO 14688-2",
    role: "Coefficient d'uniformité Cu = D60/D10. Seuil 6 : granulométrie étalée au-delà, uniforme en deçà." },
  d60: { libelle: "D60", unite: "µm", norme: null,
    role: "Utilisé à défaut de Cu quand les fines sont comprises entre 10 et 15 % : D60 ≥ 400 µm vaut granulométrie étalée, D60 < 400 µm granulométrie uniforme." },
  fraction63a2: { libelle: "Fraction 0,063/2 mm", unite: "%", norme: null,
    role: "Comparée à la fraction 2/63 mm pour trancher sableux / graveleux." },
  fraction2a63: { libelle: "Fraction 2/63 mm", unite: "%", norme: null,
    role: "Comparée à la fraction 0,063/2 mm pour trancher sableux / graveleux." },
  fraction0a63: { libelle: "Fraction 0/63 mm", unite: "%", norme: null,
    role: "Part de la fraction 0/63 mm dans le sol total, pour les sols blocailleux (Dmax > 63 mm). Le GTR sépare VC1 (≤ 60 à 80 %, très charpenté) de VC2 (> 60 à 80 %, peu charpenté) : le seuil est une bande, pas une valeur." },

  // ---------------------------------------------------------------- Argilosité
  vbs: { libelle: "VBS", unite: "", norme: "NF EN 17542-3", role: "Valeur de bleu de méthylène du sol." },
  ip: { libelle: "Ip", unite: "", norme: "NF EN ISO 17892-12", role: "Indice de plasticité." },

  // ---------------------------------------------------------------- État hydrique
  wSurWopn: { libelle: "w_n/w_OPN", unite: "", norme: null,
    role: "Rapport de la teneur en eau naturelle à l'optimum Proctor normal. Paramètre le plus fiable pour les états (s) et (ts)." },
  ic: { libelle: "Ic", unite: "", norme: null,
    role: "Indice de consistance Ic = (w_L − w_n) / Ip, sur la fraction 0/400 µm." },
  ipi: { libelle: "IPI", unite: "", norme: "NF EN 13286-47",
    role: "Indice portant immédiat. À privilégier pour les états (h) et (th)." },
  cbri: { libelle: "CBRi", unite: "", norme: "NF EN 13286-47",
    role: "Indice CBR après 4 jours d'immersion. Seuil 20 pour l'insensibilité à l'eau." },

  // ---------------------------------------------------------------- Comportement mécanique
  losAngeles: { libelle: "LA", unite: "", norme: "NF EN 1097-2",
    role: "Los Angeles sur 10/14 mm (à défaut 6,3/10). Seuil 45 pour les sols ; 25, 35 et 45 pour les roches." },
  microDeval: { libelle: "MDE", unite: "", norme: "NF EN 1097-1",
    role: "Micro-Deval en présence d'eau sur 10/14 mm. Seuil 45 pour les sols ; 10, 25 et 45 pour les roches." },
  friabilite: { libelle: "FS", unite: "", norme: "NF P18-576",
    role: "Friabilité des sables sur 0,2/2 ou 0,2/4 mm. Seuil 60." },

  // ---------------------------------------------------------------- Sensibilité au gel
  wa24: { libelle: "WA24", unite: "%", norme: "NF EN 1097-6",
    role: "Absorption d'eau. Seuil 2 % pour l'insensibilité à la gélifraction." },
  gelDegelF4: { libelle: "Catégorie F4 au gel-dégel", unite: "", norme: "NF EN 1367-1",
    role: "Vrai quand l'essai de résistance au gel-dégel classe le matériau en catégorie F4." },
  penteGonflement: { libelle: "Pente de gonflement au gel p", unite: "mm/(°C·h)^0,5", norme: "NF P98-234-2",
    role: "Seuil 0,05 pour les matériaux traités." },

  // ---------------------------------------------------------------- Matériau traité
  rcTraite: { libelle: "Rc", unite: "MPa", norme: "NF EN 13286-41",
    role: "Résistance à la compression simple du mélange sol-liant." },
  ritTraite: { libelle: "Rit", unite: "MPa", norme: "NF EN 13286-42",
    role: "Résistance en traction diamétrale du mélange sol-liant." },
  zoneAbaque: { libelle: "Zone de l'abaque", unite: "", norme: null,
    role: "Zone de l'abaque de la figure 12 (1 à 5), lue à 90 jours dans le plan (E, Rt) sur éprouvette moulée à la compacité prévisible en fond de couche. L'abaque n'est pas numérisé : la zone est relevée par le laboratoire." },

  // ---------------------------------------------------------------- Matériaux rocheux
  rhoD: { libelle: "ρd", unite: "Mg/m³", norme: "NF P94-064",
    role: "Masse volumique de la roche déshydratée en place (t/m³)." },
  ifr: { libelle: "IFR", unite: "", norme: "NF EN 17542-2", role: "Coefficient de fragmentabilité. Seuil 7." },
  idga: { libelle: "IDGa", unite: "", norme: "NF EN 17542-1", role: "Coefficient de dégradabilité. Seuils 5 et 20." },
  wn: { libelle: "w_n", unite: "%", norme: null,
    role: "Teneur en eau naturelle, pour les craies et les roches argileuses très fragmentables." },
  solubles: { libelle: "Éléments solubles", unite: "%", norme: "NF ISO 11048 / NF EN 1744-5",
    role: "Teneur en éléments solubles, pour les roches salines." },

  // ---------------------------------------------------------------- Autres entrées
  teneurOrganique: { libelle: "Teneur en matières organiques", unite: "%", norme: "NF EN 17685-1",
    role: "Mesurée par perte au feu. Seuils 2, 6 et 20 %." },
  tauxImbrules: { libelle: "Taux d'imbrûlés", unite: "%", norme: "NF EN 1744-1 art. 17",
    role: "Taux à 975 °C moins taux à 500 °C, pour les schistes houillers. Seuil 20 %." },
  cbr: { libelle: "CBR", unite: "%", norme: "NF EN 13286-47", role: "Indice CBR du sol support." },
  module: { libelle: "E", unite: "MPa", norme: null, role: "Module de portance." },
  moduleCourtTerme: { libelle: "Portance d'arase à court terme", unite: "MPa", norme: null,
    role: "Portance mesurée à l'arase au moment des travaux." },
  epaisseur: { libelle: "Épaisseur", unite: "cm", norme: null, role: "Épaisseur de couche de forme." },
  drainageBaseChaussee: { libelle: "Drainage à la base de la chaussée", unite: "", norme: null,
    role: "Disposition constructive exigée, avec l'imperméabilisation de l'arase, pour l'AR2 sur PST3." },
  impermeabilisationArase: { libelle: "Imperméabilisation de l'arase", unite: "", norme: null,
    role: "Disposition constructive exigée, avec le drainage à la base de la chaussée, pour l'AR2 sur PST3." },
};

/** Libellé court d'un essai (la clé elle-même si l'essai n'est pas décrit). */
export const libelleEssai = (cle) => ESSAIS[cle]?.libelle ?? cle;

/** Champs d'une identification de sol. */
export const CHAMPS_IDENTIFICATION = [
  "lmax", "dmax", "tamisat63", "tamisat2", "cu", "d60", "vbs", "ip", "wSurWopn", "ic", "ipi", "cbri",
  "losAngeles", "microDeval", "friabilite", "wa24", "gelDegelF4", "penteGonflement",
  "rcTraite", "ritTraite", "zoneAbaque", "fraction63a2", "fraction2a63", "fraction0a63",
];

/**
 * Identification complète, champs non renseignés à null. Une clé inconnue lève une erreur : une
 * faute de frappe (« tamisat80 ») ferait sinon passer un essai réalisé pour un essai manquant.
 */
export function nouvelleIdentification(valeurs = {}) {
  const inconnues = Object.keys(valeurs).filter((k) => !CHAMPS_IDENTIFICATION.includes(k));
  if (inconnues.length) throw new Error(`Champs d'identification inconnus : ${inconnues.join(", ")}`);
  const id = Object.fromEntries(CHAMPS_IDENTIFICATION.map((k) => [k, null]));
  return Object.assign(id, valeurs);
}

const vaut = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Tendance sableuse : vraie quand la fraction 0,063/2 mm est supérieure ou égale à la fraction
 * 2/63 mm. À défaut des deux fractions, elle se déduit des tamisats à 63 µm et à 2 mm : la
 * fraction 0,063/2 mm vaut alors (tamisat 2 mm − tamisat 63 µm) et la fraction 2/63 mm vaut
 * (100 − tamisat 2 mm). Null quand rien ne permet de trancher.
 */
export function tendanceSableuse(id) {
  if (vaut(id.fraction63a2) && vaut(id.fraction2a63)) return id.fraction63a2 >= id.fraction2a63;
  if (vaut(id.tamisat2) && vaut(id.tamisat63)) return id.tamisat2 - id.tamisat63 >= 100 - id.tamisat2;
  return null;
}

/**
 * Granulométrie étalée (Cu ≥ 6). Quand Cu n'est pas mesuré et que les fines sont comprises entre
 * 10 et 15 %, le GTR admet de trancher sur le D60 (remarque du § 2.2.1, fasc. 1 p. 29).
 */
export function granulometrieEtalee(id) {
  if (vaut(id.cu)) return id.cu >= 6;
  if (vaut(id.d60) && vaut(id.tamisat63) && id.tamisat63 >= 10 && id.tamisat63 <= 15) return id.d60 >= 400;
  return null;
}
