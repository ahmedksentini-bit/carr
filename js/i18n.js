// i18n.js — interface en français ou en arabe (bouton de langue de la barre du haut).
// Les textes restent écrits en français dans le code. En arabe, chaque texte affiché (nœuds texte, title, placeholder,
// aria-label) est traduit par le dictionnaire i18n-ar.js : clé = texte français aux espaces réduits, les nombres étant
// remplacés par # (ils sont recopiés dans le même ordre, ou selon {1}, {2}… dans la traduction). Un MutationObserver
// traduit aussi ce que l'application réécrit (panneaux, contrôles, messages). Un texte absent du dictionnaire reste
// en français. Le plan (canevas), les cotes et les exports DXF, PDF et CSV restent en français.
import { AR, AR_PREFIX, AR_KEYS } from './i18n-ar.js';

const NUM = /[-−+]?\d+(?:[.,]\d+)*/g;
const SKIP = 'script,style,canvas,textarea,[translate="no"]';
const ATTRS = ['title', 'placeholder', 'aria-label'];
const LRI = '⁦', PDI = '⁩';

let lang = 'fr';
try { if (localStorage.getItem('gira.lang') === 'ar') lang = 'ar'; } catch { /* stockage indisponible */ }
export const getLang = () => lang;

// Dans une phrase arabe, une formule ou une cote (« Rg = 22 m », « 15–25 m ») est isolée de gauche à droite pour
// garder l'ordre de lecture des nombres et des opérateurs.
function isolate(s) {
  return s.replace(/\(?[A-Za-z0-9ΔÀ-ÿ][^؀-ۿ«»،؛؟]*[A-Za-z0-9%°²)ΔÀ-ÿ]/g, (m) => {
    while (m.endsWith(')') && (m.match(/\(/g) || []).length < (m.match(/\)/g) || []).length) m = m.slice(0, -1);
    return /[\s=<>≤≥×·/–→+−-]/.test(m) && (m.match(/\(/g) || []).length === (m.match(/\)/g) || []).length ? LRI + m + PDI : m;
  });
}

function lookup(k) {
  let v = AR[k];
  if (v === undefined) {
    const nums = k.match(NUM);
    if (nums) {
      v = AR[k.replace(NUM, '#')];
      if (v !== undefined) { let i = 0; v = v.replace(/\{(\d)\}|#/g, (m, j) => nums[j ? j - 1 : i++] ?? m); }
    }
  }
  if (v === undefined) {
    for (const p in AR_PREFIX) if (k.startsWith(p)) { v = AR_PREFIX[p] + k.slice(p.length); break; }
  }
  return v;
}

// Traduction d'un texte français (null s'il n'est pas au dictionnaire) ; les espaces de bord sont conservés.
function tr(s) {
  const k = s.replace(/\s+/g, ' ').trim();
  if (!k) return null;
  const v = lookup(k);
  if (v === undefined) return null;
  return s.match(/^\s*/)[0] + isolate(v) + s.match(/\s*$/)[0];
}

// Pour les textes passés à confirm() ou construits en JS.
export const t = (s) => (lang === 'ar' ? tr(s) ?? s : s);

// Texte d'origine et traduction posée, par nœud texte et par attribut : on reconnaît ainsi un texte réécrit par
// l'application (à traduire de nouveau) et on sait rétablir le français.
const textOrig = new WeakMap(), attrOrig = new WeakMap();

function trText(n) {
  const p = n.parentElement;
  if (!p || p.closest(SKIP)) return;
  const o = textOrig.get(n);
  if (o && n.data === o.ar) return;
  const key = p.closest('kbd') && AR_KEYS[n.data.trim()]; // touches du clavier : Entrée → Enter…
  const ar = key ? n.data.replace(n.data.trim(), key) : tr(n.data);
  if (ar == null) { textOrig.delete(n); return; }
  textOrig.set(n, { fr: n.data, ar });
  n.data = ar;
}

function trAttr(el, a) {
  if (!el.hasAttribute(a) || el.closest(SKIP)) return;
  const cur = el.getAttribute(a);
  let m = attrOrig.get(el);
  const o = m && m[a];
  if (o && cur === o.ar) return;
  const ar = tr(cur);
  if (ar == null) { if (o) delete m[a]; return; }
  if (!m) attrOrig.set(el, (m = {}));
  m[a] = { fr: cur, ar };
  el.setAttribute(a, ar);
}

function trTree(root) {
  if (root.nodeType === Node.TEXT_NODE) { trText(root); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) trText(n);
  for (const el of [root, ...root.querySelectorAll('[title],[placeholder],[aria-label]')]) for (const a of ATTRS) trAttr(el, a);
}

function restoreTree(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const o = textOrig.get(n);
    if (o && n.data === o.ar) n.data = o.fr;
    textOrig.delete(n);
  }
  for (const el of root.querySelectorAll('[title],[placeholder],[aria-label]')) {
    const m = attrOrig.get(el);
    if (!m) continue;
    for (const a in m) if (el.getAttribute(a) === m[a].ar) el.setAttribute(a, m[a].fr);
    attrOrig.delete(el);
  }
}

let title0 = '';

export function setLang(l) {
  lang = l === 'ar' ? 'ar' : 'fr';
  try { localStorage.setItem('gira.lang', lang); } catch { /* stockage indisponible */ }
  const h = document.documentElement;
  h.lang = lang; h.dir = lang === 'ar' ? 'rtl' : 'ltr';
  if (lang === 'ar') trTree(document.body); else restoreTree(document.body);
  document.title = lang === 'ar' ? tr(title0) ?? title0 : title0;
  const b = document.getElementById('btnLang');
  if (b) b.textContent = lang === 'ar' ? 'Français' : 'العربية';
}

export function initLang() {
  title0 = document.title;
  new MutationObserver((list) => {
    if (lang !== 'ar') return;
    for (const m of list) {
      if (m.type === 'characterData') trText(m.target);
      else if (m.type === 'attributes') trAttr(m.target, m.attributeName);
      else for (const a of m.addedNodes) trTree(a);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  document.getElementById('btnLang')?.addEventListener('click', () => setLang(lang === 'ar' ? 'fr' : 'ar'));
  setLang(lang);
}
