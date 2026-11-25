// Controlla gli avvisi sotto i campi dei moduli (proprietario, 2026-11-25), su computer e telefono, come li usa una
// persona: si scrive, si esce dal campo, si corregge, si invia. Il Worker è finto (la pagina non lo distingue): qui
// si prova la pagina; le regole e il Worker vero li prova tools/prova-worker.mjs.
//
//   node tools/prova-moduli.js [indirizzo]          (predefinito: il sito in locale, npm run anteprima)
const { chromium } = require('playwright');

const base = (process.argv[2] || 'http://127.0.0.1:8766').replace(/\/$/, '');
const FORMATI = [
  ['computer', { viewport: { width: 1366, height: 900 } }],
  ['telefono', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
];
let passati = 0;
const falliti = [];
function controlla(nome, vero, dettaglio = '') {
  if (vero) passati++; else falliti.push(nome + (dettaglio ? ` (${dettaglio})` : ''));
  console.log(`${vero ? '  ok ' : '  NO '} ${nome}${!vero && dettaglio ? ' → ' + dettaglio : ''}`);
}

// lo stato di un campo: l'avviso, se è sotto il campo e dentro lo schermo, aria-invalid
const stato = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  const riga = document.getElementById(el.getAttribute('aria-describedby')?.split(' ')[0]);
  const a = el.getBoundingClientRect(), r = riga?.getBoundingClientRect();
  return {
    testo: riga?.textContent || '', invalido: el.getAttribute('aria-invalid') === 'true',
    sotto: !!r && r.height > 0 && r.top >= a.bottom - 1 && r.left >= a.left - 24, alto: Math.round(r?.height || 0),
    dentro: !!r && r.right <= innerWidth + 1, largo: document.documentElement.scrollWidth <= innerWidth,
  };
}, sel);

(async () => {
  const browser = await chromium.launch();
  for (const [formato, opzioni] of FORMATI) {
    console.log(`\n${formato}`);
    const contesto = await browser.newContext({ ...opzioni, locale: 'it-IT', reducedMotion: 'reduce' });
    const page = await contesto.newPage();
    const errori = [];
    page.on('pageerror', (e) => errori.push(e.message));
    // il Worker finto: risponde come quello vero; `risposta` si cambia per provare gli errori che arrivano da lì
    let risposta = { status: 200, body: { ok: true } };
    let inviate = 0;
    await page.route('**/api/contatto', (r) => { inviate++; r.fulfill({ status: risposta.status, contentType: 'application/json', body: JSON.stringify(risposta.body) }); });

    // ------------------------------------------------ messaggio (dove siamo)
    await page.goto(base + '/dove-siamo/', { waitUntil: 'networkidle' });
    const F = 'form.modulo';
    const n = `${F} [name="nome"]`, t = `${F} [name="telefono"]`, e = `${F} [name="email"]`, m = `${F} [name="messaggio"]`;
    let s = await page.evaluate(() => ({
      vuoti: [...document.querySelectorAll('.campo__errore')].every((p) => !p.textContent && p.getBoundingClientRect().height === 0),
      novalidate: document.querySelector('form.modulo').noValidate,
      descritti: [...document.querySelectorAll('[data-controllo]')].every((el) => document.getElementById(el.getAttribute('aria-describedby'))),
    }));
    controlla(`${formato}: all'apertura nessun avviso e nessuno spazio vuoto; ogni campo controllato ha la sua riga`, s.vuoti && s.descritti, JSON.stringify(s));
    controlla(`${formato}: con lo script niente nuvolette del browser (novalidate)`, s.novalidate);

    await page.locator(n).scrollIntoViewIfNeeded();
    await page.locator(n).focus();
    await page.keyboard.press('Tab');
    s = await stato(page, n);
    controlla(`${formato}: un campo obbligatorio solo attraversato non viene segnato`, !s.testo && !s.invalido, JSON.stringify(s));

    await page.locator(n).fill('Mario');
    await page.locator(t).focus();
    s = await stato(page, n);
    controlla(`${formato}: «Mario» → uscendo compare sotto il campo «${s.testo}»`, s.testo === 'Scrivi anche il cognome.' && s.invalido && s.sotto && s.dentro && s.largo, JSON.stringify(s));
    await page.locator(n).focus();
    await page.keyboard.type(' Rossi');
    s = await stato(page, n);
    controlla(`${formato}: scrivendo il cognome l'avviso sparisce subito, senza uscire dal campo`, !s.testo && !s.invalido, JSON.stringify(s));

    await page.locator(t).fill('chiamami');
    await page.locator(e).focus();
    s = await stato(page, t);
    controlla(`${formato}: telefono con lettere → «${s.testo}»`, /cifre/.test(s.testo) && s.invalido && s.sotto, JSON.stringify(s));
    await page.locator(t).fill('333 854 87');
    s = await stato(page, t);
    controlla(`${formato}: ancora corto mentre si corregge → resta l'avviso giusto`, /incompleto/.test(s.testo), JSON.stringify(s));
    await page.locator(t).fill('333 854 8712');
    s = await stato(page, t);
    controlla(`${formato}: numero giusto → l'avviso sparisce`, !s.testo && !s.invalido, JSON.stringify(s));

    await page.locator(e).fill('mario.rossi@gmial.com');
    await page.locator(m).focus();
    const forse = await page.evaluate(() => { const p = document.querySelector('.campo__forse'); return p ? { testo: p.textContent, tasto: p.querySelector('button')?.textContent, alto: p.querySelector('button')?.getBoundingClientRect().height } : null; });
    controlla(`${formato}: email «…@gmial.com» → «${forse?.testo}» con il tasto`, forse?.tasto === 'mario.rossi@gmail.com' && forse.alto >= 24, JSON.stringify(forse));
    await page.locator('.campo__correggi').click();
    s = await page.evaluate((e) => ({ valore: document.querySelector(e).value, nota: !!document.querySelector('.campo__forse'), fuoco: document.activeElement === document.querySelector(e) }), e);
    controlla(`${formato}: il tasto corregge l'email, la nota sparisce e il fuoco torna sul campo`, s.valore === 'mario.rossi@gmail.com' && !s.nota && s.fuoco, JSON.stringify(s));
    await page.locator(e).fill('mario@gmail');
    await page.locator(m).focus();
    s = await stato(page, e);
    controlla(`${formato}: email senza desinenza → «${s.testo}»`, /nome@esempio/.test(s.testo) && s.invalido, JSON.stringify(s));
    await page.locator(e).fill('');
    await page.locator(m).focus();
    s = await stato(page, e);
    controlla(`${formato}: l'email facoltativa svuotata non è più segnata`, !s.testo && !s.invalido, JSON.stringify(s));

    // invio con il messaggio vuoto e senza consenso: avvisi, riga accanto al tasto, fuoco sul primo
    await page.locator(`${F} button[type="submit"]`).click();
    await page.waitForTimeout(1500);
    s = await page.evaluate(() => {
      const f = document.querySelector('form.modulo');
      const msg = f.querySelector('[name="messaggio"]'), priv = f.querySelector('[name="privacy"]');
      const r = msg.getBoundingClientRect();
      const testata = document.querySelector('[data-testata]')?.getBoundingClientRect();
      return {
        messaggio: document.getElementById(msg.getAttribute('aria-describedby')).textContent,
        privacy: document.getElementById(priv.getAttribute('aria-describedby')).textContent,
        esito: f.querySelector('.modulo__esito').textContent, fuoco: document.activeElement === msg,
        inVista: r.top >= (testata && testata.bottom > 0 ? testata.bottom - 2 : 0) && r.top < innerHeight - 40,
      };
    });
    controlla(`${formato}: invio incompleto → avvisi su messaggio e consenso, riga accanto al tasto, fuoco e vista sul primo`, s.messaggio === 'Scrivi il tuo messaggio.' && /consenso/.test(s.privacy) && /rosso/.test(s.esito) && s.fuoco && s.inVista, JSON.stringify(s));
    controlla(`${formato}: con errori in pagina non parte niente verso il Worker`, inviate === 0, String(inviate));

    await page.locator(m).fill('Vorrei sapere gli orari.');
    await page.locator(`${F} [name="privacy"]`).check({ force: true });
    s = await page.evaluate(() => [...document.querySelectorAll('form.modulo .campo__errore')].map((p) => p.textContent).filter(Boolean));
    controlla(`${formato}: correggendo spariscono anche gli avvisi di messaggio e consenso`, s.length === 0, JSON.stringify(s));

    // il Worker trova un errore che la pagina non ha visto: l'avviso va sotto quel campo
    risposta = { status: 422, body: { ok: false, campo: 'telefono', errore: 'Il numero sembra incompleto: controlla le cifre.' } };
    await page.locator(`${F} button[type="submit"]`).click();
    await page.waitForTimeout(1500);
    s = await stato(page, t);
    const fuocoT = await page.evaluate((t) => document.activeElement === document.querySelector(t), t);
    controlla(`${formato}: errore del Worker su un campo → avviso sotto quel campo e fuoco lì`, /incompleto/.test(s.testo) && s.invalido && fuocoT, JSON.stringify({ ...s, fuocoT }));
    await page.locator(t).fill('333 854 8712');
    risposta = { status: 200, body: { ok: true } };
    await page.locator(`${F} button[type="submit"]`).click();
    await page.waitForTimeout(800);
    s = await page.evaluate(() => ({ stato: document.querySelector('form.modulo').dataset.stato, esito: document.querySelector('form.modulo .modulo__esito').textContent }));
    controlla(`${formato}: tutto giusto → inviato, con il messaggio di conferma`, s.stato === 'fatto' && s.esito.length > 5, JSON.stringify(s));

    // ------------------------------------------------ rivenditori
    await page.goto(base + '/diventa-rivenditore/', { waitUntil: 'networkidle' });
    inviate = 0;
    await page.locator(`${F} [name="nome"]`).scrollIntoViewIfNeeded();
    await page.locator(`${F} button[type="submit"]`).click();
    await page.waitForTimeout(1500);
    s = await page.evaluate(() => {
      const f = document.querySelector('form.modulo');
      const righe = Object.fromEntries([...f.querySelectorAll('[aria-describedby]')].map((el) => [el.name || el.querySelector('input')?.name, document.getElementById(el.getAttribute('aria-describedby'))?.textContent || '']));
      return { righe, fuoco: document.activeElement?.name, largo: document.documentElement.scrollWidth <= innerWidth };
    });
    const r = s.righe;
    controlla(`${formato}: rivenditore, invio vuoto → nome, telefono, email, città, interesse e consenso segnati; i facoltativi no`,
      r.nome && r.telefono && r.email === 'Scrivi la tua email.' && r.citta && r.interesse && r.privacy && !r.partita_iva && !r.profilo && !r.nazione && s.fuoco === 'nome' && s.largo && inviate === 0, JSON.stringify(s));
    await page.locator(`${F} [name="interesse"]`).first().check({ force: true });
    s = await page.evaluate(() => document.querySelector('fieldset[data-almeno-uno] .campo__errore').textContent);
    controlla(`${formato}: scegliendo una voce l'avviso del gruppo sparisce`, !s, s);

    const iva = `${F} [name="partita_iva"]`;
    await page.locator(iva).fill('08887031213');
    await page.locator(`${F} [name="profilo"]`).focus();
    s = await stato(page, iva);
    controlla(`${formato}: partita IVA con l'ultima cifra sbagliata → «${s.testo}»`, /cifra/.test(s.testo) && s.sotto, JSON.stringify(s));
    await page.locator(`${F} [name="nazione"]`).fill('Francia');
    s = await stato(page, iva);
    controlla(`${formato}: cambiando il Paese la partita IVA si ricontrolla (all'estero va bene)`, !s.testo && !s.invalido, JSON.stringify(s));
    await page.locator(`${F} [name="profilo"]`).fill('il mio negozio');
    await page.locator(`${F} [name="messaggio"]`).focus();
    s = await stato(page, `${F} [name="profilo"]`);
    controlla(`${formato}: «il mio negozio» come sito o Instagram → avviso che spiega come scriverlo`, /@negozio/.test(s.testo) && s.dentro && s.largo, JSON.stringify(s));

    // ------------------------------------------------ presa misure
    await page.goto(base + '/camicie-su-misura/', { waitUntil: 'networkidle' });
    await page.locator(`${F} [name="nome"]`).scrollIntoViewIfNeeded();
    await page.locator(`${F} [name="nome"]`).fill('Mario Rossi');
    await page.locator(`${F} [name="telefono"]`).fill('+39 333 854 8712');
    await page.locator(`${F} [name="privacy"]`).check({ force: true });
    inviate = 0;
    await page.locator(`${F} button[type="submit"]`).click();
    await page.waitForTimeout(800);
    s = await page.evaluate(() => document.querySelector('form.modulo').dataset.stato);
    controlla(`${formato}: presa misure con nome, telefono col prefisso e consenso → inviata (messaggio ed email facoltativi)`, s === 'fatto' && inviate === 1, `${s} ${inviate}`);

    controlla(`${formato}: nessun errore di script`, errori.length === 0, errori.join(' | '));
    await contesto.close();
  }

  // senza script: il browser controlla da sé con gli attributi (e il Worker sempre)
  console.log('\nsenza script');
  const c = await browser.newContext({ javaScriptEnabled: false });
  const p = await c.newPage();
  await p.goto(base + '/diventa-rivenditore/');
  const h = await p.evaluate(() => { const f = document.querySelector('form.modulo'); return { novalidate: f.noValidate, obbligatori: [...f.querySelectorAll('[required]')].map((x) => x.name), email: f.querySelector('[name="email"]').type, tel: f.querySelector('[name="telefono"]').type }; });
  controlla('senza script restano i controlli del browser: campi obbligatori, email e telefono', !h.novalidate && ['nome', 'telefono', 'email', 'citta', 'nazione', 'privacy'].every((x) => h.obbligatori.includes(x)) && h.email === 'email' && h.tel === 'tel', JSON.stringify(h));
  await c.close();
  await browser.close();
  console.log(`\n${passati} controlli passati, ${falliti.length} falliti`);
  if (falliti.length) { console.log(falliti.map((x) => ' - ' + x).join('\n')); process.exit(1); }
})();
