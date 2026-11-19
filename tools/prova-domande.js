// Controlla un questionario a passi (Worker "endero-domande"): introduzione, le due strade (rispondo / sto solo
// guardando), salvataggio di ogni risposta, numeri sbagliati, ripresa dopo aver chiuso, rete che cade, riepilogo,
// secondo dispositivo, telefono.
//
//   node tools/prova-domande.js <link di un questionario DI PROVA> [cartella per le schermate]
//
// Scrive risposte vere: per questo gira solo su un questionario che ha "prova": true in domande.json.
// In locale: npx wrangler dev --config wrangler.domande.toml --port 8790, dopo node domande/carica.mjs <cartella> --locale
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const link = (process.argv[2] || '').replace(/\/?$/, '/');
const schermate = process.argv[3] || '';
if (!/^https?:\/\//.test(link)) { console.error('Uso: node tools/prova-domande.js <link> [cartella schermate]'); process.exit(1); }

let passati = 0;
const falliti = [];
function controlla(nome, vero, dettaglio = '') {
  if (vero) passati++; else falliti.push(nome + (dettaglio ? ` (${dettaglio})` : ''));
  console.log(`${vero ? '  ok ' : '  NO '} ${nome}${!vero && dettaglio ? ' → ' + dettaglio : ''}`);
}
const sulServer = async () => (await (await fetch(link + 'risposte.json')).json()).risposte;
// online l'archivio di Cloudflare può metterci fino a un minuto a far vedere una risposta appena scritta
const pausa = (ms) => new Promise((fatto) => setTimeout(fatto, ms));
const arriva = async (id, va) => { for (let k = 0; k < 40; k++) { const r = (await sulServer())[id]; if (r && va(r)) return true; await pausa(2000); } return false; };
const foto = async (page, nome) => { if (schermate) { fs.mkdirSync(schermate, { recursive: true }); await page.screenshot({ path: path.join(schermate, nome + '.png'), fullPage: true }); } };

(async () => {
  const q = await (await fetch(link + 'domande.json')).json();
  if (q.prova !== true) { console.error('Questo questionario non è di prova ("prova": true): non ci scrivo.'); process.exit(1); }
  const N = q.passi.length;
  const prima = await sulServer();
  if (Object.keys(prima).length) { console.error('Il questionario di prova ha già delle risposte: caricane uno nuovo.'); process.exit(1); }

  const browser = await chromium.launch();
  const nuovo = async (opzioni = {}) => {
    const contesto = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opzioni });
    const page = await contesto.newPage();
    const errori = [], spedite = [];
    page.on('console', (m) => { if (m.type() === 'error') errori.push(m.text()); });
    page.on('pageerror', (e) => errori.push(String(e)));
    page.on('request', (r) => { if (r.method() === 'POST') spedite.push(r.url()); });
    return { contesto, page, errori, spedite };
  };
  const titolo = (page) => page.locator('#passo h1').innerText();
  const conta = (page) => page.locator('#conta').innerText();
  const stato = (page) => page.locator('#salvataggio').innerText();
  const aspettaDomanda = (page, n) => page.waitForFunction((t) => document.getElementById('conta').textContent === t, `Domanda ${n} di ${N}`, { timeout: 5000 }).then(() => true, () => false);
  const aspettaStato = (page, pezzo) => page.waitForFunction((t) => document.getElementById('salvataggio').textContent.includes(t), pezzo, { timeout: 8000 }).then(() => true, () => false);

  // ---------------------------------------------------------------- 1. chi sta solo guardando non salva niente
  console.log('Sto solo guardando');
  let a = await nuovo();
  await a.page.goto(link);
  await a.page.waitForSelector('#comincia');
  controlla('introduzione con il titolo del questionario', (await titolo(a.page)).toLowerCase() === q.titolo.toLowerCase(), await titolo(a.page));
  controlla('Indietro e Salta nascosti nell\'introduzione', await a.page.locator('#passi').isHidden());
  controlla('carattere Archivo caricato', await a.page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('700 20px Archivo'))));
  await foto(a.page, 'computer-1-introduzione');
  await a.page.click('#guarda');
  controlla('si passa alla prima domanda', await aspettaDomanda(a.page, 1));
  await a.page.locator(`#r-${q.passi[0].id}-conferma`).check({ force: true });
  controlla('dopo la risposta si va avanti da soli', await aspettaDomanda(a.page, 2));
  for (let i = 0; i < N; i++) await a.page.click('#avanti').catch(() => {});
  controlla('riepilogo: avvisa che non è stato salvato niente', (await a.page.locator('#esito').innerText()).includes('niente è stato salvato'));
  controlla('nessuna risposta spedita', a.spedite.length === 0, a.spedite.join(' '));
  controlla('niente sul server', Object.keys(await sulServer()).length === 0);
  await a.page.reload();
  await a.page.waitForSelector('#comincia');
  controlla('ricaricando si torna all\'introduzione, da capo', (await a.page.locator('#comincia').innerText()).includes('comincia'));
  controlla('nessun errore in pagina', a.errori.length === 0, a.errori.join(' | '));
  await a.contesto.close();

  // ---------------------------------------------------------------- 2. rispondo per Endero
  console.log('Rispondo per Endero');
  a = await nuovo();
  const { page } = a;
  await page.goto(link);
  await page.click('#comincia');
  controlla('prima domanda', await aspettaDomanda(page, 1));
  await foto(page, 'computer-2-ipotesi');
  const p0 = q.passi[0];
  await page.locator(`#r-${p0.id}-conferma`).check({ force: true });
  controlla('conferma salvata', await aspettaStato(page, 'Salvata alle'));
  controlla('conferma arrivata al server', await arriva(p0.id, (r) => r.stato === 'confermato'));
  await aspettaDomanda(page, 2);

  // un'ipotesi riscritta a mano, e il numero che la riprende
  const iAiuto = q.passi.findIndex((p) => p.tipo === 'numero' && p.riprende) - 1;
  const pAiuto = q.passi[iAiuto], pAgio = q.passi[iAiuto + 1];
  while ((await conta(page)) !== `Domanda ${iAiuto + 1} di ${N}`) await page.click('#avanti');
  await page.locator(`#r-${pAiuto.id}-altro`).check({ force: true });
  await page.fill(`#t-${pAiuto.id}`, 'Metro sotto il pomo d\'Adamo, due dita di gioco.');
  await page.click(`#b-${pAiuto.id}`);
  controlla('testo riscritto: si passa al numero', await aspettaDomanda(page, iAiuto + 2));
  controlla('il numero riprende il testo riscritto', (await page.locator('.ipotesi p').innerText()).includes('pomo d\'Adamo'));
  controlla('testo riscritto arrivato al server', await arriva(pAiuto.id, (r) => r.testo === 'Metro sotto il pomo d\'Adamo, due dita di gioco.'));
  await foto(page, 'computer-3-numero');
  await page.fill(`#n-${pAgio.id}`, 'abc');
  await page.click(`#b-${pAgio.id}`);
  controlla('un testo al posto del numero viene rifiutato', (await stato(page)).includes('Scrivi un numero'));
  await page.fill(`#n-${pAgio.id}`, String(pAgio.max + 1));
  await page.click(`#b-${pAgio.id}`);
  controlla('un numero fuori misura viene rifiutato', (await stato(page)).includes('Scrivi un numero') && (await conta(page)) === `Domanda ${iAiuto + 2} di ${N}`);
  await page.fill(`#n-${pAgio.id}`, '1,5');
  const atteso = String(Math.round((pAgio.esempio.da - 1.5) * 10) / 10).replace('.', ',');
  controlla('l\'esempio fa il conto mentre si scrive', (await page.locator(`#e-${pAgio.id}`).innerText()).includes(atteso), await page.locator(`#e-${pAgio.id}`).innerText());
  await page.press(`#n-${pAgio.id}`, 'Enter');
  controlla('Invio salva e va avanti', await aspettaDomanda(page, iAiuto + 3));
  await aspettaStato(page, 'Salvata alle');
  controlla('numero con la virgola arrivato al server', await arriva(pAgio.id, (r) => r.valore === 1.5));

  // ---------------------------------------------------------------- 3. chiudo e riapro
  console.log('Chiudo e riapro');
  const numeroDi = async () => Number((await conta(page)).split(' ')[1]);
  const vaiA = async (n) => { for (let k = 0; k < N * 2 && (await numeroDi()) !== n; k++) await page.click((await numeroDi()) < n ? '#avanti' : '#indietro'); };
  const date = new Set([p0.id, pAiuto.id, pAgio.id]);
  const aperta = q.passi.findIndex((p) => !date.has(p.id));
  await page.reload();
  controlla('si riparte dalla prima domanda senza risposta', await aspettaDomanda(page, aperta + 1), await conta(page));
  controlla('dice che le risposte si salvano da sole', (await stato(page)).includes('si salva da sola'));
  await vaiA(iAiuto + 2);
  controlla('il numero già scritto si ritrova', (await page.inputValue(`#n-${pAgio.id}`)) === '1,5');

  // ---------------------------------------------------------------- 4. la rete cade
  console.log('La rete cade');
  const iRete = q.passi.findIndex((p) => !date.has(p.id) && p.tipo === 'ipotesi'), pRete = q.passi[iRete];
  await vaiA(iRete + 1);
  await a.contesto.setOffline(true);
  await page.locator(`#r-${pRete.id}-conferma`).check({ force: true });
  controlla('senza rete: avvisa che non è salvata', await aspettaStato(page, 'non è ancora salvata'));
  controlla('senza rete: si va avanti lo stesso', await aspettaDomanda(page, iRete + 2));
  controlla('senza rete: sul server non c\'è', !(await sulServer())[pRete.id]);
  await page.goto('about:blank');          // la pagina si chiude con la risposta ancora in coda
  await a.contesto.setOffline(false);
  await page.goto(link);
  controlla('riaperta la pagina con la rete: la risposta in coda parte da sola', await page.waitForFunction(() => document.getElementById('salvataggio').textContent.includes('Salvata alle'), null, { timeout: 15000 }).then(() => true, () => false), await stato(page));
  controlla('la risposta data senza rete è arrivata al server', await arriva(pRete.id, (r) => r.stato === 'confermato'));
  // e senza ricaricare: la rete cade e torna mentre la pagina è aperta
  const iRete2 = q.passi.findIndex((p, k) => k > iRete && !date.has(p.id) && p.tipo === 'ipotesi'), pRete2 = q.passi[iRete2];
  await vaiA(iRete2 + 1);
  await a.contesto.setOffline(true);
  await page.locator(`#r-${pRete2.id}-conferma`).check({ force: true });
  await aspettaStato(page, 'non è ancora salvata');
  await a.contesto.setOffline(false);
  controlla('torna la rete a pagina aperta: salvata da sola', await aspettaStato(page, 'Salvata alle'));
  controlla('torna la rete a pagina aperta: arrivata al server', await arriva(pRete2.id, (r) => r.stato === 'confermato'));

  // ---------------------------------------------------------------- 5. fino in fondo
  console.log('Fino in fondo');
  const pTesto = q.passi.find((p) => p.tipo === 'numero' && p.id !== pAgio.id);
  for (let giri = 0; giri < N * 3; giri++) {
    if ((await page.locator('#gruppo').innerText()).toLowerCase() === 'riepilogo') {
      const aperta = page.locator('.riepilogo li:has(.stato[data-stato="aperto"]) button').first();
      if (!(await aperta.count())) break;
      await aperta.click();
    }
    const n = Number((await conta(page)).split(' ')[1]), p = q.passi[n - 1];
    if ((await page.locator('#pill').getAttribute('data-stato')) !== 'aperto') { await page.click('#avanti'); continue; }
    if (p.tipo === 'ipotesi') await page.locator(`#r-${p.id}-conferma`).check({ force: true });
    else if (p.id === pTesto.id) { await page.click(`#a-${p.id}`); await page.fill(`#t-${p.id}`, 'Dipende dal tessuto:\n8 cm sul popeline, 10 sull\'oxford.'); await page.click(`#c-${p.id}`); }
    else { await page.fill(`#n-${p.id}`, String(Math.min(p.max, Math.max(p.min, 5)))); await page.press(`#n-${p.id}`, 'Enter'); }
    await page.waitForFunction((t) => document.getElementById('conta').textContent !== t, `Domanda ${n} di ${N}`, { timeout: 5000 }).catch(() => {});
  }
  await page.waitForFunction(() => (document.getElementById('esito') || {}).textContent && !document.getElementById('esito').dataset.tipo, null, { timeout: 15000 }).catch(() => {});
  controlla('riepilogo: hai risposto a tutto', (await titolo(page)).toLowerCase().includes('risposto a tutto'), await titolo(page));
  controlla('riepilogo: tutte salvate, niente da mandare', (await page.locator('#esito').innerText()).includes('non devi mandare niente'), await page.locator('#esito').innerText());
  let tutte = await sulServer();
  for (let k = 0; k < 40 && Object.keys(tutte).length < N; k++) { await pausa(2000); tutte = await sulServer(); }
  controlla(`sul server ci sono tutte le ${N} risposte`, Object.keys(tutte).length === N, String(Object.keys(tutte).length));
  controlla('la spiegazione al posto del numero è arrivata, con l\'a capo', (tutte[pTesto.id] || {}).scelta === 'altro' && (tutte[pTesto.id] || {}).testo.includes('\n'));
  await foto(page, 'computer-4-riepilogo');
  await page.locator('.riepilogo button').nth(1).click();
  controlla('«Rivedi» riporta alla domanda', await aspettaDomanda(page, 2));
  controlla('nessun errore in pagina', a.errori.filter((e) => !e.includes('ERR_INTERNET_DISCONNECTED')).length === 0, a.errori.join(' | '));
  await a.contesto.close();

  // ---------------------------------------------------------------- 6. un altro dispositivo, e il telefono
  console.log('Un altro dispositivo (telefono)');
  a = await nuovo({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await a.page.goto(link);
  await a.page.waitForSelector('#comincia');
  controlla('trova le risposte già date: «continua»', (await a.page.locator('#comincia').innerText()).includes('continua'));
  const stretta = () => a.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  controlla('telefono: introduzione senza scorrimento di lato', await stretta());
  await foto(a.page, 'telefono-1-introduzione');
  await a.page.tap('#comincia');
  await a.page.waitForFunction(() => document.getElementById('gruppo').textContent === 'Riepilogo');
  controlla('porta al riepilogo con le risposte del server', (await a.page.locator('#esito').innerText()).includes('non devi mandare niente'));
  controlla('telefono: riepilogo senza scorrimento di lato', await stretta());
  await foto(a.page, 'telefono-4-riepilogo');
  await a.page.locator('.riepilogo button').first().tap();
  await aspettaDomanda(a.page, 1);
  controlla('telefono: domanda con il ritaglio senza scorrimento di lato', await stretta());
  controlla('telefono: il ritaglio largo scorre dentro il suo riquadro', await a.page.evaluate(() => { const s = document.querySelector('.scorri'); return !s || s.scrollWidth >= s.clientWidth; }));
  await foto(a.page, 'telefono-2-ipotesi');
  for (let i = 0; i < iAiuto + 1; i++) await a.page.tap('#avanti');
  controlla('telefono: domanda con il numero senza scorrimento di lato', await stretta());
  controlla('telefono: caselle da 16 px, il telefono non ingrandisce la pagina', await a.page.evaluate(() => [...document.querySelectorAll('input[type=text], textarea')].every((e) => parseFloat(getComputedStyle(e).fontSize) >= 16)));
  await foto(a.page, 'telefono-3-numero');
  controlla('nessun errore in pagina', a.errori.length === 0, a.errori.join(' | '));
  await a.contesto.close();

  // ---------------------------------------------------------------- 7. chi non ha il link non trova niente
  console.log('Senza il link');
  const origine = new URL(link).origin;
  controlla('indirizzo sbagliato: 404', (await fetch(origine + '/abcdefghijkmnpqrstuvwxyz2345/')).status === 404);
  controlla('radice: 404', (await fetch(origine + '/')).status === 404);
  const testa = await fetch(link);
  controlla('la pagina dice ai motori di ricerca di non indicizzare', (testa.headers.get('x-robots-tag') || '').includes('noindex'));
  controlla('la pagina non passa il suo indirizzo ad altri siti', testa.headers.get('referrer-policy') === 'no-referrer');

  await browser.close();
  console.log(`\n${passati} controlli passati, ${falliti.length} falliti`);
  if (falliti.length) { console.log(falliti.map((f) => ' - ' + f).join('\n')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
