// Controlla un questionario a passi (Worker "endero-domande"). Chi risponde non è pratico di tecnologia, quindi:
// si apre già sulla prima domanda, i tasti sono grandi, niente scorre di lato, ogni risposta si salva da sola,
// se la rete cade non si perde niente, alla fine non c'è niente da mandare.
//
//   node tools/prova-domande.js <link di un questionario DI PROVA> [cartella per le schermate]
//
// Scrive risposte vere: per questo gira solo su un questionario che ha "prova": true in domande.json, fatto come
// quello del sarto (prima una "scelta", poi coppie "ipotesi" con "modifica" e "numero" che la riprende).
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
  if (Object.keys(await sulServer()).length) { console.error('Il questionario di prova ha già delle risposte: caricane uno nuovo.'); process.exit(1); }
  const P = q.passi;
  const iScelta = P.findIndex((p) => p.tipo === 'scelta');
  const iAiuto = P.findIndex((p, k) => p.tipo === 'ipotesi' && p.modifica && P[k + 1] && P[k + 1].riprende === p.id && P[k + 1].esempio && P[k + 1].esempio.frase);
  if (iScelta !== 0 || iAiuto !== 1 || P[3].tipo !== 'ipotesi' || P[4].tipo !== 'numero' || P[5].tipo !== 'ipotesi') { console.error('Il questionario di prova non ha la forma attesa.'); process.exit(1); }
  const pScelta = P[0], pAiuto = P[1], pAgio = P[2], pUguale = P[3], pDipende = P[4];

  const browser = await chromium.launch();
  const nuovo = async (opzioni = {}) => {
    const contesto = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opzioni });
    const page = await contesto.newPage();
    const errori = [], spedite = [];
    page.on('console', (m) => { if (m.type() === 'error') errori.push(m.text()); });
    page.on('pageerror', (e) => errori.push(String(e)));
    page.on('request', (r) => { if (r.method() === 'POST') spedite.push(r.url()); });
    const conta = () => page.locator('#conta').innerText();
    const numeroDi = async () => Number((await conta()).split(' ')[1]);
    return {
      contesto, page, errori, spedite, conta, numeroDi,
      titolo: () => page.locator('#passo h1').innerText(),
      stato: () => page.locator('#salvataggio').innerText(),
      domanda: (n) => page.waitForFunction((t) => document.getElementById('conta').textContent === t, `Domanda ${n} di ${N}`, { timeout: 6000 }).then(() => true, () => false),
      aspettaStato: (pezzo) => page.waitForFunction((t) => document.getElementById('salvataggio').textContent.includes(t), pezzo, { timeout: 15000 }).then(() => true, () => false),
      vaiA: async (n) => { for (let k = 0; k < N * 2 && (await numeroDi()) !== n; k++) await page.click((await numeroDi()) < n ? '#avanti' : '#indietro'); },
      stretta: () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    };
  };

  // ---------------------------------------------------------------- 1. si apre ed è già la prima domanda
  console.log('Si apre sulla prima domanda');
  let a = await nuovo();
  await a.page.goto(link);
  controlla('la prima cosa che si vede è la domanda 1', await a.domanda(1), await a.conta());
  controlla('con il suo titolo', (await a.titolo()).toLowerCase() === pScelta.titolo.toLowerCase(), await a.titolo());
  controlla('nessuna scelta da fare prima di cominciare', (await a.page.locator('#comincia, #guarda').count()) === 0 && (await a.page.locator(`#r-${pScelta.id}-${pScelta.scelte[0][0]}`).isVisible()));
  controlla('dice che le risposte si salvano da sole', (await a.stato()).includes('si salva da sola'));
  controlla('carattere Archivo caricato', await a.page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('700 20px Archivo'))));
  await a.page.waitForFunction(() => document.querySelector('.pezzo') && document.querySelector('.pezzo').dataset.strisce);
  controlla('sul computer il pezzo di foglio sta in una striscia sola', await a.page.evaluate(() => document.querySelector('.pezzo').dataset.strisce === '1'));
  await foto(a.page, 'computer-1-scelta');
  controlla('nessun errore in pagina', a.errori.length === 0, a.errori.join(' | '));
  await a.contesto.close();

  // ---------------------------------------------------------------- 2. ?prova: si guarda senza salvare
  console.log('Con ?prova non si salva niente');
  a = await nuovo();
  await a.page.goto(link + '?prova');
  await a.domanda(1);
  controlla('avvisa che è una prova', await a.page.locator('#prova').isVisible());
  await a.page.click(`#r-${pScelta.id}-${pScelta.scelte[0][0]}`);
  controlla('dopo la risposta si va avanti da soli', await a.domanda(2));
  for (let i = 0; i < N; i++) await a.page.click('#avanti').catch(() => {});
  controlla('alla fine dice che era una prova', (await a.page.locator('#esito').innerText()).includes('Era una prova'));
  controlla('nessuna risposta spedita', a.spedite.length === 0, a.spedite.join(' '));
  controlla('niente sul server', Object.keys(await sulServer()).length === 0);
  await a.contesto.close();

  // ---------------------------------------------------------------- 3. si risponde
  console.log('Si risponde');
  a = await nuovo();
  const { page } = a;
  await page.goto(link);
  await a.domanda(1);
  await page.click(`#r-${pScelta.id}-${pScelta.scelte[0][0]}`);
  controlla('il tasto toccato resta segnato', await page.locator(`#r-${pScelta.id}-${pScelta.scelte[0][0]}`).evaluate((b) => b.classList.contains('scelta--presa')).catch(() => true));
  controlla('si passa da soli alla domanda 2', await a.domanda(2));
  controlla('dice «Risposta salvata»', await a.aspettaStato('Risposta salvata'));
  controlla('la scelta è arrivata al server', await arriva(pScelta.id, (r) => r.scelta === pScelta.scelte[0][0] && r.risposta === pScelta.scelte[0][1]));
  await foto(page, 'computer-2-proposta');

  // una proposta corretta a mano, e il numero che la riprende
  await page.click(`#r-${pAiuto.id}-altro`);
  controlla('«No, la cambio»: il testo proposto è già scritto, da correggere', (await page.inputValue(`#t-${pAiuto.id}`)) === pAiuto.ipotesi);
  await page.fill(`#t-${pAiuto.id}`, 'Metro sotto il pomo d\'Adamo, due dita di gioco.');
  await page.click(`#b-${pAiuto.id}`);
  controlla('testo corretto: si passa al numero', await a.domanda(3));
  controlla('il numero riprende il testo corretto', (await page.locator('.proposta').innerText()).includes('pomo d\'Adamo'));
  controlla('testo corretto arrivato al server', await arriva(pAiuto.id, (r) => r.stato === 'modificato' && r.testo === 'Metro sotto il pomo d\'Adamo, due dita di gioco.'));
  await foto(page, 'computer-3-numero');
  await page.fill(`#n-${pAgio.id}`, 'abc');
  await page.click(`#b-${pAgio.id}`);
  controlla('un testo al posto del numero: lo dice accanto alla casella', (await page.locator(`#x-${pAgio.id}`).isVisible()) && (await page.locator(`#x-${pAgio.id}`).innerText()).includes('Scrivi un numero'));
  await page.fill(`#n-${pAgio.id}`, String(pAgio.max + 1));
  await page.click(`#b-${pAgio.id}`);
  controlla('un numero fuori misura viene rifiutato', (await page.locator(`#x-${pAgio.id}`).isVisible()) && (await a.numeroDi()) === 3);
  await page.fill(`#n-${pAgio.id}`, '1,5');
  const atteso = String(Math.round((pAgio.esempio.da - 1.5) * 10) / 10).replace('.', ',');
  controlla('l\'esempio fa il conto mentre si scrive', (await page.locator(`#e-${pAgio.id}`).innerText()).includes(atteso), await page.locator(`#e-${pAgio.id}`).innerText());
  controlla('scrivendo, l\'avviso di errore sparisce', await page.locator(`#x-${pAgio.id}`).isHidden());
  await page.press(`#n-${pAgio.id}`, 'Enter');
  controlla('Invio conferma e va avanti', await a.domanda(4));
  controlla('numero con la virgola arrivato al server', await arriva(pAgio.id, (r) => r.valore === 1.5));
  // chi apre il riquadro e non cambia niente ha confermato
  await page.click(`#r-${pUguale.id}-altro`);
  await page.click(`#b-${pUguale.id}`);
  await a.domanda(5);
  controlla('«No, la cambio» senza cambiare niente vale come conferma', await arriva(pUguale.id, (r) => r.stato === 'confermato'));
  // un numero che non c'è: due righe di spiegazione
  await page.click(`#a-${pDipende.id}`);
  await page.fill(`#t-${pDipende.id}-a`, 'Dipende dal tessuto:\n8 cm sul popeline, 10 sull\'oxford.');
  await page.click(`#b-${pDipende.id}-a`);
  controlla('«Dipende: lo spiego io» va avanti', await a.domanda(6));
  controlla('la spiegazione è arrivata, con l\'a capo', await arriva(pDipende.id, (r) => r.scelta === 'altro' && r.testo.includes('\n')));

  // ---------------------------------------------------------------- 4. chiudo e riapro
  console.log('Chiudo e riapro');
  await page.reload();
  controlla('si riparte dalla prima domanda senza risposta', await a.domanda(6), await a.conta());
  await a.vaiA(3);
  controlla('il numero già scritto si ritrova', (await page.inputValue(`#n-${pAgio.id}`)) === '1,5');
  await a.vaiA(1);
  controlla('la scelta già fatta si ritrova segnata', await page.locator(`#r-${pScelta.id}-${pScelta.scelte[0][0]}`).evaluate((b) => b.classList.contains('scelta--presa')));
  controlla('dice che ha già risposto e che può cambiare', await page.locator('.gia').isVisible());
  for (let i = 0; i < N; i++) await page.click('#avanti').catch(() => {});
  controlla(`alla fine dice quante ne mancano (${N - 5})`, (await a.titolo()).toLowerCase() === `mancano ${N - 5} risposte`, await a.titolo());
  controlla('e che può finire più tardi dallo stesso link', (await page.locator('#esito').innerText()).includes('riaprendo lo stesso link'));
  await page.click('#manca');
  controlla('«Vai alla prima che manca» porta alla domanda giusta', await a.domanda(6));

  // ---------------------------------------------------------------- 5. la rete cade
  console.log('La rete cade');
  const date = new Set([0, 1, 2, 3, 4].map((k) => P[k].id));
  const prossima = (tipo) => P.findIndex((p) => !date.has(p.id) && p.tipo === tipo);
  let i = prossima('ipotesi');
  await a.vaiA(i + 1);
  await a.contesto.setOffline(true);
  await page.click(`#r-${P[i].id}-conferma`);
  controlla('senza rete: dice che la risposta è al sicuro', await a.aspettaStato('Internet non va'));
  controlla('senza rete: si va avanti lo stesso', (await a.numeroDi()) === i + 2 || await a.domanda(i + 2));
  controlla('senza rete: sul server non c\'è', !(await sulServer())[P[i].id]);
  await page.goto('about:blank');          // la pagina si chiude con la risposta ancora in coda
  await a.contesto.setOffline(false);
  await page.goto(link);
  controlla('riaperta la pagina con la rete: la risposta in coda arriva al server', await arriva(P[i].id, (r) => r.stato === 'confermato'));
  date.add(P[i].id);
  i = prossima('ipotesi');
  await a.vaiA(i + 1);
  await a.contesto.setOffline(true);
  await page.click(`#r-${P[i].id}-conferma`);
  await a.aspettaStato('Internet non va');
  await a.contesto.setOffline(false);
  controlla('torna la rete a pagina aperta: salvata da sola', await a.aspettaStato('Risposta salvata'));
  controlla('torna la rete a pagina aperta: arrivata al server', await arriva(P[i].id, (r) => r.stato === 'confermato'));

  // ---------------------------------------------------------------- 6. fino in fondo
  console.log('Fino in fondo');
  for (let giri = 0; giri < N * 4; giri++) {
    if ((await page.locator('#gruppo').innerText()).toLowerCase() === 'fine') {
      if (!(await page.locator('#manca').count())) break;
      await page.click('#manca');
    }
    const n = await a.numeroDi(), p = P[n - 1];
    if (await page.locator('.gia').count()) { await page.click('#avanti'); continue; }
    if (p.tipo === 'ipotesi') await page.click(`#r-${p.id}-conferma`);
    else if (p.tipo === 'scelta') await page.click(`#r-${p.id}-${p.scelte[0][0]}`);
    else { await page.fill(`#n-${p.id}`, String(Math.min(p.max, Math.max(p.min, 5)))); await page.press(`#n-${p.id}`, 'Enter'); }
    await page.waitForFunction((t) => document.getElementById('conta').textContent !== t, `Domanda ${n} di ${N}`, { timeout: 5000 }).catch(() => {});
  }
  await page.waitForFunction(() => (document.getElementById('esito') || {}).textContent && !document.getElementById('esito').dataset.tipo, null, { timeout: 15000 }).catch(() => {});
  controlla('alla fine: «Fatto, grazie!»', (await a.titolo()).toLowerCase() === 'fatto, grazie!', await a.titolo());
  controlla('dice che è arrivato tutto e che può chiudere', (await page.locator('#esito').innerText()).includes('Puoi chiudere la pagina'), await page.locator('#esito').innerText());
  controlla('non chiede di mandare niente', !(await page.locator('#passo').innerText()).toLowerCase().includes('copia'));
  let tutte = await sulServer();
  for (let k = 0; k < 40 && Object.keys(tutte).length < N; k++) { await pausa(2000); tutte = await sulServer(); }
  controlla(`sul server ci sono tutte le ${N} risposte`, Object.keys(tutte).length === N, String(Object.keys(tutte).length));
  await foto(page, 'computer-4-fine');
  await page.locator('.riepilogo button').nth(1).click();
  controlla('«Cambia» riporta alla domanda', await a.domanda(2));
  controlla('nessun errore in pagina', a.errori.filter((e) => !e.includes('ERR_INTERNET_DISCONNECTED')).length === 0, a.errori.join(' | '));
  await a.contesto.close();

  // ---------------------------------------------------------------- 7. un altro dispositivo: il telefono
  console.log('Sul telefono');
  a = await nuovo({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await a.page.goto(link);
  await a.page.waitForFunction(() => document.getElementById('gruppo').textContent === 'Fine');
  controlla('trova le risposte già date e va alla fine', (await a.page.locator('#esito').innerText()).includes('Puoi chiudere la pagina'));
  controlla('fine: niente esce dallo schermo', await a.stretta());
  await foto(a.page, 'telefono-4-fine');
  await a.page.locator('.riepilogo button').first().tap();
  await a.domanda(1);
  // tutte le schermate, una per una: niente esce dallo schermo, niente scorre di lato, il foglio resta leggibile
  const guai = [];
  let spezzate = 0;
  for (let n = 1; n <= N; n++) {
    await a.vaiA(n);
    if (P[n - 1].ritagli && P[n - 1].ritagli.length) await a.page.waitForFunction(() => [...document.querySelectorAll('.pezzo')].every((p) => p.dataset.strisce), null, { timeout: 8000 }).catch(() => guai.push(`${n}: il ritaglio non si carica`));
    const v = await a.page.evaluate(() => ({
      stretta: document.documentElement.scrollWidth <= window.innerWidth,
      scorre: [...document.querySelectorAll('#passo *')].filter((e) => e.scrollWidth > e.clientWidth + 2 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowX)).length,
      pezzi: [...document.querySelectorAll('.pezzo')].map((p) => { const s = [...p.querySelectorAll('.striscia')], im = s[0].querySelector('img'); return { strisce: s.length, scala: im.getBoundingClientRect().width / im.naturalWidth, dentro: s.every((x) => x.getBoundingClientRect().right <= window.innerWidth + 1) }; }),
    }));
    if (!v.stretta) guai.push(`${n}: la pagina esce dallo schermo`);
    if (v.scorre) guai.push(`${n}: qualcosa scorre di lato`);
    for (const z of v.pezzi) { if (z.strisce > 1) spezzate++; if (z.scala < 0.42 || !z.dentro) guai.push(`${n}: ritaglio piccolo o fuori (${JSON.stringify(z)})`); }
  }
  controlla(`tutte le ${N} schermate: niente esce dallo schermo, niente scorre di lato, la scrittura dei fogli resta leggibile`, guai.length === 0, guai.join('; '));
  controlla('i pezzi di foglio larghi vanno a capo in più strisce', spezzate > 0, String(spezzate));
  await a.vaiA(1);
  controlla('tasti delle risposte alti almeno 56 px', await a.page.evaluate(() => [...document.querySelectorAll('.scelta')].every((b) => b.getBoundingClientRect().height >= 56)));
  controlla('testo da 18 px in su', await a.page.evaluate(() => [...document.querySelectorAll('#passo > p:not(.gia):not(.etichetta):not(.nota):not(.esempio)')].every((e) => parseFloat(getComputedStyle(e).fontSize) >= 18)));
  await foto(a.page, 'telefono-1-scelta');
  await a.page.tap('#avanti');
  controlla('proposta: niente esce dallo schermo', await a.stretta());
  await foto(a.page, 'telefono-2-proposta');
  await a.page.tap('#avanti');
  controlla('numero: niente esce dallo schermo', await a.stretta());
  controlla('caselle da 16 px in su: il telefono non ingrandisce la pagina', await a.page.evaluate(() => [...document.querySelectorAll('input[type=text], textarea')].every((e) => parseFloat(getComputedStyle(e).fontSize) >= 16)));
  await foto(a.page, 'telefono-3-numero');
  // girando il telefono le strisce si risistemano
  await a.vaiA(1);
  await a.page.setViewportSize({ width: 780, height: 390 });
  await a.page.waitForTimeout(300);
  controlla('telefono di traverso: niente esce dallo schermo', await a.stretta());
  controlla('nessun errore in pagina', a.errori.length === 0, a.errori.join(' | '));
  await a.contesto.close();

  // ---------------------------------------------------------------- 8. chi non ha il link non trova niente
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
