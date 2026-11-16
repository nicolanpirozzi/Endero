// Pagina del configuratore. Questo file è piccolo e non conosce three.js: decide se il 3D può partire,
// mostra il caricamento e solo allora scarica il motore (camicia3d.js) e il modello.
// Senza JavaScript, senza WebGL o con il risparmio dati resta l'immagine ferma della camicia, e il riquadro funziona lo stesso.

const palco = document.querySelector('[data-camicia]');
if (palco) avvia(palco);

function puoFare3d() {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

async function avvia(palco) {
  const dati = palco.dataset;
  if (!puoFare3d() || navigator.connection?.saveData) { dati.stato = 'ferma'; return; }

  const inizio = performance.now();
  const percento = palco.querySelector('[data-percento]');
  let quota = 0;
  const segna = (q) => {
    quota = Math.max(quota, Math.min(q, 1));
    palco.style.setProperty('--avanzamento', quota.toFixed(3));
    if (percento) percento.textContent = Math.round(quota * 100) + '%';
  };
  dati.stato = 'carica';
  segna(0.04);

  const prova = new URLSearchParams(location.search);
  try {
    const { avviaCamicia } = await import(dati.motore);       // il motore 3D arriva solo qui
    segna(0.22);
    const camicia = await avviaCamicia(palco.querySelector('[data-tela]'), {
      modello: dati.camicia,
      peso: Number(dati.peso) || 0,                           // il server comprime: la lunghezza vera la dice la pagina
      avanzamento: (quota) => segna(0.22 + 0.74 * quota),
      fermo: matchMedia('(prefers-reduced-motion: reduce)').matches,
      manuale: prova.has('manuale'),
      grezzo: prova.has('grezzo'),
      colonna: palco,                                         // la tela può essere più larga del palco: la camicia sta qui
    });
    segna(1);
    window.__camicia = camicia;                               // per le prove automatiche
    // il caricatore resta almeno mezzo secondo: sparire subito sembrerebbe un difetto
    setTimeout(() => { dati.stato = 'viva'; }, Math.max(0, 500 - (performance.now() - inizio)));
    // l'invito a trascinare se ne va al primo gesto
    camicia.tela.addEventListener('pointerdown', () => { dati.toccata = ''; }, { once: true });
  } catch (errore) {
    console.error('camicia 3D non avviata', errore);
    dati.stato = 'ferma';
  }
}
