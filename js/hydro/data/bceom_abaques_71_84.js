// bceom_abaques_71_84.js — abaques BCEOM (Nguyen Van Tuu, « La route et l'hydraulique », BCEOM 1979,
// figures 71 à 84), copie conforme de BVTrace data/bceom_abaques_71_84.json (schéma khydroroute.bceom.abaques v1.0.0).
// Source unique côté BVTrace : à régénérer depuis le JSON si celui-ci évolue — ne jamais retoucher un point ici.
// Les « ancres_validation » (exemples imprimés du manuel) ont priorité sur le relevé graphique.
// Contre-épreuve seulement : ces abaques ne participent jamais au niveau amont retenu (HDS-5).
export const BCEOM_ABAQUES = {
 "schema": "khydroroute.bceom.abaques",
 "version": "1.0.0",
 "langue": "fr",
 "source": {
  "titre": "La route et l'hydraulique",
  "auteur": "Nguyen Van Tuu",
  "organisme": "BCEOM",
  "annee": 1979,
  "pages_imprimees": "234-263",
  "figures": "71-84"
 },
 "constantes": {
  "g_m_s2": 9.81
 },
 "regles_interpolation": {
  "courbes_graphiques_71_73_75_77": "interpolation_lineaire_en_log10(Q*)_log10(valeur)",
  "courbes_analytiques_79_82_83_84": "interpolation_lineaire_en_log10(Q*)_log10(valeur)",
  "extrapolation": false,
  "gestion_hors_domaine": "retourner_null_et_afficher_un_avertissement"
 },
 "avertissements": [
  "Les figures 71, 72, 73, 75 et 77 proviennent d'un relevé graphique sur un scan ancien; leurs points non cités dans les exemples du manuel doivent être considérés comme provisoires jusqu'à double pointage indépendant.",
  "Les ancres numériques provenant des exemples imprimés ont priorité sur le relevé graphique.",
  "Les figures 74, 76, 78, 80 et 81 sont des nomogrammes de conversion et doivent être remplacées par le calcul direct de leur formule.",
  "Les figures 79, 82, 83 et 84 sont reconstruites analytiquement et déjà utilisées par K-HydroRoute."
 ],
 "abaques_niveau_amont": [
  {
   "figure": 71,
   "page_imprimee": 236,
   "ouvrage": "buse_metallique_circulaire_D_inferieur_ou_egal_2m",
   "axes": {
    "x": "Q*",
    "y": "H1*"
   },
   "definitions": {
    "Q*": "Q / sqrt(2*g*D^5)",
    "H1*": "H1 / D"
   },
   "echelles": {
    "x": "log10",
    "y": "log10"
   },
   "qualite": "digitalisation_graphique_a_valider",
   "incertitude_relative_estimee_pct": 5,
   "courbes": [
    {
     "id": "mur_de_tete",
     "libelle": "Avec mur de tête",
     "points": [
      {
       "q_reduit": 0.1,
       "h_amont_reduit": 0.52
      },
      {
       "q_reduit": 0.12,
       "h_amont_reduit": 0.59
      },
      {
       "q_reduit": 0.15,
       "h_amont_reduit": 0.68
      },
      {
       "q_reduit": 0.2,
       "h_amont_reduit": 0.82
      },
      {
       "q_reduit": 0.25,
       "h_amont_reduit": 0.96
      },
      {
       "q_reduit": 0.3,
       "h_amont_reduit": 1.1
      },
      {
       "q_reduit": 0.4,
       "h_amont_reduit": 1.43
      },
      {
       "q_reduit": 0.5,
       "h_amont_reduit": 1.78
      },
      {
       "q_reduit": 0.6,
       "h_amont_reduit": 2.15
      },
      {
       "q_reduit": 0.7,
       "h_amont_reduit": 2.58
      },
      {
       "q_reduit": 0.8,
       "h_amont_reduit": 3.05
      },
      {
       "q_reduit": 1,
       "h_amont_reduit": 4.1
      },
      {
       "q_reduit": 1.2,
       "h_amont_reduit": 5.35
      },
      {
       "q_reduit": 1.35,
       "h_amont_reduit": 6.1
      }
     ]
    },
    {
     "id": "tete_saillante_hors_remblai",
     "libelle": "Tête saillante hors du remblai",
     "points": [
      {
       "q_reduit": 0.1,
       "h_amont_reduit": 0.57
      },
      {
       "q_reduit": 0.12,
       "h_amont_reduit": 0.64
      },
      {
       "q_reduit": 0.15,
       "h_amont_reduit": 0.73
      },
      {
       "q_reduit": 0.2,
       "h_amont_reduit": 0.88
      },
      {
       "q_reduit": 0.25,
       "h_amont_reduit": 1.03
      },
      {
       "q_reduit": 0.3,
       "h_amont_reduit": 1.18
      },
      {
       "q_reduit": 0.4,
       "h_amont_reduit": 1.55
      },
      {
       "q_reduit": 0.5,
       "h_amont_reduit": 1.94
      },
      {
       "q_reduit": 0.6,
       "h_amont_reduit": 2.37
      },
      {
       "q_reduit": 0.7,
       "h_amont_reduit": 2.86
      },
      {
       "q_reduit": 0.8,
       "h_amont_reduit": 3.4
      },
      {
       "q_reduit": 1,
       "h_amont_reduit": 4.6
      },
      {
       "q_reduit": 1.15,
       "h_amont_reduit": 5.65
      },
      {
       "q_reduit": 1.25,
       "h_amont_reduit": 6.25
      }
     ]
    }
   ]
  },
  {
   "figure": 72,
   "page_imprimee": 237,
   "ouvrage": "buse_beton_circulaire_emboitement_femelle",
   "axes": {
    "x": "Q*",
    "y": "H1*"
   },
   "definitions": {
    "Q*": "Q / sqrt(2*g*D^5)",
    "H1*": "H1 / D"
   },
   "echelles": {
    "x": "log10",
    "y": "log10"
   },
   "qualite": "digitalisation_graphique_a_valider",
   "incertitude_relative_estimee_pct": 5,
   "courbes": [
    {
     "id": "emboitement_femelle",
     "libelle": "Extrémité amont à emboîtement femelle",
     "points": [
      {
       "q_reduit": 0.12,
       "h_amont_reduit": 0.6
      },
      {
       "q_reduit": 0.15,
       "h_amont_reduit": 0.68
      },
      {
       "q_reduit": 0.2,
       "h_amont_reduit": 0.82
      },
      {
       "q_reduit": 0.25,
       "h_amont_reduit": 0.95
      },
      {
       "q_reduit": 0.3,
       "h_amont_reduit": 1.08
      },
      {
       "q_reduit": 0.4,
       "h_amont_reduit": 1.35
      },
      {
       "q_reduit": 0.5,
       "h_amont_reduit": 1.64
      },
      {
       "q_reduit": 0.6,
       "h_amont_reduit": 1.96
      },
      {
       "q_reduit": 0.7,
       "h_amont_reduit": 2.3
      },
      {
       "q_reduit": 0.8,
       "h_amont_reduit": 2.68
      },
      {
       "q_reduit": 0.9,
       "h_amont_reduit": 3.1
      },
      {
       "q_reduit": 1,
       "h_amont_reduit": 3.55
      },
      {
       "q_reduit": 1.1,
       "h_amont_reduit": 4.05
      },
      {
       "q_reduit": 1.2,
       "h_amont_reduit": 4.6
      },
      {
       "q_reduit": 1.3,
       "h_amont_reduit": 5.2
      },
      {
       "q_reduit": 1.4,
       "h_amont_reduit": 5.85
      }
     ]
    }
   ]
  },
  {
   "figure": 73,
   "page_imprimee": 239,
   "ouvrage": "grande_buse_metallique_circulaire_D_superieur_2m_entree_chanfreinee",
   "axes": {
    "x": "Q*",
    "y": "H1*"
   },
   "definitions": {
    "Q*": "Q / sqrt(2*g*D^5)",
    "H1*": "H1 / D"
   },
   "echelles": {
    "x": "log10",
    "y": "log10"
   },
   "qualite": "digitalisation_graphique_avec_ancres_manuelles",
   "incertitude_relative_estimee_pct": 5,
   "courbes": [
    {
     "id": "chanfrein_type_A",
     "libelle": "Entrée chanfreinée type A",
     "points": [
      {
       "q_reduit": 0.12,
       "h_amont_reduit": 0.64
      },
      {
       "q_reduit": 0.134,
       "h_amont_reduit": 0.69
      },
      {
       "q_reduit": 0.15,
       "h_amont_reduit": 0.735
      },
      {
       "q_reduit": 0.171,
       "h_amont_reduit": 0.795
      },
      {
       "q_reduit": 0.2,
       "h_amont_reduit": 0.87
      },
      {
       "q_reduit": 0.25,
       "h_amont_reduit": 1
      },
      {
       "q_reduit": 0.3,
       "h_amont_reduit": 1.13
      },
      {
       "q_reduit": 0.4,
       "h_amont_reduit": 1.38
      },
      {
       "q_reduit": 0.5,
       "h_amont_reduit": 1.65
      },
      {
       "q_reduit": 0.6,
       "h_amont_reduit": 1.95
      },
      {
       "q_reduit": 0.7,
       "h_amont_reduit": 2.28
      },
      {
       "q_reduit": 0.8,
       "h_amont_reduit": 2.65
      },
      {
       "q_reduit": 0.9,
       "h_amont_reduit": 3.05
      },
      {
       "q_reduit": 1,
       "h_amont_reduit": 3.48
      },
      {
       "q_reduit": 1.1,
       "h_amont_reduit": 3.95
      }
     ]
    },
    {
     "id": "chanfrein_type_B",
     "libelle": "Entrée chanfreinée type B",
     "points": [
      {
       "q_reduit": 0.12,
       "h_amont_reduit": 0.67
      },
      {
       "q_reduit": 0.15,
       "h_amont_reduit": 0.76
      },
      {
       "q_reduit": 0.2,
       "h_amont_reduit": 0.9
      },
      {
       "q_reduit": 0.25,
       "h_amont_reduit": 1.04
      },
      {
       "q_reduit": 0.3,
       "h_amont_reduit": 1.18
      },
      {
       "q_reduit": 0.4,
       "h_amont_reduit": 1.45
      },
      {
       "q_reduit": 0.5,
       "h_amont_reduit": 1.74
      },
      {
       "q_reduit": 0.6,
       "h_amont_reduit": 2.07
      },
      {
       "q_reduit": 0.7,
       "h_amont_reduit": 2.43
      },
      {
       "q_reduit": 0.8,
       "h_amont_reduit": 2.84
      },
      {
       "q_reduit": 0.9,
       "h_amont_reduit": 3.28
      },
      {
       "q_reduit": 1,
       "h_amont_reduit": 3.77
      },
      {
       "q_reduit": 1.08,
       "h_amont_reduit": 4.2
      }
     ]
    }
   ],
   "ancres_validation": [
    {
     "courbe": "chanfrein_type_A",
     "Q*": 0.171,
     "H1*": 0.795,
     "origine": "exemple_numerique_page_241"
    },
    {
     "courbe": "chanfrein_type_A",
     "Q*": 0.134,
     "H1*": 0.69,
     "origine": "exemple_numerique_page_242"
    }
   ]
  },
  {
   "figure": 75,
   "page_imprimee": 244,
   "ouvrage": "buse_arche",
   "axes": {
    "x": "Q*",
    "y": "H1*"
   },
   "definitions": {
    "Q*": "Q / (A*sqrt(2*g*D))",
    "H1*": "H1 / D"
   },
   "echelles": {
    "x": "log10",
    "y": "log10"
   },
   "qualite": "digitalisation_graphique_avec_ancres_manuelles",
   "incertitude_relative_estimee_pct": 5,
   "courbes": [
    {
     "id": "courbe_1_mur_de_tete",
     "libelle": "Avec mur de tête",
     "points": [
      {
       "q_reduit": 0.05,
       "h_amont_reduit": 0.32
      },
      {
       "q_reduit": 0.07,
       "h_amont_reduit": 0.37
      },
      {
       "q_reduit": 0.1,
       "h_amont_reduit": 0.44
      },
      {
       "q_reduit": 0.15,
       "h_amont_reduit": 0.54
      },
      {
       "q_reduit": 0.2,
       "h_amont_reduit": 0.63
      },
      {
       "q_reduit": 0.28,
       "h_amont_reduit": 0.76
      },
      {
       "q_reduit": 0.3,
       "h_amont_reduit": 0.8
      },
      {
       "q_reduit": 0.4,
       "h_amont_reduit": 1
      },
      {
       "q_reduit": 0.5,
       "h_amont_reduit": 1.23
      },
      {
       "q_reduit": 0.6,
       "h_amont_reduit": 1.5
      },
      {
       "q_reduit": 0.7,
       "h_amont_reduit": 1.8
      },
      {
       "q_reduit": 0.8,
       "h_amont_reduit": 2.15
      },
      {
       "q_reduit": 0.9,
       "h_amont_reduit": 2.55
      },
      {
       "q_reduit": 1,
       "h_amont_reduit": 3
      }
     ]
    },
    {
     "id": "courbe_2_sifflet_talus",
     "libelle": "Tête en sifflet suivant la pente du talus",
     "points": [
      {
       "q_reduit": 0.05,
       "h_amont_reduit": 0.34
      },
      {
       "q_reduit": 0.07,
       "h_amont_reduit": 0.39
      },
      {
       "q_reduit": 0.1,
       "h_amont_reduit": 0.46
      },
      {
       "q_reduit": 0.15,
       "h_amont_reduit": 0.57
      },
      {
       "q_reduit": 0.169,
       "h_amont_reduit": 0.6
      },
      {
       "q_reduit": 0.2,
       "h_amont_reduit": 0.66
      },
      {
       "q_reduit": 0.28,
       "h_amont_reduit": 0.81
      },
      {
       "q_reduit": 0.3,
       "h_amont_reduit": 0.85
      },
      {
       "q_reduit": 0.4,
       "h_amont_reduit": 1.07
      },
      {
       "q_reduit": 0.5,
       "h_amont_reduit": 1.32
      },
      {
       "q_reduit": 0.6,
       "h_amont_reduit": 1.61
      },
      {
       "q_reduit": 0.7,
       "h_amont_reduit": 1.95
      },
      {
       "q_reduit": 0.8,
       "h_amont_reduit": 2.34
      },
      {
       "q_reduit": 0.9,
       "h_amont_reduit": 2.78
      },
      {
       "q_reduit": 1,
       "h_amont_reduit": 3.28
      }
     ]
    },
    {
     "id": "courbe_3_tete_saillante",
     "libelle": "Tête saillante hors du remblai",
     "points": [
      {
       "q_reduit": 0.04,
       "h_amont_reduit": 0.36
      },
      {
       "q_reduit": 0.05,
       "h_amont_reduit": 0.41
      },
      {
       "q_reduit": 0.07,
       "h_amont_reduit": 0.5
      },
      {
       "q_reduit": 0.1,
       "h_amont_reduit": 0.62
      },
      {
       "q_reduit": 0.15,
       "h_amont_reduit": 0.82
      },
      {
       "q_reduit": 0.2,
       "h_amont_reduit": 1.03
      },
      {
       "q_reduit": 0.28,
       "h_amont_reduit": 1.34
      },
      {
       "q_reduit": 0.3,
       "h_amont_reduit": 1.43
      },
      {
       "q_reduit": 0.4,
       "h_amont_reduit": 1.85
      },
      {
       "q_reduit": 0.5,
       "h_amont_reduit": 2.32
      },
      {
       "q_reduit": 0.6,
       "h_amont_reduit": 2.85
      },
      {
       "q_reduit": 0.7,
       "h_amont_reduit": 3.45
      },
      {
       "q_reduit": 0.8,
       "h_amont_reduit": 4.1
      }
     ]
    }
   ],
   "ancres_validation": [
    {
     "courbe": "courbe_2_sifflet_talus",
     "Q*": 0.28,
     "H1*": 0.81,
     "origine": "exemple_numerique_page_243"
    },
    {
     "courbe": "courbe_2_sifflet_talus",
     "Q*": 0.169,
     "H1*": 0.6,
     "origine": "exemple_numerique_page_246"
    }
   ]
  },
  {
   "figure": 77,
   "page_imprimee": 248,
   "ouvrage": "dalot_rectangulaire",
   "axes": {
    "x": "Q*",
    "y": "H1*"
   },
   "definitions": {
    "Q*": "Q / (B*D*sqrt(2*g*D))",
    "H1*": "H1 / D"
   },
   "echelles": {
    "x": "log10",
    "y": "log10"
   },
   "qualite": "digitalisation_graphique_avec_ancres_manuelles",
   "incertitude_relative_estimee_pct": 5,
   "courbes": [
    {
     "id": "A_ailes_30_75",
     "libelle": "Murs en aile faisant 30° à 75° avec l’axe de l’ouvrage",
     "points": [
      {
       "q_reduit": 0.1,
       "h_amont_reduit": 0.46
      },
      {
       "q_reduit": 0.12,
       "h_amont_reduit": 0.52
      },
      {
       "q_reduit": 0.15,
       "h_amont_reduit": 0.6
      },
      {
       "q_reduit": 0.2,
       "h_amont_reduit": 0.7
      },
      {
       "q_reduit": 0.25,
       "h_amont_reduit": 0.78
      },
      {
       "q_reduit": 0.28,
       "h_amont_reduit": 0.83
      },
      {
       "q_reduit": 0.287,
       "h_amont_reduit": 0.84
      },
      {
       "q_reduit": 0.3,
       "h_amont_reduit": 0.87
      },
      {
       "q_reduit": 0.4,
       "h_amont_reduit": 1.06
      },
      {
       "q_reduit": 0.5,
       "h_amont_reduit": 1.3
      },
      {
       "q_reduit": 0.6,
       "h_amont_reduit": 1.57
      },
      {
       "q_reduit": 0.7,
       "h_amont_reduit": 1.86
      },
      {
       "q_reduit": 0.8,
       "h_amont_reduit": 2.18
      },
      {
       "q_reduit": 0.9,
       "h_amont_reduit": 2.56
      },
      {
       "q_reduit": 1,
       "h_amont_reduit": 3.02
      },
      {
       "q_reduit": 1.1,
       "h_amont_reduit": 3.6
      },
      {
       "q_reduit": 1.2,
       "h_amont_reduit": 4.3
      },
      {
       "q_reduit": 1.28,
       "h_amont_reduit": 5
      }
     ]
    },
    {
     "id": "B_mur_de_tete_sans_ailes",
     "libelle": "Mur de tête sans mur en aile",
     "points": [
      {
       "q_reduit": 0.1,
       "h_amont_reduit": 0.49
      },
      {
       "q_reduit": 0.12,
       "h_amont_reduit": 0.55
      },
      {
       "q_reduit": 0.15,
       "h_amont_reduit": 0.63
      },
      {
       "q_reduit": 0.2,
       "h_amont_reduit": 0.73
      },
      {
       "q_reduit": 0.25,
       "h_amont_reduit": 0.82
      },
      {
       "q_reduit": 0.28,
       "h_amont_reduit": 0.87
      },
      {
       "q_reduit": 0.3,
       "h_amont_reduit": 0.91
      },
      {
       "q_reduit": 0.4,
       "h_amont_reduit": 1.11
      },
      {
       "q_reduit": 0.5,
       "h_amont_reduit": 1.38
      },
      {
       "q_reduit": 0.6,
       "h_amont_reduit": 1.67
      },
      {
       "q_reduit": 0.7,
       "h_amont_reduit": 2
      },
      {
       "q_reduit": 0.8,
       "h_amont_reduit": 2.36
      },
      {
       "q_reduit": 0.9,
       "h_amont_reduit": 2.8
      },
      {
       "q_reduit": 1,
       "h_amont_reduit": 3.3
      },
      {
       "q_reduit": 1.1,
       "h_amont_reduit": 3.92
      },
      {
       "q_reduit": 1.18,
       "h_amont_reduit": 4.6
      }
     ]
    },
    {
     "id": "C_saillante_ou_sifflet",
     "libelle": "Tête saillante ou coupée en sifflet suivant le talus",
     "points": [
      {
       "q_reduit": 0.1,
       "h_amont_reduit": 0.51
      },
      {
       "q_reduit": 0.12,
       "h_amont_reduit": 0.57
      },
      {
       "q_reduit": 0.15,
       "h_amont_reduit": 0.65
      },
      {
       "q_reduit": 0.2,
       "h_amont_reduit": 0.76
      },
      {
       "q_reduit": 0.25,
       "h_amont_reduit": 0.86
      },
      {
       "q_reduit": 0.28,
       "h_amont_reduit": 0.91
      },
      {
       "q_reduit": 0.3,
       "h_amont_reduit": 0.96
      },
      {
       "q_reduit": 0.4,
       "h_amont_reduit": 1.17
      },
      {
       "q_reduit": 0.5,
       "h_amont_reduit": 1.47
      },
      {
       "q_reduit": 0.6,
       "h_amont_reduit": 1.79
      },
      {
       "q_reduit": 0.7,
       "h_amont_reduit": 2.15
      },
      {
       "q_reduit": 0.8,
       "h_amont_reduit": 2.57
      },
      {
       "q_reduit": 0.9,
       "h_amont_reduit": 3.05
      },
      {
       "q_reduit": 1,
       "h_amont_reduit": 3.62
      },
      {
       "q_reduit": 1.1,
       "h_amont_reduit": 4.32
      },
      {
       "q_reduit": 1.16,
       "h_amont_reduit": 4.9
      }
     ]
    }
   ],
   "ancres_validation": [
    {
     "courbe": "A_ailes_30_75",
     "Q*": 0.28,
     "H1*": 0.83,
     "origine": "exemple_numerique_page_250"
    },
    {
     "courbe": "A_ailes_30_75",
     "Q*": 0.287,
     "H1*": 0.84,
     "origine": "exemple_numerique_page_250"
    }
   ]
  }
 ],
 "nomogrammes": [
  {
   "figure": 74,
   "page_imprimee": 240,
   "ouvrage": "buse_circulaire",
   "type": "nomogramme_conversion_exacte",
   "sortie": "Q*",
   "formule": "Q / sqrt(2*g*D^5)",
   "remplace_par_calcul_direct": true
  },
  {
   "figure": 76,
   "page_imprimee": 245,
   "ouvrage": "buse_arche",
   "type": "nomogramme_conversion_exacte",
   "sortie": "Q*",
   "formule": "Q / (A*sqrt(2*g*D))",
   "remplace_par_calcul_direct": true
  },
  {
   "figure": 78,
   "page_imprimee": 249,
   "ouvrage": "dalot_rectangulaire",
   "type": "nomogramme_conversion_exacte",
   "sortie": "Q*",
   "formule": "Q / (B*D*sqrt(2*g*D))",
   "remplace_par_calcul_direct": true
  },
  {
   "figure": 80,
   "page_imprimee": 255,
   "ouvrage": "buse_circulaire_ou_arche",
   "type": "nomogramme_conversion_exacte",
   "sortie": "Q*",
   "formule": "Q / sqrt(g*R^5)",
   "remplace_par_calcul_direct": true
  },
  {
   "figure": 81,
   "page_imprimee": 256,
   "ouvrage": "buse_circulaire_ou_arche",
   "type": "nomogramme_conversion_exacte",
   "sortie": "Ic",
   "formule": "Ic_reduit*g/(K^2*R^(1/3))",
   "remplace_par_calcul_direct": true
  }
 ],
 "abaques_analytiques": [
  {
   "figure": 79,
   "page_imprimee": 254,
   "forme": "buse_circulaire",
   "parametre": "theta_rad",
   "grandeur_reduite": "I_critique_reduit",
   "qualite": "reconstruction_analytique_validee",
   "points": [
    {
     "parametre_geometrique": 0.02,
     "q_reduit": 6.15786916756e-8,
     "valeur_reduite": 19.5761652477
    },
    {
     "parametre_geometrique": 0.0458466054466,
     "q_reduit": 0.00000169972661098,
     "valeur_reduite": 11.264587787
    },
    {
     "parametre_geometrique": 0.0716932108932,
     "q_reduit": 0.0000101572607895,
     "valeur_reduite": 8.36711979108
    },
    {
     "parametre_geometrique": 0.0975398163397,
     "q_reduit": 0.000034768076066,
     "valeur_reduite": 6.82155628113
    },
    {
     "parametre_geometrique": 0.123386421786,
     "q_reduit": 0.0000889170764235,
     "valeur_reduite": 5.83990139642
    },
    {
     "parametre_geometrique": 0.149233027233,
     "q_reduit": 0.000189982068158,
     "valeur_reduite": 5.15294105795
    },
    {
     "parametre_geometrique": 0.175079632679,
     "q_reduit": 0.000359258313671,
     "valeur_reduite": 4.64150285582
    },
    {
     "parametre_geometrique": 0.200926238126,
     "q_reduit": 0.000621866069333,
     "valeur_reduite": 4.24402430371
    },
    {
     "parametre_geometrique": 0.226772843573,
     "q_reduit": 0.00100664150398,
     "valeur_reduite": 3.92522374803
    },
    {
     "parametre_geometrique": 0.252619449019,
     "q_reduit": 0.00154601146603,
     "valeur_reduite": 3.66330600722
    },
    {
     "parametre_geometrique": 0.278466054466,
     "q_reduit": 0.00227585263682,
     "valeur_reduite": 3.44401893849
    },
    {
     "parametre_geometrique": 0.304312659912,
     "q_reduit": 0.00323533567512,
     "valeur_reduite": 3.25761689427
    },
    {
     "parametre_geometrique": 0.330159265359,
     "q_reduit": 0.0044667550227,
     "valeur_reduite": 3.09719103319
    },
    {
     "parametre_geometrique": 0.356005870806,
     "q_reduit": 0.00601534510303,
     "valeur_reduite": 2.95769578843
    },
    {
     "parametre_geometrique": 0.381852476252,
     "q_reduit": 0.00792908370442,
     "valeur_reduite": 2.8353533677
    },
    {
     "parametre_geometrique": 0.407699081699,
     "q_reduit": 0.0102584833949,
     "valeur_reduite": 2.7272746367
    },
    {
     "parametre_geometrique": 0.433545687145,
     "q_reduit": 0.013056371869,
     "valeur_reduite": 2.63120944622
    },
    {
     "parametre_geometrique": 0.459392292592,
     "q_reduit": 0.0163776621747,
     "valeur_reduite": 2.54537735509
    },
    {
     "parametre_geometrique": 0.485238898038,
     "q_reduit": 0.0202791138156,
     "valeur_reduite": 2.46834992698
    },
    {
     "parametre_geometrique": 0.511085503485,
     "q_reduit": 0.0248190857622,
     "valeur_reduite": 2.3989670567
    },
    {
     "parametre_geometrique": 0.536932108932,
     "q_reduit": 0.0300572824455,
     "valeur_reduite": 2.33627631292
    },
    {
     "parametre_geometrique": 0.562778714378,
     "q_reduit": 0.0360544938373,
     "valeur_reduite": 2.2794881937
    },
    {
     "parametre_geometrique": 0.588625319825,
     "q_reduit": 0.0428723307497,
     "valeur_reduite": 2.22794260167
    },
    {
     "parametre_geometrique": 0.614471925271,
     "q_reduit": 0.0505729565119,
     "valeur_reduite": 2.18108337009
    },
    {
     "parametre_geometrique": 0.640318530718,
     "q_reduit": 0.0592188161988,
     "valeur_reduite": 2.13843865889
    },
    {
     "parametre_geometrique": 0.666165136165,
     "q_reduit": 0.0688723646031,
     "valeur_reduite": 2.09960569272
    },
    {
     "parametre_geometrique": 0.692011741611,
     "q_reduit": 0.0795957941507,
     "valeur_reduite": 2.0642387536
    },
    {
     "parametre_geometrique": 0.717858347058,
     "q_reduit": 0.0914507639641,
     "valeur_reduite": 2.03203964262
    },
    {
     "parametre_geometrique": 0.743704952504,
     "q_reduit": 0.104498131282,
     "valeur_reduite": 2.00275003603
    },
    {
     "parametre_geometrique": 0.769551557951,
     "q_reduit": 0.118797686434,
     "valeur_reduite": 1.97614530943
    },
    {
     "parametre_geometrique": 0.795398163397,
     "q_reduit": 0.134407892564,
     "valeur_reduite": 1.95202951117
    },
    {
     "parametre_geometrique": 0.821244768844,
     "q_reduit": 0.151385631288,
     "valeur_reduite": 1.93023124287
    },
    {
     "parametre_geometrique": 0.847091374291,
     "q_reduit": 0.169785955432,
     "valeur_reduite": 1.91060026244
    },
    {
     "parametre_geometrique": 0.872937979737,
     "q_reduit": 0.189661850016,
     "valeur_reduite": 1.89300466677
    },
    {
     "parametre_geometrique": 0.898784585184,
     "q_reduit": 0.211064002565,
     "valeur_reduite": 1.87732854312
    },
    {
     "parametre_geometrique": 0.92463119063,
     "q_reduit": 0.234040583868,
     "valeur_reduite": 1.86347000218
    },
    {
     "parametre_geometrique": 0.950477796077,
     "q_reduit": 0.258637040197,
     "valeur_reduite": 1.851339524
    },
    {
     "parametre_geometrique": 0.976324401524,
     "q_reduit": 0.284895898028,
     "valeur_reduite": 1.84085856205
    },
    {
     "parametre_geometrique": 1.00217100697,
     "q_reduit": 0.312856582224,
     "valeur_reduite": 1.83195836173
    },
    {
     "parametre_geometrique": 1.02801761242,
     "q_reduit": 0.342555248604,
     "valeur_reduite": 1.82457895803
    },
    {
     "parametre_geometrique": 1.05386421786,
     "q_reduit": 0.374024631785,
     "valeur_reduite": 1.81866832384
    },
    {
     "parametre_geometrique": 1.07971082331,
     "q_reduit": 0.407293909132,
     "valeur_reduite": 1.81418164582
    },
    {
     "parametre_geometrique": 1.10555742876,
     "q_reduit": 0.442388581594,
     "valeur_reduite": 1.81108070884
    },
    {
     "parametre_geometrique": 1.1314040342,
     "q_reduit": 0.479330372149,
     "valeur_reduite": 1.80933337357
    },
    {
     "parametre_geometrique": 1.15725063965,
     "q_reduit": 0.518137142549,
     "valeur_reduite": 1.80891313445
    },
    {
     "parametre_geometrique": 1.1830972451,
     "q_reduit": 0.558822828969,
     "valeur_reduite": 1.80979874772
    },
    {
     "parametre_geometrique": 1.20894385054,
     "q_reduit": 0.601397397136,
     "valeur_reduite": 1.81197392071
    },
    {
     "parametre_geometrique": 1.23479045599,
     "q_reduit": 0.645866817441,
     "valeur_reduite": 1.81542705557
    },
    {
     "parametre_geometrique": 1.26063706144,
     "q_reduit": 0.692233060492,
     "valeur_reduite": 1.82015104142
    },
    {
     "parametre_geometrique": 1.28648366688,
     "q_reduit": 0.740494113513,
     "valeur_reduite": 1.8261430904
    },
    {
     "parametre_geometrique": 1.31233027233,
     "q_reduit": 0.790644017936,
     "valeur_reduite": 1.83340461367
    },
    {
     "parametre_geometrique": 1.33817687778,
     "q_reduit": 0.842672928482,
     "valeur_reduite": 1.84194113449
    },
    {
     "parametre_geometrique": 1.36402348322,
     "q_reduit": 0.896567194005,
     "valeur_reduite": 1.85176223586
    },
    {
     "parametre_geometrique": 1.38987008867,
     "q_reduit": 0.952309460283,
     "valeur_reduite": 1.86288154123
    },
    {
     "parametre_geometrique": 1.41571669412,
     "q_reduit": 1.00987879496,
     "valeur_reduite": 1.87531672689
    },
    {
     "parametre_geometrique": 1.44156329956,
     "q_reduit": 1.06925083478,
     "valeur_reduite": 1.88908956548
    },
    {
     "parametre_geometrique": 1.46740990501,
     "q_reduit": 1.13039795518,
     "valeur_reduite": 1.90422600041
    },
    {
     "parametre_geometrique": 1.49325651046,
     "q_reduit": 1.19328946245,
     "valeur_reduite": 1.92075625132
    },
    {
     "parametre_geometrique": 1.5191031159,
     "q_reduit": 1.25789180844,
     "valeur_reduite": 1.93871495151
    },
    {
     "parametre_geometrique": 1.54494972135,
     "q_reduit": 1.32416882801,
     "valeur_reduite": 1.95814131815
    },
    {
     "parametre_geometrique": 1.57079632679,
     "q_reduit": 1.39208199921,
     "valeur_reduite": 1.97907935723
    },
    {
     "parametre_geometrique": 1.59664293224,
     "q_reduit": 1.46159072648,
     "valeur_reduite": 2.00157810505
    },
    {
     "parametre_geometrique": 1.62248953769,
     "q_reduit": 1.53265264694,
     "valeur_reduite": 2.02569190905
    },
    {
     "parametre_geometrique": 1.64833614313,
     "q_reduit": 1.60522396006,
     "valeur_reduite": 2.05148075113
    },
    {
     "parametre_geometrique": 1.67418274858,
     "q_reduit": 1.67925978099,
     "valeur_reduite": 2.07901061721
    },
    {
     "parametre_geometrique": 1.70002935403,
     "q_reduit": 1.75471451811,
     "valeur_reduite": 2.10835391774
    },
    {
     "parametre_geometrique": 1.72587595947,
     "q_reduit": 1.8315422752,
     "valeur_reduite": 2.1395899643
    },
    {
     "parametre_geometrique": 1.75172256492,
     "q_reduit": 1.90969727909,
     "valeur_reduite": 2.17280550879
    },
    {
     "parametre_geometrique": 1.77756917037,
     "q_reduit": 1.98913433373,
     "valeur_reduite": 2.20809535237
    },
    {
     "parametre_geometrique": 1.80341577581,
     "q_reduit": 2.06980930177,
     "valeur_reduite": 2.24556303281
    },
    {
     "parametre_geometrique": 1.82926238126,
     "q_reduit": 2.15167961534,
     "valeur_reduite": 2.28532160033
    },
    {
     "parametre_geometrique": 1.85510898671,
     "q_reduit": 2.23470481762,
     "valeur_reduite": 2.32749449347
    },
    {
     "parametre_geometrique": 1.88095559215,
     "q_reduit": 2.31884713779,
     "valeur_reduite": 2.37221652894
    },
    {
     "parametre_geometrique": 1.9068021976,
     "q_reduit": 2.40407210192,
     "valeur_reduite": 2.41963502128
    },
    {
     "parametre_geometrique": 1.93264880305,
     "q_reduit": 2.49034918335,
     "valeur_reduite": 2.46991105139
    },
    {
     "parametre_geometrique": 1.95849540849,
     "q_reduit": 2.57765249673,
     "valeur_reduite": 2.52322090607
    },
    {
     "parametre_geometrique": 1.98434201394,
     "q_reduit": 2.66596154073,
     "valeur_reduite": 2.57975771487
    },
    {
     "parametre_geometrique": 2.01018861939,
     "q_reduit": 2.75526199547,
     "valeur_reduite": 2.63973331525
    },
    {
     "parametre_geometrique": 2.03603522483,
     "q_reduit": 2.84554658228,
     "valeur_reduite": 2.70338038315
    },
    {
     "parametre_geometrique": 2.06188183028,
     "q_reduit": 2.93681599438,
     "valeur_reduite": 2.77095487291
    },
    {
     "parametre_geometrique": 2.08772843573,
     "q_reduit": 3.02907990946,
     "valeur_reduite": 2.84273881926
    },
    {
     "parametre_geometrique": 2.11357504117,
     "q_reduit": 3.12235809719,
     "valeur_reduite": 2.91904356493
    },
    {
     "parametre_geometrique": 2.13942164662,
     "q_reduit": 3.21668163717,
     "valeur_reduite": 3.00021349007
    },
    {
     "parametre_geometrique": 2.16526825207,
     "q_reduit": 3.31209426664,
     "valeur_reduite": 3.08663033647
    },
    {
     "parametre_geometrique": 2.19111485751,
     "q_reduit": 3.40865388092,
     "valeur_reduite": 3.17871823925
    },
    {
     "parametre_geometrique": 2.21696146296,
     "q_reduit": 3.506434215,
     "valeur_reduite": 3.2769496043
    },
    {
     "parametre_geometrique": 2.24280806841,
     "q_reduit": 3.60552674053,
     "valeur_reduite": 3.3818520014
    },
    {
     "parametre_geometrique": 2.26865467385,
     "q_reduit": 3.70604282077,
     "valeur_reduite": 3.49401628317
    },
    {
     "parametre_geometrique": 2.2945012793,
     "q_reduit": 3.8081161756,
     "valeur_reduite": 3.61410619156
    },
    {
     "parametre_geometrique": 2.32034788475,
     "q_reduit": 3.91190572118,
     "valeur_reduite": 3.74286977927
    },
    {
     "parametre_geometrique": 2.34619449019,
     "q_reduit": 4.01759886468,
     "valeur_reduite": 3.88115305862
    },
    {
     "parametre_geometrique": 2.37204109564,
     "q_reduit": 4.12541535506,
     "valeur_reduite": 4.02991640148
    },
    {
     "parametre_geometrique": 2.39788770109,
     "q_reduit": 4.23561181648,
     "valeur_reduite": 4.19025435925
    },
    {
     "parametre_geometrique": 2.42373430653,
     "q_reduit": 4.34848712592,
     "valeur_reduite": 4.36341976458
    },
    {
     "parametre_geometrique": 2.44958091198,
     "q_reduit": 4.46438884071,
     "valeur_reduite": 4.55085323423
    },
    {
     "parametre_geometrique": 2.47542751743,
     "q_reduit": 4.5837209416,
     "valeur_reduite": 4.75421953979
    },
    {
     "parametre_geometrique": 2.50127412287,
     "q_reduit": 4.7069532367,
     "valeur_reduite": 4.97545278663
    },
    {
     "parametre_geometrique": 2.52712072832,
     "q_reduit": 4.83463287928,
     "valeur_reduite": 5.2168129945
    },
    {
     "parametre_geometrique": 2.55296733376,
     "q_reduit": 4.96739860032,
     "valeur_reduite": 5.48095758429
    },
    {
     "parametre_geometrique": 2.57881393921,
     "q_reduit": 5.1059984612,
     "valeur_reduite": 5.77103256292
    },
    {
     "parametre_geometrique": 2.60466054466,
     "q_reduit": 5.2513122196,
     "valeur_reduite": 6.09079004408
    },
    {
     "parametre_geometrique": 2.6305071501,
     "q_reduit": 5.40437981074,
     "valeur_reduite": 6.44474142767
    },
    {
     "parametre_geometrique": 2.65635375555,
     "q_reduit": 5.56643803884,
     "valeur_reduite": 6.83835953401
    },
    {
     "parametre_geometrique": 2.682200361,
     "q_reduit": 5.73896844566,
     "valeur_reduite": 7.27834897304
    },
    {
     "parametre_geometrique": 2.70804696644,
     "q_reduit": 5.9237606305,
     "valeur_reduite": 7.77301322471
    },
    {
     "parametre_geometrique": 2.73389357189,
     "q_reduit": 6.12299729838,
     "valeur_reduite": 8.33276134875
    },
    {
     "parametre_geometrique": 2.75974017734,
     "q_reduit": 6.33937044915,
     "valeur_reduite": 8.97082048256
    },
    {
     "parametre_geometrique": 2.78558678278,
     "q_reduit": 6.57624315962,
     "valeur_reduite": 9.70425871163
    },
    {
     "parametre_geometrique": 2.81143338823,
     "q_reduit": 6.837879745,
     "valeur_reduite": 10.555488397
    },
    {
     "parametre_geometrique": 2.83727999368,
     "q_reduit": 7.12978132258,
     "valeur_reduite": 11.5545356116
    },
    {
     "parametre_geometrique": 2.86312659912,
     "q_reduit": 7.45918903994,
     "valeur_reduite": 12.7425734477
    },
    {
     "parametre_geometrique": 2.88897320457,
     "q_reduit": 7.83586393089,
     "valeur_reduite": 14.1776243811
    },
    {
     "parametre_geometrique": 2.91481981002,
     "q_reduit": 8.27334320033,
     "valeur_reduite": 15.9441622359
    },
    {
     "parametre_geometrique": 2.94066641546,
     "q_reduit": 8.79106020409,
     "valeur_reduite": 18.1701251882
    },
    {
     "parametre_geometrique": 2.96651302091,
     "q_reduit": 9.41813090365,
     "valeur_reduite": 21.0589983381
    },
    {
     "parametre_geometrique": 2.99235962636,
     "q_reduit": 10.2006153904,
     "valeur_reduite": 24.9552358045
    },
    {
     "parametre_geometrique": 3.0182062318,
     "q_reduit": 11.216786353,
     "valeur_reduite": 30.4919093698
    },
    {
     "parametre_geometrique": 3.04405283725,
     "q_reduit": 12.6134886992,
     "valeur_reduite": 38.9731054007
    },
    {
     "parametre_geometrique": 3.0698994427,
     "q_reduit": 14.7097725131,
     "valeur_reduite": 53.5834849007
    },
    {
     "parametre_geometrique": 3.09574604814,
     "q_reduit": 18.3915773679,
     "valeur_reduite": 84.689272677
    },
    {
     "parametre_geometrique": 3.12159265359,
     "q_reduit": 27.8424971719,
     "valeur_reduite": 196.243019582
    }
   ]
  },
  {
   "figure": 82,
   "page_imprimee": 258,
   "forme": "dalot_rectangulaire",
   "parametre": "y_sur_B",
   "grandeur_reduite": "I_critique_reduit",
   "qualite": "reconstruction_analytique_validee",
   "points": [
    {
     "parametre_geometrique": 0.01,
     "q_reduit": 0.001,
     "valeur_reduite": 4.76577530292
    },
    {
     "parametre_geometrique": 0.0105925372518,
     "q_reduit": 0.00109018449239,
     "valeur_reduite": 4.68244420864
    },
    {
     "parametre_geometrique": 0.011220184543,
     "q_reduit": 0.00118850222744,
     "valeur_reduite": 4.60098323979
    },
    {
     "parametre_geometrique": 0.0118850222744,
     "q_reduit": 0.00129568669752,
     "valeur_reduite": 4.52136835774
    },
    {
     "parametre_geometrique": 0.0125892541179,
     "q_reduit": 0.00141253754462,
     "valeur_reduite": 4.44357646043
    },
    {
     "parametre_geometrique": 0.0133352143216,
     "q_reduit": 0.00153992652606,
     "valeur_reduite": 4.3675853863
    },
    {
     "parametre_geometrique": 0.0141253754462,
     "q_reduit": 0.00167880401812,
     "valeur_reduite": 4.29337391923
    },
    {
     "parametre_geometrique": 0.0149623565609,
     "q_reduit": 0.00183020610631,
     "valeur_reduite": 4.22092179455
    },
    {
     "parametre_geometrique": 0.0158489319246,
     "q_reduit": 0.00199526231497,
     "valeur_reduite": 4.1502097063
    },
    {
     "parametre_geometrique": 0.0167880401812,
     "q_reduit": 0.00217520403402,
     "valeur_reduite": 4.08121931564
    },
    {
     "parametre_geometrique": 0.0177827941004,
     "q_reduit": 0.00237137370566,
     "valeur_reduite": 4.01393326055
    },
    {
     "parametre_geometrique": 0.0188364908949,
     "q_reduit": 0.00258523483956,
     "valeur_reduite": 3.94833516698
    },
    {
     "parametre_geometrique": 0.0199526231497,
     "q_reduit": 0.00281838293126,
     "valeur_reduite": 3.88440966126
    },
    {
     "parametre_geometrique": 0.0211348903984,
     "q_reduit": 0.00307255736527,
     "valeur_reduite": 3.82214238419
    },
    {
     "parametre_geometrique": 0.0223872113857,
     "q_reduit": 0.00334965439158,
     "valeur_reduite": 3.76152000664
    },
    {
     "parametre_geometrique": 0.0237137370566,
     "q_reduit": 0.00365174127255,
     "valeur_reduite": 3.70253024685
    },
    {
     "parametre_geometrique": 0.0251188643151,
     "q_reduit": 0.00398107170553,
     "valeur_reduite": 3.64516188954
    },
    {
     "parametre_geometrique": 0.026607250598,
     "q_reduit": 0.00434010263645,
     "valeur_reduite": 3.58940480694
    },
    {
     "parametre_geometrique": 0.0281838293126,
     "q_reduit": 0.00473151258961,
     "valeur_reduite": 3.53524998184
    },
    {
     "parametre_geometrique": 0.0298538261892,
     "q_reduit": 0.00515822165072,
     "valeur_reduite": 3.48268953275
    },
    {
     "parametre_geometrique": 0.0316227766017,
     "q_reduit": 0.0056234132519,
     "valeur_reduite": 3.4317167414
    },
    {
     "parametre_geometrique": 0.0334965439158,
     "q_reduit": 0.0061305579215,
     "valeur_reduite": 3.38232608268
    },
    {
     "parametre_geometrique": 0.0354813389234,
     "q_reduit": 0.00668343917569,
     "valeur_reduite": 3.33451325712
    },
    {
     "parametre_geometrique": 0.0375837404288,
     "q_reduit": 0.00728618174513,
     "valeur_reduite": 3.28827522622
    },
    {
     "parametre_geometrique": 0.0398107170553,
     "q_reduit": 0.00794328234724,
     "valeur_reduite": 3.24361025065
    },
    {
     "parametre_geometrique": 0.0421696503429,
     "q_reduit": 0.0086596432336,
     "valeur_reduite": 3.20051793168
    },
    {
     "parametre_geometrique": 0.0446683592151,
     "q_reduit": 0.00944060876286,
     "valeur_reduite": 3.15899925591
    },
    {
     "parametre_geometrique": 0.0473151258961,
     "q_reduit": 0.0102920052719,
     "valeur_reduite": 3.11905664357
    },
    {
     "parametre_geometrique": 0.0501187233627,
     "q_reduit": 0.011220184543,
     "valeur_reduite": 3.08069400075
    },
    {
     "parametre_geometrique": 0.0530884444231,
     "q_reduit": 0.0122320711905,
     "valeur_reduite": 3.04391677562
    },
    {
     "parametre_geometrique": 0.056234132519,
     "q_reduit": 0.0133352143216,
     "valeur_reduite": 3.00873201903
    },
    {
     "parametre_geometrique": 0.0595662143529,
     "q_reduit": 0.0145378438561,
     "valeur_reduite": 2.97514844982
    },
    {
     "parametre_geometrique": 0.063095734448,
     "q_reduit": 0.0158489319246,
     "valeur_reduite": 2.94317652504
    },
    {
     "parametre_geometrique": 0.0668343917569,
     "q_reduit": 0.0172782598051,
     "valeur_reduite": 2.91282851556
    },
    {
     "parametre_geometrique": 0.0707945784384,
     "q_reduit": 0.0188364908949,
     "valeur_reduite": 2.88411858722
    },
    {
     "parametre_geometrique": 0.0749894209332,
     "q_reduit": 0.0205352502646,
     "valeur_reduite": 2.8570628882
    },
    {
     "parametre_geometrique": 0.0794328234724,
     "q_reduit": 0.0223872113857,
     "valeur_reduite": 2.83167964267
    },
    {
     "parametre_geometrique": 0.0841395141645,
     "q_reduit": 0.0244061906804,
     "valeur_reduite": 2.80798925142
    },
    {
     "parametre_geometrique": 0.0891250938134,
     "q_reduit": 0.026607250598,
     "valeur_reduite": 2.78601439978
    },
    {
     "parametre_geometrique": 0.0944060876286,
     "q_reduit": 0.0290068119869,
     "valeur_reduite": 2.76578017337
    },
    {
     "parametre_geometrique": 0.1,
     "q_reduit": 0.0316227766017,
     "valeur_reduite": 2.74731418213
    },
    {
     "parametre_geometrique": 0.105925372518,
     "q_reduit": 0.0344746606573,
     "valeur_reduite": 2.73064669318
    },
    {
     "parametre_geometrique": 0.11220184543,
     "q_reduit": 0.0375837404288,
     "valeur_reduite": 2.71581077317
    },
    {
     "parametre_geometrique": 0.118850222744,
     "q_reduit": 0.0409732109814,
     "valeur_reduite": 2.70284244052
    },
    {
     "parametre_geometrique": 0.125892541179,
     "q_reduit": 0.0446683592151,
     "valeur_reduite": 2.69178082833
    },
    {
     "parametre_geometrique": 0.133352143216,
     "q_reduit": 0.0486967525166,
     "valeur_reduite": 2.68266835859
    },
    {
     "parametre_geometrique": 0.141253754462,
     "q_reduit": 0.0530884444231,
     "valeur_reduite": 2.67555092824
    },
    {
     "parametre_geometrique": 0.149623565609,
     "q_reduit": 0.0578761988349,
     "valeur_reduite": 2.67047810807
    },
    {
     "parametre_geometrique": 0.158489319246,
     "q_reduit": 0.063095734448,
     "valeur_reduite": 2.66750335486
    },
    {
     "parametre_geometrique": 0.167880401812,
     "q_reduit": 0.0687859912309,
     "valeur_reduite": 2.66668423789
    },
    {
     "parametre_geometrique": 0.177827941004,
     "q_reduit": 0.0749894209332,
     "valeur_reduite": 2.66808268039
    },
    {
     "parametre_geometrique": 0.188364908949,
     "q_reduit": 0.0817523037944,
     "valeur_reduite": 2.67176521693
    },
    {
     "parametre_geometrique": 0.199526231497,
     "q_reduit": 0.0891250938134,
     "valeur_reduite": 2.67780326762
    },
    {
     "parametre_geometrique": 0.211348903984,
     "q_reduit": 0.0971627951577,
     "valeur_reduite": 2.68627343004
    },
    {
     "parametre_geometrique": 0.223872113857,
     "q_reduit": 0.105925372518,
     "valeur_reduite": 2.69725778991
    },
    {
     "parametre_geometrique": 0.237137370566,
     "q_reduit": 0.115478198469,
     "valeur_reduite": 2.7108442515
    },
    {
     "parametre_geometrique": 0.251188643151,
     "q_reduit": 0.125892541179,
     "valeur_reduite": 2.72712688893
    },
    {
     "parametre_geometrique": 0.26607250598,
     "q_reduit": 0.137246096101,
     "valeur_reduite": 2.74620631939
    },
    {
     "parametre_geometrique": 0.281838293126,
     "q_reduit": 0.149623565609,
     "valeur_reduite": 2.76819009958
    },
    {
     "parametre_geometrique": 0.298538261892,
     "q_reduit": 0.163117290923,
     "valeur_reduite": 2.79319314645
    },
    {
     "parametre_geometrique": 0.316227766017,
     "q_reduit": 0.177827941004,
     "valeur_reduite": 2.82133818378
    },
    {
     "parametre_geometrique": 0.334965439158,
     "q_reduit": 0.193865263595,
     "valeur_reduite": 2.85275621571
    },
    {
     "parametre_geometrique": 0.354813389234,
     "q_reduit": 0.211348903984,
     "valeur_reduite": 2.88758702888
    },
    {
     "parametre_geometrique": 0.375837404288,
     "q_reduit": 0.230409297606,
     "valeur_reduite": 2.92597972455
    },
    {
     "parametre_geometrique": 0.398107170553,
     "q_reduit": 0.251188643151,
     "valeur_reduite": 2.96809328246
    },
    {
     "parametre_geometrique": 0.421696503429,
     "q_reduit": 0.273841963426,
     "valeur_reduite": 3.01409715795
    },
    {
     "parametre_geometrique": 0.446683592151,
     "q_reduit": 0.298538261892,
     "valeur_reduite": 3.06417191429
    },
    {
     "parametre_geometrique": 0.473151258961,
     "q_reduit": 0.325461783498,
     "valeur_reduite": 3.11850989202
    },
    {
     "parametre_geometrique": 0.501187233627,
     "q_reduit": 0.354813389234,
     "valeur_reduite": 3.17731591749
    },
    {
     "parametre_geometrique": 0.530884444231,
     "q_reduit": 0.386812054633,
     "valeur_reduite": 3.24080805243
    },
    {
     "parametre_geometrique": 0.56234132519,
     "q_reduit": 0.421696503429,
     "valeur_reduite": 3.30921838724
    },
    {
     "parametre_geometrique": 0.595662143529,
     "q_reduit": 0.459726988531,
     "valeur_reduite": 3.38279388005
    },
    {
     "parametre_geometrique": 0.63095734448,
     "q_reduit": 0.501187233627,
     "valeur_reduite": 3.46179724442
    },
    {
     "parametre_geometrique": 0.668343917569,
     "q_reduit": 0.546386549882,
     "valeur_reduite": 3.54650788823
    },
    {
     "parametre_geometrique": 0.707945784384,
     "q_reduit": 0.595662143529,
     "valeur_reduite": 3.63722290679
    },
    {
     "parametre_geometrique": 0.749894209332,
     "q_reduit": 0.649381631576,
     "valeur_reduite": 3.73425813325
    },
    {
     "parametre_geometrique": 0.794328234724,
     "q_reduit": 0.707945784384,
     "valeur_reduite": 3.83794924965
    },
    {
     "parametre_geometrique": 0.841395141645,
     "q_reduit": 0.771791515585,
     "valeur_reduite": 3.94865296211
    },
    {
     "parametre_geometrique": 0.891250938134,
     "q_reduit": 0.841395141645,
     "valeur_reduite": 4.06674824393
    },
    {
     "parametre_geometrique": 0.944060876286,
     "q_reduit": 0.91727593539,
     "valeur_reduite": 4.19263765058
    },
    {
     "parametre_geometrique": 1,
     "q_reduit": 1,
     "valeur_reduite": 4.32674871092
    },
    {
     "parametre_geometrique": 1.05925372518,
     "q_reduit": 1.09018449239,
     "valeur_reduite": 4.46953539902
    },
    {
     "parametre_geometrique": 1.1220184543,
     "q_reduit": 1.18850222744,
     "valeur_reduite": 4.62147969152
    },
    {
     "parametre_geometrique": 1.18850222744,
     "q_reduit": 1.29568669752,
     "valeur_reduite": 4.78309321562
    },
    {
     "parametre_geometrique": 1.25892541179,
     "q_reduit": 1.41253754462,
     "valeur_reduite": 4.95491899302
    },
    {
     "parametre_geometrique": 1.33352143216,
     "q_reduit": 1.53992652606,
     "valeur_reduite": 5.13753328567
    },
    {
     "parametre_geometrique": 1.41253754462,
     "q_reduit": 1.67880401812,
     "valeur_reduite": 5.33154754949
    },
    {
     "parametre_geometrique": 1.49623565609,
     "q_reduit": 1.83020610631,
     "valeur_reduite": 5.53761050235
    },
    {
     "parametre_geometrique": 1.58489319246,
     "q_reduit": 1.99526231497,
     "valeur_reduite": 5.75641031338
    },
    {
     "parametre_geometrique": 1.67880401812,
     "q_reduit": 2.17520403402,
     "valeur_reduite": 5.9886769208
    },
    {
     "parametre_geometrique": 1.77827941004,
     "q_reduit": 2.37137370566,
     "valeur_reduite": 6.23518448605
    },
    {
     "parametre_geometrique": 1.88364908949,
     "q_reduit": 2.58523483956,
     "valeur_reduite": 6.49675399234
    },
    {
     "parametre_geometrique": 1.99526231497,
     "q_reduit": 2.81838293126,
     "valeur_reduite": 6.77425599634
    },
    {
     "parametre_geometrique": 2.11348903984,
     "q_reduit": 3.07255736527,
     "valeur_reduite": 7.06861354223
    },
    {
     "parametre_geometrique": 2.23872113857,
     "q_reduit": 3.34965439158,
     "valeur_reduite": 7.38080524777
    },
    {
     "parametre_geometrique": 2.37137370566,
     "q_reduit": 3.65174127255,
     "valeur_reduite": 7.71186857277
    },
    {
     "parametre_geometrique": 2.51188643151,
     "q_reduit": 3.98107170553,
     "valeur_reduite": 8.06290328079
    },
    {
     "parametre_geometrique": 2.6607250598,
     "q_reduit": 4.34010263645,
     "valeur_reduite": 8.43507510573
    },
    {
     "parametre_geometrique": 2.81838293126,
     "q_reduit": 4.73151258961,
     "valeur_reduite": 8.82961963548
    },
    {
     "parametre_geometrique": 2.98538261892,
     "q_reduit": 5.15822165072,
     "valeur_reduite": 9.24784642561
    },
    {
     "parametre_geometrique": 3.16227766017,
     "q_reduit": 5.6234132519,
     "valeur_reduite": 9.6911433568
    },
    {
     "parametre_geometrique": 3.34965439158,
     "q_reduit": 6.1305579215,
     "valeur_reduite": 10.1609812506
    },
    {
     "parametre_geometrique": 3.54813389234,
     "q_reduit": 6.68343917569,
     "valeur_reduite": 10.6589187588
    },
    {
     "parametre_geometrique": 3.75837404288,
     "q_reduit": 7.28618174513,
     "valeur_reduite": 11.1866075429
    },
    {
     "parametre_geometrique": 3.98107170553,
     "q_reduit": 7.94328234724,
     "valeur_reduite": 11.7457977605
    },
    {
     "parametre_geometrique": 4.21696503429,
     "q_reduit": 8.6596432336,
     "valeur_reduite": 12.3383438774
    },
    {
     "parametre_geometrique": 4.46683592151,
     "q_reduit": 9.44060876286,
     "valeur_reduite": 12.9662108244
    },
    {
     "parametre_geometrique": 4.73151258961,
     "q_reduit": 10.2920052719,
     "valeur_reduite": 13.6314805196
    },
    {
     "parametre_geometrique": 5.01187233627,
     "q_reduit": 11.220184543,
     "valeur_reduite": 14.3363587772
    },
    {
     "parametre_geometrique": 5.30884444231,
     "q_reduit": 12.2320711905,
     "valeur_reduite": 15.0831826266
    },
    {
     "parametre_geometrique": 5.6234132519,
     "q_reduit": 13.3352143216,
     "valeur_reduite": 15.8744280657
    },
    {
     "parametre_geometrique": 5.95662143529,
     "q_reduit": 14.5378438561,
     "valeur_reduite": 16.7127182738
    },
    {
     "parametre_geometrique": 6.3095734448,
     "q_reduit": 15.8489319246,
     "valeur_reduite": 17.6008323128
    },
    {
     "parametre_geometrique": 6.68343917569,
     "q_reduit": 17.2782598051,
     "valeur_reduite": 18.5417143429
    },
    {
     "parametre_geometrique": 7.07945784384,
     "q_reduit": 18.8364908949,
     "valeur_reduite": 19.5384833869
    },
    {
     "parametre_geometrique": 7.49894209332,
     "q_reduit": 20.5352502646,
     "valeur_reduite": 20.5944436721
    },
    {
     "parametre_geometrique": 7.94328234724,
     "q_reduit": 22.3872113857,
     "valeur_reduite": 21.7130955869
    },
    {
     "parametre_geometrique": 8.41395141645,
     "q_reduit": 24.4061906804,
     "valeur_reduite": 22.8981472861
    },
    {
     "parametre_geometrique": 8.91250938134,
     "q_reduit": 26.607250598,
     "valeur_reduite": 24.1535269855
    },
    {
     "parametre_geometrique": 9.44060876286,
     "q_reduit": 29.0068119869,
     "valeur_reduite": 25.4833959852
    },
    {
     "parametre_geometrique": 10,
     "q_reduit": 31.6227766017,
     "valeur_reduite": 26.8921624647
    }
   ]
  },
  {
   "figure": 83,
   "page_imprimee": 261,
   "forme": "buse_circulaire",
   "parametre": "theta_rad",
   "grandeur_reduite": "V_reduite",
   "qualite": "reconstruction_analytique_validee",
   "points": [
    {
     "parametre_geometrique": 0.02,
     "q_reduit": 1.39176735738e-8,
     "valeur_reduite": 0.00260977256893
    },
    {
     "parametre_geometrique": 0.0418254462658,
     "q_reduit": 3.40264925025e-7,
     "valeur_reduite": 0.0069781233465
    },
    {
     "parametre_geometrique": 0.0636508925317,
     "q_reduit": 0.00000209762352493,
     "valeur_reduite": 0.0122111684031
    },
    {
     "parametre_geometrique": 0.0854763387975,
     "q_reduit": 0.00000751800258406,
     "valeur_reduite": 0.0180838387259
    },
    {
     "parametre_geometrique": 0.107301785063,
     "q_reduit": 0.0000201121179921,
     "valeur_reduite": 0.0244753181748
    },
    {
     "parametre_geometrique": 0.129127231329,
     "q_reduit": 0.0000447876109762,
     "valeur_reduite": 0.0313071853871
    },
    {
     "parametre_geometrique": 0.150952677595,
     "q_reduit": 0.0000879371508352,
     "valeur_reduite": 0.0385230469071
    },
    {
     "parametre_geometrique": 0.172778123861,
     "q_reduit": 0.000157503544448,
     "valeur_reduite": 0.0460795928216
    },
    {
     "parametre_geometrique": 0.194603570127,
     "q_reduit": 0.000263025634573,
     "valeur_reduite": 0.0539419834181
    },
    {
     "parametre_geometrique": 0.216429016393,
     "q_reduit": 0.000415667272637,
     "valeur_reduite": 0.0620812053132
    },
    {
     "parametre_geometrique": 0.238254462658,
     "q_reduit": 0.000628230883553,
     "valeur_reduite": 0.0704724381375
    },
    {
     "parametre_geometrique": 0.260079908924,
     "q_reduit": 0.000915156713395,
     "valeur_reduite": 0.0790939869595
    },
    {
     "parametre_geometrique": 0.28190535519,
     "q_reduit": 0.00129250860291,
     "valeur_reduite": 0.0879265531099
    },
    {
     "parametre_geometrique": 0.303730801456,
     "q_reduit": 0.00177794698363,
     "valeur_reduite": 0.0969527182744
    },
    {
     "parametre_geometrique": 0.325556247722,
     "q_reduit": 0.00239068970811,
     "valeur_reduite": 0.106156568801
    },
    {
     "parametre_geometrique": 0.347381693988,
     "q_reduit": 0.0031514612789,
     "valeur_reduite": 0.115523415482
    },
    {
     "parametre_geometrique": 0.369207140254,
     "q_reduit": 0.00408243101895,
     "valeur_reduite": 0.125039580283
    },
    {
     "parametre_geometrique": 0.391032586519,
     "q_reduit": 0.00520714072007,
     "valeur_reduite": 0.134692231232
    },
    {
     "parametre_geometrique": 0.412858032785,
     "q_reduit": 0.00655042231162,
     "valeur_reduite": 0.144469252692
    },
    {
     "parametre_geometrique": 0.434683479051,
     "q_reduit": 0.0081383061036,
     "valeur_reduite": 0.154359142152
    },
    {
     "parametre_geometrique": 0.456508925317,
     "q_reduit": 0.00999792017557,
     "valeur_reduite": 0.164350927204
    },
    {
     "parametre_geometrique": 0.478334371583,
     "q_reduit": 0.0121573815021,
     "valeur_reduite": 0.174434098148
    },
    {
     "parametre_geometrique": 0.500159817849,
     "q_reduit": 0.0146456794269,
     "valeur_reduite": 0.184598552814
    },
    {
     "parametre_geometrique": 0.521985264114,
     "q_reduit": 0.0174925521191,
     "valeur_reduite": 0.194834551093
    },
    {
     "parametre_geometrique": 0.54381071038,
     "q_reduit": 0.0207283566663,
     "valeur_reduite": 0.205132677235
    },
    {
     "parametre_geometrique": 0.565636156646,
     "q_reduit": 0.0243839334784,
     "valeur_reduite": 0.215483808433
    },
    {
     "parametre_geometrique": 0.587461602912,
     "q_reduit": 0.0284904656963,
     "valeur_reduite": 0.225879088538
    },
    {
     "parametre_geometrique": 0.609287049178,
     "q_reduit": 0.0330793343136,
     "valeur_reduite": 0.236309906003
    },
    {
     "parametre_geometrique": 0.631112495444,
     "q_reduit": 0.038181969737,
     "valeur_reduite": 0.246767875319
    },
    {
     "parametre_geometrique": 0.65293794171,
     "q_reduit": 0.0438297005202,
     "valeur_reduite": 0.257244821369
    },
    {
     "parametre_geometrique": 0.674763387975,
     "q_reduit": 0.0500536000167,
     "valeur_reduite": 0.267732766244
    },
    {
     "parametre_geometrique": 0.696588834241,
     "q_reduit": 0.0568843317035,
     "valeur_reduite": 0.278223918108
    },
    {
     "parametre_geometrique": 0.718414280507,
     "q_reduit": 0.0643519939309,
     "valeur_reduite": 0.28871066183
    },
    {
     "parametre_geometrique": 0.740239726773,
     "q_reduit": 0.0724859648523,
     "valeur_reduite": 0.299185551105
    },
    {
     "parametre_geometrique": 0.762065173039,
     "q_reduit": 0.0813147482895,
     "valeur_reduite": 0.309641301851
    },
    {
     "parametre_geometrique": 0.783890619305,
     "q_reduit": 0.0908658212778,
     "valeur_reduite": 0.320070786698
    },
    {
     "parametre_geometrique": 0.805716065571,
     "q_reduit": 0.10116548403,
     "valeur_reduite": 0.330467030432
    },
    {
     "parametre_geometrique": 0.827541511836,
     "q_reduit": 0.112238713046,
     "valeur_reduite": 0.340823206242
    },
    {
     "parametre_geometrique": 0.849366958102,
     "q_reduit": 0.124109018073,
     "valeur_reduite": 0.351132632677
    },
    {
     "parametre_geometrique": 0.871192404368,
     "q_reduit": 0.136798303619,
     "valeur_reduite": 0.361388771212
    },
    {
     "parametre_geometrique": 0.893017850634,
     "q_reduit": 0.150326735677,
     "valeur_reduite": 0.371585224345
    },
    {
     "parametre_geometrique": 0.9148432969,
     "q_reduit": 0.164712614316,
     "valeur_reduite": 0.381715734156
    },
    {
     "parametre_geometrique": 0.936668743166,
     "q_reduit": 0.179972252753,
     "valeur_reduite": 0.391774181261
    },
    {
     "parametre_geometrique": 0.958494189431,
     "q_reduit": 0.196119863494,
     "valeur_reduite": 0.401754584119
    },
    {
     "parametre_geometrique": 0.980319635697,
     "q_reduit": 0.213167452108,
     "valeur_reduite": 0.411651098638
    },
    {
     "parametre_geometrique": 1.00214508196,
     "q_reduit": 0.231124719145,
     "valeur_reduite": 0.421458018042
    },
    {
     "parametre_geometrique": 1.02397052823,
     "q_reduit": 0.249998970688,
     "valeur_reduite": 0.431169772966
    },
    {
     "parametre_geometrique": 1.04579597449,
     "q_reduit": 0.269795037989,
     "valeur_reduite": 0.440780931744
    },
    {
     "parametre_geometrique": 1.06762142076,
     "q_reduit": 0.290515206575,
     "valeur_reduite": 0.450286200863
    },
    {
     "parametre_geometrique": 1.08944686703,
     "q_reduit": 0.312159155215,
     "valeur_reduite": 0.459680425564
    },
    {
     "parametre_geometrique": 1.11127231329,
     "q_reduit": 0.334723905027,
     "valeur_reduite": 0.468958590557
    },
    {
     "parametre_geometrique": 1.13309775956,
     "q_reduit": 0.358203779028,
     "valeur_reduite": 0.478115820843
    },
    {
     "parametre_geometrique": 1.15492320582,
     "q_reduit": 0.382590372329,
     "valeur_reduite": 0.487147382613
    },
    {
     "parametre_geometrique": 1.17674865209,
     "q_reduit": 0.407872533163,
     "valeur_reduite": 0.496048684219
    },
    {
     "parametre_geometrique": 1.19857409836,
     "q_reduit": 0.434036354863,
     "valeur_reduite": 0.504815277197
    },
    {
     "parametre_geometrique": 1.22039954462,
     "q_reduit": 0.461065178872,
     "valeur_reduite": 0.513442857328
    },
    {
     "parametre_geometrique": 1.24222499089,
     "q_reduit": 0.488939608814,
     "valeur_reduite": 0.521927265727
    },
    {
     "parametre_geometrique": 1.26405043715,
     "q_reduit": 0.517637535607,
     "valeur_reduite": 0.530264489954
    },
    {
     "parametre_geometrique": 1.28587588342,
     "q_reduit": 0.547134173534,
     "valeur_reduite": 0.538450665128
    },
    {
     "parametre_geometrique": 1.30770132969,
     "q_reduit": 0.577402107175,
     "valeur_reduite": 0.546482075044
    },
    {
     "parametre_geometrique": 1.32952677595,
     "q_reduit": 0.608411349007,
     "valeur_reduite": 0.554355153278
    },
    {
     "parametre_geometrique": 1.35135222222,
     "q_reduit": 0.640129407485,
     "valeur_reduite": 0.562066484276
    },
    {
     "parametre_geometrique": 1.37317766848,
     "q_reduit": 0.67252136532,
     "valeur_reduite": 0.569612804423
    },
    {
     "parametre_geometrique": 1.39500311475,
     "q_reduit": 0.705549967656,
     "valeur_reduite": 0.57699100308
    },
    {
     "parametre_geometrique": 1.41682856101,
     "q_reduit": 0.739175719811,
     "valeur_reduite": 0.584198123585
    },
    {
     "parametre_geometrique": 1.43865400728,
     "q_reduit": 0.773356994166,
     "valeur_reduite": 0.591231364218
    },
    {
     "parametre_geometrique": 1.46047945355,
     "q_reduit": 0.808050145796,
     "valeur_reduite": 0.598088079115
    },
    {
     "parametre_geometrique": 1.48230489981,
     "q_reduit": 0.843209636363,
     "valeur_reduite": 0.604765779139
    },
    {
     "parametre_geometrique": 1.50413034608,
     "q_reduit": 0.87878816577,
     "valeur_reduite": 0.61126213269
    },
    {
     "parametre_geometrique": 1.52595579234,
     "q_reduit": 0.91473681104,
     "valeur_reduite": 0.617574966466
    },
    {
     "parametre_geometrique": 1.54778123861,
     "q_reduit": 0.951005171859,
     "valeur_reduite": 0.623702266155
    },
    {
     "parametre_geometrique": 1.56960668488,
     "q_reduit": 0.987541522183,
     "valeur_reduite": 0.629642177067
    },
    {
     "parametre_geometrique": 1.59143213114,
     "q_reduit": 1.02429296729,
     "valeur_reduite": 0.635393004699
    },
    {
     "parametre_geometrique": 1.61325757741,
     "q_reduit": 1.06120560565,
     "valeur_reduite": 0.640953215225
    },
    {
     "parametre_geometrique": 1.63508302367,
     "q_reduit": 1.0982246949,
     "valeur_reduite": 0.646321435923
    },
    {
     "parametre_geometrique": 1.65690846994,
     "q_reduit": 1.13529482139,
     "valeur_reduite": 0.651496455515
    },
    {
     "parametre_geometrique": 1.6787339162,
     "q_reduit": 1.17236007236,
     "valeur_reduite": 0.656477224438
    },
    {
     "parametre_geometrique": 1.70055936247,
     "q_reduit": 1.20936421034,
     "valeur_reduite": 0.661262855034
    },
    {
     "parametre_geometrique": 1.72238480874,
     "q_reduit": 1.24625084886,
     "valeur_reduite": 0.665852621655
    },
    {
     "parametre_geometrique": 1.744210255,
     "q_reduit": 1.28296362884,
     "valeur_reduite": 0.670245960692
    },
    {
     "parametre_geometrique": 1.76603570127,
     "q_reduit": 1.31944639496,
     "valeur_reduite": 0.674442470509
    },
    {
     "parametre_geometrique": 1.78786114753,
     "q_reduit": 1.35564337123,
     "valeur_reduite": 0.678441911302
    },
    {
     "parametre_geometrique": 1.8096865938,
     "q_reduit": 1.39149933526,
     "valeur_reduite": 0.682244204859
    },
    {
     "parametre_geometrique": 1.83151204007,
     "q_reduit": 1.42695979023,
     "valeur_reduite": 0.685849434242
    },
    {
     "parametre_geometrique": 1.85333748633,
     "q_reduit": 1.46197113415,
     "valeur_reduite": 0.689257843369
    },
    {
     "parametre_geometrique": 1.8751629326,
     "q_reduit": 1.49648082569,
     "valeur_reduite": 0.692469836511
    },
    {
     "parametre_geometrique": 1.89698837886,
     "q_reduit": 1.53043754581,
     "valeur_reduite": 0.69548597769
    },
    {
     "parametre_geometrique": 1.91881382513,
     "q_reduit": 1.56379135477,
     "valeur_reduite": 0.698306989989
    },
    {
     "parametre_geometrique": 1.94063927139,
     "q_reduit": 1.59649384371,
     "valeur_reduite": 0.700933754767
    },
    {
     "parametre_geometrique": 1.96246471766,
     "q_reduit": 1.62849828045,
     "valeur_reduite": 0.70336731077
    },
    {
     "parametre_geometrique": 1.98429016393,
     "q_reduit": 1.6597597488,
     "valeur_reduite": 0.705608853155
    },
    {
     "parametre_geometrique": 2.00611561019,
     "q_reduit": 1.69023528096,
     "valeur_reduite": 0.70765973241
    },
    {
     "parametre_geometrique": 2.02794105646,
     "q_reduit": 1.71988398248,
     "valeur_reduite": 0.709521453179
    },
    {
     "parametre_geometrique": 2.04976650272,
     "q_reduit": 1.74866714943,
     "valeur_reduite": 0.711195672985
    },
    {
     "parametre_geometrique": 2.07159194899,
     "q_reduit": 1.77654837728,
     "valeur_reduite": 0.712684200853
    },
    {
     "parametre_geometrique": 2.09341739526,
     "q_reduit": 1.80349366118,
     "valeur_reduite": 0.713988995829
    },
    {
     "parametre_geometrique": 2.11524284152,
     "q_reduit": 1.82947148732,
     "valeur_reduite": 0.715112165404
    },
    {
     "parametre_geometrique": 2.13706828779,
     "q_reduit": 1.8544529151,
     "valeur_reduite": 0.716055963824
    },
    {
     "parametre_geometrique": 2.15889373405,
     "q_reduit": 1.87841164979,
     "valeur_reduite": 0.716822790305
    },
    {
     "parametre_geometrique": 2.18071918032,
     "q_reduit": 1.90132410563,
     "valeur_reduite": 0.717415187139
    },
    {
     "parametre_geometrique": 2.20254462658,
     "q_reduit": 1.92316945911,
     "valeur_reduite": 0.717835837688
    },
    {
     "parametre_geometrique": 2.22437007285,
     "q_reduit": 1.94392969235,
     "valeur_reduite": 0.71808756428
    },
    {
     "parametre_geometrique": 2.24619551912,
     "q_reduit": 1.96358962655,
     "valeur_reduite": 0.71817332599
    },
    {
     "parametre_geometrique": 2.26802096538,
     "q_reduit": 1.98213694546,
     "valeur_reduite": 0.718096216309
    },
    {
     "parametre_geometrique": 2.28984641165,
     "q_reduit": 1.99956220893,
     "valeur_reduite": 0.71785946071
    },
    {
     "parametre_geometrique": 2.31167185791,
     "q_reduit": 2.01585885656,
     "valeur_reduite": 0.717466414087
    },
    {
     "parametre_geometrique": 2.33349730418,
     "q_reduit": 2.03102320168,
     "valeur_reduite": 0.716920558095
    },
    {
     "parametre_geometrique": 2.35532275045,
     "q_reduit": 2.04505441563,
     "valeur_reduite": 0.716225498359
    },
    {
     "parametre_geometrique": 2.37714819671,
     "q_reduit": 2.05795450277,
     "valeur_reduite": 0.715384961578
    },
    {
     "parametre_geometrique": 2.39897364298,
     "q_reduit": 2.06972826621,
     "valeur_reduite": 0.714402792498
    },
    {
     "parametre_geometrique": 2.42079908924,
     "q_reduit": 2.0803832648,
     "valeur_reduite": 0.713282950769
    },
    {
     "parametre_geometrique": 2.44262453551,
     "q_reduit": 2.08992976145,
     "valeur_reduite": 0.71202950768
    },
    {
     "parametre_geometrique": 2.46444998177,
     "q_reduit": 2.09838066328,
     "valeur_reduite": 0.710646642757
    },
    {
     "parametre_geometrique": 2.48627542804,
     "q_reduit": 2.10575145392,
     "valeur_reduite": 0.709138640248
    },
    {
     "parametre_geometrique": 2.50810087431,
     "q_reduit": 2.11206011842,
     "valeur_reduite": 0.707509885464
    },
    {
     "parametre_geometrique": 2.52992632057,
     "q_reduit": 2.11732706113,
     "valeur_reduite": 0.705764860996
    },
    {
     "parametre_geometrique": 2.55175176684,
     "q_reduit": 2.12157501706,
     "valeur_reduite": 0.703908142785
    },
    {
     "parametre_geometrique": 2.5735772131,
     "q_reduit": 2.12482895725,
     "valeur_reduite": 0.701944396067
    },
    {
     "parametre_geometrique": 2.59540265937,
     "q_reduit": 2.12711598853,
     "valeur_reduite": 0.699878371166
    },
    {
     "parametre_geometrique": 2.61722810564,
     "q_reduit": 2.12846524836,
     "valeur_reduite": 0.697714899149
    },
    {
     "parametre_geometrique": 2.6390535519,
     "q_reduit": 2.12890779514,
     "valeur_reduite": 0.69545888733
    }
   ]
  },
  {
   "figure": 84,
   "page_imprimee": 263,
   "forme": "dalot_rectangulaire",
   "parametre": "y_sur_B",
   "grandeur_reduite": "V_reduite",
   "qualite": "reconstruction_analytique_validee",
   "points": [
    {
     "parametre_geometrique": 0.01,
     "q_reduit": 0.000458071443956,
     "valeur_reduite": 0.0458071443956
    },
    {
     "parametre_geometrique": 0.0105925372518,
     "q_reduit": 0.000503806416363,
     "valeur_reduite": 0.047562392691
    },
    {
     "parametre_geometrique": 0.011220184543,
     "q_reduit": 0.000554082807023,
     "valeur_reduite": 0.0493826821563
    },
    {
     "parametre_geometrique": 0.0118850222744,
     "q_reduit": 0.000609347529489,
     "valeur_reduite": 0.0512702050885
    },
    {
     "parametre_geometrique": 0.0125892541179,
     "q_reduit": 0.000670090824586,
     "valeur_reduite": 0.0532272061798
    },
    {
     "parametre_geometrique": 0.0133352143216,
     "q_reduit": 0.000736850356377,
     "valeur_reduite": 0.0552559815392
    },
    {
     "parametre_geometrique": 0.0141253754462,
     "q_reduit": 0.000810215678767,
     "valeur_reduite": 0.0573588774225
    },
    {
     "parametre_geometrique": 0.0149623565609,
     "q_reduit": 0.000890833103677,
     "valeur_reduite": 0.0595382886411
    },
    {
     "parametre_geometrique": 0.0158489319246,
     "q_reduit": 0.000979411003924,
     "valeur_reduite": 0.0617966566191
    },
    {
     "parametre_geometrique": 0.0167880401812,
     "q_reduit": 0.00107672558617,
     "valeur_reduite": 0.064136467065
    },
    {
     "parametre_geometrique": 0.0177827941004,
     "q_reduit": 0.00118362717168,
     "valeur_reduite": 0.0665602472253
    },
    {
     "parametre_geometrique": 0.0188364908949,
     "q_reduit": 0.00130104702504,
     "valeur_reduite": 0.0690705626809
    },
    {
     "parametre_geometrique": 0.0199526231497,
     "q_reduit": 0.00143000477351,
     "valeur_reduite": 0.0716700136507
    },
    {
     "parametre_geometrique": 0.0211348903984,
     "q_reduit": 0.00157161646204,
     "valeur_reduite": 0.074361230762
    },
    {
     "parametre_geometrique": 0.0223872113857,
     "q_reduit": 0.00172710329195,
     "valeur_reduite": 0.0771468702465
    },
    {
     "parametre_geometrique": 0.0237137370566,
     "q_reduit": 0.0018978010932,
     "valeur_reduite": 0.0800296085206
    },
    {
     "parametre_geometrique": 0.0251188643151,
     "q_reduit": 0.00208517058341,
     "valeur_reduite": 0.0830121361083
    },
    {
     "parametre_geometrique": 0.026607250598,
     "q_reduit": 0.00229080846873,
     "valeur_reduite": 0.086097150861
    },
    {
     "parametre_geometrique": 0.0281838293126,
     "q_reduit": 0.00251645944442,
     "valeur_reduite": 0.0892873504343
    },
    {
     "parametre_geometrique": 0.0298538261892,
     "q_reduit": 0.00276402915507,
     "valeur_reduite": 0.0925854239774
    },
    {
     "parametre_geometrique": 0.0316227766017,
     "q_reduit": 0.00303559817672,
     "valeur_reduite": 0.0959940429948
    },
    {
     "parametre_geometrique": 0.0334965439158,
     "q_reduit": 0.00333343708473,
     "valeur_reduite": 0.0995158513402
    },
    {
     "parametre_geometrique": 0.0354813389234,
     "q_reduit": 0.00366002267338,
     "valeur_reduite": 0.103153454307
    },
    {
     "parametre_geometrique": 0.0375837404288,
     "q_reduit": 0.00401805539387,
     "valeur_reduite": 0.106909406781
    },
    {
     "parametre_geometrique": 0.0398107170553,
     "q_reduit": 0.00441047807899,
     "valeur_reduite": 0.110786200431
    },
    {
     "parametre_geometrique": 0.0421696503429,
     "q_reduit": 0.00484049602268,
     "valeur_reduite": 0.114786249905
    },
    {
     "parametre_geometrique": 0.0446683592151,
     "q_reduit": 0.005311598483,
     "valeur_reduite": 0.118911878035
    },
    {
     "parametre_geometrique": 0.0473151258961,
     "q_reduit": 0.00582758167644,
     "valeur_reduite": 0.123165300019
    },
    {
     "parametre_geometrique": 0.0501187233627,
     "q_reduit": 0.00639257333006,
     "valeur_reduite": 0.127548606611
    },
    {
     "parametre_geometrique": 0.0530884444231,
     "q_reduit": 0.00701105885638,
     "valeur_reduite": 0.132063746312
    },
    {
     "parametre_geometrique": 0.056234132519,
     "q_reduit": 0.00768790921306,
     "valeur_reduite": 0.136712506598
    },
    {
     "parametre_geometrique": 0.0595662143529,
     "q_reduit": 0.00842841050617,
     "valeur_reduite": 0.141496494241
    },
    {
     "parametre_geometrique": 0.063095734448,
     "q_reduit": 0.00923829539157,
     "valeur_reduite": 0.14641711476
    },
    {
     "parametre_geometrique": 0.0668343917569,
     "q_reduit": 0.0101237763239,
     "valeur_reduite": 0.151475551102
    },
    {
     "parametre_geometrique": 0.0707945784384,
     "q_reduit": 0.0110915806973,
     "valeur_reduite": 0.156672741641
    },
    {
     "parametre_geometrique": 0.0749894209332,
     "q_reduit": 0.0121489879141,
     "valeur_reduite": 0.162009357625
    },
    {
     "parametre_geometrique": 0.0794328234724,
     "q_reduit": 0.0133038684134,
     "valeur_reduite": 0.167485780208
    },
    {
     "parametre_geometrique": 0.0841395141645,
     "q_reduit": 0.0145647246798,
     "valeur_reduite": 0.17310207724
    },
    {
     "parametre_geometrique": 0.0891250938134,
     "q_reduit": 0.0159407342479,
     "valeur_reduite": 0.178857980013
    },
    {
     "parametre_geometrique": 0.0944060876286,
     "q_reduit": 0.0174417947077,
     "valeur_reduite": 0.18475286018
    },
    {
     "parametre_geometrique": 0.1,
     "q_reduit": 0.0190785707092,
     "valeur_reduite": 0.190785707092
    },
    {
     "parametre_geometrique": 0.105925372518,
     "q_reduit": 0.0208625429547,
     "valeur_reduite": 0.196955105834
    },
    {
     "parametre_geometrique": 0.11220184543,
     "q_reduit": 0.0228060591627,
     "valeur_reduite": 0.203259216239
    },
    {
     "parametre_geometrique": 0.118850222744,
     "q_reduit": 0.0249223869777,
     "valeur_reduite": 0.209695753212
    },
    {
     "parametre_geometrique": 0.125892541179,
     "q_reduit": 0.0272257687999,
     "valeur_reduite": 0.216261968698
    },
    {
     "parametre_geometrique": 0.133352143216,
     "q_reduit": 0.0297314785016,
     "valeur_reduite": 0.222954635633
    },
    {
     "parametre_geometrique": 0.141253754462,
     "q_reduit": 0.0324558800006,
     "valeur_reduite": 0.229770034249
    },
    {
     "parametre_geometrique": 0.149623565609,
     "q_reduit": 0.0354164876617,
     "valeur_reduite": 0.236703941103
    },
    {
     "parametre_geometrique": 0.158489319246,
     "q_reduit": 0.0386320285059,
     "valeur_reduite": 0.243751621179
    },
    {
     "parametre_geometrique": 0.167880401812,
     "q_reduit": 0.042122506215,
     "valeur_reduite": 0.250907823429
    },
    {
     "parametre_geometrique": 0.177827941004,
     "q_reduit": 0.0459092669375,
     "valeur_reduite": 0.258166780082
    },
    {
     "parametre_geometrique": 0.188364908949,
     "q_reduit": 0.0500150669184,
     "valeur_reduite": 0.265522210041
    },
    {
     "parametre_geometrique": 0.199526231497,
     "q_reduit": 0.054464142005,
     "valeur_reduite": 0.272967326634
    },
    {
     "parametre_geometrique": 0.211348903984,
     "q_reduit": 0.0592822791087,
     "valeur_reduite": 0.280494849944
    },
    {
     "parametre_geometrique": 0.223872113857,
     "q_reduit": 0.0644968897394,
     "valeur_reduite": 0.288097023913
    },
    {
     "parametre_geometrique": 0.237137370566,
     "q_reduit": 0.0701370857745,
     "valeur_reduite": 0.295765638318
    },
    {
     "parametre_geometrique": 0.251188643151,
     "q_reduit": 0.0762337576675,
     "valeur_reduite": 0.303492055657
    },
    {
     "parametre_geometrique": 0.26607250598,
     "q_reduit": 0.0828196553565,
     "valeur_reduite": 0.311267242932
    },
    {
     "parametre_geometrique": 0.281838293126,
     "q_reduit": 0.089929472188,
     "valeur_reduite": 0.31908180819
    },
    {
     "parametre_geometrique": 0.298538261892,
     "q_reduit": 0.0975999322328,
     "valeur_reduite": 0.326926041621
    },
    {
     "parametre_geometrique": 0.316227766017,
     "q_reduit": 0.105869881432,
     "valeur_reduite": 0.334789960936
    },
    {
     "parametre_geometrique": 0.334965439158,
     "q_reduit": 0.114780383074,
     "valeur_reduite": 0.342663360621
    },
    {
     "parametre_geometrique": 0.354813389234,
     "q_reduit": 0.124374818176,
     "valeur_reduite": 0.350535864627
    },
    {
     "parametre_geometrique": 0.375837404288,
     "q_reduit": 0.134698991397,
     "valeur_reduite": 0.35839698194
    },
    {
     "parametre_geometrique": 0.398107170553,
     "q_reduit": 0.14580124317,
     "valeur_reduite": 0.366236164415
    },
    {
     "parametre_geometrique": 0.421696503429,
     "q_reduit": 0.15773256882,
     "valeur_reduite": 0.374042866227
    },
    {
     "parametre_geometrique": 0.446683592151,
     "q_reduit": 0.170546745467,
     "valeur_reduite": 0.381806604192
    },
    {
     "parametre_geometrique": 0.473151258961,
     "q_reduit": 0.184300467562,
     "valeur_reduite": 0.389517018229
    },
    {
     "parametre_geometrique": 0.501187233627,
     "q_reduit": 0.199053491975,
     "valeur_reduite": 0.3971639312
    },
    {
     "parametre_geometrique": 0.530884444231,
     "q_reduit": 0.214868793557,
     "valeur_reduite": 0.404737407344
    },
    {
     "parametre_geometrique": 0.56234132519,
     "q_reduit": 0.23181273216,
     "valeur_reduite": 0.412227808586
    },
    {
     "parametre_geometrique": 0.595662143529,
     "q_reduit": 0.249955232094,
     "valeur_reduite": 0.41962584799
    },
    {
     "parametre_geometrique": 0.63095734448,
     "q_reduit": 0.26936997505,
     "valeur_reduite": 0.42692263971
    },
    {
     "parametre_geometrique": 0.668343917569,
     "q_reduit": 0.290134607513,
     "valeur_reduite": 0.434109744828
    },
    {
     "parametre_geometrique": 0.707945784384,
     "q_reduit": 0.312330963702,
     "valeur_reduite": 0.441179212577
    },
    {
     "parametre_geometrique": 0.749894209332,
     "q_reduit": 0.336045305085,
     "valeur_reduite": 0.448123616509
    },
    {
     "parametre_geometrique": 0.794328234724,
     "q_reduit": 0.361368577523,
     "valeur_reduite": 0.454936085268
    },
    {
     "parametre_geometrique": 0.841395141645,
     "q_reduit": 0.388396687099,
     "valeur_reduite": 0.461610327746
    },
    {
     "parametre_geometrique": 0.891250938134,
     "q_reduit": 0.417230795693,
     "valeur_reduite": 0.46814065247
    },
    {
     "parametre_geometrique": 0.944060876286,
     "q_reduit": 0.447977637385,
     "valeur_reduite": 0.474521981196
    },
    {
     "parametre_geometrique": 1,
     "q_reduit": 0.480749856769,
     "valeur_reduite": 0.480749856769
    },
    {
     "parametre_geometrique": 1.05925372518,
     "q_reduit": 0.515666370284,
     "valeur_reduite": 0.486820445401
    },
    {
     "parametre_geometrique": 1.1220184543,
     "q_reduit": 0.552852751699,
     "valeur_reduite": 0.492730533602
    },
    {
     "parametre_geometrique": 1.18850222744,
     "q_reduit": 0.592441642932,
     "valeur_reduite": 0.498477520072
    },
    {
     "parametre_geometrique": 1.25892541179,
     "q_reduit": 0.634573191397,
     "valeur_reduite": 0.504059402926
    },
    {
     "parametre_geometrique": 1.33352143216,
     "q_reduit": 0.679395515166,
     "valeur_reduite": 0.50947476267
    },
    {
     "parametre_geometrique": 1.41253754462,
     "q_reduit": 0.727065197271,
     "valeur_reduite": 0.51472274138
    },
    {
     "parametre_geometrique": 1.49623565609,
     "q_reduit": 0.777747810552,
     "valeur_reduite": 0.519803018585
    },
    {
     "parametre_geometrique": 1.58489319246,
     "q_reduit": 0.83161847455,
     "valeur_reduite": 0.524715784323
    },
    {
     "parametre_geometrique": 1.67880401812,
     "q_reduit": 0.888862446033,
     "valeur_reduite": 0.529461709907
    },
    {
     "parametre_geometrique": 1.77827941004,
     "q_reduit": 0.949675744847,
     "valeur_reduite": 0.534041916858
    },
    {
     "parametre_geometrique": 1.88364908949,
     "q_reduit": 1.01426581692,
     "valeur_reduite": 0.538457944515
    },
    {
     "parametre_geometrique": 1.99526231497,
     "q_reduit": 1.08285223633,
     "valeur_reduite": 0.542711716755
    },
    {
     "parametre_geometrique": 2.11348903984,
     "q_reduit": 1.15566744863,
     "valeur_reduite": 0.546805508262
    },
    {
     "parametre_geometrique": 2.23872113857,
     "q_reduit": 1.23295755745,
     "valeur_reduite": 0.550741910732
    },
    {
     "parametre_geometrique": 2.37137370566,
     "q_reduit": 1.314983157,
     "valeur_reduite": 0.554523799375
    },
    {
     "parametre_geometrique": 2.51188643151,
     "q_reduit": 1.4020202129,
     "valeur_reduite": 0.558154300017
    },
    {
     "parametre_geometrique": 2.6607250598,
     "q_reduit": 1.4943609941,
     "valeur_reduite": 0.561636757094
    },
    {
     "parametre_geometrique": 2.81838293126,
     "q_reduit": 1.59231505884,
     "valeur_reduite": 0.564974702754
    },
    {
     "parametre_geometrique": 2.98538261892,
     "q_reduit": 1.69621029771,
     "valeur_reduite": 0.568171827278
    },
    {
     "parametre_geometrique": 3.16227766017,
     "q_reduit": 1.8063940373,
     "valeur_reduite": 0.571231950963
    },
    {
     "parametre_geometrique": 3.34965439158,
     "q_reduit": 1.92323420776,
     "valeur_reduite": 0.574158997595
    },
    {
     "parametre_geometrique": 3.54813389234,
     "q_reduit": 2.04712057824,
     "valeur_reduite": 0.576956969595
    },
    {
     "parametre_geometrique": 3.75837404288,
     "q_reduit": 2.17846606418,
     "valeur_reduite": 0.579629924889
    },
    {
     "parametre_geometrique": 3.98107170553,
     "q_reduit": 2.31770811071,
     "valeur_reduite": 0.582181955549
    },
    {
     "parametre_geometrique": 4.21696503429,
     "q_reduit": 2.46531015665,
     "valeur_reduite": 0.584617168179
    },
    {
     "parametre_geometrique": 4.46683592151,
     "q_reduit": 2.62176318411,
     "valeur_reduite": 0.586939666059
    },
    {
     "parametre_geometrique": 4.73151258961,
     "q_reduit": 2.78758735855,
     "valeur_reduite": 0.589153532989
    },
    {
     "parametre_geometrique": 5.01187233627,
     "q_reduit": 2.963333765,
     "valeur_reduite": 0.591262818798
    },
    {
     "parametre_geometrique": 5.30884444231,
     "q_reduit": 3.14958624595,
     "valeur_reduite": 0.593271526446
    },
    {
     "parametre_geometrique": 5.6234132519,
     "q_reduit": 3.34696334722,
     "valeur_reduite": 0.595183600651
    },
    {
     "parametre_geometrique": 5.95662143529,
     "q_reduit": 3.55612037806,
     "valeur_reduite": 0.597002917962
    },
    {
     "parametre_geometrique": 6.3095734448,
     "q_reduit": 3.77775159258,
     "valeur_reduite": 0.598733278189
    },
    {
     "parametre_geometrique": 6.68343917569,
     "q_reduit": 4.01259249949,
     "valeur_reduite": 0.600378397111
    },
    {
     "parametre_geometrique": 7.07945784384,
     "q_reduit": 4.26142230801,
     "valeur_reduite": 0.601941900356
    },
    {
     "parametre_geometrique": 7.49894209332,
     "q_reduit": 4.5250665181,
     "valeur_reduite": 0.603427318385
    },
    {
     "parametre_geometrique": 7.94328234724,
     "q_reduit": 4.80439966345,
     "valeur_reduite": 0.604838082473
    },
    {
     "parametre_geometrique": 8.41395141645,
     "q_reduit": 5.10034821655,
     "valeur_reduite": 0.606177521607
    },
    {
     "parametre_geometrique": 8.91250938134,
     "q_reduit": 5.41389366538,
     "valeur_reduite": 0.607448860219
    },
    {
     "parametre_geometrique": 9.44060876286,
     "q_reduit": 5.74607577199,
     "valeur_reduite": 0.608655216663
    },
    {
     "parametre_geometrique": 10,
     "q_reduit": 6.09799602375,
     "valeur_reduite": 0.609799602375
    }
   ]
  }
 ],
 "exemples_validation": [
  {
   "figure": 73,
   "courbe": "A",
   "Q*": 0.171,
   "resultat": "H1*=0.795"
  },
  {
   "figure": 73,
   "courbe": "A",
   "Q*": 0.134,
   "resultat": "H1*=0.690"
  },
  {
   "figure": 75,
   "courbe": "2",
   "Q*": 0.28,
   "resultat": "H1*=0.810"
  },
  {
   "figure": 75,
   "courbe": "2",
   "Q*": 0.169,
   "resultat": "H1*=0.600"
  },
  {
   "figure": 77,
   "courbe": "A",
   "Q*": 0.28,
   "resultat": "H1*=0.830"
  },
  {
   "figure": 77,
   "courbe": "A",
   "Q*": 0.287,
   "resultat": "H1*=0.840"
  },
  {
   "figure": 79,
   "Q*": 1.37,
   "resultat": "Ic*=1.98"
  },
  {
   "figure": 79,
   "Q*": 1.08,
   "resultat": "Ic*=1.90"
  },
  {
   "figure": 82,
   "Q*": 0.395,
   "resultat": "Ic*=3.26"
  },
  {
   "figure": 82,
   "Q*": 0.406,
   "resultat": "Ic*=3.30"
  },
  {
   "figure": 83,
   "Q*": 0.974,
   "resultat": "V*=0.63"
  },
  {
   "figure": 83,
   "Q*": 0.78,
   "resultat": "V*=0.57"
  },
  {
   "figure": 84,
   "Q*": 0.219,
   "resultat": "V*=0.407"
  },
  {
   "figure": 84,
   "Q*": 0.224,
   "resultat": "V*=0.410"
  }
 ]
};

export default BCEOM_ABAQUES;
