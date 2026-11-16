// Pagina del configuratore: la camicia è un film calcolato prima con Blender (camicia/film/), come l'apertura.
// A riposo si vede un'immagine ferma. Quando il mouse le passa sopra parte una folata dal lato da cui arriva:
// sono due scene registrate, "da sinistra" e "da destra", e ognuna parte dalla camicia ferma e ci ritorna.
// Senza JavaScript, con il movimento ridotto o con il risparmio dati resta l'immagine ferma, e il riquadro
// delle misure funziona lo stesso.

const palco = document.querySelector('[data-film]');
if (palco) avvia(palco);

function avvia(palco) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData) return;
  const scene = {};
  for (const v of palco.querySelectorAll('video[data-scena]')) scene[v.dataset.scena] = v;
  if (!scene['da-sinistra'] || !scene['da-destra']) return;

  // sul telefono il film è ritagliato in verticale intorno alla camicia: si scarica solo quello che serve
  const stretto = matchMedia('(max-width: 599px)');
  const carica = () => {
    for (const v of Object.values(scene)) {
      const file = stretto.matches ? v.dataset.telefono : v.dataset.computer;
      if (v.getAttribute('src') !== file) { v.classList.remove('configura__film--vivo'); v.src = file; v.load(); }
    }
  };
  carica();
  stretto.addEventListener('change', carica);

  // Una scena dura quattro secondi: la folata, il dondolio che si smorza, il ritorno a riposo. Una folata nuova può
  // partire quando la camicia è quasi ferma (dopo 3,4 secondi si sposta ormai di pochi millimetri): prima no, o la
  // camicia salterebbe da dov'è alla posizione di riposo.
  const QUASI_FERMA = 3.4;
  let attiva = null;
  /** Fa partire la folata di una scena, se quella di prima è ormai passata. */
  function soffia(nome) {
    const v = scene[nome];
    if (v.readyState < 3) return false;                                   // non è ancora scaricata abbastanza
    if (attiva && !attiva.ended && !attiva.paused && attiva.currentTime < QUASI_FERMA) return false;
    if (attiva && attiva !== v) { attiva.pause(); attiva.classList.remove('configura__film--vivo'); }
    v.currentTime = 0;
    v.classList.add('configura__film--vivo');
    v.play().catch(() => {});
    attiva = v;
    return true;
  }
  // finita la scena si torna all'immagine ferma, che è identica al suo ultimo fotogramma
  for (const v of Object.values(scene)) v.addEventListener('ended', () => v.classList.remove('configura__film--vivo'));

  // Il mouse: conta solo quando passa sulla camicia.
  // Il verso in cui si muove dice da che lato arriva il vento.
  // Nel fotogramma largo la camicia, con la sua ombra, sta tra il 15 e il 56% della larghezza.
  let ultimaX = null;
  const ferma = palco.querySelector('.configura__ferma');
  const sullaCamicia = (e) => {
    if (stretto.matches) return true;
    const r = ferma.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
    return x > 0.15 && x < 0.56;
  };
  palco.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (ultimaX !== null && sullaCamicia(e) && Math.abs(e.clientX - ultimaX) >= 2) {
      if (soffia(e.clientX > ultimaX ? 'da-sinistra' : 'da-destra')) palco.dataset.toccata = '';
    }
    ultimaX = e.clientX;
  });
  palco.addEventListener('pointerleave', () => { ultimaX = null; });

  // Il dito: una strisciata dà il verso; un tocco soffia dal lato in cui si tocca.
  let giu = null;
  palco.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') giu = e.clientX; });
  palco.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' || giu === null) return;
    const corsa = e.clientX - giu, r = palco.getBoundingClientRect();
    const daSinistra = Math.abs(corsa) > 12 ? corsa > 0 : e.clientX < r.left + r.width / 2;
    if (soffia(daSinistra ? 'da-sinistra' : 'da-destra')) palco.dataset.toccata = '';
    giu = null;
  });
  palco.addEventListener('pointercancel', () => { giu = null; });         // il dito ha fatto scorrere la pagina

  // Appena è pronta, un soffio: dice che la camicia è viva. Una volta sola, e solo se la si sta guardando.
  let salutata = false;
  const saluta = () => {
    if (salutata || document.hidden) return;
    const r = palco.getBoundingClientRect();
    if (r.bottom < 80 || r.top > innerHeight - 80) return;
    salutata = soffia('da-sinistra');
  };
  scene['da-sinistra'].addEventListener('canplaythrough', () => setTimeout(saluta, 700), { once: true });
}
