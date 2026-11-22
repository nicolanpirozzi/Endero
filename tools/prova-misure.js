// Controlla la guida alle misure del configuratore (src/configuratore/guida.js, proprietario 2026-11-21 e 22): la
// finestra dei passi che si apre a ogni visita; entrando in un campo di misura la camicia che si ferma, lo zoom sulla
// zona e il tratteggio blu sottile (public/camicia/guide.json), il giro sul retro per spalla e lunghezza dietro, la
// frase sotto il campo; sul telefono e sul tablet il riquadro con lo zoom sopra il campo; le tre misure dello zoom
// (?zoom=a|b|c), la rete lenta, il movimento ridotto e la pagina senza JavaScript.
//
//   node tools/prova-misure.js [indirizzo del sito, senza barra finale] [cartella per le schermate]
//
// In locale: npm run anteprima (porta 8766). Sull'anteprima: l'indirizzo di Cloudflare.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const base = (process.argv[2] || 'http://127.0.0.1:8766').replace(/\/$/, '');
const schermate = process.argv[3] || '';
const PAGINA = base + '/camicie-su-misura/configuratore/';
let passati = 0;
const falliti = [];
function controlla(nome, vero, dettaglio = '') {
  if (vero) passati++; else falliti.push(nome + (dettaglio ? ` (${dettaglio})` : ''));
  console.log(`${vero ? '  ok ' : '  NO '} ${nome}${!vero && dettaglio ? ' → ' + dettaglio : ''}`);
}
const foto = async (page, nome) => { if (schermate) { fs.mkdirSync(schermate, { recursive: true }); await page.screenshot({ path: path.join(schermate, nome + '.png') }); } };
const MISURE = ['giro_collo', 'spalla', 'spallina', 'torace', 'pancia', 'bacino', 'lunghezza_manica', 'braccio', 'avambraccio', 'polso', 'lunghezza_davanti', 'lunghezza_dietro'];
const DIETRO = ['spalla', 'lunghezza_dietro'];
const FORMATI = [
  ['computer', { viewport: { width: 1440, height: 900 } }, 'palco'],
  ['schermo basso', { viewport: { width: 1366, height: 625 }, deviceScaleFactor: 1.25 }, 'palco'],
  ['tablet', { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'finestra'],
  ['telefono', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, 'finestra'],
  ['telefono basso', { viewport: { width: 375, height: 548 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'finestra'],
  ['telefono di traverso', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'finestra'],
];

(async () => {
  const browser = await chromium.launch();
  const nuovo = async (opzioni = {}) => {
    const contesto = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opzioni });
    const page = await contesto.newPage();
    const errori = [], rotte = [];
    page.on('console', (m) => { if (m.type() === 'error') errori.push(m.text()); });
    page.on('pageerror', (e) => errori.push(String(e)));
    page.on('response', (r) => { if (r.status() >= 400) rotte.push(`${r.status()} ${r.url().split('/').slice(3).join('/')}`); });
    return { contesto, page, errori, rotte };
  };
  // ci sono le linee e il retro? (se il build non li ha trovati, le «i» mostrano solo la frase)
  const sonda = await nuovo();
  await sonda.page.goto(PAGINA + '?senza-passi', { waitUntil: 'domcontentloaded' });
  const dati = await sonda.page.evaluate(() => { const p = document.querySelector('.configura__palco').dataset; return { guide: !!p.guide, dietro: !!p.dietro, giro: !!p.giro }; });
  await sonda.contesto.close();
  console.log(`linee ${dati.guide ? 'presenti' : 'ASSENTI'}, retro ${dati.dietro ? 'presente' : 'ASSENTE'}, giro ${dati.giro ? 'presente' : 'ASSENTE'}`);
  controlla('il build ha trovato le linee, la camicia da dietro e il giro', dati.guide && dati.dietro && dati.giro, JSON.stringify(dati));

  // ---------------------------------------------------------------- 1. la finestra dei passi
  console.log('La finestra dei passi');
  for (const [nome, opzioni] of FORMATI) {
    const a = await nuovo(opzioni), { page } = a;
    await page.goto(PAGINA, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const s = await page.evaluate(() => {
      const d = document.getElementById('come-misurare'), r = d.querySelector('.finestra__corpo').getBoundingClientRect();
      return { aperta: d.open, passi: [...d.querySelectorAll('li')].map((x) => x.textContent.trim()), fuoco: document.activeElement?.textContent.trim(), dentro: r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1, h1: document.querySelectorAll('h1').length, largo: document.documentElement.scrollWidth <= innerWidth, viva: 'viva' in document.querySelector('.configura__palco').dataset };
    });
    controlla(`${nome}: entrando si apre la finestra con i quattro passi, «Inizia» ha il fuoco, sta tutta nello schermo`, s.aperta && s.passi.length === 4 && /camicia che ti sta meglio/.test(s.passi[0]) && /metro/.test(s.passi[2]) && /Inizia/i.test(s.fuoco || '') && s.dentro && s.h1 === 1 && s.largo, JSON.stringify(s));
    await foto(page, `passi-${nome.replaceAll(' ', '-')}`);
    // sotto la finestra la camicia non saluta: il saluto parte quando la si chiude
    const prima = await page.evaluate(() => [...document.querySelectorAll('.configura__strati img')].map((x) => x.style.transform).join('|') + (document.querySelector('canvas.configura__onda') ? 'onda' : ''));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    const dopo = await page.evaluate(() => ({ aperta: document.getElementById('come-misurare').open, fermo: !document.documentElement.classList.contains('dialogo-aperto') }));
    controlla(`${nome}: «Inizia» chiude la finestra e la pagina torna a scorrere`, !dopo.aperta && dopo.fermo, JSON.stringify(dopo));
    // si riapre da «Come misurare», e Esc la richiude rimettendo il fuoco sul tasto
    await page.click('[data-apri-passi]');
    await page.waitForTimeout(300);
    const riaperta = await page.evaluate(() => document.getElementById('come-misurare').open);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const chiusa = await page.evaluate(() => ({ aperta: document.getElementById('come-misurare').open, fuoco: document.activeElement?.matches('[data-apri-passi]') }));
    controlla(`${nome}: «Come misurare» la riapre, Esc la chiude e il fuoco torna al tasto`, riaperta && !chiusa.aperta && chiusa.fuoco, JSON.stringify({ riaperta, ...chiusa }));
    controlla(`${nome}: nessun errore, nessun file mancante`, a.errori.length === 0 && a.rotte.length === 0, [...a.errori, ...a.rotte].join(' | ').slice(0, 300));
    void prima;
    await a.contesto.close();
  }
  {
    // il saluto della camicia aspetta la finestra (solo dove la camicia si muove: computer, tempo vero)
    const a = await nuovo(), { page } = a;
    await page.goto(PAGINA, { waitUntil: 'networkidle' });
    const mossa = () => page.evaluate(() => [...document.querySelectorAll('.configura__posa img')].some((x) => x.style.transform && x.style.transform !== 'none'));
    await page.waitForTimeout(2500);
    const sotto = await mossa();
    await page.click('#come-misurare button[value="inizia"]');
    let poi = false;
    for (let k = 0; k < 20 && !poi; k++) { await page.waitForTimeout(150); poi = await mossa(); }
    controlla('computer: la camicia saluta quando la finestra si chiude, non sotto la finestra', !sotto && poi, JSON.stringify({ sotto, poi }));
    await a.contesto.close();
  }

  // ---------------------------------------------------------------- 2. sul palco (computer): il campo fa lo zoom
  console.log('Entrando in un campo: zoom sulla camicia e tratteggio');
  // lo stato del palco e della linea, come lo vede chi guarda
  const stato = (page, m) => page.evaluate((m) => {
    const pal = document.querySelector('.configura__palco'), svg = document.querySelector('.configura__linee');
    const scheda = document.querySelector('.configura__scheda').getBoundingClientRect();
    const tratti = svg ? [...svg.querySelectorAll('.linea__tratto')] : [];
    const visibili = tratti.filter((t) => !t.classList.contains('linea__tratto--nascosto'));
    const box = visibili.map((t) => t.getBoundingClientRect()).filter((r) => r.width + r.height > 0);
    const unione = box.length ? { l: Math.min(...box.map((r) => r.left)), r: Math.max(...box.map((r) => r.right)), t: Math.min(...box.map((r) => r.top)), b: Math.max(...box.map((r) => r.bottom)) } : null;
    const k = svg ? svg.getBoundingClientRect().width / 1800 : 0;          // punti dello schermo per punto del fotogramma (zoom compreso)
    const spessore = visibili[0] ? Number(visibili[0].getAttribute('stroke-width')) * k : 0;
    const ferma = document.querySelector('.configura__ferma'), retro = document.querySelector('.configura__retro');
    const dove = [...document.querySelectorAll('.misura__dove')].filter((x) => { const r = x.getBoundingClientRect(); return getComputedStyle(x).display !== 'none' && r.width > 2 && r.height > 2; }).map((x) => x.closest('.misura').dataset.guida);
    return {
      aperta: pal.dataset.guidaAperta, zoom: pal.style.getPropertyValue('--zoom'),
      stessoZoom: !!svg && getComputedStyle(svg).transform === getComputedStyle(ferma).transform,
      tratti: tratti.length, lunghezza: Math.round(tratti.reduce((s, t) => s + t.getTotalLength(), 0)), spessore: Math.round(spessore * 100) / 100,
      inVista: !!unione && unione.l >= -1 && unione.t >= -1 && unione.b <= innerHeight + 1 && unione.r <= scheda.left + 2, unione: unione && Object.fromEntries(Object.entries(unione).map(([a, b]) => [a, Math.round(b)])),
      pezziNascosti: getComputedStyle(document.querySelector('.configura__posa') || document.body).visibility === 'hidden' || !document.querySelector('.configura__posa'),
      dietro: !!retro && !retro.hidden, dove, info: document.querySelectorAll('.misura__info').length,
    };
  }, m);
  for (const [nome, opzioni] of FORMATI.filter((f) => f[2] === 'palco')) {
    const a = await nuovo(opzioni), { page } = a;
    await page.goto(PAGINA + '?senza-passi', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => 'viva' in (document.querySelector('.configura__palco')?.dataset || {}), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
    const cc = await page.evaluate(() => ({ campi: [...document.querySelectorAll('.misura[data-guida]')].map((m) => m.dataset.guida), info: document.querySelectorAll('.misura__info, #guida-finestra').length }));
    controlla(`${nome}: dodici campi con la guida, nessuna «i» né finestra della guida`, cc.campi.length === 12 && cc.info === 0, JSON.stringify(cc));
    let prima = '';
    for (const misura of MISURE) {
      // una passata del mouse sulla camicia: deve smettere di rispondere appena si entra nel campo
      await page.mouse.move(500, 450); await page.mouse.move(560, 460, { steps: 4 });
      await page.click(`#campo-${misura}`);
      // dopo una misura di dietro la camicia prima torna indietro e si rigira: ci vuole di più
      await page.waitForTimeout(DIETRO.includes(misura) || DIETRO.includes(prima) ? 4500 : 2300);
      prima = misura;
      const s = await stato(page, misura);
      const vuoleDietro = DIETRO.includes(misura);
      controlla(`${nome}: campo ${misura}: zoom sulla camicia, tratteggio (2,25 punti) tutto in vista accanto al riquadro, nessuna frase sotto il campo${vuoleDietro ? ', camicia girata' : ''}`,
        s.aperta === misura && s.zoom && s.stessoZoom && s.pezziNascosti && s.dove.length === 0 && (!dati.guide || (s.tratti >= 1 && s.lunghezza > 40 && s.inVista && s.spessore > 1.9 && s.spessore < 2.7)) && (!dati.dietro || s.dietro === vuoleDietro), JSON.stringify(s));
      if (['torace', 'spalla', 'polso', 'lunghezza_manica'].includes(misura)) await foto(page, `palco-${nome.replaceAll(' ', '-')}-${misura}`);
    }
    // Tab: da una misura alla successiva, dello stesso lato, lo zoom scivola senza tornare indietro
    await page.click('#campo-torace');
    await page.waitForTimeout(2600);
    const zoomPrima = (await stato(page, 'torace')).zoom;
    await page.keyboard.press('Tab');
    const campioni = [];
    for (let k = 0; k < 12; k++) { await page.waitForTimeout(100); campioni.push(await page.evaluate(() => document.querySelector('.configura__palco').style.getPropertyValue('--zoom'))); }
    await page.waitForTimeout(1500);
    const dopoTab = await stato(page);
    controlla(`${nome}: con Tab da torace alla misura dopo lo zoom scivola sulla zona nuova, senza tornare indietro`, campioni.every(Boolean) && dopoTab.aperta && dopoTab.aperta !== 'torace' && dopoTab.zoom && dopoTab.zoom !== zoomPrima && dopoTab.tratti >= 1, JSON.stringify({ aperta: dopoTab.aperta, vuoti: campioni.filter((x) => !x).length }));
    // uscendo dalle misure: niente zoom, niente linea, di fronte; la camicia risponde di nuovo alla mano
    await page.click('#campo-nome');
    await page.waitForTimeout(3600);
    const fuori = await stato(page);
    controlla(`${nome}: uscendo dalle misure lo zoom torna indietro, la linea sparisce, la camicia è di fronte`, !fuori.aperta && !fuori.zoom && fuori.tratti === 0 && !fuori.dietro && !fuori.pezziNascosti && fuori.dove.length === 0, JSON.stringify(fuori));
    await page.mouse.move(420, 450); await page.mouse.move(600, 470, { steps: 8 });
    await page.waitForTimeout(400);
    const risponde = await page.evaluate(() => [...document.querySelectorAll('.configura__posa img')].some((x) => x.style.transform && x.style.transform !== 'none') || !!document.querySelector('canvas.configura__onda'));
    controlla(`${nome}: dopo la guida la camicia risponde di nuovo alla mano`, risponde);
    // Esc nel campo chiude la guida; un clic sul campo la riapre
    await page.click('#campo-pancia');
    await page.waitForTimeout(2300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);
    const esc = await stato(page);
    await page.click('#campo-pancia');
    await page.waitForTimeout(2300);
    const riaperta = await stato(page);
    controlla(`${nome}: Esc nel campo chiude lo zoom, un clic sul campo lo riapre`, !esc.aperta && !esc.zoom && riaperta.aperta === 'pancia' && !!riaperta.zoom, JSON.stringify({ esc: esc.aperta || '', zoom: esc.zoom, riaperta: riaperta.aperta }));
    // in fretta da un campo all'altro: resta l'ultimo, una linea sola, di fronte
    for (const m of ['spalla', 'torace', 'lunghezza_dietro', 'polso']) { await page.click(`#campo-${m}`); await page.waitForTimeout(120); }
    await page.waitForTimeout(6500);
    const fretta = await stato(page);
    const gruppi = await page.evaluate(() => document.querySelectorAll('.configura__linee .linea').length);
    controlla(`${nome}: quattro campi di fila in fretta: resta l'ultimo, una linea sola, di fronte, con lo zoom`, fretta.aperta === 'polso' && (!dati.guide || gruppi === 1) && !fretta.dietro && !!fretta.zoom, JSON.stringify({ ...fretta, gruppi }));
    controlla(`${nome}: nessun errore, nessun file mancante`, a.errori.length === 0 && a.rotte.length === 0, [...a.errori, ...a.rotte].join(' | ').slice(0, 300));
    await a.contesto.close();
  }

  // ---------------------------------------------------------------- 2b. le tre misure dello zoom e la rete lenta
  console.log('Tre misure dello zoom, rete lenta');
  {
    const scale = {};
    for (const v of ['a', 'b', 'c', '']) {
      const a = await nuovo(), { page } = a;
      await page.goto(PAGINA + `?senza-passi${v ? '&zoom=' + v : ''}`, { waitUntil: 'networkidle' });
      await page.click('#campo-polso');
      await page.waitForTimeout(2300);
      const z = await page.evaluate(() => document.querySelector('.configura__palco').style.getPropertyValue('--zoom'));
      scale[v || 'normale'] = Number((z.match(/scale\(([\d.]+)\)/) || [])[1] || 0);
      await a.contesto.close();
    }
    controlla('?zoom=a, b, c: tre ingrandimenti diversi, dal più leggero al più forte (polso); senza niente, il forte', scale.a > 1 && scale.a <= 1.6 && scale.b > scale.a && scale.c > scale.b && scale.normale === scale.c, JSON.stringify(scale));
  }
  {
    // il campo aperto prima che arrivino i pezzi della camicia: quando arrivano, la camicia non saluta né segue la mano
    const a = await nuovo(), { page } = a;
    await page.route(/\/camicia\/leggera\/.*\.webp/, async (r) => { await new Promise((f) => setTimeout(f, 3500)); await r.continue(); });
    await page.goto(PAGINA + '?senza-passi', { waitUntil: 'domcontentloaded' });
    await page.click('#campo-torace');
    await page.waitForFunction(() => 'viva' in (document.querySelector('.configura__palco')?.dataset || {}), null, { timeout: 20000 }).catch(() => {});
    const mossa = () => page.evaluate(() => [...document.querySelectorAll('.configura__strati img')].some((x) => x.style.transform && x.style.transform !== 'none'));
    let mai = true;
    for (let k = 0; k < 10; k++) { await page.waitForTimeout(150); if (await mossa()) mai = false; }
    await page.mouse.move(420, 450); await page.mouse.move(640, 470, { steps: 8 });
    for (let k = 0; k < 6; k++) { await page.waitForTimeout(120); if (await mossa()) mai = false; }
    controlla('computer, rete lenta: il campo aperto prima della camicia la tiene ferma anche quando arriva', mai);
    await a.contesto.close();
  }
  {
    // la camicia da dietro che non arriva: il campo dopo fa il suo zoom lo stesso, uscendo la camicia risponde
    const a = await nuovo(), { page } = a;
    await page.route(/\/camicia\/retro\/dietro.*\.webp/, async (r) => { await new Promise((f) => setTimeout(f, 15000)); await r.continue().catch(() => {}); });
    await page.goto(PAGINA + '?senza-passi', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => 'viva' in (document.querySelector('.configura__palco')?.dataset || {}), null, { timeout: 15000 }).catch(() => {});
    await page.click('#campo-spalla');
    await page.waitForTimeout(1500);
    await page.click('#campo-torace');
    await page.waitForTimeout(2500);
    const torace = await stato(page);
    controlla('computer, retro che non arriva: il campo del torace fa lo zoom e disegna la sua linea', torace.aperta === 'torace' && !!torace.zoom && torace.tratti >= 1, JSON.stringify(torace));
    await page.click('#campo-nome');
    await page.waitForTimeout(2500);
    await page.mouse.move(420, 450); await page.mouse.move(640, 470, { steps: 8 });
    await page.waitForTimeout(300);
    const risponde = await page.evaluate(() => [...document.querySelectorAll('.configura__posa img')].some((x) => x.style.transform && x.style.transform !== 'none') || !!document.querySelector('canvas.configura__onda'));
    controlla('computer, retro che non arriva: uscendo dalle misure la camicia risponde alla mano', risponde);
    await a.contesto.close();
  }

  {
    // da Spalla a una misura davanti mentre il retro si sta ancora scaricando: la camicia non deve girarsi dopo
    const a = await nuovo(), { page } = a;
    await page.route(/\/camicia\/retro\/dietro.*\.webp/, async (r) => { await new Promise((f) => setTimeout(f, 2000)); await r.continue().catch(() => {}); });
    await page.goto(PAGINA + '?senza-passi', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => 'viva' in (document.querySelector('.configura__palco')?.dataset || {}), null, { timeout: 15000 }).catch(() => {});
    await page.click('#campo-spalla');
    await page.waitForTimeout(700);
    await page.click('#campo-torace');
    await page.waitForTimeout(5000);
    const s = await stato(page);
    controlla('computer: da Spalla al Torace mentre il retro arriva: la camicia resta di fronte sotto la linea del torace', s.aperta === 'torace' && !s.dietro && s.tratti >= 1, JSON.stringify(s));
    // la frase che compare sotto il campo non sposta il modulo
    const y0 = await page.evaluate(() => document.getElementById('campo-bacino').getBoundingClientRect().top);
    await page.click('#campo-pancia');
    await page.waitForTimeout(400);
    const y1 = await page.evaluate(() => document.getElementById('campo-bacino').getBoundingClientRect().top);
    controlla('computer: entrando in un campo gli altri campi non si spostano', Math.abs(y1 - y0) < 1, JSON.stringify({ y0, y1 }));
    await a.contesto.close();
  }

  {
    // aperta col tablet in verticale e poi girato: lo zoom usa la camicia nitida lo stesso
    const a = await nuovo({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), { page } = a;
    await page.goto(PAGINA + '?senza-passi', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3500);
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.waitForTimeout(1500);
    await page.locator('#campo-polso').tap();
    await page.waitForTimeout(3500);
    const n = await page.evaluate(() => ({ palco: getComputedStyle(document.querySelector('.configura__palco')).position, nitida: [...document.querySelectorAll('.configura__nitida')].some((x) => !x.hidden), ritaglio: !!document.querySelector('.configura__nitida--ritaglio') }));
    controlla('tablet girato da verticale a orizzontale: lo zoom usa la camicia nitida', n.palco === 'sticky' && (!n.ritaglio || n.nitida), JSON.stringify(n));
    await a.contesto.close();
  }

  // ---------------------------------------------------------------- 3. sopra il campo (telefono, tablet)
  // toccare un campo: se il riquadro lo copre, come farebbe chi guarda, prima si tocca il riquadro (che si chiude)
  const tocca = async (page, sel) => {
    await page.locator(sel).scrollIntoViewIfNeeded();
    const coperto = await page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e?.closest('.misura-lente'); }, sel);
    if (coperto) { const b = await page.locator('.misura-lente').boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(150); }
    await page.locator(sel).tap();
  };
  console.log('Telefono e tablet: il riquadro con lo zoom sopra il campo');
  for (const [nome, opzioni] of FORMATI.filter((f) => f[2] === 'finestra')) {
    const a = await nuovo(opzioni), { page } = a;
    await page.goto(PAGINA + '?senza-passi', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    for (const misura of MISURE) {
      await tocca(page, `#campo-${misura}`);
      await page.waitForTimeout(1500);
      const s = await page.evaluate((m) => {
        const c = document.querySelector('.misura-lente'), campo = document.getElementById(`campo-${m}`).getBoundingClientRect();
        const r = c && !c.hidden ? c.getBoundingClientRect() : null;
        const t = document.querySelector('[data-testata]'), tr = t?.getBoundingClientRect();
        const sottoTestata = !!r && !(tr && t.dataset.stato !== 'via' && tr.bottom > 0 && r.top < tr.bottom - 1);
        const capi = c ? [...c.querySelectorAll('.linea__capo')].map((x) => x.getBoundingClientRect()) : [];
        const capiDentro = !!r && capi.every((q) => q.left >= r.left - 1 && q.right <= r.right + 1 && q.top >= r.top - 1 && q.bottom <= r.bottom + 1);
        const im = c?.querySelector('image');
        const dove = [...document.querySelectorAll('.misura__dove')].filter((x) => { const r = x.getBoundingClientRect(); return getComputedStyle(x).display !== 'none' && r.width > 2 && r.height > 2; }).map((x) => x.closest('.misura').dataset.guida);
        return {
          lente: !!r, sopra: !!r && r.bottom <= campo.top + 1, sottoTestata, capiDentro, inVista: !!r && r.top >= -1 && campo.bottom <= innerHeight + 1, largo: document.documentElement.scrollWidth <= innerWidth,
          tratti: c ? c.querySelectorAll('.linea__tratto').length : 0, retro: /dietro/.test(im?.getAttribute('href') || ''), dove, palco: document.querySelector('.configura__palco').style.getPropertyValue('--zoom'),
        };
      }, misura);
      controlla(`${nome}: campo ${misura}: sopra il campo il riquadro con lo zoom e il tratteggio, in vista con il campo; nessuna frase sotto`,
        s.lente && s.sopra && s.inVista && s.sottoTestata && s.capiDentro && s.largo && !s.palco && s.dove.length === 0 && (!dati.guide || (s.tratti >= 1 && (!dati.dietro || s.retro === DIETRO.includes(misura)))), JSON.stringify(s));
      if (['torace', 'spalla', 'polso'].includes(misura)) await foto(page, `lente-${nome.replaceAll(' ', '-')}-${misura}`);
    }
    // risalendo: dal polso al giro collo, e un campo appena sotto il bordo alto dello schermo
    for (const [da, a2] of [['polso', 'giro_collo'], ['lunghezza_davanti', 'torace']]) {
      await tocca(page, `#campo-${da}`);
      await page.waitForTimeout(900);
      if (da === 'lunghezza_davanti') await page.evaluate(() => { const b = document.getElementById('campo-torace'); scrollBy(0, b.getBoundingClientRect().top - 90); });
      await page.waitForTimeout(600);
      await tocca(page, `#campo-${a2}`);
      await page.waitForTimeout(1500);
      const su = await page.evaluate(() => {
        const c = document.querySelector('.misura-lente:not([hidden])')?.getBoundingClientRect();
        const t = document.querySelector('[data-testata]'), tr = t?.getBoundingClientRect();
        const limite = tr && t.dataset.stato !== 'via' && tr.bottom > 0 ? tr.bottom : 0;
        return { cima: c && Math.round(c.top), fondo: c && Math.round(c.bottom), limite: Math.round(limite), alto: innerHeight };
      });
      controlla(`${nome}: risalendo da ${da} a ${a2} il riquadro è tutto in vista, sotto la testata`, su.cima != null && su.cima >= su.limite - 1 && su.fondo <= su.alto + 1, JSON.stringify(su));
    }
    // un tocco sul riquadro lo chiude e lascia la scrittura nel campo aperto (non in un campo nascosto sotto)
    await tocca(page, '#campo-torace');
    await page.waitForTimeout(1300);
    const box = await page.locator('.misura-lente').boundingBox();
    if (box) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(400);
    const dopoTocco = await page.evaluate(() => ({ fuoco: document.activeElement?.id, lente: !!document.querySelector('.misura-lente:not([hidden])') }));
    controlla(`${nome}: un tocco sul riquadro lo chiude e lascia la scrittura nel campo aperto`, dopoTocco.fuoco === 'campo-torace' && !dopoTocco.lente, JSON.stringify(dopoTocco));
    await tocca(page, '#campo-nome');
    await page.waitForTimeout(700);
    const via = await page.evaluate(() => ({ lente: !!document.querySelector('.misura-lente:not([hidden])'), dove: [...document.querySelectorAll('.misura__dove')].filter((x) => { const r = x.getBoundingClientRect(); return getComputedStyle(x).display !== 'none' && r.width > 2 && r.height > 2; }).length }));
    controlla(`${nome}: uscendo dalle misure il riquadro sparisce`, !via.lente && via.dove === 0, JSON.stringify(via));
    controlla(`${nome}: nessun errore, nessun file mancante`, a.errori.length === 0 && a.rotte.length === 0, [...a.errori, ...a.rotte].join(' | ').slice(0, 300));
    await a.contesto.close();
  }

  // ---------------------------------------------------------------- 4. movimento ridotto e senza JavaScript
  console.log('Movimento ridotto e senza JavaScript');
  {
    const a = await nuovo({ reducedMotion: 'reduce' }), { page } = a;
    await page.goto(PAGINA, { waitUntil: 'networkidle' });
    const aperta = await page.evaluate(() => document.getElementById('come-misurare').open);
    await page.keyboard.press('Enter');
    await page.click('#campo-spalla');
    await page.waitForTimeout(900);
    const s = await page.evaluate(() => ({ video: !!document.querySelector('.configura__giro:not([hidden])'), retro: !(document.querySelector('.configura__retro')?.hidden !== false), si: !!document.querySelector('.linea--si-disegna'), tratti: document.querySelectorAll('.configura__linee .linea__tratto').length, transizione: getComputedStyle(document.querySelector('.configura__ferma')).transitionDuration, zoom: document.querySelector('.configura__palco').style.getPropertyValue('--zoom') }));
    controlla('movimento ridotto: la finestra si apre lo stesso; il retro compare senza giro, lo zoom senza scivolare, la linea senza disegnarsi', aperta && !s.video && (!dati.dietro || s.retro) && !s.si && (!dati.guide || (s.tratti >= 1 && !!s.zoom)) && parseFloat(s.transizione) < 0.01, JSON.stringify(s));
    controlla('movimento ridotto: nessun errore', a.errori.length === 0, a.errori.join(' | '));
    await a.contesto.close();
  }
  {
    const a = await nuovo({ javaScriptEnabled: false }), { page } = a;
    await page.goto(PAGINA, { waitUntil: 'load' });
    await page.focus('#campo-torace');
    const s = await page.evaluate(() => ({ come: document.querySelector('[data-apri-passi]').getBoundingClientRect().width, passi: [...document.querySelectorAll('.configura__senza-script li')].length, aperta: document.getElementById('come-misurare').open, dove: [...document.querySelectorAll('.misura__dove')].filter((x) => { const r = x.getBoundingClientRect(); return getComputedStyle(x).display !== 'none' && r.width > 2 && r.height > 2; }).map((x) => x.closest('.misura').dataset.guida) }));
    // la frase su dove si misura non si vede, ma il campo la porta con sé per i lettori di schermo
    const descritto = await page.evaluate(() => document.getElementById(document.getElementById('campo-torace').getAttribute('aria-describedby').split(' ')[0])?.textContent.trim().length || 0);
    controlla('senza JavaScript: niente «Come misurare»; i passi si leggono nel riquadro; la frase non si vede ma il campo la legge ai lettori di schermo', s.come === 0 && s.passi === 4 && !s.aperta && s.dove.length === 0 && descritto > 10, JSON.stringify({ ...s, descritto }));
    await foto(page, 'senza-script');
    await a.contesto.close();
  }

  await browser.close();
  console.log(`\n${passati} controlli passati, ${falliti.length} falliti`);
  if (falliti.length) { console.log(falliti.map((x) => ' - ' + x).join('\n')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
