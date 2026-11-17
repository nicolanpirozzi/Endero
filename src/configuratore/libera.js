// La camicia mossa dal mouse, in diretta. PROVA (2026-11-17): si apre con ?prova=libera nell'indirizzo.
//
// Il proprietario, provato il film: "Io voglio poterla muovere come voglio, quanto voglio, anche continuamente".
// Un filmato registrato non lo permette. Qui le immagini sono le stesse, calcolate con Blender, ma messe in fila come
// pose (camicia/film/pose.py): dalla camicia spinta tutta a sinistra, per la camicia ferma, alla camicia spinta tutta
// a destra. Questo script sceglie quale posa mostrare, sessanta volte al secondo, come l'apertura sceglie i fotogrammi
// secondo lo scorrimento. Finché la mano la tocca, la camicia segue la mano; lasciata, dondola piano e si ferma.
// Non è il 3D in diretta bocciato a novembre: nel browser non si calcola nessuna immagine, si sceglie tra quelle pronte.

const SEGUE = 12;          // con che prontezza la camicia segue la mano (1/s): due decimi di secondo di ritardo morbido
const PERIODO = 3.8;       // lasciata, quanto dura un'oscillazione, in secondi (il proprietario l'ha voluta molto lenta)
const SMORZA = 0.2;        // quanto in fretta si spegne: qualche dondolio, poi ferma
const FERMA_DOPO = 220;    // millesimi di secondo senza movimento della mano dopo i quali la camicia è lasciata
const VIVA = 'configura__posa--viva';

/**
 * @param {HTMLElement} palco  il palco della camicia, con l'immagine ferma dentro
 * @param {string} dove        la cartella delle pose, per esempio "/camicia/pose/"
 */
export async function libera(palco, dove) {
  const ridotto = matchMedia('(prefers-reduced-motion: reduce)'), stretto = matchMedia('(max-width: 599px)');
  if (ridotto.matches || navigator.connection?.saveData) return;
  const ferma = palco.querySelector('.configura__ferma');
  const dati = await (await fetch(dove + 'pose.json')).json();
  const N = dati.pose, [, , larga, alta] = dati.riquadro, versione = '?v=' + dati.versione;

  // la tela sta sopra l'immagine ferma, solo sul riquadro in cui la camicia e la sua ombra si muovono
  const tela = document.createElement('canvas');
  tela.className = 'configura__posa';
  tela.width = larga; tela.height = alta;
  tela.setAttribute('aria-hidden', 'true');
  palco.style.setProperty('--posa-x', dati.riquadro[0] / dati.fotogramma[0]);
  palco.style.setProperty('--posa-w', larga / dati.fotogramma[0]);
  palco.style.setProperty('--posa-x-tel', (dati.riquadro[0] - dati.telefono[0]) / dati.telefono[1]);
  palco.style.setProperty('--posa-w-tel', larga / dati.telefono[1]);
  ferma.closest('picture').after(tela);
  const penna = tela.getContext('2d', { alpha: false });

  // --- le pose: prima quella ferma (dice anche se il browser legge l'AVIF), poi poche pose larghe, poi le altre
  const carica = (nome, formato) => new Promise((ok, no) => {
    const i = new Image();
    i.decoding = 'async';
    i.onload = () => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(() => ok(i));
    i.onerror = no;
    i.src = `${dove}${nome}.${formato}${versione}`;
  });
  let formato = 'avif', riposo;
  try { riposo = await carica('r', 'avif'); } catch { formato = 'webp'; riposo = await carica('r', 'webp'); }
  const pose = { s: new Array(N + 1).fill(null), d: new Array(N + 1).fill(null) };
  pose.s[0] = pose.d[0] = riposo;
  const ordine = [];
  for (let passo = N; passo >= 1; passo = Math.floor(passo / 2)) {
    for (let n = passo; n <= N; n += passo) if (!ordine.includes(n)) ordine.push(n);
  }
  const coda = ordine.flatMap((n) => [['s', n], ['d', n]]);
  const scarica = async () => {
    for (let prossima = coda.shift(); prossima; prossima = coda.shift()) {
      const [lato, n] = prossima;
      try { pose[lato][n] = await carica(`${lato}-${String(n).padStart(2, '0')}`, formato); } catch { /* una posa in meno: si usa la vicina */ }
    }
  };
  // le prime otto pose (le più larghe) bastano perché la camicia risponda; le altre arrivano mentre la si guarda
  const prime = coda.splice(0, 8);
  await Promise.all(prime.map(async ([lato, n]) => { try { pose[lato][n] = await carica(`${lato}-${String(n).padStart(2, '0')}`, formato); } catch { /* idem */ } }));
  for (let k = 0; k < 4; k++) scarica();

  /** La posa n di un lato, o la più vicina tra quelle già arrivate. */
  const posa = (lato, n) => {
    for (let k = 0; k <= N; k++) {
      const giu = pose[lato][n - k], su = pose[lato][n + k];
      if (giu) return giu;
      if (su) return su;
    }
    return riposo;
  };

  // --- il movimento. u dice dov'è la camicia: -1 tutta a sinistra, 0 ferma, 1 tutta a destra; v è la sua velocità
  let u = 0, v = 0, meta = 0, toccata = false, mossa = 0, prima = 0, giro = 0;
  const W = (2 * Math.PI) / PERIODO;
  const disegna = () => {
    const lato = u >= 0 ? 's' : 'd', a = Math.min(N, Math.abs(u) * N), n = Math.floor(a), resto = a - n;
    const sotto = posa(lato, n), sopra = resto > 0.02 ? posa(lato, Math.min(N, n + 1)) : null;
    penna.globalAlpha = 1;
    penna.drawImage(sotto, 0, 0);
    if (sopra && sopra !== sotto) { penna.globalAlpha = resto; penna.drawImage(sopra, 0, 0); }
  };
  const passo = (ora) => {
    const dt = Math.min(0.034, Math.max(0.001, (ora - prima) / 1000));
    prima = ora;
    if (toccata && ora - mossa > FERMA_DOPO) lascia();
    let spinta;
    if (toccata) spinta = SEGUE * SEGUE * (meta - u) - 2 * SEGUE * v;                 // segue la mano, senza rimbalzi
    else {
      // dondola appesa al nastro; quando il dondolio è ormai piccolo l'aria lo spegne più in fretta
      const coda = 1 - Math.min(1, Math.hypot(u, v / W) / 0.3);
      spinta = -W * W * u - 2 * (SMORZA + 0.45 * coda) * W * v;
      if (Math.abs(u) > 1) spinta -= 90 * (u - Math.sign(u)) + 6 * v;                  // oltre l'ultima posa non va
    }
    v += spinta * dt; u += v * dt;
    disegna();
    // ferma (meno di un pixel e mezzo dal riposo, e quasi senza velocità): torna l'immagine nitida, in dissolvenza
    if (toccata || Math.abs(u) > 0.012 || Math.abs(v) > 0.02) giro = requestAnimationFrame(passo);
    else { u = 0; v = 0; giro = 0; tela.classList.remove(VIVA); }
  };
  const sveglia = () => {
    if (giro) return;
    disegna();
    tela.classList.add(VIVA);
    prima = performance.now();
    giro = requestAnimationFrame(passo);
  };
  const lascia = () => {
    if (!toccata) return;
    toccata = false;
    v = Math.max(-1, Math.min(1, v * 0.4));          // la mano se ne va: la camicia prosegue di poco e torna
  };
  /** La mano si è spostata di dx pixel sulla camicia. */
  const spingi = (dx) => {
    if (ridotto.matches) return;
    const r = ferma.getBoundingClientRect();
    const corsa = r.width * (stretto.matches ? 0.68 : 0.29) * 0.6;       // sei decimi della larghezza della camicia: spinta piena
    if (!toccata) { toccata = true; meta = Math.max(-1, Math.min(1, u)); }
    meta = Math.max(-1, Math.min(1, meta + dx / corsa));
    mossa = performance.now();
    palco.dataset.toccata = '';
    sveglia();
  };

  // Dove sta la camicia: nel fotogramma largo tra il 25 e il 54% della larghezza e tra il 14 e il 95% dell'altezza
  // (in quello verticale del telefono, tra il 16 e l'84% della larghezza).
  const posto = (e) => {
    const r = ferma.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    const [da, a] = stretto.matches ? [0.16, 0.84] : [0.25, 0.54];
    return { sopra: y > 0.14 && y < 0.95 && x > da && x < a, aSinistra: x < (da + a) / 2 };
  };

  // Il mouse: finché si muove sulla camicia, la camicia lo segue; fermo o uscito, la lascia.
  let ultimaX = null;
  palco.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (!posto(e).sopra) { ultimaX = null; lascia(); return; }
    if (ultimaX !== null && e.clientX !== ultimaX) spingi(e.clientX - ultimaX);
    ultimaX = e.clientX;
  });
  palco.addEventListener('pointerleave', () => { ultimaX = null; lascia(); });

  // Il dito: trascinata di lato, la camicia segue il dito; un tocco fermo le dà un colpetto dal lato in cui si tocca.
  // Una strisciata in verticale è la pagina che scorre, e non conta.
  let dito = null;
  palco.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') dito = { x0: e.clientX, y0: e.clientY, x: e.clientX, verso: '' }; });
  palco.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || !dito) return;
    const dx = e.clientX - dito.x0, dy = e.clientY - dito.y0;
    if (!dito.verso && Math.hypot(dx, dy) > 8) dito.verso = Math.abs(dx) > Math.abs(dy) ? 'lato' : 'su';
    if (dito.verso === 'lato') spingi(e.clientX - dito.x);
    dito.x = e.clientX;
  });
  const alza = (e) => {
    if (!dito) return;
    if (!dito.verso && e.type === 'pointerup') {
      const p = posto(e);
      if (p.sopra && !ridotto.matches) { v += p.aSinistra ? 1.3 : -1.3; palco.dataset.toccata = ''; sveglia(); }
    }
    dito = null;
    lascia();
  };
  palco.addEventListener('pointerup', alza);
  palco.addEventListener('pointercancel', alza);

  // Se il visitatore chiede meno movimento a pagina aperta, la camicia si ferma.
  ridotto.addEventListener('change', () => { if (ridotto.matches) { toccata = false; u = 0; v = 0; delete palco.dataset.viva; } else palco.dataset.viva = ''; });

  // Pronta: compare l'invito, e la camicia si muove appena una volta da sola, per dire che è viva.
  palco.dataset.viva = '';
  setTimeout(() => {
    const r = palco.getBoundingClientRect();
    if (document.hidden || giro || r.bottom < 80 || r.top > innerHeight - 80 || ridotto.matches) return;
    v = 0.55;                                   // un dondolio appena accennato: in cinque secondi è ferma
    sveglia();
  }, 700);
}
