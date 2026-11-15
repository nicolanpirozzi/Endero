// Pagina /camicie-su-misura/configuratore/. Passo 1: la camicia 3D sospesa e il riquadro in vetro
// (docs/direzione-creativa.md, punto 12). Il 3D lo avvia src/configuratore/configuratore.js; senza script,
// senza WebGL o senza il file del modello resta l'immagine ferma della camicia.
import { esc, t, logo } from '../parti/base.mjs';
import { pagina } from '../parti/telaio.mjs';
import { datiBase } from '../parti/sezioni.mjs';

/**
 * @param {object} o.camicia  { modello, peso, scala, motore }: indirizzi e misure del 3D; `modello` vuoto se il file non c'è
 */
export default function paginaConfiguratore({ sito, testi: c, camicia, risorse, anteprima }) {
  const p = c.palco, s = c.scheda;
  const dati3d = camicia.modello
    ? ` data-camicia="${esc(camicia.modello)}" data-motore="${esc(camicia.motore)}" data-peso="${esc(camicia.peso)}" data-scala="${esc(camicia.scala)}"`
    : '';
  const corpo = `<main>
<section class="configura" id="contenuto" tabindex="-1">
  <div class="configura__palco"${dati3d}>
    <img class="configura__ferma" src="/camicia/camicia.webp" width="1600" height="1200" alt="${esc(p.alt)}" fetchpriority="high">
    <div class="configura__tela" data-tela></div>
    <div class="configura__carica" role="status" aria-live="polite" aria-label="${esc(p.caricamento)}">
      ${logo('completo')}
      <div class="configura__avanzamento"></div>
      <span class="configura__percento" data-percento>0%</span>
    </div>
    <p class="configura__invito" aria-hidden="true"><svg viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M6 3 2 7l4 4M20 3l4 4-4 4M2 7h22"/></svg>${esc(p.invito)}</p>
  </div>
  <aside class="vetro configura__scheda" aria-labelledby="configura-titolo">
    <h1 class="titolo configura__titolo" id="configura-titolo">${t(s.titolo)}</h1>
    <p class="testo configura__testo">${t(s.testo)}</p>
    <ul class="configura__righe">
      ${s.righe.map((r) => `<li><span>${t(r.nome)}</span><span>${t(r.valore)}</span></li>`).join('\n      ')}
    </ul>
    <button class="pillola pillola--chiara pillola--grande" type="button" disabled>${esc(s.continua)}</button>
  </aside>
</section>
</main>`;
  return pagina({
    sito, meta: c.meta, percorso: '/camicie-su-misura/configuratore/', corpo, anteprima,
    risorse: { ...risorse, css: [...risorse.css, camicia.stile], js: [...risorse.js, camicia.script] },
    dati: datiBase(sito, c.meta), classe: 'pagina-configuratore',
  });
}
