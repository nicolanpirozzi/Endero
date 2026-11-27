// Controlla il Worker del sito vero (worker/index.js) senza Cloudflare: si avvia, riceve i moduli, cancella le
// richieste vecchie come promette l'informativa privacy.
//
//   node tools/prova-worker.mjs
//
// Perché serve: «wrangler deploy --dry-run» non si accorge di un Worker che non parte. Il 2026-11-20 due costanti
// esportate dal file principale lo bloccavano (Cloudflare prende ogni cosa esportata per un punto d'ingresso, e un
// numero non lo è): qui si guarda che esporti solo funzioni.
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
let passati = 0;
const falliti = [];
const controlla = (nome, vero, dettaglio = '') => {
  if (vero) passati++; else falliti.push(nome + (dettaglio ? ` (${dettaglio})` : ''));
  console.log(`${vero ? '  ok ' : '  NO '} ${nome}${!vero && dettaglio ? ' → ' + dettaglio : ''}`);
};

// il Worker com'è caricato su Cloudflare: un file solo, con i testi dentro
const cartella = mkdtempSync(join(tmpdir(), 'endero-worker-'));
const uscita = join(cartella, 'worker.mjs');
await build({ entryPoints: [join(RADICE, 'worker/index.js')], bundle: true, format: 'esm', platform: 'neutral', outfile: uscita, logLevel: 'silent' });
const worker = await import(pathToFileURL(uscita));
const conservazione = await import(pathToFileURL(join(RADICE, 'worker/conservazione.mjs')));

console.log('Il Worker si avvia');
const nomi = Object.keys(worker).filter((n) => n !== 'default');
controlla('esporta solo funzioni (altrimenti Cloudflare non lo avvia)', nomi.every((n) => typeof worker[n] === 'function'), nomi.filter((n) => typeof worker[n] !== 'function').join(', '));
controlla('ha fetch e scheduled', typeof worker.default?.fetch === 'function' && typeof worker.default?.scheduled === 'function');
const configurazione = readFileSync(join(RADICE, 'wrangler.toml'), 'utf8');
controlla('wrangler.toml lo fa partire ogni notte', /\[triggers\][\s\S]*crons\s*=\s*\["[0-9*,/ -]+"\]/.test(configurazione));

// un database vero (SQLite, come D1) con lo schema del sito
const nuovoDb = () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(RADICE, 'db/schema.sql'), 'utf8'));
  // D1 visto dal Worker: prepare(...).bind(...).run() / .first() / .all()
  return {
    db,
    d1: {
      prepare: (sql) => {
        let valori = [];
        const s = () => db.prepare(sql.replace(/\?(\d+)/g, '?'));
        const passo = {
          bind: (...v) => { valori = v; return passo; },
          run: async () => ({ meta: { changes: Number(s().run(...valori).changes) } }),
          first: async () => s().get(...valori) ?? null,
          all: async () => ({ results: s().all(...valori) }),
        };
        return passo;
      },
    },
  };
};

console.log('I moduli');
{
  const { db, d1 } = nuovoDb();
  const invia = (campi) => {
    const corpo = new URLSearchParams({ privacy: 'si', ...campi });
    return worker.default.fetch(new Request('https://www.endero.it/api/contatto', { method: 'POST', body: corpo, headers: { Accept: 'application/json', Origin: 'https://www.endero.it', 'Content-Type': 'application/x-www-form-urlencoded' } }), { DB: d1 });
  };
  const r = await invia({ tipo: 'presa-misure', nome: 'Mario Prova', telefono: '+39 333 000 0005', email: ' Mario@X.it ' });
  controlla('una prenotazione si salva', r.status === 200 && (await r.json()).ok === true, String(r.status));
  const riga = db.prepare('SELECT telefono, email, chiave_telefono, chiave_email FROM richieste').get();
  controlla('con telefono ed email come li ha scritti, e le chiavi per riconoscere la persona', riga?.telefono === '+39 333 000 0005' && riga?.chiave_telefono === '3330000005' && riga?.chiave_email === 'mario@x.it', JSON.stringify(riga));
  const senza = await invia({ tipo: 'presa-misure', nome: 'Mario Prova', telefono: '' });
  const s = await senza.json();
  controlla('senza telefono non si salva, e il Worker dice quale campo manca', senza.status === 422 && s.campo === 'telefono', JSON.stringify(s));
  // gli stessi controlli della pagina (src/controlli.mjs): chi aggira lo script trova il Worker
  const prove = [
    [{ tipo: 'contatto', nome: 'Mario', telefono: '333 1234567', messaggio: 'x' }, 'nome'],
    [{ tipo: 'contatto', nome: 'Mario Rossi', telefono: 'chiamami', messaggio: 'x' }, 'telefono'],
    [{ tipo: 'contatto', nome: 'Mario Rossi', telefono: '000 000 0000', messaggio: 'x' }, 'telefono'],
    [{ tipo: 'contatto', nome: 'Mario Rossi', telefono: '333 1234567', email: 'mario@gmail', messaggio: 'x' }, 'email'],
    [{ tipo: 'contatto', nome: 'Mario Rossi', telefono: '333 1234567', messaggio: ' ' }, 'messaggio'],
    [{ tipo: 'contatto', nome: 'Mario Rossi', telefono: '333 1234567', messaggio: 'x', privacy: '' }, 'privacy'],
    [{ tipo: 'rivenditore', nome: 'Mario Rossi', telefono: '333 1234567', citta: 'Napoli', nazione: 'Italia', interesse: 'Rivenditore Endero' }, 'email'],
    [{ tipo: 'rivenditore', nome: 'Mario Rossi', telefono: '333 1234567', email: 'a@b.it', citta: 'Napoli 3', nazione: 'Italia', interesse: 'Rivenditore Endero' }, 'citta'],
    [{ tipo: 'rivenditore', nome: 'Mario Rossi', telefono: '333 1234567', email: 'a@b.it', citta: 'Napoli', nazione: 'Italia', interesse: 'Rivenditore Endero', partita_iva: '08887031213' }, 'partita_iva'],
    [{ tipo: 'rivenditore', nome: 'Mario Rossi', telefono: '333 1234567', email: 'a@b.it', citta: 'Napoli', nazione: 'Italia', interesse: 'Rivenditore Endero', profilo: 'il mio negozio' }, 'profilo'],
    [{ tipo: 'rivenditore', nome: 'Mario Rossi', telefono: '333 1234567', email: 'a@b.it', citta: 'Napoli', nazione: 'Italia' }, 'interesse'],
  ];
  for (const [campi, atteso] of prove) {
    const x = await invia(campi);
    const j = await x.json();
    controlla(`${campi.tipo}: ${atteso} sbagliato → 422 con il campo`, x.status === 422 && j.campo === atteso && Boolean(j.errore), JSON.stringify(j));
  }
  const buono = await invia({ tipo: 'rivenditore', nome: "Anna D'Angelo", telefono: '+44 20 7946 0958', email: 'anna@negozio.co.uk', citta: 'London', nazione: 'Regno Unito', interesse: 'Produzione conto terzi', partita_iva: 'GB123456789', profilo: '@negozio_london' });
  controlla('un rivenditore straniero scritto bene si salva', buono.status === 200, String(buono.status));
}

console.log('La stessa persona');
for (const [scritto, atteso] of [['333 000 0005', '3330000005'], ['+39 333-000-0005', '3330000005'], ['0039 3330000005', '3330000005'], ['(+39) 347 000 1111', '3470001111'], ['393470001111', '3470001111'], ['\u202a+39 333 123 4567\u202c', '3331234567'], ['Tel. 333.000.0005', '3330000005'], ['+41 79 123 45 67', '41791234567'], ['0041 79 123 45 67', '41791234567'], ['081 123 4567', '0811234567'], ['+39 081 123 4567', '0811234567'], ['', '']]) {
  controlla(`telefono «${scritto}» → ${atteso || 'vuoto'}`, conservazione.chiaveTelefono(scritto) === atteso, conservazione.chiaveTelefono(scritto));
}

console.log('Dopo 24 mesi dall\'ultima richiesta, via');
{
  const { db, d1 } = nuovoDb();
  const fa = (mesi) => db.prepare(`SELECT strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-${mesi} months', '-1 day') AS d`).get().d;
  const metti = (nome, telefono, email, mesi) => db.prepare('INSERT INTO richieste (nome, telefono, email, chiave_telefono, chiave_email, creata) VALUES (?, ?, ?, ?, ?, ?)').run(nome, telefono, email, conservazione.chiaveTelefono(telefono), conservazione.chiaveEmail(email), fa(mesi));
  metti('vecchia, sola', '333 111 1111', '', 30);
  metti('vecchia, la persona è tornata con il telefono scritto in un altro modo', '333 222 2222', '', 30);
  metti('recente, stesso telefono', '+39 3332222222', '', 2);
  metti('vecchia, la persona è tornata con l\'email in maiuscolo', '333 333 3333', 'mario@x.it', 26);
  metti('recente, stessa email', '333 999 9999', 'Mario@X.it', 1);
  metti('di 23 mesi', '333 444 4444', '', 23);
  metti('vecchia senza email, altri senza email recenti', '333 555 5555', '', 40);
  metti('recente senza email', '333 666 6666', '', 1);
  const via = await conservazione.dimentica(d1);
  const restano = db.prepare('SELECT nome FROM richieste ORDER BY id').all().map((x) => x.nome);
  controlla('cancella solo quelle di più di 24 mesi della persona che non è tornata', via === 2 && !restano.includes('vecchia, sola') && !restano.includes('vecchia senza email, altri senza email recenti') && restano.length === 6, `${via} cancellate; restano: ${restano.join(' | ')}`);
  // con molte richieste la cancellazione usa gli indici, non confronta ogni riga con tutte le altre
  const piano = db.prepare('EXPLAIN QUERY PLAN ' + conservazione.DIMENTICA).all().map((x) => x.detail).join(' | ');
  controlla('usa gli indici per telefono ed email', /richieste_per_telefono/.test(piano) && /richieste_per_email/.test(piano), piano);
  // e il Worker la fa partire da sé
  const prima = db.prepare('SELECT COUNT(*) AS n FROM richieste').get().n;
  metti('altra vecchia', '333 777 7777', '', 30);
  const attese = [];
  await worker.default.scheduled({}, { DB: d1 }, { waitUntil: (p) => attese.push(p) });
  await Promise.all(attese);
  controlla('il lavoro di ogni notte la cancella', db.prepare('SELECT COUNT(*) AS n FROM richieste').get().n === prima);
}

// ---------------------------------------------------------------- l'ordine del configuratore (worker/ordine.mjs)
//
// Una Stripe finta in locale (porta 8900, o la prima libera dopo), raggiunta tramite STRIPE_API come farebbe il Worker
// con quella vera; Resend finto (nessuna email parte davvero), come in tools/prova-email.mjs. Solo dati inventati.
console.log('L\'ordine del configuratore');
{
  const catalogo = JSON.parse(readFileSync(join(RADICE, 'contenuti/it/tessuti.json'), 'utf8'));
  const [T1, T2, T3] = catalogo.tessuti.map((t) => t.id);
  // Stripe finta: ricorda le richieste e risponde come Checkout
  const aStripe = [];
  let stripeRisponde = 200;
  const server = createServer((req, res) => {
    let corpo = '';
    req.on('data', (x) => { corpo += x; });
    req.on('end', () => {
      aStripe.push({ percorso: req.url, intestazioni: req.headers, corpo: new URLSearchParams(corpo) });
      const n = aStripe.length;
      res.writeHead(stripeRisponde, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stripeRisponde === 200 ? { id: `cs_test_${n}`, object: 'checkout.session', url: `https://checkout.stripe.com/c/pay/cs_test_${n}` } : { error: { message: 'finta' } }));
    });
  });
  let porta = 8900;
  for (;;) {
    try { await new Promise((ok, no) => { server.once('error', no); server.listen(porta, '127.0.0.1', ok); }); break; } catch { porta++; if (porta > 8920) throw new Error('nessuna porta libera'); }
  }
  // Resend finto: tutto ciò che non va a Stripe finta passa da qui e non esce
  const email = [];
  let resendRisponde = 200;
  const veraFetch = globalThis.fetch;
  globalThis.fetch = async (indirizzo, opzioni = {}) => {
    const u = String(indirizzo);
    if (u.startsWith(`http://127.0.0.1:${porta}`)) return veraFetch(indirizzo, opzioni);
    if (u === 'https://api.resend.com/emails') { email.push(JSON.parse(opzioni.body)); return new Response('{"id":"e"}', { status: resendRisponde }); }
    throw new Error(`richiesta inattesa verso ${u}`);
  };

  // la configurazione riservata, con numeri e nomi INVENTATI (quelli veri stanno solo nell'archivio KV)
  const TAGLIE = [38, 39, 40, 41, 42, 43, 44, 45];
  const cresce = (da, passo) => TAGLIE.map((_, i) => Math.round((da + passo * i) * 10) / 10);
  const riservato = {
    'riservato/taglie': JSON.stringify({ taglie: TAGLIE, regole: { verifica: 8 }, misure: {
      spalla: cresce(44, 1), spallina: cresce(15, 0.5), torace: cresce(100, 4), pancia: cresce(90, 4), bacino: cresce(96, 4),
      lunghezza_manica: cresce(64, 1), braccio: cresce(34, 1.5), avambraccio: cresce(28, 1), lunghezza_davanti: cresce(66, 1), lunghezza_dietro: cresce(76, 1.5) } }),
    'riservato/tessuti': JSON.stringify({ [T1]: { articolo: 'Articolo Finto', codice: 'F-001', cartella: 'Cartella Prova', posizione: '3' }, [T2]: { articolo: 'Altro Finto', codice: 'F-002' } }),
  };
  const RISERVATO = { get: async (k) => riservato[k] ?? null };

  // la camicia campione della taglia 41 finta, stesa sul tavolo (le larghezze a metà), con la manica 6 cm più corta
  const ORDINE = {
    quantita: '1', tessuto: T1, collo: 'francese', taschino: 'no', asola: 'no', bottone: 'tinta', filato_bottone: '', iniziali: 'no',
    interno_collo: 'standard', interno_polso: 'standard', polsino: 'standard',
    giro_collo: '41', spalla: '47', spallina: '16,5', torace: '56', pancia: '51', bacino: '54', lunghezza_manica: '61',
    braccio: '19,25', avambraccio: '15,5', polso: '24', lunghezza_davanti: '69', lunghezza_dietro: '80,5',
    nome: 'Mario Prova', telefono: '333 000 0001', email: 'mario@esempio.it', spedizione: 'ritiro', privacy: 'si',
  };
  const SPEDIRE = { spedizione: 'cinque', destinatario: 'Mario Prova', indirizzo: 'Via Inventata 1', cap: '80100', citta: 'Napoli', provincia: 'NA', note_consegna: 'Citofono Prova' };
  const TUTTE = { taschino: 'si', taschino_tessuto: T2, asola: 'si', asola_colore: 'rosso', bottone: 'contrasto', filato_bottone: 'blu',
    iniziali: 'si', iniziali_posizione: 'polso', iniziali_lettere: 'MP', iniziali_colore: 'bianco', interno_collo: 'personalizzato', interno_collo_tessuto: T2,
    interno_polso: 'personalizzato', interno_polso_tessuto: T3, polsino: 'personalizzato', polsino_tessuto: T3 };
  const SITO = 'https://endero.men';
  const manda = (env, dati, { json = true, origine = SITO } = {}) => worker.default.fetch(new Request(`${SITO}/api/ordine`, {
    method: 'POST',
    body: json ? JSON.stringify(dati) : new URLSearchParams(dati),
    headers: { ...(json ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { 'Content-Type': 'application/x-www-form-urlencoded' }), Origin: origine },
  }), env, { waitUntil: () => {} });
  const quanti = (db) => db.prepare('SELECT COUNT(*) AS n FROM ordini').get().n;

  // senza chiavi: lo stato di oggi
  {
    const { db, d1 } = nuovoDb();
    const r = await manda({ DB: d1, RISERVATO }, ORDINE);
    const j = await r.json();
    controlla('senza la chiave di Stripe: ordine controllato, risposta «non_attivo»', r.status === 200 && j.ok === true && j.pagamento === 'non_attivo', JSON.stringify(j));
    controlla('… e non si salva nulla, non si chiama Stripe', quanti(db) === 0 && aStripe.length === 0);
    const e = await (await manda({ DB: d1 }, { ...ORDINE, tessuto: 'z999' })).json();
    controlla('anche senza chiavi un ordine sbagliato riceve gli errori', e.ok === false && !!e.errori?.tessuto, JSON.stringify(e));
  }

  const { db, d1 } = nuovoDb();
  const env = { DB: d1, RISERVATO, STRIPE_SECRET_KEY: 'sk_test_finta', STRIPE_WEBHOOK_SECRET: 'whsec_finta', STRIPE_API: `http://127.0.0.1:${porta}`,
    RESEND_API_KEY: 'finta', EMAIL_ORDINI: 'reparto@esempio.it, ennio@esempio.it', EMAIL_DESTINATARIO: 'altro@esempio.it', EMAIL_MITTENTE: 'Endero <noreply@endero.men>' };

  // ordine con tutte le personalizzazioni e la spedizione, con un prezzo «manomesso» dal browser
  let r = await manda(env, { ...ORDINE, ...TUTTE, ...SPEDIRE, quantita: '2', prezzo: '1', totale: '0.01', camicia: '1', conti: { totale: 1 } });
  let j = await r.json();
  controlla('con la chiave: si apre il pagamento e la pagina riceve l\'indirizzo di Stripe', r.status === 200 && j.ok && /^https:\/\/checkout\.stripe\.com\//.test(j.vai || ''), JSON.stringify(j));
  let riga = db.prepare('SELECT * FROM ordini ORDER BY n DESC').get();
  controlla('salvato «da pagare», con numero leggibile e id non indovinabile', riga?.stato === 'da_pagare' && /^E-\d{4}-000001$/.test(riga.numero) && /^[0-9a-f]{32}$/.test(riga.id), JSON.stringify({ stato: riga?.stato, numero: riga?.numero, id: riga?.id }));
  controlla('prezzo rifatto dal Worker (150 € × 2, spedizione gratis sopra 200): quello del browser non conta', riga.camicia_centesimi === 15000 && riga.quantita === 2 && riga.spedizione_centesimi === 0 && riga.totale_centesimi === 30000, `${riga.camicia_centesimi} × ${riga.quantita} + ${riga.spedizione_centesimi} = ${riga.totale_centesimi}`);
  controlla('la sessione di Stripe è salvata sull\'ordine', riga.sessione === 'cs_test_1', riga.sessione);
  const pulito = JSON.parse(riga.ordine);
  controlla('nell\'ordine salvato non ci sono campi inventati dal browser', !('prezzo' in pulito) && pulito.conti.totale === 300 && pulito.iniziali.lettere === 'MP');
  const t = JSON.parse(riga.taglia || '{}');
  controlla('taglia calcolata con la tabella riservata (le larghezze raddoppiate): «Taglia 41 · manica −6 cm»', t.riga === 'Taglia 41 · manica −6 cm' && t.daVerificare === false, JSON.stringify(t));
  let s = aStripe[0];
  const p = s?.corpo;
  controlla('a Stripe: indirizzo, chiave, idempotenza con l\'id dell\'ordine', s?.percorso === '/v1/checkout/sessions' && s.intestazioni.authorization === 'Bearer sk_test_finta' && s.intestazioni['idempotency-key'] === riga.id);
  controlla('a Stripe: pagamento in euro, una riga per le camicie (15000 centesimi × 2)', p.get('mode') === 'payment' && p.get('line_items[0][price_data][currency]') === 'eur' && p.get('line_items[0][price_data][unit_amount]') === '15000' && p.get('line_items[0][quantity]') === '2' && p.get('line_items[0][price_data][product_data][name]') === 'Camicia su misura Endero');
  controlla('a Stripe: spedizione gratis, quindi nessuna riga per la spedizione', !p.has('line_items[1][price_data][unit_amount]'));
  controlla('a Stripe: email del cliente, riferimento e metadati con l\'id, lingua italiana', p.get('customer_email') === 'mario@esempio.it' && p.get('client_reference_id') === riga.id && p.get('metadata[ordine]') === riga.id && p.get('metadata[numero]') === riga.numero && p.get('locale') === 'it');
  controlla('a Stripe: ritorno al configuratore, fatto o annullato', p.get('success_url') === `${SITO}/camicie-su-misura/configuratore/?ordine=fatto` && p.get('cancel_url') === `${SITO}/camicie-su-misura/configuratore/?ordine=annullato`);
  const primo = riga;

  // un ordine con la spedizione che si paga: due righe a Stripe
  r = await manda(env, { ...ORDINE, ...SPEDIRE, quantita: '1' });
  s = aStripe[1];
  controlla('spedizione in 5 giorni a 90 €: 9000 + una riga di spedizione da 3000', (await r.json()).ok && s.corpo.get('line_items[0][price_data][unit_amount]') === '9000' && s.corpo.get('line_items[1][price_data][unit_amount]') === '3000' && s.corpo.get('line_items[1][quantity]') === '1', s && [...s.corpo].filter(([k]) => k.startsWith('line_items')).map((x) => x.join('=')).join('&'));
  controlla('numeri d\'ordine in fila', db.prepare('SELECT numero FROM ordini ORDER BY n DESC').get().numero.endsWith('000002'));

  // ordini sbagliati: niente salvato, niente Stripe
  const primaS = aStripe.length, primaO = quanti(db);
  j = await (await manda(env, { ...ORDINE, tessuto: 'z999' })).json();
  controlla('tessuto che non esiste: rifiutato con l\'errore sul campo', j.ok === false && !!j.errori.tessuto, JSON.stringify(j));
  j = await (await manda(env, { ...ORDINE, polsino: 'personalizzato', polsino_tessuto: 'z999', giro_collo: '200', iniziali: 'si', iniziali_posizione: 'polso', iniziali_lettere: 'ABCD' })).json();
  controlla('più errori insieme, tutti nominati', j.ok === false && ['polsino_tessuto', 'giro_collo', 'iniziali_lettere'].every((k) => j.errori[k]), JSON.stringify(j.errori));
  r = await manda(env, { ...ORDINE }, { origine: 'https://altro.example' });
  controlla('da un altro sito: rifiutato', r.status === 403);
  r = await worker.default.fetch(new Request(`${SITO}/api/ordine`, { method: 'POST', body: '[1,2]', headers: { 'Content-Type': 'application/json' } }), env, {});
  controlla('JSON che non è un oggetto: rifiutato', r.status === 400);
  r = await worker.default.fetch(new Request(`${SITO}/api/ordine`, { method: 'POST', body: JSON.stringify({ ...ORDINE, note_consegna: 'x'.repeat(40000) }), headers: { 'Content-Type': 'application/json' } }), env, {});
  controlla('troppo grande: rifiutato', r.status === 413);
  r = await worker.default.fetch(new Request(`${SITO}/api/ordine`, { method: 'GET' }), env, {});
  controlla('solo POST', r.status === 405);
  controlla('… e nessuno di questi è stato salvato o mandato a Stripe', quanti(db) === primaO && aStripe.length === primaS);
  j = await (await manda(env, { ...ORDINE, nome: 'Mario‪ Prova\u0000', telefono: '‪+39 333 000 0001‬' })).json();
  riga = db.prepare('SELECT ordine FROM ordini ORDER BY n DESC').get();
  controlla('caratteri invisibili e di controllo tolti prima di salvare', j.ok && JSON.parse(riga.ordine).cliente.nome === 'Mario Prova' && JSON.parse(riga.ordine).cliente.telefono === '+39 333 000 0001', riga.ordine.slice(0, 120));

  // senza script: modulo normale
  r = await manda(env, { ...ORDINE }, { json: false });
  controlla('senza script: rimando diretto alla pagina di Stripe', r.status === 303 && /^https:\/\/checkout\.stripe\.com\//.test(r.headers.get('Location') || ''), `${r.status} ${r.headers.get('Location')}`);
  r = await manda(env, { ...ORDINE, cap: '1', spedizione: 'cinque' }, { json: false });
  let html = await r.text();
  controlla('senza script, con errori: pagina che dice quali campi (con il loro nome)', r.status === 422 && /text\/html/.test(r.headers.get('Content-Type')) && /CAP: il cap ha 5 cifre/i.test(html) && /Via e numero civico/.test(html), html.slice(0, 200));
  r = await manda({ ...env, STRIPE_SECRET_KEY: '' }, { ...ORDINE }, { json: false });
  html = await r.text();
  controlla('senza script e senza chiavi: pagina «pagamento non attivo», senza segnaposto', r.status === 200 && /non è ancora attivo/.test(html) && !/\[\[/.test(html));

  // Stripe che non risponde: l'ordine si annulla, la pagina lo dice
  stripeRisponde = 500;
  r = await manda(env, { ...ORDINE });
  j = await r.json();
  controlla('se Stripe sbaglia: errore per la pagina, ordine annullato', r.status === 502 && j.ok === false && db.prepare('SELECT stato FROM ordini ORDER BY n DESC').get().stato === 'annullato', JSON.stringify(j));
  stripeRisponde = 200;

  // senza la tabella delle taglie l'ordine passa lo stesso
  r = await manda({ ...env, RISERVATO: undefined }, { ...ORDINE });
  controlla('senza configurazione riservata: ordine salvato, taglia vuota', (await r.json()).ok && db.prepare('SELECT taglia FROM ordini ORDER BY n DESC').get().taglia === '');

  // ---- il webhook di Stripe
  const firma = (corpo, { segreto = 'whsec_finta', t = Math.floor(Date.now() / 1000) } = {}) => `t=${t},v1=${createHmac('sha256', segreto).update(`${t}.${corpo}`).digest('hex')}`;
  const evento = (riga, { tipo = 'checkout.session.completed', stato = 'paid', importo = riga.totale_centesimi, email = 'mario.pagamento@esempio.it' } = {}) => JSON.stringify({
    id: 'evt_finto', type: tipo, data: { object: { id: riga.sessione, object: 'checkout.session', client_reference_id: riga.id, metadata: { ordine: riga.id }, payment_status: stato, amount_total: importo, currency: 'eur', payment_intent: 'pi_finto', customer_details: { email } } },
  });
  const avvisa = (corpo, intestazione = firma(corpo), conEnv = env) => worker.default.fetch(new Request(`${SITO}/api/stripe`, { method: 'POST', body: corpo, headers: { 'Stripe-Signature': intestazione, 'Content-Type': 'application/json' } }), conEnv, {});
  const stato = (id) => db.prepare('SELECT stato, email_inviate, pagato_centesimi FROM ordini WHERE id = ?').get(id);

  let corpo = evento(primo);
  r = await avvisa(corpo, firma(corpo, { segreto: 'whsec_sbagliata' }));
  controlla('firma con la chiave sbagliata: rifiutato, niente cambia', r.status === 400 && stato(primo.id).stato === 'da_pagare' && email.length === 0);
  r = await avvisa(corpo, firma(corpo, { t: Math.floor(Date.now() / 1000) - 600 }));
  controlla('firma di dieci minuti fa: rifiutato', r.status === 400 && stato(primo.id).stato === 'da_pagare');
  r = await avvisa(corpo, '');
  controlla('senza firma: rifiutato', r.status === 400);
  r = await avvisa(corpo.replace('"paid"', '"paid" '), firma(corpo));
  controlla('corpo cambiato dopo la firma: rifiutato', r.status === 400 && stato(primo.id).stato === 'da_pagare');
  r = await avvisa(corpo, firma(corpo).replace(/v1=([0-9a-f])/, (_, c) => `v1=${c === '0' ? '1' : '0'}`));
  controlla('firma ritoccata di una cifra: rifiutato', r.status === 400);
  r = await avvisa(corpo, firma(corpo), { ...env, STRIPE_WEBHOOK_SECRET: '' });
  controlla('senza la chiave del webhook: rifiutato', r.status === 503 && stato(primo.id).stato === 'da_pagare');
  const altro = JSON.stringify({ id: 'evt_x', type: 'payment_intent.created', data: { object: { id: 'pi_x' } } });
  r = await avvisa(altro);
  controlla('altri eventi: 200 e basta', r.status === 200 && email.length === 0);
  const nonPagato = evento(primo, { stato: 'unpaid' });
  r = await avvisa(nonPagato);
  controlla('pagina chiusa ma pagamento non ancora arrivato: resta da pagare', r.status === 200 && stato(primo.id).stato === 'da_pagare' && email.length === 0);

  r = await avvisa(corpo);
  controlla('firma buona: ordine pagato', r.status === 200 && stato(primo.id).stato === 'pagato' && stato(primo.id).pagato_centesimi === 30000, JSON.stringify(stato(primo.id)));
  controlla('… e due email: a Endero ed Ennio, e al cliente', email.length === 2 && JSON.stringify(email[0].to) === '["reparto@esempio.it","ennio@esempio.it"]', JSON.stringify(email.map((x) => x.to)));
  const [aEndero, alCliente] = email;
  controlla('a Endero: numero, taglia, nome vero del tessuto con la cartella', aEndero.subject.includes(primo.numero) && aEndero.subject.includes('Taglia 41 · manica −6 cm') && /Articolo Finto · F-001/.test(aEndero.html) && /Cartella: Cartella Prova/.test(aEndero.html), aEndero.subject);
  controlla('a Endero: dove manca il nome vero, si dice ben visibile', /Nome della cartella colori non disponibile/.test(aEndero.html) && new RegExp(`Sul sito: .+ · ${T3}`).test(aEndero.html));
  controlla('a Endero: le misure con il giro raddoppiato, le note per il corriere, il totale', /56 \(giro 112\)/.test(aEndero.html) && /Citofono Prova/.test(aEndero.html) && /300\s€/.test(aEndero.html));
  // rispondendo all'ordine non si scrive al cliente: nella risposta finirebbero citati il nome vero dei tessuti e la taglia
  controlla('a Endero: la risposta non va al cliente (nomi veri e taglia restano a Endero)', !/esempio\.it/.test(String(aEndero.reply_to || '')) && !/Rispondendo a questa email/.test(aEndero.html), aEndero.reply_to);
  controlla('al cliente: all\'email con cui ha pagato, con il numero d\'ordine', JSON.stringify(alCliente.to) === '["mario.pagamento@esempio.it"]' && alCliente.subject.includes(primo.numero), JSON.stringify(alCliente.to));
  controlla('al cliente: mai i nomi veri dei tessuti, né le note per il corriere', !/Articolo Finto|F-001|Cartella Prova|Altro Finto|Citofono/.test(alCliente.html + alCliente.text));
  r = await avvisa(corpo);
  const r2 = await avvisa(evento(primo, { tipo: 'checkout.session.async_payment_succeeded' }));
  controlla('lo stesso evento ripetuto (e un secondo avviso di pagamento): nessuna email in più', r.status === 200 && r2.status === 200 && email.length === 2 && stato(primo.id).stato === 'pagato', String(email.length));

  // email che non partono: Stripe riprova, e solo allora si rimanda
  const secondo = db.prepare('SELECT * FROM ordini WHERE numero LIKE ?').get('%000002');
  resendRisponde = 500;
  corpo = evento(secondo, { email: 'mario@esempio.it' });
  const tentate = email.length;
  r = await avvisa(corpo);
  controlla('se l\'ordine a Endero non parte, la conferma al cliente aspetta (non arriverà due volte)', email.length === tentate + 1, String(email.length - tentate));
  controlla('Resend non risponde: errore a Stripe (che riprova), ordine pagato ma email da mandare', r.status === 500 && stato(secondo.id).stato === 'pagato' && stato(secondo.id).email_inviate === 0, `${r.status} ${JSON.stringify(stato(secondo.id))}`);
  resendRisponde = 200;
  const prima = email.length;
  r = await avvisa(corpo);
  controlla('al nuovo tentativo partono, una volta', r.status === 200 && email.length === prima + 2 && stato(secondo.id).email_inviate === 1);
  r = await avvisa(corpo);
  controlla('e non più', email.length === prima + 2);

  // importo diverso da quello salvato: si paga lo stesso, ma Endero lo vede scritto
  const terzo = db.prepare("SELECT * FROM ordini WHERE stato = 'da_pagare' ORDER BY n DESC").get();
  r = await avvisa(evento(terzo, { importo: 1 }));
  controlla('importo incassato diverso dal totale: avviso in rosso nell\'email a Endero', r.status === 200 && /Attenzione: Stripe ha incassato 0,01/.test(email.at(-2)?.html || ''), email.at(-2)?.subject);
  const sconosciuto = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_x', payment_status: 'paid', client_reference_id: 'f'.repeat(32) } } });
  r = await avvisa(sconosciuto);
  controlla('pagamento per un ordine che non esiste: 200, nessuna email', r.status === 200 && email.length === prima + 4);

  // anteprima e sito chiuso a Google (worker/anteprima.js): senza database né chiavi, «non_attivo»
  const lavoro = join(cartella, 'anteprima.mjs');
  await build({ entryPoints: [join(RADICE, 'worker/anteprima.js')], bundle: true, format: 'esm', platform: 'neutral', outfile: lavoro, logLevel: 'silent', mainFields: ['module', 'main'],
    plugins: [{ name: 'manifesto', setup(b) { b.onResolve({ filter: /^__STATIC_CONTENT_MANIFEST$/ }, () => ({ path: 'm', namespace: 'm' })); b.onLoad({ filter: /.*/, namespace: 'm' }, () => ({ contents: 'export default "{}"' })); } }] });
  const anteprima = await import(pathToFileURL(lavoro));
  const daAnteprima = async (envA) => anteprima.default.fetch(new Request(`${SITO}/api/ordine`, { method: 'POST', body: JSON.stringify(ORDINE), headers: { 'Content-Type': 'application/json', Origin: SITO } }), envA, { waitUntil: () => {} });
  const primaA = aStripe.length;
  r = await daAnteprima({});
  j = await r.json();
  controlla('anteprima (senza database): ordine controllato, «non_attivo», niente Stripe', j.ok && j.pagamento === 'non_attivo' && aStripe.length === primaA && r.headers.get('X-Robots-Tag') === 'noindex, nofollow', JSON.stringify(j));
  r = await daAnteprima({ STRIPE_SECRET_KEY: 'sk_test_finta', STRIPE_API: env.STRIPE_API });
  controlla('anteprima anche con una chiave ma senza database: non salva e non apre pagamenti', (await r.json()).pagamento === 'non_attivo' && aStripe.length === primaA);
  r = await anteprima.default.fetch(new Request(`${SITO}/api/ordine`, { method: 'POST', body: JSON.stringify({ ...ORDINE, collo: 'nessuno' }), headers: { 'Content-Type': 'application/json' } }), {}, { waitUntil: () => {} });
  controlla('anteprima: un ordine sbagliato riceve gli errori', r.status === 422 && !!(await r.json()).errori.collo);
  r = await anteprima.default.fetch(new Request(`${SITO}/api/stripe`, { method: 'POST', body: '{}' }), {}, { waitUntil: () => {} });
  controlla('anteprima: il webhook non fa nulla', r.status === 503);

  // lo schema: db/ordini.sql (per il database che esiste già) fa la stessa tabella di db/schema.sql
  const colonne = (sql) => { const x = new DatabaseSync(':memory:'); x.exec(sql); return JSON.stringify(x.prepare("SELECT name, type, \"notnull\", dflt_value, pk FROM pragma_table_info('ordini')").all()); };
  controlla('db/ordini.sql e db/schema.sql fanno la stessa tabella ordini', colonne(readFileSync(join(RADICE, 'db/ordini.sql'), 'utf8')) === colonne(readFileSync(join(RADICE, 'db/schema.sql'), 'utf8')));
  controlla('la pulizia dei 24 mesi non tocca gli ordini', !/ordini/.test(conservazione.DIMENTICA));

  globalThis.fetch = veraFetch;
  server.close();
}

rmSync(cartella, { recursive: true, force: true });
console.log(`\n${passati} controlli passati, ${falliti.length} falliti`);
if (falliti.length) { console.log(falliti.map((x) => ' - ' + x).join('\n')); process.exit(1); }
