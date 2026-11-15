// Pagina /storia/: solo i fatti confermati dal proprietario, un capitolo per fatto.
import { esc, t, attesa } from '../parti/base.mjs';
import { pagina } from '../parti/telaio.mjs';
import { eroePagina, intesta, nastro, datiBase } from '../parti/sezioni.mjs';

export default function paginaStoria({ sito, testi: s, home: h, risorse, anteprima }) {
  const capitoli = s.capitoli.map((c) => `<article class="capitolo">
      <div class="capitolo__foto">${attesa({ nota: c.foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}</div>
      <div class="capitolo__testo">
        <p class="capitolo__etichetta">${esc(c.etichetta)}</p>
        <h2 class="titolo">${t(c.titolo)}</h2>
        <p class="testo">${t(c.testo)}</p>
      </div>
    </article>`).join('\n    ');
  const ch = s.chiusura;
  const corpo = `<main>
  ${eroePagina(s.eroe, sito)}
  ${nastro(h.nastro)}
  <div class="corpo">
    <section class="sezione">
      ${intesta(s.introduzione)}
    </section>
    <section class="capitoli">
    ${capitoli}
    </section>
    <section class="sezione chiusura">
      ${intesta(ch)}
      <div class="chiusura__azioni">
        <a class="pillola pillola--blu pillola--grande" href="/camicie-su-misura/#prenota">${esc(ch.prenota)}</a>
        <a class="pillola pillola--grigia pillola--grande" href="${esc(sito.contatti.whatsapp_link)}" target="_blank" rel="noopener">${esc(ch.whatsapp)}</a>
      </div>
    </section>
  </div>
</main>`;
  const d = sito.dominio;
  const dati = [
    ...datiBase(sito, s.meta),
    { '@context': 'https://schema.org', '@type': 'AboutPage', name: s.eroe.titolo, url: `${d}/storia/`, about: { '@id': `${d}/#organizzazione` }, isPartOf: { '@id': `${d}/#sito` } },
  ];
  return pagina({ sito, meta: s.meta, percorso: '/storia/', corpo, risorse, anteprima, dati, classe: 'pagina-storia' });
}
