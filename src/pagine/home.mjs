// Pagina iniziale. Struttura del punto 10 della direzione creativa: apertura, eroe, nastro, selettore, vetrina,
// chi siamo (cultura e artigianato), porta sul su misura, rivenditori. Pezzi e proporzioni restano quelli del riferimento.
import { esc, attesa, logo, icona } from '../parti/base.mjs';
import { pagina } from '../parti/telaio.mjs';
import { nastro, vetrina, collezione, mestiere, portaSuMisura, strade, datiBase } from '../parti/sezioni.mjs';

// 0 · Apertura "La cucitura": il film è in src/apertura/, qui solo la struttura che lo script arricchisce.
function apertura(a) {
  return `<section class="apertura" data-apertura="/film/" aria-label="${esc(a.etichetta)}">
  <picture>
    <source media="(orientation: portrait)" srcset="/film/manifesto-alto.jpg" width="1040" height="1520">
    <img class="apertura__manifesto" src="/film/manifesto.jpg" width="1920" height="1200" alt="Il logo Endero ricamato in filo bianco su tessuto blu" fetchpriority="high">
  </picture>
  <ol class="apertura__storia">
    ${a.capitoli.map((c) => `<li><span class="apertura__cifra">${esc(c.cifra)}</span> <span class="apertura__frase">${esc(c.frase)}</span></li>`).join('\n    ')}
  </ol>
  <div class="apertura__palco">
    <div class="apertura__tessuto"></div>
    <canvas class="apertura__macchina" aria-hidden="true"></canvas>
    <canvas class="apertura__film" aria-hidden="true"></canvas>
    <div class="apertura__luce" aria-hidden="true"></div>
    <div class="apertura__invito" aria-hidden="true">
      <span class="invito__mouse"><span class="invito__rotella"></span></span>
      <span class="invito__frecce">${icona.giu}${icona.giu}</span>
      <span class="invito__testo">${esc(a.invito)}</span>
    </div>
    <div class="apertura__carica" role="status" aria-live="polite">
      ${logo('completo')}
      <div class="apertura__avanzamento"></div>
      <span class="apertura__percento">0%</span>
    </div>
  </div>
</section>`;
}

// 1 · Il video a tutto schermo con il titolo della pagina. Resta fermo sotto l'apertura, che si solleva come un telo.
// Nella pagina c'è l'immagine ferma del primo fotogramma, una per i telefoni e una per gli schermi larghi: il video
// lo aggiunge lo script (src/sito.js, "video"), quello giusto per lo schermo, quando l'apertura sta per finire.
// Con il movimento ridotto, o senza script, resta l'immagine.
function eroe(e, sito) {
  const f = e.filmato, v = sito.video || {};
  const ce = (nome) => f && v.file?.includes(nome + '.mp4');
  const indirizzo = (nome, est) => `${v.cartella}${nome}.${est}?v=${v.versione}`;
  const fondo = ce(f?.telefono) && ce(f?.computer)
    ? `<div class="eroe__fondo" data-video-eroe data-telefono="${esc(indirizzo(f.telefono, 'mp4'))}" data-computer="${esc(indirizzo(f.computer, 'mp4'))}"${ce(f.lento) ? ` data-lento="${esc(indirizzo(f.lento, 'mp4'))}"` : ''}>
      <picture>
        <source media="(max-width: 699px)" type="image/avif" srcset="${esc(indirizzo(f.telefono, 'avif'))}" width="720" height="1280">
        <source media="(max-width: 699px)" type="image/webp" srcset="${esc(indirizzo(f.telefono, 'webp'))}" width="720" height="1280">
        <source type="image/avif" srcset="${esc(indirizzo(f.computer, 'avif'))}" width="1080" height="1440">
        <img src="${esc(indirizzo(f.computer, 'webp'))}" alt="${esc(f.alt)}" width="1080" height="1440" decoding="async">
      </picture>
    </div>`
    : `<div class="eroe__fondo">${attesa({ nota: e.video, tono: 'scuro', etichetta: sito.video_in_arrivo, classe: 'attesa--video' })}</div>`;
  return `<section class="eroe${fondo.includes('data-video-eroe') ? ' eroe--video' : ''}" id="contenuto" tabindex="-1">
    ${fondo}
    <div class="eroe__testo">
      <h1 class="titolo eroe__titolo">${e.titolo.map((r) => `<span>${esc(r)}</span>`).join(' ')}</h1>
      <p class="eroe__sotto">${esc(e.sottotitolo)}</p>
      ${e.pillole?.length ? `<p class="eroe__azioni">${e.pillole.map((p, i) => `<a class="pillola ${i === 0 ? 'pillola--chiara' : 'pillola--vetro'}" href="${esc(p.href)}">${esc(p.testo)}</a>`).join('')}</p>` : ''}
    </div>
  </section>`;
}

// 3 · Selettore che resta attaccato in alto: porta alle sezioni della pagina.
function selettore(s) {
  return `<nav class="selettore" aria-label="${esc(s.etichetta)}" data-selettore>
      <button class="selettore__apri" type="button" aria-expanded="false" hidden><span data-selettore-attuale>${esc(s.voci[0].testo)}</span>${icona.giu}</button>
      <ul class="selettore__voci">
        ${s.voci.map((v, i) => `<li><a href="#${esc(v.id)}" data-voce="${esc(v.id)}"${i === 0 ? ' aria-current="true"' : ''}>${esc(v.testo)}</a></li>`).join('\n        ')}
      </ul>
    </nav>`;
}

/**
 * @param {object} o.testi        home.json
 * @param {object} o.cultura      chi-siamo.json (i capitoli)
 * @param {object} o.suMisura     su-misura.json (interruttore del configuratore)
 * @param {object} o.configuratore configuratore.json (i nomi delle misure e la descrizione della camicia)
 * @param {object} o.camicia      gli indirizzi dell'immagine ferma della camicia del configuratore
 * @param {object} o.rivenditori  diventa-rivenditore.json (le due strade, e il loro titolo in richiami.home)
 * @param {object[]} o.prodotti   i capi di prodotti.json
 * @param {object} o.collezione   collezione.json (i look della vetrina, finché i capi non hanno nome e prezzo)
 */
export default function home({ sito, testi: h, cultura, suMisura, configuratore = {}, camicia, rivenditori, prodotti, collezione: collezioneTesti = {}, risorse, anteprima }) {
  const conf = suMisura.configuratore || {};
  const porta = h.porta_su_misura;
  // finché il configuratore non è acceso la pillola porta alla pagina del su misura
  const invito = conf.attivo ? { testo: conf.invito, href: conf.href } : porta.invito;
  const misure = (configuratore.scheda?.gruppi || []).find((g) => g.tipo === 'misure')?.campi.map((c) => c.etichetta) || [];
  const corpo = `${apertura(h.apertura)}
<main>
  ${eroe(h.eroe, sito)}
  ${nastro(h.nastro)}
  <div class="corpo corpo--a-filo">
    ${selettore(h.selettore)}
    ${vetrina(h.vetrina, prodotti, sito, { look: collezioneTesti.look, tipi: collezioneTesti.lookbook?.tipi, visore: collezioneTesti.lookbook?.visore })}
    ${collezione(h.categorie, sito, { id: '', gruppo: 'collezione' })}
    ${mestiere(h.chi_siamo, cultura.capitoli, sito)}
    ${portaSuMisura(porta, sito, { camicia, misure, alt: configuratore.palco?.alt, invito })}
    ${strade(rivenditori.richiami.home, rivenditori.strade, sito, { id: 'rivenditori', gruppo: 'rivenditori', pagina: rivenditori.richiami.home.link.href })}
  </div>
</main>`;
  return pagina({ sito, meta: h.meta, percorso: '/', corpo, risorse, anteprima, dati: datiBase(sito, h.meta), classe: 'pagina-home' });
}
