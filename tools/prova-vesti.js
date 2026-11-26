// Controlla la camicia che cambia con le scelte del riquadro (src/configuratore/vesti.js, punto 16 della direzione
// creativa): il collo scelto, il taschino e le iniziali sovrapposti alla camicia su ogni livello (immagine ferma,
// camicia che dondola, tessuto che ondeggia, camicia nitida dello zoom, riquadro del telefono), sempre al loro punto;
// lo zoom e il contorno tratteggiato della parte quando un campo con data-parte prende il fuoco, il cambio di parte
// con endero:parte, l'uscita, una finestra che si apre sopra; il movimento ridotto, un file che manca, nessun file
// scaricato finché non si sceglie nulla.
//
//   node tools/prova-vesti.js [indirizzo del sito, senza barra finale] [cartella per le schermate]
//
// In locale: node build/costruisci.mjs && node build/servi.mjs 8781. La pagina di oggi non ha ancora il riquadro
// nuovo: gli avvisi `endero:camicia` li manda questo controllo, e i campi con data-parte li aggiunge lui (finti).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const base = (process.argv[2] || 'http://127.0.0.1:8781').replace(/\/$/, '');
const schermate = process.argv[3] || '';
// sul passo Misure: ci sono i campi di misura (il giro sul retro con «spalla»), e i campi finti vanno in cima a quel passo
const PAGINA = base + '/camicie-su-misura/configuratore/?passo=misure&senza-passi&manuale';
let passati = 0;
const falliti = [];
function controlla(nome, vero, dettaglio = '') {
  if (vero) passati++; else falliti.push(nome + (dettaglio ? ` (${dettaglio})` : ''));
  console.log(`${vero ? '  ok ' : '  NO '} ${nome}${dettaglio ? ' · ' + dettaglio : ''}`);
}
/** Una schermata; il browser di prova ogni tanto rifiuta la prima («Unable to capture screenshot»): si riprova. */
const scatta = async (page, opzioni, volte = 3) => { try { return await page.screenshot(opzioni); } catch (e) { if (volte <= 1) throw e; await page.waitForTimeout(300); return scatta(page, opzioni, volte - 1); } };
const foto = async (page, nome, clip) => {
  if (!schermate) return;
  fs.mkdirSync(schermate, { recursive: true });
  await scatta(page, { path: path.join(schermate, nome + '.png'), clip });
};
const COMPUTER = [
  ['computer 1440 x 900', { viewport: { width: 1440, height: 900 } }],
  ['portatile basso 1366 x 625', { viewport: { width: 1366, height: 625 }, deviceScaleFactor: 1.25 }],
  ['computer largo 1920 x 950', { viewport: { width: 1920, height: 950 } }],
];
const TELEFONO = [
  ['telefono 390 x 844', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
  ['telefono basso 375 x 548', { viewport: { width: 375, height: 548 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['telefono di traverso 844 x 390', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
];
const TUTTO = { collo: 'francese', taschino: true, iniziali: { posizione: 'cuore', lettere: 'np' } };

// --- nella pagina
/** I campi finti del riquadro: un menu per il collo, due radio per il taschino, un menu per il posto delle iniziali. */
function campiFinti() {
  const f = document.querySelector('.configura__scheda');
  const blocco = document.createElement('div');
  blocco.className = 'finti';
  blocco.style.cssText = 'display:grid;gap:12px;margin:0 0 16px';
  blocco.innerHTML = `
    <div data-parte="collo" id="finto-collo"><label>Collo <select id="finto-collo-menu"><option>italiano</option><option>francese</option><option>club</option></select></label></div>
    <fieldset data-parte="taschino" id="finto-tasca"><legend>Taschino</legend><label><input type="radio" name="tasca" value="no" checked> No</label> <label><input type="radio" name="tasca" value="si"> Sì</label></fieldset>
    <div data-parte="iniziali_polso" id="finto-iniziali"><label>Iniziali <select id="finto-posto"><option>polso</option><option>collo</option><option>cuore</option></select></label> <button type="button" id="finto-tessuti">Tessuti</button></div>`;
  // in cima al passo in vista (dal 2026-11-26 il riquadro è a passi: «Come misurare» sta nel passo Misure, chiuso)
  (f.querySelector('.passo:not([hidden]) .passo__titolo') || f.querySelector('.configura__come')).after(blocco);
  const posto = blocco.querySelector('#finto-posto');
  posto.addEventListener('change', () => {
    const campo = blocco.querySelector('#finto-iniziali');
    campo.dataset.parte = 'iniziali_' + posto.value;
    document.dispatchEvent(new CustomEvent('endero:parte', { detail: { campo } }));
  });
  // una finestra che si apre sopra la pagina, come quella dei tessuti
  const d = document.createElement('dialog');
  d.id = 'finta-finestra';
  d.innerHTML = '<button type="button" id="finta-chiudi">Chiudi</button>';
  document.body.append(d);
  blocco.querySelector('#finto-tessuti').addEventListener('click', () => d.showModal());
  d.querySelector('#finta-chiudi').addEventListener('click', () => d.close());
}
const manda = (page, detail) => page.evaluate((d) => document.dispatchEvent(new CustomEvent('endero:camicia', { detail: d })), detail);

/**
 * Dove dovrebbero stare, sullo schermo, i punti del fotogramma sull'immagine ferma (con lo zoom, se c'è), e dove
 * stanno gli angoli dei pezzi sull'immagine ferma. Sul telefono l'immagine è il ritaglio verticale (x da 336, 750 x
 * 1000) messo con object-fit: cover e object-position: center 85%.
 */
function sullaFerma() {
  const f = document.querySelector('.configura__ferma'), r = f.getBoundingClientRect();
  const v = document.querySelector('.configura__vesti');
  const pezzi = v ? [...v.querySelectorAll('img.vesti__pezzo')].map((im) => { const q = im.getBoundingClientRect(); return { src: im.getAttribute('src'), angoli: [q.left, q.top, q.right, q.bottom], opacita: getComputedStyle(im).opacity }; }) : [];
  const testo = v?.querySelector('.vesti__iniziali text:last-child');
  const t = testo?.getBoundingClientRect();
  return {
    pezzi, telefono: f.currentSrc.includes('telefono'), ferma: [r.left, r.top, r.width, r.height],
    iniziali: t ? [(t.left + t.right) / 2, (t.top + t.bottom) / 2, testo.textContent] : null,
    visibile: v ? getComputedStyle(v).visibility === 'visible' && getComputedStyle(v).opacity === '1' : false,
  };
}
/** Da un punto del fotogramma al punto dello schermo, sull'immagine ferma misurata da sullaFerma(). */
function proietta({ telefono, ferma: [L, T, W, H] }) {
  if (!telefono) return ([x, y]) => [L + x * W / 1800, T + y * H / 1000];
  const k = Math.max(W / 750, H / 1000), ox = L + (W - 750 * k) * 0.5, oy = T + (H - 1000 * k) * 0.85;
  return ([x, y]) => [ox + (x - 336) * k, oy + y * k];
}

(async () => {
  // (senza le opzioni di SwiftShader di prova-leggera.js: con quelle, dopo il video del giro, il browser di prova smette
  // di disegnare. La stoffa parte lo stesso con ?comunque)
  const browser = await chromium.launch();
  const D = await (await fetch(base + '/camicia/opzioni/opzioni.json')).json(), DATI = D;
  const L = await (await fetch(base + '/camicia/leggera/leggera.json')).json();
  const nuovo = async (opzioni = {}, cerca = '') => {
    const contesto = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opzioni });
    const page = await contesto.newPage();
    const errori = [], richieste = [];
    page.on('console', (m) => { if (m.type() === 'error') errori.push(m.text()); });
    page.on('pageerror', (e) => errori.push(String(e)));
    page.on('request', (r) => richieste.push(r.url()));
    // quante volte la stoffa ricarica la sua immagine (per vedere che non succede a ogni fotogramma)
    await page.addInitScript(() => {
      window.__caricate = 0;
      for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
        if (!C) continue;
        const prima = C.prototype.texImage2D;
        C.prototype.texImage2D = function (...a) { window.__caricate++; return prima.apply(this, a); };
      }
    });
    await page.goto(PAGINA + cerca, { waitUntil: 'networkidle' });
    await page.evaluate(campiFinti);
    return { contesto, page, errori, richieste };
  };
  /** Aspetta che la camicia che si muove sia pronta (se c'è) e ferma. */
  const pronta = async (page) => {
    await page.waitForFunction(() => !window.__camicia || 'viva' in document.querySelector('.configura__palco').dataset, null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { let n = 0; while (window.__camicia?.passo(16.67) && n++ < 3000); });
  };
  /** Confronta i pezzi sull'immagine ferma con i punti del fotogramma. Restituisce lo scarto massimo, in punti. */
  const scartoFerma = async (page, stato, D = DATI) => {
    const s = await page.evaluate(sullaFerma);
    const P = proietta(s);
    let max = 0;
    const attesi = [];
    if (stato.collo && D.colli[stato.collo]?.file) attesi.push(['collo-' + stato.collo.replace(/_/g, '-'), D.colli[stato.collo].riquadro]);
    if (stato.taschino) attesi.push(['taschino', D.taschino.riquadro]);
    for (const [nome, [x0, y0, x1, y1]] of attesi) {
      const p = s.pezzi.find((q) => q.src.includes('/' + nome + '-'));
      if (!p) return { max: Infinity, s, manca: nome };
      const [a, b] = P([x0, y0]), [c, d] = P([x1, y1]);
      max = Math.max(max, Math.abs(p.angoli[0] - a), Math.abs(p.angoli[1] - b), Math.abs(p.angoli[2] - c), Math.abs(p.angoli[3] - d));
    }
    let lettere = 0, k = 1;
    if (stato.iniziali) {
      const posto = (stato.iniziali.posizione === 'collo' && D.colli[stato.collo || 'italiano']?.iniziali) || D.iniziali[stato.iniziali.posizione];
      const [cx] = P(posto.centro);
      const [ux] = P([posto.centro[0] + 1, posto.centro[1]]);
      lettere = s.iniziali ? Math.abs(s.iniziali[0] - cx) : Infinity;             // in punti dello schermo
      k = Math.abs(ux - cx);
    }
    return { max, lettere, k, s };
  };
  /** La camicia che dondola: un punto del collo sul livello dei pezzi (una sonda senza misura) contro lo stesso punto
   *  della camicia, calcolato con la sua trasformazione. In punti dello schermo. */
  const scartoAddosso = (page) => page.evaluate(([lx, ly]) => {
    const add = document.querySelector('.configura__addosso');
    if (!add) return { manca: true };
    const piano = add.parentElement, cam = [...piano.querySelectorAll(':scope > img')][2];
    const sonda = document.createElement('i');
    sonda.style.cssText = `position:absolute;width:0;height:0;left:${lx}px;top:${ly}px`;
    add.append(sonda);
    const q = sonda.getBoundingClientRect();
    sonda.remove();
    const k = piano.getBoundingClientRect().width / parseFloat(piano.style.width), pr = piano.getBoundingClientRect();
    const t = getComputedStyle(cam).transform, M = new DOMMatrix(t === 'none' ? undefined : t);
    const p = M.transformPoint(new DOMPoint(lx, ly, 0, 1));
    const ex = pr.left + (cam.offsetLeft + p.x / p.w) * k, ey = pr.top + (cam.offsetTop + p.y / p.w) * k;
    return { scarto: Math.max(Math.abs(q.left - ex), Math.abs(q.top - ey)), mossa: cam.style.transform, uguale: cam.style.transform === add.style.transform, visibile: getComputedStyle(add).visibility, pezzi: add.querySelectorAll('.vesti__pezzo').length };
  }, [D.colli.francese.riquadro[0] + 20 - L.pezzi.camicia[0], D.colli.francese.riquadro[1] + 30 - L.pezzi.camicia[1]]);
  /** Quanto è chiaro in media, sullo schermo, il punto sotto il bottone del collo dove l'italiano ha le punte (con la
   *  loro ombra) e il francese no: con il collo francese addosso lì si vede il davanti della camicia, più chiaro. */
  const rosa = async (page) => {
    const s = await page.evaluate(sullaFerma);
    const P = proietta(s);
    const [x0, y0, x1, y1] = D.colli.francese.riquadro;
    const [a, b] = P([x0 + (x1 - x0) * 0.25, y0 + (y1 - y0) * 0.45]), [c, d] = P([x0 + (x1 - x0) * 0.75, y0 + (y1 - y0) * 0.8]);
    const png = await scatta(page, { clip: { x: a, y: b, width: Math.max(4, c - a), height: Math.max(4, d - b) } });
    return page.evaluate(async (s64) => {
      const im = new Image(); im.src = 'data:image/png;base64,' + s64; await im.decode();
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const x = g.getImageData(0, 0, c.width, c.height).data;
      let somma = 0; for (let i = 0; i < x.length; i += 4) somma += (x[i] + x[i + 1] + x[i + 2]) / 3;
      return somma / (x.length / 4);
    }, png.toString('base64'));
  };
  const larga = (page) => page.evaluate(() => document.documentElement.scrollWidth);

  // ---------------------------------------------------------------- 1. senza scelte: niente cambia
  console.log('Senza scelte');
  {
    const a = await nuovo();
    await pronta(a.page);
    await manda(a.page, { collo: 'italiano', taschino: false, iniziali: null });
    await a.page.waitForTimeout(400);
    const r = a.richieste.filter((u) => u.includes('/camicia/opzioni/') && u.endsWith('.webp') || /\/camicia\/opzioni\/.*\.webp\?/.test(u));
    controlla('con il collo italiano, senza taschino né iniziali non si scarica nessun pezzo', r.length === 0, r.join(', '));
    controlla('e sulla pagina non c\'è nessun livello in più', await a.page.evaluate(() => !document.querySelector('.configura__vesti') && !document.querySelector('.configura__addosso .vesti__pezzo')));
    controlla('nessun errore', a.errori.length === 0, a.errori.join(' | '));
    await a.contesto.close();
  }

  // ---------------------------------------------------------------- 2. computer: ogni livello, ogni modo
  for (const [modo, cerca] of [['stoffa accesa', '&comunque'], ['rigida', '&rigida']]) {
    for (const [nome, opzioni] of COMPUTER) {
      console.log(`${nome}, ${modo}`);
      const a = await nuovo(opzioni, cerca), { page } = a;
      const sigla = `${nome.split(' ').slice(-3).join('')}-${modo.split(' ')[0]}`;
      await pronta(page);
      const conStoffa = await page.evaluate(() => !!document.querySelector('.configura__onda'));
      controlla(`la stoffa è ${modo === 'rigida' ? 'spenta' : 'accesa'}`, conStoffa === (modo !== 'rigida'));
      const rosa0 = await rosa(page);
      const prime = await page.evaluate(() => window.__caricate);
      // ogni collo, poi il taschino e le iniziali
      for (const collo of Object.keys(D.colli).filter((c) => D.colli[c])) {
        await manda(page, { collo, taschino: false, iniziali: null });
        await page.waitForTimeout(450);
        const f = await scartoFerma(page, { collo });
        if (f.max > 0.5) controlla(`collo ${collo}: allineato sull'immagine ferma`, false, `${f.max.toFixed(2)} punti ${f.manca || ''}`);
      }
      await manda(page, TUTTO);
      await page.waitForTimeout(500);
      const f = await scartoFerma(page, { collo: 'francese', taschino: true, iniziali: TUTTO.iniziali });
      controlla('ogni collo, il taschino e le iniziali allineati sull\'immagine ferma (entro mezzo punto)', f.max <= 0.5 && f.lettere <= 0.5, `${f.max.toFixed(3)} punti, lettere ${f.lettere.toFixed(2)}`);
      controlla('sull\'immagine ferma i pezzi sono nascosti mentre c\'è la camicia che si muove', !f.s.visibile);
      const r0 = await scartoAddosso(page);
      controlla('sulla camicia che dondola: pezzi presenti e al punto, da ferma', !r0.manca && r0.pezzi >= 3 && r0.scarto <= 0.5, `${r0.scarto?.toFixed(3)} punti, ${r0.pezzi} pezzi`);
      controlla(conStoffa ? 'con la stoffa il livello dei pezzi è nascosto (sono dentro la sua immagine)' : 'senza stoffa il livello dei pezzi si vede', (r0.visibile === 'hidden') === conStoffa, r0.visibile);
      // la stoffa: la tela composta
      const rosa1 = await rosa(page);
      controlla('il collo scelto si vede sulla camicia a riposo', rosa1 - rosa0 > 3, `chiaro da ${rosa0.toFixed(1)} a ${rosa1.toFixed(1)}`);
      await foto(page, `${sigla}-ferma`);
      // dondola: il livello dei pezzi ha la stessa trasformazione della camicia
      await page.evaluate(() => { window.__camicia.p.vLato = 0.12; window.__camicia.p.vTorce = 0.1; window.__camicia.sveglia(); });
      const caricatePrima = await page.evaluate(() => window.__caricate);
      let peggio = 0, uguali = true, mossa = false;
      for (let i = 0; i < 6; i++) {
        await page.evaluate(() => { for (let k = 0; k < 8; k++) window.__camicia.passo(16.67); });
        const r = await scartoAddosso(page);
        peggio = Math.max(peggio, r.scarto); uguali &&= r.uguale; mossa ||= !!r.mossa;
        if (i === 1) await foto(page, `${sigla}-dondola`);
      }
      const caricateDopo = await page.evaluate(() => window.__caricate);
      if (!conStoffa) controlla('mentre dondola i pezzi seguono la camicia (stessa trasformazione, stesso punto)', mossa && uguali && peggio <= 0.5, `${peggio.toFixed(3)} punti`);
      else {
        const rosaMossa = await rosa(page);
        controlla('mentre ondeggia il collo scelto resta dentro la stoffa', rosaMossa - rosa0 > 2, `${rosaMossa.toFixed(1)}`);
        controlla('la stoffa ricarica la sua immagine solo quando le scelte cambiano, non a ogni fotogramma', caricateDopo === caricatePrima && caricatePrima > prime, `${prime} → ${caricatePrima} → ${caricateDopo}`);
      }
      await page.evaluate(() => { let n = 0; while (window.__camicia.passo(16.67) && n++ < 3000); });

      // lo zoom su una parte: il collo
      await page.focus('#finto-collo-menu');
      await page.waitForTimeout(1500);
      const z = await page.evaluate(() => {
        const p = document.querySelector('.configura__palco');
        const linee = document.querySelectorAll('.configura__linee .linea__tratto').length;
        return { aperta: p.dataset.guidaAperta, zoom: p.style.getPropertyValue('--zoom'), linee, file: document.querySelector('.configura__vesti img')?.getAttribute('src') || '' };
      });
      controlla('entrando nel campo del collo: zoom sul collo e contorno tratteggiato', z.aperta === 'collo' && z.zoom.includes('scale') && z.linee > 0, `${z.zoom}, ${z.linee} tratti`);
      const fz = await scartoFerma(page, { collo: 'francese', taschino: true, iniziali: TUTTO.iniziali });
      controlla('nello zoom i pezzi sono in vista e allineati sopra la camicia nitida', fz.s.visibile && fz.max <= 0.5 && fz.lettere <= 0.5, `${fz.max.toFixed(3)} punti, lettere ${fz.lettere.toFixed(2)}`);
      controlla('nello zoom il collo è nel file grande', /-4\.webp/.test(z.file), z.file.split('/').pop());
      await foto(page, `${sigla}-zoom-collo`);
      // le iniziali: dal polso al cuore mentre il campo ha il fuoco
      await page.focus('#finto-posto');
      await page.waitForTimeout(1400);
      const polso = await page.evaluate(() => ({ aperta: document.querySelector('.configura__palco').dataset.guidaAperta, zoom: document.querySelector('.configura__palco').style.getPropertyValue('--zoom') }));
      await page.selectOption('#finto-posto', 'cuore');
      await page.waitForTimeout(1400);
      const cuore = await page.evaluate(() => ({ aperta: document.querySelector('.configura__palco').dataset.guidaAperta, zoom: document.querySelector('.configura__palco').style.getPropertyValue('--zoom') }));
      controlla('cambiando il posto delle iniziali lo zoom scivola sulla parte nuova', polso.aperta === 'iniziali_polso' && cuore.aperta === 'iniziali_cuore' && polso.zoom !== cuore.zoom, `${polso.aperta} → ${cuore.aperta}`);
      await foto(page, `${sigla}-zoom-iniziali`);
      // una finestra sopra la pagina, e poi chiusa: lo zoom torna come deve
      await page.click('#finto-tessuti');
      await page.waitForTimeout(500);
      const sotto = await page.evaluate(() => ({ aperta: document.querySelector('.configura__palco').dataset.guidaAperta || '' }));
      await page.click('#finta-chiudi');
      await page.waitForTimeout(1500);
      const tornata = await page.evaluate(() => ({ aperta: document.querySelector('.configura__palco').dataset.guidaAperta || '', zoom: document.querySelector('.configura__palco').style.getPropertyValue('--zoom'), fuoco: document.activeElement?.id }));
      controlla('con la finestra sopra la guida si chiude, chiusa la finestra torna sul campo', sotto.aperta === '' && (tornata.aperta === '' ? !tornata.zoom : tornata.zoom.includes('scale')), `${JSON.stringify(sotto)} → ${JSON.stringify(tornata)}`);
      // uscita
      await page.evaluate(() => document.activeElement?.blur());
      await page.waitForTimeout(1600);
      const via = await page.evaluate(() => { const p = document.querySelector('.configura__palco'); return { aperta: p.dataset.guidaAperta, zoom: p.style.getPropertyValue('--zoom'), ferma: 'guidaFerma' in p.dataset }; });
      controlla('uscendo, lo zoom torna indietro e la camicia riparte', !via.aperta && !via.zoom && !via.ferma, JSON.stringify(via));
      // una misura che gira la camicia: i pezzi davanti non si vedono
      await page.focus('.misura[data-guida="spalla"] input');
      await page.waitForTimeout(2600);
      const dietro = await page.evaluate(() => ({ girata: 'girata' in document.querySelector('.configura__palco').dataset, opacita: getComputedStyle(document.querySelector('.configura__vesti')).opacity }));
      controlla('girata di spalle, i pezzi davanti non si vedono', dietro.girata && dietro.opacita === '0', JSON.stringify(dietro));
      await page.focus('.misura[data-guida="torace"] input');
      await page.waitForTimeout(3000);
      const davanti = await page.evaluate(() => ({ girata: 'girata' in document.querySelector('.configura__palco').dataset, opacita: getComputedStyle(document.querySelector('.configura__vesti')).opacity }));
      controlla('di nuovo davanti, tornano', !davanti.girata && davanti.opacita === '1', JSON.stringify(davanti));
      await page.evaluate(() => document.activeElement?.blur());
      await page.waitForTimeout(1500);
      // il cambio: il collo nuovo compare sopra il vecchio, che resta finché l'altro non è comparso
      await page.evaluate(() => { let n = 0; while (window.__camicia.passo(16.67) && n++ < 3000); });
      await manda(page, { ...TUTTO, collo: 'club' });
      await page.waitForTimeout(90);
      const meta = await page.evaluate(() => [...document.querySelectorAll('.configura__vesti .vesti__posto:first-child img')].map((im) => [im.getAttribute('src').split('/').pop().split('?')[0], getComputedStyle(im).opacity]));
      await page.waitForTimeout(400);
      const fine = await page.evaluate(() => [...document.querySelectorAll('.configura__vesti .vesti__posto:first-child img')].map((im) => [im.getAttribute('src').split('/').pop().split('?')[0], getComputedStyle(im).opacity]));
      controlla('cambiando collo il nuovo compare sopra il vecchio, che resta pieno fino alla fine', meta.length === 2 && meta[0][1] === '1' && +meta[1][1] < 1 && fine.length === 1 && fine[0][0].startsWith('collo-club') && fine[0][1] === '1', `${JSON.stringify(meta)} → ${JSON.stringify(fine)}`);
      controlla('la pagina non si allarga', (await larga(page)) === opzioni.viewport.width);
      controlla('nessun errore', a.errori.length === 0, a.errori.join(' | '));
      await a.contesto.close();
    }
  }

  // ---------------------------------------------------------------- 3. telefono: immagine ferma, camicia che dondola, riquadro con lo zoom
  for (const [nome, opzioni] of TELEFONO) {
    console.log(nome);
    const a = await nuovo(opzioni, '&rigida'), { page } = a;
    const sigla = nome.split(' ').slice(0, 2).join('-');
    await pronta(page);
    await manda(page, TUTTO);
    await page.waitForTimeout(500);
    const f = await scartoFerma(page, { collo: 'francese', taschino: true, iniziali: TUTTO.iniziali });
    controlla('pezzi e iniziali allineati sull\'immagine ferma del telefono (entro mezzo punto)', f.max <= 0.5 && f.lettere <= 0.5, `${f.max.toFixed(3)} punti, lettere ${f.lettere.toFixed(2)}`);
    const r0 = await scartoAddosso(page);
    controlla('e sulla camicia che dondola', !r0.manca && r0.scarto <= 0.5, `${r0.scarto?.toFixed(3)} punti`);
    await page.evaluate(() => { window.__camicia.p.vLato = 0.12; window.__camicia.sveglia(); for (let k = 0; k < 16; k++) window.__camicia.passo(16.67); });
    const r1 = await scartoAddosso(page);
    controlla('anche mentre dondola', r1.uguale && !!r1.mossa && r1.scarto <= 0.5, `${r1.scarto?.toFixed(3)} punti`);
    await page.evaluate(() => { let n = 0; while (window.__camicia.passo(16.67) && n++ < 3000); });
    await foto(page, `${sigla}-ferma`);
    // il riquadro con lo zoom sopra il campo del collo
    await page.evaluate(() => document.querySelector('#finto-collo').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await page.tap('#finto-collo-menu').catch(() => page.focus('#finto-collo-menu'));
    await page.evaluate(() => { if (!document.activeElement?.closest('[data-parte]')) document.querySelector('#finto-collo-menu').focus(); });
    await page.waitForTimeout(1300);
    const l = await page.evaluate(() => {
      const c = document.querySelector('.misura-lente'), campo = document.querySelector('#finto-collo');
      if (!c || c.hidden) return { manca: true };
      const g = c.querySelector('.misura-lente__vesti'), im = g?.querySelector('image');
      const rc = c.getBoundingClientRect(), rm = campo.getBoundingClientRect();
      return { sopra: rc.bottom <= rm.top + 1, dentro: rc.left >= -0.5 && rc.right <= innerWidth + 0.5, immagine: im ? [im.getAttribute('href').split('/').pop().split('?')[0], +im.getAttribute('x'), +im.getAttribute('y'), +im.getAttribute('width'), +im.getAttribute('height')] : null, lettere: g?.querySelector('text:last-child')?.textContent, tratti: c.querySelectorAll('.linea__tratto').length };
    });
    const [x0, y0, x1, y1] = D.colli.francese.riquadro;
    controlla('sul telefono il riquadro con lo zoom sta sopra il campo del collo, con il contorno', !l.manca && l.sopra && l.dentro && l.tratti > 0, JSON.stringify({ sopra: l.sopra, dentro: l.dentro, tratti: l.tratti }));
    controlla('nel riquadro ci sono il collo scelto, al suo punto, e le iniziali', !!l.immagine && l.immagine[0].startsWith('collo-francese-') && l.immagine[1] === x0 && l.immagine[2] === y0 && l.immagine[3] === x1 - x0 && l.immagine[4] === y1 - y0 && l.lettere === 'NP', JSON.stringify(l.immagine));
    await foto(page, `${sigla}-riquadro-collo`);
    await page.focus('#finto-posto');
    await page.waitForTimeout(900);
    await page.selectOption('#finto-posto', 'cuore');
    await page.waitForTimeout(1200);
    const cuore = await page.evaluate(() => { const c = document.querySelector('.misura-lente'), t = c?.querySelector('.linea__tratto'); return c && !c.hidden && t ? t.getAttribute('d').split('C')[0] : null; });
    controlla('cambiando il posto delle iniziali il riquadro scivola sulla parte nuova', cuore === `M${D.parti.iniziali_cuore.tratti[0].punti[0].join(' ')}`, String(cuore));
    await foto(page, `${sigla}-riquadro-iniziali`);
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(400);
    controlla('uscendo il riquadro sparisce', await page.evaluate(() => !document.querySelector('.misura-lente') || document.querySelector('.misura-lente').hidden));
    controlla('la pagina non si allarga', (await larga(page)) === opzioni.viewport.width, `${await larga(page)}`);
    controlla('nessun errore', a.errori.length === 0, a.errori.join(' | '));
    await a.contesto.close();
  }

  // ---------------------------------------------------------------- 4. movimento ridotto
  console.log('Movimento ridotto');
  for (const [nome, opzioni] of [COMPUTER[0], TELEFONO[0]]) {
    const a = await nuovo({ ...opzioni, reducedMotion: 'reduce' }), { page } = a;
    await page.waitForTimeout(300);
    await manda(page, TUTTO);
    await page.waitForTimeout(250);
    const f = await scartoFerma(page, { collo: 'francese', taschino: true, iniziali: TUTTO.iniziali });
    controlla(`${nome}: i pezzi stanno sull'immagine ferma, subito e senza dissolvenza`, f.s.visibile && f.max <= 0.5 && f.s.pezzi.every((p) => p.opacita === '1'), `${f.max.toFixed(3)} punti`);
    await manda(page, { ...TUTTO, collo: 'club' });
    await page.waitForTimeout(80);
    const subito = await page.evaluate(() => [...document.querySelectorAll('.configura__vesti .vesti__posto:first-child img')].map((im) => im.getAttribute('src').split('/').pop().split('?')[0]));
    controlla(`${nome}: un collo nuovo prende subito il posto del vecchio`, subito.length === 1 && subito[0].startsWith('collo-club'), JSON.stringify(subito));
    if (nome.startsWith('computer')) {
      await page.focus('#finto-collo-menu');
      await page.waitForTimeout(300);
      const z = await page.evaluate(() => document.querySelector('.configura__palco').style.getPropertyValue('--zoom'));
      controlla(`${nome}: lo zoom sul collo c'è lo stesso`, z.includes('scale'), z);
      await foto(page, 'ridotto-zoom-collo');
    }
    controlla(`${nome}: nessun errore`, a.errori.length === 0, a.errori.join(' | '));
    await a.contesto.close();
  }

  // ---------------------------------------------------------------- 5. un file che manca; un avviso che arriva presto
  console.log('Un file che manca');
  {
    const contesto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await contesto.newPage();
    const errori = [];
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errori.push(m.text()); });
    page.on('pageerror', (e) => errori.push(String(e)));
    await page.route(/collo-club-\d\.webp/, (r) => r.fulfill({ status: 404, body: '' }));
    // l'avviso arriva appena la pagina è letta, prima che la camicia che si muove sia pronta
    await page.addInitScript((d) => document.addEventListener('DOMContentLoaded', () => document.dispatchEvent(new CustomEvent('endero:camicia', { detail: d }))), TUTTO);
    await page.goto(PAGINA + '&rigida', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => 'viva' in document.querySelector('.configura__palco').dataset, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
    const presto = await page.evaluate(() => [...document.querySelectorAll('.configura__addosso .vesti__pezzo')].length);
    controlla('un avviso arrivato prima della camicia che si muove vale anche per lei', presto >= 3, `${presto} pezzi`);
    await manda(page, { ...TUTTO, collo: 'club' });
    await page.waitForTimeout(600);
    const resta = await page.evaluate(() => [...document.querySelectorAll('.configura__vesti .vesti__posto:first-child img, .configura__addosso .vesti__posto:first-child img')].map((im) => im.getAttribute('src').split('/').pop().split('?')[0]));
    controlla('se il file del collo manca, resta il collo di prima, su ogni livello', resta.length === 2 && resta.every((s) => s.startsWith('collo-francese')), JSON.stringify(resta));
    controlla('e nessun errore (a parte la richiesta non trovata)', errori.length === 0, errori.join(' | '));
    await contesto.close();
  }

  // ---------------------------------------------------------------- 6. colli con la loro sagoma e il loro posto per le iniziali
  // (aggiunta al contratto del 2026-11-25: `colli[id].parte`, `.iniziali`, `.parte_iniziali`; l'italiano può essere un
  // oggetto senza file; i riquadri possono avere misure diverse). Dati di prova messi qui, al posto di opzioni.json
  console.log('Colli con la loro sagoma');
  {
    const rett = ([x0, y0, x1, y1]) => ({ vista: 'davanti', tratti: [{ punti: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], visibile: true, chiuso: true }], capi: [], riquadro: [x0, y0, x1, y1] });
    const P = JSON.parse(JSON.stringify(D));
    P.colli.italiano = { parte: P.parti.collo, iniziali: P.iniziali.collo };
    P.colli.coreano = { file: P.colli.coreano.file, riquadro: [620, 215, 820, 360], parte: rett([640, 240, 800, 330]), iniziali: { centro: [700, 300], gradi: 10, alta: 6 }, parte_iniziali: rett([680, 285, 720, 315]) };
    const a = await nuovo(COMPUTER[0][1], '&rigida'), { page } = a;
    await page.route(/opzioni\/opzioni\.json/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(P) }));
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(campiFinti);
    await pronta(page);
    const sulCollo = { posizione: 'collo', lettere: 'EDR' };
    await manda(page, { collo: 'italiano', taschino: false, iniziali: sulCollo });
    await page.waitForTimeout(500);
    const it = await scartoFerma(page, { collo: 'italiano', iniziali: sulCollo }, P);
    controlla('l\'italiano come oggetto senza file: nessun pezzo, le iniziali al posto del collo', it.s.pezzi.length === 0 && it.lettere <= 6 * 0.3 * it.k, `${it.s.pezzi.length} pezzi, lettere a ${it.lettere.toFixed(2)}`);
    await manda(page, { collo: 'coreano', taschino: false, iniziali: sulCollo });
    await page.waitForTimeout(500);
    const co = await scartoFerma(page, { collo: 'coreano', iniziali: sulCollo }, P);
    controlla('il coreano con un riquadro di misura diversa: al suo punto, e le iniziali al posto del coreano', co.max <= 0.5 && co.lettere <= 6 * 0.3 * co.k, `${co.max.toFixed(3)} punti, lettere ${co.lettere.toFixed(2)}`);
    const bordo = () => page.evaluate(() => { const t = document.querySelector('.configura__linee .linea__tratto'); return t ? t.getAttribute('d').split('C')[0] : null; });
    await page.focus('#finto-collo-menu');
    await page.waitForTimeout(1500);
    const b1 = await bordo();
    controlla('il contorno del collo è quello del coreano', b1 === 'M640 240', JSON.stringify(b1));
    await foto(page, 'sagoma-coreano');
    await manda(page, { collo: 'francese', taschino: false, iniziali: sulCollo });
    await page.waitForTimeout(1500);
    // il contorno del francese: il suo, se opzioni.json glielo dà, altrimenti quello del collo di base
    const b2 = await bordo(), q2 = (P.colli.francese?.parte || P.parti.collo).tratti[0].punti[0];
    controlla('cambiando collo con il campo aperto, il contorno passa da solo al collo nuovo', b2 === `M${q2[0]} ${q2[1]}`, JSON.stringify(b2));
    await manda(page, { collo: 'coreano', taschino: false, iniziali: sulCollo });
    await page.focus('#finto-posto');
    await page.selectOption('#finto-posto', 'collo');
    await page.waitForTimeout(1500);
    const b3 = await bordo();
    controlla('le iniziali sul collo, con il coreano: il loro contorno è quello del coreano', b3 === 'M680 285', JSON.stringify(b3));
    await foto(page, 'sagoma-iniziali-coreano');
    controlla('nessun errore', a.errori.length === 0, a.errori.join(' | '));
    await a.contesto.close();
  }

  await browser.close();
  console.log(`\n${passati} controlli passati, ${falliti.length} falliti`);
  if (falliti.length) { console.log(falliti.map((f) => ' - ' + f).join('\n')); process.exitCode = 1; }
})();
