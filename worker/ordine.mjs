// L'ordine del configuratore di camicie su misura, dal lato del Worker (direzione creativa, punto 16, «Pagamento e
// ordine»). Il percorso:
//
//   POST /api/ordine   la pagina manda l'ordine (JSON con lo script, modulo normale senza). Qui si ricontrolla tutto con
//                      le stesse regole della pagina (src/configuratore/ordine.mjs), si rifà il prezzo (quello che arriva
//                      dal browser non conta mai), si calcola la taglia (worker/taglie.mjs), si salva l'ordine «da
//                      pagare» e si apre la pagina di pagamento di Stripe.
//   POST /api/stripe   Stripe avvisa che il pagamento è fatto (webhook firmato): l'ordine diventa «pagato», una volta
//                      sola, e partono le email a Endero e a Ennio (con il nome vero dei tessuti) e al cliente.
//
// Finché il Worker non ha la chiave di Stripe (o il database, come nell'anteprima) il pagamento è spento: l'ordine si
// controlla lo stesso, ma la risposta è { ok: true, pagamento: 'non_attivo' } e non si salva né si manda nulla.
//
// Segreti del Worker, mai nel repository: STRIPE_SECRET_KEY (la chiave segreta di Stripe, sk_…), STRIPE_WEBHOOK_SECRET
// (la chiave del webhook, whsec_…), EMAIL_ORDINI (chi riceve gli ordini, uno o più indirizzi separati da virgola; se
// manca, EMAIL_DESTINATARIO), più quelli che ci sono già (TURNSTILE_SECRET, RESEND_API_KEY). Variabile facoltativa:
// STRIPE_API, l'indirizzo base delle API di Stripe (solo per i controlli, che usano una Stripe finta).
// Configurazione riservata, archivio KV legato come RISERVATO: «riservato/taglie» (le camicie campione delle otto
// taglie) e «riservato/tessuti» (il nome vero di ogni tessuto nella cartella colori). Se manca, l'ordine passa lo
// stesso: senza taglia calcolata, e con il nome del sito al posto di quello vero.
//
// Questo file non è il punto d'ingresso del Worker: può esportare anche costanti (vedi CLAUDE.md, 2026-11-20).

import configuratore from '../contenuti/it/configuratore.json';
import catalogo from '../contenuti/it/tessuti.json';
import { controllaOrdine, ordinePulito, MISURE } from '../src/configuratore/ordine.mjs';
import { senzaInvisibili } from '../src/controlli.mjs';
import { leggiConfigurazione, perIlReparto } from './taglie.mjs';
import { avvisaOrdine } from './email.mjs';

const S = configuratore.scheda;
/** Gli id dei tessuti che esistono: un tessuto che non è nel catalogo non si ordina. */
export const TESSUTI = new Set(catalogo.tessuti.map((t) => t.id));
const PESO_MASSIMO = 32768;            // byte: un ordine compilato ne pesa pochi, il resto è abuso
const PESO_WEBHOOK = 262144;           // un evento di Stripe è grande qualche kilobyte
const TOLLERANZA = 300;                // secondi: una firma di Stripe più vecchia di cinque minuti non vale (anche ripetuta)
const PAGINA = '/camicie-su-misura/configuratore/';

// ---------------------------------------------------------------- i campi che si accettano

// tutti i campi del configuratore con la loro lunghezza massima (dai testi della pagina, dove c'è); ogni altro campo
// che arriva (un prezzo, un totale, un nome inventato) si butta
const MASSIMI = new Map();
const metti = (nome, max = 64) => MASSIMI.set(nome, max);
for (const c of S.camicia.campi) {
  metti(c.nome, c.tipo === 'quantita' ? 8 : 64);
  for (const f of c.se_si || []) metti(f.nome, f.tipo === 'lettere' ? 12 : 64);
}
for (const m of MISURE) metti(m.nome, 12);
for (const c of S.dati.campi) metti(c.nome, c.massimo || 160);
metti('spedizione');
for (const c of S.spedizione.indirizzo.campi) metti(c.nome, Math.max(c.massimo || 160, 8));
metti('privacy', 8);

// i nomi dei campi per la pagina d'errore senza script: «Tessuto del taschino: scegli il tessuto del taschino.»
const ETICHETTE = {
  ...Object.fromEntries(S.camicia.campi.flatMap((c) => [[c.nome, c.etichetta], ...(c.se_si || []).map((f) => [f.nome, f.etichetta])])),
  ...Object.fromEntries(MISURE.map((m) => [m.nome, m.etichetta])),
  ...Object.fromEntries(S.dati.campi.map((c) => [c.nome, c.etichetta])),
  ...Object.fromEntries(S.spedizione.indirizzo.campi.map((c) => [c.nome, c.etichetta])),
  spedizione: S.passi.find((p) => p.id === 'spedizione')?.nome || 'Spedizione',
  privacy: 'Privacy',
};

/** Un valore che arriva da fuori, come testo pulito: niente caratteri di controllo né invisibili, tagliato al massimo. */
function testo(v, max) {
  if (v === true) v = 'si';
  else if (v === false) v = 'no';
  else if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
  if (typeof v !== 'string') return '';
  return senzaInvisibili(v).replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, max);
}

/**
 * I dati dell'ordine come li vuole src/configuratore/ordine.mjs: piatti, solo i campi previsti, testi puliti.
 * `fonte` è un oggetto (JSON) o un FormData (modulo senza script).
 */
export function datiPuliti(fonte) {
  const d = {};
  const leggi = (nome) => (typeof fonte?.get === 'function' ? fonte.get(nome) : Object.hasOwn(fonte || {}, nome) ? fonte[nome] : undefined);
  for (const [nome, max] of MASSIMI) {
    const v = testo(leggi(nome), max);
    if (v) d[nome] = v;
  }
  return d;
}

// ---------------------------------------------------------------- la risposta

const BASE = { 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' };
const json = (dati, status = 200) => Response.json(dati, { status, headers: BASE });
const pulisci = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// i segnaposto da confermare ([[ ]]) nell'anteprima sono gialli; in una risposta del Worker si toglie solo la cornice
const senzaSegnaposto = (s) => String(s || '').replace(/\[\[|\]\]/g, '');

/** La pagina semplice per chi ordina senza script: un titolo, le frasi, il ritorno al configuratore. */
function paginaSemplice(titolo, frasi, status) {
  const corpo = frasi.map((f) => `<p>${pulisci(f)}</p>`).join('');
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${pulisci(titolo)} · Endero</title>
<style>body{margin:0;min-height:100vh;display:grid;place-content:center;gap:16px;padding:24px;max-width:560px;margin-inline:auto;text-align:center;font:300 15px/1.6 system-ui,sans-serif;color:#0f285e;background:#faf9f7}a{color:inherit}h1{font-size:22px;font-weight:600;text-transform:uppercase}h1,p{margin:0}</style></head>
<body><h1>${pulisci(titolo)}</h1>${corpo}<p>Torna indietro con il tasto del browser: quello che hai scritto resta lì.</p><p><a href="${PAGINA}">Torna al configuratore</a> · <a href="https://wa.me/393338548712">Scrivici su WhatsApp</a></p></body></html>`;
  return new Response(html, { status, headers: { ...BASE, 'Content-Type': 'text/html; charset=utf-8' } });
}

// ---------------------------------------------------------------- configurazione riservata

/** Legge un JSON dall'archivio riservato; null se il legame, la voce o il JSON mancano. */
export async function riservato(env, chiave) {
  if (!env.RISERVATO?.get) return null;
  try {
    const t = await env.RISERVATO.get(chiave);
    return t ? JSON.parse(t) : null;
  } catch (errore) {
    console.error('configurazione riservata non leggibile', chiave, String(errore));
    return null;
  }
}

/**
 * La taglia di partenza per il reparto: { taglia, riga, variazioni, daVerificare, motivi, testo }, o null se la tabella
 * riservata non c'è. Le misure sono quelle della camicia stesa (le larghezze le raddoppia taglie.mjs, campi con giro).
 */
export async function taglia(env, misure) {
  const tabella = await riservato(env, 'riservato/taglie');
  if (!tabella) return null;
  try {
    return perIlReparto(misure, leggiConfigurazione(tabella));
  } catch (errore) {
    console.error('taglia non calcolata', String(errore));
    return null;
  }
}

// ---------------------------------------------------------------- Stripe

const centesimi = (euro) => Math.round(euro * 100);
const stripeBase = (env) => String(env.STRIPE_API || 'https://api.stripe.com').replace(/\/$/, '');

/** Il corpo della richiesta a Stripe per la pagina di pagamento, già in forma di modulo. */
export function sessioneStripe(ordine, { id, numero, origine }) {
  const c = ordine.conti;
  const p = new URLSearchParams();
  p.set('mode', 'payment');
  p.set('locale', 'it');
  p.set('line_items[0][price_data][currency]', 'eur');
  p.set('line_items[0][price_data][unit_amount]', String(centesimi(c.camicia)));
  p.set('line_items[0][price_data][product_data][name]', 'Camicia su misura Endero');
  p.set('line_items[0][price_data][product_data][description]', `Ordine ${numero}`);
  p.set('line_items[0][quantity]', String(c.quantita));
  if (c.spedizione > 0) {
    const modo = S.spedizione.opzioni.find((s) => s.id === ordine.spedizione.modo);
    p.set('line_items[1][price_data][currency]', 'eur');
    p.set('line_items[1][price_data][unit_amount]', String(centesimi(c.spedizione)));
    p.set('line_items[1][price_data][product_data][name]', `Spedizione${modo?.dettaglio ? ` · ${modo.dettaglio}` : ''}`);
    p.set('line_items[1][quantity]', '1');
  }
  p.set('customer_email', ordine.cliente.email);
  p.set('client_reference_id', id);
  p.set('metadata[ordine]', id);
  p.set('metadata[numero]', numero);
  p.set('payment_intent_data[metadata][ordine]', id);
  p.set('payment_intent_data[metadata][numero]', numero);
  p.set('success_url', `${origine}${PAGINA}?ordine=fatto`);
  p.set('cancel_url', `${origine}${PAGINA}?ordine=annullato`);
  return p;
}

/** Apre la pagina di pagamento. Restituisce { id, url } o lancia un errore. */
async function apriPagamento(env, corpo, id) {
  const risposta = await fetch(`${stripeBase(env)}/v1/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      // la stessa richiesta ripetuta (rete che cade a metà) non apre due pagamenti
      'Idempotency-Key': id,
    },
    body: corpo.toString(),
  });
  const dati = await risposta.json().catch(() => ({}));
  if (!risposta.ok || typeof dati.url !== 'string' || !/^https:\/\//.test(dati.url) || typeof dati.id !== 'string') {
    throw new Error(`Stripe ha risposto ${risposta.status}: ${JSON.stringify(dati.error?.message || dati).slice(0, 200)}`);
  }
  return { id: dati.id.slice(0, 255), url: dati.url };
}

// ---------------------------------------------------------------- POST /api/ordine

const casuale = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function ordine(request, env, ctx) {
  const vuoleJson = (request.headers.get('Accept') || '').includes('application/json')
    || (request.headers.get('Content-Type') || '').includes('application/json');
  const T = S.pagamento;
  const sbaglio = (stato, frase) => (vuoleJson ? json({ ok: false, errore: frase }, stato) : paginaSemplice('Ordine non inviato', [frase], stato));

  // solo dal sito stesso e di peso ragionevole
  const origineSito = new URL(request.url).origin;
  const origine = request.headers.get('Origin');
  if (origine && origine !== origineSito) return sbaglio(403, 'Richiesta non valida.');
  if (Number(request.headers.get('Content-Length') || 0) > PESO_MASSIMO) return sbaglio(413, 'Richiesta troppo grande.');

  let fonte;
  try {
    if ((request.headers.get('Content-Type') || '').includes('application/json')) {
      const grezzo = await request.text();
      if (grezzo.length > PESO_MASSIMO) return sbaglio(413, 'Richiesta troppo grande.');
      fonte = JSON.parse(grezzo);
      if (!fonte || typeof fonte !== 'object' || Array.isArray(fonte)) throw new Error('non è un oggetto');
    } else {
      fonte = await request.formData();
    }
  } catch {
    return sbaglio(400, 'Richiesta non valida.');
  }
  const leggi = (nome) => (typeof fonte.get === 'function' ? fonte.get(nome) : fonte[nome]);
  // esca per i programmi automatici: una persona non vede e non compila questo campo
  if (testo(leggi('sito_web'), 200)) return vuoleJson ? json({ ok: true, pagamento: 'non_attivo' }) : paginaSemplice('Pagamento non attivo', [senzaSegnaposto(T.non_attivo)], 200);

  const d = datiPuliti(fonte);
  const errori = controllaOrdine(d, { tessuti: TESSUTI });
  if (Object.keys(errori).length) {
    if (vuoleJson) return json({ ok: false, errori }, 422);
    return paginaSemplice('Ordine non inviato', Object.entries(errori).map(([c, f]) => `${ETICHETTE[c] || c}: ${f.charAt(0).toLowerCase()}${f.slice(1)}`), 422);
  }

  // pagamento spento (manca la chiave di Stripe, o il database come nell'anteprima): l'ordine è giusto, ma non parte.
  // Si risponde prima dell'antispam, così il gettone di Turnstile non si spreca
  if (!env.STRIPE_SECRET_KEY || !env.DB) {
    return vuoleJson ? json({ ok: true, pagamento: 'non_attivo' }) : paginaSemplice('Pagamento non attivo', [senzaSegnaposto(T.non_attivo)], 200);
  }

  // antispam, come per i moduli: obbligatorio appena la chiave segreta è configurata
  if (env.TURNSTILE_SECRET) {
    let superata = false;
    try {
      const verifica = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: testo(leggi('cf-turnstile-response'), 4096), remoteip: request.headers.get('CF-Connecting-IP') || '' }),
      });
      superata = Boolean((await verifica.json()).success);
    } catch (errore) {
      console.error('verifica antispam non riuscita', errore);
    }
    if (!superata) return sbaglio(403, 'La verifica antispam non è riuscita. Riprova.');
  }

  // l'ordine come lo vuole il reparto: pulito, con il prezzo rifatto qui e la taglia di partenza
  const o = ordinePulito(d);
  const t = await taglia(env, o.misure);
  const id = casuale();
  const c = o.conti;
  let numero;
  try {
    const riga = await env.DB.prepare(
      `INSERT INTO ordini (id, ordine, email, quantita, camicia_centesimi, spedizione_centesimi, totale_centesimi, taglia, paese)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING n, creato`
    ).bind(id, JSON.stringify(o), o.cliente.email, c.quantita, centesimi(c.camicia), centesimi(c.spedizione || 0), centesimi(c.totale),
      t ? JSON.stringify({ taglia: t.taglia, riga: t.riga, variazioni: t.variazioni, daVerificare: t.daVerificare, motivi: t.motivi }) : '',
      request.cf?.country || '').first();
    // il numero leggibile, che il cliente e Endero si dicono al telefono: E-2026-000123
    numero = `E-${String(riga.creato).slice(0, 4)}-${String(riga.n).padStart(6, '0')}`;
    await env.DB.prepare('UPDATE ordini SET numero = ? WHERE id = ?').bind(numero, id).run();
  } catch (errore) {
    console.error('ordine non salvato', errore);
    return sbaglio(500, senzaSegnaposto(T.errore));
  }

  let sessione;
  try {
    sessione = await apriPagamento(env, sessioneStripe(o, { id, numero, origine: origineSito }), id);
  } catch (errore) {
    console.error('pagamento non aperto', numero, String(errore));
    await env.DB.prepare("UPDATE ordini SET stato = 'annullato', aggiornato = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").bind(id).run().catch(() => {});
    return sbaglio(502, senzaSegnaposto(T.errore));
  }
  await env.DB.prepare("UPDATE ordini SET sessione = ?, aggiornato = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").bind(sessione.id, id).run()
    .catch((errore) => console.error('sessione non salvata', numero, errore));
  if (vuoleJson) return json({ ok: true, vai: sessione.url });
  return new Response(null, { status: 303, headers: { ...BASE, Location: sessione.url } });
}

// ---------------------------------------------------------------- POST /api/stripe

const daEsadecimale = (h) => (/^[0-9a-f]{64}$/i.test(h) ? Uint8Array.from(h.match(/../g), (x) => parseInt(x, 16)) : null);

/**
 * Vero se l'intestazione Stripe-Signature firma questo corpo: HMAC-SHA256 di «t.corpo» con la chiave del webhook,
 * una delle firme v1 uguale, e t entro cinque minuti da adesso. Il confronto lo fa crypto.subtle.verify, a tempo
 * costante.
 */
export async function firmaValida(corpo, intestazione, segreto, adesso = Date.now()) {
  if (!segreto || !intestazione) return false;
  const parti = String(intestazione).split(',').map((x) => x.trim().split('='));
  const t = parti.find(([k]) => k === 't')?.[1];
  const firme = parti.filter(([k]) => k === 'v1').map(([, v]) => daEsadecimale(v || '')).filter(Boolean);
  if (!/^\d{1,12}$/.test(t || '') || !firme.length) return false;
  if (Math.abs(adesso / 1000 - Number(t)) > TOLLERANZA) return false;
  const chiave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const dati = new TextEncoder().encode(`${t}.${corpo}`);
  for (const f of firme) if (await crypto.subtle.verify('HMAC', chiave, f, dati)) return true;
  return false;
}

export async function stripe(request, env) {
  const no = (status, frase) => new Response(frase, { status, headers: BASE });
  if (!env.STRIPE_WEBHOOK_SECRET || !env.DB) return no(503, 'Pagamento non attivo');
  if (Number(request.headers.get('Content-Length') || 0) > PESO_WEBHOOK) return no(413, 'Troppo grande');
  // il corpo grezzo, così com'è arrivato: la firma è calcolata su questi byte
  const corpo = await request.text();
  if (corpo.length > PESO_WEBHOOK) return no(413, 'Troppo grande');
  if (!(await firmaValida(corpo, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET))) return no(400, 'Firma non valida');

  let evento;
  try { evento = JSON.parse(corpo); } catch { return no(400, 'Evento non valido'); }
  const tipo = evento?.type;
  const s = evento?.data?.object || {};
  // con le carte il pagamento è fatto alla fine della pagina di Stripe; con i metodi che arrivano dopo (bonifico SEPA,
  // se un giorno si accendono) l'avviso giusto è async_payment_succeeded. Gli altri eventi: ricevuti e basta
  const pagato = (tipo === 'checkout.session.completed' && s.payment_status === 'paid') || tipo === 'checkout.session.async_payment_succeeded';
  if (!pagato) return json({ ricevuto: true });

  const id = typeof s.client_reference_id === 'string' ? s.client_reference_id : s.metadata?.ordine;
  if (!/^[0-9a-f]{32}$/.test(String(id || ''))) {
    console.error('pagamento senza ordine riconoscibile', s.id);
    return json({ ricevuto: true });
  }
  const pagatoCentesimi = Number.isInteger(s.amount_total) ? s.amount_total : null;
  // da pagare → pagato, una volta sola: un evento ripetuto non trova più nulla da cambiare
  await env.DB.prepare(
    `UPDATE ordini SET stato = 'pagato', pagato = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), aggiornato = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
       pagamento = ?, pagato_centesimi = ?, email_pagamento = ?
     WHERE id = ? AND stato = 'da_pagare'`
  ).bind(String(s.payment_intent || s.id || '').slice(0, 255), pagatoCentesimi, testo(s.customer_details?.email, 160), id).run();
  const riga = await env.DB.prepare('SELECT * FROM ordini WHERE id = ?').bind(id).first();
  if (!riga) {
    console.error('pagamento per un ordine che non c\'è', id);
    return json({ ricevuto: true });
  }
  if (riga.stato !== 'pagato') return json({ ricevuto: true });
  if (riga.sessione && s.id && riga.sessione !== s.id) console.error('sessione di Stripe diversa da quella salvata', riga.numero);
  if (pagatoCentesimi !== null && pagatoCentesimi !== riga.totale_centesimi) console.error('importo pagato diverso dal totale', riga.numero, pagatoCentesimi, riga.totale_centesimi);

  // le email partono una volta sola: chi «prende» l'invio (0 → 1) lo fa. Se l'avviso a Endero non parte, si rimette
  // a 0 e si risponde con un errore: Stripe riprova più tardi, e solo allora si rimanda
  if (!env.RESEND_API_KEY) return json({ ricevuto: true });
  const presa = await env.DB.prepare('UPDATE ordini SET email_inviate = 1 WHERE id = ? AND email_inviate = 0').bind(id).run();
  if (!(presa.meta?.changes > 0)) return json({ ricevuto: true });
  const esito = await avvisaOrdine(env, await comeEmail(env, riga));
  if (!esito.endero) {
    await env.DB.prepare('UPDATE ordini SET email_inviate = 0 WHERE id = ?').bind(id).run().catch(() => {});
    return no(500, 'Email non partita');
  }
  return json({ ricevuto: true });
}

/** Dalla riga salvata a ciò che serve alle email: l'ordine, il numero, la taglia, gli importi, i nomi veri dei tessuti. */
export async function comeEmail(env, riga) {
  let o = {}, t = null;
  try { o = JSON.parse(riga.ordine); } catch { o = {}; }
  try { t = riga.taglia ? JSON.parse(riga.taglia) : null; } catch { t = null; }
  const veri = (await riservato(env, 'riservato/tessuti')) || {};
  return {
    numero: riga.numero,
    ordine: o,
    taglia: t,
    pagato: riga.pagato ? new Date(riga.pagato) : new Date(),
    pagatoCentesimi: riga.pagato_centesimi,
    totaleCentesimi: riga.totale_centesimi,
    // l'indirizzo che il cliente ha scritto nella pagina di Stripe, se c'è: è quello con cui ha pagato
    emailCliente: riga.email_pagamento || o.cliente?.email || '',
    tessutiVeri: veri && typeof veri === 'object' ? veri : {},
  };
}
