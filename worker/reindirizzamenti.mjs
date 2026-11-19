// Reindirizzamenti permanenti, in un posto solo: il build li scrive in dist/_redirects (sito vero, letto dagli
// "assets" di Cloudflare), il Worker dell'anteprima li applica da sé (lì _redirects non viene caricato)
// e il server locale (build/servi.mjs) fa lo stesso.
export const REINDIRIZZAMENTI = [
  // vecchi indirizzi del negozio PrestaShop (punto 5 della direzione creativa)
  ['/2-home', '/'],
  ['/3-camicia-su-misura', '/camicie-su-misura/'],
  ['/home/1-43-camicione-in-flanella-camicia-su-misura.html', '/collezione/'],
  ['/contact-us', '/dove-siamo/'],
  // la storia è diventata Cultura e artigianato (punto 10) e poi Chi siamo: il fondatore ha già visto i vecchi indirizzi
  ['/storia/', '/chi-siamo/'],
  ['/storia', '/chi-siamo/'],
  ['/cultura-e-artigianato/', '/chi-siamo/'],
  ['/cultura-e-artigianato', '/chi-siamo/'],
];

/** Dove porta un percorso, oppure null. La ricerca (?…) resta attaccata. */
export function destinazione(url) {
  const u = new URL(url);
  const voce = REINDIRIZZAMENTI.find(([da]) => da === u.pathname);
  return voce ? new URL(voce[1] + u.search, u.origin).toString() : null;
}

/** Il file _redirects di Cloudflare. */
export const fileRedirects = () => REINDIRIZZAMENTI.map(([da, a]) => `${da} ${a} 301`).join('\n') + '\n';
