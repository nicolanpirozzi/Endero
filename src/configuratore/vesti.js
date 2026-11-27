// La camicia che cambia con le scelte del riquadro (proprietario, 2026-11-25 e 26; docs/direzione-creativa.md, punto 16):
// il tessuto scelto la colora, e il collo, il taschino e le iniziali compaiono mentre si configura.
//
// Il riquadro avvisa all'avvio e a ogni cambio:
//   document.dispatchEvent(new CustomEvent('endero:camicia', { detail: { collo: 'francese', taschino: true,
//     iniziali: { posizione: 'polso' | 'collo' | 'cuore', lettere: 'NP' } | null,
//     tessuto: 't0515', taschino_tessuto: '', polsino_tessuto: '' } }))
//
// Senza tessuto la camicia è quella bianca calcolata da Blender, e collo e taschino sono pezzi che le si sovrappongono
// (public/camicia/opzioni/, fatti da camicia/opzioni/ sulla stessa scena: stessa luce, sovrapposti non si vedono
// giunte). Con un tessuto la camicia si compone tutta insieme (bianca, con il suo collo e il suo taschino) e si tinge
// in un colpo (tinta.js): una tela sola, senza pezzi con una grana diversa. Polsini e taschino possono avere un
// tessuto loro. Le iniziali sono lettere disegnate nel punto scelto, come un ricamo piccolo e fine.
// La camicia sta su più livelli, sempre negli stessi punti del fotogramma 1800 x 1000:
// - sull'immagine ferma (`.configura__vesti`): i pezzi bianchi e, sopra, la camicia tinta con la sua parete. Durante
//   la guida alle misure (zoom e tratteggi) la tinta si toglie e resta la camicia bianca di riferimento, con i pezzi
//   nella grandezza quadrupla quando serve;
// - sulla camicia che dondola (leggera.js: un elemento con la sua stessa trasformazione);
// - dentro il tessuto che ondeggia (onda.js: la tela composta, rifatta solo quando le scelte cambiano);
// - nel riquadro con lo zoom del telefono (guida.js, solo nel passo Misure: i pezzi bianchi).
// Un pezzo nuovo compare con una dissolvenza breve sopra il vecchio, che va via dopo: mai un lampo di camicia senza
// collo. Se un file manca la camicia resta com'era. Finché non si sceglie nulla non si scarica nulla. Quando una
// scelta chiede un lavoro più lungo compare la rotella «filo che cuce» (parole del proprietario).

const ridotto = matchMedia('(prefers-reduced-motion: reduce)');
const SVG = 'http://www.w3.org/2000/svg';
const DISSOLVE = 200;                  // millisecondi: la comparsa di un pezzo nuovo (la stessa durata è nel CSS)
const FILO = '#0f285e';                // il blu del logo: il filo delle iniziali finché il cliente non ne sceglie uno
const POSTI = ['polso', 'collo', 'cuore'];
const SLOT = ['collo', 'taschino', 'stoffa', 'iniziali'];        // dal basso in alto: la camicia tinta copre i pezzi bianchi
const ATTESA = 350;                    // millisecondi: oltre, compare la rotella «filo che cuce»

// ---------------------------------------------------------------------------------------------- le scelte

/** Le scelte del riquadro, pulite: un collo (un nome), il taschino sì o no, al più tre lettere maiuscole in un posto
 *  con il colore del filo (#rrggbb, o niente), i tessuti (della camicia, del taschino, dei polsini: il nome di un
 *  tessuto o niente). */
function pulisci(d) {
  const ini = d?.iniziali;
  const lettere = typeof ini?.lettere === 'string' ? ini.lettere.toLocaleUpperCase('it').replace(/[^\p{Lu}]/gu, '').slice(0, 3) : '';
  const nome = (v) => (typeof v === 'string' && /^[a-z0-9_-]{1,32}$/.test(v) ? v : '');
  return {
    collo: typeof d?.collo === 'string' ? d.collo : 'italiano',
    taschino: d?.taschino === true,
    iniziali: lettere && POSTI.includes(ini.posizione) ? { posizione: ini.posizione, lettere, colore: /^#[0-9a-f]{6}$/i.test(ini.colore || '') ? ini.colore.toLowerCase() : FILO } : null,
    tessuto: nome(d?.tessuto), taschino_tessuto: nome(d?.taschino_tessuto), polsino_tessuto: nome(d?.polsino_tessuto),
  };
}
// L'ultima scelta si ricorda da subito, anche se arriva prima che la camicia sia pronta
let ultima = null;
const ascolta = new Set();
document.addEventListener('endero:camicia', (e) => { ultima = pulisci(e.detail); for (const f of ascolta) f(ultima); });

// ---------------------------------------------------------------------------------------------- i file

const opzioni = new Map();
/** opzioni.json (l'indirizzo sta nel palco), una volta sola; null se manca. Serve anche a guida.js, per le parti. */
export function leggiOpzioni(palco) {
  const indirizzo = palco?.dataset.opzioni;
  if (!indirizzo) return Promise.resolve(null);
  if (!opzioni.has(indirizzo)) {
    opzioni.set(indirizzo, fetch(indirizzo).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((D) => {
      if (!D) { opzioni.delete(indirizzo); return null; }                 // la rete è caduta: la prossima volta si riprova
      // dove stanno i pezzi e la loro versione (quella dell'indirizzo, messa dal build; se no quella del file)
      const u = new URL(indirizzo, location.href);
      const v = u.searchParams.get('v') || (D.versione != null ? String(D.versione) : '');
      const cartella = u.pathname.slice(0, u.pathname.lastIndexOf('/') + 1);
      D.taglie = (Array.isArray(D.taglie) && D.taglie.length ? D.taglie : [1, 2, 4]).slice().sort((a, b) => a - b);
      D.indirizzo = (file, t) => `${cartella}${file}-${String(t).replace('.', '')}.webp${v ? '?v=' + encodeURIComponent(v) : ''}`;
      return D;
    }));
  }
  return opzioni.get(indirizzo);
}

const immagini = new Map(), pronte = new Map();
/** Quanto si aspetta un file prima di darlo per perso (una rete che si è fermata non risponde né sì né no). */
const PAZIENZA = 20000;
/** Un'immagine scaricata e pronta da disegnare, una volta sola; null se manca o non arriva (senza errori). */
function immagine(indirizzo) {
  if (!immagini.has(indirizzo)) {
    immagini.set(indirizzo, new Promise((fatto) => {
      const im = new Image();
      let chiuso = false;
      // (se manca o non arriva, la prossima volta si riprova)
      const manca = () => { if (chiuso) return; chiuso = true; clearTimeout(attesa); immagini.delete(indirizzo); fatto(null); };
      const attesa = setTimeout(() => { manca(); im.src = ''; }, PAZIENZA);
      im.decoding = 'async';
      im.onload = () => (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => {
        if (chiuso) return;
        if (!im.naturalWidth) { manca(); return; }
        chiuso = true; clearTimeout(attesa);
        pronte.set(indirizzo, im);
        fatto(im);
      });
      im.onerror = manca;
      im.src = indirizzo;
    }));
  }
  return immagini.get(indirizzo);
}

// ---------------------------------------------------------------------------------------------- il tessuto

let trame = null, senzaTinta = false;
/** Ciò che serve a tingere, una volta sola: trame.json (i riquadri e i campioni), i pezzi della camicia che dondola
 *  (la sua immagine ritagliata è la base da tingere) e la macchina che tinge. null se manca qualcosa: allora la
 *  camicia resta bianca. Se è la rete a mancare, la prossima scelta riprova; se è la scheda grafica a non bastare non
 *  si riprova più (ogni tentativo aprirebbe un contesto grafico in più: i browser ne tengono pochi, e a farne le spese
 *  sarebbe il tessuto che ondeggia). */
function leggiTrame(palco) {
  if (trame) return trame;
  const indirizzo = palco.dataset.trame, dove = palco.dataset.leggera || '';
  if (!indirizzo || !dove || senzaTinta) return (trame = Promise.resolve(null));
  const u = new URL(indirizzo, location.href);
  const qui = u.pathname.slice(0, u.pathname.lastIndexOf('/') + 1);
  const v = palco.dataset.leggeraV ? '?v=' + palco.dataset.leggeraV : '';
  const leggi = (x) => {
    const basta = new AbortController(), attesa = setTimeout(() => basta.abort(), PAZIENZA);
    return fetch(x, { signal: basta.signal }).then((r) => (r.ok ? r.json() : null)).catch(() => null).finally(() => clearTimeout(attesa));
  };
  trame = Promise.all([leggi(indirizzo), leggi(dove + 'leggera.json' + v), import('./tinta.js').catch(() => null)]).then(([T, L, m]) => {
    if (!T || !L?.pezzi || !m) return null;
    // la macchina che tinge: se la scheda grafica se la riprende (telefono in secondo piano) se ne fa un'altra, poche volte
    let tingi = m.creaTinta(), rifatte = 0;
    if (!tingi) { senzaTinta = true; return null; }
    const vt = T.versione ? '?v=' + T.versione : u.search;
    return Object.assign(T, {
      pezzi: L.pezzi,
      macchina: () => { if (tingi?.persa() && rifatte++ < 6) tingi = m.creaTinta(); return tingi && !tingi.persa() ? tingi : null; },
      file: (nome) => qui + nome + vt,                                        // trama-*.png, accanto a trame.json
      stoffa: (id) => `${qui}../stoffe/${id}.webp${vt}`,                      // il campione ripetibile di un tessuto
      camicia: (nome) => `${dove}${nome}-2.webp${v}`,                         // camicia, parete, ombra: i pezzi di leggera.js
    });
  });
  trame.then((T) => { if (!T) trame = senzaTinta ? Promise.resolve(null) : null; });
  return trame;
}
/** Quali tessuti vanno su corpo, polsini e taschino, o null se la camicia resta bianca. Un tessuto che non ha il suo
 *  campione non colora nulla; polsini e taschino senza un tessuto loro prendono quello della camicia. */
function stoffe(sc, T) {
  const c = T.tessuti?.[sc.tessuto] ? sc.tessuto : '';
  const p = T.tessuti?.[sc.polsino_tessuto] ? sc.polsino_tessuto : c;
  const k = sc.taschino && T.tessuti?.[sc.taschino_tessuto] ? sc.taschino_tessuto : c;
  return c || p || k ? { corpo: c, polsino: p, taschino: k } : null;
}
const MARGINE = 24;
/** Il riquadro della camicia tinta sull'immagine ferma: quello della camicia ritagliata più un margine di parete. */
const riquadroFermo = (T) => { const [x, y, w, h] = T.pezzi.camicia; return [x - MARGINE, Math.max(0, y - MARGINE), x + w + MARGINE, Math.min(1000, y + h + MARGINE)]; };
/**
 * La camicia composta e tinta: `tela` è la camicia ritagliata (grandezza doppia), `ferma` la stessa sulla sua parete,
 * opaca, per l'immagine ferma (sopra la camicia bianca una camicia ritagliata lascerebbe un filo bianco sui bordi).
 * null se qualcosa manca.
 */
async function tingiCamicia(sc, st, bianchi, T, D) {
  const [x, y, w, h] = T.pezzi.camicia, K = 2;
  const pezzi = ['collo', 'taschino'].map((n) => bianchi[n]).filter(Boolean);
  const tramaDi = { collo: T.colli?.[sc.collo], taschino: sc.taschino ? T.taschino : null };
  const tr = ['collo', 'taschino'].map((n) => (bianchi[n] ? tramaDi[n] : null)).filter(Boolean);
  const tessere = [st.corpo, st.polsino, st.taschino];
  const [foto, base, maschera, parete, ombra, fotoPezzi, tramePezzi, maschere, campioni] = await Promise.all([
    immagine(T.camicia('camicia')), immagine(T.file(T.base.file)), immagine(T.file(T.base.maschera)), immagine(T.camicia('parete')), immagine(T.camicia('ombra')),
    Promise.all(pezzi.map((p) => immagine(D.indirizzo(p.file, K)))), Promise.all(tr.map((p) => immagine(T.file(p.file)))), Promise.all(tr.map((p) => immagine(T.file(p.maschera)))),
    Promise.all(tessere.map((id) => (id ? immagine(T.stoffa(id)) : null))),
  ]);
  if (!foto || !base || !maschera || !parete || !ombra || [...fotoPezzi, ...tramePezzi, ...maschere].some((p) => !p) || tessere.some((id, k) => id && !campioni[k])) return null;
  const tingi = T.macchina();
  if (!tingi) return null;
  // la camicia bianca com'è adesso: con il suo collo e il suo taschino
  const bianca = document.createElement('canvas');
  bianca.width = w * K; bianca.height = h * K;
  const g = bianca.getContext('2d');
  g.drawImage(foto, 0, 0, bianca.width, bianca.height);
  pezzi.forEach((p, k) => { const [x0, y0, x1, y1] = p.riquadro; g.drawImage(fotoPezzi[k], (x0 - x) * K, (y0 - y) * K, (x1 - x0) * K, (y1 - y0) * K); });
  const tela = tingi({
    foto: bianca, base, maschera, chiave: tr.map((p) => p.file).join('|'),
    pezzi: tr.map((p, k) => ({ img: tramePezzi[k], maschera: maschere[k], x: p.riquadro[0] - T.base.riquadro[0], y: p.riquadro[1] - T.base.riquadro[1] })),
    tessere: tessere.map((id, k) => (id ? { img: campioni[k], cm: T.tessuti[id], specchio: !!T.tessuti[id][2] } : null)),
    alMetroUv: T.al_metro_uv, alMetro: T.al_metro,
  });
  bianca.width = 0;
  if (!tela) return null;
  // sull'immagine ferma: parete e ombra (gli stessi pezzi della camicia che dondola) e sopra la camicia tinta. I bordi,
  // di sola parete, sfumano (tranne dove sono il bordo del fotogramma): nessuna giunta con l'immagine sotto
  const [fx0, fy0, fx1, fy1] = riquadroFermo(T), W = (fx1 - fx0) * K, H = (fy1 - fy0) * K;
  const ferma = document.createElement('canvas');
  ferma.width = W; ferma.height = H;
  const f = ferma.getContext('2d');
  for (const [im, nome] of [[parete, 'parete'], [ombra, 'ombra'], [tela, 'camicia']]) { const [px, py, pw, ph] = T.pezzi[nome]; f.drawImage(im, (px - fx0) * K, (py - fy0) * K, pw * K, ph * K); }
  f.globalCompositeOperation = 'destination-in';
  const s = MARGINE * K * 0.75;
  const sfuma = (ax, ay, bx, by) => { const gr = f.createLinearGradient(ax, ay, bx, by); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, '#000'); f.fillStyle = gr; f.fillRect(0, 0, W, H); };
  sfuma(0, 0, s, 0); sfuma(W, 0, W - s, 0);
  if (fy0 > 0) sfuma(0, 0, 0, s);
  if (fy1 < 1000) sfuma(0, H, 0, H - s);
  return { tela, ferma, riquadro: [x, y, x + w, y + h], riquadroFermo: [fx0, fy0, fx1, fy1] };
}
/** Una tela che non serve più: la sua memoria si libera subito. */
const butta = (...tele) => { for (const c of tele) if (c && c.tagName === 'CANVAS') c.width = c.height = 0; };

/** La grandezza del file che basta per `scala` punti dello schermo per punto del fotogramma (come leggera.js). */
const tagliaPer = (D, scala) => D.taglie.find((t) => t >= scala * 0.92) || D.taglie[D.taglie.length - 1];

/**
 * Da ciò che si è scelto a ciò che si mette sulla camicia: i pezzi con il loro riquadro, le lettere con il loro posto.
 * Un collo può portare con sé il posto delle iniziali «collo» (`colli[id].iniziali`: sul coreano non c'è la punta del
 * colletto); un collo senza `file` (l'italiano, che è la camicia com'è) non ha pezzi da sovrapporre.
 */
function risolvi(sc, D) {
  const collo = D.colli?.[sc.collo];
  const tasca = sc.taschino && D.taschino;
  const pos = sc.iniziali?.posizione;
  const posto = pos && ((pos === 'collo' && collo?.iniziali) || D.iniziali?.[pos]);
  return {
    collo: collo?.file && collo.riquadro ? { chiave: 'collo:' + sc.collo, file: collo.file, riquadro: collo.riquadro } : null,
    taschino: tasca?.file && tasca.riquadro ? { chiave: 'taschino', file: tasca.file, riquadro: tasca.riquadro } : null,
    stoffa: null,                                                             // la mette `applica`, quando l'ha tinta
    // (nella chiave anche il posto e il colore del filo: cambiando collo le iniziali sul collo si spostano)
    iniziali: posto?.centro ? { chiave: `iniziali:${pos}:${sc.iniziali.lettere}:${sc.iniziali.colore}:${posto.centro}:${posto.gradi}:${posto.alta}`, lettere: sc.iniziali.lettere, colore: sc.iniziali.colore, centro: posto.centro, gradi: +posto.gradi || 0, alta: +posto.alta || 7 } : null,
  };
}
const vuoto = (s) => !s.stoffa && !s.collo && !s.taschino && !s.iniziali;
const NIENTE = { stoffa: null, collo: null, taschino: null, iniziali: null };

// ---------------------------------------------------------------------------------------------- le iniziali

// Il carattere delle iniziali (proprietario, 2026-11-26: «Le iniziali le voglio in un font più elegante»; fra tre
// provati il 27 ha scelto il corsivo inglese). Petit Formal Script con le sole maiuscole, ospitato sul sito
// (public/font/, licenza in licenze.txt).
const CARATTERE = { famiglia: 'Endero Iniziali Inglese', file: 'iniziali-inglese.woff2', stile: 'normal', peso: 400, spazio: 0.02 };
const FONT = (corpo) => `${CARATTERE.stile} ${CARATTERE.peso} ${corpo}px "${CARATTERE.famiglia}", Georgia, serif`;
// l'altezza delle maiuscole, in frazione del corpo: si misura appena il carattere c'è
let capo = 0.66;
let carattere = null;
const caratterePronto = () => (carattere ||= (async () => {
  try {
    // la faccia è dichiarata in sito.css (@font-face), che c'è in tutte le pagine: si carica quella, così nella pagina
    // ce n'è una sola. Se il foglio non la avesse (una copia vecchia rimasta nel browser) la si aggiunge come prima
    const pronte = await document.fonts.load(FONT(100), 'EDR');
    if (!pronte.length) {
      const f = new FontFace(CARATTERE.famiglia, `url(/font/${CARATTERE.file})`, { style: CARATTERE.stile, weight: String(CARATTERE.peso) });
      document.fonts.add(await f.load());
    }
  } catch { /* resta il carattere di riserva */ }
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return;
  g.font = FONT(100);
  const a = g.measureText('H').actualBoundingBoxAscent;
  if (a > 30 && a < 100) capo = a / 100;
})());
/** Lo spessore del rilievo del ricamo (mezzo punto alle grandezze del fotogramma, in proporzione alle lettere). */
const rilievo = (alta) => Math.max(0.3, alta * 0.07);
// un'ombra chiara sotto e una scura sopra, di mezzo punto: il filo appena in rilievo sul tessuto, niente di più
const LUCE_SOTTO = 'rgba(255, 255, 255, 0.7)', OMBRA_SOPRA = 'rgba(4, 16, 54, 0.35)';

const crea = (nome, attributi = {}) => {
  const el = document.createElementNS(SVG, nome);
  for (const [k, v] of Object.entries(attributi)) el.setAttribute(k, v);
  return el;
};
const r2 = (v) => Math.round(v * 100) / 100;
/** Le iniziali come SVG, nei punti del fotogramma: nitide a ogni zoom. */
function ricamo(ini) {
  const [cx, cy] = ini.centro, corpo = ini.alta / capo, d = rilievo(ini.alta);
  const g = crea('g', {
    class: 'vesti__iniziali', transform: `rotate(${ini.gradi} ${cx} ${cy})`, 'font-family': `"${CARATTERE.famiglia}", Georgia, serif`,
    'font-style': CARATTERE.stile, 'font-weight': CARATTERE.peso, 'font-size': r2(corpo), 'letter-spacing': r2(corpo * CARATTERE.spazio), 'text-anchor': 'middle',
  });
  const riga = (dy, colore) => { const t = crea('text', { x: cx, y: r2(cy + ini.alta / 2 + dy), fill: colore }); t.textContent = ini.lettere; return t; };
  g.append(riga(d, LUCE_SOTTO), riga(-d, OMBRA_SOPRA), riga(0, ini.colore || FILO));
  return g;
}
/** Le stesse iniziali su una tela (la stoffa): `s` punti della tela per punto del fotogramma, (ox, oy) l'origine. */
function ricamaTela(g, ini, s, ox, oy) {
  const [cx, cy] = ini.centro, d = rilievo(ini.alta);
  g.save();
  g.translate((cx - ox) * s, (cy - oy) * s);
  g.rotate(ini.gradi * Math.PI / 180);
  g.scale(s, s);
  g.font = FONT(ini.alta / capo);
  if ('letterSpacing' in g) g.letterSpacing = `${(ini.alta / capo) * CARATTERE.spazio}px`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  for (const [dy, colore] of [[d, LUCE_SOTTO], [-d, OMBRA_SOPRA], [0, ini.colore || FILO]]) { g.fillStyle = colore; g.fillText(ini.lettere, 0, ini.alta / 2 + dy); }
  g.restore();
}

// ---------------------------------------------------------------------------------------------- un livello

/**
 * Un livello della camicia su cui stanno i pezzi: uno per posto (collo, taschino, la camicia tinta, iniziali), dal
 * basso in alto.
 * @param {Element} radice  dove metterli: un div (html) o un <g> di un SVG nei punti del fotogramma
 * @param {object} o        { svg: è un SVG (lì la camicia tinta non va: è la guida alle misure), box: [x, y, w, h] del
 *                          fotogramma coperto dal div, scala: () => punti fisici dello schermo per punto del
 *                          fotogramma, D: opzioni.json, opaco: la camicia tinta con la sua parete (immagine ferma) o
 *                          ritagliata (camicia che dondola) }
 */
function livello(radice, { svg = false, box = [0, 0, 1800, 1000], scala, D, opaco = true }) {
  const [bx, by, bw, bh] = box;
  const posti = {}, turni = {}, cosa = {};
  for (const nome of SLOT) {
    posti[nome] = svg ? crea('g') : Object.assign(document.createElement('div'), { className: `vesti__posto vesti__posto--${nome}` });
    turni[nome] = 0; cosa[nome] = null;
    radice.append(posti[nome]);
  }
  const pc = (v, tutto) => `${(v / tutto) * 100}%`;
  const posa = (el, [x0, y0, x1, y1]) => Object.assign(el.style, { left: pc(x0 - bx, bw), top: pc(y0 - by, bh), width: pc(x1 - x0, bw), height: pc(y1 - y0, bh) });
  /** Un pezzo (collo, taschino) nella grandezza `t`. */
  function pezzo(p, indirizzo) {
    const [x0, y0, x1, y1] = p.riquadro;
    if (svg) return crea('image', { href: indirizzo, x: x0, y: y0, width: x1 - x0, height: y1 - y0, preserveAspectRatio: 'none', class: 'vesti__pezzo' });
    const im = Object.assign(document.createElement('img'), { alt: '', className: 'vesti__pezzo', decoding: 'async', draggable: false, src: indirizzo });
    posa(im, p.riquadro);
    return im;
  }
  /** La camicia tinta: una tela sua per ogni livello (una tela non può stare in due posti). */
  function tinta(v) {
    const da = opaco ? v.ferma : v.tela;
    const c = Object.assign(document.createElement('canvas'), { className: 'vesti__pezzo vesti__tinta', width: da.width, height: da.height });
    c.getContext('2d').drawImage(da, 0, 0);
    posa(c, opaco ? v.riquadroFermo : v.riquadro);
    return c;
  }
  function lettere(ini) {
    if (svg) { const g = ricamo(ini); g.classList.add('vesti__pezzo'); return g; }
    const s = crea('svg', { class: 'vesti__pezzo vesti__lettere', viewBox: `${bx} ${by} ${bw} ${bh}`, preserveAspectRatio: 'none', overflow: 'visible', 'aria-hidden': 'true' });
    s.append(ricamo(ini));
    return s;
  }
  const via = (el) => { el.remove(); butta(el); };
  const togli = (el, subito) => {
    if (subito || ridotto.matches) { via(el); return; }
    el.style.opacity = '0';
    setTimeout(() => via(el), DISSOLVE + 60);
  };
  /** Cambia un posto: il pezzo nuovo compare sopra il vecchio, che va via quando l'altro è del tutto comparso. */
  async function cambia(nome, voluto, subito) {
    const mio = ++turni[nome];
    let el = null, t = 0;
    if (nome === 'stoffa') { if (svg) return; if (voluto) el = tinta(voluto); }
    else if (voluto && nome === 'iniziali') el = lettere(voluto);
    else if (voluto) {
      t = tagliaPer(D, scala());
      const indirizzo = D.indirizzo(voluto.file, t);
      // la grandezza giusta; se non c'è, una qualunque già scaricata; se manca anche quella, resta il pezzo di prima
      let im = await immagine(indirizzo);
      if (!im) { const altra = D.taglie.map((x) => D.indirizzo(voluto.file, x)).find((u) => pronte.has(u)); if (altra) { im = pronte.get(altra); t = 0; } }
      if (mio !== turni[nome]) return;
      if (!im) return;
      el = pezzo(voluto, im.src);
    }
    const vecchio = cosa[nome];
    cosa[nome] = voluto ? { chiave: voluto.chiave, voluto, el, t } : null;
    if (el) {
      const piano = subito || ridotto.matches;
      if (!piano) el.style.opacity = '0';
      posti[nome].append(el);
      if (!piano) { getComputedStyle(el).opacity; el.style.opacity = ''; }
    }
    if (vecchio) {
      // le lettere si incrociano (le vecchie non sono coperte dalle nuove); un pezzo sotto il nuovo resta finché serve
      if (el && nome !== 'iniziali' && !subito && !ridotto.matches) setTimeout(() => via(vecchio.el), DISSOLVE + 60);
      else togli(vecchio.el, subito);
    }
    // (con la camicia tinta sopra, i pezzi bianchi di questo livello non devono spuntare dai bordi: vedi vesti.css)
    if (nome === 'stoffa' && !svg) radice.classList.toggle('vesti--tinta', !!voluto);
  }
  return {
    /** Mostra lo stato (`subito`: senza dissolvenza, per un livello che compare adesso). */
    mostra(stato, subito = false) {
      for (const nome of SLOT) if ((stato[nome]?.chiave || null) !== (cosa[nome]?.chiave || null)) cambia(nome, stato[nome], subito);
    },
    /** Se ora servono file più grandi (finestra più grande, zoom), li prende e li sostituisce; mai più piccoli. */
    ingrandisci() {
      const t = tagliaPer(D, scala());
      for (const nome of ['collo', 'taschino']) {
        const c = cosa[nome];
        if (!c || c.t >= t) continue;
        const indirizzo = D.indirizzo(c.voluto.file, t);
        c.t = t;
        immagine(indirizzo).then((im) => {
          if (!im || cosa[nome] !== c) return;
          if (svg) c.el.setAttribute('href', indirizzo); else c.el.src = indirizzo;
        });
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------- la camicia

/**
 * @param {HTMLElement} palco    il palco della camicia (data-opzioni: l'indirizzo di opzioni.json; data-trame: quello
 *                               di trame.json; data-cucitura: la frase della rotella)
 * @param {Promise} camicia      quella di leggera(): { ferma, riparti, veste } o niente (immagine ferma soltanto)
 */
export function vesti(palco, camicia) {
  if (!palco?.dataset.opzioni) return;
  const fitto = () => window.devicePixelRatio || 1;
  let D = null;
  let stato = NIENTE;                  // ciò che c'è adesso sulla camicia
  let zoom = 1;                        // l'ingrandimento della guida alle misure (guida.js, `endero:zoom`)
  let ferma = null, sullaFerma = null; // il livello sull'immagine ferma
  let veste = null, addosso = null;    // la camicia che dondola (leggera.js) e il suo livello
  const lenti = new Map();             // il riquadro del telefono (guida.js): il suo <g> e il suo livello
  let giro = 0;

  /** Quanti punti fisici dello schermo fa un punto del fotogramma sull'immagine ferma (senza zoom: la si misura dal posto). */
  const scalaFerma = () => ((sullaFerma?.offsetWidth || palco.querySelector('.configura__ferma')?.offsetWidth || 1800) / 1800) * fitto();
  const prepara = () => {
    if (ferma) return;
    sullaFerma = Object.assign(document.createElement('div'), { className: 'configura__vesti' });
    sullaFerma.setAttribute('aria-hidden', 'true');
    palco.querySelector('.configura__ferma')?.closest('picture')?.after(sullaFerma);
    ferma = livello(sullaFerma, { D, scala: () => scalaFerma() * zoom });
    new ResizeObserver(() => { ferma.ingrandisci(); addosso?.ingrandisci(); }).observe(sullaFerma);
  };
  const preparaAddosso = () => {
    if (!addosso && veste && D) addosso = livello(veste.strato, { D, box: veste.riquadro, scala: veste.scala, opaco: false });
  };

  // --- la rotella «filo che cuce» (proprietario, 2026-11-26): compare se una scelta fa aspettare più di un attimo
  // Segue solo l'ultima scelta: una scelta di prima rimasta appesa a un file che non arriva non la tiene accesa
  // (con un conto dei lavori in corso restava a girare per sempre, anche sopra la camicia già tinta: revisione del 26).
  let rotella = null, attesaRotella = 0, lavori = false;
  function cucendo(si) {
    lavori = si;
    clearTimeout(attesaRotella);
    if (!lavori) { if (rotella) rotella.hidden = true; return; }
    attesaRotella = setTimeout(function mostra() {
      if (!lavori) return;
      // (sta nel livello dell'immagine ferma, che ha il posto e la misura del fotogramma: se non c'è ancora, fra un attimo)
      if (!sullaFerma) { attesaRotella = setTimeout(mostra, 200); return; }
      if (!rotella) {
        rotella = Object.assign(document.createElement('div'), { className: 'configura__cucitura' });
        rotella.setAttribute('role', 'status');
        rotella.innerHTML = '<svg class="cucitura__filo" viewBox="0 0 56 56" aria-hidden="true" focusable="false"><circle class="cucitura__giro" cx="28" cy="28" r="21"/><g class="cucitura__ago"><path d="M39.5 6.5 29 31"/><circle cx="37.6" cy="11" r="1.1"/></g></svg><p></p>';
        rotella.querySelector('p').textContent = palco.dataset.cucitura || '';
        sullaFerma.append(rotella);
      }
      rotella.hidden = false;
    }, ATTESA);
  }

  // --- la stoffa (onda.js): una tela composta, solo quando le scelte cambiano
  let telaOra = null, giroStoffa = 0;
  /** La camicia con ciò che si è scelto: quella tinta (se c'è) o la foto con i pezzi dipinti sopra, e le iniziali. */
  function componi(foto, s) {
    const [x, y, w] = veste.riquadro, k = foto.naturalWidth / w;
    const tela = document.createElement('canvas');
    tela.width = foto.naturalWidth; tela.height = foto.naturalHeight;
    const g = tela.getContext('2d', { willReadFrequently: true });
    if (s.stoffa) g.drawImage(s.stoffa.tela, 0, 0, tela.width, tela.height);
    else {
      g.drawImage(foto, 0, 0);
      for (const nome of ['collo', 'taschino']) {
        const p = s[nome];
        if (!p) continue;
        // la grandezza giusta se è già qui, se no la più grande già scaricata
        const voluta = D.indirizzo(p.file, tagliaPer(D, k));
        const im = pronte.get(voluta) || D.taglie.slice().reverse().map((t) => pronte.get(D.indirizzo(p.file, t))).find(Boolean);
        if (!im) continue;
        const [x0, y0, x1, y1] = p.riquadro;
        g.drawImage(im, (x0 - x) * k, (y0 - y) * k, (x1 - x0) * k, (y1 - y0) * k);
      }
    }
    if (s.iniziali) ricamaTela(g, s.iniziali, k, x, y);
    return tela;
  }
  async function stoffa() {
    if (!veste?.conStoffa()) { telaOra = null; return; }
    const mio = ++giroStoffa;
    const foto = veste.foto(), k = foto.naturalWidth / veste.riquadro[2];
    if (!vuoto(stato) && !stato.stoffa) await Promise.all(['collo', 'taschino'].map((n) => stato[n] && immagine(D.indirizzo(stato[n].file, tagliaPer(D, k)))));
    if (mio !== giroStoffa || !veste.conStoffa()) return;
    const da = telaOra || foto, nuova = vuoto(stato) ? null : componi(foto, stato), a = nuova || foto;
    const vecchia = telaOra;
    telaOra = nuova;
    if (da === a) return;
    // tre passi in un quinto di secondo: la stoffa non rifà la tela a ogni fotogramma
    const mista = document.createElement('canvas');
    mista.width = a.naturalWidth || a.width; mista.height = a.naturalHeight || a.height;
    const g = mista.getContext('2d', { willReadFrequently: true });
    [1 / 3, 2 / 3].forEach((t, i) => setTimeout(() => {
      if (mio !== giroStoffa) return;
      g.globalAlpha = 1; g.clearRect(0, 0, mista.width, mista.height); g.drawImage(da, 0, 0, mista.width, mista.height);
      g.globalAlpha = t; g.drawImage(a, 0, 0, mista.width, mista.height);
      veste.tessuto(mista);
    }, i * (DISSOLVE / 3)));
    setTimeout(() => { if (mio === giroStoffa) { veste.tessuto(a); butta(mista, vecchia); } }, DISSOLVE);
  }

  /** Dove la camicia che dondola è un'immagine, quella bianca resta sotto la tinta e sui bordi le lascerebbe un filo
   *  chiaro: la si toglie quando la tinta è comparsa, e torna subito quando la tinta va via. */
  let attesaSotto = 0;
  function sottoLaTinta() {
    const bianca = veste?.strato.previousElementSibling;
    if (!bianca || bianca.tagName !== 'IMG') return;
    clearTimeout(attesaSotto);
    if (!stato.stoffa) bianca.style.opacity = '';
    else attesaSotto = setTimeout(() => { if (stato.stoffa) bianca.style.opacity = '0'; }, DISSOLVE + 80);
  }

  let riprova = 0;
  /** Porta sulla camicia la scelta `sc` (`prova`: quante volte si è già riprovato a tingere, dopo un file non arrivato). */
  async function applica(sc, prova = 0) {
    const mio = ++giro;
    clearTimeout(riprova);
    const conTessuto = !!(sc.tessuto || sc.polsino_tessuto || (sc.taschino && sc.taschino_tessuto));
    cucendo(true);
    try {
      if (sc.collo === 'italiano' && !sc.taschino && !sc.iniziali && !conTessuto && vuoto(stato)) return;   // niente da scaricare
      D ||= await leggiOpzioni(palco);
      if (!D || mio !== giro) return;
      const voluto = risolvi(sc, D);
      const T = conTessuto ? await leggiTrame(palco) : null;
      if (mio !== giro) return;
      const st = T ? stoffe(sc, T) : null;
      if (vuoto(voluto) && !st && vuoto(stato)) return;
      prepara();
      // i file ci sono? Se un pezzo manca, al suo posto resta quello di prima
      const nuovo = { ...voluto }, t = tagliaPer(D, scalaFerma() * zoom);
      await Promise.all(['collo', 'taschino'].map(async (n) => {
        const p = voluto[n];
        if (p && p.chiave !== stato[n]?.chiave && !(await immagine(D.indirizzo(p.file, t)))) nuovo[n] = stato[n];
      }));
      if (st) {
        // La camicia tinta: si rifà se cambiano il collo, il taschino o un tessuto. Se non riesce (un file non arriva,
        // la scheda grafica si è persa): con gli stessi tessuti resta quella di prima; con un tessuto nuovo la camicia
        // torna bianca, perché non mostri un tessuto diverso da quello scritto nel riquadro. E fra poco si riprova.
        const tessuti = `${st.corpo}|${st.polsino}|${st.taschino}`;
        const chiave = `stoffa:${nuovo.collo?.chiave || ''}|${nuovo.taschino ? 1 : 0}|${tessuti}`;
        if (stato.stoffa?.chiave === chiave) nuovo.stoffa = stato.stoffa;
        else {
          const fatta = await tingiCamicia(sc, st, nuovo, T, D).catch(() => null);
          if (mio !== giro) { if (fatta) butta(fatta.tela, fatta.ferma); return; }
          nuovo.stoffa = fatta ? { chiave, ...fatta } : stato.stoffa?.chiave.endsWith('|' + tessuti) ? stato.stoffa : null;
          if (!fatta && prova < 2) riprova = setTimeout(() => { if (mio === giro) applica(sc, prova + 1); }, 2500 * (prova + 1));
        }
      }
      if (nuovo.iniziali) await caratterePronto();
      if (mio !== giro) { if (nuovo.stoffa && nuovo.stoffa !== stato.stoffa) butta(nuovo.stoffa.tela, nuovo.stoffa.ferma); return; }
      const prima = stato.stoffa;
      stato = nuovo;
      ferma.mostra(stato);
      preparaAddosso();                    // (la camicia che dondola può essere arrivata mentre si scaricava)
      addosso?.mostra(stato);
      sottoLaTinta();
      for (const [gruppo, l] of lenti) if (l.livello) l.livello.mostra(stato); else lente(gruppo, l);
      stoffa();
      // (le tele di prima servono ancora un attimo alla dissolvenza della stoffa)
      if (prima && prima !== stato.stoffa) setTimeout(() => butta(prima.tela, prima.ferma), DISSOLVE * 3);
    } finally {
      if (mio === giro) cucendo(false);
    }
  }
  ascolta.add((sc) => applica(sc));
  if (ultima) applica(ultima);

  // la camicia che dondola: arriva quando i suoi pezzi sono scaricati
  // (il suo livello si fa alla prima scelta: finché non si sceglie nulla, la camicia è quella di sempre)
  camicia?.then((c) => {
    if (!c?.veste) return;
    veste = c.veste;
    // con una foto più grande (la finestra è cresciuta) la tela si rifà subito, senza dissolvenza
    veste.vestito((foto) => (telaOra = vuoto(stato) ? null : componi(foto, stato)));
    if (vuoto(stato)) return;
    preparaAddosso();
    addosso.mostra(stato, true);
    sottoLaTinta();
    stoffa();
  }, () => {});

  // lo zoom della guida: servono pezzi più grandi (sul computer, la camicia nitida è quattro volte l'immagine ferma)
  palco.addEventListener('endero:zoom', (e) => { zoom = Math.max(1, +e.detail?.scala || 1); ferma?.ingrandisci(); });
  // il riquadro con lo zoom del telefono: anche lì i pezzi, nella grandezza giusta per il suo zoom
  // (finché non si è scelto nulla lo si ricorda soltanto: il suo livello si fa con la prima scelta, in `lente`)
  document.addEventListener('endero:lente', (e) => {
    const { gruppo, scala } = e.detail || {};
    if (!gruppo) return;
    const l = lenti.get(gruppo) || { scala, livello: null };
    l.scala = scala;
    lenti.set(gruppo, l);
    if (l.livello) l.livello.ingrandisci(); else lente(gruppo, l);
  });
  function lente(gruppo, l) {
    if (l.livello || !D || vuoto(stato)) return;
    l.livello = livello(gruppo, { svg: true, D, scala: () => l.scala });
    l.livello.mostra(stato, true);
  }
  // per i controlli (tools/prova-vesti.js)
  if (new URLSearchParams(location.search).has('manuale')) window.__vesti = { get stato() { return stato; }, get zoom() { return zoom; }, get cucendo() { return lavori ? 1 : 0; } };
}
