# INFRA-KSR (ex-GIRA) — conception routière : tracés, carrefours, giratoires, échangeurs

L'application s'appelait GIRA ; elle a été renommée INFRA-KSR quand elle a dépassé les seuls giratoires (tracés en
plan, carrefours plans, échangeurs, ouvrages, hydrologie, vitesses). Les projets enregistrés sous GIRA (`.gira.json`,
`app: "GIRA"`) s'ouvrent toujours ; les nouveaux sont enregistrés en `.ksr.json` (`app: "INFRA-KSR"`). Les calques DXF
gardent leur préfixe `GIRA_` (gabarits CAO existants).

Application web statique (HTML + JavaScript, sans serveur applicatif) pour dessiner à l'échelle un carrefour giratoire,
un carrefour en T ou un carrefour en X (croix) selon le SETRA (ACI, interurbain) ou le CERTU (urbain), sur fond satellite
ou sur un fond topographique DXF.

## Fonctions (version 1)

- **Ordre des onglets** : Projet, Tracé, Terrain, Dévers, Profil long, Profils travers, Implantation, Carrefours plans (anneau du
  giratoire ou carrefour en T / X ; ex-« Anneau »), Branches, Profil, PSGR, Visibilité, Contrôles, Capacité, Échangeur,
  Ouvrages, Signalisation, Hydrologie, Vitesses / UVR, Chaussées. Les onglets forment une **barre de menu en haut**, sur
  toute la largeur sous l'en-tête (une ligne sur un écran large, deux à 1280 px ; sur téléphone, barre collée en haut
  qui défile au doigt, et un onglet choisi fait descendre au panneau) ; leur contenu s'affiche dans le panneau de droite.
- **Onglet Projet** : ce qui vaut pour tout le projet — nom, contenu (axes du tracé, carrefours, bretelles, avec liens
  vers leurs onglets), système de coordonnées, fond de plan, fond DXF, calques KMZ, affichage. La liste des carrefours,
  le type et le contexte (interurbain / urbain) du carrefour actif sont en tête de l'onglet **Carrefours plans**.
- **Onglet Contrôles** : chaque contrôle localisable porte son **PK et son axe** (lus dans le contrôle, dans le message —
  « 1+234 », « s = 123 m », « PI 3 », sommet — ou par projection du point en cause sur l'axe le plus proche) ; un clic
  cadre le plan sur le point (ou sur l'axe entier pour un contrôle d'ensemble, sur l'ouvrage nommé, sur le centre du
  carrefour à défaut) et le marque d'un repère rouge clignotant.
- **Onglet Tracé** (deuxième onglet) : axes de la voie principale (autoroute ICTAAL ou route non autoroutière,
  catégorie de conception, vitesse, profil en travers, PK origine) et des voies secondaires — dessin, import KMZ / KML,
  tableau des sommets (X, Y, R, clothoïdes, rayon appliqué), raccordement aux carrefours et croisements. L'onglet
  **Échangeur** reprend ces axes dans une liste « Voies de l'échangeur » où l'on choisit le rôle de chacun (voie
  principale franchie / voie secondaire) ; ses boutons « + Voie principale » et « + Voie secondaire » dessinent toujours
  un nouvel axe, qui apparaît aussi dans Tracé. Les paramètres des gabarits (trompette, losange, demi-échangeur,
  giratoire dénivelé) restent dans l'onglet Échangeur.

- **Vue CAD en mètres** : zoom au curseur, panoramique, accrochage aux sommets (F3), ortho (F8), grille (F7),
  ligne de commande (`x,y`, `@dx,dy`, `@d<angle`, distance directe), annuler / rétablir.
- **Systèmes de coordonnées** : UTM WGS84 (fuseau automatique), Nord / Sud Tunisie (Carthage), Nord Maroc,
  Lambert-93, ou toute définition proj4. Les coordonnées du projet sont celles du système choisi : un DXF topo
  dans le même système se superpose à l'imagerie. Changer de système reprojette les axes.
  Les tuiles d'imagerie (Web Mercator) sont reprojetées par morceaux : une tuile peu zoomée, que la projection du
  projet déforme, est recoupée jusqu'à un écart de moins d'un pixel (plus de triangles vides entre tuiles en vue large).
- **Fonds** : Esri World Imagery (jusqu'au niveau 21 ; là où l'imagerie manque, la tuile du niveau inférieur est
  agrandie au lieu de « Map data not yet available »), OpenStreetMap, Esri Topo ; recherche de lieu (Nominatim)
  ou saisie « lat, lon ».
- **Import DXF ASCII** : LINE, LWPOLYLINE / POLYLINE (arcs), ARC, CIRCLE, ELLIPSE, SPLINE, TEXT, MTEXT, POINT,
  INSERT (blocs, attributs), DIMENSION, HATCH (contours polylignes et arêtes ligne / arc / ellipse / spline, trous :
  aplat semi-transparent sous les traits, repris en gris sur les planches du tracé combiné ; `node tools/test-hatch.mjs`) ;
  calques avec couleurs, unités m / cm / mm.
- **Contrôle d'emprise** (onglet Projet, fond DXF ; `js/emprise.js`) : calque protégé au choix (le calque de bâti
  hachuré, « Bati… », est proposé à l'import). Le long de chaque bordure du projet et des autres carrefours, trottoir
  disponible = distance au calque − caniveau − bordure : rouge sous le minimum (1,50 m par défaut), orange sous le
  trottoir du profil (2,50 m), bordure dans un contour fermé du calque signalée ; tronçons surlignés sur le plan, cote
  du point le plus défavorable, messages groupés par branche ou raccordement dans l'onglet Contrôles (clic : vue
  centrée). Interurbain : la berme doit rester hors du calque. Trottoirs (et bermes) coupés au bâti : largeur
  réduite à la place disponible devant la façade, contre-bordure supprimée là où le trottoir est réduit, jamais de
  trottoir dessiné dans le bâti. `node tools/test-emprise.mjs`.
- **Branche courte** (raccordée à une rue proche) : l'évasement de la voie est raccourci (jusqu'au 1/5) pour tenir
  dans la branche ; au-delà, l'extrémité est reportée des deux côtés — plus de bordure en aller-retour.
- **Raccorder une branche aux limites de chaussée** (fenêtre de la branche ; `js/tiein.js`) : deux clics sur les
  bords de la voirie existante (traits ou contours de hachures du DXF) → section perpendiculaire au droit du premier
  clic, extrémité d'axe au milieu (axe prolongé de 30 m dans la direction de la rue, sommets intérieurs conservés),
  double sens conservé : largeur partagée entre voies entrantes et sortantes, au-delà de 3,75 m par voie voies de
  3,50 m et surlargeur en BDD ; longueur de la branche jusqu'au raccordement, alignement droit depuis l'anneau
  raccourci pour finir avant lui. Case « garder l'orientation de l'axe » (cochée par défaut) : l'axe saisi n'est pas
  réorienté, le raccordement se fait au point de l'axe au droit du milieu de la section (écart latéral affiché) ;
  décochée, l'axe suit la rue existante. `node tools/test-tiein.mjs`.
- **Calques KMZ / KML** (onglet Projet) : import de fichiers Google Earth / My Maps / QGIS (plusieurs à la fois) ;
  chaque fichier devient un calque de la liste, ses dossiers KML des sous-calques cochables. Lus : Point, LineString,
  Polygon (avec trous), MultiGeometry, gx:Track ; styles KML (couleurs, épaisseurs, remplissage). Par calque :
  affichage, couleur (ou « Couleur unique »), noms, opacité, zoom, ordre de superposition, renommer, retirer.
  Géométrie conservée en WGS84 et reprojetée dans le système du projet (un projet local sans axe passe en UTM au
  fuseau du KMZ) ; accrochage aux sommets ; calques enregistrés avec le projet ; export DXF optionnel (`KMZ_*`).
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
  suivent jusqu'au bout (polylignes à plusieurs segments). Longueur de l'alignement droit, comptée depuis l'anneau :
  îlot et évasement réel (fin du retour des bordures à 1/15), plus 20 m de marge par défaut ; saisissable par branche
  (« Alignement droit avant le raccordement », 10 m au moins). **Approche en courbe** : alignement plus court que
  l'îlot et l'évasement (saisi, ou axe dessiné trop court) — îlot, bordures, évasement, marquages et axe sont construits
  dans le repère droit puis enroulés sur l'axe courbe (raccordement axeR, puis axe saisi) à partir de la fin de
  l'alignement ; dévers, profils, signalisation et profil en long suivent l'axe courbe. Exclue avec une voie directe de
  tourne-à-droite (alignement porté à îlot + évasement). Le centre se place sur la carte (outil C) ou se déplace
  à la souris ; les branches se réorientent vers lui. Rayons de raccordement de l'axe saisis par branche (raccordement
  à l'alignement radial) et par sommet de l'axe saisi, cotés sur le plan (rayon réduit signalé) ; poignées
  de sommet et de milieu de segment (le segment se déplace, les raccordements suivent) ; un « + » au bout extérieur
  de chaque axe en prolonge la saisie.
- **Axes des voies d'échangeur (voie principale, voies secondaires)** : au survol (outil Sélection), la droite ou le
  raccordement (clothoïde d'entrée, arc, clothoïde de sortie) sous le curseur est mis en surbrillance ; un clic ouvre sa
  fenêtre : pour un raccordement, rayon R et longueur L de la clothoïde du sommet, modifiables (L vide : clothoïde de la
  catégorie de conception ; L = 0 : arc seul ; A = √(L·R)), avec A, longueur d'arc, déviation et tangente ; pour une
  droite, longueur, gisement et abscisse. Les droites se déplacent par leurs poignées aux points de tangence (rondes :
  rotation autour de l'autre point de tangence ; losange : translation), les sommets restant déplaçables.
  Le tableau des sommets (onglet Tracé) donne X, Y au cm, R, la longueur de clothoïde et le rayon appliqué. Les
  clothoïdes sont réduites, puis supprimées (moins de 1 m), jusqu'à ce que les raccordements de deux sommets voisins
  tiennent sur leur côté : un chevauchement faisait revenir l'axe en arrière et croiser les bords et le TPC.
  Un raccordement se supprime (« Supprimer le cercle » : le sommet devient un angle vif, cliquable) et se reconstruit
  par tangente – tangente – rayon : au sommet, « Reconstruire le cercle » avec le rayon saisi ; entre deux droites
  quelconques du même axe, « Raccorder à une autre droite… » puis clic sur la seconde droite : les deux droites sont
  prolongées jusqu'à leur intersection, qui devient le sommet du cercle, et les sommets intermédiaires disparaissent
  (Échap annule).
- **Dévers** (onglet refait) : pour chaque axe de route (voie principale, voies secondaires, bretelles), les dévers
  **réellement appliqués** au projet (profils types et plages, catégorie de conception, rotation le long des
  clothoïdes) : synthèse (catégorie, toit, dévers maximal, courbes déversées, aquaplaning), diagramme courbure +
  dévers gauche / droit + zones d'aquaplaning, tableau des **courbes** (rayon minimal, sens, dévers requis par la
  catégorie et appliqués, clothoïdes présentes / requises, ✓ / ✖), **points de changement** (bornes des éléments du
  tracé et des plages de profils types) et **zones d'aquaplaning** (pente combinée < 0,5 % avec la ligne rouge). Un
  clic sur une ligne centre le plan sur le point. Le carrefour actif garde, repliés en bas, l'anneau à dévers imposé
  de 1,5 % vers l'extérieur (constant sur site en pente ou cône sur plan incliné), le profil en long des rives et la
  variation des dévers de chaque branche ; flèches de dévers sur le plan.
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
- **Signalisation des virages** (onglet Signalisation, `js/virages.js`) d'après le guide SETRA « Comment signaler les
  virages ? Signalisation verticale » (juillet 2002, repris par l'IISR — arrêté du 8 avril 2002), sur les routes
  bidirectionnelles à 2 voies (autoroutes, chaussées séparées et bretelles exclues), **dans chaque sens** : vitesse dans
  le virage Vv = 102 / (1 + 346 / R^1,5) (R : rayon minimal), vitesse d'approche Va depuis le virage précédent
  (accélération 0,8 m/s² corrigée de la pente amont, au-delà de 75 m d'alignement ; 102 km/h au plus), classe d'après
  Va − Vv : < 8 km/h aucune, 8 à 16 balises J1, 16 à 40 A1 + J1 + J4 tri-chevrons, ≥ 40 A1 + J4 monochevrons dans
  toute la courbe. Panneau A1a / A1b à 150 m en amont (rase campagne), J4 tri-chevrons à l'extérieur du virage dans
  l'axe de la voie d'approche, J1 / J4 monochevrons sur le bord extérieur (espacement indicatif) ; tableau des virages
  (alignement, pente, Va, Vv, classe) ; critères de surclassement calculables signalés dans les contrôles
  (R(−1)/R > 1,3 entre virages non isolés, resserrement du rayon, ligne droite > 5 km). La visite de terrain
  (lisibilité, visibilité sur et dans le virage, accidents) reste à faire pour confirmer la classe. Case « Signaler les
  virages » (cochée par défaut en interurbain).
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
  déblai / remblai, pentes, stations (TN, projet, écart, pente) en CSV, export DXF du profil (exagération verticale).
  **Éditeur interactif** (`js/pleditor.js`, ergonomie de BVTrace) : le TN est tracé d'emblée avec son cartouche
  (N° profil, distances, cotes TN et projet, puis **une seule ligne d'éléments du profil** — déclivités et
  raccordements paraboliques bout à bout, comme BVTrace — et, pour les axes de l'échangeur, **une ligne « Tracé en
  plan »** : diagramme des alignements et courbes, droites sur l'axe médian, arcs en palier vers le haut à gauche / vers
  le bas à droite avec R, clothoïdes en rampe avec A, longueurs) et le bandeau des dévers. **Ouvrages** : survolés, ils
  passent en surbrillance (désignation dans la lecture au survol) ; **clic droit → coupe longitudinale** de l'ouvrage
  au premier plan (cadres, PIPO, buses), fiche de l'ouvrage pour les ponts et passages supérieurs ; outils à gauche — Sélection (glisser un point, glisser le fond), Point (clic,
  accroché au TN ou à la ligne rouge, rayon ajusté à la place disponible), Pente (depuis un point : pente et longueur ;
  ou pente imposée à un segment), Rayon, Supprimer, S / Z, Draft TN (écart au TN, rampe / pente maximales, rayons
  saillant / rentrant, espacement : simplification Ramer-Douglas-Peucker, pentes bornées, rayons ajustés, extrémités
  imposées respectées), Annuler / Rétablir ; loupes (tout, fenêtre, + / −), molette ancrée au curseur, exagération
  auto ou imposée, lecture au survol (s, TN, projet, écart, pente), bandes de déblai (rouge) / remblai (jaune),
  inspecteur du point sélectionné (s, z, R, pentes, T, flèche, calage sur le TN), raccourcis P / I / R / Suppr / F /
  Échap / Ctrl+Z. Tests : `node tools/test-pl.mjs`.
  **Points de tangence** : chaque raccordement montre ses deux points de tangence (TE, entrée ; TS, sortie) en
  poignées ◆. Glisser TE déplace l'extrémité de la droite amont, qui pivote autour du sommet précédent, sans toucher à
  la droite aval : le sommet glisse sur la droite aval et le rayon devient R = 2 T / |Δi| ; TS de même côté aval. Près
  de la droite d'origine (accrochage), la pente est gardée et seul le rayon change. Un déplacement qui ferait chevaucher
  un raccordement voisin est refusé. Dans le panneau de droite (fenêtre en grand), le sommet sélectionné liste TE et TS
  avec PK, Z projet (modifiables) et Z TN : saisir le PK garde la pente, saisir Z fait pivoter la droite.
  **Extrémités** : un point saisi à l'origine ou à la fin de l'axe se déplace en cote seule (son abscisse reste à
  l'extrémité). Une extrémité **calée** (voie secondaire sur un carrefour, bretelle sur sa chaussée hôte) se libère
  en la glissant, après confirmation : elle devient un point saisi (« début / fin libéré ») dont la cote ne suit plus le
  calage ; « Recaler l'extrémité » dans le panneau du point revient au calage. Anneau : glisser l'origine crée un point à
  s = 0 (le bouclage suit). Branche : le point « anneau » reste imposé par le bord de l'anneau (un clic dit où le régler).
  **Tracé combiné** (`js/combine.js`) : feuilles plan + profil en long + cartouche à l'échelle. Les points du MNT et leur
  altitude sont dessinés sur le plan par-dessus le projet (plus lisibles quand le TN vient du SRTM, sans autre fond) ; la
  dénivelée projet − TN de chaque profil est écrite à la verticale au-dessus de la ligne rouge (vert : remblai, + ;
  orange : déblai, −). Points caractéristiques (PI, TE / TS, point haut / bas) écrits à la verticale au-dessus de la
  ligne rouge, écartés en éventail quand ils sont voisins ; désignations d'ouvrages placées là où elles ne recouvrent
  ni ces points ni les autres étiquettes (au-dessus, à côté puis sous la coupe) ; une dénivelée qui tomberait sur une
  étiquette est omise (elle reste lisible au cartouche). Cartouche : déclivités / rayons et longueurs sur une seule
  rangée d'éléments, rangée **« TRACÉ EN PLAN »** (droites, arcs R gauche / droite, clothoïdes A). Sur le plan, seuls
  les profils en travers portent un PK (plus de repères kilométriques rouges en double). Sur le plan, par-dessus le projet : talus (barbules, entrées en terre), aménagements de l'onglet
  Vitesses / UVR (bandes de catégorie, plateaux, passages, bandes rugueuses, portails… avec leurs désignations) et
  signalisation verticale (mât, **miniature vectorielle du panneau** et code : B14-50, C20a, AB25…).
  **Axes longs** (20 km et plus) : les primitives du projet sont découpées une fois en tronçons à boîte englobante
  (bordures, marquages, hachures) et les grands aplats (chaussée, TPC) discrétisés puis découpés à l'emprise de chaque
  feuille (Sutherland–Hodgman) ; seule la part qui touche la feuille est écrite (axe de 22,7 km : 70 feuilles A3 en
  6 s, 26 Mo, au lieu d'un blocage). Case **« Fond satellite »** (option, projet géoréférencé) : imagerie Esri World
  Imagery sous le projet sur la bande du plan de chaque feuille (tuiles reprojetées, ≈ 150 dpi), chargée à l'ouverture. Sans profils implantés, le cartouche suit un pas régulier lisible à l'échelle
  (≥ 15 mm : 20 m au 1/1000), et le recouvrement des feuilles vaut ce pas. La fenêtre s'ouvre tout de suite avec un
  message d'attente.
  Ouvrages (cadres, PIPO, buses) : sur le plan, fiche à côté de l'ouvrage — désignation, n × B × H (ou n × buse Ø),
  PK, biais (gr), longueur, fil d'eau amont → aval (pente) et **fil d'eau au droit de l'axe** ; sur le profil en long,
  **coupe de l'ouvrage** au droit de l'axe (largeurs le long de l'axe divisées par le sinus du biais, hauteurs à
  l'échelle des hauteurs : radier, piédroits, traverse, ouvertures ; buses en ellipses), repère et cote « FE axe » ; le
  plan de comparaison est choisi pour que la coupe tienne dans le cadre avec la ligne rouge ; un ouvrage trop profond
  pour tenir sous la ligne rouge est dessiné **remonté** (double zigzag sur le trait de rappel, « coupe remontée de
  x m », cote FE réelle), jamais réduit à un trait. **Ponts** : pont à poutres porté par l'axe et passage supérieur de
  l'onglet Ouvrages sur sa voie portée — tablier sous la ligne rouge (épaisseur poutres + hourdis), culées et piles
  avec semelles descendues jusqu'au TN, appareils d'appui ; sur la voie franchie, tablier du passage supérieur à la
  cote de la voie portée, piles sur la plate-forme et tirant d'air coté.
  **Aquaplaning** : sur le bandeau des dévers de l'éditeur et sur les rangées « Dévers » du cartouche du tracé combiné,
  un rectangle rouge transparent marque les tronçons où la pente combinée √(i² + d²) est inférieure à 0,5 % d'un côté
  au moins (dévers interpolé, déclivité de la ligne rouge) : rotation du dévers sur une ligne rouge trop plate.
- **Coupe longitudinale d'un ouvrage** (`js/ohcoupe.js`, comme la planche de BVTrace) : clic droit sur un ouvrage du
  plan → Propriétés (fiche), **Coupe longitudinale…**, Déplacer (l'ouvrage suit le curseur le long de son axe porteur,
  posé au clic), Supprimer. La coupe s'ouvre en grand : feuille paysage A4 / A3 / A2, vue en plan en haut (ouvrage à
  l'horizontale, route du bas vers le haut dans le sens des PK, son côté gauche à gauche de la feuille — la coupe est
  vue dans le sens de l'axe, amont et aval du bon côté —, sens d'écoulement), coupe le long de l'ouvrage en bas à la
  même échelle (H = V, ajustée ou 1/100 à 1/500) : terrain naturel du MNT le long de l'ouvrage, ligne projet de la
  route (profil en travers au droit de l'ouvrage, biais pris en compte) et remblai, corps de l'ouvrage (radier,
  ouverture, traverse, murs de tête), fils d'eau cotés aux deux faces et au droit de l'axe, pente, cote de chaussée,
  remblai sur traverse, PHE amont si l'hydraulique est calculée, longueurs de part et d'autre de l'axe. Cadre
  **« Conditions hydrauliques »** (comme BVTrace) : débit, pente du radier tirée des fils d'eau de la coupe (celle que
  reçoit le calcul : recaler un fil d'eau relance l'hydrologie) et pente critique → régime torrentiel ou fluvial dans
  l'ouvrage (Froude), yn, yc, remplissage ; amont : contrôle (entrée / aval), régime d'entrée, HW, HW/D, plan d'eau,
  revanche ; aval : sortie libre / partiellement noyée / noyée, hauteur et plan d'eau aval, vitesse de sortie (> 3 m/s :
  protection). Ouvrage non relié à un bassin : motif affiché. En plan (et
  au tracé combiné), le **talus est coupé entre les murs en aile** de chaque tête de cadre ou de PIPO, devant le mur de
  tête, et raccordé aux extrémités extérieures des murs (corde entre leurs extrémités dessinée en bord de talus). Boutons de
  face : fil d'eau ±1 / ±10 cm (les cotes deviennent saisies ; « Fils d'eau automatiques » y revient), longueur de la
  face (±10 cm, ±1 m, ±5 m) ; ◀ OH / OH ▶ par PK ; Imprimer (page à l'échelle exacte). Le plan montre aussi les talus
  (barbules, entrées en terre) ; la coupe montre la **ligne d'eau** du calcul hydraulique de l'ouvrage (onglet
  Hydrologie) : plan d'eau amont à la PHE, hauteur à l'entrée, hauteur normale, hauteur à la sortie, plan d'eau aval,
  avec Q, yn, yc, vitesse de sortie et contrôle (entrée / sortie), en courbe lissée (interpolation cubique monotone, sans
  cassure ni dépassement, jamais au-dessus de l'intrados). Au-dessus de la coupe, cotation des éléments de la
  plate-forme (largeurs perpendiculaires à la route) ; dessous, **cartouche** : distances depuis l'axe de la route,
  terrain naturel, fil d'eau de l'ouvrage, cote projet (chaussée, talus). Le tracé combiné dessine aussi les talus.
- **Profil en travers en grand** : onglet Profils travers, « ⤢ Ouvrir le profil en travers en grand » ; **même échelle
  en distances et en cotes** (sans exagération), cadré sur la plate-forme et les entrées en terre, plan de comparaison
  et **cartouche** (distances à l'axe, cotes TN, cotes projet, écart projet − TN aux points de la ligne projet et aux
  EET, écrits à la verticale) ; couches de chaussée des profils types dessinées et nommées (épaisseurs), ligne arase,
  points de contrôle déblai / remblai, talus jusqu'aux EET ; ◀ ▶ ou flèches du clavier pour passer d'un profil à
  l'autre.
- **Catalogue de demi-profils types** (`js/ptcatalog.js`, 624 demi-profils ; onglet Profils travers, « Catalogue de
  profils types… ») : urbain — chaussée bidirectionnelle (voie 3,00 / 3,25 / 3,50, stationnement sans / longitudinal
  2,00 / en bataille 5,00, caniveau sans / CS2 / CC2, bordure T1 / T2 / T3 / T4, trottoir 2,50 ou 1,50) et 2 × 2 voies
  avec TPC (au niveau revêtu au dévers, surélevé entre bordures T2, creux déversé vers un caniveau CC2 central) ; rural
  — bidirectionnelle (BDD 0,25 + accotement 1,75, BDD 0,50 + accotement 2,00, accotement revêtu 2,00, BAU 2,50 ;
  berme sans / 0,75 / 1,00 ; fossé en déblai) et chaussées séparées 2 × 2 / 2 × 3 (TPC au niveau, surélevé, creux
  avec CC2, engazonné 5,00 ; BDG 0,50 / 1,00 ; BAU 2,50 / 3,00 ou BDD + accotement ; berme ; fossé). Filtres par
  critère, recherche, aperçu ; « + bibliothèque », « gauche », « droite », « les deux côtés » (affectation à l'axe
  courant). Bordures et caniveaux : profils NF P 98-340/CN (T1 12 × 20, T2 15 × 25, T3 17 × 28, T4 20 × 30 cm ; CS2
  25 × 13, CC2 50 × 14), vues de pose usuelles T1 10, T2 14, T3 16, T4 18 cm (à adapter) ; trottoir 2 % vers la
  chaussée, talus 3/2 en remblai et 1/1 en déblai. Chaque demi-profil porte ses couches de chaussée (roulement BB 5 cm,
  base GB 15 cm, fondation GNT 25 cm, couche de forme 30 cm), la ligne arase sous les bandes revêtues, le point de
  contrôle déblai / remblai au bord de la plate-forme et les talus de remblai et de déblai (fossé éventuel) jusqu'aux
  EET ; l'aperçu les montre. Chaque profil importé reste éditable point par point.
  La ligne rouge remplace la pente constante de la branche dans le modèle altimétrique (dévers, points d'implantation).
  Contrôles : chevauchement des raccordements, pente maximale et rayons minimaux (ARP catégorie R80 par défaut, valeurs
  urbaines usuelles — à confirmer selon la catégorie ; l'autoroute et les voies secondaires suivent leur catégorie de
  conception, voir « Catégories de conception »). Graphique des axes de l'échangeur : exagération verticale × 10 par
  défaut (z dix fois plus que s ; en échelle imposée, 1 px par mètre d'abscisse et défilement horizontal, « auto »
  ajuste le profil au panneau), ouvrages superposés — sur l'autoroute, gabarit au-dessus de la chaussée et intrados du
  tablier de chaque passage supérieur (rouge si le tirant d'air manque) ; sur la voie portée, tablier, piles, culées et
  gabarit de l'autoroute franchie ; cadres et buses sous la chaussée de leur axe (traverse, cellules, fil d'eau) —,
  bandeau du tracé en plan (diagramme des courbures, rayons) et bandeau des dévers gauche / droite (bascule sur les
  clothoïdes). Cartouche repris de BVTrace (sous le profil et dans l'export DXF, au 1/1000 avec plan de
  comparaison) : N° profil, distance partielle (cotée entre deux profils), distance cumulée, cote TN, cote projet
  (valeurs écrites à la verticale, stations éclaircies si elles se touchent), alignements droits (i, L) et
  raccordements paraboliques (R, L, i → i) en cellules fusionnées ; stations = profils en travers implantés sur l'axe,
  sinon pas régulier (10 à 100 m selon la longueur). Le graphique s'ouvre dans une grande fenêtre (clic sur l'onglet
  Profil long ou bouton « Ouvrir le profil en grand », échelle × 1,5 ; Échap pour revenir au panneau), avec l'axe,
  l'échelle, le tableau des points et les contrôles, pente ≤ 2 % sur les 20 derniers mètres (ACI), PI hors de l'axe.
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
  surlargeur, Lc, Δ). Les cotations des axes (PK / PR, courbes, clothoïdes A et L, alignements, repères TC / CT /
  TS / ST) sont **perpendiculaires à l'axe**, en jaune, lues de l'axe vers l'extérieur (côté extérieur des courbes) ;
  sur un même côté, les étiquettes trop proches sont écartées et reliées au point coté par un trait de rappel.
  Sélection (clic à quelques pixels de l'axe) : droite, raccordement (sur son arc) et **chaque clothoïde** (entrée /
  sortie) avec ses propriétés — A, L, rayon au raccord, angle τ, abscisses et PK de début et de fin, coordonnées — et
  les champs R et L du raccordement.
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
- **Bretelles sur chaussée en courbe** (guide des échangeurs 2013, version 2015, § 6.2 et 6.3, schémas 6-3, 6-4, 6-11,
  6-12) : à l'intérieur du virage, le bord gauche de la bretelle prolonge l'obliquité par une courbe de même rayon que le
  bord droit de la chaussée (arc d'extrémité) au lieu d'une droite qui recouperait la chaussée. Le rayon est celui de la
  rive vue depuis le point S / E.1,00 (flèche la plus forte sur 300 m), y compris sur une autoroute à courbes
  successives de sens contraires ; une bretelle à un seul sommet (directe de trompette) reçoit l'arc le plus court qui
  laisse sa plate-forme hors de la chaussée.
- **Boucles sur autoroute en courbe** : trompette dont la boucle est à l'extérieur du virage (la rive s'écarte de la
  boucle plus vite que l'obliquité de 3 %) — convergent terminé par un arc tournant à gauche de rayon proche de celui de
  la rive (guide des échangeurs, schéma 6-12), relié à la boucle par leur tangente commune ; trompette sur courbe à
  gauche de petit rayon — la S-semi est recalée sur la chaussée réelle avant d'être retenue ; demi-trèfle sur autoroute
  en courbe — marge entre les deux sommets de chaque boucle relancée jusqu'à ce que les raccordements ne se chevauchent
  plus (comme le trèfle).
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
  pente maximale et rayons saillants / rentrants de la catégorie (ICTAAL, guide des échangeurs, ARP). **Tirant d'air**
  (js/gabarit.js) : minimum, sur toute la largeur revêtue de la voie franchie située sous l'emprise du tablier
  (chaussée, BAU / BDD, BDG), de l'écart entre l'intrados (surface de la voie portée, profil en long et dévers, moins
  l'épaisseur du tablier) et la surface de la voie franchie (profil en long et dévers) — soit, pour un intrados
  horizontal, l'intrados moins le point le plus haut de la voie franchie ; contrôlé sous les passages supérieurs, sous
  les tiges de trompette (S-semi et boucle portées) pour toutes les voies franchies (autoroute, bretelles passant sous
  le tablier) et aux croisements dénivelés sans tablier implanté (bretelle sur bretelle ou sur voie secondaire,
  épaisseur supposée 1,00 m). Le point critique (voie, côté, abscisse) est donné dans la fiche de l'ouvrage, avec un
  bouton qui relève la voie portée au gabarit (sommet placé au droit de l'ouvrage, voisins dégagés, rayon adapté) ; les
  profils en long de toutes ces voies, bretelles et boucles comprises, montrent le tablier, ses appuis et le gabarit ;
  tant qu'un profil manque, l'emprise de chaque ouvrage est repérée sur le profil en long de chaque axe concerné (voie
  portée ou franchie, bande verticale) avec le profil à définir. Une voie portée qui repasse sous son propre tablier
  (boucle de trompette avant son convergent) est contrôlée comme voie franchie.
- **Profils types, dévers, coupes et cubatures des axes de l'échangeur** (onglet Profils en travers, liste « Axe ») :
  coupes aux profils implantés sur l'autoroute, les voies secondaires et les bretelles. Profil type tiré des
  paramètres de chaque axe (TPC, BDG, voies, BAU/BDD, bermes ; bretelle : voie, BDG, BDD) ; dévers d'alignement
  (2,5 % par défaut, en toit ou unique pour une bretelle) et, en courbe de rayon < Rdn, plate-forme déversée vers
  l'intérieur de 2,5 à 7 % (linéaire en 1/R, guide des échangeurs § 3.5 ; route ordinaire : Rdn ≈ 900 m, Rm ≈ 240 m,
  ordre de grandeur à ajuster) ; bermes à 8 % ; talus et fossé de l'onglet. Épaisseur de chaussée : cubatures au fond
  de forme. Volumes par la méthode des aires moyennes, récapitulatif par axe, exports DXF et CSV.
  **Profil type construit point par point** (repris de BVTrace, js/ptype.js et js/pttedit.js) : chaque côté de l'axe
  reçoit un demi-profil, automatique (paramètres ci-dessus) ou de la bibliothèque du projet, éventuellement changé sur
  des plages d'abscisses. Éditeur graphique : points origine / libre, ΔX / ΔZ, ΔX / pente (fixe ou au dévers de la
  chaussée à la station : bascule sur les clothoïdes, courbes déversées), pente → TN (entrée en terre, EET),
  condition déblai / remblai sur un point de test (branches R et D : talus, fossé…), lignes Projet et Arase, couches
  de chaussée (arase recréée à leur épaisseur totale), TN de contrôle, annulation. Cubatures entre le TN et la ligne
  de terrassement (arase sous la chaussée, projet ailleurs) ; arase et EET dessinés sur les coupes et dans le DXF
  (calque GIRA_PT_ARASE). Contrôles : node tools/test-ptype.mjs.
- **Pont à poutres sur écoulement** (onglet Ouvrages, « + Pont à poutres », ou onglet Hydrologie, type « pont à
  poutres ») : passage inférieur à travées indépendantes placé sur un axe comme un PICF (poignées de déplacement et
  d'orientation) ; tablier dans l'axe de la voie portée, culées et piles parallèles à l'écoulement, travées le long de
  l'axe ; voie à TPC : un tablier par sens ; poutres proposées selon la plus grande portée (BA ≤ 16 m, PRAD ≤ 30 m,
  VIPP au-delà ; h_p ≈ L/13, L/18, L/17 ; entraxe ≈ 3 m) ; dessin en plan (tablier, poutres, culées, piles), au profil
  en long (tablier et appuis), cotes de chaussée et d'intrados, hauteur libre sur le TN ; lien PSIDA (onglet Ponts à
  poutres : travées, type, nombre et entraxe des poutres, hauteur, hourdis, chaussée, superstructures).
- **Voie principale** (onglet Tracé, « Tracer la voie principale ») : autoroute (ICTAAL L1 / L2) ou route non
  autoroutière (catégories de conception ARP R1 / R2 / artère 110, VSA 90 / 110, AU 70, libre ; 2×1 voies, BDD 2,00 m,
  berme 0,75 m par défaut, terre-plein central facultatif) : on peut croiser et raccorder des routes non autoroutières.
- **Carrefour « cacahuète »** (onglet Carrefours plans, forme de l'anneau ; `js/ringshape.js`) : deux lobes circulaires (Rg,
  Rg2) d'entraxe e reliés par deux cols concaves (rayons à la rive extérieure, 0 = col rectiligne : giratoire oblong),
  orientés suivant la route principale ou un gisement saisi. Outil Centre (C) : deux clics, centre du lobe 1 puis du
  lobe 2 (ou X,Y / @dx,dy) — le centre (milieu), l'entraxe e et le gisement de l'axe en découlent. Référence : Sétra, fiche d'expérience RACA « Le carrefour
  cacahuète, un nouveau type de giratoire » (mai 2010 : Rg = 20 m, cols R = 30 m, anneau 7 m). Toutes les lignes de
  l'anneau (bords, rives, îlot, bande franchissable, abords) sont parallèles à la rive extérieure ; chaque branche se
  raccorde au lobe de son côté (erreur si Re / Rs empiètent sur un col). Contrôles : cols croisés (îlot coupé), largeur
  de l'îlot au col, col plus serré que BDD + abords, forme non circulaire hors agglomération (Sétra 1998), déflexion
  (point de l'îlot le plus saillant ; trajectoire en S signalée quand l'arc des trois points sort de l'anneau au col).
  Dévers, profil de l'anneau, talus, vue 3D et signalisation (B21-1 sur l'îlot du lobe) suivent la forme. Tests :
  `node tools/test-cacahuete.mjs`.
- **Rayon unique quand Re et Rs se chevauchent** (`fuseFillets`, `js/roundabout.js`) : au lieu de l'erreur
  « branches trop proches », le rayon d'entrée d'une branche et le rayon de sortie de la suivante sont remplacés par un
  seul arc tangent aux deux rives (prolongées en ligne droite vers l'anneau), de préférence tangent à la rive de
  l'anneau ; si ce rayon est plus petit que le minimum « Rayon unique mini » (onglet Carrefours plans, 12,50 m par défaut :
  couronne de giration d'un autobus, 12,50 m / 5,30 m, directive 2001/85/CE), le minimum est retenu et l'arc reste en
  retrait de l'anneau ; s'il ne tient pas entre les branches, le plus grand rayon qui tient. Bord de chaussée
  concentrique, coté « R … (Re/Rs fusionnés) ». Cercle et lobe d'une cacahuète (même lobe). Sans chevauchement, la case « Rayon unique
  avec la sortie de … » (fenêtre de la branche, Entrée) impose le même arc entre l'entrée de la branche et la sortie
  de la suivante dans le sens de l'anneau. Avec un calque protégé (contrôle d'emprise), la bordure ne doit jamais
  entrer dans le bâti : le rayon unique est choisi, entre le rayon tangent à l'anneau et le plus grand qui tient, au
  plus près du rayon voulu avec au moins le trottoir minimal (sinon au moins hors du bâti) ; un rayon unique demandé
  qui entrerait forcément dans le bâti est abandonné (Re et Rs conservés), un chevauchement sans solution est signalé
  en erreur. Poignée (losange bleu, outil Sélection) au point de contact du rayon unique sur la rive de l'anneau :
  glissée le long de l'anneau, elle impose ce point ; deux arcs tangents à la rive en ce point (et entre eux)
  raccordent alors chaque branche, le plus serré du côté où l'on déplace le contact. Bouton « Contact automatique »
  dans la fenêtre de la branche pour revenir au rayon unique calculé.
- **Arrivée de l'axe sur l'anneau** (poignée ronde bleue, outil Sélection) : le point où l'axe d'une branche coupe la
  rive de l'anneau se glisse le long de l'anneau ; le dernier segment de l'axe pivote sur le sommet précédent
  (raccordement lointain conservé) et la branche devient non radiale (excentration contrôlée, Ctrl+Z pour annuler).
- **Accès sur VSA 90 / 110** (`js/vsa.js`, voie principale ou secondaire de catégorie VSA) : guide Cerema « VSA 90 et
  110 » (2014, § 4.2, 6.1 à 6.4) complété, pour les accès rapprochés, par le guide Certu « Conception des accès sur VRU
  de type A » (2003). Section courante par défaut 2×2 voies, BAU 2,50 m, BDG 1,00 m, avec contrôles (chaussées
  séparées, BDD ≥ 1,00 m, BDG ≥ 0,75 m, berme ≥ 0,75 m). Accès : interdit en courbe déversée (R < Rdn), à éviter sous
  1,5 Rdn ; déboîtement 150 m (110 m admis sur VSA 90 si S < 650 uvp/h) ; insertion 200 m + biseau 75 m (150 m admis
  sur VSA 90 si E < 600 uvp/h et BAU en aval) ; vitesse conventionnelle à S.1,00 de 50 km/h (VSA 90) / 70 km/h
  (VSA 110) pour la longueur de décélération. Enchaînements : entrée – entrée (fin du biseau à da de E.1,00), sortie –
  sortie (D40 de la seconde à np = 170 m de S.1,00 de la première, avec d1 puis d1m), entrée – sortie (D40 à lc de la
  fin de l'entrée ; sinon voie d'entrecroisement dessinée, Z de 300 à 750 m, Z ≥ lc + ds + lb hors disposition
  exceptionnelle ; Z < 300 m → collectrice). D40 / D50 dessinés à d1 (ou d1m) et d (VRU A p. 12 et 39). Les minima
  liés au trafic sont signalés « admis si … », aucun trafic n'étant saisi. Tests : `node tools/test-vsa.mjs`.
- **Dévers dans les voies** (calque Dévers) : flèches dans chaque chaussée de la voie principale, des voies secondaires
  et des bretelles, aux points caractéristiques du tracé (début, milieu, fin des droites, clothoïdes et arcs) et au moins
  tous les 100 m, dirigées vers le bas de la pente, avec la valeur (dévers de la catégorie, variation sur les clothoïdes).
- **Talus en plan** (js/talus.js, calques « Talus » et « Entrées en terre ») : pour tous les axes (autoroute, voies
  secondaires, bretelles ayant un profil en long ; branches, anneau et route principale des carrefours), coupes au
  profil type tous les 5 m (réglable, onglet Profils travers) ; bord de plate-forme côté talus, entrée en terre (EET)
  et barbules comme dans BVTrace (une longue de la crête au pied, trois courtes partant de la crête : bord de
  plate-forme en remblai, EET en déblai ; espacement réglable). Découpe automatique entre axes : rien sous la
  plate-forme d'un autre axe ni sous un tablier ; deux remblais : le plus haut l'emporte, deux déblais : le plus
  profond, déblai sous remblai : masqué — les lignes s'arrêtent sur la ligne de rencontre des talus, qui est
  dessinée (calque Talus, trait propre) : intersection exacte des facettes des deux talus (remblai / remblai ou
  déblai / déblai), limitée à leur partie commune et aux parties apparentes vis-à-vis des autres axes ; elle prolonge
  le point où les deux EET se rejoignent. Export DXF (GIRA_TALUS, GIRA_ENTREE_EN_TERRE). Contrôles :
  node tools/test-talus.mjs, node tools/test-talusx.mjs.
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
    ψ = min(angle, 200 − angle)), de déplacement le long de l'axe et une poignée de longueur sur chaque tête : elle
    prolonge ou raccourcit son seul demi-ouvrage (côté gauche ou droit de la voie, champs Lg / Ld de la fiche),
    l'autre tête reste en place ;
  - un clic sur un ouvrage du plan (tablier, cadre, buse) le met en surbrillance et ouvre sa fiche modifiable dans une
    fenêtre (bouton Supprimer pour un cadre) ;
  - « Créer les ouvrages sur le plan » : un PICF (ou une buse) par franchissement, biais tiré de la direction de
    l'écoulement, remblai sur traverse tiré du profil en long ; numérotation OA, export PSIDA des dalots ;
  - hypothèses de BVTrace selon le jeu choisi (la liste bascule les champs) : Tunisie — Pan, P10, P100, P0, station
    Montana (table 18) ou a, b, c saisis, régionalisations Ghorbel / Kallel / Fersi / Frigui, couvert végétal,
    Francou-Rodier, note DGPC 1054 ; FAO 54 — Pan, P10, P100, IDF d'une station Montana CIEH (plage) ou a, b saisis,
    régressions CIEH (cases à cocher par découpage ; « Proposer selon Pan et la position » ; aucune cochée = les
    proposées d'après Pan et la longitude des bassins sont appliquées, sinon le CIEH ne donnait aucun débit), zone
    Orstom (déduite de Pan ou imposée), Kr10 de secours, α10, **C par défaut** ; T = 10 ans en FAO 54. Entrées FAO 54
    propres à chaque bassin, comme les colonnes de saisie de BVTrace : **C** (colonne du tableau des résultats et
    détail du bassin), Kr10 imposé, infiltrabilité, densité de drainage Dd, Ig. En jeu Tunisie, C ne se saisit pas :
    il vient de l'abaque pente × couverture végétale (BVTrace, hydrologie-tunisie). Le détail du bassin liste les débits
    Orstom et CIEH par régression, la médiane et le motif des régressions non calculées (donnée manquante) ;
    bouton **⤢ Agrandir** des résultats : tableau des bassins et détail du bassin choisi en plein écran ;
    **Pan et P10 lus sur les cartes FAO 54** (figures 3 et 4, isohyètes relevées par BVTrace, `js/hydro/isohyet.js`) :
    interpolation entre les deux isohyètes encadrantes à la position des bassins, refus motivé hors du faisceau (jamais
    d'extrapolation) ; remplis d'office quand ils sont vides ou aux valeurs par défaut, bouton « Lire Pan et P10 sur les
    cartes FAO 54 », source affichée ; une saisie prime. Ancres du bulletin (14° N, 0°) : P10 85,2 mm (86), Pan 513 mm
    (≈ 500) — verrouillées par `tools/test-hydrology.mjs` ;
    **note de calcul hydrologique et hydraulique** (`js/hydro/notefig.js`, comme les notes de BVTrace) : carte
    d'ensemble des bassins et des axes **sur fond satellite** (Esri World Imagery, tuiles reprojetées dans le système
    du projet ; projet non géoréférencé : fond blanc), position du projet sur les cartes d'isohyètes Pan et P10 (FAO 54), carte de
    chaque bassin sur fond satellite (contour, écoulement principal, tracé, exutoire, échelle, nord), puis par ouvrage le tableau
    hydraulique (régime d'entrée, contrôle gouvernant, HW, hauteurs normale et critique, Froude, vitesse, revanche,
    contre-épreuve BCEOM) et les abaques dessinés — HDS-5 (toutes les configurations d'entrée de la forme, retracées
    par les équations du calcul avec la section retenue) et BCEOM (toutes les courbes de la figure) : courbe retenue en
    trait plein, les autres en pointillé gris étiqueté, point lu en rouge avec ses graduations ;
  - **fiche du bassin** (clic sur un bassin du plan, ou « Fiche complète » du tableau) : propriétés physiques
    (surface, périmètre, Gravelius, rectangle équivalent, plus long chemin, pentes brute / équivalente / retenue, Ig,
    altitudes, H5 / H95), courbe hypsométrique, profil de l'écoulement principal, temps de concentration, débits par
    méthode, dispersion, débit retenu et cumul amont ; hydraulique de l'ouvrage : fil d'eau amont / aval (TN au droit
    des têtes de l'ouvrage placé, sinon pente du thalweg à l'exutoire), pente du radier prise en compte, contrôle, HW,
    cote de l'eau en amont et à la sortie, tirants normal / critique, vitesses, revanche ;
  - **couper, fusionner, supprimer un bassin** (fiche du bassin, comme BVTrace) : coupe par une ligne tracée sur le
    plan (la moitié qui garde le franchissement garde l'identifiant, l'autre reçoit son exutoire D8 et un nouvel
    identifiant, ajoutée aux bassins amont), fusion de deux bassins, suppression (listes amont et liens des ouvrages
    réécrits) ; couper et fusionner demandent la grille de la délimitation faite dans la session ;
  - **cotes fil d'eau amont / aval** de chaque cadre ou buse : automatiques (TN du MNT au droit des têtes, sens de
    l'écoulement du bassin lié ; à défaut pente du thalweg, ou radier tiré de la chaussée) ou **saisies** dans la fiche de
    l'ouvrage, la fiche du bassin ou le détail de l'onglet Hydrologie (champ vide : automatique) ; elles fixent la pente
    du radier du calcul hydraulique, le radier dessiné au profil en long et le remblai sur traverse qui en résulte
    (au profil en long, sur chaque cadre, PIPO ou buse : **remblai sur traverse min et max** le long de l'ouvrage, comme
    sa coupe longitudinale — ligne projet du profil en travers au droit de l'ouvrage, dévers compris, sur la
    plate-forme, moins le dessus de la traverse suivant les fils d'eau ; rouge si la traverse dépasse la chaussée,
    orange sous le remblai prévu) ;
    inscrites au droit des têtes sur le plan (FE amont / aval). Alertes : pente du radier inférieure à la pente critique
    de l'ouvrage vérifié (écoulement fluvial, contrôle par l'aval, dépôts ; pente conseillée), contre-pente, traverse
    au-dessus de la chaussée ;
  - têtes d'ouvrage HDS-5 (clés 1 à 6 des dalots, 101 à 302 des buses) appliquées aux ouvrages placés et dessinées
    (murette, murs en aile selon la famille d'angles) ; une tête, murette comprise, en deçà de l'entrée en terre du
    talus de la voie portée (EET interpolée entre trois coupes successives au droit de la tête) est dessinée en rouge
    et signalée avec l'allongement nécessaire du demi-ouvrage ;
  - tests : `node tools/test-watershed.mjs`, `node tools/test-hydrology.mjs`, `node tools/test-culvert.mjs`,
    `node tools/test-basinedit.mjs`.
- **Import d'un axe depuis un KMZ / KML** (onglet Tracé, « Importer l'axe (KMZ / KML) » ; `js/axisimport.js`) :
  ligne Google Earth, GPS ou QGIS (choix de la ligne si le fichier en contient plusieurs) → voie principale, ou nouvelle
  voie secondaire si la principale existe et n'est pas remplacée. Droites, arcs et clothoïdes reconstitués par le
  diagramme des courbures (clofit.js), puis un sommet par virage : intersection des tangentes, R calé sur la flèche,
  longueur de clothoïde ajustée aux points (arc seul quand il suffit) ; écart maximal aux points affiché. Un projet
  vide passe dans le fuseau UTM du tracé. `node tools/test-axisimport.mjs`.
- **Téléphone** : onglets sur une ligne défilant au doigt, panneau sous le plan à sa hauteur, zoom et panoramique à
  deux doigts (pincement) sur le plan.
- **Vitesses / UVR (onglet dédié, Guide M1 ESCWA/UNRSF ; `js/uvr.js`, `js/uvrtab.js`)** : déclencheurs UVR et plan de
  gestion des vitesses le long des axes cochés (route, autoroute, voies secondaires, bretelles, branches), comme les
  bassins versants de BVTrace :
  - déclencheurs (B.5.4, AD 1.2) : école, marché / zone commerciale, arrêt TC, centre de santé, lieu de culte, zone
    résidentielle dense, gare routière — cherchés dans OpenStreetMap (API Overpass, rayon d'influence 200 m le long du
    tracé), lus dans les calques KMZ / KML (nom du repère ou de son dossier : « école », « souk », « mosquée »,
    « arrêt », « dispensaire »…, arabe compris) ou cliqués sur le plan ; type, nom et prise en compte modifiables ;
  - traversées de localité (B.5.4 : > 400 m) détectées sur le bâti (zones résidentielles / commerciales et bâtiments
    OSM, polygones KMZ « agglomération », « village », « zone bâtie ») ou saisies par PK ;
  - sections de vitesse constante : catégorie de base A / B / C de l'axe, D (traversée, 50 km/h), E (zone sensible,
    30 km/h) ; vitesse par type de déclencheur (AD 1.2, réglable) et application hors traversée ou non (l'arrêt TC
    hors agglomération ne fait pas baisser la vitesse, comme dans le tableau E.4.2) ; zone 30 scolaire à ±200 m de
    l'entrée (F1.17) ; VC = vitesse-cible + 10 km/h (C1.5) ; remontées de vitesse < 300 m supprimées ;
  - transitions et aménagements placés aux PK, par sens : annonce à 250 m, bandes rugueuses à 150 / 100 / 50 m,
    rétrécissement et panneau 60 à 150 m, portail d'entrée, premier plateau à +50 m, séquence inverse en sortie
    (F1.12, F1.13, F1.15) ; entrée de zone 30, chicane (F1.14, F1.17) ; plateau au droit de l'école, passages protégés
    (+ refuge si la traversée dépasse 7 m) aux arrêts et tous les ≤ 200 m en D / E, trottoirs continus 2,50 m
    (1,50 m minimum), éclairage, dépassement interdit ; prescriptions MUST / SHOULD de chaque déclencheur ;
  - V85 géométrique (formules SETRA reprises de BVTrace : V0 / (1 + 346 / R^1,5), V0 − 0,31 p² sur le profil en long,
    accélérations ±0,85 m/s²) : vitesse-cible non crédible signalée en D / E (V85 > vitesse-cible + 10, dispositifs de
    modération répétés proposés), VC dépassée en rase campagne, courbes sous la vitesse-cible (Contrôles) ;
  - profil des vitesses (vitesse-cible, vitesse visée de la séquence F1.13, V85, déclencheurs, bandeaux des catégories
    et des aménagements), tableau linéaire E.4.2, page imprimable « Plan de gestion des vitesses » (E.4.1, profils,
    E.4.2, cartographie C1.6, aménagements, checklists CK-F03 à F06, CK-A08, A12, A13), CSV ; sur le plan, calque
    `GIRA_UVR` : bandes colorées des catégories, déclencheurs, aménagements et panneaux (B14, entrée / sortie
    d'agglomération, zone 30, passage piéton, enfants) ;
  - sur le plan (outil Sélection), un aménagement survolé passe en surbrillance ; clic droit : **Propriétés**,
    **Déplacer** (l'aménagement suit le curseur le long de son axe, avec son PK, et se pose au clic ; Échap ou clic
    droit pour annuler), **Supprimer** ; les étiquettes d'aménagements voisins sont décalées en rangées pour rester
    lisibles ;
  - recherche OpenStreetMap par tronçons d'environ 2 km, lus deux à la fois (déclencheurs et bâtiments en parallèle) ;
    un serveur Overpass qui tarde plus de 8 s est doublé par le suivant et la première réponse l'emporte (au lieu
    d'attendre jusqu'à 75 s par serveur et par tour) ; durée affichée à la fin ;
  - référentiel au choix : Guide M1 (catégories A à E) ou **Roads-for-Life (R4L)** du Guide for Safe Speeds de la
    Banque mondiale / WRI (2024, § 2.2–2.3, fig. 7–8) : base de l'axe (accès contrôlé 100, liaison rurale 80 avec
    séparateur ou 70, accès rurale 70 / 50, liaison urbaine, axe urbain principal), tout générateur d'usagers
    vulnérables → pôle d'activité humaine à 30 km/h (50 si les usagers vulnérables sont séparés), y compris hors
    village ; carrefours du projet sur l'axe : zone d'approche à 50 km/h (±100 m réglable, M1 AD 1.3 et R4L) ;
  - aménagements et panneaux modifiables un par un (tableau de l'onglet) : PK, panneau (ou aucun), suppression
    (liste des supprimés, « Rétablir »), ajout au PK saisi ou par clic sur le plan (portail, plateau, passage,
    chicane, bandes rugueuses, zone 30, limitation, annonce, panneau « enfants ») ; retouches enregistrées avec le
    projet et rattachées à l'aménagement proposé le plus proche (15 m) quand le calcul est refait ;
    « Rétablir la proposition » les efface ;
  - tests : `node tools/test-uvr.mjs`.
- **Ouvrages numérotés** : passages supérieurs, tiges, anneaux de giratoire dénivelé et cadres sont numérotés OA1, OA2…
  dans l'ordre des abscisses de l'autoroute (numéro cerclé sur le plan) ; le nom de chaque ouvrage se modifie dans
  l'onglet Ouvrages. **+ Passage supérieur** : dessinez une voie secondaire qui franchit l'autoroute, l'ouvrage est
  implanté à leur croisement (autant de passages supérieurs que de voies). La voie dessinée reconnaît les carrefours :
  une extrémité posée à moins de R + 100 m du centre d'un carrefour existant (carrefour actif, autres carrefours,
  giratoires des gabarits) s'y arrête à R + 60 m dans l'alignement de son dernier côté et le carrefour reçoit la branche
  correspondante ; là où elle croise une autre voie secondaire, un giratoire (Rg par défaut, type modifiable dans
  l'onglet Carrefour) est créé et les deux voies y sont coupées à Rg + 60 m, avec quatre branches ; le tronçon qui
  franchit l'autoroute garde l'identité de la voie (réglages du passage supérieur, profil en long), les points
  d'inflexion et les bretelles accrochées sont reportés sur les tronçons. Le profil en long d'une voie raccordée est
  calé à son extrémité sur la cote zC du carrefour (ignorée si elle s'écarte de plus de 30 m du terrain naturel).
  Bouton « Raccorder aux carrefours et croisements » dans la fiche de la voie pour une voie existante.
  Carrefour posé (outil Centre) ou déplacé sur une voie secondaire existante : la voie est coupée à R + 60 m de part et
  d'autre du centre et y arrive par deux branches ; les extrémités libres des bretelles voisines (losange,
  demi-échangeur à extrémités libres) sont prolongées dans leur alignement final jusqu'à l'anneau, où elles dessinent
  leur branche (raccourcie, 15 m au moins, si l'alignement final est trop court pour y couper la bretelle).
  Même chose sur la voie principale de type route. Voie principale encore de type **autoroute** (type par défaut, par
  exemple axe importé d'un KMZ) sans aucune bretelle d'échangeur : y poser un carrefour la fait passer en route non
  autoroutière (AU70 en contexte urbain, artère 110 si elle a un TPC, sinon R1), profil en travers figé à l'identique
  (voies, BAU / BDD, TPC, berme), puis elle est coupée ; une autoroute qui porte des bretelles reste refusée (alerte).
  La distance du centre à une voie se mesure à son **axe réel** (arcs, clothoïdes), plus au polygone des sommets :
  dans une grande courbe, un centre posé sur l'axe en était à des dizaines de mètres et la voie n'était pas coupée.
  Quand aucune voie n'est à portée (R + 15 m du centre, hors des extrémités), une alerte le dit au lieu de ne rien
  faire. **Supprimer une voie** : bouton ✕ sur sa ligne dans les listes de l'onglet Tracé (voie principale : son axe
  est effacé et peut être retracé ; voie secondaire : supprimée, ses bretelles deviennent libres).
- **Cadres PICF et portiques PIPO** (onglet Ouvrages, **+ PICF / PIPO**, un clic sur l'axe de la voie portée) : nombre
  de cellules, ouverture, hauteur intérieure, remblai sur traverse, biais (gr), longueur (automatique : plate-forme +
  talus 3/2 jusqu'à la traverse, divisée par le sinus du biais), épaisseurs (automatiques e ≈ 0,15 + B/20), murs en aile.
  Dessin en plan : têtes parallèles à la voie portée, faces cachées en tirets, semelles du PIPO, murs en aile, axe.
  « Ouvrir dans PSIDA » remplit l'onglet Cadres et portiques de PSIDA (champs cf_*) ; export du projet PSIDA (.json).
- **Profils en travers** (onglet Implantation) : en série entre deux points cliqués sur un même axe (autoroute, voie
  secondaire, bretelle, branche) au pas choisi, avec en option les points de tangence compris entre eux (droite /
  clothoïde / arc ; un point de tangence à moins de 0,50 m d'une station la remplace), ou profils isolés placés à la
  main. Symbole à la manière de Macao : petit cercle sur l'axe et segment perpendiculaire, numéro P1, P2… par axe
  (calque GIRA_PROFILS, blanc ; sur le plan : trait, numéro et PK en blanc gras avec liseré sombre, lisibles sur
  l'imagerie ; noir gras en thème clair). Tableau (axe, abscisse, X, Y, gisement de la normale, origine) et export CSV.
  **Sur le plan** (outil Sélection, `js/profedit.js`) : le profil survolé (symbole ou numéro) passe en surbrillance ;
  clic droit : Déplacer (le profil suit le curseur le long de son axe avec son nom et son PK, posé au clic), Ajouter un
  profil avant / après (placé de même entre ses voisins), Ajouter au PK (saisi « 1+234,50 » ou en mètres), Supprimer.
  Nouveaux profils au choix : numérotation reprise (P1, P2… renumérotés) ou suffixe bis, ter… du profil qui précède
  (P12bis) ; « Renuméroter » retire les suffixes. Un profil de série ou de tangence déplacé ou supprimé est retiré de
  la série (prj.prof.skip) et, s'il est déplacé, remplacé par un profil manuel.
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
- **PSGR — passage souterrain à gabarit réduit** (onglet PSGR, calque `GIRA_PSGR`) : la route qui traverse un
  giratoire ou un carrefour en T / X passe en trémie sous le carrefour ; les véhicules hors gabarit et les mouvements
  tournants restent en surface sur les contre-allées. Gabarits PSGR type A (1,90 m, classe de la lettre-circulaire du
  28 juin 1971) et B (2,60 m), RECTUR 2,00 / 2,70 / 3,50 m ou libre ; tube unique à double sens ou deux tubes, 1 ou 2
  voies par sens. Coupe type d'après RECTUR (CETU, 1995) : largeur entre piédroits à 1 m (effet de paroi 1,20 m,
  largeur des véhicules, interdistance), voies, bandes dérasées, trottoirs, Hm = G + revanche de signalisation,
  revanches de protection et de construction. Profil en long symétrique : fond sous la couverture, rentrant Rr, rampe,
  saillant Rs ; contrôles de déclivité (6 % ; 9 % en dérogation) et des rayons minimaux (visibilité, confort). Plan :
  centré sur l'axe en plan de la route traversante (point le plus proche du centre du carrefour ; branches dessinées à la
  main, sans route d'origine : route du projet passant à moins de 40 m du centre dans leur direction) et tracé le long de cet axe,
  courbes comprises : couverture, trémies ouvertes, piédroits, musoirs ; signalisation de tri (présignalisation B12 + panonceau, portique
  de détection des hors-gabarit, B12 sur le musoir, gabarit physique à l'entrée). TPC des branches adaptables à la
  trémie ; exports DXF du profil en long et de la coupe type. Le dossier-guide PSGR du SETRA (annexe II de la
  circulaire de 1971) n'étant pas disponible, les valeurs non citées par RECTUR sont celles de la classe RECTUR voisine.
- **Chaussées (onglet dédié, bureau de calcul de chaussee.ksr-infra.org ; `chaussee/`)** : tout le bureau de calcul
  du dépôt dimchaussee, avec son menu latéral par groupes — Projet et tableau de bord ; Données (trafic, sols et
  plateforme GTR, fiches matériaux) ; Chaussée neuve (catalogue, dimensionnement) ; Renforcement (auscultation,
  rétrocalcul, renforcement) ; Calcul (Burmister, structure) — et ses notes de calcul imprimables. L'onglet prend toute
  la largeur (le plan revient avec « ◧ Plan » ou un autre onglet). Le bureau tourne dans un cadre de même origine, qui
  isole ses styles clairs de l'interface : ses modules sont copiés **sans modification** par
  `python3 tools/sync-chaussee.py [chemin/vers/dimchaussee]` (fermeture des imports de bureau.js, à relancer après
  chaque évolution du bureau). La page des **fiches matériaux** (lien « Toutes les fiches de ce référentiel ») est copiée
  aussi, avec un retour au bureau ; tout autre lien vers le site (cours, exerciseur) s'ouvre sur chaussee.ksr-infra.org
  dans un nouvel onglet (`chaussee/ksr-liens.js`) au lieu de charger une page absente dans le cadre. Son état (tous les modules et le cartouche) est **joint au fichier projet INFRA-KSR** à
  l'enregistrement et restauré à l'ouverture ; ses propres boutons Enregistrer / Ouvrir (fichier du bureau seul)
  restent disponibles.
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
js/ptype.js         profils types des axes construits point par point (BVTrace) : évaluation, D/R, EET, arase
js/pttedit.js       éditeur graphique des demi-profils types
js/talus.js         talus en plan : EET, barbules, découpe entre axes
js/viewer.js        rendu canvas (projet, DXF, HUD)
js/geom.js          géométrie (droites, arcs, raccordements, décalages)
js/clotho.js        alignements en plan avec clothoïdes (raccordements progressifs)
js/axisimport.js    axe (sommets, R, clothoïdes) reconstitué depuis une ligne KMZ / KML
js/uvr.js           déclencheurs UVR, sections A–E, transitions et aménagements du Guide M1, V85 géométrique, E.4.2
js/uvrtab.js        onglet Vitesses / UVR : OpenStreetMap (Overpass), KMZ, saisie, dessin sur le plan, page imprimable
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

- Carrefour cacahuète : branches raccordées aux arcs circulaires des lobes seulement (pas sur les cols) ; capacité
  (Girabase) et quart gauche de visibilité calculés sur le cercle du lobe (approximation) ; la trajectoire en S au
  droit d'un col est signalée mais son rayon n'est pas calculé.
- Les largeurs par défaut de BDD (1,00 m), BDG (0,50 m) et berme (1,50 m) en interurbain sont des valeurs de départ
  à ajuster dans l'onglet Profil ; elles ne sont pas tirées du guide.
- Carrefours en T et en X : abords (trottoirs, berme) et îlots dessinés ; la BDD n'est pas encore appliquée. Les
  branches secondaires suivent un axe courbe ; la route principale reste droite (zones de TAG en alignement).
- Voie directe de tourne-à-droite : rayon et largeur réglables ; largeur d'îlot et longueurs fixées (ACI, réduites en urbain) ;
  la clothoïde d'entrée et la variante « réinsertion avec cédez-le-passage » ne sont pas dessinées.
- Capacité des carrefours plans : piétons, traversée en deux temps et pente des secondaires non pris en compte.
