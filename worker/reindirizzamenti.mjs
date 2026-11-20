// Reindirizzamenti permanenti, in un posto solo: il build li scrive in dist/_redirects (sito vero, letto dagli
// "assets" di Cloudflare), il Worker dell'anteprima li applica da sé (lì _redirects non viene caricato)
// e il server locale (build/servi.mjs) fa lo stesso.
export const REINDIRIZZAMENTI = [
  // Vecchi indirizzi del negozio PrestaShop (punto 5 della direzione creativa): quelli della sua mappa del sito,
  // letta il 2026-11-20 (https://www.endero.it/1_it_0_sitemap.xml), più quelli trovati prima nel dossier.
  // Gli indirizzi con "?controller=…" (carrello, pagamenti) non si possono elencare qui: /index.php va alla pagina iniziale.
  ['/2-home', '/'],
  ['/index.php', '/'],
  ['/3-camicia-su-misura', '/camicie-su-misura/'],
  ['/brand/1-camicia-su-misura', '/camicie-su-misura/'],
  ['/home/1-camicione-in-flanella-camicia-su-misura.html', '/collezione/'],
  ['/home/1-43-camicione-in-flanella-camicia-su-misura.html', '/collezione/'],
  ['/best-sellers', '/collezione/'],
  ['/prices-drop', '/collezione/'],
  ['/suppliers', '/diventa-rivenditore/'],
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
