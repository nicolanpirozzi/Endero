// Sezioni del sito, condivise tra la pagina iniziale e le altre pagine.
// Ordine e proporzioni vengono dal riferimento (docs/direzione-creativa.md, punti 1 e 3).
import { esc, t, tConLink, piano, attesa, foto, fotoIntera, fotoGrande, logo, icona, euro, indirizzoCapo, indirizzoCategoria } from './base.mjs';

const aid = (id) => (id ? ` id="${esc(id)}"` : '');
const agr = (gruppo) => (gruppo ? ` data-gruppo="${esc(gruppo)}"` : '');

export function intesta({ titolo, testo, link, occhiello, classe = '' }) {
  return `<header class="intesta ${classe}">
      ${occhiello ? `<p class="occhiello">${t(occhiello)}</p>` : ''}
      <h2 class="titolo">${t(titolo)}</h2>
      ${testo ? `<p class="testo">${t(testo)}</p>` : ''}
      ${link ? `<a class="collegamento" href="${esc(link.href)}">${esc(link.testo)}${icona.freccia}</a>` : ''}
    </header>`;
}

/** In cima alle pagine interne: foto (o video) con il titolo della pagina, come il video della pagina iniziale. */
export function eroePagina({ titolo, sottotitolo, occhiello, foto: nota, immagine }, sito, { archivio = sito.foto?.artigianato } = {}) {
  // la foto vera, se c'è (è la prima cosa che si vede: si carica subito), altrimenti il segnaposto
  const fondo = foto(immagine, archivio, { pigra: false }) || attesa({ nota, tono: 'scuro', etichetta: sito.foto_in_arrivo });
  return `<section class="eroe eroe--pagina${immagine ? ' eroe--foto' : ''}" id="contenuto" tabindex="-1">
    <div class="eroe__fondo">${fondo}</div>
    <div class="eroe__testo">
      ${occhiello ? `<p class="occhiello">${t(occhiello)}</p>` : ''}
      <h1 class="titolo eroe__titolo"><span>${t(titolo)}</span></h1>
      ${sottotitolo ? `<p class="eroe__sotto">${t(sottotitolo)}</p>` : ''}
    </div>
  </section>`;
}

// 3 · Nastro di fatti che scorre. La seconda copia serve solo a chiudere il giro e non si legge due volte.
export function nastro(voci) {
  const giro = (nascosto) => voci.map((v) => `<li${nascosto ? ' aria-hidden="true"' : ''}>${esc(v)}${logo('simbolo', { classe: 'nastro__punto' })}</li>`).join('');
  return `<section class="nastro" aria-label="Endero in breve">
    <ul class="nastro__binario">${giro(false)}${giro(true)}${giro(true)}</ul>
  </section>`;
}

/**
 * Il nastro dei fatti, fermo: stessa fascia e stesse parole, ma i fatti stanno in fila e uno di loro
 * può portare un link sotto (in Cultura e artigianato: "Diventa rivenditore" sotto "2.500 negozi serviti").
 */
export function nastroFermo(voci, richiamo) {
  return `<section class="nastro nastro--fermo" aria-label="Endero in breve">
    <ul class="nastro__fatti">
      ${voci.map((v) => `<li><span>${esc(v)}</span>${richiamo && v === richiamo.dopo ? `<a class="collegamento" href="${esc(richiamo.href)}">${esc(richiamo.testo)}${icona.freccia}</a>` : ''}</li>`).join('\n      ')}
    </ul>
  </section>`;
}

// 5–6 · Titolo e griglia di foto verticali.
export function suMisura(s, sito, { id = 'su-misura', gruppo = 'su-misura' } = {}) {
  return `<section class="sezione sezione--griglia"${aid(id)}${agr(gruppo)}>
    ${intesta(s)}
    <ul class="griglia">
      ${s.griglia.map((g) => `<li class="griglia__voce">
        ${fotoIntera(g.immagine, sito.foto?.['su-misura'], { sizes: '(max-width: 809px) 50vw, 17vw' }) || attesa({ nota: g.foto, etichetta: sito.foto_in_arrivo })}
        <span class="etichetta">${esc(g.etichetta)}</span>${g.nome || g.tessuto ? `
        <div class="vetro griglia__scheda">
          ${g.nome ? `<p class="griglia__nome">${t(g.nome)}</p>` : ''}
          ${g.tessuto ? `<p class="griglia__dettaglio">${t(g.tessuto)}</p>` : ''}
        </div>` : ''}
      </li>`).join('\n      ')}
    </ul>
  </section>`;
}

// 7 · Foto grande con scheda in vetro: la presa misure. La foto vera, quando c'è (p.immagine), sta con quelle della sede.
export function presaMisure(p, sito, { id = '', gruppo = 'su-misura', invito } = {}) {
  const s = p.scheda;
  const pillola = invito || { testo: s.invito, href: '#prenota' };
  return `<section class="sezione"${aid(id)}${agr(gruppo)}>
    ${intesta(p)}
    <div class="grande">
      ${foto(p.immagine, sito.foto?.sede, { sizes: '(max-width: 809px) 100vw, calc(100vw - 72px)' }) || attesa({ nota: p.foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}
      <div class="vetro scheda-misure" data-pillola-via>
        <div class="vetro__testa">
          <h3 class="vetro__titolo">${esc(s.titolo)}</h3>
          <span class="chip chip--vetro">cm</span>
        </div>
        <div class="scheda-misure__corpo">
          <div class="scheda-misure__gruppi">
            ${s.gruppi.map((g) => `<div>
              <h4 class="vetro__sezione">${esc(g.titolo)}</h4>
              <dl>${g.voci.map((v) => `<div><dt>${esc(v)}</dt><dd>${esc(s.unita)}</dd></div>`).join('')}</dl>
            </div>`).join('\n            ')}
          </div>
          <div class="scheda-misure__capo">${fotoIntera(s.immagine, sito.foto?.['su-misura'], { sizes: '150px' }) || attesa({ nota: s.foto, etichetta: sito.foto_in_arrivo })}</div>
        </div>
        <a class="pillola pillola--chiara" href="${esc(pillola.href)}">${esc(pillola.testo)}</a>
      </div>
    </div>
  </section>`;
}

/**
 * La porta sul su misura in pagina iniziale: la camicia appesa del configuratore, ferma, e sul lato in ombra della
 * parete la scheda in vetro con tutto ciò che il configuratore fa scegliere (proprietario, 2026-11-27: «che bello,
 * posso personalizzare così tanto la mia camicia!»; scelto «B · Riquadri»): quattro riquadri, tessuti con i
 * campioni veri, colli, iniziali nel corsivo del ricamo e misure, e sotto gli altri dettagli. Porta al configuratore
 * e, con un link più piccolo, alla prenotazione in sede.
 * @param {object} o.camicia gli indirizzi dell'immagine ferma: { computer, computer2x, telefono, telefono2x }
 * @param {object} o.scelte  i numeri contati dal build: { tessuti, colli, misure, dettagli: [etichette], campioni: [{ src, nome }] }
 */
export function portaSuMisura(p, sito, { id = 'su-misura', gruppo = 'su-misura', camicia, scelte = {}, alt = '', invito } = {}) {
  const serie = (file, largo, doppio) => `${file} ${largo}w` + (doppio ? `, ${doppio} ${largo * 2}w` : '');
  const s = p.scelte;
  // un riquadro, in quattro righe allineate con quelle del riquadro accanto (subgrid): l'ornamento, in grande il
  // numero (o il ricamo), il nome, una riga. Senza numero restano il nome e la riga
  const riquadro = (classe, { numero = '', prima = '', ornamento = '', grande = '', nome, dettaglio }) => `<li class="personalizza__riquadro personalizza__riquadro--${classe}">
            <span class="personalizza__ornamento" aria-hidden="true">${ornamento}</span>
            <span class="personalizza__grande">${grande}${numero ? `${prima ? `<span class="personalizza__prima">${esc(prima)}</span> ` : ''}<span class="personalizza__numero">${numero}</span>` : ''}</span>
            <span class="personalizza__nome">${esc(nome)}</span>
            <span class="personalizza__dettaglio">${esc(dettaglio)}</span>
          </li>`;
  // il colletto disegnato a filo, per il riquadro dei colli
  const colletto = '<svg viewBox="0 0 40 28" width="40" height="28" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5c2-2.2 12-2.2 14 0"/><path d="M13 5c1 3.4 3.6 6.4 7 8"/><path d="M27 5c-1 3.4-3.6 6.4-7 8"/><path d="M13 5 8 21l12-8"/><path d="M27 5l5 16-12-8"/><path d="M20 13v14"/><circle cx="20" cy="18" r=".9" fill="currentColor" stroke="none"/><circle cx="20" cy="24" r=".9" fill="currentColor" stroke="none"/></svg>';
  const campioni = (scelte.campioni || []).map(({ src, nome }) => `<img src="${esc(src)}" alt="${esc(nome)}" width="26" height="26" loading="lazy" decoding="async">`).join('');
  return `<section class="sezione"${aid(id)}${agr(gruppo)}>
    ${intesta(p)}
    <div class="grande grande--camicia">
      <picture class="grande__foto">
        <source media="(max-width: 809px)" srcset="${esc(serie(camicia.telefono, 750, camicia.telefono2x))}" sizes="100vw" width="750" height="1000">
        <img src="${esc(camicia.computer)}" srcset="${esc(serie(camicia.computer, 1800, camicia.computer2x))}" sizes="(max-width: 809px) 100vw, calc(100vw - 72px)" width="1800" height="1000" alt="${esc(alt)}" loading="lazy" decoding="async">
      </picture>
      <div class="vetro scheda-misure scheda-misure--camicia personalizza" data-pillola-via>
        <h3 class="vetro__titolo">${esc(s.titolo)}</h3>
        <ul class="personalizza__griglia">
          ${riquadro('tessuti', { numero: scelte.tessuti >= 20 ? scelte.tessuti : '', prima: s.tessuti.prima, nome: s.tessuti.nome, dettaglio: s.tessuti.dettaglio,
            ornamento: campioni ? `<span class="personalizza__campioni">${campioni}</span>` : '' })}
          ${riquadro('colli', { numero: scelte.colli || '', nome: s.colli.nome, dettaglio: s.colli.dettaglio, ornamento: colletto })}
          ${riquadro('iniziali', { grande: `<span class="personalizza__ricamo" aria-hidden="true">${esc(s.iniziali.esempio)}</span>`, nome: s.iniziali.nome, dettaglio: s.iniziali.dettaglio })}
          ${riquadro('misure', { numero: scelte.misure || '', nome: s.misure.nome, dettaglio: s.misure.dettaglio, ornamento: '<span class="personalizza__metro"></span>' })}
        </ul>
        ${scelte.dettagli?.length ? `<div class="personalizza__altri">
          <p class="vetro__sezione">${esc(s.dettagli)}</p>
          <ul class="personalizza__dettagli">${scelte.dettagli.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
        </div>` : ''}
        <div class="scheda-misure__azioni">
          <a class="pillola pillola--chiara" href="${esc(invito.href)}">${esc(invito.testo)}</a>
          ${p.in_sede ? `<a class="collegamento" href="${esc(p.in_sede.href)}">${esc(p.in_sede.testo)}${icona.freccia}</a>` : ''}
        </div>
      </div>
    </div>
  </section>`;
}

// 8 · Testo a sinistra, pannello con il modulo di prenotazione a destra.
export function comeFunziona(c, turnstile, { gruppo = 'su-misura', tipo = 'presa-misure', ancora = 'prenota' } = {}) {
  return `<section class="sezione funziona"${agr(gruppo)}>
    <div class="funziona__testo">
      <h2 class="titolo">${t(c.titolo)}</h2>
      <p class="testo">${t(c.testo)}</p>
      <ol class="passi">
        ${c.passi.map((p, i) => `<li><span class="passi__numero">${String(i + 1).padStart(2, '0')}</span><h3 class="passi__titolo">${esc(p.titolo)}</h3><p class="testo">${t(p.testo)}</p></li>`).join('\n        ')}
      </ol>
    </div>
    <div class="pannello" id="${esc(ancora)}">
      ${modulo(c.modulo, { tipo, turnstile })}
    </div>
  </section>`;
}

const TIPO_INPUT = { testo: 'text', telefono: 'tel', email: 'email' };
// i campi con un controllo (src/controlli.mjs, lo stesso elenco): la pagina li controlla mentre si compila, il Worker
// a ogni invio. Qui l'elenco è scritto a mano perché il build gira in Node, che non importa JSON senza dichiararlo.
const CONTROLLATI = ['nome', 'telefono', 'email', 'citta', 'nazione', 'partita_iva', 'profilo', 'messaggio', 'giorno'];
// come si scrivono: tastiera giusta sul telefono, niente maiuscole o correttore dove non servono
const SCRITTURA = {
  nome: ' autocapitalize="words" spellcheck="false"',
  telefono: ' inputmode="tel"',
  email: ' inputmode="email" autocapitalize="off" spellcheck="false"',
  citta: ' autocapitalize="words"',
  nazione: ' autocapitalize="words"',
  partita_iva: ' inputmode="text" autocapitalize="characters" spellcheck="false"',
  profilo: ' autocapitalize="off" spellcheck="false"',
};

/**
 * Un campo con la sua etichetta e, sotto, la riga dell'avviso (vuota finché il campo va bene: la riempie lo script,
 * e la legge chi usa un lettore di schermo). `controllo`: il nome del controllo, se il campo ne ha uno.
 */
function casella({ id, etichetta, largo = false, controllo = '', html }) {
  const errore = `${id}-errore`;
  const attributi = ` id="${id}" aria-describedby="${errore}"${controllo ? ` data-controllo="${controllo}"` : ''}${SCRITTURA[controllo] || ''}`;
  return `<div class="campo${largo ? ' campo--largo' : ''}"><label class="campo__nome" for="${id}">${etichetta}</label>${html(attributi)}<p class="campo__errore" id="${errore}" aria-live="polite"></p></div>`;
}

/**
 * Un campo descritto nei contenuti (modulo.campi): così i moduli nuovi non chiedono codice nuovo.
 * Tipi: testo, telefono, email, area, scelta-singola (pillole radio), scelta-multipla (pillole a caselle, almeno una
 * se obbligatoria: lo controllano lo script prima dell'invio e il Worker sempre).
 */
function campoDescritto(c, id) {
  const max = c.max ? ` maxlength="${Number(c.max)}"` : '';
  const auto = c.autocomplete ? ` autocomplete="${esc(c.autocomplete)}"` : '';
  const obbl = c.obbligatorio ? ' required' : '';
  if (c.tipo === 'scelta-multipla' || c.tipo === 'scelta-singola') {
    const multipla = c.tipo === 'scelta-multipla';
    const almeno = multipla && c.obbligatorio ? ` data-almeno-uno data-errore="${esc(c.errore || '')}"` : '';
    const errore = `${id}-errore`;
    return `<fieldset class="campo${c.largo ? ' campo--largo' : ''}"${almeno}${almeno ? ` aria-describedby="${errore}"` : ''}>
        <legend class="campo__nome">${esc(c.etichetta)}</legend>
        <div class="scelte">${c.opzioni.map((o) => `<label class="scelta"><input type="${multipla ? 'checkbox' : 'radio'}" name="${esc(c.nome)}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}</div>
        ${almeno ? `<p class="campo__errore" id="${errore}" aria-live="polite"></p>` : ''}
      </fieldset>`;
  }
  const controllo = CONTROLLATI.includes(c.nome) ? c.nome : '';
  if (c.tipo === 'area') {
    return casella({ id, etichetta: esc(c.etichetta), largo: c.largo, controllo, html: (a) => `<textarea name="${esc(c.nome)}" rows="4"${a}${max}${obbl}${c.aiuto ? ` placeholder="${esc(c.aiuto)}"` : ''}></textarea>` });
  }
  const tipo = TIPO_INPUT[c.tipo] || 'text';
  const valore = c.valore ? ` value="${esc(c.valore)}"` : '';
  return casella({ id, etichetta: esc(c.etichetta), largo: c.largo, controllo, html: (a) => `<input type="${tipo}" name="${esc(c.nome)}"${a}${auto}${max}${obbl}${valore}>` });
}

/**
 * Il modulo: prenotazione della presa misure (con giorno e fascia), messaggio semplice, oppure, se i contenuti
 * descrivono i campi (m.campi), quei campi. Funziona anche senza JavaScript: allora i controlli li fa il browser con
 * gli attributi dei campi, e sempre il Worker.
 */
export function modulo(m, { tipo = 'presa-misure', turnstile = '' } = {}) {
  const prenotazione = tipo === 'presa-misure';
  const testa = `<form class="modulo" action="/api/contatto" method="post" data-modulo${turnstile ? ' data-turnstile' : ''}>
    <div class="modulo__testa">
      <h3 class="modulo__titolo">${esc(m.titolo)}</h3>
      <div class="modulo__schede">${m.schede.map((s, i) => `<span class="chip${i === 0 ? ' chip--attivo' : ''}">${esc(s)}</span>`).join('')}</div>
    </div>
    <input type="hidden" name="tipo" value="${esc(tipo)}">
    <div class="modulo__esca" aria-hidden="true"><label>Non compilare<input type="text" name="sito_web" tabindex="-1" autocomplete="off"></label></div>`;
  const privacy = `${tipo}-privacy-errore`;
  const piede = `${turnstile ? `<div class="cf-turnstile" data-sitekey="${esc(turnstile)}" data-language="it" data-size="flexible"></div>` : ''}
    <div class="consenso__riga">
      <label class="consenso"><input type="checkbox" name="privacy" value="si" required aria-describedby="${privacy}"><span>${tConLink(m.privacy)}</span></label>
      <p class="campo__errore" id="${privacy}" aria-live="polite"></p>
    </div>
    <div class="modulo__piede">
      <button class="pillola pillola--blu pillola--grande" type="submit" data-testo-invio="${esc(m.invio)}">${esc(m.invia)}</button>
      <p class="modulo__esito" role="status" aria-live="polite" data-fatto="${esc(m.fatto_testo)}" data-errore="${esc(m.errore)}"></p>
    </div>
  </form>`;
  if (m.campi) {
    return `${testa}
    <div class="modulo__campi">
      ${m.campi.map((c) => campoDescritto(c, `${tipo}-${c.nome}`)).join('\n      ')}
    </div>
    ${piede}`;
  }
  const id = (nome) => `${tipo}-${nome}`;
  return `${testa}
    <div class="modulo__campi">
      ${casella({ id: id('nome'), etichetta: esc(m.nome), controllo: 'nome', html: (a) => `<input type="text" name="nome"${a} autocomplete="name" required maxlength="120">` })}
      ${casella({ id: id('telefono'), etichetta: esc(m.telefono), controllo: 'telefono', html: (a) => `<input type="tel" name="telefono"${a} autocomplete="tel" required maxlength="40">` })}
      ${casella({ id: id('email'), etichetta: esc(m.email), controllo: 'email', html: (a) => `<input type="email" name="email"${a} autocomplete="email" maxlength="160">` })}
      ${prenotazione ? `${casella({ id: id('giorno'), etichetta: esc(m.giorno), controllo: 'giorno', html: (a) => `<input type="date" name="giorno"${a} data-giorno>` })}
      <fieldset class="campo campo--largo">
        <legend class="campo__nome">${esc(m.fascia)}</legend>
        <div class="scelte">${m.fasce.map((f, i) => `<label class="scelta"><input type="radio" name="fascia" value="${esc(f)}"${i === m.fasce.length - 1 ? ' checked' : ''}><span>${esc(f)}</span></label>`).join('')}</div>
      </fieldset>` : ''}
      ${casella({ id: id('messaggio'), etichetta: esc(m.note), largo: true, controllo: 'messaggio', html: (a) => `<textarea name="messaggio"${a} rows="${prenotazione ? 3 : 5}" maxlength="2000" placeholder="${esc(m.note_aiuto)}"${prenotazione ? '' : ' required'}></textarea>` })}
    </div>
    ${piede}`;
}

// 9 · Tre riquadri: gli ingressi alla collezione.
export function collezione(c, sito, { id = 'collezione', gruppo = 'collezione' } = {}) {
  // senza titolo (in pagina iniziale, sotto la vetrina) è solo una fila di riquadri, non una sezione a sé
  const tag = c.titolo ? 'section' : 'div';
  return `<${tag} class="collezione${c.titolo ? '' : ' collezione--sola'}"${aid(id)}${agr(gruppo)}>
    ${c.titolo ? intesta(c) : ''}
    <ul class="riquadri">
      ${c.riquadri.map((r) => {
        // la foto vera, ritagliata in orizzontale dalla collezione; dove manca resta il segnaposto
        const vera = foto(r.immagine, sito.foto?.collezione, { sizes: '(max-width: 809px) 100vw, 34vw', verticale: false });
        return `<li><a class="riquadro${vera ? ' riquadro--foto' : ''}" href="${esc(r.href)}">
        ${vera || attesa({ nota: r.foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}
        <span class="titolo riquadro__titolo">${t(r.titolo)}</span>
      </a></li>`;
      }).join('\n      ')}
    </ul>
  </${tag}>`;
}

// 10 · Carosello: i capitoli della storia. Le citazioni dei clienti entreranno solo con recensioni vere.
export function storia(s, sito, { id = 'storia', gruppo = 'storia' } = {}) {
  return `<section class="sezione storia"${aid(id)}${agr(gruppo)}>
    ${intesta(s)}
    <div class="carosello" data-carosello>
      <ol class="carosello__binario">
        ${s.capitoli.map((c, i) => `<li class="carosello__voce" data-indice="${i}">
          ${attesa({ nota: c.foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}
          <div class="vetro carosello__scheda">
            <p class="carosello__etichetta">${esc(c.etichetta)}</p>
            <p class="carosello__testo">${t(c.testo)}</p>
          </div>
        </li>`).join('\n        ')}
      </ol>
      <button class="carosello__freccia carosello__freccia--prec" type="button" aria-label="${esc(s.precedente)}" hidden>${icona.sinistra}</button>
      <button class="carosello__freccia carosello__freccia--succ" type="button" aria-label="${esc(s.successivo)}" hidden>${icona.destra}</button>
    </div>
  </section>`;
}

// 11 · Domande frequenti: si aprono anche senza JavaScript.
export function domande(d, { gruppo = 'su-misura' } = {}) {
  return `<section class="sezione domande"${agr(gruppo)}>
    <h2 class="titolo">${t(d.titolo)}</h2>
    <div class="domande__elenco">
      ${d.voci.map((v) => `<details class="domanda">
        <summary><span>${t(v.domanda)}</span>${icona.giu}</summary>
        <div class="domanda__risposta"><p>${t(v.risposta)}</p>${v.link ? `<p><a class="collegamento" href="${esc(v.link.href)}">${esc(v.link.testo)}${icona.freccia}</a></p>` : ''}</div>
      </details>`).join('\n      ')}
    </div>
  </section>`;
}

// 12 · Prezzo: foto a sinistra, cifra e invito a destra.
export function prezzo(p, sito, { gruppo = 'su-misura' } = {}) {
  return `<section class="prezzo"${agr(gruppo)}>
    <div class="prezzo__foto">${foto(p.immagine, sito.foto?.sede, { sizes: '(max-width: 809px) 100vw, 65vw' }) || attesa({ nota: p.foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}</div>
    <div class="prezzo__testo">
      <div>
        <h2 class="titolo">${t(p.titolo)}</h2>
        <p class="testo">${t(p.testo)}</p>
      </div>
      <div class="prezzo__fondo">
        <p class="prezzo__da">${esc(p.a_partire)}</p>
        <p class="prezzo__cifra">${t(p.cifra)}</p>
        <a class="pillola pillola--blu pillola--grande" href="#prenota">${esc(p.invito)}</a>
      </div>
    </div>
  </section>`;
}

// ------------------------------------------------------------------ pezzi della struttura a più pagine (punto 10)

/**
 * Quanto è larga davvero una foto dentro un riquadro due per tre, in centesimi dello schermo: le foto meno alte
 * (quattro per cinque, quelle prese da Instagram) riempiono il riquadro in altezza e sporgono ai lati, quindi al
 * browser va chiesta una versione più larga del riquadro, o le sceglie troppo piccola e la ingrandisce.
 */
export function larga(k, archivio, riquadro) {
  const forma = archivio?.indice?.[k.file]?.forma || 2 / 3;
  return Math.round(riquadro * Math.max(1, forma / (2 / 3)));
}

/**
 * Ciò che lo script (src/sito.js, "lookbook") deve sapere di una foto per aprirla grande: nome, grandezze, forma, impronta.
 * Va sul link della foto, che senza script porta alla foto stessa o alla sua pagina.
 */
export function datiLook(k, archivio) {
  const g = archivio.indice[k.file];
  return `data-look="${esc(k.file)}" data-v="${g.v.join(',')}" data-webp="${(g.vWebp || g.v).join(',')}" data-forma="${g.forma}" data-versione="${esc(archivio.versioni?.[k.file] || '')}"`;
}

/** Ciò che serve una volta sola, sull'elemento che contiene le foto: dove stanno i file e cosa scrivere su WhatsApp. */
export function datiVisore(v, sito) {
  const archivio = sito.foto.collezione;
  return `data-cartella="${esc(archivio.cartella)}" data-messaggio="${esc(v.messaggio)}" data-whatsapp="${esc(sito.contatti.whatsapp_link)}"`;
}

/**
 * Il visore: la finestra a tutto schermo in cui si apre una foto della collezione, con le frecce, il numero,
 * e il tasto che chiede di quel capo su WhatsApp. È uno per pagina (collezione e pagina iniziale) e resta chiuso
 * finché lo script non lo apre: senza script non serve.
 */
export function visore(v, sito, quante) {
  return `<dialog class="visore" id="visore" aria-label="${esc(v.titolo)}" data-lenis-prevent>
      <p class="visore__conta" aria-live="polite" aria-atomic="true"><span class="nascosto">${esc(v.foto)} </span><span data-visore-numero>1</span> ${esc(v.di)} <span data-visore-quanti>${quante}</span><span class="visore__tipo" data-visore-tipo></span><span class="nascosto" data-visore-descrizione></span></p>
      <button type="button" class="visore__tasto visore__chiudi" data-visore-chiudi aria-label="${esc(v.chiudi)}">${icona.chiudi}</button>
      <figure class="visore__foto" data-visore-foto><picture><source type="image/avif" data-visore-avif><img data-visore-img alt="" decoding="async"></picture></figure>
      <button type="button" class="visore__tasto visore__freccia visore__freccia--prima" data-visore-prima aria-label="${esc(v.prima)}">${icona.sinistra}</button>
      <button type="button" class="visore__tasto visore__freccia visore__freccia--dopo" data-visore-dopo aria-label="${esc(v.dopo)}">${icona.destra}</button>
      <a class="pillola pillola--chiara pillola--grande visore__chiedi" data-visore-chiedi href="${esc(sito.contatti.whatsapp_link)}" target="_blank" rel="noopener">${esc(v.chiedi)}</a>
    </dialog>`;
}

/**
 * Vetrina: la griglia di foto a 6 colonne (2 sul telefono). Con i capi di prodotti.json ogni riquadro porta al capo
 * e al passaggio compare la scheda in vetro con nome, tessuto e prezzo. Finché i capi non hanno nome e prezzo si
 * vedono i look scelti in `v.look` tra quelli del lookbook (`look`, da collezione.json), con l'etichetta del tipo:
 * toccandone uno la foto si apre grande restando in pagina iniziale (proprietario, 2026-11-19: "diventa grande ma
 * resto sempre in home"); senza script il riquadro porta alla sua foto nella pagina della sua categoria (`categorie`:
 * quelle che hanno una pagina; così Google trova da qui anche Abiti e Felpe), o in quella della collezione.
 * Senza né capi né look, segnaposto.
 */
export function vetrina(v, prodotti, sito, { id = 'collezione', gruppo = 'collezione', look = [], tipi = [], categorie = {}, visore: testiVisore } = {}) {
  const quanti = v.quanti || 12;
  const capi = prodotti.slice(0, quanti);
  const voce = (capo) => {
    const foto = capo.foto?.[0]
      ? `<img src="${esc(capo.foto[0])}" alt="${esc(capo.nome)}" loading="lazy" decoding="async">`
      : attesa({ nota: capo.nome, etichetta: sito.foto_in_arrivo });
    const dettaglio = [capo.tessuto, capo.prezzo != null ? euro(capo.prezzo) : ''].filter(Boolean).map(esc).join(' · ');
    return `<li class="griglia__voce griglia__voce--capo"><a class="griglia__link" href="${esc(indirizzoCapo(capo))}">
        <span class="griglia__cornice">${foto}</span>
        ${capo.categoria ? `<span class="etichetta">${esc(capo.categoria)}</span>` : ''}
        <span class="vetro griglia__scheda">
          <span class="griglia__nome">${esc(capo.nome)}</span>
          ${dettaglio ? `<span class="griglia__dettaglio">${dettaglio}</span>` : ''}
        </span>
      </a></li>`;
  };
  const a = v.attesa;
  const inAttesa = () => `<li class="griglia__voce">
        ${attesa({ nota: a.foto, etichetta: sito.foto_in_arrivo })}
        <span class="etichetta">${t(a.categoria)}</span>
        <div class="vetro griglia__scheda">
          <p class="griglia__nome">${t(a.nome)}</p>
          <p class="griglia__dettaglio">${t(a.tessuto)} · ${t(a.prezzo)}</p>
        </div>
      </li>`;
  const sceltiTutti = (v.look || []).map((file) => look.find((k) => k.file === file)).filter(Boolean).slice(0, quanti);
  const nomeTipo = (idTipo) => tipi.find((x) => x.id === idTipo)?.nome || '';
  const archivio = sito.foto?.collezione;
  const paginaDelLook = (k) => (categorie?.[k.tipo] ? indirizzoCategoria(k.tipo) : v.tutti.href);
  const unLook = (k) => `<li class="griglia__voce griglia__voce--look"><a class="griglia__link" href="${esc(paginaDelLook(k))}#${esc(k.file)}" ${datiLook(k, archivio)} data-grande="${esc(fotoGrande(k, archivio))}" data-nome-tipo="${esc(nomeTipo(k.tipo))}">
        <span class="griglia__cornice">${fotoIntera(k, archivio, { sizes: `(max-width: 809px) ${larga(k, archivio, 50)}vw, ${larga(k, archivio, 17)}vw` })}</span>
        <span class="etichetta">${esc(nomeTipo(k.tipo))}</span>
      </a></li>`;
  const scelti = capi.length ? [] : sceltiTutti.filter((k) => archivio?.indice?.[k.file]);
  const voci = capi.length ? capi.map(voce) : scelti.length ? scelti.map(unLook) : Array.from({ length: quanti }, inAttesa);
  // con i look in vetrina la sezione porta ciò che serve al visore, che sta subito dopo
  const conVisore = scelti.length && testiVisore;
  const tutti = (prodotti.length > quanti || (!capi.length && scelti.length)) && v.tutti ? `<p class="vetrina__tutti"><a class="collegamento" href="${esc(v.tutti.href)}">${esc(v.tutti.testo)}${icona.freccia}</a></p>` : '';
  return `<section class="sezione sezione--griglia vetrina"${aid(id)}${agr(gruppo)}${conVisore ? ` data-look-elenco data-pagina="${esc(v.tutti.href)}" ${datiVisore(testiVisore, sito)}` : ''}>
    ${intesta({ titolo: v.titolo, testo: v.testo })}
    <ul class="griglia">
      ${voci.join('\n      ')}
    </ul>
    ${tutti}
  </section>${conVisore ? `\n    ${visore(testiVisore, sito, scelti.length)}` : ''}`;
}

/**
 * "Chi siamo" (cultura e artigianato) in pagina iniziale: capitoli a foto intera che restano fermi sullo schermo mentre si scorre.
 * Senza script o con movimento ridotto i capitoli stanno uno sotto l'altro, ogni foto con il suo testo:
 * lo script (src/sito.js, "mestiere") aggiunge .mestiere--vivo e solo allora le foto si scoprono una sull'altra.
 */
export function mestiere(m, capitoli, sito, { id = 'chi-siamo', gruppo = 'chi-siamo' } = {}) {
  return `<section class="sezione mestiere"${aid(id)}${agr(gruppo)} data-mestiere>
    ${intesta({ titolo: m.titolo, testo: m.testo, occhiello: m.occhiello })}
    <div class="mestiere__binario" style="--n: ${capitoli.length}">
      <ol class="mestiere__palco">
        ${capitoli.map((c, i) => `<li class="mestiere__capitolo"${i === 0 ? ' data-attivo' : ''}>
          <div class="mestiere__foto">${foto(c.immagine, sito.foto?.artigianato) || attesa({ nota: c.foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}</div>
          <div class="vetro mestiere__scheda">
            <p class="mestiere__numero">${String(i + 1).padStart(2, '0')} / ${String(capitoli.length).padStart(2, '0')}</p>
            <h3 class="mestiere__titolo">${t(c.titolo)}</h3>
            <p class="mestiere__testo">${t(c.testo)}</p>
          </div>
        </li>`).join('\n        ')}
      </ol>
    </div>
    ${m.link ? `<p class="mestiere__fondo"><a class="collegamento" href="${esc(m.link.href)}">${esc(m.link.testo)}${icona.freccia}</a></p>` : ''}
  </section>`;
}

/** Fascia su fondo chiaro caldo con titolo, una riga e un link. */
export function fascia(f, { id = '', gruppo = '' } = {}) {
  return `<section class="collezione fascia"${aid(id)}${agr(gruppo)}>
    ${intesta(f)}
  </section>`;
}

/**
 * Le due strade dei rivenditori, "Rivenditore Endero" e "Conto terzi": a sinistra il titolo grande con una riga e
 * il tasto, a destra due schede con la foto, ognuna porta alla sua parte della pagina dei rivenditori.
 * È il pezzo che in pagina iniziale ha preso il posto della fascia (proprietario, 2026-11-19: "è troppo piccola,
 * dagli più importanza") e che apre la pagina dei rivenditori.
 * @param {object} testa   { occhiello, titolo, testo, link: { testo, href } }
 * @param {object} strade  diventa-rivenditore.json, "strade": { voci: [{ id, nome, riga, immagine }], vai }
 * @param {string} o.pagina  l'indirizzo della pagina dei rivenditori, o '' se ci si è già
 */
export function strade(testa, strade, sito, { id = '', gruppo = '', pagina = '' } = {}) {
  const archivio = sito.foto?.collezione;
  return `<section class="strade"${aid(id)}${agr(gruppo)}>
    <div class="strade__testo">
      ${testa.occhiello ? `<p class="occhiello">${t(testa.occhiello)}</p>` : ''}
      <h2 class="titolo strade__titolo">${t(testa.titolo)}</h2>
      ${testa.testo ? `<p class="testo">${t(testa.testo)}</p>` : ''}
      ${testa.link ? `<a class="pillola pillola--blu pillola--grande" href="${esc(testa.link.href)}">${esc(testa.link.testo)}</a>` : ''}
    </div>
    <ul class="strade__voci">
      ${strade.voci.map((v, i) => `<li><a class="strada" href="${esc(pagina)}#${esc(v.id)}">
        ${fotoIntera(v.immagine, archivio, { sizes: '(max-width: 809px) 100vw, 30vw' })}
        <span class="strada__vai" aria-hidden="true">${icona.freccia}</span>
        <span class="strada__testo">
          <span class="strada__numero" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
          <span class="titolo strada__nome">${t(v.nome)}</span>
          <span class="strada__riga">${t(v.riga)}</span>
        </span>
      </a></li>`).join('\n      ')}
    </ul>
  </section>`;
}

/** Due pillole affiancate in fondo a una pagina: l'azione principale e WhatsApp. */
export function chiusura(c, sito, { href }) {
  return `<section class="sezione chiusura">
      ${intesta(c)}
      <div class="chiusura__azioni">
        <a class="pillola pillola--blu pillola--grande" href="${esc(href)}">${esc(c.prenota)}</a>
        <a class="pillola pillola--grigia pillola--grande" href="${esc(sito.contatti.whatsapp_link)}" target="_blank" rel="noopener">${esc(c.whatsapp)}</a>
      </div>
    </section>`;
}

/** Organizzazione, sito e sede: uguali in ogni pagina, si collegano tra loro con @id. */
export function datiBase(sito, meta) {
  const c = sito.contatti;
  const d = sito.dominio;
  return [
    {
      '@context': 'https://schema.org', '@type': 'Organization', '@id': `${d}/#organizzazione`, name: sito.nome, url: `${d}/`, logo: `${d}/logo-endero.png`, email: c.email,
      ...(sito.fondazione ? { foundingDate: String(sito.fondazione) } : {}),
      ...(sito.societa ? { legalName: sito.societa.ragione_sociale, vatID: `IT${sito.societa.partita_iva}` } : {}),
      // i profili social, quando il proprietario li dà (sito.json, "social"): dicono a Google che sono la stessa Endero
      ...(sito.social?.length ? { sameAs: sito.social.map((s) => s.link) } : {}),
    },
    { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${d}/#sito`, name: sito.nome, url: `${d}/`, inLanguage: 'it-IT', publisher: { '@id': `${d}/#organizzazione` } },
    {
      '@context': 'https://schema.org',
      '@type': 'ClothingStore',
      '@id': `${d}/#sede`,
      name: sito.nome,
      url: `${d}/`,
      image: sito.foto?.sede?.indice?.negozio ? `${d}/foto/sede/negozio-anteprima.jpg` : `${d}/anteprime/home.jpg`,
      description: piano(sito.descrizione),
      hasMap: c.mappa,
      // gli orari, quando Endero li conferma (sito.json, "orari": [{ giorni: ['Monday', …], apre: '09:00', chiude: '13:00' }])
      ...(sito.orari?.length ? { openingHoursSpecification: sito.orari.map((o) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: o.giorni, opens: o.apre, closes: o.chiude })) } : {}),
      telephone: c.whatsapp_internazionale,
      email: c.email,
      address: { '@type': 'PostalAddress', streetAddress: c.via, postalCode: c.cap, addressLocality: c.citta, addressRegion: c.provincia, addressCountry: c.paese },
      parentOrganization: { '@id': `${d}/#organizzazione` },
    },
  ];
}
