// Controlla le parti della pagina iniziale e delle pagine interne cambiate il 19 novembre 2026:
// il video sotto il titolo (il reel sui telefoni, i due modelli a tavola sugli schermi larghi, senza audio),
// "Chi siamo" al posto di "Artigianato" (voci, titoli, indirizzo, vecchi indirizzi che rimandano),
// la sezione del su misura con la camicia del configuratore e le sue misure, le due strade dei rivenditori
// (Rivenditore Endero e Conto terzi) in pagina iniziale e nella loro pagina, con la voce già segnata nel modulo.
// Dal 20 novembre anche: chi legge la pagina senza scorrerla (Google) trova tutto il testo, gli schermi tra 810 e
// 1024 punti, le domande sotto il configuratore.
//
//   node tools/prova-pagine.js [indirizzo del sito, senza barra finale] [cartella per le schermate]
//
// In locale: npm run anteprima (porta 8766). Sull'anteprima: l'indirizzo di Cloudflare.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const base = (process.argv[2] || 'http://127.0.0.1:8766').replace(/\/$/, '');
const schermate = process.argv[3] || '';
let passati = 0;
const falliti = [];
function controlla(nome, vero, dettaglio = '') {
  if (vero) passati++; else falliti.push(nome + (dettaglio ? ` (${dettaglio})` : ''));
  console.log(`${vero ? '  ok ' : '  NO '} ${nome}${!vero && dettaglio ? ' → ' + dettaglio : ''}`);
}
const foto = async (page, nome) => { if (schermate) { fs.mkdirSync(schermate, { recursive: true }); await page.screenshot({ path: path.join(schermate, nome + '.png') }); } };
const TELEFONO = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

(async () => {
  const browser = await chromium.launch();
  const nuovo = async (opzioni = {}) => {
    const contesto = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opzioni });
    const page = await contesto.newPage();
    const errori = [], rotte = [];
    page.on('console', (m) => { if (m.type() === 'error') errori.push(m.text()); });
    page.on('pageerror', (e) => errori.push(String(e)));
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/api/')) rotte.push(`${r.status()} ${r.url().split('/').slice(3).join('/')}`); });
    const stretta = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    // porta in vista una sezione passando piano, come chi scorre: le foto pigre si caricano e le comparse partono
    const vai = async (sel, scarto = -80) => {
      const y = await page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY : -1; }, sel);
      if (y < 0) return false;
      for (let k = 0; k < 4; k++) { await page.evaluate((v) => window.scrollTo(0, v), y + scarto + k * 4); await page.waitForTimeout(300); }
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(700);
      return true;
    };
    return { contesto, page, errori, rotte, stretta, vai };
  };
  const video = (page) => page.evaluate(() => {
    const v = document.querySelector('[data-video-eroe] video');
    return v ? { file: v.currentSrc.split('/').pop().split('?')[0], muto: v.muted, tondo: v.loop, inPagina: v.playsInline, fermo: v.paused, t: v.currentTime, audio: v.webkitAudioDecodedByteCount || 0, visto: v.hasAttribute('data-parte'), misure: [v.videoWidth, v.videoHeight], nascosto: v.getAttribute('aria-hidden') } : null;
  });
  const sottoAlVideo = async (a) => {
    // il video sta sotto l'apertura: si scorre fin dove il telo si è sollevato del tutto
    const y = await a.page.evaluate(() => { const x = document.querySelector('.apertura'); return x ? x.getBoundingClientRect().bottom + scrollY - 6 : 0; });
    for (let k = 0; k < 4; k++) { await a.page.evaluate((v) => window.scrollTo(0, v), y + k * 2); await a.page.waitForTimeout(350); }
    await a.page.waitForFunction(() => { const v = document.querySelector('[data-video-eroe] video'); return v && !v.paused && v.currentTime > 0.4; }, null, { timeout: 15000 }).catch(() => {});
  };

  // ---------------------------------------------------------------- 0. l'invito a scorrere nell'apertura
  // c'è in cima, sparisce mentre si scorre, torna dopo un secondo e mezzo fermi finché la cucitura non è finita
  // (proprietario, 2026-11-24)
  console.log('L\'invito a scorrere');
  for (const [nome, opzioni] of [['computer', {}], ['telefono', TELEFONO]]) {
    const a = await nuovo(opzioni), { page } = a;
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const invito = () => page.evaluate(() => Number(getComputedStyle(document.querySelector('.apertura__invito')).opacity));
    const inCima = await invito();
    const fermo = async () => { let y = -1; for (let k = 0; k < 40; k++) { const n = await page.evaluate(() => scrollY); if (Math.abs(n - y) < 1) break; y = n; await page.waitForTimeout(150); } };
    await page.evaluate(() => window.scrollTo(0, innerHeight * 2.2));
    await page.waitForTimeout(200);
    await fermo();
    const subito = await invito();
    await page.waitForTimeout(2900);                  // 1,5 s fermi, poi compare piano
    const dopo = await invito();
    await page.evaluate(() => window.scrollTo(0, innerHeight * 2.8));
    await page.waitForTimeout(250);
    const riprende = await invito();
    controlla(`${nome}: l'invito c'è in cima, sparisce scorrendo, torna dopo 1,5 s fermi e risparisce quando si riprende`, inCima > 0.9 && subito < 0.2 && dopo > 0.8 && riprende < 0.5, JSON.stringify({ inCima, subito, dopo, riprende }));
    await a.contesto.close();
  }

  // ---------------------------------------------------------------- 1. il video sotto il titolo
  console.log('Il video dell\'apertura');
  for (const [nome, opzioni, atteso, forma] of [['computer', {}, 'eroe-computer.mp4', [1080, 1440]], ['tablet', { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'eroe-computer.mp4', [1080, 1440]], ['telefono', TELEFONO, 'eroe-telefono.mp4', [720, 1280]]]) {
    const a = await nuovo(opzioni), { page } = a;
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    const ferma = await page.evaluate(() => { const i = document.querySelector('[data-video-eroe] img'); return { ce: Boolean(i), alt: i?.alt || '', file: (i?.currentSrc || '').split('/').pop().split('?')[0], subito: Boolean(document.querySelector('[data-video-eroe] video')) }; });
    controlla(`${nome}: in pagina c'è l'immagine ferma, con la sua descrizione`, ferma.ce && ferma.alt.length > 8 && ferma.file.startsWith(atteso.replace('.mp4', '.')), JSON.stringify(ferma));
    controlla(`${nome}: in cima alla pagina il video non si scarica ancora`, !ferma.subito);
    await sottoAlVideo(a);
    let v = await video(page);
    controlla(`${nome}: scoperto dal telo, parte il video giusto per lo schermo`, v && v.file === atteso && !v.fermo && v.t > 0.4 && v.visto && v.misure.join() === forma.join(), JSON.stringify(v));
    controlla(`${nome}: senza audio, in tondo, dentro la pagina, e non letto dai lettori di schermo`, v && v.muto && v.tondo && v.inPagina && v.audio === 0 && v.nascosto === 'true', JSON.stringify(v));
    const titolo = await page.evaluate(() => { const h = document.querySelector('.eroe__titolo'), r = h.getBoundingClientRect(), velo = getComputedStyle(document.querySelector('.eroe__fondo'), '::after').backgroundImage; return { visibile: r.top > 60 && r.bottom < innerHeight && r.width > 100, velo: velo.includes('gradient') }; });
    controlla(`${nome}: il titolo sta sopra il video, con il velo dietro`, titolo.visibile && titolo.velo, JSON.stringify(titolo));
    await foto(page, `video-${nome}`);
    // il tasto che lo ferma e lo fa ripartire
    const tasto = page.locator('[data-video-ferma]');
    const prima = await tasto.evaluate((x) => ({ visibile: !x.hidden && x.getBoundingClientRect().width >= 44, nome: x.getAttribute('aria-label'), premuto: x.getAttribute('aria-pressed') }));
    await tasto.click(); await page.waitForTimeout(400);
    const fermato = { ...(await video(page)), nome: await tasto.getAttribute('aria-label'), premuto: await tasto.getAttribute('aria-pressed') };
    await tasto.click(); await page.waitForTimeout(700);
    const ripartito = await video(page);
    controlla(`${nome}: c'è un tasto per fermare il video e farlo ripartire`, prima.visibile && /ferma/i.test(prima.nome) && prima.premuto === 'false' && fermato.fermo && fermato.premuto === 'true' && /ripartire/i.test(fermato.nome) && !ripartito.fermo, JSON.stringify([prima, fermato.fermo, fermato.nome, ripartito.fermo]));
    // più giù nella pagina il video si ferma; tornando su riparte
    await page.evaluate(() => window.scrollTo(0, document.querySelector('.eroe').getBoundingClientRect().bottom + scrollY + innerHeight));
    await page.waitForTimeout(700);
    v = await video(page);
    controlla(`${nome}: uscito dallo schermo il video si ferma`, v && v.fermo, JSON.stringify(v));
    await sottoAlVideo(a);
    v = await video(page);
    controlla(`${nome}: tornando su riparte`, v && !v.fermo, JSON.stringify(v));
    controlla(`${nome}: niente esce dallo schermo, nessun errore, nessun file mancante`, await a.stretta() && a.errori.length === 0 && a.rotte.length === 0, [...a.errori, ...a.rotte].join(' | ').slice(0, 300));
    await a.contesto.close();
  }
  {
    let a = await nuovo({ reducedMotion: 'reduce' });
    await a.page.goto(base + '/', { waitUntil: 'networkidle' });
    await a.page.evaluate(() => window.scrollTo(0, document.querySelector('.eroe').getBoundingClientRect().top + scrollY));
    await a.page.waitForTimeout(1500);
    const r = await a.page.evaluate(() => ({ video: Boolean(document.querySelector('[data-video-eroe] video')), foto: (() => { const i = document.querySelector('[data-video-eroe] img'); return i.complete && i.naturalWidth > 0; })() }));
    controlla('con il movimento ridotto nessun video: resta la foto', !r.video && r.foto, JSON.stringify(r));
    await a.contesto.close();
    a = await nuovo({ javaScriptEnabled: false });
    await a.page.goto(base + '/', { waitUntil: 'load' });
    const nj = await a.page.evaluate(() => ({ video: document.querySelectorAll('video').length, foto: Boolean(document.querySelector('[data-video-eroe] img')), titolo: document.querySelector('h1')?.textContent.replace(/\s+/g, ' ').trim() }));
    controlla('senza JavaScript: la foto e il titolo ci sono, il video no', nj.video === 0 && nj.foto && /camicie/i.test(nj.titolo || ''), JSON.stringify(nj));
    await a.contesto.close();
    a = await nuovo();
    await a.page.goto(base + '/?video=lento', { waitUntil: 'networkidle' });
    await sottoAlVideo(a);
    const v = await video(a.page);
    controlla('/?video=lento prova lo stesso video a metà velocità', v && v.file === 'eroe-computer-lento.mp4' && !v.fermo, JSON.stringify(v));
    await a.contesto.close();
  }
  {
    // il telefono girato: la foto ferma cambia da sola, il video deve cambiare con lei
    const a = await nuovo({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await a.page.goto(base + '/', { waitUntil: 'networkidle' });
    await sottoAlVideo(a);
    const largo = await video(a.page);
    await a.page.setViewportSize({ width: 390, height: 844 });
    await a.page.waitForFunction(() => { const v = document.querySelector('[data-video-eroe] video'); return v && /eroe-telefono/.test(v.currentSrc) && !v.paused && v.currentTime > 0.2; }, null, { timeout: 15000 }).catch(() => {});
    const stretto = await video(a.page);
    controlla('girando il telefono il video cambia insieme alla foto', largo && largo.file === 'eroe-computer.mp4' && stretto && stretto.file === 'eroe-telefono.mp4' && !stretto.fermo, JSON.stringify([largo && largo.file, stretto && stretto.file, stretto && stretto.fermo]));
    await a.contesto.close();
    // chi ricarica la pagina più giù non scarica il video finché non torna su
    const b = await nuovo();
    let scaricati = 0;
    b.page.on('request', (r) => { if (/\/video\/.*\.mp4/.test(r.url())) scaricati++; });
    await b.page.goto(base + '/#rivenditori', { waitUntil: 'networkidle' });
    await b.page.waitForTimeout(1500);
    const giu = await b.page.evaluate(() => ({ y: Math.round(scrollY), video: Boolean(document.querySelector('[data-video-eroe] video')) }));
    controlla('ricaricando la pagina più giù il video non si scarica', giu.y > 3000 && !giu.video && scaricati === 0, JSON.stringify({ ...giu, scaricati }));
    await sottoAlVideo(b);
    const su = await video(b.page);
    controlla('e tornando su parte', su && !su.fermo, JSON.stringify(su));
    await b.contesto.close();
  }
  for (const f of ['eroe-telefono.mp4', 'eroe-computer.mp4', 'eroe-computer-lento.mp4']) {
    const r = await fetch(`${base}/video/${f}`, { headers: { Range: 'bytes=0-99' } });
    const peso = Number((r.headers.get('content-range') || '').split('/')[1]) || Number(r.headers.get('content-length')) || (await r.arrayBuffer()).byteLength;
    controlla(`${f}: c'è, è un video e pesa meno di 3 MB`, r.status < 300 && (r.headers.get('content-type') || '').startsWith('video/') && (peso === 100 || peso < 3e6), `${r.status} ${r.headers.get('content-type')} ${peso}`);
  }

  for (const [nome, opzioni] of [['computer', {}], ['telefono', TELEFONO]]) {
    const a = await nuovo(opzioni);
    await a.page.goto(base + '/', { waitUntil: 'networkidle' });
    await sottoAlVideo(a);
    await a.page.locator('.eroe__azioni a[href="#collezione"]').click();
    await a.page.waitForTimeout(2200);
    const t = await a.page.evaluate(() => { const h = document.querySelector('#collezione h2').getBoundingClientRect(), sel = document.querySelector('.selettore').getBoundingClientRect(); return { titolo: Math.round(h.top), selettore: Math.round(sel.bottom) }; });
    controlla(`${nome}: «Vedi la collezione» porta al titolo della collezione, sotto il selettore e non dietro`, t.titolo >= t.selettore && t.titolo < 260, JSON.stringify(t));
    await a.contesto.close();
  }

  // ---------------------------------------------------------------- 2. Chi siamo
  console.log('Chi siamo');
  for (const [nome, opzioni] of [['computer', {}], ['telefono', TELEFONO]]) {
    const a = await nuovo(opzioni), { page } = a;
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    const h = await page.evaluate(() => {
      const voci = [...document.querySelectorAll('.selettore__voci a')].map((x) => [x.textContent.trim(), x.getAttribute('href')]);
      const s = document.getElementById('chi-siamo');
      return { voci, titolo: s?.querySelector('h2')?.textContent.replace(/\s+/g, ' ').trim(), occhiello: s?.querySelector('.occhiello')?.textContent.trim(), link: s?.querySelector('.mestiere__fondo a')?.getAttribute('href'), vecchi: [...document.querySelectorAll('a[href*="cultura-e-artigianato"], a[href*="/storia"]')].length, vecchiaSezione: Boolean(document.getElementById('artigianato')), menu: [...document.querySelectorAll('.menu a, .piede a')].map((x) => [x.textContent.trim(), x.getAttribute('href')]).filter(([, l]) => l === '/chi-siamo/') };
    });
    controlla(`${nome}: nel selettore c'è «Chi siamo», non più «Artigianato»`, h.voci.some(([t, l]) => /^chi siamo$/i.test(t) && l === '#chi-siamo') && !h.voci.some(([t]) => /artigianato/i.test(t)), JSON.stringify(h.voci));
    controlla(`${nome}: la sezione si chiama «Chi siamo», con «Cultura e artigianato» come riga piccola sopra`, /^chi siamo$/i.test(h.titolo || '') && /^cultura e artigianato$/i.test(h.occhiello || '') && h.link === '/chi-siamo/' && !h.vecchiaSezione, JSON.stringify(h));
    controlla(`${nome}: menu e piè di pagina portano a /chi-siamo/, nessun link ai vecchi indirizzi`, h.menu.length >= 1 && h.menu.every(([t]) => /^chi siamo$/i.test(t)) && h.vecchi === 0, JSON.stringify(h.menu));
    await page.click('.selettore__apri:visible').catch(() => {});
    await page.locator('.selettore__voci a[data-voce="chi-siamo"]').click();
    await page.waitForTimeout(1800);
    const su = await page.evaluate(() => Math.round(document.getElementById('chi-siamo').getBoundingClientRect().top));
    controlla(`${nome}: la voce «Chi siamo» porta alla sua sezione`, su > -40 && su < 260, String(su));
    await a.contesto.close();
  }
  {
    const a = await nuovo(), { page } = a;
    const risposta = await page.goto(base + '/chi-siamo/', { waitUntil: 'networkidle' });
    const c = await page.evaluate(() => ({ h1: [...document.querySelectorAll('h1')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()), occhiello: document.querySelector('.eroe .occhiello')?.textContent.trim(), titolo: document.title, canonico: document.querySelector('link[rel="canonical"]')?.href, capitoli: document.querySelectorAll('.capitolo').length, foto: [...document.querySelectorAll('.eroe img, .capitolo img')].filter((i) => !(i.complete && i.naturalWidth)).length }));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(500);
    controlla('/chi-siamo/: un solo titolo «Chi siamo», con la riga «Cultura e artigianato» sopra', risposta.status() === 200 && c.h1.length === 1 && /^chi siamo$/i.test(c.h1[0]) && /^cultura e artigianato$/i.test(c.occhiello || ''), JSON.stringify(c));
    controlla('/chi-siamo/: titolo per Google e indirizzo canonico nuovi, capitoli al loro posto', /^Chi siamo/.test(c.titolo) && /\/chi-siamo\/$/.test(c.canonico || '') && c.capitoli >= 5, JSON.stringify(c));
    controlla('/chi-siamo/: niente esce dallo schermo, nessun errore', await a.stretta() && a.errori.length === 0 && a.rotte.length === 0, [...a.errori, ...a.rotte].join(' | ').slice(0, 300));
    await a.contesto.close();
    for (const vecchio of ['/cultura-e-artigianato/', '/cultura-e-artigianato', '/storia/']) {
      const r = await fetch(base + vecchio, { redirect: 'manual' });
      controlla(`${vecchio} rimanda per sempre a /chi-siamo/`, r.status === 301 && new URL(r.headers.get('location'), base).pathname === '/chi-siamo/', `${r.status} ${r.headers.get('location')}`);
    }
    const mappa = await (await fetch(base + '/sitemap.xml')).text();
    controlla('nella mappa del sito c\'è /chi-siamo/ e non il vecchio indirizzo', mappa.includes('/chi-siamo/') && !mappa.includes('cultura-e-artigianato'));
  }

  // ---------------------------------------------------------------- 3. il su misura in pagina iniziale
  console.log('La camicia su misura, in pagina iniziale');
  const misureVere = await (async () => {
    const a = await nuovo();
    await a.page.goto(base + '/camicie-su-misura/configuratore/', { waitUntil: 'domcontentloaded' });
    const m = await a.page.evaluate(() => [...document.querySelectorAll('.configura__gruppo--misure .misura__nome')].map((x) => x.textContent.trim()));
    await a.contesto.close();
    return m;
  })();
  for (const [nome, opzioni, largo] of [['computer', {}, true], ['schermo stretto', { viewport: { width: 1024, height: 768 } }, true], ['telefono', TELEFONO, false]]) {
    const a = await nuovo(opzioni), { page } = a;
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await a.vai('#su-misura');
    await a.vai('#su-misura .scheda-misure', -200);
    const m = await page.evaluate(() => {
      const s = document.getElementById('su-misura'), i = s.querySelector('.grande__foto img'), scheda = s.querySelector('.scheda-misure'), q = s.querySelector('.grande').getBoundingClientRect(), r = scheda.getBoundingClientRect(), f = i.getBoundingClientRect();
      return {
        attese: s.querySelectorAll('.attesa').length, foto: i.complete && i.naturalWidth > 0, file: i.currentSrc.split('/').pop().split('?')[0], alt: i.alt,
        misure: [...scheda.querySelectorAll('dt')].map((x) => x.textContent.trim()), righe: [...scheda.querySelectorAll('dl div')].map((x) => Math.round(x.getBoundingClientRect().height)),
        pillola: scheda.querySelector('.pillola')?.getAttribute('href'), inSede: scheda.querySelector('.collegamento')?.getAttribute('href'),
        scheda: [(r.left - q.left) / q.width, (r.right - q.left) / q.width, r.top - f.bottom, r.bottom <= q.bottom + 1, r.top >= q.top - 1], opaca: getComputedStyle(scheda).opacity,
      };
    });
    controlla(`${nome}: niente «Foto in arrivo»: c'è la camicia del configuratore`, m.attese === 0 && m.foto && /^ferma/.test(m.file) && m.alt.length > 10, JSON.stringify({ attese: m.attese, file: m.file }));
    controlla(`${nome}: la scheda elenca le misure che il configuratore chiede davvero`, misureVere.length >= 10 && JSON.stringify(m.misure) === JSON.stringify(misureVere), `${m.misure.join(', ')} | ${misureVere.join(', ')}`);
    controlla(`${nome}: ogni misura sta su una riga sola`, m.righe.every((x) => x <= 40) && Math.max(...m.righe) - Math.min(...m.righe) <= 2, m.righe.join(' '));
    controlla(`${nome}: il tasto porta al configuratore, il link alla prenotazione in sede`, m.pillola === '/camicie-su-misura/configuratore/' && m.inSede === '/camicie-su-misura/#prenota', `${m.pillola} ${m.inSede}`);
    if (largo) controlla(`${nome}: la scheda sta sul lato in ombra, dentro la foto, senza coprire la camicia`, m.scheda[0] > 0.56 && m.scheda[1] < 0.995 && m.scheda[3] && m.scheda[4] && m.opaca === '1', JSON.stringify(m.scheda));
    else controlla(`${nome}: la scheda sta sotto la camicia`, m.scheda[2] > -40 && m.opaca === '1', JSON.stringify(m.scheda));
    await foto(page, `su-misura-${nome.replace(' ', '-')}`);
    controlla(`${nome}: niente esce dallo schermo`, await a.stretta());
    await a.contesto.close();
  }

  {
    const a = await nuovo({ viewport: { width: 1920, height: 950 } });
    await a.page.goto(base + '/', { waitUntil: 'networkidle' });
    await a.vai('#su-misura');
    const q = await a.page.evaluate(() => { const g = document.querySelector('#su-misura .grande').getBoundingClientRect(), s = document.querySelector('#su-misura .scheda-misure').getBoundingClientRect(); return { alta: Math.round(g.height), larga: Math.round(g.width), centro: Math.round(g.left + g.width / 2), scheda: s.top >= g.top && s.bottom <= g.bottom }; });
    controlla('schermo molto largo: la camicia non diventa più alta dello schermo e resta al centro', q.alta <= 900 && q.larga <= 1600 && Math.abs(q.centro - 960) < 2 && q.scheda && await a.stretta(), JSON.stringify(q));
    await a.contesto.close();
  }

  // ---------------------------------------------------------------- 4. i rivenditori
  console.log('I rivenditori');
  const DUE = [['Rivenditore Endero', 'rivenditore-endero'], ['Conto terzi', 'conto-terzi']];
  for (const [nome, opzioni] of [['computer', {}], ['tablet in piedi', { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['telefono', TELEFONO], ['telefono stretto', { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const a = await nuovo(opzioni), { page } = a;
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await a.vai('#rivenditori');
    await a.vai('#rivenditori .strade__voci', -160);
    const r = await page.evaluate(() => {
      const s = document.getElementById('rivenditori'), q = s.getBoundingClientRect();
      const schede = [...s.querySelectorAll('.strada')].map((x) => { const b = x.getBoundingClientRect(), i = x.querySelector('img'), t = x.querySelector('.strada__testo').getBoundingClientRect(); const n = x.querySelector('.strada__nome'), spazio = document.createRange(); spazio.selectNodeContents(n); const scritta = spazio.getBoundingClientRect(); return { nome: n.textContent.trim(), riga: x.querySelector('.strada__riga').textContent.trim(), href: x.getAttribute('href'), foto: i.complete && i.naturalWidth > 0, alt: i.alt, largo: Math.round(b.width), alto: Math.round(b.height), dentro: t.top >= b.top && t.bottom <= b.bottom + 1 && t.right <= b.right + 1 && scritta.right <= b.right - 12 && scritta.left >= b.left + 12, numero: (() => { const q = x.querySelector('.strada__numero').getBoundingClientRect(); return q.top > b.top + b.height * 0.33; })() }; });
      return { alta: Math.round(q.height), titolo: s.querySelector('h2')?.textContent.replace(/\s+/g, ' ').trim(), tasto: s.querySelector('.strade__testo .pillola')?.getAttribute('href'), schede, testo: s.textContent.toLowerCase() };
    });
    controlla(`${nome}: la sezione dei rivenditori è grande (era una fascia di 210 px)`, r.alta >= 500 && /negozio/i.test(r.titolo || ''), `${r.alta} px`);
    controlla(`${nome}: due scelte, Rivenditore Endero e Conto terzi, ognuna porta alla sua parte della pagina`, r.schede.length === 2 && r.schede.every((s, i) => s.nome === DUE[i][0] && s.href === `/diventa-rivenditore/#${DUE[i][1]}` && s.riga.length > 15), JSON.stringify(r.schede.map((s) => [s.nome, s.href])));
    controlla(`${nome}: le schede hanno la foto, grande, e il testo ci sta dentro, con il numero in basso dove si legge`, r.schede.every((s) => s.foto && s.alt.length > 10 && s.dentro && s.numero && s.largo >= 250 && s.alto >= 200), JSON.stringify(r.schede.map((s) => [s.largo, s.alto, s.dentro, s.numero, s.foto])));
    controlla(`${nome}: il tasto porta alla pagina dei rivenditori, e «white label» non compare`, r.tasto === '/diventa-rivenditore/' && !r.testo.includes('white label'), r.tasto);
    await foto(page, `rivenditori-home-${nome.replace(' ', '-')}`);
    controlla(`${nome}: niente esce dallo schermo, nessun errore`, await a.stretta() && a.errori.length === 0, a.errori.join(' | ').slice(0, 200));
    await a.contesto.close();
  }
  for (const [nome, opzioni] of [['computer', {}], ['schermo largo', { viewport: { width: 1920, height: 950 } }], ['telefono', TELEFONO]]) {
    const a = await nuovo(opzioni), { page } = a;
    await page.goto(base + '/diventa-rivenditore/', { waitUntil: 'networkidle' });
    const p = await page.evaluate(() => ({
      schede: [...document.querySelectorAll('#offerta .strada')].map((x) => [x.querySelector('.strada__nome').textContent.trim(), x.getAttribute('href')]),
      capitoli: [...document.querySelectorAll('.capitolo')].map((x) => [x.id, x.querySelector('.capitolo__etichetta').textContent.trim(), x.querySelector('a[href="#richiesta"]')?.dataset.interesse || '']),
      voci: [...document.querySelectorAll('input[name="interesse"]')].map((x) => x.value),
      h1: document.querySelectorAll('h1').length, testo: document.body.textContent.toLowerCase(),
    }));
    controlla(`${nome}: la pagina si apre con le due scelte, che portano ai loro capitoli`, JSON.stringify(p.schede) === JSON.stringify(DUE.map(([n, id]) => [n, '#' + id])), JSON.stringify(p.schede));
    // dal 2026-11-21 il terzo si chiama «Servizi esclusivi» (proprietario)
    controlla(`${nome}: tre capitoli: le due strade e i servizi esclusivi (il su misura per i clienti del negozio)`, p.capitoli.map((c) => c[0]).join() === 'rivenditore-endero,conto-terzi,su-misura' && /servizi esclusivi/i.test(p.capitoli[2][1]), JSON.stringify(p.capitoli));
    // i tre capitoli sono alla stessa distanza l'uno dall'altro (il terzo aveva 96 punti in più sopra)
    const distanze = await page.evaluate(() => { const k = [...document.querySelectorAll('.capitoli--rivenditori .capitolo')].map((x) => [x.querySelector('.capitolo__foto').getBoundingClientRect().top, x.getBoundingClientRect().bottom]); return k.slice(1).map((x, i) => Math.round(x[0] - k[i][1])); });
    controlla(`${nome}: i tre capitoli sono alla stessa distanza`, distanze.length === 2 && distanze[0] === distanze[1], distanze.join(' e '));
    controlla(`${nome}: nel modulo si sceglie tra le stesse voci`, JSON.stringify(p.voci) === JSON.stringify(['Rivenditore Endero', 'Produzione conto terzi', 'Su misura per i miei clienti']), JSON.stringify(p.voci));
    controlla(`${nome}: un solo titolo principale, e «white label» non compare`, p.h1 === 1 && !p.testo.includes('white label'));
    // la scritta grande di ogni capitolo: nessuna parola spezzata a metà (ogni parola sta su una riga sola)
    const spezzate = await page.evaluate(() => [...document.querySelectorAll('.capitolo__etichetta')].flatMap((e) => {
      const nodo = e.firstChild, testo = nodo.textContent, fuori = [];
      for (const m of testo.matchAll(/\S+/g)) { const r = document.createRange(); r.setStart(nodo, m.index); r.setEnd(nodo, m.index + m[0].length); if (r.getClientRects().length > 1) fuori.push(m[0]); }
      return fuori;
    }));
    controlla(`${nome}: nelle scritte grandi dei capitoli nessuna parola è spezzata a metà`, spezzate.length === 0, spezzate.join(', '));
    // dalla scheda al capitolo, dal capitolo al modulo con la voce già segnata
    await a.vai('#offerta .strade__voci', -160);
    await page.locator('#offerta .strada').nth(1).click();
    await page.waitForTimeout(1800);
    const capitolo = await page.evaluate(() => { const r = document.getElementById('conto-terzi').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), innerHeight]; });
    controlla(`${nome}: la scheda «Conto terzi» porta al suo capitolo, che si vede`, capitolo[0] < capitolo[2] * 0.7 && capitolo[1] > 120, JSON.stringify(capitolo));
    await page.locator('#conto-terzi a[data-interesse]').click();
    await page.waitForTimeout(1800);
    const segnate = await page.evaluate(() => ({ voci: [...document.querySelectorAll('input[name="interesse"]:checked')].map((x) => x.value), modulo: (() => { const r = document.getElementById('richiesta').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })() }));
    controlla(`${nome}: «Fai richiesta» del capitolo porta al modulo con «Produzione conto terzi» già segnata`, segnate.modulo && segnate.voci.join() === 'Produzione conto terzi', JSON.stringify(segnate));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(600);
    controlla(`${nome}: niente esce dallo schermo, nessun errore, nessun file mancante`, await a.stretta() && a.errori.length === 0 && a.rotte.length === 0, [...a.errori, ...a.rotte].join(' | ').slice(0, 300));
    if (nome === 'computer') await foto(page, 'rivenditori-pagina');
    await a.contesto.close();
  }

  // ---------------------------------------------------------------- 5. chi legge senza scorrere, e gli schermi di mezzo
  // (revisione SEO del 20 novembre 2026)
  console.log('Chi legge la pagina senza scorrerla');
  // Quante parole di <main> non si vedono (opacità zero, ritagliate, nascoste). Non si contano le parti che sono
  // nascoste per come funzionano, e non perché aspettano lo scorrimento: l'apertura a film, il selettore delle
  // sezioni chiuso sul telefono, le schede che compaiono al passaggio del mouse (.griglia__scheda) e i capitoli di
  // «Chi siamo» in pagina iniziale, che si vedono uno alla volta (gli stessi testi stanno interi in /chi-siamo/),
  // «Endero» in cima alle briciole sui telefoni (è il logo in testata), l'invito «Passaci sopra con il mouse»
  // della camicia dove il mouse non c'è e, nel configuratore, la frase su dove si misura, che compare sotto il campo
  // quando ci si entra (.misura__dove).
  const nascoste = (page) => page.evaluate(() => {
    let tutte = 0, perse = 0;
    const cammina = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
    for (let n = cammina.nextNode(); n; n = cammina.nextNode()) {
      const parole = n.textContent.trim().split(/\s+/).filter(Boolean).length;
      if (!parole || n.parentElement.closest('.apertura, .selettore, .griglia__scheda, .mestiere__scheda, .briciole, .configura__invito, .misura__dove, script, style, dialog, .nascosto, details:not([open]) .domanda__risposta')) continue;
      tutte += parole;
      for (let e = n.parentElement; e && e !== document.body; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.opacity === '0' || s.visibility === 'hidden' || s.display === 'none' || /inset\(0(px)? 0(px)? 100%/.test(s.clipPath)) { perse += parole; break; }
      }
    }
    return { tutte, perse, armato: document.documentElement.classList.contains('movimento') };
  });
  for (const percorso of ['/', '/camicie-su-misura/', '/camicie-su-misura/configuratore/', '/diventa-rivenditore/', '/chi-siamo/', '/dove-siamo/', '/collezione/', '/collezione/maglieria/', '/collezione/giacche-e-cappotti/', '/collezione/abiti/', '/collezione/felpe/']) {
    // come fa Google: apre la pagina su uno schermo da telefono e poi lo allunga fino in fondo, senza scorrere
    const a = await nuovo({ viewport: { width: 412, height: 732 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }), { page } = a;
    await page.goto(base + percorso, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const alta = Math.min(await page.evaluate(() => document.documentElement.scrollHeight), 30000);
    // prima di allungare lo schermo: la pagina non deve essersi armata da sola (la barra delle categorie scorre
    // da sé per mostrare la voce accesa, e non è un gesto di chi guarda)
    await page.waitForTimeout(1500);
    const daSola = await nascoste(page);
    controlla(`${percorso}: la pagina non nasconde nulla da sola, prima che chi guarda si muova`, !daSola.armato && daSola.perse === 0, JSON.stringify(daSola));
    await page.setViewportSize({ width: 412, height: alta });
    await page.waitForTimeout(900);
    const fermo = await nascoste(page);
    controlla(`${percorso}: senza scorrere, tutto il testo si vede`, fermo.tutte > 40 && fermo.perse === 0 && !fermo.armato, JSON.stringify(fermo));
    await a.contesto.close();
  }
  {
    // chi scorre davvero ritrova le comparse: al primo colpo di rotella ciò che sta sotto si nasconde, e scorrendo compare
    const a = await nuovo(), { page } = a;
    await page.goto(base + '/camicie-su-misura/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const prima = await nascoste(page);
    await page.mouse.move(700, 450);
    await page.mouse.wheel(0, 40);
    await page.waitForTimeout(250);
    const dopo = await nascoste(page);
    controlla('al primo colpo di rotella ciò che sta sotto lo schermo si prepara a comparire', !prima.armato && prima.perse === 0 && dopo.armato && dopo.perse > 30, JSON.stringify({ prima, dopo }));
    const inVista = await page.evaluate(() => [...document.querySelectorAll('[data-rivela]')].filter((e) => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 && r.height > 0; }).every((e) => getComputedStyle(e).opacity === '1'));
    controlla('quello che era già sullo schermo non sparisce', inVista);
    // si aspetta che lo scorrimento morbido della rotella sia finito, poi si scende al passo di chi legge: ciò che
    // si salta, o che passa prima che la foto che lo contiene si sia scoperta (un secondo), compare quando si torna su
    // (era così anche prima)
    await page.waitForTimeout(1500);
    const fondo = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < fondo; y += 200) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(300); }
    await page.waitForTimeout(1600);
    const fine = await nascoste(page);
    controlla('scorrendo fino in fondo tutto è comparso', fine.perse === 0, JSON.stringify(fine));
    controlla('nessun errore', a.errori.length === 0 && a.rotte.length === 0, [...a.errori, ...a.rotte].join(' | ').slice(0, 300));
    await a.contesto.close();
  }
  // ---------------------------------------------------------------- 6. un clic che attraversa «Chi siamo»
  // (proprietario, 2026-11-20: cliccando «Rivenditori» la pagina sfogliava di corsa tutte le foto di Chi siamo).
  // Si registra, fotogramma per fotogramma, quale foto si vede mentre la pagina scorre da sola.
  console.log('Un clic che attraversa «Chi siamo»');
  for (const [nome, opzioni] of [['computer', {}], ['telefono', TELEFONO]]) {
    const a = await nuovo(opzioni), { page } = a;
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const registra = () => page.evaluate(() => {
      window.__salto = [];
      const capitoli = [...document.querySelectorAll('.mestiere__capitolo')], palco = document.querySelector('.mestiere__palco');
      const giro = () => {
        const r = palco.getBoundingClientRect();
        let foto = 0;
        capitoli.forEach((k, i) => { if (i && parseFloat(k.style.getPropertyValue('--p') || '0') > 0.5) foto = i; });
        window.__salto.push({ y: Math.round(scrollY), vis: Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top)), foto, ps: capitoli.map((k) => parseFloat(k.style.getPropertyValue('--p') || '0')), attivo: capitoli.findIndex((k) => k.hasAttribute('data-attivo')), testata: document.querySelector('[data-testata]')?.dataset.stato || '' });
        if (window.__salto.length < 300) requestAnimationFrame(giro);
      };
      requestAnimationFrame(giro);
    });
    const clic = async (voce) => {
      if (nome === 'telefono') { await page.click('.selettore__apri'); await page.waitForTimeout(400); }
      await page.click(`[data-voce="${voce}"]`);
      await page.waitForTimeout(3200);
      return risultato();
    };
    // cambi: quante volte la foto cambia mentre si vede; tagli: fotogrammi in cui una foto in vista si sposta di
    // colpo (più di un terzo della sua altezza da un fotogramma all'altro: scoprendosi, o scorrendo, va per gradi);
    // ferma: la foto che si vede quando la pagina si è fermata, che deve essere già quella giusta
    const risultato = () => page.evaluate(() => {
      const r = window.__salto;
      let cambi = 0, tagli = 0;
      for (let i = 1; i < r.length; i++) {
        if (r[i].foto !== r[i - 1].foto && r[i].vis > 0) cambi++;
        if (r[i].vis > 0 && r[i - 1].vis > 0 && r[i].ps.some((p, k) => Math.abs(p - r[i - 1].ps[k]) > 0.34)) tagli++;
      }
      let ferma = r.length - 1;
      for (let i = 0; i + 8 < r.length; i++) if (r.slice(i, i + 8).every((x) => x.y === r[i].y)) { ferma = i; break; }
      return { cambi, tagli, fine: r.at(-1).foto, attivo: r.at(-1).attivo, allArrivo: r[Math.min(r.length - 1, ferma + 4)].foto, barra: r.some((x) => x.testata === 'barra') };
    });
    await a.vai('#collezione', -60);
    await registra();
    const giu = await clic('rivenditori');
    controlla(`${nome}: dalla collezione ai rivenditori le foto di Chi siamo non si sfogliano`, giu.cambi === 0 && giu.fine === 5 && giu.attivo === 5, JSON.stringify(giu));
    await registra();
    const su = await clic('collezione');
    controlla(`${nome}: risalendo alla collezione non si sfogliano`, su.cambi === 0 && su.fine === 0 && su.attivo === 0, JSON.stringify(su));
    await a.vai('#rivenditori', -60);
    await registra();
    const arrivo = await clic('chi-siamo');
    controlla(`${nome}: arrivando su Chi siamo dal basso la prima foto torna con una scoperta sola`, arrivo.cambi <= 1 && arrivo.fine === 0 && arrivo.attivo === 0, JSON.stringify(arrivo));
    // un doppio clic, e un secondo clic mentre la pagina sta ancora scorrendo (revisione del 2026-11-20: la foto
    // cambiava di colpo e la testata tornava sopra il titolo della sezione raggiunta)
    if (nome === 'computer') {
      await a.vai('#collezione', -60);
      await registra();
      await page.dblclick('[data-voce="rivenditori"]');
      await page.waitForTimeout(3200);
      const doppio = await risultato();
      controlla(`${nome}: con un doppio clic la foto non cambia di colpo`, doppio.tagli === 0 && doppio.cambi === 0 && doppio.fine === 5, JSON.stringify(doppio));
      for (const [prima, dopo, attesa, fineAttesa] of [['rivenditori', 'su-misura', 250, 5], ['rivenditori', 'chi-siamo', 450, 0], ['rivenditori', 'collezione', 450, 0]]) {
        await a.vai('#collezione', -60);
        await registra();
        await page.click(`[data-voce="${prima}"]`);
        await page.waitForTimeout(attesa);
        await page.click(`[data-voce="${dopo}"]`);
        await page.waitForTimeout(3200);
        const due = await risultato();
        const arrivo = await page.evaluate((v) => ({ testata: document.querySelector('[data-testata]')?.dataset.stato, voce: document.querySelector('[data-voce][aria-current]')?.dataset.voce, cima: Math.round(document.getElementById(v).getBoundingClientRect().top) }), dopo);
        controlla(`${nome}: ${prima} e poi ${dopo} dopo ${attesa} ms: nessun taglio di colpo, la testata non copre il titolo, la voce giusta accesa`, due.tagli === 0 && due.fine === fineAttesa && arrivo.testata !== 'barra' && arrivo.voce === dopo && arrivo.cima >= -2 && arrivo.cima < 200, JSON.stringify({ ...due, ...arrivo }));
      }
      // dai rivenditori: Collezione e subito Chi siamo. Quando la pagina si ferma su Chi siamo la foto è già la prima
      for (const attesa of [150, 250]) {
        await a.vai('#rivenditori', -60);
        await registra();
        await page.click('[data-voce="collezione"]');
        await page.waitForTimeout(attesa);
        await page.click('[data-voce="chi-siamo"]');
        await page.waitForTimeout(3200);
        const r = await risultato();
        controlla(`${nome}: Collezione e dopo ${attesa} ms Chi siamo: arrivati, la foto è già la prima`, r.tagli === 0 && r.allArrivo === 0 && r.fine === 0, JSON.stringify(r));
      }
      // arrivando su Chi siamo dal basso e scorrendo subito a mano, la foto segue la mano senza scatti
      await a.vai('#rivenditori', -60);
      await registra();
      await page.click('[data-voce="chi-siamo"]');
      await page.waitForTimeout(700);
      await page.mouse.move(700, 450);
      for (let k = 0; k < 8; k++) { await page.mouse.wheel(0, 160); await page.waitForTimeout(90); }
      await page.waitForTimeout(2000);
      const mano = await risultato();
      controlla(`${nome}: arrivando su Chi siamo e scorrendo subito a mano, nessuno scatto`, mano.tagli === 0, JSON.stringify(mano));
      // dalla tastiera: Invio su una voce e poi Tab durante il salto, la pagina arriva lo stesso
      await a.vai('#collezione', -60);
      await page.focus('[data-voce="rivenditori"]');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(2500);
      const tasto = await page.evaluate(() => ({ cima: Math.round(document.getElementById('rivenditori').getBoundingClientRect().top), voce: document.querySelector('[data-voce][aria-current]')?.dataset.voce }));
      controlla(`${nome}: Invio e poi Tab durante il salto: la pagina arriva ai rivenditori`, tasto.cima >= -2 && tasto.cima < 200 && tasto.voce === 'rivenditori', JSON.stringify(tasto));
    }
    // scorrendo a mano le foto si sfogliano ancora, tutte e in ordine
    await a.vai('#rivenditori', -60);
    await clic('chi-siamo');
    const y0 = await page.evaluate(() => scrollY);
    const viste = [];
    for (let k = 1; k <= 16; k++) { await page.evaluate((v) => window.scrollTo(0, v), y0 + k * 280); await page.waitForTimeout(150); viste.push(await page.evaluate(() => [...document.querySelectorAll('.mestiere__capitolo')].findIndex((x) => x.hasAttribute('data-attivo')))); }
    controlla(`${nome}: scorrendo a mano dentro Chi siamo le foto si sfogliano tutte, in ordine`, viste.every((v, i) => !i || v >= viste[i - 1]) && viste.includes(0) && viste.at(-1) === 5 && new Set(viste).size === 6, viste.join(' '));
    controlla(`${nome}: nessun errore`, a.errori.length === 0, a.errori.join(' | ').slice(0, 300));
    await a.contesto.close();
  }

  console.log('Gli schermi di mezzo');
  for (const largo of [810, 820, 834, 900, 959, 1024]) {
    const a = await nuovo({ viewport: { width: largo, height: 1100 } }), { page } = a;
    for (const percorso of ['/camicie-su-misura/', '/diventa-rivenditore/', '/collezione/abiti/', '/camicie-su-misura/configuratore/']) {
      await page.goto(base + percorso, { waitUntil: 'networkidle' });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(350);
      const misure = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      controlla(`${percorso} a ${largo} punti: niente esce dallo schermo`, misure[0] <= misure[1], misure.join(' > '));
    }
    await a.contesto.close();
  }
  console.log('Le domande sotto il configuratore');
  for (const [nome, opzioni] of [['computer', {}], ['telefono', TELEFONO]]) {
    const a = await nuovo(opzioni), { page } = a;
    await page.goto(base + '/camicie-su-misura/configuratore/?senza-passi', { waitUntil: 'networkidle' });
    const c = await page.evaluate(() => ({ h1: document.querySelectorAll('h1').length, domande: document.querySelectorAll('.configura__sotto details').length, titolo: document.querySelector('.configura__sotto h2')?.textContent || '', online: /online/i.test(document.querySelector('meta[name="description"]')?.content || '') }));
    // «online» sta nel titolo delle domande e nella descrizione per Google; il testo sotto il titolo è corto apposta
    controlla(`${nome}: sotto il riquadro ci sono le domande sul su misura online`, c.h1 === 1 && c.domande >= 3 && /online/i.test(c.titolo) && c.online, JSON.stringify(c));
    await a.vai('.configura__sotto', -120);
    await page.locator('.configura__sotto summary').first().click();
    await page.waitForTimeout(500);
    const aperta = await page.evaluate(() => { const d = document.querySelector('.configura__sotto details'); const r = d.querySelector('.domanda__risposta').getBoundingClientRect(); const s = getComputedStyle(d.querySelector('.domanda__risposta p')); return { aperta: d.open, alta: Math.round(r.height), colore: s.color, fondo: getComputedStyle(document.querySelector('.configura__sotto')).backgroundColor }; });
    controlla(`${nome}: una domanda si apre e la risposta si legge`, aperta.aperta && aperta.alta > 20 && aperta.colore !== aperta.fondo, JSON.stringify(aperta));
    controlla(`${nome}: niente esce dallo schermo, nessun errore`, await a.stretta() && a.errori.length === 0 && a.rotte.length === 0, [...a.errori, ...a.rotte].join(' | ').slice(0, 300));
    await foto(page, `configuratore-domande-${nome}`);
    await a.contesto.close();
  }

  await browser.close();
  console.log(`\n${passati} controlli passati, ${falliti.length} falliti`);
  if (falliti.length) { console.log(falliti.map((x) => ' - ' + x).join('\n')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
