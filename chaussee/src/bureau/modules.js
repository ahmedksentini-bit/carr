// Liste des modules du bureau de calcul, dans l'ordre de la barre latérale.
import trafic from "./poids-lourds.js";
import sols from "./sols.js";
import fiches from "./fiches.js";
import catalogue from "./catalogue.js";
import neuve from "./dimensionnement.js";
import structure from "./structure.js";
import auscultation from "./auscultation.js";
import retrocalcul from "./retrocalcul.js";
import renforcement from "./renforcement.js";

export const MODULES = [trafic, sols, fiches, catalogue, neuve, auscultation, retrocalcul, renforcement, structure];
