// Controllo della camicia leggera del configuratore (src/configuratore/leggera.js, in prova a ?prova=leggera).
//
//   node tools/prova-leggera.js [indirizzo di base, per esempio http://localhost:8766]
//
// Su più schermi guarda che: i tre pezzi coprano l'immagine ferma senza che si noti; passando il mouse (o il dito) la
// camicia si sposti dal lato giusto, poco, e torni esattamente al suo posto; la pagina non si allarghi; non ci siano
// errori. Poi: movimento ridotto e niente JavaScript (resta l'immagine ferma), e quanti fotogrammi al secondo fa.
const { chromium } = require('playwright');

const BASE = (process.argv[2] || 'http://localhost:8766').replace(/\/$/, '');
const PAGINA = BASE + '/camicie-su-misura/configuratore/';
let falliti = 0, fatti = 0;
const vedi = (ok, cosa, dettaglio = '') => { fatti++; if (!ok) falliti++; console.log(`${ok ? '  ok ' : '  NO '} ${cosa}${dettaglio ? ' · ' + dettaglio : ''}`); };

/** Quanto differiscono due schermate (PNG), punto per punto: lo calcola la pagina stessa su una tela. */
const differenza = (page, a, b) => page.evaluate(async ([a, b]) => {
  const dati = async (s) => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
  const [x, y] = [await dati(a), await dati(b)];
  let somma = 0;
  for (let i = 0; i < x.length; i += 4) somma += Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2]));
  return somma / (x.length / 4);
}, [a.toString('base64'), b.toString('base64')]);

const SCHERMI = [
  ['computer 1440 x 790', { width: 1440, height: 790 }, 1],
  ['computer fitto 1440 x 790', { width: 1440, height: 790 }, 2],
  ['computer largo 1920 x 950', { width: 1920, height: 950 }, 1],
  ['portatile basso 1366 x 625', { width: 1366, height: 625 }, 1.25],
  ['finestra alta e stretta 1000 x 1100', { width: 1000, height: 1100 }, 1],
  ['tavoletta 820 x 1180', { width: 820, height: 1180 }, 2],
  ['telefono 390 x 844', { width: 390, height: 844 }, 3, true],
  ['telefono piccolo 320 x 568', { width: 320, height: 568 }, 2, true],
];

(async () => {
  const browser = await chromium.launch();
  for (const [nome, vista, fitto, dito] of SCHERMI) {
    console.log(nome);
    const ctx = await browser.newContext({ viewport: vista, deviceScaleFactor: fitto, hasTouch: !!dito, isMobile: !!dito });
    const page = await ctx.newPage();
    const errori = [];
    page.on('console', (m) => { if (m.type() === 'error') errori.push(m.text()); });
    page.on('pageerror', (e) => errori.push(String(e)));
    let peso = 0;
    page.on('response', async (r) => { if (r.url().includes('/camicia/leggera/')) { try { peso += (await r.body()).length; } catch { /* la pagina si è chiusa */ } } });
    await page.goto(PAGINA + '?prova=leggera&manuale', { waitUntil: 'networkidle' });
    const pronta = await page.waitForFunction(() => window.__camicia && document.querySelector('.configura__posa--strati.configura__posa--viva'), null, { timeout: 15000 }).then(() => true, () => false);
    vedi(pronta, 'i pezzi si caricano e compaiono', `${Math.round(peso / 1024)} KB`);
    if (!pronta) { await ctx.close(); continue; }
    await page.waitForTimeout(700);                                                  // la comparsa dura mezzo secondo
    const palco = page.locator('.configura__palco');
    const stato = () => page.evaluate(() => {
      const q = document.querySelector('.configura__posa--strati'), [, ombra, camicia] = q.querySelectorAll('img'), r = q.getBoundingClientRect(), c = camicia.getBoundingClientRect();
      return { riquadro: [r.left, r.top, r.width, r.height], camicia: [c.left, c.top, c.width, c.height], mossa: camicia.style.transform, ombra: ombra.style.transform,
        larga: document.documentElement.scrollWidth, p: { ...window.__camicia.p }, taglia: window.__camicia.taglia, invito: 'toccata' in document.querySelector('.configura__palco').dataset };
    });
    const s0 = await stato();
    vedi(s0.larga === vista.width, 'la pagina non si allarga', `${s0.larga} punti`);
    // i pezzi contro l'immagine ferma che coprono
    const coi = await palco.screenshot();
    await page.evaluate(() => { document.querySelector('.configura__posa--strati').style.cssText += ';opacity:0;transition:none'; });
    const senza = await palco.screenshot();
    await page.evaluate(() => { const q = document.querySelector('.configura__posa--strati'); q.style.opacity = ''; q.style.transition = ''; });
    const d = await differenza(page, coi, senza);
    vedi(d < 2.5, 'i pezzi fermi non si distinguono dall\'immagine ferma', `in media ${d.toFixed(2)} livelli su 255, grandezza ${s0.taglia}`);

    // una passata sul petto, da un lato all'altro
    const [rx, ry, rw, rh] = s0.riquadro, [cx, , cw] = s0.camicia, y = ry + rh * 0.55;
    const passata = async (da, a) => {
      if (dito) {
        const cdp = await ctx.newCDPSession(page);
        const tocco = (tipo, x) => cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: tipo === 'touchEnd' ? [] : [{ x, y }] });
        await tocco('touchStart', da);
        for (let i = 1; i <= 12; i++) { await tocco('touchMove', da + (a - da) * i / 12); await page.waitForTimeout(25); await page.evaluate(() => window.__camicia.passo(25)); }
        await tocco('touchEnd');
      } else {
        await page.mouse.move(da < a ? da - 80 : da + 80, y);
        for (let i = 0; i <= 12; i++) { await page.mouse.move(da + (a - da) * i / 12, y); await page.waitForTimeout(25); await page.evaluate(() => window.__camicia.passo(25)); }
      }
      // poi il tempo va avanti da solo: il massimo dello spostamento, e quanto ci mette a fermarsi
      return page.evaluate(() => { let max = 0, n = 0, mossa = ''; while (window.__camicia.passo(16.67) && n < 3000) { n++; const l = window.__camicia.p.lato; if (Math.abs(l) > Math.abs(max)) { max = l; mossa = document.querySelectorAll('.configura__posa--strati img')[2].style.transform; } } return { max, secondi: n * 16.67 / 1000, mossa }; });
    };
    const sinistra = cx + cw * 0.2, destra = cx + cw * 0.8;
    const versoDestra = await passata(sinistra, destra);
    const dopo = await stato();
    const orlo = (l) => `${(Math.abs(l) * 1.55 * 100).toFixed(1)} cm all'orlo`;
    vedi(versoDestra.max > 0.002 && versoDestra.max < 0.031, 'passando verso destra la camicia va a destra, poco', orlo(versoDestra.max));
    vedi(versoDestra.mossa.startsWith('matrix3d('), 'mentre si muove la camicia ha la sua trasformazione');
    vedi(dopo.mossa === '' && dopo.ombra === '' && versoDestra.secondi < 20, 'poi si ferma esattamente al suo posto', `dopo ${versoDestra.secondi.toFixed(1)} s`);
    vedi(dopo.invito, 'toccata, l\'invito a passarci sopra se ne va');
    const versoSinistra = await passata(destra, sinistra);
    vedi(versoSinistra.max < -0.002 && versoSinistra.max > -0.031, 'passando verso sinistra va a sinistra', orlo(versoSinistra.max));
    // la si può muovere di continuo: avanti e indietro senza aspettare, e resta entro il limite
    if (!dito) {
      let max = 0;
      for (let giro = 0; giro < 6; giro++) {
        const [da, a] = giro % 2 ? [destra, sinistra] : [sinistra, destra];
        for (let i = 0; i <= 10; i++) { await page.mouse.move(da + (a - da) * i / 10, y); await page.waitForTimeout(20); max = Math.max(max, await page.evaluate(() => { window.__camicia.passo(20); return Math.abs(window.__camicia.p.lato); })); }
      }
      vedi(max > 0.004 && max <= 0.0301, 'mossa avanti e indietro di continuo risponde sempre e non esagera', orlo(max));
      // fuori dalla camicia non succede niente
      await page.evaluate(() => { let n = 0; while (window.__camicia.passo(16.67) && n++ < 3000); });
      await page.mouse.move(rx + rw - 4, ry + rh * 0.3); await page.mouse.move(rx + rw - 30, ry + rh * 0.32);
      vedi(!(await page.evaluate(() => window.__camicia.passo(16.67))), 'sulla parete, fuori dalla camicia, non si muove niente');
    }
    vedi(errori.length === 0, 'nessun errore', errori.join(' | '));
    await ctx.close();
  }

  console.log('movimento ridotto');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 790 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    let chiesti = 0;
    page.on('request', (r) => { if (r.url().includes('/camicia/leggera/')) chiesti++; });
    await page.goto(PAGINA + '?prova=leggera', { waitUntil: 'networkidle' });
    vedi(await page.locator('.configura__ferma').isVisible() && !(await page.locator('.configura__posa--strati').count()) && chiesti === 0, 'resta l\'immagine ferma e i pezzi non si scaricano');
    vedi(!(await page.evaluate(() => 'viva' in document.querySelector('.configura__palco').dataset)), 'nessun invito a passarci sopra');
    await ctx.close();
  }
  console.log('senza JavaScript');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 790 }, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(PAGINA + '?prova=leggera', { waitUntil: 'load' });
    vedi(await page.locator('.configura__ferma').isVisible(), 'resta l\'immagine ferma');
    await ctx.close();
  }
  console.log('fluidità (qui il browser di prova disegna col processore: su uno schermo vero va meglio)');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 790 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(PAGINA + '?prova=leggera', { waitUntil: 'networkidle' });
    await page.waitForSelector('.configura__posa--strati.configura__posa--viva');
    await page.waitForTimeout(700);
    const c = await page.evaluate(() => { const r = document.querySelectorAll('.configura__posa--strati img')[2].getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
    await page.evaluate(() => { window.__tempi = []; let prima = performance.now(); const giro = (ora) => { window.__tempi.push(ora - prima); prima = ora; requestAnimationFrame(giro); }; requestAnimationFrame(giro); });
    for (let giro = 0; giro < 8; giro++) for (let i = 0; i <= 10; i++) { await page.mouse.move(c[0] + c[2] * (giro % 2 ? 0.8 - 0.06 * i : 0.2 + 0.06 * i), c[1] + c[3] * 0.55); await page.waitForTimeout(16); }
    await page.waitForTimeout(1500);
    const t = await page.evaluate(() => { const v = window.__tempi.slice(5).sort((a, b) => a - b); return { n: v.length, mediana: v[v.length >> 1], lento: v[Math.floor(v.length * 0.95)], mossa: document.querySelectorAll('.configura__posa--strati img')[2].style.transform !== '' }; });
    vedi(t.mossa, 'col tempo vero la camicia si muove');
    vedi(t.mediana < 20 && t.lento < 34, 'un fotogramma ogni sedicesimo di secondo circa', `mediana ${t.mediana.toFixed(1)} ms, il 95% entro ${t.lento.toFixed(1)} ms, ${t.n} fotogrammi`);
    // quanto lavora lo script a ogni fotogramma
    const lavoro = await page.evaluate(() => { const p = performance.now(); for (let i = 0; i < 200; i++) document.querySelector('.configura__palco').dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 600 + (i % 7), clientY: 400, bubbles: true })); return (performance.now() - p) / 200; });
    vedi(lavoro < 0.5, 'il conto di un movimento del mouse è trascurabile', `${(lavoro * 1000).toFixed(0)} milionesimi di secondo`);
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${fatti - falliti} controlli su ${fatti} a posto${falliti ? `, ${falliti} NO` : ''}`);
  process.exit(falliti ? 1 : 0);
})();
