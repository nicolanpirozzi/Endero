// Pagina iniziale. Struttura del punto 10 della direzione creativa: apertura, eroe, nastro, selettore, vetrina,
// cultura e artigianato, porta sul su misura, fascia dei rivenditori. Pezzi e proporzioni restano quelli del riferimento.
import { esc, attesa, logo, icona } from '../parti/base.mjs';
import { pagina } from '../parti/telaio.mjs';
import { nastro, vetrina, collezione, mestiere, presaMisure, fascia, datiBase } from '../parti/sezioni.mjs';

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
function eroe(e, sito) {
  return `<section class="eroe" id="contenuto" tabindex="-1">
    <div class="eroe__fondo">${attesa({ nota: e.video, tono: 'scuro', etichetta: sito.video_in_arrivo, classe: 'attesa--video' })}</div>
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
 * @param {object} o.cultura      cultura-e-artigianato.json (i capitoli)
 * @param {object} o.suMisura     su-misura.json (scheda misure e interruttore del configuratore)
 * @param {object} o.rivenditori  diventa-rivenditore.json (la fascia, in richiami.home)
 * @param {object[]} o.prodotti   i capi di prodotti.json
 * @param {object} o.collezione   collezione.json (i look della vetrina, finché i capi non hanno nome e prezzo)
 */
export default function home({ sito, testi: h, cultura, suMisura, rivenditori, prodotti, collezione: collezioneTesti = {}, risorse, anteprima }) {
  const conf = suMisura.configuratore || {};
  const porta = { ...h.porta_su_misura, scheda: suMisura.presa_misure.scheda };
  // finché il configuratore non è acceso la pillola porta alla pagina del su misura
  const invito = conf.attivo ? { testo: conf.invito, href: conf.href } : porta.invito;
  const corpo = `${apertura(h.apertura)}
<main>
  ${eroe(h.eroe, sito)}
  ${nastro(h.nastro)}
  <div class="corpo corpo--a-filo">
    ${selettore(h.selettore)}
    ${vetrina(h.vetrina, prodotti, sito, { look: collezioneTesti.look, tipi: collezioneTesti.lookbook?.tipi })}
    ${collezione(h.categorie, sito, { id: '', gruppo: 'collezione' })}
    ${mestiere(h.artigianato, cultura.capitoli, sito)}
    ${presaMisure(porta, sito, { id: 'su-misura', gruppo: 'su-misura', invito })}
    ${fascia(rivenditori.richiami.home, { id: 'rivenditori', gruppo: 'rivenditori' })}
  </div>
</main>`;
  return pagina({ sito, meta: h.meta, percorso: '/', corpo, risorse, anteprima, dati: datiBase(sito, h.meta), classe: 'pagina-home' });
}
