// Pagina /camicie-su-misura/configuratore/. Passo 1: la camicia 3D sospesa e il riquadro in vetro
// (docs/direzione-creativa.md, punto 12). Il 3D lo avvia src/configuratore/configuratore.js; senza script,
// senza WebGL o senza il file del modello resta l'immagine ferma della camicia.
import { esc, t, logo } from '../parti/base.mjs';
import { pagina } from '../parti/telaio.mjs';
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
 * @param {object} o.camicia  { modello, peso, motore, ferma }: indirizzo e peso del 3D, indirizzo dell'immagine ferma; `modello` vuoto se il file non c'è
 */
export default function paginaConfiguratore({ sito, testi: c, camicia, risorse, anteprima }) {
  const p = c.palco, s = c.scheda;
  const dati3d = camicia.modello
    ? ` data-camicia="${esc(camicia.modello)}" data-motore="${esc(camicia.motore)}" data-peso="${esc(camicia.peso)}"`
    : '';
  const corpo = `<main>
<section class="configura" id="contenuto" tabindex="-1">
  <div class="configura__palco"${dati3d}>
    <img class="configura__ferma" src="${esc(camicia.ferma)}" width="1024" height="1312" alt="${esc(p.alt)}" fetchpriority="high">
    <div class="configura__tela" data-tela></div>
    <div class="configura__carica" role="status" aria-live="polite" aria-label="${esc(p.caricamento)}">
      ${logo('completo')}
      <div class="configura__avanzamento"></div>
      <span class="configura__percento" data-percento>0%</span>
    </div>
    <p class="configura__invito" aria-hidden="true"><svg viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M6 3 2 7l4 4M20 3l4 4-4 4M2 7h22"/></svg>${esc(p.invito)}</p>
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
    dati: datiBase(sito, c.meta), classe: 'pagina-configuratore',
  });
}
