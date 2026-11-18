// Mattoni comuni dei modelli di pagina. Ogni modello è una funzione che riceve i testi e restituisce HTML.
import { readFileSync } from 'node:fs';

const RADICE = new URL('../../', import.meta.url);

/** Testo sicuro dentro l'HTML. */
export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Testo dei file di contenuto: le parti tra [[ ]] sono segnaposto da confermare e si vedono come tali. */
export function t(v) {
  return esc(v).replace(/\[\[(.+?)\]\]/g, '<span class="da-confermare">$1</span>');
}

/** Come `t`, ma lascia passare i collegamenti già scritti nei contenuti (solo <a href>). */
export function tConLink(v) {
  return t(v)
    .replace(/&lt;a href=&quot;((?:[^&"]|&amp;)+)&quot;&gt;/g, '<a href="$1">')
    .replace(/&lt;\/a&gt;/g, '</a>');
}

/** Toglie i segnaposto, per i testi che non si vedono (title, description, dati strutturati). */
export function piano(v) {
  return String(v ?? '').replace(/\[\[(.+?)\]\]/g, '$1');
}

/** Il segnaposto di una foto o di un video che deve ancora arrivare. Mai immagini di repertorio o generate. */
export function attesa({ nota, tipo = 'foto', tono = 'chiaro', classe = '', etichetta = 'Foto in arrivo' }) {
  return `<div class="attesa attesa--${tono} ${classe}" role="img" aria-label="${esc(`${etichetta}: ${nota}`)}">
    <span class="attesa__nota"><span class="attesa__tipo">${esc(etichetta)}</span>${esc(nota)}</span>
  </div>`;
}

/**
 * Una foto vera di Endero, compressa da tools/comprimi-foto.py: il ritaglio orizzontale per gli schermi larghi e
 * quello verticale per il telefono tenuto in piedi, ognuno in più grandezze, in AVIF e in WebP.
 * @param {object} f        dal JSON dei testi: { file: 'coppole', alt, fuoco: 'alto' (se nel riquadro largo va tenuta la parte alta) }
 * @param {object} archivio { cartella, indice, versione }: lo prepara il build da public/foto/<cartella>/foto.json
 * @param {object} o        sizes: quanto è larga sullo schermo; verticale: usa anche il ritaglio verticale; pigra: si carica quando serve
 */
export function foto(f, archivio, { sizes = '100vw', verticale = true, pigra = true } = {}) {
  const g = archivio?.indice?.[f?.file];
  if (!g) return '';
  const v = archivio.versione ? `?v=${archivio.versione}` : '';
  const serie = (verso, tipo) => g[verso].map((w) => `${archivio.cartella}${f.file}-${verso}-${w}.${tipo}${v} ${w}w`).join(', ');
  const media = g.o[Math.min(1, g.o.length - 1)];
  const fonti = [];
  if (verticale && g.v) for (const tipo of ['avif', 'webp']) fonti.push(`<source media="(max-width: 699px) and (orientation: portrait)" type="image/${tipo}" srcset="${esc(serie('v', tipo))}" sizes="100vw">`);
  fonti.push(`<source type="image/avif" srcset="${esc(serie('o', 'avif'))}" sizes="${esc(sizes)}">`);
  return `<picture class="foto"${f.fuoco ? ` data-fuoco="${esc(f.fuoco)}"` : ''}>${fonti.join('')}<img src="${archivio.cartella}${f.file}-o-${media}.webp${v}" srcset="${esc(serie('o', 'webp'))}" sizes="${esc(sizes)}" width="${media}" height="${Math.round(media / 1.5)}" alt="${esc(f.alt)}"${pigra ? ' loading="lazy"' : ' fetchpriority="high"'} decoding="async"></picture>`;
}

/** Disegno vettoriale del logo, preso dal foglio di simboli in fondo alla pagina. */
export function logo(quale, { classe = '', etichetta = '' } = {}) {
  const viste = { scritta: '0 0 207.8 38.5', completo: '0 0 207.8 119.3', simbolo: '0 0 89.3 58.3' };
  const accessibile = etichetta ? `role="img" aria-label="${esc(etichetta)}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="${classe}" viewBox="${viste[quale]}" ${accessibile}><use href="#endero-${quale}"/></svg>`;
}

/** Foglio di simboli con i tre logo, da mettere una volta per pagina. Le cifre si arrotondano per alleggerire. */
export function foglioSimboli() {
  const simboli = ['scritta', 'completo', 'simbolo'].map((nome) => {
    const svg = readFileSync(new URL(`brand/logo/endero-${nome}.svg`, RADICE), 'utf8');
    const vista = svg.match(/viewBox="([^"]+)"/)[1];
    const d = svg.match(/ d="([^"]+)"/)[1].replace(/(\d+\.\d)\d+/g, '$1');
    return `<symbol id="endero-${nome}" viewBox="${vista}"><path fill="currentColor" fill-rule="evenodd" d="${d}"/></symbol>`;
  });
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${simboli.join('')}</defs></svg>`;
}

/** Piccole icone a tratto, disegnate qui. */
export const icona = {
  giu: '<svg class="icona" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sinistra: '<svg class="icona" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M10 3.5L5.5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  destra: '<svg class="icona" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  freccia: '<svg class="icona" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4.5 11.5l7-7M6 4.5h5.5V10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // testata: la collezione, i rivenditori e la camicia su misura
  gruccia: '<svg class="icona" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6.4 3.6a1.6 1.6 0 1 1 2.4 1.4c-.5.3-.8.6-.8 1.1v.4M8 6.5l-6 4.4c-.5.4-.3 1.2.4 1.2h11.2c.7 0 .9-.8.4-1.2L8 6.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  vetrina: '<svg class="icona" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2.8 2.5h10.4L14.5 6a1.63 1.63 0 0 1-3.25 0 1.63 1.63 0 0 1-3.25 0 1.63 1.63 0 0 1-3.25 0A1.63 1.63 0 0 1 1.5 6l1.3-3.5zM2.6 8.2v5.3h10.8V8.2M6.6 13.5v-3.3h2.8v3.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  camicia: '<svg class="icona" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5.6 2.2l-2.4.9-1.6 3.5 2.1 1 .9-1.3v7.5h6.8V6.3l.9 1.3 2.1-1-1.6-3.5-2.4-.9L8 4.6 5.6 2.2zM8 4.6v8.9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // finestra "La tua camicia": le due strade
  schermo: '<svg class="icona" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 2.8h10a1 1 0 0 1 1 1v6.4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.8a1 1 0 0 1 1-1zM5.5 13.5h5M8 11.2v2.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  metro: '<svg class="icona" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6.5 12.5a4.5 4.5 0 1 1 4.5-4.5v4.5H6.5zM6.5 9.3a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6zM11 12.5h3.5V10M12.6 12.5v-1.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chiudi: '<svg class="icona" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};

/** Prezzo in euro, all'italiana: 60 → "60,00 €". */
export const euro = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

/** Indirizzo della pagina di un capo della collezione. */
export const indirizzoCapo = (capo) => `/collezione/${capo.slug}/`;
