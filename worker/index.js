// Worker di Endero: serve le pagine generate in dist/ e riceve il modulo di contatto.
//
// Collegamenti (wrangler.toml): ASSETS (i file del sito), DB (database D1 "endero").
// Segreti, mai nel repository: TURNSTILE_SECRET (antispam). Più avanti, per le email con Resend:
// RESEND_API_KEY ed EMAIL_DESTINATARIO (la casella del proprietario, che non va scritta da nessun'altra parte).

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/contatto') {
      if (request.method !== 'POST') return new Response('Metodo non consentito', { status: 405, headers: { Allow: 'POST' } });
      return contatto(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GIORNO = /^\d{4}-\d{2}-\d{2}$/;

import rivenditori from '../contenuti/it/diventa-rivenditore.json';

const TIPI = ['presa-misure', 'contatto', 'rivenditore'];
// i campi propri delle richieste dei rivenditori: nomi, scelte ammesse e lunghezze vengono dai contenuti della pagina,
// così modulo e Worker non si possono disallineare. Quelli comuni hanno già le loro colonne.
const COMUNI = ['nome', 'telefono', 'email', 'messaggio'];
const CAMPI_RIVENDITORE = rivenditori.modulo.campi.filter((c) => !COMUNI.includes(c.nome));
const FASCE = ['Mattina', 'Pomeriggio', 'Indifferente'];
const PESO_MASSIMO = 32768;   // byte: un modulo compilato ne pesa pochi, il resto è abuso

/** Vero se la data esiste davvero (non basta la forma AAAA-MM-GG). */
function dataVera(s) {
  if (!GIORNO.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Stessa origine del sito: restituisce percorso e ricerca, altrimenti '' . */
function percorsoInterno(indirizzo, request) {
  try {
    const u = new URL(indirizzo);
    return u.origin === new URL(request.url).origin ? (u.pathname + u.search).slice(0, 300) : '';
  } catch {
    return '';
  }
}

export async function contatto(request, env) {
  const vuoleJson = (request.headers.get('Accept') || '').includes('application/json');
  const rispondi = (ok, stato, errore) => {
    if (vuoleJson) return Response.json(ok ? { ok: true } : { ok: false, errore }, { status: stato });
    if (ok) return Response.redirect(new URL('/grazie/', request.url).toString(), 303);
    return new Response(paginaErrore(errore, percorsoInterno(request.headers.get('Referer') || '', request)), { status: stato, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff' } });
  };

  // solo moduli del sito stesso e di peso ragionevole
  const origine = request.headers.get('Origin');
  if (origine && origine !== new URL(request.url).origin) return rispondi(false, 403, 'Richiesta non valida.');
  if (Number(request.headers.get('Content-Length') || 0) > PESO_MASSIMO) return rispondi(false, 413, 'Richiesta troppo grande.');

  let dati;
  try {
    dati = await request.formData();
  } catch {
    return rispondi(false, 400, 'Richiesta non valida.');
  }
  // esca per i programmi automatici: una persona non vede e non compila questo campo
  if (String(dati.get('sito_web') || '').trim()) return rispondi(true, 200);

  // solo testo (mai file), senza caratteri di controllo, tagliato alla lunghezza prevista
  const campo = (nome, max, righe = false) => {
    const v = dati.get(nome);
    if (typeof v !== 'string') return '';
    const pulito = righe ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') : v.replace(/[\u0000-\u001F\u007F]+/g, ' ');
    return pulito.trim().slice(0, max);
  };
  const r = {
    tipo: campo('tipo', 40),
    nome: campo('nome', 120),
    telefono: campo('telefono', 40),
    email: campo('email', 160),
    giorno: campo('giorno', 10),
    fascia: campo('fascia', 40),
    messaggio: campo('messaggio', 2000, true),
  };
  if (!TIPI.includes(r.tipo)) r.tipo = 'contatto';
  if (!FASCE.includes(r.fascia)) r.fascia = '';
  if (!dataVera(r.giorno)) r.giorno = '';
  if (!r.nome || !r.telefono) return rispondi(false, 422, 'Nome e telefono sono obbligatori.');
  if (dati.get('privacy') !== 'si') return rispondi(false, 422, 'Serve il consenso all\'informativa privacy.');
  if (r.email && !EMAIL.test(r.email)) return rispondi(false, 422, 'L\'indirizzo email non sembra corretto.');

  // richiesta di un rivenditore: solo i campi previsti, con le loro lunghezze e scelte; listino e condizioni
  // partono per email, quindi l'email serve; poi città e almeno un interesse
  r.dettagli = '';
  if (r.tipo === 'rivenditore') {
    const d = {};
    for (const c of CAMPI_RIVENDITORE) {
      if (c.tipo === 'scelta-multipla') d[c.nome] = [...new Set(dati.getAll(c.nome).filter((v) => c.opzioni.includes(v)))];
      else if (c.tipo === 'scelta-singola') d[c.nome] = c.opzioni.includes(dati.get(c.nome)) ? dati.get(c.nome) : '';
      else d[c.nome] = campo(c.nome, c.max || 160, c.tipo === 'area');
    }
    if (!r.email) return rispondi(false, 422, 'Serve l\'email: listino e condizioni te li mandiamo lì.');
    if (!d.citta) return rispondi(false, 422, 'Scrivi la città del negozio o dell\'attività.');
    const interesse = CAMPI_RIVENDITORE.find((c) => c.nome === 'interesse');
    if (interesse && !d.interesse.length) return rispondi(false, 422, `${interesse.etichetta}: ${interesse.errore || 'scegli almeno una voce.'}`);
    r.giorno = r.fascia = '';
    r.dettagli = JSON.stringify(d);
  }

  // antispam: obbligatorio appena la chiave segreta è configurata sul Worker
  if (env.TURNSTILE_SECRET) {
    let superata = false;
    try {
      const verifica = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET,
          response: campo('cf-turnstile-response', 4096),
          remoteip: request.headers.get('CF-Connecting-IP') || '',
        }),
      });
      superata = Boolean((await verifica.json()).success);
    } catch (errore) {
      console.error('verifica antispam non riuscita', errore);
    }
    if (!superata) return rispondi(false, 403, 'La verifica antispam non è riuscita. Riprova.');
  }

  // nell'anteprima il database può non esserci ancora: meglio dirlo che fingere di aver salvato
  if (!env.DB) return rispondi(false, 503, 'In questa anteprima il modulo non salva ancora le richieste. Per ora scrivici su WhatsApp.');

  try {
    await env.DB.prepare(
      'INSERT INTO richieste (tipo, nome, telefono, email, giorno, fascia, messaggio, dettagli, pagina, paese) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)'
    ).bind(r.tipo, r.nome, r.telefono, r.email, r.giorno, r.fascia, r.messaggio, r.dettagli, percorsoInterno(request.headers.get('Referer') || '', request), request.cf?.country || '').run();
  } catch (errore) {
    console.error('salvataggio non riuscito', errore);
    return rispondi(false, 500, 'Non siamo riusciti a salvare la richiesta. Scrivici su WhatsApp.');
  }
  // L'avviso per email con Resend si aggiunge quando i DNS di endero.it sono pronti (docs/direzione-creativa.md, punto 6).
  return rispondi(true, 200);
}

function paginaErrore(messaggio, percorsoModulo) {
  const pulisci = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const testo = pulisci(messaggio);
  // si torna solo a una pagina di questo sito (percorso già verificato), mai a un indirizzo esterno
  const indietro = percorsoModulo ? pulisci(percorsoModulo) : '/';
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Richiesta non inviata · Endero</title>
<style>body{margin:0;min-height:100vh;display:grid;place-content:center;gap:16px;padding:24px;text-align:center;font:300 15px/1.6 system-ui,sans-serif;color:#0f285e;background:#faf9f7}a{color:inherit}h1{font-size:22px;font-weight:600;text-transform:uppercase}h1,p{margin:0}</style></head>
<body><h1>Richiesta non inviata</h1><p>${testo}</p><p><a href="${indietro}">Torna al modulo</a> · <a href="https://wa.me/393338548712">Scrivici su WhatsApp</a></p></body></html>`;
}
