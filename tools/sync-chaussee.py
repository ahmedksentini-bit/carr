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
RACINES = ['src/socle.js', 'src/bureau.js', 'src/tableaux.js']
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
<script type="module" src="src/socle.js"></script>
<script type="module" src="src/bureau.js"></script>
<script type="module" src="src/tableaux.js"></script>
</body></html>
'''


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
    with open(os.path.join(DST, 'bureau.html'), 'w', encoding='utf-8') as h:
        h.write(PAGE)
    # socle.js enregistre « sw.js » : un service worker vide (aucun cache, aucune interception) évite le 404 —
    # INFRA-KSR sert le bureau en ligne, comme le reste de l'application
    with open(os.path.join(DST, 'sw.js'), 'w', encoding='utf-8') as h:
        h.write('// Service worker vide : le bureau des chaussées est servi en ligne par INFRA-KSR (pas de cache hors ligne).\n'
                'self.addEventListener("install", () => self.skipWaiting());\n'
                'self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));\n'
                'self.addEventListener("message", (e) => { if (e.data?.type === "version") e.ports[0]?.postMessage({ version: "infra-ksr" }); });\n')
    taille = sum(os.path.getsize(os.path.join(DST, f)) for f in fichiers)
    print(f'{len(fichiers)} fichiers copiés dans chaussee/ ({taille // 1024} Ko) + bureau.html')


if __name__ == '__main__':
    main()
