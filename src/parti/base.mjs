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
};
