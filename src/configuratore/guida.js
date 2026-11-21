// La guida alle misure del configuratore (proprietario, 2026-11-21). Il cliente misura la camicia che gli sta meglio,
// abbottonata e stesa su un tavolo:
// - entrando, ogni volta, una finestra in vetro con i passi; si chiude con «Inizia» e si riapre da «Come misurare»;
// - accanto a ogni campo una «i»: sulla camicia compare, tratteggiato in blu, dove si misura, con una frase. Prima la
//   camicia smette di dondolare e si raddrizza (leggera.js, `ferma`); per spalla e lunghezza dietro si gira e mostra
//   il retro (un breve video calcolato con Blender, camicia/guide/retro.py), poi torna di fronte quando la guida si chiude.
//   La frase compare nel riquadro, sotto la riga del campo: sulla camicia resta solo la linea, che non va coperta;
// - dove la camicia non resta in vista accanto ai campi (telefono, tablet, finestre strette) la «i» apre una finestra
//   in vetro sopra il modulo, con la camicia, la linea e la frase.
// Le linee sono calcolate sulla camicia vera, in Blender (camicia/guide/linee.py): punti del fotogramma 1800 x 1000,
// lo stesso dell'immagine ferma. Le frasi stanno nella pagina (<template id="guida-frasi">), scritte dal build.
// Con il movimento ridotto niente giro né linee che si disegnano: compaiono e basta.

const ridotto = matchMedia('(prefers-reduced-motion: reduce)');
const SVG = 'http://www.w3.org/2000/svg';

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
  const apri = () => { if (!finestra.open) { finestra.showModal(); blocca(true); } };
  finestra.addEventListener('close', () => blocca(false));
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
/** «Sul retro della camicia.» davanti alla frase, dove la camicia non si può girare: solo se la frase non lo dice già. */
function sulRetro(testo, parole) {
  if (parole && !/^\s*sul retro/i.test(testo.textContent)) testo.insertAdjacentHTML('afterbegin', `<strong>${parole}.</strong> `);
}
const tracciato = (t) => t.punti.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('') + (t.chiuso ? 'Z' : '');

/**
 * La zona della camicia da mostrare nella finestra: il riquadro della linea, un terzo più largo, a 4:3 (3:4 per le
 * linee in piedi) e mai sotto i 340 punti del fotogramma. Così torace, pancia e bacino non diventano una striscia senza
 * ascelle né colletto, e le linee piccole (polso, braccio) non si ingrandiscono fino a sembrare grosse.
 */
const MINIMO = 340;
const ATTORNO = 1.3;           // un po' di camicia in più intorno alla linea: le maniche ai lati del torace, il colletto
function inquadra([x0, y0, x1, y1]) {
  let w = x1 - x0;
  let h = y1 - y0;
  if (h > w) { h = Math.max(h * ATTORNO, MINIMO); w = Math.max(w, h * 0.75); } else { w = Math.max(w * ATTORNO, MINIMO); h = Math.max(h, w * 0.75); }
  w = Math.min(w, 1800);
  h = Math.min(h, 1000);
  const x = Math.min(Math.max((x0 + x1) / 2 - w / 2, 0), 1800 - w);
  const y = Math.min(Math.max((y0 + y1) / 2 - h / 2, 0), 1000 - h);
  return [x, y, w, h].map((v) => Math.round(v * 10) / 10);
}

/**
 * Disegna la linea di una misura dentro `svg` (che misura in punti del fotogramma): sotto un alone chiaro, perché
 * si veda anche dove passa sul blu della parete; sopra il tratteggio blu, che si disegna dall'inizio alla fine. Le
 * parti nascoste (dietro una manica, sul retro) più sottili e trasparenti; ai due capi un punto.
 */
function disegnaLinea(svg, misura, chiave) {
  svg.replaceChildren();
  const gruppo = crea('g', { class: 'linea' + (ridotto.matches ? '' : ' linea--si-disegna') });
  const defs = crea('defs');
  misura.tratti.forEach((t, i) => {
    const d = tracciato(t);
    if (t.visibile) gruppo.append(crea('path', { d, class: 'linea__alone' }));
    // la maschera che scopre il tratteggio un po' alla volta (pathLength 1: la stessa durata per ogni tratto)
    const id = `scopri-${chiave}-${i}`;
    const maschera = crea('mask', { id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1800, height: 1000 });
    maschera.append(crea('path', { d, pathLength: 1, class: 'linea__scopri' }));
    defs.append(maschera);
    gruppo.append(crea('path', { d, class: t.visibile ? 'linea__tratto' : 'linea__tratto linea__tratto--nascosto', mask: `url(#${id})` }));
  });
  for (const [x, y] of misura.capi || []) gruppo.append(crea('circle', { cx: x, cy: y, r: 7, class: 'linea__capo' }));
  svg.append(defs, gruppo);
}

/**
 * @param {HTMLElement} palco     il palco della camicia, con i dati della guida (data-guide, data-dietro, …)
 * @param {Promise} camicia       quella di leggera(): si compie con { ferma, riparti }, o niente se la camicia non si muove
 */
export function guida(palco, camicia) {
  const bottoni = [...document.querySelectorAll('[data-guida]')];
  if (!bottoni.length) return;
  const frasi = document.getElementById('guida-frasi');
  const frase = (nome) => frasi?.content.querySelector(`[data-frase="${nome}"]`)?.innerHTML || '';
  const etichetta = (b) => document.querySelector(`label[for="campo-${b.dataset.guida}"]`)?.textContent.trim() || '';

  // le linee: si scaricano quando la pagina è ferma, o al primo tocco su una «i»
  // (se la rete cade, la «i» dopo riprova: un errore non resta in memoria)
  let dati = null;
  const linee = () => (dati ||= palco.dataset.guide
    ? fetch(palco.dataset.guide).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).catch(() => { dati = null; return null; })
    : Promise.resolve(null));
  if (palco.dataset.guide) (window.requestIdleCallback || ((f) => setTimeout(f, 2500)))(() => linee());

  // la camicia che si muove arriva quando i suoi pezzi sono scaricati: se intanto una guida è aperta, si ferma subito
  // (prima che saluti o segua la mano sotto la linea)
  let controllo = null;
  let aperta = null;             // il bottone della guida in vista sul palco
  camicia.then((c) => { controllo = c || null; if (controllo && aperta) controllo.ferma(); }, () => {});

  // ------------------------------------------------------------ sul palco (computer: la camicia resta accanto ai campi)
  let svg = null, nota = null, video = null, retro = null;
  let vista = 'davanti';
  let turno = 0;                 // ogni guida nuova annulla i passi rimasti a quella di prima
  const prima = () => palco.querySelector('.configura__invito');
  const preparaPalco = () => {
    if (svg) return;
    svg = crea('svg', { class: 'configura__linee', viewBox: '0 0 1800 1000', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    nota = document.createElement('div');
    nota.className = 'configura__nota-guida';
    nota.setAttribute('role', 'status');
    nota.hidden = true;
    prima().before(svg);
  };
  /** La nota va sotto la riga del campo (i campi stanno a due a due): dopo l'ultimo campo alla stessa altezza. */
  const sottoLaRiga = (b) => {
    const campo = b.closest('.misura');
    let ultimo = campo;
    for (let x = campo.nextElementSibling; x && x.classList.contains('misura') && x.offsetTop === campo.offsetTop; x = x.nextElementSibling) ultimo = x;
    ultimo.after(nota);
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
      svg.before(retro);
    }
    // vero se la camicia da dietro è pronta; se non arriva in tre secondi (rete lenta) o non c'è, la camicia non si gira
    const pronta = retro.decode().then(() => retro.naturalWidth > 0, () => false);
    return Promise.race([pronta, new Promise((fatto) => setTimeout(() => fatto(false), 3000))]);
  };
  // La camicia si gira un giro alla volta, verso la vista chiesta per ultima: chi clicca in fretta su più «i» non la
  // lascia mai a metà né di spalle sotto la linea di una misura davanti. Un giro cominciato finisce; poi, se intanto
  // è stata chiesta l'altra vista, si gira di nuovo.
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
        if (!ridotto.matches && palco.dataset.giro) await suona(palco.dataset.giro);
        retro.hidden = false;
        if (video) video.hidden = true;
        vista = 'dietro';
      } else {
        ruota = true;
        // la camicia di spalle resta finché il video del ritorno non è sullo schermo: niente lampo della camicia davanti
        if (!ridotto.matches && palco.dataset.ritorno) await suona(palco.dataset.ritorno, () => { if (retro) retro.hidden = true; });
        if (retro) retro.hidden = true;
        if (video) video.hidden = true;
        vista = 'davanti';
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
  function chiudiPalco({ resta = false } = {}) {
    turno++;
    if (aperta) aperta.setAttribute('aria-expanded', 'false');
    aperta = null;
    delete palco.dataset.guidaAperta;
    if (svg) svg.replaceChildren();
    if (nota) { nota.hidden = true; nota.replaceChildren(); }
    if (resta) return;
    const mio = turno;
    gira('davanti').then(() => { if (mio === turno) controllo?.riparti(); });
  }
  async function apriPalco(b) {
    preparaPalco();
    const mio = ++turno;
    if (aperta && aperta !== b) aperta.setAttribute('aria-expanded', 'false');
    aperta = b;
    b.setAttribute('aria-expanded', 'true');
    palco.dataset.guidaAperta = b.dataset.guida;
    svg.replaceChildren();
    // la nota con il nome della misura e la frase, subito: la linea arriva appena la camicia è pronta
    const chiudi = document.createElement('button');
    chiudi.type = 'button'; chiudi.className = 'configura__nota-chiudi';
    chiudi.setAttribute('aria-label', document.querySelector('#guida-finestra .finestra__chiudi')?.getAttribute('aria-label') || 'Chiudi');
    chiudi.innerHTML = document.querySelector('#guida-finestra .finestra__chiudi')?.innerHTML || '×';
    chiudi.addEventListener('click', () => { const torna = aperta; chiudiPalco(); torna?.focus(); });
    const titolo = Object.assign(document.createElement('p'), { className: 'configura__nota-titolo', textContent: etichetta(b) });
    const testo = Object.assign(document.createElement('p'), { className: 'configura__nota-frase', innerHTML: frase(b.dataset.guida) });
    nota.replaceChildren(titolo, testo, chiudi);
    // la nota si sposta sotto la riga nuova: la «i» appena cliccata resta dov'era sotto il puntatore
    const primaY = b.getBoundingClientRect().top;
    nota.hidden = true;
    sottoLaRiga(b);
    nota.hidden = false;
    const salto = b.getBoundingClientRect().top - primaY;
    if (Math.abs(salto) > 1) scrollBy({ top: salto, behavior: 'auto' });
    // e se la nota finisce sotto il bordo dello schermo, la pagina sale quanto basta (non oltre la riga del campo)
    const sotto = nota.getBoundingClientRect().bottom - (innerHeight - 16);
    const margine = b.getBoundingClientRect().top - 96;
    if (sotto > 0 && margine > 0) scrollBy({ top: Math.min(sotto, margine), behavior: ridotto.matches ? 'auto' : 'smooth' });
    const [d] = await Promise.all([linee(), controllo ? controllo.ferma() : null]);
    if (mio !== turno) return;
    const misura = d?.misure?.[b.dataset.guida];
    if (b.dataset.vista === 'dietro') {
      const girata = await gira('dietro');
      if (mio !== turno) return;
      if (!girata) { sulRetro(testo, frase('sul-retro')); return; }
    } else {
      await gira('davanti');
      if (mio !== turno) return;
    }
    if (misura) disegnaLinea(svg, misura, 'palco');
  }

  // ------------------------------------------------------------ nella finestra (telefono, tablet, finestre strette)
  const finestra = document.getElementById('guida-finestra');
  let daFinestra = null;
  finestra?.addEventListener('close', () => {
    blocca(false);
    daFinestra?.setAttribute('aria-expanded', 'false');
    daFinestra = null;
    finestra.querySelector('[data-guida-figura]').replaceChildren();
  });
  async function apriFinestra(b) {
    if (!finestra || typeof finestra.showModal !== 'function') return;
    daFinestra = b;
    b.setAttribute('aria-expanded', 'true');
    finestra.querySelector('.finestra__titolo').textContent = etichetta(b);
    const testo = finestra.querySelector('[data-guida-frase]');
    testo.innerHTML = frase(b.dataset.guida);
    const figura = finestra.querySelector('[data-guida-figura]');
    figura.replaceChildren();
    finestra.showModal();
    blocca(true);
    const d = await linee();
    const misura = d?.misure?.[b.dataset.guida];
    const dietro = b.dataset.vista === 'dietro';
    const foto = dietro ? palco.dataset.dietro : palco.dataset.ferma;
    if (daFinestra !== b) return;
    if (!misura || !foto) {
      if (dietro) sulRetro(testo, frase('sul-retro'));
      return;
    }
    const svgF = crea('svg', { class: 'guida-finestra__camicia', viewBox: inquadra(misura.riquadro).join(' '), role: 'img', 'aria-label': `${etichetta(b)}: ${testo.textContent}` });
    svgF.append(crea('image', { href: foto, x: 0, y: 0, width: 1800, height: 1000, preserveAspectRatio: 'none' }));
    const sopra = crea('g');
    svgF.append(sopra);
    figura.replaceChildren(svgF);
    if (dietro) figura.dataset.vista = 'dietro'; else delete figura.dataset.vista;
    // la linea si disegna quando la camicia è caricata, così la si vede comparire
    const im = new Image();
    im.src = foto;
    const caricata = await im.decode().then(() => im.naturalWidth > 0, () => false);
    if (daFinestra !== b) return;
    if (!caricata) {
      figura.replaceChildren();
      if (dietro) sulRetro(testo, frase('sul-retro'));
      return;
    }
    const g = crea('svg', { viewBox: '0 0 1800 1000', x: 0, y: 0, width: 1800, height: 1000, overflow: 'visible' });
    sopra.append(g);
    disegnaLinea(g, misura, 'finestra');
  }

  // ------------------------------------------------------------ le «i»
  const sulPalco = () => getComputedStyle(palco).position === 'sticky';
  for (const b of bottoni) {
    b.addEventListener('click', () => {
      if (sulPalco()) {
        if (aperta === b) { chiudiPalco(); return; }
        apriPalco(b);
      } else apriFinestra(b);
    });
  }
  // Esc chiude la guida sul palco; toccare la camicia anche (e lei torna a rispondere alla mano)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aperta && !document.querySelector('dialog[open]')) { const torna = aperta; chiudiPalco(); torna.focus(); }
  });
  palco.addEventListener('click', () => { if (aperta) chiudiPalco(); });
  // se la finestra si stringe con una guida aperta, la guida sul palco si chiude (la si riapre nella finestra)
  addEventListener('resize', () => { if (aperta && !sulPalco()) chiudiPalco(); });
}
