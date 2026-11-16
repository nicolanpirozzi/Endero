// Apertura "La cucitura": un film 3D calcolato in anticipo che avanza con lo scorrimento.
//
// Tre fasi, tutte guidate dalla posizione della pagina:
//   A  ripresa d'apertura: fotogrammi interi disegnati su una tela (primo piano, poi la camera sale);
//   B  vista dall'alto: una lunga immagine del tessuto scorre sotto la macchina, che resta ferma;
//   C  ricamo del logo: la macchina si sposta sul logo e lo ricama.
// Senza JavaScript, o con il movimento ridotto, tutto questo non parte: resta l'immagine ferma con il testo.

const VELOCITA_TESSUTO = 1.25;     // di quanto corre il tessuto rispetto allo scorrimento
const DURATA_APERTURA = 1.15;      // lunghezza della fase A, in altezze di schermo
const DURATA_RICAMO = 0.95;        // fase C
const DURATA_PAUSA = 0.5;          // logo finito: la macchina si ritira, poi si lascia la sezione
const AGO_Y_LARGO = 0.64;          // altezza dell'ago sugli schermi orizzontali
const MORBIDEZZA = 0.085;          // secondi: quanto in fretta l'immagine raggiunge lo scorrimento

const limita = (v, a, b) => Math.min(b, Math.max(a, v));
const liscio = (u) => { u = limita(u, 0, 1); return u * u * (3 - 2 * u); };
const misto = (a, b, t) => a + (b - a) * t;

function carica(src) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error('immagine non caricata: ' + src));
    img.src = src;
  });
}

function crea(tag, classe, genitore, attributi = {}) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  for (const [k, v] of Object.entries(attributi)) el.setAttribute(k, v);
  if (genitore) genitore.appendChild(el);
  return el;
}

export async function avviaApertura(radice) {
  // Quando il film non parte si mostra la versione ferma (apertura.css la tiene nascosta finché lo script decide).
  const ferma = () => radice.classList.add('apertura--ferma');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return ferma();
  if (navigator.connection && navigator.connection.saveData) return ferma();      // chi risparmia dati vede la versione ferma
  const base = radice.dataset.apertura.replace(/\/?$/, '/');
  let dati;
  try {
    dati = await (await fetch(base + 'film.json')).json();
  } catch (errore) {
    return ferma();                           // senza dati resta la versione ferma
  }
  const palco = radice.querySelector('.apertura__palco');
  const tessuto = radice.querySelector('.apertura__tessuto');
  const tela = radice.querySelector('.apertura__film');
  const telaMacchina = radice.querySelector('.apertura__macchina');
  const luce = radice.querySelector('.apertura__luce');
  const caricatore = radice.querySelector('.apertura__carica');
  const percento = radice.querySelector('.apertura__percento');
  const storia = radice.querySelector('.apertura__storia');
  if (!palco || !tessuto || !tela || !tela.getContext) return ferma();

  // ---------------------------------------------------------------- misure fisse del film
  const STR = dati.striscia;
  const S1 = dati.apertura.s_fine;                    // punto di cucitura a cui finisce la fase A
  const SF = dati.cucitura.punti + 0.5;               // fine della cucitura dritta
  const passo = dati.cucitura.passo;
  const riga0 = dati.cucitura.riga_inizio;
  const rigaFine = riga0 + passo * (SF - 0.5);
  const centroX = dati.cucitura.x;
  const scalaFilm = STR.larghezza / dati.apertura.lato;   // pixel della striscia per pixel del fotogramma
  const agoFilm = dati.apertura.ago_y * dati.apertura.lato;
  const PASSI = dati.ricamo.passi - 1;

  // ---------------------------------------------------------------- struttura
  tessuto.style.width = STR.larghezza + 'px';
  tessuto.style.height = STR.altezza + 'px';
  const fasce = crea('div', 'apertura__fasce', tessuto, { 'aria-hidden': 'true' });
  const colonna = crea('div', 'apertura__colonna', tessuto, { 'aria-hidden': 'true' });
  colonna.style.left = STR.colonna_x + 'px';
  colonna.style.width = STR.colonna_larghezza + 'px';
  const telaRicamo = crea('canvas', 'apertura__ricamo', tessuto, { 'aria-hidden': 'true', width: dati.ricamo.larghezza, height: dati.ricamo.altezza });
  telaRicamo.style.left = dati.ricamo.x + 'px';
  telaRicamo.style.top = dati.ricamo.riga + 'px';
  const immFasce = [];
  const immColonna = [];
  for (let i = 0; i < STR.fasce; i++) {
    const f = crea('img', '', fasce, { alt: '', width: STR.larghezza, height: STR.fascia, decoding: 'async' });
    f.style.top = i * STR.fascia + 'px';
    immFasce.push(f);
    const c = crea('img', '', colonna, { alt: '', width: STR.colonna_larghezza, height: STR.fascia, decoding: 'async' });
    c.style.top = i * STR.fascia + 'px';
    immColonna.push(c);
  }
  // la storia è testo vero: entra nel tessuto e scorre con lui, sotto ogni scritta ricamata
  const voci = [];
  if (storia) {
    tessuto.appendChild(storia);
    [...storia.children].forEach((voce, i) => {
      const cap = dati.capitoli[i];
      if (!cap) return;
      voce.dataset.lato = cap.lato;
      voce.style.top = cap.riga_sotto + 44 + 'px';
      voci.push({ el: voce, riga: cap.riga_sotto, op: -1 });
      if (cap.lato === 'sx') voce.style.right = STR.larghezza - cap.x + 'px';
      else voce.style.left = cap.x + 'px';
    });
  }
  telaMacchina.width = dati.macchina.larghezza;
  telaMacchina.height = dati.macchina.altezza;
  telaMacchina.style.width = dati.macchina.larghezza + 'px';
  telaMacchina.style.height = dati.macchina.altezza + 'px';
  const ctx = tela.getContext('2d');
  const ctxMacchina = telaMacchina.getContext('2d');
  const ctxRicamo = telaRicamo.getContext('2d');

  radice.classList.add('apertura--viva');

  // ---------------------------------------------------------------- misure che dipendono dallo schermo
  let vw = 0, vh = 0, k = 1, kLogo = 1, uscita = 700, nx = 0, ny = 0, modo = 'largo', film = null, panMax = 0, punteggiatura = 1;
  let LA = 0, LB = 0, LC = 0, LD = 0, L = 0;
  let sosta = [];

  function misura() {
    vw = palco.clientWidth;
    vh = palco.clientHeight;
    modo = vw >= vh ? 'largo' : 'alto';
    const rit = dati.ritagli[modo];
    const largo = rit.larghezza * scalaFilm, alto = rit.altezza * scalaFilm, sopra = (agoFilm - rit.y) * scalaFilm;
    k = Math.max(vw / largo, vh / alto);                // il fotogramma copre sempre tutto lo schermo
    if (modo === 'largo') {
      ny = limita(AGO_Y_LARGO * vh, vh - (alto - sopra) * k, sopra * k);
      film = { x: (vw - largo * k) / 2, y: ny - sopra * k, w: largo * k, h: alto * k };
    } else {
      const su = (vh - alto * k) / 2;
      ny = su + sopra * k;
      film = { x: (vw - largo * k) / 2, y: su, w: largo * k, h: alto * k };
    }
    nx = vw / 2;
    kLogo = Math.min(k, vw * 0.84 / (dati.ricamo.larghezza * 0.86));        // il logo occupa al massimo l'84 % della larghezza
    uscita = ny / k * 0.62;                                                  // quanto sale una frase prima di spegnersi
    radice.style.setProperty('--apertura-testo', (modo === 'alto' ? limita(15 / k, 34, 50) : 34).toFixed(0) + 'px');
    // sugli schermi stretti il tessuto si sposta di lato per mostrare intera la scritta del capitolo
    const mezza = vw / (2 * k);
    // quanto si allontanano dalla cucitura la scritta ricamata e la frase sotto (larga al massimo 640)
    const fin = (cap) => Math.abs(cap.x - centroX) + Math.max(cap.larghezza || 710, 640);
    const serve = (cap) => limita(fin(cap) + 36 - mezza, 0, Math.max(0, mezza - 44));
    panMax = Math.max(...dati.capitoli.map(serve));
    sosta = [[riga0 + passo * (S1 - 0.3), 0]];             // lo spostamento parte solo dopo la dissolvenza: i fotogrammi dell'apertura sono centrati
    for (const cap of dati.capitoli) {
      const centro = (cap.riga_base - cap.altezza_prima + cap.riga_sotto) / 2;
      const verso = (cap.lato === 'dx' ? -1 : 1) * serve(cap);
      sosta.push([centro - 300, verso], [centro + 320, verso]);
    }
    sosta.push([rigaFine, 0]);
    LA = DURATA_APERTURA * vh;
    LB = passo * (SF - S1) * k / VELOCITA_TESSUTO;
    LC = DURATA_RICAMO * vh;
    LD = DURATA_PAUSA * vh;
    L = LA + LB + LC + LD;
    radice.style.setProperty('--apertura-lunghezza', Math.round(L + vh) + 'px');
    punteggiatura = Math.min(window.devicePixelRatio || 1, 2);
    tela.width = Math.round(vw * punteggiatura);
    tela.height = Math.round(vh * punteggiatura);
    ultimo.film = -1;
  }

  function spostamento(riga) {
    if (panMax === 0) return 0;
    for (let i = 0; i < sosta.length - 1; i++) {
      const [r0, p0] = sosta[i], [r1, p1] = sosta[i + 1];
      if (riga <= r1) return misto(p0, p1, liscio((riga - r0) / Math.max(1, r1 - r0)));
    }
    return 0;
  }

  // ---------------------------------------------------------------- immagini
  const fotogrammi = new Array(dati.apertura.fotogrammi).fill(null);
  const fasi = new Array(dati.macchina.fasi).fill(null);
  const ricami = new Array(dati.ricamo.passi).fill(null);
  const pronti = dati.pronti || {};
  const nome = {
    film: (i) => `${base}ap-${modo}-${String(i).padStart(3, '0')}.webp`,
    fascia: (i) => `${base}str-${i}.webp`,
    colonna: (i) => `${base}col-${i}.webp`,
    macchina: (j) => `${base}mac-${j}.webp`,
    ricamo: (i) => `${base}ric-${String(i).padStart(2, '0')}.webp`,
  };
  const ultimo = { film: -1, fase: -1, ricamo: -1 };

  const prendi = {
    film: (i) => carica(nome.film(i)).then((img) => { fotogrammi[i] = img; ultimo.film = -1; }),
    macchina: (j) => carica(nome.macchina(j)).then((img) => { fasi[j] = img; ultimo.fase = -1; }),
    ricamo: (i) => carica(nome.ricamo(i)).then((img) => { ricami[i] = img; ultimo.ricamo = -1; }),
    fascia: (i) => carica(nome.fascia(i)).then((img) => { immFasce[i].src = img.src; }),
    colonna: (i) => carica(nome.colonna(i)).then((img) => { immColonna[i].src = img.src; }),
  };

  async function inCoda(lavori, paralleli, aOgniPasso) {
    let fatti = 0, indice = 0;
    const operaio = async () => {
      while (indice < lavori.length) {
        const lavoro = lavori[indice++];
        try { await lavoro(); } catch (errore) { /* un'immagine mancante non ferma il film */ }
        fatti++;
        if (aOgniPasso) aOgniPasso(fatti / lavori.length);
      }
    };
    await Promise.all(Array.from({ length: paralleli }, operaio));
  }

  // ---------------------------------------------------------------- disegno
  function vicino(lista, i) {                 // il fotogramma già caricato più vicino a quello voluto
    for (let d = 0; d < lista.length; d++) {
      if (lista[i - d]) return lista[i - d];
      if (lista[i + d]) return lista[i + d];
    }
    return null;
  }

  function disegna(y) {
    let s, p = 0;
    if (y < LA) s = S1 * y / LA;
    else if (y < LA + LB) s = S1 + (SF - S1) * (y - LA) / LB;
    else { s = SF; p = limita((y - LA - LB) / LC, 0, 1); }

    // fase A: i fotogrammi interi, che si dissolvono sul tessuto quando la camera è arrivata in alto
    // La dissolvenza cade sugli ultimi due fotogrammi, quando la camera è ormai ferma sulla vista dall'alto:
    // prima le due immagini non coincidono e la macchina si vedrebbe doppia.
    const opFilm = 1 - liscio((s - (S1 - 0.17)) / 0.3);
    tela.style.opacity = opFilm.toFixed(3);
    tela.style.visibility = opFilm > 0.001 ? 'visible' : 'hidden';
    if (opFilm > 0.001) {
      const i = limita(Math.floor(s * dati.apertura.per_punto + 1e-6), 0, fotogrammi.length - 1);
      if (i !== ultimo.film) {
        const img = vicino(fotogrammi, i);
        if (img) {
          ctx.drawImage(img, film.x * punteggiatura, film.y * punteggiatura, film.w * punteggiatura, film.h * punteggiatura);
          ultimo.film = i;
        }
      }
    }
    const sotto = s > S1 - 0.9;
    let kk = k;
    tessuto.toggleAttribute('data-visibile', sotto);
    telaMacchina.toggleAttribute('data-visibile', sotto);
    radice.style.setProperty('--apertura-invito', (1 - liscio(y / (0.3 * vh))).toFixed(3));
    if (!sotto) {
      // la pozza di luce scende verso l'ago mentre la camera sale: all'arrivo è già al suo posto
      luce.style.setProperty('--luce-x', '50%');
      luce.style.setProperty('--luce-y', misto(0.56 * vh, ny, liscio((s - (S1 - 4.5)) / 3.6)).toFixed(0) + 'px');
      return;
    }

    // fasi B e C: `riga` è la riga del tessuto che sta all'altezza `ay` dello schermo
    let riga = riga0 + passo * (s - 0.5), ay = ny, agoX = centroX, agoY = riga, fase = s - Math.floor(s), passoRicamo = 0;
    let pan = spostamento(riga);
    if (p > 0) {
      const arrivo = liscio(p / 0.22);
      riga = misto(rigaFine, dati.ricamo.centro[1], arrivo);        // il tessuto sale ancora finché il logo è al centro
      ay = misto(ny, vh * 0.5, arrivo);
      kk = misto(k, kLogo, arrivo);                                 // sugli schermi stretti ci si allontana per vedere il logo intero
      pan *= 1 - arrivo;
      const q = limita((p - 0.22) / 0.70, 0, 1);
      const kf = q * PASSI, k0 = Math.floor(kf), k1 = Math.min(PASSI, k0 + 1);
      passoRicamo = Math.round(kf);
      if (p <= 0.22) {
        agoX = misto(centroX, dati.ricamo.ago[0][0], arrivo);
        agoY = misto(rigaFine, dati.ricamo.ago[0][1], arrivo);
        fase = 0;
      } else {
        agoX = misto(dati.ricamo.ago[k0][0], dati.ricamo.ago[k1][0], kf - k0);
        agoY = misto(dati.ricamo.ago[k0][1], dati.ricamo.ago[k1][1], kf - k0);
        fase = q < 1 ? (kf * 2.5) % 1 : 0;
      }
    }

    const tx = nx + pan * kk - centroX * kk, ty = ay - riga * kk;
    tessuto.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${kk.toFixed(5)})`;
    // si tengono in pagina solo le fasce vicine allo schermo
    const prima = Math.floor((riga - ay / kk) / STR.fascia) - 1, dopo = Math.floor((riga + (vh - ay) / kk) / STR.fascia) + 1;
    for (let i = 0; i < STR.fasce; i++) {
      const mostra = i >= prima && i <= dopo ? '' : 'none';
      if (immFasce[i].style.display !== mostra) { immFasce[i].style.display = mostra; immColonna[i].style.display = mostra; }
    }
    // la colonna senza cucitura copre il tessuto dove l'ago non è ancora passato
    const cuciti = p > 0 ? dati.cucitura.punti : limita(Math.floor(s - 0.45), 0, dati.cucitura.punti);
    colonna.style.setProperty('--taglio', (riga0 + passo * cuciti).toFixed(1) + 'px');

    if (passoRicamo !== ultimo.ricamo) {
      const img = vicino(ricami, passoRicamo);
      if (img) { ctxRicamo.drawImage(img, 0, 0); ultimo.ricamo = passoRicamo; }
    }
    const j = Math.floor(fase * fasi.length) % fasi.length;
    if (j !== ultimo.fase) {
      const img = vicino(fasi, j);
      if (img) {
        ctxMacchina.clearRect(0, 0, telaMacchina.width, telaMacchina.height);
        ctxMacchina.drawImage(img, 0, 0);
        ultimo.fase = j;
      }
    }
    // a logo finito la macchina si ritira verso chi cuce ed esce dal basso dello schermo
    const fuga = limita((y - (LA + LB + LC * 0.95)) / (LC * 0.05 + LD * 0.8), 0, 1);
    const mx = nx + pan * kk + (agoX - centroX) * kk, myFermo = ay + (agoY - riga) * kk;
    const my = myFermo + fuga * fuga * (vh - myFermo + dati.macchina.ago[1] * kk + 40);
    telaMacchina.style.transform = `translate3d(${(mx - dati.macchina.ago[0] * kk).toFixed(2)}px, ${(my - dati.macchina.ago[1] * kk).toFixed(2)}px, 0) scale(${kk.toFixed(5)})`;
    telaMacchina.style.opacity = fuga < 1 ? '1' : '0';
    // ogni frase compare quando la sua scritta ricamata arriva all'ago e si spegne quando è passata
    for (const voce of voci) {
      const dist = voce.riga - riga;                    // > 0: la frase è ancora sotto l'ago
      const op = p > 0 ? 0 : liscio((330 - dist) / 260) * (1 - liscio((-dist - uscita) / 260));
      if (voce.op !== op) { voce.el.style.opacity = op.toFixed(3); voce.el.style.transform = `translate3d(0, ${((1 - op) * 26).toFixed(1)}px, 0)`; voce.op = op; }
    }
    luce.style.setProperty('--luce-x', (nx + pan * kk).toFixed(0) + 'px');
    luce.style.setProperty('--luce-y', ay.toFixed(0) + 'px');
  }

  // ---------------------------------------------------------------- ciclo
  let yMorbida = -1, prima = 0, attivo = true, richiesta = 0;

  function passoCiclo(ora) {
    richiesta = 0;
    const y = limita(-radice.getBoundingClientRect().top, 0, L);
    const dt = Math.min(0.1, (ora - prima) / 1000 || 0.016);
    prima = ora;
    // con lo scorrimento morbido del sito (Lenis) la posizione arriva già ammorbidita: niente secondo filtro
    if (yMorbida < 0 || Math.abs(y - yMorbida) < 0.4 || document.documentElement.classList.contains('lenis-smooth')) yMorbida = y;
    else yMorbida += (y - yMorbida) * (1 - Math.exp(-dt / MORBIDEZZA));
    disegna(yMorbida);
    if (attivo) richiesta = requestAnimationFrame(passoCiclo);
  }

  const osserva = new IntersectionObserver((voci) => {
    attivo = voci[0].isIntersecting;
    if (attivo && !richiesta) richiesta = requestAnimationFrame(passoCiclo);
  }, { rootMargin: '50% 0px' });

  let larghezzaNota = 0;
  function ridimensiona() {
    // sui telefoni l'altezza cambia quando compare la barra degli indirizzi: si rimisura solo se cambia la larghezza
    if (palco.clientWidth === larghezzaNota && modo === 'alto') return;
    larghezzaNota = palco.clientWidth;
    const modoPrima = modo;
    misura();
    if (modo !== modoPrima) fotogrammi.fill(null);
    ultimo.fase = ultimo.ricamo = -1;
  }

  misura();
  larghezzaNota = palco.clientWidth;
  window.addEventListener('resize', ridimensiona, { passive: true });

  // ---------------------------------------------------------------- caricamento: prima l'indispensabile, poi il resto
  // Subito: un fotogramma dell'apertura ogni quattro (quelli che mancano li sostituisce il più vicino),
  // una fase della macchina e il primo tratto di tessuto. Così l'attesa è breve e si può già scorrere tutto.
  const elenco = (chiave, n) => (pronti[chiave] || Array.from({ length: n }, (_, i) => i));
  const filmPronti = elenco('apertura', fotogrammi.length);
  const radi = filmPronti.filter((_, n) => n % 4 === 0 || n === filmPronti.length - 1);
  const fitti = filmPronti.filter((i) => !radi.includes(i));
  const leFasi = elenco('macchina', fasi.length);
  const leFasce = elenco('striscia', STR.fasce);
  const leColonne = elenco('colonna', STR.fasce);
  const subito = [
    ...radi.map((i) => () => prendi.film(i)),
    ...leFasi.slice(0, 1).map((j) => () => prendi.macchina(j)),
    ...leFasce.slice(0, 2).map((i) => () => prendi.fascia(i)),
    ...leColonne.slice(0, 2).map((i) => () => prendi.colonna(i)),
  ];
  const poi = [
    ...fitti.map((i) => () => prendi.film(i)),
    ...leFasi.slice(1).map((j) => () => prendi.macchina(j)),
    ...leFasce.slice(2).map((i) => () => prendi.fascia(i)),
    ...leColonne.slice(2).map((i) => () => prendi.colonna(i)),
    ...elenco('ricamo', ricami.length).map((i) => () => prendi.ricamo(i)),
  ];
  const inizio = performance.now();
  await inCoda(subito, 6, (quota) => {
    if (caricatore) caricatore.style.setProperty('--avanzamento', quota.toFixed(3));
    if (percento) percento.textContent = Math.round(quota * 100) + '%';
  });
  osserva.observe(radice);
  richiesta = requestAnimationFrame(passoCiclo);
  // il caricatore resta almeno mezzo secondo: sparire subito sembrerebbe un difetto
  setTimeout(() => caricatore && caricatore.setAttribute('data-fatto', ''), Math.max(0, 500 - (performance.now() - inizio)));
  inCoda(poi, 4);
}

const radice = document.querySelector('[data-apertura]');
if (radice) avviaApertura(radice);
