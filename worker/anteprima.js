// Worker dell'anteprima: stesse pagine e stesso modulo del sito, ma i file arrivano dall'archivio KV
// (vedi wrangler.toml, [env.anteprima]). Serve solo a mostrare il sito prima della messa online:
// ogni risposta dice ai motori di ricerca di non indicizzare.
import { getAssetFromKV, mapRequestToAsset, NotFoundError, MethodNotAllowedError } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
import { contatto } from './index.js';
import { INTESTAZIONI } from './intestazioni.mjs';
import { destinazione } from './reindirizzamenti.mjs';

const manifest = JSON.parse(manifestJSON);

function durata(percorso) {
  if (percorso.startsWith('/risorse/') || percorso.startsWith('/font/')) return 'public, max-age=31536000, immutable';
  if (percorso.startsWith('/film/') || percorso.startsWith('/camicia/')) return 'public, max-age=604800';
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
 * ritaglia a mano il pezzo chiesto. I file sono piccoli (un video pesa meno di un megabyte), si possono leggere interi.
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
    if (url.pathname === '/api/contatto') {
      if (request.method !== 'POST') return new Response('Metodo non consentito', { status: 405, headers: { Allow: 'POST' } });
      const risposta = await contatto(request, env);
      // le risposte del modulo non passano dalle pagine: almeno queste due intestazioni le portano sempre
      const r = new Response(risposta.body, risposta);
      r.headers.set('X-Robots-Tag', 'noindex, nofollow');
      r.headers.set('X-Content-Type-Options', 'nosniff');
      return r;
    }
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
};
