// La camicia leggera: l'immagine di Blender, ritagliata, che dondola appena con gruccia e nastro.
// PROVA (2026-11-18): si apre con ?prova=leggera nell'indirizzo (anche leggera-a, più lieve, e leggera-c, più ampia).
//
// Il proprietario, provata la camicia in diretta (viva.js): "rendiamoci più semplice. Rendi il movimento molto più
// leggero, la gruccia si muove. Non far muovere così tanto il tessuto perché sembra finto e poco naturale", e sul suo
// computer andava a scatti. Qui non c'è 3D e non c'è fisica della stoffa: il tessuto non si deforma affatto.
// L'immagine ferma di Blender è divisa in tre pezzi (camicia/leggera/ritaglia.py): la parete, l'ombra della camicia e
// la camicia con gruccia e nastro. Quando il mouse le passa sopra, la camicia fa quello che fa una camicia appesa
// sfiorata con la mano: dondola appena sul nastro, di lato e verso la parete, e si gira di un niente; la sua ombra
// la segue sulla parete. Sono due immagini spostate dal browser (trasformazioni CSS): non pesa e non può andare a scatti.
// Ferma, è l'immagine di Blender punto per punto.

const RITMO = 0.6;          // il dondolio va più piano del vero: il proprietario ha voluto il movimento "molto più lento"
const PENDOLO = 2.86, FRENO = 1.25, TORSIONE = 2.3, FRENO_TORSIONE = 1.7;      // gli stessi del film e della camicia in diretta
// Finché la mano la tocca, la camicia la segue, di poco: di lato per una piccola parte della strada che fa la mano
// (`segue`), verso la parete di un niente (`fondo`, radianti), e si gira dalla parte in cui la si tocca (`torce`,
// radianti a un palmo dal nastro). Quando la mano la lascia, dondola libera e si ferma. Circa un quarto di prima.
const MANO = { segue: 0.05, fondo: 0.006, torce: 0.04, presa: 540, freno: 46, scivola: 1.5 };
// un tocco fermo (un clic, un dito appoggiato e tolto): la spinta che riceve, di lato, verso la parete e in torsione
const COLPETTO = { lato: 0.04, fondo: 0.03, torce: 0.45 };
const LIMITE = { lato: 0.03, fondo: 0.03, torce: 0.09 };                       // radianti: oltre non va, comunque la si muova
const VIVA = 'configura__posa--viva';

// ---------------------------------------------------------------------------------------------- conti

/** Matrici scritte per righe: prodotto di due matrici (righe di a per colonne di b). */
const per = (a, b) => a.map((riga) => b[0].map((_, j) => riga.reduce((s, v, k) => s + v * b[k][j], 0)));
const sposta = (x, y, z) => [[1, 0, 0, x], [0, 1, 0, y], [0, 0, 1, z], [0, 0, 0, 1]];
const giraX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0, 0], [0, c, -s, 0], [0, s, c, 0], [0, 0, 0, 1]]; };
const giraY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s, 0], [0, 1, 0, 0], [-s, 0, c, 0], [0, 0, 0, 1]]; };
const giraZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0, 0], [s, c, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]; };
/** L'inversa di una matrice 3 x 3. */
function inversa([[a, b, c], [d, e, f], [g, h, i]]) {
  const A = e * i - f * h, B = f * g - d * i, C = d * h - e * g, det = a * A + b * B + c * C;
  return [[A / det, (c * h - b * i) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, (c * d - a * f) / det], [C / det, (b * g - a * h) / det, (a * e - b * d) / det]];
}
const stringi = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * @param {HTMLElement} palco  il palco della camicia, con l'immagine ferma dentro
 * @param {string} dove        la cartella dei file, per esempio "/camicia/leggera/"
 * @param {number} quanto      quanto si muove: 1 è la misura di mezzo
 * @param {string} versione    l'impronta dei file, messa dal build: quando i pezzi si rifanno il browser non usa i vecchi
 */
export async function leggera(palco, dove, quanto = 1, versione = '') {
  const ridotto = matchMedia('(prefers-reduced-motion: reduce)');
  if (ridotto.matches || navigator.connection?.saveData) return;
  const v = versione ? '?v=' + versione : '';
  const D = await (await fetch(dove + 'leggera.json' + v)).json();
  const [FL, FA] = D.fotogramma, [rx, , rw] = D.pezzi.parete;

  // --- il riquadro del fotogramma in cui camicia e ombra si muovono, sopra l'immagine ferma (stesse misure della pagina)
  const riquadro = document.createElement('div');
  riquadro.className = 'configura__posa configura__posa--strati';
  riquadro.setAttribute('aria-hidden', 'true');
  palco.style.setProperty('--posa-x', rx / FL); palco.style.setProperty('--posa-w', rw / FL);
  palco.style.setProperty('--posa-x-tel', (rx - 336) / 750); palco.style.setProperty('--posa-w-tel', rw / 750);
  // dentro, un piano che misura in punti del fotogramma: lo si rimpicciolisce tutto insieme quanto serve
  const piano = document.createElement('div');
  piano.className = 'configura__strati';
  piano.style.width = rw + 'px'; piano.style.height = FA + 'px';
  riquadro.append(piano);
  palco.querySelector('.configura__ferma').closest('picture').after(riquadro);
  // (l'altezza vera, con i decimali: arrotondata, in fondo al fotogramma i pezzi sarebbero fuori posto di un quarto di punto)
  const misura = () => { const k = riquadro.getBoundingClientRect().height / FA; if (k > 0) piano.style.transform = `scale(${k})`; return k; };

  // --- i tre pezzi, nella grandezza più vicina a quella dello schermo
  const serve = () => { const punti = riquadro.getBoundingClientRect().height * (window.devicePixelRatio || 1) * 0.92; return D.taglie.find((t) => t * FA >= punti) || D.taglie[D.taglie.length - 1]; };
  const file = (nome, t) => `${dove}${nome}-${String(t).replace('.', '')}.webp${v || '?v=' + D.versione}`;
  /** Un'immagine pronta da mostrare (dove `decode` non c'è o si rifiuta, basta che sia caricata). */
  const caricata = (indirizzo) => {
    const im = new Image();
    im.decoding = 'async'; im.src = indirizzo;
    return im.decode().catch(() => new Promise((ok, no) => { if (im.complete && im.naturalWidth) ok(); else { im.onload = ok; im.onerror = no; } })).then(() => im);
  };
  let taglia = serve();
  const NOMI = ['parete', 'ombra', 'camicia'];
  let pezzi;
  try { pezzi = await Promise.all(NOMI.map((nome) => caricata(file(nome, taglia)))); } catch { riquadro.remove(); return; }
  pezzi.forEach((im, i) => {
    const [x, y, w, h] = D.pezzi[NOMI[i]];
    im.alt = ''; im.draggable = false;
    im.style.left = x - rx + 'px'; im.style.top = y + 'px'; im.style.width = w + 'px'; im.style.height = h + 'px';
  });
  const [parete, ombra, camicia] = pezzi;
  piano.append(parete, ombra, camicia);
  misura();
  // se la finestra cresce (o passa su uno schermo più fitto) servono pezzi più grandi, come fa da sé l'immagine ferma
  let cambio = false;
  const ingrandisci = async () => {
    const t = serve();
    if (cambio || t <= taglia) return;
    cambio = true;
    try { await Promise.all(NOMI.map((nome) => caricata(file(nome, t)))); NOMI.forEach((nome, i) => { pezzi[i].src = file(nome, t); }); taglia = t; } catch { /* restano quelli di prima */ }
    cambio = false;
  };

  // --- la scena, com'è in Blender: la camera, il piano della camicia, la parete, il sole
  const C = D.camera, G = D.gancio, ancora = [G[0], G[1] + D.ancora, G[2]], sole = D.sole;
  // da un punto della scena al punto del fotogramma (per la terza riga si divide)
  const camera = [C[0].map((v, j) => (v + C[3][j]) * FL / 2), C[1].map((v, j) => (C[3][j] - v) * FA / 2), C[3]];
  // la camicia sta, a un dipresso, sul piano verticale che passa per il gancio: di lì a qui, la matrice 4 x 3
  const sulPiano = [[1, 0, 0], [0, 1, 0], [0, 0, G[2]], [0, 0, 1]];
  // l'ombra: ogni punto scivola lungo i raggi del sole fino alla parete
  const sx = sole[0] / sole[2], sy = sole[1] / sole[2], zp = D.parete;
  const cameraOmbra = per(camera, [[1, 0, -sx, zp * sx], [0, 1, -sy, zp * sy], [0, 0, 0, zp], [0, 0, 0, 1]]);
  const daFerma = inversa(per(camera, sulPiano)), daFermaOmbra = inversa(per(cameraOmbra, sulPiano));
  // quanti punti del fotogramma fa un metro sul piano della camicia, e dove passa il nastro nel fotogramma
  const alMetro = camera[0][0] / (C[3][2] * G[2] + C[3][3]), asse = (() => { const a = per(camera, [[G[0]], [G[1]], [G[2]], [1]]); return a[0][0] / a[2][0]; })();
  /** Dove sta la camicia appesa: dondola intorno al punto in cui il nastro è fissato, e gira sul nastro. */
  const pendolo = (torce, lato, fondo) => per(per(sposta(...ancora), per(per(giraZ(lato), giraX(fondo)), giraY(torce))), sposta(-ancora[0], -ancora[1], -ancora[2]));
  /** La trasformazione CSS che porta un pezzo da dove sta fermo a dove sta ora (una matrice 3 x 3 sul fotogramma). */
  const css = (m, [x, y]) => {
    // dal fotogramma al pezzo: l'origine è il suo angolo in alto a sinistra
    const h = per(per([[1, 0, -x], [0, 1, -y], [0, 0, 1]], m), [[1, 0, x], [0, 1, y], [0, 0, 1]]), n = h[2][2];
    return `matrix3d(${h[0][0] / n},${h[1][0] / n},0,${h[2][0] / n},${h[0][1] / n},${h[1][1] / n},0,${h[2][1] / n},0,0,1,0,${h[0][2] / n},${h[1][2] / n},0,1)`;
  };
  const p = { lato: 0, fondo: 0, torce: 0, vLato: 0, vFondo: 0, vTorce: 0 };
  const disegna = () => {
    const mossa = per(pendolo(p.torce, p.lato, p.fondo), sulPiano);
    camicia.style.transform = css(per(per(camera, mossa), daFerma), D.pezzi.camicia);
    ombra.style.transform = css(per(per(cameraOmbra, mossa), daFermaOmbra), D.pezzi.ombra);
  };

  // --- la mano e il dondolio
  const mano = { sopra: false, x: 0, y: 0, vx: 0, vy: 0, mossa: 0, preme: 0, fuoriAsse: 0, strada: 0, tiene: false };
  const energia = () => Math.abs(p.lato) + Math.abs(p.fondo) + Math.abs(p.torce) * 0.3 + (Math.abs(p.vLato) + Math.abs(p.vFondo) + Math.abs(p.vTorce) * 0.3) * 0.5;
  // dove la mano vorrebbe la camicia, finché la tocca
  const meta = { lato: 0, fondo: 0, torce: 0 };
  const fisica = (dt) => {
    if (mano.preme > 0.02) {
      if (!mano.tiene) { mano.tiene = true; meta.lato = p.lato; }               // un tocco nuovo parte da dove la camicia si trova
      // la strada fatta dalla mano dall'ultimo conto, vista dal punto in cui il nastro è fissato (il petto sta un metro sotto)
      const tetto = LIMITE.lato * quanto * 0.8;
      meta.lato = stringi(meta.lato + MANO.segue * quanto * mano.strada / 1.1, -tetto, tetto);
      meta.lato -= meta.lato * dt / MANO.scivola;                              // la mano non trattiene: il tessuto le scivola sotto
      mano.strada = 0;
      // verso la parete e in torsione va quanto la mano è decisa: sfiorata pianissimo quasi non cede (e l'ombra non si muove da sola)
      const decisa = Math.min(1, Math.hypot(mano.vx, mano.vy) / 0.5);
      meta.fondo = MANO.fondo * quanto * decisa;
      meta.torce = MANO.torce * quanto * decisa * mano.fuoriAsse / 0.25;
      // la presa della mano: una molla ben smorzata, così la camicia la segue subito ma senza strappi
      for (const [ang, vel] of [['lato', 'vLato'], ['fondo', 'vFondo'], ['torce', 'vTorce']]) p[vel] += (MANO.presa * (meta[ang] - p[ang]) - MANO.freno * p[vel]) * mano.preme * dt;
    } else { mano.tiene = false; mano.strada = 0; }
    // quando il dondolio è ormai di un millimetro si spegne più in fretta, così si ferma senza scatto e senza strascichi
    const coda = mano.preme > 0.01 ? 1 : 1 + 5 * Math.max(0, 1 - energia() / (0.004 * quanto));
    for (const [ang, vel, w, fr] of [['lato', 'vLato', PENDOLO, FRENO], ['fondo', 'vFondo', PENDOLO, FRENO], ['torce', 'vTorce', TORSIONE, FRENO_TORSIONE]]) {
      p[vel] += (-w * w * p[ang] - fr * coda * p[vel]) * dt;
      // al limite si ferma lì, senza slancio: non ci resta appoggiata
      const tetto = LIMITE[ang] * quanto, nuovo = p[ang] + p[vel] * dt;
      if (Math.abs(nuovo) > tetto) { p[ang] = Math.sign(nuovo) * tetto; p[vel] = 0; } else p[ang] = nuovo;
    }
  };
  // per le prove il tempo si può far avanzare a comando (?manuale): allora niente va avanti da solo
  const manuale = new URLSearchParams(location.search).has('manuale');
  const prossimo = () => (manuale ? -1 : requestAnimationFrame(passo));
  let finto = 0;
  const adesso = () => (manuale ? finto : performance.now());
  let corre = 0, prima = 0, quieta = 0;
  const passo = (ora) => {
    const vero = stringi((ora - prima) / 1000, 0.001, 0.034);
    prima = ora;
    // la mano: tocca finché si muove sulla camicia; ferma o uscita, lascia
    const manoFerma = ora - mano.mossa > 160;
    const vuole = mano.sopra && !manoFerma ? Math.min(1, Math.hypot(mano.vx, mano.vy) / 0.18) : 0;
    mano.preme += (vuole - mano.preme) * Math.min(1, vero * (vuole > mano.preme ? 12 : 5));
    if (manoFerma) { mano.vx *= 0.8; mano.vy *= 0.8; }
    let resta = vero * RITMO;
    while (resta > 1e-5) { const dt = Math.min(resta, 1 / 120); fisica(dt); resta -= dt; }
    quieta = energia() + mano.preme * 0.01 < 0.00015 ? quieta + vero : 0;
    if (quieta < 0.3) { disegna(); corre = prossimo(); return; }
    // ferma: i pezzi tornano esattamente al loro posto e non si calcola più niente
    corre = 0; p.lato = p.fondo = p.torce = p.vLato = p.vFondo = p.vTorce = 0;
    camicia.style.transform = ''; ombra.style.transform = '';
  };
  let attiva = false;                                  // i pezzi sono in vista e la camicia risponde
  const sveglia = () => {
    quieta = 0;
    if (corre || ridotto.matches) return;
    prima = adesso(); corre = prossimo();
  };

  /** Dove sta un punto dello schermo nel fotogramma, e se lì c'è la camicia (la sagoma a caselle di ritaglia.py). */
  const sulFotogramma = (e) => {
    const r = riquadro.getBoundingClientRect(), x = rx + (e.clientX - r.left) / r.width * rw, y = (e.clientY - r.top) / r.height * FA;
    const riga = D.sagoma.righe[Math.floor(y / D.sagoma.passo)], casella = Math.floor(x / D.sagoma.passo);
    // `metri`: quanto vale sulla camicia un punto dello schermo
    return { x, y, sopra: r.height > 0 && !!riga && casella >= riga[0] && casella < riga[1], metri: FA / (r.height || 1) / alMetro };
  };
  /** La mano è nel punto dello schermo dell'evento. */
  const tocca = (e) => {
    if (!attiva || ridotto.matches) return;
    const ora = adesso(), q = sulFotogramma(e);
    if (mano.sopra && q.sopra) {
      const dt = Math.max(0.004, (ora - mano.mossa) / 1000), vx = (e.clientX - mano.x) * q.metri / dt, vy = (e.clientY - mano.y) * q.metri / dt;
      mano.vx += (vx - mano.vx) * 0.5; mano.vy += (vy - mano.vy) * 0.5;
      mano.strada += (e.clientX - mano.x) * q.metri;
      palco.dataset.toccata = '';                      // l'invito ha fatto il suo lavoro
    }
    // quanto lontano dal nastro tocca, in metri: da lì viene la torsione
    if (q.sopra) mano.fuoriAsse = stringi((q.x - asse) / alMetro, -0.3, 0.3);
    mano.sopra = q.sopra; mano.x = e.clientX; mano.y = e.clientY; mano.mossa = ora;
    if (q.sopra) sveglia();
  };
  /** Un tocco fermo (un clic, un dito appoggiato e tolto): un colpetto leggero. Toccata da un lato, va verso l'altro. */
  let premuto = null;
  const colpetto = (e) => {
    if (!attiva || ridotto.matches) return;
    if (premuto && Math.hypot(e.clientX - premuto.x, e.clientY - premuto.y) > 6) return;     // era una passata, non un tocco
    const q = sulFotogramma(e);
    if (!q.sopra) return;
    const fuori = stringi((q.x - asse) / alMetro, -0.3, 0.3), verso = fuori > 0 ? -1 : 1;
    // La spinta non si somma a quelle di prima: dieci tocchi di fila non la mandano più lontano di uno. Ogni tocco
    // porta il dondolio, al più, all'ampiezza che avrebbe con un tocco solo da ferma (`quanta` diviso la frequenza)
    const spingi = (ang, vel, frequenza, quanta) => {
      const ampiezza = Math.abs(quanta) / frequenza, resta = Math.sqrt(Math.max(0, ampiezza * ampiezza - p[ang] * p[ang])) * frequenza;
      p[vel] = quanta > 0 ? Math.max(p[vel], resta) : Math.min(p[vel], -resta);
    };
    spingi('lato', 'vLato', PENDOLO, verso * COLPETTO.lato * quanto);
    spingi('fondo', 'vFondo', PENDOLO, COLPETTO.fondo * quanto);
    spingi('torce', 'vTorce', TORSIONE, COLPETTO.torce * fuori * quanto);
    palco.dataset.toccata = '';
    sveglia();
  };
  // mouse e penna: la mano è dove sta il puntatore
  palco.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') tocca(e); });
  palco.addEventListener('pointerleave', () => { mano.sopra = false; });
  palco.addEventListener('click', colpetto);
  // il dito: conta quando si muove di lato sulla camicia; in verticale è la pagina che scorre. Appoggiato e tolto, è un colpetto
  let dito = null;
  palco.addEventListener('pointerdown', (e) => {
    premuto = { x: e.clientX, y: e.clientY };
    if (e.pointerType === 'touch') { dito = { x: e.clientX, y: e.clientY, diLato: false }; mano.sopra = false; }
  });
  palco.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch' || !dito) return;
    const dx = e.clientX - dito.x, dy = e.clientY - dito.y;
    // di lato appena il dito ha fatto più strada in orizzontale che in verticale, anche se era partito un po' storto.
    // Da lì la pagina non deve più scorrere sotto il dito (lo scorrimento morbido legge lo stesso gesto: glielo si dice)
    if (!dito.diLato && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) { dito.diLato = true; palco.setAttribute('data-lenis-prevent-touch', ''); }
    if (dito.diLato) tocca(e);
  });
  const alza = () => { dito = null; mano.sopra = false; palco.removeAttribute('data-lenis-prevent-touch'); };
  palco.addEventListener('pointerup', alza); palco.addEventListener('pointercancel', alza);
  // tenendo premuto col dito non deve aprirsi il menu dell'immagine
  palco.addEventListener('contextmenu', (e) => { if (e.pointerType && e.pointerType !== 'mouse') e.preventDefault(); });
  const STRATI = 'configura__palco--strati';
  let comparsa = 0;
  const mostra = () => {
    riquadro.classList.add(VIVA); palco.classList.add(STRATI);
    // risponde quando i pezzi hanno finito di comparire: prima, muovendosi, si vedrebbero due camicie
    clearTimeout(comparsa);
    comparsa = setTimeout(() => { attiva = true; palco.dataset.viva = ''; }, 520);
  };
  ridotto.addEventListener('change', () => {
    if (!ridotto.matches) { mostra(); return; }
    clearTimeout(comparsa); attiva = false; mano.sopra = false; delete palco.dataset.viva;
    cancelAnimationFrame(corre); corre = 0; p.lato = p.fondo = p.torce = p.vLato = p.vFondo = p.vTorce = 0;
    camicia.style.transform = ''; ombra.style.transform = ''; riquadro.classList.remove(VIVA); palco.classList.remove(STRATI);
  });
  new ResizeObserver(() => { misura(); ingrandisci(); }).observe(riquadro);

  // --- pronta: i pezzi prendono il posto dell'immagine ferma (sono gli stessi punti: non si nota) e ci restano, così
  //     quando la si tocca non cambia niente se non il movimento; poi compare l'invito a passarci sopra
  mostra();
  if (manuale) window.__camicia = { p, mano, sveglia, get taglia() { return taglia; }, passo: (ms) => { finto += ms; if (corre) passo(finto); return !!corre; } };
}
