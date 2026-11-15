// Pagina /camicie-su-misura/: la camicia su misura, la presa misure, la prenotazione.
// Riusa le sezioni approvate della pagina iniziale; i testi comuni vengono da home.json.
import { piano } from '../parti/base.mjs';
import { pagina } from '../parti/telaio.mjs';
import { eroePagina, suMisura, presaMisure, comeFunziona, domande, prezzo, datiBase } from '../parti/sezioni.mjs';

const daConfermare = (s) => /\[\[/.test(s);

export default function paginaSuMisura({ sito, testi: p, home: h, risorse, anteprima }) {
  const griglia = { ...h.su_misura, ...p.dettagli, link: null, griglia: h.su_misura.griglia.slice(0, p.dettagli.griglia_quante) };
  const corpo = `<main>
  ${eroePagina(p.eroe, sito)}
  <div class="corpo">
    ${suMisura(griglia, sito, { id: 'dettagli', gruppo: '' })}
    ${presaMisure(h.presa_misure, sito, { gruppo: '' })}
    ${comeFunziona(h.come_funziona, risorse.turnstile, { gruppo: '' })}
    ${domande(h.domande, { gruppo: '' })}
    ${prezzo(h.prezzo, sito, { gruppo: '' })}
  </div>
</main>`;
  const d = sito.dominio;
  const url = `${d}/camicie-su-misura/`;
  // nelle domande per Google entrano solo le risposte già confermate
  const confermate = h.domande.voci.filter((v) => !daConfermare(v.domanda) && !daConfermare(v.risposta));
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
  return pagina({ sito, meta: p.meta, percorso: '/camicie-su-misura/', corpo, risorse, anteprima, dati, classe: 'pagina-su-misura', prenota: '#prenota' });
}
