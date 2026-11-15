// Pagina /dove-siamo/: la sede, i contatti e un modulo per scrivere a Endero.
import { esc, t, icona } from '../parti/base.mjs';
import { pagina } from '../parti/telaio.mjs';
import { eroePagina, modulo, datiBase } from '../parti/sezioni.mjs';
import { sedeConFoto } from '../parti/sede.mjs';

export default function paginaDoveSiamo({ sito, testi: p, risorse, anteprima }) {
  const c = p.contatti;
  const corpo = `<main>
  ${eroePagina(p.eroe, sito)}
  <div class="corpo">
    ${sedeConFoto(p.sede, sito, { id: 'sede' })}
    <section class="sezione funziona" id="scrivici">
      <div class="funziona__testo">
        <h2 class="titolo">${t(c.titolo)}</h2>
        <p class="testo">${t(c.testo)}</p>
        <ul class="contatti">
          ${c.voci.map((v) => {
            const fuori = /^https?:/.test(v.link) ? ' target="_blank" rel="noopener"' : '';
            return `<li><a href="${esc(v.link)}"${fuori}><span class="contatti__nome">${esc(v.titolo)}</span> <span class="contatti__valore">${esc(v.testo)}</span>${icona.freccia}</a></li>`;
          }).join('\n          ')}
        </ul>
      </div>
      <div class="pannello">
        ${modulo(c.modulo, { tipo: 'contatto', turnstile: risorse.turnstile })}
      </div>
    </section>
  </div>
</main>`;
  const d = sito.dominio;
  const dati = [
    ...datiBase(sito, p.meta),
    { '@context': 'https://schema.org', '@type': 'ContactPage', name: p.eroe.titolo, url: `${d}/dove-siamo/`, about: { '@id': `${d}/#sede` }, isPartOf: { '@id': `${d}/#sito` } },
  ];
  return pagina({ sito, meta: p.meta, percorso: '/dove-siamo/', corpo, risorse, anteprima, dati, classe: 'pagina-dove-siamo' });
}
