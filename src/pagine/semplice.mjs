// Pagine brevi di servizio (conferma del modulo, pagina non trovata): un titolo, un testo, un invito.
import { esc, t } from '../parti/base.mjs';
import { pagina } from '../parti/telaio.mjs';

export default function semplice({ sito, testi, percorso, risorse }) {
  const corpo = `<main class="semplice" id="contenuto" tabindex="-1">
  <h1 class="titolo">${t(testi.titolo)}</h1>
  <p class="testo">${t(testi.testo)}</p>
  <a class="pillola pillola--blu pillola--grande" href="${esc(testi.invito.href)}">${esc(testi.invito.testo)}</a>
</main>`;
  // pagine di servizio: mai indicizzate
  return pagina({ sito, meta: testi.meta, percorso, corpo, risorse, anteprima: true, servizio: true, classe: 'pagina-chiara pagina-semplice' });
}
