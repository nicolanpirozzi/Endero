// Reindirizzamenti permanenti, in un posto solo: il build li scrive in dist/_redirects (sito vero, letto dagli
// "assets" di Cloudflare), il Worker dell'anteprima li applica da sé (lì _redirects non viene caricato)
// e il server locale (build/servi.mjs) fa lo stesso.
// Ogni voce vale anche con la barra in fondo (/best-sellers e /best-sellers/): la seconda forma si aggiunge da sé.
const VOCI = [
  // Il vecchio negozio PrestaShop (punto 5 della direzione creativa): gli indirizzi della sua mappa del sito, che sul
  // dominio è rimasta (https://www.endero.it/1_it_0_sitemap.xml, letta il 2026-11-20), più quelli trovati nel dossier.
  // Il negozio non c'è più: dal 2026-11-15 su endero.it risponde un altro sito e questi indirizzi danno già "non
  // trovato". Restano qui perché Google e i link in giro li ricordano ancora.
  // Gli indirizzi con "?controller=…" (carrello, pagamenti) non si possono elencare qui: /index.php va alla pagina iniziale.
  ['/2-home', '/'],
  ['/index.php', '/'],
  ['/3-camicia-su-misura', '/camicie-su-misura/'],
  ['/brand/1-camicia-su-misura', '/camicie-su-misura/'],
  // le schede dei capi stavano tutte sotto /home/ (per esempio /home/1-43-camicione-in-flanella-camicia-su-misura.html)
  ['/home', '/collezione/'],
  ['/home/*', '/collezione/'],
  ['/best-sellers', '/collezione/'],
  ['/prices-drop', '/collezione/'],
  ['/suppliers', '/diventa-rivenditore/'],
  ['/contact-us', '/dove-siamo/'],
  // l'unica altra pagina del sito che risponde oggi su endero.it (il suo configuratore, letto il 2026-11-20)
  ['/configuratore', '/camicie-su-misura/configuratore/'],
  // la storia è diventata Cultura e artigianato (punto 10) e poi Chi siamo: il fondatore ha già visto i vecchi indirizzi
  ['/storia', '/chi-siamo/'],
  ['/cultura-e-artigianato', '/chi-siamo/'],
];
export const REINDIRIZZAMENTI = VOCI.flatMap(([da, a]) => (/\.[a-z]+$|\*$/.test(da) ? [[da, a]] : [[da, a], [da + '/', a]]));

/** Dove porta un percorso, oppure null. La ricerca (?…) resta attaccata. */
export function destinazione(url) {
  const u = new URL(url);
  // una voce che finisce con /* vale per tutto ciò che comincia così
  const voce = REINDIRIZZAMENTI.find(([da]) => (da.endsWith('/*') ? u.pathname.startsWith(da.slice(0, -1)) : da === u.pathname));
  return voce ? new URL(voce[1] + u.search, u.origin).toString() : null;
}

/** Il file _redirects di Cloudflare. */
export const fileRedirects = () => REINDIRIZZAMENTI.map(([da, a]) => `${da} ${a} 301`).join('\n') + '\n';
