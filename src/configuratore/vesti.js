// La camicia che cambia con le scelte del riquadro (proprietario, 2026-11-25; docs/direzione-creativa.md, punto 16):
// il collo scelto, il taschino e le iniziali compaiono sulla camicia mentre si configura.
//
// Il riquadro avvisa all'avvio e a ogni cambio:
//   document.dispatchEvent(new CustomEvent('endero:camicia', { detail: { collo: 'francese', taschino: true,
//     iniziali: { posizione: 'polso' | 'collo' | 'cuore', lettere: 'NP' } | null } }))
// e qui si sovrappongono alla camicia i pezzi giusti (public/camicia/opzioni/, fatti da camicia/opzioni/ con Blender
// sulla stessa scena: stessa luce, sovrapposti non si vedono giunte). Le iniziali sono lettere disegnate nel punto
// scelto, come un ricamo piccolo e fine: filo blu Endero con un filo di rilievo. I pezzi stanno su ogni livello in cui
// la camicia si vede, sempre negli stessi punti del fotogramma 1800 x 1000:
// - sull'immagine ferma (`.configura__vesti`, con lo stesso zoom della guida alle misure: così sono anche sopra la
//   camicia nitida dello zoom, nella grandezza quadrupla quando serve);
// - sulla camicia che dondola (leggera.js: un elemento con la sua stessa trasformazione);
// - dentro il tessuto che ondeggia (onda.js: la foto della camicia diventa una tela con i pezzi dipinti sopra, rifatta
//   solo quando le scelte cambiano);
// - nel riquadro con lo zoom del telefono (guida.js: altre immagini nelle stesse coordinate dell'SVG).
// Un pezzo nuovo compare con una dissolvenza breve sopra il vecchio, che va via dopo: mai un lampo di camicia senza
// collo. Se un file manca la camicia resta com'era. Finché non si sceglie nulla non si scarica nulla.

const ridotto = matchMedia('(prefers-reduced-motion: reduce)');
const SVG = 'http://www.w3.org/2000/svg';
const DISSOLVE = 200;                  // millisecondi: la comparsa di un pezzo nuovo (la stessa durata è nel CSS)
const FILO = '#0f285e';                // il blu del logo, per il ricamo delle iniziali
const POSTI = ['polso', 'collo', 'cuore'];
// PROVA (proprietario, 2026-11-26: «Sì, prepara una prova»): con ?prova=tessuto il tessuto scelto colora la camicia
// (tinta.js). Senza quella parola nell'indirizzo qui non cambia nulla: nemmeno il posto della stoffa c'è.
const PROVA = new URLSearchParams(location.search).get('prova') === 'tessuto';
const SLOT = [...(PROVA ? ['stoffa'] : []), 'collo', 'taschino', 'iniziali'];        // dal basso in alto
const TINTA = 'tinta|';

// ---------------------------------------------------------------------------------------------- le scelte

/** Le scelte del riquadro, pulite: un collo (un nome), il taschino sì o no, al più tre lettere maiuscole in un posto. */
function pulisci(d) {
  const ini = d?.iniziali;
  const lettere = typeof ini?.lettere === 'string' ? ini.lettere.toLocaleUpperCase('it').replace(/[^\p{Lu}]/gu, '').slice(0, 3) : '';
  return {
    collo: typeof d?.collo === 'string' ? d.collo : 'italiano',
    taschino: d?.taschino === true,
    iniziali: lettere && POSTI.includes(ini.posizione) ? { posizione: ini.posizione, lettere } : null,
    tessuto: PROVA && typeof d?.tessuto === 'string' ? d.tessuto : '',
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
      // (prova del tessuto: un pezzo tinto non è un file, è una chiave «tinta|tessuto|file|grandezza»; la camicia intera, «@…», ha una grandezza sola)
      D.indirizzo = (file, t) => (file.startsWith(TINTA) ? `${file}|${file.includes('|@') ? 0 : t}` : `${cartella}${file}-${String(t).replace('.', '')}.webp${v ? '?v=' + encodeURIComponent(v) : ''}`);
      return D;
    }));
  }
  return opzioni.get(indirizzo);
}

const immagini = new Map(), pronte = new Map();
// --- la prova del tessuto: le immagini «tinta|tessuto|file|grandezza» si fanno qui, dalla bianca
let trame = null, tingi, doveTrame = '', leggeraDove = '', leggeraV = '', pezziLeggera = null;
const semplice = (indirizzo) => new Promise((fatto) => { const im = new Image(); im.onload = () => fatto(im); im.onerror = () => fatto(null); im.src = indirizzo; });
/** trame.json (accanto a opzioni.json) e la macchina che tinge; null se manca qualcosa (allora la camicia resta bianca). */
function leggiTrame(palco, D) {
  if (trame) return trame;
  const u = new URL(palco.dataset.opzioni, location.href);
  doveTrame = u.pathname.slice(0, u.pathname.lastIndexOf('/') + 1);
  leggeraDove = palco.dataset.leggera || ''; leggeraV = palco.dataset.leggeraV ? '?v=' + palco.dataset.leggeraV : '';
  trame = Promise.all([
    fetch(doveTrame + 'trame.json' + u.search).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    leggeraDove ? fetch(leggeraDove + 'leggera.json' + leggeraV).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null,
    import('./tinta.js').then((m) => m.creaTinta()).catch(() => null),
  ]).then(([T, L, f]) => { tingi = f; pezziLeggera = L?.pezzi || null; return T && L && f ? Object.assign(T, { versione: u.search, D }) : null; });
  return trame;
}
/** Un'immagine tinta: `chiave` è «tinta|tessuto|file|grandezza»; file «@camicia» (la camicia ritagliata), «@ferma»
 *  (la camicia sulla sua parete, opaca: per l'immagine ferma e lo zoom) o il file di un pezzo (collo, taschino). */
async function tinta(chiave) {
  const T = await trame;
  const [, tid, file, t] = chiave.split('|');
  const tess = T?.tessuti?.[tid];
  if (!tess || !tingi || !pezziLeggera) return null;
  const tessera = await immagine(doveTrame + tess.file + T.versione);
  const come = { ...tess, alMetro: T.al_metro_uv, alMetroSchermo: T.al_metro };
  const tela = async (bianca, trama) => {
    const [foto, mappa] = await Promise.all([immagine(bianca), immagine(doveTrame + trama + T.versione)]);
    return foto && mappa && tessera ? tingi(foto, mappa, tessera, come) : null;
  };
  let fatta = null;
  if (file === '@camicia') fatta = await tela(`${leggeraDove}camicia-2.webp${leggeraV}`, T.base.file);
  else if (file === '@ferma') {
    // opaca: parete e ombra (gli stessi pezzi della camicia che dondola) e sopra la camicia tinta, nei punti
    // dell'immagine ferma. Sopra la camicia bianca una camicia ritagliata lascerebbe un filo bianco sui bordi.
    const [camicia, parete, ombra] = await Promise.all([immagine(`${TINTA}${tid}|@camicia|0`), immagine(`${leggeraDove}parete-2.webp${leggeraV}`), immagine(`${leggeraDove}ombra-2.webp${leggeraV}`)]);
    if (!camicia || !parete || !ombra) return null;
    const [x0, y0, x1, y1] = FERMA(), k = 2, W = (x1 - x0) * k, H = (y1 - y0) * k;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    for (const [im, nome] of [[parete, 'parete'], [ombra, 'ombra'], [camicia, 'camicia']]) { const [x, y, w, h] = pezziLeggera[nome]; g.drawImage(im, (x - x0) * k, (y - y0) * k, w * k, h * k); }
    // i bordi (di sola parete) sfumano, tranne dove sono il bordo del fotogramma: nessuna giunta con l'immagine sotto
    g.globalCompositeOperation = 'destination-in';
    const s = MARGINE * k * 0.75;
    const sfuma = (ax, ay, bx, by) => { const gr = g.createLinearGradient(ax, ay, bx, by); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
    sfuma(0, 0, s, 0); sfuma(W, 0, W - s, 0);
    if (y0 > 0) sfuma(0, 0, 0, s);
    if (y1 < 1000) sfuma(0, H, 0, H - s);
    fatta = c;
  } else {
    const quale = [...Object.values(T.colli || {}), T.taschino].find((p) => p && p.file === `trama-${file}.png`);
    fatta = quale ? await tela(T.D.indirizzo(file, +t), quale.file) : null;
  }
  if (!fatta) return null;
  const blob = await new Promise((f) => fatta.toBlob(f, 'image/png'));
  return blob ? semplice(URL.createObjectURL(blob)) : null;
}
/** Il riquadro della camicia tinta sull'immagine ferma: quello della camicia ritagliata, dentro il fotogramma. */
const MARGINE = 24;
const FERMA = () => { const [x, y, w, h] = pezziLeggera.camicia; return [x - MARGINE, Math.max(0, y - MARGINE), x + w + MARGINE, Math.min(1000, y + h + MARGINE)]; };
/** Un'immagine scaricata e pronta da disegnare, una volta sola; null se manca (senza errori). */
function immagine(indirizzo) {
  if (!immagini.has(indirizzo)) {
    if (indirizzo.startsWith(TINTA)) {
      immagini.set(indirizzo, tinta(indirizzo).then((im) => { if (im) pronte.set(indirizzo, im); return im; }, () => null));
      return immagini.get(indirizzo);
    }
    immagini.set(indirizzo, new Promise((fatto) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => {
        if (im.naturalWidth) pronte.set(indirizzo, im);
        fatto(im.naturalWidth ? im : null);
      });
      im.onerror = () => fatto(null);
      im.src = indirizzo;
    }));
  }
  return immagini.get(indirizzo);
}
/** La grandezza del file che basta per `scala` punti dello schermo per punto del fotogramma (come leggera.js). */
const tagliaPer = (D, scala) => D.taglie.find((t) => t >= scala * 0.92) || D.taglie[D.taglie.length - 1];

/**
 * Da ciò che si è scelto a ciò che si mette sulla camicia: i pezzi con il loro riquadro, le lettere con il loro posto.
 * Un collo può portare con sé il posto delle iniziali «collo» (`colli[id].iniziali`: sul coreano non c'è la punta del
 * colletto); un collo senza `file` (l'italiano, che è la camicia com'è) non ha pezzi da sovrapporre.
 */
function risolvi(sc, D, T) {
  const collo = D.colli?.[sc.collo];
  // con la prova del tessuto: la camicia tinta sotto tutto, e i pezzi tinti dello stesso tessuto
  const tid = T?.tessuti?.[sc.tessuto] ? sc.tessuto : '';
  const f = (file) => (tid ? `${TINTA}${tid}|${file}` : file), c = (chiave) => (tid ? `${chiave}:${tid}` : chiave);
  const tasca = sc.taschino && D.taschino;
  const pos = sc.iniziali?.posizione;
  const posto = pos && ((pos === 'collo' && collo?.iniziali) || D.iniziali?.[pos]);
  return {
    stoffa: tid ? { chiave: 'stoffa:' + tid, file: `${TINTA}${tid}|@` } : null,
    collo: collo?.file && collo.riquadro ? { chiave: c('collo:' + sc.collo), file: f(collo.file), riquadro: collo.riquadro } : null,
    taschino: tasca?.file && tasca.riquadro ? { chiave: c('taschino'), file: f(tasca.file), riquadro: tasca.riquadro } : null,
    // (nella chiave anche il posto: cambiando collo le iniziali sul collo si spostano)
    iniziali: posto?.centro ? { chiave: `iniziali:${pos}:${sc.iniziali.lettere}:${posto.centro}:${posto.gradi}:${posto.alta}`, lettere: sc.iniziali.lettere, centro: posto.centro, gradi: +posto.gradi || 0, alta: +posto.alta || 7 } : null,
  };
}
/**
 * La linea di una parte per la guida (guida.js), secondo il collo scelto adesso: ogni collo ha la sua sagoma
 * (`colli[id].parte` al posto di `parti.collo`, `colli[id].parte_iniziali` al posto di `parti.iniziali_collo`).
 */
export async function lineaParte(palco, nome) {
  const D = await leggiOpzioni(palco);
  if (!D) return null;
  const collo = D.colli?.[ultima?.collo || 'italiano'];
  if (nome === 'collo' && collo?.parte) return collo.parte;
  if (nome === 'iniziali_collo' && collo?.parte_iniziali) return collo.parte_iniziali;
  return D.parti?.[nome] || null;
}
/** Il collo scelto per ultimo (per guida.js: se cambia mentre la sua evidenza è aperta, il contorno si rifà). */
export const colloScelto = () => ultima?.collo || 'italiano';
const vuoto = (s) => !s.stoffa && !s.collo && !s.taschino && !s.iniziali;
const NIENTE = { stoffa: null, collo: null, taschino: null, iniziali: null };

// ---------------------------------------------------------------------------------------------- le iniziali

// l'altezza delle maiuscole di Archivo, in frazione del corpo: si misura appena il carattere c'è
let capo = 0.7;
let carattere = null;
const caratterePronto = () => (carattere ||= (document.fonts?.load('600 100px Archivo') || Promise.resolve()).catch(() => {}).then(() => {
  const g = document.createElement('canvas').getContext('2d');
  if (!g) return;
  g.font = '600 100px Archivo, system-ui, sans-serif';
  const a = g.measureText('H').actualBoundingBoxAscent;
  if (a > 30 && a < 100) capo = a / 100;
}));
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
    class: 'vesti__iniziali', transform: `rotate(${ini.gradi} ${cx} ${cy})`, 'font-family': 'Archivo, system-ui, sans-serif',
    'font-weight': 600, 'font-size': r2(corpo), 'text-anchor': 'middle',
  });
  const riga = (dy, colore) => { const t = crea('text', { x: cx, y: r2(cy + ini.alta / 2 + dy), fill: colore }); t.textContent = ini.lettere; return t; };
  g.append(riga(d, LUCE_SOTTO), riga(-d, OMBRA_SOPRA), riga(0, FILO));
  return g;
}
/** Le stesse iniziali su una tela (la stoffa): `s` punti della tela per punto del fotogramma, (ox, oy) l'origine. */
function ricamaTela(g, ini, s, ox, oy) {
  const [cx, cy] = ini.centro, d = rilievo(ini.alta);
  g.save();
  g.translate((cx - ox) * s, (cy - oy) * s);
  g.rotate(ini.gradi * Math.PI / 180);
  g.scale(s, s);
  g.font = `600 ${ini.alta / capo}px Archivo, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  for (const [dy, colore] of [[d, LUCE_SOTTO], [-d, OMBRA_SOPRA], [0, FILO]]) { g.fillStyle = colore; g.fillText(ini.lettere, 0, ini.alta / 2 + dy); }
  g.restore();
}

// ---------------------------------------------------------------------------------------------- un livello

/**
 * Un livello della camicia su cui stanno i pezzi: uno per posto (collo, taschino, iniziali), dal basso in alto.
 * @param {Element} radice  dove metterli: un div (html) o un <g> di un SVG nei punti del fotogramma
 * @param {object} o        { svg: è un SVG, box: [x, y, w, h] del fotogramma coperto dal div, scala: () => punti
 *                          fisici dello schermo per punto del fotogramma, D: opzioni.json }
 */
function livello(radice, { svg = false, box = [0, 0, 1800, 1000], scala, D, opaco = true }) {
  const [bx, by, bw, bh] = box;
  /** La camicia tinta di questo livello: opaca con la sua parete sull'immagine ferma, ritagliata sulla camicia che dondola. */
  const laStoffa = (v) => (opaco ? { ...v, file: v.file + 'ferma', riquadro: FERMA() } : { ...v, file: v.file + 'camicia', riquadro: ((r) => [r[0], r[1], r[0] + r[2], r[1] + r[3]])(pezziLeggera.camicia) });
  const posti = {}, turni = {}, cosa = {};
  for (const nome of SLOT) {
    posti[nome] = svg ? crea('g') : Object.assign(document.createElement('div'), { className: 'vesti__posto' });
    turni[nome] = 0; cosa[nome] = null;
    radice.append(posti[nome]);
  }
  const pc = (v, tutto) => `${(v / tutto) * 100}%`;
  /** Un pezzo (collo, taschino) nella grandezza `t`. */
  function pezzo(p, indirizzo) {
    const [x0, y0, x1, y1] = p.riquadro;
    if (svg) return crea('image', { href: indirizzo, x: x0, y: y0, width: x1 - x0, height: y1 - y0, preserveAspectRatio: 'none', class: 'vesti__pezzo' });
    const im = Object.assign(document.createElement('img'), { alt: '', className: 'vesti__pezzo', decoding: 'async', draggable: false, src: indirizzo });
    Object.assign(im.style, { left: pc(x0 - bx, bw), top: pc(y0 - by, bh), width: pc(x1 - x0, bw), height: pc(y1 - y0, bh) });
    return im;
  }
  function lettere(ini) {
    if (svg) { const g = ricamo(ini); g.classList.add('vesti__pezzo'); return g; }
    const s = crea('svg', { class: 'vesti__pezzo vesti__lettere', viewBox: `${bx} ${by} ${bw} ${bh}`, preserveAspectRatio: 'none', overflow: 'visible', 'aria-hidden': 'true' });
    s.append(ricamo(ini));
    return s;
  }
  const togli = (el, subito) => {
    if (subito || ridotto.matches) { el.remove(); return; }
    el.style.opacity = '0';
    setTimeout(() => el.remove(), DISSOLVE + 60);
  };
  /** Cambia un posto: il pezzo nuovo compare sopra il vecchio, che va via quando l'altro è del tutto comparso. */
  async function cambia(nome, voluto, subito) {
    const mio = ++turni[nome];
    let el = null, t = 0;
    if (voluto && nome === 'stoffa') voluto = laStoffa(voluto);
    if (voluto && nome === 'iniziali') el = lettere(voluto);
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
      if (el && nome !== 'iniziali' && !subito && !ridotto.matches) setTimeout(() => vecchio.el.remove(), DISSOLVE + 60);
      else togli(vecchio.el, subito);
    }
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
          if (svg) c.el.setAttribute('href', im.src); else c.el.src = im.src;
        });
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------- la camicia

/**
 * @param {HTMLElement} palco    il palco della camicia (data-opzioni: l'indirizzo di opzioni.json)
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

  // --- la stoffa (onda.js): una tela composta, solo quando le scelte cambiano
  let telaOra = null, giroStoffa = 0;
  /** La foto della camicia con i pezzi di `s` dipinti sopra. */
  function componi(foto, s) {
    const [x, y, w] = veste.riquadro, k = foto.naturalWidth / w;
    const tela = document.createElement('canvas');
    tela.width = foto.naturalWidth; tela.height = foto.naturalHeight;
    const g = tela.getContext('2d', { willReadFrequently: true });
    // (prova del tessuto: sotto, al posto della camicia bianca, quella tinta)
    const tinta = s.stoffa && pronte.get(D.indirizzo(s.stoffa.file + 'camicia', 0));
    if (tinta) g.drawImage(tinta, 0, 0, tela.width, tela.height); else g.drawImage(foto, 0, 0);
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
    if (s.iniziali) ricamaTela(g, s.iniziali, k, x, y);
    return tela;
  }
  async function stoffa() {
    if (!veste?.conStoffa()) { telaOra = null; return; }
    const mio = ++giroStoffa;
    const foto = veste.foto(), k = foto.naturalWidth / veste.riquadro[2];
    if (!vuoto(stato)) await Promise.all([stato.stoffa && immagine(D.indirizzo(stato.stoffa.file + 'camicia', 0)), ...['collo', 'taschino'].map((n) => stato[n] && immagine(D.indirizzo(stato[n].file, tagliaPer(D, k))))]);
    if (mio !== giroStoffa || !veste.conStoffa()) return;
    const da = telaOra || foto, nuova = vuoto(stato) ? null : componi(foto, stato), a = nuova || foto;
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
    setTimeout(() => { if (mio === giroStoffa) veste.tessuto(a); }, DISSOLVE);
  }

  /** Porta sulla camicia la scelta `sc`. */
  async function applica(sc) {
    const mio = ++giro;
    if (sc.collo === 'italiano' && !sc.taschino && !sc.iniziali && !sc.tessuto && vuoto(stato)) return;   // niente da scaricare
    D ||= await leggiOpzioni(palco);
    if (!D || mio !== giro) return;
    // (prova del tessuto: `sc.tessuto` c'è solo con ?prova=tessuto)
    const T = sc.tessuto ? await leggiTrame(palco, D) : null;
    if (mio !== giro) return;
    const voluto = risolvi(sc, D, T);
    if (vuoto(voluto) && vuoto(stato)) return;
    prepara();
    // i file ci sono? Se un pezzo manca, al suo posto resta quello di prima
    const nuovo = { ...voluto }, t = tagliaPer(D, scalaFerma() * zoom);
    await Promise.all(['collo', 'taschino'].map(async (n) => {
      const p = voluto[n];
      if (p && p.chiave !== stato[n]?.chiave && !(await immagine(D.indirizzo(p.file, t)))) nuovo[n] = stato[n];
    }));
    if (voluto.stoffa && voluto.stoffa.chiave !== stato.stoffa?.chiave && !(await immagine(D.indirizzo(voluto.stoffa.file + 'ferma', 0)))) nuovo.stoffa = stato.stoffa;
    if (nuovo.iniziali) await caratterePronto();
    if (mio !== giro) return;
    stato = nuovo;
    ferma.mostra(stato);
    preparaAddosso();                    // (la camicia che dondola può essere arrivata mentre si scaricava)
    addosso?.mostra(stato);
    sottoLaTinta();
    for (const [gruppo, l] of lenti) if (l.livello) l.livello.mostra(stato); else lente(gruppo, l);
    stoffa();
  }
  /** (prova del tessuto) Dove la camicia che dondola è un'immagine, quella bianca resta sotto la tinta e sui bordi
   *  le lascerebbe un filo chiaro: la si toglie quando la tinta è comparsa, e torna subito quando la tinta va via. */
  let attesaSotto = 0;
  function sottoLaTinta() {
    const bianca = veste?.strato.previousElementSibling;
    if (!bianca || bianca.tagName !== 'IMG') return;
    clearTimeout(attesaSotto);
    if (!stato.stoffa) bianca.style.opacity = '';
    else attesaSotto = setTimeout(() => { if (stato.stoffa) bianca.style.opacity = '0'; }, DISSOLVE + 80);
  }
  ascolta.add(applica);
  if (ultima) applica(ultima);
  // (prova del tessuto) nella finestra dei tessuti, quelli che colorano la camicia vanno in cima, con un segno
  if (PROVA) leggiOpzioni(palco).then((d) => d && leggiTrame(palco, d)).then((T) => {
    const griglia = document.querySelector('#finestra-tessuti [data-griglia]');
    if (!T || !griglia) return;
    for (const el of Object.keys(T.tessuti).map((id) => griglia.querySelector(`[data-id="${id}"]`)).filter(Boolean).reverse()) { el.classList.add('campione--prova'); griglia.prepend(el); }
  });

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
  // entrando nel campo del collo (o del taschino) si scaricano i pezzi che servono allo zoom, così la scelta compare subito
  document.addEventListener('focusin', async (e) => {
    const parte = e.target.closest?.('[data-parte]')?.dataset.parte;
    if (parte !== 'collo' && parte !== 'taschino') return;
    D ||= await leggiOpzioni(palco);
    if (!D) return;
    const sulPalco = getComputedStyle(palco).position === 'sticky';
    const t = tagliaPer(D, sulPalco ? scalaFerma() * 3 : fitto() * 0.8);
    const file = parte === 'collo' ? Object.values(D.colli || {}).filter(Boolean).map((c) => c.file) : [D.taschino?.file];
    for (const f of file) if (f) immagine(D.indirizzo(f, t));
  });
  // per i controlli (tools/prova-vesti.js)
  if (new URLSearchParams(location.search).has('manuale')) window.__vesti = { get stato() { return stato; }, get zoom() { return zoom; } };
}
