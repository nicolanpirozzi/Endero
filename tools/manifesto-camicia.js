// Fa l'immagine ferma della camicia (public/camicia/camicia.webp), quella che la pagina del configuratore mostra
// a chi non può vedere il 3D (niente JavaScript, niente WebGL, risparmio dati) e a tutti mentre il 3D si carica.
// La fotografa dal 3D stesso, fermo e senza vento: così quando il 3D parte non si vede alcun salto.
//   node tools/manifesto-camicia.js http://127.0.0.1:8766/camicie-su-misura/configuratore/ public/camicia/camicia.webp
// Serve il sito in locale (`npm run anteprima`) con i file del 3D in public/camicia/.
// Le proporzioni (1024×1202) sono quelle in cui la camicia riempie la tela allo stesso modo in larghezza e in
// altezza: con `object-fit: contain` l'immagine combacia con il 3D sia sul computer sia sul telefono.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [indirizzo, uscita] = process.argv.slice(2);
  if (!indirizzo || !uscita) { console.error('uso: node tools/manifesto-camicia.js <indirizzo della pagina> <uscita.webp>'); process.exit(2); }
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1300 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('errore:', e.message.slice(0, 200)));
  await p.goto(indirizzo + (indirizzo.includes('?') ? '&' : '?') + 'manuale', { waitUntil: 'load' });
  await p.waitForFunction(() => document.querySelector('[data-camicia]')?.dataset.stato === 'viva' && window.__camicia, null, { timeout: 180000 });
  const dati = await p.evaluate(async () => {
    const tela = window.__camicia.tela, casa = tela.parentElement;
    Object.assign(casa.style, { position: 'fixed', left: '0', top: '0', width: '1024px', height: '1202px', zIndex: '99' });
    await new Promise((si) => setTimeout(si, 400));                 // la tela si accorge della nuova misura
    for (let i = 0; i < 90; i++) window.__camicia.avanza(1 / 30);   // la camicia finisce di girarsi di tre quarti
    return [tela.width, tela.height, tela.toDataURL('image/webp', 0.9)];
  });
  await b.close();
  fs.writeFileSync(uscita, Buffer.from(dati[2].split(',')[1], 'base64'));
  console.log('scritta', uscita, dati[0] + '×' + dati[1], Math.round(fs.statSync(uscita).size / 1024), 'KB');
})().catch((e) => { console.error('FALLITO', e.message); process.exit(1); });
