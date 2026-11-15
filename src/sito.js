// Comportamenti comuni del sito. La pagina funziona già senza: qui si aggiungono solo comodità.
// L'apertura ha un suo file (src/apertura/apertura.js), caricato solo nella pagina iniziale.

const ridotto = matchMedia('(prefers-reduced-motion: reduce)');
const comportamento = () => (ridotto.matches ? 'auto' : 'smooth');

// ---------------------------------------------------------------- testata e pillola fissa
// Sull'apertura e sul video la testata resta trasparente; dopo si ritira scendendo e torna come barra risalendo.
function testata() {
  const el = document.querySelector('[data-testata]');
  const pillola = document.querySelector('[data-pillola-fissa]');
  const eroe = document.querySelector('.eroe');
  const apertura = document.querySelector('.apertura');
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
    else if (delta < -6) imposta('barra');
    else if (delta > 6) imposta('via');
    else if (!stato) imposta('via');
    if (Math.abs(delta) > 6 || y < limite) ultimo = y;
    // la pillola di WhatsApp non copre il film: compare quando l'apertura sta per finire
    if (pillola) pillola.toggleAttribute('data-visibile', !apertura || apertura.getBoundingClientRect().bottom <= innerHeight * 0.5);
  }

  addEventListener('scroll', () => { if (!richiesta) richiesta = requestAnimationFrame(aggiorna); }, { passive: true });
  addEventListener('resize', aggiorna, { passive: true });
  aggiorna();
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
  apri.addEventListener('click', () => {
    const chiuso = nav.classList.toggle('selettore--chiuso');
    apri.setAttribute('aria-expanded', String(!chiuso));
  });
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) chiudi(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') chiudi(); });

  voci.forEach((a) => a.addEventListener('click', (e) => {
    const meta = document.getElementById(a.dataset.voce);
    if (!meta) return;
    e.preventDefault();
    chiudi();
    meta.scrollIntoView({ behavior: comportamento(), block: 'start' });
    history.replaceState(null, '', '#' + a.dataset.voce);
  }));

  function aggiorna() {
    richiesta = 0;
    const soglia = nav.getBoundingClientRect().bottom + 60;
    let scelto = sezioni[0]?.dataset.gruppo;
    for (const s of sezioni) if (s.getBoundingClientRect().top <= soglia) scelto = s.dataset.gruppo;
    if (scelto === gruppo) return;
    gruppo = scelto;
    voci.forEach((a) => {
      const si = a.dataset.voce === gruppo;
      if (si) { a.setAttribute('aria-current', 'true'); attuale.textContent = a.textContent; }
      else a.removeAttribute('aria-current');
    });
  }
  addEventListener('scroll', () => { if (!richiesta) richiesta = requestAnimationFrame(aggiorna); }, { passive: true });
  aggiorna();
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const testo = bottone.textContent;
    bottone.disabled = true;
    bottone.textContent = bottone.dataset.testoInvio;
    esito.textContent = '';
    try {
      const r = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      const dati = await r.json().catch(() => ({}));
      if (!r.ok || !dati.ok) throw new Error(dati.errore || 'invio non riuscito');
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

testata();
selettore();
document.querySelectorAll('[data-carosello]').forEach(carosello);
document.querySelectorAll('[data-modulo]').forEach(modulo);
