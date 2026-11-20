// Pagina /camicie-su-misura/: tutto il su misura, con i testi suoi (contenuti/it/su-misura.json).
// In cima l'ingresso al configuratore, spento finché la sua pagina non esiste (configuratore.attivo).
import { esc, piano } from '../parti/base.mjs';
import { pagina, briciola } from '../parti/telaio.mjs';
import { eroePagina, intesta, suMisura, presaMisure, comeFunziona, domande, prezzo, datiBase } from '../parti/sezioni.mjs';

const daConfermare = (s) => /\[\[/.test(s);

/** L'ingresso al configuratore: titolo, una riga e la pillola. Si vede solo con configuratore.attivo. */
function ingressoConfiguratore(c) {
  if (!c?.attivo) return '';
  return `<section class="sezione ingresso" id="configuratore">
      ${intesta({ titolo: c.titolo, testo: c.testo })}
      <p class="ingresso__azione"><a class="pillola pillola--blu pillola--grande" href="${esc(c.href)}">${esc(c.invito)}</a></p>
    </section>`;
}

export default function paginaSuMisura({ sito, testi: p, risorse, anteprima }) {
  const corpo = `<main>
  ${eroePagina(p.eroe, sito, { archivio: sito.foto?.sede })}
  <div class="corpo">
    ${ingressoConfiguratore(p.configuratore)}
    ${suMisura(p.dettagli, sito, { id: 'dettagli', gruppo: '' })}
    ${presaMisure(p.presa_misure, sito, { gruppo: '' })}
    ${comeFunziona(p.come_funziona, risorse.turnstile, { gruppo: '' })}
    ${domande(p.domande, { gruppo: '' })}
    ${prezzo(p.prezzo, sito, { gruppo: '' })}
  </div>
</main>`;
  const d = sito.dominio;
  const url = `${d}/camicie-su-misura/`;
  // nelle domande per Google entrano solo le risposte già confermate
  const confermate = p.domande.voci.filter((v) => !daConfermare(v.domanda) && !daConfermare(v.risposta));
  const dati = [
    ...datiBase(sito, p.meta),
    {
      '@context': 'https://schema.org', '@type': 'Service', '@id': `${url}#servizio`,
      name: p.servizio.nome, serviceType: p.servizio.nome, description: piano(p.servizio.descrizione), url,
      provider: { '@id': `${d}/#sede` }, areaServed: { '@type': 'City', name: sito.contatti.citta },
    },
    ...(confermate.length ? [{
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: confermate.map((v) => ({ '@type': 'Question', name: v.domanda, acceptedAnswer: { '@type': 'Answer', text: v.risposta } })),
    }] : []),
  ];
  return pagina({ sito, meta: p.meta, percorso: '/camicie-su-misura/', corpo, risorse, anteprima, dati, classe: 'pagina-su-misura', briciole: [briciola(sito, '/camicie-su-misura/')] });
}
