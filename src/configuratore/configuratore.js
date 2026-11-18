// Pagina del configuratore: la camicia è un film calcolato prima con Blender (camicia/film/), come l'apertura.
// A riposo si vede un'immagine ferma. Quando il mouse le passa sopra, la camicia si muove come toccata da una mano
// che passa dal lato da cui arriva il mouse: sono due scene registrate, "da sinistra" e "da destra", e ognuna parte
// dalla camicia ferma e ci ritorna. Senza JavaScript, con il movimento ridotto o con il risparmio dati resta
// l'immagine ferma, e il riquadro delle misure funziona lo stesso.

import { libera } from './libera.js';
import { viva } from './viva.js';

const palco = document.querySelector('[data-film]');
if (palco) avvia(palco);

function avvia(palco) {
  // PROVA (si decide col proprietario quale dei due modi tenere): con ?prova=libera nell'indirizzo la camicia non è
  // un filmato che parte, ma segue il mouse in diretta (libera.js).
  if (palco.dataset.pose && new URLSearchParams(location.search).get('prova') === 'libera') { libera(palco, palco.dataset.pose); return; }
  // PROVA: con ?prova=viva la camicia è in diretta: la forma si muove con la fisica della stoffa e sopra ci stanno
  // proiettate le immagini di Blender (viva.js). Se qualcosa va storto resta l'immagine ferma.
  if (palco.dataset.vera && new URLSearchParams(location.search).get('prova') === 'viva') { viva(palco, palco.dataset.vera).catch((e) => console.error(e)); return; }
  const scene = {};
  for (const v of palco.querySelectorAll('video[data-scena]')) scene[v.dataset.scena] = v;
  if (!scene['da-sinistra'] || !scene['da-destra']) return;
  const tutte = Object.values(scene);
  const ferma = palco.querySelector('.configura__ferma');
  const VIVO = 'configura__film--vivo';

  // Una scena dura otto secondi: il tocco, il dondolio lento che si smorza, il ritorno a riposo. Un tocco nuovo può
  // partire quando la camicia è quasi ferma (dopo 6,8 secondi si sposta ormai di pochi millimetri): prima no, o la
  // camicia salterebbe da dov'è alla posizione di riposo.
  const QUASI_FERMA = 6.8;
  let attiva = null, guardia = 0, daUtente = false;

  /** Rimette la camicia a riposo: l'immagine ferma torna in vista e un tocco nuovo può partire. */
  const riposa = (v) => {
    v.classList.remove(VIVO);
    if (attiva === v) { attiva = null; clearTimeout(guardia); }
  };

  // Con il movimento ridotto o il risparmio dati la camicia resta ferma e i film non si scaricano; la preferenza può
  // cambiare a pagina aperta. Sul telefono il film è ritagliato in verticale: si scarica solo quello che serve.
  // `data-viva` dice al foglio di stile che la camicia risponde: solo allora compare l'invito a passarci sopra.
  const ridotto = matchMedia('(prefers-reduced-motion: reduce)'), stretto = matchMedia('(max-width: 599px)');
  const arma = () => {
    if (ridotto.matches || navigator.connection?.saveData) {
      for (const v of tutte) { v.pause(); riposa(v); }
      delete palco.dataset.viva;
      return;
    }
    for (const v of tutte) {
      const file = stretto.matches ? v.dataset.telefono : v.dataset.computer;
      if (v.getAttribute('src') !== file) { riposa(v); v.src = file; v.load(); }
    }
    palco.dataset.viva = '';
  };
  arma();
  ridotto.addEventListener('change', arma);
  stretto.addEventListener('change', arma);

  /**
   * Fa partire il tocco di una scena, se quello di prima è ormai passato. `gesto`: l'ha chiesto il visitatore.
   * Il film compare quando sta davvero andando: su iPhone i video non si scaricano finché non li si fa partire,
   * e nel frattempo deve restare l'immagine ferma.
   */
  function tocca(nome, gesto) {
    if (!('viva' in palco.dataset)) return false;
    const v = scene[nome];
    if (attiva && !attiva.ended && !attiva.paused && attiva.currentTime < QUASI_FERMA) return false;
    if (attiva && attiva !== v) { const prima = attiva; attiva = null; prima.pause(); prima.classList.remove(VIVO); }
    if (v.error) v.load();
    if (v.readyState >= 1) v.currentTime = 0;
    attiva = v; daUtente = gesto;
    if (v.readyState >= 3) v.classList.add(VIVO);
    // se la scena non arriva in fondo (la rete cade, il sistema la sospende) la camicia non deve restare bloccata
    clearTimeout(guardia);
    guardia = setTimeout(() => { if (attiva === v && !v.ended) v.pause(); }, 14000);
    // il browser può non lasciarla partire (risparmio energetico, riproduzione automatica spenta): resta l'immagine
    // ferma, e si riprova al prossimo gesto vero, cioè un clic o un tocco
    v.play().catch(() => riposa(v));
    return true;
  }
  for (const v of tutte) {
    v.addEventListener('playing', () => {
      if (attiva !== v) return;
      v.classList.add(VIVO);
      if (daUtente) palco.dataset.toccata = '';                          // l'invito ha fatto il suo lavoro
    });
    // finita la scena si torna all'immagine ferma, che è identica al suo ultimo fotogramma
    v.addEventListener('ended', () => v.classList.remove(VIVO));
    v.addEventListener('pause', () => { if (!v.ended) riposa(v); });      // fermata a metà: dal sistema o dalla guardia
    v.addEventListener('error', () => riposa(v));
  }
  // tornando alla pagina con "Indietro" il browser può ridarla com'era, con una scena ferma a metà
  addEventListener('pageshow', (e) => { if (e.persisted) for (const v of tutte) { v.pause(); riposa(v); } });

  // Dove sta la camicia: nel fotogramma largo tra il 25 e il 54% della larghezza e tra il 14 e il 95% dell'altezza
  // (in quello verticale del telefono, tra il 16 e l'84% della larghezza).
  const posto = (e) => {
    const r = ferma.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    const [da, a] = stretto.matches ? [0.16, 0.84] : [0.25, 0.54];
    return { sopra: y > 0.14 && y < 0.95 && x > da && x < a, aSinistra: x < (da + a) / 2 };
  };
  /** Da che lato arriva la mano: lo dice il verso del movimento; se è quasi verticale, il lato in cui ci si trova. */
  const lato = (dx, dy, aSinistra) => ((Math.abs(dx) >= 3 && Math.abs(dx) >= Math.abs(dy) * 0.5 ? dx > 0 : aSinistra) ? 'da-sinistra' : 'da-destra');

  // Il mouse. Il tocco parte quando il mouse arriva sulla camicia; se c'è già sopra, quando si sposta di qualche
  // pixel dal punto in cui stava (anche pianissimo: i pixel si contano dal punto fermo, non da un evento all'altro).
  let fuori = null, fermo = null;
  palco.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const qui = [e.clientX, e.clientY], p = posto(e);
    if (!p.sopra) { fuori = qui; fermo = null; return; }
    const da = fuori || fermo;
    if (!da) { fermo = qui; return; }
    const dx = qui[0] - da[0], dy = qui[1] - da[1];
    if (!fuori && Math.hypot(dx, dy) < 6) return;
    fuori = null;
    tocca(lato(dx, dy, p.aSinistra), true);
    fermo = qui;
  });
  palco.addEventListener('pointerleave', () => { fuori = null; fermo = null; });

  // Il dito: una strisciata di lato dà il verso; un tocco fermo vale come una mano che arriva dal lato in cui si
  // tocca. Una strisciata in verticale è la pagina che scorre, e non conta.
  let giu = null;
  palco.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') giu = [e.clientX, e.clientY]; });
  palco.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' || !giu) return;
    const dx = e.clientX - giu[0], dy = e.clientY - giu[1], r = palco.getBoundingClientRect();
    giu = null;
    if (Math.abs(dy) > Math.max(10, Math.abs(dx))) return;
    tocca(Math.abs(dx) > 12 ? (dx > 0 ? 'da-sinistra' : 'da-destra') : (e.clientX < r.left + r.width / 2 ? 'da-sinistra' : 'da-destra'), true);
  });
  palco.addEventListener('pointercancel', () => { giu = null; });
  // Un clic sulla camicia è un gesto vero: fa partire la scena anche dove il browser non lascia partire i video da soli.
  palco.addEventListener('click', (e) => {
    const p = posto(e);
    if (p.sopra) tocca(p.aSinistra ? 'da-sinistra' : 'da-destra', true);
  });

  // Appena è pronta, la camicia si muove una volta da sola: dice che è viva. Solo se la si sta guardando.
  let salutata = false;
  const saluta = () => {
    if (salutata || document.hidden) return;
    const r = palco.getBoundingClientRect();
    if (r.bottom < 80 || r.top > innerHeight - 80) return;
    salutata = tocca('da-sinistra', false);
  };
  scene['da-sinistra'].addEventListener('canplaythrough', () => setTimeout(saluta, 700), { once: true });
  setTimeout(saluta, 2500);                                               // su iPhone "pronta" non arriva mai da sola
  document.addEventListener('visibilitychange', () => setTimeout(saluta, 700));
}
