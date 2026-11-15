// Pagina iniziale. Ordine e proporzioni seguono il riferimento (docs/direzione-creativa.md, punti 1 e 3).
import { esc, t, tConLink, piano, attesa, logo, icona } from '../parti/base.mjs';
import { pagina } from '../parti/telaio.mjs';

function intesta({ titolo, testo, link, classe = '' }) {
  return `<header class="intesta ${classe}">
      <h2 class="titolo">${t(titolo)}</h2>
      ${testo ? `<p class="testo">${t(testo)}</p>` : ''}
      ${link ? `<a class="collegamento" href="${esc(link.href)}">${esc(link.testo)}${icona.freccia}</a>` : ''}
    </header>`;
}

// 0 · Apertura "La cucitura": il film è in src/apertura/, qui solo la struttura che lo script arricchisce.
function apertura(a) {
  return `<section class="apertura" data-apertura="/film/" aria-label="${esc(a.etichetta)}">
  <a class="apertura__salta" href="#contenuto">${esc(a.salta)}</a>
  <picture>
    <source media="(orientation: portrait)" srcset="/film/manifesto-alto.jpg" width="1040" height="1520">
    <img class="apertura__manifesto" src="/film/manifesto.jpg" width="1920" height="1200" alt="Il logo Endero ricamato in filo bianco su tessuto blu" fetchpriority="high">
  </picture>
  <ol class="apertura__storia">
    ${a.capitoli.map((c) => `<li><span class="apertura__cifra">${esc(c.cifra)}</span><span class="apertura__frase">${esc(c.frase)}</span></li>`).join('\n    ')}
  </ol>
  <div class="apertura__palco">
    <div class="apertura__tessuto"></div>
    <canvas class="apertura__macchina" aria-hidden="true"></canvas>
    <canvas class="apertura__film" aria-hidden="true"></canvas>
    <div class="apertura__luce" aria-hidden="true"></div>
    <p class="apertura__invito" aria-hidden="true">${esc(a.invito)}</p>
    <div class="apertura__carica" role="status" aria-live="polite">
      ${logo('completo')}
      <div class="apertura__avanzamento"></div>
      <span class="apertura__percento">0%</span>
    </div>
  </div>
</section>`;
}

// 2 · Il video a tutto schermo con il titolo della pagina. Resta fermo sotto l'apertura, che si solleva come un telo.
function eroe(e, sito) {
  return `<section class="eroe" id="contenuto" tabindex="-1">
    <div class="eroe__fondo">${attesa({ nota: e.video, tono: 'scuro', etichetta: sito.video_in_arrivo, classe: 'attesa--video' })}</div>
    <div class="eroe__testo">
      <h1 class="titolo eroe__titolo">${e.titolo.map((r) => `<span>${esc(r)}</span>`).join(' ')}</h1>
      <p class="eroe__sotto">${esc(e.sottotitolo)}</p>
    </div>
  </section>`;
}

// 3 · Nastro di fatti che scorre. La seconda copia serve solo a chiudere il giro e non si legge due volte.
function nastro(voci) {
  const giro = (nascosto) => voci.map((v) => `<li${nascosto ? ' aria-hidden="true"' : ''}>${esc(v)}${logo('simbolo', { classe: 'nastro__punto' })}</li>`).join('');
  return `<section class="nastro" aria-label="Endero in breve">
    <ul class="nastro__binario">${giro(false)}${giro(true)}${giro(true)}</ul>
  </section>`;
}

// 4 · Selettore che resta attaccato in alto: porta alle sezioni della pagina.
function selettore(s) {
  return `<nav class="selettore" aria-label="${esc(s.etichetta)}" data-selettore>
      <button class="selettore__apri" type="button" aria-expanded="false" hidden><span data-selettore-attuale>${esc(s.voci[0].testo)}</span>${icona.giu}</button>
      <ul class="selettore__voci">
        ${s.voci.map((v, i) => `<li><a href="#${esc(v.id)}" data-voce="${esc(v.id)}"${i === 0 ? ' aria-current="true"' : ''}>${esc(v.testo)}</a></li>`).join('\n        ')}
      </ul>
    </nav>`;
}

// 5–6 · Titolo e griglia di foto verticali.
function suMisura(s, sito) {
  return `<section class="sezione sezione--griglia" id="su-misura" data-gruppo="su-misura">
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
function presaMisure(p, sito) {
  const s = p.scheda;
  return `<section class="sezione" data-gruppo="su-misura">
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
function comeFunziona(c, turnstile) {
  const m = c.modulo;
  return `<section class="sezione funziona" id="prenota" data-gruppo="su-misura">
    <div class="funziona__testo">
      <h2 class="titolo">${t(c.titolo)}</h2>
      <p class="testo">${t(c.testo)}</p>
      <ol class="passi">
        ${c.passi.map((p, i) => `<li><span class="passi__numero">${String(i + 1).padStart(2, '0')}</span><h3 class="passi__titolo">${esc(p.titolo)}</h3><p class="testo">${t(p.testo)}</p></li>`).join('\n        ')}
      </ol>
    </div>
    <div class="pannello">
      <form class="modulo" action="/api/contatto" method="post" data-modulo${turnstile ? ' data-turnstile' : ''}>
        <div class="modulo__testa">
          <h3 class="modulo__titolo">${esc(m.titolo)}</h3>
          <div class="modulo__schede">${m.schede.map((s, i) => `<span class="chip${i === 0 ? ' chip--attivo' : ''}">${esc(s)}</span>`).join('')}</div>
        </div>
        <input type="hidden" name="tipo" value="presa-misure">
        <div class="modulo__esca" aria-hidden="true"><label>Non compilare<input type="text" name="sito_web" tabindex="-1" autocomplete="off"></label></div>
        <div class="modulo__campi">
          <label class="campo"><span class="campo__nome">${esc(m.nome)}</span><input type="text" name="nome" autocomplete="name" required maxlength="120"></label>
          <label class="campo"><span class="campo__nome">${esc(m.telefono)}</span><input type="tel" name="telefono" autocomplete="tel" inputmode="tel" required maxlength="40"></label>
          <label class="campo"><span class="campo__nome">${esc(m.email)}</span><input type="email" name="email" autocomplete="email" maxlength="160"></label>
          <label class="campo"><span class="campo__nome">${esc(m.giorno)}</span><input type="date" name="giorno" data-giorno></label>
          <fieldset class="campo campo--largo">
            <legend class="campo__nome">${esc(m.fascia)}</legend>
            <div class="scelte">${m.fasce.map((f, i) => `<label class="scelta"><input type="radio" name="fascia" value="${esc(f)}"${i === m.fasce.length - 1 ? ' checked' : ''}><span>${esc(f)}</span></label>`).join('')}</div>
          </fieldset>
          <label class="campo campo--largo"><span class="campo__nome">${esc(m.note)}</span><textarea name="messaggio" rows="3" maxlength="2000" placeholder="${esc(m.note_aiuto)}"></textarea></label>
        </div>
        ${turnstile ? `<div class="cf-turnstile" data-sitekey="${esc(turnstile)}" data-language="it" data-size="flexible"></div>` : ''}
        <label class="consenso"><input type="checkbox" name="privacy" value="si" required><span>${tConLink(m.privacy)}</span></label>
        <div class="modulo__piede">
          <button class="pillola pillola--blu pillola--grande" type="submit" data-testo-invio="${esc(m.invio)}">${esc(m.invia)}</button>
          <p class="modulo__esito" role="status" aria-live="polite" data-fatto="${esc(m.fatto_testo)}" data-errore="${esc(m.errore)}"></p>
        </div>
      </form>
    </div>
  </section>`;
}

// 9 · Tre riquadri: gli ingressi alla collezione.
function collezione(c, sito) {
  return `<section class="collezione" id="collezione" data-gruppo="collezione">
    ${intesta(c)}
    <ul class="riquadri">
      ${c.riquadri.map((r) => `<li><a class="riquadro" href="${esc(r.href)}">
        ${attesa({ nota: r.foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}
        <span class="titolo riquadro__titolo">${esc(r.titolo)}</span>
      </a></li>`).join('\n      ')}
    </ul>
  </section>`;
}

// 10 · Carosello: i capitoli della storia. Le citazioni dei clienti entreranno solo con recensioni vere.
function storia(s, sito) {
  return `<section class="sezione storia" id="storia" data-gruppo="storia">
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

// Foto grande con pannello a destra: la sede.
function doveSiamo(d, sito) {
  const c = sito.contatti;
  const p = d.pannello;
  return `<section class="sezione" id="dove-siamo" data-gruppo="dove-siamo">
    ${intesta(d)}
    <div class="grande grande--pannello">
      ${attesa({ nota: d.foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}
      <div class="vetro pannello-sede">
        <div class="vetro__testa">
          <h3 class="vetro__titolo">${esc(p.titolo)}</h3>
          <a class="chip chip--chiaro" href="${esc(c.mappa)}" target="_blank" rel="noopener">${esc(p.indicazioni)}${icona.freccia}</a>
        </div>
        <address class="pannello-sede__indirizzo">
          <span class="pannello-sede__via">${esc(c.via)}</span>
          <span>${esc(`${c.cap} ${c.citta} (${c.provincia})`)}</span>
        </address>
        <div class="pannello-sede__righe">
          <div><h4 class="vetro__sezione">${esc(p.orari_titolo)}</h4><p>${t(p.orari)}</p></div>
          <div><h4 class="vetro__sezione">${esc(p.contatti_titolo)}</h4>
            <p><a href="${esc(c.whatsapp_link)}" target="_blank" rel="noopener">WhatsApp ${esc(c.whatsapp)}</a></p>
            <p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

// 11 · Domande frequenti: si aprono anche senza JavaScript.
function domande(d) {
  return `<section class="sezione domande" data-gruppo="dove-siamo">
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
function prezzo(p, sito) {
  return `<section class="prezzo" data-gruppo="dove-siamo">
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

function datiStrutturati(sito, h) {
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
      image: `${d}${h.meta.immagine}`,
      description: piano(h.meta.descrizione),
      telephone: c.whatsapp_internazionale,
      email: c.email,
      address: { '@type': 'PostalAddress', streetAddress: c.via, postalCode: c.cap, addressLocality: c.citta, addressRegion: c.provincia, addressCountry: c.paese },
      parentOrganization: { '@id': `${d}/#organizzazione` },
    },
  ];
}

export default function home({ sito, testi: h, risorse, anteprima }) {
  const corpo = `${apertura(h.apertura)}
<main>
  ${eroe(h.eroe, sito)}
  ${nastro(h.nastro)}
  <div class="corpo">
    ${selettore(h.selettore)}
    ${suMisura(h.su_misura, sito)}
    ${presaMisure(h.presa_misure, sito)}
    ${comeFunziona(h.come_funziona, risorse.turnstile)}
    ${collezione(h.collezione, sito)}
    ${storia(h.storia, sito)}
    ${doveSiamo(h.dove_siamo, sito)}
    ${domande(h.domande)}
    ${prezzo(h.prezzo, sito)}
  </div>
</main>`;
  return pagina({ sito, meta: h.meta, percorso: '/', corpo, risorse, anteprima, dati: datiStrutturati(sito, h), classe: 'pagina-home' });
}
