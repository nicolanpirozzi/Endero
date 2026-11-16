// Controlla la camicia del configuratore (il film): immagine ferma, scene di vento, mouse, dito, movimento ridotto.
// Scrive le schermate in una cartella e stampa cosa ha trovato; esce con errore se qualcosa non torna.
//
//   node tools/prova-camicia.js [indirizzo del sito] [cartella delle schermate]
//
// Serve il sito acceso: `npm run anteprima` (porta 8766).
const { chromium, devices } = require('playwright');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');

const sito = (process.argv[2] || 'http://localhost:8766').replace(/\/$/, '');
const cartella = process.argv[3] || 'anteprima/prova-camicia';
const PAGINA = sito + '/camicie-su-misura/configuratore/';
const guasti = [];
const nota = (ok, testo) => { console.log((ok ? '  ok  ' : '  NO  ') + testo); if (!ok) guasti.push(testo); };

/** Lo stato delle due scene: quale si vede, a che punto è. */
const stato = (p) => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('video[data-scena]')].map((v) => [v.dataset.scena, {
  file: v.getAttribute('src'), pronta: v.readyState, viva: v.classList.contains('configura__film--vivo'), tempo: +v.currentTime.toFixed(2), ferma: v.paused, finita: v.ended,
}])));

/** Dove sta la camicia sullo schermo, dal riquadro dell'immagine ferma (nel fotogramma largo: 27,5-51,5% della larghezza). */
const misure = (p) => p.evaluate(() => {
  const r = document.querySelector('.configura__ferma').getBoundingClientRect(), s = document.querySelector('.configura__scheda').getBoundingClientRect();
  return { immagine: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], camicia: [Math.round(r.left + r.width * 0.275), Math.round(r.left + r.width * 0.515)],
    riquadro: Math.round(s.left), pagina: document.documentElement.scrollWidth, finestra: innerWidth };
});

async function apri(browser, opzioni, nome, comeIPhone) {
  const contesto = await browser.newContext(opzioni);
  const p = await contesto.newPage();
  // Safari su iPhone non scarica un video finché non lo si fa partire: qui lo si imita togliendo il precaricamento
  if (comeIPhone) await p.route(PAGINA, async (r) => { const risposta = await r.fetch(); r.fulfill({ response: risposta, body: (await risposta.text()).replaceAll('preload="auto"', 'preload="none"') }); });
  const errori = [];
  p.on('console', (m) => { if (m.type() === 'error') errori.push(m.text()); });
  p.on('pageerror', (e) => errori.push(String(e)));
  await p.goto(PAGINA, { waitUntil: 'load' });
  console.log(`\n${nome}`);
  return { p, errori, chiudi: () => contesto.close() };
}

(async () => {
  mkdirSync(cartella, { recursive: true });
  const browser = await chromium.launch();

  // --- computer: il saluto, poi il mouse da sinistra e da destra
  for (const [l, a] of [[1440, 900], [1024, 768], [1920, 1080], [1280, 620]]) {
    const { p, errori, chiudi } = await apri(browser, { viewport: { width: l, height: a } }, `computer ${l} x ${a}`);
    const m = await misure(p);
    nota(m.pagina <= m.finestra, `la pagina non sporge di lato (${m.pagina} su ${m.finestra})`);
    nota(m.immagine[0] <= 0 && m.immagine[0] + m.immagine[2] >= l - 16 && m.immagine[3] >= a, `il fotogramma copre la pagina (${m.immagine.join(', ')})`);
    nota(m.camicia[0] >= 0 && m.camicia[1] <= m.riquadro, `la camicia sta a sinistra del riquadro (camicia ${m.camicia.join('-')}, riquadro da ${m.riquadro})`);
    if (l === 1440) {
      await p.waitForFunction(() => document.querySelector('video[data-scena="da-sinistra"]').classList.contains('configura__film--vivo'), null, { timeout: 15000 }).catch(() => {});
      let s = await stato(p);
      nota(s['da-sinistra'].viva && !s['da-sinistra'].ferma, 'appena pronta, la camicia saluta con una folata da sinistra');
      await p.waitForTimeout(700);
      await p.screenshot({ path: join(cartella, 'computer-saluto.png') });
      await p.waitForFunction(() => document.querySelector('video[data-scena="da-sinistra"]').ended, null, { timeout: 15000 });
      await p.waitForTimeout(300);
      s = await stato(p);
      nota(!s['da-sinistra'].viva, 'finita la scena si torna all\'immagine ferma');
      await p.screenshot({ path: join(cartella, 'computer-ferma.png') });
      // il mouse passa sulla camicia da destra verso sinistra: folata da destra.
      // Ogni passaggio parte da fuori (accanto al riquadro, o dal bordo sinistro), come fa un mouse vero.
      const y = a * 0.5, fuoriDestra = m.riquadro - 20, fuoriSinistra = m.immagine[0] + m.immagine[2] * 0.08;
      await p.mouse.move(fuoriDestra, y); await p.mouse.move(m.camicia[1] - 60, y, { steps: 10 });
      await p.waitForTimeout(600);
      s = await stato(p);
      nota(s['da-destra'].viva && s['da-destra'].tempo > 0.2, `mouse verso sinistra: parte la folata da destra (a ${s['da-destra'].tempo} s)`);
      await p.screenshot({ path: join(cartella, 'computer-da-destra.png') });
      // mentre va, un altro passaggio non la interrompe
      await p.mouse.move(fuoriSinistra, y, { steps: 4 }); await p.mouse.move(m.camicia[0] + 160, y, { steps: 10 });
      await p.waitForTimeout(200);
      s = await stato(p);
      nota(s['da-destra'].viva && !s['da-sinistra'].viva, 'un passaggio a scena in corso non la interrompe');
      await p.waitForFunction(() => document.querySelector('video[data-scena="da-destra"]').ended, null, { timeout: 15000 });
      await p.mouse.move(fuoriSinistra, y + 30); await p.mouse.move(m.camicia[0] + 160, y + 30, { steps: 10 });
      await p.waitForTimeout(500);
      s = await stato(p);
      nota(s['da-sinistra'].viva && s['da-sinistra'].tempo > 0.2, `mouse verso destra: parte la folata da sinistra (a ${s['da-sinistra'].tempo} s)`);
      // fuori dalla camicia (sul riquadro) il mouse non soffia
      await p.waitForFunction(() => document.querySelector('video[data-scena="da-sinistra"]').ended, null, { timeout: 15000 });
      await p.mouse.move(m.riquadro + 40, y); await p.mouse.move(m.riquadro + 200, y, { steps: 6 });
      await p.waitForTimeout(300);
      s = await stato(p);
      nota(!s['da-sinistra'].viva && !s['da-destra'].viva, 'sul riquadro il mouse non muove la camicia');
    } else {
      await p.waitForTimeout(600);
      await p.screenshot({ path: join(cartella, `computer-${l}.png`) });
    }
    nota(errori.length === 0, 'nessun errore in console' + (errori.length ? ': ' + errori.join(' | ') : ''));
    await chiudi();
  }

  // --- telefono: il film verticale, il tocco
  {
    const { p, errori, chiudi } = await apri(browser, { ...devices['iPhone 14'] }, 'telefono (iPhone 14, video non precaricati)', true);
    const m = await misure(p);
    nota(m.pagina === m.finestra, `la pagina è larga quanto lo schermo (${m.pagina} su ${m.finestra})`);
    await p.waitForFunction(() => document.querySelector('video[data-scena="da-sinistra"]').ended, null, { timeout: 20000 }).catch(() => {});
    let s = await stato(p);
    nota(/-telefono\.mp4/.test(s['da-sinistra'].file || ''), `sul telefono si scarica il film verticale (${s['da-sinistra'].file})`);
    await p.waitForTimeout(300);
    await p.screenshot({ path: join(cartella, 'telefono-ferma.png') });
    await p.touchscreen.tap(m.finestra * 0.8, 300);
    await p.waitForTimeout(700);
    s = await stato(p);
    nota(s['da-destra'].viva && s['da-destra'].tempo > 0.2, `un tocco a destra: folata da destra (a ${s['da-destra'].tempo} s)`);
    await p.screenshot({ path: join(cartella, 'telefono-da-destra.png') });
    nota(errori.length === 0, 'nessun errore in console' + (errori.length ? ': ' + errori.join(' | ') : ''));
    await chiudi();
  }

  // --- movimento ridotto e niente JavaScript: resta l'immagine ferma, e i film non si scaricano
  for (const [nome, opzioni] of [['movimento ridotto', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }], ['senza JavaScript', { viewport: { width: 1440, height: 900 }, javaScriptEnabled: false }]]) {
    const contesto = await browser.newContext(opzioni);
    const p = await contesto.newPage();
    const film = [];
    p.on('request', (r) => { if (/\.mp4/.test(r.url())) film.push(r.url()); });
    await p.goto(PAGINA, { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    console.log(`\n${nome}`);
    const immagine = await p.locator('.configura__ferma').evaluate((i) => i.complete && i.naturalWidth > 0);
    nota(immagine, 'l\'immagine ferma c\'è');
    nota(film.length === 0, 'i film non si scaricano' + (film.length ? ': ' + film.join(', ') : ''));
    await contesto.close();
  }

  await browser.close();
  console.log(guasti.length ? `\n${guasti.length} cose non tornano` : '\ntutto a posto', '· schermate in', cartella);
  process.exit(guasti.length ? 1 : 0);
})();
