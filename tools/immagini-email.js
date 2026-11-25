// Le immagini delle email del sito (worker/email.mjs): in cima una foto con il logo bianco sopra, una per tipo di
// richiesta, e il logo bianco piccolo per il piè di pagina blu. Le email non leggono WebP né SVG ovunque: qui si fanno
// JPEG e PNG a grandezza doppia (le email le mostrano a 600 punti di larghezza).
//
//   node tools/immagini-email.js            → public/email/
//
// Le foto sono quelle del sito (public/foto/); quale foto per quale richiesta: FOTO qui sotto.
const { chromium } = require('playwright');
const { readFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const RADICE = join(__dirname, '..');
const USCITA = join(RADICE, 'public/email');
// tipo di richiesta → foto (e dove tenerla a fuoco nel ritaglio)
const FOTO = {
  contatto: ['foto/artigianato/coppole-o-1600.webp', '50% 22%'],
  'presa-misure': ['foto/sede/giacca-in-prova-o-1600.webp', '50% 40%'],
  rivenditore: ['foto/sede/negozio-fronte-o-1600.webp', '50% 50%'],
};
const LARGA = 1200, ALTA = 520;
const logo = readFileSync(join(RADICE, 'brand/logo/endero-completo.svg'), 'utf8').replace('<svg ', '<svg class="logo" ');

(async () => {
  mkdirSync(USCITA, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: LARGA, height: ALTA }, deviceScaleFactor: 1 });
  for (const [tipo, [foto, fuoco]] of Object.entries(FOTO)) {
    const dati = readFileSync(join(RADICE, 'public', foto)).toString('base64');
    await page.setContent(`<!doctype html><style>
      html, body { margin: 0; }
      .q { position: relative; width: ${LARGA}px; height: ${ALTA}px; overflow: hidden; background: #0f285e; }
      .q img { width: 100%; height: 100%; object-fit: cover; object-position: ${fuoco}; display: block; }
      /* velo blu in basso, perché il logo bianco si legga su ogni foto */
      .q::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10, 27, 69, 0) 38%, rgba(10, 27, 69, 0.72) 100%); }
      .logo { position: absolute; left: 64px; bottom: 52px; width: 236px; height: auto; color: #fbf9f4; z-index: 1; }
    </style><div class="q"><img src="data:image/webp;base64,${dati}" alt="">${logo}</div>`);
    await page.waitForFunction(() => document.querySelector('img').complete);
    await page.screenshot({ path: join(USCITA, `testata-${tipo}.jpg`), type: 'jpeg', quality: 80 });
    console.log(`public/email/testata-${tipo}.jpg`);
  }
  // il logo bianco del piè di pagina: 300 punti, mostrato a 150
  await page.setViewportSize({ width: 300, height: Math.round(300 * 119.3 / 207.8) });
  await page.setContent(`<!doctype html><style>html, body { margin: 0; background: transparent; } .logo { display: block; width: 300px; height: auto; color: #fbf9f4; }</style>${logo}`);
  await page.screenshot({ path: join(USCITA, 'logo-bianco.png'), omitBackground: true });
  console.log('public/email/logo-bianco.png');
  await browser.close();
})();
