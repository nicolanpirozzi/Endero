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

async function contatto(request, env) {
  const vuoleJson = (request.headers.get('Accept') || '').includes('application/json');
  const rispondi = (ok, stato, errore) => {
    if (vuoleJson) return Response.json(ok ? { ok: true } : { ok: false, errore }, { status: stato });
    if (ok) return Response.redirect(new URL('/grazie/', request.url).toString(), 303);
    return new Response(paginaErrore(errore, request.headers.get('Referer')), { status: stato, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  };

  let dati;
  try {
    dati = await request.formData();
  } catch {
    return rispondi(false, 400, 'Richiesta non valida.');
  }
  // esca per i programmi automatici: una persona non vede e non compila questo campo
  if (String(dati.get('sito_web') || '').trim()) return rispondi(true, 200);

  const campo = (nome, max) => String(dati.get(nome) || '').trim().slice(0, max);
  const r = {
    tipo: campo('tipo', 40) || 'contatto',
    nome: campo('nome', 120),
    telefono: campo('telefono', 40),
    email: campo('email', 160),
    giorno: campo('giorno', 10),
    fascia: campo('fascia', 40),
    messaggio: campo('messaggio', 2000),
  };
  if (!r.nome || !r.telefono) return rispondi(false, 422, 'Nome e telefono sono obbligatori.');
  if (dati.get('privacy') !== 'si') return rispondi(false, 422, 'Serve il consenso all\'informativa privacy.');
  if (r.email && !EMAIL.test(r.email)) return rispondi(false, 422, 'L\'indirizzo email non sembra corretto.');
  if (r.giorno && !GIORNO.test(r.giorno)) r.giorno = '';

  // antispam: obbligatorio appena la chiave segreta è configurata sul Worker
  if (env.TURNSTILE_SECRET) {
    const verifica = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: String(dati.get('cf-turnstile-response') || ''),
        remoteip: request.headers.get('CF-Connecting-IP') || '',
      }),
    });
    const esito = await verifica.json().catch(() => ({}));
    if (!esito.success) return rispondi(false, 403, 'La verifica antispam non è riuscita. Riprova.');
  }

  // nell'anteprima il database può non esserci ancora: meglio dirlo che fingere di aver salvato
  if (!env.DB) return rispondi(false, 503, 'In questa anteprima il modulo non salva ancora le richieste. Per ora scrivici su WhatsApp.');

  try {
    await env.DB.prepare(
      'INSERT INTO richieste (tipo, nome, telefono, email, giorno, fascia, messaggio, pagina, paese) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)'
    ).bind(r.tipo, r.nome, r.telefono, r.email, r.giorno, r.fascia, r.messaggio, request.headers.get('Referer') || '', request.cf?.country || '').run();
  } catch (errore) {
    console.error('salvataggio non riuscito', errore);
    return rispondi(false, 500, 'Non siamo riusciti a salvare la richiesta. Scrivici su WhatsApp.');
  }
  // L'avviso per email con Resend si aggiunge quando i DNS di endero.it sono pronti (docs/direzione-creativa.md, punto 6).
  return rispondi(true, 200);
}

function paginaErrore(messaggio, provenienza) {
  const pulisci = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const testo = pulisci(messaggio);
  // si torna alla pagina del modulo solo se è un indirizzo http(s): mai altri schemi
  const indietro = /^https?:\/\//.test(provenienza || '') ? pulisci(provenienza) : '/';
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Richiesta non inviata · Endero</title>
<style>body{margin:0;min-height:100vh;display:grid;place-content:center;gap:16px;padding:24px;text-align:center;font:300 15px/1.6 system-ui,sans-serif;color:#0f285e;background:#faf9f7}a{color:inherit}</style></head>
<body><h1 style="font-size:22px;font-weight:600;text-transform:uppercase;margin:0">Richiesta non inviata</h1><p style="margin:0">${testo}</p><p style="margin:0"><a href="${indietro}">Torna al modulo</a> · <a href="https://wa.me/393338548712">Scrivici su WhatsApp</a></p></body></html>`;
}
