// Module Sols : identification et classification GTR 2024, PST, arase, couche de forme et
// plate-forme, barèmes CBR nationaux — portage du dossier Design/Soil de Burmister-Calc.
//
// Chaque fonction de classement rend la classe ET la justification : `etapes`, le chemin suivi
// dans l'arbre de décision, chaque étape portant les seuils comparés (voir justification.js),
// et `manquants` / `avertissements` pour ce que les essais ne permettent pas de trancher.
//
//   identification.js            fiche d'essais d'un sol, tendance sableuse, granulométrie étalée
//   gtr2024.js                   classerSol : F, I, S, G, VC, sous-classe mécanique, état hydrique
//   roches.js                    classerRoche : craies CH, roches R1 à R5 par nature pétrographique
//   organiques-alternatifs.js    sols organiques O1 à O3, matériaux alternatifs AN / AM / AR
//   correspondance-gtr1992.js    lien avec la NF P11-300 (A, B, C, D, R du « GTR 2000 »)
//   plateforme.js                états hydriques, cas de PST (tableau 17), arases, PF (tableaux 18-19)
//   pst.js                       conseillerPst : cas de PST et arase selon le sol et le contexte
//   couche-de-forme.js           tableaux 20 à 23, plate-forme réellement obtenue (§ 4.3.4)
//   acceptation-couche-de-forme  critères du § 4.2, tableaux 13 à 15, annexe 3 (usages)
//   conditions-couche-de-forme   annexe 3 selon la situation météorologique, codes GWTS
//   echelles-cbr.js              barèmes CBR de Tunisie, du Sénégal, de Côte d'Ivoire, tropicaux
//   methodes.js                  voies de détermination par pays, chaîne complète jusqu'au module

export * from "./justification.js";
export * from "./identification.js";
export * from "./plateforme.js";
export * from "./gtr2024.js";
export * from "./roches.js";
export * from "./organiques-alternatifs.js";
export * from "./correspondance-gtr1992.js";
export * from "./pst.js";
export * from "./couche-de-forme.js";
export * from "./acceptation-couche-de-forme.js";
export * from "./conditions-couche-de-forme.js";
export * from "./echelles-cbr.js";
export * from "./methodes.js";
