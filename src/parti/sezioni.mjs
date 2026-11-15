// Sezioni del sito, condivise tra la pagina iniziale e le altre pagine.
// Ordine e proporzioni vengono dal riferimento (docs/direzione-creativa.md, punti 1 e 3).
import { esc, t, tConLink, piano, attesa, logo, icona } from './base.mjs';

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
export function eroePagina({ titolo, sottotitolo, foto }, sito) {
  return `<section class="eroe eroe--pagina" id="contenuto" tabindex="-1">
    <div class="eroe__fondo">${attesa({ nota: foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}</div>
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

// 5–6 · Titolo e griglia di foto verticali.
export function suMisura(s, sito, { id = 'su-misura', gruppo = 'su-misura' } = {}) {
  return `<section class="sezione sezione--griglia"${aid(id)}${agr(gruppo)}>
    ${intesta(s)}
    <ul class="griglia">
      ${s.griglia.map((g) => `<li class="griglia__voce">
        ${attesa({ nota: g.foto, etichetta: sito.foto_in_arrivo })}
        <span class="etichetta">${esc(g.etichetta)}</span>
        <div class="vetro griglia__scheda" aria-hidden="true">
          <p class="griglia__nome">${t(g.nome)}</p>
          <p class="griglia__dettaglio">${t(g.tessuto)}</p>
        </div>
      </li>`).join('\n      ')}
    </ul>
  </section>`;
}

// 7 · Foto grande con scheda in vetro: la presa misure.
export function presaMisure(p, sito, { gruppo = 'su-misura' } = {}) {
  const s = p.scheda;
  return `<section class="sezione"${agr(gruppo)}>
    ${intesta(p)}
    <div class="grande">
      ${attesa({ nota: p.foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}
      <div class="vetro scheda-misure">
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
        <a class="pillola pillola--chiara" href="#prenota">${esc(s.invito)}</a>
      </div>
    </div>
  </section>`;
}

// 8 · Testo a sinistra, pannello con il modulo di prenotazione a destra.
export function comeFunziona(c, turnstile, { gruppo = 'su-misura' } = {}) {
  return `<section class="sezione funziona" id="prenota"${agr(gruppo)}>
    <div class="funziona__testo">
      <h2 class="titolo">${t(c.titolo)}</h2>
      <p class="testo">${t(c.testo)}</p>
      <ol class="passi">
        ${c.passi.map((p, i) => `<li><span class="passi__numero">${String(i + 1).padStart(2, '0')}</span><h3 class="passi__titolo">${esc(p.titolo)}</h3><p class="testo">${t(p.testo)}</p></li>`).join('\n        ')}
      </ol>
    </div>
    <div class="pannello">
      ${modulo(c.modulo, { tipo: 'presa-misure', turnstile })}
    </div>
  </section>`;
}

/** Il modulo: prenotazione della presa misure (con giorno e fascia) o messaggio semplice. Funziona anche senza JavaScript. */
export function modulo(m, { tipo = 'presa-misure', turnstile = '' } = {}) {
  const prenotazione = tipo === 'presa-misure';
  return `<form class="modulo" action="/api/contatto" method="post" data-modulo${turnstile ? ' data-turnstile' : ''}>
    <div class="modulo__testa">
      <h3 class="modulo__titolo">${esc(m.titolo)}</h3>
      <div class="modulo__schede">${m.schede.map((s, i) => `<span class="chip${i === 0 ? ' chip--attivo' : ''}">${esc(s)}</span>`).join('')}</div>
    </div>
    <input type="hidden" name="tipo" value="${esc(tipo)}">
    <div class="modulo__esca" aria-hidden="true"><label>Non compilare<input type="text" name="sito_web" tabindex="-1" autocomplete="off"></label></div>
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
    ${turnstile ? `<div class="cf-turnstile" data-sitekey="${esc(turnstile)}" data-language="it" data-size="flexible"></div>` : ''}
    <label class="consenso"><input type="checkbox" name="privacy" value="si" required><span>${tConLink(m.privacy)}</span></label>
    <div class="modulo__piede">
      <button class="pillola pillola--blu pillola--grande" type="submit" data-testo-invio="${esc(m.invio)}">${esc(m.invia)}</button>
      <p class="modulo__esito" role="status" aria-live="polite" data-fatto="${esc(m.fatto_testo)}" data-errore="${esc(m.errore)}"></p>
    </div>
  </form>`;
}

// 9 · Tre riquadri: gli ingressi alla collezione.
export function collezione(c, sito, { id = 'collezione', gruppo = 'collezione' } = {}) {
  return `<section class="collezione"${aid(id)}${agr(gruppo)}>
    ${intesta(c)}
    <ul class="riquadri">
      ${c.riquadri.map((r) => `<li><a class="riquadro" href="${esc(r.href)}">
        ${attesa({ nota: r.foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}
        <span class="titolo riquadro__titolo">${t(r.titolo)}</span>
      </a></li>`).join('\n      ')}
    </ul>
  </section>`;
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
      image: `${d}${meta.immagine || '/film/manifesto.jpg'}`,
      description: piano(meta.descrizione),
      telephone: c.whatsapp_internazionale,
      email: c.email,
      address: { '@type': 'PostalAddress', streetAddress: c.via, postalCode: c.cap, addressLocality: c.citta, addressRegion: c.provincia, addressCountry: c.paese },
      parentOrganization: { '@id': `${d}/#organizzazione` },
    },
  ];
}
