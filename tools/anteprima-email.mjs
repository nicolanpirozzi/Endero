// Anteprime delle email dei moduli (worker/email.mjs), con richieste d'esempio: per guardarle e farle vedere al
// proprietario prima di pubblicarle. Scrive le pagine HTML e ne fa le schermate, a grandezza di computer e di telefono.
//
//   node tools/anteprima-email.mjs <cartella>
//
// Le immagini nelle email puntano al sito vero (endero.men/email/…): qui si leggono da public/email/, così si vedono
// anche prima di pubblicarle.
import { build } from 'esbuild';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Playwright è installato per tutto l'ambiente: lo trova solo la risoluzione di require
const pw = createRequire(import.meta.url)('playwright');

const RADICE = fileURLToPath(new URL('..', import.meta.url));
const uscita = process.argv[2];
if (!uscita) { console.error('uso: node tools/anteprima-email.mjs <cartella>'); process.exit(1); }
mkdirSync(uscita, { recursive: true });

const lavoro = mkdtempSync(join(tmpdir(), 'anteprima-email-'));
const file = join(lavoro, 'email.mjs');
await build({ entryPoints: [join(RADICE, 'worker/email.mjs')], bundle: true, format: 'esm', platform: 'neutral', outfile: file, logLevel: 'silent' });
const { perEndero, perCliente, ordinePerEndero, ordinePerCliente } = await import(pathToFileURL(file).href);
await build({ entryPoints: [join(RADICE, 'src/configuratore/ordine.mjs')], bundle: true, format: 'esm', platform: 'neutral', outfile: join(lavoro, 'ordine.mjs'), logLevel: 'silent' });
const { ordinePulito } = await import(pathToFileURL(join(lavoro, 'ordine.mjs')).href);
const { leggiConfigurazione, perIlReparto } = await import(pathToFileURL(join(RADICE, 'worker/taglie.mjs')).href);

const ESEMPI = {
  contatto: { tipo: 'contatto', nome: 'Mario Rossi', telefono: '333 123 4567', email: 'mario.rossi@esempio.it', giorno: '', fascia: '', dettagli: '',
    messaggio: 'Buongiorno, vorrei sapere se avete la giacca blu della collezione in taglia 50.\nGrazie!', pagina: '/dove-siamo/', paese: 'IT' },
  'presa-misure': { tipo: 'presa-misure', nome: 'Luca Esposito', telefono: '+39 347 765 4321', email: 'luca.esposito@esempio.it', giorno: '2026-12-01', fascia: 'Pomeriggio', dettagli: '',
    messaggio: 'Vorrei due camicie bianche per un matrimonio.', pagina: '/camicie-su-misura/', paese: 'IT' },
  rivenditore: { tipo: 'rivenditore', nome: 'Anna Bianchi', telefono: '081 123 4567', email: 'anna@bottegabianchi.it', giorno: '', fascia: '', messaggio: 'Abbiamo un negozio in centro da vent\'anni.', pagina: '/diventa-rivenditore/', paese: 'IT',
    dettagli: JSON.stringify({ attivita: 'Bottega Bianchi', citta: 'Napoli', nazione: 'Italia', interesse: ['Rivenditore Endero', 'Produzione conto terzi'], tipo_attivita: 'Negozio', partita_iva: '08887031212', profilo: '@bottegabianchi' }) },
};

// gli ordini del configuratore (worker/ordine.mjs): uno base con il ritiro, uno con tutte le personalizzazioni e la
// spedizione. Taglie e nomi «veri» dei tessuti sono INVENTATI: quelli di Endero stanno solo nella configurazione riservata
const TAGLIE = [38, 39, 40, 41, 42, 43, 44, 45];
const cresce = (da, passo) => TAGLIE.map((_, i) => Math.round((da + passo * i) * 10) / 10);
const tabella = leggiConfigurazione({ taglie: TAGLIE, regole: { verifica: 4 }, misure: {
  spalla: cresce(44, 1), spallina: cresce(15, 0.5), torace: cresce(100, 4), pancia: cresce(90, 4), bacino: cresce(96, 4),
  lunghezza_manica: cresce(64, 1), braccio: cresce(34, 1.5), avambraccio: cresce(28, 1), lunghezza_davanti: cresce(66, 1), lunghezza_dietro: cresce(76, 1.5) } });
const MISURE = { giro_collo: '43', spalla: '47', spallina: '16,5', torace: '56', pancia: '51', bacino: '54', lunghezza_manica: '61',
  braccio: '19,5', avambraccio: '15,5', polso: '24', lunghezza_davanti: '69', lunghezza_dietro: '80,5' };
const BASE = { quantita: '1', tessuto: 't0501', collo: 'italiano', taschino: 'no', asola: 'no', bottone: 'tinta', filato_bottone: '', iniziali: 'no',
  interno_collo: 'standard', interno_polso: 'standard', polsino: 'standard', ...MISURE, spedizione: 'ritiro', privacy: 'si' };
const ORDINI = {
  'ordine-base': { ...BASE, giro_collo: '41', nome: 'Mario Rossi', telefono: '333 123 4567', email: 'mario.rossi@esempio.it' },
  'ordine-completo': { ...BASE, quantita: '2', tessuto: 't0502', collo: 'button_down', taschino: 'si', taschino_tessuto: 't0502', asola: 'si', asola_colore: 'bordeaux',
    bottone: 'contrasto', filato_bottone: 'blu_notte', iniziali: 'si', iniziali_posizione: 'cuore', iniziali_lettere: 'LE',
    interno_collo: 'personalizzato', interno_collo_tessuto: 't2507', interno_polso: 'personalizzato', interno_polso_tessuto: 't2507', polsino: 'personalizzato', polsino_tessuto: 't1517',
    nome: 'Luca Esposito', telefono: '+39 347 765 4321', email: 'luca.esposito@esempio.it',
    spedizione: 'cinque', destinatario: 'Luca Esposito', indirizzo: 'Via dei Mille 10, scala B', cap: '80121', citta: 'Napoli', provincia: 'NA', note_consegna: 'Citofono Esposito, terzo piano' },
};
const VERI = {
  t0501: { articolo: 'Articolo d\'esempio', codice: '1001-01', cartella: 'Cartella d\'esempio A', posizione: 'riga 1, colonna 1', composizione: '100% cotone' },
  t0502: { articolo: 'Articolo d\'esempio', codice: '1001-07', cartella: 'Cartella d\'esempio A', posizione: 'riga 2, colonna 3', composizione: '100% cotone' },
  t2507: { articolo: 'Altro articolo', codice: '2040-12', cartella: 'Cartella d\'esempio B' },
};
const datiOrdine = (d, n) => {
  const o = ordinePulito(d);
  return { numero: `E-2026-00012${n}`, ordine: o, taglia: perIlReparto(o.misure, tabella), pagato: new Date('2026-11-25T19:49:00Z'),
    pagatoCentesimi: Math.round(o.conti.totale * 100), totaleCentesimi: Math.round(o.conti.totale * 100), emailCliente: o.cliente.email, tessutiVeri: VERI };
};

const locale = (html) => html
  .replaceAll('https://endero.men/email/', pathToFileURL(join(RADICE, 'public/email')).href + '/')
  .replaceAll('https://endero.men/camicia/', pathToFileURL(join(RADICE, 'public/camicia')).href + '/')
  .replaceAll('https://endero.men/font/', pathToFileURL(join(RADICE, 'public/font')).href + '/');
const pagine = [];
const scrivi = (nome, email) => {
  writeFileSync(join(uscita, `${nome}.html`), locale(email.html));
  writeFileSync(join(uscita, `${nome}.txt`), `Oggetto: ${email.oggetto}\n\n${email.testo}\n`);
  pagine.push(nome);
};
for (const [tipo, r] of Object.entries(ESEMPI)) {
  scrivi(`${tipo}-cliente`, perCliente(r));
  scrivi(`${tipo}-endero`, perEndero(r, { arrivo: new Date('2026-11-25T19:49:00Z') }));
}
for (const [i, [tipo, d]] of Object.entries(ORDINI).entries()) {
  const dati = datiOrdine(d, i + 3);
  scrivi(`${tipo}-cliente`, ordinePerCliente(dati));
  scrivi(`${tipo}-endero`, ordinePerEndero(dati));
}

const browser = await pw.chromium.launch();
for (const [formato, larga] of [['computer', 760], ['telefono', 390]]) {
  const page = await browser.newPage({ viewport: { width: larga, height: 900 }, deviceScaleFactor: 2 });
  for (const nome of pagine) {
    await page.goto(pathToFileURL(join(uscita, `${nome}.html`)).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(uscita, `${nome}-${formato}.png`), fullPage: true });
  }
  await page.close();
}
await browser.close();
rmSync(lavoro, { recursive: true, force: true });
console.log(`${pagine.length} email in ${uscita}: ${pagine.join(', ')}`);
