// Table 18 DRE Tunisie : stations IDF Montana I = a_T / (t_h + c)^b (BVTrace.App/Assets/Maps/montana_table18.json)
// Copie conforme générée depuis le dépôt BVTrace : ne pas modifier à la main, régénérer depuis la source.
// Module ES plutôt que fetch : chargement identique dans le navigateur et sous Node 22.
export default {
    "schema_version":  "1.6",
    "coord_system":  {
                         "primary":  "gon (grades) as written in station sheets",
                         "secondary":  "decimal degrees only when explicitly provided as X/Y in the station sheet"
                     },
    "idf_model":  {
                      "table_retained":  18,
                      "fields":  [
                                     "aT_by_T_years",
                                     "b",
                                     "c"
                                 ],
                      "optional_fields":  [
                                              "b_by_T_years",
                                              "c_by_T_years",
                                              "b_raw",
                                              "c_raw",
                                              "notes"
                                          ]
                  },
    "stations":  [
                     {
                         "name":  "Sidi Ali Jbali",
                         "code":  "1484943000",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 8880",
                                             "lon_gon_raw":  "9Gr 4231",
                                             "lat_gon":  40.888,
                                             "lon_gon":  9.4231,
                                             "lat_deg":  null,
                                             "lon_deg":  null
                                         },
                         "table18":  {
                                         "b":  0.651,
                                         "c":  0.208,
                                         "aT_by_T_years":  {
                                                               "2":  233,
                                                               "5":  244,
                                                               "10":  247,
                                                               "20":  246,
                                                               "50":  241,
                                                               "100":  235
                                                           }
                                     }
                     },
                     {
                         "name":  "Ghardimaou",
                         "code":  "1485920600",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 5000",
                                             "lon_gon_raw":  "6Gr 7731",
                                             "lat_gon":  40.5,
                                             "lon_gon":  6.7731,
                                             "lat_deg":  36.451555,
                                             "lon_deg":  8.434965
                                         },
                         "table18":  {
                                         "b":  0.687,
                                         "c":  0.186,
                                         "aT_by_T_years":  {
                                                               "2":  199,
                                                               "5":  212,
                                                               "10":  215,
                                                               "20":  215,
                                                               "50":  208,
                                                               "100":  202
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1481201100/1485400110 GHARDIMAOU)."
                                     }
                     },
                     {
                         "name":  "Zriba Aïn Sfaya",
                         "code":  "1484956000",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 3856",
                                             "lon_gon_raw":  "8Gr 7975",
                                             "lat_gon":  40.3856,
                                             "lon_gon":  8.7975,
                                             "lat_deg":  null,
                                             "lon_deg":  null
                                         },
                         "table18":  {
                                         "b":  0.555,
                                         "c":  0.283,
                                         "aT_by_T_years":  {
                                                               "2":  145,
                                                               "5":  170,
                                                               "10":  175,
                                                               "20":  173,
                                                               "50":  162,
                                                               "100":  150
                                                           }
                                     }
                     },
                     {
                         "name":  "Abida Cassis",
                         "code":  "1484901000",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 8512",
                                             "lon_gon_raw":  "9Gr 4614",
                                             "lat_gon":  40.8512,
                                             "lon_gon":  9.4614,
                                             "lat_deg":  36.76861,
                                             "lon_deg":  10.8575
                                         },
                         "table18":  {
                                         "b":  0.651,
                                         "c":  0.2,
                                         "aT_by_T_years":  {
                                                               "2":  217,
                                                               "5":  233,
                                                               "10":  236,
                                                               "20":  235,
                                                               "50":  228,
                                                               "100":  220
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1484500520 CASSIS Abida)."
                                     }
                     },
                     {
                         "name":  "Barrage Chiba",
                         "code":  "1484926000",
                         "coordinates":  {
                                             "lat_gon_raw":  null,
                                             "lon_gon_raw":  null,
                                             "lat_gon":  null,
                                             "lon_gon":  null,
                                             "lat_deg":  null,
                                             "lon_deg":  null
                                         },
                         "table18":  {
                                         "b":  0.575,
                                         "c":  0.276,
                                         "aT_by_T_years":  {
                                                               "2":  206,
                                                               "5":  216,
                                                               "10":  219,
                                                               "20":  218,
                                                               "50":  212,
                                                               "100":  205
                                                           },
                                         "notes":  "Coordonnées illisibles sur la capture (Y=+ / X=+)."
                                     }
                     },
                     {
                         "name":  "Barrage Masri",
                         "code":  "1484905500",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 5922",
                                             "lon_gon_raw":  "9Gr 0630",
                                             "lat_gon":  40.5922,
                                             "lon_gon":  9.063,
                                             "lat_deg":  36.533,
                                             "lon_deg":  10.494
                                         },
                         "table18":  {
                                         "b":  0.555,
                                         "c":  0.304,
                                         "aT_by_T_years":  {
                                                               "2":  164,
                                                               "5":  169,
                                                               "10":  170,
                                                               "20":  170,
                                                               "50":  168,
                                                               "100":  165
                                                           }
                                     }
                     },
                     {
                         "name":  "Bou Arada",
                         "code":  "1484907000",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 3878",
                                             "lon_gon_raw":  "8Gr 0853",
                                             "lat_gon":  40.3878,
                                             "lon_gon":  8.0853,
                                             "lat_deg":  36.34194,
                                             "lon_deg":  9.61722
                                         },
                         "table18":  {
                                         "b":  0.682,
                                         "c":  0.302,
                                         "aT_by_T_years":  {
                                                               "2":  177,
                                                               "5":  185,
                                                               "10":  188,
                                                               "20":  189,
                                                               "50":  186,
                                                               "100":  181
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1484104050 BOU ARADA)."
                                     }
                     },
                     {
                         "name":  "Bezirk Barrage",
                         "code":  "1484905000",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 79\u0027 90\"",
                                             "lon_gon_raw":  "9Gr 21\u0027 30\"",
                                             "lat_gon":  null,
                                             "lon_gon":  null,
                                             "lat_deg":  36.719,
                                             "lon_deg":  10.629
                                         },
                         "table18":  {
                                         "b":  0.65,
                                         "c":  0.207,
                                         "aT_by_T_years":  {
                                                               "2":  249,
                                                               "5":  265,
                                                               "10":  268,
                                                               "20":  267,
                                                               "50":  257,
                                                               "100":  247
                                                           },
                                         "notes":  "Coordonnées gon en DMS; degrés décimaux pris des champs X/Y."
                                     }
                     },
                     {
                         "name":  "Halg Enneb",
                         "code":  "1484922000",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 28\u0027 22\"",
                                             "lon_gon_raw":  "8Gr 63\u0027 64\"",
                                             "lat_gon":  null,
                                             "lon_gon":  null,
                                             "lat_deg":  36.254,
                                             "lon_deg":  10.11
                                         },
                         "table18":  {
                                         "b":  null,
                                         "b_by_T_years":  {
                                                              "2":  0.56,
                                                              "5":  0.56,
                                                              "10":  0.56,
                                                              "20":  0.5,
                                                              "50":  0.5,
                                                              "100":  0.5
                                                          },
                                         "c":  0.215,
                                         "aT_by_T_years":  {
                                                               "2":  127,
                                                               "5":  135,
                                                               "10":  138,
                                                               "20":  108,
                                                               "50":  106,
                                                               "100":  103
                                                           },
                                         "notes":  "b varie selon T dans le tableau."
                                     }
                     },
                     {
                         "name":  "Zouarine Gare",
                         "code":  "14859540",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 02\u0027 67\"",
                                             "lon_gon_raw":  "7Gr 29\u0027 64\"",
                                             "lat_gon":  null,
                                             "lon_gon":  null,
                                             "lat_deg":  36.024,
                                             "lon_deg":  8.904
                                         },
                         "table18":  {
                                         "b":  0.637,
                                         "c":  0.223,
                                         "aT_by_T_years":  {
                                                               "2":  197,
                                                               "5":  214,
                                                               "10":  219,
                                                               "20":  218,
                                                               "50":  212,
                                                               "100":  204
                                                           },
                                         "notes":  "Coordonnées gon en DMS; degrés décimaux pris des champs X/Y."
                                     }
                     },
                     {
                         "name":  "Oued El Abid",
                         "code":  "1484932500",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 9589",
                                             "lon_gon_raw":  "9Gr 3420",
                                             "lat_gon":  40.9589,
                                             "lon_gon":  9.342,
                                             "lat_deg":  36.86806,
                                             "lon_deg":  10.66444
                                         },
                         "table18":  {
                                         "b":  0.656,
                                         "c":  0.198,
                                         "aT_by_T_years":  {
                                                               "2":  180,
                                                               "5":  188,
                                                               "10":  188,
                                                               "20":  186,
                                                               "50":  179,
                                                               "100":  172
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1484300150 PONT ROUTE N9 El Abid)."
                                     }
                     },
                     {
                         "name":  "Tuburbo Majus",
                         "code":  "1484952500",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 4289",
                                             "lon_gon_raw":  "8Gr 3798",
                                             "lat_gon":  40.4289,
                                             "lon_gon":  8.3798,
                                             "lat_deg":  36.39417,
                                             "lon_deg":  9.908
                                         },
                         "table18":  {
                                         "b":  0.595,
                                         "c":  0.208,
                                         "aT_by_T_years":  {
                                                               "2":  192,
                                                               "5":  205,
                                                               "10":  208,
                                                               "20":  208,
                                                               "50":  202,
                                                               "100":  196
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1484100110 TUBURBO MAJUS)."
                                     }
                     },
                     {
                         "name":  "Siah Amara",
                         "code":  "14899455",
                         "coordinates":  {
                                             "lat_gon_raw":  "39Gr 2000",
                                             "lon_gon_raw":  "6Gr 8510",
                                             "lat_gon":  39.2,
                                             "lon_gon":  6.851,
                                             "lat_deg":  null,
                                             "lon_deg":  null
                                         },
                         "table18":  {
                                         "b":  0.39,
                                         "c":  null,
                                         "c_by_T_years":  {
                                                              "2":  164,
                                                              "5":  179,
                                                              "10":  183,
                                                              "20":  182,
                                                              "50":  175,
                                                              "100":  167
                                                          },
                                         "aT_by_T_years":  {
                                                               "2":  2,
                                                               "5":  5,
                                                               "10":  10,
                                                               "20":  20,
                                                               "50":  50,
                                                               "100":  100
                                                           },
                                         "notes":  "Tableau atypique: aT=T et c varie avec T."
                                     }
                     },
                     {
                         "name":  "Aïn Jaffel",
                         "code":  "14869120",
                         "coordinates":  {
                                             "lat_gon_raw":  "39Gr 5110",
                                             "lon_gon_raw":  "7Gr 5309",
                                             "lat_gon":  39.511,
                                             "lon_gon":  7.5309,
                                             "lat_deg":  null,
                                             "lon_deg":  null
                                         },
                         "table18":  {
                                         "b":  0.547,
                                         "c":  0.192,
                                         "aT_by_T_years":  {
                                                               "2":  356,
                                                               "5":  391,
                                                               "10":  399,
                                                               "20":  399,
                                                               "50":  389,
                                                               "100":  374
                                                           }
                                     }
                     },
                     {
                         "name":  "Aïn Taga",
                         "code":  "14859020",
                         "coordinates":  {
                                             "lat_gon_raw":  "39Gr 4611",
                                             "lon_gon_raw":  "7Gr 0497",
                                             "lat_gon":  39.4611,
                                             "lon_gon":  7.0497,
                                             "lat_deg":  null,
                                             "lon_deg":  null
                                         },
                         "table18":  {
                                         "b_raw":  524,
                                         "c_raw":  209,
                                         "b":  0.524,
                                         "c":  0.209,
                                         "aT_by_T_years":  {
                                                               "2":  307,
                                                               "5":  338,
                                                               "10":  347,
                                                               "20":  346,
                                                               "50":  337,
                                                               "100":  325
                                                           },
                                         "notes":  "b/c affichés sans virgule sur la capture; interprétation b=0.524, c=0.209."
                                     }
                     },
                     {
                         "name":  "Aïn Beya Fernana",
                         "code":  "14859010",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 7322",
                                             "lon_gon_raw":  "6Gr 9998",
                                             "lat_gon":  40.7322,
                                             "lon_gon":  6.9998,
                                             "lat_deg":  36.64306,
                                             "lon_deg":  8.70361
                                         },
                         "table18":  {
                                         "b":  0.677,
                                         "c":  0.27,
                                         "aT_by_T_years":  {
                                                               "2":  297,
                                                               "5":  312,
                                                               "10":  316,
                                                               "20":  315,
                                                               "50":  308,
                                                               "100":  299
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1485303510 FERNANA)."
                                     }
                     },
                     {
                         "name":  "Bir Ayed",
                         "code":  "14849065",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 5922",
                                             "lon_gon_raw":  "9Gr 2164",
                                             "lat_gon":  40.5922,
                                             "lon_gon":  9.2164,
                                             "lat_deg":  null,
                                             "lon_deg":  null
                                         },
                         "table18":  {
                                         "b":  0.555,
                                         "c":  0.256,
                                         "aT_by_T_years":  {
                                                               "2":  139,
                                                               "5":  156,
                                                               "10":  160,
                                                               "20":  159,
                                                               "50":  150,
                                                               "100":  142
                                                           }
                                     }
                     },
                     {
                         "name":  "Robaa Ouled Yahia",
                         "code":  "1484938000",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 1056",
                                             "lon_gon_raw":  "8Gr 0386",
                                             "lat_gon":  40.1056,
                                             "lon_gon":  8.0386,
                                             "lat_deg":  36.075855,
                                             "lon_deg":  9.39105
                                         },
                         "table18":  {
                                         "b":  0.681,
                                         "c":  0.22,
                                         "aT_by_T_years":  {
                                                               "2":  230,
                                                               "5":  247,
                                                               "10":  252,
                                                               "20":  250,
                                                               "50":  242,
                                                               "100":  233
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1485501610 PONT GP4 SILIANA ROBAA)."
                                     }
                     },
                     {
                         "name":  "Sraya Ecole",
                         "code":  "1485946500",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 5200",
                                             "lon_gon_raw":  "6Gr 5697",
                                             "lat_gon":  40.52,
                                             "lon_gon":  6.5697,
                                             "lat_deg":  null,
                                             "lon_deg":  null
                                         },
                         "table18":  {
                                         "b":  0.637,
                                         "c":  0.194,
                                         "aT_by_T_years":  {
                                                               "2":  168,
                                                               "5":  176,
                                                               "10":  178,
                                                               "20":  177,
                                                               "50":  174,
                                                               "100":  169
                                                           }
                                     }
                     },
                     {
                         "name":  "Aïn Saboun",
                         "code":  "14869050",
                         "coordinates":  {
                                             "lat_gon_raw":  "37Gr 2889",
                                             "lon_gon_raw":  "7Gr 5308",
                                             "lat_gon":  37.2889,
                                             "lon_gon":  7.5308,
                                             "lat_deg":  35.57833,
                                             "lon_deg":  9.11555
                                         },
                         "table18":  {
                                         "b":  0.738,
                                         "c":  0.233,
                                         "aT_by_T_years":  {
                                                               "2":  348,
                                                               "5":  372,
                                                               "10":  380,
                                                               "20":  377,
                                                               "50":  366,
                                                               "100":  353
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1486200110 CASSIS AIN SABOUN)."
                                     }
                     },
                     {
                         "name":  "Bir Mcherga Barrage",
                         "code":  "14849080",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 5700",
                                             "lon_gon_raw":  "8Gr 5308",
                                             "lat_gon":  40.57,
                                             "lon_gon":  8.5308,
                                             "lat_deg":  null,
                                             "lon_deg":  null
                                         },
                         "table18":  {
                                         "b":  0.644,
                                         "c":  0.335,
                                         "aT_by_T_years":  {
                                                               "2":  171,
                                                               "5":  185,
                                                               "10":  190,
                                                               "20":  188,
                                                               "50":  181,
                                                               "100":  172
                                                           }
                                     }
                     },
                     {
                         "name":  "Gabès DRE",
                         "code":  "14899192",
                         "coordinates":  {
                                             "lat_gon_raw":  "37Gr 6200",
                                             "lon_gon_raw":  "8Gr 6342",
                                             "lat_gon":  37.62,
                                             "lon_gon":  8.6342,
                                             "lat_deg":  null,
                                             "lon_deg":  null
                                         },
                         "table18":  {
                                         "b":  0.64,
                                         "c":  0.285,
                                         "aT_by_T_years":  {
                                                               "2":  216,
                                                               "5":  234,
                                                               "10":  238,
                                                               "20":  236,
                                                               "50":  226,
                                                               "100":  216
                                                           }
                                     }
                     },
                     {
                         "name":  "Gabès Citerne",
                         "code":  "14899180",
                         "coordinates":  {
                                             "lat_gon_raw":  "37Gr 6155",
                                             "lon_gon_raw":  "8Gr 6342",
                                             "lat_gon":  37.6155,
                                             "lon_gon":  8.6342,
                                             "lat_deg":  null,
                                             "lon_deg":  null
                                         },
                         "table18":  {
                                         "b":  0.632,
                                         "c":  0.464,
                                         "aT_by_T_years":  {
                                                               "2":  84,
                                                               "5":  89,
                                                               "10":  91,
                                                               "20":  90,
                                                               "50":  86,
                                                               "100":  82
                                                           }
                                     }
                     },
                     {
                         "name":  "Grombalia",
                         "code":  "14849209",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 6700",
                                             "lon_gon_raw":  "9Gr 3294",
                                             "lat_gon":  40.67,
                                             "lon_gon":  9.3294,
                                             "lat_deg":  null,
                                             "lon_deg":  null
                                         },
                         "table18":  {
                                         "b":  0.639,
                                         "c":  0.209,
                                         "aT_by_T_years":  {
                                                               "2":  219,
                                                               "5":  237,
                                                               "10":  239,
                                                               "20":  238,
                                                               "50":  229,
                                                               "100":  219
                                                           }
                                     }
                     },
                     {
                         "name":  "Haffouz",
                         "code":  "14869211",
                         "coordinates":  {
                                             "lat_gon_raw":  "37Gr 3733",
                                             "lon_gon_raw":  "8Gr 1542",
                                             "lat_gon":  37.3733,
                                             "lon_gon":  8.1542,
                                             "lat_deg":  35.63194,
                                             "lon_deg":  9.660833
                                         },
                         "table18":  {
                                         "b":  0.657,
                                         "c":  0.244,
                                         "aT_by_T_years":  {
                                                               "2":  236,
                                                               "5":  254,
                                                               "10":  260,
                                                               "20":  259,
                                                               "50":  250,
                                                               "100":  239
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1486100170 HAFFOUZ TELEPHERIQUE)."
                                     }
                     },
                     {
                         "name":  "Haïdra Poste Douanes",
                         "code":  "1485921000",
                         "coordinates":  {
                                             "lat_gon_raw":  "35,564",
                                             "lon_gon_raw":  "8,452",
                                             "lat_gon":  35.564,
                                             "lon_gon":  8.452,
                                             "lat_deg":  35.61667,
                                             "lon_deg":  8.27278
                                         },
                         "table18":  {
                                         "b":  0.754,
                                         "c":  0.232,
                                         "aT_by_T_years":  {
                                                               "2":  261,
                                                               "5":  277,
                                                               "10":  281,
                                                               "20":  280,
                                                               "50":  273,
                                                               "100":  264
                                                           },
                                         "notes":  "Coordonnées en gon mais écrites sans suffixe \u0027Gr\u0027. Coordonnées WGS84 SIEREM HSM 2022 (1485106125 SIDI ABDELKADER HAIDRA)."
                                     }
                     },
                     {
                         "name":  "El Hamma téléphérique",
                         "code":  "14899160",
                         "coordinates":  {
                                             "lat_gon_raw":  "37Gr 6333",
                                             "lon_gon_raw":  "8Gr 2675",
                                             "lat_gon":  37.6333,
                                             "lon_gon":  8.2675,
                                             "lat_deg":  33.86972,
                                             "lon_deg":  9.77833
                                         },
                         "table18":  {
                                         "b":  0.523,
                                         "c":  0.374,
                                         "aT_by_T_years":  {
                                                               "2":  63,
                                                               "5":  68,
                                                               "10":  69,
                                                               "20":  69,
                                                               "50":  66,
                                                               "100":  63
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1489500170 TELEPHERIQUE El Hamma)."
                                     }
                     },
                     {
                         "name":  "Hamma aval (Mornag)",
                         "code":  "14849346",
                         "coordinates":  {
                                             "lat_gon_raw":  "37Gr 6055",
                                             "lon_gon_raw":  "8Gr 3130",
                                             "lat_gon":  37.6055,
                                             "lon_gon":  8.313,
                                             "lat_deg":  36.65194,
                                             "lon_deg":  10.27555
                                         },
                         "table18":  {
                                         "b":  0.588,
                                         "c":  0.236,
                                         "aT_by_T_years":  {
                                                               "2":  151,
                                                               "5":  160,
                                                               "10":  163,
                                                               "20":  163,
                                                               "50":  159,
                                                               "100":  151
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1484102580 AVAL El Hamma (Mornag))."
                                     }
                     },
                     {
                         "name":  "Izid Barrage",
                         "code":  "14859230",
                         "coordinates":  {
                                             "lat_gon_raw":  "35,942",
                                             "lon_gon_raw":  "8,830",
                                             "lat_gon":  35.942,
                                             "lon_gon":  8.83,
                                             "lat_deg":  35.92361,
                                             "lon_deg":  8.81083
                                         },
                         "table18":  {
                                         "b":  0.79,
                                         "c":  0.372,
                                         "aT_by_T_years":  {
                                                               "2":  182,
                                                               "5":  186,
                                                               "10":  184,
                                                               "20":  179,
                                                               "50":  169,
                                                               "100":  159
                                                           },
                                         "notes":  "Coordonnées en gon mais écrites sans suffixe \u0027Gr\u0027. Coordonnées WGS84 SIEREM HSM 2022 (1485203780 IZID BARRAGE)."
                                     }
                     },
                     {
                         "name":  "Joumine Antra",
                         "code":  "14839135",
                         "coordinates":  {
                                             "lat_gon_raw":  "41Gr 0633",
                                             "lon_gon_raw":  "7Gr 9353",
                                             "lat_gon":  41.0633,
                                             "lon_gon":  7.9353,
                                             "lat_deg":  36.955,
                                             "lon_deg":  9.12527778
                                         },
                         "table18":  {
                                         "b":  0.475,
                                         "c":  0.226,
                                         "aT_by_T_years":  {
                                                               "2":  121,
                                                               "5":  135,
                                                               "10":  139,
                                                               "20":  138,
                                                               "50":  132,
                                                               "100":  126
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1483600110 Jebel Antra)."
                                     }
                     },
                     {
                         "name":  "Kasserine",
                         "code":  "14869220",
                         "coordinates":  {
                                             "lat_gon_raw":  "39Gr 0733",
                                             "lon_gon_raw":  "7Gr 2097",
                                             "lat_gon":  39.0733,
                                             "lon_gon":  7.2097,
                                             "lat_deg":  null,
                                             "lon_deg":  null
                                         },
                         "table18":  {
                                         "b":  0.633,
                                         "c":  0.178,
                                         "aT_by_T_years":  {
                                                               "2":  193,
                                                               "5":  208,
                                                               "10":  211,
                                                               "20":  213,
                                                               "50":  206,
                                                               "100":  199
                                                           }
                                     }
                     },
                     {
                         "name":  "Khanguet Zazia",
                         "code":  "14869255",
                         "coordinates":  {
                                             "lat_gon_raw":  "38Gr 99",
                                             "lon_gon_raw":  "7Gr 5308",
                                             "lat_gon":  38.99,
                                             "lon_gon":  7.5308,
                                             "lat_deg":  35.09194,
                                             "lon_deg":  9.11778
                                         },
                         "table18":  {
                                         "b":  0.704,
                                         "c":  0.252,
                                         "aT_by_T_years":  {
                                                               "2":  228,
                                                               "5":  241,
                                                               "10":  245,
                                                               "20":  244,
                                                               "50":  237,
                                                               "100":  228
                                                           },
                                         "notes":  "Latitude écrite \u002738Gr 99\u0027 interprétée comme 38.99 gon. Coordonnées WGS84 SIEREM HSM 2022 (1486300140 KHANGUET ZAZIA)."
                                     }
                     },
                     {
                         "name":  "Barrage Lebna",
                         "code":  "14849052",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 8188",
                                             "lon_gon_raw":  "9Gr 5442",
                                             "lat_gon":  40.8188,
                                             "lon_gon":  9.5442,
                                             "lat_deg":  null,
                                             "lon_deg":  null
                                         },
                         "table18":  {
                                         "b":  0.477,
                                         "c":  0.191,
                                         "aT_by_T_years":  {
                                                               "2":  202,
                                                               "5":  223,
                                                               "10":  228,
                                                               "20":  227,
                                                               "50":  221,
                                                               "100":  212
                                                           }
                                     }
                     },
                     {
                         "name":  "Matmata Ancienne",
                         "code":  "14899300",
                         "coordinates":  {
                                             "lat_gon_raw":  "37Gr 4122",
                                             "lon_gon_raw":  "8Gr 5242",
                                             "lat_gon":  37.4122,
                                             "lon_gon":  8.5242,
                                             "lat_deg":  33.67098,
                                             "lon_deg":  10.009
                                         },
                         "table18":  {
                                         "b":  0.6,
                                         "c":  0.221,
                                         "aT_by_T_years":  {
                                                               "2":  156,
                                                               "5":  172,
                                                               "10":  176,
                                                               "20":  175,
                                                               "50":  168,
                                                               "100":  162
                                                           },
                                         "notes":  "WGS84 depuis feuille DRE (gon→deg+Paris). SIEREM 1489600280 BARRAGE MATMATA NOUVELLE (30.96, 10.02) non retenu (site « nouvelle », trop au sud)."
                                     }
                     },
                     {
                         "name":  "Mellègue K13",
                         "code":  "14859110",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 1344",
                                             "lon_gon_raw":  "7Gr 1072",
                                             "lat_gon":  40.1344,
                                             "lon_gon":  7.1072,
                                             "lat_deg":  36.11694,
                                             "lon_deg":  8.4938
                                         },
                         "table18":  {
                                         "b":  0.668,
                                         "c":  0.365,
                                         "aT_by_T_years":  {
                                                               "2":  241,
                                                               "5":  259,
                                                               "10":  264,
                                                               "20":  263,
                                                               "50":  254,
                                                               "100":  243
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1485101210 MELLEGUE K13)."
                                     }
                     },
                     {
                         "name":  "Oued El Khéirât",
                         "code":  "1484927000",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 3800",
                                             "lon_gon_raw":  "8Gr 5209",
                                             "lat_gon":  40.38,
                                             "lon_gon":  8.5209,
                                             "lat_deg":  36.15083,
                                             "lon_deg":  10.22111
                                         },
                         "table18":  {
                                         "b":  0.704,
                                         "c":  0.31,
                                         "aT_by_T_years":  {
                                                               "2":  205,
                                                               "5":  215,
                                                               "10":  218,
                                                               "20":  218,
                                                               "50":  213,
                                                               "100":  206
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1484900130 KHAIRAT CASSIS)."
                                     }
                     },
                     {
                         "name":  "Oued Mgaiez",
                         "code":  "14849130",
                         "coordinates":  {
                                             "lat_gon_raw":  "41Gr 0755",
                                             "lon_gon_raw":  "9Gr 6242",
                                             "lat_gon":  41.0755,
                                             "lon_gon":  9.6242,
                                             "lat_deg":  36.96795,
                                             "lon_deg":  10.999
                                         },
                         "table18":  {
                                         "b":  0.612,
                                         "c":  0.193,
                                         "aT_by_T_years":  {
                                                               "2":  270,
                                                               "5":  287,
                                                               "10":  292,
                                                               "20":  290,
                                                               "50":  281,
                                                               "100":  271
                                                           },
                                         "notes":  "WGS84 depuis feuille DRE (gon→deg+Paris). SIEREM 1484401030 EL MGAIEZ (37.71444, 10.83139) écarté : latitude incohérente pour le Cap Bon."
                                     }
                     },
                     {
                         "name":  "Oued Tine cassis",
                         "code":  "14839505",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 3300",
                                             "lon_gon_raw":  "7Gr 9542",
                                             "lat_gon":  40.33,
                                             "lon_gon":  7.9542,
                                             "lat_deg":  36.93416667,
                                             "lon_deg":  9.38
                                         },
                         "table18":  {
                                         "b":  0.617,
                                         "c":  0.283,
                                         "aT_by_T_years":  {
                                                               "2":  115,
                                                               "5":  121,
                                                               "10":  123,
                                                               "20":  123,
                                                               "50":  120,
                                                               "100":  117
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1483602050 Cassis Tine)."
                                     }
                     },
                     {
                         "name":  "Rmel Sidi Abdallah",
                         "code":  "1484935600",
                         "coordinates":  {
                                             "lat_gon_raw":  "36,325",
                                             "lon_gon_raw":  "10,383",
                                             "lat_gon":  36.325,
                                             "lon_gon":  10.383,
                                             "lat_deg":  36.32278,
                                             "lon_deg":  10.37472
                                         },
                         "table18":  {
                                         "b":  0.632,
                                         "c":  0.255,
                                         "aT_by_T_years":  {
                                                               "2":  215,
                                                               "5":  235,
                                                               "10":  239,
                                                               "20":  238,
                                                               "50":  229,
                                                               "100":  219
                                                           },
                                         "notes":  "Coordonnées en gon mais écrites sans suffixe \u0027Gr\u0027. Coordonnées WGS84 SIEREM HSM 2022 (1484800101 SIDI ABDALLAH Remel)."
                                     }
                     },
                     {
                         "name":  "Sarrat Pont Route",
                         "code":  "14859300",
                         "coordinates":  {
                                             "lat_gon_raw":  "41Gr 00",
                                             "lon_gon_raw":  "8Gr 4167",
                                             "lat_gon":  41.0,
                                             "lon_gon":  8.4167,
                                             "lat_deg":  35.80972,
                                             "lon_deg":  8.56805
                                         },
                         "table18":  {
                                         "b":  0.798,
                                         "c":  0.251,
                                         "aT_by_T_years":  {
                                                               "2":  419,
                                                               "5":  464,
                                                               "10":  475,
                                                               "20":  471,
                                                               "50":  450,
                                                               "100":  427
                                                           },
                                         "notes":  "Latitude écrite \u002741Gr 00\u0027 interprétée comme 41.00 gon. Coordonnées WGS84 SIEREM HSM 2022 (1485105060 PONT ROUTE Sarrath)."
                                     }
                     },
                     {
                         "name":  "Sbeitla",
                         "code":  "14869410",
                         "coordinates":  {
                                             "lat_gon_raw":  "39Gr 1500",
                                             "lon_gon_raw":  "7Gr 5419",
                                             "lat_gon":  39.15,
                                             "lon_gon":  7.5419,
                                             "lat_deg":  null,
                                             "lon_deg":  null
                                         },
                         "table18":  {
                                         "b":  0.666,
                                         "c":  0.228,
                                         "aT_by_T_years":  {
                                                               "2":  278,
                                                               "5":  293,
                                                               "10":  298,
                                                               "20":  297,
                                                               "50":  290,
                                                               "100":  281
                                                           }
                                     }
                     },
                     {
                         "name":  "Sejnène",
                         "code":  "14839410",
                         "coordinates":  {
                                             "lat_gon_raw":  "41Gr 1778",
                                             "lon_gon_raw":  "7Gr 6764",
                                             "lat_gon":  41.1778,
                                             "lon_gon":  7.6764,
                                             "lat_deg":  37.19388889,
                                             "lon_deg":  9.1672
                                         },
                         "table18":  {
                                         "b":  0.547,
                                         "c":  0.192,
                                         "aT_by_T_years":  {
                                                               "2":  356,
                                                               "5":  391,
                                                               "10":  399,
                                                               "20":  399,
                                                               "50":  389,
                                                               "100":  374
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1483500140 Deversoir Sejnane)."
                                     }
                     },
                     {
                         "name":  "Sidi Boubaker",
                         "code":  "14889500",
                         "coordinates":  {
                                             "lat_gon_raw":  "38Gr 4888",
                                             "lon_gon_raw":  "6Gr 9475",
                                             "lat_gon":  38.4888,
                                             "lon_gon":  6.9475,
                                             "lat_deg":  34.74,
                                             "lon_deg":  10.27083
                                         },
                         "table18":  {
                                         "b":  0.703,
                                         "c":  0.183,
                                         "aT_by_T_years":  {
                                                               "2":  215,
                                                               "5":  237,
                                                               "10":  248,
                                                               "20":  254,
                                                               "50":  258,
                                                               "100":  256
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1488201630 SIDI BOUBAKER)."
                                     }
                     },
                     {
                         "name":  "Siliana Laouej",
                         "code":  "14859220",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 5288",
                                             "lon_gon_raw":  "7Gr 9186",
                                             "lat_gon":  40.5288,
                                             "lon_gon":  7.9186,
                                             "lat_deg":  36.53917,
                                             "lon_deg":  9.428184
                                         },
                         "table18":  {
                                         "b":  0.651,
                                         "c":  0.18,
                                         "aT_by_T_years":  {
                                                               "2":  176,
                                                               "5":  191,
                                                               "10":  194,
                                                               "20":  191,
                                                               "50":  184,
                                                               "100":  176
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1485501635 JEBEL LAOUEDJ)."
                                     }
                     },
                     {
                         "name":  "Sloguia",
                         "code":  "14859470",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 6555",
                                             "lon_gon_raw":  "7Gr 9809",
                                             "lat_gon":  40.6555,
                                             "lon_gon":  7.9809,
                                             "lat_deg":  36.588119,
                                             "lon_deg":  9.518017
                                         },
                         "table18":  {
                                         "b":  0.673,
                                         "c":  0.21,
                                         "aT_by_T_years":  {
                                                               "2":  185,
                                                               "5":  201,
                                                               "10":  205,
                                                               "20":  203,
                                                               "50":  196,
                                                               "100":  188
                                                           },
                                         "notes":  "Coordonnées WGS84 SIEREM HSM 2022 (1485900130 SLOUGUIA)."
                                     }
                     },
                     {
                         "name":  "Tunis Mannoubia",
                         "code":  "14849515",
                         "coordinates":  {
                                             "lat_gon_raw":  "40Gr 8711",
                                             "lon_gon_raw":  "8Gr 7060",
                                             "lat_gon":  40.8711,
                                             "lon_gon":  8.706,
                                             "lat_deg":  null,
                                             "lon_deg":  null
                                         },
                         "table18":  {
                                         "b":  0.634,
                                         "c":  0.25,
                                         "aT_by_T_years":  {
                                                               "2":  194,
                                                               "5":  203,
                                                               "10":  206,
                                                               "20":  206,
                                                               "50":  202,
                                                               "100":  197
                                                           }
                                     }
                     },
                     {
                         "name":  "Zita Telmam",
                         "code":  "1489949000",
                         "coordinates":  {
                                             "lat_gon_raw":  "33,3",
                                             "lon_gon_raw":  "9,717",
                                             "lat_gon":  33.3,
                                             "lon_gon":  9.717,
                                             "lat_deg":  30.61139,
                                             "lon_deg":  8.90833
                                         },
                         "table18":  {
                                         "b":  0.491,
                                         "c":  0.348,
                                         "aT_by_T_years":  {
                                                               "2":  104,
                                                               "5":  124,
                                                               "10":  130,
                                                               "20":  128,
                                                               "50":  119,
                                                               "100":  109
                                                           },
                                         "notes":  "Coordonnées en gon mais écrites sans suffixe \u0027Gr\u0027. Coordonnées WGS84 SIEREM HSM 2022 (1489490110 TELEMEN BV Oued Zita)."
                                     }
                     }
                 ]
};
