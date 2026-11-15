// Comportamenti comuni del sito. La pagina funziona già senza: qui si aggiungono solo comodità.
// L'apertura ha un suo file (src/apertura/apertura.js), caricato solo nella pagina iniziale.

import Lenis from 'lenis';

const ridotto = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- scorrimento morbido
// Lenis ammorbidisce rotella e dito. Con il movimento ridotto resta lo scorrimento del sistema.
let lenis = null;
function scorrimento() {
  if (ridotto) return;
  lenis = new Lenis({
    lerp: 0.085,
    wheelMultiplier: 0.9,
    syncTouch: true,
    syncTouchLerp: 0.085,
    autoRaf: true,
    // nel campo delle note comanda il campo solo se ha davvero testo da scorrere; altrimenti scorre la pagina
    prevent: (el) => el.tagName === 'TEXTAREA' && el.scrollHeight > el.clientHeight,
  });
  // se la persona prende in mano lo scorrimento durante uno guidato, la guida finisce lì
  lenis.on('virtual-scroll', () => { if (guidato) { clearTimeout(fineGuida); guidato = false; } });
}

// Durante uno scorrimento guidato (selettore, collegamenti interni) la testata non torna come barra:
// coprirebbe il titolo della sezione appena raggiunta.
let guidato = false;
let fineGuida = 0;

/** Porta un elemento in cima allo schermo, rispettando il suo scroll-margin-top. */
function vaiA(el, { subito = false } = {}) {
  let y;
  if (el.classList.contains('eroe')) {
    // il video è attaccato sotto l'apertura: la sua posizione vera è dove l'apertura finisce
    const a = document.querySelector('.apertura');
    y = a ? a.getBoundingClientRect().bottom + scrollY : 0;
  } else {
    y = el.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
  }
  guidato = true;
  clearTimeout(fineGuida);
  const libera = () => { fineGuida = setTimeout(() => { guidato = false; }, 150); };
  if (lenis) lenis.scrollTo(y, { immediate: subito, duration: 1.2, force: true, onComplete: libera });
  else { scrollTo({ top: y, behavior: subito || ridotto ? 'auto' : 'smooth' }); fineGuida = setTimeout(() => { guidato = false; }, 1200); }
  if (subito) libera();
}

// I collegamenti a un punto della stessa pagina scorrono fin lì; "Salta" ci va di colpo.
function ancore() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.hash.length < 2) return;
    const meta = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!meta) return;
    e.preventDefault();
    const salto = a.matches('.apertura__salta, .salta-al-contenuto');
    vaiA(meta, { subito: salto });
    history.replaceState(null, '', url.hash);
    // il fuoco da tastiera segue la pagina: il prossimo Tab riparte dalla sezione raggiunta
    if (!meta.hasAttribute('tabindex')) meta.tabIndex = -1;
    meta.focus({ preventScroll: true });
  });
}

// ---------------------------------------------------------------- testata e pillola fissa
// Sull'apertura e sul video la testata resta trasparente; dopo si ritira scendendo e torna come barra risalendo.
function testata() {
  const el = document.querySelector('[data-testata]');
  const pillola = document.querySelector('[data-pillola-fissa]');
  const eroe = document.querySelector('.eroe');
  const apertura = document.querySelector('.apertura');
  const piede = document.querySelector('.piede');
  const moduli = [...document.querySelectorAll('[data-modulo]')];
  const stretto = matchMedia('(max-width: 809px)');
  if (!el) return;
  let ultimo = scrollY;
  let stato = '';
  let richiesta = 0;

  function imposta(nuovo) {
    if (nuovo === stato) return;
    stato = nuovo;
    if (nuovo) el.dataset.stato = nuovo;
    else delete el.dataset.stato;
    document.body.toggleAttribute('data-barra', nuovo === 'barra');
  }

  function aggiorna() {
    richiesta = 0;
    const y = scrollY;
    const delta = y - ultimo;
    const limite = eroe ? eroe.getBoundingClientRect().bottom + y - 80 : 160;
    if (y < limite) imposta('');
    else if (guidato) imposta('via');
    else if (delta < -6) imposta('barra');
    else if (delta > 6) imposta('via');
    else if (!stato) imposta('via');
    if (Math.abs(delta) > 6 || y < limite) ultimo = y;
    // la pillola di WhatsApp non copre il film: compare quando l'apertura sta per finire
    if (pillola) {
      const sulFilm = apertura && apertura.getBoundingClientRect().bottom > innerHeight * 0.5;
      const sulPiede = piede && piede.getBoundingClientRect().top < innerHeight - 8;
      const sulModulo = stretto.matches && moduli.some((m) => { const r = m.getBoundingClientRect(); return r.top < innerHeight - 40 && r.bottom > innerHeight - 140; });
      pillola.toggleAttribute('data-visibile', !sulFilm);
      pillola.toggleAttribute('data-via', Boolean(sulPiede || sulModulo));
    }
  }

  addEventListener('scroll', () => { if (!richiesta) richiesta = requestAnimationFrame(aggiorna); }, { passive: true });
  addEventListener('resize', aggiorna, { passive: true });
  aggiorna();
}

// ---------------------------------------------------------------- menu del telefono
// Senza script "Menu" è un link al piè di pagina. Con lo script diventa un pulsante che apre un <dialog> a tutto
// schermo: il fuoco resta dentro, Esc lo chiude, la pagina sotto non scorre, scegliere una voce lo chiude.
function menu() {
  const dialogo = document.querySelector('[data-menu]');
  const link = document.querySelector('[data-menu-apri]');
  if (!dialogo || !link || typeof dialogo.showModal !== 'function') return;
  const pulsante = document.createElement('button');
  pulsante.type = 'button';
  pulsante.className = link.className;
  pulsante.textContent = link.textContent;
  pulsante.setAttribute('aria-haspopup', 'dialog');
  pulsante.setAttribute('aria-expanded', 'false');
  pulsante.setAttribute('aria-controls', dialogo.id);
  link.replaceWith(pulsante);

  const chiudi = () => { if (dialogo.open) dialogo.close(); };
  pulsante.addEventListener('click', () => {
    dialogo.showModal();
    pulsante.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('menu-aperto');
    lenis?.stop();
  });
  // alla chiusura (pulsante, Esc o voce scelta) la pagina torna a scorrere e il fuoco torna su "Menu"
  dialogo.addEventListener('close', () => {
    pulsante.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('menu-aperto');
    lenis?.start();
  });
  dialogo.querySelector('[data-menu-chiudi]')?.addEventListener('click', chiudi);
  dialogo.querySelectorAll('a').forEach((a) => a.addEventListener('click', chiudi));
  // se lo schermo si allarga (telefono girato, finestra ingrandita) il menu non serve più
  matchMedia('(min-width: 810px)').addEventListener('change', (e) => { if (e.matches) chiudi(); });
}

// ---------------------------------------------------------------- selettore delle sezioni
function selettore() {
  const nav = document.querySelector('[data-selettore]');
  if (!nav) return;
  const voci = [...nav.querySelectorAll('[data-voce]')];
  const sezioni = [...document.querySelectorAll('[data-gruppo]')];
  const apri = nav.querySelector('.selettore__apri');
  const attuale = nav.querySelector('[data-selettore-attuale]');
  let gruppo = '';
  let richiesta = 0;

  // su telefono le voci stanno in una tendina sotto il nome della sezione
  apri.hidden = false;
  nav.classList.add('selettore--chiuso');
  const chiudi = () => { nav.classList.add('selettore--chiuso'); apri.setAttribute('aria-expanded', 'false'); };
  let apertoA = 0;
  apri.addEventListener('click', () => {
    const chiuso = nav.classList.toggle('selettore--chiuso');
    apri.setAttribute('aria-expanded', String(!chiuso));
    apertoA = scrollY;
  });
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) chiudi(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') chiudi(); });

  voci.forEach((a) => a.addEventListener('click', chiudi));

  // la pillola blu che scivola sotto la voce attiva (solo su schermi larghi, vedi sito.css)
  const indicatore = document.createElement('span');
  indicatore.className = 'selettore__indicatore';
  indicatore.setAttribute('aria-hidden', 'true');
  nav.prepend(indicatore);
  nav.classList.add('selettore--indicatore');
  function posiziona(subito) {
    const a = voci.find((v) => v.dataset.voce === gruppo) || voci[0];
    const largo = indicatore.offsetWidth;
    if (!largo) return;
    const sinistra = a.getBoundingClientRect().left - indicatore.getBoundingClientRect().left;
    indicatore.toggleAttribute('data-subito', !!subito);
    indicatore.style.setProperty('--sinistra', sinistra + 'px');
    indicatore.style.setProperty('--destra', Math.max(0, largo - sinistra - a.offsetWidth) + 'px');
  }
  addEventListener('resize', () => posiziona(true), { passive: true });

  function aggiorna() {
    richiesta = 0;
    if (!nav.classList.contains('selettore--chiuso') && Math.abs(scrollY - apertoA) > 48) chiudi();
    const soglia = nav.getBoundingClientRect().bottom + 60;
    let scelto = sezioni[0]?.dataset.gruppo;
    for (const s of sezioni) if (s.getBoundingClientRect().top <= soglia) scelto = s.dataset.gruppo;
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) scelto = sezioni[sezioni.length - 1]?.dataset.gruppo;
    if (scelto === gruppo) return;
    const primaVolta = !gruppo;
    gruppo = scelto;
    voci.forEach((a) => {
      const si = a.dataset.voce === gruppo;
      if (si) { a.setAttribute('aria-current', 'true'); attuale.textContent = a.textContent; }
      else a.removeAttribute('aria-current');
    });
    posiziona(primaVolta);
  }
  addEventListener('scroll', () => { if (!richiesta) richiesta = requestAnimationFrame(aggiorna); }, { passive: true });
  aggiorna();
}

// ---------------------------------------------------------------- comparse allo scorrimento
// Una volta sola per elemento: titoli parola per parola, testi e foto che salgono, foto grandi che si aprono.
const COMPARSE = [
  // [selettore, tipo, ritardo in ms o 'gruppo' per scalare gli elementi che entrano insieme]
  ['.intesta .titolo, .funziona__testo > .titolo, .domande > .titolo, .prezzo__testo .titolo', 'parole', 0],
  ['.intesta .testo, .funziona__testo > .testo, .prezzo__testo .testo', 'su', 160],
  ['.intesta .collegamento', 'su', 260],
  ['.nastro', 'su', 0],
  ['.griglia__voce, .passi li, .riquadri li, .domanda, .capo, .contatti li', 'su', 'gruppo'],
  ['.capitolo__foto', 'tenda', 0],
  ['.capitolo__testo', 'su', 200],
  ['.chiusura__azioni', 'su', 260],
  ['.vetrina__tutti, .mestiere__fondo', 'su', 0],
  ['.grande, .prezzo__foto', 'tenda', 0],
  ['.scheda-misure', 'scheda', 450],
  ['.pannello', 'su', 120],
  ['.carosello', 'su', 0],
  ['.prezzo__fondo', 'su', 200],
];

/** Mette ogni parola di un titolo in uno <span class="parola">; i segnaposto restano interi. */
function dividiParole(el) {
  let i = 0;
  const cammina = (nodo) => {
    for (const figlio of [...nodo.childNodes]) {
      if (figlio.nodeType === Node.TEXT_NODE) {
        const pezzi = document.createDocumentFragment();
        for (const p of figlio.textContent.split(/(\s+)/)) {
          if (!p) continue;
          if (/^\s+$/.test(p)) { pezzi.append(p); continue; }
          const s = document.createElement('span');
          s.className = 'parola';
          s.textContent = p;
          s.style.setProperty('--i', i++);
          pezzi.append(s);
        }
        figlio.replaceWith(pezzi);
      } else if (figlio.nodeType === Node.ELEMENT_NODE) {
        if (figlio.classList.contains('da-confermare')) { figlio.classList.add('parola'); figlio.style.setProperty('--i', i++); }
        else cammina(figlio);
      }
    }
  };
  cammina(el);
  return i;
}

function comparse() {
  if (ridotto || !('IntersectionObserver' in window)) return;
  const tutti = [];
  for (const [sel, tipo, ritardo] of COMPARSE) {
    document.querySelectorAll(sel).forEach((el) => {
      if (el.dataset.rivela) return;
      el.dataset.rivela = tipo;
      if (ritardo === 'gruppo') el.dataset.gruppoComparsa = '';
      else if (ritardo) el.style.setProperty('--ritardo', ritardo + 'ms');
      if (tipo === 'parole') dividiParole(el);
      tutti.push(el);
    });
  }
  // quello che è già sullo schermo resta com'è
  const apertura = document.querySelector('.apertura');
  const copertoFinoA = apertura ? apertura.getBoundingClientRect().bottom : 0;
  for (const el of tutti) {
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > Math.max(0, copertoFinoA)) el.setAttribute('data-subito', '');
  }
  document.documentElement.classList.add('movimento');
  for (const el of tutti) if (el.hasAttribute('data-subito')) el.setAttribute('data-visto', '');

  const osserva = new IntersectionObserver((voci) => {
    const entrate = voci.filter((v) => v.isIntersecting).map((v) => v.target);
    entrate.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.top - rb.top || ra.left - rb.left; });
    let k = 0;
    for (const el of entrate) {
      if ('gruppoComparsa' in el.dataset) el.style.setProperty('--ritardo', Math.min(k++, 6) * 60 + 'ms');
      el.setAttribute('data-visto', '');
      osserva.unobserve(el);
    }
  }, { rootMargin: '0px 0px -10% 0px' });
  tutti.forEach((el) => { if (!el.hasAttribute('data-visto')) osserva.observe(el); });
  document.addEventListener('focusin', (e) => {
    for (let el = e.target.closest?.('[data-rivela]'); el; el = el.parentElement?.closest('[data-rivela]')) el.setAttribute('data-visto', '');
  });

  // il titolo del video è coperto dall'apertura: entra quando il telo si solleva
  const eroe = document.querySelector('.eroe');
  if (!eroe) return;
  const titolo = eroe.querySelector('.eroe__titolo');
  const sotto = eroe.querySelector('.eroe__sotto');
  if (!titolo) return;
  titolo.dataset.rivela = 'parole';
  const n = dividiParole(titolo);
  if (sotto) {
    sotto.dataset.rivela = 'su';
    sotto.style.setProperty('--ritardo', 200 + n * 55 + 'ms');
  }
  // le pillole sotto il titolo entrano per ultime; se ricevono il fuoco prima, compaiono subito
  const azioni = eroe.querySelector('.eroe__azioni');
  if (azioni) {
    azioni.dataset.rivela = 'su';
    azioni.style.setProperty('--ritardo', 360 + n * 55 + 'ms');
  }
  let richiesta = 0;
  const controlla = () => {
    richiesta = 0;
    if (apertura && apertura.getBoundingClientRect().bottom > innerHeight * 0.55) return;
    titolo.setAttribute('data-visto', '');
    sotto?.setAttribute('data-visto', '');
    azioni?.setAttribute('data-visto', '');
    removeEventListener('scroll', aScorrimento);
  };
  const aScorrimento = () => { if (!richiesta) richiesta = requestAnimationFrame(controlla); };
  addEventListener('scroll', aScorrimento, { passive: true });
  controlla();
}

// ---------------------------------------------------------------- cultura e artigianato
// La sezione resta ferma sullo schermo: ogni foto nuova si scopre dal basso sopra la precedente, circa due terzi
// di schermo di scorrimento ciascuna. Senza script o con movimento ridotto i capitoli stanno uno sotto l'altro.
function mestiere() {
  if (ridotto) return;
  document.querySelectorAll('[data-mestiere]').forEach((sez) => {
    const binario = sez.querySelector('.mestiere__binario');
    const palco = sez.querySelector('.mestiere__palco');
    const capitoli = [...sez.querySelectorAll('.mestiere__capitolo')];
    if (!binario || capitoli.length < 2) return;
    sez.classList.add('mestiere--vivo');
    let richiesta = 0;
    function aggiorna() {
      richiesta = 0;
      const alto = palco.clientHeight;
      const passo = alto * 0.66;
      const fatto = -binario.getBoundingClientRect().top - alto * 0.17;   // un attimo fermi prima della prima foto
      let attivo = 0;
      capitoli.forEach((c, k) => {
        if (!k) return;
        const p = Math.min(1, Math.max(0, (fatto - (k - 1) * passo) / passo));
        c.style.setProperty('--p', p.toFixed(4));
        if (p >= 0.55) attivo = k;
      });
      capitoli.forEach((c, k) => c.toggleAttribute('data-attivo', k === attivo));
    }
    const chiedi = () => { if (!richiesta) richiesta = requestAnimationFrame(aggiorna); };
    addEventListener('scroll', chiedi, { passive: true });
    addEventListener('resize', chiedi, { passive: true });
    aggiorna();
  });
}

// ---------------------------------------------------------------- carosello della storia
function carosello(radice) {
  const voci = [...radice.querySelectorAll('.carosello__voce')];
  const prec = radice.querySelector('.carosello__freccia--prec');
  const succ = radice.querySelector('.carosello__freccia--succ');
  const n = voci.length;
  if (n < 3) return;
  let i = 0;
  radice.classList.add('carosello--vivo');
  radice.setAttribute('aria-roledescription', 'carosello');
  prec.hidden = succ.hidden = false;

  function mostra(nuovo) {
    i = (nuovo + n) % n;
    voci.forEach((v, k) => {
      const d = (k - i + n) % n;
      const posto = d === 0 ? 'centro' : d === 1 ? 'destra' : d === n - 1 ? 'sinistra' : '';
      if (posto) v.dataset.posto = posto;
      else delete v.dataset.posto;
      v.setAttribute('aria-hidden', String(posto !== 'centro'));
    });
  }
  prec.addEventListener('click', () => mostra(i - 1));
  succ.addEventListener('click', () => mostra(i + 1));
  voci.forEach((v, k) => v.addEventListener('click', () => { if (v.dataset.posto && v.dataset.posto !== 'centro') mostra(k); }));

  // trascinando di lato col dito si passa al capitolo vicino
  let x0 = null, y0 = 0;
  radice.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { x0 = e.clientX; y0 = e.clientY; } });
  radice.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) mostra(i + (dx < 0 ? 1 : -1));
  });
  radice.addEventListener('pointercancel', () => { x0 = null; });
  mostra(0);
}

// ---------------------------------------------------------------- modulo di prenotazione
// Senza script il modulo si invia normalmente e il Worker risponde con una pagina di conferma.
function modulo(form) {
  const bottone = form.querySelector('button[type="submit"]');
  const esito = form.querySelector('.modulo__esito');
  const giorno = form.querySelector('[data-giorno]');
  if (giorno) giorno.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  // l'antispam di Cloudflare si carica solo quando qualcuno inizia a compilare il modulo
  if (form.hasAttribute('data-turnstile')) {
    form.addEventListener('focusin', () => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      s.async = true;
      document.head.appendChild(s);
    }, { once: true });
  }

  // "almeno una casella" non si impone con il solo HTML: lo si controlla qui (e il Worker lo ricontrolla sempre)
  const gruppi = [...form.querySelectorAll('[data-almeno-uno]')];
  const controllaGruppi = () => {
    for (const g of gruppi) {
      const caselle = [...g.querySelectorAll('input[type="checkbox"]')];
      caselle[0]?.setCustomValidity(caselle.some((c) => c.checked) ? '' : g.dataset.errore || 'Scegli almeno una voce.');
    }
  };
  gruppi.forEach((g) => g.addEventListener('change', controllaGruppi));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    controllaGruppi();
    if (!form.reportValidity()) return;
    const testo = bottone.textContent;
    bottone.disabled = true;
    bottone.textContent = bottone.dataset.testoInvio;
    esito.textContent = '';
    try {
      const r = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      const dati = await r.json().catch(() => ({}));
      if (!r.ok || !dati.ok) { esito.textContent = dati.errore || esito.dataset.errore; return; }
      form.dataset.stato = 'fatto';
      esito.textContent = esito.dataset.fatto;
    } catch (errore) {
      esito.textContent = esito.dataset.errore;
    } finally {
      bottone.disabled = false;
      bottone.textContent = testo;
    }
  });
}

// Ogni comodità parte per conto suo: se una si rompe, le altre funzionano lo stesso.
// Se si rompono le comparse, la pagina torna tutta visibile.
function avvia(nome, fn) {
  try {
    fn();
  } catch (errore) {
    console.error('sito: ' + nome, errore);
    if (nome === 'comparse') document.documentElement.classList.remove('movimento');
  }
}

avvia('scorrimento', scorrimento);
avvia('ancore', ancore);
avvia('testata', testata);
avvia('menu', menu);
avvia('selettore', selettore);
avvia('mestiere', mestiere);
avvia('comparse', comparse);
avvia('carosello', () => document.querySelectorAll('[data-carosello]').forEach(carosello));
avvia('modulo', () => document.querySelectorAll('[data-modulo]').forEach(modulo));
