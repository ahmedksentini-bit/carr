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
  alignement droit, sifflet, stockage et îlot central en saillie ; branches secondaires avec rayons Re = 2l et Rs = 4l,
  voies sup(l/2 ; 3) et l/2 + 0,50, îlot séparateur de longueur 4l à nez de 1 m en retrait de 1 m ; régime
  cédez-le-passage (T'2) ou STOP ; triangles de visibilité D = V85 × t (8 à 11 s selon régime et TAG).
- **Dessin** : bordures, raccordements tangents, îlots, chaussée, ligne de cédez-le-passage, marquages,
  cotations, triangles de construction, trajectoire de déflexion.
- **Rives peintes et bords de chaussée (giratoire)** : Rg, Ri, le, ls et le triangle de l'îlot sont mesurés aux
  rives peintes ; bords de chaussée à la BDD (extérieur) et à la BDG (îlot central, îlots séparateurs). Îlot
  séparateur : enveloppe peinte = triangle de construction, îlot en saillie en retrait de la BDG, zébra en pointe.
- **Abords** : caniveau, bordure, trottoir et contre-bordure en urbain, berme en interurbain, cotés sur le plan ;
  **profil en travers type** de l'anneau généré automatiquement (onglet Profil, export DXF), avec les vues de
  bordures (3 cm bande franchissable, 6 cm îlot central) et les pentes.
- **Branches** : alignement droit dirigé vers le centre près de l'anneau, puis raccordement à l'axe saisi, qu'elles
  suivent jusqu'au bout (polylignes à plusieurs segments). Le centre se place sur la carte (outil C) ou se déplace
  à la souris ; les branches se réorientent vers lui. Rayon de raccordement de l'axe réglable par branche ; poignées
  de sommet et de milieu de segment (le segment se déplace, les raccordements suivent) ; un « + » au bout extérieur
  de chaque axe en prolonge la saisie.
- **Dévers** : anneau à dévers imposé de 1,5 % vers l'extérieur, constant sur site en pente (ou cône sur plan incliné),
  profil en long des rives, variation des dévers de chaque branche, flèches de dévers sur le plan.
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
js/profile.js       profil en travers type de l'anneau (SVG, DXF)
js/viewer.js        rendu canvas (projet, DXF, HUD)
js/geom.js          géométrie (droites, arcs, raccordements, décalages)
js/dxf-parse.js     lecture DXF        js/dxf-write.js   écriture DXF R12
js/crs.js           systèmes de coordonnées   js/tiles.js   fonds en tuiles
serve.ps1           serveur local de test (Windows, sans Node ni Python)
```

## Tester en local

Les modules JavaScript ne se chargent pas depuis `file://`. Lancer le petit serveur fourni :

```
powershell -ExecutionPolicy Bypass -File serve.ps1
```

puis ouvrir http://localhost:8765/.

## Mise en ligne

Site public : **https://carr.ksr-infra.org/** — Cloudflare Pages, projet `carr` relié à ce dépôt : chaque poussée
sur `main` est déployée automatiquement (adresse technique : carr-7z1.pages.dev). Pour un autre hébergement :

1. Copier tout le dossier (sauf `serve.ps1` et `.claude/`) à la racine du sous-domaine, en HTTPS.
2. Le serveur doit servir les `.js` avec le type `text/javascript` (cas par défaut d'Apache / Nginx / hébergements mutualisés).
3. proj4js est chargé depuis cdnjs ; pour ne dépendre d'aucun CDN, copier `proj4.js` (2.11.0) dans `js/vendor/` et adapter la balise `<script>`.
4. Conditions d'usage des services externes :
   - **Esri World Imagery** : attribution affichée ; pour un usage public soutenu, prévoir une clé ArcGIS (offre gratuite) ou un autre fournisseur.
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

- l'îlot de la branche secondaire est une goutte d'eau symétrique (triangle de hauteur 4l, tête de 1 m de rayon, rive
  peinte à la BDG autour) : la répartition 0,55l / 1,45l
  de la base et les rayons Rre = 8l, Rrs = 16l de la figure ACI ne sont pas reproduits fidèlement ;
- l'îlot central en saillie est dessiné à 0,30 m (5u) en retrait de l'enveloppe peinte, biseau compris (nez arrondi là
  où il ne reste qu'1 m de large), et seulement si a ≥ 1,20 m ;
- en urbain, le guide CERTU renvoie à l'épure de giration pour les rayons : la valeur par défaut de 8 m est à vérifier ;
- le raccordement du dévers de la secondaire sur le bord de la principale n'est pas décrit par l'ACI (modèle de principe).

L'altimétrie est un modèle de principe (avant-projet) : elle ne remplace pas un calcul de profils sur MNT.

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

- Les largeurs par défaut de BDD (1,00 m), BDG (0,50 m) et berme (1,50 m) en interurbain sont des valeurs de départ
  à ajuster dans l'onglet Profil ; elles ne sont pas tirées du guide.
- Carrefours en T et en X : abords (trottoirs, berme) et îlots dessinés ; la BDD et les branches courbes ne sont pas
  encore appliquées.
- Voie directe de tourne-à-droite : rayon et largeur réglables ; largeur d'îlot et longueurs fixées (ACI, réduites en urbain) ;
  la clothoïde d'entrée et la variante « réinsertion avec cédez-le-passage » ne sont pas dessinées.
- Capacité des carrefours plans : piétons, traversée en deux temps et pente des secondaires non pris en compte.
