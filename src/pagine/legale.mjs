// Pagine /privacy/ e /cookie/: testo semplice, ben leggibile. Bozze da far validare prima della messa online.
import { t, tConLink } from '../parti/base.mjs';
import { pagina } from '../parti/telaio.mjs';

export default function paginaLegale({ sito, testi: l, quale, risorse, anteprima }) {
  const p = l[quale];
  const sezioni = p.sezioni.map((s) => `<section>
      <h2>${t(s.titolo)}</h2>
      ${(s.paragrafi || []).map((x) => `<p>${tConLink(x)}</p>`).join('\n      ')}
      ${s.elenco ? `<ul>${s.elenco.map((x) => `<li>${t(x)}</li>`).join('')}</ul>` : ''}
    </section>`).join('\n    ');
  const corpo = `<main class="legale" id="contenuto" tabindex="-1">
  <header class="legale__testa">
    <h1 class="titolo">${t(p.titolo)}</h1>
    <p class="legale__avviso">${t(l.avviso)}</p>
  </header>
  <div class="legale__testo">
    ${sezioni}
    <p class="legale__data">${t(l.aggiornamento)}</p>
  </div>
</main>`;
  return pagina({ sito, meta: p.meta, percorso: `/${quale}/`, corpo, risorse, anteprima, classe: 'pagina-chiara pagina-legale' });
}
