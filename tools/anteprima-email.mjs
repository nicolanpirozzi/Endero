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
const { perEndero, perCliente } = await import(pathToFileURL(file).href);

const ESEMPI = {
  contatto: { tipo: 'contatto', nome: 'Mario Rossi', telefono: '333 123 4567', email: 'mario.rossi@esempio.it', giorno: '', fascia: '', dettagli: '',
    messaggio: 'Buongiorno, vorrei sapere se avete la giacca blu della collezione in taglia 50.\nGrazie!', pagina: '/dove-siamo/', paese: 'IT' },
  'presa-misure': { tipo: 'presa-misure', nome: 'Luca Esposito', telefono: '+39 347 765 4321', email: 'luca.esposito@esempio.it', giorno: '2026-12-01', fascia: 'Pomeriggio', dettagli: '',
    messaggio: 'Vorrei due camicie bianche per un matrimonio.', pagina: '/camicie-su-misura/', paese: 'IT' },
  rivenditore: { tipo: 'rivenditore', nome: 'Anna Bianchi', telefono: '081 123 4567', email: 'anna@bottegabianchi.it', giorno: '', fascia: '', messaggio: 'Abbiamo un negozio in centro da vent\'anni.', pagina: '/diventa-rivenditore/', paese: 'IT',
    dettagli: JSON.stringify({ attivita: 'Bottega Bianchi', citta: 'Napoli', nazione: 'Italia', interesse: ['Rivenditore Endero', 'Produzione conto terzi'], tipo_attivita: 'Negozio', partita_iva: '08887031212', profilo: '@bottegabianchi' }) },
};

const locale = (html) => html
  .replaceAll('https://endero.men/email/', pathToFileURL(join(RADICE, 'public/email')).href + '/')
  .replaceAll('https://endero.men/font/', pathToFileURL(join(RADICE, 'public/font')).href + '/');
const pagine = [];
for (const [tipo, r] of Object.entries(ESEMPI)) {
  for (const [chi, email] of [['cliente', perCliente(r)], ['endero', perEndero(r, { arrivo: new Date('2026-11-25T19:49:00Z') })]]) {
    const nome = `${tipo}-${chi}`;
    writeFileSync(join(uscita, `${nome}.html`), locale(email.html));
    writeFileSync(join(uscita, `${nome}.txt`), `Oggetto: ${email.oggetto}\n\n${email.testo}\n`);
    pagine.push(nome);
  }
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
