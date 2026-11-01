// psida.js — règles de conception des ponts-dalles reprises du dépôt PSIDA (ahmedksentini-bit/PSIDA : src/conception.js,
// src/abaques1989.js, src/skew.js), d'après le guide SETRA « Ponts-dalles, guide de conception » (1989) : domaine
// d'emploi (§ 1.2), épaisseur (abaques § 3.1), travure (§ 2.1), biais (§ 2.4, § 3.4), abouts (§ 3.2).
// Copie conforme des fonctions pures (pas de calcul de structure ici) ; à resynchroniser si PSIDA évolue.

// ---------------------------------------------------------------- abaques (src/abaques1989.js)
/**
 * Abaques d'épaisseur du guide SETRA « Ponts-dalles – guide de conception » (1989), numérisés à partir du
 * document scanné (200 dpi, suivi de courbes ; précision de lecture ≈ ±0,005 m).
 *
 *  - PSI.DA (béton armé, B25, charges du Fascicule 61 classe I–II, 2 voies) — § 3.1.3, pages 65 à 67 :
 *      DA1 : travée indépendante, h(ℓ) ; DA2 : deux travées égales, h(ℓ) ;
 *      DA3 : trois travées, h(ℓ, θℓ) avec ℓ la travée centrale et θℓ la travée de rive ;
 *      DA4 : quatre travées (deux centrales égales ℓ), h(ℓ, θℓ) — minimum vers θ ≈ 0,83 puis la travée de rive gouverne.
 *    Les abaques s'arrêtent à h = 0,40 m (épaisseur pratique minimale). Béton de classe supérieure : × 0,87 (B30), × 0,81 (B35).
 *  - PSI.DP (béton précontraint, classe II, chaussée 7,50 m + 2 trottoirs de 1,25 m) — § 3.1.2, pages 59 à 61 :
 *    valeurs « plateau » (travées de rive ≈ 0,4 à 0,6 ℓ) pour la dalle pleine (B25) et la dalle à larges encorbellements
 *    (« nervurée », B30) ; les courbes montent de 0,015 m (2 travées, θ = 1) à 0,02–0,04 m (3 et 4 travées, θ = 0,8–0,85)
 *    lorsque la travée de rive s'allonge. Épaisseur minimale technique ≈ 0,8 h_éco.
 * Les clés sont les portées ℓ en mètres, les valeurs des couples [θℓ (m), h (m)] ou h (m).
 */
export const DA1 = [[9.5, 0.419], [10, 0.441], [10.5, 0.464], [11, 0.486], [11.5, 0.509], [12, 0.531], [12.5, 0.554], [13, 0.577], [13.5, 0.600], [14, 0.625], [14.5, 0.647]]; // [ℓ, h]
export const DA2 = [[10, 0.433], [10.5, 0.453], [11, 0.472], [11.5, 0.493], [12, 0.514], [12.5, 0.537], [13, 0.558], [13.5, 0.580], [14, 0.602], [14.5, 0.625], [15, 0.647]]; // [ℓ, h]
export const DA3 = {
  10: [[9.5, 0.404], [10, 0.414]],
  11: [[8.5, 0.403], [9, 0.411], [9.5, 0.420], [10, 0.429], [10.5, 0.440], [11, 0.449]],
  12: [[5.5, 0.402], [6, 0.404], [6.5, 0.407], [7, 0.410], [7.5, 0.415], [8, 0.420], [8.5, 0.426], [9, 0.433], [9.5, 0.441], [10, 0.449], [10.5, 0.459], [11, 0.468], [11.5, 0.479], [12, 0.489]],
  13: [[5.5, 0.432], [6, 0.433], [6.5, 0.435], [7, 0.438], [7.5, 0.441], [8, 0.445], [8.5, 0.450], [9, 0.456], [9.5, 0.462], [10, 0.469], [10.5, 0.478], [11, 0.486], [11.5, 0.495], [12, 0.504], [12.5, 0.515], [13, 0.525]],
  14: [[6, 0.463], [6.5, 0.464], [7, 0.466], [7.5, 0.469], [8, 0.472], [8.5, 0.476], [9, 0.481], [9.5, 0.487], [10, 0.492], [10.5, 0.499], [11, 0.506], [11.5, 0.514], [12, 0.522], [12.5, 0.532], [13, 0.541], [13.5, 0.553], [14, 0.564]],
  15: [[6.5, 0.494], [7, 0.495], [7.5, 0.497], [8, 0.500], [8.5, 0.503], [9, 0.507], [9.5, 0.511], [10, 0.515], [10.5, 0.521], [11, 0.526], [11.5, 0.534], [12, 0.541], [12.5, 0.550], [13, 0.559], [13.5, 0.569], [14, 0.579], [14.5, 0.590], [15, 0.601]],
  16: [[7, 0.526], [7.5, 0.527], [8, 0.529], [8.5, 0.531], [9, 0.534], [9.5, 0.537], [10, 0.541], [10.5, 0.546], [11, 0.551], [11.5, 0.557], [12, 0.564], [12.5, 0.571], [13, 0.579], [13.5, 0.588], [14, 0.597], [14.5, 0.607], [15, 0.616], [15.5, 0.628], [16, 0.638]],
  17: [[7.5, 0.557], [8, 0.558], [8.5, 0.560], [9, 0.562], [9.5, 0.565], [10, 0.568], [10.5, 0.573], [11, 0.577], [11.5, 0.583], [12, 0.589], [12.5, 0.595], [13, 0.602], [13.5, 0.611], [14, 0.618], [14.5, 0.628], [15, 0.636], [15.5, 0.647]],
  18: [[8, 0.589], [8.5, 0.590], [9, 0.592], [9.5, 0.595], [10, 0.597], [10.5, 0.601], [11, 0.604], [11.5, 0.609], [12, 0.613], [12.5, 0.619], [13, 0.625], [13.5, 0.632], [14, 0.638], [14.5, 0.647], [15, 0.654]],
  19: [[8.5, 0.620], [9, 0.621], [9.5, 0.623], [10, 0.625], [10.5, 0.628], [11, 0.630], [11.5, 0.634], [12, 0.638], [12.5, 0.642], [13, 0.647], [13.5, 0.653]],
};
export const DA4 = {
  13.25: [[5.5, 0.493], [6, 0.494], [6.5, 0.495], [7, 0.495], [7.5, 0.495], [8, 0.495], [8.5, 0.494], [9, 0.493], [9.5, 0.492], [10, 0.490], [10.5, 0.488], [11, 0.486], [11.5, 0.497], [12, 0.508], [12.5, 0.520], [13, 0.532]],
  14: [[6, 0.521], [6.5, 0.522], [7, 0.522], [7.5, 0.522], [8, 0.522], [8.5, 0.522], [9, 0.521], [9.5, 0.519], [10, 0.518], [10.5, 0.516], [11, 0.514], [11.5, 0.512], [12, 0.516], [12.5, 0.528], [13, 0.541], [13.5, 0.554], [14, 0.568]],
  15: [[6, 0.558], [6.5, 0.558], [7, 0.559], [7.5, 0.559], [8, 0.559], [8.5, 0.558], [9, 0.558], [9.5, 0.557], [10, 0.555], [10.5, 0.554], [11, 0.552], [11.5, 0.550], [12, 0.548], [12.5, 0.546], [13, 0.557], [13.5, 0.570], [14, 0.582], [14.5, 0.595], [15, 0.609]],
  16: [[7, 0.595], [7.5, 0.595], [8, 0.595], [8.5, 0.595], [9, 0.595], [9.5, 0.594], [10, 0.593], [10.5, 0.592], [11, 0.591], [11.5, 0.589], [12, 0.587], [12.5, 0.585], [13, 0.585], [13.5, 0.589], [14, 0.600], [14.5, 0.612], [15, 0.624], [15.5, 0.637], [16, 0.650]],
  17: [[7, 0.632], [7.5, 0.632], [8, 0.632], [8.5, 0.633], [9, 0.633], [9.5, 0.632], [10, 0.632], [10.5, 0.631], [11, 0.630], [11.5, 0.628], [12, 0.626], [12.5, 0.624], [13, 0.622], [13.5, 0.620], [14, 0.617], [14.5, 0.628], [15, 0.640], [15.5, 0.652], [16, 0.666], [16.5, 0.679], [17, 0.692]],
  18: [[7.5, 0.669], [8, 0.670], [8.5, 0.670], [9, 0.670], [9.5, 0.670], [10, 0.670], [10.5, 0.670], [11, 0.668], [11.5, 0.667], [12, 0.666], [12.5, 0.664], [13, 0.662], [13.5, 0.660], [14, 0.657], [14.5, 0.654], [15, 0.656], [15.5, 0.668], [16, 0.681], [16.5, 0.694], [17, 0.707], [17.5, 0.721], [18, 0.734]],
  19: [[7.5, 0.708], [8, 0.708], [8.5, 0.708], [9, 0.709], [9.5, 0.709], [10, 0.709], [10.5, 0.708], [11, 0.708], [11.5, 0.707], [12, 0.706], [12.5, 0.704], [13, 0.702], [13.5, 0.701], [14, 0.698], [14.5, 0.696], [15, 0.693], [15.5, 0.690], [16, 0.698], [16.5, 0.710], [17, 0.722], [17.5, 0.734]],
};
/** PSI.DP : épaisseur « plateau » h(ℓ) [m], ℓ = travée déterminante (la plus longue) ; N = larges encorbellements. */
export const DP = {
  DP2: [[15, 0.541], [16, 0.571], [17, 0.598], [18, 0.629], [19, 0.660], [20, 0.692]],
  DP2N: [[15, 0.708], [16, 0.742], [17, 0.772], [18, 0.804], [19, 0.836], [20, 0.868], [21, 0.898], [22, 0.927], [23, 0.955], [24, 0.985], [25, 1.013]],
  DP3: [[15, 0.472], [16, 0.494], [17, 0.517], [18, 0.541], [19, 0.564], [20, 0.587], [21, 0.611], [22, 0.635]],
  DP3N: [[15, 0.638], [16, 0.668], [17, 0.697], [18, 0.725], [19, 0.752], [20, 0.779], [21, 0.806], [22, 0.832], [23, 0.859], [24, 0.885], [25, 0.912]],
  DP4: [[15, 0.479], [16, 0.503], [17, 0.527], [18, 0.551], [19, 0.575], [20, 0.599], [21, 0.623], [22, 0.647]],
  DP4N: [[15, 0.645], [16, 0.676], [17, 0.706], [18, 0.735], [19, 0.764], [20, 0.793], [21, 0.820], [22, 0.847], [23, 0.874], [24, 0.899], [25, 0.925]],
};

// ---------------------------------------------------------------- biais (src/skew.js)
/**
 * Angle de biais mécanique φ (grades) — relation empirique du guide (§ 3.4.1), reproduite par CHAMOA :
 *   φ = ψ + (100 − ψ)·(1 − n/2)²  si n < 2,   φ = ψ sinon,
 * n = largeur biaise / portée biaise, la largeur biaise étant Be/sin ψ avec Be la largeur de la dalle
 * rectangulaire équivalente (Be = 12 I/h³ ; = 2b pour une section rectangulaire).
 * Vérifié sur la note CHAMOA (ψ = 80 gr, Be = 12,253 m) : 82,53 gr (L = 10 m) et 86,51 gr (L = 15 m).
 */
export function mechanicalSkew({ psi, Be, L }) {
  if (psi >= 100) return 100;
  const n = (Be / Math.sin(psi * GR)) / L;
  return n < 2 ? psi + (100 - psi) * Math.pow(1 - n / 2, 2) : psi;
}

/** Largeur rectangulaire équivalente Be = 12 I / h³ (CHAMOA) ; 2b si I n'est pas connu. */
export function equivalentWidth({ width, h, I = null }) {
  return I ? 12 * I / Math.pow(h, 3) : width;
}

// ---------------------------------------------------------------- conception (src/conception.js)
const GR = Math.PI / 200; // 1 grade en radians

/** Ordres de grandeur du guide SETRA 1989 (références de paragraphes dans les textes). */
export const GUIDE89 = {
  DA: { portees12: [7, 15], portees3: [6, 18], elancement: { 1: 20, 2: 26, 3: 28 } },
  DP: { portees: [14, 25], porteeMax: 30, encorbellementsConseilles: 20, elancement: { 1: [22, 25], 2: { rect: 28, enc: 25 }, 3: { rect: 33, enc: 28 } }, longueurCablesFilants: 80 },
  travure: { rMin: 0.5, rMinBiais: 0.6, rMax: 0.85, nombreOr: 0.618, hauteurMax4Travees: 8 },
  largeur: { min: 5.5, max: 16, demiTabliers: 15 },
  biais: { phiMecMin: 70, option1DA: 80, option1DP: 70, angleMinFers: 60, deblaiFaible: 75 },
  poidsPropre: [1.2, 2.0], reactions: { culee: 20, pile: 70 }, tassements: { sansRenfort: [0.02, 0.03], avecRenfort: [0.06, 0.07] },
};

/** Coefficient d'épaisseur des dalles BA selon la classe de béton (§ 3.1.3 : abaques B25 ; B30 ×0,87 ; B35 ×0,81). */
export function coefBeton(fck) { return fck >= 35 ? 0.81 : fck >= 30 ? 0.87 : 1; }

/**
 * Domaine d'emploi (§ 1.2) : types de dalle envisageables pour la portée déterminante.
 * @returns {{Lmax:number, n:number, types:string[], level:string, text:string, recommande:'DA'|'DP'|'autre'}}
 */
export function domaineEmploi(spans) {
  const n = spans.length, Lmax = Math.max(...spans);
  const da = n <= 2 ? GUIDE89.DA.portees12 : GUIDE89.DA.portees3;
  const types = [];
  if (Lmax <= da[1]) types.push('DA');
  if (Lmax >= GUIDE89.DP.portees[0] && Lmax <= GUIDE89.DP.porteeMax) types.push(Lmax > GUIDE89.DP.encorbellementsConseilles ? 'DP à encorbellements' : 'DP');
  if (Lmax > GUIDE89.DP.porteeMax) types.push('autre');
  const recommande = types.includes('DA') ? 'DA' : types.includes('autre') ? 'autre' : 'DP';
  let text = `Portée déterminante L_max = ${Lmax} m (${n} travée${n > 1 ? 's' : ''}) : `;
  let level = 'ok';
  if (Lmax < da[0]) { text += `inférieure au domaine économique du pont-dalle BA (${da[0]}–${da[1]} m) — un cadre ou portique (PICF, PIPO) est souvent préférable (§ 1.2.1), sauf grand tirant d'air. `; level = 'info'; }
  else if (types.includes('DA')) text += `domaine économique PSI.DA ${da[0]}–${da[1]} m respecté${Lmax >= GUIDE89.DP.portees[0] ? ` ; plage commune avec le PSI.DP (14–18 m), le choix relève de considérations locales (§ 1.2)` : ''}. `;
  else if (types.includes('DP')) { text += `au-delà du domaine BA (≤ ${da[1]} m) : dalle précontrainte PSI.DP (14–25 m, voire 30 m). `; level = 'warn'; }
  else if (types.includes('DP à encorbellements')) { text += `au-delà du domaine BA : dalle précontrainte à larges encorbellements (économiquement imposés au-delà d'une vingtaine de mètres, § 1.2 et § 2.3.2). `; level = 'warn'; }
  else { text += `au-delà de 25–30 m, le pont-dalle n'est plus adapté : dalle nervurée (PSI.DN), bipoutre mixte, pont à béquilles (PSI.BQ). `; level = 'warn'; }
  return { Lmax, n, types, level, text: text.trim(), recommande };
}

/** Interpolation linéaire sur des couples [x, y] triés ; prolongement linéaire au-delà des bornes (signalé). */
function interp1(pairs, x) {
  const n = pairs.length;
  let i = 0;
  while (i < n - 2 && x > pairs[i + 1][0]) i++;
  const [x0, y0] = pairs[i], [x1, y1] = pairs[i + 1];
  return { y: y0 + (y1 - y0) * (x - x0) / (x1 - x0), extrap: x < pairs[0][0] - 1e-9 || x > pairs[n - 1][0] + 1e-9 };
}
/** Lecture d'une courbe h(θℓ) d'abaque : plateau à gauche (courbes plates), prolongement à droite signalé. */
function curveAt(curve, u) {
  if (u <= curve[0][0]) return { y: curve[0][1], extrap: false };
  return interp1(curve, u);
}

/**
 * Épaisseur des abaques PSI.DA du guide (B25, § 3.1.3) pour une travure quelconque : travée déterminante ℓ et
 * travée de rive θℓ (la plus longue) ; hors du domaine des abaques, l'épaisseur est prolongée à élancement
 * constant et signalée.
 * @returns {{h25:number, L:number, thetaL:number|null, abaque:string, extrap:boolean, note:string}}
 */
export function epaisseurAbaqueDA(spans) {
  const n = spans.length;
  if (n === 1) { const r = interp1(DA1, spans[0]); return { h25: r.y, L: spans[0], thetaL: null, abaque: 'travée indépendante (p. 65)', extrap: r.extrap, note: r.extrap ? 'portée hors de la plage 9,5–14,5 m de l\'abaque, prolongement linéaire' : '' }; }
  if (n === 2) { const L = Math.max(...spans); const r = interp1(DA2, L); return { h25: r.y, L, thetaL: null, abaque: '2 travées égales (p. 65)', extrap: r.extrap, note: (spans[0] !== spans[1] ? 'abaque établi pour deux travées égales, portée la plus longue retenue ; ' : '') + (r.extrap ? 'portée hors de la plage 10–15 m, prolongement linéaire' : '') }; }
  const table = n === 3 ? DA3 : DA4;
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  const central = n === 3 ? [spans[1]] : spans.slice(1, n - 1);
  // § 3.1.3 (p. 64) : 9-14-15-13-8 m → 8-15-15-8 m : travée centrale la plus longue, travée de rive la plus courte (côté sécurité)
  const L = Math.max(...central), thetaL = Math.min(spans[0], spans[n - 1]);
  let note = n >= 5 ? `${n} travées : abaque à 4 travées, plus longue travée intermédiaire et plus courte travée de rive (exemple du guide 9-14-15-13-8 → 8-15-15-8, § 3.1.3) ; ` : '';
  if (n === 4 && spans[1] !== spans[2]) note += 'travées centrales inégales, la plus longue est retenue ; ';
  if (spans[0] !== spans[n - 1]) note += 'travées de rive inégales, la plus courte est retenue (§ 3.1.3, p. 64) ; ';
  const lo = keys[0], hi = keys[keys.length - 1];
  const read = (Lk, u) => curveAt(table[Lk], u);
  let h25, extrap = false;
  if (L < lo - 1e-9 || L > hi + 1e-9) {
    // prolongement à élancement constant à partir de la courbe extrême (même rapport θ)
    const Lk = L < lo ? lo : hi; const r = read(Lk, thetaL * Lk / L); h25 = r.y * L / Lk; extrap = true;
    note += `travée déterminante ${L} m hors de la plage ${lo}–${hi} m de l'abaque, prolongement à élancement constant ; `;
  } else {
    let k0 = keys[0], k1 = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) if (L >= keys[i] - 1e-9 && L <= keys[i + 1] + 1e-9) { k0 = keys[i]; k1 = keys[i + 1]; break; }
    const r0 = read(k0, thetaL), r1 = read(k1, thetaL);
    h25 = k1 === k0 ? r0.y : r0.y + (r1.y - r0.y) * (L - k0) / (k1 - k0);
    extrap = r0.extrap || r1.extrap;
    if (extrap) note += 'travée de rive au-delà de la travée centrale (θ > 1), prolongement de l\'abaque ; ';
  }
  if (h25 < 0.40) note += 'valeur inférieure à 0,40 m, limite basse des abaques (épaisseur pratique minimale) ; ';
  return { h25, L, thetaL, abaque: n === 3 ? '3 travées (p. 66)' : '4 travées (p. 67)', extrap, note: note.replace(/ ; $/, '') };
}

/** Épaisseur « plateau » des abaques PSI.DP (§ 3.1.2) : dalle pleine (B25) ou à larges encorbellements (B30). */
export function epaisseurAbaqueDP(spans, encorbellements = false) {
  const n = Math.min(Math.max(spans.length, 2), 4);
  const L = Math.max(...spans);
  const key = `DP${n}${encorbellements ? 'N' : ''}`;
  const r = interp1(DP[key], L);
  return { h: r.y, L, abaque: key, extrap: r.extrap, note: (spans.length === 1 ? 'travée unique : abaque à 2 travées, le guide conseille ℓ/25 à ℓ/22 ; ' : '') + (r.extrap ? `portée hors de la plage ${DP[key][0][0]}–${DP[key][DP[key].length - 1][0]} m, prolongement linéaire ; ` : '') + 'valeur pour des travées de rive de 0,4 à 0,6 ℓ, à majorer de 0,02 à 0,04 m si θ approche 0,8–1' };
}

/**
 * Épaisseur indicative : abaques du guide (§ 3.1.2 / § 3.1.3) complétés par les élancements courants (§ 1.2).
 * @param {{spans:number[], type?:'DA'|'DP', fck?:number, encorbellements?:boolean}} p
 */
export function epaisseurGuide({ spans, type = 'DA', fck = 25, encorbellements = false }) {
  const n = Math.min(spans.length, 3), Lmax = Math.max(...spans);
  if (type === 'DP') {
    const e = GUIDE89.DP.elancement[n];
    const el = n === 1 ? `1/${e[1]} à 1/${e[0]}` : `1/${encorbellements ? e.enc : e.rect}`;
    const hEl = n === 1 ? Lmax / e[0] : Lmax / (encorbellements ? e.enc : e.rect);
    const ab = epaisseurAbaqueDP(spans, encorbellements);
    const h = ab.h;
    return { type, h, hAbaque: ab.h, hElancement: hEl, range: [0.8 * h, h], elancement: el, hMinTech: 0.8 * h, abaque: ab,
      text: `PSI.DP${encorbellements ? ' à larges encorbellements' : ' (dalle pleine)'} : abaque ${ab.abaque} du guide (§ 3.1.2, classe II, B${encorbellements ? '30' : '25'}) → h_éco ≈ ${h.toFixed(2)} m pour ℓ = ${ab.L} m (${ab.note}) ; élancement courant ${el} → ${hEl.toFixed(2)} m. Épaisseur minimale technique ≈ 0,8 h_éco = ${(0.8 * h).toFixed(2)} m ; ±20 % autour de h_éco ne change le coût que de 2 % au plus.` };
  }
  const e = GUIDE89.DA.elancement[n], k = coefBeton(fck);
  const ab = epaisseurAbaqueDA(spans);
  const hEl = Lmax / e;
  const h25 = ab.h25, h = h25 * k;
  if (h25 < 0.40 && !ab.note.includes('0,40')) ab.note += (ab.note ? ' ; ' : '') + 'valeur inférieure à 0,40 m, limite basse des abaques (épaisseur pratique minimale)';
  return { type: 'DA', h, h25, k, hAbaque: h25, hElancement: hEl, range: [h, Math.max(h, hEl * k)], elancement: `1/${e}`, hMinTech: h, abaque: ab,
    text: `PSI.DA : abaque ${ab.abaque} du guide (§ 3.1.3, B25, charges du Fascicule 61) → h ≈ ${h25.toFixed(2)} m${ab.thetaL ? ` pour ℓ = ${ab.L} m et une travée de rive de ${ab.thetaL} m (θ = ${(ab.thetaL / ab.L).toFixed(2)})` : ` pour ℓ = ${ab.L} m`}${ab.note ? ' — ' + ab.note : ''}${k < 1 ? ` ; × ${k} = ${h.toFixed(2)} m pour un ${fck >= 35 ? 'B35' : 'B30'}` : ''}. Élancement courant ${`1/${e}`} (${n >= 3 ? '3 travées ou plus' : n === 2 ? '2 travées' : 'travée unique'}) → ${hEl.toFixed(2)} m. Sous LM1 Eurocode et pour les dalles larges, l'épaisseur vérifiée est souvent supérieure : utiliser la recherche d'épaisseur.` };
}

/**
 * Propositions de travure pour une longueur totale entre appuis extrêmes (§ 2.1.1 : travées décroissant du
 * milieu vers les culées, 0,5 (0,6 si biais prononcé) ≤ travée de rive / travée adjacente ≤ 0,85).
 * @param {{Ltot:number, psi?:number, r?:number, fck?:number, nList?:number[]}} p  r = rapport rive/adjacente visé
 */
export function proposerTravures({ Ltot, psi = 100, r = 0.7, fck = 25, nList = [1, 2, 3, 4, 5] }) {
  const out = [];
  const rMin = psi < 70 ? GUIDE89.travure.rMinBiais : GUIDE89.travure.rMin;
  const rr = Math.min(Math.max(r, rMin), GUIDE89.travure.rMax);
  for (const n of nList) {
    let spans;
    if (n === 1) spans = [Ltot];
    else if (n === 2) spans = [Ltot / 2, Ltot / 2];
    else if (n === 3) { const c = Ltot / (1 + 2 * rr); spans = [rr * c, c, rr * c]; }
    else if (n === 4) { const c = Ltot / (2 + 2 * rr); spans = [rr * c, c, c, rr * c]; }
    else if (n === 5) { const s = 0.85, c = Ltot / (1 + 2 * s + 2 * s * rr); spans = [rr * s * c, s * c, c, s * c, rr * s * c]; }
    else { const c = Ltot / n; spans = Array(n).fill(c); }
    // arrondi à 0,1 m, la travée centrale absorbant l'écart
    spans = spans.map(v => Math.round(v * 10) / 10);
    const mid = Math.floor(n / 2), diff = Ltot - spans.reduce((a, b) => a + b, 0);
    if (n % 2 === 1) spans[mid] = Math.round((spans[mid] + diff) * 10) / 10;
    else { spans[mid - 1] = Math.round((spans[mid - 1] + diff / 2) * 10) / 10; spans[mid] = Math.round((spans[mid] + diff / 2) * 10) / 10; }
    const dom = domaineEmploi(spans);
    const type = dom.recommande === 'autre' ? 'DP' : dom.recommande;
    const ep = epaisseurGuide({ spans, type, fck, encorbellements: dom.types.includes('DP à encorbellements') });
    const usage = { 1: 'ouverture modérée, grand élancement indispensable ; sinon cadre/portique (§ 1.2.1)', 2: 'appui central (TPC ≥ 3 m), peu d\'appuis, biais faible (ψ > 75 gr) ; +15 % env. par rapport à 4 travées (§ 1.2.2)', 3: 'fort déblai, TPC < 3 m, biais faible ; travée centrale réduite ou grand tirant d\'air (§ 1.2.3)', 4: 'cas le plus courant en passage supérieur : petit déblai ou remblai, biais même important, TPC ≥ 3 m ; tablier à moins de 8 m au-dessus de la voie (§ 1.2.4)', 5: 'ouvrages longs (voies juxtaposées) ; répartition harmonieuse des appuis (§ 1.2.4)' }[n] || '';
    out.push({ n, spans, type, hGuide: ep.h, hRange: ep.range, domaine: dom, usage, ok: dom.recommande !== 'autre' });
  }
  return out;
}

/** Vérification d'une travure donnée (§ 2.1.1) : rapports de rive, décroissance depuis le milieu, parité. */
export function verifierTravure({ spans, psi = 100 }) {
  const items = [], n = spans.length;
  if (n === 1) { items.push({ level: 'info', text: 'Travée unique : culées de préférence en tête ou à mi-hauteur des talus ; comparer à une solution cadre/portique (§ 1.2.1).' }); return items; }
  const rMin = psi < 70 ? GUIDE89.travure.rMinBiais : GUIDE89.travure.rMin, rMax = GUIDE89.travure.rMax;
  const ends = n === 2 ? [[0, 1, 'courte / longue']] : [[0, 1, 'gauche / adjacente'], [n - 1, n - 2, 'droite / adjacente']];
  for (const [i, j, lab] of ends) {
    const r = spans[i] / spans[j];
    let text = `Rapport des travées ${lab} = ${r.toFixed(2)} (guide : ${rMin} ≤ r ≤ ${rMax}${psi < 70 ? ', 0,6 pour biais prononcé' : ''})`;
    let level = 'ok';
    if (n === 2 && r > 1) { text = `Rapport des travées courte / longue = ${(1 / r).toFixed(2)}`; level = 1 / r < rMin ? 'warn' : 'ok'; if (level === 'warn') text += ` < ${rMin} : risque de soulèvement de l'about de la travée courte (§ 1.2.2)`; }
    else if (r < rMin) { level = 'warn'; text += ` — travée de rive trop courte : risque de soulèvement de l'about, appareils d'appui anti-soulèvement coûteux (§ 2.1.1)`; }
    else if (r > rMax && n > 2) { level = 'warn'; text += ` — travée de rive trop longue : aspect et surconsommation d'aciers (§ 2.1.1)`; }
    items.push({ level, text: text + '.' });
  }
  if (n >= 3) {
    const mid = (n - 1) / 2;
    const decroissant = spans.every((L, i) => i === 0 || (i <= mid ? L >= spans[i - 1] - 1e-9 : L <= spans[i - 1] + 1e-9));
    items.push({ level: decroissant ? 'ok' : 'info', text: decroissant ? 'Travées décroissantes du milieu vers les culées : disposition d\'aspect satisfaisant (§ 2.1.1).' : 'Les travées ne décroissent pas régulièrement du milieu vers les culées : effet de désordre possible (§ 2.1.1).' });
    if (n % 2 === 0) items.push({ level: 'info', text: 'Nombre pair de travées : équilibrer les deux travées centrales (égales) et faire décroître vers les culées (§ 2.1.1).' });
  }
  if (n >= 3 && new Set(spans.map(v => v.toFixed(2))).size === 1) items.push({ level: 'info', text: 'Travées toutes égales : monotonie et travées de rive relativement trop longues (r = 1 > 0,85) ; préférer des rives à 0,6–0,85 de la travée adjacente (§ 2.1.1).' });
  return items;
}

/** Proportions des ouvertures (§ 2.1.1 : hauteur / portée ≤ 0,618 ; § 1.2.4 : au-delà de 8 m de hauteur, 3 travées plutôt que 4). */
export function verifierOuvertures({ spans, tirantAir }) {
  const items = [];
  if (!tirantAir) return items;
  spans.forEach((L, j) => { const r = tirantAir / L; if (r > GUIDE89.travure.nombreOr) items.push({ level: 'info', text: `Travée ${j + 1} : hauteur libre / portée = ${r.toFixed(2)} > 0,618 — ouverture étirée verticalement (§ 2.1.1) ; allonger la travée ou supprimer un appui.` }); });
  if (items.length === 0) items.push({ level: 'ok', text: `Hauteur libre / portée ≤ 0,618 pour toutes les travées (nombre d'or, § 2.1.1).` });
  if (tirantAir > GUIDE89.travure.hauteurMax4Travees && spans.length === 4) items.push({ level: 'info', text: `Tablier à plus de 8 m au-dessus de la voie franchie : le 4 travées paraît trop mince et haut perché, préférer 3 travées sans appui sur le terre-plein central (§ 1.2.4).` });
  return items;
}

/** Coupe transversale (§ 2.3). */
export function verifierCoupe({ width, spans, h, type = 'DA' }) {
  const items = [], Lmax = Math.max(...spans), Lmin = Math.min(...spans);
  if (width < GUIDE89.largeur.min || width > GUIDE89.largeur.max) items.push({ level: 'info', text: `Largeur droite ${width} m hors de la plage courante 5,50–16 m (§ 2.3.3).` });
  if (width > GUIDE89.largeur.demiTabliers) items.push({ level: 'warn', text: `Largeur > 15 m : concevoir si possible deux demi-tabliers séparés par un vide ou un joint mince, pour limiter les effets des déformations imposées (tassements de cintre, gradient thermique) (§ 2.3.3).` });
  if (width > Lmin) items.push({ level: 'info', text: `Largeur (${width} m) supérieure à la portée de la travée ${spans.indexOf(Lmin) + 1} (${Lmin} m) : ouvrage « de grande largeur » — efforts transversaux bornés mais ≈ 20 % supérieurs à ceux d'une travée carrée, gradient thermique redistribuant les réactions vers les appareils d'appui de rive (§ 2.3.3).` });
  if (Lmax > GUIDE89.DP.encorbellementsConseilles) items.push({ level: 'info', text: `Portée > 20 m : la dalle rectangulaire devient trop lourde, encorbellements latéraux conseillés (épaisseur 0,20 ± 0,05 m en extrémité, 0,50 ± 0,15 m à la jonction, ≥ 0,22 m pour ancrer une BN4 ; largeur ≈ 1/4 de la largeur totale chacun, portée d'encorbellement ≤ 3,50 m) (§ 2.3.2, § 3.1.1).` });
  items.push({ level: 'info', text: `Dévers transversal minimal 2,5 % (double pente) rattrapé sur la face supérieure de la dalle ; sous-face horizontale (profil bombé, largeur réduite) ou parallèle (profil en toit, grande largeur) avec bossages sous les appareils d'appui (§ 2.3.1).` });
  if (type === 'DA') items.push({ level: 'info', text: `Dalle BA : longueur de tablier sans limite particulière (dilatations) ; dalle BP à câbles filants : ≤ 80 m environ (§ 2.1.2).` });
  return items;
}

/** Biais (§ 2.4, § 3.4.1, § 3.4.2, § 3.4.3). */
export function verifierBiais({ spans, width, h, I = null, psi = 100, type = 'DA' }) {
  const items = [];
  const Be = equivalentWidth({ width, h, I });
  const phiMec = spans.map(L => mechanicalSkew({ psi, Be, L }));
  if (psi >= 100) { items.push({ level: 'ok', text: 'Ouvrage droit (ψ = 100 gr).' }); return { items, phiMec, Be }; }
  const minPhi = Math.min(...phiMec);
  items.push({ level: minPhi >= GUIDE89.biais.phiMecMin ? 'ok' : 'warn', text: `Biais géométrique ψ = ${psi} gr → biais mécanique φ = ${phiMec.map(v => v.toFixed(1)).join(' / ')} gr par travée (φ = ψ + (100 − ψ)(1 − n/2)², n = largeur biaise / portée biaise, Be = ${Be.toFixed(2)} m, § 3.4.1). Guyon-Massonnet (PSIDA, CHAMOA, cet outil) valable pour φ ≳ 70 gr${minPhi < GUIDE89.biais.phiMecMin ? ' — NON RESPECTÉ : calcul par MRB ou éléments finis (§ 2.4)' : ' (§ 2.4)'}.` });
  const lim = type === 'DA' ? GUIDE89.biais.option1DA : GUIDE89.biais.option1DP;
  const angleFers = psi * 0.9;
  if (psi >= lim) items.push({ level: 'info', text: `Direction des fers (§ 3.4.2) : option 1 conseillée — longitudinaux parallèles aux bords libres, transversaux parallèles aux lignes d'appui (angle entre familles ${angleFers.toFixed(0)}° ≥ 60°).` });
  else if (psi >= 70) items.push({ level: 'info', text: `Direction des fers (§ 3.4.2) : ψ entre 70 et 80 gr — option 1 (transversaux parallèles aux lignes d'appui, angle ${angleFers.toFixed(0)}°) ou option 2 (transversaux perpendiculaires aux bords libres), au choix pratique.` });
  else items.push({ level: 'warn', text: `Direction des fers (§ 3.4.2) : biais prononcé (ψ < 70 gr) — option 2 (fers parallèles et perpendiculaires aux bords libres) ; l'option 1 donnerait un angle de ${angleFers.toFixed(0)}° entre familles${angleFers < 60 ? ' < 60°' : ', proche de la limite de 60°'}.` });
  items.push({ level: 'info', text: `Appuis (§ 2.5) : appareils d'appui disposés suivant le biais, ou appuis intermédiaires ponctuels pour un ouvrage peu large ; appuis d'extrémité conçus pour l'encastrement en torsion. Culées en retrait de préférence perpendiculaires à l'axe.` });
  if (psi < GUIDE89.biais.deblaiFaible && (spans.length === 2 || spans.length === 3)) items.push({ level: 'info', text: `Biais < 75 gr : les 2 et 3 travées sont réservés aux biais faibles ; 4 travées s'accommode d'un biais important (§ 1.2, schéma p. 17).` });
  if (psi < 50 && spans.length === 1) items.push({ level: 'info', text: 'Travée unique : biais modéré conseillé (ψ ≥ 50 gr, schéma p. 17).' });
  return { items, phiMec, Be };
}

/** Longueur d'about (§ 3.2) : BA 0,1 + 15 D ; BP 0,5 (1 + |cot ψ|), mesurée suivant l'axe. */
export function longueurAbout({ type = 'DA', psi = 100, D = 0.02 }) {
  return type === 'DA' ? 0.1 + 15 * D : 0.5 * (1 + Math.abs(1 / Math.tan(psi * GR)));
}
