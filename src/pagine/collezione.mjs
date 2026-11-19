// Pagina /collezione/: il lookbook, cioè le foto vere dei capi divise per tipo, e sotto (quando arriveranno con
// nome e prezzo in contenuti/it/prodotti.json) i capi, ognuno con la sua pagina. Niente carrello: si chiede su WhatsApp.
import { esc, t, piano, attesa, fotoIntera, fotoGrande, icona, euro, indirizzoCapo } from '../parti/base.mjs';
import { pagina } from '../parti/telaio.mjs';
import { eroePagina, intesta, datiBase } from '../parti/sezioni.mjs';

export { euro, indirizzoCapo };

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

/**
 * Il lookbook. Senza script è già tutto lì: i tasti del filtro sono link alle quattro parti della pagina e ogni foto
 * è un link alla sua versione grande. Lo script (src/sito.js, "lookbook") fa del filtro un filtro vero e apre le
 * foto a tutto schermo nel <dialog> in fondo, con le frecce, il dito e il tasto «Chiedi di questo capo».
 * Ogni foto ha per id il proprio nome: /collezione/#<nome> porta lì e, con lo script, la apre grande.
 */
function lookbook(c, sito) {
  const l = c.lookbook, archivio = sito.foto?.collezione;
  const look = c.look.filter((k) => archivio?.indice?.[k.file]);
  if (!look.length) return '';
  const gruppi = l.tipi.map((tipo) => ({ ...tipo, look: look.filter((k) => k.tipo === tipo.id) })).filter((g) => g.look.length);
  const tasto = (href, filtro, nome, quanti, attivo) => `<li><a class="lookbook__tasto" href="${esc(href)}" data-filtro="${esc(filtro)}"${attivo ? ' aria-current="true"' : ''}>${esc(nome)}<span class="lookbook__quanti">${quanti}</span></a></li>`;
  const voce = (k) => {
    const g = archivio.indice[k.file];
    // la foto grande occupa due colonne: le serve una grandezza in più
    const sizes = k.grande ? '(max-width: 699px) 100vw, (max-width: 959px) 67vw, (max-width: 1299px) 50vw, 40vw' : '(max-width: 699px) 50vw, (max-width: 959px) 34vw, (max-width: 1299px) 25vw, 20vw';
    return `<li class="look${k.grande ? ' look--grande' : ''}" id="${esc(k.file)}">
          <a class="look__link" href="${esc(fotoGrande(k, archivio))}" data-look="${esc(k.file)}" data-v="${g.v.join(',')}" data-webp="${(g.vWebp || g.v).join(',')}" data-forma="${g.forma}">${fotoIntera(k, archivio, { sizes })}</a>
        </li>`;
  };
  const v = l.visore;
  return `<section class="sezione lookbook" id="lookbook" data-lookbook data-cartella="${esc(archivio.cartella)}" data-versione="${esc(archivio.versione || '')}" data-messaggio="${esc(v.messaggio)}" data-whatsapp="${esc(sito.contatti.whatsapp_link)}">
      ${intesta({ titolo: l.titolo, testo: l.testo })}
      <nav class="lookbook__filtro" aria-label="${esc(l.filtro)}">
        <ul>
          ${tasto('#lookbook', '', l.tutti, look.length, true)}
          ${gruppi.map((g) => tasto(`#${g.id}`, g.id, g.nome, g.look.length, false)).join('\n          ')}
        </ul>
      </nav>
      ${gruppi.map((g) => `<section class="lookbook__tipo" id="${esc(g.id)}" data-tipo="${esc(g.id)}" data-nome="${esc(g.nome)}" aria-labelledby="tipo-${esc(g.id)}">
        <h2 class="lookbook__nome" id="tipo-${esc(g.id)}">${esc(g.nome)}</h2>
        <ul class="lookbook__griglia">
        ${g.look.map(voce).join('\n        ')}
        </ul>
      </section>`).join('\n      ')}
    </section>
    <dialog class="visore" id="visore" aria-label="${esc(v.titolo)}" data-lenis-prevent>
      <p class="visore__conta" aria-live="polite" aria-atomic="true"><span class="nascosto">${esc(v.foto)} </span><span data-visore-numero>1</span> ${esc(v.di)} <span data-visore-quanti>${look.length}</span><span class="visore__tipo" data-visore-tipo></span><span class="nascosto" data-visore-descrizione></span></p>
      <button type="button" class="visore__tasto visore__chiudi" data-visore-chiudi aria-label="${esc(v.chiudi)}">${icona.chiudi}</button>
      <figure class="visore__foto" data-visore-foto><picture><source type="image/avif" data-visore-avif><img data-visore-img alt="" decoding="async"></picture></figure>
      <button type="button" class="visore__tasto visore__freccia visore__freccia--prima" data-visore-prima aria-label="${esc(v.prima)}">${icona.sinistra}</button>
      <button type="button" class="visore__tasto visore__freccia visore__freccia--dopo" data-visore-dopo aria-label="${esc(v.dopo)}">${icona.destra}</button>
      <a class="pillola pillola--chiara pillola--grande visore__chiedi" data-visore-chiedi href="${esc(sito.contatti.whatsapp_link)}" target="_blank" rel="noopener">${esc(v.chiedi)}</a>
    </dialog>`;
}

export default function paginaCollezione({ sito, testi: c, prodotti, risorse, anteprima }) {
  const corpo = `<main>
  ${eroePagina(c.eroe, sito, { archivio: sito.foto?.collezione })}
  <div class="corpo">
    ${lookbook(c, sito)}
    ${prodotti.length ? `<section class="sezione" id="capi">
      ${intesta(c.elenco)}
      <ul class="capi">
      ${prodotti.map((p) => schedaCapo(p, sito)).join('\n      ')}
      </ul>
    </section>` : ''}
    <section class="sezione">
      ${intesta(c.invito)}
    </section>
  </div>
</main>`;
  const d = sito.dominio;
  const archivio = sito.foto?.collezione;
  const dati = [
    ...datiBase(sito, c.meta),
    {
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: piano(c.eroe.titolo), url: `${d}/collezione/`, isPartOf: { '@id': `${d}/#sito` },
      ...(prodotti.length ? { mainEntity: { '@type': 'ItemList', itemListElement: prodotti.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: d + indirizzoCapo(p), name: p.nome })) } } : {}),
      // le foto del lookbook, per la ricerca per immagini: ognuna con la sua descrizione
      ...(archivio ? { image: c.look.filter((k) => archivio.indice[k.file]).map((k) => ({ '@type': 'ImageObject', contentUrl: d + fotoGrande(k, archivio).split('?')[0], caption: k.alt })) } : {}),
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
