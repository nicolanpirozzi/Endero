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
controlla('dice come rispondere al cliente', /rispondere a questa email: arriva a mario@esempio\.it/.test(e.testo));
controlla('le voci vuote non ci sono', !/Giorno preferito/.test(e.testo) && !/Fascia oraria/.test(e.testo));
e = perEndero(rivenditore);
controlla('rivenditore: ci sono città, Paese, interesse e negozio con le etichette della pagina (senza «facoltativo»)', /Città: Napoli/.test(e.testo) && /Paese: Italia/.test(e.testo) && /Rivenditore Endero, Conto terzi/.test(e.testo) && /Negozio o marchio: Bottega & Co/.test(e.testo) && !/facoltativ/.test(e.testo), e.testo.slice(0, 300));
controlla('rivenditore: nell\'HTML i dati del cliente non diventano codice', !/<b>Bianchi<\/b>/.test(e.html) && /&lt;b&gt;Bianchi&lt;\/b&gt;/.test(e.html) && /Bottega &amp; Co/.test(e.html));
controlla('l\'oggetto non ha a capo', !/[\r\n]/.test(perEndero({ ...contatto, nome: 'Mario\r\nBcc: x@y.z' }).oggetto));
controlla('senza email: si dice di richiamare al telefono', /al telefono/.test(perEndero({ ...contatto, email: '' }).testo));
controlla('le righe seguono l\'ordine del modulo', righe(contatto).map((x) => x[0]).join() === 'Nome,Telefono,Email,Messaggio,Pagina del sito,Paese di collegamento', righe(contatto).map((x) => x[0]).join());

console.log('Conferma al cliente');
let c = perCliente(contatto);
controlla('saluta con il nome e dice cosa succede', /^Ciao Mario,/.test(c.testo) && /ti rispondiamo/.test(c.testo), c.testo);
controlla('dà i contatti confermati', /333 854 8712/.test(c.testo) && /info@endero\.men/.test(c.testo));
controlla('rivenditore: parla di listino e condizioni', /listino e condizioni/.test(perCliente(rivenditore).testo));
controlla('presa misure: parla dell\'appuntamento', /appuntamento/.test(perCliente({ ...contatto, tipo: 'presa-misure' }).testo));
controlla('poche parole (meno di 60)', c.testo.split(/\s+/).length < 60, String(c.testo.split(/\s+/).length));

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

rmSync(cartella, { recursive: true, force: true });
console.log(`\n${passati} controlli passati, ${falliti.length} falliti`);
if (falliti.length) { console.log(falliti.map((x) => ' - ' + x).join('\n')); process.exit(1); }
