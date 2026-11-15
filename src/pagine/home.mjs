// Pagina iniziale. Ordine e proporzioni seguono il riferimento (docs/direzione-creativa.md, punti 1 e 3).
import { esc, attesa, logo, icona } from '../parti/base.mjs';
import { pagina } from '../parti/telaio.mjs';
import { nastro, suMisura, presaMisure, comeFunziona, collezione, storia, domande, prezzo, datiBase } from '../parti/sezioni.mjs';

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

// 4 · Selettore che resta attaccato in alto: porta alle sezioni della pagina.
function selettore(s) {
  return `<nav class="selettore" aria-label="${esc(s.etichetta)}" data-selettore>
      <button class="selettore__apri" type="button" aria-expanded="false" hidden><span data-selettore-attuale>${esc(s.voci[0].testo)}</span>${icona.giu}</button>
      <ul class="selettore__voci">
        ${s.voci.map((v, i) => `<li><a href="#${esc(v.id)}" data-voce="${esc(v.id)}"${i === 0 ? ' aria-current="true"' : ''}>${esc(v.testo)}</a></li>`).join('\n        ')}
      </ul>
    </nav>`;
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
    ${domande(h.domande)}
    ${prezzo(h.prezzo, sito)}
  </div>
</main>`;
  return pagina({ sito, meta: h.meta, percorso: '/', corpo, risorse, anteprima, dati: datiBase(sito, h.meta), classe: 'pagina-home', prenota: '#prenota' });
}
