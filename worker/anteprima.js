// Worker del sito chiuso a Google: stesse pagine e stesso modulo del sito, ma i file arrivano dall'archivio KV, e
// ogni risposta dice ai motori di ricerca di non indicizzare. Lo usano l'anteprima su workers.dev
// (wrangler.anteprima.toml: senza database, il modulo avvisa che non salva) ed endero.men finché non si apre a Google
// (wrangler.sito.toml: con il database, le email e la pulizia di ogni notte).
import { getAssetFromKV, mapRequestToAsset, NotFoundError, MethodNotAllowedError } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
import { contatto } from './index.js';
import { ordine, stripe, pagamentoProva, camiciaOrdine } from './ordine.mjs';
import { dimentica, pulisciOrdini } from './conservazione.mjs';
import { INTESTAZIONI } from './intestazioni.mjs';
import { destinazione } from './reindirizzamenti.mjs';

const manifest = JSON.parse(manifestJSON);

function durata(percorso) {
  // le immagini delle email hanno la versione nel nome e non cambiano più (tools/immagini-email.js)
  if (['/risorse/', '/font/', '/email/'].some((c) => percorso.startsWith(c))) return 'public, max-age=31536000, immutable';
  if (['/film/', '/camicia/', '/foto/', '/video/'].some((c) => percorso.startsWith(c))) return 'public, max-age=604800';
  return 'no-cache';
}

function conIntestazioni(risposta, percorso, stato) {
  const r = new Response(risposta.body, { status: stato || risposta.status, headers: risposta.headers });
  r.headers.set('Cache-Control', durata(percorso));
  r.headers.set('X-Robots-Tag', 'noindex, nofollow');
  for (const [nome, valore] of Object.entries(INTESTAZIONI)) r.headers.set(nome, valore);
  return r;
}

/**
 * Safari chiede i video a pezzi (intestazione Range) e non li fa partire se il server risponde con il file intero.
 * L'archivio KV risponde a pezzi solo quando il file è già nella cache di Cloudflare: la prima volta no. Qui si
 * ritaglia a mano il pezzo chiesto. I file sono piccoli (un video pesa al massimo due o tre megabyte), si possono leggere interi.
 */
async function aPezzi(request, risposta) {
  const chiesto = /^bytes=(\d*)-(\d*)$/.exec((request.headers.get('Range') || '').trim());
  if (risposta.status !== 200) return risposta;
  if (!chiesto || (chiesto[1] === '' && chiesto[2] === '')) {
    // nessun pezzo chiesto, o una richiesta che non si sa ritagliare (più intervalli): il file intero, che è lecito
    const tutta = new Response(risposta.body, risposta);
    tutta.headers.set('Accept-Ranges', 'bytes');
    return tutta;
  }
  const tutto = await risposta.arrayBuffer(), n = tutto.byteLength;
  let da, a;
  if (chiesto[1] === '') { da = Math.max(0, n - Number(chiesto[2])); a = n - 1; }            // "gli ultimi N byte"
  else { da = Number(chiesto[1]); a = chiesto[2] === '' ? n - 1 : Math.min(Number(chiesto[2]), n - 1); }
  const intestazioni = new Headers(risposta.headers);
  intestazioni.set('Accept-Ranges', 'bytes');
  if (da >= n || da > a) {
    intestazioni.set('Content-Range', `bytes */${n}`);
    intestazioni.delete('Content-Length');
    return new Response(null, { status: 416, headers: intestazioni });
  }
  intestazioni.set('Content-Range', `bytes ${da}-${a}/${n}`);
  intestazioni.set('Content-Length', String(a - da + 1));
  return new Response(tutto.slice(da, a + 1), { status: 206, headers: intestazioni });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // un indirizzo solo: www.endero.men porta a endero.men
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4);
      return new Response(null, { status: 301, headers: { Location: url.toString(), 'X-Robots-Tag': 'noindex, nofollow' } });
    }
    if (url.pathname === '/api/contatto') {
      if (request.method !== 'POST') return new Response('Metodo non consentito', { status: 405, headers: { Allow: 'POST' } });
      const risposta = await contatto(request, env, ctx);
      // le risposte del modulo non passano dalle pagine: almeno queste due intestazioni le portano sempre
      const r = new Response(risposta.body, risposta);
      r.headers.set('X-Robots-Tag', 'noindex, nofollow');
      r.headers.set('X-Content-Type-Options', 'nosniff');
      return r;
    }
    // l'ordine del configuratore e l'avviso di pagamento di Stripe (worker/ordine.mjs). Nell'anteprima non ci sono né
    // il database né la chiave di Stripe: l'ordine si controlla tutto e la risposta è «pagamento non attivo», senza
    // salvare né mandare nulla. Su endero.men lo stesso, finché le chiavi di Stripe non ci sono.
    if (url.pathname === '/api/ordine' || url.pathname === '/api/stripe') {
      if (request.method !== 'POST') return new Response('Metodo non consentito', { status: 405, headers: { Allow: 'POST' } });
      const risposta = url.pathname === '/api/ordine' ? await ordine(request, env, ctx) : await stripe(request, env, ctx);
      // le risposte del modulo non passano dalle pagine: almeno queste due intestazioni le portano sempre
      const r = new Response(risposta.body, risposta);
      r.headers.set('X-Robots-Tag', 'noindex, nofollow');
      r.headers.set('X-Content-Type-Options', 'nosniff');
      return r;
    }
    // il pagamento di prova (worker/ordine.mjs): la sua pagina e il suo tasto
    if (url.pathname === '/api/pagamento-prova') {
      const risposta = await pagamentoProva(request, env);
      const r = new Response(risposta.body, risposta);
      r.headers.set('X-Robots-Tag', 'noindex, nofollow');
      r.headers.set('X-Content-Type-Options', 'nosniff');
      r.headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
      return r;
    }
    // la miniatura della camicia di un ordine, per le sue email (worker/ordine.mjs): ha le sue intestazioni
    if (url.pathname === '/api/camicia-ordine') return camiciaOrdine(request, env);
    // _redirects qui non viene caricato (vedi wrangler.anteprima.toml): gli stessi reindirizzamenti li fa il Worker
    const altrove = destinazione(request.url);
    if (altrove) return new Response(null, { status: 301, headers: { Location: altrove, 'X-Robots-Tag': 'noindex, nofollow' } });
    // all'archivio si chiede sempre il file intero: il pezzo lo ritaglia aPezzi, uguale con e senza cache
    const intera = new Request(request);
    intera.headers.delete('Range');
    const evento = { request: intera, waitUntil: ctx.waitUntil.bind(ctx) };
    const opzioni = { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: manifest, cacheControl: { bypassCache: false, edgeTTL: 3600, browserTTL: null } };
    try {
      return conIntestazioni(await aPezzi(request, await getAssetFromKV(evento, opzioni)), url.pathname);
    } catch (errore) {
      if (errore instanceof MethodNotAllowedError) return new Response('Metodo non consentito', { status: 405, headers: { Allow: 'GET, HEAD' } });
      if (!(errore instanceof NotFoundError)) return new Response('Errore del server', { status: 500 });
      try {
        const nonTrovata = await getAssetFromKV(evento, { ...opzioni, mapRequestToAsset: (req) => new Request(new URL('/404.html', req.url).toString(), req) });
        return conIntestazioni(nonTrovata, '/404.html', 404);
      } catch {
        return new Response('Pagina non trovata', { status: 404 });
      }
    }
  },
  // dove c'è il database (endero.men), ogni notte via le richieste più vecchie di 24 mesi dall'ultima, come dice
  // l'informativa privacy (worker/conservazione.mjs)
  async scheduled(evento, env, ctx) {
    if (env.DB) ctx.waitUntil(Promise.all([dimentica(env.DB), pulisciOrdini(env.DB)]));
  },
};
