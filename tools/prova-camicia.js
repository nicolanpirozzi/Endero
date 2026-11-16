// Controlla la camicia del configuratore (il film): immagine ferma, scene del tocco, mouse, dito, movimento ridotto.
// Scrive le schermate in una cartella e stampa cosa ha trovato; esce con errore se qualcosa non torna.
//
//   node tools/prova-camicia.js [indirizzo del sito] [cartella delle schermate]
//
// Serve il sito acceso: `npm run anteprima` (porta 8766). Gira su Chromium: Safari e un iPhone vero vanno provati a mano.
const { chromium, devices } = require('playwright');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');

const sito = (process.argv[2] || 'http://localhost:8766').replace(/\/$/, '');
const cartella = process.argv[3] || 'anteprima/prova-camicia';
const PAGINA = sito + '/camicie-su-misura/configuratore/';
const guasti = [];
const nota = (ok, testo) => { console.log((ok ? '  ok  ' : '  NO  ') + testo); if (!ok) guasti.push(testo); };

/** Lo stato delle due scene (quale si vede, a che punto è) e del palco. */
const stato = (p) => p.evaluate(() => ({
  ...Object.fromEntries([...document.querySelectorAll('video[data-scena]')].map((v) => [v.dataset.scena, {
    file: v.getAttribute('src'), pronta: v.readyState, viva: v.classList.contains('configura__film--vivo'), tempo: +v.currentTime.toFixed(2), ferma: v.paused, finita: v.ended,
  }])),
  armata: 'viva' in document.querySelector('.configura__palco').dataset, toccata: 'toccata' in document.querySelector('.configura__palco').dataset,
}));
const finita = (p, scena) => p.waitForFunction((s) => document.querySelector(`video[data-scena="${s}"]`).ended, scena, { timeout: 20000 });

/** Dove stanno fotogramma, camicia (nel fotogramma largo: 26-53% della larghezza), palco e riquadro. */
const misure = (p) => p.evaluate(() => {
  const r = document.querySelector('.configura__ferma').getBoundingClientRect(), s = document.querySelector('.configura__scheda').getBoundingClientRect(),
    q = document.querySelector('.configura__palco').getBoundingClientRect(), stretto = matchMedia('(max-width: 599px)').matches;
  const [da, a] = stretto ? [0.176, 0.824] : [0.26, 0.53];
  return { immagine: [r.left, r.top, r.width, r.height].map(Math.round), camicia: [Math.round(r.left + r.width * da), Math.round(r.left + r.width * a)],
    orlo: Math.round(r.top + r.height * 0.94), gancio: Math.round(r.top + r.height * 0.157), palco: [q.left, q.top, q.width, q.height].map(Math.round),
    riquadro: [Math.round(s.left), Math.round(s.top)], impilata: s.top >= q.bottom - 5, pagina: document.documentElement.scrollWidth, finestra: [innerWidth, innerHeight] };
});

async function apri(browser, opzioni, nome, prima) {
  const contesto = await browser.newContext(opzioni);
  const p = await contesto.newPage();
  if (prima) await prima(p);
  const errori = [];
  p.on('console', (m) => { if (m.type() === 'error') errori.push(m.text()); });
  p.on('pageerror', (e) => errori.push(String(e)));
  await p.goto(PAGINA, { waitUntil: 'load' });
  console.log(`\n${nome}`);
  return { p, errori, chiudi: () => contesto.close() };
}
// Safari su iPhone non scarica un video finché non lo si fa partire: lo si imita togliendo il precaricamento
const senzaPrecarico = (p) => p.route(PAGINA, async (r) => { const risposta = await r.fetch(); r.fulfill({ response: risposta, body: (await risposta.text()).replaceAll('preload="auto"', 'preload="none"') }); });
// Con il risparmio energetico, o con la riproduzione automatica spenta, il browser lascia partire un video solo da un
// gesto vero (un clic, un tocco). Qui lo si imita: play() riesce solo entro un secondo da un gesto. Non si può usare
// navigator.userActivation, perché ogni page.evaluate di Playwright conta come un gesto.
const soloDaUnGesto = (p) => p.addInitScript(() => {
  let gesto = -1e9;
  for (const tipo of ['click', 'pointerup', 'touchend', 'keydown']) addEventListener(tipo, (e) => { if (e.isTrusted) gesto = performance.now(); }, true);
  const vera = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { return performance.now() - gesto < 1000 ? vera.call(this) : Promise.reject(new DOMException('serve un gesto', 'NotAllowedError')); };
});

(async () => {
  mkdirSync(cartella, { recursive: true });
  const browser = await chromium.launch();

  // --- le inquadrature: finestre larghe, basse, alte e strette
  for (const [l, a] of [[1440, 900], [1920, 950], [1366, 625], [1024, 768], [2560, 1080], [1024, 1366], [1000, 1000], [844, 390], [768, 1024]]) {
    const { p, errori, chiudi } = await apri(browser, { viewport: { width: l, height: a } }, `finestra ${l} x ${a}`);
    const m = await misure(p);
    nota(m.pagina <= m.finestra[0], `la pagina non sporge di lato (${m.pagina} su ${m.finestra[0]})`);
    if (m.impilata) {
      nota(m.immagine[0] <= 0 && m.immagine[0] + m.immagine[2] >= l - 16 && m.immagine[1] <= m.palco[1] && m.immagine[1] + m.immagine[3] >= m.palco[1] + m.palco[3] - 1,
        `camicia sopra, riquadro sotto: il fotogramma copre il palco (${m.immagine.join(', ')})`);
      nota(m.camicia[0] >= 0 && m.camicia[1] <= l && m.orlo <= m.palco[1] + m.palco[3], `la camicia si vede intera (da ${m.camicia[0]} a ${m.camicia[1]} su ${l}, orlo a ${m.orlo} su ${m.palco[3]})`);
    } else {
      // a destra il fotogramma può finire prima del bordo: lì la parete è in ombra e sfuma nel blu della pagina
      nota(m.immagine[0] <= 0 && m.immagine[1] <= 0 && m.immagine[1] + m.immagine[3] >= a && m.immagine[0] + m.immagine[2] >= Math.min(l - 16, m.camicia[1] + m.immagine[2] * 0.25),
        `il fotogramma copre la colonna della camicia (${m.immagine.join(', ')})`);
      nota(m.camicia[0] >= 0 && m.camicia[1] <= m.riquadro[0] && m.orlo <= a && m.gancio >= 0, `la camicia sta a sinistra del riquadro, intera (camicia ${m.camicia.join('-')}, riquadro da ${m.riquadro[0]}, orlo a ${m.orlo} su ${a})`);
    }
    const invito = await p.evaluate(() => { const r = document.querySelector('.configura__invito').getBoundingClientRect(); return Math.round(r.left + r.width / 2); });
    nota(invito > m.camicia[0] && invito < m.camicia[1], `l'invito sta sotto la camicia (a ${invito}, camicia ${m.camicia.join('-')})`);
    await p.waitForTimeout(400);
    await p.screenshot({ path: join(cartella, `finestra-${l}x${a}.png`) });
    nota(errori.length === 0, 'nessun errore in console' + (errori.length ? ': ' + errori.join(' | ') : ''));
    await chiudi();
  }

  // --- il mouse
  {
    const { p, errori, chiudi } = await apri(browser, { viewport: { width: 1440, height: 900 } }, 'mouse (1440 x 900)');
    const m = await misure(p), y = 450, centro = Math.round((m.camicia[0] + m.camicia[1]) / 2);
    await p.waitForFunction(() => document.querySelector('video[data-scena="da-sinistra"]').classList.contains('configura__film--vivo'), null, { timeout: 15000 }).catch(() => {});
    let s = await stato(p);
    nota(s['da-sinistra'].viva && !s['da-sinistra'].ferma && !s.toccata, 'appena pronta, la camicia si muove da sola, toccata da sinistra, e l\'invito resta');
    await p.waitForTimeout(1500);
    await p.screenshot({ path: join(cartella, 'mouse-saluto.png') });
    await finita(p, 'da-sinistra');
    await p.waitForTimeout(800);
    s = await stato(p);
    nota(!s['da-sinistra'].viva, 'finita la scena si torna all\'immagine ferma');
    // da destra verso sinistra, partendo da fuori (accanto al riquadro), come fa un mouse vero
    await p.mouse.move(m.riquadro[0] - 20, y); await p.mouse.move(m.camicia[1] - 60, y, { steps: 10 });
    await p.waitForTimeout(700);
    s = await stato(p);
    nota(s['da-destra'].viva && s['da-destra'].tempo > 0.2 && s.toccata, `il mouse arriva da destra: parte il tocco da destra (a ${s['da-destra'].tempo} s) e l'invito si spegne`);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: join(cartella, 'mouse-da-destra.png') });
    // mentre va, un altro passaggio non la interrompe
    await p.mouse.move(m.immagine[0] + m.immagine[2] * 0.08, y, { steps: 4 }); await p.mouse.move(m.camicia[0] + 160, y, { steps: 10 });
    await p.waitForTimeout(200);
    s = await stato(p);
    nota(s['da-destra'].viva && !s['da-sinistra'].viva, 'un passaggio a scena in corso non la interrompe');
    await finita(p, 'da-destra');
    // il mouse è rimasto sulla camicia: basta spostarlo piano, un pixel alla volta, verso destra
    for (let k = 1; k <= 10; k++) { await p.mouse.move(m.camicia[0] + 160 + k, y); await p.waitForTimeout(20); }
    await p.waitForTimeout(600);
    s = await stato(p);
    nota(s['da-sinistra'].viva && s['da-sinistra'].tempo > 0.2, `il mouse si sposta piano verso destra: parte il tocco da sinistra (a ${s['da-sinistra'].tempo} s)`);
    await finita(p, 'da-sinistra');
    // dall'alto, in verticale, sulla metà destra della camicia: la mano arriva da destra
    await p.mouse.move(centro + 90, 40); await p.mouse.move(centro + 90, 420, { steps: 12 });
    await p.waitForTimeout(600);
    s = await stato(p);
    nota(s['da-destra'].viva && s['da-destra'].tempo > 0.2, `il mouse scende dall'alto sulla metà destra: parte il tocco da destra (a ${s['da-destra'].tempo} s)`);
    await finita(p, 'da-destra');
    // fuori dalla camicia (sul riquadro) il mouse non la muove
    await p.mouse.move(m.riquadro[0] + 40, y); await p.mouse.move(m.riquadro[0] + 200, y, { steps: 6 });
    await p.waitForTimeout(400);
    s = await stato(p);
    nota(!s['da-sinistra'].viva && !s['da-destra'].viva, 'sul riquadro il mouse non muove la camicia');
    nota(errori.length === 0, 'nessun errore in console' + (errori.length ? ': ' + errori.join(' | ') : ''));
    await chiudi();
  }

  // --- il browser non lascia partire i video da soli: niente saluto, il mouse non basta, un clic sì
  {
    const { p, errori, chiudi } = await apri(browser, { viewport: { width: 1440, height: 900 } }, 'video che partono solo da un gesto', soloDaUnGesto);
    const m = await misure(p), centro = Math.round((m.camicia[0] + m.camicia[1]) / 2);
    await p.waitForTimeout(3500);
    let s = await stato(p);
    nota(!s['da-sinistra'].viva && !s['da-destra'].viva && s.armata && !s.toccata, 'niente saluto: resta l\'immagine ferma, con l\'invito');
    await p.mouse.move(m.riquadro[0] - 20, 450); await p.mouse.move(centro, 450, { steps: 10 });
    await p.waitForTimeout(500);
    s = await stato(p);
    nota(!s['da-sinistra'].viva && !s['da-destra'].viva && !s.toccata, 'il mouse che passa non basta: resta l\'immagine ferma, con l\'invito');
    await p.mouse.click(centro - 80, 450);
    await p.waitForTimeout(700);
    s = await stato(p);
    nota(s['da-sinistra'].viva && s['da-sinistra'].tempo > 0.2 && s.toccata, `un clic sulla metà sinistra la fa partire (a ${s['da-sinistra'].tempo} s)`);
    nota(errori.length === 0, 'nessun errore in console' + (errori.length ? ': ' + errori.join(' | ') : ''));
    await chiudi();
  }

  // --- telefono: il film verticale, lo scorrimento, il tocco
  {
    const { p, errori, chiudi } = await apri(browser, { ...devices['iPhone 14'] }, 'telefono (iPhone 14, video non precaricati)', senzaPrecarico);
    const m = await misure(p);
    nota(m.pagina === m.finestra[0], `la pagina è larga quanto lo schermo (${m.pagina} su ${m.finestra[0]})`);
    nota(m.camicia[0] >= 0 && m.camicia[1] <= m.finestra[0] && m.gancio >= 56 && m.orlo <= m.palco[1] + m.palco[3], `la camicia si vede intera sotto la testata (gancio a ${m.gancio}, orlo a ${m.orlo} su ${m.palco[3]})`);
    await finita(p, 'da-sinistra').catch(() => {});
    let s = await stato(p);
    nota(/-telefono\.mp4/.test(s['da-sinistra'].file || ''), `sul telefono si scarica il film verticale (${s['da-sinistra'].file})`);
    await p.waitForTimeout(800);
    await p.screenshot({ path: join(cartella, 'telefono-ferma.png') });
    // una strisciata in verticale che parte dalla camicia è la pagina che scorre: la camicia non deve muoversi
    const cdp = await p.context().newCDPSession(p);
    const dito = (tipo, y) => cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: tipo === 'touchEnd' ? [] : [{ x: 195, y }] });
    await dito('touchStart', 330); for (const y of [310, 280, 250, 220, 190]) { await dito('touchMove', y); await p.waitForTimeout(16); } await dito('touchEnd');
    await p.waitForTimeout(600);
    s = await stato(p);
    nota(!s['da-sinistra'].viva && !s['da-destra'].viva, 'scorrere la pagina partendo dalla camicia non la muove');
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(900);
    await p.touchscreen.tap(m.finestra[0] * 0.8, 300);
    await p.waitForTimeout(900);
    s = await stato(p);
    nota(s['da-destra'].viva && s['da-destra'].tempo > 0.2, `un tocco a destra: la mano arriva da destra (a ${s['da-destra'].tempo} s)`);
    await p.waitForTimeout(1200);
    await p.screenshot({ path: join(cartella, 'telefono-da-destra.png') });
    nota(errori.length === 0, 'nessun errore in console' + (errori.length ? ': ' + errori.join(' | ') : ''));
    await chiudi();
  }

  // --- movimento ridotto e niente JavaScript: resta l'immagine ferma, senza invito, e i film non si scaricano
  for (const [nome, opzioni] of [['movimento ridotto', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }], ['senza JavaScript', { viewport: { width: 1440, height: 900 }, javaScriptEnabled: false }]]) {
    const contesto = await browser.newContext(opzioni);
    const p = await contesto.newPage();
    const film = [];
    p.on('request', (r) => { if (/\.mp4/.test(r.url())) film.push(r.url()); });
    await p.goto(PAGINA, { waitUntil: 'load' });
    await p.waitForTimeout(3200);
    console.log(`\n${nome}`);
    const immagine = await p.locator('.configura__ferma').evaluate((i) => i.complete && i.naturalWidth > 0);
    nota(immagine, 'l\'immagine ferma c\'è');
    nota(film.length === 0, 'i film non si scaricano' + (film.length ? ': ' + film.join(', ') : ''));
    const invito = await p.locator('.configura__invito').evaluate((i) => getComputedStyle(i).opacity);
    nota(invito === '0', `l'invito a passarci sopra non compare (opacità ${invito})`);
    await contesto.close();
  }

  await browser.close();
  console.log(guasti.length ? `\n${guasti.length} cose non tornano` : '\ntutto a posto', '· schermate in', cartella);
  process.exit(guasti.length ? 1 : 0);
})();
