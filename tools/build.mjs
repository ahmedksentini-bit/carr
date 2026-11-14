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

// Garde de connexion (injectée après la garde de domaine) : au démarrage, la réponse de /lic (Cloudflare Pages
// Function, functions/lic.js) doit arriver et porter l'empreinte attendue ({ a, t, h }, même sel que le serveur) ;
// sinon l'application s'arrête. Ensuite, contrôle toutes les 15 min : après 3 échecs de suite (≈ 45 min sans
// connexion), le projet est enregistré dans le navigateur puis l'application se bloque jusqu'au retour de la
// connexion (contrôle relancé toutes les 30 s). NO_LIC=1 : garde omise (essais locaux seulement).
const SALT = '48f7ad28338a16d062592807';
const LIC = `(()=>{const S='${SALT}',f=(s,e)=>{let h=e>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h.toString(16).padStart(8,'0')},g=(t,o)=>f(t+'|'+o+'|'+S,2166136261)+f(S+'|'+o+'|'+t,33554467);
const ck=async()=>{try{const r=await fetch('/lic?'+Math.random().toString(36).slice(2),{cache:'no-store',credentials:'same-origin'});if(!r.ok)return!1;const j=await r.json();return j&&j.a==='INFRA-KSR'&&Math.abs(Date.now()-j.t)<864e5&&j.h===g(j.t,location.hostname)}catch(e){return!1}};
const stop=(m)=>{document.documentElement.innerHTML='<body style="font:16px system-ui;padding:40px;max-width:640px"><h2>INFRA-KSR</h2><p>'+m+'</p><p>Adresse : <a href="https://carr.ksr-infra.org">carr.ksr-infra.org</a> — © KSR, tous droits réservés.</p></body>'};
let ov=null;const block=()=>{if(ov)return;try{window.dispatchEvent(new Event('pagehide'))}catch(e){}ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.94);color:#fff;font:16px system-ui;display:flex;align-items:center;justify-content:center;text-align:center;padding:30px';ov.innerHTML='<div><h2>INFRA-KSR — connexion requise</h2><p>L\\'application ne fonctionne qu\\'en ligne. Votre projet est conservé dans le navigateur ; le travail reprend dès le retour de la connexion.</p></div>';document.body.appendChild(ov);const w=setInterval(async()=>{if(await ck()){clearInterval(w);ov.remove();ov=null;n=0}},3e4)};
let n=0;(async()=>{let ok=!1;for(let k=0;k<3&&!ok;k++){ok=await ck();if(!ok)await new Promise(r=>setTimeout(r,2500))}if(!ok){stop('Cette application ne fonctionne qu\\'en ligne : la connexion au serveur INFRA-KSR a échoué. Vérifiez votre connexion Internet puis rechargez la page.');return}setInterval(async()=>{if(ov)return;if(await ck())n=0;else if(++n>=3)block()},9e5)})()})();\n`;

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
    if (r === path.join('js', 'main.js')) code = GUARD + (process.env.NO_LIC ? '' : LIC) + code;
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
console.log(`dist/ : ${files.length} fichiers${process.env.NO_LIC ? ' (sans garde de connexion)' : ', garde de connexion /lic'}, ${nJs} JS minifiés dont ${nObf} brouillés, ${nCss} CSS — hôtes autorisés : ${HOSTS.join(', ')} — ${((Date.now() - t0) / 1000).toFixed(1)} s`);
