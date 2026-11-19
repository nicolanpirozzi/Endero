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

// I collegamenti a un punto della stessa pagina scorrono fin lì; "Vai al contenuto" ci va di colpo.
function ancore() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.hash.length < 2) return;
    const meta = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!meta) return;
    e.preventDefault();
    const salto = a.matches('.salta-al-contenuto');
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
  // sul telefono la pillola si fa da parte sopra i moduli e sopra le schede con un pulsante in basso ([data-pillola-via])
  const moduli = [...document.querySelectorAll('[data-modulo], [data-pillola-via]')];
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

// ---------------------------------------------------------------- finestre: menu e "La tua camicia"
// Senza script il pulsante è un link (al piè di pagina, alla pagina del su misura). Con lo script diventa un
// pulsante che apre un <dialog>: il fuoco resta dentro, Esc lo chiude, la pagina sotto non scorre, scegliere
// una voce lo chiude, e alla chiusura il fuoco torna sul pulsante.
function finestra({ dialogo, link, classe, chiudiFuori = false }) {
  if (!dialogo || !link || typeof dialogo.showModal !== 'function') return null;
  const pulsante = document.createElement('button');
  pulsante.type = 'button';
  pulsante.className = link.className;
  pulsante.innerHTML = link.innerHTML;
  pulsante.setAttribute('aria-haspopup', 'dialog');
  pulsante.setAttribute('aria-expanded', 'false');
  pulsante.setAttribute('aria-controls', dialogo.id);
  link.replaceWith(pulsante);

  let aperta = false;
  // rimette a posto la pagina subito, senza aspettare l'evento "close" (che arriva dopo): così un link della
  // finestra che porta più giù nella stessa pagina trova lo scorrimento già libero
  const libera = () => {
    if (!aperta) return;
    aperta = false;
    pulsante.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove(classe);
    lenis?.start();
  };
  const chiudi = () => { libera(); if (dialogo.open) dialogo.close(); };
  pulsante.addEventListener('click', () => {
    dialogo.showModal();
    aperta = true;
    pulsante.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add(classe);
    lenis?.stop();
  });
  dialogo.addEventListener('close', () => {
    libera();
    if (document.activeElement === document.body || dialogo.contains(document.activeElement)) pulsante.focus({ preventScroll: true });
  });
  // il fuoco gira dentro la finestra: dall'ultima voce si torna alla prima, e viceversa
  dialogo.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const tutti = [...dialogo.querySelectorAll('a[href], button:not([disabled])')];
    const primo = tutti[0], ultimo = tutti[tutti.length - 1];
    if (e.shiftKey && document.activeElement === primo) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primo.focus(); }
  });
  // una voce che porta più giù nella stessa pagina chiude la finestra subito; una che porta a un'altra pagina la
  // lascia aperta fino al cambio di pagina (chiuderla proprio mentre parte la dissolvenza la interrompe)
  dialogo.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname) chiudi();
  }));
  // tornando indietro alla pagina tenuta in memoria dal browser, la finestra è già chiusa
  addEventListener('pageshow', (e) => { if (e.persisted) chiudi(); });
  // un clic sul fondo scurito, fuori dal riquadro, la chiude
  if (chiudiFuori) dialogo.addEventListener('click', (e) => { if (e.target === dialogo) chiudi(); });
  return { chiudi };
}

function menu() {
  const dialogo = document.querySelector('[data-menu]');
  const f = finestra({ dialogo, link: document.querySelector('[data-menu-apri]'), classe: 'menu-aperto' });
  if (!f) return;
  dialogo.querySelector('[data-menu-chiudi]')?.addEventListener('click', f.chiudi);
  // se lo schermo si allarga (telefono girato, finestra ingrandita) il menu non serve più
  matchMedia('(min-width: 810px)').addEventListener('change', (e) => { if (e.matches) f.chiudi(); });
}

// "La tua camicia": due strade, il configuratore online o la presa misure in sede
function camicia() {
  const dialogo = document.querySelector('[data-camicia]');
  const f = finestra({ dialogo, link: document.querySelector('[data-camicia-apri]'), classe: 'dialogo-aperto', chiudiFuori: true });
  if (!f) return;
  dialogo.querySelector('[data-camicia-chiudi]')?.addEventListener('click', f.chiudi);
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

  let sceltaGuidata = '';
  voci.forEach((a) => a.addEventListener('click', () => { sceltaGuidata = a.dataset.voce; chiudi(); }));

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

  // Il tono del vetro segue quello che c'è sotto: si guarda in tre punti lungo il selettore. Basta un punto
  // chiaro per il tono chiaro (le scritte blu si leggono anche sopra il blu scuro, quelle chiare sul bianco no).
  const ignora = '[data-selettore], [data-testata], [data-pillola-fissa], dialog';
  function sotto(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.closest(ignora)) continue;
      if (/^(IMG|VIDEO|CANVAS|PICTURE)$/.test(el.tagName)) return 'foto';
      const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if (!m || (m[3] !== undefined && +m[3] < 0.5)) continue;
      const [r, g, b] = m.map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? 'chiaro' : 'scuro';
    }
    return 'chiaro';
  }
  function tono() {
    const r = nav.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const y = r.top + Math.min(r.height / 2, 22);
    const toni = [0.12, 0.5, 0.88].map((f) => sotto(r.left + r.width * f, y));
    const nuovo = toni.includes('chiaro') ? 'chiaro' : toni.includes('foto') ? 'foto' : 'scuro';
    if (nav.dataset.tono !== nuovo) nav.dataset.tono = nuovo;
  }

  function aggiorna() {
    richiesta = 0;
    tono();
    if (!nav.classList.contains('selettore--chiuso') && Math.abs(scrollY - apertoA) > 48) chiudi();
    const soglia = nav.getBoundingClientRect().bottom + 60;
    let scelto = sezioni[0]?.dataset.gruppo;
    for (const s of sezioni) if (s.getBoundingClientRect().top <= soglia) scelto = s.dataset.gruppo;
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) scelto = sezioni[sezioni.length - 1]?.dataset.gruppo;
    // dopo un clic su una voce resta quella, anche se la pagina finisce prima che la sezione arrivi in cima
    if (sceltaGuidata && guidato) scelto = sceltaGuidata;
    else if (!guidato) sceltaGuidata = '';
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
  ['.intesta .titolo, .funziona__testo > .titolo, .domande > .titolo, .prezzo__testo .titolo, .strade__titolo', 'parole', 0],
  ['.intesta .testo, .funziona__testo > .testo, .prezzo__testo .testo, .strade__testo > .testo', 'su', 160],
  ['.intesta .collegamento, .strade__testo > .pillola', 'su', 260],
  ['.nastro', 'su', 0],
  ['.griglia__voce, .passi li, .riquadri li, .strade__voci li, .domanda, .capo, .contatti li', 'su', 'gruppo'],
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

// ---------------------------------------------------------------- misure del configuratore
// Il riquadro del configuratore per ora non invia nulla (data-non-invia). Qui si controlla solo che ogni misura
// sia un numero positivo dentro i suoi limiti (data-min, data-max), con la virgola o con il punto.
function misure(form) {
  form.addEventListener('submit', (e) => e.preventDefault());
  form.querySelectorAll('input[data-min]').forEach((campo) => {
    const errore = document.getElementById(campo.id + '-errore');
    const controlla = (mostra) => {
      const v = campo.value.trim();
      const n = Number(v.replace(',', '.'));
      const buono = !v || (/^\d{1,3}([.,]\d{1,2})?$/.test(v) && n >= +campo.dataset.min && n <= +campo.dataset.max);
      campo.setCustomValidity(buono ? '' : campo.dataset.errore);
      if (buono) { campo.removeAttribute('aria-invalid'); if (errore) errore.textContent = ''; }
      else if (mostra) { campo.setAttribute('aria-invalid', 'true'); if (errore) errore.textContent = campo.dataset.errore; }
    };
    // mentre si scrive si toglie l'errore appena il numero torna buono; si segnala solo uscendo dal campo
    campo.addEventListener('input', () => controlla(campo.hasAttribute('aria-invalid')));
    campo.addEventListener('change', () => controlla(true));
  });
}

// ---------------------------------------------------------------- lookbook: filtro e foto a tutto schermo
// Senza script la pagina della collezione ha già tutto: i tasti del filtro portano alle quattro parti e ogni foto è
// un link alla sua versione grande. Qui il filtro lascia in vista un tipo solo, e toccando una foto si apre il visore:
// la foto a tutto schermo, le frecce (anche da tastiera), il dito che striscia, Esc o Indietro per chiudere, e il
// tasto che scrive a Endero su WhatsApp di quale foto si parla. /collezione/#<nome della foto> la apre subito.
// Lo stesso visore apre i look della vetrina in pagina iniziale ([data-look-elenco]): lì non c'è filtro, le foto
// sono quelle dodici, e si resta in pagina iniziale; senza script quei riquadri portano alla collezione.
function lookbook() {
  const sez = document.querySelector('[data-lookbook], [data-look-elenco]');
  if (!sez) return;
  const tipi = [...sez.querySelectorAll('[data-tipo]')];
  const tasti = [...sez.querySelectorAll('[data-filtro]')];
  const tutte = [...sez.querySelectorAll('[data-look]')];
  const barra = sez.querySelector('.lookbook__filtro');      // manca in pagina iniziale
  const fila = barra?.querySelector('ul');
  const visibili = () => tutte.filter((a) => !a.closest('[data-tipo]')?.hidden);
  // la pagina in cui ogni foto ha il suo indirizzo: è quello che si manda su WhatsApp
  const paginaFoto = sez.dataset.pagina || location.pathname;
  const pulito = () => location.pathname + location.search;
  const ancora = () => decodeURIComponent(location.hash.slice(1));
  // Safari accetta solo un certo numero di riscritture dell'indirizzo al minuto: se ne rifiuta una si va avanti lo stesso
  const scrivi = (indirizzo, stato = history.state) => { try { history.replaceState(stato, '', indirizzo); } catch { /* resta l'indirizzo di prima */ } };
  let vista = '';

  // sul telefono le voci del filtro possono non starci tutte: dove ce ne sono altre, il bordo sfuma
  const sfuma = () => {
    if (!fila) return;
    fila.toggleAttribute('data-prima', fila.scrollLeft > 4);
    fila.toggleAttribute('data-dopo', fila.scrollLeft + fila.clientWidth < fila.scrollWidth - 4);
  };
  fila?.addEventListener('scroll', sfuma, { passive: true });
  if (fila) addEventListener('resize', sfuma, { passive: true });

  function filtra(tipo, { scorri = true } = {}) {
    if (!barra) return;
    const nuova = tipi.some((t) => t.dataset.tipo === tipo) ? tipo : '';
    const cambia = nuova !== vista;
    vista = nuova;
    for (const t of tipi) t.hidden = Boolean(vista) && t.dataset.tipo !== vista;
    for (const a of tasti) {
      if (a.dataset.filtro === vista) {
        a.setAttribute('aria-current', 'true');
        // la voce accesa si porta in vista dentro la barra, senza spostare la pagina
        const li = a.parentElement;
        if (li.offsetLeft < fila.scrollLeft || li.offsetLeft + li.offsetWidth > fila.scrollLeft + fila.clientWidth) fila.scrollLeft = li.offsetLeft - (fila.clientWidth - li.offsetWidth) / 2;
      } else a.removeAttribute('aria-current');
    }
    sez.toggleAttribute('data-filtrato', Boolean(vista));
    // la griglia è cambiata sotto il filtro: si torna in cima al lookbook, se si era più giù
    if (scorri && cambia && barra.getBoundingClientRect().top < 100) vaiA(tipi.find((t) => !t.hidden) || sez);
    lenis?.resize();
    sfuma();
  }
  for (const a of tasti) {
    a.addEventListener('click', (e) => {
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      filtra(a.dataset.filtro);
      scrivi(a.dataset.filtro ? `#${a.dataset.filtro}` : pulito());
    });
  }
  sfuma();

  // ---- il visore
  const dialogo = document.getElementById('visore');
  const conDialogo = Boolean(dialogo) && typeof dialogo.showModal === 'function';
  const img = conDialogo && dialogo.querySelector('[data-visore-img]');
  const avif = conDialogo && dialogo.querySelector('[data-visore-avif]');
  const tela = conDialogo && dialogo.querySelector('[data-visore-foto]');
  let elenco = [], qui = 0;
  // Aprendo si aggiunge una voce alla cronologia, così Indietro chiude il visore e non la pagina. La voce sotto resta
  // senza ancora e senza posizione da ripristinare: tornandoci (con Indietro, o chiudendo dal tasto) il browser non
  // sposta la pagina, e siamo noi a rimettere l'indirizzo di prima e a portare in vista la foto che si guardava.
  let aperto = false;        // il visore è aperto (lo stato è nostro: l'avviso di chiusura del browser arriva dopo)
  let spinto = false;        // la voce in cima alla cronologia è quella del visore
  let prima = '';            // l'indirizzo che c'era prima di aprire, con il suo eventuale #tipo
  let chiusura = null;       // si è chiuso dal visore e si aspetta che la cronologia torni un passo sotto
  let attesaChiusura = 0;
  let prossima = null;       // il <link> che fa scaricare in anticipo la foto dopo
  let partenza = null;       // la foto da cui si è aperto il visore: chiudendo su quella, la pagina non si muove

  function serie(a, larghe, tipo) {
    const v = sez.dataset.versione ? `?v=${sez.dataset.versione}` : '';
    return larghe.split(',').map((w) => `${sez.dataset.cartella}${a.dataset.look}-v-${w}.${tipo}${v} ${w}w`).join(', ');
  }
  const larga = (a) => `${Math.max(200, Math.round(Math.min(innerWidth, innerHeight * Number(a.dataset.forma))))}px`;
  const eLaSua = (a) => img.currentSrc.includes(`/${a.dataset.look}-v-`);

  function mostra(i) {
    qui = (i + elenco.length) % elenco.length;
    const a = elenco[qui], piccola = a.querySelector('img');
    // subito la foto piccola, già scaricata; la grande le compare sopra appena è pronta
    tela.style.backgroundImage = piccola.currentSrc ? `url("${piccola.currentSrc}")` : '';
    img.setAttribute('data-attesa', '');
    avif.sizes = img.sizes = larga(a);
    avif.srcset = serie(a, a.dataset.v, 'avif');
    img.srcset = serie(a, a.dataset.webp, 'webp');
    img.src = a.dataset.grande || a.href;
    img.alt = piccola.alt;
    // se era già scaricata non arriva nessun avviso: lo si guarda al fotogramma dopo, quando il browser ha scelto
    requestAnimationFrame(() => { if (elenco[qui] === a && img.complete && img.naturalWidth && eLaSua(a)) img.removeAttribute('data-attesa'); });
    dialogo.querySelector('[data-visore-numero]').textContent = qui + 1;
    dialogo.querySelector('[data-visore-quanti]').textContent = elenco.length;
    dialogo.querySelector('[data-visore-tipo]').textContent = a.dataset.nomeTipo || a.closest('[data-tipo]')?.dataset.nome || '';
    dialogo.querySelector('[data-visore-descrizione]').textContent = `. ${piccola.alt}`;
    const indirizzo = `${location.origin}${paginaFoto}#${a.dataset.look}`;
    dialogo.querySelector('[data-visore-chiedi]').href = `${sez.dataset.whatsapp}?text=${encodeURIComponent(`${sez.dataset.messaggio}${piccola.alt}\n${indirizzo}`)}`;
    scrivi(`#${a.dataset.look}`);
    // la foto dopo si scarica intanto, così la freccia non fa aspettare
    const dopo = elenco[(qui + 1) % elenco.length];
    prossima?.remove();
    prossima = null;
    if (dopo && dopo !== a) {
      prossima = Object.assign(document.createElement('link'), { rel: 'preload', as: 'image', type: 'image/avif' });
      prossima.setAttribute('imagesrcset', serie(dopo, dopo.dataset.v, 'avif'));
      prossima.setAttribute('imagesizes', larga(dopo));
      document.head.append(prossima);
    }
  }

  function apri(a, { spingi = true } = {}) {
    if (aperto && !dialogo.open) chiudi();           // chiuso con Esc un attimo fa: prima si finisce di chiudere
    if (chiusura) { chiusura.poi = a; return; }      // si sta ancora chiudendo: si apre appena la cronologia è a posto
    if (aperto) return;
    aperto = true;
    if (a.closest('[data-tipo]')?.hidden) filtra('', { scorri: false });
    elenco = visibili();
    if (spingi) {
      prima = location.href;
      history.scrollRestoration = 'manual';
      scrivi(pulito());
      history.pushState({ visore: true, prima }, '', `#${a.dataset.look}`);
      history.scrollRestoration = 'manual';
      spinto = true;
    }
    partenza = a;
    dialogo.showModal();
    document.documentElement.classList.add('dialogo-aperto');
    lenis?.stop();
    mostra(elenco.indexOf(a));
  }

  /** Chiude il visore. Con Indietro la cronologia è già un passo sotto; altrimenti ce la si riporta e si aspetta. */
  function chiudi({ indietro = false } = {}) {
    if (!aperto) return;
    aperto = false;
    if (dialogo.open) dialogo.close();
    document.documentElement.classList.remove('dialogo-aperto');
    tela.removeAttribute('data-fuori');
    lenis?.start();
    prossima?.remove();
    prossima = null;
    const a = elenco[qui];
    if (indietro || !spinto) {
      // aperta dal suo indirizzo non ha una voce da togliere: basta levare l'ancora
      if (!indietro) scrivi(pulito());
      spinto = false;
      rimetti(a);
      return;
    }
    // si toglie la voce aggiunta aprendo; il resto si fa quando la cronologia è arrivata (popstate, più sotto)
    spinto = false;
    chiusura = { a, poi: null };
    attesaChiusura = setTimeout(() => rimetti(a), 1000);
    history.back();
  }

  /** Dopo la chiusura: l'indirizzo di prima, la pagina sulla foto che si guardava, il fuoco su quella. */
  function rimetti(a) {
    clearTimeout(attesaChiusura);
    const poi = chiusura?.poi;
    chiusura = null;
    if (prima) scrivi(prima, history.state?.visore ? null : history.state);
    prima = '';
    history.scrollRestoration = 'auto';
    if (a) {
      const r = a.getBoundingClientRect();
      // Chi chiude sulla foto da cui era partito ritrova la pagina dov'era, anche se la foto era tagliata dal bordo.
      // Se con le frecce è arrivato a un'altra, o la foto non si vede affatto, la pagina la porta in vista
      const siVede = r.bottom > 96 && r.top < innerHeight - 20;
      if (!(a === partenza && siVede) && (r.top < 96 || r.bottom > innerHeight - 20)) {
        const y = Math.max(0, r.top + scrollY - Math.max(110, (innerHeight - r.height) / 2));
        if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y);
      }
      a.focus({ preventScroll: true });
    }
    partenza = null;
    if (poi) apri(poi);
  }

  if (conDialogo) {
    // la foto grande compare quando è arrivata; se non arriva resta in vista quella piccola che ha dietro
    img.addEventListener('load', () => { if (eLaSua(elenco[qui])) img.removeAttribute('data-attesa'); });
    for (const a of tutte) {
      a.addEventListener('click', (e) => {
        if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        apri(a);
      });
    }
    dialogo.querySelector('[data-visore-chiudi]').addEventListener('click', () => chiudi());
    dialogo.querySelector('[data-visore-prima]').addEventListener('click', () => mostra(qui - 1));
    dialogo.querySelector('[data-visore-dopo]').addEventListener('click', () => mostra(qui + 1));
    // un clic sul fondo, fuori dalla foto, chiude. Dove sta la foto si calcola dalla sua forma: così vale anche
    // mentre la versione grande si sta ancora scaricando
    const fuori = (e) => {
      const forma = Number(elenco[qui].dataset.forma), q = tela.getBoundingClientRect();
      const w = Math.min(q.width, q.height * forma), h = w / forma;
      const x = e.clientX - q.left - (q.width - w) / 2, y = e.clientY - q.top - (q.height - h) / 2;
      return x < 0 || x > w || y < 0 || y > h;
    };
    tela.addEventListener('click', (e) => { if (fuori(e)) chiudi(); });
    tela.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') tela.toggleAttribute('data-fuori', fuori(e)); }, { passive: true });
    dialogo.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); mostra(qui + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); mostra(qui - 1); }
    });
    // se lo schermo cambia (telefono girato, finestra allargata) serve forse una versione più grande
    addEventListener('resize', () => { if (aperto) avif.sizes = img.sizes = larga(elenco[qui]); }, { passive: true });
    // il dito: di lato cambia foto, in giù chiude. Con due dita, o con la pagina ingrandita, non si tocca niente
    let x0 = null, y0 = 0;
    dialogo.addEventListener('touchstart', (e) => {
      const ingrandita = window.visualViewport && visualViewport.scale > 1.05;
      x0 = e.touches.length === 1 && !ingrandita && !e.target.closest('button, a') ? e.touches[0].clientX : null;
      y0 = e.touches[0].clientY;
    }, { passive: true });
    dialogo.addEventListener('touchmove', (e) => { if (e.touches.length > 1) x0 = null; }, { passive: true });
    dialogo.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) mostra(qui + (dx < 0 ? 1 : -1));
      else if (dy > 90 && dy > Math.abs(dx) * 1.4) chiudi();
    }, { passive: true });
    dialogo.addEventListener('touchcancel', () => { x0 = null; }, { passive: true });

    // Esc lo chiude il browser, e l'avviso arriva un attimo dopo: il resto lo fa chiudi(), una volta sola. Se nel
    // frattempo il visore è stato riaperto, l'avviso è quello della chiusura di prima e non conta
    dialogo.addEventListener('close', () => { if (!dialogo.open) chiudi(); });
    addEventListener('popstate', () => {
      if (chiusura) { rimetti(chiusura.a); return; }
      if (aperto) { chiudi({ indietro: true }); return; }
      // con Avanti si torna sulla voce del visore: si riapre quella foto
      const a = history.state?.visore && tutte.find((x) => x.dataset.look === ancora());
      if (a) { prima = history.state.prima || ''; apri(a, { spingi: false }); spinto = aperto; }
    });
  }

  // arrivando con un indirizzo che finisce con il nome di un tipo o di una foto
  function daIndirizzo(primaVolta) {
    const nome = ancora();
    if (!nome) { if (!primaVolta) filtra('', { scorri: false }); return; }
    if (tipi.some((t) => t.dataset.tipo === nome)) { filtra(nome, { scorri: !primaVolta }); return; }
    const a = tutte.find((x) => x.dataset.look === nome);
    if (!a || !conDialogo || aperto) return;
    if (history.state?.visore) {
      // la pagina è stata ricaricata con il visore aperto: sotto c'è ancora la voce di prima, con il suo filtro
      prima = history.state.prima || '';
      const tipoDiPrima = decodeURIComponent((prima.split('#')[1] || ''));
      if (tipi.some((t) => t.dataset.tipo === tipoDiPrima)) filtra(tipoDiPrima, { scorri: false });
      apri(a, { spingi: false });
      spinto = aperto;
    } else apri(a, { spingi: false });
  }
  daIndirizzo(true);
  addEventListener('hashchange', () => { if (!chiusura && !aperto) daIndirizzo(false); });
}


// ---------------------------------------------------------------- il video dell'apertura
// Nella pagina c'è il primo fotogramma, fermo. Il video (il reel sui telefoni, i due modelli a tavola sugli schermi
// larghi) si aggiunge qui quando l'apertura sta per scoprirlo, parte da solo senza audio e gira in tondo; si ferma
// quando esce dallo schermo. Con il movimento ridotto, o se chi guarda ha chiesto di risparmiare dati, resta la foto.
// /?video=lento prova sugli schermi larghi lo stesso video a metà velocità.
function videoEroe() {
  const fondo = document.querySelector('[data-video-eroe]');
  if (!fondo || ridotto || navigator.connection?.saveData) return;
  const telefono = matchMedia('(max-width: 699px)');
  const lento = new URLSearchParams(location.search).get('video') === 'lento' && fondo.dataset.lento;
  const indirizzo = () => (telefono.matches ? fondo.dataset.telefono : lento || fondo.dataset.computer);
  const apertura = document.querySelector('.apertura');
  const eroe = fondo.closest('.eroe');
  const tasto = fondo.parentElement.querySelector('[data-video-ferma]');
  let video = null, inVista = false, fermato = false;

  const suona = () => { if (video && inVista && !fermato && !document.hidden) video.play().catch(() => { /* il browser non lo fa partire da solo: resta la foto */ }); };
  function crea() {
    if (video) return;
    video = Object.assign(document.createElement('video'), { muted: true, loop: true, playsInline: true, preload: 'auto', src: indirizzo() });
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    video.tabIndex = -1;
    // la prima volta che parte, compare sopra la foto e compare il tasto per fermarlo
    video.addEventListener('playing', () => { video.setAttribute('data-parte', ''); if (tasto) tasto.hidden = false; });
    fondo.append(video);
    suona();
  }
  new IntersectionObserver(([voce]) => {
    inVista = voce.isIntersecting;
    if (!video) return;
    if (inVista) suona(); else video.pause();
  }).observe(eroe);
  document.addEventListener('visibilitychange', () => { if (video) { if (document.hidden) video.pause(); else suona(); } });
  // telefono girato, o finestra che passa da stretta a larga: la foto ferma cambia da sola, il video va cambiato qui
  telefono.addEventListener('change', () => {
    if (!video) return;
    video.removeAttribute('data-parte');
    video.src = indirizzo();
    suona();
  });
  // un video che gira da solo deve potersi fermare: il tasto compare con il video, e chi lo ferma lo ritrova fermo
  if (tasto) {
    tasto.addEventListener('click', () => {
      fermato = !fermato;
      tasto.setAttribute('aria-pressed', String(fermato));
      tasto.setAttribute('aria-label', fermato ? tasto.dataset.riparti : tasto.dataset.ferma);
      if (fermato) video?.pause(); else suona();
    });
  }

  // il video sta sotto l'apertura: si comincia a scaricarlo quando al telo manca meno di uno schermo per sollevarsi.
  // Finché l'apertura non ha deciso se parte il film o resta ferma è ancora bassa, e sembrerebbe già finita: si aspetta.
  // E chi ricarica la pagina più giù non lo scarica finché non torna su, a uno schermo dal video.
  const decisa = () => !apertura || apertura.classList.contains('apertura--viva') || apertura.classList.contains('apertura--ferma');
  let richiesta = 0;
  const controlla = () => {
    richiesta = 0;
    if (video || !decisa()) return;
    if (apertura && apertura.getBoundingClientRect().bottom > innerHeight * 2) return;
    if (eroe.getBoundingClientRect().bottom < -innerHeight) return;
    removeEventListener('scroll', aScorrimento);
    crea();
  };
  const aScorrimento = () => { if (!richiesta) richiesta = requestAnimationFrame(controlla); };
  addEventListener('scroll', aScorrimento, { passive: true });
  if (decisa()) controlla();
  else new MutationObserver((_, osservatore) => { if (decisa()) { osservatore.disconnect(); aScorrimento(); } }).observe(apertura, { attributes: true, attributeFilter: ['class'] });
}

// ---------------------------------------------------------------- rivenditori: la voce già segnata nel modulo
// Nella pagina dei rivenditori il "Fai richiesta" di ogni capitolo porta al modulo: qui si segna intanto la voce
// di quel capitolo tra "Cosa ti interessa", così chi arriva non deve ritrovarla. Senza script resta solo il link.
function interesse() {
  for (const a of document.querySelectorAll('a[data-interesse]')) {
    a.addEventListener('click', () => {
      const voce = [...document.querySelectorAll('input[name="interesse"]')].find((x) => x.value === a.dataset.interesse);
      if (!voce || voce.checked) return;
      voce.checked = true;
      voce.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
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
avvia('camicia', camicia);
avvia('selettore', selettore);
avvia('mestiere', mestiere);
avvia('lookbook', lookbook);
avvia('video', videoEroe);
avvia('interesse', interesse);
avvia('comparse', comparse);
avvia('carosello', () => document.querySelectorAll('[data-carosello]').forEach(carosello));
avvia('modulo', () => document.querySelectorAll('[data-modulo]:not([data-non-invia])').forEach(modulo));
avvia('misure', () => document.querySelectorAll('[data-modulo][data-non-invia]').forEach(misure));
