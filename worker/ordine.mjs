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
// Il pagamento di prova (proprietario, 2026-11-27: «per stripe crea solo una demo poi lo collegheremo, ora mi va bene
// fare un test fake»; «Per tutti, scritto chiaro»). Con la variabile PAGAMENTO_PROVA = "1" e senza la chiave di Stripe,
// l'ordine si salva come quello vero e, al posto della pagina di Stripe, si apre una pagina nostra che dice chiaro che è
// una prova e non addebita nulla:
//   GET  /api/pagamento-prova   la pagina, con l'ordine e il totale (o, t: l'ordine e il suo gettone, una volta sola)
//   POST /api/pagamento-prova   «Completa il pagamento di prova»: l'ordine diventa «pagato» (pagamento = 'prova') e
//                               partono le email, segnate PROVA in oggetto e in cima (worker/email.mjs)
// Appena c'è la chiave di Stripe, il pagamento vero prende il suo posto da sé.
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
// La miniatura della camicia per le email (src/configuratore/miniatura.js, proprietario 2026-11-27): un quadrato JPEG
// di 1200 punti, che con il vetro blu pesa fra 50 e 100 KB. Si accetta fino a 300 KB, e solo di quella misura: ciò che
// arriva qui finisce in un'email, quindi deve essere almeno una foto JPEG vera della grandezza giusta
export const MINIATURA = { lato: 1200, peso: 300 * 1024 };
const PESO_CON_MINIATURA = PESO_MASSIMO + Math.ceil(MINIATURA.peso / 3) * 4 + 64;
const PESO_WEBHOOK = 262144;           // un evento di Stripe è grande qualche kilobyte
const TOLLERANZA = 300;                // secondi: una firma di Stripe più vecchia di cinque minuti non vale (anche ripetuta)
const PAGINA = '/camicie-su-misura/configuratore/';
const PROVA = '/api/pagamento-prova';

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

// ---------------------------------------------------------------- la miniatura della camicia

/** Larghezza e altezza di un JPEG, dalla sua cornice SOF; null se il file non si legge. */
export function misuraJpeg(b) {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }                                    // riempimento
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; }
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [(b[i + 7] << 8) | b[i + 8], (b[i + 5] << 8) | b[i + 6]];
    if (m === 0xda || m === 0xd9) return null;                            // i dati dell'immagine prima della misura: no
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return null;
}

/**
 * La miniatura mandata con l'ordine, se è buona: il testo base64 del JPEG; '' se manca o non va (l'ordine parte
 * lo stesso, e l'email mette la sua foto di sempre).
 */
export function miniaturaValida(v) {
  const testa = 'data:image/jpeg;base64,';
  if (typeof v !== 'string' || !v.startsWith(testa)) return '';
  const b64 = v.slice(testa.length);
  if (!b64 || b64.length > Math.ceil(MINIATURA.peso / 3) * 4 || b64.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return '';
  let b;
  try { b = Uint8Array.from(atob(b64), (x) => x.charCodeAt(0)); } catch { return ''; }
  // un JPEG comincia con FFD8 e finisce con FFD9, e dice da sé quanto è grande
  if (b.length < 1024 || b[0] !== 0xff || b[1] !== 0xd8 || b[b.length - 2] !== 0xff || b[b.length - 1] !== 0xd9) return '';
  const m = misuraJpeg(b);
  return m && m[0] === MINIATURA.lato && m[1] === MINIATURA.lato ? b64 : '';
}

/** GET /api/camicia-ordine?o=<ordine>&k=<chiave>: la miniatura di un ordine, per le sue email. La chiave è casuale e
 *  sta solo nelle email: senza, non si vede niente. */
export async function camiciaOrdine(request, env) {
  const no = () => new Response('Non trovata', { status: 404, headers: BASE });
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Metodo non consentito', { status: 405, headers: { ...BASE, Allow: 'GET, HEAD' } });
  const u = new URL(request.url);
  const o = u.searchParams.get('o') || '', k = u.searchParams.get('k') || '';
  if (!env.DB || !/^[0-9a-f]{32}$/.test(o) || !/^[0-9a-f]{32}$/.test(k)) return no();
  let riga;
  try {
    riga = await env.DB.prepare("SELECT immagine FROM ordini WHERE id = ? AND immagine_chiave = ? AND immagine <> ''").bind(o, k).first();
  } catch {
    return no();
  }
  if (!riga?.immagine) return no();
  let b;
  try { b = Uint8Array.from(atob(riga.immagine), (x) => x.charCodeAt(0)); } catch { return no(); }
  return new Response(request.method === 'HEAD' ? null : b, {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg', 'Content-Length': String(b.length),
      // non cambia mai: i programmi di posta (e i loro intermediari, come quello di Gmail) la tengono quanto vogliono
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy': "default-src 'none'", 'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  });
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
  // (in JSON può arrivare anche la miniatura della camicia: allora il limite è più alto, vedi MINIATURA)
  const inJson = (request.headers.get('Content-Type') || '').includes('application/json');
  const peso = inJson ? PESO_CON_MINIATURA : PESO_MASSIMO;
  if (Number(request.headers.get('Content-Length') || 0) > peso) return sbaglio(413, 'Richiesta troppo grande.');

  let fonte;
  try {
    if (inJson) {
      const grezzo = await request.text();
      if (grezzo.length > peso) return sbaglio(413, 'Richiesta troppo grande.');
      fonte = JSON.parse(grezzo);
      if (!fonte || typeof fonte !== 'object' || Array.isArray(fonte)) throw new Error('non è un oggetto');
      // il peso in più vale solo per la miniatura: il resto dell'ordine sta nel limite di sempre
      if (grezzo.length - (typeof fonte.immagine === 'string' ? fonte.immagine.length : 0) > PESO_MASSIMO) return sbaglio(413, 'Richiesta troppo grande.');
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
  // Acceso solo se c'è TUTTO ciò che serve perché un ordine pagato arrivi a Endero: con una chiave sola il cliente
  // pagherebbe e l'ordine non arriverebbe a nessuno (revisione del 2026-11-26)
  if (!pagamentoAcceso(env)) {
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
  // la miniatura, a parte: se non c'è o non si salva, l'ordine va avanti lo stesso (e l'email mette la foto di sempre)
  const foto = inJson ? miniaturaValida(fonte.immagine) : '';
  if (foto) {
    try {
      await env.DB.prepare('UPDATE ordini SET immagine = ?, immagine_chiave = ? WHERE id = ?').bind(foto, casuale(), id).run();
    } catch (errore) {
      console.error('miniatura non salvata', numero, String(errore));
    }
  }

  // il pagamento di prova: una pagina nostra al posto di quella di Stripe, con un gettone che vale per quest'ordine
  if (pagamentoDiProva(env)) {
    const gettone = casuale();
    try {
      await env.DB.prepare("UPDATE ordini SET sessione = ?, aggiornato = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").bind(`prova:${gettone}`, id).run();
    } catch (errore) {
      console.error('pagamento di prova non preparato', numero, errore);
      return sbaglio(500, senzaSegnaposto(T.errore));
    }
    // (un indirizzo di questo sito, senza dominio: la pagina accetta solo Stripe o il sito stesso)
    const vai = `${PROVA}?o=${id}&t=${gettone}`;
    if (vuoleJson) return json({ ok: true, vai });
    return new Response(null, { status: 303, headers: { ...BASE, Location: vai } });
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

/** Il pagamento di prova: chiesto con PAGAMENTO_PROVA = "1", e solo finché non c'è la chiave di Stripe. */
export const pagamentoDiProva = (env) => !env.STRIPE_SECRET_KEY && String(env.PAGAMENTO_PROVA || '') === '1';

/** Il pagamento è acceso: ci sono il database, le email e chi le riceve, e le chiavi di Stripe (anche quella del
 *  webhook) o il pagamento di prova. */
function pagamentoAcceso(env) {
  const resto = !!(env.DB && env.RESEND_API_KEY && (env.EMAIL_ORDINI || env.EMAIL_DESTINATARIO));
  return resto && (pagamentoDiProva(env) || !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET));
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
  // senza la chiave delle email si risponde con un errore: Stripe riprova, e l'ordine pagato non resta muto
  if (!env.RESEND_API_KEY) return no(500, 'Email non configurata');
  const presa = await env.DB.prepare('UPDATE ordini SET email_inviate = 1 WHERE id = ? AND email_inviate = 0').bind(id).run();
  if (!(presa.meta?.changes > 0)) return json({ ricevuto: true });
  // (un pagamento fatto con le chiavi di prova di Stripe arriva al reparto segnato PROVA, non come un ordine vero)
  const esito = await avvisaOrdine(env, { ...(await comeEmail(env, riga)), ...(evento.livemode === false ? { prova: true } : {}) });
  if (!esito.endero) {
    await env.DB.prepare('UPDATE ordini SET email_inviate = 0 WHERE id = ?').bind(id).run().catch(() => {});
    return no(500, 'Email non partita');
  }
  return json({ ricevuto: true });
}

// ---------------------------------------------------------------- /api/pagamento-prova

const centesimiInEuro = (c) => `${(Number(c || 0) / 100).toFixed(2).replace('.', ',')} €`;

/** La pagina del pagamento di prova, nei colori del sito. Dice chiaro che non addebita nulla. */
function paginaProva({ numero, totale, o, t }) {
  const P = S.pagamento.prova;
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${pulisci(P.titolo)} · Endero</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font:300 16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f285e;background:#f5f3ef}
main{width:100%;max-width:480px;background:#fff;border-radius:20px;padding:36px 28px;box-shadow:0 1px 2px rgba(15,40,94,.06),0 12px 32px rgba(15,40,94,.08)}
.etichetta{margin:0;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#5b6b8c}
h1{margin:10px 0 0;font-size:26px;line-height:1.2;font-weight:600;text-transform:uppercase;letter-spacing:.01em}
.avviso{margin:18px 0 0;padding:14px 16px;border-radius:12px;background:#fff3c4;font-weight:500}
dl{margin:22px 0 0;display:grid;grid-template-columns:1fr auto;gap:8px 16px}dt{color:#5b6b8c}dd{margin:0;text-align:right;font-weight:600;font-variant-numeric:tabular-nums}
.totale{font-size:22px}
form{margin:26px 0 0}button{width:100%;min-height:52px;border:0;border-radius:999px;background:#0f285e;color:#fff;font-family:inherit;font-weight:600;font-size:15px;line-height:1;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
button:focus-visible,a:focus-visible{outline:2px solid #2a63f5;outline-offset:3px}
.annulla{display:block;margin:16px 0 0;text-align:center;color:inherit}
</style></head>
<body><main>
<p class="etichetta">${pulisci(riempiProva(P.etichetta, { numero }))}</p>
<h1>${pulisci(P.titolo)}</h1>
<p class="avviso">${pulisci(P.avviso)}</p>
<dl><dt>${pulisci(P.ordine)}</dt><dd>${pulisci(numero)}</dd><dt>${pulisci(P.totale)}</dt><dd class="totale">${pulisci(totale)}</dd></dl>
<form method="post" action="${PROVA}"><input type="hidden" name="o" value="${pulisci(o)}"><input type="hidden" name="t" value="${pulisci(t)}"><button type="submit">${pulisci(P.paga)}</button></form>
<a class="annulla" href="${PAGINA}?ordine=annullato">${pulisci(P.annulla)}</a>
</main></body></html>`;
  return new Response(html, { status: 200, headers: { ...BASE, 'Content-Type': 'text/html; charset=utf-8' } });
}
const riempiProva = (modello, valori) => String(modello).replace(/\{(\w+)\}/g, (_, k) => valori[k] ?? '');

/** GET e POST /api/pagamento-prova (vedi in cima al file). */
export async function pagamentoProva(request, env) {
  const P = S.pagamento.prova;
  const fuori = (frase, stato = 404) => paginaSemplice(P.titolo, [frase], stato);
  if (!pagamentoDiProva(env) || !env.DB) return fuori(P.spento, 404);
  let o = '', t = '';
  if (request.method === 'GET') {
    const u = new URL(request.url);
    o = u.searchParams.get('o') || ''; t = u.searchParams.get('t') || '';
  } else if (request.method === 'POST') {
    const origine = request.headers.get('Origin');
    if (origine && origine !== new URL(request.url).origin) return fuori('Richiesta non valida.', 403);
    if (Number(request.headers.get('Content-Length') || 0) > 2048) return fuori('Richiesta non valida.', 413);
    try {
      const f = await request.formData();
      o = String(f.get('o') || ''); t = String(f.get('t') || '');
    } catch {
      return fuori('Richiesta non valida.', 400);
    }
  } else {
    return new Response('Metodo non consentito', { status: 405, headers: { ...BASE, Allow: 'GET, POST' } });
  }
  if (!/^[0-9a-f]{32}$/.test(o) || !/^[0-9a-f]{32}$/.test(t)) return fuori(P.non_trovato, 404);
  const riga = await env.DB.prepare('SELECT * FROM ordini WHERE id = ? AND sessione = ?').bind(o, `prova:${t}`).first();
  if (!riga) return fuori(P.non_trovato, 404);
  // già pagato (il tasto premuto due volte, la pagina ricaricata): si va al grazie, senza rifare nulla
  if (riga.stato === 'pagato') return new Response(null, { status: 303, headers: { ...BASE, Location: `${PAGINA}?ordine=fatto` } });
  if (riga.stato !== 'da_pagare') return fuori(P.non_trovato, 404);
  if (request.method === 'GET') return paginaProva({ numero: riga.numero, totale: centesimiInEuro(riga.totale_centesimi), o, t });

  // da pagare → pagato, una volta sola
  const fatto = await env.DB.prepare(
    `UPDATE ordini SET stato = 'pagato', pagato = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), aggiornato = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
       pagamento = 'prova', pagato_centesimi = totale_centesimi
     WHERE id = ? AND sessione = ? AND stato = 'da_pagare'`
  ).bind(o, `prova:${t}`).run();
  if (fatto.meta?.changes > 0) {
    const presa = await env.DB.prepare('UPDATE ordini SET email_inviate = 1 WHERE id = ? AND email_inviate = 0').bind(o).run();
    if (presa.meta?.changes > 0) {
      const aggiornata = await env.DB.prepare('SELECT * FROM ordini WHERE id = ?').bind(o).first();
      const esito = await avvisaOrdine(env, { ...(await comeEmail(env, aggiornata)), prova: true }).catch((errore) => {
        console.error('email del pagamento di prova non partite', riga.numero, errore);
        return { endero: false };
      });
      if (!esito.endero) await env.DB.prepare('UPDATE ordini SET email_inviate = 0 WHERE id = ?').bind(o).run().catch(() => {});
    }
  }
  return new Response(null, { status: 303, headers: { ...BASE, Location: `${PAGINA}?ordine=fatto` } });
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
    // pagato con il pagamento di prova: le email lo dicono in oggetto e in cima
    prova: riga.pagamento === 'prova',
    // la miniatura della camicia (src/configuratore/miniatura.js), se c'è: l'ordine e la sua chiave
    miniatura: riga.immagine_chiave && riga.immagine ? { o: riga.id, k: riga.immagine_chiave } : null,
  };
}
