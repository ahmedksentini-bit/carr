#!/usr/bin/env python3
"""Copie le bureau de calcul des chaussées (dépôt dimchaussee, site/bureau.html) dans carr/chaussee/.

Onglet « Chaussées » d'INFRA-KSR : le bureau tourne tel quel dans un cadre (iframe) de même origine — ses styles
clairs et ses sélecteurs globaux (body, input, table…) restent ainsi isolés de l'interface sombre d'INFRA-KSR.
Les modules JS sont copiés SANS modification : seule la page d'accueil du cadre (bureau.html) est réécrite (pas de
bandeau de site, pas de manifeste). Relancer après chaque évolution du bureau :

    python3 tools/sync-chaussee.py [chemin/vers/dimchaussee]

La fermeture des imports part de socle.js, bureau.js et tableaux.js (comme la page bureau.html du site).
"""
import os
import re
import shutil
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
CARR = os.path.dirname(ICI)
SRC = os.path.join(sys.argv[1] if len(sys.argv) > 1 else os.path.join(CARR, '..', 'dimchaussee'), 'site')
DST = os.path.join(CARR, 'chaussee')
RACINES = ['src/socle.js', 'src/bureau.js', 'src/tableaux.js', 'src/fiches-page.js']
PAGES_LOCALES = {'bureau.html', 'fiches.html'}
IMPORT = re.compile(r'''(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)|import\s+['"](\.[^'"]+)['"]''')

PAGE = '''<!doctype html>
<html lang="fr"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="Bureau de calcul des chaussées (chaussee.ksr-infra.org) dans INFRA-KSR">
<link rel="icon" href="assets/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="enhancements.css">
<link rel="stylesheet" href="site.css">
<style>
  /* dans l'onglet d'INFRA-KSR : pas de bandeau de site, toute la largeur du cadre */
  main.main-bureau { max-width: none; padding: 14px 16px 40px; }
  .software-sidebar { max-height: calc(100vh - 28px) !important; top: 14px !important; }
</style>
<title>Bureau de calcul — Chaussées</title>
</head><body class="page-bureau">
<main id="app" tabindex="-1" class="main-bureau">
  <p class="method-note">Chargement du bureau de calcul…</p>
</main>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
<input type="file" id="fichierImport" accept="application/json,.json" hidden>
<noscript>Activez JavaScript pour utiliser le bureau de calcul.</noscript>
<script src="ksr-liens.js"></script>
<script type="module" src="src/socle.js"></script>
<script type="module" src="src/bureau.js"></script>
<script type="module" src="src/tableaux.js"></script>
</body></html>
'''

FICHES = '''<!doctype html>
<html lang="fr"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="assets/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="enhancements.css">
<link rel="stylesheet" href="site.css">
<style>main { max-width: none; padding: 14px 16px 40px; } .retour { display: inline-block; margin-bottom: 10px; font-weight: 800; color: var(--blue); text-decoration: none; }</style>
<title>Fiches matériaux — Chaussées</title>
</head><body>
<main id="app" tabindex="-1">
  <a class="retour" href="bureau.html">← Retour au bureau de calcul</a>
  <section class="chapter-banner"><span class="num">≡</span>
    <div><h1 id="fichesTitre">Fiches matériaux</h1>
    <p>Les fiches des matériaux de chaussée des cinq référentiels du cours : emploi, normes de produit,
       d'essai et de mise en œuvre, exigences et paramètres de calcul. Ce sont elles qui passent dans le CCTP.</p></div></section>
  <div class="card" style="margin-top:17px">
    <h2>Référentiels</h2>
    <ul class="chapitre-sommaire" id="fichesSommaire"><li class="method-note">Chargement…</li></ul>
  </div>
  <div id="fichesContenu"></div>
</main>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
<noscript>Activez JavaScript pour afficher les fiches.</noscript>
<script src="ksr-liens.js"></script>
<script type="module" src="src/socle.js"></script>
<script type="module" src="src/fiches-page.js"></script>
<script type="module" src="src/tableaux.js"></script>
</body></html>
'''

# Liens vers les pages du site chaussee qui ne sont pas copiées (cours, exerciseur, chapitres…) : ouverts sur
# chaussee.ksr-infra.org dans un nouvel onglet, au lieu de charger une page absente dans le cadre.
LIENS = '''// Garde-fou des liens du bureau des chaussées dans INFRA-KSR (produit par tools/sync-chaussee.py).
(function () {
  var LOCALES = %s, SITE = "https://chaussee.ksr-infra.org/";
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || a.target === "_blank" || e.defaultPrevented) return;
    var u;
    try { u = new URL(a.getAttribute("href"), location.href); } catch (err) { return; }
    if (u.origin !== location.origin) return;
    var base = location.pathname.replace(/[^/]*$/, ""), rel = u.pathname.indexOf(base) === 0 ? u.pathname.slice(base.length) : null;
    if (rel === null || rel === "" || LOCALES.indexOf(rel) >= 0) return;
    e.preventDefault();
    window.open(SITE + rel + u.search + u.hash, "_blank", "noopener");
  }, true);
})();
''' % repr(sorted(PAGES_LOCALES)).replace("'", '"')


def fermeture():
    vus, pile = set(), list(RACINES)
    while pile:
        f = os.path.normpath(pile.pop())
        if f in vus:
            continue
        chemin = os.path.join(SRC, f)
        if not os.path.exists(chemin):
            raise SystemExit(f'fichier importé introuvable : {f}')
        vus.add(f)
        with open(chemin, encoding='utf-8') as h:
            texte = h.read()
        for m in IMPORT.finditer(texte):
            pile.append(os.path.join(os.path.dirname(f), m.group(1) or m.group(2) or m.group(3)))
    return sorted(vus)


def main():
    if not os.path.isdir(SRC):
        raise SystemExit(f'site du bureau introuvable : {SRC}')
    fichiers = fermeture() + ['styles.css', 'enhancements.css', 'site.css', 'assets/icon.svg']
    if os.path.isdir(DST):
        shutil.rmtree(DST)
    for f in fichiers:
        os.makedirs(os.path.dirname(os.path.join(DST, f)), exist_ok=True)
        shutil.copy2(os.path.join(SRC, f), os.path.join(DST, f))
    for nom, texte in (('bureau.html', PAGE), ('fiches.html', FICHES), ('ksr-liens.js', LIENS)):
        with open(os.path.join(DST, nom), 'w', encoding='utf-8') as h:
            h.write(texte)
    # socle.js enregistre « sw.js » : un service worker vide (aucun cache, aucune interception) évite le 404 —
    # INFRA-KSR sert le bureau en ligne, comme le reste de l'application
    with open(os.path.join(DST, 'sw.js'), 'w', encoding='utf-8') as h:
        h.write('// Service worker vide : le bureau des chaussées est servi en ligne par INFRA-KSR (pas de cache hors ligne).\n'
                'self.addEventListener("install", () => self.skipWaiting());\n'
                'self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));\n'
                'self.addEventListener("message", (e) => { if (e.data?.type === "version") e.ports[0]?.postMessage({ version: "infra-ksr" }); });\n')
    taille = sum(os.path.getsize(os.path.join(DST, f)) for f in fichiers)
    print(f'{len(fichiers)} fichiers copiés dans chaussee/ ({taille // 1024} Ko) + bureau.html, fiches.html')


if __name__ == '__main__':
    main()
