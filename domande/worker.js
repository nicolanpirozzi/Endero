// Worker "endero-domande": i questionari a passi per Endero, per chi non ha Claude e non fa nessun accesso.
//
// Serve quando un dubbio lo deve sciogliere una persona di Endero (il titolare, il sarto): una domanda per
// schermata, il ritaglio del loro materiale accanto a quello che abbiamo capito noi, e loro confermano o correggono.
// Ogni risposta si salva qui, subito: nessuno deve copiare o mandare niente.
//
// Nel repository c'è solo il motore. Domande, ritagli e risposte stanno nell'archivio KV "DOMANDE" e non passano
// mai da git, perché contengono le misure dei cartamodelli:
//   q/<chiave>/domande            il questionario (JSON, vedi domande/carica.mjs)
//   q/<chiave>/ritagli/<nome>     le immagini
//   q/<chiave>/risposte/<id>      una risposta per domanda
// Con lo stesso sistema, una pagina per caricare le foto che mancano al sito (domande/foto.mjs):
//   f/<chiave>/elenco             i riquadri da riempire (JSON)
//   f/<chiave>/foto/<id>          la foto caricata, con tipo, nome e data nei metadati
// La chiave è un indirizzo lungo e casuale: chi non ha il link non trova niente, e nessuna pagina si indicizza.
import pagina from './pagina.html';
import paginaFoto from './foto.html';
import carattere from '../public/font/archivo-var.woff2';

const CHIAVE = /^[a-z0-9]{20,40}$/;
const NOME = /^[a-z0-9-]{1,60}$/;
const STATI = ['confermato', 'modificato', 'risposto'];
const PESO_MASSIMO = 8192;   // byte: una risposta scritta a mano ne pesa poche centinaia

const SICURE = {
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function rispondi(corpo, stato, intestazioni) {
  return new Response(corpo, { status: stato, headers: { 'Cache-Control': 'no-store', ...SICURE, ...intestazioni } });
}
const json = (dati, stato = 200) => rispondi(JSON.stringify(dati), stato, { 'Content-Type': 'application/json; charset=utf-8' });
const nonTrovata = () => rispondi('Pagina non trovata.', 404, { 'Content-Type': 'text/plain; charset=utf-8' });

/** Solo testo, senza caratteri di controllo (gli a capo restano), tagliato alla lunghezza prevista. */
function pulito(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/robots.txt') return rispondi('User-agent: *\nDisallow: /\n', 200, { 'Content-Type': 'text/plain; charset=utf-8' });
    if (url.pathname === '/_/archivo.woff2') {
      return rispondi(carattere, 200, { 'Content-Type': 'font/woff2', 'Cache-Control': 'public, max-age=31536000, immutable' });
    }

    const [chiave, ...resto] = url.pathname.split('/').filter(Boolean);
    if (!chiave || !CHIAVE.test(chiave) || resto.length > 2) return nonTrovata();
    const base = `q/${chiave}/`;
    const testo = await env.DOMANDE.get(base + 'domande');
    if (!testo) return foto(request, env, url, chiave, resto);
    const percorso = resto.join('/');

    if (request.method === 'POST') {
      if (percorso !== 'risposta') return nonTrovata();
      return risposta(request, env, base, JSON.parse(testo));
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return rispondi('Metodo non consentito', 405, { Allow: 'GET, HEAD, POST' });

    if (percorso === '') {
      // senza la barra finale gli indirizzi relativi della pagina (domande.json, ritagli/…) punterebbero altrove
      if (!url.pathname.endsWith('/')) return rispondi(null, 308, { Location: url.pathname + '/' });
      // stili e script stanno dentro la pagina: li autorizza un numero casuale, nuovo a ogni richiesta
      const casuale = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))));
      return rispondi(pagina.replaceAll('__CASUALE__', casuale), 200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${casuale}'; style-src 'nonce-${casuale}'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      });
    }
    if (percorso === 'domande.json') return rispondi(testo, 200, { 'Content-Type': 'application/json; charset=utf-8' });
    if (percorso === 'risposte.json') {
      // le domande si conoscono: si legge una risposta per domanda, senza elencare l'archivio (l'elenco arriva in ritardo)
      const passi = JSON.parse(testo).passi;
      const lette = await Promise.all(passi.map((p) => env.DOMANDE.get(`${base}risposte/${p.id}`, 'json')));
      const risposte = {};
      passi.forEach((p, i) => { if (lette[i]) risposte[p.id] = lette[i]; });
      return json({ risposte });
    }
    if (resto[0] === 'ritagli' && resto.length === 2) {
      const nome = resto[1].replace(/\.jpg$/, '');
      if (!NOME.test(nome)) return nonTrovata();
      const immagine = await env.DOMANDE.get(`${base}ritagli/${nome}`, 'stream');
      if (!immagine) return nonTrovata();
      return rispondi(immagine, 200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400' });
    }
    return nonTrovata();
  },
};

async function risposta(request, env, base, questionario) {
  const origine = request.headers.get('Origin');
  if (origine && origine !== new URL(request.url).origin) return json({ ok: false, errore: 'Richiesta non valida.' }, 403);
  const corpo = await request.text();
  if (corpo.length > PESO_MASSIMO) return json({ ok: false, errore: 'Risposta troppo lunga.' }, 413);
  let d;
  try { d = JSON.parse(corpo); } catch { d = null; }
  const passo = d && typeof d === 'object' && questionario.passi.find((p) => p.id === d.id);
  if (!passo) return json({ ok: false, errore: 'Domanda sconosciuta.' }, 400);
  const r = {
    stato: STATI.includes(d.stato) ? d.stato : 'risposto',
    scelta: pulito(d.scelta, 40),
    testo: pulito(d.testo, 2000),
    risposta: pulito(d.risposta, 2400),
    punto: passo.titolo,
    quando: new Date().toISOString(),
  };
  if (typeof d.valore === 'number' && Number.isFinite(d.valore)) r.valore = d.valore;
  try {
    await env.DOMANDE.put(`${base}risposte/${passo.id}`, JSON.stringify(r));
  } catch (errore) {
    console.error('salvataggio non riuscito', errore);
    return json({ ok: false, errore: 'Non sono riuscito a salvare.' }, 503);
  }
  return json({ ok: true, quando: r.quando });
}

const TIPI_FOTO = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const PESO_FOTO = 20e6;

/** La pagina per caricare le foto che mancano: l'elenco dei riquadri, le foto già caricate, il caricamento. */
async function foto(request, env, url, chiave, resto) {
  const base = `f/${chiave}/`;
  const elenco = await env.DOMANDE.get(base + 'elenco', 'json');
  if (!elenco) return nonTrovata();
  const percorso = resto.join('/');
  const voce = resto[0] === 'foto' && resto.length === 2 && elenco.voci.find((v) => v.id === resto[1]);

  if (request.method === 'POST') {
    if (!voce) return nonTrovata();
    const origine = request.headers.get('Origin');
    if (origine && origine !== url.origin) return json({ ok: false, errore: 'Richiesta non valida.' }, 403);
    const tipo = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!TIPI_FOTO.includes(tipo)) return json({ ok: false, errore: 'Serve una foto (JPEG, PNG, WebP o HEIC).' }, 415);
    if (Number(request.headers.get('Content-Length') || 0) > PESO_FOTO) return json({ ok: false, errore: 'Foto troppo pesante.' }, 413);
    const corpo = await request.arrayBuffer();
    if (!corpo.byteLength || corpo.byteLength > PESO_FOTO) return json({ ok: false, errore: 'Foto vuota o troppo pesante.' }, 413);
    let nome = '';
    try { nome = pulito(decodeURIComponent(request.headers.get('X-Nome') || ''), 120); } catch { /* resta senza nome */ }
    const quando = new Date().toISOString();
    try {
      await env.DOMANDE.put(`${base}foto/${voce.id}`, corpo, { metadata: { tipo, nome, quando, peso: corpo.byteLength } });
    } catch (errore) {
      console.error('foto non salvata', errore);
      return json({ ok: false, errore: 'Non sono riuscito a salvare.' }, 503);
    }
    return json({ ok: true, quando });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return rispondi('Metodo non consentito', 405, { Allow: 'GET, HEAD, POST' });

  if (percorso === '') {
    if (!url.pathname.endsWith('/')) return rispondi(null, 308, { Location: url.pathname + '/' });
    const casuale = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))));
    return rispondi(paginaFoto.replaceAll('__CASUALE__', casuale), 200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${casuale}'; style-src 'nonce-${casuale}' 'unsafe-inline'; img-src 'self' blob:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    });
  }
  if (percorso === 'foto.json') {
    const lette = await Promise.all(elenco.voci.map((v) => env.DOMANDE.getWithMetadata(`${base}foto/${v.id}`, 'stream')));
    const caricate = {};
    elenco.voci.forEach((v, i) => { lette[i].value?.cancel(); if (lette[i].metadata) caricate[v.id] = lette[i].metadata; });
    return json({ voci: elenco.voci, caricate });
  }
  if (voce) {
    const f = await env.DOMANDE.getWithMetadata(`${base}foto/${voce.id}`, 'stream');
    if (!f.value) return nonTrovata();
    return rispondi(f.value, 200, { 'Content-Type': f.metadata?.tipo || 'application/octet-stream', 'Cache-Control': 'private, max-age=3600' });
  }
  return nonTrovata();
}
