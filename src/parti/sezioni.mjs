// Sezioni del sito, condivise tra la pagina iniziale e le altre pagine.
// Ordine e proporzioni vengono dal riferimento (docs/direzione-creativa.md, punti 1 e 3).
import { esc, t, tConLink, piano, attesa, foto, logo, icona, euro, indirizzoCapo } from './base.mjs';

const aid = (id) => (id ? ` id="${esc(id)}"` : '');
const agr = (gruppo) => (gruppo ? ` data-gruppo="${esc(gruppo)}"` : '');

export function intesta({ titolo, testo, link, classe = '' }) {
  return `<header class="intesta ${classe}">
      <h2 class="titolo">${t(titolo)}</h2>
      ${testo ? `<p class="testo">${t(testo)}</p>` : ''}
      ${link ? `<a class="collegamento" href="${esc(link.href)}">${esc(link.testo)}${icona.freccia}</a>` : ''}
    </header>`;
}

/** In cima alle pagine interne: foto (o video) con il titolo della pagina, come il video della pagina iniziale. */
export function eroePagina({ titolo, sottotitolo, foto: nota, immagine }, sito) {
  // la foto vera, se c'è (è la prima cosa che si vede: si carica subito), altrimenti il segnaposto
  const fondo = foto(immagine, sito.foto?.artigianato, { pigra: false }) || attesa({ nota, tono: 'scuro', etichetta: sito.foto_in_arrivo });
  return `<section class="eroe eroe--pagina${immagine ? ' eroe--foto' : ''}" id="contenuto" tabindex="-1">
    <div class="eroe__fondo">${fondo}</div>
    <div class="eroe__testo">
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
        ${attesa({ nota: g.foto, etichetta: sito.foto_in_arrivo })}
        <span class="etichetta">${esc(g.etichetta)}</span>
        <div class="vetro griglia__scheda">
          <p class="griglia__nome">${t(g.nome)}</p>
          <p class="griglia__dettaglio">${t(g.tessuto)}</p>
        </div>
      </li>`).join('\n      ')}
    </ul>
  </section>`;
}

// 7 · Foto grande con scheda in vetro: la presa misure.
export function presaMisure(p, sito, { id = '', gruppo = 'su-misura', invito } = {}) {
  const s = p.scheda;
  const pillola = invito || { testo: s.invito, href: '#prenota' };
  return `<section class="sezione"${aid(id)}${agr(gruppo)}>
    ${intesta(p)}
    <div class="grande">
      ${attesa({ nota: p.foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}
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
          <div class="scheda-misure__capo">${attesa({ nota: s.foto, etichetta: sito.foto_in_arrivo })}</div>
        </div>
        <a class="pillola pillola--chiara" href="${esc(pillola.href)}">${esc(pillola.testo)}</a>
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

/**
 * Un campo descritto nei contenuti (modulo.campi): così i moduli nuovi non chiedono codice nuovo.
 * Tipi: testo, telefono, email, area, scelta-singola (pillole radio), scelta-multipla (pillole a caselle, almeno una
 * se obbligatoria: lo controllano lo script prima dell'invio e il Worker sempre).
 */
function campoDescritto(c, id) {
  const largo = c.largo ? ' campo--largo' : '';
  const max = c.max ? ` maxlength="${Number(c.max)}"` : '';
  const auto = c.autocomplete ? ` autocomplete="${esc(c.autocomplete)}"` : '';
  const obbl = c.obbligatorio ? ' required' : '';
  if (c.tipo === 'scelta-multipla' || c.tipo === 'scelta-singola') {
    const multipla = c.tipo === 'scelta-multipla';
    const almeno = multipla && c.obbligatorio ? ` data-almeno-uno data-errore="${esc(c.errore || '')}"` : '';
    return `<fieldset class="campo${largo}"${almeno}>
        <legend class="campo__nome">${esc(c.etichetta)}</legend>
        <div class="scelte">${c.opzioni.map((o) => `<label class="scelta"><input type="${multipla ? 'checkbox' : 'radio'}" name="${esc(c.nome)}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}</div>
      </fieldset>`;
  }
  const etichetta = `<span class="campo__nome">${esc(c.etichetta)}</span>`;
  if (c.tipo === 'area') {
    return `<label class="campo${largo}">${etichetta}<textarea name="${esc(c.nome)}" rows="4"${max}${obbl}${c.aiuto ? ` placeholder="${esc(c.aiuto)}"` : ''}></textarea></label>`;
  }
  const tipo = TIPO_INPUT[c.tipo] || 'text';
  const extra = c.tipo === 'telefono' ? ' inputmode="tel"' : '';
  const valore = c.valore ? ` value="${esc(c.valore)}"` : '';
  return `<label class="campo${largo}" for="${id}">${etichetta}<input id="${id}" type="${tipo}" name="${esc(c.nome)}"${auto}${extra}${max}${obbl}${valore}></label>`;
}

/**
 * Il modulo: prenotazione della presa misure (con giorno e fascia), messaggio semplice, oppure, se i contenuti
 * descrivono i campi (m.campi), quei campi. Funziona anche senza JavaScript.
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
  const piede = `${turnstile ? `<div class="cf-turnstile" data-sitekey="${esc(turnstile)}" data-language="it" data-size="flexible"></div>` : ''}
    <label class="consenso"><input type="checkbox" name="privacy" value="si" required><span>${tConLink(m.privacy)}</span></label>
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
  return `${testa}
    <div class="modulo__campi">
      <label class="campo"><span class="campo__nome">${esc(m.nome)}</span><input type="text" name="nome" autocomplete="name" required maxlength="120"></label>
      <label class="campo"><span class="campo__nome">${esc(m.telefono)}</span><input type="tel" name="telefono" autocomplete="tel" inputmode="tel" required maxlength="40"></label>
      <label class="campo"><span class="campo__nome">${esc(m.email)}</span><input type="email" name="email" autocomplete="email" maxlength="160"></label>
      ${prenotazione ? `<label class="campo"><span class="campo__nome">${esc(m.giorno)}</span><input type="date" name="giorno" data-giorno></label>
      <fieldset class="campo campo--largo">
        <legend class="campo__nome">${esc(m.fascia)}</legend>
        <div class="scelte">${m.fasce.map((f, i) => `<label class="scelta"><input type="radio" name="fascia" value="${esc(f)}"${i === m.fasce.length - 1 ? ' checked' : ''}><span>${esc(f)}</span></label>`).join('')}</div>
      </fieldset>` : ''}
      <label class="campo campo--largo"><span class="campo__nome">${esc(m.note)}</span><textarea name="messaggio" rows="${prenotazione ? 3 : 5}" maxlength="2000" placeholder="${esc(m.note_aiuto)}"${prenotazione ? '' : ' required'}></textarea></label>
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
      ${c.riquadri.map((r) => `<li><a class="riquadro" href="${esc(r.href)}">
        ${attesa({ nota: r.foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}
        <span class="titolo riquadro__titolo">${t(r.titolo)}</span>
      </a></li>`).join('\n      ')}
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
        <div class="domanda__risposta"><p>${t(v.risposta)}</p></div>
      </details>`).join('\n      ')}
    </div>
  </section>`;
}

// 12 · Prezzo: foto a sinistra, cifra e invito a destra.
export function prezzo(p, sito, { gruppo = 'su-misura' } = {}) {
  return `<section class="prezzo"${agr(gruppo)}>
    <div class="prezzo__foto">${attesa({ nota: p.foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}</div>
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
 * Vetrina: la griglia di foto a 6 colonne (2 sul telefono) con i capi di prodotti.json. Ogni riquadro porta al capo;
 * al passaggio compare la scheda in vetro con nome, tessuto e prezzo. Finché non ci sono capi, riquadri segnaposto.
 */
export function vetrina(v, prodotti, sito, { id = 'collezione', gruppo = 'collezione' } = {}) {
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
  const voci = capi.length ? capi.map(voce) : Array.from({ length: quanti }, inAttesa);
  const tutti = prodotti.length > quanti && v.tutti ? `<p class="vetrina__tutti"><a class="collegamento" href="${esc(v.tutti.href)}">${esc(v.tutti.testo)}${icona.freccia}</a></p>` : '';
  return `<section class="sezione sezione--griglia vetrina"${aid(id)}${agr(gruppo)}>
    ${intesta({ titolo: v.titolo, testo: v.testo })}
    <ul class="griglia">
      ${voci.join('\n      ')}
    </ul>
    ${tutti}
  </section>`;
}

/**
 * Cultura e artigianato in pagina iniziale: capitoli a foto intera che restano fermi sullo schermo mentre si scorre.
 * Senza script o con movimento ridotto i capitoli stanno uno sotto l'altro, ogni foto con il suo testo:
 * lo script (src/sito.js, "mestiere") aggiunge .mestiere--vivo e solo allora le foto si scoprono una sull'altra.
 */
export function mestiere(m, capitoli, sito, { id = 'artigianato', gruppo = 'artigianato' } = {}) {
  return `<section class="sezione mestiere"${aid(id)}${agr(gruppo)} data-mestiere>
    ${intesta({ titolo: m.titolo, testo: m.testo })}
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

/** Fascia su fondo chiaro caldo con titolo, una riga e un link: i rivenditori in pagina iniziale. */
export function fascia(f, { id = '', gruppo = '' } = {}) {
  return `<section class="collezione fascia"${aid(id)}${agr(gruppo)}>
    ${intesta(f)}
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
    { '@context': 'https://schema.org', '@type': 'Organization', '@id': `${d}/#organizzazione`, name: sito.nome, url: `${d}/`, logo: `${d}/logo.svg`, email: c.email },
    { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${d}/#sito`, name: sito.nome, url: `${d}/`, inLanguage: 'it-IT', publisher: { '@id': `${d}/#organizzazione` } },
    {
      '@context': 'https://schema.org',
      '@type': 'ClothingStore',
      '@id': `${d}/#sede`,
      name: sito.nome,
      url: `${d}/`,
      image: `${d}/film/manifesto.jpg`,
      description: piano(sito.descrizione),
      telephone: c.whatsapp_internazionale,
      email: c.email,
      address: { '@type': 'PostalAddress', streetAddress: c.via, postalCode: c.cap, addressLocality: c.citta, addressRegion: c.provincia, addressCountry: c.paese },
      parentOrganization: { '@id': `${d}/#organizzazione` },
    },
  ];
}
