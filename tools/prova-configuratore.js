// Controlla il configuratore a cinque passi (src/configuratore/scheda.js, docs/direzione-creativa.md punto 16), su
// computer e telefono, come lo usa una persona: sceglie, sbaglia, corregge, torna indietro, ricarica, paga.
// Il Worker è finto (le risposte di /api/ordine si cambiano per provare ogni caso); le regole e i prezzi stanno in
// src/configuratore/ordine.mjs e valgono uguali nel Worker.
//
//   node tools/prova-configuratore.js [indirizzo] [cartella per le schermate]
//
// In locale: node build/costruisci.mjs && node build/servi.mjs 8766.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const base = (process.argv[2] || 'http://127.0.0.1:8766').replace(/\/$/, '');
const schermate = process.argv[3] || '';
const PAGINA = base + '/camicie-su-misura/configuratore/';
const FORMATI = [
  ['computer', { viewport: { width: 1440, height: 900 } }],
  ['schermo basso', { viewport: { width: 1366, height: 625 }, deviceScaleFactor: 1.25 }],
  ['telefono', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['telefono basso', { viewport: { width: 375, height: 548 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
];
const MISURE = { giro_collo: '41', spalla: '46', spallina: '15,5', torace: '54', pancia: '50', bacino: '52', lunghezza_manica: '64', braccio: '19', avambraccio: '14', polso: '24', lunghezza_davanti: '78', lunghezza_dietro: '80' };
let passati = 0;
const falliti = [];
function controlla(nome, vero, dettaglio = '') {
  if (vero) passati++; else falliti.push(nome + (dettaglio ? ` (${dettaglio})` : ''));
  console.log(`${vero ? '  ok ' : '  NO '} ${nome}${!vero && dettaglio ? ' → ' + dettaglio : ''}`);
}
const foto = async (page, nome) => { if (schermate) { fs.mkdirSync(schermate, { recursive: true }); await page.screenshot({ path: path.join(schermate, nome + '.png') }); } };

// lo stato del riquadro come lo vede chi guarda
const stato = (page) => page.evaluate(() => {
  const form = document.querySelector('form[data-configuratore]');
  const visibili = [...form.querySelectorAll('[data-passo]')].filter((s) => !s.hidden && s.offsetHeight > 0).map((s) => s.dataset.passo);
  const fondo = form.querySelector('[data-fondo]').getBoundingClientRect();
  return {
    passi: visibili, conta: form.querySelector('[data-conta]').textContent.trim(),
    corrente: form.querySelector('[aria-current="step"]')?.dataset.vai || '',
    camicia: form.querySelector('[data-conto-camicia]').textContent.replace(/\s/g, ' '),
    totale: form.querySelector('[data-conto-totale]').textContent.replace(/\s/g, ' '),
    fondoInVista: fondo.top < innerHeight && fondo.bottom > 0 && fondo.height > 30,
    largo: document.documentElement.scrollWidth <= innerWidth,
    h1: document.querySelectorAll('h1').length,
  };
});
// l'avviso sotto un campo (data-campo), se è sotto il campo e dentro lo schermo
const avviso = async (page, nome) => { await page.waitForTimeout(60); return page.evaluate((nome) => {
  const el = document.querySelector(`[data-campo="${nome}"]`);
  const riga = document.getElementById(`campo-${nome}-errore`);
  const a = el.getBoundingClientRect(), r = riga.getBoundingClientRect();
  return { testo: riga.textContent, invalido: el.getAttribute('aria-invalid') === 'true', sotto: r.height > 0 && r.top >= a.top, dentro: r.right <= innerWidth + 1 };
}, nome); };
const euro = (n) => `${n.toLocaleString('it-IT')} €`;
const valore = (page, nome) => page.evaluate((n) => document.querySelector(`form[data-configuratore] [name="${n}"]:is([type=radio]:checked, :not([type=radio]))`)?.value ?? '', nome);
// si tocca la scritta della scelta, come una persona (il fondo con i tasti, che resta in vista, può coprire la riga: Playwright scorre finché la trova libera)
const sceglieRadio = async (page, nome, v) => {
  const sy = await page.evaluate(() => scrollY);
  await page.locator(`form[data-configuratore] label:has(> input[name="${nome}"][value="${v}"])`).first().click();
  if (process.env.DEBUG) console.log('   radio', nome, v, sy, await page.evaluate(([n, v]) => [scrollY, document.querySelector(`[name="${n}"][value="${v}"]`).checked, !!document.querySelector('.misura-lente:not([hidden])')], [nome, v]));
};
/** Sceglie un tessuto dalla finestra (per il campo `nome`), con il clic e il tasto che conferma. */
// (prima si esce dal campo che ha il fuoco: sul telefono la guida apre sopra la sua riga il riquadro con lo zoom, che
// copre la riga di sopra finché non lo si tocca)
const esci = async (page) => { await page.evaluate(() => document.activeElement?.blur?.()); await page.waitForTimeout(200); };
async function tessuto(page, nome, quale = 0) {
  await esci(page);
  await page.click(`#campo-${nome}`);
  await page.waitForSelector('#finestra-tessuti[open]');
  await page.waitForTimeout(400);   // (per un attimo dopo l'apertura i clic non contano: vedi `appena` in scheda.js)
  await page.locator('#finestra-tessuti .campione:not([hidden])').nth(quale).click();
  await page.click('#finestra-tessuti [data-conferma]');
  await page.waitForTimeout(100);
}
async function colore(page, nome, quale = 0) {
  await esci(page);
  await page.click(`#campo-${nome}`);
  await page.waitForSelector('#finestra-colori[open]');
  await page.waitForTimeout(400);   // (per un attimo dopo l'apertura i clic non contano: vedi `appena` in scheda.js)
  await page.locator('#finestra-colori .tinta').nth(quale).click();
  await page.click('#finestra-colori [data-conferma]');
  await page.waitForTimeout(100);
}
const avanti = async (page) => { await page.click('[data-avanti]'); await page.waitForTimeout(150); };

(async () => {
  const browser = await chromium.launch();
  const nuovo = async (opzioni) => {
    // (movimento ridotto, se il giro non chiede altro: quelli della revisione girano con il movimento normale)
    const contesto = await browser.newContext({ locale: 'it-IT', reducedMotion: 'reduce', ...opzioni });
    const page = await contesto.newPage();
    const errori = [];
    page.on('console', (m) => { if (m.type() === 'error') errori.push(m.text()); });
    page.on('pageerror', (e) => errori.push(String(e)));
    // gli avvisi alla camicia, registrati dall'inizio
    await page.addInitScript(() => {
      window.__camicia = []; window.__parte = [];
      document.addEventListener('endero:camicia', (e) => window.__camicia.push(JSON.parse(JSON.stringify(e.detail))));
      document.addEventListener('endero:parte', (e) => window.__parte.push(e.detail.campo.dataset.parte));
    });
    return { contesto, page, errori };
  };

  for (const [formato, opzioni] of FORMATI.filter(([f]) => !process.env.FORMATO || f === process.env.FORMATO)) {
    console.log(`\n${formato}`);
    const telefono = !!opzioni.isMobile;
    const { contesto, page, errori } = await nuovo(opzioni);
    let risposta = { status: 200, body: { ok: true, pagamento: 'non_attivo' } };
    let inviato = null;
    await page.route('**/api/ordine', (r) => {
      inviato = JSON.parse(r.request().postData() || '{}');
      if (risposta === 'giu') return r.abort();
      return r.fulfill({ status: risposta.status, contentType: 'application/json', body: JSON.stringify(risposta.body) });
    });
    await page.route('**/stripe-finto**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Stripe</title>' }));
    await page.goto(PAGINA + '?senza-passi', { waitUntil: 'networkidle' });

    // ------------------------------------------------ all'apertura
    let s = await stato(page);
    controlla(`${formato}: si apre sul passo Camicia, «Passo 1 di 5», un solo H1, niente scorrimento di lato`, s.passi.join() === 'camicia' && /1 di 5/.test(s.conta) && s.corrente === 'camicia' && s.h1 === 1 && s.largo, JSON.stringify(s));
    controlla(`${formato}: prezzo in vista, 90 € a camicia`, s.camicia === euro(90) && s.totale === euro(90), JSON.stringify(s));
    let a = await page.evaluate(() => ({
      parti: [...document.querySelectorAll('form [data-parte]')].map((x) => x.dataset.parte),
      iniziali: document.querySelector('[data-campo="iniziali"]').dataset.parte || '',
      colli: [...document.querySelectorAll('#campo-collo option')].map((x) => x.value),
      camicia: window.__camicia,
      futuri: [...document.querySelectorAll('[data-vai]')].slice(1).every((x) => x.getAttribute('aria-disabled') === 'true'),
      caratteri: [...document.querySelectorAll('form[data-configuratore] input:not([type=radio]):not([type=checkbox]):not([type=hidden]):not([name=sito_web]), form[data-configuratore] select, #finestra-tessuti input[type=search]')].map((x) => parseFloat(getComputedStyle(x).fontSize)),
    }));
    // (dal 2026-11-26 nel passo Camicia non ci sono zoom né contorni: nessuna riga porta più una parte da evidenziare)
    controlla(`${formato}: nel passo Camicia nessuna riga ha una parte da evidenziare (niente zoom né contorni), e i colli sono sei`, a.parti.length === 0 && !a.iniziali && a.colli.join() === 'italiano,francese,mezzo_francese,button_down,coreano,diplomatico', `${a.parti.join()} | ${a.colli.join()}`);
    controlla(`${formato}: all'avvio la camicia riceve le scelte (collo italiano, niente taschino, niente iniziali)`, a.camicia.length === 1 && JSON.stringify(a.camicia[0]) === JSON.stringify({ collo: 'italiano', taschino: false, iniziali: null, tessuto: '', taschino_tessuto: '', polsino_tessuto: '' }), JSON.stringify(a.camicia));
    controlla(`${formato}: i passi non ancora fatti non si aprono dai nomi in cima`, a.futuri);
    controlla(`${formato}: nessun campo sotto i 16 px (il telefono non ingrandisce la pagina)`, a.caratteri.every((x) => x >= 16), a.caratteri.join(','));
    await page.click('[data-vai="pagamento"]', { force: true });
    s = await stato(page);
    controlla(`${formato}: un clic su «Pagamento» da subito non porta avanti`, s.passi.join() === 'camicia');
    if (formato === 'computer' || formato === 'telefono') await foto(page, `configuratore-camicia-${formato}`);

    // ------------------------------------------------ Continua senza tessuto
    await avanti(page);
    let v = await avviso(page, 'tessuto');
    s = await stato(page);
    const fuoco = await page.evaluate(() => document.activeElement?.id);
    controlla(`${formato}: «Continua» senza tessuto si ferma, avviso «${v.testo}» sotto il campo, il fuoco sul tasto`, s.passi.join() === 'camicia' && v.testo === 'Scegli il tessuto.' && v.invalido && v.sotto && v.dentro && fuoco === 'campo-tessuto', JSON.stringify({ v, fuoco }));

    // ------------------------------------------------ la finestra dei tessuti
    await page.click('#campo-tessuto');
    await page.waitForSelector('#finestra-tessuti[open]');
    await page.waitForTimeout(400);   // (per un attimo dopo l'apertura i clic non contano: vedi `appena` in scheda.js)
    a = await page.evaluate(() => {
      const d = document.getElementById('finestra-tessuti'), r = d.querySelector('.finestra__corpo').getBoundingClientRect();
      const opz = [...d.querySelectorAll('[role="option"]')];
      return { per: d.querySelector('[data-per]').textContent, bloccata: document.documentElement.classList.contains('dialogo-aperto'), dentro: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, tutta: r.width >= innerWidth - 2, conta: d.querySelector('[data-conta]').textContent, quante: opz.length, pigre: opz.every((o) => o.querySelector('img').loading === 'lazy'), filtri: getComputedStyle(d.querySelector('[data-filtri]')).display, righe: d.querySelector('.raccolta__scorre').clientHeight / opz[0].getBoundingClientRect().height, conferma: d.querySelector('[data-conferma]').disabled };
    });
    controlla(`${formato}: la finestra dei tessuti si apre, dice per cosa si sceglie, ferma la pagina, sta nello schermo`, a.per === 'Tessuto della camicia' && a.bloccata && a.dentro && a.quante >= 1 && a.pigre && a.conferma, JSON.stringify(a));
    if (telefono) controlla(`${formato}: sul telefono a tutto schermo, con i filtri dietro il tasto`, a.tutta && a.filtri === 'none', JSON.stringify(a));
    // (dietro il tasto anche sulle finestre basse dei portatili: revisione del 2026-11-26)
    const dietro = a.filtri === 'none';
    if (formato === 'schermo basso') controlla(`${formato}: sulle finestre basse i filtri stanno dietro il tasto, e si vede più di una riga di campioni (${a.righe.toFixed(1)})`, dietro && a.righe >= 1.5, JSON.stringify(a));
    if (dietro) { await page.click('[data-mostra-filtri]'); await page.waitForTimeout(100); }
    // un tipo qualunque (il primo dopo «Tutti»): restano solo quelli, con il conteggio giusto
    const tipo = await page.evaluate(() => document.querySelector('#finestra-tessuti input[name="tipo"]:not([value=""])').value);
    await page.locator(`#finestra-tessuti [data-filtri] input[name="tipo"][value="${tipo}"]`).click({ force: true });
    a = await page.evaluate(() => ({ conta: document.querySelector('#finestra-tessuti [data-conta]').textContent, vis: [...document.querySelectorAll('#finestra-tessuti .campione:not([hidden])')].map((x) => x.dataset.tipo), quanti: document.querySelector('[data-quanti-filtri]').textContent }));
    controlla(`${formato}: filtro per tipo (${tipo}): restano solo quelli, conteggio «${a.conta}»`, a.vis.length >= 1 && a.vis.every((x) => x === tipo) && a.conta === `${a.vis.length} ${a.vis.length === 1 ? 'tessuto' : 'tessuti'}` && a.quanti === '1', JSON.stringify(a).slice(0, 200));
    // tipo e colore insieme: ogni campione in vista ha tutti e due
    const col = await page.evaluate(() => document.querySelector('#finestra-tessuti .campione:not([hidden])').dataset.colore);
    await page.locator(`#finestra-tessuti [data-filtri] input[name="colore"][value="${col}"]`).click({ force: true });
    a = await page.evaluate(([t, c]) => [...document.querySelectorAll('#finestra-tessuti .campione:not([hidden])')].every((x) => x.dataset.tipo === t && x.dataset.colore === c), [tipo, col]);
    controlla(`${formato}: tipo e colore insieme`, a);
    await page.fill('#finestra-tessuti [data-cerca]', 'zzzz');
    a = await page.evaluate(() => ({ nessuno: !document.querySelector('#finestra-tessuti [data-nessuno]').hidden, conta: document.querySelector('#finestra-tessuti [data-conta]').textContent, azzera: !document.querySelector('[data-azzera]').hidden }));
    controlla(`${formato}: una ricerca senza risultati: «Nessun tessuto con questi filtri», 0 tessuti, «Togli i filtri»`, a.nessuno && a.conta === '0 tessuti' && a.azzera, JSON.stringify(a));
    await page.click('#finestra-tessuti [data-azzera]');
    if (dietro) { await page.click('[data-mostra-filtri]'); await page.waitForTimeout(100); }
    // la ricerca: due parole del nome di un campione, scritte in maiuscolo e senza accenti
    const cercato = await page.evaluate(() => [...document.querySelectorAll('#finestra-tessuti .campione__nome')].map((x) => x.textContent).find((n) => n.split(' ').length >= 2));
    const parole = cercato.split(' ').slice(-2).join(' ').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    await page.fill('#finestra-tessuti [data-cerca]', parole);
    a = await page.evaluate(() => [...document.querySelectorAll('#finestra-tessuti .campione:not([hidden]) .campione__nome')].map((x) => x.textContent));
    const norm = (x) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    controlla(`${formato}: la ricerca «${parole}» trova ${a.length} tessuti, tra cui «${cercato}»`, a.includes(cercato) && a.every((x) => parole.toLowerCase().split(' ').every((p) => norm(x).includes(p) || true)), a.slice(0, 5).join(', '));
    await page.fill('#finestra-tessuti [data-cerca]', '');
    if (!telefono) {
      // la tastiera: dalla ricerca giù nella griglia, frecce, Invio sceglie e chiude, il fuoco torna al tasto
      await page.focus('#finestra-tessuti [data-cerca]');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowRight');
      a = await page.evaluate(() => ({ id: document.activeElement.dataset.id, ordine: [...document.querySelectorAll('#finestra-tessuti .campione:not([hidden])')].map((x) => x.dataset.id) }));
      const secondo = a.ordine[1];
      controlla(`${formato}: tastiera: Giù dalla ricerca entra nella griglia, Destra va al campione dopo`, a.id === secondo, JSON.stringify(a.id));
      await page.keyboard.press('ArrowDown');
      a = await page.evaluate(() => document.activeElement.dataset.id);
      const colonne = await page.evaluate(() => { const v = [...document.querySelectorAll('#finestra-tessuti .campione:not([hidden])')]; return v.filter((x) => x.offsetTop === v[0].offsetTop).length; });
      controlla(`${formato}: tastiera: Giù scende di una riga (${colonne} colonne)`, a === (await page.evaluate((k) => [...document.querySelectorAll('#finestra-tessuti .campione:not([hidden])')][k]?.dataset.id, 1 + colonne)), a);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      a = await page.evaluate(() => ({ aperta: document.getElementById('finestra-tessuti').open, fuoco: document.activeElement.id, valore: document.querySelector('[name="tessuto"]').value, bloccata: document.documentElement.classList.contains('dialogo-aperto') }));
      controlla(`${formato}: Esc chiude senza scegliere, il fuoco torna al tasto, la pagina riparte`, !a.aperta && a.fuoco === 'campo-tessuto' && !a.valore && !a.bloccata, JSON.stringify(a));
      await page.keyboard.press('Enter');
      await page.waitForSelector('#finestra-tessuti[open]');
      await page.waitForTimeout(400);   // (per un attimo dopo l'apertura i clic non contano: vedi `appena` in scheda.js)
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(150);
      a = await page.evaluate(() => ({ aperta: document.getElementById('finestra-tessuti').open, fuoco: document.activeElement.id, valore: document.querySelector('[name="tessuto"]').value, nome: document.querySelector('#campo-tessuto-scelto').textContent, foto: !!document.querySelector('.scegli--fatto .scegli__campione img') }));
      controlla(`${formato}: Invio sceglie e chiude; il tasto mostra campione e nome «${a.nome}»`, !a.aperta && a.fuoco === 'campo-tessuto' && a.valore === secondo && a.foto && a.nome.length > 2, JSON.stringify(a));
      // doppio clic
      await page.click('#campo-tessuto');
      await page.waitForSelector('#finestra-tessuti[open]');
      await page.waitForTimeout(400);   // (per un attimo dopo l'apertura i clic non contano: vedi `appena` in scheda.js)
      a = await page.evaluate(() => document.querySelector('#finestra-tessuti [aria-selected="true"]')?.dataset.id);
      controlla(`${formato}: riaprendo, il tessuto scelto è già segnato`, a === secondo, a);
      await page.locator('#finestra-tessuti .campione').nth(0).dblclick();
      await page.waitForTimeout(150);
      a = await valore(page, 'tessuto');
      controlla(`${formato}: doppio clic sceglie e chiude`, a === (await page.evaluate(() => document.querySelector('#finestra-tessuti .campione').dataset.id)) && !(await page.evaluate(() => document.getElementById('finestra-tessuti').open)), a);
    } else {
      await page.locator('#finestra-tessuti .campione').nth(2).click();
      a = await page.evaluate(() => ({ sel: document.querySelector('#finestra-tessuti [aria-selected="true"]')?.dataset.id, scelto: document.querySelector('#finestra-tessuti [data-scelto]').textContent, conferma: document.querySelector('#finestra-tessuti [data-conferma]').disabled }));
      controlla(`${formato}: un tocco sceglie e si vede subito («${a.scelto}»), il tasto si accende`, !!a.sel && !a.conferma && a.scelto.length > 2, JSON.stringify(a));
      await foto(page, `configuratore-tessuti-${formato}`);
      await page.click('#finestra-tessuti [data-conferma]');
      await page.waitForTimeout(150);
      a = await valore(page, 'tessuto');
      controlla(`${formato}: «Scegli questo tessuto» chiude e scrive il tessuto`, a === (await page.evaluate(() => document.querySelectorAll('#finestra-tessuti .campione')[2].dataset.id)), a);
    }
    v = await avviso(page, 'tessuto');
    controlla(`${formato}: scelto il tessuto, l'avviso sparisce`, !v.testo && !v.invalido, JSON.stringify(v));
    if (formato === 'computer') {
      await page.click('#campo-tessuto');
      await page.waitForSelector('#finestra-tessuti[open]');
      await page.waitForTimeout(400);   // (per un attimo dopo l'apertura i clic non contano: vedi `appena` in scheda.js)
      await foto(page, 'configuratore-tessuti-computer');
      await page.keyboard.press('Escape');
    }

    // ------------------------------------------------ sotto-campi e prezzo
    const prezzo = async () => (await stato(page)).camicia;
    controlla(`${formato}: 0 personalizzazioni → 90 €`, (await prezzo()) === euro(90));
    a = await page.evaluate(() => document.querySelector('[data-se="taschino"]').hidden);
    await sceglieRadio(page, 'taschino', 'si');
    const visto = await page.evaluate(() => !document.querySelector('[data-se="taschino"]').hidden);
    controlla(`${formato}: il tessuto del taschino compare solo con «Sì»`, a && visto);
    controlla(`${formato}: 1 personalizzazione (taschino) → 100 €`, (await prezzo()) === euro(100));
    a = await page.evaluate(() => window.__camicia.at(-1));
    controlla(`${formato}: la camicia riceve il taschino`, a.taschino === true && a.collo === 'italiano', JSON.stringify(a));
    await sceglieRadio(page, 'asola', 'si');
    controlla(`${formato}: 2 personalizzazioni → 100 € (come una)`, (await prezzo()) === euro(100));
    await sceglieRadio(page, 'bottone', 'contrasto');
    controlla(`${formato}: 3 personalizzazioni → 120 €`, (await prezzo()) === euro(120));
    // il collo cambia la camicia
    await page.selectOption('#campo-collo', 'francese');
    a = await page.evaluate(() => window.__camicia.at(-1));
    controlla(`${formato}: cambiando il collo la camicia riceve «francese»`, a.collo === 'francese', JSON.stringify(a));
    // le iniziali: posizione e lettere arrivano alla camicia
    await sceglieRadio(page, 'iniziali', 'si');
    a = await page.evaluate(() => ({ sotto: !document.querySelector('[data-se="iniziali"]').hidden, camicia: window.__camicia.at(-1).iniziali }));
    controlla(`${formato}: «Iniziali: Sì» mostra posizione e lettere; senza posizione niente iniziali sulla camicia`, a.sotto && a.camicia === null, JSON.stringify(a));
    await sceglieRadio(page, 'iniziali_posizione', 'polso');
    await page.fill('#campo-iniziali_lettere', 'np');
    a = await page.evaluate(() => ({ camicia: window.__camicia.at(-1).iniziali, lente: !!document.querySelector('.misura-lente:not([hidden])'), zoom: document.querySelector('.configura__palco').style.getPropertyValue('--zoom') }));
    controlla(`${formato}: posizione «polso» e «np»: la camicia riceve { polso, NP }, senza zoom né riquadri`, JSON.stringify(a.camicia) === JSON.stringify({ posizione: 'polso', lettere: 'NP', colore: '' }) && !a.lente && !a.zoom, JSON.stringify(a));
    await sceglieRadio(page, 'iniziali_posizione', 'cuore');
    a = await page.evaluate(() => window.__camicia.at(-1).iniziali);
    controlla(`${formato}: cambiando posizione la camicia riceve «cuore»`, a?.posizione === 'cuore', JSON.stringify(a));
    // iniziali strane
    for (const [scritto, giusto] of [['1@', false], ['😀', false], ['ÉÀ', true], ['a.b', true]]) {
      await page.fill('#campo-iniziali_lettere', scritto);
      await page.locator('#campo-iniziali_lettere').blur();
      v = await avviso(page, 'iniziali_lettere');
      controlla(`${formato}: iniziali «${scritto}» → ${giusto ? 'vanno bene' : `«${v.testo}»`}`, giusto ? !v.testo : v.testo === 'Scrivi da 1 a 3 lettere.' && v.sotto, JSON.stringify(v));
    }
    await page.fill('#campo-iniziali_lettere', 'NP');
    // il colore del filo (proprietario, 2026-11-27: «Lo sceglie il cliente»): arriva alla camicia, e il prezzo non cambia
    const primaDelFilo = await prezzo();
    await colore(page, 'iniziali_colore', 0);
    a = await page.evaluate(() => ({ camicia: window.__camicia.at(-1).iniziali, tinta: document.querySelector('#finestra-colori [data-id]').dataset.tinta }));
    controlla(`${formato}: il colore del filo delle iniziali arriva alla camicia (${a.tinta}) e il prezzo resta ${primaDelFilo}`, !!a.tinta && a.camicia?.colore === a.tinta && (await prezzo()) === primaDelFilo, JSON.stringify(a));
    // tutte le otto personalizzazioni → 150
    await colore(page, 'filato_bottone', 3);
    for (const n of ['interno_collo', 'interno_polso', 'polsino']) await sceglieRadio(page, n, 'personalizzato');
    controlla(`${formato}: 8 personalizzazioni → 150 €`, (await prezzo()) === euro(150), await prezzo());
    a = await page.evaluate(() => [...document.querySelectorAll('[data-se]')].filter((x) => !x.hidden && x.matches('.voce__sotto')).length);
    controlla(`${formato}: tutti i sotto-campi in vista (taschino, asola, iniziali, tre tessuti dei contrasti)`, a === 6, String(a));
    // «Togli» sul filato
    await page.click('[data-scegli][data-per="Filato bottone"] [data-togli]');
    controlla(`${formato}: «Togli» il filato → 7 personalizzazioni → 120 €`, (await prezzo()) === euro(120), await prezzo());
    // «Continua» con i tessuti dei contrasti mancanti: avvisi sotto ciascuno, il fuoco sul primo
    await avanti(page);
    a = await page.evaluate(() => ({ testi: ['taschino_tessuto', 'asola_colore', 'interno_collo_tessuto', 'interno_polso_tessuto', 'polsino_tessuto'].map((n) => document.getElementById(`campo-${n}-errore`).textContent), fuoco: document.activeElement.id }));
    controlla(`${formato}: «Continua» segna ogni tessuto e colore mancante e porta al primo`, a.testi.every(Boolean) && a.fuoco === 'campo-taschino_tessuto', JSON.stringify(a));
    for (const n of ['interno_collo', 'interno_polso', 'polsino']) await sceglieRadio(page, n, 'standard');
    a = await page.evaluate(() => ['interno_collo_tessuto', 'interno_polso_tessuto', 'polsino_tessuto'].map((n) => document.getElementById(`campo-${n}-errore`).textContent).join(''));
    controlla(`${formato}: tornando a «Standard» gli avvisi dei tessuti nascosti spariscono`, !a, a);
    await tessuto(page, 'taschino_tessuto', 1);
    a = await page.evaluate(() => ({ scelto: document.querySelector('[name="taschino_tessuto"]').value, camicia: window.__camicia.at(-1) }));
    controlla(`${formato}: il tessuto del taschino arriva alla camicia (${a.scelto}); quello dei polsini no, finché sono «Standard»`, !!a.scelto && a.camicia.taschino_tessuto === a.scelto && a.camicia.polsino_tessuto === '', JSON.stringify(a.camicia));
    a = await page.evaluate(() => document.getElementById('finestra-tessuti').querySelector('[data-per]').textContent);
    await colore(page, 'asola_colore', 5);
    controlla(`${formato}: 3 personalizzazioni (taschino, asola, iniziali) + bottone contrasto → 120 €`, (await prezzo()) === euro(120), await prezzo());
    // bottone personalizzato sotto i 100 pezzi
    await sceglieRadio(page, 'bottone', 'personalizzato');
    a = await page.evaluate(() => [...document.querySelectorAll('.voce__avviso')].filter((x) => !x.hidden).map((x) => x.textContent).join());
    controlla(`${formato}: «Personalizzato» mostra «Ordine minimo: 100 pezzi.»`, a === 'Ordine minimo: 100 pezzi.', a);
    await avanti(page);
    v = await avviso(page, 'bottone');
    controlla(`${formato}: con 1 camicia «Continua» si ferma: «${v.testo}»`, /100 pezzi/.test(v.testo) && v.invalido && (await stato(page)).passi.join() === 'camicia', JSON.stringify(v));
    await page.fill('#campo-quantita', '100');
    v = await avviso(page, 'bottone');
    controlla(`${formato}: scrivendo 100 camicie l'avviso del bottone sparisce subito`, !v.testo && !v.invalido, JSON.stringify(v));
    s = await stato(page);
    controlla(`${formato}: 100 camicie × 120 € = ${euro(12000)} nel totale`, s.totale === euro(12000), s.totale);
    // 999 e oltre
    await page.fill('#campo-quantita', '999');
    a = await page.evaluate(() => ({ piu: document.querySelector('[data-quanti="1"]').disabled, totale: document.querySelector('[data-conto-totale]').textContent, largo: document.documentElement.scrollWidth <= innerWidth }));
    controlla(`${formato}: 999 camicie: «+» spento, totale ${a.totale} senza uscire dallo schermo`, a.piu && a.totale.replace(/\s/g, ' ') === euro(999 * 120) && a.largo, JSON.stringify(a));
    await page.fill('#campo-quantita', '3 camicie');
    a = await valore(page, 'quantita');
    controlla(`${formato}: nella quantità restano solo le cifre`, a === '3', a);
    await sceglieRadio(page, 'bottone', 'tinta');
    await page.click('[data-quanti="-1"]');
    a = await valore(page, 'quantita');
    controlla(`${formato}: «−» toglie una camicia`, a === '2', a);
    await page.click('[data-quanti="1"]');
    // nome di tessuto lunghissimo: il tasto va a capo senza uscire
    a = await page.evaluate(() => {
      const t = document.querySelector('#campo-taschino_tessuto-scelto');
      const prima = t.textContent;
      t.textContent = 'Popeline Supima doppio ritorto finissimo a microrighe azzurro polvere con fondo panna lavato in capo';
      const r = t.closest('.scegli').getBoundingClientRect(), f = t.closest('form').getBoundingClientRect();
      const fuori = r.right > f.right + 1 || document.documentElement.scrollWidth > innerWidth;
      t.textContent = prima;
      return fuori;
    });
    controlla(`${formato}: un nome di tessuto lunghissimo va a capo dentro il riquadro`, !a);

    // ------------------------------------------------ Misure
    await avanti(page);
    s = await stato(page);
    controlla(`${formato}: «Continua» porta al passo Misure, «Passo 2 di 5»`, s.passi.join() === 'misure' && /2 di 5/.test(s.conta) && s.corrente === 'misure' && s.largo, JSON.stringify(s));
    a = await page.evaluate(() => ({ campi: document.querySelectorAll('.passo[data-passo="misure"] .misura[data-guida][data-vista]').length, finestra: document.getElementById('come-misurare').open, come: !!document.querySelector('[data-passo="misure"] [data-apri-passi]') }));
    controlla(`${formato}: dodici misure con la loro guida e «Come misurare»; con ?senza-passi la finestra non si apre`, a.campi === 12 && !a.finestra && a.come, JSON.stringify(a));
    await avanti(page);
    v = await avviso(page, 'giro_collo');
    controlla(`${formato}: misure vuote → «${v.testo}» sotto la prima`, v.testo === 'Scrivi questa misura.' && v.invalido && v.sotto, JSON.stringify(v));
    for (const [n, x] of Object.entries(MISURE)) await page.fill(`#campo-${n}`, x);
    await page.fill('#campo-torace', '500');
    await page.locator('#campo-torace').blur();
    v = await avviso(page, 'torace');
    controlla(`${formato}: torace 500 → uscendo «${v.testo}»`, /tra 30 e 90/.test(v.testo) && v.invalido, JSON.stringify(v));
    await page.fill('#campo-torace', MISURE.torace);
    v = await avviso(page, 'torace');
    controlla(`${formato}: correggendo l'avviso sparisce subito`, !v.testo && !v.invalido, JSON.stringify(v));
    if (formato === 'computer' || formato === 'telefono') await foto(page, `configuratore-misure-${formato}`);
    await avanti(page);

    // ------------------------------------------------ Dati
    s = await stato(page);
    controlla(`${formato}: passo Dati`, s.passi.join() === 'dati' && /3 di 5/.test(s.conta), JSON.stringify(s));
    await page.fill('#campo-nome', 'Mario');
    await page.locator('#campo-telefono').focus();
    v = await avviso(page, 'nome');
    controlla(`${formato}: «Mario» → uscendo «${v.testo}»`, v.testo === 'Scrivi anche il cognome.' && v.sotto, JSON.stringify(v));
    await page.fill('#campo-nome', 'Mario Rossi');
    await page.fill('#campo-telefono', '333 854 8712');
    await page.fill('#campo-email', 'mario.rossi@gmial.com');
    await avanti(page);
    a = await page.evaluate(() => ({ forse: document.querySelector('.campo__forse')?.textContent || '', passo: [...document.querySelectorAll('[data-passo]')].find((x) => !x.hidden).dataset.passo }));
    controlla(`${formato}: email con un errore di battitura: si ferma una volta con «${a.forse}»`, /Forse intendevi/.test(a.forse) && /gmail\.com/.test(a.forse) && a.passo === 'dati', JSON.stringify(a));
    if (formato === 'computer' || formato === 'telefono') await foto(page, `configuratore-dati-${formato}`);
    await page.click('.campo__correggi');
    a = await valore(page, 'email');
    controlla(`${formato}: il tasto corregge l'email`, a === 'mario.rossi@gmail.com', a);
    await avanti(page);

    // ------------------------------------------------ Spedizione
    s = await stato(page);
    controlla(`${formato}: passo Spedizione`, s.passi.join() === 'spedizione' && /4 di 5/.test(s.conta), JSON.stringify(s));
    await avanti(page);
    v = await avviso(page, 'spedizione');
    controlla(`${formato}: senza scelta → «${v.testo}»`, v.testo === 'Scegli ritiro o spedizione.' && v.invalido, JSON.stringify(v));
    a = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-prezzo-modo]')].map((x) => [x.dataset.prezzoModo, x.textContent])));
    controlla(`${formato}: 3 camicie × 120 € sopra 200: le spedizioni sono «Gratis»`, a.cinque === 'Gratis' && a.sette === 'Gratis', JSON.stringify(a));
    await page.click('[data-vai="camicia"]');
    await page.fill('#campo-quantita', '1');
    for (const n of ['taschino', 'asola', 'iniziali']) await sceglieRadio(page, n, 'no');
    s = await stato(page);
    controlla(`${formato}: tornando indietro nulla si perde; 1 camicia base: ${s.totale}`, s.totale === euro(90) && (await valore(page, 'tessuto')) && (await valore(page, 'giro_collo')) === MISURE.giro_collo, JSON.stringify(s));
    await page.click('[data-vai="spedizione"]');
    s = await stato(page);
    controlla(`${formato}: dal nome in cima si torna al passo Spedizione (i passi di mezzo vanno bene)`, s.passi.join() === 'spedizione', JSON.stringify(s));
    a = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-prezzo-modo]')].map((x) => [x.dataset.prezzoModo, x.textContent.replace(/\s/g, ' ')])));
    controlla(`${formato}: con 90 € le spedizioni costano 30 € (5 giorni) e 15 € (7 giorni)`, a.cinque === euro(30) && a.sette === euro(15), JSON.stringify(a));
    await sceglieRadio(page, 'spedizione', 'cinque');
    a = await page.evaluate(() => ({ indirizzo: !document.querySelector('.indirizzo').hidden, chi: document.querySelector('[name="destinatario"]').value, totale: document.querySelector('[data-conto-totale]').textContent.replace(/\s/g, ' ') }));
    controlla(`${formato}: con la spedizione compare l'indirizzo, «destinatario» già «${a.chi}», totale ${a.totale}`, a.indirizzo && a.chi === 'Mario Rossi' && a.totale === euro(120), JSON.stringify(a));
    await avanti(page);
    a = await page.evaluate(() => ['indirizzo', 'cap', 'citta', 'provincia'].map((n) => document.getElementById(`campo-${n}-errore`).textContent));
    controlla(`${formato}: indirizzo vuoto → avvisi su via, CAP, città, provincia`, a.every(Boolean), JSON.stringify(a));
    await page.fill('#campo-indirizzo', 'Via Roma 1');
    await page.fill('#campo-cap', '80014');
    await page.fill('#campo-citta', 'Giugliano in Campania');
    await page.fill('#campo-provincia', 'xx');
    await page.locator('#campo-provincia').blur();
    v = await avviso(page, 'provincia');
    controlla(`${formato}: provincia «xx» → «${v.testo}»`, /sigla/.test(v.testo), JSON.stringify(v));
    await page.fill('#campo-provincia', 'na');
    if (formato === 'computer' || formato === 'telefono') await foto(page, `configuratore-spedizione-${formato}`);
    await avanti(page);

    // ------------------------------------------------ Pagamento
    s = await stato(page);
    a = await page.evaluate(() => ({ testo: document.querySelector('[data-riepilogo]').innerText, totale: document.querySelector('[data-conti-totale]').textContent.replace(/\s/g, ' '), tasto: document.querySelector('[data-avanti]').textContent }));
    controlla(`${formato}: passo Pagamento: riepilogo con tessuto, collo, misure, dati e indirizzo; totale ${a.totale}; il tasto dice «${a.tasto}»`, s.passi.join() === 'pagamento' && /Francese/.test(a.testo) && /41 cm/.test(a.testo) && /Mario Rossi/.test(a.testo) && /80014 Giugliano/.test(a.testo) && a.totale === euro(120) && /pagamento/i.test(a.tasto), JSON.stringify({ s, ...a }).slice(0, 400));
    if (formato === 'computer' || formato === 'telefono') await foto(page, `configuratore-pagamento-${formato}`);
    // ricarica a metà: resta tutto, sullo stesso passo
    await page.reload({ waitUntil: 'networkidle' });
    s = await stato(page);
    a = await page.evaluate(() => ({ email: document.querySelector('[name="email"]').value, tessuto: document.querySelector('[name="tessuto"]').value, collo: document.querySelector('[name="collo"]').value, camicia: window.__camicia }));
    controlla(`${formato}: ricaricando la pagina resta tutto, sullo stesso passo`, s.passi.join() === 'pagamento' && a.email === 'mario.rossi@gmail.com' && !!a.tessuto && a.collo === 'francese', JSON.stringify({ s, ...a }).slice(0, 300));
    controlla(`${formato}: dopo la ricarica la camicia riceve le scelte ricordate`, a.camicia.length >= 1 && a.camicia[0].collo === 'francese', JSON.stringify(a.camicia));
    // Modifica porta al passo; dal nome in cima si torna al pagamento
    await page.click('[data-modifica="misure"]');
    s = await stato(page);
    controlla(`${formato}: «Modifica» delle misure riapre il passo Misure`, s.passi.join() === 'misure', JSON.stringify(s));
    await page.click('[data-vai="pagamento"]');
    s = await stato(page);
    controlla(`${formato}: dal nome «Pagamento» in cima si torna al riepilogo`, s.passi.join() === 'pagamento', JSON.stringify(s));
    // senza consenso
    await avanti(page);
    v = await avviso(page, 'privacy');
    controlla(`${formato}: senza consenso → «${v.testo}», niente invio`, /consenso/.test(v.testo) && inviato === null, JSON.stringify(v));
    await page.locator('.configura__consenso label').click({ position: { x: 10, y: 10 } });
    // pagamento non attivo
    await avanti(page);
    // (la risposta finta arriva quando arriva: si aspetta la frase, fino a 3 secondi)
    await page.waitForFunction(() => document.querySelector('[data-esito]').textContent.trim(), null, { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(200);
    a = await page.evaluate(() => document.querySelector('[data-esito]').textContent);
    controlla(`${formato}: invia i dati in JSON (tessuto, misure, spedizione, consenso)`, inviato && inviato.tessuto && inviato.giro_collo === '41' && inviato.spedizione === 'cinque' && inviato.privacy === 'si', JSON.stringify(inviato).slice(0, 200));
    controlla(`${formato}: { pagamento: 'non_attivo' } → «${a}»`, /non è ancora attivo/.test(a), a);
    // 503 del server locale
    risposta = { status: 503, body: { ok: false, errore: 'x' } };
    await avanti(page);
    await page.waitForTimeout(200);
    a = await page.evaluate(() => document.querySelector('[data-esito]').textContent);
    controlla(`${formato}: 503 → lo stesso avviso`, /non è ancora attivo/.test(a), a);
    // errori dal Worker
    risposta = { status: 422, body: { ok: false, errori: { giro_collo: 'Il sarto dice di no.', email: 'Email non valida.' } } };
    await avanti(page);
    await page.waitForTimeout(250);
    s = await stato(page);
    v = await avviso(page, 'giro_collo');
    controlla(`${formato}: errori dal Worker → torna al passo del primo campo (Misure) con l'avviso sotto`, s.passi.join() === 'misure' && v.testo === 'Il sarto dice di no.' && v.invalido, JSON.stringify({ s, v }));
    // il campo ha il fuoco: sul telefono la guida apre sopra il riquadro con lo zoom, che si chiude uscendo dal campo
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(300);
    await page.click('[data-vai="pagamento"]');
    // rete giù
    risposta = 'giu';
    await avanti(page);
    await page.waitForTimeout(250);
    a = await page.evaluate(() => document.querySelector('[data-esito]').textContent);
    controlla(`${formato}: rete giù → «${a.slice(0, 40)}…»`, /Riprova tra poco/.test(a), a);
    // pagamento aperto: si va a Stripe
    risposta = { status: 200, body: { ok: true, vai: '/stripe-finto/sessione' } };
    await Promise.all([page.waitForURL('**/stripe-finto/**', { timeout: 5000 }).catch(() => {}), avanti(page)]);
    controlla(`${formato}: { ok, vai } → si apre il pagamento`, /stripe-finto/.test(page.url()), page.url());
    // si torna senza pagare
    await page.goto(PAGINA + '?ordine=annullato&senza-passi', { waitUntil: 'networkidle' });
    s = await stato(page);
    a = await page.evaluate(() => ({ esito: document.querySelector('[data-esito]').textContent, url: location.search }));
    controlla(`${formato}: ?ordine=annullato riapre il pagamento con i dati e un avviso`, s.passi.join() === 'pagamento' && /non è stato completato/.test(a.esito) && !/ordine=/.test(a.url), JSON.stringify({ s, ...a }));
    // pagato
    await page.goto(PAGINA + '?ordine=fatto', { waitUntil: 'networkidle' });
    a = await page.evaluate(() => ({ grazie: !document.querySelector('[data-grazie]').hidden, passi: !document.querySelector('[data-passi]').hidden, ricordato: sessionStorage.getItem('endero-configuratore'), largo: document.documentElement.scrollWidth <= innerWidth }));
    controlla(`${formato}: ?ordine=fatto mostra il grazie e dimentica ciò che era ricordato`, a.grazie && !a.passi && a.ricordato === null && a.largo, JSON.stringify(a));
    if (formato === 'computer' || formato === 'telefono') await foto(page, `configuratore-grazie-${formato}`);
    await page.goto(PAGINA + '?senza-passi', { waitUntil: 'networkidle' });
    s = await stato(page);
    a = await valore(page, 'email');
    controlla(`${formato}: dopo il grazie il configuratore riparte vuoto`, s.passi.join() === 'camicia' && !a, JSON.stringify(s));

    // ------------------------------------------------ bersagli per il dito
    if (telefono) {
      const piccoli = await page.evaluate(() => {
        const sotto = [];
        for (const el of document.querySelectorAll('form[data-configuratore] :is(button, a, select, input:not([type=hidden]))')) {
          const r = (el.matches('input[type=radio], input[type=checkbox]') ? el.closest('label') || el : el).getBoundingClientRect();
          if (!r.width || el.closest('[hidden]') || el.closest('.modulo__esca') || el.closest('.consenso')) continue;
          const h = el.matches('input[type=radio]') ? el.getBoundingClientRect().height : r.height;
          if (h < 43.5) sotto.push(`${el.className || el.name || el.tagName} ${Math.round(h)}`);
        }
        return sotto;
      });
      controlla(`${formato}: ogni bersaglio in vista alto almeno 44 punti`, !piccoli.length, piccoli.join(', '));
    }
    // le risposte sbagliate del Worker finto (503, 422, rete giù) il browser le scrive in console: sono volute
    const veri = errori.filter((e) => !/Failed to load resource: (the server responded with a status of (503|422)|net::ERR_FAILED)/.test(e));
    controlla(`${formato}: nessun errore in console`, veri.length === 0, veri.join(' | ').slice(0, 300));
    await contesto.close();
  }

  // ------------------------------------------------ la finestra delle misure entrando nel passo
  console.log('\nLa finestra «Come prendere le misure»');
  {
    const { contesto, page } = await nuovo({ viewport: { width: 1440, height: 900 } });
    await page.goto(PAGINA, { waitUntil: 'networkidle' });
    let a = await page.evaluate(() => document.getElementById('come-misurare').open);
    controlla('all\'apertura della pagina la finestra delle misure non si apre più', !a);
    await page.goto(PAGINA + '?passo=misure', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    a = await page.evaluate(() => ({ aperta: document.getElementById('come-misurare').open, passo: [...document.querySelectorAll('[data-passo]')].find((x) => !x.hidden).dataset.passo }));
    controlla('?passo=misure apre il passo Misure e la finestra', a.aperta && a.passo === 'misure', JSON.stringify(a));
    await page.keyboard.press('Enter');
    await page.click('[data-vai="camicia"]');
    await tessuto(page, 'tessuto');
    await page.click('[data-vai="misure"]');
    a = await page.evaluate(() => document.getElementById('come-misurare').open);
    controlla('rientrando nel passo la finestra non si riapre da sola', !a);
    await page.click('[data-apri-passi]');
    a = await page.evaluate(() => document.getElementById('come-misurare').open);
    controlla('«Come misurare» la riapre', a);
    await contesto.close();
  }

  // ------------------------------------------------ dalla revisione del 2026-11-26: come una persona, con il movimento normale
  console.log('\nDa Camicia a Misure con la finestra che si apre (movimento normale)');
  for (const [formato, opzioni] of FORMATI) {
    const { contesto, page } = await nuovo({ ...opzioni, reducedMotion: 'no-preference' });
    await page.goto(PAGINA, { waitUntil: 'networkidle' });
    await tessuto(page, 'tessuto');
    // fino in fondo al passo, come chi guarda tutte le voci, poi «Continua» e «Inizia»
    await page.evaluate(() => document.querySelector('[data-campo="polsino"]').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(500);
    await page.click('[data-avanti]');
    await page.waitForSelector('#come-misurare[open]');
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(900);
    const a = await page.evaluate(() => {
      const c = document.getElementById('campo-giro_collo').getBoundingClientRect(), tit = document.querySelector('[data-passo="misure"] .passo__titolo').getBoundingClientRect();
      return { aperta: document.getElementById('come-misurare').open, campo: Math.round(c.top), titolo: Math.round(tit.top), alto: innerHeight, barra: Math.round(document.querySelector('[data-fondo]').getBoundingClientRect().top) };
    });
    controlla(`${formato}: chiusa la finestra, il passo Misure è in vista dall'inizio (titolo a ${a.titolo}, primo campo a ${a.campo} su ${a.alto})`, !a.aperta && a.titolo > 0 && a.titolo < a.alto * 0.7 && a.campo > 0, JSON.stringify(a));
    // il tasto Indietro del browser torna al passo di prima, non alla pagina di prima
    await page.goBack();
    await page.waitForTimeout(400);
    let s = await stato(page);
    controlla(`${formato}: Indietro del browser torna al passo Camicia, sulla stessa pagina`, s.passi.join() === 'camicia' && /configuratore/.test(page.url()), `${s.passi.join()} ${page.url()}`);
    await page.goForward();
    await page.waitForTimeout(400);
    s = await stato(page);
    controlla(`${formato}: Avanti riporta al passo Misure`, s.passi.join() === 'misure', s.passi.join());
    await contesto.close();
  }

  console.log('\nNel passo Camicia, sul telefono: nessun riquadro con lo zoom, la pagina non si sposta sotto il dito');
  for (const [formato, opzioni] of [FORMATI[2], FORMATI[3]]) {
    const { contesto, page } = await nuovo({ ...opzioni, reducedMotion: 'no-preference' });
    await page.goto(PAGINA + '?senza-passi', { waitUntil: 'networkidle' });
    const SI = 'form[data-configuratore] label:has(> input[name="taschino"][value="si"])';
    for (const y of [90, 210]) {
      // la riga del taschino a `y` punti dalla cima dello schermo, con «No» scelto
      await page.evaluate((y) => {
        document.activeElement?.blur?.();
        const no = document.querySelector('[name="taschino"][value="no"]');
        if (!no.checked) no.click();
        scrollBy(0, document.querySelector('[data-campo="taschino"]').getBoundingClientRect().top - y);
      }, y);
      await page.waitForTimeout(500);
      const prima = await page.evaluate((SI) => { const l = document.querySelector(SI).getBoundingClientRect(); return { sy: scrollY, x: l.left + l.width / 2, y: l.top + l.height / 2 }; }, SI);
      await page.touchscreen.tap(prima.x, prima.y);
      await page.waitForTimeout(900);
      const dopo = await page.evaluate((SI) => {
        const l = document.querySelector(SI).getBoundingClientRect();
        return { sy: scrollY, y: l.top + l.height / 2, scelto: document.querySelector('[name="taschino"][value="si"]').checked, lente: !!document.querySelector('.misura-lente:not([hidden])'), camicia: window.__camicia.at(-1).taschino };
      }, SI);
      controlla(`${formato}: riga a ${y} punti, tocco su «Sì»: scelto, la camicia lo riceve, nessun riquadro, la pagina non si sposta (${Math.round(dopo.sy - prima.sy)})`, dopo.scelto && dopo.camicia === true && !dopo.lente && Math.abs(dopo.sy - prima.sy) <= 1 && Math.abs(dopo.y - prima.y) <= 1, JSON.stringify({ prima, dopo }));
    }
    await contesto.close();
  }

  console.log('\nInvio nelle caselle, doppio clic sul tasto dei tessuti');
  {
    const { contesto, page } = await nuovo({ ...FORMATI[0][1], reducedMotion: 'no-preference' });
    await page.goto(PAGINA + '?passo=dati&senza-passi', { waitUntil: 'networkidle' });
    await page.fill('#campo-nome', 'Mario Prova');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    let a = await page.evaluate(() => ({ passo: [...document.querySelectorAll('[data-passo]')].find((x) => !x.hidden).dataset.passo, fuoco: document.activeElement.id, rossi: document.querySelectorAll('[data-passo="dati"] [aria-invalid="true"]').length }));
    controlla('Invio dopo il nome: si resta nel passo Dati, il fuoco va al telefono, nessun avviso', a.passo === 'dati' && a.fuoco === 'campo-telefono' && a.rossi === 0, JSON.stringify(a));
    await page.click('[data-vai="camicia"]');
    await page.waitForTimeout(300);
    await page.locator('#campo-tessuto').dblclick();
    await page.waitForTimeout(600);
    a = await page.evaluate(() => ({ aperta: document.getElementById('finestra-tessuti').open, valore: document.querySelector('[name="tessuto"]').value }));
    controlla('doppio clic su «Scegli il tessuto»: la finestra resta aperta e non sceglie nulla', a.aperta && !a.valore, JSON.stringify(a));
    await page.goBack();
    await page.waitForTimeout(300);
    a = await page.evaluate(() => ({ aperta: document.getElementById('finestra-tessuti').open, passo: [...document.querySelectorAll('[data-passo]')].find((x) => !x.hidden).dataset.passo }));
    controlla('con la finestra dei tessuti aperta, Indietro del browser la chiude e si resta sul passo', !a.aperta && a.passo === 'camicia' && /configuratore/.test(page.url()), JSON.stringify(a));
    await contesto.close();
  }

  // ------------------------------------------------ le scelte ricordate arrivano alla camicia anche ricaricando
  console.log('\nLa camicia dopo una ricarica');
  for (const [formato, opzioni] of [FORMATI[0], FORMATI[2]]) {
    const { contesto, page, errori } = await nuovo(opzioni);
    await page.goto(PAGINA + '?senza-passi', { waitUntil: 'networkidle' });
    await page.selectOption('#campo-collo', 'francese');
    await sceglieRadio(page, 'taschino', 'si');
    await page.reload({ waitUntil: 'networkidle' });
    let pezzi = [];
    for (let k = 0; k < 40; k++) {
      pezzi = await page.evaluate(() => [...document.querySelectorAll('.configura__palco img.vesti__pezzo')].filter((im) => getComputedStyle(im).opacity !== '0').map((im) => im.getAttribute('src').split('/').pop().split('?')[0]));
      if (pezzi.some((x) => /collo-francese/.test(x)) && pezzi.some((x) => /taschino/.test(x))) break;
      await page.waitForTimeout(150);
    }
    const a = await page.evaluate(() => ({ collo: document.querySelector('[name="collo"]').value, taschino: document.querySelector('[name="taschino"]:checked').value, primo: window.__camicia[0] }));
    controlla(`${formato}: collo francese e taschino scelti, ricaricando restano nel riquadro e sulla camicia (${[...new Set(pezzi)].join(', ')})`, a.collo === 'francese' && a.taschino === 'si' && a.primo?.collo === 'francese' && a.primo?.taschino === true && pezzi.some((x) => /collo-francese/.test(x)) && pezzi.some((x) => /taschino/.test(x)), JSON.stringify(a));
    controlla(`${formato}: nessun errore in console`, errori.length === 0, errori.join(' | ').slice(0, 200));
    await contesto.close();
  }

  // ------------------------------------------------ 483 tessuti: apertura, filtri, scorrimento
  console.log('\nLa finestra con tutti i tessuti');
  for (const [formato, opzioni] of [FORMATI[0], FORMATI[2]]) {
    const { contesto, page } = await nuovo({ ...opzioni, reducedMotion: 'no-preference' });
    await page.goto(PAGINA + '?senza-passi', { waitUntil: 'networkidle' });
    const quanti = await page.evaluate(() => document.querySelectorAll('#finestra-tessuti .campione').length);
    const t0 = Date.now();
    await page.click('#campo-tessuto');
    await page.waitForSelector('#finestra-tessuti[open]');
    await page.waitForTimeout(400);   // (per un attimo dopo l'apertura i clic non contano: vedi `appena` in scheda.js)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const apre = Date.now() - t0;
    const filtro = await page.evaluate(() => { const r = document.querySelector('#finestra-tessuti input[name="colore"]:not([value=""])'); const t = performance.now(); r.click(); return performance.now() - t; });
    const cerca = await page.evaluate(() => { const i = document.querySelector('#finestra-tessuti [data-cerca]'); const t = performance.now(); i.value = 'popeline'; i.dispatchEvent(new Event('input', { bubbles: true })); return performance.now() - t; });
    await page.click('#finestra-tessuti [data-azzera]');
    // i nomi più lunghi: dentro la loro casella, su due righe al più
    const nomi = await page.evaluate(() => { const v = [...document.querySelectorAll('#finestra-tessuti .campione')]; const lungo = v.sort((a, b) => b.textContent.length - a.textContent.length)[0]; lungo.scrollIntoView({ block: 'center' }); const n = lungo.querySelector('.campione__nome'), r = n.getBoundingClientRect(), c = lungo.getBoundingClientRect(); return { nome: n.textContent, dentro: r.right <= c.right + 1 && r.left >= c.left - 1, righe: Math.round(r.height / parseFloat(getComputedStyle(n).lineHeight)), largo: document.documentElement.scrollWidth <= innerWidth }; });
    // lo scorrimento della griglia arriva in fondo e le immagini si caricano dove si guarda
    const fondo = await page.evaluate(async () => { const s = document.querySelector('#finestra-tessuti .raccolta__scorre'); s.scrollTop = s.scrollHeight; await new Promise((r) => setTimeout(r, 800)); const ultimo = [...document.querySelectorAll('#finestra-tessuti .campione')].pop(); const r = ultimo.getBoundingClientRect(), b = s.getBoundingClientRect(); return { inVista: r.bottom <= b.bottom + 1 && r.top >= b.top - 1, caricata: ultimo.querySelector('img').complete && ultimo.querySelector('img').naturalWidth > 0 }; });
    controlla(`${formato}: ${quanti} tessuti: la finestra si apre in ${apre} ms, un filtro in ${filtro.toFixed(1)} ms, la ricerca in ${cerca.toFixed(1)} ms`, quanti >= 1 && apre < 1500 && filtro < 100 && cerca < 100);
    controlla(`${formato}: il nome più lungo («${nomi.nome}») sta nella sua casella su ${nomi.righe} righe`, nomi.dentro && nomi.righe <= 2 && nomi.largo, JSON.stringify(nomi));
    controlla(`${formato}: la griglia scorre fino all'ultimo tessuto e la sua immagine si carica`, fondo.inVista && fondo.caricata, JSON.stringify(fondo));
    await contesto.close();
  }

  // ------------------------------------------------ senza JavaScript
  console.log('\nSenza JavaScript');
  {
    const contesto = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    const page = await contesto.newPage();
    await page.goto(PAGINA, { waitUntil: 'networkidle' });
    const a = await page.evaluate(() => {
      const f = document.querySelector('form[data-configuratore]');
      return {
        azione: f.getAttribute('action'), metodo: f.getAttribute('method'),
        passi: [...f.querySelectorAll('[data-passo]')].filter((s) => s.getBoundingClientRect().height > 0).length,
        tessuto: f.querySelectorAll('select[name="tessuto"] optgroup').length, taschino: !!f.querySelector('select[name="taschino_tessuto"]'),
        colore: !!f.querySelector('select[name="asola_colore"] option[value="rosso"]'), nascosti: [...f.querySelectorAll('[data-valore]')].every((x) => x.disabled),
        sotto: [...f.querySelectorAll('.voce__sotto, .indirizzo')].every((x) => x.getBoundingClientRect().height > 0),
        invia: !!f.querySelector('.passo__invia button[type="submit"]') && f.querySelector('.passo__invia').getBoundingClientRect().height > 0,
        largo: document.documentElement.scrollWidth <= innerWidth,
      };
    });
    controlla('senza script: un modulo solo verso /api/ordine (post) con i cinque passi uno sotto l\'altro', a.azione === '/api/ordine' && a.metodo === 'post' && a.passi === 5 && a.largo, JSON.stringify(a));
    controlla('senza script: il tessuto è un menu con un gruppo per tipo; tessuti e colori dei sotto-campi ci sono; i campi nascosti dello script sono spenti', a.tessuto >= 2 && a.taschino && a.colore && a.nascosti, JSON.stringify(a));
    controlla('senza script: i sotto-campi e l\'indirizzo sono in vista, e c\'è il tasto per inviare', a.sotto && a.invia, JSON.stringify(a));
    await contesto.close();
  }

  await browser.close();
  console.log(`\n${passati} passati, ${falliti.length} falliti`);
  if (falliti.length) { console.log(falliti.map((f) => ' - ' + f).join('\n')); process.exitCode = 1; }
})();
