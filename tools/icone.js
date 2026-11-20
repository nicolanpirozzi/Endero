// Le icone del sito e il logo per Google, dal vettoriale approvato (brand/logo/).
//
//   node tools/icone.js
//
// Scrive in public/:
//   favicon.svg       l'icona della scheda del browser e dei risultati di Google: il simbolo bianco su un riquadro
//                     blu. Google la vuole quadrata, e il simbolo da solo è largo una volta e mezza la sua altezza;
//                     il riquadro pieno serve perché il blu su fondo trasparente sparisce con i temi scuri.
//   favicon.ico       la stessa a 16, 32 e 48 punti, per chi chiede ancora /favicon.ico
//   icona-192.png     la stessa in PNG (192 = 4 x 48: Google chiede multipli di 48)
//   icona-180.png     per la schermata iniziale dell'iPhone: senza angoli tondi, li mette lui
//   logo-endero.png   il logo intero, blu su bianco, per i dati di organizzazione (Google lo vuole di almeno 112 punti
//                     e in un formato con le sue misure: il vettoriale non le ha)
// Si rilancia solo se cambia il logo.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RADICE = path.join(__dirname, '..');
const PUBBLICO = path.join(RADICE, 'public');
const BLU = '#0f285e';
const svg = (nome) => fs.readFileSync(path.join(RADICE, 'brand/logo', `endero-${nome}.svg`), 'utf8');
const dentro = (s) => s.slice(s.indexOf('>') + 1, s.lastIndexOf('</svg>'));
const misure = (s) => s.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);

/** Il simbolo al centro di un quadrato di 64: `largo` è quanto del lato occupa, `raggio` quello degli angoli. */
function icona({ largo = 0.74, raggio = 14 } = {}) {
  const s = svg('simbolo');
  const [w, h] = misure(s);
  const scala = (64 * largo) / w;
  const x = (64 - w * scala) / 2, y = (64 - h * scala) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="${raggio}" fill="${BLU}"/><g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scala.toFixed(4)})">${dentro(s).replace(/currentColor/g, '#fff')}</g></svg>\n`;
}

/** Un file .ico fatto di PNG: lo leggono tutti i browser e i sistemi da Windows Vista in poi. */
function ico(png) {
  const testa = Buffer.alloc(6 + 16 * png.length);
  testa.writeUInt16LE(1, 2);
  testa.writeUInt16LE(png.length, 4);
  let dove = testa.length;
  png.forEach(({ lato, dati }, i) => {
    const v = 6 + 16 * i;
    testa.writeUInt8(lato, v);
    testa.writeUInt8(lato, v + 1);
    testa.writeUInt16LE(1, v + 4);
    testa.writeUInt16LE(32, v + 6);
    testa.writeUInt32LE(dati.length, v + 8);
    testa.writeUInt32LE(dove, v + 12);
    dove += dati.length;
  });
  return Buffer.concat([testa, ...png.map((p) => p.dati)]);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const scatta = async (disegno, largo, alto, fondo) => {
    await page.setViewportSize({ width: largo, height: alto });
    await page.setContent(`<style>html,body{margin:0;background:${fondo || 'transparent'}}svg{display:block;width:${largo}px;height:${alto}px}</style>${disegno}`);
    return page.screenshot({ omitBackground: !fondo, clip: { x: 0, y: 0, width: largo, height: alto } });
  };

  fs.writeFileSync(path.join(PUBBLICO, 'favicon.svg'), icona());
  fs.writeFileSync(path.join(PUBBLICO, 'favicon.ico'), ico(await Promise.all([16, 32, 48].map(async (lato) => ({ lato, dati: await scatta(icona(), lato, lato) })))));
  fs.writeFileSync(path.join(PUBBLICO, 'icona-192.png'), await scatta(icona(), 192, 192));
  fs.writeFileSync(path.join(PUBBLICO, 'icona-180.png'), await scatta(icona({ largo: 0.68, raggio: 0 }), 180, 180, BLU));

  // il logo intero, con un margine bianco intorno
  const completo = svg('completo');
  const [w, h] = misure(completo);
  const largo = 1200, margine = 120, scala = (largo - 2 * margine) / w;
  const alto = Math.round(h * scala + 2 * margine);
  const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largo} ${alto}"><g transform="translate(${margine} ${margine}) scale(${scala.toFixed(4)})">${dentro(completo).replace(/currentColor/g, BLU)}</g></svg>`;
  fs.writeFileSync(path.join(PUBBLICO, 'logo-endero.png'), await scatta(logo, largo, alto, '#fff'));

  await browser.close();
  for (const f of ['favicon.svg', 'favicon.ico', 'icona-192.png', 'icona-180.png', 'logo-endero.png']) console.log(f.padEnd(18), fs.statSync(path.join(PUBBLICO, f)).size, 'byte');
})();
