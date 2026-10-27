#!/usr/bin/env bash
# version.sh — estampille les URL des modules JS et de la feuille de style dans index.html (?v=empreinte), pour que
# les navigateurs chargent la nouvelle version dès la mise en ligne, même si le cache navigateur du domaine est long
# (Cloudflare « Browser Cache TTL »). index.html n'est pas mis en cache. À lancer avant chaque commit qui modifie
# js/ ou css/ :   bash tools/version.sh
set -euo pipefail
cd "$(dirname "$0")/.."
v=$(cat js/*.js css/*.css | sha1sum | cut -c1-10)
{
  echo '  <!-- version:start (généré par tools/version.sh) -->'
  echo "  <link rel=\"stylesheet\" href=\"css/app.css?v=$v\">"
  echo '  <script data-cfasync="false" type="importmap">'
  echo '  { "imports": {'
  n=$(ls js/*.js | wc -l); i=0
  for f in js/*.js; do
    i=$((i + 1)); sep=','; [ "$i" -eq "$n" ] && sep=''
    echo "    \"./$f\": \"./$f?v=$v\"$sep"
  done
  echo '  } }'
  echo '  </script>'
  echo '  <script data-cfasync="false" src="https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.11.0/proj4.js"></script>'
  echo "  <script data-cfasync=\"false\" type=\"module\" src=\"js/main.js?v=$v\"></script>"
  echo '  <!-- version:end -->'
} > tools/.block.html
awk 'BEGIN { skip = 0 }
  /<!-- version:start/ { while ((getline line < "tools/.block.html") > 0) print line; skip = 1; next }
  /<!-- version:end -->/ { skip = 0; next }
  !skip { print }' index.html > tools/.index.html
mv tools/.index.html index.html
rm -f tools/.block.html
echo "index.html : version $v"
