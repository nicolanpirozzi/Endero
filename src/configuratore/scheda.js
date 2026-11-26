// Il riquadro del configuratore in cinque passi (proprietario, 2026-11-25: «Dividi così la configurazione a step:
// Configurazione prodotto, misure, dati clienti, dati spedizione e pagamento. Divisi a step in modo chiaro»).
// L'HTML esce completo dal build (src/pagine/configuratore.mjs): senza script è un modulo solo, con tutti i passi uno
// sotto l'altro. Qui:
// - un passo alla volta, «Passo n di 5» e i nomi dei passi in cima (quelli già fatti si riaprono); «Continua»
//   controlla solo il passo in cui si è (le regole sono quelle del Worker: src/configuratore/ordine.mjs) e porta al
//   primo campo sbagliato, con l'avviso sotto, come negli altri moduli del sito; «Indietro» non perde nulla;
// - i sotto-campi che compaiono con «Sì» o «Personalizzato»; il prezzo sempre in vista, rifatto a ogni scelta;
// - le finestre dei tessuti e dei colori del filo (una per tipo, per tutti i campi);
// - la camicia che segue le scelte: a ogni cambio l'avviso `endero:camicia` (lo ascolta vesti.js) con il collo, il
//   taschino, le iniziali e i tessuti (della camicia, del taschino, dei polsini);
// - ciò che si scrive resta nella scheda del browser (sessionStorage): ricaricando non si perde, chiudendola sì;
// - l'invio a /api/ordine, che apre il pagamento di Stripe (o dice che non è ancora attivo).
// Per i controlli automatici: ?passo=misure (o un altro passo) apre direttamente quel passo.
import testi from '../../contenuti/it/configuratore.json';
import { controllaOrdine, conti, lettere as maiuscole, SPEDIZIONI, provincia } from './ordine.mjs';
import { voce, finestraAperta, finestraChiusa, voceFinestraTolta } from './cronologia.mjs';
import { suggerisciEmail, testi as avvisi } from '../controlli.mjs';

const S = testi.scheda;
const PASSI = S.passi.map((p) => p.id);
const CHIAVE = 'endero-configuratore';
const ridotto = matchMedia('(prefers-reduced-motion: reduce)');
const formato = new Intl.NumberFormat('it-IT', { style: 'currency', currency: S.prezzi.valuta, minimumFractionDigits: 0, maximumFractionDigits: 0 });
const euro = (n) => formato.format(n);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// come t() del build: ciò che non è confermato, tra [[ ]], si vede evidenziato
const testo = (v) => esc(v).replace(/\[\[(.+?)\]\]/g, '<span class="da-confermare">$1</span>');
const piano = (v) => String(v ?? '').replace(/\[\[|\]\]/g, '');
const perCercare = (s) => String(s).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
const leggi = () => { try { return JSON.parse(sessionStorage.getItem(CHIAVE) || 'null'); } catch { return null; } };
const scrivi = (v) => { try { if (v) sessionStorage.setItem(CHIAVE, JSON.stringify(v)); else sessionStorage.removeItem(CHIAVE); } catch { /* scheda privata: si va avanti senza */ } };
/** Sposta la pagina di `di` punti: lo fa src/sito.js, passando dallo scorrimento morbido (che se no lo annullerebbe). */
const scorri = (di, subito = false) => document.dispatchEvent(new CustomEvent('endero:scorri', { detail: { di, subito } }));
/** Ferma la pagina sotto una finestra (src/sito.js ascolta l'avviso), come fa guida.js. */
function blocca(si) {
  document.documentElement.classList.toggle('dialogo-aperto', si);
  document.dispatchEvent(new CustomEvent('endero:blocca', { detail: si }));
}

/**
 * @param {HTMLFormElement} form   il riquadro (form.configura__scheda)
 * @param {object} o
 * @param {() => Promise} o.passi  la finestra «Come prendere le misure» di guida.js: si chiama la prima volta che si
 *                                 entra nel passo Misure (la apre, se l'indirizzo non dice ?senza-passi)
 * @returns {Promise} si compie quando la camicia può salutare: subito, o alla chiusura della finestra delle misure se
 *                    la pagina si apre proprio sul passo Misure
 */
export function scheda(form, { passi: apriPassi = () => Promise.resolve() } = {}) {
  const cerca = new URLSearchParams(location.search);
  const sezioni = Object.fromEntries([...form.querySelectorAll('[data-passo]')].map((s) => [s.dataset.passo, s]));
  const tappe = [...form.querySelectorAll('[data-vai]')];
  const conta = form.querySelector('[data-conta]');
  const indietro = form.querySelector('[data-indietro]');
  const avanti = form.querySelector('[data-avanti]');
  const esito = form.querySelector('[data-esito]');
  const fondo = form.querySelector('[data-fondo]');
  form.noValidate = true;     // gli avvisi li dà la pagina, sotto i campi, non le nuvolette del browser
  // i campi nascosti dei tessuti e dei colori: senza script vale il <select>, con lo script questi
  for (const x of form.querySelectorAll('[data-valore]')) x.disabled = false;

  // i tessuti e i colori, letti una volta dalle finestre (l'elenco sta nell'HTML una volta sola)
  const campioni = new Map([...document.querySelectorAll('#finestra-tessuti [data-id]')].map((el) => [el.dataset.id, { nome: el.querySelector('.campione__nome').textContent, foto: el.querySelector('img')?.getAttribute('src') || '' }]));
  const tinte = new Map([...document.querySelectorAll('#finestra-colori [data-id]')].map((el) => [el.dataset.id, { nome: el.querySelector('.tinta__nome').textContent, tinta: el.dataset.tinta }]));

  /** I dati piatti del modulo, come li legge il Worker (ordine.mjs). */
  function dati() {
    const d = {};
    for (const [k, v] of new FormData(form)) if (!(k in d) && typeof v === 'string') d[k] = v;
    return d;
  }

  let attivo = PASSI[0];
  let fino = 0;                  // il passo più avanti raggiunto: fin lì i nomi in cima si riaprono
  let misureViste = false;       // la finestra «Come prendere le misure» si apre la prima volta che si entra nel passo
  let forseVisto = false;        // «Forse intendevi…» ferma «Continua» una volta sola
  let salutare = Promise.resolve();

  // ------------------------------------------------------------------ avvisi sotto i campi
  const rigaDi = (nome) => document.getElementById(`campo-${nome}-errore`);
  const campoDi = (nome) => form.querySelector(`[data-campo="${CSS.escape(nome)}"]`);
  const nomeDi = (el) => el?.closest?.('[data-campo]')?.dataset.campo || el?.name || '';
  const passoDi = (el) => el?.closest?.('[data-passo]')?.dataset.passo || '';
  const visibile = (el) => !!el && !el.closest('[hidden]');
  /** Scrive (o toglie) l'avviso sotto un campo. */
  function segna(nome, frase = '') {
    const riga = rigaDi(nome), el = campoDi(nome);
    if (riga && riga.textContent !== frase) riga.textContent = frase;
    if (!el) return;
    if (frase) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  }
  /** I campi (con l'avviso) di un passo, nell'ordine della pagina, solo quelli in vista. */
  const campiDi = (passo) => [...(sezioni[passo]?.querySelectorAll('[data-campo]') || [])].filter((el) => visibile(el) || el.matches('[aria-invalid]'));
  const errori = (passo) => controllaOrdine(dati(), { passo });

  // l'email con un dominio quasi giusto: «Forse intendevi …@gmail.com?», con il tasto che la corregge (come src/sito.js)
  function forse(el) {
    let nota = el.closest('.misura').querySelector('.campo__forse');
    const giusta = el.getAttribute('aria-invalid') ? '' : suggerisciEmail(el.value);
    if (!giusta) { nota?.remove(); return false; }
    if (nota?.dataset.email === giusta) return true;
    if (!nota) {
      nota = document.createElement('p');
      nota.className = 'campo__forse';
      rigaDi('email').after(nota);
    }
    const [prima, dopo = ''] = avvisi.email.forse.split('{email}');
    const tasto = Object.assign(document.createElement('button'), { type: 'button', className: 'campo__correggi', textContent: giusta });
    tasto.setAttribute('aria-label', `${avvisi.email.correggi}: ${giusta}`);
    tasto.addEventListener('click', () => {
      el.value = giusta;
      nota.remove();
      segna('email', errori('dati').email || '');
      salva();
      el.focus();
    });
    nota.dataset.email = giusta;
    nota.replaceChildren(prima, tasto, dopo);
    return true;
  }

  // Uscendo da un campo con il clic su un tasto, l'avviso che compare sposta in giù ciò che sta sotto e il clic va
  // perso (revisione del 2026-11-25, src/sito.js): gli avvisi dell'uscita dal campo aspettano la fine del clic.
  let premuto = false;
  const rimandati = [];
  const sciogli = () => setTimeout(() => { premuto = false; rimandati.splice(0).forEach((f) => f()); });
  document.addEventListener('pointerdown', () => { premuto = true; }, true);
  document.addEventListener('pointerup', sciogli, true);
  document.addEventListener('pointercancel', sciogli, true);
  const dopoIlClic = (f) => (premuto ? rimandati.push(f) : setTimeout(f));

  form.addEventListener('focusout', (e) => {
    const el = e.target;
    if (!el.matches?.('input[type="text"], input[type="tel"], input[type="email"], input:not([type])')) return;
    const nome = nomeDi(el), passo = passoDi(el);
    if (!nome || !passo) return;
    dopoIlClic(() => {
      // un campo solo attraversato non si segna: si segnala a «Continua»
      if (el.value.trim() || el.hasAttribute('aria-invalid')) segna(nome, errori(passo)[nome] || '');
      if (nome === 'email') forse(el);
    });
  });
  /** Dopo ogni cambio: gli avvisi già in vista si aggiornano, e spariscono appena il valore è giusto. */
  function riguarda() {
    const e = errori(attivo);
    for (const el of form.querySelectorAll(`[data-passo="${attivo}"] [aria-invalid="true"]`)) {
      const nome = nomeDi(el);
      if (nome) segna(nome, visibile(el) ? (e[nome] || '') : '');
    }
  }

  // ------------------------------------------------------------------ sotto-campi, parti, camicia, prezzo
  let scoperti = [];             // i sotto-campi appena comparsi per una scelta (vedi `scopri`)
  function condizioni() {
    const d = dati();
    for (const el of form.querySelectorAll('[data-se]')) {
      const si = el.dataset.seValore.split(' ').includes(d[el.dataset.se] || '');
      if (el.hidden === si) { el.hidden = !si; if (si) scoperti.push(el); }
    }
  }
  /** I campi comparsi con «Sì» o «Personalizzato» non restano dietro la barra con i tasti: la pagina sale di quanto
   *  serve, senza mandare la riga toccata sotto la testata (revisione del 2026-11-26). */
  function scopri() {
    const el = scoperti.pop();
    scoperti = [];
    if (!el || !visibile(el)) return;
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect(), riga = (el.closest('.voce') || el).getBoundingClientRect();
      const su = Math.max(testata(), 0) + 16, giu = (fondo?.getBoundingClientRect().top || innerHeight) - 12;
      const di = Math.min(r.bottom - giu, riga.top - su);
      if (di > 1) scorri(di);
    });
  }

  let vestita = '';
  let avviata = false;           // il primo avviso parte una volta sola, dopo l'avvio (vesti.js ascolta da allora)
  function camicia(sempre = false) {
    if (!avviata && !sempre) return;
    avviata = true;
    const d = dati();
    const l = maiuscole(d.iniziali_lettere || '').replace(/[^\p{L}]/gu, '').slice(0, 3);
    const detail = {
      collo: d.collo || '',
      taschino: d.taschino === 'si',
      iniziali: d.iniziali === 'si' && d.iniziali_posizione && l ? { posizione: d.iniziali_posizione, lettere: l } : null,
      // i tessuti che colorano la camicia (vesti.js): il suo, quello del taschino e quello dei polsini; interno collo
      // e interno polso sulla camicia non si vedono (proprietario, 2026-11-26: «così semplifichiamo»)
      tessuto: d.tessuto || '',
      taschino_tessuto: d.taschino === 'si' ? d.taschino_tessuto || '' : '',
      polsino_tessuto: d.polsino === 'personalizzato' ? d.polsino_tessuto || '' : '',
    };
    const ora = JSON.stringify(detail);
    if (!sempre && ora === vestita) return;
    vestita = ora;
    document.dispatchEvent(new CustomEvent('endero:camicia', { detail }));
  }

  const contoCamicia = form.querySelector('[data-conto-camicia]');
  const contoTotale = form.querySelector('[data-conto-totale]');
  function prezzi() {
    const d = dati();
    const c = conti(d);
    if (contoCamicia.textContent !== euro(c.camicia)) contoCamicia.textContent = euro(c.camicia);
    if (contoTotale.textContent !== euro(c.totale)) contoTotale.textContent = euro(c.totale);
    // il prezzo di ogni modo di ricevere la camicia, con le camicie scelte («Gratis» sopra la soglia)
    for (const el of form.querySelectorAll('[data-prezzo-modo]')) {
      const modo = SPEDIZIONI.find((s) => s.id === el.dataset.prezzoModo);
      const gratis = !modo.prezzo || c.capi >= S.spedizione.gratis_da;
      const scritta = gratis ? S.spedizione.gratis : euro(modo.prezzo);
      if (el.textContent !== scritta) el.textContent = scritta;
      el.classList.toggle('modo__prezzo--gratis', gratis && !!modo.prezzo);
    }
    return c;
  }

  // ------------------------------------------------------------------ quantità
  const quantita = form.elements.quantita;
  const qMin = Number(quantita?.dataset.min || 1), qMax = Number(quantita?.dataset.max || 999);
  const tastiQ = [...form.querySelectorAll('[data-quanti]')];
  function tastiQuantita() {
    const q = Number.parseInt(quantita.value, 10);
    for (const b of tastiQ) b.disabled = Number(b.dataset.quanti) < 0 ? !(q > qMin) : (Number.isFinite(q) && q >= qMax);
  }
  for (const b of tastiQ) {
    b.addEventListener('click', () => {
      const q = Number.parseInt(quantita.value, 10);
      const nuovo = Math.min(qMax, Math.max(qMin, (Number.isFinite(q) ? q : qMin - Number(b.dataset.quanti)) + Number(b.dataset.quanti)));
      quantita.value = String(nuovo);
      quantita.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  // solo cifre, anche incollando «3 camicie»
  quantita?.addEventListener('input', () => {
    const solo = (quantita.value.match(/\d+/)?.[0] || '').slice(0, 3);
    if (solo !== quantita.value) quantita.value = solo;
  });

  // ------------------------------------------------------------------ tessuti e colori scelti
  function mostraScelta(box) {
    const input = box.querySelector('[data-valore]');
    const scritta = box.querySelector('.scegli__testo');
    const campione = box.querySelector('.scegli__campione');
    const tessuto = box.dataset.scegli === 'tessuto';
    const v = input.value;
    const voce = tessuto ? campioni.get(v) : tinte.get(v);
    if (v && !voce) input.value = '';
    box.classList.toggle('scegli--fatto', !!voce);
    scritta.textContent = voce ? voce.nome : scritta.dataset.vuoto;
    box.querySelector('.scegli__cambia').hidden = !voce;
    const togli = box.querySelector('[data-togli]');
    if (togli) togli.hidden = !voce;
    const chiave = voce ? (tessuto ? voce.foto : voce.tinta) : '';
    if (campione.dataset.chiave === chiave) return;
    campione.dataset.chiave = chiave;
    if (!voce) campione.innerHTML = '<svg class="icona" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 3.5v9M3.5 8h9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    else if (tessuto) campione.innerHTML = voce.foto ? `<img src="${esc(voce.foto)}" alt="" width="320" height="214" decoding="async" draggable="false">` : '';
    else campione.innerHTML = `<i class="scegli__tinta" style="--tinta: ${esc(voce.tinta)}"></i>`;
  }
  const scelte = [...form.querySelectorAll('[data-scegli]')];
  for (const box of scelte) {
    box.querySelector('[data-togli]')?.addEventListener('click', () => {
      const input = box.querySelector('[data-valore]');
      input.value = '';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      box.querySelector('.scegli__tasto').focus();
    });
  }

  // ------------------------------------------------------------------ ricordare
  const NON = new Set(['privacy', 'sito_web', 'cf-turnstile-response', 'cerca']);
  function valori() {
    const v = {};
    for (const el of form.elements) {
      if (!el.name || NON.has(el.name) || el.disabled) continue;
      if (el.type === 'radio') { if (el.checked) v[el.name] = el.value; } else if (el.type !== 'checkbox' && el.type !== 'submit' && el.type !== 'button') v[el.name] = el.value;
    }
    return v;
  }
  const salva = () => { if (!form.dataset.fatto) scrivi({ v: valori(), passo: attivo, fino }); };
  function ripristina(v) {
    for (const el of form.elements) {
      if (!el.name || !(el.name in v) || NON.has(el.name)) continue;
      const x = String(v[el.name]);
      if (el.type === 'radio') el.checked = el.value === x;
      else if (el.tagName === 'SELECT') { if ([...el.options].some((o) => o.value === x)) el.value = x; } else if (el.type !== 'checkbox') el.value = x.slice(0, el.maxLength > 0 ? el.maxLength : 400);
    }
    // un radio senza valore ricordato resta com'era (i valori predefiniti dell'HTML)
  }

  /** Tutto ciò che dipende dalle scelte. */
  function aggiorna() {
    condizioni();
    for (const box of scelte) mostraScelta(box);
    if (quantita) tastiQuantita();
    prezzi();
    camicia();
    if (attivo === 'pagamento') riepilogo();
  }
  form.addEventListener('input', (e) => {
    if (e.target.closest('dialog')) return;
    aggiorna(); scopri(); riguarda(); salva();
    if (e.target.name === 'email') { e.target.closest('.misura').querySelector('.campo__forse')?.remove(); forseVisto = false; }
  });
  form.addEventListener('change', (e) => {
    if (e.target.closest('dialog')) return;
    // la provincia scritta per esteso diventa la sua sigla («Napoli» → «NA»)
    if (e.target.name === 'provincia') { const s = provincia(e.target.value); if (s && s !== e.target.value) e.target.value = s; }
    aggiorna(); scopri(); riguarda(); salva();
  });
  // Invio in una casella non fa «Continua» (sul telefono lo si preme per chiudere la tastiera, e ci si ritrovava al
  // passo dopo o con tutti gli avvisi accesi): porta alla prossima casella vuota del passo, dall'ultima chiude la tastiera
  const CASELLE = ['text', 'tel', 'email'];
  const caselle = (passo) => [...(sezioni[passo]?.querySelectorAll('input') || [])].filter((x) => CASELLE.includes(x.type));
  for (const p of PASSI) caselle(p).forEach((x, i, tutte) => x.setAttribute('enterkeyhint', p !== 'camicia' && i < tutte.length - 1 ? 'next' : 'done'));
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing || e.target.tagName !== 'INPUT' || !CASELLE.includes(e.target.type)) return;
    e.preventDefault();
    const tutte = caselle(attivo).filter((x) => visibile(x) && !x.disabled);
    const dopo = attivo === 'camicia' ? null : tutte.slice(tutte.indexOf(e.target) + 1).find((x) => !x.value.trim());
    if (dopo) dopo.focus(); else e.target.blur();
  });

  // ------------------------------------------------------------------ i passi
  const indice = (id) => PASSI.indexOf(id);
  const testata = () => document.querySelector('[data-testata]')?.getBoundingClientRect().bottom || 0;
  /** Porta in vista e dà il fuoco a un campo (o al suo primo radio), sopra il fondo con i tasti. */
  function vaiAlCampo(nome) {
    const el = campoDi(nome);
    if (!el) return;
    const bersaglio = el.matches('fieldset') ? (el.querySelector('input:checked') || el.querySelector('input')) : el;
    const blocco = el.closest('.voce, .misura, .consenso__riga') || el;
    bersaglio?.focus({ preventScroll: true });
    const r = blocco.getBoundingClientRect();
    const su = Math.max(testata(), 0) + 16;
    const giu = (fondo?.getBoundingClientRect().top || innerHeight) - 12;
    if (r.top < su) scorri(r.top - su);
    else if (r.bottom > giu) scorri(Math.min(r.bottom - giu, r.top - su));
  }
  /** Gli avvisi di un passo; vero se il passo va bene. Con `fuoco` porta al primo campo sbagliato. */
  function controllaPasso(passo, { fuoco = true } = {}) {
    const e = errori(passo);
    let primo = '';
    for (const el of campiDi(passo)) {
      const nome = el.dataset.campo;
      segna(nome, visibile(el) ? (e[nome] || '') : '');
      if (!primo && e[nome] && visibile(el)) primo = nome;
    }
    if (primo && fuoco) vaiAlCampo(primo);
    return !primo;
  }

  function mostraTappe() {
    const i = indice(attivo);
    conta.textContent = conta.dataset.testo.replace('{n}', i + 1).replace('{tot}', PASSI.length);
    tappe.forEach((a, k) => {
      if (k === i) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
      a.classList.toggle('tappe__tasto--fatto', k < i || (k <= fino && k !== i));
      if (k > fino) { a.setAttribute('aria-disabled', 'true'); a.tabIndex = -1; } else { a.removeAttribute('aria-disabled'); a.removeAttribute('tabindex'); }
    });
    indietro.hidden = i === 0;
    const ultimo = i === PASSI.length - 1;
    avanti.textContent = ultimo ? avanti.dataset.paga : avanti.dataset.continua;
    form.classList.toggle('configura__scheda--ultimo', ultimo);
  }

  /** Il riquadro dall'inizio: «Passo n di 5» in vista sotto la testata (`subito`: in un colpo). */
  function inCima(subito = false) {
    const r = form.getBoundingClientRect();
    const su = Math.max(testata(), 0) + 12;
    if (r.top < su || r.top > innerHeight * 0.6) scorri(r.top - su - 4, subito);
  }
  /** Apre un passo. `porta`: la pagina scorre fino al riquadro e il fuoco va al titolo del passo. `storia`: il passo
   *  entra nella cronologia del browser, così il tasto Indietro torna al passo di prima e non alla pagina di prima. */
  function vai(id, { porta = true, storia = true } = {}) {
    if (!sezioni[id]) return;
    const prima = attivo;
    attivo = id;
    fino = Math.max(fino, indice(id));
    for (const [k, s] of Object.entries(sezioni)) {
      const si = k === id;
      if (s.hidden === !si) continue;
      s.hidden = !si;
      if (si && prima !== id && !ridotto.matches) {
        s.classList.remove('passo--entra');
        void s.offsetWidth;
        s.classList.add('passo--entra', indice(id) < indice(prima) ? 'passo--da-sinistra' : 'passo--da-destra');
        s.addEventListener('animationend', () => s.classList.remove('passo--entra', 'passo--da-sinistra', 'passo--da-destra'), { once: true });
      }
    }
    if (esito) esito.textContent = '';
    mostraTappe();
    if (id === 'spedizione') destinatario();
    if (id === 'pagamento') { riepilogo(); antispam(); }
    aggiorna();
    salva();
    scoperti = [];
    // la finestra «Come prendere le misure» si apre la prima volta che si entra nel passo
    const saluta = id === 'misure' && !misureViste;
    if (porta) {
      // Con la finestra che sta per aprirsi la pagina si sposta in un colpo: la finestra ferma lo scorrimento morbido
      // appena partito, e chiusa la finestra il riquadro restava fuori dallo schermo (revisione del 2026-11-26)
      inCima(saluta);
      sezioni[id].querySelector('.passo__titolo')?.focus({ preventScroll: true });
    }
    if (storia && prima !== id) voce({ passo: id });
    if (saluta) { misureViste = true; salutare = apriPassi(); if (porta) salutare.then(() => inCima()); }
  }
  addEventListener('popstate', (e) => {
    if (form.dataset.fatto) return;
    const p = e.state?.passo;
    if (!PASSI.includes(p) || p === attivo) return;
    // con Avanti del browser, come dai nomi in cima: ci si ferma al primo passo che non va
    const fermo = PASSI.slice(indice(attivo), indice(p)).find((x) => Object.keys(errori(x)).length);
    if (fermo) { if (fermo !== attivo) vai(fermo, { storia: false }); controllaPasso(fermo); return; }
    vai(p, { storia: false });
  });

  /** Va a un passo più avanti passando da quelli di mezzo: si ferma al primo che non va. */
  function vaiFinoA(id) {
    for (let k = indice(attivo); k < indice(id); k++) {
      // (si guarda ai dati, non ai campi in vista: di un passo chiuso non se ne vede nessuno)
      if (Object.keys(errori(PASSI[k])).length) {
        if (PASSI[k] !== attivo) vai(PASSI[k]);
        controllaPasso(PASSI[k]);
        return;
      }
    }
    vai(id);
  }

  function prossimo() {
    if (!controllaPasso(attivo)) return;
    // un'email con un probabile errore di battitura: la prima volta ci si ferma e si mostra «Forse intendevi…»
    if (attivo === 'dati' && !forseVisto && form.elements.email && suggerisciEmail(form.elements.email.value)) {
      forseVisto = true;
      forse(form.elements.email);
      vaiAlCampo('email');
      return;
    }
    vai(PASSI[indice(attivo) + 1]);
  }

  for (const a of tappe) {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (a.getAttribute('aria-disabled') === 'true') return;
      const id = a.dataset.vai;
      if (id === attivo) return;
      if (indice(id) < indice(attivo)) vai(id); else vaiFinoA(id);
    });
  }
  indietro.addEventListener('click', () => { const i = indice(attivo); if (i > 0) vai(PASSI[i - 1]); });
  form.addEventListener('click', (e) => {
    const m = e.target.closest('[data-modifica]');
    if (m) vai(m.dataset.modifica);
  });

  // «destinatario» si riempie da solo con il nome, se è vuoto
  function destinatario() {
    const chi = form.elements.destinatario;
    if (chi && !chi.value.trim() && form.elements.nome?.value.trim()) chi.value = form.elements.nome.value.trim();
  }
  form.elements.spedizione?.[0]?.closest('fieldset').addEventListener('change', destinatario);

  // ------------------------------------------------------------------ riepilogo
  const campi = Object.fromEntries(S.camicia.campi.flatMap((c) => [c, ...(c.se_si || [])]).map((c) => [c.nome, c]));
  const nomeOpzione = (nome, v) => campi[nome]?.opzioni?.find((o) => o.id === v)?.nome || v;
  const conTessuto = (v, t) => [v, campioni.get(t)?.nome].filter(Boolean).join(' · ');
  function riepilogo() {
    const d = dati();
    const P = Object.fromEntries(S.passi.map((p) => [p.id, p]));
    const V = S.pagamento.voci;
    const vuoto = S.pagamento.nessuno;
    // `giallo`: il valore può avere dei [[ ]] (non confermato dal proprietario), che in anteprima restano evidenziati
    const righe = (r) => r.map(([a, b, giallo]) => `<div class="riepilogo__riga"><dt>${esc(a)}</dt><dd>${b ? (giallo ? testo(b) : esc(b)) : esc(vuoto)}</dd></div>`).join('');
    const parte = (passo, titolo, dentro, classe = '') => `<section class="riepilogo__parte${classe}"><div class="riepilogo__testa"><h3 class="riepilogo__titolo">${esc(titolo)}</h3><button class="riepilogo__modifica" type="button" data-modifica="${passo}" aria-label="${esc(`${S.modifica}: ${titolo}`)}">${esc(S.modifica)}</button></div><dl class="riepilogo__righe">${dentro}</dl></section>`;
    const camiciaRighe = [
      [campi.quantita.etichetta, d.quantita],
      [campi.tessuto.etichetta, campioni.get(d.tessuto)?.nome],
      [campi.collo.etichetta, nomeOpzione('collo', d.collo)],
      [campi.taschino.etichetta, d.taschino === 'si' ? conTessuto(S.si, d.taschino_tessuto) : S.no],
      [campi.asola.etichetta, d.asola === 'si' ? [S.si, tinte.get(d.asola_colore)?.nome].filter(Boolean).join(' · ') : S.no],
      [campi.bottone.etichetta, nomeOpzione('bottone', d.bottone)],
      [campi.filato_bottone.etichetta, tinte.get(d.filato_bottone)?.nome || ''],
      [campi.iniziali.etichetta, d.iniziali === 'si' ? [maiuscole(d.iniziali_lettere || ''), nomeOpzione('iniziali_posizione', d.iniziali_posizione)].filter(Boolean).join(' · ') : S.no],
      ...['interno_collo', 'interno_polso', 'polsino'].map((n) => [campi[n].etichetta, d[n] === 'personalizzato' ? conTessuto(S.personalizzato, d[`${n}_tessuto`]) : S.standard]),
    ];
    const misure = S.misure.campi.map((m) => [m.etichetta, d[m.nome] ? `${d[m.nome].trim().replace('.', ',')} ${m.unita}` : '']);
    const modo = S.spedizione.opzioni.find((o) => o.id === d.spedizione);
    const sped = modo ? [[modo.nome, modo.dettaglio, true]] : [[P.spedizione.nome, '']];
    if (modo && (modo.prezzo > 0 || modo.giorni)) {
      const via = [d.indirizzo, [d.cap, d.citta, d.provincia && `(${provincia(d.provincia) || d.provincia.toUpperCase()})`].filter(Boolean).join(' ')].filter((x) => x && x.trim()).join(', ');
      const I = Object.fromEntries(S.spedizione.indirizzo.campi.map((c) => [c.nome, c.etichetta]));
      sped.push([I.destinatario, d.destinatario], [S.spedizione.indirizzo.titolo, via]);
      if (d.note_consegna?.trim()) sped.push([I.note_consegna, d.note_consegna]);
    }
    const D = Object.fromEntries(S.dati.campi.map((c) => [c.nome, c.etichetta]));
    const box = form.querySelector('[data-riepilogo]');
    const html = `<h3 class="nascosto">${esc(S.pagamento.riepilogo)}</h3>`
      + parte('camicia', V.camicia, righe(camiciaRighe))
      + parte('misure', V.misure, righe(misure), ' riepilogo__parte--misure')
      + parte('dati', V.dati, righe([[D.nome, d.nome], [D.telefono, d.telefono], [D.email, d.email]]))
      + parte('spedizione', V.spedizione, righe(sped));
    if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
    const c = conti(d);
    const scrivi1 = (sel, v) => { const el = form.querySelector(sel); if (el.textContent !== v) el.textContent = v; };
    scrivi1('[data-conti-camicia]', euro(c.camicia));
    scrivi1('[data-conti-quantita]', String(c.quantita));
    scrivi1('[data-conti-consegna]', modo && !(modo.prezzo > 0 || modo.giorni) ? S.prezzi.ritiro : S.prezzi.spedizione);
    scrivi1('[data-conti-spedizione]', c.spedizione === null ? vuoto : c.spedizione === 0 ? S.spedizione.gratis : euro(c.spedizione));
    scrivi1('[data-conti-totale]', euro(c.totale));
    form.querySelector('[data-conti]').hidden = false;
  }

  // ------------------------------------------------------------------ antispam e invio
  let turnstileCaricato = false;
  function antispam() {
    if (turnstileCaricato || !form.querySelector('.cf-turnstile')) return;
    turnstileCaricato = true;
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    document.head.appendChild(s);
  }
  form.elements.privacy?.addEventListener('change', () => {
    if (form.elements.privacy.hasAttribute('aria-invalid')) segna('privacy', form.elements.privacy.checked ? '' : S.errori.privacy);
    if (form.elements.privacy.checked && esito.textContent === piano(S.errori.riepilogo)) esito.textContent = '';
  });

  /** L'esito sta in fondo al passo, la barra con il tasto è sempre in vista: lo si porta sopra la barra, altrimenti
   *  il tasto sembra non fare nulla (revisione del 2026-11-26). */
  function mostraEsito(frase) {
    esito.innerHTML = testo(frase);
    if (!frase) return;
    requestAnimationFrame(() => {
      const r = esito.getBoundingClientRect();
      const su = Math.max(testata(), 0) + 16, giu = (fondo?.getBoundingClientRect().top || innerHeight) - 12;
      if (r.bottom > giu) scorri(r.bottom - giu); else if (r.top < su) scorri(r.top - su);
    });
  }
  let inviando = false;
  let partito = false;           // la pagina del pagamento si sta aprendo
  // tornando dal pagamento con il tasto Indietro del browser (la pagina riappare com'era), il tasto si riaccende
  addEventListener('pageshow', (e) => {
    if (!e.persisted || !partito) return;
    partito = false; inviando = false;
    avanti.disabled = false;
    avanti.textContent = avanti.dataset.paga;
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (attivo !== 'pagamento') { prossimo(); return; }
    if (inviando) return;
    // tutti i passi: il primo che non va si riapre con gli avvisi
    const sbagliato = PASSI.find((p) => Object.keys(errori(p)).length);
    if (sbagliato && sbagliato !== 'pagamento') { vai(sbagliato); controllaPasso(sbagliato); return; }
    if (!controllaPasso('pagamento')) { mostraEsito(S.errori.riepilogo); return; }
    const testoTasto = avanti.textContent;
    inviando = true;
    avanti.disabled = true;
    avanti.textContent = avanti.dataset.attesa;
    esito.textContent = '';
    try {
      // l'antispam di Cloudflare dà il suo gettone qualche secondo dopo: lo si aspetta un poco
      if (form.querySelector('.cf-turnstile')) {
        for (let i = 0; i < 40 && !form.elements['cf-turnstile-response']?.value; i++) await new Promise((fatto) => setTimeout(fatto, 200));
        if (!form.elements['cf-turnstile-response']?.value) { mostraEsito(avvisi.antispam); return; }
      }
      const r = await fetch(form.getAttribute('action') || '/api/ordine', { method: 'POST', body: JSON.stringify(dati()), headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });
      const risposta = await r.json().catch(() => ({}));
      // (solo la pagina di pagamento di Stripe, o un indirizzo di questo sito)
      if (r.ok && risposta.ok && typeof risposta.vai === 'string' && /^(https:\/\/checkout\.stripe\.com\/|\/(?!\/))/.test(risposta.vai)) { partito = true; location.assign(risposta.vai); return; }
      if ((r.ok && risposta.ok && risposta.pagamento === 'non_attivo') || r.status === 503) { mostraEsito(S.pagamento.non_attivo); return; }
      if (risposta.errori && typeof risposta.errori === 'object' && Object.keys(risposta.errori).length) {
        // il Worker dice quali campi non vanno: si torna al passo del primo, con l'avviso sotto
        const nomi = Object.keys(risposta.errori).filter((n) => campoDi(n));
        const primo = nomi.sort((a, b) => indice(passoDi(campoDi(a))) - indice(passoDi(campoDi(b))))[0];
        if (primo) {
          const passo = passoDi(campoDi(primo));
          if (passo !== attivo) vai(passo);
          for (const n of nomi) segna(n, String(risposta.errori[n]));
          vaiAlCampo(primo);
          if (passo === 'pagamento') mostraEsito(S.errori.riepilogo);
        } else mostraEsito(S.pagamento.errore);
        return;
      }
      // un'altra frase del Worker (l'antispam, il modulo vuoto) si mostra com'è
      mostraEsito(typeof risposta.errore === 'string' && risposta.errore ? risposta.errore : S.pagamento.errore);
      // il gettone dell'antispam vale una volta sola
      if (r.status !== 422) globalThis.turnstile?.reset?.(form.querySelector('.cf-turnstile'));
    } catch {
      mostraEsito(S.pagamento.errore);
      globalThis.turnstile?.reset?.(form.querySelector('.cf-turnstile'));
    } finally {
      // mentre la pagina del pagamento si apre il tasto resta spento: ogni clic in più manderebbe un altro ordine
      if (!partito) {
        inviando = false;
        avanti.disabled = false;
        if (avanti.textContent === avanti.dataset.attesa) avanti.textContent = testoTasto;
      }
    }
  });

  // ------------------------------------------------------------------ finestre dei tessuti e dei colori
  for (const dlg of document.querySelectorAll('dialog [data-raccolta]')) raccolta(dlg.closest('dialog'), (box, v) => {
    const input = box.querySelector('[data-valore]');
    if (input.value === v) return;
    input.value = v;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  for (const box of scelte) {
    box.querySelector('.scegli__tasto').addEventListener('click', () => {
      const dlg = document.getElementById(box.dataset.scegli === 'tessuto' ? 'finestra-tessuti' : 'finestra-colori');
      dlg?.apri?.(box);
    });
  }

  // ------------------------------------------------------------------ avvio
  const ricordato = leggi();
  const esitoOrdine = cerca.get('ordine');
  if (esitoOrdine === 'fatto') {
    // tornando da Stripe con il pagamento fatto: un grazie breve, e si dimentica ciò che era ricordato
    scrivi(null);
    form.dataset.fatto = '1';
    form.classList.add('configura__scheda--grazie');
    form.querySelector('[data-passi]').hidden = true;
    form.querySelector('.tappe').hidden = true;
    fondo.hidden = true;
    form.querySelector('[data-grazie]').hidden = false;
    pulisciIndirizzo();
    aggiorna();
    camicia(true);
    return Promise.resolve();
  }
  if (ricordato?.v) ripristina(ricordato.v);
  fino = Math.min(PASSI.length - 1, Math.max(0, Number(ricordato?.fino) || 0));
  let primo = PASSI.includes(cerca.get('passo')) ? cerca.get('passo') : PASSI.includes(ricordato?.passo) ? ricordato.passo : PASSI[0];
  if (esitoOrdine === 'annullato') {
    // tornando da Stripe senza pagare: di nuovo il riepilogo, con i dati rimasti (se mancano, il primo passo da finire)
    primo = PASSI.find((p) => p !== 'pagamento' && Object.keys(errori(p)).length) || 'pagamento';
  }
  for (const s of Object.values(sezioni)) s.hidden = true;
  form.classList.add('configura__scheda--a-passi');
  aggiorna();
  // (il primo passo nella cronologia, prima di aprirlo: se è Misure, la finestra che si apre aggiunge la sua voce)
  try { history.replaceState({ passo: primo }, ''); } catch { /* si va avanti senza */ }
  vai(primo, { porta: false, storia: false });
  if (esitoOrdine === 'annullato' && primo === 'pagamento') mostraEsito(S.pagamento.annullato);
  pulisciIndirizzo();
  // la camicia com'è stata scelta (anche dopo una ricarica): vesti.js ascolta da subito
  queueMicrotask(() => camicia(true));
  return salutare;

  /** Toglie ?ordine= dall'indirizzo: ricaricando non si rifà il grazie né l'avviso. */
  function pulisciIndirizzo() {
    if (!cerca.has('ordine')) return;
    cerca.delete('ordine');
    const q = cerca.toString();
    history.replaceState(history.state, '', location.pathname + (q ? `?${q}` : '') + location.hash);
  }
}

/**
 * Una finestra di scelta (tessuti o colori): una griglia di campioni (role listbox), un clic sceglie e si vede subito,
 * il tasto in fondo conferma (o il doppio clic, o Invio). Frecce, Inizio e Fine si muovono nella griglia, Esc chiude
 * senza cambiare nulla e il fuoco torna al tasto che l'ha aperta. I tessuti hanno anche i filtri e la ricerca.
 * `dlg.apri(box)` la apre per il campo `box` ([data-scegli]); `scegli(box, id)` scrive la scelta nel campo.
 */
function raccolta(dlg, scegli) {
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const griglia = dlg.querySelector('[data-griglia]');
  const voci = [...griglia.querySelectorAll('[role="option"]')];
  // per la ricerca: il nome e il tipo, minuscoli e senza accenti (i nomi dei tipi stanno nei filtri)
  // (anche le parole dei filtri: chi legge «Tinta unita» o «Azzurri» sulle pillole e lo scrive, li trova)
  const nomi = (campo) => Object.fromEntries([...dlg.querySelectorAll(`input[name="${campo}"]`)].filter((r) => r.value).map((r) => [r.value, r.nextElementSibling.textContent]));
  const tipi = nomi('tipo'), colori = nomi('colore'), disegni = nomi('disegno');
  for (const v of voci) v.dataset.cerca = perCercare(`${v.querySelector('img')?.alt || ''} ${tipi[v.dataset.tipo] || ''} ${colori[v.dataset.colore] || ''} ${disegni[v.dataset.disegno] || ''}`);
  const scorre = dlg.querySelector('.raccolta__scorre');
  const per = dlg.querySelector('[data-per]');
  const scelto = dlg.querySelector('[data-scelto]');
  const conferma = dlg.querySelector('[data-conferma]');
  const ricerca = dlg.querySelector('[data-cerca]');
  const filtri = dlg.querySelector('[data-filtri]');
  const contaEl = dlg.querySelector('[data-conta]');
  const nessuno = dlg.querySelector('[data-nessuno]');
  const azzera = dlg.querySelector('[data-azzera]');
  const mostraFiltri = dlg.querySelector('[data-mostra-filtri]');
  const quantiFiltri = dlg.querySelector('[data-quanti-filtri]');
  let box = null, apertoDa = null, scelta = '';
  let apertaIl = 0, ultimoBox = null, giuSulFondo = false, clic = [null, null];
  // Un doppio clic sul tasto che apre la finestra: il secondo clic cade su un campione (o sul fondo scuro) appena
  // comparso sotto il puntatore, e sceglieva un tessuto a caso (o richiudeva la finestra). Per un attimo non conta
  const appena = () => performance.now() - apertaIl < 350;

  const nome = (el) => el.querySelector('.campione__nome, .tinta__nome')?.textContent || '';
  const inVista = () => voci.filter((v) => !v.hidden);
  function seleziona(el, { fuoco = false } = {}) {
    scelta = el ? el.dataset.id : '';
    for (const v of voci) {
      const si = v === el;
      v.setAttribute('aria-selected', String(si));
    }
    scelto.textContent = el ? nome(el) : scelto.dataset.vuoto;
    scelto.classList.toggle('raccolta__scelto--fatto', !!el);
    conferma.disabled = !el;
    if (el) attiva(el, fuoco);
  }
  /** Il campione che riceve il fuoco con Tab (uno solo: gli altri si raggiungono con le frecce). */
  function attiva(el, fuoco = true) {
    for (const v of voci) v.tabIndex = v === el ? 0 : -1;
    if (fuoco) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest' }); }
  }
  function primoAttivo() {
    const vis = inVista();
    const el = vis.find((v) => v.dataset.id === scelta) || vis[0];
    for (const v of voci) v.tabIndex = v === el ? 0 : -1;
    return el;
  }

  // filtri e ricerca (solo i tessuti)
  const stato = { tipo: '', colore: '', disegno: '', testo: '' };
  function applica() {
    let n = 0;
    const parole = stato.testo.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    for (const v of voci) {
      const si = (!stato.tipo || v.dataset.tipo === stato.tipo) && (!stato.colore || v.dataset.colore === stato.colore)
        && (!stato.disegno || v.dataset.disegno === stato.disegno) && parole.every((p) => v.dataset.cerca.includes(p));
      if (v.hidden === si) v.hidden = !si;
      if (si) n++;
    }
    if (contaEl) contaEl.textContent = n === 1 ? contaEl.dataset.uno : contaEl.dataset.molti.replace('{n}', n.toLocaleString('it-IT'));
    if (nessuno) nessuno.hidden = n > 0;
    const quanti = ['tipo', 'colore', 'disegno'].filter((k) => stato[k]).length;
    if (azzera) azzera.hidden = !quanti && !stato.testo;
    if (quantiFiltri) { quantiFiltri.hidden = !quanti; quantiFiltri.textContent = quanti ? String(quanti) : ''; }
    primoAttivo();
  }
  // (dopo un filtro o una ricerca l'elenco riparte dall'inizio)
  filtri?.addEventListener('change', (e) => { if (e.target.name in stato) { stato[e.target.name] = e.target.value; applica(); if (scorre) scorre.scrollTop = 0; } });
  // Invio su un filtro non chiude la finestra (il primo tasto del modulo è «Chiudi»)
  filtri?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input')) e.preventDefault(); });
  ricerca?.addEventListener('input', () => { stato.testo = perCercare(ricerca.value); applica(); if (scorre) scorre.scrollTop = 0; });
  ricerca?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      const el = primoAttivo();
      if (el) attiva(el);
    }
  });
  function azzeraTutto() {
    Object.assign(stato, { tipo: '', colore: '', disegno: '', testo: '' });
    if (ricerca) ricerca.value = '';
    for (const r of filtri?.querySelectorAll('input[value=""]') || []) r.checked = true;
  }
  azzera?.addEventListener('click', () => {
    azzeraTutto();
    applica();
    if (scorre) scorre.scrollTop = 0;
    ricerca?.focus();
  });
  mostraFiltri?.addEventListener('click', () => {
    const aperti = mostraFiltri.getAttribute('aria-expanded') !== 'true';
    mostraFiltri.setAttribute('aria-expanded', String(aperti));
    dlg.classList.toggle('finestra--filtri-aperti', aperti);
  });

  // clic, doppio clic, tastiera
  griglia.addEventListener('click', (e) => { const el = e.target.closest('[role="option"]'); if (!el || appena()) return; clic = [clic[1], el]; seleziona(el, { fuoco: true }); });
  // (il doppio clic conferma solo se tutti e due i clic erano sullo stesso campione)
  griglia.addEventListener('dblclick', (e) => { const el = e.target.closest('[role="option"]'); if (el && !appena() && clic[0] === el && clic[1] === el) { seleziona(el); fatto(); } });
  griglia.addEventListener('keydown', (e) => {
    const el = e.target.closest('[role="option"]');
    if (!el) return;
    const vis = inVista();
    const i = vis.indexOf(el);
    // quante colonne ha la griglia: i campioni sulla stessa riga del primo
    const colonne = Math.max(1, vis.filter((v) => v.offsetTop === vis[0].offsetTop).length);
    let k = -1;
    if (e.key === 'ArrowRight') k = Math.min(vis.length - 1, i + 1);
    else if (e.key === 'ArrowLeft') k = Math.max(0, i - 1);
    else if (e.key === 'ArrowDown') k = Math.min(vis.length - 1, i + colonne);
    else if (e.key === 'ArrowUp') k = i - colonne >= 0 ? i - colonne : (ricerca ? -2 : 0);
    else if (e.key === 'Home') k = 0;
    else if (e.key === 'End') k = vis.length - 1;
    else if (e.key === 'Enter') { e.preventDefault(); seleziona(el); fatto(); return; }
    else if (e.key === ' ') { e.preventDefault(); seleziona(el, { fuoco: true }); return; }
    else return;
    e.preventDefault();
    if (k === -2) { ricerca.focus(); return; }
    attiva(vis[k]);
  });
  conferma.addEventListener('click', fatto);
  function fatto() {
    if (!scelta || !box) return;
    const b = box;
    dlg.close('scelto');
    scegli(b, scelta);
  }
  dlg.addEventListener('close', () => {
    blocca(false);
    // la voce di cronologia aggiunta aprendo si toglie (se la finestra non l'ha già chiusa il tasto Indietro)
    finestraChiusa();
    const da = apertoDa;
    box = null; apertoDa = null;
    // il fuoco torna al tasto che l'ha aperta
    if (da?.isConnected) da.focus({ preventScroll: true });
  });
  // un clic sul fondo scuro, fuori dal vetro, chiude come Esc (non un trascinamento cominciato dentro il vetro, come
  // quando si seleziona il testo della ricerca)
  dlg.addEventListener('pointerdown', (e) => { giuSulFondo = e.target === dlg; });
  dlg.addEventListener('click', (e) => { if (e.target === dlg && giuSulFondo && !appena()) dlg.close(); });
  // il tasto Indietro del browser (il gesto, sul telefono) chiude la finestra, non lascia la pagina
  addEventListener('popstate', () => { if (dlg.open && voceFinestraTolta()) dlg.close(); });

  dlg.apri = (b) => {
    box = b;
    apertoDa = b.querySelector('.scegli__tasto');
    per.textContent = b.dataset.per || '';
    // per un altro campo si riparte da tutti i tessuti: i filtri rimasti accesi ne lasciavano vedere tre
    if (ultimoBox && ultimoBox !== b) azzeraTutto();
    ultimoBox = b;
    if (ricerca && ricerca.value) { ricerca.value = ''; stato.testo = ''; }
    if (ricerca) applica();
    const v = b.querySelector('[data-valore]').value;
    seleziona(voci.find((x) => x.dataset.id === v) || null);
    dlg.showModal();
    apertaIl = performance.now(); clic = [null, null]; giuSulFondo = false;
    finestraAperta();
    blocca(true);
    const el = primoAttivo();
    // il campione scelto in vista; il fuoco sulla griglia (non sulla ricerca: sul telefono aprirebbe la tastiera)
    if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'center' }); } else (ricerca || conferma).focus();
  };
}
