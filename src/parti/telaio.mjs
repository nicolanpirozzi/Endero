// Il telaio di ogni pagina: intestazione HTML, testata, piè di pagina, pillola fissa.
import { esc, t, piano, logo, foglioSimboli, icona } from './base.mjs';

/**
 * La testata: scritta a sinistra; a destra Collezione e Rivenditori (solo su computer), l'azione principale
 * e, sul telefono, il pulsante Menu. Senza JavaScript "Menu" è un link al piè di pagina, che ha le stesse voci.
 * @param {object} azione  { testo, breve, href }: l'azione principale della pagina (di solito la presa misure)
 */
export function testata(sito, azione = {}) {
  const s = sito.testata;
  const testo = azione.testo || s.prenota;
  const breve = azione.breve ?? (azione.testo ? '' : s.prenota_breve);
  const href = azione.href || s.prenota_link;
  // sul telefono si legge solo la parola breve; il resto resta per i lettori di schermo
  const etichetta = breve && testo.startsWith(breve)
    ? `<span>${esc(breve)}<span class="testata__resto">${esc(testo.slice(breve.length))}</span></span>`
    : esc(testo);
  return `<header class="testata" data-testata>
  <a class="testata__marchio" href="/" aria-label="${esc(s.home)}">${logo('scritta')}</a>
  <nav class="testata__azioni" aria-label="Azioni principali">
    <a class="pillola pillola--vetro testata__secondaria" href="/collezione/">${esc(s.collezione)}</a>
    <a class="pillola pillola--vetro testata__secondaria" href="/diventa-rivenditore/">${esc(s.rivenditori)}</a>
    <a class="pillola pillola--chiara testata__principale" href="${esc(href)}">${etichetta}</a>
    <a class="pillola pillola--vetro testata__menu" href="#dove-siamo" data-menu-apri>${esc(s.menu)}</a>
  </nav>
</header>`;
}

/** Il pannello del menu sul telefono: si apre solo con lo script (src/sito.js), altrimenti resta chiuso. */
export function menu(sito, percorso = "") {
  const m = sito.menu;
  const fuori = (link) => (/^https?:/.test(link) ? ' target="_blank" rel="noopener"' : '');
  return `<dialog class="menu" id="menu" aria-label="${esc(m.etichetta)}" data-menu>
  <div class="menu__testa">
    <a class="testata__marchio" href="/" aria-label="${esc(sito.testata.home)}">${logo('scritta')}</a>
    <button class="pillola pillola--vetro menu__chiudi" type="button" data-menu-chiudi autofocus aria-label="${esc(sito.testata.menu_chiudi)}">${esc(m.chiudi || 'Chiudi')}</button>
  </div>
  <nav class="menu__corpo" aria-label="${esc(m.etichetta)}">
    <ul class="menu__voci">
      ${m.voci.map((v) => `<li><a href="${esc(v.link)}"${v.link === percorso ? ' aria-current="page"' : ''}>${esc(v.testo)}</a></li>`).join('\n      ')}
    </ul>
  </nav>
  <ul class="menu__contatti">
    ${m.contatti.map((v) => `<li><a href="${esc(v.link)}"${fuori(v.link)}>${esc(v.testo)}</a></li>`).join('\n    ')}
  </ul>
</dialog>`;
}

export function pillolaFissa(sito) {
  return `<a class="pillola pillola--blu pillola-fissa" data-pillola-fissa href="${esc(sito.contatti.whatsapp_link)}" target="_blank" rel="noopener">${esc(sito.pillola_fissa)}</a>`;
}

export function piede(sito, percorso = "") {
  const p = sito.piede;
  const colonne = p.colonne.map((c) => `<div class="piede__colonna">
      <h2 class="nascosto">${esc(c.titolo)}</h2>
      <ul>${c.voci.map((v) => {
        const fuori = /^https?:/.test(v.link) ? ' target="_blank" rel="noopener"' : '';
        return `<li><a href="${esc(v.link)}"${fuori}${v.link === percorso ? ' aria-current="page"' : ''}>${esc(v.testo)}</a></li>`;
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
 * @param {object} o.azione     azione principale della testata { testo, breve, href }; di solito la presa misure
 * @param {boolean} o.servizio  pagina di servizio (404, conferma): senza indirizzo canonico
 */
export function pagina({ sito, meta, percorso, corpo, risorse, dati = [], anteprima = true, classe = '', azione, servizio = false }) {
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
${testata(sito, azione)}
${corpo}
${piede(sito, percorso)}
${pillolaFissa(sito)}
${menu(sito, percorso)}
${foglioSimboli()}
${risorse.js.map((h) => `<script type="module" src="${h}"></script>`).join('\n')}
</body>
</html>
`;
}
