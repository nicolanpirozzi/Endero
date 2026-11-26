// Server locale per guardare dist/ senza Cloudflare: node build/servi.mjs [porta] [cartella]
// (la cartella, se data, è una copia di dist/ messa da parte: serve alle revisioni, mentre dist/ si ricostruisce)
// Il modulo di contatto qui non salva nulla: per provarlo davvero si usa `npm run worker` (Wrangler con D1 locale).
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { destinazione } from '../worker/reindirizzamenti.mjs';
import { INTESTAZIONI } from '../worker/intestazioni.mjs';

const DIST = process.argv[3] ? resolve(process.argv[3]) + '/' : fileURLToPath(new URL('../dist/', import.meta.url));
const porta = Number(process.argv[2] || process.env.PORT || 8766);
const tipi = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
  '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.ico': 'image/x-icon',
};

createServer((req, res) => {
  const url = new URL(req.url, 'http://locale');
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, errore: 'Nel server locale il modulo non è attivo: usare npm run worker.' }));
  }
  // gli stessi reindirizzamenti del sito vero (dist/_redirects)
  const altrove = destinazione(url.toString());
  if (altrove) { res.writeHead(301, { Location: new URL(altrove).pathname + url.search }); return res.end(); }
  let file = normalize(join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  let stato = 200;
  if (!existsSync(file)) { file = join(DIST, '404.html'); stato = 404; }
  // le pagine escono con le stesse intestazioni di sicurezza del sito vero: ciò che lì è vietato (un'immagine «blob:»,
  // uno stile aggiunto da uno script) lo è anche qui, e i controlli in locale se ne accorgono (2026-11-26)
  const sicurezza = extname(file) === '.html' ? INTESTAZIONI : {};
  res.writeHead(stato, { 'Content-Type': tipi[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', ...sicurezza });
  // (un file che sparisce mentre lo si legge, perché il sito si sta ricostruendo, non deve fermare il server)
  createReadStream(file).on('error', () => res.destroy()).pipe(res);
}).listen(porta, '127.0.0.1', () => console.log(`anteprima su http://127.0.0.1:${porta}/`));
