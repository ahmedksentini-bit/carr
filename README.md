# GIRA — conception de carrefours giratoires et de carrefours plans (T, X)

Application web statique (HTML + JavaScript, sans serveur applicatif) pour dessiner à l'échelle un carrefour giratoire,
un carrefour en T ou un carrefour en X (croix) selon le SETRA (ACI, interurbain) ou le CERTU (urbain), sur fond satellite
ou sur un fond topographique DXF.

## Fonctions (version 1)

- **Vue CAD en mètres** : zoom au curseur, panoramique, accrochage aux sommets (F3), ortho (F8), grille (F7),
  ligne de commande (`x,y`, `@dx,dy`, `@d<angle`, distance directe), annuler / rétablir.
- **Systèmes de coordonnées** : UTM WGS84 (fuseau automatique), Nord / Sud Tunisie (Carthage), Nord Maroc,
  Lambert-93, ou toute définition proj4. Les coordonnées du projet sont celles du système choisi : un DXF topo
  dans le même système se superpose à l'imagerie. Changer de système reprojette les axes.
- **Fonds** : Esri World Imagery (jusqu'au niveau 21 ; là où l'imagerie manque, la tuile du niveau inférieur est
  agrandie au lieu de « Map data not yet available »), OpenStreetMap, Esri Topo ; recherche de lieu (Nominatim)
  ou saisie « lat, lon ».
- **Import DXF ASCII** : LINE, LWPOLYLINE / POLYLINE (arcs), ARC, CIRCLE, ELLIPSE, SPLINE, TEXT, MTEXT, POINT,
  INSERT (blocs, attributs), DIMENSION ; calques avec couleurs, unités m / cm / mm.
- **Giratoire** : axes de branches saisis par l'utilisateur, centre calculé à l'intersection des axes (ou placé),
  Rg, la, bande franchissable ; par branche : voies, le / Re, ls / Rs, îlot séparateur (triangle de construction
  ACI Rg × Rg/4, décalage à gauche, bordures Rg/50), îlot peint ou absent, **TPC** avec sa largeur.
- **Carrefours en T et en X** (ACI, chapitre « Carrefours plans ») : route principale = paire de branches la plus
  alignée (ou choisie), profil conservé ; voie de tourne-à-gauche avec présignalisation, déport des bords au 1/15,
  alignement droit, sifflet, stockage et îlot central en saillie. Paramètres de la voie principale repris de Mensura :
  l'enveloppe de l'îlot central s'ouvre sur la présignalisation jusqu'au nez c (1,60 m), puis jusqu'à la largeur totale
  sur le déport ; les bords suivent en parallèle (largeur des voies constante) ; rayons de raccordement des zones
  stockage–sifflet 20, sifflet–alignement 20, alignement–déport 100, déport–présignalisation 200,
  présignalisation–ligne continue 300 m (queue tangente à l'axe) ; îlot en saillie du nez à la tête, à la distance de
  marquage (0,30 m) de l'enveloppe, nez arrondi. Branches secondaires construites selon l'ACI (Fig. 24
  et 25, Tableau 8) : triangle de construction H = 4l, b1 = 0,55l, b2 = 1,45l (axe décalé de 0,50 m vers la sortie),
  îlot formé par les cercles de giration Ris = 2l + a et Rie = 2l + b, queue raccordée à l'axe par Rre ≈ 8l et Rrs ≈ 16l,
  îlot en saillie à 1,50 m de la rive avec nez de 1 m ; bordures parallèles à l'îlot à le = sup(l/2 ; 3) et
  ls = l/2 + 0,50, raccordées par Re = 2l et Rs = 4l ; têtes des îlots centraux aux points de tangence de Ris et Rie ; régime
  cédez-le-passage (T'2) ou STOP ; triangles de visibilité D = V85 × t (8 à 11 s selon régime et TAG).
  Axe des branches secondaires : alignement droit sur la longueur du débouché (îlot, retour des bordures à la
  chaussée courante, 30 m au-delà de l'îlot), dirigé vers le point où il rejoint l'axe saisi, puis raccordement de
  rayon axeR et axe saisi suivi jusqu'au bout, avec un rayon par sommet (onglet Branche, cotés sur le plan) ; les
  sommets placés dans l'alignement droit sont ignorés. La route principale reste droite.
- **Dessin** : bordures, raccordements tangents, îlots, chaussée, ligne de cédez-le-passage, marquages,
  cotations, triangles de construction, trajectoire de déflexion.
- **Rives peintes et bords de chaussée (giratoire)** : Rg, Ri, le, ls et le triangle de l'îlot sont mesurés aux
  rives peintes ; bords de chaussée à la BDD (extérieur) et à la BDG (îlot central, îlots séparateurs). Îlot
  séparateur : enveloppe peinte = triangle de construction, îlot en saillie en retrait de la BDG, zébra en pointe.
- **Abords** : caniveau, bordure, trottoir et contre-bordure en urbain, berme en interurbain, cotés sur le plan ;
  **profil en travers type** de l'anneau généré automatiquement (onglet Profil, export DXF), avec les vues de
  bordures (3 cm bande franchissable, 6 cm îlot central) et les pentes. Trottoirs colorés ; abords aussi le long des
  carrefours en T et en X.
- **Passages piétons et PMR (urbain)** : sur chaque branche, à 5 m en retrait du cédez-le-passage (ou du bord de la
  principale), largeur 2,50 m (IISR : bandes de 0,50 m) ; îlot séparateur coupé en refuge ; sur la route principale
  des T et X, de part et d'autre du débouché, îlot central coupé. Abaissés de trottoir (plan incliné à 8 %, ressaut de
  2 cm) et bandes d'éveil de vigilance de 0,42 m à 0,50 m du nez de bordure (calque `GIRA_PMR`). Réglages : onglet Profil.
- **Branches** : alignement droit dirigé vers le centre près de l'anneau, puis raccordement à l'axe saisi, qu'elles
  suivent jusqu'au bout (polylignes à plusieurs segments). Le centre se place sur la carte (outil C) ou se déplace
  à la souris ; les branches se réorientent vers lui. Rayons de raccordement de l'axe saisis par branche (raccordement
  à l'alignement radial) et par sommet de l'axe saisi, cotés sur le plan (rayon réduit signalé) ; poignées
  de sommet et de milieu de segment (le segment se déplace, les raccordements suivent) ; un « + » au bout extérieur
  de chaque axe en prolonge la saisie.
- **Dévers** : anneau à dévers imposé de 1,5 % vers l'extérieur, constant sur site en pente (ou cône sur plan incliné),
  profil en long des rives, variation des dévers de chaque branche, flèches de dévers sur le plan.
- **Épures de giration (T et X)** : semi-remorque de 16,50 m (largeur 2,55 m, empattement du tracteur 3,80 m, sellette
  à 0,50 m, pivot – essieu 7,80 m, pivot – arrière 12,00 m), modèle cinématique (tractrices). Pour chaque branche
  secondaire : tourne-à-droite et tourne-à-gauche, entrant et sortant ; le conducteur s'écarte vers l'extérieur de sa
  voie, les tourne-à-gauche sont concentriques à Ris / Rie. Surface balayée, traces et silhouettes du véhicule sur le
  calque `GIRA_EPURE` ; empiètements sur les bordures (tolérance : BDD en interurbain, caniveau en urbain) et sur les
  îlots en saillie signalés dans Contrôles et marqués d'une croix. Case à cocher dans l'onglet Carrefour.
  Bouton « Calculer les corrections » (Contrôles) : pour chaque empiètement, plus petite valeur de Rs / Re (bordure),
  Ris / Rie (îlot séparateur) ou du recul des têtes d'îlots centraux qui le supprime (carrefour reconstruit à chaque
  essai), ou l'aménagement équivalent (surlargeur revêtue, partie franchissable) ; bouton « Appliquer ».
- **Visibilité** (onglet dédié, calque `GIRA_VISIBILITE`) : giratoire (SETRA), « quart gauche de l'anneau » = secteur
  de la chaussée annulaire, de la rive intérieure au bord extérieur, entre l'axe de la branche et un quart de tour en
  amont ; il doit être vu en entier depuis un observateur à 15 m en amont du cédez-le-passage (recul réglable), au
  milieu de la voie d'entrée. Le cône de toutes les visées est tracé, et sa profondeur dans l'îlot central est comparée
  à la bande de 2 m sans plantation haute. Carrefours en T et en X : triangles œil – point de conflit – cible à
  D = V85 × t de part et d'autre, cotés. Tableau par branche ; zone dessinée pour toutes les branches ou une seule.
- **Cotes le / ls** : largeur réellement construite entre l'îlot et la bordure (au plus étroit le long de l'îlot pour
  les carrefours en T et en X), suivie de la valeur demandée si elle diffère ; écart de plus de 0,50 m signalé dans
  Contrôles (rayon Re / Rs trop grand pour que la bordure longe l'îlot). Quand Re / Rs rejoint la voie le long de
  l'îlot en amont du raccordement Rr, la bordure devient une courbe composée : rayon de transition réduit (au plus bas
  Re / Rs ÷ 2, 5 m au moins, signalé en information) tangent à l'îlot au même point que Re / Rs, si bien que la voie
  garde le / ls ; sous ce minimum, la jonction glisse vers la principale et la voie s'élargit progressivement. La
  bordure varie ainsi continûment avec l'angle de la branche.
- **Contrôles** : comparaison des valeurs aux recommandations du guide, excentrement des axes, déflexion,
  chevauchement des raccordements, pentes transversales.
- **Capacité des giratoires (type Girabase)** : matrice origine-destination à l'HPM (véh/h, % PL, piétons),
  conversion en uvp (PL = 2 uvp), débits Qe / Qc / Qs, trafic gênant Qg, capacité, réserve (uvp/h et %),
  temps moyen d'attente, files moyenne et maximale, remarques (saturation, surdimensionnement) et recommandation
  de voie directe de tourne-à-droite ; une case « TAD » retire ce mouvement du giratoire.
- **Capacité des carrefours en T et en X (à priorité)** : même matrice OD ; capacité des mouvements non prioritaires
  par acceptation de créneaux (TAG de la principale, TAD, traversée et TAG des secondaires), voie partagée ou TAD à part
  si deux voies d'entrée, effet d'un TAG sans voie réservée ; réserve, attente moyenne et niveau de qualité (HBS),
  attente CERTU T = 3600/(C − S) avec ses seuils de 30 s et 1 min, file à 95 % et contrôle du stockage de la voie de TAG.
- **Voie directe de tourne-à-droite (by-pass)** : dessinée dès que la case « TAD » d'une branche est cochée, vers la
  branche suivante (ACI : voie de 4 m, bandes dérasées 2,00 m à droite et 0,50 m à gauche, rive intérieure de rayon
  40 m, îlot de séparation de 2 m minimum le long des bordures du giratoire, biseau de décélération de 80 m,
  voie d'insertion de 70 m et biseau de 70 m) ; les branches concernées sont allongées automatiquement.
- **Signalisation verticale** (onglet Signalisation, calque `GIRA_SIGNALISATION`, mâts dans les points d'implantation) :
  panneaux placés automatiquement sur l'axe de chaque branche, à droite du sens concerné, le bord du panneau à 0,70 m
  de la BDD (ou du bord de la voie derrière le caniveau en urbain), ou sur l'axe des îlots séparateurs.
  Giratoire : AB25 (A25) à 100–150 m (10–50 m en urbain), D42b ≥ 50 m avant l'AB25, AB3a + M9c au plus près de la
  ligne T'2 (répété à gauche sur l'îlot si l'entrée a 2 voies), B21-1 sur l'îlot central axé sur chaque voie d'entrée
  (sauf mini-giratoire), J5 au nez amont de chaque îlot en saillie, D21 de sortie sur l'îlot, AB6 après la sortie si la
  route est classée à grande circulation, D31 sur l'îlot d'une voie directe. Carrefours en T et en X : AB3a ou AB4 au
  plus près de la ligne (jamais répété à gauche), signal avancé AB3b / AB5 + M1 (150 m en interurbain), J5 et B21a1 au
  nez amont de l'îlot en saillie, sur la principale AB2 (≈ 200 m au cédez-le-passage, ≥ 50 m au STOP) ou AB6, D40 /
  D20 / D60 ; en urbain, régimes feux et priorité à droite (sans panneaux) et présignalisation non systématique.
  Gammes (grande en interurbain, normale en urbain), classe de rétroréflexion, hauteur sous panneau (1,00 m ;
  2,30 m en agglomération) et distances réglables ; tableau récapitulatif (code, implantation, abscisse, X, Y, gamme,
  largeur, hauteur). Contrôles : distances du guide, panneau de la principale dans un triangle de visibilité, îlot
  trop étroit pour une J5 de 500 (1,90 m), cheminement libre de 1,40 m sur trottoir, panneau au-delà de l'axe dessiné.
- **Terrain naturel (MNT)** (onglet Terrain, calque `GIRA_MNT`) : semis de points issu d'un calque 3D du fond DXF
  (POINT, LINE, polylignes 3D ou à élévation, 3DFACE, maillages, cotes écrites en texte — avec contrôle des cotes non
  nulles), du SRTM téléchargé dans le navigateur (tuiles Terrarium AWS Open Data ≈ 30 m, reprojetées dans le système
  du projet, marge et niveau réglables) ou d'un fichier XYZ / grille ESRI ASCII ; triangulation de Delaunay
  (`js/tin.js`, incrémentale avec marche et retournements de Lawson), interpolation linéaire, courbes de niveau
  (équidistance réglable, maîtresses toutes les 5), arêtes du TIN et points affichables, cote TN sous le curseur dans
  la barre d'état, calage de la cote zC du carrefour sur le TN ; points conservés dans le projet et exportés en DXF.
- **Profil en long** (onglet Profil long) : ligne rouge de chaque branche saisie par points d'inflexion (s depuis le
  carrefour, z, rayon R du raccordement parabolique, T = R·|Δg|/2), depuis la cote imposée du bord de l'anneau (ou de
  la principale) sur l'axe ; terrain naturel du MNT le long de l'axe projet (alignement, raccordement, axe saisi),
  déblai / remblai, pentes, graphique interactif (clic pour ajouter un PI, glisser pour le déplacer), proposition
  automatique depuis le TN, stations (TN, projet, écart, pente) en CSV, export DXF du profil (exagération verticale).
  La ligne rouge remplace la pente constante de la branche dans le modèle altimétrique (dévers, points d'implantation).
  Contrôles : chevauchement des raccordements, pente maximale et rayons minimaux (ARP catégorie R80 par défaut, valeurs
  urbaines usuelles — à confirmer selon la catégorie ; l'autoroute et les voies secondaires suivent leur catégorie de
  conception, voir « Catégories de conception »). Graphique des axes de l'échangeur : exagération verticale × 10 par
  défaut (z dix fois plus que s ; en échelle imposée, 1 px par mètre d'abscisse et défilement horizontal, « auto »
  ajuste le profil au panneau), ouvrages superposés — sur l'autoroute, gabarit au-dessus de la chaussée et intrados du
  tablier de chaque passage supérieur (rouge si le tirant d'air manque) ; sur la voie portée, tablier, piles, culées et
  gabarit de l'autoroute franchie ; cadres et buses sous la chaussée de leur axe (traverse, cellules, fil d'eau) —,
  bandeau du tracé en plan (diagramme des courbures, rayons) et bandeau des dévers gauche / droite (bascule sur les
  clothoïdes), pente ≤ 2 % sur les 20 derniers mètres (ACI), PI hors de l'axe.
- **Profils en travers** (onglet Profils travers) : coupes perpendiculaires à l'axe projet aux stations régulières
  (pas réglable) : plateforme issue du modèle (îlot séparateur ou TPC en saillie, voies avec leur dévers, BDD et berme
  en interurbain, caniveau, bordure, trottoir et contre-bordure en urbain — onglet Profil), talus de remblai (3/2) et
  de déblai (1/1) réglables, fossé triangulaire optionnel en déblai, terrain naturel du MNT sur la demi-largeur de
  coupe, surfaces de déblai / remblai par station et volumes cumulés (aires moyennes), graphique par station,
  export DXF en planches et CSV des cubatures.
- **Vue 3D** (bouton 3D) : terrain du MNT, anneau (profil type en révolution sur le modèle altimétrique), branches
  et route principale reconstruites par sections (voies avec dévers, îlots en saillie, BDD / berme ou caniveau,
  bordure, trottoir, talus jusqu'au TN), mâts et panneaux avec leurs pictogrammes ; vue orbitale et vue conducteur
  (branche et distance au choix, œil à 1,10 m), exagération verticale, terrain en fil de fer, export PNG et OBJ
  (coordonnées du projet). Rendu three.js (vendu dans `js/vendor`, licence MIT), sans serveur.
- **Échangeur** (onglet Échangeur) : section courante d'autoroute (ICTAAL 2015, maj 2021 : catégories L1 / L2, voies,
  BDG, BAU, bande médiane, PK), bretelles de sortie par déboîtement (Sd1 : biseau 150 / 110 / 90 m, point S.1,00 m,
  tpl, Lm = (tpl − 1) / p, musoir hachuré, balise J14 à S.5,00 m, D30 / D40 / D50 aux distances du tab. 4-2) et
  d'entrée en insertion (Ei1 : voie de 200 m + biseau de 75 m) ; axe des bretelles par sommets avec arcs et
  **clothoïdes** (paramètre A), surlargeur 50/R, dévers en 1/R ; contrôles du guide Cerema « Les échangeurs sur routes
  de type Autoroute » (2013, maj 2021) : rayons limites (tab. 3-1), premier rayon de sortie, enchaînement des courbes,
  alignements intermédiaires, longueur minimale de clothoïde, zones de décélération Ld et d'accélération La (§ 3.2.5,
  vitesses de l'annexe), obliquité. Placement d'une bretelle d'un clic sur la chaussée, sommets déplaçables.
  Chaque bretelle a deux extrémités, libres ou raccordées à l'autoroute ou à une autre bretelle (sortie depuis une
  bretelle, biseau 90 m à 5 %, § 4.3 ; entrée Eb11 sur bretelle, 100 + 75 m, § 5.3, avec les distances de 25 m).
  **Boucles** (sommet « boucle » : arc unique d'environ 270° encadré de clothoïdes, 40 à 60 m, § 3.2.1 ; sortie en
  boucle signalée comme exceptionnelle, collectrice ≥ 60 m au-delà du tpl, § 6.2.4). **Gabarit de trompette** : un clic au
  croisement de la route transversale (tige éventuellement biaise, jusqu'à 40°) ou sur l'axe à l'endroit de l'ouvrage ;
  la sortie semi-directe est construite d'abord (R2 saisi, R1 de sortie ≥ 100 m et < 2 R2) et fixe la tige et l'ouvrage,
  l'entrée en boucle (seule boucle) en est déduite, concentrique ; sortie et entrée directes raccordées à la tige
  bidirectionnelle. Un gabarit régénéré remplace le précédent au même croisement. La trompette est paramétrique : ses paramètres
  (R2 de la S-semi, TPC de la tige, écart, longueur de la tige) sont dans la fenêtre de la S-semi ; toute modification de
  ces paramètres, de la voie secondaire ou de l'axe de l'autoroute reconstruit le bloc entier ; sur le plan, seule
  l'extrémité de la tige se déplace. La boucle étant concentrique à la S-semi et tangente à la ligne d'obliquité de 3 %, la
  distance de la S-semi à l'autoroute n'est pas libre (1 m d'écart déplacerait E.1,00 de 33 m) : une configuration qui
  repousserait E.1,00 au-delà de 300 m est refusée et les derniers paramètres valides sont rétablis. La tige (et l'ouvrage) restent un bloc : séparation des deux voies constante
  (champ « TPC » de la tige, 1 m = voies accolées ; au-delà, terre-plein central dessiné et repris par la branche du giratoire). Les rayons saisis aux sommets des axes
  sont appliqués tels quels quand les tangentes tiennent (côtés partagés entre sommets voisins, plus petit rayon servi
  d'abord) ; sinon le rayon réduit est signalé. Surlargeur de 50/R par voie à l'intérieur des courbes de rayon
  < 100 m, introduite linéairement le long des clothoïdes (§ 3.4.2) ; rayons limites, dévers et vitesses contrôlés au
  bord intérieur de la chaussée (Ri = R axe − l/2, § 3.2.1). **Route transversale** (second axe : route ordinaire ou
  seconde autoroute) et **gabarits de trèfle** : un clic sur l'axe de l'autoroute au croisement crée l'axe transversal
  perpendiculaire et génère soit le *trèfle complet* (quatre boucles de 270° sur trois sommets en arc continu, Ri ≈ 54 m ;
  quatre bretelles directes à deux courbes reliées par un alignement à 45° qui contourne la boucle ; voies collectrices
  sur l'autoroute, et aussi sur la seconde autoroute pour un nœud, dont les boucles passent en branche 70 km/h,
  Ri ≥ 125 m, et les directes en 90 km/h), soit le *demi-trèfle* (de chaque côté, sortie directe enveloppant une boucle
  d'entrée de 180°, extrémités libres sur la route transversale pour le carrefour à étudier). Les nez sont placés hors des
  plates-formes croisées. Courbes composées (arc continu de rayons différents, rapport < 2) et **entrecroisements** (§ 7.3 :
  enchaînement E → S ≥ 1 200 m, entrecroisement 500–750 m, report sur collectrice, Z ≥ 275 m sur bretelle / collectrice)
  contrôlés. **Voie d'entrecroisement** (§ 3.4.3 : 3,50 m contiguë à la chaussée + BDD 1,00 m) dessinée de E.1,00 à
  S.1,00 quand une entrée est suivie d'une sortie rapprochée (insertion et biseau de sortie qui se rejoindraient, ou
  Z ≤ 750 m sur autoroute) ; musoirs superposés (S.1,00 en amont de E.1,00) signalés en erreur. Le gabarit de trèfle
  relève au besoin le rayon des boucles pour garder Z ≥ 0 sur chaque chaussée. **Cotations** des courbes de l'autoroute et
  de la route transversale (R, développement Lc, angle au centre Δ dans l'unité choisie, tangente T, repères TC / CT avec
  PK / PR, centres dans la liste des points ; longueur des alignements) et des arcs des bretelles (R, Ri, A, dévers,
  surlargeur, Lc, Δ) ; l'étiquette d'une courbe d'axe est déplacée hors du croisement.
- **Plusieurs carrefours** par projet (giratoires et carrefours plans nommés, onglet Projet) : tous sont dessinés et
  exportés ; les onglets portent sur le carrefour actif, qu'on choisit dans la liste ou d'un clic sur le plan.
- **Plusieurs échangeurs** le long de l'autoroute : une voie secondaire par échangeur (liste « Voies secondaires »,
  chacune nommée, route ordinaire ou autoroute). Les boutons Trompette, Trèfle, Demi-trèfle, Losange, Losange à
  giratoires, Demi-échangeur et Giratoire dénivelé demandent la voie secondaire : clic sur une voie existante au
  croisement, ou tracé d'une nouvelle voie (en partant de la voirie ordinaire pour une trompette) ; le gabarit est
  construit à son croisement avec l'autoroute.
- **Losange, demi-échangeur, giratoire dénivelé** (diffuseurs sur route ordinaire) : bretelles directes à deux courbes de
  sens contraires (divergent / convergent à 3 %, premier rayon de sortie 110 m au bord intérieur ≥ 100 m, seconde courbe
  60 m, R1 < 2 R2 et clothoïdes minimales, § 3.2.2–3.2.3), l'entrée étant le symétrique de la sortie ; bretelles nommées
  S1-X2, E2-X2… (sens, voie secondaire). *Losange* : quatre bretelles, extrémités libres à 25 m du bord de la route
  transversale (carrefours plans à compléter) ; *losange à giratoires* : deux giratoires créés dans la liste des
  carrefours, centrés sur la route transversale à la distance réglable de l'axe (auto : plate-forme + 100 m), la route
  transversale réduite au tronçon de l'ouvrage et prolongée par les branches des giratoires (le guide § 8 préfère le
  giratoire, qui dissuade les prises à contresens) ; *demi-échangeur* : une sortie et une entrée du même côté du
  croisement (côté origine ou fin de l'axe), avec giratoires ou extrémités libres ; *giratoire dénivelé* : anneau
  (Rg ≥ 60 m) centré sur le croisement et franchissant l'autoroute sur deux ouvrages, branches de la route transversale
  (qui est désactivée) et des quatre bretelles, raccordées à l'angle le plus faible laissant 15 m entre la plate-forme et
  l'axe de la branche. Les branches des bretelles se dessinent par le raccordement automatique ci-dessous ; un nouveau
  gabarit au même croisement remplace aussi les giratoires du précédent. Grands giratoires (Rg > 25 m, hors tableau
  ACI) : îlots séparateurs construits sur le triangle de Rg = 25 m.
- **Voie secondaire sinueuse** : le trèfle, le demi-trèfle et le losange à extrémités libres ne remplacent plus tout
  l'axe saisi par une droite ; seul le tronçon occupé par le gabarit (emprise des bretelles + 150 m, ou + 60 m pour le
  losange) est rendu rectiligne (perpendiculaire à l'autoroute pour le trèfle et le demi-trèfle, dans la direction du
  croisement pour le losange) et raccordé de part et d'autre au tracé saisi par une courbe (250 m sur route, Rdn
  au moins sur autoroute) ; le sens du tracé et les abscisses des raccordements sont conservés.
- **Trompette sur autoroute en courbe** : la S-semi est recalculée avec un alignement intermédiaire plus long si ses
  deux raccordements se chevauchent une fois le premier sommet reporté sur la ligne d'obliquité réelle ; les trompettes
  d'un projet ouvert sont recalculées dès l'ouverture.
- **Trompette sur autoroute en courbe (concentricité)** : le premier sommet de la S-semi est placé sur la ligne
  d'obliquité réelle et S.1,00 m déplacé pour garder l'alignement ≥ Lm, sans toucher la droite tangente à la grande
  courbe ; la boucle est déduite de la grande courbe réellement dessinée et tangente à l'obliquité réelle de son
  convergent : boucle et S-semi restent concentriques (plus de chevauchement). Le long de l'arc commun, les bords qui
  tomberaient dans l'autre plate-forme ne sont plus dessinés et un terre-plein sépare les deux voies, comme sur la tige.
- **Profils en long de l'échangeur** (onglet Profil en long, liste « Axe ») : autoroute, voies secondaires et bretelles,
  en plus des branches du carrefour. Points d'inflexion et raccordements paraboliques, proposition depuis le MNT.
  Extrémités des bretelles calées sur la chaussée hôte (cote de l'hôte au raccordement, dévers 2,5 % sur le décalage),
  sur la voie secondaire pour une extrémité libre (carrefour à compléter) ou sur la cote zC du giratoire. Contrôles :
  pente maximale et rayons saillants / rentrants de la catégorie (ICTAAL, guide des échangeurs, ARP). Tirant d'air
  sous chaque passage supérieur (voie portée − tablier − autoroute ≥ gabarit) dans la fiche de l'ouvrage, avec un
  bouton qui relève la voie portée au gabarit (sommet placé au droit de l'ouvrage, voisins dégagés, rayon adapté).
- **Profils types, dévers, coupes et cubatures des axes de l'échangeur** (onglet Profils en travers, liste « Axe ») :
  coupes aux profils implantés sur l'autoroute, les voies secondaires et les bretelles. Profil type tiré des
  paramètres de chaque axe (TPC, BDG, voies, BAU/BDD, bermes ; bretelle : voie, BDG, BDD) ; dévers d'alignement
  (2,5 % par défaut, en toit ou unique pour une bretelle) et, en courbe de rayon < Rdn, plate-forme déversée vers
  l'intérieur de 2,5 à 7 % (linéaire en 1/R, guide des échangeurs § 3.5 ; route ordinaire : Rdn ≈ 900 m, Rm ≈ 240 m,
  ordre de grandeur à ajuster) ; bermes à 8 % ; talus et fossé de l'onglet. Épaisseur de chaussée : cubatures au fond
  de forme. Volumes par la méthode des aires moyennes, récapitulatif par axe, exports DXF et CSV.
- **Hydrologie et hydraulique (onglet Hydrologie, moteur de BVTrace porté en JavaScript, js/hydro/)** :
  - bassins versants dont l'écoulement coupe les axes cochés (autoroute, voies secondaires, bretelles, branches), sur
    un MNT SRTM élargi autour des axes (marge doublée automatiquement tant qu'un bassin touche le bord, jusqu'à 24 km)
    ou sur le MNT du projet : Priority-Flood + ε, D8, rasterisation 4-connexe des tracés, partition sans vide aux PK
    médians ; chaque bassin est la partition de son franchissement (tout le versant qui se déverse sur sa section de tracé) : bassins arrêtés au tracé, jointifs, sans aucun vide entre eux ni le long du tracé ; écoulements fléchés de l'amont vers l'aval et l'utilisateur désigne, comme dans BVTrace, les bassins amont dont l'écoulement passe par l'ouvrage (colonne « Bassins amont » : leurs débits s'ajoutent ; l'amont hydrologique détecté est proposé) ; morphométrie (L, dénivelée, Ieq, Hmoy, ΔH…) ;
  - débits : jeu tunisien (rationnelle avec station Montana — la plus proche par défaut —, abaque C selon le couvert
    végétal, SOGREAH, Ghorbel, Kallel, Fersi, Frigui, Francou-Rodier, note DGPC 1054) ou FAO 54 (CIEH, Orstom),
    temps de concentration Kirpich, Ventura, Passini, Giandotti (une formule retenue et affichée) ;
  - dimensionnement des dalots ou des buses (contrôle à l'entrée HDS-5 et par l'aval, abaques BCEOM, vitesses, taux
    de remplissage, HW admissible déduit de la cote de chaussée du profil en long et de la revanche) ;
  - ouvrages modifiables : dans la fiche du bassin (type, nombre, B, H ou Ø, orientation), « Placer / Mettre à jour
    l'ouvrage » ; un ouvrage placé n'est plus redimensionné mais vérifié (HW, vitesse ≤ 3 m/s, revanche : ✔ / ✖) ;
    « Revenir à la proposition » ; sur le plan, poignées de rotation (orientation 20 à 180 gr, 100 = droit, biais
    ψ = min(angle, 200 − angle)), de déplacement le long de l'axe et de longueur ;
  - un clic sur un ouvrage du plan (tablier, cadre, buse) le met en surbrillance et ouvre sa fiche modifiable dans une
    fenêtre (bouton Supprimer pour un cadre) ;
  - « Créer les ouvrages sur le plan » : un PICF (ou une buse) par franchissement, biais tiré de la direction de
    l'écoulement, remblai sur traverse tiré du profil en long ; numérotation OA, export PSIDA des dalots ;
  - tests : `node tools/test-watershed.mjs`, `node tools/test-hydrology.mjs`, `node tools/test-culvert.mjs`.
- **Ouvrages numérotés** : passages supérieurs, tiges, anneaux de giratoire dénivelé et cadres sont numérotés OA1, OA2…
  dans l'ordre des abscisses de l'autoroute (numéro cerclé sur le plan) ; le nom de chaque ouvrage se modifie dans
  l'onglet Ouvrages. **+ Passage supérieur** : dessinez une voie secondaire qui franchit l'autoroute, l'ouvrage est
  implanté à leur croisement (autant de passages supérieurs que de voies).
- **Cadres PICF et portiques PIPO** (onglet Ouvrages, **+ PICF / PIPO**, un clic sur l'axe de la voie portée) : nombre
  de cellules, ouverture, hauteur intérieure, remblai sur traverse, biais (gr), longueur (automatique : plate-forme +
  talus 3/2 jusqu'à la traverse, divisée par le sinus du biais), épaisseurs (automatiques e ≈ 0,15 + B/20), murs en aile.
  Dessin en plan : têtes parallèles à la voie portée, faces cachées en tirets, semelles du PIPO, murs en aile, axe.
  « Ouvrir dans PSIDA » remplit l'onglet Cadres et portiques de PSIDA (champs cf_*) ; export du projet PSIDA (.json).
- **Profils en travers** (onglet Implantation) : en série entre deux points cliqués sur un même axe (autoroute, voie
  secondaire, bretelle, branche) au pas choisi, avec en option les points de tangence compris entre eux (droite /
  clothoïde / arc ; un point de tangence à moins de 0,50 m d'une station la remplace), ou profils isolés placés à la
  main. Symbole à la manière de Macao : petit cercle sur l'axe et segment perpendiculaire, numéro P1, P2… par axe
  (calque GIRA_PROFILS). Tableau (axe, abscisse, X, Y, gisement de la normale, origine) et export CSV.
- **Aucune chaussée superposée hors ouvrage** : deux plates-formes (chaussée et accotements revêtus) ne se croisent
  qu'au droit d'un ouvrage. Chaque bretelle est contrôlée tous les 2 m contre l'autoroute, les voies secondaires et les
  autres bretelles ; un recouvrement de plates-formes hors tablier est une erreur. Sont exclus les zones de raccordement
  à la chaussée hôte (biseau, Lm, insertion), les deux voies accolées d'une trompette, les abords des giratoires et les
  extrémités voisines de deux bretelles aboutissant au même carrefour plan.
- **Tangence imposée à l'arrivée sur un giratoire** : une bretelle qui débouche sur un giratoire doit y arriver par un
  alignement droit (≥ 5 m) dans l'axe de sa branche. Un déplacement de sommet qui casserait cette tangence (ou ferait
  chevaucher ses raccordements) est refusé : la bretelle reste à sa dernière position correcte et rien d'autre n'est
  redessiné.
- **Trèfle sur autoroute en courbe** : le gabarit est posé dans un repère qui suit l'axe de l'autoroute ; les
  collectrices épousent la courbe (sommets intermédiaires) et, si une boucle ne tient plus entre ses sommets, ses côtés
  sont allongés de quelques mètres (contrôle par un calcul d'essai).
- **Tablier de la tige** : son axe et sa largeur suivent les deux voies de la tige (S-semi et boucle) ; un tablier
  allongé suit les bretelles là où elles s'écartent ; l'axe réel des voies secondaires est suivi sur ± 400 m.
- **Onglet Ouvrages** : réglages communs (tirant d'air, piles, dispositifs de retenue et classes W, travure), liste des
  ouvrages et travure modifiable de chacun : travées le long de l'axe (centrées sur le croisement, décalage possible),
  ajout / suppression d'une travée, épaisseur imposée, retour à l'implantation automatique ; le dessin, la fiche et les
  contrôles suivent (pile dans la chaussée ou dans la largeur de fonctionnement d'un dispositif de retenue : erreur ;
  talus de culée qui l'empiète : alerte). **Export vers PSIDA** : bouton « Ouvrir dans PSIDA » (lien
  psida.ksr-infra.org/#conception avec travure, largeur, épaisseur, type de dalle, biais, tirant d'air, béton, abouts,
  chaussée, superstructures, piles voiles et culées noyées) et fichier projet PSIDA (.json) à ouvrir dans PSIDA.
  **Ouvrage courbe** (voie secondaire en courbe, anneau d'un giratoire dénivelé, tige de trompette qui s'incurve) :
  le lien remplit aussi le « Tracé en plan (ouvrage courbe) » de PSIDA, comme son import DXF — axe en droites, arcs
  et clothoïdes (exact pour une voie secondaire ou un anneau, reconstitué par le diagramme des courbures pour une
  tige, `js/clofit.js` repris de PSIDA), abscisses des lignes d'appui et biais propre à chaque ligne (lignes parallèles
  à l'autoroute, `js/psidatrace.js`) ; travure le long de l'axe et tablier calculé en plaque.
- **Triangle de zébrage** des divergents et convergents : la rive de la chaussée et la rive gauche de la bretelle sont
  prolongées au-delà de S.1,00 / E.1,00 jusqu'à leur rencontre (1/p, soit 33 m à 3 %), la ligne T2 s'y arrête.
- **Axe de l'autoroute trop court pour un gabarit** : il est prolongé en ligne droite à ses extrémités (emprise des
  biseaux et insertions + 50 m), les abscisses des raccordements existants et le PK origine sont décalés (PK
  inchangés) ; un point S.1,00 / E.1,00 hors de l'axe est signalé en erreur (auparavant ramené en bout d'axe, d'où des
  bretelles aberrantes).
- **Voie secondaire d'une trompette** : elle s'arrête côté boucle à 30 m au-delà de la plate-forme de l'autoroute (la
  tige ne se prolonge pas au-delà de la boucle) et n'est dessinée qu'au-delà de l'extrémité de la tige (ou du giratoire
  où la tige se raccorde) : la tige et l'ouvrage la remplacent entre les deux.
- **Biais de la voie secondaire** : le losange, le losange à giratoires, le demi-échangeur et le giratoire dénivelé
  gardent la direction de la voie secondaire au croisement (jusqu'à 50 gr) ; giratoires centrés sur l'axe biais, sortie
  et entrée d'un même côté calculées séparément (côté angle aigu plus long), branches de l'anneau du giratoire dénivelé
  à 30° au moins des branches de la voie secondaire (rayon relevé automatiquement si nécessaire). Le trèfle et le
  demi-trèfle redressent encore l'axe perpendiculairement à l'autoroute.
- **Ouvrages (passages supérieurs)** : pour chaque voie secondaire qui croise l'autoroute, la tige d'une trompette et
  les deux franchissements de l'anneau d'un giratoire dénivelé : lignes d'appui parallèles à l'autoroute (biais
  géométrique ψ), portées le long de l'axe ; piles de rive au-delà de la BAU, du dispositif de retenue (face à une
  distance réglable du bord de la BAU) et de sa largeur de fonctionnement W (NF EN 1317-2, W1 à W8, W4 par défaut) ;
  pile centrale dans le TPC si la bande médiane atteint 3 m et que la pile tient entre les largeurs de fonctionnement
  (W2 par défaut), sinon 3 travées ; culées en tête du talus 3/2 (hauteur = tirant d'air + 0,20 m) dont le pied passe
  derrière la pile de rive, ligne d'appui à 0,50 m de la crête, quarts de cône aux angles, culée reculée si la travée
  de rive est inférieure à 0,5 (0,6 en biais prononcé) fois la travée voisine. Travure, épaisseur (abaques PSI-DA /
  PSI-DP), domaine d'emploi, rapports de travées, biais mécanique, coupe transversale, ouvertures et longueur d'about
  vérifiés par les règles reprises du dépôt PSIDA (`js/psida.js`, guide SETRA « Ponts-dalles » 1989) ; fiche par
  ouvrage dans l'onglet Échangeur, alertes dans les contrôles, calques Ouvrages / Dispositifs de retenue / Talus
  exportés en DXF.
- **Raccordement bretelle → giratoire** : une bretelle dont l'extrémité libre est placée dans l'anneau d'un giratoire du
  projet (actif ou non) dessine automatiquement une branche de ce giratoire dans l'axe de son dernier côté ; deux
  bretelles de sens contraires aux extrémités voisines (tige d'une trompette) forment une seule branche à double sens.
  La bretelle s'arrête au bout de la branche (60 m au-delà de l'anneau) ; la branche suit les déplacements ; la supprimer
  détache la bretelle (rattachée de nouveau si son extrémité est déplacée).
- **Sélection sur le plan** : chaque élément (giratoire ou carrefour, branche, bretelle, autoroute, route transversale)
  se met en surbrillance au survol ; un clic ouvre sa fenêtre (tous ses paramètres, modifiables, et un bouton Supprimer
  en tête ; Échap ferme, Suppr supprime, fenêtre déplaçable par son en-tête).
- **Exports** : DXF R12 par calques `GIRA_*` (AutoCAD, Covadis, BricsCAD…), PNG, points d'implantation X, Y, Z en CSV,
  projet `.gira.json` (et sauvegarde automatique dans le navigateur).

## Structure

```
index.html          page de l'application
css/app.css         styles
js/main.js          état, outils, panneaux, imports / exports
js/roundabout.js    construction géométrique du giratoire
js/plan.js          carrefours plans en T et en X
js/approach.js      construction d'une branche (bords, raccordements, îlot), commune aux deux
js/common.js        outils partagés (centre automatique, repères, formats)
js/norms.js         valeurs par défaut et contrôles SETRA / CERTU
js/devers.js        modèle altimétrique et dévers
js/capacity.js      trafic HPM et capacité des entrées (modèle de type Girabase)
js/capacity-plan.js capacité des carrefours plans à priorité (T, X)
js/bypass.js        voie directe de tourne-à-droite (by-pass)
js/dims.js          cotations de type DAO
js/crossing.js      passages piétons, abaissés de trottoir et bandes d'éveil de vigilance
js/swept.js         épures de giration (semi-remorque)
js/profile.js       profil en travers type de l'anneau (SVG, DXF)
js/viewer.js        rendu canvas (projet, DXF, HUD)
js/geom.js          géométrie (droites, arcs, raccordements, décalages)
js/clotho.js        alignements en plan avec clothoïdes (raccordements progressifs)
js/roadcat.js       catégories de conception (ARP, ICTAAL, VSA, AU70), dévers, clothoïdes, contrôles (BVTrace)
js/echangeur.js     échangeur : section courante, bretelles, divergents / convergents, contrôles
js/dxf-parse.js     lecture DXF        js/dxf-write.js   écriture DXF R12
js/crs.js           systèmes de coordonnées   js/tiles.js   fonds en tuiles
serve.ps1           serveur local de test (Windows, sans Node ni Python)
tools/version.sh    estampille les URL des JS / CSS dans index.html (à lancer avant chaque commit)
```

## Tester en local

Les modules JavaScript ne se chargent pas depuis `file://`. Lancer le petit serveur fourni :

```
powershell -ExecutionPolicy Bypass -File serve.ps1
```

puis ouvrir http://localhost:8765/.

## Mise en ligne

Site public : **https://carr.ksr-infra.org/** — Cloudflare Pages, projet `carr` relié à ce dépôt : chaque poussée
sur `main` est déployée automatiquement (adresse technique : carr-7z1.pages.dev).

Le domaine ksr-infra.org applique un cache navigateur de 4 h aux fichiers `.js` et `.css` (réglage Cloudflare
« Browser Cache TTL »). Pour que chaque mise en ligne soit prise tout de suite, `index.html` (non mis en cache) charge
les modules par une *import map* avec une empreinte `?v=` : lancer `bash tools/version.sh` avant chaque commit qui
modifie `js/` ou `css/`. On peut aussi régler « Browser Cache TTL » sur « Respect Existing Headers ».

Pour un autre hébergement :

1. Copier tout le dossier (sauf `serve.ps1` et `.claude/`) à la racine du sous-domaine, en HTTPS.
2. Le serveur doit servir les `.js` avec le type `text/javascript` (cas par défaut d'Apache / Nginx / hébergements mutualisés).
3. proj4js est chargé depuis cdnjs ; pour ne dépendre d'aucun CDN, copier `proj4.js` (2.11.0) dans `js/vendor/` et adapter la balise `<script>`.
4. Conditions d'usage des services externes :
   - **Esri World Imagery** : attribution affichée ; pour un usage public soutenu, prévoir une clé ArcGIS (offre gratuite) ou un autre fournisseur.
   - **Tuiles terrain Terrarium** (s3.amazonaws.com/elevation-tiles-prod, AWS Open Data) : données SRTM / GMTED / ETOPO1 du domaine public, servies sans clé ; précision verticale de quelques mètres.
   - **tile.openstreetmap.org** et **Nominatim** : politiques d'usage strictes (pas d'usage intensif, 1 requête/s pour Nominatim). Pour un site public, prévoir un fournisseur de tuiles et de géocodage avec clé (MapTiler, Stadia, Geoapify…).

## Sources des valeurs et points à confirmer

Valeurs recoupées sur l'ACI (SETRA 1998), la fiche CERTU « Giratoires urbains », le guide CERTU « Les mini-giratoires » (1997),
IDRRIM (2015) et des supports de cours qui reprennent les tableaux SETRA. À vérifier sur les guides originaux :

- le sens du **décalage du triangle de construction** (« vers la gauche », (0,5 + Rg/50)/2 pour Rg > 15 m) : appliqué à gauche de l'usager entrant, réglable par branche ;
- le rôle exact du **rayon de raccordement Rr = 4·Rg** : utilisé ici pour adoucir les changements de direction des bordures en amont ;
- la convention de mesure de **le** : la largeur saisie est mesurée entre îlot et bordure le long de l'îlot ; la largeur réelle au droit de l'anneau (plus grande, à cause du rayon Re) est affichée pour chaque branche ;
- le dévers courant des voies (2,5 % en urbain comme en interurbain) et le recul de la tête d'îlot (0,50 m) sont des valeurs usuelles, non tirées du guide ;
- la **déflexion** est estimée par la méthode des trois points (cercle passant à 2 m des bordures et à 1,50 m de l'îlot central) : c'est une approximation de l'épure.

Pour les carrefours plans :

- îlot de la branche secondaire (ACI Fig. 25) : chaque cercle de giration est pris tangent au côté correspondant du
  triangle et au bord de voie de la principale qu'il longe (bord gauche de la TAG pour Ris, des voies directes opposées
  pour Rie) ; les conditions exactes de placement ne sont pas écrites dans le guide (écart possible d'environ 1 m sur
  la pointe). Les raccordements Rre / Rrs sont tangents au cercle de giration et à l'axe de la secondaire. Le GCU ne
  donnant pas de construction d'îlot, la même construction est appliquée en urbain ;
- l'îlot central en saillie est dessiné à 0,30 m (5u) en retrait de l'enveloppe peinte, biseau compris (nez arrondi là
  où il ne reste qu'1 m de large), et seulement si a ≥ 1,20 m ;
- en urbain, le GCU (2010, §7.3.4) donne 6 à 8 m (8 à 12 m en périurbain avec PL) et renvoie à l'épure de giration :
  la valeur par défaut de 8 m est à vérifier ; aucune épure de giration PL n'est tracée par l'application ;
- le raccordement du dévers de la secondaire sur le bord de la principale n'est pas décrit par l'ACI (modèle de principe).

L'altimétrie est un modèle de principe (avant-projet) : elle ne remplace pas un calcul de profils sur MNT.

### Signalisation verticale

Règles d'implantation reprises de SETRA, « L'équipement des routes interurbaines » (1998), vol. 2 ch. 2.11 (carrefours
plans et giratoires des routes de type R), vol. 1 ch. 2 § 2.7 (hauteur sous panneau 1 à 2,30 m, recul 0,70 m) et ch. 7
(balises J5) ; de l'ACI/P (ch. 2 § 4.1 et ch. 3 § 4.1 : distances AB25, B21-1, AB2, J5) ; du CERTU, « Carrefours
urbains » (2010) § 7.5, 8.5 et 9.6 (A25 à 10–50 m, B21-1, B21a1 / J5, D42b optionnel, D21, feux et priorité à droite) ;
de l'IISR Livre I, 1re partie (hauteur jusqu'à 2,30 m en agglomération, gammes). Les dimensions des panneaux par gamme
sont celles de la NF P 98-531 pour les triangles et les disques ; celles des AB4, AB6 et J5 sont usuelles (à confirmer).
Points à vérifier : distances de la signalisation de direction (D40 / D60) pour des vitesses autres que 75–90 km/h
(circulaire 82-31) ; la position exacte du B21-1 dépend de la déflexion de l'entrée ; aucun panneau B1 (branches à sens
unique) ni A17 (feux) n'est dessiné.

### Catégories de conception (autoroute et voies secondaires)

Règles reprises de BVTrace (`js/roadcat.js`, même source que BVTrace.Core/RoadDesignTables, RoadDesignGeometry et
RoadDesignChecks) : ARP 2022 R1 / R2 / artère 110 (tab. 10 et 11), ICTAAL 2021 L1 / L2 (tab. 3-1, § 4.6), VSA 90 / 110
(Cerema 2014, chap. 2), AU70 (Certu 2013, § 2.2, sans clothoïde ni dévers) et conception libre ; rayons saillants du
guide Visibilité Cerema 2018. L'autoroute suit sa catégorie ICTAAL ; une voie secondaire « route ordinaire » reçoit une
catégorie de conception (R1 par défaut). Tracé en plan : clothoïdes symétriques posées automatiquement aux sommets de
rayon < 1,5 Rdn, à la longueur minimale de la catégorie — ARP max(2·l·|Δd| ; 6 R^0,4 à 2 voies, 12 R^0,4 sinon),
ICTAAL max(14 |Δd| ; R/9), VSA max(R/9 ; 2·l·|Δd|), Δd = dévers de l'arc − dévers normal (convention BVTrace) — ou
paramètre A saisi au sommet (0 : sans clothoïde), raccourcies avec alerte faute de place ; repères TS / SC / CS / ST.
Contrôles : Rm, longueur des clothoïdes, progressivité 0,67 < R/R' < 1,5 (courbes à moins de 500 m), largeur de voie et
BDD / BAU. Profil en long : pente maximale (6–7 % en R2 : à justifier), rayons saillants / rentrants, coordination
Rv ≥ 6 Rh sous une courbe de rayon < 1 500 m, entrée de courbe à moins de 50 m d'un point haut, pente résultante ≥ 1 %
(0,5 % avec dispositions) là où le dévers s'annule. Dévers : toit au dévers normal (2,5 %) en alignement et pour
R ≥ Rdn ; pour R < Rdn, plate-forme déversée vers l'intérieur, linéaire en 1/R de 2,5 % à Rdn à 7 % à Rm ; variation
linéaire sur la clothoïde (côté extérieur de −2,5 % à +d, côté intérieur de −2,5 % à −d), jamais sur l'arc.
Points à confirmer : définition de Δd (BVTrace retient d(R) − 2,5 %, le basculement du côté extérieur va de −2,5 % à
+d) ; option de dévers maximal 5 % (Rm recalculé) non proposée ; règles d'enchaînement en alerte (alignements,
séparation 3 s à V85, partie circulaire ≥ 1/5) non encore contrôlées.

### Échangeurs

Cerema, « Les échangeurs sur routes de type Autoroute », éd. 2013, version corrigée mai 2015, mise à jour 2021 :
tab. 3-1 (Rdn, Rm), § 3.2.2 (enchaînement : R1 ≤ 1,5 R2 pour les branches, R1 < 2 R2 pour les bretelles ; 1er rayon
≥ 1,5 Rdn ou 100 m), § 3.2.3 (clothoïde ≥ max(6 R^0,4 ; 7 |Δd|) à une voie, max(R/9 ; 14 |Δd|) à deux voies),
§ 3.2.5 (Ld = (Vs² − VR²) / 2(1,5 + 10 p), La = (VE² − VR²) / 2(1 − 10 p), Vs = 70 km/h, VE = 55 km/h), tab. 3-2
(profil en long), § 3.4.2 (bretelle : BDD 1,00 / 3,50 / BDG 0,50 ; surlargeur 50/R si R < 100 m), § 3.5 (dévers),
§ 4.1.3.1 (biseau), schéma 5-1 (insertion 200 + 75 m), § 6.1 (tpl, obliquité, Lm), tab. 4-2 (d3, d2), annexe tab. 12-1
(vitesse associée au rayon), § 6.2.4 (boucle en sortie), § 7.3 (enchaînements et entrecroisements). ICTAAL 2015 maj 2021 : tab. 3-1 et 3-2 (section courante), § 4.1 (profil en travers).
Largeur au tpl par défaut : BAU + 2,00 m (emprise de la balise J14, déduite du schéma 6-1) + BDG portée à 0,70 m
(note 9), soit 5,20 m avec une BAU de 2,50 m comme dans le schéma 6-1. Traitement de la BAU : absorbée le long du biseau
de déboîtement (bord de plate-forme = max(BAU ; rive de la bretelle + BDD)), interrompue et couverte par la zone
hachurée de S.1,00 m au tpl, rétablie après le nez (schémas 4-1, 6-1, 6-2) ; en entrée, reportée à l'extérieur de la
voie d'insertion (raccord de principe sur 50 m depuis la BDD de la bretelle), puis le long du biseau de rabattement.
Points à confirmer : l'obliquité d'une sortie en déboîtement est prise égale à 4,50 m / biseau ; la balise J14 est
placée sur le nez du musoir (le guide la considère au point S.5,00 m pour la visibilité, § 2.3.1).

### Capacité

Le calcul reprend les formules du logiciel **Girabase 4** (Cerema), d'après son manuel
(publications.cerema.fr, « Girabase 4 ») et son code source publié sous GPL-3.0
(github.com/CEREMA/territoires-ville.Girabase). C'est une réimplémentation indépendante des formules, pas une copie
du code. Elle n'est pas homologuée : comparer les résultats avec Girabase avant tout usage réglementaire.

- Capacité : C = (3600/Tf)·exp(−Qg/3600·(Tg − Tf/2)) · (LEG/3,5)^Te · (1 − Cp), avec Tg / Tf / Te selon le milieu
  (rase campagne 4,75 / 2,25 / 0,70 ; périurbain 4,55 / 2,05 / 0,80 ; urbain 4,40 / 1,80 / 0,85) et Tf × 1,35 si l'entrée
  monte de plus de 3 %.
- Trafic gênant : Qg = KE·QTE + KI·QTI + KS·Qs·(1 − Qs/(Qc + Qs)), le trafic de l'anneau étant réparti entre extérieur et
  intérieur selon l'angle de sortie des flux.
- Géométrie prise sur le plan : rayon de l'îlot infranchissable, bande franchissable, largeur d'anneau, largeur d'entrée
  à 4 m et 15 m, largeur d'îlot séparateur, largeur de sortie, nombre de voies d'entrée.
- Non repris : deux-roues (0,5 uvp), option « saturer la branche ».

Carrefours plans à priorité : l'ACI renvoie au logiciel OCTAVE (simulation) et le CERTU à un abaque du « créneau
critique », sans formule publiée. Le calcul applique donc la méthode d'acceptation de créneaux de Brilon (HBS) dans la
structure de l'HCM, d'après Troutbeck & Brilon, *Traffic Flow Theory*, chap. 8 (FHWA) :

- rangs : 1 = TD et TAD de la principale (non limités) ; 2 = TAG de la principale et TAD des secondaires ;
  3 = traversées (X) ou TAG secondaire (T) ; 4 = TAG secondaires (X) ;
- trafic conflictuel q_p du tableau 8.2 (Brilon) ; flux de la secondaire opposée divisés par 2 au STOP ;
- capacité de base de Siegloch C = 3600/tf · exp(−q_p/3600 · (tg − tf/2)), multipliée par les probabilités d'absence
  de file des rangs supérieurs (correction de dépendance au rang 4) ; sans voie de TAG, probabilité corrigée p0* ;
- tg / tf : valeurs de base de l'HCM, modifiables (TAG principale 4,1 / 2,2 ; TAD secondaire 6,2 / 3,3 ; traversée
  6,5 / 4,0 ; TAG secondaire 7,1 / 3,5, réduit de 0,7 s en T), en uvp/h. Les valeurs de l'HBS propres au STOP et au
  cédez-le-passage n'ont pas pu être vérifiées ;
- attente moyenne HBS 2015 (T = 1 h), niveaux A à F ; file à 95 % de l'HCM (T = 0,25 h) ; stockage de TAG de
  l'ACI (7 + 10p)·N avec N pris égal à la file à 95 %.

## Limites connues

- Échangeur : seules les sorties en déboîtement et les entrées en insertion à une voie sont dessinées (pas
  d'affectation Sa, d'adjonction Ea / Eb21 ni d'entrecroisement) ; la trompette, le trèfle, le demi-trèfle, les losanges, le demi-échangeur et le giratoire dénivelé sont des gabarits de principe
  (rayons, emprise de l'ordre de 1,5 km le long de l'autoroute) à ajuster ; avec des boucles de 40 à 60 m, l'entrecroisement
  entre deux boucles successives sur la collectrice reste très inférieur aux 275 m du § 7.3.3 (il est signalé), et sur
  une route ordinaire (tpl 4,70 m, Lm 74 m) les boucles passent à Ri ≈ 66 m pour que les musoirs ne se chevauchent pas ;
  les carrefours aux
  extrémités du demi-trèfle et du losange simple ne sont pas générés ; le biais de la voie secondaire n'est pas traité pour le trèfle et le demi-trèfle (axe redressé) ; les ouvrages sont dessinés en plan seulement (pas d'élévation ni de calcul de structure : voir PSIDA) ; la section courante est tracée en droites et arcs (sans
  clothoïdes) ; les bretelles n'ont pas encore de profil en long ni de profils en travers, ni de vue 3D, et leur
  extrémité n'est pas encore raccordée automatiquement au giratoire (branche à sens unique) : l'axe se termine sur la
  branche dessinée.

- Les largeurs par défaut de BDD (1,00 m), BDG (0,50 m) et berme (1,50 m) en interurbain sont des valeurs de départ
  à ajuster dans l'onglet Profil ; elles ne sont pas tirées du guide.
- Carrefours en T et en X : abords (trottoirs, berme) et îlots dessinés ; la BDD n'est pas encore appliquée. Les
  branches secondaires suivent un axe courbe ; la route principale reste droite (zones de TAG en alignement).
- Voie directe de tourne-à-droite : rayon et largeur réglables ; largeur d'îlot et longueurs fixées (ACI, réduites en urbain) ;
  la clothoïde d'entrée et la variante « réinsertion avec cédez-le-passage » ne sont pas dessinées.
- Capacité des carrefours plans : piétons, traversée en deux temps et pente des secondaires non pris en compte.
