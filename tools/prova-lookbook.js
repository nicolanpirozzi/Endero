// Controlla il lookbook della pagina /collezione/ e le foto messe in pagina iniziale: tutte le foto si caricano,
// il filtro lascia un tipo solo, la foto si apre a tutto schermo e si chiude in ogni modo (tasto, Esc, fondo, dito,
// Indietro del browser), le frecce e la tastiera cambiano foto, il tasto di WhatsApp porta l'indirizzo della foto,
// e senza JavaScript resta tutto raggiungibile. In pagina iniziale i look della vetrina si aprono nello stesso
// visore senza lasciare la pagina.
//
//   node tools/prova-lookbook.js [indirizzo del sito, senza barra finale] [cartella per le schermate]
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

(async () => {
  const browser = await chromium.launch();
  const nuovo = async (opzioni = {}) => {
    const contesto = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opzioni });
    const page = await contesto.newPage();
    const errori = [], rotte = [];
    let pesoFoto = 0;
    page.on('console', (m) => { if (m.type() === 'error') errori.push(m.text()); });
    page.on('pageerror', (e) => errori.push(String(e)));
    page.on('response', async (r) => {
      if (!r.url().includes('/foto/')) return;
      if (r.status() >= 400) rotte.push(`${r.status()} ${r.url().split('/').pop()}`);
      else pesoFoto += Number(r.headers()['content-length']) || (await r.body().catch(() => Buffer.alloc(0))).length;
    });
    const stato = () => page.evaluate(() => {
      const d = document.getElementById('visore');
      return { aperto: d.open, numero: d.querySelector('[data-visore-numero]').textContent, quanti: d.querySelector('[data-visore-quanti]').textContent, tipo: d.querySelector('[data-visore-tipo]').textContent, ancora: decodeURIComponent(location.hash.slice(1)), percorso: location.pathname, blocco: document.documentElement.classList.contains('dialogo-aperto') };
    });
    const pronta = () => page.waitForFunction(() => { const i = document.querySelector('[data-visore-img]'); return i.complete && i.naturalWidth > 0 && !i.hasAttribute('data-attesa'); }, null, { timeout: 15000 }).then(() => true, () => false);
    const stretta = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    // dove si vede davvero la foto del visore (sta intera dentro il suo spazio), e quale versione è stata scelta
    const vista = () => page.evaluate(() => {
      const d = document.getElementById('visore'), i = d.querySelector('[data-visore-img]'), q = d.querySelector('[data-visore-foto]').getBoundingClientRect(), r = i.getBoundingClientRect();
      const forma = i.naturalWidth / i.naturalHeight, w = Math.min(r.width, r.height * forma), h = w / forma;
      const nome = decodeURIComponent(location.hash.slice(1)), a = document.querySelector(`[data-look="${nome}"]`);
      return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h, riempie: Math.abs(r.width - q.width) < 1 && Math.abs(r.height - q.height) < 1 && q.width >= innerWidth - 1 && q.height >= innerHeight - 1, forma, attesa: a ? Number(a.dataset.forma) : 0, larga: Number((i.currentSrc.match(/-v-(\d+)\./) || [])[1] || 0), sua: i.currentSrc.includes(`/${nome}-v-`), fondo: getComputedStyle(d.querySelector('[data-visore-foto]')).backgroundImage.includes(nome) };
    });
    // la foto è in vista, sotto la testata e il filtro, e ha il fuoco
    const sullaFoto = (nome) => page.evaluate((n) => { const x = document.querySelector(`[data-look="${n}"]`), r = x.getBoundingClientRect(); const spazio = innerHeight - 96, sivede = Math.min(r.bottom, innerHeight) - Math.max(r.top, 96); return { fuoco: document.activeElement === x, inVista: r.top >= 60 && sivede >= 0.9 * Math.min(r.height, spazio - 20), top: Math.round(r.top), y: Math.round(scrollY) }; }, nome);
    return { contesto, page, errori, rotte, stato, pronta, stretta, vista, sullaFoto, peso: () => pesoFoto };
  };

  // ---------------------------------------------------------------- 1. la pagina e le foto
  console.log('La pagina');
  let a = await nuovo();
  let { page } = a;
  await page.goto(base + '/collezione/', { waitUntil: 'networkidle' });
  const conta = await page.evaluate(() => ({
    look: document.querySelectorAll('[data-look]').length,
    tipi: [...document.querySelectorAll('[data-tipo]')].map((t) => [t.dataset.tipo, t.querySelectorAll('[data-look]').length]),
    tasti: [...document.querySelectorAll('[data-filtro]')].map((t) => [t.dataset.filtro, Number(t.dataset.quanti)]),
    nomi: [...document.querySelectorAll('[data-look]')].map((x) => x.dataset.look),
    senzaAlt: [...document.querySelectorAll('[data-look] img')].filter((i) => !i.alt.trim()).length,
    h1: document.querySelectorAll('h1').length,
  }));
  const N = conta.look;
  controlla(`${N} foto in ${conta.tipi.length} tipi`, N >= 40 && conta.tipi.length === 4, JSON.stringify(conta.tipi));
  controlla('i numeri sui tasti del filtro sono quelli veri', conta.tasti[0][1] === N && conta.tasti.slice(1).every(([id, n]) => (conta.tipi.find((t) => t[0] === id) || [])[1] === n), JSON.stringify(conta.tasti));
  controlla('ogni foto ha la sua descrizione e un nome diverso', conta.senzaAlt === 0 && new Set(conta.nomi).size === N);
  controlla('un solo titolo principale', conta.h1 === 1);
  const pesoInizio = a.peso();
  // si scorre fino in fondo: le foto si caricano man mano
  for (let y = 0, alta = 1; y < alta; y += 700) { alta = await page.evaluate((v) => { window.scrollTo(0, v); return document.documentElement.scrollHeight; }, y); await page.waitForTimeout(160); }
  await page.waitForLoadState('networkidle');
  const caricate = await page.evaluate(() => [...document.querySelectorAll('[data-look] img')].filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.closest('[data-look]').dataset.look));
  controlla('tutte le foto si caricano', caricate.length === 0, caricate.join(', '));
  controlla('nessun file mancante', a.rotte.length === 0, a.rotte.join(', '));
  console.log(`     (foto scaricate: ${(pesoInizio / 1e6).toFixed(2)} MB all'apertura, ${(a.peso() / 1e6).toFixed(2)} MB dopo aver scorso tutta la pagina)`);
  controlla('la pagina intera pesa meno di 4 MB di foto', a.peso() < 4e6, `${(a.peso() / 1e6).toFixed(2)} MB`);
  controlla('niente esce dallo schermo', await a.stretta());
  const forma = await page.evaluate(() => [...document.querySelectorAll('.look')].map((l) => { const r = l.getBoundingClientRect(); return [l.classList.contains('look--grande'), r.width / r.height, r.height]; }));
  controlla('i riquadri sono due per tre, anche quelli grandi', forma.every(([, f, h]) => Math.abs(f - 2 / 3) < 0.03 && h > 100), JSON.stringify(forma.filter(([, f]) => Math.abs(f - 2 / 3) >= 0.03).slice(0, 4)));
  await page.evaluate(() => window.scrollTo(0, 0));

  // ---------------------------------------------------------------- 2. il filtro
  console.log('Il filtro');
  const [tipo, quantiTipo] = conta.tipi[1];
  await page.click(`[data-filtro="${tipo}"]`);
  await page.waitForTimeout(300);
  let f = await page.evaluate(() => ({ visibili: [...document.querySelectorAll('[data-tipo]')].filter((t) => !t.hidden).map((t) => t.dataset.tipo), attivo: [...document.querySelectorAll('[data-filtro][aria-current="true"]')].map((t) => t.dataset.filtro), ancora: location.hash }));
  controlla('resta in vista un tipo solo, con il suo tasto acceso', f.visibili.join() === tipo && f.attivo.join() === tipo && f.ancora === '#' + tipo, JSON.stringify(f));
  await page.locator('[data-tipo]:not([hidden]) [data-look]').first().click();
  controlla('con il filtro acceso il visore conta solo quel tipo', await a.pronta() && (await a.stato()).quanti === String(quantiTipo), JSON.stringify(await a.stato()));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  controlla('chiuso il visore l\'indirizzo torna quello del filtro', (await a.stato()).ancora === tipo, (await a.stato()).ancora);
  await page.click('[data-filtro=""]');
  await page.waitForTimeout(300);
  f = await page.evaluate(() => ({ visibili: [...document.querySelectorAll('[data-tipo]')].filter((t) => !t.hidden).length, ancora: location.hash }));
  controlla('«Tutti» rimette tutto e toglie l\'ancora', f.visibili === 4 && f.ancora === '', JSON.stringify(f));

  // ---------------------------------------------------------------- 3. il visore
  console.log('Il visore');
  const terza = page.locator('[data-look]').nth(2);
  await terza.scrollIntoViewIfNeeded();
  await terza.click();
  controlla('toccando una foto si apre a tutto schermo', (await a.stato()).aperto && await a.pronta());
  let s = await a.stato();
  controlla('dice «3 di N» e il tipo', s.numero === '3' && s.quanti === String(N) && s.tipo.length > 2, JSON.stringify(s));
  controlla('l\'indirizzo porta il nome della foto', s.ancora === conta.nomi[2], s.ancora);
  controlla('la pagina sotto non scorre', s.blocco);
  let g = await a.vista();
  controlla('la foto è intera, al centro, grande quanto lo schermo permette', g.riempie && g.sua && g.fondo && (g.h >= 899 || g.w >= 1439) && Math.abs(g.forma - g.attesa) < 0.01, JSON.stringify(g));
  controlla('si carica una versione più grande di quella della griglia', g.larga >= 800, String(g.larga));
  const scritte = await page.evaluate(() => { const d = document.getElementById('visore'); return { alt: d.querySelector('[data-visore-img]').alt, chiedi: d.querySelector('[data-visore-chiedi]').href, letto: d.querySelector('.visore__conta').textContent.replace(/\s+/g, ' ').trim(), vivo: d.querySelector('.visore__conta').getAttribute('aria-live') }; });
  controlla('ha la descrizione, e chi usa un lettore di schermo la sente insieme al numero', scritte.alt.length > 8 && scritte.vivo === 'polite' && scritte.letto.includes(scritte.alt) && /3\D+\d+/.test(scritte.letto), scritte.letto);
  const testo = decodeURIComponent((scritte.chiedi.split('text=')[1] || ''));
  controlla('«Richiedi disponibilità» scrive su WhatsApp cosa si vede e l\'indirizzo della foto', /wa\.me\/39\d+/.test(scritte.chiedi) && testo.includes(scritte.alt) && testo.includes(`/collezione/#${conta.nomi[2]}`) && !/\/collezione\/#[a-z0-9-]+#/.test(testo), testo.slice(0, 220));
  await foto(page, 'computer-visore');
  await page.keyboard.press('ArrowRight');
  controlla('freccia destra: la foto dopo', (await a.stato()).numero === '4' && await a.pronta() && (await a.stato()).ancora === conta.nomi[3]);
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  controlla('freccia sinistra: indietro fino alla prima', (await a.stato()).numero === '1');
  await page.click('[data-visore-prima]');
  controlla('dalla prima, indietro, si passa all\'ultima', (await a.stato()).numero === String(N) && await a.pronta());
  await page.click('[data-visore-dopo]');
  controlla('dall\'ultima, avanti, si torna alla prima', (await a.stato()).numero === '1');
  // il fuoco resta dentro
  for (let k = 0; k < 8; k++) await page.keyboard.press('Tab');
  controlla('con Tab il fuoco resta dentro il visore', await page.evaluate(() => document.getElementById('visore').contains(document.activeElement)));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  s = await a.stato();
  controlla('Esc chiude, la pagina torna a scorrere e l\'ancora sparisce', !s.aperto && !s.blocco && s.ancora === '' && s.percorso === '/collezione/', JSON.stringify(s));
  let dove = await a.sullaFoto(conta.nomi[0]);
  controlla('il fuoco torna sulla foto che si guardava, che è in vista', dove.fuoco && dove.inVista, JSON.stringify(dove));
  // il tasto, il fondo, Indietro
  await page.locator('[data-look]').nth(4).click(); await a.pronta();
  await page.click('[data-visore-chiudi]'); await page.waitForTimeout(300);
  controlla('il tasto «Chiudi» chiude', !(await a.stato()).aperto);
  await page.locator('[data-look]').nth(4).click(); await a.pronta();
  await page.mouse.click(220, 700); await page.waitForTimeout(300);
  controlla('un clic sul fondo, fuori dalla foto, chiude', !(await a.stato()).aperto);
  await page.locator('[data-look]').nth(4).click(); await a.pronta();
  await page.mouse.click(720, 450); await page.waitForTimeout(300);
  controlla('un clic sulla foto non chiude', (await a.stato()).aperto);
  await page.goBack(); await page.waitForTimeout(400);
  s = await a.stato();
  controlla('Indietro del browser chiude il visore e non lascia la pagina', !s.aperto && s.percorso === '/collezione/' && s.ancora === '', JSON.stringify(s));
  // da tastiera
  await page.locator('[data-look]').nth(1).focus();
  await page.keyboard.press('Enter');
  controlla('Invio su una foto la apre', (await a.stato()).aperto && (await a.stato()).numero === '2');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);

  // ---------------------------------------------------------------- 3b. chiudere, tornare indietro, ricaricare
  console.log('Chiusura e cronologia');
  const posizione = () => page.evaluate(() => Math.round(scrollY));
  const filtro = () => page.evaluate(() => ({ visibili: [...document.querySelectorAll('[data-tipo]')].filter((t) => !t.hidden).map((t) => t.dataset.tipo).join(), attivo: [...document.querySelectorAll('[data-filtro][aria-current="true"]')].map((t) => t.dataset.filtro).join(), ancora: decodeURIComponent(location.hash.slice(1)), indirizzo: location.href }));
  // dopo dodici frecce si chiude: la pagina deve stare sulla foto a cui si è arrivati, non su quella di partenza
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('[data-look]').nth(2).click(); await a.pronta();
  for (let k = 0; k < 12; k++) await page.keyboard.press('ArrowRight');
  controlla('dodici frecce avanti: la quindicesima foto', (await a.stato()).numero === '15' && await a.pronta());
  await page.click('[data-visore-chiudi]'); await page.waitForTimeout(450);
  dove = await a.sullaFoto(conta.nomi[14]);
  controlla('chiudendo, la pagina è sulla foto a cui si era arrivati', !(await a.stato()).aperto && dove.fuoco && dove.inVista, JSON.stringify(dove));
  controlla('e l\'indirizzo è tornato quello della pagina, senza ancora', (await filtro()).indirizzo === base + '/collezione/', (await filtro()).indirizzo);
  // una foto tagliata dal bordo dello schermo: aprendola e chiudendola senza cambiare foto la pagina non si muove
  await page.evaluate(() => { const r = document.querySelectorAll('[data-look]')[8].getBoundingClientRect(); window.scrollTo(0, r.top + scrollY - (innerHeight - r.height * 0.45)); });
  await page.waitForTimeout(700);
  const tagliata = await page.evaluate(() => { const r = document.querySelectorAll('[data-look]')[8].getBoundingClientRect(); return { y: Math.round(scrollY), sotto: r.bottom > innerHeight + 40, sopra: r.top < innerHeight - 60 }; });
  await page.locator('[data-look]').nth(8).click({ position: { x: 30, y: 30 } }); await a.pronta();
  await page.keyboard.press('Escape'); await page.waitForTimeout(450);
  controlla('una foto tagliata dal bordo: aperta e chiusa, la pagina resta dov\'era', tagliata.sotto && tagliata.sopra && Math.abs(await posizione() - tagliata.y) < 3 && !(await a.stato()).aperto, JSON.stringify({ ...tagliata, dopo: await posizione() }));
  // con un filtro acceso, più giù nella pagina: chiudere non deve riportare in cima
  const [tipoLungo] = conta.tipi[0];
  // da più giù il filtro riporta in cima al lookbook con uno scorrimento morbido: si aspetta che sia finito
  await page.click(`[data-filtro="${tipoLungo}"]`); await page.waitForTimeout(1700);
  const ultima = page.locator('[data-tipo]:not([hidden]) [data-look]').last();
  await ultima.scrollIntoViewIfNeeded(); await page.waitForTimeout(250);
  const giu = await posizione();
  const nomeUltima = await ultima.getAttribute('data-look');
  await ultima.click(); await a.pronta();
  await page.click('[data-visore-chiudi]'); await page.waitForTimeout(450);
  dove = await a.sullaFoto(nomeUltima);
  f = await filtro();
  controlla('con il filtro acceso, chiudendo si resta dov\'era la foto, non in cima', giu > 400 && Math.abs(dove.y - giu) < 40 && dove.fuoco && dove.inVista, JSON.stringify({ giu, ...dove }));
  controlla('e il filtro resta acceso, con il suo indirizzo', f.visibili === tipoLungo && f.attivo === tipoLungo && f.ancora === tipoLungo, JSON.stringify(f));
  // Indietro chiude, Avanti riapre la stessa foto, Indietro richiude
  await ultima.click(); await a.pronta();
  await page.keyboard.press('ArrowLeft'); await a.pronta();
  const penultima = (await a.stato()).ancora;
  await page.goBack(); await page.waitForTimeout(450);
  f = await filtro(); dove = await a.sullaFoto(penultima);
  controlla('Indietro chiude e lascia filtro, indirizzo e posizione', !(await a.stato()).aperto && f.visibili === tipoLungo && f.ancora === tipoLungo && dove.fuoco && dove.inVista, JSON.stringify({ ...f, ...dove }));
  await page.goForward(); await page.waitForTimeout(450);
  s = await a.stato();
  controlla('Avanti riapre la foto che si guardava', s.aperto && s.ancora === penultima && s.blocco && await a.pronta() && (await a.vista()).sua, JSON.stringify(s));
  await page.click('[data-visore-chiudi]'); await page.waitForTimeout(450);
  f = await filtro(); dove = await a.sullaFoto(penultima);
  controlla('chiusa di nuovo dal tasto: stesso filtro, stessa foto in vista', !(await a.stato()).aperto && f.ancora === tipoLungo && f.visibili === tipoLungo && dove.inVista, JSON.stringify({ ...f, ...dove }));
  // ricaricando la pagina con la foto aperta, sotto resta il filtro di prima
  await ultima.click(); await a.pronta();
  await page.reload({ waitUntil: 'networkidle' });
  s = await a.stato(); f = await filtro();
  controlla('ricaricando con la foto aperta: la foto resta aperta, sotto c\'è ancora il filtro', s.aperto && s.ancora === nomeUltima && s.quanti === String(conta.tipi[0][1]) && f.visibili === tipoLungo && await a.pronta(), JSON.stringify({ ...s, ...f }));
  await page.keyboard.press('Escape'); await page.waitForTimeout(450);
  f = await filtro(); dove = await a.sullaFoto(nomeUltima);
  controlla('e chiudendo si torna al filtro, sulla foto', !(await a.stato()).aperto && f.ancora === tipoLungo && f.attivo === tipoLungo && dove.inVista, JSON.stringify({ ...f, ...dove }));
  // aprire e chiudere tante volte non allunga la cronologia
  const lunga = await page.evaluate(() => history.length);
  for (let k = 0; k < 4; k++) { await ultima.click(); await a.pronta(); await page.keyboard.press('Escape'); await page.waitForTimeout(350); }
  controlla('aprire e chiudere più volte non allunga la cronologia', await page.evaluate(() => history.length) <= lunga + 1, `${lunga} → ${await page.evaluate(() => history.length)}`);
  // chiudere e riaprire subito un'altra foto, nello stesso istante
  await ultima.click(); await a.pronta();
  await page.evaluate((n) => { document.querySelector('[data-visore-chiudi]').click(); document.querySelector(`[data-look="${n}"]`).click(); }, conta.nomi[1]);
  await page.waitForTimeout(700);
  s = await a.stato();
  controlla('chiudere e aprire subito un\'altra foto: si apre quella, nel tipo giusto', s.aperto && s.ancora === conta.nomi[1] && await a.pronta() && (await a.vista()).sua, JSON.stringify(s));
  await page.goBack(); await page.waitForTimeout(450);
  s = await a.stato();
  controlla('e Indietro la chiude senza lasciare la pagina', !s.aperto && s.percorso === '/collezione/' && s.ancora === tipoLungo, JSON.stringify(s));
  // il filtro: toccare la voce già accesa non sposta la pagina; cambiarla da più giù riporta in cima al lookbook
  await page.locator('[data-tipo]:not([hidden]) [data-look]').nth(9).scrollIntoViewIfNeeded();
  // lo scorrimento morbido ci mette un momento a fermarsi: si aspetta che la pagina sia ferma davvero
  let fermo = -1;
  for (let k = 0; k < 20; k++) { const y = await posizione(); if (y === fermo) break; fermo = y; await page.waitForTimeout(200); }
  // il clic parte dalla pagina: quello di Playwright, se la barra si sta ancora spostando, fa scorrere la pagina da sé
  await page.locator(`[data-filtro="${tipoLungo}"]`).dispatchEvent('click'); await page.waitForTimeout(700);
  controlla('toccare la voce già accesa del filtro non sposta la pagina', Math.abs(await posizione() - fermo) < 4, `${fermo} → ${await posizione()}`);
  await page.click(`[data-filtro="${conta.tipi[3][0]}"]`); await page.waitForTimeout(1600);
  const cima = await page.evaluate(() => { const r = document.querySelector('[data-tipo]:not([hidden])').getBoundingClientRect(); return Math.round(r.top); });
  controlla('cambiando filtro da più giù si torna all\'inizio delle foto', cima > 60 && cima < 420, String(cima));
  await page.click('[data-filtro=""]'); await page.waitForTimeout(300);
  // la finestra si allarga con la foto aperta: serve una versione più grande
  await page.setViewportSize({ width: 620, height: 520 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('[data-look]').nth(3).scrollIntoViewIfNeeded();
  await page.locator('[data-look]').nth(3).click(); await a.pronta();
  const piccolaPrima = await a.vista();
  await page.setViewportSize({ width: 1700, height: 1250 });
  await page.waitForFunction(() => /-v-1400\./.test(document.querySelector('[data-visore-img]').currentSrc), null, { timeout: 8000 }).catch(() => {});
  g = await a.vista();
  controlla('allargando la finestra con la foto aperta, la foto cresce e arriva la versione grande', piccolaPrima.larga <= 800 && g.larga === 1400 && g.riempie && g.h >= 1249, JSON.stringify([piccolaPrima.larga, g.larga, Math.round(g.h)]));
  await page.keyboard.press('Escape'); await page.waitForTimeout(350);
  await page.setViewportSize({ width: 1440, height: 900 });
  controlla('nessun errore in pagina', a.errori.length === 0, a.errori.join(' | ').slice(0, 300));
  await a.contesto.close();

  // ---------------------------------------------------------------- 4. arrivando con un indirizzo
  console.log('Arrivando con un indirizzo');
  a = await nuovo(); page = a.page;
  await page.goto(`${base}/collezione/#${conta.nomi[10]}`, { waitUntil: 'networkidle' });
  s = await a.stato();
  controlla('/collezione/#<foto> apre subito quella foto', s.aperto && s.numero === '11' && await a.pronta(), JSON.stringify(s));
  await page.keyboard.press('Escape'); await page.waitForTimeout(350);
  s = await a.stato();
  controlla('chiusa, si resta nella pagina sulla foto', !s.aperto && s.percorso === '/collezione/' && await page.evaluate((nome) => { const r = document.getElementById(nome).getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }, conta.nomi[10]), JSON.stringify(s));
  await page.goto(`${base}/collezione/#${conta.tipi[2][0]}`, { waitUntil: 'networkidle' });
  f = await page.evaluate(() => ({ visibili: [...document.querySelectorAll('[data-tipo]')].filter((t) => !t.hidden).map((t) => t.dataset.tipo), attivo: [...document.querySelectorAll('[data-filtro][aria-current="true"]')].map((t) => t.dataset.filtro) }));
  controlla('/collezione/#<tipo> arriva con quel filtro acceso', f.visibili.join() === conta.tipi[2][0] && f.attivo.join() === conta.tipi[2][0], JSON.stringify(f));
  controlla('nessun errore in pagina', a.errori.length === 0, a.errori.join(' | ').slice(0, 300));
  await a.contesto.close();

  // ---------------------------------------------------------------- 5. altri formati di schermo
  console.log('Formati di schermo');
  for (const [w, h, colonne] of [[1920, 950, 5], [1366, 625, 5], [1100, 800, 4], [820, 1100, 3]]) {
    a = await nuovo({ viewport: { width: w, height: h } }); page = a.page;
    await page.goto(base + '/collezione/', { waitUntil: 'networkidle' });
    const c = await page.evaluate(() => getComputedStyle(document.querySelector('.lookbook__griglia')).gridTemplateColumns.split(' ').length);
    controlla(`${w}×${h}: ${colonne} colonne, niente esce dallo schermo`, c === colonne && await a.stretta(), `${c} colonne`);
    await page.locator('[data-look]').nth(6).scrollIntoViewIfNeeded();
    await page.locator('[data-look]').nth(6).click(); await a.pronta();
    const v = await page.evaluate(() => {
      const d = document.getElementById('visore'), r = (q) => d.querySelector(q).getBoundingClientRect();
      const i = r('[data-visore-img]'), pezzi = ['[data-visore-chiudi]', '[data-visore-prima]', '[data-visore-dopo]', '[data-visore-chiedi]', '.visore__conta'].map(r);
      const sopra = (x, y) => !(x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top);
      return { intera: i.top >= -1 && i.bottom <= innerHeight + 1 && i.left >= -1 && i.right <= innerWidth + 1, dentro: pezzi.every((p) => p.left >= 0 && p.top >= 0 && p.right <= innerWidth && p.bottom <= innerHeight), urti: pezzi.some((p, k) => pezzi.some((q, j) => j > k && sopra(p, q))) };
    });
    const q = await a.vista();
    controlla(`${w}×${h}: nel visore la foto è intera e i tasti non si coprono`, v.intera && q.riempie && q.sua && v.dentro && !v.urti, JSON.stringify(v));
    await a.contesto.close();
  }

  // ---------------------------------------------------------------- 6. il telefono
  console.log('Sul telefono');
  for (const [w, h] of [[390, 844], [375, 548], [320, 568]]) {
    a = await nuovo({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); page = a.page;
    await page.goto(base + '/collezione/', { waitUntil: 'networkidle' });
    const t = await page.evaluate(() => {
      const gr = document.querySelector('.lookbook__griglia'), grande = document.querySelector('.look--grande').getBoundingClientRect(), piccola = document.querySelector('.look:not(.look--grande)').getBoundingClientRect(), barra = document.querySelector('.lookbook__filtro').getBoundingClientRect();
      return { colonne: getComputedStyle(gr).gridTemplateColumns.split(' ').length, grande: grande.width / gr.getBoundingClientRect().width, formaGrande: grande.width / grande.height, piccola: piccola.width, barra: [barra.left, barra.right], tasti: [...document.querySelectorAll('.lookbook__tasto')].map((x) => x.getBoundingClientRect().height) };
    });
    controlla(`${w}×${h}: due colonne, la foto grande prende tutta la riga`, t.colonne === 2 && t.grande > 0.98 && Math.abs(t.formaGrande - 2 / 3) < 0.03 && await a.stretta(), JSON.stringify(t));
    controlla(`${w}×${h}: i tasti del filtro sono alti 40 px e la barra sta nello schermo`, t.tasti.every((x) => x >= 40) && t.barra[0] >= 0 && t.barra[1] <= w, JSON.stringify(t.barra));
    // se le voci non ci stanno tutte, il bordo da cui continuano sfuma; in fondo alla barra sfuma l'altro
    const bordi = () => page.evaluate(() => { const u = document.querySelector('.lookbook__filtro ul'); return { scorre: u.scrollWidth > u.clientWidth + 4, prima: u.hasAttribute('data-prima'), dopo: u.hasAttribute('data-dopo'), maschera: getComputedStyle(u).maskImage || getComputedStyle(u).webkitMaskImage }; });
    let b = await bordi();
    controlla(`${w}×${h}: il filtro sfuma solo dove ci sono altre voci`, b.scorre ? (!b.prima && b.dopo && b.maschera.includes('gradient')) : (!b.prima && !b.dopo), JSON.stringify(b));
    if (b.scorre) {
      await page.evaluate(() => { const u = document.querySelector('.lookbook__filtro ul'); u.scrollLeft = u.scrollWidth; });
      await page.waitForTimeout(200);
      b = await bordi();
      controlla(`${w}×${h}: in fondo alla barra sfuma l'altro bordo`, b.prima && !b.dopo, JSON.stringify(b));
      // la voce accesa si porta in vista da sola, senza spostare la pagina
      await page.evaluate(() => { document.querySelector('.lookbook__filtro ul').scrollLeft = 0; });
      const y0 = await page.evaluate(() => Math.round(scrollY));
      await page.evaluate(() => document.querySelector('[data-filtro="felpe"]').click());
      await page.waitForTimeout(400);
      const acceso = await page.evaluate(() => { const r = document.querySelector('[data-filtro="felpe"]').getBoundingClientRect(); return { dentro: r.left >= 0 && r.right <= innerWidth, y: Math.round(scrollY) }; });
      controlla(`${w}×${h}: la voce accesa del filtro entra in vista`, acceso.dentro && Math.abs(acceso.y - y0) < 4, JSON.stringify(acceso));
      await page.evaluate(() => document.querySelector('[data-filtro=""]').click());
      await page.waitForTimeout(300);
    }
    if (w === 390) await foto(page, 'telefono-lookbook');
    const seconda = page.locator('[data-look]').nth(1);
    await seconda.scrollIntoViewIfNeeded();
    await seconda.tap();
    controlla(`${w}×${h}: toccando si apre`, (await a.stato()).aperto && await a.pronta());
    const v = await page.evaluate(() => {
      const d = document.getElementById('visore'), r = (q) => d.querySelector(q).getBoundingClientRect();
      const i = r('[data-visore-img]'), t = r('[data-visore-foto]'), pezzi = ['[data-visore-chiudi]', '[data-visore-prima]', '[data-visore-dopo]', '[data-visore-chiedi]', '.visore__conta'].map(r);
      const sopra = (x, y) => !(x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top);
      return { centro: Math.abs((i.top + i.bottom) / 2 - (t.top + t.bottom) / 2), intera: i.top >= -1 && i.bottom <= innerHeight + 1 && i.width <= innerWidth + 1, dentro: pezzi.every((p) => p.left >= 0 && p.top >= 0 && p.right <= innerWidth && p.bottom <= innerHeight), urti: pezzi.some((p, k) => pezzi.some((q, j) => j > k && sopra(p, q))), tasti: pezzi.slice(0, 4).map((p) => Math.round(Math.min(p.width, p.height))) };
    });
    const q = await a.vista();
    controlla(`${w}×${h}: la foto è intera e al centro, i tasti non si coprono e sono grandi almeno 44 px`, v.centro < 1.5 && v.intera && q.riempie && q.sua && (q.w >= w - 1 || q.h >= h - 1) && v.dentro && !v.urti && v.tasti.every((x) => x >= 44), JSON.stringify({ ...v, w: q.w, h: q.h }));
    if (w === 320) await foto(page, 'telefono-320-visore');
    if (w === 390) await foto(page, 'telefono-visore');
    // il dito
    const cdp = await a.contesto.newCDPSession(page);
    const striscia = async (x0, y0, x1, y1) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
      for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * k / 6, y: y0 + (y1 - y0) * k / 6 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(250);
    };
    const m = h / 2;
    await striscia(w - 60, m, 60, m);
    controlla(`${w}×${h}: il dito verso sinistra porta alla foto dopo`, (await a.stato()).numero === '3', (await a.stato()).numero);
    await striscia(60, m, w - 60, m);
    controlla(`${w}×${h}: il dito verso destra torna a quella prima`, (await a.stato()).numero === '2', (await a.stato()).numero);
    await striscia(w / 2, m - 20, w / 2 + 14, m + 20);
    controlla(`${w}×${h}: un dito che si muove appena non cambia niente`, (await a.stato()).aperto && (await a.stato()).numero === '2');
    await striscia(w / 2, m - 120, w / 2 + 10, m + 100);
    controlla(`${w}×${h}: il dito verso il basso chiude`, !(await a.stato()).aperto);
    await page.waitForTimeout(350);
    const tornata = await a.sullaFoto(conta.nomi[1]);
    controlla(`${w}×${h}: chiusa, la pagina è sulla foto e l'indirizzo è pulito`, tornata.inVista && (await a.stato()).ancora === '', JSON.stringify(tornata));
    controlla(`${w}×${h}: nessun errore in pagina`, a.errori.length === 0, a.errori.join(' | ').slice(0, 300));
    await a.contesto.close();
  }

  // telefono di traverso: largo e basso
  a = await nuovo({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); page = a.page;
  await page.goto(base + '/collezione/', { waitUntil: 'networkidle' });
  const traverso = await page.evaluate(() => { const gr = document.querySelector('.lookbook__griglia'), g = document.querySelector('.look--grande').getBoundingClientRect(), p = document.querySelector('.look:not(.look--grande)').getBoundingClientRect(); return { colonne: getComputedStyle(gr).gridTemplateColumns.split(' ').length, piccola: Math.round(p.height), grande: [Math.round(g.width / p.width * 10) / 10, Math.round(g.width / g.height * 100) / 100] }; });
  controlla('telefono di traverso: quattro colonne, la foto piccola sta nello schermo', traverso.colonne === 4 && traverso.piccola < 390 && traverso.grande[0] > 1.9 && Math.abs(traverso.grande[1] - 2 / 3) < 0.03 && await a.stretta(), JSON.stringify(traverso));
  await page.locator('[data-look]').nth(1).scrollIntoViewIfNeeded();
  await page.locator('[data-look]').nth(1).tap();
  const vt = await page.evaluate(() => {
    const d = document.getElementById('visore'), r = (q) => d.querySelector(q).getBoundingClientRect(), pezzi = ['[data-visore-chiudi]', '[data-visore-prima]', '[data-visore-dopo]', '[data-visore-chiedi]', '.visore__conta'].map(r);
    const sopra = (x, y) => !(x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top);
    return { dentro: pezzi.every((p) => p.left >= 0 && p.top >= 0 && p.right <= innerWidth && p.bottom <= innerHeight), urti: pezzi.some((p, k) => pezzi.some((q, j) => j > k && sopra(p, q))) };
  });
  controlla('telefono di traverso: il visore si apre, la foto è intera e i tasti non si coprono', (await a.stato()).aperto && await a.pronta() && (await a.vista()).riempie && vt.dentro && !vt.urti, JSON.stringify(vt));
  await foto(page, 'telefono-traverso-visore');
  controlla('telefono di traverso: nessun errore in pagina', a.errori.length === 0, a.errori.join(' | ').slice(0, 300));
  await a.contesto.close();

  // ---------------------------------------------------------------- 7. movimento ridotto e senza JavaScript
  console.log('Movimento ridotto, senza JavaScript');
  a = await nuovo({ reducedMotion: 'reduce' }); page = a.page;
  await page.goto(base + '/collezione/', { waitUntil: 'networkidle' });
  await page.locator('[data-look]').nth(1).click();
  controlla('con il movimento ridotto il visore si apre lo stesso', (await a.stato()).aperto && await a.pronta());
  await a.contesto.close();
  a = await nuovo({ javaScriptEnabled: false }); page = a.page;
  await page.goto(base + '/collezione/', { waitUntil: 'load' });
  const nj = await page.evaluate(() => ({
    visibili: [...document.querySelectorAll('[data-tipo]')].filter((t) => t.getBoundingClientRect().height > 50).length,
    tasti: [...document.querySelectorAll('[data-filtro]')].map((t) => t.getAttribute('href')),
    link: [...document.querySelectorAll('[data-look]')].map((x) => x.getAttribute('href')),
    visore: getComputedStyle(document.getElementById('visore')).display,
  }));
  controlla('senza JavaScript: i quattro tipi si vedono tutti e il visore resta chiuso', nj.visibili === 4 && nj.visore === 'none', JSON.stringify([nj.visibili, nj.visore]));
  // senza script «Tutti» resta nella pagina e ogni tipo porta alla sua pagina di categoria, che esiste
  const categorie = await Promise.all(nj.tasti.slice(1).map((l) => fetch(base + l).then((r) => r.status === 200 && /^\/collezione\/[a-z-]+\/$/.test(l))));
  controlla('senza JavaScript: i tasti del filtro portano alle pagine delle categorie', nj.tasti[0] === '#lookbook' && categorie.length === 4 && categorie.every(Boolean), nj.tasti.join(' '));
  const grandi = await Promise.all(nj.link.slice(0, 6).map((l) => fetch(base + l).then((r) => r.status === 200 && (r.headers.get('content-type') || '').startsWith('image/'))));
  controlla('senza JavaScript: ogni foto è un link alla sua versione grande', nj.link.length === N && grandi.every(Boolean));
  await a.contesto.close();

  // ---------------------------------------------------------------- 8. la pagina iniziale
  console.log('La pagina iniziale');
  const innerAltezza = (o) => (o.viewport ? o.viewport.height : 900);
  for (const [nome, opzioni] of [['computer', {}], ['telefono', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    a = await nuovo(opzioni); page = a.page;
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    const inizio = await page.evaluate(() => document.querySelector('.vetrina').getBoundingClientRect().top + scrollY);
    for (let y = inizio - 200; y < inizio + 2600; y += 500) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(250); }
    await page.waitForLoadState('networkidle');
    const hm = await page.evaluate(() => ({
      look: [...document.querySelectorAll('.griglia__voce--look a')].map((x) => x.getAttribute('href')),
      caricate: [...document.querySelectorAll('.griglia__voce--look img, .riquadro--foto img')].filter((i) => !(i.complete && i.naturalWidth > 0)).length,
      ingressi: [...document.querySelectorAll('.riquadri .riquadro')].map((x) => [x.querySelector('.riquadro__titolo').textContent.trim(), x.getAttribute('href'), x.classList.contains('riquadro--foto')]),
      tutti: (document.querySelector('.vetrina__tutti a') || {}).href || '',
    }));
    // dal 20 novembre ogni look porta alla pagina della sua categoria (il nome del file comincia con quello del tipo: maglieria-, giacche-, abiti-, felpe-)
    controlla(`${nome}: dodici look in vetrina; senza script ognuno porta alla sua foto nella pagina della sua categoria`, hm.look.length === 12 && hm.look.every((x) => /^\/collezione\/[a-z-]+\/#[a-z0-9-]+$/.test(x) && x.split('/')[2].startsWith(x.split('#')[1].split('-')[0])) && hm.look.every((x) => conta.nomi.includes(x.split('#')[1])) && new Set(hm.look.map((x) => x.split('/')[2])).size === 4, JSON.stringify(hm.look.slice(0, 2)));
    controlla(`${nome}: tre ingressi con la foto: Maglieria, Giacche e cappotti, Su misura`, JSON.stringify(hm.ingressi) === JSON.stringify([['Maglieria', '/collezione/maglieria/', true], ['Giacche e cappotti', '/collezione/giacche-e-cappotti/', true], ['Su misura', '/camicie-su-misura/', true]]), JSON.stringify(hm.ingressi));
    controlla(`${nome}: le foto si caricano, niente manca, niente esce dallo schermo`, hm.caricate === 0 && a.rotte.length === 0 && await a.stretta(), `${hm.caricate} non caricate, ${a.rotte.join(', ')}`);
    controlla(`${nome}: c'è il link a tutta la collezione`, hm.tutti.endsWith('/collezione/'), hm.tutti);
    // toccando un look la foto si apre grande e si resta in pagina iniziale
    const terzo = page.locator('.griglia__voce--look a').nth(2), nomeTerzo = hm.look[2].split('#')[1];
    await terzo.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    const yPrima = await page.evaluate(() => Math.round(scrollY));
    if (nome === 'telefono') await terzo.tap(); else await terzo.click();
    s = await a.stato();
    controlla(`${nome}: toccando un look la foto si apre grande restando in pagina iniziale`, s.aperto && s.percorso === '/' && s.ancora === nomeTerzo && s.numero === '3' && s.quanti === '12' && s.tipo.length > 2 && await a.pronta(), JSON.stringify(s));
    const gh = await a.vista();
    controlla(`${nome}: la foto è la sua, intera, con la copia piccola sotto`, gh.riempie && gh.sua && gh.fondo && gh.larga >= 800, JSON.stringify(gh));
    const scritteHome = await page.evaluate(() => { const d = document.getElementById('visore'), t = d.querySelector('[data-visore-chiedi]'); return { testo: t.textContent.trim(), href: t.href }; });
    const messaggio = decodeURIComponent(scritteHome.href.split('text=')[1] || '');
    controlla(`${nome}: il tasto dice «Richiedi disponibilità» e manda su WhatsApp l'indirizzo della foto nella collezione`, /^richiedi disponibilit/i.test(scritteHome.testo) && messaggio.includes(`/collezione/#${nomeTerzo}`) && /disponibilit/.test(messaggio), `${scritteHome.testo} | ${messaggio}`);
    if (nome === 'computer') { await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); } else { await page.locator('[data-visore-dopo]').tap(); await page.locator('[data-visore-dopo]').tap(); }
    s = await a.stato();
    controlla(`${nome}: le frecce passano agli altri look della vetrina`, s.numero === '5' && s.ancora === hm.look[4].split('#')[1] && s.percorso === '/' && await a.pronta(), JSON.stringify(s));
    if (nome === 'computer') await page.keyboard.press('Escape'); else await page.locator('[data-visore-chiudi]').tap();
    await page.waitForTimeout(500);
    s = await a.stato();
    const tornata = await page.evaluate((n) => { const x = document.querySelector(`[data-look="${n}"]`), r = x.getBoundingClientRect(); return { fuoco: document.activeElement === x, inVista: r.top >= 0 && r.bottom <= innerHeight + 1, y: Math.round(scrollY), indirizzo: location.pathname + location.hash }; }, hm.look[4].split('#')[1]);
    controlla(`${nome}: chiusa, si è ancora in pagina iniziale, sulla vetrina, con l'indirizzo pulito`, !s.aperto && !s.blocco && tornata.indirizzo === '/' && tornata.fuoco && tornata.inVista && Math.abs(tornata.y - yPrima) < innerAltezza(opzioni), JSON.stringify({ ...tornata, yPrima }));
    await terzo.scrollIntoViewIfNeeded();
    if (nome === 'telefono') await terzo.tap(); else await terzo.click();
    await a.pronta();
    await page.goBack(); await page.waitForTimeout(500);
    s = await a.stato();
    controlla(`${nome}: Indietro chiude la foto e non lascia la pagina iniziale`, !s.aperto && s.percorso === '/' && s.ancora === '', JSON.stringify(s));
    controlla(`${nome}: nessun errore in pagina`, a.errori.length === 0, a.errori.join(' | ').slice(0, 300));
    await a.contesto.close();
  }

  // ---------------------------------------------------------------- 9. le pagine di categoria
  console.log('Le pagine di categoria');
  for (const [nome, opzioni] of [['computer', {}], ['telefono stretto', { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    a = await nuovo(opzioni); page = a.page;
    const [idTipo, quanteTipo] = conta.tipi[3];
    await page.goto(`${base}/collezione/${idTipo}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const k = await page.evaluate(() => {
      const acceso = document.querySelector('.lookbook__tasto[aria-current="page"]'), r = acceso.getBoundingClientRect();
      return { h1: document.querySelectorAll('h1').length, titolo: document.querySelector('h1').innerText, foto: document.querySelectorAll('[data-look]').length, briciole: [...document.querySelectorAll('.briciole li')].map((x) => x.innerText.trim()), su: document.querySelector('.briciole a').getAttribute('href'), barra: [...document.querySelectorAll('.lookbook__tasto')].map((x) => x.getAttribute('href')), acceso: acceso.getAttribute('href'), inVista: r.left >= 0 && r.right <= innerWidth };
    });
    controlla(`${nome}: una categoria ha il suo titolo, il percorso e solo le sue foto`, k.h1 === 1 && /uomo/i.test(k.titolo) && k.foto === quanteTipo && k.briciole.length === 3 && k.su === '/' && k.barra.includes('/collezione/'), JSON.stringify(k));
    controlla(`${nome}: la barra porta alle altre categorie e a tutta la collezione, con la voce di questa accesa e in vista`, k.barra[0] === '/collezione/' && k.barra.length === 5 && k.barra.slice(1).every((x) => /^\/collezione\/[a-z-]+\/$/.test(x)) && k.acceso === `/collezione/${idTipo}/` && k.inVista && await a.stretta(), JSON.stringify(k.barra));
    const seconda = page.locator('[data-look]').nth(1);
    await seconda.scrollIntoViewIfNeeded();
    if (opzioni.hasTouch) await seconda.tap(); else await seconda.click();
    s = await a.stato();
    controlla(`${nome}: la foto si apre grande restando nella categoria`, s.aperto && s.numero === '2' && s.quanti === String(quanteTipo) && s.percorso === `/collezione/${idTipo}/` && await a.pronta() && (await a.vista()).sua, JSON.stringify(s));
    await page.goBack(); await page.waitForTimeout(450);
    s = await a.stato();
    controlla(`${nome}: Indietro chiude la foto e resta nella categoria`, !s.aperto && s.percorso === `/collezione/${idTipo}/` && s.ancora === '', JSON.stringify(s));
    controlla(`${nome}: nessun errore, nessun file mancante`, a.errori.length === 0 && a.rotte.length === 0, [...a.errori, ...a.rotte].join(' | ').slice(0, 300));
    await a.contesto.close();
  }

  await browser.close();
  console.log(`\n${passati} controlli passati, ${falliti.length} falliti`);
  if (falliti.length) { console.log(falliti.map((x) => ' - ' + x).join('\n')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
