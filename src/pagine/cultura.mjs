// Pagina /cultura-e-artigianato/: prende il posto di /storia/ (punto 10 della direzione creativa).
// Gli stessi capitoli della pagina iniziale, qui a foto e testo alternati; il nastro dei fatti, fermo,
// con il richiamo ai rivenditori sotto "2.500 negozi serviti".
import { esc, t, attesa } from '../parti/base.mjs';
import { pagina } from '../parti/telaio.mjs';
import { eroePagina, intesta, nastroFermo, chiusura, datiBase } from '../parti/sezioni.mjs';

export const PERCORSO = '/cultura-e-artigianato/';

export default function paginaCultura({ sito, testi: c, nastro, richiamo, risorse, anteprima }) {
  const capitoli = c.capitoli.map((k) => `<article class="capitolo">
      <div class="capitolo__foto">${attesa({ nota: k.foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}</div>
      <div class="capitolo__testo">
        <p class="capitolo__etichetta">${esc(k.etichetta)}</p>
        <h2 class="titolo">${t(k.titolo)}</h2>
        <p class="testo">${t(k.testo)}</p>
      </div>
    </article>`).join('\n    ');
  const corpo = `<main>
  ${eroePagina(c.eroe, sito)}
  ${nastroFermo(nastro, { dopo: c.fatti.richiamo_dopo, testo: richiamo.testo, href: richiamo.href })}
  <div class="corpo">
    <section class="sezione">
      ${intesta(c.introduzione)}
    </section>
    <section class="capitoli" aria-label="${esc(c.introduzione.titolo)}">
    ${capitoli}
    </section>
    ${chiusura(c.chiusura, sito, { href: sito.testata.prenota_link })}
  </div>
</main>`;
  const d = sito.dominio;
  const dati = [
    ...datiBase(sito, c.meta),
    { '@context': 'https://schema.org', '@type': 'AboutPage', name: c.eroe.titolo, url: d + PERCORSO, about: { '@id': `${d}/#organizzazione` }, isPartOf: { '@id': `${d}/#sito` } },
  ];
  return pagina({ sito, meta: c.meta, percorso: PERCORSO, corpo, risorse, anteprima, dati, classe: 'pagina-cultura' });
}
