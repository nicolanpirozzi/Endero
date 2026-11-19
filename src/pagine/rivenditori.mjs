// Pagina /diventa-rivenditore/ (punto 9 della direzione creativa): per chi compra da Endero per rivendere.
// Dal 2026-11-19 le strade sono due, "Rivenditore Endero" e "Conto terzi" (proprietario); il su misura per i clienti
// del negozio resta come servizio in più. Una pagina sola: le due strade in cima, poi un capitolo per strada e uno
// per il su misura, come funziona con il modulo, domande, chiusura. Il link "Fai richiesta" di ogni capitolo porta
// al modulo con la sua voce già segnata (src/sito.js, "interesse").
import { esc, t, piano, attesa, icona } from '../parti/base.mjs';
import { pagina } from '../parti/telaio.mjs';
import { eroePagina, nastro, strade, comeFunziona, domande, chiusura, datiBase } from '../parti/sezioni.mjs';

export const PERCORSO = '/diventa-rivenditore/';

/** I loghi dei negozi clienti, quando arrivano (loghi.voci: { nome, file }): stessa fascia del nastro. */
function loghi(l) {
  const giro = (nascosto) => l.voci.map((v) => `<li${nascosto ? ' aria-hidden="true"' : ''}><img src="${esc(v.file)}" alt="${nascosto ? '' : esc(v.nome)}" height="20" loading="lazy"></li>`).join('');
  return `<section class="nastro nastro--loghi" aria-label="${esc(l.etichetta)}">
    <ul class="nastro__binario">${giro(false)}${giro(true)}${giro(true)}</ul>
  </section>`;
}

export default function paginaRivenditori({ sito, testi: r, nastro: fatti, risorse, anteprima }) {
  const capitoli = r.capitoli.map((c) => `<article class="capitolo" id="${esc(c.id)}">
      <div class="capitolo__foto">${attesa({ nota: c.foto, tono: 'scuro', etichetta: sito.foto_in_arrivo })}</div>
      <div class="capitolo__testo">
        <p class="capitolo__etichetta">${esc(c.etichetta)}</p>
        <h2 class="titolo">${t(c.titolo)}</h2>
        <p class="testo">${t(c.testo)}</p>
        <a class="collegamento" href="#richiesta"${c.interesse ? ` data-interesse="${esc(c.interesse)}"` : ''}>${esc(r.capitolo_invito)}${icona.freccia}</a>
      </div>
    </article>`).join('\n    ');
  const corpo = `<main>
  ${eroePagina(r.eroe, sito)}
  ${r.loghi.voci.length ? loghi(r.loghi) : nastro(fatti)}
  <div class="corpo">
    ${strade(r.offerta, r.strade, sito, { id: 'offerta' })}
    <section class="capitoli capitoli--rivenditori" aria-label="${esc(piano(r.offerta.titolo))}">
    ${capitoli}
    </section>
    ${comeFunziona({ ...r.come_funziona, modulo: r.modulo }, risorse.turnstile, { gruppo: '', tipo: 'rivenditore', ancora: 'richiesta' })}
    ${domande(r.domande, { gruppo: '' })}
    ${chiusura(r.chiusura, sito, { href: '#richiesta' })}
  </div>
</main>`;
  const d = sito.dominio;
  const url = d + PERCORSO;
  const dati = [
    ...datiBase(sito, r.meta),
    ...r.servizi.map((s, i) => ({
      '@context': 'https://schema.org', '@type': 'Service', '@id': `${url}#${r.capitoli[i]?.id || 'servizio-' + i}`,
      name: s.nome, serviceType: s.nome, description: piano(s.descrizione), url: `${url}#${r.capitoli[i]?.id || ''}`,
      provider: { '@id': `${d}/#sede` }, audience: { '@type': 'BusinessAudience', audienceType: 'Negozi e marchi di abbigliamento' },
    })),
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: r.domande.voci.filter((v) => !/\[\[/.test(v.domanda + v.risposta)).map((v) => ({ '@type': 'Question', name: v.domanda, acceptedAnswer: { '@type': 'Answer', text: v.risposta } })),
    },
  ];
  return pagina({ sito, meta: r.meta, percorso: PERCORSO, corpo, risorse, anteprima, dati, classe: 'pagina-rivenditori' });
}
