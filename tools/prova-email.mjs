// Controlla le email dei moduli (worker/email.mjs) senza spedire niente: Resend è finto.
//
//   node tools/prova-email.mjs
//
// Il file del Worker importa i testi JSON come fa Cloudflare: qui lo si impacchetta con esbuild prima di provarlo.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const cartella = mkdtempSync(join(tmpdir(), 'prova-email-'));
const uscita = join(cartella, 'email.mjs');
await build({ entryPoints: [fileURLToPath(new URL('../worker/email.mjs', import.meta.url))], bundle: true, format: 'esm', platform: 'neutral', outfile: uscita, logLevel: 'silent' });
const { perEndero, perCliente, avvisa, righe } = await import(pathToFileURL(uscita).href);

let passati = 0;
const falliti = [];
function controlla(nome, vero, dettaglio = '') {
  if (vero) passati++; else falliti.push(nome + (dettaglio ? ` (${dettaglio})` : ''));
  console.log(`${vero ? '  ok ' : '  NO '} ${nome}${!vero && dettaglio ? ' → ' + dettaglio : ''}`);
}

const contatto = { tipo: 'contatto', nome: 'Mario Rossi', telefono: '333 1234567', email: 'mario@esempio.it', giorno: '', fascia: '', messaggio: 'Vorrei sapere\ndegli orari.', dettagli: '', pagina: '/dove-siamo/', paese: 'IT' };
const rivenditore = { tipo: 'rivenditore', nome: 'Anna <b>Bianchi</b>', telefono: '+39 081 000000', email: 'anna@negozio.it', giorno: '', fascia: '', messaggio: '', pagina: '/diventa-rivenditore/', paese: 'IT',
  dettagli: JSON.stringify({ citta: 'Napoli', nazione: 'Italia', interesse: ['Rivenditore Endero', 'Conto terzi'], attivita: 'Bottega & Co' }) };

console.log('Email a Endero');
let e = perEndero(contatto);
controlla('l\'oggetto dice tipo e nome', e.oggetto === 'Nuova richiesta dal sito · Messaggio · Mario Rossi', e.oggetto);
controlla('il testo ha nome, telefono, email e messaggio', /Nome: Mario Rossi/.test(e.testo) && /Telefono: 333 1234567/.test(e.testo) && /mario@esempio\.it/.test(e.testo) && /Vorrei sapere\ndegli orari/.test(e.testo));
controlla('dice come rispondere al cliente', /Rispondendo a questa email scrivi direttamente a mario@esempio\.it/.test(e.testo));
controlla('le voci vuote non ci sono', !/Giorno preferito/.test(e.testo) && !/Fascia oraria/.test(e.testo));
e = perEndero(rivenditore);
controlla('rivenditore: ci sono città, Paese, interesse e negozio con le etichette della pagina (senza «facoltativo»)', /Città: Napoli/.test(e.testo) && /Paese: Italia/.test(e.testo) && /Rivenditore Endero, Conto terzi/.test(e.testo) && /Negozio o marchio: Bottega & Co/.test(e.testo) && !/facoltativ/.test(e.testo), e.testo.slice(0, 300));
controlla('rivenditore: nell\'HTML i dati del cliente non diventano codice', !/<b>Bianchi<\/b>/.test(e.html) && /&lt;b&gt;Bianchi&lt;\/b&gt;/.test(e.html) && /Bottega &amp; Co/.test(e.html));
controlla('l\'oggetto non ha a capo', !/[\r\n]/.test(perEndero({ ...contatto, nome: 'Mario\r\nBcc: x@y.z' }).oggetto));
controlla('senza email: si dice di richiamare al telefono', /al telefono/.test(perEndero({ ...contatto, email: '' }).testo));
controlla('le righe seguono l\'ordine del modulo', righe(contatto).map((x) => x[0]).join() === 'Nome,Telefono,Email,Messaggio,Pagina del sito,Collegato da', righe(contatto).map((x) => x[0]).join());

console.log('Conferma al cliente');
let c = perCliente(contatto);
controlla('saluta con il nome e dice cosa succede', /^Ciao Mario,/.test(c.testo) && /ti rispondiamo/.test(c.testo), c.testo);
controlla('dà i contatti confermati: WhatsApp come link, email della sede', /wa\.me\/393338548712/.test(c.testo) && /info@endero\.men/.test(c.testo));
controlla('rivenditore: parla di listino e condizioni', /listino e condizioni/.test(perCliente(rivenditore).testo));
controlla('presa misure: parla dell\'appuntamento', /appuntamento/.test(perCliente({ ...contatto, tipo: 'presa-misure' }).testo));
controlla('poche parole prima del riepilogo (meno di 30)', c.testo.split('\n\n')[0].split(/\s+/).length < 30, c.testo.split('\n\n')[0]);

console.log('Aspetto (2026-11-25: foto in cima, tasti, riepilogo, sede e Instagram in fondo)');
const tipi = { contatto, 'presa-misure': { ...contatto, tipo: 'presa-misure', giorno: '2026-12-01', fascia: 'Pomeriggio' }, rivenditore };
for (const [tipo, r] of Object.entries(tipi)) {
  const a = perEndero(r), b = perCliente(r);
  controlla(`${tipo}: la foto del suo tipo in cima, dal sito vero, con il testo alternativo`, [a.html, b.html].every((h) => new RegExp(`https://endero\\.men/email/testata-${tipo}-\\d+\\.jpg" width="600" alt="Endero"`).test(h)));
  controlla(`${tipo}: in fondo sede con la mappa, WhatsApp, Instagram e la società`, [a.html, b.html].every((h) => /Viale del Toro 22/.test(h) && /google\.com\/maps/.test(h) && /wa\.me\/393338548712/.test(h) && /instagram\.com\/endero_official/.test(h) && /08887031212/.test(h)));
}
let h = perEndero(contatto).html;
controlla('a Endero: tasti WhatsApp (col numero del cliente e un messaggio pronto), Chiama ed Email', /href="https:\/\/wa\.me\/393331234567\?text=Ciao%20Mario%2C/.test(h) && /href="tel:\+393331234567"/.test(h) && /href="mailto:mario@esempio\.it\?subject=/.test(h));
h = perEndero({ ...contatto, email: '' }).html;
controlla('a Endero, senza email del cliente: niente tasto email', !/mailto:/.test(h) && /tel:/.test(h));
h = perEndero({ ...contatto, telefono: '+44 20 7946 0958' }).html;
controlla('a Endero, numero straniero: WhatsApp e Chiama col suo prefisso', /wa\.me\/442079460958/.test(h) && /tel:\+442079460958/.test(h));
h = perEndero({ ...contatto, telefono: 'non so' }).html;
controlla('a Endero, numero illeggibile: niente tasti WhatsApp e Chiama (il numero resta nella richiesta)', !/wa\.me\/(?!393338548712)/.test(h) && !/tel:/.test(h) && /non so/.test(h));
h = perEndero(contatto).html;
controlla('a Endero: arrivo con giorno e ora, e il Paese per nome', /Arrivata dal sito .+ alle \d{2}:\d{2}\./.test(h) && />Italia</.test(h));
h = perCliente(tipi['presa-misure']).html;
controlla('al cliente: il riepilogo senza le voci tecniche, il giorno scritto per esteso', /Cosa ci hai mandato/.test(h) && /martedì 1 dicembre 2026/.test(h) && !/Pagina del sito/.test(h) && !/Collegato da/.test(h));
controlla('al cliente: tasto WhatsApp verso Endero con un messaggio pronto, e il rimando al su misura', /href="https:\/\/wa\.me\/393338548712\?text=Ciao%20Endero/.test(h) && /href="https:\/\/endero\.men\/camicie-su-misura\/"/.test(h));
controlla('al cliente: il rimando giusto per ogni tipo', /endero\.men\/collezione\//.test(perCliente(contatto).html) && /endero\.men\/collezione\//.test(perCliente(rivenditore).html));
h = perCliente(rivenditore).html;
controlla('al cliente: i dati scritti dal cliente restano testo anche nel riepilogo', !/<b>Bianchi<\/b>/.test(h) && /&lt;b&gt;Bianchi/.test(h));
controlla('a Endero: un messaggio su più righe resta su più righe', /Vorrei sapere<br>degli orari/.test(perEndero(contatto).html));
controlla('al cliente: nel riepilogo niente testo libero (messaggio, negozio, sito), che partirebbe verso un indirizzo non verificato', !/Vorrei sapere/.test(perCliente(contatto).html) && !/Bottega/.test(perCliente(rivenditore).html) && /Napoli/.test(perCliente(rivenditore).html) && /Conto terzi/.test(perCliente(rivenditore).html));
h = perEndero({ ...contatto, telefono: '081 123 4567' }).html;
controlla('a Endero, numero fisso: niente WhatsApp, «Chiama» diventa il tasto pieno', !/wa\.me\/39081/.test(h) && /tel:\+390811234567/.test(h) && /background:#0f285e;mso-padding-alt:15px 26px;"><a href="tel:/.test(h));
h = perEndero({ ...contatto, email: "o'brien+x@esempio.it" }).html;
controlla('a Endero: l\'email nel link mailto è codificata (nessun carattere aggiunge destinatari)', /mailto:o&#39;brien%2Bx@esempio\.it\?subject=/.test(h));
h = perCliente(contatto).html;
controlla('al cliente: l\'anteprima in casella comincia con il saluto ed è seguita da spazio vuoto', /mso-hide:all;">Ciao Mario, grazie/.test(h) && (h.match(/&#8199;&#847;/g) || []).length >= 80);
controlla('Outlook per Windows: tabella fantasma a 600, carattere del sito solo dove ci sono le media query, Arial per Outlook', /<!--\[if mso\]><table role="presentation" width="600"/.test(h) && /@media screen \{ @font-face/.test(h) && /\[if mso\]><style>td, p/.test(h));
controlla('iPhone: numeri e indirizzi riconosciuti restano del colore del testo', /a\[x-apple-data-detectors\]/.test(h));
controlla('i tasti sono tabelle con il link dentro (Outlook dà spazio alle celle, non ai link)', (h.match(/class="tasto"/g) || []).length === 2 && /<td bgcolor="#0f285e" style="border:1px solid #0f285e;border-radius:999px/.test(h));
controlla('le immagini hanno la versione nel nome, non in «?v=» (il sito la ignorerebbe)', !/\?v=/.test(h) && /logo-bianco-\d+\.png/.test(h));
controlla('HTML da email: niente script, niente fogli di stile esterni', [perCliente(contatto).html, perEndero(rivenditore).html].every((x) => !/<script/i.test(x) && !/<link/i.test(x)));

console.log('Spedizione (Resend finto)');
const spedite = [];
globalThis.fetch = async (url, opzioni) => { spedite.push({ url, corpo: JSON.parse(opzioni.body), chiave: opzioni.headers.Authorization }); return new Response('{"id":"x"}', { status: 200 }); };
let esito = await avvisa({}, contatto);
controlla('senza chiave né destinatario non parte niente', spedite.length === 0 && !esito.endero && !esito.cliente);
const env = { RESEND_API_KEY: 'finta', EMAIL_DESTINATARIO: 'uno@esempio.it, due@esempio.it', EMAIL_MITTENTE: 'Endero <noreply@endero.men>', EMAIL_RISPOSTE: 'info@endero.men' };
esito = await avvisa(env, contatto);
controlla('con chiave e destinatario: due email (a Endero e al cliente)', spedite.length === 2 && esito.endero && esito.cliente, JSON.stringify(esito));
controlla('a Endero: tutti i destinatari, risposta al cliente', JSON.stringify(spedite[0].corpo.to) === '["uno@esempio.it","due@esempio.it"]' && spedite[0].corpo.reply_to === 'mario@esempio.it' && spedite[0].url === 'https://api.resend.com/emails');
controlla('al cliente: dal mittente del sito, le risposte a info@endero.men', JSON.stringify(spedite[1].corpo.to) === '["mario@esempio.it"]' && spedite[1].corpo.from === 'Endero <noreply@endero.men>' && spedite[1].corpo.reply_to === 'info@endero.men');
spedite.length = 0;
await avvisa(env, { ...contatto, email: '' });
controlla('senza email del cliente: solo l\'avviso a Endero, senza risposta automatica', spedite.length === 1 && !('reply_to' in spedite[0].corpo));
spedite.length = 0;
globalThis.fetch = async () => new Response('errore', { status: 500 });
esito = await avvisa(env, contatto);
controlla('se Resend sbaglia non si rompe nulla: risulta solo non partita', !esito.endero && !esito.cliente);
globalThis.fetch = async () => { throw new Error('rete'); };
esito = await avvisa(env, contatto);
controlla('se la rete cade non si rompe nulla', !esito.endero && !esito.cliente);

console.log('Ordine del configuratore (dati inventati)');
{
  const { ordinePerEndero, ordinePerCliente, avvisaOrdine } = await import(pathToFileURL(uscita).href);
  const o = {
    quantita: 2, tessuto: 't0501', collo: 'francese', taschino: { tessuto: 't0502' }, asola: { colore: 'rosso' }, bottone: 'contrasto', filato_bottone: 'blu',
    iniziali: { posizione: 'cuore', lettere: 'MP', colore: 'bianco' }, interno_collo: null, interno_polso: { tessuto: 't0201' }, polsino: null,
    misure: { giro_collo: 41, spalla: 47, spallina: 16.5, torace: 56, pancia: 51, bacino: 54, lunghezza_manica: 61, braccio: 19.25, avambraccio: 15.5, polso: 24, lunghezza_davanti: 69, lunghezza_dietro: 80.5 },
    cliente: { nome: 'Mario <b>Rossi</b>', telefono: '333 1234567', email: 'mario@esempio.it' },
    spedizione: { modo: 'cinque', indirizzo: { destinatario: 'Mario Rossi', indirizzo: 'Via Inventata 1', cap: '80100', citta: 'Napoli', provincia: 'NA', note: 'Citofono <i>Prova</i>' } },
    conti: { personalizzazioni: ['taschino', 'asola', 'bottone', 'filato_bottone', 'iniziali', 'interno_polso'], camicia: 120, quantita: 2, capi: 240, spedizione: 0, gratis: true, totale: 240 },
  };
  const dati = { numero: 'E-2026-000007', ordine: o, taglia: { riga: 'Taglia 41 · manica −6 cm', daVerificare: true, motivi: ['variazione grande: manica −6 cm'] },
    pagato: new Date('2026-11-25T19:49:00Z'), pagatoCentesimi: 24000, totaleCentesimi: 24000, emailCliente: 'mario@esempio.it',
    tessutiVeri: { t0501: { articolo: 'Articolo Finto', codice: 'F-1', cartella: 'Cartella Finta', posizione: '2' } } };
  const a = ordinePerEndero(dati), b = ordinePerCliente(dati);
  controlla('a Endero: oggetto con numero, nome e taglia', a.oggetto === 'Nuovo ordine E-2026-000007 · Mario <b>Rossi</b> · Taglia 41 · manica −6 cm', a.oggetto);
  controlla('a Endero: taglia in grande e «da verificare» in vista', /Taglia 41</.test(a.html) && />manica −6 cm</.test(a.html) && /Da verificare con il cliente: variazione grande/.test(a.html));
  controlla('a Endero: nome vero del tessuto, cartella e posizione', /Articolo Finto · F-1/.test(a.html) && /Cartella: Cartella Finta/.test(a.html) && /Posizione: 2/.test(a.html));
  controlla('a Endero: dove manca il nome vero, nome del sito, id e avviso', (a.html.match(/Nome della cartella colori non disponibile/g) || []).length === 2 && /Sul sito: [^<]+ · t0201/.test(a.html));
  controlla('a Endero: foto del campione dal sito vero', /src="https:\/\/endero\.men\/camicia\/tessuti\/t0501\.webp"/.test(a.html));
  controlla('a Endero: misure con il giro, iniziali, consegna con note, totale', /56 \(giro 112\)/.test(a.html) && /MP · Lato cuore · filo bianco/.test(a.html) && /Citofono &lt;i&gt;Prova/.test(a.html) && /240\s€/.test(a.html));
  controlla('a Endero: tasti WhatsApp, Chiama, Email', /wa\.me\/393331234567\?text=/.test(a.html) && /tel:\+393331234567/.test(a.html) && /mailto:mario@esempio\.it\?subject=/.test(a.html));
  controlla('a Endero: il testo scritto dal cliente non diventa codice', !/<b>Rossi<\/b>/.test(a.html) && !/<i>Prova<\/i>/.test(a.html));
  controlla('a Endero: la testata dell\'ordine', /testata-ordine-\d+\.jpg/.test(a.html));
  controlla('a Endero, taglia non calcolata: lo dice', /Taglia non calcolata/.test(ordinePerEndero({ ...dati, taglia: null }).html) && !/Taglia 41/.test(ordinePerEndero({ ...dati, taglia: null }).oggetto));
  controlla('al cliente: nomi del sito, mai quelli veri, niente note né taglia', !/Articolo Finto|F-1|Cartella Finta|Citofono|Taglia 41/.test(b.html + b.testo) && /Popeline bianco/.test(b.html));
  controlla('al cliente: numero d\'ordine, totale e WhatsApp', b.oggetto === 'Il tuo ordine Endero E-2026-000007' && /240\s€/.test(b.html) && /wa\.me\/393338548712\?text=Ciao%20Endero/.test(b.html));
  controlla('niente script nelle email dell\'ordine', ![a.html, b.html].some((x) => /<script/i.test(x)));

  const spedite2 = [];
  globalThis.fetch = async (url, opzioni) => { spedite2.push(JSON.parse(opzioni.body)); return new Response('{}', { status: 200 }); };
  let es = await avvisaOrdine({ RESEND_API_KEY: 'finta', EMAIL_DESTINATARIO: 'tutti@esempio.it' }, dati);
  controlla('senza EMAIL_ORDINI vale EMAIL_DESTINATARIO', es.endero && es.cliente && JSON.stringify(spedite2[0].to) === '["tutti@esempio.it"]');
  spedite2.length = 0;
  es = await avvisaOrdine({ RESEND_API_KEY: 'finta', EMAIL_ORDINI: 'a@esempio.it,b@esempio.it', EMAIL_DESTINATARIO: 'x@esempio.it' }, { ...dati, emailCliente: 'a@b.it, c@d.it' });
  controlla('EMAIL_ORDINI con più indirizzi; un\'email del pagamento con la virgola si scarta per quella del modulo', JSON.stringify(spedite2[0].to) === '["a@esempio.it","b@esempio.it"]' && JSON.stringify(spedite2[1].to) === '["mario@esempio.it"]');
  spedite2.length = 0;
  es = await avvisaOrdine({ EMAIL_ORDINI: 'a@esempio.it' }, dati);
  controlla('senza la chiave di Resend non parte nulla', !es.endero && spedite2.length === 0);
}

rmSync(cartella, { recursive: true, force: true });
console.log(`\n${passati} controlli passati, ${falliti.length} falliti`);
if (falliti.length) { console.log(falliti.map((x) => ' - ' + x).join('\n')); process.exit(1); }
