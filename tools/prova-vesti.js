// Controlla la camicia che cambia con le scelte del riquadro (src/configuratore/vesti.js e tinta.js, punto 16 della
// direzione creativa): il collo scelto, il taschino e le iniziali sovrapposti alla camicia su ogni livello (immagine
// ferma, camicia che dondola, tessuto che ondeggia, camicia nitida dello zoom, riquadro del telefono), sempre al loro
// punto; la guida alle misure con i pezzi scelti e il velo; il movimento ridotto, un file che manca, nessun file
// scaricato finché non si sceglie nulla; e, dal 2026-11-26, il tessuto che colora la camicia (anche taschino e polsini
// con un tessuto loro), la rotella «filo che cuce», la camicia che resta bianca senza scheda grafica, i caratteri
// delle iniziali.
//
//   node tools/prova-vesti.js [indirizzo del sito, senza barra finale] [cartella per le schermate]
//
// In locale: node build/costruisci.mjs && node build/servi.mjs 8781. Gli avvisi `endero:camicia` li manda questo
// controllo, sul passo Misure (lì ci sono i campi che aprono la guida).
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
const SENZA = { collo: 'italiano', taschino: false, iniziali: null, tessuto: '', taschino_tessuto: '', polsino_tessuto: '' };
const manda = (page, detail) => page.evaluate((d) => document.dispatchEvent(new CustomEvent('endero:camicia', { detail: d })), { ...SENZA, ...detail });
// Aspetta che la camicia abbia finito di prendere l'ultima scelta. In locale i pezzi arrivano in un attimo e non
// cambia nulla; sull'anteprima vera arrivano dalla rete, e un tempo fisso non basta (2026-11-26).
const posata = (page) => page.waitForFunction(() => !window.__vesti || !window.__vesti.cucendo, null, { timeout: 15000 }).catch(() => {});

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
    const r = a.richieste.filter((u) => /\/camicia\/(opzioni|stoffe)\/.*\.(webp|png)(\?|$)/.test(u) || /trame\.json/.test(u));
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
        await posata(page);
        await page.waitForTimeout(450);
        const f = await scartoFerma(page, { collo });
        if (f.max > 0.5) controlla(`collo ${collo}: allineato sull'immagine ferma`, false, `${f.max.toFixed(2)} punti ${f.manca || ''}`);
      }
      await manda(page, TUTTO);
      await posata(page);
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

      // la guida alle misure (dal 2026-11-26 lo zoom c'è solo lì): i pezzi restano sulla camicia nitida, e la camicia è velata
      // (il giro collo: lo zoom più forte, quello che vuole i pezzi nella grandezza quadrupla)
      await page.focus('.misura[data-guida="giro_collo"] input');
      await page.waitForTimeout(1700);
      const z = await page.evaluate(() => {
        const p = document.querySelector('.configura__palco'), velo = document.querySelector('.configura__velo');
        return { aperta: p.dataset.guidaAperta, zoom: p.style.getPropertyValue('--zoom'), linee: document.querySelectorAll('.configura__linee .linea__tratto').length, file: document.querySelector('.configura__vesti img')?.getAttribute('src') || '', velo: velo ? +getComputedStyle(velo).opacity : -1, veloZoom: velo ? getComputedStyle(velo).transform !== 'none' : false };
      });
      controlla('entrando in una misura: zoom sulla zona e tratteggio', z.aperta === 'giro_collo' && z.zoom.includes('scale') && z.linee > 0, `${z.zoom}, ${z.linee} tratti`);
      controlla('la camicia è velata (più trasparente), con lo stesso zoom', Math.abs(z.velo - 0.6) < 0.03 && z.veloZoom, JSON.stringify(z));
      const fz = await scartoFerma(page, { collo: 'francese', taschino: true, iniziali: TUTTO.iniziali });
      controlla('nello zoom i pezzi sono in vista e allineati sopra la camicia nitida', fz.s.visibile && fz.max <= 0.5 && fz.lettere <= 0.5, `${fz.max.toFixed(3)} punti, lettere ${fz.lettere.toFixed(2)}`);
      controlla('nello zoom il collo è nel file grande', /-4\.webp/.test(z.file), z.file.split('/').pop());
      await foto(page, `${sigla}-zoom-collo`);
      // uscita
      await page.evaluate(() => document.activeElement?.blur());
      await page.waitForTimeout(1600);
      const via = await page.evaluate(() => { const p = document.querySelector('.configura__palco'); return { aperta: p.dataset.guidaAperta, zoom: p.style.getPropertyValue('--zoom'), ferma: 'guidaFerma' in p.dataset, velo: +getComputedStyle(document.querySelector('.configura__velo')).opacity }; });
      controlla('uscendo, lo zoom torna indietro, il velo va via e la camicia riparte', !via.aperta && !via.zoom && !via.ferma && via.velo < 0.02, JSON.stringify(via));
      // una misura che gira la camicia: i pezzi davanti non si vedono
      // (sull'anteprima vera il retro e i video del giro arrivano dalla rete: si aspetta il giro, non un tempo fisso)
      await page.focus('.misura[data-guida="spalla"] input');
      await page.waitForFunction(() => 'girata' in document.querySelector('.configura__palco').dataset, null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2600);
      const dietro = await page.evaluate(() => ({ girata: 'girata' in document.querySelector('.configura__palco').dataset, opacita: getComputedStyle(document.querySelector('.configura__vesti')).opacity }));
      controlla('girata di spalle, i pezzi davanti non si vedono', dietro.girata && dietro.opacita === '0', JSON.stringify(dietro));
      await page.focus('.misura[data-guida="torace"] input');
      await page.waitForFunction(() => !('girata' in document.querySelector('.configura__palco').dataset), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(600);
      const davanti = await page.evaluate(() => ({ girata: 'girata' in document.querySelector('.configura__palco').dataset, opacita: getComputedStyle(document.querySelector('.configura__vesti')).opacity }));
      controlla('di nuovo davanti, tornano', !davanti.girata && davanti.opacita === '1', JSON.stringify(davanti));
      await page.evaluate(() => document.activeElement?.blur());
      await page.waitForTimeout(1500);
      // il cambio: il collo nuovo compare sopra il vecchio, che resta finché l'altro non è comparso
      await page.evaluate(() => { let n = 0; while (window.__camicia.passo(16.67) && n++ < 3000); });
      await manda(page, { ...TUTTO, collo: 'coreano' });
      await page.waitForTimeout(90);
      const meta = await page.evaluate(() => [...document.querySelectorAll('.configura__vesti .vesti__posto--collo img')].map((im) => [im.getAttribute('src').split('/').pop().split('?')[0], getComputedStyle(im).opacity]));
      await page.waitForTimeout(400);
      const fine = await page.evaluate(() => [...document.querySelectorAll('.configura__vesti .vesti__posto--collo img')].map((im) => [im.getAttribute('src').split('/').pop().split('?')[0], getComputedStyle(im).opacity]));
      controlla('cambiando collo il nuovo compare sopra il vecchio, che resta pieno fino alla fine', meta.length === 2 && meta[0][1] === '1' && +meta[1][1] < 1 && fine.length === 1 && fine[0][0].startsWith('collo-coreano') && fine[0][1] === '1', `${JSON.stringify(meta)} → ${JSON.stringify(fine)}`);
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
    await posata(page);
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
    // il riquadro con lo zoom sopra un campo di misura: dentro ci sono i pezzi scelti, e il velo
    await page.evaluate(() => document.querySelector('.misura[data-guida="giro_collo"]').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await page.tap('.misura[data-guida="giro_collo"] input').catch(() => page.focus('.misura[data-guida="giro_collo"] input'));
    await page.waitForTimeout(1500);
    const l = await page.evaluate(() => {
      const c = document.querySelector('.misura-lente');
      if (!c || c.hidden) return { manca: true };
      const g = c.querySelector('.misura-lente__vesti'), im = g?.querySelector('image');
      const velo = [...c.querySelectorAll('svg > image')].find((x) => /parete/.test(x.getAttribute('href') || ''));
      return { immagine: im ? [im.getAttribute('href').split('/').pop().split('?')[0], +im.getAttribute('x'), +im.getAttribute('y'), +im.getAttribute('width'), +im.getAttribute('height')] : null, lettere: g?.querySelector('text:last-child')?.textContent, tratti: c.querySelectorAll('.linea__tratto').length, velo: velo ? +velo.getAttribute('opacity') : -1, tinta: c.querySelectorAll('canvas').length };
    });
    const [x0, y0, x1, y1] = D.colli.francese.riquadro;
    controlla('sul telefono il riquadro con lo zoom ha il tratteggio e il velo', !l.manca && l.tratti > 0 && Math.abs(l.velo - 0.6) < 0.01, JSON.stringify({ tratti: l.tratti, velo: l.velo }));
    controlla('nel riquadro ci sono il collo scelto, al suo punto, e le iniziali', !!l.immagine && l.immagine[0].startsWith('collo-francese-') && l.immagine[1] === x0 && l.immagine[2] === y0 && l.immagine[3] === x1 - x0 && l.immagine[4] === y1 - y0 && l.lettere === 'NP', JSON.stringify(l.immagine));
    await foto(page, `${sigla}-riquadro-collo`);
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
    await posata(page);
    await page.waitForTimeout(250);
    const f = await scartoFerma(page, { collo: 'francese', taschino: true, iniziali: TUTTO.iniziali });
    controlla(`${nome}: i pezzi stanno sull'immagine ferma, subito e senza dissolvenza`, f.s.visibile && f.max <= 0.5 && f.s.pezzi.every((p) => p.opacita === '1'), `${f.max.toFixed(3)} punti`);
    await manda(page, { ...TUTTO, collo: 'coreano' });
    await posata(page);
    await page.waitForTimeout(80);
    const subito = await page.evaluate(() => [...document.querySelectorAll('.configura__vesti .vesti__posto--collo img')].map((im) => im.getAttribute('src').split('/').pop().split('?')[0]));
    controlla(`${nome}: un collo nuovo prende subito il posto del vecchio`, subito.length === 1 && subito[0].startsWith('collo-coreano'), JSON.stringify(subito));
    if (nome.startsWith('computer')) {
      await page.focus('.misura[data-guida="torace"] input');
      await page.waitForTimeout(300);
      const z = await page.evaluate(() => document.querySelector('.configura__palco').style.getPropertyValue('--zoom'));
      controlla(`${nome}: lo zoom sulla misura c'è lo stesso`, z.includes('scale'), z);
      await foto(page, 'ridotto-zoom-torace');
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
    await page.route(/collo-coreano-\d\.webp/, (r) => r.fulfill({ status: 404, body: '' }));
    // l'avviso arriva appena la pagina è letta, prima che la camicia che si muove sia pronta
    await page.addInitScript((d) => document.addEventListener('DOMContentLoaded', () => document.dispatchEvent(new CustomEvent('endero:camicia', { detail: d }))), { ...SENZA, ...TUTTO });
    await page.goto(PAGINA + '&rigida', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => 'viva' in document.querySelector('.configura__palco').dataset, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
    const presto = await page.evaluate(() => [...document.querySelectorAll('.configura__addosso .vesti__pezzo')].length);
    controlla('un avviso arrivato prima della camicia che si muove vale anche per lei', presto >= 3, `${presto} pezzi`);
    await manda(page, { ...TUTTO, collo: 'coreano' });
    await page.waitForTimeout(600);
    const resta = await page.evaluate(() => [...document.querySelectorAll('.configura__vesti .vesti__posto--collo img, .configura__addosso .vesti__posto--collo img')].map((im) => im.getAttribute('src').split('/').pop().split('?')[0]));
    controlla('se il file del collo manca, resta il collo di prima, su ogni livello', resta.length === 2 && resta.every((s) => s.startsWith('collo-francese')), JSON.stringify(resta));
    controlla('e nessun errore (a parte la richiesta non trovata)', errori.length === 0, errori.join(' | '));
    await contesto.close();
  }

  // ---------------------------------------------------------------- 6. colli con il loro posto per le iniziali
  // (l'italiano può essere un oggetto senza file; i riquadri possono avere misure diverse). Dati di prova messi qui
  console.log('Colli con il loro posto per le iniziali');
  {
    const P = JSON.parse(JSON.stringify(D));
    P.colli.italiano = { iniziali: P.iniziali.collo };
    P.colli.coreano = { file: P.colli.coreano.file, riquadro: [620, 215, 820, 360], iniziali: { centro: [700, 300], gradi: 10, alta: 6 } };
    const a = await nuovo(COMPUTER[0][1], '&rigida'), { page } = a;
    await page.route(/opzioni\/opzioni\.json/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(P) }));
    await page.reload({ waitUntil: 'networkidle' });
    await pronta(page);
    const sulCollo = { posizione: 'collo', lettere: 'EDR' };
    await manda(page, { collo: 'italiano', taschino: false, iniziali: sulCollo });
    await posata(page);
    await page.waitForTimeout(500);
    const it = await scartoFerma(page, { collo: 'italiano', iniziali: sulCollo }, P);
    controlla('l\'italiano come oggetto senza file: nessun pezzo, le iniziali al posto del collo', it.s.pezzi.length === 0 && it.lettere <= 6 * 0.3 * it.k, `${it.s.pezzi.length} pezzi, lettere a ${it.lettere.toFixed(2)}`);
    await manda(page, { collo: 'coreano', taschino: false, iniziali: sulCollo });
    await posata(page);
    await page.waitForTimeout(500);
    const co = await scartoFerma(page, { collo: 'coreano', iniziali: sulCollo }, P);
    controlla('il coreano con un riquadro di misura diversa: al suo punto, e le iniziali al posto del coreano', co.max <= 0.5 && co.lettere <= 6 * 0.3 * co.k, `${co.max.toFixed(3)} punti, lettere ${co.lettere.toFixed(2)}`);
    controlla('nessun errore', a.errori.length === 0, a.errori.join(' | '));
    await a.contesto.close();
  }

  // ---------------------------------------------------------------- 7. il tessuto colora la camicia (dal 2026-11-26)
  console.log('Il tessuto colora la camicia');
  const [cx, cy] = L.pezzi.camicia;
  /** Il colore di un punto del fotogramma sulla camicia tinta (la tela ritagliata, sul livello della camicia che dondola). */
  const colore = (page, x, y) => page.evaluate(([x, y, cx, cy]) => {
    const c = [...document.querySelectorAll('.configura__addosso canvas.vesti__tinta')].pop();
    if (!c) return null;
    const d = c.getContext('2d').getImageData(Math.round((x - cx) * 2), Math.round((y - cy) * 2), 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }, [x, y, cx, cy]);
  const chiaro = (c) => (c ? (c[0] + c[1] + c[2]) / 3 : -1);
  const tinta = (page, quante = 1, attesa = 12000) => page.waitForFunction((n) => document.querySelectorAll('.configura__addosso canvas.vesti__tinta').length === n && (n === 0 || !!window.__vesti?.stato?.stoffa), quante, { timeout: attesa }).then(() => true, () => false);
  const PETTO = [600, 520], TASCA = [(D.taschino.riquadro[0] + D.taschino.riquadro[2]) / 2, (D.taschino.riquadro[1] + D.taschino.riquadro[3]) / 2 + 10], POLSO = [495, 852];
  const SCURO = 't0515', BIANCO = 't0501';
  for (const [modo, cerca] of [['stoffa accesa', '&comunque'], ['rigida', '&rigida']]) {
    const a = await nuovo(COMPUTER[0][1], cerca), { page } = a;
    await pronta(page);
    const perTinta = () => a.richieste.filter((u) => /trame\.json|\/stoffe\/|\/trama-|\/maschera-/.test(u)).map((u) => u.split('/').pop().split('?')[0]);
    controlla(`${modo}: finché non si sceglie un tessuto non si scarica nulla per tingere`, perTinta().length === 0, perTinta().join(', '));
    const caricate0 = await page.evaluate(() => window.__caricate);
    await manda(page, { tessuto: SCURO });
    controlla(`${modo}: scelto un tessuto, la camicia tinta compare`, await tinta(page));
    await page.waitForTimeout(500);
    let s = await page.evaluate(() => ({ ferma: document.querySelectorAll('.configura__vesti canvas.vesti__tinta').length, chiave: window.__vesti.stato.stoffa?.chiave, bianca: getComputedStyle(document.querySelector('.configura__addosso').previousElementSibling).opacity, classe: document.querySelector('.configura__addosso').classList.contains('vesti--tinta') }));
    const petto = await colore(page, ...PETTO);
    controlla(`${modo}: è del tessuto scelto (blu notte: ${petto})`, chiaro(petto) < 90 && petto[3] === 255 && s.ferma === 1 && /t0515\|t0515\|t0515$/.test(s.chiave), JSON.stringify({ petto, ...s }));
    const scaricati = perTinta();
    controlla(`${modo}: scarica una volta la trama, la maschera e il campione del tessuto`, ['trame.json', 'trama-base.png', 'maschera-base.png', 't0515.webp'].every((f) => scaricati.filter((x) => x === f).length === 1), scaricati.join(', '));
    if (modo === 'rigida') controlla('rigida: sotto la tinta la camicia bianca e i pezzi bianchi non si vedono', s.bianca === '0' && s.classe, JSON.stringify(s));
    else controlla('stoffa accesa: la tinta è entrata nella stoffa che ondeggia', (await page.evaluate(() => window.__caricate)) > caricate0 && (await rosa(page)) < 110, `${await rosa(page)}`);
    await foto(page, `tinta-${modo.split(' ')[0]}-blu`);
    // taschino e polsini con un tessuto loro; il corpo bianco
    await manda(page, { tessuto: BIANCO, taschino: true, taschino_tessuto: SCURO, polsino_tessuto: SCURO, collo: 'francese' });
    await page.waitForFunction(() => /t0501\|t0515\|t0515$/.test(window.__vesti.stato.stoffa?.chiave || ''), null, { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(500);
    const [p1, p2, p3] = [await colore(page, ...PETTO), await colore(page, ...TASCA), await colore(page, ...POLSO)];
    controlla(`${modo}: corpo bianco (${chiaro(p1).toFixed(0)}), taschino (${chiaro(p2).toFixed(0)}) e polsino (${chiaro(p3).toFixed(0)}) del loro tessuto`, chiaro(p1) > 150 && chiaro(p2) < 90 && chiaro(p3) < 90, JSON.stringify([p1, p2, p3]));
    s = await page.evaluate(() => ({ tele: document.querySelectorAll('canvas.vesti__tinta').length, chiave: window.__vesti.stato.stoffa?.chiave }));
    controlla(`${modo}: una tela per livello, senza tele rimaste appese (con il collo francese nella chiave)`, s.tele === 2 && /collo:francese/.test(s.chiave), JSON.stringify(s));
    await foto(page, `tinta-${modo.split(' ')[0]}-tasca-polsini`);
    // la guida alle misure: la tinta si toglie (camicia bianca di riferimento, velata) e poi torna
    await page.focus('.misura[data-guida="torace"] input');
    await page.waitForTimeout(2200);
    const inGuida = await page.evaluate(() => ({ tinta: +getComputedStyle(document.querySelector('.configura__vesti .vesti__posto--stoffa')).opacity, velo: +getComputedStyle(document.querySelector('.configura__velo')).opacity, pezzi: document.querySelectorAll('.configura__vesti img.vesti__pezzo').length }));
    controlla(`${modo}: nella guida alle misure la tinta si toglie e restano i pezzi bianchi, velati`, inGuida.tinta < 0.02 && inGuida.velo > 0.4 && inGuida.pezzi >= 2, JSON.stringify(inGuida));
    await foto(page, `tinta-${modo.split(' ')[0]}-guida`);
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(2200);
    const dopo = await page.evaluate(() => +getComputedStyle(document.querySelector('.configura__vesti .vesti__posto--stoffa')).opacity);
    controlla(`${modo}: chiusa la guida la tinta torna`, dopo > 0.98, String(dopo));
    // un tessuto che non c'è: la camicia torna bianca, con il suo collo e il suo taschino
    await manda(page, { tessuto: 'zzz', taschino: true, collo: 'francese' });
    controlla(`${modo}: con un tessuto senza campione la camicia torna bianca`, await tinta(page, 0), JSON.stringify(await page.evaluate(() => window.__vesti.stato.stoffa?.chiave)));
    await page.waitForTimeout(400);
    s = await page.evaluate(() => ({ bianca: getComputedStyle(document.querySelector('.configura__addosso').previousElementSibling).opacity, pezzi: document.querySelectorAll('.configura__addosso img.vesti__pezzo').length, classe: document.querySelector('.configura__addosso').classList.contains('vesti--tinta') }));
    controlla(`${modo}: e tornano la camicia bianca e i suoi pezzi`, s.bianca === '1' && s.pezzi === 2 && !s.classe, JSON.stringify(s));
    controlla(`${modo}: nessun errore`, a.errori.length === 0, a.errori.join(' | '));
    await a.contesto.close();
  }
  // sul telefono
  {
    const a = await nuovo(TELEFONO[0][1], '&rigida'), { page } = a;
    await pronta(page);
    await manda(page, { tessuto: SCURO, taschino: true, taschino_tessuto: BIANCO });
    const ok = await tinta(page);
    await page.waitForTimeout(500);
    const [p1, p2] = [await colore(page, ...PETTO), await colore(page, ...TASCA)];
    controlla(`telefono: la camicia si tinge, con il taschino del suo tessuto (${chiaro(p1).toFixed(0)}, ${chiaro(p2).toFixed(0)})`, ok && chiaro(p1) < 90 && chiaro(p2) > 150, JSON.stringify([p1, p2]));
    controlla('telefono: la pagina non si allarga', (await larga(page)) === TELEFONO[0][1].viewport.width);
    controlla('telefono: nessun errore', a.errori.length === 0, a.errori.join(' | '));
    await foto(page, 'tinta-telefono');
    await a.contesto.close();
  }
  // la rotella «filo che cuce»: compare se una scelta fa aspettare, e poi va via
  {
    const a = await nuovo(COMPUTER[0][1], '&rigida'), { page } = a;
    await pronta(page);
    await page.route(/trama-base\.png/, async (r) => { await new Promise((f) => setTimeout(f, 1800)); r.continue(); });
    await manda(page, { tessuto: SCURO });
    await page.waitForTimeout(900);
    const r1 = await page.evaluate(() => { const r = document.querySelector('.configura__cucitura'); if (!r || r.hidden) return null; const q = r.getBoundingClientRect(); return { testo: r.textContent.trim(), ruolo: r.getAttribute('role'), dentro: q.left >= 0 && q.right <= innerWidth && q.top >= 0 && q.bottom <= innerHeight }; });
    controlla(`la rotella compare mentre si aspetta: «${r1?.testo}»`, r1?.testo === 'Dacci un minuto, stiamo cucendo le ultime parti' && r1.ruolo === 'status' && r1.dentro, JSON.stringify(r1));
    await foto(page, 'rotella');
    const ok = await tinta(page);
    await page.waitForTimeout(300);
    controlla('finito, la rotella va via e la camicia è tinta', ok && await page.evaluate(() => document.querySelector('.configura__cucitura').hidden));
    controlla('rotella: nessun errore', a.errori.length === 0, a.errori.join(' | '));
    await a.contesto.close();
  }
  // senza scheda grafica la camicia resta bianca, con i suoi pezzi, senza errori
  {
    const contesto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await contesto.newPage();
    const errori = [];
    page.on('console', (m) => { if (m.type() === 'error') errori.push(m.text()); });
    page.on('pageerror', (e) => errori.push(String(e)));
    await page.addInitScript(() => { const prima = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (tipo, ...a) { return /webgl/.test(tipo) ? null : prima.call(this, tipo, ...a); }; });
    await page.goto(PAGINA + '&rigida', { waitUntil: 'networkidle' });
    await pronta(page);
    await manda(page, { tessuto: SCURO, taschino: true, collo: 'francese' });
    await page.waitForTimeout(1500);
    const s = await page.evaluate(() => ({ tele: document.querySelectorAll('canvas.vesti__tinta').length, pezzi: document.querySelectorAll('.configura__addosso img.vesti__pezzo').length, rotella: !!document.querySelector('.configura__cucitura:not([hidden])') }));
    controlla('senza scheda grafica: niente tinta, i pezzi bianchi ci sono, la rotella non resta', s.tele === 0 && s.pezzi === 2 && !s.rotella, JSON.stringify(s));
    controlla('senza scheda grafica: nessun errore', errori.length === 0, errori.join(' | '));
    await contesto.close();
  }
  // ---- ciò che ha trovato la revisione del 2026-11-26: la tinta deve reggere a una scheda grafica che si perde, a un
  // file che non arriva e a un file che manca
  const MARRONE = 't0513';
  const contesti = (page) => page.addInitScript(() => {
    window.__gl = [];
    const prima = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...a) { const c = prima.call(this, tipo, ...a); if (c && /webgl/.test(tipo) && !window.__gl.includes(c)) window.__gl.push(c); return c; };
  });
  {
    // la scheda grafica si riprende il contesto della tinta (telefono in secondo piano): il tessuto dopo tinge lo stesso
    const contesto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await contesto.newPage();
    const errori = [];
    page.on('pageerror', (e) => errori.push(String(e)));
    await contesti(page);
    await page.goto(PAGINA + '&rigida', { waitUntil: 'networkidle' });
    await pronta(page);
    await manda(page, { tessuto: SCURO });
    await tinta(page); await posata(page);
    const persi = await page.evaluate(() => { let n = 0; for (const c of window.__gl) if (!c.canvas.isConnected) { c.getExtension('WEBGL_lose_context')?.loseContext(); n++; } return n; });
    await page.waitForTimeout(300);
    await manda(page, { tessuto: BIANCO });
    await posata(page); await page.waitForTimeout(600);
    const dopo = await colore(page, ...PETTO);
    controlla('persa la scheda grafica della tinta, il tessuto scelto dopo colora lo stesso la camicia', persi === 1 && chiaro(dopo) > 150, `${persi} contesti persi, petto ${JSON.stringify(dopo)}`);
    controlla('scheda grafica persa: nessun errore', errori.length === 0, errori.join(' | '));
    await contesto.close();
  }
  {
    // un campione che non arriva mai, poi un altro tessuto: la camicia prende il secondo e la rotella non resta accesa
    const a = await nuovo(COMPUTER[0][1], '&rigida'), { page } = a;
    await pronta(page);
    await page.route(new RegExp(`/stoffe/${MARRONE}\\.webp`), () => {});             // (mai una risposta)
    await manda(page, { tessuto: MARRONE });
    await page.waitForTimeout(1200);
    const gira = await page.evaluate(() => !!document.querySelector('.configura__cucitura:not([hidden])'));
    await manda(page, { tessuto: SCURO });
    const ok = await tinta(page);
    await posata(page); await page.waitForTimeout(500);
    const s = await page.evaluate(() => ({ rotella: !!document.querySelector('.configura__cucitura:not([hidden])'), chiave: window.__vesti.stato.stoffa?.chiave || '' }));
    controlla('un campione che non arriva: la rotella gira; scelto un altro tessuto la camicia lo prende e la rotella va via', gira && ok && !s.rotella && s.chiave.includes(SCURO), JSON.stringify({ gira, ok, ...s }));
    await a.contesto.close();
  }
  {
    // un campione che manca (404) dopo un tessuto già sulla camicia: la camicia non resta del tessuto di prima (torna
    // bianca), e quando il file torna si tinge da sola, senza toccare nulla
    const a = await nuovo(COMPUTER[0][1], '&rigida'), { page } = a;
    await pronta(page);
    await manda(page, { tessuto: SCURO });
    await tinta(page); await posata(page);
    let manca = true;
    await page.route(new RegExp(`/stoffe/${MARRONE}\\.webp`), (r) => (manca ? r.fulfill({ status: 404, body: '' }) : r.continue()));
    await manda(page, { tessuto: MARRONE });
    await posata(page); await page.waitForTimeout(700);
    const senza = await page.evaluate(() => ({ stoffa: !!window.__vesti.stato.stoffa, tele: document.querySelectorAll('.configura__addosso canvas.vesti__tinta').length, rotella: !!document.querySelector('.configura__cucitura:not([hidden])') }));
    controlla('un campione che manca: la camicia non resta del tessuto di prima, torna bianca, senza rotella', !senza.stoffa && senza.tele === 0 && !senza.rotella, JSON.stringify(senza));
    manca = false;
    const torna = await page.waitForFunction((id) => (window.__vesti.stato.stoffa?.chiave || '').includes(id), MARRONE, { timeout: 12000 }).then(() => true, () => false);
    controlla('quando il campione torna, la camicia si tinge da sola', torna);
    await a.contesto.close();
  }
  {
    // una scheda grafica che non basta alla tinta (manca l'estensione): un tentativo solo, non un contesto a ogni scelta
    const contesto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await contesto.newPage();
    const errori = [];
    page.on('pageerror', (e) => errori.push(String(e)));
    await contesti(page);
    await page.addInitScript(() => {
      for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
        if (!C) continue;
        const prima = C.prototype.getExtension;
        C.prototype.getExtension = function (nome) { return nome === 'EXT_shader_texture_lod' ? null : prima.call(this, nome); };
      }
    });
    await page.goto(PAGINA + '&comunque', { waitUntil: 'networkidle' });
    await pronta(page);
    const prima = await page.evaluate(() => window.__gl.length);
    for (const id of [SCURO, BIANCO, MARRONE, SCURO, BIANCO, MARRONE]) { await manda(page, { tessuto: id }); await posata(page); await page.waitForTimeout(250); }
    const s = await page.evaluate(() => ({ contesti: window.__gl.length, vivi: window.__gl.filter((c) => !c.isContextLost()).length, tele: document.querySelectorAll('canvas.vesti__tinta').length, onda: !!document.querySelector('.configura__onda') }));
    controlla('scheda grafica che non basta alla tinta: un tentativo solo (rilasciato), la camicia resta bianca e il tessuto che ondeggia resta', s.contesti <= prima + 1 && s.vivi <= prima && s.tele === 0 && s.onda, JSON.stringify({ prima, ...s }));
    controlla('scheda grafica che non basta: nessun errore', errori.length === 0, errori.join(' | '));
    await contesto.close();
  }
  {
    // Dalla seconda revisione del 26: (1) un collo più piccolo (coreano, diplomatico) dipinge la parete dove quello di
    // base non c'è più: lì la foto non è camicia e non va tinta (veniva una riga quasi nera lungo le spalle); (2) su un
    // rigato contrastato il disegno arriva fino al bordo e alle cuciture (prima lì c'era il colore medio: un profilo rosa)
    const a = await nuovo(COMPUTER[0][1], '&rigida'), { page } = a;
    await pronta(page);
    const tela = () => page.evaluate(() => { const c = [...document.querySelectorAll('.configura__addosso canvas.vesti__tinta')].pop(); window.__prima = window.__ora; window.__ora = c.getContext('2d').getImageData(0, 0, c.width, c.height); });
    await manda(page, { tessuto: BIANCO, collo: 'coreano' }); await tinta(page); await posata(page); await page.waitForTimeout(500); await tela();
    await manda(page, { tessuto: 't2408', collo: 'coreano' }); await posata(page); await page.waitForTimeout(700); await tela();
    const parete = await page.evaluate(() => {
      const a = window.__prima.data, b = window.__ora.data;
      let parete = 0, cambiati = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (a[i + 3] < 250 || a[i + 2] < 60 || (a[i + 2] - a[i]) / a[i + 2] < 0.62) continue;       // (la parete: blu pieno)
        parete++;
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 45) cambiati++;
      }
      return { parete, cambiati };
    });
    controlla('collo coreano: la parete dipinta dal collo non prende il colore del tessuto', parete.parete > 1000 && parete.cambiati < 80, JSON.stringify(parete));
    await manda(page, { tessuto: 't2920' }); await posata(page); await page.waitForTimeout(700); await tela();
    const rosa = await page.evaluate(() => {
      const { data: d, width: w, height: h } = window.__ora;
      const vuoto = (x, y) => x < 0 || y < 0 || x >= w || y >= h || d[(y * w + x) * 4 + 3] < 40;
      let fascia = 0, rosa = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] < 250) continue;
        if (!(vuoto(x - 5, y) || vuoto(x + 5, y) || vuoto(x, y - 5) || vuoto(x, y + 5))) continue;       // (solo il contorno)
        const R = d[i], G = d[i + 1], B = d[i + 2];
        if (R < 60 || Math.abs(G - B) > 40) continue;                                                // (ombre profonde, gruccia)
        fascia++;
        const s = (R - Math.min(G, B)) / R;                                                          // 0 bianco, 0.8 rosso
        if (s > 0.28 && s < 0.52) rosa++;
      }
      return { fascia, rosa, parte: +(rosa / fascia).toFixed(3) };
    });
    controlla('rigato rosso e bianco: sul contorno ci sono le righe, non una fascia di colore medio', rosa.fascia > 5000 && rosa.parte < 0.55, JSON.stringify(rosa));
    await a.contesto.close();
  }
  {
    // Dalla seconda revisione del 26: nei campi di spalle (spalla, lunghezza dietro) la camicia tinta si scioglie PRIMA
    // del giro (il filmato è della camicia bianca: partendo subito la tinta spariva di colpo), e uscendo il velo resta
    // finché la camicia non è di nuovo di fronte; solo allora velo e tinta si scambiano, in dissolvenza (prima: due
    // secondi di camicia bianca piena e la tinta che tornava di colpo). In un browser senza la scheda grafica finta:
    // con quella, dopo lo zoom, le dissolvenze non avanzano e i numeri non dicono nulla.
    const altro = await chromium.launch();
    const contesto = await altro.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await contesto.newPage();
    await page.addInitScript(() => {
      window.__log = []; let ultimo = '';
      window.__azzera = () => { window.__log.length = 0; ultimo = ''; };       // (lo stato di adesso si riscrive subito)
      setInterval(() => {
        const q = document.querySelector('.configura__palco'); if (!q) return;
        const op = (s) => { const e = q.querySelector(s); return e ? +(+getComputedStyle(e).opacity).toFixed(2) : -1; };
        const v = { girata: 'girata' in q.dataset, ferma: 'guidaFerma' in q.dataset, tinta: op('.configura__vesti .vesti__posto--stoffa'), velo: op('.configura__velo') };
        const s = JSON.stringify(v);
        if (s !== ultimo) { ultimo = s; window.__log.push(v); }
      }, 30);
    });
    await page.goto(PAGINA + '&rigida', { waitUntil: 'networkidle' });
    await pronta(page);
    await manda(page, { tessuto: SCURO });
    const tinta_ok = await tinta(page);
    await posata(page); await page.waitForTimeout(800);
    await page.evaluate(() => window.__azzera());
    await page.focus('.misura[data-guida="spalla"] input');
    await page.waitForFunction(() => 'girata' in document.querySelector('.configura__palco').dataset, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3500);
    const entrata = await page.evaluate(() => window.__log.slice());
    const alGiro = entrata.find((v) => v.girata);
    controlla('campo di spalle: la tinta si scioglie prima che la camicia si giri', tinta_ok && !!alGiro && entrata.filter((v) => !v.girata).some((v) => v.tinta > 0.2 && v.tinta < 0.8) && entrata.filter((v) => !v.girata).at(-1).tinta <= 0.12, JSON.stringify(entrata.filter((v) => !v.girata).slice(-3)));
    await page.evaluate(() => window.__azzera());
    await page.waitForTimeout(80);
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForFunction(() => !('guidaFerma' in document.querySelector('.configura__palco').dataset), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);
    const uscita = await page.evaluate(() => window.__log.slice());
    const diSpalle = uscita.filter((v) => v.girata), poi = uscita.filter((v) => !v.girata && v.ferma), ripresa = uscita.find((v) => !v.girata && !v.ferma);
    controlla('uscendo da un campo di spalle il velo resta finché la camicia non si è rigirata', diSpalle.length > 0 && diSpalle.every((v) => v.velo >= 0.4 && v.tinta <= 0.05), JSON.stringify(diSpalle.slice(-2)));
    controlla('poi velo e tinta si scambiano in dissolvenza, e solo dopo la camicia riparte', poi.some((v) => v.tinta > 0.15 && v.tinta < 0.9) && !!ripresa && ripresa.tinta >= 0.9 && ripresa.velo <= 0.1, JSON.stringify({ poi: poi.slice(0, 3), ripresa }));
    await altro.close();
  }
  // le iniziali: il corsivo inglese (proprietario, 2026-11-27) e il filo del colore scelto dal cliente
  {
    const FAMIGLIA = 'Endero Iniziali Inglese';
    const a = await nuovo(COMPUTER[0][1], '&rigida'), { page } = a;
    await pronta(page);
    await manda(page, { iniziali: { posizione: 'cuore', lettere: 'NP' } });
    await posata(page);
    await page.waitForTimeout(900);
    const filo = () => page.evaluate(() => [...document.querySelectorAll('.configura__addosso .vesti__iniziali text, .configura__vesti .vesti__iniziali text')].map((x) => x.getAttribute('fill')).filter((f) => f && f.startsWith('#')));
    let s = await page.evaluate((f) => ({ attributo: document.querySelector('.vesti__iniziali')?.getAttribute('font-family') || '', pronto: document.fonts.check(`20px "${f}"`) && [...document.fonts].some((x) => x.family.replace(/"/g, '') === f && x.status === 'loaded') }), FAMIGLIA);
    controlla(`iniziali: scritte in «${FAMIGLIA}», carattere scaricato dal sito`, s.attributo.includes(FAMIGLIA) && s.pronto, JSON.stringify(s));
    const prima = await filo();
    controlla('iniziali: finché non si sceglie il colore il filo è blu Endero', prima.length > 0 && prima.every((f) => f === '#0f285e'), JSON.stringify(prima));
    await manda(page, { iniziali: { posizione: 'cuore', lettere: 'NP', colore: '#FFFFFF' } });
    await posata(page);
    await page.waitForTimeout(700);
    const dopo = await filo();
    controlla('iniziali: con un colore scelto il filo è di quel colore', dopo.length > 0 && dopo.every((f) => f === '#ffffff'), JSON.stringify(dopo));
    await manda(page, { iniziali: { posizione: 'cuore', lettere: 'NP', colore: 'url(javascript:1)' } });
    await posata(page);
    await page.waitForTimeout(700);
    const strano = await filo();
    controlla('iniziali: un colore che non è un colore torna al blu Endero', strano.length > 0 && strano.every((f) => f === '#0f285e'), JSON.stringify(strano));
    controlla('iniziali: nessun errore', a.errori.length === 0, a.errori.join(' | '));
    const altri = a.richieste.filter((u) => /iniziali-(corsivo|romano)/.test(u));
    controlla('iniziali: gli altri due caratteri non si scaricano più', altri.length === 0, altri.join(', '));
    await a.contesto.close();
  }

  await browser.close();
  console.log(`\n${passati} controlli passati, ${falliti.length} falliti`);
  if (falliti.length) { console.log(falliti.map((f) => ' - ' + f).join('\n')); process.exitCode = 1; }
})();
