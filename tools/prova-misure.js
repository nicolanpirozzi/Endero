// Controlla la guida alle misure del configuratore (src/configuratore/guida.js, proprietario 2026-11-21): la
// finestra dei passi che si apre a ogni visita, le «i» accanto ai campi, la camicia che si ferma, il tratteggio blu
// sulla camicia (public/camicia/guide.json), il giro sul retro per spalla e lunghezza dietro, la finestra sopra il
// modulo dove la camicia non resta in vista, il movimento ridotto e la pagina senza JavaScript.
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

  // ---------------------------------------------------------------- 2. le «i» sul palco (computer)
  console.log('Le «i» accanto alla camicia');
  for (const [nome, opzioni, modo] of FORMATI.filter((f) => f[2] === 'palco')) {
    const a = await nuovo(opzioni), { page } = a;
    await page.goto(PAGINA + '?senza-passi', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => 'viva' in (document.querySelector('.configura__palco')?.dataset || {}), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
    const ii = await page.evaluate(() => [...document.querySelectorAll('.misura__info')].map((b) => [b.dataset.guida, b.getAttribute('aria-label'), b.getAttribute('aria-expanded'), Math.round(b.getBoundingClientRect().width)]));
    controlla(`${nome}: dodici «i», una per misura, con il nome della misura per chi ascolta la pagina`, ii.length === 12 && ii.every(([n, et, esp, w]) => (n && /Dove si misura/.test(et) && esp === 'false' && w >= 18)), JSON.stringify(ii.slice(0, 2)));
    for (const misura of MISURE) {
      const b = `[data-guida="${misura}"]`;
      await page.locator(b).scrollIntoViewIfNeeded();
      // una passata del mouse sulla camicia: deve smettere di rispondere appena la guida si apre
      await page.mouse.move(500, 450); await page.mouse.move(560, 460, { steps: 4 });
      await page.click(b);
      await page.waitForTimeout(DIETRO.includes(misura) ? 2600 : 1500);
      const s = await page.evaluate((m) => {
        const svg = document.querySelector('.configura__linee'), pal = document.querySelector('.configura__palco');
        const tratti = svg ? [...svg.querySelectorAll('.linea__tratto')] : [];
        const r = svg?.getBoundingClientRect(), ferma = document.querySelector('.configura__ferma').getBoundingClientRect();
        const nota = document.querySelector('.configura__nota-guida:not([hidden])');
        const campo = document.querySelector(`[data-guida="${m}"]`).closest('.misura');
        const retro = document.querySelector('.configura__retro');
        return {
          esp: document.querySelector(`[data-guida="${m}"]`).getAttribute('aria-expanded'),
          tratti: tratti.length, lunghezza: Math.round(tratti.reduce((s, t) => s + t.getTotalLength(), 0)),
          allineato: !!r && Math.abs(r.left - ferma.left) < 1 && Math.abs(r.top - ferma.top) < 1 && Math.abs(r.width - ferma.width) < 1,
          nota: nota?.textContent.trim().slice(0, 40), notaSotto: !!nota && nota.getBoundingClientRect().top > campo.getBoundingClientRect().top,
          dietro: !!retro && !retro.hidden, ferma: [...document.querySelectorAll('.configura__strati img')].every((x) => !x.style.transform || x.style.transform === 'none'),
          aperta: pal.dataset.guidaAperta,
        };
      }, misura);
      const vuoleDietro = DIETRO.includes(misura);
      controlla(`${nome}: «i» di ${misura}: linea tratteggiata sulla camicia, nota sotto il campo, camicia ferma${vuoleDietro ? ', girata sul retro' : ''}`,
        s.esp === 'true' && s.aperta === misura && s.nota && s.notaSotto && s.ferma && (!dati.guide || (s.tratti >= 1 && s.lunghezza > 40 && s.allineato)) && (!dati.dietro || s.dietro === vuoleDietro), JSON.stringify(s));
      if (['torace', 'spalla', 'lunghezza_manica'].includes(misura)) await foto(page, `palco-${nome.replaceAll(' ', '-')}-${misura}`);
    }
    // chiudendo: torna di fronte, la camicia risponde di nuovo alla mano
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2200);
    const chiusa = await page.evaluate(() => ({ linee: document.querySelector('.configura__linee')?.childElementCount || 0, nota: document.querySelector('.configura__nota-guida')?.hidden !== false, retro: document.querySelector('.configura__retro')?.hidden !== false, giro: document.querySelector('.configura__giro')?.hidden !== false, aperte: document.querySelectorAll('.misura__info[aria-expanded="true"]').length }));
    controlla(`${nome}: Esc chiude la guida: niente linea né nota, la camicia torna di fronte`, chiusa.linee === 0 && chiusa.nota && chiusa.retro && chiusa.giro && chiusa.aperte === 0, JSON.stringify(chiusa));
    await page.mouse.move(420, 450); await page.mouse.move(600, 470, { steps: 8 });
    await page.waitForTimeout(400);
    const risponde = await page.evaluate(() => [...document.querySelectorAll('.configura__posa img')].some((x) => x.style.transform && x.style.transform !== 'none') || !!document.querySelector('canvas.configura__onda'));
    controlla(`${nome}: dopo la guida la camicia risponde di nuovo alla mano`, risponde);
    // la stessa «i» due volte apre e chiude
    await page.click('[data-guida="pancia"]'); await page.waitForTimeout(400);
    await page.click('[data-guida="pancia"]'); await page.waitForTimeout(400);
    controlla(`${nome}: toccando di nuovo la stessa «i» la guida si chiude`, await page.evaluate(() => !document.querySelector('.configura__palco').dataset.guidaAperta));
    // cambiare in fretta da una misura all'altra non lascia linee di troppo né il retro sbagliato
    for (const m of ['spalla', 'torace', 'lunghezza_dietro', 'polso']) { await page.click(`[data-guida="${m}"]`); await page.waitForTimeout(120); }
    await page.waitForTimeout(3200);
    const fretta = await page.evaluate(() => ({ aperta: document.querySelector('.configura__palco').dataset.guidaAperta, gruppi: document.querySelectorAll('.configura__linee .linea').length, dietro: !(document.querySelector('.configura__retro')?.hidden !== false), espanse: [...document.querySelectorAll('.misura__info[aria-expanded="true"]')].map((b) => b.dataset.guida) }));
    controlla(`${nome}: quattro «i» di fila in fretta: resta l'ultima, una linea sola, di fronte`, fretta.aperta === 'polso' && (!dati.guide || fretta.gruppi === 1) && !fretta.dietro && fretta.espanse.join() === 'polso', JSON.stringify(fretta));
    controlla(`${nome}: nessun errore, nessun file mancante`, a.errori.length === 0 && a.rotte.length === 0, [...a.errori, ...a.rotte].join(' | ').slice(0, 300));
    void modo;
    await a.contesto.close();
  }


  // ---------------------------------------------------------------- 2b. i casi trovati dalla revisione del 21 novembre
  console.log('Rete lenta, nota in fondo allo schermo');
  {
    // la «i» aperta prima che arrivino i pezzi della camicia: quando arrivano, la camicia non saluta né segue la mano
    const a = await nuovo(), { page } = a;
    await page.route(/\/camicia\/leggera\/.*\.webp/, async (r) => { await new Promise((f) => setTimeout(f, 3500)); await r.continue(); });
    await page.goto(PAGINA + '?senza-passi', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-guida="torace"]').scrollIntoViewIfNeeded();
    await page.click('[data-guida="torace"]');
    await page.waitForFunction(() => 'viva' in (document.querySelector('.configura__palco')?.dataset || {}), null, { timeout: 20000 }).catch(() => {});
    const mossa = () => page.evaluate(() => [...document.querySelectorAll('.configura__strati img')].some((x) => x.style.transform && x.style.transform !== 'none') || !!document.querySelector('canvas.configura__onda:not([hidden])[style*="opacity: 1"]'));
    let mai = true;
    for (let k = 0; k < 10; k++) { await page.waitForTimeout(150); if (await mossa()) mai = false; }
    await page.mouse.move(420, 450); await page.mouse.move(640, 470, { steps: 8 });
    for (let k = 0; k < 6; k++) { await page.waitForTimeout(120); if (await mossa()) mai = false; }
    controlla('computer, rete lenta: la «i» aperta prima della camicia la tiene ferma anche quando arriva (niente saluto, niente mano)', mai);
    await a.contesto.close();
  }
  {
    // la camicia da dietro che non arriva: le altre «i» disegnano lo stesso, chiudendo la camicia risponde
    const a = await nuovo(), { page } = a;
    await page.route(/\/camicia\/retro\/dietro.*\.webp/, async (r) => { await new Promise((f) => setTimeout(f, 15000)); await r.continue().catch(() => {}); });
    await page.goto(PAGINA + '?senza-passi', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => 'viva' in (document.querySelector('.configura__palco')?.dataset || {}), null, { timeout: 15000 }).catch(() => {});
    await page.locator('[data-guida="spalla"]').scrollIntoViewIfNeeded();
    await page.click('[data-guida="spalla"]');
    await page.waitForTimeout(1500);
    await page.click('[data-guida="torace"]');
    await page.waitForTimeout(1800);
    const torace = await page.evaluate(() => ({ aperta: document.querySelector('.configura__palco').dataset.guidaAperta, tratti: document.querySelectorAll('.configura__linee .linea__tratto').length }));
    controlla('computer, retro che non arriva: la «i» del torace disegna subito la sua linea', torace.aperta === 'torace' && torace.tratti >= 1, JSON.stringify(torace));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.mouse.move(420, 450); await page.mouse.move(640, 470, { steps: 8 });
    await page.waitForTimeout(300);
    const risponde = await page.evaluate(() => [...document.querySelectorAll('.configura__posa img')].some((x) => x.style.transform && x.style.transform !== 'none') || !!document.querySelector('canvas.configura__onda'));
    controlla('computer, retro che non arriva: chiusa la guida la camicia risponde alla mano', risponde);
    await a.contesto.close();
  }
  for (const [nome, opzioni] of FORMATI.filter((f) => f[2] === 'palco')) {
    // una «i» in fondo allo schermo: la nota sale in vista, la «i» resta visibile
    const a = await nuovo(opzioni), { page } = a;
    await page.goto(PAGINA + '?senza-passi', { waitUntil: 'networkidle' });
    for (const misura of ['pancia', 'polso']) {
      await page.evaluate((m) => { const b = document.querySelector(`[data-guida="${m}"]`); scrollBy(0, b.getBoundingClientRect().bottom - innerHeight + 40); }, misura);
      await page.waitForTimeout(500);
      await page.click(`[data-guida="${misura}"]`);
      await page.waitForTimeout(1400);
      const v = await page.evaluate((m) => { const n = document.querySelector('.configura__nota-guida:not([hidden])'), b = document.querySelector(`[data-guida="${m}"]`).getBoundingClientRect(); return { nota: n ? Math.round(n.getBoundingClientRect().bottom) : null, i: Math.round(b.top), alto: innerHeight }; }, misura);
      controlla(`${nome}: «i» di ${misura} in fondo allo schermo: la nota sale in vista e la «i» resta visibile`, v.nota != null && v.nota <= v.alto + 1 && v.i > 0, JSON.stringify(v));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }
    await a.contesto.close();
  }

  for (const [nome, opzioni] of FORMATI.filter((f) => f[2] === 'palco')) {
    // in cima alla pagina, una nota aperta più su: la «i» cliccata più giù non salta sotto il puntatore (il posto della
    // nota vecchia si chiude piano); e cliccando mentre la rotella sta finendo la sua corsa la nota arriva lo stesso in vista
    const a = await nuovo(opzioni), { page } = a;
    await page.goto(PAGINA + '?senza-passi', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.click('[data-guida="giro_collo"]');
    await page.waitForTimeout(1200);
    const sotto = await page.evaluate(() => { const b = [...document.querySelectorAll('.misura__info')].find((x) => { const r = x.getBoundingClientRect(); return r.top > innerHeight * 0.45 && r.bottom < innerHeight - 10; }); return b?.dataset.guida; });
    if (sotto) {
      const primaY = await page.evaluate((m) => document.querySelector(`[data-guida="${m}"]`).getBoundingClientRect().top, sotto);
      await page.click(`[data-guida="${sotto}"]`);
      const dopoY = await page.evaluate((m) => new Promise((f) => requestAnimationFrame(() => f(document.querySelector(`[data-guida="${m}"]`).getBoundingClientRect().top))), sotto);
      controlla(`${nome}: in cima alla pagina, da giro collo a ${sotto}: la «i» non salta sotto il puntatore`, Math.abs(dopoY - primaY) <= 4, JSON.stringify({ primaY: Math.round(primaY), dopoY: Math.round(dopoY) }));
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
    await page.evaluate(() => { const b = document.querySelector('[data-guida="polso"]'); scrollBy(0, b.getBoundingClientRect().bottom - innerHeight + 120); });
    await page.waitForTimeout(1200);
    await page.mouse.move(opzioni.viewport.width - 250, opzioni.viewport.height / 2);
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(300);
    await page.click('[data-guida="polso"]');
    await page.waitForTimeout(1800);
    const v = await page.evaluate(() => { const n = document.querySelector('.configura__nota-guida:not([hidden])'); return { nota: n ? Math.round(n.getBoundingClientRect().bottom) : null, alto: innerHeight, testata: document.querySelector('[data-stato]')?.dataset.stato || '' }; });
    controlla(`${nome}: clic sulla «i» mentre la rotella finisce la corsa: la nota arriva in vista, la testata non torna`, v.nota != null && v.nota <= v.alto + 1 && v.testata !== 'barra', JSON.stringify(v));
    await a.contesto.close();
  }

  // ---------------------------------------------------------------- 3. le «i» nella finestra (telefono, tablet)
  console.log('Le «i» nella finestra sopra il modulo');
  for (const [nome, opzioni] of FORMATI.filter((f) => f[2] === 'finestra')) {
    const a = await nuovo(opzioni), { page } = a;
    await page.goto(PAGINA + '?senza-passi', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    for (const misura of MISURE) {
      const b = page.locator(`[data-guida="${misura}"]`);
      await b.scrollIntoViewIfNeeded();
      const prima = await page.evaluate(() => scrollY);
      await b.tap();
      await page.waitForTimeout(900);
      const s = await page.evaluate((m) => {
        const d = document.getElementById('guida-finestra'), r = d.querySelector('.finestra__corpo').getBoundingClientRect();
        const svg = d.querySelector('.guida-finestra__camicia'), im = svg?.querySelector('image');
        const tratti = svg ? [...svg.querySelectorAll('.linea__tratto')] : [];
        return {
          aperta: d.open, titolo: d.querySelector('.finestra__titolo').textContent, frase: d.querySelector('[data-guida-frase]').textContent.slice(0, 30),
          dentro: r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1,
          scorre: (() => { const c = d.querySelector('.finestra__corpo'); return c.scrollHeight > c.clientHeight + 1; })(),
          immagine: im?.getAttribute('href') || '', tratti: tratti.length, retro: /dietro/.test(im?.getAttribute('href') || ''),
          largo: document.documentElement.scrollWidth <= innerWidth,
        };
      }, misura);
      controlla(`${nome}: «i» di ${misura}: finestra con il nome, la frase${dati.guide ? ', la camicia e la linea' : ''}, tutta nello schermo, senza scorrere dentro`,
        s.aperta && s.titolo.length > 2 && s.frase.length > 10 && s.dentro && !s.scorre && s.largo && (!dati.guide || (s.tratti >= 1 && (!dati.dietro || s.retro === DIETRO.includes(misura)))), JSON.stringify(s));
      if (['torace', 'spalla'].includes(misura)) await foto(page, `finestra-${nome.replaceAll(' ', '-')}-${misura}`);
      await page.locator('#guida-finestra .finestra__chiudi').tap();
      await page.waitForTimeout(400);
      const dopo = await page.evaluate((m) => ({ aperta: document.getElementById('guida-finestra').open, fuoco: document.activeElement?.dataset?.guida === m, y: scrollY, esp: document.querySelector(`[data-guida="${m}"]`).getAttribute('aria-expanded') }), misura);
      controlla(`${nome}: chiudendo la finestra si torna al campo, la pagina non si è spostata`, !dopo.aperta && dopo.fuoco && Math.abs(dopo.y - prima) < 4 && dopo.esp === 'false', JSON.stringify({ ...dopo, prima }));
    }
    controlla(`${nome}: nessun errore, nessun file mancante`, a.errori.length === 0 && a.rotte.length === 0, [...a.errori, ...a.rotte].join(' | ').slice(0, 300));
    await a.contesto.close();
  }

  // ---------------------------------------------------------------- 4. movimento ridotto, niente JavaScript
  console.log('Movimento ridotto e senza JavaScript');
  {
    const a = await nuovo({ reducedMotion: 'reduce' }), { page } = a;
    await page.goto(PAGINA, { waitUntil: 'networkidle' });
    const aperta = await page.evaluate(() => document.getElementById('come-misurare').open);
    await page.keyboard.press('Enter');
    await page.click('[data-guida="spalla"]');
    await page.waitForTimeout(900);
    const s = await page.evaluate(() => ({ video: !!document.querySelector('.configura__giro:not([hidden])'), retro: !(document.querySelector('.configura__retro')?.hidden !== false), si: !!document.querySelector('.linea--si-disegna'), tratti: document.querySelectorAll('.configura__linee .linea__tratto').length }));
    controlla('movimento ridotto: la finestra si apre lo stesso; il retro compare senza giro e la linea senza disegnarsi', aperta && !s.video && (!dati.dietro || s.retro) && !s.si && (!dati.guide || s.tratti >= 1), JSON.stringify(s));
    controlla('movimento ridotto: nessun errore', a.errori.length === 0, a.errori.join(' | '));
    await a.contesto.close();
  }
  {
    const a = await nuovo({ javaScriptEnabled: false }), { page } = a;
    await page.goto(PAGINA, { waitUntil: 'load' });
    const s = await page.evaluate(() => ({ info: [...document.querySelectorAll('.misura__info')].filter((b) => b.getBoundingClientRect().width > 0).length, come: document.querySelector('[data-apri-passi]').getBoundingClientRect().width, passi: [...document.querySelectorAll('.configura__senza-script li')].length, frasi: document.querySelectorAll('.configura__senza-script dd').length, aperta: document.getElementById('come-misurare').open }));
    controlla('senza JavaScript: niente «i» né «Come misurare»; i passi e le frasi si leggono nel riquadro', s.info === 0 && s.come === 0 && s.passi === 4 && s.frasi === 12 && !s.aperta, JSON.stringify(s));
    await foto(page, 'senza-script');
    await a.contesto.close();
  }

  await browser.close();
  console.log(`\n${passati} controlli passati, ${falliti.length} falliti`);
  if (falliti.length) { console.log(falliti.map((x) => ' - ' + x).join('\n')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
