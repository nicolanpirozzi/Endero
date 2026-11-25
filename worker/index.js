// Worker di Endero: serve le pagine generate in dist/ e riceve il modulo di contatto.
//
// Collegamenti (wrangler.toml): ASSETS (i file del sito), DB (database D1 "endero").
// Segreti, mai nel repository: TURNSTILE_SECRET (antispam), RESEND_API_KEY ed EMAIL_DESTINATARIO (le email dei
// moduli: worker/email.mjs; la casella di Endero non va scritta da nessun'altra parte).

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/contatto') {
      if (request.method !== 'POST') return new Response('Metodo non consentito', { status: 405, headers: { Allow: 'POST' } });
      return contatto(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
  // una volta al giorno (wrangler.toml, triggers): via le richieste vecchie, come dice l'informativa privacy
  // (worker/conservazione.mjs)
  async scheduled(evento, env, ctx) {
    if (env.DB) ctx.waitUntil(dimentica(env.DB));
  },
};

const GIORNO = /^\d{4}-\d{2}-\d{2}$/;

import rivenditori from '../contenuti/it/diventa-rivenditore.json';
import { dimentica, chiaveTelefono, chiaveEmail } from './conservazione.mjs';
import { avvisa } from './email.mjs';
import { controlla, senzaInvisibili, testi as avvisi } from '../src/controlli.mjs';

const TIPI = ['presa-misure', 'contatto', 'rivenditore'];
// il nome dei campi, per la pagina d'errore senza script
const ETICHETTE = {
  ...Object.fromEntries(rivenditori.modulo.campi.map((c) => [c.nome, c.etichetta.replace(/\s*\(facoltativ[oa]\)\s*$/i, '')])),
  messaggio: 'Messaggio', giorno: 'Giorno', privacy: 'Privacy',
};
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

export async function contatto(request, env, ctx) {
  const vuoleJson = (request.headers.get('Accept') || '').includes('application/json');
  // campo: il nome del campo sbagliato, perché la pagina metta l'avviso sotto quel campo
  const rispondi = (ok, stato, errore, campo) => {
    if (vuoleJson) return Response.json(ok ? { ok: true } : { ok: false, errore, ...(campo ? { campo } : {}) }, { status: stato });
    if (ok) return Response.redirect(new URL('/grazie/', request.url).toString(), 303);
    // senza script la pagina d'errore dice di quale campo si parla («Città: usa solo lettere…»)
    if (campo && ETICHETTE[campo]) errore = `${ETICHETTE[campo]}: ${errore.charAt(0).toLowerCase()}${errore.slice(1)}`;
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

  // solo testo (mai file), senza caratteri di controllo né invisibili (arrivano incollando dalla rubrica del
  // telefono), tagliato alla lunghezza prevista
  const campo = (nome, max, righe = false) => {
    const v = senzaInvisibili(dati.get(nome) ?? '');
    if (typeof dati.get(nome) !== 'string') return '';
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
  // gli stessi controlli della pagina (src/controlli.mjs): valgono anche senza script
  const sbagliato = (campo, valore, contesto) => {
    const testo = controlla(campo, valore, contesto);
    return testo ? rispondi(false, 422, testo, campo) : null;
  };
  // il Paese conta per il telefono solo nel modulo dei rivenditori (gli altri sono italiani)
  const paese = r.tipo === 'rivenditore' ? campo('nazione', 60) : '';
  const primo = sbagliato('nome', r.nome) || sbagliato('telefono', r.telefono, { paese })
    || sbagliato('email', r.email, { obbligatorio: r.tipo === 'rivenditore' })
    || sbagliato('messaggio', r.messaggio, { obbligatorio: r.tipo === 'contatto' })
    || (r.tipo === 'presa-misure' ? sbagliato('giorno', r.giorno) : null);
  if (primo) return primo;
  if (dati.get('privacy') !== 'si') return rispondi(false, 422, avvisi.privacy, 'privacy');

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
    const altro = sbagliato('citta', d.citta) || sbagliato('nazione', d.nazione)
      || sbagliato('partita_iva', d.partita_iva, { paese: d.nazione }) || sbagliato('profilo', d.profilo);
    if (altro) return altro;
    const interesse = CAMPI_RIVENDITORE.find((c) => c.nome === 'interesse');
    if (interesse && !d.interesse.length) return rispondi(false, 422, interesse.errore || avvisi.scelta, 'interesse');
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

  r.pagina = percorsoInterno(request.headers.get('Referer') || '', request);
  r.paese = request.cf?.country || '';
  try {
    await env.DB.prepare(
      'INSERT INTO richieste (tipo, nome, telefono, email, giorno, fascia, messaggio, dettagli, pagina, paese, chiave_telefono, chiave_email) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)'
    ).bind(r.tipo, r.nome, r.telefono, r.email, r.giorno, r.fascia, r.messaggio, r.dettagli, r.pagina, r.paese, chiaveTelefono(r.telefono), chiaveEmail(r.email)).run();
  } catch (errore) {
    console.error('salvataggio non riuscito', errore);
    return rispondi(false, 500, 'Non siamo riusciti a salvare la richiesta. Scrivici su WhatsApp.');
  }
  // salvata: l'avviso a Endero e la conferma al cliente partono dopo la risposta (worker/email.mjs)
  const email = avvisa(env, r);
  if (ctx?.waitUntil) ctx.waitUntil(email); else await email;
  return rispondi(true, 200);
}

function paginaErrore(messaggio, percorsoModulo) {
  const pulisci = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const testo = pulisci(messaggio);
  // si torna solo a una pagina di questo sito (percorso già verificato), mai a un indirizzo esterno
  const indietro = percorsoModulo ? pulisci(percorsoModulo) : '/';
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Richiesta non inviata · Endero</title>
<style>body{margin:0;min-height:100vh;display:grid;place-content:center;gap:16px;padding:24px;text-align:center;font:300 15px/1.6 system-ui,sans-serif;color:#0f285e;background:#faf9f7}a{color:inherit}h1{font-size:22px;font-weight:600;text-transform:uppercase}h1,p{margin:0}@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}</style></head>
<body><h1>Richiesta non inviata</h1><p>${testo}</p><p>Torna indietro con il tasto del browser: quello che hai scritto resta lì.</p><p><a href="${indietro}">Torna al modulo</a> · <a href="https://wa.me/393338548712">Scrivici su WhatsApp</a></p></body></html>`;
}
