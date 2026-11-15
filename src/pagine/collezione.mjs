// Pagina /collezione/ e una pagina per ogni capo. I capi sono dati (contenuti/it/prodotti.json):
// prezzo, colori, taglie. Il carrello arriverà dopo; per ora si chiede su WhatsApp.
import { esc, t, piano, attesa, icona } from '../parti/base.mjs';
import { pagina } from '../parti/telaio.mjs';
import { eroePagina, intesta, datiBase } from '../parti/sezioni.mjs';

export const euro = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
export const indirizzoCapo = (capo) => `/collezione/${capo.slug}/`;

function foto(src, alt, classe = '') {
  return `<img class="${classe}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
}

function schedaCapo(capo, sito) {
  const immagine = capo.foto?.[0] ? foto(capo.foto[0], capo.nome) : attesa({ nota: capo.nome, etichetta: sito.foto_in_arrivo });
  return `<li class="capo"><a class="capo__link" href="${esc(indirizzoCapo(capo))}">
        <div class="capo__foto">${immagine}${capo.categoria ? `<span class="etichetta">${esc(capo.categoria)}</span>` : ''}</div>
        <p class="capo__nome">${esc(capo.nome)}</p>
        <p class="capo__prezzo">${esc(euro(capo.prezzo))}</p>
      </a></li>`;
}

function capoInAttesa(a, sito) {
  return `<li class="capo"><div class="capo__link">
        <div class="capo__foto">${attesa({ nota: a.foto, etichetta: sito.foto_in_arrivo })}</div>
        <p class="capo__nome">${t(a.nome)}</p>
        <p class="capo__prezzo">${t(a.prezzo)}</p>
      </div></li>`;
}

export default function paginaCollezione({ sito, testi: c, prodotti, risorse, anteprima }) {
  const capi = prodotti.length
    ? prodotti.map((p) => schedaCapo(p, sito))
    : Array.from({ length: c.attesa.quanti }, () => capoInAttesa(c.attesa, sito));
  const corpo = `<main>
  ${eroePagina(c.eroe, sito)}
  <div class="corpo">
    <section class="sezione" id="capi">
      ${intesta(c.elenco)}
      <ul class="capi">
      ${capi.join('\n      ')}
      </ul>
    </section>
    <section class="sezione">
      ${intesta(c.invito)}
    </section>
  </div>
</main>`;
  const d = sito.dominio;
  const dati = [
    ...datiBase(sito, c.meta),
    {
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: piano(c.eroe.titolo), url: `${d}/collezione/`, isPartOf: { '@id': `${d}/#sito` },
      ...(prodotti.length ? { mainEntity: { '@type': 'ItemList', itemListElement: prodotti.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: d + indirizzoCapo(p), name: p.nome })) } } : {}),
    },
  ];
  return pagina({ sito, meta: c.meta, percorso: '/collezione/', corpo, risorse, anteprima, dati, classe: 'pagina-collezione' });
}

/** La pagina di un capo: foto a sinistra, nome, prezzo, colori e taglie a destra. */
export function paginaCapo({ sito, testi: c, capo, risorse, anteprima }) {
  const s = c.scheda;
  const immagini = capo.foto?.length
    ? capo.foto.map((f, i) => `<div class="prodotto__immagine">${foto(f, `${capo.nome}, foto ${i + 1}`)}</div>`).join('')
    : [1, 2].map(() => `<div class="prodotto__immagine">${attesa({ nota: capo.nome, etichetta: sito.foto_in_arrivo })}</div>`).join('');
  const whatsapp = `${sito.contatti.whatsapp_link}?text=${encodeURIComponent(s.messaggio + capo.nome)}`;
  const elenco = (titolo, voci) => (voci?.length ? `<div class="prodotto__voce"><h2 class="vetro__sezione">${esc(titolo)}</h2><ul class="prodotto__scelte">${voci.map((v) => `<li class="chip">${esc(v)}</li>`).join('')}</ul></div>` : '');
  const corpo = `<main class="prodotto" id="contenuto" tabindex="-1">
  <div class="prodotto__foto">${immagini}</div>
  <div class="prodotto__testo">
    <a class="collegamento collegamento--indietro" href="/collezione/">${icona.sinistra}${esc(s.torna)}</a>
    ${capo.categoria ? `<p class="prodotto__categoria">${esc(capo.categoria)}</p>` : ''}
    <h1 class="titolo">${esc(capo.nome)}</h1>
    <p class="prodotto__prezzo">${esc(euro(capo.prezzo))}</p>
    ${capo.descrizione ? `<p class="testo">${esc(capo.descrizione)}</p>` : ''}
    ${elenco(s.colori, capo.colori)}
    ${elenco(s.taglie, capo.taglie)}
    ${capo.su_misura ? `<a class="collegamento" href="/camicie-su-misura/">${esc(s.su_misura)}${icona.freccia}</a>` : ''}
    <a class="pillola pillola--blu pillola--grande prodotto__chiedi" href="${esc(whatsapp)}" target="_blank" rel="noopener">${esc(s.chiedi)}</a>
  </div>
</main>`;
  const d = sito.dominio;
  const meta = {
    titolo: `${capo.nome} · Endero`,
    descrizione: capo.descrizione ? capo.descrizione.slice(0, 155) : `${capo.nome}, ${capo.categoria || 'collezione'} Endero, fatto in Italia.`,
    immagine: capo.foto?.[0] || '/film/manifesto.jpg',
    immagine_alt: capo.nome,
  };
  // senza carrello niente offerta per Google: il prezzo si legge nella pagina
  const dati = [
    ...datiBase(sito, c.meta),
    {
      '@context': 'https://schema.org', '@type': 'Product', name: capo.nome, url: d + indirizzoCapo(capo),
      ...(capo.descrizione ? { description: capo.descrizione } : {}),
      ...(capo.foto?.length ? { image: capo.foto.map((f) => d + f) } : {}),
      ...(capo.categoria ? { category: capo.categoria } : {}),
      brand: { '@type': 'Brand', name: sito.nome },
    },
  ];
  return pagina({ sito, meta, percorso: indirizzoCapo(capo), corpo, risorse, anteprima, dati, classe: 'pagina-chiara pagina-capo' });
}
