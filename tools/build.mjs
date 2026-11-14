// build.mjs — version publiée d'INFRA-KSR. Cloudflare Pages : commande de build « cd tools && npm ci && npm run build »,
// dossier de sortie « dist ». (package.json est dans tools/ : sans réglage, Cloudflare continue de publier la racine.)
//
// Le dépôt garde le code lisible ; le site ne publie que la version de dist/ :
//  1. copie du site (sans tools/, README, fichiers de développement) ;
//  2. JavaScript : commentaires retirés, noms locaux raccourcis (esbuild), puis brouillage des modules de js/
//     (javascript-obfuscator : noms, chaînes regroupées et mélangées — sans aplatissement du flot de contrôle, pour ne
//     pas ralentir les calculs) ; CSS minifié ;
//  3. verrou de domaine : l'application ne démarre que sur ksr-infra.org et ses sous-domaines (les aperçus
//     *.pages.dev, ouverts à tout projet Cloudflare, ne sont pas admis).
//     Une copie du site servie ailleurs (poste local, autre hébergement) affiche un message et s'arrête.
//
// Ce n'est pas une protection absolue (tout code exécuté dans un navigateur peut être lu), mais une copie locale ne
// fonctionne plus telle quelle et le code n'est plus réutilisable sans un long travail de remise en forme.
// ALLOW_HOSTS=hôte1,hôte2 (variable d'environnement) ajoute des hôtes autorisés — essais seulement.
import fs from 'node:fs';
import path from 'node:path';
import { transform } from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'dist');
const SKIP = new Set(['.git', '.github', '.claude', 'node_modules', 'dist', 'tools', 'functions', 'README.md', 'serve.ps1', 'LICENSE', '.gitignore']);
const BANNER = '/* INFRA-KSR — © Ste Ksentini de Sécurité Routière (KSR), Sfax. Tous droits réservés. Reproduction, copie et utilisation hors de https://carr.ksr-infra.org interdites. */';
const HOSTS = ['ksr-infra.org', ...String(process.env.ALLOW_HOSTS || '').split(',').map((s) => s.trim()).filter(Boolean)];

// Garde injectée en tête de js/main.js (avant brouillage) : hôte autorisé, sinon message et arrêt.
const GUARD = `(()=>{const h=location.hostname,ok=${JSON.stringify(HOSTS)}.some((d)=>h===d||h.endsWith('.'+d));if(!ok){document.documentElement.innerHTML='<body style="font:16px system-ui;padding:40px;max-width:640px"><h2>INFRA-KSR</h2><p>Cette application ne fonctionne qu\\'en ligne, à l\\'adresse <a href="https://carr.ksr-infra.org">carr.ksr-infra.org</a>.</p><p>© KSR — tous droits réservés.</p></body>';throw new Error('INFRA-KSR : hôte non autorisé');}})();\n`;

fs.rmSync(OUT, { recursive: true, force: true });
const files = [];
(function copy(rel) {
  for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
    if (!rel && SKIP.has(e.name)) continue;
    const r = path.join(rel, e.name), src = path.join(ROOT, r), dst = path.join(OUT, r);
    if (e.isDirectory()) { fs.mkdirSync(dst, { recursive: true }); copy(r); continue; }
    fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); files.push(r);
  }
})('');

const OBF = {
  compact: true, simplify: true, identifierNamesGenerator: 'hexadecimal', renameGlobals: false,
  stringArray: true, stringArrayThreshold: 0.6, stringArrayRotate: true, stringArrayShuffle: true, stringArrayEncoding: [],
  splitStrings: false, controlFlowFlattening: false, deadCodeInjection: false, selfDefending: false,
  transformObjectKeys: false, unicodeEscapeSequence: false, sourceMap: false,
};
let nJs = 0, nObf = 0, nCss = 0, t0 = Date.now();
for (const r of files) {
  const f = path.join(OUT, r), ext = path.extname(r).toLowerCase();
  if (ext === '.js' && !r.includes(`${path.sep}vendor${path.sep}`)) {
    let code = fs.readFileSync(f, 'utf8');
    if (r === path.join('js', 'main.js')) code = GUARD + code;
    const isModule = /^\s*(import|export)\s/m.test(code);
    const m = await transform(code, { minify: true, legalComments: 'none', target: 'es2020', loader: 'js', ...(isModule ? { format: 'esm' } : {}) });
    code = m.code;
    if (r.startsWith('js' + path.sep)) { code = JavaScriptObfuscator.obfuscate(code, { ...OBF, sourceType: isModule ? 'module' : 'script' }).getObfuscatedCode(); nObf++; }
    fs.writeFileSync(f, `${BANNER}\n${code}`); nJs++;
  } else if (ext === '.css') {
    const m = await transform(fs.readFileSync(f, 'utf8'), { minify: true, loader: 'css', legalComments: 'none' });
    fs.writeFileSync(f, `${BANNER}\n${m.code}`); nCss++;
  }
}
console.log(`dist/ : ${files.length} fichiers, ${nJs} JS minifiés dont ${nObf} brouillés, ${nCss} CSS — hôtes autorisés : ${HOSTS.join(', ')} — ${((Date.now() - t0) / 1000).toFixed(1)} s`);
