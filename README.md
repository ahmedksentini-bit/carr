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
- **Fonds** : Esri World Imagery, OpenStreetMap, Esri Topo ; recherche de lieu (Nominatim) ou saisie « lat, lon ».
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
- **Dévers** : anneau à dévers imposé de 1,5 % vers l'extérieur, constant sur site en pente (ou cône sur plan incliné),
  profil en long des rives, variation des dévers de chaque branche, flèches de dévers sur le plan.
- **Contrôles** : comparaison des valeurs aux recommandations du guide, excentrement des axes, déflexion,
  chevauchement des raccordements, pentes transversales.
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

## Mise en ligne sur gira.ksr-infra.org

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
- le dévers courant urbain (2 %) et le recul de la tête d'îlot (0,50 m) sont des valeurs usuelles, non tirées du guide ;
- la **déflexion** est estimée par la méthode des trois points (cercle passant à 2 m des bordures et à 1,50 m de l'îlot central) : c'est une approximation de l'épure.

Pour les carrefours plans :

- l'îlot de la branche secondaire est simplifié (triangle de hauteur 4l, tête arrondie) : la répartition 0,55l / 1,45l
  de la base et les rayons Rre = 8l, Rrs = 16l de la figure ACI ne sont pas reproduits fidèlement ;
- l'îlot central en saillie est dessiné à 0,30 m (5u) en retrait de l'enveloppe peinte, et seulement si a ≥ 1,20 m ;
- en urbain, le guide CERTU renvoie à l'épure de giration pour les rayons : la valeur par défaut de 8 m est à vérifier ;
- le raccordement du dévers de la secondaire sur le bord de la principale n'est pas décrit par l'ACI (modèle de principe).

L'altimétrie est un modèle de principe (avant-projet) : elle ne remplace pas un calcul de profils sur MNT.

## Prochaines étapes prévues

1. Calcul de capacité type Girabase à l'heure de pointe du matin (matrice origine-destination saisie par l'utilisateur).
2. Aide à la décision pour les tourne-à-droite directs (by-pass) et dessin de ces voies
   (ACI : biseau de décélération ≥ 80 m, rayon intérieur ≥ 40 m, voie de 4 m).
