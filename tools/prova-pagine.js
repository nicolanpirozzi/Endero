// Controlla le parti della pagina iniziale e delle pagine interne cambiate il 19 novembre 2026:
// il video sotto il titolo (il reel sui telefoni, i due modelli a tavola sugli schermi larghi, senza audio),
// "Chi siamo" al posto di "Artigianato" (voci, titoli, indirizzo, vecchi indirizzi che rimandano),
// la sezione del su misura con la camicia del configuratore e le sue misure, le due strade dei rivenditori
// (Rivenditore Endero e Conto terzi) in pagina iniziale e nella loro pagina, con la voce già segnata nel modulo.
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
  for (const f of ['eroe-telefono.mp4', 'eroe-computer.mp4', 'eroe-computer-lento.mp4']) {
    const r = await fetch(`${base}/video/${f}`, { headers: { Range: 'bytes=0-99' } });
    const peso = Number((r.headers.get('content-range') || '').split('/')[1]) || Number(r.headers.get('content-length')) || (await r.arrayBuffer()).byteLength;
    controlla(`${f}: c'è, è un video e pesa meno di 3 MB`, r.status < 300 && (r.headers.get('content-type') || '').startsWith('video/') && (peso === 100 || peso < 3e6), `${r.status} ${r.headers.get('content-type')} ${peso}`);
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

  // ---------------------------------------------------------------- 4. i rivenditori
  console.log('I rivenditori');
  const DUE = [['Rivenditore Endero', 'rivenditore-endero'], ['Conto terzi', 'conto-terzi']];
  for (const [nome, opzioni] of [['computer', {}], ['telefono', TELEFONO], ['telefono stretto', { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const a = await nuovo(opzioni), { page } = a;
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await a.vai('#rivenditori');
    await a.vai('#rivenditori .strade__voci', -160);
    const r = await page.evaluate(() => {
      const s = document.getElementById('rivenditori'), q = s.getBoundingClientRect();
      const schede = [...s.querySelectorAll('.strada')].map((x) => { const b = x.getBoundingClientRect(), i = x.querySelector('img'), t = x.querySelector('.strada__testo').getBoundingClientRect(); return { nome: x.querySelector('.strada__nome').textContent.trim(), riga: x.querySelector('.strada__riga').textContent.trim(), href: x.getAttribute('href'), foto: i.complete && i.naturalWidth > 0, alt: i.alt, largo: Math.round(b.width), alto: Math.round(b.height), dentro: t.top >= b.top && t.bottom <= b.bottom + 1 && t.right <= b.right + 1 }; });
      return { alta: Math.round(q.height), titolo: s.querySelector('h2')?.textContent.replace(/\s+/g, ' ').trim(), tasto: s.querySelector('.strade__testo .pillola')?.getAttribute('href'), schede, testo: s.textContent.toLowerCase() };
    });
    controlla(`${nome}: la sezione dei rivenditori è grande (era una fascia di 210 px)`, r.alta >= 500 && /negozio/i.test(r.titolo || ''), `${r.alta} px`);
    controlla(`${nome}: due scelte, Rivenditore Endero e Conto terzi, ognuna porta alla sua parte della pagina`, r.schede.length === 2 && r.schede.every((s, i) => s.nome === DUE[i][0] && s.href === `/diventa-rivenditore/#${DUE[i][1]}` && s.riga.length > 15), JSON.stringify(r.schede.map((s) => [s.nome, s.href])));
    controlla(`${nome}: le schede hanno la foto, grande, e il testo ci sta dentro`, r.schede.every((s) => s.foto && s.alt.length > 10 && s.dentro && s.largo >= 250 && s.alto >= 200), JSON.stringify(r.schede.map((s) => [s.largo, s.alto, s.dentro, s.foto])));
    controlla(`${nome}: il tasto porta alla pagina dei rivenditori, e «white label» non compare`, r.tasto === '/diventa-rivenditore/' && !r.testo.includes('white label'), r.tasto);
    await foto(page, `rivenditori-home-${nome.replace(' ', '-')}`);
    controlla(`${nome}: niente esce dallo schermo, nessun errore`, await a.stretta() && a.errori.length === 0, a.errori.join(' | ').slice(0, 200));
    await a.contesto.close();
  }
  for (const [nome, opzioni] of [['computer', {}], ['telefono', TELEFONO]]) {
    const a = await nuovo(opzioni), { page } = a;
    await page.goto(base + '/diventa-rivenditore/', { waitUntil: 'networkidle' });
    const p = await page.evaluate(() => ({
      schede: [...document.querySelectorAll('#offerta .strada')].map((x) => [x.querySelector('.strada__nome').textContent.trim(), x.getAttribute('href')]),
      capitoli: [...document.querySelectorAll('.capitolo')].map((x) => [x.id, x.querySelector('.capitolo__etichetta').textContent.trim(), x.querySelector('a[href="#richiesta"]')?.dataset.interesse || '']),
      voci: [...document.querySelectorAll('input[name="interesse"]')].map((x) => x.value),
      h1: document.querySelectorAll('h1').length, testo: document.body.textContent.toLowerCase(),
    }));
    controlla(`${nome}: la pagina si apre con le due scelte, che portano ai loro capitoli`, JSON.stringify(p.schede) === JSON.stringify(DUE.map(([n, id]) => [n, '#' + id])), JSON.stringify(p.schede));
    controlla(`${nome}: tre capitoli: le due strade e, in più, il su misura per i clienti del negozio`, p.capitoli.map((c) => c[0]).join() === 'rivenditore-endero,conto-terzi,su-misura' && /in più/i.test(p.capitoli[2][1]), JSON.stringify(p.capitoli));
    controlla(`${nome}: nel modulo si sceglie tra le stesse voci`, JSON.stringify(p.voci) === JSON.stringify(['Rivenditore Endero', 'Produzione conto terzi', 'Su misura per i miei clienti']), JSON.stringify(p.voci));
    controlla(`${nome}: un solo titolo principale, e «white label» non compare`, p.h1 === 1 && !p.testo.includes('white label'));
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

  await browser.close();
  console.log(`\n${passati} controlli passati, ${falliti.length} falliti`);
  if (falliti.length) { console.log(falliti.map((x) => ' - ' + x).join('\n')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
