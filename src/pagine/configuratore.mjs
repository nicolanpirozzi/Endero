// Pagina /camicie-su-misura/configuratore/. Passo 1: la camicia appesa e il riquadro in vetro
// (docs/direzione-creativa.md, punto 12). La camicia è un film calcolato prima (camicia/film/): un'immagine ferma e
// due scene, la mano che la tocca da sinistra e da destra, che src/configuratore/configuratore.js fa partire quando il mouse le passa sopra.
// Senza script resta l'immagine ferma.
import { esc, t } from '../parti/base.mjs';
import { pagina, briciola } from '../parti/telaio.mjs';
import { datiBase } from '../parti/sezioni.mjs';

/**
 * Un gruppo di campi del riquadro, descritto in configuratore.json (scheda.gruppi):
 * - "misure": numeri in centimetri, con la virgola, tastierino numerico sul telefono, limiti min e max;
 * - "spento": si vedono nome e casella, ma non si compilano (disabled) finché il proprietario non dice cosa metterci;
 * - "dati": nome, telefono, email.
 */
function gruppo(g, s) {
  const id = (c) => `campo-${c.nome}`;
  let campi;
  if (g.tipo === 'misure') {
    campi = g.campi.map((c) => {
      const aiuto = c.aiuto ? `<span class="misura__aiuto" id="${id(c)}-aiuto">${t(c.aiuto)}</span>` : '';
      const errore = `<span class="misura__errore" id="${id(c)}-errore" aria-live="polite"></span>`;
      const descritto = [c.aiuto ? `${id(c)}-aiuto` : '', `${id(c)}-errore`].filter(Boolean).join(' ');
      const messaggio = s.errore_misura.replace('{min}', c.min).replace('{max}', c.max);
      return `<div class="misura">
        <label class="misura__nome" for="${id(c)}">${esc(c.etichetta)}</label>
        <span class="misura__casella"><input id="${id(c)}" name="${esc(c.nome)}" type="text" inputmode="decimal" autocomplete="off" pattern="[0-9]{1,3}([,.][0-9]{1,2})?" maxlength="6" data-min="${esc(c.min)}" data-max="${esc(c.max)}" data-errore="${esc(messaggio)}" aria-describedby="${descritto}">${c.unita ? `<span class="misura__unita" aria-hidden="true">${esc(c.unita)}</span>` : ''}</span>
        ${aiuto}${errore}
      </div>`;
    });
  } else if (g.tipo === 'spento') {
    campi = g.campi.map((c) => {
      if (c.sino) return `<div class="misura misura--spenta misura--sino"><input id="${id(c)}" name="${esc(c.nome)}" type="checkbox" disabled><label class="misura__nome" for="${id(c)}">${esc(c.etichetta)}</label></div>`;
      const casella = c.righe
        ? `<textarea id="${id(c)}" name="${esc(c.nome)}" rows="${esc(c.righe)}" disabled></textarea>`
        : `<input id="${id(c)}" name="${esc(c.nome)}" type="text" disabled>`;
      return `<div class="misura misura--spenta${c.righe || c.largo ? ' misura--larga' : ''}">
        <label class="misura__nome" for="${id(c)}">${esc(c.etichetta)}</label>
        <span class="misura__casella">${casella}</span>
      </div>`;
    });
  } else {
    campi = g.campi.map((c) => `<div class="misura misura--larga">
        <label class="misura__nome" for="${id(c)}">${esc(c.etichetta)}</label>
        <span class="misura__casella"><input id="${id(c)}" name="${esc(c.nome)}" type="${esc(c.tipo)}" autocomplete="${esc(c.completa)}" maxlength="${esc(c.massimo)}"${c.tipo === 'tel' ? ' inputmode="tel"' : ''}></span>
      </div>`);
  }
  const nota = g.nota ? `<p class="configura__gruppo-nota" id="gruppo-${esc(g.id)}-nota">${t(g.nota)}</p>` : '';
  return `<fieldset class="configura__gruppo configura__gruppo--${esc(g.tipo)}"${g.tipo === 'spento' ? ` disabled aria-describedby="gruppo-${esc(g.id)}-nota"` : ''}>
      <legend class="configura__gruppo-titolo">${t(g.titolo)}</legend>
      ${nota}
      <div class="configura__campi">
      ${campi.join('\n      ')}
      </div>
    </fieldset>`;
}

/**
 * @param {object} o.camicia  { stile, script, ferma: { computer, computer2x, telefono, telefono2x }, leggera, leggeraV }:
 *   gli indirizzi dell'immagine ferma, la cartella dei tre pezzi che si muovono (se ci sono) e la loro impronta
 */
export default function paginaConfiguratore({ sito, testi: c, camicia, risorse, anteprima }) {
  const p = c.palco, s = c.scheda;
  // l'immagine ferma c'è sempre, e per gli schermi fitti anche a grandezza doppia, se il file c'è
  const serie = (file, largo, doppio) => `${file} ${largo}w` + (doppio ? `, ${doppio} ${largo * 2}w` : '');
  const corpo = `<main>
<section class="configura" id="contenuto" tabindex="-1">
  <div class="configura__palco"${camicia.leggera ? ` data-leggera="${esc(camicia.leggera)}" data-leggera-v="${esc(camicia.leggeraV)}"` : ''}>
    <picture>
      <source media="(max-width: 599px)" srcset="${esc(serie(camicia.ferma.telefono, 750, camicia.ferma.telefono2x))}" sizes="100vw" width="750" height="1000">
      <img class="configura__ferma" src="${esc(camicia.ferma.computer)}" srcset="${esc(serie(camicia.ferma.computer, 1800, camicia.ferma.computer2x))}" sizes="(max-width: 959px) 112vh, max(180vh, 90vw)" width="1800" height="1000" alt="${esc(p.alt)}" fetchpriority="high" draggable="false">
    </picture>
    <p class="configura__invito" aria-hidden="true"><svg viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M6 3 2 7l4 4M20 3l4 4-4 4M2 7h22"/></svg><span class="configura__invito-mouse">${esc(p.invito)}</span><span class="configura__invito-dito">${esc(p.invito_dito)}</span></p>
  </div>
  <form class="vetro configura__scheda" aria-labelledby="configura-titolo" data-modulo data-non-invia novalidate>
    <h1 class="titolo configura__titolo" id="configura-titolo">${t(s.titolo)}</h1>
    <p class="testo configura__testo">${t(s.testo)}</p>
    ${s.gruppi.map((g) => gruppo(g, s)).join('\n    ')}
    <div class="configura__fondo">
      <button class="pillola pillola--chiara pillola--grande" type="submit" disabled aria-describedby="configura-continua">${esc(s.continua)}</button>
      <p class="configura__nota" id="configura-continua">${t(s.continua_nota)}</p>
    </div>
  </form>
</section>
</main>`;
  return pagina({
    sito, meta: c.meta, percorso: '/camicie-su-misura/configuratore/', corpo, anteprima,
    risorse: { ...risorse, css: [...risorse.css, camicia.stile], js: [...risorse.js, camicia.script] },
    dati: [
      ...datiBase(sito, c.meta),
      {
        '@context': 'https://schema.org', '@type': 'Service', '@id': `${sito.dominio}/camicie-su-misura/configuratore/#servizio`,
        name: c.meta.servizio, serviceType: c.meta.servizio, description: c.meta.descrizione,
        url: `${sito.dominio}/camicie-su-misura/configuratore/`, provider: { '@id': `${sito.dominio}/#sede` },
      },
    ],
    classe: 'pagina-configuratore',
    briciole: [briciola(sito, '/camicie-su-misura/'), briciola(sito, '/camicie-su-misura/configuratore/', c.meta.briciola)],
  });
}
