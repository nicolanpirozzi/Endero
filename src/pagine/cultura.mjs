// Pagina /cultura-e-artigianato/: prende il posto di /storia/ (punto 10 della direzione creativa).
// Gli stessi capitoli della pagina iniziale, qui a foto e testo alternati; il nastro dei fatti, fermo,
// con il richiamo ai rivenditori sotto "2.500 negozi serviti".
import { esc, t, attesa, foto } from '../parti/base.mjs';
import { pagina } from '../parti/telaio.mjs';
import { eroePagina, intesta, nastroFermo, chiusura, datiBase } from '../parti/sezioni.mjs';

export const PERCORSO = '/cultura-e-artigianato/';

export default function paginaCultura({ sito, testi: c, nastro, richiamo, risorse, anteprima }) {
  // la foto che fa da apertura alla pagina non si ripete tra i capitoli; i numeri si contano su quelli che restano.
  // Qui il riquadro è sempre orizzontale (quattro per tre), anche sul telefono: basta il ritaglio orizzontale
  const visti = c.capitoli.filter((k) => !(k.immagine && c.eroe.immagine && k.immagine.file === c.eroe.immagine.file));
  const capitoli = visti.map((k, i) => `<article class="capitolo">
      <div class="capitolo__foto">${foto(k.immagine, sito.foto?.artigianato, { sizes: '(max-width: 899px) 100vw, 55vw', verticale: false }) || attesa({ nota: k.foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}</div>
      <div class="capitolo__testo">
        <p class="capitolo__etichetta">${String(i + 1).padStart(2, '0')}</p>
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
