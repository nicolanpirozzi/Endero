// Pagina del configuratore. La camicia è l'immagine di Blender divisa in tre pezzi (leggera.js): dondola con gruccia e
// nastro quando le si passa sopra, e il suo tessuto ondeggia come un telo (onda.js). Dove il browser non ha
// l'accelerazione grafica il tessuto non ondeggia e la camicia dondola tutta insieme. Senza JavaScript, con il
// movimento ridotto o con il risparmio dati resta l'immagine ferma, e il riquadro delle misure funziona lo stesso.
// La guida alle misure (guida.js): la finestra dei passi all'apertura, e entrando in ogni campo di misura lo zoom
// sulla camicia dove si misura.
import { leggera } from './leggera.js';
import { passi, guida } from './guida.js';

const palco = document.querySelector('.configura__palco');
// Per i controlli (tools/prova-leggera.js): ?rigida spegne il tessuto che ondeggia, per provare la camicia che si
// vede dove la scheda grafica non c'è; ?comunque lo accende anche nel browser di prova, che la scheda grafica non l'ha;
// ?senza-passi non apre da sola la finestra dei passi.
const cerca = new URLSearchParams(location.search);
// la camicia saluta quando la finestra dei passi si chiude: sotto la finestra il saluto non si vedrebbe
const chiusa = passi();
const camicia = palco?.dataset.leggera
  ? leggera(palco, palco.dataset.leggera, palco.dataset.leggeraV, { onda: cerca.has('rigida') ? 0 : 1, comunque: cerca.has('comunque'), aspetta: chiusa }).catch((e) => { console.error(e); })
  : Promise.resolve();
if (palco) guida(palco, camicia);
