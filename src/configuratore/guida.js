// La guida alle misure del configuratore (proprietario, 2026-11-21 e 22). Il cliente misura la camicia che gli sta
// meglio, abbottonata e stesa su un tavolo:
// - entrando, ogni volta, una finestra in vetro con i passi; si chiude con «Inizia» e si riapre da «Come misurare»;
// - quando entra in un campo di misura (clic, dito, tasto Tab) la camicia smette di dondolare (leggera.js, `ferma`)
//   e la pagina fa uno zoom sulla zona in cui si misura, dove si disegna un tratteggio blu sottile. Per spalla e
//   lunghezza dietro la camicia prima si gira e mostra il retro (un breve video calcolato con Blender,
//   camicia/guide/retro.py). Passando a un'altra misura lo zoom scivola sulla zona nuova; uscendo dalle misure torna
//   indietro, la camicia si rigira di fronte e risponde di nuovo alla mano. La frase su dove misurare non si vede
//   (proprietario, 2026-11-22: «Non serve»): resta per chi usa un lettore di schermo;
// - dove la camicia non resta accanto ai campi (telefono, tablet, finestre strette) sopra il campo compare un riquadro
//   con lo zoom sulla zona e il tratteggio, che resta in vista anche con la tastiera aperta.
// Le linee sono calcolate sulla camicia vera, in Blender (camicia/guide/linee.py): punti del fotogramma 1800 x 1000,
// lo stesso dell'immagine ferma. Con il movimento ridotto niente giro, zoom animato né linee che si disegnano.
// Lo zoom ha tre misure: il proprietario ha scelto la forte («Mi piace forte», 2026-11-22), che è quella normale;
// ?zoom=a (leggero) e ?zoom=b (di mezzo) restano per confrontarle.
// Dal 2026-11-25 (configuratore a passi) la stessa guida vale per le parti della camicia che si scelgono nel riquadro:
// un elemento con `data-parte="collo"` (o taschino, bottoni, iniziali_polso, …) si comporta come un campo di misura,
// con lo zoom sulla parte e il suo contorno tratteggiato (`parti` in public/camicia/opzioni/opzioni.json, la stessa
// forma delle misure in guide.json; le parti si guardano sempre davanti). Se l'attributo cambia mentre il campo ha il
// fuoco, il riquadro lo dice con `endero:parte` e lo zoom scivola sulla parte nuova. I pezzi scelti (vesti.js) stanno
// sulla camicia anche dentro lo zoom: la guida dice a vesti.js quanto ingrandisce (`endero:zoom`), quando la camicia
// è girata di spalle (`data-girata` sul palco: i pezzi davanti non si vedono) e dove sta il riquadro del telefono
// (`endero:lente`).

import { lineaParte, colloScelto } from './vesti.js';
import { finestraAperta, finestraChiusa, voceFinestraTolta } from './cronologia.mjs';

const ridotto = matchMedia('(prefers-reduced-motion: reduce)');
/** I campi che aprono la guida: le misure e le parti della camicia. */
const CAMPO = '.misura[data-guida], [data-parte]';
const SVG = 'http://www.w3.org/2000/svg';

// quanto si ingrandisce al più sul computer, e quanto è grande al minimo la zona inquadrata (punti del fotogramma)
const ZOOM = { a: { massimo: 1.6, minimo: 460 }, b: { massimo: 2.2, minimo: 340 }, c: { massimo: 3, minimo: 250 } };
const zoom = ZOOM[new URLSearchParams(location.search).get('zoom')] || ZOOM.c;
const ATTORNO = 1.3;           // intorno alla linea, un terzo di camicia in più: le maniche ai lati del torace, il colletto
const DURATA = 1100;           // lo zoom sul palco, in millisecondi (la curva sta nel CSS)
const SCIVOLA = 750;           // lo zoom nel riquadro del telefono
// il tratteggio, in punti dello schermo qualunque sia lo zoom: fine come una linea di cartamodello, ma che si vede
// (proprietario, 2026-11-22: «più visibile, leggermente luminosa e 1.5 più spessa»: da 1,5 a 2,25 punti), con un
// alone di luce blu (LUCE: due ombre senza spostamento, una stretta e una larga)
const TRATTO = { largo: 2.25, pieno: 7, vuoto: 5, nascostoLargo: 1.5, nascostoPieno: 3, nascostoVuoto: 5, capo: 3.9, bordoCapo: 1.5 };
const LUCE = [[2.5, 'rgba(110, 165, 255, 0.95)'], [7, 'rgba(45, 105, 255, 0.5)']];

/** Sposta la pagina di `di` punti: lo fa src/sito.js, passando dallo scorrimento morbido (che se no lo annullerebbe). */
const scorri = (di, subito = false) => document.dispatchEvent(new CustomEvent('endero:scorri', { detail: { di, subito } }));

/** Ferma la pagina sotto una finestra: lo scorrimento morbido sta in src/sito.js, che ascolta questo avviso. */
function blocca(si) {
  document.documentElement.classList.toggle('dialogo-aperto', si);
  document.dispatchEvent(new CustomEvent('endero:blocca', { detail: si }));
}

/**
 * La finestra dei passi. Si apre da sola a ogni visita (scelta del proprietario) e si riapre da «Come misurare».
 * Restituisce una promessa che si compie quando la si chiude la prima volta: fino ad allora la camicia non saluta.
 * Con ?senza-passi in fondo all'indirizzo non si apre da sola (per i controlli automatici).
 */
export function passi() {
  const finestra = document.getElementById('come-misurare');
  if (!finestra || typeof finestra.showModal !== 'function') return Promise.resolve();
  const apri = () => {
    if (finestra.open) return;
    finestra.showModal();
    blocca(true);
    // una voce di cronologia: il tasto Indietro del browser (il gesto, sul telefono) chiude la finestra
    finestraAperta();
  };
  finestra.addEventListener('close', () => { blocca(false); finestraChiusa(); });
  addEventListener('popstate', () => { if (finestra.open && voceFinestraTolta()) finestra.close(); });
  for (const b of document.querySelectorAll('[data-apri-passi]')) b.addEventListener('click', apri);
  if (new URLSearchParams(location.search).has('senza-passi')) return Promise.resolve();
  const chiusa = new Promise((fatto) => finestra.addEventListener('close', () => fatto(), { once: true }));
  apri();
  return chiusa;
}

/** Un elemento SVG con i suoi attributi. */
function crea(nome, attributi = {}) {
  const el = document.createElementNS(SVG, nome);
  for (const [k, v] of Object.entries(attributi)) el.setAttribute(k, v);
  return el;
}
/**
 * Il tracciato di un tratto: una curva morbida che passa per tutti i punti (Catmull-Rom, scritta come curve di Bézier),
 * non una spezzata. Così la linea segue il tessuto e le cuciture senza angoli (proprietario, 2026-11-24: la linea era
 * «un po' troppo rigida»).
 */
function tracciato(t) {
  const p = t.punti;
  if (p.length < 3) return p.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('') + (t.chiuso ? 'Z' : '');
  const n = p.length;
  const a = (i) => (t.chiuso ? p[(i + n) % n] : p[Math.min(Math.max(i, 0), n - 1)]);
  const r = (v) => Math.round(v * 10) / 10;
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < (t.chiuso ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [a(i - 1), a(i), a(i + 1), a(i + 2)];
    d += `C${r(p1[0] + (p2[0] - p0[0]) / 6)} ${r(p1[1] + (p2[1] - p0[1]) / 6)} ${r(p2[0] - (p3[0] - p1[0]) / 6)} ${r(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]} ${p2[1]}`;
  }
  return d + (t.chiuso ? 'Z' : '');
}
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

/**
 * La zona da inquadrare intorno alla linea (il suo riquadro, in punti del fotogramma), con la forma `aspetto`
 * (larghezza / altezza): un terzo più grande della linea, mai sotto `zoom.minimo`, dentro il fotogramma.
 * Restituisce [x, y, larghezza, altezza].
 */
function zona([x0, y0, x1, y1], aspetto, minimo = zoom.minimo) {
  let w = Math.max(1, (x1 - x0) * ATTORNO);
  let h = Math.max(1, (y1 - y0) * ATTORNO);
  const grande = Math.max(w, h);
  if (grande < minimo) { w *= minimo / grande; h *= minimo / grande; }
  if (w / h > aspetto) h = w / aspetto; else w = h * aspetto;
  if (w > 1800) { w = 1800; h = w / aspetto; }
  if (h > 1000) { h = 1000; w = h * aspetto; }
  const x = Math.min(Math.max((x0 + x1) / 2 - w / 2, 0), Math.max(0, 1800 - w));
  const y = Math.min(Math.max((y0 + y1) / 2 - h / 2, 0), Math.max(0, 1000 - h));
  return [x, y, w, h];
}

/**
 * Disegna la linea di una misura dentro `svg` (che misura in punti del fotogramma): un tratteggio blu sottile che si
 * disegna dall'inizio alla fine; le parti nascoste (dietro una manica, sul retro) più fini e trasparenti; ai due capi
 * un punto piccolo. `u`: quanti punti del fotogramma fa un punto dello schermo, così il tratto resta sottile a ogni zoom.
 */
function disegnaLinea(svg, misura, chiave, u) {
  svg.replaceChildren();
  const gruppo = crea('g', { class: 'linea' + (ridotto.matches ? '' : ' linea--si-disegna') });
  const defs = crea('defs');
  misura.tratti.forEach((t, i) => {
    const d = tracciato(t);
    // la maschera che scopre il tratteggio un po' alla volta (pathLength 1: la stessa durata per ogni tratto)
    const id = `scopri-${chiave}-${i}`;
    const maschera = crea('mask', { id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1800, height: 1000 });
    maschera.append(crea('path', { d, pathLength: 1, class: 'linea__scopri', 'stroke-width': r1(16 * u) }));
    defs.append(maschera);
    const [largo, pieno, vuoto] = t.visibile ? [TRATTO.largo, TRATTO.pieno, TRATTO.vuoto] : [TRATTO.nascostoLargo, TRATTO.nascostoPieno, TRATTO.nascostoVuoto];
    gruppo.append(crea('path', {
      d, class: t.visibile ? 'linea__tratto' : 'linea__tratto linea__tratto--nascosto', mask: `url(#${id})`,
      'stroke-width': r2(largo * u), 'stroke-dasharray': `${r2(pieno * u)} ${r2(vuoto * u)}`,
    }));
  });
  for (const [x, y] of misura.capi || []) gruppo.append(crea('circle', { cx: x, cy: y, r: r2(TRATTO.capo * u), 'stroke-width': r2(TRATTO.bordoCapo * u), class: 'linea__capo' }));
  // la luce intorno al tratteggio: le misure del filtro stanno nei punti del fotogramma, come il resto
  gruppo.style.filter = LUCE.map(([raggio, colore]) => `drop-shadow(0 0 ${r2(raggio * u)}px ${colore})`).join(' ');
  svg.append(defs, gruppo);
}

/** Aspetta la fine della transizione della trasformazione di `el` (o al più `ms` millisecondi). */
const finoAllaFine = (el, ms) => new Promise((fatto) => {
  const via = () => { clearTimeout(t); el.removeEventListener('transitionend', fine); fatto(); };
  const fine = (e) => { if (e.target === el && e.propertyName === 'transform') via(); };
  const t = setTimeout(via, ms);
  el.addEventListener('transitionend', fine);
});

/**
 * @param {HTMLElement} palco     il palco della camicia, con i dati della guida (data-guide, data-dietro, …)
 * @param {Promise} camicia       quella di leggera(): si compie con { ferma, riparti }, o niente se la camicia non si muove
 */
export function guida(palco, camicia) {
  if (!document.querySelector(CAMPO) && !palco.dataset.opzioni) return;
  // il riquadro in vetro: lo zoom inquadra la camicia nello spazio libero alla sua sinistra
  const scheda = () => document.querySelector('.configura__scheda') || document.querySelector(CAMPO)?.closest('form') || palco;
  const sulPalco = () => getComputedStyle(palco).position === 'sticky';

  // le linee: si scaricano quando la pagina è ferma, o al primo campo (se la rete cade, il campo dopo riprova)
  let dati = null;
  const linee = () => (dati ||= palco.dataset.guide
    ? fetch(palco.dataset.guide).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).catch(() => { dati = null; return null; })
    : Promise.resolve(null));
  /** Che cosa mostra un campo: la sua chiave, la vista e dove prendere la linea (una misura o una parte). */
  const chiave = (m) => m.dataset.parte || m.dataset.guida;
  const versoDi = (m) => (!m.dataset.parte && m.dataset.vista === 'dietro' ? 'dietro' : 'davanti');
  const lineaDi = (m) => (m.dataset.parte
    ? lineaParte(palco, m.dataset.parte)
    : linee().then((d) => d?.misure?.[m.dataset.guida] || null));
  // e con loro la copia a grandezza doppia dell'immagine ferma, che lo zoom usa sul computer (così è già pronta)
  const pronte = {};
  // (solo dove la camicia sta accanto ai campi: sul telefono non serve. Un «no» per questo non si ricorda: se la
  // finestra si allarga o il tablet si gira, la si scarica allora)
  const scarica = (indirizzo) => (!indirizzo || !sulPalco() ? Promise.resolve(false)
    : (pronte[indirizzo] ||= (() => { const im = new Image(); im.src = indirizzo; return im.decode().then(() => im.naturalWidth > 0, () => false); })()));
  const scaricaNitida = (verso = 'davanti') => scarica(verso === 'dietro' ? palco.dataset.nitidaDietro : (palco.dataset.nitida || palco.dataset.ferma));
  if (palco.dataset.guide) (window.requestIdleCallback || ((f) => setTimeout(f, 2500)))(() => { linee(); scaricaNitida('davanti').then(() => scaricaNitida('dietro')); });

  // la camicia che si muove arriva quando i suoi pezzi sono scaricati: se intanto una guida è aperta, si ferma subito
  let controllo = null;
  let aperta = null;             // il campo (.misura) della guida in vista
  camicia.then((c) => { controllo = c || null; if (controllo && aperta && sulPalco()) controllo.ferma(); }, () => {});
  let turno = 0;                 // ogni guida nuova annulla i passi rimasti a quella di prima

  // ------------------------------------------------------------ sul palco (computer: la camicia resta accanto ai campi)
  // Si ingrandiscono insieme, con la stessa trasformazione (--zoom, nel CSS), l'immagine ferma, la sua copia a
  // grandezza doppia (zoomata resta definita), la camicia vista da dietro, il video del giro e le linee. I pezzi che
  // si muovono (leggera.js) intanto si nascondono: la camicia è ferma, e l'immagine ferma è la stessa.
  let svg = null, video = null, retro = null, nitida = null, nitidaDietro = null;
  let vista = 'davanti';
  const ferma = () => palco.querySelector('.configura__ferma');
  const preparaPalco = () => {
    if (svg) return;
    svg = crea('svg', { class: 'configura__linee', viewBox: '0 0 1800 1000', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    // la camicia a grandezza quadrupla nel suo riquadro (camicia/guide/nitide.py), davanti e dietro; se non c'è,
    // davanti l'immagine ferma a grandezza doppia
    const ritaglio = palco.dataset.nitidaRiquadro?.split(' ').map(Number);
    if (ritaglio?.length === 4) {
      const [x0, y0, x1, y1] = ritaglio;
      palco.style.setProperty('--nx', x0 / 1800); palco.style.setProperty('--ny', y0 / 1000);
      palco.style.setProperty('--nw', (x1 - x0) / 1800); palco.style.setProperty('--nh', (y1 - y0) / 1000);
    }
    const nuova = (indirizzo, ritagliata) => {
      const im = Object.assign(document.createElement('img'), { alt: '', className: 'configura__nitida' + (ritagliata ? ' configura__nitida--ritaglio' : ''), decoding: 'async', draggable: false });
      im.setAttribute('aria-hidden', 'true');
      im.hidden = true;
      if (indirizzo) im.src = indirizzo;
      return im;
    };
    nitida = nuova(palco.dataset.nitida || palco.dataset.ferma, !!palco.dataset.nitida);
    nitidaDietro = palco.dataset.nitidaDietro ? nuova(palco.dataset.nitidaDietro, true) : null;
    palco.querySelector('.configura__invito').before(...[nitida, nitidaDietro, svg].filter(Boolean));
  };
  /** Un video del giro, sopra la camicia, con le misure dell'immagine ferma: parte quando è pronto, finisce e basta.
   *  `parte` si chiama quando il primo fotogramma è sullo schermo (o quando si rinuncia al video). */
  const suona = (indirizzo, parte = () => {}) => new Promise((fatto) => {
    video ||= Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'auto', className: 'configura__giro' });
    video.setAttribute('aria-hidden', 'true');
    if (!video.isConnected) svg.before(video);
    let partito = false;
    // se il video non parte (rete, risparmio energetico), dopo tre secondi si va avanti senza; partito, si aspetta
    // la sua fine (con mezzo secondo di riserva, se 'ended' non arrivasse)
    let scaduto = setTimeout(() => finito(), 3000);
    const via = () => {
      if (partito) return;
      partito = true;
      clearTimeout(scaduto);
      scaduto = setTimeout(() => finito(), ((video.duration || 1) - video.currentTime) * 1000 + 500);
      parte();
    };
    const finito = () => { clearTimeout(scaduto); video.removeEventListener('ended', finito); video.removeEventListener('playing', via); via(); clearTimeout(scaduto); fatto(); };
    video.addEventListener('ended', finito);
    video.addEventListener('playing', via, { once: true });
    if (!video.src.endsWith(indirizzo)) video.src = indirizzo;
    video.currentTime = 0;
    video.hidden = false;
    video.play().catch(finito);
  });
  const fotoRetro = () => {
    if (!retro) {
      retro = Object.assign(document.createElement('img'), { alt: '', className: 'configura__retro', decoding: 'async', draggable: false });
      retro.setAttribute('aria-hidden', 'true');
      retro.hidden = true;
      retro.src = palco.dataset.dietro;
      nitida.after(retro);                     // sopra la camicia nitida davanti, sotto quella dietro
    }
    // vero se la camicia da dietro è pronta; se non arriva in tre secondi (rete lenta) o non c'è, la camicia non si gira
    const pronta = retro.decode().then(() => retro.naturalWidth > 0, () => false);
    return Promise.race([pronta, new Promise((fatto) => setTimeout(() => fatto(false), 3000))]);
  };
  // La camicia si gira un giro alla volta, verso la vista chiesta per ultima: chi passa in fretta da un campo all'altro
  // non la lascia mai a metà né di spalle sotto la linea di una misura davanti. Un giro cominciato finisce; poi, se
  // intanto è stata chiesta l'altra vista, si gira di nuovo. Si gira sempre senza zoom.
  let desiderata = 'davanti';
  let girando = null;
  let ruota = false;             // la camicia si sta girando davvero (non solo aspetta l'immagine del retro)
  async function ciclo() {
    while (vista !== desiderata) {
      if (desiderata === 'dietro') {
        if (!palco.dataset.dietro) return;
        const pronta = await fotoRetro();
        if (desiderata !== 'dietro') continue;
        if (!pronta) return;
        ruota = true;
        palco.dataset.girata = '';               // da qui i pezzi scelti davanti (vesti.js) non si vedono
        if (!ridotto.matches && palco.dataset.giro) await suona(palco.dataset.giro);
        if (video) video.hidden = true;
        if (!sulPalco()) { ruota = false; return; }                // nel frattempo la finestra è passata al riquadro
        // il giro è finito di spalle: il retro resta, e se intanto è stata chiesta la vista davanti il giro dopo la
        // riporta indietro con il video del ritorno (niente scatto)
        retro.hidden = false;
        vista = 'dietro';
      } else {
        ruota = true;
        // la camicia di spalle resta finché il video del ritorno non è sullo schermo: niente lampo della camicia davanti
        if (!ridotto.matches && palco.dataset.ritorno) await suona(palco.dataset.ritorno, () => { if (retro) retro.hidden = true; });
        if (retro) retro.hidden = true;
        if (video) video.hidden = true;
        vista = 'davanti';
        delete palco.dataset.girata;
      }
      ruota = false;
    }
  }
  /** Gira la camicia verso `verso`. Vero se alla fine è girata così; falso se nel frattempo è stata chiesta l'altra
   *  vista, o se il retro non c'è. */
  async function gira(verso) {
    desiderata = verso;
    // già girata così e ferma: niente da aspettare (un giro che stava solo scaricando il retro se ne accorge da sé)
    if (vista === verso && !ruota) return true;
    while (girando) await girando;             // il giro in corso vede da sé la vista nuova
    if (desiderata !== verso) return false;
    if (vista !== verso) {
      girando = ciclo();
      try { await girando; } finally { girando = null; }
    }
    return vista === verso;
  }

  // --- lo zoom
  let scala = 1;                 // l'ingrandimento di adesso (1: niente zoom)
  /** Dove sta l'immagine ferma nel palco, senza zoom (in punti dello schermo). */
  const base = () => { const f = ferma(); return { x: f.offsetLeft, y: f.offsetTop, w: f.offsetWidth, h: f.offsetHeight }; };
  /** La parte del palco in cui si guarda la camicia: quella nello schermo, a sinistra del riquadro in vetro. */
  function area() {
    const p = palco.getBoundingClientRect();
    const s = scheda().getBoundingClientRect();
    const sinistra = Math.max(p.left, 0) + 24;
    const destra = (s.left > sinistra + 240 ? s.left : Math.min(p.right, innerWidth)) - 24;
    const su = Math.max(p.top, 0) + 64;          // sopra può tornare la testata
    const giu = Math.min(p.bottom, innerHeight) - 24;
    return { x: sinistra - p.left, y: su - p.top, w: Math.max(80, destra - sinistra), h: Math.max(80, giu - su) };
  }
  /** Lo zoom sulla zona `z` del fotogramma ([x, y, w, h]); si compie a zoom finito. */
  async function zoomSu(z) {
    const B = base(), A = area(), k = B.w / 1800;
    let s = Math.min(A.w / (z[2] * k), A.h / (z[3] * k));
    s = Math.max(1, Math.min(zoom.massimo, s));
    const cx = z[0] + z[2] / 2, cy = z[1] + z[3] / 2;
    let tx = A.x + A.w / 2 - B.x - s * k * cx;
    let ty = A.y + A.h / 2 - B.y - s * k * cy;
    // l'immagine ingrandita copre sempre almeno quello che copriva prima: niente bordi vuoti
    tx = Math.max((1 - s) * B.w, Math.min(tx, Math.max(0, -B.x)));
    ty = Math.max((1 - s) * B.h, Math.min(ty, Math.max(0, -B.y)));
    scala = s;
    const dopo = `translate(${r1(tx)}px, ${r1(ty)}px) scale(${Math.round(s * 1000) / 1000})`;
    if (palco.style.getPropertyValue('--zoom') === dopo) return;
    // vesti.js prende i pezzi scelti nella grandezza giusta per lo zoom, prima che cominci
    palco.dispatchEvent(new CustomEvent('endero:zoom', { detail: { scala: s } }));
    palco.style.setProperty('--zoom', dopo);
    if (!ridotto.matches) await finoAllaFine(ferma(), DURATA + 150);
  }
  async function zoomVia() {
    scala = 1;
    if (!palco.style.getPropertyValue('--zoom')) return;
    palco.dispatchEvent(new CustomEvent('endero:zoom', { detail: { scala: 1 } }));
    palco.style.removeProperty('--zoom');
    if (!ridotto.matches) await finoAllaFine(ferma(), DURATA + 150);
  }

  async function apriPalco(m) {
    preparaPalco();
    const mio = ++turno;
    aperta = m;
    palco.dataset.guidaAperta = chiave(m);
    svg.replaceChildren();
    const [misura] = await Promise.all([lineaDi(m), controllo ? controllo.ferma() : null]);
    if (mio !== turno) return;
    palco.dataset.guidaFerma = '';             // via i pezzi che si muovono: resta l'immagine ferma, che è la stessa
    const verso = versoDi(m);
    // la camicia si gira senza zoom: prima si torna indietro, poi si gira, poi lo zoom sulla zona nuova. La vista si
    // chiede sempre, anche quando la camicia è già da quel lato: un giro che stava ancora scaricando il retro per la
    // misura di prima così lo sa, e non si gira più
    if (verso !== vista || ruota) {
      await zoomVia();
      if (mio !== turno) return;
      nitida.hidden = true;
      if (nitidaDietro) nitidaDietro.hidden = true;
    }
    const girata = await gira(verso);
    if (mio !== turno || !girata) return;
    // una parte senza linea (un nome che opzioni.json non conosce): la camicia resta ferma, senza zoom
    if (!misura) { await zoomVia(); return; }
    // la copia a grandezza doppia dell'immagine ferma (davanti; da dietro c'è la camicia girata): solo se è già pronta
    // prima dello zoom, mai a metà, quando comparirebbe di colpo già ingrandita
    const quella = verso === 'dietro' ? nitidaDietro : nitida;
    const pronta = (quella?.complete && quella.naturalWidth > 0) || await Promise.race([scaricaNitida(verso), new Promise((f) => setTimeout(() => f(false), 60))]);
    if (mio !== turno) return;
    nitida.hidden = true;
    if (nitidaDietro) nitidaDietro.hidden = true;
    if (quella && pronta && quella.complete && quella.naturalWidth) quella.hidden = false;
    const A = area();
    const fine = zoomSu(zona(misura.riquadro, A.w / A.h));
    // la linea si disegna mentre lo zoom finisce (lo spessore è per l'ingrandimento finale, già calcolato)
    setTimeout(() => { if (mio === turno) disegnaLinea(svg, misura, 'palco', 1800 / (base().w * scala)); }, ridotto.matches ? 0 : DURATA * 0.55);
    await fine;
  }
  async function chiudiPalco() {
    const mio = ++turno;
    aperta = null;
    delete palco.dataset.guidaAperta;
    if (svg) svg.replaceChildren();
    await zoomVia();
    if (mio !== turno) return;
    if (nitida) nitida.hidden = true;
    if (nitidaDietro) nitidaDietro.hidden = true;
    await gira('davanti');
    if (mio !== turno) return;
    delete palco.dataset.guidaFerma;
    controllo?.riparti();
  }

  /** Il palco come senza guida, subito (la finestra è passata al riquadro sopra il campo). */
  function azzeraPalco() {
    turno++;
    scala = 1;
    palco.style.removeProperty('--zoom');
    delete palco.dataset.guidaAperta;
    delete palco.dataset.guidaFerma;
    if (svg) svg.replaceChildren();
    if (nitida) nitida.hidden = true;
    if (nitidaDietro) nitidaDietro.hidden = true;
    if (retro) retro.hidden = true;
    if (video) { video.pause(); video.hidden = true; }
    vista = desiderata = 'davanti';
    delete palco.dataset.girata;
    ruota = false;
    controllo?.riparti();
  }

  // ------------------------------------------------------------ sopra il campo (telefono, tablet, finestre strette)
  // Un riquadro con la camicia: si apre sull'insieme e scivola con uno zoom sulla zona della misura, poi si disegna il
  // tratteggio. Sta sopra il campo, sulle righe di prima, senza spostare niente nel modulo.
  let carta = null, svgC = null, foto = null, vestiti = null, sopra = null;
  let quadro = null;             // la zona inquadrata adesso (viewBox)
  let scivola = 0;
  const preparaCarta = () => {
    if (carta) return;
    carta = Object.assign(document.createElement('div'), { className: 'misura-lente' });
    carta.setAttribute('aria-hidden', 'true');
    carta.hidden = true;
    // toccare il riquadro lo chiude e scopre i campi che copre; la scrittura resta nel campo aperto (non finisce in un
    // campo nascosto sotto). Si riapre entrando in un altro campo, o toccando di nuovo questo
    for (const tipo of ['pointerdown', 'mousedown']) carta.addEventListener(tipo, (e) => e.preventDefault());
    carta.addEventListener('click', () => chiudiCarta());
    svgC = crea('svg', { class: 'misura-lente__camicia', preserveAspectRatio: 'xMidYMid slice' });
    foto = crea('image', { x: 0, y: 0, width: 1800, height: 1000, preserveAspectRatio: 'none' });
    // i pezzi scelti nel riquadro (vesti.js), nelle stesse coordinate della camicia
    vestiti = crea('g', { class: 'misura-lente__vesti' });
    sopra = crea('svg', { viewBox: '0 0 1800 1000', x: 0, y: 0, width: 1800, height: 1000, overflow: 'visible' });
    svgC.append(foto, vestiti, sopra);
    // (una x nell'angolo, quando il riquadro sta fermo sullo schermo: dice che toccandolo si chiude)
    carta.append(svgC, Object.assign(document.createElement('span'), { className: 'misura-lente__chiudi' }));
  };
  const mettiQuadro = (q) => { quadro = q; svgC.setAttribute('viewBox', q.map(r1).join(' ')); };
  /** Il riquadro scivola dalla zona di adesso a `verso`, in SCIVOLA millisecondi. */
  const scivolaSu = (verso) => new Promise((fatto) => {
    cancelAnimationFrame(scivola);
    const da = quadro;
    if (!da || ridotto.matches) { mettiQuadro(verso); fatto(); return; }
    const t0 = performance.now();
    const passo = (ora) => {
      const t = Math.min(1, (ora - t0) / SCIVOLA);
      const e = 1 - Math.pow(1 - t, 3);
      mettiQuadro(da.map((v, i) => v + (verso[i] - v) * e));
      if (t < 1) scivola = requestAnimationFrame(passo); else fatto();
    };
    scivola = requestAnimationFrame(passo);
  });
  /** La parte dello schermo libera: sotto la testata e sopra la tastiera (visualViewport). Il posto della testata si
   *  lascia anche quando è nascosta: torna appena la pagina sale (anche quando il browser porta in vista il campo). */
  function libero() {
    const vv = window.visualViewport;
    const testata = document.querySelector('[data-testata]');
    const alta = testata ? testata.offsetHeight : 0;
    // (in basso ci si ferma alla barra con il prezzo e i tasti, che sta sempre in fondo allo schermo)
    const barra = document.querySelector('[data-fondo]');
    const sopraBarra = barra && barra.getClientRects().length ? barra.getBoundingClientRect().top : Infinity;
    return { su: (vv ? vv.offsetTop : 0) + alta + 8, giu: Math.min(vv ? vv.offsetTop + vv.height : innerHeight, sopraBarra) - 8 };
  }
  /** Il fondo del campo, sullo schermo (di una misura, la casella in cui si scrive; di una parte, tutto il blocco). */
  const fondoCampo = (m) => ((!m.dataset.parte && m.querySelector('input')) || m).getBoundingClientRect().bottom;
  /** Il riquadro va sopra il campo `m`, più stretto del modulo: sopra il campo, non in mezzo. Le misure si prendono
   *  dallo schermo, così vale qualunque sia l'elemento che contiene il campo. */
  function posaCarta(m, alto, largo) {
    const dentro = carta.offsetParent || carta.parentElement;
    const ro = dentro.getBoundingClientRect(), rc = carta.parentElement.getBoundingClientRect(), rm = m.getBoundingClientRect();
    const x0 = ro.left + dentro.clientLeft, y0 = ro.top + dentro.clientTop;
    // il contenitore del riquadro, nelle coordinate di chi lo posiziona
    const sx = rc.left + carta.parentElement.clientLeft - x0, largoTutto = carta.parentElement.clientWidth;
    const centro = rm.left - x0 + rm.width / 2;
    carta.style.left = `${Math.round(Math.min(Math.max(centro - largo / 2, sx), sx + largoTutto - largo))}px`;
    carta.style.top = `${Math.round(rm.top - y0 - alto - 10)}px`;
  }
  /** Il riquadro fermo sullo schermo (per le parti): in alto, sotto la testata; se lì coprirebbe il comando toccato,
   *  in basso, sopra la barra con i tasti. */
  let toccato = null;
  function posaFissa(m, alto, largo, su, giu) {
    const vv = window.visualViewport;
    const fuoco = m.contains(document.activeElement) ? document.activeElement : null;
    const comando = (m.contains(toccato) ? toccato.closest('label, select, input, button') : null) || fuoco || m.querySelector('input:checked, select, button') || m;
    const r = comando.getBoundingClientRect();
    const coperto = r.bottom > su - 6 && r.top < su + alto + 10;
    const sotto = r.bottom > giu - alto - 10 && r.top < giu + 6;
    carta.style.left = `${Math.round((vv ? vv.offsetLeft : 0) + ((vv ? vv.width : innerWidth) - largo) / 2)}px`;
    carta.style.top = `${Math.round(coperto && !sotto ? giu - alto : su)}px`;
  }
  /** Il riquadro e il campo in vista insieme, anche con la tastiera aperta. Il riquadro si misura dove
   *  arriva (dal campo), non dove sta ancora scivolando. */
  function inVista(m) {
    if (!carta || carta.hidden) return;
    const { su, giu } = libero();
    const cima = m.getBoundingClientRect().top - parseFloat(carta.style.height) - 10;
    const fondo = fondoCampo(m);
    let di = 0;
    if (cima < su) di = -Math.min(su - cima, Math.max(0, giu - fondo));       // la pagina scende, il campo non va sotto la tastiera
    else if (fondo > giu) di = Math.min(fondo - giu, cima - su);              // la pagina sale, il riquadro non va sotto la testata
    if (Math.abs(di) > 1) scorri(di, true);
  }
  async function apriCarta(m) {
    preparaCarta();
    const mio = ++turno;
    aperta = m;
    // Per le parti (collo, taschino, bottoni, iniziali…) il riquadro sta fermo sullo schermo e la pagina non si muove:
    // sopra la riga toccata copriva le righe prima e faceva saltare la pagina sotto il dito (revisione del
    // 2026-11-26). Per le misure resta sopra la casella in cui si scrive, con la pagina che lo tiene in vista.
    const fissa = !!m.dataset.parte;
    const contenitore = fissa ? document.body : m.parentElement;
    const compare = carta.hidden || carta.parentElement !== contenitore;
    if (carta.parentElement !== contenitore) { contenitore.append(carta); quadro = null; }
    carta.classList.toggle('misura-lente--fissa', fissa);
    const { su, giu } = libero();
    let alto, largo;
    if (fissa) {
      alto = Math.round(Math.max(120, Math.min(200, (giu - su) * 0.34)));
      largo = Math.round(Math.min(innerWidth - 32, 340, alto * 1.8));
    } else {
      // grande quanto c'è posto: fra la testata e la tastiera ci stanno il riquadro e il campo. Mai più
      // largo di 1,8 volte l'alto: le misure lunghe (le lunghezze totali) ci stanno intere, con i loro capi
      const blocco = fondoCampo(m) - m.getBoundingClientRect().top;
      const largoTutto = contenitore.clientWidth;
      alto = Math.round(Math.max(110, Math.min(240, largoTutto * 0.62, giu - su - blocco - 10)));
      largo = Math.min(largoTutto, Math.round(alto * 1.8));
    }
    carta.style.width = `${largo}px`;
    carta.style.height = `${alto}px`;
    if (carta.hidden) quadro = null;
    // comparendo va al suo posto in un colpo: non ci scivola dal posto in cui era stato aperto prima
    if (compare) carta.style.transition = 'none';
    carta.hidden = false;
    if (fissa) posaFissa(m, alto, largo, su, giu); else posaCarta(m, alto, largo);
    if (compare) { void carta.offsetHeight; carta.style.transition = ''; }
    sopra.replaceChildren();
    if (!fissa) inVista(m);
    const [d, misura] = await Promise.all([linee(), lineaDi(m)]);
    if (mio !== turno) return;
    const dietro = versoDi(m) === 'dietro';
    // i pezzi scelti nel riquadro si vedono solo davanti
    vestiti.style.display = dietro ? 'none' : '';
    const indirizzo = dietro ? palco.dataset.dietro : palco.dataset.ferma;
    if (!misura || !indirizzo) { chiudiCarta(); return; }
    const aspetto = largo / alto;
    // l'immagine (davanti o dietro): se cambia, il riquadro riparte dall'insieme della camicia
    if (foto.getAttribute('href') !== indirizzo) {
      const im = new Image();
      im.src = indirizzo;
      const caricata = await im.decode().then(() => im.naturalWidth > 0, () => false);
      if (mio !== turno) return;
      if (!caricata) { chiudiCarta(); return; }
      foto.setAttribute('href', indirizzo);
      quadro = null;
    }
    if (!quadro) mettiQuadro(zona(d?.viste?.[dietro ? 'dietro' : 'davanti']?.sagoma || [420, 120, 1040, 960], aspetto));
    // (le iniziali sono piccole: lì si stringe di più, se no nel riquadro sono alte un millimetro)
    const z = zona(misura.riquadro, aspetto, m.dataset.parte?.startsWith('iniziali') ? Math.min(zoom.minimo, 160) : zoom.minimo);
    // vesti.js mette i pezzi scelti nella grandezza che serve a questo zoom (punti fisici dello schermo per punto del fotogramma)
    if (!dietro) document.dispatchEvent(new CustomEvent('endero:lente', { detail: { gruppo: vestiti, scala: (largo / z[2]) * (window.devicePixelRatio || 1) } }));
    await scivolaSu(z);
    if (mio !== turno) return;
    disegnaLinea(sopra, misura, 'carta', z[2] / largo);
  }
  function chiudiCarta() {
    turno++;
    aperta = null;
    cancelAnimationFrame(scivola);
    if (carta) { carta.hidden = true; sopra.replaceChildren(); quadro = null; }
  }

  // ------------------------------------------------------------ i campi
  const apri = (m) => (sulPalco() ? apriPalco(m) : apriCarta(m));
  const palcoInGuida = () => !!(palco.dataset.guidaAperta || 'guidaFerma' in palco.dataset || palco.style.getPropertyValue('--zoom'));
  function chiudi() {
    if (carta && !carta.hidden) chiudiCarta();
    if (palcoInGuida()) chiudiPalco();
    aperta = null;
  }
  let uscita = 0;
  const campoDi = (el) => el?.closest?.(CAMPO) || null;
  // (si ascolta tutta la pagina: i campi delle parti il riquadro li può costruire dopo, o fuori dal modulo)
  document.addEventListener('focusin', (e) => {
    const m = campoDi(e.target);
    if (!m) return;
    clearTimeout(uscita);
    if (aperta !== m) apri(m);
  });
  document.addEventListener('focusout', (e) => {
    if (!campoDi(e.target) || campoDi(e.relatedTarget)) return;    // si passa a un altro campo (o dentro lo stesso): ci pensa focusin
    // Se se ne va tutta la finestra (un'altra scheda del browser) la guida resta com'è; se no si chiude, dopo un attimo.
    // Una finestra che si apre sopra la pagina (i tessuti) prende il fuoco: la guida si chiude, e quando la finestra si
    // chiude il fuoco torna al campo che l'ha aperta, che la riapre
    clearTimeout(uscita);
    uscita = setTimeout(() => {
      if (!document.hasFocus()) return;
      if (campoDi(document.activeElement)) return;
      chiudi();
    }, 120);
  });
  // Esc mentre si scrive: la guida si chiude e il campo resta com'è; un clic sul campo la riapre
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aperta && campoDi(e.target)) chiudi();
  });
  document.addEventListener('click', (e) => {
    const m = campoDi(e.target);
    if (!m) return;
    // Safari non dà il fuoco ai tasti cliccati: una parte fatta di tasti si apre lo stesso, con il clic
    if (!aperta && m.contains(document.activeElement)) apri(m);
    else if (aperta !== m && m.dataset.parte && !campoDi(document.activeElement)) apri(m);
  });
  // e senza fuoco non arriva focusout: si chiude con un tocco fuori dai campi
  // (Safari non sposta il fuoco toccando radio, etichette e tasti: dove sta il fuoco non conta, tranne quando si sta
  // scrivendo in una casella della parte aperta, le iniziali: lì il riquadro resta finché si scrive)
  document.addEventListener('pointerdown', (e) => {
    toccato = e.target;
    if (!aperta?.dataset.parte || campoDi(e.target) || carta?.contains(e.target)) return;
    const a = document.activeElement;
    if (aperta.contains(a) && a.matches('input[type="text"]')) return;
    clearTimeout(uscita);
    uscita = setTimeout(() => { if (aperta?.dataset.parte) chiudi(); }, 120);
  }, true);
  // il riquadro fermo sullo schermo si chiude quando la riga che l'ha aperto esce dalla parte libera dello schermo
  let giro = 0;
  addEventListener('scroll', () => {
    if (giro || !aperta?.dataset.parte || !carta || carta.hidden || !carta.classList.contains('misura-lente--fissa')) return;
    giro = requestAnimationFrame(() => {
      giro = 0;
      if (!aperta?.dataset.parte || !carta || carta.hidden) return;
      const r = aperta.getBoundingClientRect(), { su, giu } = libero();
      if (r.bottom < su || r.top > giu) chiudiCarta();
    });
  }, { passive: true });
  // Il collo è cambiato mentre la sua evidenza (o quella delle iniziali sul collo) è aperta: ogni collo ha la sua
  // sagoma, il contorno si rifà sul collo nuovo
  let collo = colloScelto();
  document.addEventListener('endero:camicia', () => {
    const prima = collo;
    collo = colloScelto();
    if (collo !== prima && aperta && ['collo', 'iniziali_collo'].includes(aperta.dataset.parte)) apri(aperta);
  });
  // La parte di un campo è cambiata mentre è aperto (le iniziali: dal polso al cuore): lo zoom scivola sulla nuova.
  // Se il campo non è più una parte (niente iniziali), la guida si chiude
  document.addEventListener('endero:parte', (e) => {
    const m = e.detail?.campo;
    if (!m || (aperta !== m && !m.contains?.(document.activeElement))) return;
    if (m.matches(CAMPO)) apri(m); else if (aperta === m) chiudi();
  });
  // con la tastiera del telefono che si apre o si chiude il riquadro cambia misura e resta in vista con il campo
  let tastiera = 0;
  const conLaTastiera = () => {
    clearTimeout(tastiera);
    tastiera = setTimeout(() => { if (aperta && carta && !carta.hidden && !sulPalco()) apriCarta(aperta); }, 150);
  };
  window.visualViewport?.addEventListener('resize', conLaTastiera);
  // (con la tastiera aperta l'iPhone sposta la parte visibile dentro la pagina: il riquadro fermo la segue)
  window.visualViewport?.addEventListener('scroll', () => { if (aperta?.dataset.parte && window.visualViewport.height < innerHeight - 80) conLaTastiera(); });
  // se la finestra cambia forma con una guida aperta, la guida si rifà nel modo giusto (palco o riquadro) e con le misure nuove
  let cambio = 0;
  addEventListener('resize', () => {
    if (!aperta) return;
    clearTimeout(cambio);
    cambio = setTimeout(() => {
      const m = aperta;
      if (!m) return;
      if (sulPalco()) { if (carta && !carta.hidden) chiudiCarta(); apriPalco(m); }
      else { if (palcoInGuida()) azzeraPalco(); apriCarta(m); }
    }, 200);
  });
}
