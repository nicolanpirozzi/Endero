// Il telaio di ogni pagina: intestazione HTML, testata, piè di pagina, pillola fissa.
import { esc, t, piano, logo, foglioSimboli, icona } from './base.mjs';

export function testata(sito, prenota = '/camicie-su-misura/#prenota') {
  const s = sito.testata;
  return `<header class="testata" data-testata>
  <a class="testata__marchio" href="/" aria-label="${esc(s.home)}">${logo('scritta')}</a>
  <nav class="testata__azioni" aria-label="Azioni principali">
    <a class="pillola pillola--chiara" href="${esc(prenota)}">${esc(s.prenota)}</a>
    <a class="pillola pillola--vetro testata__secondaria" href="/collezione/">${esc(s.collezione)}</a>
  </nav>
</header>`;
}

export function pillolaFissa(sito) {
  return `<a class="pillola pillola--blu pillola-fissa" data-pillola-fissa href="${esc(sito.contatti.whatsapp_link)}" target="_blank" rel="noopener">${esc(sito.pillola_fissa)}</a>`;
}

export function piede(sito) {
  const p = sito.piede;
  const colonne = p.colonne.map((c) => `<div class="piede__colonna">
      <h2 class="nascosto">${esc(c.titolo)}</h2>
      <ul>${c.voci.map((v) => {
        const fuori = /^https?:/.test(v.link) ? ' target="_blank" rel="noopener"' : '';
        return `<li><a href="${esc(v.link)}"${fuori}>${esc(v.testo)}</a></li>`;
      }).join('')}</ul>
    </div>`).join('\n    ');
  const s = p.sede;
  return `<footer class="piede" id="dove-siamo" data-gruppo="dove-siamo">
  <a class="piede__marchio" href="/" aria-label="${esc(sito.testata.home)}">${logo('completo')}</a>
  <div class="piede__colonne">
    <nav class="piede__link" aria-label="Collegamenti del sito">
    ${colonne}
    </nav>
    <div class="piede__colonna piede__sede">
      <h2 class="nascosto">${esc(s.titolo)}</h2>
      <address>${s.righe.map((r) => `<span>${esc(r)}</span>`).join(' ')}</address>
      <p>${t(s.orari)}</p>
      <a href="${esc(sito.contatti.mappa)}" target="_blank" rel="noopener">${esc(s.indicazioni)}${icona.freccia}</a>
    </div>
  </div>
  <div class="piede__fondo">
    <p>${t(p.legale)}</p>
  </div>
</footer>`;
}

/**
 * La pagina intera.
 * @param {object} o
 * @param {object} o.sito       testi comuni
 * @param {object} o.meta       { titolo, descrizione, immagine, immagine_alt }
 * @param {string} o.percorso   indirizzo della pagina, per esempio "/"
 * @param {string} o.corpo      HTML del contenuto, tra testata e piè di pagina
 * @param {object} o.risorse    { css: [], js: [], precarica: [] } percorsi già con l'impronta
 * @param {object[]} o.dati     dati strutturati JSON-LD
 * @param {boolean} o.anteprima se vero, la pagina non va indicizzata
 * @param {string} o.classe     classe del <body>; `pagina-chiara` per le pagine senza foto in cima
 * @param {string} o.prenota    dove porta "Prenota la presa misure" nella testata
 * @param {boolean} o.servizio  pagina di servizio (404, conferma): senza indirizzo canonico
 */
export function pagina({ sito, meta, percorso, corpo, risorse, dati = [], anteprima = true, classe = '', prenota, servizio = false }) {
  const url = sito.dominio + percorso;
  // in anteprima la scheda del link punta all'indirizzo provvisorio, così immagine e titolo si vedono; canonical resta su endero.it
  const origine = (anteprima && risorse.origineAnteprima) || sito.dominio;
  const immagine = meta.immagine ? origine + meta.immagine : '';
  const ld = dati.length
    ? `<script type="application/ld+json">${JSON.stringify(dati.length === 1 ? dati[0] : { '@context': 'https://schema.org', '@graph': dati.map(({ '@context': _, ...d }) => d) }).replace(/</g, '\\u003c')}</script>`
    : '';
  return `<!doctype html>
<html lang="${esc(sito.lingua)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<script>document.documentElement.classList.add('js')</script>
<title>${esc(piano(meta.titolo))}</title>
<meta name="description" content="${esc(piano(meta.descrizione))}">
${anteprima ? '<meta name="robots" content="noindex, nofollow">\n' : ''}${servizio ? '' : `<link rel="canonical" href="${esc(url)}">
<link rel="alternate" hreflang="it" href="${esc(url)}">
<link rel="alternate" hreflang="x-default" href="${esc(url)}">`}
<meta name="theme-color" content="#0a1b45">
<meta property="og:type" content="website">
<meta property="og:locale" content="it_IT">
<meta property="og:site_name" content="${esc(sito.nome)}">
<meta property="og:title" content="${esc(piano(meta.titolo))}">
<meta property="og:description" content="${esc(piano(meta.descrizione))}">
${servizio ? '' : `<meta property="og:url" content="${esc(origine + percorso)}">`}
${immagine ? `<meta property="og:image" content="${esc(immagine)}">
<meta property="og:image:alt" content="${esc(meta.immagine_alt || '')}">
<meta name="twitter:card" content="summary_large_image">
` : ''}<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/font/archivo-var.woff2" as="font" type="font/woff2" crossorigin>
${(risorse.precarica || []).join('\n')}
${risorse.css.map((h) => `<link rel="stylesheet" href="${h}">`).join('\n')}
${ld}
</head>
<body class="${esc(classe)}">
<a class="salta-al-contenuto" href="#contenuto">Vai al contenuto</a>
${testata(sito, prenota)}
${corpo}
${piede(sito)}
${pillolaFissa(sito)}
${foglioSimboli()}
${risorse.js.map((h) => `<script type="module" src="${h}"></script>`).join('\n')}
</body>
</html>
`;
}
