// signicons.js — pictogrammes des panneaux de signalisation (SVG) : vignettes du tableau et symboles du plan.
// Dessins simplifiés et schématiques des décors réglementaires (IISR), à l'échelle d'une vignette.
const R = '#d7262d', B = '#1d4ed8', Y = '#f5c400', W = '#ffffff', K = '#111111';

const tri = (up, fill = W) => (up
  ? `<path d="M32 5 L59 54 L5 54 Z" fill="${fill}" stroke="${R}" stroke-width="7" stroke-linejoin="round"/>`
  : `<path d="M5 10 L59 10 L32 59 Z" fill="${fill}" stroke="${R}" stroke-width="7" stroke-linejoin="round"/>`);
const disc = (fill = B) => `<circle cx="32" cy="32" r="28" fill="${fill}" stroke="${W}" stroke-width="3"/>`;
const octo = () => `<path d="M20 4 H44 L60 20 V44 L44 60 H20 L4 44 V20 Z" fill="${R}" stroke="${W}" stroke-width="3"/>`;
const rect = (fill = W, stroke = K) => `<rect x="3" y="14" width="58" height="36" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
const panonceau = () => `<rect x="14" y="56" width="36" height="7" fill="${W}" stroke="${K}" stroke-width="1.5"/>`;

const ICONS = {
  // Carrefour à sens giratoire : trois flèches tournant dans le sens antihoraire.
  AB25: () => tri(true) + `<circle cx="32" cy="36" r="9" fill="none" stroke="${K}" stroke-width="4" stroke-dasharray="11 6"/>` +
    `<path d="M39 25 l5 4 l-6 3 Z M22 44 l-1-6 l6 2 Z M42 42 l-5 3 l0-6 Z" fill="${K}"/>`,
  AB3a: () => tri(false),
  AB3b: () => tri(false) + panonceau(),
  AB4: () => octo() + `<text x="32" y="38" font-family="Arial, sans-serif" font-weight="bold" font-size="16" fill="${W}" text-anchor="middle">STOP</text>`,
  AB5: () => tri(false) + `<path d="M26 20 H38 L44 26 V34 L38 40 H26 L20 34 V26 Z" fill="${R}"/>` + panonceau(),
  AB2: () => tri(true) + `<path d="M32 22 V50 M20 36 H44" stroke="${K}" stroke-width="5"/>`,
  AB6: () => `<path d="M32 3 L61 32 L32 61 L3 32 Z" fill="${W}"/><path d="M32 10 L54 32 L32 54 L10 32 Z" fill="${Y}"/>`,
  'B21-1': () => disc() + `<path d="M22 44 A12 12 0 1 1 42 44" fill="none" stroke="${W}" stroke-width="5"/><path d="M42 44 l-8 -2 l6 -6 Z" fill="${W}"/>`,
  B21a1: () => disc() + `<path d="M22 20 L42 44" stroke="${W}" stroke-width="6"/><path d="M46 48 l-12 -3 l6 -8 Z" fill="${W}"/>`,
  // Hauteur limitée (B12) : disque blanc à bord rouge, hauteur entre deux flèches ; B12M : avec panonceau de distance.
  B12: () => `<circle cx="32" cy="32" r="27" fill="${W}" stroke="${R}" stroke-width="7"/><path d="M32 12 l-5 6 h10 Z M32 52 l-5 -6 h10 Z" fill="${K}"/><text x="32" y="37" font-family="Arial, sans-serif" font-weight="bold" font-size="13" fill="${K}" text-anchor="middle">h</text>`,
  B12M: () => `<circle cx="32" cy="27" r="22" fill="${W}" stroke="${R}" stroke-width="6"/><path d="M32 11 l-4 5 h8 Z M32 43 l-4 -5 h8 Z" fill="${K}"/><text x="32" y="31" font-family="Arial, sans-serif" font-weight="bold" font-size="11" fill="${K}" text-anchor="middle">h</text>` + panonceau(),
  // Portique de détection des véhicules hors gabarit (PDH) et gabarit physique à l'entrée de la trémie (GAB).
  PDH: () => `<path d="M8 58 V12 H56 V58" fill="none" stroke="${K}" stroke-width="5"/><path d="M14 18 H50" stroke="${Y}" stroke-width="5" stroke-dasharray="6 4"/><circle cx="32" cy="34" r="7" fill="${R}"/>`,
  GAB: () => `<path d="M8 58 V12 H56 V58" fill="none" stroke="${K}" stroke-width="5"/><path d="M8 14 H56" stroke="${R}" stroke-width="7" stroke-dasharray="7 5"/><path d="M32 24 V50 M27 29 l5 -6 l5 6 M27 45 l5 6 l5 -6" fill="none" stroke="${K}" stroke-width="3"/>`,
  J5: () => `<rect x="4" y="4" width="56" height="56" fill="${B}" stroke="${W}" stroke-width="3"/><path d="M12 18 L32 46 L52 18" fill="none" stroke="${W}" stroke-width="8" stroke-linejoin="round"/>`,
  D42b: () => rect(B, W) + `<circle cx="32" cy="32" r="8" fill="none" stroke="${W}" stroke-width="3"/><path d="M32 24 V17 M32 40 V47 M24 32 H16 M40 32 H48" stroke="${W}" stroke-width="3"/><path d="M29 17 l3 -4 l3 4 Z M45 29 l4 3 l-4 3 Z" fill="${W}"/>`,
  D21: () => `<path d="M3 16 H50 L61 32 L50 48 H3 Z" fill="${W}" stroke="${K}" stroke-width="3"/><text x="27" y="37" font-family="Arial, sans-serif" font-size="13" fill="${K}" text-anchor="middle">SORTIE</text>`,
  D20: () => `<path d="M3 16 H50 L61 32 L50 48 H3 Z" fill="${W}" stroke="${K}" stroke-width="3"/><path d="M10 32 H40" stroke="${K}" stroke-width="4"/>`,
  D31: () => `<path d="M3 16 H50 L61 32 L50 48 H3 Z" fill="${W}" stroke="${K}" stroke-width="3"/><path d="M10 40 H30 V24" fill="none" stroke="${K}" stroke-width="4"/><path d="M30 20 l-5 7 h10 Z" fill="${K}"/>`,
  D40: () => rect() + `<path d="M14 42 V22 M14 22 H30 M30 22 V42 M30 32 H48" fill="none" stroke="${K}" stroke-width="3"/><path d="M48 28 l6 4 l-6 4 Z" fill="${K}"/>`,
  D60: () => rect() + `<path d="M10 24 H46 M10 32 H40 M10 40 H34" stroke="${K}" stroke-width="3"/>`,
  // Plan de gestion des vitesses (uvr.js) : entrée / sortie d'agglomération, zone 30, fin de zone 30, enfants,
  // passage piéton, annonce de zone de modération ; B14-<v> : limitation de vitesse (voir signSVG).
  EB10: () => `<rect x="3" y="16" width="58" height="32" fill="${W}" stroke="${K}" stroke-width="3"/><text x="32" y="36" font-family="Arial, sans-serif" font-weight="bold" font-size="12" fill="${K}" text-anchor="middle">VILLE</text>`,
  EB20: () => `<rect x="3" y="16" width="58" height="32" fill="${W}" stroke="${K}" stroke-width="3"/><text x="32" y="36" font-family="Arial, sans-serif" font-weight="bold" font-size="12" fill="${K}" text-anchor="middle">VILLE</text><path d="M8 44 L56 20" stroke="${R}" stroke-width="5"/>`,
  B30: () => `<rect x="6" y="4" width="52" height="56" fill="${W}" stroke="${K}" stroke-width="3"/><circle cx="32" cy="26" r="16" fill="${W}" stroke="${R}" stroke-width="5"/><text x="32" y="31" font-family="Arial, sans-serif" font-weight="bold" font-size="14" fill="${K}" text-anchor="middle">30</text><text x="32" y="55" font-family="Arial, sans-serif" font-weight="bold" font-size="10" fill="${K}" text-anchor="middle">ZONE</text>`,
  B51: () => `<rect x="6" y="4" width="52" height="56" fill="${W}" stroke="${K}" stroke-width="3"/><circle cx="32" cy="26" r="16" fill="${W}" stroke="#888" stroke-width="4"/><text x="32" y="31" font-family="Arial, sans-serif" font-weight="bold" font-size="14" fill="#888" text-anchor="middle">30</text><text x="32" y="55" font-family="Arial, sans-serif" font-weight="bold" font-size="10" fill="#888" text-anchor="middle">ZONE</text><path d="M10 56 L54 8" stroke="${K}" stroke-width="4"/>`,
  A13a: () => tri(true) + `<circle cx="26" cy="27" r="3.5" fill="${K}"/><circle cx="38" cy="29" r="3" fill="${K}"/><path d="M26 31 L24 42 L20 50 M24 42 L28 50 M26 33 L32 37 M38 32 L37 42 L34 50 M37 42 L40 50 M32 37 L38 34" fill="none" stroke="${K}" stroke-width="3" stroke-linecap="round"/>`,
  C20a: () => `<rect x="4" y="4" width="56" height="56" fill="${B}" stroke="${W}" stroke-width="3"/><path d="M32 12 L54 52 H10 Z" fill="${W}"/><circle cx="32" cy="27" r="3.5" fill="${K}"/><path d="M32 31 L31 40 L27 48 M31 40 L36 48 M32 33 L37 37 M32 33 L27 37" fill="none" stroke="${K}" stroke-width="2.6" stroke-linecap="round"/>`,
  ANN: () => rect() + `<text x="32" y="30" font-family="Arial, sans-serif" font-weight="bold" font-size="10" fill="${K}" text-anchor="middle">RALENTIR</text><text x="32" y="43" font-family="Arial, sans-serif" font-size="10" fill="${K}" text-anchor="middle">250 m</text>`,
};
// Limitation de vitesse B14 : disque blanc à bord rouge, valeur au centre (code « B14-50 »).
const b14 = (v) => `<circle cx="32" cy="32" r="27" fill="${W}" stroke="${R}" stroke-width="7"/><text x="32" y="${String(v).length > 2 ? 39 : 41}" font-family="Arial, sans-serif" font-weight="bold" font-size="${String(v).length > 2 ? 19 : 24}" fill="${K}" text-anchor="middle">${v}</text>`;
// Pictogrammes ajoutés par les modules (ex. déclencheurs UVR « UVR:ecole ») : registerIcon(code, () => svgBody).
const EXTRA = {};
export const registerIcon = (code, fn) => { EXTRA[code] = fn; };
const iconOf = (code) => ICONS[code] || EXTRA[code] || (/^B14-\d+$/.test(code) ? () => b14(code.slice(4)) : null);

export const hasIcon = (code) => !!iconOf(code);

// SVG d'un pictogramme (chaîne), taille en pixels CSS.
export function signSVG(code, size = 24) {
  const ic = iconOf(code), body = ic ? ic() : `<rect x="6" y="6" width="52" height="52" fill="${W}" stroke="${K}" stroke-width="3"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${body}</svg>`;
}

const cache = new Map();
// Image du pictogramme pour le canevas (chargée à la demande ; onLoad appelé quand elle est prête).
export function signImage(code, onLoad) {
  let img = cache.get(code);
  if (img) return img;
  img = new Image();
  img.onload = () => onLoad?.();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(signSVG(code, 64));
  cache.set(code, img);
  return img;
}

// Contour (polygone local, unité = largeur du panneau 1) de la forme, pour le DXF : vue de face schématique.
export function signOutline(code) {
  const shape = /^AB4$/.test(code) ? 'octo' : /^(AB(25|2|3a|3b|5)|A13a)$/.test(code) ? (/^AB3|AB5/.test(code) ? 'triDown' : 'triUp')
    : /^AB6$/.test(code) ? 'diamond' : /^B(30|51)$/.test(code) ? 'square' : /^(B|UVR:)/.test(code) ? 'circle' : code === 'J5' || code === 'C20a' ? 'square' : 'rect';
  const h = 0.5, k = Math.sqrt(3) / 2;
  switch (shape) {
    case 'triUp': return [[-h, -k / 2 * 0.7], [h, -k / 2 * 0.7], [0, k * 0.7]];
    case 'triDown': return [[-h, k / 2 * 0.7], [h, k / 2 * 0.7], [0, -k * 0.7]];
    case 'octo': { const o = []; for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i * Math.PI) / 4; o.push([h * Math.cos(a) / Math.cos(Math.PI / 8), h * Math.sin(a) / Math.cos(Math.PI / 8)]); } return o; }
    case 'diamond': return [[0, h], [h, 0], [0, -h], [-h, 0]];
    case 'circle': { const o = []; for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8; o.push([h * Math.cos(a), h * Math.sin(a)]); } return o; }
    case 'square': return [[-h, -h], [h, -h], [h, h], [-h, h]];
    default: return [[-h, -0.3], [h, -0.3], [h, 0.3], [-h, 0.3]];
  }
}
