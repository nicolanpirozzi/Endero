// Pagina del configuratore: la camicia è un film calcolato prima con Blender (camicia/film/), come l'apertura.
// A riposo si vede un'immagine ferma. Quando il mouse le passa sopra, la camicia si muove come toccata da una mano
// che passa dal lato da cui arriva il mouse: sono due scene registrate, "da sinistra" e "da destra", e ognuna parte
// dalla camicia ferma e ci ritorna. Senza JavaScript, con il movimento ridotto o con il risparmio dati resta
// l'immagine ferma, e il riquadro delle misure funziona lo stesso.

const palco = document.querySelector('[data-film]');
if (palco) avvia(palco);

function avvia(palco) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData) return;
  const scene = {};
  for (const v of palco.querySelectorAll('video[data-scena]')) scene[v.dataset.scena] = v;
  if (!scene['da-sinistra'] || !scene['da-destra']) return;

  // sul telefono il film è ritagliato in verticale intorno alla camicia: si scarica solo quello che serve
  const stretto = matchMedia('(max-width: 599px)');
  const VIVO = 'configura__film--vivo';
  const carica = () => {
    for (const v of Object.values(scene)) {
      const file = stretto.matches ? v.dataset.telefono : v.dataset.computer;
      if (v.getAttribute('src') !== file) { v.classList.remove(VIVO); v.src = file; v.load(); }
    }
  };
  carica();
  stretto.addEventListener('change', carica);

  // Una scena dura quattro secondi: il tocco, il dondolio che si smorza, il ritorno a riposo. Un tocco nuovo può
  // partire quando la camicia è quasi ferma (dopo 3,4 secondi si sposta ormai di pochi millimetri): prima no, o la
  // camicia salterebbe da dov'è alla posizione di riposo.
  const QUASI_FERMA = 3.4;
  let attiva = null;
  // PROVA DELLE VELOCITÀ (si toglie quando il proprietario ha scelto): con ?lento=1.6 nell'indirizzo le scene vanno
  // 1,6 volte più piano. Serve a fargli scegliere dal vivo quanto rallentare, prima di rifare il calcolo.
  const lento = Math.min(3, Math.max(1, Number(new URLSearchParams(location.search).get('lento')) || 1));
  /**
   * Fa partire il tocco di una scena, se quello di prima è ormai passato.
   * Il film compare quando sta davvero andando: su iPhone i video non si scaricano finché non li si fa partire,
   * e nel frattempo deve restare l'immagine ferma.
   */
  function tocca(nome) {
    const v = scene[nome];
    if (attiva && !attiva.ended && !attiva.paused && attiva.currentTime < QUASI_FERMA) return false;
    if (attiva && attiva !== v) { attiva.pause(); attiva.classList.remove(VIVO); }
    if (v.readyState >= 1) v.currentTime = 0;
    v.playbackRate = 1 / lento;
    attiva = v;
    if (v.readyState >= 3) v.classList.add(VIVO);
    v.play().catch(() => { if (attiva === v) attiva = null; });        // il browser non l'ha lasciata partire: si riprova al prossimo gesto
    return true;
  }
  for (const v of Object.values(scene)) {
    v.addEventListener('playing', () => { if (attiva === v) v.classList.add(VIVO); });
    // finita la scena si torna all'immagine ferma, che è identica al suo ultimo fotogramma
    v.addEventListener('ended', () => v.classList.remove(VIVO));
  }

  // Il mouse: conta solo quando passa sulla camicia, che nel fotogramma largo sta tra il 25 e il 54% della larghezza
  // e tra il 14 e il 95% dell'altezza (in quello verticale del telefono, tra il 16 e l'84% della larghezza).
  // Il verso in cui si muove dice da che lato arriva la mano.
  let ultimaX = null;
  const ferma = palco.querySelector('.configura__ferma');
  const sullaCamicia = (e) => {
    const r = ferma.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    return y > 0.14 && y < 0.95 && (stretto.matches ? x > 0.16 && x < 0.84 : x > 0.25 && x < 0.54);
  };
  palco.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (ultimaX !== null && sullaCamicia(e) && Math.abs(e.clientX - ultimaX) >= 2) {
      if (tocca(e.clientX > ultimaX ? 'da-sinistra' : 'da-destra')) palco.dataset.toccata = '';
    }
    ultimaX = e.clientX;
  });
  palco.addEventListener('pointerleave', () => { ultimaX = null; });

  // Il dito: una strisciata dà il verso; un tocco fermo vale come una mano che arriva dal lato in cui si tocca.
  let giu = null;
  palco.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') giu = e.clientX; });
  palco.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' || giu === null) return;
    const corsa = e.clientX - giu, r = palco.getBoundingClientRect();
    const daSinistra = Math.abs(corsa) > 12 ? corsa > 0 : e.clientX < r.left + r.width / 2;
    if (tocca(daSinistra ? 'da-sinistra' : 'da-destra')) palco.dataset.toccata = '';
    giu = null;
  });
  palco.addEventListener('pointercancel', () => { giu = null; });         // il dito ha fatto scorrere la pagina

  // Appena è pronta, la camicia si muove una volta da sola: dice che è viva. Solo se la si sta guardando.
  let salutata = false;
  const saluta = () => {
    if (salutata || document.hidden) return;
    const r = palco.getBoundingClientRect();
    if (r.bottom < 80 || r.top > innerHeight - 80) return;
    salutata = tocca('da-sinistra');
  };
  scene['da-sinistra'].addEventListener('canplaythrough', () => setTimeout(saluta, 700), { once: true });
  setTimeout(saluta, 2500);                                               // su iPhone "pronta" non arriva mai da sola
  document.addEventListener('visibilitychange', () => setTimeout(saluta, 700));
}
